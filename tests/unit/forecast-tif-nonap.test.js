// tests/unit/forecast-tif-nonap.test.js
// Unit tests for TIF-16 no-nap-day substitution logic in tifForecast().
//
// Tests the three substitution behaviours:
//   D-16: bedtime uses 'Day-length band (no-nap days)' when isNoNapDay=true + enough history
//   D-17: wake uses 'Post-no-nap sleep-length band'; combined band skipped when isNoNapDay=true
//   D-18: napStart includes 'Post-no-nap nap-start pattern' when isYesterdayNoNap=true
//   D-19: thin no-nap history falls back to 'Day-length band'
//
// Run: node --test tests/unit/forecast-tif-nonap.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { tifForecast } from '../../js/lib/forecast-tif.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Build a 10-day fixture.
 * Records indexed 0–9. Days in noNapIndices have napStart=null, napEnd=null.
 *
 * @param {number[]} noNapIndices  indices (0-based) that are no-nap days
 * @returns {object[]}
 */
function makeNoNapFixture(noNapIndices = []) {
  return Array.from({ length: 10 }, (_, i) => {
    const dayNum = String(i + 1).padStart(2, '0');
    const isNoNap = noNapIndices.includes(i);
    return {
      date:     `2024-01-${dayNum}`,
      wake:     '07:30',
      napStart: isNoNap ? null : '13:00',
      napEnd:   isNoNap ? null : '14:30',
      bedtime:  '22:00',
      allEvents: [],
      rejected: false,
    };
  });
}

const defaultNoNapSettings = {
  minDays:           3,
  tifRollingDays:    10,
  trimPct:           0,
  precisionTarget:   60,
  forecastAlgorithm: 'tif',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tifForecast() TIF-16 no-nap-day substitution', () => {

  it('isNoNapDay=true with enough no-nap history → bedtime uses Day-length band (no-nap days)', () => {
    // 4 no-nap days (indices 2,4,6,8) >= minDays=3
    const fixture = makeNoNapFixture([2, 4, 6, 8]);
    const result  = tifForecast(fixture, defaultNoNapSettings, {}, true);

    assert.ok(
      result.bedtime.sourceWindows.some(w => w.label === 'Day-length band (no-nap days)'),
      'bedtime.sourceWindows should contain Day-length band (no-nap days)',
    );
    assert.ok(
      !result.bedtime.sourceWindows.some(w => w.label === 'Day-length band'),
      'bedtime.sourceWindows should NOT contain Day-length band (it was substituted)',
    );
  });

  it('isNoNapDay=true but only 1 no-nap day (< minDays) → falls back to Day-length band', () => {
    // Only 1 no-nap day (index 8) < minDays=3 → fallback
    const fixture = makeNoNapFixture([8]);
    const result  = tifForecast(fixture, defaultNoNapSettings, {}, true);

    assert.ok(
      result.bedtime.sourceWindows.some(w => w.label === 'Day-length band'),
      'bedtime.sourceWindows should contain Day-length band (fallback when too few no-nap days)',
    );
    assert.ok(
      !result.bedtime.sourceWindows.some(w => w.label === 'Day-length band (no-nap days)'),
      'bedtime.sourceWindows should NOT contain Day-length band (no-nap days) when history is thin',
    );
  });

  it('isNoNapDay=true with enough post-no-nap history → wake uses Post-no-nap sleep-length band; combined band absent', () => {
    // No-nap days: indices 2,4,6,8 → post-no-nap days: 3,5,7,9 (4 days >= minDays=3)
    const fixture = makeNoNapFixture([2, 4, 6, 8]);
    const result  = tifForecast(fixture, defaultNoNapSettings, {}, true);

    assert.ok(
      result.wake.sourceWindows.some(w => w.label === 'Post-no-nap sleep-length band'),
      'wake.sourceWindows should contain Post-no-nap sleep-length band',
    );
    assert.ok(
      !result.wake.sourceWindows.some(w => w.label === 'Sleep-length band'),
      'wake.sourceWindows should NOT contain Sleep-length band (substituted by Post-no-nap band)',
    );
    assert.ok(
      !result.wake.sourceWindows.some(w => w.label === 'Sleep + nap combined band'),
      'wake.sourceWindows should NOT contain Sleep + nap combined band (skipped on no-nap days)',
    );
  });

  it('yesterday was no-nap (index 8 napStart=null) → napStart includes Post-no-nap nap-start pattern', () => {
    // Day index 8 (second-to-last in window[0..9]) has napStart=null → isYesterdayNoNap=true
    // isNoNapDay=false: today (index 9) is a nap day
    const fixture = makeNoNapFixture([8]);
    const result  = tifForecast(fixture, defaultNoNapSettings, {}, false);

    assert.ok(
      result.napStart.sourceWindows.some(w => w.label === 'Post-no-nap nap-start pattern'),
      'napStart.sourceWindows should contain Post-no-nap nap-start pattern when yesterday was no-nap',
    );
  });

  it('isNoNapDay=false → no-nap substitution absent', () => {
    // All days have napStart → no substitution triggers
    const fixture = makeNoNapFixture([]);
    const result  = tifForecast(fixture, defaultNoNapSettings, {}, false);

    assert.ok(
      result.bedtime.sourceWindows.some(w => w.label === 'Day-length band'),
      'bedtime.sourceWindows should contain Day-length band (no substitution)',
    );
    assert.ok(
      !result.bedtime.sourceWindows.some(w => w.label === 'Day-length band (no-nap days)'),
      'bedtime.sourceWindows should NOT contain Day-length band (no-nap days) when isNoNapDay=false',
    );
    assert.ok(
      !result.wake.sourceWindows.some(w => w.label === 'Post-no-nap sleep-length band'),
      'wake.sourceWindows should NOT contain Post-no-nap sleep-length band when isNoNapDay=false',
    );
  });

});
