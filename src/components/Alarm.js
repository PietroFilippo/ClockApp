import { alarmManager } from '../modules/AlarmManager.js';
import { audioManager } from '../utils/AudioManager.js';
import { showModal } from '../utils/modal.js';
import { confirmDelete, showAlert } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { openSoundPicker } from '../utils/SoundPicker.js';
import { openSoundSettingsModal } from '../utils/SoundSettingsModal.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS, DEFAULT_SOUND } from '../utils/constants.js';
import { SwipeToDelete } from '../utils/SwipeToDelete.js';

export function Alarm() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let isEditing = false;
  let ignoreNextUpdate = false;
  let selectedAlarms = new Set();

  initDelegatedListeners();

  const swipe = new SwipeToDelete({
    container,
    itemSelector: '.alarm-item',
    onDelete: async (item) => {
      const id = Number(item.dataset.alarmId);
      const alarm = alarmManager.getAlarms().find(a => a.id === id);
      await confirmAndDelete(id, alarm);
    },
    isDisabled: () => isEditing
  });

  function render() {
    // Cria a estrutura estática apenas uma vez (padrão Stopwatch)
    if (!container.querySelector('.header')) {
      container.innerHTML = `
        <div class="header">
          <button class="edit-btn" id="edit-alarm-btn">Edit</button>
          <h1>Alarm</h1>
          <div class="add-btn-container" style="display: flex; gap: 10px;">
              <button class="add-btn" id="cancel-edit-alarm-btn" style="display: none; font-size: 14px; width: auto; padding: 0 10px;">Cancel</button>
              <button class="add-btn" id="audio-settings-btn" style="font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
              <button class="add-btn" id="add-alarm-btn">+</button>
          </div>
        </div>
        <div class="alarm-list"></div>
      `;
    }

    // Atualiza apenas as partes dinâmicas
    updateHeaderState();
    updateAlarmList();
  }

  function updateHeaderState() {
    const editBtn = container.querySelector('#edit-alarm-btn');
    if (editBtn) {
      if (isEditing && selectedAlarms.size > 0) {
        editBtn.textContent = `Delete (${selectedAlarms.size})`;
        editBtn.style.color = 'var(--accent-red)';
      } else {
        editBtn.textContent = isEditing ? 'Done' : 'Edit';
        editBtn.style.color = '';
      }
    }

    const audioBtn = container.querySelector('#audio-settings-btn');
    const addBtn = container.querySelector('#add-alarm-btn');
    const cancelBtn = container.querySelector('#cancel-edit-alarm-btn');
    if (audioBtn) audioBtn.style.display = isEditing ? 'none' : '';
    if (addBtn) addBtn.style.display = isEditing ? 'none' : '';
    if (cancelBtn) cancelBtn.style.display = isEditing ? '' : 'none';
  }

  function buildAlarmItemHTML(alarm, snoozed) {
    const isSnoozing = snoozed[alarm.id];
    let labelText = escapeHtml(alarm.label || 'Alarm');
    let htmlContent = labelText;
    let snoozeText = '';

    if (isSnoozing) {
      snoozeText = `<span style="color: var(--accent-orange); font-size: 12px; display: block; margin-top: 2px;">Snoozing until ${isSnoozing} <button class="cancel-snooze-btn" data-id="${alarm.id}" title="Cancel Snooze" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;">✕</button></span>`;
    } else if (alarm.repeat && alarm.repeat.length > 0) {
      htmlContent += `, <span style="font-size: 12px; color: var(--text-secondary);">${formatDays(alarm.repeat)}</span>`;
    }

    const titleText = labelText + (alarm.repeat && alarm.repeat.length > 0 ? `, ${formatDays(alarm.repeat)}` : '');

    return `
        <div class="alarm-item swipe-container ${selectedAlarms.has(alarm.id) ? 'selected' : ''}" data-alarm-id="${alarm.id}" style="position:relative;">
          <div class="swipe-content">
           ${isEditing ? `<button class="delete-clock-btn" data-id="${alarm.id}">−</button><input type="checkbox" class="select-checkbox" data-id="${alarm.id}" ${selectedAlarms.has(alarm.id) ? 'checked' : ''}>` : ''}
           
            <div class="alarm-info" data-id="${alarm.id}" style="padding-left: ${isEditing ? '40px' : '0'}; transition: padding 0.3s; cursor: pointer; width: 100%;">
              <span class="alarm-time ${!alarm.enabled ? 'disabled' : ''}">${alarm.time}</span>
              <span class="alarm-label" title="${titleText}">${htmlContent}</span>
              ${snoozeText}
            </div>
            
            ${!isEditing ? `
                <label class="switch">
                <input type="checkbox" class="alarm-toggle" data-id="${alarm.id}" ${alarm.enabled ? 'checked' : ''}>
                <span class="slider round"></span>
                </label>
            ` : `<div style="width: 50px;"></div>`}
          </div>
          <button class="swipe-delete-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
      `;
  }

  function updateAlarmList() {
    const alarmList = container.querySelector('.alarm-list');
    if (!alarmList) return;

    const alarms = alarmManager.getAlarms();
    const snoozed = alarmManager.getSnoozedAlarms();
    alarms.sort((a, b) => a.time.localeCompare(b.time));

    // Atualiza classe de modo de edição
    alarmList.classList.toggle('edit-mode', isEditing);

    // Estado vazio
    const emptyMsg = alarmList.querySelector('.alarm-empty-msg');
    if (alarms.length === 0) {
      // Remove todos os itens existentes
      alarmList.querySelectorAll('.alarm-item').forEach(el => el.remove());
      if (!emptyMsg) {
        alarmList.innerHTML = '<p class="alarm-empty-msg" style="text-align:center; color:var(--text-secondary); margin-top:50px;">No Alarms</p>';
      }
      return;
    }
    // Remove mensagem de vazio se existir
    if (emptyMsg) emptyMsg.remove();

    // Mapa de elementos existentes por alarm ID
    const existingItems = new Map();
    alarmList.querySelectorAll('.alarm-item[data-alarm-id]').forEach(el => {
      existingItems.set(Number(el.dataset.alarmId), el);
    });

    // IDs dos alarmes atuais para detectar remoções
    const currentIds = new Set(alarms.map(a => a.id));

    // Remove itens que não existem mais
    for (const [id, el] of existingItems) {
      if (!currentIds.has(id)) {
        el.remove();
        existingItems.delete(id);
      }
    }

    // Atualiza ou cria cada item na ordem correta
    let previousNode = null;
    for (const alarm of alarms) {
      const existingEl = existingItems.get(alarm.id);
      const newHTML = buildAlarmItemHTML(alarm, snoozed);

      if (existingEl) {
        // Atualiza o conteúdo se mudou
        const temp = document.createElement('div');
        temp.innerHTML = newHTML;
        const newEl = temp.firstElementChild;

        if (existingEl.innerHTML !== newEl.innerHTML ||
          existingEl.className !== newEl.className) {
          existingEl.className = newEl.className;
          existingEl.innerHTML = newEl.innerHTML;
        }

        // Garante a ordem correta
        const expectedPrev = previousNode;
        const actualPrev = existingEl.previousElementSibling;
        if (actualPrev !== expectedPrev) {
          if (expectedPrev) {
            expectedPrev.after(existingEl);
          } else {
            alarmList.prepend(existingEl);
          }
        }
        previousNode = existingEl;
      } else {
        // Cria novo elemento
        const temp = document.createElement('div');
        temp.innerHTML = newHTML;
        const newEl = temp.firstElementChild;

        if (previousNode) {
          previousNode.after(newEl);
        } else {
          alarmList.prepend(newEl);
        }
        previousNode = newEl;
      }
    }
  }

  function formatDays(days) {
    if (!days || days.length === 0) return '';
    if (days.length === 7) return 'Every day';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  }

  function initDelegatedListeners() {
    // Event Delegation no container principal
    container.addEventListener('click', async (e) => {
      const target = e.target;

      // Adiciona Alarme
      if (target.closest('#add-alarm-btn')) {
        openAlarmModal();
        return;
      }

      // Configurações de áudio
      if (target.closest('#audio-settings-btn')) {
        openSoundSettingsModal(() => render());
        return;
      }

      // Edita alarmes
      if (target.closest('#edit-alarm-btn')) {
        if (isEditing && selectedAlarms.size > 0) {
          // Deleta alarmes selecionados
          const count = selectedAlarms.size;
          if (await confirmDelete(`${count} alarm${count > 1 ? 's' : ''}`, 'Selected')) {
            for (const id of selectedAlarms) {
              alarmManager.deleteAlarm(id);
            }
            selectedAlarms.clear();
            render();
          }
        } else {
          isEditing = !isEditing;
          selectedAlarms.clear();
          render();
        }
        return;
      }

      // Cancela edição
      if (target.closest('#cancel-edit-alarm-btn')) {
        isEditing = false;
        selectedAlarms.clear();
        render();
        return;
      }

      // Seleciona checkbox no modo de editar
      if (target.classList.contains('select-checkbox')) {
        e.stopPropagation();
        const id = Number(target.dataset.id);
        if (target.checked) {
          selectedAlarms.add(id);
        } else {
          selectedAlarms.delete(id);
        }
        // Update visual state
        const item = target.closest('.alarm-item');
        if (item) item.classList.toggle('selected', target.checked);
        updateHeaderState();
        return;
      }

      // Toggle Alarm (Switch)
      if (target.classList.contains('alarm-toggle')) {
        e.stopPropagation();
        const id = Number(target.dataset.id);

        // Previne loop de re-renderização completo
        ignoreNextUpdate = true;
        alarmManager.toggleAlarm(id);

        // Atualização UI granular
        const item = target.closest('.alarm-item');
        const timeDisplay = item ? item.querySelector('.alarm-time') : null;
        if (timeDisplay) {
          timeDisplay.classList.toggle('disabled', !target.checked);
        }
        return;
      }

      // Cancel Snooze
      if (target.closest('.cancel-snooze-btn')) {
        e.stopPropagation();
        const btn = target.closest('.cancel-snooze-btn');
        const id = Number(btn.dataset.id);
        alarmManager.cancelSnooze(id);
        render();
        return;
      }

      // Delete Alarm (Edit Mode)
      if (target.closest('.delete-clock-btn')) {
        e.stopPropagation();
        const btn = target.closest('.delete-clock-btn');
        const id = Number(btn.dataset.id);
        const alarm = alarmManager.getAlarms().find(a => a.id === id);

        await confirmAndDelete(id, alarm);
        return;
      }

      // Edit Alarm (Click on Info)
      const alarmInfo = target.closest('.alarm-info');
      if (alarmInfo) {
        const id = Number(alarmInfo.dataset.id);
        openAlarmModal(id);
      }
    });

    // Context Menu via Delegation
    container.addEventListener('contextmenu', (e) => {
      const alarmInfo = e.target.closest('.alarm-info');
      if (alarmInfo) {
        e.preventDefault();
        const id = Number(alarmInfo.dataset.id);
        const alarm = alarmManager.getAlarms().find(a => a.id === id);

        contextMenu.show(e.clientX, e.clientY, [
          {
            label: 'Edit',
            primary: true,
            action: () => openAlarmModal(id)
          },
          {
            label: 'Delete',
            danger: true,
            action: () => confirmAndDelete(id, alarm)
          }
        ]);
      }
    });
  }

  async function confirmAndDelete(id, alarm) {
    const label = alarm && alarm.label ? alarm.label : (alarm ? alarm.time : 'Alarm');
    if (await confirmDelete(label, 'Alarm')) {
      alarmManager.deleteAlarm(id);
      render();
    }
  }

  function getSoundName(id) {
    const builtIn = audioManager.getBuiltInSounds().find(s => s.id === id);
    const custom = audioManager.getCustomSounds().find(s => s.id === id);
    return builtIn ? builtIn.name : (custom ? custom.name : 'Radar (Default)');
  }



  function openAlarmModal(existingId = null) {
    let alarm = {
      time: '08:00',
      label: '',
      repeat: [],
      sound: alarmManager.getLastUsedSound(),
      snoozeEnabled: true,
      snoozeInterval: 5
    };

    if (existingId) {
      const found = alarmManager.getAlarms().find(a => a.id === existingId);
      if (found) alarm = { ...found };
    }

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const allDaysSelected = days.every((_, i) => alarm.repeat.includes(i));
    const buttonText = allDaysSelected ? 'Clear' : 'Select All';

    const content = `
      <div style="text-align:center; padding: 20px 0;">
                <input type="time" id="modal-time" value="${alarm.time}" style="font-size: 48px; background: transparent; border: none; color: white; font-family: inherit;">
            </div>
            
            <div class="modal-section">
                <div style="display:flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
                     <span style="font-size: 14px; color: var(--text-secondary);">Repeat</span>
                     <button id="toggle-days-btn" style="background:none; border:none; color:var(--accent-orange); cursor:pointer; font-size:13px;">${buttonText}</button>
                </div>
                <div class="day-selector">
                    ${days.map((d, i) => `
                        <div class="day-option ${alarm.repeat.includes(i) ? 'selected' : ''}" data-day="${i}">${d}</div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-section">
                <div class="modal-row">
                    <span>Label</span>
                    <input type="text" id="modal-label" value="${escapeHtml(alarm.label === 'Alarm' ? '' : alarm.label)}" placeholder="Alarm" maxlength="200">
                </div>
                <div class="modal-row">
                    <span>Sound</span>
                    <button id="modal-sound-trigger" class="sound-select-btn" data-sound="${alarm.sound}" title="${getSoundName(alarm.sound)}">
                        ${getSoundName(alarm.sound)}
                    </button>
                    <input type="hidden" id="modal-sound-value" value="${alarm.sound}">
                </div>
                <div class="modal-row">
                    <span>Snooze</span>
                    <label class="switch">
                        <input type="checkbox" id="modal-snooze" ${alarm.snoozeEnabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="modal-row" id="snooze-duration-row" style="display: ${alarm.snoozeEnabled ? 'flex' : 'none'}; flex-direction: column; align-items: stretch; gap: 10px;">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Duration</span>
                        <span id="snooze-val-display" style="color:var(--text-secondary)">${alarm.snoozeInterval} min</span>
                    </div>
                    <input type="range" id="modal-snooze-interval" min="1" max="30" value="${alarm.snoozeInterval}" style="width: 100%; accent-color: var(--accent-orange);"> 
                </div>
            </div>
`;

    showModal({
      title: existingId ? 'Edit Alarm' : 'Add Alarm',
      content: content,
      onSave: (overlay) => {
        const time = overlay.querySelector('#modal-time').value;
        const label = overlay.querySelector('#modal-label').value;
        const sound = overlay.querySelector('#modal-sound-value').value;
        const snoozeEnabled = overlay.querySelector('#modal-snooze').checked;
        const snoozeInterval = Number(overlay.querySelector('#modal-snooze-interval').value);

        // Obtém os dias selecionados
        const selectedDays = [];
        overlay.querySelectorAll('.day-option.selected').forEach(el => {
          selectedDays.push(Number(el.dataset.day));
        });

        const data = {
          time,
          label,
          repeat: selectedDays,
          sound,
          snoozeEnabled,
          snoozeInterval
        };

        if (existingId) {
          alarmManager.updateAlarm(existingId, data);
        } else {
          alarmManager.addAlarm(data);
        }
        alarmManager.setLastUsedSound(sound);
        render();
      }
    });

    // Lógica pós-interação pra interatividade no modal
    setTimeout(() => {
      const overlay = document.querySelector('.modal-overlay');
      if (!overlay) return;

      const toggleBtn = overlay.querySelector('#toggle-days-btn');
      const dayOptions = overlay.querySelectorAll('.day-option');

      // Atualiza o texto do botão ao iniciar
      const updateButtonState = () => {
        const allSelected = Array.from(dayOptions).every(opt => opt.classList.contains('selected'));
        toggleBtn.textContent = allSelected ? 'Clear' : 'Select All';
      };
      updateButtonState();

      toggleBtn.onclick = () => {
        const allSelected = Array.from(dayOptions).every(opt => opt.classList.contains('selected'));
        dayOptions.forEach(opt => {
          if (allSelected) opt.classList.remove('selected');
          else opt.classList.add('selected');
        });
        updateButtonState();
      };

      dayOptions.forEach(opt => {
        opt.onclick = () => {
          opt.classList.toggle('selected');
          updateButtonState();
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

      const snoozeToggle = overlay.querySelector('#modal-snooze');
      const snoozeRow = overlay.querySelector('#snooze-duration-row');
      const snoozeInput = overlay.querySelector('#modal-snooze-interval');
      const snoozeDisplay = overlay.querySelector('#snooze-val-display');

      snoozeToggle.onchange = (e) => {
        snoozeRow.style.display = e.target.checked ? 'flex' : 'none';
      };

      snoozeInput.oninput = (e) => {
        snoozeDisplay.textContent = `${e.target.value} min`;
      };
    }, 100);
  }

  // Atualizações externas (ex: alarme disparado e desabilitado)
  function onAlarmsUpdated() {
    if (ignoreNextUpdate) {
      ignoreNextUpdate = false;
      return;
    }
    render();
  }

  document.addEventListener('alarms-updated', onAlarmsUpdated);

  render();

  return {
    element: container,
    cleanup: () => {
      document.removeEventListener('alarms-updated', onAlarmsUpdated);
      swipe.destroy();
    }
  };
}
