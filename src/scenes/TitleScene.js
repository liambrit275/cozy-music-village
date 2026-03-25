// TitleScene: Cozy title screen with Play / Practice split

import { ProgressionManager } from '../systems/ProgressionManager.js';  // used by goToPractice

export class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        this.cameras.main.setBackgroundColor('#0c1420');

        // Floating particles
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 1;
            const colors = [0x90c8c0, 0x50d0b0, 0xe8d098, 0x687880];
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
            fill: '#e8d098',
            align: 'center',
            stroke: '#0c1420',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, height / 4 + 80, 'Train Your Ear, Help the Village', {
            font: '18px monospace',
            fill: '#90c8c0'
        }).setOrigin(0.5);

        // --- Mode selection ---
        this.add.text(width / 2, height / 2 - 10, 'WHAT WOULD YOU LIKE TO DO?', {
            font: '14px monospace',
            fill: '#687880'
        }).setOrigin(0.5);

        // STORY button
        this.createButton(width / 2 - 100, height / 2 + 40, '▶  STORY', () => {
            this.scene.start('CharacterSelectScene', { isNewGame: true });
        }, '#142030', '#243848');

        // ARCADE button
        this.createButton(width / 2 + 100, height / 2 + 40, 'ARCADE', () => {
            this.goToPractice();
        }, '#142030', '#243848');

        // Instructions
        this.add.text(width / 2, height - 50, 'Identify intervals, tap rhythms, and read notes to help the village!', {
            font: '13px monospace',
            fill: '#687880',
            align: 'center'
        }).setOrigin(0.5);

        // Settings gear
        this.add.text(width - 16, 10, '⚙', {
            font: 'bold 28px monospace', fill: '#687880',
            padding: { x: 4, y: 2 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#90c8c0' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#687880' }); })
            .on('pointerdown', () => {
                this.scene.launch('SettingsScene', { callerKey: null, pauseCaller: false });
            });
    }

    goToPractice() {
        const pm = new ProgressionManager();
        const playerData = pm.load();
        this.scene.start('ArcadeMenuScene', { playerData });
    }

    createButton(x, y, text, callback, bgColor = '#142030', hoverColor = '#243848') {
        const btn = this.add.text(x, y, text, {
            font: 'bold 22px monospace',
            fill: '#e8f0f0',
            backgroundColor: bgColor,
            padding: { x: 24, y: 12 },
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            btn.setStyle({ fill: '#e8d098', backgroundColor: hoverColor });
        });
        btn.on('pointerout', () => {
            btn.setStyle({ fill: '#e8f0f0', backgroundColor: bgColor });
        });
        btn.on('pointerdown', callback);

        return btn;
    }

}
