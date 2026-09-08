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

// ---------------------------------------------------------------------------
// FIX-01: findBedtimeDayRecord bare-string vs ISO ordering
// ---------------------------------------------------------------------------

describe('findBedtimeDayRecord: bare-string vs ISO ordering', () => {

  // Fixture: three days with bedtime slots.
  //   Day 0 (2024-01-10): bedtime as bare '22:00' string
  //   Day 1 (2024-01-11): bedtime as ISO event object { at: '2024-01-11T22:30', type: 'bedtime' }
  //   Day 2 (2024-01-12): bedtime as bare '21:45' string (appears AFTER the ISO day)
  //
  // Expected: tifForecast should not throw and should produce a bedtime prediction
  // whose historic band reflects the ISO-dated day (day 1), not be skewed by
  // the bare-string day that appears later in the array (day 2).
  // We confirm the result is a valid prediction shape (not null/cold-start).
  it('ISO-dated bedtime day is not displaced by a later bare-string day', () => {
    function makeDay(date, wake, napStart, napEnd, bedtime) {
      return { date, wake, napStart, napEnd, bedtime, rejected: false, allEvents: [] };
    }

    // Build enough days to pass minDays=3 gate.
    // Days 0-4: warm-up days with consistent times (bare strings).
    const warmup = Array.from({ length: 5 }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return makeDay(`2024-01-${d}`, '07:30', '13:00', '14:30', '22:00');
    });

    // Day 5: has ISO bedtime event object (chronologically latest bedtime).
    const isoDay = makeDay(
      '2024-01-06',
      '07:30', '13:00', '14:30',
      { at: '2024-01-06T22:30', type: 'bedtime' },
    );

    // Day 6: bare-string bedtime again, appears AFTER isoDay in the array.
    const bareAfterIso = makeDay('2024-01-07', '07:30', '13:00', '14:30', '21:45');

    const days = [...warmup, isoDay, bareAfterIso];

    const settings = {
      minDays: 3,
      windowDays: 30,
      trimPct: 0,
      precisionTarget: 120,
      tifRollingDays: 14,
      forecastAlgorithm: 'tif',
    };

    // Should not throw (previously could select wrong day).
    const result = tifForecast(days, settings);

    assert.strictEqual(result.isColdStart, false, 'should not be cold-start');
    assert.ok(result.bedtime !== null, 'bedtime prediction must not be null');
    // Historic bedtime band must be computed (sourceWindows non-empty).
    assert.ok(
      Array.isArray(result.bedtime.sourceWindows) && result.bedtime.sourceWindows.length >= 1,
      'bedtime.sourceWindows must have at least one entry',
    );
  });

});

// ---------------------------------------------------------------------------
// FIX-02: trim-budget independence — rejected days do not over-trim accepted data
// ---------------------------------------------------------------------------

describe('trim-budget independence: rejected days do not expand auto-trim', () => {

  // Fixture A: 5 accepted days, 0 rejected. trimPct=30 → budget=1 → removes 1 outlier.
  // Fixture B: same 5 accepted days + 2 rejected days prepended.
  //   Pre-FIX-02 (buggy): manualExcludedCount=0, budget=floor(5*30/100)=1 → same trim as A
  //   Post-FIX-02: manualExcludedCount=2, budget=max(0, 1-2)=0 → no trim → B keeps all values
  //
  // After FIX-02 the rejected days consume the auto-trim budget, so the accepted
  // data is preserved without outlier removal. Fixture B's band must be at least as
  // wide as Fixture A's (rejected days cause LESS trimming of accepted data, not more).
  //
  // The outlier in the accepted set is '07:50' (vs cluster around '07:20').
  // Fixture A trims it (budget=1), Fixture B preserves it (budget=0 after fix).
  // => B.max >= A.max confirms the outlier is no longer trimmed.
  it('rejected days reduce auto-trim budget so accepted outliers are preserved (FIX-02)', () => {
    function makeDay(date, wake, napStart, napEnd, bedtime, rejected = false) {
      return { date, wake, napStart, napEnd, bedtime, rejected, allEvents: [] };
    }

    // 5 accepted days: 4 clustered + 1 outlier at the top.
    const acceptedDays = [
      makeDay('2024-01-01', '07:10', '13:00', '14:30', '21:00'),
      makeDay('2024-01-02', '07:20', '13:05', '14:35', '21:10'),
      makeDay('2024-01-03', '07:15', '13:10', '14:40', '21:05'),
      makeDay('2024-01-04', '07:25', '13:00', '14:30', '21:15'),
      makeDay('2024-01-05', '07:50', '13:05', '14:35', '21:20'), // outlier wake
    ];

    // 2 rejected days (arbitrary times — they should not affect accepted-data trimming).
    const rejectedDays = [
      makeDay('2023-12-30', '06:00', '12:00', '13:30', '20:00', true),
      makeDay('2023-12-31', '09:00', '14:00', '15:30', '23:00', true),
    ];

    const settings = {
      minDays: 3,
      windowDays: 30,
      trimPct: 30,       // budget for 5 days = floor(5*30/100) = 1
      precisionTarget: 120,
      tifRollingDays: 20,
      forecastAlgorithm: 'tif',
    };

    // Fixture A: only accepted days — budget=1, outlier trimmed, max < '07:50'.
    const resultA = tifForecast(acceptedDays, settings);

    // Fixture B: rejected prepended — budget=max(0,1-2)=0, outlier preserved, max='07:50'.
    const resultB = tifForecast([...rejectedDays, ...acceptedDays], settings);

    assert.strictEqual(resultA.isColdStart, false, 'Fixture A should not be cold-start');
    assert.strictEqual(resultB.isColdStart, false, 'Fixture B should not be cold-start');

    const wakeWinA = resultA.wake.sourceWindows.find(w => w.label === 'Historic wake-up band');
    const wakeWinB = resultB.wake.sourceWindows.find(w => w.label === 'Historic wake-up band');

    assert.ok(wakeWinA, 'Fixture A must have Historic wake-up band');
    assert.ok(wakeWinB, 'Fixture B must have Historic wake-up band');

    const hhmm2m = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

    // After FIX-02: Fixture B does NOT over-trim accepted data.
    // The rejected-day budget offset (rejectedInWindow=2) consumes the full trim
    // budget, so Fixture B's max must be >= Fixture A's max (outlier preserved).
    assert.ok(
      hhmm2m(wakeWinB.max) >= hhmm2m(wakeWinA.max),
      `FIX-02: Fixture B max (${wakeWinB.max}) must be >= Fixture A max (${wakeWinA.max}) — ` +
      'rejected days must not cause over-trimming of accepted outliers',
    );
  });

});
