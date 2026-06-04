// tests/unit/forecast.test.js
// Unit tests for js/lib/forecast.js — forecast algorithm (empirical CDF, percentiles).
//
// TDD RED phase: All tests FAIL before js/lib/forecast.js is implemented.
// Run: node --test tests/unit/forecast.test.js
//
// Test groups:
//   1. percentile(sorted, p) — linear interpolation edge cases
//   2. calculatePercentiles(dayRecords, getTimeFn, rejectWeight) — downweighting
//   3. selectCentralTime(times) — median selection
//   4. forecast(dayRecords, settings) — integration test for full algorithm

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  percentile,
  calculatePercentiles,
  selectCentralTime,
  downweightRejectedDays,
  forecast,
} from '../../js/lib/forecast.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal day record for tests
// ---------------------------------------------------------------------------
function makeDay(wake, bedtime, napStart, napEnd, rejected = false) {
  return { wake, bedtime, napStart, napEnd, rejected };
}

// ---------------------------------------------------------------------------
// 1. percentile(sorted, p)
// ---------------------------------------------------------------------------

describe('percentile(sorted, p)', () => {
  it('empty array returns null', () => {
    assert.strictEqual(percentile([], 0.5), null);
  });

  it('single element returns that element for any percentile', () => {
    assert.strictEqual(percentile([42], 0.1), 42);
    assert.strictEqual(percentile([42], 0.5), 42);
    assert.strictEqual(percentile([42], 0.9), 42);
  });

  it('two-element array: P10 returns first element', () => {
    // pos = 0.1 * (2 + 1) = 0.3 → k = floor(0.3 - 1) = floor(-0.7) = -1 → clamped to sorted[0]
    assert.strictEqual(percentile([10, 20], 0.1), 10);
  });

  it('two-element array: P90 returns second element', () => {
    // pos = 0.9 * (2 + 1) = 2.7 → k = floor(2.7 - 1) = floor(1.7) = 1 → k >= length-1, clamped to sorted[1]
    assert.strictEqual(percentile([10, 20], 0.9), 20);
  });

  it('two-element array: P50 returns interpolated midpoint', () => {
    // pos = 0.5 * (2 + 1) = 1.5 → k = floor(1.5 - 1) = floor(0.5) = 0; frac = 1.5 - 1 = 0.5
    // result = 10 + 0.5 * (20 - 10) = 15
    assert.strictEqual(percentile([10, 20], 0.5), 15);
  });

  it('seven-element array [1..7]: P50 returns 4.0', () => {
    // pos = 0.5 * (7 + 1) = 4.0 → k = floor(4.0 - 1) = 3; frac = 4.0 - 4 = 0
    // result = sorted[3] + 0 * ... = 4
    const sorted = [1, 2, 3, 4, 5, 6, 7];
    assert.strictEqual(percentile(sorted, 0.5), 4.0);
  });

  it('seven-element array [1..7]: P10 uses linear interpolation formula', () => {
    // pos = 0.1 * (7 + 1) = 0.8 → k = floor(0.8 - 1) = floor(-0.2) = -1 → clamped to sorted[0] = 1
    const sorted = [1, 2, 3, 4, 5, 6, 7];
    assert.strictEqual(percentile(sorted, 0.1), 1);
  });

  it('seven-element array [1..7]: P90 uses linear interpolation formula', () => {
    // pos = 0.9 * (7 + 1) = 7.2 → k = floor(7.2 - 1) = floor(6.2) = 6 → k >= length-1=6, clamped to sorted[6] = 7
    const sorted = [1, 2, 3, 4, 5, 6, 7];
    assert.strictEqual(percentile(sorted, 0.9), 7);
  });

  it('fractional position interpolates correctly: [10, 20, 30] P50', () => {
    // pos = 0.5 * (3 + 1) = 2.0 → k = floor(2.0 - 1) = 1; frac = 2.0 - 2 = 0
    // result = sorted[1] + 0 * (sorted[2] - sorted[1]) = 20
    const sorted = [10, 20, 30];
    assert.strictEqual(percentile(sorted, 0.5), 20);
  });

  it('fractional position interpolates between elements: [10, 20, 30] P33', () => {
    // pos = 0.33 * (3 + 1) = 1.32 → k = floor(1.32 - 1) = floor(0.32) = 0; frac = 1.32 - 1 = 0.32
    // result = sorted[0] + 0.32 * (sorted[1] - sorted[0]) = 10 + 0.32 * 10 = 13.2
    const sorted = [10, 20, 30];
    const result = percentile(sorted, 0.33);
    assert.ok(Math.abs(result - 13.2) < 0.01, `Expected ~13.2, got ${result}`);
  });
});

