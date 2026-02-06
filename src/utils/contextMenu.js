export class ContextMenu {
    constructor() {
        this.element = null;
        this.active = false;

        // Fecha o menu ao clicar em outro lugar
        document.addEventListener('click', (e) => {
            if (this.active && !e.target.closest('.context-menu')) {
                this.hide();
            }
        });

        // Fecha o menu ao rolar
        document.addEventListener('scroll', () => {
            if (this.active) this.hide();
        }, true);
    }

    show(x, y, items) {
        this.hide();

        this.element = document.createElement('div');
        this.element.className = 'context-menu';

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item';
            btn.textContent = item.label;

            if (item.danger) {
                btn.classList.add('danger');
            }
            if (item.primary) {
                btn.classList.add('primary');
            }

            btn.onclick = (e) => {
                e.stopPropagation();
                this.hide();
                item.action();
            };

            this.element.appendChild(btn);
        });

        document.body.appendChild(this.element);

        // Posição
        const rect = this.element.getBoundingClientRect();
        let finalX = x;
        let finalY = y;

        // Evita overflow a direita
        if (x + rect.width > window.innerWidth) {
            finalX = x - rect.width;
        }

        // Evita overflow abaixo
        if (y + rect.height > window.innerHeight) {
            finalY = y - rect.height;
        }

        this.element.style.left = `${finalX}px`;
        this.element.style.top = `${finalY}px`;

        // Animação
        requestAnimationFrame(() => {
            this.element.classList.add('visible');
        });

        this.active = true;
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.active = false;
    }
}

export const contextMenu = new ContextMenu();
