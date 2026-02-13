import { showAlert } from './notification.js';
import { STORAGE_KEYS, LIMITS } from './constants.js';

class AudioManager {
    constructor() {
        this.builtInSounds = [
            { id: 'default', name: 'Radar (Default)', data: 'sounds/radar.mp3' },
            { id: 'bell-notification', name: 'Bell Notification', data: 'sounds/bell-notification.wav' },
            { id: 'correct-answer-tone', name: 'Correct Answer Tone', data: 'sounds/correct-answer-tone.wav' },
            { id: 'eas-alarm', name: 'EAS Alarm', data: 'sounds/eas-alarm.mp3' },
            { id: 'futuristic-dial-tone', name: 'Futuristic Dial Tone', data: 'sounds/futuristic-dial-tone.wav' },
            { id: 'guitar-notification-alert', name: 'Guitar Notification Alert', data: 'sounds/guitar-notification-alert.wav' },
            { id: 'happy-bells-notification', name: 'Happy Bells Notification', data: 'sounds/happy-bells-notification.wav' },
            { id: 'magic-marimba', name: 'Magic Marimba', data: 'sounds/magic-marimba.wav' },
            { id: 'magic-notification-ring', name: 'Magic Notification Ring', data: 'sounds/magic-notification-ring.wav' },
            { id: 'marimba-ringtone', name: 'Marimba Ringtone', data: 'sounds/marimba-ringtone.wav' },
            { id: 'melodical-flute-music-notification', name: 'Melodical Flute Music', data: 'sounds/melodical-flute-music-notification.wav' },
            { id: 'retro-game-emergency-alarm', name: 'Retro Game Emergency', data: 'sounds/retro-game-emergency-alarm.wav' },
            { id: 'sci-fi-confirmation', name: 'Sci-Fi Confirmation', data: 'sounds/sci-fi-confirmation.wav' }
        ];

        this.customSounds = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_SOUNDS)) || [];
        this.volume = parseFloat(localStorage.getItem(STORAGE_KEYS.ALARM_VOLUME)) || 1.0;

        // Audio principal para alarmes e timers
        this.mainAudio = new Audio();
        this.mainAudio.volume = this.volume;

        // Preview do audio para configurações
        this.previewAudio = new Audio();
        this.previewAudio.volume = this.volume;
    }

    getBuiltInSounds() {
        return this.builtInSounds;
    }

    getCustomSounds() {
        return this.customSounds;
    }

    getAllSounds() {
        return [...this.builtInSounds, ...this.customSounds];
    }

    getSoundById(id) {
        return this.getAllSounds().find(s => s.id === id);
    }

    getVolume() {
        return this.volume;
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.mainAudio.volume = this.volume;
        this.previewAudio.volume = this.volume;
        localStorage.setItem(STORAGE_KEYS.ALARM_VOLUME, this.volume);
    }

    getSoundSrc(soundId) {
        // Fallback pro default se não encontrado
        const sound = this.getSoundById(soundId) || this.builtInSounds[0];
        return sound.data;
    }

    playAlarm(soundId, loop = true) {
        const src = this.getSoundSrc(soundId);
        this.mainAudio.src = src;
        this.mainAudio.loop = loop;
        this.mainAudio.currentTime = 0;
        return this.mainAudio.play().catch(e => console.error("Audio play failed", e));
    }

    stopAlarm() {
        this.mainAudio.pause();
        this.mainAudio.currentTime = 0;
    }

    // Métodos de preview
    playPreview(soundId) {
        this.stopPreview();
        const src = this.getSoundSrc(soundId);
        this.previewAudio.src = src;
        this.previewAudio.loop = false;
        return this.previewAudio.play().catch(e => console.error("Preview play failed", e));
    }

    stopPreview() {
        this.previewAudio.pause();
        this.previewAudio.currentTime = 0;
    }

    getPreviewAudio() {
        return this.previewAudio;
    }

    // Gerenciamento de sons personalizados
    async addCustomSound(name, data) {
        const isElectron = !!window.electronAPI;
        const limit = isElectron ? LIMITS.MAX_CUSTOM_SOUNDS_ELECTRON : LIMITS.MAX_CUSTOM_SOUNDS_BROWSER;

        if (this.customSounds.length >= limit) {
            showAlert(`Maximum of ${limit} custom sounds allowed.`, 'Limit Reached');
            return false;
        }

        let soundData = data;

        if (isElectron) {
            try {
                if (typeof data === 'string' && !data.startsWith('data:')) {
                    soundData = await window.electronAPI.copySoundFile(data, name + '.mp3');
                } else {
                    const base64Data = data.split(',')[1];
                    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    soundData = await window.electronAPI.saveFile(name + '.mp3', buffer);
                }
            } catch (err) {
                console.error('Failed to save file natively:', err);
                showAlert('Failed to save sound file.', 'Error');
                return false;
            }
        }

        const newSound = {
            id: 'custom_' + Date.now(),
            name: name,
            data: soundData,
            isNative: isElectron
        };

        this.customSounds.push(newSound);
        this.saveCustomSounds();
        return true;
    }

    async deleteCustomSound(id) {
        const sound = this.customSounds.find(s => s.id === id);
        if (!sound) return false;

        if (sound.isNative && window.electronAPI) {
            try {
                await window.electronAPI.deleteFile(sound.data);
            } catch (e) {
                console.warn("Could not delete physical file", e);
            }
        }

        this.customSounds = this.customSounds.filter(s => s.id !== id);
        this.saveCustomSounds();
        return true;
    }

    saveCustomSounds() {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_SOUNDS, JSON.stringify(this.customSounds));
        document.dispatchEvent(new CustomEvent('sounds-updated'));
    }
}

export const audioManager = new AudioManager();
