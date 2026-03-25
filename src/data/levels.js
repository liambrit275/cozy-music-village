// Story mode level definitions — progressive difficulty for the music theory game.
// Each level configures which note reading, rhythm, and tone challenges are available.
// The farmer NPC delivers the tutorial dialogue at the start of each new level.

/**
 * Time signature metadata used by ChallengeScene and RhythmSpeller.
 * - compound: true for x/8 compound meters (6/8, 9/8, 12/8)
 * - beatTicks: ticks per felt beat (4 for simple quarter, 3 for compound dotted-quarter)
 * - totalTicks: total ticks in one bar at the finest grid resolution
 * - midpoint: tick where the bar must split (null if no symmetric midpoint)
 * - numBeats/beatValue: VexFlow voice parameters
 */
export const TIME_SIG_INFO = {
    '1/4':  { beats: 1, beatValue: 4, compound: false, beatTicks: 4, totalTicks: 4,  midpoint: null, numBeats: 1,  vexBeatValue: 4 },
    '2/4':  { beats: 2, beatValue: 4, compound: false, beatTicks: 4, totalTicks: 8,  midpoint: null, numBeats: 2,  vexBeatValue: 4 },
    '3/4':  { beats: 3, beatValue: 4, compound: false, beatTicks: 4, totalTicks: 12, midpoint: null,  numBeats: 3,  vexBeatValue: 4 },
    '4/4':  { beats: 4, beatValue: 4, compound: false, beatTicks: 4, totalTicks: 16, midpoint: 8,    numBeats: 4,  vexBeatValue: 4 },
    '3/8':  { beats: 3, beatValue: 8, compound: false, beatTicks: 2, totalTicks: 6,  midpoint: null,  numBeats: 3,  vexBeatValue: 8 },
    '6/8':  { beats: 2, beatValue: 8, compound: true,  beatTicks: 3, totalTicks: 6,  midpoint: 3,    numBeats: 6,  vexBeatValue: 8 },
    '9/8':  { beats: 3, beatValue: 8, compound: true,  beatTicks: 3, totalTicks: 9,  midpoint: null,  numBeats: 9,  vexBeatValue: 8 },
    '12/8': { beats: 4, beatValue: 8, compound: true,  beatTicks: 3, totalTicks: 12, midpoint: 6,    numBeats: 12, vexBeatValue: 8 },
};

// ── INSTRUMENT PROFILES ────────────────────────────────────────────────────────
// Each instrument defines clef, open strings, and per-level note ranges.
// posRange is [min, max] staff positions (0 = bottom line, 8 = top line + 1 space).
// For 'both' clef, posRange applies relative to whichever clef is chosen.

const NOTE_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Convert a note name like 'C4' or 'A3' to a staff position for a given clef.
 * Treble: E4 = pos 0. Bass: G2 = pos 0. Each diatonic step = ±1.
 */
export function noteNameToStaffPos(noteName, clef) {
    const letter = noteName.charAt(0);
    const octave = parseInt(noteName.charAt(1));
    const idx = NOTE_INDEX[letter];
    if (idx === undefined || isNaN(octave)) return 0;
    if (clef === 'bass') return (octave - 2) * 7 + idx - 4;
    return (octave - 4) * 7 + idx - 2; // treble
}

