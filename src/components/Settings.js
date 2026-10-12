import { showConfirm } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { applyShortcuts, getUnavailableShortcuts } from '../utils/shortcuts.js';

export function Settings() {
    const container = document.createElement('div');
    container.className = 'view-container';

    // Default state
    let settings = {
        preventSuspend: false,
        autoLaunch: true,
        notificationType: 'app',
        minimizeToTray: true,
        notificationPosition: 'bottom-right',
        notificationDuration: 30,
        stealFocus: true,
        globalShortcuts: false,
        alarmAutoActionDuration: 0,
        timerAutoActionDuration: 0,
        timerTimeoutAction: 'stop',
        alarmTimeoutAction: 'stop'
    };

    function render() {
        const isElectron = !!window.electronAPI;

        let content = `
            <div class="header">
                <h1>Settings</h1>
            </div>

            <div class="settings-list">
        `;

        if (isElectron) {
            content += `
                <h3 class="settings-group-title">General</h3>

                ${renderToggle('autoLaunch', 'Start at login', 'Open Clock App automatically when you log in.')}
                ${renderToggle('minimizeToTray', 'Minimize to tray', 'Closing the window keeps the app running in the background.')}

                <h3 class="settings-group-title">Power</h3>

                ${renderToggle('preventSuspend', 'Prevent sleep', 'Keep the computer awake while a timer is running.')}

                <h3 class="settings-group-title">Notifications</h3>

                ${renderToggle('stealFocus', 'Notifications take focus', 'The popup takes keyboard focus when it appears.')}

                ${renderSelect('notificationType', 'Notification style', 'How alarms and timers get your attention.', [
                    ['system', 'Windows notification'],
                    ['app', 'App popup'],
                    ['both', 'Both'],
                    ['none', 'None']
                ])}

                <div class="setting-item">
                    <div class="setting-item-row">
                        <span class="setting-item-label">Popup position</span>
                        <select id="notificationPosition" class="setting-select">
                            <option value="bottom-right" ${settings.notificationPosition === 'bottom-right' ? 'selected' : ''}>Bottom right</option>
                            <option value="top-right" ${settings.notificationPosition === 'top-right' ? 'selected' : ''}>Top right</option>
                            <option value="top-left" ${settings.notificationPosition === 'top-left' ? 'selected' : ''}>Top left</option>
                            <option value="bottom-left" ${settings.notificationPosition === 'bottom-left' ? 'selected' : ''}>Bottom left</option>
                            <option value="custom" ${settings.notificationPosition === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="setting-item-desc">Where the app popup appears on screen.</div>

                    ${settings.notificationPosition === 'custom' ? `
                        <button id="set-custom-pos" class="settings-action-btn">Choose a spot on screen</button>
                    ` : ''}
                </div>

                ${renderDurationSelector('notificationDuration', 'Close popup after', 'The popup closes on its own after this long.', 'Never')}

                <h3 class="settings-group-title">When you don't respond</h3>

                <h4 class="settings-subgroup-title">Timers</h4>

                ${renderDurationSelector('timerAutoActionDuration', 'Ring for', 'How long a timer rings before acting on its own.', 'Until dismissed')}

                ${renderSelect('timerTimeoutAction', 'Then', 'What happens when that time runs out.', [
                    ['stop', 'Stop'],
                    ['repeat', 'Repeat']
                ])}

                <h4 class="settings-subgroup-title">Alarms</h4>

                ${renderDurationSelector('alarmAutoActionDuration', 'Ring for', 'How long an alarm rings before acting on its own.', 'Until dismissed')}

                ${renderSelect('alarmTimeoutAction', 'Then', 'What happens when that time runs out.', [
                    ['stop', 'Stop'],
                    ['snooze', 'Snooze']
                ])}

                <h3 class="settings-group-title">Shortcuts</h3>
                ${renderToggle('globalShortcuts', 'Global shortcuts', "Stopwatch shortcuts work even when the app isn't focused. While on, other programs won't receive these key combinations.")}
                ${renderShortcutWarning()}

                <button class="settings-exit-btn" id="exit-btn">Exit Clock App</button>
            `;
        } else {
            // Browser Version
            content += `
                <div class="setting-item settings-download">
                    <h3>Get the desktop app</h3>
                    <p>
                        The Windows app adds popup notifications, a tray icon and global stopwatch shortcuts.
                    </p>
                    <a href="https://github.com/PietroFilippo/clockapp/releases/latest" target="_blank">
                        <button class="settings-download-btn">Download for Windows</button>
                    </a>
                </div>
            `;
        }

        content += `
                <div class="settings-version">Clock App v3.4.0</div>
            </div>
        `;

        container.innerHTML = content;

        if (isElectron) {
            attachListeners();
        }
    }

    function renderToggle(key, label, description) {
        return `
            <div class="setting-item">
                <div class="setting-item-row">
                    <span class="setting-item-label">${label}</span>
                    <label class="switch">
                        <input type="checkbox" class="setting-toggle" data-key="${key}" ${settings[key] ? 'checked' : ''} aria-label="${escapeHtml(label)}">
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="setting-item-desc">${description}</div>
            </div>
        `;
    }

    function renderSelect(key, label, description, options) {
        return `
            <div class="setting-item">
                <div class="setting-item-row">
                    <span class="setting-item-label">${label}</span>
                    <select id="${key}" class="setting-select" aria-label="${escapeHtml(label)}">
                        ${options.map(([value, text]) => `<option value="${value}" ${settings[key] === value ? 'selected' : ''}>${text}</option>`).join('')}
                    </select>
                </div>
                <div class="setting-item-desc">${description}</div>
            </div>
        `;
    }

    // Shortcuts Windows couldn't register because another program already uses them
    function renderShortcutWarning() {
        const unavailable = getUnavailableShortcuts();
        if (!settings.globalShortcuts || unavailable.length === 0) return '';
        const one = unavailable.length === 1;
        return `
            <div class="settings-warning">
                ${escapeHtml(unavailable.join(', '))} ${one ? 'is' : 'are'} in use by another app. Change ${one ? 'it' : 'them'} in Stopwatch › Shortcuts.
            </div>
        `;
    }

    function renderDurationSelector(key, label, description, zeroLabel) {
        const value = settings[key];
        const isCustom = ![0, 5, 10, 30, 60, 300, 600].includes(value);
        const lastCustomValue = localStorage.getItem('custom_dur_' + key) || '';
        const displayValue = isCustom ? value : lastCustomValue;

        return `
            <div class="setting-item">
                <div class="setting-item-row">
                    <span class="setting-item-label">${label}</span>
                    <select class="duration-select setting-select" data-key="${key}" aria-label="${escapeHtml(label)}">
                        <option value="0" ${value === 0 ? 'selected' : ''}>${zeroLabel}</option>
                        <option value="5" ${value === 5 ? 'selected' : ''}>5 seconds</option>
                        <option value="10" ${value === 10 ? 'selected' : ''}>10 seconds</option>
                        <option value="30" ${value === 30 ? 'selected' : ''}>30 seconds</option>
                        <option value="60" ${value === 60 ? 'selected' : ''}>1 minute</option>
                        <option value="300" ${value === 300 ? 'selected' : ''}>5 minutes</option>
                        <option value="600" ${value === 600 ? 'selected' : ''}>10 minutes</option>
                        <option value="custom" ${isCustom ? 'selected' : ''}>Custom…</option>
                    </select>
                </div>

                <div class="custom-duration-input ${isCustom ? 'open' : ''}" id="custom-${key}">
                    <input type="number"
                        class="duration-input"
                        data-key="${key}"
                        value="${displayValue}"
                        placeholder="Seconds"
                        min="1"
                        aria-label="${escapeHtml(label)} in seconds">
                    <span class="custom-duration-unit">seconds</span>
                </div>

                <div class="setting-item-desc">${description}</div>
            </div>
        `;
    }

    function attachListeners() {
        // Toggles
        container.querySelectorAll('.setting-toggle').forEach(toggle => {
            toggle.onchange = async (e) => {
                const key = e.target.dataset.key;
                const value = e.target.checked;
                settings[key] = value;

                if (window.electronAPI) {
                    await window.electronAPI.saveSetting(key, value);
                    if (key === 'preventSuspend') {
                        document.dispatchEvent(new CustomEvent('settings-updated', { detail: { key, value } }));
                    }
                    if (key === 'globalShortcuts') {
                        applyShortcuts(value);
                    }
                }
            };
        });

        // Duration selects
        container.querySelectorAll('.duration-select').forEach(select => {
            select.onchange = async (e) => {
                const key = e.target.dataset.key;
                const value = e.target.value;
                const inputDiv = container.querySelector(`#custom-${key}`);

                if (value === 'custom') {
                    inputDiv.classList.add('open');
                    const input = inputDiv.querySelector('input');
                    input.focus();
                    if (input.value) {
                        const numValue = Math.max(1, Number(input.value));
                        settings[key] = numValue;
                        if (window.electronAPI) {
                            await window.electronAPI.saveSetting(key, numValue);
                        }
                    }
                } else {
                    inputDiv.classList.remove('open');
                    const numValue = Number(value);
                    settings[key] = numValue;
                    if (window.electronAPI) {
                        await window.electronAPI.saveSetting(key, numValue);
                    }
                }
            };
        });

        // Custom inputs for the selects
        container.querySelectorAll('.duration-input').forEach(input => {
            input.onchange = async (e) => {
                const key = e.target.dataset.key;
                let value = Math.max(1, Number(e.target.value));
                e.target.value = value;
                localStorage.setItem('custom_dur_' + key, value);

                settings[key] = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting(key, value);
                }
            };
        });

        // Other selects
        const notifSelect = container.querySelector('#notificationType');
        if (notifSelect) {
            notifSelect.onchange = async (e) => {
                const value = e.target.value;
                settings.notificationType = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting('notificationType', value);
                }
            };
        }

        const posSelect = container.querySelector('#notificationPosition');
        if (posSelect) {
            posSelect.onchange = async (e) => {
                const value = e.target.value;
                settings.notificationPosition = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting('notificationPosition', value);
                    render();
                }
            };
        }

        const setCustomPosBtn = container.querySelector('#set-custom-pos');
        if (setCustomPosBtn) {
            setCustomPosBtn.onclick = () => {
                if (window.electronAPI) {
                    window.electronAPI.pickCustomPosition();
                }
            };
        }

        const timerActionSelect = container.querySelector('#timerTimeoutAction');
        if (timerActionSelect) {
            timerActionSelect.onchange = async (e) => {
                const value = e.target.value;
                settings.timerTimeoutAction = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting('timerTimeoutAction', value);
                }
            };
        }

        const alarmActionSelect = container.querySelector('#alarmTimeoutAction');
        if (alarmActionSelect) {
            alarmActionSelect.onchange = async (e) => {
                const value = e.target.value;
                settings.alarmTimeoutAction = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting('alarmTimeoutAction', value);
                }
            };
        }

        const exitBtn = container.querySelector('#exit-btn');
        if (exitBtn) {
            exitBtn.onclick = async () => {
                if (await showConfirm("Alarms and timers won't ring while the app is closed.", 'Exit Clock App?', 'Exit')) {
                    if (window.electronAPI) {
                        window.electronAPI.exitApp();
                    } else {
                        window.close();
                    }
                }
            };
        }
    }

    async function loadSettings() {
        if (window.electronAPI) {
            const loaded = await window.electronAPI.getSettings();
            settings = { ...settings, ...loaded };

            render();
        }
    }

    if (window.electronAPI) {
        loadSettings();
    } else {
        render();
    }

    // Show or clear the "in use by another app" warning once Windows answers
    const onShortcutsUpdated = () => render();
    document.addEventListener('shortcuts-updated', onShortcutsUpdated);

    return {
        element: container,
        cleanup: () => document.removeEventListener('shortcuts-updated', onShortcutsUpdated)
    };
}
