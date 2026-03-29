// AvatarBuilderScene: Pre-colored character creator with tabbed UI.
// Categories: Body, Hair, Eyes, Outfit, Bottom, Shoes, Accessories

import {
    AVATAR_DEFAULTS, BODY_OPTIONS, HAIR_COLORS, CLOTHES_COLORS, EYE_COLORS,
    BLUSH_OPTIONS, LIPSTICK_OPTIONS, HAIR_OPTIONS, OUTFIT_OPTIONS, BOTTOM_OPTIONS,
    ACCESSORY_OPTIONS
} from './BootScene.js';
import { BootScene } from './BootScene.js';
import { SaveManager } from '../systems/SaveManager.js';

const SAVE_KEY = 'avatar-settings';

// UI constants
const BG_COLOR    = '#0c1420';
const PANEL_COLOR = 0x142030;
const TAB_COLOR   = '#142030';
const TAB_ACTIVE  = '#243848';
const TEXT_DIM    = '#687880';
const TEXT_BRIGHT = '#e8d098';
const TEXT_ACCENT = '#90c8c0';
const SWATCH_SIZE = 26;
const SWATCH_GAP  = 4;

const TABS = [
    { key: 'body',   label: 'Body' },
    { key: 'hair',   label: 'Hair' },
    { key: 'eyes',   label: 'Eyes' },
    { key: 'outfit', label: 'Outfit' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'shoes',  label: 'Shoes' },
    { key: 'acc',    label: 'Acc.' },
];

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
                this.avatar = { ...AVATAR_DEFAULTS, ...saved };
            } else {
                this.avatar = { ...AVATAR_DEFAULTS };
            }
        } catch (e) {
            this.avatar = { ...AVATAR_DEFAULTS };
        }
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor(BG_COLOR);

        this.add.text(width / 2, 16, 'AVATAR BUILDER', {
            font: 'bold 20px monospace', fill: TEXT_BRIGHT,
            stroke: BG_COLOR, strokeThickness: 4
        }).setOrigin(0.5);

        // ── TABS ─────────────────────────────────────────────────────────────
        this._activeTab = 'body';
        this._tabBtns = [];
        const tabY = 44;
        const tabW = Math.floor((width - 16) / TABS.length);
        TABS.forEach((tab, i) => {
            const tx = 8 + i * tabW + tabW / 2;
            const btn = this.add.text(tx, tabY, tab.label, {
                font: 'bold 10px monospace',
                fill: this._activeTab === tab.key ? TEXT_BRIGHT : TEXT_DIM,
                backgroundColor: this._activeTab === tab.key ? TAB_ACTIVE : TAB_COLOR,
                padding: { x: 4, y: 4 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => this._switchTab(tab.key));
            this._tabBtns.push({ key: tab.key, btn });
        });

        // ── CONTENT AREA ─────────────────────────────────────────────────────
        this._contentY = tabY + 24;
        this._contentGroup = this.add.group();
        this._buildTabContent();

        // ── PREVIEW (centered between content and buttons) ────────────────────
        this._previewY = Math.round(height * 0.5);
        this._previewBg = this.add.circle(width / 2, this._previewY, 64, 0x1a2838);
        this._previewImg = null;
        this._updatePreview();

        // ── SAVE / BACK ──────────────────────────────────────────────────────
        this._makeSaveBtn(width, height);
        this._makeBackBtn(height);
    }

    // ── Tab switching ────────────────────────────────────────────────────────

    _switchTab(key) {
        this._activeTab = key;
        this._tabBtns.forEach(({ key: k, btn }) => {
            const active = k === key;
            btn.setStyle({
                fill: active ? TEXT_BRIGHT : TEXT_DIM,
                backgroundColor: active ? TAB_ACTIVE : TAB_COLOR
            });
        });
        this._buildTabContent();
    }

    _buildTabContent() {
        // Clear old content
        this._contentGroup.clear(true, true);

        const y = this._contentY;
        const { width } = this.cameras.main;

        switch (this._activeTab) {
            case 'body':   this._buildBodyTab(y, width); break;
            case 'hair':   this._buildHairTab(y, width); break;
            case 'eyes':   this._buildEyesTab(y, width); break;
            case 'outfit': this._buildOutfitTab(y, width); break;
            case 'bottom': this._buildBottomTab(y, width); break;
            case 'shoes':  this._buildShoesTab(y, width); break;
            case 'acc':    this._buildAccTab(y, width); break;
        }
    }

    // ── Tab builders ─────────────────────────────────────────────────────────

    _buildBodyTab(y, width) {
        this._addLabel('BODY TYPE', 16, y);
        const perRow = 4;
        const btnW = Math.floor((width - 32 - (perRow - 1) * 4) / perRow);
        BODY_OPTIONS.forEach((bodyIdx, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = 16 + col * (btnW + 4);
            const by = y + 18 + row * 28;
            const isSelected = this.avatar.body === bodyIdx;
            const btn = this.add.text(x, by, `Body ${bodyIdx}`, {
                font: '10px monospace',
                fill: isSelected ? TEXT_BRIGHT : TEXT_DIM,
                backgroundColor: isSelected ? TAB_ACTIVE : TAB_COLOR,
                padding: { x: 4, y: 4 },
                fixedWidth: btnW,
                align: 'center'
            }).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                this.avatar.body = bodyIdx;
                this._buildTabContent();
                this._updatePreview();
            });
            this._contentGroup.add(btn);
        });
    }

    _buildHairTab(y, width) {
        this._addLabel('HAIR STYLE', 16, y);
        this._addOptionGrid(HAIR_OPTIONS, 'hairStyle', 16, y + 18);

        const styleRows = Math.ceil(HAIR_OPTIONS.length / 5);
        const colorY = y + 18 + styleRows * 28 + 12;
        this._addLabel('HAIR COLOR', 16, colorY);
        this._addColorSwatches(HAIR_COLORS, 'hairColor', 16, colorY + 18);
    }

    _buildEyesTab(y, width) {
        this._addLabel('EYE COLOR', 16, y);
        this._addColorSwatches(EYE_COLORS, 'eyeColor', 16, y + 18);

        const eyeRows = Math.ceil(EYE_COLORS.length / 10);
        let nextY = y + 18 + eyeRows * (SWATCH_SIZE + SWATCH_GAP) + 12;

        // Blush toggle + style
        this._addToggle('BLUSH', 'blush', 16, nextY);
        if (this.avatar.blush) {
            nextY += 24;
            this._addLabel('BLUSH STYLE', 16, nextY);
            nextY += 18;
            this._addIndexOptionGrid(BLUSH_OPTIONS, 'blushIdx', 16, nextY, 5);
            nextY += 28 + 12;
        } else {
            nextY += 28;
        }

        // Lipstick toggle + style
        this._addToggle('LIPSTICK', 'lipstick', 16, nextY);
        if (this.avatar.lipstick) {
            nextY += 24;
            this._addLabel('LIPSTICK STYLE', 16, nextY);
            nextY += 18;
            this._addIndexOptionGrid(LIPSTICK_OPTIONS, 'lipstickIdx', 16, nextY, 5);
        }
    }

    _buildOutfitTab(y, width) {
        this._addLabel('OUTFIT STYLE', 16, y);
        this._addOptionGrid(OUTFIT_OPTIONS, 'outfit', 16, y + 18);

        const rows = Math.ceil(OUTFIT_OPTIONS.length / 5);
        const colorY = y + 18 + rows * 28 + 12;
        this._addLabel('OUTFIT COLOR', 16, colorY);
        this._addColorSwatches(CLOTHES_COLORS, 'outfitColor', 16, colorY + 18);
    }

    _buildBottomTab(y, width) {
        this._addLabel('BOTTOM STYLE', 16, y);
        this._addOptionGrid(BOTTOM_OPTIONS, 'bottom', 16, y + 18);

        const colorY = y + 18 + 28 + 12;
        this._addLabel('BOTTOM COLOR', 16, colorY);
        this._addColorSwatches(CLOTHES_COLORS, 'bottomColor', 16, colorY + 18);
    }

    _buildShoesTab(y, width) {
        this._addLabel('SHOES COLOR', 16, y);
        this._addColorSwatches(CLOTHES_COLORS, 'shoesColor', 16, y + 18);
    }

    _buildAccTab(y, width) {
        this._addLabel('ACCESSORY', 16, y);
        this._addOptionGrid(ACCESSORY_OPTIONS, 'accessory', 16, y + 18, 4);
    }

    // ── UI helpers ───────────────────────────────────────────────────────────

    _addLabel(text, x, y) {
        const label = this.add.text(x, y, text, {
            font: 'bold 11px monospace', fill: TEXT_ACCENT
        });
        this._contentGroup.add(label);
        return label;
    }

    _addColorSwatches(colors, field, startX, startY) {
        const perRow = 10;
        colors.forEach((color, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = startX + col * (SWATCH_SIZE + SWATCH_GAP);
            const y = startY + row * (SWATCH_SIZE + SWATCH_GAP);

            const isSelected = this.avatar[field] === color.hex;
            const swatch = this.add.graphics();
            // Border
            swatch.fillStyle(isSelected ? 0xe8d098 : 0x334455, 1);
            swatch.fillRoundedRect(x - 2, y - 2, SWATCH_SIZE + 4, SWATCH_SIZE + 4, 4);
            // Fill
            swatch.fillStyle(Phaser.Display.Color.HexStringToColor(color.hex).color, 1);
            swatch.fillRoundedRect(x, y, SWATCH_SIZE, SWATCH_SIZE, 3);

            const hitZone = this.add.zone(x + SWATCH_SIZE / 2, y + SWATCH_SIZE / 2, SWATCH_SIZE + 4, SWATCH_SIZE + 4)
                .setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', () => {
                this.avatar[field] = color.hex;
                this._buildTabContent();
                this._updatePreview();
            });

            this._contentGroup.add(swatch);
            this._contentGroup.add(hitZone);
        });
    }

    _addOptionGrid(options, field, startX, startY, perRow = 5) {
        const btnW = Math.floor((this.cameras.main.width - 32 - (perRow - 1) * 4) / perRow);
        options.forEach((opt, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = startX + col * (btnW + 4);
            const y = startY + row * 28;

            const isSelected = this.avatar[field] === opt;
            const label = opt === 'none' ? 'None' : opt.replace(/_/g, ' ');
            const btn = this.add.text(x, y, label, {
                font: '10px monospace',
                fill: isSelected ? TEXT_BRIGHT : TEXT_DIM,
                backgroundColor: isSelected ? TAB_ACTIVE : TAB_COLOR,
                padding: { x: 4, y: 4 },
                fixedWidth: btnW,
                align: 'center'
            }).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.avatar[field] = opt;
                this._buildTabContent();
                this._updatePreview();
            });

            this._contentGroup.add(btn);
        });
    }

    _addIndexOptionGrid(options, field, startX, startY, perRow = 5) {
        const btnW = Math.floor((this.cameras.main.width - 32 - (perRow - 1) * 4) / perRow);
        options.forEach((label, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = startX + col * (btnW + 4);
            const y = startY + row * 28;

            const isSelected = this.avatar[field] === i;
            const btn = this.add.text(x, y, label, {
                font: '10px monospace',
                fill: isSelected ? TEXT_BRIGHT : TEXT_DIM,
                backgroundColor: isSelected ? TAB_ACTIVE : TAB_COLOR,
                padding: { x: 4, y: 4 },
                fixedWidth: btnW,
                align: 'center'
            }).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.avatar[field] = i;
                this._buildTabContent();
                this._updatePreview();
            });

            this._contentGroup.add(btn);
        });
    }

    _addToggle(label, field, x, y) {
        const isOn = !!this.avatar[field];
        const btn = this.add.text(x, y, `${label}: ${isOn ? 'ON' : 'OFF'}`, {
            font: 'bold 11px monospace',
            fill: isOn ? TEXT_BRIGHT : TEXT_DIM,
            backgroundColor: isOn ? TAB_ACTIVE : TAB_COLOR,
            padding: { x: 6, y: 4 }
        }).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
            this.avatar[field] = !this.avatar[field];
            this._buildTabContent();
            this._updatePreview();
        });

        this._contentGroup.add(btn);
    }

    // ── Preview ──────────────────────────────────────────────────────────────

    _updatePreview() {
        const { width } = this.cameras.main;

        // Compose avatar using the same pipeline as BootScene
        const fullCanvas = BootScene._composeLayeredAvatar(this.textures, this.avatar);

        // Crop to frame 0 (32×32 front-facing) for preview
        const crop = document.createElement('canvas');
        crop.width = 32; crop.height = 32;
        const cropCtx = crop.getContext('2d');
        cropCtx.imageSmoothingEnabled = false;
        cropCtx.drawImage(fullCanvas, 0, 0, 32, 32, 0, 0, 32, 32);

        if (this.textures.exists('avatar-preview-crop')) this.textures.remove('avatar-preview-crop');
        this.textures.addCanvas('avatar-preview-crop', crop);

        if (this._previewImg) this._previewImg.destroy();
        const { height } = this.cameras.main;
        this._previewImg = this.add.image(width / 2, this._previewY, 'avatar-preview-crop')
            .setScale(7).setDepth(5);
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    _makeSaveBtn(width, height) {
        const btn = this.add.text(width / 2 + 60, height - 28, 'SAVE', {
            font: 'bold 18px monospace', fill: '#e8f0f0',
            backgroundColor: TAB_COLOR, padding: { x: 22, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setStyle({ backgroundColor: TAB_ACTIVE }));
        btn.on('pointerout',  () => btn.setStyle({ backgroundColor: TAB_COLOR }));
        btn.on('pointerdown', () => {
            SaveManager.save(SAVE_KEY, this.avatar);

            // Recompose player-avatar in place so other scenes stay valid
            if (this.textures.exists('player-avatar')) {
                const newCanvas = BootScene._composeLayeredAvatar(this.textures, this.avatar);
                const tex = this.textures.get('player-avatar');
                tex.context.clearRect(0, 0, 256, 128);
                tex.context.drawImage(newCanvas, 0, 0);
                tex.refresh();
            } else {
                BootScene.composeAvatarCanvas(this.game, this.avatar);
            }

            this.scene.stop('AvatarBuilderScene');
            this._returnToCaller();
        });
    }

    _returnToCaller() {
        if (!this.callerScene) return;
        const caller = this.scene.get(this.callerScene);
        if (caller && caller.scene.isPaused()) {
            this.scene.resume(this.callerScene);
        } else {
            this.scene.start(this.callerScene);
        }
    }

    _makeBackBtn(height) {
        const btn = this.add.text(60, height - 28, '← BACK', {
            font: 'bold 16px monospace', fill: TEXT_ACCENT,
            backgroundColor: TAB_COLOR, padding: { x: 10, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ fill: TEXT_BRIGHT }));
        btn.on('pointerout',  () => btn.setStyle({ fill: TEXT_ACCENT }));
        btn.on('pointerdown', () => {
            this.scene.stop('AvatarBuilderScene');
            this._returnToCaller();
        });
    }
}
