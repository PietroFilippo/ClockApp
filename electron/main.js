import { app, BrowserWindow, ipcMain, Tray, Menu, powerSaveBlocker, screen, globalShortcut, shell } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Padroniza nome do app para caminho de dados do usuario
app.setName('Clock App');
if (process.platform === 'win32') {
    app.setAppUserModelId('com.pietrofilippo.clockapp');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const userDataPath = app.getPath('userData');
const soundsDir = path.join(userDataPath, 'sounds');
const settingsPath = path.join(userDataPath, 'settings.json');

// Garante que o diretório de sons exista
if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
}

// Carrega Configurações
let appSettings = {
    preventSuspend: false,
    autoLaunch: true,
    notificationType: 'app', // 'system', 'app', 'both'
    notificationPosition: 'bottom-right',
    customNotificationX: 0,
    customNotificationY: 0,
    minimizeToTray: true,
    showTimerInTray: false,
    stealFocus: true,
    notificationDuration: 30 // segundos, 0 para nunca
};

try {
    if (fs.existsSync(settingsPath)) {
        appSettings = JSON.parse(fs.readFileSync(settingsPath));
    }
} catch (e) {
    console.error('Error loading settings', e);
}

let win = null;
let tray = null;
let isQuitting = false;
let powerBlockerId = null;
let notificationWindow = null;
let positionPickerWindow = null;

function getIconPath() {
    if (process.env.VITE_DEV_SERVER_URL) {
        return path.join(__dirname, '../public/icon.png');
    } else {
        // Em prod, vite copia assets publicos pra dist
        return path.join(__dirname, '../dist/icon.png');
    }
}

function createWindow() {
    const iconPath = getIconPath();
    // Salva estado da janela
    const windowState = appSettings.windowState || {};

    win = new BrowserWindow({
        width: windowState.width || 900,
        height: windowState.height || 700,
        x: windowState.x,
        y: windowState.y,
        minWidth: 400,
        minHeight: 520,
        frame: false, // Barra de título customizada
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false
        },
        autoHideMenuBar: true,
        icon: iconPath,
        show: false // Mostra manualmente
    });

    if (windowState.isMaximized) {
        win.maximize();
    }

    win.show();

    // Carrega dev/prod
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        // win.webContents.openDevTools(); 
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.on('close', (event) => {
        // Salva estado da janela antes de fechar/ocultar
        if (win && !win.isDestroyed()) {
            const bounds = win.getBounds();
            appSettings.windowState = {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                isMaximized: win.isMaximized()
            };
            try {
                fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2));
            } catch (e) {
                console.error('Error saving window state:', e);
            }
        }

        // Minimiza pra tray se a setting é valida e habilitada
        if (!isQuitting && appSettings.minimizeToTray) {
            // Verifica se tray existe antes de esconder
            if (tray && !tray.isDestroyed()) {
                event.preventDefault();
                win.hide();
                return false;
            }
        }
    });

    // Limpa quando a janela é fechada (se não minimizada)
    win.on('closed', () => {
        win = null;
    });

    // Auto-updater: verifica atualização após a janela carregar
    win.webContents.on('did-finish-load', () => {
        if (app.isPackaged) {
            autoUpdater.checkForUpdates().catch(err => {
                console.log('Update check failed:', err.message);
            });
        }
    });
}

function createTray() {
    try {
        const iconPath = getIconPath();
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => win.show()
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

        tray.on('double-click', () => {
            if (win) win.show();
        });
    } catch (error) {
        console.error("Failed to create tray icon:", error);
        // Desabilita minimize to tray se não conseguir criar a UI pra ele
        appSettings.minimizeToTray = false;
    }
}

// IPC Handlers: Settings
ipcMain.handle('get-settings', () => {
    return appSettings;
});

ipcMain.handle('save-setting', async (event, key, value) => {
    appSettings[key] = value;
    try {
        await fs.promises.writeFile(settingsPath, JSON.stringify(appSettings, null, 2));
    } catch (e) {
        console.error('Error saving settings:', e);
    }

    // Aplica efeitos imediatos
    if (key === 'autoLaunch') {
        // Apenas modifica auto-launch se empacotado pra evitar "zombie" dev processes
        if (app.isPackaged) {
            app.setLoginItemSettings({ openAtLogin: value });
        }
    }
});

// IPC: Power
ipcMain.handle('set-power-blocker', (event, enabled) => {
    if (enabled) {
        if (powerBlockerId === null) {
            powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
            // Power Blocker ligado
        }
    } else {
        if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
            powerSaveBlocker.stop(powerBlockerId);
            // Power Blocker desligado
            powerBlockerId = null;
        }
    }
});

