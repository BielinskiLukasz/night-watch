// tests/integration/manual-entry.test.js
// Plan 01-04 / Task 1 — dedicated integration suite for the manual-entry surface
// of the event-log store: addEventAt (LOG-05 back-fill), editEvent (D-03
// mutate-in-place; Pitfall #6 the canonical regression guard), and deleteEvent
// (LOG-06). 5-minute rounding (LOG-07) is exercised on every write path.
//
// Source: 01-RESEARCH.md §Pattern 5 (store body), §Common Pitfalls #6
// (edit-creates-duplicate — write the integration test FIRST), 01-PLAN.md
// Task 1 <behavior>.
//
// This file is the focused regression guard for the new methods. The shared
// event-log.test.js also asserts a subset for cross-file visibility, but this
// file is the one to look at when LOG-05 / LOG-06 / Pitfall #6 break.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';
import { validate } from '../../js/ui/manual-entry.js';

function makeTestLog({
  frozenAt = new Date(2026, 4, 26, 6, 35),
} = {}) {
  const storage = createStorageMemory();
  const clock = createClockFixed(frozenAt);
  let nextId = 1;
  const id = () => `e${nextId++}`;
  const log = createEventLog({ storage, clock, id });
  return { log, storage, clock };
}

describe('manual-entry: addEventAt (LOG-05)', () => {
  test('addEventAt("wake", "2026-05-25T06:33") persists with at "2026-05-25T06:35" (LOG-07 round-to-nearest applied to typed input)', () => {
    const { log, storage } = makeTestLog();
    const evt = log.addEventAt('wake', '2026-05-25T06:33');

    assert.equal(evt.type, 'wake');
    assert.equal(evt.at, '2026-05-25T06:35');
    assert.deepEqual(storage._snapshot(), {
      version: 2,
      settings: { ...DEFAULT_SETTINGS },
      events: [{ id: 'e1', type: 'wake', at: '2026-05-25T06:35' }],
    });
  });

  test('addEventAt throws /Invalid event type/ on bad type (T-01 reused)', () => {
    const { log } = makeTestLog();
    assert.throws(
      () => log.addEventAt('snore', '2026-05-25T06:35'),
      /Invalid event type/,
    );
  });

  test('addEventAt throws on malformed at-string "2026/05/25T06:35" (T-02 via parseLocalISO)', () => {
    const { log } = makeTestLog();
    assert.throws(
      () => log.addEventAt('wake', '2026/05/25T06:35'),
      /Invalid local ISO timestamp/,
    );
  });

  test('addEventAt accepts a past date (LOG-05 back-fill — any past day)', () => {
    const { log } = makeTestLog({
      frozenAt: new Date(2026, 4, 26, 6, 35),
    });
    const evt = log.addEventAt('napStart', '2026-01-15T13:20');
    assert.equal(evt.at, '2026-01-15T13:20');
    assert.equal(log.listEvents().length, 1);
  });
});

describe('manual-entry: editEvent (D-03 mutate-in-place; Pitfall #6 the canonical regression guard)', () => {
  test('editEvent mutates in place — events.length unchanged after edit (Pitfall #6 / T-05)', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    log.editEvent(evt.id, { at: '2026-05-26T07:00' });
    // Pitfall #6 the canonical assertion — duplicate would push length to 2.
    assert.equal(log.listEvents().length, 1, 'editEvent must not create a duplicate (Pitfall #6 / T-05)');
    assert.equal(log.listEvents()[0].at, '2026-05-26T07:00');
  });

  test('editEvent re-rounds at on save (typed 06:33 saves as 06:35; LOG-07)', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    const edited = log.editEvent(evt.id, { at: '2026-05-26T06:33' });
    assert.equal(edited.at, '2026-05-26T06:35');
  });

  test('editEvent rejects invalid type (T-01)', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    assert.throws(
      () => log.editEvent(evt.id, { type: 'snore' }),
      /Invalid event type/,
    );
  });

  test('editEvent throws /not found/ when id absent', () => {
    const { log } = makeTestLog();
    assert.throws(
      () => log.editEvent('no-such-id', { at: '2026-05-26T07:00' }),
      /not found/i,
    );
  });

  test('editEvent preserves id (mutate-in-place per D-03 — same id on same index)', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    const edited = log.editEvent(evt.id, { at: '2026-05-26T07:00' });
    assert.equal(edited.id, evt.id);
  });
});

