export class ColorPicker {
    constructor(container, options = {}) {
        this.container = container;
        this.onColorChange = options.onColorChange || (() => { });
        this.onSave = options.onSave || (() => { });
        this.onCancel = options.onCancel || (() => { });
        this.initialColor = options.initialColor || '#ffffff';
        this.targetLabel = options.targetLabel || 'Color';
        this.customColors = options.customColors || [];
        this.onCustomColorsChange = options.onCustomColorsChange || (() => { });
        this.maxCustomColors = options.maxCustomColors || 14;
        this.isDeletingCustom = false;

        this.init();
    }

    init() {
        this.render();
        this.cacheElements();
        this.attachListeners();
        this.initColorState();
    }

    render() {
        // Cria a estrutura DOM para o ColorPicker
        this.element = document.createElement('div');
        this.element.className = 'modal-overlay';
        this.element.id = 'color-picker-overlay';

        this.element.innerHTML = `
            <div class="color-picker-modal">
                <div class="color-picker-header">
                    <h2>Edit ${this.targetLabel}</h2>
                    <button class="color-picker-close" id="close-picker">×</button>
                </div>
                <div class="color-picker-body">
                    <div class="color-picker-left">
                        <div class="color-spectrum-container">
                            <canvas id="color-spectrum" width="320" height="300"></canvas>
                            <div class="spectrum-cursor" id="spectrum-cursor"></div>
                        </div>
                        <div class="brightness-slider-container">
                            <canvas id="brightness-slider" width="40" height="300"></canvas>
                            <div class="brightness-cursor" id="brightness-cursor"></div>
                        </div>
                    </div>
                    <div class="color-picker-right">
                        <div class="color-preview-box" id="color-preview"></div>
                        <div class="color-input-group">
                            <input type="text" class="hex-input" id="hex-input" maxlength="7">
                        </div>
                        <div class="color-input-group">
                            <label>RGB</label>
                        </div>
                        <div class="rgb-inputs">
                            <div class="rgb-input-row">
                                <input type="number" class="rgb-input" id="rgb-r" min="0" max="255">
                                <span>Red</span>
                            </div>
                            <div class="rgb-input-row">
                                <input type="number" class="rgb-input" id="rgb-g" min="0" max="255">
                                <span>Green</span>
                            </div>
                            <div class="rgb-input-row">
                                <input type="number" class="rgb-input" id="rgb-b" min="0" max="255">
                                <span>Blue</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="colors-container">
                    <div class="custom-colors-section" id="custom-colors-section">
                        <div class="section-header">
                            <span class="section-label">Custom colors</span>
                            <div class="custom-colors-actions">
                                <button class="custom-action-btn" id="toggle-delete-custom" title="Delete custom colors">🗑️</button>
                                <button class="custom-action-btn" id="add-custom-color" title="Save current color">+</button>
                            </div>
                        </div>
                        <div class="custom-colors-grid" id="custom-colors-grid">
                            <!-- Custom colors rendered here -->
                        </div>
                    </div>
                    <div class="basic-colors-section">
                        <span class="section-label">Basic colors</span>
                        <div class="basic-colors-grid" id="basic-colors">
                            ${this.getBasicColorsHTML()}
                        </div>
                    </div>
                </div>

                <div class="color-picker-actions">
                    <button class="modal-btn save" id="save-color">OK</button>
                    <button class="modal-btn cancel" id="cancel-color">Cancel</button>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);
    }

    getBasicColorsHTML() {
        const basicColors = [
            '#ff8080', '#ff0000', '#c00000', '#ff80c0', '#ff00ff', '#c000c0', '#8080ff', '#0000ff', '#0000c0', '#00c0ff', '#00ffff', '#00c0c0',
            '#ffc000', '#ff8000', '#c08000', '#ffff00', '#c0c000', '#808000', '#80ff00', '#00ff00', '#00c000', '#00ff80', '#00c080', '#008080',
            '#80ff80', '#80c080', '#408040', '#00c040', '#008040', '#004040', '#80ffff', '#80c0c0', '#408080', '#0080c0', '#004080', '#000080',
            '#8080c0', '#4040c0', '#000040', '#804080', '#400040', '#c080c0', '#c0c0c0', '#808080', '#404040', '#000000', '#ffffff', '#c0c0ff'
        ];

        return basicColors.map(color =>
            `<div class="basic-color-swatch" data-color="${color}" style="background-color: ${color}"></div>`
        ).join('');
    }

    cacheElements() {
        const el = this.element;
        this.spectrum = el.querySelector('#color-spectrum');
        this.brightnessSlider = el.querySelector('#brightness-slider');
        this.spectrumCursor = el.querySelector('#spectrum-cursor');
        this.brightnessCursor = el.querySelector('#brightness-cursor');
        this.hexInput = el.querySelector('#hex-input');
        this.rgbR = el.querySelector('#rgb-r');
        this.rgbG = el.querySelector('#rgb-g');
        this.rgbB = el.querySelector('#rgb-b');
        this.preview = el.querySelector('#color-preview');
    }

    initColorState() {
        const rgb = this.hexToRgb(this.initialColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        this.currentHue = hsl.h;
        this.currentSat = hsl.s;
        this.currentLight = hsl.l;

        this.drawSpectrum();
        this.drawBrightnessSlider();
        this.updateFromHSL();
        this.renderCustomColors();
    }

    attachListeners() {
        // Interacção com o espectro
        let isDraggingSpectrum = false;
        const handleSpectrum = (e) => {
            const rect = this.spectrum.getBoundingClientRect();
            const x = Math.max(0, Math.min(this.spectrum.width, e.clientX - rect.left));
            const y = Math.max(0, Math.min(this.spectrum.height, e.clientY - rect.top));

            this.currentHue = (x / this.spectrum.width) * 360;
            this.currentLight = (1 - y / this.spectrum.height) * 100;

            this.drawBrightnessSlider();
            this.updateFromHSL();
        };

        this.spectrum.addEventListener('mousedown', (e) => {
            isDraggingSpectrum = true;
            handleSpectrum(e);
        });
        document.addEventListener('mousemove', (e) => { if (isDraggingSpectrum) handleSpectrum(e); });
        document.addEventListener('mouseup', () => { isDraggingSpectrum = false; });

        // Interacção com o brilho
        let isDraggingBrightness = false;
        const handleBrightness = (e) => {
            const rect = this.brightnessSlider.getBoundingClientRect();
            const y = Math.max(0, Math.min(this.brightnessSlider.height, e.clientY - rect.top));
            this.currentLight = (1 - y / this.brightnessSlider.height) * 100;
            this.updateFromHSL();
        };

        this.brightnessSlider.addEventListener('mousedown', (e) => {
            isDraggingBrightness = true;
            handleBrightness(e);
        });
        document.addEventListener('mousemove', (e) => { if (isDraggingBrightness) handleBrightness(e); });
        document.addEventListener('mouseup', () => { isDraggingBrightness = false; });

        // Inputs
        this.hexInput.addEventListener('input', (e) => {
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                const rgb = this.hexToRgb(e.target.value);
                this.updateFromRGB(rgb.r, rgb.g, rgb.b);
            }
        });

        [this.rgbR, this.rgbG, this.rgbB].forEach(input => {
            input.addEventListener('input', () => {
                this.updateFromRGB(
                    parseInt(this.rgbR.value) || 0,
                    parseInt(this.rgbG.value) || 0,
                    parseInt(this.rgbB.value) || 0
                );
            });
        });

        // Cores básicas
        this.element.querySelectorAll('.basic-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const rgb = this.hexToRgb(swatch.dataset.color);
                this.updateFromRGB(rgb.r, rgb.g, rgb.b);
            });
        });

        // Ações
        this.element.querySelector('#save-color').onclick = () => {
            this.onSave(this.hexInput.value);
            this.destroy();
        };
        this.element.querySelector('#cancel-color').onclick = () => {
            this.onCancel();
            this.destroy();
        };
        this.element.querySelector('#close-picker').onclick = () => {
            this.onCancel();
            this.destroy();
        };
        this.element.onclick = (e) => {
            if (e.target === this.element) {
                this.onCancel();
                this.destroy();
            }
        };

        // Ações de cores personalizadas
        this.element.querySelector('#add-custom-color').onclick = () => this.addCustomColor();
        this.element.querySelector('#toggle-delete-custom').onclick = () => this.toggleDeleteCustom();
    }

    renderCustomColors() {
        const grid = this.element.querySelector('#custom-colors-grid');
        if (!grid) return;

        const slots = [];
        for (let i = 0; i < this.maxCustomColors; i++) {
            if (i < this.customColors.length) {
                const color = this.customColors[i];
                slots.push(`
                    <div class="custom-color-swatch-container">
                        <div class="basic-color-swatch custom-swatch" data-index="${i}" data-color="${color}" style="background-color: ${color}"></div>
                        ${this.isDeletingCustom ? `<div class="delete-overlay" data-index="${i}">×</div>` : ''}
                    </div>
                `);
            } else {
                slots.push(`<div class="basic-color-swatch empty-slot"></div>`);
            }
        }
        grid.innerHTML = slots.join('');
        grid.classList.toggle('deleting', this.isDeletingCustom);

        // Anexa listeners para as cores personalizadas
        grid.querySelectorAll('.custom-swatch, .delete-overlay').forEach(el => {
            el.onclick = (e) => {
                const index = parseInt(el.dataset.index);
                if (this.isDeletingCustom) {
                    this.deleteCustomColor(index);
                } else {
                    const color = this.customColors[index];
                    const rgb = this.hexToRgb(color);
                    this.updateFromRGB(rgb.r, rgb.g, rgb.b);
                }
                e.stopPropagation();
            };
        });
    }

    addCustomColor() {
        if (this.customColors.length >= this.maxCustomColors) {
            return;
        }
        const color = this.hexInput.value;
        if (!this.customColors.includes(color)) {
            this.customColors.push(color);
            this.onCustomColorsChange(this.customColors);
            this.renderCustomColors();
        }
    }

    deleteCustomColor(index) {
        this.customColors.splice(index, 1);
        this.onCustomColorsChange(this.customColors);
        this.renderCustomColors();
    }

    toggleDeleteCustom() {
        this.isDeletingCustom = !this.isDeletingCustom;
        this.element.querySelector('#toggle-delete-custom').classList.toggle('active', this.isDeletingCustom);
        this.renderCustomColors();
    }

    drawSpectrum() {
        const ctx = this.spectrum.getContext('2d');
        const width = this.spectrum.width;
        const height = this.spectrum.height;

        for (let x = 0; x < width; x++) {
            const hue = (x / width) * 360;
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, `hsl(${hue}, 100%, 100%)`);
            gradient.addColorStop(0.5, `hsl(${hue}, 100%, 50%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 0%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(x, 0, 1, height);
        }
    }

