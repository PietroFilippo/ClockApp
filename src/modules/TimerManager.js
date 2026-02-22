import { alarmManager } from './AlarmManager.js';
import { STORAGE_KEYS, LIMITS } from '../utils/constants.js';

class TimerManager {
    constructor() {
        this.totalSeconds = 0;
        this.remainingSeconds = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.label = '';
        this.soundId = 'default';
        this.intervalId = null;
        this.repeatCount = 0;

        this.initialHours = 0;
        this.initialMinutes = 0;
        this.initialSeconds = 0;


        this.loadState();
        if (this.isRunning && !this.isPaused) {
            this.startTicking();
        }

        // Listener para alterações de configurações para atualizar o bloqueador de energia imediatamente
        document.addEventListener('settings-updated', (e) => {
            if (e.detail.key === 'preventSuspend') {
                this.updatePowerBlocker();
            }
        });

        // Listener para requisições de repetição de timer
        document.addEventListener('timer-repeat-requested', () => {
            this.repeat();
        });
    }

    loadState() {
        const saved = localStorage.getItem(STORAGE_KEYS.TIMER_STATE);
        if (saved) {
            const state = JSON.parse(saved);
            const now = Date.now();

            this.totalSeconds = state.totalSeconds || 0;
            this.label = state.label || '';
            this.soundId = state.soundId || 'default';
            this.repeatCount = state.repeatCount || 0;
            this.isPaused = state.isPaused || false;
            this.isRunning = state.isRunning || false;

            this.initialHours = state.initialHours || 0;
            this.initialMinutes = state.initialMinutes || 0;
            this.initialSeconds = state.initialSeconds || 0;

            if (this.isRunning) {
                if (this.isPaused) {
                    this.remainingSeconds = state.remainingSeconds;
                } else {
                    const elapsedSinceSave = Math.floor((now - state.lastSaved) / 1000);
                    this.remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSinceSave);
                    if (this.remainingSeconds === 0) {
                        setTimeout(() => this.finish(), 100);
                    }
                }
            }
        }
    }

    saveState() {
        const state = {
            totalSeconds: this.totalSeconds,
            remainingSeconds: this.remainingSeconds,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            label: this.label,
            soundId: this.soundId,
            initialHours: this.initialHours,
            initialMinutes: this.initialMinutes,
            initialSeconds: this.initialSeconds,
            repeatCount: this.repeatCount,
            lastSaved: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
    }

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

    // Timers salvos

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


    async updatePowerBlocker() {
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            if (settings.preventSuspend) {
                // se timer estiver rodando e não pausado, bloqueia a energia
                const shouldBlock = this.isRunning && !this.isPaused;
                window.electronAPI.setPowerBlocker(shouldBlock);
            } else {
                window.electronAPI.setPowerBlocker(false);
            }
        }
    }

    start(h, m, s, label, soundId) {
        this.totalSeconds = h * 3600 + m * 60 + s;
        if (this.totalSeconds <= 0) return;

        this.initialHours = h;
        this.initialMinutes = m;
        this.initialSeconds = s;

        this.remainingSeconds = this.totalSeconds;
        this.label = label;
        this.soundId = soundId;
        this.repeatCount = 0;
        this.isRunning = true;
        this.isPaused = false;

        this.addRecentTimer({ hours: h, minutes: m, seconds: s, label, soundId });

        this.startTicking();
        this.saveState();
        this.notify();
        this.updatePowerBlocker();
    }

    startTicking() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.tick(), 1000);
    }

    tick() {
        if (this.isRunning && !this.isPaused) {
            if (this.remainingSeconds > 0) {
                this.remainingSeconds--;
                if (this.remainingSeconds % 5 === 0) this.saveState();
                this.notify();
            } else {
                this.finish();
            }
        }
    }

    pause() {
        this.isPaused = true;
        this.saveState();
        this.notify();
        this.updatePowerBlocker();
    }

    resume() {
        this.isPaused = false;
        this.startTicking();
        this.saveState();
        this.notify();
        this.updatePowerBlocker();
    }

    cancel() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.isRunning = false;
        this.isPaused = false;
        this.remainingSeconds = 0;
        this.saveState();
        this.notify();
        this.updatePowerBlocker();
    }

    finish() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.isRunning = false;
        this.isPaused = false;
        this.saveState();
        this.updatePowerBlocker();

        alarmManager.triggerTimer(this.label, this.soundId, this.repeatCount);
        this.notify('timer-finished');
    }

    repeat() {
        const currentCount = this.repeatCount;
        this.start(this.initialHours, this.initialMinutes, this.initialSeconds, this.label, this.soundId);
        this.repeatCount = currentCount + 1;
        this.saveState();
    }

    getState() {
        return {
            totalSeconds: this.totalSeconds,
            remainingSeconds: this.remainingSeconds,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            label: this.label,
            soundId: this.soundId,
            initialHours: this.initialHours,
            initialMinutes: this.initialMinutes,
            initialSeconds: this.initialSeconds,
            repeatCount: this.repeatCount
        };
    }

    notify(eventName = 'timer-updated') {
        document.dispatchEvent(new CustomEvent(eventName, { detail: this.getState() }));
    }
}

export const timerManager = new TimerManager();
