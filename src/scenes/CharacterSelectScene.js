// CharacterSelectScene: animated hero picker before starting Story Mode

import { CHARACTERS, CHARACTER_ORDER } from '../data/characters.js';
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
        this.cameras.main.setBackgroundColor('#0a0a1a');

        // Starfield
        for (let i = 0; i < 80; i++) {
            const star = this.add.circle(
                Math.random() * width, Math.random() * height,
                Math.random() * 2 + 0.5, 0xffffff, Math.random() * 0.5 + 0.2
            );
            this.tweens.add({
                targets: star, alpha: { from: star.alpha, to: 0.05 },
                duration: 900 + Math.random() * 1800, yoyo: true, repeat: -1
            });
        }

        // Title
        this.add.text(width / 2, 40, 'CHOOSE YOUR HERO', {
            font: 'bold 32px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(width / 2, 78, 'Pick the adventurer you\'ll travel with', {
            font: '14px monospace', fill: '#8899cc'
        }).setOrigin(0.5);

        // Character cards
        this._selectedKey = null;
        this._cards       = [];
        this._previews    = [];

        const cardW   = 200;
        const cardH   = 280;
        const spacing = 260;
        const startX  = width / 2 - (CHARACTER_ORDER.length - 1) * spacing / 2;
        const cardY   = height / 2 + 20;

        CHARACTER_ORDER.forEach((key, i) => {
            const char = CHARACTERS[key];
            const cx   = startX + i * spacing;
            this._buildCard(cx, cardY, cardW, cardH, char);
        });

        // Continue button (starts disabled)
        this.continueBtn = this.add.text(width / 2, height - 44, 'SELECT A HERO FIRST', {
            font: 'bold 20px monospace', fill: '#555566',
            backgroundColor: '#1a1a2a', padding: { x: 28, y: 12 }
        }).setOrigin(0.5);

        this._updateContinueBtn();
    }

    _buildCard(cx, cy, cardW, cardH, char) {
        const isSelected = () => this._selectedKey === char.key;

        // Card background
        const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x111133, 0.9)
            .setStrokeStyle(2, 0x334466);

        // Character sprite preview (animated)
        const preview = this.add.sprite(cx, cy - 60, char.spriteKeys.idle);
        preview.setScale(1.3);
        preview.play(`${char.key}-idle`);
        this._previews.push(preview);

        // Name
        this.add.text(cx, cy + 60, char.displayName, {
            font: 'bold 18px monospace', fill: char.color,
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // Description (word-wrapped)
        this.add.text(cx, cy + 90, char.description, {
            font: '11px monospace', fill: '#aaaacc',
            align: 'center', wordWrap: { width: cardW - 20 }
        }).setOrigin(0.5, 0);

        // Select button
        const btnY = cy + cardH / 2 - 22;
        const btn  = this.add.text(cx, btnY, 'SELECT', {
            font: 'bold 16px monospace', fill: '#ffffff',
            backgroundColor: '#1a3366', padding: { x: 22, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            if (!isSelected()) btn.setStyle({ backgroundColor: '#2244aa' });
        });
        btn.on('pointerout', () => {
            if (!isSelected()) btn.setStyle({ backgroundColor: '#1a3366' });
        });
        btn.on('pointerdown', () => this._selectCharacter(char.key, bg, btn));

        this._cards.push({ key: char.key, bg, btn });
    }

    _selectCharacter(key, selectedBg, selectedBtn) {
        // Reset all cards
        this._cards.forEach(c => {
            c.bg.setStrokeStyle(2, 0x334466).setFillStyle(0x111133, 0.9);
            c.btn.setStyle({ fill: '#ffffff', backgroundColor: '#1a3366' });
        });

        // Highlight chosen
        selectedBg.setStrokeStyle(3, 0xffcc00).setFillStyle(0x1a2244, 0.95);
        selectedBtn.setStyle({ fill: '#ffcc00', backgroundColor: '#334488' });

        this._selectedKey = key;
        this._updateContinueBtn();

        // Play attack anim for selected character, then back to idle
        const preview = this._previews[CHARACTER_ORDER.indexOf(key)];
        if (preview) {
            preview.play(`${key}-attack`);
            preview.once('animationcomplete', () => preview.play(`${key}-idle`));
        }
    }

    _updateContinueBtn() {
        if (this._selectedKey) {
            this.continueBtn
                .setText('START ADVENTURE  ▶')
                .setStyle({ fill: '#ffffff', backgroundColor: '#1a4422' })
                .setInteractive({ useHandCursor: true });
            this.continueBtn.removeAllListeners('pointerdown');
            this.continueBtn.on('pointerover',  () => this.continueBtn.setStyle({ backgroundColor: '#2a6633' }));
            this.continueBtn.on('pointerout',   () => this.continueBtn.setStyle({ backgroundColor: '#1a4422' }));
            this.continueBtn.on('pointerdown',  () => this._startGame());
        } else {
            this.continueBtn
                .setText('SELECT A HERO FIRST')
                .setStyle({ fill: '#555566', backgroundColor: '#1a1a2a' })
                .removeInteractive();
        }
    }

    _startGame() {
        const pm = this.progression || new ProgressionManager();

        let playerData;
        if (!this.isNewGame && this.savedPlayer) {
            // Continue: keep saved stats, just swap character
            playerData = { ...this.savedPlayer, characterKey: this._selectedKey };
        } else {
            pm.deleteSave();
            playerData = {
                hp: 100, maxHp: 100,
                attack: 10, defense: 3,
                level: 1, xp: 0, xpToNext: 100,
                gold: 0,
                characterKey: this._selectedKey
            };
        }

        this.scene.start('SidescrollScene', {
            progression: pm,
            playerData,
            zoneKey: pm.currentZone || 'forest',
            showWorldMap: true,
        });
    }
}
