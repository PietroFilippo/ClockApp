import { STORAGE_KEYS } from '../utils/constants.js';
import { notificationService } from '../services/NotificationService.js';
import { loadJSON, isPlainObject } from '../utils/storage.js';

const MINUTE_MS = 60 * 1000;
// Alarms and snoozes that came due while the PC was asleep (or the app was closed) still ring
// if they're at most this old; older ones are skipped rather than ringing hours late
const MISSED_ALARM_WINDOW_MS = 30 * MINUTE_MS;

const toTimeString = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const floorToMinute = (ms) => Math.floor(ms / MINUTE_MS) * MINUTE_MS;

export class AlarmManager {
    constructor() {
        this.alarms = loadJSON(STORAGE_KEYS.ALARMS, [], Array.isArray);
        this.checkTimeout = null;
        // alarm id -> timestamp (ms) when the snooze ends
        this.snoozedAlarms = this.migrateSnoozes(loadJSON(STORAGE_KEYS.SNOOZED_ALARMS, {}, isPlainObject));
        // alarm id -> the occurrence it last rang for, so a repeated local time (when DST ends) can't ring
        // twice; persisted so a restart in between doesn't ring it again either
        this.lastFired = loadJSON(STORAGE_KEYS.ALARM_LAST_FIRED, {}, isPlainObject);
    }

    init() {
        this.startMonitoring();
        this.setupIPCListeners();
        // Catch up right away on anything that came due while the app wasn't running
        setTimeout(() => this.checkAlarms(), 500);
    }

    // Older versions stored snoozes as "HH:MM" without a date: resolve each to the nearest such moment
    migrateSnoozes(snoozes) {
        const now = Date.now();
        const halfDay = 12 * 60 * MINUTE_MS;

        for (const [id, value] of Object.entries(snoozes)) {
            if (typeof value === 'number') continue;

            const [hours, minutes] = String(value).split(':').map(Number);
            if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
                delete snoozes[id];
                continue;
            }

            // Snoozes only last minutes, so the right day is the one within 12 hours of now
            const due = new Date();
            due.setHours(hours, minutes, 0, 0);
            if (due.getTime() - now > halfDay) due.setDate(due.getDate() - 1);
            else if (now - due.getTime() > halfDay) due.setDate(due.getDate() + 1);
            snoozes[id] = due.getTime();
        }
        return snoozes;
    }

    setupIPCListeners() {
        if (window.electronAPI && window.electronAPI.onNotificationAction) {
            window.electronAPI.onNotificationAction((data) => {
                if (data.id === 'interval') {
                    if (data.action === 'repeat') {
                        document.dispatchEvent(new CustomEvent('interval-restart-requested'));
                    } else {
                        notificationService.stopAlert(data.id);
                    }
                    return;
                }

                if (data.action === 'stop') {
                    if (data.id === 'timer' || String(data.id).startsWith('timer-')) {
                        notificationService.stopAlert(data.id);
                        document.dispatchEvent(new CustomEvent('timer-stop-requested', { detail: { id: data.id } }));
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

        // Add a small buffer (50ms) to make sure we land in the next minute
        this.checkTimeout = setTimeout(() => {
            this.checkAlarms();
            this.scheduleNextCheck();
        }, msUntilNextMinute + 50);
    }

    checkAlarms() {
        const now = Date.now();
        const currentMinute = floorToMinute(now);
        const lastChecked = Number(localStorage.getItem(STORAGE_KEYS.ALARM_LAST_CHECK)) || currentMinute - MINUTE_MS;

        // Normally exactly one minute has passed since the last check. After sleep, a busy system, a clock
        // change or while the app was closed, more has: check the skipped minutes too (within the window)
        // If the clock moved backwards, check just the current minute; if this minute was already
        // checked (e.g. the app restarted), there's nothing new to check
        let from = lastChecked > currentMinute ? currentMinute : lastChecked + MINUTE_MS;
        from = Math.max(from, currentMinute - MISSED_ALARM_WINDOW_MS);

        let changed = false;
        for (let minute = from; minute <= currentMinute; minute += MINUTE_MS) {
            if (this.checkMinute(new Date(minute))) changed = true;
        }
        if (this.checkSnoozes(now)) changed = true;

        localStorage.setItem(STORAGE_KEYS.ALARM_LAST_CHECK, String(currentMinute));
        if (changed) this.saveAlarms();
    }

    // Ring every enabled alarm scheduled for this minute. Returns true if an alarm was changed
    checkMinute(date) {
        const time = toTimeString(date);
        const day = date.getDay();
        const occurrence = `${date.toDateString()} ${time}`;
        let changed = false;

        this.alarms.forEach(alarm => {
            if (!alarm.enabled || alarm.time !== time) return;
            const repeats = Array.isArray(alarm.repeat) && alarm.repeat.length > 0;
            if (repeats && !alarm.repeat.includes(day)) return;
            if (this.lastFired[alarm.id] === occurrence) return;

            this.lastFired[alarm.id] = occurrence;
            localStorage.setItem(STORAGE_KEYS.ALARM_LAST_FIRED, JSON.stringify(this.lastFired));
            this.triggerAlarm(alarm, false, date);

            // One-time alarms switch themselves off after ringing
            if (!repeats) {
                alarm.enabled = false;
                changed = true;
            }
        });

        return changed;
    }

    // Ring snoozes that have ended. Returns true if any snooze was removed
    checkSnoozes(now) {
        let changed = false;

        for (const [id, dueAt] of Object.entries(this.snoozedAlarms)) {
            if (dueAt > now) continue;

            delete this.snoozedAlarms[id];
            changed = true;

            const alarm = this.alarms.find(a => a.id === Number(id));
            // A snooze that ended long ago (e.g. the PC slept through it) is dropped instead of ringing late
            if (alarm && now - dueAt <= MISSED_ALARM_WINDOW_MS) {
                this.triggerAlarm(alarm, true, new Date(dueAt));
            }
        }

        return changed;
    }

    // when: the minute the alarm was due (earlier than now if it was missed while the PC slept)
    triggerAlarm(alarm, isSnooze = false, when = new Date()) {
        const timeStr = toTimeString(when);
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
        // Minute-aligned like alarms, so it rings at the start of that minute
        this.snoozedAlarms[alarmId] = floorToMinute(Date.now()) + duration * MINUTE_MS;
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
            const previous = this.alarms[index];
            // A new time or turning snooze off replaces any pending snooze of the old schedule
            if ((data.time && data.time !== previous.time) || data.snoozeEnabled === false) {
                this.clearSnooze(id);
            }
            this.alarms[index] = { ...previous, ...data, label: data.label || '' };
            this.saveAlarms();
        }
    }

    toggleAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = !alarm.enabled;
            // Switching an alarm off also cancels its pending snooze
            if (!alarm.enabled) this.clearSnooze(id);
            this.saveAlarms();
        }
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        if (this.snoozedAlarms[id]) delete this.snoozedAlarms[id];
        delete this.lastFired[id];
        localStorage.setItem(STORAGE_KEYS.ALARM_LAST_FIRED, JSON.stringify(this.lastFired));
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

    // alarm id -> "HH:MM" when the snooze ends, for display
    getSnoozedAlarms() {
        return Object.fromEntries(
            Object.entries(this.snoozedAlarms).map(([id, dueAt]) => [id, toTimeString(new Date(dueAt))])
        );
    }
}

export const alarmManager = new AlarmManager();
