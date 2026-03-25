// TopDownScene — cozy top-down animal rescue game.
// Walk up to animals, trigger a music challenge, and rescue them to the enclosure!

const WORLD_W = 1600;
const WORLD_H = 1400;
const PLAYER_SPEED = 130;

// Each entry maps to a VILLAGERS key and carries the sprite info.
const RESCUE_ANIMALS = [
    { villagerKey: 'melody',  spriteKey: 'villager-bunny',    animBase: 'bunny',    scale: 3.5, name: 'Melody the Bunny' },
    { villagerKey: 'pippin',  spriteKey: 'villager-chicken',  animBase: 'chicken',  scale: 3.5, name: 'Pippin the Chicken' },
    { villagerKey: 'puddle',  spriteKey: 'villager-pig',      animBase: 'pig',      scale: 3.5, name: 'Puddle the Pig' },
    { villagerKey: 'bramble', spriteKey: 'villager-goat',     animBase: 'goat',     scale: 3.5, name: 'Bramble the Goat' },
    { villagerKey: 'greta',   spriteKey: 'villager-turkey',   animBase: 'turkey',   scale: 3.5, name: 'Greta the Turkey' },
    { villagerKey: 'clover',  spriteKey: 'villager-squirrel', animBase: 'squirrel', scale: 3.5, name: 'Clover the Squirrel' },
    { villagerKey: 'flicker', spriteKey: 'villager-robin',    animBase: 'robin',    scale: 3.5, name: 'Flicker the Robin' },
    { villagerKey: 'pebble',  spriteKey: 'villager-rat',      animBase: 'rat',      scale: 3.5, name: 'Pebble the Rat' },
    { villagerKey: 'daisy',   spriteKey: 'villager-cow',      animBase: 'cow',      scale: 3,   name: 'Daisy the Cow' },
];

// All positions kept well inside the safe zone (x: 90–1200, y: 90–1310)
// and away from the enclosure (top-right corner ~x>1260, y<290)
const SPAWN_POSITIONS = [
    { x: 300,  y: 300  },
    { x: 650,  y: 200  },
    { x: 200,  y: 750  },
    { x: 850,  y: 650  },
    { x: 450,  y: 1100 },
    { x: 1050, y: 950  },
    { x: 600,  y: 850  },
    { x: 900,  y: 400  },
    { x: 380,  y: 550  },
];

