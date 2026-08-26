// tests/unit/settings-validate.test.js
// TDD RED → GREEN tests for js/lib/settings-validate.js
//
// Covers: validateSettings in mode:'save' (strict) and mode:'load' (lenient),
//         all 9 fields per D2-21, RULES frozen constant.
//
// Phase 2, Plan 01 — TDD red→green, all assertions must FAIL before
// implementation exists.

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { validateSettings, RULES } from '../../js/lib/settings-validate.js';
import { DEFAULT_SETTINGS } from '../../js/lib/db-shape.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid settings object using DEFAULT_SETTINGS, optionally overriding
 * specific fields.
 */
function valid(overrides = {}) {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

// ---------------------------------------------------------------------------
// RULES export — frozen, all 9 fields present
// ---------------------------------------------------------------------------

describe('RULES export', () => {
  it('is Object.freeze\'d', () => {
    assert.equal(Object.isFrozen(RULES), true);
  });

  it('has entries for all 21 field names (16 prior + 4 Phase 12 + 1 Phase 13 fields)', () => {
    const expected = [
      'subjectName', 'cutoverHour', 'groupingMode', 'rejectedDays', 'timeFormat',
      'autoOutlier', 'maxDelta', 'minDays', 'windowDays', 'statBlend',
      'stages', 'activeStageId', 'confirmBeforeLogging',
      'forecastAlgorithm', 'trimPct', 'precisionTarget',
      'intenseDays', 'eveningHour', 'noNapBedtimeOffsetMinutes', 'intenseDayOffsetMinutes',
      'tifRollingDays',
    ];
    for (const field of expected) {
      assert.ok(field in RULES, `Expected RULES to have key: ${field}`);
    }
    assert.equal(Object.keys(RULES).length, 21);
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — valid defaults all pass
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — valid defaults', () => {
  it('returns {ok:true, errors:[], normalized} for all valid defaults', () => {
    const result = validateSettings(valid(), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.ok(result.normalized, 'normalized should be present');
  });

  it('normalized contains all 21 keys (16 prior + 4 Phase 12 + 1 Phase 13 fields)', () => {
    const result = validateSettings(valid(), { mode: 'save' });
    const keys = Object.keys(result.normalized);
    assert.equal(keys.length, 21);
    for (const field of Object.keys(DEFAULT_SETTINGS)) {
      assert.ok(field in result.normalized, `normalized missing: ${field}`);
    }
  });

  it('trims whitespace from subjectName', () => {
    const result = validateSettings(valid({ subjectName: '  Alice  ' }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.equal(result.normalized.subjectName, 'Alice');
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — subjectName validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — subjectName', () => {
  it('accepts empty string', () => {
    const result = validateSettings(valid({ subjectName: '' }), { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('accepts a string of exactly 40 characters', () => {
    const result = validateSettings(valid({ subjectName: 'x'.repeat(40) }), { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('rejects a string of 41 characters with error containing "40"', () => {
    const result = validateSettings(valid({ subjectName: 'x'.repeat(41) }), { mode: 'save' });
    assert.equal(result.ok, false);
    const err = result.errors.find((e) => e.field === 'subjectName');
    assert.ok(err, 'Expected error for subjectName');
    assert.ok(err.message.includes('40'), `Error message should mention 40: ${err.message}`);
  });

  it('rejects non-string (number) with error', () => {
    const result = validateSettings(valid({ subjectName: 42 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'subjectName'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — cutoverHour validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — cutoverHour', () => {
  it('accepts boundary value 0', () => {
    assert.equal(validateSettings(valid({ cutoverHour: 0 }), { mode: 'save' }).ok, true);
  });

  it('accepts boundary value 23', () => {
    assert.equal(validateSettings(valid({ cutoverHour: 23 }), { mode: 'save' }).ok, true);
  });

  it('accepts midrange value 4', () => {
    assert.equal(validateSettings(valid({ cutoverHour: 4 }), { mode: 'save' }).ok, true);
  });

  it('rejects value 24 (out of range)', () => {
    const result = validateSettings(valid({ cutoverHour: 24 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'cutoverHour'));
  });

  it('rejects value -1 (out of range)', () => {
    const result = validateSettings(valid({ cutoverHour: -1 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'cutoverHour'));
  });

  it('rejects non-integer 4.5', () => {
    const result = validateSettings(valid({ cutoverHour: 4.5 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'cutoverHour'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — groupingMode validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — groupingMode', () => {
  it('accepts \'calendar\'', () => {
    assert.equal(validateSettings(valid({ groupingMode: 'calendar' }), { mode: 'save' }).ok, true);
  });

  it('accepts \'sleepCycle\'', () => {
    assert.equal(validateSettings(valid({ groupingMode: 'sleepCycle' }), { mode: 'save' }).ok, true);
  });

  it('rejects \'weekly\'', () => {
    const result = validateSettings(valid({ groupingMode: 'weekly' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'groupingMode'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — timeFormat validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — timeFormat', () => {
  it('accepts \'24h\'', () => {
    assert.equal(validateSettings(valid({ timeFormat: '24h' }), { mode: 'save' }).ok, true);
  });

  it('accepts \'12h\'', () => {
    assert.equal(validateSettings(valid({ timeFormat: '12h' }), { mode: 'save' }).ok, true);
  });

  it('rejects \'locale\'', () => {
    const result = validateSettings(valid({ timeFormat: 'locale' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'timeFormat'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — autoOutlier validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — autoOutlier', () => {
  it('accepts true', () => {
    assert.equal(validateSettings(valid({ autoOutlier: true }), { mode: 'save' }).ok, true);
  });

  it('accepts false', () => {
    assert.equal(validateSettings(valid({ autoOutlier: false }), { mode: 'save' }).ok, true);
  });

  it('rejects string \'yes\'', () => {
    const result = validateSettings(valid({ autoOutlier: 'yes' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'autoOutlier'));
  });

  it('rejects numeric 1', () => {
    const result = validateSettings(valid({ autoOutlier: 1 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'autoOutlier'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — maxDelta validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — maxDelta', () => {
  it('accepts boundary value 5', () => {
    assert.equal(validateSettings(valid({ maxDelta: 5 }), { mode: 'save' }).ok, true);
  });

  it('accepts boundary value 120', () => {
    assert.equal(validateSettings(valid({ maxDelta: 120 }), { mode: 'save' }).ok, true);
  });

  it('rejects value 4 (below min)', () => {
    const result = validateSettings(valid({ maxDelta: 4 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'maxDelta'));
  });

  it('rejects value 121 (above max)', () => {
    const result = validateSettings(valid({ maxDelta: 121 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'maxDelta'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — minDays validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — minDays', () => {
  it('accepts boundary value 1', () => {
    assert.equal(validateSettings(valid({ minDays: 1 }), { mode: 'save' }).ok, true);
  });

  it('accepts boundary value 90', () => {
    assert.equal(validateSettings(valid({ minDays: 90 }), { mode: 'save' }).ok, true);
  });

  it('rejects value 0 (below min)', () => {
    const result = validateSettings(valid({ minDays: 0 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'minDays'));
  });

  it('rejects value 91 (above max)', () => {
    const result = validateSettings(valid({ minDays: 91 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'minDays'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — windowDays validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — windowDays', () => {
  it('accepts boundary value 3', () => {
    assert.equal(validateSettings(valid({ windowDays: 3 }), { mode: 'save' }).ok, true);
  });

  it('accepts boundary value 90', () => {
    assert.equal(validateSettings(valid({ windowDays: 90 }), { mode: 'save' }).ok, true);
  });

  it('rejects value 2 (below min)', () => {
    const result = validateSettings(valid({ windowDays: 2 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'windowDays'));
  });

  it('rejects value 91 (above max)', () => {
    const result = validateSettings(valid({ windowDays: 91 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'windowDays'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — statBlend validation
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — statBlend', () => {
  it('accepts \'median\'', () => {
    assert.equal(validateSettings(valid({ statBlend: 'median' }), { mode: 'save' }).ok, true);
  });

  it('accepts \'mean\'', () => {
    assert.equal(validateSettings(valid({ statBlend: 'mean' }), { mode: 'save' }).ok, true);
  });

  it('accepts \'blend\'', () => {
    assert.equal(validateSettings(valid({ statBlend: 'blend' }), { mode: 'save' }).ok, true);
  });

  it('rejects \'p50\'', () => {
    const result = validateSettings(valid({ statBlend: 'p50' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'statBlend'));
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — multiple invalid fields at once (collects ALL errors)
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — multiple invalid fields', () => {
  it('returns one error per invalid field when multiple are invalid', () => {
    const result = validateSettings(valid({
      cutoverHour: 99,
      groupingMode: 'invalid',
      timeFormat: 'invalid',
    }), { mode: 'save' });
    assert.equal(result.ok, false);
    const errorFields = result.errors.map((e) => e.field);
    assert.ok(errorFields.includes('cutoverHour'), 'Missing cutoverHour error');
    assert.ok(errorFields.includes('groupingMode'), 'Missing groupingMode error');
    assert.ok(errorFields.includes('timeFormat'), 'Missing timeFormat error');
    assert.equal(result.errors.length, 3);
  });

  it('errors array has {field, message} shape', () => {
    const result = validateSettings(valid({ cutoverHour: 99 }), { mode: 'save' });
    assert.equal(result.ok, false);
    const err = result.errors[0];
    assert.ok('field' in err, 'Error should have field property');
    assert.ok('message' in err, 'Error should have message property');
    assert.equal(typeof err.field, 'string');
    assert.equal(typeof err.message, 'string');
  });
});

// ---------------------------------------------------------------------------
// mode:'load' — lenient (per-field default + console.warn)
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'load\' — lenient resets with warn', () => {
  let warnSpy;

  before(() => {
    warnSpy = mock.method(console, 'warn', () => {});
  });

  after(() => {
    warnSpy.mock.restore();
  });

  it('returns {ok:true} for cutoverHour:999 and resets to default', () => {
    warnSpy.mock.resetCalls();
    const result = validateSettings(valid({ cutoverHour: 999 }), { mode: 'load' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.normalized.cutoverHour, DEFAULT_SETTINGS.cutoverHour);
  });

  it('calls console.warn with [nightwatch] prefix for invalid cutoverHour in load mode', () => {
    warnSpy.mock.resetCalls();
    validateSettings(valid({ cutoverHour: 999 }), { mode: 'load' });
    assert.equal(warnSpy.mock.calls.length, 1);
    const msg = warnSpy.mock.calls[0].arguments[0];
    assert.ok(msg.startsWith('[nightwatch]'), `Expected [nightwatch] prefix, got: ${msg}`);
    assert.ok(msg.includes('cutoverHour'), `Expected 'cutoverHour' in warn message: ${msg}`);
  });

  it('returns {ok:true} for invalid groupingMode and resets to default', () => {
    warnSpy.mock.resetCalls();
    const result = validateSettings(valid({ groupingMode: 'invalid' }), { mode: 'load' });
    assert.equal(result.ok, true);
    assert.equal(result.normalized.groupingMode, DEFAULT_SETTINGS.groupingMode);
  });

  it('does NOT call console.warn when all defaults are valid', () => {
    warnSpy.mock.resetCalls();
    validateSettings(valid(), { mode: 'load' });
    assert.equal(warnSpy.mock.calls.length, 0);
  });

  it('resets multiple invalid fields to their respective defaults in load mode', () => {
    warnSpy.mock.resetCalls();
    const result = validateSettings(valid({
      cutoverHour: 99,
      statBlend: 'invalid',
    }), { mode: 'load' });
    assert.equal(result.ok, true);
    assert.equal(result.normalized.cutoverHour, DEFAULT_SETTINGS.cutoverHour);
    assert.equal(result.normalized.statBlend, DEFAULT_SETTINGS.statBlend);
    assert.equal(warnSpy.mock.calls.length, 2);
  });

  it('valid fields are preserved unchanged in load mode even when others are reset', () => {
    warnSpy.mock.resetCalls();
    const result = validateSettings(valid({ cutoverHour: 99, timeFormat: '12h' }), { mode: 'load' });
    assert.equal(result.ok, true);
    assert.equal(result.normalized.timeFormat, '12h');  // valid value preserved
    assert.equal(result.normalized.cutoverHour, DEFAULT_SETTINGS.cutoverHour);  // reset
  });
});

// ---------------------------------------------------------------------------
// mode:'save' — stages validation (D6-01, Phase 6 Plan 01)
// ---------------------------------------------------------------------------

describe('validateSettings mode:\'save\' — stages (D6-01)', () => {
  // validFields includes all current fields for complete valid input
  const validFields = {
    subjectName: 'Baby', cutoverHour: 4, groupingMode: 'calendar',
    rejectedDays: [], timeFormat: '24h', autoOutlier: false,
    maxDelta: 30, minDays: 7, windowDays: 7, statBlend: 'median',
    stages: [], activeStageId: null, confirmBeforeLogging: false,
    forecastAlgorithm: 'classic', trimPct: 10, precisionTarget: 60, tifRollingDays: 7,
    intenseDays: [], eveningHour: 18, noNapBedtimeOffsetMinutes: 30, intenseDayOffsetMinutes: 30,
  };

  it('accepts empty stages array', () => {
    const result = validateSettings({ ...validFields, stages: [] }, { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('accepts valid stage with all fields including string endDate', () => {
    const result = validateSettings({
      ...validFields,
      stages: [{ id: '1', name: 'Early', startDate: '2025-01-01', endDate: '2025-06-30' }],
    }, { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('accepts valid stage with null endDate (open-ended stage)', () => {
    const result = validateSettings({
      ...validFields,
      stages: [{ id: '1', name: 'Open', startDate: '2025-01-01', endDate: null }],
    }, { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('rejects stages that is not an array', () => {
    const result = validateSettings({ ...validFields, stages: 'not-an-array' }, { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'stages'), 'expected error for stages field');
  });

  it('rejects stage item missing id', () => {
    const result = validateSettings({
      ...validFields,
      stages: [{ name: 'Missing id', startDate: '2025-01-01', endDate: null }],
    }, { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'stages'), 'expected error for stages field');
  });

  it('rejects stage item missing name', () => {
    const result = validateSettings({
      ...validFields,
      stages: [{ id: '1', startDate: '2025-01-01', endDate: null }],
    }, { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'stages'), 'expected error for stages field');
  });

  it('rejects stage item missing startDate', () => {
    const result = validateSettings({
      ...validFields,
      stages: [{ id: '1', name: 'S', endDate: null }],
    }, { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'stages'), 'expected error for stages field');
  });
});

// ---------------------------------------------------------------------------
// mode:'save' / mode:'load' — activeStageId validation (D6-02, Phase 6 Plan 01)
// ---------------------------------------------------------------------------

describe('validateSettings — activeStageId (D6-02)', () => {
  const validFields = {
    subjectName: 'Baby', cutoverHour: 4, groupingMode: 'calendar',
    rejectedDays: [], timeFormat: '24h', autoOutlier: false,
    maxDelta: 30, minDays: 7, windowDays: 7, statBlend: 'median',
    stages: [], activeStageId: null, confirmBeforeLogging: false,
    forecastAlgorithm: 'classic', trimPct: 10, precisionTarget: 60, tifRollingDays: 7,
    intenseDays: [], eveningHour: 18, noNapBedtimeOffsetMinutes: 30, intenseDayOffsetMinutes: 30,
  };

  it('accepts null activeStageId', () => {
    const result = validateSettings({ ...validFields, activeStageId: null }, { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('accepts string activeStageId', () => {
    const result = validateSettings({ ...validFields, activeStageId: '1234567890' }, { mode: 'save' });
    assert.equal(result.ok, true);
  });

  it('rejects numeric activeStageId', () => {
    const result = validateSettings({ ...validFields, activeStageId: 123 }, { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'activeStageId'), 'expected error for activeStageId field');
  });

  it('normalizes undefined activeStageId to null in mode:\'load\'', () => {
    const result = validateSettings({ ...validFields, activeStageId: undefined }, { mode: 'load' });
    assert.equal(result.ok, true);
    assert.strictEqual(result.normalized.activeStageId, null);
  });
});

// ---------------------------------------------------------------------------
// mode:'save' / mode:'load' — confirmBeforeLogging validation (CFG-10 / D9-13, Phase 9 Plan 04)
// ---------------------------------------------------------------------------

describe('validateSettings — confirmBeforeLogging (CFG-10)', () => {
  it('DEFAULT_SETTINGS.confirmBeforeLogging is false', () => {
    assert.strictEqual(DEFAULT_SETTINGS.confirmBeforeLogging, false);
  });

  it('accepts true', () => {
    const result = validateSettings(valid({ confirmBeforeLogging: true }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.strictEqual(result.normalized.confirmBeforeLogging, true);
  });

  it('accepts false', () => {
    const result = validateSettings(valid({ confirmBeforeLogging: false }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.strictEqual(result.normalized.confirmBeforeLogging, false);
  });

  it('rejects string \'yes\' in mode:\'save\'', () => {
    const result = validateSettings(valid({ confirmBeforeLogging: 'yes' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'confirmBeforeLogging'),
      'Expected error for confirmBeforeLogging field');
  });

  it('resets to false for string \'yes\' in mode:\'load\' (lenient) and emits console.warn', () => {
    const warnSpy = mock.method(console, 'warn', () => {});
    try {
      warnSpy.mock.resetCalls();
      const result = validateSettings(valid({ confirmBeforeLogging: 'yes' }), { mode: 'load' });
      assert.equal(result.ok, true);
      assert.strictEqual(result.normalized.confirmBeforeLogging, false,
        'invalid value must reset to default false in lenient mode');
      assert.ok(warnSpy.mock.calls.length >= 1, 'Expected at least one console.warn call');
      const msg = warnSpy.mock.calls[0].arguments[0];
      assert.ok(msg.includes('confirmBeforeLogging'), `Expected 'confirmBeforeLogging' in warn: ${msg}`);
    } finally {
      warnSpy.mock.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// mode:'save' / mode:'load' — forecastAlgorithm validation (TIF-01 / D10-11, Phase 10 Plan 03)
// ---------------------------------------------------------------------------

describe('validateSettings — forecastAlgorithm (TIF-01)', () => {
  it('DEFAULT_SETTINGS.forecastAlgorithm is \'classic\'', () => {
    assert.strictEqual(DEFAULT_SETTINGS.forecastAlgorithm, 'classic');
  });

  it('accepts \'classic\'', () => {
    const result = validateSettings(valid({ forecastAlgorithm: 'classic' }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'forecastAlgorithm'), 'Unexpected error for forecastAlgorithm');
  });

  it('accepts \'tif\'', () => {
    const result = validateSettings(valid({ forecastAlgorithm: 'tif' }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'forecastAlgorithm'), 'Unexpected error for forecastAlgorithm');
  });

  it('rejects \'invalid\' in mode:\'save\'', () => {
    const result = validateSettings(valid({ forecastAlgorithm: 'invalid' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'forecastAlgorithm'),
      'Expected error for forecastAlgorithm field');
  });

  it('resets to default \'classic\' for \'invalid\' in mode:\'load\' (lenient)', () => {
    const warnSpy = mock.method(console, 'warn', () => {});
    try {
      warnSpy.mock.resetCalls();
      const result = validateSettings(valid({ forecastAlgorithm: 'invalid' }), { mode: 'load' });
      assert.equal(result.ok, true);
      assert.strictEqual(result.normalized.forecastAlgorithm, 'classic',
        'invalid value must reset to default \'classic\' in lenient mode');
    } finally {
      warnSpy.mock.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// mode:'save' / mode:'load' — trimPct validation (TIF-02 / D10-13, Phase 10 Plan 03)
// ---------------------------------------------------------------------------

describe('validateSettings — trimPct (TIF-02)', () => {
  it('DEFAULT_SETTINGS.trimPct is 10', () => {
    assert.strictEqual(DEFAULT_SETTINGS.trimPct, 10);
  });

  it('accepts boundary value 0', () => {
    const result = validateSettings(valid({ trimPct: 0 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'trimPct'), 'Unexpected error for trimPct');
  });

  it('accepts boundary value 40', () => {
    const result = validateSettings(valid({ trimPct: 40 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'trimPct'), 'Unexpected error for trimPct');
  });

  it('accepts midrange value 10', () => {
    const result = validateSettings(valid({ trimPct: 10 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'trimPct'), 'Unexpected error for trimPct');
  });

  it('rejects -1 (below min) in mode:\'save\'', () => {
    const result = validateSettings(valid({ trimPct: -1 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'trimPct'), 'Expected error for trimPct field');
  });

  it('rejects 41 (above max) in mode:\'save\'', () => {
    const result = validateSettings(valid({ trimPct: 41 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'trimPct'), 'Expected error for trimPct field');
  });

  it('rejects non-numeric string \'ten\' in mode:\'save\'', () => {
    const result = validateSettings(valid({ trimPct: 'ten' }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'trimPct'), 'Expected error for trimPct field');
  });
});

// ---------------------------------------------------------------------------
// mode:'save' / mode:'load' — precisionTarget validation (TIF-03 / D10-13, Phase 10 Plan 03)
// ---------------------------------------------------------------------------

describe('validateSettings — precisionTarget (TIF-03)', () => {
  it('DEFAULT_SETTINGS.precisionTarget is 60', () => {
    assert.strictEqual(DEFAULT_SETTINGS.precisionTarget, 60);
  });

  it('accepts boundary value 1', () => {
    const result = validateSettings(valid({ precisionTarget: 1 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'precisionTarget'), 'Unexpected error for precisionTarget');
  });

  it('accepts midrange value 60', () => {
    const result = validateSettings(valid({ precisionTarget: 60 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'precisionTarget'), 'Unexpected error for precisionTarget');
  });

  it('accepts boundary value 300', () => {
    const result = validateSettings(valid({ precisionTarget: 300 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'precisionTarget'), 'Unexpected error for precisionTarget');
  });

  it('rejects 0 (below min) in mode:\'save\'', () => {
    const result = validateSettings(valid({ precisionTarget: 0 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'precisionTarget'), 'Expected error for precisionTarget field');
  });

  it('rejects 301 (above max) in mode:\'save\'', () => {
    const result = validateSettings(valid({ precisionTarget: 301 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'precisionTarget'), 'Expected error for precisionTarget field');
  });
});

// ---------------------------------------------------------------------------
// mode:'save' / mode:'load' — tifRollingDays validation (TIF-13 / D-07, Phase 13 Plan 01)
// ---------------------------------------------------------------------------

describe('validateSettings — tifRollingDays (TIF-13)', () => {
  it('DEFAULT_SETTINGS.tifRollingDays is 7', () => {
    assert.strictEqual(DEFAULT_SETTINGS.tifRollingDays, 7);
  });

  it('accepts boundary value 3', () => {
    const result = validateSettings(valid({ tifRollingDays: 3 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'tifRollingDays'), 'Unexpected error for tifRollingDays');
  });

  it('accepts midrange value 7', () => {
    const result = validateSettings(valid({ tifRollingDays: 7 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'tifRollingDays'), 'Unexpected error for tifRollingDays');
  });

  it('accepts boundary value 30', () => {
    const result = validateSettings(valid({ tifRollingDays: 30 }), { mode: 'save' });
    assert.equal(result.ok, true);
    assert.ok(!result.errors.some((e) => e.field === 'tifRollingDays'), 'Unexpected error for tifRollingDays');
  });

  it('rejects 2 (below min=3) in mode:\'save\'', () => {
    const result = validateSettings(valid({ tifRollingDays: 2 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'tifRollingDays'),
      'Expected error for tifRollingDays field when below min');
  });

  it('rejects 31 (above max=30) in mode:\'save\'', () => {
    const result = validateSettings(valid({ tifRollingDays: 31 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'tifRollingDays'),
      'Expected error for tifRollingDays field when above max');
  });

  it('rejects non-integer 7.5 in mode:\'save\'', () => {
    const result = validateSettings(valid({ tifRollingDays: 7.5 }), { mode: 'save' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'tifRollingDays'),
      'Expected error for non-integer tifRollingDays');
  });
});

// ---------------------------------------------------------------------------
// Default mode behavior (no explicit mode → treated as 'save')
// ---------------------------------------------------------------------------

describe('validateSettings — default mode (no opts)', () => {
  it('defaults to save mode when no opts supplied — rejects invalid value', () => {
    const result = validateSettings(valid({ cutoverHour: 99 }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'cutoverHour'));
  });

  it('defaults to save mode when opts={} supplied — rejects invalid value', () => {
    const result = validateSettings(valid({ cutoverHour: 99 }), {});
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.field === 'cutoverHour'));
  });
});
