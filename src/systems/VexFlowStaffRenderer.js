// VexFlow 4 staff renderer — same interface as StaffRenderer.js
//   draw(cx, cy, staffWidth, question)  /  clear()
//
// Renders into a <div> SVG overlay positioned over the Phaser canvas.
// Renders at native VexFlow size then CSS-scales to match game viewport.
// VexFlow is loaded globally via <script> in index.html (window.Vex).
//
// question shape: { clef, noteName, accidental, octave }

// Clean white sheet music
const PANEL_BG      = '#ffffff';
const PANEL_BG_DARK = '#f4f4f4';
const NOTE_COLOR    = '#000000';
const STAVE_COLOR   = '#888888';
const TEXT_COLOR    = '#000000';
const BORDER_COLOR  = '#cccccc';
const ACC_MAP  = { sharp: '#', flat: 'b' };

// Native VexFlow rendering dimensions (before CSS scaling).
// VexFlow places the TOP staff line at (stave_y + (num_lines-1)*spacing) = stave_y + 40.
// So NAT_STAVE_Y = desired_top_line_y - 40. We want top line at y=30.
const NAT_STAVE_X      = 12;    // stave left margin in native px
const NAT_STAVE_W      = 340;   // stave width in native px
const NAT_TOP_LINE_Y   = 30;    // where VexFlow actually draws the top staff line
const NAT_STAVE_Y      = NAT_TOP_LINE_Y - 40;   // = -10 (passed to VF.Stave)
const NAT_BOT_PAD      = 28;    // space below bottom staff line
const NAT_SPACING      = 10;    // VexFlow default staff spacing (px)
const NAT_STAFF_H      = NAT_SPACING * 4;   // 40px

const NAT_PANEL_W   = NAT_STAVE_X + NAT_STAVE_W + 10;              // 362px
const NAT_PANEL_H   = NAT_TOP_LINE_Y + NAT_STAFF_H + NAT_BOT_PAD;  // 98px

// Target staff spacing in game px (must match old StaffRenderer's STAFF_SPACE)
const STAFF_SP_GAME = 12;

export class VexFlowStaffRenderer {
    constructor(scene) {
        this.scene     = scene;
        this._el       = null;
        this._onResize = null;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    draw(cx, cy, staffWidth, question) {
        this.clear();

        if (typeof Vex === 'undefined') {
            console.error('VexFlowStaffRenderer: Vex not found — is vexflow.js loaded?');
            return;
        }

        try {
            this._render(cx, cy, question);
        } catch (err) {
            console.error('VexFlowStaffRenderer error:', err);
        }
    }

    clear() {
        if (this._el)       { this._el.remove();     this._el       = null; }
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
        // Map native VexFlow 10px spacing → STAFF_SP_GAME game px * screen scale
        const cssScale = (STAFF_SP_GAME * s) / NAT_SPACING;
        return { rect, sx, sy, cssScale };
    }

    _render(cx, cy, question) {
        const VF = Vex.Flow;

        const { rect, sx, sy, cssScale } = this._screenScale();

        // Visual (screen) dimensions after CSS scaling
        const screenW = NAT_PANEL_W * cssScale;
        const screenH = NAT_PANEL_H * cssScale;

        // Top-left corner in viewport px (fixed positioning)
        const left = rect.left + cx * sx - screenW / 2;
        const top  = rect.top  + cy * sy - screenH / 2;

        // ── Wrapper div — sized at NATIVE dimensions, CSS-scaled ───────────
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            position:        'fixed',
            pointerEvents:   'none',
            zIndex:          '100',
            left:            `${left}px`,
            top:             `${top}px`,
            width:           `${NAT_PANEL_W}px`,
            height:          `${NAT_PANEL_H}px`,
            background:      `linear-gradient(180deg, ${PANEL_BG} 0%, ${PANEL_BG_DARK} 100%)`,
            border:          `2px solid ${BORDER_COLOR}`,
            borderRadius:    '8px',
            boxShadow:       '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            overflow:        'visible',
            transformOrigin: 'top left',
            transform:       `scale(${cssScale})`,
        });
        document.body.appendChild(wrapper);
        this._el = wrapper;

        // ── VexFlow SVG renderer at native pixel dimensions ────────────────
        const renderer = new VF.Renderer(wrapper, VF.Renderer.Backends.SVG);
        renderer.resize(NAT_PANEL_W, NAT_PANEL_H);

        // Allow clef glyphs to extend outside SVG viewport
        const svg = wrapper.querySelector('svg');
        if (svg) {
            svg.style.overflow = 'visible';
            svg.setAttribute('overflow', 'visible');
        }

        const ctx = renderer.getContext();

        // Style for light background
        ctx.setFillStyle(NOTE_COLOR);
        ctx.setStrokeStyle(NOTE_COLOR);

        // ── Stave ─────────────────────────────────────────────────────────
        const stave = new VF.Stave(NAT_STAVE_X, NAT_STAVE_Y, NAT_STAVE_W)
            .addClef(question.clef)
            .setContext(ctx);
        stave.setStyle({ fillStyle: STAVE_COLOR, strokeStyle: STAVE_COLOR });
        stave.draw();

        // ── Note ──────────────────────────────────────────────────────────
        const accChar = ACC_MAP[question.accidental] || null;
        const keyStr  = `${question.noteName.toLowerCase()}/${question.octave}`;

        const note = new VF.StaveNote({
            clef:     question.clef,
            keys:     [keyStr],
            duration: 'q',
            auto_stem: true,
        });

        if (accChar) {
            note.addModifier(new VF.Accidental(accChar), 0);
        }

        // Use FormatAndDraw — simplest path, handles voice/formatter internally
        try {
            VF.Formatter.FormatAndDraw(ctx, stave, [note]);
        } catch (e) {
            // Fall back to manual voice + formatter
            const voice = new VF.Voice({ num_beats: 4, beat_value: 4 })
                .setMode(VF.Voice.Mode.SOFT)
                .addTickables([note]);
            new VF.Formatter()
                .joinVoices([voice])
                .format([voice], NAT_STAVE_W - 80);
            voice.draw(ctx, stave);
        }

        // Style SVG elements for light background
        this._styleSvg(wrapper);

        // ── Resize: reposition wrapper ─────────────────────────────────────
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

    _styleSvg(wrapper) {
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
