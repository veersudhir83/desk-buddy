import * as electronNs from 'electron/main';
const { app, BrowserWindow, Menu, Tray, nativeImage, screen, ipcMain, shell } = electronNs['module.exports'] || electronNs;
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { Scheduler } from './src/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Supported lead characters (chaser cat is shown only with mouse)
const CHARACTERS = [
  { id: 'mouse',       label: 'Mouse 🐭 (Tom & Jerry)' },
  { id: 'roboDog',     label: 'Robo Dog 🤖'            },
  { id: 'coffeeCup',   label: 'Coffee Cup ☕'           },
  { id: 'pythonSnake', label: 'Python Snake 🐍'         },
  { id: 'monkey',      label: 'Monkey 🐒'               },
];
let activeCharacter = 'roboDog';

const TICK_MS = 15 * 1000;
const GAP_BETWEEN_REMINDERS_MS = 2000;
const DEMO    = process.argv.includes('--demo');
const VERBOSE = process.argv.includes('--verbose');

// ---- Meeting / screen-share detection ----
// Strategy: detect that the user is ACTIVELY IN A MEETING (not just that the app is open).
//
// Windows: Use PowerShell to query the Windows Audio Session API (WASAPI).
//   Any process capturing the microphone right now = user is in a call.
//   This correctly ignores Teams/Zoom/Slack when the app is open but idle.
//
// macOS: Use `lsof` to check if the audio input device (/dev/audiopolicy or
//   CoreAudio) is held open by a known meeting app process.
//
// Additional high-confidence signals (no mic needed):
//   • CptHost.exe  — Zoom's screen-share subprocess (only spawns when sharing)
//   • obs64.exe    — OBS is always broadcasting when running

// How often to poll (ms)
const SCREENSHARE_POLL_MS = 6000;

// PowerShell script: lists exe names that currently have an active mic capture session.
// Uses Windows.Media.Capture via COM / WinRT reflection-free approach through
// the AudioSessionManager2 — but the simplest reliable method is querying
// the registry key that Windows 10/11 writes when mic is in use.
const PS_MIC_IN_USE = `
$r = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged'
if (!(Test-Path $r)) { exit 0 }
Get-ChildItem $r | ForEach-Object {
  $last = (Get-ItemProperty $_.PSPath).LastUsedTimeStop
  if ($last -eq 0) { $_.PSChildName }
}
`.trim();

// Known meeting-app exe substrings (matched against mic-using process paths)
const MEETING_PROC_SUBSTRINGS = [
  'zoom', 'ms-teams', 'teams', 'webex', 'slack', 'discord',
  'skype', 'gotomeeting', 'around', 'google\\chrome', 'msedge',
  'firefox', 'brave', 'opera',
];

// macOS: process names that hold the mic open during a meeting
const MEETING_PROCS_MAC = [
  'zoom.us', 'CptHost', 'ZoomPhone',
  'Teams', 'MSTeams',
  'Webex', 'atmgr',
  'Slack',
  'Discord',
  'Skype',
  'Google Chrome Helper (Renderer)',
  'Chromium Helper (Renderer)',
  'firefox',
];

// ── AiDE credentials (loaded once at startup from ~/.aide_creds/.env) ────────
let aideCredentials = null; // { baseUrl, token }

function loadAideCredentials() {
  try {
    const envPath = path.join(os.homedir(), '.aide_creds', '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
    if (!vars.AIDE_TOKEN) throw new Error('AIDE_TOKEN not set in ~/.aide_creds/.env');
    aideCredentials = {
      baseUrl:   vars.AIDE_BASE_URL || 'https://aide.example.com',
      token:     vars.AIDE_TOKEN,
      timeoutMs: 60_000,
    };
    console.log('[main] AiDE credentials loaded from ~/.aide_creds/.env');
  } catch (err) {
    console.warn('[main] Could not load AiDE credentials:', err.message);
    aideCredentials = null;
  }
}

let win           = null;
let assistantWin  = null; // Desk Assistant window
let tray          = null;
let scheduler     = null;
let rendererReady = false;
let busy          = false;
let paused        = false;
let screenSharePaused = false; // auto-pause set by screen-share detection
let current       = null;
const queue       = [];

function overlayBounds() {
  return screen.getPrimaryDisplay().workArea;
}

function createWindow() {
  const b = overlayBounds();
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, hasShadow: false,
    resizable: false, movable: false, focusable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.once('ready-to-show', () => win.showInactive());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (VERBOSE) {
    win.webContents.on('console-message', (...args) => {
      const first = args[0];
      const msg = first && first.message !== undefined ? first.message : args[2];
      console.log('[renderer]', msg);
    });
  }
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] renderer gone:', details.reason);
    rendererReady = false;
    busy = false;
  });
  win.on('closed', () => { win = null; });
}

