export function truncate(text, limit = 60) {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
}

function createModalBase(title, message, buttons) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '3000';

    const buttonsHtml = buttons.map(btn =>
        `<button class="modal-btn ${btn.className}" id="${btn.id}">${btn.label}</button>`
    ).join('');

    overlay.innerHTML = `
        <div class="modal-content notification-modal animate-pop">
            <h2 style="margin-bottom: 10px;"></h2>
            <div class="notification-body" style="text-align: center; color: var(--text-primary); margin: 15px 0; font-size: 16px; line-height: 1.4;">
            </div>
            <div class="modal-actions">
                ${buttonsHtml}
            </div>
        </div>
    `;

    const titleEl = overlay.querySelector('h2');
    titleEl.textContent = title;
    titleEl.title = title;

    const bodyEl = overlay.querySelector('.notification-body');
    if (message instanceof Node) {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(message);
    } else if (typeof message === 'string' && message.trim().startsWith('<')) {
        bodyEl.innerHTML = message;
    } else {
        bodyEl.textContent = message;
    }

    document.body.appendChild(overlay);
    return overlay;
}

function cleanup(overlay, handleKey) {
    if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
    }
    if (handleKey) window.removeEventListener('keydown', handleKey);
}

export function showAlert(message, title = 'Notification') {
    return new Promise((resolve) => {
        const isSuccess = title.toLowerCase() === 'success';
        const content = isSuccess ? `
            <div style="text-align: center; padding: 10px 0;">
                <div style="font-size: 40px; margin-bottom: 15px;">✅</div>
                <h3 style="margin-bottom: 10px; font-weight: 600;">${title}</h3>
                <div style="color: var(--text-secondary); margin-bottom: 5px;">${message}</div>
            </div>
        ` : message;

        const overlay = createModalBase(isSuccess ? '' : title, content, [
            { label: 'OK', className: 'save', id: 'notif-ok' }
        ]);

        // Handler para fechar (sem valor de retorno específico além de void/undefined)
        const close = () => {
            cleanup(overlay, handleKey);
            resolve();
        };

        const handleKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') close();
        };
        window.addEventListener('keydown', handleKey);

        overlay.querySelector('#notif-ok').onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };
    });
}

export function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const overlay = createModalBase(title, message, [
            { label: 'Cancel', className: 'cancel', id: 'notif-cancel' },
            { label: 'OK', className: 'save', id: 'notif-confirm' }
        ]);

        const handleResult = (result) => {
            cleanup(overlay, handleKey);
            resolve(result);
        };

        const handleKey = (e) => {
            if (e.key === 'Escape') handleResult(false);
            else if (e.key === 'Enter') handleResult(true);
        };
        window.addEventListener('keydown', handleKey);

        overlay.querySelector('#notif-cancel').onclick = () => handleResult(false);
        overlay.querySelector('#notif-confirm').onclick = () => handleResult(true);
        overlay.onclick = (e) => {
            if (e.target === overlay) handleResult(false);
        };
    });
}

export async function confirmDelete(label, context = 'Item') {
    const container = document.createElement('span');
    container.textContent = `Delete "`;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = truncate(label, 60);
    labelSpan.title = label; // Tooltip com o texto completo
    labelSpan.style.fontWeight = 'bold';
    labelSpan.style.color = 'var(--text-primary)';

    container.appendChild(labelSpan);
    container.appendChild(document.createTextNode(`"?`));

    return await showConfirm(container, `Delete ${context}`);
}
