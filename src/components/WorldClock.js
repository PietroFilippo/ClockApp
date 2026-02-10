import { timezones } from '../data/timezones.js';
import { showModal } from '../utils/modal.js';
import { showConfirm, truncate, confirmDelete } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
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

    initDelegatedListeners();

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
    }

    function getGMTOffset(timezone) {
        try {
            const now = new Date();
            const str = now.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset', hour12: false });
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
            <span class="clock-label">${escapeHtml(clock.label)}</span>
            <span class="clock-timezone">${clock.country || clock.timezone} <span style="opacity: 0.6; font-size: 0.9em; margin-left: 5px;">${offsetString}</span></span>
            </div>
            <div class="clock-time">${timeString}</div>
        </div>
        <div class="drag-handle" draggable="true">≡</div>
      </div>
    `;
    }

    function initDelegatedListeners() {
        container.addEventListener('click', async (e) => {
            const target = e.target;

            // Header Buttons
            if (target.closest('#add-clock-btn')) {
                openCitySearch();
                return;
            }

            if (target.closest('#edit-clock-btn')) {
                isEditing = !isEditing;
                renderClocks();
                return;
            }

            // Botão Delete Clock
            if (target.closest('.delete-clock-btn')) {
                const btn = target.closest('.delete-clock-btn');
                const index = Number(btn.dataset.index);
                const clock = clocks[index];
                // Safety check
                if (!clock) return;

                if (await confirmDelete(clock.label, 'Clock')) {
                    deleteClock(index);
                }
                return;
            }
        });

        container.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.clock-card');
            if (card) {
                e.preventDefault();
                const index = Number(card.dataset.index);
                const clock = clocks[index];
                if (!clock) return;

                contextMenu.show(e.clientX, e.clientY, [
                    {
                        label: 'Delete',
                        danger: true,
                        action: async () => {
                            if (await confirmDelete(clock.label, 'Clock')) {
                                deleteClock(index);
                            }
                        }
                    }
                ]);
            }
        });

        // Drag and Drop Delegation
        container.addEventListener('dragstart', (e) => {
            if (!isEditing) {
                e.preventDefault();
                return;
            }
            const card = e.target.closest('.clock-card');
            if (card) {
                draggedItemIndex = Number(card.dataset.index);
                // setTimeout para o drag ghost ser criado antes de esconder o elemento
                setTimeout(() => card.classList.add('dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        container.addEventListener('dragend', (e) => {
            const card = e.target.closest('.clock-card');
            if (card) {
                card.classList.remove('dragging');
                draggedItemIndex = null;
            }
        });

        // dragover precisa estar no container da lista para permitir o drop
        container.addEventListener('dragover', (e) => {
            if (!isEditing) return;
            e.preventDefault(); // permite drop

            const list = container.querySelector('.clock-list');
            if (!list) return;

            const afterElement = getDragAfterElement(list, e.clientY);
            const draggable = list.querySelector('.dragging');
            if (!draggable) return;

            if (afterElement == null) {
                list.appendChild(draggable);
            } else {
                list.insertBefore(draggable, afterElement);
            }
        });

        container.addEventListener('drop', (e) => {
            if (!isEditing) return;
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
        // Pausa atualizações durante drag para evitar glitch visual
        if (draggedItemIndex !== null) return;

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
