import './assets/styles/index.css';
import { Navigation } from './components/Navigation.js';
import { WorldClock } from './components/WorldClock.js';
import { Alarm } from './components/Alarm.js';
import { Stopwatch } from './components/Stopwatch.js';
import { Timer } from './components/Timer.js';
import { Interval } from './components/Interval.js';
import { Settings } from './components/Settings.js';
import { alarmManager } from './modules/AlarmManager.js';
import { timerManager } from './modules/TimerManager.js';
import { stopwatchManager } from './modules/StopwatchManager.js';
import { notificationService } from './services/NotificationService.js';
import { showRingOverlay } from './components/RingOverlay.js';
import { truncate } from './utils/notification.js';
import { STORAGE_KEYS } from './utils/constants.js';
import { DEFAULT_KEYBINDS } from './utils/KeybindManager.js';

alarmManager.init();


// Helper pra rastrear o modal aberto
let currentOverlay = null;

function onNotificationRing(e) {
  const alert = e.detail;

  // Cleanup de overlay existente (evita empilhamento)
  if (currentOverlay && currentOverlay.element) {
    if (currentOverlay.element.isConnected) {
      currentOverlay.element.remove();
    }
    currentOverlay = null;
  }

  let timeDisplay, title, label, actionButton = null;

  if (alert.type === 'alarm') {
    const isSnooze = alert.data.isSnooze;
    timeDisplay = isSnooze ? alert.title.match(/\((.*?)\)/)[1] : alert.data.alarm.time;
    title = alert.title;
    label = truncate(alert.data.alarm.label || '', 60);

    if (alert.snoozeEnabled) {
      actionButton = {
        text: `Snooze (${alert.data.alarm.snoozeInterval || 9} min)`,
        onClick: (ovl) => {
          alarmManager.snoozeAlarm(alert.id);
          setTimeout(() => {
            if (ovl.isConnected) ovl.remove();
            currentOverlay = null;
          }, 0);
        }
      };
    }
  } else if (alert.type === 'timer') {
    const countDisplay = (alert.repeatCount > 0) ? ` (${alert.repeatCount + 1}x)` : '';
    timeDisplay = truncate(alert.body || '', 60) + countDisplay;
    title = 'Timer' + countDisplay;
    label = 'Time is up!';

    actionButton = {
      text: 'Repeat',
      onClick: (ovl) => {
        notificationService.stopAlert(alert.id, 'timer');
        timerManager.repeatFromConfig({
          initialHours: alert.data.initialHours,
          initialMinutes: alert.data.initialMinutes,
          initialSeconds: alert.data.initialSeconds,
          label: alert.body,
          soundId: alert.soundId,
          repeatCount: alert.repeatCount
        });
        setTimeout(() => {
          if (ovl.isConnected) ovl.remove();
          currentOverlay = null;
        }, 0);
      }
    };
  }

  const overlay = showRingOverlay({
    title,
    timeDisplay,
    label,
    actionButton,
    onStop: () => {
      if (alert.type === 'alarm') {
        alarmManager.stopAlarm(alert.id);
      } else {
        notificationService.stopAlert(alert.id, 'timer');
      }
      currentOverlay = null;
    }
  });

  if (alert.type === 'timer') {
    const h1 = overlay.querySelector('h1');
    if (h1) h1.style.fontSize = '34px';
  }

  currentOverlay = { element: overlay, type: alert.type, id: alert.id };
}

document.addEventListener('notification-ring', onNotificationRing);

