// ArcadeScene: Standalone arcade gameplay loop (tones, rhythm, note reading)

import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';
import { AudioEngine, DRONE_PRESETS, INTERVAL_PRESETS } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { WorldMapProgress } from '../systems/WorldMapProgress.js';

// Tones difficulty tiers: round → available scale degree keys
const TONES_TIERS = [
    { minRound: 1,  degrees: ['1', '3', '5'] },
    { minRound: 6,  degrees: ['1', '2', '3', '4', '5'] },
    { minRound: 11, degrees: ['1', '2', 'b3', '3', '4', '5', 'b7'] },
    { minRound: 16, degrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'] },
    { minRound: 21, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7'] },
    { minRound: 26, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] },
];

const ARCADE_STATES = {
    IDLE: 'idle', QUESTION: 'question', CORRECT: 'correct', WRONG: 'wrong',
    LEVEL_UP: 'level_up', GAME_OVER: 'game_over', HIGH_SCORE: 'high_score'
};

export class ArcadeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ArcadeScene' });
    }

    init(data) {
        this.mode        = data.mode || 'tones';
        this.subMode     = data.subMode || 'competitive';
        this.clefSetting = data.clefSetting || 'treble';
        this.freePlayPool = data.freePlayPool || [];
        this.initPlayerData = data.playerData || { hp: 100, maxHp: 100, attack: 10, defense: 3, level: 1 };
        // World map params
        this.scaleDegrees      = data.scaleDegrees      || null;
        this.patternIds        = data.patternIds        || null;
        this.noteReadingConfig = data.noteReadingConfig || null;
        this.locationId        = data.locationId        || null;
        this.returnScene       = data.returnScene       || 'ArcadeMenuScene';
        this.returnData        = data.returnData        || null;
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#050510');

        // Session state
        this.session = {
            score: 0,
            round: 1,
            streak: 0,
            hp: this.initPlayerData.hp || 100,
            maxHp: this.initPlayerData.maxHp || 100,
            attack: this.initPlayerData.attack || 10,
            defense: this.initPlayerData.defense || 3,
        };

        this._questionActive = false;
        this._soundPanelOpen = false;
        this._soundPanelObjs = [];

        // --- HUD ---
        this.add.text(width / 2, 18, this._modeLabel(), {
            font: 'bold 22px monospace', fill: '#ffaa00',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // HP bar
        this.add.rectangle(width / 2, 42, 302, 14, 0x000000, 0.7);
        this.hpBar = this.add.rectangle(width / 2 - 150, 36, 300, 10, 0x44ff44).setOrigin(0, 0);
        this.hpText = this.add.text(width / 2, 42, '', {
            font: '11px monospace', fill: '#ffffff', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);

        // Score / round
        this.scoreText = this.add.text(20, 8, 'Score: 0', {
            font: '14px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 2
        });
        this.roundText = this.add.text(width - 20, 8, 'Round 1', {
            font: '14px monospace', fill: '#aaddff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0);
        this.streakText = this.add.text(20, 26, '', {
            font: '12px monospace', fill: '#ffaaaa',
            stroke: '#000000', strokeThickness: 2
        });

        // Message area
        this.messageBg = this.add.rectangle(width / 2, height * 0.47, width - 40, 42, 0x000000, 0.65);
        this.messageText = this.add.text(width / 2, height * 0.47, '', {
            font: '15px monospace', fill: '#ffffff', align: 'center',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);

        // Drone text (tones mode)
        this.droneText = this.add.text(width - 20, 58, '', {
            font: '13px monospace', fill: '#aaccff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setVisible(false);

        // Solfege buttons container
        this.solfegeButtons = [];
        this._solfegeContainer = this.add.container(0, 0);

        // Note reading area
        this.staffRenderer = new VexFlowStaffRenderer(this);
        this.pianoKeys = [];
        this._staffVisible = false;

        // Timer bar
        this.timerBar = this.add.rectangle(width / 2, 70, 0, 5, 0xffcc00).setVisible(false);

        // --- Audio ---
        this.musicTheory = new MusicTheory();
        this.audioEngine = new AudioEngine();
        this.noteReadingEngine = new NoteReadingEngine();

        this.events.on('shutdown', () => {
            this.audioEngine.dispose();
            this._hideSoundPanel();
        });

        // Back button
        this._makeBtn(50, height - 24, 'QUIT', '#221111', '#443333', () => {
            this.audioEngine.dispose();
            this._returnToSource();
        });

        // Sound settings button
        this._makeBtn(width - 50, height - 24, '⚙ SOUND', '#112233', '#223344', () => {
            this._soundPanelOpen ? this._hideSoundPanel() : this._showSoundPanel();
        });

        this.updateHud();

        // Start the first question immediately — don't block on audio init
        // (AudioEngine methods all guard with `if (!this.initialized) return`)
        this.time.delayedCall(300, () => this._nextQuestion());

        // Init audio in parallel — will be ready by the time the player answers
        try {
            await this.audioEngine.init();
        } catch (e) {
            console.warn('ArcadeScene: audio init failed, continuing silently', e);
        }
    }

    _modeLabel() {
        const labels = { tones: 'TONES', noteReading: 'NOTE READING' };
        const sub = this.subMode === 'freePlay' ? ' (Free Play)' : '';
        return (labels[this.mode] || this.mode) + sub;
    }

    // ===================== QUESTION DISPATCH =====================

    _nextQuestion() {
        if (this._questionActive) return;
        this._questionActive = true;
        this._questionStartTime = performance.now();

        // Clear all lingering UI from previous question type
        this._clearSolfegeButtons();
        this._clearNoteAnswerButtons();

        if (this.mode === 'tones') {
            this._askTones();
        } else {
            this._askNoteReading();
        }
    }

    // ===================== TONES MODE =====================

    _askTones() {
        const { width, height } = this.cameras.main;
        const degrees = this._getTonesPool();

        const needsNewRoot = this._nextDroneChange === undefined || this.session.round >= this._nextDroneChange;

        if (needsNewRoot) {
            // New key every 5 questions
            this.audioEngine.stopDrone();
            this.musicTheory.randomizeRoot();
            this._nextDroneChange = this.session.round + 5;

            this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
            this.droneText.setText(`Key: ${this.musicTheory.rootNote}`).setVisible(true);
            this.messageText.setText(`Key: ${this.musicTheory.rootNote} — listen: 1 · 5 · 1`);

            // Play 1→5→1 cadence to orient the player
            const freq1 = this.musicTheory.getIntervalFreq('1');
            const freq5 = this.musicTheory.getIntervalFreq('5');
            this.audioEngine.playInterval(freq1, '4n');
            this.time.delayedCall(550,  () => this.audioEngine.playInterval(freq5, '4n'));
            this.time.delayedCall(1100, () => this.audioEngine.playInterval(freq1, '4n'));
            this.time.delayedCall(1700, () => this._fireTonesQuestion(degrees, width, height));
        } else {
            // Same key, jump straight to question
            this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
            this.droneText.setText(`Key: ${this.musicTheory.rootNote}`).setVisible(true);
            this._fireTonesQuestion(degrees, width, height);
        }
    }

    _fireTonesQuestion(degrees, width, height) {
        this._currentDegree = degrees[Math.floor(Math.random() * degrees.length)];
        const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
        this.messageText.setText(`Round ${this.session.round} — Identify the note!`);
        this.time.delayedCall(400, () => {
            this.audioEngine.playInterval(freq, '2n');
            this._buildSolfegeButtons(degrees, width, height);
            this._startTimerBar();
        });
    }

    _getTonesPool() {
        if (this.scaleDegrees && this.scaleDegrees.length > 0) return this.scaleDegrees;
        if (this.subMode === 'freePlay' && this.freePlayPool.length > 0) return this.freePlayPool;
        const tier = [...TONES_TIERS].reverse().find(t => this.session.round >= t.minRound) || TONES_TIERS[0];
        return tier.degrees;
    }

    _buildSolfegeButtons(degrees, width, height) {
        this.solfegeButtons.forEach(b => b.destroy());
        this.solfegeButtons = [];

        // Circle of fifths order for the 12 chromatic scale degrees
        const CIRCLE_OF_FIFTHS = ['1', '5', '2', '6', '3', '7', '#4', 'b2', 'b6', 'b3', 'b7', '4'];

        const allTwelve = degrees.length === 12 &&
            CIRCLE_OF_FIFTHS.every(d => degrees.includes(d));

        let orderedDegrees = degrees;
        let centerX, centerY, useFullCircle;

        if (allTwelve) {
            // Arrange clockwise from top in circle-of-fifths order
            orderedDegrees = CIRCLE_OF_FIFTHS;
            centerX = width / 2;
            centerY = height * 0.72;
            useFullCircle = true;
        } else {
            centerX = width / 2;
            centerY = height * 0.78;
            useFullCircle = false;
        }

        const radius = allTwelve ? Math.min(145, width * 0.34) : Math.min(155, width * 0.38);

        orderedDegrees.forEach((degree, i) => {
            let x, y;
            if (useFullCircle) {
                // Start at top (−π/2), go clockwise
                const angle = -Math.PI / 2 + (2 * Math.PI * i) / orderedDegrees.length;
                x = centerX + Math.cos(angle) * radius;
                y = centerY + Math.sin(angle) * radius;
            } else if (degrees.length === 1) {
                x = centerX;
                y = centerY;
            } else {
                const angle = Math.PI + (Math.PI * i) / Math.max(degrees.length - 1, 1);
                x = centerX + Math.cos(angle) * radius;
                y = centerY + Math.sin(angle) * (radius * 0.45);
            }

            const info = SCALE_DEGREES[degree];
            if (!info) return;
            const btn = this.add.text(x, y, `${info.solfege}\n${degree}`, {
                font: 'bold 15px monospace', fill: info.color,
                backgroundColor: '#111133', padding: { x: 9, y: 5 },
                stroke: '#000000', strokeThickness: 2,
                align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a2a55' }));
            btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#111133' }));
            btn.on('pointerdown', () => this._submitTones(degree));
            btn.degree = degree;
            this.solfegeButtons.push(btn);
        });

        // Replay hint
        this.input.keyboard.once('keydown-SPACE', () => {
            if (this._questionActive && this.mode === 'tones') {
                const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
                this.audioEngine.playInterval(freq, '2n');
            }
        });
    }

    _submitTones(selected) {
        if (!this._questionActive) return;
        this._clearSolfegeButtons();
        this.timerBar.setVisible(false);
        this.tweens.killTweensOf(this.timerBar);

        const correct = selected === this._currentDegree;
        const responseTime = performance.now() - this._questionStartTime;
        this.audioEngine.stopDrone();
        this.droneText.setVisible(false);

        if (correct) {
            this.audioEngine.playCorrect();
            const pts = this._calcPoints(responseTime, this.session.streak);
            this.session.score += pts;
            this.session.streak++;
            this.messageText.setText(`Correct! +${pts} pts  (streak: ${this.session.streak})`);
            this._showFlash('#44ff44');
        } else {
            this.audioEngine.playWrong();
            const dmg = Math.max(1, 5 + this.session.round * 0.5 - this.session.defense);
            this.session.hp = Math.max(0, this.session.hp - dmg);
            this.session.streak = 0;
            const correct_info = SCALE_DEGREES[this._currentDegree];
            this.messageText.setText(`Wrong! It was ${correct_info ? correct_info.solfege : this._currentDegree}. -${dmg} HP`);
            this._showFlash('#ff4444');
        }

        this.updateHud();
        this._questionActive = false;

        if (this.session.hp <= 0 && this.subMode === 'competitive') {
            this.time.delayedCall(1200, () => this._gameOver());
        } else {
            this.session.round++;
            this.time.delayedCall(1400, () => this._nextQuestion());
        }
    }

    _clearSolfegeButtons() {
        this.solfegeButtons.forEach(b => b.destroy());
        this.solfegeButtons = [];
    }

    // ===================== NOTE READING MODE =====================

    _askNoteReading() {
        const { width, height } = this.cameras.main;

        this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, this.clefSetting, this.noteReadingConfig);
        if (!this._currentNoteQuestion) {
            this.messageText.setText('No notes available for this configuration.');
            this._questionActive = false;
            return;
        }

        this.messageText.setText(`Round ${this.session.round} — Name this note!`);

        // Clear any previous note reading UI first
        this._clearNoteAnswerButtons();

        // Draw staff with a subtle background panel
        const staffCX = width / 2;
        const staffCY = height * 0.32;
        this.staffRenderer.draw(staffCX, staffCY, 380, this._currentNoteQuestion);
        this._staffVisible = true;

        // Build piano keyboard (does NOT clear — we just drew everything above)
        this._buildNoteAnswerButtons(this._currentNoteQuestion, width, height);
        this._startTimerBar();
    }

    _buildNoteAnswerButtons(question, width, height) {
        // Piano keyboard — white keys labeled, black keys unlabeled, all clickable
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

        const submitFn = (note) => this._submitNoteReading(note);

        // White keys first
        WHITE_NOTES.forEach((note, i) => {
            const cx = startX + i * keyW + keyW / 2;
            const cy = keyTop + keyH / 2;
            const key = this.add.rectangle(cx, cy, keyW - 2, keyH, 0xeeeeee).setStrokeStyle(1, 0x555555);
            const lbl = this.add.text(cx, keyTop + keyH - 12, note, {
                font: '11px monospace', fill: '#333333'
            }).setOrigin(0.5);
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
            const key = this.add.rectangle(cx, cy, bkeyW, bkeyH, 0x222222).setStrokeStyle(1, 0x000000);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0x3355aa));
            key.on('pointerout',  () => key.setFillStyle(0x222222));
            key.on('pointerdown', () => submitFn(note));
            this.pianoKeys.push(key);
        });
    }

    _clearNoteAnswerButtons() {
        this.pianoKeys.forEach(k => k.destroy());
        this.pianoKeys = [];
        if (this._staffVisible) {
            this.staffRenderer.clear();
            this._staffVisible = false;
        }
    }

    _submitNoteReading(answer) {
        if (!this._questionActive) return;
        this._clearNoteAnswerButtons();
        this.timerBar.setVisible(false);
        this.tweens.killTweensOf(this.timerBar);

        const correct = this.noteReadingEngine.checkAnswer(this._currentNoteQuestion, answer);
        const responseTime = performance.now() - this._questionStartTime;

        if (correct) {
            this.audioEngine.playCorrect();
            const pts = this._calcPoints(responseTime, this.session.streak);
            this.session.score += pts;
            this.session.streak++;
            this.messageText.setText(`Correct! It was ${this._currentNoteQuestion.correctAnswer}! +${pts} pts`);
            this._showFlash('#44ff44');
        } else {
            this.audioEngine.playWrong();
            const dmg = Math.max(1, 5 + this.session.round * 0.5 - this.session.defense);
            this.session.hp = Math.max(0, this.session.hp - dmg);
            this.session.streak = 0;
            this.messageText.setText(`Wrong! It was ${this._currentNoteQuestion.correctAnswer}. -${dmg} HP`);
            this._showFlash('#ff4444');
        }

        this.updateHud();
        this._questionActive = false;

        if (this.session.hp <= 0 && this.subMode === 'competitive') {
            this.time.delayedCall(1200, () => this._gameOver());
        } else {
            this.session.round++;
            this.time.delayedCall(1500, () => this._nextQuestion());
        }
    }

    // ===================== GAME OVER / SCORING =====================

    _calcPoints(responseTimeMs, streak) {
        const base = 100;
        const speedBonus = Math.max(0, Math.floor(50 * (1 - responseTimeMs / 4000)));
        const streakBonus = Math.min(50, streak * 10);
        return base + speedBonus + streakBonus;
    }

    _gameOver() {
        const { width, height } = this.cameras.main;
        this._clearSolfegeButtons();
        this._clearNoteAnswerButtons();

        // Save score
        if (this.subMode === 'competitive') {
            const pm = new ProgressionManager();
            pm.saveArcadeScore(this.mode, this.session.score);
        }
        // Save world map progress
        if (this.locationId) {
            const wmp = WorldMapProgress.load();
            wmp.markCompleted(this.locationId, this.session.score);
        }

        // Game Over overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

        this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
            font: 'bold 48px monospace', fill: '#ff4444',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2, `Final Score: ${this.session.score}`, {
            font: 'bold 28px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 50, `Rounds completed: ${this.session.round - 1}`, {
            font: '20px monospace', fill: '#aaccff'
        }).setOrigin(0.5);

        this._makeBtn(width / 2 - 110, height / 2 + 120, 'PLAY AGAIN', '#113311', '#225522', () => {
            this.audioEngine.dispose();
            this.scene.restart({
                mode: this.mode, subMode: this.subMode, clefSetting: this.clefSetting,
                freePlayPool: this.freePlayPool, playerData: this.initPlayerData,
                scaleDegrees: this.scaleDegrees, patternIds: this.patternIds,
                noteReadingConfig: this.noteReadingConfig, locationId: this.locationId,
                returnScene: this.returnScene, returnData: this.returnData,
            });
        });

        this._makeBtn(width / 2 + 110, height / 2 + 120, 'MENU', '#221111', '#443333', () => {
            this.audioEngine.dispose();
            this._returnToSource();
        });
    }

    // ===================== UI HELPERS =====================

    updateHud() {
        const ratio = Math.max(0, this.session.hp / this.session.maxHp);
        this.hpBar.setScale(ratio, 1);
        this.hpText.setText(`HP: ${Math.ceil(this.session.hp)}/${this.session.maxHp}`);
        this.scoreText.setText(`Score: ${this.session.score}`);
        this.roundText.setText(`Round ${this.session.round}`);
        const s = this.session.streak;
        this.streakText.setText(s >= 2 ? `Streak: ${s}x` : '');

        // HP bar color
        const col = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff4444;
        this.hpBar.setFillStyle(col);
    }

    _showFlash(color) {
        const hex = parseInt(color.replace('#', ''), 16);
        const { width, height } = this.cameras.main;
        const flash = this.add.rectangle(width / 2, height / 2, width, height, hex, 0.2);
        this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    }

    _startTimerBar() {
        const { width } = this.cameras.main;
        this.timerBar.setVisible(true).setSize(width - 80, 5).setPosition(width / 2, 70);
        this.tweens.killTweensOf(this.timerBar);
        this.timerBar.setDisplaySize(width - 80, 5).setFillStyle(0xffcc00);
        this.tweens.add({
            targets: this.timerBar, displayWidth: 0, duration: 8000, ease: 'Linear',
            onUpdate: () => {
                const r = this.timerBar.displayWidth / (width - 80);
                this.timerBar.setFillStyle(r < 0.25 ? 0xff4444 : r < 0.5 ? 0xffaa00 : 0xffcc00);
            },
            onComplete: () => {
                if (this._questionActive) {
                    // Timeout = wrong
                    if (this.mode === 'tones') this._submitTones('__timeout__');
                    else if (this.mode === 'rhythm') this._submitRhythm({ id: -1 });
                    else this._submitNoteReading('__timeout__');
                }
            }
        });
    }

    _makeBtn(x, y, label, bgColor, hoverColor, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 18px monospace',
            fill: '#ffffff',
            backgroundColor: bgColor,
            padding: { x: 18, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverColor }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bgColor }));
        btn.on('pointerdown', cb);
        return btn;
    }

    _showSoundPanel() {
        this._hideSoundPanel();
        this._soundPanelOpen = true;
        const { width, height } = this.cameras.main;

        const panelW = 340, panelH = 258;
        const px = width / 2 - panelW / 2;
        const py = height - 24 - panelH - 14;

        const bg = this.add.rectangle(px + panelW / 2, py + panelH / 2, panelW, panelH, 0x0a0a22, 0.95)
            .setStrokeStyle(1, 0x4455aa);
        this._soundPanelObjs.push(bg);

        const title = this.add.text(px + 14, py + 10, 'SOUND SETTINGS', {
            font: 'bold 13px monospace', fill: '#aabbff'
        });
        this._soundPanelObjs.push(title);

        const hint = this.add.text(px + panelW - 10, py + 10, '✕', {
            font: 'bold 14px monospace', fill: '#666688'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        hint.on('pointerdown', () => this._hideSoundPanel());
        this._soundPanelObjs.push(hint);

        const sep = (y) => {
            const line = this.add.rectangle(px + panelW / 2, y, panelW - 20, 1, 0x333355);
            this._soundPanelObjs.push(line);
        };

        // ── Preset buttons helper ─────────────────────────────
        const makePresetRow = (rowY, labelTxt, presets, getCurrent, setCurrent) => {
            const lbl = this.add.text(px + 14, rowY, labelTxt, { font: '11px monospace', fill: '#778899' });
            this._soundPanelObjs.push(lbl);
            Object.keys(presets).forEach((key, i) => {
                const isCurrent = getCurrent() === key;
                const bx = px + 80 + i * 62;
                const btn = this.add.text(bx, rowY - 2, presets[key].label, {
                    font: 'bold 12px monospace',
                    fill: isCurrent ? '#ffcc00' : '#cccccc',
                    backgroundColor: isCurrent ? '#2a2a00' : '#1a1a2a',
                    padding: { x: 7, y: 4 }, stroke: '#000000', strokeThickness: 1
                }).setInteractive({ useHandCursor: true });
                btn.on('pointerover', () => { if (getCurrent() !== key) btn.setStyle({ backgroundColor: '#22223a' }); });
                btn.on('pointerout',  () => { if (getCurrent() !== key) btn.setStyle({ backgroundColor: '#1a1a2a' }); });
                btn.on('pointerdown', () => { setCurrent(key); this._showSoundPanel(); });
                this._soundPanelObjs.push(btn);
            });
        };

        // ── Level slider helper ───────────────────────────────
        const makeLevel = (rowY, labelTxt, getVal, setVal) => {
            const lbl = this.add.text(px + 14, rowY, labelTxt, { font: '11px monospace', fill: '#778899' });
            this._soundPanelObjs.push(lbl);

            const trackX = px + 80, trackW = 168, trackH = 10, trackCY = rowY + 7;

            // Track background
            const track = this.add.rectangle(trackX + trackW / 2, trackCY, trackW, trackH, 0x1a1a3a)
                .setStrokeStyle(1, 0x334466);
            this._soundPanelObjs.push(track);

            // Fill
            const fillW = Math.round(trackW * getVal());
            const fill = this.add.rectangle(trackX + fillW / 2, trackCY, Math.max(2, fillW), trackH, 0x5577cc);
            this._soundPanelObjs.push(fill);

            // Handle circle
            const handle = this.add.circle(trackX + fillW, trackCY, 7, 0x88aaff)
                .setStrokeStyle(1, 0xffffff);
            this._soundPanelObjs.push(handle);

            // Percent label
            const pct = this.add.text(trackX + trackW + 8, rowY, `${Math.round(getVal() * 100)}%`, {
                font: '11px monospace', fill: '#aaccff'
            });
            this._soundPanelObjs.push(pct);

            // Click on track to set value
            const hitZone = this.add.rectangle(trackX + trackW / 2, trackCY, trackW + 16, 24, 0x000000, 0)
                .setInteractive({ useHandCursor: true, draggable: true });
            this._soundPanelObjs.push(hitZone);

            const applyX = (worldX) => {
                const raw = (worldX - (px + 80)) / trackW;
                setVal(Math.max(0, Math.min(1, raw)));
                this._showSoundPanel();
            };
            hitZone.on('pointerdown', (ptr) => applyX(ptr.worldX));
            hitZone.on('pointermove', (ptr) => { if (ptr.isDown) applyX(ptr.worldX); });
        };

        // ── Layout ────────────────────────────────────────────
        sep(py + 26);

        makePresetRow(py + 34, 'DRONE:', DRONE_PRESETS,
            () => this.audioEngine.getDronePreset(),
            (k) => this.audioEngine.setDronePreset(k));

        sep(py + 62);

        makeLevel(py + 70, 'DRONE LVL:',
            () => this.audioEngine.getDroneLevel(),
            (v) => this.audioEngine.setDroneLevel(v));

        sep(py + 94);

        makePresetRow(py + 102, 'NOTE:', INTERVAL_PRESETS,
            () => this.audioEngine.getIntervalPreset(),
            (k) => this.audioEngine.setIntervalPreset(k));

        sep(py + 130);

        makeLevel(py + 138, 'NOTE LVL:',
            () => this.audioEngine.getIntervalLevel(),
            (v) => this.audioEngine.setIntervalLevel(v));

        sep(py + 162);

        // Reverb row
        const revLabel = this.add.text(px + 14, py + 170, 'REVERB:', {
            font: '11px monospace', fill: '#778899'
        });
        this._soundPanelObjs.push(revLabel);

        const wetVal = this.audioEngine.hallReverb ? this.audioEngine.hallReverb.wet.value : 0.90;
        const wetLevels = [0, 0.35, 0.65, 0.90];
        const wetLabels = ['Dry', 'Room', 'Hall', 'Cave'];
        wetLabels.forEach((lbl, i) => {
            const isCurrent = Math.abs(wetVal - wetLevels[i]) < 0.05;
            const bx = px + 80 + i * 62;
            const btn = this.add.text(bx, py + 168, lbl, {
                font: 'bold 12px monospace',
                fill: isCurrent ? '#ffcc00' : '#cccccc',
                backgroundColor: isCurrent ? '#2a2a00' : '#1a1a2a',
                padding: { x: 7, y: 4 }, stroke: '#000000', strokeThickness: 1
            }).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                if (this.audioEngine.hallReverb) this.audioEngine.hallReverb.wet.value = wetLevels[i];
                this._showSoundPanel();
            });
            this._soundPanelObjs.push(btn);
        });

        sep(py + 202);

        // Master volume
        makeLevel(py + 210, 'MASTER:',
            () => Tone.Destination.volume.value === -Infinity ? 0 : Math.pow(10, Tone.Destination.volume.value / 20),
            (v) => { Tone.Destination.volume.value = v < 0.01 ? -Infinity : 20 * Math.log10(v); });

        sep(py + 242);
    }

    _hideSoundPanel() {
        this._soundPanelObjs.forEach(o => o.destroy());
        this._soundPanelObjs = [];
        this._soundPanelOpen = false;
    }

    _returnToSource() {
        if (this.returnScene === 'RegionMapScene' && this.returnData) {
            this.scene.start('RegionMapScene', this.returnData);
        } else {
            this.scene.start('ArcadeMenuScene', { playerData: this.initPlayerData });
        }
    }

    wait(ms) {
        return new Promise(resolve => this.time.delayedCall(ms, resolve));
    }
}
