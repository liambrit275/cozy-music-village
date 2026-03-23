// Player entity with stats, sprite management, and animations

export class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.maxHp = 100;
        this.hp = 100;
        this.attack = 15;
        this.defense = 5;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 50;
        this.gold = 0;
        this.speed = 160;

        // Create sprite for overworld (128x96 frames, character is ~30x40 in center)
        this.sprite = scene.physics.add.sprite(x, y, 'player-idle');
        this.sprite.setCollideWorldBounds(true);
        this.sprite.setScale(0.6);
        this.sprite.body.setSize(30, 40);
        this.sprite.body.setOffset(49, 45);

        this.createAnimations();
    }

    createAnimations() {
        const scene = this.scene;

        if (!scene.anims.exists('player-idle-anim')) {
            scene.anims.create({
                key: 'player-idle-anim',
                frames: scene.anims.generateFrameNumbers('player-idle', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }

        if (!scene.anims.exists('player-run-anim')) {
            scene.anims.create({
                key: 'player-run-anim',
                frames: scene.anims.generateFrameNumbers('player-run', { start: 0, end: 11 }),
                frameRate: 14,
                repeat: -1
            });
        }

        if (!scene.anims.exists('player-attack-anim')) {
            scene.anims.create({
                key: 'player-attack-anim',
                frames: scene.anims.generateFrameNumbers('player-attack', { start: 0, end: 5 }),
                frameRate: 12,
                repeat: 0
            });
        }

        if (!scene.anims.exists('player-hurt-anim')) {
            scene.anims.create({
                key: 'player-hurt-anim',
                frames: scene.anims.generateFrameNumbers('player-hurt', { start: 0, end: 2 }),
                frameRate: 8,
                repeat: 0
            });
        }

        this.sprite.play('player-idle-anim');
    }

    update(cursors) {
        const { left, right, up, down } = cursors;
        let vx = 0, vy = 0;

        if (left.isDown) vx = -this.speed;
        else if (right.isDown) vx = this.speed;
        if (up.isDown) vy = -this.speed;
        else if (down.isDown) vy = this.speed;

        this.sprite.setVelocity(vx, vy);

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            this.sprite.setVelocity(vx * 0.707, vy * 0.707);
        }

        // Flip sprite based on direction
        if (vx < 0) this.sprite.setFlipX(true);
        else if (vx > 0) this.sprite.setFlipX(false);

        // Animation
        if (vx !== 0 || vy !== 0) {
            this.sprite.play('player-run-anim', true);
        } else {
            this.sprite.play('player-idle-anim', true);
        }
    }

    // Calculate damage dealt
    calcDamage(bonusMultiplier = 1) {
        const base = this.attack + Math.floor(Math.random() * 5);
        return Math.floor(base * bonusMultiplier);
    }

    // Take damage (reduced by defense)
    takeDamage(amount) {
        const reduced = Math.max(1, amount - this.defense);
        this.hp = Math.max(0, this.hp - reduced);
        return reduced;
    }

    // Heal
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    // Gain XP and check level up
    gainXp(amount) {
        this.xp += amount;
        let leveled = false;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(this.xpToNext * 1.5);
            this.maxHp += 10;
            this.hp = this.maxHp;
            this.attack += 3;
            this.defense += 1;
            leveled = true;
        }
        return leveled;
    }

    // Serialize for save
    toJSON() {
        return {
            hp: this.hp, maxHp: this.maxHp, attack: this.attack,
            defense: this.defense, level: this.level, xp: this.xp,
            xpToNext: this.xpToNext, gold: this.gold
        };
    }

    // Load from save
    loadFromJSON(data) {
        Object.assign(this, data);
    }
}
