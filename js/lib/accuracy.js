// js/lib/accuracy.js
// Pure retroactive backtesting engine for the Accuracy screen (UI-05).
//
// Decisions: ACC-01, ACC-02, ACC-03, ACC-04, D-01..D-11 (Phase 22)
// Requirements: ACC-01, ACC-02, ACC-03, ACC-04
// Platform: PLAT-11
//
// Exports:
//   eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes) → number
//   computeAccuracy(dayRecords, settings) → AccuracyResult
//
// Private helpers (not exported):
//   ACCURACY_CONFIG — frozen config
//   extractActualMinutes(event) — extract HH:MM → minutes from event.at
//   buildAccuracyResult(counters) — convert raw counters to AccuracyResult
//
// AccuracyResult shape (Task 1, interim — no bedtime split, no band-fallback
// approximation counter, no overallScore yet; those land in Task 2/22-01):
//   {
//     wake:     { total: N, avgScore: N },
//     bedtime:  { total: N, avgScore: N },
//     napStart: { total: N, avgScore: N },
//     napEnd:   { total: N, avgScore: N },
//   }
//
// Zero DOM, zero I/O — fully unit-testable with node:test.
// Calls forecast() internally for each historical day.
//
// KNOWN LIMITATION (Risk 2 in 07-RESEARCH.md):
// Time comparison is naive minutes-since-midnight (0-1439). For events near midnight
// (e.g., late bedtime at 23:45), delta calculation may be artificially large if the
// actual falls on the other side of midnight. This is a known v1 limitation; complex
// cross-midnight cycle-aware comparison is deferred to v2. Not addressed by ACC-01..04.

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
 * Linear-decay per-event accuracy score (ACC-02).
 *
 * Formula (see NEW_ACC.md for the original worked-example source):
 *   D = |actualMinutes - forecastMinutes|
 *   D <= W:      score = 100 - (50/W) * D
 *   W < D <= 2W: score = 50 - (50/W) * (D - W)
 *   D > 2W:      score = 0
 *
 * Returns a raw, unrounded number in [0, 100] (the three branches are
 * mutually exclusive and each produces a value in range by construction —
 * no clamping needed). Callers (buildAccuracyResult) round aggregates.
 *
 * No divide-by-zero guard: every in-repo call site supplies settings.maxDelta,
 * which settings-validate.js enforces to a minimum of 5.
 *
 * @param {number} forecastMinutes  predicted time (minutes since midnight)
 * @param {number} actualMinutes    actual logged time (minutes since midnight)
 * @param {number} toleranceMinutes tolerance window W (from settings.maxDelta)
 * @returns {number} raw unrounded score in [0, 100]
 */
export function eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes) {
  const D = Math.abs(actualMinutes - forecastMinutes);
  if (D <= toleranceMinutes) {
    return 100 - (50 / toleranceMinutes) * D;
  }
  if (D <= 2 * toleranceMinutes) {
    return 50 - (50 / toleranceMinutes) * (D - toleranceMinutes);
  }
  return 0;
}

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
 * Convert raw counters to AccuracyResult with avgScore fields (ACC-03).
 *
 * avgScore is Math.round(scoreSum / total). When total === 0, avgScore is 0
 * (never NaN). This satisfies T-07-02-02: no NaN leaks to UI.
 *
 * Task 1 interim shape: exactly two own keys per type, `total` and `avgScore`
 * — no other fields. Task 2 (22-01, second task) extends this.
 *
 * @param {{ wake, bedtime, napStart, napEnd }} counters  raw counter object ({total, scoreSum})
 * @returns {AccuracyResult}
 */
function buildAccuracyResult(counters) {
  const result = {};
  for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
    const c = counters[type];
    const total = c.total;
    const avgScore = total === 0 ? 0 : Math.round(c.scoreSum / total);
    result[type] = { total, avgScore };
  }
  return result;
}

/**
 * Compute retroactive accuracy across all available history.
 *
 * Algorithm (D7-12, carried forward unchanged):
 *   For each day D starting from index minDays, call forecast() with only
 *   the records BEFORE day D (no look-ahead bias — RESEARCH Pitfall #2),
 *   then score the predicted central time against the actual logged time in
 *   day D using eventAccuracyScore() (ACC-02).
 *
 * LOOP INVARIANT (look-ahead bias prevention):
 *   for (let i = minDays; i < sorted.length; i++) {
 *     const history = sorted.slice(0, i);   // only BEFORE day i
 *     const actual  = sorted[i];             // the day being scored
 *   }
 *
 * NAP DAY COUNTING (D7-15, carried forward unchanged):
 *   Only increment napStart.total / napEnd.total when the actual day has
 *   a non-null napStart or napEnd. Days with no nap are excluded from
 *   nap accuracy counts.
 *
 * COLD-START SKIP:
 *   If forecast(history, settings).isColdStart is true, the day is skipped
 *   (total unchanged). This happens when history has fewer than minDays
 *   non-rejected records (e.g., early in history or after many rejections).
 *
 * ACC-03 LITERAL TOTAL SEMANTICS (Task 1 rewrite — behavior change):
 *   total is incremented ONLY when the day has BOTH a usable forecast (a
 *   central prediction — band-mode is deferred to Task 2) AND a recorded
 *   actual time for that event type. This differs from the prior
 *   implementation, which incremented total before confirming a usable
 *   prediction existed.
 *
 * BAND MODE (Task 1 — deferred):
 *   When pred[type].probabilityBand is present, this day/type is skipped
 *   entirely (not approximated, not counted). D-06/D-07 band-fallback
 *   approximation is added in Task 2.
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

  // Raw counters for each event type.
  const counters = {
    wake:     { total: 0, scoreSum: 0 },
    bedtime:  { total: 0, scoreSum: 0 },
    napStart: { total: 0, scoreSum: 0 },
    napEnd:   { total: 0, scoreSum: 0 },
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

      // ACC-03 literal: a usable prediction must exist BEFORE total counts.
      // Band-mode is deferred to Task 2 — for Task 1, a band means "no usable
      // central prediction" and this day/type is excluded, not approximated.
      const prediction = pred[type];
      if (!prediction) continue;
      if (prediction.probabilityBand) continue;
      if (!prediction.central) continue;

      // Extract actual time in minutes-since-midnight.
      const actualMinutes = extractActualMinutes(actualEvent);
      if (actualMinutes === null) continue;

      // Both forecast AND actual confirmed usable — this day counts now.
      counters[type].total++;

      const forecastMinutes = timeToMinutes(prediction.central);
      const score = eventAccuracyScore(forecastMinutes, actualMinutes, maxDelta);
      counters[type].scoreSum += score;
    }
  }

  return buildAccuracyResult(counters);
}
