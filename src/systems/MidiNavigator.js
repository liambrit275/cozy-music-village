// MidiNavigator: Maps MIDI piano keys to game navigation actions
// Split by context: 'navigation' mode for menus/exploration, 'challenge' mode for music input

import { MidiInput } from './MidiInput.js';

// Pitch class (noteNumber % 12) → action mapping
const DEFAULT_MAPPING = {
    0:  'left',     // C
    2:  'down',     // D
    4:  'right',    // E
    5:  'up',       // F
    7:  'confirm',  // G
    9:  'cancel',   // A
    11: 'menu'      // B
};

export class MidiNavigator {
    constructor() {
        this._midi = new MidiInput();
        this._mode = 'navigation'; // 'navigation' or 'challenge'
        this._mapping = { ...DEFAULT_MAPPING };
        this._navCallback = null;
        this._musicCallback = null;
        this._held = {};  // action → true/false for hold state
        this._connected = false;
    }

    async init() {
        try {
            await this._midi.init();
            this._connected = true;

            this._midi.onNoteOn((note, velocity) => {
                if (this._mode === 'challenge') {
                    if (this._musicCallback) this._musicCallback(note, velocity);
                    return;
                }

                const pitchClass = note % 12;
                const action = this._mapping[pitchClass];
                if (action) {
                    this._held[action] = true;
                    if (this._navCallback) {
                        this._navCallback({ action, note, velocity });
                    }
                }
            });

            this._midi.onNoteOff((note) => {
                if (this._mode === 'challenge') return;

                const pitchClass = note % 12;
                const action = this._mapping[pitchClass];
                if (action) {
                    this._held[action] = false;
                }
            });
        } catch (e) {
            console.warn('MidiNavigator: no MIDI available', e);
        }
    }

    setMode(mode) {
        this._mode = mode;
        // Clear held state on mode switch
        this._held = {};
    }

    getMode() {
        return this._mode;
    }

    isConnected() {
        return this._connected;
    }

    // Register callback for navigation events
    // callback({ action: 'left'|'right'|'up'|'down'|'confirm'|'cancel'|'menu', note, velocity })
    onNavAction(callback) {
        this._navCallback = callback;
    }

    // Register callback for challenge mode note events
    onMusicNote(callback) {
        this._musicCallback = callback;
    }

    // Check if a navigation action is currently held
    isDown(action) {
        return !!this._held[action];
    }

    // Customize which pitch classes map to which actions
    setMapping(action, pitchClasses) {
        // Remove old mappings for this action
        Object.keys(this._mapping).forEach(pc => {
            if (this._mapping[pc] === action) delete this._mapping[pc];
        });
        // Set new mappings
        pitchClasses.forEach(pc => {
            this._mapping[pc % 12] = action;
        });
    }

    // Reset to default mapping
    resetMapping() {
        this._mapping = { ...DEFAULT_MAPPING };
    }

    dispose() {
        if (this._midi) this._midi.dispose();
        this._navCallback = null;
        this._musicCallback = null;
        this._held = {};
    }
}
