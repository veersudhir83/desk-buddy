# Tech Context — Desk Buddy

## Runtime & Platform
| Item | Detail |
|---|---|
| Runtime | Electron 44.x (Chromium + Node.js) |
| Target OS | Windows 10/11 (primary), macOS (partial) |
| Node version | 20 LTS or newer |
| Module system | ESM (`"type": "module"` in package.json) |

## Key Dependencies
| Package | Version | Purpose |
|---|---|---|
| `three` | ^0.186.1 | 3-D scene, procedural characters, OrthographicCamera |
| `electron` | ^44.6.0 | App shell, tray, IPC, transparent overlay window |
| `electron-builder` | ^26.15.3 | NSIS installer packaging (`npm run dist`) |

## Architecture
```
main.js (Electron main process)
  ├── BrowserWindow (transparent overlay, always-on-top)
  ├── Tray (system tray icon + context menu)
  ├── Scheduler (src/scheduler.js)
  ├── IPC channels: renderer:ready, character:set, reminder:show, reminder:action, overlay:ignore-mouse
  └── Screen-share detection (child_process → PowerShell / pgrep)

preload.js (contextBridge)
  └── Exposes: buddy.onReminder, buddy.sendAction, buddy.setIgnoreMouse, buddy.onCharacterSet, buddy.ready

renderer/ (Chromium renderer process)
  ├── index.html
  ├── main.js — Three.js scene, state machine, character management
  ├── characters.js — procedural buildAnimal(), buildRoboDog(), GLB loader, Character wrapper
  └── config.js — all tunables (speed, heights, character configs, activeCharacter)
```

## Rendering
- **Camera**: `OrthographicCamera` in pixel units, origin bottom-left of work area
- **Lighting**: HemisphereLight (1.7) + DirectionalLight sun (1.8) from top-left
- **Materials**: `MeshLambertMaterial` (animals) / `MeshPhongMaterial` with specular (RoboDog)
- **FPS cap**: 30 fps (configurable via `CONFIG.fpsCap`)
- **Pixel ratio**: `window.devicePixelRatio` (HiDPI aware)

## Character System
- Characters are **procedural** by default (no external files needed)
- `createCharacter(cfg)` factory: tries GLB first, falls back to procedural
- Available characters: `mouse`, `cat` (chaser), `roboDog`
- Active character persisted in `userData/state.json`
- `YAW = Math.PI/2 - 0.45` — 3/4 side view applied to all characters

## Scheduler (`src/scheduler.js`)
- Reads `reminders.json` from `app.getPath('userData')` (seeded from `defaults/reminders.json`)
- Schedule types: `at` (HH:MM + optional `days`), `everyMinutes` (+ optional `between`), `once` (ISO)
- Snooze state persisted in `userData/state.json`
- Tick interval: 15 seconds
- Unit tested via `node:test` → `npm test`

## Screen-Share Detection
- **Windows**: `tasklist` for high-confidence signals (CptHost.exe, obs64.exe) + PowerShell registry query for mic-in-use (`HKCU\...\CapabilityAccessManager`)
- **macOS**: `lsof` on CoreAudio + `pgrep CptHost` fallback
- Poll interval: 6 seconds

## Dev Commands
| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm start` | Run app normally |
| `npm run demo` | Run with `--demo` flag (shows test reminder after 1.5s) |
| `npm test` | Run scheduler unit tests (no GUI) |
| `npm run dist` | Build Windows NSIS installer → `dist/` |
| `npm run demo -- --verbose` | Also print renderer console logs |

## Key File Paths
| Path | Purpose |
|---|---|
| `main.js` | Electron main process |
| `preload.js` | contextBridge API |
| `renderer/main.js` | Scene + state machine |
| `renderer/characters.js` | All character code |
| `renderer/config.js` | All tunables |
| `src/scheduler.js` | Reminder scheduling logic |
| `test/scheduler.test.js` | Unit tests |
| `defaults/reminders.json` | Seed reminders (copied on first run) |
| `assets/icon.png` | App icon |
| `assets/tray.png` | Tray icon |
| `assets/models/` | Drop `.glb` files here for custom characters |
