// tests/integration/forecast-tif.integration.test.js
// Integration tests for tifForecast() in js/lib/forecast-tif.js.
//
// Exercises the full algorithm with a 10-day fixture including cold-start and
// rejected-day paths. No real storage or clock — uses synthetic pre-bucketed
// day records (same shape daysBySubjectiveNight() produces).
//
// Run: node --test tests/integration/forecast-tif.integration.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { tifForecast } from '../../js/lib/forecast-tif.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** 'HH:MM' string shifted by ±minutes (for building non-trivial distributions). */
function shiftTime(hhmm, deltaMinutes) {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(3, 5), 10);
  let total = h * 60 + m + deltaMinutes;
  // Wrap around
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

/**
 * Build a 10-day fixture with slight variation in times.
 * Each day is shifted by a different delta so the distributions are non-trivial.
 * allEvents is [] (synthetic data — anchor logic falls back to named fields).
 *
 * @param {number[]} offsets       per-day delta in minutes (length = number of days)
 * @param {boolean[]} rejectedMask per-day rejected flags
 */
function makeFixture(
  offsets = [0, 5, -5, 10, -10, 15, -15, 5, -5, 0],
  rejectedMask = Array(10).fill(false),
) {
  return offsets.map((delta, i) => ({
    wake:     shiftTime('07:30', delta),
    bedtime:  shiftTime('21:00', delta),
    napStart: shiftTime('13:00', delta),
    napEnd:   shiftTime('14:30', delta),
    rejected: rejectedMask[i],
    allEvents: [],
  }));
}

const defaultSettings = {
  minDays:         3,
  windowDays:      30,
  trimPct:         10,
  precisionTarget: 60,
  tifRollingDays:  7,
  forecastAlgorithm: 'tif',
};

// ---------------------------------------------------------------------------
// Helper assertions
// ---------------------------------------------------------------------------

const HH_MM = /^\d{2}:\d{2}$/;

