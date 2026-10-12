import { app, BrowserWindow, ipcMain, Tray, Menu, powerSaveBlocker, screen, globalShortcut, shell, crashReporter, session } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Global error handlers — prevent silent crashes
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

// Standardize the app name so the user data path is stable
app.setName('Clock App');
if (process.platform === 'win32') {
    app.setAppUserModelId('com.pietrofilippo.clockapp');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const userDataPath = app.getPath('userData');
const soundsDir = path.join(userDataPath, 'sounds');
const settingsPath = path.join(userDataPath, 'settings.json');

// Make sure the sounds directory exists
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

// Load settings
const DEFAULT_SETTINGS = {
    preventSuspend: false,
    autoLaunch: true,
    notificationType: 'app', // 'system', 'app', 'both', 'none'
    notificationPosition: 'bottom-right',
    customNotificationX: 0,
    customNotificationY: 0,
    minimizeToTray: true,
    stealFocus: true,
    notificationDuration: 30 // seconds, 0 for never
};

let appSettings = { ...DEFAULT_SETTINGS };

try {
    if (fs.existsSync(settingsPath)) {
        const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        // Merge so keys added in newer versions get their defaults
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            appSettings = { ...DEFAULT_SETTINGS, ...saved };
        }
    }
} catch (e) {
    console.error('Error loading settings', e);
}

