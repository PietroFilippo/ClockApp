import { audioManager } from './AudioManager.js';
import { showModal } from './modal.js';
import { truncate } from './notification.js';

export function openSoundPicker(currentSoundId, onSelect) {
    const builtInSounds = audioManager.getBuiltInSounds();
    const customSounds = audioManager.getCustomSounds();
    let currentTab = 'pre-installed';
    let playingId = null;

    const overlay = showModal({
        title: 'Select Sound',
        content: `
            <div class="sound-picker-tabs">
                <div class="picker-tab active" data-tab="pre-installed">Pre-installed</div>
                <div class="picker-tab" data-tab="custom">Custom</div>
            </div>
            <div class="sound-picker-list" id="picker-list-container">
                <!-- List items rendered here -->
            </div>
        `,
        onSave: () => {
            stopPreview();
        },
        onClose: () => {
            stopPreview();
        }
    });

    function stopPreview() {
        audioManager.stopPreview();
        playingId = null;
    }

    function renderList() {
        const container = overlay.querySelector('#picker-list-container');
        const sounds = currentTab === 'pre-installed' ? builtInSounds : customSounds;

        if (sounds.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#555; padding:20px;">No sounds available</div>';
            return;
        }

        container.innerHTML = sounds.map(s => `
            <div class="picker-item ${s.id === currentSoundId ? 'selected' : ''}" data-id="${s.id}">
                <div class="picker-item-info">
                    <span class="picker-item-name" title="${s.name}">${s.name}</span>
                </div>
                <button class="picker-preview-btn ${playingId === s.id ? 'playing' : ''}" data-src="${s.data}" data-id="${s.id}">
                    ${playingId === s.id ? '⏸' : '▶'}
                </button>
            </div>
        `).join('');

        // Adiciona listeners
        container.querySelectorAll('.picker-item').forEach(item => {
            item.onclick = (e) => {
                if (e.target.closest('.picker-preview-btn')) return;
                stopPreview();
                onSelect(item.dataset.id);
                overlay.remove();
            };
        });

        const previewAudio = audioManager.getPreviewAudio();

        container.querySelectorAll('.picker-preview-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                // const src = btn.dataset.src; // audioManager gerencia src lookup

                if (playingId === id) {
                    if (previewAudio.paused) {
                        previewAudio.play();
                        btn.textContent = '⏸';
                    } else {
                        previewAudio.pause();
                        btn.textContent = '▶';
                    }
                } else {
                    stopPreview();
                    playingId = id;
                    audioManager.playPreview(id);
                    btn.textContent = '⏸';

                    // Usa a instância de audio centralizada
                    previewAudio.onended = () => {
                        btn.textContent = '▶';
                        playingId = null;
                    };

                    // Atualiza todos os outros botões
                    container.querySelectorAll('.picker-preview-btn').forEach(b => {
                        if (b !== btn) b.textContent = '▶';
                    });
                }
            };
        });
    }

    // Troca de aba
    overlay.querySelectorAll('.picker-tab').forEach(tab => {
        tab.onclick = () => {
            overlay.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            stopPreview();
            renderList();
        };
    });

    renderList();
}
