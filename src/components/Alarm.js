import { alarmManager } from '../modules/AlarmManager.js';
import { audioManager } from '../utils/AudioManager.js';
import { showModal } from '../utils/modal.js';
import { confirmDelete, showAlert } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { openSoundPicker } from '../utils/SoundPicker.js';
import { openSoundSettingsModal } from '../utils/SoundSettingsModal.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS, DEFAULT_SOUND } from '../utils/constants.js';

export function Alarm() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let isEditing = false;
  let ignoreNextUpdate = false;

  initDelegatedListeners();

  function render() {
    const alarms = alarmManager.getAlarms();
    const snoozed = alarmManager.getSnoozedAlarms();
    // Ordena os ativados primeiro, depois por horário
    alarms.sort((a, b) => a.time.localeCompare(b.time));

    container.innerHTML = `
      <div class="header">
        <button class="edit-btn" id="edit-alarm-btn">${isEditing ? 'Done' : 'Edit'}</button>
        <h1>Alarm</h1>
        <div class="add-btn-container" style="display: flex; gap: 10px;">
            <button class="add-btn" id="audio-settings-btn" style="visibility: ${isEditing ? 'hidden' : 'visible'}; font-size: 14px; width: auto; padding: 0 10px;">Sound</button>
            <button class="add-btn" id="add-alarm-btn" style="visibility: ${isEditing ? 'hidden' : 'visible'}">+</button>
        </div>
      </div>
  <div class="alarm-list ${isEditing ? 'edit-mode' : ''}">
    ${alarms.length === 0 ? '<p style="text-align:center; color:var(--text-secondary); margin-top:50px;">No Alarms</p>' : ''}
    ${alarms.map(alarm => {
      const isSnoozing = snoozed[alarm.id];
      // Formata o rótulo ou status de snooze
      let labelText = escapeHtml(alarm.label || 'Alarm');
      let htmlContent = labelText;
      let snoozeText = '';

      if (isSnoozing) {
        snoozeText = `<span style="color: var(--accent-orange); font-size: 12px; display: block; margin-top: 2px;">Snoozing until ${isSnoozing} <button class="cancel-snooze-btn" data-id="${alarm.id}" title="Cancel Snooze" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;">✕</button></span>`;
      } else if (alarm.repeat && alarm.repeat.length > 0) {
        htmlContent += `, <span style="font-size: 12px; color: var(--text-secondary);">${formatDays(alarm.repeat)}</span>`;
      }

      // Sanitiza o atributo title (já que labelText está escapado, pode ter entities HTML, mas title lida melhor com raw text. Entretanto, para title attribute, escapeHtml é correto para aspas)
      const titleText = labelText + (alarm.repeat && alarm.repeat.length > 0 ? `, ${formatDays(alarm.repeat)}` : '');

      return `
          <div class="alarm-item" style="position:relative;">
             ${isEditing ? `<button class="delete-clock-btn" data-id="${alarm.id}">−</button>` : ''}
             
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
        `}).join('')}
  </div>
`;

    // attachListeners(); // Removido para evitar duplicação - chamado apenas na inicialização
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

      // Add Alarm
      if (target.closest('#add-alarm-btn')) {
        openAlarmModal();
        return;
      }

      // Audio Settings
      if (target.closest('#audio-settings-btn')) {
        openSoundSettingsModal(() => render());
        return;
      }

      // Edit Mode Toggle
      if (target.closest('#edit-alarm-btn')) {
        isEditing = !isEditing;
        render();
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
    const builtIn = alarmManager.getBuiltInSounds().find(s => s.id === id);
    const custom = alarmManager.getCustomSounds().find(s => s.id === id);
    return builtIn ? builtIn.name : (custom ? custom.name : DEFAULT_SOUND.NAME || 'Radar (Default)');
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
                    <input type="text" id="modal-label" value="${alarm.label === 'Alarm' ? '' : alarm.label}" placeholder="Alarm" maxlength="200">
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
    }
  };
}