export const INSTRUMENT_PROFILES = {
    piano: {
        label: 'Piano', clef: 'both',
        openStrings: [],
        // Starts treble, introduces bass at level 6
        levelRanges: [
            { posRange: [0, 8],    clef: 'treble' },  // E4–F5 (on-staff)
            { posRange: [-2, 8],   clef: 'treble' },  // C4–F5 (add middle C)
            { posRange: [-2, 10],  clef: 'treble' },  // C4–A5
            { posRange: [-2, 10],  clef: 'treble' },  // + accidentals
            { posRange: [-4, 12],  clef: 'treble' },  // A3–C6
            { posRange: [-2, 10],  clef: 'both' },    // introduce bass clef
            { posRange: [-4, 12],  clef: 'both' },    // 2 ledger lines
            { posRange: [-6, 14],  clef: 'both' },    // 3 ledger lines
            { posRange: [-8, 16],  clef: 'both' },    // 4 ledger lines
        ],
    },
    guitar: {
        label: 'Guitar', clef: 'treble',
        openStrings: ['E4', 'A4', 'D5', 'G4', 'B4', 'E5'], // written pitch
        // Treble clef (8vb). Open string area is on/near staff.
        levelRanges: [
            { posRange: [0, 8],    clef: 'treble' },  // E4–F5 (1st–3rd strings)
            { posRange: [-2, 8],   clef: 'treble' },  // C4–F5
            { posRange: [-2, 10],  clef: 'treble' },  // C4–A5
            { posRange: [-2, 10],  clef: 'treble' },  // + accidentals
            { posRange: [-4, 12],  clef: 'treble' },  // A3–C6 (4th–5th strings)
            { posRange: [-5, 12],  clef: 'treble' },  // G3–C6
            { posRange: [-6, 13],  clef: 'treble' },  // F3–D6
            { posRange: [-7, 14],  clef: 'treble' },  // E3–E6 (full open range)
            { posRange: [-9, 16],  clef: 'treble' },  // C3–G6 (extended)
        ],
    },
    violin: {
        label: 'Violin', clef: 'treble',
        openStrings: ['G3', 'D4', 'A4', 'E5'],
        // G3 = pos −5 in treble. First position covers D4–B5.
        levelRanges: [
            { posRange: [-1, 7],   clef: 'treble' },  // D4–E5 (A+E string 1st pos)
            { posRange: [-2, 9],   clef: 'treble' },  // C4–G5
            { posRange: [-5, 10],  clef: 'treble' },  // G3–A5 (all 4 strings)
            { posRange: [-5, 10],  clef: 'treble' },  // + accidentals
            { posRange: [-5, 11],  clef: 'treble' },  // G3–B5 (3rd position)
            { posRange: [-5, 12],  clef: 'treble' },  // G3–C6
            { posRange: [-6, 13],  clef: 'treble' },  // F3–D6
            { posRange: [-7, 14],  clef: 'treble' },  // E3–E6
            { posRange: [-9, 16],  clef: 'treble' },  // C3–G6 (high positions)
        ],
    },
    cello: {
        label: 'Cello', clef: 'bass',
        openStrings: ['C2', 'G2', 'D3', 'A3'],
        // Bass clef. Open strings C2(pos −4)–A3(pos 8).
        levelRanges: [
            { posRange: [0, 8],    clef: 'bass' },    // G2–A3 (D+A strings)
            { posRange: [-2, 8],   clef: 'bass' },    // E2–A3 (add C string)
            { posRange: [-4, 10],  clef: 'bass' },    // C2–C4 (all strings)
            { posRange: [-4, 10],  clef: 'bass' },    // + accidentals
            { posRange: [-4, 12],  clef: 'bass' },    // C2–E4 (thumb position)
            { posRange: [-6, 13],  clef: 'bass' },    // A1–F4
            { posRange: [-7, 14],  clef: 'bass' },    // G1–G4
            { posRange: [-8, 15],  clef: 'bass' },    // F1–A4
            { posRange: [-10, 18], clef: 'bass' },    // D1–D5 (full range)
        ],
    },
    ukulele: {
        label: 'Ukulele', clef: 'treble',
        openStrings: ['G4', 'C4', 'E4', 'A4'],
        // Compact range. Open strings span C4(pos −2)–A4(pos 3).
        levelRanges: [
            { posRange: [-2, 7],   clef: 'treble' },  // C4–E5 (open + first frets)
            { posRange: [-2, 9],   clef: 'treble' },  // C4–G5
            { posRange: [-3, 10],  clef: 'treble' },  // B3–A5
            { posRange: [-3, 10],  clef: 'treble' },  // + accidentals
            { posRange: [-4, 10],  clef: 'treble' },  // A3–A5
            { posRange: [-5, 11],  clef: 'treble' },  // G3–B5
            { posRange: [-5, 12],  clef: 'treble' },  // G3–C6
            { posRange: [-6, 12],  clef: 'treble' },  // F3–C6
            { posRange: [-7, 12],  clef: 'treble' },  // E3–C6 (practical max)
        ],
    },
    vocal: {
        label: 'Vocal', clef: 'treble',
        openStrings: [],
        // Comfortable mid-range, gradually expanding
        levelRanges: [
            { posRange: [0, 8],    clef: 'treble' },  // E4–F5
            { posRange: [-2, 8],   clef: 'treble' },  // C4–F5
            { posRange: [-2, 10],  clef: 'treble' },  // C4–A5
            { posRange: [-2, 10],  clef: 'treble' },  // + accidentals
            { posRange: [-4, 11],  clef: 'treble' },  // A3–B5
            { posRange: [-5, 12],  clef: 'treble' },  // G3–C6
            { posRange: [-6, 13],  clef: 'treble' },  // F3–D6
            { posRange: [-7, 14],  clef: 'treble' },  // E3–E6
            { posRange: [-9, 16],  clef: 'treble' },  // C3–G6
        ],
    },
};

