// SidescrollScene: side-scrolling cozy village world
// Player walks/jumps through each zone, meets villagers who need musical help

import { ZONES, ZONE_ORDER } from '../data/zones.js';
import { VILLAGERS } from '../data/villagers.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { WORLD_REGIONS } from '../data/worldMap.js';
import { WorldMapProgress } from '../systems/WorldMapProgress.js';
import { getNpcForLocation } from '../data/npcs.js';

const LEVEL_WIDTH   = 4800;
const GROUND_TOP    = 530;   // y where ground surface starts
const GROUND_HEIGHT = 70;
const PLAYER_STAND_Y = GROUND_TOP - 48; // sprite origin is center; 96px tall → 48px half
const WALK_SPEED    = 180;
const JUMP_VELOCITY = -480;
const ENEMY_TRIGGER_DIST = 35; // px before battle starts

export class SidescrollScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SidescrollScene' });
    }

    init(data) {
        this.progression   = data.progression;
        this.playerData    = data.playerData;
        this.zoneKey       = data.zoneKey || this.progression?.currentZone || 'forest';
        this.endlessLoop   = data.endlessLoop || 0;
        this._battleActive = false;
        this._showWorldMap = data.showWorldMap || false;
    }

    create() {
        const zone = ZONES[this.zoneKey];

        // World bounds
        this.physics.world.setBounds(0, 0, LEVEL_WIDTH, this.cameras.main.height);
        this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, this.cameras.main.height);

        // ── BACKGROUND ──────────────────────────────────────────────────────
        this._createBackground(zone);

        // ── GROUND ──────────────────────────────────────────────────────────
        this._createGround(zone);

        // ── PLAYER ──────────────────────────────────────────────────────────
        this._createPlayer();

        // ── ENEMIES ─────────────────────────────────────────────────────────
        this._enemies = [];
        this._nextEnemyId = 0;
        this._spawnEnemies(zone);

        // ── RESCUED ANIMALS (from world map) ──────────────────────────────
        this._spawnRescuedAnimals();

        // ── END-OF-LEVEL SIGN ───────────────────────────────────────────────
        this._bossDefeated  = false;
        this._levelComplete = false;
        this._levelEndX     = LEVEL_WIDTH - 150;

        // ── CAMERA ──────────────────────────────────────────────────────────
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // ── CONTROLS ────────────────────────────────────────────────────────
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd    = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.mapKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

        // ── HUD ─────────────────────────────────────────────────────────────
        this._createHud(zone);

        // ── BATTLE RESULT LISTENER ──────────────────────────────────────────
        this.events.on('battleResult', this._onBattleResult, this);

        // ── ZONE INTRO ──────────────────────────────────────────────────────
        this._showZoneIntro(zone);

        // Auto-show world map on first story entry
        if (this._showWorldMap) {
            this.time.delayedCall(200, () => this._openWorldMap());
        }
    }

    // ── BACKGROUND ─────────────────────────────────────────────────────────────

    _createBackground(zone) {
        const { width, height } = this.cameras.main;

        // Always black fallback so any gap shows as black, never a colour bleed
        this.cameras.main.setBackgroundColor('#000000');

        // TileSprite fixed on screen — tilePositionX drives parallax in update()
        // tileScaleY makes one tile exactly fill the full height (no vertical repeat)
        try {
            const src = this.textures.get(zone.backgroundKey).getSourceImage();
            const ts = height / src.height;          // scale so one tile = full height
            this.bgTile = this.add.tileSprite(0, 0, width, height, zone.backgroundKey)
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setTileScale(ts, ts)
                .setDepth(-10);
            // Subtle darkening so characters pop
            this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.18)
                .setScrollFactor(0).setDepth(-9);
        } catch (e) {
            // Fallback: solid colour already set via camera bg
        }
    }

    // ── GROUND ──────────────────────────────────────────────────────────────────

    _createGround(zone) {
        // Visual ground strip
        this.add.rectangle(LEVEL_WIDTH / 2, GROUND_TOP + GROUND_HEIGHT / 2,
            LEVEL_WIDTH, GROUND_HEIGHT, zone.groundColor);
        // Darker accent line at top of ground
        this.add.rectangle(LEVEL_WIDTH / 2, GROUND_TOP + 5,
            LEVEL_WIDTH, 10, zone.groundAccentColor);

        // Physics static body for ground
        this.groundBody = this.add.rectangle(
            LEVEL_WIDTH / 2, GROUND_TOP + GROUND_HEIGHT / 2,
            LEVEL_WIDTH, GROUND_HEIGHT, 0x000000, 0
        );
        this.physics.add.existing(this.groundBody, true);
    }

    // ── PLAYER ──────────────────────────────────────────────────────────────────

    _createPlayer() {
        const charKey = this.playerData.characterKey || 'char1';

        this.player = this.physics.add.sprite(150, PLAYER_STAND_Y, `player-${charKey}`, 0);
        this.player.setScale(2.0);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(600);
        this.player.body.setSize(48, 70);
        this.player.body.setOffset(40, 26);

        this.physics.add.collider(this.player, this.groundBody);

        this._charKey    = charKey;
        this._onGround   = false;
        this._wasMoving  = false;

        // Play idle immediately
        this.player.play(`${charKey}-idle`);
    }

    // ── ENEMIES ─────────────────────────────────────────────────────────────────

    _spawnEnemies(zone) {
        // Regular villagers
        (zone.levelVillagers || zone.levelEnemies || []).forEach(cfg => this._spawnEnemy(cfg.key, cfg.x, cfg.wanderRange || cfg.patrolRange || 100, false));

        // Special villager
        this._spawnEnemy(zone.specialVillager || zone.bossMonster, zone.specialX || zone.bossX || 4200, 220, true);
    }

    _spawnEnemy(villagerKey, x, patrolRange, isSpecial) {
        const data = VILLAGERS[villagerKey];
        if (!data) return;

        const id         = this._nextEnemyId++;
        const spriteKey  = data.spriteKey || `villager-${villagerKey}`;
        const targetH    = isSpecial ? 320 : 160;
        const scale      = targetH / data.frameHeight;
        const y          = GROUND_TOP - (data.frameHeight * scale) / 2;

        const sprite = this.add.sprite(x, y, spriteKey);
        sprite.setScale(scale);

        // Create idle animation if not yet registered
        const animKey = `villager-${villagerKey}-idle`;
        if (!this.anims.exists(animKey)) {
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: data.frameCount - 1 }),
                frameRate: isSpecial ? 8 : 6,
                repeat: -1
            });
        }
        sprite.play(animKey);

        // Patrol tween — flip sprite based on native facing direction
        // Sprites that natively face right: going left (yoyo) needs flip
        // Sprites that natively face left: going right (initial) needs flip
        const nativeFacesRight = data.facesRight !== false;
        const left  = x - patrolRange;
        const right = x + patrolRange;
        const tween = this.tweens.add({
            targets: sprite,
            x: { from: left, to: right },
            duration: patrolRange * 28,
            ease: 'Linear',
            yoyo: true,
            repeat: -1,
            onYoyo:     () => sprite.setFlipX(nativeFacesRight),
            onRepeat:   () => sprite.setFlipX(!nativeFacesRight)
        });

        // Special villager indicator
        if (isSpecial) {
            const bossTag = this.add.text(x, y - (data.frameHeight * scale) / 2 - 18,
                '✨ HELP ME', {
                    font: 'bold 13px monospace', fill: '#ffcc00',
                    stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5);
            // Attach so it follows the sprite
            this._enemies.push({ id, key: villagerKey, sprite, tween, isSpecial, bossTag });
        } else {
            this._enemies.push({ id, key: villagerKey, sprite, tween, isSpecial });
        }
    }

    // ── HUD ─────────────────────────────────────────────────────────────────────

    _createHud(zone) {
        const { width } = this.cameras.main;

        // Fixed to camera (scrollFactor 0)
        this.hudZoneName = this.add.text(width / 2, 14, zone.name, {
            font: 'bold 16px monospace', fill: '#ffee88',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

        this.add.rectangle(width / 2, 36, 202, 14, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(10);
        this.hudHpBar = this.add.rectangle(width / 2 - 99, 30, 198, 10, 0x44ff44)
            .setOrigin(0, 0).setScrollFactor(0).setDepth(10);

        this.hudHpText = this.add.text(width / 2, 36, '', {
            font: '10px monospace', fill: '#ffffff', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

        this.hudLevelText = this.add.text(width - 14, 14, '', {
            font: '13px monospace', fill: '#aaddff', stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

        // Controls hint (bottom)
        this.add.text(14, this.cameras.main.height - 14,
            '← → Move   ↑/Space Jump   M Map', {
                font: '11px monospace', fill: '#446655', stroke: '#000000', strokeThickness: 2
            }).setScrollFactor(0).setDepth(10);

        this._updateHud();
    }

    _updateHud() {
        const p = this.playerData;
        const ratio = Math.max(0, p.hp / p.maxHp);
        this.hudHpBar.setScale(ratio, 1);
        const col = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff4444;
        this.hudHpBar.setFillStyle(col);
        this.hudHpText.setText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`);
        this.hudLevelText.setText(`Lv.${p.level}`);
    }

    // ── ZONE INTRO ──────────────────────────────────────────────────────────────

    _showZoneIntro(zone) {
        const { width, height } = this.cameras.main;
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
            .setScrollFactor(0).setDepth(20);
        const title = this.add.text(width / 2, height / 2 - 20, zone.name, {
            font: 'bold 36px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
        const sub = this.add.text(width / 2, height / 2 + 30, zone.description, {
            font: '16px monospace', fill: '#aaccff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

        this.time.delayedCall(2200, () => {
            this.tweens.add({
                targets: [overlay, title, sub],
                alpha: 0, duration: 500,
                onComplete: () => { overlay.destroy(); title.destroy(); sub.destroy(); }
            });
        });
    }

    // ── UPDATE LOOP ─────────────────────────────────────────────────────────────

    update() {
        if (this._battleActive || this._levelComplete) return;

        // Parallax: scroll tile content at 15% of camera speed — never slides off screen
        if (this.bgTile) {
            this.bgTile.tilePositionX = this.cameras.main.scrollX * 0.15;
        }

        const onGround = this.player.body.blocked.down;
        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const jump  = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
                      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
                      Phaser.Input.Keyboard.JustDown(this.wasd.up);

        // Movement
        if (left) {
            this.player.setVelocityX(-WALK_SPEED);
        } else if (right) {
            this.player.setVelocityX(WALK_SPEED);
        } else {
            this.player.setVelocityX(0);
        }

        // Jump
        if (jump && onGround) {
            this.player.setVelocityY(JUMP_VELOCITY);
        }

        // Animations — cozy characters use walk-left / walk-right / idle
        const ck = this._charKey;
        if (!onGround) {
            // No jump anim — use walk-up while airborne
            const jumpAnim = `${ck}-walk-up`;
            if (this.player.anims.currentAnim?.key !== jumpAnim) {
                this.player.play(jumpAnim, true);
            }
        } else if (left) {
            if (this.player.anims.currentAnim?.key !== `${ck}-walk-left`) {
                this.player.play(`${ck}-walk-left`, true);
            }
        } else if (right) {
            if (this.player.anims.currentAnim?.key !== `${ck}-walk-right`) {
                this.player.play(`${ck}-walk-right`, true);
            }
        } else {
            if (this.player.anims.currentAnim?.key !== `${ck}-idle`) {
                this.player.play(`${ck}-idle`, true);
            }
        }

        // Update boss tag positions
        this._enemies.forEach(e => {
            if (e.bossTag) e.bossTag.setPosition(e.sprite.x, e.sprite.y - e.sprite.displayHeight / 2 - 12);
        });

        // Open world map overlay
        if (Phaser.Input.Keyboard.JustDown(this.mapKey)) {
            this._openWorldMap();
            return;
        }

        // Check enemy proximity → trigger battle (only if player is on the ground, not jumping over)
        for (const enemy of this._enemies) {
            const dx = Math.abs(this.player.x - enemy.sprite.x);
            const playerBottom = this.player.y + this.player.displayHeight / 2;
            const enemyTop = enemy.sprite.y - enemy.sprite.displayHeight / 2;
            const isAboveEnemy = playerBottom < enemyTop + 10;
            if (dx < ENEMY_TRIGGER_DIST && !isAboveEnemy) {
                this._triggerBattle(enemy);
                return;
            }
        }
    }

    // ── ZONE ANIMAL (caged or rescued) ──────────────────────────────────────────

    _spawnRescuedAnimals() {
        const progress = WorldMapProgress.load();

        // Show the animal that belongs to THIS zone
        const region = WORLD_REGIONS.find(r => r.zoneKey === this.zoneKey);
        if (!region) return;

        const rescued = progress.isCompleted(region.location.id);
        // Place near the end of the level (where the boss is)
        const x = LEVEL_WIDTH - 300;
        const animalY = GROUND_TOP - 30;

        const sprite = this.add.sprite(x, animalY, region.animalKey);
        sprite.setScale(region.animalScale);
        sprite.play(region.animalAnimKey);

        if (rescued) {
            // Free — patrol happily
            this.tweens.add({
                targets: sprite,
                x: { from: x - 40, to: x + 40 },
                duration: 2500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                onYoyo:   () => sprite.setFlipX(true),
                onRepeat: () => sprite.setFlipX(false)
            });

            // Name tag
            const tag = this.add.text(x, animalY - 30, region.animalName, {
                font: 'bold 10px monospace', fill: '#ffcc00',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5);
            this.events.on('update', () => {
                tag.setPosition(sprite.x, sprite.y - sprite.displayHeight / 2 - 6);
            });
        } else {
            // Caged — dimmed, behind bars, slight shake
            sprite.setAlpha(0.6);

            // Cage bars
            const cageW = 100, cageH = 120;
            const cage = this.add.graphics();
            cage.lineStyle(3, 0x888888, 0.7);
            for (let bx = x - cageW / 2; bx <= x + cageW / 2; bx += 14) {
                cage.lineBetween(bx, animalY - cageH / 2, bx, animalY + cageH / 2);
            }
            cage.lineBetween(x - cageW / 2 - 2, animalY - cageH / 2, x + cageW / 2 + 2, animalY - cageH / 2);
            cage.lineBetween(x - cageW / 2 - 2, animalY + cageH / 2, x + cageW / 2 + 2, animalY + cageH / 2);

            // "Help me!" tag
            const helpTag = this.add.text(x, animalY - cageH / 2 - 10, `Save ${region.animalName}!`, {
                font: 'bold 10px monospace', fill: '#ff9966',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5);

            // Gentle shake
            this.tweens.add({
                targets: [cage, sprite],
                x: { from: x - 2, to: x + 2 },
                duration: 150, yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    // ── WORLD MAP OVERLAY ──────────────────────────────────────────────────────────

    _openWorldMap() {
        this.player.setVelocityX(0);
        this.player.play(`${this._charKey}-idle`, true);
        this.scene.pause('SidescrollScene');
        this.scene.launch('WorldMapScene', {
            playerData:  this.playerData,
            progression: this.progression,
            currentZone: this.zoneKey,
            returnScene: 'SidescrollScene',
        });
    }

    // ── BATTLE TRIGGER ───────────────────────────────────────────────────────────

    _triggerBattle(enemy) {
        if (this._battleActive) return;
        this._battleActive     = true;
        this._currentEnemyId   = enemy.id;

        // Stop enemy patrol
        enemy.tween?.pause();
        this.player.setVelocityX(0);
        this.player.play(`${this._charKey}-idle`, true);

        // Brief flash
        this.cameras.main.flash(120, 255, 255, 255, true);

        this.time.delayedCall(200, () => {
            this.scene.pause('SidescrollScene');
            this.scene.launch('BattleScene', {
                mode:             'all',
                storyBattle:      true,
                progression:      this.progression,
                playerData:       this.playerData,
                villagerKey:      enemy.key,
                encounterIndex:   enemy.id,
                isSidescrollMode: true,
                isSpecial:        enemy.isSpecial,
                returnScene:      'SidescrollScene',
                returnData:       { enemyId: enemy.id },
            });
        });
    }

    // ── BATTLE RESULT ────────────────────────────────────────────────────────────

    _onBattleResult(result) {
        this._battleActive = false;

        // Update playerData with new HP/stats from battle
        Object.assign(this.playerData, result.playerData);
        this._updateHud();

        if (result.won) {
            // Remove helped villager
            const idx = this._enemies.findIndex(e => e.id === result.enemyId);
            if (idx !== -1) {
                const enemy = this._enemies[idx];
                this.tweens.add({
                    targets: enemy.sprite,
                    alpha: 0, scaleX: 0, scaleY: 0,
                    duration: 400,
                    onComplete: () => {
                        enemy.sprite.destroy();
                        if (enemy.bossTag) enemy.bossTag.destroy();
                    }
                });
                this._enemies.splice(idx, 1);

                // Show XP popup
                if (result.xp) this._showRewardPopup(result.xp, result.gold);

                // Special villager helped → advance zone
                if (result.isSpecial || result.isBoss) {
                    this.time.delayedCall(800, () => this._completeBossDefeat());
                }
            }
        } else {
            // Not helped — resume patrols, player respawns at zone start
            this._enemies.forEach(e => e.tween?.resume());
            this.player.setPosition(150, PLAYER_STAND_Y);
            this.cameras.main.scrollX = 0;

            const { width, height } = this.cameras.main;
            const msg = this.add.text(width / 2, height / 2, 'Keep trying!', {
                font: 'bold 28px monospace', fill: '#ff8888',
                stroke: '#000000', strokeThickness: 5
            }).setScrollFactor(0).setDepth(20).setOrigin(0.5);
            this.tweens.add({
                targets: msg, alpha: 0, duration: 600, delay: 1400,
                onComplete: () => msg.destroy()
            });
        }
    }

    _showRewardPopup(xp, gold) {
        const { width } = this.cameras.main;
        const lines = [`+${xp} XP`, gold ? `+${gold} Gold` : ''].filter(Boolean).join('  ');
        const popup = this.add.text(width / 2, 80, lines, {
            font: 'bold 20px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 4
        }).setScrollFactor(0).setDepth(20).setOrigin(0.5);
        this.tweens.add({
            targets: popup, y: 50, alpha: 0, duration: 1400,
            onComplete: () => popup.destroy()
        });
    }

    // ── BOSS DEFEAT / LEVEL COMPLETE ────────────────────────────────────────────

    _completeBossDefeat() {
        this._levelComplete = true;
        this._bossDefeated  = true;

        const zone = ZONES[this.zoneKey];

        // Save progression
        this.progression.unlockNextZone();
        this.progression.save(this.playerData);

        // Check if this zone has an un-rescued animal
        const region = WORLD_REGIONS.find(r => r.zoneKey === this.zoneKey);
        const progress = WorldMapProgress.load();

        if (region && !progress.isCompleted(region.location.id)) {
            // Mark as rescued
            progress.markCompleted(region.location.id, 0);
            this._showRescueCelebration(region, zone);
        } else {
            this._showLevelComplete(zone);
        }
    }

    // ── RESCUE CELEBRATION ────────────────────────────────────────────────────

    _showRescueCelebration(region, zone) {
        const { width, height } = this.cameras.main;
        const npc = getNpcForLocation(region.location.id);

        // Full overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
            .setScrollFactor(0).setDepth(25);

        const animalY = height * 0.35;

        // ── Phase 1: Cage with animal ──
        const cage = this.add.graphics().setScrollFactor(0).setDepth(27);
        cage.lineStyle(3, 0x888888, 0.8);
        const cageW = 160, cageH = 160;
        for (let bx = width / 2 - cageW / 2; bx <= width / 2 + cageW / 2; bx += 18) {
            cage.lineBetween(bx, animalY - cageH / 2, bx, animalY + cageH / 2);
        }
        cage.lineBetween(width / 2 - cageW / 2 - 2, animalY - cageH / 2, width / 2 + cageW / 2 + 2, animalY - cageH / 2);
        cage.lineBetween(width / 2 - cageW / 2 - 2, animalY + cageH / 2, width / 2 + cageW / 2 + 2, animalY + cageH / 2);

        const animalSprite = this.add.sprite(width / 2, animalY, region.animalKey)
            .setScale(region.animalScale).setAlpha(0.5).setScrollFactor(0).setDepth(28);
        animalSprite.play(region.animalAnimKey);

        const breakText = this.add.text(width / 2, height * 0.12, 'The cage is breaking!', {
            font: 'bold 20px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(28);

        // Shake cage
        this.tweens.add({
            targets: cage, x: { from: -3, to: 3 },
            duration: 80, yoyo: true, repeat: 8
        });

        // ── Phase 2: Cage shatters (1.5s) ──
        this.time.delayedCall(1500, () => {
            cage.destroy();
            breakText.destroy();
            this.cameras.main.flash(300, 255, 255, 200);

            // Scatter fragments
            for (let i = 0; i < 12; i++) {
                const frag = this.add.rectangle(
                    width / 2 + Phaser.Math.Between(-40, 40),
                    animalY + Phaser.Math.Between(-30, 30),
                    Phaser.Math.Between(4, 12), Phaser.Math.Between(8, 20),
                    0x888888, 0.8
                ).setScrollFactor(0).setDepth(27);
                this.tweens.add({
                    targets: frag,
                    x: frag.x + Phaser.Math.Between(-150, 150),
                    y: frag.y + Phaser.Math.Between(-120, 200),
                    alpha: 0, angle: Phaser.Math.Between(-180, 180),
                    duration: 800, ease: 'Power2',
                    onComplete: () => frag.destroy()
                });
            }

            // Animal springs free
            animalSprite.setAlpha(1);
            this.tweens.add({
                targets: animalSprite,
                y: animalY - 30, duration: 300, ease: 'Back.easeOut',
                yoyo: true, repeat: 2
            });

            // Golden sparkles
            for (let i = 0; i < 8; i++) {
                const sparkle = this.add.circle(
                    width / 2 + Phaser.Math.Between(-60, 60),
                    animalY + Phaser.Math.Between(-50, 50),
                    Phaser.Math.Between(2, 5), 0xffcc00, 0.8
                ).setScrollFactor(0).setDepth(27);
                this.tweens.add({
                    targets: sparkle, y: sparkle.y - 40, alpha: 0,
                    duration: 1000, delay: i * 100,
                    onComplete: () => sparkle.destroy()
                });
            }

            // ── Phase 3: Name + dialogue (1s later) ──
            this.time.delayedCall(1000, () => {
                const animalName = npc ? npc.name : region.animalName;

                const rescueTitle = this.add.text(width / 2, height * 0.08, `${animalName} RESCUED!`, {
                    font: 'bold 32px monospace', fill: '#ffcc00',
                    stroke: '#000000', strokeThickness: 6
                }).setOrigin(0.5).setScrollFactor(0).setDepth(28).setAlpha(0);
                this.tweens.add({ targets: rescueTitle, alpha: 1, duration: 400 });

                // Golden glow
                const glow = this.add.circle(width / 2, animalY, 55, 0xffcc00, 0.15)
                    .setScrollFactor(0).setDepth(26);
                this.tweens.add({
                    targets: glow, alpha: { from: 0.1, to: 0.3 },
                    duration: 600, yoyo: true, repeat: -1
                });

                // NPC dialogue
                if (npc) {
                    const dialogueY = height * 0.58;
                    const bubbleG = this.add.graphics().setScrollFactor(0).setDepth(27);
                    const bubbleW = 500, bubbleH = 90;
                    const bx = width / 2 - bubbleW / 2;

                    bubbleG.fillStyle(0x1e2840, 0.9);
                    bubbleG.fillTriangle(width / 2, dialogueY - 12, width / 2 - 10, dialogueY, width / 2 + 10, dialogueY);
                    bubbleG.fillRoundedRect(bx, dialogueY, bubbleW, bubbleH, 12);
                    bubbleG.lineStyle(1, 0xffcc00, 0.5);
                    bubbleG.strokeRoundedRect(bx, dialogueY, bubbleW, bubbleH, 12);

                    this.add.text(width / 2, dialogueY + bubbleH / 2, npc.saved, {
                        font: '13px monospace', fill: '#ddeeff',
                        fontStyle: 'italic', align: 'center',
                        wordWrap: { width: bubbleW - 30 }, lineSpacing: 3
                    }).setOrigin(0.5).setScrollFactor(0).setDepth(28);
                }

                // Next zone info
                const nextZoneKey = zone.nextZone;
                const nextText = nextZoneKey
                    ? `New area unlocked: ${ZONES[nextZoneKey].name}`
                    : 'All friends rescued!';
                this.add.text(width / 2, height * 0.82, nextText, {
                    font: '14px monospace', fill: '#aaccff',
                    stroke: '#000000', strokeThickness: 3
                }).setOrigin(0.5).setScrollFactor(0).setDepth(28);

                // Continue button
                const contBtn = this.add.text(width / 2, height * 0.90, 'CONTINUE  ▶', {
                    font: 'bold 18px monospace', fill: '#ffffff',
                    backgroundColor: '#224422', padding: { x: 24, y: 10 }
                }).setOrigin(0.5).setScrollFactor(0).setDepth(28).setAlpha(0);

                this.time.delayedCall(1500, () => {
                    contBtn.setAlpha(1).setInteractive({ useHandCursor: true });
                    contBtn.on('pointerover', () => contBtn.setStyle({ backgroundColor: '#336633' }));
                    contBtn.on('pointerout',  () => contBtn.setStyle({ backgroundColor: '#224422' }));
                    contBtn.on('pointerdown', () => {
                        // Reload scene so rescued animal appears
                        if (nextZoneKey) {
                            this.progression.setZone(nextZoneKey);
                            this.scene.start('SidescrollScene', {
                                progression: this.progression,
                                playerData:  this.playerData,
                                zoneKey:     nextZoneKey,
                                showWorldMap: true,
                            });
                        } else {
                            this.scene.start('SidescrollScene', {
                                progression: this.progression,
                                playerData:  this.playerData,
                                zoneKey:     this.zoneKey,
                                showWorldMap: true,
                            });
                        }
                    });
                });
            });
        });
    }

    // ── LEVEL COMPLETE (already rescued or no animal) ─────────────────────────

    _showLevelComplete(zone) {
        const { width, height } = this.cameras.main;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(25);
        this.add.text(width / 2, height / 2 - 60, 'LEVEL COMPLETE!', {
            font: 'bold 42px monospace', fill: '#ffcc00',
            stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5).setScrollFactor(0).setDepth(26);

        const nextZoneKey = zone.nextZone;
        const subText = nextZoneKey
            ? `Next: ${ZONES[nextZoneKey].name}`
            : 'All zones mastered!';

        this.add.text(width / 2, height / 2 + 10, subText, {
            font: '18px monospace', fill: '#aaccff', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(26);

        const continueBtn = this.add.text(width / 2, height / 2 + 80, 'CONTINUE  ▶', {
            font: 'bold 22px monospace', fill: '#ffffff',
            backgroundColor: '#1a4422', padding: { x: 28, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(26)
          .setInteractive({ useHandCursor: true });

        continueBtn.on('pointerover', () => continueBtn.setStyle({ backgroundColor: '#2a6633' }));
        continueBtn.on('pointerout',  () => continueBtn.setStyle({ backgroundColor: '#1a4422' }));
        continueBtn.on('pointerdown', () => {
            if (nextZoneKey) {
                this.progression.setZone(nextZoneKey);
                this.scene.start('SidescrollScene', {
                    progression: this.progression,
                    playerData:  this.playerData,
                    zoneKey:     nextZoneKey,
                    showWorldMap: true,
                });
            } else {
                this.scene.start('SidescrollScene', {
                    progression: this.progression,
                    playerData:  this.playerData,
                    zoneKey:     'forest',
                    endlessLoop: (this.endlessLoop || 0) + 1,
                });
            }
        });
    }
}
