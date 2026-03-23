// Combat state machine managing turn-based battle flow

import { NoteReadingEngine } from './NoteReadingEngine.js';

export const COMBAT_STATES = {
    INTRO: 'intro',
    VILLAGER_REQUEST: 'villager_request',
    PLAYER_IDENTIFY: 'player_identify',
    PLAYER_RESULT: 'player_result',
    NOTE_READING_QUESTION: 'note_reading_question',
    NOTE_READING_RESULT: 'note_reading_result',
    RHYTHM_QUESTION: 'rhythm_question',
    RHYTHM_RESULT: 'rhythm_result',
    VILLAGER_HELPED: 'villager_helped',
    PLAYER_EXHAUSTED: 'player_exhausted'
};

export class CombatManager {
    constructor(scene, player, villager, musicTheory, audioEngine, availableDegrees, noteReadingEngine, options = {}) {
        this.scene = scene;
        this.player = player;
        this.villager = villager;
        this.music = musicTheory;
        this.audio = audioEngine;
        this.availableDegrees = availableDegrees;
        this.noteReadingEngine = noteReadingEngine || new NoteReadingEngine();
        this.clefSetting = options.clefSetting || 'treble';
        this.noteReadingConfig = options.noteReadingConfig || null;

        this.state = COMBAT_STATES.INTRO;
        this.currentInterval = null;
        this.intervalPlayTime = 0;
        this.turnCount = 0;
        this.onStateChange = null; // callback for UI updates
        this.pendingNoteQuestion = null;
    }

    setState(newState, data = {}) {
        this.state = newState;
        if (this.onStateChange) {
            this.onStateChange(newState, data);
        }
    }

    // Start the battle
    async startBattle() {
        this.music.randomizeRoot();
        const enemyType = this.villager.needsHelpWith || 'mixed';
        // Start drone for tone-based challenges
        if (enemyType === 'tone' || enemyType === 'mixed') {
            this.audio.startDrone(this.music.getDroneFreq());
        }
        this.setState(COMBAT_STATES.INTRO, {
            message: `${this.villager.name} needs your help!`,
            droneNote: (enemyType === 'tone' || enemyType === 'mixed') ? this.music.rootNote : null
        });

        await this.wait(1500);
        this.nextTurn();
    }

    // Begin a new turn — branches on monster.enemyType
    nextTurn() {
        this.turnCount++;
        const enemyType = this.villager.needsHelpWith || 'mixed';

        switch (enemyType) {
            case 'tone':
                this._startTonePhase();
                break;
            case 'noteReading':
                this.startNoteReadingPhase();
                break;
            case 'rhythm':
                this.startRhythmPhase();
                break;
            case 'mixed': {
                // Randomly pick between all three challenge types
                const types = ['tone', 'noteReading', 'rhythm'];
                const pick = types[Math.floor(Math.random() * types.length)];
                if (pick === 'tone') this._startTonePhase();
                else if (pick === 'noteReading') this.startNoteReadingPhase();
                else this.startRhythmPhase();
                break;
            }
            default:
                this._startTonePhase();
                break;
        }
    }

    // Tone identification phase (plays interval, waits for solfege button)
    _startTonePhase() {
        // Restart drone (may have been stopped during rhythm phase)
        this.audio.startDrone(this.music.getDroneFreq());

        this.currentInterval = this.villager.chooseInterval(this.availableDegrees);
        const freq = this.music.getIntervalFreq(this.currentInterval);

        this.setState(COMBAT_STATES.VILLAGER_REQUEST, {
            message: `${this.villager.name} hums a tune...`,
            interval: this.currentInterval
        });

        this.villager.showPuzzle();

        this.scene.time.delayedCall(500, () => {
            this.audio.playInterval(freq, '2n');
            this.intervalPlayTime = performance.now();
            this.setState(COMBAT_STATES.PLAYER_IDENTIFY, {
                message: 'Identify the interval!',
                droneNote: this.music.rootNote
            });
        });
    }

