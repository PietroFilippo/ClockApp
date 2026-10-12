const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    registerGlobalShortcuts: (shortcuts) => ipcRenderer.invoke('register-global-shortcuts', shortcuts),
    unregisterGlobalShortcuts: () => ipcRenderer.send('unregister-global-shortcuts'),
    onGlobalShortcut: (callback) => ipcRenderer.on('global-shortcut-triggered', (event, action) => callback(action)),
    // End global shortcuts
    saveFile: (filename, content) => ipcRenderer.invoke('save-file', filename, content),
    deleteFile: (filename) => ipcRenderer.invoke('delete-file', filename),
    // Settings API
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),
    setPowerBlocker: (enabled, source) => ipcRenderer.invoke('set-power-blocker', enabled, source),
    showCustomNotification: (data) => ipcRenderer.invoke('show-custom-notification', data),
    closeCustomNotification: () => ipcRenderer.invoke('close-custom-notification'),
    onNotificationAction: (callback) => ipcRenderer.on('notification-action', (event, data) => callback(data)),
    removeNotificationActionListener: () => ipcRenderer.removeAllListeners('notification-action'),
    exitApp: () => ipcRenderer.invoke('exit-app'),
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    pickCustomPosition: () => ipcRenderer.invoke('pick-custom-notification-position'),

    // Taskbar: window title and progress bar
    setWindowTitle: (title) => ipcRenderer.send('set-window-title', title),
    setProgressBar: (progress) => ipcRenderer.send('set-progress-bar', progress),

    // Secondary windows API
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
    onUpdateError: (callback) => ipcRenderer.on('update-error', () => callback()),
    startUpdateDownload: () => ipcRenderer.invoke('start-update-download'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
