// BootScene: preload all game assets (cozy edition)

export const AVATAR_DEFAULTS = { body: 1, top: 'basic', bottom: 'pants', hair: 'bob' };
export const TOPS_OPTIONS    = ['basic','spaghetti','sporty','stripe','floral','sailor_bow','sailor','dress','overalls','suit','pants_suit','clown','pumpkin','skull','spooky','witch'];
export const BOTTOMS_OPTIONS = ['pants','skirt'];
export const HAIR_OPTIONS    = ['bob','ponytail','braids','curly','buzzcut','wavy','long_straight','extra_long','emo','midiwave','spacebuns','french_curl','gentleman'];

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

        // ── PLAYER CHARACTER BODY LAYERS (images, not spritesheets) ──────────
        for (let i = 1; i <= 8; i++) {
            this.load.image(`char-body-${i}`,
                `assets/cozy/characters/char${i}-walk.png`
            );
        }

        // ── CLOTHES LAYERS ────────────────────────────────────────────────────
        const clothesFiles = ['basic','clown','dress','floral','overalls','pants_suit','pants','pumpkin','sailor_bow','sailor','shoes','skirt','skull','spaghetti','spooky','sporty','stripe','suit','witch'];
        clothesFiles.forEach(name => {
            this.load.image(`clothes-${name}`,
                `assets/cozy/clothes/${name}_walk.png`
            );
        });

        // ── HAIR LAYERS ───────────────────────────────────────────────────────
        const hairFiles = ['bob','braids','buzzcut','curly','emo','extra_long','french_curl','gentleman','long_straight','midiwave','ponytail','spacebuns','wavy'];
        hairFiles.forEach(name => {
            this.load.image(`hair-${name}`,
                `assets/cozy/hair/${name}_walk.png`
            );
        });

        // ── FARM ANIMALS (villagers) — 4 cols × 5 rows ─────────────────────
        const farmAnimals = [
            { name: 'bunny',       frameSize: 17 },
            { name: 'chicken',     frameSize: 16 },
            { name: 'cow',         frameSize: 24 },
            { name: 'goat',        frameSize: 19 },
            { name: 'pig',         frameSize: 20 },
            { name: 'sheep',       frameSize: 17 },
            { name: 'turkey',      frameSize: 17 },
            { name: 'bunny-baby',  frameSize: 16 },
            { name: 'chicken-baby', frameSize: 16 },
            { name: 'cow-baby',    frameSize: 21 },
        ];
        farmAnimals.forEach(a => {
            this.load.spritesheet(`villager-${a.name}`,
                `assets/cozy/animals/${a.name}.png`,
                { frameWidth: a.frameSize, frameHeight: a.frameSize }
            );
        });

        // ── TOWN ANIMALS ────────────────────────────────────────────────────
        this.load.spritesheet('villager-robin',
            'assets/cozy/animals/robin.png',
            { frameWidth: 16, frameHeight: 16 }
        );
        this.load.spritesheet('villager-blackbird',
            'assets/cozy/animals/blackbird.png',
            { frameWidth: 16, frameHeight: 16 }
        );
        this.load.spritesheet('villager-squirrel',
            'assets/cozy/animals/squirrel.png',
            { frameWidth: 19, frameHeight: 19 }
        );
        this.load.spritesheet('villager-rat',
            'assets/cozy/animals/rat.png',
            { frameWidth: 18, frameHeight: 18 }
        );

        // ── EFFECTS ─────────────────────────────────────────────────────────
        this.load.image('heart', 'assets/cozy/effects/heart.png');

        // ── ENVIRONMENT / TOP-DOWN WORLD ───────────────────────────────────
        this.load.image('nature-global',  'assets/cozy/environment/nature-global.png');
        this.load.image('outdoor-tiles',  'assets/cozy/environment/outdoor-tiles.png');

        // ── MUSIC NOTATION SYMBOLS ──────────────────────────────────────────
        this.load.image('note-quarter',   'assets/symbols/note_quarter.png');
        this.load.image('note-eighth',    'assets/symbols/note_eighth.png');
        this.load.image('note-sixteenth', 'assets/symbols/note_sixteenth.png');
        this.load.image('rest-quarter',   'assets/symbols/rest_quarter.png');
        this.load.image('rest-eighth',    'assets/symbols/rest_eighth.png');
        this.load.image('rest-sixteenth', 'assets/symbols/rest_sixteenth.png');

        // ── ZONE BACKGROUNDS (used by ArcadeBattleScene, RhythmReadingScene) ─
        this.load.image('bg-forest',      'assets/backgrounds/forest.png');
        this.load.image('bg-village',     'assets/backgrounds/village.png');
        this.load.image('bg-caves',       'assets/backgrounds/caves.png');
        this.load.image('bg-castle',      'assets/backgrounds/castle.png');
        this.load.image('bg-underworld',  'assets/backgrounds/underworld.png');
        this.load.image('bg-tower',       'assets/backgrounds/tower.png');

        // ── MONSTER SPRITESHEETS (used by ArcadeBattleScene) ────────────────
        // Keys match `monster-${spriteKey}` from monsters.js
        this.load.spritesheet('monster-slime',       'assets/monsters/slime.png',       { frameWidth: 118, frameHeight: 79 });
        this.load.spritesheet('monster-glowWisp',    'assets/monsters/glow-wisp.png',   { frameWidth: 48,  frameHeight: 48 });
        this.load.spritesheet('monster-mutantToad',   'assets/monsters/mutant-toad.png', { frameWidth: 80,  frameHeight: 64 });
        this.load.spritesheet('monster-frog',         'assets/monsters/frog.png',        { frameWidth: 63,  frameHeight: 68 });
        this.load.spritesheet('monster-wanderingBard','assets/monsters/centaur.png',     { frameWidth: 112, frameHeight: 144 });
        this.load.spritesheet('monster-shadowCrow',   'assets/monsters/crow.png',        { frameWidth: 48,  frameHeight: 48 });
        this.load.spritesheet('monster-scrollKeeper', 'assets/monsters/ghost.png',       { frameWidth: 64,  frameHeight: 80 });
        this.load.spritesheet('monster-hellHound',    'assets/monsters/hell-hound.png',  { frameWidth: 64,  frameHeight: 48 });
        this.load.spritesheet('monster-ogre',         'assets/monsters/ogre.png',        { frameWidth: 144, frameHeight: 80 });
        this.load.spritesheet('monster-guardCaptain', 'assets/monsters/treant.png',      { frameWidth: 80,  frameHeight: 84 });
        this.load.spritesheet('monster-werewolf',     'assets/monsters/werewolf.png',    { frameWidth: 96,  frameHeight: 76 });

        // ── HIT EFFECT (used by ArcadeBattleScene) ──────────────────────────
        this.load.spritesheet('hit-effect', 'assets/effects/hit.png', { frameWidth: 31, frameHeight: 32 });

        // ── NPC / GUIDE CHARACTERS (used by npcs.js, PracticeScene, ArcadeBattleScene) ─
        this.load.spritesheet('sunny-bunny',    'assets/characters/bunny.png',    { frameWidth: 24, frameHeight: 42 });
        this.load.spritesheet('sunny-froggy',   'assets/characters/froggy.png',   { frameWidth: 60, frameHeight: 38 });
        this.load.spritesheet('sunny-dragon',   'assets/characters/dragon.png',   { frameWidth: 144, frameHeight: 176 });
        this.load.spritesheet('sunny-mushroom', 'assets/characters/mushroom.png', { frameWidth: 41, frameHeight: 30 });

        // ── HERO CHARACTER (used by ArcadeMenuScene / ArcadeBattleScene) ────
        this.load.spritesheet('adventurer-idle',   'assets/characters/adventurer-idle.png',   { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('adventurer-run',    'assets/characters/adventurer-run.png',    { frameWidth: 128, frameHeight: 96 });
        this.load.spritesheet('adventurer-attack', 'assets/characters/adventurer-attack.png', { frameWidth: 128, frameHeight: 96 });
    }

    create() {
        // ── COMPOSE PLAYER AVATAR from saved settings ─────────────────────
        let avatarSettings;
        try {
            const saved = JSON.parse(localStorage.getItem('avatar-settings'));
            if (saved && saved.body) {
                // Migrate old single-clothes format to top/bottom split
                avatarSettings = {
                    body:   saved.body,
                    top:    saved.top    || saved.clothes || AVATAR_DEFAULTS.top,
                    bottom: saved.bottom || AVATAR_DEFAULTS.bottom,
                    hair:   saved.hair   || AVATAR_DEFAULTS.hair,
                };
            } else {
                avatarSettings = { ...AVATAR_DEFAULTS };
            }
        } catch (e) {
            avatarSettings = { ...AVATAR_DEFAULTS };
        }
        this._composeAvatar(avatarSettings);

        // ── AVATAR ANIMATIONS ─────────────────────────────────────────────
        this._createAnimIfNew('avatar-walk-down',  'player-avatar', 0,  7,  8, -1);
        this._createAnimIfNew('avatar-walk-up',    'player-avatar', 8,  15, 8, -1);
        this._createAnimIfNew('avatar-walk-right', 'player-avatar', 16, 23, 8, -1);
        this._createAnimIfNew('avatar-walk-left',  'player-avatar', 24, 31, 8, -1);
        this._createAnimIfNew('avatar-idle',       'player-avatar', 0,  0,  1, 0);

        // ── FARM ANIMAL ANIMATIONS (4 cols × 5 rows) ────────────────────────
        const farmNames = [
            'bunny', 'chicken', 'cow', 'goat', 'pig',
            'sheep', 'turkey', 'bunny-baby', 'chicken-baby', 'cow-baby'
        ];
        farmNames.forEach(name => {
            const sheet = `villager-${name}`;

            // Walk directions: row0=down(0-3), row1=right(4-7), row2=up(8-11), row3=left(12-15), row4=sleep(16-19)
            this._createAnimIfNew(`${name}-walk-down`,  sheet, 0,  3,  5, -1);
            this._createAnimIfNew(`${name}-walk-right`, sheet, 4,  7,  5, -1);
            this._createAnimIfNew(`${name}-walk-up`,    sheet, 8,  11, 5, -1);
            this._createAnimIfNew(`${name}-walk-left`,  sheet, 12, 15, 5, -1);
            this._createAnimIfNew(`${name}-sleep`,      sheet, 16, 19, 3, -1);

            // Idle: frame 0 only
            this._createAnimIfNew(`${name}-idle`, sheet, 0, 0, 1, 0);
        });

        // ── TOWN ANIMAL ANIMATIONS ──────────────────────────────────────────
        // Robin & blackbird: 64×128 → 4 cols × 8 rows
        // Blank frames: 3,7,10,11,14,15 — use only populated frames per direction
        ['robin', 'blackbird'].forEach(name => {
            const sheet = `villager-${name}`;
            this._createAnimIfNew(`${name}-walk-down`,  sheet, 0,  2,  5, -1); // 3 frames (frame 3 blank)
            this._createAnimIfNew(`${name}-walk-right`, sheet, 4,  6,  5, -1); // 3 frames (frame 7 blank)
            this._createAnimIfNew(`${name}-walk-up`,    sheet, 8,  9,  5, -1); // 2 frames (10-11 blank)
            this._createAnimIfNew(`${name}-walk-left`,  sheet, 12, 13, 5, -1); // 2 frames (14-15 blank)
            this._createAnimIfNew(`${name}-idle`,       sheet, 0,  0,  1, 0);
        });
        // Squirrel: 114×114 → 6 cols × 6 rows
        {
            const sheet = 'villager-squirrel';
            this._createAnimIfNew('squirrel-walk-down',  sheet, 0,  5,  5, -1);
            this._createAnimIfNew('squirrel-walk-right', sheet, 6,  11, 5, -1);
            this._createAnimIfNew('squirrel-walk-up',    sheet, 12, 17, 5, -1);
            this._createAnimIfNew('squirrel-walk-left',  sheet, 18, 23, 5, -1);
            this._createAnimIfNew('squirrel-idle',       sheet, 0,  0,  1, -1);
        }
        // Rat: 72×108 → 4 cols × 6 rows
        {
            const sheet = 'villager-rat';
            this._createAnimIfNew('rat-walk-down',  sheet, 0,  3,  5, -1);
            this._createAnimIfNew('rat-walk-right', sheet, 4,  7,  5, -1);
            this._createAnimIfNew('rat-walk-up',    sheet, 8,  11, 5, -1);
            this._createAnimIfNew('rat-walk-left',  sheet, 12, 15, 5, -1);
            this._createAnimIfNew('rat-idle',       sheet, 0,  0,  1, 0);
        }

        // ── NPC GUIDE ANIMATIONS ──────────────────────────────────────────
        this._createAnimIfNew('sunny-bunny-idle',    'sunny-bunny',    0, 3,  5, -1);
        this._createAnimIfNew('sunny-froggy-idle',   'sunny-froggy',   0, 6,  5, -1);
        this._createAnimIfNew('sunny-dragon-idle',   'sunny-dragon',   0, 11, 5, -1);
        this._createAnimIfNew('sunny-mushroom-idle', 'sunny-mushroom', 0, 9,  5, -1);

        // ── HERO ANIMATIONS (adventurer for arcade mode) ─────────────────────
        this._createAnimIfNew('adventurer-idle',   'adventurer-idle',   0, 3, 6,  -1);
        this._createAnimIfNew('adventurer-run',    'adventurer-run',    0, 7, 10, -1);
        this._createAnimIfNew('adventurer-attack', 'adventurer-attack', 0, 7, 12, 0);

        // ── TRANSITION ──────────────────────────────────────────────────────
        this.scene.start('TitleScene');
    }

    /**
     * Composite the avatar layers onto a canvas and register as 'player-avatar' texture.
     */
    _composeAvatar(settings) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const bodyIdx = (settings.body || 1) - 1; // 0-7
        const colW = 256;

        // 1. Body base
        const bodyImg = this.textures.get(`char-body-${settings.body || 1}`).getSourceImage();
        ctx.drawImage(bodyImg, 0, 0);

        // 2. Bottom layer (pants / skirt) — always required
        const bottomKey = `clothes-${settings.bottom || AVATAR_DEFAULTS.bottom}`;
        if (this.textures.exists(bottomKey)) {
            const img = this.textures.get(bottomKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }

        // 3. Top layer (shirt / full outfit) — always required
        const topKey = `clothes-${settings.top || AVATAR_DEFAULTS.top}`;
        if (this.textures.exists(topKey)) {
            const img = this.textures.get(topKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }

        // 4. Hair
        const hairKey = `hair-${settings.hair || AVATAR_DEFAULTS.hair}`;
        if (this.textures.exists(hairKey)) {
            const img = this.textures.get(hairKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }

        // Register as Phaser texture (remove old if exists)
        if (this.textures.exists('player-avatar')) this.textures.remove('player-avatar');
        this.textures.addCanvas('player-avatar', canvas);
        // Register 32 frames (8 cols × 4 rows of 32×32) so animations work correctly
        const tex = this.textures.get('player-avatar');
        for (let i = 0; i < 32; i++) {
            tex.add(i, 0, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32);
        }
    }

    /**
     * Static helper: compose avatar canvas using game.textures (callable from any scene).
     */
    static composeAvatarCanvas(game, settings) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const bodyIdx = (settings.body || 1) - 1;
        const colW = 256;
        // 1. Body
        const bodyImg = game.textures.get(`char-body-${settings.body || 1}`).getSourceImage();
        ctx.drawImage(bodyImg, 0, 0);
        // 2. Bottom
        const bottomKey = `clothes-${settings.bottom || 'pants'}`;
        if (game.textures.exists(bottomKey)) {
            const img = game.textures.get(bottomKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }
        // 3. Top
        const topKey = `clothes-${settings.top || settings.clothes || 'basic'}`;
        if (game.textures.exists(topKey)) {
            const img = game.textures.get(topKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }
        // 4. Hair
        const hairKey = `hair-${settings.hair || 'bob'}`;
        if (game.textures.exists(hairKey)) {
            const img = game.textures.get(hairKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }
        if (game.textures.exists('player-avatar')) game.textures.remove('player-avatar');
        game.textures.addCanvas('player-avatar', canvas);
        const tex = game.textures.get('player-avatar');
        for (let i = 0; i < 32; i++) {
            tex.add(i, 0, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32);
        }
        return canvas;
    }

    /**
     * Helper: create an animation if it doesn't already exist.
     */
    _createAnimIfNew(key, sheet, start, end, frameRate, repeat) {
        if (!this.anims.exists(key)) {
            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(sheet, { start, end }),
                frameRate,
                repeat
            });
        }
    }
}
