# Active Context — Desk Buddy

## Current Focus
Maintaining and improving the core character animation overlay and reminder system.

## Recent Changes (last session)

### 1. Six dev-themed characters added (`renderer/characters.js`)
| Kind | Builder | Notes |
|---|---|---|
| `rubberDuck` | `buildRubberDuck` | Side-profile, yellow bath toy, googly eyes, beak, body bob |
| `coffeeCup` | `buildCoffeeCup` | Side-profile (+X), face on +X cylinder wall, handle on -X side, steam wisps |
| `debugBug` | `buildDebugBug` | Side-profile (+X), 3-segment body along X, 6 legs in ±Z, tripod gait |
| `terminalBot` | `buildTerminalBot` | Side-profile (+X), CRT screen on +X face, keyboard torso, cable arms in ±Z |
| `nightOwl` | `buildNightOwl` | Side-profile, round owlbody, glasses, slow blink, tired shuffle |
| `pythonSnake` | `buildPythonSnake` | Side-profile, 12-segment sinusoidal body, beret, glasses, tongue flick |

### 2. Orientation fix for coffeeCup / debugBug / terminalBot
- **Root cause**: these were originally built with faces toward `+Z` but YAW rotates `+Z` sideways — they appeared as wrong-side-on to viewer
- **Fix**: redesigned all three to side-profile (+X = forward direction). Face features / screen / eyes are now on the `+X` face so YAW correctly presents them to the viewer

### 3. Immediate character switch (`renderer/main.js`)
- **Old**: `onCharacterSet` handler had `if (active) return;` — user had to wait until the reminder sequence ended
- **Fix**: removed the guard; `setActiveCharacter()` now detects if mid-animation and calls `go('walkIn')` immediately with the new character, gracefully aborting the current sequence

### 4. All characters wired end-to-end
- `renderer/config.js` — 9 character config entries + heights
- `main.js` — `CHARACTERS` array with 5 tray menu entries
- `renderer/main.js` — `Promise.all` preload of all character instances; `CHAR_MAP` generic lookup; `leadHeight()` uses config lookup

### 5. Desk Assistant removed
- Removed `openAssistantWindow()`, all `assistant:*` IPC handlers, AiDE credentials loading, and TTS PowerShell code from `main.js`
- Deleted files: `preload-assistant.cjs`, `preload-assistant.js`, `renderer/assistant.html`, `renderer/assistant.js`, `renderer/aideClient.js`, `aideClient.ts`
- Removed `import os` (no longer needed) and `assistantWin` variable from `main.js`
- Removed `🤖 Desk Assistant…` tray menu item

## Active Decisions
- `YAW = Math.PI/2 - 0.45` — all characters must be side-profile (+X = walking direction, +Y = up, face features toward `+X`)
- `coffeeCup`: handle goes on -X (trailing side); face/eyes on `+X` of cylinder radius
- `debugBug`: body axis is X (head at +X, abdomen at -X), legs splay in ±Z
- `terminalBot`: CRT screen faces +X, legs are front/rear on X axis, cable arms in ±Z
- Character switch during active animation: abort current sequence → re-enter `walkIn` with new character immediately

## Next Steps
- Multi-monitor support (single overlay on primary display only)
- In-app reminder editor UI (currently JSON-file only)
- macOS / Linux packaging
