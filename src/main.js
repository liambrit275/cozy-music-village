import { BootScene }              from './scenes/BootScene.js';
import { LoginScene }             from './scenes/LoginScene.js';
import { InstrumentPickerScene }  from './scenes/InstrumentPickerScene.js';
import { TitleScene }             from './scenes/TitleScene.js';
import { CharacterSelectScene }   from './scenes/CharacterSelectScene.js';
import { TopDownScene }           from './scenes/TopDownScene.js';
import { ChallengeScene }        from './scenes/ChallengeScene.js';
import { ArcadeMenuScene }       from './scenes/ArcadeMenuScene.js';
import { SettingsScene }         from './scenes/SettingsScene.js';
import { LatencyTestScene }      from './scenes/LatencyTestScene.js';
import { AvatarBuilderScene }    from './scenes/AvatarBuilderScene.js';
import { TeacherDashboardScene } from './scenes/TeacherDashboardScene.js';

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
        LoginScene,
        InstrumentPickerScene,
        TitleScene,
        CharacterSelectScene,
        TopDownScene,
        ChallengeScene,
        ArcadeMenuScene,
        SettingsScene,
        LatencyTestScene,
        AvatarBuilderScene,
        TeacherDashboardScene,
    ]
};

const game = new Phaser.Game(config);
window.game = game; // Expose for testing/debugging
