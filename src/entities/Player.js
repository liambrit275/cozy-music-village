// Player entity with stats, sprite management, and animations
// Stats: hp=energy, attack=helpPower, defense=stamina, xp=friendship, gold=gratitude

export class Player {
    constructor(scene, x, y, characterKey = 'char1') {
        this.scene = scene;
        this.maxHp = 100;    // energy
        this.hp = 100;       // energy
        this.attack = 15;    // helpPower
        this.defense = 5;    // stamina
        this.level = 1;
        this.xp = 0;         // friendship
        this.xpToNext = 50;
        this.gold = 0;       // gratitude
        this.speed = 160;
        this.characterKey = characterKey;

        // Create sprite (32×32 cozy character)
        const spriteKey = `player-${characterKey}`;
        this.sprite = scene.physics.add.sprite(x, y, spriteKey);
        this.sprite.setCollideWorldBounds(true);
        this.sprite.setScale(2.0);
        this.sprite.body.setSize(20, 24);
        this.sprite.body.setOffset(6, 8);

        // Play idle animation
        const idleKey = `${characterKey}-idle`;
        if (scene.anims.exists(idleKey)) {
            this.sprite.play(idleKey);
        }
    }

    update(cursors) {
        const { left, right, up, down } = cursors;
        let vx = 0, vy = 0;
        const ck = this.characterKey;

        if (left.isDown) vx = -this.speed;
        else if (right.isDown) vx = this.speed;
        if (up.isDown) vy = -this.speed;
        else if (down.isDown) vy = this.speed;

        this.sprite.setVelocity(vx, vy);

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            this.sprite.setVelocity(vx * 0.707, vy * 0.707);
        }

        // Direction-based animation
        if (vx !== 0 || vy !== 0) {
            let dir;
            if (Math.abs(vx) > Math.abs(vy)) {
                dir = vx < 0 ? 'left' : 'right';
            } else {
                dir = vy < 0 ? 'up' : 'down';
            }
            const walkKey = `${ck}-walk-${dir}`;
            if (this.scene.anims.exists(walkKey)) {
                this.sprite.play(walkKey, true);
            }
        } else {
            const idleKey = `${ck}-idle`;
            if (this.scene.anims.exists(idleKey)) {
                this.sprite.play(idleKey, true);
            }
        }
    }

    // Calculate help power dealt to villager
    calcDamage(bonusMultiplier = 1) {
        const base = this.attack + Math.floor(Math.random() * 5);
        return Math.floor(base * bonusMultiplier);
    }

    // Lose energy (reduced by stamina)
    takeDamage(amount) {
        const reduced = Math.max(1, amount - this.defense);
        this.hp = Math.max(0, this.hp - reduced);
        return reduced;
    }

    // Recover energy
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    // Gain friendship and check skill up
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
            xpToNext: this.xpToNext, gold: this.gold,
            characterKey: this.characterKey
        };
    }

    // Load from save
    loadFromJSON(data) {
        Object.assign(this, data);
    }
}