// Write to a temp file and rename, so a crash or power loss mid-write can't leave a corrupt settings.json
function saveSettings() {
    try {
        const tmpPath = `${settingsPath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(appSettings, null, 2));
        fs.renameSync(tmpPath, settingsPath);
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

let win = null;
let tray = null;
let isQuitting = false;
let sessionEnding = false;
let powerBlockerId = null;
let notificationWindow = null;
let notificationRevealed = false;
let notificationCloseTimer = null;
let positionPickerWindow = null;

const NOTIFICATION_WIDTH = 350;
const NOTIFICATION_HEIGHT = 160;
const NOTIFICATION_MARGIN = 20;
const WM_ENDSESSION = 0x0016;
const UNRESPONSIVE_GRACE_MS = 15_000;

function getIconPath() {
    if (process.env.VITE_DEV_SERVER_URL) {
        return path.join(__dirname, '../public/icon.png');
    } else {
        // In prod, Vite copies public assets into dist
        return path.join(__dirname, '../dist/icon.png');
    }
}

// True if a meaningful part of the rectangle is on a connected display (monitors can be unplugged between runs)
function isOnScreen({ x, y, width, height }) {
    const minVisible = 50;
    return screen.getAllDisplays().some(({ workArea: area }) => {
        const overlapX = Math.min(x + width, area.x + area.width) - Math.max(x, area.x);
        const overlapY = Math.min(y + height, area.y + area.height) - Math.max(y, area.y);
        return overlapX >= minVisible && overlapY >= minVisible;
    });
}

function showMainWindow() {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

function saveWindowState() {
    if (!win || win.isDestroyed()) return;
    // getNormalBounds() returns the restored size even when maximized or minimized
    const bounds = win.getNormalBounds();
    appSettings.windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized()
    };
    saveSettings();
}

// Recovering a crashed or hung renderer is fine, but never in a loop
let recentRecoveries = [];
function canRecoverRenderer() {
    if (isQuitting || sessionEnding) return false;
    const now = Date.now();
    recentRecoveries = recentRecoveries.filter(time => now - time < 60_000);
    if (recentRecoveries.length >= 3) return false;
    recentRecoveries.push(now);
    return true;
}

function createWindow() {
    const iconPath = getIconPath();
    // Restore the saved window state
    const windowState = appSettings.windowState || {};
    const width = windowState.width || 900;
    const height = windowState.height || 700;
    const hasSavedPosition = Number.isFinite(windowState.x) && Number.isFinite(windowState.y)
        && isOnScreen({ x: windowState.x, y: windowState.y, width, height });

    const mainWindow = new BrowserWindow({
        width,
        height,
        x: hasSavedPosition ? windowState.x : undefined,
        y: hasSavedPosition ? windowState.y : undefined,
        minWidth: 400,
        minHeight: 520,
        frame: false, // Custom title bar
        backgroundColor: '#000000', // Prevents white flash during minimize/restore
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false
        },
        autoHideMenuBar: true,
        icon: iconPath,
        show: false // Shown manually via ready-to-show
    });
    win = mainWindow;

    if (windowState.isMaximized) {
        mainWindow.maximize();
    }

    // Only show the window once the content is ready (avoids white flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Load dev/prod
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('close', (event) => {
        // Save window state before closing/hiding
        saveWindowState();

        // Minimize to tray if the setting is enabled and the tray icon exists
        if (!isQuitting && appSettings.minimizeToTray && tray && !tray.isDestroyed()) {
            event.preventDefault();
            mainWindow.hide();
            return;
        }

        // Without minimize to tray, closing the main window quits the app
        isQuitting = true;
    });

    mainWindow.on('closed', () => {
        if (win === mainWindow) win = null;
    });

    // Reload if the renderer crashes. Never while quitting or while Windows ends the session:
    // spawning processes at that point is what trips Chromium's internal CHECKs.
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('Renderer gone:', details.reason);
        if (details.reason === 'clean-exit' || !canRecoverRenderer()) return;
        mainWindow.webContents.reload();
    });

    // Reload if the page stays hung (a reload drops any alert that is ringing, so give it time to recover first)
    let unresponsiveTimer = null;
    mainWindow.on('unresponsive', () => {
        console.error('Window became unresponsive');
        clearTimeout(unresponsiveTimer);
        unresponsiveTimer = setTimeout(() => {
            if (!mainWindow.isDestroyed() && canRecoverRenderer()) {
                console.error('Still unresponsive, reloading...');
                mainWindow.webContents.reload();
            }
        }, UNRESPONSIVE_GRACE_MS);
    });
    mainWindow.on('responsive', () => clearTimeout(unresponsiveTimer));

    // Auto-updater: check for updates after the window loads
    mainWindow.webContents.on('did-finish-load', () => {
        checkForUpdates();
    });
}

// Windows shutdown / restart / log off. These are BrowserWindow events (App has no 'session-end'),
// so they're attached to every window: whichever window Windows messages first must handle it.
function attachSessionEndHandlers(window) {
    if (process.platform !== 'win32') return;

    // Windows asks whether the session may end. Never block it: stop all self-healing
    // (renderer reloads, window recreation) and persist state while there's still time.
    window.on('query-session-end', () => {
        if (sessionEnding) return;
        sessionEnding = true;
        saveWindowState();
        session.defaultSession.flushStorageData();
    });

    // wParam is FALSE when another app cancelled the shutdown, so go back to normal
    window.hookWindowMessage(WM_ENDSESSION, (wParam) => {
        if (wParam.every(byte => byte === 0)) sessionEnding = false;
    });

    // The session is ending for real. Terminate immediately (as Chrome does) rather than an
    // orderly app.exit(): Windows kills our child processes in parallel, and a teardown racing
    // that trips Chromium CHECKs, the 0x80000003 "unknown software exception" dialog.
    window.on('session-end', () => {
        sessionEnding = true;
        stopPowerBlocker();
        process.kill(process.pid, 'SIGKILL'); // TerminateProcess on Windows
    });
}

function createTray() {
    // If a valid tray already exists, don't recreate it
    if (tray && !tray.isDestroyed()) return;

    try {
        const iconPath = getIconPath();
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: showMainWindow
            },
            {
                label: 'Quit',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);
        tray.setToolTip('Clock App');
        tray.setContextMenu(contextMenu);

        tray.on('click', showMainWindow);
    } catch (error) {
        console.error("Failed to create tray icon:", error);
        // Disable minimize to tray if its UI can't be created
        appSettings.minimizeToTray = false;
    }
}

// IPC Handlers: Settings
ipcMain.handle('get-settings', () => {
    return appSettings;
});

ipcMain.handle('save-setting', (event, key, value) => {
    appSettings[key] = value;
    saveSettings();

    // Apply immediate effects
    if (key === 'autoLaunch') {
        // Only change auto-launch when packaged to avoid "zombie" dev processes
        if (app.isPackaged) {
            app.setLoginItemSettings({ openAtLogin: value });
        }
    }
});

// IPC: Power
// Timers and intervals request the blocker independently; keep it on while any of them needs it
const powerBlockRequests = new Set();

function stopPowerBlocker() {
    if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
        powerSaveBlocker.stop(powerBlockerId);
    }
    powerBlockerId = null;
}

ipcMain.handle('set-power-blocker', (event, enabled, source = 'default') => {
    if (enabled) {
        powerBlockRequests.add(source);
    } else {
        powerBlockRequests.delete(source);
    }

    if (powerBlockRequests.size > 0) {
        if (powerBlockerId === null) {
            powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
        }
    } else {
        stopPowerBlocker();
    }
});

// IPC: Custom Notification
function getDefaultNotificationPosition() {
    const area = screen.getPrimaryDisplay().workArea;
    const left = area.x + NOTIFICATION_MARGIN;
    const right = area.x + area.width - NOTIFICATION_WIDTH - NOTIFICATION_MARGIN;
    const top = area.y + NOTIFICATION_MARGIN;
    const bottom = area.y + area.height - NOTIFICATION_HEIGHT - NOTIFICATION_MARGIN;

    switch (appSettings.notificationPosition) {
        case 'top-right': return { x: right, y: top };
        case 'top-left': return { x: left, y: top };
        case 'bottom-left': return { x: left, y: bottom };
        default: return { x: right, y: bottom };
    }
}

// The saved custom position, or null if it was never picked or its monitor is gone
function getCustomNotificationPosition() {
    const x = appSettings.customNotificationX;
    const y = appSettings.customNotificationY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return null;
    return isOnScreen({ x, y, width: NOTIFICATION_WIDTH, height: NOTIFICATION_HEIGHT }) ? { x, y } : null;
}

function getNotificationPosition() {
    if (appSettings.notificationPosition === 'custom') {
        return getCustomNotificationPosition() || getDefaultNotificationPosition();
    }
    return getDefaultNotificationPosition();
}

function revealNotification(notifWindow) {
    if (appSettings.stealFocus !== false) { // Default true
        if (notifWindow.isMinimized()) notifWindow.restore();
        notifWindow.show();
        notifWindow.moveTop();
    } else {
        notifWindow.showInactive(); // Show without stealing focus
    }
}

function closeNotificationWindow() {
    clearTimeout(notificationCloseTimer);
    notificationCloseTimer = null;
    if (notificationWindow && !notificationWindow.isDestroyed()) {
        // destroy() is synchronous, so a notification arriving right after this
        // can't end up reusing a window that's still in the middle of closing
        notificationWindow.destroy();
    }
    notificationWindow = null;
}

// (Re)start the auto-close countdown, so every new alert gets the full duration
function scheduleNotificationAutoClose() {
    clearTimeout(notificationCloseTimer);
    notificationCloseTimer = null;
    const duration = appSettings.notificationDuration ?? 30; // 0 = never
    if (duration > 0) {
        notificationCloseTimer = setTimeout(closeNotificationWindow, duration * 1000);
    }
}

ipcMain.handle('show-custom-notification', (event, data) => {
    // With type 'none', don't show anything (the in-app ring overlay is handled by the renderer)
    if (appSettings.notificationType === 'none' || isQuitting || sessionEnding) {
        return;
    }

    // Close the position picker so it doesn't overlap the notification and break focus
    if (positionPickerWindow && !positionPickerWindow.isDestroyed()) {
        positionPickerWindow.close();
        positionPickerWindow = null;
    }

    // If the app is focused the user already sees the in-app overlay, so close any leftover popup
    if (win && win.isVisible() && win.isFocused()) {
        closeNotificationWindow();
        return;
    }

    const content = {
        title: data.title,
        body: data.body,
        snooze: data.snoozeEnabled,
        repeat: data.repeatEnabled,
        id: data.id,
        repeatCount: data.repeatCount
    };

    // Reuse the window if it's already on screen: just swap its content
    if (notificationWindow && !notificationWindow.isDestroyed() && notificationRevealed) {
        notificationWindow.webContents.send('update-content', content);
        revealNotification(notificationWindow);
        scheduleNotificationAutoClose();
        return;
    }

    // A popup that's still loading can't receive content yet: replace it with one built for this alert
    closeNotificationWindow();

    const { x, y } = getNotificationPosition();

    const notifWindow = new BrowserWindow({
        width: NOTIFICATION_WIDTH,
        height: NOTIFICATION_HEIGHT,
        x,
        y,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: true, // Needed for tooltips to work on some systems
        show: false, // Revealed on ready-to-show, so the first frame is the rendered page
        backgroundColor: '#1a1a1a', // Same as notification.html: anything painted before the page is dark, never white
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    notificationWindow = notifWindow;
    notificationRevealed = false;

    notifWindow.setAlwaysOnTop(true, 'screen-saver');

    let revealed = false;
    const reveal = () => {
        if (revealed || notifWindow.isDestroyed() || isQuitting || sessionEnding) return;
        revealed = true;
        if (notificationWindow === notifWindow) notificationRevealed = true;
        revealNotification(notifWindow);
    };
    notifWindow.once('ready-to-show', reveal);
    // Safety net: an alarm popup must never stay hidden if ready-to-show doesn't fire
    setTimeout(reveal, 1000);

    // Retire the popup as soon as it starts closing (e.g. its × button), so a new alert
    // never gets sent to a window that's about to disappear
    notifWindow.on('close', () => {
        if (notificationWindow === notifWindow) {
            notificationWindow = null;
            clearTimeout(notificationCloseTimer);
            notificationCloseTimer = null;
        }
    });

    notifWindow.loadFile(path.join(__dirname, 'notification.html'), {
        query: {
            title: data.title || '',
            body: data.body || '',
            snooze: data.snoozeEnabled ? 'true' : 'false',
            repeat: data.repeatEnabled ? 'true' : 'false',
            id: String(data.id ?? ''),
            repeatCount: String(data.repeatCount || 0)
        }
    });

    scheduleNotificationAutoClose();
});

// Close the notification remotely
ipcMain.handle('close-custom-notification', () => {
    closeNotificationWindow();
});

// Relay notification actions: notification window -> main process -> main renderer
ipcMain.on('notification-action', (event, data) => {
    if (win && !win.isDestroyed()) {
        win.webContents.send('notification-action', data);
    }

    // Close the notification window on interaction (Stop, Snooze, Repeat)
    // This ensures the next notification creates a new window with the right focus state
    closeNotificationWindow();
});

ipcMain.handle('pick-custom-notification-position', () => {
    if (isQuitting || sessionEnding) return;

    if (positionPickerWindow && !positionPickerWindow.isDestroyed()) {
        if (positionPickerWindow.isMinimized()) positionPickerWindow.restore();
        if (!positionPickerWindow.isVisible()) positionPickerWindow.show();
        positionPickerWindow.focus();
        return;
    }

    const { x, y } = getCustomNotificationPosition() || getDefaultNotificationPosition();

    const pickerWindow = new BrowserWindow({
        width: NOTIFICATION_WIDTH,
        height: NOTIFICATION_HEIGHT,
        x,
        y,
        frame: false,
        transparent: false,
        resizable: false,
        backgroundColor: '#1c1c1e',
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    positionPickerWindow = pickerWindow;

    pickerWindow.setAlwaysOnTop(true, 'screen-saver');
    pickerWindow.once('ready-to-show', () => pickerWindow.show());

    pickerWindow.loadFile(path.join(__dirname, 'positionPicker.html'));

    pickerWindow.on('closed', () => {
        if (positionPickerWindow === pickerWindow) positionPickerWindow = null;
    });
});

ipcMain.on('save-custom-position', () => {
    if (positionPickerWindow && !positionPickerWindow.isDestroyed()) {
        const [x, y] = positionPickerWindow.getPosition();
        appSettings.customNotificationX = x;
        appSettings.customNotificationY = y;
        saveSettings();

        positionPickerWindow.close();
    }
});

// IPC Handlers: Files
ipcMain.handle('save-file', async (event, name, buffer) => {
    const safeName = path.basename(name);
    const targetPath = path.join(soundsDir, safeName);

    await fs.promises.writeFile(targetPath, Buffer.from(buffer));
    return `file://${targetPath.replace(/\\/g, '/')}`;
});

