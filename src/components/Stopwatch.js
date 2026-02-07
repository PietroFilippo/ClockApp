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

  // Estado das keybinds
  const DEFAULT_KEYBINDS = {
    toggle: 'Alt+P',
    lap: 'Alt+L',
    stop: 'Alt+S',
    reset: 'Alt+R' // reset especial
  };
  let keybinds = JSON.parse(localStorage.getItem('stopwatch-keybinds')) || DEFAULT_KEYBINDS;
  let isListeningForKey = null; // 'toggle', 'lap', etc.
  let showKeybindsModal = false;
  let showSpeedSelector = false;

  // Registra shortcuts ao carregar
  if (window.electronAPI) {
    window.electronAPI.registerGlobalShortcuts(keybinds);

    // Listener para shortcuts
    window.electronAPI.onGlobalShortcut((action) => {
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
    });
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

  function renderKeybindsModal() {
    return `
        <div class="modal-overlay" id="keybinds-modal">
            <div class="modal-content" style="max-width: 400px;">
                <h2>Customize Keybinds</h2>
                <div class="keybind-list">
                    ${Object.entries(keybinds).map(([action, currentKey]) => `
                        <div class="keybind-item">
                            <span>${action === 'reset' ? 'Special Reset' : action}</span>
                            <button class="record-btn ${isListeningForKey === action ? 'recording' : ''}" data-action="${action}">
                                ${isListeningForKey === action ? 'Press keys...' : currentKey}
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" id="reset-defaults">Defaults</button>
                    <button class="modal-btn primary" id="close-keybinds">Done</button>
                </div>
            </div>
        </div>
      `;
  }

  // Lógica de gravação de keybinds
  const handleRecording = (e) => {
    if (isListeningForKey) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        isListeningForKey = null;
        if (window.electronAPI) window.electronAPI.registerGlobalShortcuts(keybinds);
        updateKeybindsModalUI();
        return;
      }

      try {
        let parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Command'); // Mac

        let key = e.key.toUpperCase();
        // Permite o uso geral do Control, mas bloqueia pressionamentos de teclas de modificadores sozinhos
        if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return;

        parts.push(key);
        const accelerator = parts.join('+');

        // Resolução de conflito
        const existingAction = Object.keys(keybinds).find(k => keybinds[k] === accelerator && k !== isListeningForKey);

        if (existingAction) {
          // Se roubar uma tecla de existingAction
          const defaultKey = DEFAULT_KEYBINDS[existingAction];

          // Verifica se a tecla padrão para existingAction está livre (tomada por ninguém, incluindo a que esta sendo atribuida)
          // EXCEPTION: Se a tecla padrão for a mesma, não considera "tomada" pelo valor antigo porque vai sobreescrevê-la
          const isDefaultTaken = Object.entries(keybinds).some(([k, v]) => v === defaultKey && k !== existingAction && k !== isListeningForKey);

          // Também verifica se a tecla padrão é a mesma que esta sendo atribuida
          // Se existingAction's default é 'Alt+R' e esta sendo atribuido 'Alt+R' pra 'lap', não pode reverter existingAction pra 'Alt+R'
          const isDefaultBeingStolen = (defaultKey === accelerator);

          if (!isDefaultTaken && !isDefaultBeingStolen) {
            // Reverte pra tecla padrão
            keybinds[existingAction] = defaultKey;
          } else {
            // Ou desvincula
            keybinds[existingAction] = '';
          }
        }

        keybinds[isListeningForKey] = accelerator;
        isListeningForKey = null;

        // Salva e registra
        localStorage.setItem('stopwatch-keybinds', JSON.stringify(keybinds));
        if (window.electronAPI) {
          window.electronAPI.registerGlobalShortcuts(keybinds);
        }
        // Re-renderiza apenas a parte do modal para evitar flickering
        updateKeybindsModalUI();
      } catch (err) {
        isListeningForKey = null;
        updateKeybindsModalUI();
      }
    }
  };

  window.addEventListener('keydown', handleRecording, { capture: true });

  function updateKeybindsModalUI() {
    const kbModal = container.querySelector('#keybinds-modal');
    if (!kbModal) {
      return;
    }

    // Atualiza botões
    kbModal.querySelectorAll('.record-btn').forEach(btn => {
      const action = btn.dataset.action;
      const currentKey = keybinds[action];
      const isRecording = isListeningForKey === action;

      btn.className = `record-btn ${isRecording ? 'recording' : ''}`;
      btn.textContent = isRecording ? 'Press keys...' : currentKey;
    });
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
    const { fastestIndex, slowestIndex } = getLapStats(state.laps);

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
                <div class="stopwatch-display">${formatTime(state.elapsed)}</div>
                <button id="speed-btn" class="speed-toggle-btn">
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
      // Anexa Listeners apens uma vez efetivamente (delegation ou direct)
      attachMainListeners();
    }

    // Botão de Download
    const downloadBtn = container.querySelector('#download-btn');
    if (downloadBtn) {
      downloadBtn.style.display = (state.laps.length > 0 || state.elapsed > 0) ? 'inline-block' : 'none';
    }

    // Botão de Velocidade
    const speedBtn = container.querySelector('#speed-btn');
    if (speedBtn) {
      // só atualiza se mudar, para evitar minor DOM thrashing (embora textContent seja barato)
      if (speedBtn.textContent.trim() !== `${state.speed.toFixed(2)}x`) {
        speedBtn.textContent = `${state.speed.toFixed(2)}x`;
      }
    }

    // Dropdown de Velocidade
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

    // Botões de Controle (Texto & Classe)
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

    // Lista de Laps
    const lapsList = container.querySelector('.laps-list');
    if (lapsList) {
      const newLapsHTML = state.laps.map((lap, index) => {
        let lapClass = 'lap-item';
        let lapStyle = '';
        if (index === fastestIndex && state.laps.length >= 2) { // só aplica se houver pelo menos 2 voltas
          lapClass += ' lap-fastest';
          lapStyle = `style="color: ${fastestColor}"`;
        } else if (index === slowestIndex && state.laps.length >= 2) { // só aplica se houver pelo menos 2 voltas
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

      // apenas atualiza se houver diferença
      if (lapsList.innerHTML !== newLapsHTML) {
        lapsList.innerHTML = newLapsHTML;
      }
    }

    // Modais
    const modalsPlaceholder = container.querySelector('#modals-placeholder');
    if (modalsPlaceholder) {

      const hasColor = modalsPlaceholder.querySelector('#color-selection-overlay');
      const hasKeybind = modalsPlaceholder.querySelector('#keybinds-modal');

      // modal de seleção de cores
      if (showColorSelection && !hasColor) {
        // abre modal de seleção de cores
        modalsPlaceholder.innerHTML = renderColorSelection(); // Substitui qualquer modal existente
        initColorSelection();
      } else if (!showColorSelection && hasColor) {
        // fecha modal de seleção de cores
        modalsPlaceholder.innerHTML = '';
      }

      // modal de configurações de teclas
      if (showKeybindsModal && !hasKeybind) {
        // abre modal de configurações de teclas
        modalsPlaceholder.innerHTML = renderKeybindsModal(); // Substitui qualquer modal existente
        attachKeybindModalListeners();
      } else if (!showKeybindsModal && hasKeybind) {
        // fecha modal de configurações de teclas
        modalsPlaceholder.innerHTML = '';
      } else if (showKeybindsModal && hasKeybind) {
      }
    }

    // Atualiza stopwatch display diretamente para performance
    const display = container.querySelector('.stopwatch-display');
    if (display) {
      const newTime = formatTime(stopwatchManager.getElapsed());
      if (display.textContent !== newTime) {
        display.textContent = newTime;
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

  function attachKeybindModalListeners() {
    const kbModal = container.querySelector('#keybinds-modal');
    if (kbModal) {
      // Overlay clique para fechar
      kbModal.onclick = (e) => {
        if (e.target === kbModal) {
          showKeybindsModal = false;
          isListeningForKey = null;
          render();
        }
      }

      kbModal.querySelectorAll('.record-btn').forEach(btn => {
        btn.onclick = () => {
          if (window.electronAPI) window.electronAPI.unregisterGlobalShortcuts();

          isListeningForKey = btn.dataset.action;
          updateKeybindsModalUI();
        };
      });
      kbModal.querySelector('#reset-defaults').onclick = () => {
        keybinds = { ...DEFAULT_KEYBINDS };
        isListeningForKey = null; // Limpa estado de gravação
        localStorage.setItem('stopwatch-keybinds', JSON.stringify(keybinds));
        if (window.electronAPI) window.electronAPI.registerGlobalShortcuts(keybinds);
        updateKeybindsModalUI();
      };
      kbModal.querySelector('#close-keybinds').onclick = () => {
        // Garante que está re-registrado
        if (window.electronAPI) window.electronAPI.registerGlobalShortcuts(keybinds);
        showKeybindsModal = false;
        isListeningForKey = null;
        render();
      };
    }
  }

  // Função legada, caso necessário
  function attachListeners() {
    // Substituída por attachMainListeners chamada dentro de render
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
      window.removeEventListener('keydown', handleRecording, { capture: true });
      if (colorPickerInstance) colorPickerInstance.destroy();
    }
  };
}
