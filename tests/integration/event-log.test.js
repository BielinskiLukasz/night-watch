// tests/integration/event-log.test.js
// Source: RESEARCH §Code Examples §Integration test example + 01-PLAN.md §Task 2 <behavior>
// Plan 03 §Task 1 extends this file with:
//   - All four valid types round-trip (LOG-02, LOG-03, LOG-04)
//   - Full T-01 rejection coverage (5 invalid inputs)
//   - daysByCalendar delegation + limit + newest-first ordering (D-08, D-10, D-15)
//
// Walking-skeleton composition: store + storage-memory + clock-fixed.
// Verifies D-01 event shape, D-04 canonical JSON, D-05 rehydration invariant,
// T-01 mitigation (VALID_TYPES guard on addEvent).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';

function makeTestLog({
  // 2026-05-26 06:35 local (already on a 5-min boundary so the test is
  // independent of the round-to-nearest vs floor choice — Plan 02 expands
  // the rounding edge-case table).
  frozenAt = new Date(2026, 4, 26, 6, 35),
} = {}) {
  const storage = createStorageMemory();
  const clock = createClockFixed(frozenAt);
  let nextId = 1;
  const id = () => `e${nextId++}`;
  const log = createEventLog({ storage, clock, id });
  return { log, storage, clock };
}

describe('event-log: addEvent', () => {
  test('addEvent("wake") at fixed clock 2026-05-26T06:35 persists shape { id, type: "wake", at: "2026-05-26T06:35" }', () => {
    const { log, storage } = makeTestLog();
    const evt = log.addEvent('wake');

    assert.equal(evt.type, 'wake');
    assert.equal(evt.at, '2026-05-26T06:35');
    assert.equal(typeof evt.id, 'string');
    assert.ok(evt.id.length > 0, 'id should be non-empty string');

    // D-04 canonical JSON shape persisted byte-for-byte (D-05 invariant)
    assert.deepEqual(storage._snapshot(), {
      version: 1,
      events: [{ id: 'e1', type: 'wake', at: '2026-05-26T06:35' }],
    });
  });

  test('rejects invalid type with TypeError matching /Invalid event type/', () => {
    const { log } = makeTestLog();
    assert.throws(
      () => log.addEvent('snore'),
      /Invalid event type/,
      'addEvent should reject unknown type strings (T-01 mitigation; V5)',
    );
  });
});

describe('event-log: all four valid types round-trip (Plan 03 / LOG-02, LOG-03, LOG-04)', () => {
  test('addEvent("bedtime") persists with type "bedtime" (LOG-02)', () => {
    const { log, storage } = makeTestLog({
      // 2026-05-26 22:10 — a typical bedtime, already on a 5-min boundary.
      frozenAt: new Date(2026, 4, 26, 22, 10),
    });
    const evt = log.addEvent('bedtime');

    assert.equal(evt.type, 'bedtime');
    assert.equal(evt.at, '2026-05-26T22:10');
    assert.equal(typeof evt.id, 'string');
    assert.deepEqual(storage._snapshot(), {
      version: 1,
      events: [{ id: 'e1', type: 'bedtime', at: '2026-05-26T22:10' }],
    });
  });

  test('addEvent("napStart") persists with type "napStart" (LOG-03)', () => {
    const { log, storage } = makeTestLog({
      frozenAt: new Date(2026, 4, 26, 13, 20),
    });
    const evt = log.addEvent('napStart');

    assert.equal(evt.type, 'napStart');
    assert.equal(evt.at, '2026-05-26T13:20');
    assert.deepEqual(storage._snapshot(), {
      version: 1,
      events: [{ id: 'e1', type: 'napStart', at: '2026-05-26T13:20' }],
    });
  });

  test('addEvent("napEnd") persists with type "napEnd" (LOG-04)', () => {
    const { log, storage } = makeTestLog({
      frozenAt: new Date(2026, 4, 26, 14, 5),
    });
    const evt = log.addEvent('napEnd');

    assert.equal(evt.type, 'napEnd');
    assert.equal(evt.at, '2026-05-26T14:05');
    assert.deepEqual(storage._snapshot(), {
      version: 1,
      events: [{ id: 'e1', type: 'napEnd', at: '2026-05-26T14:05' }],
    });
  });
});

