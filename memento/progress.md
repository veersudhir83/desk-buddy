# Progress — Desk Buddy

## What Works
- ✅ Transparent always-on-top overlay window (Windows 10/11)
- ✅ System tray icon with full context menu
- ✅ Reminder scheduler: `at`, `everyMinutes`, `once` schedule types
- ✅ Reminder queue with auto-snooze (2 min ignore → 10 min snooze)
- ✅ Speech bubble with Done / Snooze buttons
- ✅ Click-through when idle; mouse hit-testing when active
- ✅ Character walk-in / speak / waitAck / walk-out state machine
- ✅ **5 selectable characters** via tray menu
  - Mouse 🐭 (Tom & Jerry style chaser)
  - Robo Dog 🤖 — cartoon robot dog, glowing eye, segmented tail wag
  - Coffee Cup ☕ — ceramic mug face, steam wisps, caffeinated jitter
  - Python Snake 🐍 — 12-segment sinusoidal body, beret, tongue flick
  - Monkey 🐒
- ✅ **Immediate character switching** — selecting a character from the tray now applies instantly, even mid-animation (re-enters walkIn with new character)
- ✅ Character preference persisted across restarts (`state.json`)
- ✅ Screen-share / meeting auto-pause
  - Windows: CptHost.exe (Zoom), OBS, PowerShell mic-in-use registry
  - macOS: lsof CoreAudio + pgrep CptHost
- ✅ GLB model swap-in support (drop `.glb` in `assets/models/`)
- ✅ Scheduler unit tests (`npm test`)
- ✅ Windows NSIS installer packaging (`npm run dist`)
- ✅ Memento (project memory) initialized and up-to-date

## What's Left / Known Issues
- ⬜ Multi-monitor support (single overlay on primary display only)
- ⬜ In-app reminder editor UI (currently JSON-file only)
- ⬜ macOS installer packaging
- ⬜ Linux packaging / testing
- ⬜ Screen-share detection on Linux
- ⬜ `SHQueryUserNotificationState` for fullscreen / presentation DND (Windows native)
- ⬜ README update with all character descriptions + screenshots

## Current Status
Core feature-complete for Windows. Desk Assistant feature removed. Next priority: multi-monitor support or in-app reminder editor.

## Recently Removed
- ~~Desk Assistant~~ — voice Q&A via AiDE API removed (all assistant IPC, credentials loading, TTS, preload, and UI files deleted)