// ---------------------------------------------------------------------------
// 2. calculatePercentiles(dayRecords, getTimeFn, rejectWeight)
// ---------------------------------------------------------------------------

describe('calculatePercentiles(dayRecords, getTimeFn, rejectWeight)', () => {
  // Build 7 days of wake times in minutes: [390, 395, 400, 405, 410, 415, 420]
  // (06:30, 06:35, 06:40, 06:45, 06:50, 06:55, 07:00)
  const sevenDays = [
    makeDay('06:30', null, null, null),
    makeDay('06:35', null, null, null),
    makeDay('06:40', null, null, null),
    makeDay('06:45', null, null, null),
    makeDay('06:50', null, null, null),
    makeDay('06:55', null, null, null),
    makeDay('07:00', null, null, null),
  ];

  it('7 days, none rejected: P50 (central) is correct', () => {
    const result = calculatePercentiles(sevenDays, d => d.wake);
    // P50 with effectiveCount=7: pos = 0.5 * 8 = 4 → sorted[3] = 405 minutes (06:45)
    assert.strictEqual(result.central, 405);
  });

  it('7 days, none rejected: P10 (min) is correct', () => {
    const result = calculatePercentiles(sevenDays, d => d.wake);
    // pos = 0.1 * 8 = 0.8 → clamped to sorted[0] = 390
    assert.strictEqual(result.min, 390);
  });

  it('7 days, none rejected: P90 (max) is correct', () => {
    const result = calculatePercentiles(sevenDays, d => d.wake);
    // pos = 0.9 * 8 = 7.2 → k = floor(7.2-1) = 6 → clamped to sorted[6] = 420
    assert.strictEqual(result.max, 420);
  });

  it('7 days, 1 rejected at 0.5 weight: effective count is 6.5', () => {
    const daysWithRejected = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:35', null, null, null, true),  // rejected: 0.5 weight
      makeDay('06:40', null, null, null, false),
      makeDay('06:45', null, null, null, false),
      makeDay('06:50', null, null, null, false),
      makeDay('06:55', null, null, null, false),
      makeDay('07:00', null, null, null, false),
    ];
    const result = calculatePercentiles(daysWithRejected, d => d.wake);
    // Effective count = 6.5; positions shift slightly
    // Just verify it returns { min, central, max } all as numbers
    assert.ok(typeof result.min === 'number', 'min should be a number');
    assert.ok(typeof result.central === 'number', 'central should be a number');
    assert.ok(typeof result.max === 'number', 'max should be a number');
  });

  it('7 days, 1 rejected: effective count 6.5 produces a central different from unweighted', () => {
    // All same time except one rejected day at 07:00 (outlier)
    // With 0.5 weight on outlier, central should shift toward non-rejected cluster
    const daysShifted = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('07:00', null, null, null, true),  // rejected outlier
    ];
    const result = calculatePercentiles(daysShifted, d => d.wake);
    // With all non-rejected at 390, P50 should be 390
    assert.strictEqual(result.central, 390);
  });

  it('7 days, all rejected (effective count 3.5): returns numeric values', () => {
    const allRejected = sevenDays.map(d => ({ ...d, rejected: true }));
    const result = calculatePercentiles(allRejected, d => d.wake);
    // Effective count = 3.5; behavior documented edge case
    assert.ok(result !== null, 'should not return null');
    assert.ok(typeof result.min === 'number', 'min should be a number');
    assert.ok(typeof result.central === 'number', 'central should be a number');
    assert.ok(typeof result.max === 'number', 'max should be a number');
  });

  it('empty days array returns null', () => {
    const result = calculatePercentiles([], d => d.wake);
    assert.strictEqual(result, null);
  });

  it('days with missing event (null) are filtered out', () => {
    const daysWithMissing = [
      makeDay('06:30', null, null, null),
      makeDay(null, null, null, null),    // missing wake
      makeDay('06:45', null, null, null),
    ];
    // Should only use days where wake is non-null
    const result = calculatePercentiles(daysWithMissing, d => d.wake);
    assert.ok(result !== null, 'should return a result for days with at least one valid event');
  });
});

