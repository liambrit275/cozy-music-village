// BootScene: preload all game assets (cozy edition)

// ── BODY OPTIONS (pre-colored skin tones: char1–char8) ────────────────────
export const BODY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

// ── COLOR PALETTES (index maps to column in pre-colored sprite sheets) ────
export const HAIR_COLORS = [
    { name: 'Black',       hex: '#1a1a2e' },
    { name: 'Blonde',      hex: '#e8c84a' },
    { name: 'Brown',       hex: '#6b4226' },
    { name: 'Brown Light', hex: '#a07040' },
    { name: 'Copper',      hex: '#c87830' },
    { name: 'Emerald',     hex: '#28a068' },
    { name: 'Green',       hex: '#3a8830' },
    { name: 'Grey',        hex: '#909090' },
    { name: 'Lilac',       hex: '#b890d0' },
    { name: 'Navy',        hex: '#2a3878' },
    { name: 'Pink',        hex: '#e080a0' },
    { name: 'Purple',      hex: '#7840a0' },
    { name: 'Red',         hex: '#c83030' },
    { name: 'Turquoise',   hex: '#30b0b0' },
];

export const CLOTHES_COLORS = [
    { name: 'Black',       hex: '#2a2a3a' },
    { name: 'Blue',        hex: '#3060b0' },
    { name: 'Blue Light',  hex: '#68a0d0' },
    { name: 'Brown',       hex: '#7a5030' },
    { name: 'Green',       hex: '#308838' },
    { name: 'Green Light', hex: '#68c060' },
    { name: 'Pink',        hex: '#e080a0' },
    { name: 'Purple',      hex: '#7040a0' },
    { name: 'Red',         hex: '#c03030' },
    { name: 'White',       hex: '#d8d8e0' },
];

export const EYE_COLORS = [
    { name: 'Black',       hex: '#1a1a2e' },
    { name: 'Blue',        hex: '#3868c0' },
    { name: 'Blue Light',  hex: '#68a8e0' },
    { name: 'Brown',       hex: '#7a5030' },
    { name: 'Brown Dark',  hex: '#4a3020' },
    { name: 'Brown Light', hex: '#a88050' },
    { name: 'Green',       hex: '#388838' },
    { name: 'Green Dark',  hex: '#286028' },
    { name: 'Green Light', hex: '#68c068' },
    { name: 'Grey',        hex: '#707080' },
    { name: 'Grey Light',  hex: '#a0a0b0' },
    { name: 'Pink',        hex: '#d868a0' },
    { name: 'Pink Light',  hex: '#f0a0c0' },
    { name: 'Red',         hex: '#c03030' },
];

// Blush: 5 columns in blush_all.png (index-based selection)
export const BLUSH_OPTIONS = ['Rose', 'Peach', 'Pink', 'Coral', 'Berry'];

// Lipstick: 5 columns in lipstick.png (index-based selection)
export const LIPSTICK_OPTIONS = ['Natural', 'Rose', 'Red', 'Berry', 'Dark'];

// ── OPTION ARRAYS ───────────────────────────────────────────────────────────
export const HAIR_OPTIONS = [
    'bob','braids','buzzcut','curly','emo','extra_long',
    'extra_long_skirt','french_curl','gentleman','long_straight',
    'long_straight_skirt','midiwave','ponytail','spacebuns','wavy'
];

export const OUTFIT_OPTIONS = [
    'basic','spaghetti','sporty','stripe','floral','sailor','sailor_bow',
    'dress','overalls','suit','skull',
    'clown_blue','clown_red','pumpkin','spooky','witch'
];

export const BOTTOM_OPTIONS = ['pants','skirt'];

export const ACCESSORY_OPTIONS = [
    'none','beard','glasses','glasses_sun',
    'earring_emerald','earring_emerald_silver','earring_red','earring_red_silver',
    'hat_cowboy','hat_lucky','hat_pumpkin','hat_pumpkin_purple','hat_witch'
];