    // Player selected a solfege answer
    submitAnswer(selectedDegree) {
        if (this.state !== COMBAT_STATES.PLAYER_IDENTIFY) return;

        const correct = selectedDegree === this.currentInterval;
        const responseTime = performance.now() - this.intervalPlayTime;

        if (correct) {
            const speedBonus = Math.max(1, 2 - responseTime / 4000);
            const damage = this.player.calcDamage(speedBonus);
            const actualDamage = this.villager.receiveHelp(damage);

            this.audio.playCorrect();
            this.villager.flashHappy();

            this.setState(COMBAT_STATES.PLAYER_RESULT, {
                correct: true,
                message: `Correct! ${this.music.getSolfege(this.currentInterval)}! +${actualDamage} help!`,
                damage: actualDamage,
                speedBonus: speedBonus.toFixed(1)
            });
        } else {
            const damage = this.villager.calcFrustration();
            const actualDamage = this.player.takeDamage(damage);

            this.audio.playWrong();

            this.setState(COMBAT_STATES.PLAYER_RESULT, {
                correct: false,
                message: `Wrong! It was ${this.music.getSolfege(this.currentInterval)}. You lose ${actualDamage} energy!`,
                damage: actualDamage,
                correctAnswer: this.currentInterval
            });
        }

        this.scene.time.delayedCall(1200, () => {
            if (this.villager.isHappy()) {
                this.endBattle(true);
            } else if (this.player.hp <= 0) {
                this.endBattle(false);
            } else {
                this.nextTurn();
            }
        });
    }

    // Replay the current interval
    replayInterval() {
        if (this.state !== COMBAT_STATES.PLAYER_IDENTIFY) return;
        const freq = this.music.getIntervalFreq(this.currentInterval);
        this.audio.playInterval(freq, '2n');
    }

    // Note reading phase
    startNoteReadingPhase() {
        this.audio.stopDrone();

        // Use zone to derive a round number for difficulty scaling
        const zoneOrder = ['forest', 'village', 'caves', 'castle', 'underworld', 'tower'];
        const zoneIndex = zoneOrder.indexOf(this.scene.currentZone || 'forest');
        const syntheticRound = Math.max(1, zoneIndex * 5 + this.turnCount);
        const question = this.noteReadingEngine.buildQuestion(syntheticRound, this.clefSetting, this.noteReadingConfig);
        this.pendingNoteQuestion = question;
        this.noteAnswerTime = performance.now();

        this.setState(COMBAT_STATES.NOTE_READING_QUESTION, { question });
    }

    // Player submitted a note name answer
    submitNoteReadingAnswer(noteName) {
        if (this.state !== COMBAT_STATES.NOTE_READING_QUESTION) return;
        const responseTime = performance.now() - (this.noteAnswerTime || performance.now());

        const correct = this.noteReadingEngine.checkAnswer(this.pendingNoteQuestion, noteName);

        if (correct) {
            const speedBonus = Math.max(1, 2 - responseTime / 4000);
            const damage = this.player.calcDamage(speedBonus);
            const actualDamage = this.villager.receiveHelp(damage);
            this.audio.playCorrect();
            this.villager.flashHappy();

            this.setState(COMBAT_STATES.NOTE_READING_RESULT, {
                correct: true,
                message: `Correct! It's ${this.pendingNoteQuestion.correctAnswer}! +${actualDamage} help!`,
                damage: actualDamage,
                correctAnswer: this.pendingNoteQuestion.correctAnswer
            });
        } else {
            const damage = this.villager.calcFrustration();
            const actualDamage = this.player.takeDamage(damage);
            this.audio.playWrong();

            this.setState(COMBAT_STATES.NOTE_READING_RESULT, {
                correct: false,
                message: `Wrong! It was ${this.pendingNoteQuestion.correctAnswer}. You lose ${actualDamage} energy!`,
                damage: actualDamage,
                correctAnswer: this.pendingNoteQuestion.correctAnswer
            });
        }

        this.scene.time.delayedCall(1800, () => {
            if (this.villager.isHappy()) {
                this.endBattle(true);
            } else if (this.player.hp <= 0) {
                this.endBattle(false);
            } else {
                this.nextTurn();
            }
        });
    }

