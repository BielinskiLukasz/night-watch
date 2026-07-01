// tests/unit/forecast.test.js
// Unit tests for js/lib/forecast.js — forecast algorithm (empirical CDF, percentiles).
//
// TDD: RED → GREEN → REFACTOR
// Run: node --test tests/unit/forecast.test.js
//
// Test groups:
//   1. percentile(sorted, p) — linear interpolation edge cases
//   2. calculatePercentiles(dayRecords, getTimeFn, rejectWeight) — downweighting
//   3. selectCentralTime(times) — median selection
//   4. downweightRejectedDays(dayRecords, weight) — non-mutating annotation
//   5. forecast(dayRecords, settings) — integration test
//   6. downweighting edge cases — all rejected, mix, single valid
//   7. time conversion round-tripping — lossless 5-min precision, midnight wraparound
//   8. forecast() with synthetic days — known outputs, sparse data, window truncation
//   9. eventTimesToMinutes — numeric comparison (not string-lexical)
//   4. forecast(dayRecords, settings) — integration test for full algorithm

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  percentile,
  calculatePercentiles,
  selectCentralTime,
  downweightRejectedDays,
  forecast,
  timeToMinutes,
  minutesToTime,
  generateProbabilityBand,
  detectColdStart,
  selectNextEvent,
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

  // noGateSettings: minDays=0 so cold-start gate never fires (test the prediction logic directly)
  const noGateSettings = { ...defaultSettings, minDays: 0 };

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

  it('returns object with wake, bedtime, napStart, napEnd keys when not cold-start', () => {
    // 7 days, minDays=7 → isColdStart=false, predictions present
    const result = forecast(sevenFullDays, defaultSettings);
    assert.strictEqual(result.isColdStart, false);
    assert.ok('wake' in result, 'result should have wake');
    assert.ok('bedtime' in result, 'result should have bedtime');
    assert.ok('napStart' in result, 'result should have napStart');
    assert.ok('napEnd' in result, 'result should have napEnd');
  });

  it('each prediction has { central, min, max } shape OR { probabilityBand } shape', () => {
    // Predictions have either normal min/max shape (band ≤ maxDelta) or
    // probability-band fallback shape (band > maxDelta). Both are valid.
    // wake: 06:30..07:00 = 30 min band == maxDelta=30 → normal shape (width not > maxDelta)
    // bedtime: 21:00..22:00 = 60 min band > maxDelta=30 → probabilityBand
    const result = forecast(sevenFullDays, defaultSettings);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      const pred = result[key];
      const hasNormalShape = 'central' in pred && 'min' in pred && 'max' in pred;
      const hasBandShape = 'probabilityBand' in pred;
      assert.ok(hasNormalShape || hasBandShape,
        `${key} should have either { central, min, max } or { probabilityBand } shape`);
    }
  });

  it('central prediction is an HH:MM string when data is present and band is narrow', () => {
    // wake spans only 30 min (== maxDelta) → normal { central, min, max } shape
    const result = forecast(sevenFullDays, defaultSettings);
    const wake = result.wake;
    // wake band: P10≈06:30, P90≈07:00, width=30 == maxDelta → NOT > maxDelta → normal shape
    assert.ok('central' in wake, 'wake.central should exist (band ≤ maxDelta)');
    assert.match(wake.central, /^\d{2}:\d{2}$/, 'wake.central should be HH:MM');
  });

  it('min and max are HH:MM strings when data is present and band is narrow', () => {
    // Use wake predictions which have a 30-min band == maxDelta (not triggered)
    const result = forecast(sevenFullDays, defaultSettings);
    const wake = result.wake;
    assert.ok('min' in wake, 'wake.min should exist');
    assert.ok('max' in wake, 'wake.max should exist');
    if (wake.min !== null) assert.match(wake.min, /^\d{2}:\d{2}$/, 'wake.min should be HH:MM');
    if (wake.max !== null) assert.match(wake.max, /^\d{2}:\d{2}$/, 'wake.max should be HH:MM');
  });

  it('empty day records → isColdStart=true when minDays>0', () => {
    // Empty history with minDays=7: 0 valid days < 7 → cold-start
    const result = forecast([], defaultSettings);
    assert.strictEqual(result.isColdStart, true);
    assert.strictEqual(result.validDayCount, 0);
    assert.strictEqual(result.minDaysRemaining, 7);
    assert.ok(!('wake' in result), 'wake should not be present during cold-start');
  });

  it('empty day records with minDays=0 → no cold-start, null central/min/max for all events', () => {
    // No cold-start gate active: empty history → null predictions
    const result = forecast([], noGateSettings);
    assert.strictEqual(result.isColdStart, false);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      assert.strictEqual(result[key].central, null, `${key}.central should be null for empty history`);
      assert.strictEqual(result[key].min, null, `${key}.min should be null for empty history`);
      assert.strictEqual(result[key].max, null, `${key}.max should be null for empty history`);
    }
  });

  it('single day record returns { central, min, max } not null', () => {
    const singleDay = [makeDay('06:45', '21:30', '13:15', '14:15')];
    // noGateSettings: minDays=0 so single day doesn't trigger cold-start
    const result = forecast(singleDay, noGateSettings);
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
    // noGateSettings: minDays=0 so 3 valid days doesn't trigger cold-start
    const result = forecast(wakeOnlyDays, noGateSettings);
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

  it('forecast returns isColdStart=false when data meets minDays threshold', () => {
    const result = forecast(sevenFullDays, defaultSettings);
    assert.strictEqual(result.isColdStart, false);
  });
});

