// tests/unit/forecast-blend.test.js
// Unit tests for js/lib/forecast-blend.js — Algorithm C (Phase 25 Plan 01).
//
// Covers:
//   1. trimmedBand — byte-identical budget/split/median math to forecast-tif.js's
//      trimmedMinMax (mirrored test cases).
//   2. stabilityCheck — overlap-inside, no-overlap, touching-with-shrink,
//      overlap-outside-with-shrink cases (D-02).
//   3. blendForecast — cold-start gate, wake dual-model blend (overlap and
//      A2-unavailable-fallback), bedtime/napStart/napEnd explicit-null stubs.
//
// Run: node --test tests/unit/forecast-blend.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trimmedBand, stabilityCheck, blendForecast, wrapToDay, circularTrimmedBand, circularMean } from '../../js/lib/forecast-blend.js';
import { timeToMinutes, minutesToTime } from '../../js/lib/forecast.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a day record with bare 'HH:MM' string slots (unit-test synthetic data). */
function makeDay(wake, bedtime, napStart = null, napEnd = null, rejected = false) {
  return { wake, bedtime, napStart, napEnd, rejected };
}

/** Format integer minutes-since-midnight as 'HH:MM' (no rounding — test fixtures use 5-min-aligned inputs). */
function fmt(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Wrap-aware "is central inside [min, max]" check (WR-01 gap-closure, Plan 25-07).
 * Handles a band that itself crosses midnight (min > max, e.g. min='23:30',
 * max='00:30') by treating it as the union of [min, 1440) and [0, max].
 */
function centralWithinBand(minStr, maxStr, centralStr) {
  const min = timeToMinutes(minStr);
  const max = timeToMinutes(maxStr);
  const central = timeToMinutes(centralStr);
  return min <= max ? (central >= min && central <= max) : (central >= min || central <= max);
}

const BLEND_SETTINGS = Object.freeze({
  minDays: 7,
  blendWindowDays: 90,
  blendTrimPct: 25,
  blendShrinkage: 0.3,
});

/** 30 days, wake spread 06:00-06:55, bedtime fixed 20:30 — A1/A2 overlap fixture. */
function buildOverlapFixture(n = 30) {
  return Array.from({ length: n }, (_, i) => makeDay(fmt(360 + (i % 12) * 5), '20:30'));
}

/** 10 days, wake spread 06:00-06:40, no bedtime ever logged — A2-unavailable fixture. */
function buildNoBedtimeFixture(n = 10) {
  return Array.from({ length: n }, (_, i) => makeDay(fmt(360 + (i % 5) * 10), null));
}

// ---------------------------------------------------------------------------
// Fixture helpers — nap-start / nap-end (Plan 25-02, D-07..D-10)
// ---------------------------------------------------------------------------

/**
 * n days, wake fixed at 06:00 (constant anchor so Model 1's wake-anchored
 * gap band and Model 2's raw historic band land on the same numeric range —
 * avoids a degenerate single-point Model 1 that would otherwise collapse the
 * combined band). napStart = wake + 180min + a 12-value 0-55min jitter cycle
 * (real spread for both models). Optionally nulls the last day's wake to
 * exercise the Model-1-unavailable fallback (D-08).
 */
function buildNapStartFixture(n = 30, { lastWakeNull = false } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const wake = '06:00';
    const napStart = fmt(timeToMinutes(wake) + 180 + (i % 12) * 5);
    const isLast = i === n - 1;
    return makeDay(isLast && lastWakeNull ? null : wake, null, napStart, null);
  });
}

/**
 * n days, wake fixed at 06:00, napStart = wake + 180min + a 12-value jitter
 * cycle (optionally shifted by gapOffsetMinutes to build a distinguishable
 * historic cluster), napEnd = napStart + 90min + a 4-value jitter cycle.
 * Optionally nulls the last day's napStart to exercise the D-10
 * actual-else-predicted anchor fallback.
 */
