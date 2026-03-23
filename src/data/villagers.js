// Villager definitions — cozy farm/town animals who need musical help
// Mirrors the MONSTERS structure with renamed fields:
//   hp→helpNeeded, attack→patience, defense→shyness, xp→friendship,
//   gold→gratitude, enemyType→needsHelpWith, preferredIntervals→troubleIntervals, isBoss→isSpecial
export const VILLAGERS = {

    // ── FOREST ───────────────────────────────────────────────────────────────
    melody: {
        name: 'Melody',
        zone: 'forest',
        helpNeeded: 45, patience: 8, shyness: 3, friendship: 10, gratitude: 5,
        spriteKey: 'villager-bunny', facesRight: true,
        frameWidth: 17, frameHeight: 17, frameCount: 4,
        troubleIntervals: ['1', '3', '5'],
        needsHelpWith: 'tone',
        description: 'A sweet bunny who can\'t quite remember Do-Mi-Sol.'
    },
    flicker: {
        name: 'Flicker',
        zone: 'forest',
        helpNeeded: 48, patience: 9, shyness: 3, friendship: 15, gratitude: 8,
        spriteKey: 'villager-robin', facesRight: true,
        frameWidth: 16, frameHeight: 16, frameCount: 4,
        troubleIntervals: ['1', '3', '5'],
        needsHelpWith: 'noteReading',
        description: 'A chirpy robin who mixes up notes on the staff.'
    },
    clover: {
        name: 'Clover',
        zone: 'forest',
        helpNeeded: 58, patience: 12, shyness: 3, friendship: 18, gratitude: 9,
        spriteKey: 'villager-squirrel', facesRight: true,
        frameWidth: 19, frameHeight: 19, frameCount: 6,
        troubleIntervals: ['1', '3', '5'],
        needsHelpWith: 'rhythm',
        description: 'A bushy-tailed squirrel who taps acorns off-beat.'
    },
    daisy: {
        name: 'Daisy',
        zone: 'forest',
        helpNeeded: 85, patience: 16, shyness: 5, friendship: 25, gratitude: 14,
        spriteKey: 'villager-cow', facesRight: false,
        frameWidth: 24, frameHeight: 24, frameCount: 4,
        troubleIntervals: ['3', '5'],
        isSpecial: true,
        needsHelpWith: 'mixed',
        description: 'A gentle cow who needs help with all sorts of music puzzles.'
    },

    // ── VILLAGE ──────────────────────────────────────────────────────────────
    pippin: {
        name: 'Pippin',
        zone: 'village',
        helpNeeded: 72, patience: 15, shyness: 5, friendship: 24, gratitude: 12,
        spriteKey: 'villager-chicken', facesRight: false,
        frameWidth: 16, frameHeight: 16, frameCount: 4,
        troubleIntervals: ['2', '3', '6'],
        needsHelpWith: 'tone',
        description: 'A plucky chicken who clucks intervals slightly off.'
    },
    puddle: {
        name: 'Puddle',
        zone: 'village',
        helpNeeded: 68, patience: 15, shyness: 4, friendship: 22, gratitude: 11,
        spriteKey: 'villager-pig', facesRight: true,
        frameWidth: 20, frameHeight: 20, frameCount: 4,
        troubleIntervals: ['2', '4'],
        needsHelpWith: 'rhythm',
        description: 'A cheerful piglet who stomps out rhythms in the mud.'
    },
    greta: {
        name: 'Greta',
        zone: 'village',
        helpNeeded: 100, patience: 18, shyness: 8, friendship: 35, gratitude: 18,
        spriteKey: 'villager-turkey', facesRight: false,
        frameWidth: 17, frameHeight: 17, frameCount: 4,
        troubleIntervals: ['2', '4', '5'],
        isSpecial: true,
        needsHelpWith: 'mixed',
        description: 'A proud turkey who wants to master every musical skill.'
    },

    // ── CRYSTAL CAVES ────────────────────────────────────────────────────────
    bramble: {
        name: 'Bramble',
        zone: 'caves',
        helpNeeded: 85, patience: 20, shyness: 6, friendship: 32, gratitude: 16,
        spriteKey: 'villager-goat', facesRight: false,
        frameWidth: 19, frameHeight: 19, frameCount: 4,
        troubleIntervals: ['b3', 'b7'],
        needsHelpWith: 'tone',
        description: 'A curious goat who echoes minor intervals off the cave walls.'
    },
    pebble: {
        name: 'Pebble',
        zone: 'caves',
        helpNeeded: 65, patience: 16, shyness: 5, friendship: 28, gratitude: 13,
        spriteKey: 'villager-rat', facesRight: false,
        frameWidth: 18, frameHeight: 18, frameCount: 4,
        troubleIntervals: ['b3', 'b7'],
        needsHelpWith: 'rhythm',
        description: 'A tiny rat who taps pebbles in the dark — but loses the beat.'
    },
    buttercup: {
        name: 'Buttercup',
        zone: 'caves',
        helpNeeded: 130, patience: 24, shyness: 11, friendship: 45, gratitude: 24,
        spriteKey: 'villager-cow', facesRight: false,
        frameWidth: 24, frameHeight: 24, frameCount: 4,
        troubleIntervals: ['b3', '5', 'b7'],
        isSpecial: true,
        needsHelpWith: 'mixed',
        description: 'A shy cave cow who really wants to learn all her intervals.'
    },

    // ── MAGIC CASTLE ─────────────────────────────────────────────────────────
    duchess: {
        name: 'Duchess',
        zone: 'castle',
        helpNeeded: 105, patience: 26, shyness: 10, friendship: 50, gratitude: 26,
        spriteKey: 'villager-sheep', facesRight: false,
        frameWidth: 17, frameHeight: 17, frameCount: 4,
        troubleIntervals: ['4', '5', '6'],
        needsHelpWith: 'noteReading',
        description: 'A fluffy sheep who squints at the sheet music on the castle wall.'
    },
    cricket: {
        name: 'Cricket',
        zone: 'castle',
        helpNeeded: 80, patience: 20, shyness: 6, friendship: 36, gratitude: 18,
        spriteKey: 'villager-robin', facesRight: false,
        frameWidth: 16, frameHeight: 16, frameCount: 4,
        troubleIntervals: ['6', 'b7', '7'],
        needsHelpWith: 'rhythm',
        description: 'A castle robin who trills rhythms from the turret.'
    },
    barnaby: {
        name: 'Barnaby',
        zone: 'castle',
        helpNeeded: 170, patience: 32, shyness: 14, friendship: 70, gratitude: 38,
        spriteKey: 'villager-turkey', facesRight: false,
        frameWidth: 17, frameHeight: 17, frameCount: 4,
        troubleIntervals: ['4', '5', '6', '7'],
        isSpecial: true,
        needsHelpWith: 'mixed',
        description: 'The castle\'s grand turkey who struts through every musical challenge.'
    },

    // ── DRAGON'S LAIR (underworld) ────────────────────────────────────────────
    ember: {
        name: 'Ember',
        zone: 'underworld',
        helpNeeded: 115, patience: 28, shyness: 11, friendship: 58, gratitude: 30,
        spriteKey: 'villager-goat', facesRight: false,
        frameWidth: 19, frameHeight: 19, frameCount: 4,
        troubleIntervals: ['b2', 'b6'],
        needsHelpWith: 'tone',
        description: 'A warm-hearted goat who hums lullabies in the deep caverns.'
    },
    cinder: {
        name: 'Cinder',
        zone: 'underworld',
        helpNeeded: 95, patience: 23, shyness: 8, friendship: 46, gratitude: 24,
        spriteKey: 'villager-rat', facesRight: false,
        frameWidth: 18, frameHeight: 18, frameCount: 4,
        troubleIntervals: ['b2', 'b6', 'b7'],
        needsHelpWith: 'rhythm',
        description: 'A brave little rat tapping out rhythms by the glow of embers.'
    },
    magnolia: {
        name: 'Magnolia',
        zone: 'underworld',
        helpNeeded: 210, patience: 40, shyness: 18, friendship: 90, gratitude: 48,
        spriteKey: 'villager-cow', facesRight: false,
        frameWidth: 24, frameHeight: 24, frameCount: 4,
        troubleIntervals: ['b2', 'b6', 'b7'],
        isSpecial: true,
        needsHelpWith: 'mixed',
        description: 'A majestic cow who dreams of mastering every melody underground.'
    },

    // ── SKY TOWER ─────────────────────────────────────────────────────────────
    breeze: {
        name: 'Breeze',
        zone: 'tower',
        helpNeeded: 125, patience: 32, shyness: 11, friendship: 65, gratitude: 34,
        spriteKey: 'villager-robin', facesRight: false,
        frameWidth: 16, frameHeight: 16, frameCount: 4,
        troubleIntervals: ['#4', 'b2', 'b6'],
        needsHelpWith: 'rhythm',
        description: 'A high-flying robin who whistles tricky rhythms in the wind.'
    },
    woolsworth: {
        name: 'Woolsworth',
        zone: 'tower',
        helpNeeded: 135, patience: 34, shyness: 13, friendship: 70, gratitude: 36,
        spriteKey: 'villager-sheep', facesRight: false,
        frameWidth: 17, frameHeight: 17, frameCount: 4,
        troubleIntervals: ['#4', 'b7'],
        needsHelpWith: 'noteReading',
        description: 'A scholarly sheep perched at the tower library, reading scores.'
    },
    clementine: {
        name: 'Clementine',
        zone: 'tower',
        helpNeeded: 250, patience: 50, shyness: 20, friendship: 160, gratitude: 80,
        spriteKey: 'villager-bunny', facesRight: true,
        frameWidth: 17, frameHeight: 17, frameCount: 4,
        troubleIntervals: ['#4', 'b2', 'b6', 'b7'],
        isSpecial: true,
        needsHelpWith: 'mixed',
        description: 'The legendary bunny of the Sky Tower — needs help with every interval.'
    }
};