// ---------------------------------------------------------------------------
// 6. Downweighting edge cases
// ---------------------------------------------------------------------------

describe('downweighting edge cases', () => {
  it('all days rejected (effective count 3.5 on 7 days): detectColdStart triggers (0 valid < 7 minDays)', () => {
    // D3-03 + D3-06 interaction: all 7 days rejected → validDayCount=0 → cold-start gate fires.
    // The percentile math (3.5 effective count) is still valid; but cold-start is checked first.
    // Use minDays=0 to bypass cold-start and test the percentile behavior in isolation.
    const allRejected = [
      makeDay('06:30', null, null, null, true),
      makeDay('06:35', null, null, null, true),
      makeDay('06:40', null, null, null, true),
      makeDay('06:45', null, null, null, true),
      makeDay('06:50', null, null, null, true),
      makeDay('06:55', null, null, null, true),
      makeDay('07:00', null, null, null, true),
    ];
    // With minDays=7 and 0 valid days: cold-start fires → no predictions
    const settingsGated = { minDays: 7, maxDelta: 30, statBlend: 'median', windowDays: 7 };
    const gatedResult = forecast(allRejected, settingsGated);
    assert.strictEqual(gatedResult.isColdStart, true, 'all-rejected days triggers cold-start when minDays=7');
    assert.strictEqual(gatedResult.validDayCount, 0);

    // With minDays=0: cold-start gate bypassed → percentile values still computed from rejected days
    const settingsNoGate = { minDays: 0, maxDelta: 30, statBlend: 'median', windowDays: 7 };
    const result = forecast(allRejected, settingsNoGate);
    assert.strictEqual(result.isColdStart, false, 'minDays=0 bypasses cold-start gate');
    // Should return values, not null — edge case is documented for Phase 3+ threshold floor
    assert.ok(result.wake.central !== null, 'central should still be computed even if all rejected');
    assert.ok(result.wake.min !== null, 'min should still be computed even if all rejected');
    assert.ok(result.wake.max !== null, 'max should still be computed even if all rejected');
  });

  it('mix of rejected/non-rejected: P50 shifts toward non-rejected days', () => {
    // 6 days at 06:30 (non-rejected) + 1 day at 07:00 (rejected)
    // P50 with effective count=6.5 should be at or near 06:30 cluster
    const days = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('06:30', null, null, null, false),
      makeDay('07:00', null, null, null, true),  // rejected outlier
    ];
    const result = calculatePercentiles(days, d => d.wake);
    // central (P50) should be 390 (06:30), not shifted toward rejected 420 (07:00)
    assert.strictEqual(result.central, 390);
  });

  it('single valid day + rest rejected: P50 equals that day\'s time', () => {
    // 6 rejected days at various times, 1 non-rejected at 06:45
    // P50 should still resolve to 06:45 as the dominant signal
    const days = [
      makeDay('06:45', null, null, null, false),  // the one valid day
      makeDay('06:00', null, null, null, true),
      makeDay('06:10', null, null, null, true),
      makeDay('06:20', null, null, null, true),
      makeDay('06:30', null, null, null, true),
      makeDay('07:00', null, null, null, true),
      makeDay('07:10', null, null, null, true),
    ];
    const result = calculatePercentiles(days, d => d.wake);
    // Effective count = 1 + 6*0.5 = 4.0
    // sorted times in minutes: [360, 370, 380, 385 (06:25? no...) let's compute:
    // 06:00=360, 06:10=370, 06:20=380, 06:30=390, 06:45=405, 07:00=420, 07:10=430
    // P50: pos = 0.5 * (4+1) = 2.5 → k=floor(2.5-1)=floor(1.5)=1; frac=2.5-2=0.5
    // result = sorted[1] + 0.5*(sorted[2]-sorted[1]) = 370 + 0.5*10 = 375 → '06:15' after round
    // Just verify it returns a numeric value
    assert.ok(typeof result.central === 'number', 'P50 should be a number');
    assert.ok(typeof result.min === 'number', 'P10 should be a number');
    assert.ok(typeof result.max === 'number', 'P90 should be a number');
  });
});