function buildNapEndFixture(n = 30, { todayNapStartLogged = true, gapOffsetMinutes = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const wake = '06:00';
    const napStart = fmt(timeToMinutes(wake) + 180 + gapOffsetMinutes + (i % 12) * 5);
    const napEnd = fmt(timeToMinutes(napStart) + 90 + (i % 4) * 5);
    const isLast = i === n - 1;
    return makeDay(wake, '20:30', (isLast && !todayNapStartLogged) ? null : napStart, napEnd);
  });
}

// ---------------------------------------------------------------------------
// trimmedBand
// ---------------------------------------------------------------------------

describe('trimmedBand(sortedValues, trimPct, manualExcludedCount)', () => {
  it('budget=0 → no values removed', () => {
    const result = trimmedBand([400, 410, 420, 430, 440], 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 440, median: 420 });
  });

  it('10 values, trimPct=10 → removes 1 from top', () => {
    const result = trimmedBand([400, 410, 420, 430, 440, 450, 460, 470, 480, 490], 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 480, median: 440 });
  });

  it('empty array → null', () => {
    assert.strictEqual(trimmedBand([], 10, 0), null);
  });

  it('100% trimPct → all values trimmed → null', () => {
    assert.strictEqual(trimmedBand([400, 410, 420, 430, 440], 100, 0), null);
  });
});

// ---------------------------------------------------------------------------
// circularTrimmedBand — fixes CR-01's raw-sample root cause (Plan 25-09)
// ---------------------------------------------------------------------------

describe('circularTrimmedBand(rawValues, trimPct, manualExcludedCount)', () => {
  it('empty array → null', () => {
    assert.strictEqual(circularTrimmedBand([], 10, 0), null);
  });

  it('no wrap needed → degenerates to plain trimmedBand', () => {
    const result = circularTrimmedBand([400, 410, 420, 430, 440], 10, 0);
    assert.deepStrictEqual(result, { min: 400, max: 440, median: 420 });
  });

  it('CR-01 root-cause repro: 10 samples alternating 23:50/00:10 → circular median is midnight, not noon', () => {
    // Pre-fix comparison: calling the unchanged trimmedBand directly on the plain-sorted
    // version of this same raw array returns {min:10, max:1430, median:720} — median 720
    // (noon) is the exact wrong value 25-REVIEW.md's CR-01 section illustrates by hand.
    const preFixSorted = [10, 10, 10, 10, 10, 1430, 1430, 1430, 1430, 1430];
    assert.deepStrictEqual(trimmedBand(preFixSorted, 25, 0), { min: 10, max: 1430, median: 720 });

    const rawValues = [1430, 10, 1430, 10, 1430, 10, 1430, 10, 1430, 10];
    const result = circularTrimmedBand(rawValues, 25, 0);
    assert.deepStrictEqual(result, { min: 1430, max: 10, median: 0 });
  });

  it('order-independence: swapping which sample occupies index 0 produces the identical wrapped result', () => {
    const rawValues = [10, 1430, 10, 1430, 10, 1430, 10, 1430, 10, 1430];
    const result = circularTrimmedBand(rawValues, 25, 0);
    assert.deepStrictEqual(result, { min: 1430, max: 10, median: 0 });
  });
});

// ---------------------------------------------------------------------------
// circularMean — fixes CR-01's cross-model averaging root cause (Plan 25-09)
// ---------------------------------------------------------------------------

describe('circularMean(values)', () => {
  it('no wrap needed → matches plain arithmetic mean', () => {
    assert.strictEqual(circularMean([700, 710]), 705);
  });

  it('2 values symmetric across midnight → circular mean is midnight, not noon', () => {
    // Pre-fix, a plain arithmetic mean gives (1430+10)/2 = 720 (noon) — the exact
    // wrong-direction error 25-REVIEW.md's CR-01 names for combineModels'/wake's
    // own averaging.
    assert.strictEqual(circularMean([1430, 10]), 0);
  });

  it('order-independence: swapping the two values produces the identical result', () => {
    assert.strictEqual(circularMean([10, 1430]), 0);
  });

  it('3 values (bedtime-style group) generalizes with zero branching by count', () => {
    // Pre-fix, a plain arithmetic mean gives (1430+1430+20)/3 = 960 (16:00) — wildly wrong.
    assert.strictEqual(circularMean([1430, 1430, 20]), 0);
  });
});

