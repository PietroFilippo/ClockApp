import { timezones } from '../data/timezones.js';
import { showModal } from '../utils/modal.js';
import { showConfirm, truncate, confirmDelete } from '../utils/notification.js';
import { escapeHtml } from '../utils/sanitize.js';
import { contextMenu } from '../utils/contextMenu.js';
import { STORAGE_KEYS } from '../utils/constants.js';

export function WorldClock() {
    const container = document.createElement('div');
    container.className = 'view-container world-clock-view';

    // Estado
    let clocks = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORLD_CLOCKS)) || [
        { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'Local Time' }
    ];
    let isEditing = false;
    let draggedItemIndex = null;
    let selectedClocks = new Set();

    initDelegatedListeners();

    function renderClocks() {
        // Cria a estrutura estática apenas uma vez
        if (!container.querySelector('.header')) {
            container.innerHTML = `
          <div class="header">
            <button class="edit-btn" id="edit-clock-btn">Edit</button>
            <h1>World Clock</h1>
            <button class="add-btn add-btn-container" id="add-clock-btn">+</button>
          </div>
          <div class="clock-list"></div>
        `;
        }

        // Atualiza header
        updateHeaderState();
        // Atualiza a lista de relógios
        updateClockList();
    }

    function updateHeaderState() {
        const editBtn = container.querySelector('#edit-clock-btn');
        if (editBtn) {
            if (isEditing && selectedClocks.size > 0) {
                editBtn.textContent = `Delete (${selectedClocks.size})`;
                editBtn.style.color = 'var(--accent-red)';
            } else {
                editBtn.textContent = isEditing ? 'Done' : 'Edit';
                editBtn.style.color = '';
            }
        }

        const addBtn = container.querySelector('#add-clock-btn');
        if (addBtn) addBtn.style.visibility = isEditing ? 'hidden' : 'visible';
    }

    function updateClockList() {
        const clockList = container.querySelector('.clock-list');
        if (!clockList) return;

        clockList.classList.toggle('edit-mode', isEditing);

        // Mapa de elementos existentes por index
        const existingCards = new Map();
        clockList.querySelectorAll('.clock-card[data-index]').forEach(el => {
            existingCards.set(Number(el.dataset.index), el);
        });

        // IDs (indexes) atuais
        const currentIndices = new Set(clocks.map((_, i) => i));

        // Remove cards que não existem mais
        for (const [idx, el] of existingCards) {
            if (!currentIndices.has(idx)) {
                el.remove();
                existingCards.delete(idx);
            }
        }

        // Atualiza ou cria cada card na ordem correta
        let previousNode = null;
        for (let i = 0; i < clocks.length; i++) {
            const clock = clocks[i];
            const existingEl = existingCards.get(i);
            const newHTML = createClockHTML(clock, i);

            if (existingEl) {
                // Atualiza conteúdo se mudou
                const temp = document.createElement('div');
                temp.innerHTML = newHTML;
                const newEl = temp.firstElementChild;

                if (existingEl.innerHTML !== newEl.innerHTML ||
                    existingEl.className !== newEl.className) {
                    existingEl.className = newEl.className;
                    existingEl.innerHTML = newEl.innerHTML;
                    existingEl.setAttribute('draggable', String(isEditing));
                }

                // Garante a ordem correta
                if (existingEl.previousElementSibling !== previousNode) {
                    if (previousNode) {
                        previousNode.after(existingEl);
                    } else {
                        clockList.prepend(existingEl);
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
                    clockList.prepend(newEl);
                }
                previousNode = newEl;
            }
        }
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

    function getGMTOffsetMinutes(timezone) {
        try {
            const now = new Date();
            const str = now.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset', hour12: false });
            const parts = str.split(' ');
            const offset = parts[parts.length - 1] || 'GMT';
            // Parse "GMT+5:30" or "GMT-3" or "GMT"
            if (offset === 'GMT') return 0;
            const match = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
            if (!match) return 0;
            const sign = match[1] === '+' ? 1 : -1;
            const hours = parseInt(match[2]) || 0;
            const minutes = parseInt(match[3]) || 0;
            return sign * (hours * 60 + minutes);
        } catch (e) {
            return 0;
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
      <div class="clock-card ${selectedClocks.has(index) ? 'selected' : ''}" data-index="${index}" draggable="${isEditing}">
        <button class="delete-clock-btn" data-index="${index}">−</button>
        <div class="clock-card-inner">
            <div class="clock-info">
            <span class="clock-label">${escapeHtml(clock.label)}</span>
            <span class="clock-timezone">${clock.country || clock.timezone} <span style="opacity: 0.6; font-size: 0.9em; margin-left: 5px;">${offsetString}</span></span>
            </div>
            <div class="clock-time">${timeString}</div>
        </div>
        ${isEditing ? `<input type="checkbox" class="select-checkbox" data-index="${index}" ${selectedClocks.has(index) ? 'checked' : ''} style="margin-left:12px;">` : ''}
        ${isEditing ? `<div class="drag-handle" draggable="true">≡</div>` : ''}
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
                if (isEditing && selectedClocks.size > 0) {
                    const count = selectedClocks.size;
                    if (await confirmDelete(`${count} clock${count > 1 ? 's' : ''}`, 'Selected')) {
                        // Deleta do maior index para o menor para evitar shift
                        const indices = [...selectedClocks].sort((a, b) => b - a);
                        for (const idx of indices) {
                            clocks.splice(idx, 1);
                        }
                        selectedClocks.clear();
                        saveClocks();
                        renderClocks();
                    }
                } else {
                    isEditing = !isEditing;
                    selectedClocks.clear();
                    renderClocks();
                }
                return;
            }

            // Seleciona checkbox no modo de editar
            if (target.classList.contains('select-checkbox')) {
                e.stopPropagation();
                const index = Number(target.dataset.index);
                if (target.checked) {
                    selectedClocks.add(index);
                } else {
                    selectedClocks.delete(index);
                }
                // Atualiza o texto do botão de edição
                const editBtn = container.querySelector('#edit-clock-btn');
                if (editBtn) {
                    if (selectedClocks.size > 0) {
                        editBtn.textContent = `Delete (${selectedClocks.size})`;
                        editBtn.style.color = 'var(--accent-red)';
                    } else {
                        editBtn.textContent = 'Done';
                        editBtn.style.color = '';
                    }
                }
                const card = target.closest('.clock-card');
                if (card) card.classList.toggle('selected', target.checked);
                return;
            }

            // Botão Delete Clock (single)
            if (target.closest('.delete-clock-btn')) {
                const btn = target.closest('.delete-clock-btn');
                const index = Number(btn.dataset.index);
                const clock = clocks[index];
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
        const reorderedClocks = [];
        const currentCards = container.querySelectorAll('.clock-card');
        currentCards.forEach(card => {
            const idx = Number(card.dataset.index);
            reorderedClocks.push(clocks[idx]);
        });

        clocks = reorderedClocks;
        saveClocks();
        renderClocks();
    }

    function saveClocks() {
        localStorage.setItem(STORAGE_KEYS.WORLD_CLOCKS, JSON.stringify(clocks));
    }

    function deleteClock(index) {
        clocks.splice(index, 1);
        saveClocks();
        selectedClocks.clear();
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

    // Modal de busca de cidade
    function openCitySearch() {
        // Filtros (reseta toda vez que o modal abre)
        let activeSort = 'az';       // 'az' | 'za' | 'gmt+' | 'gmt-'
        let activeContinent = 'All'; // 'All' | nome do continente
        let activeLetters = new Set(); // Letras selecionadas
        let searchTerm = '';

        const continents = ['All', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

        showModal({
            title: 'Choose City',
            content: `
                <input type="text" id="city-search" class="modal-input" placeholder="Search city or country..." style="width: 100%; margin-bottom: 12px;">
                
                <div class="city-filter-bar">
                    <div class="city-filter-row">
                        <div class="city-sort-dropdown">
                            <select id="city-sort">
                                <option value="az">A → Z</option>
                                <option value="za">Z → A</option>
                                <option value="gmt+">GMT ↑</option>
                                <option value="gmt-">GMT ↓</option>
                            </select>
                        </div>
                        <div class="city-sort-dropdown">
                            <select id="continent-filter">
                                ${continents.map(c => `<option value="${c}">${c === 'All' ? 'All Continents' : c}</option>`).join('')}
                            </select>
                        </div>
                        <button class="city-clear-btn" id="clear-filters" style="display:none;" title="Clear all filters">✕</button>
                    </div>
                    <div class="city-letter-index" id="letter-index">
                        ${letters.map(l => `<button class="letter-btn" data-letter="${l}">${l}</button>`).join('')}
                    </div>
                </div>

                <div id="city-list" class="city-list-container">
                    <!-- populated by JS -->
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
        const sortSelect = overlay.querySelector('#city-sort');
        const continentSelect = overlay.querySelector('#continent-filter');
        const letterIndexContainer = overlay.querySelector('#letter-index');
        const clearBtn = overlay.querySelector('#clear-filters');

        searchInput.focus();

        function hasActiveFilters() {
            return activeSort !== 'az' || activeContinent !== 'All' || activeLetters.size > 0 || searchTerm !== '';
        }

        function updateClearButton() {
            clearBtn.style.display = hasActiveFilters() ? 'flex' : 'none';
        }

        function applyFilters() {
            let filtered = [...timezones];

            // Procura de texto
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(tz =>
                    tz.city.toLowerCase().includes(term) ||
                    tz.country.toLowerCase().includes(term)
                );
            }

            // Filtro do continente
            if (activeContinent !== 'All') {
                filtered = filtered.filter(tz => tz.continent === activeContinent);
            }

            // Filtro das letras (multi-select)
            if (activeLetters.size > 0) {
                filtered = filtered.filter(tz => activeLetters.has(tz.city.charAt(0).toUpperCase()));
            }

            // Sort
            switch (activeSort) {
                case 'az':
                    filtered.sort((a, b) => a.city.localeCompare(b.city));
                    break;
                case 'za':
                    filtered.sort((a, b) => b.city.localeCompare(a.city));
                    break;
                case 'gmt+':
                    filtered.sort((a, b) => getGMTOffsetMinutes(a.zone) - getGMTOffsetMinutes(b.zone));
                    break;
                case 'gmt-':
                    filtered.sort((a, b) => getGMTOffsetMinutes(b.zone) - getGMTOffsetMinutes(a.zone));
                    break;
            }

            // Atualiza as letras disponíveis
            updateLetterAvailability(filtered);
            updateClearButton();

            cityListEl.innerHTML = renderCityList(filtered);
            attachCityListeners(overlay);
        }

        function updateLetterAvailability(currentList) {
            // Mostra a disponibilidade baseada na busca de texto + continente apenas (não filtro de letras)
            let baseFiltered = [...timezones];
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                baseFiltered = baseFiltered.filter(tz =>
                    tz.city.toLowerCase().includes(term) ||
                    tz.country.toLowerCase().includes(term)
                );
            }
            if (activeContinent !== 'All') {
                baseFiltered = baseFiltered.filter(tz => tz.continent === activeContinent);
            }

            const availableLetters = new Set(baseFiltered.map(tz => tz.city.charAt(0).toUpperCase()));
            letterIndexContainer.querySelectorAll('.letter-btn').forEach(btn => {
                const letter = btn.dataset.letter;
                const hasEntries = availableLetters.has(letter);
                btn.classList.toggle('disabled', !hasEntries);
                btn.classList.toggle('active', activeLetters.has(letter));
            });
        }

        // Input de busca
        searchInput.oninput = (e) => {
            searchTerm = e.target.value;
            applyFilters();
        };

        // Dropdown de ordenação
        sortSelect.onchange = (e) => {
            activeSort = e.target.value;
            applyFilters();
        };

        // Dropdown do continente
        continentSelect.onchange = (e) => {
            activeContinent = e.target.value;
            activeLetters.clear();
            applyFilters();
        };

        // Index de letras (multi-select toggle)
        letterIndexContainer.onclick = (e) => {
            const btn = e.target.closest('.letter-btn');
            if (!btn || btn.classList.contains('disabled')) return;

            const letter = btn.dataset.letter;

            // Toggle: adiciona ou remove do set
            if (activeLetters.has(letter)) {
                activeLetters.delete(letter);
            } else {
                activeLetters.add(letter);
            }

            applyFilters();
        };

        // Limpa todos os filtros
        clearBtn.onclick = () => {
            activeSort = 'az';
            activeContinent = 'All';
            activeLetters.clear();
            searchTerm = '';
            searchInput.value = '';
            sortSelect.value = 'az';
            continentSelect.value = 'All';
            applyFilters();
        };

        // Renderização inicial
        applyFilters();
    }

    function renderCityList(list) {
        if (list.length === 0) return '<div style="text-align:center; padding: 20px; color: #8e8e93;">No results</div>';
        return list.map(tz => {
            const offset = getGMTOffset(tz.zone);
            return `
        <button class="city-item-btn" data-zone="${tz.zone}" data-city="${escapeHtml(tz.city)}" data-country="${escapeHtml(tz.country)}"
            style="
                background: #2c2c2e; border: none; padding: 12px; border-radius: 8px; 
                color: white; text-align: left; cursor: pointer; display: flex; justify-content: space-between;
                align-items: center;
            ">
            <span style="font-weight: 500;">${escapeHtml(tz.city)}</span>
            <span style="color: #8e8e93; font-size: 14px;">${escapeHtml(tz.country)} <span style="opacity: 0.7; font-size: 0.9em; margin-left: 4px;">${offset}</span></span>
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
        saveClocks();
        renderClocks();
        updateTimes();
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
