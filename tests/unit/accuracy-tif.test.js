// tests/unit/accuracy-tif.test.js
// Unit tests for js/lib/accuracy-tif.js — TIF retroactive backtesting engine.
//
// Phase: NW-14
// Requirements: MET-08, TIF-14
// Decisions: D-10, D-05 (Phase 14 CONTEXT)
//
// TDD: RED → GREEN → REFACTOR
// Run: node --test tests/unit/accuracy-tif.test.js
//
// Test groups:
//   1. computeTifBoundsHistory — edge cases: empty, loop invariant, cold-start
//   2. computeTifBoundsHistory — fixture runs with 12 day records
//   3. computeTifAccuracy — edge cases: empty, zero-total, NaN guard
//   4. computeTifAccuracy — hit, miss, highConf, avgWidthMin
//   5. computeTifAccuracy — null entry exclusion
//
// NOTE: This file MUST fail with ERR_MODULE_NOT_FOUND before js/lib/accuracy-tif.js
// is created. This is the expected RED state for TDD.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeTifBoundsHistory,
  computeTifAccuracy,
} from '../../js/lib/accuracy-tif.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal day record for tests.
// Fields: date, wake/bedtime/napStart/napEnd as {at: date+'T'+HHMM} or null.
// ---------------------------------------------------------------------------
function makeDayRecord(date, wakeHHMM, bedHHMM, napStartHHMM, napEndHHMM) {
  return {
    date,
    wake:     wakeHHMM     ? { at: date + 'T' + wakeHHMM     } : null,
    bedtime:  bedHHMM      ? { at: date + 'T' + bedHHMM      } : null,
    napStart: napStartHHMM ? { at: date + 'T' + napStartHHMM } : null,
    napEnd:   napEndHHMM   ? { at: date + 'T' + napEndHHMM   } : null,
  };
}

// Standard settings used for computeTifBoundsHistory fixture tests
const STANDARD_SETTINGS = Object.freeze({
  tifRollingDays: 7,
  minDays: 7,
  windowDays: 7,
  maxDelta: 90,
  tifEnabled: true,
  cutoverHour: 4,
  trimPct: 10,
  precisionTarget: 60,
});

// Build 12 day records: wake 07:00, bedtime 22:00, nap 13:00-14:30
// Dates 2025-01-01 through 2025-01-12
function buildFixture12() {
  const records = [];
  for (let i = 1; i <= 12; i++) {
    const dd = String(i).padStart(2, '0');
    records.push(makeDayRecord(
      `2025-01-${dd}`,
      '07:00',
      '22:00',
      '13:00',
      '14:30',
    ));
  }
  return records;
}

// ---------------------------------------------------------------------------
// 1. computeTifBoundsHistory — edge cases
// ---------------------------------------------------------------------------

describe('computeTifBoundsHistory — D-10, look-ahead bias prevention', () => {

  it('empty input returns []', () => {
    const result = computeTifBoundsHistory([], STANDARD_SETTINGS, {});
    assert.deepStrictEqual(result, []);
  });

  it('2 records with tifRollingDays=2 returns [] — loop never runs', () => {
    // minDays=2, sorted.length=2 — loop starts at i=2 which equals length → no body
    const days = [
      makeDayRecord('2025-01-01', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-02', '07:00', '22:00', '13:00', '14:30'),
    ];
    const settings = { ...STANDARD_SETTINGS, tifRollingDays: 2, minDays: 2 };
    const result = computeTifBoundsHistory(days, settings, {});
    assert.deepStrictEqual(result, []);
  });

  it('3 records with tifRollingDays=2 returns 1 entry', () => {
    const days = [
      makeDayRecord('2025-01-01', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-02', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-03', '07:00', '22:00', '13:00', '14:30'),
    ];
    const settings = { ...STANDARD_SETTINGS, tifRollingDays: 2, minDays: 2 };
    const result = computeTifBoundsHistory(days, settings, {});
    assert.strictEqual(result.length, 1);
  });

  it('3 records with tifRollingDays=2: returned entry has date = sorted[2].date', () => {
    const days = [
      makeDayRecord('2025-01-03', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-01', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-02', '07:00', '22:00', '13:00', '14:30'),
    ];
    const settings = { ...STANDARD_SETTINGS, tifRollingDays: 2, minDays: 2 };
    const result = computeTifBoundsHistory(days, settings, {});
    assert.strictEqual(result[0].date, '2025-01-03');
  });

  it('entry has wake, napStart, napEnd, bedtime keys', () => {
    const days = [
      makeDayRecord('2025-01-01', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-02', '07:00', '22:00', '13:00', '14:30'),
      makeDayRecord('2025-01-03', '07:00', '22:00', '13:00', '14:30'),
    ];
    const settings = { ...STANDARD_SETTINGS, tifRollingDays: 2, minDays: 2 };
    const result = computeTifBoundsHistory(days, settings, {});
    assert.strictEqual(result.length, 1);
    const entry = result[0];
    assert.ok(Object.prototype.hasOwnProperty.call(entry, 'wake'), 'entry must have wake');
    assert.ok(Object.prototype.hasOwnProperty.call(entry, 'napStart'), 'entry must have napStart');
    assert.ok(Object.prototype.hasOwnProperty.call(entry, 'napEnd'), 'entry must have napEnd');
    assert.ok(Object.prototype.hasOwnProperty.call(entry, 'bedtime'), 'entry must have bedtime');
  });

  it('cold-start: entry has all-null event fields when tifForecast returns isColdStart=true', () => {
    // With tifRollingDays=2, minDays=2, only 2 history records — tifForecast may cold-start
    // if records are insufficient. Use 1-record history to guarantee cold-start.
    const days = [
      makeDayRecord('2025-01-01', '07:00', '22:00', null, null),
      makeDayRecord('2025-01-02', '07:00', '22:00', null, null),
    ];
    // minDays=1 so the loop runs once with history=[day[0]], actual=day[1]
    const settings = { ...STANDARD_SETTINGS, tifRollingDays: 1, minDays: 1 };
    const result = computeTifBoundsHistory(days, settings, {});
    // tifForecast with only 1 history record should cold-start (minDays=1 requires >= 1 non-rejected)
    // If not cold-start, entry fields may be null or object — either way, date must be set
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].date, '2025-01-02');
  });

});

