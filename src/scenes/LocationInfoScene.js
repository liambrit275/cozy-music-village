// LocationInfoScene: Visual overlay showing the animal to rescue and boss info.
// Step 1 — Meet the animal, see the challenge. Buttons: "Tell me more" / "Fight Boss!"
// Step 2 — Tutorial panel. Button: "Fight for [animal]!"
// Launched over WorldMapScene (which is paused).

import { SCALE_DEGREES } from '../systems/MusicTheory.js';
import { getNpcForLocation } from '../data/npcs.js';
import { WorldMapProgress } from '../systems/WorldMapProgress.js';
import { MONSTERS } from '../data/monsters.js';

const PANEL_W = 620, PANEL_H = 440;

export class LocationInfoScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LocationInfoScene' });
    }

    init(data) {
        this.location    = data.location;
        this.region      = data.region;
        this.playerData  = data.playerData || null;
        this.returnScene = data.returnScene || null;
        this.progression = data.progression || null;
        this.currentZone = data.currentZone || 'forest';
        this.npc         = getNpcForLocation(this.location.id);
        this._step       = 'encounter'; // 'encounter' | 'tutorial'
    }

    create() {
        const { width, height } = this.cameras.main;
        this._cx = width / 2;
        this._cy = height / 2;
        this._objs = [];

        // Dim overlay
        this.add.rectangle(this._cx, this._cy, width, height, 0x000000, 0.75).setDepth(0);

        this._drawPanel();
        this._showEncounter();
    }

    // ─── Panel shell ──────────────────────────────────────────────

    _drawPanel() {
        const { cx, cy } = this._coords();
        const g = this.add.graphics().setDepth(1);

        // Shadow
        g.fillStyle(0x000000, 0.5);
        g.fillRoundedRect(cx - PANEL_W / 2 + 6, cy - PANEL_H / 2 + 6, PANEL_W, PANEL_H, 18);

        // Background image inside panel
        const bgImg = this.add.image(cx, cy, this.region.backgroundKey)
            .setDisplaySize(PANEL_W, PANEL_H).setDepth(1);
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRoundedRect(cx - PANEL_W / 2, cy - PANEL_H / 2, PANEL_W, PANEL_H, 18);
        bgImg.setMask(maskShape.createGeometryMask());

        // Dark overlay for readability
        const dark = this.add.graphics().setDepth(1);
        dark.fillStyle(0x000000, 0.55);
        dark.fillRoundedRect(cx - PANEL_W / 2, cy - PANEL_H / 2, PANEL_W, PANEL_H, 18);

        // Top bar
        g.fillStyle(this.region.color, 0.7);
        g.fillRoundedRect(cx - PANEL_W / 2, cy - PANEL_H / 2, PANEL_W, 48, 18);
        g.fillRect(cx - PANEL_W / 2, cy - PANEL_H / 2 + 28, PANEL_W, 20);

        // Border
        g.lineStyle(2, this.region.color, 0.7);
        g.strokeRoundedRect(cx - PANEL_W / 2, cy - PANEL_H / 2, PANEL_W, PANEL_H, 18);

        // Top-bar text
        this.add.text(cx, cy - PANEL_H / 2 + 24, `${this.region.label}  •  ${this.region.subtitle}`, {
            font: '12px monospace', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(3);
    }

    // ─── Step 1: Encounter ────────────────────────────────────────

    _showEncounter() {
        this._clearObjs();
        this._step = 'encounter';
        const { cx, cy } = this._coords();

        const saved = WorldMapProgress.load().isCompleted(this.location.id);
        const npc   = this.npc;

        const PORTRAIT_X = cx - PANEL_W / 2 + 120;
        const CONTENT_X  = cx - PANEL_W / 2 + 250;
        const CONTENT_W  = PANEL_W - 260;
        const TOP        = cy - PANEL_H / 2 + 60;

        // ── Animated animal sprite ──────────────────────────────
        if (npc) {
            this._drawAnimalPortrait(PORTRAIT_X, cy - 10, npc, saved);
        }

        // ── Dialogue ────────────────────────────────────────────
        const titleTxt = npc ? npc.name : this.region.animalName;
        const subtitleTxt = npc ? npc.title : this.region.subtitle;

        const charName = this.add.text(CONTENT_X, TOP, titleTxt, {
            font: 'bold 24px monospace', fill: this.region.textColor,
            stroke: '#000000', strokeThickness: 3
        }).setDepth(4);
        this._objs.push(charName);

        const charTitle = this.add.text(CONTENT_X, TOP + 32, subtitleTxt, {
            font: '11px monospace', fill: '#bbaa88'
        }).setDepth(4);
        this._objs.push(charTitle);

        // Speech bubble
        const bubbleText = npc
            ? (saved ? npc.saved : npc.intro)
            : this.region.description;

        const bubble = this._drawSpeechBubble(
            CONTENT_X, TOP + 56,
            CONTENT_W, 140,
            bubbleText
        );
        bubble.forEach(o => this._objs.push(o));

        // Boss info
        const bossData = MONSTERS[this.location.bossMonster];
        if (bossData) {
            const completionCount = WorldMapProgress.load().getCompletionCount(this.location.id);
            const diffMult = 1 + completionCount * 0.5;
            const bossHp = Math.round(bossData.hp * diffMult);
            const bossInfo = saved
                ? `Boss: ${bossData.name} (HP ${bossHp} — Lv.${completionCount + 1})`
                : `Boss: ${bossData.name} (HP ${bossHp})`;
            const infoTxt = this.add.text(CONTENT_X, TOP + 210, bossInfo, {
                font: 'bold 12px monospace', fill: this.region.textColor,
                stroke: '#000000', strokeThickness: 2
            }).setDepth(4);
            this._objs.push(infoTxt);
        }

        // ── Buttons ─────────────────────────────────────────────
        const btnY = cy + PANEL_H / 2 - 36;
        const isCurrentZone = this.region.zoneKey === this.currentZone;

        if (!saved) {
            // Not yet rescued — show info only, must beat boss in side-scroller
            const learnBtn = this._makeBtn(cx - 60, btnY, '📖 Tell me more', '#2a2418', '#3a3020', () => {
                this._showTutorial();
            });
            learnBtn.forEach(o => this._objs.push(o));

            // Locked message
            const lockMsg = this.add.text(cx + 120, btnY, '🔒 Defeat the boss to unlock!', {
                font: '11px monospace', fill: '#ff9966',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5).setDepth(6);
            this._objs.push(lockMsg);
        } else {
            // Beaten — fast travel available (unless already here)
            const goLabel = isCurrentZone ? '✓ You are here' : '🗺  Travel Here';
            const goBtn = this._makeBtn(cx, btnY, goLabel, '#1a2a44', '#2a4466', () => {
                if (!isCurrentZone) this._fastTravel();
            });
            goBtn.forEach(o => this._objs.push(o));
            if (isCurrentZone) goBtn[0].setAlpha(0.5);
        }

        // Back
        const backBtn = this._makeBtn(cx - PANEL_W / 2 + 50, btnY, '← Back', '#2a2418', '#3a3020', () => {
            this._goBack();
        });
        backBtn.forEach(o => this._objs.push(o));
    }

    // ─── Step 2: Tutorial ─────────────────────────────────────────

    _showTutorial() {
        this._clearObjs();
        this._step = 'tutorial';
        const { cx, cy } = this._coords();
        const npc = this.npc;

        const TOP    = cy - PANEL_H / 2 + 66;
        const LEFT   = cx - PANEL_W / 2 + 24;
        const BODY_W = PANEL_W - 48;

        // Tutorial title
        const tTitle = this.add.text(cx, TOP, this.location.tutorialTitle, {
            font: 'bold 17px monospace', fill: '#ffffff',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(4);
        this._objs.push(tTitle);

        // NPC learn dialogue
        if (npc) {
            const learnTxt = this.add.text(cx, TOP + 32, npc.learn, {
                font: '11px monospace', fill: this.region.textColor,
                align: 'center', wordWrap: { width: BODY_W },
                fontStyle: 'italic',
                stroke: '#000000', strokeThickness: 1
            }).setOrigin(0.5, 0).setDepth(4);
            this._objs.push(learnTxt);
        }

        // Body text
        const bodyY = TOP + (npc ? 80 : 32);
        const body = this.add.text(LEFT, bodyY, this.location.tutorialBody, {
            font: '12px monospace', fill: '#ccccdd',
            wordWrap: { width: BODY_W }, lineSpacing: 3,
            stroke: '#000000', strokeThickness: 1
        }).setDepth(4);
        this._objs.push(body);

        // Mnemonic box
        if (this.location.tutorialMnemonic) {
            const mnY = bodyY + body.height + 10;
            const mnBg = this.add.rectangle(cx, mnY + 16, BODY_W, 34, this.region.color, 0.25).setDepth(4);
            const mnTxt = this.add.text(cx, mnY + 16, this.location.tutorialMnemonic, {
                font: 'bold 13px monospace', fill: this.region.textColor, align: 'center',
                wordWrap: { width: BODY_W - 20 },
                stroke: '#000000', strokeThickness: 1
            }).setOrigin(0.5).setDepth(4);
            this._objs.push(mnBg, mnTxt);
        }

        // Preview
        this._drawPreview(cx, cy, 4);

        // Buttons
        const btnY = cy + PANEL_H / 2 - 36;

        const backBtn = this._makeBtn(cx - 140, btnY, '← Back', '#2a2418', '#3a3020', () => {
            this._showEncounter();
        });
        backBtn.forEach(o => this._objs.push(o));

        const region = this.region;
        const infoLabel = npc
            ? `🔒 Defeat ${region.label} boss to rescue ${npc.name}`
            : '🔒 Defeat the boss first';
        const infoTxt = this.add.text(cx + 100, btnY, infoLabel, {
            font: '11px monospace', fill: '#ff9966',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(6);
        this._objs.push(infoTxt);
    }

    // ─── Animal portrait with sprite ──────────────────────────────

    _drawAnimalPortrait(x, y, npc, saved) {
        // Glow ring
        const ringColor = saved ? 0xffcc00 : this.region.color;
        const g = this.add.graphics().setDepth(3);
        g.lineStyle(3, ringColor, 0.8);
        g.strokeCircle(x, y - 20, 55);

        // Background circle
        g.fillStyle(0x0a0a1a, 0.7);
        g.fillCircle(x, y - 20, 52);

        if (saved) {
            g.fillStyle(0xffcc00, 0.15);
            g.fillCircle(x, y - 20, 52);
        }
        this._objs.push(g);

        // Animated sprite
        const sprite = this.add.sprite(x, y - 20, npc.spriteKey).setDepth(4);
        sprite.setScale(npc.scale);
        sprite.play(npc.animKey);
        this._objs.push(sprite);

        if (!saved) {
            // Cage bars over the animal
            const bars = this.add.graphics().setDepth(5);
            bars.lineStyle(2, 0x888888, 0.5);
            for (let bx = x - 24; bx <= x + 24; bx += 10) {
                bars.lineBetween(bx, y - 50, bx, y + 10);
            }
            bars.lineBetween(x - 26, y - 50, x + 26, y - 50);
            bars.lineBetween(x - 26, y + 10, x + 26, y + 10);
            this._objs.push(bars);
        }

        // Saved star badge
        if (saved) {
            const star = this.add.text(x + 40, y - 68, '⭐', {
                font: '20px monospace'
            }).setOrigin(0.5).setDepth(5);
            this._objs.push(star);
        }

        // Name tag
        const nameTag = this.add.text(x, y + 42, npc.name, {
            font: 'bold 14px monospace', fill: this.region.textColor,
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(4);
        this._objs.push(nameTag);

        const titleTag = this.add.text(x, y + 60, npc.title, {
            font: '10px monospace', fill: '#889999', align: 'center',
            wordWrap: { width: 160 },
            stroke: '#000000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(4);
        this._objs.push(titleTag);
    }

    // ─── Speech bubble ────────────────────────────────────────────

    _drawSpeechBubble(x, y, w, h, text) {
        const objs = [];
        const g = this.add.graphics().setDepth(3);

        const TAIL = 14;

        // Bubble tail
        g.fillStyle(0x1e2840, 0.9);
        g.fillTriangle(x - TAIL, y + 20, x, y + 14, x, y + 28);

        // Bubble body
        g.fillStyle(0x1e2840, 0.9);
        g.fillRoundedRect(x, y, w, h, 10);
        g.lineStyle(1, this.region.color, 0.4);
        g.strokeRoundedRect(x, y, w, h, 10);

        objs.push(g);

        const txt = this.add.text(x + 12, y + 12, text, {
            font: '12px monospace', fill: '#ddeeff',
            wordWrap: { width: w - 24 }, lineSpacing: 4,
            fontStyle: 'italic'
        }).setDepth(4);
        objs.push(txt);

        return objs;
    }

    // ─── Preview section ──────────────────────────────────────────

    _drawPreview(cx, cy, depth) {
        const previewY = cy + PANEL_H / 2 - 115;
        const cfg = this.location.arcadeConfig;

        const lbl = this.add.text(cx, previewY, "What you'll practice:", {
            font: '10px monospace', fill: '#667788',
            stroke: '#000000', strokeThickness: 1
        }).setOrigin(0.5).setDepth(depth);
        this._objs.push(lbl);

        if (cfg.mode === 'tones' && cfg.scaleDegrees) {
            this._drawTonesPreview(cx, previewY + 16, cfg.scaleDegrees, depth);
        } else {
            const t = this.add.text(cx, previewY + 16, this.location.tutorialPreview, {
                font: '12px monospace', fill: this.region.textColor, align: 'center',
                wordWrap: { width: PANEL_W - 48 },
                stroke: '#000000', strokeThickness: 1
            }).setOrigin(0.5, 0).setDepth(depth);
            this._objs.push(t);
        }
    }

    _drawTonesPreview(cx, y, degrees, depth) {
        const chipW = 44, chipH = 22, gap = 5;
        const rowW = degrees.length * (chipW + gap) - gap;
        const startX = cx - rowW / 2 + chipW / 2;
        degrees.forEach((deg, i) => {
            const info = SCALE_DEGREES[deg];
            if (!info) return;
            const x = startX + i * (chipW + gap);
            const bg = this.add.rectangle(x, y + chipH / 2, chipW, chipH,
                parseInt(info.color.replace('#', '0x'), 16) || 0x334466, 0.7).setDepth(depth);
            const t = this.add.text(x, y + chipH / 2, info.solfege, {
                font: 'bold 11px monospace', fill: '#ffffff'
            }).setOrigin(0.5).setDepth(depth);
            this._objs.push(bg, t);
        });
    }

    // ─── Button helper ────────────────────────────────────────────

    _makeBtn(x, y, label, bg, hover, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 14px monospace', fill: '#ffffff',
            backgroundColor: bg, padding: { x: 18, y: 9 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(6);
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hover }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bg }));
        btn.on('pointerdown', cb);
        return [btn];
    }

    // ─── Navigation ───────────────────────────────────────────────

    _goBack() {
        this.scene.stop('LocationInfoScene');
        this.scene.resume('WorldMapScene');
    }

    _fastTravel() {
        // Restart SidescrollScene in the selected region's zone
        this.scene.stop('LocationInfoScene');
        this.scene.stop('WorldMapScene');
        this.scene.stop('SidescrollScene');
        this.scene.start('SidescrollScene', {
            progression: this.progression,
            playerData:  this.playerData,
            zoneKey:     this.region.zoneKey,
        });
    }


    // ─── Helpers ──────────────────────────────────────────────────

    _coords() {
        return { cx: this._cx, cy: this._cy };
    }

    _clearObjs() {
        this._objs.forEach(o => o.destroy());
        this._objs = [];
    }
}
