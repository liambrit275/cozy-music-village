// Manages game progression: zone unlocks, player stats persistence, save/load

import { ZONES, ZONE_ORDER } from '../data/zones.js';

const SAVE_KEY = 'music-theory-rpg-save';
export const ENCOUNTERS_TO_CLEAR = 4; // defeat this many fixed encounters to unlock next zone

export class ProgressionManager {
    constructor() {
        this.currentZone = 'forest';
        this.unlockedZones = ['forest'];
        this.defeatedEncounters = {}; // { zoneName: [0, 1, 2, ...] } — indices of defeated encounters
        this.totalBattles = 0;
        this.totalCorrect = 0;
    }

    getCurrentZone() {
        return ZONES[this.currentZone];
    }

    isZoneUnlocked(zoneName) {
        return this.unlockedZones.includes(zoneName);
    }

    // Record an encounter defeat by index. Returns true if this clears the zone.
    recordEncounterDefeat(zoneName, encounterIndex) {
        if (!this.defeatedEncounters[zoneName]) {
            this.defeatedEncounters[zoneName] = [];
        }
        if (!this.defeatedEncounters[zoneName].includes(encounterIndex)) {
            this.defeatedEncounters[zoneName].push(encounterIndex);
        }
        return this.isZoneCleared(zoneName);
    }

    // True when all required encounters have been defeated
    isZoneCleared(zoneName) {
        const defeated = this.defeatedEncounters[zoneName] || [];
        return defeated.length >= ENCOUNTERS_TO_CLEAR;
    }

    // Which encounter indices are already defeated for a zone
    getDefeatedEncounters(zoneName) {
        return this.defeatedEncounters[zoneName] || [];
    }

    // Unlock the next zone. Returns the new zone name, or null.
    unlockNextZone() {
        const zone = ZONES[this.currentZone];
        if (!zone.nextZone) return null;
        if (!this.unlockedZones.includes(zone.nextZone)) {
            this.unlockedZones.push(zone.nextZone);
        }
        return zone.nextZone;
    }

    setZone(zoneName) {
        if (this.unlockedZones.includes(zoneName)) {
            this.currentZone = zoneName;
            return true;
        }
        return false;
    }

    getRandomMonster() {
        const zone = ZONES[this.currentZone];
        const monsters = zone.monsters;
        return monsters[Math.floor(Math.random() * monsters.length)];
    }

    recordBattle(won, correctAnswers, totalAnswers) {
        this.totalBattles++;
        this.totalCorrect += correctAnswers;
    }

    save(playerData) {
        const saveData = {
            currentZone: this.currentZone,
            unlockedZones: this.unlockedZones,
            defeatedEncounters: this.defeatedEncounters,
            totalBattles: this.totalBattles,
            totalCorrect: this.totalCorrect,
            player: playerData,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.warn('Failed to save:', e);
            return false;
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            this.currentZone = data.currentZone || 'forest';
            this.unlockedZones = data.unlockedZones || ['forest'];
            this.defeatedEncounters = data.defeatedEncounters || {};
            this.totalBattles = data.totalBattles || 0;
            this.totalCorrect = data.totalCorrect || 0;
            return data.player || null;
        } catch (e) {
            console.warn('Failed to load save:', e);
            return null;
        }
    }

    deleteSave() {
        localStorage.removeItem(SAVE_KEY);
    }

    loadArcadeScores() {
        try {
            const raw = localStorage.getItem('arcade-highscores');
            return raw ? JSON.parse(raw) : { tones: [], rhythm: [], noteReading: [] };
        } catch (e) {
            return { tones: [], rhythm: [], noteReading: [] };
        }
    }

    saveArcadeScore(mode, score) {
        const scores = this.loadArcadeScores();
        if (!scores[mode]) scores[mode] = [];
        scores[mode].push(score);
        scores[mode].sort((a, b) => b - a);
        scores[mode] = scores[mode].slice(0, 5);
        try { localStorage.setItem('arcade-highscores', JSON.stringify(scores)); } catch (e) {}
    }

    loadArcadeSettings() {
        try {
            const raw = localStorage.getItem('arcade-settings');
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    saveArcadeSettings(settings) {
        try {
            // Merge with existing to preserve fields not in the current save
            const existing = this.loadArcadeSettings();
            const merged = { ...existing, ...settings };
            localStorage.setItem('arcade-settings', JSON.stringify(merged));
        } catch (e) {}
    }
}
