import { audioManager } from '../utils/AudioManager.js';
import { STORAGE_KEYS, LIMITS } from '../utils/constants.js';

class IntervalTimerManager {
    constructor() {
        this.steps = [];
        this.currentStepIndex = 0;
        this.totalSecondsCurrentStep = 0;
        this.remainingSeconds = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.soundId = 'default';
        this.presetLabel = '';
        this.intervalId = null;

        this.loadState();
        if (this.isRunning && !this.isPaused) {
            this.startTicking();
        }

        // Listener para requisições de parar
        document.addEventListener('interval-timer-stop-requested', () => {
            this.cancel();
        });
    }

    // Persistência de estado (running state)

    loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.INTERVAL_TIMER_STATE);
            if (!saved) return;
            const state = JSON.parse(saved);
            const now = Date.now();

            this.steps = state.steps || [];
            this.currentStepIndex = state.currentStepIndex || 0;
            this.totalSecondsCurrentStep = state.totalSecondsCurrentStep || 0;
            this.soundId = state.soundId || 'default';
            this.presetLabel = state.presetLabel || '';
            this.activePresetId = state.activePresetId || null;
            this.isPaused = state.isPaused || false;
            this.isRunning = state.isRunning || false;

            if (this.isRunning) {
                if (this.isPaused) {
                    this.remainingSeconds = state.remainingSeconds;
                } else {
                    const elapsed = Math.floor((now - state.lastSaved) / 1000);
                    this.remainingSeconds = Math.max(0, state.remainingSeconds - elapsed);
                    if (this.remainingSeconds === 0) {
                        setTimeout(() => this.advanceStep(), 100);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load interval timer state', e);
        }
    }

    saveState() {
        const state = {
            steps: this.steps,
            currentStepIndex: this.currentStepIndex,
            totalSecondsCurrentStep: this.totalSecondsCurrentStep,
            remainingSeconds: this.remainingSeconds,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            soundId: this.soundId,
            presetLabel: this.presetLabel,
            lastSaved: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.INTERVAL_TIMER_STATE, JSON.stringify(state));
    }

    // Presets CRUD
    loadPresets() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.INTERVAL_TIMERS);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to load interval presets', e);
            return [];
        }
    }

    savePresets(presets) {
        localStorage.setItem(STORAGE_KEYS.INTERVAL_TIMERS, JSON.stringify(presets));
        this.notify('interval-presets-updated');
    }

    getPresets() {
        return this.loadPresets();
    }

    addPreset(preset) {
        let presets = this.loadPresets();
        if (presets.length >= LIMITS.MAX_INTERVAL_PRESETS) {
            return { success: false, presets };
        }
        presets.push({
            ...preset,
            id: Date.now().toString(),
            createdAt: Date.now()
        });
        this.savePresets(presets);
        return { success: true, presets };
    }

    updatePreset(id, updates) {
        let presets = this.loadPresets();
        const index = presets.findIndex(p => p.id === id);
        if (index !== -1) {
            presets[index] = { ...presets[index], ...updates };
            this.savePresets(presets);
        }
    }

    replacePreset(idToReplace, preset) {
        let presets = this.loadPresets();
        const index = presets.findIndex(p => p.id === idToReplace);
        if (index !== -1) {
            presets[index] = {
                ...preset,
                id: presets[index].id,
                createdAt: presets[index].createdAt
            };
            this.savePresets(presets);
        }
        return { success: true, presets };
    }

    deletePreset(id) {
        let presets = this.loadPresets();
        presets = presets.filter(p => String(p.id) !== String(id));
        this.savePresets(presets);
    }

    // Playback
    start(steps, soundId, presetLabel = '', presetId = null) {
        if (!steps || steps.length === 0) return;

        this.steps = steps.map(s => ({ ...s }));
        this.currentStepIndex = 0;
        this.soundId = soundId;
        this.presetLabel = presetLabel;
        this.activePresetId = presetId;
        this.isRunning = true;
        this.isPaused = false;

        this._startCurrentStep();
        this.saveState();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    _startCurrentStep() {
        const step = this.steps[this.currentStepIndex];
        if (!step) return;

        this.totalSecondsCurrentStep = (step.hours || 0) * 3600 + (step.minutes || 0) * 60 + (step.seconds || 0);
        this.remainingSeconds = this.totalSecondsCurrentStep;
        this.startTicking();
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
                this.advanceStep();
            }
        }
    }

    advanceStep() {
        audioManager.stopAlarm();
        audioManager.playAlarm(this.soundId, false);

        if (this.currentStepIndex < this.steps.length - 1) {
            // Próximo step
            this.currentStepIndex++;
            this._startCurrentStep();
            this.saveState();
            this.notify();
        } else {
            // Último step — finaliza
            this.finish();
        }
    }

    finish() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.isRunning = false;
        this.isPaused = false;
        // Para o som ao finalizar
        setTimeout(() => audioManager.stopAlarm(), 2000);
        this.saveState();
        this.saveState();
        this.updatePowerBlocker();
        this.notify('interval-timer-finished', {
            activePresetId: this.activePresetId,
            presetLabel: this.presetLabel
        });
    }

    pause() {
        this.isPaused = true;
        this.saveState();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    resume() {
        this.isPaused = false;
        this.startTicking();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    cancel() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.isRunning = false;
        this.isPaused = false;
        this.remainingSeconds = 0;
        audioManager.stopAlarm();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    skipStep() {
        if (!this.isRunning) return;
        if (this.currentStepIndex < this.steps.length - 1) {
            audioManager.stopAlarm();
            this.currentStepIndex++;
            this._startCurrentStep();
            this.saveState();
            this.notify();
        } else {
            this.finish();
        }
    }

    previousStep() {
        if (!this.isRunning) return;
        if (this.currentStepIndex > 0) {
            audioManager.stopAlarm();
            this.currentStepIndex--;
            this._startCurrentStep();
            this.saveState();
            this.notify();
        } else {
            audioManager.stopAlarm();
            this._startCurrentStep();
            this.saveState();
            this.notify();
        }
    }

    getState() {
        return {
            steps: this.steps,
            currentStepIndex: this.currentStepIndex,
            totalStepsCount: this.steps.length,
            totalSecondsCurrentStep: this.totalSecondsCurrentStep,
            remainingSeconds: this.remainingSeconds,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            soundId: this.soundId,
            presetLabel: this.presetLabel,
            activePresetId: this.activePresetId,
            currentStepLabel: this.steps[this.currentStepIndex]?.label || ''
        };
    }

    getTotalTime(steps) {
        return (steps || this.steps).reduce((sum, s) => {
            return sum + (s.hours || 0) * 3600 + (s.minutes || 0) * 60 + (s.seconds || 0);
        }, 0);
    }

    async updatePowerBlocker() {
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            if (settings.preventSuspend) {
                const shouldBlock = this.isRunning && !this.isPaused;
                window.electronAPI.setPowerBlocker(shouldBlock);
            } else {
                window.electronAPI.setPowerBlocker(false);
            }
        }
    }

    notify(eventName = 'interval-timer-updated', additionalData = {}) {
        document.dispatchEvent(new CustomEvent(eventName, {
            detail: { ...this.getState(), ...additionalData }
        }));
    }
}

export const intervalTimerManager = new IntervalTimerManager();
