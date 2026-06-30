// tests/unit/accuracy.test.js
// Unit tests for js/lib/accuracy.js — retroactive backtesting logic.
//
// Phase: NW-07
// Requirements: UI-05
// Decisions: D7-12, D7-13, D7-14, D7-15, D7-16
//
// TDD: RED → GREEN → REFACTOR
// Run: node --test tests/unit/accuracy.test.js
//
// Test groups:
//   1. computeAccuracy(dayRecords, settings) — edge cases: empty, sparse data
//   2. computeAccuracy — perfect prediction scoring (100% within delta)
//   3. computeAccuracy — boundary and miss cases
//   4. computeAccuracy — nap-day filtering (D7-15)
//   5. computeAccuracy — cold-start skip (isColdStart: true mid-loop)
//   6. computeAccuracy — output shape (pct values are 0-100, not fractions)
//
// NOTE: This file MUST fail with ERR_MODULE_NOT_FOUND because js/lib/accuracy.js
// does not exist yet. This is the expected RED state for TDD (PLAT-11).
//
// AccuracyResult shape (from 07-RESEARCH.md §Accuracy Backtesting Design):
//   {
//     wake:     { total: N, withinDelta: { count: N, pct: N }, withinHalfDelta: { count: N, pct: N }, insideBand: { count: N, pct: N } },
//     bedtime:  { ... same ... },
//     napStart: { ... same ... },
//     napEnd:   { ... same ... },
//   }

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeAccuracy } from '../../js/lib/accuracy.js';

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

// ---------------------------------------------------------------------------
// 1. Edge cases — empty and sparse day records
// ---------------------------------------------------------------------------

