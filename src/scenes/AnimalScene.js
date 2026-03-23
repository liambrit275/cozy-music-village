// AnimalScene: Befriend animals through music
// Each animal has a "song" (sequence of intervals) — learn it by ear to befriend them
// Successfully playing their song makes them follow you

import { AudioEngine } from '../systems/AudioEngine.js';
import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';

const ANIMALS = [
    { name: 'Baby Bunny',   sprite: 'villager-bunny-baby',   song: ['1', '3'],           color: '#ffaacc', points: 15 },
    { name: 'Baby Chick',   sprite: 'villager-chicken-baby',  song: ['1', '5'],           color: '#ffdd44', points: 15 },
    { name: 'Robin',        sprite: 'villager-robin',          song: ['1', '3', '5'],      color: '#ff8866', points: 25 },
    { name: 'Squirrel',     sprite: 'villager-squirrel',       song: ['1', '2', '3'],      color: '#aa8844', points: 25 },
    { name: 'Blackbird',    sprite: 'villager-blackbird',      song: ['5', '3', '1'],      color: '#444466', points: 30 },
    { name: 'Baby Cow',     sprite: 'villager-cow-baby',       song: ['1', '3', '5', '3'], color: '#88aa66', points: 40 },
    { name: 'Rat',          sprite: 'villager-rat',            song: ['1', '4', '5', '1'], color: '#998877', points: 35 },
];

