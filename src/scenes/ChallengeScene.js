// ChallengeScene: Cozy village theme — villagers approach, answer to help them!
// Extends ChallengeBaseScene with villager happiness, escape timer, rescued preview.

import { ChallengeBaseScene, GROUND_Y, PLAYER_X } from './ChallengeBaseScene.js';
import { VILLAGERS } from '../data/villagers.js';

const VILLAGER_POOL_REGULAR = Object.keys(VILLAGERS).filter(k => !VILLAGERS[k].isSpecial);
const VILLAGER_POOL_SPECIAL = Object.keys(VILLAGERS).filter(k => VILLAGERS[k].isSpecial);

// Cozy procedural background palettes
const COZY_PALETTES = [
    { name: 'meadow',  sky: [0x87ceeb, 0xc8e6c9], ground: 0x4a8c3f, accent: 0xffeb3b, flowers: [0xff99cc, 0xffdd55, 0xcc77ff] },
    { name: 'sunset',  sky: [0xffb74d, 0xff8a65], ground: 0x5a7a3a, accent: 0xff7043, flowers: [0xffab91, 0xfff176, 0xffcc80] },
    { name: 'garden',  sky: [0xa5d6a7, 0x81c784], ground: 0x388e3c, accent: 0xe91e63, flowers: [0xf48fb1, 0xce93d8, 0x80cbc4] },
    { name: 'twilight',sky: [0x7986cb, 0x5c6bc0], ground: 0x3a6a3a, accent: 0xffd54f, flowers: [0xb39ddb, 0x90caf9, 0xfff59d] },
    { name: 'morning', sky: [0xfff9c4, 0xffe0b2], ground: 0x66bb6a, accent: 0x26a69a, flowers: [0xffcc80, 0xa5d6a7, 0x80deea] },
    { name: 'moonlit', sky: [0x37474f, 0x263238], ground: 0x2e5a2e, accent: 0xb0bec5, flowers: [0x90a4ae, 0x80cbc4, 0xb39ddb] },
];

const PRACTICE_NPCS_COZY = {
    tone:        { key: 'villager-robin',    anim: 'robin-idle',    scale: 3.5, name: 'Robin',   h: 16, flip: true  },
    noteReading: { key: 'villager-squirrel', anim: 'squirrel-idle', scale: 3.5, name: 'Clover',  h: 19, flip: false },
    rhythm:      { key: 'villager-bunny',    anim: 'bunny-idle',    scale: 3.5, name: 'Melody',  h: 17, flip: true  },
    default:     { key: 'villager-chicken',  anim: 'chicken-idle',  scale: 3.5, name: 'Pippin',  h: 16, flip: true  },
};

export class ChallengeScene extends ChallengeBaseScene {
    constructor() {
        super({ key: 'ChallengeScene' });
    }

    // ===================== THEME CONFIG =====================

    _sceneKey() { return 'ChallengeScene'; }
    _defaultReturnScene() { return 'PracticeMenuScene'; }
    _defaultCharKey() { return 'char1'; }
    _dangerOverlayColor() { return 0x4488cc; }
    _overlayReturnScene() { return 'TopDownScene'; }
    _defaultMenuScene() { return 'PracticeMenuScene'; }
    _practiceNpcs() { return PRACTICE_NPCS_COZY; }

    _initTheme(data) {
        this.villagerKey = data.monsterKey || null;
        this._rescuedList = [];
        this._rescuedIcons = [];
        this._escapeTimer = null;
    }

    _victoryConfig() {
        return {
            title: 'WONDERFUL!',
            rewardLabel: (xp, gold) => `+${xp} Friendship   +${gold} Gratitude`,
            xpField: 'friendship', goldField: 'gratitude',
            playerLabel: (stats) => `Lv.${stats.level}  Energy ${stats.hp}/${stats.maxHp}`,
        };
    }

    _defeatConfig() {
        return {
            title: 'OUT OF ENERGY!', titleColor: '#4488cc',
            message: 'Energy restored to 50%', messageColor: '#aaccdd',
            bg: 0x001122, stroke: 0x4488cc,
            btnBg: '#112233', btnHover: '#223344',
        };
    }

    _gameOverConfig() {
        return {
            title: 'OUT OF ENERGY!', titleColor: '#4488cc',
            entityLabel: 'Villagers Helped',
        };
    }