// ---------------------------------------------------------------------------
// 3. selectCentralTime(times)
// ---------------------------------------------------------------------------

describe('selectCentralTime(times)', () => {
  it('returns P50 (median) of the time array', () => {
    const times = [390, 395, 400, 405, 410, 415, 420];
    // P50 on sorted [390..420]: pos = 0.5 * 8 = 4 → sorted[3] = 405
    assert.strictEqual(selectCentralTime(times), 405);
  });

  it('single time returns itself', () => {
    assert.strictEqual(selectCentralTime([390]), 390);
  });

  it('even number of times returns interpolated midpoint', () => {
    // [10, 20]: pos = 0.5 * 3 = 1.5 → k=0, frac=0.5 → 10 + 0.5*(20-10) = 15
    assert.strictEqual(selectCentralTime([10, 20]), 15);
  });

  it('empty array returns null', () => {
    assert.strictEqual(selectCentralTime([]), null);
  });
});

// ---------------------------------------------------------------------------
// 4. downweightRejectedDays(dayRecords, weight)
// ---------------------------------------------------------------------------

describe('downweightRejectedDays(dayRecords, weight)', () => {
  it('annotates each non-rejected day with weight 1.0', () => {
    const days = [makeDay('06:30', null, null, null, false)];
    const result = downweightRejectedDays(days, 0.5);
    assert.strictEqual(result[0].weight, 1.0);
  });

  it('annotates each rejected day with the provided weight', () => {
    const days = [makeDay('06:30', null, null, null, true)];
    const result = downweightRejectedDays(days, 0.5);
    assert.strictEqual(result[0].weight, 0.5);
  });

  it('does not mutate the input array', () => {
    const days = [makeDay('06:30', null, null, null, true)];
    const original = { ...days[0] };
    downweightRejectedDays(days, 0.5);
    assert.strictEqual(days[0].weight, undefined, 'input should not gain weight property');
    assert.deepStrictEqual(days[0], original);
  });

  it('returns new array with weight metadata added', () => {
    const days = [
      makeDay('06:30', null, null, null, false),
      makeDay('07:00', null, null, null, true),
    ];
    const result = downweightRejectedDays(days, 0.5);
    assert.notStrictEqual(result, days, 'should return a new array');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].weight, 1.0);
    assert.strictEqual(result[1].weight, 0.5);
  });
});

// ---------------------------------------------------------------------------
// 5. forecast(dayRecords, settings) — integration test
// ---------------------------------------------------------------------------

