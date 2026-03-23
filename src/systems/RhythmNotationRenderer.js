// RhythmNotationRenderer: renders SpelledNote[] as sheet music via VexFlow 4.
// Creates a DOM overlay (SVG) positioned over the Phaser canvas.
// Follows the same pattern as VexFlowStaffRenderer.js.

const PANEL_BG = '#0a0a22';
const NOTE_COLOR = '#44aaff';
const STAVE_COLOR = '#334466';
const TEXT_COLOR = '#778899';
const TIE_COLOR = '#44aaff';
const BORDER_COLOR = '#4455aa';
const CURSOR_COLOR = '#ffcc00';

// Native VexFlow dimensions (before CSS scaling)
const NAT_STAVE_X    = 20;
const NAT_STAVE_W    = 680;
const NAT_TOP_LINE_Y = 30;
const NAT_STAVE_Y    = NAT_TOP_LINE_Y - 40;
const NAT_BOT_PAD    = 30;
const NAT_SPACING    = 10;
const NAT_STAFF_H    = NAT_SPACING * 4;

const NAT_PANEL_W = NAT_STAVE_X + NAT_STAVE_W + 20;
const NAT_PANEL_H = NAT_TOP_LINE_Y + NAT_STAFF_H + NAT_BOT_PAD;

// How many game-px one staff space should occupy
const STAFF_SP_GAME = 10;

// Subdivision info for grouping beams/tuplets
const CELLS_PER_BEAT = {
    quarter:   1,
    eighth:    2,
    sixteenth: 4,
    triplet:   3,
};

export class RhythmNotationRenderer {
    constructor(scene) {
        this.scene     = scene;
        this._el       = null;
        this._onResize = null;
    }

    /**
     * Render spelled notes as sheet music.
     * @param {SpelledNote[]} notes - from RhythmSpeller.spellPattern()
     * @param {string} subdivision - 'quarter' | 'eighth' | 'sixteenth' | 'triplet'
     * @param {number} cx - center x in game coordinates
     * @param {number} cy - center y in game coordinates
     * @param {number} width - desired width in game coordinates (unused, we use NAT_STAVE_W)
     * @param {number} [cursorTick=-1] - tick position of keyboard cursor (-1 = none)
     */
    render(notes, subdivision, cx, cy, width, cursorTick = -1) {
        this.clear();

        if (typeof Vex === 'undefined') {
            console.error('RhythmNotationRenderer: Vex not found');
            return;
        }

        try {
            this._render(notes, subdivision, cx, cy, cursorTick);
        } catch (err) {
            console.error('RhythmNotationRenderer error:', err);
        }
    }

    clear() {
        if (this._el) { this._el.remove(); this._el = null; }
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
    }

    // ── Private ──────────────────────────────────────────────────────────────

    _screenScale() {
        const rect = this.scene.game.canvas.getBoundingClientRect();
        const sx   = rect.width  / this.scene.scale.gameSize.width;
        const sy   = rect.height / this.scene.scale.gameSize.height;
        const s    = Math.min(sx, sy);
        const cssScale = (STAFF_SP_GAME * s) / NAT_SPACING;
        return { rect, sx, sy, cssScale };
    }

