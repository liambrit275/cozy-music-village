// OverworldScene: Top-down exploration with tilemap, player movement, monster encounters

import { Player } from '../entities/Player.js';
import { ZONES, ZONE_ORDER } from '../data/zones.js';
import { MONSTERS } from '../data/monsters.js';
import { ProgressionManager, ENCOUNTERS_TO_CLEAR } from '../systems/ProgressionManager.js';

// Fixed encounter positions (indices 0-3 are what must be cleared)
const ENCOUNTER_POSITIONS = [
    { x: 160, y: 160 },
    { x: 640, y: 160 },
    { x: 160, y: 440 },
    { x: 640, y: 440 },
];

export class OverworldScene extends Phaser.Scene {
    constructor() {
        super({ key: 'OverworldScene' });
    }

    init(data) {
        this._transitioning = false; // reset on every scene start/restart
        this.progression = data.progression || new ProgressionManager();
        this.loadSave = data.loadSave || false;
        this.playerSaveData = data.playerData || null;
        this.returnFromBattle = data.returnFromBattle || false;
        this.justDefeatedIndex = data.defeatedEncounterIndex ?? -1;

        // Null out references to game objects destroyed by Phaser's shutdown.
        // The scene instance is reused, so stale refs from the previous run
        // would point at destroyed objects whose internal frame/canvas is null.
        this.player = null;
        this.cursors = null;
        this.hpBar = null;
        this.hpText = null;
        this.levelText = null;
        this.counterText = null;
    }

    create() {
        try {
            this._create();
        } catch (e) {
            console.error('OverworldScene create() error:', e);
            this.add.text(400, 300, 'Scene Error:\n' + e.message, {
                font: '14px monospace', fill: '#ff4444',
                backgroundColor: '#000000', padding: { x: 10, y: 8 },
                align: 'center'
            }).setOrigin(0.5);
        }
    }

    _create() {
        let step = 'init';
        try {
            const { width, height } = this.cameras.main;

            step = 'getZone';
            const zone = this.progression.getCurrentZone();

            step = 'bgColor';
            this.cameras.main.setBackgroundColor(zone.bgColor);

            step = 'map';
            this.createProceduralMap(zone);

            step = 'player';
            const startX = this.returnFromBattle ? width * 0.4 : width / 2;
            const startY = height / 2;
            this.player = new Player(this, startX, startY);

            step = 'loadSave';
            if (this.loadSave) {
                const saved = this.progression.load();
                if (saved) this.player.loadFromJSON(saved);
            }

            step = 'loadPlayerData';
            if (this.playerSaveData) {
                this.player.loadFromJSON(this.playerSaveData);
            }

            step = 'cursors';
            this.cursors = this.input.keyboard.createCursorKeys();
            this.encounterCooldown = this.returnFromBattle ? 2000 : 0;

            step = 'encounters';
            this.remainingEncounters = 0;
            this.createEncounterZones(zone);

            step = 'hud';
            this.createHUD(zone);

            step = 'exitPortal';
            if (this.progression.isZoneCleared(zone.key) && zone.nextZone) {
                this.createExitPortal(zone);
            }

            step = 'backPortal';
            this.createBackPortal(zone);

            step = 'zoneBanner';
            if (this.justDefeatedIndex >= 0 &&
                this.progression.isZoneCleared(zone.key) &&
                zone.nextZone) {
                this.showZoneCleared(zone);
            }

        } catch (e) {
            // Re-throw with step info so the outer catch can display it
            throw new Error(`[step: ${step}] ${e.message}`);
        }
    }

    // ── MAP ──────────────────────────────────────────────────────────────────

