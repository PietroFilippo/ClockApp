import { timezones } from '../data/timezones.js';
import { showModal } from '../utils/modal.js';
import { showConfirm, truncate } from '../utils/notification.js';
import { contextMenu } from '../utils/contextMenu.js';

export function WorldClock() {
    const container = document.createElement('div');
    container.className = 'view-container world-clock-view';

    // Estado
    let clocks = JSON.parse(localStorage.getItem('worldClocks')) || [
        { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'Local Time' }
    ];
    let isEditing = false;
    let draggedItemIndex = null;

    function renderClocks() {
        container.innerHTML = `
      <div class="header">
        <button class="edit-btn" id="edit-clock-btn">${isEditing ? 'Done' : 'Edit'}</button>
        <h1>World Clock</h1>
        <button class="add-btn add-btn-container" id="add-clock-btn" style="visibility: ${isEditing ? 'hidden' : 'visible'}">+</button>
      </div>
      <div class="clock-list ${isEditing ? 'edit-mode' : ''}">
        ${clocks.map((clock, index) => createClockHTML(clock, index)).join('')}
      </div>
    `;

        // Reanexa listeners
        container.querySelector('#add-clock-btn').onclick = openCitySearch;
        container.querySelector('#edit-clock-btn').onclick = toggleEditMode;

        // Menu de contexto
        container.querySelectorAll('.clock-card').forEach(card => {
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const index = Number(card.dataset.index);
                const clock = clocks[index];

                contextMenu.show(e.clientX, e.clientY, [
                    {
                        label: 'Delete',
                        danger: true,
                        action: async () => {
                            const truncatedLabel = truncate(clock.label, 60);
                            const msg = `Remove <span title="${clock.label}">${truncatedLabel}</span>?`;
                            if (await showConfirm(msg, 'Remove Clock')) {
                                deleteClock(index);
                            }
                        }
                    }
                ]);
            });
        });

        // Listeners de exclusão (existing)
        container.querySelectorAll('.delete-clock-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const index = Number(e.currentTarget.dataset.index);
                const clock = clocks[index];
                const truncatedLabel = truncate(clock.label, 60);
                const msg = `Remove <span title="${clock.label}">${truncatedLabel}</span>?`;
                if (await showConfirm(msg, 'Remove Clock')) {
                    deleteClock(index);
                }
            };
        });

        // Listeners de arrastar (ativos apenas no modo de edição)
        if (isEditing) {
            enableDragAndDrop();
        }
    }

    function getGMTOffset(timezone) {
        try {
            const now = new Date();
            const str = now.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset', hour12: false });
            // Extrai o deslocamento GMT/UTC geralmente no final, exemplo: "12:00:00 GMT+3" ou "GMT-5"
            const parts = str.split(' ');
            return parts[parts.length - 1] || '';
        } catch (e) {
            return '';
        }
    }

    function createClockHTML(clock, index) {
        const now = new Date();
        let timeString = '--:--';
        let offsetString = '';
        try {
            timeString = now.toLocaleTimeString('en-US', {
                timeZone: clock.timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            offsetString = getGMTOffset(clock.timezone);
        } catch (e) { }

        return `
      <div class="clock-card" data-index="${index}" draggable="${isEditing}">
        <button class="delete-clock-btn" data-index="${index}">−</button>
        <div class="clock-card-inner">
            <div class="clock-info">
            <span class="clock-label">${clock.label}</span>
            <span class="clock-timezone">${clock.country || clock.timezone} <span style="opacity: 0.6; font-size: 0.9em; margin-left: 5px;">${offsetString}</span></span>
            </div>
            <div class="clock-time">${timeString}</div>
        </div>
        <div class="drag-handle" draggable="true">≡</div>
      </div>
    `;
    }

    function toggleEditMode() {
        isEditing = !isEditing;
        renderClocks();
    }

    function enableDragAndDrop() {
        const cards = container.querySelectorAll('.clock-card');
        const list = container.querySelector('.clock-list');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedItemIndex = Number(card.dataset.index);
                card.classList.add('dragging');
                // Obrigatório pro Firefox
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedItemIndex = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault(); // Permite soltar
                const afterElement = getDragAfterElement(list, e.clientY);
                const draggable = document.querySelector('.dragging');
                if (afterElement == null) {
                    list.appendChild(draggable);
                } else {
                    list.insertBefore(draggable, afterElement);
                }
            });

            // Manipula drop pra salvar o estado
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                saveNewOrder();
            });
        });
        // Ouve na lista por drop se solto na parte inferior
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            saveNewOrder();
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.clock-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function saveNewOrder() {
        // Reconstrói array com base na ordem do DOM
        const newClocks = [];
        container.querySelectorAll('.clock-card').forEach(card => {
            const oldIndex = Number(card.dataset.index);
            newClocks.push(clocks[oldIndex]);
        });

        const reorderedClocks = [];
        const currentCards = container.querySelectorAll('.clock-card');
        currentCards.forEach(card => {
            const idx = Number(card.dataset.index);
            reorderedClocks.push(clocks[idx]);
        });

        clocks = reorderedClocks;
        localStorage.setItem('worldClocks', JSON.stringify(clocks));

        // Re-renderiza pra atualizar os índices
        renderClocks();
    }

    function updateTimes() {
        const timeElements = container.querySelectorAll('.clock-time');
        timeElements.forEach((el, index) => {
            const clock = clocks[index];
            const now = new Date();
            try {
                el.textContent = now.toLocaleTimeString('en-US', {
                    timeZone: clock.timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            } catch (e) { }
        });
    }

    function openCitySearch() {
        showModal({
            title: 'Choose City',
            content: `
            <input type="text" id="city-search" class="modal-input" placeholder="Search city..." style="width: 100%; margin-bottom: 10px;">
            <div id="city-list" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; min-height: 200px;">
                ${renderCityList(timezones)}
            </div>
        `,
            onSave: () => { }
        });

        const overlay = document.querySelector('.modal-overlay');
        if (!overlay) return;

        const saveBtn = overlay.querySelector('.save');
        if (saveBtn) saveBtn.style.display = 'none';

        const searchInput = overlay.querySelector('#city-search');
        const cityListEl = overlay.querySelector('#city-list');

        searchInput.focus();

        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = timezones.filter(tz =>
                tz.city.toLowerCase().includes(term) ||
                tz.country.toLowerCase().includes(term)
            );
            cityListEl.innerHTML = renderCityList(filtered);
            attachCityListeners(overlay);
        };

        attachCityListeners(overlay);
    }

    function renderCityList(list) {
        if (list.length === 0) return '<div style="text-align:center; padding: 20px; color: #8e8e93;">No results</div>';
        return list.map(tz => {
            const offset = getGMTOffset(tz.zone);
            return `
        <button class="city-item-btn" data-zone="${tz.zone}" data-city="${tz.city}" data-country="${tz.country}"
            style="
                background: #2c2c2e; border: none; padding: 12px; border-radius: 8px; 
                color: white; text-align: left; cursor: pointer; display: flex; justify-content: space-between;
                align-items: center;
            ">
            <span style="font-weight: 500;">${tz.city}</span>
            <span style="color: #8e8e93; font-size: 14px;">${tz.country} <span style="opacity: 0.7; font-size: 0.9em; margin-left: 4px;">${offset}</span></span>
        </button>
      `}).join('');
    }

    function attachCityListeners(overlay) {
        const btns = overlay.querySelectorAll('.city-item-btn');
        btns.forEach(btn => {
            btn.onclick = () => {
                const zone = btn.dataset.zone;
                const city = btn.dataset.city;
                const country = btn.dataset.country;
                addClock({ timezone: zone, label: city, country: country });
                document.body.removeChild(overlay);
            };
        });
    }

    function addClock(clockData) {
        if (clocks.some(c => c.timezone === clockData.timezone)) {
            return;
        }
        clocks.push(clockData);
        localStorage.setItem('worldClocks', JSON.stringify(clocks));
        renderClocks();
        updateTimes();
    }

    function deleteClock(index) {
        clocks.splice(index, 1);
        localStorage.setItem('worldClocks', JSON.stringify(clocks));
        renderClocks();
    }

    renderClocks();

    const intervalId = setInterval(updateTimes, 1000);

    return {
        element: container,
        cleanup: () => {
            clearInterval(intervalId);
        }
    };
}
