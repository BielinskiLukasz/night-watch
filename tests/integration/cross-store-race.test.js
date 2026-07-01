// tests/integration/cross-store-race.test.js
// Pitfall #1 cross-store stale-write mitigation test.
//
// Scenario: settings store and event-log store share the same storage adapter.
// If event-log writes after settings.update(), event-log's in-memory copy of
// db.settings is stale (it loaded BEFORE the settings update). Without the
// re-read-before-save mitigation in settings.update(), the settings slice
// would be overwritten by event-log's next save.
//
// Plan: 02-02 (Task 2 — TDD RED)
// Decisions: D2-08 (shared storage instance), T-2-06 (cross-store stale-write)
// Research: RESEARCH §Pitfall #1
//
// Implementation note: The current event-log (Phase 1) expects SCHEMA_VERSION === 1.
// These tests simulate the stale event-log write by calling storage.save() directly
// with a blob that has the OLD settings — mimicking what an unmitigated event-log would do.
// This isolates the cross-store race test from event-log's schema version constraint.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsStore } from '../../js/store/settings.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Shared fake storage backed by a plain object.
 * Both stores use the SAME instance (same object reference) to simulate
 * the D2-08 shared-storage invariant.
 */
function sharedFakeStorage(initialBlob) {
  let stored = initialBlob === null ? null : JSON.parse(JSON.stringify(initialBlob));
  return {
    load: () => (stored === null ? null : JSON.parse(JSON.stringify(stored))),
    save: (db) => { stored = JSON.parse(JSON.stringify(db)); },
    getSaved: () => (stored === null ? null : JSON.parse(JSON.stringify(stored))),
  };
}

// ---------------------------------------------------------------------------
// Cross-store race: settings update → event-log stale write
// ---------------------------------------------------------------------------

describe('cross-store race mitigation (Pitfall #1 / T-2-06)', () => {
  it('settings.cutoverHour survives after a stale event-log save', () => {
    // Setup: shared storage with a clean v2 blob
    const storage = sharedFakeStorage({
      version: 2,
      settings: { ...DEFAULT_SETTINGS, cutoverHour: 4 },
      events: [],
    });

    // Create the settings store
    const settingsStore = createSettingsStore({ storage });

    // Step 1: settings.update → writes cutoverHour:6 to storage
    settingsStore.update({ cutoverHour: 6 });
    assert.equal(storage.getSaved().settings.cutoverHour, 6,
      'after settings.update, cutoverHour must be 6 in storage');

    // Step 2: Simulate a STALE event-log save — event-log loaded the blob
    // BEFORE the settings update, so its in-memory db.settings has cutoverHour:4.
    // An unmitigated event-log.persist() would write this stale blob back.
    const staleEventLogWrite = {
      version: 2,
      settings: { ...DEFAULT_SETTINGS, cutoverHour: 4 }, // stale — pre-update value
      events: [{ id: 'e1', type: 'wake', at: '2026-05-28T08:00' }],
    };
    storage.save(staleEventLogWrite);

    // After the stale write, storage has cutoverHour:4 again.
    assert.equal(storage.getSaved().settings.cutoverHour, 4,
      'stale event-log write should have reverted cutoverHour to 4 in storage');

    // Step 3: settings.update() now re-reads fresh storage before writing.
    // It picks up events from the stale event-log write, then writes with
    // its OWN in-memory settings (cutoverHour:6 was never overwritten in memory).
    settingsStore.update({ subjectName: 'Alice' });

    // After settings.update(), storage should have cutoverHour:6 AND subjectName:Alice
    const saved = storage.getSaved();
    assert.equal(saved.settings.cutoverHour, 6,
      'settings.update() must restore cutoverHour:6 after the stale event-log write');
    assert.equal(saved.settings.subjectName, 'Alice',
      'new patch must also be applied');
    // Events from event-log's write should still be present (settings preserved them)
    assert.equal(saved.events.length, 1, 'events from event-log write should be preserved');
  });

  it('reverse: event-log write first, then settings.update — settings slice survives', () => {
    // Setup: shared storage
    const storage = sharedFakeStorage({
      version: 2,
      settings: { ...DEFAULT_SETTINGS },
      events: [],
    });

    const settingsStore = createSettingsStore({ storage });

    // Step 1: simulate event-log write (adds an event, uses default settings)
    const eventLogWrite = {
      version: 2,
      settings: { ...DEFAULT_SETTINGS }, // default settings at event-log load time
      events: [{ id: 'e2', type: 'bedtime', at: '2026-05-28T22:00' }],
    };
    storage.save(eventLogWrite);

    // Step 2: settings.update — must pick up event-log's events AND apply the patch
    settingsStore.update({ cutoverHour: 5 });

    const saved = storage.getSaved();
    assert.equal(saved.settings.cutoverHour, 5,
      'cutoverHour must be 5 after settings.update');
    assert.equal(saved.events.length, 1,
      'events from event-log write must be preserved in settings.update save');
    assert.equal(saved.events[0].id, 'e2', 'event id must match');
  });

  it('reload: after stale event-log write + settings.update, reload settings → cutoverHour persists', () => {
    const storage = sharedFakeStorage({
      version: 2,
      settings: { ...DEFAULT_SETTINGS, cutoverHour: 4 },
      events: [],
    });
    const settingsStore = createSettingsStore({ storage });

    // Update to cutoverHour:6
    settingsStore.update({ cutoverHour: 6 });

    // Stale event-log write reverts settings in storage
    storage.save({
      version: 2,
      settings: { ...DEFAULT_SETTINGS, cutoverHour: 4 },
      events: [{ id: 'e3', type: 'wake', at: '2026-05-28T07:00' }],
    });

    // settings.update re-reads fresh storage + applies in-memory settings
    settingsStore.update({ subjectName: 'Reload Test' });

    // Reload a fresh store — should see cutoverHour:6
    const freshStorage = {
      load: storage.load,
      save: storage.save,
      getSaved: storage.getSaved,
    };
    const store2 = createSettingsStore({ storage: freshStorage });
    assert.equal(store2.get().cutoverHour, 6, 'reloaded store must see cutoverHour:6');
    assert.equal(store2.get().subjectName, 'Reload Test');
  });
});