// ---------------------------------------------------------------------------
// stabilityCheck
// ---------------------------------------------------------------------------

describe('stabilityCheck(intervals, central, shrinkage)', () => {
  it('overlapping, central inside intersection → unchanged', () => {
    const result = stabilityCheck([{ min: 390, max: 420 }, { min: 400, max: 430 }], 405, 0.3);
    assert.deepStrictEqual(result, { min: 400, max: 420, central: 405 });
  });

  it('no overlap → union envelope, central unchanged', () => {
    const result = stabilityCheck([{ min: 390, max: 400 }, { min: 410, max: 430 }], 395, 0.3);
    assert.deepStrictEqual(result, { min: 390, max: 430, central: 395 });
  });

  it('touching at a single point (inclusive overlap), central outside → shrinks toward center', () => {
    const result = stabilityCheck([{ min: 390, max: 400 }, { min: 400, max: 430 }], 380, 0.3);
    assert.deepStrictEqual(result, { min: 400, max: 400, central: 386 });
  });

  it('overlapping, central outside (above) → shrinks toward center', () => {
    const result = stabilityCheck([{ min: 390, max: 420 }, { min: 400, max: 440 }], 450, 0.5);
    assert.deepStrictEqual(result, { min: 400, max: 420, central: 430 });
  });

  describe('circular/wrapped intervals — CR-01 gap-closure (Plan 25-08)', () => {
    it('exact 25-REVIEW.md CR-01 repro, no true overlap: inverted model union-aligns past midnight', () => {
      // Pre-fix (plain Math.max/Math.min): {min:100, max:160, central:70} — central 70 < min 100,
      // the exact documented defect. Post-fix: modelA self-unwraps to [1400,1500], modelB aligns to
      // [1540,1600] — no true overlap once aligned, union [1400,160] wraps past midnight; central 70
      // reads inside [0,160] via the wrap-aware band.
      const result = stabilityCheck([{ min: 1400, max: 60 }, { min: 100, max: 160 }], 70, 0.3);
      assert.deepStrictEqual(result, { min: 1400, max: 160, central: 70 });
    });

    it('one inverted model, one normal model, TRUE overlap: aligned intersection matches the contained model', () => {
      // Pre-fix: Math.max(1420,10)=1420 > Math.min(40,30)=30 wrongly concludes no overlap, unions to
      // {min:10, max:40, central:20} (central still happens to sit inside this wrong, too-wide band —
      // only the band's width reveals the defect, hence the full-object deepStrictEqual). Post-fix:
      // both align onto one frame (modelA self-unwraps to [1420,1480]), correctly overlap in [10,30].
      const result = stabilityCheck([{ min: 1420, max: 40 }, { min: 10, max: 30 }], 20, 0.3);
      assert.deepStrictEqual(result, { min: 10, max: 30, central: 20 });
    });

    it('3 intervals (bedtime-style group), one inverted, TRUE overlap: fix generalizes to 3+ models', () => {
      // Pre-fix unions to {min:10, max:40, central:20} for the same reason as the 2-model case above.
      // Post-fix, all three align and correctly overlap; result matches the third, narrowest model —
      // proves zero branching by interval count (same Helly's-theorem equivalence as the non-circular case).
      const result = stabilityCheck(
        [{ min: 1420, max: 40 }, { min: 10, max: 30 }, { min: 15, max: 25 }],
        20,
        0.3
      );
      assert.deepStrictEqual(result, { min: 15, max: 25, central: 20 });
    });

    it('one inverted model, one normal model, TOUCHING at the wrap boundary: shrinks toward the single touch point', () => {
      // Pre-fix: Math.max(1430,20)=1430 > Math.min(20,50)=20 wrongly concludes no overlap, unions to
      // {min:20, max:50, central:1450} — central 1450 grossly outside [20,50], the starkest instance of
      // "prediction outside its own band". Post-fix: modelA self-unwraps to [1430,1460], modelB aligns to
      // [1460,1490] — correctly touch at 1460; central shrinks 0.7*1450 + 0.3*1460 = 1453, rewraps to 13.
      const result = stabilityCheck([{ min: 1430, max: 20 }, { min: 20, max: 50 }], 1450, 0.3);
      assert.deepStrictEqual(result, { min: 20, max: 20, central: 13 });
    });

    it('order-independence: swapping the two input intervals produces the identical wrapped result', () => {
      // Same two models as the first case above, swapped — proves the internal choice of which
      // interval anchors the alignment reference never changes the final wrapped output.
      const result = stabilityCheck([{ min: 100, max: 160 }, { min: 1400, max: 60 }], 70, 0.3);
      assert.deepStrictEqual(result, { min: 1400, max: 160, central: 70 });
    });
  });
});