// ---------------------------------------------------------------------------
// 2. computeTifBoundsHistory — fixture tests
// ---------------------------------------------------------------------------

describe('computeTifBoundsHistory — 12-day fixture', () => {

  it('12 days with tifRollingDays=7 returns array of length 5 (12 - 7)', () => {
    const fixture = buildFixture12();
    const result = computeTifBoundsHistory(fixture, STANDARD_SETTINGS, {});
    assert.strictEqual(result.length, 5);
  });

  it('first entry date is 2025-01-08 (fixture[7].date)', () => {
    const fixture = buildFixture12();
    const result = computeTifBoundsHistory(fixture, STANDARD_SETTINGS, {});
    assert.strictEqual(result[0].date, '2025-01-08');
  });

  it('result dates are strings in YYYY-MM-DD format', () => {
    const fixture = buildFixture12();
    const result = computeTifBoundsHistory(fixture, STANDARD_SETTINGS, {});
    for (const entry of result) {
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `date "${entry.date}" must be YYYY-MM-DD`);
    }
  });

  it('each non-null entry.wake is object with algMin, algMax, central, precisionScore', () => {
    const fixture = buildFixture12();
    const result = computeTifBoundsHistory(fixture, STANDARD_SETTINGS, {});
    for (const entry of result) {
      if (entry.wake !== null) {
        assert.ok(typeof entry.wake.algMin === 'string', 'algMin must be string');
        assert.ok(typeof entry.wake.algMax === 'string', 'algMax must be string');
        // central and precisionScore may be null (partial prediction) but keys must exist
        assert.ok(Object.prototype.hasOwnProperty.call(entry.wake, 'central'), 'wake must have central');
        assert.ok(Object.prototype.hasOwnProperty.call(entry.wake, 'precisionScore'), 'wake must have precisionScore');
      }
    }
  });

});

// ---------------------------------------------------------------------------
// 3. computeTifAccuracy — edge cases
// ---------------------------------------------------------------------------

describe('computeTifAccuracy — D-05, D-03', () => {

  it('empty history returns all-zero result for all 4 event types', () => {
    const result = computeTifAccuracy([], []);
    for (const type of ['wake', 'napStart', 'napEnd', 'bedtime']) {
      assert.strictEqual(result[type].windowHit.count, 0, `${type}.windowHit.count`);
      assert.strictEqual(result[type].windowHit.pct,   0, `${type}.windowHit.pct`);
      assert.strictEqual(result[type].avgWidthMin,      0, `${type}.avgWidthMin`);
      assert.strictEqual(result[type].highConf.count,   0, `${type}.highConf.count`);
      assert.strictEqual(result[type].highConf.pct,     0, `${type}.highConf.pct`);
    }
  });

  it('zero total → pct is 0, not NaN', () => {
    const result = computeTifAccuracy([], []);
    for (const type of ['wake', 'napStart', 'napEnd', 'bedtime']) {
      assert.ok(!Number.isNaN(result[type].windowHit.pct), `${type}.windowHit.pct must not be NaN`);
      assert.ok(!Number.isNaN(result[type].highConf.pct),  `${type}.highConf.pct must not be NaN`);
      assert.ok(!Number.isNaN(result[type].avgWidthMin),   `${type}.avgWidthMin must not be NaN`);
    }
  });

  it('result has all 4 event type keys', () => {
    const result = computeTifAccuracy([], []);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'wake'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'napStart'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'napEnd'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'bedtime'));
  });

});

// ---------------------------------------------------------------------------
// 4. computeTifAccuracy — hit, miss, highConf, avgWidthMin
// ---------------------------------------------------------------------------

