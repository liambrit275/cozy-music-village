// VictoryScene: Post-battle rewards, XP gain, level ups

import { ZONES } from '../data/zones.js';

export class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
    }

    init(data) {
        this._transitioning = false;
        this.progression = data.progression;
        this.playerData = data.playerData;
        this.monsterName = data.monsterName;
        this.monsterKey = data.monsterKey;
        this.encounterIndex = data.encounterIndex ?? -1;
        this.xpReward = data.xp;
        this.goldReward = data.gold;
        this.correctAnswers = data.correctAnswers || 0;
        this.totalAnswers = data.totalAnswers || 1;
        this.playerPos = data.playerPos;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#0a0a2a');

        // Victory title
        this.add.text(width / 2, 60, 'VICTORY!', {
            font: 'bold 48px monospace',
            fill: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Monster defeated
        this.add.text(width / 2, 130, `${this.monsterName} defeated!`, {
            font: '20px monospace',
            fill: '#ff8888',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Accuracy
        const accuracy = Math.round((this.correctAnswers / this.totalAnswers) * 100);
        const accColor = accuracy >= 80 ? '#44ff44' : accuracy >= 50 ? '#ffcc00' : '#ff8888';
        this.add.text(width / 2, 180, `Ear Training Accuracy: ${accuracy}%`, {
            font: '18px monospace',
            fill: accColor,
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.add.text(width / 2, 210, `(${this.correctAnswers}/${this.totalAnswers} correct)`, {
            font: '14px monospace',
            fill: '#888888'
        }).setOrigin(0.5);

        // Rewards
        let yPos = 255;

        // XP with animation
        const xpText = this.add.text(width / 2, yPos, `+${this.xpReward} XP`, {
            font: 'bold 24px monospace',
            fill: '#44ccff',
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

        // Gold
        const goldText = this.add.text(width / 2, yPos, `+${this.goldReward} Gold`, {
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

        // Manual XP gain + level up check
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

        // Level up notification
        if (leveled) {
            const lvlText = this.add.text(width / 2, yPos, `LEVEL UP! → Lv.${this.playerData.level}`, {
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

            const statsText = this.add.text(width / 2, yPos, `HP: ${this.playerData.maxHp} | ATK: ${this.playerData.attack} | DEF: ${this.playerData.defense}`, {
                font: '14px monospace',
                fill: '#aaaaff'
            }).setOrigin(0.5).setAlpha(0);

            this.tweens.add({
                targets: statsText,
                alpha: 1,
                duration: 300,
                delay: 1000
            });

        }

        // Record battle stats + encounter defeat + save
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
            console.warn('VictoryScene progression error:', e);
        }

        // Continue button — starts hidden, shown after delay
        const continueBtn = this.add.text(width / 2, height - 60, 'CONTINUE  [SPACE]', {
            font: 'bold 24px monospace',
            fill: '#ffffff',
            backgroundColor: '#333366',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setAlpha(0);

        const doTransition = () => {
            if (this._transitioning) return;
            this._transitioning = true;
            continueBtn.setStyle({ fill: '#ffcc00', backgroundColor: '#444488' });
            const cleanData = {
                hp:           this.playerData.hp,
                maxHp:        this.playerData.maxHp,
                attack:       this.playerData.attack,
                defense:      this.playerData.defense,
                level:        this.playerData.level,
                xp:           this.playerData.xp,
                xpToNext:     this.playerData.xpToNext,
                gold:         this.playerData.gold,
                characterKey: this.playerData.characterKey || 'knight'
            };
            // Return to sidescroll if that's how we got here; otherwise overworld
            const targetScene = this.progression._fromSidescroll ? 'SidescrollScene' : 'OverworldScene';
            this.scene.start(targetScene, {
                progression:            this.progression,
                playerData:             cleanData,
                zoneKey:                this.progression.currentZone,
                returnFromBattle:       true,
                defeatedEncounterIndex: this.encounterIndex
            });
        };

        // Activate button after 1.5s — click anywhere OR press Space/Enter
        this.time.delayedCall(1500, () => {
            continueBtn.setAlpha(1).setInteractive({ useHandCursor: true });
            continueBtn.on('pointerover', () => continueBtn.setStyle({ fill: '#ffcc00', backgroundColor: '#444488' }));
            continueBtn.on('pointerout',  () => continueBtn.setStyle({ fill: '#ffffff', backgroundColor: '#333366' }));
            continueBtn.on('pointerdown', doTransition);
            this.input.keyboard.once('keydown-SPACE', doTransition);
            this.input.keyboard.once('keydown-ENTER', doTransition);
        });
    }
}
