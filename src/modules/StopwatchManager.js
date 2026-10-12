import { STORAGE_KEYS } from '../utils/constants.js';
import { loadJSON, isPlainObject } from '../utils/storage.js';

class StopwatchManager {
    constructor() {
        this.startTime = 0;
        this.elapsedSoFar = 0;
        this.isRunning = false;
        this.laps = [];
        this.previousLapTime = 0;
        this.speed = 1.0;
        this.loadState();
    }

    loadState() {
        const state = loadJSON(STORAGE_KEYS.STOPWATCH_STATE, null, isPlainObject);
        if (state) {
            this.startTime = state.startTime || 0;
            this.elapsedSoFar = state.elapsedSoFar || 0;
            this.isRunning = state.isRunning || false;
            this.laps = state.laps || [];
            this.previousLapTime = state.previousLapTime || 0;
            this.speed = state.speed || 1.0;
        }
    }

    saveState() {
        const state = {
            startTime: this.startTime,
            elapsedSoFar: this.elapsedSoFar,
            isRunning: this.isRunning,
            laps: this.laps,
            previousLapTime: this.previousLapTime,
            speed: this.speed
        };
        localStorage.setItem(STORAGE_KEYS.STOPWATCH_STATE, JSON.stringify(state));
        // Notify the UI of changes
        document.dispatchEvent(new CustomEvent('stopwatch-update', { detail: state }));
    }

    getElapsed() {
        if (!this.isRunning) return this.elapsedSoFar;
        const now = Date.now();
        // Never negative, even if the system clock is set back while running
        const delta = Math.max(0, now - this.startTime);
        return this.elapsedSoFar + (delta * this.speed);
    }

    start() {
        if (this.isRunning) return;
        this.startTime = Date.now();
        this.isRunning = true;
        this.saveState();
    }

    stop() {
        if (!this.isRunning) return;
        this.elapsedSoFar = this.getElapsed();
        this.isRunning = false;
        this.saveState();
    }

    setSpeed(newSpeed) {
        if (this.speed === newSpeed) return;
        if (this.isRunning) {
            this.elapsedSoFar = this.getElapsed();
            this.startTime = Date.now();
        }

        this.speed = newSpeed;
        this.saveState();
    }

    lap() {
        const currentElapsed = this.getElapsed();
        const lapTime = currentElapsed - this.previousLapTime;
        this.laps.unshift({ lapTime, totalTime: currentElapsed });
        this.previousLapTime = currentElapsed;
        this.saveState();
        return this.laps;
    }

    reset() {
        this.startTime = 0;
        this.elapsedSoFar = 0;
        this.isRunning = false;
        this.laps = [];
        this.previousLapTime = 0;
        this.saveState();
    }

    specialReset() {
        this.elapsedSoFar = 0;
        this.laps = [];
        this.previousLapTime = 0;
        this.startTime = Date.now();
        this.isRunning = true;
        this.saveState();
    }

    getState() {
        return {
            elapsed: this.getElapsed(),
            isRunning: this.isRunning,
            laps: this.laps,
            previousLapTime: this.previousLapTime,
            speed: this.speed
        };
    }
}

export const stopwatchManager = new StopwatchManager();
