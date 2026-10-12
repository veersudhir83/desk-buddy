# System Patterns — Desk Buddy

## Overall Architecture

```mermaid
flowchart TD
    MainProcess
    Scheduler
    Tray
    OverlayWindow
    PreloadBridge
    RendererScene
    CharacterSystem
    ScreenShareDetector

    MainProcess --> Scheduler
    MainProcess --> Tray
    MainProcess --> OverlayWindow
    MainProcess --> ScreenShareDetector
    OverlayWindow --> PreloadBridge
    PreloadBridge --> RendererScene
    RendererScene --> CharacterSystem
```

## State Machine (Renderer)

```mermaid
stateDiagram-v2
    hidden --> walkIn
    walkIn --> speak
    speak --> waitAck
    waitAck --> walkOut
    walkOut --> hidden
    waitAck --> walkOut
```

- `hidden` → triggered by `reminder:show` IPC from main
- `walkIn` → character walks to `stopX` (~30% screen width)
- `speak` → plays talk animation, shows speech bubble for `speakSeconds`
- `waitAck` → plays idle animation, waits for user click or `autoSnoozeSeconds`
- `walkOut` → character exits right; cat (if active) follows

## IPC Channels
| Channel | Direction | Purpose |
|---|---|---|
| `renderer:ready` | renderer → main | Renderer is initialized, start pumping queue |
| `reminder:show` | main → renderer | Show a reminder object `{id, text}` |
| `reminder:action` | renderer → main | `{id, action: 'done'|'snooze'}` |
| `character:set` | main → renderer | Switch active character by name |
| `overlay:ignore-mouse` | renderer → main | Enable/disable click-through |

## Character Pattern

```mermaid
flowchart TD
    createCharacter
    GLBLoader
    buildRoboDog
    buildAnimal
    OtherProceduralBuilders
    CharacterWrapper

    createCharacter --> GLBLoader
    createCharacter --> buildRoboDog
    createCharacter --> buildAnimal
    createCharacter --> OtherProceduralBuilders
    GLBLoader --> CharacterWrapper
    buildRoboDog --> CharacterWrapper
    buildAnimal --> CharacterWrapper
    OtherProceduralBuilders --> CharacterWrapper
```

Each character implementation exposes:
```js
{ object: THREE.Group, play(name), poke(), update(dt) }
```
`poke()` is optional (the GLB implementation omits it). Implementations may set `frontFacing: true`.

The `Character` wrapper adds `.x`, `.face(dir)`, smooth facing transitions, a clamped animation delta, and blinking for explicitly tagged eye groups. Camera-facing characters turn slightly during walking and face the viewer for idle/talk; others use the signed side-view YAW. The factory grounds procedural models with an outer group after height normalization, preserving inner rig pivots and animations.

## Procedural Character Geometry (RoboDog)
- All meshes use `MeshPhongMaterial` (shininess + specular) for cartoon-metallic look
- Shape language: **spheres and cylinders only** — no flat boxes
- Hierarchy: `root → rig → body → [head, neck, legs×4, tail, shoulder bulges]`
- Head features lie on the body's `+Z` axis; signed `YAW` presents a three-quarter side view
- Animation driven by `update(dt)` with sinusoidal time-based curves — no keyframes

## Scheduler Pattern
- `Scheduler` class reads `reminders.json` on every `due()` call (file watched implicitly by re-read)
- Returns items due since last check; main process enqueues them
- Snooze state and last-fired times persisted in `state.json` alongside character preference
- Missed `at` reminders older than 2 hours are skipped

## Screen-Share Auto-Pause
- Polled every 6 seconds from main process via `child_process.exec`
- Windows: `tasklist` for `CptHost.exe`/OBS + PowerShell registry for mic-in-use
- macOS: `lsof` on CoreAudio + `pgrep CptHost` fallback
- Sets `paused = true` only when mic is actively held open by a known meeting app
- Tray menu reflects auto-pause state; manual override clears the auto-pause flag

## Key Design Decisions
| Decision | Rationale |
|---|---|
| OrthographicCamera in pixel units | Characters positioned in CSS pixels, no perspective distortion |
| Procedural geometry (no GLB required) | Zero external assets needed; GLB swap-in when ready |
| `MeshPhongMaterial` for procedural characters | Soft or satin shading without full PBR cost |
| Tagged eye groups and shared curve helper | Reusable blinking and continuous facial/organic details |
| Outer procedural grounding group | Align soles to the desktop while preserving animation pivots |
| Single tray as only UI | Minimal surface area; no main window to manage |
| `node:test` for scheduler | Zero extra dependencies for unit tests |
| ESM throughout | Future-proof; Electron 44 supports it natively |