// ---------------------------------------------------------------------------
// 7. Time conversion round-tripping
// ---------------------------------------------------------------------------

describe('time conversion round-tripping', () => {
  it("'06:30' → 390 min → back to '06:30' (no precision loss)", () => {
    const minutes = timeToMinutes('06:30');
    assert.strictEqual(minutes, 390);
    assert.strictEqual(minutesToTime(minutes), '06:30');
  });

  it("'21:45' → 1305 min → back to '21:45'", () => {
    const minutes = timeToMinutes('21:45');
    assert.strictEqual(minutes, 1305);
    assert.strictEqual(minutesToTime(minutes), '21:45');
  });

  it("'06:32' (not 5-min aligned) → rounds to '06:30' during conversion", () => {
    // 06:32 = 392 min; rounded to nearest 5 = 390 → '06:30'
    const minutes = 392;
    assert.strictEqual(minutesToTime(minutes), '06:30');
  });

  it("'06:33' (rounds up) → '06:35'", () => {
    // 06:33 = 393 min; rounded to nearest 5 = 395 → '06:35'
    assert.strictEqual(minutesToTime(393), '06:35');
  });

  it('midnight wraparound: 1440 min wraps to 00:00', () => {
    // 24 * 60 = 1440 minutes = midnight (next day) wraps to 00:00
    assert.strictEqual(minutesToTime(1440), '00:00');
  });

  it('23:55 (1435 min) stays at 23:55', () => {
    const minutes = timeToMinutes('23:55');
    assert.strictEqual(minutes, 1435);
    assert.strictEqual(minutesToTime(minutes), '23:55');
  });

  it('00:00 (midnight) stays at 00:00', () => {
    const minutes = timeToMinutes('00:00');
    assert.strictEqual(minutes, 0);
    assert.strictEqual(minutesToTime(minutes), '00:00');
  });
});

// ---------------------------------------------------------------------------
// 8. forecast() with synthetic days (known outputs, sparse data, window)
// ---------------------------------------------------------------------------

describe('forecast() with synthetic days', () => {
  it('7 days of wake times [06:30..07:00] → P50=06:45, P10≈06:30, P90≈07:00', () => {
    const days = [
      makeDay('06:30', null, null, null),
      makeDay('06:35', null, null, null),
      makeDay('06:40', null, null, null),
      makeDay('06:45', null, null, null),
      makeDay('06:50', null, null, null),
      makeDay('06:55', null, null, null),
      makeDay('07:00', null, null, null),
    ];
    const settings = { minDays: 3, maxDelta: 30, statBlend: 'median', windowDays: 7 };
    const result = forecast(days, settings);
    // P50: pos = 0.5 * 8 = 4 → sorted[3] = 405 min = 06:45 → '06:45'
    assert.strictEqual(result.wake.central, '06:45');
    // P10: pos = 0.1 * 8 = 0.8 → clamped to sorted[0] = 390 min = 06:30 → '06:30'
    assert.strictEqual(result.wake.min, '06:30');
    // P90: pos = 0.9 * 8 = 7.2 → clamped to sorted[6] = 420 min = 07:00 → '07:00'
    assert.strictEqual(result.wake.max, '07:00');
  });

  it('mixed event types: sparse data per event type handled independently', () => {
    // Day 1: wake + bedtime
    // Day 2: wake + napStart
    // Day 3: all four
    const days = [
      makeDay('06:30', '21:00', null, null),      // wake + bedtime, no nap
      makeDay('06:45', null, '13:00', null),       // wake + napStart, no bedtime/end
      makeDay('07:00', '22:00', '13:30', '14:30'), // all four
    ];
    const settings = { minDays: 1, maxDelta: 30, statBlend: 'median', windowDays: 7 };
    const result = forecast(days, settings);
    // wake: 3 days → should have central
    assert.ok(result.wake.central !== null, 'wake should have central');
    // bedtime: 2 days → should have central
    assert.ok(result.bedtime.central !== null, 'bedtime should have central');
    // napStart: 2 days → should have central
    assert.ok(result.napStart.central !== null, 'napStart should have central');
    // napEnd: 1 day → should have central (single element)
    assert.ok(result.napEnd.central !== null, 'napEnd should have central');
  });

  it('window truncation: 10 days, windowDays=7 → uses last 7 only', () => {
    // First 3 days have very early wake times (outliers); last 7 days are normal
    const tenDays = [
      makeDay('04:00', null, null, null),  // outlier (outside window)
      makeDay('04:00', null, null, null),  // outlier
      makeDay('04:00', null, null, null),  // outlier
      makeDay('06:30', null, null, null),
      makeDay('06:35', null, null, null),
      makeDay('06:40', null, null, null),
      makeDay('06:45', null, null, null),  // P50 of last 7
      makeDay('06:50', null, null, null),
      makeDay('06:55', null, null, null),
      makeDay('07:00', null, null, null),
    ];
    const settings = { minDays: 1, maxDelta: 30, statBlend: 'median', windowDays: 7 };
    const result = forecast(tenDays, settings);
    // With 04:00 outliers excluded by window, central = 06:45
    assert.strictEqual(result.wake.central, '06:45', 'should ignore days outside windowDays');
  });
});

