// PracticeScene: Friendly practice mode — same question types as arcade, no time pressure.
// A sunny-bunny guide gives tips after each answer.

import { MusicTheory, SCALE_DEGREES } from '../systems/MusicTheory.js';
import { AudioEngine } from '../systems/AudioEngine.js';
import { NoteReadingEngine } from '../systems/NoteReadingEngine.js';
import { VexFlowStaffRenderer } from '../systems/VexFlowStaffRenderer.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';
import { spellPattern, splitRestsAtCursor } from '../systems/RhythmSpeller.js';
import { RhythmNotationRenderer } from '../systems/RhythmNotationRenderer.js';
import { RhythmKeyboardInput } from '../systems/RhythmKeyboardInput.js';

// ── Interval tips for the guide ───────────────────────────────────────────────
const DEGREE_TIPS = {
    '1':  'The tonic — exactly the same as the drone. Home base!',
    'b2': 'Ra — 1 semitone up. The most tense, dissonant interval.',
    '2':  'Re — 2 semitones up. A whole step above the root.',
    'b3': 'Me — 3 semitones. The minor 3rd gives music a sad color.',
    '3':  'Mi — 4 semitones. The major 3rd — bright and happy!',
    '4':  'Fa — 5 semitones. Perfect 4th: "Here Comes the Bride."',
    '#4': 'Fi — 6 semitones. The tritone! Most dissonant of all.',
    '5':  'Sol — 7 semitones. Perfect 5th: stable and strong. "Twinkle Twinkle."',
    'b6': 'Le — 8 semitones. Minor 6th — mysterious and dark.',
    '6':  'La — 9 semitones. Major 6th — sweet and open.',
    'b7': 'Te — 10 semitones. Minor 7th — bluesy and unresolved.',
    '7':  'Ti — 11 semitones. Major 7th — only one step from the octave!',
};

const NOTE_TIPS_TREBLE = [
    'Lines bottom→top: E G B D F',
    '"Every Good Boy Does Fine"',
    'Spaces spell out: F A C E',
];

const NOTE_TIPS_BASS = [
    'Lines bottom→top: G B D F A',
    '"Great Big Dogs Fight Always"',
    'Spaces: A C E G — "All Cows Eat Grass"',
];

const RHYTHM_TIPS = {
    quarter:   'Quarter notes — 1 per beat. Count: 1  2  3  4',
    eighth:    'Eighth notes — 2 per beat. Count: 1 + 2 + 3 + 4 +',
    sixteenth: '16th notes — 4 per beat. Count: 1 e + a  2 e + a ...',
    triplet:   'Triplets — 3 per beat. Count: 1 - trip - let  2 - trip - let',
};

const PRACTICE_INTROS = [
    "Let's practice! Take your time — no rush!",
    "You've got this! Listen carefully.",
    "Try again! Every attempt makes you better.",
    "Keep going — you're doing great!",
    "Music theory is a journey. Let's explore!",
];

