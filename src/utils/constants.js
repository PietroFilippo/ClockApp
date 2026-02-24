export const STORAGE_KEYS = {
    ALARMS: 'alarms',
    SNOOZED_ALARMS: 'snoozedAlarms',
    TIMER_STATE: 'timer-state',
    TIMER_RECENTS: 'timer-recents',
    TIMER_SAVED: 'timer-saved',
    STOPWATCH_STATE: 'stopwatch-state',
    WORLD_CLOCKS: 'worldClocks',
    CUSTOM_SOUNDS: 'customSounds',
    ALARM_VOLUME: 'alarmVolume',
    STOPWATCH_FASTEST_COLOR: 'stopwatch-fastest-color',
    STOPWATCH_SLOWEST_COLOR: 'stopwatch-slowest-color',
    STOPWATCH_CUSTOM_COLORS: 'stopwatch-custom-colors',
    STOPWATCH_KEYBINDS: 'stopwatch-keybinds',
    SETTINGS: 'app-settings',
    TIMER_TIMEOUT_ACTION: 'timerTimeoutAction',
    ALARM_TIMEOUT_ACTION: 'alarmTimeoutAction',
    ALARM_AUTO_ACTION_DURATION: 'alarmAutoActionDuration',
    TIMER_AUTO_ACTION_DURATION: 'timerAutoActionDuration',
    INTERVAL_TIMERS: 'interval-timers',
    INTERVAL_TIMER_STATE: 'interval-timer-state',
    TIMER_ACTIVE_TAB: 'timer-active-tab',
    TIMER_SELECTED_SOUND: 'timer-selected-sound',
    INTERVAL_SELECTED_SOUND: 'interval-selected-sound',
    INTERVAL_DRAFT_STATE: 'clockapp_interval_draft_state'
};

export const COLORS = {
    ACCENT_ORANGE: '#ff9500',
    ACCENT_RED: '#ff453a',
    ACCENT_GREEN: '#30d158',
    TEXT_PRIMARY: '#ffffff',
    TEXT_SECONDARY: '#8e8e93',
    DEFAULT_FASTEST_LAP: '#30d158',
    DEFAULT_SLOWEST_LAP: '#ff453a'
};

export const LIMITS = {
    MAX_CUSTOM_SOUNDS_BROWSER: 10,
    MAX_CUSTOM_SOUNDS_ELECTRON: 20,
    MAX_CUSTOM_COLORS: 10,
    MAX_TIMER_RECENTS: 20,
    MAX_TIMER_SAVED: 10,
    MAX_FILE_SIZE_BYTES_BROWSER: 2 * 1024 * 1024, // 2MB
    MAX_FILE_SIZE_BYTES_ELECTRON: 100 * 1024 * 1024, // 100MB
    MAX_FILE_SIZE_MB_BROWSER: 2,
    MAX_FILE_SIZE_MB_ELECTRON: 100,
    MAX_INTERVAL_STEPS: 30,
    MAX_INTERVAL_PRESETS: 10
};

export const DEFAULT_SOUND = 'default';