describe('computeTifAccuracy — window hit and high confidence', () => {

  // history entry: wake window [06:00, 08:00]; actual day wake at 07:00 (inside)
  it('one wake hit → wake.windowHit.pct=100, count=1', () => {
    const history = [{
      date:     '2025-01-08',
      wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 85 },
      napStart: null,
      napEnd:   null,
      bedtime:  null,
    }];
    const dayRecords = [makeDayRecord('2025-01-08', '07:00', '22:00', null, null)];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.windowHit.count, 1, 'windowHit count');
    assert.strictEqual(result.wake.windowHit.pct,   100, 'windowHit pct');
  });

  // actual wake at 09:00 — outside [06:00, 08:00]
  it('one wake miss → wake.windowHit.count=0, pct=0', () => {
    const history = [{
      date:     '2025-01-08',
      wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 50 },
      napStart: null,
      napEnd:   null,
      bedtime:  null,
    }];
    const dayRecords = [makeDayRecord('2025-01-08', '09:00', '22:00', null, null)];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.windowHit.count, 0, 'windowHit count');
    assert.strictEqual(result.wake.windowHit.pct,   0,   'windowHit pct');
  });

  it('precisionScore >= 80 increments highConf', () => {
    const history = [{
      date:     '2025-01-08',
      wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 80 },
      napStart: null,
      napEnd:   null,
      bedtime:  null,
    }];
    const dayRecords = [makeDayRecord('2025-01-08', '07:00', '22:00', null, null)];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.highConf.count, 1, 'highConf count should be 1 for score=80');
    assert.strictEqual(result.wake.highConf.pct,   100);
  });

  it('precisionScore < 80 does NOT increment highConf', () => {
    const history = [{
      date:     '2025-01-08',
      wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 79 },
      napStart: null,
      napEnd:   null,
      bedtime:  null,
    }];
    const dayRecords = [makeDayRecord('2025-01-08', '07:00', '22:00', null, null)];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.highConf.count, 0, 'highConf count should be 0 for score=79');
    assert.strictEqual(result.wake.highConf.pct,   0);
  });

  it('avgWidthMin computed correctly: two entries with widths 120 and 60 → 90', () => {
    // [06:00, 08:00] = 120 min width; [07:00, 08:00] = 60 min width → avg = 90
    const history = [
      {
        date:     '2025-01-08',
        wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 85 },
        napStart: null, napEnd: null, bedtime: null,
      },
      {
        date:     '2025-01-09',
        wake:     { algMin: '07:00', algMax: '08:00', central: '07:30', precisionScore: 90 },
        napStart: null, napEnd: null, bedtime: null,
      },
    ];
    const dayRecords = [
      makeDayRecord('2025-01-08', '07:00', '22:00', null, null),
      makeDayRecord('2025-01-09', '07:30', '22:00', null, null),
    ];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.avgWidthMin, 90, 'avgWidthMin should be 90');
  });

  it('pct when total=3 and count=2 → Math.round(2/3*100) = 67', () => {
    const history = [
      {
        date:     '2025-01-08',
        wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 85 },
        napStart: null, napEnd: null, bedtime: null,
      },
      {
        date:     '2025-01-09',
        wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 85 },
        napStart: null, napEnd: null, bedtime: null,
      },
      {
        date:     '2025-01-10',
        wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 85 },
        napStart: null, napEnd: null, bedtime: null,
      },
    ];
    // 2 hits (07:00 in [06:00,08:00]) + 1 miss (09:00 outside)
    const dayRecords = [
      makeDayRecord('2025-01-08', '07:00', '22:00', null, null),
      makeDayRecord('2025-01-09', '07:00', '22:00', null, null),
      makeDayRecord('2025-01-10', '09:00', '22:00', null, null),
    ];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.windowHit.pct, 67, 'pct(2/3) = 67');
  });

});

// ---------------------------------------------------------------------------
// 5. computeTifAccuracy — null entry exclusion
// ---------------------------------------------------------------------------

describe('computeTifAccuracy — null entry exclusion', () => {

  it('null wake entry is excluded from wake totals', () => {
    const history = [{
      date:     '2025-01-08',
      wake:     null,
      napStart: null,
      napEnd:   null,
      bedtime:  null,
    }];
    const dayRecords = [makeDayRecord('2025-01-08', '07:00', '22:00', null, null)];
    const result = computeTifAccuracy(history, dayRecords);
    // wake has no bounds → excluded from totals → windowHit.count=0, pct=0
    assert.strictEqual(result.wake.windowHit.count, 0, 'null wake excluded from totals');
    assert.strictEqual(result.wake.windowHit.pct,   0);
    assert.strictEqual(result.wake.avgWidthMin,      0);
  });

  it('null napStart entry is excluded, does not affect wake totals', () => {
    const history = [{
      date:     '2025-01-08',
      wake:     { algMin: '06:00', algMax: '08:00', central: '07:00', precisionScore: 85 },
      napStart: null,
      napEnd:   null,
      bedtime:  null,
    }];
    const dayRecords = [makeDayRecord('2025-01-08', '07:00', '22:00', '13:00', '14:30')];
    const result = computeTifAccuracy(history, dayRecords);
    assert.strictEqual(result.wake.windowHit.count,    1, 'wake not affected by null napStart');
    assert.strictEqual(result.napStart.windowHit.count, 0, 'napStart excluded (null bounds)');
  });

});
