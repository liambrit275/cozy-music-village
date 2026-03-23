// World Map data — 4 regions, 1 boss location each.
// Each region has a sunny animal to rescue and a boss monster to defeat.

export const WORLD_REGIONS = [
    {
        id: 'meadow',
        label: 'Meadow Woods',
        subtitle: 'Major Triad',
        color: 0x2a6e3a,
        textColor: '#6ddc8b',
        iconGlyph: '♪',
        zoneKey: 'forest',
        backgroundKey: 'bg-forest',
        description: 'Learn the three notes that make a happy chord: Do, Mi, Sol.',
        animalKey: 'sunny-bunny',
        animalName: 'Bunny',
        animalAnimKey: 'sunny-bunny-idle',
        animalScale: 2.5,
        location: {
            id: 'meadow_boss',
            name: 'Meadow Boss',
            subtitle: 'Rescue Bunny!',
            bossMonster: 'frog',
            tutorialTitle: 'The Major Triad',
            tutorialBody: 'Every major chord is built from three notes: Do, Mi, and Sol — scale degrees 1, 3, and 5. These three notes define the "happy" sound of major harmony.\n\nA drone (root note) will play continuously. Your job is to identify which degree you hear on top of it.',
            tutorialMnemonic: null,
            tutorialPreview: 'You will identify: Do  Mi  Sol',
            arcadeConfig: {
                mode: 'tones',
                scaleDegrees: ['1', '3', '5'],
            },
        },
    },
    {
        id: 'village',
        label: 'Sunny Village',
        subtitle: 'Full Major Scale',
        color: 0x6e5a2a,
        textColor: '#eebb55',
        iconGlyph: '🎵',
        zoneKey: 'village',
        backgroundKey: 'bg-village',
        description: 'Master all seven notes of the major scale.',
        animalKey: 'sunny-froggy',
        animalName: 'Froggy',
        animalAnimKey: 'sunny-froggy-idle',
        animalScale: 2.5,
        location: {
            id: 'village_boss',
            name: 'Village Boss',
            subtitle: 'Rescue Froggy!',
            bossMonster: 'scrollKeeper',
            tutorialTitle: 'The Major Scale',
            tutorialBody: 'The major scale has 7 notes: Do Re Mi Fa Sol La Ti. Fa (4) and Ti (7) are the "tendency tones" — Ti pulls up to Do, Fa pulls down to Mi. They give the scale its sense of direction.\n\nListen to the drone and identify all seven degrees.',
            tutorialMnemonic: 'Do  Re  Mi  Fa  Sol  La  Ti  Do',
            tutorialPreview: 'You will identify all 7 major scale degrees',
            arcadeConfig: {
                mode: 'tones',
                scaleDegrees: ['1', '2', '3', '4', '5', '6', '7'],
            },
        },
    },
    {
        id: 'caves',
        label: 'Crystal Caves',
        subtitle: 'Note Reading',
        color: 0x1a4a6a,
        textColor: '#6ab8e8',
        iconGlyph: '𝄞',
        zoneKey: 'caves',
        backgroundKey: 'bg-caves',
        description: 'Learn to read notes on the treble and bass clef.',
        animalKey: 'sunny-dragon',
        animalName: 'Dragon',
        animalAnimKey: 'sunny-dragon-idle',
        animalScale: 0.6,
        location: {
            id: 'caves_boss',
            name: 'Cave Boss',
            subtitle: 'Rescue Dragon!',
            bossMonster: 'ogre',
            tutorialTitle: 'Reading Both Clefs',
            tutorialBody: 'The treble clef lines spell Every Good Boy Does Fine (E G B D F). The spaces spell FACE.\n\nThe bass clef lines: Good Boys Do Fine Always (G B D F A). Spaces: All Cows Eat Grass.\n\nBoth clefs will appear — read the clef symbol first!',
            tutorialMnemonic: 'EGBDF + FACE (treble) | GBDFA + ACEG (bass)',
            tutorialPreview: 'Both clefs — all natural notes',
            arcadeConfig: {
                mode: 'noteReading',
                clefSetting: 'both',
                noteReadingConfig: { posRange: [0, 8], accidentals: false, linesOnly: false },
            },
        },
    },
    {
        id: 'castle',
        label: 'Sky Castle',
        subtitle: 'Chromatic Mastery',
        color: 0x5a2a6e,
        textColor: '#cc88ff',
        iconGlyph: '🏰',
        zoneKey: 'castle',
        backgroundKey: 'bg-castle',
        description: 'Master accidentals, ledger lines, and all 12 chromatic tones.',
        animalKey: 'sunny-mushroom',
        animalName: 'Mushroom',
        animalAnimKey: 'sunny-mushroom-idle',
        animalScale: 3.0,
        location: {
            id: 'castle_boss',
            name: 'Castle Boss',
            subtitle: 'Rescue Mushroom!',
            bossMonster: 'guardCaptainBoss',
            tutorialTitle: 'The Full Challenge',
            tutorialBody: 'Notes with sharps (♯) are raised one half-step. Flats (♭) lower one half-step. Notes above or below the staff use ledger lines — short extra lines that extend the staff.\n\nThis is the ultimate reading challenge: both clefs, accidentals, and ledger lines.',
            tutorialMnemonic: null,
            tutorialPreview: 'Both clefs — full range with accidentals & ledger lines',
            arcadeConfig: {
                mode: 'noteReading',
                clefSetting: 'both',
                noteReadingConfig: { posRange: [-2, 10], accidentals: true, linesOnly: false },
            },
        },
    },
];

export function getRegionById(id) {
    return WORLD_REGIONS.find(r => r.id === id) || null;
}

export function getLocationById(id) {
    for (const region of WORLD_REGIONS) {
        if (region.location.id === id) return { region, location: region.location };
    }
    return null;
}

export function getRegionForLocation(locationId) {
    for (const region of WORLD_REGIONS) {
        if (region.location.id === locationId) return region;
    }
    return null;
}
