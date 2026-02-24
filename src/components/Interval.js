import { alarmManager } from '../modules/AlarmManager.js';
import { audioManager } from '../utils/AudioManager.js';
import { showModal } from '../utils/modal.js';
import { showAlert, confirmDelete } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { openSoundPicker } from '../utils/SoundPicker.js';
import { openSoundSettingsModal } from '../utils/SoundSettingsModal.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS, DEFAULT_SOUND, LIMITS } from '../utils/constants.js';
import { SwipeToDelete } from '../utils/SwipeToDelete.js';
import { intervalTimerManager } from '../modules/IntervalTimerManager.js';
import { formatTime } from '../utils/time.js';

export function Interval() {
    const container = document.createElement('div');
    container.className = 'view-container';

    const radius = 140;
    const circumference = radius * 2 * Math.PI;

    let isEditing = false;
    let selectedPresets = new Set();
    let currentMode = null; // 'picker' | 'running'

    // Estado do draft (criação de intervalo)
    let draftSteps = [];
    let draftPickerHours = 0;
    let draftPickerMinutes = 5;
    let draftPickerSeconds = 0;
    let draftLabel = '';

    function loadDraft() {
        const saved = localStorage.getItem(STORAGE_KEYS.INTERVAL_DRAFT_STATE);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                draftSteps = state.steps || [];
                draftPickerHours = state.hours ?? 0;
                draftPickerMinutes = state.minutes ?? 5;
                draftPickerSeconds = state.seconds ?? 0;
                draftLabel = state.label || '';
            } catch (e) {
                console.error('Failed to parse interval draft', e);
            }
        }
    }

    function saveDraft() {
        const state = {
            steps: draftSteps,
            hours: draftPickerHours,
            minutes: draftPickerMinutes,
            seconds: draftPickerSeconds,
            label: draftLabel
        };
        localStorage.setItem(STORAGE_KEYS.INTERVAL_DRAFT_STATE, JSON.stringify(state));
    }

    // Carrega o rascunho antes da renderização
    loadDraft();

    initDelegatedListeners();

    const swipe = new SwipeToDelete({
        container,
        itemSelector: '.alarm-item',
        onDelete: (item) => {
            const info = item.querySelector('.recent-item-info');
            if (info) {
                const id = info.dataset.id;
                confirmAndDeletePreset(id);
            }
        },
        isDisabled: () => isEditing
    });

    // listeners delegados
    function initDelegatedListeners() {
        container.addEventListener('click', async (e) => {
            const target = e.target;

            // Alterna edit
            if (target.closest('#edit-intervals-btn')) {
                if (isEditing && selectedPresets.size > 0) {
                    const count = selectedPresets.size;
                    if (await confirmDelete(`${count} interval${count > 1 ? 's' : ''}`, 'Selected')) {
                        for (const id of selectedPresets) {
                            intervalTimerManager.deletePreset(id);
                        }
                        selectedPresets.clear();
                        render();
                    }
                } else {
                    isEditing = !isEditing;
                    selectedPresets.clear();
                    render();
                }
                return;
            }

            // Cancela edit
            if (target.closest('#cancel-edit-interval-btn')) {
                isEditing = false;
                selectedPresets.clear();
                render();
                return;
            }

            // Checkbox
            if (target.classList.contains('select-checkbox')) {
                e.stopPropagation();
                const id = target.dataset.id;
                if (target.checked) {
                    selectedPresets.add(id);
                } else {
                    selectedPresets.delete(id);
                }
                const item = target.closest('.alarm-item');
                if (item) item.classList.toggle('selected', target.checked);
                updateHeaderState();
                return;
            }

            // Botão de play
            if (target.closest('.recent-item-play')) {
                e.stopPropagation();
                const btn = target.closest('.recent-item-play');
                const id = btn.dataset.id;
                startPreset(id);
                return;
            }

            // Botão delete (modo edit)
            if (target.closest('.delete-recent-btn')) {
                e.stopPropagation();
                const btn = target.closest('.delete-recent-btn');
                const id = btn.dataset.id;
                await confirmAndDeletePreset(id);
                return;
            }

            // Clique no item info (edit ou play)
            const itemInfo = target.closest('.recent-item-info');
            if (itemInfo) {
                const id = itemInfo.dataset.id;
                if (isEditing) {
                    openEditModal(id);
                } else {
                    startPreset(id);
                }
            }
        });

        container.addEventListener('contextmenu', (e) => {
            const itemInfo = e.target.closest('.recent-item-info');
            if (itemInfo) {
                e.preventDefault();
                const id = itemInfo.dataset.id;
                contextMenu.show(e.clientX, e.clientY, [
                    { label: 'Edit', primary: true, action: () => openEditModal(id) },
                    { label: 'Delete', danger: true, action: () => confirmAndDeletePreset(id) }
                ]);
            }
        });
    }

    // Funcionalidades core
    function startPreset(id) {
        const presets = intervalTimerManager.getPresets();
        const preset = presets.find(p => p.id === id);
        if (!preset) return;
        intervalTimerManager.start(preset.steps, preset.soundId, preset.label, preset.id);
    }

    async function confirmAndDeletePreset(id) {
        const presets = intervalTimerManager.getPresets();
        const preset = presets.find(p => p.id === id);
        if (!preset) return;
        if (await confirmDelete(preset.label || 'Interval', 'Interval')) {
            intervalTimerManager.deletePreset(id);
            render();
        }
    }

    function openEditModal(id) {
        const presets = intervalTimerManager.getPresets();
        const preset = presets.find(p => p.id === id);
        if (!preset) return;

        let editSteps = preset.steps.map(s => ({ ...s }));

        function renderEditSteps(overlay) {
            const listEl = overlay.querySelector('#modal-steps-list');
            const totalEl = overlay.querySelector('#modal-steps-total');
            if (!listEl) return;

            listEl.innerHTML = editSteps.map((step, i) => {
                const totalSecs = (step.hours || 0) * 3600 + (step.minutes || 0) * 60 + (step.seconds || 0);
                return `
                    <div class="interval-step-item" style="padding: 8px 0;">
                        <span class="interval-step-number">${i + 1}</span>
                        <div class="interval-step-info" style="flex: 1;">
                            <div class="interval-step-label">${escapeHtml(step.label || `Step ${i + 1}`)}</div>
                            <div class="interval-step-time">${formatTime(totalSecs)}</div>
                        </div>
                        <button class="interval-step-delete modal-step-delete" data-idx="${i}" title="Remove" style="background: none; border: none; color: var(--accent-red); font-size: 18px; cursor: pointer; padding: 4px 8px;">✕</button>
                    </div>
                `;
            }).join('');

            if (totalEl) {
                const totalSecs = intervalTimerManager.getTotalTime(editSteps);
                totalEl.textContent = `${editSteps.length} step${editSteps.length !== 1 ? 's' : ''} · ${formatTime(totalSecs)}`;
            }

            listEl.querySelectorAll('.modal-step-delete').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx);
                    editSteps.splice(idx, 1);
                    renderEditSteps(overlay);
                };
            });
        }

        const content = `
          <div class="modal-section">
              <div class="modal-row">
                  <span>Name</span>
                  <input type="text" id="modal-interval-name" value="${escapeHtml(preset.label || '')}" placeholder="Interval name" maxlength="200">
              </div>
              <div class="modal-row">
                  <span>Sound</span>
                  <button id="modal-sound-trigger" class="sound-select-btn" data-sound="${preset.soundId}" title="${getSoundName(preset.soundId)}">
                      ${getSoundName(preset.soundId)}
                  </button>
                  <input type="hidden" id="modal-sound-value" value="${preset.soundId}">
              </div>
          </div>
          <div class="modal-section" style="padding: 12px 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 600;">Steps</span>
                  <span id="modal-steps-total" style="color:var(--text-secondary); font-size:13px;"></span>
              </div>
              <div id="modal-steps-list" style="max-height: 200px; overflow-y: auto;"></div>
          </div>
          <div class="modal-section" style="padding: 12px 15px;">
              <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                  <input type="number" id="modal-new-h" min="0" max="23" value="0" style="width: 60px; text-align: center; padding: 8px 4px; font-size: 15px; border-radius: 8px;" placeholder="H">
                  <span>:</span>
                  <input type="number" id="modal-new-m" min="0" max="59" value="5" style="width: 60px; text-align: center; padding: 8px 4px; font-size: 15px; border-radius: 8px;" placeholder="M">
                  <span>:</span>
                  <input type="number" id="modal-new-s" min="0" max="59" value="0" style="width: 60px; text-align: center; padding: 8px 4px; font-size: 15px; border-radius: 8px;" placeholder="S">
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                  <input type="text" id="modal-new-label" placeholder="Step name" maxlength="200" style="flex: 1; padding: 8px; font-size: 14px; border-radius: 8px;">
                  <button id="modal-add-step-btn" style="background: rgba(255,159,10,0.2); color: var(--accent-orange); border: none; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 14px; white-space: nowrap;">Add</button>
              </div>
          </div>
        `;

        showModal({
            title: 'Edit Interval',
            content,
            onSave: (overlay) => {
                if (editSteps.length === 0) {
                    showAlert('Add at least one step.', 'Invalid');
                    return false;
                }
                const name = overlay.querySelector('#modal-interval-name').value || 'Interval';
                const soundId = overlay.querySelector('#modal-sound-value').value;
                intervalTimerManager.updatePreset(id, { label: name, soundId, steps: editSteps });
                render();
            }
        });

        setTimeout(() => {
            const overlay = document.querySelector('.modal-overlay');
            if (!overlay) return;

            renderEditSteps(overlay);

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

            const addStepBtn = overlay.querySelector('#modal-add-step-btn');
            if (addStepBtn) {
                addStepBtn.onclick = () => {
                    if (editSteps.length >= LIMITS.MAX_INTERVAL_STEPS) {
                        showAlert(`Maximum of ${LIMITS.MAX_INTERVAL_STEPS} steps.`, 'Limit');
                        return;
                    }
                    const h = Number(overlay.querySelector('#modal-new-h').value);
                    const m = Number(overlay.querySelector('#modal-new-m').value);
                    const s = Number(overlay.querySelector('#modal-new-s').value);
                    if (h * 3600 + m * 60 + s <= 0) {
                        showAlert('Set a time greater than 0.', 'Invalid');
                        return;
                    }
                    const label = overlay.querySelector('#modal-new-label').value || '';
                    editSteps.push({ hours: h, minutes: m, seconds: s, label });
                    overlay.querySelector('#modal-new-label').value = '';
                    renderEditSteps(overlay);
                };
            }
        }, 100);
    }

    function openReplaceModal(newPreset) {
        const presets = intervalTimerManager.getPresets();
        const content = `
            <div style="text-align: center; padding: 10px 0;">
                <div style="font-size: 40px; margin-bottom: 10px;">⚠️</div>
                <h3 style="margin-bottom: 10px;">Replace Interval</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">Saved Intervals are full (${LIMITS.MAX_INTERVAL_PRESETS}/${LIMITS.MAX_INTERVAL_PRESETS}).<br>Choose an interval to replace:</p>
            </div>
            <div class="replace-timer-list" style="max-height: 300px; overflow-y: auto;">
                ${presets.map(s => {
            const totalSecs = intervalTimerManager.getTotalTime(s.steps);
            const stepCount = s.steps.length;
            return `
                        <div class="replace-item" data-id="${s.id}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 12px; cursor: pointer;">
                            <div class="alarm-info">
                                <span class="alarm-time" style="font-size: 20px;">${escapeHtml(s.label || 'Interval')}</span>
                                <span class="alarm-label" style="font-size: 14px;">${stepCount} step${stepCount !== 1 ? 's' : ''} · ${formatTime(totalSecs)}</span>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        showModal({
            title: 'Replace Saved Interval',
            content,
            onSave: () => { }
        });

        setTimeout(() => {
            const overlay = document.querySelector('.modal-overlay');
            if (!overlay) return;

            const saveBtn = overlay.querySelector('.save');
            if (saveBtn) saveBtn.style.display = 'none';

            overlay.querySelectorAll('.replace-item').forEach(item => {
                item.onclick = () => {
                    const oldId = item.dataset.id;
                    intervalTimerManager.replacePreset(oldId, newPreset);
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                    showAlert('Interval replaced!', 'Success');

                    draftSteps = [];
                    draftLabel = '';
                    saveDraft();

                    render();
                };
            });
        }, 100);
    }

    // Render
    function render() {
        const state = intervalTimerManager.getState();

        let newMode;
        if (state.isRunning || state.isPaused) {
            newMode = 'running';
        } else {
            newMode = 'picker';
        }

        if (newMode !== currentMode) {
            currentMode = newMode;
            if (currentMode === 'running') {
                initRunningView(state);
            } else {
                initPickerView();
            }
        } else {
            if (currentMode === 'running') {
                updateRunningView(state);
            } else {
                updatePickerView();
            }
        }
    }

    // Picker View (criação + lista de presets)
    function initPickerView() {
        const soundId = localStorage.getItem(STORAGE_KEYS.INTERVAL_SELECTED_SOUND) || alarmManager.getLastUsedSound();

        container.innerHTML = `
      <div class="header">
        <button class="edit-btn" id="edit-intervals-btn" style="visibility: hidden">${isEditing ? 'Done' : 'Edit'}</button>
        <h1>Intervals</h1>
        <div class="add-btn-container" style="display: flex; gap: 10px;">
          <button class="add-btn" id="cancel-edit-interval-btn" style="display: none; font-size: 14px; width: auto; padding: 0 10px;">Cancel</button>
          <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
        </div>
      </div>
      <div class="timer-picker">
        <div class="picker-col">
           <input type="number" id="hours" class="timer-input" min="0" max="23" value="${draftPickerHours}">
           <div class="timer-label">hours</div>
        </div>
        <div class="picker-col">
           <input type="number" id="minutes" class="timer-input" min="0" max="59" value="${draftPickerMinutes}">
           <div class="timer-label">min</div>
        </div>
        <div class="picker-col">
           <input type="number" id="seconds" class="timer-input" min="0" max="59" value="${draftPickerSeconds}">
           <div class="timer-label">sec</div>
        </div>
      </div>

      <div class="modal-section" style="margin: 0 auto 15px;">
          <div class="modal-row">
              <span>Label</span>
              <input type="text" id="interval-label" value="${escapeHtml(draftLabel)}" placeholder="Step name" maxlength="200">
          </div>
          <div class="modal-row">
              <span>When Step Ends</span>
              <button id="interval-sound-trigger" class="sound-select-btn" data-sound="${soundId}" title="${getSoundName(soundId)}">
                  ${getSoundName(soundId)}
              </button>
              <input type="hidden" id="interval-sound-value" value="${soundId}">
          </div>
      </div>

      <div class="interval-draft-actions">
          <button class="control-btn pause" id="add-step-btn" style="font-size: 14px; padding: 8px 20px; background-color: rgba(255, 159, 10, 0.2); color: var(--accent-orange);">Add Step</button>
          <button class="control-btn start" id="start-interval-btn" style="font-size: 14px; padding: 8px 20px; display: none;">Start</button>
          <button class="control-btn" id="save-interval-btn" style="font-size: 14px; padding: 8px 20px; display: none; background-color: rgba(100, 160, 255, 0.2); color: #64a0ff;">Save</button>
      </div>

      <div class="recents-container"></div>
`;
        // Listeners
        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());

        const soundTrigger = container.querySelector('#interval-sound-trigger');
        const soundValue = container.querySelector('#interval-sound-value');
        if (soundTrigger) {
            soundTrigger.onclick = () => {
                openSoundPicker(soundValue.value, (selectedId) => {
                    soundValue.value = selectedId;
                    soundTrigger.textContent = getSoundName(selectedId);
                    localStorage.setItem(STORAGE_KEYS.INTERVAL_SELECTED_SOUND, selectedId);
                });
            };
        }

        const hoursInput = container.querySelector('#hours');
        const minutesInput = container.querySelector('#minutes');
        const secondsInput = container.querySelector('#seconds');
        const labelInput = container.querySelector('#interval-label');

        const updateDraftState = () => {
            draftPickerHours = Number(hoursInput.value) || 0;
            draftPickerMinutes = Number(minutesInput.value) || 0;
            draftPickerSeconds = Number(secondsInput.value) || 0;
            draftLabel = labelInput.value || '';
            saveDraft();
        };

        if (labelInput) {
            labelInput.addEventListener('input', updateDraftState);
        }

        const validateInput = (input, max) => {
            input.oninput = () => {
                let val = parseInt(input.value);
                if (val > max) input.value = max;
                if (val < 0) input.value = 0;
                if (input.value.length > 2) input.value = input.value.slice(0, 2);
                updateDraftState();
            };
        };

        validateInput(hoursInput, 23);
        validateInput(minutesInput, 59);
        validateInput(secondsInput, 59);

        // Adiciona step
        const addStepBtn = container.querySelector('#add-step-btn');
        if (addStepBtn) {
            addStepBtn.onclick = () => {
                if (draftSteps.length >= LIMITS.MAX_INTERVAL_STEPS) {
                    showAlert(`Maximum of ${LIMITS.MAX_INTERVAL_STEPS} steps allowed.`, 'Limit Reached');
                    return;
                }
                const h = Number(hoursInput.value);
                const m = Number(minutesInput.value);
                const s = Number(secondsInput.value);
                if (h * 3600 + m * 60 + s <= 0) {
                    showAlert('Set a time greater than 0.', 'Invalid');
                    return;
                }
                const label = container.querySelector('#interval-label').value || '';
                draftSteps.push({ hours: h, minutes: m, seconds: s, label });

                draftPickerHours = h;
                draftPickerMinutes = m;
                draftPickerSeconds = s;
                draftLabel = '';

                saveDraft();
                renderDraftSteps();
            };
        }

        // Iniica
        const startIntervalBtn = container.querySelector('#start-interval-btn');
        if (startIntervalBtn) {
            startIntervalBtn.onclick = () => {
                if (draftSteps.length === 0) return;
                const soundId = container.querySelector('#interval-sound-value').value;
                intervalTimerManager.start(draftSteps, soundId, '');
                draftSteps = [];
                draftLabel = '';
                saveDraft();
            };
        }

        // Salva
        const saveIntervalBtn = container.querySelector('#save-interval-btn');
        if (saveIntervalBtn) {
            saveIntervalBtn.onclick = () => {
                if (draftSteps.length === 0) return;
                const soundId = container.querySelector('#interval-sound-value').value;

                showModal({
                    title: 'Save Interval',
                    content: `
                        <div class="modal-section">
                            <div class="modal-row">
                                <span>Name</span>
                                <input type="text" id="interval-preset-name" placeholder="Interval name" maxlength="200">
                            </div>
                        </div>
                    `,
                    onSave: (overlay) => {
                        const name = overlay.querySelector('#interval-preset-name').value || 'Interval';
                        const presetData = {
                            label: name,
                            soundId,
                            steps: [...draftSteps]
                        };
                        const result = intervalTimerManager.addPreset(presetData);
                        if (result.success) {
                            showAlert('Interval saved!', 'Success');
                            draftSteps = [];
                            draftLabel = '';
                            saveDraft();
                            render();
                        } else {
                            if (document.body.contains(overlay)) {
                                document.body.removeChild(overlay);
                            }
                            openReplaceModal(presetData);
                        }
                    }
                });
            };
        }

        renderDraftSteps();
        updatePresetsSection();
        updateHeaderState();
    }

    function updatePickerView() {
        renderDraftSteps();
        updatePresetsSection();
        updateHeaderState();
    }

    // Draft steps (em recents)
    function renderDraftSteps() {
        const recentsContainer = container.querySelector('.recents-container');
        const startIntervalBtn = container.querySelector('#start-interval-btn');
        const saveIntervalBtn = container.querySelector('#save-interval-btn');
        const labelInput = container.querySelector('#interval-label');

        if (!recentsContainer) return;

        if (draftSteps.length === 0) {
            if (startIntervalBtn) startIntervalBtn.style.display = 'none';
            if (saveIntervalBtn) saveIntervalBtn.style.display = 'none';
            // Mostra presets em vez do placeholder se existirem
            updatePresetsSection();
            return;
        }

        const stepsHTML = draftSteps.map((step, i) => {
            const totalSecs = (step.hours || 0) * 3600 + (step.minutes || 0) * 60 + (step.seconds || 0);
            return `
                <div class="interval-step-item" data-step-index="${i}">
                    <span class="interval-step-number">${i + 1}</span>
                    <div class="interval-step-info">
                        <div class="interval-step-label">${escapeHtml(step.label || `Step ${i + 1}`)}</div>
                        <div class="interval-step-time">${formatTime(totalSecs)}</div>
                    </div>
                    <button class="interval-step-delete" data-step-index="${i}" title="Remove step">✕</button>
                </div>
                    `;
        }).join('');

        const totalSecs = intervalTimerManager.getTotalTime(draftSteps);

        recentsContainer.innerHTML = `
            <div class="recents-section">
                <div class="interval-total-time" style="text-align: center; padding: 8px 0;">Total: ${formatTime(totalSecs)} — ${draftSteps.length} step${draftSteps.length !== 1 ? 's' : ''}</div>
                <div class="alarm-list">
                    ${stepsHTML}
                </div>
            </div>
        `;

        if (startIntervalBtn) startIntervalBtn.style.display = '';
        if (saveIntervalBtn) saveIntervalBtn.style.display = '';

        if (labelInput) {
            labelInput.value = draftLabel;
            labelInput.placeholder = 'Step name';
        }

        recentsContainer.querySelectorAll('.interval-step-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.stepIndex);
                draftSteps.splice(idx, 1);
                saveDraft();
                renderDraftSteps();
            };
        });
    }

    // Seção de presets (quando não tem draft steps)    
    function updatePresetsSection() {
        const recentsContainer = container.querySelector('.recents-container');
        if (!recentsContainer) return;

        // Se tem draft steps, o renderDraftSteps cuida
        if (draftSteps.length > 0) return;

        const presets = intervalTimerManager.getPresets();

        if (presets.length === 0) {
            recentsContainer.innerHTML = `
                <div class="recents-section">
                    <p style="text-align:center; color:var(--text-secondary); margin-top:20px;">Add steps to create an interval timer</p>
                </div>
                    `;
            return;
        }

        const presetsHTML = presets.map(preset => renderPresetItem(preset)).join('');

        recentsContainer.innerHTML = `
                <div class="recents-section">
                    <div class="alarm-list ${isEditing ? 'edit-mode' : ''}">
                        ${presetsHTML}
                    </div>
                </div>
                    `;
    }

    function updateHeaderState() {
        const editBtn = container.querySelector('#edit-intervals-btn');
        const audioBtn = container.querySelector('#audio-settings-btn');
        const cancelBtn = container.querySelector('#cancel-edit-interval-btn');

        if (editBtn) {
            const presets = intervalTimerManager.getPresets();
            editBtn.style.visibility = presets.length > 0 ? 'visible' : 'hidden';
            editBtn.textContent = isEditing ? (selectedPresets.size > 0 ? `Delete(${selectedPresets.size})` : 'Done') : 'Edit';
        }
        if (audioBtn) audioBtn.style.display = isEditing ? 'none' : '';
        if (cancelBtn) cancelBtn.style.display = isEditing ? '' : 'none';
    }

    function renderPresetItem(preset) {
        const totalSecs = intervalTimerManager.getTotalTime(preset.steps);
        const stepCount = preset.steps.length;

        return `
            <div class="alarm-item recent-item swipe-container ${selectedPresets.has(preset.id) ? 'selected' : ''}" style="position:relative;">
                <div class="swipe-content">
                    ${isEditing ? `<button class="delete-clock-btn delete-recent-btn" data-id="${preset.id}">−</button><input type="checkbox" class="select-checkbox" data-id="${preset.id}" ${selectedPresets.has(preset.id) ? 'checked' : ''}>` : ''}
                    <div class="alarm-info recent-item-info" data-id="${preset.id}" data-type="interval" style="padding-left: ${isEditing ? '40px' : '0'}; transition: padding 0.3s; cursor: pointer; width: 100%;">
                        <span class="alarm-time" style="font-size: 32px;">${escapeHtml(preset.label || 'Interval')}</span>
                        <span class="alarm-label">
                            ${stepCount} step${stepCount !== 1 ? 's' : ''} · ${formatTime(totalSecs)}
                        </span>
                    </div>
                    ${!isEditing ? `
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="control-btn start recent-item-play" data-id="${preset.id}" data-type="interval" style="width: 40px; height: 40px; min-width: 40px; padding: 0 0 0 3px; display: flex; align-items: center; justify-content: center;">
                                ▶
                            </button>
                        </div>
                    ` : `<div style="width: 40px;"></div>`}
                </div>
                <button class="swipe-delete-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </div>
        `;
    }

    // Running View
    function initRunningView(state) {
        container.innerHTML = `
            <div class="header">
        <button class="edit-btn" style="visibility: hidden;"></button>
        <h1>Interval</h1>
        <div class="add-btn-container" style="display: flex; gap: 10px;">
          <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
        </div>
    </div >
    <div class="interval-step-progress">
        <div class="step-label" id="interval-step-label">${escapeHtml(state.currentStepLabel || `Step ${state.currentStepIndex + 1}`)}</div>
        <div class="step-counter" id="interval-step-counter">Step ${state.currentStepIndex + 1} of ${state.totalStepsCount}</div>
    </div>
    <div class="interval-step-dots" id="interval-step-dots">
        ${state.steps.map((_, i) => `<span class="dot ${i < state.currentStepIndex ? 'completed' : ''} ${i === state.currentStepIndex ? 'active' : ''}"></span>`).join('')}
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
        <button class="control-btn stop" id="interval-cancel-btn">Cancel</button>
        <button class="control-btn reset" id="interval-prev-btn" title="Previous Step" style="width: 50px; height: 50px; font-size: 18px;">⏮</button>
        <button class="control-btn reset" id="interval-skip-btn" title="Next Step" style="width: 50px; height: 50px; font-size: 18px;">⏭</button>
        <button class="control-btn ${state.isPaused ? 'start' : 'pause'}" id="interval-pause-btn">
          ${state.isPaused ? 'Resume' : 'Pause'}
        </button>
    </div>
    <div class="interval-upcoming" id="interval-upcoming">
        ${renderUpcomingSteps(state)}
    </div>
`;
        container.querySelector('#interval-cancel-btn').onclick = () => intervalTimerManager.cancel();
        container.querySelector('#interval-prev-btn').onclick = () => intervalTimerManager.previousStep();
        container.querySelector('#interval-skip-btn').onclick = () => intervalTimerManager.skipStep();
        container.querySelector('#interval-pause-btn').onclick = () => {
            if (intervalTimerManager.getState().isPaused) {
                intervalTimerManager.resume();
            } else {
                intervalTimerManager.pause();
            }
        };
        container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());

        updateProgress(state.remainingSeconds, state.totalSecondsCurrentStep);
    }

    function updateRunningView(state) {
        const display = container.querySelector('.timer-display-text');
        if (display) display.textContent = formatTime(state.remainingSeconds);

        updateProgress(state.remainingSeconds, state.totalSecondsCurrentStep);

        const stepLabel = container.querySelector('#interval-step-label');
        if (stepLabel) stepLabel.textContent = state.currentStepLabel || `Step ${state.currentStepIndex + 1}`;

        const stepCounter = container.querySelector('#interval-step-counter');
        if (stepCounter) stepCounter.textContent = `Step ${state.currentStepIndex + 1} of ${state.totalStepsCount}`;

        const dotsEl = container.querySelector('#interval-step-dots');
        if (dotsEl) {
            const dots = dotsEl.children;
            if (dots.length === state.steps.length) {
                Array.from(dots).forEach((dot, i) => {
                    const isCompleted = i < state.currentStepIndex;
                    const isActive = i === state.currentStepIndex;
                    if (isCompleted && !dot.classList.contains('completed')) dot.classList.add('completed');
                    if (isActive && !dot.classList.contains('active')) dot.classList.add('active');
                    if (!isActive && dot.classList.contains('active')) dot.classList.remove('active');
                    if (!isCompleted && dot.classList.contains('completed')) dot.classList.remove('completed');
                });
            } else {
                dotsEl.innerHTML = state.steps.map((_, i) =>
                    `<span class="dot ${i < state.currentStepIndex ? 'completed' : ''} ${i === state.currentStepIndex ? 'active' : ''}"></span>`
                ).join('');
            }
        }

        const pauseBtn = container.querySelector('#interval-pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
            pauseBtn.className = `control-btn ${state.isPaused ? 'start' : 'pause'}`;
        }

        const upcomingEl = container.querySelector('#interval-upcoming');
        if (upcomingEl) upcomingEl.innerHTML = renderUpcomingSteps(state);
    }

    function renderUpcomingSteps(state) {
        if (state.currentStepIndex >= state.totalStepsCount - 1) return '';

        const upcoming = state.steps.slice(state.currentStepIndex + 1);
        return `
                <div class="interval-upcoming-title">Up Next</div>
                ${upcoming.map((step, i) => {
            const realIndex = state.currentStepIndex + 1 + i;
            const totalSecs = (step.hours || 0) * 3600 + (step.minutes || 0) * 60 + (step.seconds || 0);
            return `
                    <div class="interval-step-item ${i === 0 ? 'next-step' : ''}">
                        <span class="interval-step-number">${realIndex + 1}</span>
                        <div class="interval-step-info">
                            <div class="interval-step-label">${escapeHtml(step.label || `Step ${realIndex + 1}`)}</div>
                            <div class="interval-step-time">${formatTime(totalSecs)}</div>
                        </div>
                    </div>
                `;
        }).join('')
            }
                    `;
    }

    // Utilitários
    function getSoundName(id) {
        const builtIn = audioManager.getBuiltInSounds().find(s => s.id === id);
        const custom = audioManager.getCustomSounds().find(s => s.id === id);
        return builtIn ? builtIn.name : (custom ? custom.name : 'Radar (Default)');
    }

    function updateProgress(remaining, total) {
        const circle = container.querySelector('.progress-ring__circle');
        if (!circle) return;
        const progress = total > 0 ? remaining / total : 0;
        const offset = circumference - (progress * circumference);
        circle.style.strokeDashoffset = offset;
    }

    // Listeners
    function onIntervalUpdated() {
        render();
    }

    function onIntervalFinished() {
        const state = intervalTimerManager.getState();
        const isPreset = !!state.activePresetId;

        const modalOptions = {
            title: 'Interval Finished',
            content: `<div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                        <h2 style="margin-bottom: 10px;">All steps completed!</h2>
                      </div>`,
            showCancel: false,
            confirmText: 'OK',
            onConfirm: () => { }
        };

        if (!isPreset) {
            modalOptions.onSave = (overlay) => {
                showModal({
                    title: 'Save Interval',
                    content: `
                        <div class="modal-section">
                            <div class="modal-row">
                                <span>Name</span>
                                <input type="text" id="finish-interval-name" placeholder="Interval name" maxlength="200">
                            </div>
                        </div>
                    `,
                    onSave: (saveOverlay) => {
                        const name = saveOverlay.querySelector('#finish-interval-name').value || 'Interval';
                        const presetData = {
                            label: name,
                            soundId: state.soundId,
                            steps: state.steps
                        };
                        const result = intervalTimerManager.addPreset(presetData);
                        if (result.success) {
                            showAlert('Interval saved!', 'Success');
                            render();
                        } else {
                            if (document.body.contains(saveOverlay)) {
                                document.body.removeChild(saveOverlay);
                            }
                            openReplaceModal(presetData);
                        }
                    }
                });
            };
        }

        showModal(modalOptions);
        render();
    }

    function onPresetsUpdated() {
        render();
    }

    document.addEventListener('interval-timer-updated', onIntervalUpdated);
    document.addEventListener('interval-timer-finished', onIntervalFinished);
    document.addEventListener('interval-presets-updated', onPresetsUpdated);

    render();

    return {
        element: container,
        cleanup: () => {
            document.removeEventListener('interval-timer-updated', onIntervalUpdated);
            document.removeEventListener('interval-timer-finished', onIntervalFinished);
            document.removeEventListener('interval-presets-updated', onPresetsUpdated);
            swipe.destroy();
        }
    };
}
