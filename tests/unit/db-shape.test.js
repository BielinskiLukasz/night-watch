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

  it('has all 9 D2-03 keys with correct values', () => {
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

  it('has exactly 9 keys', () => {
    assert.equal(Object.keys(DEFAULT_SETTINGS).length, 9);
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
