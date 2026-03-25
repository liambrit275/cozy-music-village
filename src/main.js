import { BootScene }            from './scenes/BootScene.js';
import { TitleScene }           from './scenes/TitleScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { TopDownScene }         from './scenes/TopDownScene.js';
import { ChallengeScene }       from './scenes/ChallengeScene.js';
import { ArcadeMenuScene }      from './scenes/ArcadeMenuScene.js';
import { SettingsScene }        from './scenes/SettingsScene.js';
import { LatencyTestScene }     from './scenes/LatencyTestScene.js';
import { AvatarBuilderScene }   from './scenes/AvatarBuilderScene.js';

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
        ArcadeMenuScene,
        SettingsScene,
        LatencyTestScene,
        AvatarBuilderScene,
    ]
};

const game = new Phaser.Game(config);
