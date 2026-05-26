// tests/unit/day-bucket.test.js
// Source: 01-02-PLAN.md §Task 2 <behavior> + RESEARCH §Open Questions #1
//
// Covers:
//   - daysByCalendar: empty / single / same-day / cross-day / newest-first
//     ordering / 7-day limit (D-10, D-15)
//   - daysBySubjectiveNight: cutover edge cases (03:50 → previous bucket,
//     04:00 at-or-after → current bucket); string-slice semantics (Pitfall #3)
//   - LOG-09 / T-06 read-side enforcement: two napStart events on one day
//     yield dayRecord.napStart === first AND dayRecord.extraNaps containing
//     the second (RESEARCH Open Question #1)
//   - Each dayRecord exposes named slots: wake / bedtime / napStart / napEnd
//     / extraNaps / allEvents

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysByCalendar,
  daysBySubjectiveNight,
} from '../../js/lib/day-bucket.js';

// ---------- helpers ----------

function ev(id, type, at) {
  return { id, type, at };
}

// ---------- daysByCalendar ----------

describe('daysByCalendar: empty + singleton', () => {
  test('empty events array returns []', () => {
    assert.deepEqual(daysByCalendar([]), []);
  });

  test('one event yields one day record on its calendar date', () => {
    const events = [ev('e1', 'wake', '2026-05-26T06:35')];
    const days = daysByCalendar(events);
    assert.equal(days.length, 1);
    assert.equal(days[0].date, '2026-05-26');
    assert.equal(days[0].allEvents.length, 1);
    assert.equal(days[0].wake, events[0]);
  });
});

describe('daysByCalendar: grouping', () => {
  test('two events on the same calendar date land in one day record', () => {
    const events = [
      ev('e1', 'wake', '2026-05-26T06:35'),
      ev('e2', 'bedtime', '2026-05-26T22:10'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days.length, 1);
    assert.equal(days[0].date, '2026-05-26');
    assert.equal(days[0].allEvents.length, 2);
    assert.equal(days[0].wake, events[0]);
    assert.equal(days[0].bedtime, events[1]);
  });

  test('two events on different dates yield two records, newest first', () => {
    const events = [
      ev('e1', 'wake', '2026-05-25T06:30'),
      ev('e2', 'wake', '2026-05-26T06:35'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days.length, 2);
    assert.equal(days[0].date, '2026-05-26'); // newest first
    assert.equal(days[1].date, '2026-05-25');
  });

  test('allEvents within a day are ordered ascending by `at`', () => {
    const events = [
      ev('e1', 'bedtime', '2026-05-26T22:10'),
      ev('e2', 'wake', '2026-05-26T06:35'),
      ev('e3', 'napStart', '2026-05-26T13:20'),
    ];
    const days = daysByCalendar(events);
    assert.deepEqual(
      days[0].allEvents.map((e) => e.id),
      ['e2', 'e3', 'e1'],
    );
  });
});

describe('daysByCalendar: 7-day window (D-10 / D-15)', () => {
  test('with 7 distinct dates and limit=7 returns all 7', () => {
    const events = Array.from({ length: 7 }, (_, i) =>
      ev(`e${i + 1}`, 'wake', `2026-05-${String(20 + i).padStart(2, '0')}T06:30`),
    );
    const days = daysByCalendar(events, 7);
    assert.equal(days.length, 7);
  });

  test('with 10 distinct dates and limit=7 returns the 7 newest', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      ev(`e${i + 1}`, 'wake', `2026-05-${String(10 + i).padStart(2, '0')}T06:30`),
    );
    const days = daysByCalendar(events, 7);
    assert.equal(days.length, 7);
    assert.equal(days[0].date, '2026-05-19'); // newest of the 10 (10+9 = 19)
    assert.equal(days[6].date, '2026-05-13'); // 7th-newest (10+3 = 13)
  });
});

describe('daysByCalendar: LOG-09 / T-06 read-side enforcement', () => {
  test('two napStart events on the same date → napStart=first, extras in extraNaps', () => {
    const events = [
      ev('e1', 'napStart', '2026-05-26T13:00'),
      ev('e2', 'napEnd', '2026-05-26T14:00'),
      ev('e3', 'napStart', '2026-05-26T16:00'),
      ev('e4', 'napEnd', '2026-05-26T16:45'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days.length, 1);
    const day = days[0];
    assert.equal(day.napStart, events[0], 'napStart should be the FIRST one');
    assert.equal(day.napEnd, events[1], 'napEnd should match the chosen napStart');
    assert.ok(Array.isArray(day.extraNaps), 'extraNaps must be an array');
    assert.ok(
      day.extraNaps.length >= 1,
      'a second nap-pair must surface in extraNaps (T-06)',
    );
    // The extras include the second napStart at minimum.
    const extraIds = day.extraNaps.map((e) => e.id);
    assert.ok(extraIds.includes('e3'), 'extraNaps must include the second napStart');
  });

  test('single nap-pair → extraNaps is empty', () => {
    const events = [
      ev('e1', 'napStart', '2026-05-26T13:00'),
      ev('e2', 'napEnd', '2026-05-26T14:00'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days[0].extraNaps.length, 0);
  });
});

// ---------- daysBySubjectiveNight ----------

describe('daysBySubjectiveNight: cutover semantics (D-08, D-18, Pitfall #3)', () => {
  test('event at 03:50 with cutoverHour=4 → previous-day subjective bucket', () => {
    // 03:50 is BEFORE the 04:00 cutover → belongs to the night that started
    // on the previous calendar date.
    const events = [ev('e1', 'wake', '2026-05-26T03:50')];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days.length, 1);
    assert.equal(days[0].date, '2026-05-25');
  });

  test('event at 04:00 with cutoverHour=4 → current-day subjective bucket (at-or-after)', () => {
    const events = [ev('e1', 'wake', '2026-05-26T04:00')];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days.length, 1);
    assert.equal(days[0].date, '2026-05-26');
  });

  test('event at 06:35 with cutoverHour=4 → current-day subjective bucket', () => {
    const events = [ev('e1', 'wake', '2026-05-26T06:35')];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days.length, 1);
    assert.equal(days[0].date, '2026-05-26');
  });

  test('cross-month rollback: 2026-06-01T03:50 cutoverHour=4 → 2026-05-31 bucket', () => {
    const events = [ev('e1', 'wake', '2026-06-01T03:50')];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days[0].date, '2026-05-31');
  });

  test('cross-year rollback: 2027-01-01T02:00 cutoverHour=4 → 2026-12-31 bucket', () => {
    const events = [ev('e1', 'wake', '2027-01-01T02:00')];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days[0].date, '2026-12-31');
  });

  test('extraNaps mirrors daysByCalendar for subjective grouping', () => {
    const events = [
      ev('e1', 'napStart', '2026-05-26T13:00'),
      ev('e2', 'napStart', '2026-05-26T16:00'),
    ];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days.length, 1);
    assert.equal(days[0].napStart, events[0]);
    assert.ok(days[0].extraNaps.length >= 1);
  });
});
