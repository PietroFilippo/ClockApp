import { escapeHtml } from './sanitize.js';

export function showModal({ title, content, onSave, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const safeTitle = escapeHtml(title);
  overlay.innerHTML = `
    <div class="modal-content">
      <h2 title="${safeTitle}">${safeTitle}</h2>
      ${content}
      <div class="modal-actions">
        <button class="modal-btn cancel">Cancel</button>
        <button class="modal-btn save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    window.removeEventListener('keydown', handleKey);
    overlay.onclick = null;
    saveBtn.onclick = null;
    cancelBtn.onclick = null;
    if (onClose) onClose(overlay);
  };

  // Only the modal on top reacts to the keyboard (a sound picker can open over an alarm modal)
  const isTopmost = () => {
    const overlays = document.querySelectorAll('.modal-overlay');
    return overlays[overlays.length - 1] === overlay;
  };

  const handleKey = (e) => {
    if (!isTopmost()) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    // Enter saves, unless the focused control handles it itself (buttons, multi-line text)
    // or the modal has no visible Save button
    if (e.key === 'Enter' && onSave && !e.isComposing && !e.repeat) {
      const target = e.target;
      if (target && target.closest && target.closest('button, textarea, a, [contenteditable]')) return;
      if (getComputedStyle(saveBtn).display === 'none') return;
      e.preventDefault();
      saveBtn.click();
    }
  };

  window.addEventListener('keydown', handleKey);

  const saveBtn = overlay.querySelector('.save');
  const cancelBtn = overlay.querySelector('.cancel');

  if (onSave) {
    saveBtn.onclick = () => {
      const result = onSave(overlay);
      if (result !== false) close();
    };
  } else {
    saveBtn.style.display = 'none';
    if (cancelBtn) {
      cancelBtn.textContent = 'OK';
      cancelBtn.classList.add('primary'); // make it look like a primary button if it is the only one
    }
  }

  cancelBtn.onclick = close;

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  overlay.close = close;
  return overlay;
}
