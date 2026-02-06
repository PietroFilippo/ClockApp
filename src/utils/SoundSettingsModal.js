import { alarmManager } from '../modules/AlarmManager.js';
import { audioManager } from './AudioManager.js'; // Same folder
import { showModal } from './modal.js';
import { showAlert, showConfirm, truncate } from './notification.js';
import { LIMITS } from './constants.js';

export function openSoundSettingsModal(onSave) {
    const volume = alarmManager.getVolume();
    const limit = window.electronAPI ? LIMITS.MAX_CUSTOM_SOUNDS_ELECTRON : LIMITS.MAX_CUSTOM_SOUNDS_BROWSER;
    let currentTab = 'pre-installed';

    // Rastreia o estado do audio localmente para o modal
    let playingId = null;

    // Helper para parar a preview atual e liberar o bloqueio do arquivo
    const stopPreview = () => {
        audioManager.stopPreview();
        playingId = null;
    };

    const content = `
      <div class="audio-settings">
        <div class="audio-controls">
          <label>Master Volume</label>
          <div class="volume-slider-container">
            <span id="vol-low">🔈</span>
            <input type="range" id="master-volume" class="volume-slider" min="0" max="1" step="0.1" value="${volume}">
            <span id="vol-high">🔊</span>
          </div>
        </div>

        <div class="sound-picker-tabs">
          <div class="picker-tab active" data-tab="pre-installed">Pre-installed</div>
          <div class="picker-tab" data-tab="custom">Custom (<span id="custom-count">${alarmManager.getCustomSounds().length}</span>/${limit})</div>
        </div>

        <div class="sound-picker-list" id="sound-list-container">
          <!-- List items rendered here -->
        </div>

        <div id="upload-section"></div>
      </div>
    `;

    function renderSoundListHTML(sounds, isBuiltIn = false) {
        if (sounds.length === 0) return '<div style="text-align:center; color:#555; padding:10px;">No sounds available</div>';
        return sounds.map(s => `
        <div class="custom-sound-item" id="sound-item-${s.id}">
          <div class="sound-main-info">
            <span class="custom-sound-name" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.name}">${truncate(s.name, 25)}</span>
            <div class="sound-actions">
              <button class="sound-btn reset-preview" data-id="${s.id}" title="Reset">⏮</button>
              <button class="sound-btn play-preview" data-id="${s.id}" data-src="${s.data}" title="Play/Pause">▶</button>
              ${!isBuiltIn ? `<button class="sound-btn delete" data-id="${s.id}" title="Delete">🗑</button>` : ''}
            </div>
          </div>
          <input type="range" class="seek-bar" data-id="${s.id}" value="0" step="0.1">
        </div>
      `).join('');
    }

    const overlay = showModal({
        title: 'Sound Settings',
        content,
        onSave: () => {
            stopPreview();
            if (onSave) onSave();
        }
    });

    overlay.querySelector('.modal-btn.save').textContent = 'Done';
    overlay.querySelector('.modal-btn.cancel').style.display = 'none';

    // Para o audio quando o modal é fechado clicando fora ou pressionando esc
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === overlay) {
                    stopPreview();
                    observer.disconnect();
                }
            });
        });
    });
    observer.observe(document.body, { childList: true });

    function renderList() {
        const container = overlay.querySelector('#sound-list-container');
        const uploadSection = overlay.querySelector('#upload-section');
        const sounds = currentTab === 'pre-installed'
            ? alarmManager.getBuiltInSounds()
            : alarmManager.getCustomSounds();
        const isBuiltIn = currentTab === 'pre-installed';

        container.innerHTML = renderSoundListHTML(sounds, isBuiltIn);

        // Atualiza contador
        const countSpan = overlay.querySelector('#custom-count');
        if (countSpan) {
            countSpan.textContent = alarmManager.getCustomSounds().length;
        }

        // Mostra upload apenas na aba custom
        if (currentTab === 'custom') {
            const customSounds = alarmManager.getCustomSounds();
            const reached = (window.electronAPI && customSounds.length >= LIMITS.MAX_CUSTOM_SOUNDS_ELECTRON) || (!window.electronAPI && customSounds.length >= LIMITS.MAX_CUSTOM_SOUNDS_BROWSER);

            if (!reached) {
                uploadSection.innerHTML = `
            <div class="file-input-wrapper">
              <div class="upload-btn">Upload Sound (Max ${window.electronAPI ? LIMITS.MAX_FILE_SIZE_MB_ELECTRON + 'MB' : LIMITS.MAX_FILE_SIZE_MB_BROWSER + 'MB'})</div>
              <input type="file" id="sound-upload" accept="audio/*">
            </div>
          `;
                attachUploadListener();
            } else {
                uploadSection.innerHTML = `<div style="text-align:center; color:var(--accent-red); margin-top: 15px;">Limit reached (${limit}/${limit})</div>`;
            }
        } else {
            uploadSection.innerHTML = '';
        }

        attachListListeners();
        renderAudioState();
    }

    function renderAudioState() {
        const container = overlay.querySelector('#sound-list-container');
        if (!container) return;

        // Usa getter de audioManager se disponível ou acessa propriedade diretamente se pública
        const previewAudio = audioManager.previewAudio;

        container.querySelectorAll('.custom-sound-item').forEach(item => {
            const id = item.id.replace('sound-item-', '');
            const playBtn = item.querySelector('.play-preview');
            const seekBar = item.querySelector('.seek-bar');

            if (id === playingId && previewAudio) {
                playBtn.textContent = previewAudio.paused ? '▶' : '⏸';
                seekBar.style.display = 'block';
                if (!isNaN(previewAudio.duration)) {
                    seekBar.max = previewAudio.duration;
                }
                seekBar.value = previewAudio.currentTime;
            } else {
                playBtn.textContent = '▶';
                seekBar.style.display = 'none';
                seekBar.value = 0;
            }
        });
    }

    // Volume slider
    const volumeSlider = overlay.querySelector('#master-volume');
    volumeSlider.oninput = (e) => {
        const newVol = Number(e.target.value);
        alarmManager.setVolume(newVol);
        audioManager.setVolume(newVol);
    };

    function attachUploadListener() {
        const uploadInput = overlay.querySelector('#sound-upload');
        if (!uploadInput) return;

        uploadInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const maxSize = window.electronAPI ? LIMITS.MAX_FILE_SIZE_BYTES_ELECTRON : LIMITS.MAX_FILE_SIZE_BYTES_BROWSER;
            if (file.size > maxSize) {
                showAlert(`File too large (Max ${window.electronAPI ? LIMITS.MAX_FILE_SIZE_MB_ELECTRON + 'MB' : LIMITS.MAX_FILE_SIZE_MB_BROWSER + 'MB'})`, 'Upload Failed');
                return;
            }

            const handleResult = (soundData) => {
                const name = file.name.split('.')[0];
                stopPreview();
                const success = alarmManager.addCustomSound(name, soundData);
                if (success && success.then) {
                    success.then((res) => { if (res) renderList(); });
                } else if (success) {
                    renderList();
                }
            };

            if (window.electronAPI && file.path) {
                handleResult(file.path);
            } else {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    handleResult(loadEvent.target.result);
                };
                reader.readAsDataURL(file);
            }

            e.target.value = '';
        };
    }

    function attachListListeners() {
        const container = overlay.querySelector('#sound-list-container');
        if (!container) return;

        const previewAudio = audioManager.previewAudio;

        // Play/Pause
        container.querySelectorAll('.play-preview').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const src = btn.dataset.src;

                if (playingId === id) {
                    if (previewAudio.paused) {
                        previewAudio.play();
                    } else {
                        previewAudio.pause();
                    }
                    renderAudioState();
                } else {
                    stopPreview();
                    playingId = id;
                    audioManager.playPreview(id); // AudioManager gerencia src lookup

                    const currentAudio = audioManager.previewAudio;
                    if (currentAudio) {
                        currentAudio.onended = () => renderAudioState();
                        currentAudio.ontimeupdate = () => renderAudioState();
                        currentAudio.onloadedmetadata = () => renderAudioState();
                    }

                    renderAudioState();
                }
            };
        });

        // Seek
        container.querySelectorAll('.seek-bar').forEach(bar => {
            bar.oninput = (e) => {
                const id = bar.dataset.id;
                const currentAudio = audioManager.previewAudio;
                if (playingId === id && currentAudio) {
                    currentAudio.currentTime = Number(e.target.value);
                }
            };
        });

        // Reset
        container.querySelectorAll('.reset-preview').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const currentAudio = audioManager.previewAudio;
                if (playingId === id && currentAudio) {
                    currentAudio.currentTime = 0;
                    if (currentAudio.paused) {
                        currentAudio.play();
                        renderAudioState();
                    }
                }
            };
        });

        // Delete
        container.querySelectorAll('.delete').forEach(btn => {
            btn.onclick = async () => {
                if (await showConfirm('Delete this sound?', 'Delete Sound')) {
                    const id = btn.dataset.id;
                    if (playingId === id) {
                        stopPreview();
                    }

                    const result = alarmManager.deleteCustomSound(id);
                    if (result && result.then) {
                        result.then(() => renderList());
                    } else {
                        renderList();
                    }
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
