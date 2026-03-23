// RhythmSpeller: converts a boolean pattern + subdivision into SpelledNote[]
// Merges adjacent note cells into sustained notes, splits at beat boundaries,
// and produces properly-spelled notation with ties.

const TICKS_PER_CELL = {
    quarter:   4,
    eighth:    2,
    sixteenth: 1,
    triplet:   1,   // triplet uses 12-tick bar
};

// Map tick duration → VexFlow duration string (sorted largest first)
const DURATION_MAP = [
    { ticks: 16, vex: 'w'  },
    { ticks: 12, vex: 'hd' },
    { ticks: 8,  vex: 'h'  },
    { ticks: 6,  vex: 'qd' },
    { ticks: 4,  vex: 'q'  },
    { ticks: 3,  vex: '8d' },
    { ticks: 2,  vex: '8'  },
    { ticks: 1,  vex: '16' },
];

// In 12/8: each tick = one 8th note, 3 ticks = dotted quarter, 6 = dotted half, etc.
const TRIPLET_DURATION_MAP = [
    { ticks: 12, vex: 'wd' },
    { ticks: 6,  vex: 'hd' },
    { ticks: 3,  vex: 'qd' },
    { ticks: 2,  vex: 'q'  },
    { ticks: 1,  vex: '8'  },
];

const REST_DURATION_MAP = [
    { ticks: 16, vex: 'w'  },
    { ticks: 12, vex: 'hd' },
    { ticks: 8,  vex: 'h'  },
    { ticks: 6,  vex: 'qd' },
    { ticks: 4,  vex: 'q'  },
    { ticks: 3,  vex: '8d' },
    { ticks: 2,  vex: '8'  },
    { ticks: 1,  vex: '16' },
];

const TRIPLET_REST_MAP = [
    { ticks: 12, vex: 'wd' },
    { ticks: 6,  vex: 'hd' },
    { ticks: 3,  vex: 'qd' },
    { ticks: 2,  vex: 'q'  },
    { ticks: 1,  vex: '8'  },
];

function ticksToVexDuration(ticks, isTriplet, isRest) {
    const map = isRest
        ? (isTriplet ? TRIPLET_REST_MAP : REST_DURATION_MAP)
        : (isTriplet ? TRIPLET_DURATION_MAP : DURATION_MAP);
    for (const entry of map) {
        if (entry.ticks === ticks) return entry;
    }
    // Fallback: find largest that fits
    for (const entry of map) {
        if (entry.ticks <= ticks) return entry;
    }
    return { ticks: 1, vex: isTriplet ? '8' : '16' };
}

/**
 * Merge adjacent cells into longer events.
 * @param {number[]} groupGrid - 0 = rest, same positive number = same sustained note
 * @param {number} ticksPerCell
 */
function mergeEvents(groupGrid, ticksPerCell) {
    const events = [];
    let i = 0;
    while (i < groupGrid.length) {
        const gid = groupGrid[i];
        const type = gid > 0 ? 'note' : 'rest';
        let span = 1;
        if (gid > 0) {
            // Merge cells with the same group ID
            while (i + span < groupGrid.length && groupGrid[i + span] === gid) {
                span++;
            }
        } else {
            // Merge consecutive rests
            while (i + span < groupGrid.length && groupGrid[i + span] === 0) {
                span++;
            }
        }
        events.push({
            type,
            startTick:     i * ticksPerCell,
            durationTicks: span * ticksPerCell,
        });
        i += span;
    }
    return events;
}

/**
 * Get the maximum ticks a single note/rest can span from `pos`.
 *
 * Rules:
 *  1. Always split at the half-bar midpoint (tick 8 in 4/4, tick 6 in triplets).
 *  2. When splitAtBeats is true, also split at quarter-note beat boundaries,
 *     BUT only when the note starts in the LAST portion of the beat
 *     (strictly less than half a beat before the boundary).
 *     This lets 8th-note and quarter-note values cross beat lines naturally
 *     while still tying a 16th that lands on the last subdivision of a beat.
 */
