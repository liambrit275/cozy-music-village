import { BootScene }            from './scenes/BootScene.js';
import { MenuScene }            from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { SidescrollScene }      from './scenes/SidescrollScene.js';
import { BattleScene }          from './scenes/BattleScene.js';
import { VictoryScene }         from './scenes/VictoryScene.js';
import { ArcadeMenuScene }      from './scenes/ArcadeMenuScene.js';
import { WorldMapScene }        from './scenes/WorldMapScene.js';
import { RegionMapScene }       from './scenes/RegionMapScene.js';
import { LocationInfoScene }    from './scenes/LocationInfoScene.js';
import { RhythmGridScene }       from './scenes/RhythmGridScene.js';
import { RhythmReadingScene }    from './scenes/RhythmReadingScene.js';
import { ArcadeBattleScene }     from './scenes/ArcadeBattleScene.js';
import { SettingsScene }       from './scenes/SettingsScene.js';
import { PracticeScene }       from './scenes/PracticeScene.js';
import { LatencyTestScene }    from './scenes/LatencyTestScene.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    pixelArt: true,
    roundPixels: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },  // per-body gravity set on player in SidescrollScene
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [
        BootScene,
        MenuScene,
        CharacterSelectScene,
        SidescrollScene,
        BattleScene,
        VictoryScene,
        ArcadeMenuScene,
        WorldMapScene,
        RegionMapScene,
        LocationInfoScene,
        RhythmGridScene,
        RhythmReadingScene,
        ArcadeBattleScene,
        SettingsScene,
        PracticeScene,
        LatencyTestScene
    ]
};

const game = new Phaser.Game(config);