const RHYTHM_SUBDIVISIONS = {
    quarter:   { cells: ['1','2','3','4'], downbeats: [0,1,2,3], cellFraction: 1 },
    eighth:    { cells: ['1','+','2','+','3','+','4','+'], downbeats: [0,2,4,6], cellFraction: 0.5 },
    sixteenth: { cells: ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'], downbeats: [0,4,8,12], cellFraction: 0.25 },
    triplet:   { cells: ['1','p','l','2','p','l','3','p','l','4','p','l'], downbeats: [0,3,6,9], cellFraction: 1/3 },
};

const RHYTHM_BPM     = 80;
const GUIDE_X        = 90;
const ALL_TYPES      = ['tone', 'noteReading', 'rhythm'];

export class PracticeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PracticeScene' });
    }

    init(data) {
        this.mode        = data.mode || 'all';
        this.returnScene = data.returnScene || 'PracticeMenuScene';
        this.returnData  = data.returnData  || {};

        const s = data.settings || {};
        this.customDegrees    = Array.isArray(s.tones) && s.tones.length ? s.tones : null;
        this.customNoteRanges = Array.isArray(s.noteRanges) ? s.noteRanges : ['onStaff'];
        this.customRhythmSubs = Array.isArray(s.rhythmSubs) && s.rhythmSubs.length ? s.rhythmSubs : ['quarter'];
        this.clefSetting      = s.clef || 'treble';
        this.soundSettings    = s.sounds || null;
    }

    async create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#06080e');

        // ── Systems ──────────────────────────────────────────────────────────
        this.musicTheory      = new MusicTheory();
        this.audioEngine      = new AudioEngine();
        this.noteReadingEngine = new NoteReadingEngine();
        this.staffRenderer    = new VexFlowStaffRenderer(this);
        this.rhythmNotationRenderer = new RhythmNotationRenderer(this);

        this._questionCount = 0;
        this._questionActive = false;
        this._challengeType = null;
        this._droneActive = false;
        this._droneQuestionsLeft = 0;

        // Rhythm state
        this._rhythmPattern = null;
        this._rhythmSub = null;
        this._rhythmSubKey = null;
        this._userRhythm = [];
        this._rhythmPlaying = false;
        this._rhythmLoopTimer = null;
        this._keyboardInput = null;

        // UI object groups
        this.solfegeButtons = [];
        this.pianoKeys = [];
        this.rhythmUI = [];

        this.events.on('shutdown', () => {
            this._stopRhythmLoop();
            this.audioEngine.dispose();
            this.staffRenderer.clear();
            this.rhythmNotationRenderer.clear();
            if (this._keyboardInput) this._keyboardInput.disable();
        });

        // ── Background stars ─────────────────────────────────────────────────
        for (let i = 0; i < 60; i++) {
            const s = this.add.circle(
                Math.random() * width, Math.random() * height,
                Math.random() * 1.5 + 0.5, 0xffffff, Math.random() * 0.4 + 0.1
            );
            this.tweens.add({ targets: s, alpha: 0.05, duration: 1500 + Math.random() * 2000, yoyo: true, repeat: -1 });
        }

        // ── Title ────────────────────────────────────────────────────────────
        this.add.text(width / 2, 18, 'PRACTICE MODE', {
            font: 'bold 22px monospace', fill: '#e8d098',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(5);

        this._questionCountText = this.add.text(width - 20, 14, 'Q: 0', {
            font: '13px monospace', fill: '#687880'
        }).setOrigin(1, 0).setDepth(5);

        // ── Message area ─────────────────────────────────────────────────────
        this.messageText = this.add.text(width / 2, 50, '', {
            font: 'bold 16px monospace', fill: '#e8f0f0',
            stroke: '#000000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(5);

        // ── Guide character (sunny-bunny) ─────────────────────────────────────
        this._buildGuide(width, height);

        // ── NEXT button ───────────────────────────────────────────────────────
        this.nextBtn = this.add.text(width - 80, height - 36, 'NEXT  ▶', {
            font: 'bold 16px monospace', fill: '#e8f0f0',
            backgroundColor: '#142030', padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true })
            .setVisible(false);
        this.nextBtn.on('pointerover', () => this.nextBtn.setStyle({ backgroundColor: '#243848' }));
        this.nextBtn.on('pointerout',  () => this.nextBtn.setStyle({ backgroundColor: '#142030' }));
        this.nextBtn.on('pointerdown', () => this._nextQuestion());

        // ── BACK button ───────────────────────────────────────────────────────
        this._makeBtn(60, height - 36, '← BACK', '#1a1122', '#2a2244', () => {
            this._stopRhythmLoop();
            this.audioEngine.dispose();
            this.staffRenderer.clear();
            this.rhythmNotationRenderer.clear();
            this.scene.start(this.returnScene, this.returnData);
        });

        // ── SPACE to replay ───────────────────────────────────────────────────
        this.add.text(width / 2, height - 36, 'SPACE: replay', {
            font: '11px monospace', fill: '#1a2838'
        }).setOrigin(0.5).setDepth(5);

        this.input.keyboard.on('keydown-SPACE', () => this._replayAudio());

        // ── Settings gear ─────────────────────────────────────────────────────
        this.add.text(width - 16, 14, '⚙', {
            font: 'bold 20px monospace', fill: '#687880', padding: { x: 6, y: 4 }
        }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#e8d098' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#687880' }); })
            .on('pointerdown', () => this._openSettings());

        this.input.keyboard.on('keydown-ESC', () => this._openSettings());
        this.events.on('resume', () => {
            this.rhythmNotationRenderer.clear();
            if (this._challengeType === 'rhythm') this._renderRhythmNotation();
        });

        // ── Audio init ────────────────────────────────────────────────────────
        try { await this.audioEngine.init(); } catch (e) { /* continue */ }
        if (this.soundSettings) {
            const s = this.soundSettings;
            if (s.drone)      this.audioEngine.setDronePreset(s.drone);
            if (s.interval)   this.audioEngine.setIntervalPreset(s.interval);
            if (s.click)      this.audioEngine.setClickPreset(s.click);
            if (s.rhythmNote) this.audioEngine.setRhythmNotePreset(s.rhythmNote);
            const v = s.volumes || {};
            if (v.drone      != null) this.audioEngine.setDroneLevel(v.drone);
            if (v.interval   != null) this.audioEngine.setIntervalLevel(v.interval);
            if (v.click      != null) this.audioEngine.setClickLevel(v.click);
            if (v.rhythmNote != null) this.audioEngine.setRhythmNoteLevel(v.rhythmNote);
        }

        this._nextQuestion();
    }

    // ── Guide character ───────────────────────────────────────────────────────

    _buildGuide(width, height) {
        const guideY = height - 90;

        // Speech bubble background (graphics, redrawn via _showTip)
        this._bubbleGfx = this.add.graphics().setDepth(6);

        // Speech bubble text
        this._bubbleText = this.add.text(GUIDE_X + 64, guideY - 80, '', {
            font: '11px monospace', fill: '#eeeeff',
            wordWrap: { width: 220, useAdvancedWrap: true },
            align: 'left', lineSpacing: 4
        }).setOrigin(0, 1).setDepth(7);

        // Bunny sprite
        this._guide = this.add.sprite(GUIDE_X, guideY, 'sunny-bunny')
            .setScale(3.5).setDepth(6);
        try { this._guide.play('sunny-bunny-idle'); } catch (e) { /* sprite may not exist yet */ }

        // Initial greeting
        this._showTip("Hi! I'm Benny the Bunny.\nI'll give you tips as you practice!\nTake your time — no rush at all!");
    }

    _showTip(text) {
        if (!this._bubbleText) return;
        this._bubbleText.setText(text);

        // Redraw bubble to fit text
        const bx = this._bubbleText.x - 8;
        const by = this._bubbleText.y - this._bubbleText.height - 8;
        const bw = this._bubbleText.width + 16;
        const bh = this._bubbleText.height + 16;

        this._bubbleGfx.clear();
        this._bubbleGfx.fillStyle(0x0a1022, 0.92);
        this._bubbleGfx.fillRoundedRect(bx, by, bw, bh, 8);
        this._bubbleGfx.lineStyle(1, 0x3355aa, 0.8);
        this._bubbleGfx.strokeRoundedRect(bx, by, bw, bh, 8);
        // Tail pointing to bunny
        this._bubbleGfx.fillTriangle(GUIDE_X + 30, by + bh + 2, GUIDE_X + 10, by + bh + 18, GUIDE_X + 50, by + bh + 2);
    }

    // ── Question flow ─────────────────────────────────────────────────────────

    _nextQuestion() {
        this.nextBtn.setVisible(false);
        this.messageText.setText('');
        this._clearAll();
        this._questionActive = true;
        this._questionCount++;
        this._questionCountText.setText(`Q: ${this._questionCount}`);

        const intro = PRACTICE_INTROS[this._questionCount % PRACTICE_INTROS.length];
        this._showTip(intro);

        // Pick question type
        if (this.mode === 'all') {
            const available = [];
            if (this.customDegrees || this.mode === 'all') available.push('tone');
            available.push('noteReading');
            if (this.customRhythmSubs?.length) available.push('rhythm');
            this._challengeType = ALL_TYPES[this._questionCount % ALL_TYPES.length];
        } else {
            this._challengeType = this.mode;
        }

        switch (this._challengeType) {
            case 'tone':        this._askTone();        break;
            case 'noteReading': this._askNoteReading();  break;
            case 'rhythm':      this._askRhythm();       break;
            default:            this._askTone();
        }
    }

    _waitForNext() {
        this._questionActive = false;
        this.nextBtn.setVisible(true);
    }

    _replayAudio() {
        if (!this._questionActive && this._challengeType !== 'rhythm') return;
        if (this._challengeType === 'tone' && this._currentDegree) {
            this.audioEngine.playInterval(this.musicTheory.getIntervalFreq(this._currentDegree), '2n');
        } else if (this._challengeType === 'rhythm') {
            this._stopRhythmLoop();
            this.time.delayedCall(100, () => this._startRhythmLoop());
        }
    }

    // ── Clear all question UI ─────────────────────────────────────────────────

    _clearAll() {
        this._clearSolfegeButtons();
        this._clearPianoKeys();
        this._clearRhythmUI();
    }

    // ── TONE ──────────────────────────────────────────────────────────────────

    _askTone() {
        const degrees = this._getDegreesPool();

        this._showTip('🎵 Listen to the interval above the drone.\nPress SPACE to hear it again.\nWhich scale degree is it?');

        if (this._droneQuestionsLeft <= 0) {
            this.audioEngine.stopDrone();
            this.musicTheory.randomizeRoot();
            this._droneQuestionsLeft = 5 + Math.floor(Math.random() * 6);
            this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
            this._droneActive = true;
            this.messageText.setText(`Key: ${this.musicTheory.rootNote} — 1 · 5 · 1`);

            const f1 = this.musicTheory.getIntervalFreq('1');
            const f5 = this.musicTheory.getIntervalFreq('5');
            this.audioEngine.playInterval(f1, '4n');
            this.time.delayedCall(550,  () => this.audioEngine.playInterval(f5, '4n'));
            this.time.delayedCall(1100, () => this.audioEngine.playInterval(f1, '4n'));
            this.time.delayedCall(1700, () => {
                if (!this._questionActive) return;
                this._droneQuestionsLeft--;
                this._fireToneQuestion(degrees);
            });
        } else {
            if (!this._droneActive) {
                this.audioEngine.startDrone(this.musicTheory.getDroneFreq());
                this._droneActive = true;
            }
            this.messageText.setText(`Key: ${this.musicTheory.rootNote}`);
            this._droneQuestionsLeft--;
            this._fireToneQuestion(degrees);
        }
    }

    _fireToneQuestion(degrees) {
        this._currentDegree = degrees[Math.floor(Math.random() * degrees.length)];
        const freq = this.musicTheory.getIntervalFreq(this._currentDegree);
        this.time.delayedCall(300, () => {
            if (!this._questionActive) return;
            this.audioEngine.playInterval(freq, '2n');
            this._buildSolfegeButtons(degrees);
        });
    }

    _buildSolfegeButtons(degrees) {
        this._clearSolfegeButtons();
        const { width, height } = this.cameras.main;
        const CIRCLE_OF_FIFTHS = ['1','5','2','6','3','7','#4','b2','b6','b3','b7','4'];
        const allTwelve = degrees.length === 12;
        const ordered = allTwelve ? CIRCLE_OF_FIFTHS : degrees;
        const cx = width / 2, cy = height * 0.42;
        const radius = allTwelve ? 140 : 145;

        // Show key label at circle center
        if (!this._keyLabel) {
            this._keyLabel = this.add.text(cx, cy, '', {
                font: 'bold 36px monospace', fill: '#90c8c0',
                stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(4);
        }
        this._keyLabel.setText(this.musicTheory.rootNote || '').setVisible(true);

        ordered.forEach((degree, i) => {
            let x, y;
            if (allTwelve) {
                const angle = -Math.PI / 2 + (2 * Math.PI * i) / ordered.length;
                x = cx + Math.cos(angle) * radius;
                y = cy + Math.sin(angle) * radius;
            } else if (degrees.length === 1) {
                x = cx; y = cy;
            } else {
                const angle = Math.PI + (Math.PI * i) / Math.max(degrees.length - 1, 1);
                x = cx + Math.cos(angle) * radius;
                y = cy + Math.sin(angle) * (radius * 0.45);
            }
            const info = SCALE_DEGREES[degree];
            if (!info) return;
            const btn = this.add.text(x, y, `${info.solfege}\n${degree}`, {
                font: 'bold 14px monospace', fill: info.color,
                backgroundColor: '#142030', padding: { x: 9, y: 5 },
                stroke: '#000000', strokeThickness: 2, align: 'center'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5);
            btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#243848' }));
            btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#142030' }));
            btn.on('pointerdown', () => this._submitTone(degree));
            this.solfegeButtons.push(btn);
        });
    }

    _submitTone(selected) {
        if (!this._questionActive) return;
        const correct = selected === this._currentDegree;
        const info = SCALE_DEGREES[this._currentDegree];
        const tip = DEGREE_TIPS[this._currentDegree] || '';

        if (correct) {
            this.messageText.setText(`✓ Correct!  ${info?.solfege} (${this._currentDegree})`);
            this.messageText.setStyle({ fill: '#50d0b0' });
            this._showTip(`✓ ${info?.solfege} (${this._currentDegree})!\n${tip}`);
        } else {
            const wrongInfo = SCALE_DEGREES[selected];
            this.messageText.setText(`✗ It was ${info?.solfege} (${this._currentDegree})`);
            this.messageText.setStyle({ fill: '#e08868' });
            this._showTip(`It was ${info?.solfege} (${this._currentDegree}).\n${tip}\n\nYou answered: ${wrongInfo?.solfege} (${selected})`);
        }

        // Flash the correct button gold
        const correctBtn = this.solfegeButtons.find((_, i) => {
            const deg = this.solfegeButtons[i]?.text?.split('\n')?.[1];
            return deg === this._currentDegree;
        });

        // Highlight all buttons — gold = correct, dim = others
        this.solfegeButtons.forEach(btn => {
            const deg = btn.text.split('\n')[1];
            if (deg === this._currentDegree) {
                btn.setStyle({ fill: '#e8d098', backgroundColor: '#332200' });
            } else if (deg === selected && !correct) {
                btn.setStyle({ fill: '#ff4422', backgroundColor: '#330a00' });
            } else {
                btn.setStyle({ fill: '#333355', backgroundColor: '#0a0a22' });
            }
        });

        this._waitForNext();
    }

    _clearSolfegeButtons() {
        this.solfegeButtons.forEach(b => b.destroy());
        this.solfegeButtons = [];
        if (this._keyLabel) { this._keyLabel.setVisible(false); }
        this.messageText.setStyle({ fill: '#e8f0f0' });
    }

    _getDegreesPool() {
        if (this.customDegrees) return this.customDegrees;
        return ['1', '3', '5'];
    }

    // ── NOTE READING ──────────────────────────────────────────────────────────

    _askNoteReading() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;

        const config = this._getNoteReadingConfig();
        this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(1, this.clefSetting, config)
            || this.noteReadingEngine.buildQuestion(1, this.clefSetting);

        if (!this._currentNoteQuestion) {
            this._challengeType = 'tone';
            this._askTone();
            return;
        }

        const clef = this._currentNoteQuestion.clef || this.clefSetting;
        const tipLines = clef === 'bass' ? NOTE_TIPS_BASS : NOTE_TIPS_TREBLE;
        this._showTip('What note is shown on the staff?\n\n' + tipLines.join('\n'));

        this.messageText.setText('Name the note on the staff:');
        this.staffRenderer.draw(width / 2, height * 0.30, 340, this._currentNoteQuestion);
        this._buildPianoKeys(width, height);
    }

    _buildPianoKeys(width, height) {
        this._clearPianoKeys();
        const WHITE_NOTES = ['C','D','E','F','G','A','B'];
        const BLACK_KEYS = [
            { afterIdx: 0, note: 'C#' }, { afterIdx: 1, note: 'D#' },
            { afterIdx: 3, note: 'F#' }, { afterIdx: 4, note: 'G#' }, { afterIdx: 5, note: 'A#' },
        ];
        const keyW = 52, keyH = 90, bkeyW = 30, bkeyH = 56;
        const totalW = WHITE_NOTES.length * keyW;
        const startX = width / 2 - totalW / 2;
        const keyTop = height - keyH - 52;

        WHITE_NOTES.forEach((note, i) => {
            const cx = startX + i * keyW + keyW / 2;
            const cy = keyTop + keyH / 2;
            const key = this.add.rectangle(cx, cy, keyW - 2, keyH, 0xeeeeee)
                .setStrokeStyle(1, 0x555555).setDepth(5);
            const lbl = this.add.text(cx, keyTop + keyH - 12, note, {
                font: '11px monospace', fill: '#333333'
            }).setOrigin(0.5).setDepth(6);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0xbbddff));
            key.on('pointerout',  () => key.setFillStyle(0xeeeeee));
            key.on('pointerdown', () => this._submitNoteReading(note));
            this.pianoKeys.push(key, lbl);
        });

        BLACK_KEYS.forEach(({ afterIdx, note }) => {
            const cx = startX + (afterIdx + 1) * keyW;
            const cy = keyTop + bkeyH / 2;
            const key = this.add.rectangle(cx, cy, bkeyW, bkeyH, 0x222222)
                .setStrokeStyle(1, 0x000000).setDepth(7);
            key.setInteractive({ useHandCursor: true });
            key.on('pointerover', () => key.setFillStyle(0x3355aa));
            key.on('pointerout',  () => key.setFillStyle(0x222222));
            key.on('pointerdown', () => this._submitNoteReading(note));
            this.pianoKeys.push(key);
        });
    }

    _submitNoteReading(answer) {
        if (!this._questionActive) return;
        const correct = this.noteReadingEngine.checkAnswer(this._currentNoteQuestion, answer);
        const name = this._currentNoteQuestion.correctAnswer;
        const clef = this._currentNoteQuestion.clef || this.clefSetting;
        const tipLines = clef === 'bass' ? NOTE_TIPS_BASS : NOTE_TIPS_TREBLE;

        if (correct) {
            this.messageText.setText(`✓ Correct! It's ${name}!`);
            this.messageText.setStyle({ fill: '#50d0b0' });
            this._showTip(`✓ Well done! That note is ${name}.\n\n${tipLines.join('\n')}`);
        } else {
            this.messageText.setText(`✗ It was ${name}.`);
            this.messageText.setStyle({ fill: '#e08868' });
            this._showTip(`It was ${name}, not ${answer}.\n\n${tipLines.join('\n')}`);
        }
        this._waitForNext();
    }

    _clearPianoKeys() {
        this.pianoKeys.forEach(k => k.destroy());
        this.pianoKeys = [];
        this.staffRenderer.clear();
        this.messageText.setStyle({ fill: '#e8f0f0' });
    }

    _getNoteReadingConfig() {
        const ranges = this.customNoteRanges;
        const hasLedgerLow  = ranges.includes('ledgerLow');
        const hasLedgerHigh = ranges.includes('ledgerHigh');
        const hasAccidentals = ranges.includes('accidentals');
        const minPos = hasLedgerLow  ? -2 : 0;
        const maxPos = hasLedgerHigh ? 10 : 8;
        return { posRange: [minPos, maxPos], accidentals: hasAccidentals };
    }

    // ── RHYTHM ────────────────────────────────────────────────────────────────

    _askRhythm() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;

        const subs = this.customRhythmSubs;
        const subKey = subs[Math.floor(Math.random() * subs.length)];
        const sub = RHYTHM_SUBDIVISIONS[subKey];
        const cells = sub.cells.length;

        // Generate pattern
        const pattern = new Array(cells).fill(false);
        const target = Math.max(2, Math.floor(cells * (0.3 + Math.random() * 0.4)));
        let count = 0;
        for (let i = 0; i < cells; i++) {
            if (Math.random() < (sub.downbeats.includes(i) ? 0.75 : 0.4) && count < target) {
                pattern[i] = true; count++;
            }
        }
        pattern[0] = true;
        if (pattern.filter(Boolean).length < 2) pattern[Math.floor(cells / 2)] = true;

        this._rhythmPattern = pattern;
        this._rhythmSub     = sub;
        this._rhythmSubKey  = subKey;
        this._rhythmCells   = cells;
        this._rhythmCellMs  = (60000 / RHYTHM_BPM) * sub.cellFraction;
        this._userRhythm    = new Array(cells).fill(0);
        this._nextGroupId   = 1;

        this._showTip(`🥁 Listen to the rhythm then copy it!\n\n${RHYTHM_TIPS[subKey] || ''}\n\nPress SPACE to replay.`);
        this.messageText.setText('Listen, then copy the rhythm:');

        this._buildRhythmGrid(width, height);
        this.time.delayedCall(400, () => this._startRhythmLoop());
    }

    _buildRhythmGrid(width, height) {
        this._clearRhythmUI();
        const sub = this._rhythmSub;
        const cells = this._rhythmCells;

        const cellW = Math.min(42, (width - 80) / cells);
        const cellH = 36;
        const totalW = cells * cellW;
        const gridX = width / 2 - totalW / 2;
        const gridY = height * 0.44;
        this._gridX = gridX; this._gridY = gridY;
        this._cellW = cellW; this._cellH = cellH;

        // Beat separators and cell labels
        const beatSize = sub.cellFraction > 0 ? Math.round(1 / sub.cellFraction) : 1;
        for (let i = 0; i < cells; i++) {
            const cx = gridX + i * cellW + cellW / 2;
            const isDownbeat = sub.downbeats.includes(i);
            const bg = this.add.rectangle(cx, gridY, cellW - 1, cellH, isDownbeat ? 0x1a2a44 : 0x0d1428)
                .setStrokeStyle(1, 0x2244aa).setDepth(3);

            const lbl = this.add.text(cx, gridY - cellH / 2 - 8, sub.cells[i], {
                font: '9px monospace', fill: isDownbeat ? '#90c8c0' : '#687880'
            }).setOrigin(0.5).setDepth(3);

            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this._toggleRhythmCell(i, bg));

            this.rhythmUI.push(bg, lbl);
            this['_rhythmCell' + i] = bg;
        }

        // SUBMIT button
        const submitBtn = this._makeBtn(width / 2 + 40, height - 36, 'SUBMIT', '#142030', '#243848', () => {
            if (this._questionActive) this._submitRhythm();
        });
        submitBtn.setDepth(5);
        this.rhythmUI.push(submitBtn);

        // PLAY button
        const playBtn = this._makeBtn(width / 2 - 90, height - 36, '▶ PLAY', '#142030', '#243848', () => {
            this._stopRhythmLoop();
            this.time.delayedCall(100, () => this._startRhythmLoop());
        });
        playBtn.setDepth(5);
        this.rhythmUI.push(playBtn);

        // Keyboard input
        if (this._keyboardInput) this._keyboardInput.disable();
        this._keyboardInput = new RhythmKeyboardInput(this, {
            cells,
            ticksPerCell: { quarter: 4, eighth: 2, sixteenth: 1, triplet: 1 }[this._rhythmSubKey] || 1,
            onUpdate: (grid) => {
                this._userRhythm = grid;
                this._refreshRhythmCells();
                this._renderRhythmNotation();
            },
            onSubmit: () => { if (this._questionActive) this._submitRhythm(); }
        });
        this._keyboardInput.enable();

        this._renderRhythmNotation();
    }

    _toggleRhythmCell(i, bg) {
        if (!this._questionActive) return;
        if (this._userRhythm[i] > 0) {
            this._userRhythm[i] = 0;
        } else {
            this._userRhythm[i] = this._nextGroupId++;
        }
        this._refreshRhythmCells();
        this._renderRhythmNotation();
    }

    _refreshRhythmCells() {
        for (let i = 0; i < this._rhythmCells; i++) {
            const bg = this['_rhythmCell' + i];
            if (!bg) continue;
            const isNote = this._userRhythm[i] > 0;
            const isDownbeat = this._rhythmSub.downbeats.includes(i);
            bg.setFillStyle(isNote ? 0x1a4a2a : (isDownbeat ? 0x1a2a44 : 0x0d1428));
        }
    }

    _renderRhythmNotation() {
        if (!this._rhythmSub) return;
        const { width, height } = this.cameras.main;
        const notationY = this._gridY + this._cellH + 70;
        const grid = this._userRhythm;
        const spelled = spellPattern(grid, this._rhythmSubKey);
        const cursorTick = this._keyboardInput ? this._keyboardInput._cursorTick : -1;
        const selTicks = this._keyboardInput ? this._keyboardInput.effectiveTicks : 0;
        const finalSpelled = splitRestsAtCursor(spelled, cursorTick, selTicks, this._rhythmSubKey);
        this.rhythmNotationRenderer.render(finalSpelled, this._rhythmSubKey, width / 2, notationY, width - 80, cursorTick);
    }

    _startRhythmLoop() {
        if (this._rhythmLoopTimer) this._stopRhythmLoop();
        this._rhythmPlaying = true;
        let step = 0;
        const pattern = this._rhythmPattern;
        const cellMs = this._rhythmCellMs;
        const cells = this._rhythmCells;

        const tick = () => {
            if (!this._rhythmPlaying) return;
            if (step >= cells) { step = 0; }
            const isNote = pattern[step];
            const isDownbeat = this._rhythmSub.downbeats.includes(step);
            if (isNote) this.audioEngine.playRhythmNote();
            this.audioEngine.playClick(isDownbeat);

            // Cursor highlight on pattern display cells
            for (let i = 0; i < cells; i++) {
                const bg = this['_rhythmCell' + i];
                if (!bg) continue;
                const isUser = this._userRhythm[i] > 0;
                const isBeat = this._rhythmSub.downbeats.includes(i);
                const isActive = i === step;
                if (isActive) {
                    bg.setFillStyle(pattern[i] ? 0x2266ff : 0x113355);
                } else {
                    bg.setFillStyle(isUser ? 0x1a4a2a : (isBeat ? 0x1a2a44 : 0x0d1428));
                }
            }

            step++;
            this._rhythmLoopTimer = this.time.delayedCall(cellMs, tick);
        };
        tick();
    }

    _stopRhythmLoop() {
        this._rhythmPlaying = false;
        if (this._rhythmLoopTimer) { this._rhythmLoopTimer.remove(false); this._rhythmLoopTimer = null; }
    }

    _submitRhythm() {
        if (!this._questionActive) return;
        this._stopRhythmLoop();
        this._questionActive = false;

        const pattern = this._rhythmPattern;
        const userGrid = this._userRhythm;

        // Onset-based: correct if note STARTS match (rest→note transitions)
        const patternOnsets = pattern.map((v, i) => v && (i === 0 || !pattern[i - 1]));
        const userOnsets    = userGrid.map((v, i) => v > 0 && (i === 0 || userGrid[i - 1] === 0));

        let correct = 0;
        for (let i = 0; i < pattern.length; i++) {
            if (patternOnsets[i] === userOnsets[i]) correct++;
        }
        const accuracy = correct / pattern.length;
        const passed = accuracy >= 0.75;

        // Color cells: green = correct onset, red = wrong
        for (let i = 0; i < this._rhythmCells; i++) {
            const bg = this['_rhythmCell' + i];
            if (!bg) continue;
            if (pattern[i]) {
                bg.setFillStyle(userOnsets[i] ? 0x115511 : 0x551111);
            } else {
                bg.setFillStyle(userOnsets[i] ? 0x442200 : 0x0d1428);
            }
        }

        const tip = RHYTHM_TIPS[this._rhythmSubKey] || '';
        if (passed) {
            this.messageText.setText(`✓ Great rhythm! (${Math.round(accuracy * 100)}% match)`);
            this.messageText.setStyle({ fill: '#50d0b0' });
            this._showTip(`✓ Well done!\n\n${tip}`);
        } else {
            this.messageText.setText(`✗ Not quite — ${Math.round(accuracy * 100)}% match`);
            this.messageText.setStyle({ fill: '#e08868' });
            this._showTip(`Keep trying! Listen for where the notes START.\n\n${tip}\n\nGreen = note, cells are where notes fall.`);
        }

        this.messageText.setStyle({ fill: passed ? '#50d0b0' : '#e08868' });
        this.nextBtn.setVisible(true);
    }

    _clearRhythmUI() {
        this._stopRhythmLoop();
        this.rhythmUI.forEach(o => o.destroy());
        this.rhythmUI = [];
        this.rhythmNotationRenderer.clear();
        if (this._keyboardInput) { this._keyboardInput.disable(); this._keyboardInput = null; }
        // Clear cell refs
        for (let i = 0; i < 16; i++) delete this['_rhythmCell' + i];
        this.messageText.setStyle({ fill: '#e8f0f0' });
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    _openSettings() {
        this.staffRenderer.clear();
        this.rhythmNotationRenderer.clear();
        this.scene.launch('SettingsScene', { callerKey: 'PracticeScene', pauseCaller: true });
        this.scene.pause();
    }

    // ── UI helpers ─────────────────────────────────────────────────────────────

    _makeBtn(x, y, label, bg, hover, cb) {
        const btn = this.add.text(x, y, label, {
            font: 'bold 15px monospace', fill: '#e8f0f0',
            backgroundColor: bg, padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: hover }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bg }));
        btn.on('pointerdown', cb);
        return btn;
    }
}
