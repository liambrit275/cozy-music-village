// MIDI controller input via Web MIDI API
// Listens for note-on messages and maps them to game actions

// Standard MIDI note number → note name (pitch class only)
const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Enharmonic mapping for note reading (matches NoteReadingEngine's answer format)
const ENHARMONIC_MAP = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
};

export class MidiInput {
    constructor() {
        this.available = false;
        this.inputs = [];
        this._onNoteOn = null;  // callback: (midiNote, velocity) => void
        this._access = null;
    }

    async init() {
        if (!navigator.requestMIDIAccess) {
            console.log('Web MIDI API not supported');
            return false;
        }
        try {
            this._access = await navigator.requestMIDIAccess();
            this._bindInputs();

            // Re-bind when devices connect/disconnect
            this._access.onstatechange = () => this._bindInputs();

            this.available = true;
            return true;
        } catch (e) {
            console.log('MIDI access denied:', e);
            return false;
        }
    }

    _bindInputs() {
        // Unbind old listeners
        this.inputs.forEach(input => { input.onmidimessage = null; });
        this.inputs = [];

        // Bind all connected MIDI inputs
        for (const input of this._access.inputs.values()) {
            input.onmidimessage = (msg) => this._handleMessage(msg);
            this.inputs.push(input);
        }
    }

    _handleMessage(msg) {
        const [status, note, velocity] = msg.data;
        const command = status & 0xf0;

        // Note On (0x90) with velocity > 0
        if (command === 0x90 && velocity > 0 && this._onNoteOn) {
            this._onNoteOn(note, velocity);
        }
    }

    // Set callback for note-on events
    onNoteOn(callback) {
        this._onNoteOn = callback;
    }

    // Remove callback
    clearCallback() {
        this._onNoteOn = null;
    }

    // ── Helpers for mapping MIDI notes to game answers ──

    // Get pitch class name from MIDI note (e.g., 60 → 'C')
    static noteName(midiNote) {
        return MIDI_NOTE_NAMES[midiNote % 12];
    }

    // Get pitch class name using flats (for note reading, matching NoteReadingEngine)
    // Returns 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
    static noteNameFlat(midiNote) {
        const name = MIDI_NOTE_NAMES[midiNote % 12];
        return ENHARMONIC_MAP[name] || name;
    }

    // Get scale degree from MIDI note relative to a root MIDI number
    // Returns degree string ('1', 'b2', '2', ...) or null if not in available degrees
    static scaleDegree(midiNote, rootMidi, availableDegrees) {
        const semitones = ((midiNote - rootMidi) % 12 + 12) % 12;
        // Map semitone offset → degree string
        const SEMITONE_TO_DEGREE = {
            0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4',
            6: '#4', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7'
        };
        const degree = SEMITONE_TO_DEGREE[semitones];
        if (!degree) return null;
        if (availableDegrees && !availableDegrees.includes(degree)) return null;
        return degree;
    }

    dispose() {
        this.clearCallback();
        this.inputs.forEach(input => { input.onmidimessage = null; });
        this.inputs = [];
        this.available = false;
    }
}
