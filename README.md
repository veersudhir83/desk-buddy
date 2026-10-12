# Desk Buddy

A 3-D desktop companion for Windows (and macOS). At reminder time a character walks in along the
bottom of the screen, shows a speech bubble with your reminder, and you click **Done** or
**Snooze 10 min**. Built with Electron + three.js. All characters are fully procedural — no
external 3-D model files required (`.glb` swap-in is supported when you have them).

---

## Run locally (Windows 10/11)

Prerequisite: Node.js 20 LTS or newer (https://nodejs.org). Check with `node -v`.

```powershell
cd desk-buddy
npm install
npm run demo      # starts the app and fires a test reminder after ~1.5 s
```

Normal use: `npm start`. The app has no main window — find the tray icon (bottom-right, possibly
under the `^` overflow arrow), right-click it:

| Menu item | What it does |
|---|---|
| Test reminder (now) | Plays the walk-in sequence immediately |
| Pause reminders | Stops new reminders (auto-paused during meetings too) |
| Character | Switch active character (see below) |
| Edit reminders… | Opens `reminders.json` in your default editor |
| Open data folder | Opens `%APPDATA%\desk-buddy` |
| Start with Windows | Enabled only in the packaged build |
| Quit Desk Buddy | Exits |

Run the scheduler unit tests (no GUI needed):

```powershell
npm test
```

---

## Characters

The tray **Character** submenu offers seven characters; the cat appears automatically when
Mouse is selected. All procedural characters have walk, idle, talk, and click-to-hop animations.

| Character | Description |
|---|---|
| 🐭 **Mouse** | Warm brown mouse with round ears, whiskers, blinking eyes, and a curved pink tail; runs with the cat chasing behind |
| 🐱 **Cat** (chaser) | Blue-grey cat with cream muzzle, whiskers, blinking eyes, and a curved tail |
| 🤖 **Robo Dog** | Rounded pearl-white robot dog with blue mono-eye, articulated legs, and a wagging segmented tail |
| ☕ **Coffee Cup** | Ceramic mug with blinking eyes, a curved smile, translucent steam, and a bouncy walk |
| 🐍 **Python Snake** | Segmented green snake with glasses, beret, tongue flick, and a rippling body |
| 🐒 **Monkey** | Rounded cartoon monkey with expressive features and animated limbs and tail |
| 🧸 **Mr. Bean** | Cartoon figure with expressive brows, suit, tie, and teddy bear |
| 🧒 **Hoodie Kid** | Blue hoodie, backpack, white sneakers, blinking eyes, warm button nose, and a continuous curved smile |

Characters use softer Phong shading, with a satin sheen on polished surfaces. Procedural models
are aligned to the desktop baseline. Camera-facing characters make a small turn while walking
and face the viewer when resting or talking; they keep their faces visible in both travel directions.
Movement uses smooth facing transitions, and hop animations settle without overshooting.

To preview the changes, run `npm run demo`, switch characters through the tray menu, and click
characters to try their hop. The latest update passed all 11 scheduler tests and construction,
height, grounding, and animation checks for all eight procedural characters. In-app visual review
is still pending.

> **Tip:** To add your own `.glb` character, drop the file in `assets/models/` and set the `model`
> path and clip names in `renderer/config.js`. The app falls back to the procedural version
> automatically if the model fails to load.

---

## Smart auto-pause during meetings

Desk Buddy detects when you are **actively in a call** and pauses reminders automatically — it
resumes the moment your call ends. No configuration needed.

**What triggers the pause:**

| Platform | Signal |
|---|---|
| Windows | `CptHost.exe` (Zoom screen-share process) · OBS Studio running · Microphone held open by Teams / Webex / Slack / Discord / Chrome (checked via Windows registry) |
| macOS | Microphone held open by known meeting apps (via `lsof` on CoreAudio) · Zoom `CptHost` process |

The tray icon tooltip changes to *"Desk Buddy (paused — screen share active)"* while auto-paused.
You can override by clicking **Pause reminders** in the tray menu.

---

## Reminders

`%APPDATA%\desk-buddy\reminders.json` is created on first run. Edits take effect within 15 seconds.

```json
[
  { "id": "water",   "text": "Drink some water! 💧",          "everyMinutes": 60, "between": ["09:00", "18:00"] },
  { "id": "standup", "text": "Stand-up in 5 minutes.",         "at": "09:55", "days": [1,2,3,4,5] },
  { "id": "stretch", "text": "Stretch and rest your eyes. 👀", "at": "15:30" },
  { "id": "call",    "text": "Call the vendor.",               "once": "2026-10-09T14:00:00" }
]
```

**Schedule types** (exactly one per entry):

| Field | Format | Example |
|---|---|---|
| `at` | `"HH:MM"` — fires daily (add `"days": [0-6]` to limit) | `"at": "09:00", "days": [1,2,3,4,5]` |
| `everyMinutes` | integer — repeating interval (add `"between"` for a time window) | `"everyMinutes": 45, "between": ["08:00","17:00"]` |
| `once` | ISO 8601 datetime — fires once then is done | `"once": "2026-12-01T10:00:00"` |

- `"enabled": false` disables an entry without deleting it.
- `at` reminders missed by more than 2 hours (app was closed) are skipped for that day.
- Auto-snooze after 2 minutes of no interaction; manual snooze = 10 minutes.

---

## Customise

| File | What to change |
|---|---|
| `renderer/config.js` | Speed, stop position, chaser gap, timings, character heights, `.glb` paths |
| `renderer/characters.js` | Procedural character geometry and animations |
| `renderer/main.js` | State machine: `hidden → walkIn → speak → waitAck → walkOut → hidden` |
| `src/scheduler.js` | Reminder scheduling logic (unit-tested) |
| `defaults/reminders.json` | Default reminders seeded on first run |

---

## Package an installer

```powershell
npm run dist      # → dist\Desk Buddy Setup 0.1.0.exe
```

---

## Project layout

```
main.js              Electron main: overlay window, tray, IPC, queue, screen-share detection
preload.js           contextBridge API (buddy.onReminder / sendAction / setIgnoreMouse / onCharacterSet / ready)
src/scheduler.js     Due-time logic, snooze, persisted state
renderer/
  index.html         Overlay page
  main.js            Three.js scene + state machine + character orchestration
  characters.js      Eight procedural characters + GLB loader
  config.js          All tunables and character configs
defaults/
  reminders.json     Seed reminders copied to userData on first run
assets/
  icon.png           App icon
  tray.png           Tray icon
  models/            Drop .glb files here for custom characters
test/
  scheduler.test.js  Unit tests (node:test, no GUI)
memento/             Project memory files for AI-assisted development
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing appears | Right-click tray icon → Test reminder. No tray icon? Check `npm start` output for errors. |
| Black rectangle instead of transparency | Update GPU drivers, or run `electron . --disable-gpu` |
| Click-through feels off | Run `npm run demo -- --verbose` to see renderer logs |
| SmartScreen warning on installer | Expected for unsigned builds |
| Reminders paused unexpectedly | Check tray tooltip — if it says "screen share active", your mic is in use by a meeting app |

---

## Known limitations & roadmap

1. **Meeting detection** — Windows mic-registry heuristic; no native DND/fullscreen API yet.
2. **Primary display only** — multi-monitor needs one overlay per display.
3. **No in-app reminder editor** — edit the JSON file directly.
4. **Packaging** — Windows NSIS installer works; macOS `.dmg` not yet set up.
