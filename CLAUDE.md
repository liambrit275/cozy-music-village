# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step required. Start a local HTTP server from the project root:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

The game **cannot** be opened as a `file://` URL — Phaser and ES modules require an HTTP server.

## Architecture

### Scene Flow
```
BootScene → MenuScene → OverworldScene ↔ BattleScene → VictoryScene
                                ↑                              |
                                └──────────────────────────────┘
```

Scene data is passed via `scene.start('SceneName', { progression, playerData, ... })`. The `ProgressionManager` and `playerData` (plain object) are the two key pieces of cross-scene state. `ProgressionManager` is never serialized as a class across scenes — it's reconstructed from `localStorage`.

### Key Design Patterns

**CombatManager is UI-agnostic.** It drives the battle turn machine (state enum in `COMBAT_STATES`) and fires `onStateChange(state, data)` callbacks. `BattleScene` registers that callback and handles all rendering. Adding new combat mechanics means touching `CombatManager`, then updating `BattleScene.handleStateChange()`.

**AudioEngine must be `await`ed before use.** `Tone.start()` requires a user gesture (browser policy). `BattleScene.create()` is `async` and calls `await this.audioEngine.init()`. The engine is created fresh per battle — it is not shared between scenes.

**Monster sprite scaling is normalized by frame height.** `Monster.js` calculates `targetHeight / frameH` so all monsters display at a consistent visual size regardless of source sprite dimensions. The raw frame dimensions are defined in `src/data/monsters.js` and must match the actual PNG sprite sheets exactly.

**ProgressionManager controls available scale degrees.** `zone.scaleDegrees` from `zones.js` determines which solfege buttons appear in battle. When adding a new zone or reordering unlocks, edit `ZONES` in `src/data/zones.js`.

### Context Management

Never glob or list the contents of `Legacy Collection/` broadly — it contains hundreds of files and will pollute context. Only access it with a targeted path when looking for a specific named asset.

### Asset Paths

All Legacy Collection assets live directly in `project-root/Legacy Collection/`.

Sprite sheet frame dimensions (px) for reference:
| Key | Width×Height | Frames |
|---|---|---|
| player-idle/run/attack/hurt | 128×96 | 4/12/6/3 |
| slime | 118×79 | 4 |
| frog | 63×68 | 6 |
| ogre | 144×80 | 4 |
| hellHound | 64×48 | 11 |
| fireSkull | 96×112 | 8 |
| vampire | 121×110 | 4 |
| witch | 55×93 | 5 |
| demon | 160×144 | 6 |
| hellBeast | 80×160 | 6 |
| nightmare | 160×96 | 4 |
| werewolf | 96×76 | 5 |
| hit-effect | 31×32 | 3 |

If you add a new sprite, measure its actual pixel dimensions with `sips -g pixelWidth -g pixelHeight <file>` and update both `monsters.js` and `BootScene.js`.

### Scale Degrees & Solfege
Defined in `src/systems/MusicTheory.js` as `SCALE_DEGREES`. The 12 movable-Do names:
`Do Ra Re Me Mi Fa Fi Sol Le La Te Ti` (1 b2 2 b3 3 4 #4 5 b6 6 b7 7).

Zone-to-degrees mapping lives in `src/data/zones.js`.
