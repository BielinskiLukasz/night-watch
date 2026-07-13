// tests/integration/import-export-flow.test.js
// TDD RED → GREEN tests for the store replace() API (Phase 5, Plan 02).
//
// Tests the event-log and settings-store replace(blob) method that atomically
// swaps in-memory state, persists, and fires all registered subscribers.
// Enables the import handler in Waves 2–3 to call replace() without losing
// existing subscriber registrations (Pattern A from RESEARCH.md).

import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createSettingsStore } from '../../js/store/settings.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';
import { parseCSV } from '../../js/lib/csv-parse.js';

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

// ---------------------------------------------------------------------------
// settings.replace() — TIF field preservation
// ---------------------------------------------------------------------------

describe('settings.replace() — TIF settings', () => {

  const tifBlob = Object.freeze({
    version: 2,
    settings: {
      subjectName: 'TIF-Test',
      cutoverHour: 4,
      groupingMode: 'calendar',
      rejectedDays: [],
      timeFormat: '24h',
      autoOutlier: false,
      maxDelta: 30,
      minDays: 7,
      windowDays: 14,
      statBlend: 'median',
      forecastAlgorithm: 'tif',
      trimPct: 25,
      precisionTarget: 90,
    },
    events: [],
    activityLog: {},
  });

  it('replace() with TIF fields → settings.get() returns imported forecastAlgorithm/trimPct/precisionTarget', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    settingsStore.replace({ ...tifBlob });

    const s = settingsStore.get();
    assert.equal(s.forecastAlgorithm, 'tif', 'forecastAlgorithm must come from blob');
    assert.equal(s.trimPct, 25, 'trimPct must come from blob');
    assert.equal(s.precisionTarget, 90, 'precisionTarget must come from blob');
  });

  it('replace() with TIF fields → persisted storage blob contains the imported TIF values', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    settingsStore.replace({ ...tifBlob });

    const persisted = storage.load();
    assert.equal(persisted.settings.forecastAlgorithm, 'tif', 'persisted forecastAlgorithm must be tif');
    assert.equal(persisted.settings.trimPct, 25, 'persisted trimPct must be 25');
    assert.equal(persisted.settings.precisionTarget, 90, 'persisted precisionTarget must be 90');
  });

  it('replace() without TIF fields → defaults are injected (forecastAlgorithm classic, trimPct 10, precisionTarget 60)', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    // v2Blob has no TIF fields
    settingsStore.replace({ ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } });

    const s = settingsStore.get();
    assert.equal(s.forecastAlgorithm, 'classic', 'missing forecastAlgorithm must default to classic');
    assert.equal(s.trimPct, 10, 'missing trimPct must default to 10');
    assert.equal(s.precisionTarget, 60, 'missing precisionTarget must default to 60');
  });

  it('replace() with invalid TIF values → falls back to defaults', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    const badBlob = {
      ...tifBlob,
      settings: { ...tifBlob.settings, forecastAlgorithm: 'unknown', trimPct: 999, precisionTarget: -1 },
    };
    settingsStore.replace(badBlob);

    const s = settingsStore.get();
    assert.equal(s.forecastAlgorithm, 'classic', 'invalid forecastAlgorithm must fall back to classic');
    assert.equal(s.trimPct, 10, 'out-of-range trimPct must fall back to default');
    assert.equal(s.precisionTarget, 60, 'out-of-range precisionTarget must fall back to default');
  });

  it('replace() then update() does not lose imported TIF settings', () => {
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    settingsStore.replace({ ...tifBlob });
    settingsStore.update({ subjectName: 'Changed' });

    const s = settingsStore.get();
    assert.equal(s.forecastAlgorithm, 'tif', 'forecastAlgorithm must survive update()');
    assert.equal(s.trimPct, 25, 'trimPct must survive update()');
    assert.equal(s.precisionTarget, 90, 'precisionTarget must survive update()');
    assert.equal(s.subjectName, 'Changed', 'update() must still apply');
  });

});

// ---------------------------------------------------------------------------
// CSV import etap column → stages → settings.update() (Phase 6, Plan 05)
// ---------------------------------------------------------------------------

describe('CSV import etap stages → settings store (D6-07, STAGE-01)', () => {

  test('CSV import with etap column populates settings.stages', () => {
    // Build a CSV string with etap column (English headers for test clarity)
    const csvText = [
      'Date;Wake;Bedtime;etap',
      '2025-01-01;07:00;22:00;Stage1',
      '2025-01-02;07:30;22:30;Stage1',
      '2025-02-01;08:00;23:00;Stage2',
    ].join('\n');

    // Parse CSV directly — verify stages returned
    const parsed = parseCSV(csvText);
    assert.strictEqual(parsed.stages.length, 2, 'must detect 2 distinct etap runs');
    assert.strictEqual(parsed.stages[0].name, 'Stage1', 'first stage name must be Stage1');
    assert.strictEqual(parsed.stages[1].name, 'Stage2', 'second stage name must be Stage2');
    assert.strictEqual(parsed.stages[1].endDate, null, 'last run is open-ended');

    // Simulate the full import flow:
    // 1. settings.replace(blob) resets stages to [] (from DEFAULT_SETTINGS)
    // 2. settings.update({ stages: parsed.stages }) overlays the auto-detected stages
    // Then verify settings.get().stages reflects the imported stages.
    const storage = makeStorage();
    const settingsStore = createSettingsStore({ storage, defaults: DEFAULT_SETTINGS });

    // Confirm replace() wipes existing stages
    settingsStore.replace({ ...v2Blob, events: [...v2Blob.events], activityLog: { ...v2Blob.activityLog } });
    assert.deepEqual(settingsStore.get().stages, [], 'replace() must reset stages to []');

    // Apply auto-detected stages (mirrors handleCsvImport logic in settings-modal.js)
    if (parsed.stages && parsed.stages.length > 0) {
      settingsStore.update({ stages: parsed.stages });
    }

    const result = settingsStore.get().stages;
    assert.strictEqual(result.length, 2, 'settings must now hold 2 stages');
    assert.strictEqual(result[0].name, 'Stage1', 'first settings stage must be Stage1');
    assert.strictEqual(result[0].startDate, '2025-01-01', 'Stage1 start date must be 2025-01-01');
    assert.strictEqual(result[1].name, 'Stage2', 'second settings stage must be Stage2');
    assert.strictEqual(result[1].endDate, null, 'Stage2 must be open-ended');
  });

});