/** Normalize legacy instrument names to profile keys. */
export function normalizeInstrumentId(name) {
    if (!name) return 'piano';
    const lower = name.toLowerCase();
    if (INSTRUMENT_PROFILES[lower]) return lower;
    // Legacy mappings
    const LEGACY = { voice: 'vocal', flute: 'vocal', trumpet: 'vocal', other: 'piano', bass: 'cello' };
    return LEGACY[lower] || 'piano';
}

/**
 * Get note reading config for a given instrument and story level.
 * Returns { posRange: [min, max], clef } ready for NoteReadingEngine.
 */
export function getInstrumentNoteConfig(instrumentId, levelId) {
    const profile = INSTRUMENT_PROFILES[normalizeInstrumentId(instrumentId)];
    const idx = Math.max(0, Math.min(profile.levelRanges.length - 1, levelId - 1));
    const range = profile.levelRanges[idx];
    return { posRange: range.posRange, clef: range.clef };
}

/**
 * Build a subdivision config (cells, downbeats, cellFraction) for a given
 * time signature and note-value subdivision.
 *
 * For simple meters (2/4, 3/4, 4/4): quarter, eighth, sixteenth
 * For compound meters (6/8, 9/8, 12/8): eighth, sixteenth
 * For 3/8: eighth, sixteenth (treated as simple)
 *
 * cellFraction = fraction of the "felt beat" each cell represents.
 * Used as: cellMs = (60000 / BPM) * cellFraction
 * BPM = quarter notes/min for simple, dotted-quarter/min for compound.
 */
export function buildSubdivision(timeSig, noteValue) {
    const info = TIME_SIG_INFO[timeSig];
    if (!info) return null;

    if (info.compound) {
        return _buildCompoundSub(info, noteValue);
    }
    return _buildSimpleSub(info, noteValue);
}

function _buildSimpleSub(info, noteValue) {
    const nBeats = info.beats;
    const isEighthBeat = info.beatValue === 8; // 3/8: beat = eighth note

    if (isEighthBeat) {
        // Simple x/8 meter (e.g., 3/8): uses 1-p-l counting like compound
        if (noteValue === 'eighth') {
            const cells = [];
            const downbeats = [0];
            for (let b = 0; b < nBeats; b++) {
                if (b === 0) cells.push('1');
                else if (b === 1) cells.push('p');
                else cells.push('l');
            }
            return { cells, downbeats, cellFraction: 1 / 3, ticksPerCell: 2 };
        }
        if (noteValue === 'sixteenth') {
            const cells = [];
            const downbeats = [0];
            const labels = ['1', '+', 'p', '+', 'l', '+'];
            for (let s = 0; s < nBeats * 2; s++) {
                cells.push(labels[s] || '+');
            }
            return { cells, downbeats, cellFraction: 1 / 6, ticksPerCell: 1 };
        }
        return null; // quarter doesn't apply in x/8 simple
    }

    // Simple x/4 meter: beat = quarter note
    if (noteValue === 'quarter') {
        const cells = [];
        const downbeats = [];
        for (let b = 0; b < nBeats; b++) {
            cells.push(String(b + 1));
            downbeats.push(b);
        }
        return { cells, downbeats, cellFraction: 1, ticksPerCell: 4 };
    }

    if (noteValue === 'eighth') {
        const cells = [];
        const downbeats = [];
        for (let b = 0; b < nBeats; b++) {
            cells.push(String(b + 1));
            downbeats.push(b * 2);
            cells.push('+');
        }
        return { cells, downbeats, cellFraction: 0.5, ticksPerCell: 2 };
    }

    if (noteValue === 'sixteenth') {
        const cells = [];
        const downbeats = [];
        const labels = ['', 'e', '+', 'a'];
        for (let b = 0; b < nBeats; b++) {
            for (let s = 0; s < 4; s++) {
                cells.push(s === 0 ? String(b + 1) : labels[s]);
            }
            downbeats.push(b * 4);
        }
        return { cells, downbeats, cellFraction: 0.25, ticksPerCell: 1 };
    }

    return null;
}

