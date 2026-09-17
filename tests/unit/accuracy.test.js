// tests/unit/accuracy.test.js
// Unit tests for js/lib/accuracy.js — retroactive backtesting logic.
//
// Phase: 22-accuracy-scoring
// Requirements: ACC-01, ACC-02, ACC-03, ACC-04
//
// TDD: RED → GREEN → REFACTOR
// Run: node --test tests/unit/accuracy.test.js
//
// AccuracyResult shape (Task 1, interim — no bedtime split, no band-fallback,
// no overallScore yet; those land in Task 2):
//   {
//     wake:     { total: N, avgScore: N },
//     bedtime:  { total: N, avgScore: N },
//     napStart: { total: N, avgScore: N },
//     napEnd:   { total: N, avgScore: N },
//   }

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeAccuracy, eventAccuracyScore } from '../../js/lib/accuracy.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal day record for computeAccuracy tests.
// Fields computeAccuracy reads: date (YYYY-MM-DD), wake, bedtime, napStart,
// napEnd (null or { at: 'YYYY-MM-DDTHH:MM' }), rejected (boolean).
// ---------------------------------------------------------------------------
function makeDay(date, { wake = null, bedtime = null, napStart = null, napEnd = null, rejected = false } = {}) {
  return { date, wake, bedtime, napStart, napEnd, rejected };
}

// ---------------------------------------------------------------------------
// Helper: build a minimal event object.
// ---------------------------------------------------------------------------
function makeEvent(at) {
  return { at };
}

describe('eventAccuracyScore — ACC-02 linear-decay formula (NEW_ACC.md worked example)', () => {
  // forecast = 14:50 = 890 minutes, window W = 25 minutes
  const F = 890;
  const W = 25;

  it('D=0 (actual=890, 14:50) -> 100', () => {
    assert.strictEqual(eventAccuracyScore(F, 890, W), 100);
  });

  it('D=5 (actual=895, 14:55) -> 90', () => {
    assert.strictEqual(eventAccuracyScore(F, 895, W), 90);
  });

  it('D=5 (actual=885, 14:45) -> 90', () => {
    assert.strictEqual(eventAccuracyScore(F, 885, W), 90);
  });

  it('D=W=25 (actual=915, 15:15) -> 50', () => {
    assert.strictEqual(eventAccuracyScore(F, 915, W), 50);
  });

  it('interior W<D<2W (actual=930, 15:30, D=40) -> 20', () => {
    assert.strictEqual(eventAccuracyScore(F, 930, W), 20);
  });

  it('D=2W=50 (actual=940, 15:40) -> 0', () => {
    assert.strictEqual(eventAccuracyScore(F, 940, W), 0);
  });

  it('D>2W (actual=945, D=55) -> 0', () => {
    assert.strictEqual(eventAccuracyScore(F, 945, W), 0);
  });
});

