import { BootScene }            from './scenes/BootScene.js';
import { TitleScene }           from './scenes/TitleScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { TopDownScene }         from './scenes/TopDownScene.js';
import { ChallengeScene }       from './scenes/ChallengeScene.js';
import { PracticeMenuScene }    from './scenes/PracticeMenuScene.js';
import { RhythmReadingScene }   from './scenes/RhythmReadingScene.js';
import { SettingsScene }        from './scenes/SettingsScene.js';
import { PracticeScene }        from './scenes/PracticeScene.js';
import { LatencyTestScene }     from './scenes/LatencyTestScene.js';
import { AvatarBuilderScene }   from './scenes/AvatarBuilderScene.js';
import { ArcadeMenuScene }      from './scenes/ArcadeMenuScene.js';
import { ArcadeBattleScene }    from './scenes/ArcadeBattleScene.js';
import { LocationInfoScene }    from './scenes/LocationInfoScene.js';
import { RegionMapScene }       from './scenes/RegionMapScene.js';
import { SidescrollScene }      from './scenes/SidescrollScene.js';
import { WorldMapScene }        from './scenes/WorldMapScene.js';

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
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [
        BootScene,
        TitleScene,
        CharacterSelectScene,
        TopDownScene,
        ChallengeScene,
        PracticeMenuScene,
        RhythmReadingScene,
        SettingsScene,
        PracticeScene,
        LatencyTestScene,
        AvatarBuilderScene,
        ArcadeMenuScene,
        ArcadeBattleScene,
        LocationInfoScene,
        RegionMapScene,
        SidescrollScene,
        WorldMapScene
    ]
};

const game = new Phaser.Game(config);
