import { BootScene }            from './scenes/BootScene.js';
import { TitleScene }           from './scenes/TitleScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { TopDownScene }         from './scenes/TopDownScene.js';
import { ChallengeScene }       from './scenes/ChallengeScene.js';
import { RewardScene }          from './scenes/RewardScene.js';
import { PracticeMenuScene }    from './scenes/PracticeMenuScene.js';
import { RhythmGridScene }      from './scenes/RhythmGridScene.js';
import { RhythmReadingScene }   from './scenes/RhythmReadingScene.js';
import { FishingScene }         from './scenes/FishingScene.js';
import { BugCatchScene }        from './scenes/BugCatchScene.js';
import { SettingsScene }        from './scenes/SettingsScene.js';
import { PracticeScene }        from './scenes/PracticeScene.js';
import { LatencyTestScene }     from './scenes/LatencyTestScene.js';
import { AvatarBuilderScene }   from './scenes/AvatarBuilderScene.js';
import { MenuScene }            from './scenes/MenuScene.js';
import { ArcadeMenuScene }      from './scenes/ArcadeMenuScene.js';
import { ArcadeBattleScene }    from './scenes/ArcadeBattleScene.js';
import { ArcadeScene }          from './scenes/ArcadeScene.js';
import { BattleScene }          from './scenes/BattleScene.js';
import { DialogueScene }        from './scenes/DialogueScene.js';
import { FarmScene }            from './scenes/FarmScene.js';
import { LocationInfoScene }    from './scenes/LocationInfoScene.js';
import { OverworldScene }       from './scenes/OverworldScene.js';
import { RegionMapScene }       from './scenes/RegionMapScene.js';
import { SidescrollScene }      from './scenes/SidescrollScene.js';
import { VictoryScene }         from './scenes/VictoryScene.js';
import { VillageScene }         from './scenes/VillageScene.js';
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
        RewardScene,
        PracticeMenuScene,
        RhythmGridScene,
        RhythmReadingScene,
        FishingScene,
        BugCatchScene,
        SettingsScene,
        PracticeScene,
        LatencyTestScene,
        AvatarBuilderScene,
        MenuScene,
        ArcadeMenuScene,
        ArcadeBattleScene,
        ArcadeScene,
        BattleScene,
        DialogueScene,
        FarmScene,
        LocationInfoScene,
        OverworldScene,
        RegionMapScene,
        SidescrollScene,
        VictoryScene,
        VillageScene,
        WorldMapScene
    ]
};

const game = new Phaser.Game(config);