    _render(notes, subdivision, cx, cy, cursorTick) {
        const VF = Vex.Flow;
        const { rect, sx, sy, cssScale } = this._screenScale();

        const screenW = NAT_PANEL_W * cssScale;
        const screenH = NAT_PANEL_H * cssScale;

        const left = rect.left + cx * sx - screenW / 2;
        const top  = rect.top  + cy * sy - screenH / 2;

        // Wrapper div
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            position:        'fixed',
            pointerEvents:   'none',
            zIndex:          '100',
            left:            `${left}px`,
            top:             `${top}px`,
            width:           `${NAT_PANEL_W}px`,
            height:          `${NAT_PANEL_H}px`,
            background:      PANEL_BG,
            border:          `1px solid ${BORDER_COLOR}`,
            borderRadius:    '6px',
            overflow:        'visible',
            transformOrigin: 'top left',
            transform:       `scale(${cssScale})`,
        });
        document.body.appendChild(wrapper);
        this._el = wrapper;

        // VexFlow SVG renderer
        const renderer = new VF.Renderer(wrapper, VF.Renderer.Backends.SVG);
        renderer.resize(NAT_PANEL_W, NAT_PANEL_H);

        const svg = wrapper.querySelector('svg');
        if (svg) {
            svg.style.overflow = 'visible';
            svg.setAttribute('overflow', 'visible');
        }

        const ctx = renderer.getContext();

        // Style: cyan notes on dark background (matches game aesthetic)
        ctx.setFillStyle(NOTE_COLOR);
        ctx.setStrokeStyle(NOTE_COLOR);

        // Stave — percussion style (no clef)
        const stave = new VF.Stave(NAT_STAVE_X, NAT_STAVE_Y, NAT_STAVE_W);
        stave.addTimeSignature(subdivision === 'triplet' ? '12/8' : '4/4');
        stave.setContext(ctx);

        // Style stave lines muted blue-gray
        stave.setStyle({ fillStyle: STAVE_COLOR, strokeStyle: STAVE_COLOR });
        stave.draw();

        // Find which spelled note the cursor is on
        let cursorNoteIdx = -1;
        if (cursorTick >= 0) {
            for (let i = 0; i < notes.length; i++) {
                if (cursorTick >= notes[i].startTick &&
                    cursorTick < notes[i].startTick + notes[i].durationTicks) {
                    cursorNoteIdx = i;
                    break;
                }
            }
        }

        // Build VexFlow notes — stems down for percussion style
        const vfNotes = notes.map((n, idx) => {
            const isDotted = n.vexDuration.endsWith('d');
            const baseDur = isDotted ? n.vexDuration.slice(0, -1) : n.vexDuration;
            const dur = n.type === 'rest' ? baseDur + 'r' : baseDur;
            const color = idx === cursorNoteIdx ? CURSOR_COLOR : NOTE_COLOR;
            const staveNote = new VF.StaveNote({
                keys:     ['b/4'],
                duration: dur,
                dots:     isDotted ? 1 : 0,
                stem_direction: -1,   // force stems down
            });
            if (isDotted) {
                VF.Dot.buildAndAttach([staveNote], { all: true });
            }
            staveNote.setStyle({ fillStyle: color, strokeStyle: color });
            return staveNote;
        });

        if (vfNotes.length === 0) return;

        // Auto-beam before drawing
        let beams = [];
        if (subdivision === 'eighth' || subdivision === 'sixteenth' || subdivision === 'triplet') {
            try {
                const beamGroups = subdivision === 'triplet'
                    ? [new VF.Fraction(3, 8)]  // beam in groups of 3 eighth notes for 12/8
                    : undefined;
                beams = VF.Beam.generateBeams(vfNotes, { stem_direction: -1, groups: beamGroups });
                beams.forEach(b => b.setStyle({ fillStyle: NOTE_COLOR, strokeStyle: NOTE_COLOR }));
            } catch (e) { /* skip if beaming fails */ }
        }

        // Voice in SOFT mode (forgiving tick count)
        const numBeats = subdivision === 'triplet' ? 12 : 4;
        const beatValue = subdivision === 'triplet' ? 8 : 4;
        const voice = new VF.Voice({ num_beats: numBeats, beat_value: beatValue })
            .setMode(VF.Voice.Mode.SOFT)
            .addTickables(vfNotes);

        new VF.Formatter()
            .joinVoices([voice])
            .format([voice], NAT_STAVE_W - 60);

        voice.draw(ctx, stave);

        // Draw beams after voice
        beams.forEach(b => b.setContext(ctx).draw());

        // Ties for sustained notes
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].tieToNext && i + 1 < vfNotes.length) {
                try {
                    const tie = new VF.StaveTie({
                        first_note: vfNotes[i],
                        last_note:  vfNotes[i + 1],
                        first_indices: [0],
                        last_indices:  [0],
                    });
                    tie.setContext(ctx).draw();
                } catch (e) { /* skip */ }
            }
        }

        // Style all SVG elements for dark background
        this._styleSvgWhite(wrapper);

        // Re-color cursor note gold (after blanket styling)
        if (cursorNoteIdx >= 0 && cursorNoteIdx < vfNotes.length) {
            this._highlightNote(vfNotes[cursorNoteIdx], CURSOR_COLOR, wrapper);
        }

        // Resize handler
        this._onResize = () => {
            if (!this._el) return;
            const { rect: r, sx: rsx, sy: rsy, cssScale: rc } = this._screenScale();
            const rW = NAT_PANEL_W * rc;
            const rH = NAT_PANEL_H * rc;
            this._el.style.left      = `${r.left + cx * rsx - rW / 2}px`;
            this._el.style.top       = `${r.top  + cy * rsy - rH / 2}px`;
            this._el.style.transform = `scale(${rc})`;
        };
        window.addEventListener('resize', this._onResize);
    }

    /**
     * Build triplet bracket objects — one per beat (3 notes each).
     * Also creates beams for notes within each triplet group.
     */
    _buildTriplets(VF, vfNotes, spelledNotes) {
        const tuplets = [];
        for (let beat = 0; beat < 4; beat++) {
            const startIdx = beat * 3;
            const endIdx = Math.min(startIdx + 3, vfNotes.length);
            const group = vfNotes.slice(startIdx, endIdx);

            if (group.length === 3) {
                try {
                    tuplets.push(new VF.Tuplet(group, {
                        num_notes: 3,
                        notes_occupied: 2,
                    }));
                } catch (e) { /* skip */ }
            }
        }
        return tuplets;
    }

    /**
     * Re-color a VexFlow note's SVG elements using inline styles
     * (overrides both VexFlow attrs and _styleSvgWhite).
     */
    _highlightNote(vfNote, color, wrapper) {
        let el = null;

        // Strategy 1: VF4 stores the SVG group in attrs.el after draw
        try { el = vfNote.getAttribute?.('el') || vfNote.attrs?.el; } catch (_) {}

        // Strategy 2: find <g> by the note's auto-ID
        if (!el && wrapper) {
            const id = (vfNote.getAttribute?.('id') || vfNote.attrs?.id || '');
            if (id) {
                el = wrapper.querySelector(`#${id}`) || wrapper.querySelector(`#vf-${id}`);
            }
        }

        if (!el || !el.querySelectorAll) return;

        // Use inline style to guarantee override
        el.querySelectorAll('path, rect, line').forEach(node => {
            const fill = node.getAttribute('fill');
            const stroke = node.getAttribute('stroke');
            if (fill && fill !== 'none') node.style.fill = color;
            if (stroke && stroke !== 'none') node.style.stroke = color;
        });
    }

    /**
     * Style SVG elements to match the game's dark arcade aesthetic.
     */
    _styleSvgWhite(wrapper) {
        const svg = wrapper.querySelector('svg');
        if (!svg) return;

        svg.querySelectorAll('path, line, rect').forEach(el => {
            if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
                el.setAttribute('stroke', NOTE_COLOR);
            }
            if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') {
                el.setAttribute('fill', NOTE_COLOR);
            }
        });
        svg.querySelectorAll('text').forEach(el => {
            el.setAttribute('fill', TEXT_COLOR);
        });
    }
}
