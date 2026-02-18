// SwipeToDelete — arrastar pra esquerda para deletar no estilo iPhone

export class SwipeToDelete {
    constructor({ container, itemSelector, onDelete, isDisabled }) {
        this.container = container;
        this.itemSelector = itemSelector;
        this.onDelete = onDelete;
        this.isDisabled = isDisabled || (() => false);

        // Estado
        this.activeItem = null;
        this.startX = 0;
        this.currentX = 0;
        this.isSwiping = false;
        this._swipeOccurred = false;
        this._closeTimeout = null;
        this.deleteWidth = 80;
        this.threshold = 60;    

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onClick = this._onClick.bind(this);

        container.addEventListener('pointerdown', this._onPointerDown);
        container.addEventListener('click', this._onClick, true); // captura para delete btn
    }

    // Ponteiros
    _onPointerDown(e) {
        if (this.isDisabled()) return;
        // Ignora right-click
        if (e.button !== 0) return;

        const item = e.target.closest(this.itemSelector);
        if (!item) return;

        // Não arrasta se estiver clicando em controles interativos (switch, botões, checkboxes)
        const interactive = e.target.closest('button, input, label, .switch, .control-btn, .save-timer-btn');
        if (interactive && !e.target.closest('.swipe-delete-btn')) return;

        // Se já houver um item aberto e o usuário tocar em outro lugar ele fecha
        if (this.activeItem && this.activeItem !== item) {
            this._closeSwipe(this.activeItem);
        }

        // Verifica se este item já tá no estado "aberto"
        const content = item.querySelector('.swipe-content');
        if (!content) return;

        this.startX = e.clientX;
        this.currentX = e.clientX;
        this.isSwiping = false;
        this._pendingItem = item;
        this._startY = e.clientY;
        this._directionLocked = false;

        document.addEventListener('pointermove', this._onPointerMove);
        document.addEventListener('pointerup', this._onPointerUp);
    }

    _onPointerMove(e) {
        if (!this._pendingItem) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this._startY;

        // Bloqueia direção no primeiro movimento significativo
        if (!this._directionLocked) {
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            this._directionLocked = true;
            if (Math.abs(dy) > Math.abs(dx)) {
                this._cleanup();
                return;
            }
            this._pendingItem.classList.add('swiping');
        }

        e.preventDefault(); // previne text selection / scrollar enquanto arrasta

        this.isSwiping = true;
        this.currentX = e.clientX;

        const item = this._pendingItem;
        const content = item.querySelector('.swipe-content');
        if (!content) return;

        // Calcula o offset, só permite arrastar para a esquerda (negativo)
        const isOpen = item.classList.contains('swipe-open');
        const baseOffset = isOpen ? -this.deleteWidth : 0;
        let offset = baseOffset + dx;

        // não arrasta para a direita além da origem, e limita o arrasto para a esquerda
        offset = Math.min(0, Math.max(-this.deleteWidth * 1.3, offset));

        content.style.transition = 'none';
        content.style.transform = `translateX(${offset}px)`;

        // Mostra o botão de deletar só quando há espaço real exposto
        const btn = item.querySelector('.swipe-delete-btn');
        if (btn) {
            const absOffset = Math.abs(offset);
            if (absOffset > 40) {
                btn.style.visibility = 'visible';
                const progress = Math.min(1, (absOffset - 40) / (this.deleteWidth - 40));
                btn.style.opacity = progress;
                btn.style.transform = `translateY(-50%) scale(${progress})`;
                btn.style.transition = 'none';
            } else {
                btn.style.visibility = 'hidden';
                btn.style.opacity = 0;
                btn.style.transform = 'translateY(-50%) scale(0)';
            }
        }
    }

    _onPointerUp(e) {
        const item = this._pendingItem;
        this._cleanupListeners();

        if (!item) return;

        if (!this.isSwiping) {
            if (item.classList.contains('swipe-open')) {
                const deleteBtn = e.target.closest('.swipe-delete-btn');
                if (!deleteBtn) {
                    this._closeSwipe(item);
                }
            }
            this._pendingItem = null;
            return;
        }

        const content = item.querySelector('.swipe-content');
        if (!content) { this._pendingItem = null; return; }

        const dx = e.clientX - this.startX;
        const isOpen = item.classList.contains('swipe-open');

        if (isOpen) {
            if (dx > this.threshold / 2) {
                this._closeSwipe(item);
            } else {
                this._openSwipe(item);
            }
        } else {
            if (dx < -this.threshold) {
                this._openSwipe(item);
            } else {
                this._closeSwipe(item);
            }
        }

        this._swipeOccurred = true;
        this._pendingItem = null;
    }

    _onClick(e) {
        // depois de um swipe, suprime o click para não ativar o item
        if (this._swipeOccurred) {
            this._swipeOccurred = false;
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        const deleteBtn = e.target.closest('.swipe-delete-btn');
        if (!deleteBtn) return;

        const item = deleteBtn.closest(this.itemSelector);
        if (!item || !item.classList.contains('swipe-open')) return;

        e.stopPropagation();
        e.preventDefault();

        if (this.onDelete) {
            this.onDelete(item);
        }
    }

    _openSwipe(item) {
        const content = item.querySelector('.swipe-content');
        if (!content) return;

        // fecha qualquer outro item aberto primeiro
        if (this.activeItem && this.activeItem !== item) {
            this._closeSwipe(this.activeItem);
        }

        content.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        content.style.transform = `translateX(-${this.deleteWidth}px)`;

        const btn = item.querySelector('.swipe-delete-btn');
        if (btn) {
            btn.style.opacity = '1';
            btn.style.visibility = 'visible';
            btn.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
            btn.style.transform = 'translateY(-50%) scale(1)';
        }

        item.classList.add('swipe-open');
        item.classList.add('swiping');
        this.activeItem = item;
    }

    _closeSwipe(item) {
        const content = item.querySelector('.swipe-content');
        if (!content) return;

        content.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        content.style.transform = 'translateX(0)';

        const btn = item.querySelector('.swipe-delete-btn');
        if (btn) {
            btn.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
            btn.style.opacity = '0';
            btn.style.transform = 'translateY(-50%) scale(0)';
            if (this._closeTimeout) clearTimeout(this._closeTimeout);
            this._closeTimeout = setTimeout(() => {
                btn.style.visibility = 'hidden';
                this._closeTimeout = null;
            }, 200);
        }

        item.classList.remove('swipe-open');
        item.classList.remove('swiping');

        if (this.activeItem === item) {
            this.activeItem = null;
        }
    }

    // fecha todos os itens abertos (chanma o re-render)
    closeAll() {
        if (!this.container) return;
        this.container.querySelectorAll('.swipe-open').forEach(item => {
            this._closeSwipe(item);
        });
    }

    // cleanup

    _cleanupListeners() {
        document.removeEventListener('pointermove', this._onPointerMove);
        document.removeEventListener('pointerup', this._onPointerUp);
    }

    _cleanup() {
        // Remove classe swiping se o gesto foi abortado (ex: rolagem vertical)
        if (this._pendingItem) {
            this._pendingItem.classList.remove('swiping');
        }
        this._pendingItem = null;
        this._directionLocked = false;
        this._cleanupListeners();
    }

    destroy() {
        this._cleanup();
        if (this._closeTimeout) {
            clearTimeout(this._closeTimeout);
            this._closeTimeout = null;
        }
        this.container.removeEventListener('pointerdown', this._onPointerDown);
        this.container.removeEventListener('click', this._onClick, true);
        this.activeItem = null;
    }
}