describe('computeAccuracy — ACC-01..04', () => {

  describe('empty dayRecords', () => {
    it('empty dayRecords → all totals zero', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 0, 'wake.total should be 0 for empty input');
      assert.strictEqual(result.bedtime.total, 0, 'bedtime.total should be 0 for empty input');
      assert.strictEqual(result.napStart.total, 0, 'napStart.total should be 0 for empty input');
      assert.strictEqual(result.napEnd.total, 0, 'napEnd.total should be 0 for empty input');
    });

    it('empty dayRecords → all avgScore values zero', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.avgScore, 0);
      assert.strictEqual(result.bedtime.avgScore, 0);
      assert.strictEqual(result.napStart.avgScore, 0);
      assert.strictEqual(result.napEnd.avgScore, 0);
    });
  });

  describe('fewer than minDays+1 records', () => {
    it('3 records with minDays=7 → loop never runs → all totals zero', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:05') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:10') }),
      ];

      const result = computeAccuracy(days, { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 0, 'wake.total should be 0 when fewer than minDays+1 records');
      assert.strictEqual(result.bedtime.total, 0);
      assert.strictEqual(result.napStart.total, 0);
      assert.strictEqual(result.napEnd.total, 0);
    });
  });

  describe('perfect prediction within max_delta', () => {
    it('perfect prediction → wake.total=1, wake.avgScore=100', () => {
      // Use minDays=2 for brevity (per plan task description).
      // Days 0 and 1 are history. Day 2 is the actual.
      // Both history days have wake at 07:00 → forecast central = 07:00.
      // Actual day also has wake at 07:00 → D=0 → score=100.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00'), bedtime: makeEvent('2025-01-02T22:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00'), bedtime: makeEvent('2025-01-03T22:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 1, 'wake.total should be 1 (one day evaluated)');
      assert.strictEqual(result.wake.avgScore, 100, 'wake.avgScore should be 100 for perfect prediction');
    });
  });

  describe('prediction at exactly max_delta boundary', () => {
    it('delta === maxDelta (D=W) → avgScore = 50', () => {
      // History days: wake at 07:00. Actual wake at 07:00 + maxDelta minutes.
      // forecast() uses the two history days; central = 07:00 (420 min).
      // Actual wake = 07:30 (450 min) when maxDelta=30 → D=30=W → score=50.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:30') }), // exactly maxDelta=30 away
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.avgScore, 50, 'D == W should score exactly 50');
    });
  });

  describe('prediction outside max_delta window (D=2W)', () => {
    it('delta = 2*maxDelta on all rows → avgScore = 0', () => {
      // History: wake at 07:00. Actual: wake at 08:00 (60 min delta, maxDelta=30, 2W=60).
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T08:00') }), // 60 min away = 2W
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.avgScore, 0, 'D >= 2W should yield avgScore 0');
    });
  });

  describe('output shape — Task 1 interim (no split, no band yet)', () => {
    it('per-type result objects have exactly two own keys: total, avgScore', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      for (const type of ['wake', 'bedtime', 'napStart', 'napEnd']) {
        const keys = Object.keys(result[type]).sort();
        assert.deepStrictEqual(keys, ['avgScore', 'total'], `${type} should have exactly total/avgScore keys`);
      }
    });

    it('avgScore is an integer number in [0, 100]', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      const score = result.wake.avgScore;
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `wake.avgScore=${score} should be integer in [0,100]`);
    });
  });

  describe('nap rows skip no-nap days', () => {
    it('2 total days, 1 with nap → napStart.total counts only days with napStart', () => {
      // History days (0,1) carry nap data too — under the new ACC-03 "usable
      // forecast AND actual" total semantics, a nap-day-only actual (day 2)
      // needs a real napStart central prediction from history to count at
      // all; the nap-day-filtering intent (excluding day 3, the no-nap day)
      // is unaffected and still proven below.
      const days = [
        makeDay('2025-01-01', {
          wake: makeEvent('2025-01-01T07:00'),
          napStart: makeEvent('2025-01-01T13:00'),
          napEnd: makeEvent('2025-01-01T14:00'),
        }),
        makeDay('2025-01-02', {
          wake: makeEvent('2025-01-02T07:00'),
          napStart: makeEvent('2025-01-02T13:00'),
          napEnd: makeEvent('2025-01-02T14:00'),
        }),
        makeDay('2025-01-03', {
          wake: makeEvent('2025-01-03T07:00'),
          napStart: makeEvent('2025-01-03T13:00'),
          napEnd: makeEvent('2025-01-03T14:00'),
        }),
        makeDay('2025-01-04', {
          wake: makeEvent('2025-01-04T07:00'),
          // no nap on this day
        }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.napStart.total, 1, 'napStart.total should count only days with napStart');
    });
  });

  describe('isColdStart forecast result skipped', () => {
    it('all days rejected → forecast() returns isColdStart:true → row skipped, total unchanged', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), rejected: true }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00'), rejected: true }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00'), rejected: true }),
        makeDay('2025-01-04', { wake: makeEvent('2025-01-04T07:00'), rejected: true }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 0, 'all-rejected days: isColdStart skips all → total unchanged');
      assert.strictEqual(result.bedtime.total, 0);
    });
  });

  describe('ACC-03 literal: total only counts days with BOTH usable forecast AND actual', () => {
    it('actual wake exists but no history ever had a wake value → wake.total stays 0', () => {
      // History days have wake:null on every day, so the internal percentile
      // calculation has no valid times → prediction.wake has neither central
      // nor probabilityBand. The scored day DOES have an actual wake event.
      // total must NOT increment (deliberate ACC-03 behavior change vs the
      // pre-existing implementation, which incremented total regardless).
      const days = [
        makeDay('2025-01-01', { bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-02', { bedtime: makeEvent('2025-01-02T22:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00'), bedtime: makeEvent('2025-01-03T22:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 0, 'no usable wake prediction in history → wake.total must not increment');
    });
  });

});

// ---------------------------------------------------------------------------
// Task 2: bedtime nap-day split (D-03/D-04), band-fallback approximation
// (D-06/D-07), overall headline score (D-10).
// ---------------------------------------------------------------------------

