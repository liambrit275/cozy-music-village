// RhythmSpeller: converts a boolean pattern + subdivision into SpelledNote[]
// Merges adjacent note cells into sustained notes, splits at beat boundaries,
// and produces properly-spelled notation with ties.
// Supports multiple time signatures via optional timeSigInfo parameter.

const TICKS_PER_CELL = {
    quarter:   4,
    eighth:    2,
    sixteenth: 1,
    triplet:   1,   // triplet uses 12-tick bar
};

// Map tick duration → VexFlow duration string (sorted largest first)
// Used for simple meters (x/4) where 1 tick = sixteenth note
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

// Compound meters (x/8) where 1 tick = eighth note
const COMPOUND_DURATION_MAP = [
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

const COMPOUND_REST_MAP = [
    { ticks: 12, vex: 'wd' },
    { ticks: 6,  vex: 'hd' },
    { ticks: 3,  vex: 'qd' },
    { ticks: 2,  vex: 'q'  },
    { ticks: 1,  vex: '8'  },
];

function ticksToVexDuration(ticks, compound, isRest) {
    const map = isRest
        ? (compound ? COMPOUND_REST_MAP : REST_DURATION_MAP)
        : (compound ? COMPOUND_DURATION_MAP : DURATION_MAP);
    for (const entry of map) {
        if (entry.ticks === ticks) return entry;
    }
    // Fallback: find largest that fits
    for (const entry of map) {
        if (entry.ticks <= ticks) return entry;
    }
    return { ticks: 1, vex: compound ? '8' : '16' };
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
 *  1. Split at the half-bar midpoint (if defined).
 *  2. Split at beat boundaries when splitAtBeats is true.
 *     Notes must not cross beat lines — they get tied at the boundary instead.
 *
 * @param {number} pos - current tick position
 * @param {number} remaining - ticks left in the event
 * @param {number} beatSize - ticks per beat (4 for simple, 3 for compound)
 * @param {number|null} midpoint - tick position of half-bar split (null = no midpoint)
 * @param {boolean} splitAtBeats - whether to enforce beat boundary splits
 */
function maxDurationAt(pos, remaining, beatSize, midpoint, splitAtBeats) {
    let limit = remaining;

    // Adaptive rule: on-beat, beat-aligned durations need no splitting.
    // A half note starting on beat 2 in 4/4 can cross the midpoint.
    // Only off-beat or sub-beat events need to show beat boundaries.
    if (pos % beatSize === 0 && remaining % beatSize === 0) {
        return limit;
    }

    // Rule 1: half-bar midpoint (off-beat/sub-beat events only)
    if (midpoint != null && pos < midpoint && pos + limit > midpoint) {
        limit = midpoint - pos;
    }

    // Rule 2: beat boundaries (off-beat/sub-beat events only)
    if (splitAtBeats) {
        const nextBeat = (Math.floor(pos / beatSize) + 1) * beatSize;
        if (pos + limit > nextBeat) {
            limit = Math.min(limit, nextBeat - pos);
        }
    }

    return limit;
}

/**
 * Split a single event at beat boundaries into properly-spelled SpelledNotes.
 */
function splitEvent(event, compound, beatSize, midpoint, splitAtBeats) {
    const result = [];
    let remaining = event.durationTicks;
    let pos = event.startTick;
    const isRest = event.type === 'rest';

    let safety = 0;
    while (remaining > 0 && safety++ < 64) {
        const maxTicks = maxDurationAt(pos, remaining, beatSize, midpoint, splitAtBeats);
        const best = ticksToVexDuration(maxTicks, compound, isRest);
        const useTicks = best.ticks;

        if (useTicks <= 0) {
            console.error(`splitEvent: useTicks=0 at pos=${pos}, remaining=${remaining}`);
            break;
        }

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
 * Resolve time signature parameters from subdivision name or explicit timeSigInfo.
 *
 * @param {string} subdivision - 'quarter' | 'eighth' | 'sixteenth' | 'triplet'
 * @param {object} [timeSigInfo] - optional override: { compound, beatTicks, midpoint, ticksPerCell }
 * @returns {{ ticksPerCell, compound, beatSize, midpoint, splitAtBeats }}
 */
function resolveTimeSig(subdivision, timeSigInfo) {
    if (timeSigInfo) {
        const compound = timeSigInfo.compound ?? false;
        const beatSize = timeSigInfo.beatTicks ?? (compound ? 3 : 4);
        const midpoint = timeSigInfo.midpoint ?? null;
        const ticksPerCell = timeSigInfo.ticksPerCell ?? TICKS_PER_CELL[subdivision] ?? 1;
        // Split at beats for sub-beat subdivisions only (16ths, not 8ths).
        // The adaptive rule in maxDurationAt handles on-beat 16th-level events.
        const splitAtBeats = timeSigInfo.splitAtBeats ?? (ticksPerCell * 2 < beatSize);
        return { ticksPerCell, compound, beatSize, midpoint, splitAtBeats };
    }
    // Legacy: derive from subdivision name (assumes 4/4 or 12/8)
    const compound = subdivision === 'triplet';
    const beatSize = compound ? 3 : 4;
    const midpoint = compound ? 6 : 8;
    const ticksPerCell = TICKS_PER_CELL[subdivision] ?? 1;
    const splitAtBeats = subdivision === 'sixteenth' || subdivision === 'triplet';
    return { ticksPerCell, compound, beatSize, midpoint, splitAtBeats };
}

/**
 * Convert a group-ID grid into properly-spelled notation.
 * Merges cells in the same group, splits at beat boundaries, adds ties.
 *
 * @param {number[]} groupGrid - 0 = rest, positive number = note group ID
 * @param {string} subdivision - 'quarter' | 'eighth' | 'sixteenth' | 'triplet'
 * @param {object} [timeSigInfo] - optional time signature info from levels.js TIME_SIG_INFO
 *   { compound, beatTicks, midpoint, ticksPerCell }
 * @returns {SpelledNote[]}
 */
export function spellPattern(groupGrid, subdivision, timeSigInfo) {
    const { ticksPerCell, compound, beatSize, midpoint, splitAtBeats } =
        resolveTimeSig(subdivision, timeSigInfo);

    const events = mergeEvents(groupGrid, ticksPerCell);
    const spelled = [];
    for (const event of events) {
        spelled.push(...splitEvent(event, compound, beatSize, midpoint, splitAtBeats));
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
 * @param {object} [timeSigInfo] - optional time signature info
 * @returns {SpelledNote[]}
 */
export function splitRestsAtCursor(spelled, cursorTick, selectedTicks, subdivision, timeSigInfo) {
    if (cursorTick < 0 || selectedTicks <= 0) return spelled;
    const { compound, beatSize, midpoint, splitAtBeats } =
        resolveTimeSig(subdivision, timeSigInfo);

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
        let safety = 0;
        while (pos < end && safety++ < 64) {
            const remaining = end - pos;
            const chunkSize = Math.min(selectedTicks, remaining);
            const subNotes = splitEvent({
                type: 'rest',
                startTick: pos,
                durationTicks: chunkSize,
            }, compound, beatSize, midpoint, splitAtBeats);
            if (subNotes.length === 0) break;
            result.push(...subNotes);
            const consumed = subNotes.reduce((sum, n) => sum + n.durationTicks, 0);
            if (consumed <= 0) break;
            pos += consumed;
        }
    }
    return result;
}
