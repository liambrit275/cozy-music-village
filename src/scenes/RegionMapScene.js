// RegionMapScene: Shows 6 location nodes for one region.

import { getRegionById } from '../data/worldMap.js';
import { WorldMapProgress } from '../systems/WorldMapProgress.js';
import { getNpcForLocation } from '../data/npcs.js';

// 6 nodes in a 3×2 grid
const NODE_POSITIONS = [
    { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
    { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
];

export class RegionMapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RegionMapScene' });
    }

    init(data) {
        this.region      = getRegionById(data.regionId);
        this.playerData  = data.playerData || null;
        this.returnScene = data.returnScene || null;
    }

    create() {
        if (!this.region) {
            this.scene.start('WorldMapScene', { playerData: this.playerData, returnScene: this.returnScene });
            return;
        }

        const { width, height } = this.cameras.main;
        this.wmProgress = WorldMapProgress.load();

        this.cameras.main.setBackgroundColor('#1a150e');
        this._drawBackground(width, height);
        this._drawHeader(width);
        this._drawNodes(width, height);
        this._drawBackBtn(height);
    }

    _drawBackground(width, height) {
        const g = this.add.graphics();

        // Subtle grid
        g.lineStyle(1, 0x1a2a3a, 0.2);
        for (let x = 0; x < width; x += 50) g.lineBetween(x, 80, x, height);
        for (let y = 80; y < height; y += 50) g.lineBetween(0, y, width, y);

        // Header bar
        g.fillStyle(this.region.color, 0.25);
        g.fillRect(0, 0, width, 78);
        g.lineStyle(1, this.region.color, 0.5);
        g.lineBetween(0, 78, width, 78);
    }

    _drawHeader(width) {
        this.add.text(width / 2, 22, this.region.iconGlyph + '  ' + this.region.label, {
            font: 'bold 24px monospace', fill: this.region.textColor,
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(width / 2, 56, this.region.description, {
            font: '11px monospace', fill: '#888888', align: 'center',
            wordWrap: { width: 680 }
        }).setOrigin(0.5);
    }

    _drawNodes(width, height) {
        const cols = 3, rows = 2;
        const colSpacing = 220, rowSpacing = 185;
        const gridW = (cols - 1) * colSpacing;
        const gridH = (rows - 1) * rowSpacing;
        const originX = width / 2 - gridW / 2;
        const originY = 90 + (height - 90 - 60) / 2 - gridH / 2 + 20;

        // Draw connecting lines first
        const g = this.add.graphics();
        g.lineStyle(2, this.region.color, 0.2);
        const positions = this.region.locations.map((_, i) => ({
            x: originX + NODE_POSITIONS[i].col * colSpacing,
            y: originY + NODE_POSITIONS[i].row * rowSpacing,
        }));
        for (let i = 0; i < positions.length - 1; i++) {
            g.lineBetween(positions[i].x, positions[i].y, positions[i + 1].x, positions[i + 1].y);
        }

        // Draw each node
        this.region.locations.forEach((loc, i) => {
            const x = positions[i].x;
            const y = positions[i].y;
            const state = this._getNodeState(i);
            this._drawNode(loc, x, y, state, i + 1);
        });
    }

    _getNodeState(index) {
        const loc = this.region.locations[index];
        if (this.wmProgress.isCompleted(loc.id)) return 'completed';
        // Open model: all locations always available
        return 'available';
    }

    _drawNode(loc, x, y, state, number) {
        const radius = 34;
        const color = state === 'completed' ? 0xffcc00
                    : state === 'available'  ? this.region.color
                    :                          0x333355;
        const alpha = state === 'locked' ? 0.4 : 1;

        // Glow ring for available
        if (state === 'available') {
            const glow = this.add.circle(x, y, radius + 6, this.region.color, 0.15);
            this.tweens.add({
                targets: glow, alpha: { from: 0.15, to: 0.4 },
                duration: 900, yoyo: true, repeat: -1
            });
        }

        // Node circle
        const circle = this.add.circle(x, y, radius, color, alpha);
        circle.setStrokeStyle(2, state === 'completed' ? 0xffee44 : this.region.color, alpha);

        // Number badge
        const numColor = state === 'completed' ? '#000000' : '#ffffff';
        this.add.text(x, y - 6, String(number), {
            font: 'bold 20px monospace', fill: numColor
        }).setOrigin(0.5).setAlpha(alpha);

        // Location name below
        this.add.text(x, y + radius + 8, loc.name, {
            font: 'bold 11px monospace', fill: state === 'completed' ? '#ffcc00' : '#cccccc',
            align: 'center', wordWrap: { width: 160 }
        }).setOrigin(0.5, 0).setAlpha(alpha);

        // NPC name (or "saved" indicator)
        const npc = getNpcForLocation(loc.id);
        if (npc) {
            const npcLabel = state === 'completed'
                ? `${npc.emoji} ${npc.name} saved!`
                : `${npc.emoji} ${npc.name} needs help`;
            const npcColor = state === 'completed' ? '#88ff99' : '#ff8866';
            this.add.text(x, y + radius + 24, npcLabel, {
                font: '9px monospace', fill: npcColor, align: 'center'
            }).setOrigin(0.5, 0).setAlpha(alpha);
        }

        // High score
        const hs = this.wmProgress.getHighScore(loc.id);
        if (hs > 0) {
            this.add.text(x, y + radius + 40, `Best: ${hs}`, {
                font: '9px monospace', fill: '#555577'
            }).setOrigin(0.5, 0);
        }

        // Checkmark for completed
        if (state === 'completed') {
            this.add.text(x + radius - 4, y - radius + 4, '✓', {
                font: 'bold 12px monospace', fill: '#00ff88',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5);
        }

        // Interactivity
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerover', () => circle.setStrokeStyle(3, 0xffffff, 0.9));
        circle.on('pointerout',  () => circle.setStrokeStyle(2, state === 'completed' ? 0xffee44 : this.region.color, alpha));
        circle.on('pointerdown', () => {
            this.scene.pause('RegionMapScene');
            this.scene.launch('LocationInfoScene', {
                location:   loc,
                region:     this.region,
                playerData: this.playerData,
                returnScene: this.returnScene,
            });
        });
    }

    _drawBackBtn(height) {
        const btn = this.add.text(60, height - 28, '← MAP', {
            font: 'bold 15px monospace', fill: '#bbaa88',
            backgroundColor: '#2a2418', padding: { x: 12, y: 7 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setStyle({ fill: '#ffcc00' }));
        btn.on('pointerout',  () => btn.setStyle({ fill: '#bbaa88' }));
        btn.on('pointerdown', () => {
            this.scene.start('WorldMapScene', { playerData: this.playerData, returnScene: this.returnScene });
        });
    }
}
