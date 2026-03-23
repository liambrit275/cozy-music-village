// Audio engine using Tone.js for drone and interval playback

export const DRONE_PRESETS = {
    pad:     { label: 'Pad',     osc: { type: 'fatsine4',      spread: 18 }, attack: 0.9,  gain: 0.28, filterFreq: 650 },
    organ:   { label: 'Organ',   osc: { type: 'fatsawtooth4',  spread: 8  }, attack: 0.15, gain: 0.22, filterFreq: 900 },
    strings: { label: 'Strings', osc: { type: 'fattriangle4',  spread: 14 }, attack: 1.3,  gain: 0.32, filterFreq: 750 },
    bass:    { label: 'Bass',    osc: { type: 'sine'           },            attack: 0.4,  gain: 0.42, filterFreq: 500 },
};

export const INTERVAL_PRESETS = {
    synth: { label: 'Synth', osc: { type: 'square8'                    }, env: { attack: 0.01,  decay: 0.3,  sustain: 0.4,  release: 0.5  }, gain: 0.4  },
    flute: { label: 'Flute', osc: { type: 'sine'                       }, env: { attack: 0.06,  decay: 0.1,  sustain: 0.8,  release: 0.5  }, gain: 0.5  },
    bell:  { label: 'Bell',  osc: { type: 'triangle'                   }, env: { attack: 0.001, decay: 1.0,  sustain: 0.05, release: 1.5  }, gain: 0.45 },
    piano: { label: 'Piano', osc: { type: 'fatsawtooth4', spread: 5   }, env: { attack: 0.005, decay: 0.4,  sustain: 0.2,  release: 0.8  }, gain: 0.35 },
};

export const CLICK_PRESETS = {
    stick:     { label: 'Stick',     type: 'membrane', accent: 'C5', normal: 'C4'  },
    hihat:     { label: 'Hi-Hat',    type: 'noise'                                  },
    woodblock: { label: 'Woodblock', type: 'membrane', accent: 'A5', normal: 'E5'  },
    cowbell:   { label: 'Cowbell',   type: 'membrane', accent: 'G#5', normal: 'G#4' },
};

export const RHYTHM_NOTE_PRESETS = {
    snare: { label: 'Snare', type: 'noise',    duration: '16n' },
    kick:  { label: 'Kick',  type: 'membrane', note: 'C2',  duration: '8n'  },
    tom:   { label: 'Tom',   type: 'membrane', note: 'G3',  duration: '16n' },
    clave: { label: 'Clave', type: 'membrane', note: 'E5',  duration: '32n' },
};

export class AudioEngine {
    constructor() {
        this.initialized = false;
        this.drone = null;
        this.droneOctave = null;
        this.droneGain = null;
        this.droneOctaveGain = null;
        this.droneFilter = null;
        this.intervalSynth = null;
        this.intervalGain = null;
        this.metronome = null;
        this.metronomeGain = null;
        this._currentDroneFreq = null;
        this._droneLevel       = 0.75;  // user volume multiplier (0–1)
        this._intervalLevel    = 1.0;

        // Load saved sound presets from localStorage
        let saved = null;
        try {
            const raw = localStorage.getItem('arcade-settings');
            if (raw) saved = JSON.parse(raw).sounds;
        } catch (e) { /* ignore */ }

        this._dronePreset      = (saved && saved.drone && DRONE_PRESETS[saved.drone]) ? saved.drone : 'pad';
        this._intervalPreset   = (saved && saved.interval && INTERVAL_PRESETS[saved.interval]) ? saved.interval : 'synth';
        this._clickPreset      = (saved && saved.click && CLICK_PRESETS[saved.click]) ? saved.click : 'stick';
        this._rhythmNotePreset = (saved && saved.rhythmNote && RHYTHM_NOTE_PRESETS[saved.rhythmNote]) ? saved.rhythmNote : 'snare';

        this._droneBaseGain    = DRONE_PRESETS[this._dronePreset].gain;
        this._intervalBaseGain = INTERVAL_PRESETS[this._intervalPreset].gain;

        // Click and drum volumes (0–1)
        this._clickLevel      = (saved && saved.volumes?.click      != null) ? saved.volumes.click      : 1.0;
        this._rhythmNoteLevel = (saved && saved.volumes?.rhythmNote != null) ? saved.volumes.rhythmNote : 1.0;
        // Sync drone/interval levels from saved volumes too
        if (saved && saved.volumes?.drone    != null) this._droneLevel    = saved.volumes.drone;
        if (saved && saved.volumes?.interval != null) this._intervalLevel = saved.volumes.interval;
    }

