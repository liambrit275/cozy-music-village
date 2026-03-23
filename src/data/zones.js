// Zone definitions — kid-friendly names, side-scroll level layouts
export const ZONES = {
    forest: {
        name: 'Enchanted Forest',
        key: 'forest',
        order: 0,
        scaleDegrees: ['1', '3', '5'],
        bgColor: '#000000',
        groundColor: 0x111111,
        groundAccentColor: 0x222222,
        backgroundKey: 'bg-forest',
        monsters: ['slime', 'glowWisp', 'mutantToad'],
        bossMonster: 'frog',
        requiredLevel: 0,
        nextZone: 'village',
        description: 'Learn the major triad: Do, Mi, Sol',
        levelEnemies: [
            { key: 'slime',      x: 650,  patrolRange: 130 },
            { key: 'glowWisp',   x: 1200, patrolRange: 100 },
            { key: 'mutantToad', x: 1900, patrolRange: 140 },
            { key: 'slime',      x: 2500, patrolRange: 130 },
            { key: 'glowWisp',   x: 3100, patrolRange: 100 }
        ],
        bossX: 4200
    },
    village: {
        name: 'Sunny Village',
        key: 'village',
        order: 1,
        scaleDegrees: ['1', '2', '3', '4', '5'],
        bgColor: '#000000',
        groundColor: 0x111111,
        groundAccentColor: 0x222222,
        backgroundKey: 'bg-village',
        monsters: ['wanderingBard', 'toadVillage'],
        bossMonster: 'scrollKeeper',
        requiredLevel: 3,
        nextZone: 'caves',
        description: 'Add Re and Fa for pentatonic territory',
        levelEnemies: [
            { key: 'wanderingBard', x: 650,  patrolRange: 150 },
            { key: 'toadVillage',   x: 1250, patrolRange: 130 },
            { key: 'wanderingBard', x: 1950, patrolRange: 150 },
            { key: 'toadVillage',   x: 2600, patrolRange: 130 },
            { key: 'wanderingBard', x: 3200, patrolRange: 150 }
        ],
        bossX: 4200
    },
    caves: {
        name: 'Crystal Caves',
        key: 'caves',
        order: 2,
        scaleDegrees: ['1', '2', 'b3', '3', '4', '5', 'b7'],
        bgColor: '#000000',
        groundColor: 0x111111,
        groundAccentColor: 0x222222,
        backgroundKey: 'bg-caves',
        monsters: ['hellHound', 'shadowCrow'],
        bossMonster: 'ogre',
        requiredLevel: 6,
        nextZone: 'castle',
        description: 'Discover minor and dominant sounds: Me, Te',
        levelEnemies: [
            { key: 'hellHound',  x: 650,  patrolRange: 150 },
            { key: 'shadowCrow', x: 1200, patrolRange: 110 },
            { key: 'hellHound',  x: 1900, patrolRange: 150 },
            { key: 'shadowCrow', x: 2500, patrolRange: 110 },
            { key: 'hellHound',  x: 3200, patrolRange: 150 }
        ],
        bossX: 4200
    },
    castle: {
        name: 'Magic Castle',
        key: 'castle',
        order: 3,
        scaleDegrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'],
        bgColor: '#000000',
        groundColor: 0x111111,
        groundAccentColor: 0x222222,
        backgroundKey: 'bg-castle',
        monsters: ['guardCaptain', 'crowCastle'],
        bossMonster: 'guardCaptainBoss',
        requiredLevel: 10,
        nextZone: 'underworld',
        description: 'Complete the major scale with La and Ti',
        levelEnemies: [
            { key: 'guardCaptain', x: 650,  patrolRange: 150 },
            { key: 'crowCastle',   x: 1200, patrolRange: 110 },
            { key: 'guardCaptain', x: 1950, patrolRange: 150 },
            { key: 'crowCastle',   x: 2550, patrolRange: 110 },
            { key: 'guardCaptain', x: 3200, patrolRange: 150 }
        ],
        bossX: 4200
    },
    underworld: {
        name: "Dragon's Lair",
        key: 'underworld',
        order: 4,
        scaleDegrees: ['1', 'b2', '2', 'b3', '3', '4', '5', 'b6', '6', 'b7', '7'],
        bgColor: '#000000',
        groundColor: 0x111111,
        groundAccentColor: 0x222222,
        backgroundKey: 'bg-underworld',
        monsters: ['flameHoundLair', 'crowLair'],
        bossMonster: 'flameHoundBoss',
        requiredLevel: 14,
        nextZone: 'tower',
        description: 'Face the dark intervals: Ra and Le',
        levelEnemies: [
            { key: 'flameHoundLair', x: 650,  patrolRange: 150 },
            { key: 'crowLair',       x: 1200, patrolRange: 110 },
            { key: 'flameHoundLair', x: 1950, patrolRange: 150 },
            { key: 'crowLair',       x: 2550, patrolRange: 110 },
            { key: 'flameHoundLair', x: 3200, patrolRange: 150 }
        ],
        bossX: 4200
    },
    tower: {
        name: 'Sky Tower',
        key: 'tower',
        order: 5,
        scaleDegrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'],
        bgColor: '#000000',
        groundColor: 0x111111,
        groundAccentColor: 0x222222,
        backgroundKey: 'bg-tower',
        monsters: ['crowTower', 'guardTower'],
        bossMonster: 'werewolf',
        requiredLevel: 18,
        nextZone: null,
        description: 'Master all 12 scale degrees with the tritone: Fi',
        levelEnemies: [
            { key: 'crowTower',   x: 650,  patrolRange: 120 },
            { key: 'guardTower',  x: 1250, patrolRange: 150 },
            { key: 'crowTower',   x: 1900, patrolRange: 120 },
            { key: 'guardTower',  x: 2550, patrolRange: 150 },
            { key: 'crowTower',   x: 3200, patrolRange: 120 }
        ],
        bossX: 4200
    }
};

export const ZONE_ORDER = ['forest', 'village', 'caves', 'castle', 'underworld', 'tower'];
