// TitleScene: Cozy title screen with Play / Practice split

import { ProgressionManager } from '../systems/ProgressionManager.js';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Warm background
        this.cameras.main.setBackgroundColor('#1a150e');

        // Floating leaf/note particles
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 1;
            const colors = [0xffcc66, 0x88cc66, 0xffaa44, 0x66aa44];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const leaf = this.add.circle(x, y, size, color, Math.random() * 0.3 + 0.15);
            this.tweens.add({
                targets: leaf,
                y: y + 20 + Math.random() * 30,
                alpha: { from: leaf.alpha, to: 0.05 },
                duration: 3000 + Math.random() * 4000,
                yoyo: true,
                repeat: -1
            });
        }

        // Title
        this.add.text(width / 2, height / 4 - 10, 'MUSIC THEORY\nVILLAGE', {
            font: 'bold 48px monospace',
            fill: '#ffcc00',
            align: 'center',
            stroke: '#2a1a00',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, height / 4 + 80, 'Train Your Ear, Help the Village', {
            font: '18px monospace',
            fill: '#aabb88'
        }).setOrigin(0.5);

        // --- Mode selection ---
        this.add.text(width / 2, height / 2 - 10, 'WHAT WOULD YOU LIKE TO DO?', {
            font: '14px monospace',
            fill: '#aa9977'
        }).setOrigin(0.5);

        // PLAY button — go to character screen then top-down rescue game
        this.createButton(width / 2 - 110, height / 2 + 40, '▶  PLAY', () => {
            this.scene.start('CharacterSelectScene', { isNewGame: true });
        }, '#1a2a18', '#2a5522');

        // PRACTICE button (jump straight to challenge settings)
        this.createButton(width / 2 + 110, height / 2 + 40, 'PRACTICE', () => {
            this.goToPractice();
        }, '#2a2510', '#886622');

        // Instructions
        this.add.text(width / 2, height - 50, 'Identify intervals, tap rhythms, and read notes to help the village!', {
            font: '13px monospace',
            fill: '#776655',
            align: 'center'
        }).setOrigin(0.5);

        // Settings gear
        this.add.text(width - 16, 14, '⚙', {
            font: 'bold 20px monospace', fill: '#665544',
            padding: { x: 6, y: 4 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#bbaa88' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#665544' }); })
            .on('pointerdown', () => {
                this.scene.launch('SettingsScene', { callerKey: null, pauseCaller: false });
            });
    }

    goToPractice() {
        const pm = new ProgressionManager();
        const playerData = pm.load();
        this.scene.start('PracticeMenuScene', { playerData });
    }

    createButton(x, y, text, callback, bgColor = '#2a2a1a', hoverColor = '#3a3a2a') {
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

}
