export function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

//Anexa validação de oninput em um elemento de entrada de tempo
export function attachTimeInputValidation(input, max, { maxDigits, onChange } = {}) {
    input.oninput = () => {
        let val = parseInt(input.value);
        if (val > max) input.value = max;
        if (val < 0) input.value = 0;
        if (maxDigits && input.value.length > maxDigits) input.value = input.value.slice(0, maxDigits);
        if (onChange) onChange();
    };
}