    // Rhythm challenge phase — generates a pattern for the player to recreate
    startRhythmPhase() {
        this.audio.stopDrone();

        // Pick subdivision based on zone difficulty
        const zoneOrder = ['forest', 'village', 'caves', 'castle', 'underworld', 'tower'];
        const zoneIndex = zoneOrder.indexOf(this.scene.currentZone || 'forest');
        const subdivision = zoneIndex >= 3 ? 'eighth' : 'quarter';

        const cells = subdivision === 'quarter' ? 4 : 8;
        const downbeats = subdivision === 'quarter'
            ? [0, 1, 2, 3]
            : [0, 2, 4, 6];

        // Generate random pattern
        const pattern = new Array(cells).fill(false);
        const noteTarget = Math.max(2, Math.floor(cells * (0.3 + Math.random() * 0.4)));
        let noteCount = 0;
        for (let i = 0; i < cells; i++) {
            const isDB = downbeats.includes(i);
            if (Math.random() < (isDB ? 0.75 : 0.4) && noteCount < noteTarget) {
                pattern[i] = true;
                noteCount++;
            }
        }
        pattern[0] = true;
        if (pattern.filter(v => v).length < 2) {
            pattern[Math.floor(cells / 2)] = true;
        }

        this.pendingRhythm = { pattern, subdivision, cells, downbeats };
        this.rhythmAnswerTime = performance.now();

        this.setState(COMBAT_STATES.RHYTHM_QUESTION, {
            message: 'Recreate the rhythm!',
            rhythm: this.pendingRhythm
        });
    }

    // Player submitted a rhythm answer (boolean array)
    submitRhythmAnswer(userGrid) {
        if (this.state !== COMBAT_STATES.RHYTHM_QUESTION) return;
        const responseTime = performance.now() - (this.rhythmAnswerTime || performance.now());

        const { pattern } = this.pendingRhythm;
        let correctCells = 0;
        for (let i = 0; i < pattern.length; i++) {
            const userHit = userGrid[i] > 0;
            if (pattern[i] === userHit) correctCells++;
        }

        const accuracy = correctCells / pattern.length;
        const correct = accuracy >= 0.75; // 75% threshold

        if (correct) {
            const speedBonus = Math.max(1, 2 - responseTime / 8000);
            const accuracyBonus = accuracy >= 1.0 ? 1.5 : 1.0;
            const damage = this.player.calcDamage(speedBonus * accuracyBonus);
            const actualDamage = this.villager.receiveHelp(damage);
            this.audio.playCorrect();
            this.villager.flashHappy();

            const pct = Math.round(accuracy * 100);
            this.setState(COMBAT_STATES.RHYTHM_RESULT, {
                correct: true,
                message: `${pct}% correct! +${actualDamage} help!`,
                damage: actualDamage,
                pattern,
                userGrid
            });
        } else {
            const damage = this.villager.calcFrustration();
            const actualDamage = this.player.takeDamage(damage);
            this.audio.playWrong();

            const pct = Math.round(accuracy * 100);
            this.setState(COMBAT_STATES.RHYTHM_RESULT, {
                correct: false,
                message: `${pct}% — not quite! You lose ${actualDamage} energy!`,
                damage: actualDamage,
                pattern,
                userGrid
            });
        }

        this.scene.time.delayedCall(1800, () => {
            if (this.villager.isHappy()) {
                this.endBattle(true);
            } else if (this.player.hp <= 0) {
                this.endBattle(false);
            } else {
                this.nextTurn();
            }
        });
    }

    endBattle(playerWon) {
        this.audio.stopDrone();

        if (playerWon) {
            this.audio.playVictory();
            this.villager.happyAnimation(() => {});
            this.setState(COMBAT_STATES.VILLAGER_HELPED, {
                message: `${this.villager.name} is happy again!`,
                xp: this.villager.friendship,
                gold: this.villager.gratitude
            });
        } else {
            this.setState(COMBAT_STATES.PLAYER_EXHAUSTED, {
                message: "You're too tired to help..."
            });
        }
    }

    wait(ms) {
        return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
    }
}