function _buildCompoundSub(info, noteValue) {
    const nBeats = info.beats; // number of compound beats (dotted-quarter groups)

    if (noteValue === 'eighth') {
        const cells = [];
        const downbeats = [];
        for (let b = 0; b < nBeats; b++) {
            cells.push(String(b + 1));
            downbeats.push(b * 3);
            cells.push('p');
            cells.push('l');
        }
        return { cells, downbeats, cellFraction: 1 / 3, ticksPerCell: 1 };
    }

    if (noteValue === 'sixteenth') {
        const cells = [];
        const downbeats = [];
        for (let b = 0; b < nBeats; b++) {
            cells.push(String(b + 1));
            downbeats.push(b * 6);
            cells.push('+');
            cells.push('p');
            cells.push('+');
            cells.push('l');
            cells.push('+');
        }
        return { cells, downbeats, cellFraction: 1 / 6, ticksPerCell: 1 };
    }

    return null;
}

/**
 * Convert a ledgerLines count (0–5) to a staff position range for NoteReadingEngine.
 * 0 ledger lines: [0, 8] — on staff only
 * 1: [-2, 10], 2: [-4, 12], 3: [-6, 14], 4: [-8, 16], 5: [-10, 18]
 */
export function ledgerLinesToPosRange(ledgerLines) {
    const n = Math.max(0, Math.min(5, ledgerLines));
    return [-(n * 2), 8 + (n * 2)];
}

/**
 * Pick a valid subdivision for the given time signature.
 * Filters the level's allowed subdivisions to those that work in this meter.
 */
