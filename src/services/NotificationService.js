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

    updateActiveAlert(shouldDispatchEvent = true) {
        if (this.activeAlerts.length === 0) {
            this.stopAllAlerts();
            return;
        }

        // Get the last one (top of the stack)
        const currentAlert = this.activeAlerts[this.activeAlerts.length - 1];

        // Clear any existing action timeout for this alert to avoid duplicates if updated
        if (currentAlert.actionTimeoutId) {
            clearTimeout(currentAlert.actionTimeoutId);
            currentAlert.actionTimeoutId = null;
        }

        // Play the current alert sound
        audioManager.playAlarm(currentAlert.soundId);

        // Setup Auto-Action Timeout
        if (window.electronAPI) {
            window.electronAPI.getSettings().then(settings => {
                let autoDuration = 0;

                if (currentAlert.type === 'alarm') {
                    autoDuration = settings.alarmAutoActionDuration !== undefined ? settings.alarmAutoActionDuration : 0;
                } else if (currentAlert.type === 'timer') {
                    autoDuration = settings.timerAutoActionDuration !== undefined ? settings.timerAutoActionDuration : 0;
                }

                if (autoDuration > 0) {
                    currentAlert.actionTimeoutId = setTimeout(() => {
                        // Check whether the alert is still active
                        const isStillActive = this.activeAlerts.some(a => a.id === currentAlert.id);
                        if (!isStillActive) return;

                        if (currentAlert.type === 'alarm') {
                            const action = settings.alarmTimeoutAction || 'stop';
                            if (action === 'snooze') {
                                // Request alarm snooze
                                document.dispatchEvent(new CustomEvent('notification-action', { detail: { action: 'snooze', id: currentAlert.id, type: 'alarm' } }));
                            } else {
                                // Request alarm stop
                                document.dispatchEvent(new CustomEvent('notification-action', { detail: { action: 'stop', id: currentAlert.id, type: 'alarm' } }));
                            }
                        } else if (currentAlert.type === 'timer') {
                            const action = settings.timerTimeoutAction || 'stop';
                            if (action === 'repeat') {
                                document.dispatchEvent(new CustomEvent('notification-action', { detail: { action: 'repeat', id: currentAlert.id, type: 'timer' } }));
                            } else {
                                document.dispatchEvent(new CustomEvent('notification-action', { detail: { action: 'stop', id: currentAlert.id, type: 'timer' } }));
                            }
                        }

                        // Force-close the notification window
                        if (window.electronAPI) {
                            window.electronAPI.closeCustomNotification();
                        }

                    }, autoDuration * 1000);
                }
            });
        }

        // Update the external notification
        this.handleNotification(currentAlert.title, currentAlert.body, {
            snoozeEnabled: currentAlert.snoozeEnabled,
            repeatEnabled: currentAlert.repeatEnabled,
            id: currentAlert.id,
            repeatCount: currentAlert.repeatCount
        }).catch(err => console.error("Notification failed", err));

        // Always dispatch an event so the UI renders/updates the overlay
        if (shouldDispatchEvent) {
             document.dispatchEvent(new CustomEvent('notification-ring', { detail: currentAlert }));
        }
    }

    async handleNotification(title, body, options = {}) {
        if (!this.permissionsGranted) return;

        let type = 'system';
        if (window.electronAPI) {
            const settings = await window.electronAPI.getSettings();
            type = settings.notificationType || 'both';
        }

        if (type === 'system' || type === 'both') {
            new Notification(title, { body });
        }

        if (type === 'app' || type === 'both') {
            if (window.electronAPI) {
                window.electronAPI.showCustomNotification({
                    title,
                    body,
                    snoozeEnabled: options.snoozeEnabled,
                    repeatEnabled: options.repeatEnabled,
                    id: options.id,
                    repeatCount: options.repeatCount
                });
            }
        }
    }

    stopAlert(id, type = null) {
        const findCondition = typeof id === 'string' && id.startsWith('timer-') 
            ? a => a.id === id 
            : type === 'timer' && id === null ? a => a.type === 'timer' : a => a.id === id;

        const alert = this.activeAlerts.find(findCondition);
        if (alert && alert.actionTimeoutId) clearTimeout(alert.actionTimeoutId);

        this.activeAlerts = this.activeAlerts.filter(a => !findCondition(a));
        this.updateActiveAlert(true);
    }
    
    stopTimerAlerts() {
        this.activeAlerts.forEach(a => {
            if (a.type === 'timer' && a.actionTimeoutId) {
                clearTimeout(a.actionTimeoutId);
            }
        });
        this.activeAlerts = this.activeAlerts.filter(a => a.type !== 'timer');
        this.updateActiveAlert(true);
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