ipcMain.handle('delete-file', async (event, filename) => {
    const safeName = path.basename(filename);
    const targetPath = path.join(soundsDir, safeName);
    try {
        await fs.promises.unlink(targetPath);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            console.error('Failed to delete file:', e);
            return false;
        }
    }
    return true;
});

ipcMain.handle('get-store-path', () => {
    return `file://${soundsDir.replace(/\\/g, '/')}`;
});

// IPC Handlers: Auto-Update
function checkForUpdates() {
    if (!app.isPackaged) return;
    autoUpdater.checkForUpdates().catch(err => {
        console.log('Update check failed:', err.message);
    });
}

ipcMain.handle('start-update-download', () => {
    autoUpdater.downloadUpdate().catch(err => {
        console.error('Download update failed:', err.message);
    });
});

ipcMain.handle('open-external', (event, url) => {
    // Validate the URL for security
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
        shell.openExternal(url);
    }
});


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    // If any process crashes, write a minidump to app.getPath('crashDumps') instead of letting
    // Windows show a blocking "Application Error" dialog. Must run before 'ready' to cover child processes.
    crashReporter.start({ uploadToServer: false });

    app.on('browser-window-created', (event, window) => {
        attachSessionEndHandlers(window);
    });

    app.on('second-instance', () => {
        showMainWindow();
    });

    app.whenReady().then(() => {
        // autoUpdater configuration
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;

        autoUpdater.on('update-available', (info) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('update-available', {
                    version: info.version,
                    releaseUrl: `https://github.com/PietroFilippo/ClockApp/releases/tag/v${info.version}`
                });
            }
        });

        autoUpdater.on('download-progress', (progress) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('update-progress', {
                    percent: Math.round(progress.percent)
                });
            }
        });

        autoUpdater.on('update-downloaded', () => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('update-downloaded');
            }
            // Wait a brief moment, then install
            setTimeout(() => {
                if (!sessionEnding) autoUpdater.quitAndInstall(false, true);
            }, 1500);
        });

        autoUpdater.on('error', (err) => {
            console.error('Auto-updater error:', err?.message || err);
            if (win && !win.isDestroyed()) {
                win.webContents.send('update-error');
            }
        });

        createWindow();
        createTray();

        // The app usually lives in the tray for days, so don't only check at startup
        setInterval(checkForUpdates, 6 * 60 * 60 * 1000);

        // Auto-launch (prod only)
        if (app.isPackaged) {
            app.setLoginItemSettings({
                openAtLogin: appSettings.autoLaunch
            });
        }
    });

    app.on('web-contents-created', (event, contents) => {
        // The app only shows its own local pages: open GitHub links in the browser, block everything else
        contents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('https://github.com/')) {
                shell.openExternal(url);
            }
            return { action: 'deny' };
        });
        contents.on('will-navigate', (event) => {
            event.preventDefault();
        });

        contents.on('before-input-event', (event, input) => {
            if (input.type !== 'keyDown') return;
            const key = input.key.toLowerCase();

            // Ctrl+Q quits, but only while the app itself is focused (a global shortcut
            // would steal Ctrl+Q from every other program)
            if (input.control && !input.shift && !input.alt && key === 'q') {
                event.preventDefault();
                isQuitting = true;
                app.quit();
                return;
            }
            // Block DevTools (Ctrl+Shift+I) in production
            if (input.control && input.shift && key === 'i') {
                if (app.isPackaged) {
                    event.preventDefault();
                }
            }
            // Block Ctrl+R in production
            if (input.control && key === 'r') {
                if (app.isPackaged) {
                    event.preventDefault();
                } else {
                    // Reload in dev
                    contents.reload();
                }
            }
        });
    });
}

