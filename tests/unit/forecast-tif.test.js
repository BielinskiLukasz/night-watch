// tests/unit/forecast-tif.test.js
// Unit tests for trimmedMinMax() in js/lib/forecast-tif.js.
//
// Run: node --test tests/unit/forecast-tif.test.js
//
// Covers:
//   1. Basic no-trim (budget=0)
//   2. Standard 10% trim on 10 values
//   3. manualExcluded eats entire budget → no trim
//   4. manualExcluded reduces budget → partial trim
//   5. Empty array → null
//   6. 100% trimPct → all trimmed → null
//   7. manualExcluded > budget → budget clamped to 0
//   8. Asymmetric split: budget=3 (low=1, high=2)
//   9. Symmetric split: budget=4 (low=2, high=2)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trimmedMinMax, tifForecast } from '../../js/lib/forecast-tif.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a sorted array [start, start+step, ...] with `count` elements. */
function range(start, count, step = 10) {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('trimmedMinMax(values, trimPct, manualExcludedCount)', () => {

  // 1. No trim when budget rounds to 0 (N=5, trimPct=10 → floor(0.5)=0)
  //    trimmed=[400,410,420,430,440] (5 elements, odd), median=420
  it('budget=0 → no values removed', () => {
    const values = [400, 410, 420, 430, 440]; // sorted
    const result = trimmedMinMax(values, 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 440, median: 420 });
  });

  // 2. Standard 10% trim on 10 values
  //    N=10, budget=floor(10*10/100)-0=1, low=0, high=1 → slice(0, 9)=[400..480]
  //    trimmed=[400..480] (9 elements, odd), median=440
  it('10 values, trimPct=10, manualExcluded=0 → removes 1 from top', () => {
    const values = [400, 410, 420, 430, 440, 450, 460, 470, 480, 490]; // sorted
    const result = trimmedMinMax(values, 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 480, median: 440 });
  });

  // 3. manualExcluded eats entire budget → no auto-trim applied
  //    N=20, trimPct=10, manualExcluded=2 → budget=max(0, floor(20*10/100)-2)=max(0,0)=0
  //    trimmed=all 20 values, even, mid=10, median=(90+100)/2=95
  it('20 values, trimPct=10, manualExcluded=2 → budget exhausted, no trim', () => {
    const values = range(0, 20); // [0, 10, 20, ..., 190]
    const result = trimmedMinMax(values, 10, 2);
    assert.deepStrictEqual(result, { min: 0, max: 190, median: 95 });
  });

  // 4. manualExcluded reduces but does not zero out the budget
  //    N=20, trimPct=20, manualExcluded=2 → budget=max(0, floor(20*20/100)-2)=max(0,4-2)=2
  //    low=1, high=1 → slice(1, -1) = [10, ..., 180]
  //    trimmed=[10..180] (18 elements, even), mid=9, median=(90+100)/2=95
  it('20 values, trimPct=20, manualExcluded=2 → budget=2, removes 1 each end', () => {
    const values = range(0, 20); // [0, 10, ..., 190]
    const result = trimmedMinMax(values, 20, 2);
    assert.deepStrictEqual(result, { min: 10, max: 180, median: 95 });
  });

  // 5. Empty array → null
  it('empty array → null', () => {
    assert.strictEqual(trimmedMinMax([], 10, 0), null);
  });

  // 6. 100% trimPct on 5 values → budget=5, removes everything → null
  //    low=2, high=3 → slice(2, 2) = [] → null
  it('100% trimPct → all values trimmed → null', () => {
    const values = [400, 410, 420, 430, 440];
    assert.strictEqual(trimmedMinMax(values, 100, 0), null);
  });

  // 7. manualExcluded > computed budget → budget clamped to 0, no auto-trim
  //    N=10, trimPct=10 → raw=1; manualExcluded=5 → budget=max(0,1-5)=0
  //    trimmed=all 10 values [100..190], even, mid=5, median=(140+150)/2=145
  it('manualExcluded > raw budget → budget=0, no trim', () => {
    const values = range(100, 10); // [100, 110, ..., 190]
    const result = trimmedMinMax(values, 10, 5);
    assert.deepStrictEqual(result, { min: 100, max: 190, median: 145 });
  });

  // 8. Asymmetric split: budget=3 → low=floor(3/2)=1, high=ceil(3/2)=2
  //    Need N and trimPct such that floor(N * trimPct / 100) = 3
  //    N=10, trimPct=30 → floor(3)=3; manualExcluded=0
  //    values=[0,10,20,30,40,50,60,70,80,90]
  //    low=1, high=2 → slice(1, 8) = [10,20,30,40,50,60,70]
  //    7 elements (odd), mid=3, median=40
  it('budget=3 (asymmetric) → removes 1 from bottom, 2 from top', () => {
    const values = range(0, 10); // [0, 10, 20, ..., 90]
    const result = trimmedMinMax(values, 30, 0);
    assert.deepStrictEqual(result, { min: 10, max: 70, median: 40 });
  });

  // 9. Symmetric split: budget=4 → low=2, high=2
  //    N=10, trimPct=40 → floor(4)=4; manualExcluded=0
  //    values=[0,10,...,90], slice(2, 8) = [20,30,40,50,60,70]
  //    6 elements (even), mid=3, median=(40+50)/2=45
  it('budget=4 (symmetric) → removes 2 from each end', () => {
    const values = range(0, 10); // [0, 10, 20, ..., 90]
    const result = trimmedMinMax(values, 40, 0);
    assert.deepStrictEqual(result, { min: 20, max: 70, median: 45 });
  });

});