// ---------------------------------------------------------------------------
// blendForecast
// ---------------------------------------------------------------------------

describe('blendForecast(dayRecords, settings, activityLog, isNoNapDay)', () => {
  it('cold-start gate: fewer than minDays valid records', () => {
    const dayRecords = Array.from({ length: 3 }, (_, i) => makeDay(fmt(360 + i * 5), '20:30'));
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.deepStrictEqual(result, {
      isColdStart: true,
      wake: null,
      bedtime: null,
      napStart: null,
      napEnd: null,
    });
  });

  it('wake, A1+A2 overlap: returns a valid non-null HH:MM band', () => {
    const dayRecords = buildOverlapFixture(30);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(result.isColdStart, false);
    assert.strictEqual(typeof result.wake.central, 'string');
    assert.strictEqual(typeof result.wake.min, 'string');
    assert.strictEqual(typeof result.wake.max, 'string');
    assert.ok(result.wake.min <= result.wake.central, `min ${result.wake.min} should be <= central ${result.wake.central}`);
    assert.ok(result.wake.central <= result.wake.max, `central ${result.wake.central} should be <= max ${result.wake.max}`);
  });

  it('wake, A2-unavailable (no bedtime ever logged): falls back to A1 alone, no stability check', () => {
    const dayRecords = buildNoBedtimeFixture(10);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    const wakeMinutesSorted = dayRecords.map(d => timeToMinutes(d.wake)).sort((a, b) => a - b);
    const expectedA1 = trimmedBand(wakeMinutesSorted, BLEND_SETTINGS.blendTrimPct, 0);
    assert.strictEqual(result.wake.central, minutesToTime(expectedA1.median));
    assert.strictEqual(result.wake.min, minutesToTime(expectedA1.min));
    assert.strictEqual(result.wake.max, minutesToTime(expectedA1.max));
  });

});

// ---------------------------------------------------------------------------
// blendForecast — nap-start (D-07/D-08)
// ---------------------------------------------------------------------------

describe('blendForecast — nap-start (D-07/D-08)', () => {
  it('both models available: returns a valid non-null HH:MM band', () => {
    const dayRecords = buildNapStartFixture(30);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(typeof result.napStart.central, 'string');
    assert.strictEqual(typeof result.napStart.min, 'string');
    assert.strictEqual(typeof result.napStart.max, 'string');
    assert.ok(result.napStart.min <= result.napStart.central,
      `min ${result.napStart.min} should be <= central ${result.napStart.central}`);
    assert.ok(result.napStart.central <= result.napStart.max,
      `central ${result.napStart.central} should be <= max ${result.napStart.max}`);
  });

  it("Model 1 unavailable (today's wake not logged): falls back to Model 2 (raw historic napStart band) alone", () => {
    const dayRecords = buildNapStartFixture(30, { lastWakeNull: true });
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    const napStartTimesSorted = dayRecords
      .filter(d => !d.rejected)
      .map(d => d.napStart)
      .filter(t => t != null)
      .map(timeToMinutes)
      .sort((a, b) => a - b);
    const expectedModel2 = trimmedBand(napStartTimesSorted, BLEND_SETTINGS.blendTrimPct, 0);
    assert.strictEqual(result.napStart.central, minutesToTime(expectedModel2.median));
    assert.strictEqual(result.napStart.min, minutesToTime(expectedModel2.min));
    assert.strictEqual(result.napStart.max, minutesToTime(expectedModel2.max));
  });
});

