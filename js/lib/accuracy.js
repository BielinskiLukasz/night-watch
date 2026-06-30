// js/lib/accuracy.js
// Pure retroactive backtesting engine for the Accuracy screen (UI-05).
//
// Decisions: D7-12, D7-13, D7-14, D7-15, D7-16
// Requirements: UI-05
// Platform: PLAT-11
//
// Exports:
//   computeAccuracy(dayRecords, settings) → AccuracyResult
//
// Private helpers (not exported):
//   ACCURACY_CONFIG — frozen config
//   extractActualMinutes(event) — extract HH:MM → minutes from event.at
//   buildAccuracyResult(counters) — convert raw counters to AccuracyResult
//
// AccuracyResult shape (D7-14):
//   {
//     wake:     { total: N, withinDelta: { count, pct }, withinHalfDelta: { count, pct }, insideBand: { count, pct } },
//     bedtime:  { ... same ... },
//     napStart: { ... same ... },
//     napEnd:   { ... same ... },
//   }
//
// Zero DOM, zero I/O — fully unit-testable with node:test.
// Calls forecast() internally for each historical day.
//
// KNOWN LIMITATION (Risk 2 in 07-RESEARCH.md):
// Time comparison is naive minutes-since-midnight (0-1439). For events near midnight
// (e.g., late bedtime at 23:45), delta calculation may be artificially large if the
// actual falls on the other side of midnight. This is a known v1 limitation; complex
// cross-midnight cycle-aware comparison is deferred to v2.

import { forecast, timeToMinutes } from './forecast.js';

/**
 * Frozen accuracy config: event type definitions.
 * Object.freeze per CLAUDE.md convention.
 */
const ACCURACY_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'bedtime', 'napStart', 'napEnd']),
  NAP_TYPES: new Set(['napStart', 'napEnd']),
});

/**
 * Extract minutes-since-midnight from an event object.
 *
 * Supports two formats:
 *   - ISO string: 'YYYY-MM-DDTHH:MM' → take last 5 chars as HH:MM
 *   - Bare HH:MM: 'HH:MM' → use directly (synthetic test data)
 *
 * KNOWN LIMITATION: midnight-wrap not handled. If event.at crosses midnight
 * (e.g., '2025-01-02T00:05' for a bedtime that rolled over), the returned
 * minutes (5) may differ unexpectedly from a late-night prediction (1435).
 * For v1 this is acceptable; note here for v2 cycle-aware comparison.
 *
 * @param {{ at: string }|null} event  event object from a day record slot
 * @returns {number|null}  minutes since midnight, or null if invalid
 */
function extractActualMinutes(event) {
  if (!event || !event.at) return null;
  const at = event.at;
  // ISO string ('YYYY-MM-DDTHH:MM' is 16 chars): take last 5 as HH:MM
  // Bare HH:MM (5 chars): use directly
  const hhmm = at.length > 5 ? at.slice(-5) : at;
  return timeToMinutes(hhmm);
}

/**
 * Convert raw counters to AccuracyResult with pct fields.
 *
 * pct is Math.round(count/total*100). When total === 0, pct is 0 (never NaN).
 * This satisfies T-07-02-02: no NaN leaks to UI.
 *
 * @param {{ wake, bedtime, napStart, napEnd }} counters  raw counter object
 * @returns {AccuracyResult}
 */
function buildAccuracyResult(counters) {
  const result = {};
  for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
    const c = counters[type];
    const total = c.total;

    function pct(count) {
      return total === 0 ? 0 : Math.round(count / total * 100);
    }

    result[type] = {
      total,
      withinDelta:     { count: c.withinDelta,     pct: pct(c.withinDelta)     },
      withinHalfDelta: { count: c.withinHalfDelta, pct: pct(c.withinHalfDelta) },
      insideBand:      { count: c.insideBand,      pct: pct(c.insideBand)      },
    };
  }
  return result;
}

/**
 * Compute retroactive accuracy across all available history.
 *
 * Algorithm (D7-12):
 *   For each day D starting from index minDays, call forecast() with only
 *   the records BEFORE day D (no look-ahead bias — RESEARCH Pitfall #2),
 *   then compare the predicted central times to the actual logged times in
 *   day D.
 *
 * LOOP INVARIANT (look-ahead bias prevention):
 *   for (let i = minDays; i < sorted.length; i++) {
 *     const history = sorted.slice(0, i);   // only BEFORE day i
 *     const actual  = sorted[i];             // the day being scored
 *   }
 *
 * NAP DAY COUNTING (D7-15):
 *   Only increment napStart.total / napEnd.total when the actual day has
 *   a non-null napStart or napEnd. Days with no nap are excluded from
 *   nap accuracy counts.
 *
 * COLD-START SKIP:
 *   If forecast(history, settings).isColdStart is true, the day is skipped
 *   (total unchanged). This happens when history has fewer than minDays
 *   non-rejected records (e.g., early in history or after many rejections).
 *
 * BAND MODE (D3-04):
 *   When pred[type].probabilityBand is present, check if actualMinutes falls
 *   within [bandMin, bandMax]. withinDelta and withinHalfDelta are NOT
 *   incremented in band mode (the band fired because spread exceeded maxDelta).
 *
 * pct GUARANTEE (T-07-02-02):
 *   All pct fields are integer 0-100, never NaN. When total === 0, pct = 0.
 *
 * PERFORMANCE NOTE:
 *   For n=300 days, this loop creates n array copies (O(n²/2) total element
 *   copies ≈ 45,000). In V8 this takes < 5ms. For n > 1000, consider chunked
 *   async execution as a future optimization.
 *
 * @param {object[]} dayRecords  array of day records from daysBySubjectiveNight()
 *   Expected fields per record: date (YYYY-MM-DD), wake, bedtime, napStart,
 *   napEnd (null or { at: 'YYYY-MM-DDTHH:MM' }), rejected (boolean).
 *   filterDayRecordsByStage() should be applied by the caller before passing
 *   dayRecords when stage scoping is active (D7-17).
 * @param {object} settings  settings snapshot
 *   Expected fields: minDays (integer), maxDelta (minutes), windowDays (integer)
 * @returns {AccuracyResult}  shape described above; all values are non-NaN numbers
 */
