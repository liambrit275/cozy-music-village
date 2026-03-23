// Playable character definitions for CharacterSelectScene and SidescrollScene

export const CHARACTERS = {
    knight: {
        key: 'knight',
        displayName: 'Knight',
        description: 'A noble warrior with a powerful sword slash.',
        color: '#aaccff',
        spriteKeys: {
            idle:   'knight-idle',
            run:    'knight-run',
            jump:   'knight-jump',
            attack: 'knight-attack',
            hurt:   'knight-hurt'
        },
        frameConfig: { width: 128, height: 96 },
        animFrames: {
            idle:   { start: 0, end: 3,  rate: 6,  repeat: -1 },
            run:    { start: 0, end: 7,  rate: 12, repeat: -1 },
            jump:   { start: 0, end: 3,  rate: 8,  repeat: 0  },
            attack: { start: 0, end: 5,  rate: 12, repeat: 0  },
            hurt:   { start: 0, end: 2,  rate: 8,  repeat: 0  }
        }
    },
    adventurer: {
        key: 'adventurer',
        displayName: 'Adventurer',
        description: 'A quick explorer with a magical blade and light armour.',
        color: '#ffcc66',
        spriteKeys: {
            idle:   'adventurer-idle',
            run:    'adventurer-run',
            jump:   'adventurer-jump',
            attack: 'adventurer-attack',
            hurt:   'adventurer-idle'   // no dedicated hurt — reuse idle
        },
        frameConfig: { width: 128, height: 96 },
        animFrames: {
            idle:   { start: 0, end: 3,  rate: 8,  repeat: -1 },
            run:    { start: 0, end: 7,  rate: 12, repeat: -1 },
            jump:   { start: 0, end: 2,  rate: 8,  repeat: 0  },
            attack: { start: 0, end: 7,  rate: 12, repeat: 0  },
            hurt:   { start: 0, end: 1,  rate: 8,  repeat: 0  }
        }
    }
};

export const CHARACTER_ORDER = ['knight', 'adventurer'];
