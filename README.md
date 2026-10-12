# ⏰ Clock App

A modern, elegant desktop app for time management and productivity, built with **Electron** and **JavaScript**. Inspired by the design and functionality of the iOS Clock app.

[![GitHub Release](https://img.shields.io/github/v/release/PietroFilippo/ClockApp?style=flat-square)](https://github.com/PietroFilippo/ClockApp/releases/latest)
[![Electron](https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/github/license/PietroFilippo/ClockApp?style=flat-square)](LICENSE)

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
- Context menu (right-click) to edit or delete

### ⏰ Alarms
- Create alarms with specific times and custom labels
- **Repeat**: Set alarms for specific days of the week (with a "Select All" button)
- **Custom Sounds**: Choose from 13 bundled sounds or add your own audio files
- **Snooze**: Postpone alarms with configurable intervals (1–30 min)
- **Persistence**: Alarms, snooze states, and settings are saved automatically
- **Multi-select and Swipe**: Delete alarms in bulk or with quick swipe gestures
- Context menu for quick editing and deletion

### ⏱️ Stopwatch
- Precise stopwatch with a high-resolution display (hours, minutes, seconds, hundredths)
- **Analog Mode**: Smooth analog dial with a centered digital readout
- **Swipe View**: Smooth drag-gesture (swipe) transition between the digital and analog views
- **Laps**: Record laps with a visual indication of the best and worst
- **Customizable Colors**: Personalize the display color via an interactive Color Picker (canvas)
- **Speed**: Switch between 3 display update speeds
- **Configurable Shortcuts**: Record and customize keyboard shortcuts (Start/Stop, Lap, Stop, Reset) with smart conflict resolution
- **Download**: Export the recorded laps as a text file

### ⏲️ Timer
- **Multiple Timers**: Run and manage several timers simultaneously as compact cards (Cards View)
- Detailed visual interface (Drill-down View) with a **circular progress ring** (animated SVG)
- **Recents and Favorites**: Saved and recently used timers for quick reuse
- **Repeat**: Repeat the last timer straight from the notification
- Direct selection of hours, minutes, and seconds with smart validation
- Batch edit mode to manage the saved list
- **Multi-select and Swipe-to-Delete**: Manage your timer history easily with gestures
- **Limits and Replacement**: When the preset limit is reached, quickly pick an old timer or interval to replace

### ⏳ Intervals
- Create custom work cycles with multiple steps and independent alarms
- **Advanced Step Editing**: Easily move (▲▼), duplicate (⧉), or remove (✕) steps. Edit step names inline with a click.
- **Drag & Drop**: Reorder steps intuitively by dragging the handle icon (≡)
- **Persistent Drafts (Draft State)**: Your progress (times and steps) while creating intervals is saved automatically in real time, so you can navigate around the app without losing anything
- **Quick Management**: Supports multi-select and swipe-to-delete to remove several intervals at once or delete them with gestures
- **Smart Replacement**: When the saved intervals limit is reached, the app shows an intuitive modal to replace presets
- Dedicated visual interface showing the current progress, the active step, and the upcoming steps of the cycle

### ⚙️ Settings
| Setting | Description |
|---|---|
| **Start on Boot** | Starts the app automatically on login |
| **Minimize to Tray** | Keeps the app running in the background when closed |
| **Prevent Sleep** | Prevents the computer from sleeping during timers |
| **Steal Focus** | Notifications take keyboard focus |
| **Notification Style** | System (Windows), App Custom, Both, or None |
| **Notification Position** | 4 preset corners or a custom position (visual picker via drag & drop) |
| **Auto-Close Duration** | Time until the notification closes automatically (5s – 10min, a custom value in seconds, or Never) |
| **Auto Action Settings** | Timeout actions, with customizable duration, once the time limit is reached. Alarms (Stop or Auto-Snooze) and Timers (Stop or Auto-Repeat) |
| **Global Shortcuts** | Shortcuts work even when the app is minimized |

### 🔔 Notifications
- **Hybrid Notifications**: Support for native OS notifications and/or custom overlay windows
- **Visual Overlay**: In-app notification with action buttons (Stop, Snooze, Repeat)
- **Custom Position**: Choose where the notification appears on screen with a visual picker
- **Draggable**: The notification window can be dragged by clicking anywhere on it
- **Truncation**: Long labels are truncated to 60 characters

### 🔄 Automatic Updates
- Automatic check for new versions via **GitHub Releases** on startup
- Banner with an **Update** button (downloads and installs automatically) and a **View Release** button (opens the page in the browser)
- Animated progress bar during download
- Powered by `electron-updater`

### 📱 Overall User Experience
- **Scroll Persistence**: The scroll position of each main section (Alarms, Timers, World Clock, Intervals) is preserved perfectly when switching tabs.
- **Swipe Gestures**: Advanced fling physics (`translateX`) integration for deleting elements.
- **Live Taskbar Preview**: The window title and the taskbar icon progress bar are updated in real time with the active timer's countdown, visible when hovering over the minimized app.
- **Stability**: Global error handlers, automatic renderer crash recovery, and tray re-creation ensure the app doesn't close unexpectedly.

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
│   ├── preload.js                  # Secure bridge (contextBridge + ipcRenderer)
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
│   │   ├── RingOverlay.js          # Full-screen overlay for ringing alarms/timers
│   │   ├── Settings.js             # Settings screen
│   │   ├── Stopwatch.js            # Stopwatch with laps, colors, and speed
│   │   ├── Timer.js                # Timer with simultaneous cards and details
│   │   └── WorldClock.js           # World clock with drag & drop
│   │
│   ├── modules/                    # Business logic and state management
│   │   ├── AlarmManager.js         # Alarm state, scheduling, snooze, and audio
│   │   ├── IntervalTimerManager.js # Sequential execution engine for intervals
│   │   ├── StopwatchManager.js     # Stopwatch state and logic
│   │   └── TimerManager.js         # Manager for multiple concurrent timers
│   │
│   ├── services/                   # Services and integrations
│   │   └── NotificationService.js  # Unified management of notifications and alerts
│   │
│   ├── utils/                      # Shared utilities
│   │   ├── AnalogStopwatch.js      # Canvas-based analog dial component
│   │   ├── AudioManager.js         # Centralized audio manager (Web Audio API)
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
│       │   └── modal.css
│       └── features/               # Per-feature styles
│           ├── alarm.css
│           ├── settings.css
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
├── release/                        # Production build output
├── package.json                    # Dependencies, scripts, and electron-builder config
├── vite.config.js                  # Vite configuration
└── index.html                      # Main HTML with CSP and Service Worker
```

### Rendering Patterns

The components use an optimized rendering pattern:
- **Static skeleton**: The HTML structure (header, containers) is created only once in the `container`
- **Keyed DOM reconciliation**: Lists (alarms, clocks) use `data-alarm-id` / `data-index` to update, create, or remove only the elements that changed, with no `innerHTML` rebuilds
- **Granular updates**: Only the dynamic elements (counters, button states) are updated
- **Event delegation**: Event listeners are registered once on the container via delegation
- **Mode tracking**: Timer.js tracks the mode (picker/running) to avoid unnecessary rebuilds

### IPC Communication

Communication between Main ↔ Renderer is done exclusively via `contextBridge` + `ipcRenderer` (exposed as `window.electronAPI`), ensuring context isolation (`contextIsolation: true`). `preload.js` includes listener-removal functions to prevent memory leaks.

---

## 🚀 Installation and Usage

### 📥 Quick Download

The easiest way to install is to download the latest installer directly from the releases page:

**[Download latest version (.exe)](https://github.com/PietroFilippo/ClockApp/releases/latest)**

Just run the installer and follow the instructions. The wizard will automatically create a **shortcut on your Desktop** during installation. The app will receive updates automatically.

---

### Development

#### Prerequisites
- Node.js (recommended version: LTS)
- npm

### Development

```bash
# Clone the repository
git clone https://github.com/PietroFilippo/ClockApp.git
cd ClockApp

# Install dependencies
npm install

# Run in development mode
npm run electron:dev
```

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
| `npm run electron:dev` | Full dev (Vite watch + Electron) |
| `npm run electron:build` | Production build (Vite + electron-builder) |
| `npm run electron:publish` | Build + publish to GitHub Releases |

---

## ⌨️ Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+P` | Stopwatch Start/Stop* |
| `Alt+L` | Record lap* |
| `Alt+S` | Stop stopwatch* |
| `Alt+R` | Reset stopwatch* |
| `Ctrl+R` | Reload application (development only) |
| `Ctrl+Shift+I` | DevTools (development only) |
| `Ctrl+Q` | Fully quit the application |

\* Default shortcuts; they can be reconfigured in the Stopwatch keybinds modal.

---

## ⚠️ Known Limitations

- The power-save blocker (Power Save Blocker) is managed by Electron, but may depend on OS permissions.
- On some systems, custom notifications may not overlay applications in "Exclusive Fullscreen" (games).
- Automatic updates work in packaged builds. In development mode, the check is disabled.
- Without code signing, Windows SmartScreen may show a warning when installing/updating.
- Animated Taskbar preview: Windows doesn't capture frames from minimized windows, so the thumbnail when hovering over the icon won't show real-time animation - the title and progress bar are used as a functional alternative.

---