function enqueue(item) {
  if (current && current.id === item.id) return;
  if (queue.some((q) => q.id === item.id)) return;
  queue.push(item);
  pump();
}

function pump() {
  if (busy || paused || !rendererReady || !win || queue.length === 0) return;
  current = queue.shift();
  busy = true;
  win.webContents.send('reminder:show', current);
}

function tick() {
  if (paused) return;
  for (const item of scheduler.due(new Date())) enqueue(item);
}

function testReminder() {
  enqueue({ id: `test-${Date.now()}`, text: 'Test reminder: time to stretch your legs!' });
}

function remindersPath() {
  return path.join(app.getPath('userData'), 'reminders.json');
}

function statePath() {
  return path.join(app.getPath('userData'), 'state.json');
}

function seedReminders() {
  const target = remindersPath();
  if (fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'defaults', 'reminders.json'), target);
}

// ---- Character preference persistence ----
function loadCharacterPreference() {
  try {
    const s = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (s && CHARACTERS.some((c) => c.id === s.character)) {
      activeCharacter = s.character;
    }
  } catch { /* no saved state yet */ }
}

function saveCharacterPreference() {
  try {
    let s = {};
    try { s = JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { /* ok */ }
    s.character = activeCharacter;
    fs.writeFileSync(statePath(), JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('[main] could not save character preference:', err.message);
  }
}

// ---- Screen-share auto-pause helpers ----
function setScreenSharePause(active) {
  if (active === screenSharePaused) return;
  screenSharePaused = active;
  if (active) {
    // Only pause if not already manually paused
    if (!paused) {
      paused = true;
      console.log('[main] screen-share detected — reminders auto-paused');
    }
  } else {
    // Only resume if WE set the pause (not if user manually paused)
    paused = false;
    console.log('[main] screen-share ended — reminders resumed');
    pump();
  }
  if (tray) {
    tray.setToolTip(active ? 'Desk Buddy (paused — screen share active)' : 'Desk Buddy');
    tray.setContextMenu(buildTrayMenu());
  }
}

function detectScreenShare() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    // ── Step 1: High-confidence process signals (present only during active share) ──
    exec('tasklist /FO CSV /NH', { timeout: 4000 }, (err, stdout) => {
      if (err) return;
      const lower = stdout.toLowerCase();

      // CptHost.exe — Zoom's screen-share subprocess (spawned only when sharing)
      if (lower.includes('cpthost.exe')) { setScreenSharePause(true); return; }

      // OBS — always broadcasting when running
      if (lower.includes('obs64.exe') || lower.includes('obs32.exe') || lower.includes('obs.exe')) {
        setScreenSharePause(true); return;
      }

      // ── Step 2: Mic-in-use check via Windows registry ──────────────────────
      // Windows 10/11 writes LastUsedTimeStop = 0 for apps currently using the mic.
      // This correctly fires only when Teams/Zoom/etc. is ACTIVE on a call, not idle.
      exec(
        `powershell -NoProfile -NonInteractive -Command "${PS_MIC_IN_USE.replace(/\n/g, '; ')}"`,
        { timeout: 5000 },
        (psErr, psOut) => {
          if (psErr) { setScreenSharePause(false); return; }
          const lines = psOut.trim().split(/\r?\n/).filter(Boolean);
          // Each line is the registry key name = the exe path (backslashes replaced with #)
          const inMeeting = lines.some((line) => {
            const normalized = line.toLowerCase().replace(/#/g, '\\');
            return MEETING_PROC_SUBSTRINGS.some((s) => normalized.includes(s));
          });
          setScreenSharePause(inMeeting);
        }
      );
    });
  } else if (isMac) {
    // On macOS, check which processes have the mic open right now via lsof on the
    // CoreAudio socket, then match against known meeting app names.
    // Fallback: use `system_profiler` is too slow; pgrep on CptHost is reliable for Zoom share.
    exec(
      `lsof -n 2>/dev/null | grep -i 'auhal\\|coreaudio' | awk '{print $1}' | sort -u`,
      { timeout: 5000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          // Fallback: Zoom CptHost only present during active share
          exec('pgrep -x CptHost', { timeout: 3000 }, (e2, o2) => {
            setScreenSharePause(!e2 && o2.trim().length > 0);
          });
          return;
        }
        const procs = stdout.toLowerCase();
        const inMeeting = MEETING_PROCS_MAC.some((p) => procs.includes(p.toLowerCase()));
        setScreenSharePause(inMeeting);
      }
    );
  }
  // Linux: no reliable cross-distro method without extra native deps
}

