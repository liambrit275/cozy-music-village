// FishingScene: Rhythm-based fishing mini-game
// Cast line by tapping a rhythm, reel in fish by matching beat patterns
// Uses Cozy Fishing assets and AudioEngine for rhythm

import { AudioEngine } from '../systems/AudioEngine.js';
import { spellPattern } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';

const BPM = 100;
const QUARTER_MS = 60000 / BPM;

const FISH_TYPES = [
    { name: 'Minnow',     difficulty: 'easy',   color: 0x88ccff, points: 10,  beats: 4 },
    { name: 'Trout',      difficulty: 'easy',   color: 0x66aa88, points: 20,  beats: 4 },
    { name: 'Salmon',     difficulty: 'medium', color: 0xff8866, points: 35,  beats: 8 },
    { name: 'Bass',       difficulty: 'medium', color: 0x88aa44, points: 40,  beats: 8 },
    { name: 'Swordfish',  difficulty: 'hard',   color: 0xaabbcc, points: 60,  beats: 8 },
    { name: 'Golden Carp', difficulty: 'hard',  color: 0xffcc00, points: 100, beats: 8 },
];

export class FishingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FishingScene' });
    }

    init(data) {
        this.playerData  = data.playerData;
        this.progression = data.progression;
        this.returnScene = data.returnScene || 'VillageScene';
        this.returnData  = data.returnData || {};
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#1a2a3a');

        // ── Background ────────────────────────────────────
        // Water
        this.add.rectangle(width / 2, height * 0.65, width, height * 0.7, 0x2244aa, 0.3);
        // Shore
        this.add.rectangle(width / 2, height * 0.32, width, height * 0.35, 0x5a4a3a);
        // Sky gradient (light strip at top)
        this.add.rectangle(width / 2, 30, width, 60, 0x3a5a7a, 0.4);

        // Water ripples
        for (let i = 0; i < 8; i++) {
            const rx = Math.random() * width;
            const ry = height * 0.5 + Math.random() * height * 0.4;
            const ripple = this.add.ellipse(rx, ry, 30, 8, 0x4488cc, 0.2);
            this.tweens.add({
                targets: ripple, scaleX: 1.5, alpha: 0,
                duration: 2000 + Math.random() * 2000,
                repeat: -1, delay: Math.random() * 2000
            });
        }

        // ── Player on shore ───────────────────────────────
        const ck = this.playerData?.characterKey || 'char1';
        this.playerSprite = this.add.sprite(120, height * 0.38, `player-${ck}`, 0)
            .setScale(3).setDepth(5);
        if (this.anims.exists(`${ck}-walk-right`)) this.playerSprite.play(`${ck}-walk-right`);

        // Fishing line (graphics)
        this.lineGfx = this.add.graphics().setDepth(4);
        this._bobberX = 350;
        this._bobberY = height * 0.55;

        // Bobber
        this.bobber = this.add.circle(this._bobberX, this._bobberY, 6, 0xff4444).setDepth(5);
        this.tweens.add({
            targets: this.bobber, y: this._bobberY + 4,
            duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // ── State ─────────────────────────────────────────
        this._state = 'waiting';  // waiting, casting, reeling, result
        this._score = 0;
        this._fishCaught = [];
        this._timers = [];

        // ── HUD ───────────────────────────────────────────
        this.scoreText = this.add.text(16, 12, 'Fish: 0  Score: 0', {
            font: 'bold 16px monospace', fill: '#ffcc00',
            stroke: '#000', strokeThickness: 3
        }).setDepth(10);

        this.msgText = this.add.text(width / 2, height * 0.45, 'Press SPACE to cast!', {
            font: 'bold 18px monospace', fill: '#ffffff',
            stroke: '#000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(10);

        // Rhythm grid area
        this._gridObjs = [];

        // ── Audio ─────────────────────────────────────────
        this.audioEngine = new AudioEngine();
        try { await this.audioEngine.init(); } catch(e) {}

        // Notation renderer
        this.notationRenderer = new RhythmNotationRenderer(this);

        // ── Input ─────────────────────────────────────────
        this._keyHandler = (e) => {
            if (e.code === 'Space') { e.preventDefault(); this._onTap(); }
            if (e.code === 'Escape') this._leave();
        };
        document.addEventListener('keydown', this._keyHandler);

        // Quit button
        this.add.text(width - 16, height - 16, 'QUIT', {
            font: 'bold 14px monospace', fill: '#887766',
            backgroundColor: '#2a2a1a', padding: { x: 10, y: 5 }
        }).setOrigin(1, 1).setDepth(10).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._leave());

        this._drawLine();
    }

    _drawLine() {
        this.lineGfx.clear();
        this.lineGfx.lineStyle(2, 0xccccaa, 0.6);
        this.lineGfx.lineBetween(140, this.playerSprite.y - 20, this.bobber.x, this.bobber.y);
    }

    _onTap() {
        if (this._state === 'waiting') {
            this._cast();
        } else if (this._state === 'reeling') {
            this._recordTap();
        }
    }

    _cast() {
        this._state = 'casting';
        this.msgText.setText('A fish is biting...');

        // Pick a random fish
        const fish = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];
        this._currentFish = fish;

        // Animate bobber dip
        const delay = 1000 + Math.random() * 2000;
        this._schedule(() => {
            this.tweens.add({
                targets: this.bobber, y: this._bobberY + 12,
                duration: 200, yoyo: true, repeat: 1
            });
            this.msgText.setText(`${fish.name} is nibbling!\nTap the rhythm to reel it in!`);
            this._startReeling(fish);
        }, delay);
    }

    _startReeling(fish) {
        this._state = 'reeling';
        this._taps = [];
        this._barStart = null;

        // Generate rhythm pattern
        const cells = fish.beats;
        const pattern = new Array(cells).fill(false);
        const noteTarget = Math.max(2, Math.floor(cells * 0.5));
        let placed = 0;
        pattern[0] = true; placed++;
        while (placed < noteTarget) {
            const i = Math.floor(Math.random() * cells);
            if (!pattern[i]) { pattern[i] = true; placed++; }
        }

        this._pattern = pattern;
        this._cellMs = QUARTER_MS;
        this._onsetCells = pattern.reduce((a, v, i) => { if (v) a.push(i); return a; }, []);

        // Build visual grid
        this._buildGrid(pattern, cells);

        // Play the pattern once
        this._playPattern(pattern, cells, () => {
            // Countdown then record
            this.msgText.setText('3...');
            this._schedule(() => this.msgText.setText('2...'), QUARTER_MS);
            this._schedule(() => this.msgText.setText('1...'), QUARTER_MS * 2);
            this._schedule(() => {
                this.msgText.setText('TAP!').setStyle({ fill: '#44ff88' });
                this._barStart = performance.now();

                // End recording after bar
                this._schedule(() => {
                    if (this._state === 'reeling') this._evaluateReel();
                }, cells * this._cellMs + 200);
            }, QUARTER_MS * 3);
        });
    }

    _buildGrid(pattern, cells) {
        this._gridObjs.forEach(o => o?.destroy());
        this._gridObjs = [];
        const { width } = this.cameras.main;
        const GAP = 3, MARGIN = 60;
        const cellW = (width - MARGIN * 2 - GAP * (cells - 1)) / cells;
        const cellH = 36;
        const gridY = this.cameras.main.height * 0.78;

        for (let i = 0; i < cells; i++) {
            const cx = MARGIN + i * (cellW + GAP) + cellW / 2;
            const cy = gridY;
            const isNote = pattern[i];
            const bg = this.add.rectangle(cx, cy, cellW, cellH,
                isNote ? 0x1a3344 : 0x0c1018)
                .setStrokeStyle(1, isNote ? 0x336688 : 0x1a2233).setDepth(6);
            const sym = this.add.text(cx, cy, isNote ? '♪' : '–', {
                font: '16px monospace', fill: isNote ? '#66aacc' : '#334455'
            }).setOrigin(0.5).setDepth(7);
            this._gridObjs.push(bg, sym);
        }
    }

    _playPattern(pattern, cells, onDone) {
        for (let i = 0; i < cells; i++) {
            this._schedule(() => {
                if (pattern[i]) this.audioEngine.playDrumNote();
                this.audioEngine.playClick(i % 4 === 0);
            }, i * this._cellMs);
        }
        this._schedule(onDone, cells * this._cellMs + 200);
    }

    _recordTap() {
        if (!this._barStart) return;
        const t = performance.now() - this._barStart;
        this._taps.push(t);
    }

    _evaluateReel() {
        this._state = 'result';
        const fish = this._currentFish;
        const tol = this._cellMs * 0.45;
        const expected = this._onsetCells.map(i => i * this._cellMs);
        const usedTaps = new Set();

        let hits = 0;
        expected.forEach(exp => {
            let best = -1, bestD = Infinity;
            this._taps.forEach((tap, ti) => {
                if (usedTaps.has(ti)) return;
                const d = Math.abs(tap - exp);
                if (d < tol && d < bestD) { bestD = d; best = ti; }
            });
            if (best >= 0) { usedTaps.add(best); hits++; }
        });

        const accuracy = hits / Math.max(1, expected.length);
        const caught = accuracy >= 0.6;

        if (caught) {
            this._score += fish.points;
            this._fishCaught.push(fish.name);
            this.audioEngine.playCorrect();
            this.msgText.setText(`Caught a ${fish.name}! +${fish.points} pts\n${Math.round(accuracy * 100)}% accuracy`)
                .setStyle({ fill: '#44ff88' });

            // Bobber celebration
            this.tweens.add({
                targets: this.bobber, y: this._bobberY - 40,
                duration: 400, yoyo: true, ease: 'Back.easeOut'
            });
        } else {
            this.audioEngine.playWrong();
            this.msgText.setText(`The ${fish.name} got away!\n${Math.round(accuracy * 100)}% accuracy`)
                .setStyle({ fill: '#ffaa66' });
        }

        this.scoreText.setText(`Fish: ${this._fishCaught.length}  Score: ${this._score}`);

        // Next round
        this._schedule(() => {
            this._gridObjs.forEach(o => o?.destroy());
            this._gridObjs = [];
            this._state = 'waiting';
            this.msgText.setText('Press SPACE to cast again!').setStyle({ fill: '#ffffff' });
        }, 2500);
    }

    _schedule(fn, delayMs) {
        const t = this.time.delayedCall(delayMs, fn, [], this);
        this._timers.push(t);
        return t;
    }

    _leave() {
        this._timers.forEach(t => { if (t?.remove) t.remove(); });
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        if (this.audioEngine) this.audioEngine.dispose();
        this.notationRenderer?.clear();
        this.scene.start(this.returnScene, this.returnData);
    }

    update() {
        this._drawLine();
    }
}
