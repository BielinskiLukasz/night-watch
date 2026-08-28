// tests/unit/forecast-tif-ratio.test.js
// RED-phase tests for TIF-12: MA/sleep ratio band (napStart) and
// MA/nap ratio band (napEnd) source windows in tifForecast().
//
// Run: node --test tests/unit/forecast-tif-ratio.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { tifForecast } from '../../js/lib/forecast-tif.js';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const defaultRatioSettings = {
  minDays: 3,
  tifRollingDays: 10,
  trimPct: 0,
  precisionTarget: 60,
  forecastAlgorithm: 'tif',
};

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

/**
 * Build a 10-day fixture with consistent times suitable for ratio window tests.
 * Each record: date '2024-01-01' through '2024-01-10',
 *   wake='07:30', bedtime='22:00', napStart='13:00', napEnd='14:30'.
 * sleepDuration per day: timeToMinutes('07:30') - timeToMinutes('22:00')
 *   = 450 - 1320 = -870 + 1440 = 570 min (non-null, > 0).
 * actBeforeNap per day: timeToMinutes('13:00') - timeToMinutes('07:30')
 *   = 780 - 450 = 330 min.
 * napDuration per day: timeToMinutes('14:30') - timeToMinutes('13:00')
 *   = 870 - 780 = 90 min.
 */
function makeRatioFixture() {
  return Array.from({ length: 10 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return {
      date: `2024-01-${day}`,
      wake: '07:30',
      bedtime: '22:00',
      napStart: '13:00',
      napEnd: '14:30',
      allEvents: [],
      rejected: false,
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tifForecast() TIF-12 ratio windows', () => {

  it('10-day fixture with consistent durations → napStart sourceWindows includes MA/sleep ratio band', () => {
    const result = tifForecast(makeRatioFixture(), defaultRatioSettings, {}, false);
    assert.ok(
      result.napStart.sourceWindows.some(w => w.label === 'MA/sleep ratio band'),
      'napStart.sourceWindows should contain MA/sleep ratio band',
    );
  });

  it('last record missing bedtime → no MA/sleep ratio band in napStart sourceWindows', () => {
    const fixture = makeRatioFixture();
    // Remove bedtime from last record so sleepDuration(last) returns null
    fixture[fixture.length - 1] = { ...fixture[fixture.length - 1], bedtime: null };
    const result = tifForecast(fixture, defaultRatioSettings, {}, false);
    assert.ok(
      !result.napStart.sourceWindows.some(w => w.label === 'MA/sleep ratio band'),
      'MA/sleep ratio band should be absent when today\'s bedtime is null',
    );
  });

  it('10-day fixture with consistent durations → napEnd sourceWindows includes MA/nap ratio band', () => {
    const result = tifForecast(makeRatioFixture(), defaultRatioSettings, {}, false);
    assert.ok(
      result.napEnd.sourceWindows.some(w => w.label === 'MA/nap ratio band'),
      'napEnd.sourceWindows should contain MA/nap ratio band',
    );
  });

  it('MA/nap ratio band median equals napStart + (todayMA / ratio) — correct inversion formula', () => {
    // Fixture: actBeforeNap=330, napDuration=90, todayMA=330 → projected=330/(330/90)=90 min → median=13:00+90=14:30
    const result = tifForecast(makeRatioFixture(), defaultRatioSettings, {}, false);
    const napRatioWindow = result.napEnd.sourceWindows.find(w => w.label === 'MA/nap ratio band');
    assert.ok(napRatioWindow, 'MA/nap ratio band window must be present');
    assert.strictEqual(napRatioWindow.median, '14:30', 'median should be napStart + todayMA/ratio = 14:30');
  });

  it('MA/sleep ratio band and MA/nap ratio band both carry a median string field', () => {
    const result = tifForecast(makeRatioFixture(), defaultRatioSettings, {}, false);
    const sleepRatioWindow = result.napStart.sourceWindows.find(
      w => w.label === 'MA/sleep ratio band',
    );
    const napRatioWindow = result.napEnd.sourceWindows.find(
      w => w.label === 'MA/nap ratio band',
    );
    assert.ok(sleepRatioWindow, 'MA/sleep ratio band window must be present');
    assert.ok(napRatioWindow,   'MA/nap ratio band window must be present');
    assert.strictEqual(
      typeof sleepRatioWindow.median, 'string',
      'MA/sleep ratio band.median should be a string (HH:MM)',
    );
    assert.strictEqual(
      typeof napRatioWindow.median, 'string',
      'MA/nap ratio band.median should be a string (HH:MM)',
    );
  });

});