describe('manual-entry: deleteEvent (LOG-06)', () => {
  test('deleteEvent removes the event from listEvents', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    assert.equal(log.listEvents().length, 1);
    assert.equal(log.deleteEvent(evt.id), true);
    assert.equal(log.listEvents().length, 0);
  });

  test('deleteEvent returns false when id absent (idempotent)', () => {
    const { log } = makeTestLog();
    log.addEvent('wake');
    assert.equal(log.deleteEvent('no-such-id'), false);
    assert.equal(log.listEvents().length, 1, 'no side effect on bogus id');
  });

  test('deleteEvent persists — after a fresh createEventLog over the same storage, the deleted event is gone (D-05 invariant)', () => {
    const { log, storage } = makeTestLog();
    const evt = log.addEvent('wake');
    log.deleteEvent(evt.id);

    const log2 = createEventLog({
      storage,
      clock: createClockFixed(new Date(2026, 4, 26, 7, 0)),
      id: () => 'unused',
    });
    assert.equal(log2.listEvents().length, 0, 'deletion is persisted byte-for-byte (D-05)');
  });
});

// -----------------------------------------------------------------------------
// Plan 01-07 / Task 1 — gap-closure: pure validate() with future-date guard
// + structured errors. UAT gap 2 (major: future-date acceptance) and UAT
// gap 3 (major: silent validation failures) both root-cause to the onClose
// validator in js/ui/manual-entry.js. The refactor exposes a pure
// validate(input, { now }) so this integration test can pin the contract
// without DOM access — the clock-adapter seam (D-07) is honored by passing
// `now` as a function returning the current at-string.
// -----------------------------------------------------------------------------

