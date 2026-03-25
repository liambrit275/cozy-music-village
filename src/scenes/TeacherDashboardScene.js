// TeacherDashboardScene: Admin panel to view/manage student accounts.

import { UserProfileManager } from '../systems/UserProfileManager.js';

export class TeacherDashboardScene extends Phaser.Scene {
    constructor() { super({ key: 'TeacherDashboardScene' }); }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#0c1420');
        this._uiObjects = [];
        this._confirmTarget = null;

        // Header
        this.add.text(width / 2, 24, 'TEACHER DASHBOARD', {
            font: 'bold 24px monospace', fill: '#e8d098',
            stroke: '#0c1420', strokeThickness: 3,
        }).setOrigin(0.5);

        const teacher = UserProfileManager.getActiveUser();
        this.add.text(width / 2, 50, 'Signed in as ' + (teacher || '?'), {
            font: '11px monospace', fill: '#687880',
        }).setOrigin(0.5);

        // Back button
        const backBtn = this.add.text(20, 20, '< BACK', {
            font: 'bold 13px monospace', fill: '#90c8c0',
            backgroundColor: '#142030', padding: { x: 10, y: 6 },
        }).setInteractive({ useHandCursor: true });
        backBtn.on('pointerover', () => backBtn.setStyle({ fill: '#e8d098' }));
        backBtn.on('pointerout', () => backBtn.setStyle({ fill: '#90c8c0' }));
        backBtn.on('pointerdown', () => this.scene.start('TitleScene'));

        // Confirm overlay (hidden)
        this._confirmBg = this.add.rectangle(width / 2, height / 2, 300, 120, 0x0c1420, 0.95)
            .setStrokeStyle(2, 0xe08868).setDepth(50).setVisible(false);
        this._confirmText = this.add.text(width / 2, height / 2 - 20, '', {
            font: '13px monospace', fill: '#e08868', align: 'center', wordWrap: { width: 260 },
        }).setOrigin(0.5).setDepth(51).setVisible(false);

        this._confirmYes = this.add.text(width / 2 - 50, height / 2 + 25, 'YES', {
            font: 'bold 13px monospace', fill: '#0c1420',
            backgroundColor: '#e08868', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setDepth(51).setVisible(false).setInteractive({ useHandCursor: true });
        this._confirmYes.on('pointerdown', () => this._doConfirm());

        this._confirmNo = this.add.text(width / 2 + 50, height / 2 + 25, 'NO', {
            font: 'bold 13px monospace', fill: '#90c8c0',
            backgroundColor: '#243848', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setDepth(51).setVisible(false).setInteractive({ useHandCursor: true });
        this._confirmNo.on('pointerdown', () => this._hideConfirm());

        this._buildStudentList(width);
    }

    _buildStudentList(width) {
        // Clear old UI
        this._uiObjects.forEach(o => o.destroy());
        this._uiObjects = [];

        const students = UserProfileManager.getAllStudents();

        if (students.length === 0) {
            const t = this.add.text(width / 2, 120, 'No students registered yet.', {
                font: '14px monospace', fill: '#687880',
            }).setOrigin(0.5);
            this._uiObjects.push(t);
            return;
        }

        // Column headers
        const y0 = 80;
        const cols = { name: 40, instrument: 160, level: 280, sessions: 350, correct: 430, lastSeen: 510, actions: 660 };

        const headers = [
            ['NAME', cols.name], ['INSTRUMENT', cols.instrument], ['LEVEL', cols.level],
            ['SESSIONS', cols.sessions], ['CORRECT', cols.correct], ['LAST SEEN', cols.lastSeen], ['ACTIONS', cols.actions],
        ];
        headers.forEach(([label, x]) => {
            const t = this.add.text(x, y0, label, { font: 'bold 10px monospace', fill: '#687880' });
            this._uiObjects.push(t);
        });

        // Separator
        const sep = this.add.rectangle(width / 2, y0 + 14, width - 40, 1, 0x243848);
        this._uiObjects.push(sep);

        // Student rows
        students.forEach((s, i) => {
            const ry = y0 + 28 + i * 32;
            const rowBg = this.add.rectangle(width / 2, ry, width - 30, 28, i % 2 ? 0x142030 : 0x0c1420);
            this._uiObjects.push(rowBg);

            const addText = (x, text, color = '#c8d8e0') => {
                const t = this.add.text(x, ry, text, { font: '12px monospace', fill: color }).setOrigin(0, 0.5);
                this._uiObjects.push(t);
            };

            addText(cols.name, s.username, '#e8d098');
            addText(cols.instrument, s.instrument);
            addText(cols.level, 'Level ' + s.storyLevel);
            addText(cols.sessions, String(s.totalSessions));
            addText(cols.correct, String(s.totalCorrect));

            // Last seen
            const ago = s.lastLogin ? this._timeAgo(s.lastLogin) : 'never';
            addText(cols.lastSeen, ago, '#687880');

            // Best arcade score (highest across modes)
            const allScores = Object.values(s.arcadeScores || {}).flat();
            const best = allScores.length ? Math.max(...allScores) : 0;
            if (best > 0) addText(cols.correct + 60, 'Best: ' + best, '#50d0b0');

            // Reset button
            const resetBtn = this.add.text(cols.actions, ry, 'RESET', {
                font: 'bold 10px monospace', fill: '#e8d098',
                backgroundColor: '#243848', padding: { x: 6, y: 3 },
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
            resetBtn.on('pointerdown', () => this._showConfirm('reset', s.username));
            this._uiObjects.push(resetBtn);

            // Delete button
            const delBtn = this.add.text(cols.actions + 60, ry, 'DELETE', {
                font: 'bold 10px monospace', fill: '#e08868',
                backgroundColor: '#1a2838', padding: { x: 6, y: 3 },
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
            delBtn.on('pointerdown', () => this._showConfirm('delete', s.username));
            this._uiObjects.push(delBtn);
        });

        // Total count
        const total = this.add.text(40, y0 + 28 + students.length * 32 + 10,
            students.length + ' student' + (students.length !== 1 ? 's' : ''), {
            font: '11px monospace', fill: '#556666',
        });
        this._uiObjects.push(total);
    }

    _timeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + 'h ago';
        const days = Math.floor(hours / 24);
        return days + 'd ago';
    }

    _showConfirm(action, username) {
        this._confirmAction = action;
        this._confirmTarget = username;
        const msg = action === 'delete'
            ? 'Delete ' + username + '?\nThis removes all their data.'
            : 'Reset progress for ' + username + '?\nScores and story will be cleared.';
        this._confirmText.setText(msg);
        this._confirmBg.setVisible(true);
        this._confirmText.setVisible(true);
        this._confirmYes.setVisible(true);
        this._confirmNo.setVisible(true);
    }

    _hideConfirm() {
        this._confirmBg.setVisible(false);
        this._confirmText.setVisible(false);
        this._confirmYes.setVisible(false);
        this._confirmNo.setVisible(false);
        this._confirmAction = null;
        this._confirmTarget = null;
    }

    _doConfirm() {
        const { _confirmAction: action, _confirmTarget: username } = this;
        this._hideConfirm();
        if (!username) return;

        if (action === 'delete') {
            UserProfileManager.deleteUser(username);
        } else if (action === 'reset') {
            UserProfileManager.resetUserProgress(username);
        }
        this._buildStudentList(this.cameras.main.width);
    }
}
