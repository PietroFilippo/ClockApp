import './assets/styles/index.css';
import { Navigation } from './components/Navigation.js';
import { WorldClock } from './components/WorldClock.js';
import { Alarm } from './components/Alarm.js';
import { Stopwatch } from './components/Stopwatch.js';
import { Timer } from './components/Timer.js';
import { Interval, promptSaveInterval } from './components/Interval.js';
import { Settings } from './components/Settings.js';
import { alarmManager } from './modules/AlarmManager.js';
import { timerManager } from './modules/TimerManager.js';
import { stopwatchManager } from './modules/StopwatchManager.js';
import { intervalTimerManager } from './modules/IntervalTimerManager.js';
import { notificationService, timerDurationLabel } from './services/NotificationService.js';
import { showRingOverlay } from './components/RingOverlay.js';
import { truncate } from './utils/notification.js';
import { STORAGE_KEYS } from './utils/constants.js';
import { initShortcuts } from './utils/shortcuts.js';

alarmManager.init();


// The ring overlay on screen: { element, type, id }
let currentOverlay = null;

// Remove a ring overlay without stopping its alert (the alert was handled elsewhere)
function dismissOverlayElement(element) {
  if (currentOverlay && currentOverlay.element === element) currentOverlay = null;
  element.dismiss();
}

function dismissOverlay(matches = () => true) {
  if (currentOverlay && matches(currentOverlay)) {
    dismissOverlayElement(currentOverlay.element);
  }
}

const isOverlayFor = (type, id) => (overlay) => overlay.type === type && overlay.id === id;

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th" ... for the repeated-timer title
function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
}

function onNotificationRing(e) {
  const alert = e.detail;

  // Replace the existing overlay (prevents stacking)
  dismissOverlay();

  let timeDisplay, title, label, actionButton = null, secondaryButton = null, stopLabel;

  if (alert.type === 'alarm') {
    const isSnooze = alert.data.isSnooze;
    timeDisplay = isSnooze ? alert.title.match(/\((.*?)\)/)[1] : alert.data.alarm.time;
    title = isSnooze ? 'Snoozed alarm' : 'Alarm';
    label = truncate(alert.data.alarm.label || '', 60);

    if (alert.snoozeEnabled) {
      actionButton = {
        text: `Snooze for ${alert.data.alarm.snoozeInterval || 9} min`,
        onClick: (ovl) => {
          dismissOverlayElement(ovl);
          alarmManager.snoozeAlarm(alert.id);
        }
      };
    }
  } else if (alert.type === 'timer') {
    // Repeat count lives in the title only; the body shows the label, or the duration when unlabeled
    const duration = timerDurationLabel(alert.data);
    const customLabel = alert.body && alert.body !== 'Time is up!' ? truncate(alert.body, 60) : '';
    title = alert.repeatCount > 0 ? `Timer, ${ordinal(alert.repeatCount + 1)} time` : 'Timer';
    if (customLabel) {
      timeDisplay = customLabel;
      label = duration ? `${duration} timer is up` : 'Time is up';
    } else {
      timeDisplay = duration || 'Time is up';
      label = duration ? 'Time is up' : '';
    }

    actionButton = {
      text: 'Repeat',
      onClick: (ovl) => {
        dismissOverlayElement(ovl);
        timerManager.repeatFromAlert(alert.id);
      }
    };
  } else if (alert.type === 'interval') {
    const { presetLabel, presetId } = alert.data;
    title = 'Interval finished';
    timeDisplay = presetLabel || 'All steps completed';
    label = presetLabel ? 'All steps completed' : '';
    stopLabel = 'Done';

    actionButton = {
      text: 'Restart',
      onClick: (ovl) => {
        dismissOverlayElement(ovl);
        intervalTimerManager.restartFromAlert();
      }
    };

    // An interval started from the draft isn't saved yet: offer to keep it
    if (!presetId) {
      secondaryButton = {
        text: 'Save',
        onClick: (ovl) => {
          dismissOverlayElement(ovl);
          notificationService.stopAlert(alert.id);
          promptSaveInterval(alert.data);
        }
      };
    }
  }

  const overlay = showRingOverlay({
    title,
    timeDisplay,
    label,
    actionButton,
    secondaryButton,
    stopLabel,
    type: alert.type,
    onStop: () => {
      // Forget this overlay first: stopping can synchronously show the next alert's overlay
      if (currentOverlay && currentOverlay.element === overlay) currentOverlay = null;
      if (alert.type === 'alarm') {
        alarmManager.stopAlarm(alert.id);
      } else {
        notificationService.stopAlert(alert.id);
      }
    }
  });

  currentOverlay = { element: overlay, type: alert.type, id: alert.id };
}

document.addEventListener('notification-ring', onNotificationRing);

// Listeners for alerts handled from the notification popup
document.addEventListener('timer-stop-requested', (e) => dismissOverlay(isOverlayFor('timer', e.detail?.id)));
document.addEventListener('timer-repeat-requested', (e) => dismissOverlay(isOverlayFor('timer', e.detail?.id)));
document.addEventListener('alarm-stop-requested', (e) => dismissOverlay(isOverlayFor('alarm', e.detail.id)));
document.addEventListener('alarm-snooze-requested', (e) => dismissOverlay(isOverlayFor('alarm', e.detail.id)));