    // ===================== BACKGROUND =====================

    _createBackground(width, height) {
        this._drawCozyBackground(width, height);
    }

    _drawCozyBackground(width, height) {
        const pal = COZY_PALETTES[(this.session?.round || 0) % COZY_PALETTES.length];
        const g = this.add.graphics().setDepth(0);

        const bands = 10;
        const bandH = GROUND_Y / bands;
        for (let i = 0; i < bands; i++) {
            const t = i / (bands - 1);
            const r = ((pal.sky[0] >> 16) & 0xff) + t * ((((pal.sky[1] >> 16) & 0xff) - ((pal.sky[0] >> 16) & 0xff)));
            const gr = ((pal.sky[0] >> 8) & 0xff) + t * ((((pal.sky[1] >> 8) & 0xff) - ((pal.sky[0] >> 8) & 0xff)));
            const b = (pal.sky[0] & 0xff) + t * (((pal.sky[1] & 0xff) - (pal.sky[0] & 0xff)));
            g.fillStyle((Math.round(r) << 16) | (Math.round(gr) << 8) | Math.round(b));
            g.fillRect(0, i * bandH, width, bandH + 1);
        }

        g.fillStyle(pal.ground);
        g.fillRect(0, GROUND_Y, width, height - GROUND_Y);
        g.fillStyle(pal.ground, 0.5);
        g.fillRect(0, GROUND_Y - 4, width, 8);

        g.fillStyle(pal.ground, 0.25);
        for (let x = 0; x < width; x += 3) {
            const h = 20 + Math.sin(x * 0.012) * 12 + Math.sin(x * 0.03) * 6;
            g.fillRect(x, GROUND_Y - h, 3, h);
        }

        g.fillStyle(0x2e7d32, 0.4);
        for (let i = 0; i < 18; i++) {
            const gx = 40 + i * 44 + ((i * 17) % 20);
            const gy = GROUND_Y + 8 + (i % 3) * 15;
            g.fillRect(gx, gy, 2, 6);
            g.fillRect(gx + 3, gy - 2, 2, 8);
            g.fillRect(gx + 6, gy + 1, 2, 5);
        }

        pal.flowers.forEach((color, fi) => {
            for (let i = 0; i < 5; i++) {
                const fx = 30 + fi * 230 + i * 48 + ((fi + i) * 37) % 60;
                const fy = GROUND_Y + 10 + ((fi + i) * 13) % 30;
                g.fillStyle(color, 0.7);
                g.fillCircle(fx, fy, 3);
                g.fillStyle(pal.accent, 0.6);
                g.fillCircle(fx, fy, 1.5);
            }
        });

        g.fillStyle(0xffffff, 0.15);
        [[120, 60], [340, 40], [560, 70], [700, 35]].forEach(([cx, cy]) => {
            g.fillEllipse(cx, cy, 60, 20);
            g.fillEllipse(cx + 20, cy - 8, 40, 16);
        });

        const treeColor = (pal.ground & 0xfefefe) >> 1;
        [[50, 0.6], [180, 0.8], [680, 0.7], [760, 0.5]].forEach(([tx, ts]) => {
            const th = 50 * ts;
            const ty = GROUND_Y;
            g.fillStyle(0x4a3520, 0.4);
            g.fillRect(tx - 2, ty - th * 0.4, 4, th * 0.4);
            g.fillStyle(treeColor, 0.35);
            g.fillCircle(tx, ty - th * 0.55, 16 * ts);
            g.fillCircle(tx - 8 * ts, ty - th * 0.65, 12 * ts);
            g.fillCircle(tx + 8 * ts, ty - th * 0.65, 12 * ts);
        });

        const hexStr = '#' + pal.sky[0].toString(16).padStart(6, '0');
        this.cameras.main.setBackgroundColor(hexStr);
    }

    // ===================== PLAYER SPRITE =====================

    _createPlayerSprite(charKey, width, height) {
        this.playerSprite = this.add.sprite(PLAYER_X, GROUND_Y, `player-${charKey}`, 0);
        this.playerSprite.setOrigin(0.5, 1);
        this.playerSprite.setScale(2.5 * (this.playerData.characterScale || 1.0));
        this.playerSprite.setFlipX(this.playerData.characterFlip || false);
        if (this.anims.exists(`${charKey}-idle`)) this.playerSprite.play(`${charKey}-idle`);
        this.playerSprite.setDepth(2);
    }

