// CharacterSelectScene: Avatar-based character start screen for Story Mode

import { ProgressionManager } from '../systems/ProgressionManager.js';

export class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSelectScene' });
    }

    init(data) {
        this.isNewGame   = data.isNewGame   ?? true;
        this.progression = data.progression || null;
        this.savedPlayer = data.savedPlayer || null;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#0c1420');

        // Floating particles
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const colors = [0xe8d098, 0x90c8c0, 0xe08868, 0x50d0b0];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const leaf = this.add.circle(x, y, Math.random() * 2 + 1, color, Math.random() * 0.3 + 0.1);
            this.tweens.add({
                targets: leaf, y: y + 20 + Math.random() * 20,
                alpha: { from: leaf.alpha, to: 0.05 },
                duration: 3000 + Math.random() * 4000, yoyo: true, repeat: -1
            });
        }

        // Title
        this.add.text(width / 2, 40, 'YOUR MUSICIAN', {
            font: 'bold 32px monospace', fill: '#e8d098',
            stroke: '#0c1420', strokeThickness: 5
        }).setOrigin(0.5);

        // Avatar preview
        const previewX = width / 2;
        const previewY = height / 2 - 40;

        try {
            if (this.textures.exists('player-avatar')) {
                const fullCanvas = this.textures.get('player-avatar').getSourceImage();
                if (fullCanvas) {
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = 32; cropCanvas.height = 32;
                    const ctx = cropCanvas.getContext('2d');
                    ctx.drawImage(fullCanvas, 0, 0, 32, 32, 0, 0, 32, 32);
                    if (this.textures.exists('char-select-avatar-crop')) {
                        this.textures.remove('char-select-avatar-crop');
                    }
                    this.textures.addCanvas('char-select-avatar-crop', cropCanvas);
                    const preview = this.add.image(previewX, previewY, 'char-select-avatar-crop');
                    preview.setScale(5).setOrigin(0.5);
                }
            }
        } catch (e) {
            console.warn('Avatar preview failed:', e);
        }

        // Ready message
        this.add.text(width / 2, previewY + 100, 'Your avatar is ready!', {
            font: '18px monospace', fill: '#90c8c0'
        }).setOrigin(0.5);

        this.add.text(width / 2, previewY + 126, 'Customize in Settings > Edit Avatar', {
            font: '11px monospace', fill: '#687880'
        }).setOrigin(0.5);

        // Start Adventure button (clean wood sprite or fallback)
        if (this.textures.exists('ui-all') && this.textures.get('ui-all').has('btn-wood')) {
            const btnImg = this.add.image(width / 2, height - 44, 'ui-all', 'btn-wood')
                .setScale(2.8).setOrigin(0.5).setInteractive({ useHandCursor: true });
            btnImg.on('pointerover', () => btnImg.setTint(0xdddddd));
            btnImg.on('pointerout', () => btnImg.clearTint());
            btnImg.on('pointerdown', () => this._startGame());
            this.add.text(width / 2, height - 46, 'START', {
                font: 'bold 16px monospace', fill: '#fff8e0',
                stroke: '#5a3a0a', strokeThickness: 3,
            }).setOrigin(0.5);
        } else {
            const startBtn = this.add.text(width / 2, height - 44, 'START ADVENTURE', {
                font: 'bold 20px monospace', fill: '#e8f0f0',
                backgroundColor: '#142030', padding: { x: 28, y: 12 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            startBtn.on('pointerover', () => startBtn.setStyle({ backgroundColor: '#243848' }));
            startBtn.on('pointerout', () => startBtn.setStyle({ backgroundColor: '#142030' }));
            startBtn.on('pointerdown', () => this._startGame());
        }
    }

    _startGame() {
        const pm = this.progression || new ProgressionManager();

        let playerData;
        if (!this.isNewGame && this.savedPlayer) {
            playerData = { ...this.savedPlayer, characterKey: 'avatar' };
        } else {
            pm.deleteSave();
            playerData = {
                hp: 100, maxHp: 100,
                attack: 10, defense: 3,
                level: 1, xp: 0, xpToNext: 100,
                gold: 0,
                characterKey: 'avatar'
            };
        }

        this.scene.start('TopDownScene', { playerData });
    }
}
