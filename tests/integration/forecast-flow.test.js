// tests/integration/forecast-flow.test.js
// Integration tests wiring eventLog + settings + forecast together.
//
// Decision D3-12: forecast re-runs on every eventLog change
// Decision D3-13: forecast state is derived from event-log + settings
// Decision D3-15: integration tests exercise the forecast update flow
//
// TDD: RED → GREEN (Task 3 = RED, Task 4 = GREEN)
// Run: node --test tests/integration/forecast-flow.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createSettingsStore } from '../../js/store/settings.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { forecast, selectNextEvent } from '../../js/lib/forecast.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Shared in-memory storage adapter; both stores read/write the same blob. */
function makeSharedStorage() {
  return createStorageMemory();
}

/** Simple sequential ID generator for test event logs. */
function makeId() {
  let n = 1;
  return () => `e${n++}`;
}

/**
 * Build a wired setup: shared storage, eventLog, settings, and a fixed clock.
 * The clock is fixed at the given date so event timestamps are predictable.
 *
 * @param {Date|string} [frozenAt='2026-06-01T08:00']
 */
function makeSetup(frozenAt = new Date(2026, 5, 1, 8, 0)) {
  const storage = makeSharedStorage();
  const clock = createClockFixed(frozenAt);
  const id = makeId();
  const eventLog = createEventLog({ storage, clock, id });
  const settings = createSettingsStore({ storage });
  return { storage, clock, eventLog, settings };
}

/**
 * Add an event at a specific local ISO timestamp.
 * e.g. addAt(log, 'wake', '2026-05-25T06:45')
 */
function addAt(eventLog, type, atString) {
  return eventLog.addEventAt(type, atString);
}

// ---------------------------------------------------------------------------
// Test 1: forecast re-computes on new event (D3-12, D3-13)
// ---------------------------------------------------------------------------

describe('forecast re-computes on new event', () => {
  it('adding events changes wake prediction central time', () => {
    // Arrange: fresh setup with minDays=0 so cold-start gate is not a blocker
    const { eventLog, settings } = makeSetup();
    const lowMinDays = { ...settings.get(), minDays: 0, maxDelta: 120 };

    // Add 3 wake events spread over 3 days
    addAt(eventLog, 'wake',    '2026-05-25T06:30');
    addAt(eventLog, 'bedtime', '2026-05-25T21:00');
    addAt(eventLog, 'wake',    '2026-05-26T06:45');
    addAt(eventLog, 'bedtime', '2026-05-26T21:00');
    addAt(eventLog, 'wake',    '2026-05-27T07:00');
    addAt(eventLog, 'bedtime', '2026-05-27T21:00');

    const days1 = eventLog.daysBySubjectiveNight();
    const result1 = forecast(days1, lowMinDays);

    // Verify initial prediction is present
    assert.ok(!result1.isColdStart, 'should not be cold-start with minDays=0');
    assert.ok(result1.wake, 'should have wake prediction');
    const central1 = result1.wake.central;

    // Act: add a 4th wake event at a very different time
    addAt(eventLog, 'wake', '2026-05-28T09:00');

    const days2 = eventLog.daysBySubjectiveNight();
    const result2 = forecast(days2, lowMinDays);

    // Assert: the wake central time shifted
    assert.ok(!result2.isColdStart, 'should still not be cold-start');
    assert.ok(result2.wake, 'should still have wake prediction');
    const central2 = result2.wake.central;

    // The central time should shift because the median changed
    assert.notStrictEqual(central2, central1,
      `wake central should change after adding late wake: was ${central1}, got ${central2}`);
  });
});

// ---------------------------------------------------------------------------
// Test 2: forecast re-computes on settings change (D3-12, D3-13)
// ---------------------------------------------------------------------------

