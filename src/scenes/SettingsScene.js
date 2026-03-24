// SettingsScene: Overlay settings panel accessible from any scene.
// Launch with: this.scene.launch('SettingsScene', { callerKey, pauseCaller })
// Pauses callerKey scene while open (if pauseCaller is true), resumes on close.

import { ProgressionManager } from '../systems/ProgressionManager.js';
import { MidiInput } from '../systems/MidiInput.js';
import {
    DRONE_PRESETS,
    INTERVAL_PRESETS,
    CLICK_PRESETS,
    RHYTHM_NOTE_PRESETS,
} from '../systems/AudioEngine.js';

const PANEL_W = 640;
const PANEL_H = 460;
const BG_COLOR     = 0x1a150e;
const BORDER_COLOR = 0x665533;
const TITLE_COLOR  = '#ffcc66';
const LABEL_COLOR  = '#aa9977';
const ON_COLOR     = '#ffcc00';
const ON_BG        = '#2a2a00';
const OFF_COLOR    = '#bbaa88';
const OFF_BG       = '#2a2418';
const SEL_COLOR    = '#ffcc00';
const SEL_BG       = '#333311';
const UNSEL_COLOR  = '#888888';
const UNSEL_BG     = '#222222';
const VOL_STEP     = 0.25;   // volume step per click
const VOL_STEPS    = [0, 0.25, 0.5, 0.75, 1.0];

