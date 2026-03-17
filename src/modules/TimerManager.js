import { notificationService } from '../services/NotificationService.js';
import { STORAGE_KEYS, LIMITS } from '../utils/constants.js';

class TimerManager {
    constructor() {
        /** @type {Map<string, Object>} id → timer state */
        this.timers = new Map();
        this.tickIntervalId = null;
        this._tickCount = 0;

        this.loadState();

        // Inicia o tick se algum timer estiver ativo
        if (this._hasActiveTimers()) {
            this.startTicking();
        }

        // Listener para alterações de configurações para atualizar o bloqueador de energia
        document.addEventListener('settings-updated', (e) => {
            if (e.detail.key === 'preventSuspend') {
                this.updatePowerBlocker();
            }
        });

        // Listener para requisições de repetição de timer
        document.addEventListener('timer-repeat-requested', (e) => {
            const timerId = e.detail?.timerId;
            if (timerId) {
                // Se tentou repetir pelo TimerManager usando o timerId (se aplicável internamente)
                this.repeat(timerId);
            } else if (e.detail?.id) {
                // Veio do IPC / Notification (External)
                const alert = notificationService.activeAlerts.find(a => a.id === e.detail.id);
                if (alert && alert.data) {
                     this.repeatFromConfig({
                         initialHours: alert.data.initialHours,
                         initialMinutes: alert.data.initialMinutes,
                         initialSeconds: alert.data.initialSeconds,
                         label: alert.body,
                         soundId: alert.soundId,
                         repeatCount: alert.repeatCount
                     });
                     notificationService.stopAlert(e.detail.id, 'timer');
                }
            }
        });
    }

    // Helpers
    _hasActiveTimers() {
        for (const timer of this.timers.values()) {
            if (timer.isRunning && !timer.isPaused) return true;
        }
        return false;
    }

    _hasRunningTimers() {
        for (const timer of this.timers.values()) {
            if (timer.isRunning) return true;
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
                const now = Date.now();
                this.timers.clear();

                for (const state of timersArray) {
                    if (state.isRunning) {
                        if (state.isPaused) {
                            // Pausado — mantém o tempo restante como está
                        } else {
                            // Rodando — calcula o tempo decorrido desde o salvamento
                            const elapsedSinceSave = Math.floor((now - state.lastSaved) / 1000);
                            state.remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSinceSave);
                            if (state.remainingSeconds === 0) {
                                // Termina após a inicialização
                                const id = state.id;
                                this.timers.set(id, state);
                                setTimeout(() => this.finish(id), 100);
                                continue;
                            }
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
        const timersArray = [];
        for (const timer of this.timers.values()) {
            timersArray.push({ ...timer, lastSaved: Date.now() });
        }
        localStorage.setItem(STORAGE_KEYS.TIMER_STATES, JSON.stringify(timersArray));
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
                window.electronAPI.setPowerBlocker(shouldBlock);
            } else {
                window.electronAPI.setPowerBlocker(false);
            }
        }
    }

    // Active Timer Management
    start(h, m, s, label, soundId) {
        const totalSeconds = h * 3600 + m * 60 + s;
        if (totalSeconds <= 0) return null;

        // Checa o limite de timers ativos
        const activeCount = this.getActiveTimerCount();
        if (activeCount >= LIMITS.MAX_ACTIVE_TIMERS) return null;

        const id = this._generateId();
        const timer = {
            id,
            totalSeconds,
            remainingSeconds: totalSeconds,
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
        this.tickIntervalId = setInterval(() => this.tick(), 1000);
    }

    stopTicking() {
        if (this.tickIntervalId) {
            clearInterval(this.tickIntervalId);
            this.tickIntervalId = null;
        }
    }

    tick() {
        const finishedTimers = [];

        for (const [id, timer] of this.timers) {
            if (timer.isRunning && !timer.isPaused) {
                if (timer.remainingSeconds > 0) {
                    timer.remainingSeconds--;
                } else {
                    finishedTimers.push(id);
                }
            }
        }

        // Salva a cada 5 ticks
        this._tickCount++;
        if (this._tickCount % 5 === 0) this.saveState();

        // Notifica a UI para atualizar todos os timers
        this.notify('timers-tick');

        // Finaliza timers que chegaram a zero
        for (const id of finishedTimers) {
            this.finish(id);
        }

        // Para de contar se não tiver mais timers ativos
        if (!this._hasActiveTimers()) {
            this.stopTicking();
        }
    }

    pause(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer || !timer.isRunning) return;

        timer.isPaused = true;
        this.saveState();
        this.notify('timers-tick');
        this.updatePowerBlocker();

        // Para de contar se não tiver mais timers ativos
        if (!this._hasActiveTimers()) {
            this.stopTicking();
        }
    }

    resume(timerId) {
        const timer = this.timers.get(timerId);
        if (!timer || !timer.isPaused) return;

        timer.isPaused = false;
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
            data: { initialHours: timer.initialHours, initialMinutes: timer.initialMinutes, initialSeconds: timer.initialSeconds }
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

    repeatFromConfig(config) {
        const { initialHours, initialMinutes, initialSeconds, label, soundId, repeatCount } = config;
        const totalSeconds = initialHours * 3600 + initialMinutes * 60 + initialSeconds;
        if (totalSeconds <= 0) return null;

        const id = this._generateId();
        const timer = {
            id,
            totalSeconds,
            remainingSeconds: totalSeconds,
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
