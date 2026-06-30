// tests/unit/chart-data.test.js
// Unit tests for js/lib/chart-data.js — pure data-transform helpers for charts.
//
// Phase: NW-07
// Requirements: UI-04
// Decisions: D7-05, D7-06, D7-07, D7-08, D7-09, D7-10, D7-11
//
// TDD: RED → GREEN → REFACTOR
// Run: node --test tests/unit/chart-data.test.js
//
// Test groups (one describe per export):
//   1. buildSleepLengthSeries(dayRecords) → Array<{ date, sleepHours, rejected }>
//   2. buildHeatmapData(dayRecords) → Array<{ date, sleepHours, dayOfWeek, weekIndex }>
//   3. buildTimeBandSeries(dayRecords) → Array<{ date, wakeMinutes, bedtimeMinutes }>
//   4. buildNapStats(dayRecords) → { napDayPct, avgNapStartHHMM, avgNapLengthMin }
//   5. buildActivityCorrelation(dayRecords, activityLog) → Array<{ activityScore, sleepHours }>
//
// NOTE: This file MUST fail with ERR_MODULE_NOT_FOUND because js/lib/chart-data.js
// does not exist yet. This is the expected RED state for TDD (PLAT-11).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSleepLengthSeries,
  buildHeatmapData,
  buildTimeBandSeries,
  buildNapStats,
  buildActivityCorrelation,
} from '../../js/lib/chart-data.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal day record for chart-data tests.
// Fields used: date (YYYY-MM-DD), wake, bedtime, napStart, napEnd (null or
// { at: 'YYYY-MM-DDTHH:MM' }), rejected (boolean).
// ---------------------------------------------------------------------------
function makeDay(date, overrides = {}) {
  return {
    date,
    wake: null,
    bedtime: null,
    napStart: null,
    napEnd: null,
    rejected: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: build a minimal event object.
// ---------------------------------------------------------------------------
function makeEvent(at) {
  return { at };
}

// ---------------------------------------------------------------------------
// 1. buildSleepLengthSeries(dayRecords)
// ---------------------------------------------------------------------------

describe('chart-data transforms — UI-04, D7-05..D7-11', () => {

  describe('buildSleepLengthSeries', () => {
    it('empty input → []', () => {
      const result = buildSleepLengthSeries([]);
      assert.deepStrictEqual(result, []);
    });

    it('day with wake + bedtime → sleepHours computed correctly', () => {
      // Wake at 07:00, bedtime previous day at 22:00 → sleep from 22:00 to 07:00 = 9 hours.
      // In the app's data model, a day record's bedtime is the bedtime ON THAT calendar day,
      // and wake is the wake the NEXT morning. So sleepHours = wake_minutes_from_midnight +
      // (24*60 - bedtime_minutes_from_midnight) when bedtime > wake (cross-midnight).
      // Simpler: wake=07:00 (420 min), bedtime=22:00 (1320 min) same record means
      // the person was awake from 07:00 and went to bed at 22:00. The sleep is from
      // bedtime to wake (next morning): (24*60 - 1320) + 420 = 120 + 420 = 540 min = 9 hours.
      const days = [
        makeDay('2025-01-01', {
          wake: makeEvent('2025-01-01T07:00'),
          bedtime: makeEvent('2025-01-01T22:00'),
        }),
      ];

      const result = buildSleepLengthSeries(days);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].date, '2025-01-01');
      assert.strictEqual(result[0].sleepHours, 9, 'sleepHours should be 9 for wake=07:00, bedtime=22:00');
    });

    it('day with missing wake → sleepHours null', () => {
      const days = [
        makeDay('2025-01-01', {
          wake: null,
          bedtime: makeEvent('2025-01-01T22:00'),
        }),
      ];

      const result = buildSleepLengthSeries(days);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].sleepHours, null, 'missing wake → sleepHours should be null');
    });

    it('day with missing bedtime → sleepHours null', () => {
      const days = [
        makeDay('2025-01-01', {
          wake: makeEvent('2025-01-01T07:00'),
          bedtime: null,
        }),
      ];

      const result = buildSleepLengthSeries(days);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].sleepHours, null, 'missing bedtime → sleepHours should be null');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. buildHeatmapData(dayRecords)
  // ---------------------------------------------------------------------------

  describe('buildHeatmapData', () => {
    it('empty input → []', () => {
      const result = buildHeatmapData([]);
      assert.deepStrictEqual(result, []);
    });

    it('gap filling: 2 records with 1 missing middle day → 3 cells returned', () => {
      // Input has 2025-01-01 and 2025-01-03; the gap (2025-01-02) must be filled.
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00'), bedtime: makeEvent('2025-01-03T22:00') }),
      ];

      const result = buildHeatmapData(days);

      assert.strictEqual(result.length, 3, 'gap filling should produce 3 cells for dates 01, 02, 03');

      // Middle cell should have date '2025-01-02' and sleepHours null (no record)
      const middleCell = result.find(c => c.date === '2025-01-02');
      assert.ok(middleCell, 'should have a cell for 2025-01-02');
      assert.strictEqual(middleCell.sleepHours, null, 'gap day should have sleepHours === null');
    });

    it('dayOfWeek assignment: 2025-01-06 is Monday → dayOfWeek === 0', () => {
      // 2025-01-06 is a known Monday. ISO day-of-week convention: Mon=0, Sun=6.
      const days = [
        makeDay('2025-01-06', { wake: makeEvent('2025-01-06T07:00'), bedtime: makeEvent('2025-01-06T22:00') }),
      ];

      const result = buildHeatmapData(days);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].date, '2025-01-06');
      assert.strictEqual(result[0].dayOfWeek, 0, '2025-01-06 is Monday → dayOfWeek should be 0 (ISO Mon=0)');
    });

    it('each cell has date, sleepHours, dayOfWeek, weekIndex fields', () => {
      const days = [
        makeDay('2025-01-06', { wake: makeEvent('2025-01-06T07:00'), bedtime: makeEvent('2025-01-06T22:00') }),
      ];

      const result = buildHeatmapData(days);

      assert.strictEqual(result.length, 1);
      const cell = result[0];
      assert.ok('date' in cell, 'cell should have date');
      assert.ok('sleepHours' in cell, 'cell should have sleepHours');
      assert.ok('dayOfWeek' in cell, 'cell should have dayOfWeek');
      assert.ok('weekIndex' in cell, 'cell should have weekIndex');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. buildTimeBandSeries(dayRecords)
  // ---------------------------------------------------------------------------

  describe('buildTimeBandSeries', () => {
    it('day with wake + bedtime → wakeMinutes and bedtimeMinutes present', () => {
      // wake at 07:00 = 420 min; bedtime at 22:00 = 1320 min.
      const days = [
        makeDay('2025-01-01', {
          wake: makeEvent('2025-01-01T07:00'),
          bedtime: makeEvent('2025-01-01T22:00'),
        }),
      ];

      const result = buildTimeBandSeries(days);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].wakeMinutes, 420, 'wake at 07:00 = 420 min from midnight');
      assert.strictEqual(result[0].bedtimeMinutes, 1320, 'bedtime at 22:00 = 1320 min from midnight');
    });

    it('empty input → []', () => {
      const result = buildTimeBandSeries([]);
      assert.deepStrictEqual(result, []);
    });

    it('day with missing wake → wakeMinutes null', () => {
      const days = [
        makeDay('2025-01-01', {
          wake: null,
          bedtime: makeEvent('2025-01-01T22:00'),
        }),
      ];

      const result = buildTimeBandSeries(days);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].wakeMinutes, null, 'missing wake → wakeMinutes should be null');
    });

    it('two bedtimes on same calendar date → both in bedtimesMinutes', () => {
      // Real scenario: parent logs bedtime at 00:10 (late-night) and bedtime
      // at 22:00 (next evening) on the same calendar date (June 17).
      // Calendar-date grouping puts both on the June 17 chart column.
      const days = [{
        date: '2025-01-16',  // subjective night date (irrelevant for calendar grouping)
        wake: null,
        bedtime: null,
        napStart: null,
        napEnd: null,
        rejected: false,
        allEvents: [
          { id: 'b1', type: 'bedtime', at: '2025-01-17T00:10' },
          { id: 'w1', type: 'wake',    at: '2025-01-17T07:35' },
          { id: 'b2', type: 'bedtime', at: '2025-01-17T22:00' },
        ],
      }];

      const result = buildTimeBandSeries(days);

      // Calendar-date grouping: all three events are on 2025-01-17 → one entry.
      assert.strictEqual(result.length, 1, 'one calendar date → one entry');
      assert.strictEqual(result[0].date, '2025-01-17');
      assert.strictEqual(result[0].bedtimesMinutes.length, 2, 'both bedtimes included');
      assert.strictEqual(result[0].bedtimesMinutes[0], 10,   '00:10 = 10 min');
      assert.strictEqual(result[0].bedtimesMinutes[1], 1320, '22:00 = 1320 min');
      assert.strictEqual(result[0].wakeMinutes, 455, '07:35 = 455 min');
      assert.strictEqual(result[0].bedtimeMinutes, 10, 'backward-compat scalar = first bedtime');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. buildNapStats(dayRecords)
  // ---------------------------------------------------------------------------

  describe('buildNapStats', () => {
    it('no nap days → napDayPct === 0, avgNapStartHHMM null, avgNapLengthMin null', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00') }),
      ];

      const result = buildNapStats(days);

      assert.strictEqual(result.napDayPct, 0, 'no nap days → napDayPct should be 0');
      assert.strictEqual(result.avgNapStartHHMM, null, 'no nap days → avgNapStartHHMM should be null');
      assert.strictEqual(result.avgNapLengthMin, null, 'no nap days → avgNapLengthMin should be null');
    });

    it('1 of 5 days with nap → napDayPct === 20', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', { wake: makeEvent('2025-01-03T07:00') }),
        makeDay('2025-01-04', { wake: makeEvent('2025-01-04T07:00') }),
        makeDay('2025-01-05', {
          wake: makeEvent('2025-01-05T07:00'),
          napStart: makeEvent('2025-01-05T13:00'),
          napEnd: makeEvent('2025-01-05T14:30'),
        }),
      ];

      const result = buildNapStats(days);

      assert.strictEqual(result.napDayPct, 20, '1 of 5 days with nap → napDayPct should be 20');
    });

    it('1 nap day with napStart=13:00 and napEnd=14:30 → avgNapLengthMin === 90', () => {
      // 14:30 - 13:00 = 90 minutes nap length
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00') }),
        makeDay('2025-01-03', {
          wake: makeEvent('2025-01-03T07:00'),
          napStart: makeEvent('2025-01-03T13:00'),
          napEnd: makeEvent('2025-01-03T14:30'),
        }),
      ];

      const result = buildNapStats(days);

      assert.strictEqual(result.avgNapLengthMin, 90, 'napEnd=14:30, napStart=13:00 → length=90 min');
    });

    it('empty input → napDayPct 0 and nulls', () => {
      const result = buildNapStats([]);

      assert.strictEqual(result.napDayPct, 0);
      assert.strictEqual(result.avgNapStartHHMM, null);
      assert.strictEqual(result.avgNapLengthMin, null);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. buildActivityCorrelation(dayRecords, activityLog)
  // ---------------------------------------------------------------------------

  describe('buildActivityCorrelation', () => {
    it('empty activityLog → []', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), bedtime: makeEvent('2025-01-01T22:00') }),
      ];

      const result = buildActivityCorrelation(days, {});

      assert.deepStrictEqual(result, [], 'empty activityLog should return []');
    });

    it('empty dayRecords → []', () => {
      const result = buildActivityCorrelation([], { '2025-01-01': 5 });

      assert.deepStrictEqual(result, [], 'empty dayRecords should return []');
    });

    it('day with matching activity score → { activityScore, sleepHours } entry returned', () => {
      // activityLog has a score for 2025-01-01.
      // wake=07:00, bedtime=22:00 → sleepHours=9.
      const days = [
        makeDay('2025-01-01', {
          wake: makeEvent('2025-01-01T07:00'),
          bedtime: makeEvent('2025-01-01T22:00'),
        }),
      ];
      const activityLog = { '2025-01-01': 5 };

      const result = buildActivityCorrelation(days, activityLog);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].activityScore, 5, 'activityScore should match activityLog value');
      assert.strictEqual(result[0].sleepHours, 9, 'sleepHours should be 9 for wake=07:00, bedtime=22:00');
    });

    it('days without matching activityLog entry are excluded', () => {
      const days = [
        makeDay('2025-01-01', { wake: makeEvent('2025-01-01T07:00'), bedtime: makeEvent('2025-01-01T22:00') }),
        makeDay('2025-01-02', { wake: makeEvent('2025-01-02T07:00'), bedtime: makeEvent('2025-01-02T22:00') }),
      ];
      const activityLog = { '2025-01-01': 3 }; // only Jan 1 has activity data

      const result = buildActivityCorrelation(days, activityLog);

      assert.strictEqual(result.length, 1, 'only days with matching activityLog entry should be included');
      assert.strictEqual(result[0].activityScore, 3);
    });
  });

});