export class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
    }

    init(data) {
        this.callerKey   = data.callerKey   || null;
        this.pauseCaller = data.pauseCaller !== false && !!this.callerKey;
        this.pm          = new ProgressionManager();
        this.settings    = this.pm.loadArcadeSettings() || {};
        if (!this.settings.sounds) this.settings.sounds = {};
        if (!this.settings.sounds.volumes) {
            this.settings.sounds.volumes = { click: 1.0, rhythmNote: 1.0, drone: 0.75, interval: 1.0 };
        }
        if (this.settings.showGrid === undefined) this.settings.showGrid = true;
        if (this.settings.midiTranspose == null) this.settings.midiTranspose = 0;
        this._midiInput = null;
        this._midiStatusLabel = null;
    }

    create() {
        const { width, height } = this.cameras.main;

        // Semi-transparent full-screen dim
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
            .setInteractive(); // swallows clicks below

        // Panel background
        const px = width / 2 - PANEL_W / 2;
        const py = height / 2 - PANEL_H / 2;
        this.add.rectangle(width / 2, height / 2, PANEL_W, PANEL_H, BG_COLOR, 0.98)
            .setStrokeStyle(2, BORDER_COLOR);

        // Title
        this.add.text(width / 2, py + 20, '⚙  SETTINGS', {
            font: 'bold 20px monospace', fill: TITLE_COLOR,
        }).setOrigin(0.5);

        // Close button
        const closeBtn = this.add.text(px + PANEL_W - 14, py + 14, '✕', {
            font: 'bold 18px monospace', fill: '#887766',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerover', () => closeBtn.setStyle({ fill: '#dd8855' }));
        closeBtn.on('pointerout',  () => closeBtn.setStyle({ fill: '#887766' }));
        closeBtn.on('pointerdown', () => this._close());

        // ESC to close
        this.input.keyboard.once('keydown-ESC', () => this._close());

        // ── RHYTHM GRID toggle ────────────────────────────────
        let cy = py + 56;
        this.add.text(px + 24, cy, 'RHYTHM GRID', {
            font: '12px monospace', fill: LABEL_COLOR,
        }).setOrigin(0, 0.5);

        const gridOn = this.settings.showGrid !== false;
        this._gridBtn = this._makeToggle(px + 160, cy, gridOn, () => {
            this.settings.showGrid = !this.settings.showGrid;
            this._updateToggle(this._gridBtn, this.settings.showGrid);
            this._save();
        });

        // ── MIDI section ──────────────────────────────────────
        cy += 36;
        this.add.text(px + 24, cy - 14, 'MIDI', {
            font: 'bold 11px monospace', fill: LABEL_COLOR,
        }).setOrigin(0, 0.5);
        this.add.rectangle(width / 2, cy - 4, PANEL_W - 40, 1, 0x2233aa, 0.6);

        // Status row
        cy += 14;
        this.add.text(px + 24, cy, 'STATUS:', {
            font: '11px monospace', fill: LABEL_COLOR,
        }).setOrigin(0, 0.5);
        this._midiStatusLabel = this.add.text(px + 108, cy, 'Checking...', {
            font: '11px monospace', fill: '#888888',
        }).setOrigin(0, 0.5);

        const reconnectBtn = this.add.text(px + PANEL_W - 120, cy, 'RESCAN', {
            font: 'bold 10px monospace', fill: '#bbaa88',
            backgroundColor: '#2a2418', padding: { x: 7, y: 4 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        reconnectBtn.on('pointerover', () => reconnectBtn.setStyle({ fill: '#ffcc00' }));
        reconnectBtn.on('pointerout',  () => reconnectBtn.setStyle({ fill: '#bbaa88' }));
        reconnectBtn.on('pointerdown', () => this._reconnectMidi());

        // Hint — Firefox caches MIDI devices at page load
        this.add.text(px + 24, cy + 14, 'Refresh page if new device not found', {
            font: '9px monospace', fill: '#887766',
        }).setOrigin(0, 0.5);

        // Transpose row
        cy += 32;
        this.add.text(px + 24, cy, 'TRANSPOSE:', {
            font: '11px monospace', fill: LABEL_COLOR,
        }).setOrigin(0, 0.5);

        const tx = px + 120;
        const transpDecBtn = this.add.text(tx, cy, '◀', {
            font: 'bold 14px monospace', fill: '#556688', padding: { x: 6, y: 3 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        this._transpLabel = this.add.text(tx + 28, cy, this._transpText(this.settings.midiTranspose), {
            font: 'bold 11px monospace', fill: '#aaccee', padding: { x: 4, y: 3 },
        }).setOrigin(0, 0.5);

        const transpIncBtn = this.add.text(tx + 72, cy, '▶', {
            font: 'bold 14px monospace', fill: '#556688', padding: { x: 6, y: 3 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        const updateTransp = (delta) => {
            const next = Math.max(-12, Math.min(12, this.settings.midiTranspose + delta));
            this.settings.midiTranspose = next;
            this._transpLabel.setText(this._transpText(next));
            this._save();
        };
        transpDecBtn.on('pointerdown', () => updateTransp(-1));
        transpIncBtn.on('pointerdown', () => updateTransp(+1));

        this.add.text(tx + 100, cy, 'semitones', {
            font: '10px monospace', fill: '#887766',
        }).setOrigin(0, 0.5);

        // Start async MIDI status check
        this._checkMidiStatus();

        // ── Sounds section ────────────────────────────────────
        cy += 44;
        this.add.text(px + 24, cy - 14, 'SOUNDS', {
            font: 'bold 11px monospace', fill: LABEL_COLOR,
        }).setOrigin(0, 0.5);
        this.add.rectangle(width / 2, cy - 4, PANEL_W - 40, 1, 0x2233aa, 0.6);

        // Column headers
        this.add.text(px + 24 + 80,       cy + 2, 'PRESET', { font: '9px monospace', fill: '#887766' }).setOrigin(0, 0.5);
        this.add.text(px + PANEL_W - 130, cy + 2, 'VOLUME',  { font: '9px monospace', fill: '#887766' }).setOrigin(0, 0.5);

        const soundRows = [
            { label: 'CLICK',  key: 'click',      presets: CLICK_PRESETS,       defaultPreset: 'stick', defaultVol: 1.0 },
            { label: 'DRUM',   key: 'rhythmNote',  presets: RHYTHM_NOTE_PRESETS, defaultPreset: 'snare', defaultVol: 1.0 },
            { label: 'DRONE',  key: 'drone',       presets: DRONE_PRESETS,       defaultPreset: 'pad',   defaultVol: 0.75 },
            { label: 'TONE',   key: 'interval',    presets: INTERVAL_PRESETS,    defaultPreset: 'synth', defaultVol: 1.0 },
        ];

        this._soundBtns = {};
        soundRows.forEach((row, ri) => {
            const rowY = cy + 22 + ri * 48;

            // Row label
            this.add.text(px + 24, rowY, row.label + ':', {
                font: '11px monospace', fill: LABEL_COLOR,
            }).setOrigin(0, 0.5);

            // Preset buttons
            const curPreset = this.settings.sounds[row.key] || row.defaultPreset;
            const presetKeys = Object.keys(row.presets);
            this._soundBtns[row.key] = {};

            presetKeys.forEach((k, ki) => {
                const bx = px + 88 + ki * 80;
                const isCur = curPreset === k;
                const btn = this.add.text(bx, rowY, row.presets[k].label, {
                    font: 'bold 10px monospace',
                    fill: isCur ? ON_COLOR : OFF_COLOR,
                    backgroundColor: isCur ? ON_BG : OFF_BG,
                    padding: { x: 7, y: 4 },
                }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

                btn.on('pointerdown', () => {
                    const old = this.settings.sounds[row.key];
                    if (this._soundBtns[row.key][old]) {
                        this._soundBtns[row.key][old].setStyle({ fill: OFF_COLOR, backgroundColor: OFF_BG });
                    }
                    this.settings.sounds[row.key] = k;
                    btn.setStyle({ fill: ON_COLOR, backgroundColor: ON_BG });
                    this._save();
                });

                this._soundBtns[row.key][k] = btn;
            });

            // Volume control: ◀  75%  ▶
            const vols = this.settings.sounds.volumes;
            if (vols[row.key] == null) vols[row.key] = row.defaultVol;

            const volX = px + PANEL_W - 130;
            const decBtn = this.add.text(volX, rowY, '◀', {
                font: 'bold 14px monospace', fill: '#556688',
                padding: { x: 6, y: 3 },
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

            const volLabel = this.add.text(volX + 28, rowY, this._volText(vols[row.key]), {
                font: 'bold 11px monospace', fill: '#aaccee',
                padding: { x: 4, y: 3 },
            }).setOrigin(0, 0.5);

            const incBtn = this.add.text(volX + 82, rowY, '▶', {
                font: 'bold 14px monospace', fill: '#556688',
                padding: { x: 6, y: 3 },
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

            const updateVol = (delta) => {
                const cur = vols[row.key] ?? row.defaultVol;
                const idx = VOL_STEPS.indexOf(this._snapVol(cur));
                const next = VOL_STEPS[Math.max(0, Math.min(VOL_STEPS.length - 1, idx + delta))];
                vols[row.key] = next;
                volLabel.setText(this._volText(next));
                decBtn.setStyle({ fill: next <= 0    ? '#2a3344' : '#556688' });
                incBtn.setStyle({ fill: next >= 1.0  ? '#2a3344' : '#556688' });
                this._save();
            };

            decBtn.on('pointerdown', () => updateVol(-1));
            incBtn.on('pointerdown', () => updateVol(+1));

            // Dim arrows at limits
            const initVol = this._snapVol(vols[row.key]);
            if (initVol <= 0)   decBtn.setStyle({ fill: '#2a3344' });
            if (initVol >= 1.0) incBtn.setStyle({ fill: '#2a3344' });
        });

        // ── Edit Avatar button ────────────────────────────────
        const avatarBtn = this.add.text(px + 24, py + PANEL_H - 44, 'EDIT AVATAR', {
            font: 'bold 13px monospace', fill: '#bbaa88',
            backgroundColor: '#2a2418', padding: { x: 10, y: 6 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        avatarBtn.on('pointerover', () => avatarBtn.setStyle({ fill: '#ffcc00' }));
        avatarBtn.on('pointerout',  () => avatarBtn.setStyle({ fill: '#bbaa88' }));
        avatarBtn.on('pointerdown', () => {
            this.scene.pause('SettingsScene');
            this.scene.launch('AvatarBuilderScene', { callerScene: 'SettingsScene' });
        });

        // ── Hint text ─────────────────────────────────────────
        this.add.text(width / 2, py + PANEL_H - 16, 'ESC or ✕ to close', {
            font: '10px monospace', fill: '#334455',
        }).setOrigin(0.5);
    }

    _transpText(v) {
        return v === 0 ? '0' : v > 0 ? `+${v}` : `${v}`;
    }

    async _checkMidiStatus() {
        if (!this._midiStatusLabel) return;
        if (!navigator.requestMIDIAccess) {
            this._midiStatusLabel.setText('Not supported').setStyle({ fill: '#ff6644' });
            return;
        }
        this._midiInput = new MidiInput();
        await this._midiInput.init();
        await this._probeMidiDevices();
    }

    async _probeMidiDevices() {
        if (!this._midiStatusLabel || !this._midiInput) return;
        if (!this._midiStatusLabel.active) return;
        if (!this._midiInput.available) {
            const reason = this._midiInput.unavailableReason;
            const text = reason === 'not-supported' ? 'Not supported'
                       : reason === 'permission-denied' ? 'Permission denied'
                       : 'Unavailable';
            this._midiStatusLabel.setText(text).setStyle({ fill: '#ff6644' });
            return;
        }
        // Actually try to open each port — Firefox reports unplugged devices as state=connected
        const alive = await this._midiInput.probeConnected();
        if (alive.length > 0) {
            const first = alive[0].name || 'Unknown';
            const truncated = first.length > 26 ? first.slice(0, 24) + '…' : first;
            const label = alive.length > 1 ? `${truncated} +${alive.length - 1}` : truncated;
            this._midiStatusLabel.setText(label).setStyle({ fill: '#44cc66' });
        } else {
            this._midiStatusLabel.setText('No device found').setStyle({ fill: '#ffaa44' });
        }
    }

    async _reconnectMidi() {
        if (!this._midiStatusLabel) return;
        this._midiStatusLabel.setText('Scanning...').setStyle({ fill: '#888888' });

        if (this._midiInput) this._midiInput.dispose();

        this._midiInput = new MidiInput();
        await this._midiInput.init();
        await this._probeMidiDevices();

        // Also reinit MIDI on the caller scene (e.g. ChallengeScene) so new device works in-game
        if (this.callerKey) {
            const callerScene = this.scene.get(this.callerKey);
            if (callerScene && callerScene.midiInput) {
                const oldCallback = callerScene.midiInput._onNoteOn;
                callerScene.midiInput.dispose();
                callerScene.midiInput = new MidiInput();
                await callerScene.midiInput.init();
                if (callerScene.midiInput.available && oldCallback) {
                    callerScene.midiInput.onNoteOn(oldCallback);
                }
            }
        }
    }

    _volText(v) {
        return `${Math.round(v * 100)}%`;
    }

    _snapVol(v) {
        // Snap to nearest VOL_STEP value
        return VOL_STEPS.reduce((best, s) => Math.abs(s - v) < Math.abs(best - v) ? s : best, VOL_STEPS[0]);
    }

    _makeToggle(x, y, isOn, cb) {
        const btn = this.add.text(x, y, isOn ? '✓ ON' : '✗ OFF', {
            font: 'bold 12px monospace',
            fill: isOn ? SEL_COLOR : UNSEL_COLOR,
            backgroundColor: isOn ? SEL_BG : UNSEL_BG,
            padding: { x: 8, y: 4 },
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', cb);
        return btn;
    }

    _updateToggle(btn, isOn) {
        btn.setText(isOn ? '✓ ON' : '✗ OFF');
        btn.setStyle({
            fill: isOn ? SEL_COLOR : UNSEL_COLOR,
            backgroundColor: isOn ? SEL_BG : UNSEL_BG,
        });
    }

    _save() {
        this.pm.saveArcadeSettings(this.settings);
    }

    _close() {
        if (this._midiInput) { this._midiInput.dispose(); this._midiInput = null; }
        if (this.pauseCaller && this.callerKey) {
            this.scene.resume(this.callerKey);
        }
        this.scene.stop();
    }
}
