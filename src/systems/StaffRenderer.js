// Phaser Graphics staff renderer — single staff (treble OR bass) per question.
// Clef glyphs use Unicode characters; staff lines draw on top (correct notation order).

const STAFF_SPACE = 12;
const LINE_COLOR  = 0x1a1a1a;
const LINE_WIDTH  = 1.5;
const PANEL_BG    = 0xfafaf8;
const NOTE_RX     = 6;
const NOTE_RY     = 4.5;
const LEDGER_HW   = 14;
const CLEF_FONT   = "'Bravura','Noto Music','Apple Symbols','Segoe UI Symbol',serif";

// ── Tuning knobs — adjust these if a clef glyph looks off ──────────────────
// Treble: fontSize relative to staff space, y offset from staffTop
const TREBLE_FONT_SCALE = 9.0;   // fontSize = ss * this
const TREBLE_Y_OFFSET   = -3.2;  // y = staffTop + ss * this  (negative = above top line)

// Bass: fontSize relative to staff space, y offset from the F line (4th from bottom)
const BASS_FONT_SCALE   = 4.5;   // fontSize = ss * this
const BASS_Y_OFFSET     = -0.5;  // y = fLine + ss * this  (fLine = staffBot - 3*ss)

export class StaffRenderer {
    constructor(scene) {
        this.scene    = scene;
        this._objects = [];
    }

    // cx, cy = panel center; staffWidth = available width
    // question = { staffPosition, clef, accidental }
    draw(cx, cy, staffWidth, question) {
        this.clear();

        const ss = STAFF_SPACE;

        // ── PANEL ──────────────────────────────────────────────────────────────
        const panelW  = staffWidth + 40;
        const panelH  = ss * 4 + 100;
        const panelL  = Math.round(cx - panelW / 2);
        const panelT  = Math.round(cy - panelH / 2);
        const panelR  = panelL + panelW;

        // ── STAFF GEOMETRY ─────────────────────────────────────────────────────
        const clefW    = 46;
        const staffL   = panelL + clefW;
        const staffR   = panelR - 8;
        const staffTop = panelT + 65;
        const staffBot = staffTop + ss * 4;

        // ── STEP 1: panel background (drawn first, lowest z) ───────────────────
        const bgGfx = this.scene.add.graphics().setDepth(10);
        this._objects.push(bgGfx);
        bgGfx.fillStyle(0x000000, 0.16);
        bgGfx.fillRoundedRect(panelL + 3, panelT + 3, panelW, panelH, 5);
        bgGfx.fillStyle(PANEL_BG, 1);
        bgGfx.fillRoundedRect(panelL, panelT, panelW, panelH, 5);

        // ── STEP 2: clef text (behind staff lines) ─────────────────────────────
        if (question.clef === 'treble') {
            this._drawTrebleClef(staffL, staffTop, staffBot, ss);
        } else {
            this._drawBassClef(staffL, staffTop, staffBot, ss);
        }

        // ── STEP 3: staff lines + barlines + note (on top of clef) ────────────
        const g = this.scene.add.graphics().setDepth(12);
        this._objects.push(g);

        // Staff lines — extend left past staffL so they draw over the clef glyph
        g.lineStyle(LINE_WIDTH, LINE_COLOR, 1);
        for (let i = 0; i < 5; i++) {
            const y = Math.round(staffTop + i * ss);
            g.beginPath(); g.moveTo(staffL, y); g.lineTo(staffR, y); g.strokePath();
        }

        // Right barline only (left side is where the clef sits)
        g.lineStyle(1.5, LINE_COLOR, 1);
        g.beginPath(); g.moveTo(staffR, staffTop); g.lineTo(staffR, staffBot); g.strokePath();

        // Note + ledger lines
        const noteX = Math.round(staffL + (staffR - staffL) * 0.60);
        const noteY = this._posToY(question.staffPosition, staffBot, ss);

        this._drawLedgers(g, noteX, staffBot, question.staffPosition, ss);
        this._drawNote(g, noteX, noteY, staffBot, ss);

        if (question.accidental) {
            this._drawAccidental(g, noteX, noteY, question.accidental, ss);
        }
    }

    _posToY(pos, staffBot, ss) {
        return Math.round(staffBot - pos * (ss / 2));
    }

