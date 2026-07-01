// tests/integration/rejected-days-forecast-sync.test.js
// Integration test: settings.update({ rejectedDays }) → subscriber fires →
// forecast re-computes with rejection state applied.
//
// Decisions: D4-05 (rejection derived at render time), D4-09 (forecast
// re-computes on settings change), D3-12 (settings-change path), D3-03
// (rejected days downweighted 0.5×).
//
// Phase 4, Plan 01 — Task 3
// Run: node --test tests/integration/rejected-days-forecast-sync.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createSettingsStore } from '../../js/store/settings.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { daysBySubjectiveNight } from '../../js/lib/day-bucket.js';
import { forecast } from '../../js/lib/forecast.js';

// ---------------------------------------------------------------------------
// Test helpers — mirrors forecast-flow.test.js setup pattern
// ---------------------------------------------------------------------------

function makeSharedStorage() {
  return createStorageMemory();
}

function makeId() {
  let n = 1;
  return () => `e${n++}`;
}

function makeSetup(frozenAt = new Date(2026, 5, 1, 8, 0)) {
  const storage = makeSharedStorage();
  const clock = createClockFixed(frozenAt);
  const id = makeId();
  const eventLog = createEventLog({ storage, clock, id });
  const settings = createSettingsStore({ storage });
  return { storage, clock, eventLog, settings };
}

function addAt(eventLog, type, atString) {
  return eventLog.addEventAt(type, atString);
}

// ---------------------------------------------------------------------------
// Test 1: settings.update({ rejectedDays }) fires subscriber synchronously
// ---------------------------------------------------------------------------

describe('settings.update({ rejectedDays }) fires subscriber synchronously', () => {
  it('subscriber is called once with the updated snapshot containing rejectedDays', () => {
    const { settings } = makeSetup();

    let callCount = 0;
    let lastSnap = null;

    const unsub = settings.subscribe((snap) => {
      callCount++;
      lastSnap = snap;
    });

    settings.update({ rejectedDays: ['2026-05-20'] });

    assert.strictEqual(callCount, 1, 'subscriber must fire exactly once on update()');
    assert.ok(lastSnap !== null, 'subscriber must receive a snapshot');
    assert.deepEqual(lastSnap.rejectedDays, ['2026-05-20'],
      'snapshot must include the updated rejectedDays');

    unsub();
  });
});

// ---------------------------------------------------------------------------
// Test 2: day.rejected boolean is computed correctly via day-bucket
// ---------------------------------------------------------------------------

