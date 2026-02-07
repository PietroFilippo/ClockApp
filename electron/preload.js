const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Shortcuts globais
    registerGlobalShortcuts: (shortcuts) => ipcRenderer.send('register-global-shortcuts', shortcuts),
    unregisterGlobalShortcuts: () => ipcRenderer.send('unregister-global-shortcuts'),
    onGlobalShortcut: (callback) => ipcRenderer.on('global-shortcut-triggered', (event, action) => callback(action)),
    // End Shortcuts globais
    deleteFile: (filename) => ipcRenderer.invoke('delete-file', filename),
    getStorePath: () => ipcRenderer.invoke('get-store-path'),
    // Settings API
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),
    setPowerBlocker: (enabled) => ipcRenderer.invoke('set-power-blocker', enabled),
    showCustomNotification: (data) => ipcRenderer.invoke('show-custom-notification', data),
    closeCustomNotification: () => ipcRenderer.invoke('close-custom-notification'),
    onNotificationAction: (callback) => ipcRenderer.on('notification-action', (event, data) => callback(data)),
    exitApp: () => ipcRenderer.invoke('exit-app'),
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    pickCustomPosition: () => ipcRenderer.invoke('pick-custom-notification-position'),

    // Windows API Secundaria
    moveWindow: (data) => ipcRenderer.send('window-move', data),
    sendNotificationAction: (data) => ipcRenderer.send('notification-action', data),
    saveCustomPosition: () => ipcRenderer.send('save-custom-position')
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
    }
});
