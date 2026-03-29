// RhythmReadingMixin: All rhythm-reading (sight-tap) methods extracted from ChallengeScene.
// These are mixed into ChallengeScene.prototype so `this` refers to the scene instance.

import { TIME_SIG_INFO, buildSubdivision, pickSubdivision } from '../data/levels.js';
import { spellPattern } from '../systems/RhythmSpeller.js';
import { GROUND_Y } from './challengeConstants.js';

// Local copy of RHYTHM_SUBDIVISIONS (fallback when buildSubdivision returns null)
const RHYTHM_SUBDIVISIONS = {
    quarter:   { cells: ['1', '2', '3', '4'], downbeats: [0, 1, 2, 3], cellFraction: 1 },
    eighth:    { cells: ['1', '+', '2', '+', '3', '+', '4', '+'], downbeats: [0, 2, 4, 6], cellFraction: 0.5 },
    sixteenth: { cells: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'], downbeats: [0, 4, 8, 12], cellFraction: 0.25 },
    triplet:   { cells: ['1','p','l','2','p','l','3','p','l','4','p','l'], downbeats: [0, 3, 6, 9], cellFraction: 1/3 },
};

export const RhythmReadingMixin = {

    _askRhythmReading() {
        try { return this._askRhythmReadingInner(); } catch (err) {
            console.error('_askRhythmReading error:', err);
            // Recover: skip to next question
            this._clearRhythmReadingUI();
            this.time.delayedCall(300, () => this._askQuestion());
        }
    },

    _askRhythmReadingInner() {
        this._clearRhythmReadingUI();
        this._stopRhythmPlayback();

        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        this._rrBpm       = 72 + Math.floor(Math.random() * 61);
        this._rrQuarterMs = 60000 / this._rrBpm;

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
                const compoundSigs = availSigs.filter(s => TIME_SIG_INFO[s]?.compound);
                timeSig = compoundSigs.length ? compoundSigs[Math.floor(Math.random() * compoundSigs.length)] : '12/8';
                subKey = 'eighth';
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

        const tsInfo = TIME_SIG_INFO[timeSig];
        let sub = buildSubdivision(timeSig, subKey);
        if (!sub) {
            sub = RHYTHM_SUBDIVISIONS[subKey] || RHYTHM_SUBDIVISIONS.quarter;
        }
        const n      = sub.cells.length;
        const cellMs = this._rrQuarterMs * sub.cellFraction;

        this._rrSubKey  = subKey;
        this._rrSub     = sub;
        this._rrTimeSig = timeSig;
        this._rrTimeSigInfo = tsInfo || null;
        this._rrCells   = n;
        this._rrCellMs  = cellMs;

        // Generate pattern, avoid repeating the exact same rhythm
        let pattern, attempts = 0;
        do {
            const restFrac   = 0.05 + Math.random() * 0.50;
            pattern    = new Array(n).fill(true);
            const restTarget = Math.floor(n * restFrac);
            for (let r = 0; r < restTarget; r++) {
                const candidates = pattern
                    .map((v, i) => (v && i > 0) ? i : -1)
                    .filter(i => i >= 0);
                if (!candidates.length) break;
                pattern[candidates[Math.floor(Math.random() * candidates.length)]] = false;
            }
            attempts++;
        } while (this._lastRrPattern && pattern.join() === this._lastRrPattern.join() && attempts < 5);
        this._lastRrPattern = pattern;

        // Build groupGrid: each onset starts a new group, non-onset cells
        // sustain the previous note so notation shows ties instead of rests.
        let gid = 0;
        const groupGrid = pattern.map((v) => {
            if (v) gid++;
            return gid;   // non-onset cells inherit previous group (sustain)
        });

        this._rrPattern    = pattern;
        this._rrGroupGrid  = groupGrid;
        this._rrOnsetCells = pattern.reduce((a, v, i) => { if (v) a.push(i); return a; }, []);
        this._rrTaps       = [];
        this._rrBarStart   = null;
        this._rrState      = 'idle';
        this._rrLastTap    = null;
        this._rrTimers     = [];
        this._rrUI         = [];
        this._rrCellRects  = [];
        this._rrCellLabels = [];

        // Augment time sig info with actual ticksPerCell from subdivision
        const tsInfoAug = tsInfo && sub ? { ...tsInfo, ticksPerCell: sub.ticksPerCell } : tsInfo;
        let spelled = [];
        try {
            spelled = spellPattern(groupGrid, subKey, tsInfoAug);
            // Show counting labels in practice/story mode or if enabled in settings
            const showCounting = this.practiceMode || this.storyBattle || this._showCounting || false;
            const countOpts = showCounting && sub ? {
                showCounting: true,
                cellLabels: sub.cells,
                ticksPerCell: sub.ticksPerCell || 1,
            } : {};
            this.rhythmNotationRenderer.render(spelled, subKey, width / 2, height * 0.22, width - 80, -1, tsInfoAug, countOpts);
        } catch (err) {
            console.error('RhythmReading notation error:', err);
        }

        const title = this.add.text(width / 2, height * 0.22 - 68, 'SIGHT-TAP THIS RHYTHM', {
            font: 'bold 14px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(title);

        const bpmLabel = tsInfo?.compound ? `\u2669.= ${this._rrBpm}` : `\u2669= ${this._rrBpm}`;
        const bpmTxt = this.add.text(width / 2, height * 0.22 + 65, bpmLabel, {
            font: '12px monospace', fill: '#687880', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(bpmTxt);

        this._buildRrGrid(width, height);

        const hint = this.add.text(width / 2, height * 0.40 + 42 + 14,
            'SPACE or MIDI: tap on every note onset', {
            font: '11px monospace', fill: '#687880'
        }).setOrigin(0.5).setDepth(5);
        this._rrUI.push(hint);

        this._rrKeyHandler = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (e.repeat) return; // ignore key repeat from holding down
                if (this._rrReadyBtn) { this._startWhenReady(); return; }
                this._onRrTap();
            }
        };
        document.addEventListener('keydown', this._rrKeyHandler);

        this._questionActive = true;

        // Pause escape timer during entire rhythm reading sequence
        if (this._escapeTimer) this._escapeTimer.paused = true;

        // Story/practice: show READY button so user can study the rhythm first
        // Arcade (non-practice): auto-start after brief delay
        if (this.storyBattle || this.practiceMode) {
            const readyBtn = this.add.text(width / 2, height * 0.58, 'READY', {
                font: 'bold 20px monospace', fill: '#0c1420',
                backgroundColor: '#50d0b0', padding: { x: 24, y: 10 },
            }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
            readyBtn.on('pointerover', () => readyBtn.setStyle({ backgroundColor: '#68e0c0' }));
            readyBtn.on('pointerout', () => readyBtn.setStyle({ backgroundColor: '#50d0b0' }));
            readyBtn.on('pointerdown', () => this._startWhenReady());
            this._rrReadyBtn = readyBtn;
            this._rrUI.push(readyBtn);

            this.messageText.setText('Study the rhythm, then press READY');
        } else {
            this._rrReadyBtn = null;
            this._rrSchedule(() => this._startRrRound(), 1200);
        }
    },

    _startWhenReady() {
        if (this._rrReadyBtn) {
            this._rrReadyBtn.destroy();
            this._rrReadyBtn = null;
        }
        this.messageText.setText('');
        this._rrSchedule(() => this._startRrRound(), 400);
    },

    _buildRrGrid(width, height) {
        const sub    = this._rrSub;
        const n      = this._rrCells;
        const GAP    = 3, MARGIN = 40;
        const cellW  = (width - MARGIN * 2 - GAP * (n - 1)) / n;
        const cellH  = 42;
        const gridY  = height * 0.40;
        const gridX  = MARGIN;

        this._rrCellW = cellW;
        this._rrCellH = cellH;

        const g = this.add.graphics().setDepth(4).setVisible(false);
        g.lineStyle(1, 0x999999, 0.6);
        sub.downbeats.forEach(di => {
            if (!di) return;
            const lx = gridX + di * (cellW + GAP) - GAP / 2;
            g.lineBetween(lx, gridY - 2, lx, gridY + cellH + 2);
        });
        this._rrUI.push(g);

        for (let i = 0; i < n; i++) {
            const cx    = gridX + i * (cellW + GAP) + cellW / 2;
            const cy    = gridY + cellH / 2;
            const isDB  = sub.downbeats.includes(i);
            const isNote = this._rrPattern[i];

            const bg = this.add.rectangle(cx, cy, cellW, cellH,
                isNote ? 0xe8e8e8 : 0xffffff)
                .setStrokeStyle(1, isNote ? 0x999999 : 0xcccccc)
                .setDepth(5).setVisible(false);

            const lbl = this.add.text(cx, cy, sub.cells[i], {
                font: isDB ? 'bold 14px monospace' : '11px monospace',
                fill: isNote ? '#222222' : '#aaaaaa'
            }).setOrigin(0.5).setDepth(6).setVisible(false);

            this._rrCellRects.push(bg);
            this._rrCellLabels.push(lbl);
            this._rrUI.push(bg, lbl);
        }
    },

    _startRrRound() {
        if (this._rrState !== 'idle' || this._gameOverFlag) return;
        this._rrState = 'countdown';
        this._rrTaps  = [];

        const sub    = this._rrSub;
        const cellMs = this._rrCellMs;
        const n      = this._rrCells;

        // Count-in matches time signature's felt beats
        const tsInfo = this._rrTimeSigInfo || TIME_SIG_INFO['4/4'];
        const COUNT_IN = tsInfo.beats; // e.g. 4 for 4/4, 2 for 6/8, 3 for 3/4
        const cellsPerBeat = sub.downbeats.length > 1
            ? sub.downbeats[1] - sub.downbeats[0]
            : sub.cells.length;
        const beatMs = cellsPerBeat * cellMs;

        for (let b = 0; b < COUNT_IN; b++) {
            this._rrSchedule(() => {
                this.messageText.setText(b < COUNT_IN - 1 ? `${b + 1}...` : `${b + 1}!`)
                    .setStyle({ fill: '#e8d098', fontSize: '36px' });
                this.audioEngine.playClick(b === 0);
            }, b * beatMs);
        }

        this._rrSchedule(() => {
            this._rrState    = 'recording';
            this._rrBarStart = performance.now();
            this.messageText.setText('TAP!').setStyle({ fill: '#50d0b0', fontSize: '36px' });

            sub.downbeats.forEach(di => {
                this._rrSchedule(() => {
                    if (this._rrState !== 'recording') return;
                    this.audioEngine.playClick(di === 0);
                }, di * cellMs);
            });

            this._rrSchedule(() => {
                if (this._rrState === 'recording') this._evaluateRhythmReading();
            }, n * cellMs + 200);

        }, COUNT_IN * beatMs);
    },

    _onRrTap() {
        if (this._rrState !== 'recording') return;
        const now = performance.now();
        if (this._rrLastTap && now - this._rrLastTap < 80) return;
        this._rrLastTap = now;

        const t = now - this._rrBarStart;
        this._rrTaps.push(t);
    },

    _evaluateRhythmReading() {
        this._rrState = 'feedback';
        this._rrStopAll();
        this._questionActive = false;
        this._cancelEscapeTimer();
        // Restore normal font size after count-in
        this.messageText.setStyle({ fontSize: '16px' });

        const cellMs   = this._rrCellMs;
        const tol      = Math.max(140, Math.min(350, cellMs * 0.55));
        const latency  = this.tapLatencyMs || 0;
        const adjusted = this._rrTaps.map(t => t - latency);
        const expected = this._rrOnsetCells.map(i => i * cellMs);

        // DP optimal matching: find maximum onset-tap matches in order
        const nExp = expected.length;
        const nTap = adjusted.length;
        const dp = Array.from({ length: nExp + 1 }, () => new Array(nTap + 1).fill(0));
        const dpMatch = Array.from({ length: nExp + 1 }, () => new Array(nTap + 1).fill(false));

        for (let e = 1; e <= nExp; e++) {
            for (let t = 1; t <= nTap; t++) {
                dp[e][t] = Math.max(dp[e][t - 1], dp[e - 1][t]);
                dpMatch[e][t] = false;
                const dist = Math.abs(adjusted[t - 1] - expected[e - 1]);
                if (dist < tol && dp[e - 1][t - 1] + 1 > dp[e][t]) {
                    dp[e][t] = dp[e - 1][t - 1] + 1;
                    dpMatch[e][t] = true;
                }
            }
        }

        // Backtrack to find which taps/onsets matched
        const usedTaps = new Set();
        const hitOnsets = new Set();
        let ei = nExp, ti = nTap;
        while (ei > 0 && ti > 0) {
            if (dpMatch[ei][ti]) {
                usedTaps.add(ti - 1);
                hitOnsets.add(ei - 1);
                ei--; ti--;
            } else if (dp[ei][ti - 1] >= dp[ei - 1][ti]) {
                ti--;
            } else {
                ei--;
            }
        }
        const results = expected.map((_, i) => ({ hit: hitOnsets.has(i) }));

        const hits      = results.filter(r => r.hit).length;
        const total     = expected.length;
        const extraTaps = this._rrTaps.length - usedTaps.size;
        const accuracy  = hits / Math.max(1, total);
        const pct       = Math.round(accuracy * 100);

        this._rrCellRects.forEach(r => r?.setVisible(true));
        this._rrCellLabels.forEach(l => l?.setVisible(true));

        for (let i = 0; i < this._rrCells; i++) {
            const isNote = this._rrPattern[i];
            this._rrCellRects[i]?.setFillStyle(isNote ? 0xdddddd : 0xf0f0f0)
                .setStrokeStyle(1, isNote ? 0x999999 : 0xcccccc);
            if (this._rrCellLabels[i]) {
                this._rrCellLabels[i].setStyle({
                    fill: isNote ? '#555555' : '#aaaaaa'
                });
            }
        }

        results.forEach((res, ei) => {
            const cell = this._rrOnsetCells[ei];
            if (res.hit) {
                this._rrCellRects[cell]?.setFillStyle(0xd4f5d4).setStrokeStyle(2, 0x44aa66);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#226633' });
            } else {
                this._rrCellRects[cell]?.setFillStyle(0xffe0cc).setStrokeStyle(2, 0xff8800);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#cc5500' });
            }
        });

        this._rrTaps.forEach((tap, ti) => {
            if (!usedTaps.has(ti)) {
                const cell = Math.min(this._rrCells - 1, Math.max(0, Math.floor((tap - latency) / cellMs)));
                this._rrCellRects[cell]?.setFillStyle(0xffcccc).setStrokeStyle(2, 0xdd3333);
                if (this._rrCellLabels[cell]) this._rrCellLabels[cell].setStyle({ fill: '#cc2222' });
            }
        });

        const passed   = accuracy >= 0.80 && extraTaps <= Math.max(1, Math.floor(total * 0.3));
        const extraStr = extraTaps > 0 ? `  +${extraTaps} extra` : '';
        const msg      = `${pct}%  ${hits}/${total}${extraStr}`;

        // Apply effects based on result
        if (passed) {
            this.audioEngine.playCorrect();
            this.session.streak++;
            this._showFlash('#50d0b0');
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
                this.session.correctAnswers = (this.session.correctAnswers || 0) + 1;
                const gain = Math.ceil(100 / 3); // 3 correct rhythms to rescue
                this._entityMeter = Math.min(100, (this._entityMeter || 0) + gain);
                this._updateHpBars();
                this._spawnFloatingHeart();
                if (this._entityMeter >= 100) {
                    this._storyEntityDone = true;
                    this._addToRescuedPreview(
                        this._entityData?.spriteKey || `villager-${this._entityKey}`,
                        this._entityData?.name || 'Friend'
                    );
                }
            }
        } else {
            if (this.storyBattle) {
                this.session.totalAnswers = (this.session.totalAnswers || 0) + 1;
            }
            const noDamage = this.practiceMode || (this.storyBattle && (this.storyLevelId || 1) < 3);
            if (!noDamage) {
                if (this._applyWrongDamage()) {
                    this._clearRhythmReadingUI();
                    return;
                }
            }
        }

        // Always show review for rhythm reading
        const onContinue = () => {
            this._clearRhythmReadingUI();
            if (this.storyBattle) {
                if (this._entityMeter >= 100) {
                    this.time.delayedCall(300, () => this._animalFlyOff('happy'));
                } else {
                    // Not done yet — ask another rhythm
                    this.time.delayedCall(300, () => this._askQuestion());
                }
            } else if (this.practiceMode) {
                this.time.delayedCall(300, () => this._askQuestion());
            } else {
                this._handleAnswer(passed, msg);
            }
        };
        // Reconstruct user taps as cell pattern for compare playback
        const userTapPattern = new Array(this._rrCells).fill(false);
        this._rrTaps.forEach(t => {
            const cell = Math.round((t - latency) / cellMs);
            if (cell >= 0 && cell < userTapPattern.length) userTapPattern[cell] = true;
        });

        this._showRhythmCompareUI(pct, {
            correct: passed,
            onContinue,
            userPattern: userTapPattern,
            answerPattern: this._rrPattern,
            sub: this._rrSub,
            cellMs,
        });
        this._updateHud();
    },

    _clearRhythmReadingUI() {
        this._cancelEscapeTimer();
        if (this._rrKeyHandler) {
            document.removeEventListener('keydown', this._rrKeyHandler);
            this._rrKeyHandler = null;
        }
        this._rrStopAll();
        if (this._rrUI) {
            this._rrUI.forEach(o => o?.destroy());
            this._rrUI = [];
        }
        this._rrCellRects  = [];
        this._rrCellLabels = [];
        this._rrState      = 'idle';
        this.rhythmNotationRenderer.clear();
    },

    _rrSchedule(fn, delayMs) {
        const t = this.time.delayedCall(delayMs, fn, [], this);
        this._rrTimers.push(t);
        return t;
    },

    _rrStopAll() {
        if (this._rrTimers) {
            this._rrTimers.forEach(t => { if (t && t.remove) t.remove(); });
            this._rrTimers = [];
        }
    },
};
