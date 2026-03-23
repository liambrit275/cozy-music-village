// BootScene: preload all game assets

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const width  = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Loading bar
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '20px monospace', fill: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x44ff44, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        // ── PLAYER CHARACTERS ─────────────────────────────────────────────────

        // Knight — 128×96 per frame
        this.load.spritesheet('knight-idle',   'assets/characters/knight-idle.png',   { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('knight-run',    'assets/characters/knight-run.png',    { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('knight-jump',   'assets/characters/knight-jump.png',   { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('knight-attack', 'assets/characters/knight-attack.png', { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('knight-hurt',   'assets/characters/knight-hurt.png',   { frameWidth: 128, frameHeight: 96 });

        // Adventurer — 128×96 per frame
        this.load.spritesheet('adventurer-idle',   'assets/characters/adventurer-idle.png',   { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('adventurer-run',    'assets/characters/adventurer-run.png',    { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('adventurer-jump',   'assets/characters/adventurer-jump.png',   { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('adventurer-attack', 'assets/characters/adventurer-attack.png', { frameWidth: 128, frameHeight: 96 });

        // Sunny animal player characters — alias texture keys used by battle scenes
        // bunny: 24×42 (4 frames), dragon: 192×176 (9 frames),
        // mushroom: 41×30 (10 frames), froggy: 42×38 (10 frames)
        this.load.spritesheet('bunny-idle',    'assets/characters/bunny.png',    { frameWidth: 24,  frameHeight: 42  });
        this.load.spritesheet('dragon-idle',   'assets/characters/dragon.png',   { frameWidth: 192, frameHeight: 176 });
        this.load.spritesheet('mushroom-idle', 'assets/characters/mushroom.png', { frameWidth: 41,  frameHeight: 30  });
        this.load.spritesheet('froggy-idle',   'assets/characters/froggy.png',   { frameWidth: 42,  frameHeight: 38  });

        // ── MONSTER SPRITES ───────────────────────────────────────────────────

        // Forest
        this.load.spritesheet('monster-slime',      'assets/monsters/slime.png',      { frameWidth: 118, frameHeight: 79  });
        this.load.spritesheet('monster-frog',       'assets/monsters/frog.png',       { frameWidth: 63,  frameHeight: 68  });
        this.load.spritesheet('monster-glowWisp',   'assets/monsters/glow-wisp.png',  { frameWidth: 48,  frameHeight: 48  });
        this.load.spritesheet('monster-mutantToad', 'assets/monsters/mutant-toad.png',{ frameWidth: 80,  frameHeight: 64  });

        // Village
        this.load.spritesheet('monster-wanderingBard', 'assets/monsters/centaur.png', { frameWidth: 112, frameHeight: 144 });
        this.load.spritesheet('monster-scrollKeeper',  'assets/monsters/ghost.png',   { frameWidth: 64,  frameHeight: 80  });

        // Caves
        this.load.spritesheet('monster-hellHound',  'assets/monsters/hell-hound.png', { frameWidth: 64,  frameHeight: 48  });
        this.load.spritesheet('monster-shadowCrow', 'assets/monsters/crow.png',       { frameWidth: 48,  frameHeight: 48  });
        this.load.spritesheet('monster-ogre',       'assets/monsters/ogre.png',       { frameWidth: 144, frameHeight: 80  });

        // Castle
        this.load.spritesheet('monster-guardCaptain', 'assets/monsters/treant.png',   { frameWidth: 80,  frameHeight: 84  });

        // Tower
        this.load.spritesheet('monster-werewolf',   'assets/monsters/werewolf.png',   { frameWidth: 96,  frameHeight: 76  });

        // ── SUNNY ANIMAL NPCs (world map rescues) ──────────────────────────────
        // Reuse the character alias sheets already loaded above
        this.load.spritesheet('sunny-bunny',    'assets/characters/bunny.png',    { frameWidth: 24,  frameHeight: 42  });
        this.load.spritesheet('sunny-froggy',   'assets/characters/froggy.png',   { frameWidth: 42,  frameHeight: 38  });
        this.load.spritesheet('sunny-dragon',   'assets/characters/dragon.png',   { frameWidth: 192, frameHeight: 176 });
        this.load.spritesheet('sunny-mushroom', 'assets/characters/mushroom.png', { frameWidth: 41,  frameHeight: 30  });

        // ── BATTLE BACKGROUNDS (per zone) ─────────────────────────────────────
        this.load.image('bg-forest',       'assets/backgrounds/forest.png');
        this.load.image('bg-forest-trees', 'assets/backgrounds/forest-trees.png');
        this.load.image('bg-village',      'assets/backgrounds/village.png');
        this.load.image('bg-caves',        'assets/backgrounds/caves.png');
        this.load.image('bg-castle',       'assets/backgrounds/castle.png');
        this.load.image('bg-underworld',   'assets/backgrounds/underworld.png');
        this.load.image('bg-tower',        'assets/backgrounds/tower.png');

        // ── MUSIC NOTATION SYMBOLS ────────────────────────────────────────────
        this.load.image('note-quarter',   'assets/symbols/note_quarter.png');
        this.load.image('note-eighth',    'assets/symbols/note_eighth.png');
        this.load.image('note-sixteenth', 'assets/symbols/note_sixteenth.png');
        this.load.image('rest-quarter',   'assets/symbols/rest_quarter.png');
        this.load.image('rest-eighth',    'assets/symbols/rest_eighth.png');
        this.load.image('rest-sixteenth', 'assets/symbols/rest_sixteenth.png');

        // ── HIT EFFECT ────────────────────────────────────────────────────────
        this.load.spritesheet('hit-effect', 'assets/effects/hit.png', { frameWidth: 31, frameHeight: 32 });
    }

    create() {
        // Hit effect animation (shared)
        if (!this.anims.exists('hit-anim')) {
            this.anims.create({
                key: 'hit-anim',
                frames: this.anims.generateFrameNumbers('hit-effect', { start: 0, end: 2 }),
                frameRate: 12, repeat: 0
            });
        }

        // ── CHARACTER ANIMATIONS ──────────────────────────────────────────────
        this._createCharAnims('knight', {
            idle:   { sheet: 'knight-idle',   start: 0, end: 3, rate: 6,  repeat: -1 },
            run:    { sheet: 'knight-run',    start: 0, end: 7, rate: 12, repeat: -1 },
            jump:   { sheet: 'knight-jump',   start: 0, end: 3, rate: 8,  repeat: 0  },
            attack: { sheet: 'knight-attack', start: 0, end: 5, rate: 12, repeat: 0  },
            hurt:   { sheet: 'knight-hurt',   start: 0, end: 2, rate: 8,  repeat: 0  },
        });
        this._createCharAnims('adventurer', {
            idle:   { sheet: 'adventurer-idle',   start: 0, end: 3, rate: 8,  repeat: -1 },
            run:    { sheet: 'adventurer-run',    start: 0, end: 7, rate: 12, repeat: -1 },
            jump:   { sheet: 'adventurer-jump',   start: 0, end: 2, rate: 8,  repeat: 0  },
            attack: { sheet: 'adventurer-attack', start: 0, end: 7, rate: 12, repeat: 0  },
            hurt:   { sheet: 'adventurer-idle',   start: 0, end: 1, rate: 8,  repeat: 0  },
        });
        this._createCharAnims('bunny', {
            idle:   { sheet: 'bunny-idle', start: 0, end: 3, rate: 6,  repeat: -1 },
            run:    { sheet: 'bunny-idle', start: 0, end: 3, rate: 10, repeat: -1 },
            jump:   { sheet: 'bunny-idle', start: 0, end: 3, rate: 8,  repeat: 0  },
            attack: { sheet: 'bunny-idle', start: 0, end: 3, rate: 12, repeat: 0  },
            hurt:   { sheet: 'bunny-idle', start: 0, end: 1, rate: 8,  repeat: 0  },
        });
        this._createCharAnims('dragon', {
            idle:   { sheet: 'dragon-idle', start: 0, end: 8, rate: 8,  repeat: -1 },
            run:    { sheet: 'dragon-idle', start: 0, end: 8, rate: 12, repeat: -1 },
            jump:   { sheet: 'dragon-idle', start: 0, end: 8, rate: 8,  repeat: 0  },
            attack: { sheet: 'dragon-idle', start: 0, end: 8, rate: 14, repeat: 0  },
            hurt:   { sheet: 'dragon-idle', start: 0, end: 2, rate: 8,  repeat: 0  },
        });
        this._createCharAnims('mushroom', {
            idle:   { sheet: 'mushroom-idle', start: 0, end: 9, rate: 8,  repeat: -1 },
            run:    { sheet: 'mushroom-idle', start: 0, end: 9, rate: 12, repeat: -1 },
            jump:   { sheet: 'mushroom-idle', start: 0, end: 9, rate: 8,  repeat: 0  },
            attack: { sheet: 'mushroom-idle', start: 0, end: 9, rate: 14, repeat: 0  },
            hurt:   { sheet: 'mushroom-idle', start: 0, end: 1, rate: 8,  repeat: 0  },
        });
        this._createCharAnims('froggy', {
            idle:   { sheet: 'froggy-idle', start: 0, end: 9, rate: 8,  repeat: -1 },
            run:    { sheet: 'froggy-idle', start: 0, end: 9, rate: 12, repeat: -1 },
            jump:   { sheet: 'froggy-idle', start: 0, end: 9, rate: 8,  repeat: 0  },
            attack: { sheet: 'froggy-idle', start: 0, end: 9, rate: 14, repeat: 0  },
            hurt:   { sheet: 'froggy-idle', start: 0, end: 1, rate: 8,  repeat: 0  },
        });

        // ── SUNNY ANIMAL NPC ANIMATIONS (world map) ───────────────────────────
        const sunnyAnims = [
            { key: 'sunny-bunny-idle',    sheet: 'sunny-bunny',    start: 0, end: 3, rate: 6  },
            { key: 'sunny-froggy-idle',   sheet: 'sunny-froggy',   start: 0, end: 9, rate: 8  },
            { key: 'sunny-dragon-idle',   sheet: 'sunny-dragon',   start: 0, end: 8, rate: 8  },
            { key: 'sunny-mushroom-idle', sheet: 'sunny-mushroom', start: 0, end: 9, rate: 8  },
        ];
        sunnyAnims.forEach(a => {
            if (!this.anims.exists(a.key)) {
                this.anims.create({
                    key: a.key,
                    frames: this.anims.generateFrameNumbers(a.sheet, { start: a.start, end: a.end }),
                    frameRate: a.rate, repeat: -1
                });
            }
        });

        this.scene.start('MenuScene');
    }

    _createCharAnims(charKey, defs) {
        Object.entries(defs).forEach(([action, cfg]) => {
            const key = `${charKey}-${action}`;
            if (!this.anims.exists(key)) {
                this.anims.create({
                    key,
                    frames: this.anims.generateFrameNumbers(cfg.sheet, { start: cfg.start, end: cfg.end }),
                    frameRate: cfg.rate,
                    repeat: cfg.repeat
                });
            }
        });
    }
}
