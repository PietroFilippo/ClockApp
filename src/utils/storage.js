// Read a JSON value from localStorage, falling back when it's missing, corrupt or the wrong shape.
// A corrupt value is kept under "<key>.corrupt" so it can still be recovered by hand.
export function loadJSON(key, fallback, isValid = () => true) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    try {
        const value = JSON.parse(raw);
        if (value !== null && isValid(value)) return value;
    } catch (e) {
        // Fall through to the fallback below
    }

    console.error(`Ignoring invalid saved data for "${key}"`);
    localStorage.setItem(`${key}.corrupt`, raw);
    return fallback;
}

export const isPlainObject = (value) => typeof value === 'object' && !Array.isArray(value);
