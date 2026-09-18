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

import { trimmedBand, stabilityCheck, blendForecast } from '../../js/lib/forecast-blend.js';
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
