// tests/integration/persistence.test.js
//
// Regression-guard tests for the architectural invariants Plans 01-04 established:
//   - D-04 canonical JSON shape `{ version: 1, events: [...] }`
//   - D-05 localStorage byte-for-byte === canonical JSON (load-bearing invariant
//     for Phase 5 import/export round-trip)
//   - T-03 corrupted-blob graceful handling (storage-local.load returns null
//     and emits console.warn instead of throwing)
//   - T-04 / Pitfall #4 QuotaExceededError translation (Phase 1 acceptable
//     behavior is loud failure with a friendly user-surfaceable message)
//   - Schema-version forward-compat guard (createEventLog throws on version > 1)
//
// Plan 01-05 Task 1 — see .planning/phases/NW-01-log-persist/01-05-PLAN.md
//
// Testability seam used here:
//   - createStorageLocal(key, ls) accepts an optional `ls` argument (added in
//     Plan 01-05 for exactly this test file). Production code in js/app.js
//     still calls the single-arg form. Tests inject a fake `ls` object so
//     T-03 and T-04 paths are observable without polluting globalThis.

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

import { createStorageLocal } from '../../js/adapters/storage-local.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { createEventLog } from '../../js/store/event-log.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';

// -------------------- helpers --------------------

// Deterministic id minter — keeps test fixtures stable across runs.
function makeCounterId() {
  let n = 0;
  return () => `e${++n}`;
}

// Minimal localStorage-like fake. Backing store is a plain object so tests can
// inspect it directly. setItem is synchronous, mirrors the real API.
function makeFakeLS(initial = {}) {
  const store = { ...initial };
  return {
    _store: store,
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k, v) {
      store[k] = String(v);
    },
  };
}

// -------------------- D-04 / D-05 round-trip --------------------

describe('round-trip lossiness (D-04 + D-05 canonical JSON contract)', () => {
  test('JSON.parse(JSON.stringify(db)) deep-equals db for a populated event log (10 events / 3 days)', () => {
    // Build a populated log via addEventAt across 3 calendar dates.
    const storage = createStorageMemory();
    const clock = createClockFixed(new Date(2026, 4, 25, 6, 35)); // unused here
    const log = createEventLog({ storage, clock, id: makeCounterId() });

    const fixtures = [
      ['wake',     '2026-05-25T06:35'],
      ['napStart', '2026-05-25T13:20'],
      ['napEnd',   '2026-05-25T14:05'],
      ['bedtime',  '2026-05-25T22:10'],
      ['wake',     '2026-05-26T06:40'],
      ['napStart', '2026-05-26T13:15'],
      ['napEnd',   '2026-05-26T14:00'],
      ['bedtime',  '2026-05-26T22:20'],
      ['wake',     '2026-05-27T06:30'],
      ['bedtime',  '2026-05-27T22:00'],
    ];
    for (const [type, at] of fixtures) log.addEventAt(type, at);

    const blob = storage._snapshot();
    const roundTripped = JSON.parse(JSON.stringify(blob));
    assert.deepEqual(roundTripped, blob, 'JSON round-trip must be lossless');
    // Plan 02-03: canonical shape is now v2 with settings slice (D-04 / D2-04).
    assert.equal(blob.version, 2, 'D2-04: top-level version is 2');
    assert.deepEqual(blob.settings, { ...DEFAULT_SETTINGS }, 'default settings injected on first save');
    assert.equal(blob.events.length, 10, 'all 10 events persisted');
  });

  test('storage-memory snapshot after mutations equals { version: 2, settings, events } shape (D-04 / D2-04)', () => {
    const storage = createStorageMemory();
    const clock = createClockFixed(new Date(2026, 4, 25, 6, 35));
    const log = createEventLog({ storage, clock, id: makeCounterId() });

    log.addEventAt('wake', '2026-05-25T06:35');
    log.addEventAt('bedtime', '2026-05-25T22:10');

    const blob = storage._snapshot();
    assert.deepEqual(Object.keys(blob).sort(), ['events', 'settings', 'version']);
    assert.equal(blob.version, 2);
    assert.deepEqual(blob.settings, { ...DEFAULT_SETTINGS });
    assert.ok(Array.isArray(blob.events));
    for (const evt of blob.events) {
      assert.deepEqual(Object.keys(evt).sort(), ['at', 'id', 'type']);
    }
  });

  test('after fresh createEventLog reads from the same storage, every method returns identical output (D-05 invariant)', () => {
    // Round 1: populate.
    const storage = createStorageMemory();
    const clock = createClockFixed(new Date(2026, 4, 25, 6, 35));
    const log1 = createEventLog({ storage, clock, id: makeCounterId() });

    log1.addEventAt('wake',     '2026-05-25T06:35');
    log1.addEventAt('napStart', '2026-05-25T13:20');
    log1.addEventAt('napEnd',   '2026-05-25T14:05');
    log1.addEventAt('bedtime',  '2026-05-25T22:10');

    const before = {
      listEvents: log1.listEvents(),
      daysByCalendar: log1.daysByCalendar(),
      daysBySubjectiveNight: log1.daysBySubjectiveNight(4),
    };

    // Round 2: fresh log over the SAME storage (simulates page reload).
    const log2 = createEventLog({ storage, clock, id: makeCounterId() });
    const after = {
      listEvents: log2.listEvents(),
      daysByCalendar: log2.daysByCalendar(),
      daysBySubjectiveNight: log2.daysBySubjectiveNight(4),
    };

    assert.deepEqual(after.listEvents, before.listEvents, 'listEvents identical after reload');
    assert.deepEqual(after.daysByCalendar, before.daysByCalendar, 'daysByCalendar identical after reload');
    assert.deepEqual(after.daysBySubjectiveNight, before.daysBySubjectiveNight, 'daysBySubjectiveNight identical after reload');
  });
});

