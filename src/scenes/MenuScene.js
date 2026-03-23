// MenuScene: Title screen with Story Mode / Arcade Mode split

import { ProgressionManager } from '../systems/ProgressionManager.js';
import { WorldMapProgress } from '../systems/WorldMapProgress.js';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background
        this.cameras.main.setBackgroundColor('#0a0a1a');

        // Starfield effect
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 1;
            const star = this.add.circle(x, y, size, 0xffffff, Math.random() * 0.5 + 0.3);
            this.tweens.add({
                targets: star,
                alpha: { from: star.alpha, to: 0.1 },
                duration: 1000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1
            });
        }

        // Title
        this.add.text(width / 2, height / 4, 'MUSIC THEORY\nMONSTER BATTLE', {
            font: 'bold 48px monospace',
            fill: '#ffcc00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, height / 4 + 80, 'Train Your Ear, Slay the Monsters', {
            font: '18px monospace',
            fill: '#88aaff'
        }).setOrigin(0.5);

        // --- Mode selection header ---
        this.add.text(width / 2, height / 2 - 10, 'SELECT MODE', {
            font: '14px monospace',
            fill: '#aaaacc'
        }).setOrigin(0.5);

        // STORY MODE button
        this.createButton(width / 2 - 110, height / 2 + 40, 'STORY MODE', () => {
            this.showStoryOptions();
        }, '#1a2a44', '#2244aa');

        // ARCADE MODE button
        this.createButton(width / 2 + 110, height / 2 + 40, 'ARCADE MODE', () => {
            this.goToArcade();
        }, '#2a1a10', '#aa6622');


        // Story sub-buttons (hidden initially)
        const pm = new ProgressionManager();
        const saveData = pm.load();

        this.newGameBtn = this.createButton(width / 2, height / 2 + 165, 'NEW GAME', () => {
            this.startNewGame();
        }).setVisible(false);

        if (saveData) {
            this.continueBtn = this.createButton(width / 2, height / 2 + 220, 'CONTINUE', () => {
                this.continueGame(pm);
            }).setVisible(false);
        }

        // Instructions
        this.add.text(width / 2, height - 50, 'Identify intervals, tap rhythms, and read notes!', {
            font: '13px monospace',
            fill: '#555577',
            align: 'center'
        }).setOrigin(0.5);

        // Settings gear button — top right
        this.add.text(width - 16, 14, '⚙', {
            font: 'bold 20px monospace', fill: '#445566',
            padding: { x: 6, y: 4 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#aabbff' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#445566' }); })
            .on('pointerdown', () => {
                this.scene.launch('SettingsScene', { callerKey: null, pauseCaller: false });
            });
    }

    showStoryOptions() {
        this.newGameBtn.setVisible(true);
        if (this.continueBtn) this.continueBtn.setVisible(true);
    }

    goToArcade() {
        const pm = new ProgressionManager();
        const playerData = pm.load();
        this.scene.start('ArcadeMenuScene', { playerData });
    }

    goToPractice() {
        const pm = new ProgressionManager();
        const settings = pm.loadArcadeSettings() || {};
        this.scene.start('PracticeScene', {
            mode: 'all',
            returnScene: 'MenuScene',
            settings,
        });
    }

    createButton(x, y, text, callback, bgColor = '#333366', hoverColor = '#444488') {
        const btn = this.add.text(x, y, text, {
            font: 'bold 22px monospace',
            fill: '#ffffff',
            backgroundColor: bgColor,
            padding: { x: 24, y: 12 },
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            btn.setStyle({ fill: '#ffcc00', backgroundColor: hoverColor });
        });
        btn.on('pointerout', () => {
            btn.setStyle({ fill: '#ffffff', backgroundColor: bgColor });
        });
        btn.on('pointerdown', callback);

        return btn;
    }

    startNewGame() {
        const pm = new ProgressionManager();
        pm.deleteSave();
        WorldMapProgress.deleteAll();
        this.scene.start('CharacterSelectScene', { isNewGame: true, progression: pm });
    }

    continueGame(pm) {
        const savedPlayer = pm.load();
        this.scene.start('CharacterSelectScene', {
            isNewGame:   false,
            progression: pm,
            savedPlayer
        });
    }
}