    drawBrightnessSlider() {
        const ctx = this.brightnessSlider.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, this.brightnessSlider.height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, `hsl(${this.currentHue}, ${this.currentSat}%, 50%)`);
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.brightnessSlider.width, this.brightnessSlider.height);
    }

    updateFromHSL() {
        const rgb = this.hslToRgb(this.currentHue, this.currentSat, this.currentLight);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);

        this.hexInput.value = hex;
        this.rgbR.value = rgb.r;
        this.rgbG.value = rgb.g;
        this.rgbB.value = rgb.b;
        this.preview.style.backgroundColor = hex;

        const spectrumX = (this.currentHue / 360) * this.spectrum.width;
        const spectrumY = (1 - this.currentLight / 100) * this.spectrum.height;

        this.spectrumCursor.style.left = `${spectrumX}px`;
        this.spectrumCursor.style.top = `${spectrumY}px`;

        const brightnessY = (1 - this.currentLight / 100) * this.brightnessSlider.height;
        this.brightnessCursor.style.top = `${brightnessY}px`;
    }

    updateFromRGB(r, g, b) {
        const hsl = this.rgbToHsl(r, g, b);
        this.currentHue = hsl.h;
        this.currentSat = hsl.s;
        this.currentLight = hsl.l;
        this.updateFromHSL();
        this.drawBrightnessSlider();
    }

    destroy() {
        this.element.remove();
    }

    // Helpers
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }
}