describe('event-log: addEvent rejects invalid types (T-01 full coverage)', () => {
  test('rejects "snore" (unknown type string)', () => {
    const { log } = makeTestLog();
    assert.throws(() => log.addEvent('snore'), /Invalid event type/);
  });

  test('rejects "" (empty string)', () => {
    const { log } = makeTestLog();
    assert.throws(() => log.addEvent(''), /Invalid event type/);
  });

  test('rejects null', () => {
    const { log } = makeTestLog();
    assert.throws(() => log.addEvent(null), /Invalid event type/);
  });

  test('rejects undefined', () => {
    const { log } = makeTestLog();
    assert.throws(() => log.addEvent(undefined), /Invalid event type/);
  });

  test('rejects "WAKE" (case-sensitive — VALID_TYPES contains "wake" only)', () => {
    const { log } = makeTestLog();
    assert.throws(() => log.addEvent('WAKE'), /Invalid event type/);
  });
});

describe('event-log: daysByCalendar passthrough (Plan 03 / D-08, D-10, D-15)', () => {
  test('log.daysByCalendar() returns an array of day records', () => {
    const { log } = makeTestLog();
    log.addEvent('wake');
    const days = log.daysByCalendar();
    assert.ok(Array.isArray(days), 'daysByCalendar must return an array');
    assert.equal(days.length, 1);
    assert.equal(days[0].date, '2026-05-26');
    assert.equal(days[0].wake.type, 'wake');
  });

  test('log.daysByCalendar(3) returns at most 3 day records (limit propagates)', () => {
    const { log, clock } = makeTestLog({
      frozenAt: new Date(2026, 4, 20, 6, 35),
    });
    // Add 5 wake events on 5 distinct calendar dates.
    for (let d = 20; d <= 24; d++) {
      clock.set(new Date(2026, 4, d, 6, 35));
      log.addEvent('wake');
    }
    const days = log.daysByCalendar(3);
    assert.equal(days.length, 3, 'limit=3 must yield exactly 3 day records');
  });

  test('after events on three calendar dates, daysByCalendar(2) returns the 2 NEWEST (ordering preserved across the seam)', () => {
    const { log, clock } = makeTestLog({
      frozenAt: new Date(2026, 4, 24, 6, 35),
    });
    clock.set(new Date(2026, 4, 24, 6, 35));
    log.addEvent('wake');
    clock.set(new Date(2026, 4, 25, 6, 35));
    log.addEvent('wake');
    clock.set(new Date(2026, 4, 26, 6, 35));
    log.addEvent('wake');

    const days = log.daysByCalendar(2);
    assert.equal(days.length, 2);
    assert.equal(days[0].date, '2026-05-26', 'newest first');
    assert.equal(days[1].date, '2026-05-25', 'second newest');
  });

  test('log.daysBySubjectiveNight(4) is also exposed and delegates correctly', () => {
    const { log, clock } = makeTestLog({
      frozenAt: new Date(2026, 4, 26, 3, 50),
    });
    log.addEvent('wake'); // 03:50 with cutover=4 → previous day 2026-05-25
    const nights = log.daysBySubjectiveNight(4);
    assert.equal(nights.length, 1);
    assert.equal(nights[0].date, '2026-05-25');
  });
});

describe('event-log: persistence / rehydration (D-05 invariant)', () => {
  test('a fresh createEventLog over the SAME storage reads the same event back', () => {
    const { log, storage } = makeTestLog();
    log.addEvent('wake');

    // Simulate reload: construct a brand-new event log over the SAME storage.
    const log2 = createEventLog({
      storage,
      clock: createClockFixed(new Date(2026, 4, 26, 7, 0)),
      id: () => 'unused',
    });

    const events = log2.listEvents();
    assert.equal(events.length, 1, 'rehydrated log should expose persisted event');
    assert.equal(events[0].type, 'wake');
    assert.equal(events[0].at, '2026-05-26T06:35');
  });
});

// =====================================================================
// Plan 01-04 / Task 1 — addEventAt / editEvent / deleteEvent surface.
// LOG-05 (manual entry / edit), LOG-06 (delete), LOG-07 (5-min rounding
// preserved on every write path), Pitfall #6 (edit-creates-duplicate
// regression guard via assert.equal(events.length, 1)).
// =====================================================================

