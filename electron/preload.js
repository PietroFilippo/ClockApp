const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    registerGlobalShortcuts: (shortcuts) => ipcRenderer.send('register-global-shortcuts', shortcuts),
    unregisterGlobalShortcuts: () => ipcRenderer.send('unregister-global-shortcuts'),
    onGlobalShortcut: (callback) => ipcRenderer.on('global-shortcut-triggered', (event, action) => callback(action)),
    removeGlobalShortcutListener: () => ipcRenderer.removeAllListeners('global-shortcut-triggered'),
    // End Shortcuts globais
    saveFile: (filename, content) => ipcRenderer.invoke('save-file', filename, content),
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
    saveCustomPosition: () => ipcRenderer.send('save-custom-position'),
    onUpdateContent: (callback) => ipcRenderer.on('update-content', (event, data) => callback(data)),

    // Auto-Update API
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, data) => callback(data)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
    startUpdateDownload: () => ipcRenderer.invoke('start-update-download'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
    }
});
