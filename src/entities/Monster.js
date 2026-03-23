// Monster entity for battle scenes

import { MONSTERS } from '../data/monsters.js';

export class Monster {
    constructor(scene, monsterKey, x, y) {
        this.scene = scene;
        this.key = monsterKey;
        const data = MONSTERS[monsterKey];

        this.name = data.name;
        this.maxHp = data.hp;
        this.hp = data.hp;
        this.attack = data.attack;
        this.defense = data.defense;
        this.xp = data.xp;
        this.gold = data.gold;
        this.preferredIntervals = data.preferredIntervals;
        this.isBoss = data.isBoss || false;
        this.enemyType = data.enemyType || 'mixed';
        this.description = data.description;

        // Create sprite — scale based on original frame size to normalize display
        // Bosses are rendered ~2× larger than regular enemies
        const spriteKey = data.spriteKey || monsterKey;
        this.sprite = scene.add.sprite(x, y, `monster-${spriteKey}`);
        const targetHeight = this.isBoss ? 420 : 200;
        const frameH = data.frameHeight || 64;
        this.sprite.setScale(targetHeight / frameH).setDepth(2);
        // Flip sprite to face left (toward player) if it natively faces right
        this.sprite.setFlipX(data.facesRight !== false);

        this.createAnimations(monsterKey, data.frameCount, spriteKey);
    }

    createAnimations(key, frameCount, spriteKey) {
        spriteKey = spriteKey || key;
        const animKey = `monster-${key}-idle`;
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(`monster-${spriteKey}`, {
                    start: 0, end: frameCount - 1
                }),
                frameRate: 6,
                repeat: -1
            });
        }
        this.sprite.play(animKey);
    }

    // Choose which interval to play (prefers certain intervals)
    chooseInterval(availableDegrees) {
        // 60% chance to use a preferred interval if available
        if (Math.random() < 0.6) {
            const preferred = this.preferredIntervals.filter(i => availableDegrees.includes(i));
            if (preferred.length > 0) {
                return preferred[Math.floor(Math.random() * preferred.length)];
            }
        }
        // Otherwise random from available (excluding root)
        const nonRoot = availableDegrees.filter(d => d !== '1');
        const pool = nonRoot.length > 0 ? nonRoot : availableDegrees;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Calculate damage dealt
    calcDamage() {
        return this.attack + Math.floor(Math.random() * 4);
    }

    // Take damage
    takeDamage(amount) {
        const reduced = Math.max(1, amount - this.defense);
        this.hp = Math.max(0, this.hp - reduced);
        return reduced;
    }

    isDead() {
        return this.hp <= 0;
    }

    // Flash red when hit
    flashHurt() {
        this.scene.tweens.add({
            targets: this.sprite,
            tint: { from: 0xff0000, to: 0xffffff },
            duration: 200,
            repeat: 2
        });
    }

    // Shake when attacking
    shakeAttack() {
        this.scene.tweens.add({
            targets: this.sprite,
            x: this.sprite.x + 10,
            duration: 50,
            yoyo: true,
            repeat: 3
        });
    }

    // Death animation
    deathAnimation(callback) {
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: callback
        });
    }
}
