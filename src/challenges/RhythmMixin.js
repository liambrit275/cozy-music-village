// RhythmMixin: All rhythm transcription methods extracted from ChallengeScene.
// These are mixed into ChallengeScene.prototype so `this` refers to the scene instance.

import { TIME_SIG_INFO, buildSubdivision, pickSubdivision } from '../data/levels.js';
import { spellPattern, splitRestsAtCursor } from '../systems/RhythmSpeller.js';
import { GROUND_Y } from './challengeConstants.js';
import { RhythmKeyboardInput } from '../systems/RhythmKeyboardInput.js';

// Rhythm constants (local to this mixin, mirroring ChallengeScene originals)
const RHYTHM_BPM = 100;
const RHYTHM_SUBDIVISIONS = {
    quarter:   { cells: ['1', '2', '3', '4'], downbeats: [0, 1, 2, 3], cellFraction: 1 },
    eighth:    { cells: ['1', '+', '2', '+', '3', '+', '4', '+'], downbeats: [0, 2, 4, 6], cellFraction: 0.5 },
    sixteenth: { cells: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'], downbeats: [0, 4, 8, 12], cellFraction: 0.25 },
    triplet:   { cells: ['1','p','l','2','p','l','3','p','l','4','p','l'], downbeats: [0, 3, 6, 9], cellFraction: 1/3 },
};

export const RhythmMixin = {

    _askRhythm() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        // Pick time signature and subdivision from level config or defaults
        let timeSig = '4/4';
        let subKey;

        if (this._storyLevel?.rhythm) {
            const lr = this._storyLevel.rhythm;
            const sigs = lr.timeSigs?.length ? lr.timeSigs : ['4/4'];
            timeSig = sigs[Math.floor(Math.random() * sigs.length)];
            subKey = pickSubdivision(timeSig, lr.subdivisions || ['quarter']);
        } else if (this.gradual) {
            const available = ['quarter'];
            if (this.session.round >= 10) available.push('eighth');
            if (this.session.round >= 20) available.push('sixteenth');
            if (this.session.round >= 30) available.push('triplet');
            subKey = available[Math.floor(Math.random() * available.length)];
            // Gradual time signature progression
            const availSigs = ['4/4'];
            if (this.session.round >= 5) availSigs.push('2/4', '3/4');
            if (this.session.round >= 15) availSigs.push('6/8');
            if (this.session.round >= 25) availSigs.push('9/8', '12/8');
            if (this.session.round >= 35) availSigs.push('3/8');
            if (subKey === 'triplet') {
                // Triplet subdivision only works in compound meters
                const compoundSigs = availSigs.filter(s => TIME_SIG_INFO[s]?.compound);
                timeSig = compoundSigs.length ? compoundSigs[Math.floor(Math.random() * compoundSigs.length)] : '12/8';
                subKey = 'eighth'; // compound eighth = triplet feel
            } else {
                timeSig = availSigs[Math.floor(Math.random() * availSigs.length)];
                subKey = pickSubdivision(timeSig, [subKey]);
            }
        } else {
            // Arcade custom mode: pick meter (beat count), then resolve to simple/compound
            const subs = this.customRhythmSubs;
            const meters = this.customMeters || ['4'];
            const METER_MAP = { '4': { simple: '4/4', compound: '12/8' }, '3': { simple: '3/4', compound: '9/8' }, '2': { simple: '2/4', compound: '6/8' }, '1': { simple: '1/4', compound: '3/8' } };
            const meter = METER_MAP[meters[Math.floor(Math.random() * meters.length)]] || METER_MAP['4'];
            subKey = subs[Math.floor(Math.random() * subs.length)];
            if (subKey === 'triplet') {
                timeSig = meter.compound;
                subKey = 'eighth';
            } else {
                timeSig = meter.simple;
                subKey = pickSubdivision(timeSig, [subKey]);
            }
        }

        // Build subdivision config from time sig + note value
        const tsInfo = TIME_SIG_INFO[timeSig];
        let sub = buildSubdivision(timeSig, subKey);
        if (!sub) {
            // Fallback to legacy 4/4 subdivisions
            sub = RHYTHM_SUBDIVISIONS[subKey] || RHYTHM_SUBDIVISIONS.quarter;
        }

        const cells = sub.cells.length;
        const cellMs = (60000 / RHYTHM_BPM) * sub.cellFraction;

        const pattern = new Array(cells).fill(false);
        const noteTarget = Math.max(2, Math.floor(cells * (0.3 + Math.random() * 0.4)));
        let noteCount = 0;
        for (let i = 0; i < cells; i++) {
            if (Math.random() < (sub.downbeats.includes(i) ? 0.75 : 0.4) && noteCount < noteTarget) {
                pattern[i] = true;
                noteCount++;
            }
        }
        pattern[0] = true;
        if (pattern.filter(v => v).length < 2) pattern[Math.floor(cells / 2)] = true;

        this._rhythmPattern = pattern;
        this._rhythmSub = sub;
        this._rhythmSubKey = subKey;
        this._rhythmTimeSig = timeSig;
        this._rhythmTimeSigInfo = tsInfo || null;
        this._rhythmCells = cells;
        this._rhythmCellMs = cellMs;
        this._userRhythm = new Array(cells).fill(0);
        this._nextRhythmGroupId = 1;
        this._rhythmPlaying = false;
        this._rhythmPlayTimer = null;

        this._buildRhythmUI(width, height);
        this._questionActive = true;
        this._rhythmStartTimer = this.time.delayedCall(400, () => this._startRhythmLoop());
    },

    _getNoteKey() {
        switch (this._rhythmSubKey) {
            case 'quarter': return 'note-quarter';
            case 'eighth':  return 'note-eighth';
            case 'sixteenth': return 'note-sixteenth';
            case 'triplet': return 'note-eighth';
            default: return 'note-quarter';
        }
    },

    _getRestKey() {
        switch (this._rhythmSubKey) {
            case 'quarter': return 'rest-quarter';
            case 'eighth':  return 'rest-eighth';
            case 'sixteenth': return 'rest-sixteenth';
            case 'triplet': return 'rest-eighth';
            default: return 'rest-quarter';
        }
    },

    _restKeyForTicks(ticks) {
        if (ticks <= 1) return 'rest-sixteenth';
        if (ticks <= 2) return 'rest-eighth';
        return 'rest-quarter';
    },

    _createSymbol(cx, cy, isNote, tint, maxH) {
        const key = isNote ? this._getNoteKey() : this._getRestKey();
        if (!this.textures.exists(key)) return null;
        const sprite = this.add.image(cx, cy, key).setDepth(6);
        const scale = maxH / sprite.height;
        sprite.setScale(scale);
        sprite.setTint(tint);
        return sprite;
    },

    _buildRhythmUI(width, height) {
        this._clearRhythmUI();

        const sub = this._rhythmSub;
        const cells = this._rhythmCells;
        const n = cells;

        const GAP = 4;
        const MARGIN = 60;
        const usable = width - MARGIN * 2;
        const cellW = (usable - GAP * (n - 1)) / n;
        const cellH = 60;
        const notationY = height * 0.22;
        const gridY = height * 0.40;
        const gridX = MARGIN;

        this._rCellW = cellW;
        this._rCellGap = GAP;
        this._rGridX = gridX;
        this._rGridY = gridY;
        this._rCellH = cellH;
        this._rNotationY = notationY;

        const gridVisible = this.showGrid;

        const title = this.add.text(width / 2, notationY - 70, 'LISTEN & MATCH THIS RHYTHM', {
            font: 'bold 14px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this.rhythmUI.push(title);

        const g = this.add.graphics().setDepth(4);
        if (gridVisible) {
            g.lineStyle(1, 0x999999, 0.6);
            sub.downbeats.forEach(di => {
                if (di === 0) return;
                const lx = gridX + di * (cellW + GAP) - GAP / 2;
                g.lineBetween(lx, gridY - 20, lx, gridY + cellH + 10);
            });
        }
        this.rhythmUI.push(g);

        this._rhythmCursor = this.add.rectangle(
            gridX + cellW / 2, gridY + cellH / 2, cellW, cellH + 4, 0xffffff, 0
        ).setDepth(4).setVisible(false);
        this.rhythmUI.push(this._rhythmCursor);

        this._rhythmCellRects = [];
        this._rhythmCellLabels = [];
        this._rhythmCellCenters = [];

        for (let i = 0; i < n; i++) {
            const cx = gridX + i * (cellW + GAP) + cellW / 2;
            const cy = gridY + cellH / 2;
            const isDB = sub.downbeats.includes(i);

            const bg = this.add.rectangle(cx, cy, cellW, cellH, 0xffffff)
                .setStrokeStyle(1, 0xbbbbbb).setDepth(5);
            if (gridVisible) {
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerdown', () => this._onRhythmCellDown(i));
                bg.on('pointerover', () => { if (this._questionActive) bg.setStrokeStyle(2, 0x4488cc); });
                bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xbbbbbb));
            } else {
                bg.setVisible(false);
            }

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 16px monospace' : '13px monospace',
                fill: isDB ? '#222222' : '#888888'
            }).setOrigin(0.5).setDepth(6);
            if (!gridVisible) lbl.setVisible(false);

            this._rhythmCellRects.push(bg);
            this._rhythmCellLabels.push(lbl);
            this._rhythmCellCenters.push({ x: cx, y: cy });
            this.rhythmUI.push(bg, lbl);
        }

        this._setupRhythmKeyboard(n, gridX, gridY, cellW, cellH);

        const btnY = gridY + cellH + 70;
        this._rhythmPlayBtn = this._makeBtn(width / 2 - 90, btnY, '▶ STOP', '#142030', '#224455',
            () => this._toggleRhythmPlayback()).setDepth(5);
        const submitBtn = this._makeBtn(width / 2 + 90, btnY, 'SUBMIT', '#113322', '#225533',
            () => this._submitRhythm()).setDepth(5);
        this.rhythmUI.push(this._rhythmPlayBtn, submitBtn);

        this._renderRhythmNotation();
    },

    _setupRhythmKeyboard(n, gridX, gridY, cellW, cellH) {
        const { width } = this.cameras.main;
        const ticksPerCell = { quarter: 4, eighth: 2, sixteenth: 1, triplet: 1 }[this._rhythmSubKey];

        this._rhythmKeyboard = new RhythmKeyboardInput(this, {
            cells: n,
            ticksPerCell,
            subdivision: this._rhythmSubKey,
            onSubmit: () => this._submitRhythm(),
            onUpdate: (grid) => {
                if (!this._questionActive) return;
                for (let i = 0; i < grid.length; i++) {
                    this._userRhythm[i] = grid[i];
                }
                this._nextRhythmGroupId = this._rhythmKeyboard._nextGroupId;
                this._refreshRhythmVisuals();
                this._renderRhythmNotation();
            },
        });
        this._rhythmKeyboard.enable();

        const hints = this.add.text(width / 2, gridY + cellH + 14,
            '3-7: duration   A-G: note   0: rest   T: tie   .: dot   ←→: move   ⌫: undo   Enter: submit', {
                font: '10px monospace', fill: '#687880'
            }).setOrigin(0.5).setDepth(5);
        this.rhythmUI.push(hints);
    },

    _onRhythmCellDown(idx) {
        if (!this._questionActive) return;

        if (this._userRhythm[idx] > 0) {
            const groupId = this._userRhythm[idx];
            for (let i = idx; i < this._userRhythm.length; i++) {
                if (this._userRhythm[i] === groupId) {
                    this._userRhythm[i] = 0;
                } else {
                    break;
                }
            }
            this._rhythmDragging = false;
            this._refreshRhythmVisuals();
            this._renderRhythmNotation();
            if (this._rhythmKeyboard) this._rhythmKeyboard.syncFromGrid(this._userRhythm);
            return;
        } else {
            const gid = this._nextRhythmGroupId++;
            this._userRhythm[idx] = gid;
            this._rhythmDragging = true;
            this._rhythmDragGroupId = gid;
            this._rhythmDragStart = idx;
            this._rhythmDragEnd = idx;
        }
        this._refreshRhythmVisuals();
        this._renderRhythmNotation();
    },

    _getRhythmCellIndexAtPointer(ptr) {
        if (!this._rhythmCellCenters || this._rhythmCellCenters.length === 0) return -1;
        const n = this._userRhythm.length;
        for (let i = 0; i < n; i++) {
            const cx = this._rhythmCellCenters[i].x;
            const hw = this._rCellW / 2 + 2;
            if (ptr.x >= cx - hw && ptr.x <= cx + hw &&
                ptr.y >= this._rGridY - 10 && ptr.y <= this._rGridY + this._rCellH + 10) {
                return i;
            }
        }
        return -1;
    },

    _onRhythmDragMove(ptr) {
        if (!this._questionActive || !this._rhythmDragging || !ptr.isDown) return;
        const idx = this._getRhythmCellIndexAtPointer(ptr);
        if (idx < 0 || idx <= this._rhythmDragStart) return;
        if (idx === this._rhythmDragEnd) return;

        for (let i = this._rhythmDragStart; i <= idx; i++) {
            this._userRhythm[i] = this._rhythmDragGroupId;
        }
        this._rhythmDragEnd = idx;
        this._refreshRhythmVisuals();
        this._renderRhythmNotation();
    },

    _onRhythmDragEnd() {
        this._rhythmDragging = false;
        if (this._rhythmKeyboard) this._rhythmKeyboard.syncFromGrid(this._userRhythm);
    },

    _refreshRhythmVisuals() {
        if (!this.showGrid) return;
        const n = this._rhythmCells;
        for (let i = 0; i < n; i++) {
            const gid = this._userRhythm[i];
            const isNote = gid > 0;
            const isGroupStart = isNote && (i === 0 || this._userRhythm[i - 1] !== gid);

            this._rhythmCellRects[i].setFillStyle(isNote ? 0xe0e0e0 : 0xffffff);

            const lbl = this._rhythmCellLabels[i];
            if (lbl) {
                if (isNote && !isGroupStart) {
                    lbl.setStyle({ fill: '#555555' });
                } else if (isNote) {
                    lbl.setStyle({ fill: '#222222' });
                } else {
                    lbl.setStyle({ fill: '#aaaaaa' });
                }
            }
        }

        if (this._rhythmSustainGfx) {
            this._rhythmSustainGfx.clear();
        } else {
            this._rhythmSustainGfx = this.add.graphics().setDepth(7);
            this.rhythmUI.push(this._rhythmSustainGfx);
        }

        const sg = this._rhythmSustainGfx;
        const visited = new Set();
        for (let i = 0; i < n; i++) {
            const gid = this._userRhythm[i];
            if (gid === 0 || visited.has(gid)) continue;
            visited.add(gid);

            let end = i;
            while (end + 1 < n && this._userRhythm[end + 1] === gid) end++;

            if (end > i) {
                const startX = this._rhythmCellCenters[i].x;
                const endX = this._rhythmCellCenters[end].x;
                const barY = this._rhythmCellCenters[i].y + this._rCellH * 0.3;
                sg.lineStyle(3, 0x44aa66, 0.8);
                sg.lineBetween(startX, barY, endX, barY);
                for (let j = i + 1; j <= end; j++) {
                    sg.fillStyle(0x44aa66, 0.7);
                    sg.fillCircle(this._rhythmCellCenters[j].x, barY, 3);
                }
            }
        }
    },

    _renderRhythmNotation() {
        try {
            const { width } = this.cameras.main;
            // Augment time sig info with actual ticksPerCell from subdivision
            const baseTsInfo = this._rhythmTimeSigInfo || null;
            const tsInfo = baseTsInfo && this._rhythmSub
                ? { ...baseTsInfo, ticksPerCell: this._rhythmSub.ticksPerCell }
                : baseTsInfo;
            let spelled = spellPattern(this._userRhythm, this._rhythmSubKey, tsInfo);
            const cursorTick = this._rhythmKeyboard ? this._rhythmKeyboard._cursorTick : -1;
            const selectedTicks = this._rhythmKeyboard ? this._rhythmKeyboard.effectiveTicks : -1;
            if (cursorTick >= 0 && selectedTicks > 0) {
                spelled = splitRestsAtCursor(spelled, cursorTick, selectedTicks, this._rhythmSubKey, tsInfo);
            }
            const notationY = this._rNotationY || (this._rGridY - 108);
            this.rhythmNotationRenderer.render(spelled, this._rhythmSubKey, width / 2, notationY, width - 100, cursorTick, tsInfo);
        } catch (err) {
            console.error('_renderRhythmNotation error:', err);
        }
    },

    _toggleRhythmPlayback() {
        if (this._rhythmPlaying) {
            this._stopRhythmPlayback();
        } else {
            this._startRhythmLoop();
        }
    },

    _startRhythmLoop() {
        if (this._rhythmPlaying) return;
        this._rhythmPlaying = true;
        if (this._rhythmPlayBtn) this._rhythmPlayBtn.setText('■ STOP');
        this._playRhythmOnce();
    },

    _playRhythmOnce() {
        if (!this._rhythmPlaying) return;

        const pattern = this._rhythmPattern;
        const sub = this._rhythmSub;
        const cells = this._rhythmCells;
        const cellMs = this._rhythmCellMs;

        let i = 0;
        const tick = () => {
            if (!this._rhythmPlaying || !this._rhythmCursor) return;

            const cx = this._rGridX + i * (this._rCellW + this._rCellGap) + this._rCellW / 2;
            const cy = this._rGridY + this._rCellH / 2;
            this._rhythmCursor.setPosition(cx, cy).setVisible(this.showGrid).setAlpha(0.15);

            if (sub.downbeats.includes(i)) {
                this.audioEngine.playClick(i === 0);
            }

            if (pattern[i]) {
                this.audioEngine.playDrumNote();
            }

            i++;
            if (i < cells) {
                this._rhythmPlayTimer = this.time.delayedCall(cellMs, tick);
            } else {
                this._rhythmPlayTimer = this.time.delayedCall(cellMs, () => {
                    if (this._rhythmCursor) this._rhythmCursor.setVisible(false);
                    if (!this._rhythmPlaying) return;
                    this._playRhythmCountIn(() => this._playRhythmOnce());
                });
            }
        };

        tick();
    },

    _playRhythmCountIn(onComplete) {
        if (!this._rhythmPlaying) return;

        // Count-in matches the time signature's felt beats
        const tsInfo = this._rhythmTimeSigInfo || TIME_SIG_INFO['4/4'];
        const nBeats = tsInfo.beats; // e.g. 4 for 4/4, 2 for 6/8, 3 for 3/4
        const sub = this._rhythmSub;
        // Beat duration = cells per beat × cell duration
        const cellsPerBeat = sub.downbeats.length > 1
            ? sub.downbeats[1] - sub.downbeats[0]
            : sub.cells.length;
        const beatDuration = cellsPerBeat * this._rhythmCellMs;

        let b = 0;
        const tick = () => {
            if (!this._rhythmPlaying) return;
            this.audioEngine.playClick(b === 0);
            b++;
            if (b < nBeats) {
                this._rhythmPlayTimer = this.time.delayedCall(beatDuration, tick);
            } else {
                this._rhythmPlayTimer = this.time.delayedCall(beatDuration, () => {
                    if (this._rhythmPlaying && onComplete) onComplete();
                });
            }
        };

        tick();
    },

    _stopRhythmPlayback() {
        this._rhythmPlaying = false;
        if (this._rhythmPlayTimer) {
            this._rhythmPlayTimer.remove(false);
            this._rhythmPlayTimer = null;
        }
        if (this._rhythmCursor && this._rhythmCursor.active) this._rhythmCursor.setVisible(false);
        if (this._rhythmPlayBtn && this._rhythmPlayBtn.active) this._rhythmPlayBtn.setText('▶ PLAY');
    },

    _submitRhythm() {
        if (!this._questionActive) return;
        this._questionActive = false;
        this._stopRhythmPlayback();

        const { _rhythmPattern: pattern, _userRhythm: userGrid } = this;
        const n = pattern.length;
        const noteCount = pattern.filter(Boolean).length;

        // Hits: user has ANY note (onset or sustained) where pattern has a note
        let hits = 0;
        for (let i = 0; i < n; i++) {
            if (pattern[i] && userGrid[i] > 0) hits++;
        }

        // Extra onsets: user starts a NEW note group at a rest position
        // (sustain through rests is forgiven, but new onsets at rests penalize)
        let extraOnsets = 0;
        for (let i = 0; i < n; i++) {
            if (!pattern[i] && userGrid[i] > 0) {
                const isOnset = (i === 0 || userGrid[i - 1] !== userGrid[i]);
                if (isOnset) extraOnsets++;
            }
        }

        const score = Math.max(0, hits - extraOnsets);
        const accuracy = score / Math.max(1, noteCount);
        const correct = accuracy >= 0.80;
        const pct = Math.round(accuracy * 100);

        const perfect = pct === 100;

        if (correct) {
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
                this.session.correctAnswers = (this.session.correctAnswers || 0) + 1;
                this._entityMeter = 100;
                this._updateHpBars();
                this._spawnFloatingHeart();
                this._showFlash('#50d0b0');
                this._storyEntityDone = true;
                this._addToRescuedPreview(
                    this._entityData?.spriteKey || `villager-${this._entityKey}`,
                    this._entityData?.name || 'Friend'
                );
            }
        } else {
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
            }
            const noDamage = this.practiceMode || (this.storyBattle && (this.storyLevelId || 1) < 3);
            if (!noDamage) {
                if (this._applyWrongDamage()) {
                    this._clearRhythmUI();
                    return;
                }
            }
        }

        // Correct: auto-advance after brief feedback
        if (correct) {
            this._clearRhythmUI();
            this.messageText.setText(`${pct}% — ${perfect ? 'Perfect!' : 'Correct!'}`);
            this._showFlash('#50d0b0');
            if (this.storyBattle) {
                this.audioEngine.playCorrect();
                this.time.delayedCall(500, () => this._animalFlyOff('happy'));
            } else if (this.practiceMode) {
                this.audioEngine.playCorrect();
                this.time.delayedCall(600, () => this._askQuestion());
            } else {
                // Arcade: _handleAnswer plays the sound
                this.time.delayedCall(600, () => this._handleAnswer(true, `${pct}% correct!`));
            }
            this._updateHud();
            return;
        }

        // Wrong: show compare review with Play Mine / Play Answer / Next Question
        const onContinue = () => {
            this._clearRhythmUI();
            if (this.storyBattle) {
                this.time.delayedCall(300, () => this._animalFlyOff('sad'));
            } else if (this.practiceMode) {
                this.time.delayedCall(300, () => this._askQuestion());
            } else {
                this._handleAnswer(false, `${pct}%`);
            }
        };
        this._showRhythmCompareUI(pct, {
            correct: false,
            onContinue,
            userPattern: this._userRhythm.map(v => v > 0),
            answerPattern: this._rhythmPattern,
            sub: this._rhythmSub,
            cellMs: this._rhythmCellMs,
            onCleanup: () => this._stopRhythmPlayback(),
            colorCells: () => {
                if (!this.showGrid) return;
                const pattern = this._rhythmPattern;
                for (let i = 0; i < this._rhythmCells; i++) {
                    if (!this._rhythmCellRects[i]) continue;
                    const patNote = pattern[i];
                    const userNote = this._userRhythm[i] > 0;
                    let match;
                    if (patNote) {
                        match = userNote;
                    } else {
                        const isOnset = userNote && (i === 0 || this._userRhythm[i - 1] !== this._userRhythm[i]);
                        match = !isOnset;
                    }
                    this._rhythmCellRects[i].setFillStyle(match ? 0xbbeecc : 0xffcccc);
                }
            },
        });
        this._updateHud();
    },

    /** Apply wrong-answer damage. Returns true if player died. */
    _applyWrongDamage() {
        const dmg = Math.max(1, this._entityAttack - (this.playerStats.defense || 0) + Math.floor(Math.random() * 4));
        this.playerStats.hp = Math.max(0, this.playerStats.hp - dmg);
        this._showWrongDamage(dmg);
        this._updateHpBars();
        this._updateHud();

        if (this.playerStats.hp <= 0) {
            this._gameOverFlag = true;
            if (this.storyBattle) {
                this._onStoryPlayerDefeated();
            } else {
                this.time.delayedCall(600, () => this._gameOver());
            }
            return true;
        }
        return false;
    },


    /**
     * Story mode: show compare UI after wrong rhythm transcription.
     * Lets player hear their rhythm vs the answer before animal flees.
     */
    /**
     * Unified compare UI for both rhythm transcription and rhythm reading.
     * Shows Play Mine / Play Answer / Next Question buttons.
     * @param {number} pct - accuracy percentage
     * @param {object} opts
     * @param {boolean} opts.correct - whether the answer was correct
     * @param {function} opts.onContinue - called when user presses Next Question
     * @param {boolean[]} opts.userPattern - user's rhythm as boolean array
     * @param {boolean[]} opts.answerPattern - correct rhythm as boolean array
     * @param {object} opts.sub - subdivision info (has .downbeats)
     * @param {number} opts.cellMs - milliseconds per cell
     * @param {function} [opts.colorCells] - optional callback to color grid cells
     * @param {function} [opts.onCleanup] - extra cleanup on continue (e.g. stop playback)
     */
    _showRhythmCompareUI(pct, opts = {}) {
        const { correct = false, onContinue, userPattern, answerPattern, sub, cellMs, colorCells, onCleanup } = opts;

        if (!correct) {
            this.audioEngine.playWrong();
            this.session.streak = 0;
            this._showFlash('#e08868');
        }
        this._cancelEscapeTimer();

        if (colorCells) colorCells();

        const label = correct ? `${pct}% — Correct! Review:` : `${pct}% — Compare and listen:`;
        this.messageText.setText(label);

        const { width, height } = this.cameras.main;
        const btnY = height * 0.88;
        const btnStyle = { fontSize: '20px', fill: '#ffffff', backgroundColor: '#335566',
                           padding: { x: 16, y: 8 }, align: 'center' };

        const playMineBtn = this.add.text(width * 0.25, btnY, 'Play Mine', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        const playAnswerBtn = this.add.text(width * 0.5, btnY, 'Play Answer', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        const continueBtn = this.add.text(width * 0.75, btnY, 'Next Question', btnStyle)
            .setOrigin(0.5).setInteractive({ useHandCursor: true });

        this._compareUI = [playMineBtn, playAnswerBtn, continueBtn];

        const self = this;
        const playPattern = (pat) => {
            if (onCleanup) onCleanup();
            if (self._comparePlayTimer) { self._comparePlayTimer.remove(false); self._comparePlayTimer = null; }
            let i = 0;
            const tick = () => {
                if (sub?.downbeats?.includes(i)) self.audioEngine.playClick(i === 0);
                if (pat[i]) self.audioEngine.playDrumNote();
                i++;
                if (i < pat.length) {
                    self._comparePlayTimer = self.time.delayedCall(cellMs, tick);
                }
            };
            tick();
        };

        playMineBtn.on('pointerdown', () => playPattern(userPattern));
        playAnswerBtn.on('pointerdown', () => playPattern(answerPattern));

        continueBtn.on('pointerdown', () => {
            if (onCleanup) onCleanup();
            if (this._comparePlayTimer) { this._comparePlayTimer.remove(false); this._comparePlayTimer = null; }
            this._clearCompareUI();
            if (onContinue) onContinue();
        });
    },

    _clearCompareUI() {
        if (this._compareUI) {
            this._compareUI.forEach(o => o.destroy());
            this._compareUI = [];
        }
        if (this._comparePlayTimer) {
            this._comparePlayTimer.remove(false);
            this._comparePlayTimer = null;
        }
    },

    _clearRhythmUI() {
        if (this._rhythmStartTimer) { this._rhythmStartTimer.remove(false); this._rhythmStartTimer = null; }
        this._stopRhythmPlayback();
        if (this._rhythmKeyboard) {
            this._rhythmKeyboard.disable();
            this._rhythmKeyboard = null;
        }
        this.rhythmUI.forEach(o => o.destroy());
        this.rhythmUI = [];
        this._rhythmCellRects = [];
        this._rhythmCellLabels = [];
        this._rhythmCellCenters = [];
        this._rhythmCursor = null;
        this._rhythmPlayBtn = null;
        this._rhythmSustainGfx = null;
        this._rhythmDragging = false;
        this.rhythmNotationRenderer.clear();
    },
};
