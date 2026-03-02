import { showModal } from '../utils/modal.js';
import { showConfirm } from '../utils/notification.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { DEFAULT_KEYBINDS } from '../utils/KeybindManager.js';

export function Settings() {
    const container = document.createElement('div');
    container.className = 'view-container';

    // Estado padrão
    let settings = {
        preventSuspend: false,
        autoLaunch: true,
        notificationType: 'app',
        minimizeToTray: true,
        showTimerInTray: false,
        notificationPosition: 'bottom-right',
        notificationDuration: 30,
        stealFocus: true,
        globalShortcuts: true,
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
            
            <div class="settings-list" style="padding: 20px; max-width: 600px; margin: 0 auto;">
        `;

        if (isElectron) {
            content += `
                <h3 style="color: var(--text-secondary); margin: 20px 0 10px;">General</h3>
                
                ${renderToggle('autoLaunch', 'Start on Boot', 'Launch app automatically when you log in.')}
                ${renderToggle('minimizeToTray', 'Minimize to Tray', 'Keep app running in background when closed.')}
                
                <h3 style="color: var(--text-secondary); margin: 20px 0 10px;">Power & Performance</h3>
                
                ${renderToggle('preventSuspend', 'Prevent Sleep', 'Keep computer awake while a timer is running.')}
                
                <h3 style="color: var(--text-secondary); margin: 20px 0 10px;">Notifications</h3>

                ${renderToggle('stealFocus', 'Steal Focus', 'When notifications appear, they will take keyboard focus.')}

                <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size: 16px;">Notification Style</span>
                        <select id="notificationType" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 6px; outline: none;">
                            <option value="system" ${settings.notificationType === 'system' ? 'selected' : ''}>System (Windows)</option>
                            <option value="app" ${settings.notificationType === 'app' ? 'selected' : ''}>App Custom</option>
                            <option value="both" ${settings.notificationType === 'both' ? 'selected' : ''}>Both</option>
                            <option value="none" ${settings.notificationType === 'none' ? 'selected' : ''}>None</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">Choose how you want to be notified.</div>
                </div>

                <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size: 16px;">Notification Position</span>
                        <select id="notificationPosition" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 6px; outline: none;">
                            <option value="bottom-right" ${settings.notificationPosition === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                            <option value="top-right" ${settings.notificationPosition === 'top-right' ? 'selected' : ''}>Top Right</option>
                            <option value="top-left" ${settings.notificationPosition === 'top-left' ? 'selected' : ''}>Top Left</option>
                            <option value="bottom-left" ${settings.notificationPosition === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
                            <option value="custom" ${settings.notificationPosition === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">Where the app notification appears.</div>
                    
                    ${settings.notificationPosition === 'custom' ? `
                        <button id="set-custom-pos" style="margin-top: 10px; width: 100%; background: var(--accent-orange); border: none; padding: 8px; border-radius: 6px; cursor: pointer; color: black; font-weight: bold;">
                            Set Custom Position
                        </button>
                    ` : ''}
                </div>

                ${renderDurationSelector('notificationDuration', 'Auto-Close Duration', 'How long the external notification stays on screen.')}

                <h3 style="color: var(--text-secondary); margin: 20px 0 10px;">Auto-Actions</h3>
                
                <h4 style="color: var(--text-secondary); margin: 15px 0 5px; font-size: 14px; text-transform: uppercase;">Timer Settings</h4>
                
                ${renderDurationSelector('timerAutoActionDuration', 'Timer Auto-Action Duration', 'Time before automatically repeating/stopping the timer.')}

                <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size: 16px;">Timeout Action</span>
                        <select id="timerTimeoutAction" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 6px; outline: none;">
                            <option value="stop" ${settings.timerTimeoutAction === 'stop' ? 'selected' : ''}>Stop</option>
                            <option value="repeat" ${settings.timerTimeoutAction === 'repeat' ? 'selected' : ''}>Repeat</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">Action to take when auto-action timer expires.</div>
                </div>

                <h4 style="color: var(--text-secondary); margin: 15px 0 5px; font-size: 14px; text-transform: uppercase;">Alarm Settings</h4>

                ${renderDurationSelector('alarmAutoActionDuration', 'Alarm Auto-Action Duration', 'Time before automatically snoozing/stopping the alarm.')}

                <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size: 16px;">Timeout Action</span>
                        <select id="alarmTimeoutAction" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 6px; outline: none;">
                            <option value="stop" ${settings.alarmTimeoutAction === 'stop' ? 'selected' : ''}>Stop</option>
                            <option value="snooze" ${settings.alarmTimeoutAction === 'snooze' ? 'selected' : ''}>Snooze</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">Action to take when auto-action timer expires.</div>
                </div>
                
                <h3 style="color: var(--text-secondary); margin: 20px 0 10px;">Shortcuts</h3>
                ${renderToggle('globalShortcuts', 'Global Shortcuts', 'Enable shortcuts (Alt+S, Alt+R, etc) even when app is minimized.')}

                <div class="setting-item" style="background: rgba(255, 69, 58, 0.1); padding: 15px; border-radius: 12px; margin-top: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;" id="exit-btn">
                    <span style="color: #ff453a; font-weight: 500;">Exit Application</span>
                </div>
            `;
        } else {
            // Browser Version
            content += `
                <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; text-align: center; margin-top: 20px;">
                    <h3 style="margin-bottom: 10px;">Get the App</h3>
                    <p style="color: #888; font-size: 14px; margin-bottom: 20px;">
                        Download the full application to get access to custom notifications, system tray integration, and more.
                    </p>
                    <a href="https://github.com/PietroFilippo/clockapp/releases/latest" target="_blank" style="text-decoration: none;">
                        <button style="background: var(--accent-orange); color: black; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
                            Download for Windows
                        </button>
                    </a>
                </div>
            `;
        }

        content += `
                <div style="margin-top: 20px; text-align: center; color: #444; font-size: 12px;">
                    Clock App v3.2.0
                </div>
            </div>
        `;

        container.innerHTML = content;

        if (isElectron) {
            attachListeners();
        }
    }

    function renderToggle(key, label, description) {
        return `
            <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size: 16px;">${label}</span>
                    <label class="switch">
                        <input type="checkbox" class="setting-toggle" data-key="${key}" ${settings[key] ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">${description}</div>
            </div>
        `;
    }

    function renderDurationSelector(key, label, description) {
        const value = settings[key];
        const isCustom = ![0, 5, 10, 30, 60, 300, 600].includes(value);

        return `
            <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size: 16px;">${label}</span>
                    <select class="duration-select" data-key="${key}" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 6px; outline: none;">
                        <option value="0" ${value === 0 ? 'selected' : ''}>Never</option>
                        <option value="5" ${value === 5 ? 'selected' : ''}>5 Seconds</option>
                        <option value="10" ${value === 10 ? 'selected' : ''}>10 Seconds</option>
                        <option value="30" ${value === 30 ? 'selected' : ''}>30 Seconds</option>
                        <option value="60" ${value === 60 ? 'selected' : ''}>1 Minute</option>
                        <option value="300" ${value === 300 ? 'selected' : ''}>5 Minutes</option>
                        <option value="600" ${value === 600 ? 'selected' : ''}>10 Minutes</option>
                        <option value="custom" ${isCustom ? 'selected' : ''}>Custom...</option>
                    </select>
                </div>
                
                <div class="custom-duration-input" id="custom-${key}" style="display: ${isCustom ? 'flex' : 'none'}; align-items: center; margin-top: 10px; gap: 10px;">
                    <input type="number" 
                        class="duration-input" 
                        data-key="${key}"
                        value="${isCustom ? value : ''}" 
                        placeholder="Seconds" 
                        min="1"
                        style="background: #222; border: 1px solid #444; color: white; padding: 8px; border-radius: 6px; width: 100px;">
                    <span style="font-size: 14px; color: #aaa;">seconds</span>
                </div>

                <div style="font-size: 12px; color: #888; margin-top: 5px;">${description}</div>
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
                        if (value) {
                            const keybinds = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOPWATCH_KEYBINDS)) || { ...DEFAULT_KEYBINDS };
                            window.electronAPI.registerGlobalShortcuts(keybinds);
                        } else {
                            window.electronAPI.unregisterGlobalShortcuts();
                        }
                        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
                    }
                }
            };
        });

        // Duração dos seletores
        container.querySelectorAll('.duration-select').forEach(select => {
            select.onchange = async (e) => {
                const key = e.target.dataset.key;
                const value = e.target.value;
                const inputDiv = container.querySelector(`#custom-${key}`);

                if (value === 'custom') {
                    inputDiv.style.display = 'flex';
                    const input = inputDiv.querySelector('input');
                    input.focus();
                } else {
                    inputDiv.style.display = 'none';
                    const numValue = Number(value);
                    settings[key] = numValue;
                    if (window.electronAPI) {
                        await window.electronAPI.saveSetting(key, numValue);
                    }
                }
            };
        });

        // Inputs customs dos seletores
        container.querySelectorAll('.duration-input').forEach(input => {
            input.onchange = async (e) => {
                const key = e.target.dataset.key;
                let value = Math.max(1, Number(e.target.value));

                settings[key] = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting(key, value);
                }
            };
        });

        // Outros seletores
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
                if (await showConfirm('Are you sure you want to exit the application?', 'Exit App')) {
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

    return container;
}