function assertTifPrediction(pred, label) {
  assert.ok(pred !== null, `${label} should not be null`);
  assert.ok(typeof pred === 'object', `${label} should be an object`);
  assert.ok(HH_MM.test(pred.central),  `${label}.central should match HH:MM`);
  assert.ok(HH_MM.test(pred.min),      `${label}.min should match HH:MM`);
  assert.ok(HH_MM.test(pred.max),      `${label}.max should match HH:MM`);
  assert.ok(
    typeof pred.precisionScore === 'number' &&
    pred.precisionScore >= 0 &&
    pred.precisionScore <= 100,
    `${label}.precisionScore should be 0–100`,
  );
  assert.ok(typeof pred.isLowConfidence === 'boolean', `${label}.isLowConfidence should be boolean`);
  assert.ok(Array.isArray(pred.sourceWindows), `${label}.sourceWindows should be an array`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tifForecast() integration', () => {

  // 1. Not cold-start with 10 days and minDays=3
  it('10 days, minDays=3 → isColdStart=false', () => {
    const days   = makeFixture();
    const result = tifForecast(days, defaultSettings);
    assert.strictEqual(result.isColdStart, false);
  });

  // 2. All four predictions exist and are non-null objects
  it('returns non-null objects for all four event types', () => {
    const days   = makeFixture();
    const result = tifForecast(days, defaultSettings);
    assert.ok(result.wake     !== null, 'wake should not be null');
    assert.ok(result.napStart !== null, 'napStart should not be null');
    assert.ok(result.napEnd   !== null, 'napEnd should not be null');
    assert.ok(result.bedtime  !== null, 'bedtime should not be null');
    assert.ok(typeof result.wake     === 'object', 'wake should be object');
    assert.ok(typeof result.napStart === 'object', 'napStart should be object');
    assert.ok(typeof result.napEnd   === 'object', 'napEnd should be object');
    assert.ok(typeof result.bedtime  === 'object', 'bedtime should be object');
  });

  // 3. Each prediction has required TIF shape fields
  it('each prediction has TIF extended shape (central, min, max, precisionScore, isLowConfidence, sourceWindows)', () => {
    const days   = makeFixture();
    const result = tifForecast(days, defaultSettings);
    assertTifPrediction(result.wake,     'wake');
    assertTifPrediction(result.napStart, 'napStart');
    assertTifPrediction(result.napEnd,   'napEnd');
    assertTifPrediction(result.bedtime,  'bedtime');
  });

  // 4. Cold-start gate: 2 days with minDays=3 → isColdStart=true
  it('2 days, minDays=3 → isColdStart=true', () => {
    const days   = makeFixture([0, 5]).slice(0, 2);
    const result = tifForecast(days, defaultSettings);
    assert.strictEqual(result.isColdStart, true);
    assert.strictEqual(result.wake,     null);
    assert.strictEqual(result.napStart, null);
    assert.strictEqual(result.napEnd,   null);
    assert.strictEqual(result.bedtime,  null);
  });

  // 5. Rejected days don't cause crashes; predictions still returned
  it('2 of 10 days are rejected → no crash, predictions returned', () => {
    const mask = Array(10).fill(false);
    mask[2] = true;
    mask[7] = true;
    const days   = makeFixture(undefined, mask);
    const result = tifForecast(days, { ...defaultSettings, minDays: 3 });
    assert.strictEqual(result.isColdStart, false);
    assert.ok(result.wake !== null);
    assert.ok(result.napStart !== null);
    assert.ok(result.napEnd !== null);
    assert.ok(result.bedtime !== null);
  });

  // 6. All precisionScores are 0–100
  it('all precisionScores are in range 0–100', () => {
    const days   = makeFixture();
    const result = tifForecast(days, defaultSettings);
    for (const key of ['wake', 'napStart', 'napEnd', 'bedtime']) {
      const score = result[key]?.precisionScore;
      assert.ok(
        typeof score === 'number' && score >= 0 && score <= 100,
        `${key}.precisionScore=${score} should be 0–100`,
      );
    }
  });

  // 7. sourceWindows array has at least 1 entry for wake (historic band always computable)
  it('wake.sourceWindows has at least 1 entry', () => {
    const days   = makeFixture();
    const result = tifForecast(days, defaultSettings);
    assert.ok(
      Array.isArray(result.wake.sourceWindows) && result.wake.sourceWindows.length >= 1,
      'wake.sourceWindows should have at least 1 entry',
    );
  });

  // 8. sourceWindows entries have label, min (HH:MM), max (HH:MM)
  it('sourceWindows entries have label, min, max in HH:MM format', () => {
    const days   = makeFixture();
    const result = tifForecast(days, defaultSettings);
    for (const w of result.wake.sourceWindows) {
      assert.ok(typeof w.label === 'string' && w.label.length > 0, 'window.label should be non-empty string');
      assert.ok(HH_MM.test(w.min), `window.min="${w.min}" should match HH:MM`);
      assert.ok(HH_MM.test(w.max), `window.max="${w.max}" should match HH:MM`);
    }
  });

  // 10. Combined band subtracts today's actual nap from historical combined duration.
  //
  // Fixture: 9 historical days (nap=90 min, sleep=630 min, combined=720 min).
  // Current day (day 10): nap=120 min (longer than usual), bedtime logged as
  // the globally latest event, no wake yet.
  //
  // Expected combined band:
  //   bedtime(21:00=1260) + combined(720) − today_nap(120) = 1860 → 07:00
  //   (1860 mod 1440 = 420 = 07:00)
  // Expected sleep-length band:
  //   bedtime(1260) + sleep(630) = 1890 → 07:30  (1890 mod 1440 = 450)
  // Bands disagree → isLowConfidence true.
  it('wake combined band subtracts today\'s actual nap, differs from sleep-length band → low confidence', () => {
    function makeEventDay(dateStr, wake, napStart, napEnd, bedtime) {
      const evs = [];
      function field(t, type) {
        if (!t) return null;
        const at = `${dateStr}T${t}`;
        evs.push({ at, type });
        return { at };
      }
      return {
        wake:     field(wake,     'wake'),
        napStart: field(napStart, 'napStart'),
        napEnd:   field(napEnd,   'napEnd'),
        bedtime:  field(bedtime,  'bedtime'),
        rejected: false,
        allEvents: evs,
      };
    }

    const days = [];
    for (let i = 1; i <= 9; i++) {
      const date = `2026-01-${String(i).padStart(2, '0')}`;
      days.push(makeEventDay(date, '07:30', '13:00', '14:30', '21:00'));
    }
    // Current day: longer nap (120 min), no wake, bedtime is the latest event.
    days.push(makeEventDay('2026-01-10', null, '13:00', '15:00', '21:00'));

    const result = tifForecast(days, { ...defaultSettings, trimPct: 0, precisionTarget: 600 });

    // Combined band source window must be present with the nap-corrected value.
    const combinedWindow = result.wake.sourceWindows.find(
      w => w.label === 'Sleep + nap combined band',
    );
    assert.ok(combinedWindow, 'wake should have a Sleep + nap combined band source window');
    assert.strictEqual(combinedWindow.min, '07:00', 'combined band min should equal bedtime+combined−today_nap');
    assert.strictEqual(combinedWindow.max, '07:00', 'combined band max should equal bedtime+combined−today_nap');

    // The combined band (07:00) disagrees with sleep-length band (07:30) → low confidence.
    assert.strictEqual(result.wake.isLowConfidence, true,
      'wake should be low-confidence when combined band disagrees with sleep-length band');
  });

  // 9. precisionTarget narrows window: small precisionTarget → displayed window ≤ precisionTarget wide
  it('displayed window respects precisionTarget when algRange exceeds it', () => {
    // Build fixture with wider spread to force algRange > precisionTarget
    const offsets = [-30, -20, -10, 0, 10, 20, 30, -25, 15, -15];
    const days    = makeFixture(offsets);
    const narrow  = { ...defaultSettings, precisionTarget: 30 };
    const result  = tifForecast(days, narrow);

    for (const key of ['wake', 'napStart', 'napEnd', 'bedtime']) {
      const pred = result[key];
      if (!pred || pred.min === null) continue;
      const minMins = parseInt(pred.min.slice(0, 2), 10) * 60 + parseInt(pred.min.slice(3), 10);
      const maxMins = parseInt(pred.max.slice(0, 2), 10) * 60 + parseInt(pred.max.slice(3), 10);
      const dispRange = maxMins - minMins;
      // After 5-min rounding dispRange may be slightly above narrow.precisionTarget; allow +5
      assert.ok(
        dispRange <= narrow.precisionTarget + 5,
        `${key} displayed range ${dispRange} should be ≤ precisionTarget (${narrow.precisionTarget}) + rounding`,
      );
    }
  });

});