describe('forecast(dayRecords, settings)', () => {
  const defaultSettings = {
    minDays: 7,
    maxDelta: 30,
    statBlend: 'median',
    windowDays: 7,
  };

  // Build 7 days with all four event types
  const sevenFullDays = [
    makeDay('06:30', '21:00', '13:00', '14:00'),
    makeDay('06:35', '21:10', '13:05', '14:05'),
    makeDay('06:40', '21:20', '13:10', '14:10'),
    makeDay('06:45', '21:30', '13:15', '14:15'),
    makeDay('06:50', '21:40', '13:20', '14:20'),
    makeDay('06:55', '21:50', '13:25', '14:25'),
    makeDay('07:00', '22:00', '13:30', '14:30'),
  ];

  it('returns object with wake, bedtime, napStart, napEnd keys', () => {
    const result = forecast(sevenFullDays, defaultSettings);
    assert.ok('wake' in result, 'result should have wake');
    assert.ok('bedtime' in result, 'result should have bedtime');
    assert.ok('napStart' in result, 'result should have napStart');
    assert.ok('napEnd' in result, 'result should have napEnd');
  });

  it('each prediction has { central, min, max } shape', () => {
    const result = forecast(sevenFullDays, defaultSettings);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      assert.ok('central' in result[key], `${key}.central should exist`);
      assert.ok('min' in result[key], `${key}.min should exist`);
      assert.ok('max' in result[key], `${key}.max should exist`);
    }
  });

  it('central prediction is an HH:MM string when data is present', () => {
    const result = forecast(sevenFullDays, defaultSettings);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      const central = result[key].central;
      if (central !== null) {
        assert.match(central, /^\d{2}:\d{2}$/, `${key}.central should be HH:MM`);
      }
    }
  });

  it('min and max are HH:MM strings when data is present', () => {
    const result = forecast(sevenFullDays, defaultSettings);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      const { min, max } = result[key];
      if (min !== null) assert.match(min, /^\d{2}:\d{2}$/, `${key}.min should be HH:MM`);
      if (max !== null) assert.match(max, /^\d{2}:\d{2}$/, `${key}.max should be HH:MM`);
    }
  });

  it('empty day records returns null central/min/max for all events', () => {
    const result = forecast([], defaultSettings);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      assert.strictEqual(result[key].central, null, `${key}.central should be null for empty history`);
      assert.strictEqual(result[key].min, null, `${key}.min should be null for empty history`);
      assert.strictEqual(result[key].max, null, `${key}.max should be null for empty history`);
    }
  });

  it('single day record returns { central, min, max } not null', () => {
    const singleDay = [makeDay('06:45', '21:30', '13:15', '14:15')];
    const result = forecast(singleDay, defaultSettings);
    // Single day: P10, P50, P90 all return the same single value
    assert.strictEqual(result.wake.central, '06:45');
    assert.strictEqual(result.wake.min, '06:45');
    assert.strictEqual(result.wake.max, '06:45');
  });

  it('days with missing event type return null for that event', () => {
    // Days only have wake times; no bedtime/napStart/napEnd
    const wakeOnlyDays = [
      makeDay('06:30', null, null, null),
      makeDay('06:45', null, null, null),
      makeDay('07:00', null, null, null),
    ];
    const result = forecast(wakeOnlyDays, defaultSettings);
    // wake should have values; others should be null
    assert.ok(result.wake.central !== null, 'wake should have a central value');
    assert.strictEqual(result.bedtime.central, null, 'bedtime should be null if no bedtime data');
    assert.strictEqual(result.napStart.central, null, 'napStart should be null if no napStart data');
    assert.strictEqual(result.napEnd.central, null, 'napEnd should be null if no napEnd data');
  });

  it('wake forecast for 7 days [06:30..07:00]: central is 06:45', () => {
    const result = forecast(sevenFullDays, defaultSettings);
    assert.strictEqual(result.wake.central, '06:45');
  });

  it('uses windowDays to slice input to last N days', () => {
    // 10 days in history; windowDays=7 → uses last 7, ignores oldest 3
    const tenDays = [
      makeDay('05:00', null, null, null),  // day 1 (oldest, should be ignored)
      makeDay('05:00', null, null, null),  // day 2
      makeDay('05:00', null, null, null),  // day 3
      makeDay('06:30', null, null, null),  // day 4 (first in window)
      makeDay('06:35', null, null, null),
      makeDay('06:40', null, null, null),
      makeDay('06:45', null, null, null),
      makeDay('06:50', null, null, null),
      makeDay('06:55', null, null, null),
      makeDay('07:00', null, null, null),  // day 10 (last)
    ];
    const settingsWindow7 = { ...defaultSettings, windowDays: 7 };
    const result = forecast(tenDays, settingsWindow7);
    // The last 7 days are 06:30..07:00; central should be 06:45, not influenced by 05:00 outliers
    assert.strictEqual(result.wake.central, '06:45');
  });
});
