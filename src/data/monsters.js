// Monster definitions — kid-friendly fantasy/nature roster
// Removed: fireSkull, vampire, witch, demon, hellBeast, nightmare, caveHag, tormentedSoul, towerWraith
export const MONSTERS = {

    // ── FOREST ───────────────────────────────────────────────────────────────
    slime: {
        name: 'Slime',
        zone: 'forest',
        hp: 45, attack: 8, defense: 3, xp: 10, gold: 5,
        spriteKey: 'slime', facesRight: true,
        frameWidth: 118, frameHeight: 79, frameCount: 4,
        preferredIntervals: ['1', '3', '5'],
        enemyType: 'tone',
        description: 'A wobbly green slime.'
    },
    glowWisp: {
        name: 'Glow Wisp',
        zone: 'forest',
        hp: 48, attack: 9, defense: 3, xp: 15, gold: 8,
        spriteKey: 'glowWisp', facesRight: true,
        frameWidth: 48, frameHeight: 48, frameCount: 8,
        preferredIntervals: ['1', '3', '5'],
        enemyType: 'noteReading',
        description: 'A glowing wisp that spells out notes in light.'
    },
    mutantToad: {
        name: 'Magic Toad',
        zone: 'forest',
        hp: 58, attack: 12, defense: 3, xp: 18, gold: 9,
        spriteKey: 'mutantToad', facesRight: true,
        frameWidth: 80, frameHeight: 64, frameCount: 4,
        preferredIntervals: ['1', '3', '5'],
        enemyType: 'rhythm',
        description: 'A plump toad that croaks in rhythmic patterns.'
    },
    frog: {
        name: 'Giant Frog',
        zone: 'forest',
        hp: 85, attack: 16, defense: 5, xp: 25, gold: 14,
        spriteKey: 'frog', facesRight: false,
        frameWidth: 63, frameHeight: 68, frameCount: 6,
        preferredIntervals: ['3', '5'],
        isBoss: true,
        enemyType: 'mixed',
        description: 'A massive frog that tests all your music skills.'
    },

    // ── VILLAGE ──────────────────────────────────────────────────────────────
    wanderingBard: {
        name: 'Wandering Bard',
        zone: 'village',
        hp: 72, attack: 15, defense: 5, xp: 24, gold: 12,
        spriteKey: 'wanderingBard', facesRight: false,
        frameWidth: 112, frameHeight: 144, frameCount: 4,
        preferredIntervals: ['2', '3', '6'],
        enemyType: 'tone',
        description: 'A cheerful bard who plays mysterious intervals.'
    },
    toadVillage: {
        name: 'River Toad',
        zone: 'village',
        hp: 68, attack: 15, defense: 4, xp: 22, gold: 11,
        spriteKey: 'mutantToad', facesRight: true,
        frameWidth: 80, frameHeight: 64, frameCount: 4,
        preferredIntervals: ['2', '4'],
        enemyType: 'rhythm',
        description: 'A river toad who drums in rhythmic patterns.'
    },
    scrollKeeper: {
        name: 'Scroll Keeper',
        zone: 'village',
        hp: 100, attack: 18, defense: 8, xp: 35, gold: 18,
        spriteKey: 'scrollKeeper', facesRight: false,
        frameWidth: 64, frameHeight: 80, frameCount: 7,
        preferredIntervals: ['2', '4', '5'],
        isBoss: true,
        enemyType: 'mixed',
        description: 'A keeper of ancient musical scrolls — tests all skills.'
    },

    // ── CRYSTAL CAVES ────────────────────────────────────────────────────────
    hellHound: {
        name: 'Flame Hound',
        zone: 'caves',
        hp: 85, attack: 20, defense: 6, xp: 32, gold: 16,
        spriteKey: 'hellHound', facesRight: false,
        frameWidth: 64, frameHeight: 48, frameCount: 11,
        preferredIntervals: ['b3', 'b7'],
        enemyType: 'tone',
        description: 'A fiery hound with a haunting howl.'
    },
    shadowCrow: {
        name: 'Shadow Crow',
        zone: 'caves',
        hp: 65, attack: 16, defense: 5, xp: 28, gold: 13,
        spriteKey: 'shadowCrow', facesRight: false,
        frameWidth: 48, frameHeight: 48, frameCount: 3,
        preferredIntervals: ['b3', 'b7'],
        enemyType: 'rhythm',
        description: 'A clever crow that taps out rhythmic patterns.'
    },
    ogre: {
        name: 'Ogre',
        zone: 'caves',
        hp: 130, attack: 24, defense: 11, xp: 45, gold: 24,
        spriteKey: 'ogre', facesRight: false,
        frameWidth: 144, frameHeight: 80, frameCount: 4,
        preferredIntervals: ['b3', '5', 'b7'],
        isBoss: true,
        enemyType: 'mixed',
        description: 'A cave ogre who tests all your music skills.'
    },

    // ── MAGIC CASTLE ─────────────────────────────────────────────────────────
    guardCaptain: {
        name: 'Guard Captain',
        zone: 'castle',
        hp: 105, attack: 26, defense: 10, xp: 50, gold: 26,
        spriteKey: 'guardCaptain', facesRight: false,
        frameWidth: 80, frameHeight: 84, frameCount: 4,
        preferredIntervals: ['4', '5', '6'],
        enemyType: 'noteReading',
        description: 'A castle guard who reads sheet music with precision.'
    },
    crowCastle: {
        name: 'Tower Crow',
        zone: 'castle',
        hp: 80, attack: 20, defense: 6, xp: 36, gold: 18,
        spriteKey: 'shadowCrow', facesRight: false,
        frameWidth: 48, frameHeight: 48, frameCount: 3,
        preferredIntervals: ['6', 'b7', '7'],
        enemyType: 'rhythm',
        description: 'A crow who taps out rhythms on the battlements.'
    },
    guardCaptainBoss: {
        name: 'Guard Commander',
        zone: 'castle',
        hp: 170, attack: 32, defense: 14, xp: 70, gold: 38,
        spriteKey: 'guardCaptain', facesRight: false,
        frameWidth: 80, frameHeight: 84, frameCount: 4,
        preferredIntervals: ['4', '5', '6', '7'],
        isBoss: true,
        enemyType: 'mixed',
        description: 'The commander of the castle guard — tests all skills.'
    },

    // ── DRAGON'S LAIR (underworld) ────────────────────────────────────────────
    flameHoundLair: {
        name: 'Lava Hound',
        zone: 'underworld',
        hp: 115, attack: 28, defense: 11, xp: 58, gold: 30,
        spriteKey: 'hellHound', facesRight: false,
        frameWidth: 64, frameHeight: 48, frameCount: 11,
        preferredIntervals: ['b2', 'b6'],
        enemyType: 'tone',
        description: 'A hound born from the lava flows.'
    },
    crowLair: {
        name: 'Ember Crow',
        zone: 'underworld',
        hp: 95, attack: 23, defense: 8, xp: 46, gold: 24,
        spriteKey: 'shadowCrow', facesRight: false,
        frameWidth: 48, frameHeight: 48, frameCount: 3,
        preferredIntervals: ['b2', 'b6', 'b7'],
        enemyType: 'rhythm',
        description: 'A crow that drums fiery rhythms with its talons.'
    },
    flameHoundBoss: {
        name: 'Flame Lord',
        zone: 'underworld',
        hp: 210, attack: 40, defense: 18, xp: 90, gold: 48,
        spriteKey: 'hellHound', facesRight: false,
        frameWidth: 64, frameHeight: 48, frameCount: 11,
        preferredIntervals: ['b2', 'b6', 'b7'],
        isBoss: true,
        enemyType: 'mixed',
        description: 'The mighty lord of flame — tests all music skills.'
    },

    // ── SKY TOWER ─────────────────────────────────────────────────────────────
    crowTower: {
        name: 'Sky Crow',
        zone: 'tower',
        hp: 125, attack: 32, defense: 11, xp: 65, gold: 34,
        spriteKey: 'shadowCrow', facesRight: false,
        frameWidth: 48, frameHeight: 48, frameCount: 3,
        preferredIntervals: ['#4', 'b2', 'b6'],
        enemyType: 'rhythm',
        description: 'A crow that taps complex rhythms at the tower\'s peak.'
    },
    guardTower: {
        name: 'Tower Guard',
        zone: 'tower',
        hp: 135, attack: 34, defense: 13, xp: 70, gold: 36,
        spriteKey: 'guardCaptain', facesRight: false,
        frameWidth: 80, frameHeight: 84, frameCount: 4,
        preferredIntervals: ['#4', 'b7'],
        enemyType: 'noteReading',
        description: 'An elite guard defending the final tower.'
    },
    werewolf: {
        name: 'Werewolf',
        zone: 'tower',
        hp: 250, attack: 50, defense: 20, xp: 160, gold: 80,
        spriteKey: 'werewolf', facesRight: true,
        frameWidth: 96, frameHeight: 76, frameCount: 5,
        preferredIntervals: ['#4', 'b2', 'b6', 'b7'],
        isBoss: true,
        enemyType: 'mixed',
        description: 'The tritone master — tests all music skills.'
    }
};