describe('computeAccuracy — Task 2 (D-03/D-04/D-06/D-07/D-10)', () => {

  describe('bedtime nap-day/no-nap-day split (D-03/D-04)', () => {
    it('bedtime.total = bedtimeNapDay.total + bedtimeNoNapDay.total; both sub-buckets score 100 at D=0', () => {
      // History establishes bedtime central = 22:00 via 2 history days.
      // Day 2 (nap day, napStart != null) scores bedtime D=0.
      // Day 3 (no-nap day, napStart == null) also scores bedtime D=0.
      const days = [
        makeDay('2025-01-01', { bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-02', { bedtime: makeEvent('2025-01-02T22:00') }),
        makeDay('2025-01-03', {
          bedtime: makeEvent('2025-01-03T22:00'),
          napStart: makeEvent('2025-01-03T13:00'),
          napEnd: makeEvent('2025-01-03T14:00'),
        }),
        makeDay('2025-01-04', {
          bedtime: makeEvent('2025-01-04T22:00'),
          // no nap on this day
        }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.bedtime.total, 2, 'bedtime.total should count both scored days');
      assert.strictEqual(result.bedtime.avgScore, 100);
      assert.strictEqual(result.bedtimeNapDay.total, 1, 'bedtimeNapDay.total should count only the nap day');
      assert.strictEqual(result.bedtimeNapDay.avgScore, 100);
      assert.strictEqual(result.bedtimeNoNapDay.total, 1, 'bedtimeNoNapDay.total should count only the no-nap day');
      assert.strictEqual(result.bedtimeNoNapDay.avgScore, 100);
      assert.strictEqual(result.bedtime.total, result.bedtimeNapDay.total + result.bedtimeNoNapDay.total);
    });
  });

  describe('band-mode approximation (D-06/D-07)', () => {
    it('wake band-mode day: approximatedCount=1, score derived from band midpoint', () => {
      // History wake times 06:00 (360min) and 10:00 (600min) are far enough
      // apart (spread=240min >> maxDelta=30) that forecast() returns a
      // probabilityBand instead of a central prediction. bandMin=360,
      // bandMax=600 → midpoint=480min=08:00. Actual wake=08:00 → D=0 → score=100.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T06:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T10:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T08:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 1);
      assert.strictEqual(result.wake.approximatedCount, 1, 'band-derived score must increment approximatedCount');
      assert.strictEqual(result.wake.avgScore, 100, 'score should be computed from the band midpoint (480min) vs actual (480min) → D=0 → 100');
    });
  });

  describe('overall headline score (D-10)', () => {
    it('overallScore = mean of each day\'s own per-day mean score, excluding zero-event days', () => {
      // History: wake=07:00 (420min), bedtime=22:00 (1320min) on both history days.
      // Day 2: wake=07:00 (D=0→100), bedtime=22:00 (D=0→100) → dayMean=100.
      // Day 3: wake=07:30 (D=30=W→50), bedtime=null (no actual, excluded) → dayMean=50.
      // Day 4: everything null → zero scored events → excluded entirely from the mean.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00'), bedtime: makeEvent('2025-01-02T22:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00'), bedtime: makeEvent('2025-01-03T22:00') }),
        makeDay('2025-01-04', { wake: makeEvent('2025-01-04T07:30') }), // bedtime null
        makeDay('2025-01-05', {}), // zero scored events — must not pull headline toward 0
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      // Hand-computed: dailyAverages = [100 (day index2), 50 (day index3)]
      // day index4 (zero events) excluded entirely.
      const expected = Math.round((100 + 50) / 2);
      assert.strictEqual(result.overallScore, expected, `overallScore should be ${expected}, excluding the zero-event day`);
    });

    it('computeAccuracy([], settings) → overallScore=0 (never NaN), bedtimeNapDay is a fully-zeroed bucket', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.overallScore, 0);
      assert.deepStrictEqual(result.bedtimeNapDay, { total: 0, avgScore: 0, approximatedCount: 0 });
    });
  });

  describe('approximatedCount defaults to 0 when no band-mode days occur', () => {
    it('every type has approximatedCount === 0 (never undefined) on an all-central-prediction fixture', () => {
      const days = [
        makeDay('2025-01-01', {
          wake: makeEvent('2025-01-01T07:00'),
          bedtime: makeEvent('2025-01-01T22:00'),
          napStart: makeEvent('2025-01-01T13:00'),
          napEnd: makeEvent('2025-01-01T14:00'),
        }),
        makeDay('2025-01-02', {
          wake: makeEvent('2025-01-02T07:00'),
          bedtime: makeEvent('2025-01-02T22:00'),
          napStart: makeEvent('2025-01-02T13:00'),
          napEnd: makeEvent('2025-01-02T14:00'),
        }),
        makeDay('2025-01-03', {
          wake: makeEvent('2025-01-03T07:00'),
          bedtime: makeEvent('2025-01-03T22:00'),
          napStart: makeEvent('2025-01-03T13:00'),
          napEnd: makeEvent('2025-01-03T14:00'),
        }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      for (const type of ['wake', 'bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay', 'napStart', 'napEnd']) {
        assert.strictEqual(result[type].approximatedCount, 0, `${type}.approximatedCount should default to 0`);
      }
    });
  });

});
