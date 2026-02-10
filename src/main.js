import './assets/styles/index.css';
import { Navigation } from './components/Navigation.js';
import { WorldClock } from './components/WorldClock.js';
import { Alarm } from './components/Alarm.js';
import { Stopwatch } from './components/Stopwatch.js';
import { Timer } from './components/Timer.js';
import { Settings } from './components/Settings.js';
import { alarmManager } from './modules/AlarmManager.js';
import { timerManager } from './modules/TimerManager.js';
import { showRingOverlay } from './components/RingOverlay.js';
import { truncate } from './utils/notification.js';

alarmManager.init();


// Helper pra rastrear o modal aberto
let currentOverlay = null;

function onAlarmRing(e) {
  const { alarm, isSnooze } = e.detail;

  // Cleanup de overlay existente (evita empilhamento)
  if (currentOverlay && currentOverlay.element) {
    currentOverlay.element.remove();
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
        ovl.remove();
        currentOverlay = null;
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
    currentOverlay.element.remove();
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
        ovl.remove();
        currentOverlay = null;
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
  if (currentOverlay && currentOverlay.type === 'timer') {
    currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('timer-repeat-requested', () => {
  if (currentOverlay && currentOverlay.type === 'timer') {
    currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('alarm-stop-requested', (e) => {
  if (currentOverlay && currentOverlay.type === 'alarm' && currentOverlay.id === e.detail.id) {
    currentOverlay.element.remove();
    currentOverlay = null;
  } else if (currentOverlay && currentOverlay.type === 'alarm') {
  }
});

document.addEventListener('alarm-snooze-requested', (e) => {
  if (currentOverlay && currentOverlay.type === 'alarm' && currentOverlay.id === e.detail.id) {
    currentOverlay.element.remove();
    currentOverlay = null;
  }
});

document.addEventListener('all-alerts-stopped', () => {
  if (currentOverlay && currentOverlay.element) {
    currentOverlay.element.remove();
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
        const keybinds = JSON.parse(localStorage.getItem('stopwatch-keybinds')) || {
          toggle: 'Alt+P',
          lap: 'Alt+L',
          stop: 'Alt+S',
          reset: 'Alt+R'
        };
        window.electronAPI.registerGlobalShortcuts(keybinds);
      }
    });

    // Listen for global shortcuts (ALWAYS active)
    // Removemos listener anterior para evitar duplicatas em re-renders (embora main.js rode uma vez só, render() pode rodar mais?)
    // render() roda uma vez. updateView roda varias.
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

    // Listen for setting changes from Settings.js
    window.electronAPI.onSettingsUpdated && window.electronAPI.onSettingsUpdated((data) => {
      // Se settings mudaram no backend (ex: outra janela), podemos reagir. 
      // Mas Settings.js salva e aplica. Se precisarmos reagir a "Global Shortcuts" toggle aqui:
      // A lógica de toggle no Settings.js deve reenviar o registro.
    });
  }

  const navContainer = app.querySelector('#nav-container');

  // Render Navigation
  navContainer.appendChild(Navigation(currentTab, (newTab) => {
    if (currentTab === newTab) return;
    currentTab = newTab;
    localStorage.setItem('activeTab', currentTab);
    updateView();
    updateNav();
  }));

  updateView();
}

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
}

function updateNav() {
  const navContainer = document.querySelector('#nav-container');
  navContainer.innerHTML = '';
  navContainer.appendChild(Navigation(currentTab, (newTab) => {
    if (currentTab === newTab) return;
    currentTab = newTab;
    localStorage.setItem('activeTab', currentTab);
    updateView();
    updateNav();
  }));
}


render();