// IPC: Custom Notification
ipcMain.handle('show-custom-notification', (event, data) => {
    // Se o tipo for 'none', não mostra nada (apenas notificação interna do app que já acontece no renderizador)
    if (appSettings.notificationType === 'none') {
        return;
    }

    // Fecha o modal de posição se aberto pra não sobrepor e bugar o foco 
    if (positionPickerWindow && !positionPickerWindow.isDestroyed()) {
        positionPickerWindow.close();
        positionPickerWindow = null;
    }

    // Se o app está focado, não mostra notificação customizada
    if (win && win.isVisible() && win.isFocused()) {
        // se já existe uma janela de notificação (ex: de um alarme anterior), fecha ela pois o usuário já está no app
        if (notificationWindow && !notificationWindow.isDestroyed()) {
            notificationWindow.close();
        }
        return;
    }

    // Se janela já existe e não foi destruída, reutiliza!
    if (notificationWindow && !notificationWindow.isDestroyed()) {
        const notifData = {
            title: data.title,
            body: data.body,
            snooze: data.snoozeEnabled,
            repeat: data.repeatEnabled,
            id: data.id,
            repeatCount: data.repeatCount
        };

        notificationWindow.webContents.send('update-content', notifData);

        if (appSettings.stealFocus !== false) {
            if (notificationWindow.isMinimized()) notificationWindow.restore();
            notificationWindow.show();
            notificationWindow.moveTop();
        } else {
            notificationWindow.showInactive();
        }

        // Reinicia timer de auto-close se necessário (opcional, mas bom pra UX)
        // Resetar o timeout seria complexo aqui sem trackear var global, 
        // mas como o 'updateActiveAlert' é chamado frequentemente, o risco é baixo.
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const notifWidth = 350;
    const notifHeight = 160;

    let x, y;
    const position = appSettings.notificationPosition || 'bottom-right';
    const padding = 20;

    switch (position) {
        case 'top-right':
            x = width - notifWidth - padding;
            y = padding;
            break;
        case 'top-left':
            x = padding;
            y = padding;
            break;
        case 'bottom-left':
            x = padding;
            y = height - notifHeight - padding;
            break;
        case 'bottom-right':
            x = width - notifWidth - padding;
            y = height - notifHeight - padding;
            break;
        case 'custom':
            x = appSettings.customNotificationX || (width - notifWidth - padding);
            y = appSettings.customNotificationY || (height - notifHeight - padding);
            break;
        default:
            x = width - notifWidth - padding;
            y = height - notifHeight - padding;
            break;
    }

    notificationWindow = new BrowserWindow({
        width: notifWidth,
        height: notifHeight,
        x: x,
        y: y,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: true, // Necessário para tooltips funcionarem em alguns sistemas
        show: false, // Inicia oculto para respeitar a configuração de foco depois
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    notificationWindow.setAlwaysOnTop(true, 'screen-saver');

    if (appSettings.stealFocus !== false) { // Default true
        notificationWindow.show();
    } else {
        notificationWindow.showInactive(); // Mostra sem roubar o foco
    }

    // Monta query string
    const params = new URLSearchParams({
        title: data.title,
        body: data.body, // Alinhado com o que notification.html espera
        snooze: data.snoozeEnabled ? 'true' : 'false',
        repeat: data.repeatEnabled ? 'true' : 'false',
        id: data.id || '',
        repeatCount: data.repeatCount || '0'
    });

    notificationWindow.loadURL(`file://${path.join(__dirname, 'notification.html')}?${params.toString()}`);

    // Fecha automaticamente baseado na setting
    const duration = appSettings.notificationDuration || 30;
    const currentWindow = notificationWindow; // Referência local para evitar race condition
    if (duration > 0) {
        setTimeout(() => {
            if (currentWindow && !currentWindow.isDestroyed()) {
                currentWindow.close();
            }
        }, duration * 1000);
    }

    notificationWindow.on('closed', () => {
        notificationWindow = null;
    });
});

// Fecha a notificação remotamente
ipcMain.handle('close-custom-notification', () => {
    if (notificationWindow && !notificationWindow.isDestroyed()) {
        notificationWindow.close();
    }
});

// Transmite ação de notificação de janela -> janela principal -> renderizador
ipcMain.on('notification-action', (event, data) => {
    if (win && !win.isDestroyed()) {
        win.webContents.send('notification-action', data);
    }

    // Fecha a janela de notificação ao interagir (Stop, Snooze, Repeat)
    // Isso garante que a próxima notificação crie uma nova janela com o estado de foco correto
    if (notificationWindow && !notificationWindow.isDestroyed()) {
        notificationWindow.close();
    }
});

ipcMain.handle('pick-custom-notification-position', () => {
    if (positionPickerWindow && !positionPickerWindow.isDestroyed()) {
        if (positionPickerWindow.isMinimized()) positionPickerWindow.restore();
        if (!positionPickerWindow.isVisible()) positionPickerWindow.show();
        positionPickerWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const notifWidth = 350;
    const notifHeight = 160;

    positionPickerWindow = new BrowserWindow({
        width: notifWidth,
        height: notifHeight,
        x: appSettings.customNotificationX || (width - notifWidth - 20),
        y: appSettings.customNotificationY || (height - notifHeight - 20),
        frame: false,
        transparent: false,
        backgroundColor: '#1c1c1e',
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    positionPickerWindow.setAlwaysOnTop(true, 'screen-saver');

    positionPickerWindow.loadURL(`file://${path.join(__dirname, 'positionPicker.html')}`);

    positionPickerWindow.on('closed', () => {
        positionPickerWindow = null;
    });
});

ipcMain.on('save-custom-position', async (event) => {
    if (positionPickerWindow) {
        const [x, y] = positionPickerWindow.getPosition();
        appSettings.customNotificationX = x;
        appSettings.customNotificationY = y;

        try {
            await fs.promises.writeFile(settingsPath, JSON.stringify(appSettings, null, 2));
        } catch (e) {
            console.error('Error saving settings:', e);
        }

        positionPickerWindow.close();

        // Opcional: Notifica o front que mudou (embora o Settings.js possa carregar do getSettings)
        if (win) {
            win.webContents.send('settings-updated', { key: 'customNotificationPosition', x, y });
        }
    }
});

// IPC Handlers: Files
ipcMain.handle('save-file', async (event, name, buffer) => {
    const safeName = path.basename(name);
    const targetPath = path.join(soundsDir, safeName);

    await fs.promises.writeFile(targetPath, Buffer.from(buffer));
    return `file://${targetPath.replace(/\\/g, '/')}`;
});

ipcMain.handle('copy-sound-file', async (event, sourcePath, filename) => {
    const safeName = path.basename(filename);
    const targetPath = path.join(soundsDir, safeName);
    await fs.promises.copyFile(sourcePath, targetPath);
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
ipcMain.handle('start-update-download', () => {
    autoUpdater.downloadUpdate().catch(err => {
        console.error('Download update failed:', err.message);
    });
});

ipcMain.handle('open-external', (event, url) => {
    // Valida URL por segurança
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
        shell.openExternal(url);
    }
});


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (win) {
            if (win.isMinimized()) win.restore();
            if (!win.isVisible()) win.show();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        // Configuração do autoUpdater
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
            // Aguarda um breve momento e instala
            setTimeout(() => {
                autoUpdater.quitAndInstall(false, true);
            }, 1500);
        });

        createWindow();
        createTray();

        // Auto-launch (Apenas em prod)
        if (app.isPackaged) {
            app.setLoginItemSettings({
                openAtLogin: appSettings.autoLaunch
            });
        }

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            } else {
                if (win) win.show();
            }
        });

        // Registra atalho global para desligamento (Dev helper)

        globalShortcut.register('CommandOrControl+Q', () => {
            isQuitting = true;
            app.quit();
        });
    });

    app.on('web-contents-created', (event, contents) => {
        contents.on('before-input-event', (event, input) => {
            // Bloqueia DevTools (Ctrl+Shift+I) em Produção
            if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                if (app.isPackaged) {
                    event.preventDefault();
                }
            }
            // Bloqueia Ctrl+R em Produção
            if (input.control && input.key.toLowerCase() === 'r') {
                if (app.isPackaged) {
                    event.preventDefault();
                } else {
                    // reload em Dev
                    // win.reload() ou contents.reload()
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

// Controles da janela
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

ipcMain.on('window-close', () => {
    if (win) win.close();
});

// Shortcuts globais
ipcMain.on('register-global-shortcuts', (event, shortcuts) => {
    // Desregistra existentes para evitar conflitos
    globalShortcut.unregisterAll();

    // Re-registra padrões ou passados pelo usuário
    globalShortcut.register('CommandOrControl+Q', () => {
        isQuitting = true;
        app.quit();
    });

    Object.entries(shortcuts).forEach(([action, accelerator]) => {
        if (!accelerator) return;
        try {
            const ret = globalShortcut.register(accelerator, () => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-shortcut-triggered', action);
                }
            });
            if (!ret) {
            }
        } catch (err) {
            // Suprime error logging para conflitos esperados (como Alt+R com Overlay Nvidia)
            if (!err.message.includes('Registration failed')) {
                console.log('Error registering shortcut', accelerator, err);
            }
        }
    });
});

ipcMain.on('unregister-global-shortcuts', () => {
    globalShortcut.unregisterAll();
    // fallback
    globalShortcut.register('CommandOrControl+Q', () => {
        isQuitting = true;
        app.quit();
    });
});


ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (senderWin) {
        const [x, y] = senderWin.getPosition();
        senderWin.setPosition(x + deltaX, y + deltaY);
    }
});

// Manipulador de saída
app.on('before-quit', () => {
    isQuitting = true;

    // Fecha a janela de notificação se estiver aberta
    if (notificationWindow && !notificationWindow.isDestroyed()) {
        notificationWindow.close();
    }

    // Para o bloqueador de energia se estiver rodando
    if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
        powerSaveBlocker.stop(powerBlockerId);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


