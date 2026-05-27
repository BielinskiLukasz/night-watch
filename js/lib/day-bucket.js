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
//
// 5. Overflow-flag dedupe (Plan 01-06 / UAT gap 4). Overflow napStart and
//    napEnd events are flagged with `extra: true` on a SHALLOW COPY before
//    being pushed into BOTH `dayRecord.allEvents` AND `dayRecord.extraNaps`.
//    Critically, the raw `events` array passed in is NEVER mutated — the
//    `extra` flag is a runtime annotation that lives only on the bucketer's
//    output, not on the canonical D-04 wire format the storage adapter
//    persists. The renderer in js/ui/today-screen.js iterates `allEvents`
//    ONLY and reads `evt.extra` to decide row styling — replacing the prior
//    double-render path where extras appeared once as a normal row AND
//    once as a separate faint summary row with no [edit]/[×] affordances.

/** Frozen config: bucketing defaults. */
const BUCKET_CONFIG = Object.freeze({
  defaultCutoverHour: 4, // D-18; Phase 2 makes this user-configurable (CFG-08)
  // Nap budget per day: napStart/napEnd events beyond this count are flagged
  // overflow (extra: true) on a shallow copy AND mirrored into extraNaps so
  // downstream consumers (Phase 3+ forecast) can skip them. Plan 01-06 / UAT
  // gap 4 settled on 2 naps as the budget: morning + afternoon nap is a
  // common toddler-sleep pattern, the user-facing LOG-09 warning fires only
  // when the day exceeds it.
  napBudgetPerDay: 2,
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
 *
 * Slot semantics:
 *   - wake / bedtime: first event of that type fills the named slot.
 *   - napStart / napEnd: FIRST event of that type fills the named slot
 *     (kept singular for the Phase 1 single-canonical-nap LOG-09 model
 *     and the Phase 3 forecast contract).
 *
 * Overflow semantics (Plan 01-06 / UAT gap 4):
 *   - `BUCKET_CONFIG.napBudgetPerDay` (=2) is the user-facing budget for
 *     nap events. The FIRST 1..N (N=budget) napStart/napEnd events render
 *     as normal rows — they are pushed into `allEvents` unmodified, and
 *     are NOT added to `extraNaps`.
 *   - The (N+1)-th and beyond napStart/napEnd events are OVERFLOW. A
 *     SHALLOW COPY `{ ...evt, extra: true }` is pushed into BOTH
 *     `allEvents` AND `extraNaps`. The renderer reads `evt.extra` to
 *     paint the row faint AND keep [edit]/[×] affordances (no dead
 *     summary row).
 *   - The input `eventsForDay` array's objects are NEVER mutated. The
 *     `extra: true` annotation is a runtime-only marker; the canonical
 *     wire format on disk (D-04) does not see it. Integration tests in
 *     `tests/integration/event-log.test.js` pin this with deep-equality.
 *
 * @param {string} dateKey 'YYYY-MM-DD'
 * @param {Array<{id:string,type:string,at:string}>} eventsForDay  unordered
 * @returns {object}
 */
function buildDayRecord(dateKey, eventsForDay) {
  // Sort ascending by `at` for deterministic "first" selection.
  // Note: spread is a shallow copy of the array, but the same object references
  // are retained — we MUST NOT assign to evt.extra anywhere; only create
  // `{ ...evt, extra: true }` shallow copies. The deep-equality test in
  // tests/integration/event-log.test.js pins this invariant.
  const sorted = [...eventsForDay].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const NAP_BUDGET = BUCKET_CONFIG.napBudgetPerDay;

  let wake = null;
  let bedtime = null;
  let napStart = null;
  let napEnd = null;
  const extraNaps = [];
  const allEvents = [];
  let napStartCount = 0;
  let napEndCount = 0;

  for (const evt of sorted) {
    switch (evt.type) {
      case 'wake':
        if (wake === null) wake = evt;
        allEvents.push(evt);
        break;
      case 'bedtime':
        if (bedtime === null) bedtime = evt;
        allEvents.push(evt);
        break;
      case 'napStart': {
        napStartCount += 1;
        if (napStart === null) napStart = evt;
        if (napStartCount <= NAP_BUDGET) {
          // Within budget: render as a normal row, no overflow flag.
          allEvents.push(evt);
        } else {
          // Overflow: flag a shallow copy and push into BOTH arrays.
          // Source `evt` (which lives on the input events array) is untouched.
          const flagged = { ...evt, extra: true };
          extraNaps.push(flagged);
          allEvents.push(flagged);
        }
        break;
      }
      case 'napEnd': {
        napEndCount += 1;
        if (napEnd === null) napEnd = evt;
        if (napEndCount <= NAP_BUDGET) {
          allEvents.push(evt);
        } else {
          // Overflow: flag a shallow copy and push into BOTH arrays.
          const flagged = { ...evt, extra: true };
          extraNaps.push(flagged);
          allEvents.push(flagged);
        }
        break;
      }
      default:
        // Unknown types are still part of allEvents; ignore for named slots.
        allEvents.push(evt);
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
