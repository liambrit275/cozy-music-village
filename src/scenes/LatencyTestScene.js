// LatencyTestScene: Tap along with a metronome to calibrate tap latency.
// Measures average offset between user taps and click times,
// saves the result so ChallengeScene can compensate.

import { AudioEngine } from '../systems/AudioEngine.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';

const BPM          = 100;
const BEAT_MS      = 60000 / BPM; // 600 ms per beat
const WARMUP       = 2;           // first N beats: ignored (timing warm-up)
const MEASURE      = 8;           // beats used for measurement
const TOTAL        = WARMUP + MEASURE;
const MATCH_WINDOW = 350;         // ms — taps outside this from a click are ignored

export class LatencyTestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LatencyTestScene' });
    }

    init(data) {
        this.returnScene = data.returnScene || 'ArcadeMenuScene';
        this.returnData  = data.returnData  || {};
        this.settings    = data.settings    || {};
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#142030');

        this._state      = 'idle';
        this._timers     = [];
        this._clickTimes = [];     // absolute performance.now() of each measured click
        this._rawTaps    = [];     // absolute performance.now() of every tap during test
        this._latency    = null;

        // Audio
        this.audioEngine = new AudioEngine();
        try { await this.audioEngine.init(); } catch (e) { console.warn('audio init failed', e); }

        this.pm = new ProgressionManager();

        this._buildUI(width, height);

        // Keyboard — document-level so focus loss doesn't break it
        this._keyHandler = (e) => {
            if (e.code === 'Space') { e.preventDefault(); this._onTap(); }
            if (e.code === 'Escape') this._leave();
        };
        document.addEventListener('keydown', this._keyHandler);

        // Canvas tap (touch / click) — stop propagation so buttons don't double-fire
        this.input.on('pointerdown', (ptr) => {
            // Only register if not clicking an interactive UI object
            const hits = this.input.hitTestPointer(ptr);
            if (hits.length === 0) this._onTap();
        });
    }

    _buildUI(width, height) {
        this.add.text(width / 2, 28, 'LATENCY CALIBRATION', {
            font: 'bold 26px monospace', fill: '#e8d098',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(width / 2, 60, [
            'A metronome will play. Tap Spacebar (or click) on every beat.',
            `First ${WARMUP} beats are warm-up — then ${MEASURE} beats are measured.`,
        ].join('\n'), {
            font: '12px monospace', fill: '#687880', align: 'center'
        }).setOrigin(0.5);

        // Beat dots
        this._dots = [];
        const dotGap = 48;
        const dotsY  = height / 2 - 30;
        for (let i = 0; i < TOTAL; i++) {
            const x = width / 2 - ((TOTAL - 1) / 2 - i) * dotGap;
            const dot = this.add.circle(x, dotsY, 12, 0x142030);
            dot.setStrokeStyle(2, 0x243848);
            this._dots.push(dot);
        }

        // Labels under dot groups
        const wCenterX = width / 2 - ((TOTAL - 1) / 2 - (WARMUP / 2 - 0.5)) * dotGap;
        const mCenterX = width / 2 - ((TOTAL - 1) / 2 - (WARMUP + MEASURE / 2 - 0.5)) * dotGap;
        this.add.text(wCenterX, dotsY + 24, 'WARM-UP',  { font: '10px monospace', fill: '#1a2838' }).setOrigin(0.5);
        this.add.text(mCenterX, dotsY + 24, 'MEASURED', { font: '10px monospace', fill: '#1a2838' }).setOrigin(0.5);

        // Divider between warmup and measured
        const divX = width / 2 - ((TOTAL - 1) / 2 - WARMUP) * dotGap + dotGap / 2 - dotGap;
        this.add.line(0, 0, divX, dotsY - 20, divX, dotsY + 20, 0x243848).setOrigin(0);

        // Tap flash ring — shows each tap visually
        this._tapRing = this.add.circle(width / 2, dotsY + 60, 20, 0x142030);
        this._tapRing.setStrokeStyle(2, 0x243848);
        this._tapRingLabel = this.add.text(width / 2, dotsY + 60, 'TAP', {
            font: 'bold 11px monospace', fill: '#243848'
        }).setOrigin(0.5);

        // Status text
        this.msgText = this.add.text(width / 2, height / 2 + 50, 'Press START, then tap on every beat', {
            font: '14px monospace', fill: '#90c8c0', align: 'center',
            wordWrap: { width: width - 60 }
        }).setOrigin(0.5);

        // Saved offset display
        const saved = this.settings.tapLatencyMs || 0;
        this.savedText = this.add.text(width / 2, height / 2 + 80, this._offsetLabel('Saved', saved), {
            font: '12px monospace', fill: '#1a2838'
        }).setOrigin(0.5);

        // Buttons
        const btnY = height - 40;
        this._startBtn = this._makeBtn(width / 2,       btnY, '▶  START',   '#142030', '#243848', () => this._startTest());
        this._saveBtn  = this._makeBtn(width / 2,       btnY, 'SAVE & BACK','#142030', '#243848', () => this._save()).setVisible(false);
        this._retryBtn = this._makeBtn(width / 2 + 170, btnY, 'RETRY',      '#142030', '#243848', () => this._reset()).setVisible(false);
        this._makeBtn(70, btnY, '← BACK', '#142030', '#243848', () => this._leave());
    }

    // ── Test flow ──────────────────────────────────────────────

    _startTest() {
        this._state      = 'running';
        this._clickTimes = [];
        this._rawTaps    = [];
        this._startBtn.setVisible(false);
        this._saveBtn.setVisible(false);
        this._retryBtn.setVisible(false);
        this._dots.forEach(d => { d.setFillStyle(0x142030); d.setStrokeStyle(2, 0x243848); });
        this.msgText.setText('Tap on every beat...').setStyle({ fill: '#50d0b0' });

        for (let i = 0; i < TOTAL; i++) {
            this._schedule(() => {
                if (this._state !== 'running') return;

                const isWarmup = i < WARMUP;
                this.audioEngine.playClick(i % 4 === 0);
                this._pulseDot(i, isWarmup ? 0xe8d098 : 0x90c8c0);

                // Record the real clock time of each measured click
                if (!isWarmup) this._clickTimes.push(performance.now());

                if (i === TOTAL - 1) {
                    // Allow last tap window then finish
                    this._schedule(() => this._finish(), BEAT_MS * 0.7);
                }
            }, i * BEAT_MS);
        }
    }

    _onTap() {
        if (this._state !== 'running') return;
        const now = performance.now();

        // Debounce — ignore taps < 80 ms apart (key repeat)
        if (this._lastTap && now - this._lastTap < 80) return;
        this._lastTap = now;

        this._rawTaps.push(now);
        this._flashTapRing();
    }

    _flashTapRing() {
        this._tapRing.setFillStyle(0x243848).setStrokeStyle(2, 0x50d0b0);
        this._tapRingLabel.setStyle({ fill: '#90c8c0' });
        this.time.delayedCall(120, () => {
            if (!this._tapRing.scene) return;
            this._tapRing.setFillStyle(0x142030).setStrokeStyle(2, 0x243848);
            this._tapRingLabel.setStyle({ fill: '#243848' });
        });
    }

    _finish() {
        this._state = 'done';
        this._stopAll();

        if (this._clickTimes.length === 0 || this._rawTaps.length === 0) {
            this.msgText.setText('No taps detected! Press RETRY and tap on every beat.').setStyle({ fill: '#e08868' });
            this._retryBtn.setVisible(true);
            return;
        }

        // Greedy nearest-match: for each click, find the closest unused tap within MATCH_WINDOW
        const usedTaps = new Set();
        const offsets  = [];

        for (const clickT of this._clickTimes) {
            let bestIdx = -1, bestDiff = Infinity;
            this._rawTaps.forEach((tapT, ti) => {
                if (usedTaps.has(ti)) return;
                const diff = tapT - clickT;
                if (Math.abs(diff) < MATCH_WINDOW && Math.abs(diff) < Math.abs(bestDiff)) {
                    bestDiff = diff;
                    bestIdx = ti;
                }
            });
            if (bestIdx >= 0) {
                usedTaps.add(bestIdx);
                offsets.push(Math.round(this._rawTaps[bestIdx] - this._clickTimes[offsets.length === 0 ? 0 : offsets.length]));
                // Re-compute with correct index
            }
        }

        // Simpler: re-do with correct matched index tracking
        const offsets2 = [];
        const used2    = new Set();
        this._clickTimes.forEach((clickT, ci) => {
            let bestIdx = -1, bestDiff = Infinity;
            this._rawTaps.forEach((tapT, ti) => {
                if (used2.has(ti)) return;
                const diff = tapT - clickT;
                if (Math.abs(diff) < MATCH_WINDOW && Math.abs(diff) < Math.abs(bestDiff)) {
                    bestDiff = diff;
                    bestIdx = ti;
                }
            });
            if (bestIdx >= 0) {
                used2.add(bestIdx);
                offsets2.push(this._rawTaps[bestIdx] - clickT);
            }
        });

        const matched = offsets2.length;
        if (matched === 0) {
            this.msgText.setText('Taps too far from beats. Try again closer to each click.').setStyle({ fill: '#e08868' });
            this._retryBtn.setVisible(true);
            return;
        }

        const avg = Math.round(offsets2.reduce((s, v) => s + v, 0) / matched);
        this._latency = avg;

        const sign = avg >= 0 ? '+' : '';
        const feel = avg > 40  ? '(tapping late — common with audio latency)'
                   : avg < -40 ? '(tapping early)'
                   : '(near-perfect timing!)';
        this.msgText.setText(
            `Result: ${sign}${avg} ms  ${feel}\n${matched}/${MEASURE} beats matched`
        ).setStyle({ fill: Math.abs(avg) > 100 ? '#e8d098' : '#50d0b0' });

        this._saveBtn.setVisible(true);
        this._retryBtn.setVisible(true);
    }

    _save() {
        this.settings.tapLatencyMs = this._latency;
        this.pm.saveArcadeSettings(this.settings);
        this._leave();
    }

    _reset() {
        this._stopAll();
        this._state = 'idle';
        this._lastTap = null;
        this._dots.forEach(d => { d.setFillStyle(0x142030); d.setStrokeStyle(2, 0x243848); });
        this._tapRing.setFillStyle(0x142030).setStrokeStyle(2, 0x243848);
        this._tapRingLabel.setStyle({ fill: '#243848' });
        this.msgText.setText('Press START, then tap on every beat').setStyle({ fill: '#90c8c0' });
        const saved = this.settings.tapLatencyMs || 0;
        this.savedText.setText(this._offsetLabel('Saved', saved));
        this._startBtn.setVisible(true);
        this._saveBtn.setVisible(false);
        this._retryBtn.setVisible(false);
    }

    _leave() {
        this._stopAll();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        this.audioEngine.dispose();
        this.scene.start(this.returnScene, this.returnData);
    }

    // ── Helpers ───────────────────────────────────────────────

    _offsetLabel(prefix, ms) {
        if (!ms) return `${prefix}: none`;
        return `${prefix}: ${ms > 0 ? '+' : ''}${ms} ms`;
    }

    _schedule(fn, delayMs) {
        const t = this.time.delayedCall(delayMs, fn, [], this);
        this._timers.push(t);
        return t;
    }

    _stopAll() {
        this._timers.forEach(t => { if (t && t.remove) t.remove(); });
        this._timers = [];
    }

    _pulseDot(i, color) {
        const dot = this._dots[i];
        if (!dot || !dot.scene) return;
        dot.setFillStyle(color).setStrokeStyle(2, 0x90c8c0);
        this.time.delayedCall(260, () => {
            if (!dot.scene) return;
            const isWarmup = i < WARMUP;
            dot.setFillStyle(isWarmup ? 0x142030 : 0x142030)
               .setStrokeStyle(2, isWarmup ? 0x243848 : 0x243848);
        });
    }

    _makeBtn(x, y, label, bg, hover, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 18px monospace', fill: '#e8f0f0',
            backgroundColor: bg, padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hover }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bg }));
        btn.on('pointerdown', cb);
        return btn;
    }
}
