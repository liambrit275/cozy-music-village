// TitleScene: Cozy title screen with Play / Practice split

import { ProgressionManager } from '../systems/ProgressionManager.js';
import { UserProfileManager } from '../systems/UserProfileManager.js';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        this.cameras.main.setBackgroundColor('#0c1420');

        // Floating particles
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2 + 1;
            const colors = [0x90c8c0, 0x50d0b0, 0xe8d098, 0x687880];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const leaf = this.add.circle(x, y, size, color, Math.random() * 0.3 + 0.15);
            this.tweens.add({
                targets: leaf,
                y: y + 20 + Math.random() * 30,
                alpha: { from: leaf.alpha, to: 0.05 },
                duration: 3000 + Math.random() * 4000,
                yoyo: true,
                repeat: -1
            });
        }

        // Title
        this.add.text(width / 2, height / 4 - 10, 'MUSIC THEORY\nVILLAGE', {
            font: 'bold 48px monospace',
            fill: '#e8d098',
            align: 'center',
            stroke: '#0c1420',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, height / 4 + 80, 'Train Your Ear, Help the Village', {
            font: '18px monospace',
            fill: '#90c8c0'
        }).setOrigin(0.5);

        // --- Mode selection ---
        this.add.text(width / 2, height / 2 - 10, 'WHAT WOULD YOU LIKE TO DO?', {
            font: '14px monospace',
            fill: '#687880'
        }).setOrigin(0.5);

        // STORY button (wooden)
        this._createWoodButton(width / 2 - 100, height / 2 + 40, 'STORY', 'btn-start', 'btn-start-hover', () => {
            this.scene.start('CharacterSelectScene', { isNewGame: true });
        });

        // ARCADE button (wooden)
        this._createWoodButton(width / 2 + 100, height / 2 + 40, 'ARCADE', 'btn-exit', 'btn-exit-hover', () => {
            this.goToPractice();
        });

        // Instructions
        this.add.text(width / 2, height - 50, 'Identify intervals, tap rhythms, and read notes to help the village!', {
            font: '13px monospace',
            fill: '#687880',
            align: 'center'
        }).setOrigin(0.5);

        // Settings gear
        this.add.text(width - 16, 10, '\u2699', {
            font: 'bold 28px monospace', fill: '#687880',
            padding: { x: 4, y: 2 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#90c8c0' }); })
            .on('pointerout',  function() { this.setStyle({ fill: '#687880' }); })
            .on('pointerdown', () => {
                this.scene.launch('SettingsScene', { callerKey: null, pauseCaller: false });
            });

        // Username + log out
        try {
            const activeUser = UserProfileManager.getActiveUser();
            if (activeUser) {
                this.add.text(16, 10, activeUser, { font: 'bold 14px monospace', fill: '#50d0b0' });
                const logout = this.add.text(16, 30, 'Log out', {
                    font: '11px monospace', fill: '#687880',
                }).setInteractive({ useHandCursor: true });
                logout.on('pointerover', () => logout.setStyle({ fill: '#e08868' }));
                logout.on('pointerout', () => logout.setStyle({ fill: '#687880' }));
                logout.on('pointerdown', () => {
                    try { UserProfileManager.syncLocalStorageToProfile(); } catch (e) { /* ignore */ }
                    try { UserProfileManager.logout(); } catch (e) { /* ignore */ }
                    this.scene.start('LoginScene');
                });
                if (UserProfileManager.isTeacher(activeUser)) {
                    const dashBtn = this.add.text(16, 50, 'Teacher Dashboard', {
                        font: '11px monospace', fill: '#687880',
                    }).setInteractive({ useHandCursor: true });
                    dashBtn.on('pointerover', () => dashBtn.setStyle({ fill: '#e8d098' }));
                    dashBtn.on('pointerout', () => dashBtn.setStyle({ fill: '#687880' }));
                    dashBtn.on('pointerdown', () => this.scene.start('TeacherDashboardScene'));
                }
            }
        } catch (e) { /* ignore */ }
    }

    _createWoodButton(x, y, label, normalFrame, hoverFrame, callback) {
        if (!this.textures.exists('ui-buttons') || !this.textures.get('ui-buttons').has(normalFrame)) {
            // Fallback to text button
            return this.createButton(x, y, label, callback);
        }

        const btn = this.add.image(x, y, 'ui-buttons', normalFrame)
            .setScale(2.5).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y - 2, label, {
            font: 'bold 14px monospace', fill: '#fff8e0',
            stroke: '#5a3a0a', strokeThickness: 3,
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFrame(hoverFrame));
        btn.on('pointerout', () => btn.setFrame(normalFrame));
        btn.on('pointerdown', callback);
        text.on('pointerdown', callback); // clickable text too

        return btn;
    }

    goToPractice() {
        const pm = new ProgressionManager();
        const playerData = pm.load();
        this.scene.start('ArcadeMenuScene', { playerData });
    }

    createButton(x, y, text, callback, bgColor = '#142030', hoverColor = '#243848') {
        const btn = this.add.text(x, y, text, {
            font: 'bold 22px monospace',
            fill: '#e8f0f0',
            backgroundColor: bgColor,
            padding: { x: 24, y: 12 },
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            btn.setStyle({ fill: '#e8d098', backgroundColor: hoverColor });
        });
        btn.on('pointerout', () => {
            btn.setStyle({ fill: '#e8f0f0', backgroundColor: bgColor });
        });
        btn.on('pointerdown', callback);

        return btn;
    }

}
