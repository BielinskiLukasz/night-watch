// tests/unit/db-shape.test.js
// TDD RED → GREEN tests for js/lib/db-shape.js
//
// Covers: migrateV1ToV2 migration semantics (D2-05), DEFAULT_SETTINGS
// constant (D2-03), and idempotency contract (RESEARCH §Pitfall #8).
//
// Phase 2, Plan 01 — TDD red→green, all assertions must FAIL before
// implementation exists.

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1ToV2, DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS — frozen constant with correct D2-03 values
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS', () => {
  it('is Object.freeze\'d', () => {
    assert.equal(Object.isFrozen(DEFAULT_SETTINGS), true);
  });

  it('has all D2-03 keys with correct values', () => {
    assert.equal(DEFAULT_SETTINGS.subjectName, 'Baby');
    assert.equal(DEFAULT_SETTINGS.cutoverHour, 4);
    assert.equal(DEFAULT_SETTINGS.groupingMode, 'calendar');
    assert.equal(DEFAULT_SETTINGS.timeFormat, '24h');
    assert.equal(DEFAULT_SETTINGS.autoOutlier, false);
    assert.equal(DEFAULT_SETTINGS.maxDelta, 30);
    assert.equal(DEFAULT_SETTINGS.minDays, 7);
    assert.equal(DEFAULT_SETTINGS.windowDays, 7);
    assert.equal(DEFAULT_SETTINGS.statBlend, 'median');
  });

  it('has exactly 23 keys (16 prior + 4 Phase 12 + 1 Phase 13 + 1 Phase 17 + 1 Phase 18 fields)', () => {
    assert.equal(Object.keys(DEFAULT_SETTINGS).length, 23);
  });

  it('has tifRollingDays: 7 default (TIF-13)', () => {
    assert.strictEqual(DEFAULT_SETTINGS.tifRollingDays, 7);
  });

  // -------------------------------------------------------------------------
  // Phase 12 new fields (PRED-08, PRED-10, PRED-11)
  // -------------------------------------------------------------------------

  it('has eveningHour: 18 default (PRED-08)', () => {
    assert.strictEqual(DEFAULT_SETTINGS.eveningHour, 18);
  });

  it('has intenseDays: [] default (PRED-10)', () => {
    assert.deepStrictEqual(DEFAULT_SETTINGS.intenseDays, []);
  });

  it('has noNapBedtimeOffsetMinutes: 30 default (PRED-11)', () => {
    assert.strictEqual(DEFAULT_SETTINGS.noNapBedtimeOffsetMinutes, 30);
  });

  it('has intenseDayOffsetMinutes: 30 default (PRED-10)', () => {
    assert.strictEqual(DEFAULT_SETTINGS.intenseDayOffsetMinutes, 30);
  });

  it('has stages: [] default', () => {
    assert.deepStrictEqual(DEFAULT_SETTINGS.stages, []);
  });

  it('has activeStageId: null default', () => {
    assert.strictEqual(DEFAULT_SETTINGS.activeStageId, null);
  });

  // -------------------------------------------------------------------------
  // confirmBeforeLogging — CFG-10 / D9-13 added in Phase 9 Plan 04
  // -------------------------------------------------------------------------

  it('has confirmBeforeLogging: false default (D9-13)', () => {
    assert.strictEqual(DEFAULT_SETTINGS.confirmBeforeLogging, false);
  });

  // -------------------------------------------------------------------------
  // rejectedDays — new CFG-05 field added in Phase 4 Plan 01
  // -------------------------------------------------------------------------

  it('rejectedDays is an empty array', () => {
    assert.ok(Array.isArray(DEFAULT_SETTINGS.rejectedDays),
      'rejectedDays must be an Array');
    assert.equal(DEFAULT_SETTINGS.rejectedDays.length, 0,
      'rejectedDays default must be empty');
  });

  it('rejectedDays default value is frozen (cannot be pushed to)', () => {
    // Object.freeze freezes the outer object; the inner array is a new empty
    // Array literal in the freeze call — it is not frozen itself by default.
    // The important invariant is that callers spreading DEFAULT_SETTINGS get
    // their OWN mutable copy of the array, not a reference to this one.
    const copy = { ...DEFAULT_SETTINGS };
    // Mutating the copy's array must not affect DEFAULT_SETTINGS
    copy.rejectedDays = [...DEFAULT_SETTINGS.rejectedDays, '2026-05-20'];
    assert.equal(DEFAULT_SETTINGS.rejectedDays.length, 0,
      'spreading DEFAULT_SETTINGS must not share the rejectedDays reference');
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — null / undefined (fresh install)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — null/undefined (fresh install)', () => {
  it('returns a v2 blob with default settings and empty events for null', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.equal(result.version, 2);
    assert.deepEqual(result.events, []);
    assert.equal(result.settings.cutoverHour, DEFAULT_SETTINGS.cutoverHour);
    assert.equal(result.settings.subjectName, DEFAULT_SETTINGS.subjectName);
  });

  it('returns a v2 blob with default settings and empty events for undefined', () => {
    const result = migrateV1ToV2(undefined, DEFAULT_SETTINGS);
    assert.equal(result.version, 2);
    assert.deepEqual(result.events, []);
    assert.equal(result.settings.cutoverHour, DEFAULT_SETTINGS.cutoverHour);
  });

  it('settings in fresh blob is a copy (not the same reference as DEFAULT_SETTINGS)', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.notEqual(result.settings, DEFAULT_SETTINGS);
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — v1 blob (inject defaults, preserve events)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — v1 blob', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('injects defaults and bumps version to 2 (events preserved)', () => {
    infoSpy.mock.resetCalls();
    const v1 = { version: 1, events: [{ id: 'a', type: 'wake', at: '2026-01-01T07:00' }] };
    const result = migrateV1ToV2(v1, DEFAULT_SETTINGS);
    assert.equal(result.version, 2);
    assert.deepEqual(result.events, v1.events);
    assert.equal(result.settings.cutoverHour, DEFAULT_SETTINGS.cutoverHour);
  });

  it('calls console.info with [nightwatch] prefix on v1→v2 migration', () => {
    infoSpy.mock.resetCalls();
    migrateV1ToV2({ version: 1, events: [] }, DEFAULT_SETTINGS);
    assert.equal(infoSpy.mock.calls.length, 1);
    const msg = infoSpy.mock.calls[0].arguments[0];
    assert.ok(msg.startsWith('[nightwatch]'), `Expected [nightwatch] prefix, got: ${msg}`);
  });

  it('handles null events in v1 blob → empty array', () => {
    infoSpy.mock.resetCalls();
    const v1 = { version: 1, events: null };
    const result = migrateV1ToV2(v1, DEFAULT_SETTINGS);
    assert.equal(result.version, 2);
    assert.deepEqual(result.events, []);
  });

  it('settings is a copy, not the same reference as defaultSettings', () => {
    infoSpy.mock.resetCalls();
    const result = migrateV1ToV2({ version: 1, events: [] }, DEFAULT_SETTINGS);
    assert.notEqual(result.settings, DEFAULT_SETTINGS);
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — v2 blob (idempotent passthrough)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — v2 blob (idempotent)', () => {
  it('returns the same object reference for a v2 blob', () => {
    const v2 = { version: 2, settings: { cutoverHour: 6 }, events: [{ id: 'b' }] };
    const result = migrateV1ToV2(v2, DEFAULT_SETTINGS);
    assert.equal(result, v2);  // same reference
  });

  it('does not mutate the v2 blob', () => {
    const v2 = { version: 2, settings: { cutoverHour: 6 }, events: [{ id: 'b' }] };
    const originalSettings = v2.settings;
    migrateV1ToV2(v2, DEFAULT_SETTINGS);
    assert.equal(v2.settings, originalSettings);
    assert.equal(v2.settings.cutoverHour, 6);
  });

  it('passes through even if settings key is missing (edge case)', () => {
    // Per RESEARCH §Runtime State Inventory — v2 blob without settings key
    const v2 = { version: 2, events: [{ id: 'c' }] };
    const result = migrateV1ToV2(v2, DEFAULT_SETTINGS);
    assert.equal(result, v2);  // idempotent — same reference
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — rejectedDays handling (CFG-05, Phase 4 Plan 01)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — rejectedDays handling', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('fresh install: rejectedDays is present as empty array', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.ok(Array.isArray(result.settings.rejectedDays),
      'rejectedDays must be an Array on fresh install');
    assert.equal(result.settings.rejectedDays.length, 0,
      'rejectedDays must start empty on fresh install');
  });

  it('v1 blob migration: rejectedDays is present as empty array in migrated settings', () => {
    infoSpy.mock.resetCalls();
    const v1 = { version: 1, events: [{ id: 'a', type: 'wake', at: '2026-01-01T07:00' }] };
    const result = migrateV1ToV2(v1, DEFAULT_SETTINGS);
    assert.ok(Array.isArray(result.settings.rejectedDays),
      'rejectedDays must be present after v1→v2 migration');
    assert.equal(result.settings.rejectedDays.length, 0,
      'rejectedDays must be empty after v1→v2 migration (no prior data)');
  });

  it('v1 blob migration: existing events are not lost when rejectedDays is added', () => {
    infoSpy.mock.resetCalls();
    const v1 = {
      version: 1,
      events: [
        { id: 'a', type: 'wake', at: '2026-01-01T07:00' },
        { id: 'b', type: 'bedtime', at: '2026-01-01T22:00' },
      ],
    };
    const result = migrateV1ToV2(v1, DEFAULT_SETTINGS);
    assert.equal(result.events.length, 2, 'v1 events must be preserved during migration');
    assert.equal(result.settings.rejectedDays.length, 0, 'rejectedDays starts empty');
  });

  it('v2 blob without rejectedDays: migrateV1ToV2 adds it without full re-migration', () => {
    // Simulate a v2 blob saved before Phase 4 (no rejectedDays field)
    const v2Old = {
      version: 2,
      settings: { subjectName: 'Test', cutoverHour: 4, maxDelta: 30 },
      events: [{ id: 'c', type: 'wake', at: '2026-05-01T07:00' }],
    };
    const result = migrateV1ToV2(v2Old, DEFAULT_SETTINGS);
    // Same object reference (idempotent passthrough with mutation)
    assert.equal(result, v2Old, 'must return same blob reference for v2');
    assert.ok(Array.isArray(result.settings.rejectedDays),
      'rejectedDays must be added to v2 blob missing it');
    assert.equal(result.settings.rejectedDays.length, 0,
      'rejectedDays must be empty when added to a v2 blob');
    // Existing settings fields must be preserved
    assert.equal(result.settings.subjectName, 'Test', 'existing settings must be preserved');
    assert.equal(result.settings.cutoverHour, 4, 'cutoverHour must be preserved');
  });

  it('v2 blob that already has rejectedDays: migrateV1ToV2 does not clobber it', () => {
    // Simulate a v2 blob that already has rejectedDays populated
    const v2WithRejections = {
      version: 2,
      settings: { subjectName: 'Test', rejectedDays: ['2026-05-20', '2026-05-21'] },
      events: [],
    };
    const result = migrateV1ToV2(v2WithRejections, DEFAULT_SETTINGS);
    assert.equal(result, v2WithRejections, 'must return same blob reference for v2');
    assert.deepEqual(result.settings.rejectedDays, ['2026-05-20', '2026-05-21'],
      'existing rejectedDays must not be overwritten by migration');
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — activityLog injection (D5-17, Phase 5 Plan 01)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — activityLog injection', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('fresh install: activityLog is present as empty object', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.ok(
      result.activityLog !== null && typeof result.activityLog === 'object' && !Array.isArray(result.activityLog),
      'activityLog must be a plain object on fresh install',
    );
    assert.equal(Object.keys(result.activityLog).length, 0, 'activityLog must be empty on fresh install');
  });

  it('v1 blob migration: activityLog is present as empty object', () => {
    infoSpy.mock.resetCalls();
    const result = migrateV1ToV2({ version: 1, events: [] }, DEFAULT_SETTINGS);
    assert.ok(
      result.activityLog !== null && typeof result.activityLog === 'object' && !Array.isArray(result.activityLog),
      'activityLog must be a plain object after v1→v2 migration',
    );
    assert.equal(Object.keys(result.activityLog).length, 0, 'activityLog must be empty after v1→v2 migration');
  });

  it('v2 blob without activityLog: migrateV1ToV2 injects activityLog: {}', () => {
    const v2 = {
      version: 2,
      settings: { subjectName: 'Test', cutoverHour: 4, maxDelta: 30, rejectedDays: [] },
      events: [],
    };
    const result = migrateV1ToV2(v2, DEFAULT_SETTINGS);
    assert.equal(result, v2, 'must return same blob reference for v2');
    assert.ok(
      result.activityLog !== null && typeof result.activityLog === 'object' && !Array.isArray(result.activityLog),
      'activityLog must be injected into v2 blob missing it',
    );
    assert.equal(Object.keys(result.activityLog).length, 0, 'injected activityLog must be empty');
  });

  it('v2 blob with existing activityLog: migrateV1ToV2 does not clobber it', () => {
    const v2 = {
      version: 2,
      settings: { subjectName: 'Test', cutoverHour: 4, rejectedDays: [] },
      events: [],
      activityLog: { '2026-06-28': 3.5 },
    };
    const result = migrateV1ToV2(v2, DEFAULT_SETTINGS);
    assert.equal(result, v2, 'must return same blob reference for v2');
    assert.equal(result.activityLog['2026-06-28'], 3.5, 'existing activityLog must not be clobbered');
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — stages / activeStageId injection (D6-01, D6-02, Phase 6 Plan 01)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — stages/activeStageId injection', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('v2 passthrough — injects stages: [] when absent', () => {
    const blob = { version: 2, settings: { subjectName: 'Baby', rejectedDays: [], activityLog: {} }, events: [], activityLog: {} };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.deepStrictEqual(result.settings.stages, []);
  });

  it('v2 passthrough — injects activeStageId: null when absent', () => {
    const blob = { version: 2, settings: { subjectName: 'Baby', rejectedDays: [], activityLog: {} }, events: [], activityLog: {} };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.strictEqual(result.settings.activeStageId, null);
  });

  it('v2 passthrough — does NOT overwrite existing stages', () => {
    const existing = [{ id: '1', name: 'Stage 1', startDate: '2025-01-01', endDate: null }];
    const blob = { version: 2, settings: { subjectName: 'Baby', rejectedDays: [], stages: existing, activeStageId: '1', activityLog: {} }, events: [], activityLog: {} };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.deepStrictEqual(result.settings.stages, existing);
  });

  it('v1 migration — returns blob with stages: []', () => {
    infoSpy.mock.resetCalls();
    const result = migrateV1ToV2({ version: 1, events: [] }, DEFAULT_SETTINGS);
    assert.deepStrictEqual(result.settings.stages, []);
  });

  it('fresh install — returns blob with stages: [] and activeStageId: null', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.deepStrictEqual(result.settings.stages, []);
    assert.strictEqual(result.settings.activeStageId, null);
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — confirmBeforeLogging injection (CFG-10 / D9-13, Phase 9 Plan 04)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — confirmBeforeLogging injection', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('fresh install: confirmBeforeLogging is false', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.strictEqual(result.settings.confirmBeforeLogging, false);
  });

  it('v1 migration: confirmBeforeLogging is present in migrated settings', () => {
    infoSpy.mock.resetCalls();
    const result = migrateV1ToV2({ version: 1, events: [] }, DEFAULT_SETTINGS);
    assert.strictEqual(result.settings.confirmBeforeLogging, false);
  });

  it('v2 blob without confirmBeforeLogging: migrateV1ToV2 injects false', () => {
    const blob = {
      version: 2,
      settings: { subjectName: 'Test', cutoverHour: 4, stages: [], activeStageId: null },
      events: [],
      activityLog: {},
    };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.equal(result, blob, 'must return same blob reference for v2');
    assert.strictEqual(result.settings.confirmBeforeLogging, false,
      'confirmBeforeLogging must be injected as false for v2 blob missing it');
  });

  it('v2 blob with confirmBeforeLogging: true — migrateV1ToV2 does not clobber it', () => {
    const blob = {
      version: 2,
      settings: { subjectName: 'Test', stages: [], activeStageId: null, confirmBeforeLogging: true },
      events: [],
      activityLog: {},
    };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.equal(result, blob, 'must return same blob reference for v2');
    assert.strictEqual(result.settings.confirmBeforeLogging, true,
      'existing confirmBeforeLogging: true must not be clobbered');
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — Phase 12 forward-compat migration (PRED-08, PRED-10, PRED-11)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — Phase 12 forward-compat migration', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('v2 blob without Phase 12 fields: migrateV1ToV2 injects all 4 new fields', () => {
    const blob = {
      version: 2,
      settings: {
        subjectName: 'Test', cutoverHour: 4, stages: [], activeStageId: null,
        confirmBeforeLogging: false, forecastAlgorithm: 'classic', trimPct: 10,
        precisionTarget: 60,
      },
      events: [],
      activityLog: {},
    };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.equal(result, blob, 'must return same blob reference for v2');
    assert.deepStrictEqual(result.settings.intenseDays, [],
      'intenseDays must be injected as [] for v2 blob missing it');
    assert.strictEqual(result.settings.eveningHour, 18,
      'eveningHour must be injected as 18 for v2 blob missing it');
    assert.strictEqual(result.settings.noNapBedtimeOffsetMinutes, 30,
      'noNapBedtimeOffsetMinutes must be injected as 30 for v2 blob missing it');
    assert.strictEqual(result.settings.intenseDayOffsetMinutes, 30,
      'intenseDayOffsetMinutes must be injected as 30 for v2 blob missing it');
  });

  it('v2 blob with existing Phase 12 fields: migrateV1ToV2 does not clobber them', () => {
    const blob = {
      version: 2,
      settings: {
        subjectName: 'Test', cutoverHour: 4, stages: [], activeStageId: null,
        confirmBeforeLogging: false, forecastAlgorithm: 'classic', trimPct: 10,
        precisionTarget: 60, intenseDays: ['monday'], eveningHour: 20,
        noNapBedtimeOffsetMinutes: 45, intenseDayOffsetMinutes: 60,
      },
      events: [],
      activityLog: {},
    };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.equal(result, blob, 'must return same blob reference for v2');
    assert.deepStrictEqual(result.settings.intenseDays, ['monday'],
      'existing intenseDays must not be clobbered');
    assert.strictEqual(result.settings.eveningHour, 20,
      'existing eveningHour must not be clobbered');
    assert.strictEqual(result.settings.noNapBedtimeOffsetMinutes, 45,
      'existing noNapBedtimeOffsetMinutes must not be clobbered');
    assert.strictEqual(result.settings.intenseDayOffsetMinutes, 60,
      'existing intenseDayOffsetMinutes must not be clobbered');
  });

  it('fresh install: all 4 Phase 12 fields are present with correct defaults', () => {
    const result = migrateV1ToV2(null, DEFAULT_SETTINGS);
    assert.deepStrictEqual(result.settings.intenseDays, []);
    assert.strictEqual(result.settings.eveningHour, 18);
    assert.strictEqual(result.settings.noNapBedtimeOffsetMinutes, 30);
    assert.strictEqual(result.settings.intenseDayOffsetMinutes, 30);
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — Phase 13 forward-compat migration (TIF-13 / D-07)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — Phase 13 tifRollingDays injection', () => {
  let infoSpy;

  before(() => {
    infoSpy = mock.method(console, 'info', () => {});
  });

  after(() => {
    infoSpy.mock.restore();
  });

  it('v2 blob without tifRollingDays: migrateV1ToV2 injects tifRollingDays: 7', () => {
    const blob = {
      version: 2,
      settings: {
        subjectName: 'Test', cutoverHour: 4, stages: [], activeStageId: null,
        confirmBeforeLogging: false, forecastAlgorithm: 'classic', trimPct: 10,
        precisionTarget: 60, intenseDays: [], eveningHour: 18,
        noNapBedtimeOffsetMinutes: 30, intenseDayOffsetMinutes: 30,
      },
      events: [],
      activityLog: {},
    };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.equal(result, blob, 'must return same blob reference for v2');
    assert.strictEqual(result.settings.tifRollingDays, 7,
      'tifRollingDays must be injected as 7 for v2 blob missing it');
  });

  it('v2 blob with existing tifRollingDays: migrateV1ToV2 does not clobber it', () => {
    const blob = {
      version: 2,
      settings: {
        subjectName: 'Test', cutoverHour: 4, stages: [], activeStageId: null,
        confirmBeforeLogging: false, forecastAlgorithm: 'tif', trimPct: 10,
        precisionTarget: 60, intenseDays: [], eveningHour: 18,
        noNapBedtimeOffsetMinutes: 30, intenseDayOffsetMinutes: 30,
        tifRollingDays: 14,
      },
      events: [],
      activityLog: {},
    };
    const result = migrateV1ToV2(blob, DEFAULT_SETTINGS);
    assert.equal(result, blob, 'must return same blob reference for v2');
    assert.strictEqual(result.settings.tifRollingDays, 14,
      'existing tifRollingDays must not be clobbered');
  });
});

// ---------------------------------------------------------------------------
// migrateV1ToV2 — unsupported version (throw)
// ---------------------------------------------------------------------------

describe('migrateV1ToV2 — unsupported version', () => {
  it('throws Error with message containing "Unsupported schema version: 3" for version 3', () => {
    assert.throws(
      () => migrateV1ToV2({ version: 3 }, DEFAULT_SETTINGS),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('Unsupported schema version: 3'),
          `Expected message to include "Unsupported schema version: 3", got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it('throws for version 4 with correct message', () => {
    assert.throws(
      () => migrateV1ToV2({ version: 4 }, DEFAULT_SETTINGS),
      (err) => {
        assert.ok(err.message.includes('Unsupported schema version: 4'));
        return true;
      },
    );
  });

  it('throws for version 0 with correct message', () => {
    assert.throws(
      () => migrateV1ToV2({ version: 0 }, DEFAULT_SETTINGS),
      (err) => {
        assert.ok(err.message.includes('Unsupported schema version: 0'));
        return true;
      },
    );
  });
});