// ---------------------------------------------------------------------------
// blendForecast — nap-end (D-09/D-10)
// ---------------------------------------------------------------------------

describe('blendForecast — nap-end (D-09/D-10)', () => {
  it('both models available: returns a valid non-null HH:MM band', () => {
    const dayRecords = buildNapEndFixture(30);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(typeof result.napEnd.central, 'string');
    assert.strictEqual(typeof result.napEnd.min, 'string');
    assert.strictEqual(typeof result.napEnd.max, 'string');
    assert.ok(result.napEnd.min <= result.napEnd.central,
      `min ${result.napEnd.min} should be <= central ${result.napEnd.central}`);
    assert.ok(result.napEnd.central <= result.napEnd.max,
      `central ${result.napEnd.central} should be <= max ${result.napEnd.max}`);
  });

  it('Model 2 anchor precedence (D-10): actual logged nap-start vs predicted fallback produce different napEnd.central', () => {
    const fixtureActual    = buildNapEndFixture(30, { todayNapStartLogged: true,  gapOffsetMinutes: 0 });
    const fixturePredicted = buildNapEndFixture(30, { todayNapStartLogged: false, gapOffsetMinutes: 120 });
    const resultActual    = blendForecast(fixtureActual, BLEND_SETTINGS);
    const resultPredicted = blendForecast(fixturePredicted, BLEND_SETTINGS);
    assert.notStrictEqual(resultActual.napEnd.central, resultPredicted.napEnd.central);
  });

  it('both models unavailable (no wake or nap-start ever logged): returns explicit null triple, no throw', () => {
    const dayRecords = Array.from({ length: 10 }, () => makeDay(null, '20:30', null, null));
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.deepStrictEqual(result.napEnd, { central: null, min: null, max: null });
  });
});

// ---------------------------------------------------------------------------
// Fixture helpers — WR-01 midnight-wrap normalization (gap-closure Plan 25-07)
// ---------------------------------------------------------------------------

/**
 * n days, every day (including today) has wake fixed at '23:00' (1380 raw
 * minutes) and napStart = wake + 60min + a 12-value 0-55min jitter cycle
 * (raw sums 1440-1495 — fmt()'s built-in % 24 hour wrap stores these as
 * '00:00'-'00:55', a realistic "napped just after midnight" data set).
 * Exercises napStartModel1's wake-anchored gap band, which must be wrapped
 * into [0,1440) before combining against napStartModel2's already-wrapped
 * historic band (WR-01).
 */
function buildLateWakeNapStartFixture(n = 30) {
  return Array.from({ length: n }, (_, i) => {
    const wake = '23:00';
    const napStart = fmt(timeToMinutes(wake) + 60 + (i % 12) * 5);
    return makeDay(wake, null, napStart, null);
  });
}

/**
 * n days, every day has wake fixed at '22:00' (1320 raw minutes), napStart =
 * wake + 90min + a 12-value jitter cycle (raw 1410-1465, so roughly half the
 * jitter cycle wraps past midnight and half does not), napEnd = that day's
 * (already-wrapped) napStart + 90min + a 4-value jitter cycle (duration
 * 90-105, always a positive elapsed time). The last day's napStart is then
 * overridden to the literal '00:00' (today's actual logged nap-start, small
 * and already in [0,1440) — napEndModel2's D-10 "actual" precedence input)
 * while wake stays '22:00' (still feeds napEndModel1's wakeAnchorMin).
 * Exercises napEndModel1's fully chained wake-anchored gap+duration sum,
 * which must be wrapped into [0,1440) before combining against napEndModel2
 * (WR-01). '00:00' (rather than another small time) is chosen deliberately:
 * it keeps napEndModel2's band aligned closely enough with napEndModel1's
 * wrapped band that the post-fix central lands inside the reported
 * intersection without relying on stabilityCheck's partial (0.3) shrinkage
 * to close a wider gap — shrinkage pulls central only part-way toward the
 * intersection's center, so it is not guaranteed to land inside for every
 * anchor choice, only for one close enough to the historic distribution.
 */