describe('forecast re-computes on settings change', () => {
  it('changing maxDelta from 30 to 15 triggers probability-band fallback when spread >15', () => {
    // Arrange: 7 wake events spanning 30 minutes (06:30..07:00)
    // With maxDelta=30: band width=30 == maxDelta → NOT > maxDelta → normal shape
    // With maxDelta=15: band width=30 > maxDelta=15 → probabilityBand
    const { eventLog, settings } = makeSetup();

    addAt(eventLog, 'wake', '2026-05-20T06:30');
    addAt(eventLog, 'wake', '2026-05-21T06:35');
    addAt(eventLog, 'wake', '2026-05-22T06:40');
    addAt(eventLog, 'wake', '2026-05-23T06:45');
    addAt(eventLog, 'wake', '2026-05-24T06:50');
    addAt(eventLog, 'wake', '2026-05-25T06:55');
    addAt(eventLog, 'wake', '2026-05-26T07:00');

    const days = eventLog.daysBySubjectiveNight();

    // Forecast with maxDelta=30: 30-min band == 30 → normal shape
    const settingsWide = { ...settings.get(), minDays: 0, maxDelta: 30 };
    const result1 = forecast(days, settingsWide);
    assert.ok(!result1.isColdStart, 'should not be cold-start with minDays=0');
    // wake band = 30 min == maxDelta=30 → normal shape (NOT > maxDelta)
    assert.ok('central' in result1.wake,
      'wake should have normal shape when band == maxDelta (not > maxDelta)');

    // Update settings to maxDelta=15: 30-min band > 15 → probabilityBand
    const settingsNarrow = { ...settings.get(), minDays: 0, maxDelta: 15 };
    const result2 = forecast(days, settingsNarrow);
    assert.ok(!result2.isColdStart, 'should not be cold-start with minDays=0');
    // wake band = 30 min > maxDelta=15 → probabilityBand
    assert.ok('probabilityBand' in result2.wake,
      'wake should have probabilityBand when band > maxDelta');
    assert.ok(Array.isArray(result2.wake.probabilityBand),
      'probabilityBand should be an array');
  });
});

// ---------------------------------------------------------------------------
// Test 3: selectNextEvent respects cycle priority
// ---------------------------------------------------------------------------

describe('selectNextEvent respects cycle priority', () => {
  it('last logged event = napStart → selects napEnd per D3-10 priority', () => {
    // Arrange: log events so the most recent is napStart
    const { eventLog, settings } = makeSetup();

    addAt(eventLog, 'bedtime',  '2026-05-20T21:00');
    addAt(eventLog, 'wake',     '2026-05-21T06:45');
    addAt(eventLog, 'napStart', '2026-05-21T13:00');  // MOST RECENT

    const days = eventLog.daysBySubjectiveNight();
    const settingsNoGate = { ...settings.get(), minDays: 0, maxDelta: 120 };
    const predictions = forecast(days, settingsNoGate);

    // Act
    const selected = selectNextEvent(predictions, days);

    // Assert: cycle after napStart is napEnd → bedtime → wake → napStart
    assert.ok(selected !== null, 'should return a selection');
    assert.strictEqual(selected.type, 'napEnd',
      `expected napEnd (priority 1 after napStart), got ${selected?.type}`);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Cold-start flag toggles with minDays
// ---------------------------------------------------------------------------

describe('forecast cold-start flag toggles with minDays', () => {
  it('isColdStart goes false when valid day count reaches minDays threshold', () => {
    // Arrange: minDays=7 (default); start with 1 event → cold-start
    const { eventLog, settings } = makeSetup();
    const snap = settings.get();
    assert.strictEqual(snap.minDays, 7, 'default minDays should be 7');

    // Log 1 event → validDayCount=1 < 7 → isColdStart=true
    addAt(eventLog, 'wake', '2026-05-20T06:45');
    const days1 = eventLog.daysBySubjectiveNight();
    const result1 = forecast(days1, snap);

    assert.strictEqual(result1.isColdStart, true, 'should be cold-start after 1 event day');
    assert.ok(result1.minDaysRemaining > 0, 'minDaysRemaining should be positive');

    // Log 6 more wake events on different days → validDayCount=7 >= 7 → isColdStart=false
    addAt(eventLog, 'wake', '2026-05-21T06:45');
    addAt(eventLog, 'wake', '2026-05-22T06:45');
    addAt(eventLog, 'wake', '2026-05-23T06:45');
    addAt(eventLog, 'wake', '2026-05-24T06:45');
    addAt(eventLog, 'wake', '2026-05-25T06:45');
    addAt(eventLog, 'wake', '2026-05-26T06:45');

    const days2 = eventLog.daysBySubjectiveNight();
    const result2 = forecast(days2, snap);

    assert.strictEqual(result2.isColdStart, false,
      'should exit cold-start once validDayCount >= minDays');
    assert.ok('wake' in result2, 'wake prediction should be present after cold-start exits');
  });
});
