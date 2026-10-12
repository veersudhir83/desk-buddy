# Project Brief — Desk Buddy

## What it is
Desk Buddy is a lightweight Windows (and macOS-compatible) desktop companion app built with **Electron + three.js**. At scheduled times, a 3-D character walks in along the bottom edge of the screen, a speech bubble appears with a reminder, and the user clicks **Done** or **Snooze 10 min**.

## Core requirements
1. Always-on-top transparent overlay window — no taskbar entry, click-through when idle
2. Tray icon for control: test, pause, character switcher, edit reminders, quit
3. Reminder scheduler: `at` (HH:MM + optional days), `everyMinutes` (+ optional between window), `once` (ISO datetime)
4. Characters walk in from offscreen left, stop at ~30% of screen width, speak, then exit right
5. Auto-snooze after 2 minutes of no interaction; manual snooze = 10 minutes
6. Screen-share / meeting detection: auto-pause reminders when user is in an active call
7. Procedural 3-D characters (no external model files required); GLB swap-in supported
8. Seven tray-selectable characters plus the automatic cat chaser; expressive faces, smooth animation, and consistent desktop grounding

## Goals
- Zero-friction: runs silently in the tray, reminds without being annoying
- Delightful: animated 3-D characters make reminders feel fun, not clinical
- Configurable: `reminders.json` edited in any text editor; config tunable in `renderer/config.js`
- Packageable: `npm run dist` → Windows NSIS installer

## Out of scope (MVP)
- In-app reminder editor UI
- Multi-monitor support
- macOS/Linux installer packaging