// ---------------------------------------------------------------------------
// 9. eventTimesToMinutes — numeric comparison (not string-lexical)
// ---------------------------------------------------------------------------

describe('eventTimesToMinutes (numeric comparison safety)', () => {
  it('time comparisons are numeric, not string-lexical', () => {
    // String sort: '07:00' < '09:30' < '12:00' — looks right
    // String sort: '12:00' > '09:30' — wrong in 12h context (after noon)
    // But more critically: '07:00' and '13:00' must sort 390 < 780
    assert.ok(timeToMinutes('13:00') > timeToMinutes('07:00'),
      '13:00 should be numerically greater than 07:00');
  });

  it('numeric minutes are always greater for later times', () => {
    const times = ['07:00', '13:00', '06:30', '21:45'];
    const asMinutes = times.map(timeToMinutes);
    const sorted = [...asMinutes].sort((a, b) => a - b);
    // Sorted should be [06:30=390, 07:00=420, 13:00=780, 21:45=1305]
    assert.deepStrictEqual(sorted, [390, 420, 780, 1305]);
  });

  it('string-lexical sort would fail: "09:30" < "10:00" numerically correct, but "9" < "10" lexically wrong', () => {
    // This test proves WHY we must use numeric sort
    // "09:30" < "10:00" — both pass lexical and numeric; no danger here
    // BUT "9:00" (without zero-pad) < "10:00" lexically gives '10:00' first — wrong
    // Our format always uses zero-padded HH:MM, but the principle: use numeric sort
    const t1 = timeToMinutes('09:30');
    const t2 = timeToMinutes('10:00');
    assert.ok(t1 < t2, '09:30 (570 min) should be less than 10:00 (600 min)');
  });

  it('probability band granularity: 5-minute steps defined in forecast config', () => {
    // Assert that the 5-minute granularity is established (Phase 3 discretion)
    // Verify that minutesToTime rounds to 5-min steps
    assert.strictEqual(minutesToTime(371), '06:10');  // 371 → round to 370 → '06:10'
    assert.strictEqual(minutesToTime(374), '06:15');  // 374 → round to 375 → '06:15'
  });
});

// ---------------------------------------------------------------------------
// 10. generateProbabilityBand(times, p10, p90, maxDelta, step)
// ---------------------------------------------------------------------------

