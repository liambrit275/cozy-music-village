// FarmScene: Interval-based farming mini-game
// Plant seeds, water with correct intervals, grow crops
// Each crop needs a specific interval to grow to the next stage

import { AudioEngine } from '../systems/AudioEngine.js';
import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';

const CROP_TYPES = [
    { name: 'Sunflower', stages: 3, interval: '3',  color: 0xffcc00, points: 20 },
    { name: 'Tomato',    stages: 3, interval: '5',  color: 0xff4444, points: 25 },
    { name: 'Carrot',    stages: 3, interval: '4',  color: 0xff8844, points: 30 },
    { name: 'Blueberry', stages: 4, interval: '6',  color: 0x4466cc, points: 40 },
    { name: 'Pumpkin',   stages: 4, interval: 'b7', color: 0xff8800, points: 50 },
    { name: 'Starfruit', stages: 5, interval: '7',  color: 0xffff44, points: 70 },
];

const PLOT_COLS = 4;
const PLOT_ROWS = 2;

export class FarmScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FarmScene' });
    }

    init(data) {
        this.playerData  = data.playerData;
        this.progression = data.progression;
        this.returnScene = data.returnScene || 'VillageScene';
        this.returnData  = data.returnData || {};
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#2a3a1a');

        // ── Background ────────────────────────────────────
        // Farm ground
        this.add.rectangle(width / 2, height / 2, width, height, 0x3a4a2a);
        // Fence top
        this.add.rectangle(width / 2, 80, width - 40, 4, 0x5a3a1a);
        // Title
        this.add.text(width / 2, 30, 'MUSIC FARM', {
            font: 'bold 28px monospace', fill: '#ffcc00',
            stroke: '#2a1a00', strokeThickness: 4
        }).setOrigin(0.5).setDepth(10);

        this.add.text(width / 2, 60, 'Water crops by identifying the interval!', {
            font: '13px monospace', fill: '#aabb88'
        }).setOrigin(0.5).setDepth(10);

        // ── Audio + Music Theory ──────────────────────────
        this.audioEngine = new AudioEngine();
        try { await this.audioEngine.init(); } catch(e) {}
        this.musicTheory = new MusicTheory();
        this.musicTheory.randomizeRoot();

        // ── Farm plots ────────────────────────────────────
        this._plots = [];
        this._score = 0;
        this._harvested = 0;
        this._selectedPlot = null;

        const plotW = 140, plotH = 100, gapX = 20, gapY = 20;
        const totalW = PLOT_COLS * plotW + (PLOT_COLS - 1) * gapX;
        const totalH = PLOT_ROWS * plotH + (PLOT_ROWS - 1) * gapY;
        const startX = (width - totalW) / 2 + plotW / 2;
        const startY = 120 + plotH / 2;

        for (let row = 0; row < PLOT_ROWS; row++) {
            for (let col = 0; col < PLOT_COLS; col++) {
                const x = startX + col * (plotW + gapX);
                const y = startY + row * (plotH + gapY);
                this._createPlot(x, y, plotW, plotH);
            }
        }

        // ── Solfege buttons ───────────────────────────────
        this._solfegeObjs = [];
        this._buildSolfegeButtons();

        // ── HUD ───────────────────────────────────────────
        this.scoreText = this.add.text(16, height - 30, 'Harvested: 0  Score: 0', {
            font: 'bold 14px monospace', fill: '#ffcc00',
            stroke: '#000', strokeThickness: 3
        }).setDepth(10);

        this.msgText = this.add.text(width / 2, height - 60, 'Click a plot to plant, then identify intervals to water!', {
            font: '12px monospace', fill: '#aabb88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(10);

        // Drone info
        this.droneText = this.add.text(width - 16, height - 30, '', {
            font: '12px monospace', fill: '#88aacc',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0).setDepth(10);

        // Quit
        this.add.text(width - 16, 12, 'QUIT', {
            font: 'bold 14px monospace', fill: '#887766',
            backgroundColor: '#2a2a1a', padding: { x: 10, y: 5 }
        }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._leave());
    }

    _createPlot(x, y, w, h) {
        const plot = {
            x, y, w, h,
            crop: null, stage: 0, maxStages: 0,
            waitingForAnswer: false,
            currentInterval: null
        };

        // Soil rectangle
        plot.bg = this.add.rectangle(x, y, w, h, 0x4a3a2a)
            .setStrokeStyle(2, 0x3a2a1a).setDepth(2);
        plot.bg.setInteractive({ useHandCursor: true });
        plot.bg.on('pointerdown', () => this._onPlotClick(plot));

        // Crop label
        plot.label = this.add.text(x, y - 10, '', {
            font: 'bold 12px monospace', fill: '#88cc66',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(3);

        // Stage indicator
        plot.stageText = this.add.text(x, y + 15, '', {
            font: '10px monospace', fill: '#aabb88'
        }).setOrigin(0.5).setDepth(3);

        // Crop visual (circle that grows)
        plot.cropGfx = this.add.graphics().setDepth(4);

        this._plots.push(plot);
    }

    _onPlotClick(plot) {
        if (!plot.crop) {
            // Plant a random crop
            const crop = CROP_TYPES[Math.floor(Math.random() * CROP_TYPES.length)];
            plot.crop = crop;
            plot.stage = 0;
            plot.maxStages = crop.stages;
            plot.label.setText(crop.name);
            plot.stageText.setText(`Stage: 0/${crop.stages}`);
            this._drawCrop(plot);
            this.msgText.setText(`Planted ${crop.name}! Needs interval "${SCALE_DEGREES[crop.interval]?.solfege || crop.interval}" to grow.`);
            return;
        }

        if (plot.stage >= plot.maxStages) {
            // Harvest!
            this._harvested++;
            this._score += plot.crop.points;
            this.scoreText.setText(`Harvested: ${this._harvested}  Score: ${this._score}`);
            this.msgText.setText(`Harvested ${plot.crop.name}! +${plot.crop.points} pts`);
            this.audioEngine.playCorrect();

            // Reset plot
            plot.crop = null;
            plot.stage = 0;
            plot.label.setText('');
            plot.stageText.setText('');
            plot.cropGfx.clear();
            plot.bg.setFillStyle(0x4a3a2a);
            plot.waitingForAnswer = false;
            return;
        }

        // Water: play the interval and wait for answer
        if (plot.waitingForAnswer) return;
        plot.waitingForAnswer = true;
        this._selectedPlot = plot;

        // Play drone + interval
        this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
        this.droneText.setText(`Root: ${this.musicTheory.rootNote}`);

        const interval = plot.crop.interval;
        plot.currentInterval = interval;
        const freq = this.musicTheory.getIntervalFreq(interval);

        this.time.delayedCall(400, () => {
            this.audioEngine.playInterval(freq, '2n');
        });

        this.msgText.setText(`Listen! What interval does ${plot.crop.name} need?`);
        plot.bg.setStrokeStyle(3, 0xffcc00);
    }

    _buildSolfegeButtons() {
        const { width, height } = this.cameras.main;
        const degrees = ['1', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
        const btnY = height - 105;
        const btnSpacing = 65;
        const startX = width / 2 - (degrees.length - 1) * btnSpacing / 2;

        degrees.forEach((deg, i) => {
            const info = SCALE_DEGREES[deg];
            if (!info) return;
            const x = startX + i * btnSpacing;
            const btn = this.add.text(x, btnY, info.solfege, {
                font: 'bold 14px monospace', fill: info.color,
                backgroundColor: '#1a1a2a', padding: { x: 6, y: 4 },
                stroke: '#000', strokeThickness: 1
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);

            btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a2a3a' }));
            btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1a1a2a' }));
            btn.on('pointerdown', () => this._submitInterval(deg));
            this._solfegeObjs.push(btn);
        });
    }

    _submitInterval(degree) {
        const plot = this._selectedPlot;
        if (!plot || !plot.waitingForAnswer) return;

        const correct = degree === plot.currentInterval;
        plot.waitingForAnswer = false;
        plot.bg.setStrokeStyle(2, 0x3a2a1a);

        if (correct) {
            plot.stage++;
            plot.stageText.setText(`Stage: ${plot.stage}/${plot.maxStages}`);
            this._drawCrop(plot);
            this.audioEngine.playCorrect();

            if (plot.stage >= plot.maxStages) {
                this.msgText.setText(`${plot.crop.name} is ready to harvest! Click it!`);
                plot.bg.setStrokeStyle(3, 0x44ff44);
            } else {
                this.msgText.setText(`Correct! ${plot.crop.name} grew to stage ${plot.stage}!`);
            }
        } else {
            this.audioEngine.playWrong();
            const correctSolfege = SCALE_DEGREES[plot.currentInterval]?.solfege || plot.currentInterval;
            this.msgText.setText(`Not quite! It was ${correctSolfege}. Try again!`);
        }

        this.audioEngine.stopDrone();
        this.droneText.setText('');
        this._selectedPlot = null;

        // Randomize root for next watering
        this.musicTheory.randomizeRoot();
    }

    _drawCrop(plot) {
        plot.cropGfx.clear();
        if (!plot.crop || plot.stage === 0) {
            // Seed: tiny dot
            plot.cropGfx.fillStyle(0x5a4a3a, 1);
            plot.cropGfx.fillCircle(plot.x, plot.y, 4);
            return;
        }

        const progress = plot.stage / plot.maxStages;
        const size = 8 + progress * 20;
        const color = plot.crop.color;

        // Stem
        plot.cropGfx.lineStyle(2, 0x2a6a1a, 1);
        plot.cropGfx.lineBetween(plot.x, plot.y + 15, plot.x, plot.y - size);

        // Leaves
        if (plot.stage >= 2) {
            plot.cropGfx.fillStyle(0x3a8a2a, 0.8);
            plot.cropGfx.fillEllipse(plot.x - 8, plot.y, 10, 5);
            plot.cropGfx.fillEllipse(plot.x + 8, plot.y - 5, 10, 5);
        }

        // Fruit/flower
        plot.cropGfx.fillStyle(color, 0.9);
        plot.cropGfx.fillCircle(plot.x, plot.y - size, size * 0.6);

        if (plot.stage >= plot.maxStages) {
            // Sparkle when ready
            plot.cropGfx.fillStyle(0xffffff, 0.5);
            plot.cropGfx.fillCircle(plot.x - 5, plot.y - size - 5, 2);
            plot.cropGfx.fillCircle(plot.x + 6, plot.y - size + 3, 2);
        }
    }

    _leave() {
        this.audioEngine.stopDrone();
        this.audioEngine.dispose();
        this.scene.start(this.returnScene, this.returnData);
    }
}
