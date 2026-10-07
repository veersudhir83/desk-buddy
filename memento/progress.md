# Progress — Desk Buddy

## What Works
- ✅ Transparent always-on-top overlay window (Windows 10/11)
- ✅ System tray icon with full context menu
- ✅ Reminder scheduler: `at`, `everyMinutes`, `once` schedule types
- ✅ Reminder queue with auto-snooze (2 min ignore → 10 min snooze)
- ✅ Speech bubble with Done / Snooze buttons
- ✅ Click-through when idle; mouse hit-testing when active
- ✅ Character walk-in / speak / waitAck / walk-out state machine
- ✅ **10 selectable characters** via tray menu
  - Mouse + Cat (Tom & Jerry style chaser)
  - RoboDog — cartoon robot dog, glowing eye, segmented tail wag
  - Penguin — tuxedo waddle, flipper swing
  - Astronaut — puffy suit, moonwalk bounce, visor glow
  - Rubber Duck — bath toy bob, googly eyes, beak
  - Coffee Cup — ceramic mug face, steam wisps, caffeinated jitter ✅ *fixed*
  - Debug Bug — 6-leg tripod gait, antennae wiggle, compound eyes ✅ *fixed*
  - Terminal Bot — CRT screen, phosphor cursor blink, stiff march ✅ *fixed*
  - Night Owl — sleepy shuffle, round glasses, slow blink
  - Python Snake — 12-segment sinusoidal body, beret, tongue flick
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
- ⬜ README update with all 9 lead character descriptions + screenshots

## Current Status
**Active development** — all 10 characters functional, immediate switching works. Core feature set complete.

## Known Bugs / Limitations
- Transparency requires GPU compositing; `--disable-gpu` fallback shows solid background
- SmartScreen warning expected on unsigned installer builds
- macOS screen-share detection is best-effort (process-name heuristic only)
