// tests/integration/import-export-flow.test.js
// TDD RED → GREEN tests for the store replace() API (Phase 5, Plan 02).
//
// Tests the event-log and settings-store replace(blob) method that atomically
// swaps in-memory state, persists, and fires all registered subscribers.
// Enables the import handler in Waves 2–3 to call replace() without losing
// existing subscriber registrations (Pattern A from RESEARCH.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createSettingsStore } from '../../js/store/settings.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';

// ---------------------------------------------------------------------------
// Minimal test fixtures
// ---------------------------------------------------------------------------

function makeStorage() {
  let stored = null;
  return {
    load: () => stored,
    save: (db) => { stored = db; },
  };
}

const clock = { now: () => new Date('2026-06-28T08:00:00') };

function makeId() {
  let n = 0;
  return () => `evt-${++n}`;
}

const v2Blob = Object.freeze({
  version: 2,
  settings: {
    subjectName: 'Test',
    cutoverHour: 4,
    groupingMode: 'calendar',
    rejectedDays: ['2026-06-01'],
    timeFormat: '24h',
    autoOutlier: false,
    maxDelta: 30,
    minDays: 7,
    windowDays: 7,
    statBlend: 'median',
  },
  events: [{ id: 'e1', type: 'wake', at: '2026-06-28T07:00' }],
  activityLog: { '2026-06-28': 3.5 },
});

const v1Blob = Object.freeze({
  version: 1,
  events: [{ id: 'e2', type: 'bedtime', at: '2026-06-27T22:00' }],
});

// ---------------------------------------------------------------------------
// eventLog.replace() tests
// ---------------------------------------------------------------------------

describe('eventLog.replace()', () => {

  it('replace(v2Blob) → listEvents() returns the blob\'s events; subscriber called once', () => {
    const storage = makeStorage();
    const id = makeId();
    const eventLog = createEventLog({ storage, clock, id });
    let callCount = 0;
    eventLog.subscribe(() => { callCount++; });

    eventLog.replace({ ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } });

    const events = eventLog.listEvents();
    assert.equal(events.length, 1, 'must have 1 event from the blob');
    assert.equal(events[0].id, 'e1', 'event id must match blob');
    assert.equal(events[0].type, 'wake', 'event type must match blob');
    assert.equal(callCount, 1, 'subscriber must be called exactly once');
  });

  it('replace(v1Blob) → migrates to v2 internally; listEvents() returns the v1 events; no throw', () => {
    const storage = makeStorage();
    const id = makeId();
    const eventLog = createEventLog({ storage, clock, id });

    assert.doesNotThrow(() => {
      eventLog.replace({ ...v1Blob, events: [...v1Blob.events] });
    });

    const events = eventLog.listEvents();
    assert.equal(events.length, 1, 'must have 1 event from v1 blob');
    assert.equal(events[0].id, 'e2', 'v1 event id must be preserved');
  });

  it('replace({ version: 3 }) → throws Error mentioning unsupported version', () => {
    const storage = makeStorage();
    const id = makeId();
    const eventLog = createEventLog({ storage, clock, id });

    assert.throws(
      () => eventLog.replace({ version: 3 }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.toLowerCase().includes('unsupported') || err.message.includes('3'),
          `Error message must mention unsupported version or "3", got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it('after replace(), a subsequent addEvent() persists correctly (no state corruption)', () => {
    const storage = makeStorage();
    const id = makeId();
    const eventLog = createEventLog({ storage, clock, id });

    eventLog.replace({ ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } });
    eventLog.addEvent('bedtime');

    const events = eventLog.listEvents();
    assert.equal(events.length, 2, 'must have imported event + new event');
    assert.equal(events[1].type, 'bedtime', 'new event must be bedtime');
  });

});

// ---------------------------------------------------------------------------
// settings.replace() tests
// ---------------------------------------------------------------------------

describe('settings.replace()', () => {

  it('replace(v2Blob) → settings.get() returns normalized settings from blob; subscriber called once', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });
    let callCount = 0;
    settingsStore.subscribe(() => { callCount++; });

    settingsStore.replace({ ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } });

    const s = settingsStore.get();
    assert.equal(s.subjectName, 'Test', 'subjectName must come from blob');
    assert.equal(s.cutoverHour, 4, 'cutoverHour must come from blob');
    assert.deepEqual(s.rejectedDays, ['2026-06-01'], 'rejectedDays must come from blob');
    assert.equal(callCount, 1, 'subscriber must be called exactly once');
  });

  it('after settings.replace(), a subsequent settings.update() persists correctly', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    settingsStore.replace({ ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } });
    settingsStore.update({ subjectName: 'Updated' });

    assert.equal(settingsStore.get().subjectName, 'Updated', 'update() must work after replace()');
  });

});

// ---------------------------------------------------------------------------
// Cross-store: eventLog.replace() then settings.replace() with same blob
// ---------------------------------------------------------------------------

describe('cross-store replace()', () => {

  it('eventLog.replace() then settings.replace() → both subscribers fired; storage consistent', () => {
    const storage = makeStorage();
    const id = makeId();
    const eventLog = createEventLog({ storage, clock, id });
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    let eventLogCalls = 0;
    let settingsCalls = 0;
    eventLog.subscribe(() => { eventLogCalls++; });
    settingsStore.subscribe(() => { settingsCalls++; });

    const blob = { ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } };
    eventLog.replace(blob);
    settingsStore.replace(blob);

    assert.equal(eventLogCalls, 1, 'eventLog subscriber must fire once');
    assert.equal(settingsCalls, 1, 'settings subscriber must fire once');

    // Storage must carry the fully replaced state
    const persisted = storage.load();
    assert.ok(persisted, 'storage must have persisted state');
    assert.equal(persisted.version, 2, 'persisted version must be 2');
  });

});
