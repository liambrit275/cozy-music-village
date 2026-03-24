// ArcadeBattleScene: Monsters approach the player — answer to slay them!
// Extends ChallengeBaseScene with monster HP, approach, hero attack, monster lunge, zone backgrounds.

import { ChallengeBaseScene, GROUND_Y, PLAYER_X } from './ChallengeBaseScene.js';
import { MONSTERS } from '../data/monsters.js';
import { ZONES } from '../data/zones.js';

const MONSTER_POOL_REGULAR = Object.keys(MONSTERS).filter(k => !MONSTERS[k].isBoss);
const MONSTER_POOL_BOSS = Object.keys(MONSTERS).filter(k => MONSTERS[k].isBoss);

const ZONE_BGS = ['bg-forest', 'bg-village', 'bg-caves', 'bg-castle', 'bg-underworld', 'bg-tower'];
const SPAWN_X = 780;

const PRACTICE_NPCS_BATTLE = {
    tone:        { key: 'sunny-froggy',   anim: 'sunny-froggy-idle',   scale: 2.8,  name: 'Froggy',  h: 106, flip: true  },
    noteReading: { key: 'sunny-dragon',   anim: 'sunny-dragon-idle',   scale: 0.85, name: 'Drago',   h: 150, flip: false },
    rhythm:      { key: 'sunny-bunny',    anim: 'sunny-bunny-idle',    scale: 3.0,  name: 'Bunny',   h: 126, flip: true  },
    default:     { key: 'sunny-mushroom', anim: 'sunny-mushroom-idle', scale: 3.0,  name: 'Shroomy', h: 90,  flip: true  },
};

export class ArcadeBattleScene extends ChallengeBaseScene {
    constructor() {
        super({ key: 'ArcadeBattleScene' });
    }

    // ===================== THEME CONFIG =====================

    _sceneKey() { return 'ArcadeBattleScene'; }
    _defaultReturnScene() { return 'ArcadeMenuScene'; }
    _defaultCharKey() { return 'adventurer'; }
    _dangerOverlayColor() { return 0xff0000; }
    _overlayReturnScene() { return 'SidescrollScene'; }
    _defaultMenuScene() { return 'ArcadeMenuScene'; }
    _practiceNpcs() { return PRACTICE_NPCS_BATTLE; }

    _initTheme(data) {
        this.monsterKey = data.monsterKey || null;
        this._monsterSpeed = 0;
    }

    _victoryConfig() {
        return {
            title: 'VICTORY!',
            rewardLabel: (xp, gold) => `+${xp} XP   +${gold} Gold`,
            xpField: 'xp', goldField: 'gold',
            playerLabel: (stats) => `Lv.${stats.level}  HP ${stats.hp}/${stats.maxHp}`,
        };
    }

    _defeatConfig() {
        return {
            title: 'DEFEATED!', titleColor: '#dd8855',
            message: 'HP restored to 50%', messageColor: '#ddbb88',
            bg: 0x1a150e, stroke: 0xdd8855,
            btnBg: '#2a2418', btnHover: '#3a3020',
        };
    }

    _gameOverConfig() {
        return {
            title: 'DEFEATED!', titleColor: '#dd8855',
            entityLabel: 'Monsters Slain',
        };
    }

    // ===================== BACKGROUND =====================

    _createBackground(width, height) {
        if (this.isSidescrollMode) {
            this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
            this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setDepth(0);
            return;
        }

        this.cameras.main.setBackgroundColor('#1a150e');

        let bgKey;
        if (this.storyBattle && this.monsterKey && MONSTERS[this.monsterKey]) {
            const monsterZone = MONSTERS[this.monsterKey].zone;
            bgKey = monsterZone ? `bg-${monsterZone}` : ZONE_BGS[0];
        } else {
            bgKey = ZONE_BGS[Math.floor(Math.random() * ZONE_BGS.length)];
        }
        if (this.textures.exists(bgKey)) {
            const bg = this.add.image(width / 2, height / 2, bgKey);
            bg.setDisplaySize(width, height);
            bg.setAlpha(0.3);
        }

        const ground = this.add.graphics();
        ground.fillStyle(0x1a1a2a, 1);
        ground.fillRect(0, GROUND_Y, width, height - GROUND_Y);
        ground.lineStyle(2, 0x333355, 1);
        ground.lineBetween(0, GROUND_Y, width, GROUND_Y);
        ground.setDepth(1);
    }

