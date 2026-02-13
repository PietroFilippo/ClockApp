/**
 * KeybindManager — Encapsula o estado de atalhos, gravação, resolução de conflitos,
 * renderização do modal, e registro de atalhos globais e locais.
 *
 * Usage:
 *   const km = new KeybindManager({
 *     onAction: (action) => { ... },   // chamado quando um atalho é acionado
 *     onUpdate: () => { ... }          // chamado quando as atalhos mudam (para re-render)
 *   });
 */

const DEFAULT_KEYBINDS = {
    toggle: 'Alt+P',
    lap: 'Alt+L',
    stop: 'Alt+S',
    reset: 'Alt+R'
};




import { STORAGE_KEYS } from './constants.js';

export class KeybindManager {
    constructor({ onAction, onUpdate }) {
        this.onAction = onAction;
        this.onUpdate = onUpdate;

        // State
        this.keybinds = JSON.parse(localStorage.getItem(STORAGE_KEYS.STOPWATCH_KEYBINDS)) || { ...DEFAULT_KEYBINDS };
        this.isListeningForKey = null;

        // Carrega configurações de atalhos globais
        let storedSettings = {};
        try {
            storedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
        } catch (e) { }
        this.useGlobalShortcuts = storedSettings.globalShortcuts !== false;

        // Registra shortcuts iniciais
        if (window.electronAPI) {
            window.electronAPI.removeGlobalShortcutListener();
            window.electronAPI.unregisterGlobalShortcuts();

            if (this.useGlobalShortcuts) {
                window.electronAPI.registerGlobalShortcuts(this.keybinds);
                window.electronAPI.onGlobalShortcut((action) => this.onAction(action));
            }
        }

        // Bind handlers
        this._handleLocalKeydown = this._handleLocalKeydown.bind(this);
        this._handleRecording = this._handleRecording.bind(this);

        // Registra listeners
        window.addEventListener('keydown', this._handleLocalKeydown);
        window.addEventListener('keydown', this._handleRecording, { capture: true });
    }

    // --- Public API ---

    getKeybinds() {
        return this.keybinds;
    }

    isRecording() {
        return this.isListeningForKey;
    }

    startRecording(action) {
        if (window.electronAPI) window.electronAPI.unregisterGlobalShortcuts();
        this.isListeningForKey = action;
    }

    cancelRecording() {
        this.isListeningForKey = null;
        if (window.electronAPI && this.useGlobalShortcuts) {
            window.electronAPI.registerGlobalShortcuts(this.keybinds);
        }
    }

    resetToDefaults() {
        this.keybinds = { ...DEFAULT_KEYBINDS };
        this.isListeningForKey = null;
        this._save();
        if (window.electronAPI) window.electronAPI.registerGlobalShortcuts(this.keybinds);
    }

    // Retorna o HTML do modal de atalhos
    renderModal() {
        return `
        <div class="modal-overlay" id="keybinds-modal">
            <div class="modal-content" style="max-width: 400px;">
                <h2>Customize Keybinds</h2>
                <div class="keybind-list">
                    ${Object.entries(this.keybinds).map(([action, currentKey]) => `
                        <div class="keybind-item">
                            <span>${action === 'reset' ? 'Special Reset' : action}</span>
                            <button class="record-btn ${this.isListeningForKey === action ? 'recording' : ''}" data-action="${action}">
                                ${this.isListeningForKey === action ? 'Press keys...' : currentKey}
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" id="reset-defaults">Defaults</button>
                    <button class="modal-btn primary" id="close-keybinds">Done</button>
                </div>
            </div>
        </div>
      `;
    }

    // Atualiza os botões de gravação dentro de um modal existente
    updateModalUI(container) {
        const kbModal = container.querySelector('#keybinds-modal');
        if (!kbModal) return;

        kbModal.querySelectorAll('.record-btn').forEach(btn => {
            const action = btn.dataset.action;
            const currentKey = this.keybinds[action];
            const isRec = this.isListeningForKey === action;

            btn.className = `record-btn ${isRec ? 'recording' : ''}`;
            btn.textContent = isRec ? 'Press keys...' : currentKey;
        });
    }

    // Anexa os handlers de clique ao modal
    attachModalListeners(container, onClose) {
        const kbModal = container.querySelector('#keybinds-modal');
        if (!kbModal) return;

        // Overlay click to close
        kbModal.onclick = (e) => {
            if (e.target === kbModal) {
                this.isListeningForKey = null;
                onClose();
            }
        };

        // Grava botões
        kbModal.querySelectorAll('.record-btn').forEach(btn => {
            btn.onclick = () => {
                this.startRecording(btn.dataset.action);
                this.updateModalUI(container);
            };
        });

        // Reseta defauts
        kbModal.querySelector('#reset-defaults').onclick = () => {
            this.resetToDefaults();
            this.updateModalUI(container);
        };

        // Done / Close
        kbModal.querySelector('#close-keybinds').onclick = () => {
            if (window.electronAPI && this.useGlobalShortcuts) {
                window.electronAPI.registerGlobalShortcuts(this.keybinds);
            }
            this.isListeningForKey = null;
            onClose();
        };
    }

    // Remove todos os event listeners, chama na limpeza do componente
    cleanup() {
        window.removeEventListener('keydown', this._handleLocalKeydown);
        window.removeEventListener('keydown', this._handleRecording, { capture: true });
    }

    // --- Private ---

    _save() {
        localStorage.setItem(STORAGE_KEYS.STOPWATCH_KEYBINDS, JSON.stringify(this.keybinds));
    }

    _handleLocalKeydown(e) {
        if (this.isListeningForKey) return;
        if (this.useGlobalShortcuts) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        let parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Command');

        let key = e.key.toUpperCase();
        if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return;

        parts.push(key);
        const accelerator = parts.join('+');

        const action = Object.keys(this.keybinds).find(k => this.keybinds[k] === accelerator);
        if (action) {
            e.preventDefault();
            this.onAction(action);
        }
    }

    _handleRecording(e) {
        if (!this.isListeningForKey) return;

        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            this.cancelRecording();
            this.onUpdate();
            return;
        }

        try {
            let parts = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            if (e.metaKey) parts.push('Command');

            let key = e.key.toUpperCase();
            if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return;

            parts.push(key);
            const accelerator = parts.join('+');

            // Resolução de conflito
            const existingAction = Object.keys(this.keybinds).find(
                k => this.keybinds[k] === accelerator && k !== this.isListeningForKey
            );

            if (existingAction) {
                const defaultKey = DEFAULT_KEYBINDS[existingAction];
                const isDefaultTaken = Object.entries(this.keybinds).some(
                    ([k, v]) => v === defaultKey && k !== existingAction && k !== this.isListeningForKey
                );
                const isDefaultBeingStolen = (defaultKey === accelerator);

                if (!isDefaultTaken && !isDefaultBeingStolen) {
                    this.keybinds[existingAction] = defaultKey;
                } else {
                    this.keybinds[existingAction] = '';
                }
            }

            this.keybinds[this.isListeningForKey] = accelerator;
            this.isListeningForKey = null;

            this._save();
            if (window.electronAPI && this.useGlobalShortcuts) {
                window.electronAPI.registerGlobalShortcuts(this.keybinds);
            }
            this.onUpdate();
        } catch (err) {
            this.isListeningForKey = null;
            this.onUpdate();
        }
    }
}
