// ToneChallengeMixin: All tone-challenge methods extracted from ChallengeScene.
// These are mixed into ChallengeScene.prototype so `this` refers to the scene instance.

import { SCALE_DEGREES } from '../systems/MusicTheory.js';
import { TONES_TIERS, _NOTE_TO_SEMI, _SEMI_TO_NOTE, _WHITE_NOTES } from './challengeConstants.js';

export const ToneChallengeMixin = {

    _askTone() {
        const { width, height } = this.cameras.main;
        const degrees = this._getTonesPool();

        // Story mode: always use C. Arcade: use selected key or random.
        const fixedKey = this.storyBattle ? 'C' : (this.tonesKey !== 'random' ? this.tonesKey : null);

        if (this._droneQuestionsLeft <= 0) {
            this.audioEngine.stopDrone();
            if (fixedKey) {
                this.musicTheory.setRoot(fixedKey);
            } else {
                this.musicTheory.randomizeRoot();
            }
            this._droneQuestionsLeft = fixedKey ? 9999 : 5 + Math.floor(Math.random() * 6);

            this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
            this._droneActive = true;
            this.messageText.setText(`Key: ${this.musicTheory.rootNote} — listen: 1 · 5 · 1`);

            const freq1 = this.musicTheory.getIntervalFreq('1');
            const freq5 = this.musicTheory.getIntervalFreq('5');
            this.audioEngine.playInterval(freq1, '4n');
            this.time.delayedCall(550, () => this.audioEngine.playInterval(freq5, '4n'));
            this.time.delayedCall(1100, () => this.audioEngine.playInterval(freq1, '4n'));
            this.time.delayedCall(1700, () => {
                if (this._gameOverFlag) return;
                this._droneQuestionsLeft--;
                this._fireTonesQuestion(degrees, width, height);
            });
        } else {
            if (!this._droneActive) {
                this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
                this._droneActive = true;
            }
            this._droneQuestionsLeft--;
            this._fireTonesQuestion(degrees, width, height);
        }
    },

    _fireTonesQuestion(degrees, width, height) {
        // Avoid repeating the same degree consecutively
        let pick = degrees[Math.floor(Math.random() * degrees.length)];
        if (degrees.length > 1) {
            while (pick === this._lastToneDegree) {
                pick = degrees[Math.floor(Math.random() * degrees.length)];
            }
        }
        this._lastToneDegree = pick;
        this._currentDegree = pick;
        const freq = this.musicTheory.getIntervalFreq(this._currentDegree);

        this._cancelToneReplay();

        this.time.delayedCall(300, () => {
            if (this._gameOverFlag) return;
            this.audioEngine.playInterval(freq, '2n');
            this._buildSolfegeButtons(degrees, width, height);
            this._questionActive = true;

            // Auto-replay tone every 3 seconds until answered
            this._toneReplayTimer = this.time.addEvent({
                delay: 3000,
                callback: () => {
                    if (this._questionActive && this._challengeType === 'tone' && this._currentDegree) {
                        this.audioEngine.playInterval(
                            this.musicTheory.getIntervalFreq(this._currentDegree), '2n'
                        );
                    }
                },
                loop: true
            });
        });
    },

    _cancelToneReplay() {
        if (this._toneReplayTimer) {
            this._toneReplayTimer.remove(false);
            this._toneReplayTimer = null;
        }
    },

    _buildSolfegeButtons(degrees, width, height) {
        // Build the keyboard shell once; afterwards just update labels/highlights
        if (this.solfegeButtons.length === 0) {
            this._buildSolfegeKeyboardShell(width, height);
        }
        this._updateSolfegeKeyboard(degrees);

        this.input.keyboard.once('keydown-SPACE', () => {
            if (this._questionActive && this._challengeType === 'tone') {
                const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
                this.audioEngine.playInterval(freq, '2n');
            }
        });
    },

    /**
     * Build the persistent 2-octave wood keyboard starting from C.
     * Keys are stored in this._solfegeKeyData[] for later updates.
     */
    _buildSolfegeKeyboardShell(width, height) {
        this._clearSolfegeButtons();

        const NUM_WHITE = 14;
        const KEY_W = Math.min(34, (width - 60) / NUM_WHITE);
        const KEY_H = 74;
        const BKEY_W = Math.floor(KEY_W * 0.62);
        const BKEY_H = Math.floor(KEY_H * 0.58);
        const TOTAL_W = NUM_WHITE * KEY_W;
        const kbLeft = width / 2 - TOTAL_W / 2;
        const centerY = height * 0.55;
        const keyTop = centerY - KEY_H / 2;

        const IVORY      = 0xffffff;
        const IVORY_DIM  = 0xcccccc;
        const EBONY      = 0x1a1a1a;
        const EBONY_DIM  = 0x444444;
        const FRAME      = 0x2a2a2a;
        const FRAME_EDGE = 0x111111;

        // Frame
        const frameCX = width / 2;
        const frameCY = keyTop + KEY_H / 2;
        this.solfegeButtons.push(
            this.add.rectangle(frameCX, frameCY, TOTAL_W + 14, KEY_H + 14, FRAME)
                .setStrokeStyle(2, FRAME_EDGE).setDepth(4),
            this.add.rectangle(frameCX, keyTop - 4, TOTAL_W + 10, 3, 0x444444).setDepth(4)
        );

        // Enumerate chromatic keys (always C-based, 2 octaves)
        const startSemi = _NOTE_TO_SEMI['C'];
        this._solfegeKeyData = [];
        let wIdx = 0;

        for (let s = 0; s < 24; s++) {
            const noteName = _SEMI_TO_NOTE[(startSemi + s) % 12];
            const isWhite = _WHITE_NOTES.has(noteName);
            if (isWhite) {
                const cx = kbLeft + wIdx * KEY_W + KEY_W / 2;
                const cy = keyTop + KEY_H / 2;
                const keyRect = this.add.rectangle(cx, cy, KEY_W - 2, KEY_H, IVORY_DIM)
                    .setStrokeStyle(1, 0x888888).setDepth(5);
                const lbl = this.add.text(cx, keyTop + KEY_H - 10, '', {
                    font: 'bold 9px monospace', fill: '#222222', align: 'center'
                }).setOrigin(0.5).setDepth(6);

                this.solfegeButtons.push(keyRect, lbl);
                this._solfegeKeyData.push({
                    noteName, isWhite: true, keyRect, lbl, cx, cy,
                    baseIvory: IVORY, baseDim: IVORY_DIM,
                    hoverColor: 0xe8e8f0,
                });
                wIdx++;
            } else {
                const cx = kbLeft + (wIdx - 0.5) * KEY_W + KEY_W / 2;
                const cy = keyTop + BKEY_H / 2;
                const keyRect = this.add.rectangle(cx, cy, BKEY_W, BKEY_H, EBONY_DIM)
                    .setStrokeStyle(1, 0x000000).setDepth(7);
                const lbl = this.add.text(cx, keyTop + BKEY_H - 8, '', {
                    font: 'bold 8px monospace', fill: '#dddddd', align: 'center'
                }).setOrigin(0.5).setDepth(8);

                this.solfegeButtons.push(keyRect, lbl);
                this._solfegeKeyData.push({
                    noteName, isWhite: false, keyRect, lbl, cx, cy,
                    baseEbony: EBONY, baseDim: EBONY_DIM,
                    hoverColor: 0x3a3a44,
                });
            }
        }

        // Position drone text big and clear above the keyboard
        const kbTopEdge = centerY - KEY_H / 2 - 7;
        this.droneText.setPosition(width / 2, kbTopEdge - 30).setOrigin(0.5, 1)
            .setFontSize(44).setVisible(true);
    },

    /**
     * Update labels, colors, and interactivity on the persistent solfege keyboard.
     * Called each time degrees or root changes.
     */
    _updateSolfegeKeyboard(degrees) {
        if (!this._solfegeKeyData) return;

        const rootNote = this.musicTheory.rootNote;
        const rootSemi = _NOTE_TO_SEMI[rootNote];

        // Update drone text above keyboard
        this.droneText.setText(rootNote).setVisible(true);
        const SEMI_TO_DEG = ['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'];
        const degreeSet = new Set(degrees);
        const ROOT_TINT_WHITE = 0xc0d8f0;   // light blue tint for root white key
        const ROOT_TINT_BLACK = 0x2244aa;    // blue tint for root black key

        this._solfegeKeyData.forEach(kd => {
            const keySemi = _NOTE_TO_SEMI[kd.noteName];
            const offset = (keySemi - rootSemi + 12) % 12;
            const degree = SEMI_TO_DEG[offset];
            const active = degreeSet.has(degree);
            const isRoot = degree === '1';

            // Remove old listeners
            kd.keyRect.removeAllListeners();

            if (kd.isWhite) {
                const baseColor = isRoot ? ROOT_TINT_WHITE : (active ? kd.baseIvory : kd.baseDim);
                kd.keyRect.setFillStyle(baseColor);

                if (active) {
                    kd.keyRect.setInteractive({ useHandCursor: true });
                    kd.keyRect.on('pointerover', () => kd.keyRect.setFillStyle(kd.hoverColor));
                    kd.keyRect.on('pointerout',  () => kd.keyRect.setFillStyle(baseColor));
                    kd.keyRect.on('pointerdown', () => this._submitTone(degree));
                } else {
                    kd.keyRect.disableInteractive();
                }

                const solfege = active ? (SCALE_DEGREES[degree]?.solfege || '') : '';
                const labelText = isRoot ? `${solfege}\n${rootNote}` : solfege;
                kd.lbl.setText(labelText);
            } else {
                const baseColor = isRoot ? ROOT_TINT_BLACK : (active ? kd.baseEbony : kd.baseDim);
                kd.keyRect.setFillStyle(baseColor);

                if (active) {
                    kd.keyRect.setInteractive({ useHandCursor: true });
                    kd.keyRect.on('pointerover', () => kd.keyRect.setFillStyle(kd.hoverColor));
                    kd.keyRect.on('pointerout',  () => kd.keyRect.setFillStyle(baseColor));
                    kd.keyRect.on('pointerdown', () => this._submitTone(degree));
                } else {
                    kd.keyRect.disableInteractive();
                }

                const solfege = active ? (SCALE_DEGREES[degree]?.solfege || '') : '';
                const labelText = isRoot ? `${solfege}\n${rootNote}` : solfege;
                kd.lbl.setText(labelText);
            }
        });
    },

    // ── Wood keyboard helpers ────────────────────────────────────────────────

    /**
     * Build a 2-octave wood-styled keyboard.
     * @param {string}   startNote   White note to start on (e.g. 'C', 'A')
     * @param {number}   width       Scene width
     * @param {number}   height      Scene height
     * @param {Array}    targetArray Array to push game objects into for cleanup
     * @param {Function} onKeyPress  Called with keyData when a key is clicked
     * @param {Function} labelFn     Returns label string or null for a key
     * @param {Function} isActiveFn  Returns true if the key should be interactive
     * @param {object}   [opts]      Optional: { centerY } to vertically center the keyboard
     */
    _buildWoodKeyboard(startNote, width, height, targetArray, onKeyPress, labelFn, isActiveFn, opts) {
        const NUM_WHITE = 14;
        const KEY_W = Math.min(34, (width - 60) / NUM_WHITE);
        const KEY_H = 74;
        const BKEY_W = Math.floor(KEY_W * 0.62);
        const BKEY_H = Math.floor(KEY_H * 0.58);
        const TOTAL_W = NUM_WHITE * KEY_W;
        const kbLeft = width / 2 - TOTAL_W / 2;
        const keyTop = opts?.centerY ? opts.centerY - KEY_H / 2 : height - KEY_H - 8;

        // Classic piano colors
        const IVORY       = 0xffffff;
        const IVORY_HOVER = 0xe8e8f0;
        const IVORY_DIM   = 0xcccccc;
        const EBONY       = 0x1a1a1a;
        const EBONY_HOVER = 0x3a3a44;
        const EBONY_DIM   = 0x444444;
        const FRAME       = 0x2a2a2a;
        const FRAME_EDGE  = 0x111111;

        // Frame behind the keys
        const frameCX = width / 2;
        const frameCY = keyTop + KEY_H / 2;
        const frameBg = this.add.rectangle(frameCX, frameCY, TOTAL_W + 14, KEY_H + 14, FRAME)
            .setStrokeStyle(2, FRAME_EDGE).setDepth(4);
        const frameHL = this.add.rectangle(frameCX, keyTop - 4, TOTAL_W + 10, 3, 0x444444)
            .setDepth(4);
        targetArray.push(frameBg, frameHL);

        // Enumerate chromatic keys for 2 octaves (24 semitones)
        const startSemi = _NOTE_TO_SEMI[startNote];
        const whiteKeys = [];
        const blackKeys = [];
        let wIdx = 0;

        for (let s = 0; s < 24; s++) {
            const noteName = _SEMI_TO_NOTE[(startSemi + s) % 12];
            if (_WHITE_NOTES.has(noteName)) {
                whiteKeys.push({ noteName, semiFromStart: s, whiteIdx: wIdx++ });
            } else {
                blackKeys.push({ noteName, semiFromStart: s, afterWhiteIdx: wIdx - 1 });
            }
        }

        // Draw white keys
        whiteKeys.forEach(kd => {
            const cx = kbLeft + kd.whiteIdx * KEY_W + KEY_W / 2;
            const cy = keyTop + KEY_H / 2;
            const active = isActiveFn(kd);
            const baseColor = active ? IVORY : IVORY_DIM;

            const key = this.add.rectangle(cx, cy, KEY_W - 2, KEY_H, baseColor)
                .setStrokeStyle(1, 0x888888).setDepth(5);
            targetArray.push(key);

            const label = labelFn(kd);
            if (label) {
                const lbl = this.add.text(cx, keyTop + KEY_H - 10, label, {
                    font: 'bold 9px monospace', fill: '#222222', align: 'center'
                }).setOrigin(0.5).setDepth(6);
                targetArray.push(lbl);
            }

            if (active) {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerover', () => key.setFillStyle(IVORY_HOVER));
                key.on('pointerout',  () => key.setFillStyle(baseColor));
                key.on('pointerdown', () => onKeyPress(kd));
            }
        });

        // Draw black keys (on top)
        blackKeys.forEach(kd => {
            const cx = kbLeft + (kd.afterWhiteIdx + 0.5) * KEY_W + KEY_W / 2;
            const cy = keyTop + BKEY_H / 2;
            const active = isActiveFn(kd);
            const baseColor = active ? EBONY : EBONY_DIM;

            const key = this.add.rectangle(cx, cy, BKEY_W, BKEY_H, baseColor)
                .setStrokeStyle(1, 0x000000).setDepth(7);
            targetArray.push(key);

            const label = labelFn(kd);
            if (label) {
                const lbl = this.add.text(cx, keyTop + BKEY_H - 8, label, {
                    font: 'bold 8px monospace', fill: '#dddddd', align: 'center'
                }).setOrigin(0.5).setDepth(8);
                targetArray.push(lbl);
            }

            if (active) {
                key.setInteractive({ useHandCursor: true });
                key.on('pointerover', () => key.setFillStyle(EBONY_HOVER));
                key.on('pointerout',  () => key.setFillStyle(baseColor));
                key.on('pointerdown', () => onKeyPress(kd));
            }
        });
    },

    _submitTone(selected) {
        if (!this._questionActive) return;
        this._questionActive = false;
        this._cancelToneReplay();

        const correct = selected === this._currentDegree;
        const info = SCALE_DEGREES[this._currentDegree];
        this._handleAnswer(correct, correct
            ? `Correct! ${info?.solfege}`
            : `Wrong! It was ${info?.solfege}`
        );
    },

    _getTonesPool() {
        // Story level system — use level's tone degrees
        if (this._storyLevel?.tones?.degrees?.length) {
            return this._storyLevel.tones.degrees;
        }

        if (!this.gradual && this.customDegrees) {
            return this.customDegrees;
        }
        const tier = [...TONES_TIERS].reverse().find(t => this.session.round >= t.minRound) || TONES_TIERS[0];
        return tier.degrees;
    },
};
