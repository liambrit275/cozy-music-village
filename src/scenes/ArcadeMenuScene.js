// ArcadeMenuScene: Mode picker + settings for Arcade gameplay

import { ProgressionManager } from '../systems/ProgressionManager.js';

const SOLFEGE_DEGREES = [
    { degree: '1',  label: 'Do' },
    { degree: 'b2', label: 'Ra' },
    { degree: '2',  label: 'Re' },
    { degree: 'b3', label: 'Me' },
    { degree: '3',  label: 'Mi' },
    { degree: '4',  label: 'Fa' },
    { degree: '#4', label: 'Fi' },
    { degree: '5',  label: 'Sol' },
    { degree: 'b6', label: 'Le' },
    { degree: '6',  label: 'La' },
    { degree: 'b7', label: 'Te' },
    { degree: '7',  label: 'Ti' },
];

const NOTE_RANGES = [
    { id: 'onStaff',     label: 'On Staff' },
    { id: 'ledgerLow',   label: 'Ledger Below' },
    { id: 'ledgerHigh',  label: 'Ledger Above' },
    { id: 'accidentals', label: 'Sharps & Flats' },
];

const RHYTHM_SUBS = [
    { id: 'quarter',   label: 'Quarter' },
    { id: 'eighth',    label: 'Eighth' },
    { id: 'sixteenth', label: '16th' },
    { id: 'triplet',   label: 'Triplet' },
];

const CLEF_OPTIONS = [
    { id: 'treble', label: 'TREBLE' },
    { id: 'bass',   label: 'BASS' },
    { id: 'both',   label: 'BOTH' },
];

const DEFAULT_SETTINGS = {
    clef: 'treble',
    gradual: true,
    practice: false,
    showGrid: true,
    tones: ['1', '3', '5'],
    tonesKey: 'random',
    noteRanges: ['onStaff'],
    rhythmSubs: ['quarter'],
    tapLatencyMs: 0,
    characterKey: 'adventurer',
    sounds: {
        drone: 'pad', interval: 'synth', click: 'stick', rhythmNote: 'snare',
        volumes: { drone: 0.75, interval: 1.0, click: 1.0, rhythmNote: 1.0 },
    },
};

const CHARACTERS = [
    { key: 'bunny',      label: 'Bunny',    texture: 'bunny-idle',     menuScale: 1.0,  gameScale: 1.0 },
    { key: 'dragon',     label: 'Dragon',   texture: 'dragon-idle',    menuScale: 0.15, gameScale: 0.35, flip: true },
    { key: 'mushroom',   label: 'Mushroom', texture: 'mushroom-idle',  menuScale: 1.5,  gameScale: 1.0 },
    { key: 'froggy',     label: 'Froggy',   texture: 'froggy-idle',    menuScale: 1.0,  gameScale: 1.0, flip: true },
    { key: 'adventurer', label: 'Hero',     texture: 'adventurer-idle',menuScale: 0.35, gameScale: 1.0 },
];

// Keys shown in the tones key selector (RANDOM + all 12)
const TONE_KEYS = [
    { id: 'random', label: 'RAND' },
    { id: 'C',  label: 'C'  }, { id: 'Db', label: 'Db' }, { id: 'D',  label: 'D'  },
    { id: 'Eb', label: 'Eb' }, { id: 'E',  label: 'E'  }, { id: 'F',  label: 'F'  },
    { id: 'F#', label: 'F#' }, { id: 'G',  label: 'G'  }, { id: 'Ab', label: 'Ab' },
    { id: 'A',  label: 'A'  }, { id: 'Bb', label: 'Bb' }, { id: 'B',  label: 'B'  },
];

