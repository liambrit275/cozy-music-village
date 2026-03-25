// Shared constants used across challenge mixins and ChallengeScene.

// Difficulty tiers for tone challenges
export const TONES_TIERS = [
    { minRound: 1,  degrees: ['1', '3', '5'] },
    { minRound: 6,  degrees: ['1', '2', '3', '4', '5'] },
    { minRound: 11, degrees: ['1', '2', 'b3', '3', '4', '5', 'b7'] },
    { minRound: 16, degrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'] },
    { minRound: 21, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7'] },
    { minRound: 26, degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] },
];

// Keyboard note mapping
export const _SEMI_TO_NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const _NOTE_TO_SEMI = { C:0, Db:1, D:2, Eb:3, E:4, F:5, 'F#':6, G:7, Ab:8, A:9, Bb:10, B:11 };
export const _WHITE_NOTES = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

// Layout constants
export const GROUND_Y = 480;
export const PLAYER_X = 120;