export class TopDownScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TopDownScene' });
    }

    init(data) {
        this.rescuedCount = 0;
        this._inChallenge = false;
        this._currentAnimalData = null;
        this.playerData = data.playerData || {
            hp: 100, maxHp: 100, attack: 10, defense: 3, level: 1, xp: 0,
            characterKey: 'avatar'
        };
    }

    create() {
        // Inset physics bounds so animals/player can't reach the border fence area
        const FENCE_PAD = 70;
        this.physics.world.setBounds(FENCE_PAD, FENCE_PAD, WORLD_W - FENCE_PAD * 2, WORLD_H - FENCE_PAD * 2);

        this._drawWorld();
        this._createPlayer();
        this._spawnAnimals();

        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = {
            up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };

        this._createHUD();

        // Settings button (top-right, camera-fixed)
        const settingsBtn = this.add.text(
            this.cameras.main.width - 12, 12, 'MENU',
            { font: 'bold 13px monospace', fill: '#ffffaa', backgroundColor: '#00000066', padding: { x: 6, y: 3 } }
        ).setOrigin(1, 0).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
        settingsBtn.on('pointerdown', () => {
            this.scene.launch('SettingsScene', { callerKey: 'TopDownScene', pauseCaller: true });
            this.scene.pause('TopDownScene');
        });

        // ── Resume handler (returns from SettingsScene / AvatarBuilder) ───
        this.events.on('resume', () => {
            // Refresh avatar texture in case it was changed
            if (this.textures.exists('player-avatar')) {
                this.player.setTexture('player-avatar', 0);
            }
            // Reset stuck keys from before pause
            this.cursors.left.reset();
            this.cursors.right.reset();
            this.cursors.up.reset();
            this.cursors.down.reset();
            this.wasd.up.reset();
            this.wasd.down.reset();
            this.wasd.left.reset();
            this.wasd.right.reset();
            this.player.setVelocity(0, 0);
            this._inChallenge = false;
        });

        // Hint text that fades after 5 seconds
        const hint = this.add.text(
            this.cameras.main.width / 2, this.cameras.main.height - 14,
            'Walk up to animals to rescue them!  WASD / Arrows to move',
            { font: '12px monospace', fill: '#ffffaa', stroke: '#000', strokeThickness: 2 }
        ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(20);
        this.time.delayedCall(5000, () => {
            this.tweens.add({ targets: hint, alpha: 0, duration: 1500, onComplete: () => hint.destroy() });
        });
    }

    // ── WORLD DRAWING ─────────────────────────────────────────────────────
    // Single Graphics object for the entire world — no per-tree objects, no RenderTexture.

    _drawWorld() {
        // Camera background = base grass colour (zero cost, fills viewport every frame)
        this.cameras.main.setBackgroundColor('#3d7a3d');

        // One Graphics object for everything that scrolls with the world
        const g = this.add.graphics();

        // ── Grass base ──────────────────────────────────────────────────
        g.fillStyle(0x3d7a3d);
        g.fillRect(0, 0, WORLD_W, WORLD_H);

        // Grass variation — simple rectangles (no loops with hundreds of calls)
        const patches = [
            [100, 80,  300, 200], [500, 300, 250, 150], [900, 100, 200, 300],
            [200, 600, 350, 200], [700, 700, 300, 250], [1100, 400, 200, 350],
            [300, 1000, 400, 200], [800, 1100, 300, 200], [1300, 800, 200, 300],
            [50,  400, 150, 400], [1400, 200, 150, 500], [600, 1200, 400, 150],
        ];
        g.fillStyle(0x336633);
        patches.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
        g.fillStyle(0x469946);
        patches.forEach(([x, y, w, h]) => g.fillRect(x + w/3, y + h/3, w/2, h/2));

        // ── Dirt paths ──────────────────────────────────────────────────
        g.fillStyle(0x8b6914);
        // Vertical path (slightly wavy — 3 rect segments)
        g.fillRect(WORLD_W/2 - 22,   0,   44, WORLD_H/3);
        g.fillRect(WORLD_W/2 - 30,   WORLD_H/3, 44, WORLD_H/3);
        g.fillRect(WORLD_W/2 - 18,   WORLD_H*2/3, 44, WORLD_H/3);
        // Horizontal path
        g.fillRect(0,   WORLD_H/2 - 22, WORLD_W, 44);

        // ── Border dark strip ───────────────────────────────────────────
        g.fillStyle(0x1a4a1a);
        g.fillRect(0, 0, WORLD_W, 32);
        g.fillRect(0, WORLD_H - 32, WORLD_W, 32);
        g.fillRect(0, 0, 32, WORLD_H);
        g.fillRect(WORLD_W - 32, 0, 32, WORLD_H);

        // ── Border fence rails ──────────────────────────────────────────
        g.lineStyle(6, 0xc8a060, 1);
        g.strokeRect(10, 10, WORLD_W - 20, WORLD_H - 20);
        g.lineStyle(3, 0xb89050, 0.8);
        g.strokeRect(17, 17, WORLD_W - 34, WORLD_H - 34);

        // ── Fence posts (every 120px) ───────────────────────────────────
        g.fillStyle(0xc8a060);
        for (let x = 10; x <= WORLD_W - 10; x += 120) {
            g.fillRect(x - 4, 4, 8, 28);
            g.fillRect(x - 4, WORLD_H - 32, 8, 28);
        }
        for (let y = 130; y < WORLD_H - 10; y += 120) {
            g.fillRect(4, y - 4, 28, 8);
            g.fillRect(WORLD_W - 32, y - 4, 28, 8);
        }

        // ── Enclosure (top-right) ───────────────────────────────────────
        const ex = WORLD_W - 340, ey = 50, ew = 290, eh = 240;
        this._enc = { x: ex, y: ey, w: ew, h: eh, cx: ex + ew / 2, cy: ey + eh / 2 };

        g.fillStyle(0x55aa55);
        g.fillRect(ex, ey, ew, eh);

        // Flowers (fixed positions — no loop randomness at draw time)
        const flowerPts = [
            [ex+30, ey+40], [ex+80, ey+60], [ex+140, ey+35], [ex+200, ey+55],
            [ex+250, ey+45], [ex+50, ey+100], [ex+120, ey+120], [ex+180, ey+100],
            [ex+240, ey+130], [ex+70, ey+170], [ex+160, ey+180], [ex+220, ey+160],
        ];
        const fc = [0xff99cc, 0xffdd55, 0xcc77ff, 0x88ccff];
        flowerPts.forEach(([fx, fy], i) => {
            g.fillStyle(fc[i % 4]);
            g.fillCircle(fx, fy, 4);
        });

        // Enclosure fence
        g.lineStyle(5, 0xc8a060, 1);
        g.strokeRect(ex, ey, ew, eh);
        g.fillStyle(0xc8a060);
        for (let x = ex; x <= ex + ew; x += 40) {
            g.fillRect(x - 3, ey - 8, 6, 18);
            g.fillRect(x - 3, ey + eh - 8, 6, 18);
        }
        // Side posts
        for (let y = ey + 40; y < ey + eh; y += 40) {
            g.fillRect(ex - 5, y - 3, 12, 6);
            g.fillRect(ex + ew - 7, y - 3, 12, 6);
        }
        // Gate gap
        g.fillStyle(0x55aa55);
        g.fillRect(ex + ew/2 - 22, ey + eh - 3, 44, 14);

        // ── Trees — all in ONE graphics object ─────────────────────────
        const treePts = [
            // Border trees (sparse, every 180px)
            ...this._borderTreePositions(180),
            // Inner scattered trees
            { x: 500, y: 350 }, { x: 750, y: 250 }, { x: 1100, y: 700 },
            { x: 350, y: 950 }, { x: 800, y: 1050 }, { x: 200, y: 1200 },
            { x: 1300, y: 1100 }, { x: 550, y: 1300 }, { x: 1000, y: 200 },
        ];
        const trunks  = [0x5a3a0a, 0x6a4a12, 0x4a2a06, 0x5a3a0a];
        const canopy1 = [0x1a5e1a, 0x3a8833, 0x336622, 0x266622];
        const canopy2 = [0x2a7a2a, 0x4a9944, 0x2a5a1a, 0x2a7a2a];

        treePts.forEach((p, i) => {
            const t = i % 4;
            g.fillStyle(0x000000, 0.1);
            g.fillEllipse(p.x + 3, p.y + 7, 24, 8);
            g.fillStyle(trunks[t]);
            g.fillRect(p.x - 3, p.y - 3, 7, 18);
            g.fillStyle(canopy1[t]);
            g.fillCircle(p.x, p.y - 15, 17);
            g.fillStyle(canopy2[t]);
            g.fillCircle(p.x - 7, p.y - 19, 10);
            g.fillCircle(p.x + 7, p.y - 19, 10);
        });

        // Enclosure label on top
        this.add.text(ex + ew / 2, ey + 18, 'Animal Home', {
            font: 'bold 12px monospace', fill: '#ffffcc', stroke: '#336633', strokeThickness: 3
        }).setOrigin(0.5);
    }

    _borderTreePositions(spacing) {
        const pts = [];
        const pad = 30;
        for (let x = pad + spacing; x < WORLD_W - pad; x += spacing) {
            pts.push({ x, y: pad });
            pts.push({ x, y: WORLD_H - pad });
        }
        for (let y = pad + spacing * 1.5; y < WORLD_H - pad; y += spacing) {
            pts.push({ x: pad, y });
            pts.push({ x: WORLD_W - pad, y });
        }
        return pts;
    }

    // ── PLAYER ────────────────────────────────────────────────────────────

    _createPlayer() {
        this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2, 'player-avatar', 0);
        this.player.setScale(2.5);
        this.player.body.setSize(18, 16);
        this.player.body.setOffset(7, 14);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(5);
        this._facing = 'down';
    }

    // ── ANIMALS ───────────────────────────────────────────────────────────

    _spawnAnimals() {
        this.animalGroup = this.physics.add.group();
        this.animals = [];

        RESCUE_ANIMALS.forEach((def, i) => {
            const pos = SPAWN_POSITIONS[i] || { x: 400 + i * 100, y: 400 };
            const x = pos.x + Phaser.Math.Between(-40, 40);
            const y = pos.y + Phaser.Math.Between(-40, 40);

            const sp = this.physics.add.sprite(x, y, def.spriteKey, 0);
            sp.setScale(def.scale);
            sp.body.setSize(12, 12);
            sp.setCollideWorldBounds(true);
            sp.setDepth(4);

            const animal = {
                sprite: sp, def,
                rescued: false, inChallenge: false,
                wanderTimer: Phaser.Math.Between(500, 2500),
                vx: 0, vy: 0,
            };
            this.animals.push(animal);
            this.animalGroup.add(sp);
            sp._animal = animal;
        });

        this.rescuedCount = 0;
        this.totalAnimals = this.animals.length;
    }

    // ── UPDATE ────────────────────────────────────────────────────────────

    update(time, delta) {
        if (this._inChallenge) return;
        this._movePlayer();
        this._updateAnimals(delta);
        this._checkRescueTrigger();
    }

    _movePlayer() {
        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
        const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

        let vx = (right ? 1 : 0) - (left ? 1 : 0);
        let vy = (down  ? 1 : 0) - (up   ? 1 : 0);
        if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

        this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

        if      (left  && Math.abs(vx) >= Math.abs(vy)) { this.player.play('avatar-walk-left',  true); this._facing = 'left'; }
        else if (right && Math.abs(vx) >= Math.abs(vy)) { this.player.play('avatar-walk-right', true); this._facing = 'right'; }
        else if (up)                                     { this.player.play('avatar-walk-up',    true); this._facing = 'up'; }
        else if (down)                                   { this.player.play('avatar-walk-down',  true); this._facing = 'down'; }
        else                                             { this.player.play('avatar-idle',       true); }
    }

    _updateAnimals(delta) {
        // Safe zone: keep animals away from border and enclosure
        const SAFE_X1 = 90,  SAFE_Y1 = 90;
        const SAFE_X2 = WORLD_W - 400, SAFE_Y2 = WORLD_H - 90; // exclude enclosure corner

        this.animals.forEach(a => {
            if (a.rescued || a.inChallenge) return;
            const sp = a.sprite;

            a.wanderTimer -= delta;
            if (a.wanderTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Phaser.Math.Between(18, 45);
                const stopped = Math.random() < 0.35;
                a.vx = stopped ? 0 : Math.cos(angle) * speed;
                a.vy = stopped ? 0 : Math.sin(angle) * speed;
                a.wanderTimer = Phaser.Math.Between(800, 3000);
            }

            // Steer away from edges of safe zone
            if (sp.x < SAFE_X1)          { a.vx =  Math.abs(a.vx || 30) + 15; a.wanderTimer = Math.min(a.wanderTimer, 600); }
            else if (sp.x > SAFE_X2)     { a.vx = -Math.abs(a.vx || 30) - 15; a.wanderTimer = Math.min(a.wanderTimer, 600); }
            if (sp.y < SAFE_Y1)          { a.vy =  Math.abs(a.vy || 30) + 15; a.wanderTimer = Math.min(a.wanderTimer, 600); }
            else if (sp.y > SAFE_Y2)     { a.vy = -Math.abs(a.vy || 30) - 15; a.wanderTimer = Math.min(a.wanderTimer, 600); }

            sp.setVelocity(a.vx, a.vy);

            const ab = a.def.animBase;
            const ax = Math.abs(a.vx), ay = Math.abs(a.vy);
            const _play = (key) => {
                if (this.anims.exists(key)) sp.play(key, true);
                else if (this.anims.exists(`${ab}-idle`)) sp.play(`${ab}-idle`, true);
            };
            if      (ax < 2 && ay < 2) _play(`${ab}-idle`);
            else if (ax > ay)           _play(a.vx < 0 ? `${ab}-walk-left` : `${ab}-walk-right`);
            else                        _play(a.vy < 0 ? `${ab}-walk-up`   : `${ab}-walk-down`);
        });
    }

    _checkRescueTrigger() {
        const px = this.player.x, py = this.player.y;
        for (const a of this.animals) {
            if (a.rescued || a.inChallenge) continue;
            const dx = px - a.sprite.x, dy = py - a.sprite.y;
            if (dx * dx + dy * dy < 38 * 38) {
                this._startRescue(a);
                break;
            }
        }
    }

    // ── RESCUE FLOW ───────────────────────────────────────────────────────

    _startRescue(animal) {
        animal.inChallenge = true;
        this._inChallenge = true;
        this._currentAnimalData = animal;

        animal.sprite.setVelocity(0, 0);
        this.player.setVelocity(0, 0);

        this._showAnimalPopup(animal);

        // Flash the animal, then launch the challenge
        let flashes = 0;
        const flash = this.time.addEvent({
            delay: 120, repeat: 5,
            callback: () => {
                animal.sprite.setAlpha(animal.sprite.alpha < 0.5 ? 1 : 0.3);
                flashes++;
                if (flashes >= 5) {
                    animal.sprite.setAlpha(1);
                    flash.destroy();
                    this._launchChallenge(animal);
                }
            }
        });
    }

    _showAnimalPopup(animal) {
        const { width } = this.cameras.main;
        const popup = this.add.text(width / 2, 52, `\u266a ${animal.def.name} needs help! \u266a`, {
            font: 'bold 16px monospace', fill: '#ffff88',
            stroke: '#000', strokeThickness: 3,
            backgroundColor: '#22442299', padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(25);

        this.tweens.add({
            targets: popup, alpha: 0, duration: 800, delay: 1500,
            onComplete: () => popup.destroy()
        });
    }

    _launchChallenge(animal) {
        this.scene.launch('ChallengeScene', {
            isSidescrollMode: true,
            storyBattle: true,
            monsterKey: animal.def.villagerKey,
            returnScene: 'TopDownScene',
            playerData: { ...this.playerData, characterKey: 'avatar' },
        });
        this.scene.pause('TopDownScene');
    }

    // Called by ChallengeScene when the battle ends
    _onBattleResult(data) {
        const animal = this._currentAnimalData;
        if (!animal) return;

        if (data.won) {
            this._rescueAnimal(animal);
        } else {
            animal.inChallenge = false;
            this._inChallenge = false;
            animal.vx = (Math.random() - 0.5) * 80;
            animal.vy = (Math.random() - 0.5) * 80;
            animal.wanderTimer = 2000;
        }
    }

    _rescueAnimal(animal) {
        animal.rescued = true;
        animal.sprite.setVelocity(0, 0);

        const tx = this._enc.x + 30 + Math.random() * (this._enc.w - 60);
        const ty = this._enc.y + 30 + Math.random() * (this._enc.h - 60);

        this.tweens.add({
            targets: animal.sprite,
            x: tx, y: ty,
            duration: 1800,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
                const ab = animal.def.animBase;
                if (this.anims.exists(`${ab}-sleep`))  animal.sprite.play(`${ab}-sleep`, true);
                else if (this.anims.exists(`${ab}-idle`)) animal.sprite.play(`${ab}-idle`, true);

                this._burstHearts(tx, ty);
                this.rescuedCount++;
                this._updateHUD();

                // Update preview slot
                const animalIdx = this.animals.indexOf(animal);
                if (this._animalPreviewSlots && this._animalPreviewSlots[animalIdx]) {
                    const slot = this._animalPreviewSlots[animalIdx];
                    slot.rescued = true;
                    slot.bg.setFillStyle(0x243848, 0.9);
                    slot.icon.setAlpha(1).clearTint();
                    this.tweens.add({ targets: slot.icon, scaleX: slot.icon.scaleX * 1.4, scaleY: slot.icon.scaleY * 1.4, duration: 200, yoyo: true });
                }
                this._inChallenge = false;
                this._currentAnimalData = null;

                if (this.rescuedCount >= this.totalAnimals) {
                    this.time.delayedCall(1200, () => this._showVictory());
                }
            }
        });
    }

    _burstHearts(x, y) {
        for (let i = 0; i < 6; i++) {
            const heart = this.add.image(x + Phaser.Math.Between(-28, 28), y, 'heart')
                .setScale(1.8).setDepth(12);
            this.tweens.add({
                targets: heart,
                y: y - 55 - Math.random() * 20,
                alpha: 0,
                duration: 900 + i * 100,
                delay: i * 100,
                ease: 'Quad.easeOut',
                onComplete: () => heart.destroy()
            });
        }
    }

    // ── HUD ───────────────────────────────────────────────────────────────

    _createHUD() {
        this._hudText = this.add.text(14, 14, '', {
            font: 'bold 15px monospace', fill: '#e8f0f0',
            stroke: '#000000', strokeThickness: 3,
            backgroundColor: '#00000066', padding: { x: 8, y: 4 }
        }).setScrollFactor(0).setDepth(20);
        this._updateHUD();

        // ── Rescued Animals Preview (right side, 2 columns) ────────────
        const { width } = this.cameras.main;
        const SLOT = 28, GAP = 3, PER_COL = 5;
        this.add.rectangle(width - 1, 42, SLOT * 2 + GAP + 10, PER_COL * (SLOT + GAP) + 8, 0x000000, 0.45)
            .setOrigin(1, 0).setScrollFactor(0).setDepth(19);

        this._animalPreviewSlots = RESCUE_ANIMALS.map((def, i) => {
            const col = Math.floor(i / PER_COL);
            const row = i % PER_COL;
            const sx = width - 8 - col * (SLOT + GAP) - SLOT / 2;
            const sy = 46 + row * (SLOT + GAP) + SLOT / 2;

            const bg = this.add.rectangle(sx, sy, SLOT, SLOT, 0x223322, 0.7)
                .setScrollFactor(0).setDepth(20);

            // Small sprite icon — use first frame at small scale
            const frameH = { bunny: 17, chicken: 16, pig: 20, goat: 19, turkey: 17, squirrel: 19, robin: 16, rat: 18, cow: 24 };
            const h = frameH[def.animBase] || 17;
            const sc = (SLOT - 6) / h;
            const icon = this.add.sprite(sx, sy, def.spriteKey, 0)
                .setScale(sc).setScrollFactor(0).setDepth(21).setAlpha(0.22);

            return { bg, icon, rescued: false };
        });
    }

    _updateHUD() {
        if (this._hudText) {
            this._hudText.setText(`Rescued: ${this.rescuedCount} / ${this.totalAnimals}`);
        }
    }

    // ── VICTORY ───────────────────────────────────────────────────────────

    _showVictory() {
        const { width, height } = this.cameras.main;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
            .setScrollFactor(0).setDepth(30);

        this.add.text(width / 2, height / 2 - 60, 'ALL ANIMALS RESCUED!', {
            font: 'bold 28px monospace', fill: '#e8d098',
            stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(31);

        this.add.text(width / 2, height / 2 - 10,
            `You rescued all ${this.totalAnimals} animals!\nAmazing music skills!`, {
            font: '17px monospace', fill: '#ccffcc', align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(31);

        const again = this.add.text(width / 2, height / 2 + 70, 'PLAY AGAIN', {
            font: 'bold 22px monospace', fill: '#e8f0f0',
            backgroundColor: '#2a5522', padding: { x: 24, y: 12 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(31).setInteractive({ useHandCursor: true });
        again.on('pointerover', () => again.setStyle({ backgroundColor: '#3a7733' }));
        again.on('pointerout',  () => again.setStyle({ backgroundColor: '#2a5522' }));
        again.on('pointerdown', () => this.scene.restart());

        const titleBtn = this.add.text(width / 2, height / 2 + 130, 'TITLE SCREEN', {
            font: '16px monospace', fill: '#aabbaa',
            backgroundColor: '#112211', padding: { x: 14, y: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(31).setInteractive({ useHandCursor: true });
        titleBtn.on('pointerdown', () => this.scene.start('TitleScene'));
    }
}
