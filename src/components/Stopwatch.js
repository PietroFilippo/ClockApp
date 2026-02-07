import { stopwatchManager } from '../modules/StopwatchManager.js';
import { showAlert } from '../utils/notification.js';
import { ColorPicker } from '../utils/ColorPicker.js';
import { STORAGE_KEYS, COLORS, LIMITS } from '../utils/constants.js';

export function Stopwatch() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let intervalId = null;
  let showColorSelection = false;

  let colorPickerInstance = null;

  // Carrega as cores salvas no localStorage ou usa os valores padrão
  let fastestColor = localStorage.getItem(STORAGE_KEYS.STOPWATCH_FASTEST_COLOR) || COLORS.DEFAULT_FASTEST_LAP;
  let slowestColor = localStorage.getItem(STORAGE_KEYS.STOPWATCH_SLOWEST_COLOR) || COLORS.DEFAULT_SLOWEST_LAP;
  
  // Handler da modal do ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      if (colorPickerInstance) {
        closeColorPicker();
      } else if (showColorSelection) {
        showColorSelection = false;
        render();
      }
    }
  };

  window.addEventListener('keydown', handleEsc);

  // Carrega as cores personalizadas do localStorage
  let customColors = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOPWATCH_CUSTOM_COLORS)) || [];

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const cs = Math.floor((ms % 1000) / 10);

    const formattedM = String(m).padStart(2, '0');
    const formattedS = String(s).padStart(2, '0');
    const formattedCS = String(cs).padStart(2, '0');

    if (h > 0) {
      return `${h}:${formattedM}:${formattedS}.${formattedCS}`;
    }
    return `${formattedM}:${formattedS}.${formattedCS}`;
  }

  function getLapStats(laps) {
    if (laps.length < 2) return { fastestIndex: -1, slowestIndex: -1 };

    let fastestIndex = 0;
    let slowestIndex = 0;
    let fastestTime = laps[0].lapTime;
    let slowestTime = laps[0].lapTime;

    laps.forEach((lap, index) => {
      if (lap.lapTime < fastestTime) {
        fastestTime = lap.lapTime;
        fastestIndex = index;
      }
      if (lap.lapTime > slowestTime) {
        slowestTime = lap.lapTime;
        slowestIndex = index;
      }
    });

    return { fastestIndex, slowestIndex };
  }

  function renderColorSelection() {
    return `
            <div class="modal-overlay" id="color-selection-overlay">
                <div class="modal-content" style="max-width: 280px;">
                    <h2>Lap Colors</h2>
                    <div class="color-selection-options">
                        <div class="color-selection-item" id="select-fastest">
                            <span class="color-dot" style="background-color: ${fastestColor}"></span>
                            <span>Fastest lap</span>
                        </div>
                        <div class="color-selection-item" id="select-slowest">
                            <span class="color-dot" style="background-color: ${slowestColor}"></span>
                            <span>Slowest lap</span>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" id="close-selection">Close</button>
                    </div>
                </div>
            </div>
        `;
  }

  function downloadResults() {
    const state = stopwatchManager.getState();
    if (state.laps.length === 0 && state.elapsed === 0) {
      showAlert('No data to download.', 'Empty Stopwatch');
      return;
    }

    const { fastestIndex, slowestIndex } = getLapStats(state.laps);
    const now = new Date();
    const dateStr = now.toLocaleString();

    let content = `STOPWATCH RESULTS\n`;
    content += `Date: ${dateStr}\n`;
    content += `Total Time: ${formatTime(state.elapsed)}\n`;
    content += `-------------------------------------------\n`;
    content += `LAP      LAP TIME      TOTAL TIME\n`;
    content += `-------------------------------------------\n`;

    state.laps.reverse().forEach((lap, revIndex) => {
      const originalIndex = state.laps.length - 1 - revIndex;
      const lapNum = String(revIndex + 1).padEnd(8);
      const lapTime = formatTime(lap.lapTime).padEnd(14);
      const totalTime = formatTime(lap.totalTime);

      let line = `${lapNum}${lapTime}${totalTime}`;

      if (originalIndex === fastestIndex && state.laps.length >= 2) {
        line += `  [FASTEST]`;
      } else if (originalIndex === slowestIndex && state.laps.length >= 2) {
        line += `  [SLOWEST]`;
      }

      content += line + `\n`;
    });

    // Reverte de volta para não quebrar o estado interno se laps for por referência
    state.laps.reverse();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stopwatch_results_${now.getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function initColorSelection() {
    const overlay = container.querySelector('#color-selection-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', (e) => {
      if (e.target.id === 'color-selection-overlay') {
        showColorSelection = false;
        render();
      }
    });

    container.querySelector('#select-fastest').onclick = () => {
      showColorSelection = false;
      render(); // Close selection modal first
      openColorPicker('fastest');
    };

    container.querySelector('#select-slowest').onclick = () => {
      showColorSelection = false;
      render(); // Close selection modal first
      openColorPicker('slowest');
    };

    container.querySelector('#close-selection').onclick = () => {
      showColorSelection = false;
      render();
    };
  }

  function openColorPicker(target) {
    const initialColor = target === 'fastest' ? fastestColor : slowestColor;
    const targetLabel = target === 'fastest' ? 'Fastest Lap' : 'Slowest Lap';

    colorPickerInstance = new ColorPicker(container, {
      initialColor,
      targetLabel,
      customColors: customColors,
      onCustomColorsChange: (newColors) => {
        customColors = newColors;
        localStorage.setItem(STORAGE_KEYS.STOPWATCH_CUSTOM_COLORS, JSON.stringify(customColors));
      },
      onSave: (newColor) => {
        if (target === 'fastest') {
          fastestColor = newColor;
          localStorage.setItem(STORAGE_KEYS.STOPWATCH_FASTEST_COLOR, newColor);
        } else {
          slowestColor = newColor;
          localStorage.setItem(STORAGE_KEYS.STOPWATCH_SLOWEST_COLOR, newColor);
        }
        closeColorPicker();
        render();
      },
      onCancel: () => {
        closeColorPicker();
        render();
      }
    });
  }

  function closeColorPicker() {
    if (colorPickerInstance) {
      colorPickerInstance.destroy();
      colorPickerInstance = null;
    }
  }

  function render() {
    const state = stopwatchManager.getState();
    const { fastestIndex, slowestIndex } = getLapStats(state.laps);

    container.innerHTML = `
            <div class="header">
                <h1>Stopwatch</h1>
                <div class="add-btn-container">
                    <button class="add-btn" id="download-btn" style="font-size: 14px; width: auto; padding: 0 10px; display: ${state.laps.length > 0 || state.elapsed > 0 ? 'inline-block' : 'none'}">Download</button>
                    <button class="add-btn" id="colors-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Colors</button>
                </div>
            </div>
            <div class="stopwatch-display">${formatTime(state.elapsed)}</div>
            <div class="controls">
                <button class="control-btn ${state.isRunning ? 'stop' : 'start'}" id="toggle-btn">
                    ${state.isRunning ? 'Stop' : 'Start'}
                </button>
                <button class="control-btn reset" id="lap-reset-btn">
                    ${state.isRunning ? 'Lap' : 'Reset'}
                </button>
            </div>
            <div class="laps-list">
                ${state.laps.map((lap, index) => {
      let lapClass = 'lap-item';
      let lapStyle = '';
      if (index === fastestIndex) {
        lapClass += ' lap-fastest';
        lapStyle = `style="color: ${fastestColor}"`;
      } else if (index === slowestIndex) {
        lapClass += ' lap-slowest';
        lapStyle = `style="color: ${slowestColor}"`;
      }
      return `
                        <div class="${lapClass}" ${lapStyle}>
                            <span>Lap ${state.laps.length - index}</span>
                            <span>${formatTime(lap.lapTime)}</span>
                        </div>
                    `;
    }).join('')}
            </div>
            ${showColorSelection ? renderColorSelection() : ''}
        `;

    attachListeners();
    if (showColorSelection) {
      initColorSelection();
    }

    if (state.isRunning) {
      startInterval();
    }
  }

  function attachListeners() {
    container.querySelector('#toggle-btn').onclick = toggle;
    container.querySelector('#lap-reset-btn').onclick = lapOrReset;

    const colorsBtn = container.querySelector('#colors-btn');
    if (colorsBtn) {
      colorsBtn.onclick = () => {
        showColorSelection = true;
        render();
      };
    }

    const downloadBtn = container.querySelector('#download-btn');
    if (downloadBtn) {
      downloadBtn.onclick = downloadResults;
    }
  }

  function toggle() {
    const state = stopwatchManager.getState();
    if (state.isRunning) {
      stopwatchManager.stop();
      stopInterval();
    } else {
      stopwatchManager.start();
      startInterval();
    }
    render();
  }

  function startInterval() {
    if (intervalId) return;
    intervalId = setInterval(() => {
      const display = container.querySelector('.stopwatch-display');
      if (display) display.textContent = formatTime(stopwatchManager.getElapsed());
    }, 10);
  }

  function stopInterval() {
    clearInterval(intervalId);
    intervalId = null;
  }

  function lapOrReset() {
    const state = stopwatchManager.getState();
    if (state.isRunning) {
      stopwatchManager.lap();
    } else {
      stopwatchManager.reset();
    }
    render();
  }

  render();

  return {
    element: container,
    cleanup: () => {
      stopInterval();
      window.removeEventListener('keydown', handleEsc);
      if (colorPickerInstance) colorPickerInstance.destroy();
    }
  };
}
