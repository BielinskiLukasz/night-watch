// tests/integration/forecast-ordering.test.js
// Regression tests for CR-01 (20-REVIEW.md): forecast()/tifForecast()/
// sleepDebtProxy() all require oldest-first day-records input, but
// eventLog.daysBySubjectiveNight() (js/lib/day-bucket.js bucketBy()) returns
// newest-first. today-screen.js must reverse before feeding these functions.
//
// Built on REAL eventLog output (createEventLog + createStorageMemory +
// createClockFixed), not hand-built oldest-first fixtures — so this test
// exercises the actual newest-first array shape production code receives.
//
// Source: .planning/phases/20-nap-probability-redesign/20-03-PLAN.md Task 1.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createEventLog } from '../../js/store/event-log.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';
import { forecast } from '../../js/lib/forecast.js';
import { tifForecast } from '../../js/lib/forecast-tif.js';
import { sleepDebtProxy } from '../../js/lib/metrics.js';

/** Simple sequential ID generator for test event logs. */
function makeId() {
  let n = 1;
  return () => `e${n++}`;
}

/**
 * Build a wired setup: in-memory storage, eventLog, fixed clock.
 * @param {Date|string} [frozenAt='2026-06-01T08:00']
 */
function makeSetup(frozenAt = new Date(2025, 2, 15, 8, 0)) {
  const storage = createStorageMemory();
  const clock = createClockFixed(frozenAt);
  const id = makeId();
  const eventLog = createEventLog({ storage, clock, id });
  return { storage, clock, eventLog };
}

function addAt(eventLog, type, atString) {
  return eventLog.addEventAt(type, atString);
}

describe('forecast() / tifForecast() / sleepDebtProxy() ordering contract (CR-01)', () => {
  it('forecast() rolling window: real bucketer output must be reversed to select the MOST RECENT windowDays days', () => {
    const { eventLog } = makeSetup();
    const wakeTimes = ['06:00', '06:10', '06:20', '06:30', '06:40', '06:50', '07:00', '07:10', '07:20', '07:30'];
    const dates = ['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04', '2025-03-05', '2025-03-06', '2025-03-07', '2025-03-08', '2025-03-09', '2025-03-10'];
    for (let i = 0; i < dates.length; i++) {
      addAt(eventLog, 'wake', `${dates[i]}T${wakeTimes[i]}`);
    }

    const rawDays = eventLog.daysBySubjectiveNight();
    // Real bucketer output is newest-first: first element is 2025-03-10.
    assert.equal(rawDays[0].date, '2025-03-10', 'sanity: rawDays must be newest-first');
    assert.equal(rawDays[rawDays.length - 1].date, '2025-03-01', 'sanity: rawDays last element is oldest');

    const reversedDays = [...rawDays].reverse();

    const settings = { windowDays: 5, minDays: 0, maxDelta: 1440 };
    const resultReversed = forecast(reversedDays, settings);
    const resultRaw = forecast(rawDays, settings);

    assert.equal(resultReversed.wake.central, '07:10',
      'reversed (oldest-first) input must select the 5 MOST RECENT days (median of 06:50/07:00/07:10/07:20/07:30)');
    assert.equal(resultRaw.wake.central, '06:20',
      'raw (newest-first) input, if unreversed, selects the 5 OLDEST days (median of 06:00/06:10/06:20/06:30/06:40)');
  });

  it('tifForecast() rolling window: same oldest-first requirement as forecast()', () => {
    const { eventLog } = makeSetup();
    const wakeTimes = ['06:00', '06:10', '06:20', '06:30', '06:40', '06:50', '07:00', '07:10', '07:20', '07:30'];
    const dates = ['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04', '2025-03-05', '2025-03-06', '2025-03-07', '2025-03-08', '2025-03-09', '2025-03-10'];
    for (let i = 0; i < dates.length; i++) {
      addAt(eventLog, 'wake', `${dates[i]}T${wakeTimes[i]}`);
    }

    const rawDays = eventLog.daysBySubjectiveNight();
    const reversedDays = [...rawDays].reverse();

    const tifSettings = { minDays: 0, tifRollingDays: 5, trimPct: 0, precisionTarget: 60 };
    const resultReversed = tifForecast(reversedDays, tifSettings);
    const resultRaw = tifForecast(rawDays, tifSettings);

    assert.equal(resultReversed.wake.central, '07:10',
      'reversed (oldest-first) input must select the 5 MOST RECENT days for the historic wake-up band');
    assert.equal(resultRaw.wake.central, '06:20',
      'raw (newest-first) input, if unreversed, selects the 5 OLDEST days');
  });

  it('sleepDebtProxy() overnight pairing: real bucketer output must be reversed for correct bedtime-to-wake pairing', () => {
    const { eventLog } = makeSetup();
    const days8 = [
      { date: '2025-02-01', wake: '07:00', bedtime: '21:00' },
      { date: '2025-02-02', wake: '06:30', bedtime: '21:30' },
      { date: '2025-02-03', wake: '07:15', bedtime: '20:45' },
      { date: '2025-02-04', wake: '06:45', bedtime: '22:00' },
      { date: '2025-02-05', wake: '07:30', bedtime: '21:15' },
      { date: '2025-02-06', wake: '07:00', bedtime: '20:30' },
      { date: '2025-02-07', wake: '06:15', bedtime: '21:45' },
      { date: '2025-02-08', wake: '07:45', bedtime: '21:00' },
    ];
    for (const d of days8) {
      addAt(eventLog, 'wake', `${d.date}T${d.wake}`);
      addAt(eventLog, 'bedtime', `${d.date}T${d.bedtime}`);
    }

    const rawDays8 = eventLog.daysBySubjectiveNight();
    const reversedDays8 = [...rawDays8].reverse();

    assert.equal(sleepDebtProxy(reversedDays8, 7, 600), 105,
      'correct oldest-first pairing: prevDay.bedtime -> day.wake across 7 qualifying overnight pairs, sum of (600-actual) = 105');
    assert.equal(sleepDebtProxy(rawDays8, 7, 600), 150,
      'buggy pairing from feeding real newest-first output directly pairs each day bedtime with the wrong adjacent day wake');
  });
});
