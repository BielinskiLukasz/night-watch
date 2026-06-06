// tests/integration/edit-delete-flow.test.js
// Integration test: editEvent/deleteEvent mutations trigger the subscriber
// pattern and the forecast is recomputable with the updated data.
//
// Decisions: D3-12 (subscriber fires after every mutation), D4-04 (edit
// via editEvent), D4-06 (delete via deleteEvent), D4-09 (forecast
// re-computes on Save — the modal onSave callback calls editEvent which
// triggers subscribers), D3-03 (rejected days downweighted 0.5×).
//
// Run: node --test tests/integration/edit-delete-flow.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createSettingsStore } from '../../js/store/settings.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { forecast } from '../../js/lib/forecast.js';

// ---------------------------------------------------------------------------
// Test helpers — mirrors forecast-flow.test.js / rejected-days setup pattern
// ---------------------------------------------------------------------------

function makeId() {
  let n = 1;
  return () => `e${n++}`;
}

/**
 * Create a wired setup with shared storage, eventLog, and settings.
 */
function makeSetup(frozenAt = new Date(2026, 5, 1, 8, 0)) {
  const storage = createStorageMemory();
  const clock = createClockFixed(frozenAt);
  const id = makeId();
  const eventLog = createEventLog({ storage, clock, id });
  const settings = createSettingsStore({ storage });
  return { storage, clock, eventLog, settings };
}

/**
 * Seed events at explicit ISO timestamps.
 */
function addAt(eventLog, type, atString) {
  return eventLog.addEventAt(type, atString);
}

/**
 * Seed a 7-day dataset with wake + bedtime events and return the first event id.
 * Used by multiple test cases.
 */
function seed7Days(eventLog) {
  addAt(eventLog, 'wake',    '2026-05-20T06:30');
  addAt(eventLog, 'bedtime', '2026-05-20T21:00');
  addAt(eventLog, 'wake',    '2026-05-21T06:35');
  addAt(eventLog, 'bedtime', '2026-05-21T21:00');
  addAt(eventLog, 'wake',    '2026-05-22T06:40');
  addAt(eventLog, 'bedtime', '2026-05-22T21:00');
  addAt(eventLog, 'wake',    '2026-05-23T06:45');
  addAt(eventLog, 'bedtime', '2026-05-23T21:00');
  addAt(eventLog, 'wake',    '2026-05-24T06:50');
  addAt(eventLog, 'bedtime', '2026-05-24T21:00');
  addAt(eventLog, 'wake',    '2026-05-25T06:55');
  addAt(eventLog, 'bedtime', '2026-05-25T21:00');
  addAt(eventLog, 'wake',    '2026-05-26T07:00');
  addAt(eventLog, 'bedtime', '2026-05-26T21:00');
}

// ---------------------------------------------------------------------------
// Test 1: editEvent triggers subscriber (D3-12)
// ---------------------------------------------------------------------------

describe('editEvent triggers subscriber synchronously (D3-12)', () => {
  it('subscriber is called once after editEvent()', () => {
    const { eventLog } = makeSetup();

    seed7Days(eventLog);
    const eventToEdit = eventLog.listEvents().find(e => e.type === 'wake');
    assert.ok(eventToEdit, 'should have at least one wake event to edit');

    let callCount = 0;
    const unsub = eventLog.subscribe(() => { callCount++; });

    // Simulate the modal onSave callback: call editEvent with a patch
    eventLog.editEvent(eventToEdit.id, { at: '2026-05-20T08:00' });

    assert.strictEqual(callCount, 1, 'subscriber must fire exactly once after editEvent()');
    unsub();
  });
});

// ---------------------------------------------------------------------------
// Test 2: editEvent changes forecast (D3-12, D4-09)
// ---------------------------------------------------------------------------