// Auto-action for an alert left ringing (see NotificationService): same as clicking its button
document.addEventListener('notification-action', (e) => {
  const { action, id, type } = e.detail;
  dismissOverlay(isOverlayFor(type, id));

  if (type === 'alarm') {
    if (action === 'snooze') alarmManager.snoozeAlarm(id);
    else alarmManager.stopAlarm(id);
  } else if (action === 'repeat') {
    timerManager.repeatFromAlert(id);
  } else {
    notificationService.stopAlert(id);
  }
});

document.addEventListener('all-alerts-stopped', () => dismissOverlay());


const app = document.querySelector('#app');

let currentTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'world-clock';
let activeComponentCleanup = null;

function onTabChange(newTab) {
  if (currentTab === newTab) return;

  // Save the scroll position of the current tab before switching
  const contentArea = document.querySelector('#content');
  if (contentArea) {
    scrollPositions[currentTab] = contentArea.scrollTop;
  }

  currentTab = newTab;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, currentTab);
  updateView();
  updateNav();
}

function render() {
  app.innerHTML = `
    <div class="app-container">
      <div id="title-bar" class="title-bar">
        <div class="title-bar-drag">
          <img class="title-bar-icon" src="icon.png" alt="" draggable="false">
          <span class="title-bar-text">Clock App</span>
        </div>
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

    // Stopwatch shortcuts: system-wide or in-app only, per the Global Shortcuts setting
    window.electronAPI.getSettings().then(settings => initShortcuts(settings.globalShortcuts === true));
  } else {
    initShortcuts(false);
  }

  const navContainer = app.querySelector('#nav-container');

  // Render Navigation
  navContainer.appendChild(Navigation(currentTab, onTabChange));

  updateView();
}

const scrollPositions = {};

function updateView() {
  const contentArea = document.querySelector('#content');

  // Clean up previous component
  if (activeComponentCleanup) {
    activeComponentCleanup();
    activeComponentCleanup = null;
  }

  contentArea.innerHTML = ''; // Clear current view

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

  // Handles both DOM Node and { element, cleanup } returns
  if (componentResult instanceof Node) {
    contentArea.appendChild(componentResult);
  } else if (componentResult && componentResult.element) {
    contentArea.appendChild(componentResult.element);
    if (componentResult.cleanup) {
      activeComponentCleanup = componentResult.cleanup;
    }
  }

  // Restore scroll position
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

  navContainer.appendChild(Navigation(currentTab, onTabChange));
}


render();

// ── Centralized Taskbar Updater ──
// Updates the window title and the progress bar on the taskbar
// to show active countdowns when hovering over the minimized icon.
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
      // Pick the timer with the least time remaining to display
      const nearest = activeTimers.reduce((a, b) =>
        a.remainingSeconds < b.remainingSeconds ? a : b
      );

      const label = nearest.label ? ` — ${nearest.label}` : '';
      const timeStr = formatTaskbarTime(nearest.remainingSeconds);
      window.electronAPI.setWindowTitle(`⏱ ${timeStr}${label}`);

      // Progress bar: 1.0 = full, 0.0 = empty
      const progress = nearest.totalSeconds > 0
        ? nearest.remainingSeconds / nearest.totalSeconds
        : 0;
      window.electronAPI.setProgressBar(1 - progress); // Inverted: fills as time passes
      return true; // Timer takes priority
    }
    return false;
  }

  function updateTaskbarFromStopwatch() {
    if (stopwatchManager.isRunning) {
      const elapsed = stopwatchManager.getElapsed();
      const timeStr = formatStopwatchTime(elapsed);
      window.electronAPI.setWindowTitle(`⏱ ${timeStr}`);
      window.electronAPI.setProgressBar(-1); // No progress bar for stopwatch
      return true;
    }
    return false;
  }

  function clearTaskbar() {
    window.electronAPI.setWindowTitle(DEFAULT_TITLE);
    window.electronAPI.setProgressBar(-1);
  }

  // Listener: Timer tick (fired every second by the TimerManager)
  document.addEventListener('timers-tick', () => {
    if (!updateTaskbarFromTimers()) {
      // No active timers — check stopwatch or clear
      if (!updateTaskbarFromStopwatch()) {
        clearTaskbar();
      }
    }
  });

  // Listener: Timer removed/finished
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

  // Listener: Stopwatch — starts/stops the update interval
  document.addEventListener('stopwatch-update', () => {
    if (stopwatchManager.isRunning) {
      // Start interval if it doesn't exist and there are no active timers
      if (!taskbarStopwatchInterval) {
        taskbarStopwatchInterval = setInterval(() => {
          // Timers take priority over stopwatch
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
      // Stopwatch stopped — clear interval
      if (taskbarStopwatchInterval) {
        clearInterval(taskbarStopwatchInterval);
        taskbarStopwatchInterval = null;
      }
      // Check whether there are timers before clearing
      if (!updateTaskbarFromTimers()) {
        clearTaskbar();
      }
    }
  });

  // Initialization: check current state on load
  setTimeout(() => {
    if (!updateTaskbarFromTimers() && !updateTaskbarFromStopwatch()) {
      clearTaskbar();
    } else if (stopwatchManager.isRunning && !taskbarStopwatchInterval) {
      // Start stopwatch polling if it was already running on load
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
    // Avoid duplicates
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

  window.electronAPI.onUpdateError(() => {
    const banner = document.querySelector('.update-banner');
    const btn = banner?.querySelector('#update-now-btn');
    // Only relevant while a download started from the banner is in progress
    if (!btn || !btn.disabled) return;
    banner.querySelector('.update-banner-text').textContent = 'Update failed. Please try again.';
    banner.querySelector('.update-progress-bar').style.display = 'none';
    btn.disabled = false;
    btn.textContent = 'Retry';
  });
}
