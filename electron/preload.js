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
    removeNotificationActionListener: () => ipcRenderer.removeAllListeners('notification-action'),
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
    removeUpdateContentListener: () => ipcRenderer.removeAllListeners('update-content'),

    // Auto-Update API
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
    removeUpdateAvailableListener: () => ipcRenderer.removeAllListeners('update-available'),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, data) => callback(data)),
    removeUpdateProgressListener: () => ipcRenderer.removeAllListeners('update-progress'),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
    removeUpdateDownloadedListener: () => ipcRenderer.removeAllListeners('update-downloaded'),
    startUpdateDownload: () => ipcRenderer.invoke('start-update-download'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
