// tests/integration/event-log.test.js
// Source: RESEARCH §Code Examples §Integration test example + 01-PLAN.md §Task 2 <behavior>
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
