// RhythmReadingScene: Cozy village rhythm sight-reading.
// A rhythm is shown as sheet music. Tap Spacebar / MIDI on every note onset.
// Villagers need your help — accurate tapping cheers them up!

import { AudioEngine } from '../systems/AudioEngine.js';
import { spellPattern } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';
import { MidiInput } from '../systems/MidiInput.js';
import { VILLAGERS } from '../data/villagers.js';

const SUBDIVISIONS = {
    quarter:   { label: 'Quarter',  cells: ['1','2','3','4'],
                 downbeats: [0,1,2,3], cellFraction: 1 },
    eighth:    { label: 'Eighth',   cells: ['1','+','2','+','3','+','4','+'],
                 downbeats: [0,2,4,6], cellFraction: 0.5 },
    sixteenth: { label: '16th',     cells: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'],
                 downbeats: [0,4,8,12], cellFraction: 0.25 },
    triplet:   { label: 'Triplet',  cells: ['1','p','l','2','p','l','3','p','l','4','p','l'],
                 downbeats: [0,3,6,9], cellFraction: 1/3 },
};

const BPM_MIN       = 72;
const BPM_MAX       = 132;
const TOLERANCE_FRAC = 0.45;
const TOLERANCE_MIN  = 100;
const TOLERANCE_MAX  = 280;

const GROUND_Y    = 480;
const PLAYER_X    = 110;
const SPAWN_X     = 750;
const DANGER_X    = PLAYER_X + 70;
const MONSTER_H   = 130;
const BOSS_H      = 200;

const PLAYER_HP_MAX   = 100;
const AUTO_PLAY_DELAY = 1200;  // ms to read notation before countdown
const RESULT_DISPLAY  = 1600;  // ms to see result before advancing

const MONSTER_POOL = Object.keys(VILLAGERS).filter(k => !VILLAGERS[k].isSpecial);
const BOSS_POOL    = Object.keys(VILLAGERS).filter(k =>  VILLAGERS[k].isSpecial);
const ZONE_BGS     = ['bg-forest','bg-village','bg-caves','bg-castle','bg-underworld','bg-tower'];

