# Product Context — Desk Buddy

## Why it exists
Knowledge workers forget to hydrate, stretch, take breaks, and attend stand-ups. Calendar pop-ups are easy to dismiss and boring. Desk Buddy makes reminders delightful by having an animated 3-D character physically walk across the desktop to deliver the message — impossible to ignore, hard to dislike.

## Problems it solves
| Problem | Solution |
|---|---|
| Reminder fatigue | Fun animated character grabs attention without being alarming |
| Annoying during meetings/screenshare | Auto-detects active calls (mic-in-use) and pauses |
| Complex reminder tools | Plain JSON file — edit in Notepad |
| Intrusive overlay | Transparent, click-through when idle; tray-only presence |

## How it works (user perspective)
1. App starts silently, sits in the system tray
2. At the right time, the selected character (RoboDog by default) walks in from the left, stops, and shows a speech bubble
3. User reads the reminder, clicks **Done** (or **Snooze**); character exits right
4. If ignored for 2 min → auto-snooze 10 min
5. During a Teams/Zoom/Webex call → reminders are automatically held

## User experience goals
- First launch: works immediately with sensible default reminders
- Character should feel alive: smooth walk, wagging tail, head nods, idle breathing, and blinking where supported
- Expressions remain visible during turns; characters rest on the desktop baseline with soft, readable shading
- Speech bubble is clearly readable, positioned above the character's head
- Clicking the character is satisfying (poke → hop animation)
- Tray menu is the only UI surface needed for 95% of use

## Target users
Primarily solo office workers and developers on Windows 10/11 who want lightweight, fun health/productivity nudges.
