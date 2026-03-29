/**
 * SaveManager — persistent save system using server-side file storage.
 *
 * Replaces raw localStorage with a server-backed approach:
 * - Writes go to BOTH localStorage (instant) AND the server (persistent)
 * - Reads try localStorage first, then fall back to server
 * - On load, server data overwrites localStorage (server is source of truth)
 *
 * The server stores each key as a separate JSON file in /saves/.
 * API: GET /api/save?key=X, POST /api/save {key, data}
 */

const API_BASE = '/api';

export class SaveManager {
    /**
     * Save data to both localStorage and server.
     * @param {string} key — localStorage key name
     * @param {*} data — JSON-serializable data
     */
    static save(key, data) {
        const json = JSON.stringify(data);

        // Write to localStorage immediately (fast, available offline)
        try {
            localStorage.setItem(key, json);
        } catch (e) { /* quota exceeded */ }

        // Write to server in background (persistent)
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        fetch(`${API_BASE}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: safeKey, data }),
        }).catch(() => { /* server offline — localStorage has the data */ });
    }

    /**
     * Load data. Returns parsed JSON or null.
     * Reads from localStorage (instant).
     * @param {string} key
     * @returns {*} parsed data or null
     */
    static load(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Load from server and update localStorage (call on startup/login).
     * Returns a promise that resolves with the data.
     * @param {string} key
     * @returns {Promise<*>} parsed data or null
     */
    static async loadFromServer(key) {
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        try {
            const res = await fetch(`${API_BASE}/save?key=${safeKey}`);
            if (res.ok) {
                const data = await res.json();
                // Update localStorage with server data (server is source of truth)
                try {
                    localStorage.setItem(key, JSON.stringify(data));
                } catch (e) { /* ignore */ }
                return data;
            }
        } catch (e) { /* server offline */ }
        // Fall back to localStorage
        return SaveManager.load(key);
    }

    /**
     * Sync all game keys from server to localStorage on startup.
     * Call this once after login.
     */
    static async syncFromServer() {
        const keys = [
            'music-theory-rpg-save',
            'arcade-highscores',
            'arcade-settings',
            'avatar-settings',
            'mtv-users',
            'mtv-active-user',
        ];

        // Also sync any per-user profile keys
        try {
            const res = await fetch(`${API_BASE}/saves`);
            if (res.ok) {
                const { keys: serverKeys } = await res.json();
                for (const sk of serverKeys) {
                    if (sk.startsWith('mtv-profile-')) {
                        keys.push(sk);
                    }
                }
            }
        } catch (e) { /* server offline */ }

        for (const key of keys) {
            await SaveManager.loadFromServer(key);
        }
    }

    /**
     * Push all localStorage game data to the server.
     * Call this after any save operation to ensure persistence.
     */
    static async syncToServer() {
        const keys = [
            'music-theory-rpg-save',
            'arcade-highscores',
            'arcade-settings',
            'avatar-settings',
            'mtv-users',
            'mtv-active-user',
        ];

        // Include per-user profiles
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('mtv-profile-')) {
                keys.push(k);
            }
        }

        for (const key of keys) {
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                    await fetch(`${API_BASE}/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: safeKey, data }),
                    });
                } catch (e) { /* skip */ }
            }
        }
    }

    /**
     * Delete a key from both localStorage and server.
     */
    static delete(key) {
        localStorage.removeItem(key);
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        fetch(`${API_BASE}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: safeKey }),
        }).catch(() => {});
    }
}