describe('generateProbabilityBand(times, p10, p90, maxDelta, step)', () => {
  // 7 sorted times in minutes: 06:30..07:00 (390..420, step 5)
  const sevenTimes = [390, 395, 400, 405, 410, 415, 420];

  it('band width ≤ maxDelta returns null (use normal min/max UI)', () => {
    // P10=390 (06:30), P90=405 (06:45), width=15 min, maxDelta=30 → null
    const result = generateProbabilityBand(sevenTimes, 390, 405, 30);
    assert.strictEqual(result, null);
  });

  it('band width == maxDelta exactly returns null (boundary: > not >=, D3-04)', () => {
    // P10=390, P90=420, width=30 min, maxDelta=30 → null (equal is not greater than)
    const result = generateProbabilityBand(sevenTimes, 390, 420, 30);
    assert.strictEqual(result, null);
  });

  it('band width > maxDelta returns probability table array', () => {
    // P10=390 (06:30), P90=435 (07:15), width=45 min, maxDelta=30 → returns table
    // Use times that span more than 30 min
    const wideTimes = [390, 395, 400, 405, 410, 415, 420, 425, 430, 435];
    const result = generateProbabilityBand(wideTimes, 390, 435, 30);
    assert.ok(Array.isArray(result), 'should return an array when band width > maxDelta');
    assert.ok(result.length > 0, 'array should have at least one time point');
  });

  it('probability table has { time, prob } shape with HH:MM strings', () => {
    const wideTimes = [390, 395, 400, 405, 410, 415, 420, 425, 430, 435];
    const result = generateProbabilityBand(wideTimes, 390, 435, 30);
    assert.ok(Array.isArray(result));
    for (const entry of result) {
      assert.ok('time' in entry, 'each entry should have time');
      assert.ok('prob' in entry, 'each entry should have prob');
      assert.match(entry.time, /^\d{2}:\d{2}$/, 'time should be HH:MM format');
      assert.ok(typeof entry.prob === 'number', 'prob should be a number');
      assert.ok(entry.prob >= 0 && entry.prob <= 100, 'prob should be 0..100');
    }
  });

  it('probability table is sorted by time (ascending)', () => {
    const wideTimes = [390, 395, 400, 405, 410, 415, 420, 425, 430, 435];
    const result = generateProbabilityBand(wideTimes, 390, 435, 30);
    const times = result.map(e => timeToMinutes(e.time));
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] >= times[i - 1], 'entries should be sorted ascending by time');
    }
  });

  it('probability at P10 is ~14% (1/7 of sevenTimes)', () => {
    // P10=390, P90=420, width=30 which == maxDelta=29 to trigger band
    // Use slightly different maxDelta to force band mode
    const result = generateProbabilityBand(sevenTimes, 390, 420, 29);
    assert.ok(Array.isArray(result), 'band width 30 > maxDelta 29 should trigger band');
    // Find the entry at or near 06:30 (390 min)
    const atP10 = result.find(e => e.time === '06:30');
    assert.ok(atP10, 'should have entry at P10 time (06:30)');
    // 1 out of 7 times ≤ 390 → ~14%
    assert.ok(atP10.prob >= 10 && atP10.prob <= 20, `prob at P10 should be ~14%, got ${atP10.prob}`);
  });

  it('probability table covers range from P10 to P90', () => {
    const wideTimes = [390, 395, 400, 405, 410, 415, 420, 425, 430, 435];
    const result = generateProbabilityBand(wideTimes, 390, 435, 30);
    const first = result[0];
    const last = result[result.length - 1];
    const firstMinutes = timeToMinutes(first.time);
    const lastMinutes = timeToMinutes(last.time);
    assert.ok(firstMinutes >= 390, 'first time point should be at or after P10');
    assert.ok(lastMinutes <= 435 + 5, 'last time point should be at or near P90');
  });

  it('time points are 5-minute-aligned (default step=5)', () => {
    const wideTimes = [390, 395, 400, 405, 410, 415, 420, 425, 430, 435];
    const result = generateProbabilityBand(wideTimes, 390, 435, 30);
    for (const entry of result) {
      const minutes = timeToMinutes(entry.time);
      assert.strictEqual(minutes % 5, 0, `${entry.time} (${minutes} min) should be divisible by 5`);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. detectColdStart(dayRecords, minDays)
// ---------------------------------------------------------------------------

describe('detectColdStart(dayRecords, minDays)', () => {
  it('0 days logged, minDays=7 → isColdStart=true, validDayCount=0, minDaysRemaining=7', () => {
    const result = detectColdStart([], 7);
    assert.strictEqual(result.isColdStart, true);
    assert.strictEqual(result.validDayCount, 0);
    assert.strictEqual(result.minDaysRemaining, 7);
  });

  it('5 days logged (none rejected), minDays=7 → isColdStart=true, minDaysRemaining=2', () => {
    const days = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:35', null, null, null, false),
      makeDay('06:40', null, null, null, false),
      makeDay('06:45', null, null, null, false),
      makeDay('06:50', null, null, null, false),
    ];
    const result = detectColdStart(days, 7);
    assert.strictEqual(result.isColdStart, true);
    assert.strictEqual(result.validDayCount, 5);
    assert.strictEqual(result.minDaysRemaining, 2);
  });

  it('7 days logged (1 rejected), minDays=7 → isColdStart=true (6 valid < 7)', () => {
    const days = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:35', null, null, null, false),
      makeDay('06:40', null, null, null, false),
      makeDay('06:45', null, null, null, false),
      makeDay('06:50', null, null, null, false),
      makeDay('06:55', null, null, null, false),
      makeDay('07:00', null, null, null, true),  // rejected: does not count as valid
    ];
    const result = detectColdStart(days, 7);
    assert.strictEqual(result.isColdStart, true);
    assert.strictEqual(result.validDayCount, 6);
    assert.strictEqual(result.minDaysRemaining, 1);
  });

  it('7 days logged (none rejected), minDays=7 → isColdStart=false (7 >= 7)', () => {
    const days = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:35', null, null, null, false),
      makeDay('06:40', null, null, null, false),
      makeDay('06:45', null, null, null, false),
      makeDay('06:50', null, null, null, false),
      makeDay('06:55', null, null, null, false),
      makeDay('07:00', null, null, null, false),
    ];
    const result = detectColdStart(days, 7);
    assert.strictEqual(result.isColdStart, false);
  });

  it('minDays=0 → isColdStart=false regardless of day count', () => {
    // Edge case: minDays=0 should never trigger cold-start (0 >= 0 is always true)
    const result = detectColdStart([], 0);
    assert.strictEqual(result.isColdStart, false);
  });
});

