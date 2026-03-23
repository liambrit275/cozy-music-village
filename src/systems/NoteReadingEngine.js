// Pure logic for note-reading challenges — no Phaser dependency

// Staff position tables: staffPosition (integer) → { noteId, noteName, accidental, octave }
// staffPosition 0 = bottom line, each step = half-space upward (line→space→line...)
const TREBLE_POSITIONS = {
    '-2': { noteId: 'C4', noteName: 'C', accidental: null, octave: 4 },
    '-1': { noteId: 'D4', noteName: 'D', accidental: null, octave: 4 },
     '0': { noteId: 'E4', noteName: 'E', accidental: null, octave: 4 },
     '1': { noteId: 'F4', noteName: 'F', accidental: null, octave: 4 },
     '2': { noteId: 'G4', noteName: 'G', accidental: null, octave: 4 },
     '3': { noteId: 'A4', noteName: 'A', accidental: null, octave: 4 },
     '4': { noteId: 'B4', noteName: 'B', accidental: null, octave: 4 },
     '5': { noteId: 'C5', noteName: 'C', accidental: null, octave: 5 },
     '6': { noteId: 'D5', noteName: 'D', accidental: null, octave: 5 },
     '7': { noteId: 'E5', noteName: 'E', accidental: null, octave: 5 },
     '8': { noteId: 'F5', noteName: 'F', accidental: null, octave: 5 },
     '9': { noteId: 'G5', noteName: 'G', accidental: null, octave: 5 },
    '10': { noteId: 'A5', noteName: 'A', accidental: null, octave: 5 },
};

const BASS_POSITIONS = {
    '-2': { noteId: 'E2', noteName: 'E', accidental: null, octave: 2 },
    '-1': { noteId: 'F2', noteName: 'F', accidental: null, octave: 2 },
     '0': { noteId: 'G2', noteName: 'G', accidental: null, octave: 2 },
     '1': { noteId: 'A2', noteName: 'A', accidental: null, octave: 2 },
     '2': { noteId: 'B2', noteName: 'B', accidental: null, octave: 2 },
     '3': { noteId: 'C3', noteName: 'C', accidental: null, octave: 3 },
     '4': { noteId: 'D3', noteName: 'D', accidental: null, octave: 3 },
     '5': { noteId: 'E3', noteName: 'E', accidental: null, octave: 3 },
     '6': { noteId: 'F3', noteName: 'F', accidental: null, octave: 3 },
     '7': { noteId: 'G3', noteName: 'G', accidental: null, octave: 3 },
     '8': { noteId: 'A3', noteName: 'A', accidental: null, octave: 3 },
     '9': { noteId: 'B3', noteName: 'B', accidental: null, octave: 3 },
    '10': { noteId: 'C4', noteName: 'C', accidental: null, octave: 4 },
};

// Notes that can receive accidentals (not E/B for sharps, not C/F for flats)
const CAN_SHARPEN = ['C', 'D', 'F', 'G', 'A'];
const CAN_FLATTEN = ['D', 'E', 'G', 'A', 'B'];

// Difficulty tiers: staffPositions are inclusive ranges [min, max]
const NOTE_READING_TIERS = [
    { minRound: 1,  posRange: [0, 8],   accidentals: false }, // E4–F5 naturals
    { minRound: 6,  posRange: [-2, 9],  accidentals: false }, // add C4, D4, G5
    { minRound: 11, posRange: [-2, 9],  accidentals: true  }, // add sharps/flats
    { minRound: 16, posRange: [-2, 10], accidentals: true  }, // add outer ledger
];

export class NoteReadingEngine {
    _getTierForRound(round) {
        return [...NOTE_READING_TIERS].reverse().find(t => round >= t.minRound) || NOTE_READING_TIERS[0];
    }

    _positionToNote(staffPosition, clef) {
        const table = clef === 'bass' ? BASS_POSITIONS : TREBLE_POSITIONS;
        return table[String(staffPosition)] || null;
    }

