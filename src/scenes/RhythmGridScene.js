// RhythmGridScene: Counting-based rhythm game.
// A rhythm plays ONCE with a metronome click (downbeat accented).
// The user marks a grid to show where the notes fall, then submits.

import { AudioEngine } from '../systems/AudioEngine.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { spellPattern, splitRestsAtCursor } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';
import { RhythmKeyboardInput } from '../systems/RhythmKeyboardInput.js';

// ── Subdivision definitions ──────────────────────────────────

const SUBDIVISIONS = {
    quarter: {
        key: 'quarter', label: 'Quarter',
        cells: ['1', '2', '3', '4'],
        downbeats: [0, 1, 2, 3],   // every cell is a beat
        cellFraction: 1,
    },
    eighth: {
        key: 'eighth', label: 'Eighth',
        cells: ['1', '+', '2', '+', '3', '+', '4', '+'],
        downbeats: [0, 2, 4, 6],
        cellFraction: 0.5,
    },
    sixteenth: {
        key: 'sixteenth', label: '16th',
        cells: ['1', 'e', '+', 'a', '2', 'e', '+', 'a', '3', 'e', '+', 'a', '4', 'e', '+', 'a'],
        downbeats: [0, 4, 8, 12],
        cellFraction: 0.25,
    },
    triplet: {
        key: 'triplet', label: 'Triplet',
        cells: ['1', 'p', 'l', '2', 'p', 'l', '3', 'p', 'l', '4', 'p', 'l'],
        downbeats: [0, 3, 6, 9],
        cellFraction: 1 / 3,
    },
};

const BPM = 100;

