// tests/unit/forecast-utils.test.js
// Unit tests for js/lib/forecast-utils.js — event-reachability determination.
//
// TDD: RED → GREEN → REFACTOR (Phase 21 Plan 21-01, D-06/D-07/D-14).
// Run: node --test tests/unit/forecast-utils.test.js
//
// Test groups:
//   1. selectNextEvent(predictions, dayRecords) — cycle-aware priority (moved from
//      forecast.test.js, D3-10) — three assertions updated for the D-07 5-path model
//   2. selectNextEvent() edge cases (moved from forecast.test.js)
//   3. selectNextEvent — PRED-08 evening-hour override (moved from forecast.test.js, D-07)
//   4. nextReachableEvent(lastEvent, currentHour, settings) — the pure 5-path table + boundaries

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { nextReachableEvent, selectNextEvent } from '../../js/lib/forecast-utils.js';

// ---------------------------------------------------------------------------
// 1. selectNextEvent(predictions, dayRecords) — cycle-aware priority (D3-10)
// ---------------------------------------------------------------------------
//
// Priority ordering (D3-10), now expressed via nextReachableEvent's 5-path
// model (D-07):
//   Last event = bedtime    → wake
//   Last event = wake       → napStart (+ bedtimeAfterWake fallback)
//   Last event = napStart   → napEnd
//   Last event = napEnd     → bedtimeAfterNap (normalizes to 'bedtime')

