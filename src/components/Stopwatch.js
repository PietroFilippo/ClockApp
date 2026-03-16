import { stopwatchManager } from '../modules/StopwatchManager.js';
import { showAlert } from '../utils/notification.js';
import { ColorPicker } from '../utils/ColorPicker.js';
import { KeybindManager } from '../utils/KeybindManager.js';
import { STORAGE_KEYS, COLORS, LIMITS } from '../utils/constants.js';
import { AnalogStopwatch } from '../utils/AnalogStopwatch.js';

export function Stopwatch() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let intervalId = null;
  let showColorSelection = false;

  let colorPickerInstance = null;
  let analogInstance = null;
  let viewMode = localStorage.getItem(STORAGE_KEYS.STOPWATCH_VIEW_MODE) || 'digital';

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

  let showKeybindsModal = false;
  let showSpeedSelector = false;

  // Keybind manager (encapsula estado, gravação, conflitos, shortcuts)
  const keybindManager = new KeybindManager({
    onAction: (action) => handleShortcutAction(action),
    onUpdate: () => render()
  });

  function handleShortcutAction(action) {
    switch (action) {
      case 'toggle': toggle(); break;
      case 'lap': stopwatchManager.isRunning ? stopwatchManager.lap() : null; render(); break;
      case 'stop':
        if (stopwatchManager.isRunning) {
          stopwatchManager.stop();
          stopInterval();
          render();
        }
        break;
      case 'reset':
        // Reset especial: Stop, Reset, Start
        stopwatchManager.specialReset();
        startInterval();
        render();
        break;
    }
  }

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

  function renderSpeedSelector() {
    const currentSpeed = stopwatchManager.getState().speed;
    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
    return `
      <div class="speed-selector-dropdown">
          ${speeds.map(s => `
              <div class="speed-option ${s === currentSpeed ? 'active' : ''}" data-speed="${s}">
                  <span>${s.toFixed(2)}x</span>
                  ${s === currentSpeed ? '<span>✓</span>' : ''}
              </div>
          `).join('')}
      </div>
      `;
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
      render();
      openColorPicker('fastest');
    };

    container.querySelector('#select-slowest').onclick = () => {
      showColorSelection = false;
      render();
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

    // Renderização inicial da estrutura
    if (!container.querySelector('.header')) {
      container.innerHTML = `
            <div class="header">
                <h1>Stopwatch</h1>
                <div class="add-btn-container">
                    <button class="add-btn" id="download-btn" style="font-size: 14px; width: auto; padding: 0 10px; display: none">Download</button>
                    <button class="add-btn" id="keybinds-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Keybinds</button>
                    <button class="add-btn" id="colors-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Colors</button>
                </div>
            </div>
            <div class="speed-btn-container">
                <div class="stopwatch-display-area">
                    <div class="stopwatch-view-track" id="view-track" style="transform: translateX(${viewMode === 'analog' ? '-50%' : '0%'})">
                        <div class="stopwatch-view-slide">
                            <div class="stopwatch-display">${formatTime(state.elapsed)}</div>
                        </div>
                        <div class="stopwatch-view-slide">
                            <div class="stopwatch-analog-container">
                                <canvas id="analog-stopwatch-canvas"></canvas>
                                <div class="analog-digital-readout">${formatTime(state.elapsed)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="stopwatch-view-dots">
                        <span class="view-dot ${viewMode === 'digital' ? 'active' : ''}" data-view="digital"></span>
                        <span class="view-dot ${viewMode === 'analog' ? 'active' : ''}" data-view="analog"></span>
                    </div>
                </div>
                <button id="speed-btn" class="speed-toggle-btn${state.speed !== 1.0 ? ' active' : ''}">
                    ${state.speed.toFixed(2)}x
                </button>
                <div id="speed-dropdown-container"></div>
            </div>
            <div class="controls">
                <button class="control-btn" id="toggle-btn">Start</button>
                <button class="control-btn reset" id="lap-reset-btn">Reset</button>
            </div>
            <div class="laps-list"></div>
            <div id="modals-placeholder"></div>
        `;
      attachMainListeners();
      initAnalog();
      initSwipeGesture();
    }

    // Botão de Download
    const downloadBtn = container.querySelector('#download-btn');
    if (downloadBtn) {
      downloadBtn.style.display = (state.laps.length > 0 || state.elapsed > 0) ? 'inline-block' : 'none';
    }

    // Botão de Velocidade
    const speedBtn = container.querySelector('#speed-btn');
    if (speedBtn) {
      if (speedBtn.textContent.trim() !== `${state.speed.toFixed(2)}x`) {
        speedBtn.textContent = `${state.speed.toFixed(2)}x`;
      }
      speedBtn.classList.toggle('active', state.speed !== 1.0);
    }

    renderSpeedDropdownLogic(state);
    renderControls(state);
    renderLapsList(state);
    updateDisplay(state);

    // Modais
    const modalsPlaceholder = container.querySelector('#modals-placeholder');
    if (modalsPlaceholder) {
      const hasColor = modalsPlaceholder.querySelector('#color-selection-overlay');
      const hasKeybind = modalsPlaceholder.querySelector('#keybinds-modal');

      if (showColorSelection && !hasColor) {
        modalsPlaceholder.innerHTML = renderColorSelection();
        initColorSelection();
      } else if (!showColorSelection && hasColor) {
        modalsPlaceholder.innerHTML = '';
      }

      if (showKeybindsModal && !hasKeybind) {
        modalsPlaceholder.innerHTML = keybindManager.renderModal();
        keybindManager.attachModalListeners(container, () => {
          showKeybindsModal = false;
          keybindManager.cancelRecording();
          render();
        });
      } else if (showKeybindsModal && hasKeybind) {
        // Modal já existe: atualiza apenas os botões de keybind
        keybindManager.updateModalUI(container);
      } else if (!showKeybindsModal && hasKeybind) {
        modalsPlaceholder.innerHTML = '';
      }
    }

    if (state.isRunning) {
      startInterval();
    } else {
      stopInterval();
    }
  }

  function attachMainListeners() {
    container.querySelector('#toggle-btn').onclick = toggle;
    container.querySelector('#lap-reset-btn').onclick = lapOrReset;

    const keybindsBtn = container.querySelector('#keybinds-btn');
    if (keybindsBtn) {
      keybindsBtn.onclick = () => {
        showKeybindsModal = true;
        render();
      };
    }

    const speedBtn = container.querySelector('#speed-btn');
    if (speedBtn) {
      speedBtn.onclick = (e) => {
        e.stopPropagation();
        showSpeedSelector = !showSpeedSelector;
        render();
      };
    }

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

    // View dots (digital/analog toggle)
    container.querySelectorAll('.view-dot').forEach(dot => {
      dot.onclick = () => switchView(dot.dataset.view);
    });
  }

  function attachSpeedListeners() {
    container.querySelectorAll('.speed-option').forEach(opt => {
      opt.onclick = () => {
        const newSpeed = parseFloat(opt.dataset.speed);
        stopwatchManager.setSpeed(newSpeed);
        showSpeedSelector = false;
        render();
      };
    });

    const closeSpeed = (e) => {
      if (!e.target.closest('.speed-selector-dropdown') && !e.target.closest('#speed-btn')) {
        showSpeedSelector = false;
        render();
        document.removeEventListener('click', closeSpeed);
      }
    };
    // setTimeout pra evitar trigger imediato
    setTimeout(() => document.addEventListener('click', closeSpeed), 0);
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

  function initAnalog() {
    const canvas = container.querySelector('#analog-stopwatch-canvas');
    if (canvas && !analogInstance) {
      analogInstance = new AnalogStopwatch(canvas);
      analogInstance.draw(stopwatchManager.getElapsed());
    }
  }

  function switchView(newMode, animated = true) {
    if (newMode === viewMode) return;
    const wasRunning = !!intervalId;
    if (wasRunning) stopInterval();

    viewMode = newMode;
    localStorage.setItem(STORAGE_KEYS.STOPWATCH_VIEW_MODE, viewMode);

    const track = container.querySelector('#view-track');
    const dots = container.querySelectorAll('.view-dot');

    if (track) {
      if (!animated) track.classList.add('no-transition');
      track.style.transform = viewMode === 'analog' ? 'translateX(-50%)' : 'translateX(0%)';
      if (!animated) {
        // force reflow then remove
        track.offsetHeight;
        track.classList.remove('no-transition');
      }
    }
    dots.forEach(d => d.classList.toggle('active', d.dataset.view === viewMode));

    if (wasRunning) startInterval();
    updateDisplay(stopwatchManager.getState());
  }

  // Swipe gesture para alternar digital/analógico
  function initSwipeGesture() {
    const track = container.querySelector('#view-track');
    if (!track) return;

    let isDragging = false;
    let startX = 0;
    let startTranslatePercent = 0;
    let currentTranslatePercent = 0;
    let trackWidth = 0;
    let startTime = 0;

    function getBasePercent() {
      return viewMode === 'analog' ? -50 : 0;
    }

    function onPointerDown(e) {
      // Ignora se clicar em botões/inputs dentro
      if (e.target.closest('button, input, select, .view-dot')) return;
      isDragging = true;
      startX = e.clientX;
      startTranslatePercent = getBasePercent();
      currentTranslatePercent = startTranslatePercent;
      trackWidth = track.parentElement.offsetWidth;
      startTime = Date.now();

      track.classList.add('no-transition');
      track.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      // Converte pixel delta para % do viewport (track width = 2x viewport)
      const deltaPercent = (deltaX / trackWidth) * 100;
      currentTranslatePercent = startTranslatePercent + deltaPercent;

      // Limita o arraste
      currentTranslatePercent = Math.max(-50, Math.min(0, currentTranslatePercent));

      track.style.transform = `translateX(${currentTranslatePercent}%)`;
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;

      track.classList.remove('no-transition');

      const deltaX = e.clientX - startX;
      const elapsed = Date.now() - startTime;
      const velocity = Math.abs(deltaX) / elapsed; // px/ms

      const threshold = trackWidth * 0.15; // 15% do viewport
      const isFlick = velocity > 0.4;
      const dragDistance = currentTranslatePercent - startTranslatePercent;

      let newMode = viewMode;
      if (isFlick || Math.abs(dragDistance) > (threshold / trackWidth * 100)) {
        if (dragDistance < 0) {
          newMode = 'analog'; // arrastou pra esquerda
        } else {
          newMode = 'digital'; // arrastou pra direita
        }
      }

      // Anima para posição final
      viewMode = newMode;
      localStorage.setItem(STORAGE_KEYS.STOPWATCH_VIEW_MODE, viewMode);
      track.style.transform = viewMode === 'analog' ? 'translateX(-50%)' : 'translateX(0%)';

      const dots = container.querySelectorAll('.view-dot');
      dots.forEach(d => d.classList.toggle('active', d.dataset.view === viewMode));

      updateDisplay(stopwatchManager.getState());
    }

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
  }

  function startInterval() {
    if (intervalId) return;
    // Sempre atualiza ambas as views para que o swipe mostre dados atuais
    const tick = () => {
      const elapsed = stopwatchManager.getElapsed();
      // Digital display
      const display = container.querySelector('.stopwatch-display');
      if (display) display.textContent = formatTime(elapsed);
      // Analog display
      if (analogInstance) analogInstance.draw(elapsed);
      const readout = container.querySelector('.analog-digital-readout');
      if (readout) readout.textContent = formatTime(elapsed);
      intervalId = requestAnimationFrame(tick);
    };
    intervalId = requestAnimationFrame(tick);
  }

  function stopInterval() {
    cancelAnimationFrame(intervalId);
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

  function updateDisplay(state) {
    const elapsed = stopwatchManager.getElapsed();
    // Atualiza ambos os displays
    const display = container.querySelector('.stopwatch-display');
    if (display) {
      const newTime = formatTime(elapsed);
      if (display.textContent !== newTime) {
        display.textContent = newTime;
      }
    }
    if (analogInstance) analogInstance.draw(elapsed);
    const readout = container.querySelector('.analog-digital-readout');
    if (readout) readout.textContent = formatTime(elapsed);
  }

  function renderControls(state) {
    const toggleBtn = container.querySelector('#toggle-btn');
    if (toggleBtn) {
      const newText = state.isRunning ? 'Stop' : 'Start';
      if (toggleBtn.textContent !== newText) toggleBtn.textContent = newText;
      const newClass = `control-btn ${state.isRunning ? 'stop' : 'start'}`;
      if (toggleBtn.className !== newClass) toggleBtn.className = newClass;
    }
    const lapResetBtn = container.querySelector('#lap-reset-btn');
    if (lapResetBtn) {
      const newText = state.isRunning ? 'Lap' : 'Reset';
      if (lapResetBtn.textContent !== newText) lapResetBtn.textContent = newText;
    }
  }

  // Otimização de renderização de voltas: rastreia o fingerprint dos dados para evitar reconstruções DOM desnecessárias
  let lastLapsFingerprint = null;

  function renderLapsList(state) {
    const lapsList = container.querySelector('.laps-list');
    if (!lapsList) return;

    const { fastestIndex, slowestIndex } = getLapStats(state.laps);

    // Constroi um fingerprint leve a partir do número de voltas + pontos de dados principais + cores
    const fingerprint = state.laps.length === 0
      ? 'empty'
      : `${state.laps.length}|${state.laps[0].lapTime}|${state.laps[state.laps.length - 1].lapTime}|${fastestIndex}|${slowestIndex}|${fastestColor}|${slowestColor}`;

    if (fingerprint === lastLapsFingerprint) return;
    lastLapsFingerprint = fingerprint;

    const newHTML = state.laps.map((lap, index) => {
      let lapClass = 'lap-item';
      let lapStyle = '';
      if (index === fastestIndex && state.laps.length >= 2) {
        lapClass += ' lap-fastest';
        lapStyle = `style="color: ${fastestColor}"`;
      } else if (index === slowestIndex && state.laps.length >= 2) {
        lapClass += ' lap-slowest';
        lapStyle = `style="color: ${slowestColor}"`;
      }
      return `
                <div class="${lapClass}" ${lapStyle}>
                    <span>Lap ${state.laps.length - index}</span>
                    <span>${formatTime(lap.lapTime)}</span>
                </div>
            `;
    }).join('');

    if (lapsList.innerHTML !== newHTML) {
      lapsList.innerHTML = newHTML;
    }
  }

  function renderSpeedDropdownLogic(state) {
    const speedDropdown = container.querySelector('#speed-dropdown-container');
    if (speedDropdown) {
      const shouldShow = showSpeedSelector;
      const currentHTML = speedDropdown.innerHTML;
      if (shouldShow && currentHTML === '') {
        speedDropdown.innerHTML = renderSpeedSelector();
        attachSpeedListeners();
      } else if (!shouldShow && currentHTML !== '') {
        speedDropdown.innerHTML = '';
      } else if (shouldShow) {
        speedDropdown.innerHTML = renderSpeedSelector();
        attachSpeedListeners();
      }
    }
  }

  render();

  return {
    element: container,
    cleanup: () => {
      stopInterval();
      window.removeEventListener('keydown', handleEsc);
      keybindManager.cleanup();
      if (colorPickerInstance) colorPickerInstance.destroy();
      if (analogInstance) { analogInstance.destroy(); analogInstance = null; }
    }
  };

};

