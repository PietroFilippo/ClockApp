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
 * @param {Function} options.onStop - handler for the stop button (formerly "Save").
 * @returns {HTMLElement} overlay element.
 */
export function showRingOverlay({ title, timeDisplay, label, actionButton, onStop }) {
    const safeTimeDisplay = escapeHtml(timeDisplay);
    const safeLabel = escapeHtml(label);
    const content = `
    <div style="text-align:center;">
        <h1 style="font-size:48px; margin:20px 0; overflow-wrap:break-word; word-wrap:break-word; text-align:center;">${safeTimeDisplay}</h1>
        <p style="color:var(--text-secondary); font-size:24px; margin-bottom:15px; overflow-wrap:break-word; word-wrap:break-word;" title="${safeLabel}">${safeLabel}</p>
        ${actionButton ? `<button class="modal-btn action-btn" style="background:var(--accent-orange); color:black; width:100%; margin-bottom:10px;">${escapeHtml(actionButton.text)}</button>` : ''}
    </div>
  `;

    const overlay = showModal({
        title: title,
        content: content,
        onSave: () => {
            if (onStop) onStop();
        }
    });

    // Set up primary action button
    if (actionButton) {
        const btn = overlay.querySelector('.action-btn');
        if (btn) {
            btn.onclick = () => {
                actionButton.onClick(overlay);
            };
        }
    }

    // Set up stop button
    const stopBtn = overlay.querySelector('.modal-btn.save');
    if (stopBtn) {
        stopBtn.textContent = 'Stop';
        stopBtn.style.background = 'var(--accent-red)';
        stopBtn.style.color = 'white';
    }

    // Hide cancel button and disable background click
    const cancelBtn = overlay.querySelector('.cancel');
    if (cancelBtn) cancelBtn.style.display = 'none';
    overlay.onclick = null;

    return overlay;
}
