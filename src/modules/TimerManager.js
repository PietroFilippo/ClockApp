import { notificationService } from '../services/NotificationService.js';
import { STORAGE_KEYS, LIMITS } from '../utils/constants.js';

// Ticks are frequent so a timer finishes on time; the UI is only notified when a displayed second changes
const TICK_MS = 250;

class TimerManager {
    constructor() {
        /** @type {Map<string, Object>} id → timer state. Running timers keep their deadline in endsAt (ms) */
        this.timers = new Map();
        this.tickIntervalId = null;

        this.loadState();

        // Start the tick if any timer is active
        if (this._hasActiveTimers()) {
            this.startTicking();
            this.updatePowerBlocker();
        }

        // Listener for settings changes to update the power blocker
        document.addEventListener('settings-updated', (e) => {
            if (e.detail.key === 'preventSuspend') {
                this.updatePowerBlocker();
            }
        });

        // Listener for timer repeat requests (from the notification popup)
        document.addEventListener('timer-repeat-requested', (e) => {
            if (e.detail?.id) this.repeatFromAlert(e.detail.id);
        });
    }

    // Helpers
    _hasActiveTimers() {
        for (const timer of this.timers.values()) {
            if (timer.isRunning && !timer.isPaused) return true;
        }
        return false;
    }