    // ── TREBLE CLEF ────────────────────────────────────────────────────────────
    // Positioned so spiral wraps the G line (2nd from bottom = staffBot - ss).
    // Tail extends below staffBot; top curl extends above staffTop.
    _drawTrebleClef(staffL, staffTop, staffBot, ss) {
        const fontSize = Math.round(ss * TREBLE_FONT_SCALE);
        const x        = staffL - 2;                          // left edge on the staff
        const y        = Math.round(staffTop + ss * TREBLE_Y_OFFSET);

        const txt = this.scene.add.text(x, y, '𝄞', {
            fontFamily: CLEF_FONT,
            fontSize:   `${fontSize}px`,
            color:      '#1a1a1a',
            resolution: 2,
        }).setOrigin(0, 0).setDepth(11);
        this._objects.push(txt);
    }

    // ── BASS CLEF ─────────────────────────────────────────────────────────────
    // Dots straddle the 4th line from bottom (= staffBot - 3*ss = staffTop + ss).
    _drawBassClef(staffL, staffTop, staffBot, ss) {
        const fLine    = staffBot - ss * 3;                  // 4th line from bottom
        const fontSize = Math.round(ss * BASS_FONT_SCALE);
        const x        = staffL - 2;
        const y        = Math.round(fLine + ss * BASS_Y_OFFSET);

        const txt = this.scene.add.text(x, y, '𝄢', {
            fontFamily: CLEF_FONT,
            fontSize:   `${fontSize}px`,
            color:      '#1a1a1a',
            resolution: 2,
        }).setOrigin(0, 0).setDepth(11);
        this._objects.push(txt);
    }

    // ── LEDGER LINES ───────────────────────────────────────────────────────────
    _drawLedgers(g, noteX, staffBot, pos, ss) {
        g.lineStyle(1.5, LINE_COLOR, 1);
        if (pos <= -2) {
            for (let p = -2; p >= pos; p -= 2) {
                const y = this._posToY(p, staffBot, ss);
                g.beginPath(); g.moveTo(noteX - LEDGER_HW, y); g.lineTo(noteX + LEDGER_HW, y); g.strokePath();
            }
        }
        if (pos >= 10) {
            for (let p = 10; p <= pos; p += 2) {
                const y = this._posToY(p, staffBot, ss);
                g.beginPath(); g.moveTo(noteX - LEDGER_HW, y); g.lineTo(noteX + LEDGER_HW, y); g.strokePath();
            }
        }
    }

    // ── NOTE HEAD + STEM ───────────────────────────────────────────────────────
    _drawNote(g, x, y, staffBot, ss) {
        g.fillStyle(LINE_COLOR, 1);
        g.fillEllipse(x, y, NOTE_RX * 2.2, NOTE_RY * 2);

        const midY = this._posToY(4, staffBot, ss);
        g.lineStyle(1.8, LINE_COLOR, 1);
        if (y >= midY) {
            g.beginPath(); g.moveTo(x + NOTE_RX, y); g.lineTo(x + NOTE_RX, y - ss * 3.5); g.strokePath();
        } else {
            g.beginPath(); g.moveTo(x - NOTE_RX, y); g.lineTo(x - NOTE_RX, y + ss * 3.5); g.strokePath();
        }
    }

    // ── ACCIDENTALS ────────────────────────────────────────────────────────────
    _drawAccidental(g, noteX, noteY, accidental, ss) {
        const bx = noteX - ss * 1.7;
        g.lineStyle(1.5, LINE_COLOR, 1);
        if (accidental === 'sharp') {
            g.beginPath(); g.moveTo(bx - 3, noteY - ss * 0.9); g.lineTo(bx - 3, noteY + ss * 0.9); g.strokePath();
            g.beginPath(); g.moveTo(bx + 3, noteY - ss * 0.9); g.lineTo(bx + 3, noteY + ss * 0.9); g.strokePath();
            g.lineStyle(2.2, LINE_COLOR, 1);
            g.beginPath(); g.moveTo(bx - ss * 0.5, noteY - ss * 0.25); g.lineTo(bx + ss * 0.5, noteY - ss * 0.38); g.strokePath();
            g.beginPath(); g.moveTo(bx - ss * 0.5, noteY + ss * 0.25); g.lineTo(bx + ss * 0.5, noteY + ss * 0.12); g.strokePath();
        } else {
            g.beginPath(); g.moveTo(bx, noteY - ss * 1.1); g.lineTo(bx, noteY + ss * 0.5); g.strokePath();
            g.beginPath();
            g.arc(bx + 1, noteY + ss * 0.08, ss * 0.52, -Math.PI * 0.48, Math.PI * 0.48, false);
            g.strokePath();
        }
    }

    clear() {
        this._objects.forEach(o => { if (o?.destroy) o.destroy(); });
        this._objects = [];
    }
}