function buildLateWakeNapEndFixture(n = 30) {
  const days = Array.from({ length: n }, (_, i) => {
    const wake = '22:00';
    const napStart = fmt(timeToMinutes(wake) + 90 + (i % 12) * 5);
    const napEnd = fmt(timeToMinutes(napStart) + 90 + (i % 4) * 5);
    return makeDay(wake, null, napStart, napEnd);
  });
  days[days.length - 1] = { ...days[days.length - 1], napStart: '00:00' };
  return days;
}

// ---------------------------------------------------------------------------
// blendForecast — WR-01 midnight-wrap normalization (gap-closure Plan 25-07)
// ---------------------------------------------------------------------------

describe('blendForecast — WR-01 midnight-wrap normalization (gap-closure Plan 25-07)', () => {
  describe('wrapToDay(m) — direct [0,1440) boundary contract', () => {
    it('wrapToDay(0) === 0', () => {
      assert.strictEqual(wrapToDay(0), 0);
    });

    it('wrapToDay(1439) === 1439', () => {
      assert.strictEqual(wrapToDay(1439), 1439);
    });

    it('wrapToDay(1440) === 0 — the exact midnight-rollover boundary', () => {
      assert.strictEqual(wrapToDay(1440), 0);
    });

    it('wrapToDay(1441) === 1 — one step past the boundary', () => {
      assert.strictEqual(wrapToDay(1441), 1);
    });

    it('wrapToDay(2880) === 0 — two full days', () => {
      assert.strictEqual(wrapToDay(2880), 0);
    });

    it('wrapToDay(-5) === 1435 — defensive negative-input wrap', () => {
      assert.strictEqual(wrapToDay(-5), 1435);
    });
  });

  it('napStart, late wake crossing midnight: central lies within the reported band (not a false non-overlap union)', () => {
    const dayRecords = buildLateWakeNapStartFixture(30);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(
      centralWithinBand(result.napStart.min, result.napStart.max, result.napStart.central),
      true,
      `napStart.central ${result.napStart.central} should lie within [${result.napStart.min}, ${result.napStart.max}]`
    );
  });

  it('napEnd, late wake crossing midnight: central lies within the reported band (not a false non-overlap union)', () => {
    const dayRecords = buildLateWakeNapEndFixture(30);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(
      centralWithinBand(result.napEnd.min, result.napEnd.max, result.napEnd.central),
      true,
      `napEnd.central ${result.napEnd.central} should lie within [${result.napEnd.min}, ${result.napEnd.max}]`
    );
  });
});

// ---------------------------------------------------------------------------
// Fixture helpers — bedtime (Plan 25-02, D-03..D-06) + full integration
// ---------------------------------------------------------------------------

/**
 * n days, fully populated (wake spread 06:00-06:55, bedtime fixed 20:30,
 * napStart = wake+180min, napEnd = napStart+90min) — every day is a nap day.
 * Used for bedtime's three-model happy path and the substitute-unavailable
 * degradation case (no no-nap-day records exist at all).
 */
function buildFullDayFixture(n) {
  return Array.from({ length: n }, (_, i) => {
    const wake = fmt(360 + (i % 12) * 5);
    const napStart = fmt(timeToMinutes(wake) + 180);
    const napEnd = fmt(timeToMinutes(napStart) + 90);
    return makeDay(wake, '20:30', napStart, napEnd);
  });
}

/** buildFullDayFixture(n) with today's (last day's) wake and napEnd nulled — D-03/D-10 anchor-fallback fixture. */
function buildFullDayFixtureTodayThin(n) {
  const days = buildFullDayFixture(n);
  const last = days[days.length - 1];
  days[days.length - 1] = { ...last, wake: null, napEnd: null };
  return days;
}

