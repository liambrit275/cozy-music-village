// WorldMapScene: Visual world map with 4 themed region cards.
// Each card shows the zone background, an animated sunny animal, and rescue status.

import { WORLD_REGIONS } from '../data/worldMap.js';
import { WorldMapProgress } from '../systems/WorldMapProgress.js';

export class WorldMapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WorldMapScene' });
    }

    init(data) {
        this.playerData  = data.playerData || null;
        this.returnScene = data.returnScene || null;
        this.progression = data.progression || null;
        this.currentZone = data.currentZone || 'forest';
    }

    create() {
        const { width, height } = this.cameras.main;
        this.wmProgress = WorldMapProgress.load();

        this.cameras.main.setBackgroundColor('#060c14');
        this._drawBackground(width, height);
        this._drawTitle(width);
        this._drawRegionCards(width, height);
        this._drawBackBtn(width, height);
    }

    _drawBackground(width, height) {
        const g = this.add.graphics();
        // Subtle grid
        g.lineStyle(1, 0x1a2a3a, 0.15);
        for (let x = 0; x < width; x += 60) g.lineBetween(x, 56, x, height);
        for (let y = 56; y < height; y += 60) g.lineBetween(0, y, width, y);
        // Top bar
        g.fillStyle(0x0a1020, 1);
        g.fillRect(0, 0, width, 56);
        g.lineStyle(1, 0x334466, 0.5);
        g.lineBetween(0, 56, width, 56);
    }

    _drawTitle(width) {
        this.add.text(width / 2, 28, '✦  RESCUE MAP  ✦', {
            font: 'bold 22px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        const totalRegions = WORLD_REGIONS.length;
        const saved = WORLD_REGIONS.filter(r => this.wmProgress.isCompleted(r.location.id)).length;
        const remaining = totalRegions - saved;

        const subMsg = remaining === 0
            ? '✓ All friends have been rescued!'
            : `${saved} rescued · ${remaining} still need your help`;

        this.add.text(width / 2, 595, subMsg, {
            font: '12px monospace',
            fill: remaining === 0 ? '#88ff88' : '#ff9966'
        }).setOrigin(0.5);
    }

    _drawRegionCards(width, height) {
        const cardW = 170, cardH = 260;
        const gap = 18;
        const totalW = WORLD_REGIONS.length * (cardW + gap) - gap;
        const startX = width / 2 - totalW / 2 + cardW / 2;
        const cardY = height / 2 + 10;

        WORLD_REGIONS.forEach((region, i) => {
            const x = startX + i * (cardW + gap);
            this._drawRegionCard(region, x, cardY, cardW, cardH);
        });
    }

    _drawRegionCard(region, x, y, w, h) {
        const saved = this.wmProgress.isCompleted(region.location.id);

        // Card shadow
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.5);
        shadow.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w, h, 14);

        // Card background — use zone background image as card fill
        const bgImg = this.add.image(x, y, region.backgroundKey)
            .setDisplaySize(w, h).setDepth(0);
        // Rounded mask
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
        bgImg.setMask(maskShape.createGeometryMask());

        // Dark overlay so text is readable
        const overlay = this.add.graphics().setDepth(1);
        overlay.fillStyle(0x000000, 0.45);
        overlay.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);

        // Saved golden glow border vs region color border
        const border = this.add.graphics().setDepth(2);
        if (saved) {
            border.lineStyle(3, 0xffcc00, 1);
        } else {
            border.lineStyle(2, region.color, 0.8);
        }
        border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);

        // Animated animal sprite
        const animalY = y - 30;
        const animal = this.add.sprite(x, animalY, region.animalKey).setDepth(3);
        animal.setScale(region.animalScale);
        animal.play(region.animalAnimKey);

        if (saved) {
            // Golden glow behind rescued animal
            const glow = this.add.circle(x, animalY, 40, 0xffcc00, 0.2).setDepth(2);
            this.tweens.add({
                targets: glow, alpha: { from: 0.15, to: 0.35 },
                duration: 800, yoyo: true, repeat: -1
            });
        } else {
            // Dim the animal + cage bars effect
            animal.setAlpha(0.5);
            const bars = this.add.graphics().setDepth(4);
            bars.lineStyle(2, 0x666666, 0.6);
            for (let bx = x - 20; bx <= x + 20; bx += 10) {
                bars.lineBetween(bx, animalY - 28, bx, animalY + 28);
            }
            // Top and bottom bars
            bars.lineBetween(x - 22, animalY - 28, x + 22, animalY - 28);
            bars.lineBetween(x - 22, animalY + 28, x + 22, animalY + 28);
        }

        // Region name
        this.add.text(x, y + 48, region.label, {
            font: 'bold 13px monospace', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
            align: 'center', wordWrap: { width: w - 16 }
        }).setOrigin(0.5).setDepth(3);

        // Subtitle
        this.add.text(x, y + 68, region.subtitle, {
            font: '10px monospace', fill: '#999999'
        }).setOrigin(0.5).setDepth(3);

        // Status
        const isCurrentZone = region.zoneKey === this.currentZone;
        const statusText = saved
            ? (isCurrentZone ? '✓ You are here' : '✓ Travel here')
            : `Rescue ${region.animalName}`;
        const statusColor = saved ? '#88ff88' : region.textColor;
        this.add.text(x, y + 88, statusText, {
            font: 'bold 11px monospace', fill: statusColor
        }).setOrigin(0.5).setDepth(3);

        // Current zone indicator
        if (isCurrentZone) {
            const marker = this.add.text(x, y - h / 2 - 10, '▼ HERE', {
                font: 'bold 9px monospace', fill: '#88ff88',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(4);
            this.tweens.add({
                targets: marker, y: marker.y - 4,
                duration: 600, yoyo: true, repeat: -1
            });
        }

        // Difficulty indicator for replays
        const completionCount = this.wmProgress.getCompletionCount(region.location.id);
        if (completionCount > 0) {
            const diffLabel = `Lv.${completionCount + 1}`;
            this.add.text(x + w / 2 - 10, y - h / 2 + 14, diffLabel, {
                font: 'bold 10px monospace', fill: '#ffcc00',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(1, 0).setDepth(4);
        }

        // Interactivity
        const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(5);
        zone.on('pointerover', () => {
            border.clear();
            border.lineStyle(3, saved ? 0xffee44 : 0xffffff, 1);
            border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
            overlay.clear();
            overlay.fillStyle(0x000000, 0.3);
            overlay.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
        });
        zone.on('pointerout', () => {
            border.clear();
            border.lineStyle(saved ? 3 : 2, saved ? 0xffcc00 : region.color, saved ? 1 : 0.8);
            border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
            overlay.clear();
            overlay.fillStyle(0x000000, 0.45);
            overlay.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
        });
        zone.on('pointerdown', () => {
            this.scene.pause('WorldMapScene');
            this.scene.launch('LocationInfoScene', {
                location:    region.location,
                region:      region,
                playerData:  this.playerData,
                progression: this.progression,
                currentZone: this.currentZone,
                returnScene: this.returnScene,
            });
        });
    }

    _drawBackBtn(width, height) {
        const label = this.returnScene ? '← BACK' : '← MENU';
        const btn = this.add.text(60, height - 28, label, {
            font: 'bold 15px monospace', fill: '#aaaacc',
            backgroundColor: '#111122', padding: { x: 12, y: 7 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setStyle({ fill: '#ffcc00' }));
        btn.on('pointerout',  () => btn.setStyle({ fill: '#aaaacc' }));
        btn.on('pointerdown', () => {
            if (this.returnScene) {
                this.scene.stop('WorldMapScene');
                this.scene.resume(this.returnScene);
            } else {
                this.scene.start('MenuScene');
            }
        });
    }
}
