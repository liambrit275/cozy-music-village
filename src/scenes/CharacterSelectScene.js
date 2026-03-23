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
        this.cameras.main.setBackgroundColor('#1a150e');

        // Floating particles
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const colors = [0xffcc66, 0x88cc66, 0xffaa44, 0x66aa44];
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
            font: 'bold 32px monospace', fill: '#ffcc00',
            stroke: '#2a1a00', strokeThickness: 5
        }).setOrigin(0.5);

        // Avatar preview
        const previewX = width / 2;
        const previewY = height / 2 - 40;

        if (this.textures.exists('player-avatar')) {
            // Show a single 32x32 frame crop of the avatar at large scale
            const fullCanvas = this.textures.get('player-avatar').getSourceImage();
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

        // Ready message
        this.add.text(width / 2, previewY + 100, 'Your avatar is ready!', {
            font: '18px monospace', fill: '#aabb88'
        }).setOrigin(0.5);

        this.add.text(width / 2, previewY + 126, 'Customize in Settings > Edit Avatar', {
            font: '11px monospace', fill: '#667755'
        }).setOrigin(0.5);

        // Start Adventure button
        const startBtn = this.add.text(width / 2, height - 44, 'START ADVENTURE  ▶', {
            font: 'bold 20px monospace', fill: '#ffffff',
            backgroundColor: '#2a4422', padding: { x: 28, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        startBtn.on('pointerover',  () => startBtn.setStyle({ backgroundColor: '#3a6633' }));
        startBtn.on('pointerout',   () => startBtn.setStyle({ backgroundColor: '#2a4422' }));
        startBtn.on('pointerdown',  () => this._startGame());
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
