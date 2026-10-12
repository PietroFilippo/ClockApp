import { audioManager } from '../utils/AudioManager.js';
import { STORAGE_KEYS, LIMITS } from '../utils/constants.js';
import { notificationService } from '../services/NotificationService.js';

export const INTERVAL_ALERT_ID = 'interval';

// Ticks are frequent so steps change on time; the UI is only notified when a displayed second changes
const TICK_MS = 250;

const stepSeconds = (step) => (step.hours || 0) * 3600 + (step.minutes || 0) * 60 + (step.seconds || 0);

class IntervalTimerManager {
    constructor() {
        this.steps = [];
        this.currentStepIndex = 0;
        this.totalSecondsCurrentStep = 0;
        this.remainingSeconds = 0;
        this.stepEndsAt = 0; // Deadline (ms) of the current step while running
        this.pausedRemainingMs = null;
        this.isRunning = false;
        this.isPaused = false;
        this.soundId = 'default';
        this.presetLabel = '';
        this.activePresetId = null;
        this.intervalId = null;

        this.loadState();
        if (this.isRunning && !this.isPaused) {
            this.startTicking();
            this.updatePowerBlocker();
        }

        document.addEventListener('settings-updated', (e) => {
            if (e.detail.key === 'preventSuspend') {
                this.updatePowerBlocker();
            }
        });

        // Listener for stop requests
        document.addEventListener('interval-timer-stop-requested', () => {
            this.cancel();
        });

        // Restart button of the "Interval Finished" popup
        document.addEventListener('interval-restart-requested', () => {
            this.restartFromAlert();
        });
    }

    // State persistence (running state)

    loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.INTERVAL_TIMER_STATE);
            if (!saved) return;
            const state = JSON.parse(saved);

            this.steps = Array.isArray(state.steps) ? state.steps : [];
            this.currentStepIndex = state.currentStepIndex || 0;
            this.totalSecondsCurrentStep = state.totalSecondsCurrentStep || 0;
            this.soundId = state.soundId || 'default';
            this.presetLabel = state.presetLabel || '';
            this.activePresetId = state.activePresetId || null;
            this.isPaused = state.isPaused || false;
            this.isRunning = (state.isRunning || false) && this.steps.length > 0;

            if (this.isRunning) {
                this.remainingSeconds = state.remainingSeconds || 0;
                if (this.isPaused) {
                    this.pausedRemainingMs = state.pausedRemainingMs ?? this.remainingSeconds * 1000;
                } else {
                    // Saves from older versions only have the remaining seconds at lastSaved.
                    // Steps that ended while the app was closed are caught up on the first tick
                    this.stepEndsAt = Number.isFinite(state.stepEndsAt)
                        ? state.stepEndsAt
                        : (state.lastSaved || Date.now()) + this.remainingSeconds * 1000;
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
            stepEndsAt: this.stepEndsAt,
            pausedRemainingMs: this.pausedRemainingMs,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            soundId: this.soundId,
            presetLabel: this.presetLabel,
            activePresetId: this.activePresetId
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
        this.pausedRemainingMs = null;

        // Starting a new run means the previous "finished" alert has been seen
        if (notificationService.activeAlerts.some(a => a.id === INTERVAL_ALERT_ID)) {
            notificationService.stopAlert(INTERVAL_ALERT_ID);
        }

        this._startCurrentStep();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    _startCurrentStep() {
        const step = this.steps[this.currentStepIndex];
        if (!step) return;

        this.totalSecondsCurrentStep = stepSeconds(step);
        this.remainingSeconds = this.totalSecondsCurrentStep;

        if (this.isPaused) {
            // Changing steps while paused: the new step starts counting when resumed
            this.pausedRemainingMs = this.totalSecondsCurrentStep * 1000;
        } else {
            this.stepEndsAt = Date.now() + this.totalSecondsCurrentStep * 1000;
            this.startTicking();
        }
    }

    startTicking() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.tick(), TICK_MS);
    }

    stopTicking() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
    }

    // Remaining time is derived from the step deadline, so it stays exact across sleep/resume
    tick() {
        if (!this.isRunning || this.isPaused) return;
        const now = Date.now();

        if (now >= this.stepEndsAt) {
            this.advanceElapsedSteps(now);
            return;
        }

        const remaining = Math.ceil((this.stepEndsAt - now) / 1000);
        if (remaining !== this.remainingSeconds) {
            this.remainingSeconds = remaining;
            this.notify();
        }
    }

    // Move past every step whose deadline has passed: normally one, but several after sleep or
    // while the app was closed. Plays a single chime however many steps were skipped
    advanceElapsedSteps(now) {
        audioManager.playChime(this.soundId);

        while (now >= this.stepEndsAt) {
            if (this.currentStepIndex >= this.steps.length - 1) {
                // Last step — finish
                this.finish();
                return;
            }
            this.currentStepIndex++;
            this.totalSecondsCurrentStep = stepSeconds(this.steps[this.currentStepIndex]);
            // Chain from the previous deadline so time spent asleep counts toward the following steps
            this.stepEndsAt += this.totalSecondsCurrentStep * 1000;
        }

        this.remainingSeconds = Math.ceil((this.stepEndsAt - now) / 1000);
        this.saveState();
        this.notify();
    }

    finish() {
        this.stopTicking();
        this.isRunning = false;
        this.isPaused = false;
        // Stop the sound when finished
        setTimeout(() => audioManager.stopChime(), 2000);
        this.saveState();
        this.updatePowerBlocker();
        this.notify('interval-timer-finished', {
            activePresetId: this.activePresetId,
            presetLabel: this.presetLabel
        });

        // Shown from any tab (and as a popup when the app isn't focused). It's silent:
        // the step chime already played once, an interval shouldn't ring until stopped
        notificationService.triggerAlert({
            id: INTERVAL_ALERT_ID,
            type: 'interval',
            title: 'Interval Finished',
            body: this.presetLabel || 'All steps completed!',
            soundId: this.soundId,
            silent: true,
            snoozeEnabled: false,
            repeatEnabled: true,
            data: {
                steps: this.steps.map(s => ({ ...s })),
                soundId: this.soundId,
                presetLabel: this.presetLabel,
                presetId: this.activePresetId
            }
        });
    }

    // Run the finished interval again (Restart in its alert)
    restartFromAlert() {
        const alert = notificationService.activeAlerts.find(a => a.id === INTERVAL_ALERT_ID);
        if (!alert) return;

        const { steps, soundId, presetLabel, presetId } = alert.data;
        notificationService.stopAlert(INTERVAL_ALERT_ID);
        this.start(steps, soundId, presetLabel, presetId);
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        this.pausedRemainingMs = Math.max(0, this.stepEndsAt - Date.now());
        this.remainingSeconds = Math.ceil(this.pausedRemainingMs / 1000);
        this.stopTicking();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    resume() {
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this.stepEndsAt = Date.now() + (this.pausedRemainingMs ?? this.remainingSeconds * 1000);
        this.pausedRemainingMs = null;
        this.startTicking();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    cancel() {
        this.stopTicking();
        this.isRunning = false;
        this.isPaused = false;
        this.remainingSeconds = 0;
        audioManager.stopChime();
        this.saveState();
        this.updatePowerBlocker();
        this.notify();
    }

    skipStep() {
        if (!this.isRunning) return;
        if (this.currentStepIndex < this.steps.length - 1) {
            audioManager.stopChime();
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
            audioManager.stopChime();
            this.currentStepIndex--;
            this._startCurrentStep();
            this.saveState();
            this.notify();
        } else {
            audioManager.stopChime();
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
        return (steps || this.steps).reduce((sum, s) => sum + stepSeconds(s), 0);
    }

    async updatePowerBlocker() {
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            if (settings.preventSuspend) {
                const shouldBlock = this.isRunning && !this.isPaused;
                window.electronAPI.setPowerBlocker(shouldBlock, 'interval');
            } else {
                window.electronAPI.setPowerBlocker(false, 'interval');
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
