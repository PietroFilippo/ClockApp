import { alarmManager } from '../modules/AlarmManager.js';
import { audioManager } from '../utils/AudioManager.js';
import { showModal } from '../utils/modal.js';
import { showAlert, showConfirm, truncate } from '../utils/notification.js';
import { openSoundPicker } from '../utils/SoundPicker.js';
import { openSoundSettingsModal } from '../utils/SoundSettingsModal.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS, DEFAULT_SOUND } from '../utils/constants.js';

export function Alarm() {
  const container = document.createElement('div');
  container.className = 'view-container';

  let isEditing = false;
  let ignoreNextUpdate = false;

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
      let labelText = alarm.label;
      let subTextClass = 'alarm-label';

      if (isSnoozing) {
        labelText = `Snoozing until ${isSnoozing} <button class="cancel-snooze-btn" data-id="${alarm.id}" title="Cancel Snooze">✕</button>`;
        subTextClass = 'alarm-label snoozing';
      } else if (alarm.repeat && alarm.repeat.length > 0) {
        labelText += `, ${formatDays(alarm.repeat)}`;
      }

      return `
          <div class="alarm-item" style="position:relative;">
             ${isEditing ? `<button class="delete-clock-btn" data-id="${alarm.id}">−</button>` : ''}
             
            <div class="alarm-info" data-id="${alarm.id}" style="padding-left: ${isEditing ? '40px' : '0'}; transition: padding 0.3s; cursor: pointer; width: 100%;">
              <span class="alarm-time ${!alarm.enabled ? 'disabled' : ''}">${alarm.time}</span>
              <span class="${subTextClass}" style="${isSnoozing ? 'color: var(--accent-orange);' : ''}" title="${labelText.replace(/<[^>]*>?/gm, '')}">${labelText}</span>
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

    attachListeners();
  }

  function formatDays(days) {
    if (!days || days.length === 0) return '';
    if (days.length === 7) return 'Every day';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  }

  function attachListeners() {
    container.querySelector('#add-alarm-btn').onclick = () => openAlarmModal();
    container.querySelector('#audio-settings-btn').onclick = () => openSoundSettingsModal(() => render());
    container.querySelector('#edit-alarm-btn').onclick = () => {
      isEditing = !isEditing;
      render();
    };

    container.querySelectorAll('.alarm-toggle').forEach(toggle => {
      toggle.onchange = (e) => {
        e.stopPropagation();
        const id = Number(e.target.dataset.id);

        // Previne loop de re-renderização completo
        ignoreNextUpdate = true;
        alarmManager.toggleAlarm(id);

        // Atualização UI granular
        const item = e.target.closest('.alarm-item');
        const timeDisplay = item.querySelector('.alarm-time');
        if (timeDisplay) {
          timeDisplay.classList.toggle('disabled', !e.target.checked);
        }
      };
    });

    // Edita clicando no item
    container.querySelectorAll('.alarm-info').forEach(info => {
      info.onclick = (e) => {
        // abre modal de edição mesmo no modo de edição (no estilo iOS)
        const id = Number(e.currentTarget.dataset.id);
        openAlarmModal(id);
      };

      // Menu de contexto
      info.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = Number(e.currentTarget.dataset.id);
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
            action: async () => {
              const label = alarm && alarm.label ? alarm.label : 'Alarm';
              const truncatedLabel = truncate(label, 60);
              const confirmMsg = alarm && alarm.label
                ? `Delete "<span title="${label.replace(/"/g, '&quot;')}">${truncatedLabel}</span>" ? `
                : `Delete alarm for ${alarm ? alarm.time : 'this time'} ? `;

              if (await showConfirm(confirmMsg, 'Delete Alarm')) {
                alarmManager.deleteAlarm(id);
                render();
              }
            }
          }
        ]);
      });
    });

    if (isEditing) {
      container.querySelectorAll('.delete-clock-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = Number(e.currentTarget.dataset.id);
          const alarm = alarmManager.getAlarms().find(a => a.id === id);
          const label = alarm && alarm.label ? alarm.label : 'Alarm';
          const truncatedLabel = truncate(label, 60);
          const confirmMsg = alarm && alarm.label
            ? `Delete "<span title="${label.replace(/"/g, '&quot;')}">${truncatedLabel}</span>" ? `
            : `Delete alarm for ${alarm ? alarm.time : 'this time'} ? `;

          if (await showConfirm(confirmMsg, 'Delete Alarm')) {
            alarmManager.deleteAlarm(id);
            render();
          }
        };
      });
    }

    container.querySelectorAll('.cancel-snooze-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = Number(e.target.dataset.id);
        alarmManager.cancelSnooze(id);
        render();
      };
    });
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

    const content = `
      <div style="text-align:center; padding: 20px 0;">
                <input type="time" id="modal-time" value="${alarm.time}" style="font-size: 48px; background: transparent; border: none; color: white; font-family: inherit;">
            </div>
            
            <div class="modal-section">
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

      overlay.querySelectorAll('.day-option').forEach(opt => {
        opt.onclick = () => {
          opt.classList.toggle('selected');
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