function setCharacter(id) {
  if (!CHARACTERS.some((c) => c.id === id)) return;
  activeCharacter = id;
  saveCharacterPreference();
  if (win) win.webContents.send('character:set', id);
  if (tray) tray.setContextMenu(buildTrayMenu());
  console.log('[main] character ->', id);
}

// ---- Tray menu ----
// ── Assistant window ──────────────────────────────────────────────────────────
function openAssistantWindow() {
  if (assistantWin && !assistantWin.isDestroyed()) {
    assistantWin.focus();
    return;
  }

  assistantWin = new BrowserWindow({
    width: 460, height: 640,
    minWidth: 360, minHeight: 480,
    title: 'Desk Assistant',
    frame: false,          // custom title bar
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-assistant.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,       // needs fetch + Web Speech API
    }
  });

  assistantWin.loadFile(path.join(__dirname, 'renderer', 'assistant.html'));
  assistantWin.once('ready-to-show', () => assistantWin.show());
  assistantWin.on('closed', () => { assistantWin = null; });

  if (VERBOSE) {
    assistantWin.webContents.on('console-message', (...args) => {
      const first = args[0];
      const msg = first?.message ?? args[2];
      console.log('[assistant]', msg);
    });
  }
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Test reminder (now)', click: testReminder },
    { label: '🤖 Desk Assistant…', click: openAssistantWindow },
    { type: 'separator' },
    {
      label: screenSharePaused
        ? 'Pause reminders  (auto-paused: screen share)'
        : 'Pause reminders',
      type: 'checkbox',
      checked: paused,
      click: (item) => {
        screenSharePaused = false; // manual toggle clears auto-pause flag
        paused = item.checked;
        if (!paused) pump();
        if (tray) tray.setContextMenu(buildTrayMenu());
      }
    },
    {
      label: 'Character',
      submenu: CHARACTERS.map((c) => ({
        label:   c.label,
        type:    'radio',
        checked: activeCharacter === c.id,
        click:   () => setCharacter(c.id)
      }))
    },
    { label: 'Edit reminders…',  click: () => shell.openPath(remindersPath()) },
    { label: 'Open data folder', click: () => shell.openPath(app.getPath('userData')) },
    {
      label: 'Start with Windows', type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      enabled: app.isPackaged,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: 'Quit Desk Buddy', click: () => app.quit() }
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Desk Buddy');
  tray.setContextMenu(buildTrayMenu());
}