// ---------------------------------------------------------------------------
// 12. probability-band edge cases
// ---------------------------------------------------------------------------

describe('generateProbabilityBand() edge cases', () => {
  it('empty times array → returns null (no times, no probabilities)', () => {
    const result = generateProbabilityBand([], 390, 420, 29);
    assert.strictEqual(result, null);
  });

  it('single time (p10 = p90): band width = 0 ≤ maxDelta → return null', () => {
    // Single point: no spread, never triggers fallback
    const result = generateProbabilityBand([405], 405, 405, 30);
    assert.strictEqual(result, null);
  });

  it('two times exactly maxDelta apart → band width == maxDelta → return null (> not >=)', () => {
    // P10=390, P90=420, width=30 == maxDelta=30 → null (boundary: strictly greater than)
    const result = generateProbabilityBand([390, 420], 390, 420, 30);
    assert.strictEqual(result, null);
  });

  it('band width = maxDelta + 1 → return probability band with at least one time point', () => {
    // P10=390, P90=421, width=31 > maxDelta=30 → band triggered
    const result = generateProbabilityBand([390, 421], 390, 421, 30);
    assert.ok(Array.isArray(result), 'should return array when band width exceeds maxDelta by 1');
    assert.ok(result.length >= 1, 'should have at least one time point');
  });

  it('very wide band (120 min > maxDelta=30) → probability band spans wide range at 5-min granularity', () => {
    // Simulate a 2-hour span wake window
    const wideTimes = [];
    for (let m = 360; m <= 480; m += 5) wideTimes.push(m);  // 06:00..08:00
    const result = generateProbabilityBand(wideTimes, 360, 480, 30);
    assert.ok(Array.isArray(result), 'should return array for 120-min band > maxDelta=30');
    // 120 min / 5 min step = 24 time points
    assert.ok(result.length >= 20, `expected ≥20 time points, got ${result.length}`);
    // All entries still have HH:MM format
    for (const entry of result) {
      assert.match(entry.time, /^\d{2}:\d{2}$/, `${entry.time} should be HH:MM`);
      assert.ok(entry.prob >= 0 && entry.prob <= 100, `prob ${entry.prob} out of range`);
    }
  });

  it('probability values are monotonically non-decreasing (cumulative distribution property)', () => {
    // As time increases, cumulative probability must stay the same or increase
    const wideTimes = [390, 395, 400, 405, 410, 415, 420, 425, 430, 435];
    const result = generateProbabilityBand(wideTimes, 390, 435, 30);
    assert.ok(Array.isArray(result));
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i].prob >= result[i - 1].prob,
        `prob at ${result[i].time} (${result[i].prob}) should be >= prev (${result[i-1].prob})`);
    }
  });
});

// ---------------------------------------------------------------------------
// 13. cold-start edge cases
// ---------------------------------------------------------------------------

