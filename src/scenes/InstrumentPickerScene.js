// InstrumentPickerScene: Shown on first login to choose instrument.

import { UserProfileManager } from '../systems/UserProfileManager.js';
import { INSTRUMENT_PROFILES } from '../data/levels.js';

const INSTRUMENTS = Object.entries(INSTRUMENT_PROFILES).map(([id, p]) => ({
    id, label: p.label, clef: p.clef,
}));

export class InstrumentPickerScene extends Phaser.Scene {
    constructor() { super({ key: 'InstrumentPickerScene' }); }

    init(data) {
        this._username = data.username || UserProfileManager.getActiveUser() || '';
        this._isNew = data.isNew || false;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#0c1420');

        this.add.text(width / 2, height * 0.18, 'Welcome, ' + this._username + '!', {
            font: 'bold 24px monospace', fill: '#e8d098',
            stroke: '#0c1420', strokeThickness: 3,
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.30, 'What instrument do you play?', {
            font: '16px monospace', fill: '#90c8c0',
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.37, 'This sets the clef and note range for your lessons.', {
            font: '11px monospace', fill: '#556666',
        }).setOrigin(0.5);

        const cols = 3, btnW = 180, btnH = 60, gapX = 20, gapY = 16;
        const startX = width / 2 - ((cols * btnW + (cols - 1) * gapX) / 2) + btnW / 2;
        const startY = height * 0.46;

        INSTRUMENTS.forEach((inst, i) => {
            const x = startX + (i % cols) * (btnW + gapX);
            const y = startY + Math.floor(i / cols) * (btnH + gapY);
            const clefLabel = inst.clef === 'both' ? 'treble + bass' : inst.clef + ' clef';

            const bg = this.add.rectangle(x, y, btnW, btnH, 0x1a2838)
                .setStrokeStyle(2, 0x243848).setInteractive({ useHandCursor: true });
            this.add.text(x, y - 8, inst.label, {
                font: 'bold 16px monospace', fill: '#e8d098',
            }).setOrigin(0.5);
            this.add.text(x, y + 14, clefLabel, {
                font: '10px monospace', fill: '#687880',
            }).setOrigin(0.5);

            bg.on('pointerover', () => bg.setStrokeStyle(2, 0x50d0b0));
            bg.on('pointerout', () => bg.setStrokeStyle(2, 0x243848));
            bg.on('pointerdown', () => {
                UserProfileManager.saveInstrument(inst.id);
                if (this._isNew) {
                    this.scene.start('AvatarBuilderScene', { callerScene: 'TitleScene' });
                } else {
                    this.scene.start('TitleScene');
                }
            });
        });
    }
}
