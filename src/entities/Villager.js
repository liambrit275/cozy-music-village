// Villager entity for cozy battle scenes

import { VILLAGERS } from '../data/villagers.js';

export class Villager {
    constructor(scene, villagerKey, x, y) {
        this.scene = scene;
        this.key = villagerKey;
        const data = VILLAGERS[villagerKey] || {};

        this.name = data.name || villagerKey;
        this.maxHelpNeeded = data.helpNeeded || 50;
        this.helpNeeded = data.helpNeeded || 50;
        this.patience = data.patience || 8;
        this.shyness = data.shyness || 2;
        this.friendship = data.friendship || 10;
        this.gratitude = data.gratitude || 5;
        this.troubleIntervals = data.troubleIntervals || ['1', '3', '5'];
        this.isSpecial = data.isSpecial || false;
        this.needsHelpWith = data.needsHelpWith || 'tone';
        this.description = data.description || '';

        // spriteKey in villagers.js is already the full texture key (e.g. 'villager-bunny')
        const resolvedKey = data.spriteKey || `villager-${villagerKey}`;
        const finalKey = scene.textures.exists(resolvedKey) ? resolvedKey : null;

        if (finalKey) {
            this.sprite = scene.add.sprite(x, y, finalKey);
            const targetHeight = this.isSpecial ? 120 : 90;
            const frameH = data.frameHeight || 17;
            this.sprite.setScale(targetHeight / frameH).setDepth(2);
            this.sprite.setFlipX(data.facesRight !== false);
            this.createAnimations(villagerKey, data.frameCount || 4, resolvedKey, finalKey);
        } else {
            // Fallback: colored circle
            this.sprite = scene.add.circle(x, y, this.isSpecial ? 40 : 30,
                this.isSpecial ? 0xffaa44 : 0x88cc66);
            this.sprite.setDepth(2);
        }
    }

    createAnimations(key, frameCount, spriteKey, resolvedKey) {
        resolvedKey = resolvedKey || `villager-${spriteKey || key}`;
        const animKey = `villager-${key}-idle`;
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(resolvedKey, {
                    start: 0, end: frameCount - 1
                }),
                frameRate: 6,
                repeat: -1
            });
        }
        if (this.sprite.play) this.sprite.play(animKey);
    }

    // Choose which interval to play (prefers certain trouble intervals)
    chooseInterval(availableDegrees) {
        // 60% chance to use a trouble interval if available
        if (Math.random() < 0.6) {
            const preferred = this.troubleIntervals.filter(i => availableDegrees.includes(i));
            if (preferred.length > 0) {
                return preferred[Math.floor(Math.random() * preferred.length)];
            }
        }
        // Otherwise random from available (excluding root)
        const nonRoot = availableDegrees.filter(d => d !== '1');
        const pool = nonRoot.length > 0 ? nonRoot : availableDegrees;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Calculate frustration — how much energy the player loses when wrong
    calcFrustration() {
        return this.patience + Math.floor(Math.random() * 4);
    }

    // Receive help — reduces helpNeeded, applies shyness reduction
    receiveHelp(amount) {
        const reduced = Math.max(1, amount - this.shyness);
        this.helpNeeded = Math.max(0, this.helpNeeded - reduced);
        return reduced;
    }

    isHappy() {
        return this.helpNeeded <= 0;
    }

    // Flash gold when helped
    flashHappy() {
        this.scene.tweens.add({
            targets: this.sprite,
            tint: { from: 0xffdd44, to: 0xffffff },
            duration: 200,
            repeat: 2
        });
    }

    // Gentle bounce animation when showing a puzzle
    showPuzzle() {
        this.scene.tweens.add({
            targets: this.sprite,
            y: this.sprite.y - 5,
            duration: 150,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut'
        });
    }

    // Happy animation — bounce up 3 times, scale up slightly, then fade
    happyAnimation(callback) {
        const originalY = this.sprite.y;
        const originalScaleX = this.sprite.scaleX;
        const originalScaleY = this.sprite.scaleY;

        // Bounce up 3 times
        this.scene.tweens.add({
            targets: this.sprite,
            y: originalY - 20,
            duration: 200,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeOut',
            onComplete: () => {
                // Scale up slightly and fade out
                this.scene.tweens.add({
                    targets: this.sprite,
                    alpha: 0,
                    scaleX: originalScaleX * 1.2,
                    scaleY: originalScaleY * 1.2,
                    duration: 400,
                    ease: 'Power2',
                    onComplete: callback
                });
            }
        });
    }
}
