import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Scheduler, SNOOZE_MS } from '../src/scheduler.js';

function setup(reminders, startedAt = new Date(2026, 9, 7, 8, 0)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-'));
  const remindersPath = path.join(dir, 'reminders.json');
  const statePath = path.join(dir, 'state.json');
  fs.writeFileSync(remindersPath, typeof reminders === 'string' ? reminders : JSON.stringify(reminders));
  return { s: new Scheduler({ remindersPath, statePath, startedAt }), remindersPath, statePath };
}
const at = (h, m = 0, d = 7) => new Date(2026, 9, d, h, m); // 2026-10-07 is a Wednesday

test('"at" fires once per day, then again the next day', () => {
  const { s } = setup([{ id: 'a', text: 'x', at: '09:30' }]);
  assert.equal(s.due(at(9, 29)).length, 0);
  assert.equal(s.due(at(9, 30)).length, 1);
  assert.equal(s.due(at(9, 31)).length, 0);
  assert.equal(s.due(at(9, 30, 8)).length, 1);
});

test('"at" is dropped after the grace period', () => {
  const { s } = setup([{ id: 'a', text: 'x', at: '09:30' }]);
  assert.equal(s.due(at(12, 0)).length, 0);
});

test('"at" as array fires at each listed time', () => {
  const { s } = setup([{ id: 'a', text: 'x', at: ['09:30', '11:55'] }]);
  assert.equal(s.due(at(9, 29)).length, 0);
  assert.equal(s.due(at(9, 30)).length, 1);  // first slot
  assert.equal(s.due(at(9, 31)).length, 0);
  assert.equal(s.due(at(11, 54)).length, 0);
  assert.equal(s.due(at(11, 55)).length, 1); // second slot
  assert.equal(s.due(at(11, 56)).length, 0);
});

test('"days" filters by weekday (0 = Sunday)', () => {
  const { s } = setup([{ id: 'a', text: 'x', at: '09:30', days: [1] }]); // Monday only
  assert.equal(s.due(at(9, 30)).length, 0); // Wednesday
  assert.equal(s.due(at(9, 30, 12)).length, 1); // Monday 12 Oct
});

test('"everyMinutes" uses app start as baseline and repeats', () => {
  const { s } = setup([{ id: 'w', text: 'x', everyMinutes: 60 }], at(9, 0));
  assert.equal(s.due(at(9, 59)).length, 0);
  assert.equal(s.due(at(10, 0)).length, 1);
  assert.equal(s.due(at(10, 30)).length, 0);
  assert.equal(s.due(at(11, 0)).length, 1);
});

test('"between" suppresses interval reminders outside the window', () => {
  const { s } = setup([{ id: 'w', text: 'x', everyMinutes: 30, between: ['09:00', '18:00'] }], at(7, 0));
  assert.equal(s.due(at(8, 0)).length, 0);
  assert.equal(s.due(at(9, 0)).length, 1);
});

test('"once" fires a single time', () => {
  const { s } = setup([{ id: 'o', text: 'x', once: at(10, 0).toISOString() }]);
  assert.equal(s.due(at(9, 59)).length, 0);
  assert.equal(s.due(at(10, 1)).length, 1);
  assert.equal(s.due(at(10, 2)).length, 0);
});

test('snooze re-fires after SNOOZE_MS', () => {
  const { s } = setup([]);
  s.snooze({ id: 'a', text: 'x' }, at(9, 0));
  assert.equal(s.due(new Date(at(9, 0).getTime() + SNOOZE_MS - 1000)).length, 0);
  assert.equal(s.due(new Date(at(9, 0).getTime() + SNOOZE_MS)).length, 1);
  assert.equal(s.due(new Date(at(9, 0).getTime() + SNOOZE_MS + 1000)).length, 0);
});

test('state survives a restart (no duplicate fire)', () => {
  const { s, remindersPath, statePath } = setup([{ id: 'a', text: 'x', at: '09:30' }]);
  assert.equal(s.due(at(9, 30)).length, 1);
  const s2 = new Scheduler({ remindersPath, statePath, startedAt: at(9, 40) });
  assert.equal(s2.due(at(9, 41)).length, 0);
});

test('invalid JSON and invalid entries are ignored, not thrown', () => {
  assert.deepEqual(setup('{ not json').s.due(at(9, 30)), []);
  assert.deepEqual(setup([{ id: 1 }, null, { text: 'no id' }]).s.due(at(9, 30)), []);
});

test('disabled reminders never fire; edits apply without restart', () => {
  const { s, remindersPath } = setup([{ id: 'a', text: 'x', at: '09:30', enabled: false }]);
  assert.equal(s.due(at(9, 30)).length, 0);
  fs.writeFileSync(remindersPath, JSON.stringify([{ id: 'a', text: 'x', at: '09:30' }]));
  assert.equal(s.due(at(9, 31)).length, 1);
});