    _getNotePool(tier, clef) {
        const [min, max] = tier.posRange;
        let positions = [];
        for (let p = min; p <= max; p++) positions.push(p);
        if (tier.linesOnly) positions = positions.filter(p => p % 2 === 0);

        const pool = [];
        for (const pos of positions) {
            const base = this._positionToNote(pos, clef);
            if (!base) continue;

            pool.push({ ...base, staffPosition: pos });

            if (tier.accidentals) {
                if (CAN_SHARPEN.includes(base.noteName)) {
                    pool.push({
                        ...base,
                        noteId: base.noteName + '#' + base.octave,
                        accidental: 'sharp',
                        staffPosition: pos
                    });
                }
                if (CAN_FLATTEN.includes(base.noteName)) {
                    pool.push({
                        ...base,
                        noteId: base.noteName + 'b' + base.octave,
                        accidental: 'flat',
                        staffPosition: pos
                    });
                }
            }
        }
        return pool;
    }

    _buildDistractors(correctName, correctAccidental, pool) {
        // Pick 2 notes with different names from correct
        const others = pool.filter(n => n.noteName !== correctName);
        const shuffled = others.sort(() => Math.random() - 0.5);
        const seen = new Set();
        const result = [];
        for (const n of shuffled) {
            const key = n.noteName + (n.accidental || '');
            if (!seen.has(key)) {
                seen.add(key);
                result.push(n.noteName + (n.accidental === 'sharp' ? '#' : n.accidental === 'flat' ? 'b' : ''));
                if (result.length >= 2) break;
            }
        }
        // Fallback if pool is too small
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        while (result.length < 2) {
            const r = noteNames[Math.floor(Math.random() * noteNames.length)];
            if (r !== correctName && !result.includes(r)) result.push(r);
        }
        return result;
    }

    buildQuestion(round, clefSetting = 'treble', configOverride = null) {
        // configOverride: { posRange, accidentals, linesOnly } — from world map locations
        const tier = configOverride
            ? { posRange: configOverride.posRange, accidentals: configOverride.accidentals, linesOnly: configOverride.linesOnly || false }
            : this._getTierForRound(round);

        // Pick clef
        let clef = clefSetting;
        if (clefSetting === 'both') {
            clef = Math.random() < 0.5 ? 'treble' : 'bass';
        }

        const pool = this._getNotePool(tier, clef);
        if (!pool.length) return null;

        const note = pool[Math.floor(Math.random() * pool.length)];
        const staffPos = note.staffPosition;

        // Determine ledger info
        const isLedgerBelow = staffPos < 0;
        const isLedgerAbove = staffPos > 8;
        const isLedger = isLedgerBelow || isLedgerAbove;
        const ledgerDirection = isLedgerBelow ? 'below' : isLedgerAbove ? 'above' : null;
        const ledgerCount = isLedgerBelow ? Math.ceil(Math.abs(staffPos) / 2) : isLedgerAbove ? Math.ceil((staffPos - 8) / 2) : 0;

        const correctAnswer = note.noteName + (note.accidental === 'sharp' ? '#' : note.accidental === 'flat' ? 'b' : '');
        const distractors = this._buildDistractors(note.noteName, note.accidental, pool);

        return {
            noteId: note.noteId,
            noteName: note.noteName,
            accidental: note.accidental,
            octave: note.octave,
            clef,
            staffPosition: staffPos,
            isLedger,
            ledgerDirection,
            ledgerCount,
            correctAnswer,
            distractors
        };
    }

    checkAnswer(question, answer) {
        if (answer === question.correctAnswer) return true;
        // Accept enharmonic equivalents (C# = Db, D# = Eb, etc.)
        const ENHARMONIC = {
            'C#': 'Db', 'Db': 'C#',
            'D#': 'Eb', 'Eb': 'D#',
            'F#': 'Gb', 'Gb': 'F#',
            'G#': 'Ab', 'Ab': 'G#',
            'A#': 'Bb', 'Bb': 'A#',
        };
        return (ENHARMONIC[answer] || '') === question.correctAnswer;
    }

    getTierForRound(round) {
        return this._getTierForRound(round);
    }
}
