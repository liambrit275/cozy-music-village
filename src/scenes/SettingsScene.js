// SettingsScene: Overlay settings panel accessible from any scene.
// Launch with: this.scene.launch('SettingsScene', { callerKey, pauseCaller })
// Pauses callerKey scene while open (if pauseCaller is true), resumes on close.

import { ProgressionManager } from '../systems/ProgressionManager.js';
import {
    DRONE_PRESETS,
    INTERVAL_PRESETS,
    CLICK_PRESETS,
    RHYTHM_NOTE_PRESETS,
} from '../systems/AudioEngine.js';

const PANEL_W = 640;
const PANEL_H = 420;
const BG_COLOR     = 0x06060f;
const BORDER_COLOR = 0x4455aa;
const TITLE_COLOR  = '#aabbff';
const LABEL_COLOR  = '#778899';
const ON_COLOR     = '#ffcc00';
const ON_BG        = '#2a2a00';
const OFF_COLOR    = '#aabbcc';
const OFF_BG       = '#111122';
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
            font: 'bold 18px monospace', fill: '#666688',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerover', () => closeBtn.setStyle({ fill: '#ff4444' }));
        closeBtn.on('pointerout',  () => closeBtn.setStyle({ fill: '#666688' }));
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

        // ── Sounds section ────────────────────────────────────
        cy += 36;
        this.add.text(px + 24, cy - 14, 'SOUNDS', {
            font: 'bold 11px monospace', fill: LABEL_COLOR,
        }).setOrigin(0, 0.5);
        this.add.rectangle(width / 2, cy - 4, PANEL_W - 40, 1, 0x2233aa, 0.6);

        // Column headers
        this.add.text(px + 24 + 80,       cy + 2, 'PRESET', { font: '9px monospace', fill: '#445566' }).setOrigin(0, 0.5);
        this.add.text(px + PANEL_W - 130, cy + 2, 'VOLUME',  { font: '9px monospace', fill: '#445566' }).setOrigin(0, 0.5);

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

        // ── Hint text ─────────────────────────────────────────
        this.add.text(width / 2, py + PANEL_H - 16, 'ESC or ✕ to close', {
            font: '10px monospace', fill: '#334455',
        }).setOrigin(0.5);
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
        if (this.pauseCaller && this.callerKey) {
            this.scene.resume(this.callerKey);
        }
        this.scene.stop();
    }
}
