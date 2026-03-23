// BugCatchScene: Sight-reading bug catching mini-game
// Bugs appear on a staff — play the correct note to catch them
// Harder bugs use ledger lines and accidentals

import { AudioEngine } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';

const BUG_TYPES = [
    { name: 'Ladybug',     color: 0xff4444, points: 10, speed: 0.3 },
    { name: 'Butterfly',   color: 0xff88cc, points: 15, speed: 0.4 },
    { name: 'Dragonfly',   color: 0x44ccff, points: 20, speed: 0.5 },
    { name: 'Firefly',     color: 0xffcc00, points: 25, speed: 0.35 },
    { name: 'Beetle',      color: 0x66aa44, points: 30, speed: 0.6 },
    { name: 'Moth',        color: 0xccbbaa, points: 35, speed: 0.7 },
];

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = [
    { afterIdx: 0, note: 'C#' },
    { afterIdx: 1, note: 'D#' },
    { afterIdx: 3, note: 'F#' },
    { afterIdx: 4, note: 'G#' },
    { afterIdx: 5, note: 'A#' },
];

export class BugCatchScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BugCatchScene' });
    }

    init(data) {
        this.playerData  = data.playerData;
        this.progression = data.progression;
        this.returnScene = data.returnScene || 'VillageScene';
        this.returnData  = data.returnData || {};
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#1a2a1a');

        // ── Background — meadow ────────────────────────────
        this.add.rectangle(width / 2, height * 0.3, width, height * 0.6, 0x88ccff, 0.15); // sky
        this.add.rectangle(width / 2, height * 0.7, width, height * 0.6, 0x2a4a1a, 0.4);  // grass

        // Grass blades
        const g = this.add.graphics();
        for (let i = 0; i < 40; i++) {
            const gx = Math.random() * width;
            const gy = height * 0.5 + Math.random() * height * 0.4;
            g.lineStyle(1, 0x3a6a2a, 0.4);
            g.lineBetween(gx, gy, gx + (Math.random() - 0.5) * 6, gy - 10 - Math.random() * 10);
        }

        // ── Systems ─────────────────────────────────────────
        this.audioEngine = new AudioEngine();
        try { await this.audioEngine.init(); } catch(e) {}
        this.noteEngine = new NoteReadingEngine();
        this.staffRenderer = new VexFlowStaffRenderer(this);

        // ── State ───────────────────────────────────────────
        this._score = 0;
        this._bugsCaught = 0;
        this._round = 0;
        this._state = 'waiting'; // waiting, showing, answered
        this._pianoKeys = [];

        // ── HUD ─────────────────────────────────────────────
        this.scoreText = this.add.text(16, 12, 'Bugs: 0  Score: 0', {
            font: 'bold 16px monospace', fill: '#ffcc00',
            stroke: '#000', strokeThickness: 3
        }).setDepth(10);

        this.msgText = this.add.text(width / 2, height * 0.48, 'A bug appeared! What note is it on?', {
            font: 'bold 16px monospace', fill: '#ffffff',
            stroke: '#000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(10);

        // Bug sprite area
        this._bugSprite = null;
        this._bugGfx = this.add.graphics().setDepth(8);

        // Quit button
        this.add.text(width - 16, 12, 'QUIT', {
            font: 'bold 14px monospace', fill: '#887766',
            backgroundColor: '#2a2a1a', padding: { x: 10, y: 5 }
        }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._leave());

        // Start first round
        this._spawnBug();
    }

    _spawnBug() {
        this._round++;
        this._state = 'showing';

        // Pick random bug
        const bug = BUG_TYPES[Math.floor(Math.random() * BUG_TYPES.length)];
        this._currentBug = bug;

        // Generate note question
        const question = this.noteEngine.buildQuestion(this._round, 'treble');
        this._currentQuestion = question;

        // Draw staff with note
        const { width, height } = this.cameras.main;
        this.staffRenderer.clear();
        this.staffRenderer.draw(width / 2, height * 0.22, 350, question);

        // Draw bug near the note
        this._bugGfx.clear();
        const bugX = width / 2 + 60;
        const bugY = height * 0.22;
        this._bugGfx.fillStyle(bug.color, 0.9);
        this._bugGfx.fillCircle(bugX, bugY, 12);
        // Wings
        this._bugGfx.fillStyle(bug.color, 0.4);
        this._bugGfx.fillEllipse(bugX - 10, bugY - 5, 14, 8);
        this._bugGfx.fillEllipse(bugX + 10, bugY - 5, 14, 8);
        // Bug name
        if (this._bugNameText) this._bugNameText.destroy();
        this._bugNameText = this.add.text(bugX, bugY - 25, bug.name, {
            font: '11px monospace', fill: '#ffcc00', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(9);

        // Gentle float animation
        this.tweens.add({
            targets: [this._bugGfx], y: -3,
            duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        this.msgText.setText(`A ${bug.name} appeared! What note is it on?`);

        // Show piano keyboard
        this._buildPiano(question);
    }

    _buildPiano(question) {
        this._clearPiano();
        const { width, height } = this.cameras.main;
        const keyW = 52, keyH = 80, bkeyW = 30, bkeyH = 50;
        const totalW = WHITE_NOTES.length * keyW;
        const startX = width / 2 - totalW / 2;
        const keyTop = height - keyH - 20;

        const submitFn = (note) => {
            if (this._state !== 'showing') return;
            this._submitAnswer(note);
        };

        WHITE_NOTES.forEach((note, i) => {
            const cx = startX + i * keyW + keyW / 2;
            const cy = keyTop + keyH / 2;
            const key = this.add.rectangle(cx, cy, keyW - 2, keyH, 0xeeeedd)
                .setStrokeStyle(1, 0x555544).setDepth(5);
            const lbl = this.add.text(cx, keyTop + keyH - 12, note, {
                font: '12px monospace', fill: '#333322'
            }).setOrigin(0.5).setDepth(6);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0xbbddaa));
            key.on('pointerout', () => key.setFillStyle(0xeeeedd));
            key.on('pointerdown', () => submitFn(note));
            this._pianoKeys.push(key, lbl);
        });

        BLACK_KEYS.forEach(({ afterIdx, note }) => {
            const cx = startX + (afterIdx + 1) * keyW;
            const cy = keyTop + bkeyH / 2;
            const key = this.add.rectangle(cx, cy, bkeyW, bkeyH, 0x222211)
                .setStrokeStyle(1, 0x000000).setDepth(7);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0x335522));
            key.on('pointerout', () => key.setFillStyle(0x222211));
            key.on('pointerdown', () => submitFn(note));
            this._pianoKeys.push(key);
        });
    }

    _submitAnswer(noteName) {
        this._state = 'answered';
        const correct = this.noteEngine.checkAnswer(this._currentQuestion, noteName);
        const bug = this._currentBug;

        if (correct) {
            this._bugsCaught++;
            this._score += bug.points;
            this.audioEngine.playCorrect();
            this.msgText.setText(`Caught the ${bug.name}! +${bug.points} pts`)
                .setStyle({ fill: '#44ff88' });

            // Bug catch animation
            this._bugGfx.clear();
            if (this._bugNameText) this._bugNameText.destroy();
        } else {
            this.audioEngine.playWrong();
            this.msgText.setText(`The ${bug.name} flew away! It was ${this._currentQuestion.correctAnswer}`)
                .setStyle({ fill: '#ffaa66' });

            // Bug flies away
            this.tweens.add({
                targets: this._bugGfx, x: 400, y: -100, alpha: 0,
                duration: 800
            });
        }

        this.scoreText.setText(`Bugs: ${this._bugsCaught}  Score: ${this._score}`);

        // Next round
        this.time.delayedCall(2000, () => {
            this.staffRenderer.clear();
            this._bugGfx.clear();
            this._bugGfx.x = 0; this._bugGfx.y = 0; this._bugGfx.alpha = 1;
            this.msgText.setStyle({ fill: '#ffffff' });
            this._spawnBug();
        });
    }

    _clearPiano() {
        this._pianoKeys.forEach(k => { if (k?.destroy) k.destroy(); });
        this._pianoKeys = [];
    }

    _leave() {
        this.staffRenderer.clear();
        this._clearPiano();
        if (this.audioEngine) this.audioEngine.dispose();
        this.scene.start(this.returnScene, this.returnData);
    }
}