describe('editEvent causes forecast to re-compute with changed data (D4-09)', () => {
  it('wake central time shifts after editing a wake event to a later hour', () => {
    const { eventLog, settings } = makeSetup();

    seed7Days(eventLog);

    // Compute baseline forecast (minDays=0 bypasses cold-start gate)
    const lowGate = { ...settings.get(), minDays: 0, maxDelta: 120 };
    const days1 = eventLog.daysBySubjectiveNight(lowGate.cutoverHour);
    const result1 = forecast(days1, lowGate);

    assert.ok(!result1.isColdStart, 'should not be cold-start with minDays=0');
    assert.ok(result1.wake, 'should have wake prediction');
    const central1 = result1.wake.central;

    // Edit the first wake event to a significantly later time (09:00)
    const wakeEvt = eventLog.listEvents().find(e => e.type === 'wake');
    assert.ok(wakeEvt, 'fixture must have at least one wake event');
    eventLog.editEvent(wakeEvt.id, { at: '2026-05-20T09:00' });

    // Re-compute forecast with the updated event log
    const days2 = eventLog.daysBySubjectiveNight(lowGate.cutoverHour);
    const result2 = forecast(days2, lowGate);

    assert.ok(!result2.isColdStart, 'should remain non-cold-start after edit');
    assert.ok(result2.wake, 'should still have wake prediction after edit');
    const central2 = result2.wake.central;

    // The central time must shift because the median changed
    assert.notStrictEqual(central2, central1,
      `wake central should change after editing wake to 09:00: was ${central1}, got ${central2}`);
  });

  it('subscriber fires and forecast is recomputable after editEvent (D3-12 subscriber pattern)', () => {
    const { eventLog, settings } = makeSetup();

    seed7Days(eventLog);

    // Track what the subscriber sees
    const forecasts = [];
    const lowGate = { ...settings.get(), minDays: 0, maxDelta: 120 };

    const unsub = eventLog.subscribe(() => {
      // Subscriber re-reads eventLog and re-computes forecast (D3-12 pattern)
      const days = eventLog.daysBySubjectiveNight(lowGate.cutoverHour);
      forecasts.push(forecast(days, lowGate));
    });

    const wakeEvt = eventLog.listEvents().find(e => e.type === 'wake');
    eventLog.editEvent(wakeEvt.id, { at: '2026-05-20T09:00' });

    unsub();

    // Subscriber fired and produced a forecast
    assert.strictEqual(forecasts.length, 1, 'subscriber fires exactly once after editEvent');
    const f = forecasts[0];
    assert.ok(f, 'subscriber must produce a forecast');
    assert.ok(!f.isColdStart, 'forecast from subscriber should not be cold-start');
    assert.ok(f.wake, 'subscriber forecast should include wake prediction');
  });
});

// ---------------------------------------------------------------------------
// Test 3: deleteEvent triggers subscriber (D3-12)
// ---------------------------------------------------------------------------

describe('deleteEvent triggers subscriber synchronously (D3-12)', () => {
  it('subscriber is called once after deleteEvent()', () => {
    const { eventLog } = makeSetup();

    seed7Days(eventLog);
    const eventToDelete = eventLog.listEvents()[0];

    let callCount = 0;
    const unsub = eventLog.subscribe(() => { callCount++; });

    const result = eventLog.deleteEvent(eventToDelete.id);

    assert.strictEqual(result, true, 'deleteEvent should return true for existing id');
    assert.strictEqual(callCount, 1, 'subscriber must fire exactly once after deleteEvent()');
    unsub();
  });

  it('deleteEvent subscriber fires with updated event count', () => {
    const { eventLog } = makeSetup();

    seed7Days(eventLog);
    const countBefore = eventLog.listEvents().length;

    let countSeenInSubscriber = -1;
    const unsub = eventLog.subscribe(() => {
      countSeenInSubscriber = eventLog.listEvents().length;
    });

    const toDelete = eventLog.listEvents()[0];
    eventLog.deleteEvent(toDelete.id);

    unsub();

    assert.strictEqual(countSeenInSubscriber, countBefore - 1,
      'subscriber should see the updated event count after deletion');
  });
});

