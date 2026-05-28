// tests/integration/v1-to-v2-migration.test.js
// D2-25 migration integration test:
//   v1 blob + createSettingsStore → v2 shape, events intact, D2-03 defaults applied.
//
// Plan: 02-02 (Task 2 — TDD RED)
// Decisions: D2-05, D2-08, D2-25
//
// Note: createEventLog currently expects SCHEMA_VERSION === 1 and throws on mismatch.
// These tests use createSettingsStore only (which handles migration internally).
// The event-log schema version bump (1→2) is planned for 02-03.
// For the "both stores co-load" assertion we pass a v2-shaped blob so the
// existing event-log version check passes.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsStore } from '../../js/store/settings.js';
import { createStorageLocal } from '../../js/adapters/storage-local.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';

// ---------------------------------------------------------------------------
// Helper — fake in-memory localStorage
// ---------------------------------------------------------------------------

/**
 * Create a minimal localStorage-like object for test injection.
 * @param {object|null} initialBlob  initial JSON blob or null (no data)
 * @returns {{ ls: object, getBlob: () => object|null }}
 */
function fakeLS(initialBlob) {
  const KEY = 'nightwatch:db';
  let stored = initialBlob === null ? null : JSON.stringify(initialBlob);
  const ls = {
    getItem: (k) => (k === KEY ? stored : null),
    setItem: (k, v) => { if (k === KEY) stored = v; },
  };
  return {
    ls,
    getBlob: () => (stored === null ? null : JSON.parse(stored)),
  };
}

// ---------------------------------------------------------------------------
// v1 → v2 migration
// ---------------------------------------------------------------------------

describe('v1→v2 migration integration (D2-25)', () => {
  it('v1 blob: createSettingsStore loads successfully with D2-03 defaults', () => {
    const v1Blob = { version: 1, events: [{ id: 'abc', type: 'wake', at: '2026-05-01T08:00', note: '' }] };
    const { ls } = fakeLS(v1Blob);
    const storage = createStorageLocal('nightwatch:db', ls);
    const store = createSettingsStore({ storage });
    const snap = store.get();
    assert.equal(snap.cutoverHour,  DEFAULT_SETTINGS.cutoverHour);
    assert.equal(snap.subjectName,  DEFAULT_SETTINGS.subjectName);
    assert.equal(snap.groupingMode, DEFAULT_SETTINGS.groupingMode);
    assert.equal(snap.timeFormat,   DEFAULT_SETTINGS.timeFormat);
    assert.equal(snap.autoOutlier,  DEFAULT_SETTINGS.autoOutlier);
    assert.equal(snap.maxDelta,     DEFAULT_SETTINGS.maxDelta);
    assert.equal(snap.minDays,      DEFAULT_SETTINGS.minDays);
    assert.equal(snap.windowDays,   DEFAULT_SETTINGS.windowDays);
    assert.equal(snap.statBlend,    DEFAULT_SETTINGS.statBlend);
  });

  it('v1 blob: events are preserved in the migrated blob after update()', () => {
    const originalEvent = { id: 'abc', type: 'wake', at: '2026-05-01T08:00', note: '' };
    const v1Blob = { version: 1, events: [originalEvent] };
    const { ls, getBlob } = fakeLS(v1Blob);
    const storage = createStorageLocal('nightwatch:db', ls);
    const store = createSettingsStore({ storage });
    // Trigger a save by calling update
    store.update({ subjectName: 'Alice' });
    const saved = getBlob();
    assert.ok(saved !== null, 'blob should have been saved');
    assert.equal(saved.version, 2, 'saved blob must be v2');
    assert.ok(Array.isArray(saved.events), 'events must be present');
    assert.equal(saved.events.length, 1, 'original event must be preserved');
    assert.equal(saved.events[0].id, 'abc', 'event id must match');
  });

  it('v1 blob: after update(), saved blob has version===2 AND settings.subjectName===Alice', () => {
    const v1Blob = { version: 1, events: [] };
    const { ls, getBlob } = fakeLS(v1Blob);
    const storage = createStorageLocal('nightwatch:db', ls);
    const store = createSettingsStore({ storage });
    store.update({ subjectName: 'Alice' });
    const saved = getBlob();
    assert.equal(saved.version, 2);
    assert.equal(saved.settings.subjectName, 'Alice');
  });

  it('v1 blob: round-trip — reload new store from same fakeLS → subjectName===Alice', () => {
    const v1Blob = { version: 1, events: [] };
    const { ls } = fakeLS(v1Blob);
    const storage = createStorageLocal('nightwatch:db', ls);
    const store1 = createSettingsStore({ storage });
    store1.update({ subjectName: 'Alice' });
    // Reload from the same ls
    const storage2 = createStorageLocal('nightwatch:db', ls);
    const store2 = createSettingsStore({ storage: storage2 });
    assert.equal(store2.get().subjectName, 'Alice');
  });

  it('v1 blob: console.info with [nightwatch] migration message is called exactly once', () => {
    const infos = [];
    const origInfo = console.info;
    console.info = (...args) => infos.push(args.join(' '));
    try {
      const v1Blob = { version: 1, events: [] };
      const { ls } = fakeLS(v1Blob);
      const storage = createStorageLocal('nightwatch:db', ls);
      createSettingsStore({ storage });
      const migrationLogs = infos.filter((m) => m.includes('[nightwatch]') && m.includes('v1'));
      assert.equal(migrationLogs.length, 1, `expected exactly 1 migration log, got: ${JSON.stringify(infos)}`);
    } finally {
      console.info = origInfo;
    }
  });

  it('v2 blob: no migration message and correct settings loaded', () => {
    const infos = [];
    const origInfo = console.info;
    console.info = (...args) => infos.push(args.join(' '));
    try {
      const v2Blob = { version: 2, settings: { ...DEFAULT_SETTINGS, cutoverHour: 6 }, events: [] };
      const { ls } = fakeLS(v2Blob);
      const storage = createStorageLocal('nightwatch:db', ls);
      const store = createSettingsStore({ storage });
      assert.equal(store.get().cutoverHour, 6, 'should load cutoverHour 6 from v2 blob');
      const migrationLogs = infos.filter((m) => m.includes('[nightwatch]') && m.includes('v1'));
      assert.equal(migrationLogs.length, 0, 'no migration should happen for v2 blob');
    } finally {
      console.info = origInfo;
    }
  });
});