// ---------------------------------------------------------------------------
// TIF-15: per-window median — RED phase (failing until GREEN is implemented)
// ---------------------------------------------------------------------------

describe('trimmedMinMax — median (TIF-15)', () => {

  // 1. Odd-length trimmed array → middle element
  //    [400,410,420,430,440] no trim → trimmed=[400..440] (5 elements), median=420
  it('5 values, no trim → median is middle element (420)', () => {
    const result = trimmedMinMax([400, 410, 420, 430, 440], 0, 0);
    assert.deepStrictEqual(result, { min: 400, max: 440, median: 420 });
  });

  // 2. Even-length trimmed array → average of two middle elements
  //    [400,410,420,430] no trim → trimmed=[400..430] (4 elements), median=(410+420)/2=415
  it('4 values, no trim → median is average of two middle elements (415)', () => {
    const result = trimmedMinMax([400, 410, 420, 430], 0, 0);
    assert.deepStrictEqual(result, { min: 400, max: 430, median: 415 });
  });

  // 3. 10 values, 10% trim removes 1 from top → trimmed=[400..480] (9 elements), median=440
  //    This is the same trimmed array as existing test 2 — verify only the median field.
  it('10 values, trimPct=10 → trimmed array of 9; median=440', () => {
    const values = [400, 410, 420, 430, 440, 450, 460, 470, 480, 490];
    const result = trimmedMinMax(values, 10, 0);
    assert.ok(result !== null, 'result should not be null');
    assert.strictEqual(result.median, 440);
  });

  // 4. Empty array → null (median must not block null return)
  it('empty array → null (median does not affect null path)', () => {
    assert.strictEqual(trimmedMinMax([], 10, 0), null);
  });

  // 5. Single-element array → median = the only element
  it('single value → { min, max, median } all equal (400)', () => {
    const result = trimmedMinMax([400], 0, 0);
    assert.deepStrictEqual(result, { min: 400, max: 400, median: 400 });
  });

});

describe('buildPrediction — central from medians (TIF-15)', () => {

  // Use a 10-day fixture with consistent values.
  // Assert sourceWindows[0].median is an HH:MM string.
  it('tifForecast sourceWindows entries carry median as HH:MM string', () => {
    const HH_MM = /^\d{2}:\d{2}$/;

    // Build 10 uniform days so at least one sourceWindow is computable.
    function makeDay(wake, napStart, napEnd, bedtime) {
      return { wake, napStart, napEnd, bedtime, rejected: false, allEvents: [] };
    }

    const days = Array.from({ length: 10 }, () =>
      makeDay('07:30', '13:00', '14:30', '21:00'),
    );

    const settings = {
      minDays: 3,
      windowDays: 30,
      trimPct: 0,
      precisionTarget: 120,
      tifRollingDays: 10,
      forecastAlgorithm: 'tif',
    };

    const result = tifForecast(days, settings);
    assert.strictEqual(result.isColdStart, false, 'should not be cold-start');

    const sw = result.wake.sourceWindows;
    assert.ok(Array.isArray(sw) && sw.length >= 1, 'wake.sourceWindows must have at least 1 entry');

    // Every sourceWindow entry must carry a `median` field.
    for (const w of sw) {
      assert.ok(
        'median' in w,
        `sourceWindow "${w.label}" must have a median field`,
      );
      // median is either a valid HH:MM string or null
      assert.ok(
        w.median === null || HH_MM.test(w.median),
        `sourceWindow "${w.label}" median="${w.median}" must be HH:MM or null`,
      );
    }

    // For a uniform-values fixture, at least the first sourceWindow's median
    // must be a non-null HH:MM string.
    assert.ok(
      HH_MM.test(sw[0].median),
      `sourceWindows[0].median="${sw[0].median}" must be an HH:MM string`,
    );
  });

});