    // ===================== ENTITY SPAWNING =====================

    _spawnNextEntity() {
        if (this._gameOverFlag) return;

        if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }

        if (this.storyBattle && this.session.round > 0 && this._storyEntityDone) return;

        this.session.round++;
        this._updateHud();

        let villagerKey, isSpecial;
        if (this.storyBattle && this.villagerKey) {
            villagerKey = this.villagerKey;
            isSpecial = VILLAGERS[villagerKey]?.isSpecial || VILLAGERS[villagerKey]?.isBoss || false;
        } else {
            isSpecial = this.session.round % 10 === 0 && this.session.round > 0;
            const pool = isSpecial ? VILLAGER_POOL_SPECIAL : VILLAGER_POOL_REGULAR;
            villagerKey = pool[Math.floor(Math.random() * pool.length)];
        }
        const data = VILLAGERS[villagerKey];

        const { width } = this.cameras.main;
        const spawnX = width - 150;
        const spriteKey = data.spriteKey || `villager-${villagerKey}`;
        const targetH = (isSpecial && this.storyBattle) ? 120 : 80;
        const frameH = data.frameHeight || 17;
        const scale = targetH / frameH;

        if (this.textures.exists(spriteKey)) {
            this._entitySprite = this.add.sprite(spawnX, GROUND_Y, spriteKey);
            this._entitySprite.setOrigin(0.5, 1);
            this._entitySprite.setScale(scale);
            this._entitySprite.setDepth(2);

            const animKey = `villager-${villagerKey}-idle`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: (data.frameCount || 4) - 1 }),
                    frameRate: 6, repeat: -1
                });
            }
            this._entitySprite.play(animKey);
            this._entitySprite.setFlipX(data.facesRight !== false);
        } else {
            this._entitySprite = this.add.circle(spawnX, GROUND_Y - 40, isSpecial ? 40 : 28,
                isSpecial ? 0xffaa44 : 0x88cc66);
            this._entitySprite.setDepth(2);
        }

        this._entityKey = villagerKey;
        this._entityData = data;
        this._isSpecialRound = isSpecial;

        this._entityMeter = 0; // happiness 0-100
        this._entityAttack = data.patience || data.attack || 8;
        this._entityDefense = data.shyness || data.defense || 2;
        this._storyEntityDone = false;
        this._buildHpBars();

        this._challengeType = this._pickChallengeType();
        this.messageText.setText(`${data.name} needs your help!`);

        this._cancelEscapeTimer();
        if (!this.practiceMode) {
            const escapeMs = Math.max(8000, 15000 - (this.session.round - 1) * 300);
            this._escapeTimer = this.time.delayedCall(escapeMs, () => {
                if (!this._gameOverFlag) this._triggerEscape();
            });
        }

        const startDelay = this.practiceMode ? 400 : 800;
        this.time.delayedCall(startDelay, () => {
            if (this._gameOverFlag) return;
            this._askQuestion();
        });
    }

    _cancelEscapeTimer() {
        if (this._escapeTimer) {
            this._escapeTimer.remove(false);
            this._escapeTimer = null;
        }
    }

    _triggerEscape() {
        this._cancelEscapeTimer();
        this._questionActive = false;
        const { width } = this.cameras.main;
        if (this._entitySprite && this._entitySprite.active) {
            this.tweens.add({
                targets: this._entitySprite,
                x: width + 150,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }
                    this._animalGotAway();
                }
            });
        } else {
            this._animalGotAway();
        }
    }

    _animalGotAway() {
        if (this._gameOverFlag) return;
        this._cancelEscapeTimer();

        const { width } = this.cameras.main;
        const txt = this.add.text(width / 2, GROUND_Y - 60, 'Got away!', {
            font: 'bold 24px monospace', fill: '#ffaa44',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(12);
        this.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 1200, onComplete: () => txt.destroy() });

        const dmg = Math.max(2, Math.floor(this._entityAttack * 0.5));
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
        this._showDamageNumber(width / 2, GROUND_Y - 100, 0, '#ff8844', `-${dmg} energy`);
        this._updateHpBars();

        if (this._entitySprite) { this._entitySprite.destroy(); this._entitySprite = null; }

        if (this.playerStats.hp <= 0) {
            this._gameOverFlag = true;
            this._clearAllUI();
            this.time.delayedCall(600, () => this._gameOver());
            return;
        }

        this.time.delayedCall(800, () => this._spawnNextEntity());
    }

    update(time, delta) {
        // Escape is timer-based, no continuous movement
    }

    // ===================== CORRECT/WRONG HANDLERS =====================

    _onCorrectHit() {
        this._helpVillager();
    }

    _helpVillager() {
        const isRhythm = this._challengeType === 'rhythm' || this._challengeType === 'rhythmReading';
        const happinessGain = isRhythm ? (100 - (this._entityMeter || 0)) : (25 + Math.floor(Math.random() * 20));
        this._entityMeter = Math.min(100, (this._entityMeter || 0) + happinessGain);
        this._updateHpBars();

        if (this.isSidescrollMode) {
            const ax = this._entitySprite?.x || (this.cameras.main.width - 150);
            this._showDamageNumber(ax, GROUND_Y - 80, 0, '#ffcc44', `+${happinessGain}% ♥`);
            if (this._entityMeter >= 100) {
                this._storyEntityDone = true;
                this._showDamageNumber(ax, GROUND_Y - 120, 0, '#ffdd44', '\u2728 HAPPY!');
                this._addToRescuedPreview(this._entityData?.spriteKey || `villager-${this._entityKey}`, this._entityData?.name || 'Friend');
                this.time.delayedCall(600, () => this._returnPlayerThenVictory());
            } else {
                this.time.delayedCall(400, () => {
                    this._challengeType = this._pickChallengeType();
                    this._askQuestion();
                });
            }
            return;
        }

        const sp = this._entitySprite;
        if (sp) {
            const animalX = sp.x;
            this._showHitEffect(animalX, GROUND_Y - 40);
            this._showDamageNumber(animalX, GROUND_Y - 80, 0, '#ffcc44', `+${happinessGain}% ♥`);

            this.tweens.add({
                targets: sp,
                y: sp.y - 18,
                duration: 150, yoyo: true, ease: 'Power2',
                onComplete: () => {
                    if (sp.active) sp.setTint(0xffdd44);
                    this.time.delayedCall(200, () => { if (sp.active) sp.clearTint(); });
                }
            });

            if (this._entityMeter >= 100) {
                this._storyEntityDone = true;
                this._showDamageNumber(animalX, GROUND_Y - 110, 0, '#ffdd44', '\u2728 HAPPY!');
                const vData = this._entityData;
                this._addToRescuedPreview(vData.spriteKey || `villager-${this._entityKey}`, vData.name);
                this.time.delayedCall(500, () => this._animalFlyOff('happy'));
                return;
            }
        } else if (this._entityMeter >= 100) {
            this._storyEntityDone = true;
            const vData = this._entityData;
            if (vData) this._addToRescuedPreview(vData.spriteKey || `villager-${this._entityKey}`, vData.name);
            this.time.delayedCall(500, () => this._animalFlyOff('happy'));
            return;
        }

        this.time.delayedCall(500, () => {
            if (!this._gameOverFlag) {
                this._entityApproaching = true;
                this._challengeType = this._pickChallengeType();
                this.time.delayedCall(300, () => this._askQuestion());
            }
        });
    }

    _onWrongEffect() {
        // Villager scoots nervously away
        if (this.isSidescrollMode || this.practiceMode) {
            this._challengeType = this._pickChallengeType();
            this.time.delayedCall(500, () => this._askQuestion());
            return;
        }

        if (!this._entitySprite) return;

        this.tweens.add({
            targets: this._entitySprite,
            x: Math.min(this._entitySprite.x + 40, this.cameras.main.width - 40),
            duration: 200, ease: 'Power2',
            onComplete: () => {
                this._challengeType = this._pickChallengeType();
                this.time.delayedCall(500, () => this._askQuestion());
            }
        });
    }

    _showWrongDamage(dmg) {
        const dmgX = this.isSidescrollMode ? 120 : (this.playerSprite?.x || 120);
        const dmgY = this.isSidescrollMode ? 70  : ((this.playerSprite?.y || 80) - 80);
        this._showDamageNumber(dmgX, dmgY, 0, '#ff5544', `-${dmg} energy`);
    }

    _onStoryPlayerDefeated() {
        this.time.delayedCall(600, () => this._animalFlyOff('sad'));
    }

    // ===================== ANIMAL FLY OFF =====================

    _animalFlyOff(reason) {
        this._cancelEscapeTimer();
        if (!this._entitySprite) {
            this._onAnimalFlyOffComplete(reason);
            return;
        }
        const { width } = this.cameras.main;
        const sp = this._entitySprite;

        if (reason === 'happy') {
            this.tweens.add({
                targets: sp,
                x: PLAYER_X, y: GROUND_Y - 80,
                scaleX: 0.3, scaleY: 0.3,
                duration: 600, ease: 'Cubic.easeIn',
                onComplete: () => {
                    sp.destroy();
                    this._entitySprite = null;
                    this._showDamageNumber(PLAYER_X, GROUND_Y - 120, 0, '#ff88cc', '♥');
                    this._onAnimalFlyOffComplete(reason);
                }
            });
        } else {
            this.tweens.add({
                targets: sp,
                x: width + 160, y: sp.y,
                scaleX: 0.05, scaleY: 0.05, alpha: 0,
                duration: 400, ease: 'Power3',
                onComplete: () => {
                    sp.destroy();
                    this._entitySprite = null;
                    this._onAnimalFlyOffComplete(reason);
                }
            });
        }
    }

    _onAnimalFlyOffComplete(reason) {
        if (reason === 'happy') {
            if (this.storyBattle) {
                this.time.delayedCall(300, () => this._storyVictory());
            } else {
                this._returnPlayerThenSpawn();
            }
        } else {
            this.time.delayedCall(300, () => this._storyDefeat());
        }
    }

    _returnPlayerThenSpawn() {
        this.session.entitiesDefeated++;
        this._updateHud();
        this.time.delayedCall(600, () => this._spawnNextEntity());
    }

    _returnPlayerThenVictory() {
        this.time.delayedCall(400, () => this._storyVictory());
    }

    // ===================== HIT EFFECT (hearts) =====================

    _showHitEffect(x, y) {
        const heartCount = 3;
        for (let i = 0; i < heartCount; i++) {
            const hx = x + (Math.random() - 0.5) * 40;
            const hy = y + (Math.random() - 0.5) * 20;

            let heart;
            if (this.textures.exists('heart')) {
                heart = this.add.image(hx, hy, 'heart').setScale(0.5).setDepth(10);
            } else {
                heart = this.add.text(hx, hy, '\u2764', {
                    font: 'bold 20px sans-serif', fill: '#ff6688'
                }).setOrigin(0.5).setDepth(10);
            }

            this.tweens.add({
                targets: heart,
                y: hy - 60 - Math.random() * 30,
                alpha: 0,
                scaleX: (heart.scaleX || 1) * 1.3,
                scaleY: (heart.scaleY || 1) * 1.3,
                duration: 700 + Math.random() * 300,
                delay: i * 100,
                ease: 'Power2',
                onComplete: () => heart.destroy()
            });
        }
    }

    // ===================== RESCUED PREVIEW =====================

    _addToRescuedPreview(spriteKey, name) {
        const { width, height } = this.cameras.main;
        this._rescuedList.push({ spriteKey, name });

        this._rescuedIcons.forEach(o => o.destroy());
        this._rescuedIcons = [];

        const show = this._rescuedList.slice(-5);
        const slotW = 38;
        const baseX = width - 12;
        const baseY = height - 38;

        const panelW = show.length * slotW + 10;
        const panelBg = this.add.rectangle(baseX - panelW / 2, baseY, panelW, 36, 0x000000, 0.45)
            .setOrigin(0.5).setDepth(9);
        this._rescuedIcons.push(panelBg);

        show.forEach((entry, i) => {
            const sx = baseX - (show.length - 1 - i) * slotW - slotW / 2;
            if (this.textures.exists(entry.spriteKey)) {
                const icon = this.add.sprite(sx, baseY, entry.spriteKey, 0)
                    .setScale(1.8).setDepth(10);
                this._rescuedIcons.push(icon);

                if (i === show.length - 1) {
                    icon.setScale(0);
                    this.tweens.add({ targets: icon, scaleX: 1.8, scaleY: 1.8, duration: 300, ease: 'Back.easeOut' });
                }
            }
        });

        const lbl = this.add.text(baseX - panelW + 4, baseY - 18, `Rescued: ${this._rescuedList.length}`, {
            font: '10px monospace', fill: '#aaffaa', stroke: '#000', strokeThickness: 2
        }).setDepth(10);
        this._rescuedIcons.push(lbl);
    }

    // ===================== HP BARS =====================

    _buildHpBars() {
        if (this._hpBarObjs) this._hpBarObjs.forEach(o => o.destroy());
        this._hpBarObjs = [];
        const { width } = this.cameras.main;

        const pBg = this.add.rectangle(110, 34, 160, 14, 0x1a2a1a).setStrokeStyle(1, 0x336633).setDepth(10);
        this._playerHpBar = this.add.rectangle(110, 34, 160, 14, 0x44ee66).setDepth(10);
        const pLabel = this.add.text(16, 27, '⚡', { font: '13px monospace', fill: '#88ffaa' }).setDepth(10);
        this._playerHpText = this.add.text(110, 34, `${this.playerStats.hp}/${this.playerStats.maxHp}`, {
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
            const mBg = this.add.rectangle(width - 110, 34, 160, 14, 0x221a00).setStrokeStyle(1, 0x886622).setDepth(10);
            this._entityHelpBar = this.add.rectangle(width - 110, 34, 160, 14, 0xffcc44).setDepth(10);
            this._entityHelpBar.setScale(0, 1);
            const mLabel = this.add.text(width - 190, 27, this._entityData.name, {
                font: '10px monospace', fill: '#ffaa88'
            }).setDepth(10);
            const heartLabel = this.add.text(width - 24, 27, '♥', { font: '11px monospace', fill: '#ffcc44' }).setDepth(10);
            this._entityHelpText = this.add.text(width - 110, 34, '0%', {
                font: '10px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(11);
            this._hpBarObjs.push(mBg, this._entityHelpBar, mLabel, heartLabel, this._entityHelpText);
        }
    }

    _updateHpBars() {
        if (this._playerHpBar) {
            const pRatio = Math.max(0, this.playerStats.hp / this.playerStats.maxHp);
            this._playerHpBar.setScale(pRatio, 1);
            const col = pRatio > 0.5 ? 0x44ee66 : pRatio > 0.25 ? 0xffcc44 : 0xff5544;
            this._playerHpBar.setFillStyle(col);
            this._playerHpText.setText(`${this.playerStats.hp}/${this.playerStats.maxHp}`);
        }
        if (this._entityHelpBar) {
            const mRatio = Math.min(1, Math.max(0, (this._entityMeter || 0) / 100));
            this._entityHelpBar.setScale(mRatio, 1);
            this._entityHelpText.setText(`${Math.round(this._entityMeter || 0)}%`);
        }
    }

    _updateHud() {
        super._updateHud();
        this.entityCountText.setText(`Helped: ${this.session.entitiesDefeated}`);
    }

    // ===================== CLEAR ALL =====================

    _clearAllUI() {
        super._clearAllUI();
        if (this._rescuedIcons) {
            this._rescuedIcons.forEach(o => o.destroy());
            this._rescuedIcons = [];
        }
    }

    _storyVictory() {
        this._cancelEscapeTimer();
        super._storyVictory();
    }

    _storyDefeat() {
        this._cancelEscapeTimer();
        super._storyDefeat();
    }

    _renderGameOverExtra(width, height) {
        if (this._rescuedList && this._rescuedList.length > 0) {
            this.add.text(width / 2, height * 0.67, 'Rescued:', {
                font: '14px monospace', fill: '#ccddaa',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(61);

            const maxShow = Math.min(this._rescuedList.length, 8);
            const startX = width / 2 - (maxShow * 36) / 2 + 18;
            for (let i = 0; i < maxShow; i++) {
                const r = this._rescuedList[i];
                if (this.textures.exists(r.spriteKey)) {
                    this.add.sprite(startX + i * 36, height * 0.73, r.spriteKey, 0)
                        .setScale(1.8).setDepth(61);
                }
            }
            if (this._rescuedList.length > 8) {
                this.add.text(width / 2 + (maxShow * 36) / 2 + 10, height * 0.73, `+${this._rescuedList.length - 8}`, {
                    font: '12px monospace', fill: '#aaaaaa'
                }).setOrigin(0, 0.5).setDepth(61);
            }
        }
    }
}