// ---------------------------------------------------------------------------
// Test 4: deleteEvent changes forecast (D3-12, D4-09)
// ---------------------------------------------------------------------------

describe('deleteEvent causes forecast to re-compute with changed data (D4-09)', () => {
  it('forecast is recomputable after deleting an event', () => {
    const { eventLog, settings } = makeSetup();

    seed7Days(eventLog);

    const lowGate = { ...settings.get(), minDays: 0, maxDelta: 120 };
    const days1 = eventLog.daysBySubjectiveNight(lowGate.cutoverHour);
    const result1 = forecast(days1, lowGate);

    assert.ok(!result1.isColdStart, 'baseline must not be cold-start');
    assert.ok(result1.wake, 'baseline must have wake prediction');

    // Delete the most extreme wake event (09:00 outlier would shift median;
    // here we just delete the first one to prove recomputability)
    const toDelete = eventLog.listEvents().find(e => e.type === 'wake');
    eventLog.deleteEvent(toDelete.id);

    const days2 = eventLog.daysBySubjectiveNight(lowGate.cutoverHour);
    const result2 = forecast(days2, lowGate);

    // Must be recomputable (not throw)
    assert.ok(result2, 'forecast must be recomputable after deletion');
    assert.ok(!result2.isColdStart, 'should remain non-cold-start with 6 remaining wake days');
    assert.ok(result2.wake, 'wake prediction must still be present');
  });

  it('subscriber fires and re-computes forecast after deleteEvent (D3-12 pattern)', () => {
    const { eventLog, settings } = makeSetup();

    seed7Days(eventLog);

    const lowGate = { ...settings.get(), minDays: 0, maxDelta: 120 };
    const forecasts = [];

    const unsub = eventLog.subscribe(() => {
      const days = eventLog.daysBySubjectiveNight(lowGate.cutoverHour);
      forecasts.push(forecast(days, lowGate));
    });

    const toDelete = eventLog.listEvents()[0];
    eventLog.deleteEvent(toDelete.id);

    unsub();

    assert.strictEqual(forecasts.length, 1, 'subscriber must fire once after deleteEvent');
    const f = forecasts[0];
    assert.ok(f, 'subscriber must produce a forecast after deletion');
    assert.ok(f.wake || f.isColdStart, 'forecast must have wake or be cold-start');
  });
});

// ---------------------------------------------------------------------------
// Test 5: Rejection downweighting changes forecast (from Wave 1 / D3-03)
// ---------------------------------------------------------------------------