export function computeAccuracy(dayRecords, settings) {
  const { minDays, maxDelta } = settings;

  // Sort chronologically — defensive (D7-12 requires chronological order for
  // look-ahead bias prevention). Lexicographic YYYY-MM-DD sort is correct.
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : 1);

  // Raw counters (integers) for each event type.
  const counters = {
    wake:     { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    bedtime:  { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    napStart: { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    napEnd:   { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
  };

  // LOOK-AHEAD BIAS PREVENTION (RESEARCH Pitfall #2):
  //   Start at index minDays so history = sorted.slice(0, i) has at least
  //   minDays records (enough for the cold-start gate to potentially pass).
  //   actual = sorted[i] is the day we're evaluating — NOT included in history.
  for (let i = minDays; i < sorted.length; i++) {
    const history = sorted.slice(0, i); // everything BEFORE day i — no look-ahead
    const actual  = sorted[i];          // the day we're evaluating against

    const pred = forecast(history, settings);

    // COLD-START SKIP: forecast() returns isColdStart:true when history has
    // fewer than minDays valid (non-rejected) records. Skip this day entirely.
    if (pred.isColdStart) continue;

    // Score each event type for this day.
    for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
      const actualEvent = actual[type];

      // No actual event for this type on this day — skip.
      if (!actualEvent) continue;

      // NAP DAY COUNTING (D7-15): for nap event types, only count days where
      // the day record has at least one nap event (napStart or napEnd non-null).
      // Days with both napStart and napEnd null are "no-nap days" — excluded.
      if (ACCURACY_CONFIG.NAP_TYPES.has(type)) {
        if (actual.napStart === null && actual.napEnd === null) continue;
      }

      // This day counts towards the sample total for this event type.
      // total is incremented for every day where:
      //   - the actual event exists (checked above)
      //   - forecast was not cold-start (checked at loop top)
      //   - nap-day filter passed (for nap types, checked above)
      // Note: total increments even when forecast has no central prediction for
      // this event type (e.g., nap days exist but history had no prior naps).
      counters[type].total++;

      // Prediction for this event type. If missing or has no central and no
      // probabilityBand, we cannot score this day — skip accuracy counting.
      const prediction = pred[type];
      if (!prediction) continue;
      if (!prediction.central && !prediction.probabilityBand) continue;

      // Extract actual time in minutes-since-midnight.
      const actualMinutes = extractActualMinutes(actualEvent);
      if (actualMinutes === null) continue;

      if (prediction.probabilityBand) {
        // BAND MODE: forecast() returned a probability table (D3-04).
        // The band was triggered because spread exceeded maxDelta, so
        // withinDelta and withinHalfDelta are not meaningful here.
        // Only check insideBand: does actual fall within [bandMin, bandMax]?
        const bandTimes = prediction.probabilityBand.map(e => timeToMinutes(e.time));
        const bandMin = Math.min(...bandTimes);
        const bandMax = Math.max(...bandTimes);
        if (actualMinutes >= bandMin && actualMinutes <= bandMax) {
          counters[type].insideBand++;
        }
        // withinDelta and withinHalfDelta: not incremented in band mode.
      } else {
        // CENTRAL MODE: normal point prediction with confidence band.
        const centralMinutes = timeToMinutes(prediction.central);
        const delta = Math.abs(actualMinutes - centralMinutes);

        if (delta <= maxDelta)      counters[type].withinDelta++;
        if (delta <= maxDelta / 2)  counters[type].withinHalfDelta++;

        // insideBand in central mode: check if actual falls within [min, max].
        if (prediction.min && prediction.max) {
          const bandMin = timeToMinutes(prediction.min);
          const bandMax = timeToMinutes(prediction.max);
          if (actualMinutes >= bandMin && actualMinutes <= bandMax) {
            counters[type].insideBand++;
          }
        }
      }
    }
  }

  return buildAccuracyResult(counters);
}
