'use strict';
import fs from 'node:fs';

const GRACE_MS = 2 * 60 * 60 * 1000; // a missed "at" reminder is dropped after 2 h
const SNOOZE_MS = 10 * 60 * 1000;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[scheduler] cannot read ${file}: ${err.message}`);
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function atToday(hhmm, now) {
  const m = HHMM.exec(hhmm);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function inWindow(between, now) {
  if (!Array.isArray(between) || between.length !== 2) return true;
  const a = atToday(between[0], now);
  const b = atToday(between[1], now);
  if (!a || !b) return true;
  return now >= a && now <= b;
}

function isValid(r) {
  return r && typeof r.id === 'string' && r.id && typeof r.text === 'string' && r.text;
}

class Scheduler {
  /**
   * @param {{remindersPath: string, statePath: string, startedAt?: Date}} opts
   */
  constructor({ remindersPath, statePath, startedAt = new Date() }) {
    this.remindersPath = remindersPath;
    this.statePath = statePath;
    this.startedAt = startedAt;
    const saved = readJson(statePath, {});
    this.state = {
      lastFired: saved.lastFired && typeof saved.lastFired === 'object' ? saved.lastFired : {},
      snoozed: Array.isArray(saved.snoozed) ? saved.snoozed : []
    };
  }

  /** Re-read on every call so edits to reminders.json apply without a restart. */
  reminders() {
    const list = readJson(this.remindersPath, []);
    return Array.isArray(list) ? list.filter(isValid) : [];
  }

  /** Returns reminders that are due at `now` and records them as fired. */
  due(now = new Date()) {
    const out = [];
    const seen = new Set();
    const push = (r) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      out.push({ id: r.id, text: r.text });
    };

    const stillSnoozed = [];
    for (const s of this.state.snoozed) {
      if (new Date(s.until) <= now) push(s);
      else stillSnoozed.push(s);
    }
    const changed = stillSnoozed.length !== this.state.snoozed.length;
    this.state.snoozed = stillSnoozed;

    let fired = false;
    for (const r of this.reminders()) {
      if (seen.has(r.id) || !this._isDue(r, now)) continue;
      push(r);
      this.state.lastFired[r.id] = now.toISOString();
      fired = true;
    }
    if (changed || fired) this._save();
    return out;
  }

  snooze(item, now = new Date()) {
    const until = new Date(now.getTime() + SNOOZE_MS).toISOString();
    this.state.snoozed = this.state.snoozed.filter((s) => s.id !== item.id);
    this.state.snoozed.push({ id: item.id, text: item.text, until });
    this._save();
  }

  _isDue(r, now) {
    if (r.enabled === false) return false;
    const last = this.state.lastFired[r.id] ? new Date(this.state.lastFired[r.id]) : null;

    if (r.once) {
      const t = new Date(r.once);
      return !isNaN(t) && now >= t && !last;
    }
    if (r.at) {
      // r.at may be a single "HH:MM" string or an array of "HH:MM" strings (multiple daily times)
      const atTimes = Array.isArray(r.at) ? r.at : [r.at];
      if (Array.isArray(r.days) && !r.days.includes(now.getDay())) return false;
      for (const hhmm of atTimes) {
        const t = atToday(hhmm, now);
        if (!t) continue;
        if (now >= t && now - t <= GRACE_MS && (!last || last < t)) return true;
      }
      return false;
    }
    if (Number(r.everyMinutes) > 0) {
      if (!inWindow(r.between, now)) return false;
      const base = last || this.startedAt;
      return now - base >= r.everyMinutes * 60000;
    }
    return false;
  }

  _save() {
    try {
      writeJson(this.statePath, this.state);
    } catch (err) {
      console.error(`[scheduler] cannot save state: ${err.message}`);
    }
  }
}

export { Scheduler, SNOOZE_MS, GRACE_MS };
