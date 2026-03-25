import { getInstrumentNoteConfig, normalizeInstrumentId } from '../data/levels.js';
import { _WHITE_NOTES, GROUND_Y } from './challengeConstants.js';
import { MidiInput } from '../systems/MidiInput.js';
import { ProgressionManager } from '../systems/ProgressionManager.js';

export const NoteReadingMixin = {
    _getNoteReadingConfig() {
        // Story level system — use instrument profile for clef + range
        if (this._storyLevel?.noteReading) {
            const nr = this._storyLevel.noteReading;
            const instConfig = getInstrumentNoteConfig(this._instrumentId, this._storyLevel.id);
            return { posRange: instConfig.posRange, accidentals: nr.accidentals || false, clef: instConfig.clef };
        }

        if (this.gradual) return null;

        const ranges = this.customNoteRanges;
        const hasOnStaff = ranges.includes('onStaff');
        const hasLedgerLow = ranges.includes('ledgerLow');
        const hasLedgerHigh = ranges.includes('ledgerHigh');
        const hasAccidentals = ranges.includes('accidentals');

        let minPos = hasOnStaff ? 0 : (hasLedgerLow ? -2 : 0);
        let maxPos = hasOnStaff ? 8 : (hasLedgerHigh ? 10 : 8);
        if (hasLedgerLow) minPos = -2;
        if (hasLedgerHigh) maxPos = 10;

        return { posRange: [minPos, maxPos], accidentals: hasAccidentals };
    },

    _askNoteReading() {
        const { width, height } = this.cameras.main;
        this.audioEngine.stopDrone();
        this._droneActive = false;
        this.droneText.setVisible(false);

        const noteConfig = this._getNoteReadingConfig();
        // Use instrument-derived clef if available, otherwise fall back to scene setting
        const clefForQuestion = noteConfig?.clef || this.clefSetting;
        this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, clefForQuestion, noteConfig);
        if (!this._currentNoteQuestion) {
            this._currentNoteQuestion = this.noteReadingEngine.buildQuestion(this.session.round, clefForQuestion);
            if (!this._currentNoteQuestion) {
                console.warn('NoteReading: buildQuestion returned null, falling back to tone');
                this._challengeType = 'tone';
                this._askTone();
                return;
            }
        }

        const staffCX = width / 2;
        const staffCY = height * 0.22;
        this.staffRenderer.draw(staffCX, staffCY, 340, this._currentNoteQuestion);

        this.messageText.setY(GROUND_Y + 16);

        if (this.pianoKeys.length === 0) {
            // Place keyboard directly below the staff with a small gap
            const keyboardCenterY = staffCY + 130;
            this._buildPianoKeys(width, height, keyboardCenterY);
        }
        this._staffVisible = true;
        this._questionActive = true;
    },

    _buildPianoKeys(width, height, centerY) {
        this._clearPianoKeys();

        // Note reading keyboard: 2 octaves starting from C
        // Only label white keys — user can infer sharps/flats
        this._buildWoodKeyboard('C', width, height, this.pianoKeys, (kd) => {
            this._submitNoteReading(kd.noteName);
        }, (kd) => {
            return _WHITE_NOTES.has(kd.noteName) ? kd.noteName : null;
        }, () => true, centerY ? { centerY } : undefined);
    },

    _submitNoteReading(answer) {
        if (!this._questionActive) return;
        this._questionActive = false;

        const correct = this.noteReadingEngine.checkAnswer(this._currentNoteQuestion, answer);
        this._handleAnswer(correct, correct
            ? `Correct! It's ${this._currentNoteQuestion.correctAnswer}!`
            : `Wrong! It was ${this._currentNoteQuestion.correctAnswer}.`
        );
    },

    _handleMidiNote(midiNote) {
        if (this._gameOverFlag) return;

        if (this._challengeType === 'rhythmReading') {
            if (this._questionActive) this._onRrTap();
            return;
        }

        if (this._challengeType === 'rhythm') {
            if (this._questionActive && this._rhythmCellCenters) {
                const nextEmpty = this._userRhythm.findIndex(v => v === 0);
                if (nextEmpty >= 0) this._onRhythmCellDown(nextEmpty);
            }
            return;
        }

        const freq = this.musicTheory.midiToFreq(midiNote);
        this.audioEngine.playInterval(freq, '8n');

        if (!this._questionActive) return;

        if (this._challengeType === 'tone') {
            const transpose = ((new ProgressionManager()).loadArcadeSettings() || {}).midiTranspose || 0;
            const degree = MidiInput.scaleDegree(
                midiNote + transpose, this.musicTheory.rootMidi, this._getTonesPool()
            );
            if (degree) this._submitTone(degree);
        } else if (this._challengeType === 'noteReading') {
            const sharpName = MidiInput.noteName(midiNote);
            const flatName = MidiInput.noteNameFlat(midiNote);

            const correct = this._currentNoteQuestion?.correctAnswer;
            if (correct === flatName) {
                this._submitNoteReading(flatName);
            } else if (correct === sharpName) {
                this._submitNoteReading(sharpName);
            } else {
                this._submitNoteReading(sharpName);
            }
        }
    },

    _clearPianoKeys() {
        this.pianoKeys.forEach(k => k.destroy());
        this.pianoKeys = [];
        if (this._staffVisible) {
            this.staffRenderer.clear();
            this._staffVisible = false;
        }
        this.messageText.setY(GROUND_Y - 30);
    },

    _clearSolfegeButtons() {
        this._cancelToneReplay();
        this.solfegeButtons.forEach(b => b.destroy());
        this.solfegeButtons = [];
        this._solfegeKeyData = null;
        this._lastDegreesKey = null;
    },
};
