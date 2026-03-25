// Manages game progression: zone unlocks, player stats persistence, save/load

import { ZONES, ZONE_ORDER } from '../data/zones.js';

const SAVE_KEY = 'music-theory-rpg-save';
export const ENCOUNTERS_TO_CLEAR = 4; // help this many villagers to unlock next zone

export class ProgressionManager {
    constructor() {
        this.currentZone = 'forest';
        this.unlockedZones = ['forest'];
        this.completedEncounters = {}; // { zoneName: [0, 1, 2, ...] } — indices of helped villagers
        this.totalSessions = 0;
        this.totalCorrect = 0;
        this.storyLevel = 1;            // current story level (1-9)
        this.storyLevelEncounters = 0;  // encounters completed in current level
    }

    getCurrentZone() {
        return ZONES[this.currentZone];
    }

    isZoneUnlocked(zoneName) {
        return this.unlockedZones.includes(zoneName);
    }

    // Record an encounter completion by index. Returns true if this clears the zone.
    recordEncounterDefeat(zoneName, encounterIndex) {
        if (!this.completedEncounters[zoneName]) {
            this.completedEncounters[zoneName] = [];
        }
        if (!this.completedEncounters[zoneName].includes(encounterIndex)) {
            this.completedEncounters[zoneName].push(encounterIndex);
        }
        return this.isZoneCleared(zoneName);
    }

    // True when all required encounters have been completed
    isZoneCleared(zoneName) {
        const completed = this.completedEncounters[zoneName] || [];
        return completed.length >= ENCOUNTERS_TO_CLEAR;
    }

    // Which encounter indices are already completed for a zone
    getDefeatedEncounters(zoneName) {
        return this.completedEncounters[zoneName] || [];
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

    getRandomVillager() {
        const zone = ZONES[this.currentZone];
        const villagers = zone.villagers;
        return villagers[Math.floor(Math.random() * villagers.length)];
    }

    recordBattle(won, correctAnswers, totalAnswers) {
        this.totalSessions++;
        this.totalCorrect += correctAnswers;
    }

    /** Record a successful story encounter. Returns true if level advanced. */
    recordStoryEncounter() {
        this.storyLevelEncounters++;
        return false; // Caller should check advanceStoryLevel()
    }

    /** Advance to next story level if enough encounters completed. Returns new level or null. */
    advanceStoryLevel(requiredEncounters) {
        if (this.storyLevelEncounters >= requiredEncounters && this.storyLevel <= 9) {
            this.storyLevel++;
            this.storyLevelEncounters = 0;
            return this.storyLevel;
        }
        return null;
    }

    getStoryLevel() {
        return this.storyLevel;
    }

    save(playerData) {
        const saveData = {
            currentZone: this.currentZone,
            unlockedZones: this.unlockedZones,
            completedEncounters: this.completedEncounters,
            totalSessions: this.totalSessions,
            totalCorrect: this.totalCorrect,
            storyLevel: this.storyLevel,
            storyLevelEncounters: this.storyLevelEncounters,
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
            this.completedEncounters = data.completedEncounters || data.defeatedEncounters || {};
            this.totalSessions = data.totalSessions || data.totalBattles || 0;
            this.totalCorrect = data.totalCorrect || 0;
            this.storyLevel = data.storyLevel || 1;
            this.storyLevelEncounters = data.storyLevelEncounters || 0;
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