export class RhythmReadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RhythmReadingScene' });
    }

    init(data) {
        this.returnScene  = data.returnScene  || 'PracticeMenuScene';
        this.returnData   = data.returnData   || {};
        this.settings     = data.settings     || {};
        this.playerData   = data.playerData || data.returnData?.playerData
            || { hp: 100, maxHp: 100, attack: 30, defense: 5, level: 1, characterKey: 'char1' };
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#0a0a1a');

        // ── Background + ground ──────────────────────────────
        const bgKey = ZONE_BGS[Math.floor(Math.random() * ZONE_BGS.length)];
        if (this.textures.exists(bgKey)) {
            this.add.image(width / 2, height / 2, bgKey)
                .setDisplaySize(width, height).setAlpha(0.28);
        }
        const ground = this.add.graphics();
        ground.fillStyle(0x1a1a2a, 1);
        ground.fillRect(0, GROUND_Y, width, height - GROUND_Y);
        ground.lineStyle(2, 0x333355, 1);
        ground.lineBetween(0, GROUND_Y, width, GROUND_Y);
        ground.setDepth(1);

        // ── Session state ────────────────────────────────────
        this._state           = 'idle';
        this._bpm             = 100;
        this._quarterMs       = 600;
        this._lastTap         = null;
        this._pattern         = [];
        this._groupGrid       = [];
        this._onsetCells      = [];
        this._taps            = [];
        this._barStart        = null;
        this._timers          = [];
        this._monsterX        = SPAWN_X;
        this._approachSpeed   = 90;   // px/s, updated per bar
        this._gameOverFlag    = false;

        this.session = { score: 0, streak: 0, villagersHelped: 0, round: 0 };

        // Player HP
        this._playerHp    = this.playerData.hp    || PLAYER_HP_MAX;
        this._playerHpMax = this.playerData.maxHp || PLAYER_HP_MAX;
        this._charKey     = this.playerData.characterKey || 'char1';

        // ── Player sprite ────────────────────────────────────
        this.playerSprite = this.add.sprite(PLAYER_X, GROUND_Y, `${this._charKey}-idle`)
            .setOrigin(0.5, 1).setScale(2.5 * (this.playerData.characterScale || 1.0))
            .setFlipX(this.playerData.characterFlip || false).setDepth(2);
        if (this.anims.exists(`${this._charKey}-idle`))
            this.playerSprite.play(`${this._charKey}-idle`);

        // ── Danger overlay ───────────────────────────────────
        this._dangerOverlay = this.add.rectangle(width/2, height/2, width, height, 0x4466aa, 0)
            .setDepth(50);

        // ── HUD ──────────────────────────────────────────────
        this._buildHUD(width, height);

        // ── Grid container (rebuilt each round) ──────────────
        this._gridObjs        = [];
        this._gridCellRects   = [];
        this._gridCellLabels  = [];
        this._gridCellCenters = [];

        // ── Audio + MIDI ─────────────────────────────────────
        this.audioEngine = new AudioEngine();
        try { await this.audioEngine.init(); } catch(e) {}
        this._applySoundSettings();

        this._midi = new MidiInput();
        this._midi.init().catch(() => {});
        this._midi.onNoteOn(() => this._onTap());

        // ── Notation renderer ─────────────────────────────────
        this.notationRenderer = new RhythmNotationRenderer(this);

        // ── Keyboard (document-level for reliability) ─────────
        this._keyHandler = (e) => {
            if (e.code === 'Space')  { e.preventDefault(); this._onTap(); }
            if (e.code === 'Escape') this._leave();
        };
        document.addEventListener('keydown', this._keyHandler);
        this.input.on('pointerdown', (ptr) => {
            if (this.input.hitTestPointer(ptr).length === 0) this._onTap();
        });

        this.events.on('resume', () => {
            this._applySoundSettings();
            this._renderNotation();
        });

        // ── First monster ─────────────────────────────────────
        this._spawnMonster();
    }

    _applySoundSettings() {
        const s = this.settings.sounds || {};
        if (s.click)      this.audioEngine.setClickPreset(s.click);
        if (s.rhythmNote) this.audioEngine.setRhythmNotePreset(s.rhythmNote);
        const v = s.volumes || {};
        if (v.click      != null) this.audioEngine.setClickLevel(v.click);
        if (v.rhythmNote != null) this.audioEngine.setRhythmNoteLevel(v.rhythmNote);
    }

    // ── HUD ───────────────────────────────────────────────────

    _buildHUD(width, height) {
        this.scoreText = this.add.text(20, 12, 'Score: 0', {
            font: 'bold 18px monospace', fill: '#ffcc00',
            stroke: '#000', strokeThickness: 3
        }).setDepth(10);

        this.roundText = this.add.text(width - 20, 12, 'Round 1', {
            font: '14px monospace', fill: '#aaddff',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0).setDepth(10);

        this.streakText = this.add.text(20, 36, '', {
            font: '13px monospace', fill: '#ff9988',
            stroke: '#000', strokeThickness: 2
        }).setDepth(10);

        this.slainText = this.add.text(width / 2, 12, '', {
            font: '14px monospace', fill: '#88ff88',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(10);

        this.add.text(width / 2, height - 12, 'SIGHT-TAP', {
            font: '11px monospace', fill: '#334455',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(10);

        this.msgText = this.add.text(width / 2, GROUND_Y + 22, '', {
            font: 'bold 16px monospace', fill: '#ffffff',
            stroke: '#000', strokeThickness: 3, align: 'center',
            wordWrap: { width: width - 60 }
        }).setOrigin(0.5, 0).setDepth(10);

        // HP bars
        this._hpBarBg     = this.add.graphics().setDepth(8);
        this._hpBarFg     = this.add.graphics().setDepth(9);
        this._hpBarText   = this.add.text(0, 0, '', {
            font: '11px monospace', fill: '#ffffff', stroke: '#000', strokeThickness: 2
        }).setDepth(10);
        this._mHpBarBg    = this.add.graphics().setDepth(8);
        this._mHpBarFg    = this.add.graphics().setDepth(9);
        this._monsterName = this.add.text(0, 0, '', {
            font: 'bold 13px monospace', fill: '#ffaaaa',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(10);

        // Tempo display
        this._bpmText = this.add.text(width / 2, height - 14, '♩= --', {
            font: '13px monospace', fill: '#445566',
            stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(10);

        // Quit button
        this._makeBtn(50, height - 24, 'QUIT', '#221111', '#443333', () => this._leave())
            .setDepth(10);
    }

    _buildHpBars() {
        const { width } = this.cameras.main;

        // Player HP bar — top left
        const px = 20, py = 56, pw = 160, ph = 14;
        this._hpBarBg.clear();
        this._hpBarBg.fillStyle(0x330000, 1).fillRect(px, py, pw, ph);
        this._phpBarRect = { x: px, y: py, w: pw, h: ph };
        this._hpBarText.setPosition(px + pw + 6, py + 1).setText(`HP ${this._playerHp}/${this._playerHpMax}`);
        this._updatePlayerHpBar();

        // Monster HP bar — top right
        const mx = width - 20 - 160, my = 30, mw = 160, mh = 14;
        this._mHpBarBg.clear();
        this._mHpBarBg.fillStyle(0x220000, 1).fillRect(mx, my, mw, mh);
        this._mhpBarRect = { x: mx, y: my, w: mw, h: mh };
        const mName = this._currentMonsterData?.name || '';
        this._monsterName.setPosition(mx + mw / 2, my - 2).setText(mName);
        this._updateMonsterHpBar();
    }

    _updatePlayerHpBar() {
        if (!this._phpBarRect) return;
        const { x, y, w, h } = this._phpBarRect;
        const ratio = Math.max(0, this._playerHp / this._playerHpMax);
        this._hpBarFg.clear()
            .fillStyle(ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xff3333, 1)
            .fillRect(x, y, Math.floor(w * ratio), h);
        this._hpBarText.setText(`HP ${Math.max(0,this._playerHp)}/${this._playerHpMax}`);
    }

    _updateMonsterHpBar() {
        if (!this._mhpBarRect) return;
        const { x, y, w, h } = this._mhpBarRect;
        const ratio = Math.max(0, this._monsterHp / this._monsterHpMax);
        this._mHpBarFg.clear()
            .fillStyle(0xcc4444, 1)
            .fillRect(x, y, Math.floor(w * ratio), h);
    }

    // ── Monster spawning ──────────────────────────────────────

    _spawnMonster() {
        if (this._gameOverFlag) return;
        this.session.round++;
        this._updateHUD();

        // Special villager every 5th round
        const isBoss = this.session.villagersHelped > 0 && this.session.villagersHelped % 5 === 0;
        const pool   = isBoss ? BOSS_POOL : MONSTER_POOL;
        const key    = pool[Math.floor(Math.random() * pool.length)];
        const data   = VILLAGERS[key];

        this._currentMonsterKey  = key;
        this._currentMonsterData = data;
        this._isBoss             = isBoss;
        this._monsterHp          = data.helpNeeded  || 40;
        this._monsterHpMax       = this._monsterHp;
        this._monsterAttack      = data.patience || 10;
        this._monsterX           = SPAWN_X;

        // Destroy previous sprite
        if (this._monsterSprite) { this._monsterSprite.destroy(); this._monsterSprite = null; }

        const spriteKey = `villager-${data.spriteKey || key}`;
        if (this.textures.exists(spriteKey)) {
            const targetH = isBoss ? BOSS_H : MONSTER_H;
            const scale   = targetH / (data.frameHeight || 64);
            this._monsterSprite = this.add.sprite(SPAWN_X, GROUND_Y, spriteKey)
                .setOrigin(0.5, 1).setScale(scale).setDepth(2);

            const animKey = `villager-${key}-idle`;
            if (!this.anims.exists(animKey)) {
                this.anims.create({
                    key: animKey,
                    frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: (data.frameCount || 4) - 1 }),
                    frameRate: 6, repeat: -1
                });
            }
            this._monsterSprite.play(animKey);
            this._monsterSprite.setFlipX(data.facesRight !== false);
        }

        this._buildHpBars();
        this.msgText.setText(`${data.name} needs your help!`).setStyle({ fill: '#ffaacc' });

        this._generateRound();
    }

    // ── Round generation ──────────────────────────────────────

    _generateRound() {
        this._stopAll();
        this._taps    = [];
        this._state   = 'idle';
        this._lastTap = null;

        // Randomize tempo each round
        this._bpm       = BPM_MIN + Math.floor(Math.random() * (BPM_MAX - BPM_MIN + 1));
        this._quarterMs = 60000 / this._bpm;
        if (this._bpmText) this._bpmText.setText(`♩= ${this._bpm}`);

        const subs = (this.settings.rhythmSubs?.length) ? this.settings.rhythmSubs : ['quarter'];
        this._subdivision = subs[Math.floor(Math.random() * subs.length)];

        const sub = SUBDIVISIONS[this._subdivision];
        const n   = sub.cells.length;

        // Randomize density: 5 – 55 % of cells become tied (held) rather than onset
        const restFrac = 0.05 + Math.random() * 0.50;
        this._pattern  = new Array(n).fill(true);
        const restTarget = Math.floor(n * restFrac);
        for (let r = 0; r < restTarget; r++) {
            const candidates = this._pattern
                .map((v, i) => (v && i > 0) ? i : -1)
                .filter(i => i >= 0);
            if (!candidates.length) break;
            this._pattern[candidates[Math.floor(Math.random() * candidates.length)]] = false;
        }

        // GroupGrid: non-onset cells carry previous onset's group ID (tied notes, no rests)
        let currentGroup = 0;
        this._groupGrid = this._pattern.map((v, i) => {
            if (v) currentGroup = i + 1;
            return currentGroup;
        });
        this._onsetCells = this._pattern.reduce((a, v, i) => { if (v) a.push(i); return a; }, []);

        this._renderNotation();
        this._buildGrid();
        this._setGridVisible(false);

        this._schedule(() => this._startRound(), AUTO_PLAY_DELAY);
    }

    _renderNotation() {
        const { width, height } = this.cameras.main;
        const spelled = spellPattern(this._groupGrid, this._subdivision);
        this.notationRenderer.render(spelled, this._subdivision, width / 2, height * 0.20, width - 80);
    }

    // ── Rhythm grid ───────────────────────────────────────────

    _clearGrid() {
        this._gridObjs.forEach(o => o?.destroy());
        this._gridObjs        = [];
        this._gridCellRects   = [];
        this._gridCellLabels  = [];
        this._gridCellCenters = [];
    }

    _buildGrid() {
        this._clearGrid();
        const { width, height } = this.cameras.main;
        const sub   = SUBDIVISIONS[this._subdivision];
        const n     = sub.cells.length;
        const GAP   = 3, MARGIN = 40;
        const cellW = (width - MARGIN * 2 - GAP * (n - 1)) / n;
        const cellH = 42;
        const gridY = height * 0.40;
        const gridX = MARGIN;

        this._gridCellMs = this._quarterMs * sub.cellFraction;
        this._gridN      = n;

        const g = this.add.graphics();
        g.lineStyle(1, 0x334466, 0.5);
        sub.downbeats.forEach(di => {
            if (!di) return;
            const lx = gridX + di * (cellW + GAP) - GAP / 2;
            g.lineBetween(lx, gridY - 2, lx, gridY + cellH + 2);
        });
        this._gridObjs.push(g);

        for (let i = 0; i < n; i++) {
            const cx    = gridX + i * (cellW + GAP) + cellW / 2;
            const cy    = gridY + cellH / 2;
            const isDB  = sub.downbeats.includes(i);
            const isNote = this._pattern[i];

            const bg = this.add.rectangle(cx, cy, cellW, cellH,
                isNote ? 0x1a2233 : 0x0c1018)
                .setStrokeStyle(1, isNote ? 0x334466 : 0x1a2233);

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 14px monospace' : '11px monospace',
                fill: isNote ? (isDB ? '#6688aa' : '#445566') : '#222e3a'
            }).setOrigin(0.5);

            this._gridCellRects.push(bg);
            this._gridCellLabels.push(lbl);
            this._gridCellCenters.push({ x: cx, y: cy });
            this._gridObjs.push(bg, lbl);
        }
    }

    _setGridVisible(v) {
        this._gridObjs.forEach(o => o?.setVisible?.(v));
    }

    _gridCellAt(ms) {
        return Math.min(this._gridN - 1, Math.max(0, Math.floor(ms / this._gridCellMs)));
    }

    _flashGridCell(i, fill, stroke, labelColor) {
        this._gridCellRects[i]?.setFillStyle(fill).setStrokeStyle(2, stroke);
        if (this._gridCellLabels[i]) this._gridCellLabels[i].setStyle({ fill: labelColor });
    }

    _resetGridColors() {
        const sub = SUBDIVISIONS[this._subdivision];
        for (let i = 0; i < this._gridN; i++) {
            const isNote = this._pattern[i];
            const isDB   = sub.downbeats.includes(i);
            this._gridCellRects[i]?.setFillStyle(isNote ? 0x1a2233 : 0x0c1018)
                .setStrokeStyle(1, isNote ? 0x334466 : 0x1a2233);
            if (this._gridCellLabels[i]) {
                this._gridCellLabels[i].setStyle({
                    fill: isNote ? (isDB ? '#6688aa' : '#445566') : '#222e3a'
                });
            }
        }
    }

    // ── Playback ──────────────────────────────────────────────

    _startRound() {
        if (this._state !== 'idle') return;
        this._state = 'countdown';
        this._taps  = [];

        const sub    = SUBDIVISIONS[this._subdivision];
        const cellMs = this._quarterMs * sub.cellFraction;
        const n      = sub.cells.length;

        // Set approach speed so monster crosses ~2/3 of the remaining gap in one bar
        const barMs = n * cellMs;
        const gap   = this._monsterX - DANGER_X;
        this._approachSpeed = (gap * 0.65) / (barMs / 1000);

        const COUNT_IN = 4;
        for (let b = 0; b < COUNT_IN; b++) {
            this._schedule(() => {
                this.msgText.setText(b < COUNT_IN - 1 ? `${COUNT_IN - b}...` : 'TAP!').setStyle({ fill: '#ffcc00' });
                this.audioEngine.playClick(b === 0);
            }, b * this._quarterMs);
        }

        this._schedule(() => {
            this._state    = 'recording';
            this._barStart = performance.now();
            this._resetGridColors();
            this.msgText.setText('TAP!').setStyle({ fill: '#44ff88' });

            // Metronome clicks on downbeats during the bar
            sub.downbeats.forEach(di => {
                this._schedule(() => {
                    if (this._state !== 'recording') return;
                    this.audioEngine.playClick(di === 0);
                }, di * cellMs);
            });

            // End of bar → evaluate
            this._schedule(() => {
                if (this._state === 'recording') this._evaluate();
            }, n * cellMs + 200);

        }, COUNT_IN * this._quarterMs);
    }

    // ── Monster movement ──────────────────────────────────────

    update(time, delta) {
        if (this._state !== 'recording' || !this._monsterSprite || this._gameOverFlag) return;

        const dx = (this._approachSpeed * delta) / 1000;
        this._monsterX = Math.max(DANGER_X, this._monsterX - dx);
        this._monsterSprite.x = this._monsterX;

        // Danger overlay
        const dist     = this._monsterX - DANGER_X;
        const maxDist  = SPAWN_X - DANGER_X;
        const danger   = 1 - Math.max(0, dist / maxDist);
        if (danger > 0.4) {
            this._dangerOverlay.setAlpha(danger * 0.15 * (Math.sin(time * 0.008) * 0.5 + 0.5));
        } else {
            this._dangerOverlay.setAlpha(0);
        }
    }

    // ── Tap handling ──────────────────────────────────────────

    _onTap() {
        if (this._state !== 'recording') return;
        const now = performance.now();
        if (this._lastTap && now - this._lastTap < 80) return;
        this._lastTap = now;

        const t = now - this._barStart;
        this._taps.push(t);

        const cell = this._gridCellAt(t);
        this._gridCellRects[cell]?.setFillStyle(0x2255aa).setStrokeStyle(2, 0x66aaff);
        if (this._gridCellLabels[cell]) this._gridCellLabels[cell].setStyle({ fill: '#88ccff' });
    }

    // ── Evaluation ────────────────────────────────────────────

    _evaluate() {
        this._state = 'feedback';
        this._stopAll();
        this._dangerOverlay.setAlpha(0);
        this._setGridVisible(true);

        const sub      = SUBDIVISIONS[this._subdivision];
        const cellMs   = this._quarterMs * sub.cellFraction;
        const tol      = Math.max(TOLERANCE_MIN, Math.min(TOLERANCE_MAX, cellMs * TOLERANCE_FRAC));
        const latency  = this.settings.tapLatencyMs || 0;
        const adjusted = this._taps.map(t => t - latency);
        const expected = this._onsetCells.map(i => i * cellMs);

        // Greedy nearest-match
        const usedTaps = new Set();
        const results  = expected.map(exp => {
            let bestIdx = -1, bestDiff = Infinity;
            adjusted.forEach((tap, ti) => {
                if (usedTaps.has(ti)) return;
                const d = Math.abs(tap - exp);
                if (d < tol && d < bestDiff) { bestDiff = d; bestIdx = ti; }
            });
            if (bestIdx >= 0) {
                usedTaps.add(bestIdx);
                return { hit: true, error: Math.round(adjusted[bestIdx] - exp) };
            }
            return { hit: false, error: null };
        });

        const hits      = results.filter(r => r.hit).length;
        const total     = expected.length;
        const extraTaps = this._taps.length - usedTaps.size;
        const accuracy  = hits / Math.max(1, total);
        const pct       = Math.round(accuracy * 100);

        // Color grid: green=hit, orange=missed, red=extra
        this._resetGridColors();
        results.forEach((res, ei) => {
            const cell = this._onsetCells[ei];
            if (res.hit) this._flashGridCell(cell, 0x114422, 0x44ff66, '#44ff66');
            else         this._flashGridCell(cell, 0x332200, 0xff8800, '#ff8800');
        });
        this._taps.forEach((tap, ti) => {
            if (!usedTaps.has(ti))
                this._flashGridCell(this._gridCellAt(tap), 0x331111, 0xff3333, '#ff3333');
        });

        const passed = accuracy >= 0.70 && extraTaps <= Math.max(1, Math.floor(total * 0.3));

        if (passed) {
            // Deal damage to monster
            const dmg = Math.floor(accuracy * 28) + 4 + Math.min(20, this.session.streak * 3);
            this._monsterHp = Math.max(0, this._monsterHp - dmg);
            this.session.streak++;
            const pts = 30 + Math.floor(pct * 1.2) + Math.min(40, this.session.streak * 8);
            this.session.score += pts;

            // Player attack animation + damage number
            if (this.anims.exists(`${this._charKey}-attack`))
                this.playerSprite.play(`${this._charKey}-attack`).once('animationcomplete',
                    () => { if (!this._gameOverFlag) this.playerSprite.play(`${this._charKey}-idle`); });

            this._showDamageNumber(this._monsterX, GROUND_Y - MONSTER_H - 20, dmg, '#44ff66', false);

            // Push monster back
            const pushback = Math.min(SPAWN_X - this._monsterX, 120 + Math.floor(accuracy * 100));
            this._monsterX += pushback;
            if (this._monsterSprite) {
                this.tweens.add({ targets: this._monsterSprite, x: this._monsterX, duration: 350, ease: 'Power2' });
            }
            this._updateMonsterHpBar();

            const extraStr = extraTaps > 0 ? `  ${extraTaps} extra` : '';
            const avgErr   = results.filter(r=>r.hit&&r.error!=null).reduce((s,r)=>s+Math.abs(r.error),0) / Math.max(1,hits);
            this.msgText.setText(
                `${pct}%  ${hits}/${total}  -${dmg} HP  +${pts} pts${extraStr}\n±${Math.round(avgErr)}ms avg`
            ).setStyle({ fill: '#66ff88' });
            this.audioEngine.playCorrect();
        } else {
            // Monster attacks player
            const dmg = Math.max(2, Math.floor((1 - accuracy) * this._monsterAttack * 0.6) + 2);
            this._playerHp = Math.max(0, this._playerHp - dmg);
            this.session.streak = 0;

            if (this.anims.exists(`${this._charKey}-hurt`))
                this.playerSprite.play(`${this._charKey}-hurt`).once('animationcomplete',
                    () => { if (!this._gameOverFlag) this.playerSprite.play(`${this._charKey}-idle`); });

            this._showDamageNumber(PLAYER_X, GROUND_Y - 80, dmg, '#ffaa44', true);
            this._updatePlayerHpBar();

            const extraStr = extraTaps > 0 ? `  ${extraTaps} extra` : '';
            this.msgText.setText(
                `${pct}%  ${hits}/${total}${extraStr}  Player -${dmg} HP`
            ).setStyle({ fill: '#ff8866' });
            this.audioEngine.playWrong();
        }

        this._updateHUD();

        // Auto-advance
        this._schedule(() => this._advanceAfterEval(), RESULT_DISPLAY);
    }

    _advanceAfterEval() {
        if (this._gameOverFlag) return;
        if (this._playerHp <= 0) { this._gameOver(); return; }
        if (this._monsterHp <= 0) { this._monsterDefeated(); return; }
        this._generateRound();
    }

    _monsterDefeated() {
        this.session.villagersHelped++;
        this.slainText.setText(`✦ ${this.session.villagersHelped} helped`);
        this.msgText.setText(`${this._currentMonsterData?.name} is happy again!`).setStyle({ fill: '#ffcc00' });
        this.audioEngine.playCorrect();

        if (this._monsterSprite) {
            this.tweens.add({
                targets: this._monsterSprite, x: SPAWN_X + 100, alpha: 0,
                duration: 600, ease: 'Power2',
                onComplete: () => { this._monsterSprite?.destroy(); this._monsterSprite = null; }
            });
        }
        this._schedule(() => this._spawnMonster(), 1200);
    }

    _gameOver() {
        this._gameOverFlag = true;
        this._stopAll();
        const { width, height } = this.cameras.main;
        this.cameras.main.shake(200, 0.008);
        this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7).setDepth(60);
        this.add.text(width/2, height/2 - 40, 'OUT OF ENERGY!', {
            font: 'bold 48px monospace', fill: '#ffaa44',
            stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width/2, height/2 + 20, `Score: ${this.session.score}`, {
            font: 'bold 24px monospace', fill: '#ffcc00',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(61);
        this.add.text(width/2, height/2 + 55, `Villagers Helped: ${this.session.villagersHelped}`, {
            font: '18px monospace', fill: '#aaffaa', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(61);

        this.time.delayedCall(3500, () => this._leave());
    }

    // ── Leave ─────────────────────────────────────────────────

    _leave() {
        this._stopAll();
        this.notationRenderer.clear();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        if (this._midi) this._midi.dispose();
        this.audioEngine.dispose();
        this.scene.start(this.returnScene, this.returnData);
    }

    // ── Helpers ───────────────────────────────────────────────

    _schedule(fn, delayMs) {
        const t = this.time.delayedCall(delayMs, fn, [], this);
        this._timers.push(t);
        return t;
    }

    _stopAll() {
        this._timers.forEach(t => { if (t?.remove) t.remove(); });
        this._timers = [];
    }

    _updateHUD() {
        this.scoreText.setText(`Score: ${this.session.score}`);
        this.roundText.setText(`Round ${this.session.round}`);
        this.streakText.setText(this.session.streak >= 2 ? `streak x${this.session.streak}` : '');
        if (this.session.villagersHelped > 0)
            this.slainText.setText(`✦ ${this.session.villagersHelped} helped`);
    }

    _showDamageNumber(x, y, amount, color, isPlayer) {
        const txt = this.add.text(x, y, `-${amount}`, {
            font: 'bold 22px monospace', fill: color,
            stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
            targets: txt, y: y - 55, alpha: 0, duration: 900, ease: 'Power2',
            onComplete: () => txt.destroy()
        });
    }

    _makeBtn(x, y, label, bg, hover, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 16px monospace', fill: '#ffffff',
            backgroundColor: bg, padding: { x: 14, y: 7 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hover }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bg }));
        btn.on('pointerdown', cb);
        return btn;
    }
}
