// VillageScene: Top-down explorable village where player meets villagers
// Walking near a villager triggers a dialogue, then a music challenge

import { ZONES } from '../data/zones.js';
import { VILLAGERS } from '../data/villagers.js';

const VILLAGE_W = 1600;
const VILLAGE_H = 1200;
const INTERACT_DIST = 60;

export class VillageScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VillageScene' });
    }

    init(data) {
        this.progression = data.progression;
        this.playerData  = data.playerData;
        this.zoneKey     = data.zoneKey || this.progression?.currentZone || 'forest';
        this.returnFromChallenge = data.returnFromBattle || data.returnFromChallenge || false;
        this.defeatedEncounterIndex = data.defeatedEncounterIndex ?? -1;
    }

    create() {
        const { width, height } = this.cameras.main;
        const zone = ZONES[this.zoneKey] || ZONES.forest;

        // World bounds
        this.physics.world.setBounds(0, 0, VILLAGE_W, VILLAGE_H);
        this.cameras.main.setBounds(0, 0, VILLAGE_W, VILLAGE_H);
        this.cameras.main.setBackgroundColor('#2a3a1a');

        // ── GROUND ──────────────────────────────────────────────
        this._drawVillage(zone);

        // ── PLAYER ──────────────────────────────────────────────
        const ck = this.playerData.characterKey || 'char1';
        this.charKey = ck;
        this.player = this.physics.add.sprite(VILLAGE_W / 2, VILLAGE_H / 2, `player-${ck}`, 0);
        this.player.setScale(2.5);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(16, 16);
        this.player.body.setOffset(8, 16);
        if (this.anims.exists(`${ck}-idle`)) this.player.play(`${ck}-idle`);

        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // ── VILLAGERS (NPCs) ────────────────────────────────────
        this._villagers = [];
        this._helpedSet = new Set(this.progression?.getDefeatedEncounters(this.zoneKey) || []);

        // Mark newly helped villager
        if (this.returnFromChallenge && this.defeatedEncounterIndex >= 0) {
            this._helpedSet.add(this.defeatedEncounterIndex);
        }

        const villagerKeys = zone.villagers || [];
        const positions = [
            { x: 400, y: 300 }, { x: 900, y: 250 }, { x: 1300, y: 400 },
            { x: 350, y: 700 }, { x: 800, y: 600 }, { x: 1200, y: 750 },
            { x: 600, y: 900 }, { x: 1000, y: 1000 }
        ];

        villagerKeys.forEach((vKey, i) => {
            const vData = VILLAGERS[vKey];
            if (!vData) return;
            const pos = positions[i % positions.length];
            this._spawnVillager(vKey, vData, pos.x, pos.y, i);
        });

        // Special villager
        if (zone.specialVillager) {
            const svData = VILLAGERS[zone.specialVillager];
            if (svData) {
                this._spawnVillager(zone.specialVillager, svData, VILLAGE_W / 2, 200, villagerKeys.length, true);
            }
        }

        // ── CONTROLS ────────────────────────────────────────────
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.mapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

        // ── HUD ─────────────────────────────────────────────────
        this._buildHud(zone);

        // ── INTERACTION PROMPT ───────────────────────────────────
        this.promptText = this.add.text(0, 0, '', {
            font: 'bold 14px monospace', fill: '#ffcc00',
            backgroundColor: '#2a2a1a', padding: { x: 8, y: 4 },
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(20).setVisible(false).setScrollFactor(0);

        this._nearVillager = null;
        this._transitioning = false;
    }

    _drawVillage(zone) {
        const g = this.add.graphics();

        // Grass base
        g.fillStyle(0x2a4a1a, 1);
        g.fillRect(0, 0, VILLAGE_W, VILLAGE_H);

        // Paths
        g.fillStyle(0x5a4a3a, 1);
        g.fillRect(VILLAGE_W / 2 - 30, 0, 60, VILLAGE_H); // vertical path
        g.fillRect(0, VILLAGE_H / 2 - 30, VILLAGE_W, 60);  // horizontal path

        // Small square in center
        g.fillStyle(0x6a5a4a, 1);
        g.fillRect(VILLAGE_W / 2 - 80, VILLAGE_H / 2 - 80, 160, 160);

        // Buildings (brown rectangles)
        const buildings = [
            { x: 200, y: 150, w: 120, h: 100, color: 0x5a3a2a, roof: 0x8a4a2a },
            { x: 1200, y: 150, w: 140, h: 110, color: 0x5a3a2a, roof: 0x8a4a2a },
            { x: 200, y: 900, w: 100, h: 90, color: 0x4a3a3a, roof: 0x7a4a3a },
            { x: 1300, y: 900, w: 130, h: 100, color: 0x4a3a3a, roof: 0x7a4a3a },
        ];
        buildings.forEach(b => {
            g.fillStyle(b.color, 1);
            g.fillRect(b.x, b.y, b.w, b.h);
            // Roof triangle approximated as lighter top strip
            g.fillStyle(b.roof, 1);
            g.fillRect(b.x - 10, b.y - 20, b.w + 20, 25);
        });

        // Trees (green circles)
        const treePositions = [
            { x: 100, y: 500 }, { x: 150, y: 650 }, { x: 1450, y: 300 },
            { x: 1400, y: 550 }, { x: 700, y: 100 }, { x: 1100, y: 1050 },
            { x: 300, y: 1050 }, { x: 500, y: 450 }, { x: 1050, y: 350 },
            { x: 80, y: 900 }, { x: 1500, y: 800 }, { x: 650, y: 1100 },
        ];
        treePositions.forEach(t => {
            // Trunk
            g.fillStyle(0x5a3a1a, 1);
            g.fillRect(t.x - 4, t.y, 8, 20);
            // Canopy
            g.fillStyle(0x2a6a1a, 0.9);
            g.fillCircle(t.x, t.y - 10, 22);
            g.fillStyle(0x3a7a2a, 0.7);
            g.fillCircle(t.x - 8, t.y - 5, 16);
            g.fillCircle(t.x + 8, t.y - 5, 16);
        });

        // Flowers (tiny colored dots)
        for (let i = 0; i < 60; i++) {
            const fx = 50 + Math.random() * (VILLAGE_W - 100);
            const fy = 50 + Math.random() * (VILLAGE_H - 100);
            const colors = [0xff8888, 0xffcc44, 0xff88cc, 0xffffff, 0x88ccff];
            g.fillStyle(colors[Math.floor(Math.random() * colors.length)], 0.6);
            g.fillCircle(fx, fy, 2);
        }
    }

    _spawnVillager(vKey, vData, x, y, index, isSpecial = false) {
        const helped = this._helpedSet.has(index);
        const spriteKey = vData.spriteKey || `villager-${vKey}`;
        const texKey = this.textures.exists(spriteKey) ? spriteKey : `villager-${vKey}`;

        let sprite;
        if (this.textures.exists(texKey)) {
            sprite = this.add.sprite(x, y, texKey, 0);
            sprite.setScale(isSpecial ? 4.5 : 3.5);

            // Try to play idle animation
            const animalName = texKey.replace('villager-', '');
            const idleKey = `${animalName}-idle`;
            const walkKey = `${animalName}-walk-down`;
            if (this.anims.exists(idleKey)) sprite.play(idleKey);
            else if (this.anims.exists(walkKey)) sprite.play(walkKey);
        } else {
            // Fallback: colored circle
            sprite = this.add.circle(x, y, isSpecial ? 20 : 14, isSpecial ? 0xffaa44 : 0x88cc66);
        }

        // Name label
        const nameLabel = this.add.text(x, y - (isSpecial ? 45 : 35), vData.name, {
            font: `${isSpecial ? 'bold 13px' : '11px'} monospace`,
            fill: isSpecial ? '#ffcc00' : '#aabb88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        // Helped indicator
        if (helped) {
            sprite.setAlpha(0.5);
            nameLabel.setAlpha(0.5);
            const heart = this.add.text(x, y - (isSpecial ? 60 : 48), '♥', {
                font: '16px monospace', fill: '#ff88aa'
            }).setOrigin(0.5);
            this.tweens.add({
                targets: heart, y: heart.y - 5, alpha: 0.4,
                duration: 1500, yoyo: true, repeat: -1
            });
        }

        // Gentle wander tween
        if (!helped) {
            this.tweens.add({
                targets: sprite,
                x: x + (Math.random() - 0.5) * 60,
                y: y + (Math.random() - 0.5) * 40,
                duration: 3000 + Math.random() * 2000,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
            this.tweens.add({
                targets: nameLabel,
                x: nameLabel.x + (Math.random() - 0.5) * 60,
                duration: 3000 + Math.random() * 2000,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        }

        this._villagers.push({
            key: vKey, data: vData, sprite, nameLabel,
            index, isSpecial, helped, x, y
        });
    }

    _buildHud(zone) {
        const { width } = this.cameras.main;

        // Zone name
        this.add.text(width / 2, 16, zone.name, {
            font: 'bold 20px monospace', fill: '#ffcc00',
            stroke: '#2a1a00', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

        // Player level
        this.add.text(16, 12, `Lv.${this.playerData.level || 1}`, {
            font: 'bold 14px monospace', fill: '#88ff88',
            stroke: '#000', strokeThickness: 2
        }).setScrollFactor(0).setDepth(20);

        // Energy bar
        const barX = 16, barY = 32, barW = 120, barH = 12;
        this.add.rectangle(barX + barW / 2, barY + barH / 2, barW + 4, barH + 4, 0x331a00)
            .setScrollFactor(0).setDepth(19);
        const hp = this.playerData.hp || 100;
        const maxHp = this.playerData.maxHp || 100;
        const ratio = hp / maxHp;
        this.add.rectangle(barX + (barW * ratio) / 2, barY + barH / 2, barW * ratio, barH,
            ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xff4444)
            .setScrollFactor(0).setDepth(20);
        this.add.text(barX + barW + 8, barY, `${hp}/${maxHp}`, {
            font: '10px monospace', fill: '#aabb88', stroke: '#000', strokeThickness: 2
        }).setScrollFactor(0).setDepth(20);

        // Map hint
        this.add.text(width - 16, 16, '[M] Map', {
            font: '12px monospace', fill: '#665544',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);

        // Helped count
        const helpedCount = this._helpedSet.size;
        const totalCount = this._villagers.length;
        this.add.text(width - 16, 36, `Helped: ${helpedCount}/${totalCount}`, {
            font: '11px monospace', fill: '#88cc66',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);
    }

    update() {
        if (this._transitioning) return;

        // Movement
        const speed = 200;
        let vx = 0, vy = 0;
        const ck = this.charKey;

        if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
        else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
        if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
        else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;

        if (vx !== 0 && vy !== 0) {
            vx *= 0.707; vy *= 0.707;
        }
        this.player.setVelocity(vx, vy);

        // Animation
        if (vx !== 0 || vy !== 0) {
            let dir;
            if (Math.abs(vx) > Math.abs(vy)) dir = vx < 0 ? 'left' : 'right';
            else dir = vy < 0 ? 'up' : 'down';
            const walkKey = `${ck}-walk-${dir}`;
            if (this.anims.exists(walkKey)) this.player.play(walkKey, true);
        } else {
            const idleKey = `${ck}-idle`;
            if (this.anims.exists(idleKey)) this.player.play(idleKey, true);
        }

        // Check proximity to villagers
        this._nearVillager = null;
        const px = this.player.x, py = this.player.y;
        for (const v of this._villagers) {
            if (v.helped) continue;
            const dx = v.sprite.x - px;
            const dy = v.sprite.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < INTERACT_DIST) {
                this._nearVillager = v;
                break;
            }
        }

        // Show/hide prompt
        if (this._nearVillager) {
            const { width, height } = this.cameras.main;
            this.promptText.setPosition(width / 2, height - 50);
            this.promptText.setText(`Press SPACE to help ${this._nearVillager.data.name}!`);
            this.promptText.setVisible(true);
        } else {
            this.promptText.setVisible(false);
        }

        // Interact
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this._nearVillager) {
            this._startChallenge(this._nearVillager);
        }

        // Map
        if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
            this.scene.start('WorldMapScene', {
                progression: this.progression,
                playerData: this.playerData
            });
        }
    }

    _startChallenge(v) {
        this._transitioning = true;
        this.player.setVelocity(0, 0);

        // Launch dialogue first, then battle
        const dialogues = [
            `${v.data.name}: "${v.data.description}"`,
            `${v.data.name} needs your musical help!`
        ];

        // Check if DialogueScene exists
        if (this.scene.get('DialogueScene')) {
            this.scene.launch('DialogueScene', {
                villagerName: v.data.name,
                villagerColor: '#88cc66',
                dialogues,
                callerKey: 'VillageScene',
                onComplete: () => {
                    this._launchBattle(v);
                }
            });
        } else {
            // Skip dialogue, go straight to battle
            this.time.delayedCall(500, () => this._launchBattle(v));
        }
    }

    _launchBattle(v) {
        this.scene.start('BattleScene', {
            progression: this.progression,
            playerData: this.playerData,
            villagerKey: v.key,
            encounterIndex: v.index,
            currentZone: this.zoneKey,
            isSidescrollMode: false,
            isSpecial: v.isSpecial
        });
    }
}