describe('day.rejected boolean computed from settings.rejectedDays', () => {
  it('daysBySubjectiveNight returns rejected=true for days in the list', () => {
    const { eventLog, settings } = makeSetup();

    // Log 3 days of wake events
    addAt(eventLog, 'wake', '2026-05-20T06:30');
    addAt(eventLog, 'wake', '2026-05-21T06:45');
    addAt(eventLog, 'wake', '2026-05-22T07:00');

    const snap0 = settings.get();

    // Compute days with no rejection settings
    const events = eventLog.daysBySubjectiveNight(snap0.cutoverHour);
    // Using the day-bucket directly with settings to test rejection annotation
    const allEvents = eventLog.daysBySubjectiveNight(snap0.cutoverHour);
    // All days should have rejected=false since rejectedDays is still empty
    // (the event-log wrapper doesn't pass settings yet — Wave 4 wires that)
    // Instead, call day-bucket directly with settings to exercise the annotation:
    const rawEvents = [];
    for (const day of allEvents) {
      for (const evt of day.allEvents) {
        rawEvents.push(evt);
      }
    }

    const settingsSnap = settings.get();
    const daysNoRejection = daysBySubjectiveNight(rawEvents, settingsSnap.cutoverHour, undefined, settingsSnap);
    assert.ok(daysNoRejection.every(d => d.rejected === false),
      'all days rejected=false before any rejection is set');

    // Reject one specific day
    settings.update({ rejectedDays: ['2026-05-21'] });
    const updatedSnap = settings.get();

    const daysWithRejection = daysBySubjectiveNight(rawEvents, updatedSnap.cutoverHour, undefined, updatedSnap);
    const day21 = daysWithRejection.find(d => d.date === '2026-05-21');
    const day20 = daysWithRejection.find(d => d.date === '2026-05-20');
    const day22 = daysWithRejection.find(d => d.date === '2026-05-22');

    assert.equal(day21.rejected, true, '2026-05-21 should be rejected');
    assert.equal(day20.rejected, false, '2026-05-20 should not be rejected');
    assert.equal(day22.rejected, false, '2026-05-22 should not be rejected');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Forecast changes when a day is marked rejected (D3-03, 0.5× weight)
// ---------------------------------------------------------------------------

describe('forecast re-computes with downweighting when rejectedDays is updated', () => {
  it('forecast central time shifts after marking an outlier day as rejected', () => {
    // Arrange: 7 days with spread chosen so that downweighting the outlier (09:00)
    // shifts the P50 median by at least one 5-minute step after rounding.
    //
    // Wake times (minutes): [360, 375, 390, 405, 420, 480, 540]
    //   = 06:00, 06:15, 06:30, 06:45, 07:00, 08:00, 09:00
    //
    // Without rejection (effectiveCount=7):
    //   P50 pos = 0.5 × 8 = 4, k=3 → 405 min = 06:45
    //
    // With 2026-05-26 (09:00 = 540 min) rejected at 0.5× (effectiveCount=6.5):
    //   P50 pos = 0.5 × 7.5 = 3.75, k=2, frac=0.75
    //   result = 390 + 0.75 × (405-390) = 390 + 11.25 = 401.25 → round to 400 = 06:40
    //
    // So baseline central = 06:45 and rejected central = 06:40 — a clear 5-min shift.
    const { settings } = makeSetup();

    const days = [
      { date: '2026-05-20', wake: '06:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-21', wake: '06:15', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-22', wake: '06:30', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-23', wake: '06:45', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-24', wake: '07:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-25', wake: '08:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-26', wake: '09:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
    ];

    // maxDelta=300 (5 hours) keeps the 180-min spread from triggering probabilityBand,
    // so we get a clean { central, min, max } shape for comparison.
    const settingsSnap = { ...settings.get(), minDays: 0, maxDelta: 300 };

    // Forecast with all days active (no rejection)
    const result1 = forecast(days, settingsSnap);
    assert.ok(!result1.isColdStart, 'should not be cold-start with minDays=0');
    assert.ok(result1.wake, 'should have wake prediction');
    const central1 = result1.wake.central;

    // Now mark the outlier day (2026-05-26 at 09:00) as rejected
    const daysWithRejection = days.map(d =>
      d.date === '2026-05-26' ? { ...d, rejected: true } : d,
    );

    // Forecast with the outlier downweighted
    const result2 = forecast(daysWithRejection, settingsSnap);
    assert.ok(!result2.isColdStart, 'should still not be cold-start');
    assert.ok(result2.wake, 'should still have wake prediction');
    const central2 = result2.wake.central;

    // The rejected outlier (09:00) is downweighted at 0.5× (D3-03).
    // The median should shift toward the cluster of normal wake times.
    assert.notStrictEqual(central2, central1,
      `forecast wake central should shift when outlier is downweighted: was ${central1}, got ${central2}`);

    // With the outlier downweighted, the central time should move earlier
    // (toward 06:30..06:55 cluster), not later (away from 09:00).
    // Parse the central times for comparison:
    function toMinutes(hhmm) {
      const h = parseInt(hhmm.slice(0, 2), 10);
      const m = parseInt(hhmm.slice(3, 5), 10);
      return h * 60 + m;
    }
    const min1 = toMinutes(central1);
    const min2 = toMinutes(central2);
    assert.ok(min2 < min1,
      `with outlier rejected, central wake should be EARLIER: was ${central1} (${min1}min), got ${central2} (${min2}min)`);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Full round-trip — settings.update() → re-compute via subscriber
// ---------------------------------------------------------------------------

describe('full round-trip: settings.update rejectedDays → subscriber → forecast', () => {
  it('subscriber-triggered re-compute produces different forecast than pre-rejection baseline', () => {
    const { settings } = makeSetup();

    // Synthetic days with an outlier (same data shape as Test 3 for consistency)
    const baseDays = [
      { date: '2026-05-20', wake: '06:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-21', wake: '06:15', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-22', wake: '06:30', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-23', wake: '06:45', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-24', wake: '07:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-25', wake: '08:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-26', wake: '09:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
    ];

    // Track forecasts produced inside subscriber
    const forecastSnapshots = [];

    const unsub = settings.subscribe((snap) => {
      // Re-compute days with rejection state from updated settings
      const days = baseDays.map(d => ({
        ...d,
        rejected: snap.rejectedDays.includes(d.date),
      }));
      const settingsForForecast = { ...snap, minDays: 0, maxDelta: 300 };
      forecastSnapshots.push(forecast(days, settingsForForecast));
    });

    // Baseline forecast (no rejection)
    const baseSnap = { ...settings.get(), minDays: 0, maxDelta: 300 };
    const baseline = forecast(baseDays, baseSnap);

    // Trigger settings update → subscriber fires → forecast in subscriber
    settings.update({ rejectedDays: ['2026-05-26'] });

    unsub();

    assert.strictEqual(forecastSnapshots.length, 1, 'subscriber fired once');
    const subscriberForecast = forecastSnapshots[0];

    assert.ok(!subscriberForecast.isColdStart, 'subscriber forecast should not be cold-start');
    assert.ok(subscriberForecast.wake, 'subscriber forecast should have wake prediction');

    // The subscriber-triggered forecast should differ from the baseline
    assert.notStrictEqual(
      subscriberForecast.wake.central,
      baseline.wake.central,
      `subscriber forecast central time should differ from baseline: baseline=${baseline.wake.central}, subscriber=${subscriberForecast.wake.central}`,
    );
  });

  it('clearing rejectedDays restores the forecast to the pre-rejection value', () => {
    const { settings } = makeSetup();

    const baseDays = [
      { date: '2026-05-20', wake: '06:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-21', wake: '06:15', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-22', wake: '06:30', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-23', wake: '06:45', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-24', wake: '07:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-25', wake: '08:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-26', wake: '09:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
    ];

    function computeForecast(snap) {
      const days = baseDays.map(d => ({
        ...d,
        rejected: snap.rejectedDays.includes(d.date),
      }));
      return forecast(days, { ...snap, minDays: 0, maxDelta: 300 });
    }

    // Baseline: no rejection
    const baseline = computeForecast(settings.get());
    const centralBaseline = baseline.wake.central;

    // Reject the outlier
    settings.update({ rejectedDays: ['2026-05-26'] });
    const withRejection = computeForecast(settings.get());
    const centralWithRejection = withRejection.wake.central;

    assert.notStrictEqual(centralWithRejection, centralBaseline,
      'forecast should differ after rejection');

    // Clear the rejection
    settings.update({ rejectedDays: [] });
    const restored = computeForecast(settings.get());
    const centralRestored = restored.wake.central;

    assert.strictEqual(centralRestored, centralBaseline,
      `clearing rejectedDays should restore the baseline forecast: expected=${centralBaseline}, got=${centralRestored}`);
  });
});
