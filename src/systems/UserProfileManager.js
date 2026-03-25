// UserProfileManager: Multi-user profile system.
// Uses localStorage. Designed so methods can later become fetch() calls to a server.
//
// KEY DESIGN: This system does NOT touch ProgressionManager or any existing scene code.
// Instead it uses a "sync bridge":
//   - On login:  profile data → legacy localStorage keys (so existing code reads it)
//   - On save:   legacy localStorage keys → profile data (so profile stays current)

const USERS_KEY = 'mtv-users';
const PROFILE_PREFIX = 'mtv-profile-';
const ACTIVE_KEY = 'mtv-active-user';

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

export class UserProfileManager {

    // ── User registry ────────────────────────────────────────

    static _loadUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
        catch { return {}; }
    }

    static _saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    static registerSync(username, password, role = 'student') {
        if (!username || username.length < 2) return { ok: false, error: 'Name must be 2+ chars' };
        if (!password || password.length < 3) return { ok: false, error: 'Password must be 3+ chars' };
        const clean = username.trim().toLowerCase();
        const users = this._loadUsers();
        if (users[clean]) return { ok: false, error: 'Name already taken' };
        users[clean] = { hash: simpleHash(password), role, createdAt: Date.now() };
        this._saveUsers(users);
        // Create empty profile
        localStorage.setItem(PROFILE_PREFIX + clean, JSON.stringify({
            avatar: null, storyProgress: null, arcadeScores: null,
            arcadeSettings: null, instrument: null,
            createdAt: Date.now(), lastLogin: Date.now(),
        }));
        return { ok: true, username: clean };
    }

    static loginSync(username, password) {
        const clean = username.trim().toLowerCase();
        const users = this._loadUsers();
        const user = users[clean];
        if (!user) return { ok: false, error: 'User not found' };
        if (user.hash !== simpleHash(password)) return { ok: false, error: 'Wrong password' };
        localStorage.setItem(ACTIVE_KEY, clean);
        const profile = this._loadProfile(clean);
        if (profile) { profile.lastLogin = Date.now(); this._saveProfile(clean, profile); }
        return { ok: true, username: clean, profile };
    }

    static logout() { localStorage.removeItem(ACTIVE_KEY); }
    static getActiveUser() { return localStorage.getItem(ACTIVE_KEY) || null; }
    static getUserList() { return Object.keys(this._loadUsers()); }

    static getRole(username) {
        const users = this._loadUsers();
        return users[username]?.role || 'student';
    }

    static isTeacher(username) {
        return this.getRole(username || this.getActiveUser()) === 'teacher';
    }

    static deleteUser(username) {
        const users = this._loadUsers();
        if (!users[username]) return false;
        delete users[username];
        this._saveUsers(users);
        localStorage.removeItem(PROFILE_PREFIX + username);
        return true;
    }

    static resetUserProgress(username) {
        const profile = this._loadProfile(username);
        if (!profile) return false;
        profile.storyProgress = null;
        profile.arcadeScores = null;
        this._saveProfile(username, profile);
        return true;
    }

    /** Get all students with summary info for teacher dashboard. */
    static getAllStudents() {
        const users = this._loadUsers();
        const students = [];
        for (const [name, info] of Object.entries(users)) {
            if (info.role === 'teacher') continue;
            const profile = this._loadProfile(name) || {};
            students.push({
                username: name,
                instrument: profile.instrument || 'none',
                storyLevel: profile.storyProgress?.storyLevel || 1,
                totalSessions: profile.storyProgress?.totalSessions || 0,
                totalCorrect: profile.storyProgress?.totalCorrect || 0,
                lastLogin: profile.lastLogin || info.createdAt || 0,
                arcadeScores: profile.arcadeScores || {},
            });
        }
        return students;
    }

    // ── Profile CRUD ─────────────────────────────────────────

    static _loadProfile(username) {
        try { return JSON.parse(localStorage.getItem(PROFILE_PREFIX + username)) || null; }
        catch { return null; }
    }

    static _saveProfile(username, profile) {
        if (username) localStorage.setItem(PROFILE_PREFIX + username, JSON.stringify(profile));
    }

    // ── Sync bridge: profile ↔ legacy localStorage keys ──────

    /** On login: copy profile fields INTO legacy localStorage keys so existing code works. */
    static syncProfileToLocalStorage(username) {
        const profile = this._loadProfile(username);
        if (!profile) return;
        if (profile.storyProgress) {
            localStorage.setItem('music-theory-rpg-save', JSON.stringify(profile.storyProgress));
        } else {
            localStorage.removeItem('music-theory-rpg-save');
        }
        if (profile.arcadeScores) {
            localStorage.setItem('arcade-highscores', JSON.stringify(profile.arcadeScores));
        } else {
            localStorage.removeItem('arcade-highscores');
        }
        if (profile.arcadeSettings) {
            localStorage.setItem('arcade-settings', JSON.stringify(profile.arcadeSettings));
        }
        if (profile.avatar) {
            localStorage.setItem('avatar-settings', JSON.stringify(profile.avatar));
        }
    }

    /** On save: copy legacy localStorage keys BACK into the active user's profile. */
    static syncLocalStorageToProfile() {
        const username = this.getActiveUser();
        if (!username) return;
        const profile = this._loadProfile(username) || {};
        try { profile.storyProgress = JSON.parse(localStorage.getItem('music-theory-rpg-save')); } catch { /* keep existing */ }
        try { profile.arcadeScores = JSON.parse(localStorage.getItem('arcade-highscores')); } catch {}
        try { profile.arcadeSettings = JSON.parse(localStorage.getItem('arcade-settings')); } catch {}
        try { profile.avatar = JSON.parse(localStorage.getItem('avatar-settings')); } catch {}
        // Also sync instrument from arcadeSettings
        if (profile.arcadeSettings?.instrument) profile.instrument = profile.arcadeSettings.instrument;
        this._saveProfile(username, profile);
    }

    /** Migrate legacy single-user data into a new profile. */
    static migrateFromLegacy(username) {
        this.syncLocalStorageToProfile();
    }

    // ── Instrument ───────────────────────────────────────────

    static getInstrument(username) {
        const profile = this._loadProfile(username || this.getActiveUser());
        return profile?.instrument || profile?.arcadeSettings?.instrument || null;
    }

    static saveInstrument(instrument) {
        const username = this.getActiveUser();
        if (!username) return;
        const profile = this._loadProfile(username) || {};
        profile.instrument = instrument;
        if (!profile.arcadeSettings) profile.arcadeSettings = {};
        profile.arcadeSettings.instrument = instrument;
        this._saveProfile(username, profile);
        // Also write to legacy key so existing code picks it up
        const settings = profile.arcadeSettings;
        localStorage.setItem('arcade-settings', JSON.stringify(settings));
    }

    // ── Leaderboard ──────────────────────────────────────────

    static getLeaderboard(mode) {
        const users = this.getUserList();
        const entries = [];
        for (const u of users) {
            const profile = this._loadProfile(u);
            const scores = profile?.arcadeScores;
            const best = scores?.[mode]?.[0];
            if (best != null) entries.push({ username: u, score: best });
        }
        entries.sort((a, b) => b.score - a.score);
        return entries;
    }
}
