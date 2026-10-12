/**
 * KeybindManager — The Stopwatch's keybinds modal: shortcut recording, conflict resolution
 * and rendering. The shortcuts themselves are registered and run by utils/shortcuts.js.
 *
 * Usage:
 *   const km = new KeybindManager({
 *     onUpdate: () => { ... }          // called when the shortcuts change (to re-render)
 *   });
 */

import { STORAGE_KEYS } from './constants.js';
import { DEFAULT_KEYBINDS, getKeybinds, getUnavailableShortcuts, suspendShortcuts, eventToAccelerator } from './shortcuts.js';

// What each shortcut does, in the user's words
const ACTION_LABELS = {
    toggle: 'Start or pause',
    lap: 'Lap',
    stop: 'Stop',
    reset: 'Reset'
};

export class KeybindManager {
    constructor({ onUpdate }) {
        this.onUpdate = onUpdate;

        // State
        this.keybinds = getKeybinds();
        this.isListeningForKey = null;

        // Bind handlers
        this._handleRecording = this._handleRecording.bind(this);
        this._handleShortcutsUpdated = () => this.onUpdate();

        // Register listeners
        window.addEventListener('keydown', this._handleRecording, { capture: true });
        // Re-render when Windows reports which shortcuts it couldn't register
        document.addEventListener('shortcuts-updated', this._handleShortcutsUpdated);
    }

    // --- Public API ---

    getKeybinds() {
        return this.keybinds;
    }

    isRecording() {
        return this.isListeningForKey;
    }

    startRecording(action) {
        this.isListeningForKey = action;
        suspendShortcuts(true);
    }

    cancelRecording() {
        this.isListeningForKey = null;
        suspendShortcuts(false);
    }

    resetToDefaults() {
        this.keybinds = { ...DEFAULT_KEYBINDS };
        this.isListeningForKey = null;
        this._save();
        suspendShortcuts(false);
    }

    // True if Windows refused this action's shortcut because another program already uses it
    _isUnavailable(action) {
        const accelerator = this.keybinds[action];
        return !!accelerator && getUnavailableShortcuts().includes(accelerator);
    }

    // Return the HTML for the shortcuts modal
    renderModal() {
        return `
        <div class="modal-overlay" id="keybinds-modal">
            <div class="modal-content" style="max-width: 400px;">
                <h2>Keyboard shortcuts</h2>
                <div class="keybind-list">
                    ${Object.entries(this.keybinds).map(([action, currentKey]) => `
                        <div class="keybind-item ${this._isUnavailable(action) ? 'unavailable' : ''}" data-action="${action}">
                            <div class="keybind-label">
                                <span>${ACTION_LABELS[action] || action}</span>
                                <div class="keybind-warning" data-action="${action}" style="display: ${this._isUnavailable(action) ? 'block' : 'none'};">In use by another app</div>
                            </div>
                            <button class="record-btn ${this.isListeningForKey === action ? 'recording' : ''}" data-action="${action}" aria-label="Change shortcut for ${ACTION_LABELS[action] || action}">
                                ${this.isListeningForKey === action ? 'Press keys…' : (currentKey || 'None')}
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" id="reset-defaults">Reset to defaults</button>
                    <button class="modal-btn primary" id="close-keybinds">Done</button>
                </div>
            </div>
        </div>
      `;
    }

    // Update the recording buttons inside an existing modal
    updateModalUI(container) {
        const kbModal = container.querySelector('#keybinds-modal');
        if (!kbModal) return;

        kbModal.querySelectorAll('.record-btn').forEach(btn => {
            const action = btn.dataset.action;
            const currentKey = this.keybinds[action];
            const isRec = this.isListeningForKey === action;

            btn.className = `record-btn ${isRec ? 'recording' : ''}`;
            btn.textContent = isRec ? 'Press keys…' : (currentKey || 'None');
        });

        kbModal.querySelectorAll('.keybind-warning').forEach(warning => {
            const unavailable = this._isUnavailable(warning.dataset.action);
            warning.style.display = unavailable ? 'block' : 'none';
            const item = warning.closest('.keybind-item');
            if (item) item.classList.toggle('unavailable', unavailable);
        });
    }

    // Attach the click handlers to the modal
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

        // Record buttons
        kbModal.querySelectorAll('.record-btn').forEach(btn => {
            btn.onclick = () => {
                this.startRecording(btn.dataset.action);
                this.updateModalUI(container);
            };
        });

        // Reset defaults
        kbModal.querySelector('#reset-defaults').onclick = () => {
            this.resetToDefaults();
            this.updateModalUI(container);
        };

        // Done / Close
        kbModal.querySelector('#close-keybinds').onclick = () => {
            this.isListeningForKey = null;
            onClose();
        };
    }

    // Remove all event listeners; call on component cleanup
    cleanup() {
        window.removeEventListener('keydown', this._handleRecording, { capture: true });
        document.removeEventListener('shortcuts-updated', this._handleShortcutsUpdated);
        if (this.isListeningForKey) this.cancelRecording();
    }

    // --- Private ---

    _save() {
        localStorage.setItem(STORAGE_KEYS.STOPWATCH_KEYBINDS, JSON.stringify(this.keybinds));
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
            const accelerator = eventToAccelerator(e);
            if (!accelerator) return;

            // Conflict resolution
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
            suspendShortcuts(false);
            this.onUpdate();
        } catch (err) {
            this.isListeningForKey = null;
            this.onUpdate();
        }
    }
}
