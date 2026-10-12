import { showModal } from '../utils/modal.js';
import { escapeHtml } from '../utils/sanitize.js';

/**
 * Shows the ringing overlay for Alarms or Timers.
 *
 * @param {Object} options
 * @param {string} options.title - modal title.
 * @param {string} options.timeDisplay - main text (e.g., time or "Time is up!").
 * @param {string} options.label - subtitle/label text.
 * @param {Object} [options.actionButton] - primary action button.
 * @param {string} options.actionButton.text - button text (e.g., "Snooze", "Repeat").
 * @param {Function} options.actionButton.onClick - click handler for the primary action button.
 * @param {Object} [options.secondaryButton] - extra button with the same shape as actionButton.
 * @param {string} [options.stopLabel] - stop button text (default "Stop").
 * @param {string} [options.type] - alert type ('alarm', 'timer', 'interval'); sets a ring-overlay--<type> class.
 * @param {Function} options.onStop - handler for the stop button (formerly "Save"); Escape also stops.
 * @returns {HTMLElement} overlay element, with dismiss() to remove it without stopping the alert.
 */
export function showRingOverlay({ title, timeDisplay, label, actionButton, secondaryButton, stopLabel = 'Stop', type, onStop }) {
    const safeTimeDisplay = escapeHtml(timeDisplay);
    const safeLabel = escapeHtml(label);
    const content = `
    <div class="ring-overlay-body">
        <h1 class="ring-overlay-time">${safeTimeDisplay}</h1>
        <p class="ring-overlay-label" title="${safeLabel}">${safeLabel}</p>
        ${actionButton ? `<button class="modal-btn action-btn ring-overlay-action">${escapeHtml(actionButton.text)}</button>` : ''}
        ${secondaryButton ? `<button class="modal-btn secondary-btn ring-overlay-secondary">${escapeHtml(secondaryButton.text)}</button>` : ''}
    </div>
  `;

    // Set once the alert is dealt with, so the modal closing afterwards doesn't stop it a second time
    let handled = false;
    const stop = () => {
        if (handled) return;
        handled = true;
        if (onStop) onStop();
    };

    const overlay = showModal({
        title: title,
        content: content,
        onSave: stop,
        // Escape closes the modal too: treat it as Stop, so the alert can't keep ringing with no overlay left
        onClose: stop
    });
    overlay.classList.add('ring-overlay');
    if (type) overlay.classList.add(`ring-overlay--${type}`);

    overlay.dismiss = () => {
        handled = true;
        overlay.close();
    };

    // Set up the action buttons
    [[actionButton, '.action-btn'], [secondaryButton, '.secondary-btn']].forEach(([button, selector]) => {
        const btn = button && overlay.querySelector(selector);
        if (btn) {
            btn.onclick = () => {
                handled = true;
                button.onClick(overlay);
            };
        }
    });

    // Set up stop button
    const stopBtn = overlay.querySelector('.modal-btn.save');
    if (stopBtn) {
        stopBtn.textContent = stopLabel;
        stopBtn.classList.add('ring-overlay-stop');
    }

    // Hide cancel button and disable background click
    const cancelBtn = overlay.querySelector('.cancel');
    if (cancelBtn) cancelBtn.style.display = 'none';
    overlay.onclick = null;

    return overlay;
}