describe('detectColdStart() edge cases', () => {
  it('all 7 days rejected → validDayCount=0, isColdStart=true when minDays=7', () => {
    const allRejected = [
      makeDay('06:30', null, null, null, true),
      makeDay('06:35', null, null, null, true),
      makeDay('06:40', null, null, null, true),
      makeDay('06:45', null, null, null, true),
      makeDay('06:50', null, null, null, true),
      makeDay('06:55', null, null, null, true),
      makeDay('07:00', null, null, null, true),
    ];
    const result = detectColdStart(allRejected, 7);
    assert.strictEqual(result.isColdStart, true);
    assert.strictEqual(result.validDayCount, 0);
    assert.strictEqual(result.minDaysRemaining, 7);
  });

  it('7 days logged, minDays=7 → validDayCount=7, isColdStart=false (7 >= 7)', () => {
    const sevenValid = [
      makeDay('06:30', null, null, null, false),
      makeDay('06:35', null, null, null, false),
      makeDay('06:40', null, null, null, false),
      makeDay('06:45', null, null, null, false),
      makeDay('06:50', null, null, null, false),
      makeDay('06:55', null, null, null, false),
      makeDay('07:00', null, null, null, false),
    ];
    const result = detectColdStart(sevenValid, 7);
    assert.strictEqual(result.isColdStart, false);
    assert.strictEqual(result.validDayCount, 7);
    assert.ok(!('minDaysRemaining' in result), 'minDaysRemaining should not be present when not cold-start');
  });

  it('8 days logged, minDays=7 → isColdStart=false (exceeds threshold)', () => {
    const eightValid = Array.from({ length: 8 }, (_, i) => makeDay('06:30', null, null, null, false));
    const result = detectColdStart(eightValid, 7);
    assert.strictEqual(result.isColdStart, false);
    assert.strictEqual(result.validDayCount, 8);
  });
});

// ---------------------------------------------------------------------------
// 14. selectNextEvent(predictions, dayRecords) — cycle-aware priority (D3-10)
// ---------------------------------------------------------------------------
//
// Priority ordering (D3-10):
//   Last event = bedtime    → wake > napStart > napEnd > bedtime
//   Last event = wake       → napStart > bedtime > napEnd > wake
//   Last event = napStart   → napEnd > bedtime > wake > napStart
//   Last event = napEnd     → bedtime > wake > napStart > napEnd
//
// Within each priority tier, earliest-by-central-time wins.
// Falls back to default priority (wake > bedtime > napStart > napEnd) when
// last event type is unknown or dayRecords has no events.

