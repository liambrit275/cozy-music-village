// RewardScene: Post-challenge rewards, friendship gain, level ups

import { ZONES } from '../data/zones.js';

export class RewardScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RewardScene' });
    }

    init(data) {
        this._transitioning = false;
        this.progression = data.progression;
        this.playerData = data.playerData;
        this.villagerName = data.monsterName || data.villagerName || 'Villager';
        this.villagerKey = data.monsterKey || data.villagerKey;
        this.encounterIndex = data.encounterIndex ?? -1;
        this.xpReward = data.xp;
        this.goldReward = data.gold;
        this.correctAnswers = data.correctAnswers || 0;
        this.totalAnswers = data.totalAnswers || 1;
        this.playerPos = data.playerPos;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#1a150e');

        // Title
        this.add.text(width / 2, 60, 'WONDERFUL!', {
            font: 'bold 48px monospace',
            fill: '#ffcc00',
            stroke: '#2a1a00',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Villager helped
        this.add.text(width / 2, 130, `${this.villagerName} is happy again!`, {
            font: '20px monospace',
            fill: '#88cc66',
            stroke: '#1a1a00',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Accuracy
        const accuracy = Math.round((this.correctAnswers / this.totalAnswers) * 100);
        const accColor = accuracy >= 80 ? '#44ff44' : accuracy >= 50 ? '#ffcc00' : '#ffaa66';
        this.add.text(width / 2, 180, `Music Accuracy: ${accuracy}%`, {
            font: '18px monospace',
            fill: accColor,
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.add.text(width / 2, 210, `(${this.correctAnswers}/${this.totalAnswers} correct)`, {
            font: '14px monospace',
            fill: '#888866'
        }).setOrigin(0.5);

        // Rewards
        let yPos = 255;

        // Friendship
        const xpText = this.add.text(width / 2, yPos, `+${this.xpReward} Friendship`, {
            font: 'bold 24px monospace',
            fill: '#ff88aa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScale(0);

        this.tweens.add({
            targets: xpText,
            scaleX: 1, scaleY: 1,
            duration: 400,
            delay: 300,
            ease: 'Back.easeOut'
        });

        yPos += 40;

        // Gratitude
        const goldText = this.add.text(width / 2, yPos, `+${this.goldReward} Gratitude`, {
            font: 'bold 20px monospace',
            fill: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScale(0);

        this.tweens.add({
            targets: goldText,
            scaleX: 1, scaleY: 1,
            duration: 400,
            delay: 500,
            ease: 'Back.easeOut'
        });

        yPos += 50;

        // Apply rewards
        this.playerData.gold = (this.playerData.gold || 0) + this.goldReward;
        const oldLevel = this.playerData.level;

        this.playerData.xp += this.xpReward;
        let leveled = false;
        while (this.playerData.xp >= this.playerData.xpToNext) {
            this.playerData.xp -= this.playerData.xpToNext;
            this.playerData.level++;
            this.playerData.xpToNext = Math.floor(this.playerData.xpToNext * 1.5);
            this.playerData.maxHp += 10;
            this.playerData.hp = this.playerData.maxHp;
            this.playerData.attack += 3;
            this.playerData.defense += 1;
            leveled = true;
        }

        if (leveled) {
            const lvlText = this.add.text(width / 2, yPos, `SKILL UP! → Lv.${this.playerData.level}`, {
                font: 'bold 26px monospace',
                fill: '#ffff44',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setScale(0);

            this.tweens.add({
                targets: lvlText,
                scaleX: 1, scaleY: 1,
                duration: 500,
                delay: 800,
                ease: 'Back.easeOut'
            });

            yPos += 35;

            const statsText = this.add.text(width / 2, yPos, `Energy: ${this.playerData.maxHp} | Help: ${this.playerData.attack} | Stamina: ${this.playerData.defense}`, {
                font: '14px monospace',
                fill: '#aabb88'
            }).setOrigin(0.5).setAlpha(0);

            this.tweens.add({
                targets: statsText,
                alpha: 1,
                duration: 300,
                delay: 1000
            });
        }

        // Record session stats + encounter completion + save
        try {
            this.progression.recordBattle(true, this.correctAnswers, this.totalAnswers);

            if (this.encounterIndex >= 0) {
                const currentZone = this.progression.currentZone;
                const cleared = this.progression.recordEncounterDefeat(currentZone, this.encounterIndex);
                if (cleared && ZONES[currentZone] && ZONES[currentZone].nextZone) {
                    this.progression.unlockNextZone();
                }
            }

            this.progression.save(this.playerData);
        } catch (e) {
            console.warn('RewardScene progression error:', e);
        }

        // Continue button
        const continueBtn = this.add.text(width / 2, height - 60, 'CONTINUE  [SPACE]', {
            font: 'bold 24px monospace',
            fill: '#ffffff',
            backgroundColor: '#2a2a1a',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setAlpha(0);

        const doTransition = () => {
            if (this._transitioning) return;
            this._transitioning = true;
            continueBtn.setStyle({ fill: '#ffcc00', backgroundColor: '#3a3a2a' });
            const cleanData = {
                hp:           this.playerData.hp,
                maxHp:        this.playerData.maxHp,
                attack:       this.playerData.attack,
                defense:      this.playerData.defense,
                level:        this.playerData.level,
                xp:           this.playerData.xp,
                xpToNext:     this.playerData.xpToNext,
                gold:         this.playerData.gold,
                characterKey: this.playerData.characterKey || 'char1'
            };
            this.scene.start('TopDownScene', { playerData: cleanData });
        };

        this.time.delayedCall(1500, () => {
            continueBtn.setAlpha(1).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerover', () => continueBtn.setStyle({ fill: '#ffcc00', backgroundColor: '#3a3a2a' }));
            continueBtn.on('pointerout',  () => continueBtn.setStyle({ fill: '#ffffff', backgroundColor: '#2a2a1a' }));
            continueBtn.on('pointerdown', doTransition);
            this.input.keyboard.once('keydown-SPACE', doTransition);
            this.input.keyboard.once('keydown-ENTER', doTransition);
        });
    }
}
