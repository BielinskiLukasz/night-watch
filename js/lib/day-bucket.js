// js/lib/day-bucket.js
// Pure-logic day-bucketers for Nightwatch.
//
// === Semantics (governed by 01-CONTEXT.md decisions + 01-RESEARCH.md pitfalls) ===
//
// 1. Two day-grouping views over the same event log (D-08). Both functions
//    return the SAME shape of dayRecord; they differ only in how they choose
//    the day key:
//       - daysByCalendar(events, limit?) groups by `at.slice(0, 10)` — the
//         literal calendar date. The Today screen (D-11) uses this.
//       - daysBySubjectiveNight(events, cutoverHour, limit?) groups by the
//         subjective night: events whose hour is BEFORE cutoverHour bucket
//         under the PREVIOUS calendar date. The Phase 3+ forecast/stats
//         engine uses this. Phase 1 hardcodes cutoverHour=4 per D-18.
//
// 2. String-slice strategy (Pitfall #3 / DST safety). This module operates
//    entirely on the canonical 'YYYY-MM-DDTHH:MM' string format. It NEVER
//    constructs a Date from an event timestamp — DST gaps and fall-back
//    ambiguity would silently misbucket events. `event.at.slice(0, 10)` is
//    the calendar date; `event.at.slice(11, 13)` parsed as Int is the
//    wall-clock hour. Date math is reserved for the prefix-only midnight
//    arithmetic in subtractOneDay() which is DST-safe by construction.
//
// 3. Previous-day arithmetic for subjective-night rollback uses a Date
//    constructor at time 00:00 (no clock component) and only on the date
//    prefix. This is DST-safe at midnight (no transition lands there).
//
// 4. LOG-09 / T-06 read-side enforcement (RESEARCH Open Question #1). The
//    canonical data model is append-only (D-01) — nothing prevents two
//    napStart events on one day. The bucketer surfaces the FIRST napStart
//    (and its matching napEnd) in the primary slots; any additional nap
//    events spill into `dayRecord.extraNaps` so the UI can warn the user
//    and the prediction engine can use only the first pair.

/** Frozen config: bucketing defaults. */
const BUCKET_CONFIG = Object.freeze({
  defaultCutoverHour: 4, // D-18; Phase 2 makes this user-configurable (CFG-08)
});

// ---------- helpers ----------

/**
 * Subtract one day from a 'YYYY-MM-DD' string. Uses Date constructor at
 * midnight (no clock component) to dodge DST entirely — no transition lands
 * at 00:00 local time in any modern jurisdiction. Returns a 'YYYY-MM-DD'.
 *
 * @param {string} ymd
 * @returns {string}
 */
function subtractOneDay(ymd) {
  const y = +ymd.slice(0, 4);
  const m = +ymd.slice(5, 7);
  const d = +ymd.slice(8, 10);
  const dateAtMidnight = new Date(y, m - 1, d);
  dateAtMidnight.setDate(dateAtMidnight.getDate() - 1);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${dateAtMidnight.getFullYear()}-` +
    `${pad(dateAtMidnight.getMonth() + 1)}-` +
    `${pad(dateAtMidnight.getDate())}`
  );
}

/** Calendar-date key: the literal 'YYYY-MM-DD' prefix of `at`. */
function calendarKey(at) {
  return at.slice(0, 10);
}

/**
 * Subjective-night key. If the event's wall-clock hour (string-sliced,
 * NEVER Date-parsed per Pitfall #3) is BEFORE the cutover, the event
 * belongs to the previous calendar day's subjective night. At-or-after
 * the cutover, it belongs to the current calendar day.
 *
 * @param {string} at  canonical 'YYYY-MM-DDTHH:MM'
 * @param {number} cutoverHour  integer 0..23
 * @returns {string} 'YYYY-MM-DD'
 */
function subjectiveNightKey(at, cutoverHour) {
  const dateStr = at.slice(0, 10);
  const hour = parseInt(at.slice(11, 13), 10);
  if (hour < cutoverHour) {
    return subtractOneDay(dateStr);
  }
  return dateStr;
}

/**
 * Build a dayRecord from a list of events that share the same day key.
 * Picks the first wake / bedtime / napStart / matching napEnd; everything
 * beyond the first nap pair spills into extraNaps (T-06 mitigation).
 *
 * @param {string} dateKey 'YYYY-MM-DD'
 * @param {Array<{id:string,type:string,at:string}>} eventsForDay  unordered
 * @returns {object}
 */
function buildDayRecord(dateKey, eventsForDay) {
  // Sort ascending by `at` for deterministic "first" selection.
  const allEvents = [...eventsForDay].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  let wake = null;
  let bedtime = null;
  let napStart = null;
  let napEnd = null;
  const extraNaps = [];
  let napStartConsumed = false;
  let napEndConsumed = false;

  for (const evt of allEvents) {
    switch (evt.type) {
      case 'wake':
        if (wake === null) wake = evt;
        break;
      case 'bedtime':
        if (bedtime === null) bedtime = evt;
        break;
      case 'napStart':
        if (!napStartConsumed) {
          napStart = evt;
          napStartConsumed = true;
        } else {
          extraNaps.push(evt);
        }
        break;
      case 'napEnd':
        if (!napEndConsumed) {
          napEnd = evt;
          napEndConsumed = true;
        } else {
          extraNaps.push(evt);
        }
        break;
      default:
        // Unknown types are still part of allEvents; ignore for named slots.
        break;
    }
  }

  return {
    date: dateKey,
    wake,
    bedtime,
    napStart,
    napEnd,
    extraNaps,
    allEvents,
  };
}

/**
 * Shared bucketing skeleton — group events by a key fn, build dayRecords,
 * sort newest-first by key, and apply optional limit.
 *
 * @param {Array<{id:string,type:string,at:string}>} events
 * @param {(at: string) => string} keyFn
 * @param {number|undefined} limit  optional positive integer
 * @returns {Array<object>}
 */
function bucketBy(events, keyFn, limit) {
  const groups = new Map();
  for (const evt of events) {
    const key = keyFn(evt.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(evt);
  }
  const records = [];
  for (const [key, evs] of groups) {
    records.push(buildDayRecord(key, evs));
  }
  // Newest-first: 'YYYY-MM-DD' strings sort correctly lexicographically.
  records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (typeof limit === 'number' && limit >= 0) {
    return records.slice(0, limit);
  }
  return records;
}

// ---------- public API ----------

/**
 * Group events into day records by CALENDAR date (D-11). The Today screen
 * uses this view.
 *
 * @param {Array<{id:string,type:string,at:string}>} events
 * @param {number} [limit]  optional max records (D-10 default 7 — passed by caller)
 * @returns {Array<object>}  day records, newest first
 */
export function daysByCalendar(events, limit) {
  return bucketBy(events, calendarKey, limit);
}

/**
 * Group events by SUBJECTIVE NIGHT (D-08). Events before the cutover hour
 * bucket under the previous calendar date. The Phase 3+ forecast/stats
 * engine uses this view. Phase 1 callers pass cutoverHour=4 (D-18).
 *
 * @param {Array<{id:string,type:string,at:string}>} events
 * @param {number} [cutoverHour=4]  integer 0..23
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export function daysBySubjectiveNight(
  events,
  cutoverHour = BUCKET_CONFIG.defaultCutoverHour,
  limit,
) {
  return bucketBy(events, (at) => subjectiveNightKey(at, cutoverHour), limit);
}