describe('computeAccuracy — UI-05, D7-12..D7-16', () => {

  describe('empty dayRecords', () => {
    it('empty dayRecords → all totals zero', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.total, 0, 'wake.total should be 0 for empty input');
      assert.strictEqual(result.bedtime.total, 0, 'bedtime.total should be 0 for empty input');
      assert.strictEqual(result.napStart.total, 0, 'napStart.total should be 0 for empty input');
      assert.strictEqual(result.napEnd.total, 0, 'napEnd.total should be 0 for empty input');
    });

    it('empty dayRecords → all pct values zero', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.withinDelta.pct, 0);
      assert.strictEqual(result.wake.withinHalfDelta.pct, 0);
      assert.strictEqual(result.wake.insideBand.pct, 0);
    });
  });

  describe('fewer than minDays+1 records', () => {
    it('3 records with minDays=7 → loop never runs → all totals zero', () => {
      // With minDays=7, the loop starts at index 7. Only 3 records → loop body
      // never executes. All counters remain at zero.
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

  // ---------------------------------------------------------------------------
  // 2. Perfect prediction — 100% within delta
  // ---------------------------------------------------------------------------

  describe('perfect prediction within max_delta', () => {
    it('perfect prediction → withinDelta.pct === 100', () => {
      // Use minDays=2 for brevity (per plan task description).
      // Days 0 and 1 are history. Day 2 is the actual.
      // We set up a scenario where forecast() using days 0 and 1 should produce
      // a central wake time matching day 2's actual wake time exactly (delta=0).
      // Both history days have wake at 07:00 → forecast central = 07:00.
      // Actual day also has wake at 07:00 → delta = 0 ≤ maxDelta=30 → withinDelta.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00'), bedtime: makeEvent('2025-01-02T22:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00'), bedtime: makeEvent('2025-01-03T22:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      // One day evaluated (index 2), wake prediction delta = 0 → 100%
      assert.strictEqual(result.wake.total, 1, 'wake.total should be 1 (one day evaluated)');
      assert.strictEqual(result.wake.withinDelta.pct, 100, 'wake.withinDelta.pct should be 100 for perfect prediction');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Boundary and miss cases
  // ---------------------------------------------------------------------------

  describe('prediction at exactly max_delta boundary', () => {
    it('delta === maxDelta → 100% withinDelta, 0% withinHalfDelta', () => {
      // History days: wake at 07:00. Actual wake at 07:00 + maxDelta minutes.
      // forecast() uses the two history days; central = 07:00 (420 min).
      // Actual wake = 07:30 (450 min) when maxDelta=30 → delta = 30 = maxDelta → withinDelta.
      // delta = 30 > maxDelta/2 = 15 → NOT withinHalfDelta.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:30') }), // exactly maxDelta=30 away
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.withinDelta.pct, 100, 'delta == maxDelta should be within delta (≤ not <)');
      assert.strictEqual(result.wake.withinHalfDelta.pct, 0, 'delta == maxDelta should NOT be within half delta when maxDelta=30 and delta=30>15');
    });
  });

  describe('prediction outside max_delta', () => {
    it('delta > maxDelta on all rows → 0% withinDelta', () => {
      // History: wake at 07:00. Actual: wake at 08:00 (60 min delta, maxDelta=30).
      // 60 > 30 → NOT withinDelta.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T08:00') }), // 60 min away
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      assert.strictEqual(result.wake.withinDelta.pct, 0, 'delta > maxDelta should yield 0% withinDelta');
      assert.strictEqual(result.wake.withinDelta.count, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Nap-day filtering (D7-15)
  // ---------------------------------------------------------------------------

  describe('nap rows skip no-nap days', () => {
    it('2 total days, 1 with nap → napStart.total counts only days with napStart', () => {
      // Day at index=2 has napStart; day at index=3 does not.
      // Only 1 day should be counted in napStart.total.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
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

      // Only 1 day has napStart (2025-01-03) — the day at index 3 (2025-01-04) has no nap
      // and should be skipped for nap metrics.
      assert.strictEqual(result.napStart.total, 1, 'napStart.total should count only days with napStart');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Cold-start skip (isColdStart: true mid-loop)
  // ---------------------------------------------------------------------------

  describe('isColdStart forecast result skipped', () => {
    it('all days rejected → forecast() returns isColdStart:true → row skipped, total unchanged', () => {
      // 4 days all rejected. With minDays=2, loop starts at i=2.
      // history = slice(0, 2) = 2 rejected days → validDayCount=0 < minDays=2 → isColdStart:true.
      // The loop continues for i=3 as well: history = slice(0,3) = 3 rejected → still cold.
      // All iterations are skipped → totals remain 0.
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

  // ---------------------------------------------------------------------------
  // 6. Output shape — pct values are 0-100, not fractions
  // ---------------------------------------------------------------------------

  describe('output shape', () => {
    it('pct values are 0-100 numbers, not fractions (0.0-1.0)', () => {
      // Use the perfect-prediction scenario to get non-zero pct values.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00') }),
      ];

      const result = computeAccuracy(days, { minDays: 2, maxDelta: 30, windowDays: 7 });

      // All pct values must be in [0, 100] range (not [0, 1])
      for (const eventType of ['wake', 'bedtime', 'napStart', 'napEnd']) {
        const row = result[eventType];
        for (const metric of ['withinDelta', 'withinHalfDelta', 'insideBand']) {
          const pct = row[metric].pct;
          assert.ok(
            typeof pct === 'number' && pct >= 0 && pct <= 100,
            `${eventType}.${metric}.pct = ${pct} should be a number in [0, 100]`
          );
        }
      }
    });

    it('result has all four event-type keys', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      assert.ok('wake' in result, 'result should have wake key');
      assert.ok('bedtime' in result, 'result should have bedtime key');
      assert.ok('napStart' in result, 'result should have napStart key');
      assert.ok('napEnd' in result, 'result should have napEnd key');
    });

    it('each event-type row has total, withinDelta, withinHalfDelta, insideBand', () => {
      const result = computeAccuracy([], { minDays: 7, maxDelta: 30, windowDays: 7 });

      for (const eventType of ['wake', 'bedtime', 'napStart', 'napEnd']) {
        const row = result[eventType];
        assert.ok('total' in row, `${eventType} should have total`);
        assert.ok('withinDelta' in row, `${eventType} should have withinDelta`);
        assert.ok('withinHalfDelta' in row, `${eventType} should have withinHalfDelta`);
        assert.ok('insideBand' in row, `${eventType} should have insideBand`);

        assert.ok('count' in row.withinDelta, `${eventType}.withinDelta should have count`);
        assert.ok('pct' in row.withinDelta, `${eventType}.withinDelta should have pct`);
      }
    });
  });

});