    async init() {
        if (this.initialized) return;
        await Tone.start();

        // Hall reverb shared by drone and interval
        this.hallReverb = new Tone.Reverb({ decay: 10, wet: 0.90 }).toDestination();
        await this.hallReverb.generate();

        // Drone chain: synth → droneGain → droneFilter → hallReverb
        const dPreset = DRONE_PRESETS[this._dronePreset];
        this.droneFilter = new Tone.Filter(dPreset.filterFreq, 'lowpass').connect(this.hallReverb);
        this._droneBaseGain = dPreset.gain;
        this.droneGain = new Tone.Gain(dPreset.gain * this._droneLevel).connect(this.droneFilter);
        this.droneOctaveGain = new Tone.Gain(0.12).connect(this.droneFilter);
        this.droneFifthGain  = new Tone.Gain(0.10).connect(this.droneFilter);

        this.drone = new Tone.Synth({
            oscillator: dPreset.osc,
            envelope: { attack: dPreset.attack, decay: 0.1, sustain: 1.0, release: 1.5 }
        }).connect(this.droneGain);

        // Perfect fifth above tonic
        this.droneFifth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: dPreset.attack + 0.1, decay: 0.1, sustain: 0.9, release: 1.5 }
        }).connect(this.droneFifthGain);

        // Octave above tonic
        this.droneOctave = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: dPreset.attack + 0.2, decay: 0.1, sustain: 0.8, release: 1.5 }
        }).connect(this.droneOctaveGain);

        // Interval synth chain → hallReverb
        const iPreset = INTERVAL_PRESETS[this._intervalPreset];
        this._intervalBaseGain = iPreset.gain;
        this.intervalGain = new Tone.Gain(iPreset.gain * this._intervalLevel).connect(this.hallReverb);
        this.intervalSynth = new Tone.Synth({
            oscillator: iPreset.osc,
            envelope: iPreset.env
        }).connect(this.intervalGain);

        // Metronome — dry
        this.metronomeGain = new Tone.Gain(0.2).toDestination();
        this.metronome = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 4,
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
        }).connect(this.metronomeGain);

        // Drum noise synth (hi-hat, snare) — dry
        this.drumNoiseGain = new Tone.Gain(0.25).toDestination();
        this.drumNoise = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 }
        }).connect(this.drumNoiseGain);

        // Drum membrane (kick, tom, clave) — dry
        this.drumMembraneGain = new Tone.Gain(0.3).toDestination();
        this.drumMembrane = new Tone.MembraneSynth({
            pitchDecay: 0.02,
            octaves: 4,
            envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
        }).connect(this.drumMembraneGain);

        // SFX — dry
        this.sfxGain = new Tone.Gain(0.3).toDestination();
        this.sfxSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
        }).connect(this.sfxGain);

        this.initialized = true;
    }

    // ── Drone ──────────────────────────────────────────────────

    startDrone(freq) {
        if (!this.initialized) return;
        this._currentDroneFreq = freq;
        const fifth = freq * Math.pow(2, 7 / 12); // perfect fifth
        this.drone.triggerAttack(freq);
        this.droneFifth.triggerAttack(fifth);
        this.droneOctave.triggerAttack(freq * 2); // octave above tonic
    }

    stopDrone() {
        if (!this.initialized) return;
        this._currentDroneFreq = null;
        this.drone.triggerRelease();
        this.droneFifth.triggerRelease();
        this.droneOctave.triggerRelease();
    }

    setDronePreset(name) {
        const preset = DRONE_PRESETS[name];
        if (!preset) return;
        this._dronePreset = name;
        if (!this.initialized) return;

        const wasPlaying = this._currentDroneFreq;
        if (wasPlaying) { this.drone.triggerRelease(); this.droneFifth.triggerRelease(); this.droneOctave.triggerRelease(); }

        this.drone.dispose();
        this.droneFifth.dispose();
        this.droneOctave.dispose();

        this._droneBaseGain = preset.gain;
        this.droneFilter.frequency.value = preset.filterFreq;
        this.droneGain.gain.value = preset.gain * this._droneLevel;

        this.drone = new Tone.Synth({
            oscillator: preset.osc,
            envelope: { attack: preset.attack, decay: 0.1, sustain: 1.0, release: 1.5 }
        }).connect(this.droneGain);

        this.droneFifth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: preset.attack + 0.1, decay: 0.1, sustain: 0.9, release: 1.5 }
        }).connect(this.droneFifthGain);

        this.droneOctave = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: preset.attack + 0.2, decay: 0.1, sustain: 0.8, release: 1.5 }
        }).connect(this.droneOctaveGain);

        if (wasPlaying) {
            this._currentDroneFreq = wasPlaying;
            const fifth = wasPlaying * Math.pow(2, 7 / 12);
            this.drone.triggerAttack(wasPlaying);
            this.droneFifth.triggerAttack(fifth);
            this.droneOctave.triggerAttack(wasPlaying * 2);
        }
    }

    getDronePreset()    { return this._dronePreset; }

    // ── Interval synth ─────────────────────────────────────────

    playInterval(freq, duration = '4n') {
        if (!this.initialized) return;
        this.intervalSynth.triggerAttackRelease(freq, duration);
    }

    setIntervalPreset(name) {
        const preset = INTERVAL_PRESETS[name];
        if (!preset) return;
        this._intervalPreset = name;
        if (!this.initialized) return;

        this.intervalSynth.dispose();
        this._intervalBaseGain = preset.gain;
        this.intervalGain.gain.value = preset.gain * this._intervalLevel;
        this.intervalSynth = new Tone.Synth({
            oscillator: preset.osc,
            envelope: preset.env
        }).connect(this.intervalGain);
    }

    getIntervalPreset() { return this._intervalPreset; }

    // ── Volume levels ──────────────────────────────────────────

    setDroneLevel(v) {
        this._droneLevel = Math.max(0, Math.min(1, v));
        if (this.droneGain) this.droneGain.gain.value = this._droneBaseGain * this._droneLevel;
    }

    getDroneLevel() { return this._droneLevel; }

    setIntervalLevel(v) {
        this._intervalLevel = Math.max(0, Math.min(1, v));
        if (this.intervalGain) this.intervalGain.gain.value = this._intervalBaseGain * this._intervalLevel;
    }

    getIntervalLevel() { return this._intervalLevel; }

    // ── Rhythm / metronome ─────────────────────────────────────

    setClickLevel(v) {
        this._clickLevel = Math.max(0, Math.min(1, v));
    }
    getClickLevel() { return this._clickLevel; }

    setRhythmNoteLevel(v) {
        this._rhythmNoteLevel = Math.max(0, Math.min(1, v));
    }
    getRhythmNoteLevel() { return this._rhythmNoteLevel; }

    playClick(accent = false) {
        if (!this.initialized) return;
        const p = CLICK_PRESETS[this._clickPreset] || CLICK_PRESETS.stick;
        const lv = this._clickLevel;
        if (p.type === 'noise') {
            this.drumNoise.envelope.decay = accent ? 0.08 : 0.04;
            this.drumNoiseGain.gain.value = (accent ? 0.3 : 0.18) * lv;
            this.drumNoise.triggerAttackRelease('32n');
        } else {
            this.metronomeGain.gain.value = (accent ? 0.25 : 0.15) * lv;
            this.metronome.triggerAttackRelease(accent ? p.accent : p.normal, '32n');
        }
    }

    playDrumNote() {
        if (!this.initialized) return;
        const p = RHYTHM_NOTE_PRESETS[this._rhythmNotePreset] || RHYTHM_NOTE_PRESETS.snare;
        const lv = this._rhythmNoteLevel;
        if (p.type === 'noise') {
            this.drumNoise.envelope.decay = 0.12;
            this.drumNoiseGain.gain.value = 0.35 * lv;
            this.drumNoise.triggerAttackRelease(p.duration);
        } else {
            this.drumMembraneGain.gain.value = 0.3 * lv;
            this.drumMembrane.triggerAttackRelease(p.note, p.duration);
        }
    }

    playRhythmNote() {
        if (!this.initialized) return;
        this.playDrumNote();
    }

    setClickPreset(name) { if (CLICK_PRESETS[name]) this._clickPreset = name; }
    getClickPreset()      { return this._clickPreset; }
    setRhythmNotePreset(name) { if (RHYTHM_NOTE_PRESETS[name]) this._rhythmNotePreset = name; }
    getRhythmNotePreset() { return this._rhythmNotePreset; }

    // ── SFX ────────────────────────────────────────────────────

    playCorrect() {
        if (!this.initialized) return;
        const now = Tone.now();
        this.sfxSynth.triggerAttackRelease('C5', '16n', now);
        this.sfxSynth.triggerAttackRelease('E5', '16n', now + 0.1);
        this.sfxSynth.triggerAttackRelease('G5', '16n', now + 0.2);
    }

    playWrong() {
        if (!this.initialized) return;
        const now = Tone.now();
        this.sfxSynth.triggerAttackRelease('E3', '8n', now);
        this.sfxSynth.triggerAttackRelease('Eb3', '8n', now + 0.15);
    }

    playHit() {
        if (!this.initialized) return;
        this.metronome.triggerAttackRelease('G2', '16n');
    }

    playVictory() {
        if (!this.initialized) return;
        const now = Tone.now();
        ['C4', 'E4', 'G4', 'C5'].forEach((note, i) => {
            this.sfxSynth.triggerAttackRelease(note, '8n', now + i * 0.15);
        });
    }

    // ── Cleanup ────────────────────────────────────────────────

    dispose() {
        this.stopDrone();
        if (this.drone)          this.drone.dispose();
        if (this.droneFifth)     this.droneFifth.dispose();
        if (this.droneOctave)    this.droneOctave.dispose();
        if (this.intervalSynth)  this.intervalSynth.dispose();
        if (this.metronome)      this.metronome.dispose();
        if (this.drumNoise)      this.drumNoise.dispose();
        if (this.drumMembrane)   this.drumMembrane.dispose();
        if (this.sfxSynth)       this.sfxSynth.dispose();
        if (this.droneFifthGain)  this.droneFifthGain.dispose();
        if (this.droneOctaveGain) this.droneOctaveGain.dispose();
        if (this.droneGain)      this.droneGain.dispose();
        if (this.droneFilter)    this.droneFilter.dispose();
        if (this.intervalGain)   this.intervalGain.dispose();
        if (this.metronomeGain)  this.metronomeGain.dispose();
        if (this.drumNoiseGain)  this.drumNoiseGain.dispose();
        if (this.drumMembraneGain) this.drumMembraneGain.dispose();
        if (this.sfxGain)        this.sfxGain.dispose();
        if (this.hallReverb)     this.hallReverb.dispose();
        this.initialized = false;
    }
}
