// Scale degree definitions and interval logic using movable Do solfege

export const SCALE_DEGREES = {
    '1':  { solfege: 'Do',  semitones: 0,  color: '#ee7755' },
    'b2': { solfege: 'Ra',  semitones: 1,  color: '#884444' },
    '2':  { solfege: 'Re',  semitones: 2,  color: '#ff8844' },
    'b3': { solfege: 'Me',  semitones: 3,  color: '#886644' },
    '3':  { solfege: 'Mi',  semitones: 4,  color: '#ffff44' },
    '4':  { solfege: 'Fa',  semitones: 5,  color: '#44ff44' },
    '#4': { solfege: 'Fi',  semitones: 6,  color: '#448844' },
    '5':  { solfege: 'Sol', semitones: 7,  color: '#4444ff' },
    'b6': { solfege: 'Le',  semitones: 8,  color: '#884488' },
    '6':  { solfege: 'La',  semitones: 9,  color: '#8844ff' },
    'b7': { solfege: 'Te',  semitones: 10, color: '#ff44ff' },
    '7':  { solfege: 'Ti',  semitones: 11, color: '#ff88ff' }
};

// Note names for display
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// All available root notes (MIDI numbers for octave 3)
const ROOT_NOTES = {
    'C': 48, 'Db': 49, 'D': 50, 'Eb': 51, 'E': 52, 'F': 53,
    'F#': 54, 'G': 55, 'Ab': 56, 'A': 57, 'Bb': 58, 'B': 59
};

export class MusicTheory {
    constructor() {
        this.rootNote = 'C';
        this.rootMidi = ROOT_NOTES['C'];
    }

    setRoot(noteName) {
        this.rootNote = noteName;
        this.rootMidi = ROOT_NOTES[noteName];
    }

    // Get a random root note
    randomizeRoot() {
        const keys = Object.keys(ROOT_NOTES);
        this.rootNote = keys[Math.floor(Math.random() * keys.length)];
        this.rootMidi = ROOT_NOTES[this.rootNote];
    }

    // Convert MIDI note number to frequency
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // Get frequency for the drone (root note) — one octave below the interval range
    getDroneFreq() {
        return this.midiToFreq(this.rootMidi - 12);
    }

    // Get frequency for a scale degree
    getIntervalFreq(scaleDegree) {
        const deg = SCALE_DEGREES[scaleDegree];
        if (!deg) return null;
        // Play interval in octave above the drone
        return this.midiToFreq(this.rootMidi + 12 + deg.semitones);
    }

    // Pick a random interval from available scale degrees
    getRandomInterval(availableDegrees) {
        // Don't pick the root (too easy) unless it's the only option
        const nonRoot = availableDegrees.filter(d => d !== '1');
        const pool = nonRoot.length > 0 ? nonRoot : availableDegrees;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Get solfege name for a scale degree
    getSolfege(scaleDegree) {
        return SCALE_DEGREES[scaleDegree]?.solfege || '?';
    }

    // Get semitone distance for a scale degree
    getSemitones(scaleDegree) {
        return SCALE_DEGREES[scaleDegree]?.semitones ?? -1;
    }

    // Get display color for a scale degree
    getColor(scaleDegree) {
        return SCALE_DEGREES[scaleDegree]?.color || '#ffffff';
    }

    // Get the note name for a scale degree given current root
    getNoteName(scaleDegree) {
        const semitones = this.getSemitones(scaleDegree);
        const rootIndex = NOTE_NAMES.indexOf(this.rootNote);
        const noteIndex = (rootIndex + semitones) % 12;
        return NOTE_NAMES[noteIndex];
    }
}
