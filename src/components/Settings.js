import { showModal } from '../utils/modal.js';
import { showConfirm } from '../utils/notification.js';

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
        stealFocus: true
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

                <div class="setting-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size: 16px;">Auto-Close Duration</span>
                        <select id="notificationDuration" style="background: #333; color: white; border: none; padding: 5px 10px; border-radius: 6px; outline: none;">
                            <option value="0" ${settings.notificationDuration === 0 ? 'selected' : ''}>Never</option>
                            <option value="5" ${settings.notificationDuration === 5 ? 'selected' : ''}>5 Seconds</option>
                            <option value="10" ${settings.notificationDuration === 10 ? 'selected' : ''}>10 Seconds</option>
                            <option value="30" ${settings.notificationDuration === 30 ? 'selected' : ''}>30 Seconds</option>
                            <option value="60" ${settings.notificationDuration === 60 ? 'selected' : ''}>1 Minute</option>
                        </select>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">How long the notification stays on screen.</div>
                </div>

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
                    Clock App v2.2.1
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

    function attachListeners() {
        container.querySelectorAll('.setting-toggle').forEach(toggle => {
            toggle.onchange = async (e) => {
                const key = e.target.dataset.key;
                const value = e.target.checked;
                settings[key] = value;

                if (window.electronAPI) {
                    await window.electronAPI.saveSetting(key, value);
                    // Efeitos imediatos que não precisam de reload
                    if (key === 'preventSuspend') {
                        // Notifica outros módulos (como TimerManager) para reavaliar bloqueio de energia imediatamente
                        document.dispatchEvent(new CustomEvent('settings-updated', { detail: { key, value } }));
                    }
                }
            };
        });

        const notifSelect = container.querySelector('#notificationType');
        notifSelect.onchange = async (e) => {
            const value = e.target.value;
            settings.notificationType = value;
            if (window.electronAPI) {
                await window.electronAPI.saveSetting('notificationType', value);
            }
        };

        const posSelect = container.querySelector('#notificationPosition');
        if (posSelect) {
            posSelect.onchange = async (e) => {
                const value = e.target.value;
                settings.notificationPosition = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting('notificationPosition', value);
                    render(); // Renderiza novamente para mostrar/esconder o botão "Set Custom Position"
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

        const durSelect = container.querySelector('#notificationDuration');
        if (durSelect) {
            durSelect.onchange = async (e) => {
                const value = Number(e.target.value);
                settings.notificationDuration = value;
                if (window.electronAPI) {
                    await window.electronAPI.saveSetting('notificationDuration', value);
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
                        // Fallback pro navegador (normalmente não funciona, mas bom para testes)
                        window.close();
                    }
                }
            };
        }
    }

    async function loadSettings() {
        if (window.electronAPI) {
            settings = await window.electronAPI.getSettings();
            render();
        }
    }

    loadSettings();
    render();

    return container;
}
