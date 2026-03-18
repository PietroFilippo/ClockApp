
import { timerManager } from '../modules/TimerManager.js';
import { audioManager } from '../utils/AudioManager.js';
import { showModal } from '../utils/modal.js';
import { showAlert, showConfirm, truncate, confirmDelete } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { openSoundPicker } from '../utils/SoundPicker.js';
import { openSoundSettingsModal } from '../utils/SoundSettingsModal.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS, DEFAULT_SOUND, LIMITS } from '../utils/constants.js';
import { SwipeToDelete } from '../utils/SwipeToDelete.js';
import { formatTime, attachTimeInputValidation } from '../utils/time.js';

export function Timer() {
    const container = document.createElement('div');
    container.className = 'view-container';

    const detailRadius = 140;
    const detailCircumference = detailRadius * 2 * Math.PI;

    // Card ring constantes
    const cardRadius = 18;
    const cardCircumference = cardRadius * 2 * Math.PI;

    let isEditing = false;
    let recents = [];
    let savedTimers = [];
    let selectedRecents = new Set();
    let currentMode = null; 
    let selectedTimerId = null; // qual timer é mostrado na view de detalhes
    let activeTab = localStorage.getItem(STORAGE_KEYS.TIMER_ACTIVE_TAB) || 'recents';

    initDelegatedListeners();

    const swipe = new SwipeToDelete({
        container,
        itemSelector: '.alarm-item',
        onDelete: async (item) => {
            const info = item.querySelector('.recent-item-info');
            if (!info) return;
            const id = info.dataset.id;
            const type = info.dataset.type;
            if (type === 'saved') {
                await confirmAndDeleteSaved(id);
            } else {
                await confirmAndDeleteRecent(id);
            }
        },
        isDisabled: () => isEditing
    });

    function loadRecents() {
        recents = timerManager.getRecents();
    }

    function loadSaved() {
        savedTimers = timerManager.getSaved();
    }

    // Render Principal
    function render() {
        loadRecents();
        loadSaved();
        const activeTimers = timerManager.getAllTimers();

        // Determina qual modo mostrar
        let newMode;
        if (selectedTimerId && timerManager.getTimer(selectedTimerId)) {
            newMode = 'detail';
        } else {
            if (currentMode === 'detail') {
                selectedTimerId = null;
            }
            newMode = 'list';
        }

        if (newMode !== currentMode) {
            currentMode = newMode;
            if (currentMode === 'detail') {
                initDetailView();
            } else {
                initListView();
            }
        } else {
            if (currentMode === 'detail') {
                updateDetailView();
            } else {
                updateListView();
            }
        }
    }

    // Delegated Listeners
    function initDelegatedListeners() {
        container.addEventListener('click', async (e) => {
            const target = e.target;

            // Troca de abas
            if (target.closest('.timer-tab')) {
                const tab = target.closest('.timer-tab');
                const newTab = tab.dataset.tab;
                if (newTab && newTab !== activeTab) {
                    activeTab = newTab;
                    localStorage.setItem(STORAGE_KEYS.TIMER_ACTIVE_TAB, activeTab);
                    isEditing = false;
                    selectedRecents.clear();
                    updateRecentsSection();
                    updateListHeaderState();
                }
                return;
            }

            // Edit Toggle
            if (target.closest('#edit-recents-btn')) {
                if (isEditing && selectedRecents.size > 0) {
                    const count = selectedRecents.size;
                    if (await confirmDelete(`${count} timer${count > 1 ? 's' : ''}`, 'Selected')) {
                        for (const id of selectedRecents) {
                            if (activeTab === 'saved') {
                                timerManager.deleteSavedTimer(id);
                            } else {
                                timerManager.deleteRecentTimer(id);
                            }
                        }
                        selectedRecents.clear();
                        render();
                    }
                } else {
                    isEditing = !isEditing;
                    selectedRecents.clear();
                    updateRecentsSection();
                    updateListHeaderState();
                }
                return;
            }

            // Cancel Edit
            if (target.closest('#cancel-edit-timer-btn')) {
                isEditing = false;
                selectedRecents.clear();
                updateRecentsSection();
                updateListHeaderState();
                return;
            }

            // Checkbox no modo de editar
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
                updateListHeaderState();
                return;
            }

            // Botão play no item recente/salvo
            if (target.closest('.recent-item-play')) {
                e.stopPropagation();
                const btn = target.closest('.recent-item-play');
                const id = btn.dataset.id;
                const type = btn.dataset.type;
                if (type === 'saved') {
                    startSaved(id);
                } else {
                    startRecent(id);
                }
                return;
            }

            // Botão salvar timer (bookmark)
            if (target.closest('.save-timer-btn')) {
                e.stopPropagation();
                const btn = target.closest('.save-timer-btn');
                const id = btn.dataset.id;
                saveRecentTimer(id);
                return;
            }

            // Botão deletar (modo de editar)
            if (target.closest('.delete-recent-btn')) {
                e.stopPropagation();
                const btn = target.closest('.delete-recent-btn');
                const id = btn.dataset.id;
                if (activeTab === 'saved') {
                    await confirmAndDeleteSaved(id);
                } else {
                    await confirmAndDeleteRecent(id);
                }
                return;
            }

            // Botão pause/resume no card
            if (target.closest('.timer-card-btn.pause-resume')) {
                e.stopPropagation();
                const btn = target.closest('.timer-card-btn.pause-resume');
                const timerId = btn.dataset.timerId;
                const timer = timerManager.getTimer(timerId);
                if (timer) {
                    if (timer.isPaused) {
                        timerManager.resume(timerId);
                    } else {
                        timerManager.pause(timerId);
                    }
                }
                return;
            }

            // Botão cancelar no card
            if (target.closest('.timer-card-btn.cancel-timer')) {
                e.stopPropagation();
                const btn = target.closest('.timer-card-btn.cancel-timer');
                const timerId = btn.dataset.timerId;
                timerManager.cancel(timerId);
                return;
            }

            // Vai para a view de detalhes
            if (target.closest('.timer-card') && !target.closest('.timer-card-btn')) {
                const card = target.closest('.timer-card');
                const timerId = card.dataset.timerId;
                if (timerId && timerManager.getTimer(timerId)) {
                    selectedTimerId = timerId;
                    currentMode = null; // force re-init
                    render();
                }
                return;
            }

            // Botão adicionar timer (+)
            if (target.closest('.add-timer-btn')) {
                e.stopPropagation();
                openAddTimerModal();
                return;
            }

            // Botão voltar (view de detalhes)
            if (target.closest('.timer-back-btn')) {
                selectedTimerId = null;
                currentMode = null; // force re-init
                render();
                return;
            }

            // Botão cancelar (view de detalhes)
            if (target.closest('#detail-cancel-btn')) {
                const timerId = selectedTimerId;
                selectedTimerId = null;
                currentMode = null;
                timerManager.cancel(timerId);
                render();
                return;
            }

            // Botão pause/resume (view de detalhes)
            if (target.closest('#detail-pause-btn')) {
                toggleDetailPause();
                return;
            }

            // Click no item recente/salvo (editar ou iniciar)
            const recentInfo = target.closest('.recent-item-info');
            if (recentInfo) {
                const id = recentInfo.dataset.id;
                const type = recentInfo.dataset.type;
                if (isEditing) {
                    openTimerEditModal(id, type === 'saved' ? 'saved' : 'recent');
                } else {
                    if (type === 'saved') {
                        startSaved(id);
                    } else {
                        startRecent(id);
                    }
                }
            }
        });

        container.addEventListener('contextmenu', (e) => {
            const recentInfo = e.target.closest('.recent-item-info');
            if (recentInfo) {
                e.preventDefault();
                const id = recentInfo.dataset.id;
                const type = recentInfo.dataset.type;

                const items = [
                    {
                        label: 'Edit',
                        primary: true,
                        action: () => openTimerEditModal(id, type)
                    },
                    {
                        label: 'Delete',
                        danger: true,
                        action: () => type === 'saved' ? confirmAndDeleteSaved(id) : confirmAndDeleteRecent(id)
                    }
                ];

                if (type === 'recent') {
                    items.splice(1, 0, {
                        label: 'Save',
                        action: () => saveRecentTimer(id)
                    });
                }

                contextMenu.show(e.clientX, e.clientY, items);
            }
        });
    }

    // List View
    function initListView() {
        const activeTimers = timerManager.getAllTimers();
        const hasActiveTimers = activeTimers.length > 0;
        const canAddMore = activeTimers.length < LIMITS.MAX_ACTIVE_TIMERS;
        const hasListItems = activeTab === 'saved' ? savedTimers.length > 0 : recents.length > 0;
        const showEditBtn = hasListItems || hasActiveTimers;

        container.innerHTML = `
      <div class="header">
        <button class="edit-btn" id="edit-recents-btn" style="visibility: ${showEditBtn ? 'visible' : 'hidden'}">${isEditing ? 'Done' : 'Edit'}</button>
        <h1>Timers</h1>
        <div class="add-btn-container" style="display: flex; gap: 10px;">
          <button class="add-btn" id="cancel-edit-timer-btn" style="display: none; font-size: 14px; width: auto; padding: 0 10px;">Cancel</button>
          <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
          <button class="add-timer-btn" title="Add Timer" ${!canAddMore ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="active-timers-section"></div>
      <div class="recents-container"></div>
    `;

        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());

        renderActiveTimers();
        updateRecentsSection();
        updateListHeaderState();
    }

    function updateListView() {
        renderActiveTimers();
        updateListHeaderState();
    }

    function renderActiveTimers() {
        const section = container.querySelector('.active-timers-section');
        if (!section) return;

        const activeTimers = timerManager.getAllTimers();

        if (activeTimers.length === 0) {
            // Mostra o picker inline quando não há timers ativos
            section.innerHTML = renderInlinePicker();
            setupInlinePickerListeners();
            return;
        }

        section.innerHTML = `
      <div class="active-timers-list">
        ${activeTimers.map(timer => renderTimerCard(timer)).join('')}
      </div>
    `;
    }

    function renderTimerCard(timer) {
        const progress = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 0;
        const offset = cardCircumference - progress * cardCircumference;
        const timeStr = formatTime(timer.remainingSeconds);
        const labelStr = escapeHtml(timer.label || 'Timer');
        const pausedClass = timer.isPaused ? 'paused' : '';

        return `
      <div class="timer-card ${pausedClass}" data-timer-id="${timer.id}">
        <div class="timer-card-ring">
          <svg width="44" height="44">
            <circle
              stroke="rgba(255,255,255,0.1)"
              stroke-width="3"
              fill="transparent"
              r="${cardRadius}"
              cx="22"
              cy="22"
            />
            <circle
              class="card-ring-circle"
              stroke="var(--accent-orange)"
              stroke-width="3"
              fill="transparent"
              r="${cardRadius}"
              cx="22"
              cy="22"
              style="stroke-dasharray: ${cardCircumference} ${cardCircumference}; stroke-dashoffset: ${offset};"
            />
          </svg>
        </div>
        <div class="timer-card-info">
          <span class="timer-card-time">${timeStr}</span>
          <span class="timer-card-label" title="${labelStr}">${labelStr}</span>
        </div>
        <div class="timer-card-controls">
          <button class="timer-card-btn pause-resume" data-timer-id="${timer.id}" title="${timer.isPaused ? 'Resume' : 'Pause'}">
            ${timer.isPaused ? '▶' : '⏸'}
          </button>
          <button class="timer-card-btn cancel-timer" data-timer-id="${timer.id}" title="Cancel">✕</button>
        </div>
      </div>
    `;
    }

    function renderInlinePicker() {
        const soundId = localStorage.getItem(STORAGE_KEYS.TIMER_SELECTED_SOUND) || audioManager.getLastUsedSound() || 'default';

        return `
      <div class="timer-picker">
        <div class="picker-col">
           <input type="number" id="hours" class="timer-input" min="0" max="23" value="0">
           <div class="timer-label">hours</div>
        </div>
        <div class="picker-col">
           <input type="number" id="minutes" class="timer-input" min="0" max="59" value="0">
           <div class="timer-label">min</div>
        </div>
        <div class="picker-col">
           <input type="number" id="seconds" class="timer-input" min="0" max="59" value="0">
           <div class="timer-label">sec</div>
        </div>
      </div>

      <div class="modal-section" style="margin: 0 auto 30px;">
          <div class="modal-row">
              <span>Label</span>
              <input type="text" id="timer-label" value="" placeholder="Timer" maxlength="200">
          </div>
          <div class="modal-row">
              <span>When Timer Ends</span>
              <button id="timer-sound-trigger" class="sound-select-btn" data-sound="${soundId}" title="${audioManager.getSoundName(soundId)}">
                  ${audioManager.getSoundName(soundId)}
              </button>
              <input type="hidden" id="timer-sound-value" value="${soundId}">
          </div>
      </div>

      <div class="controls" style="justify-content: center;">
        <button class="control-btn start" id="start-btn">Start</button>
      </div>
    `;
    }

    function setupInlinePickerListeners() {
        const startBtn = container.querySelector('#start-btn');
        if (startBtn) startBtn.onclick = startFromInlinePicker;

        const soundTrigger = container.querySelector('#timer-sound-trigger');
        const soundValue = container.querySelector('#timer-sound-value');
        if (soundTrigger) {
            soundTrigger.onclick = () => {
                openSoundPicker(soundValue.value, (selectedId) => {
                    soundValue.value = selectedId;
                    soundTrigger.textContent = audioManager.getSoundName(selectedId);
                    localStorage.setItem(STORAGE_KEYS.TIMER_SELECTED_SOUND, selectedId);
                });
            };
        }

        const hoursInput = container.querySelector('#hours');
        const minutesInput = container.querySelector('#minutes');
        const secondsInput = container.querySelector('#seconds');

        if (hoursInput) attachTimeInputValidation(hoursInput, 23, { maxDigits: 2 });
        if (minutesInput) attachTimeInputValidation(minutesInput, 59, { maxDigits: 2 });
        if (secondsInput) attachTimeInputValidation(secondsInput, 59, { maxDigits: 2 });
    }

    function startFromInlinePicker() {
        const h = Number(container.querySelector('#hours').value);
        const m = Number(container.querySelector('#minutes').value);
        const s = Number(container.querySelector('#seconds').value);
        const label = container.querySelector('#timer-label').value || '';
        const soundId = container.querySelector('#timer-sound-value').value;

        if (h === 0 && m === 0 && s === 0) return;

        audioManager.setLastUsedSound(soundId);
        timerManager.start(h, m, s, label, soundId);
    }

    function updateListHeaderState() {
        const editBtn = container.querySelector('#edit-recents-btn');
        if (editBtn) {
            if (isEditing && selectedRecents.size > 0) {
                editBtn.textContent = `Delete (${selectedRecents.size})`;
                editBtn.style.color = 'var(--accent-red)';
            } else {
                editBtn.textContent = isEditing ? 'Done' : 'Edit';
                editBtn.style.color = '';
            }
            const hasActive = timerManager.getActiveTimerCount() > 0;
            const hasItems = activeTab === 'saved' ? savedTimers.length > 0 : recents.length > 0;
            editBtn.style.visibility = (hasItems || hasActive) ? 'visible' : 'hidden';
        }
        const audioBtn = container.querySelector('#audio-settings-btn');
        const cancelBtn = container.querySelector('#cancel-edit-timer-btn');
        if (audioBtn) audioBtn.style.display = isEditing ? 'none' : '';
        if (cancelBtn) cancelBtn.style.display = isEditing ? '' : 'none';

        const addBtn = container.querySelector('.add-timer-btn');
        if (addBtn) {
            const activeTimers = timerManager.getAllTimers();
            addBtn.disabled = activeTimers.length >= LIMITS.MAX_ACTIVE_TIMERS;
            addBtn.style.display = activeTimers.length > 0 ? '' : 'none';
        }
    }

    // Detail View
    function initDetailView() {
        const timer = timerManager.getTimer(selectedTimerId);
        if (!timer) {
            selectedTimerId = null;
            currentMode = null;
            render();
            return;
        }

        container.innerHTML = `
      <div class="header">
        <button class="timer-back-btn">← Back</button>
        <h1>Timers</h1>
        <div class="add-btn-container" style="display: flex; gap: 10px;">
          <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
        </div>
      </div>
      <div class="timer-detail-label">${escapeHtml(timer.label || 'Timer')}</div>
      <div class="timer-display-container">
        <svg class="progress-ring" width="300" height="300">
          <circle
            class="progress-ring__circle"
            stroke="var(--accent-orange)"
            stroke-width="8"
            fill="transparent"
            r="${detailRadius}"
            cx="150"
            cy="150"
            style="stroke-dasharray: ${detailCircumference} ${detailCircumference}; stroke-dashoffset: ${detailCircumference};"
          />
        </svg>
        <div class="timer-display-text">${formatTime(timer.remainingSeconds)}</div>
      </div>
      <div class="controls">
        <button class="control-btn stop" id="detail-cancel-btn">Cancel</button>
        <button class="control-btn ${timer.isPaused ? 'start' : 'pause'}" id="detail-pause-btn">
          ${timer.isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    `;

        updateDetailProgress(timer.remainingSeconds, timer.totalSeconds);
        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());
    }

    function updateDetailView() {
        const timer = timerManager.getTimer(selectedTimerId);
        if (!timer) {
            // Timer foi cancelado ou terminou — volta para a lista
            selectedTimerId = null;
            currentMode = null;
            render();
            return;
        }

        const textDisplay = container.querySelector('.timer-display-text');
        if (textDisplay) textDisplay.textContent = formatTime(timer.remainingSeconds);
        updateDetailProgress(timer.remainingSeconds, timer.totalSeconds);

        const pauseBtn = container.querySelector('#detail-pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = timer.isPaused ? 'Resume' : 'Pause';
            pauseBtn.className = `control-btn ${timer.isPaused ? 'start' : 'pause'}`;
        }
    }

    function updateDetailProgress(remaining, total) {
        const circle = container.querySelector('.progress-ring__circle');
        if (circle) {
            const offset = detailCircumference - (remaining / total) * detailCircumference;
            circle.style.strokeDashoffset = offset;
        }
    }

    function toggleDetailPause() {
        const timer = timerManager.getTimer(selectedTimerId);
        if (!timer) return;

        if (timer.isPaused) {
            timerManager.resume(selectedTimerId);
        } else {
            timerManager.pause(selectedTimerId);
        }
    }

    // Adiciona Timer Modal
    function openAddTimerModal() {
        const soundId = localStorage.getItem(STORAGE_KEYS.TIMER_SELECTED_SOUND) || audioManager.getLastUsedSound() || 'default';

        const content = `
      <div class="timer-picker" style="transform: scale(0.8);">
        <div class="picker-col">
           <input type="number" id="modal-hours" class="timer-input" min="0" max="23" value="0">
           <div class="timer-label">hours</div>
        </div>
        <div class="picker-col">
           <input type="number" id="modal-minutes" class="timer-input" min="0" max="59" value="0">
           <div class="timer-label">min</div>
        </div>
        <div class="picker-col">
           <input type="number" id="modal-seconds" class="timer-input" min="0" max="59" value="0">
           <div class="timer-label">sec</div>
        </div>
      </div>

      <div class="modal-section">
          <div class="modal-row">
              <span>Label</span>
              <input type="text" id="modal-label" value="" placeholder="Timer" maxlength="200">
          </div>
          <div class="modal-row">
              <span>When Timer Ends</span>
              <button id="modal-sound-trigger" class="sound-select-btn" data-sound="${soundId}" title="${audioManager.getSoundName(soundId)}">
                  ${audioManager.getSoundName(soundId)}
              </button>
              <input type="hidden" id="modal-sound-value" value="${soundId}">
          </div>
      </div>
    `;

        const overlay = showModal({
            title: 'New Timer',
            content,
            onSave: (ov) => {
                const h = Number(ov.querySelector('#modal-hours').value);
                const m = Number(ov.querySelector('#modal-minutes').value);
                const s = Number(ov.querySelector('#modal-seconds').value);
                const label = ov.querySelector('#modal-label').value || '';
                const soundId = ov.querySelector('#modal-sound-value').value;

                if (h === 0 && m === 0 && s === 0) return;

                audioManager.setLastUsedSound(soundId);
                localStorage.setItem(STORAGE_KEYS.TIMER_SELECTED_SOUND, soundId);
                timerManager.start(h, m, s, label, soundId);
            }
        });

        ['modal-hours', 'modal-minutes', 'modal-seconds'].forEach(inputId => {
            const input = overlay.querySelector('#' + inputId);
            const max = inputId.includes('hours') ? 23 : 59;
            attachTimeInputValidation(input, max);
        });

        const soundTrigger = overlay.querySelector('#modal-sound-trigger');
        const soundValue = overlay.querySelector('#modal-sound-value');
        if (soundTrigger) {
            soundTrigger.onclick = () => {
                openSoundPicker(soundValue.value, (selectedId) => {
                    soundValue.value = selectedId;
                    soundTrigger.textContent = audioManager.getSoundName(selectedId);
                });
            };
        }
    }

    // Recents / Saved
    async function confirmAndDeleteRecent(id) {
        const recent = recents.find(r => r.id === id);
        const label = recent ? (recent.label || 'Timer') : 'this timer';
        if (await confirmDelete(label, 'Recent Timer')) {
            timerManager.deleteRecentTimer(id);
            render();
        }
    }

    async function confirmAndDeleteSaved(id) {
        const saved = savedTimers.find(s => s.id === id);
        const label = saved ? (saved.label || 'Timer') : 'this timer';
        if (await confirmDelete(label, 'Saved Timer')) {
            timerManager.deleteSavedTimer(id);
            render();
        }
    }

    function saveRecentTimer(id) {
        const recent = recents.find(r => r.id === id);
        if (!recent) return;

        loadSaved();
        if (savedTimers.length >= LIMITS.MAX_TIMER_SAVED) {
            openReplaceModal({
                hours: recent.hours,
                minutes: recent.minutes,
                seconds: recent.seconds,
                label: recent.label,
                soundId: recent.soundId,
            });
            return;
        }

        const result = timerManager.addSavedTimer(recent);
        if (result.success) {
            showAlert('Timer saved!', 'Success');
            render();
        }
    }

    function startSaved(id) {
        const saved = savedTimers.find(s => s.id === id);
        if (saved) {
            timerManager.start(saved.hours, saved.minutes, saved.seconds, saved.label, saved.soundId);
        }
    }

    function startRecent(id) {
        const recent = recents.find(r => r.id === id);
        if (recent) {
            timerManager.start(recent.hours, recent.minutes, recent.seconds, recent.label, recent.soundId);
        }
    }

    function renderTimerItem(timer, type = 'recent') {
        const totalSecs = (timer.hours || 0) * 3600 + (timer.minutes || 0) * 60 + (timer.seconds || 0);
        const timeString = formatTime(totalSecs);
        const isSaved = type === 'saved';

        return `
          <div class="alarm-item recent-item swipe-container ${selectedRecents.has(timer.id) ? 'selected' : ''}" style="position:relative;">
            <div class="swipe-content">
              ${isEditing ? `<button class="delete-clock-btn delete-recent-btn" data-id="${timer.id}">−</button><input type="checkbox" class="select-checkbox" data-id="${timer.id}" ${selectedRecents.has(timer.id) ? 'checked' : ''}>` : ''}
              <div class="alarm-info recent-item-info" data-id="${timer.id}" data-type="${type}" style="padding-left: ${isEditing ? '40px' : '0'}; transition: padding 0.3s; cursor: pointer; width: 100%;">
                <span class="alarm-time" style="font-size: 32px;">${timeString}</span>
                <span class="alarm-label" title="${escapeHtml(timer.label || 'Timer')}">${escapeHtml(timer.label || 'Timer')}</span>
              </div>
              ${!isEditing ? `
                  <div style="display: flex; align-items: center; gap: 6px;">
                    ${!isSaved ? `<button class="save-timer-btn" data-id="${timer.id}" title="Save Timer">★</button>` : ''}
                    <button class="control-btn start recent-item-play" data-id="${timer.id}" data-type="${type}" style="width: 40px; height: 40px; min-width: 40px; padding: 0 0 0 3px; display: flex; align-items: center; justify-content: center;">
                      ▶
                    </button>
                  </div>
              ` : `<div style="width: 40px;"></div>`
            }
            </div>
            <button class="swipe-delete-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
          </div>
    `;
    }

    function openTimerEditModal(id, type) {
        const isSaved = type === 'saved';
        const timer = isSaved
            ? savedTimers.find(s => s.id === id)
            : recents.find(r => r.id === id);
        if (!timer) return;

        const content = `
      <div class="modal-section">
        <div class="timer-picker" style="transform: scale(0.8);">
            <div class="picker-col">
                <input type="number" id="modal-hours" class="timer-input" min="0" max="23" value="${timer.hours}">
                    <div class="timer-label">hours</div>
            </div>
            <div class="picker-col">
                <input type="number" id="modal-minutes" class="timer-input" min="0" max="59" value="${timer.minutes}">
                    <div class="timer-label">min</div>
            </div>
            <div class="picker-col">
                <input type="number" id="modal-seconds" class="timer-input" min="0" max="59" value="${timer.seconds}">
                    <div class="timer-label">sec</div>
            </div>
        </div>
      </div>

    <div class="modal-section">
        <div class="modal-row">
            <span>Label</span>
            <input type="text" id="modal-label" value="${escapeHtml(timer.label || '')}" placeholder="Timer" maxlength="200">
        </div>
        <div class="modal-row">
            <span>Sound</span>
            <button id="modal-sound-trigger" class="sound-select-btn" data-sound="${timer.soundId}" title="${audioManager.getSoundName(timer.soundId)}">
                ${audioManager.getSoundName(timer.soundId)}
            </button>
            <input type="hidden" id="modal-sound-value" value="${timer.soundId}">
        </div>
    </div>
`;

        const overlay = showModal({
            title: isSaved ? 'Edit Saved Timer' : 'Edit Timer',
            content,
            onSave: (ov) => {
                const hours = Number(ov.querySelector('#modal-hours').value);
                const minutes = Number(ov.querySelector('#modal-minutes').value);
                const seconds = Number(ov.querySelector('#modal-seconds').value);
                const label = ov.querySelector('#modal-label').value;
                const soundId = ov.querySelector('#modal-sound-value').value;

                if (isSaved) {
                    timerManager.updateSavedTimer(id, { hours, minutes, seconds, label, soundId });
                } else {
                    timerManager.updateRecentTimer(id, { hours, minutes, seconds, label, soundId });
                }
                audioManager.setLastUsedSound(soundId);
                render();
            }
        });

        ['modal-hours', 'modal-minutes', 'modal-seconds'].forEach(inputId => {
            const input = overlay.querySelector('#' + inputId);
            const max = inputId.includes('hours') ? 23 : 59;
            attachTimeInputValidation(input, max);
        });
        const soundTrigger = overlay.querySelector('#modal-sound-trigger');
        const soundValue = overlay.querySelector('#modal-sound-value');
        if (soundTrigger) {
            soundTrigger.onclick = () => {
                openSoundPicker(soundValue.value, (selectedId) => {
                    soundValue.value = selectedId;
                    soundTrigger.textContent = audioManager.getSoundName(selectedId);
                });
            };
        }
    }

    function openReplaceModal(newTimer) {
        loadSaved();
        const content = `
            <div style="text-align: center; padding: 10px 0;">
                <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
                <h3 style="margin-bottom: 10px;">Replace Timer</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Saved timers are full (${LIMITS.MAX_TIMER_SAVED}/${LIMITS.MAX_TIMER_SAVED}).<br>Choose a timer to replace:</p>
            </div>
            <div class="replace-timer-list" style="max-height: 300px; overflow-y: auto;">
                ${savedTimers.map(s => {
            const totalSecs = (s.hours || 0) * 3600 + (s.minutes || 0) * 60 + (s.seconds || 0);
            return `
                        <div class="replace-item" data-id="${s.id}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 12px; cursor: pointer;">
                            <div class="alarm-info">
                                <span class="alarm-time" style="font-size: 20px;">${formatTime(totalSecs)}</span>
                                <span class="alarm-label" style="font-size: 14px;">${escapeHtml(s.label || 'Timer')}</span>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        const overlay = showModal({
            title: 'Replace Saved Timer',
            content,
            onSave: () => { }
        });

        const saveBtn = overlay.querySelector('.save');
        if (saveBtn) saveBtn.style.display = 'none';

        overlay.querySelectorAll('.replace-item').forEach(item => {
            item.onclick = () => {
                const oldId = item.dataset.id;
                timerManager.replaceSavedTimer(oldId, newTimer);
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                showAlert('Timer replaced!', 'Success');
                render();
            };
        });
    }

    function updateRecentsSection() {
        const recentsContainer = container.querySelector('.recents-container');
        if (!recentsContainer) return;

        loadRecents();
        loadSaved();

        const hasRecents = recents.length > 0;
        const hasSaved = savedTimers.length > 0;

        if (!hasRecents && !hasSaved) {
            recentsContainer.innerHTML = '';
            return;
        }

        const currentItems = activeTab === 'saved' ? savedTimers : recents;
        const itemType = activeTab === 'saved' ? 'saved' : 'recent';
        const currentItemsHTML = currentItems.length > 0
            ? currentItems.map(item => renderTimerItem(item, itemType)).join('')
            : `<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">${activeTab === 'saved' ? 'No saved timers' : 'No recent timers'}</p>`;

        recentsContainer.innerHTML = `
    <div class="recents-section">
              <div class="timer-tabs">
                  <button class="timer-tab ${activeTab === 'recents' ? 'active' : ''}" data-tab="recents">Recents</button>
                  <button class="timer-tab ${activeTab === 'saved' ? 'active' : ''}" data-tab="saved">Saved${hasSaved ? ` (${savedTimers.length})` : ''}</button>
              </div>
              <div class="alarm-list ${isEditing ? 'edit-mode' : ''}">
                  ${currentItemsHTML}
              </div>
          </div>
    `;
    }

    // Event Listeners
    function onTimersTick() {
        if (currentMode === 'detail') {
            updateDetailView();
        } else if (currentMode === 'list') {
            updateActiveTimerCards();
        }
    }

    function updateActiveTimerCards() {
        const activeTimers = timerManager.getAllTimers();
        const cards = container.querySelectorAll('.timer-card');

        // Se a contagem mudou, renderiza completamente
        if (cards.length !== activeTimers.length) {
            renderActiveTimers();
            updateListHeaderState();
            return;
        }

        // Atualiza cada card no lugar
        for (const timer of activeTimers) {
            const card = container.querySelector(`.timer-card[data-timer-id="${timer.id}"]`);
            if (!card) {
                // Timer não encontrado no DOM, renderiza novamente
                renderActiveTimers();
                updateListHeaderState();
                return;
            }

            const timeEl = card.querySelector('.timer-card-time');
            if (timeEl) timeEl.textContent = formatTime(timer.remainingSeconds);

            const ringCircle = card.querySelector('.card-ring-circle');
            if (ringCircle) {
                const progress = timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 0;
                const offset = cardCircumference - progress * cardCircumference;
                ringCircle.style.strokeDashoffset = offset;
            }

            // Atualiza estado de pausa
            card.classList.toggle('paused', timer.isPaused);
            const pauseBtn = card.querySelector('.pause-resume');
            if (pauseBtn) {
                pauseBtn.innerHTML = timer.isPaused ? '▶' : '⏸';
                pauseBtn.title = timer.isPaused ? 'Resume' : 'Pause';
            }
        }
    }

    function onTimerAdded() {
        render();
    }

    function onTimerRemoved(e) {
        const { timerId } = e.detail;
        if (currentMode === 'detail' && selectedTimerId === timerId) {
            selectedTimerId = null;
            currentMode = null;
        }
        render();
    }

    function onTimerFinished(e) {
        const { timerId } = e.detail;
        if (currentMode === 'detail' && selectedTimerId === timerId) {
            selectedTimerId = null;
            currentMode = null;
        }
        render();
    }

    function onRecentsUpdated() {
        loadRecents();
        updateRecentsSection();
    }

    function onSavedUpdated() {
        loadSaved();
        updateRecentsSection();
    }

    // Registra eventos
    document.addEventListener('timers-tick', onTimersTick);
    document.addEventListener('timer-added', onTimerAdded);
    document.addEventListener('timer-removed', onTimerRemoved);
    document.addEventListener('timer-finished', onTimerFinished);
    document.addEventListener('recents-updated', onRecentsUpdated);
    document.addEventListener('saved-updated', onSavedUpdated);

    render();

    return {
        element: container,
        cleanup: () => {
            document.removeEventListener('timers-tick', onTimersTick);
            document.removeEventListener('timer-added', onTimerAdded);
            document.removeEventListener('timer-removed', onTimerRemoved);
            document.removeEventListener('timer-finished', onTimerFinished);
            document.removeEventListener('recents-updated', onRecentsUpdated);
            document.removeEventListener('saved-updated', onSavedUpdated);
            swipe.destroy();
        }
    };
}
