// Playable character definitions for CharacterSelectScene and SidescrollScene
// Uses Cozy Character v.2 spritesheets (32×32, 8 frames per direction)

export const CHARACTERS = {
    char1: {
        key: 'char1',
        displayName: 'Melody',
        description: 'A cheerful musician who loves helping villagers with songs.',
        color: '#ffcc66',
        spriteKeys: {
            idle:      'player-char1',
            walkDown:  'player-char1',
            walkRight: 'player-char1',
            walkUp:    'player-char1',
            walkLeft:  'player-char1'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char2: {
        key: 'char2',
        displayName: 'Harmony',
        description: 'A gentle soul with a gift for hearing intervals.',
        color: '#88ccff',
        spriteKeys: {
            idle:      'player-char2',
            walkDown:  'player-char2',
            walkRight: 'player-char2',
            walkUp:    'player-char2',
            walkLeft:  'player-char2'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char3: {
        key: 'char3',
        displayName: 'Cadence',
        description: 'An adventurous explorer who taps rhythms everywhere.',
        color: '#ff88aa',
        spriteKeys: {
            idle:      'player-char3',
            walkDown:  'player-char3',
            walkRight: 'player-char3',
            walkUp:    'player-char3',
            walkLeft:  'player-char3'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char4: {
        key: 'char4',
        displayName: 'Tempo',
        description: 'A quick-footed friend who keeps perfect time.',
        color: '#88ff88',
        spriteKeys: {
            idle:      'player-char4',
            walkDown:  'player-char4',
            walkRight: 'player-char4',
            walkUp:    'player-char4',
            walkLeft:  'player-char4'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char5: {
        key: 'char5',
        displayName: 'Lyric',
        description: 'A dreamy poet who reads music like a story.',
        color: '#cc88ff',
        spriteKeys: {
            idle:      'player-char5',
            walkDown:  'player-char5',
            walkRight: 'player-char5',
            walkUp:    'player-char5',
            walkLeft:  'player-char5'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char6: {
        key: 'char6',
        displayName: 'Forte',
        description: 'A bold traveler whose music echoes through the hills.',
        color: '#ffaa44',
        spriteKeys: {
            idle:      'player-char6',
            walkDown:  'player-char6',
            walkRight: 'player-char6',
            walkUp:    'player-char6',
            walkLeft:  'player-char6'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char7: {
        key: 'char7',
        displayName: 'Aria',
        description: 'A calm presence who soothes animals with melodies.',
        color: '#66ccaa',
        spriteKeys: {
            idle:      'player-char7',
            walkDown:  'player-char7',
            walkRight: 'player-char7',
            walkUp:    'player-char7',
            walkLeft:  'player-char7'
        },
        frameConfig: { width: 32, height: 32 }
    },
    char8: {
        key: 'char8',
        displayName: 'Clef',
        description: 'A studious musician who can sight-read anything.',
        color: '#ffcc88',
        spriteKeys: {
            idle:      'player-char8',
            walkDown:  'player-char8',
            walkRight: 'player-char8',
            walkUp:    'player-char8',
            walkLeft:  'player-char8'
        },
        frameConfig: { width: 32, height: 32 }
    }
};

export const CHARACTER_ORDER = ['char1', 'char2', 'char3', 'char4', 'char5', 'char6', 'char7', 'char8'];
