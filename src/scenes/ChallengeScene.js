// ChallengeScene: Unified cozy village challenge scene.
// Villagers approach with a timer; answer correctly to help them!
// Supports tones, note reading, rhythm, and rhythm reading modes.

import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';
import { AudioEngine } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { spellPattern, splitRestsAtCursor } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';
import { ZONES } from '../data/zones.js';
import { MidiInput } from '../systems/MidiInput.js';
import { RhythmKeyboardInput } from '../systems/RhythmKeyboardInput.js';
import { VILLAGERS } from '../data/villagers.js';
import { TIME_SIG_INFO, buildSubdivision, pickSubdivision, getLevelChallengeTypes, getStoryLevel, getInstrumentNoteConfig, normalizeInstrumentId } from '../data/levels.js';

// Difficulty tiers for tone challenges
const TONES_TIERS = [
    { minRound: 1,  degrees: ['1', '3', '5'] },
    { minRound: 6,  degrees: ['1', '2', '3', '4', '5'] },
    { minRound: 11, degrees: ['1', '2', 'b3', '3', '4', '5', 'b7'] },
    { minRound: 16, degrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'] },
    { minRound: 21, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7'] },
    { minRound: 26, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] },
];

// Challenge types for 'all' mode
const ALL_CHALLENGE_TYPES = ['tone', 'noteReading', 'rhythm', 'rhythmReading'];

// Rhythm constants
const RHYTHM_BPM = 100;
const RHYTHM_SUBDIVISIONS = {
    quarter:   { cells: ['1', '2', '3', '4'], downbeats: [0, 1, 2, 3], cellFraction: 1 },
    eighth:    { cells: ['1', '+', '2', '+', '3', '+', '4', '+'], downbeats: [0, 2, 4, 6], cellFraction: 0.5 },
    sixteenth: { cells: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'], downbeats: [0, 4, 8, 12], cellFraction: 0.25 },
    triplet:   { cells: ['1','p','l','2','p','l','3','p','l','4','p','l'], downbeats: [0, 3, 6, 9], cellFraction: 1/3 },
};

const GROUND_Y = 480;
const PLAYER_X = 120;

// ── Keyboard note mapping ──────────────────────────────────────────────────
const _SEMI_TO_NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const _NOTE_TO_SEMI = { C:0, Db:1, D:2, Eb:3, E:4, F:5, 'F#':6, G:7, Ab:8, A:9, Bb:10, B:11 };
const _WHITE_NOTES = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

const PRACTICE_TIPS = {
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
        this.returnScene = data.returnScene || 'ArcadeMenuScene';
        this.returnData = data.returnData || null;

        this.storyBattle = data.storyBattle || false;
        this.entityKey = data.monsterKey || null;
        this.progression = data.progression || null;
        this.encounterIndex = data.encounterIndex;
        this.playerPos = data.playerPos;
        this.isSidescrollMode = data.isSidescrollMode || false;
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

        // Story level system
        this.storyLevelId = data.storyLevel || null;
        this._storyLevel = this.storyLevelId ? getStoryLevel(this.storyLevelId) : null;
        this._showFarmerTutorial = data.showTutorial === true && !!this._storyLevel;
        this._levelUpTo = null;

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

        // Tones drone tracking
        this._droneActive = false;
        this._droneQuestionsLeft = 0;

        // Farmer tutorial UI refs
        this._farmerUI = [];

        // Ensure we have a ProgressionManager for story mode
        if (!this.progression && this.storyBattle) {
            this.progression = new ProgressionManager();
            this.progression.load();
        }

        // Load instrument setting for note reading clef/range
        {
            const pm = this.progression || new ProgressionManager();
            const arcSettings = pm.loadArcadeSettings();
            this._instrumentId = normalizeInstrumentId(arcSettings.instrument);
        }

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
            font: 'bold 16px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 3
        }).setDepth(10);
        this.roundText = this.add.text(width - 20, 8, 'Round 1', {
            font: '14px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setDepth(10);
        this.entityCountText = this.add.text(width / 2, 8, '', {
            font: '14px monospace', fill: '#50d0b0',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10);
        this.streakText = this.add.text(20, 60, '', {
            font: '13px monospace', fill: '#e08868',
            stroke: '#000000', strokeThickness: 2
        }).setDepth(10);

        // Mode label
        const modeLabels = { tones: 'TONES', noteReading: 'NOTE READING', rhythm: 'RHYTHM EAR TRAINING', rhythmReading: 'RHYTHM READING', all: 'ALL' };
        this.add.text(width / 2, height - 12, modeLabels[this.mode] || 'CHALLENGE', {
            font: '11px monospace', fill: '#687880',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(10);

        // Message area
        this.messageText = this.add.text(width / 2, GROUND_Y - 30, '', {
            font: 'bold 16px monospace', fill: '#e8f0f0',
            stroke: '#000000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5, 1).setDepth(10);

        // Drone text
        this.droneText = this.add.text(width / 2, 60, '', {
            font: 'bold 38px monospace', fill: '#90c8c0',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setVisible(false).setDepth(4);

        // Danger/sadness overlay
        this.dangerOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x90c8c0, 0)
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
        this._makeBtn(50, height - 24, 'QUIT', '#142030', '#243848', () => {
            this.audioEngine.dispose();
            this._returnToSource();
        }).setDepth(10);

        // Settings gear button
        const gearBtn = this.add.text(width - 50, height - 24, '⚙', {
            font: 'bold 28px monospace', fill: '#e8f0f0',
            backgroundColor: '#142030', padding: { x: 12, y: 4 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);
        gearBtn.on('pointerover', () => gearBtn.setStyle({ backgroundColor: '#243848' }));
        gearBtn.on('pointerout',  () => gearBtn.setStyle({ backgroundColor: '#142030' }));
        gearBtn.on('pointerdown', () => this._openSettings());

        // Cleanup
        this.events.on('shutdown', () => {
            this.audioEngine.dispose();
            this.staffRenderer.clear();
            this.rhythmNotationRenderer.clear();
            this._clearCompareUI();
            this._cancelEncounterTimer();
            if (this.midiInput) this.midiInput.dispose();
            this._clearNpc();
            // Remove document-level listeners that survive scene destruction
            if (this._rrKeyHandler) {
                document.removeEventListener('keydown', this._rrKeyHandler);
                this._rrKeyHandler = null;
            }
            if (this._farmerKeyHandler) {
                document.removeEventListener('keydown', this._farmerKeyHandler);
                this._farmerKeyHandler = null;
            }
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

        // Show farmer tutorial for new story levels, then spawn first entity
        if (this._showFarmerTutorial && this._storyLevel) {
            this._displayFarmerTutorial(() => this._spawnNextEntity());
        } else {
            this._spawnNextEntity();
        }
    }

    // ===================== FARMER TUTORIAL =====================

    _displayFarmerTutorial(onDismiss) {
        const { width, height } = this.cameras.main;
        const level = this._storyLevel;
        this._farmerUI = [];

        // Dark overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(50);
        this._farmerUI.push(overlay);

        // Dialogue panel
        const panelW = Math.min(600, width - 60);
        const panelH = 210;
        const panelX = width / 2;
        const panelY = height / 2 - 20;

        const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x142030, 1)
            .setStrokeStyle(2, 0x50d0b0).setDepth(51);
        this._farmerUI.push(bg);

        // Farmer portrait — use a player body sprite as the farmer
        const portraitX = panelX - panelW / 2 + 36;
        const portraitY = panelY - panelH / 2 + 48;
        if (this.textures.exists('body-3')) {
            const portrait = this.add.image(portraitX, portraitY, 'body-3', 0)
                .setScale(2.5).setDepth(52);
            this._farmerUI.push(portrait);

        }

        // Content offset (shifted right for portrait)
        const contentX = panelX - panelW / 2 + 72;

        // Level badge
        const badge = this.add.text(contentX, panelY - panelH / 2 + 16,
            `Level ${level.id}: ${level.title}`, {
            font: 'bold 16px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 3
        }).setDepth(52);
        this._farmerUI.push(badge);

        // Farmer name
        const nameTag = this.add.text(contentX, panelY - panelH / 2 + 42,
            'Farmer:', {
            font: 'bold 13px monospace', fill: '#50d0b0',
            stroke: '#000000', strokeThickness: 2
        }).setDepth(52);
        this._farmerUI.push(nameTag);

        // Tutorial text (word-wrapped)
        const tutText = this.add.text(panelX - panelW / 2 + 20, panelY - panelH / 2 + 72,
            level.tutorial, {
            font: '13px monospace', fill: '#c8d8e0',
            stroke: '#000000', strokeThickness: 1,
            wordWrap: { width: panelW - 40 },
            lineSpacing: 4,
        }).setDepth(52);
        this._farmerUI.push(tutText);

        // "Got it!" button
        const btnW = 120, btnH = 36;
        const btnX = panelX;
        const btnY = panelY + panelH / 2 + 30;

        const btnBg = this.add.rectangle(btnX, btnY, btnW, btnH, 0x50d0b0, 1)
            .setDepth(51).setInteractive({ useHandCursor: true });
        this._farmerUI.push(btnBg);

        const btnLabel = this.add.text(btnX, btnY, "Got it!", {
            font: 'bold 14px monospace', fill: '#0c1420',
        }).setOrigin(0.5).setDepth(52);
        this._farmerUI.push(btnLabel);

        btnBg.on('pointerover', () => btnBg.setFillStyle(0x68e0c0));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x50d0b0));
        btnBg.on('pointerdown', () => {
            if (this._farmerKeyHandler) {
                document.removeEventListener('keydown', this._farmerKeyHandler);
                this._farmerKeyHandler = null;
            }
            this._farmerUI.forEach(o => o.destroy());
            this._farmerUI = [];
            this._showFarmerTutorial = false;
            if (onDismiss) onDismiss();
        });

        // Also allow SPACE/ENTER to dismiss
        this._farmerKeyHandler = (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                document.removeEventListener('keydown', this._farmerKeyHandler);
                this._farmerKeyHandler = null;
                this._farmerUI.forEach(o => o.destroy());
                this._farmerUI = [];
                this._showFarmerTutorial = false;
                if (onDismiss) onDismiss();
            }
        };
        document.addEventListener('keydown', this._farmerKeyHandler);
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
            title: 'You ran out of energy!', titleColor: '#e8d098',
            message: 'Have a good night\'s sleep and return\nto help the animals tomorrow.', messageColor: '#90c8c0',
            bg: 0x142030, stroke: 0x90c8c0,
            btnBg: '#142030', btnHover: '#243848',
        };
    }

    _gameOverConfig() {
        return {
            title: 'You ran out of energy!', titleColor: '#e8d098',
            message: 'Have a good night\'s sleep and return\nto help the animals tomorrow.', messageColor: '#90c8c0',
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

    _createPlayerSprite(charKey) {
        this.playerSprite = this.add.sprite(PLAYER_X, GROUND_Y, `player-${charKey}`, 0);
        this.playerSprite.setOrigin(0.5, 1);
        // Match entity scale: entities target 80px from ~17px frames (≈4.7x).
        // Player is 32px, so 4.0x ≈ 128px — similar visual presence.
        this.playerSprite.setScale(4.0);
        this.playerSprite.setFlipX(this.playerData.characterFlip || false);
        if (this.anims.exists(`${charKey}-idle`)) this.playerSprite.play(`${charKey}-idle`);
        this.playerSprite.setDepth(2);
    }

    // ===================== ENTITY SPAWNING =====================

    _spawnNextEntity() {
        if (this._gameOverFlag) return;

        if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }
        this._cancelEncounterTimer();

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
        this._encounterQuestionsAnswered = 0;
        this._buildHpBars();

        this._challengeType = this._pickChallengeType();
        this._isRhythmEncounter = this._challengeType === 'rhythm' || this._challengeType === 'rhythmReading';
        this.messageText.setText(`${data.name} needs your help!`);

        this._cancelEscapeTimer();
        if (!this.practiceMode) {
            const escapeMs = Math.max(8000, 15000 - (this.session.round - 1) * 300);
            this._escapeTimer = this.time.delayedCall(escapeMs, () => {
                if (!this._gameOverFlag) this._triggerEscape();
            });

            // Visual timer bar under the animal (all modes except rhythmReading)
            if (this._challengeType !== 'rhythmReading') {
                this._buildEscapeTimerBar(escapeMs);
            }
        }

        const startDelay = this.practiceMode ? 400 : 800;
        this.time.delayedCall(startDelay, () => {
            if (this._gameOverFlag) return;

            // Tone/NoteReading: start encounter timer (animal leaves when time expires)
            if (!this._isRhythmEncounter && !this.practiceMode) {
                const timerSec = isSpecial ? 30 : 20;
                this._startEncounterTimer(timerSec);
            }

            this._askQuestion();
        });
    }

    // ── Encounter timer (for tone/noteReading) ──────────────────────────────

    _startEncounterTimer(seconds) {
        this._cancelEncounterTimer();
        this._encounterTimerTotal = seconds;
        this._encounterTimerStart = this.time.now;

        // Update every 250ms (visual bar is handled by escape timer bar)
        this._encounterTimerLoop = this.time.addEvent({
            delay: 250, loop: true,
            callback: () => {
                const elapsed = (this.time.now - this._encounterTimerStart) / 1000;
                const remaining = Math.max(0, this._encounterTimerTotal - elapsed);
                if (remaining <= 0) this._encounterTimerExpired();
            }
        });
    }

    _encounterTimerExpired() {
        this._cancelEncounterTimer();
        // Mark entity done — happiness determines outcome
        this._entityMeter = 100; // Auto-complete when timer runs out
        this._storyEntityDone = true;
        this._questionActive = false;

        const vData = this._entityData;
        this._addToRescuedPreview(vData?.spriteKey || `villager-${this._entityKey}`, vData?.name || 'Friend');
        this.time.delayedCall(300, () => this._animalFlyOff('happy'));
    }

    _cancelEncounterTimer() {
        if (this._encounterTimerLoop) {
            this._encounterTimerLoop.remove(false);
            this._encounterTimerLoop = null;
        }
        this._cancelEscapeTimer();
    }

    _cancelEscapeTimer() {
        if (this._escapeTimer) {
            this._escapeTimer.remove(false);
            this._escapeTimer = null;
        }
        this._destroyEscapeTimerBar();
    }

    _resetEscapeTimer() {
        this._cancelEscapeTimer();
        if (!this.practiceMode && !this._gameOverFlag) {
            const escapeMs = Math.max(8000, 15000 - (this.session.round - 1) * 300);
            this._escapeTimer = this.time.delayedCall(escapeMs, () => {
                if (!this._gameOverFlag) this._triggerEscape();
            });
            if (this._challengeType !== 'rhythmReading') {
                this._buildEscapeTimerBar(escapeMs);
            }
        }
    }

    _buildEscapeTimerBar(durationMs) {
        this._destroyEscapeTimerBar();

        const entityX = this._entitySprite?.x || (this.cameras.main.width - 150);
        const barW = 80;
        const barH = 6;
        const barY = GROUND_Y + 16;

        this._escapeBarBg = this.add.rectangle(entityX, barY, barW, barH, 0x1a2838)
            .setStrokeStyle(1, 0x336644).setDepth(10);
        this._escapeBarFill = this.add.rectangle(entityX, barY, barW, barH, 0x50d0b0)
            .setDepth(10);

        this._escapeBarStart = this.time.now;
        this._escapeBarDuration = durationMs;

        this._escapeBarLoop = this.time.addEvent({
            delay: 100, loop: true,
            callback: () => {
                if (!this._escapeBarFill) return;
                const elapsed = this.time.now - this._escapeBarStart;
                const ratio = Math.max(0, 1 - elapsed / this._escapeBarDuration);
                this._escapeBarFill.setScale(ratio, 1);
                // Color: green → yellow → red
                const color = ratio > 0.5 ? 0x50d0b0 : ratio > 0.25 ? 0xe8d098 : 0xe08868;
                this._escapeBarFill.setFillStyle(color);
            }
        });
    }

    _destroyEscapeTimerBar() {
        if (this._escapeBarLoop) {
            this._escapeBarLoop.remove(false);
            this._escapeBarLoop = null;
        }
        if (this._escapeBarBg) { this._escapeBarBg.destroy(); this._escapeBarBg = null; }
        if (this._escapeBarFill) { this._escapeBarFill.destroy(); this._escapeBarFill = null; }
    }

    _triggerEscape() {
        this._cancelEscapeTimer();
        this._cancelEncounterTimer();
        this._questionActive = false;

        const { width } = this.cameras.main;
        const isRhythm = this._challengeType === 'rhythm' && this._rhythmPattern;

        // Animate animal leaving first
        const afterLeave = () => {
            if (isRhythm) {
                // Ear rhythm: show answer and let user listen before continuing
                this._stopRhythmPlayback();
                this._showRhythmTimeoutUI();
            } else {
                this._animalGotAway();
            }
        };

        if (this._entitySprite && this._entitySprite.active) {
            this.tweens.add({
                targets: this._entitySprite,
                x: width + 150,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }
                    afterLeave();
                }
            });
        } else {
            afterLeave();
        }
    }

    /**
     * When ear rhythm runs out of time, pause and let the user listen
     * to the answer as many times as they want before continuing.
     */
    _showRhythmTimeoutUI() {
        this._stopRhythmPlayback();
        this.messageText.setText("Time's up! Here's the answer:");

        // Show answer in grid cells — notes green, rests dimmed
        if (this.showGrid && this._rhythmCellRects) {
            const pattern = this._rhythmPattern;
            for (let i = 0; i < this._rhythmCells; i++) {
                if (!this._rhythmCellRects[i]) continue;
                if (pattern[i]) {
                    this._rhythmCellRects[i].setFillStyle(0x50d0b0);
                    if (this._rhythmCellLabels[i]) this._rhythmCellLabels[i].setStyle({ fill: '#ffffff' });
                } else {
                    this._rhythmCellRects[i].setFillStyle(0x3a4a5a);
                    if (this._rhythmCellLabels[i]) this._rhythmCellLabels[i].setStyle({ fill: '#556666' });
                }
            }
        }

        // Show answer in sheet music notation (no rests — sustain previous note)
        try {
            const pattern = this._rhythmPattern;
            let gid = 0;
            const answerGrid = pattern.map(v => { if (v) gid++; return gid; });
            const spelled = spellPattern(answerGrid, this._rhythmSubKey, this._rhythmTimeSigInfo);
            const { width: w } = this.cameras.main;
            const notationY = this._rNotationY || (this._rGridY - 108);
            this.rhythmNotationRenderer.render(spelled, this._rhythmSubKey, w / 2, notationY, w - 100, -1, this._rhythmTimeSigInfo);
        } catch (err) {
            console.error('_showRhythmTimeoutUI notation error:', err);
        }

        const { width, height } = this.cameras.main;
        const btnY = height * 0.88;
        const btnStyle = { fontSize: '20px', fill: '#ffffff', backgroundColor: '#335566',
                           padding: { x: 16, y: 8 }, align: 'center' };

        const playAnswerBtn = this.add.text(width * 0.35, btnY, 'Play Answer', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        const continueBtn = this.add.text(width * 0.65, btnY, 'Next Question', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });

        this._compareUI = [playAnswerBtn, continueBtn];

        const self = this;
        playAnswerBtn.on('pointerdown', () => {
            if (self._comparePlayTimer) { self._comparePlayTimer.remove(false); self._comparePlayTimer = null; }
            const pattern = self._rhythmPattern;
            const sub = self._rhythmSub;
            const cellMs = self._rhythmCellMs;
            let i = 0;
            const tick = () => {
                if (sub?.downbeats?.includes(i)) self.audioEngine.playClick(i === 0);
                if (pattern[i]) self.audioEngine.playDrumNote();
                i++;
                if (i < pattern.length) {
                    self._comparePlayTimer = self.time.delayedCall(cellMs, tick);
                }
            };
            tick();
        });

        continueBtn.on('pointerdown', () => {
            if (self._comparePlayTimer) { self._comparePlayTimer.remove(false); self._comparePlayTimer = null; }
            self._clearCompareUI();
            self._clearRhythmUI();
            self._animalGotAway();
        });
    }

    _animalGotAway() {
        if (this._gameOverFlag) return;
        this._cancelEscapeTimer();

        const { width } = this.cameras.main;
        const txt = this.add.text(width / 2, GROUND_Y - 60, 'Got away!', {
            font: 'bold 24px monospace', fill: '#e08868',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(12);
        this.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 1200, onComplete: () => txt.destroy() });

        const dmg = Math.max(2, Math.floor(this._entityAttack * 0.5));
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
        this._showDamageNumber(width / 2, GROUND_Y - 100, 0, '#e08868', `-${dmg} energy`);
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

    update() {
        // Escape is timer-based, no continuous movement
    }

    // ===================== CORRECT/WRONG HANDLERS =====================

    _onCorrectHit() {
        this._helpVillager();
    }

    _helpVillager() {
        this._encounterQuestionsAnswered = (this._encounterQuestionsAnswered || 0) + 1;

        // Rhythm encounters: 1 question per animal — auto-complete on answer
        const autoComplete = this._isRhythmEncounter;
        const happinessGain = autoComplete ? 100 : (25 + Math.floor(Math.random() * 20));
        this._entityMeter = Math.min(100, (this._entityMeter || 0) + happinessGain);
        this._updateHpBars();
        this._spawnFloatingHeart();

        if (this.isSidescrollMode) {
            const ax = this._entitySprite?.x || (this.cameras.main.width - 150);
            this._showDamageNumber(ax, GROUND_Y - 80, 0, '#e8d098', `+${happinessGain}% ♥`);
            if (this._entityMeter >= 100) {
                this._cancelEncounterTimer();
                this._storyEntityDone = true;
                this._showDamageNumber(ax, GROUND_Y - 120, 0, '#e8d098', '\u2728 HAPPY!');
                this._addToRescuedPreview(this._entityData?.spriteKey || `villager-${this._entityKey}`, this._entityData?.name || 'Friend');
                this.time.delayedCall(600, () => this._returnPlayerThenVictory());
            } else {
                this.time.delayedCall(400, () => {
                    this._askQuestion();
                });
            }
            return;
        }

        const sp = this._entitySprite;
        if (sp) {
            const animalX = sp.x;
            this._showHitEffect(animalX, GROUND_Y - 40);
            this._showDamageNumber(animalX, GROUND_Y - 80, 0, '#e8d098', `+${happinessGain}% ♥`);

            this.tweens.add({
                targets: sp,
                y: sp.y - 18,
                duration: 150, yoyo: true, ease: 'Power2',
                onComplete: () => {
                    if (sp.active) sp.setTint(0xe8d098);
                    this.time.delayedCall(200, () => { if (sp.active) sp.clearTint(); });
                }
            });

            if (this._entityMeter >= 100) {
                this._cancelEncounterTimer();
                this._storyEntityDone = true;
                this._showDamageNumber(animalX, GROUND_Y - 110, 0, '#e8d098', '\u2728 HAPPY!');
                const vData = this._entityData;
                this._addToRescuedPreview(vData.spriteKey || `villager-${this._entityKey}`, vData.name);
                this.time.delayedCall(500, () => this._animalFlyOff('happy'));
                return;
            }
        } else if (this._entityMeter >= 100) {
            this._cancelEncounterTimer();
            this._storyEntityDone = true;
            const vData = this._entityData;
            if (vData) this._addToRescuedPreview(vData.spriteKey || `villager-${this._entityKey}`, vData.name);
            this.time.delayedCall(500, () => this._animalFlyOff('happy'));
            return;
        }

        this.time.delayedCall(500, () => {
            if (!this._gameOverFlag) {
                this._entityApproaching = true;
                this.time.delayedCall(300, () => this._askQuestion());
            }
        });
    }

    _onWrongEffect() {
        this._encounterQuestionsAnswered = (this._encounterQuestionsAnswered || 0) + 1;

        // Rhythm encounters: 1 question per animal — move to next animal even on wrong
        if (this._isRhythmEncounter && !this.practiceMode) {
            this._cancelEncounterTimer();
            this.time.delayedCall(800, () => {
                if (this._gameOverFlag) return;
                if (this.storyBattle) {
                    this._animalFlyOff('sad');
                } else {
                    // Non-story: just spawn next animal (no defeat screen)
                    if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }
                    this._spawnNextEntity();
                }
            });
            return;
        }

        if (this.isSidescrollMode || this.practiceMode) {
            this.time.delayedCall(500, () => this._askQuestion());
            return;
        }

        if (!this._entitySprite) return;

        this.tweens.add({
            targets: this._entitySprite,
            x: Math.min(this._entitySprite.x + 40, this.cameras.main.width - 40),
            duration: 200, ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(500, () => this._askQuestion());
            }
        });
    }

    _showWrongDamage(dmg) {
        const dmgX = this.isSidescrollMode ? 120 : (this.playerSprite?.x || 120);
        const dmgY = this.isSidescrollMode ? 70  : ((this.playerSprite?.y || 80) - 80);
        this._showDamageNumber(dmgX, dmgY, 0, '#e08868', `-${dmg} energy`);
    }

    _onStoryPlayerDefeated() {
        this.time.delayedCall(600, () => this._animalFlyOff('sad'));
    }

    // ===================== ANIMAL FLY OFF =====================

    _animalFlyOff(reason) {
        this._cancelEscapeTimer();
        if (!this._entitySprite || !this._entitySprite.active) {
            this._entitySprite = null;
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
                    this._showDamageNumber(PLAYER_X, GROUND_Y - 120, 0, '#90c8c0', '♥');
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
                    font: 'bold 20px sans-serif', fill: '#e08868'
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
        this._rescuedList.push({ spriteKey, name });

        this._rescuedIcons.forEach(o => o.destroy());
        this._rescuedIcons = [];

        const show = this._rescuedList.slice(-10);
        const slotH = 30;
        const boxX = 10;
        const boxW = 44;
        const boxTop = GROUND_Y - 14 - show.length * slotH - 20;
        const boxH = show.length * slotH + 24;

        const bg = this.add.rectangle(boxX + boxW / 2, boxTop + boxH / 2, boxW, boxH, 0x000000, 0.5)
            .setStrokeStyle(1, 0x446644).setDepth(9);
        this._rescuedIcons.push(bg);

        const lbl = this.add.text(boxX + boxW / 2, boxTop + 8, `${this._rescuedList.length}`, {
            font: 'bold 10px monospace', fill: '#90c8c0', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10);
        this._rescuedIcons.push(lbl);

        show.forEach((entry, i) => {
            const sy = boxTop + 22 + i * slotH + slotH / 2;
            if (this.textures.exists(entry.spriteKey)) {
                const icon = this.add.sprite(boxX + boxW / 2, sy, entry.spriteKey, 0)
                    .setScale(1.6).setDepth(10);
                this._rescuedIcons.push(icon);

                if (i === show.length - 1) {
                    icon.setScale(0);
                    this.tweens.add({ targets: icon, scaleX: 1.6, scaleY: 1.6, duration: 300, ease: 'Back.easeOut' });
                }
            }
        });
    }

    // ===================== HP BARS =====================

    _buildHpBars() {
        if (this._hpBarObjs) this._hpBarObjs.forEach(o => o.destroy());
        this._hpBarObjs = [];
        const { width } = this.cameras.main;

        const pBg = this.add.rectangle(110, 34, 160, 14, 0x1a2838).setStrokeStyle(1, 0x336633).setDepth(10);
        this._playerHpBar = this.add.rectangle(110, 34, 160, 14, 0x50d0b0).setDepth(10);
        const pLabel = this.add.text(16, 27, '⚡', { font: '13px monospace', fill: '#90c8c0' }).setDepth(10);
        this._playerHpText = this.add.text(110, 34, `${this.playerStats.hp}/${this.playerStats.maxHp}`, {
            font: '10px monospace', fill: '#e8f0f0', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(11);
        // Scale to actual HP immediately
        const initRatio = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
        this._playerHpBar.setScale(initRatio, 1);
        const initCol = initRatio > 0.5 ? 0x50d0b0 : initRatio > 0.25 ? 0xe8d098 : 0xe08868;
        this._playerHpBar.setFillStyle(initCol);

        this._hpBarObjs.push(pBg, this._playerHpBar, pLabel, this._playerHpText);

        if (this.practiceMode) {
            const badge = this.add.text(width - 20, 38, 'PRACTICE', {
                font: 'bold 13px monospace', fill: '#e8d098',
                backgroundColor: '#1a2838', padding: { x: 8, y: 4 },
                stroke: '#000', strokeThickness: 2
            }).setOrigin(1, 0.5).setDepth(10);
            this._hpBarObjs.push(badge);
        } else {
            // Vertical heart meter beside the animal
            const HEART_COUNT = 5;
            const heartSize = 18;
            const heartGap = 4;
            const meterX = width - 40;
            const meterBottom = GROUND_Y - 20;

            this._heartIcons = [];
            for (let i = 0; i < HEART_COUNT; i++) {
                const hy = meterBottom - i * (heartSize + heartGap);
                const heart = this.add.text(meterX, hy, '♥', {
                    font: `${heartSize}px monospace`, fill: '#2a3848',
                    stroke: '#1a2838', strokeThickness: 2
                }).setOrigin(0.5).setDepth(10);
                this._heartIcons.push(heart);
                this._hpBarObjs.push(heart);
            }

            const mLabel = this.add.text(meterX, meterBottom + 18, this._entityData.name, {
                font: '9px monospace', fill: '#90c8c0',
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(10);
            this._hpBarObjs.push(mLabel);

            // Update hearts to match initial meter (should be 0)
            this._updateHeartMeter();
        }
    }

    _updateHpBars() {
        if (this._playerHpBar) {
            const pRatio = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
            this._playerHpBar.setScale(pRatio, 1);
            const col = pRatio > 0.5 ? 0x50d0b0 : pRatio > 0.25 ? 0xe8d098 : 0xe08868;
            this._playerHpBar.setFillStyle(col);
            this._playerHpText.setText(`${this.playerStats.hp}/${this.playerStats.maxHp}`);
        }
        this._updateHeartMeter();
    }

    _updateHeartMeter() {
        if (!this._heartIcons || this._heartIcons.length === 0) return;
        const count = this._heartIcons.length;
        const meter = this._entityMeter || 0;
        const filledHearts = (meter / 100) * count;

        for (let i = 0; i < count; i++) {
            const heart = this._heartIcons[i];
            if (!heart || !heart.active) continue;
            if (i < Math.floor(filledHearts)) {
                // Fully filled
                heart.setStyle({ fill: '#ff6688', stroke: '#cc2244', strokeThickness: 2 });
            } else if (i < filledHearts) {
                // Partially filled — show as lighter
                heart.setStyle({ fill: '#cc8899', stroke: '#884466', strokeThickness: 2 });
            } else {
                // Empty
                heart.setStyle({ fill: '#2a3848', stroke: '#1a2838', strokeThickness: 2 });
            }
        }
    }

    /**
     * Spawn a floating heart that rises from the animal when happiness increases.
     */
    _spawnFloatingHeart() {
        const sp = this._entitySprite;
        if (!sp) return;
        const hx = sp.x + (Math.random() - 0.5) * 30;
        const hy = (sp.y || GROUND_Y) - 60;
        const heart = this.add.text(hx, hy, '♥', {
            font: 'bold 22px monospace', fill: '#ff6688',
            stroke: '#cc2244', strokeThickness: 2
        }).setOrigin(0.5).setDepth(15).setAlpha(1);
        this.tweens.add({
            targets: heart,
            y: hy - 60,
            alpha: 0,
            scale: 1.5,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => heart.destroy()
        });
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
        this._clearRhythmReadingUI();
        this._clearCompareUI();
        this._clearNpc();
        this._cancelEncounterTimer();
        if (this._rescuedIcons) {
            this._rescuedIcons.forEach(o => o.destroy());
            this._rescuedIcons = [];
        }
    }

    // ===================== CHALLENGE TYPE SELECTION =====================

    _pickChallengeType() {
        // Single-mode selections
        if (this.mode === 'tones') return 'tone';
        if (this.mode === 'noteReading') return 'noteReading';
        if (this.mode === 'rhythm') return 'rhythm';
        if (this.mode === 'rhythmReading') return 'rhythmReading';

        // Story level system — pick from level's enabled challenge types
        if (this._storyLevel) {
            const types = getLevelChallengeTypes(this._storyLevel);
            return types[Math.floor(Math.random() * types.length)];
        }

        // Story mode — use the entity's specific type; mixed → pick one random type
        if (this.storyBattle && this._entityData) {
            const et = this._getEntityChallengeType();
            if (et === 'tone') return 'tone';
            if (et === 'noteReading') return 'noteReading';
            if (et === 'rhythm') return 'rhythm';
            if (et === 'rhythmReading') return 'rhythmReading';
            // 'mixed' — pick one type for this entire encounter
            return ALL_CHALLENGE_TYPES[Math.floor(Math.random() * ALL_CHALLENGE_TYPES.length)];
        }

        // 'all' mode — one type per entity (picked fresh each spawn)
        return ALL_CHALLENGE_TYPES[Math.floor(Math.random() * ALL_CHALLENGE_TYPES.length)];
    }

    // ===================== QUESTION DISPATCH =====================

    _askQuestion() {
        if (this._gameOverFlag) return;
        this._resetEscapeTimer();
        this._questionActive = false;  // Disable input during transition
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
        // Clear DOM overlays (VexFlow SVG) to prevent accumulation
        this.staffRenderer.clear();
        this.rhythmNotationRenderer.clear();
        this._staffVisible = false;

        switch (type) {
            case 'tone':
                this._clearSolfegeButtons();
                // Reset so tones get a fresh root when they return
                this._droneQuestionsLeft = 0;
                break;
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
            this._droneQuestionsLeft--;
            this._fireTonesQuestion(degrees, width, height);
        }
    }

    _fireTonesQuestion(degrees, width, height) {
        // Avoid repeating the same degree consecutively
        let pick = degrees[Math.floor(Math.random() * degrees.length)];
        if (degrees.length > 1) {
            while (pick === this._lastToneDegree) {
                pick = degrees[Math.floor(Math.random() * degrees.length)];
            }
        }
        this._lastToneDegree = pick;
        this._currentDegree = pick;
        const freq = this.musicTheory.getIntervalFreq(this._currentDegree);

        this._cancelToneReplay();

        this.time.delayedCall(300, () => {
            if (this._gameOverFlag) return;
            this.audioEngine.playInterval(freq, '2n');
            this._buildSolfegeButtons(degrees, width, height);
            this._questionActive = true;

            // Auto-replay tone every 3 seconds until answered
            this._toneReplayTimer = this.time.addEvent({
                delay: 3000,
                callback: () => {
                    if (this._questionActive && this._challengeType === 'tone' && this._currentDegree) {
                        this.audioEngine.playInterval(
                            this.musicTheory.getIntervalFreq(this._currentDegree), '2n'
                        );
                    }
                },
                loop: true
            });
        });
    }

    _cancelToneReplay() {
        if (this._toneReplayTimer) {
            this._toneReplayTimer.remove(false);
            this._toneReplayTimer = null;
        }
    }

    _buildSolfegeButtons(degrees, width, height) {
        // Build the keyboard shell once; afterwards just update labels/highlights
        if (this.solfegeButtons.length === 0) {
            this._buildSolfegeKeyboardShell(width, height);
        }
        this._updateSolfegeKeyboard(degrees);

        this.input.keyboard.once('keydown-SPACE', () => {
            if (this._questionActive && this._challengeType === 'tone') {
                const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
                this.audioEngine.playInterval(freq, '2n');
            }
        });
    }

    /**
     * Build the persistent 2-octave wood keyboard starting from C.
     * Keys are stored in this._solfegeKeyData[] for later updates.
     */
    _buildSolfegeKeyboardShell(width, height) {
        this._clearSolfegeButtons();

        const NUM_WHITE = 14;
        const KEY_W = Math.min(34, (width - 60) / NUM_WHITE);
        const KEY_H = 74;
        const BKEY_W = Math.floor(KEY_W * 0.62);
        const BKEY_H = Math.floor(KEY_H * 0.58);
        const TOTAL_W = NUM_WHITE * KEY_W;
        const kbLeft = width / 2 - TOTAL_W / 2;
        const centerY = height * 0.55;
        const keyTop = centerY - KEY_H / 2;

        const IVORY      = 0xffffff;
        const IVORY_DIM  = 0xcccccc;
        const EBONY      = 0x1a1a1a;
        const EBONY_DIM  = 0x444444;
        const FRAME      = 0x2a2a2a;
        const FRAME_EDGE = 0x111111;

        // Frame
        const frameCX = width / 2;
        const frameCY = keyTop + KEY_H / 2;
        this.solfegeButtons.push(
            this.add.rectangle(frameCX, frameCY, TOTAL_W + 14, KEY_H + 14, FRAME)
                .setStrokeStyle(2, FRAME_EDGE).setDepth(4),
            this.add.rectangle(frameCX, keyTop - 4, TOTAL_W + 10, 3, 0x444444).setDepth(4)
        );

        // Enumerate chromatic keys (always C-based, 2 octaves)
        const startSemi = _NOTE_TO_SEMI['C'];
        this._solfegeKeyData = [];
        let wIdx = 0;

        for (let s = 0; s < 24; s++) {
            const noteName = _SEMI_TO_NOTE[(startSemi + s) % 12];
            const isWhite = _WHITE_NOTES.has(noteName);
            if (isWhite) {
                const cx = kbLeft + wIdx * KEY_W + KEY_W / 2;
                const cy = keyTop + KEY_H / 2;
                const keyRect = this.add.rectangle(cx, cy, KEY_W - 2, KEY_H, IVORY_DIM)
                    .setStrokeStyle(1, 0x888888).setDepth(5);
                const lbl = this.add.text(cx, keyTop + KEY_H - 10, '', {
                    font: 'bold 9px monospace', fill: '#222222', align: 'center'
                }).setOrigin(0.5).setDepth(6);

                this.solfegeButtons.push(keyRect, lbl);
                this._solfegeKeyData.push({
                    noteName, isWhite: true, keyRect, lbl, cx, cy,
                    baseIvory: IVORY, baseDim: IVORY_DIM,
                    hoverColor: 0xe8e8f0,
                });
                wIdx++;
            } else {
                const cx = kbLeft + (wIdx - 0.5) * KEY_W + KEY_W / 2;
                const cy = keyTop + BKEY_H / 2;
                const keyRect = this.add.rectangle(cx, cy, BKEY_W, BKEY_H, EBONY_DIM)
                    .setStrokeStyle(1, 0x000000).setDepth(7);
                const lbl = this.add.text(cx, keyTop + BKEY_H - 8, '', {
                    font: 'bold 8px monospace', fill: '#dddddd', align: 'center'
                }).setOrigin(0.5).setDepth(8);

                this.solfegeButtons.push(keyRect, lbl);
                this._solfegeKeyData.push({
                    noteName, isWhite: false, keyRect, lbl, cx, cy,
                    baseEbony: EBONY, baseDim: EBONY_DIM,
                    hoverColor: 0x3a3a44,
                });
            }
        }

        // Position drone text big and clear above the keyboard
        const kbTopEdge = centerY - KEY_H / 2 - 7;
        this.droneText.setPosition(width / 2, kbTopEdge - 30).setOrigin(0.5, 1)
            .setFontSize(44).setVisible(true);
    }

    /**
     * Update labels, colors, and interactivity on the persistent solfege keyboard.
     * Called each time degrees or root changes.
     */
    _updateSolfegeKeyboard(degrees) {
        if (!this._solfegeKeyData) return;

        const rootNote = this.musicTheory.rootNote;
        const rootSemi = _NOTE_TO_SEMI[rootNote];

        // Update drone text above keyboard
        this.droneText.setText(rootNote).setVisible(true);
        const SEMI_TO_DEG = ['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'];
        const degreeSet = new Set(degrees);
        const ROOT_TINT_WHITE = 0xc0d8f0;   // light blue tint for root white key
        const ROOT_TINT_BLACK = 0x2244aa;    // blue tint for root black key

        this._solfegeKeyData.forEach(kd => {
            const keySemi = _NOTE_TO_SEMI[kd.noteName];
            const offset = (keySemi - rootSemi + 12) % 12;
            const degree = SEMI_TO_DEG[offset];
            const active = degreeSet.has(degree);
            const isRoot = degree === '1';

            // Remove old listeners
            kd.keyRect.removeAllListeners();

            if (kd.isWhite) {
                const baseColor = isRoot ? ROOT_TINT_WHITE : (active ? kd.baseIvory : kd.baseDim);
                kd.keyRect.setFillStyle(baseColor);

                if (active) {
                    kd.keyRect.setInteractive({ useHandCursor: true });
                    kd.keyRect.on('pointerover', () => kd.keyRect.setFillStyle(kd.hoverColor));
                    kd.keyRect.on('pointerout',  () => kd.keyRect.setFillStyle(baseColor));
                    kd.keyRect.on('pointerdown', () => this._submitTone(degree));
                } else {
                    kd.keyRect.disableInteractive();
                }

                const solfege = active ? (SCALE_DEGREES[degree]?.solfege || '') : '';
                const labelText = isRoot ? `${solfege}\n${rootNote}` : solfege;
                kd.lbl.setText(labelText);
            } else {
                const baseColor = isRoot ? ROOT_TINT_BLACK : (active ? kd.baseEbony : kd.baseDim);
                kd.keyRect.setFillStyle(baseColor);

                if (active) {
                    kd.keyRect.setInteractive({ useHandCursor: true });
                    kd.keyRect.on('pointerover', () => kd.keyRect.setFillStyle(kd.hoverColor));
                    kd.keyRect.on('pointerout',  () => kd.keyRect.setFillStyle(baseColor));
                    kd.keyRect.on('pointerdown', () => this._submitTone(degree));
                } else {
                    kd.keyRect.disableInteractive();
                }

                const solfege = active ? (SCALE_DEGREES[degree]?.solfege || '') : '';
                const labelText = isRoot ? `${solfege}\n${rootNote}` : solfege;
                kd.lbl.setText(labelText);
            }
        });
    }

    // ── Wood keyboard helpers ────────────────────────────────────────────────

    /**
     * Build a 2-octave wood-styled keyboard.
     * @param {string}   startNote   White note to start on (e.g. 'C', 'A')
     * @param {number}   width       Scene width
     * @param {number}   height      Scene height
     * @param {Array}    targetArray Array to push game objects into for cleanup
     * @param {Function} onKeyPress  Called with keyData when a key is clicked
     * @param {Function} labelFn     Returns label string or null for a key
     * @param {Function} isActiveFn  Returns true if the key should be interactive
     * @param {object}   [opts]      Optional: { centerY } to vertically center the keyboard
     */
    _buildWoodKeyboard(startNote, width, height, targetArray, onKeyPress, labelFn, isActiveFn, opts) {
        const NUM_WHITE = 14;
        const KEY_W = Math.min(34, (width - 60) / NUM_WHITE);
        const KEY_H = 74;
        const BKEY_W = Math.floor(KEY_W * 0.62);
        const BKEY_H = Math.floor(KEY_H * 0.58);
        const TOTAL_W = NUM_WHITE * KEY_W;
        const kbLeft = width / 2 - TOTAL_W / 2;
        const keyTop = opts?.centerY ? opts.centerY - KEY_H / 2 : height - KEY_H - 8;

        // Classic piano colors
        const IVORY       = 0xffffff;
        const IVORY_HOVER = 0xe8e8f0;
        const IVORY_DIM   = 0xcccccc;
        const EBONY       = 0x1a1a1a;
        const EBONY_HOVER = 0x3a3a44;
        const EBONY_DIM   = 0x444444;
        const FRAME       = 0x2a2a2a;
        const FRAME_EDGE  = 0x111111;

        // Frame behind the keys
        const frameCX = width / 2;
        const frameCY = keyTop + KEY_H / 2;
        const frameBg = this.add.rectangle(frameCX, frameCY, TOTAL_W + 14, KEY_H + 14, FRAME)
            .setStrokeStyle(2, FRAME_EDGE).setDepth(4);
        const frameHL = this.add.rectangle(frameCX, keyTop - 4, TOTAL_W + 10, 3, 0x444444)
            .setDepth(4);
        targetArray.push(frameBg, frameHL);

        // Enumerate chromatic keys for 2 octaves (24 semitones)
        const startSemi = _NOTE_TO_SEMI[startNote];
        const whiteKeys = [];
        const blackKeys = [];
        let wIdx = 0;

        for (let s = 0; s < 24; s++) {
            const noteName = _SEMI_TO_NOTE[(startSemi + s) % 12];
            if (_WHITE_NOTES.has(noteName)) {
                whiteKeys.push({ noteName, semiFromStart: s, whiteIdx: wIdx++ });
            } else {
                blackKeys.push({ noteName, semiFromStart: s, afterWhiteIdx: wIdx - 1 });
            }
        }

        // Draw white keys
        whiteKeys.forEach(kd => {
            const cx = kbLeft + kd.whiteIdx * KEY_W + KEY_W / 2;
            const cy = keyTop + KEY_H / 2;
            const active = isActiveFn(kd);
            const baseColor = active ? IVORY : IVORY_DIM;

            const key = this.add.rectangle(cx, cy, KEY_W - 2, KEY_H, baseColor)
                .setStrokeStyle(1, 0x888888).setDepth(5);
            targetArray.push(key);

            const label = labelFn(kd);
            if (label) {
                const lbl = this.add.text(cx, keyTop + KEY_H - 10, label, {
                    font: 'bold 9px monospace', fill: '#222222', align: 'center'
                }).setOrigin(0.5).setDepth(6);
                targetArray.push(lbl);
            }

            if (active) {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerover', () => key.setFillStyle(IVORY_HOVER));
                key.on('pointerout',  () => key.setFillStyle(baseColor));
                key.on('pointerdown', () => onKeyPress(kd));
            }
        });

        // Draw black keys (on top)
        blackKeys.forEach(kd => {
            const cx = kbLeft + (kd.afterWhiteIdx + 0.5) * KEY_W + KEY_W / 2;
            const cy = keyTop + BKEY_H / 2;
            const active = isActiveFn(kd);
            const baseColor = active ? EBONY : EBONY_DIM;

            const key = this.add.rectangle(cx, cy, BKEY_W, BKEY_H, baseColor)
                .setStrokeStyle(1, 0x000000).setDepth(7);
            targetArray.push(key);

            const label = labelFn(kd);
            if (label) {
                const lbl = this.add.text(cx, keyTop + BKEY_H - 8, label, {
                    font: 'bold 8px monospace', fill: '#dddddd', align: 'center'
                }).setOrigin(0.5).setDepth(8);
                targetArray.push(lbl);
            }

            if (active) {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerover', () => key.setFillStyle(EBONY_HOVER));
                key.on('pointerout',  () => key.setFillStyle(baseColor));
                key.on('pointerdown', () => onKeyPress(kd));
            }
        });
    }

    _submitTone(selected) {
        if (!this._questionActive) return;
        this._questionActive = false;
        this._cancelToneReplay();

        const correct = selected === this._currentDegree;
        const info = SCALE_DEGREES[this._currentDegree];
        this._handleAnswer(correct, correct
            ? `Correct! ${info?.solfege}`
            : `Wrong! It was ${info?.solfege}`
        );
    }

    _getTonesPool() {
        // Story level system — use level's tone degrees
        if (this._storyLevel?.tones?.degrees?.length) {
            return this._storyLevel.tones.degrees;
        }

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
        // Story level system — use instrument profile for clef + range
        if (this._storyLevel?.noteReading) {
            const nr = this._storyLevel.noteReading;
            const instConfig = getInstrumentNoteConfig(this._instrumentId, this._storyLevel.id);
            return { posRange: instConfig.posRange, accidentals: nr.accidentals || false, clef: instConfig.clef };
        }

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
        // Use instrument-derived clef if available, otherwise fall back to scene setting
        const clefForQuestion = noteConfig?.clef || this.clefSetting;
        this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, clefForQuestion, noteConfig);
        if (!this._currentNoteQuestion) {
            this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, clefForQuestion);
            if (!this._currentNoteQuestion) {
                console.warn('NoteReading: buildQuestion returned null, falling back to tone');
                this._challengeType = 'tone';
                this._askTone();
                return;
            }
        }

        const staffCX = width / 2;
        const staffCY = height * 0.22;
        this.staffRenderer.draw(staffCX, staffCY, 340, this._currentNoteQuestion);

        this.messageText.setY(GROUND_Y + 16);

        if (this.pianoKeys.length === 0) {
            // Place keyboard directly below the staff with a small gap
            const keyboardCenterY = staffCY + 130;
            this._buildPianoKeys(width, height, keyboardCenterY);
        }
        this._staffVisible = true;
        this._questionActive = true;
    }

    _buildPianoKeys(width, height, centerY) {
        this._clearPianoKeys();

        // Note reading keyboard: 2 octaves starting from C
        // Only label white keys — user can infer sharps/flats
        this._buildWoodKeyboard('C', width, height, this.pianoKeys, (kd) => {
            this._submitNoteReading(kd.noteName);
        }, (kd) => {
            return _WHITE_NOTES.has(kd.noteName) ? kd.noteName : null;
        }, () => true, centerY ? { centerY } : undefined);
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
        this._cancelToneReplay();
        this.solfegeButtons.forEach(b => b.destroy());
        this.solfegeButtons = [];
        this._solfegeKeyData = null;
        this._lastDegreesKey = null;
    }

    // ===================== RHYTHM =====================

    _askRhythm() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        // Pick time signature and subdivision from level config or defaults
        let timeSig = '4/4';
        let subKey;

        if (this._storyLevel?.rhythm) {
            const lr = this._storyLevel.rhythm;
            const sigs = lr.timeSigs?.length ? lr.timeSigs : ['4/4'];
            timeSig = sigs[Math.floor(Math.random() * sigs.length)];
            subKey = pickSubdivision(timeSig, lr.subdivisions || ['quarter']);
        } else if (this.gradual) {
            const available = ['quarter'];
            if (this.session.round >= 10) available.push('eighth');
            if (this.session.round >= 20) available.push('sixteenth');
            if (this.session.round >= 30) available.push('triplet');
            subKey = available[Math.floor(Math.random() * available.length)];
            // Gradual time signature progression
            const availSigs = ['4/4'];
            if (this.session.round >= 5) availSigs.push('2/4', '3/4');
            if (this.session.round >= 15) availSigs.push('6/8');
            if (this.session.round >= 25) availSigs.push('9/8', '12/8');
            if (this.session.round >= 35) availSigs.push('3/8');
            if (subKey === 'triplet') {
                // Triplet subdivision only works in compound meters
                const compoundSigs = availSigs.filter(s => TIME_SIG_INFO[s]?.compound);
                timeSig = compoundSigs.length ? compoundSigs[Math.floor(Math.random() * compoundSigs.length)] : '12/8';
                subKey = 'eighth'; // compound eighth = triplet feel
            } else {
                timeSig = availSigs[Math.floor(Math.random() * availSigs.length)];
                subKey = pickSubdivision(timeSig, [subKey]);
            }
        } else {
            const subs = this.customRhythmSubs;
            subKey = subs[Math.floor(Math.random() * subs.length)];
            if (subKey === 'triplet') {
                timeSig = '12/8';
                subKey = 'eighth';
            }
        }

        // Build subdivision config from time sig + note value
        const tsInfo = TIME_SIG_INFO[timeSig];
        let sub = buildSubdivision(timeSig, subKey);
        if (!sub) {
            // Fallback to legacy 4/4 subdivisions
            sub = RHYTHM_SUBDIVISIONS[subKey] || RHYTHM_SUBDIVISIONS.quarter;
        }

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
        this._rhythmTimeSig = timeSig;
        this._rhythmTimeSigInfo = tsInfo || null;
        this._rhythmCells = cells;
        this._rhythmCellMs = cellMs;
        this._userRhythm = new Array(cells).fill(0);
        this._nextRhythmGroupId = 1;
        this._rhythmPlaying = false;
        this._rhythmPlayTimer = null;

        this._buildRhythmUI(width, height);
        this._questionActive = true;
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
            font: 'bold 14px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this.rhythmUI.push(title);

        const g = this.add.graphics().setDepth(4);
        if (gridVisible) {
            g.lineStyle(1, 0x999999, 0.6);
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

            const bg = this.add.rectangle(cx, cy, cellW, cellH, 0xffffff)
                .setStrokeStyle(1, 0xbbbbbb).setDepth(5);
            if (gridVisible) {
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerdown', () => this._onRhythmCellDown(i));
                bg.on('pointerover', () => { if (this._questionActive) bg.setStrokeStyle(2, 0x4488cc); });
                bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xbbbbbb));
            } else {
                bg.setVisible(false);
            }

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 16px monospace' : '13px monospace',
                fill: isDB ? '#222222' : '#888888'
            }).setOrigin(0.5).setDepth(6);
            if (!gridVisible) lbl.setVisible(false);

            this._rhythmCellRects.push(bg);
            this._rhythmCellLabels.push(lbl);
            this._rhythmCellCenters.push({ x: cx, y: cy });
            this.rhythmUI.push(bg, lbl);
        }

        this._setupRhythmKeyboard(n, gridX, gridY, cellW, cellH);

        const btnY = gridY + cellH + 70;
        this._rhythmPlayBtn = this._makeBtn(width / 2 - 90, btnY, '▶ STOP', '#142030', '#224455',
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
            onUpdate: (grid) => {
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
                font: '10px monospace', fill: '#687880'
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

            this._rhythmCellRects[i].setFillStyle(isNote ? 0xe0e0e0 : 0xffffff);

            const lbl = this._rhythmCellLabels[i];
            if (lbl) {
                if (isNote && !isGroupStart) {
                    lbl.setStyle({ fill: '#555555' });
                } else if (isNote) {
                    lbl.setStyle({ fill: '#222222' });
                } else {
                    lbl.setStyle({ fill: '#aaaaaa' });
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
        try {
            const { width } = this.cameras.main;
            const tsInfo = this._rhythmTimeSigInfo || null;
            let spelled = spellPattern(this._userRhythm, this._rhythmSubKey, tsInfo);
            const cursorTick = this._rhythmKeyboard ? this._rhythmKeyboard._cursorTick : -1;
            const selectedTicks = this._rhythmKeyboard ? this._rhythmKeyboard.effectiveTicks : -1;
            if (cursorTick >= 0 && selectedTicks > 0) {
                spelled = splitRestsAtCursor(spelled, cursorTick, selectedTicks, this._rhythmSubKey, tsInfo);
            }
            const notationY = this._rNotationY || (this._rGridY - 108);
            this.rhythmNotationRenderer.render(spelled, this._rhythmSubKey, width / 2, notationY, width - 100, cursorTick, tsInfo);
        } catch (err) {
            console.error('_renderRhythmNotation error:', err);
        }
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
        const n = pattern.length;
        const noteCount = pattern.filter(Boolean).length;

        // Hits: user has ANY note (onset or sustained) where pattern has a note
        let hits = 0;
        for (let i = 0; i < n; i++) {
            if (pattern[i] && userGrid[i] > 0) hits++;
        }

        // Extra onsets: user starts a NEW note group at a rest position
        // (sustain through rests is forgiven, but new onsets at rests penalize)
        let extraOnsets = 0;
        for (let i = 0; i < n; i++) {
            if (!pattern[i] && userGrid[i] > 0) {
                const isOnset = (i === 0 || userGrid[i - 1] !== userGrid[i]);
                if (isOnset) extraOnsets++;
            }
        }

        const score = Math.max(0, hits - extraOnsets);
        const accuracy = score / Math.max(1, noteCount);
        const correct = accuracy >= 0.80;
        const pct = Math.round(accuracy * 100);

        const perfect = pct === 100;

        if (correct) {
            this.audioEngine.playCorrect();
            this.session.streak++;
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
                this.session.correctAnswers = (this.session.correctAnswers || 0) + 1;
                this._entityMeter = 100;
                this._updateHpBars();
                this._spawnFloatingHeart();
                this._showFlash('#50d0b0');
                this._storyEntityDone = true;
                this._addToRescuedPreview(
                    this._entityData?.spriteKey || `villager-${this._entityKey}`,
                    this._entityData?.name || 'Friend'
                );
            }
        } else {
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
            }
            if (!this.practiceMode && !this.storyBattle) {
                if (this._applyWrongDamage()) {
                    this._clearRhythmUI();
                    return;
                }
            }
        }

        // Correct: auto-advance after brief feedback
        if (correct) {
            this._clearRhythmUI();
            this.messageText.setText(`${pct}% — ${perfect ? 'Perfect!' : 'Correct!'}`);
            this._showFlash('#50d0b0');
            if (this.storyBattle) {
                this.time.delayedCall(500, () => this._animalFlyOff('happy'));
            } else if (this.practiceMode) {
                this.time.delayedCall(600, () => this._askQuestion());
            } else {
                this.time.delayedCall(600, () => this._handleAnswer(true, `${pct}% correct!`));
            }
            this._updateHud();
            return;
        }

        // Wrong: show compare review with Play Mine / Play Answer / Next Question
        const onContinue = () => {
            this._clearRhythmUI();
            if (this.storyBattle) {
                this.time.delayedCall(300, () => this._animalFlyOff('sad'));
            } else if (this.practiceMode) {
                this.time.delayedCall(300, () => this._askQuestion());
            } else {
                this._handleAnswer(false, `${pct}%`);
            }
        };
        this._showRhythmCompareUI(pct, {
            correct: false,
            onContinue,
            userPattern: this._userRhythm.map(v => v > 0),
            answerPattern: this._rhythmPattern,
            sub: this._rhythmSub,
            cellMs: this._rhythmCellMs,
            onCleanup: () => this._stopRhythmPlayback(),
            colorCells: () => {
                if (!this.showGrid) return;
                const pattern = this._rhythmPattern;
                for (let i = 0; i < this._rhythmCells; i++) {
                    if (!this._rhythmCellRects[i]) continue;
                    const patNote = pattern[i];
                    const userNote = this._userRhythm[i] > 0;
                    let match;
                    if (patNote) {
                        match = userNote;
                    } else {
                        const isOnset = userNote && (i === 0 || this._userRhythm[i - 1] !== this._userRhythm[i]);
                        match = !isOnset;
                    }
                    this._rhythmCellRects[i].setFillStyle(match ? 0xbbeecc : 0xffcccc);
                }
            },
        });
        this._updateHud();
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


    /**
     * Story mode: show compare UI after wrong rhythm transcription.
     * Lets player hear their rhythm vs the answer before animal flees.
     */
    /**
     * Unified compare UI for both rhythm transcription and rhythm reading.
     * Shows Play Mine / Play Answer / Next Question buttons.
     * @param {number} pct - accuracy percentage
     * @param {object} opts
     * @param {boolean} opts.correct - whether the answer was correct
     * @param {function} opts.onContinue - called when user presses Next Question
     * @param {boolean[]} opts.userPattern - user's rhythm as boolean array
     * @param {boolean[]} opts.answerPattern - correct rhythm as boolean array
     * @param {object} opts.sub - subdivision info (has .downbeats)
     * @param {number} opts.cellMs - milliseconds per cell
     * @param {function} [opts.colorCells] - optional callback to color grid cells
     * @param {function} [opts.onCleanup] - extra cleanup on continue (e.g. stop playback)
     */
    _showRhythmCompareUI(pct, opts = {}) {
        const { correct = false, onContinue, userPattern, answerPattern, sub, cellMs, colorCells, onCleanup } = opts;

        if (!correct) {
            this.audioEngine.playWrong();
            this.session.streak = 0;
            this._showFlash('#e08868');
        }
        this._cancelEscapeTimer();

        if (colorCells) colorCells();

        const label = correct ? `${pct}% — Correct! Review:` : `${pct}% — Compare and listen:`;
        this.messageText.setText(label);

        const { width, height } = this.cameras.main;
        const btnY = height * 0.88;
        const btnStyle = { fontSize: '20px', fill: '#ffffff', backgroundColor: '#335566',
                           padding: { x: 16, y: 8 }, align: 'center' };

        const playMineBtn = this.add.text(width * 0.25, btnY, 'Play Mine', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        const playAnswerBtn = this.add.text(width * 0.5, btnY, 'Play Answer', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        const continueBtn = this.add.text(width * 0.75, btnY, 'Next Question', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });

        this._compareUI = [playMineBtn, playAnswerBtn, continueBtn];

        const self = this;
        const playPattern = (pat) => {
            if (onCleanup) onCleanup();
            if (self._comparePlayTimer) { self._comparePlayTimer.remove(false); self._comparePlayTimer = null; }
            let i = 0;
            const tick = () => {
                if (sub?.downbeats?.includes(i)) self.audioEngine.playClick(i === 0);
                if (pat[i]) self.audioEngine.playDrumNote();
                i++;
                if (i < pat.length) {
                    self._comparePlayTimer = self.time.delayedCall(cellMs, tick);
                }
            };
            tick();
        };

        playMineBtn.on('pointerdown', () => playPattern(userPattern));
        playAnswerBtn.on('pointerdown', () => playPattern(answerPattern));

        continueBtn.on('pointerdown', () => {
            if (onCleanup) onCleanup();
            if (this._comparePlayTimer) { this._comparePlayTimer.remove(false); this._comparePlayTimer = null; }
            this._clearCompareUI();
            if (onContinue) onContinue();
        });
    }

    _clearCompareUI() {
        if (this._compareUI) {
            this._compareUI.forEach(o => o.destroy());
            this._compareUI = [];
        }
        if (this._comparePlayTimer) {
            this._comparePlayTimer.remove(false);
            this._comparePlayTimer = null;
        }
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
        try { return this._askRhythmReadingInner(); } catch (err) {
            console.error('_askRhythmReading error:', err);
            // Recover: skip to next question
            this._clearRhythmReadingUI();
            this.time.delayedCall(300, () => this._askQuestion());
        }
    }

    _askRhythmReadingInner() {
        this._clearRhythmReadingUI();
        this._stopRhythmPlayback();

        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        this._rrBpm       = 72 + Math.floor(Math.random() * 61);
        this._rrQuarterMs = 60000 / this._rrBpm;

        // Pick time signature and subdivision from level config or defaults
        let timeSig = '4/4';
        let subKey;

        if (this._storyLevel?.rhythm) {
            const lr = this._storyLevel.rhythm;
            const sigs = lr.timeSigs?.length ? lr.timeSigs : ['4/4'];
            timeSig = sigs[Math.floor(Math.random() * sigs.length)];
            subKey = pickSubdivision(timeSig, lr.subdivisions || ['quarter']);
        } else if (this.gradual) {
            const available = ['quarter'];
            if (this.session.round >= 10) available.push('eighth');
            if (this.session.round >= 20) available.push('sixteenth');
            if (this.session.round >= 30) available.push('triplet');
            subKey = available[Math.floor(Math.random() * available.length)];
            // Gradual time signature progression
            const availSigs = ['4/4'];
            if (this.session.round >= 5) availSigs.push('2/4', '3/4');
            if (this.session.round >= 15) availSigs.push('6/8');
            if (this.session.round >= 25) availSigs.push('9/8', '12/8');
            if (this.session.round >= 35) availSigs.push('3/8');
            if (subKey === 'triplet') {
                const compoundSigs = availSigs.filter(s => TIME_SIG_INFO[s]?.compound);
                timeSig = compoundSigs.length ? compoundSigs[Math.floor(Math.random() * compoundSigs.length)] : '12/8';
                subKey = 'eighth';
            } else {
                timeSig = availSigs[Math.floor(Math.random() * availSigs.length)];
                subKey = pickSubdivision(timeSig, [subKey]);
            }
        } else {
            const subs = this.customRhythmSubs;
            subKey = subs[Math.floor(Math.random() * subs.length)];
            if (subKey === 'triplet') {
                timeSig = '12/8';
                subKey = 'eighth';
            }
        }

        const tsInfo = TIME_SIG_INFO[timeSig];
        let sub = buildSubdivision(timeSig, subKey);
        if (!sub) {
            sub = RHYTHM_SUBDIVISIONS[subKey] || RHYTHM_SUBDIVISIONS.quarter;
        }
        const n      = sub.cells.length;
        const cellMs = this._rrQuarterMs * sub.cellFraction;

        this._rrSubKey  = subKey;
        this._rrSub     = sub;
        this._rrTimeSig = timeSig;
        this._rrTimeSigInfo = tsInfo || null;
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

        // Build groupGrid: each onset starts a new group, non-onset cells
        // sustain the previous note so notation shows ties instead of rests.
        let gid = 0;
        const groupGrid = pattern.map((v) => {
            if (v) gid++;
            return gid;   // non-onset cells inherit previous group (sustain)
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

        let spelled = [];
        try {
            spelled = spellPattern(groupGrid, subKey, tsInfo);
            this.rhythmNotationRenderer.render(spelled, subKey, width / 2, height * 0.22, width - 80, -1, tsInfo);
        } catch (err) {
            console.error('RhythmReading notation error:', err);
        }

        const title = this.add.text(width / 2, height * 0.22 - 68, 'SIGHT-TAP THIS RHYTHM', {
            font: 'bold 14px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(title);

        const bpmLabel = tsInfo?.compound ? `\u2669.= ${this._rrBpm}` : `\u2669= ${this._rrBpm}`;
        const bpmTxt = this.add.text(width / 2, height * 0.22 + 65, bpmLabel, {
            font: '12px monospace', fill: '#687880', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(bpmTxt);

        this._buildRrGrid(width, height);

        const hint = this.add.text(width / 2, height * 0.40 + 42 + 14,
            'SPACE or MIDI: tap on every note onset', {
            font: '11px monospace', fill: '#687880'
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(hint);

        this._rrKeyHandler = (e) => {
            if (e.code === 'Space') { e.preventDefault(); this._onRrTap(); }
        };
        document.addEventListener('keydown', this._rrKeyHandler);

        this._questionActive = true;

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
        g.lineStyle(1, 0x999999, 0.6);
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
                isNote ? 0xe8e8e8 : 0xffffff)
                .setStrokeStyle(1, isNote ? 0x999999 : 0xcccccc)
                .setDepth(5).setVisible(false);

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 14px monospace' : '11px monospace',
                fill: isNote ? '#222222' : '#aaaaaa'
            }).setOrigin(0.5).setDepth(6).setVisible(false);

            this._rrCellRects.push(bg);
            this._rrCellLabels.push(lbl);
            this._rrUI.push(bg, lbl);
        }
    }

    _startRrRound() {
        if (this._rrState !== 'idle' || this._gameOverFlag) return;
        this._rrState = 'countdown';
        this._rrTaps  = [];

        const sub    = this._rrSub;
        const cellMs = this._rrCellMs;
        const n      = this._rrCells;
        const COUNT_IN = 4;

        for (let b = 0; b < COUNT_IN; b++) {
            this._rrSchedule(() => {
                this.messageText.setText(b < COUNT_IN - 1 ? `${COUNT_IN - b}...` : 'TAP!')
                    .setStyle({ fill: '#e8d098' });
                this.audioEngine.playClick(b === 0);
            }, b * this._rrQuarterMs);
        }

        this._rrSchedule(() => {
            this._rrState    = 'recording';
            this._rrBarStart = performance.now();
            this.messageText.setText('TAP!').setStyle({ fill: '#50d0b0' });

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
        this._cancelEscapeTimer();

        const cellMs   = this._rrCellMs;
        const tol      = Math.max(140, Math.min(350, cellMs * 0.55));
        const latency  = this.tapLatencyMs || 0;
        const adjusted = this._rrTaps.map(t => t - latency);
        const expected = this._rrOnsetCells.map(i => i * cellMs);

        // DP optimal matching: find maximum onset-tap matches in order
        const nExp = expected.length;
        const nTap = adjusted.length;
        const dp = Array.from({ length: nExp + 1 }, () => new Array(nTap + 1).fill(0));
        const dpMatch = Array.from({ length: nExp + 1 }, () => new Array(nTap + 1).fill(false));

        for (let e = 1; e <= nExp; e++) {
            for (let t = 1; t <= nTap; t++) {
                dp[e][t] = Math.max(dp[e][t - 1], dp[e - 1][t]);
                dpMatch[e][t] = false;
                const dist = Math.abs(adjusted[t - 1] - expected[e - 1]);
                if (dist < tol && dp[e - 1][t - 1] + 1 > dp[e][t]) {
                    dp[e][t] = dp[e - 1][t - 1] + 1;
                    dpMatch[e][t] = true;
                }
            }
        }

        // Backtrack to find which taps/onsets matched
        const usedTaps = new Set();
        const hitOnsets = new Set();
        let ei = nExp, ti = nTap;
        while (ei > 0 && ti > 0) {
            if (dpMatch[ei][ti]) {
                usedTaps.add(ti - 1);
                hitOnsets.add(ei - 1);
                ei--; ti--;
            } else if (dp[ei][ti - 1] >= dp[ei - 1][ti]) {
                ti--;
            } else {
                ei--;
            }
        }
        const results = expected.map((_, i) => ({ hit: hitOnsets.has(i) }));

        const hits      = results.filter(r => r.hit).length;
        const total     = expected.length;
        const extraTaps = this._rrTaps.length - usedTaps.size;
        const accuracy  = hits / Math.max(1, total);
        const pct       = Math.round(accuracy * 100);

        this._rrCellRects.forEach(r => r?.setVisible(true));
        this._rrCellLabels.forEach(l => l?.setVisible(true));

        for (let i = 0; i < this._rrCells; i++) {
            const isNote = this._rrPattern[i];
            this._rrCellRects[i]?.setFillStyle(isNote ? 0xdddddd : 0xf0f0f0)
                .setStrokeStyle(1, isNote ? 0x999999 : 0xcccccc);
            if (this._rrCellLabels[i]) {
                this._rrCellLabels[i].setStyle({
                    fill: isNote ? '#555555' : '#aaaaaa'
                });
            }
        }

        results.forEach((res, ei) => {
            const cell = this._rrOnsetCells[ei];
            if (res.hit) {
                this._rrCellRects[cell]?.setFillStyle(0xd4f5d4).setStrokeStyle(2, 0x44aa66);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#226633' });
            } else {
                this._rrCellRects[cell]?.setFillStyle(0xffe0cc).setStrokeStyle(2, 0xff8800);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#cc5500' });
            }
        });

        this._rrTaps.forEach((tap, ti) => {
            if (!usedTaps.has(ti)) {
                const cell = Math.min(this._rrCells - 1, Math.max(0, Math.floor((tap - latency) / cellMs)));
                this._rrCellRects[cell]?.setFillStyle(0xffcccc).setStrokeStyle(2, 0xdd3333);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#cc2222' });
            }
        });

        const passed   = accuracy >= 0.80 && extraTaps <= Math.max(1, Math.floor(total * 0.3));
        const extraStr = extraTaps > 0 ? `  +${extraTaps} extra` : '';
        const msg      = `${pct}%  ${hits}/${total}${extraStr}`;

        // Apply effects based on result
        if (passed) {
            this.audioEngine.playCorrect();
            this.session.streak++;
            this._showFlash('#50d0b0');
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
                this.session.correctAnswers = (this.session.correctAnswers || 0) + 1;
                this._entityMeter = 100;
                this._updateHpBars();
                this._spawnFloatingHeart();
                this._storyEntityDone = true;
                this._addToRescuedPreview(
                    this._entityData?.spriteKey || `villager-${this._entityKey}`,
                    this._entityData?.name || 'Friend'
                );
            }
        } else {
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
            }
            if (!this.practiceMode && !this.storyBattle) {
                if (this._applyWrongDamage()) {
                    this._clearRhythmReadingUI();
                    return;
                }
            }
        }

        // Always show review for rhythm reading
        const onContinue = () => {
            this._clearRhythmReadingUI();
            if (this.storyBattle) {
                if (passed) {
                    this.time.delayedCall(300, () => this._animalFlyOff('happy'));
                } else {
                    this.time.delayedCall(300, () => this._animalFlyOff('sad'));
                }
            } else if (this.practiceMode) {
                this.time.delayedCall(300, () => this._askQuestion());
            } else {
                this._handleAnswer(passed, msg);
            }
        };
        // Reconstruct user taps as cell pattern for compare playback
        const userTapPattern = new Array(this._rrCells).fill(false);
        this._rrTaps.forEach(t => {
            const cell = Math.round((t - latency) / cellMs);
            if (cell >= 0 && cell < userTapPattern.length) userTapPattern[cell] = true;
        });

        this._showRhythmCompareUI(pct, {
            correct: passed,
            onContinue,
            userPattern: userTapPattern,
            answerPattern: this._rrPattern,
            sub: this._rrSub,
            cellMs,
        });
        this._updateHud();
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
            this._showFlash('#50d0b0');
            this._onCorrectHit();
        } else {
            this.audioEngine.playWrong();
            this.session.streak = 0;

            this.messageText.setText(message);
            this._showFlash('#e08868');

            if (!this.practiceMode) {
                if (this._applyWrongDamage()) return;
            }

            if (this.practiceMode) {
                // Practice mode: always advance to a fresh question for all types
                this._onWrongEffect();
            } else if (this._challengeType === 'tone' || this._challengeType === 'noteReading') {
                // Story mode: retry same question — re-enable input immediately
                this._questionActive = true;
                this.messageText.setText('Try again...');
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

            // Story level progression
            if (this._storyLevel) {
                this.progression.recordStoryEncounter();
                const newLevel = this.progression.advanceStoryLevel(this._storyLevel.encountersToAdvance);
                if (newLevel) {
                    this._levelUpTo = newLevel; // show level-up message in victory UI
                }
            }

            this.progression.save(this.playerStats);
        }

        this.add.rectangle(width / 2, height / 2, 360, 200, 0x142030, 0.95)
            .setStrokeStyle(2, 0x50d0b0).setDepth(60);
        this.add.text(width / 2, height / 2 - 65, cfg.title, {
            font: 'bold 30px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width / 2, height / 2 - 25, cfg.rewardLabel(xp, gold), {
            font: '18px monospace', fill: '#e8d098', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61);
        const accuracy = (this.session.totalAnswers || 0) > 0
            ? Math.round(((this.session.correctAnswers || 0) / this.session.totalAnswers) * 100) : 0;
        this.add.text(width / 2, height / 2 + 5, `Accuracy: ${accuracy}%`, {
            font: '14px monospace', fill: '#90c8c0'
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width / 2, height / 2 + 30, cfg.playerLabel(this.playerStats), {
            font: '13px monospace', fill: '#90c8c0'
        }).setOrigin(0.5).setDepth(61);

        // Story level-up announcement
        if (this._levelUpTo) {
            const nextLevel = getStoryLevel(this._levelUpTo);
            const lvlText = nextLevel ? `Level ${this._levelUpTo}: ${nextLevel.title}` : `Level ${this._levelUpTo}`;
            this.add.text(width / 2, height / 2 + 50, `NEW LEVEL — ${lvlText}`, {
                font: 'bold 14px monospace', fill: '#f0e060',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(61);
        }

        const btnY = this._levelUpTo ? height / 2 + 80 : height / 2 + 70;
        this._makeBtn(width / 2, btnY, 'CONTINUE', '#113311', '#225522', () => {
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

        // Dark overlay for cozy nighttime feel
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0e18, 0.85).setDepth(59);

        // Bed with character tucked in: character behind bed, head peeking out top
        const bedX = width / 2;
        const bedY = height * 0.30;
        const ck = this._charKey || 'avatar';
        if (this.textures.exists('bed')) {
            this.add.image(bedX, bedY - 9, 'bed').setScale(3.6).setDepth(60);
        }
        this.add.sprite(bedX, bedY - 43, `player-${ck}`, 0)
            .setScale(3.2).setOrigin(0.5, 0.5).setDepth(61);

        // Zzz floating text
        const zzz = this.add.text(bedX + 40, bedY - 70, 'z z z', {
            font: 'bold 22px monospace', fill: '#e8d098',
            stroke: '#0a0e18', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61).setAlpha(0.7);
        this.tweens.add({
            targets: zzz, y: zzz.y - 20, alpha: 0.3,
            duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        this.add.text(width / 2, height * 0.52, cfg.title, {
            font: 'bold 24px monospace', fill: cfg.titleColor,
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width / 2, height * 0.62, cfg.message, {
            font: '13px monospace', fill: cfg.messageColor,
            align: 'center'
        }).setOrigin(0.5).setDepth(61);

        this._makeBtn(width / 2, height * 0.76, 'CONTINUE', cfg.btnBg, cfg.btnHover, () => {
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

        const returnKey = this.returnScene || 'ArcadeMenuScene';
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

        // Dark nighttime overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0e18, 0.85).setDepth(59);

        // Bed with character tucked in: character behind bed, head peeking out top
        const bedX = width / 2;
        const bedY = height * 0.18;
        const ck = this._charKey || 'avatar';
        if (this.textures.exists('bed')) {
            this.add.image(bedX, bedY - 9, 'bed').setScale(3.6).setDepth(60);
        }
        this.add.sprite(bedX, bedY - 43, `player-${ck}`, 0)
            .setScale(3.2).setOrigin(0.5, 0.5).setDepth(61);
        const zzz = this.add.text(bedX + 40, bedY - 60, 'z z z', {
            font: 'bold 22px monospace', fill: '#e8d098',
            stroke: '#0a0e18', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61).setAlpha(0.7);
        this.tweens.add({
            targets: zzz, y: zzz.y - 15, alpha: 0.3,
            duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        this.add.text(width / 2, height * 0.36, cfg.title, {
            font: 'bold 22px monospace', fill: cfg.titleColor,
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.44, cfg.message, {
            font: '13px monospace', fill: cfg.messageColor,
            align: 'center'
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.54, `Score: ${this.session.score}`, {
            font: 'bold 26px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.61, `${cfg.entityLabel}: ${this.session.entitiesDefeated}`, {
            font: '18px monospace', fill: '#50d0b0',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61);

        this.add.text(width / 2, height * 0.68, `Rounds: ${this.session.round}`, {
            font: '16px monospace', fill: '#e8d098',
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

        this._makeBtn(width / 2 + 110, height * 0.82, 'MENU', '#142030', '#243848', () => {
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
            font: 'bold 13px monospace', fill: '#90c8c0',
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
            font: 'bold 18px monospace', fill: '#e8f0f0',
            backgroundColor: bgColor, padding: { x: 18, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverColor }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bgColor }));
        btn.on('pointerdown', cb);
        return btn;
    }

    _returnToSource() {
        if (this.isSidescrollMode) {
            const returnKey = this.returnScene || 'ArcadeMenuScene';
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
        } else {
            this.scene.start('ArcadeMenuScene', { playerData: this.playerData });
        }
    }

    // ===================== PRACTICE MODE NPC =====================

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
        const bubbleY = GROUND_Y + 46;

        const bg = this.add.rectangle(bubbleX, bubbleY, bubbleW, bubbleH, 0x142030, 0.93)
            .setStrokeStyle(2, 0x90c8c0).setDepth(8);
        const label = this.add.text(bubbleX, bubbleY - bubbleH / 2 + 8, 'TIP', {
            font: 'bold 10px monospace', fill: '#90c8c0'
        }).setOrigin(0.5, 0).setDepth(9);
        const text = this.add.text(bubbleX, bubbleY + 6, `"${tip}"`, {
            font: '11px monospace', fill: '#e8f0f0',
            wordWrap: { width: bubbleW - 16 }, align: 'center'
        }).setOrigin(0.5, 0.5).setDepth(9);

        this._npcBubble = [bg, label, text];
    }

    _clearNpc() {
        if (this._npcSprite) { this._npcSprite.destroy(); this._npcSprite = null; }
        if (this._npcNameText) { this._npcNameText.destroy(); this._npcNameText = null; }
        if (this._npcBubble) { this._npcBubble.forEach(o => o.destroy()); this._npcBubble = []; }
        this._npcType = null;
    }
}
