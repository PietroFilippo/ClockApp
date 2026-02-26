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
import { showRingOverlay } from './components/RingOverlay.js';
import { truncate } from './utils/notification.js';
import { STORAGE_KEYS } from './utils/constants.js';
import { DEFAULT_KEYBINDS } from './utils/KeybindManager.js';

alarmManager.init();


// Helper pra rastrear o modal aberto
let currentOverlay = null;

function onAlarmRing(e) {
  const { alarm, isSnooze } = e.detail;

  // Cleanup de overlay existente (evita empilhamento)
  if (currentOverlay && currentOverlay.element) {
    if (currentOverlay.element.isConnected) {
      currentOverlay.element.remove();
    }
    currentOverlay = null;
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const title = isSnooze ? `Snooze (${timeStr})` : `Alarm (${timeStr})`;
  const displayTime = isSnooze ? timeStr : alarm.time;
  const truncatedLabel = truncate(alarm.label || '', 60);

  const overlay = showRingOverlay({
    title,
    timeDisplay: displayTime,
    label: truncatedLabel,
    actionButton: alarm.snoozeEnabled ? {
      text: `Snooze (${alarm.snoozeInterval || 9} min)`,
      onClick: (ovl) => {
        alarmManager.snoozeAlarm(alarm.id);
        setTimeout(() => {
          if (ovl.isConnected) ovl.remove();
          currentOverlay = null;
        }, 0);
      }
    } : null,
    onStop: () => {
      alarmManager.stopAlarm(alarm.id);
      currentOverlay = null;
    }
  });

  currentOverlay = { element: overlay, type: 'alarm', id: alarm.id };
}

document.addEventListener('alarm-ring', onAlarmRing);

function onTimerRing(e) {
  const { label, repeatCount } = e.detail;

  // Cleanup de overlay existente
  if (currentOverlay && currentOverlay.element) {
    if (currentOverlay.element.isConnected) {
      currentOverlay.element.remove();
    }
    currentOverlay = null;
  }

  const countDisplay = (repeatCount > 0) ? ` (${repeatCount + 1}x)` : '';
  const truncatedLabel = truncate(label || '', 60);

  const overlay = showRingOverlay({
    title: 'Timer' + countDisplay,
    timeDisplay: truncatedLabel + countDisplay,
    label: 'Time is up!',
    actionButton: {
      text: 'Repeat',
      onClick: (ovl) => {
        alarmManager.stopTimer(); // Usa stoptimer para verificar o estado do audio
        timerManager.repeat();
        setTimeout(() => {
          if (ovl.isConnected) ovl.remove();
          currentOverlay = null;
        }, 0);
      }
    },
    onStop: () => {
      alarmManager.stopTimer(); // Usa stopTimer
      currentOverlay = null;
    }
  });

  const h1 = overlay.querySelector('h1');
  if (h1) h1.style.fontSize = '34px';

  currentOverlay = { element: overlay, type: 'timer' };
}

document.addEventListener('timer-ring', onTimerRing);

// Listener pra requisições externas de parada (ex: de Notificação)
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

document.addEventListener('all-alerts-stopped', () => {
  if (currentOverlay && currentOverlay.element) {
    if (currentOverlay.element.isConnected) currentOverlay.element.remove();
    currentOverlay = null;
  }
});


const app = document.querySelector('#app');

let currentTab = localStorage.getItem('activeTab') || 'world-clock';
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

    window.electronAPI.onSettingsUpdated && window.electronAPI.onSettingsUpdated((data) => {
    });
  }

  const navContainer = app.querySelector('#nav-container');

  // Render Navigation
  navContainer.appendChild(Navigation(currentTab, (newTab) => {
    if (currentTab === newTab) return;

    // Salva posição do scroll da aba atual antes de trocar
    const contentArea = document.querySelector('#content');
    if (contentArea) {
      scrollPositions[currentTab] = contentArea.scrollTop;
    }

    currentTab = newTab;
    localStorage.setItem('activeTab', currentTab);
    updateView();
    updateNav();
  }));

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
  navContainer.appendChild(Navigation(currentTab, (newTab) => {
    if (currentTab === newTab) return;

    // Salva posição do scroll da aba atual antes de trocar
    const contentArea = document.querySelector('#content');
    if (contentArea) {
      scrollPositions[currentTab] = contentArea.scrollTop;
    }

    currentTab = newTab;
    localStorage.setItem('activeTab', currentTab);
    updateView();
    updateNav();
  }));
}


render();

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
