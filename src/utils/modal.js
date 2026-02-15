import { escapeHtml } from './sanitize.js';

export function showModal({ title, content, onSave }) {
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

  const close = () => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    window.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') close();
  };

  window.addEventListener('keydown', handleEsc);

  overlay.querySelector('.cancel').onclick = close;
  overlay.querySelector('.save').onclick = () => {
    onSave(overlay);
    close();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  return overlay;
}