function maxDurationAt(pos, remaining, isTriplet, splitAtBeats) {
    let limit = remaining;
    const beatSize = isTriplet ? 3 : 4;
    const midpoint = isTriplet ? 6 : 8;

    // Rule 1: half-bar midpoint — always mandatory
    if (pos < midpoint && pos + limit > midpoint) {
        limit = midpoint - pos;
    }

    // Rule 2: beat boundaries — only for notes that start late in a beat
    if (splitAtBeats) {
        const nextBeat = (Math.floor(pos / beatSize) + 1) * beatSize;
        const portionBeforeBeat = nextBeat - pos;
        if (pos + limit > nextBeat && portionBeforeBeat < beatSize / 2) {
            limit = Math.min(limit, portionBeforeBeat);
        }
    }

    return limit;
}

/**
 * Split a single event at beat boundaries into properly-spelled SpelledNotes.
 */
function splitEvent(event, isTriplet, splitAtBeats = false) {
    const result = [];
    let remaining = event.durationTicks;
    let pos = event.startTick;
    const isRest = event.type === 'rest';

    while (remaining > 0) {
        const maxTicks = maxDurationAt(pos, remaining, isTriplet, splitAtBeats);
        const best = ticksToVexDuration(maxTicks, isTriplet, isRest);
        const useTicks = best.ticks;

        const tieToNext = !isRest && (remaining - useTicks > 0);

        result.push({
            type:          event.type,
            vexDuration:   best.vex,
            tieToNext,
            startTick:     pos,
            durationTicks: useTicks,
        });

        pos += useTicks;
        remaining -= useTicks;
    }

    return result;
}

/**
 * Convert a group-ID grid into properly-spelled notation.
 * Merges cells in the same group, splits at beat boundaries, adds ties.
 *
 * @param {number[]} groupGrid - 0 = rest, positive number = note group ID
 * @param {string} subdivision - 'quarter' | 'eighth' | 'sixteenth' | 'triplet'
 * @param {object} [options]
 * @param {boolean} [options.perCell=false] - If true, each cell is its own note tied
 *   to its neighbours in the same group, making ties explicit at subdivision resolution.
 * @returns {SpelledNote[]}
 */
export function spellPattern(groupGrid, subdivision) {
    const ticksPerCell = TICKS_PER_CELL[subdivision];
    const isTriplet    = subdivision === 'triplet';
    // 16th and triplet subdivisions split at quarter-note beat boundaries (with conditions);
    // quarter and eighth only split at the half-bar midpoint.
    const splitAtBeats = subdivision === 'sixteenth' || subdivision === 'triplet';

    const events = mergeEvents(groupGrid, ticksPerCell);
    const spelled = [];
    for (const event of events) {
        spelled.push(...splitEvent(event, isTriplet, splitAtBeats));
    }
    return spelled;
}

/**
 * Post-process spelled notes: split the rest containing the cursor into
 * chunks of `selectedTicks` so the notation shows the selected duration's
 * rest value instead of one large merged rest.
 *
 * @param {SpelledNote[]} spelled - output of spellPattern()
 * @param {number} cursorTick - current cursor position in ticks
 * @param {number} selectedTicks - the currently selected duration in ticks
 * @param {string} subdivision - 'quarter' | 'eighth' | 'sixteenth' | 'triplet'
 * @returns {SpelledNote[]}
 */
export function splitRestsAtCursor(spelled, cursorTick, selectedTicks, subdivision) {
    if (cursorTick < 0 || selectedTicks <= 0) return spelled;
    const isTriplet = subdivision === 'triplet';
    const splitAtBeats = subdivision === 'sixteenth' || subdivision === 'triplet';

    const result = [];
    for (const note of spelled) {
        // Only split the rest that contains the cursor
        if (note.type !== 'rest' || cursorTick < note.startTick ||
            cursorTick >= note.startTick + note.durationTicks) {
            result.push(note);
            continue;
        }

        // Split this rest into selectedTicks-sized chunks
        let pos = note.startTick;
        const end = note.startTick + note.durationTicks;
        while (pos < end) {
            const remaining = end - pos;
            const chunkSize = Math.min(selectedTicks, remaining);
            // Use splitEvent to properly handle beat-boundary splits
            const subNotes = splitEvent({
                type: 'rest',
                startTick: pos,
                durationTicks: chunkSize,
            }, isTriplet, splitAtBeats);
            result.push(...subNotes);
            // Advance by actual ticks consumed (splitEvent may split further)
            const consumed = subNotes.reduce((sum, n) => sum + n.durationTicks, 0);
            pos += consumed;
        }
    }
    return result;
}
