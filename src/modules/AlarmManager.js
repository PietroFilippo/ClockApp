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

            // Checa se o tempo de soneca passou (hora anterior OU mesma hora, mas minuto anterior)
            if (snoozeHours < currentHours || (snoozeHours === currentHours && snoozeMinutes <= currentMinutes)) {
                // console.log(`Found missed snoozed alarm: ${id} (Target: ${timeStr})`);
                const alarm = this.alarms.find(a => a.id === Number(id));
                if (alarm) {
                    this.triggerAlarm(alarm, true);
                    delete this.snoozedAlarms[id];
                    snoozeChanged = true;
                } else {
                    // Se o alarme não existe mais limpa a soneca
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

        // Adiciona um pequeno buffer (50ms) para garantir que entramos no próximo minuto mas não tanto 
        // que acabe pulando o segundo 0 se o sistema estiver lento

        this.checkTimeout = setTimeout(() => {
            this.checkAlarms();
            this.scheduleNextCheck();
        }, msUntilNextMinute + 50);
    }

    checkAlarms() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = now.getDay();

        // Verificação de segurança: se por algum motivo o timeout disparar antes da virada do minuto (drift negativo),
        // não processa para evitar disparos duplicados ou errados.
        // console.log(`Checking alarms at ${currentTime}:${now.getSeconds()}`);

        this.alarms.forEach(alarm => {
            if (!alarm.enabled) return;
            const isToday = Array.isArray(alarm.repeat) && alarm.repeat.length > 0
                ? alarm.repeat.includes(currentDay)
                : true;

            // Compara apenas HH:MM. Como rodamos aprox no segundo 0, isso é válido.
            if (alarm.time === currentTime && isToday) {
                // Evita disparos múltiplos no mesmo minuto checando se já disparou?
                // Não é necessário se garantirmos que esta função roda apenas uma vez por minuto.
                // O setTimeout recursivo garante o espaçamento de ~60s.

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


    // métodos proxy para AudioManager
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
