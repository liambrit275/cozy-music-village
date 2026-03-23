// npcs.js — Sunny animal characters to rescue across the world map.
// One NPC per region. Each has sprite data and dialogue.

export const NPCS = {

    // ── Meadow Woods (ear training: major triad) ────────────────
    meadow_boss: {
        name:       'Bunny',
        title:      'the Meadow Singer',
        spriteKey:  'sunny-bunny',
        animKey:    'sunny-bunny-idle',
        scale:      2.5,
        intro:  '"The monsters locked me in a cage and stole the music from the meadow! I can\'t hear Do any more — everything is silent. Please, can you help me?"',
        learn:  '"Do, Mi, Sol — those three notes together make a chord that sounds like sunshine. If you can name which one rings above the drone, we can bring the music back!"',
        ready:  '"Listen for the drone — that\'s the root, our home note. Then name the note that rings above it. You can do this!"',
        saved:  '"I can sing again! Do — Mi — Sol! The meadow is alive! Thank you so much!"',
    },

    // ── Sunny Village (ear training: full major scale) ──────────
    village_boss: {
        name:       'Froggy',
        title:      'the Village Bard',
        spriteKey:  'sunny-froggy',
        animKey:    'sunny-froggy-idle',
        scale:      2.5,
        intro:  '"The monsters trapped me and scattered all seven notes of the major scale! Without them, the village has gone silent. Please — I need all seven notes back!"',
        learn:  '"Do Re Mi Fa Sol La Ti — the complete major scale. Fa and Ti are special: Ti pulls up to Do, Fa pulls down to Mi. These tendency tones give the scale its sense of direction."',
        ready:  '"Seven notes above the drone. Trust your ear — it knows more than you think!"',
        saved:  '"All seven tones ring out — Do Re Mi Fa Sol La Ti! The village is singing again. You have a remarkable ear!"',
    },

    // ── Crystal Caves (note reading: treble + bass) ─────────────
    caves_boss: {
        name:       'Dragon',
        title:      'the Crystal Guardian',
        spriteKey:  'sunny-dragon',
        animKey:    'sunny-dragon-idle',
        scale:      0.6,
        intro:  '"The monsters imprisoned me deep in the caves! They scrambled all the notes on the staff — I can\'t read the musical scrolls that keep the crystals glowing. Help me read them!"',
        learn:  '"The treble clef lines are E G B D F — Every Good Boy Does Fine. The spaces spell FACE. The bass clef lines: G B D F A. Spaces: A C E G. Two systems, one musician!"',
        ready:  '"Look at the clef symbol first — treble or bass? Then apply the right mnemonic. You\'ve got this!"',
        saved:  '"I can read the scrolls again! The crystals are glowing brighter than ever. You\'re amazing!"',
    },

    // ── Sky Castle (chromatic + ledger lines) ───────────────────
    castle_boss: {
        name:       'Mushroom',
        title:      'the Sky Scholar',
        spriteKey:  'sunny-mushroom',
        animKey:    'sunny-mushroom-idle',
        scale:      3.0,
        intro:  '"The monsters locked me in the highest tower! They\'ve mixed up all the sharps and flats, and the notes have climbed beyond the staff onto strange extra lines. I\'m so confused!"',
        learn:  '"A sharp (♯) raises a note one half-step. A flat (♭) lowers it. Ledger lines are extra rungs on the ladder — they follow the same pattern as the staff, just above or below it."',
        ready:  '"Read the note name, check for accidentals to the left, and count the ledger lines carefully. The ultimate challenge!"',
        saved:  '"Sharps, flats, ledger lines — you\'ve mastered them all! The castle echoes with perfect music. Thank you, hero!"',
    },
};

export function getNpcForLocation(locationId) {
    return NPCS[locationId] || null;
}