    createProceduralMap(zone) {
        const { width, height } = this.cameras.main;
        const tileSize = 32;
        const cols = Math.ceil(width / tileSize) + 1;
        const rows = Math.ceil(height / tileSize) + 1;

        // Tileset overlay for forest / village
        const tileKey = zone.key === 'village' ? 'tileset-village' : 'tileset-forest';
        if (zone.key === 'forest' || zone.key === 'village') {
            try {
                this.add.tileSprite(0, 0, width, height, tileKey)
                    .setOrigin(0, 0).setAlpha(0.45);
            } catch (e) {}
        }

        const graphics = this.add.graphics();
        const base = zone.tileColor;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * tileSize, y = row * tileSize;
                const v = (Math.sin(col * 0.5) * Math.cos(row * 0.3)) * 0.12;
                const r = Math.floor(Math.max(0, Math.min(1, ((base >> 16) & 0xff) / 255 + v)) * 255);
                const g = Math.floor(Math.max(0, Math.min(1, ((base >>  8) & 0xff) / 255 + v)) * 255);
                const b = Math.floor(Math.max(0, Math.min(1, ( base        & 0xff) / 255 + v * 0.5)) * 255);
                graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
                graphics.fillRect(x, y, tileSize, tileSize);
                graphics.lineStyle(1, 0x000000, 0.08);
                graphics.strokeRect(x, y, tileSize, tileSize);
            }
        }

        this.addZoneDecorations(zone, graphics);
        graphics.lineStyle(3, 0xffffff, 0.12);
        graphics.strokeRect(4, 4, width - 8, height - 8);
        this.physics.world.setBounds(0, 0, width, height);
    }

    addZoneDecorations(zone, graphics) {
        const { width, height } = this.cameras.main;
        const count = 14 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
            const x = 50 + Math.random() * (width - 100);
            const y = 50 + Math.random() * (height - 100);
            // Keep clear of encounter positions and center spawn
            const tooClose = ENCOUNTER_POSITIONS.some(p => Math.hypot(p.x - x, p.y - y) < 55);
            if (tooClose || (Math.abs(x - width/2) < 55 && Math.abs(y - height/2) < 55)) continue;

            switch (zone.key) {
                case 'forest':
                    graphics.fillStyle(0x1a4a12); graphics.fillCircle(x, y - 10, 13);
                    graphics.fillStyle(0x3a2a1a); graphics.fillRect(x - 3, y - 3, 6, 14);
                    break;
                case 'village':
                    graphics.fillStyle(0x8b6914); graphics.fillRect(x - 12, y - 8, 24, 16);
                    graphics.fillStyle(0xcc4444); graphics.fillTriangle(x-14,y-8, x+14,y-8, x,y-22);
                    break;
                case 'caves':
                    graphics.fillStyle(0x3a2a4a); graphics.fillTriangle(x-8,y+6, x+8,y+6, x,y-13);
                    break;
                case 'castle':
                    graphics.fillStyle(0x5a5a6e); graphics.fillRect(x-4,y-16,8,32);
                    graphics.fillRect(x-8,y-18,16,4);
                    break;
                case 'underworld':
                    graphics.fillStyle(0xff4400, 0.6); graphics.fillEllipse(x,y,20,12);
                    graphics.fillStyle(0xffaa00, 0.4); graphics.fillEllipse(x,y,12,8);
                    break;
                case 'tower':
                    graphics.fillStyle(0x4422aa); graphics.fillTriangle(x-6,y+8, x+6,y+8, x,y-12);
                    graphics.fillStyle(0x6644cc,0.6); graphics.fillTriangle(x-3,y+4, x+3,y+4, x,y-8);
                    break;
            }
        }
    }

    // ── ENCOUNTERS ───────────────────────────────────────────────────────────

    createEncounterZones(zone) {
        const defeated = this.progression.getDefeatedEncounters(zone.key);
        this.remainingEncounters = 0;

        ENCOUNTER_POSITIONS.forEach((pos, idx) => {
            if (defeated.includes(idx)) return; // already beaten — skip
            this.remainingEncounters++;

            const monsterKey = zone.monsters[idx % zone.monsters.length];
            const data = MONSTERS[monsterKey];
            const marker = this.add.sprite(pos.x, pos.y, `monster-${monsterKey}`).setOrigin(0.5, 1);
            const frameH = marker.height || 64;
            marker.setScale(Math.min(2.5, 52 / frameH));
            // Face left if sprite natively faces right
            if (data && data.facesRight !== false) marker.setFlipX(true);

            const animKey = `monster-${monsterKey}-idle`;
            if (this.anims.exists(animKey)) marker.play(animKey);

            this.tweens.add({
                targets: marker, y: pos.y - 7,
                duration: 900 + idx * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });

            // Shadow circle beneath each monster
            const shadow = this.add.ellipse(pos.x, pos.y + 4, 40, 10, 0x000000, 0.3);

            const trigger = this.add.zone(pos.x, pos.y - 20, 52, 52);
            this.physics.add.existing(trigger, true);

            this.physics.add.overlap(this.player.sprite, trigger, () => {
                if (this.encounterCooldown > 0) return;
                this.startBattle(idx, monsterKey);
            });
        });

        this.updateEncounterCounter();
    }

    // ── PORTAL ───────────────────────────────────────────────────────────────

    createExitPortal(zone) {
        const { width, height } = this.cameras.main;
        const px = width - 36, py = height / 2;
        const nextZone = ZONES[zone.nextZone];

        const glow = this.add.rectangle(px, py, 28, 80, 0x44ffcc, 0.8);
        this.tweens.add({
            targets: glow, alpha: { from: 0.5, to: 1 }, scaleY: { from: 0.95, to: 1.05 },
            duration: 900, yoyo: true, repeat: -1
        });

        this.add.text(px, py - 52, `→\n${nextZone.name}`, {
            font: '10px monospace', fill: '#44ffcc',
            stroke: '#000000', strokeThickness: 2, align: 'center'
        }).setOrigin(0.5);

        const pZone = this.add.zone(px, py, 36, 90);
        this.physics.add.existing(pZone, true);
        this.physics.add.overlap(this.player.sprite, pZone, () => {
            if (this._transitioning) return;
            this._transitioning = true;
            this.progression.setZone(zone.nextZone);
            this.progression.save(this.player.toJSON());
            this.scene.restart({ progression: this.progression, playerData: this.player.toJSON() });
        });
    }

    createBackPortal(zone) {
        const { height } = this.cameras.main;
        const zoneIdx = ZONE_ORDER.indexOf(zone.key);
        if (zoneIdx <= 0) return;

        const prevZone = ZONES[ZONE_ORDER[zoneIdx - 1]];
        const px = 36, py = height / 2;

        this.add.rectangle(px, py, 20, 60, 0xaaaaaa, 0.45);
        this.add.text(px, py - 40, `←\n${prevZone.name}`, {
            font: '10px monospace', fill: '#aaaaaa',
            stroke: '#000000', strokeThickness: 2, align: 'center'
        }).setOrigin(0.5);

        const bZone = this.add.zone(px, py, 32, 70);
        this.physics.add.existing(bZone, true);
        this.physics.add.overlap(this.player.sprite, bZone, () => {
            if (this._transitioning) return;
            this._transitioning = true;
            this.progression.setZone(ZONE_ORDER[zoneIdx - 1]);
            this.scene.restart({ progression: this.progression, playerData: this.player.toJSON() });
        });
    }

    // ── HUD ──────────────────────────────────────────────────────────────────

    createHUD(zone) {
        const { width } = this.cameras.main;

        this.add.text(width / 2, 14, zone.name, {
            font: 'bold 20px monospace', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0);

        // HP bar
        this.add.rectangle(130, 50, 204, 18, 0x000000, 0.6);
        this.hpBar = this.add.rectangle(29, 42, 200, 14, 0x44ff44).setOrigin(0, 0);
        this.hpText = this.add.text(130, 50, '', {
            font: '11px monospace', fill: '#ffffff', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);
        this.levelText = this.add.text(16, 65, '', {
            font: '11px monospace', fill: '#ffcc00', stroke: '#000000', strokeThickness: 2
        });

        // Encounter counter (top-right)
        this.counterText = this.add.text(width - 12, 14, '', {
            font: '13px monospace', fill: '#ffeeaa',
            stroke: '#000000', strokeThickness: 2, align: 'right'
        }).setOrigin(1, 0);

        // Scale degrees (bottom)
        const solfegeNames = { '1':'Do','b2':'Ra','2':'Re','b3':'Me','3':'Mi','4':'Fa','#4':'Fi','5':'Sol','b6':'Le','6':'La','b7':'Te','7':'Ti' };
        this.add.text(width / 2, 582, `Intervals: ${zone.scaleDegrees.map(d => solfegeNames[d]||d).join('  ')}`, {
            font: '11px monospace', fill: '#aaaacc', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5);

        this.updateHUD();
        this.updateEncounterCounter();
    }

    updateEncounterCounter() {
        if (!this.counterText) return;
        const zone = this.progression.getCurrentZone();
        const defeated = this.progression.getDefeatedEncounters(zone.key).length;
        const cleared = this.progression.isZoneCleared(zone.key);
        if (cleared) {
            this.counterText.setText('Zone Cleared! →').setStyle({ fill: '#44ffcc' });
        } else {
            this.counterText.setText(`Monsters: ${defeated}/${ENCOUNTERS_TO_CLEAR}`);
        }
    }

    updateHUD() {
        if (!this.hpBar) return;
        const r = this.player.hp / this.player.maxHp;
        this.hpBar.setScale(r, 1).setFillStyle(r > 0.5 ? 0x44ff44 : r > 0.25 ? 0xffaa00 : 0xff4444);
        this.hpText.setText(`HP: ${this.player.hp}/${this.player.maxHp}`);
        this.levelText.setText(`Lv.${this.player.level}  XP:${this.player.xp}/${this.player.xpToNext}  Gold:${this.player.gold}`);
    }

    // ── BATTLE ───────────────────────────────────────────────────────────────

    startBattle(encounterIndex, monsterKey) {
        this.encounterCooldown = 99999; // prevent re-trigger
        this.cameras.main.flash(280, 255, 255, 255);

        this.time.delayedCall(280, () => {
            this.progression.save(this.player.toJSON());
            this.scene.pause('OverworldScene');
            this.scene.launch('BattleScene', {
                mode: 'all',
                storyBattle: true,
                progression: this.progression,
                playerData: this.player.toJSON(),
                villagerKey: monsterKey || this.progression.getRandomVillager(),
                encounterIndex,
                playerPos: { x: this.player.sprite.x, y: this.player.sprite.y },
                returnScene: 'OverworldScene',
                isOverworldMode: true,
            });
        });
    }

    _onBattleResult(result) {
        // Update player data from battle
        if (result.playerData) {
            this.player.loadFromJSON(result.playerData);
            this.updateHUD();
        }

        if (result.won) {
            // Record encounter defeat
            const zoneKey = this.progression.currentZone;
            if (result.encounterIndex !== undefined) {
                const cleared = this.progression.recordEncounterDefeat(zoneKey, result.encounterIndex);
                if (cleared) {
                    this.progression.unlockNextZone();
                    this.showZoneCleared(ZONES[zoneKey]);
                }
            }
            this.progression.save(this.player.toJSON());
        }

        this.encounterCooldown = 2000;
    }

    // ── CLEAR BANNER ─────────────────────────────────────────────────────────

    showZoneCleared(zone) {
        const { width, height } = this.cameras.main;
        const nextZone = ZONES[zone.nextZone];

        const bg = this.add.rectangle(width / 2, height / 2, 440, 110, 0x000000, 0.85);
        const txt = this.add.text(width / 2, height / 2,
            `${zone.name} Cleared!\n${nextZone.name} Unlocked — enter the portal →`, {
            font: 'bold 18px monospace', fill: '#44ffcc',
            align: 'center', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.time.delayedCall(3500, () => {
            this.tweens.add({ targets: [bg, txt], alpha: 0, duration: 600,
                onComplete: () => { bg.destroy(); txt.destroy(); }
            });
        });
    }

    // ── LOOP ─────────────────────────────────────────────────────────────────

    update(time, delta) {
        if (!this.player || !this.cursors) return;
        this.player.update(this.cursors);
        this.updateHUD();
        if (this.encounterCooldown > 0) this.encounterCooldown -= delta;
    }
}
