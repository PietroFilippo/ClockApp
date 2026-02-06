import { alarmManager } from '../modules/AlarmManager.js';
import { timerManager } from '../modules/TimerManager.js';
import { showModal } from '../utils/modal.js';
import { showAlert, showConfirm, truncate } from '../utils/notification.js';
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

    function loadRecents() {
        recents = timerManager.getRecents();
    }

    function render() {
        loadRecents();
        const state = timerManager.getState();
        if (state.isRunning || state.isPaused) {
            renderRunning(state);
        } else {
            renderPicker(state);
        }
    }

    function attachRecentsListeners() {
        const editBtn = container.querySelector('#edit-recents-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                isEditing = !isEditing;
                render();
            };
        }

        container.querySelectorAll('.recent-item-play').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                startRecent(id);
            };
        });

        container.querySelectorAll('.recent-item-info').forEach(item => {
            item.onclick = (e) => {
                if (isEditing) {
                    const id = e.currentTarget.dataset.id;
                    openRecentEditModal(id);
                } else {
                    const id = e.currentTarget.dataset.id;
                    startRecent(id);
                }
            };

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = e.currentTarget.dataset.id;
                // const recent = recents.find(r => r.id === id); // util para o label do menu de contexto.

                contextMenu.show(e.clientX, e.clientY, [
                    {
                        label: 'Edit',
                        primary: true,
                        action: () => openRecentEditModal(id)
                    },
                    {
                        label: 'Delete',
                        danger: true,
                        action: async () => {
                            const recent = recents.find(r => r.id === id);
                            const label = recent ? (recent.label || 'Timer') : 'this timer';
                            const truncatedLabel = truncate(label, 60);
                            const msg = `Delete "<span title="${label.replace(/"/g, '&quot;')}">${truncatedLabel}</span>" from recents?`;
                            if (await showConfirm(msg, 'Delete Recent')) {
                                timerManager.deleteRecentTimer(id);
                                render();
                            }
                        }
                    }
                ]);
            });
        });

        container.querySelectorAll('.delete-recent-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                const recent = recents.find(r => r.id === id);
                const label = recent ? (recent.label || 'Timer') : 'this timer';
                const truncatedLabel = truncate(label, 60);
                const msg = `Delete "<span title="${label.replace(/"/g, '&quot;')}">${truncatedLabel}</span>" from recents?`;
                if (await showConfirm(msg, 'Delete Recent')) {
                    timerManager.deleteRecentTimer(id);
                    render();
                }
            };
        });
    }

    function renderPicker(state) {
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
              <input type="text" id="timer-label" value="${state.label || ''}" placeholder="Timer" maxlength="200">
          </div>
          <div class="modal-row">
              <span>When Timer Ends</span>
              <button id="timer-sound-trigger" class="sound-select-btn" data-sound="${state.soundId || alarmManager.getLastUsedSound()}" title="${getSoundName(state.soundId || alarmManager.getLastUsedSound())}">
                  ${getSoundName(state.soundId || alarmManager.getLastUsedSound())}
              </button>
              <input type="hidden" id="timer-sound-value" value="${state.soundId || alarmManager.getLastUsedSound()}">
          </div>
      </div>

      <div class="controls" style="justify-content: center;">
        <button class="control-btn start" id="start-btn">Start</button>
      </div>

      ${renderRecentsSection()}
`;
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

        attachRecentsListeners();
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
          <div class="alarm-item recent-item" style="position:relative;">
            ${isEditing ? `<button class="delete-clock-btn delete-recent-btn" data-id="${recent.id}">−</button>` : ''}
            <div class="alarm-info recent-item-info" data-id="${recent.id}" style="padding-left: ${isEditing ? '40px' : '0'}; transition: padding 0.3s; cursor: pointer; width: 100%;">
              <span class="alarm-time" style="font-size: 32px;">${timeString}</span>
              <span class="alarm-label" title="${recent.label || 'Timer'}">${recent.label || 'Timer'}</span>
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
            <input type="text" id="modal-label" value="${recent.label || ''}" placeholder="Timer" maxlength="200">
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



    function renderRunning(state) {
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

      ${renderRecentsSection()}
`;

        updateProgress(state.remainingSeconds, state.totalSeconds);
        container.querySelector('#cancel-btn').onclick = () => timerManager.cancel();
        container.querySelector('#pause-btn').onclick = () => togglePause();
        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());

        attachRecentsListeners();
    }

    function renderRecentsSection() {
        if (recents.length === 0) return '';
        return `
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
        const state = timerManager.getState();

        if (!state.isRunning && !state.isPaused) {
            render();
            return;
        }

        const textDisplay = container.querySelector('.timer-display-text');
        const circle = container.querySelector('.progress-ring__circle');
        const pauseBtn = container.querySelector('#pause-btn');

        if (textDisplay && circle && pauseBtn) {
            textDisplay.textContent = formatTime(state.remainingSeconds);
            updateProgress(state.remainingSeconds, state.totalSeconds);

            pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
            pauseBtn.className = `control-btn ${state.isPaused ? 'start' : 'pause'}`;
        } else {
            render();
        }
    }

    function onRecentsUpdated() {
        if (!isEditing) { // Opicional: não atualiza a interface enquanto está editando
            render();
        } else {
            // mesmo assim atualiza a interface
            render();
        }
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