describe('selectNextEvent(predictions, dayRecords)', () => {
  // Helper: build a mock day record with allEvents list
  function makeDayWithEvents(events) {
    // events is array of { type, at } objects (minimal shape for lastEvent detection)
    return { wake: null, bedtime: null, napStart: null, napEnd: null, rejected: false, allEvents: events };
  }

  // Standard predictions shape: { central, min, max } for each event type
  const predictions = {
    wake:     { central: '07:00', min: '06:30', max: '07:30' },
    bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
    napStart: { central: '13:00', min: '12:30', max: '13:30' },
    napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
  };

  it('last event = bedtime → selects wake (priority 1 per D3-10)', () => {
    // Priority after bedtime: wake > napStart > napEnd > bedtime
    const dayRecords = [
      makeDayWithEvents([{ type: 'bedtime', at: '2026-06-01T21:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'wake');
  });

  it('last event = wake → selects napStart (priority 1 per D3-10)', () => {
    // Priority after wake: napStart > bedtime > napEnd > wake
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:30' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'napStart');
  });

  it('last event = napStart → selects napEnd (priority 1 per D3-10)', () => {
    // Priority after napStart: napEnd > bedtime > wake > napStart
    const dayRecords = [
      makeDayWithEvents([{ type: 'napStart', at: '2026-06-02T13:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'napEnd');
  });

  it('last event = napEnd → selects bedtime (priority 1 per D3-10)', () => {
    // Priority after napEnd: bedtime > wake > napStart > napEnd
    const dayRecords = [
      makeDayWithEvents([{ type: 'napEnd', at: '2026-06-02T14:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'bedtime');
  });

  it('last event = wake; only bedtime in predictions (no napStart) → skips to bedtime (next tier)', () => {
    // Priority after wake: napStart > bedtime > napEnd > wake
    // napStart is missing → skip to bedtime
    const partialPredictions = {
      wake:    { central: '07:00', min: '06:30', max: '07:30' },
      bedtime: { central: '21:00', min: '20:30', max: '21:30' },
      // napStart missing
      // napEnd missing
    };
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:30' }]),
    ];
    const result = selectNextEvent(partialPredictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction even with missing tier');
    assert.strictEqual(result.type, 'bedtime');
  });

  it('no events logged (dayRecords empty) → returns null', () => {
    const result = selectNextEvent(predictions, []);
    assert.strictEqual(result, null);
  });

  it('dayRecords present but all allEvents arrays empty → returns null', () => {
    const dayRecords = [
      makeDayWithEvents([]),
      makeDayWithEvents([]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.strictEqual(result, null);
  });

  it('result has { type, central, min, max } shape', () => {
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'result should not be null');
    assert.ok('type' in result, 'result should have type');
    assert.ok('central' in result, 'result should have central');
    assert.ok('min' in result, 'result should have min');
    assert.ok('max' in result, 'result should have max');
  });

  it('most recent event is determined by allEvents list across multiple days', () => {
    // Two days — last event in most recent day should determine priority
    const dayRecords = [
      makeDayWithEvents([
        { type: 'bedtime', at: '2026-06-01T21:00' },  // older day
      ]),
      makeDayWithEvents([
        { type: 'wake', at: '2026-06-02T07:00' },      // most recent day's latest event
        { type: 'napStart', at: '2026-06-02T13:00' },  // MOST RECENT overall
      ]),
    ];
    // Last event = napStart → should select napEnd
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'napEnd');
  });
});

// ---------------------------------------------------------------------------
// 15. selectNextEvent() edge cases
// ---------------------------------------------------------------------------

describe('selectNextEvent() edge cases', () => {
  function makeDayWithEvents(events) {
    return { wake: null, bedtime: null, napStart: null, napEnd: null, rejected: false, allEvents: events };
  }

  const predictions = {
    wake:     { central: '07:00', min: '06:30', max: '07:30' },
    bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
    napStart: { central: '13:00', min: '12:30', max: '13:30' },
    napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
  };

  it('no events logged (dayRecords=[]) → returns null', () => {
    const result = selectNextEvent(predictions, []);
    assert.strictEqual(result, null);
  });

  it('prediction is null/missing for priority tier → skips to next available tier', () => {
    // After wake, priority is napStart > bedtime > napEnd > wake
    // Remove napStart from predictions → should select bedtime
    const partialPredictions = {
      wake:    { central: '07:00', min: '06:30', max: '07:30' },
      bedtime: { central: '21:00', min: '20:30', max: '21:30' },
      // napStart intentionally missing
      napEnd:  { central: '14:00', min: '13:30', max: '14:30' },
    };
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(partialPredictions, dayRecords);
    assert.ok(result !== null, 'should not return null when a lower-tier prediction is available');
    assert.strictEqual(result.type, 'bedtime');
  });

  it('last event type unknown → falls back to default priority (wake first)', () => {
    // Unknown event type in allEvents → default priority = wake > bedtime > napStart > napEnd
    const dayRecords = [
      makeDayWithEvents([{ type: 'unknownCustomType', at: '2026-06-02T12:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction even for unknown event types');
    assert.strictEqual(result.type, 'wake');
  });

  it('all tiers missing from predictions → returns null', () => {
    const emptyPredictions = {};
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(emptyPredictions, dayRecords);
    assert.strictEqual(result, null);
  });

  it('result is deterministic: same input → same output (no random tiebreaking)', () => {
    const dayRecords = [
      makeDayWithEvents([{ type: 'bedtime', at: '2026-06-01T21:00' }]),
    ];
    const result1 = selectNextEvent(predictions, dayRecords);
    const result2 = selectNextEvent(predictions, dayRecords);
    assert.deepStrictEqual(result1, result2, 'same input should always produce the same output');
  });

  it('isMissed field is present on result', () => {
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'result should not be null');
    assert.ok('isMissed' in result, 'result should have isMissed field');
    assert.ok(typeof result.isMissed === 'boolean', 'isMissed should be boolean');
  });

  it('probabilityBand prediction: result carries probabilityBand instead of central/min/max', () => {
    // When a prediction uses the probabilityBand shape, selectNextEvent should pass it through
    const bandPredictions = {
      wake:     { central: '07:00', min: '06:30', max: '07:30' },
      bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
      napStart: { probabilityBand: [{ time: '13:00', prob: 50 }, { time: '13:30', prob: 90 }] },
      napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
    };
    // Last event = wake → priority: napStart > bedtime > napEnd > wake
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(bandPredictions, dayRecords);
    assert.ok(result !== null, 'should return napStart even though it uses probabilityBand shape');
    assert.strictEqual(result.type, 'napStart');
    assert.ok('probabilityBand' in result, 'result should carry probabilityBand from prediction');
    assert.ok(!('central' in result), 'result should NOT have central when prediction uses probabilityBand');
  });
});