export class AnimalScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AnimalScene' });
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

        // Background — forest meadow
        this.add.rectangle(width / 2, height * 0.3, width, height * 0.6, 0x2a5a2a, 0.3);
        this.add.rectangle(width / 2, height * 0.75, width, height * 0.5, 0x2a3a1a, 0.5);

        // Title
        this.add.text(width / 2, 24, 'ANIMAL FRIENDS', {
            font: 'bold 26px monospace', fill: '#ffcc00',
            stroke: '#2a1a00', strokeThickness: 4
        }).setOrigin(0.5).setDepth(10);

        this.add.text(width / 2, 52, 'Listen to their song, then play it back!', {
            font: '13px monospace', fill: '#aabb88'
        }).setOrigin(0.5).setDepth(10);

        // ── Audio + Music Theory ──────────────────────────
        this.audioEngine = new AudioEngine();
        try { await this.audioEngine.init(); } catch(e) {}
        this.musicTheory = new MusicTheory();
        this.musicTheory.randomizeRoot();

        // ── State ─────────────────────────────────────────
        this._score = 0;
        this._befriended = [];
        this._currentAnimal = null;
        this._songIndex = 0;
        this._playerSong = [];
        this._state = 'idle'; // idle, listening, playing, result

        // ── Animal display ────────────────────────────────
        this._animalSprite = null;
        this._animalNameText = this.add.text(width / 2, 140, '', {
            font: 'bold 18px monospace', fill: '#88cc66',
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(5);

        this._songDisplay = this.add.text(width / 2, 170, '', {
            font: '14px monospace', fill: '#aabb88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);

        // ── Message ───────────────────────────────────────
        this.msgText = this.add.text(width / 2, height * 0.48, 'Press SPACE to call an animal!', {
            font: 'bold 16px monospace', fill: '#ffffff',
            stroke: '#000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(10);

        // ── Solfege buttons ───────────────────────────────
        this._solfegeObjs = [];
        this._buildSolfegeButtons();

        // ── HUD ───────────────────────────────────────────
        this.scoreText = this.add.text(16, height - 28, 'Friends: 0  Score: 0', {
            font: 'bold 14px monospace', fill: '#ffcc00',
            stroke: '#000', strokeThickness: 3
        }).setDepth(10);

        this.droneText = this.add.text(width - 16, height - 28, '', {
            font: '12px monospace', fill: '#88aacc',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0).setDepth(10);

        // ── Input ─────────────────────────────────────────
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this._state === 'idle') this._callAnimal();
        });

        // Quit
        this.add.text(width - 16, 12, 'QUIT', {
            font: 'bold 14px monospace', fill: '#887766',
            backgroundColor: '#2a2a1a', padding: { x: 10, y: 5 }
        }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this._leave());
    }

    _callAnimal() {
        this._state = 'listening';

        // Pick random un-befriended animal
        const available = ANIMALS.filter(a => !this._befriended.includes(a.name));
        if (available.length === 0) {
            this.msgText.setText('All animals are your friends!');
            this._state = 'idle';
            return;
        }

        const animal = available[Math.floor(Math.random() * available.length)];
        this._currentAnimal = animal;
        this._playerSong = [];
        this._songIndex = 0;

        // Show animal sprite
        const { width } = this.cameras.main;
        if (this._animalSprite) this._animalSprite.destroy();
        if (this.textures.exists(animal.sprite)) {
            this._animalSprite = this.add.sprite(width / 2, 110, animal.sprite, 0)
                .setScale(4).setDepth(4);
            const animalName = animal.sprite.replace('villager-', '');
            const idleKey = `${animalName}-idle`;
            if (this.anims.exists(idleKey)) this._animalSprite.play(idleKey);
        }

        this._animalNameText.setText(animal.name).setStyle({ fill: animal.color });
        this._songDisplay.setText('Song: ' + animal.song.map(d => SCALE_DEGREES[d]?.solfege || d).join(' → '));

        // Start drone
        this.musicTheory.randomizeRoot();
        this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
        this.droneText.setText(`Root: ${this.musicTheory.rootNote}`);

        this.msgText.setText(`${animal.name} is singing their song...`);

        // Play the song
        this._playSong(animal.song, () => {
            this._state = 'playing';
            this.msgText.setText('Now play it back! Click the solfege buttons.');
        });
    }

    _playSong(song, onDone) {
        song.forEach((degree, i) => {
            this.time.delayedCall(i * 800 + 500, () => {
                const freq = this.musicTheory.getIntervalFreq(degree);
                this.audioEngine.playInterval(freq, '4n');

                // Highlight current note
                this._songDisplay.setText(
                    'Song: ' + song.map((d, j) => {
                        const s = SCALE_DEGREES[d]?.solfege || d;
                        return j === i ? `[${s}]` : s;
                    }).join(' → ')
                );
            });
        });

        this.time.delayedCall(song.length * 800 + 800, onDone);
    }

    _buildSolfegeButtons() {
        const { width, height } = this.cameras.main;
        const degrees = ['1', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
        const btnY = height - 70;
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
            btn.on('pointerdown', () => this._submitNote(deg));
            this._solfegeObjs.push(btn);
        });
    }

    _submitNote(degree) {
        if (this._state !== 'playing') return;
        const animal = this._currentAnimal;
        if (!animal) return;

        // Play the note
        const freq = this.musicTheory.getIntervalFreq(degree);
        this.audioEngine.playInterval(freq, '8n');

        this._playerSong.push(degree);
        const idx = this._playerSong.length - 1;
        const expected = animal.song[idx];

        if (degree !== expected) {
            // Wrong!
            this._state = 'result';
            this.audioEngine.playWrong();
            const correctSolfege = SCALE_DEGREES[expected]?.solfege || expected;
            this.msgText.setText(`Wrong note! Expected ${correctSolfege}. ${animal.name} ran away...`)
                .setStyle({ fill: '#ffaa66' });

            if (this._animalSprite) {
                this.tweens.add({
                    targets: this._animalSprite, x: -100, alpha: 0,
                    duration: 600
                });
            }

            this._resetAfterDelay();
            return;
        }

        // Update display
        this._songDisplay.setText(
            'Song: ' + animal.song.map((d, j) => {
                const s = SCALE_DEGREES[d]?.solfege || d;
                if (j < this._playerSong.length) return `✓${s}`;
                return s;
            }).join(' → ')
        );

        if (this._playerSong.length >= animal.song.length) {
            // Complete! Befriended!
            this._state = 'result';
            this._befriended.push(animal.name);
            this._score += animal.points;
            this.audioEngine.playCorrect();
            this.audioEngine.playVictory();

            this.msgText.setText(`${animal.name} is your friend now! +${animal.points} pts`)
                .setStyle({ fill: '#44ff88' });

            this.scoreText.setText(`Friends: ${this._befriended.length}  Score: ${this._score}`);

            // Happy animation
            if (this._animalSprite) {
                this.tweens.add({
                    targets: this._animalSprite, y: this._animalSprite.y - 20,
                    duration: 300, yoyo: true, repeat: 2, ease: 'Bounce.easeOut'
                });
            }

            this._resetAfterDelay();
        }
    }

    _resetAfterDelay() {
        this.time.delayedCall(3000, () => {
            this.audioEngine.stopDrone();
            this.droneText.setText('');
            this._state = 'idle';
            this._songDisplay.setText('');
            this.msgText.setText('Press SPACE to call another animal!').setStyle({ fill: '#ffffff' });
            if (this._animalSprite) { this._animalSprite.destroy(); this._animalSprite = null; }
            this._animalNameText.setText('');
        });
    }

    _leave() {
        this.audioEngine.stopDrone();
        this.audioEngine.dispose();
        this.scene.start(this.returnScene, this.returnData);
    }
}
