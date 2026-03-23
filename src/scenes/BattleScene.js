// BattleScene: Turn-based combat with interval identification, rhythm, and note reading

import { Villager } from '../entities/Villager.js';
import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';
import { AudioEngine } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';
import { CombatManager, COMBAT_STATES } from '../systems/CombatManager.js';
import { ZONES } from '../data/zones.js';

// Which background key to use per zone
const ZONE_BG = {
    forest:     'bg-forest',
    village:    'bg-village',
    caves:      'bg-caves',
    castle:     'bg-castle',
    underworld: 'bg-underworld',
    tower:      'bg-tower'
};

export class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    init(data) {
        this.progression      = data.progression || null;
        this.playerData       = data.playerData;
        this.villagerKey      = data.villagerKey;
        this.encounterIndex   = data.encounterIndex ?? -1;
        this.playerPos        = data.playerPos;
        this.currentZone      = this.progression?.currentZone || data.currentZone || 'forest';
        // Sidescroll overlay mode
        this.isSidescrollMode = data.isSidescrollMode || false;
        this.enemyId          = data.enemyId ?? null;
        this.isBoss           = data.isBoss || false;
        this.characterKey     = data.playerData?.characterKey || 'char1';
    }

    async create() {
        const { width, height } = this.cameras.main;
        const zone = ZONES[this.currentZone] || ZONES.forest;

        // --- BACKGROUND ---
        if (this.isSidescrollMode) {
            // Light frosted-glass dim so the frozen world stays visible behind
            this.add.rectangle(width / 2, height / 2, width, height, 0x000011, 0.52);
            // Battle panel with a glowing border
            this.add.rectangle(width / 2, height * 0.3, width - 16, height * 0.58, 0x050518, 0.88)
                .setStrokeStyle(3, this.isBoss ? 0xffaa00 : 0x4466cc);
        } else {
            this.createBackground(zone, width, height);
        }

        if (!this.isSidescrollMode) {
            this.add.rectangle(width / 2, height * 0.72, width, height * 0.56, 0x000000, 0.55).setDepth(1);
        }
        this.add.rectangle(width / 2, height * 0.44, width - 20, 2, 0x334466, this.isSidescrollMode ? 0.6 : 0.25).setDepth(1);

        // --- VILLAGER AREA ---
        this.villager = new Villager(this, this.villagerKey, width / 2, height * 0.22);

        // --- HP BARS — arcade style: player top-left, villager top-right ---

        // Player HP bar (top-left)
        this.add.rectangle(110, 50, 164, 18, 0x331111)
            .setStrokeStyle(1, 0x664444).setDepth(10);
        this.playerHpBar = this.add.rectangle(110, 50, 160, 14, 0x44ff44)
            .setDepth(10);
        this.add.text(14, 42, 'HP', { font: '11px monospace', fill: '#ff8888' })
            .setDepth(10);
        this.playerHpText = this.add.text(110, 50, '', {
            font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(11);
        this.playerLevelText = this.add.text(14, 64, '', {
            font: '11px monospace', fill: '#ffcc00', stroke: '#000000', strokeThickness: 2
        }).setDepth(10);

        // Villager help bar (top-right)
        this.add.rectangle(width - 110, 50, 164, 18, 0x331111)
            .setStrokeStyle(1, 0x664444).setDepth(10);
        this.monsterHpBar = this.add.rectangle(width - 110, 50, 160, 14, 0xffaa44)
            .setDepth(10);
        this.monsterNameText = this.add.text(width - 190, 42, this.villager.name, {
            font: '11px monospace', fill: '#88cc66', stroke: '#000000', strokeThickness: 2
        }).setDepth(10);
        this.monsterHpText = this.add.text(width - 110, 50, '', {
            font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(11);

        // Villager display name — centered above villager sprite
        this.add.text(width / 2, 14, this.villager.name, {
            font: 'bold 20px monospace', fill: '#ffdddd',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(10);

        // --- PLAYER AREA ---
        const ck = this.characterKey;
        this.playerSprite = this.add.sprite(100, height * 0.62, `player-${ck}`, 0);
        this.playerSprite.setScale(2.4).setFlipX(false).setDepth(2);
        if (this.anims.exists(`${ck}-idle`)) this.playerSprite.play(`${ck}-idle`);

        // Drone indicator — right side, below HP bar (no longer overlapping message box)
        this.droneText = this.add.text(width - 16, 72, '', {
            font: '13px monospace', fill: '#aaccff', stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setDepth(10);

        // --- MESSAGE BOX ---
        this.messageBg = this.add.rectangle(width / 2, height * 0.49, width - 40, 40, 0x000000, 0.6)
            .setDepth(9);
        this.messageText = this.add.text(width / 2, height * 0.49, '', {
            font: '15px monospace', fill: '#ffffff', align: 'center',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(10);

        // --- TIMER BAR ---
        this.timerBar = this.add.rectangle(width / 2, height * 0.44, 0, 5, 0xffcc00)
            .setVisible(false).setDepth(11);

        // --- SOLFEGE BUTTONS ---
        this.solfegeButtons = [];
        this.createSolfegeButtons(zone);

        // Replay button — below message box, not overlapping player sprite
        this.replayBtn = this.createBtn(width - 70, height * 0.56, '🔊 Replay', () => {
            if (this.combat) this.combat.replayInterval();
        }).setVisible(false).setDepth(10);

        // --- NOTE READING AREA ---
        this.staffRenderer = new VexFlowStaffRenderer(this);
        this.pianoKeys = [];
        this._staffVisible = false;

        // --- RHYTHM CHALLENGE AREA ---
        this._rhythmObjs = [];
        this._rhythmGrid = [];
        this._rhythmPlaying = false;
        this._rhythmTimer = null;

        // --- AUDIO + SYSTEMS ---
        this.musicTheory = new MusicTheory();
        this.audioEngine = new AudioEngine();
        this.noteReadingEngine = new NoteReadingEngine();

        await this.audioEngine.init();

        this.events.on('shutdown', () => {
            this.audioEngine.dispose();
            this._clearNoteReadingUI();
            this._clearRhythmUI();
        });

        // Default player stats for world map mode (no story save)
        const defaultStats = {
            hp: 100, maxHp: 100, attack: 12, defense: 4,
            level: 1, xp: 0, xpToNext: 50, gold: 0,
            characterKey: 'char1'
        };
        this.playerStats = { ...defaultStats, ...this.playerData };
        this.playerStats.calcDamage = (mult = 1) => {
            return Math.floor((this.playerStats.attack + Math.floor(Math.random() * 5)) * mult);
        };
        this.playerStats.takeDamage = (amt) => {
            const reduced = Math.max(1, amt - this.playerStats.defense);
            this.playerStats.hp = Math.max(0, this.playerStats.hp - reduced);
            return reduced;
        };
        this.playerStats.heal = (amt) => {
            this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + amt);
        };

        this.correctAnswers = 0;
        this.totalAnswers = 0;

        const availableDegrees = zone.scaleDegrees;
        this.combat = new CombatManager(
            this, this.playerStats, this.villager,
            this.musicTheory, this.audioEngine,
            availableDegrees, this.noteReadingEngine
        );
        this.combat.onStateChange = (state, data) => this.handleStateChange(state, data);

        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
            if (this.combat?.state === COMBAT_STATES.PLAYER_IDENTIFY) {
                this.combat.replayInterval();
            }
        });

        this.input.keyboard.on('keydown-ESC', () => this._openSettings());

        // Gear button — top right corner
        this.add.text(width - 16, 14, '⚙', {
            font: 'bold 20px monospace', fill: '#556677',
            padding: { x: 6, y: 4 }
        }).setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#aabbff' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#556677' }); })
            .on('pointerdown', () => this._openSettings());

        this.combat.startBattle();
        this.updateHpBars();
    }

    _openSettings() {
        this.scene.launch('SettingsScene', { callerKey: 'BattleScene', pauseCaller: true });
        this.scene.pause();
    }

    createBackground(zone, width, height) {
        const bgKey = ZONE_BG[zone.key] || 'bg-forest';

        try {
            const img = this.add.image(width / 2, height * 0.22, bgKey);
            const targetW = width;
            const targetH = height * 0.44;
            const scaleX = targetW / img.width;
            const scaleY = targetH / img.height;
            img.setScale(Math.max(scaleX, scaleY));
            img.setCrop(0, 0, img.width, img.height);
            this.add.rectangle(width / 2, height * 0.22, width, height * 0.44, 0x000000, 0.25);
        } catch (e) {
            this.cameras.main.setBackgroundColor(zone.bgColor);
        }

        if (zone.key === 'forest') {
            try {
                const trees = this.add.tileSprite(width / 2, height * 0.3, width, 160, 'bg-forest-trees');
                trees.setAlpha(0.5);
            } catch (e) {}
        }
    }

    createPlayerAnims() {
        // All character animations are pre-registered in BootScene._createCharAnims()
        // Nothing to do here — kept for compatibility
    }

    createSolfegeButtons(zone) {
        const { width, height } = this.cameras.main;
        const degrees = zone.scaleDegrees;
        const centerX = width / 2;
        const centerY = height * 0.82;
        const radius = Math.min(155, width * 0.38);

        degrees.forEach((degree, i) => {
            const angle = Math.PI + (Math.PI * i) / Math.max(degrees.length - 1, 1);
            const x = degrees.length === 1 ? centerX : centerX + Math.cos(angle) * radius;
            const y = degrees.length === 1 ? centerY : centerY + Math.sin(angle) * (radius * 0.45);

            const info = SCALE_DEGREES[degree];
            const label = `${degree} ${info.solfege}`;
            const btn = this.add.text(x, y, label, {
                font: 'bold 17px monospace', fill: info.color,
                backgroundColor: '#111133', padding: { x: 9, y: 5 },
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);

            btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a2a55' }));
            btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#111133' }));
            btn.on('pointerdown', () => {
                if (this.combat) { this.totalAnswers++; this.combat.submitAnswer(degree); }
            });

            btn.degree = degree;
            btn.setVisible(false);
            this.solfegeButtons.push(btn);
        });
    }

    createBtn(x, y, label, cb, color = '#111133') {
        const btn = this.add.text(x, y, label, {
            font: '13px monospace', fill: '#ffffff',
            backgroundColor: color, padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#333388' }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: color }));
        btn.on('pointerdown', cb);
        return btn;
    }

    // ---- NOTE READING UI ----

    buildPianoKeyboard(question) {
        this._clearNoteReadingUI();

        const { width, height } = this.cameras.main;

        this.staffRenderer.draw(width / 2, height * 0.30, 380, question);
        this._staffVisible = true;

        // Piano keyboard — all keys always labeled, all keys clickable
        const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const BLACK_KEYS = [
            { afterIdx: 0, note: 'C#' },
            { afterIdx: 1, note: 'D#' },
            { afterIdx: 3, note: 'F#' },
            { afterIdx: 4, note: 'G#' },
            { afterIdx: 5, note: 'A#' },
        ];
        const keyW = 52, keyH = 90, bkeyW = 30, bkeyH = 56;
        const totalW = WHITE_NOTES.length * keyW;
        const startX = width / 2 - totalW / 2;
        const keyTop = height - keyH - 14;

        const submitFn = (note) => {
            if (this.combat) { this.totalAnswers++; this.combat.submitNoteReadingAnswer(note); }
        };

        // White keys first
        WHITE_NOTES.forEach((note, i) => {
            const cx = startX + i * keyW + keyW / 2;
            const cy = keyTop + keyH / 2;
            const key = this.add.rectangle(cx, cy, keyW - 2, keyH, 0xeeeeee).setStrokeStyle(1, 0x555555).setDepth(5);
            const lbl = this.add.text(cx, keyTop + keyH - 12, note, {
                font: '11px monospace', fill: '#333333'
            }).setOrigin(0.5).setDepth(6);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0xbbddff));
            key.on('pointerout',  () => key.setFillStyle(0xeeeeee));
            key.on('pointerdown', () => submitFn(note));
            this.pianoKeys.push(key, lbl);
        });

        // Black keys on top (no labels — centered between adjacent white keys)
        BLACK_KEYS.forEach(({ afterIdx, note }) => {
            const cx = startX + (afterIdx + 1) * keyW;
            const cy = keyTop + bkeyH / 2;
            const key = this.add.rectangle(cx, cy, bkeyW, bkeyH, 0x222222).setStrokeStyle(1, 0x000000).setDepth(7);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0x3355aa));
            key.on('pointerout',  () => key.setFillStyle(0x222222));
            key.on('pointerdown', () => submitFn(note));
            this.pianoKeys.push(key);
        });
    }

    _clearNoteReadingUI() {
        this.pianoKeys.forEach(k => { if (k && k.destroy) k.destroy(); });
        this.pianoKeys = [];
        if (this._staffVisible) {
            this.staffRenderer.clear();
            this._staffVisible = false;
        }
    }

    // ---- RHYTHM CHALLENGE UI ----

    buildRhythmGrid(rhythmData) {
        this._clearRhythmUI();

        const { width, height } = this.cameras.main;
        const { pattern, subdivision, cells, downbeats } = rhythmData;

        this._rhythmGrid = new Array(cells).fill(0);
        this._rhythmPattern = pattern;
        this._rhythmSubdivision = subdivision;

        const GAP = 3;
        const MARGIN = 30;
        const usable = width - MARGIN * 2;
        const cellW = (usable - GAP * (cells - 1)) / cells;
        const cellH = 50;
        const gridY = height * 0.72;
        const gridX = MARGIN;

        const cellLabels = {
            quarter:   ['1', '2', '3', '4'],
            eighth:    ['1', '+', '2', '+', '3', '+', '4', '+'],
            sixteenth: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'],
            triplet:   ['1','p','l','2','p','l','3','p','l','4','p','l'],
        }[subdivision] || ['1', '2', '3', '4'];

        this._rhythmCellRects = [];
        this._rhythmCellCenters = [];

        for (let i = 0; i < cells; i++) {
            const cx = gridX + i * (cellW + GAP) + cellW / 2;
            const cy = gridY + cellH / 2;
            const isDB = downbeats.includes(i);

            const bg = this.add.rectangle(cx, cy, cellW, cellH, 0x111122)
                .setStrokeStyle(1, 0x223344).setDepth(5);

            const lbl = this.add.text(cx, gridY - 10, cellLabels[i], {
                font: isDB ? 'bold 14px monospace' : '10px monospace',
                fill: isDB ? '#aaccee' : '#556677'
            }).setOrigin(0.5).setDepth(6);

            // Rest symbol text
            const sym = this.add.text(cx, cy, '–', {
                font: '20px monospace', fill: '#667788'
            }).setOrigin(0.5).setDepth(6);

            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this._toggleRhythmCell(i));
            bg.on('pointerover', () => bg.setStrokeStyle(2, 0x5588aa));
            bg.on('pointerout', () => bg.setStrokeStyle(1, 0x223344));

            this._rhythmCellRects.push(bg);
            this._rhythmCellCenters.push({ x: cx, y: cy });
            this._rhythmObjs.push(bg, lbl, sym);
            bg._symText = sym;
        }

        // Submit button
        const submitBtn = this.createBtn(width / 2, gridY + cellH + 35, 'SUBMIT RHYTHM', () => {
            if (this.combat) {
                this.totalAnswers++;
                this.combat.submitRhythmAnswer(this._rhythmGrid);
            }
        }, '#1a3311').setDepth(10);
        this._rhythmObjs.push(submitBtn);

        // Play the pattern once for the player
        this._playRhythmPattern(rhythmData);
    }

    _toggleRhythmCell(idx) {
        if (this._rhythmGrid[idx]) {
            this._rhythmGrid[idx] = 0;
            this._rhythmCellRects[idx].setFillStyle(0x111122);
            this._rhythmCellRects[idx]._symText.setText('–').setStyle({ fill: '#667788' });
        } else {
            this._rhythmGrid[idx] = 1;
            this._rhythmCellRects[idx].setFillStyle(0x1a2a44);
            this._rhythmCellRects[idx]._symText.setText('♪').setStyle({ fill: '#44aaff' });
        }
    }

    _playRhythmPattern(rhythmData) {
        const { pattern, subdivision, cells, downbeats } = rhythmData;
        const BPM = 100;
        const quarterMs = 60000 / BPM;
        const cellFraction = subdivision === 'quarter' ? 1 : 0.5;
        const cellMs = quarterMs * cellFraction;

        this._rhythmPlaying = true;
        let i = 0;

        const tick = () => {
            if (!this._rhythmPlaying) return;

            // Highlight current cell briefly
            if (this._rhythmCellRects[i]) {
                this._rhythmCellRects[i].setStrokeStyle(2, 0xffcc00);
                this.time.delayedCall(cellMs * 0.8, () => {
                    if (this._rhythmCellRects[i]) {
                        this._rhythmCellRects[i].setStrokeStyle(1, 0x223344);
                    }
                });
            }

            // Metronome click on downbeats
            if (downbeats.includes(i)) {
                this.audioEngine.playClick(i === 0);
            }

            // Note sound on pattern cells
            if (pattern[i]) {
                this.audioEngine.playDrumNote();
            }

            i++;
            if (i < cells) {
                this._rhythmTimer = this.time.delayedCall(cellMs, tick);
            } else {
                this._rhythmPlaying = false;
            }
        };

        tick();
    }

    _clearRhythmUI() {
        this._rhythmPlaying = false;
        if (this._rhythmTimer) {
            this._rhythmTimer.remove(false);
            this._rhythmTimer = null;
        }
        this._rhythmObjs.forEach(o => { if (o && o.destroy) o.destroy(); });
        this._rhythmObjs = [];
        this._rhythmCellRects = [];
        this._rhythmCellCenters = [];
        this._rhythmGrid = [];
    }

    // ---- STATE HANDLER ----

    handleStateChange(state, data) {
        this.messageText.setText(data.message || '');
        this.updateHpBars();

        // Reset interactive areas
        this.solfegeButtons.forEach(b => b.setVisible(false));
        this.replayBtn.setVisible(false);
        this.timerBar.setVisible(false);

        // Hide note reading if not in note reading states
        if (state !== COMBAT_STATES.NOTE_READING_QUESTION && state !== COMBAT_STATES.NOTE_READING_RESULT) {
            this._clearNoteReadingUI();
        }
        // Hide rhythm if not in rhythm states
        if (state !== COMBAT_STATES.RHYTHM_QUESTION && state !== COMBAT_STATES.RHYTHM_RESULT) {
            this._clearRhythmUI();
        }

        switch (state) {
            case COMBAT_STATES.INTRO:
                this.droneText.setText(data.droneNote ? `Drone: ${data.droneNote}` : '');
                break;

            case COMBAT_STATES.VILLAGER_REQUEST:
                break;

            case COMBAT_STATES.PLAYER_IDENTIFY:
                this.solfegeButtons.forEach(b => b.setVisible(true));
                this.replayBtn.setVisible(true);
                this.droneText.setText(`Drone: ${data.droneNote}`);
                this.startTimer();
                break;

            case COMBAT_STATES.PLAYER_RESULT: {
                this.timerBar.setVisible(false);
                if (data.correct) {
                    this.correctAnswers++;
                    this._playerHopForward();
                    this.showDamageNumber(this.villager.sprite.x, this.villager.sprite.y - 40, data.damage, '#ffcc00');
                } else {
                    this._playerShake();
                    this.showDamageNumber(this.playerSprite.x, this.playerSprite.y - 30, data.damage, '#ff4444');
                    if (data.correctAnswer) this.flashCorrectSolfege(data.correctAnswer);
                }
                break;
            }

            case COMBAT_STATES.NOTE_READING_QUESTION:
                if (data.question) this.buildPianoKeyboard(data.question);
                this.startTimer();
                break;

            case COMBAT_STATES.NOTE_READING_RESULT: {
                this._clearNoteReadingUI();
                if (data.correct) {
                    this.correctAnswers++;
                    this._playerHopForward();
                    this.showDamageNumber(this.villager.sprite.x, this.villager.sprite.y - 40, data.damage, '#ffcc00');
                } else {
                    this._playerShake();
                    this.showDamageNumber(this.playerSprite.x, this.playerSprite.y - 30, data.damage, '#ff4444');
                }
                break;
            }

            case COMBAT_STATES.RHYTHM_QUESTION:
                this.droneText.setText('');
                if (data.rhythm) this.buildRhythmGrid(data.rhythm);
                this.startTimer();
                break;

            case COMBAT_STATES.RHYTHM_RESULT: {
                this._clearRhythmUI();
                if (data.correct) {
                    this.correctAnswers++;
                    this._playerHopForward();
                    this.showDamageNumber(this.villager.sprite.x, this.villager.sprite.y - 40, data.damage, '#ffcc00');
                } else {
                    this._playerShake();
                    this.showDamageNumber(this.playerSprite.x, this.playerSprite.y - 30, data.damage, '#ff4444');
                }
                break;
            }

            case COMBAT_STATES.VILLAGER_HELPED:
                this.time.delayedCall(2000, () => this.endBattle(true, data));
                break;

            case COMBAT_STATES.PLAYER_EXHAUSTED:
                this._playerShake();
                this.time.delayedCall(2000, () => this.endBattle(false, data));
                break;
        }
    }

    _playerHopForward() {
        const origX = this.playerSprite.x;
        if (this.anims.exists(`${this.characterKey}-walk-right`)) {
            this.playerSprite.play(`${this.characterKey}-walk-right`);
        }
        this.tweens.add({
            targets: this.playerSprite,
            x: origX + 20, duration: 150, yoyo: true,
            onComplete: () => {
                this.playerSprite.x = origX;
                if (this.anims.exists(`${this.characterKey}-idle`)) {
                    this.playerSprite.play(`${this.characterKey}-idle`);
                }
            }
        });
    }

    _playerShake() {
        const origX = this.playerSprite.x;
        this.tweens.add({
            targets: this.playerSprite,
            x: origX - 8, duration: 60, yoyo: true, repeat: 2,
            onComplete: () => { this.playerSprite.x = origX; }
        });
    }

    startTimer() {
        const { width } = this.cameras.main;
        this.timerBar.setVisible(true).setSize(width - 80, 5).setPosition(width / 2, this.timerBar.y);
        this.tweens.killTweensOf(this.timerBar);
        this.timerBar.setDisplaySize(width - 80, 5).setFillStyle(0xffcc00);
        this.tweens.add({
            targets: this.timerBar, displayWidth: 0, duration: 8000, ease: 'Linear',
            onUpdate: () => {
                const r = this.timerBar.displayWidth / (width - 80);
                this.timerBar.setFillStyle(r < 0.25 ? 0xff4444 : r < 0.5 ? 0xffaa00 : 0xffcc00);
            },
            onComplete: () => {
                if (!this.combat) return;
                const state = this.combat.state;
                this.totalAnswers++;
                if (state === COMBAT_STATES.PLAYER_IDENTIFY) {
                    this.combat.submitAnswer('__timeout__');
                } else if (state === COMBAT_STATES.NOTE_READING_QUESTION) {
                    this.combat.submitNoteReadingAnswer('__timeout__');
                } else if (state === COMBAT_STATES.RHYTHM_QUESTION) {
                    this.combat.submitRhythmAnswer(this._rhythmGrid);
                }
            }
        });
    }

    showDamageNumber(x, y, amount, color) {
        const txt = this.add.text(x, y, `-${amount}`, {
            font: 'bold 22px monospace', fill: color, stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: y - 40, alpha: 0, duration: 900,
            onComplete: () => txt.destroy() });
    }

    flashCorrectSolfege(degree) {
        const btn = this.solfegeButtons.find(b => b.degree === degree);
        if (btn) {
            btn.setVisible(true);
            this.tweens.add({ targets: btn, scaleX: { from: 1.4, to: 1 }, scaleY: { from: 1.4, to: 1 },
                duration: 400, repeat: 2 });
        }
    }

    updateHpBars() {
        const mRatio = Math.max(0, this.villager.helpNeeded / this.villager.maxHelpNeeded);
        this.monsterHpBar.setScale(mRatio, 1);
        this.monsterHpBar.setFillStyle(mRatio < 0.25 ? 0xff2222 : mRatio < 0.5 ? 0xff8800 : 0xffaa44);
        this.monsterHpText.setText(`${this.villager.helpNeeded}/${this.villager.maxHelpNeeded}`);

        const pRatio = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
        this.playerHpBar.setScale(pRatio, 1);
        this.playerHpBar.setFillStyle(pRatio < 0.25 ? 0xff2222 : pRatio < 0.5 ? 0xffaa00 : 0x44ff44);
        this.playerHpText.setText(`${this.playerStats.hp}/${this.playerStats.maxHp}`);
        this.playerLevelText.setText(`Lv.${this.playerStats.level}`);
    }

    endBattle(playerWon, data) {
        this.audioEngine.stopDrone();

        if (this.isSidescrollMode) {
            this._endBattleSidescroll(playerWon, data);
            return;
        }

        // ── Classic story/overworld flow ──────────────────────────────────
        if (playerWon) {
            this.scene.start('RewardScene', {
                progression:    this.progression,
                playerData:     this.playerStats,
                villagerName:   this.villager.name,
                villagerKey:    this.villagerKey,
                encounterIndex: this.encounterIndex,
                xp:             data.xp   || this.villager.friendship,
                gold:           data.gold || this.villager.gratitude,
                correctAnswers: this.correctAnswers,
                totalAnswers:   this.totalAnswers,
                playerPos:      this.playerPos
            });
        } else {
            this.playerStats.hp = Math.floor(this.playerStats.maxHp * 0.5);
            if (this.progression) this.progression.save(this.playerStats);
            this.scene.start('VillageScene', {
                progression:      this.progression,
                playerData:       this.playerStats,
                returnFromBattle: true
            });
        }
    }

    _endBattleSidescroll(playerWon, data) {
        const { width, height } = this.cameras.main;
        const xp   = data?.xp   || this.villager.friendship;
        const gold = data?.gold || this.villager.gratitude;

        // Apply XP / level up to playerStats
        if (playerWon) {
            this.playerStats.gold  = (this.playerStats.gold || 0) + gold;
            this.playerStats.xp   += xp;
            while (this.playerStats.xp >= this.playerStats.xpToNext) {
                this.playerStats.xp      -= this.playerStats.xpToNext;
                this.playerStats.level++;
                this.playerStats.xpToNext = Math.floor(this.playerStats.xpToNext * 1.5);
                this.playerStats.maxHp   += 10;
                this.playerStats.hp       = this.playerStats.maxHp;
                this.playerStats.attack  += 3;
                this.playerStats.defense += 1;
            }
            if (this.progression) {
                this.progression.recordBattle(true, this.correctAnswers, this.totalAnswers);
                this.progression.save(this.playerStats);
            }
        } else {
            this.playerStats.hp = Math.max(1, Math.floor(this.playerStats.maxHp * 0.5));
        }

        // Result popup (inside battle overlay, no new scene)
        const popupBg = this.add.rectangle(width / 2, height / 2, 360, 180, 0x000022, 0.95)
            .setStrokeStyle(2, playerWon ? 0x44ff44 : 0xff4444);

        const titleTxt = playerWon ? 'WONDERFUL!' : 'OUT OF ENERGY!';
        const titleCol = playerWon ? '#ffcc00'  : '#ff8888';
        this.add.text(width / 2, height / 2 - 55, titleTxt, {
            font: 'bold 30px monospace', fill: titleCol,
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        if (playerWon) {
            this.add.text(width / 2, height / 2 - 10, `+${xp} Friendship   +${gold} Gratitude`, {
                font: '18px monospace', fill: '#ffcc00', stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5);
            const accuracy = this.totalAnswers > 0
                ? Math.round((this.correctAnswers / this.totalAnswers) * 100) : 0;
            this.add.text(width / 2, height / 2 + 20, `Accuracy: ${accuracy}%`, {
                font: '14px monospace', fill: '#aaccff'
            }).setOrigin(0.5);
            this.add.text(width / 2, height / 2 + 42, `Lv.${this.playerStats.level}  HP ${this.playerStats.hp}/${this.playerStats.maxHp}`, {
                font: '13px monospace', fill: '#88cc88'
            }).setOrigin(0.5);
        } else {
            this.add.text(width / 2, height / 2 - 5, 'You ran out of energy...\nHP restored to 50%', {
                font: '16px monospace', fill: '#ffaa88',
                align: 'center'
            }).setOrigin(0.5);
        }

        const contBtn = this.add.text(width / 2, height / 2 + 72, 'CONTINUE  ▶', {
            font: 'bold 18px monospace', fill: '#ffffff',
            backgroundColor: '#224422', padding: { x: 22, y: 10 }
        }).setOrigin(0.5).setAlpha(0);

        this.time.delayedCall(1000, () => {
            contBtn.setAlpha(1).setInteractive({ useHandCursor: true });
            contBtn.on('pointerover', () => contBtn.setStyle({ backgroundColor: '#336633' }));
            contBtn.on('pointerout',  () => contBtn.setStyle({ backgroundColor: '#224422' }));
            contBtn.on('pointerdown', () => {
                // Build a clean playerData (plain object, no functions)
                const cleanData = {
                    hp: this.playerStats.hp,
                    maxHp: this.playerStats.maxHp,
                    attack: this.playerStats.attack,
                    defense: this.playerStats.defense,
                    level: this.playerStats.level,
                    xp: this.playerStats.xp,
                    xpToNext: this.playerStats.xpToNext,
                    gold: this.playerStats.gold || 0,
                    characterKey: this.characterKey
                };
                const sideScene = this.scene.get('SidescrollScene');
                if (sideScene) {
                    sideScene.events.emit('battleResult', {
                        won:        playerWon,
                        enemyId:    this.enemyId,
                        isBoss:     this.isBoss,
                        xp, gold,
                        playerData: cleanData
                    });
                }
                this.scene.stop('BattleScene');
                this.scene.resume('SidescrollScene');
            });
        });
    }
}
