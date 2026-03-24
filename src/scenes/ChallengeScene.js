// ChallengeScene: Unified cozy village challenge scene.
// Villagers approach with a timer; answer correctly to help them!
// Supports tones, note reading, rhythm, and rhythm reading modes.

import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';
import { AudioEngine, DRONE_PRESETS, INTERVAL_PRESETS } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { spellPattern, splitRestsAtCursor } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';
import { ZONES } from '../data/zones.js';
import { MidiInput } from '../systems/MidiInput.js';
import { RhythmKeyboardInput } from '../systems/RhythmKeyboardInput.js';
import { VILLAGERS } from '../data/villagers.js';

// Difficulty tiers for tone challenges
export const TONES_TIERS = [
    { minRound: 1,  degrees: ['1', '3', '5'] },
    { minRound: 6,  degrees: ['1', '2', '3', '4', '5'] },
    { minRound: 11, degrees: ['1', '2', 'b3', '3', '4', '5', 'b7'] },
    { minRound: 16, degrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'] },
    { minRound: 21, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7'] },
    { minRound: 26, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] },
];

// Challenge types for 'all' mode
export const ALL_CHALLENGE_TYPES = ['tone', 'noteReading', 'rhythm', 'rhythmReading'];

// Rhythm constants
export const RHYTHM_BPM = 100;
export const RHYTHM_SUBDIVISIONS = {
    quarter:   { cells: ['1', '2', '3', '4'], downbeats: [0, 1, 2, 3], cellFraction: 1 },
    eighth:    { cells: ['1', '+', '2', '+', '3', '+', '4', '+'], downbeats: [0, 2, 4, 6], cellFraction: 0.5 },
    sixteenth: { cells: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'], downbeats: [0, 4, 8, 12], cellFraction: 0.25 },
    triplet:   { cells: ['1','p','l','2','p','l','3','p','l','4','p','l'], downbeats: [0, 3, 6, 9], cellFraction: 1/3 },
};

export const GROUND_Y = 480;
export const PLAYER_X = 120;

export const PRACTICE_TIPS = {
    tone: [
        'Listen to the drone — that\'s Do (1).',
        'Sing the note in your head before clicking!',
        'Mi (3) is 2 whole steps above Do.',
        'Sol (5) sounds stable and grounded.',
        'Ra (b2) is just a half step above Do.',
        'La (6) — think "la-la-la" going up!',
        'Ti (7) really wants to resolve up to Do.',
        'Fi (#4) is the tritone — very tense sound!',
        'Te (b7) is common in blues and folk songs.',
        'Me (b3) gives a darker, minor feel.',
    ],
    noteReading: [
        'Treble clef lines: Every Good Boy Does Fine.',
        'Treble clef spaces spell F-A-C-E from bottom.',
        'Bass clef lines: Good Boys Do Fine Always.',
        'Bass clef spaces: All Cows Eat Grass.',
        'Ledger lines extend the staff up or down.',
        'Middle C sits on a ledger line below treble.',
        'Sharps (#) raise a note by a half step.',
        'Flats (b) lower a note by a half step.',
        'Notes on lines: the line pokes through them.',
        'Higher on the staff = higher in pitch.',
    ],
    rhythm: [
        'Count out loud: 1 e + a 2 e + a...',
        'Quarter note = 1 beat. Half note = 2 beats.',
        'Eighth notes divide each beat into 2.',
        '16th notes divide each beat into 4.',
        'Triplets split each beat into 3 equal parts.',
        'The "+" is the "and" — the halfway point.',
        'Tap your foot on every beat to stay steady.',
        'A dot after a note adds half its value.',
        'A rest means silence — count it too!',
        'Try singing the rhythm before you enter it.',
    ],
};

const VILLAGER_POOL_REGULAR = Object.keys(VILLAGERS).filter(k => !VILLAGERS[k].isSpecial);
const VILLAGER_POOL_SPECIAL = Object.keys(VILLAGERS).filter(k => VILLAGERS[k].isSpecial);

const COZY_PALETTES = [
    { name: 'meadow',  sky: [0x87ceeb, 0xc8e6c9], ground: 0x4a8c3f, accent: 0xffeb3b, flowers: [0xff99cc, 0xffdd55, 0xcc77ff] },
    { name: 'sunset',  sky: [0xffb74d, 0xff8a65], ground: 0x5a7a3a, accent: 0xff7043, flowers: [0xffab91, 0xfff176, 0xffcc80] },
    { name: 'garden',  sky: [0xa5d6a7, 0x81c784], ground: 0x388e3c, accent: 0xe91e63, flowers: [0xf48fb1, 0xce93d8, 0x80cbc4] },
    { name: 'twilight',sky: [0x7986cb, 0x5c6bc0], ground: 0x3a6a3a, accent: 0xffd54f, flowers: [0xb39ddb, 0x90caf9, 0xfff59d] },
    { name: 'morning', sky: [0xfff9c4, 0xffe0b2], ground: 0x66bb6a, accent: 0x26a69a, flowers: [0xffcc80, 0xa5d6a7, 0x80deea] },
    { name: 'moonlit', sky: [0x37474f, 0x263238], ground: 0x2e5a2e, accent: 0xb0bec5, flowers: [0x90a4ae, 0x80cbc4, 0xb39ddb] },
];

const PRACTICE_NPCS_COZY = {
    tone:        { key: 'villager-robin',    anim: 'robin-idle',    scale: 3.5, name: 'Robin',   h: 16, flip: true  },
    noteReading: { key: 'villager-squirrel', anim: 'squirrel-idle', scale: 3.5, name: 'Clover',  h: 19, flip: false },
    rhythm:      { key: 'villager-bunny',    anim: 'bunny-idle',    scale: 3.5, name: 'Melody',  h: 17, flip: true  },
    default:     { key: 'villager-chicken',  anim: 'chicken-idle',  scale: 3.5, name: 'Pippin',  h: 16, flip: true  },
};

export class ChallengeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ChallengeScene' });
    }

    // ===================== INIT =====================

    init(data) {
        this.mode = data.mode || 'all';
        this.playerData = data.playerData || { hp: 100, maxHp: 100, attack: 30, defense: 5, level: 1 };
        this.clefSetting = data.clefSetting || 'treble';
        this.returnScene = data.returnScene || 'PracticeMenuScene';
        this.returnData = data.returnData || null;

        this.storyBattle = data.storyBattle || false;
        this.entityKey = data.monsterKey || null;
        this.progression = data.progression || null;
        this.encounterIndex = data.encounterIndex;
        this.playerPos = data.playerPos;
        this.isSidescrollMode = data.isSidescrollMode || data.isOverworldMode || false;
        this.isOverworldMode = data.isOverworldMode || false;
        this.playerStats = { ...this.playerData };

        const s = data.settings || {};
        this.gradual = s.gradual !== false;
        this.customDegrees = Array.isArray(s.tones) && s.tones.length > 0 ? s.tones : null;
        this.customNoteRanges = Array.isArray(s.noteRanges) ? s.noteRanges : ['onStaff'];
        this.customRhythmSubs = Array.isArray(s.rhythmSubs) && s.rhythmSubs.length > 0 ? s.rhythmSubs : ['quarter'];
        this.tonesKey     = s.tonesKey  || 'random';
        this.showGrid     = s.showGrid  !== false;
        this.practiceMode = s.practice  === true;
        this.soundSettings = s.sounds || null;
        this.tapLatencyMs = s.tapLatencyMs || 0;

        // Theme-specific state
        this.villagerKey = data.monsterKey || null;
        this._rescuedList = [];
        this._rescuedIcons = [];
        this._escapeTimer = null;
    }

    // ===================== CREATE =====================

    async create() {
        const { width, height } = this.cameras.main;

        // Session state
        this.session = { score: 0, round: 0, streak: 0, entitiesDefeated: 0 };
        this._questionActive = false;
        this._gameOverFlag = false;
        this._entityApproaching = false;

        // 'all' mode tracking
        this._allModeType = null;
        this._allModeQuestionsLeft = 0;

        // Tones drone tracking
        this._droneActive = false;
        this._droneQuestionsLeft = 0;

        // Systems
        this.musicTheory = new MusicTheory();
        this.audioEngine = new AudioEngine();
        this.noteReadingEngine = new NoteReadingEngine();
        this.staffRenderer = new VexFlowStaffRenderer(this);
        this._staffVisible = false;

        const charKey = this.playerData.characterKey || 'char1';
        this._charKey = charKey;

        // Background
        this._drawCozyBackground(width, height);
        this._createPlayerSprite(charKey, width, height);

        // --- HUD ---
        this.scoreText = this.add.text(20, 8, 'Score: 0', {
            font: 'bold 16px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 3
        }).setDepth(10);
        this.roundText = this.add.text(width - 20, 8, 'Round 1', {
            font: '14px monospace', fill: '#eedd88',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setDepth(10);
        this.entityCountText = this.add.text(width / 2, 8, '', {
            font: '14px monospace', fill: '#88ff88',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10);
        this.streakText = this.add.text(20, 60, '', {
            font: '13px monospace', fill: '#ffaaaa',
            stroke: '#000000', strokeThickness: 2
        }).setDepth(10);

        // Mode label
        const modeLabels = { tones: 'TONES', noteReading: 'NOTE READING', rhythm: 'RHYTHM EAR TRAINING', rhythmReading: 'RHYTHM READING', all: 'ALL' };
        this.add.text(width / 2, height - 12, modeLabels[this.mode] || 'CHALLENGE', {
            font: '11px monospace', fill: '#556677',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(10);

        // Message area
        this.messageText = this.add.text(width / 2, GROUND_Y - 30, '', {
            font: 'bold 16px monospace', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5, 1).setDepth(10);

        // Drone text
        this.droneText = this.add.text(width / 2, 60, '', {
            font: 'bold 38px monospace', fill: '#aaccff',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setVisible(false).setDepth(4);

        // Danger/sadness overlay
        this.dangerOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x4488cc, 0)
            .setDepth(50);

        // UI containers
        this.solfegeButtons = [];
        this.pianoKeys = [];
        this.rhythmUI = [];

        // Rhythm notation renderer
        this.rhythmNotationRenderer = new RhythmNotationRenderer(this);

        // Drag-to-sustain listeners for rhythm mode
        this._rhythmDragging = false;
        this.input.on('pointermove', (ptr) => this._onRhythmDragMove(ptr));
        this.input.on('pointerup', () => this._onRhythmDragEnd());

        // Quit button
        this._makeBtn(50, height - 24, 'QUIT', '#221111', '#443333', () => {
            this.audioEngine.dispose();
            this._returnToSource();
        }).setDepth(10);

        // Settings gear button
        this._makeBtn(width - 50, height - 24, '⚙', '#112233', '#223344', () => {
            this._openSettings();
        }).setDepth(10);

        // Cleanup
        this.events.on('shutdown', () => {
            this.audioEngine.dispose();
            this.staffRenderer.clear();
            this.rhythmNotationRenderer.clear();
            if (this.midiInput) this.midiInput.dispose();
            this._clearNpc();
        });

        // Init audio + apply sound presets
        try { await this.audioEngine.init(); } catch (e) { /* continue silently */ }
        if (this.soundSettings) {
            if (this.soundSettings.drone)      this.audioEngine.setDronePreset(this.soundSettings.drone);
            if (this.soundSettings.interval)   this.audioEngine.setIntervalPreset(this.soundSettings.interval);
            if (this.soundSettings.click)      this.audioEngine.setClickPreset(this.soundSettings.click);
            if (this.soundSettings.rhythmNote) this.audioEngine.setRhythmNotePreset(this.soundSettings.rhythmNote);
            const v = this.soundSettings.volumes || {};
            if (v.drone      != null) this.audioEngine.setDroneLevel(v.drone);
            if (v.interval   != null) this.audioEngine.setIntervalLevel(v.interval);
            if (v.click      != null) this.audioEngine.setClickLevel(v.click);
            if (v.rhythmNote != null) this.audioEngine.setRhythmNoteLevel(v.rhythmNote);
        }

        // Init MIDI input
        this.midiInput = new MidiInput();
        try { await this.midiInput.init(); } catch (e) { /* continue silently */ }
        if (this.midiInput.available) {
            this.midiInput.onNoteOn((midiNote) => this._handleMidiNote(midiNote));
        }

        // ESC opens settings overlay
        this.input.keyboard.on('keydown-ESC', () => this._openSettings());

        // Re-apply sounds when returning from SettingsScene
        this.events.on('resume', () => {
            const saved = (new ProgressionManager()).loadArcadeSettings() || {};
            const s = saved.sounds || {};
            if (s.drone)      this.audioEngine.setDronePreset(s.drone);
            if (s.interval)   this.audioEngine.setIntervalPreset(s.interval);
            if (s.click)      this.audioEngine.setClickPreset(s.click);
            if (s.rhythmNote) this.audioEngine.setRhythmNotePreset(s.rhythmNote);
            const v = s.volumes || {};
            if (v.drone      != null) this.audioEngine.setDroneLevel(v.drone);
            if (v.interval   != null) this.audioEngine.setIntervalLevel(v.interval);
            if (v.click      != null) this.audioEngine.setClickLevel(v.click);
            if (v.rhythmNote != null) this.audioEngine.setRhythmNoteLevel(v.rhythmNote);
        });

        // Start first entity
        this._spawnNextEntity();
    }

    _openSettings() {
        this.staffRenderer.clear();
        this.rhythmNotationRenderer.clear();
        this.scene.launch('SettingsScene', { callerKey: 'ChallengeScene', pauseCaller: true });
        this.scene.pause();
    }

    // ===================== THEME CONFIG =====================

    _victoryConfig() {
        return {
            title: 'WONDERFUL!',
            rewardLabel: (xp, gold) => `+${xp} Friendship   +${gold} Gratitude`,
            xpField: 'friendship', goldField: 'gratitude',
            playerLabel: (stats) => `Lv.${stats.level}  Energy ${stats.hp}/${stats.maxHp}`,
        };
    }

    _defeatConfig() {
        return {
            title: 'OUT OF ENERGY!', titleColor: '#4488cc',
            message: 'Energy restored to 50%', messageColor: '#aaccdd',
            bg: 0x001122, stroke: 0x4488cc,
            btnBg: '#112233', btnHover: '#223344',
        };
    }

    _gameOverConfig() {
        return {
            title: 'OUT OF ENERGY!', titleColor: '#4488cc',
            entityLabel: 'Villagers Helped',
        };
    }

    _getEntityZone() {
        return this._entityData?.zone;
    }

    _getEntityChallengeType() {
        return this._entityData?.needsHelpWith || this._entityData?.enemyType || 'mixed';
    }

    // ===================== BACKGROUND =====================

    _drawCozyBackground(width, height) {
        const pal = COZY_PALETTES[(this.session?.round || 0) % COZY_PALETTES.length];
        const g = this.add.graphics().setDepth(0);

        const bands = 10;
        const bandH = GROUND_Y / bands;
        for (let i = 0; i < bands; i++) {
            const t = i / (bands - 1);
            const r = ((pal.sky[0] >> 16) & 0xff) + t * ((((pal.sky[1] >> 16) & 0xff) - ((pal.sky[0] >> 16) & 0xff)));
            const gr = ((pal.sky[0] >> 8) & 0xff) + t * ((((pal.sky[1] >> 8) & 0xff) - ((pal.sky[0] >> 8) & 0xff)));
            const b = (pal.sky[0] & 0xff) + t * (((pal.sky[1] & 0xff) - (pal.sky[0] & 0xff)));
            g.fillStyle((Math.round(r) << 16) | (Math.round(gr) << 8) | Math.round(b));
            g.fillRect(0, i * bandH, width, bandH + 1);
        }

        g.fillStyle(pal.ground);
        g.fillRect(0, GROUND_Y, width, height - GROUND_Y);
        g.fillStyle(pal.ground, 0.5);
        g.fillRect(0, GROUND_Y - 4, width, 8);

        g.fillStyle(pal.ground, 0.25);
        for (let x = 0; x < width; x += 3) {
            const h = 20 + Math.sin(x * 0.012) * 12 + Math.sin(x * 0.03) * 6;
            g.fillRect(x, GROUND_Y - h, 3, h);
        }

        g.fillStyle(0x2e7d32, 0.4);
        for (let i = 0; i < 18; i++) {
            const gx = 40 + i * 44 + ((i * 17) % 20);
            const gy = GROUND_Y + 8 + (i % 3) * 15;
            g.fillRect(gx, gy, 2, 6);
            g.fillRect(gx + 3, gy - 2, 2, 8);
            g.fillRect(gx + 6, gy + 1, 2, 5);
        }

        pal.flowers.forEach((color, fi) => {
            for (let i = 0; i < 5; i++) {
                const fx = 30 + fi * 230 + i * 48 + ((fi + i) * 37) % 60;
                const fy = GROUND_Y + 10 + ((fi + i) * 13) % 30;
                g.fillStyle(color, 0.7);
                g.fillCircle(fx, fy, 3);
                g.fillStyle(pal.accent, 0.6);
                g.fillCircle(fx, fy, 1.5);
            }
        });

        g.fillStyle(0xffffff, 0.15);
        [[120, 60], [340, 40], [560, 70], [700, 35]].forEach(([cx, cy]) => {
            g.fillEllipse(cx, cy, 60, 20);
            g.fillEllipse(cx + 20, cy - 8, 40, 16);
        });

        const treeColor = (pal.ground & 0xfefefe) >> 1;
        [[50, 0.6], [180, 0.8], [680, 0.7], [760, 0.5]].forEach(([tx, ts]) => {
            const th = 50 * ts;
            const ty = GROUND_Y;
            g.fillStyle(0x4a3520, 0.4);
            g.fillRect(tx - 2, ty - th * 0.4, 4, th * 0.4);
            g.fillStyle(treeColor, 0.35);
            g.fillCircle(tx, ty - th * 0.55, 16 * ts);
            g.fillCircle(tx - 8 * ts, ty - th * 0.65, 12 * ts);
            g.fillCircle(tx + 8 * ts, ty - th * 0.65, 12 * ts);
        });

        const hexStr = '#' + pal.sky[0].toString(16).padStart(6, '0');
        this.cameras.main.setBackgroundColor(hexStr);
    }

    // ===================== PLAYER SPRITE =====================

    _createPlayerSprite(charKey, width, height) {
        this.playerSprite = this.add.sprite(PLAYER_X, GROUND_Y, `player-${charKey}`, 0);
        this.playerSprite.setOrigin(0.5, 1);
        this.playerSprite.setScale(2.5 * (this.playerData.characterScale || 1.0));
        this.playerSprite.setFlipX(this.playerData.characterFlip || false);
        if (this.anims.exists(`${charKey}-idle`)) this.playerSprite.play(`${charKey}-idle`);
        this.playerSprite.setDepth(2);
    }

    // ===================== ENTITY SPAWNING =====================

    _spawnNextEntity() {
        if (this._gameOverFlag) return;

        if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }

        if (this.storyBattle && this.session.round > 0 && this._storyEntityDone) return;

        this.session.round++;
        this._updateHud();

        let villagerKey, isSpecial;
        if (this.storyBattle && this.villagerKey) {
            villagerKey = this.villagerKey;
            isSpecial = VILLAGERS[villagerKey]?.isSpecial || VILLAGERS[villagerKey]?.isBoss || false;
        } else {
            isSpecial = this.session.round % 10 === 0 && this.session.round > 0;
            const pool = isSpecial ? VILLAGER_POOL_SPECIAL : VILLAGER_POOL_REGULAR;
            villagerKey = pool[Math.floor(Math.random() * pool.length)];
        }
        const data = VILLAGERS[villagerKey];

        const spawnX = this.cameras.main.width - 150;
        const spriteKey = data.spriteKey || `villager-${villagerKey}`;
        const targetH = (isSpecial && this.storyBattle) ? 120 : 80;
        const frameH = data.frameHeight || 17;
        const scale = targetH / frameH;

        if (this.textures.exists(spriteKey)) {
            this._entitySprite = this.add.sprite(spawnX, GROUND_Y, spriteKey);
            this._entitySprite.setOrigin(0.5, 1);
            this._entitySprite.setScale(scale);
            this._entitySprite.setDepth(2);

            const animKey = `villager-${villagerKey}-idle`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: (data.frameCount || 4) - 1 }),
                    frameRate: 6, repeat: -1
                });
            }
            this._entitySprite.play(animKey);
            this._entitySprite.setFlipX(data.facesRight !== false);
        } else {
            this._entitySprite = this.add.circle(spawnX, GROUND_Y - 40, isSpecial ? 40 : 28,
                isSpecial ? 0xffaa44 : 0x88cc66);
            this._entitySprite.setDepth(2);
        }

        this._entityKey = villagerKey;
        this._entityData = data;
        this._isSpecialRound = isSpecial;

        this._entityMeter = 0;
        this._entityAttack = data.patience || data.attack || 8;
        this._entityDefense = data.shyness || data.defense || 2;
        this._storyEntityDone = false;
        this._buildHpBars();

        this._challengeType = this._pickChallengeType();
        this.messageText.setText(`${data.name} needs your help!`);

        this._cancelEscapeTimer();
        if (!this.practiceMode) {
            const escapeMs = Math.max(8000, 15000 - (this.session.round - 1) * 300);
            this._escapeTimer = this.time.delayedCall(escapeMs, () => {
                if (!this._gameOverFlag) this._triggerEscape();
            });
        }

        const startDelay = this.practiceMode ? 400 : 800;
        this.time.delayedCall(startDelay, () => {
            if (this._gameOverFlag) return;
            this._askQuestion();
        });
    }

    _cancelEscapeTimer() {
        if (this._escapeTimer) {
            this._escapeTimer.remove(false);
            this._escapeTimer = null;
        }
    }

    _resetEscapeTimer() {
        this._cancelEscapeTimer();
        if (!this.practiceMode && !this._gameOverFlag) {
            const escapeMs = Math.max(8000, 15000 - (this.session.round - 1) * 300);
            this._escapeTimer = this.time.delayedCall(escapeMs, () => {
                if (!this._gameOverFlag) this._triggerEscape();
            });
        }
    }

    _triggerEscape() {
        this._cancelEscapeTimer();
        this._questionActive = false;
        const { width } = this.cameras.main;
        if (this._entitySprite && this._entitySprite.active) {
            this.tweens.add({
                targets: this._entitySprite,
                x: width + 150,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }
                    this._animalGotAway();
                }
            });
        } else {
            this._animalGotAway();
        }
    }

    _animalGotAway() {
        if (this._gameOverFlag) return;
        this._cancelEscapeTimer();

        const { width } = this.cameras.main;
        const txt = this.add.text(width / 2, GROUND_Y - 60, 'Got away!', {
            font: 'bold 24px monospace', fill: '#ffaa44',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(12);
        this.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 1200, onComplete: () => txt.destroy() });

        const dmg = Math.max(2, Math.floor(this._entityAttack * 0.5));
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
        this._showDamageNumber(width / 2, GROUND_Y - 100, 0, '#ff8844', `-${dmg} energy`);
        this._updateHpBars();

        if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }

        if (this.playerStats.hp <= 0) {
            this._gameOverFlag = true;
            this._clearAllUI();
            this.time.delayedCall(600, () => this._gameOver());
            return;
        }

        this.time.delayedCall(800, () => this._spawnNextEntity());
    }

    update(time, delta) {
        // Escape is timer-based, no continuous movement
    }

    // ===================== CORRECT/WRONG HANDLERS =====================

    _onCorrectHit() {
        this._helpVillager();
    }

    _helpVillager() {
        const isRhythm = this._challengeType === 'rhythm' || this._challengeType === 'rhythmReading';
        const happinessGain = isRhythm ? (100 - (this._entityMeter || 0)) : (25 + Math.floor(Math.random() * 20));
        this._entityMeter = Math.min(100, (this._entityMeter || 0) + happinessGain);
        this._updateHpBars();

        if (this.isSidescrollMode) {
            const ax = this._entitySprite?.x || (this.cameras.main.width - 150);
            this._showDamageNumber(ax, GROUND_Y - 80, 0, '#ffcc44', `+${happinessGain}% ♥`);
            if (this._entityMeter >= 100) {
                this._storyEntityDone = true;
                this._showDamageNumber(ax, GROUND_Y - 120, 0, '#ffdd44', '\u2728 HAPPY!');
                this._addToRescuedPreview(this._entityData?.spriteKey || `villager-${this._entityKey}`, this._entityData?.name || 'Friend');
                this.time.delayedCall(600, () => this._returnPlayerThenVictory());
            } else {
                this.time.delayedCall(400, () => {
                    this._challengeType = this._pickChallengeType();
                    this._askQuestion();
                });
            }
            return;
        }

        const sp = this._entitySprite;
        if (sp) {
            const animalX = sp.x;
            this._showHitEffect(animalX, GROUND_Y - 40);
            this._showDamageNumber(animalX, GROUND_Y - 80, 0, '#ffcc44', `+${happinessGain}% ♥`);

            this.tweens.add({
                targets: sp,
                y: sp.y - 18,
                duration: 150, yoyo: true, ease: 'Power2',
                onComplete: () => {
                    if (sp.active) sp.setTint(0xffdd44);
                    this.time.delayedCall(200, () => { if (sp.active) sp.clearTint(); });
                }
            });

            if (this._entityMeter >= 100) {
                this._storyEntityDone = true;
                this._showDamageNumber(animalX, GROUND_Y - 110, 0, '#ffdd44', '\u2728 HAPPY!');
                const vData = this._entityData;
                this._addToRescuedPreview(vData.spriteKey || `villager-${this._entityKey}`, vData.name);
                this.time.delayedCall(500, () => this._animalFlyOff('happy'));
                return;
            }
        } else if (this._entityMeter >= 100) {
            this._storyEntityDone = true;
            const vData = this._entityData;
            if (vData) this._addToRescuedPreview(vData.spriteKey || `villager-${this._entityKey}`, vData.name);
            this.time.delayedCall(500, () => this._animalFlyOff('happy'));
            return;
        }

        this.time.delayedCall(500, () => {
            if (!this._gameOverFlag) {
                this._entityApproaching = true;
                this._challengeType = this._pickChallengeType();
                this.time.delayedCall(300, () => this._askQuestion());
            }
        });
    }

    _onWrongEffect() {
        if (this.isSidescrollMode || this.practiceMode) {
            this._challengeType = this._pickChallengeType();
            this.time.delayedCall(500, () => this._askQuestion());
            return;
        }

        if (!this._entitySprite) return;

        this.tweens.add({
            targets: this._entitySprite,
            x: Math.min(this._entitySprite.x + 40, this.cameras.main.width - 40),
            duration: 200, ease: 'Power2',
            onComplete: () => {
                this._challengeType = this._pickChallengeType();
                this.time.delayedCall(500, () => this._askQuestion());
            }
        });
    }

    _showWrongDamage(dmg) {
        const dmgX = this.isSidescrollMode ? 120 : (this.playerSprite?.x || 120);
        const dmgY = this.isSidescrollMode ? 70  : ((this.playerSprite?.y || 80) - 80);
        this._showDamageNumber(dmgX, dmgY, 0, '#ff5544', `-${dmg} energy`);
    }

    _onStoryPlayerDefeated() {
        this.time.delayedCall(600, () => this._animalFlyOff('sad'));
    }

    // ===================== ANIMAL FLY OFF =====================

    _animalFlyOff(reason) {
        this._cancelEscapeTimer();
        if (!this._entitySprite) {
            this._onAnimalFlyOffComplete(reason);
            return;
        }
        const { width } = this.cameras.main;
        const sp = this._entitySprite;

        if (reason === 'happy') {
            this.tweens.add({
                targets: sp,
                x: PLAYER_X, y: GROUND_Y - 80,
                scaleX: 0.3, scaleY: 0.3,
                duration: 600, ease: 'Cubic.easeIn',
                onComplete: () => {
                    sp.destroy();
                    this._entitySprite = null;
                    this._showDamageNumber(PLAYER_X, GROUND_Y - 120, 0, '#ff88cc', '♥');
                    this._onAnimalFlyOffComplete(reason);
                }
            });
        } else {
            this.tweens.add({
                targets: sp,
                x: width + 160, y: sp.y,
                scaleX: 0.05, scaleY: 0.05, alpha: 0,
                duration: 400, ease: 'Power3',
                onComplete: () => {
                    sp.destroy();
                    this._entitySprite = null;
                    this._onAnimalFlyOffComplete(reason);
                }
            });
        }
    }

    _onAnimalFlyOffComplete(reason) {
        if (reason === 'happy') {
            if (this.storyBattle) {
                this.time.delayedCall(300, () => this._storyVictory());
            } else {
                this._returnPlayerThenSpawn();
            }
        } else {
            this.time.delayedCall(300, () => this._storyDefeat());
        }
    }

    _returnPlayerThenSpawn() {
        this.session.entitiesDefeated++;
        this._updateHud();
        this.time.delayedCall(600, () => this._spawnNextEntity());
    }

    _returnPlayerThenVictory() {
        this.time.delayedCall(400, () => this._storyVictory());
    }

    // ===================== HIT EFFECT (hearts) =====================

    _showHitEffect(x, y) {
        const heartCount = 3;
        for (let i = 0; i < heartCount; i++) {
            const hx = x + (Math.random() - 0.5) * 40;
            const hy = y + (Math.random() - 0.5) * 20;

            let heart;
            if (this.textures.exists('heart')) {
                heart = this.add.image(hx, hy, 'heart').setScale(0.5).setDepth(10);
            } else {
                heart = this.add.text(hx, hy, '\u2764', {
                    font: 'bold 20px sans-serif', fill: '#ff6688'
                }).setOrigin(0.5).setDepth(10);
            }

            this.tweens.add({
                targets: heart,
                y: hy - 60 - Math.random() * 30,
                alpha: 0,
                scaleX: (heart.scaleX || 1) * 1.3,
                scaleY: (heart.scaleY || 1) * 1.3,
                duration: 700 + Math.random() * 300,
                delay: i * 100,
                ease: 'Power2',
                onComplete: () => heart.destroy()
            });
        }
    }

    // ===================== RESCUED PREVIEW =====================

    _addToRescuedPreview(spriteKey, name) {
        const { width, height } = this.cameras.main;
        this._rescuedList.push({ spriteKey, name });

        this._rescuedIcons.forEach(o => o.destroy());
        this._rescuedIcons = [];

        const show = this._rescuedList.slice(-5);
        const slotW = 38;
        const baseX = width - 12;
        const baseY = height - 38;

        const panelW = show.length * slotW + 10;
        const panelBg = this.add.rectangle(baseX - panelW / 2, baseY, panelW, 36, 0x000000, 0.45)
            .setOrigin(0.5).setDepth(9);
        this._rescuedIcons.push(panelBg);

        show.forEach((entry, i) => {
            const sx = baseX - (show.length - 1 - i) * slotW - slotW / 2;
            if (this.textures.exists(entry.spriteKey)) {
                const icon = this.add.sprite(sx, baseY, entry.spriteKey, 0)
                    .setScale(1.8).setDepth(10);
                this._rescuedIcons.push(icon);

                if (i === show.length - 1) {
                    icon.setScale(0);
                    this.tweens.add({ targets: icon, scaleX: 1.8, scaleY: 1.8, duration: 300, ease: 'Back.easeOut' });
                }
            }
        });

        const lbl = this.add.text(baseX - panelW + 4, baseY - 18, `Rescued: ${this._rescuedList.length}`, {
            font: '10px monospace', fill: '#aaffaa', stroke: '#000', strokeThickness: 2
        }).setDepth(10);
        this._rescuedIcons.push(lbl);
    }

    // ===================== HP BARS =====================

    _buildHpBars() {
        if (this._hpBarObjs) this._hpBarObjs.forEach(o => o.destroy());
        this._hpBarObjs = [];
        const { width } = this.cameras.main;

        const pBg = this.add.rectangle(110, 34, 160, 14, 0x1a2a1a).setStrokeStyle(1, 0x336633).setDepth(10);
        this._playerHpBar = this.add.rectangle(110, 34, 160, 14, 0x44ee66).setDepth(10);
        const pLabel = this.add.text(16, 27, '⚡', { font: '13px monospace', fill: '#88ffaa' }).setDepth(10);
        this._playerHpText = this.add.text(110, 34, `${this.playerStats.hp}/${this.playerStats.maxHp}`, {
            font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(11);
        this._hpBarObjs.push(pBg, this._playerHpBar, pLabel, this._playerHpText);

        if (this.practiceMode) {
            const badge = this.add.text(width - 20, 38, 'PRACTICE', {
                font: 'bold 13px monospace', fill: '#eedd88',
                backgroundColor: '#2a2418', padding: { x: 8, y: 4 },
                stroke: '#000', strokeThickness: 2
            }).setOrigin(1, 0.5).setDepth(10);
            this._hpBarObjs.push(badge);
        } else {
            const mBg = this.add.rectangle(width - 110, 34, 160, 14, 0x221a00).setStrokeStyle(1, 0x886622).setDepth(10);
            this._entityHelpBar = this.add.rectangle(width - 110, 34, 160, 14, 0xffcc44).setDepth(10);
            this._entityHelpBar.setScale(0, 1);
            const mLabel = this.add.text(width - 190, 27, this._entityData.name, {
                font: '10px monospace', fill: '#ffaa88'
            }).setDepth(10);
            const heartLabel = this.add.text(width - 24, 27, '♥', { font: '11px monospace', fill: '#ffcc44' }).setDepth(10);
            this._entityHelpText = this.add.text(width - 110, 34, '0%', {
                font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(11);
            this._hpBarObjs.push(mBg, this._entityHelpBar, mLabel, heartLabel, this._entityHelpText);
        }
    }

    _updateHpBars() {
        if (this._playerHpBar) {
            const pRatio = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
            this._playerHpBar.setScale(pRatio, 1);
            const col = pRatio > 0.5 ? 0x44ee66 : pRatio > 0.25 ? 0xffcc44 : 0xff5544;
            this._playerHpBar.setFillStyle(col);
            this._playerHpText.setText(`${this.playerStats.hp}/${this.playerStats.maxHp}`);
        }
        if (this._entityHelpBar) {
            const mRatio = Math.min(1, Math.max(0, (this._entityMeter || 0) / 100));
            this._entityHelpBar.setScale(mRatio, 1);
            this._entityHelpText.setText(`${Math.round(this._entityMeter || 0)}%`);
        }
    }

    _updateHud() {
        this.scoreText.setText(`Score: ${this.session.score}`);
        this.roundText.setText(`Round ${this.session.round}`);
        this.streakText.setText(this.session.streak >= 2 ? `Streak: ${this.session.streak}x` : '');
        this.entityCountText.setText(`Helped: ${this.session.entitiesDefeated}`);
    }

    // ===================== CLEAR ALL =====================

    _clearAllUI() {
        this._clearSolfegeButtons();
        this._clearPianoKeys();
        this._clearRhythmUI();
        this._clearNpc();
        if (this._rescuedIcons) {
            this._rescuedIcons.forEach(o => o.destroy());
            this._rescuedIcons = [];
        }
    }

    // ===================== CHALLENGE TYPE SELECTION =====================

    _pickChallengeType() {
        if (this.storyBattle && this._entityData) {
            const et = this._getEntityChallengeType();
            if (et === 'tone') return 'tone';
            if (et === 'noteReading') return 'noteReading';
            if (et === 'rhythm') return 'rhythm';
            const choices = ALL_CHALLENGE_TYPES.filter(t => t !== this._allModeType);
            this._allModeType = choices[Math.floor(Math.random() * choices.length)];
            return this._allModeType;
        }

        if (this.mode === 'tones') return 'tone';
        if (this.mode === 'noteReading') return 'noteReading';
        if (this.mode === 'rhythm') return 'rhythm';
        if (this.mode === 'rhythmReading') return 'rhythmReading';

        if (this._allModeQuestionsLeft <= 0) {
            const choices = ALL_CHALLENGE_TYPES.filter(t => t !== this._allModeType);
            this._allModeType = choices[Math.floor(Math.random() * choices.length)];
            const isRhythmType = this._allModeType === 'rhythm' || this._allModeType === 'rhythmReading';
            this._allModeQuestionsLeft = isRhythmType ? 1 : 5 + Math.floor(Math.random() * 6);
        }
        this._allModeQuestionsLeft--;
        return this._allModeType;
    }

    // ===================== QUESTION DISPATCH =====================

    _askQuestion() {
        if (this._gameOverFlag) return;
        this._resetEscapeTimer();
        this._questionActive = true;
        this._questionStartTime = performance.now();

        if (this._activeUIType && this._activeUIType !== this._challengeType) {
            this._clearChallengeUI(this._activeUIType);
        }
        this._activeUIType = this._challengeType;

        if (this.practiceMode) this._showNpcTip(this._challengeType);

        switch (this._challengeType) {
            case 'tone':          this._askTone(); break;
            case 'noteReading':   this._askNoteReading(); break;
            case 'rhythm':        this._askRhythm(); break;
            case 'rhythmReading': this._askRhythmReading(); break;
        }
    }

    _clearChallengeUI(type) {
        switch (type) {
            case 'tone':          this._clearSolfegeButtons(); break;
            case 'noteReading':   this._clearPianoKeys(); break;
            case 'rhythm':        this._clearRhythmUI(); break;
            case 'rhythmReading': this._clearRhythmReadingUI(); break;
        }
    }

    // ===================== TONE =====================

    _askTone() {
        const { width, height } = this.cameras.main;
        const degrees = this._getTonesPool();

        const fixedKey = this.tonesKey !== 'random' ? this.tonesKey : null;

        if (this._droneQuestionsLeft <= 0) {
            this.audioEngine.stopDrone();
            if (fixedKey) {
                this.musicTheory.setRoot(fixedKey);
            } else {
                this.musicTheory.randomizeRoot();
            }
            this._droneQuestionsLeft = fixedKey ? 9999 : 5 + Math.floor(Math.random() * 6);

            this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
            this._droneActive = true;
            this.droneText.setText(this.musicTheory.rootNote).setVisible(true);
            this.messageText.setText(`Key: ${this.musicTheory.rootNote} — listen: 1 · 5 · 1`);

            const freq1 = this.musicTheory.getIntervalFreq('1');
            const freq5 = this.musicTheory.getIntervalFreq('5');
            this.audioEngine.playInterval(freq1, '4n');
            this.time.delayedCall(550, () => this.audioEngine.playInterval(freq5, '4n'));
            this.time.delayedCall(1100, () => this.audioEngine.playInterval(freq1, '4n'));
            this.time.delayedCall(1700, () => {
                if (this._gameOverFlag) return;
                this._droneQuestionsLeft--;
                this._fireTonesQuestion(degrees, width, height);
            });
        } else {
            if (!this._droneActive) {
                this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
                this._droneActive = true;
            }
            this.droneText.setText(this.musicTheory.rootNote).setVisible(true);
            this._droneQuestionsLeft--;
            this._fireTonesQuestion(degrees, width, height);
        }
    }

    _fireTonesQuestion(degrees, width, height) {
        this._currentDegree = degrees[Math.floor(Math.random() * degrees.length)];
        const freq = this.musicTheory.getIntervalFreq(this._currentDegree);

        this.time.delayedCall(300, () => {
            if (this._gameOverFlag) return;
            this.audioEngine.playInterval(freq, '2n');
            this._buildSolfegeButtons(degrees, width, height);
        });
    }

    _buildSolfegeButtons(degrees, width, height) {
        const degreesKey = degrees.slice().sort().join(',');
        if (this.solfegeButtons.length > 0 && this._lastDegreesKey === degreesKey) return;
        this._clearSolfegeButtons();
        this._lastDegreesKey = degreesKey;

        const CIRCLE_OF_FIFTHS = ['1', '5', '2', '6', '3', '7', '#4', 'b2', 'b6', 'b3', 'b7', '4'];
        const allTwelve = degrees.length === 12 && CIRCLE_OF_FIFTHS.every(d => degrees.includes(d));

        let orderedDegrees = degrees;
        let centerX = width / 2, centerY, useFullCircle;

        if (allTwelve) {
            orderedDegrees = CIRCLE_OF_FIFTHS;
            centerY = height * 0.38;
            useFullCircle = true;
        } else {
            centerY = height * 0.42;
            useFullCircle = false;
        }

        const radius = allTwelve ? Math.min(145, width * 0.34) : Math.min(155, width * 0.38);

        this.droneText.setPosition(centerX, centerY).setOrigin(0.5);
        if (this.musicTheory.rootNote) {
            this.droneText.setText(this.musicTheory.rootNote).setVisible(true);
        }

        orderedDegrees.forEach((degree, i) => {
            let x, y;
            if (useFullCircle) {
                const angle = -Math.PI / 2 + (2 * Math.PI * i) / orderedDegrees.length;
                x = centerX + Math.cos(angle) * radius;
                y = centerY + Math.sin(angle) * radius;
            } else if (degrees.length === 1) {
                x = centerX; y = centerY;
            } else {
                const angle = Math.PI + (Math.PI * i) / Math.max(degrees.length - 1, 1);
                x = centerX + Math.cos(angle) * radius;
                y = centerY + Math.sin(angle) * (radius * 0.45);
            }

            const info = SCALE_DEGREES[degree];
            if (!info) return;
            const btn = this.add.text(x, y, `${info.solfege}\n${degree}`, {
                font: 'bold 15px monospace', fill: info.color,
                backgroundColor: '#2a2418', padding: { x: 9, y: 5 },
                stroke: '#000000', strokeThickness: 2, align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5);

            btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#3a3020' }));
            btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#2a2418' }));
            btn.on('pointerdown', () => this._submitTone(degree));
            this.solfegeButtons.push(btn);
        });

        this.input.keyboard.once('keydown-SPACE', () => {
            if (this._questionActive && this._challengeType === 'tone') {
                const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
                this.audioEngine.playInterval(freq, '2n');
            }
        });
    }

    _submitTone(selected) {
        if (!this._questionActive) return;
        this._questionActive = false;

        const correct = selected === this._currentDegree;
        const info = SCALE_DEGREES[this._currentDegree];
        this._handleAnswer(correct, correct
            ? `Correct! ${info?.solfege}`
            : `Wrong! It was ${info?.solfege}`
        );
    }

    _getTonesPool() {
        if (this.storyBattle && this._entityData) {
            const zone = this._getEntityZone();
            if (zone && ZONES[zone]) {
                return ZONES[zone].scaleDegrees;
            }
        }

        if (!this.gradual && this.customDegrees) {
            return this.customDegrees;
        }
        const tier = [...TONES_TIERS].reverse().find(t => this.session.round >= t.minRound) || TONES_TIERS[0];
        return tier.degrees;
    }

    // ===================== NOTE READING =====================

    _getNoteReadingConfig() {
        if (this.gradual) return null;

        const ranges = this.customNoteRanges;
        const hasOnStaff = ranges.includes('onStaff');
        const hasLedgerLow = ranges.includes('ledgerLow');
        const hasLedgerHigh = ranges.includes('ledgerHigh');
        const hasAccidentals = ranges.includes('accidentals');

        let minPos = hasOnStaff ? 0 : (hasLedgerLow ? -2 : 0);
        let maxPos = hasOnStaff ? 8 : (hasLedgerHigh ? 10 : 8);
        if (hasLedgerLow) minPos = -2;
        if (hasLedgerHigh) maxPos = 10;

        return { posRange: [minPos, maxPos], accidentals: hasAccidentals };
    }

    _askNoteReading() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        const noteConfig = this._getNoteReadingConfig();
        this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, this.clefSetting, noteConfig);
        if (!this._currentNoteQuestion) {
            this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, this.clefSetting);
            if (!this._currentNoteQuestion) {
                console.warn('NoteReading: buildQuestion returned null, falling back to tone');
                this._challengeType = 'tone';
                this._askTone();
                return;
            }
        }

        const staffCX = width / 2;
        const staffCY = height * 0.30;
        this.staffRenderer.draw(staffCX, staffCY, 340, this._currentNoteQuestion);

        this.messageText.setY(height - 90 - 24);

        if (this.pianoKeys.length === 0) {
            this._buildPianoKeys(width, height);
        }
        this._staffVisible = true;
    }

    _buildPianoKeys(width, height) {
        this._clearPianoKeys();
        const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const BLACK_KEYS = [
            { afterIdx: 0, note: 'C#' }, { afterIdx: 1, note: 'D#' },
            { afterIdx: 3, note: 'F#' }, { afterIdx: 4, note: 'G#' }, { afterIdx: 5, note: 'A#' },
        ];
        const keyW = 52, keyH = 90, bkeyW = 30, bkeyH = 56;
        const totalW = WHITE_NOTES.length * keyW;
        const startX = width / 2 - totalW / 2;
        const keyTop = height - keyH - 14;

        WHITE_NOTES.forEach((note, i) => {
            const cx = startX + i * keyW + keyW / 2;
            const cy = keyTop + keyH / 2;
            const key = this.add.rectangle(cx, cy, keyW - 2, keyH, 0xeeeeee)
                .setStrokeStyle(1, 0x555555).setDepth(5);
            const lbl = this.add.text(cx, keyTop + keyH - 12, note, {
                font: '11px monospace', fill: '#333333'
            }).setOrigin(0.5).setDepth(6);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0xbbddff));
            key.on('pointerout',  () => key.setFillStyle(0xeeeeee));
            key.on('pointerdown', () => this._submitNoteReading(note));
            this.pianoKeys.push(key, lbl);
        });

        BLACK_KEYS.forEach(({ afterIdx, note }) => {
            const cx = startX + (afterIdx + 1) * keyW;
            const cy = keyTop + bkeyH / 2;
            const key = this.add.rectangle(cx, cy, bkeyW, bkeyH, 0x222222)
                .setStrokeStyle(1, 0x000000).setDepth(7);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0x3355aa));
            key.on('pointerout',  () => key.setFillStyle(0x222222));
            key.on('pointerdown', () => this._submitNoteReading(note));
            this.pianoKeys.push(key);
        });
    }

    _submitNoteReading(answer) {
        if (!this._questionActive) return;
        this._questionActive = false;

        const correct = this.noteReadingEngine.checkAnswer(this._currentNoteQuestion, answer);
        this._handleAnswer(correct, correct
            ? `Correct! It's ${this._currentNoteQuestion.correctAnswer}!`
            : `Wrong! It was ${this._currentNoteQuestion.correctAnswer}.`
        );
    }

    // ===================== MIDI INPUT =====================

    _handleMidiNote(midiNote) {
        if (this._gameOverFlag) return;

        if (this._challengeType === 'rhythmReading') {
            if (this._questionActive) this._onRrTap();
            return;
        }

        if (this._challengeType === 'rhythm') {
            if (this._questionActive && this._rhythmCellCenters) {
                const nextEmpty = this._userRhythm.findIndex(v => v === 0);
                if (nextEmpty >= 0) this._onRhythmCellDown(nextEmpty);
            }
            return;
        }

        const freq = this.musicTheory.midiToFreq(midiNote);
        this.audioEngine.playInterval(freq, '8n');

        if (!this._questionActive) return;

        if (this._challengeType === 'tone') {
            const transpose = ((new ProgressionManager()).loadArcadeSettings() || {}).midiTranspose || 0;
            const degree = MidiInput.scaleDegree(
                midiNote + transpose, this.musicTheory.rootMidi, this._getTonesPool()
            );
            if (degree) this._submitTone(degree);
        } else if (this._challengeType === 'noteReading') {
            const sharpName = MidiInput.noteName(midiNote);
            const flatName = MidiInput.noteNameFlat(midiNote);

            const correct = this._currentNoteQuestion?.correctAnswer;
            if (correct === flatName) {
                this._submitNoteReading(flatName);
            } else if (correct === sharpName) {
                this._submitNoteReading(sharpName);
            } else {
                this._submitNoteReading(sharpName);
            }
        }
    }

    _clearPianoKeys() {
        this.pianoKeys.forEach(k => k.destroy());
        this.pianoKeys = [];
        if (this._staffVisible) {
            this.staffRenderer.clear();
            this._staffVisible = false;
        }
        this.messageText.setY(GROUND_Y - 30);
    }

    _clearSolfegeButtons() {
        this.solfegeButtons.forEach(b => b.destroy());
        this.solfegeButtons = [];
        this._lastDegreesKey = null;
    }

    // ===================== RHYTHM =====================

    _askRhythm() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        let subKey;
        if (this.gradual) {
            const available = ['quarter'];
            if (this.session.round >= 10) available.push('eighth');
            if (this.session.round >= 20) available.push('sixteenth');
            if (this.session.round >= 30) available.push('triplet');
            subKey = available[Math.floor(Math.random() * available.length)];
        } else {
            const subs = this.customRhythmSubs;
            subKey = subs[Math.floor(Math.random() * subs.length)];
        }
        const sub = RHYTHM_SUBDIVISIONS[subKey];
        const cells = sub.cells.length;
        const cellMs = (60000 / RHYTHM_BPM) * sub.cellFraction;

        const pattern = new Array(cells).fill(false);
        const noteTarget = Math.max(2, Math.floor(cells * (0.3 + Math.random() * 0.4)));
        let noteCount = 0;
        for (let i = 0; i < cells; i++) {
            if (Math.random() < (sub.downbeats.includes(i) ? 0.75 : 0.4) && noteCount < noteTarget) {
                pattern[i] = true;
                noteCount++;
            }
        }
        pattern[0] = true;
        if (pattern.filter(v => v).length < 2) pattern[Math.floor(cells / 2)] = true;

        this._rhythmPattern = pattern;
        this._rhythmSub = sub;
        this._rhythmSubKey = subKey;
        this._rhythmCells = cells;
        this._rhythmCellMs = cellMs;
        this._userRhythm = new Array(cells).fill(0);
        this._nextRhythmGroupId = 1;
        this._rhythmPlaying = false;
        this._rhythmPlayTimer = null;

        this._buildRhythmUI(width, height);
        this._rhythmStartTimer = this.time.delayedCall(400, () => this._startRhythmLoop());
    }

    _getNoteKey() {
        switch (this._rhythmSubKey) {
            case 'quarter': return 'note-quarter';
            case 'eighth':  return 'note-eighth';
            case 'sixteenth': return 'note-sixteenth';
            case 'triplet': return 'note-eighth';
            default: return 'note-quarter';
        }
    }

    _getRestKey() {
        switch (this._rhythmSubKey) {
            case 'quarter': return 'rest-quarter';
            case 'eighth':  return 'rest-eighth';
            case 'sixteenth': return 'rest-sixteenth';
            case 'triplet': return 'rest-eighth';
            default: return 'rest-quarter';
        }
    }

    _restKeyForTicks(ticks) {
        if (ticks <= 1) return 'rest-sixteenth';
        if (ticks <= 2) return 'rest-eighth';
        return 'rest-quarter';
    }

    _createSymbol(cx, cy, isNote, tint, maxH) {
        const key = isNote ? this._getNoteKey() : this._getRestKey();
        if (!this.textures.exists(key)) return null;
        const sprite = this.add.image(cx, cy, key).setDepth(6);
        const scale = maxH / sprite.height;
        sprite.setScale(scale);
        sprite.setTint(tint);
        return sprite;
    }

    _buildRhythmUI(width, height) {
        this._clearRhythmUI();

        const sub = this._rhythmSub;
        const cells = this._rhythmCells;
        const n = cells;

        const GAP = 4;
        const MARGIN = 60;
        const usable = width - MARGIN * 2;
        const cellW = (usable - GAP * (n - 1)) / n;
        const cellH = 60;
        const notationY = height * 0.22;
        const gridY = height * 0.40;
        const gridX = MARGIN;

        this._rCellW = cellW;
        this._rCellGap = GAP;
        this._rGridX = gridX;
        this._rGridY = gridY;
        this._rCellH = cellH;
        this._rNotationY = notationY;

        const gridVisible = this.showGrid;

        const title = this.add.text(width / 2, notationY - 70, 'LISTEN & MATCH THIS RHYTHM', {
            font: 'bold 14px monospace', fill: '#ffaa00',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this.rhythmUI.push(title);

        const g = this.add.graphics().setDepth(4);
        if (gridVisible) {
            g.lineStyle(1, 0x7799bb, 0.6);
            sub.downbeats.forEach(di => {
                if (di === 0) return;
                const lx = gridX + di * (cellW + GAP) - GAP / 2;
                g.lineBetween(lx, gridY - 20, lx, gridY + cellH + 10);
            });
        }
        this.rhythmUI.push(g);

        this._rhythmCursor = this.add.rectangle(
            gridX + cellW / 2, gridY + cellH / 2, cellW, cellH + 4, 0xffffff, 0
        ).setDepth(4).setVisible(false);
        this.rhythmUI.push(this._rhythmCursor);

        this._rhythmCellRects = [];
        this._rhythmCellLabels = [];
        this._rhythmCellCenters = [];

        for (let i = 0; i < n; i++) {
            const cx = gridX + i * (cellW + GAP) + cellW / 2;
            const cy = gridY + cellH / 2;
            const isDB = sub.downbeats.includes(i);

            const bg = this.add.rectangle(cx, cy, cellW, cellH, 0xf0f8ff)
                .setStrokeStyle(1, 0x99bbdd).setDepth(5);
            if (gridVisible) {
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerdown', () => this._onRhythmCellDown(i));
                bg.on('pointerover', () => { if (this._questionActive) bg.setStrokeStyle(2, 0x4488cc); });
                bg.on('pointerout',  () => bg.setStrokeStyle(1, 0x99bbdd));
            } else {
                bg.setVisible(false);
            }

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 16px monospace' : '13px monospace',
                fill: isDB ? '#334466' : '#556688'
            }).setOrigin(0.5).setDepth(6);
            if (!gridVisible) lbl.setVisible(false);

            this._rhythmCellRects.push(bg);
            this._rhythmCellLabels.push(lbl);
            this._rhythmCellCenters.push({ x: cx, y: cy });
            this.rhythmUI.push(bg, lbl);
        }

        this._setupRhythmKeyboard(n, gridX, gridY, cellW, cellH);

        const btnY = gridY + cellH + 70;
        this._rhythmPlayBtn = this._makeBtn(width / 2 - 90, btnY, '▶ STOP', '#112233', '#224455',
            () => this._toggleRhythmPlayback()).setDepth(5);
        const submitBtn = this._makeBtn(width / 2 + 90, btnY, 'SUBMIT', '#113322', '#225533',
            () => this._submitRhythm()).setDepth(5);
        this.rhythmUI.push(this._rhythmPlayBtn, submitBtn);

        this._renderRhythmNotation();
    }

    _setupRhythmKeyboard(n, gridX, gridY, cellW, cellH) {
        const { width } = this.cameras.main;
        const ticksPerCell = { quarter: 4, eighth: 2, sixteenth: 1, triplet: 1 }[this._rhythmSubKey];

        this._rhythmKeyboard = new RhythmKeyboardInput(this, {
            cells: n,
            ticksPerCell,
            subdivision: this._rhythmSubKey,
            onSubmit: () => this._submitRhythm(),
            onUpdate: (grid, cursorCell) => {
                if (!this._questionActive) return;
                for (let i = 0; i < grid.length; i++) {
                    this._userRhythm[i] = grid[i];
                }
                this._nextRhythmGroupId = this._rhythmKeyboard._nextGroupId;
                this._refreshRhythmVisuals();
                this._renderRhythmNotation();
            },
        });
        this._rhythmKeyboard.enable();

        const hints = this.add.text(width / 2, gridY + cellH + 14,
            '3-7: duration   A-G: note   0: rest   T: tie   .: dot   ←→: move   ⌫: undo   Enter: submit', {
                font: '10px monospace', fill: '#556677'
            }).setOrigin(0.5).setDepth(5);
        this.rhythmUI.push(hints);
    }

    _onRhythmCellDown(idx) {
        if (!this._questionActive) return;

        if (this._userRhythm[idx] > 0) {
            const groupId = this._userRhythm[idx];
            for (let i = idx; i < this._userRhythm.length; i++) {
                if (this._userRhythm[i] === groupId) {
                    this._userRhythm[i] = 0;
                } else {
                    break;
                }
            }
            this._rhythmDragging = false;
            this._refreshRhythmVisuals();
            this._renderRhythmNotation();
            if (this._rhythmKeyboard) this._rhythmKeyboard.syncFromGrid(this._userRhythm);
            return;
        } else {
            const gid = this._nextRhythmGroupId++;
            this._userRhythm[idx] = gid;
            this._rhythmDragging = true;
            this._rhythmDragGroupId = gid;
            this._rhythmDragStart = idx;
            this._rhythmDragEnd = idx;
        }
        this._refreshRhythmVisuals();
        this._renderRhythmNotation();
    }

    _getRhythmCellIndexAtPointer(ptr) {
        if (!this._rhythmCellCenters || this._rhythmCellCenters.length === 0) return -1;
        const n = this._userRhythm.length;
        for (let i = 0; i < n; i++) {
            const cx = this._rhythmCellCenters[i].x;
            const hw = this._rCellW / 2 + 2;
            if (ptr.x >= cx - hw && ptr.x <= cx + hw &&
                ptr.y >= this._rGridY - 10 && ptr.y <= this._rGridY + this._rCellH + 10) {
                return i;
            }
        }
        return -1;
    }

    _onRhythmDragMove(ptr) {
        if (!this._questionActive || !this._rhythmDragging || !ptr.isDown) return;
        const idx = this._getRhythmCellIndexAtPointer(ptr);
        if (idx < 0 || idx <= this._rhythmDragStart) return;
        if (idx === this._rhythmDragEnd) return;

        for (let i = this._rhythmDragStart; i <= idx; i++) {
            this._userRhythm[i] = this._rhythmDragGroupId;
        }
        this._rhythmDragEnd = idx;
        this._refreshRhythmVisuals();
        this._renderRhythmNotation();
    }

    _onRhythmDragEnd() {
        this._rhythmDragging = false;
        if (this._rhythmKeyboard) this._rhythmKeyboard.syncFromGrid(this._userRhythm);
    }

    _refreshRhythmVisuals() {
        if (!this.showGrid) return;
        const n = this._rhythmCells;
        for (let i = 0; i < n; i++) {
            const gid = this._userRhythm[i];
            const isNote = gid > 0;
            const isGroupStart = isNote && (i === 0 || this._userRhythm[i - 1] !== gid);

            this._rhythmCellRects[i].setFillStyle(isNote ? 0xd4edda : 0xf0f8ff);

            const lbl = this._rhythmCellLabels[i];
            if (lbl) {
                if (isNote && !isGroupStart) {
                    lbl.setStyle({ fill: '#3a6a44' });
                } else if (isNote) {
                    lbl.setStyle({ fill: '#226633' });
                } else {
                    lbl.setStyle({ fill: '#556677' });
                }
            }
        }

        if (this._rhythmSustainGfx) {
            this._rhythmSustainGfx.clear();
        } else {
            this._rhythmSustainGfx = this.add.graphics().setDepth(7);
            this.rhythmUI.push(this._rhythmSustainGfx);
        }

        const sg = this._rhythmSustainGfx;
        const visited = new Set();
        for (let i = 0; i < n; i++) {
            const gid = this._userRhythm[i];
            if (gid === 0 || visited.has(gid)) continue;
            visited.add(gid);

            let end = i;
            while (end + 1 < n && this._userRhythm[end + 1] === gid) end++;

            if (end > i) {
                const startX = this._rhythmCellCenters[i].x;
                const endX = this._rhythmCellCenters[end].x;
                const barY = this._rhythmCellCenters[i].y + this._rCellH * 0.3;
                sg.lineStyle(3, 0x44aa66, 0.8);
                sg.lineBetween(startX, barY, endX, barY);
                for (let j = i + 1; j <= end; j++) {
                    sg.fillStyle(0x44aa66, 0.7);
                    sg.fillCircle(this._rhythmCellCenters[j].x, barY, 3);
                }
            }
        }
    }

    _renderRhythmNotation() {
        const { width } = this.cameras.main;
        let spelled = spellPattern(this._userRhythm, this._rhythmSubKey);
        const cursorTick = this._rhythmKeyboard ? this._rhythmKeyboard._cursorTick : -1;
        const selectedTicks = this._rhythmKeyboard ? this._rhythmKeyboard.effectiveTicks : -1;
        if (cursorTick >= 0 && selectedTicks > 0) {
            spelled = splitRestsAtCursor(spelled, cursorTick, selectedTicks, this._rhythmSubKey);
        }
        const notationY = this._rNotationY || (this._rGridY - 108);
        this.rhythmNotationRenderer.render(spelled, this._rhythmSubKey, width / 2, notationY, width - 100, cursorTick);
    }

    _toggleRhythmPlayback() {
        if (this._rhythmPlaying) {
            this._stopRhythmPlayback();
        } else {
            this._startRhythmLoop();
        }
    }

    _startRhythmLoop() {
        if (this._rhythmPlaying) return;
        this._rhythmPlaying = true;
        if (this._rhythmPlayBtn) this._rhythmPlayBtn.setText('■ STOP');
        this._playRhythmOnce();
    }

    _playRhythmOnce() {
        if (!this._rhythmPlaying) return;

        const pattern = this._rhythmPattern;
        const sub = this._rhythmSub;
        const cells = this._rhythmCells;
        const cellMs = this._rhythmCellMs;

        let i = 0;
        const tick = () => {
            if (!this._rhythmPlaying || !this._rhythmCursor) return;

            const cx = this._rGridX + i * (this._rCellW + this._rCellGap) + this._rCellW / 2;
            const cy = this._rGridY + this._rCellH / 2;
            this._rhythmCursor.setPosition(cx, cy).setVisible(this.showGrid).setAlpha(0.15);

            if (sub.downbeats.includes(i)) {
                this.audioEngine.playClick(i === 0);
            }

            if (pattern[i]) {
                this.audioEngine.playDrumNote();
            }

            i++;
            if (i < cells) {
                this._rhythmPlayTimer = this.time.delayedCall(cellMs, tick);
            } else {
                this._rhythmPlayTimer = this.time.delayedCall(cellMs, () => {
                    if (this._rhythmCursor) this._rhythmCursor.setVisible(false);
                    if (!this._rhythmPlaying) return;
                    this._playRhythmCountIn(() => this._playRhythmOnce());
                });
            }
        };

        tick();
    }

    _playRhythmCountIn(onComplete) {
        if (!this._rhythmPlaying) return;

        const sub = this._rhythmSub;
        const cells = this._rhythmCells;
        const cellMs = this._rhythmCellMs;

        let i = 0;
        const tick = () => {
            if (!this._rhythmPlaying) return;

            if (sub.downbeats.includes(i)) {
                this.audioEngine.playClick(i === 0);
            }

            i++;
            if (i < cells) {
                this._rhythmPlayTimer = this.time.delayedCall(cellMs, tick);
            } else {
                this._rhythmPlayTimer = this.time.delayedCall(cellMs, () => {
                    if (this._rhythmPlaying && onComplete) onComplete();
                });
            }
        };

        tick();
    }

    _stopRhythmPlayback() {
        this._rhythmPlaying = false;
        if (this._rhythmPlayTimer) {
            this._rhythmPlayTimer.remove(false);
            this._rhythmPlayTimer = null;
        }
        if (this._rhythmCursor) this._rhythmCursor.setVisible(false);
        if (this._rhythmPlayBtn) this._rhythmPlayBtn.setText('▶ PLAY');
    }

    _submitRhythm() {
        if (!this._questionActive) return;
        this._questionActive = false;
        this._stopRhythmPlayback();

        const { _rhythmPattern: pattern, _userRhythm: userGrid } = this;
        const patternOnsets = pattern.map((v, i) =>
            v && (i === 0 || !pattern[i - 1]));
        const userOnsets = userGrid.map((v, i) =>
            v > 0 && (i === 0 || userGrid[i - 1] === 0));

        const expectedCount = patternOnsets.filter(Boolean).length;
        let hits = 0;
        for (let i = 0; i < pattern.length; i++) {
            if (patternOnsets[i] && userOnsets[i]) hits++;
        }
        const extra = userOnsets.filter(Boolean).length - hits;
        const score = Math.max(0, hits - extra);
        const accuracy = score / Math.max(1, expectedCount);
        const correct = accuracy >= 0.75;
        const pct = Math.round(accuracy * 100);

        if (correct) {
            this._clearRhythmUI();
            this._handleAnswer(true, `${pct}% correct!`);
        } else {
            this.audioEngine.playWrong();
            this.session.streak = 0;
            this._showFlash('#dd8855');

            if (!this.practiceMode) {
                if (this._applyWrongDamage()) {
                    this._clearRhythmUI();
                    return;
                }
            }

            this._showRhythmAnswer();
        }
    }

    /** Apply wrong-answer damage. Returns true if player died. */
    _applyWrongDamage() {
        const dmg = Math.max(1, this._entityAttack - (this.playerStats.defense || 0) + Math.floor(Math.random() * 4));
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
        this._showWrongDamage(dmg);
        this._updateHpBars();
        this._updateHud();

        if (this.playerStats.hp <= 0) {
            this._gameOverFlag = true;
            if (this.storyBattle) {
                this._onStoryPlayerDefeated();
            } else {
                this.time.delayedCall(600, () => this._gameOver());
            }
            return true;
        }
        return false;
    }

    _showRhythmAnswer() {
        const pattern = this._rhythmPattern;
        const n = this._rhythmCells;

        if (this.showGrid) {
            const patternOnsets = pattern.map((v, i) =>
                v && (i === 0 || !pattern[i - 1]));
            const userOnsets = this._userRhythm.map((v, i) =>
                v > 0 && (i === 0 || this._userRhythm[i - 1] === 0));
            for (let i = 0; i < n; i++) {
                if (patternOnsets[i] === userOnsets[i]) {
                    this._rhythmCellRects[i].setFillStyle(0xbbeecc);
                } else {
                    this._rhythmCellRects[i].setFillStyle(0xffcccc);
                }
            }
        }
        this._entityApproaching = false;
        // Pause escape timer during wrong answer display
        if (this._escapeTimer) this._escapeTimer.paused = true;
        this.messageText.setText('Wrong! Copy the correct rhythm and submit.');

        this.time.delayedCall(1200, () => {
            if (this._gameOverFlag) return;

            let gid = this._nextRhythmGroupId || 100;
            for (let i = 0; i < n; i++) {
                if (pattern[i]) {
                    if (i === 0 || !pattern[i - 1]) {
                        gid++;
                    }
                    this._userRhythm[i] = gid;
                } else {
                    this._userRhythm[i] = 0;
                }
            }
            this._nextRhythmGroupId = gid + 1;
            this._refreshRhythmVisuals();
            this._renderRhythmNotation();

            this._questionActive = true;
            this._entityApproaching = true;
            // Reset escape timer with fresh budget for the retry
            this._resetEscapeTimer();
            this.messageText.setText('Now submit the correct rhythm!');
        });
    }

    _clearRhythmUI() {
        if (this._rhythmStartTimer) { this._rhythmStartTimer.remove(false); this._rhythmStartTimer = null; }
        this._stopRhythmPlayback();
        if (this._rhythmKeyboard) {
            this._rhythmKeyboard.disable();
            this._rhythmKeyboard = null;
        }
        this.rhythmUI.forEach(o => o.destroy());
        this.rhythmUI = [];
        this._rhythmCellRects = [];
        this._rhythmCellLabels = [];
        this._rhythmCellCenters = [];
        this._rhythmCursor = null;
        this._rhythmPlayBtn = null;
        this._rhythmSustainGfx = null;
        this._rhythmDragging = false;
        this.rhythmNotationRenderer.clear();
    }

    // ===================== RHYTHM READING (sight-tap) =====================

    _askRhythmReading() {
        this._clearRhythmReadingUI();
        this._stopRhythmPlayback();

        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        this._rrBpm       = 72 + Math.floor(Math.random() * 61);
        this._rrQuarterMs = 60000 / this._rrBpm;

        let subKey;
        if (this.gradual) {
            const available = ['quarter'];
            if (this.session.round >= 10) available.push('eighth');
            if (this.session.round >= 20) available.push('sixteenth');
            if (this.session.round >= 30) available.push('triplet');
            subKey = available[Math.floor(Math.random() * available.length)];
        } else {
            const subs = this.customRhythmSubs;
            subKey = subs[Math.floor(Math.random() * subs.length)];
        }
        const sub    = RHYTHM_SUBDIVISIONS[subKey];
        const n      = sub.cells.length;
        const cellMs = this._rrQuarterMs * sub.cellFraction;

        this._rrSubKey  = subKey;
        this._rrSub     = sub;
        this._rrCells   = n;
        this._rrCellMs  = cellMs;

        const restFrac   = 0.05 + Math.random() * 0.50;
        const pattern    = new Array(n).fill(true);
        const restTarget = Math.floor(n * restFrac);
        for (let r = 0; r < restTarget; r++) {
            const candidates = pattern
                .map((v, i) => (v && i > 0) ? i : -1)
                .filter(i => i >= 0);
            if (!candidates.length) break;
            pattern[candidates[Math.floor(Math.random() * candidates.length)]] = false;
        }

        let currentGroup = 0;
        const groupGrid  = pattern.map((v, i) => {
            if (v) currentGroup = i + 1;
            return currentGroup;
        });

        this._rrPattern    = pattern;
        this._rrGroupGrid  = groupGrid;
        this._rrOnsetCells = pattern.reduce((a, v, i) => { if (v) a.push(i); return a; }, []);
        this._rrTaps       = [];
        this._rrBarStart   = null;
        this._rrState      = 'idle';
        this._rrLastTap    = null;
        this._rrTimers     = [];
        this._rrUI         = [];
        this._rrCellRects  = [];
        this._rrCellLabels = [];

        const spelled = spellPattern(groupGrid, subKey);
        this.rhythmNotationRenderer.render(spelled, subKey, width / 2, height * 0.22, width - 80);

        const title = this.add.text(width / 2, height * 0.22 - 68, 'SIGHT-TAP THIS RHYTHM', {
            font: 'bold 14px monospace', fill: '#ffaa00',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(title);

        const bpmTxt = this.add.text(width / 2, height * 0.22 + 65, `\u2669= ${this._rrBpm}`, {
            font: '12px monospace', fill: '#887766', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(bpmTxt);

        this._buildRrGrid(width, height);

        const hint = this.add.text(width / 2, height * 0.40 + 42 + 14,
            'SPACE or MIDI: tap on every note onset', {
            font: '11px monospace', fill: '#887766'
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(hint);

        this._rrKeyHandler = (e) => {
            if (e.code === 'Space') { e.preventDefault(); this._onRrTap(); }
        };
        document.addEventListener('keydown', this._rrKeyHandler);

        // Pause escape timer during entire rhythm reading sequence
        if (this._escapeTimer) this._escapeTimer.paused = true;

        this._rrSchedule(() => this._startRrRound(), 1200);
    }

    _buildRrGrid(width, height) {
        const sub    = this._rrSub;
        const n      = this._rrCells;
        const GAP    = 3, MARGIN = 40;
        const cellW  = (width - MARGIN * 2 - GAP * (n - 1)) / n;
        const cellH  = 42;
        const gridY  = height * 0.40;
        const gridX  = MARGIN;

        this._rrCellW = cellW;
        this._rrCellH = cellH;

        const g = this.add.graphics().setDepth(4).setVisible(false);
        g.lineStyle(1, 0x7799bb, 0.6);
        sub.downbeats.forEach(di => {
            if (!di) return;
            const lx = gridX + di * (cellW + GAP) - GAP / 2;
            g.lineBetween(lx, gridY - 2, lx, gridY + cellH + 2);
        });
        this._rrUI.push(g);

        for (let i = 0; i < n; i++) {
            const cx    = gridX + i * (cellW + GAP) + cellW / 2;
            const cy    = gridY + cellH / 2;
            const isDB  = sub.downbeats.includes(i);
            const isNote = this._rrPattern[i];

            const bg = this.add.rectangle(cx, cy, cellW, cellH,
                isNote ? 0xddeeff : 0xf5f8ff)
                .setStrokeStyle(1, isNote ? 0x7799cc : 0xbbccdd)
                .setDepth(5).setVisible(false);

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 14px monospace' : '11px monospace',
                fill: isNote ? (isDB ? '#224466' : '#334455') : '#778899'
            }).setOrigin(0.5).setDepth(6).setVisible(false);

            this._rrCellRects.push(bg);
            this._rrCellLabels.push(lbl);
            this._rrUI.push(bg, lbl);
        }
    }

    _startRrRound() {
        if (this._rrState !== 'idle') return;
        this._rrState = 'countdown';
        this._rrTaps  = [];

        const sub    = this._rrSub;
        const cellMs = this._rrCellMs;
        const n      = this._rrCells;
        const COUNT_IN = 4;

        for (let b = 0; b < COUNT_IN; b++) {
            this._rrSchedule(() => {
                this.messageText.setText(b < COUNT_IN - 1 ? `${COUNT_IN - b}...` : 'TAP!')
                    .setStyle({ fill: '#ffcc00' });
                this.audioEngine.playClick(b === 0);
            }, b * this._rrQuarterMs);
        }

        this._rrSchedule(() => {
            this._rrState    = 'recording';
            this._rrBarStart = performance.now();
            this.messageText.setText('TAP!').setStyle({ fill: '#44ff88' });

            sub.downbeats.forEach(di => {
                this._rrSchedule(() => {
                    if (this._rrState !== 'recording') return;
                    this.audioEngine.playClick(di === 0);
                }, di * cellMs);
            });

            this._rrSchedule(() => {
                if (this._rrState === 'recording') this._evaluateRhythmReading();
            }, n * cellMs + 200);

        }, COUNT_IN * this._rrQuarterMs);
    }

    _onRrTap() {
        if (this._rrState !== 'recording') return;
        const now = performance.now();
        if (this._rrLastTap && now - this._rrLastTap < 80) return;
        this._rrLastTap = now;

        const t = now - this._rrBarStart;
        this._rrTaps.push(t);
    }

    _evaluateRhythmReading() {
        this._rrState = 'feedback';
        this._rrStopAll();
        this._questionActive = false;

        const sub      = this._rrSub;
        const cellMs   = this._rrCellMs;
        const tol      = Math.max(100, Math.min(280, cellMs * 0.45));
        const latency  = this.tapLatencyMs || 0;
        const adjusted = this._rrTaps.map(t => t - latency);
        const expected = this._rrOnsetCells.map(i => i * cellMs);

        const usedTaps = new Set();
        const results  = expected.map(exp => {
            let bestIdx = -1, bestDiff = Infinity;
            adjusted.forEach((tap, ti) => {
                if (usedTaps.has(ti)) return;
                const d = Math.abs(tap - exp);
                if (d < tol && d < bestDiff) { bestDiff = d; bestIdx = ti; }
            });
            if (bestIdx >= 0) { usedTaps.add(bestIdx); return { hit: true }; }
            return { hit: false };
        });

        const hits      = results.filter(r => r.hit).length;
        const total     = expected.length;
        const extraTaps = this._rrTaps.length - usedTaps.size;
        const accuracy  = hits / Math.max(1, total);
        const pct       = Math.round(accuracy * 100);

        this._rrCellRects.forEach(r => r?.setVisible(true));
        this._rrCellLabels.forEach(l => l?.setVisible(true));

        for (let i = 0; i < this._rrCells; i++) {
            const isNote = this._rrPattern[i];
            const isDB   = sub.downbeats.includes(i);
            this._rrCellRects[i]?.setFillStyle(isNote ? 0x1a2233 : 0x0c1018)
                .setStrokeStyle(1, isNote ? 0x334466 : 0x1a2233);
            if (this._rrCellLabels[i]) {
                this._rrCellLabels[i].setStyle({
                    fill: isNote ? (isDB ? '#aa9977' : '#887766') : '#2a2418'
                });
            }
        }

        results.forEach((res, ei) => {
            const cell = this._rrOnsetCells[ei];
            if (res.hit) {
                this._rrCellRects[cell]?.setFillStyle(0xbbeecc).setStrokeStyle(2, 0x44aa66);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#226633' });
            } else {
                this._rrCellRects[cell]?.setFillStyle(0xffddcc).setStrokeStyle(2, 0xff8800);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#cc5500' });
            }
        });

        this._rrTaps.forEach((tap, ti) => {
            if (!usedTaps.has(ti)) {
                const cell = Math.min(this._rrCells - 1, Math.max(0, Math.floor((tap - latency) / cellMs)));
                this._rrCellRects[cell]?.setFillStyle(0x331111).setStrokeStyle(2, 0xff3333);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#ff3333' });
            }
        });

        const passed   = accuracy >= 0.70 && extraTaps <= Math.max(1, Math.floor(total * 0.3));
        const extraStr = extraTaps > 0 ? `  +${extraTaps} extra` : '';
        const msg      = `${pct}%  ${hits}/${total}${extraStr}`;

        if (passed) {
            this._clearRhythmReadingUI();
        }
        this._handleAnswer(passed, msg);
    }

    _clearRhythmReadingUI() {
        if (this._rrKeyHandler) {
            document.removeEventListener('keydown', this._rrKeyHandler);
            this._rrKeyHandler = null;
        }
        this._rrStopAll();
        if (this._rrUI) {
            this._rrUI.forEach(o => o?.destroy());
            this._rrUI = [];
        }
        this._rrCellRects  = [];
        this._rrCellLabels = [];
        this._rrState      = 'idle';
        this.rhythmNotationRenderer.clear();
    }

    _rrSchedule(fn, delayMs) {
        const t = this.time.delayedCall(delayMs, fn, [], this);
        this._rrTimers.push(t);
        return t;
    }

    _rrStopAll() {
        if (this._rrTimers) {
            this._rrTimers.forEach(t => { if (t && t.remove) t.remove(); });
            this._rrTimers = [];
        }
    }

    // ===================== ANSWER HANDLING =====================

    _handleAnswer(correct, message) {
        if (this._gameOverFlag) return;
        this._entityApproaching = false;

        if (this.storyBattle) {
            this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
            if (correct) this.session.correctAnswers = (this.session.correctAnswers || 0) + 1;
        }

        if (correct) {
            this.audioEngine.playCorrect();
            this.session.streak++;
            const pts = this._calcPoints();
            this.session.score += pts;

            this.messageText.setText(`${message} +${pts} pts`);
            this._showFlash('#44ff44');
            this._onCorrectHit();
        } else {
            this.audioEngine.playWrong();
            this.session.streak = 0;

            this.messageText.setText(message);
            this._showFlash('#dd8855');

            if (!this.practiceMode) {
                if (this._applyWrongDamage()) return;
            }

            if (this._challengeType === 'tone' || this._challengeType === 'noteReading') {
                this.time.delayedCall(800, () => {
                    if (this._gameOverFlag) return;
                    this._questionActive = true;
                    this.messageText.setText('Try again...');
                    if (this._challengeType === 'tone' && this._currentDegree) {
                        const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
                        this.audioEngine.playInterval(freq, '2n');
                    }
                });
            } else {
                this._onWrongEffect();
            }
        }

        this._updateHud();
    }

    // ===================== STORY VICTORY / DEFEAT =====================

    _storyVictory() {
        this._cancelEscapeTimer();
        const { width, height } = this.cameras.main;
        this._clearAllUI();
        this.audioEngine.stopDrone();
        this.dangerOverlay.setAlpha(0);

        const cfg = this._victoryConfig();
        const data = this._entityData;
        const xp = data[cfg.xpField] || data.friendship || data.xp || 0;
        const gold = data[cfg.goldField] || data.gratitude || data.gold || 0;

        this.playerStats.gold = (this.playerStats.gold || 0) + gold;
        this.playerStats.xp = (this.playerStats.xp || 0) + xp;
        while (this.playerStats.xp >= (this.playerStats.xpToNext || 100)) {
            this.playerStats.xp -= this.playerStats.xpToNext;
            this.playerStats.level = (this.playerStats.level || 1) + 1;
            this.playerStats.xpToNext = Math.floor((this.playerStats.xpToNext || 100) * 1.5);
            this.playerStats.maxHp += 10;
            this.playerStats.hp = this.playerStats.maxHp;
            this.playerStats.attack = (this.playerStats.attack || 10) + 3;
            this.playerStats.defense = (this.playerStats.defense || 3) + 1;
        }

        if (this.progression) {
            this.progression.recordBattle(true, this.session.correctAnswers || 0, this.session.totalAnswers || 0);
            this.progression.save(this.playerStats);
        }

        this.add.rectangle(width / 2, height / 2, 360, 200, 0x000022, 0.95)
            .setStrokeStyle(2, 0x44ff44).setDepth(60);
        this.add.text(width / 2, height / 2 - 65, cfg.title, {
            font: 'bold 30px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width / 2, height / 2 - 25, cfg.rewardLabel(xp, gold), {
            font: '18px monospace', fill: '#ffcc00', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61);
        const accuracy = (this.session.totalAnswers || 0) > 0
            ? Math.round(((this.session.correctAnswers || 0) / this.session.totalAnswers) * 100) : 0;
        this.add.text(width / 2, height / 2 + 5, `Accuracy: ${accuracy}%`, {
            font: '14px monospace', fill: '#aaccff'
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width / 2, height / 2 + 30, cfg.playerLabel(this.playerStats), {
            font: '13px monospace', fill: '#88ffaa'
        }).setOrigin(0.5).setDepth(61);

        this._makeBtn(width / 2, height / 2 + 70, 'CONTINUE', '#113311', '#225522', () => {
            this.audioEngine.dispose();
            this._returnFromStoryBattle(true);
        }).setDepth(61);
    }

    _storyDefeat() {
        this._cancelEscapeTimer();
        const { width, height } = this.cameras.main;
        this._clearAllUI();
        this.audioEngine.stopDrone();
        this.dangerOverlay.setAlpha(0);

        const cfg = this._defeatConfig();
        this.playerStats.hp = Math.max(1, Math.floor(this.playerStats.maxHp * 0.5));
        if (this.progression) this.progression.save(this.playerStats);

        this.add.rectangle(width / 2, height / 2, 360, 150, cfg.bg, 0.95)
            .setStrokeStyle(2, cfg.stroke).setDepth(60);
        this.add.text(width / 2, height / 2 - 40, cfg.title, {
            font: 'bold 30px monospace', fill: cfg.titleColor,
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width / 2, height / 2, cfg.message, {
            font: '14px monospace', fill: cfg.messageColor
        }).setOrigin(0.5).setDepth(61);

        this._makeBtn(width / 2, height / 2 + 45, 'CONTINUE', cfg.btnBg, cfg.btnHover, () => {
            this.audioEngine.dispose();
            this._returnFromStoryBattle(false);
        }).setDepth(61);
    }

    _returnFromStoryBattle(won) {
        const resultData = {
            won,
            playerData: this.playerStats,
            enemyId: this.returnData?.enemyId || this.encounterIndex,
            encounterIndex: this.encounterIndex,
            xp: this._entityData?.friendship || this._entityData?.xp || 0,
            gold: this._entityData?.gratitude || this._entityData?.gold || 0,
            isSpecial: this._entityData?.isSpecial || this._entityData?.isBoss || false,
        };

        const returnKey = this.isOverworldMode ? this._overlayReturnScene()
                        : this.returnScene || 'PracticeMenuScene';

        const underlying = this.scene.get(returnKey);
        if (underlying && underlying._onBattleResult) {
            underlying._onBattleResult(resultData);
        }
        this.scene.stop('ChallengeScene');
        this.scene.resume(returnKey);
    }

    // ===================== GAME OVER =====================

    _gameOver() {
        const { width, height } = this.cameras.main;
        this._clearAllUI();
        this.audioEngine.stopDrone();
        this.dangerOverlay.setAlpha(0);

        const cfg = this._gameOverConfig();
        const scoreKey = this.mode;
        const pm = new ProgressionManager();
        pm.saveArcadeScore(scoreKey, this.session.score);

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8).setDepth(60);

        this.add.text(width / 2, height * 0.25, cfg.title, {
            font: 'bold 52px monospace', fill: cfg.titleColor,
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.42, `Score: ${this.session.score}`, {
            font: 'bold 30px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.52, `${cfg.entityLabel}: ${this.session.entitiesDefeated}`, {
            font: '20px monospace', fill: '#88ff88',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.60, `Rounds Survived: ${this.session.round}`, {
            font: '18px monospace', fill: '#eedd88',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61);

        // Subclass can add extra content (e.g. rescued animal preview)
        this._renderGameOverExtra(width, height);

        this._makeBtn(width / 2 - 110, height * 0.82, 'PLAY AGAIN', '#113311', '#225522', () => {
            this.audioEngine.dispose();
            this.scene.restart({ mode: this.mode, playerData: this.playerData,
                clefSetting: this.clefSetting, returnScene: this.returnScene, returnData: this.returnData,
                settings: { gradual: this.gradual, tones: this.customDegrees, noteRanges: this.customNoteRanges,
                    rhythmSubs: this.customRhythmSubs, tonesKey: this.tonesKey, sounds: this.soundSettings } });
        }).setDepth(61);

        this._makeBtn(width / 2 + 110, height * 0.82, 'MENU', '#221111', '#443333', () => {
            this.audioEngine.dispose();
            this._returnToSource();
        }).setDepth(61);
    }

    _renderGameOverExtra(width, height) {
        if (!this._rescuedList || this._rescuedList.length === 0) return;
        const show = this._rescuedList.slice(-8);
        const iconSize = 28;
        const gap = 6;
        const totalW = show.length * (iconSize + gap) - gap;
        const startX = width / 2 - totalW / 2;
        const y = height * 0.70;

        this.add.text(width / 2, y - 20, `Helped ${this._rescuedList.length} villager${this._rescuedList.length !== 1 ? 's' : ''}!`, {
            font: 'bold 13px monospace', fill: '#aabb88',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(61);

        show.forEach((entry, i) => {
            const x = startX + i * (iconSize + gap) + iconSize / 2;
            if (this.textures.exists(entry.spriteKey)) {
                this.add.sprite(x, y + 10, entry.spriteKey, 0)
                    .setScale(2).setDepth(61);
            } else {
                this.add.circle(x, y + 10, 10, 0x88cc66).setDepth(61);
            }
        });
    }

    // ===================== HELPERS =====================

    _calcPoints() {
        const responseTime = performance.now() - this._questionStartTime;
        const base = 100;
        const speedBonus = Math.max(0, Math.floor(50 * (1 - responseTime / 6000)));
        const streakBonus = Math.min(50, this.session.streak * 10);
        return base + speedBonus + streakBonus;
    }

    _showFlash(color) {
        const hex = parseInt(color.replace('#', ''), 16);
        const { width, height } = this.cameras.main;
        const flash = this.add.rectangle(width / 2, height / 2, width, height, hex, 0.15);
        this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    }

    _showDamageNumber(x, y, amount, color, text) {
        const label = text || `+${amount}`;
        const dmgText = this.add.text(x, y, label, {
            font: 'bold 22px monospace', fill: color || '#44dd88',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: dmgText, y: dmgText.y - 40, alpha: 0,
            duration: 900, onComplete: () => dmgText.destroy()
        });
    }

    _makeBtn(x, y, label, bgColor, hoverColor, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 18px monospace', fill: '#ffffff',
            backgroundColor: bgColor, padding: { x: 18, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverColor }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bgColor }));
        btn.on('pointerdown', cb);
        return btn;
    }

    _returnToSource() {
        if (this.isSidescrollMode) {
            const returnKey = this.isOverworldMode ? this._overlayReturnScene()
                            : this.returnScene || 'PracticeMenuScene';
            const underlying = this.scene.get(returnKey);
            if (underlying && underlying._onBattleResult) {
                underlying._onBattleResult({
                    won: false,
                    playerData: this.playerStats,
                    enemyId: this.returnData?.enemyId || this.encounterIndex,
                });
            }
            this.scene.stop('ChallengeScene');
            this.scene.resume(returnKey);
        } else if (this.returnScene === 'RegionMapScene' && this.returnData) {
            this.scene.start('RegionMapScene', this.returnData);
        } else {
            this.scene.start('PracticeMenuScene', { playerData: this.playerData });
        }
    }

    // ===================== PRACTICE MODE NPC =====================

    _spawnFriendlyNpc(challengeType) {
        const npcs = this._practiceNpcs();
        const cfg = npcs[challengeType] || npcs.default;

        if (this._npcSprite && this._npcType === challengeType) {
            this._showNpcTip(challengeType);
            return;
        }

        if (this._npcSprite) { this._npcSprite.destroy(); this._npcSprite = null; }
        if (this._npcNameText) { this._npcNameText.destroy(); this._npcNameText = null; }

        const NPC_X = 714;
        this._npcType = challengeType;
        this._npcSprite = this.add.sprite(NPC_X, GROUND_Y, cfg.key);
        this._npcSprite.setOrigin(0.5, 1).setScale(cfg.scale).setDepth(2).setFlipX(cfg.flip);
        this._npcSprite.play(cfg.anim);

        this._npcNameText = this.add.text(NPC_X, GROUND_Y - cfg.h - 4, cfg.name, {
            font: 'bold 12px monospace', fill: '#ffdd88',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(3);

        this._showNpcTip(challengeType);
    }

    _practiceNpcs() {
        return PRACTICE_NPCS_COZY;
    }

    _showNpcTip(challengeType) {
        if (this._npcBubble) { this._npcBubble.forEach(o => o.destroy()); this._npcBubble = []; }

        const tips = PRACTICE_TIPS[challengeType] || PRACTICE_TIPS.tone;
        const tip = tips[Math.floor(Math.random() * tips.length)];

        const bubbleW = 174;
        const bubbleH = 68;
        const bubbleX = 714 - bubbleW / 2 - 4;
        const bubbleY = GROUND_Y - 90;

        const bg = this.add.rectangle(bubbleX, bubbleY, bubbleW, bubbleH, 0x112233, 0.93)
            .setStrokeStyle(2, 0x88ccff).setDepth(8);
        const label = this.add.text(bubbleX, bubbleY - bubbleH / 2 + 8, 'TIP', {
            font: 'bold 10px monospace', fill: '#88ccff'
        }).setOrigin(0.5, 0).setDepth(9);
        const text = this.add.text(bubbleX, bubbleY + 6, `"${tip}"`, {
            font: '11px monospace', fill: '#ccddff',
            wordWrap: { width: bubbleW - 16 }, align: 'center'
        }).setOrigin(0.5, 0.5).setDepth(9);
        const tail = this.add.triangle(
            bubbleX + bubbleW / 2 + 8, bubbleY + 4,
            0, -7, 12, 0, 0, 7,
            0x112233
        ).setDepth(8);

        this._npcBubble = [bg, label, text, tail];
    }

    _clearNpc() {
        if (this._npcSprite) { this._npcSprite.destroy(); this._npcSprite = null; }
        if (this._npcNameText) { this._npcNameText.destroy(); this._npcNameText = null; }
        if (this._npcBubble) { this._npcBubble.forEach(o => o.destroy()); this._npcBubble = []; }
        this._npcType = null;
    }
}