// ── AVATAR DEFAULTS ─────────────────────────────────────────────────────────
export const AVATAR_DEFAULTS = {
    body:        1,          // 1-8 → char1.png–char8.png
    eyeColor:    '#7a5030',  // hex → index in EYE_COLORS → column
    hairStyle:   'bob',
    hairColor:   '#6b4226',  // hex → index in HAIR_COLORS → column
    outfit:      'basic',
    outfitColor: '#3060b0',  // hex → index in CLOTHES_COLORS → column
    bottom:      'pants',
    bottomColor: '#2a2a3a',  // hex → index in CLOTHES_COLORS → column
    shoesColor:  '#2a2a3a',  // hex → index in CLOTHES_COLORS → column
    blush:       false,
    blushIdx:    0,          // 0-4 → column in blush_all.png
    lipstick:    false,
    lipstickIdx: 0,          // 0-4 → column in lipstick.png
    accessory:   'none',
};

// Legacy exports for backward compat
export const TOPS_OPTIONS    = OUTFIT_OPTIONS;
export const BOTTOMS_OPTIONS = BOTTOM_OPTIONS;

// ── File-name mappings (handle trailing spaces in asset filenames) ─────────
const HAIR_FILE_MAP = {
    'bob': 'bob ',
    'long_straight': 'long_straight ',
    'ponytail': 'ponytail ',
};

const CLOTHES_FILE_MAP = {
    'dress': 'dress ',
    'spooky': 'spooky ',
};

