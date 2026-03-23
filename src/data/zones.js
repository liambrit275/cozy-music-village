// Zone definitions — kid-friendly names, side-scroll level layouts
export const ZONES = {
    forest: {
        name: 'Enchanted Forest',
        key: 'forest',
        order: 0,
        scaleDegrees: ['1', '3', '5'],
        bgColor: '#1a150e',
        groundColor: 0x2a3a1a,
        groundAccentColor: 0x1a2a10,
        backgroundKey: 'bg-forest',
        villagers: ['melody', 'flicker', 'clover'],
        specialVillager: 'daisy',
        requiredLevel: 0,
        nextZone: 'village',
        description: 'Learn the major triad: Do, Mi, Sol',
        levelVillagers: [
            { key: 'melody',     x: 650,  wanderRange: 130 },
            { key: 'flicker',    x: 1200, wanderRange: 100 },
            { key: 'clover',  x: 1900, wanderRange: 140 },
            { key: 'melody',     x: 2500, wanderRange: 130 },
            { key: 'flicker',    x: 3100, wanderRange: 100 }
        ],
        specialX: 4200
    },
    village: {
        name: 'Sunny Village',
        key: 'village',
        order: 1,
        scaleDegrees: ['1', '2', '3', '4', '5'],
        bgColor: '#1a150e',
        groundColor: 0x2a3a1a,
        groundAccentColor: 0x1a2a10,
        backgroundKey: 'bg-village',
        villagers: ['pippin', 'puddle'],
        specialVillager: 'greta',
        requiredLevel: 3,
        nextZone: 'caves',
        description: 'Add Re and Fa for pentatonic territory',
        levelVillagers: [
            { key: 'pippin', x: 650,  wanderRange: 150 },
            { key: 'puddle',    x: 1250, wanderRange: 130 },
            { key: 'pippin', x: 1950, wanderRange: 150 },
            { key: 'puddle',    x: 2600, wanderRange: 130 },
            { key: 'pippin', x: 3200, wanderRange: 150 }
        ],
        specialX: 4200
    },
    caves: {
        name: 'Crystal Caves',
        key: 'caves',
        order: 2,
        scaleDegrees: ['1', '2', 'b3', '3', '4', '5', 'b7'],
        bgColor: '#1a150e',
        groundColor: 0x2a2a2a,
        groundAccentColor: 0x1a1a2a,
        backgroundKey: 'bg-caves',
        villagers: ['bramble', 'pebble'],
        specialVillager: 'buttercup',
        requiredLevel: 6,
        nextZone: 'castle',
        description: 'Discover minor and dominant sounds: Me, Te',
        levelVillagers: [
            { key: 'bramble', x: 650,  wanderRange: 150 },
            { key: 'pebble',   x: 1200, wanderRange: 110 },
            { key: 'bramble', x: 1900, wanderRange: 150 },
            { key: 'pebble',   x: 2500, wanderRange: 110 },
            { key: 'bramble', x: 3200, wanderRange: 150 }
        ],
        specialX: 4200
    },
    castle: {
        name: 'Magic Castle',
        key: 'castle',
        order: 3,
        scaleDegrees: ['1', '2', 'b3', '3', '4', '5', '6', 'b7', '7'],
        bgColor: '#1a150e',
        groundColor: 0x2a2a3a,
        groundAccentColor: 0x1a1a2a,
        backgroundKey: 'bg-castle',
        villagers: ['duchess', 'cricket'],
        specialVillager: 'barnaby',
        requiredLevel: 10,
        nextZone: 'underworld',
        description: 'Complete the major scale with La and Ti',
        levelVillagers: [
            { key: 'duchess',  x: 650,  wanderRange: 150 },
            { key: 'cricket',  x: 1200, wanderRange: 110 },
            { key: 'duchess',  x: 1950, wanderRange: 150 },
            { key: 'cricket',  x: 2550, wanderRange: 110 },
            { key: 'duchess',  x: 3200, wanderRange: 150 }
        ],
        specialX: 4200
    },
    underworld: {
        name: 'Mystic Hollow',
        key: 'underworld',
        order: 4,
        scaleDegrees: ['1', 'b2', '2', 'b3', '3', '4', '5', 'b6', '6', 'b7', '7'],
        bgColor: '#1a150e',
        groundColor: 0x2a1a2a,
        groundAccentColor: 0x1a1020,
        backgroundKey: 'bg-underworld',
        villagers: ['ember', 'cinder'],
        specialVillager: 'magnolia',
        requiredLevel: 14,
        nextZone: 'tower',
        description: 'Face the dark intervals: Ra and Le',
        levelVillagers: [
            { key: 'ember',   x: 650,  wanderRange: 150 },
            { key: 'cinder',   x: 1200, wanderRange: 110 },
            { key: 'ember',   x: 1950, wanderRange: 150 },
            { key: 'cinder',   x: 2550, wanderRange: 110 },
            { key: 'ember',   x: 3200, wanderRange: 150 }
        ],
        specialX: 4200
    },
    tower: {
        name: 'Sky Tower',
        key: 'tower',
        order: 5,
        scaleDegrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'],
        bgColor: '#1a150e',
        groundColor: 0x2a2a3a,
        groundAccentColor: 0x1a1a30,
        backgroundKey: 'bg-tower',
        villagers: ['breeze', 'woolsworth'],
        specialVillager: 'clementine',
        requiredLevel: 18,
        nextZone: null,
        description: 'Master all 12 scale degrees with the tritone: Fi',
        levelVillagers: [
            { key: 'breeze',      x: 650,  wanderRange: 120 },
            { key: 'woolsworth',  x: 1250, wanderRange: 150 },
            { key: 'breeze',      x: 1900, wanderRange: 120 },
            { key: 'woolsworth',  x: 2550, wanderRange: 150 },
            { key: 'breeze',      x: 3200, wanderRange: 120 }
        ],
        specialX: 4200
    }
};

export const ZONE_ORDER = ['forest', 'village', 'caves', 'castle', 'underworld', 'tower'];