// IPC: Exit App
ipcMain.handle('exit-app', () => {
    isQuitting = true;
    app.quit();
});

// Window controls
ipcMain.on('window-minimize', () => {
    if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
    if (win) {
        if (win.isFullScreen()) {
            win.setFullScreen(false);
            win.maximize();
        } else if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

// IPC: Taskbar — window title and progress bar
ipcMain.on('set-window-title', (event, title) => {
    if (win && !win.isDestroyed()) {
        win.setTitle(title);
    }
});

ipcMain.on('set-progress-bar', (event, progress) => {
    if (win && !win.isDestroyed()) {
        // progress: 0.0 to 1.0 to show, -1 to remove
        win.setProgressBar(progress);
    }
});

ipcMain.on('window-close', () => {
    if (win) win.close();
});

// Global shortcuts
ipcMain.on('register-global-shortcuts', (event, shortcuts) => {
    // Unregister existing ones to avoid conflicts
    globalShortcut.unregisterAll();

    Object.entries(shortcuts || {}).forEach(([action, accelerator]) => {
        if (!accelerator) return;
        try {
            const registered = globalShortcut.register(accelerator, () => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-shortcut-triggered', action);
                }
            });
            if (!registered) {
                console.log('Shortcut already taken by another program:', accelerator);
            }
        } catch (err) {
            // Suppress error logging for expected conflicts (like Alt+R with the Nvidia overlay)
            if (!err.message.includes('Registration failed')) {
                console.log('Error registering shortcut', accelerator, err);
            }
        }
    });
});

ipcMain.on('unregister-global-shortcuts', () => {
    globalShortcut.unregisterAll();
});


ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin) {
        const [x, y] = senderWin.getPosition();
        senderWin.setPosition(x + deltaX, y + deltaY);
    }
});

// Quit handler
app.on('before-quit', () => {
    isQuitting = true;

    closeNotificationWindow();
    stopPowerBlocker();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    // The main window only really closes when quitting (otherwise it hides to the tray).
    // During a Windows session end the process terminates itself, so do nothing here.
    if (!sessionEnding) {
        app.quit();
    }
});