// Themed outfits: fixed column, not affected by color selection
const THEMED_OUTFITS = {
    'clown_blue': { file: 'clown', col: 0 },
    'clown_red':  { file: 'clown', col: 1 },
    'pumpkin':    { file: 'pumpkin', col: 0 },
    'spooky':     { file: 'spooky', col: 0 },
    'witch':      { file: 'witch', col: 0 },
};

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
        progressBox.fillStyle(0x243848, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '20px monospace', fill: '#e8f0f0'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x50d0b0, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        // Track failed asset loads — create placeholder textures so sprites never crash
        this._failedAssets = [];
        this.load.on('loaderror', (file) => {
            console.warn('Asset failed to load:', file.key, file.url);
            this._failedAssets.push(file.key);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();

            // Create placeholder textures for any assets that failed to load
            if (this._failedAssets.length > 0) {
                console.warn('Creating placeholders for failed assets:', this._failedAssets);
                this._failedAssets.forEach(key => {
                    if (!this.textures.exists(key)) {
                        const c = document.createElement('canvas');
                        c.width = 32; c.height = 32;
                        const ctx = c.getContext('2d');
                        ctx.fillStyle = '#ff00ff';
                        ctx.fillRect(0, 0, 32, 32);
                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, 16, 16);
                        ctx.fillRect(16, 16, 16, 16);
                        this.textures.addCanvas(key, c);
                    }
                });
            }
        });

        // ── PRE-COLORED CHARACTER BODIES (char1–char8) ─────────────────────
        for (let i = 1; i <= 8; i++) {
            this.load.image(`body-${i}`, `Character v.2/characters/char${i}.png`);
        }

        // ── PRE-COLORED EYES / FACE ────────────────────────────────────────
        this.load.image('eyes',     'Character v.2/eyes/eyes.png');
        this.load.image('blush',    'Character v.2/eyes/blush_all.png');
        this.load.image('lipstick', 'Character v.2/eyes/lipstick .png');

        // ── PRE-COLORED CLOTHES ────────────────────────────────────────────
        const clothesFiles = [
            'basic','clown','dress','floral','overalls','pants','pants_suit',
            'pumpkin','sailor','sailor_bow','shoes','skirt','skull',
            'spaghetti','spooky','sporty','stripe','suit','witch'
        ];
        clothesFiles.forEach(name => {
            const file = CLOTHES_FILE_MAP[name] || name;
            this.load.image(`clothes-${name}`, `Character v.2/clothes/${file}.png`);
        });

        // ── PRE-COLORED HAIR ───────────────────────────────────────────────
        HAIR_OPTIONS.forEach(name => {
            const file = HAIR_FILE_MAP[name] || name;
            this.load.image(`hair-${name}`, `Character v.2/hair/${file}.png`);
        });

        // ── ACCESSORIES (pre-colored, multi-column for beard/glasses) ──────
        const accFiles = [
            'beard','glasses','glasses_sun',
            'earring_emerald','earring_emerald_silver','earring_red','earring_red_silver',
            'hat_cowboy','hat_lucky','hat_pumpkin','hat_pumpkin_purple','hat_witch'
        ];
        accFiles.forEach(name => {
            this.load.image(`acc-${name}`, `Character v.2/acc/${name}.png`);
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

        // ── UI ASSETS ──────────────────────────────────────────────────────
        this.load.image('ui-buttons', 'assets/cozy/ui/buttons.png');
        this.load.image('ui-panels',  'assets/cozy/ui/panels.png');

        // ── EFFECTS ─────────────────────────────────────────────────────────
        this.load.image('heart', 'assets/cozy/effects/heart.png');

        // ── INTERIOR PROPS ──────────────────────────────────────────────────
        this.load.image('bed', 'assets/cozy/effects/bed.png');
        this.load.image('bed-base', 'assets/cozy/effects/bed-base.png');
        this.load.image('bed-blanket', 'assets/cozy/effects/bed-blanket.png');

        // ── ENVIRONMENT / TOP-DOWN WORLD ─────────────────────────────────────
        this.load.image('nature-global',  'assets/cozy/environment/nature-global.png');
        this.load.image('outdoor-tiles',  'assets/cozy/environment/outdoor-tiles.png');

        // ── MUSIC NOTATION SYMBOLS ──────────────────────────────────────────
        this.load.image('note-quarter',   'assets/symbols/note_quarter.png');
        this.load.image('note-eighth',    'assets/symbols/note_eighth.png');
        this.load.image('note-sixteenth', 'assets/symbols/note_sixteenth.png');
        this.load.image('rest-quarter',   'assets/symbols/rest_quarter.png');
        this.load.image('rest-eighth',    'assets/symbols/rest_eighth.png');
        this.load.image('rest-sixteenth', 'assets/symbols/rest_sixteenth.png');

        // ── ZONE BACKGROUNDS ─────────────────────────────────────────────────
        this.load.image('bg-forest',      'assets/backgrounds/forest.png');
        this.load.image('bg-village',     'assets/backgrounds/village.png');
        this.load.image('bg-caves',       'assets/backgrounds/caves.png');
        this.load.image('bg-castle',      'assets/backgrounds/castle.png');
        this.load.image('bg-underworld',  'assets/backgrounds/underworld.png');
        this.load.image('bg-tower',       'assets/backgrounds/tower.png');

        // ── MONSTER SPRITESHEETS ──────────────────────────────────────────────
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

        // ── HIT EFFECT ────────────────────────────────────────────────────────
        this.load.spritesheet('hit-effect', 'assets/effects/hit.png', { frameWidth: 31, frameHeight: 32 });

        // ── NPC / GUIDE CHARACTERS ───────────────────────────────────────────
        this.load.spritesheet('sunny-bunny',    'assets/characters/bunny.png',    { frameWidth: 24, frameHeight: 42 });
        this.load.spritesheet('sunny-froggy',   'assets/characters/froggy.png',   { frameWidth: 60, frameHeight: 38 });
        this.load.spritesheet('sunny-dragon',   'assets/characters/dragon.png',   { frameWidth: 144, frameHeight: 176 });
        this.load.spritesheet('sunny-mushroom', 'assets/characters/mushroom.png', { frameWidth: 41, frameHeight: 30 });

        // ── HERO CHARACTER ──────────────────────────────────────────────────
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
                // New pre-colored format
                avatarSettings = { ...AVATAR_DEFAULTS, ...saved };
            } else if (saved && saved.skinColor) {
                // Migrate from old greyscale format — keep compatible fields
                avatarSettings = { ...AVATAR_DEFAULTS };
                if (saved.hairStyle && HAIR_OPTIONS.includes(saved.hairStyle)) avatarSettings.hairStyle = saved.hairStyle;
                if (saved.hairColor) avatarSettings.hairColor = saved.hairColor;
                if (saved.eyeColor) avatarSettings.eyeColor = saved.eyeColor;
                if (saved.outfit && OUTFIT_OPTIONS.includes(saved.outfit)) avatarSettings.outfit = saved.outfit;
                if (saved.outfitColor) avatarSettings.outfitColor = saved.outfitColor;
                if (saved.bottom) avatarSettings.bottom = saved.bottom;
                if (saved.bottomColor) avatarSettings.bottomColor = saved.bottomColor;
                if (saved.shoesColor) avatarSettings.shoesColor = saved.shoesColor;
                if (saved.accessory) avatarSettings.accessory = saved.accessory;
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

        // ── FARMER NPC — compose from layered sprites ─────────────────────
        const farmerSettings = {
            body: 3,
            eyeColor: '#7a5030',
            hairStyle: 'gentleman',
            hairColor: '#909090',   // Grey
            outfit: 'overalls',
            outfitColor: '#3060b0', // Blue overalls
            bottom: 'pants',
            bottomColor: '#7a5030', // Brown pants
            shoesColor: '#7a5030',
            blush: false,
            lipstick: false,
            accessory: 'beard',
        };
        const farmerCanvas = BootScene._composeLayeredAvatar(this.textures, farmerSettings);
        if (this.textures.exists('farmer-walk')) this.textures.remove('farmer-walk');
        this.textures.addCanvas('farmer-walk', farmerCanvas);
        const farmerTex = this.textures.get('farmer-walk');
        for (let i = 0; i < 32; i++) {
            farmerTex.add(i, 0, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32);
        }
        this._createAnimIfNew('farmer-walk-down',  'farmer-walk', 0,  7,  8, -1);
        this._createAnimIfNew('farmer-walk-up',    'farmer-walk', 8,  15, 8, -1);
        this._createAnimIfNew('farmer-walk-right', 'farmer-walk', 16, 23, 8, -1);
        this._createAnimIfNew('farmer-walk-left',  'farmer-walk', 24, 31, 8, -1);
        this._createAnimIfNew('farmer-idle',       'farmer-walk', 0,  0,  1, 0);

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
            // Squirrel: 114×114 @ 19×19 = 6 cols × 6 rows
            // Row 0 (0-5): walk down (6 frames), Row 1 (6-11): walk right (6 frames)
            // Row 2 (12-13): walk up (2 frames), Row 3 (18-19): walk left (2 frames)
            const sheet = 'villager-squirrel';
            this._createAnimIfNew('squirrel-walk-down',  sheet, 0,  5,  5, -1);
            this._createAnimIfNew('squirrel-walk-right', sheet, 6,  11, 5, -1);
            this._createAnimIfNew('squirrel-walk-up',    sheet, 12, 13, 5, -1);
            this._createAnimIfNew('squirrel-walk-left',  sheet, 18, 19, 5, -1);
            this._createAnimIfNew('squirrel-idle',       sheet, 0,  0,  1, -1);
        }
        // Rat: 72×108 → 4 cols × 6 rows
        {
            // Rat: 72×108 @ 18×18 = 4 cols × 6 rows
            // Row 0 (0-3): walk down (4 frames), Row 1 (4-7): walk right (4 frames)
            // Row 2 (8-9): walk up (2 frames), Row 3 (12-13): walk left (2 frames)
            const sheet = 'villager-rat';
            this._createAnimIfNew('rat-walk-down',  sheet, 0,  3,  5, -1);
            this._createAnimIfNew('rat-walk-right', sheet, 4,  7,  5, -1);
            this._createAnimIfNew('rat-walk-up',    sheet, 8,  9,  5, -1);
            this._createAnimIfNew('rat-walk-left',  sheet, 12, 13, 5, -1);
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
        this.scene.start('LoginScene');
    }

    /**
     * Composite the avatar layers onto a canvas and register as 'player-avatar' texture.
     * Uses pre-colored sprites with column selection.
     */
    _composeAvatar(settings) {
        const canvas = BootScene._composeLayeredAvatar(this.textures, settings);

        if (this.textures.exists('player-avatar')) {
            // Update canvas in place — keeps existing animation frame references valid
            const tex = this.textures.get('player-avatar');
            tex.context.clearRect(0, 0, 256, 128);
            tex.context.drawImage(canvas, 0, 0);
            tex.refresh();
        } else {
            // First time: create texture and add frame data
            this.textures.addCanvas('player-avatar', canvas);
            const tex = this.textures.get('player-avatar');
            for (let i = 0; i < 32; i++) {
                tex.add(i, 0, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32);
            }
        }
    }

    /**
     * Static helper: compose avatar canvas using game.textures (callable from any scene).
     */
    static composeAvatarCanvas(game, settings) {
        const canvas = BootScene._composeLayeredAvatar(game.textures, settings);

        if (game.textures.exists('player-avatar')) game.textures.remove('player-avatar');
        game.textures.addCanvas('player-avatar', canvas);
        const tex = game.textures.get('player-avatar');
        for (let i = 0; i < 32; i++) {
            tex.add(i, 0, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32);
        }
        return canvas;
    }

    /**
     * Core compositing: layer pre-colored sprites → 256×128 walk canvas.
     * Each multi-column sheet has color variants as columns (256px wide each).
     * We select the correct column based on the chosen color index.
     */
    static _composeLayeredAvatar(textures, settings) {
        const W = 256, H = 128;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw one column (256×128 walk region) from a multi-column sprite sheet
        const drawCol = (texKey, colIndex) => {
            if (!textures.exists(texKey)) return;
            const img = textures.get(texKey).getSourceImage();
            // Clamp column index to available columns
            const maxCols = Math.floor(img.width / W);
            const col = Math.min(colIndex, maxCols - 1);
            ctx.drawImage(img, col * W, 0, W, H, 0, 0, W, H);
        };

        // Layer order from info.txt:
        // 1. Character body
        const bodyIdx = settings.body || AVATAR_DEFAULTS.body;
        drawCol(`body-${bodyIdx}`, 0);

        // 2. Eyes → Blush → Lipstick
        const eyeColIdx = Math.max(0, EYE_COLORS.findIndex(c => c.hex === settings.eyeColor));
        drawCol('eyes', eyeColIdx);

        if (settings.blush) {
            const blushIdx = settings.blushIdx ?? AVATAR_DEFAULTS.blushIdx;
            drawCol('blush', blushIdx);
        }
        if (settings.lipstick) {
            const lipIdx = settings.lipstickIdx ?? AVATAR_DEFAULTS.lipstickIdx;
            drawCol('lipstick', lipIdx);
        }

        // 3. Clothes: Outfit (shirt) → Bottom (pants/skirt) → Shoes
        const outfit = settings.outfit || AVATAR_DEFAULTS.outfit;
        const clothesColIdx = Math.max(0, CLOTHES_COLORS.findIndex(c => c.hex === settings.outfitColor));

        if (THEMED_OUTFITS[outfit]) {
            const { file, col } = THEMED_OUTFITS[outfit];
            drawCol(`clothes-${file}`, col);
        } else {
            drawCol(`clothes-${outfit}`, clothesColIdx);
        }

        const bottom = settings.bottom || AVATAR_DEFAULTS.bottom;
        const bottomColIdx = Math.max(0, CLOTHES_COLORS.findIndex(c => c.hex === settings.bottomColor));
        drawCol(`clothes-${bottom}`, bottomColIdx);

        const shoesColIdx = Math.max(0, CLOTHES_COLORS.findIndex(c => c.hex === settings.shoesColor));
        drawCol('clothes-shoes', shoesColIdx);

        // 4. Hair
        const hair = settings.hairStyle || AVATAR_DEFAULTS.hairStyle;
        const hairColIdx = Math.max(0, HAIR_COLORS.findIndex(c => c.hex === settings.hairColor));
        drawCol(`hair-${hair}`, hairColIdx);

        // 5. Accessories: Beard → Glasses → Hat/Earring/Mask
        const acc = settings.accessory || 'none';
        if (acc !== 'none') {
            const accKey = `acc-${acc}`;
            if (textures.exists(accKey)) {
                if (acc === 'beard') {
                    // Beard has 14 columns matching hair colors
                    const colIdx = Math.max(0, HAIR_COLORS.findIndex(c => c.hex === settings.hairColor));
                    drawCol(accKey, colIdx);
                } else if (acc === 'glasses' || acc === 'glasses_sun') {
                    // Glasses have 10 columns matching clothes colors
                    const colIdx = Math.max(0, CLOTHES_COLORS.findIndex(c => c.hex === settings.outfitColor));
                    drawCol(accKey, colIdx);
                } else {
                    // Single-variant accessories — column 0
                    drawCol(accKey, 0);
                }
            }
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