    _generateId() {
        return `timer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }

    // State Persistence
    loadState() {
        const saved = localStorage.getItem(STORAGE_KEYS.TIMER_STATES);
        if (saved) {
            try {
                const timersArray = JSON.parse(saved);
                if (!Array.isArray(timersArray)) throw new Error('Saved timers are not an array');
                const now = Date.now();
                this.timers.clear();

                for (const state of timersArray) {
                    if (state.isRunning && !state.isPaused) {
                        // Saves from older versions only have the remaining seconds at lastSaved
                        if (!Number.isFinite(state.endsAt)) {
                            state.endsAt = (state.lastSaved || now) + state.remainingSeconds * 1000;
                        }
                        delete state.lastSaved;
                        this._syncRemaining(state, now);

                        if (now >= state.endsAt) {
                            // Finished while the app was closed: ring after initialization
                            const id = state.id;
                            this.timers.set(id, state);
                            setTimeout(() => this.finish(id), 100);
                            continue;
                        }
                    }
                    this.timers.set(state.id, state);
                }
                return;
            } catch (e) {
                console.error('Failed to load multi-timer state', e);
            }
        }

    }

    saveState() {
        localStorage.setItem(STORAGE_KEYS.TIMER_STATES, JSON.stringify(this.getAllTimers()));
    }

    // Recents
    loadRecents() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.TIMER_RECENTS);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to load recent timers', e);
            return [];
        }
    }

    saveRecents(recents) {
        localStorage.setItem(STORAGE_KEYS.TIMER_RECENTS, JSON.stringify(recents));
        this.notify('recents-updated');
    }

    getRecents() {
        return this.loadRecents();
    }

    addRecentTimer(historyItem) {
        let recents = this.loadRecents();

        const existingIndex = recents.findIndex(r =>
            r.hours === historyItem.hours &&
            r.minutes === historyItem.minutes &&
            r.seconds === historyItem.seconds &&
            r.label === historyItem.label &&
            r.soundId === historyItem.soundId
        );

        if (existingIndex !== -1) {
            recents.splice(existingIndex, 1);
        }

        recents.unshift({ ...historyItem, id: Date.now().toString(), timestamp: Date.now() });

        if (recents.length > 20) {
            recents = recents.slice(0, 20);
        }

        this.saveRecents(recents);
    }

    updateRecentTimer(id, updates) {
        let recents = this.loadRecents();
        const index = recents.findIndex(r => r.id === id);
        if (index !== -1) {
            recents[index] = { ...recents[index], ...updates };
            this.saveRecents(recents);
        }
    }

    deleteRecentTimer(id) {
        let recents = this.loadRecents();
        recents = recents.filter(r => String(r.id) !== String(id));
        this.saveRecents(recents);
    }

    // Saved Timers
    loadSaved() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.TIMER_SAVED);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to load saved timers', e);
            return [];
        }
    }

    saveSaved(saved) {
        localStorage.setItem(STORAGE_KEYS.TIMER_SAVED, JSON.stringify(saved));
        this.notify('saved-updated');
    }

    getSaved() {
        return this.loadSaved();
    }

    addSavedTimer(timer) {
        let saved = this.loadSaved();
        if (saved.length >= LIMITS.MAX_TIMER_SAVED) {
            return { success: false, saved };
        }
        saved.push({ ...timer, id: Date.now().toString(), savedAt: Date.now() });
        this.saveSaved(saved);
        return { success: true, saved };
    }

    updateSavedTimer(id, updates) {
        let saved = this.loadSaved();
        const index = saved.findIndex(s => s.id === id);
        if (index !== -1) {
            saved[index] = { ...saved[index], ...updates };
            this.saveSaved(saved);
        }
    }

    deleteSavedTimer(id) {
        let saved = this.loadSaved();
        saved = saved.filter(s => String(s.id) !== String(id));
        this.saveSaved(saved);
    }

    replaceSavedTimer(oldId, newTimer) {
        let saved = this.loadSaved();
        const index = saved.findIndex(s => s.id === oldId);
        if (index !== -1) {
            saved[index] = { ...newTimer, id: Date.now().toString(), savedAt: Date.now() };
            this.saveSaved(saved);
            return true;
        }
        return false;
    }

    // Power Blocker
    async updatePowerBlocker() {
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            if (settings.preventSuspend) {
                const shouldBlock = this._hasActiveTimers();
                window.electronAPI.setPowerBlocker(shouldBlock, 'timer');
            } else {
                window.electronAPI.setPowerBlocker(false, 'timer');
            }
        }
    }

    // Active Timer Management
    start(h, m, s, label, soundId) {
        const totalSeconds = h * 3600 + m * 60 + s;
        if (totalSeconds <= 0) return null;

        // Check the active timers limit
        const activeCount = this.getActiveTimerCount();
        if (activeCount >= LIMITS.MAX_ACTIVE_TIMERS) return null;

        const id = this._generateId();
        const timer = {
            id,
            totalSeconds,
            remainingSeconds: totalSeconds,
            endsAt: Date.now() + totalSeconds * 1000,
            isRunning: true,
            isPaused: false,
            label: label || '',
            soundId: soundId || 'default',
            repeatCount: 0,
            initialHours: h,
            initialMinutes: m,
            initialSeconds: s
        };

        this.timers.set(id, timer);

        this.addRecentTimer({ hours: h, minutes: m, seconds: s, label, soundId });

        this.startTicking();
        this.saveState();
        this.notify('timer-added', { timerId: id });
        this.updatePowerBlocker();

        return id;
    }

    startTicking() {
        if (this.tickIntervalId) return;
        this.tickIntervalId = setInterval(() => this.tick(), TICK_MS);
    }

    stopTicking() {
        if (this.tickIntervalId) {
            clearInterval(this.tickIntervalId);
            this.tickIntervalId = null;
        }
    }

    // Recompute the displayed seconds from the deadline. Returns true if they changed
    _syncRemaining(timer, now) {
        const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
        if (remaining === timer.remainingSeconds) return false;
        timer.remainingSeconds = remaining;
        return true;
    }

    // Remaining time is derived from each deadline, so timers stay exact across
    // sleep/resume and late callbacks instead of drifting one tick at a time
    tick() {
        const now = Date.now();
        const finishedTimers = [];
        let changed = false;

        for (const [id, timer] of this.timers) {
            if (timer.isRunning && !timer.isPaused) {
                if (this._syncRemaining(timer, now)) changed = true;
                if (now >= timer.endsAt) finishedTimers.push(id);
            }
        }

        // Notify the UI to update all timers
        if (changed) this.notify('timers-tick');

        // Finish timers that reached zero
        for (const id of finishedTimers) {
            this.finish(id);
        }

        // Stop ticking when there are no more active timers
        if (!this._hasActiveTimers()) {
            this.stopTicking();
        }
    }

    pause(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer || !timer.isRunning || timer.isPaused) return;

        timer.isPaused = true;
        timer.remainingMs = Math.max(0, timer.endsAt - Date.now());
        timer.remainingSeconds = Math.ceil(timer.remainingMs / 1000);
        delete timer.endsAt;
        this.saveState();
        this.notify('timers-tick');
        this.updatePowerBlocker();

        // Stop ticking when there are no more active timers
        if (!this._hasActiveTimers()) {
            this.stopTicking();
        }
    }

    resume(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer || !timer.isPaused) return;

        timer.isPaused = false;
        timer.endsAt = Date.now() + (timer.remainingMs ?? timer.remainingSeconds * 1000);
        delete timer.remainingMs;
        this.startTicking();
        this.saveState();
        this.notify('timers-tick');
        this.updatePowerBlocker();
    }

    cancel(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer) return;

        this.timers.delete(timerId);
        this.saveState();
        this.notify('timer-removed', { timerId });
        this.updatePowerBlocker();

        if (!this._hasActiveTimers()) {
            this.stopTicking();
        }
    }

    finish(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer) return;

        this.timers.delete(timerId);
        this.saveState();
        this.updatePowerBlocker();

        notificationService.triggerAlert({
            id: timerId,
            type: 'timer',
            title: 'Timer Finished',
            body: timer.label || 'Time is up!',
            soundId: timer.soundId || 'default',
            snoozeEnabled: false,
            repeatEnabled: true,
            repeatCount: timer.repeatCount,
            data: { label: timer.label || '', initialHours: timer.initialHours, initialMinutes: timer.initialMinutes, initialSeconds: timer.initialSeconds }
        });

        this.notify('timer-finished', {
            timerId,
            label: timer.label,
            soundId: timer.soundId,
            repeatCount: timer.repeatCount,
            initialHours: timer.initialHours,
            initialMinutes: timer.initialMinutes,
            initialSeconds: timer.initialSeconds
        });

        if (!this._hasActiveTimers()) {
            this.stopTicking();
        }
    }

    // Stop a finished timer's alert and start the same timer again
    repeatFromAlert(alertId) {
        const alert = notificationService.activeAlerts.find(a => a.id === alertId);
        if (!alert || !alert.data) return;

        notificationService.stopAlert(alertId);
        this.repeatFromConfig({
            initialHours: alert.data.initialHours,
            initialMinutes: alert.data.initialMinutes,
            initialSeconds: alert.data.initialSeconds,
            // The body falls back to "Time is up!" for unlabeled timers; repeat with the real label
            label: alert.data.label ?? (alert.body === 'Time is up!' ? '' : alert.body),
            soundId: alert.soundId,
            repeatCount: alert.repeatCount
        });
    }

    repeatFromConfig(config) {
        const { initialHours, initialMinutes, initialSeconds, label, soundId, repeatCount } = config;
        const totalSeconds = initialHours * 3600 + initialMinutes * 60 + initialSeconds;
        if (totalSeconds <= 0) return null;

        const id = this._generateId();
        const timer = {
            id,
            totalSeconds,
            remainingSeconds: totalSeconds,
            endsAt: Date.now() + totalSeconds * 1000,
            isRunning: true,
            isPaused: false,
            label: label || '',
            soundId: soundId || 'default',
            repeatCount: (repeatCount || 0) + 1,
            initialHours,
            initialMinutes,
            initialSeconds
        };

        this.timers.set(id, timer);
        this.startTicking();
        this.saveState();
        this.notify('timer-added', { timerId: id });
        this.updatePowerBlocker();

        return id;
    }

    // Getters
    getTimer(timerId) {
        return this.timers.get(timerId) || null;
    }

    getAllTimers() {
        return Array.from(this.timers.values());
    }

    getActiveTimerCount() {
        return this.timers.size;
    }


    // Events
    notify(eventName = 'timer-updated', detail = {}) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
}

export const timerManager = new TimerManager();