    // ===================== PLAYER SPRITE =====================

    _createPlayerSprite(charKey, width, height) {
        if (this.isSidescrollMode) {
            this.playerSprite = this.add.sprite(-100, -100, `${charKey}-idle`);
            this.playerSprite.setVisible(false);
            return;
        }

        this.playerSprite = this.add.sprite(PLAYER_X, GROUND_Y, `${charKey}-idle`);
        this.playerSprite.setOrigin(0.5, 1);
        this.playerSprite.setScale(2.5 * (this.playerData.characterScale || 1.0));
        this.playerSprite.setFlipX(this.playerData.characterFlip || false);
        this.playerSprite.play(`${charKey}-idle`);
        this.playerSprite.setDepth(2);
    }

    // ===================== ENTITY SPAWNING =====================

    _spawnNextEntity() {
        if (this._gameOverFlag) return;
        if (this.storyBattle && this.session.round > 0 && this._storyEntityDone) return;

        this.session.round++;
        this._updateHud();

        let monsterKey, isBoss;
        if (this.storyBattle && this.monsterKey) {
            monsterKey = this.monsterKey;
            isBoss = MONSTERS[monsterKey]?.isBoss || false;
        } else {
            isBoss = this.session.round % 10 === 0 && this.session.round > 0;
            const pool = isBoss ? MONSTER_POOL_BOSS : MONSTER_POOL_REGULAR;
            monsterKey = pool[Math.floor(Math.random() * pool.length)];
        }
        const data = MONSTERS[monsterKey];

        // Create monster sprite (skip in overlay/practice mode)
        if (!this.isSidescrollMode && !this.practiceMode) {
            const spriteKey = `monster-${data.spriteKey || monsterKey}`;
            const targetH = (isBoss && this.storyBattle) ? 280 : 140;
            const frameH = data.frameHeight || 64;
            const scale = targetH / frameH;

            this._entitySprite = this.add.sprite(SPAWN_X, GROUND_Y, spriteKey);
            this._entitySprite.setOrigin(0.5, 1);
            this._entitySprite.setScale(scale);
            this._entitySprite.setDepth(2);

            const animKey = `monster-${monsterKey}-idle`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: data.frameCount - 1 }),
                    frameRate: 6, repeat: -1
                });
            }
            this._entitySprite.play(animKey);
            this._entitySprite.setFlipX(data.facesRight !== false);
        } else {
            this._entitySprite = null;
        }

        this._entityKey = monsterKey;
        this._entityData = data;
        this._isSpecialRound = isBoss;

        // Monster HP tracking
        this._entityMeter = data.hp || 30;
        this._entityMaxHp = data.hp || 30;
        this._entityAttack = data.attack || 8;
        this._entityDefense = data.defense || 2;
        this._storyEntityDone = false;
        this._buildHpBars();

        this._challengeType = this._pickChallengeType();

        if (this.practiceMode) {
            this._spawnFriendlyNpc(this._challengeType);
            this.messageText.setText('Ready for a new question?');
        } else {
            this.messageText.setText(`${data.name} approaches!`);
        }

        if (this.isSidescrollMode || this.practiceMode) {
            this._monsterSpeed = 0;
            this.time.delayedCall(400, () => {
                if (this._gameOverFlag) return;
                this._askQuestion();
            });
        } else {
            const baseSpeed = 25;
            const speedScale = Math.min(3.0, 1 + (this.session.round - 1) * 0.08);
            this._monsterSpeed = baseSpeed * speedScale;

            this.time.delayedCall(800, () => {
                if (this._gameOverFlag) return;
                this._entityApproaching = true;
                this._askQuestion();
            });
        }
    }

    // ===================== UPDATE (monster approach) =====================

    update(time, delta) {
        if (!this._entityApproaching || this._gameOverFlag || !this._entitySprite) return;

        const dx = (this._monsterSpeed * delta) / 1000;
        this._entitySprite.x -= dx;

        const dist = this._entitySprite.x - PLAYER_X;
        const maxDist = SPAWN_X - PLAYER_X;
        const dangerRatio = 1 - Math.max(0, dist / maxDist);

        if (dangerRatio > 0.5) {
            const pulse = Math.sin(time * 0.008) * 0.5 + 0.5;
            this.dangerOverlay.setAlpha(dangerRatio * 0.15 * pulse);
        } else {
            this.dangerOverlay.setAlpha(0);
        }

        if (this._entitySprite.x <= PLAYER_X + 60) {
            this._entityApproaching = false;
            this._monsterReachedPlayer();
        }
    }

    _monsterReachedPlayer() {
        if (this._gameOverFlag) return;

        const dmg = Math.max(3, Math.floor(this._entityAttack * 1.5) + Math.floor(Math.random() * 5));
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
        this._showDamageNumber(this.playerSprite.x, this.playerSprite.y - 80, 0, '#dd8855', `-${dmg}`);
        this.playerSprite.play(`${this._charKey}-hurt`);
        this.playerSprite.once('animationcomplete', () => {
            if (!this._gameOverFlag) this.playerSprite.play(`${this._charKey}-idle`);
        });
        this.cameras.main.shake(400, 0.02);
        this._updateHpBars();

        if (this.playerStats.hp <= 0) {
            this._gameOverFlag = true;
            this._clearAllUI();
            if (this.storyBattle) {
                this.time.delayedCall(600, () => this._storyDefeat());
            } else {
                this.time.delayedCall(600, () => this._gameOver());
            }
            return;
        }

        // Push monster back
        this._entitySprite.x = SPAWN_X * 0.7;
        this._entityApproaching = true;

        // Rhythm: keep the same rhythm, don't generate a new question
        if (this._challengeType === 'rhythm') return;

        this._challengeType = this._pickChallengeType();
        this.time.delayedCall(500, () => this._askQuestion());
    }

    // ===================== CORRECT/WRONG HANDLERS =====================

    _onCorrectHit() {
        this._heroAttack();
    }

    _heroAttack() {
        // Deal damage to monster
        const baseDmg = Math.ceil(this._entityMaxHp * 0.45);
        const atk = baseDmg + (this.playerStats.attack || 10) + Math.floor(Math.random() * 6);
        const dmg = Math.max(1, atk - this._entityDefense);
        this._entityMeter = Math.max(0, this._entityMeter - dmg);
        this._updateHpBars();

        // Practice mode: NPC bounces happily
        if (this.practiceMode) {
            if (this._npcSprite) {
                this.tweens.add({
                    targets: this._npcSprite,
                    y: { from: GROUND_Y, to: GROUND_Y - 22 },
                    duration: 160, yoyo: true, ease: 'Power2'
                });
            }
            if (this._entityMeter <= 0) {
                this.time.delayedCall(500, () => this._returnPlayerThenSpawn());
            } else {
                this.time.delayedCall(400, () => this._returnPlayerThenContinue());
            }
            return;
        }

        if (this.isSidescrollMode) {
            const { width } = this.cameras.main;
            this._showDamageNumber(width / 2, 100, dmg, '#ffcc00');
            this.cameras.main.shake(150, 0.01);

            if (this._entityMeter <= 0) {
                this._storyEntityDone = true;
                this._showDamageNumber(width / 2, 60, 0, '#ffcc00', 'SLAIN!');
                this.time.delayedCall(600, () => this._returnPlayerThenVictory());
            } else {
                this.time.delayedCall(400, () => {
                    this._challengeType = this._pickChallengeType();
                    this._askQuestion();
                });
            }
            return;
        }

        // Full scene mode: run to monster and attack
        if (!this._entitySprite) return;
        const monsterX = this._entitySprite.x;

        this.playerSprite.play(`${this._charKey}-run`);
        this.tweens.add({
            targets: this.playerSprite,
            x: monsterX - 80,
            duration: 350,
            ease: 'Power2',
            onComplete: () => {
                this.playerSprite.play(`${this._charKey}-attack`);
                this.cameras.main.shake(150, 0.01);
                this._showHitEffect(monsterX, this._entitySprite.y - 40);

                this._showDamageNumber(monsterX, this._entitySprite.y - 80, dmg, '#ffcc00');

                // Flash monster red
                this.tweens.add({
                    targets: this._entitySprite,
                    tint: { from: 0xff0000, to: 0xffffff },
                    duration: 200, repeat: 2
                });

                if (this._entityMeter <= 0) {
                    this._storyEntityDone = true;
                    this._showDamageNumber(monsterX, this._entitySprite.y - 120, 0, '#ffcc00', 'SLAIN!');
                    this.tweens.add({
                        targets: this._entitySprite,
                        alpha: 0, scaleX: 0, scaleY: 0,
                        duration: 500, ease: 'Power2',
                        onComplete: () => { this._entitySprite.destroy(); this._entitySprite = null; }
                    });

                    if (this.storyBattle) {
                        this.time.delayedCall(600, () => this._returnPlayerThenVictory());
                    } else {
                        this.time.delayedCall(500, () => this._returnPlayerThenSpawn());
                    }
                    return;
                }

                // Monster survives — run back and ask next question
                this.time.delayedCall(400, () => this._returnPlayerThenContinue());
            }
        });
    }

    _onWrongEffect() {
        this._monsterLunge();
    }

    _showWrongDamage(dmg) {
        if (this.isSidescrollMode) {
            this._showDamageNumber(120, 70, 0, '#dd8855', `-${dmg}`);
        } else if (this.playerSprite) {
            this._showDamageNumber(this.playerSprite.x, this.playerSprite.y - 80, 0, '#dd8855', `-${dmg}`);
            this.playerSprite.play(`${this._charKey}-hurt`);
            this.playerSprite.once('animationcomplete', () => {
                if (!this._gameOverFlag) this.playerSprite.play(`${this._charKey}-idle`);
            });
        }
        this.cameras.main.shake(200, 0.008);
    }

    _onStoryPlayerDefeated() {
        this.time.delayedCall(800, () => this._storyDefeat());
    }

    // ===================== MONSTER LUNGE =====================

    _monsterLunge() {
        if (this.isSidescrollMode || this.practiceMode) {
            this._challengeType = this._pickChallengeType();
            this.time.delayedCall(500, () => this._askQuestion());
            return;
        }

        if (!this._entitySprite) return;

        const lungeDistance = 60 + this.session.round * 3;
        const targetX = Math.max(PLAYER_X + 80, this._entitySprite.x - lungeDistance);

        this.tweens.add({
            targets: this._entitySprite,
            x: targetX,
            y: this._entitySprite.y - 30,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                this.tweens.add({
                    targets: this._entitySprite,
                    y: GROUND_Y,
                    duration: 150,
                    ease: 'Bounce.easeOut',
                    onComplete: () => {
                        if (this._entitySprite && this._entitySprite.x <= PLAYER_X + 80) {
                            this._monsterReachedPlayer();
                        } else {
                            this._entityApproaching = true;
                            this._challengeType = this._pickChallengeType();
                            this.time.delayedCall(500, () => this._askQuestion());
                        }
                    }
                });
            }
        });
    }

    // ===================== RETURN PLAYER HELPERS =====================

    _returnPlayerThenSpawn() {
        this.session.entitiesDefeated++;
        this._updateHud();

        if (this.isSidescrollMode || this.practiceMode) {
            this.time.delayedCall(400, () => this._spawnNextEntity());
            return;
        }
        this.playerSprite.play(`${this._charKey}-run`);
        this.tweens.add({
            targets: this.playerSprite, x: PLAYER_X, duration: 350, ease: 'Power2',
            onComplete: () => {
                this.playerSprite.play(`${this._charKey}-idle`);
                this.time.delayedCall(600, () => this._spawnNextEntity());
            }
        });
    }

    _returnPlayerThenContinue() {
        if (this.isSidescrollMode || this.practiceMode) {
            this._challengeType = this._pickChallengeType();
            this.time.delayedCall(400, () => this._askQuestion());
            return;
        }
        this.playerSprite.play(`${this._charKey}-run`);
        this.tweens.add({
            targets: this.playerSprite, x: PLAYER_X, duration: 350, ease: 'Power2',
            onComplete: () => {
                this.playerSprite.play(`${this._charKey}-idle`);
                this._entityApproaching = true;
                this._challengeType = this._pickChallengeType();
                this.time.delayedCall(500, () => this._askQuestion());
            }
        });
    }

    _returnPlayerThenVictory() {
        if (this.isSidescrollMode) {
            this.time.delayedCall(400, () => this._storyVictory());
            return;
        }
        this.playerSprite.play(`${this._charKey}-run`);
        this.tweens.add({
            targets: this.playerSprite, x: PLAYER_X, duration: 350, ease: 'Power2',
            onComplete: () => {
                this.playerSprite.play(`${this._charKey}-idle`);
                this.time.delayedCall(600, () => this._storyVictory());
            }
        });
    }

    // ===================== HIT EFFECT =====================

    _showHitEffect(x, y) {
        if (!this.textures.exists('hit-effect')) return;
        const hit = this.add.sprite(x, y, 'hit-effect');
        hit.setScale(3);
        const animKey = 'hit-effect-play';
        if (!this.anims.exists(animKey)) {
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers('hit-effect', { start: 0, end: 2 }),
                frameRate: 12, repeat: 0
            });
        }
        hit.play(animKey);
        hit.on('animationcomplete', () => hit.destroy());
    }

    // ===================== HP BARS =====================

    _buildHpBars() {
        if (this._hpBarObjs) this._hpBarObjs.forEach(o => o.destroy());
        this._hpBarObjs = [];
        const { width } = this.cameras.main;

        // Player HP bar (left)
        const pBg = this.add.rectangle(110, 50, 160, 14, 0x331111).setStrokeStyle(1, 0x664444).setDepth(10);
        this._playerHpBar = this.add.rectangle(110, 50, 160, 14, 0x44ff44).setDepth(10);
        const pLabel = this.add.text(30, 42, 'HP', { font: '11px monospace', fill: '#ff8888' }).setDepth(10);
        this._playerHpText = this.add.text(110, 50, `${this.playerStats.hp}/${this.playerStats.maxHp}`, {
            font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(11);
        this._hpBarObjs.push(pBg, this._playerHpBar, pLabel, this._playerHpText);

        if (this.practiceMode) {
            const badge = this.add.text(width - 20, 38, 'PRACTICE', {
                font: 'bold 13px monospace', fill: '#eedd88',
                backgroundColor: '#2a2418', padding: { x: 8, y: 4 },
                stroke: '#000', strokeThickness: 2
            }).setOrigin(1, 0.5).setDepth(10);
            this._hpBarObjs.push(badge);
        } else {
            // Monster HP bar (right)
            const mBg = this.add.rectangle(width - 110, 50, 160, 14, 0x331111).setStrokeStyle(1, 0x664444).setDepth(10);
            this._monsterHpBar = this.add.rectangle(width - 110, 50, 160, 14, 0xff4444).setDepth(10);
            const mLabel = this.add.text(width - 190, 42, this._entityData.name, {
                font: '11px monospace', fill: '#ffaa88'
            }).setDepth(10);
            this._monsterHpText = this.add.text(width - 110, 50, `${this._entityMeter}/${this._entityMaxHp}`, {
                font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(11);
            this._hpBarObjs.push(mBg, this._monsterHpBar, mLabel, this._monsterHpText);
        }
    }

    _updateHpBars() {
        if (this._playerHpBar) {
            const pRatio = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
            this._playerHpBar.setScale(pRatio, 1);
            this._playerHpText.setText(`${this.playerStats.hp}/${this.playerStats.maxHp}`);
        }
        if (this._monsterHpBar) {
            const mRatio = Math.max(0, this._entityMeter / this._entityMaxHp);
            this._monsterHpBar.setScale(mRatio, 1);
            this._monsterHpText.setText(`${this._entityMeter}/${this._entityMaxHp}`);
        }
    }

    _updateHud() {
        super._updateHud();
        this.entityCountText.setText(`Slain: ${this.session.entitiesDefeated}`);
    }
}
