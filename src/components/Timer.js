import { alarmManager } from '../modules/AlarmManager.js';
import { timerManager } from '../modules/TimerManager.js';
import { showModal } from '../utils/modal.js';
import { showAlert, showConfirm, truncate, confirmDelete } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { openSoundPicker } from '../utils/SoundPicker.js';
import { openSoundSettingsModal } from '../utils/SoundSettingsModal.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS, DEFAULT_SOUND } from '../utils/constants.js';

export function Timer() {
    const container = document.createElement('div');
    container.className = 'view-container';

    const radius = 140;
    const circumference = radius * 2 * Math.PI;

    let isEditing = false;
    let recents = [];
    let selectedRecents = new Set();
    let currentMode = null; // 'picker' | 'running'

    initDelegatedListeners();

    function loadRecents() {
        recents = timerManager.getRecents();
    }

    function render() {
        loadRecents();
        const state = timerManager.getState();
        const newMode = (state.isRunning || state.isPaused) ? 'running' : 'picker';

        if (newMode !== currentMode) {
            // Modo mudou: reconstrói o esqueleto completo
            currentMode = newMode;
            if (currentMode === 'running') {
                initRunningView(state);
            } else {
                initPickerView(state);
            }
        } else {
            // Mesmo modo: atualização granular
            if (currentMode === 'running') {
                updateRunningView(state);
            } else {
                updatePickerView(state);
            }
        }
    }

    // Move listeners para fora do render loop
    function initDelegatedListeners() {
        container.addEventListener('click', async (e) => {
            const target = e.target;

            // Edit Recents Toggle
            if (target.closest('#edit-recents-btn')) {
                if (isEditing && selectedRecents.size > 0) {
                    const count = selectedRecents.size;
                    if (await confirmDelete(`${count} timer${count > 1 ? 's' : ''}`, 'Selected')) {
                        for (const id of selectedRecents) {
                            timerManager.deleteRecentTimer(id);
                        }
                        selectedRecents.clear();
                        render();
                    }
                } else {
                    isEditing = !isEditing;
                    selectedRecents.clear();
                    render();
                }
                return;
            }
            // Select checkbox in edit mode
            if (target.classList.contains('select-checkbox')) {
                e.stopPropagation();
                const id = target.dataset.id;
                if (target.checked) {
                    selectedRecents.add(id);
                } else {
                    selectedRecents.delete(id);
                }
                const item = target.closest('.alarm-item');
                if (item) item.classList.toggle('selected', target.checked);
                updatePickerHeaderState();
                return;
            }
            // Recents Play
            if (target.closest('.recent-item-play')) {
                e.stopPropagation();
                const btn = target.closest('.recent-item-play');
                const id = btn.dataset.id;
                startRecent(id);
                return;
            }

            // Delete Recent
            if (target.closest('.delete-recent-btn')) {
                e.stopPropagation();
                const btn = target.closest('.delete-recent-btn');
                const id = btn.dataset.id;
                await confirmAndDeleteRecent(id);
                return;
            }

            const recentInfo = target.closest('.recent-item-info');
            if (recentInfo) {
                const id = recentInfo.dataset.id;
                if (isEditing) {
                    openRecentEditModal(id);
                } else {
                    startRecent(id);
                }
            }
        });

        container.addEventListener('contextmenu', (e) => {
            const recentInfo = e.target.closest('.recent-item-info');
            if (recentInfo) {
                e.preventDefault();
                const id = recentInfo.dataset.id;

                contextMenu.show(e.clientX, e.clientY, [
                    {
                        label: 'Edit',
                        primary: true,
                        action: () => openRecentEditModal(id)
                    },
                    {
                        label: 'Delete',
                        danger: true,
                        action: () => confirmAndDeleteRecent(id)
                    }
                ]);
            }
        });
    }

    async function confirmAndDeleteRecent(id) {
        const recent = recents.find(r => r.id === id);
        const label = recent ? (recent.label || 'Timer') : 'this timer';
        if (await confirmDelete(label, 'Recent Timer')) {
            timerManager.deleteRecentTimer(id);
            render();
        }
    }

    function initPickerView(state) {
        const soundId = state.soundId || alarmManager.getLastUsedSound();
        container.innerHTML = `
      <div class="header">
        <button class="edit-btn" id="edit-recents-btn" style="visibility: ${recents.length > 0 ? 'visible' : 'hidden'}">${isEditing ? 'Done' : 'Edit'}</button>
        <h1>Timers</h1>
        <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
      </div>
      <div class="timer-picker">
        <div class="picker-col">
           <input type="number" id="hours" class="timer-input" min="0" max="23" value="${state.initialHours}">
           <div class="timer-label">hours</div>
        </div>
        <div class="picker-col">
           <input type="number" id="minutes" class="timer-input" min="0" max="59" value="${state.initialMinutes}">
           <div class="timer-label">min</div>
        </div>
        <div class="picker-col">
           <input type="number" id="seconds" class="timer-input" min="0" max="59" value="${state.initialSeconds}">
           <div class="timer-label">sec</div>
        </div>
      </div>

      <div class="modal-section" style="margin: 0 auto 30px;">
          <div class="modal-row">
              <span>Label</span>
              <input type="text" id="timer-label" value="${escapeHtml(state.label || '')}" placeholder="Timer" maxlength="200">
          </div>
          <div class="modal-row">
              <span>When Timer Ends</span>
              <button id="timer-sound-trigger" class="sound-select-btn" data-sound="${soundId}" title="${getSoundName(soundId)}">
                  ${getSoundName(soundId)}
              </button>
              <input type="hidden" id="timer-sound-value" value="${soundId}">
          </div>
      </div>

      <div class="controls" style="justify-content: center;">
        <button class="control-btn start" id="start-btn">Start</button>
      </div>

      <div class="recents-container"></div>
`;
        // Listeners (uma vez por init)
        container.querySelector('#start-btn').onclick = start;
        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());

        const soundTrigger = container.querySelector('#timer-sound-trigger');
        const soundValue = container.querySelector('#timer-sound-value');
        if (soundTrigger) {
            soundTrigger.onclick = () => {
                openSoundPicker(soundValue.value, (selectedId) => {
                    soundValue.value = selectedId;
                    soundTrigger.textContent = getSoundName(selectedId);
                });
            };
        }

        const hoursInput = container.querySelector('#hours');
        const minutesInput = container.querySelector('#minutes');
        const secondsInput = container.querySelector('#seconds');

        const validateInput = (input, max) => {
            input.oninput = () => {
                let val = parseInt(input.value);
                if (val > max) input.value = max;
                if (val < 0) input.value = 0;
                if (input.value.length > 2) input.value = input.value.slice(0, 2);
            };
        };

        validateInput(hoursInput, 23);
        validateInput(minutesInput, 59);
        validateInput(secondsInput, 59);
        // Atualiza recentes
        updateRecentsSection();
        updatePickerHeaderState();
    }

    function updatePickerView(state) {
        updatePickerHeaderState();
        updateRecentsSection();
    }

    function updatePickerHeaderState() {
        const editBtn = container.querySelector('#edit-recents-btn');
        if (editBtn) {
            if (isEditing && selectedRecents.size > 0) {
                editBtn.textContent = `Delete (${selectedRecents.size})`;
                editBtn.style.color = 'var(--accent-red)';
            } else {
                editBtn.textContent = isEditing ? 'Done' : 'Edit';
                editBtn.style.color = '';
            }
            editBtn.style.visibility = recents.length > 0 ? 'visible' : 'hidden';
        }
    }

    function getSoundName(id) {
        const builtIn = alarmManager.getBuiltInSounds().find(s => s.id === id);
        const custom = alarmManager.getCustomSounds().find(s => s.id === id);
        return builtIn ? builtIn.name : (custom ? custom.name : DEFAULT_SOUND.NAME);
    }

    function renderRecentItem(recent) {
        const totalSecs = (recent.hours || 0) * 3600 + (recent.minutes || 0) * 60 + (recent.seconds || 0);
        const timeString = formatTime(totalSecs);

        let durationParts = [];
        if (recent.hours > 0) durationParts.push(`${recent.hours} h`);
        if (recent.minutes > 0) durationParts.push(`${recent.minutes} min`);
        if (recent.seconds > 0) durationParts.push(`${recent.seconds} s`);

        return `
          <div class="alarm-item recent-item ${selectedRecents.has(recent.id) ? 'selected' : ''}" style="position:relative;">
            ${isEditing ? `<button class="delete-clock-btn delete-recent-btn" data-id="${recent.id}">−</button><input type="checkbox" class="select-checkbox" data-id="${recent.id}" ${selectedRecents.has(recent.id) ? 'checked' : ''}>` : ''}
            <div class="alarm-info recent-item-info" data-id="${recent.id}" style="padding-left: ${isEditing ? '40px' : '0'}; transition: padding 0.3s; cursor: pointer; width: 100%;">
              <span class="alarm-time" style="font-size: 32px;">${timeString}</span>
              <span class="alarm-label" title="${escapeHtml(recent.label || 'Timer')}">${escapeHtml(recent.label || 'Timer')}</span>
            </div>
            ${!isEditing ? `
                <button class="control-btn start recent-item-play" data-id="${recent.id}" style="width: 40px; height: 40px; min-width: 40px; padding: 0; display: flex; align-items: center; justify-content: center;">
                  ▶
                </button>
            ` : `<div style="width: 40px;"></div>`
            }
          </div>
    `;
    }

    function openRecentEditModal(id) {
        const recent = recents.find(r => r.id === id);
        if (!recent) return;

        const content = `
      <div class="modal-section">
        <div class="timer-picker" style="transform: scale(0.8);">
            <div class="picker-col">
                <input type="number" id="modal-hours" class="timer-input" min="0" max="23" value="${recent.hours}">
                    <div class="timer-label">hours</div>
            </div>
            <div class="picker-col">
                <input type="number" id="modal-minutes" class="timer-input" min="0" max="59" value="${recent.minutes}">
                    <div class="timer-label">min</div>
            </div>
            <div class="picker-col">
                <input type="number" id="modal-seconds" class="timer-input" min="0" max="59" value="${recent.seconds}">
                    <div class="timer-label">sec</div>
            </div>
        </div>
      </div>

    <div class="modal-section">
        <div class="modal-row">
            <span>Label</span>
            <input type="text" id="modal-label" value="${escapeHtml(recent.label || '')}" placeholder="Timer" maxlength="200">
        </div>
        <div class="modal-row">
            <span>Sound</span>
            <button id="modal-sound-trigger" class="sound-select-btn" data-sound="${recent.soundId}" title="${getSoundName(recent.soundId)}">
                ${getSoundName(recent.soundId)}
            </button>
            <input type="hidden" id="modal-sound-value" value="${recent.soundId}">
        </div>
    </div>
`;

        showModal({
            title: 'Edit Timer',
            content,
            onSave: (overlay) => {
                const hours = Number(overlay.querySelector('#modal-hours').value);
                const minutes = Number(overlay.querySelector('#modal-minutes').value);
                const seconds = Number(overlay.querySelector('#modal-seconds').value);
                const label = overlay.querySelector('#modal-label').value;
                const soundId = overlay.querySelector('#modal-sound-value').value;

                timerManager.updateRecentTimer(id, { hours, minutes, seconds, label, soundId });
                alarmManager.setLastUsedSound(soundId);
                render();
            }
        });

        setTimeout(() => {
            const overlay = document.querySelector('.modal-overlay');
            if (!overlay) return;

            ['modal-hours', 'modal-minutes', 'modal-seconds'].forEach(id => {
                const input = overlay.querySelector('#' + id);
                const max = id.includes('hours') ? 23 : 59;
                input.oninput = () => {
                    let val = parseInt(input.value);
                    if (val > max) input.value = max;
                    if (val < 0) input.value = 0;
                };
            });
            const soundTrigger = overlay.querySelector('#modal-sound-trigger');
            const soundValue = overlay.querySelector('#modal-sound-value');
            if (soundTrigger) {
                soundTrigger.onclick = () => {
                    openSoundPicker(soundValue.value, (selectedId) => {
                        soundValue.value = selectedId;
                        soundTrigger.textContent = getSoundName(selectedId);
                    });
                };
            }
        }, 100);
    }

    function initRunningView(state) {
        container.innerHTML = `
    <div class="header">
        <button class="edit-btn" id="edit-recents-btn" style="visibility: ${recents.length > 0 ? 'visible' : 'hidden'}">${isEditing ? 'Done' : 'Edit'}</button>
        <h1>Timers</h1>
        <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
      </div>
      <div class="timer-display-container">
        <svg class="progress-ring" width="300" height="300">
          <circle 
            class="progress-ring__circle"
            stroke="var(--accent-orange)"
            stroke-width="8"
            fill="transparent"
            r="${radius}"
            cx="150"
            cy="150"
            style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${circumference};"
          />
        </svg>
        <div class="timer-display-text">${formatTime(state.remainingSeconds)}</div>
      </div>
      <div class="controls">
        <button class="control-btn stop" id="cancel-btn">Cancel</button>
        <button class="control-btn ${state.isPaused ? 'start' : 'pause'}" id="pause-btn">
          ${state.isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      <div class="recents-container"></div>
`;

        updateProgress(state.remainingSeconds, state.totalSeconds);
        container.querySelector('#cancel-btn').onclick = () => timerManager.cancel();
        container.querySelector('#pause-btn').onclick = () => togglePause();
        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());

        // Atualiza recentes e header
        updateRecentsSection();
        updatePickerHeaderState();
    }

    function updateRunningView(state) {
        // Atualiza display e progresso granularmente
        const textDisplay = container.querySelector('.timer-display-text');
        if (textDisplay) textDisplay.textContent = formatTime(state.remainingSeconds);
        updateProgress(state.remainingSeconds, state.totalSeconds);

        // Atualiza botão de pause/resume
        const pauseBtn = container.querySelector('#pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
            pauseBtn.className = `control-btn ${state.isPaused ? 'start' : 'pause'}`;
        }

        // Atualiza header e recentes
        updatePickerHeaderState();
        updateRecentsSection();
    }

    function updateRecentsSection() {
        const recentsContainer = container.querySelector('.recents-container');
        if (!recentsContainer) return;

        if (recents.length === 0) {
            recentsContainer.innerHTML = '';
            return;
        }

        recentsContainer.innerHTML = `
    <div class="recents-section">
              <h2 style="font-size: 18px; margin: 20px 20px 10px; color: var(--text-secondary);">Recents</h2>
              <div class="alarm-list ${isEditing ? 'edit-mode' : ''}">
                  ${recents.map(renderRecentItem).join('')}
              </div>
          </div>
    `;
    }

    function formatTime(totalSecs) {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} `;
        return `${m}:${String(s).padStart(2, '0')} `;
    }

    function start() {
        const h = Number(container.querySelector('#hours').value);
        const m = Number(container.querySelector('#minutes').value);
        const s = Number(container.querySelector('#seconds').value);
        const label = container.querySelector('#timer-label').value || '';
        const soundId = container.querySelector('#timer-sound-value').value;

        alarmManager.setLastUsedSound(soundId);
        timerManager.start(h, m, s, label, soundId);
    }

    function startRecent(id) {
        const recent = recents.find(r => r.id === id);
        if (recent) {
            timerManager.start(recent.hours, recent.minutes, recent.seconds, recent.label, recent.soundId);
        }
    }

    function updateProgress(remaining, total) {
        const circle = container.querySelector('.progress-ring__circle');
        if (circle) {
            const offset = circumference - (remaining / total) * circumference;
            circle.style.strokeDashoffset = offset;
        }
    }

    function togglePause() {
        const state = timerManager.getState();
        if (state.isPaused) {
            timerManager.resume();
        } else {
            timerManager.pause();
        }
    }

    function onTimerUpdated() {
        // render() agora faz atualização granular via mode tracking
        render();
    }

    function onRecentsUpdated() {
        render();
    }

    function onTimerFinished() {
        render();
    }

    document.addEventListener('timer-updated', onTimerUpdated);
    document.addEventListener('recents-updated', onRecentsUpdated);
    document.addEventListener('timer-finished', onTimerFinished);

    render();

    return {
        element: container,
        cleanup: () => {
            document.removeEventListener('timer-updated', onTimerUpdated);
            document.removeEventListener('recents-updated', onRecentsUpdated);
            document.removeEventListener('timer-finished', onTimerFinished);
        }
    };
}