describe('selectNextEvent(predictions, dayRecords)', () => {
  // Helper: build a mock day record with allEvents list
  function makeDayWithEvents(events) {
    // events is array of { type, at } objects (minimal shape for lastEvent detection)
    return { wake: null, bedtime: null, napStart: null, napEnd: null, rejected: false, allEvents: events };
  }

  // Standard predictions shape: { central, min, max } for each event type
  const predictions = {
    wake:     { central: '07:00', min: '06:30', max: '07:30' },
    bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
    napStart: { central: '13:00', min: '12:30', max: '13:30' },
    napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
  };

  it('last event = bedtime → selects wake (priority 1 per D3-10)', () => {
    // bedtime branch → reachable = ['wake']
    const dayRecords = [
      makeDayWithEvents([{ type: 'bedtime', at: '2026-06-01T21:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'wake');
  });

  it('last event = wake → selects napStart (priority 1 per D3-10)', () => {
    // wake branch → reachable = ['napStart', 'bedtimeAfterWake']; napStart present → resolves first
    // eveningHour=25 disables the D-05 drop so napStart stays reachable (CI-safe)
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:30' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords, { eveningHour: 25 });
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'napStart');
  });

  it('last event = napStart → selects napEnd (priority 1 per D3-10)', () => {
    // napStart branch → reachable = ['napEnd']
    const dayRecords = [
      makeDayWithEvents([{ type: 'napStart', at: '2026-06-02T13:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'napEnd');
  });

  it('last event = napEnd → selects bedtime (priority 1 per D3-10)', () => {
    // napEnd branch → reachable = ['bedtimeAfterNap'], which normalizes to 'bedtime' (D-07)
    const dayRecords = [
      makeDayWithEvents([{ type: 'napEnd', at: '2026-06-02T14:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'bedtime');
  });

  it('last event = wake; only bedtime in predictions (no napStart) → resolves via bedtimeAfterWake fallback', () => {
    // wake branch → reachable = ['napStart', 'bedtimeAfterWake']; napStart missing from
    // predictions → falls through to bedtimeAfterWake, which (no predictions.bedtimeAfterWake
    // field yet) falls back to predictions.bedtime — reported as type 'bedtimeAfterWake' (D-07:
    // RESULT_TYPE keeps this branch's own literal, distinct from a plain 'bedtime' resolution).
    const partialPredictions = {
      wake:    { central: '07:00', min: '06:30', max: '07:30' },
      bedtime: { central: '21:00', min: '20:30', max: '21:30' },
      // napStart missing
      // napEnd missing
    };
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:30' }]),
    ];
    const result = selectNextEvent(partialPredictions, dayRecords, { eveningHour: 25 });
    assert.ok(result !== null, 'should return a prediction even with missing tier');
    assert.strictEqual(result.type, 'bedtimeAfterWake');
  });

  it('no events logged (dayRecords empty) → returns null', () => {
    const result = selectNextEvent(predictions, []);
    assert.strictEqual(result, null);
  });

  it('dayRecords present but all allEvents arrays empty → returns null', () => {
    const dayRecords = [
      makeDayWithEvents([]),
      makeDayWithEvents([]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.strictEqual(result, null);
  });

  it('result has { type, central, min, max } shape', () => {
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords, { eveningHour: 25 });
    assert.ok(result !== null, 'result should not be null');
    assert.ok('type' in result, 'result should have type');
    assert.ok('central' in result, 'result should have central');
    assert.ok('min' in result, 'result should have min');
    assert.ok('max' in result, 'result should have max');
  });

  it('most recent event is determined by allEvents list across multiple days', () => {
    // Two days — last event in most recent day should determine priority
    const dayRecords = [
      makeDayWithEvents([
        { type: 'bedtime', at: '2026-06-01T21:00' },  // older day
      ]),
      makeDayWithEvents([
        { type: 'wake', at: '2026-06-02T07:00' },      // most recent day's latest event
        { type: 'napStart', at: '2026-06-02T13:00' },  // MOST RECENT overall
      ]),
    ];
    // Last event = napStart → should select napEnd
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction');
    assert.strictEqual(result.type, 'napEnd');
  });
});

// ---------------------------------------------------------------------------
// 2. selectNextEvent() edge cases
// ---------------------------------------------------------------------------

describe('selectNextEvent() edge cases', () => {
  function makeDayWithEvents(events) {
    return { wake: null, bedtime: null, napStart: null, napEnd: null, rejected: false, allEvents: events };
  }

  const predictions = {
    wake:     { central: '07:00', min: '06:30', max: '07:30' },
    bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
    napStart: { central: '13:00', min: '12:30', max: '13:30' },
    napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
  };

  it('no events logged (dayRecords=[]) → returns null', () => {
    const result = selectNextEvent(predictions, []);
    assert.strictEqual(result, null);
  });

  it('prediction is null/missing for priority tier → resolves via bedtimeAfterWake fallback', () => {
    // wake branch → reachable = ['napStart', 'bedtimeAfterWake']. napStart missing from
    // predictions → falls through to bedtimeAfterWake, which falls back to predictions.bedtime
    // (present) — reported as type 'bedtimeAfterWake', deterministic regardless of whether the
    // D-05 drop fires (either path in nextReachableEvent lands on the same fallback here).
    const partialPredictions = {
      wake:    { central: '07:00', min: '06:30', max: '07:30' },
      bedtime: { central: '21:00', min: '20:30', max: '21:30' },
      // napStart intentionally missing
      napEnd:  { central: '14:00', min: '13:30', max: '14:30' },
    };
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(partialPredictions, dayRecords);
    assert.ok(result !== null, 'should not return null when a lower-tier prediction is available');
    assert.strictEqual(result.type, 'bedtimeAfterWake');
  });

  it('last event type unknown → falls back to default priority (wake first)', () => {
    // Unknown event type → nextReachableEvent's default path is ['wake'] (D-07)
    const dayRecords = [
      makeDayWithEvents([{ type: 'unknownCustomType', at: '2026-06-02T12:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'should return a prediction even for unknown event types');
    assert.strictEqual(result.type, 'wake');
  });

  it('all tiers missing from predictions → returns null', () => {
    const emptyPredictions = {};
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(emptyPredictions, dayRecords);
    assert.strictEqual(result, null);
  });

  it('result is deterministic: same input → same output (no random tiebreaking)', () => {
    const dayRecords = [
      makeDayWithEvents([{ type: 'bedtime', at: '2026-06-01T21:00' }]),
    ];
    const result1 = selectNextEvent(predictions, dayRecords);
    const result2 = selectNextEvent(predictions, dayRecords);
    assert.deepStrictEqual(result1, result2, 'same input should always produce the same output');
  });

  it('isMissed field is present on result', () => {
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(predictions, dayRecords, { eveningHour: 25 });
    assert.ok(result !== null, 'result should not be null');
    assert.ok('isMissed' in result, 'result should have isMissed field');
    assert.ok(typeof result.isMissed === 'boolean', 'isMissed should be boolean');
  });

  it('probabilityBand prediction: result carries probabilityBand instead of central/min/max', () => {
    // When a prediction uses the probabilityBand shape, selectNextEvent should pass it through
    const bandPredictions = {
      wake:     { central: '07:00', min: '06:30', max: '07:30' },
      bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
      napStart: { probabilityBand: [{ time: '13:00', prob: 50 }, { time: '13:30', prob: 90 }] },
      napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
    };
    // Last event = wake → reachable = ['napStart', 'bedtimeAfterWake']; napStart present → resolves first
    // eveningHour=25 disables the D-05 drop so napStart stays reachable (CI-safe)
    const dayRecords = [
      makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }]),
    ];
    const result = selectNextEvent(bandPredictions, dayRecords, { eveningHour: 25 });
    assert.ok(result !== null, 'should return napStart even though it uses probabilityBand shape');
    assert.strictEqual(result.type, 'napStart');
    assert.ok('probabilityBand' in result, 'result should carry probabilityBand from prediction');
    assert.ok(!('central' in result), 'result should NOT have central when prediction uses probabilityBand');
  });
});

// ---------------------------------------------------------------------------
// 3. selectNextEvent — PRED-08 evening-hour override (D-07)
// ---------------------------------------------------------------------------
//
// Tests use time-invariant eveningHour values to avoid CI flakiness:
//   eveningHour=0  → always fires (any hour >= 0)
//   eveningHour=25 → never fires  (no hour >= 25)
//
// This tests the semantic contract, not a specific wall-clock time.

describe('selectNextEvent — PRED-08 evening-hour override', () => {
  function makeDayWithEvents(events) {
    return { wake: null, bedtime: null, napStart: null, napEnd: null, rejected: false, allEvents: events };
  }

  const predictions = {
    wake:     { central: '07:00', min: '06:30', max: '07:30' },
    napStart: { central: '13:00', min: '12:30', max: '13:30' },
    napEnd:   { central: '14:00', min: '13:30', max: '14:30' },
    bedtime:  { central: '21:00', min: '20:30', max: '21:30' },
  };

  it('eveningHour=0, lastEvent.type=wake → returns bedtimeAfterWake (override always fires at any hour, D-05)', () => {
    // napStartDropped fires (currentHour >= 0 always) → reachable = ['bedtimeAfterWake'].
    // predictions has no bedtimeAfterWake field yet → falls back to predictions.bedtime,
    // reported as type 'bedtimeAfterWake' (D-07's own literal for this branch).
    const dayRecords = [makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }])];
    const result = selectNextEvent(predictions, dayRecords, { eveningHour: 0 });
    assert.ok(result !== null, 'result should not be null');
    assert.strictEqual(result.type, 'bedtimeAfterWake', 'evening-hour override must drop napStart when eveningHour=0 and lastEvent=wake');
  });

  it('eveningHour=25, lastEvent.type=wake → returns napStart (override never fires, falls through to normal switch)', () => {
    const dayRecords = [makeDayWithEvents([{ type: 'wake', at: '2026-06-02T07:00' }])];
    const result = selectNextEvent(predictions, dayRecords, { eveningHour: 25 });
    assert.ok(result !== null, 'result should not be null');
    assert.strictEqual(result.type, 'napStart', 'normal switch must select napStart when eveningHour=25 (never fires)');
  });

  it('eveningHour=0, lastEvent.type=bedtime → returns wake (rule only fires when lastEvent is wake)', () => {
    const dayRecords = [makeDayWithEvents([{ type: 'bedtime', at: '2026-06-01T21:00' }])];
    const result = selectNextEvent(predictions, dayRecords, { eveningHour: 0 });
    assert.ok(result !== null, 'result should not be null');
    assert.strictEqual(result.type, 'wake', 'evening-hour rule must NOT fire when lastEvent is bedtime');
  });

  it('no settings param → behaves as before (default eveningHour=18, normal switch)', () => {
    // With no settings param, no override fires unless current hour >= 18.
    // We use lastEvent=napEnd which never triggers the evening-hour rule regardless.
    const dayRecords = [makeDayWithEvents([{ type: 'napEnd', at: '2026-06-02T14:00' }])];
    const result = selectNextEvent(predictions, dayRecords);
    assert.ok(result !== null, 'result should not be null');
    assert.strictEqual(result.type, 'bedtime', 'napEnd → bedtime via normal switch (no settings param)');
  });
});

// ---------------------------------------------------------------------------
// 4. nextReachableEvent(lastEvent, currentHour, settings) — the pure 5-path table (D-07)
// ---------------------------------------------------------------------------

describe('nextReachableEvent(lastEvent, currentHour, settings)', () => {
  it("lastEvent.type='bedtime' → ['wake']", () => {
    const result = nextReachableEvent({ type: 'bedtime', at: '2026-06-01T21:00' }, 7, {});
    assert.deepStrictEqual(result, ['wake']);
  });

  it("lastEvent.type='wake', nap still reachable → ['napStart', 'bedtimeAfterWake']", () => {
    const result = nextReachableEvent({ type: 'wake', at: '2026-06-02T07:00' }, 10, { eveningHour: 18, napWindowClosed: false });
    assert.deepStrictEqual(result, ['napStart', 'bedtimeAfterWake']);
  });

  it("lastEvent.type='wake', napWindowClosed:true → ['bedtimeAfterWake'] (D-05)", () => {
    const result = nextReachableEvent({ type: 'wake', at: '2026-06-02T07:00' }, 10, { eveningHour: 18, napWindowClosed: true });
    assert.deepStrictEqual(result, ['bedtimeAfterWake']);
  });

  it("lastEvent.type='wake', currentHour >= eveningHour → ['bedtimeAfterWake'] (D-05)", () => {
    const result = nextReachableEvent({ type: 'wake', at: '2026-06-02T07:00' }, 19, { eveningHour: 18, napWindowClosed: false });
    assert.deepStrictEqual(result, ['bedtimeAfterWake']);
  });

  it("lastEvent.type='napStart' → ['napEnd']", () => {
    const result = nextReachableEvent({ type: 'napStart', at: '2026-06-02T13:00' }, 13, {});
    assert.deepStrictEqual(result, ['napEnd']);
  });

  it("lastEvent.type='napEnd' → ['bedtimeAfterNap']", () => {
    const result = nextReachableEvent({ type: 'napEnd', at: '2026-06-02T14:00' }, 14, {});
    assert.deepStrictEqual(result, ['bedtimeAfterNap']);
  });

  it("unknown lastEvent.type → ['wake']", () => {
    const result = nextReachableEvent({ type: 'unknownCustomType', at: '2026-06-02T12:00' }, 12, {});
    assert.deepStrictEqual(result, ['wake']);
  });

  it('null lastEvent (defensive) → wake-first default path', () => {
    const result = nextReachableEvent(null, 12, {});
    assert.deepStrictEqual(result, ['wake']);
  });

  it('eveningHour boundary: currentHour === eveningHour exactly → drop fires (>=, not >)', () => {
    const result = nextReachableEvent({ type: 'wake', at: '2026-06-02T07:00' }, 18, { eveningHour: 18, napWindowClosed: false });
    assert.deepStrictEqual(result, ['bedtimeAfterWake']);
  });

  it('eveningHour boundary: currentHour === eveningHour - 1 → drop does NOT fire', () => {
    const result = nextReachableEvent({ type: 'wake', at: '2026-06-02T07:00' }, 17, { eveningHour: 18, napWindowClosed: false });
    assert.deepStrictEqual(result, ['napStart', 'bedtimeAfterWake']);
  });

  it('no settings param → defaults to eveningHour:18, napWindowClosed:false', () => {
    const result = nextReachableEvent({ type: 'wake', at: '2026-06-02T07:00' }, 10);
    assert.deepStrictEqual(result, ['napStart', 'bedtimeAfterWake']);
  });
});
