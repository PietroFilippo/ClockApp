// Stopwatch keyboard shortcuts. With "Global Shortcuts" on they're registered system-wide;
// otherwise they work while the app is focused, on any tab. main.js calls initShortcuts() at startup.
import { STORAGE_KEYS } from './constants.js';
import { loadJSON, isPlainObject } from './storage.js';
import { stopwatchManager } from '../modules/StopwatchManager.js';

export const DEFAULT_KEYBINDS = {
    toggle: 'Alt+P',
    lap: 'Alt+L',
    stop: 'Alt+S',
    reset: 'Alt+R'
};

let keybinds = getKeybinds();
let globalEnabled = false;
let suspended = false; // While a new shortcut is being recorded
let unavailable = []; // Accelerators Windows refused because another program already uses them
let applyCount = 0;

export function getKeybinds() {
    return loadJSON(STORAGE_KEYS.STOPWATCH_KEYBINDS, { ...DEFAULT_KEYBINDS }, isPlainObject);
}

export const isGlobalEnabled = () => globalEnabled;
export const getUnavailableShortcuts = () => unavailable;

export function runShortcutAction(action) {
    switch (action) {
        case 'toggle':
            stopwatchManager.isRunning ? stopwatchManager.stop() : stopwatchManager.start();
            break;
        case 'lap':
            if (stopwatchManager.isRunning) stopwatchManager.lap();
            break;
        case 'stop':
            if (stopwatchManager.isRunning) stopwatchManager.stop();
            break;
        case 'reset':
            stopwatchManager.specialReset();
            break;
    }
}

// Turn a keydown event into an Electron accelerator like "Alt+P" (null for a lone modifier key)
export function eventToAccelerator(e) {
    const key = e.key.toUpperCase();
    if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return null;

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Command');
    parts.push(key);
    return parts.join('+');
}

// Register the shortcuts system-wide, or drop them, to match the setting and the saved keybinds
export async function applyShortcuts(enabled = globalEnabled) {
    globalEnabled = enabled;
    keybinds = getKeybinds();
    if (!window.electronAPI) return;

    const call = ++applyCount;
    let refused = [];
    if (enabled && !suspended) {
        refused = (await window.electronAPI.registerGlobalShortcuts(keybinds)) || [];
    } else {
        window.electronAPI.unregisterGlobalShortcuts();
    }

    // Ignore the answer if a newer call has already replaced it
    if (call !== applyCount) return;
    unavailable = refused;
    document.dispatchEvent(new CustomEvent('shortcuts-updated'));
}

// While a new shortcut is being recorded, the current ones must not fire
export function suspendShortcuts(isSuspended) {
    suspended = isSuspended;
    return applyShortcuts();
}

function handleLocalKeydown(e) {
    if (globalEnabled || suspended || e.defaultPrevented) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    const accelerator = eventToAccelerator(e);
    const action = accelerator && Object.keys(keybinds).find(k => keybinds[k] === accelerator);
    if (action) {
        e.preventDefault();
        runShortcutAction(action);
    }
}

export function initShortcuts(enabled) {
    if (window.electronAPI) window.electronAPI.onGlobalShortcut(runShortcutAction);
    window.addEventListener('keydown', handleLocalKeydown);
    return applyShortcuts(enabled);
}
