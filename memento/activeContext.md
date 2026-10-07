# Active Context — Desk Buddy

## Current Focus
Desk Assistant feature — voice Q&A powered by AiDE API with mic input and TTS output.

## Recent Changes (this session)

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
- `main.js` — `CHARACTERS` array with 10 tray menu entries (mouse + 9 leads)
- `renderer/main.js` — `Promise.all` preload of all 11 character instances; `CHAR_MAP` generic lookup; `leadHeight()` uses config lookup

## Active Decisions
- `YAW = Math.PI/2 - 0.45` — all characters must be side-profile (+X = walking direction, +Y = up, face features toward `+X`)
- `coffeeCup`: handle goes on -X (trailing side); face/eyes on `+X` of cylinder radius
- `debugBug`: body axis is X (head at +X, abdomen at -X), legs splay in ±Z
- `terminalBot`: CRT screen faces +X, legs are front/rear on X axis, cable arms in ±Z
- Character switch during active animation: abort current sequence → re-enter `walkIn` with new character immediately

## Recent Changes (this session) — Desk Assistant

### New files
| File | Purpose |
|---|---|
| [`renderer/aideClient.js`](renderer/aideClient.js) | ESM port of `aideClient.ts` — streams SSE from AiDE `/chat` endpoint |
| [`preload-assistant.js`](preload-assistant.js) | contextBridge for assistant window: `getCredentials()`, `close()` |
| [`renderer/assistant.html`](renderer/assistant.html) | Dark-themed UI: draggable title bar, conversation area, mic button, text input, Send/Stop |
| [`renderer/assistant.js`](renderer/assistant.js) | Web Speech API mic input → AiDE stream → SpeechSynthesis TTS output |

### Changes to existing files
- **[`main.js`](main.js)**: `import os`; `loadAideCredentials()` reads `~/.aide_creds/.env`; `openAssistantWindow()` creates framed BrowserWindow with `preload-assistant.js`; `ipcMain.handle('assistant:get-credentials')` returns loaded creds; `ipcMain.on('assistant:close')` closes window; tray menu has `🤖 Desk Assistant…` item

### Architecture decision — renderer-side fetch
The assistant renderer has `sandbox: false` so it can call `fetch` and use `SpeechRecognition` / `SpeechSynthesis` directly. The main process only provides credentials via IPC (`assistant:get-credentials`) — it does NOT proxy the stream. This keeps the streaming logic simple and in one place (`aideClient.js`).

### Credential format (`~/.aide_creds/.env`)
```
AIDE_BASE_URL=https://your-aide-server.com
AIDE_TOKEN=your-token-here
```

## Active Decisions
- `YAW = Math.PI/2 - 0.45` — all characters must be side-profile (+X = walking direction)
- Character switch during active animation: abort current sequence → re-enter `walkIn` with new character
- Assistant window: `frame: false` (custom drag titlebar) + `alwaysOnTop: false` (normal window)
- TTS: split into sentences for low-latency start; uses default system voice

## Next Steps
- Multi-monitor support (one overlay per display)
- In-app reminder editor UI
- macOS packaging
- README update with all characters + assistant feature