function registerIpc() {
  ipcMain.on('renderer:ready', () => {
    rendererReady = true;
    busy = false;
    if (win) win.webContents.send('character:set', activeCharacter);
    pump();
    if (DEMO) setTimeout(testReminder, 1500);
  });

  ipcMain.on('overlay:ignore-mouse', (_e, ignore) => {
    if (win) win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  });

  ipcMain.on('reminder:action', (_e, payload) => {
    if (!payload || !current || payload.id !== current.id) return;
    if (VERBOSE) console.log('[main] action', payload.action, payload.id);
    if (payload.action === 'snooze') scheduler.snooze(current);
    else if (payload.action !== 'done') return;
    current = null;
    busy = false;
    setTimeout(pump, GAP_BETWEEN_REMINDERS_MS);
  });

  // ── Assistant IPC ───────────────────────────────────────────────────────────

  // Renderer asks for AiDE credentials
  ipcMain.handle('assistant:get-credentials', () => {
    if (!aideCredentials) loadAideCredentials(); // lazy retry if first load failed
    if (!aideCredentials) {
      throw new Error('AiDE credentials not found. Add AIDE_BASE_URL and AIDE_TOKEN to ~/.aide_creds/.env');
    }
    return aideCredentials;
  });

  // Renderer sends conversation messages; main streams AiDE response back as IPC tokens.
  // This runs in the Node.js main process (not Chromium renderer) so fetch + ReadableStream
  // work reliably without the chunked_data_pipe ERR_FAILED issue.
  ipcMain.on('assistant:chat', async (event, messages) => {
    if (!aideCredentials) {
      if (!event.sender.isDestroyed()) event.sender.send('assistant:error', 'AiDE credentials not configured');
      return;
    }

    const endpoint = `${aideCredentials.baseUrl}/chat`;
    const payload  = {
      messages: [
        { role: 'system', content: 'You are a helpful desk assistant. Be concise and clear.' },
        ...messages,
      ],
      stream: true,
    };

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${aideCredentials.token}`,
          'Accept':        'application/json, text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(aideCredentials.timeoutMs ?? 60_000),
      });
    } catch (err) {
      if (!event.sender.isDestroyed()) event.sender.send('assistant:error', err.message);
      return;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (!event.sender.isDestroyed()) event.sender.send('assistant:error', `HTTP ${response.status}: ${body}`);
      return;
    }

    let fullText = '';
    let buffer   = '';
    const decoder = new TextDecoder();
    const reader   = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data:')) continue;
          try {
            const chunk   = JSON.parse(trimmed.slice('data:'.length).trim());
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              if (!event.sender.isDestroyed()) event.sender.send('assistant:token', content);
            }
          } catch { /* skip non-JSON lines */ }
        }
      }
    } catch (err) {
      if (!event.sender.isDestroyed()) event.sender.send('assistant:error', err.message);
      return;
    }

    if (!event.sender.isDestroyed()) event.sender.send('assistant:done', fullText);
  });

  // ── TTS via PowerShell SAPI (high-quality Windows Neural voices) ──────────
  // We spawn a persistent PowerShell process per speak request.
  // The script picks the best available voice: Neural > Standard English.
  let ttsProc = null;

  ipcMain.handle('assistant:speak', (_event, text) => {
    return new Promise((resolve) => {
      // Kill any previous TTS
      if (ttsProc) { try { ttsProc.kill(); } catch (_) {} ttsProc = null; }

      // Write a temp .ps1 file — avoids all shell-quoting issues
      const tmpScript = path.join(app.getPath('temp'), 'buddy-tts.ps1');
      // Escape single-quotes for PowerShell string literal
      const safe = (text || '').replace(/'/g, "''").replace(/[\r\n]+/g, ' ');

      const ps = [
        'Add-Type -AssemblyName System.Speech',
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
        '$voices = $s.GetInstalledVoices() | Where-Object { $_.Enabled } | Select-Object -ExpandProperty VoiceInfo',
        "$neural  = $voices | Where-Object { $_.Name -match 'Neural|Aria|Guy|Jenny|Ryan|Sonia|Libby|Mia|Zira|David' } | Select-Object -First 1",
        "$english = $voices | Where-Object { $_.Culture.Name -match '^en' } | Select-Object -First 1",
        '$chosen  = if ($neural) { $neural } elseif ($english) { $english } else { $null }',
        'if ($chosen) { $s.SelectVoice($chosen.Name) }',
        '$s.Rate   = 0',
        '$s.Volume = 100',
        `$s.Speak('${safe}')`,
        '$s.Dispose()',
      ].join('\r\n');

      try { fs.writeFileSync(tmpScript, ps, 'utf8'); } catch (e) { return resolve(); }

      // Run the script file — no quoting issues with -File
      ttsProc = exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpScript}"`,
        { windowsHide: true, timeout: 120_000 },
        (err) => {
          ttsProc = null;
          try { fs.unlinkSync(tmpScript); } catch (_) {}
          if (err && err.killed) return resolve(); // stopped intentionally
          resolve();
        }
      );
    });
  });

  ipcMain.on('assistant:speak-stop', () => {
    if (ttsProc) { try { ttsProc.kill(); } catch (_) {} ttsProc = null; }
  });

  // Close the assistant window
  ipcMain.on('assistant:close', () => {
    if (ttsProc) { try { ttsProc.kill(); } catch (_) {} ttsProc = null; }
    if (assistantWin && !assistantWin.isDestroyed()) assistantWin.close();
  });
}

function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('window-all-closed', () => { /* tray app: keep running */ });
  // Second instance → focus / open assistant window
  app.on('second-instance', () => {
    if (assistantWin && !assistantWin.isDestroyed()) assistantWin.focus();
    else if (win) win.focus();
  });

  app.whenReady().then(() => {
    seedReminders();
    loadCharacterPreference();
    loadAideCredentials();
    scheduler = new Scheduler({
      remindersPath: remindersPath(),
      statePath:     statePath()
    });
    registerIpc();
    createWindow();
    createTray();
    setInterval(tick, TICK_MS);
    setInterval(detectScreenShare, SCREENSHARE_POLL_MS);
    detectScreenShare(); // run once immediately at startup

    screen.on('display-metrics-changed', () => {
      if (win) win.setBounds(overlayBounds());
    });
  });
}

main();
