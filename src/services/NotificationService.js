import { audioManager } from '../utils/AudioManager.js';

export class NotificationService {
    constructor() {
        this.activeAlerts = []; // Queue/Stack for active notifications
        this.permissionsGranted = false;
        
        if (Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                this.permissionsGranted = permission === 'granted';
            });
        } else {
            this.permissionsGranted = true;
        }
    }

    async triggerAlert({ id, type, title, body, soundId, snoozeEnabled, repeatEnabled, repeatCount, data }) {
        // Remove if it already exists, to move it to the top (re-trigger)
        this.activeAlerts.filter(a => a.id === id).forEach(a => clearTimeout(a.actionTimeoutId));
        this.activeAlerts = this.activeAlerts.filter(a => a.id !== id);

        const alertItem = {
            id,
            type,
            title,
            body,
            soundId: soundId || 'default',
            snoozeEnabled,
            repeatEnabled,
            repeatCount: repeatCount || 0,
            data: data || {},
            timestamp: Date.now()
        };

        this.activeAlerts.push(alertItem);
        this.updateActiveAlert();
    }

    // Async work for an alert (settings lookups, auto-action timeouts) must only act while that
    // exact alert is still the one on screen: it may have been stopped, covered or re-triggered meanwhile
    isTopAlert(alert) {
        return this.activeAlerts[this.activeAlerts.length - 1] === alert;
    }

    updateActiveAlert(shouldDispatchEvent = true) {
        if (this.activeAlerts.length === 0) {
            this.stopAllAlerts();
            return;
        }

        // Take the last one (top of the stack)
        const currentAlert = this.activeAlerts[this.activeAlerts.length - 1];

        // Only the alert on top auto-acts; a covered alert restarts its countdown when it's shown again
        this.activeAlerts.forEach(alert => {
            clearTimeout(alert.actionTimeoutId);
            alert.actionTimeoutId = null;
        });

        // Play the current alert's sound
        audioManager.playAlarm(currentAlert.soundId);

        // Setup Auto-Action Timeout
        if (window.electronAPI) {
            window.electronAPI.getSettings().then(settings => {
                if (!this.isTopAlert(currentAlert)) return;

                let autoDuration = 0;
                let action = 'stop';

                if (currentAlert.type === 'alarm') {
                    autoDuration = settings.alarmAutoActionDuration || 0;
                    if (settings.alarmTimeoutAction === 'snooze') action = 'snooze';
                } else if (currentAlert.type === 'timer') {
                    autoDuration = settings.timerAutoActionDuration || 0;
                    if (settings.timerTimeoutAction === 'repeat') action = 'repeat';
                }

                if (autoDuration > 0) {
                    currentAlert.actionTimeoutId = setTimeout(() => {
                        if (!this.isTopAlert(currentAlert)) return;
                        // Handled in main.js like a click on the matching button (which also closes the popup)
                        document.dispatchEvent(new CustomEvent('notification-action', {
                            detail: { action, id: currentAlert.id, type: currentAlert.type }
                        }));
                    }, autoDuration * 1000);
                }
            });
        }

        // Update the external notification
        this.handleNotification(currentAlert).catch(err => console.error("Notification failed", err));

        // Always dispatch the event so the UI renders/updates the overlay
        if (shouldDispatchEvent) {
            document.dispatchEvent(new CustomEvent('notification-ring', { detail: currentAlert }));
        }
    }

    async handleNotification(alert) {
        if (!this.permissionsGranted) return;

        let type = 'system';
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            type = settings.notificationType || 'app';
        }

        // Don't show a notification for an alert that was stopped while settings were loading
        if (!this.isTopAlert(alert)) return;

        if (type === 'system' || type === 'both') {
            new Notification(alert.title, { body: alert.body });
        }

        if (type === 'app' || type === 'both') {
            if (window.electronAPI) {
                window.electronAPI.showCustomNotification({
                    title: alert.title,
                    body: alert.body,
                    snoozeEnabled: alert.snoozeEnabled,
                    repeatEnabled: alert.repeatEnabled,
                    id: alert.id,
                    repeatCount: alert.repeatCount
                });
            }
        }
    }

    stopAlert(id) {
        const stopped = this.activeAlerts.filter(a => a.id === id);
        if (stopped.length === 0) {
            // Nothing to stop (e.g. already stopped from the popup): just make sure nothing keeps ringing
            if (this.activeAlerts.length === 0) this.stopAllAlerts();
            return;
        }

        const wasOnTop = stopped.some(alert => this.isTopAlert(alert));
        stopped.forEach(alert => clearTimeout(alert.actionTimeoutId));
        this.activeAlerts = this.activeAlerts.filter(a => a.id !== id);

        // Stopping a covered alert leaves the one on screen (and its sound) untouched
        if (wasOnTop || this.activeAlerts.length === 0) {
            this.updateActiveAlert(true);
        }
    }

    stopAllAlerts() {
        // Clear timeouts
        this.activeAlerts.forEach(alert => {
            if (alert.actionTimeoutId) {
                clearTimeout(alert.actionTimeoutId);
            }
        });

        this.activeAlerts = [];
        audioManager.stopAlarm();
        document.dispatchEvent(new CustomEvent('all-alerts-stopped'));

        if (window.electronAPI) {
            window.electronAPI.closeCustomNotification();
        }
    }
}

export const notificationService = new NotificationService();
