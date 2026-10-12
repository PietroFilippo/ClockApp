import { audioManager } from '../utils/AudioManager.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { notificationService } from '../services/NotificationService.js';

export class AlarmManager {
    constructor() {
        this.alarms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ALARMS)) || [];
        this.checkTimeout = null;
        this.snoozedAlarms = JSON.parse(localStorage.getItem(STORAGE_KEYS.SNOOZED_ALARMS)) || {};
    }

    init() {

        this.startMonitoring();
        this.setupIPCListeners();
        setTimeout(() => this.checkMissedSnoozes(), 500);
    }

    checkMissedSnoozes() {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        let snoozeChanged = false;

        Object.keys(this.snoozedAlarms).forEach(id => {
            const timeStr = this.snoozedAlarms[id]; // "HH:MM"
            const [snoozeHours, snoozeMinutes] = timeStr.split(':').map(Number);

            // Check whether the snooze time has passed (earlier hour OR same hour but earlier minute)
            if (snoozeHours < currentHours || (snoozeHours === currentHours && snoozeMinutes <= currentMinutes)) {
                // console.log(`Found missed snoozed alarm: ${id} (Target: ${timeStr})`);
                const alarm = this.alarms.find(a => a.id === Number(id));
                if (alarm) {
                    this.triggerAlarm(alarm, true);
                    delete this.snoozedAlarms[id];
                    snoozeChanged = true;
                } else {
                    // If the alarm no longer exists, clear the snooze
                    delete this.snoozedAlarms[id];
                    snoozeChanged = true;
                }
            }
        });

        if (snoozeChanged) {
            this.saveAlarms();
        }
    }

    setupIPCListeners() {
        if (window.electronAPI && window.electronAPI.onNotificationAction) {
            window.electronAPI.onNotificationAction((data) => {
                if (data.action === 'stop') {
                    if (data.id === 'timer' || String(data.id).startsWith('timer-')) {
                        notificationService.stopAlert(data.id, 'timer');
                        document.dispatchEvent(new CustomEvent('timer-stop-requested'));
                    } else {
                        this.stopAlarm(Number(data.id));
                        document.dispatchEvent(new CustomEvent('alarm-stop-requested', { detail: { id: Number(data.id) } }));
                    }
                } else if (data.action === 'repeat') {
                    if (data.id === 'timer' || String(data.id).startsWith('timer-')) {
                        // We must pass the id, so TimerManager knows which config to look for
                        document.dispatchEvent(new CustomEvent('timer-repeat-requested', { detail: { id: data.id } }));
                    }
                } else if (data.action === 'snooze') {
                    if (data.id !== 'timer' && !String(data.id).startsWith('timer-')) {
                        this.snoozeAlarm(Number(data.id));
                        document.dispatchEvent(new CustomEvent('alarm-snooze-requested', { detail: { id: Number(data.id) } }));
                    }
                }
            });
        }
    }

    startMonitoring() {
        if (this.checkTimeout) clearTimeout(this.checkTimeout);
        this.scheduleNextCheck();
    }

    scheduleNextCheck() {
        const now = new Date();
        const seconds = now.getSeconds();
        const msUntilNextMinute = (60 - seconds) * 1000 - now.getMilliseconds();

        // Add a small buffer (50ms) to make sure we land in the next minute, but not so much 
        // that we end up skipping second 0 if the system is slow

        this.checkTimeout = setTimeout(() => {
            this.checkAlarms();
            this.scheduleNextCheck();
        }, msUntilNextMinute + 50);
    }

    checkAlarms() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = now.getDay();

        // Safety check: if for some reason the timeout fires before the minute rolls over (negative drift),
        // do not process, to avoid duplicate or wrong triggers.
        // console.log(`Checking alarms at ${currentTime}:${now.getSeconds()}`);

        this.alarms.forEach(alarm => {
            if (!alarm.enabled) return;
            const isToday = Array.isArray(alarm.repeat) && alarm.repeat.length > 0
                ? alarm.repeat.includes(currentDay)
                : true;

            // Compare only HH:MM. Since we run at roughly second 0, this is valid.
            if (alarm.time === currentTime && isToday) {
                // Avoid multiple triggers within the same minute by checking whether it already fired?
                // Not necessary if we guarantee this function runs only once per minute.
                // The recursive setTimeout guarantees ~60s spacing.

                // console.log(`Triggering alarm ${alarm.id} at ${currentTime}`);
                this.triggerAlarm(alarm);

                if (!Array.isArray(alarm.repeat) || alarm.repeat.length === 0) {
                    alarm.enabled = false;
                    this.saveAlarms();
                }
            }
        });

        let snoozeChanged = false;
        Object.keys(this.snoozedAlarms).forEach(id => {
            if (this.snoozedAlarms[id] === currentTime) {
                const alarm = this.alarms.find(a => a.id === Number(id));
                if (alarm) {
                    this.triggerAlarm(alarm, true);
                    delete this.snoozedAlarms[id];
                    snoozeChanged = true;
                }
            }
        });

        if (snoozeChanged) {
            this.saveAlarms();
        }
    }


    // proxy methods for AudioManager
    getBuiltInSounds() {
        return audioManager.getBuiltInSounds();
    }

    getCustomSounds() {
        return audioManager.getCustomSounds();
    }

    async triggerAlarm(alarm, isSnooze = false) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const title = isSnooze ? `Snooze (${timeStr})` : `Alarm (${timeStr})`;

        notificationService.triggerAlert({
            id: alarm.id,
            type: 'alarm',
            title: title,
            body: alarm.label || 'Time to wake up!',
            soundId: alarm.sound || 'default',
            snoozeEnabled: alarm.snoozeEnabled,
            repeatEnabled: false,
            data: { alarm, isSnooze }
        });
    }

    stopAlarm(alarmId) {
        if (alarmId) {
            notificationService.stopAlert(alarmId);
            this.clearSnooze(alarmId);
            this.saveAlarms();
        }
    }

    snoozeAlarm(alarmId) {
        notificationService.stopAlert(alarmId);

        const alarm = this.alarms.find(a => a.id === alarmId);
        if (!alarm) return;

        const duration = alarm.snoozeInterval || 9;
        const now = new Date();
        now.setMinutes(now.getMinutes() + duration);
        const nextTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        this.snoozedAlarms[alarmId] = nextTime;
        this.saveAlarms();
    }

    cancelSnooze(alarmId) {
        this.clearSnooze(alarmId);
        this.saveAlarms();
    }

    clearSnooze(alarmId) {
        if (this.snoozedAlarms[alarmId]) {
            delete this.snoozedAlarms[alarmId];
        }
    }

    addAlarm(data) {
        this.alarms.push({
            id: Date.now(),
            time: data.time,
            label: data.label || '',
            repeat: data.repeat || [],
            sound: data.sound || 'default',
            snoozeEnabled: data.snoozeEnabled !== false,
            snoozeInterval: data.snoozeInterval || 9,
            enabled: true
        });
        this.saveAlarms();
    }

    updateAlarm(id, data) {
        const index = this.alarms.findIndex(a => a.id === id);
        if (index !== -1) {
            this.alarms[index] = { ...this.alarms[index], ...data, label: data.label || '' };
            this.saveAlarms();
        }
    }

    toggleAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = !alarm.enabled;
            this.saveAlarms();
        }
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        if (this.snoozedAlarms[id]) delete this.snoozedAlarms[id];
        this.saveAlarms();
    }

    saveAlarms() {
        localStorage.setItem(STORAGE_KEYS.ALARMS, JSON.stringify(this.alarms));
        localStorage.setItem(STORAGE_KEYS.SNOOZED_ALARMS, JSON.stringify(this.snoozedAlarms));
        document.dispatchEvent(new CustomEvent('alarms-updated'));
    }

    getAlarms() {
        return this.alarms;
    }

    getSnoozedAlarms() {
        return this.snoozedAlarms;
    }
}

export const alarmManager = new AlarmManager();