describe('event-log: addEventAt (LOG-05 manual entry / back-fill)', () => {
  test('addEventAt("wake", "2026-05-25T06:35") persists with at "2026-05-25T06:35" (already-rounded passthrough)', () => {
    const { log, storage } = makeTestLog();
    const evt = log.addEventAt('wake', '2026-05-25T06:35');

    assert.equal(evt.type, 'wake');
    assert.equal(evt.at, '2026-05-25T06:35');
    assert.equal(typeof evt.id, 'string');
    assert.deepEqual(storage._snapshot(), {
      version: 1,
      events: [{ id: 'e1', type: 'wake', at: '2026-05-25T06:35' }],
    });
  });

  test('addEventAt re-rounds non-5-minute inputs (typed 06:33 → stored 06:35; LOG-07)', () => {
    const { log } = makeTestLog();
    const evt = log.addEventAt('wake', '2026-05-25T06:33');
    assert.equal(evt.at, '2026-05-25T06:35', 'round-to-nearest 5min applied on manual entry');
  });

  test('addEventAt accepts a past date (LOG-05 back-fill)', () => {
    const { log } = makeTestLog({
      frozenAt: new Date(2026, 4, 26, 6, 35),
    });
    const evt = log.addEventAt('bedtime', '2026-04-01T22:10');
    assert.equal(evt.at, '2026-04-01T22:10', 'past-day back-fill stored verbatim after rounding');
  });

  test('addEventAt rejects invalid type with /Invalid event type/ (T-01 reused)', () => {
    const { log } = makeTestLog();
    assert.throws(
      () => log.addEventAt('snore', '2026-05-25T06:35'),
      /Invalid event type/,
    );
  });

  test('addEventAt rejects malformed at-string "2026/05/25T06:35" (T-02 via parseLocalISO)', () => {
    const { log } = makeTestLog();
    assert.throws(
      () => log.addEventAt('wake', '2026/05/25T06:35'),
      /Invalid local ISO timestamp/,
      'parseLocalISO regex rejects wrong separator (T-02)',
    );
  });
});

describe('event-log: editEvent (D-03 mutate-in-place; Pitfall #6 regression guard)', () => {
  test('editEvent mutates in place — events.length unchanged after edit (Pitfall #6)', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    log.editEvent(evt.id, { at: '2026-05-26T07:00' });
    // The canonical Pitfall #6 assertion — events.length stays at 1, no duplicate.
    assert.equal(log.listEvents().length, 1, 'editEvent must not create a duplicate (Pitfall #6)');
    assert.equal(log.listEvents()[0].at, '2026-05-26T07:00');
  });

  test('editEvent re-rounds at on save (typed 06:33 saves as 06:35; LOG-07)', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    const edited = log.editEvent(evt.id, { at: '2026-05-26T06:33' });
    assert.equal(edited.at, '2026-05-26T06:35', 'edit re-rounds at to nearest 5 min');
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

  test('editEvent preserves id', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    const edited = log.editEvent(evt.id, { at: '2026-05-26T07:00' });
    assert.equal(edited.id, evt.id, 'id is preserved across edit');
  });
});

describe('event-log: deleteEvent (LOG-06)', () => {
  test('deleteEvent removes the event from listEvents', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    assert.equal(log.listEvents().length, 1);
    const result = log.deleteEvent(evt.id);
    assert.equal(result, true, 'deleteEvent returns true on success');
    assert.equal(log.listEvents().length, 0);
  });

  test('deleteEvent returns false when id absent (idempotent)', () => {
    const { log } = makeTestLog();
    log.addEvent('wake');
    const result = log.deleteEvent('no-such-id');
    assert.equal(result, false, 'deleteEvent returns false when id absent (idempotent)');
    assert.equal(log.listEvents().length, 1, 'no side effect when id absent');
  });

  test('deleteEvent persists — a fresh createEventLog over the same storage does not see the deleted event (D-05 invariant)', () => {
    const { log, storage } = makeTestLog();
    const evt = log.addEvent('wake');
    log.deleteEvent(evt.id);

    // Simulate reload over the SAME storage.
    const log2 = createEventLog({
      storage,
      clock: createClockFixed(new Date(2026, 4, 26, 7, 0)),
      id: () => 'unused',
    });
    assert.equal(log2.listEvents().length, 0, 'deletion survives rehydration (D-05)');
  });
});