/**
 * 10 historic nap days with a late bedtime cluster (~23:30-23:50 — the range
 * an AA-anchored band would land in) followed by 20 no-nap days (today
 * included) with an earlier bedtime cluster (~21:00-21:20) — D-05's
 * no-nap-day substitution fixture. The nap-day cluster exists specifically so
 * a regression that ignores isNoNapDay and computes the AA-band anyway would
 * be caught (its median would land far outside the no-nap cluster).
 */
function buildBedtimeSubstitutionFixture() {
  const days = [];
  for (let i = 0; i < 10; i++) {
    const wake = fmt(360 + (i % 5) * 5);
    const napStart = fmt(timeToMinutes(wake) + 180);
    const napEnd = fmt(timeToMinutes(napStart) + 90);
    const bedtime = fmt(1410 + (i % 5) * 5);
    days.push(makeDay(wake, bedtime, napStart, napEnd));
  }
  for (let i = 0; i < 20; i++) {
    const wake = fmt(360 + (i % 5) * 5);
    const bedtime = fmt(1260 + (i % 5) * 5);
    days.push(makeDay(wake, bedtime, null, null));
  }
  return days;
}

// ---------------------------------------------------------------------------
// blendForecast — bedtime (D-03..D-06)
// ---------------------------------------------------------------------------

describe('blendForecast — bedtime (D-03..D-06)', () => {
  it('all three models available, nap day: returns a valid non-null HH:MM band', () => {
    const dayRecords = buildFullDayFixture(30);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(typeof result.bedtime.central, 'string');
    assert.strictEqual(typeof result.bedtime.min, 'string');
    assert.strictEqual(typeof result.bedtime.max, 'string');
  });

  it('no-nap-day substitution (D-05): Model 3 reflects the no-nap-day bedtime cluster, not the AA-band', () => {
    const dayRecords = buildBedtimeSubstitutionFixture();
    const result = blendForecast(dayRecords, BLEND_SETTINGS, {}, true);
    const centralMinutes = timeToMinutes(result.bedtime.central);
    assert.ok(centralMinutes > 1200 && centralMinutes < 1350,
      `expected central within the no-nap cluster (~1260-1290 min), got ${result.bedtime.central} (${centralMinutes} min) — a value near 1410-1430 would indicate the AA-band leaked in despite isNoNapDay=true`);
  });

  it('no-nap-day substitute unavailable (< minDays no-nap-day records exist): degrades gracefully, no throw', () => {
    // Every day is a nap day — no no-nap-day records exist for the D-05 substitute band.
    const dayRecords = buildFullDayFixture(30);
    assert.doesNotThrow(() => blendForecast(dayRecords, BLEND_SETTINGS, {}, true));
    const result = blendForecast(dayRecords, BLEND_SETTINGS, {}, true);
    assert.strictEqual(typeof result.bedtime.central, 'string');
    assert.strictEqual(typeof result.bedtime.min, 'string');
    assert.strictEqual(typeof result.bedtime.max, 'string');
  });

  it("Model 2/3 anchor fallback (today's wake and nap-end not logged): falls back to predicted anchors, no throw", () => {
    const dayRecords = buildFullDayFixtureTodayThin(30);
    assert.doesNotThrow(() => blendForecast(dayRecords, BLEND_SETTINGS));
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(typeof result.bedtime.central, 'string');
    assert.strictEqual(typeof result.bedtime.min, 'string');
    assert.strictEqual(typeof result.bedtime.max, 'string');
  });
});

// ---------------------------------------------------------------------------
// blendForecast — full four-event integration (PRED-13/PRED-17)
// ---------------------------------------------------------------------------