export class RhythmGridScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RhythmGridScene' });
    }

    init(data) {
        this.returnScene = data.returnScene || 'MenuScene';
        this.returnData  = data.returnData  || {};
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#06080e');

        this._subdivision = 'quarter';
        this._pattern     = [];
        this._userGrid    = [];
        this._playing     = false;
        this._submitted   = false;
        this._dragging    = false;
        this._sustainGraphics = null;
        this._round       = 1;
        this._score       = 0;
        this._streak      = 0;
        this._gridObjs    = [];
        this._tabObjs     = [];
        this._keyboardInput = null;
        this._keyboardHud = [];

        // Audio
        this.audioEngine = new AudioEngine();

        // Notation renderer
        this.notationRenderer = new RhythmNotationRenderer(this);

        this.events.on('shutdown', () => {
            this._stopPlayback();
            this.audioEngine.dispose();
            this.notationRenderer.clear();
            if (this._keyboardInput) this._keyboardInput.disable();
        });

        // ── HUD ──
        this.add.text(width / 2, 22, 'RHYTHM', {
            font: 'bold 24px monospace', fill: '#ffaa00',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        this.scoreText = this.add.text(20, 12, 'Score: 0', {
            font: '13px monospace', fill: '#ffcc00', stroke: '#000', strokeThickness: 2
        });
        this.roundText = this.add.text(width - 20, 12, 'Round 1', {
            font: '13px monospace', fill: '#aaddff', stroke: '#000', strokeThickness: 2
        }).setOrigin(1, 0);
        this.streakText = this.add.text(20, 34, '', {
            font: '11px monospace', fill: '#ff9988', stroke: '#000', strokeThickness: 2
        });

        // ── Subdivision tabs ──
        this._drawTabs(width);

        // ── Message area ──
        this.msgText = this.add.text(width / 2, 100, 'Press PLAY, then click cells or use keyboard (3-7 duration, Space=note, 0=rest)', {
            font: '13px monospace', fill: '#8899aa', align: 'center'
        }).setOrigin(0.5);

        // Counting guide — hidden (counts now shown inside grid cells)
        this.guideText = this.add.text(width / 2, -100, '', {
            font: '12px monospace', fill: '#445566', align: 'center'
        }).setOrigin(0.5);

        // ── Bottom buttons ──
        const btnY = height - 40;

        this.playBtn = this._makeBtn(width / 2 - 200, btnY, '▶  PLAY', '#112233', '#224455', () => {
            this._playOnce();
        });

        this.submitBtn = this._makeBtn(width / 2 - 50, btnY, 'SUBMIT', '#1a3311', '#2a5522', () => {
            if (!this._submitted) {
                this._stopPlayback();
                this._submit();
            }
        });

        this.nextBtn = this._makeBtn(width / 2 + 100, btnY, 'NEXT →', '#222211', '#444422', () => {
            this._nextRound();
        }).setVisible(false);

        // Settings gear button
        this._makeBtn(width - 50, btnY, '⚙', '#112233', '#223344', () => this._openSettings());

        this._makeBtn(60, btnY, '← BACK', '#1a1122', '#2a2244', () => {
            this._stopPlayback();
            this.audioEngine.dispose();
            this.scene.start(this.returnScene, this.returnData);
        });

        // Global drag-to-sustain listeners (registered once)
        this.input.on('pointermove', (ptr) => this._onDragMove(ptr));
        this.input.on('pointerup', () => this._onDragEnd());

        // Init audio & first round
        try { await this.audioEngine.init(); } catch (e) { console.warn('audio init failed', e); }
        this._applySoundSettings();
        this._generateRound();
        this._playOnce();

        // ESC opens settings overlay
        this.input.keyboard.on('keydown-ESC', () => this._openSettings());

        // Re-apply sounds and restore notation when returning from SettingsScene
        this.events.on('resume', () => {
            this._applySoundSettings();
            this._renderNotation();
        });
    }

    _applySoundSettings() {
        const saved = (new ProgressionManager()).loadArcadeSettings() || {};
        const s = saved.sounds || {};
        if (s.click)      this.audioEngine.setClickPreset(s.click);
        if (s.rhythmNote) this.audioEngine.setRhythmNotePreset(s.rhythmNote);
        const v = s.volumes || {};
        if (v.click      != null) this.audioEngine.setClickLevel(v.click);
        if (v.rhythmNote != null) this.audioEngine.setRhythmNoteLevel(v.rhythmNote);
    }

    _openSettings() {
        this.notationRenderer.clear(); // hide DOM overlay so it doesn't cover the settings panel
        this.scene.launch('SettingsScene', { callerKey: 'RhythmGridScene', pauseCaller: true });
        this.scene.pause();
    }

    // ── Subdivision tabs ─────────────────────────────────────

    _drawTabs(width) {
        this._tabObjs.forEach(o => o.destroy());
        this._tabObjs = [];
        const keys = Object.keys(SUBDIVISIONS);
        const tabW = 110, gap = 10;
        const totalW = keys.length * (tabW + gap) - gap;
        const startX = width / 2 - totalW / 2 + tabW / 2;

        keys.forEach((key, i) => {
            const sub = SUBDIVISIONS[key];
            const x = startX + i * (tabW + gap);
            const active = key === this._subdivision;
            const btn = this.add.text(x, 60, sub.label, {
                font: 'bold 13px monospace',
                fill: active ? '#ffcc00' : '#778899',
                backgroundColor: active ? '#2a2a00' : '#111122',
                padding: { x: 14, y: 6 }, stroke: '#000', strokeThickness: 1
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => { if (key !== this._subdivision) btn.setStyle({ backgroundColor: '#1a1a33' }); });
            btn.on('pointerout',  () => { if (key !== this._subdivision) btn.setStyle({ backgroundColor: '#111122' }); });
            btn.on('pointerdown', () => {
                if (key !== this._subdivision) {
                    this._subdivision = key;
                    this._stopPlayback();
                    this._generateRound();
                    this._drawTabs(this.cameras.main.width);
                    this._playOnce();
                }
            });
            this._tabObjs.push(btn);
        });
    }

    // ── Round generation ─────────────────────────────────────

    _generateRound() {
        this._submitted = false;
        if (this.nextBtn) this.nextBtn.setVisible(false);
        if (this.playBtn) this.playBtn.setAlpha(1);
        this.msgText.setText('Press PLAY, then click cells or use keyboard (3-7 duration, Space=note, 0=rest)').setStyle({ fill: '#8899aa' });

        const sub = SUBDIVISIONS[this._subdivision];
        const n = sub.cells.length;

        // Random pattern — weighted toward downbeats
        this._pattern = new Array(n).fill(false);
        const noteTarget = Math.max(2, Math.floor(n * (0.3 + Math.random() * 0.4)));
        let noteCount = 0;
        for (let i = 0; i < n; i++) {
            const isDB = sub.downbeats.includes(i);
            if (Math.random() < (isDB ? 0.75 : 0.4) && noteCount < noteTarget) {
                this._pattern[i] = true;
                noteCount++;
            }
        }
        this._pattern[0] = true;
        if (this._pattern.filter(v => v).length < 2) {
            this._pattern[Math.floor(n / 2)] = true;
        }

        this._userGrid = new Array(n).fill(0);
        this._nextGroupId = 1;
        this.guideText.setText(sub.cells.join('   '));
        this._drawGrid();
        this._updateHud();
        this._renderNotation();
    }

    // ── Note/rest image keys per subdivision ────────────────

    _getNoteKey() {
        switch (this._subdivision) {
            case 'quarter':   return 'note-quarter';
            case 'eighth':    return 'note-eighth';
            case 'sixteenth': return 'note-sixteenth';
            case 'triplet':   return 'note-eighth';
            default:          return 'note-quarter';
        }
    }

    _getRestKey() {
        switch (this._subdivision) {
            case 'quarter':   return 'rest-quarter';
            case 'eighth':    return 'rest-eighth';
            case 'sixteenth': return 'rest-sixteenth';
            case 'triplet':   return 'rest-eighth';
            default:          return 'rest-quarter';
        }
    }

    /**
     * Create a symbol image sprite at the given position, scaled to fit the cell.
     */
    _createSymbol(cx, cy, isNote, tint) {
        const key = isNote ? this._getNoteKey() : this._getRestKey();
        const sprite = this.add.image(cx, cy, key);
        // Scale to fit within the cell
        const maxH = this._cellH ? this._cellH * 0.6 : 48;
        const scale = maxH / sprite.height;
        sprite.setScale(scale);
        sprite.setTint(tint);
        return sprite;
    }

    /**
     * Update an existing symbol sprite to show note or rest with a new tint.
     */
    _updateSymbol(sprite, cx, cy, isNote, tint) {
        const key = isNote ? this._getNoteKey() : this._getRestKey();
        sprite.setTexture(key);
        sprite.setPosition(cx, cy);
        const maxH = this._cellH * 0.6;
        const scale = maxH / sprite.height;
        sprite.setScale(scale);
        sprite.setTint(tint);
    }

    // ── Interactive grid ─────────────────────────────────────

    _drawGrid() {
        this._gridObjs.forEach(o => o.destroy());
        this._gridObjs = [];

        const { width, height } = this.cameras.main;
        const sub = SUBDIVISIONS[this._subdivision];
        const n = sub.cells.length;

        const GAP = 4;
        const MARGIN = 40;
        const usable = width - MARGIN * 2;
        const cellW = (usable - GAP * (n - 1)) / n;
        const cellH = 65;
        // Notation above, count grid below
        const notationY = height * 0.36;   // ~216 — sheet music center
        const gridY = notationY + 70;      // ~286 — count grid top (below notation)
        const gridX = MARGIN;

        // Beat separators
        const g = this.add.graphics();
        g.lineStyle(1, 0x334466, 0.4);
        sub.downbeats.forEach(di => {
            if (di === 0) return;
            const lx = gridX + di * (cellW + GAP) - GAP / 2;
            g.lineBetween(lx, gridY - 8, lx, gridY + cellH + 10);
        });
        this._gridObjs.push(g);

        // Playback cursor
        this._cursorRect = this.add.rectangle(0, gridY + cellH / 2, cellW, cellH + 4, 0xffffff, 0)
            .setOrigin(0, 0.5).setVisible(false);
        this._gridObjs.push(this._cursorRect);

        this._cellRects = [];
        this._cellLabels = [];
        this._cellCenters = [];

        for (let i = 0; i < n; i++) {
            const cx = gridX + i * (cellW + GAP);
            const cy = gridY;
            const isDB = sub.downbeats.includes(i);
            const isNote = this._userGrid[i];
            const symCx = cx + cellW / 2;
            const symCy = cy + cellH / 2;

            const bg = this.add.rectangle(symCx, symCy, cellW, cellH,
                isNote ? 0x1a2a44 : 0x111122)
                .setStrokeStyle(1, 0x223344);

            // Count label inside the cell (VexFlow renders notes below)
            const lbl = this.add.text(symCx, symCy, sub.cells[i], {
                font: isDB ? 'bold 16px monospace' : '13px monospace',
                fill: isDB ? '#8899aa' : '#445566'
            }).setOrigin(0.5);

            this._cellRects.push(bg);
            this._cellLabels.push(lbl);
            this._cellCenters.push({ x: symCx, y: symCy });
            this._gridObjs.push(bg, lbl);

            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this._onCellDown(i));
            bg.on('pointerover', () => { if (!this._submitted && !this._dragging) bg.setStrokeStyle(2, 0x5588aa); });
            bg.on('pointerout',  () => { if (!this._submitted) bg.setStrokeStyle(1, 0x223344); });
        }

        // Drag events are registered in create(), not here

        this._cellW = cellW;
        this._cellGap = GAP;
        this._gridX = gridX;
        this._gridY = gridY;
        this._cellH = cellH;
        this._notationY = notationY;
        this._sustainGraphics = null;
        this._refreshGridVisuals();

        // Keyboard input mode: cursor + HUD (always active alongside click)
        this._setupKeyboardMode(gridX, gridY, cellW, cellH, sub);
    }

    // ── Keyboard input mode ─────────────────────────────────

    _setupKeyboardMode(gridX, gridY, cellW, cellH, sub) {
        // Clean up previous
        this._keyboardHud.forEach(o => o.destroy());
        this._keyboardHud = [];
        if (this._kbCursorRect) { this._kbCursorRect.destroy(); this._kbCursorRect = null; }

        const { width } = this.cameras.main;
        const ticksPerCell = { quarter: 4, eighth: 2, sixteenth: 1, triplet: 1 }[this._subdivision];

        // Create or reset keyboard input
        if (!this._keyboardInput) {
            this._keyboardInput = new RhythmKeyboardInput(this, {
                cells: sub.cells.length,
                ticksPerCell,
                subdivision: this._subdivision,
                onUpdate: (grid, cursorCell) => this._onKeyboardUpdate(grid, cursorCell),
                onSubmit: () => { if (!this._submitted) { this._stopPlayback(); this._submit(); } },
            });
            this._keyboardInput.enable();
        } else {
            this._keyboardInput.reset(sub.cells.length, ticksPerCell);
        }

        // Key hints — below count grid
        const hints = this.add.text(width / 2, gridY + cellH + 14,
            '3-7: duration   A-G: note   0: rest   T: tie   .: dot   ←→: move   ⌫: undo   Enter: submit', {
                font: '10px monospace', fill: '#556677'
            }).setOrigin(0.5);
        this._keyboardHud.push(hints);
        this._gridObjs.push(hints);
    }

    _onKeyboardUpdate(grid, cursorCell) {
        if (this._submitted) return;
        // Update user grid from keyboard input
        for (let i = 0; i < grid.length; i++) {
            this._userGrid[i] = grid[i];
        }
        this._nextGroupId = this._keyboardInput._nextGroupId;

        this._refreshGridVisuals();
        this._renderNotation();
    }

    // ── Drag-to-sustain interaction ───────────────────────────

    _getCellIndexAtPointer(ptr) {
        const n = this._userGrid.length;
        const px = ptr.x;
        const py = ptr.y;
        for (let i = 0; i < n; i++) {
            const cx = this._cellCenters[i].x;
            const hw = this._cellW / 2 + 2; // small tolerance
            if (px >= cx - hw && px <= cx + hw &&
                py >= this._gridY - 10 && py <= this._gridY + this._cellH + 10) {
                return i;
            }
        }
        return -1;
    }

    _onCellDown(idx) {
        if (this._submitted) return;

        if (this._userGrid[idx]) {
            const groupId = this._userGrid[idx];
            // Clear this cell and everything after it in the same group
            for (let i = idx; i < this._userGrid.length; i++) {
                if (this._userGrid[i] === groupId) {
                    this._userGrid[i] = 0;
                } else {
                    break;
                }
            }
            this._dragging = false;
            this._refreshGridVisuals();
            this._renderNotation();
            if (this._keyboardInput) this._keyboardInput.syncFromGrid(this._userGrid);
        } else {
            // Start a new note with a unique group ID — begin drag
            const gid = this._nextGroupId++;
            this._userGrid[idx] = gid;
            this._dragging = true;
            this._dragGroupId = gid;
            this._dragStart = idx;
            this._dragEnd = idx;
            this._refreshGridVisuals();
            this._renderNotation();
        }
    }

    _onDragMove(ptr) {
        if (this._submitted || !this._dragging || !ptr.isDown) return;

        const idx = this._getCellIndexAtPointer(ptr);
        if (idx < 0 || idx <= this._dragStart) return;
        if (idx === this._dragEnd) return;

        // Fill all cells from drag start to current position with this group ID
        for (let i = this._dragStart; i <= idx; i++) {
            this._userGrid[i] = this._dragGroupId;
        }
        this._dragEnd = idx;
        this._refreshGridVisuals();
        this._renderNotation();
    }

    _onDragEnd() {
        this._dragging = false;
        if (this._keyboardInput) this._keyboardInput.syncFromGrid(this._userGrid);
    }

    /**
     * Refresh all grid cell visuals based on _userGrid state.
     * Shows note symbol on the first cell of each group,
     * sustain bar on continuation cells.
     */
    _refreshGridVisuals() {
        const n = this._userGrid.length;

        for (let i = 0; i < n; i++) {
            const gid = this._userGrid[i];
            const isNote = gid > 0;
            const { x, y } = this._cellCenters[i];

            // Is this the first cell of its group?
            const isGroupStart = isNote && (i === 0 || this._userGrid[i - 1] !== gid);

            const lbl = this._cellLabels[i];
            if (isNote) {
                this._cellRects[i].setFillStyle(0x1a2a44);
                if (isGroupStart) {
                    if (lbl) lbl.setStyle({ fill: '#66aaff' });
                } else {
                    if (lbl) lbl.setStyle({ fill: '#1a3a6a' }); // sustain — muted
                }
            } else {
                this._cellRects[i].setFillStyle(0x111122);
                if (lbl) lbl.setStyle({ fill: '#445566' }); // rest — dim
            }
        }

        // Draw sustain bars connecting held cells within the same group
        if (this._sustainGraphics) {
            this._sustainGraphics.clear();
        } else {
            this._sustainGraphics = this.add.graphics();
            this._gridObjs.push(this._sustainGraphics);
        }

        const sg = this._sustainGraphics;
        sg.clear();

        const visited = new Set();
        for (let i = 0; i < n; i++) {
            const gid = this._userGrid[i];
            if (gid === 0 || visited.has(gid)) continue;
            visited.add(gid);

            // Find extent of this group
            let end = i;
            while (end + 1 < n && this._userGrid[end + 1] === gid) end++;

            if (end > i) {
                const startX = this._cellCenters[i].x;
                const endX = this._cellCenters[end].x;
                const barY = this._cellCenters[i].y + this._cellH * 0.3;
                sg.lineStyle(3, 0x44aaff, 0.6);
                sg.lineBetween(startX, barY, endX, barY);
                for (let j = i + 1; j <= end; j++) {
                    sg.fillStyle(0x44aaff, 0.5);
                    sg.fillCircle(this._cellCenters[j].x, barY, 3);
                }
            }
        }
    }

    // ── Playback (loops: pattern → count-in bar → pattern → …) ──

    _playOnce() {
        if (this._playing) {
            // Toggle off — stop playback
            this._stopPlayback();
            return;
        }
        this._playing = true;
        this.playBtn.setText('■  STOP');
        this.playBtn.setAlpha(1);

        this._playLoop();
    }

    _playLoop() {
        if (!this._playing) return;

        const sub = SUBDIVISIONS[this._subdivision];
        const n = sub.cells.length;
        const quarterMs = 60000 / BPM;
        const cellMs = quarterMs * sub.cellFraction;

        let i = 0;
        const tick = () => {
            if (!this._playing) return;

            // Move cursor
            const cx = this._gridX + i * (this._cellW + this._cellGap);
            this._cursorRect.setPosition(cx, this._gridY + this._cellH / 2)
                .setVisible(true).setAlpha(0.12);

            // Metronome click on downbeats
            if (sub.downbeats.includes(i)) {
                const isOne = (i === 0);
                this.audioEngine.playClick(isOne);
            }

            // Rhythm note on pattern cells
            if (this._pattern[i]) {
                this.audioEngine.playDrumNote();
            }

            i++;
            if (i < n) {
                this._playTimer = this.time.delayedCall(cellMs, tick);
            } else {
                // Pattern done — play a count-in bar (clicks only), then loop
                this._playTimer = this.time.delayedCall(cellMs, () => {
                    this._cursorRect.setVisible(false);
                    if (!this._playing) return;
                    this._playCountIn(() => this._playLoop());
                });
            }
        };

        tick();
    }

    _playCountIn(onComplete) {
        if (!this._playing) return;

        const sub = SUBDIVISIONS[this._subdivision];
        const quarterMs = 60000 / BPM;
        const cellMs = quarterMs * sub.cellFraction;
        const n = sub.cells.length;

        let i = 0;
        const tick = () => {
            if (!this._playing) return;

            // Click on downbeats only — no pattern notes, no cursor
            if (sub.downbeats.includes(i)) {
                this.audioEngine.playClick(i === 0);
            }

            i++;
            if (i < n) {
                this._playTimer = this.time.delayedCall(cellMs, tick);
            } else {
                this._playTimer = this.time.delayedCall(cellMs, () => {
                    if (this._playing && onComplete) onComplete();
                });
            }
        };

        tick();
    }

    _stopPlayback() {
        this._playing = false;
        if (this._playTimer) {
            this._playTimer.remove(false);
            this._playTimer = null;
        }
        if (this._cursorRect) this._cursorRect.setVisible(false);
        if (this.playBtn) {
            this.playBtn.setText('▶  PLAY');
            this.playBtn.setAlpha(1);
        }
    }

    // ── Notation rendering ──────────────────────────────────

    _renderNotation() {
        const { width } = this.cameras.main;
        let spelled = spellPattern(this._userGrid, this._subdivision);
        const cursorTick = this._keyboardInput ? this._keyboardInput._cursorTick : -1;
        const selectedTicks = this._keyboardInput ? this._keyboardInput.effectiveTicks : -1;
        if (cursorTick >= 0 && selectedTicks > 0) {
            spelled = splitRestsAtCursor(spelled, cursorTick, selectedTicks, this._subdivision);
        }
        const notationY = this._notationY || (this._gridY - 120);
        this.notationRenderer.render(spelled, this._subdivision, width / 2, notationY, width - 80, cursorTick);
    }

    // ── Submit & score ───────────────────────────────────────

    _submit() {
        this._stopPlayback();
        this._submitted = true;

        const n = this._pattern.length;

        // Build onset arrays: true at the START of each note, false elsewhere
        const patternOnsets = this._pattern.map((v, i) =>
            v && (i === 0 || !this._pattern[i - 1]));
        const userOnsets = this._userGrid.map((v, i) =>
            v > 0 && (i === 0 || this._userGrid[i - 1] === 0));

        let hits = 0, extra = 0;
        const expectedCount = patternOnsets.filter(Boolean).length;

        for (let i = 0; i < n; i++) {
            const expected = patternOnsets[i];
            const got      = userOnsets[i];

            const lbl = this._cellLabels[i];
            if (expected && got) {
                // Hit — correct onset
                this._cellRects[i].setFillStyle(0x114422);
                if (lbl) lbl.setStyle({ fill: '#44ff66' });
                hits++;
            } else if (expected && !got) {
                // Missed onset
                this._cellRects[i].setFillStyle(0x332200).setStrokeStyle(2, 0xff8800);
                if (lbl) lbl.setStyle({ fill: '#ff8800' });
            } else if (!expected && got) {
                // Extra (wrong) onset
                this._cellRects[i].setFillStyle(0x331111).setStrokeStyle(2, 0xff3333);
                if (lbl) lbl.setStyle({ fill: '#ff3333' });
                extra++;
            } else {
                // Both silent — no visual change needed
                this._cellRects[i].setFillStyle(0x0e1118);
                if (lbl) lbl.setStyle({ fill: '#556677' });
            }
        }

        const score    = Math.max(0, hits - extra);
        const accuracy = Math.round((score / Math.max(1, expectedCount)) * 100);
        if (accuracy >= 80) {
            const pts = 50 + Math.floor(accuracy * 1.5) + Math.min(50, this._streak * 10);
            this._score += pts;
            this._streak++;
            this.msgText.setText(`${accuracy}% correct!  +${pts} pts  (streak: ${this._streak})`).setStyle({ fill: '#66ff88' });
            this.audioEngine.playCorrect();
        } else {
            this._streak = 0;
            this.msgText.setText(`${accuracy}% — orange = missed notes, red = wrong hits`).setStyle({ fill: '#ff8866' });
            this.audioEngine.playWrong();
        }

        this.nextBtn.setVisible(true);
        this._updateHud();
    }

    _nextRound() {
        this._round++;
        this._generateRound();
        this._playOnce();
    }

    // ── HUD ──────────────────────────────────────────────────

    _updateHud() {
        this.scoreText.setText(`Score: ${this._score}`);
        this.roundText.setText(`Round ${this._round}`);
        this.streakText.setText(this._streak >= 2 ? `Streak: ${this._streak}x` : '');
    }

    // ── UI helpers ───────────────────────────────────────────

    _makeBtn(x, y, label, bg, hover, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 15px monospace', fill: '#ffffff',
            backgroundColor: bg, padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hover }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bg }));
        btn.on('pointerdown', cb);
        return btn;
    }
}
