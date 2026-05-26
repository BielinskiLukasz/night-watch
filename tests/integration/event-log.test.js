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
