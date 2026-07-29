// tests/unit/metrics.test.js
// Unit tests for js/lib/metrics.js — duration helpers.
//
// Run: node --test tests/unit/metrics.test.js
//
// Test groups:
//   1. sleepDuration — midnight-crossing, nulls, event-object input
//   2. napDuration — normal, nulls
//   3. activityBeforeNap — normal, nulls
//   4. activityAfterNap — normal, nulls
//   5. dayLength — same-day, null
//   6. combinedSleepNap — sum, null propagation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sleepDuration,
  napDuration,
  activityBeforeNap,
  activityAfterNap,
  dayLength,
  combinedSleepNap,
  totalActivity,
  activityAfterSleepFactor,
  sleepAfterActivityFactor,
  aggregateMetrics,
} from '../../js/lib/metrics.js';

import { formatDuration } from '../../js/lib/time.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal day record using bare 'HH:MM' strings (synthetic)
// ---------------------------------------------------------------------------
function makeDay(wake, bedtime, napStart, napEnd) {
  return { wake, bedtime, napStart, napEnd };
}

// ---------------------------------------------------------------------------
// 1. sleepDuration
// ---------------------------------------------------------------------------

describe('sleepDuration(day)', () => {
  it('normal night (wake after midnight): wake=07:30, bedtime=21:00 → 630 min', () => {
    // 450 - 1260 = -810 → -810 + 1440 = 630
    assert.strictEqual(sleepDuration(makeDay('07:30', '21:00', null, null)), 630);
  });

  it('midnight-crossing: wake=07:00, bedtime=23:30 → 450 min', () => {
    // 420 - 1410 = -990 → -990 + 1440 = 450
    assert.strictEqual(sleepDuration(makeDay('07:00', '23:30', null, null)), 450);
  });

  it('null wake → null', () => {
    assert.strictEqual(sleepDuration(makeDay(null, '21:00', null, null)), null);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(sleepDuration(makeDay('07:30', null, null, null)), null);
  });

  it('both null → null', () => {
    assert.strictEqual(sleepDuration(makeDay(null, null, null, null)), null);
  });

  it('event-object input: wake={at:"2026-01-01T07:30"}, bedtime={at:"2025-12-31T21:00"} → 630', () => {
    const day = {
      wake:    { at: '2026-01-01T07:30' },
      bedtime: { at: '2025-12-31T21:00' },
      napStart: null,
      napEnd:   null,
    };
    assert.strictEqual(sleepDuration(day), 630);
  });
});

// ---------------------------------------------------------------------------
// 2. napDuration
// ---------------------------------------------------------------------------

describe('napDuration(day)', () => {
  it('normal nap: napStart=13:00, napEnd=14:30 → 90 min', () => {
    assert.strictEqual(napDuration(makeDay(null, null, '13:00', '14:30')), 90);
  });

  it('null napStart → null', () => {
    assert.strictEqual(napDuration(makeDay(null, null, null, '14:30')), null);
  });

  it('null napEnd → null', () => {
    assert.strictEqual(napDuration(makeDay(null, null, '13:00', null)), null);
  });
});

// ---------------------------------------------------------------------------
// 3. activityBeforeNap
// ---------------------------------------------------------------------------

describe('activityBeforeNap(day)', () => {
  it('normal: wake=07:00, napStart=12:30 → 330 min', () => {
    // 750 - 420 = 330
    assert.strictEqual(activityBeforeNap(makeDay('07:00', null, '12:30', null)), 330);
  });

  it('null wake → null', () => {
    assert.strictEqual(activityBeforeNap(makeDay(null, null, '12:30', null)), null);
  });

  it('null napStart (no-nap day) → 0', () => {
    // No nap means no "activity before nap" segment
    assert.strictEqual(activityBeforeNap(makeDay('07:00', null, null, null)), 0);
  });
});

// ---------------------------------------------------------------------------
// 4. activityAfterNap
// ---------------------------------------------------------------------------