export class ArcadeMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ArcadeMenuScene' });
    }

    init(data) {
        this.playerData = data.playerData;
        this.pm = new ProgressionManager();
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#080818');

        // Load saved settings
        const saved = this.pm.loadArcadeSettings();
        this.settings = { ...DEFAULT_SETTINGS, ...saved };
        // Ensure arrays (not lost from bad save)
        if (!Array.isArray(this.settings.tones)) this.settings.tones = DEFAULT_SETTINGS.tones.slice();
        if (!Array.isArray(this.settings.noteRanges)) this.settings.noteRanges = DEFAULT_SETTINGS.noteRanges.slice();
        if (!Array.isArray(this.settings.rhythmSubs)) this.settings.rhythmSubs = DEFAULT_SETTINGS.rhythmSubs.slice();
        if (!this.settings.sounds) this.settings.sounds = { ...DEFAULT_SETTINGS.sounds };

        this.selectedMode = 'tones';
        this._settingsObjs = [];

        // Title
        this.add.text(width / 2, 24, 'ARCADE MODE', {
            font: 'bold 32px monospace', fill: '#ffaa00',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        this._buildUI(width, height);
    }

    _buildUI(width, height) {
        // --- Mode selector ---
        this.add.text(width / 2, 58, 'Choose Type:', {
            font: '14px monospace', fill: '#aaaacc'
        }).setOrigin(0.5);

        const modes = [
            { id: 'tones',         label: 'TONES',     x: width / 2 - 270 },
            { id: 'noteReading',   label: 'NOTE READ', x: width / 2 - 135 },
            { id: 'rhythm',        label: 'RHYTHM',    x: width / 2 },
            { id: 'rhythmReading', label: 'SIGHT-TAP', x: width / 2 + 135 },
            { id: 'all',           label: 'ALL',       x: width / 2 + 270 },
        ];

        this.modeBtns = {};
        modes.forEach(m => {
            const btn = this._makeToggleBtn(m.x, 82, m.label, () => this._setMode(m.id));
            this.modeBtns[m.id] = btn;
        });

        // --- Gradual + Practice + Select All buttons ---
        this.gradualBtn  = this._makeToggleBtn(width / 2 - 130, 116, '✓ GRADUAL',  () => this._toggleGradual());
        this.practiceBtn = this._makeToggleBtn(width / 2,       116, '✗ PRACTICE', () => this._togglePractice());
        this.selectAllBtn = this._makeToggleBtn(width / 2 + 130, 116, 'SELECT ALL', () => this._selectAll());

        // --- Settings gear button (top right) ---
        this.add.text(width - 16, 14, '⚙', {
            font: 'bold 20px monospace', fill: '#445566',
            padding: { x: 6, y: 4 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#aabbff' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#445566' }); })
            .on('pointerdown', () => {
                this.scene.launch('SettingsScene', { callerKey: null, pauseCaller: false });
            });

        // --- Settings area (mode-dependent) ---
        // Drawn by _refreshSettings

        // --- High Scores ---
        this._buildHighScores(width, 400);

        // --- START ---
        this._makeBtn(width / 2 + 60, height - 36, 'START', '#114411', '#225522', () => this._startArcade());

        // --- LATENCY ---
        this._makeBtn(width / 2 + 200, height - 36, 'LATENCY', '#111122', '#1a1a44', () => {
            this.scene.start('LatencyTestScene', {
                returnScene: 'ArcadeMenuScene',
                returnData:  { playerData: this.playerData },
                settings:    this.settings,
            });
        });

        // --- BACK ---
        this._makeBtn(width / 2 - 120, height - 36, 'BACK', '#221111', '#443333', () => {
            this.scene.start('MenuScene');
        });

        // Initial state
        this._setMode('tones');
        this._updateGradualBtn();
        this._updatePracticeBtn();
    }

    // ── Settings panel (mode-dependent) ───────────────────────

    _refreshSettings() {
        this._settingsObjs.forEach(o => o.destroy());
        this._settingsObjs = [];

        const { width } = this.cameras.main;
        const mode = this.selectedMode;
        let y = 145;

        // Tones section (for tones / all)
        if (mode === 'tones' || mode === 'all') {
            this._settingsObjs.push(
                this.add.text(width / 2, y, 'Tones:', { font: '12px monospace', fill: '#aaaacc' }).setOrigin(0.5)
            );
            y += 18;
            SOLFEGE_DEGREES.forEach((d, i) => {
                const col = i % 6;
                const row = Math.floor(i / 6);
                const x = width / 2 - 200 + col * 70;
                const cy = y + row * 26;
                const selected = this.settings.tones.includes(d.degree);
                const btn = this._makeCheckBtn(x, cy, d.label, selected, () => {
                    this._toggleSetting('tones', d.degree, btn);
                });
                this._settingsObjs.push(btn);
            });
            y += 52 + 6;

            // Key selector
            this._settingsObjs.push(
                this.add.text(width / 2 - 200, y, 'Key:', { font: '12px monospace', fill: '#aaaacc' }).setOrigin(0, 0.5)
            );
            if (!this.settings.tonesKey) this.settings.tonesKey = 'random';
            TONE_KEYS.forEach((k, i) => {
                const x = width / 2 - 110 + i * 38;
                const selected = this.settings.tonesKey === k.id;
                const btn = this._makeCheckBtn(x, y, k.label, selected, () => {
                    this.settings.tonesKey = k.id;
                    this._saveSettings();
                    this._refreshSettings();
                });
                this._settingsObjs.push(btn);
            });
            y += 24;
        }

        // Clef + Ranges (for noteReading / all)
        if (mode === 'noteReading' || mode === 'all') {
            // Clef
            this._settingsObjs.push(
                this.add.text(width / 2 - 200, y, 'Clef:', { font: '12px monospace', fill: '#aaaacc' }).setOrigin(0, 0.5)
            );
            CLEF_OPTIONS.forEach((c, i) => {
                const x = width / 2 - 100 + i * 100;
                const selected = this.settings.clef === c.id;
                const btn = this._makeCheckBtn(x, y, c.label, selected, () => {
                    this.settings.clef = c.id;
                    this._saveSettings();
                    this._refreshSettings();
                });
                this._settingsObjs.push(btn);
            });
            y += 24;

            // Ranges
            this._settingsObjs.push(
                this.add.text(width / 2 - 200, y, 'Range:', { font: '12px monospace', fill: '#aaaacc' }).setOrigin(0, 0.5)
            );
            NOTE_RANGES.forEach((r, i) => {
                const x = width / 2 - 100 + i * 105;
                const selected = this.settings.noteRanges.includes(r.id);
                const btn = this._makeCheckBtn(x, y, r.label, selected, () => {
                    this._toggleSetting('noteRanges', r.id, btn);
                });
                this._settingsObjs.push(btn);
            });
            y += 24;
        }

        // Rhythm subdivisions (for rhythm / rhythmReading / all)
        if (mode === 'rhythm' || mode === 'rhythmReading' || mode === 'all') {
            this._settingsObjs.push(
                this.add.text(width / 2 - 200, y, 'Rhythm:', { font: '12px monospace', fill: '#aaaacc' }).setOrigin(0, 0.5)
            );
            RHYTHM_SUBS.forEach((s, i) => {
                const x = width / 2 - 100 + i * 100;
                const selected = this.settings.rhythmSubs.includes(s.id);
                const btn = this._makeCheckBtn(x, y, s.label, selected, () => {
                    this._toggleSetting('rhythmSubs', s.id, btn);
                });
                this._settingsObjs.push(btn);
            });
            y += 24;
        }

        // Character picker (always shown)
        y += 12;
        this._settingsObjs.push(
            this.add.text(width / 2 - 200, y, 'Character:', { font: '12px monospace', fill: '#aaaacc' }).setOrigin(0, 0.5)
        );
        const spacing = 80;
        const startX = width / 2 - (spacing * (CHARACTERS.length - 1)) / 2;
        CHARACTERS.forEach((ch, i) => {
            const cx = startX + i * spacing;
            const sprite = this.add.sprite(cx, y + 20, ch.texture, 0).setScale(ch.menuScale).setFlipX(ch.flip || false);
            const isSelected = (this.settings.characterKey || 'knight') === ch.key;
            const btn = this._makeCheckBtn(cx, y + 46, ch.label, isSelected, () => {
                this.settings.characterKey = ch.key;
                this._saveSettings();
                this._refreshSettings();
            });
            this._settingsObjs.push(sprite, btn);
        });
    }

    _toggleSetting(key, value, btn) {
        const arr = this.settings[key];
        const idx = arr.indexOf(value);
        if (idx >= 0) {
            if (arr.length > 1) {
                arr.splice(idx, 1);
                btn.setStyle({ fill: '#888888', backgroundColor: '#222222' });
            }
        } else {
            arr.push(value);
            btn.setStyle({ fill: '#ffcc00', backgroundColor: '#333311' });
        }
        this._saveSettings();
    }

    _selectAll() {
        const mode = this.selectedMode;
        if (mode === 'tones' || mode === 'all') {
            this.settings.tones = SOLFEGE_DEGREES.map(d => d.degree);
        }
        if (mode === 'noteReading' || mode === 'all') {
            this.settings.noteRanges = NOTE_RANGES.map(r => r.id);
        }
        if (mode === 'rhythm' || mode === 'rhythmReading' || mode === 'all') {
            this.settings.rhythmSubs = RHYTHM_SUBS.map(s => s.id);
        }
        this._saveSettings();
        this._refreshSettings();
    }

    _toggleGradual() {
        this.settings.gradual = !this.settings.gradual;
        this._saveSettings();
        this._updateGradualBtn();
    }

    _updateGradualBtn() {
        const on = this.settings.gradual;
        this.gradualBtn.setText(on ? '✓ GRADUAL' : '✗ GRADUAL');
        this.gradualBtn.setStyle({
            backgroundColor: on ? '#334433' : '#222222',
            fill: on ? '#ffcc00' : '#888888'
        });
    }

    _togglePractice() {
        this.settings.practice = !this.settings.practice;
        this._saveSettings();
        this._updatePracticeBtn();
    }

    _updatePracticeBtn() {
        const on = this.settings.practice;
        this.practiceBtn.setText(on ? '✓ PRACTICE' : '✗ PRACTICE');
        this.practiceBtn.setStyle({
            backgroundColor: on ? '#1a3344' : '#222222',
            fill: on ? '#88ddff' : '#888888'
        });
    }

    // ── High scores ───────────────────────────────────────────

    _buildHighScores(width, y) {
        const scores = this.pm.loadArcadeScores();
        const cols = [
            { label: 'TONES',     key: 'tones',         x: width / 2 - 290 },
            { label: 'NOTE READ', key: 'noteReading',   x: width / 2 - 150 },
            { label: 'RHYTHM',    key: 'rhythm',        x: width / 2 - 10  },
            { label: 'SIGHT-TAP', key: 'rhythmReading', x: width / 2 + 130 },
            { label: 'ALL',       key: 'all',            x: width / 2 + 270 },
        ];

        this.add.text(width / 2, y - 14, 'HIGH SCORES', {
            font: '14px monospace', fill: '#ffcc44'
        }).setOrigin(0.5);

        cols.forEach(col => {
            this.add.text(col.x, y + 10, col.label, {
                font: '12px monospace', fill: '#aaaadd'
            }).setOrigin(0.5);

            const list = scores[col.key] || [];
            for (let i = 0; i < 5; i++) {
                const val = list[i] != null ? list[i].toString() : '--';
                this.add.text(col.x, y + 28 + i * 18, `${i + 1}. ${val}`, {
                    font: '11px monospace', fill: '#cccccc'
                }).setOrigin(0.5);
            }
        });
    }

    // ── Mode selection ────────────────────────────────────────

    _setMode(mode) {
        this.selectedMode = mode;
        Object.entries(this.modeBtns).forEach(([id, btn]) => {
            btn.setStyle({
                backgroundColor: id === mode ? '#334433' : '#111133',
                fill: id === mode ? '#ffcc00' : '#ffffff'
            });
        });
        this._refreshSettings();
    }

    // ── Save / Start ──────────────────────────────────────────

    _saveSettings() {
        this.pm.saveArcadeSettings(this.settings);
    }

    _startArcade() {
        this._saveSettings();
        const playerData = this.playerData || {
            hp: 100, maxHp: 100, attack: 30, defense: 5, level: 1, xp: 0, gold: 0
        };
        const selChar = CHARACTERS.find(c => c.key === (this.settings.characterKey || 'adventurer'));
        playerData.characterKey   = selChar ? selChar.key       : 'adventurer';
        playerData.characterScale = selChar ? selChar.gameScale : 1.0;
        playerData.characterFlip  = selChar ? (selChar.flip || false) : false;

        if (this.selectedMode === 'rhythmReading') {
            this.scene.start('RhythmReadingScene', {
                returnScene: 'ArcadeMenuScene',
                returnData: { playerData },
                settings: this.settings,
            });
            return;
        }

        this.scene.start('ArcadeBattleScene', {
            mode: this.selectedMode,
            playerData,
            clefSetting: this.settings.clef,
            returnScene: 'ArcadeMenuScene',
            settings: this.settings,
        });
    }

    // ── UI helpers ─────────────────────────────────────────────

    _makeToggleBtn(x, y, label, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 13px monospace',
            fill: '#ffffff',
            backgroundColor: '#111133',
            padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', cb);
        return btn;
    }

    _makeCheckBtn(x, y, label, selected, cb) {
        const btn = this.add.text(x, y, label, {
            font: '11px monospace',
            fill: selected ? '#ffcc00' : '#888888',
            backgroundColor: selected ? '#333311' : '#222222',
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', cb);
        return btn;
    }

    _makeBtn(x, y, label, bgColor, hoverColor, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 20px monospace',
            fill: '#ffffff',
            backgroundColor: bgColor,
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverColor }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bgColor }));
        btn.on('pointerdown', cb);
        return btn;
    }
}
