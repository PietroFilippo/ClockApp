import { audioManager } from '../utils/AudioManager.js';

export class AlarmManager {
    constructor() {
        this.alarms = JSON.parse(localStorage.getItem('alarms')) || [];
        this.permissionsGranted = false;
        this.checkInterval = null;
        this.snoozedAlarms = JSON.parse(localStorage.getItem('snoozed-alarms')) || {};
        this.activeAlerts = []; // Queue/Stack for active notifications
        this.lastUsedSound = localStorage.getItem('lastUsedSound') || 'default';
    }

    init() {
        if (Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                this.permissionsGranted = permission === 'granted';
            });
        } else {
            this.permissionsGranted = true;
        }

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
                console.log(`Found missed snoozed alarm: ${id} (Target: ${timeStr})`);
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
                console.log('Notification Action:', data);
                if (data.action === 'stop') {
                    if (data.id === 'timer' || String(data.id).startsWith('timer-')) {
                        this.stopTimer();
                        document.dispatchEvent(new CustomEvent('timer-stop-requested'));
                    } else {
                        this.stopAlarm(Number(data.id));
                        document.dispatchEvent(new CustomEvent('alarm-stop-requested', { detail: { id: Number(data.id) } }));
                    }
                } else if (data.action === 'repeat') {
                    if (data.id === 'timer' || String(data.id).startsWith('timer-')) {
                        this.stopTimer();
                        document.dispatchEvent(new CustomEvent('timer-repeat-requested'));
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
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = setInterval(() => this.checkAlarms(), 1000);
    }

    checkAlarms() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentSeconds = now.getSeconds();
        const currentDay = now.getDay();

        if (currentSeconds !== 0) return;

        this.alarms.forEach(alarm => {
            if (!alarm.enabled) return;
            const isToday = Array.isArray(alarm.repeat) && alarm.repeat.length > 0
                ? alarm.repeat.includes(currentDay)
                : true;
            if (alarm.time === currentTime && isToday) {
                console.log(`Triggering alarm ${alarm.id} at ${currentTime}`);
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

    getLastUsedSound() {
        return this.lastUsedSound;
    }

    setLastUsedSound(soundId) {
        this.lastUsedSound = soundId;
        localStorage.setItem('lastUsedSound', soundId);
    }

    // métodos proxy para AudioManager
    getBuiltInSounds() {
        return audioManager.getBuiltInSounds();
    }

    getCustomSounds() {
        return audioManager.getCustomSounds();
    }

    async triggerAlarm(alarm, isSnooze = false) {
        // Remove se já existe para mover pro topo (re-trigger)
        this.activeAlerts = this.activeAlerts.filter(a => a.id !== alarm.id);

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const title = isSnooze ? `Snooze (${timeStr})` : `Alarm (${timeStr})`;

        const alertItem = {
            id: alarm.id,
            type: 'alarm',
            title: title,
            body: alarm.label || 'Time to wake up!',
            soundId: alarm.sound || 'default',
            snoozeEnabled: alarm.snoozeEnabled,
            repeatEnabled: false,
            timestamp: Date.now()
        };

        this.activeAlerts.push(alertItem);
        this.updateActiveAlert();

        document.dispatchEvent(new CustomEvent('alarm-ring', { detail: { alarm, isSnooze } }));
    }

    async triggerTimer(label, soundId, repeatCount = 0) {
        const timerId = `timer-${Date.now()}`;

        const alertItem = {
            id: timerId,
            type: 'timer',
            title: 'Timer Finished',
            body: label || 'Time is up!',
            soundId: soundId || 'default',
            snoozeEnabled: false,
            repeatEnabled: true,
            repeatCount: repeatCount,
            timestamp: Date.now()
        };

        this.activeAlerts.push(alertItem);
        this.updateActiveAlert();

        document.dispatchEvent(new CustomEvent('timer-ring', { detail: { label, repeatCount, id: timerId } }));
    }

    updateActiveAlert(shouldDispatchEvent = false) {
        if (this.activeAlerts.length === 0) {
            this.stopAudio();
            return;
        }

        // Pega o último (topo da pilha)
        const currentAlert = this.activeAlerts[this.activeAlerts.length - 1];

        // Toca o som do alerta atual
        audioManager.playAlarm(currentAlert.soundId);

        // Atualiza a notificação externa
        this.handleNotification(currentAlert.title, currentAlert.body, {
            snoozeEnabled: currentAlert.snoozeEnabled,
            repeatEnabled: currentAlert.repeatEnabled,
            id: currentAlert.id,
            repeatCount: currentAlert.repeatCount
        }).catch(err => console.error("Notification failed", err));

        // Se solicitado, dispara evento para atualizar a UI interna
        if (shouldDispatchEvent) {
            if (currentAlert.type === 'alarm') {
                // Recupera o objeto alarm original para passar no detail (ou reconstroi um minimo necessário)
                const alarm = this.alarms.find(a => a.id === currentAlert.id);
                if (alarm) {
                    document.dispatchEvent(new CustomEvent('alarm-ring', { detail: { alarm, isSnooze: false } }));
                }
            } else if (currentAlert.type === 'timer') {
                document.dispatchEvent(new CustomEvent('timer-ring', {
                    detail: {
                        label: currentAlert.body,
                        repeatCount: currentAlert.repeatCount,
                        id: currentAlert.id
                    }
                }));
            }
        }
    }

    async handleNotification(title, body, data = {}) {
        if (!this.permissionsGranted) return;

        let type = 'system';
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            type = settings.notificationType || 'both';
        }

        if (type === 'system' || type === 'both') {
            // Nota: Notificações do sistema Windows não suportam atualização dinâmica fácil, 
            // então isso pode empilhar no Action Center, mas o foco é a janela customizada.
            new Notification(title, { body });
        }

        if (type === 'app' || type === 'both') {
            if (window.electronAPI) {
                window.electronAPI.showCustomNotification({
                    title,
                    body,
                    snoozeEnabled: data.snoozeEnabled,
                    repeatEnabled: data.repeatEnabled,
                    id: data.id,
                    repeatCount: data.repeatCount
                });
            }
        }
    }

    stopAlarm(alarmId) {
        if (alarmId) {
            this.activeAlerts = this.activeAlerts.filter(a => a.id !== alarmId);
            this.clearSnooze(alarmId);
            this.saveAlarms();
        }
        this.updateActiveAlert(true);
    }

    // Chamado quando um timer é parado
    stopTimer() {
        this.activeAlerts = this.activeAlerts.filter(a => String(a.id).indexOf('timer-') === -1);
        this.updateActiveAlert(true);
    }

    checkAudioState() {
        // Depreciado por updateActiveAlert
    }

    stopAudio() {
        this.activeAlerts = [];
        audioManager.stopAlarm();
        document.dispatchEvent(new CustomEvent('all-alerts-stopped'));

        if (window.electronAPI) {
            window.electronAPI.closeCustomNotification();
        }
    }

    snoozeAlarm(alarmId) {
        this.activeAlerts = this.activeAlerts.filter(a => a.id !== alarmId);
        this.updateActiveAlert(true);

        const alarm = this.alarms.find(a => a.id === alarmId);
        if (!alarm) return;

        const duration = alarm.snoozeInterval || 9;
        const now = new Date();
        now.setMinutes(now.getMinutes() + duration);
        const nextTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        this.snoozedAlarms[alarmId] = nextTime;
        console.log(`Alarm snoozed for ${duration} min. Next: ${nextTime}`);
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
        localStorage.setItem('alarms', JSON.stringify(this.alarms));
        localStorage.setItem('snoozed-alarms', JSON.stringify(this.snoozedAlarms));
        document.dispatchEvent(new CustomEvent('alarms-updated'));
    }

    getAlarms() {
        return this.alarms;
    }

    getSnoozedAlarms() {
        return this.snoozedAlarms;
    }

    // getters/setters do proxy
    getVolume() {
        return audioManager.getVolume();
    }

    setVolume(value) {
        audioManager.setVolume(value);
    }

    // métodos proxy para custom sound
    async addCustomSound(name, data) {
        return audioManager.addCustomSound(name, data);
    }

    async deleteCustomSound(id) {
        return audioManager.deleteCustomSound(id);
    }

    // método legacy
    saveCustomSounds() {
        // audioManager gerencia o salvamento
    }
}

export const alarmManager = new AlarmManager();
