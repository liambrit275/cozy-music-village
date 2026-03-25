# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Running the Game

No build step required. Start a local HTTP server from the project root:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

The game **cannot** be opened as a `file://` URL — Phaser and ES modules require an HTTP server.

## Tech Stack

- **Phaser 3.80.1** — game engine (Canvas/WebGL, scene management, input, physics)
- **Tone.js 14.7.77** — Web Audio synthesis (drone, intervals, metronome, rhythm playback)
- **VexFlow 4** — music notation rendering (SVG overlays for staff and rhythm notation)
- **Bravura** — SMuFL music font for clef glyphs
- All loaded via CDN `<script>` tags in `index.html`. No bundler, no package.json.

## Architecture

### Scene Flow
```
BootScene → TitleScene ─┬→ AvatarBuilderScene → CharacterSelectScene → TopDownScene
                        │                                                    ↓
                        │                                          ChallengeScene (story)
                        │
                        └→ ArcadeMenuScene ─┬→ LatencyTestScene
                                            └→ ChallengeScene (arcade / practice mode)

SettingsScene — launched as overlay from any scene
```

All 9 scenes are registered in `src/main.js`. Scene data is passed via `scene.start('SceneName', { ... })`.

### Key State

- **`playerData`** — plain object passed between scenes (character appearance, stats)
- **`ProgressionManager`** — story mode zone unlocks, reconstructed from `localStorage` each scene
- **`AudioEngine`** — created fresh per challenge scene, not shared between scenes

### Challenge Types (ChallengeScene)

`ChallengeScene.js` (~3000 lines) is the unified challenge scene handling all 4 question types:

1. **Tone identification** — hear an interval over a drone, identify the scale degree (solfege)
2. **Note reading** — see a note on staff (VexFlow), identify pitch name via keyboard
3. **Rhythm transcription** — hear a rhythm pattern, reproduce it on a grid (click/draw/keyboard)
4. **Rhythm reading** — see sheet music notation (VexFlow), tap the rhythm in time

It runs in 3 modes: **story** (villager rescue), **arcade** (timed encounters), and **practice** (no pressure, NPC tips).

### Key Design Patterns

**AudioEngine must be `await`ed before use.** `Tone.start()` requires a user gesture (browser policy). Challenge scenes call `await this.audioEngine.init()` in `create()`.

**VexFlow renders as DOM overlays.** `VexFlowStaffRenderer` and `RhythmNotationRenderer` create SVG `<div>` elements positioned over the Phaser canvas with CSS scaling. They must be `.clear()`'d when leaving a scene.

**RhythmSpeller converts grid → notation.** `spellPattern(groupGrid, subdivision)` takes a numeric array (0 = rest, positive = note group ID, same adjacent IDs = sustained note) and returns `SpelledNote[]` with proper durations, ties, and beat-boundary splits. Has safety guards against infinite loops.

**Rhythm grading is coverage-based (transcription) and DP-based (reading).** Transcription checks cell coverage (any note where pattern expects one). Reading uses dynamic programming to optimally match tap times to expected onsets.

## Project Harmony: Core Rules

- **No Violence:** Never use screen shakes, red flashes, or aggressive movement.
- **Input Parity:** MIDI, Keyboard, and On-Screen Buttons must always be functional.
- **Octave-Agnostic:** In serenade/tone mode, pitch register (octave) does not matter.
- **Asset Path:** Always prioritize the `/assets/cozy/` directory for active assets.

### Context Management

Never glob or list the contents of `Legacy Collection/` broadly — it contains hundreds of files and will pollute context. Only access it with a targeted path when looking for a specific named asset.

### Asset Paths

Active assets live in `assets/cozy/` with subdirectories:
- `animals/` — farm animal spritesheets (bunny, chicken, pig, goat, etc.)
- `backgrounds/` — zone background images
- `characters/` — 8 player body base sprites (char1–char8)
- `clothes/` — 19 clothing tops/bottoms
- `hair/` — 13 hairstyles
- `effects/` — visual effects (hit, particles, bed)
- `ui/` — UI elements
- `environment/` — ground tiles, terrain

If you add a new sprite, measure its actual pixel dimensions with `sips -g pixelWidth -g pixelHeight <file>` and update both `villagers.js`/`monsters.js` and `BootScene.js`.

### Scale Degrees & Solfege

Defined in `src/systems/MusicTheory.js` as `SCALE_DEGREES`. The 12 movable-Do names:
`Do Ra Re Me Mi Fa Fi Sol Le La Te Ti` (1 b2 2 b3 3 4 #4 5 b6 6 b7 7).

Zone-to-degrees mapping lives in `src/data/zones.js` (6 zones, progressively unlocking more degrees).

### Save State Keys

| Key | System | Contents |
|-----|--------|----------|
| `music-theory-rpg-save` | ProgressionManager | Story mode zone unlocks, encounters |
| `arcade-settings` | AudioEngine | Preset preferences (drone/interval/click/rhythm) |
