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
  test('two nap-pairs on the same date → both within the 2-nap budget; extraNaps stays empty (Plan 01-06 contract)', () => {
    // Plan 01-06 / UAT gap 4 redefined the user-facing nap budget to 2.
    // The first two nap pairs render as normal rows; only the 3rd+ overflow
    // into extraNaps with `extra: true`. The named `dayRecord.napStart` /
    // `.napEnd` slots stay singular (the FIRST event of each type fills them)
    // so the Phase 3+ forecast contract is unchanged.
    const events = [
      ev('e1', 'napStart', '2026-05-26T13:00'),
      ev('e2', 'napEnd', '2026-05-26T14:00'),
      ev('e3', 'napStart', '2026-05-26T16:00'),
      ev('e4', 'napEnd', '2026-05-26T16:45'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days.length, 1);
    const day = days[0];
    assert.equal(day.napStart, events[0], 'napStart slot is the FIRST napStart');
    assert.equal(day.napEnd, events[1], 'napEnd slot is the FIRST napEnd');
    assert.ok(Array.isArray(day.extraNaps), 'extraNaps must be an array');
    assert.equal(
      day.extraNaps.length,
      0,
      'two nap-pairs are WITHIN the budget (=2), so extraNaps is empty',
    );
    // All four events render as normal rows.
    assert.equal(day.allEvents.length, 4);
    assert.ok(day.allEvents.every((e) => !e.extra), 'no event carries extra:true within budget');
  });

  test('three napStart events → only the 3rd surfaces in extraNaps with extra:true (T-06 / Plan 01-06)', () => {
    const events = [
      ev('e1', 'napStart', '2026-05-26T13:00'),
      ev('e2', 'napStart', '2026-05-26T16:00'),
      ev('e3', 'napStart', '2026-05-26T18:00'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days.length, 1);
    const day = days[0];
    assert.equal(day.napStart, events[0], 'napStart slot is the FIRST napStart');
    assert.equal(day.extraNaps.length, 1, 'exactly one overflow nap (the 3rd)');
    assert.equal(day.extraNaps[0].id, 'e3');
    assert.equal(day.extraNaps[0].extra, true);
    // allEvents has all 3 napStarts; only the 3rd is flagged.
    assert.equal(day.allEvents.length, 3);
    assert.ok(!day.allEvents[0].extra);
    assert.ok(!day.allEvents[1].extra);
    assert.equal(day.allEvents[2].extra, true);
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

  test('extraNaps mirrors daysByCalendar for subjective grouping (3rd nap is overflow)', () => {
    // Plan 01-06 budget: 2 naps; the 3rd is the overflow that lands in
    // extraNaps with extra:true.
    const events = [
      ev('e1', 'napStart', '2026-05-26T13:00'),
      ev('e2', 'napStart', '2026-05-26T15:00'),
      ev('e3', 'napStart', '2026-05-26T17:00'),
    ];
    const days = daysBySubjectiveNight(events, 4);
    assert.equal(days.length, 1);
    assert.equal(days[0].napStart, events[0]);
    assert.equal(days[0].extraNaps.length, 1, 'only the 3rd nap is overflow under the 2-nap budget');
    assert.equal(days[0].extraNaps[0].id, 'e3');
    assert.equal(days[0].extraNaps[0].extra, true);
  });
});

// ---------- day.rejected — Phase 4 Plan 01 (CFG-05, D4-05, D4-14) ----------

describe('daysByCalendar: day.rejected boolean (CFG-05)', () => {
  test('all days have rejected=false when settings not provided (backward compat)', () => {
    const events = [
      ev('e1', 'wake', '2026-05-26T06:35'),
      ev('e2', 'wake', '2026-05-25T06:35'),
    ];
    const days = daysByCalendar(events);
    assert.equal(days[0].rejected, false, 'rejected must be false when settings absent');
    assert.equal(days[1].rejected, false, 'rejected must be false when settings absent');
  });

  test('all days have rejected=false when settings.rejectedDays is empty', () => {
    const events = [
      ev('e1', 'wake', '2026-05-26T06:35'),
      ev('e2', 'wake', '2026-05-25T06:35'),
    ];
    const settings = { rejectedDays: [] };
    const days = daysByCalendar(events, undefined, settings);
    assert.ok(days.every(d => d.rejected === false),
      'all days rejected=false when rejectedDays is empty');
  });

  test('day with date in rejectedDays gets rejected=true', () => {
    const events = [
      ev('e1', 'wake', '2026-05-26T06:35'),
      ev('e2', 'wake', '2026-05-25T06:35'),
    ];
    const settings = { rejectedDays: ['2026-05-26'] };
    const days = daysByCalendar(events, undefined, settings);
    const day26 = days.find(d => d.date === '2026-05-26');
    const day25 = days.find(d => d.date === '2026-05-25');
    assert.equal(day26.rejected, true, '2026-05-26 is in rejectedDays → rejected=true');
    assert.equal(day25.rejected, false, '2026-05-25 is not in rejectedDays → rejected=false');
  });

  test('multiple dates in rejectedDays → each gets rejected=true', () => {
    const events = [
      ev('e1', 'wake', '2026-05-24T06:35'),
      ev('e2', 'wake', '2026-05-25T06:35'),
      ev('e3', 'wake', '2026-05-26T06:35'),
    ];
    const settings = { rejectedDays: ['2026-05-24', '2026-05-26'] };
    const days = daysByCalendar(events, undefined, settings);
    const byDate = Object.fromEntries(days.map(d => [d.date, d]));
    assert.equal(byDate['2026-05-24'].rejected, true);
    assert.equal(byDate['2026-05-25'].rejected, false);
    assert.equal(byDate['2026-05-26'].rejected, true);
  });

  test('removing a date from rejectedDays re-computes rejection state on next call (no caching)', () => {
    const events = [ev('e1', 'wake', '2026-05-26T06:35')];

    const settingsWithRejection = { rejectedDays: ['2026-05-26'] };
    const daysRejected = daysByCalendar(events, undefined, settingsWithRejection);
    assert.equal(daysRejected[0].rejected, true, 'first call: rejected=true');

    const settingsEmpty = { rejectedDays: [] };
    const daysCleared = daysByCalendar(events, undefined, settingsEmpty);
    assert.equal(daysCleared[0].rejected, false, 'second call with empty list: rejected=false');
  });
});

describe('daysBySubjectiveNight: day.rejected boolean (CFG-05)', () => {
  test('all days have rejected=false when settings not provided', () => {
    const events = [ev('e1', 'wake', '2026-05-26T06:35')];
    const days = daysBySubjectiveNight(events);
    assert.equal(days[0].rejected, false, 'rejected must be false when settings absent');
  });

  test('day with date in rejectedDays gets rejected=true', () => {
    // 2026-05-26T06:35 with cutoverHour=4 → subjective date 2026-05-26 (no rollback)
    const events = [ev('e1', 'wake', '2026-05-26T06:35')];
    const settings = { rejectedDays: ['2026-05-26'] };
    // daysBySubjectiveNight(events, cutoverHour, limit, settings)
    const days = daysBySubjectiveNight(events, 4, undefined, settings);
    assert.equal(days[0].rejected, true, '2026-05-26 in rejectedDays → rejected=true');
  });

  test('subjective rollback date uses the rolled-back key for rejection check', () => {
    // 2026-05-26T03:50 with cutoverHour=4 → subjective date 2026-05-25 (rolled back)
    const events = [ev('e1', 'wake', '2026-05-26T03:50')];
    const settings = { rejectedDays: ['2026-05-25'] };
    const days = daysBySubjectiveNight(events, 4, undefined, settings);
    // The bucketed date is 2026-05-25, so a rejection on 2026-05-25 must fire.
    assert.equal(days[0].date, '2026-05-25', 'event rolled back to previous day');
    assert.equal(days[0].rejected, true, 'rejection matches rolled-back date');
  });
});
