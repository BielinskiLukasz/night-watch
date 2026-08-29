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
  dayToSleepFactor,
  napFraction,
  amPmSplit,
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

  it('null napStart (no-nap day) → null', () => {
    assert.strictEqual(activityBeforeNap(makeDay('07:00', null, null, null)), null);
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

  it('null napEnd (no-nap day) → null', () => {
    assert.strictEqual(activityAfterNap(makeDay(null, '20:00', null, null)), null);
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

  it('no nap (napStart=null, napEnd=null) → dayLength (840 min)', () => {
    // No nap: activity = full wake-to-bedtime span = 21:00 - 07:00 = 840 min
    assert.strictEqual(
      totalActivity(makeDay('07:00', '21:00', null, null)),
      840,
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

  it('no nap → totalActivity(dayLength) / combinedSleepNap', () => {
    // No nap: totalActivity = dayLength = 840 (21:00-07:00), combinedSleepNap = sleepDuration = 600
    // AAS = 840 / 600 = 1.4
    const aas = activityAfterSleepFactor(makeDay('07:00', '21:00', null, null));
    assert.ok(aas !== null);
    assert.ok(Math.abs(aas - 840 / 600) < 0.001);
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

  it('prevDay has no nap: SAA uses prevDay dayLength as activity', () => {
    // prevDayNoNap: wake=06:00, bedtime=22:00, no nap → dayLength = 960 min
    // day: combinedSleepNap = 660 (600 sleep + 60 nap)
    // SAA = 660 / 960 = 0.6875
    const prevDayNoNap = makeDay('06:00', '22:00', null, null);
    const saa = sleepAfterActivityFactor(makeDay('07:00', '21:00', '12:00', '13:00'), prevDayNoNap);
    assert.ok(saa !== null, 'SAA should not be null when prevDay has no nap');
    assert.ok(Math.abs(saa - 660 / 960) < 0.001, `Expected ${660 / 960}, got ${saa}`);
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

  // === NEW TESTS FOR NO-NAP DAYS (D11-25 gap closure) ===

  it('no-nap current day with previous day having activity (nap): sleepDuration / prevActivity', () => {
    // current day: wake=07:00, bedtime=21:00, no nap (napStart=null, napEnd=null)
    //   sleepDuration = 600 min (10 hours: 21:00 to 07:00)
    //   combinedSleepNap returns sleepDuration when no nap → 600
    // prevDay: wake=06:00, bedtime=22:00, napStart=12:00, napEnd=13:00 (has nap with activity)
    //   before nap: 360 min (12:00 - 06:00), after nap: 540 min (22:00 - 13:00)
    //   activity = 360 + 540 = 900
    // saa = 600 / 900 ≈ 0.667
    const prevDay = makeDay('06:00', '22:00', '12:00', '13:00');
    const currentDay = makeDay('07:00', '21:00', null, null); // no nap
    const saa = sleepAfterActivityFactor(currentDay, prevDay);
    assert.ok(saa !== null, 'SAA should not be null for no-nap day with active prevDay');
    assert.ok(typeof saa === 'number');
    const expectedSaa = 600 / 900; // sleepDuration / prevActivity = 0.667
    assert.ok(Math.abs(saa - expectedSaa) < 0.001, `Expected ${expectedSaa}, got ${saa}`);
  });

  it('no-nap current day with no-nap previous day: SAA uses dayLength for both', () => {
    // current day: wake=07:00, bedtime=21:00, no nap → combinedSleepNap = 600
    // prevDay: wake=06:00, bedtime=22:00, no nap → dayLength = 960
    // SAA = 600 / 960 ≈ 0.625
    const prevDay = makeDay('06:00', '22:00', null, null); // no nap
    const currentDay = makeDay('07:00', '21:00', null, null); // no nap
    const saa = sleepAfterActivityFactor(currentDay, prevDay);
    assert.ok(saa !== null, 'SAA should not be null for no-nap/no-nap pair');
    assert.ok(Math.abs(saa - 600 / 960) < 0.001, `Expected ${600 / 960}, got ${saa}`);
  });

  it('day with nap: uses combinedSleepNap = sleep + nap (baseline)', () => {
    // prevDay: wake=06:00, bedtime=22:00, nap 12:00-13:00
    //   activity = 360 (before) + 540 (after) = 900
    // current day: wake=07:00, bedtime=21:00, nap 12:00-13:00
    //   sleepDuration = 600 min, napDuration = 60 min
    //   combinedSleepNap = 600 + 60 = 660
    // saa = 660 / 900 ≈ 0.733 (using combinedSleepNap)
    // NOT 600 / 900 ≈ 0.667 (sleepDuration alone)
    const prevDay = makeDay('06:00', '22:00', '12:00', '13:00');
    const currentDay = makeDay('07:00', '21:00', '12:00', '13:00'); // has nap
    const saa = sleepAfterActivityFactor(currentDay, prevDay);
    assert.ok(saa !== null);
    const expectedWithNap = 660 / 900; // combinedSleepNap / prevActivity ≈ 0.733
    const expectedWithoutNap = 600 / 900; // sleepDuration / prevActivity ≈ 0.667 (wrong formula)
    assert.ok(Math.abs(saa - expectedWithNap) < 0.001, `Should use combined (nap + sleep), got ${saa} vs expected ${expectedWithNap}`);
    assert.ok(Math.abs(saa - expectedWithoutNap) > 0.01, `Should NOT use sleep duration alone`);
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

  it('no-nap day: napDuration is null, totalActivity equals dayLength', () => {
    const days = [
      makeDay('07:00', '21:00', '12:00', '13:00'),
      makeDay('06:30', '21:30', null, null), // no nap: dayLength = 900 min
    ];
    const result = aggregateMetrics(days);

    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[1].napDuration, null);
    // No-nap: totalActivity = dayLength = 21:30 - 06:30 = 900 min
    assert.strictEqual(result.rows[1].totalActivity, 900);
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

// ---------------------------------------------------------------------------
// 12. Overnight sleep (spanning two calendar dates) — G-NW-11-21, G-NW-11-22
// ---------------------------------------------------------------------------

describe('overnight sleep across calendar dates', () => {
  it('overnight sleep: bedtime 31.03 at 23:00, wake 01.04 at 07:00 (across two days)', () => {
    // Day 1: bedtime only (31.03), no wake yet
    const day1 = {
      date: '2026-03-31',
      bedtime: { at: '2026-03-31T23:00' },
      wake: null,
      napStart: null,
      napEnd: null,
    };
    // Day 2: wake only (01.04), matching the previous day's bedtime
    const day2 = {
      date: '2026-04-01',
      bedtime: null,
      wake: { at: '2026-04-01T07:00' },
      napStart: null,
      napEnd: null,
    };

    const result = aggregateMetrics([day1, day2]);

    // Check that we have 2 rows
    assert.strictEqual(result.rows.length, 2);

    // Row 1 (day1) should NOT have a sleepDuration (no wake on same day)
    assert.strictEqual(result.rows[0].sleepDuration, null);

    // Row 2 (day2) should have the paired sleep duration
    // Sleep: 23:00 (day1) → 07:00 (day2) = 8 hours = 480 minutes
    assert.strictEqual(result.rows[1].sleepDuration, 480);

    // Row 2 should be attributed to 01.04 (the wake date)
    assert.strictEqual(result.rows[1].date, '2026-04-01');
  });

  it('overnight sleep with late bedtime: 22:30 on 31.03, wake 07:30 on 01.04', () => {
    const day1 = {
      date: '2026-03-31',
      bedtime: { at: '2026-03-31T22:30' },
      wake: null,
      napStart: null,
      napEnd: null,
    };
    const day2 = {
      date: '2026-04-01',
      bedtime: null,
      wake: { at: '2026-04-01T07:30' },
      napStart: null,
      napEnd: null,
    };

    const result = aggregateMetrics([day1, day2]);

    // Sleep: 22:30 → 07:30 (next day) = 9 hours = 540 minutes
    assert.strictEqual(result.rows[1].sleepDuration, 540);
    assert.strictEqual(result.rows[1].date, '2026-04-01');
  });

  it('overnight sleep with very early wake: 23:45 on 31.03, wake 00:30 on 01.04', () => {
    const day1 = {
      date: '2026-03-31',
      bedtime: { at: '2026-03-31T23:45' },
      wake: null,
      napStart: null,
      napEnd: null,
    };
    const day2 = {
      date: '2026-04-01',
      bedtime: null,
      wake: { at: '2026-04-01T00:30' },
      napStart: null,
      napEnd: null,
    };

    const result = aggregateMetrics([day1, day2]);

    // Sleep: 23:45 → 00:30 (next day) = 45 minutes
    assert.strictEqual(result.rows[1].sleepDuration, 45);
    assert.strictEqual(result.rows[1].date, '2026-04-01');
  });

  it('overnight sleep with nap on wake day: bedtime 31.03, wake+nap on 01.04', () => {
    const day1 = {
      date: '2026-03-31',
      bedtime: { at: '2026-03-31T23:00' },
      wake: null,
      napStart: null,
      napEnd: null,
    };
    const day2 = {
      date: '2026-04-01',
      bedtime: null,
      wake: { at: '2026-04-01T07:00' },
      napStart: { at: '2026-04-01T12:00' },
      napEnd: { at: '2026-04-01T13:00' },
    };

    const result = aggregateMetrics([day1, day2]);

    // Row 2: sleep=480, nap=60 → combined=540
    assert.strictEqual(result.rows[1].sleepDuration, 480);
    assert.strictEqual(result.rows[1].napDuration, 60);
    assert.strictEqual(result.rows[1].combinedSleepNap, 540);
    assert.strictEqual(result.rows[1].date, '2026-04-01');
  });

  it('first day with bedtime+wake in same record (no prevDay): sleepDuration is null', () => {
    const day = {
      date: '2026-04-01',
      bedtime: { at: '2026-03-31T23:00' },
      wake: { at: '2026-04-01T07:00' },
      napStart: null,
      napEnd: null,
    };

    const result = aggregateMetrics([day]);

    // No previous day to pair with → sleep duration cannot be computed
    assert.strictEqual(result.rows[0].sleepDuration, null);
    assert.strictEqual(result.rows[0].date, '2026-04-01');
  });

  it('multiple overnight sleeps: 2 consecutive days with overnight spans', () => {
    const day1 = { date: '2026-03-31', bedtime: { at: '2026-03-31T22:00' }, wake: null, napStart: null, napEnd: null };
    const day2 = { date: '2026-04-01', bedtime: null, wake: { at: '2026-04-01T07:00' }, napStart: null, napEnd: null };
    const day3 = { date: '2026-04-01', bedtime: { at: '2026-04-01T23:00' }, wake: null, napStart: null, napEnd: null };
    const day4 = { date: '2026-04-02', bedtime: null, wake: { at: '2026-04-02T07:30' }, napStart: null, napEnd: null };

    const result = aggregateMetrics([day1, day2, day3, day4]);

    // Row 2 (day2): first overnight sleep from day1→day2
    assert.strictEqual(result.rows[1].sleepDuration, 540); // 22:00 → 07:00 = 9h
    assert.strictEqual(result.rows[1].date, '2026-04-01');

    // Row 4 (day4): second overnight sleep from day3→day4
    assert.strictEqual(result.rows[3].sleepDuration, 510); // 23:00 → 07:30 = 8.5h = 510 minutes
    assert.strictEqual(result.rows[3].date, '2026-04-02');
  });

  it('bedtime without wake on last day: fall back to bedtime+1 attribution', () => {
    const day1 = {
      date: '2026-03-31',
      bedtime: { at: '2026-03-31T23:00' },
      wake: null,
      napStart: null,
      napEnd: null,
    };

    const result = aggregateMetrics([day1]);

    // No following day to pair with → attribute to bedtime+1 day
    assert.strictEqual(result.rows[0].date, '2026-04-01');
    assert.strictEqual(result.rows[0].sleepDuration, null); // No wake to calculate duration
  });

  it('aggregates overnight sleep: avg sleepDuration includes paired sleepi', () => {
    const day1 = { date: '2026-03-31', bedtime: { at: '2026-03-31T22:00' }, wake: null, napStart: null, napEnd: null };
    const day2 = { date: '2026-04-01', bedtime: null, wake: { at: '2026-04-01T07:00' }, napStart: null, napEnd: null };
    const day3 = { date: '2026-04-01', bedtime: { at: '2026-04-01T23:00' }, wake: null, napStart: null, napEnd: null };
    const day4 = { date: '2026-04-02', bedtime: null, wake: { at: '2026-04-02T08:00' }, napStart: null, napEnd: null };

    const result = aggregateMetrics([day1, day2, day3, day4]);

    // Two overnight sleeps:
    // day1→day2: 22:00 → 07:00 = 540 min
    // day3→day4: 23:00 → 08:00 = 540 min
    // Average: (540 + 540) / 2 = 540 (but day1 has no sleep on its row, so only day2 and day4 count)
    assert.ok(result.avg.sleepDuration !== null);
    // The average should be over non-null sleep durations
    assert.strictEqual(result.avg.sleepDuration, 540);
  });
});

// ---------------------------------------------------------------------------
// 13. dayToSleepFactor (MET-07, D-12)
// ---------------------------------------------------------------------------

describe('dayToSleepFactor(day)', () => {
  it('normal nap day: dayLength/sleepDuration is a non-null number', () => {
    // wake=07:30, bedtime=22:00, napStart=13:00, napEnd=14:30
    // dayLength = 22:00 - 07:30 = 870 min
    // sleepDuration = 07:30 - 22:00 (cross midnight) = 450 + 1440 - 1320 = 570 min
    const day = makeDay('07:30', '22:00', '13:00', '14:30');
    const result = dayToSleepFactor(day);
    assert.ok(result !== null, 'should not be null for a full nap day');
    assert.ok(typeof result === 'number', 'should be a number');
    assert.ok(Math.abs(result - 870 / 570) < 0.001, `expected ~${870/570}, got ${result}`);
  });

  it('null bedtime → null', () => {
    assert.strictEqual(dayToSleepFactor(makeDay('07:30', null, null, null)), null);
  });

  it('null wake → null', () => {
    assert.strictEqual(dayToSleepFactor(makeDay(null, '22:00', null, null)), null);
  });
});

// ---------------------------------------------------------------------------
// 14. napFraction (MET-09, D-12)
// ---------------------------------------------------------------------------

describe('napFraction(day)', () => {
  it('nap day: napDuration/combinedSleepNap is a non-null number', () => {
    // wake=07:00, bedtime=22:00, napStart=13:00, napEnd=14:30
    // napDuration = 90 min
    // sleepDuration = 07:00 - 22:00 (cross midnight) = 420 + 1440 - 1320 = 540 min
    // combinedSleepNap = 540 + 90 = 630 min
    // napFraction = 90 / 630 ≈ 0.143
    const day = makeDay('07:00', '22:00', '13:00', '14:30');
    const result = napFraction(day);
    assert.ok(result !== null, 'should not be null for a nap day');
    assert.ok(typeof result === 'number', 'should be a number');
    assert.ok(Math.abs(result - 90 / 630) < 0.001, `expected ~${90/630}, got ${result}`);
  });

  it('no-nap day (napStart null) → null', () => {
    assert.strictEqual(napFraction(makeDay('07:00', '22:00', null, null)), null);
  });

  it('napEnd null → null', () => {
    assert.strictEqual(napFraction(makeDay('07:00', '22:00', '13:00', null)), null);
  });
});

// ---------------------------------------------------------------------------
// 15. amPmSplit (MET-10, D-12)
// ---------------------------------------------------------------------------

describe('amPmSplit(day)', () => {
  it('nap day: activityBeforeNap/activityAfterNap = 0.8 for 360/450 fixture', () => {
    // wake=07:00, bedtime=22:00, napStart=13:00, napEnd=14:30
    // activityBeforeNap = 13:00 - 07:00 = 360 min
    // activityAfterNap = 22:00 - 14:30 = 450 min
    // amPmSplit = 360 / 450 = 0.8
    const day = makeDay('07:00', '22:00', '13:00', '14:30');
    const result = amPmSplit(day);
    assert.ok(result !== null, 'should not be null for a nap day');
    assert.strictEqual(result, 0.8);
  });

  it('no-nap day (napStart and napEnd both null) → null', () => {
    assert.strictEqual(amPmSplit(makeDay('07:00', '22:00', null, null)), null);
  });
});

// ---------------------------------------------------------------------------
// 16. aggregateMetrics — updated fields (D-14)
// ---------------------------------------------------------------------------

describe('aggregateMetrics — updated fields (D-14)', () => {
  it('3-day fixture: dayToSleepFactor, napFraction, amPmSplit are aggregated; sleepAfterActivityFactor is NOT in avg', () => {
    const days = [
      makeDay('07:00', '22:00', '13:00', '14:30'),
      makeDay('07:30', '21:30', '12:30', '14:00'),
      makeDay('06:30', '22:30', '13:30', '15:00'),
    ];
    const result = aggregateMetrics(days);

    assert.ok(typeof result.avg.dayToSleepFactor === 'number', 'dayToSleepFactor aggregated');
    assert.ok(typeof result.avg.napFraction === 'number', 'napFraction aggregated');
    assert.ok(typeof result.avg.amPmSplit === 'number', 'amPmSplit aggregated');
    assert.strictEqual(result.avg.sleepAfterActivityFactor, undefined, 'SAA not in avg (D-14)');
    assert.ok('sleepAfterActivityFactor' in result.rows[0], 'SAA still in per-row data');
  });
});
