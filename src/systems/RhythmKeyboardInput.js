// RhythmKeyboardInput: MuseScore-style keyboard input for rhythm entry.
// Select duration with number keys (3-7), place note (Space) or rest (0).
// Works alongside the visual grid — updates a groupId array in the same
// format as the click-to-toggle grid mode.

const TICKS_PER_CELL = {
    quarter:   4,
    eighth:    2,
    sixteenth: 1,
    triplet:   1,
};

// MuseScore key → base tick duration
const KEY_TO_TICKS = {
    THREE: 1,   // 16th
    FOUR:  2,   // 8th
    FIVE:  4,   // quarter
    SIX:   8,   // half
    SEVEN: 16,  // whole
};

// Duration labels for HUD display
const TICK_LABELS = {
    1:  '𝅘𝅥𝅯 16th',
    2:  '𝅘𝅥𝅮 8th',
    3:  '𝅘𝅥𝅮. dot 8th',
    4:  '♩ quarter',
    6:  '♩. dot qtr',
    8:  '𝅗𝅥 half',
    12: '𝅗𝅥. dot half',
    16: '𝅝 whole',
};

export class RhythmKeyboardInput {
    /**
     * @param {Phaser.Scene} scene
     * @param {object} config
     * @param {number} config.cells - number of grid cells
     * @param {number} config.ticksPerCell - ticks per grid cell
     * @param {string} config.subdivision - 'quarter'|'eighth'|'sixteenth'|'triplet'
     * @param {function} config.onUpdate - called after any grid change: (grid, cursorCell)
     */
    constructor(scene, config) {
        this.scene = scene;
        this.cells = config.cells;
        this.ticksPerCell = config.ticksPerCell;
        this.subdivision = config.subdivision;
        this.onUpdate = config.onUpdate;
        this.onSubmit = config.onSubmit;

        this.totalTicks = this.cells * this.ticksPerCell;

        // State
        this._cursorTick = 0;
        this._selectedTicks = this.ticksPerCell; // default = one cell's duration
        this._dotted = false;
        this._grid = new Array(this.cells).fill(0);
        this._nextGroupId = 1;
        this._events = []; // for undo: { startTick, durationTicks, type }
        this._keys = [];
        this._enabled = false;
    }

    /** Current duration in ticks (with dotted if active) */
    get effectiveTicks() {
        if (!this._dotted) return this._selectedTicks;
        return Math.floor(this._selectedTicks * 1.5);
    }

    /** Label for HUD */
    get durationLabel() {
        const t = this.effectiveTicks;
        return TICK_LABELS[t] || `${t} ticks`;
    }

    /** Cursor position as cell index */
    get cursorCell() {
        return Math.floor(this._cursorTick / this.ticksPerCell);
    }

    /** Get the groupId grid array */
    getGrid() {
        return this._grid;
    }

    /** Enable keyboard listeners */
    enable() {
        if (this._enabled) return;
        this._enabled = true;
        const kb = this.scene.input.keyboard;

        // Duration keys
        for (const [keyName, ticks] of Object.entries(KEY_TO_TICKS)) {
            const key = kb.addKey(Phaser.Input.Keyboard.KeyCodes[keyName]);
            key.on('down', () => this._setDuration(ticks));
            this._keys.push(key);
        }

        // Place note — any note letter (A-G), matching MuseScore
        for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
            const k = kb.addKey(Phaser.Input.Keyboard.KeyCodes[letter]);
            k.on('down', () => this._placeNote());
            this._keys.push(k);
        }