export function pickSubdivision(timeSig, allowedSubs) {
    const info = TIME_SIG_INFO[timeSig];
    if (!info) return 'quarter';

    // Valid note values for this meter type
    let valid;
    if (info.compound) {
        valid = ['eighth', 'sixteenth'];
    } else if (info.beatValue === 8) {
        // Simple x/8 (e.g., 3/8): quarter doesn't apply
        valid = ['eighth', 'sixteenth'];
    } else {
        valid = ['quarter', 'eighth', 'sixteenth'];
    }

    const candidates = allowedSubs.filter(s => valid.includes(s));
    if (candidates.length === 0) {
        return info.compound || info.beatValue === 8 ? 'eighth' : 'quarter';
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── STORY LEVELS ───────────────────────────────────────────────────────────────

export const STORY_LEVELS = [
    {
        id: 1,
        title: 'First Notes',
        encountersToAdvance: 9,
        tutorial: "Oh no, my animals have escaped! Music is the only thing that calms them down. Can you help me play some notes to bring them back? Let's start with the simplest ones — Do and Mi. Rescue all 9 animals!",
        noteReading: {
            enabled: true,
            accidentals: false,
            ledgerLines: 0,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter'],
            timeSigs: ['4/4'],
            concepts: [],
        },
        tones: {
            enabled: true,
            degrees: ['1', '3'],
        },
    },
    {
        id: 2,
        title: 'Reading the Lines',
        encountersToAdvance: 9,
        tutorial: "Great job! Now let's learn to read the staff. Remember: Every Good Boy Deserves Fudge for the lines, and F-A-C-E for the spaces. I'll add some eighth notes too — they go twice as fast! Rescue all the animals again!",
        noteReading: {
            enabled: true,
            accidentals: false,
            ledgerLines: 0,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth'],
            timeSigs: ['4/4', '2/4'],
            concepts: [],
        },
        tones: {
            enabled: true,
            degrees: ['1', '3', '5'],
        },
    },
    {
        id: 3,
        title: 'Open Position',
        encountersToAdvance: 9,
        tutorial: "You're a natural! Let's use all the notes in open position now. Ti wants to go home to Do — that pull is called a leading tone. Time to round them all up again!",
        noteReading: {
            enabled: true,
            accidentals: false,
            ledgerLines: 1,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth'],
            timeSigs: ['4/4', '2/4'],
            concepts: [],
        },
        tones: {
            enabled: true,
            degrees: ['1', '3', '5', '7'],
        },
    },
    {
        id: 4,
        title: 'Sharps & Flats',
        encountersToAdvance: 9,
        tutorial: "Some of my shyer animals only respond to those in-between notes — sharps and flats! We're also adding three-four time — one-two-three, like a waltz. Off you go!",
        noteReading: {
            enabled: true,
            accidentals: true,
            ledgerLines: 1,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth'],
            timeSigs: ['4/4', '2/4', '3/4'],
            concepts: [],
        },
        tones: {
            enabled: true,
            degrees: ['1', '2', '3', '4', '5', '6', '7'],
        },
    },
    {
        id: 5,
        title: 'The Full Scale',
        encountersToAdvance: 9,
        tutorial: "La completes our major scale — Do Re Mi Fa Sol La Ti! And compound time — 6/8 has two big beats, each split into three. The animals love dancing to it!",
        noteReading: {
            enabled: true,
            accidentals: true,
            ledgerLines: 2,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth'],
            timeSigs: ['4/4', '2/4', '3/4', '6/8'],
            concepts: ['dotted notes'],
        },
        tones: {
            enabled: true,
            degrees: ['1', '2', '3', '4', '5', '6', '7'],
        },
    },
    {
        id: 6,
        title: 'Minor Colors',
        encountersToAdvance: 9,
        tutorial: "Some animals respond to darker sounds. Me (flat 3) and Te (flat 7) give us that minor feeling — it's not sad, just a different color! We're also adding sixteenth notes now.",
        noteReading: {
            enabled: true,
            accidentals: true,
            ledgerLines: 2,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth', 'sixteenth'],
            timeSigs: ['4/4', '2/4', '3/4', '6/8'],
            concepts: ['dotted notes', 'ties'],
        },
        tones: {
            enabled: true,
            degrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'],
        },
    },
    {
        id: 7,
        title: 'Syncopation',
        encountersToAdvance: 9,
        tutorial: "These animals dance off the beat! Syncopation means accenting the weak beats — it makes music feel funky and exciting. We're also trying 9/8 time — three groups of three!",
        noteReading: {
            enabled: true,
            accidentals: true,
            ledgerLines: 3,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth', 'sixteenth'],
            timeSigs: ['4/4', '2/4', '3/4', '6/8', '9/8'],
            concepts: ['dotted notes', 'ties', 'syncopation'],
        },
        tones: {
            enabled: true,
            degrees: ['1', 'b2', '2', 'b3', '3', '4', '5', 'b6', '6', 'b7', '7'],
        },
    },
    {
        id: 8,
        title: 'The Tritone',
        encountersToAdvance: 9,
        tutorial: "Time for Fi — the tritone! It's the most restless sound in music, pulling us toward Sol. You've now unlocked every scale degree! And 12/8 time — four big compound beats.",
        noteReading: {
            enabled: true,
            accidentals: true,
            ledgerLines: 4,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth', 'sixteenth'],
            timeSigs: ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8'],
            concepts: ['dotted notes', 'ties', 'syncopation', 'rests'],
        },
        tones: {
            enabled: true,
            degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'],
        },
    },
    {
        id: 9,
        title: 'Ledger Lines',
        encountersToAdvance: 9,
        tutorial: "Final level! Notes are hiding way up high and way down low — you'll need to read ledger lines. Those little extra lines above or below the staff. Every time signature, every scale degree. You've got this!",
        noteReading: {
            enabled: true,
            accidentals: true,
            ledgerLines: 5,
        },
        rhythm: {
            enabled: true,
            subdivisions: ['quarter', 'eighth', 'sixteenth'],
            timeSigs: ['2/4', '3/4', '4/4', '3/8', '6/8', '9/8', '12/8'],
            concepts: ['dotted notes', 'ties', 'syncopation', 'rests', 'pickup bar'],
        },
        tones: {
            enabled: true,
            degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'],
        },
    },
];

/** Lookup a level by id (1-indexed). Returns the level object or null. */
export function getStoryLevel(levelId) {
    return STORY_LEVELS.find(l => l.id === levelId) || null;
}

/**
 * Get the available challenge types for a given level.
 * Returns an array of type strings: 'tone', 'noteReading', 'rhythm', 'rhythmReading'.
 */
export function getLevelChallengeTypes(level) {
    const types = [];
    if (level.tones?.enabled) types.push('tone');
    if (level.noteReading?.enabled) types.push('noteReading');
    if (level.rhythm?.enabled) {
        types.push('rhythm');
        types.push('rhythmReading');
    }
    return types.length > 0 ? types : ['tone'];
}
