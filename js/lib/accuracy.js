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
// AccuracyResult shape (final — Task 2):
//   {
//     wake:            { total: N, avgScore: N, approximatedCount: N },
//     bedtime:         { total: N, avgScore: N, approximatedCount: N },
//     bedtimeNapDay:   { total: N, avgScore: N, approximatedCount: N },
//     bedtimeNoNapDay: { total: N, avgScore: N, approximatedCount: N },
//     napStart:        { total: N, avgScore: N, approximatedCount: N },
//     napEnd:          { total: N, avgScore: N, approximatedCount: N },
//     overallScore: N,  // mean of each day's own per-day mean score (D-10)
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
  // The 4 keys forecast()/day records actually expose — drives the scoring
  // loop's pred[type]/actual[type] lookups.
  BASE_EVENT_TYPES: Object.freeze(['wake', 'bedtime', 'napStart', 'napEnd']),
  // The 6 keys used for counter initialization and buildAccuracyResult's
  // output — adds the D-03/D-04 bedtime nap-day/no-nap-day split.
  EVENT_TYPES: Object.freeze(['wake', 'bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay', 'napStart', 'napEnd']),
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
 * Convert raw counters (+ per-day averages) to the final AccuracyResult
 * (ACC-03, D-03/D-04, D-06/D-07, D-10).
 *
 * avgScore is Math.round(scoreSum / total). When total === 0, avgScore is 0
 * (never NaN). This satisfies T-07-02-02: no NaN leaks to UI.
 *
 * overallScore (D-10) is the mean of dailyAverages — each entry already the
 * mean of ONE day's own per-event scores (computed by computeAccuracy from
 * BASE_EVENT_TYPES only, never double-counting the bedtime sub-buckets).
 * dailyAverages excludes days with zero scored events, so the headline never
 * gets pulled toward 0 by a day that had no usable forecast/actual pairs.
 *
 * @param {object} counters       raw counter object, keyed by ACCURACY_CONFIG.EVENT_TYPES (6 keys),
 *   each `{ total, scoreSum, approximatedCount }`
 * @param {number[]} dailyAverages  one entry per day that had >= 1 scored event
 * @returns {AccuracyResult}
 */
function buildAccuracyResult(counters, dailyAverages) {
  const result = {};
  for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
    const c = counters[type];
    const total = c.total;
    const avgScore = total === 0 ? 0 : Math.round(c.scoreSum / total);
    result[type] = { total, avgScore, approximatedCount: c.approximatedCount };
  }
  result.overallScore = dailyAverages.length === 0
    ? 0
    : Math.round(dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length);
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
 * ACC-03 LITERAL TOTAL SEMANTICS (behavior change vs the pre-Phase-22
 * implementation):
 *   total is incremented ONLY when the day has BOTH a usable forecast (a
 *   central prediction OR a probabilityBand, per D-06) AND a recorded
 *   actual time for that event type.
 *
 * BAND MODE (D-06/D-07):
 *   When pred[type].probabilityBand is present, forecastMinutes is
 *   approximated as the midpoint of the band's min/max, and that event's
 *   approximatedCount is incremented so the approximation is never silently
 *   lost.
 *
 * BEDTIME NAP-DAY SPLIT (D-03/D-04):
 *   Every scored bedtime event also fans into bedtimeNapDay or
 *   bedtimeNoNapDay, classified by the scored day's own actual napStart
 *   (napStart != null — Phase 19 D-04's exact definition), never by which
 *   internal series forecast() happened to select. The combined `bedtime`
 *   key remains the average across both sub-buckets.
 *
 * OVERALL HEADLINE SCORE (D-10):
 *   Each day's own scored events (BASE_EVENT_TYPES only — never
 *   double-counting the bedtime nap-day/no-nap-day fan-out) are averaged
 *   into that day's daily mean. overallScore is the mean of all days'
 *   daily means, excluding days with zero scored events.
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

  // Raw counters for each of the 6 EVENT_TYPES (includes bedtime split).
  const counters = {};
  for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
    counters[type] = { total: 0, scoreSum: 0, approximatedCount: 0 };
  }

  // D-10: one entry per day that had >= 1 scored event, each entry the mean
  // of that day's own per-event scores (BASE_EVENT_TYPES only).
  const dailyAverages = [];

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

    // D-03: classify this day once — nap-day vs no-nap-day — using only the
    // day's own actual napStart, reusing Phase 19 D-04's exact definition.
    const isNapDay = actual.napStart !== null;
    const dayScores = [];

    // Score each base event type for this day.
    for (const type of ACCURACY_CONFIG.BASE_EVENT_TYPES) {
      const actualEvent = actual[type];

      // No actual event for this type on this day — skip.
      if (!actualEvent) continue;

      // NAP DAY COUNTING (D7-15): for nap event types, only count days where
      // the day record has at least one nap event (napStart or napEnd non-null).
      // Days with both napStart and napEnd null are "no-nap days" — excluded.
      if (ACCURACY_CONFIG.NAP_TYPES.has(type)) {
        if (actual.napStart === null && actual.napEnd === null) continue;
      }

      const prediction = pred[type];
      if (!prediction) continue;

      // Extract actual time in minutes-since-midnight.
      const actualMinutes = extractActualMinutes(actualEvent);
      if (actualMinutes === null) continue;

      // D-06: band-mode fallback — approximate forecastMinutes as the band
      // midpoint when forecast() returned high-uncertainty probabilityBand
      // instead of a central prediction.
      let forecastMinutes;
      let approximated;
      if (prediction.probabilityBand) {
        const bandTimes = prediction.probabilityBand.map(e => timeToMinutes(e.time));
        const bandMin = Math.min(...bandTimes);
        const bandMax = Math.max(...bandTimes);
        forecastMinutes = (bandMin + bandMax) / 2;
        approximated = true;
      } else if (prediction.central) {
        forecastMinutes = timeToMinutes(prediction.central);
        approximated = false;
      } else {
        // No usable prediction at all — ACC-03 literal: cannot score.
        continue;
      }

      // Both forecast AND actual confirmed usable — this event counts now.
      const score = eventAccuracyScore(forecastMinutes, actualMinutes, maxDelta);

      counters[type].total++;
      counters[type].scoreSum += score;
      if (approximated) counters[type].approximatedCount++;
      dayScores.push(score);

      // D-03/D-04: fan the identical bedtime score/approximation into the
      // nap-day or no-nap-day sub-bucket, classified by THIS day's actual
      // napStart. Reuses the same score — not recomputed. Not pushed into
      // dayScores again (D-10's daily mean counts each logged event once).
      if (type === 'bedtime') {
        const subType = isNapDay ? 'bedtimeNapDay' : 'bedtimeNoNapDay';
        counters[subType].total++;
        counters[subType].scoreSum += score;
        if (approximated) counters[subType].approximatedCount++;
      }
    }

    if (dayScores.length > 0) {
      dailyAverages.push(dayScores.reduce((a, b) => a + b, 0) / dayScores.length);
    }
  }

  return buildAccuracyResult(counters, dailyAverages);
}