        // Place rest (0)
        const zero = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);
        zero.on('down', () => this._placeRest());
        this._keys.push(zero);

        // Dot toggle (period)
        const period = kb.addKey(Phaser.Input.Keyboard.KeyCodes.PERIOD);
        period.on('down', () => this._toggleDot());
        this._keys.push(period);

        // Cursor movement
        const left = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        left.on('down', () => this._moveCursor(-1));
        this._keys.push(left);

        const right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        right.on('down', () => this._moveCursor(1));
        this._keys.push(right);

        // Tie (T) — extend previous note by selected duration
        const tKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        tKey.on('down', () => this._placeTie());
        this._keys.push(tKey);

        // Submit (Enter)
        const enter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        enter.on('down', (e) => { e.originalEvent?.preventDefault(); if (this.onSubmit) this.onSubmit(); });
        this._keys.push(enter);

        // Undo (Backspace)
        const backspace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
        backspace.on('down', (e) => { e.originalEvent?.preventDefault(); this._undo(); });
        this._keys.push(backspace);
    }

    /** Disable and clean up keyboard listeners */
    disable() {
        if (!this._enabled) return;
        this._enabled = false;
        const kb = this.scene.input.keyboard;
        for (const key of this._keys) {
            key.removeAllListeners('down');
            kb.removeKey(key);
        }
        this._keys = [];
    }

    /** Reset for a new round */
    reset(cells, ticksPerCell) {
        if (cells !== undefined) this.cells = cells;
        if (ticksPerCell !== undefined) this.ticksPerCell = ticksPerCell;
        this.totalTicks = this.cells * this.ticksPerCell;
        this._cursorTick = 0;
        this._selectedTicks = this.ticksPerCell;
        this._dotted = false;
        this._grid = new Array(this.cells).fill(0);
        this._nextGroupId = 1;
        this._events = [];
    }

    // ── Private ─────────────────────────────────────────────────────────

    _setDuration(baseTicks) {
        this._selectedTicks = baseTicks;
        this._dotted = false;
        this._notify();
    }

    _toggleDot() {
        const dotted = Math.floor(this._selectedTicks * 1.5);
        // Only allow dot if the result maps to whole cells
        if (dotted % this.ticksPerCell === 0 && dotted <= this.totalTicks) {
            this._dotted = !this._dotted;
            this._notify();
        }
    }

    _placeNote() {
        const dur = this.effectiveTicks;
        if (!this._canPlace(dur)) return;

        const gid = this._nextGroupId++;
        const startCell = this.cursorCell;
        const cellSpan = dur / this.ticksPerCell;

        for (let i = 0; i < cellSpan; i++) {
            this._grid[startCell + i] = gid;
        }

        this._events.push({
            startTick: this._cursorTick,
            durationTicks: dur,
            type: 'note',
            groupId: gid,
        });

        this._cursorTick += dur;
        this._notify();
    }

    _placeTie() {
        const dur = this.effectiveTicks;
        if (!this._canPlace(dur)) return;

        // Find the last note event to tie from
        let lastNoteEvent = null;
        for (let i = this._events.length - 1; i >= 0; i--) {
            if (this._events[i].type === 'note') {
                lastNoteEvent = this._events[i];
                break;
            }
        }
        if (!lastNoteEvent) return; // nothing to tie to

        // Extend using the same group ID as the previous note
        const gid = lastNoteEvent.groupId;
        const startCell = this.cursorCell;
        const cellSpan = dur / this.ticksPerCell;

        for (let i = 0; i < cellSpan; i++) {
            this._grid[startCell + i] = gid;
        }

        this._events.push({
            startTick: this._cursorTick,
            durationTicks: dur,
            type: 'note',
            groupId: gid,
        });

        this._cursorTick += dur;
        this._notify();
    }

    _placeRest() {
        const dur = this.effectiveTicks;
        if (!this._canPlace(dur)) return;

        const startCell = this.cursorCell;
        const cellSpan = dur / this.ticksPerCell;

        for (let i = 0; i < cellSpan; i++) {
            this._grid[startCell + i] = 0;
        }

        this._events.push({
            startTick: this._cursorTick,
            durationTicks: dur,
            type: 'rest',
        });

        this._cursorTick += dur;
        this._notify();
    }

    _canPlace(dur) {
        // Must align to cell boundaries
        if (dur % this.ticksPerCell !== 0) return false;
        // Must fit in remaining space
        if (this._cursorTick + dur > this.totalTicks) return false;
        // Cursor must be on a cell boundary
        if (this._cursorTick % this.ticksPerCell !== 0) return false;
        return true;
    }

    _moveCursor(direction) {
        const newTick = this._cursorTick + direction * this.ticksPerCell;
        if (newTick >= 0 && newTick <= this.totalTicks) {
            this._cursorTick = newTick;
            this._notify();
        }
    }

    _undo() {
        if (this._events.length === 0) return;
        const last = this._events.pop();

        // Clear cells that were written by this event
        const startCell = last.startTick / this.ticksPerCell;
        const cellSpan = last.durationTicks / this.ticksPerCell;
        for (let i = 0; i < cellSpan; i++) {
            this._grid[startCell + i] = 0;
        }

        // Move cursor back
        this._cursorTick = last.startTick;
        this._notify();
    }

    /** Sync internal grid from an external source (e.g. click-mode edit). Clears undo stack. */
    syncFromGrid(grid) {
        let maxGid = 0;
        for (let i = 0; i < this._grid.length; i++) {
            this._grid[i] = i < grid.length ? grid[i] : 0;
            if (this._grid[i] > maxGid) maxGid = this._grid[i];
        }
        this._nextGroupId = maxGid + 1;
        this._events = [];

        // Move cursor to after the last occupied cell
        let lastOccupied = -1;
        for (let i = 0; i < this._grid.length; i++) {
            if (this._grid[i] !== 0) lastOccupied = i;
        }
        this._cursorTick = (lastOccupied + 1) * this.ticksPerCell;
        if (this._cursorTick > this.totalTicks) this._cursorTick = this.totalTicks;

        this._notify();
    }

    _notify() {
        if (this.onUpdate) {
            this.onUpdate(this._grid, this.cursorCell);
        }
    }
}
