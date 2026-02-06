export function truncate(text, limit = 60) {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
}

export function showAlert(message, title = 'Notification') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000'; // Em cima de tudo

        overlay.innerHTML = `
            <div class="modal-content notification-modal animate-pop">
                <h2 style="margin-bottom: 10px;" title="${title}">${title}</h2>
                <div class="notification-body" style="text-align: center; color: var(--text-primary); margin: 15px 0; font-size: 16px; line-height: 1.4;">
                    ${message}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn save" id="notif-ok">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            resolve();
        };

        const okBtn = overlay.querySelector('#notif-ok');
        okBtn.onclick = close;

        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        // Tecla ESC
        const handleKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                window.removeEventListener('keydown', handleKey);
                close();
            }
        };
        window.addEventListener('keydown', handleKey);
    });
}

export function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000';

        overlay.innerHTML = `
            <div class="modal-content notification-modal animate-pop">
                <h2 style="margin-bottom: 10px;" title="${title}">${title}</h2>
                <div class="notification-body" style="text-align: center; color: var(--text-primary); margin: 15px 0; font-size: 16px; line-height: 1.4;">
                    ${message}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" id="notif-cancel">Cancel</button>
                    <button class="modal-btn save" id="notif-confirm">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const handleResult = (result) => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            window.removeEventListener('keydown', handleKey);
            resolve(result);
        };

        overlay.querySelector('#notif-cancel').onclick = () => handleResult(false);
        overlay.querySelector('#notif-confirm').onclick = () => handleResult(true);

        overlay.onclick = (e) => {
            if (e.target === overlay) handleResult(false);
        };

        // Teclas
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                handleResult(false);
            } else if (e.key === 'Enter') {
                handleResult(true);
            }
        };
        window.addEventListener('keydown', handleKey);
    });
}