// -------------------- T-03 corrupted-blob handling --------------------

describe('corrupted-blob tolerance (T-03 mitigation in storage-local)', () => {
  test('createStorageLocal load() with non-JSON blob returns null AND calls console.warn', () => {
    // Pre-seed the fake localStorage with a deliberately invalid JSON string.
    const fakeLS = makeFakeLS({ 'nightwatch:db': '{ bad json }' });

    // mock.method returns a TestMock that auto-restores when the test exits;
    // captures calls in .calls for assertion.
    const warnMock = mock.method(console, 'warn', () => {});

    const storage = createStorageLocal('nightwatch:db', fakeLS);
    const result = storage.load();

    assert.equal(result, null, 'corrupted blob → null (graceful degradation)');
    assert.equal(warnMock.mock.callCount(), 1, 'console.warn called exactly once');
    const warnArgs = warnMock.mock.calls[0].arguments;
    assert.match(
      String(warnArgs[0]),
      /could not parse nightwatch:db/i,
      'warn message names the key being ignored',
    );

    warnMock.mock.restore();
  });

  test('createStorageLocal load() with a fresh adapter returns null when key absent (no warn)', () => {
    const fakeLS = makeFakeLS({});
    const warnMock = mock.method(console, 'warn', () => {});

    const storage = createStorageLocal('nightwatch:db', fakeLS);
    const result = storage.load();

    assert.equal(result, null, 'missing key → null (clean cold start)');
    assert.equal(warnMock.mock.callCount(), 0, 'console.warn NOT called for absent key (warn is for corruption only)');

    warnMock.mock.restore();
  });

  test('createEventLog over storage with a corrupted blob behaves as if empty (T-03 end-to-end)', () => {
    const fakeLS = makeFakeLS({ 'nightwatch:db': 'not-json-at-all' });
    const warnMock = mock.method(console, 'warn', () => {});

    const storage = createStorageLocal('nightwatch:db', fakeLS);
    const clock = createClockFixed(new Date(2026, 4, 25, 6, 35));
    const log = createEventLog({ storage, clock, id: makeCounterId() });

    assert.deepEqual(log.listEvents(), [], 'event log starts empty when blob is corrupted');
    // Adding a new event should now succeed and rewrite the blob cleanly.
    log.addEvent('wake');
    assert.equal(log.listEvents().length, 1, 'subsequent writes succeed');

    warnMock.mock.restore();
  });
});

// -------------------- T-04 / Pitfall #4 QuotaExceededError --------------------

describe('QuotaExceededError translation (Pitfall #4 / T-04 — Phase 1 loud failure)', () => {
  test('createStorageLocal save() throws translated "Storage full" Error on QuotaExceededError (name match)', () => {
    const fakeLS = {
      getItem() { return null; },
      setItem() {
        // Simulate the browser's DOMException — name-based detection.
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      },
    };
    const storage = createStorageLocal('nightwatch:db', fakeLS);

    assert.throws(
      () => storage.save({ version: 1, events: [] }),
      (err) => /Storage full/i.test(err.message),
      'QuotaExceededError must be translated into a user-surfaceable "Storage full" Error',
    );
  });

  test('createStorageLocal save() throws translated "Storage full" Error on QuotaExceededError (code 22 match)', () => {
    // Some older browsers used numeric code 22 with a generic name. The adapter
    // catches both — verify the code-based detection path too.
    const fakeLS = {
      getItem() { return null; },
      setItem() {
        const err = new Error('Quota exceeded');
        err.code = 22;
        throw err;
      },
    };
    const storage = createStorageLocal('nightwatch:db', fakeLS);

    assert.throws(
      () => storage.save({ version: 1, events: [] }),
      /Storage full/i,
      'numeric code 22 must also translate to "Storage full"',
    );
  });

  test('createStorageLocal save() re-throws unrelated errors unchanged (fail-loudly invariant)', () => {
    const fakeLS = {
      getItem() { return null; },
      setItem() {
        throw new TypeError('Something else went wrong');
      },
    };
    const storage = createStorageLocal('nightwatch:db', fakeLS);

    assert.throws(
      () => storage.save({ version: 1, events: [] }),
      (err) => err instanceof TypeError && /Something else/.test(err.message),
      'non-quota errors are re-thrown unchanged (Phase 1 anti-pattern: silent swallow)',
    );
  });
});

// -------------------- D-04 schema-version guard --------------------

describe('schema-version forward-compat guard (D-04)', () => {
  test('createEventLog over storage with version:99 throws /Unsupported schema version/', () => {
    const storage = createStorageMemory({ version: 99, events: [] });
    const clock = createClockFixed(new Date(2026, 4, 25, 6, 35));

    assert.throws(
      () => createEventLog({ storage, clock, id: makeCounterId() }),
      /Unsupported schema version/,
      'future-schema blobs must throw at load (Phase 5 import will need this guard)',
    );
  });

  test('createEventLog over storage with version:0 also throws (no silent downgrade)', () => {
    const storage = createStorageMemory({ version: 0, events: [] });
    const clock = createClockFixed(new Date(2026, 4, 25, 6, 35));

    assert.throws(
      () => createEventLog({ storage, clock, id: makeCounterId() }),
      /Unsupported schema version/,
    );
  });
});
