// AvatarBuilderScene: Customize your character's skin, top, bottom, and hair.
// Top and bottom are always required — the character is always fully clothed.

import { AVATAR_DEFAULTS, TOPS_OPTIONS, BOTTOMS_OPTIONS, HAIR_OPTIONS } from './BootScene.js';

const SAVE_KEY = 'avatar-settings';

export class AvatarBuilderScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AvatarBuilderScene' });
    }

    init(data) {
        this.callerScene = data.callerScene || 'SettingsScene';
        this.callerData  = data.callerData  || {};
        try {
            const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
            if (saved && saved.body) {
                this.avatar = {
                    body:   saved.body,
                    top:    saved.top    || saved.clothes || AVATAR_DEFAULTS.top,
                    bottom: saved.bottom || AVATAR_DEFAULTS.bottom,
                    hair:   saved.hair   || AVATAR_DEFAULTS.hair,
                };
            } else {
                this.avatar = { ...AVATAR_DEFAULTS };
            }
        } catch (e) {
            this.avatar = { ...AVATAR_DEFAULTS };
        }
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#1a150e');

        this.add.text(width / 2, 18, 'AVATAR BUILDER', {
            font: 'bold 22px monospace', fill: '#ffcc00',
            stroke: '#2a1a00', strokeThickness: 4
        }).setOrigin(0.5);

        // ── PREVIEW ────────────────────────────────────────────────────────
        this._previewCanvas = document.createElement('canvas');
        this._previewCanvas.width = 256;
        this._previewCanvas.height = 128;
        this.add.circle(width / 2, 72, 46, 0x2a3a1a);
        this._previewImg = null;
        this._updatePreview();

        // ── SKIN / BODY ────────────────────────────────────────────────────
        this.add.text(16, 116, 'SKIN:', { font: 'bold 11px monospace', fill: '#aabb88' });
        this._bodyBtns = [];
        for (let i = 1; i <= 8; i++) {
            const btn = this._makeBtn(
                16 + (i - 1) * 96, 130,
                `Char ${i}`, this.avatar.body === i,
                () => { this.avatar.body = i; this._refreshGroup(this._bodyBtns, 'body'); this._updatePreview(); }
            );
            this._bodyBtns.push({ val: i, field: 'body', btn });
        }

        // ── CLOTHES TOP ────────────────────────────────────────────────────
        this.add.text(16, 158, 'CLOTHES TOP:', { font: 'bold 11px monospace', fill: '#aabb88' });
        this._topBtns = this._buildGrid(TOPS_OPTIONS, 'top', 16, 172);

        // ── CLOTHES BOTTOM ─────────────────────────────────────────────────
        const bottomY = 172 + Math.ceil(TOPS_OPTIONS.length / 6) * 26 + 14;
        this.add.text(16, bottomY, 'CLOTHES BOTTOM:', { font: 'bold 11px monospace', fill: '#aabb88' });
        this._bottomBtns = this._buildGrid(BOTTOMS_OPTIONS, 'bottom', 16, bottomY + 14);

        // ── HAIR ───────────────────────────────────────────────────────────
        const hairY = bottomY + 14 + Math.ceil(BOTTOMS_OPTIONS.length / 6) * 26 + 14;
        this.add.text(16, hairY, 'HAIR:', { font: 'bold 11px monospace', fill: '#aabb88' });
        this._hairBtns = this._buildGrid(HAIR_OPTIONS, 'hair', 16, hairY + 14);

        // ── BUTTONS ────────────────────────────────────────────────────────
        this._makeSaveBtn(width, height);
        this._makeBackBtn(height);
    }

    // ── Grid builder ──────────────────────────────────────────────────────
    _buildGrid(options, field, startX, startY) {
        const perRow = 6;
        const btnW = 118;
        const btnH = 22;
        const refs = [];
        options.forEach((opt, idx) => {
            const col = idx % perRow;
            const row = Math.floor(idx / perRow);
            const x = startX + col * (btnW + 4);
            const y = startY + row * 26;
            const btn = this._makeBtn(x, y, opt.replace(/_/g, ' '), this.avatar[field] === opt, () => {
                this.avatar[field] = opt;
                refs.forEach(r => r.btn.setStyle({
                    fill:            this.avatar[field] === r.opt ? '#ffcc00' : '#888888',
                    backgroundColor: this.avatar[field] === r.opt ? '#333311' : '#222222'
                }));
                this._updatePreview();
            });
            refs.push({ opt, btn });
        });
        return refs;
    }

    _makeBtn(x, y, label, selected, cb) {
        const btn = this.add.text(x, y, label, {
            font: '10px monospace',
            fill: selected ? '#ffcc00' : '#888888',
            backgroundColor: selected ? '#333311' : '#222222',
            padding: { x: 5, y: 3 }
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', cb);
        return btn;
    }

    _refreshGroup(group, field) {
        group.forEach(({ val, btn }) => {
            const sel = this.avatar[field] === val;
            btn.setStyle({ fill: sel ? '#ffcc00' : '#888888', backgroundColor: sel ? '#333311' : '#222222' });
        });
    }

    // ── Preview ───────────────────────────────────────────────────────────
    _updatePreview() {
        const { width } = this.cameras.main;
        const canvas = this._previewCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 128);

        const bodyIdx = (this.avatar.body || 1) - 1;
        const colW = 256;

        ctx.drawImage(this.textures.get(`char-body-${this.avatar.body || 1}`).getSourceImage(), 0, 0);

        const bottomKey = `clothes-${this.avatar.bottom || 'pants'}`;
        if (this.textures.exists(bottomKey)) {
            const img = this.textures.get(bottomKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }

        const topKey = `clothes-${this.avatar.top || 'basic'}`;
        if (this.textures.exists(topKey)) {
            const img = this.textures.get(topKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }

        const hairKey = `hair-${this.avatar.hair || 'bob'}`;
        if (this.textures.exists(hairKey)) {
            const img = this.textures.get(hairKey).getSourceImage();
            ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
        }

        // Crop to frame 0 (32×32 front-facing) and show at 4x
        const crop = document.createElement('canvas');
        crop.width = 32; crop.height = 32;
        crop.getContext('2d').drawImage(canvas, 0, 0, 32, 32, 0, 0, 32, 32);

        if (this.textures.exists('avatar-preview-crop')) this.textures.remove('avatar-preview-crop');
        this.textures.addCanvas('avatar-preview-crop', crop);

        if (this._previewImg) this._previewImg.destroy();
        this._previewImg = this.add.image(width / 2, 72, 'avatar-preview-crop').setScale(4).setDepth(5);
    }

    // ── Save ──────────────────────────────────────────────────────────────
    _makeSaveBtn(width, height) {
        const btn = this.add.text(width / 2 + 60, height - 28, 'SAVE', {
            font: 'bold 18px monospace', fill: '#ffffff',
            backgroundColor: '#2a4422', padding: { x: 22, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#3a6633' }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: '#2a4422' }));
        btn.on('pointerdown', () => {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.avatar));

            // Recompose player-avatar with new settings
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const bodyIdx = (this.avatar.body || 1) - 1;
            const colW = 256;

            ctx.drawImage(this.textures.get(`char-body-${this.avatar.body || 1}`).getSourceImage(), 0, 0);

            const bk = `clothes-${this.avatar.bottom || 'pants'}`;
            if (this.textures.exists(bk)) {
                const img = this.textures.get(bk).getSourceImage();
                ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
            }

            const tk = `clothes-${this.avatar.top || 'basic'}`;
            if (this.textures.exists(tk)) {
                const img = this.textures.get(tk).getSourceImage();
                ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
            }

            const hk = `hair-${this.avatar.hair || 'bob'}`;
            if (this.textures.exists(hk)) {
                const img = this.textures.get(hk).getSourceImage();
                ctx.drawImage(img, bodyIdx * colW, 0, colW, 128, 0, 0, colW, 128);
            }

            // Update the canvas texture in-place so sprites/animations in other scenes stay valid.
            // Never remove/re-add 'player-avatar' while other scenes may be referencing it.
            if (this.textures.exists('player-avatar')) {
                const tex = this.textures.get('player-avatar');
                tex.context.clearRect(0, 0, 256, 128);
                tex.context.drawImage(canvas, 0, 0);
                tex.refresh();
            } else {
                this.textures.addCanvas('player-avatar', canvas);
                const tex = this.textures.get('player-avatar');
                for (let i = 0; i < 32; i++) {
                    tex.add(i, 0, (i % 8) * 32, Math.floor(i / 8) * 32, 32, 32);
                }
                // Create animations only on first build — frame indices never change
                this.anims.create({ key: 'avatar-walk-down',  frames: this.anims.generateFrameNumbers('player-avatar', { start: 0,  end: 7  }), frameRate: 8, repeat: -1 });
                this.anims.create({ key: 'avatar-walk-right', frames: this.anims.generateFrameNumbers('player-avatar', { start: 8,  end: 15 }), frameRate: 8, repeat: -1 });
                this.anims.create({ key: 'avatar-walk-up',    frames: this.anims.generateFrameNumbers('player-avatar', { start: 16, end: 23 }), frameRate: 8, repeat: -1 });
                this.anims.create({ key: 'avatar-walk-left',  frames: this.anims.generateFrameNumbers('player-avatar', { start: 24, end: 31 }), frameRate: 8, repeat: -1 });
                this.anims.create({ key: 'avatar-idle',       frames: this.anims.generateFrameNumbers('player-avatar', { start: 0,  end: 0  }), frameRate: 1, repeat: 0  });
            }

            this.scene.stop('AvatarBuilderScene');
            if (this.callerScene) this.scene.resume(this.callerScene);
        });
    }

    _makeBackBtn(height) {
        const btn = this.add.text(60, height - 28, '← BACK', {
            font: 'bold 16px monospace', fill: '#aaaacc',
            backgroundColor: '#111122', padding: { x: 10, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ fill: '#ffcc00' }));
        btn.on('pointerout',  () => btn.setStyle({ fill: '#aaaacc' }));
        btn.on('pointerdown', () => {
            this.scene.stop('AvatarBuilderScene');
            if (this.callerScene) this.scene.resume(this.callerScene);
        });
    }
}