describe('validate() — gap-closure 01-07 (UAT gaps 2, 3)', () => {
  const fixedNow = '2026-06-15T12:00';
  const now = () => fixedNow;

  test('validate() returns {ok:true, atString} for a valid past entry', () => {
    const result = validate(
      { date: '2026-06-14', hourStr: '22', minuteStr: '30', type: 'napStart' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-06-14T22:30');
    assert.equal(result.type, 'napStart');
  });

  test('validate() rejects a future at-string with a date-field error mentioning "future"', () => {
    const result = validate(
      { date: '2026-06-16', hourStr: '09', minuteStr: '00', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, false);
    assert.ok(Array.isArray(result.errors));
    const dateErr = result.errors.find((e) => e.field === 'date');
    assert.ok(dateErr, 'expected an errors entry with field:"date"');
    assert.match(dateErr.message, /future/i);
  });

  test('validate() rejects today + future-time as a future event', () => {
    const result = validate(
      { date: '2026-06-15', hourStr: '15', minuteStr: '00', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, false);
    const dateErr = result.errors.find((e) => e.field === 'date');
    assert.ok(dateErr, 'expected an errors entry with field:"date"');
    assert.match(dateErr.message, /future/i);
  });

  test('validate() rejects hour=25 with a field:"hour" error mentioning "0..23"', () => {
    const result = validate(
      { date: '2026-06-14', hourStr: '25', minuteStr: '30', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, false);
    const hourErr = result.errors.find((e) => e.field === 'hour');
    assert.ok(hourErr, 'expected an errors entry with field:"hour"');
    assert.match(hourErr.message, /0.+23/);
  });

  test('validate() rejects minute=600 with a field:"minute" error mentioning "0..59"', () => {
    const result = validate(
      { date: '2026-06-14', hourStr: '10', minuteStr: '600', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, false);
    const minuteErr = result.errors.find((e) => e.field === 'minute');
    assert.ok(minuteErr, 'expected an errors entry with field:"minute"');
    assert.match(minuteErr.message, /0.+59/);
  });

  test('validate() rejects empty date with a field:"date" required error', () => {
    const result = validate(
      { date: '', hourStr: '10', minuteStr: '00', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, false);
    const dateErr = result.errors.find((e) => e.field === 'date');
    assert.ok(dateErr, 'expected an errors entry with field:"date"');
    assert.match(dateErr.message, /required/i);
  });

  test('validate() collects multiple errors at once (empty type + minute=99)', () => {
    const result = validate(
      { date: '2026-06-14', hourStr: '10', minuteStr: '99', type: '' },
      { now },
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.length >= 2, `expected ≥2 errors, got ${result.errors.length}`);
    assert.ok(result.errors.some((e) => e.field === 'type'), 'expected a field:"type" error');
    assert.ok(result.errors.some((e) => e.field === 'minute'), 'expected a field:"minute" error');
  });

  test('validate() preserves LOG-07 silent rounding for in-range non-5 minutes (23 → 25)', () => {
    const result = validate(
      { date: '2026-06-14', hourStr: '22', minuteStr: '23', type: 'napStart' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-06-14T22:25', 'in-range non-5 minutes round silently per LOG-07');
  });
});

// -----------------------------------------------------------------------------
// Post-smoke fix-up to Plan 01-07: the original guard rejected minutes 56-59
// as out-of-range. Manual smoke (2026-05-27) reported the regression — users
// can read 56/57/58/59 off any clock and the silent-rounding LOG-07 contract
// should fold those into the 5-min grid (56,57 → :55; 58,59 → next hour :00;
// 23:58 → next day 00:00 — the time.js roundTo5 contract).
// -----------------------------------------------------------------------------

describe('validate() — LOG-07 minute carry (post-smoke fix-up)', () => {
  // Anchored well in the past so the future-date guard never fires on these
  // carry-edge inputs (the carry behavior is independent of "now").
  const now = () => '2099-01-01T00:00';

  test('minute=56 rounds down to :55 (closer to 55 than to 60)', () => {
    const result = validate(
      { date: '2026-05-27', hourStr: '14', minuteStr: '56', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-05-27T14:55');
  });

  test('minute=57 rounds down to :55 (still closer to 55 than to 60)', () => {
    const result = validate(
      { date: '2026-05-27', hourStr: '14', minuteStr: '57', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-05-27T14:55');
  });

  test('minute=58 carries to the next hour :00 (closer to 60 than to 55)', () => {
    const result = validate(
      { date: '2026-05-27', hourStr: '14', minuteStr: '58', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-05-27T15:00');
  });

  test('minute=59 carries to the next hour :00', () => {
    const result = validate(
      { date: '2026-05-27', hourStr: '14', minuteStr: '59', type: 'wake' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-05-27T15:00');
  });

  test('23:58 on 2026-05-27 carries to next day 00:00 (2026-05-28T00:00)', () => {
    const result = validate(
      { date: '2026-05-27', hourStr: '23', minuteStr: '58', type: 'bedtime' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-05-28T00:00');
  });

  test('23:58 on the last day of a month carries to next month (2026-05-31T23:58 → 2026-06-01T00:00)', () => {
    const result = validate(
      { date: '2026-05-31', hourStr: '23', minuteStr: '58', type: 'bedtime' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2026-06-01T00:00');
  });

  test('23:58 on Dec 31 carries to next year (2026-12-31T23:58 → 2027-01-01T00:00)', () => {
    const result = validate(
      { date: '2026-12-31', hourStr: '23', minuteStr: '58', type: 'bedtime' },
      { now },
    );
    assert.equal(result.ok, true);
    assert.equal(result.atString, '2027-01-01T00:00');
  });
});
