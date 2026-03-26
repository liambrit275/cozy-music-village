// ChallengeScene: Unified cozy village challenge scene.
// Villagers approach with a timer; answer correctly to help them!
// Supports tones, note reading, rhythm, and rhythm reading modes.

import { MusicTheory } from '../systems/MusicTheory.js';
import { AudioEngine } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { spellPattern } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';
import { MidiInput } from '../systems/MidiInput.js';
import { VILLAGERS } from '../data/villagers.js';
import { getLevelChallengeTypes, getStoryLevel, normalizeInstrumentId } from '../data/levels.js';
import { GROUND_Y, PLAYER_X } from '../challenges/challengeConstants.js';
import { safeTex } from '../systems/safeTexture.js';
import { UserProfileManager } from '../systems/UserProfileManager.js';
import { ToneChallengeMixin } from '../challenges/ToneChallengeMixin.js';
import { NoteReadingMixin } from '../challenges/NoteReadingMixin.js';
import { RhythmMixin } from '../challenges/RhythmMixin.js';
import { RhythmReadingMixin } from '../challenges/RhythmReadingMixin.js';

// Challenge types for 'all' mode
const ALL_CHALLENGE_TYPES = ['tone', 'noteReading', 'rhythm', 'rhythmReading'];

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
        this.customMeters = Array.isArray(s.rhythmMeters) && s.rhythmMeters.length > 0 ? s.rhythmMeters : ['4'];
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
        this.playerSprite = this.add.sprite(PLAYER_X, GROUND_Y, safeTex(this, `player-${charKey}`, 0), 0);
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
        // Story mode: no timers until level 5
        const useTimers = !this.practiceMode && !(this.storyBattle && (this.storyLevelId || 1) < 5);
        if (useTimers) {
            const escapeMs = Math.max(8000, 15000 - (this.session.round - 1) * 300);
            this._escapeTimer = this.time.delayedCall(escapeMs, () => {
                if (!this._gameOverFlag) this._triggerEscape();
            });

            if (this._challengeType !== 'rhythmReading') {
                this._buildEscapeTimerBar(escapeMs);
            }
        }

        const startDelay = this.practiceMode ? 400 : 800;
        this.time.delayedCall(startDelay, () => {
            if (this._gameOverFlag) return;

            if (!this._isRhythmEncounter && useTimers) {
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
        const useTimers = !this.practiceMode && !(this.storyBattle && (this.storyLevelId || 1) < 5);
        if (useTimers && !this._gameOverFlag) {
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
            const tsInfoAug = this._rhythmTimeSigInfo && this._rhythmSub
                ? { ...this._rhythmTimeSigInfo, ticksPerCell: this._rhythmSub.ticksPerCell }
                : this._rhythmTimeSigInfo;
            const spelled = spellPattern(answerGrid, this._rhythmSubKey, tsInfoAug);
            const { width: w } = this.cameras.main;
            const notationY = this._rNotationY || (this._rGridY - 108);
            this.rhythmNotationRenderer.render(spelled, this._rhythmSubKey, w / 2, notationY, w - 100, -1, tsInfoAug);
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
            if (this.storyBattle) {
                this.time.delayedCall(600, () => this._storyDefeat());
            } else {
                this.time.delayedCall(600, () => this._gameOver());
            }
            return;
        }

        if (this.storyBattle) {
            // Story: animal got away = defeat for this encounter
            this.time.delayedCall(800, () => this._storyDefeat());
        } else {
            // Arcade: spawn next
            this.time.delayedCall(800, () => this._spawnNextEntity());
        }
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

        // Story mode: rhythm = 3 questions per animal, tone/note = 10 questions
        // Arcade: rhythm = 1 question (auto-complete), tone/note = ~4 questions
        let happinessGain;
        if (this.storyBattle) {
            happinessGain = this._isRhythmEncounter
                ? Math.ceil(100 / 3)  // 3 rhythm questions to rescue
                : 10;                  // 10 tone/note questions to rescue
        } else {
            happinessGain = this._isRhythmEncounter ? 100 : (25 + Math.floor(Math.random() * 20));
        }
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
            if (this.storyBattle) {
                this.time.delayedCall(300, () => this._storyDefeat());
            } else {
                // Arcade: just spawn next entity after a wrong rhythm answer
                this._returnPlayerThenSpawn();
            }
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

        let types;

        // Story level system — pick from level's enabled challenge types
        if (this._storyLevel) {
            types = getLevelChallengeTypes(this._storyLevel);
        } else if (this.storyBattle && this._entityData) {
            // Story mode — use the entity's specific type; mixed → random
            const et = this._getEntityChallengeType();
            if (et && et !== 'mixed' && ALL_CHALLENGE_TYPES.includes(et)) return et;
            types = ALL_CHALLENGE_TYPES;
        } else {
            // 'all' mode
            types = ALL_CHALLENGE_TYPES;
        }

        // Avoid repeating the same type twice in a row (skip if only 2 types)
        if (types.length > 2 && this._lastChallengeType) {
            const filtered = types.filter(t => t !== this._lastChallengeType);
            if (filtered.length > 0) types = filtered;
        }
        const pick = types[Math.floor(Math.random() * types.length)];
        this._lastChallengeType = pick;
        return pick;
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

    // Challenge-type methods mixed in from src/challenges/
    // See: ToneChallengeMixin, NoteReadingMixin, RhythmMixin, RhythmReadingMixin

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

            // No energy loss in practice mode or story levels 1-2
            const noDamage = this.practiceMode || (this.storyBattle && (this.storyLevelId || 1) < 3);
            if (!noDamage) {
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
            try { UserProfileManager.syncLocalStorageToProfile(); } catch (e) { /* ignore */ }
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
        if (this.progression) {
            this.progression.save(this.playerStats);
            try { UserProfileManager.syncLocalStorageToProfile(); } catch (e) { /* ignore */ }
        }

        // Dark overlay for cozy nighttime feel
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0e18, 0.85).setDepth(59);

        // Bed with character tucked in: character behind bed, head peeking out top
        const bedX = width / 2;
        const bedY = height * 0.30;
        const ck = this._charKey || 'avatar';
        if (this.textures.exists('bed')) {
            this.add.image(bedX, bedY - 9, 'bed').setScale(3.6).setDepth(60);
        }
        this.add.sprite(bedX, bedY - 43, safeTex(this, `player-${ck}`, 0), 0)
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
        try { UserProfileManager.syncLocalStorageToProfile(); } catch (e) { /* ignore */ }

        // Dark nighttime overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0e18, 0.85).setDepth(59);

        // Bed with character tucked in: character behind bed, head peeking out top
        const bedX = width / 2;
        const bedY = height * 0.18;
        const ck = this._charKey || 'avatar';
        if (this.textures.exists('bed')) {
            this.add.image(bedX, bedY - 9, 'bed').setScale(3.6).setDepth(60);
        }
        this.add.sprite(bedX, bedY - 43, safeTex(this, `player-${ck}`, 0), 0)
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
                    rhythmSubs: this.customRhythmSubs, rhythmMeters: this.customMeters, tonesKey: this.tonesKey, sounds: this.soundSettings } });
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

// Apply challenge-type mixins to prototype
Object.assign(ChallengeScene.prototype, ToneChallengeMixin);
Object.assign(ChallengeScene.prototype, NoteReadingMixin);
Object.assign(ChallengeScene.prototype, RhythmMixin);
Object.assign(ChallengeScene.prototype, RhythmReadingMixin);
