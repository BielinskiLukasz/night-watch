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
      version: 1,
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