// Listeners pra requisições externas de parada (ex: de Notificação)
document.addEventListener('timer-stop-requested', () => {
  if (currentOverlay && currentOverlay.type === 'timer' && currentOverlay.element) {
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('timer-repeat-requested', () => {
  if (currentOverlay && currentOverlay.type === 'timer' && currentOverlay.element) {
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('alarm-stop-requested', (e) => {
  if (currentOverlay && currentOverlay.type === 'alarm' && currentOverlay.id === e.detail.id && currentOverlay.element) {
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('alarm-snooze-requested', (e) => {
  if (currentOverlay && currentOverlay.type === 'alarm' && currentOverlay.id === e.detail.id && currentOverlay.element) {
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});

// Listener unificado de notificação de ação (auto-action)
document.addEventListener('notification-action', (e) => {
  const { action, id, type } = e.detail;
  if (currentOverlay && currentOverlay.type === type && currentOverlay.id === id && currentOverlay.element) {
    if (action === 'snooze' && type === 'alarm') {
      alarmManager.snoozeAlarm(id);
    } else if (action === 'repeat' && type === 'timer') {
      const alert = notificationService.activeAlerts.find(a => a.id === id);
      if (alert) {
         notificationService.stopAlert(id, 'timer');
         timerManager.repeatFromConfig({
            initialHours: alert.data.initialHours,
            initialMinutes: alert.data.initialMinutes,
            initialSeconds: alert.data.initialSeconds,
            label: alert.body,
            soundId: alert.soundId,
            repeatCount: alert.repeatCount
         });
      }
    } else {
      if (type === 'alarm') alarmManager.stopAlarm(id);
      else notificationService.stopAlert(id, 'timer');
    }
    
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('all-alerts-stopped', () => {
  if (currentOverlay && currentOverlay.element) {
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});


const app = document.querySelector('#app');

let currentTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'world-clock';
let activeComponentCleanup = null;

function render() {
  app.innerHTML = `
    <div class="app-container">
      <div id="title-bar" class="title-bar">
        <div class="title-bar-drag"></div>
        <div class="title-bar-controls">
          <button id="min-btn" class="title-btn">−</button>
          <button id="max-btn" class="title-btn">▢</button>
          <button id="close-btn" class="title-btn">×</button>
        </div>
      </div>
      <main id="content" class="content-area"></main>
      <footer id="nav-container"></footer>
    </div>
  `;

  // Window Controls Listeners
  const minBtn = app.querySelector('#min-btn');
  const maxBtn = app.querySelector('#max-btn');
  const closeBtn = app.querySelector('#close-btn');

  if (window.electronAPI) {
    if (minBtn) minBtn.onclick = () => window.electronAPI.minimizeWindow();
    if (maxBtn) maxBtn.onclick = () => window.electronAPI.maximizeWindow();
    if (closeBtn) closeBtn.onclick = () => window.electronAPI.closeWindow();

    // Lógica shortcuts globais
    window.electronAPI.getSettings().then(settings => {
      const useGlobalShortcuts = settings.globalShortcuts !== false;
      if (useGlobalShortcuts) {
        const keybinds = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOPWATCH_KEYBINDS)) || { ...DEFAULT_KEYBINDS };
        window.electronAPI.registerGlobalShortcuts(keybinds);
      }
    });

    window.electronAPI.removeGlobalShortcutListener(); // Limpa prévios
    window.electronAPI.onGlobalShortcut((action) => {
      // Mapeia ações para o StopwatchManager
      switch (action) {
        case 'toggle':
          stopwatchManager.isRunning ? stopwatchManager.stop() : stopwatchManager.start();
          break;
        case 'lap':
          if (stopwatchManager.isRunning) stopwatchManager.lap();
          break;
        case 'stop':
          if (stopwatchManager.isRunning) stopwatchManager.stop();
          break;
        case 'reset':
          stopwatchManager.specialReset();
          break;
      }
    });

    // Removed dead onSettingsUpdated handler
  }

  const navContainer = app.querySelector('#nav-container');

  const onTabChange = (newTab) => {
    if (currentTab === newTab) return;

    // Salva posição do scroll da aba atual antes de trocar
    const contentArea = document.querySelector('#content');
    if (contentArea) {
      scrollPositions[currentTab] = contentArea.scrollTop;
    }

    currentTab = newTab;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, currentTab);
    updateView();
    updateNav();
  };

  // Render Navigation
  navContainer.appendChild(Navigation(currentTab, onTabChange));

  updateView();
}

const scrollPositions = {};

function updateView() {
  const contentArea = document.querySelector('#content');

  // Limpa componente anterior
  if (activeComponentCleanup) {
    activeComponentCleanup();
    activeComponentCleanup = null;
  }

  contentArea.innerHTML = ''; // Limpa view atual

  let componentResult;
  switch (currentTab) {
    case 'world-clock': componentResult = WorldClock(); break;
    case 'alarm': componentResult = Alarm(); break;
    case 'stopwatch': componentResult = Stopwatch(); break;
    case 'timer': componentResult = Timer(); break;
    case 'interval': componentResult = Interval(); break;
    case 'settings': componentResult = Settings(); break;
    default: componentResult = WorldClock();
  }

  // Gerencia tanto DOM Node quanto { element, cleanup } returns
  if (componentResult instanceof Node) {
    contentArea.appendChild(componentResult);
  } else if (componentResult && componentResult.element) {
    contentArea.appendChild(componentResult.element);
    if (componentResult.cleanup) {
      activeComponentCleanup = componentResult.cleanup;
    }
  }

  // Restaura posição do scroll
  if (scrollPositions[currentTab] !== undefined) {
    setTimeout(() => {
      contentArea.scrollTop = scrollPositions[currentTab];
    }, 0);
  } else {
    contentArea.scrollTop = 0;
  }
}

function updateNav() {
  const navContainer = document.querySelector('#nav-container');
  navContainer.innerHTML = '';

  const onTabChange = (newTab) => {
    if (currentTab === newTab) return;

    // Salva posição do scroll da aba atual antes de trocar
    const contentArea = document.querySelector('#content');
    if (contentArea) {
      scrollPositions[currentTab] = contentArea.scrollTop;
    }

    currentTab = newTab;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, currentTab);
    updateView();
    updateNav();
  };

  navContainer.appendChild(Navigation(currentTab, onTabChange));
}


render();

// ── Centralized Taskbar Updater ──
// Atualiza o título da janela e a barra de progresso na taskbar
// para mostrar countdowns ativos ao passar o mouse no ícone minimizado.
if (window.electronAPI && window.electronAPI.setWindowTitle) {
  const DEFAULT_TITLE = 'Clock App';
  let taskbarStopwatchInterval = null;

  function formatTaskbarTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatStopwatchTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateTaskbarFromTimers() {
    const allTimers = timerManager.getAllTimers();
    const activeTimers = allTimers.filter(t => t.isRunning && !t.isPaused);

    if (activeTimers.length > 0) {
      // Pega o timer com menor tempo restante para exibir
      const nearest = activeTimers.reduce((a, b) =>
        a.remainingSeconds < b.remainingSeconds ? a : b
      );

      const label = nearest.label ? ` — ${nearest.label}` : '';
      const timeStr = formatTaskbarTime(nearest.remainingSeconds);
      window.electronAPI.setWindowTitle(`⏱ ${timeStr}${label}`);

      // Barra de progresso: 1.0 = cheio, 0.0 = vazio
      const progress = nearest.totalSeconds > 0
        ? nearest.remainingSeconds / nearest.totalSeconds
        : 0;
      window.electronAPI.setProgressBar(1 - progress); // Inverte: preenche à medida que o tempo passa
      return true; // Timer tem prioridade
    }
    return false;
  }

  function updateTaskbarFromStopwatch() {
    if (stopwatchManager.isRunning) {
      const elapsed = stopwatchManager.getElapsed();
      const timeStr = formatStopwatchTime(elapsed);
      window.electronAPI.setWindowTitle(`⏱ ${timeStr}`);
      window.electronAPI.setProgressBar(-1); // Sem barra de progresso para stopwatch
      return true;
    }
    return false;
  }

  function clearTaskbar() {
    window.electronAPI.setWindowTitle(DEFAULT_TITLE);
    window.electronAPI.setProgressBar(-1);
  }

  // Listener: Timer tick (disparado a cada segundo pelo TimerManager)
  document.addEventListener('timers-tick', () => {
    if (!updateTaskbarFromTimers()) {
      // Sem timers ativos — verifica stopwatch ou limpa
      if (!updateTaskbarFromStopwatch()) {
        clearTaskbar();
      }
    }
  });

  // Listener: Timer removido/finalizado
  document.addEventListener('timer-removed', () => {
    if (!updateTaskbarFromTimers() && !updateTaskbarFromStopwatch()) {
      clearTaskbar();
    }
  });

  document.addEventListener('timer-finished', () => {
    if (!updateTaskbarFromTimers() && !updateTaskbarFromStopwatch()) {
      clearTaskbar();
    }
  });

  // Listener: Stopwatch — inicia/para intervalo de atualização
  document.addEventListener('stopwatch-update', () => {
    if (stopwatchManager.isRunning) {
      // Inicia intervalo se não existe e não há timers ativos
      if (!taskbarStopwatchInterval) {
        taskbarStopwatchInterval = setInterval(() => {
          // Timers têm prioridade sobre stopwatch
          if (!updateTaskbarFromTimers()) {
            if (!updateTaskbarFromStopwatch()) {
              clearInterval(taskbarStopwatchInterval);
              taskbarStopwatchInterval = null;
              clearTaskbar();
            }
          }
        }, 1000);
      }
    } else {
      // Stopwatch parado — limpa intervalo
      if (taskbarStopwatchInterval) {
        clearInterval(taskbarStopwatchInterval);
        taskbarStopwatchInterval = null;
      }
      // Verifica se há timers antes de limpar
      if (!updateTaskbarFromTimers()) {
        clearTaskbar();
      }
    }
  });

  // Inicialização: verifica estado atual ao carregar
  setTimeout(() => {
    if (!updateTaskbarFromTimers() && !updateTaskbarFromStopwatch()) {
      clearTaskbar();
    } else if (stopwatchManager.isRunning && !taskbarStopwatchInterval) {
      // Inicia polling do stopwatch se já estava rodando ao carregar
      taskbarStopwatchInterval = setInterval(() => {
        if (!updateTaskbarFromTimers()) {
          if (!updateTaskbarFromStopwatch()) {
            clearInterval(taskbarStopwatchInterval);
            taskbarStopwatchInterval = null;
            clearTaskbar();
          }
        }
      }, 1000);
    }
  }, 500);
}

// Auto-Update Banner
if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
  window.electronAPI.onUpdateAvailable((data) => {
    // Evita duplicatas
    if (document.querySelector('.update-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.innerHTML = `
      <div class="update-banner-content">
        <span class="update-banner-icon">⬆</span>
        <span class="update-banner-text">Version <strong>${data.version}</strong> is available!</span>
        <div class="update-banner-actions">
          <button class="update-btn update-btn-primary" id="update-now-btn">Update</button>
          <button class="update-btn update-btn-secondary" id="update-view-btn">View Release</button>
          <button class="update-btn update-btn-dismiss" id="update-dismiss-btn">✕</button>
        </div>
      </div>
      <div class="update-progress-bar" style="display: none;">
        <div class="update-progress-fill"></div>
      </div>
    `;

    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.insertBefore(banner, appContainer.querySelector('#content'));
    }

    // Update Now
    banner.querySelector('#update-now-btn').onclick = () => {
      banner.querySelector('.update-banner-text').textContent = 'Downloading update...';
      banner.querySelector('#update-now-btn').disabled = true;
      banner.querySelector('#update-now-btn').textContent = 'Downloading...';
      banner.querySelector('.update-progress-bar').style.display = 'block';
      window.electronAPI.startUpdateDownload();
    };

    // View Release
    banner.querySelector('#update-view-btn').onclick = () => {
      window.electronAPI.openExternal(data.releaseUrl);
    };

    // Dismiss
    banner.querySelector('#update-dismiss-btn').onclick = () => {
      banner.remove();
    };
  });

  window.electronAPI.onUpdateProgress((data) => {
    const fill = document.querySelector('.update-progress-fill');
    if (fill) {
      fill.style.width = `${data.percent}%`;
    }
    const text = document.querySelector('.update-banner-text');
    if (text) {
      text.textContent = `Downloading update... ${data.percent}%`;
    }
  });

  window.electronAPI.onUpdateDownloaded(() => {
    const text = document.querySelector('.update-banner-text');
    if (text) {
      text.textContent = 'Update downloaded! Restarting...';
    }
    const btn = document.querySelector('#update-now-btn');
    if (btn) {
      btn.textContent = 'Installing...';
    }
  });
}
