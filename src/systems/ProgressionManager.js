// Manages game progression: story levels, player stats persistence, save/load

import { SaveManager } from './SaveManager.js';

const SAVE_KEY = 'music-theory-rpg-save';

export class ProgressionManager {
    constructor() {
        this.totalSessions = 0;
        this.totalCorrect = 0;
        this.storyLevel = 1;            // current story level (1-9)
        this.storyLevelEncounters = 0;  // encounters completed in current level
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
            totalSessions: this.totalSessions,
            totalCorrect: this.totalCorrect,
            storyLevel: this.storyLevel,
            storyLevelEncounters: this.storyLevelEncounters,
            player: playerData,
            timestamp: Date.now()
        };
        SaveManager.save(SAVE_KEY, saveData);
        return true;
    }

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
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
        SaveManager.delete(SAVE_KEY);
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
        SaveManager.save('arcade-highscores', scores);
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
        const existing = this.loadArcadeSettings();
        const merged = { ...existing, ...settings };
        SaveManager.save('arcade-settings', merged);
    }
}
