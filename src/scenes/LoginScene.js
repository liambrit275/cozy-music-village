// LoginScene: Username + password login. Pure Phaser UI (no HTML overlays).
// Uses document-level keydown for text input (same reliable pattern as rhythm reading).

import { UserProfileManager } from '../systems/UserProfileManager.js';

export class LoginScene extends Phaser.Scene {
    constructor() { super({ key: 'LoginScene' }); }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#0c1420');

        // Auto-login if already signed in
        const active = UserProfileManager.getActiveUser();
        if (active) {
            const profile = UserProfileManager._loadProfile(active);
            if (profile) { this._onLoginSuccess(active, profile); return; }
        }

        // Title
        this.add.text(width / 2, height * 0.12, 'MUSIC THEORY\nVILLAGE', {
            font: 'bold 40px monospace', fill: '#e8d098',
            align: 'center', stroke: '#0c1420', strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.28, 'Sign in to play', {
            font: '14px monospace', fill: '#687880',
        }).setOrigin(0.5);

        // Existing players list
        const users = UserProfileManager.getUserList();
        if (users.length > 0) {
            this.add.text(width / 2, height * 0.90, 'Players: ' + users.join(', '), {
                font: '11px monospace', fill: '#556666',
            }).setOrigin(0.5);
        }

        // Error display
        this._errorText = this.add.text(width / 2, height * 0.74, '', {
            font: '12px monospace', fill: '#e08868',
        }).setOrigin(0.5);

        // Input state
        this._username = '';
        this._password = '';
        this._focus = 'username';

        // Username field
        const fw = 240, fh = 32, fy = height * 0.38;
        this.add.text(width / 2, fy - 22, 'USERNAME', { font: '10px monospace', fill: '#687880' }).setOrigin(0.5);
        this._userBg = this.add.rectangle(width / 2, fy, fw, fh, 0x1a2838)
            .setStrokeStyle(2, 0x50d0b0).setInteractive({ useHandCursor: true });
        this._userTxt = this.add.text(width / 2 - fw / 2 + 12, fy, '|', {
            font: '14px monospace', fill: '#e8d098' }).setOrigin(0, 0.5);

        // Password field
        const py = fy + 60;
        this.add.text(width / 2, py - 22, 'PASSWORD', { font: '10px monospace', fill: '#687880' }).setOrigin(0.5);
        this._passBg = this.add.rectangle(width / 2, py, fw, fh, 0x1a2838)
            .setStrokeStyle(2, 0x243848).setInteractive({ useHandCursor: true });
        this._passTxt = this.add.text(width / 2 - fw / 2 + 12, py, '', {
            font: '14px monospace', fill: '#e8d098' }).setOrigin(0, 0.5);

        this._userBg.on('pointerdown', () => this._setFocus('username'));
        this._passBg.on('pointerdown', () => this._setFocus('password'));

        // Buttons
        const by = py + 60;
        this._btn(width / 2 - 70, by, 'SIGN IN', '#50d0b0', '#0c1420', () => this._doLogin());
        this._btn(width / 2 + 70, by, 'NEW ACCOUNT', '#243848', '#90c8c0', () => this._doRegister());

        // Document-level keyboard (reliable)
        this._keyHandler = (e) => {
            if (!this.scene.isActive('LoginScene')) return;
            const k = e.key;
            if (k === 'Tab')       { e.preventDefault(); this._setFocus(this._focus === 'username' ? 'password' : 'username'); }
            else if (k === 'Enter') { this._focus === 'username' ? this._setFocus('password') : this._doLogin(); }
            else if (k === 'Backspace') { e.preventDefault(); this._type(''); }
            else if (k.length === 1 && !e.ctrlKey && !e.metaKey) { this._type(k); }
        };
        document.addEventListener('keydown', this._keyHandler);
        this.events.on('shutdown', () => {
            if (this._keyHandler) { document.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
        });
    }

    _btn(x, y, label, bg, fill, cb) {
        const b = this.add.text(x, y, label, {
            font: 'bold 14px monospace', fill, backgroundColor: bg, padding: { x: 14, y: 8 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        b.on('pointerdown', cb);
    }

    _setFocus(f) {
        this._focus = f;
        this._userBg.setStrokeStyle(2, f === 'username' ? 0x50d0b0 : 0x243848);
        this._passBg.setStrokeStyle(2, f === 'password' ? 0x50d0b0 : 0x243848);
        this._render();
    }

    _type(ch) {
        if (this._focus === 'username') {
            this._username = ch ? (this._username + ch).slice(0, 20) : this._username.slice(0, -1);
        } else {
            this._password = ch ? (this._password + ch).slice(0, 30) : this._password.slice(0, -1);
        }
        this._render();
    }

    _render() {
        const c = '|';
        this._userTxt.setText(this._username + (this._focus === 'username' ? c : ''));
        this._passTxt.setText('*'.repeat(this._password.length) + (this._focus === 'password' ? c : ''));
    }

    _doLogin() {
        if (!this._username || !this._password) { this._errorText.setText('Enter username and password'); return; }
        const r = UserProfileManager.loginSync(this._username, this._password);
        if (!r.ok) { this._errorText.setText(r.error); return; }
        this._onLoginSuccess(r.username, r.profile);
    }

    _doRegister() {
        if (!this._username || !this._password) { this._errorText.setText('Enter username and password'); return; }
        const r = UserProfileManager.registerSync(this._username, this._password);
        if (!r.ok) { this._errorText.setText(r.error); return; }
        // Migrate existing localStorage data into the new profile
        UserProfileManager.migrateFromLegacy(r.username);
        UserProfileManager.loginSync(this._username, this._password);
        const profile = UserProfileManager._loadProfile(r.username);
        this._onLoginSuccess(r.username, profile, true);
    }

    _onLoginSuccess(username, profile, isNew = false) {
        this.game.registry.set('activeUser', username);

        // SYNC BRIDGE: copy profile data → legacy localStorage keys
        UserProfileManager.syncProfileToLocalStorage(username);

        // Recompose avatar if profile has one
        if (profile?.avatar) {
            const boot = this.scene.get('BootScene');
            if (boot && boot._composeAvatar) {
                try { boot._composeAvatar(profile.avatar); } catch (e) { /* ignore */ }
            }
        }

        // New account or no instrument → pick instrument
        if (isNew || !profile?.instrument) {
            this.scene.start('InstrumentPickerScene', { username, isNew });
        } else {
            this.scene.start('TitleScene');
        }
    }
}