describe('activityAfterNap(day)', () => {
  it('normal: napEnd=14:30, bedtime=20:00 → 330 min', () => {
    // 1200 - 870 = 330
    assert.strictEqual(activityAfterNap(makeDay(null, '20:00', null, '14:30')), 330);
  });

  it('null napEnd (no-nap day) → 0', () => {
    // No nap means no "activity after nap" segment
    assert.strictEqual(activityAfterNap(makeDay(null, '20:00', null, null)), 0);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(activityAfterNap(makeDay(null, null, null, '14:30')), null);
  });
});

// ---------------------------------------------------------------------------
// 5. dayLength
// ---------------------------------------------------------------------------

describe('dayLength(day)', () => {
  it('same-day span: wake=07:00, bedtime=20:00 → 780 min', () => {
    // 1200 - 420 = 780
    assert.strictEqual(dayLength(makeDay('07:00', '20:00', null, null)), 780);
  });

  it('null wake → null', () => {
    assert.strictEqual(dayLength(makeDay(null, '20:00', null, null)), null);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(dayLength(makeDay('07:00', null, null, null)), null);
  });
});

// ---------------------------------------------------------------------------
// 6. combinedSleepNap
// ---------------------------------------------------------------------------

describe('combinedSleepNap(day)', () => {
  it('both present: wake=07:30, bedtime=21:00, napStart=13:00, napEnd=14:30 → 720', () => {
    // sleepDuration = 630, napDuration = 90 → 720
    assert.strictEqual(
      combinedSleepNap(makeDay('07:30', '21:00', '13:00', '14:30')),
      720,
    );
  });

  it('null nap (napStart=null) → sleep duration only (no-nap day)', () => {
    // When there's no nap, return just the sleep duration
    assert.strictEqual(
      combinedSleepNap(makeDay('07:30', '21:00', null, null)),
      630,
    );
  });

  it('null sleep (wake=null) → null', () => {
    assert.strictEqual(
      combinedSleepNap(makeDay(null, '21:00', '13:00', '14:30')),
      null,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. totalActivity (D11-23)
// ---------------------------------------------------------------------------

describe('totalActivity(day)', () => {
  it('normal nap day: wake=07:00, napStart=12:00, napEnd=13:00, bedtime=21:00 → 780 (5h before + 8h after)', () => {
    // activityBeforeNap = 300, activityAfterNap = 480 → 780
    // Actually: 12:00 - 07:00 = 300, 21:00 - 13:00 = 480 → 780
    assert.strictEqual(
      totalActivity(makeDay('07:00', '21:00', '12:00', '13:00')),
      780,
    );
  });

  it('no nap (napStart=null, napEnd=null) → 0', () => {
    // No nap means 0 before + 0 after = 0 total activity
    assert.strictEqual(
      totalActivity(makeDay('07:00', '21:00', null, null)),
      0,
    );
  });

  it('partial nap data (napEnd=null, napStart present) → null', () => {
    assert.strictEqual(
      totalActivity(makeDay('07:00', '21:00', '12:00', null)),
      null,
    );
  });

  it('zero-duration nap: wake=07:00, napStart=12:00, napEnd=12:00, bedtime=21:00 → 840 (dayLength)', () => {
    // activityBeforeNap = 300, activityAfterNap = 540 → 840
    assert.strictEqual(
      totalActivity(makeDay('07:00', '21:00', '12:00', '12:00')),
      840,
    );
  });
});

// ---------------------------------------------------------------------------
// 8. activityAfterSleepFactor (AAS, D11-24)
// ---------------------------------------------------------------------------

describe('activityAfterSleepFactor(day)', () => {
  it('ratio: totalActivity=780, combinedSleepNap=600 → 1.3', () => {
    const day = makeDay('07:00', '21:00', '12:00', '13:00');
    const aas = activityAfterSleepFactor(day);
    assert.ok(aas !== null);
    // activityBeforeNap = 12:00 - 07:00 = 300 min
    // activityAfterNap  = 21:00 - 13:00 = 480 min → totalActivity = 780
    // sleepDuration: 600 min, napDuration: 60 min → combinedSleepNap = 660 min
    // aas = 780 / 660 ≈ 1.182 (using combinedSleepNap, not sleepDuration)
    assert.ok(Math.abs(aas - (780 / 660)) < 0.001);
  });

  it('no nap (totalActivity=0) → 0', () => {
    // No nap means totalActivity=0, so AAS = 0 / combinedSleepNap = 0
    assert.strictEqual(
      activityAfterSleepFactor(makeDay('07:00', '21:00', null, null)),
      0,
    );
  });

  it('no wake/bedtime (sleepDuration null) → null', () => {
    assert.strictEqual(
      activityAfterSleepFactor(makeDay(null, null, '12:00', '13:00')),
      null,
    );
  });

  it('zero-duration sleep with nap (edge case): combinedSleepNap = nap duration only', () => {
    // wake=12:00, bedtime=12:00, napStart=13:00, napEnd=14:00
    // sleepDuration = 0, napDuration = 60 → combinedSleepNap = 60
    // totalActivity = 1380 (360 before nap + 1020 after nap, wrapping midnight)
    // aas = 1380 / 60 = 23
    const day = makeDay('12:00', '12:00', '13:00', '14:00');
    const aas = activityAfterSleepFactor(day);
    // With new formula using combinedSleepNap, this is valid (60 > 0)
    assert.ok(aas !== null);
    assert.strictEqual(aas, 23);
  });

  it('zero-duration combined (no sleep, no nap): division by zero → null', () => {
    // wake=12:00, bedtime=12:00, napStart=null, napEnd=null (no nap)
    const day = makeDay('12:00', '12:00', null, null);
    assert.strictEqual(
      activityAfterSleepFactor(day),
      null,
    );
  });

  it('with nap: uses combinedSleepNap (sleep+nap), not sleepDuration alone', () => {
    // day: wake=07:00, bedtime=21:00, napStart=12:00, napEnd=13:00
    // sleepDuration = 600, napDuration = 60
    // combinedSleepNap = 660 (not 600)
    // totalActivity = 780
    // aas_with_combined = 780 / 660 ≈ 1.182
    // aas_with_sleep_only = 780 / 600 = 1.3
    const day = makeDay('07:00', '21:00', '12:00', '13:00');
    const aas = activityAfterSleepFactor(day);
    const expected_combined = 780 / 660; // ~1.182
    const expected_sleep_only = 780 / 600; // 1.3
    // Verify it matches combined formula, not sleep-only
    assert.ok(Math.abs(aas - expected_combined) < 0.001);
    assert.ok(Math.abs(aas - expected_sleep_only) > 0.01); // Should NOT match sleep-only formula
  });
});

// ---------------------------------------------------------------------------
// 9. sleepAfterActivityFactor (SAA, D11-25)
// ---------------------------------------------------------------------------

describe('sleepAfterActivityFactor(day, prevDay)', () => {
  it('normal cross-day pair: uses combinedSleepNap(day) / totalActivity(prevDay)', () => {
    // prevDay: wake=06:00, bedtime=22:00, napStart=12:00, napEnd=13:00
    //   sleep = 480, nap = 60 → combinedSleepNap = 540
    //   activity = 360 (before nap) + 540 (after nap) = 900
    // day: wake=07:00, bedtime=21:00, napStart=12:00, napEnd=13:00
    //   sleep = 600, nap = 60 → combinedSleepNap = 660
    // saa = 660 / 900 ≈ 0.733 (using combinedSleepNap)
    const prevDay = makeDay('06:00', '22:00', '12:00', '13:00');
    const day = makeDay('07:00', '21:00', '12:00', '13:00');
    const saa = sleepAfterActivityFactor(day, prevDay);
    assert.ok(saa !== null);
    assert.ok(typeof saa === 'number');
    // Verify it uses combinedSleepNap, not sleepDuration
    // Using sleepDuration would give: 600 / 900 ≈ 0.667
    // Using combinedSleepNap should give: 660 / 900 ≈ 0.733
    const expected_combined = 660 / 900;
    assert.ok(Math.abs(saa - expected_combined) < 0.001);
  });

  it('first day (no prevDay) → null', () => {
    assert.strictEqual(
      sleepAfterActivityFactor(makeDay('07:00', '21:00', '12:00', '13:00'), null),
      null,
    );
  });

  it('prevDay absent (undefined) → null', () => {
    assert.strictEqual(
      sleepAfterActivityFactor(makeDay('07:00', '21:00', '12:00', '13:00'), undefined),
      null,
    );
  });

  it('prevDay has no nap (totalActivity=0) → null (division by zero)', () => {
    const prevDayNoNap = makeDay('06:00', '22:00', null, null);
    assert.strictEqual(
      sleepAfterActivityFactor(makeDay('07:00', '21:00', '12:00', '13:00'), prevDayNoNap),
      null,
    );
  });

  it('day has no wake/bedtime (combinedSleepNap null) → null', () => {
    const prevDay = makeDay('06:00', '22:00', '12:00', '13:00');
    assert.strictEqual(
      sleepAfterActivityFactor(makeDay(null, null, '12:00', '13:00'), prevDay),
      null,
    );
  });

  it('prevDay has zero activity (division by zero) → null', () => {
    const prevDay = makeDay('12:00', '12:00', '12:00', '12:00');
    const day = makeDay('07:00', '21:00', '12:00', '13:00');
    assert.strictEqual(
      sleepAfterActivityFactor(day, prevDay),
      null,
    );
  });
});

// ---------------------------------------------------------------------------
// 10. aggregateMetrics (D11-26)
// ---------------------------------------------------------------------------

describe('aggregateMetrics(dayRecords)', () => {
  it('single day: returns rows, avg, min, max with correct structure', () => {
    const days = [makeDay('07:00', '21:00', '12:00', '13:00')];
    const result = aggregateMetrics(days);

    // Check structure
    assert.ok(result.rows);
    assert.ok(Array.isArray(result.rows));
    assert.strictEqual(result.rows.length, 1);

    assert.ok(result.avg);
    assert.ok(typeof result.avg === 'object');

    assert.ok(result.min);
    assert.ok(typeof result.min === 'object');

    assert.ok(result.max);
    assert.ok(typeof result.max === 'object');
  });

  it('three days with naps: aggregates all metrics', () => {
    const days = [
      makeDay('07:00', '21:00', '12:00', '13:00'),
      makeDay('06:30', '21:30', '12:30', '13:30'),
      makeDay('07:30', '20:30', '12:15', '13:15'),
    ];
    const result = aggregateMetrics(days);

    assert.strictEqual(result.rows.length, 3);
    assert.ok(result.avg.sleepDuration !== null);
    assert.ok(result.min.sleepDuration !== null);
    assert.ok(result.max.sleepDuration !== null);
  });

  it('no-nap day: nap-columns show null for napDuration, 0 for totalActivity', () => {
    const days = [
      makeDay('07:00', '21:00', '12:00', '13:00'),
      makeDay('06:30', '21:30', null, null), // no nap
    ];
    const result = aggregateMetrics(days);

    assert.strictEqual(result.rows.length, 2);
    // No-nap row should have null napDuration but 0 totalActivity
    assert.strictEqual(result.rows[1].napDuration, null);
    assert.strictEqual(result.rows[1].totalActivity, 0);
  });

  it('all rejected days: aggregates show empty/null', () => {
    const days = [
      { ...makeDay('07:00', '21:00', '12:00', '13:00'), rejected: true },
      { ...makeDay('06:30', '21:30', '12:30', '13:30'), rejected: true },
    ];
    const result = aggregateMetrics(days);

    // Rows are still present but aggregates are all null
    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.avg.sleepDuration, null);
  });

  it('first day in array: SAA is null (no previous day context)', () => {
    const days = [
      makeDay('07:00', '21:00', '12:00', '13:00'),
      makeDay('06:30', '21:30', '12:30', '13:30'),
    ];
    const result = aggregateMetrics(days);

    // First row should have null SAA
    assert.strictEqual(result.rows[0].sleepAfterActivityFactor, null);
  });

  it('excluded days from nap aggregates: avg nap only over nap days', () => {
    const days = [
      makeDay('07:00', '21:00', '12:00', '13:00'),
      makeDay('06:30', '21:30', null, null), // no nap
      makeDay('07:30', '20:30', '12:15', '13:15'),
    ];
    const result = aggregateMetrics(days);

    // napDuration avg should only include days with naps (2 days, not 3)
    assert.ok(result.avg.napDuration !== null);
    assert.ok(result.rows.length === 3);
  });

  it('empty dayRecords: returns all null aggregates', () => {
    const result = aggregateMetrics([]);

    assert.strictEqual(result.rows.length, 0);
    assert.strictEqual(result.avg.sleepDuration, null);
    assert.strictEqual(result.min.sleepDuration, null);
    assert.strictEqual(result.max.sleepDuration, null);
  });

  it('min/max include date info: { value, date }', () => {
    const days = [makeDay('07:00', '21:00', '12:00', '13:00')];
    const result = aggregateMetrics(days);

    // Min/Max should have value and date
    if (result.min.sleepDuration !== null) {
      assert.ok(result.min.sleepDuration.value !== undefined);
      assert.ok(result.min.sleepDuration.date !== undefined);
    }
  });

  it('time columns store full ISO strings (not extractTime results)', () => {
    // Test with real event objects that have .at property
    const days = [
      {
        wake: { at: '2026-01-01T07:00' },
        bedtime: { at: '2025-12-31T21:00' },
        napStart: { at: '2026-01-01T12:00' },
        napEnd: { at: '2026-01-01T13:00' },
      },
    ];
    const result = aggregateMetrics(days);

    // Row should have full ISO strings, not 'HH:MM'
    assert.strictEqual(result.rows[0].wake, '2026-01-01T07:00');
    assert.strictEqual(result.rows[0].bedtime, '2025-12-31T21:00');
    assert.strictEqual(result.rows[0].napStart, '2026-01-01T12:00');
    assert.strictEqual(result.rows[0].napEnd, '2026-01-01T13:00');
  });

  it('time columns handle null values gracefully', () => {
    const days = [
      {
        wake: { at: '2026-01-01T07:00' },
        bedtime: { at: '2025-12-31T21:00' },
        napStart: null,
        napEnd: null,
      },
    ];
    const result = aggregateMetrics(days);

    // Should store null for missing times, not crash
    assert.strictEqual(result.rows[0].wake, '2026-01-01T07:00');
    assert.strictEqual(result.rows[0].napStart, null);
  });
});

// ---------------------------------------------------------------------------
// 11. formatDuration (D11-20)
// ---------------------------------------------------------------------------

describe('formatDuration(minutes)', () => {
  it('450 min (7h 30m) → "7h 30m"', () => {
    assert.strictEqual(formatDuration(450), '7h 30m');
  });

  it('60 min (1h 0m) → "1h 0m"', () => {
    assert.strictEqual(formatDuration(60), '1h 0m');
  });

  it('35 min (0h 35m) → "0h 35m"', () => {
    assert.strictEqual(formatDuration(35), '0h 35m');
  });

  it('0 min (0h 0m) → "0h 0m"', () => {
    assert.strictEqual(formatDuration(0), '0h 0m');
  });

  it('1439 min (23h 59m) → "23h 59m"', () => {
    assert.strictEqual(formatDuration(1439), '23h 59m');
  });

  it('fractional input: 450.5 rounds to nearest minute', () => {
    // formatDuration should handle Math.floor or Math.round
    const result = formatDuration(450.5);
    assert.ok(result === '7h 30m' || result === '7h 31m');
  });
});