describe('blendForecast — full four-event integration (PRED-13/PRED-17)', () => {
  it('rich fixture produces non-null HH:MM triples for all four events — no stub survives', () => {
    const dayRecords = buildFullDayFixture(100);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    for (const key of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      assert.strictEqual(typeof result[key].central, 'string', `${key}.central should be a string`);
      assert.strictEqual(typeof result[key].min, 'string', `${key}.min should be a string`);
      assert.strictEqual(typeof result[key].max, 'string', `${key}.max should be a string`);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture helpers — CR-01 root-cause circular-median gap-closure (Plan 25-09)
// ---------------------------------------------------------------------------

/**
 * n days, wake alternating '23:55'/'00:05' (i%2===0 -> '23:55' else '00:05'),
 * bedtime always null (A2 unavailable, forcing the A1-alone fallback that
 * never calls stabilityCheck/combineModels) — isolates circularTrimmedBand's
 * fix on a1Times alone, with zero dependency on Task 2's circularMean fix.
 */
function buildMidnightWakeNoBedtimeFixture(n = 20) {
  return Array.from({ length: n }, (_, i) => makeDay(i % 2 === 0 ? '23:55' : '00:05', null));
}

/**
 * n days, wake fixed '06:00' except the LAST day's wake set to null (forces
 * wakeAnchorMin to be null, so napStartModel1 stays null regardless of
 * napGaps — mirrors the existing "Model 1 unavailable" test's exact
 * technique), napStart alternating '23:50'/'00:10' for ALL n days including
 * today, bedtime/napEnd always null.
 */
function buildMidnightNapStartFixture(n = 20) {
  return Array.from({ length: n }, (_, i) => {
    const isLast = i === n - 1;
    return makeDay(isLast ? null : '06:00', null, i % 2 === 0 ? '23:50' : '00:10', null);
  });
}

/**
 * n days, wake fixed '06:00' for ALL days (including today), bedtime
 * alternating '23:50'/'00:10' (i%2===0 -> '23:50' else '00:10'), napStart/
 * napEnd always null — the EXACT shape of 25-REVIEW.md's own CR-01
 * reproduction fixture.
 */
function buildMidnightBedtimeFixture(n = 20) {
  return Array.from({ length: n }, (_, i) => makeDay('06:00', i % 2 === 0 ? '23:50' : '00:10', null, null));
}

// ---------------------------------------------------------------------------
// blendForecast — CR-01 root-cause circular-median gap-closure (Plan 25-09)
// ---------------------------------------------------------------------------

describe('blendForecast — CR-01 root-cause circular-median gap-closure (Plan 25-09)', () => {
  it('wake, A1-alone: circular-median fix applies to a1Times, not just bedtimeTimes', () => {
    const dayRecords = buildMidnightWakeNoBedtimeFixture(20);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.deepStrictEqual(result.wake, { central: '23:55', min: '23:55', max: '00:05' });
  });

  it('napStart, Model-2-alone: circular-median fix applies to napStartTimes, not just bedtimeTimes', () => {
    const dayRecords = buildMidnightNapStartFixture(20);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.deepStrictEqual(result.napStart, { central: '23:50', min: '23:50', max: '00:10' });
  });

  it('bedtime, 2-model default path: the exact 25-REVIEW.md repro, central lies within its own reported band', () => {
    const dayRecords = buildMidnightBedtimeFixture(20);
    const result = blendForecast(dayRecords, BLEND_SETTINGS);
    assert.strictEqual(typeof result.bedtime.central, 'string');
    assert.strictEqual(
      centralWithinBand(result.bedtime.min, result.bedtime.max, result.bedtime.central),
      true,
      `bedtime.central ${result.bedtime.central} should lie within [${result.bedtime.min}, ${result.bedtime.max}]`
    );
  });

  it('bedtime, 3-model isNoNapDay=true path: circularMean generalizes to 3 models, central lies within its own reported band', () => {
    const dayRecords = buildMidnightBedtimeFixture(20);
    const result = blendForecast(dayRecords, BLEND_SETTINGS, {}, true);
    assert.strictEqual(
      centralWithinBand(result.bedtime.min, result.bedtime.max, result.bedtime.central),
      true,
      `bedtime.central ${result.bedtime.central} should lie within [${result.bedtime.min}, ${result.bedtime.max}]`
    );
  });
});
