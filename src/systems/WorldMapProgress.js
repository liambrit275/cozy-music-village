// Tracks world map completion, high scores, and difficulty in localStorage.
// Separate from ProgressionManager (story mode save).

const STORAGE_KEY = 'music-theory-world-map';

export class WorldMapProgress {
    constructor(data) {
        this._data = data || { completedLocations: {}, highScores: {}, completionCounts: {} };
        // Migrate old saves that lack completionCounts
        if (!this._data.completionCounts) this._data.completionCounts = {};
    }

    static load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return new WorldMapProgress(JSON.parse(raw));
        } catch (e) { /* ignore */ }
        return new WorldMapProgress();
    }

    isCompleted(locationId) {
        return !!this._data.completedLocations[locationId];
    }

    getCompletionCount(locationId) {
        return this._data.completionCounts[locationId] || 0;
    }

    getDifficultyMultiplier(locationId) {
        return 1 + this.getCompletionCount(locationId) * 0.5;
    }

    markCompleted(locationId, score = 0) {
        this._data.completedLocations[locationId] = true;
        this._data.completionCounts[locationId] = (this._data.completionCounts[locationId] || 0) + 1;
        const prev = this._data.highScores[locationId] || 0;
        if (score > prev) this._data.highScores[locationId] = score;
        this._save();
    }

    getHighScore(locationId) {
        return this._data.highScores[locationId] || 0;
    }

    getRegionCompletedCount(regionLocations) {
        return regionLocations.filter(l => this.isCompleted(l.id)).length;
    }

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
        } catch (e) { /* ignore */ }
    }

    static deleteAll() {
        localStorage.removeItem(STORAGE_KEY);
    }
}