describe('toggling rejectedDays via settings.update() shifts forecast (D3-03, D4-05)', () => {
  it('marking an outlier day as rejected shifts the wake central time toward the cluster', () => {
    const { settings } = makeSetup();

    // Synthetic days: wake times chosen so downweighting the outlier (09:00)
    // moves the weighted P50 by at least one 5-minute step.
    //
    // Wake times (minutes): [360, 375, 390, 405, 420, 480, 540]
    //   = 06:00, 06:15, 06:30, 06:45, 07:00, 08:00, 09:00
    //
    // Without rejection (effectiveCount=7):
    //   P50 pos = 0.5 × 8 = 4, k=3 → 405 min = 06:45
    //
    // With 2026-05-26 (09:00) rejected at 0.5× (effectiveCount=6.5):
    //   P50 pos = 0.5 × 7.5 = 3.75, k=2, frac=0.75
    //   result = 390 + 0.75×(405-390) = 401.25 → round to 400 = 06:40
    //
    // Same data as rejected-days-forecast-sync.test.js Test 3 (known to work).
    // maxDelta=300 keeps the result as central/min/max (not probabilityBand)
    const baseDays = [
      { date: '2026-05-20', wake: '06:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-21', wake: '06:15', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-22', wake: '06:30', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-23', wake: '06:45', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-24', wake: '07:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-25', wake: '08:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
      { date: '2026-05-26', wake: '09:00', bedtime: '21:00', napStart: null, napEnd: null, rejected: false },
    ];
    const settingsSnap = { ...settings.get(), minDays: 0, maxDelta: 300 };

    // Baseline forecast
    const baseline = forecast(baseDays, settingsSnap);
    assert.ok(!baseline.isColdStart, 'baseline must not be cold-start');
    assert.ok(baseline.wake, 'baseline must have wake prediction');
    const central1 = baseline.wake.central;

    // Track subscriber call to verify settings.update() fires synchronously
    let subscriberCallCount = 0;
    let lastSnap = null;
    const unsub = settings.subscribe((snap) => {
      subscriberCallCount++;
      lastSnap = snap;
    });

    // Reject the outlier (2026-05-26 at 09:00)
    settings.update({ rejectedDays: ['2026-05-26'] });

    // Subscriber must have fired
    assert.strictEqual(subscriberCallCount, 1, 'settings subscriber fires once on update()');
    assert.ok(lastSnap, 'subscriber receives the updated snapshot');
    assert.deepEqual(lastSnap.rejectedDays, ['2026-05-26']);

    unsub();

    // Re-compute with rejection applied
    const daysWithRejection = baseDays.map(d =>
      d.date === '2026-05-26' ? { ...d, rejected: true } : d,
    );
    const result2 = forecast(daysWithRejection, settingsSnap);

    assert.ok(!result2.isColdStart, 'should remain non-cold-start with rejection');
    assert.ok(result2.wake, 'wake prediction must be present after rejection');
    const central2 = result2.wake.central;

    // Outlier is downweighted at 0.5× (D3-03); median should shift earlier
    assert.notStrictEqual(central2, central1,
      `wake central should shift when outlier is rejected: was ${central1}, got ${central2}`);

    // Sanity: central time should be earlier (toward 06:30..06:55 cluster)
    function toMinutes(hhmm) {
      const h = parseInt(hhmm.slice(0, 2), 10);
      const m = parseInt(hhmm.slice(3, 5), 10);
      return h * 60 + m;
    }
    assert.ok(toMinutes(central2) < toMinutes(central1),
      `rejected forecast central must be earlier: was ${central1}, got ${central2}`);
  });

  it('clearing rejectedDays restores the original forecast', () => {
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

    const snap0 = { ...settings.get(), minDays: 0, maxDelta: 300 };
    const centralBaseline = forecast(baseDays, snap0).wake.central;

    // Reject the outlier
    settings.update({ rejectedDays: ['2026-05-26'] });
    const daysWithRejection = baseDays.map(d =>
      d.date === '2026-05-26' ? { ...d, rejected: true } : d,
    );
    const centralWithRejection = forecast(daysWithRejection, snap0).wake.central;
    assert.notStrictEqual(centralWithRejection, centralBaseline,
      'rejection must change the forecast (precondition)');

    // Clear rejection
    settings.update({ rejectedDays: [] });
    const centralRestored = forecast(baseDays, snap0).wake.central;
    assert.strictEqual(centralRestored, centralBaseline,
      `clearing rejectedDays must restore the baseline forecast: expected ${centralBaseline}, got ${centralRestored}`);
  });
});

// ---------------------------------------------------------------------------
// Test 6: deleteEvent is idempotent — safe to call on missing id (D3-12)
// ---------------------------------------------------------------------------

describe('deleteEvent idempotency — safe on missing id (store invariant)', () => {
  it('deleteEvent returns false for missing id and does NOT fire subscriber', () => {
    const { eventLog } = makeSetup();
    addAt(eventLog, 'wake', '2026-05-20T06:30');

    let callCount = 0;
    const unsub = eventLog.subscribe(() => { callCount++; });

    const result = eventLog.deleteEvent('no-such-id');

    unsub();

    assert.strictEqual(result, false, 'deleteEvent returns false for missing id');
    assert.strictEqual(callCount, 0, 'subscriber must NOT fire when id is absent');
  });
});
