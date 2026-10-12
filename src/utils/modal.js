import { escapeHtml } from './sanitize.js';

export function showModal({ title, content, onSave, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const safeTitle = escapeHtml(title);
  overlay.innerHTML = `
    <div class="modal-content">
      <h2 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; display:block;" title="${safeTitle}">${safeTitle}</h2>
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
    window.removeEventListener('keydown', handleEsc);
    overlay.onclick = null;
    saveBtn.onclick = null;
    cancelBtn.onclick = null;
    if (onClose) onClose(overlay);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') close();
  };

  window.addEventListener('keydown', handleEsc);

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
      cancelBtn.style.width = '100%';
    }
  }

  cancelBtn.onclick = close;

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  overlay.close = close;
  return overlay;
}
