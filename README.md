# ⏰ Clock App

A modern, elegant desktop app for time management and productivity, built with **Electron** and **JavaScript**. Inspired by the design and functionality of the iOS Clock app.

[![GitHub Release](https://img.shields.io/github/v/release/PietroFilippo/ClockApp?style=flat-square)](https://github.com/PietroFilippo/ClockApp/releases/latest)
[![Electron](https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)

---

## 📋 Overview

**Clock App** is a complete tool for managing your time. It combines essential features such as World Clock, Alarms, Stopwatch, Timer, and Intervals in a clean, intuitive dark-themed interface. The app is designed to blend seamlessly into your desktop environment, offering customizable notifications, minimizing to the system tray, configurable global shortcuts, automatic updates, and data persistence.

---

## Features

### 🌍 World Clock

- Add multiple clocks for different time zones
- **350+ cities** generated dynamically via `Intl.supportedValuesOf('timeZone')`
- **Advanced search**: Filter by continent, letter index (multi-select), sort by name (A-Z, Z-A) and time zone (GMT±)
- **Drag & Drop**: Reorder clocks by dragging and dropping
- **Multi-select**: Select and delete several clocks at once
- **Swipe-to-Delete**: Swipe an item sideways to reveal quick delete options
- Clear view of the time difference (GMT offset)
- Context menu (right-click) to delete a clock

### ⏰ Alarms

- Create alarms with specific times and custom labels
- **Repeat**: Set alarms for specific days of the week (with a "Select all" button)
- **Custom Sounds**: Choose from 13 bundled sounds or add your own audio files
- **Snooze**: Postpone alarms with configurable intervals (1–30 min)
- **Persistence**: Alarms, snooze states, and settings are saved automatically
- **Multi-select and Swipe**: Delete alarms in bulk or with quick swipe gestures
- Context menu for quick editing and deletion

### ⏱️ Stopwatch

- Precise stopwatch with a high-resolution display (hours, minutes, seconds, hundredths)
- **Analog Mode**: Smooth analog dial with a digital readout below it
- **Swipe View**: Smooth drag-gesture (swipe) transition between the digital and analog views
- **Laps**: Record laps with a visual indication of the best and worst
- **Lap colors**: Personalize the fastest and slowest lap colors via an interactive Color Picker (canvas)
- **Speed**: Choose a time multiplier: 1×, 1.25×, 1.5×, 1.75×, or 2×
- **Shortcuts**: Open the **Keyboard shortcuts** dialog to customize Start or pause, Lap, Stop, and Reset; conflicts are shown when global registration fails
- **Download**: Export elapsed time and recorded laps as a text file

### ⏲️ Timer

- **Multiple Timers**: Start up to 10 timers simultaneously as compact cards (Cards View)
- Detailed visual interface (Drill-down View) with a **circular progress ring** (animated SVG)
- **Recents and Saved**: Saved and recently used timers for quick reuse
- **Repeat**: Restart a finished timer straight from its notification
- Direct selection of hours, minutes, and seconds with smart validation
- Batch edit mode to manage the saved list
- **Multi-select and Swipe-to-Delete**: Manage your timer history easily with gestures
- **Limits and Replacement**: Save up to 10 timer presets and choose one to replace when the list is full

### ⏳ Intervals

- Create custom work cycles with up to 30 steps and a shared sound for step chimes
- **Advanced Step Editing**: Easily move (▲▼), duplicate (⧉), or remove (✕) steps. Edit step names inline with a click.
- **Drag & Drop**: Reorder steps intuitively by dragging the handle icon (≡)
- **Persistent Drafts (Draft State)**: Your progress (times and steps) while creating intervals is saved automatically in real time, so you can navigate around the app without losing anything
- **Quick Management**: Supports multi-select and swipe-to-delete to remove several intervals at once or delete them with gestures
- **Smart Replacement**: Save up to 10 interval presets and choose one to replace when the list is full
- Dedicated visual interface showing the current progress, the active step, and the upcoming steps of the cycle
- **Finish Notice**: When an interval ends, a quiet in-app notice appears on any tab with **Restart**, **Done**, and, for unsaved intervals, **Save**. It waits behind already-ringing alerts. With App popup or Both selected, the popup offers **Restart** and **Done** when the app isn't focused
- **Separate Audio**: Step chimes use their own audio channel alongside alarm/timer sounds

### ⚙️ Settings

| Setting | Description |
|---|---|
| **Start at login** | Opens Clock App when you log in (packaged Windows app) |
| **Minimize to tray** | Closing the window keeps the app running in the background; turn it off to quit on close |
| **Prevent sleep** | Keeps the computer and display awake while a timer or interval is running; paused countdowns do not request it |
| **Notifications take focus** | The app popup takes keyboard focus when it appears |
| **Notification style** | Windows notification, App popup, Both, or None; None still allows sounds and the in-app overlay |
| **Popup position** | Bottom right, Top right, Top left, Bottom left, or Custom via **Choose a spot on screen** |
| **Close popup after** | 5, 10, or 30 seconds; 1, 5, or 10 minutes; Custom… in seconds; or Never (0), which disables popup auto-close |
| **Ring for** | Separate timer/alarm durations with the same presets and Custom…; Until dismissed (0) disables automatic actions |
| **Then** | Timers: Stop or Repeat. Alarms: Stop or Snooze. Applies after the corresponding Ring for duration |
| **Global shortcuts** | Stopwatch shortcuts work system-wide. Off on new installs; existing installs keep their setting. Unavailable combinations are flagged here and in **Keyboard shortcuts** |
| **Exit Clock App** | Fully quits the app after confirmation |

### 🔔 Notifications

- **Hybrid Notifications**: Support for native OS notifications and/or custom overlay windows
- **Visual Overlay**: In-app alarm/timer overlay with Stop and Snooze or Repeat; timer alerts identify the label or original duration
- **Context Line**: App popups show the alarm time, snooze time, timer duration/repeat count, or interval completion above the label
- **Custom Position**: Choose where the notification appears on screen with a visual picker
- **Draggable**: Drag the popup from its background; action buttons remain clickable
- **Long Labels**: Popup titles truncate after 60 characters and clamp to two lines, with the full text in a tooltip
- **Dismissal**: Escape stops the alert in the in-app ringing overlay. Closing or auto-closing an external popup only hides that popup

### 🔄 Automatic Updates

- Automatic check for new versions via **GitHub Releases** on startup and every 6 hours
- Banner with an **Update** button (downloads and installs automatically) and a **View Release** button (opens the page in the browser)
- Animated progress bar during download
- Download errors appear in the banner with a **Retry** button
- Powered by `electron-updater`

### 📱 Overall User Experience

- **Scroll Persistence**: Tab scroll positions are remembered during the current app session.
- **Swipe Gestures**: Advanced fling physics (`translateX`) integration for deleting elements.
- **Taskbar Status**: The window title shows the nearest running timer's countdown, or the running stopwatch when there are no running timers. The taskbar progress bar tracks the timer.
- **Accurate Timing**: Timers, interval steps, and snoozes use absolute deadlines to catch up after sleep/resume or reopening the app. Intervals advance past all elapsed steps. Alarms missed by at most 30 minutes are checked on wake or reopening.
- **Keyboard and Motion**: Enter saves standard edit dialogs; Escape closes them or stops an in-app ringing alert. Focusable controls have visible keyboard focus, and CSS animations respect reduced-motion preferences.
- **Stability**: Windows shutdown/logoff handlers save window state and flush storage before session end. Renderer recovery is limited to three attempts per minute and disabled during quit/shutdown. Local crash reporting is enabled, with dumps stored in `%APPDATA%\Clock App\Crashpad`.
- **Data Recovery**: Invalid settings fall back to defaults. Shared JSON loaders preserve invalid values under `<key>.corrupt` and use defaults; some feature-specific loaders still have limitations noted below.

---

## 🛠️ Architecture and Technologies

The project uses an architecture based on **Electron** with **Vite** for bundling the renderer. The code is written in **Vanilla JavaScript** (ES Modules), focusing on performance and simplicity.

| Layer | Technology |
|---|---|
| **Runtime** | [Electron](https://www.electronjs.org/) v40 |
| **Bundler** | [Vite](https://vitejs.dev/) v7 |
| **Language** | JavaScript (ES6+ Modules) |
| **Styling** | Plain CSS with variables |
| **Build** | [electron-builder](https://www.electron.build/) v26 (NSIS) |
| **Auto-Update** | [electron-updater](https://www.electron.build/auto-update) v6 |
| **Storage** | `localStorage` (renderer) + `settings.json` (main process via `fs`) |

### Folder Structure

```
clockapp/
├── electron/                       # Main Process
│   ├── main.js                     # Electron entry point, IPC, autoUpdater, tray
│   ├── preload.js                  # Context-isolated bridge (contextBridge + ipcRenderer)
│   ├── notification.html           # Custom notification window (secondary)
│   └── positionPicker.html         # Custom position picker for notifications
│
├── src/                            # Renderer Process (UI)
│   ├── main.js                     # Frontend entry point, routing, and update banner
│   │
│   ├── components/                 # UI components
│   │   ├── Alarm.js                # Alarms screen (skeleton + granular updates)
│   │   ├── Interval.js             # Intervals interface and custom cycle flow
│   │   ├── Navigation.js           # Bottom navigation bar
│   │   ├── RingOverlay.js          # Alarm/timer overlay and interval finish notice
│   │   ├── Settings.js             # Settings screen
│   │   ├── Stopwatch.js            # Stopwatch with laps, colors, and speed
│   │   ├── Timer.js                # Timer with simultaneous cards and details
│   │   └── WorldClock.js           # World clock with drag & drop
│   │
│   ├── modules/                    # Business logic and state management
│   │   ├── AlarmManager.js         # Alarm state, scheduling, snooze, and popup action routing
│   │   ├── IntervalTimerManager.js # Sequential execution engine for intervals
│   │   ├── StopwatchManager.js     # Stopwatch state and logic
│   │   └── TimerManager.js         # Manager for multiple concurrent timers
│   │
│   ├── services/                   # Services and integrations
│   │   └── NotificationService.js  # Unified management of notifications and alerts
│   │
│   ├── utils/                      # Shared utilities
│   │   ├── AnalogStopwatch.js      # Canvas-based analog dial component
│   │   ├── AudioManager.js         # Centralized audio (alarm, interval chime and preview channels)
│   │   ├── ColorPicker.js          # Interactive color picker (canvas)
│   │   ├── KeybindManager.js       # Shortcut recording, conflicts, and modal
│   │   ├── SoundPicker.js          # Sound selector (bundled + custom)
│   │   ├── SoundSettingsModal.js   # Alarm sound settings modal
│   │   ├── SwipeToDelete.js        # Advanced physics and gestures for swipe
│   │   ├── constants.js            # Constants (storage keys, colors, limits)
│   │   ├── contextMenu.js          # Context menu (right-click)
│   │   ├── modal.js                # Generic modal utility
│   │   ├── notification.js         # Alerts, confirms, and truncate
│   │   ├── sanitize.js             # HTML escaping
│   │   ├── shortcuts.js            # Shared local/global stopwatch shortcuts and conflicts
│   │   ├── storage.js              # Safe localStorage JSON loading
│   │   └── time.js                 # Time input helpers and validation
│   │
│   ├── data/
│   │   └── timezones.js            # 350+ time zones generated via the Intl API
│   │
│   └── assets/styles/              # CSS styles
│       ├── index.css               # Styles entry point (@import)
│       ├── variables.css           # Theme variables (colors, fonts)
│       ├── base.css                # Global styles
│       ├── layout.css              # Title bar, navigation, update banner
│       ├── components/             # Reusable component styles
│       │   ├── context-menu.css
│       │   ├── form.css
│       │   ├── header.css
│       │   ├── modal.css
│       │   └── swipe-delete.css
│       └── features/               # Per-feature styles
│           ├── alarm.css
│           ├── interval-timer.css
│           ├── settings.css
│           ├── stopwatch-analog.css
│           ├── stopwatch.css
│           ├── timer.css
│           └── world-clock.css
│
├── public/                         # Static assets
│   ├── icon.png                    # App icon
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker (network-first caching)
│   └── sounds/                     # 13 bundled sounds (alarms and notifications)
│
├── build/installer.nsh             # NSIS desktop shortcut install/uninstall hooks
├── dist/                           # Generated renderer build
├── release/                        # Generated Windows packages and installer
├── package.json                    # Dependencies, scripts, and electron-builder config
├── vite.config.js                  # Vite configuration
└── index.html                      # Main HTML with CSP; Service Worker in browser only
```

### Rendering Patterns

Components use several rendering patterns:

- **Static skeleton**: Several feature views initialize their header/containers once and update them in place
- **Keyed DOM reconciliation**: Alarm/clock lists reuse keyed cards; changed card contents may be replaced
- **Granular updates**: Only the dynamic elements (counters, button states) are updated
- **Event delegation**: List actions use container listeners; individual controls also have direct handlers
- **Mode tracking**: Timer.js separates list/detail initialization from per-tick updates; structural changes rebuild sections

### IPC Communication

Main ↔ Renderer communication uses `contextBridge` + `ipcRenderer`, exposed as `window.electronAPI`, with `contextIsolation: true` and `nodeIntegration: false`. The preload exposes specific methods and listener-removal helpers; main-process IPC sender and payload validation remains incomplete.

---

## 🚀 Installation and Usage

### 📥 Quick Download

The easiest way to install is to download the latest installer directly from the releases page:

**[Download latest version (.exe)](https://github.com/PietroFilippo/ClockApp/releases/latest)**

Run the installer and follow the instructions. **Create a desktop icon** is checked by default and can be disabled. The desktop shortcut is removed on uninstall and kept across automatic updates. The installed app checks for updates automatically; click **Update** to download and install one.

---

### Development

#### Prerequisites

- Node.js compatible with Vite 7 (20.19+ or 22.12+; a supported LTS release is recommended)
- npm

#### Run the app

```bash
# Clone the repository
git clone https://github.com/PietroFilippo/ClockApp.git
cd ClockApp

# Install dependencies
npm install

# Run in development mode
npm run electron:dev
```

`electron:dev` builds the renderer first, then runs Vite build watch and Electron against `dist/`. It does not start the Vite dev server. Use `npm run dev` for the browser frontend.

### Production Build

```bash
# Generates the installer (.exe) in the release/ folder
npm run electron:build
```

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts the Vite server (frontend only) |
| `npm run build` | Frontend build via Vite |
| `npm run preview` | Serves the built frontend for browser preview |
| `npm run electron:dev` | Initial Vite build, then Vite build watch + Electron |
| `npm run electron:build` | Production build (Vite + electron-builder) |
| `npm run electron:publish` | Build + publish to GitHub Releases |

---

## ⌨️ Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+P` | Start or pause stopwatch* |
| `Alt+L` | Record lap* |
| `Alt+S` | Stop stopwatch* |
| `Alt+R` | Reset and start stopwatch* |
| `Enter` | Save a standard edit dialog (except buttons, multiline text, or controls that handle Enter) |
| `Escape` | Close the top standard dialog; stop the alert in an in-app ringing overlay |
| `Ctrl+R` | Reload application (development only) |
| `Ctrl+Shift+I` | DevTools (development only) |
| `Ctrl+Q` | Fully quit the application (while the app is focused) |

\* Default shortcuts; change them via **Stopwatch → Shortcuts → Keyboard shortcuts**. **Global shortcuts** is off for new installs; existing installs keep their setting. When enabled, successfully registered combinations work system-wide and other programs won't receive them; registration conflicts are shown in Settings and the dialog. When disabled, shortcuts work on any tab while the app is focused, except while typing in inputs, textareas, or selects, or recording a shortcut.

---

## ⚠️ Known Limitations

- Alarms and countdowns cannot alert while the app is fully closed or the computer is asleep. Timers/intervals catch up on reopening or wake; missed alarms and snoozes are only recovered within 30 minutes.
- Deadline-based timing follows the system clock, so manual clock changes can affect elapsed/remaining time.
- Intervals finish with a brief chime and a quiet notice; there is no interval option to ring until stopped. Save is available only in the in-app finish notice, and completion notices are not persisted across restarts.
- Some sound/color selection controls are not fully keyboard-accessible. At 400×520, stopwatch controls can be slightly clipped above the navigation until you scroll.
- Corrupt-data recovery does not cover every saved value; malformed timer or interval collections can still break a feature view.
- The Electron power-save blocker cannot guarantee that the OS will remain awake in every situation.
- On some systems, custom notifications may not overlay applications in "Exclusive Fullscreen" (games).
- Automatic updates work in packaged builds. In development mode, the check is disabled.
- Without code signing, Windows SmartScreen may show a warning when installing/updating.
- Animated Taskbar preview: Windows doesn't capture frames from minimized windows, so the thumbnail when hovering over the icon won't show real-time animation - the title and progress bar are used as a functional alternative.

---
