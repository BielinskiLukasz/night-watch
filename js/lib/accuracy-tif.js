// js/lib/accuracy-tif.js
// Pure retroactive TIF backtesting engine.
//
// Phase: NW-14
// Requirements: MET-08, TIF-14
// Decisions: D-10, D-05 (Phase 14 CONTEXT), D-06 Phase 13 CONTEXT
//
// Exports:
//   computeTifBoundsHistory(dayRecords, settings, activityLog) → TifBoundsEntry[]
//   computeTifAccuracy(history, dayRecords) → TifAccuracyResult
//
// TifBoundsEntry shape (D-10):
//   { date: 'YYYY-MM-DD', wake: TifBounds|null, napStart: TifBounds|null,
//     napEnd: TifBounds|null, bedtime: TifBounds|null }
//
// TifBounds shape (D-10 + D-07 central for median-TIF in Plan 03):
//   { algMin: string, algMax: string, central: string|null, precisionScore: number|null }
//
// TifAccuracyResult shape (D-05):
//   { wake, napStart, napEnd, bedtime } each with:
//   { windowHit: {count, pct}, avgWidthMin: number, highConf: {count, pct} }
//
// Zero DOM, zero I/O — fully unit-testable with node:test.
//
// NOTE: Do NOT import from metrics.js here — this would create a circular import
// (metrics.js → forecast.js; forecast-tif.js → metrics.js; accuracy-tif.js must
// not close the cycle). Circular-import guard per CLAUDE.md §Pitfalls.

import { tifForecast } from './forecast-tif.js';
import { timeToMinutes } from './forecast.js';

// ---------------------------------------------------------------------------
// Frozen config
// ---------------------------------------------------------------------------

const ACCURACY_TIF_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime']),
});

// ---------------------------------------------------------------------------
// Private helper: extract HH:MM → minutes from an actual event slot.
//
// Mirrors extractActualMinutes in accuracy.js.
// Supports two formats:
//   - Event object: { at: 'YYYY-MM-DDTHH:MM' } → take last 5 chars as HH:MM
//   - Bare HH:MM string: 'HH:MM' → use directly (synthetic test data)
//
// @param {{ at: string }|string|null} slot
// @returns {number|null}
// ---------------------------------------------------------------------------
function extractActualMinutes(slot) {
  if (slot == null) return null;
  let hhmm;
  if (typeof slot === 'object' && slot.at) {
    hhmm = slot.at.length > 5 ? slot.at.slice(-5) : slot.at;
  } else if (typeof slot === 'string') {
    hhmm = slot.length > 5 ? slot.slice(-5) : slot;
  } else {
    return null;
  }
  return timeToMinutes(hhmm);
}

// ---------------------------------------------------------------------------
// computeTifBoundsHistory
// ---------------------------------------------------------------------------

/**
 * Retroactively compute TIF prediction bounds for each historical day.
 *
 * For each day D starting from index minDays, calls tifForecast() with only
 * the records BEFORE day D (look-ahead bias prevention — same invariant as
 * computeAccuracy in accuracy.js).
 *
 * LOOP INVARIANT (look-ahead bias prevention, T-14-02-01):
 *   for (let i = minDays; i < sorted.length; i++) {
 *     const history = sorted.slice(0, i);   // only BEFORE day i — no look-ahead
 *     const actual  = sorted[i];             // the day being scored
 *   }
 *
 * COLD-START HANDLING:
 *   When tifForecast returns isColdStart:true, an entry is still pushed with
 *   all event fields null. The date is always recorded (D-10).
 *
 * NULL GUARD:
 *   When tifForecast returns a prediction but pred[type].algMin is null,
 *   that entry is treated as null (partial prediction — guard D-10).
 *
 * @param {object[]} dayRecords   array of day records from daysBySubjectiveNight()
 * @param {object}   settings     settings snapshot
 *   Required fields: tifRollingDays (integer, from Phase 13 D-06), minDays (integer)
 * @param {object}   [activityLog] optional map keyed by 'YYYY-MM-DD'; values are
 *   MA duration in minutes. Passed through to tifForecast (D-09, D-10).
 * @returns {Array<{date:string, wake:TifBounds|null, napStart:TifBounds|null,
 *                  napEnd:TifBounds|null, bedtime:TifBounds|null}>}
 */
export function computeTifBoundsHistory(dayRecords, settings, activityLog) {
  // Sort chronologically — defensive; lexicographic YYYY-MM-DD sort is correct.
  const sorted = [...dayRecords].sort((a, b) => (a.date < b.date ? -1 : 1));
  const results = [];

  // Use tifRollingDays as the warm-up period (D-06 Phase 13 / Plan assumption TIF-14).
  // Falls back to minDays if tifRollingDays is not set.
  const minDays = settings.tifRollingDays ?? settings.minDays;

  // LOOK-AHEAD BIAS PREVENTION (T-14-02-01):
  //   Start at index minDays so history = sorted.slice(0, i) has at least minDays records.
  //   actual = sorted[i] is the day we are evaluating — NOT included in history.
  for (let i = minDays; i < sorted.length; i++) {
    const history = sorted.slice(0, i); // everything BEFORE day i — no look-ahead
    const actual  = sorted[i];          // the day being scored

    const pred = tifForecast(history, settings, activityLog ?? {});

    if (pred.isColdStart) {
      // Date still recorded (D-10); all event fields null.
      results.push({ date: actual.date, wake: null, napStart: null, napEnd: null, bedtime: null });
      continue;
    }

    const entry = { date: actual.date };
    for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
      const p = pred[type];
      entry[type] = (p && p.algMin != null && p.algMax != null)
        ? {
            algMin:         p.algMin,
            algMax:         p.algMax,
            central:        p.central ?? null,
            precisionScore: p.precisionScore ?? null,
          }
        : null;
    }
    results.push(entry);
  }

  return results;
}

// ---------------------------------------------------------------------------
// computeTifAccuracy
// ---------------------------------------------------------------------------

/**
 * Compute per-event-type TIF accuracy statistics from retroactive history.
 *
 * For each TIF bounds history entry:
 *   - windowHit: actual event time falls inside [algMin, algMax]
 *   - avgWidthMin: mean(algMax_minutes − algMin_minutes) across scored days
 *   - highConf: precisionScore >= 80
 *
 * NULL HANDLING (ASSUMPTION MET-08 boundary):
 *   Days where bounds for a specific event type are null are excluded from
 *   that type's totals — null TIF bounds are not treated as a miss.
 *
 * pct GUARANTEE (T-14-02-02):
 *   All pct fields are integer 0-100, never NaN. When total === 0, pct = 0.
 *
 * @param {object[]} history     output of computeTifBoundsHistory
 * @param {object[]} dayRecords  original day records (for actual event lookup)
 * @returns {{ wake, napStart, napEnd, bedtime }}  each with windowHit, avgWidthMin, highConf
 */
export function computeTifAccuracy(history, dayRecords) {
  // Build O(1) lookup map: date string → day record
  const dayByDate = new Map(dayRecords.map(d => [d.date, d]));

  // Initialize counters for each event type
  const counters = {};
  for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
    counters[type] = { total: 0, windowHitCount: 0, widthSum: 0, highConfCount: 0 };
  }

  for (const entry of history) {
    const actualDay = dayByDate.get(entry.date);
    if (!actualDay) continue; // no matching day record — skip

    for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
      const bounds = entry[type];
      if (bounds == null) continue; // null bounds — excluded from totals (ASSUMPTION MET-08)

      const actualSlot = actualDay[type];
      if (actualSlot == null) continue; // no actual event for this type — skip

      const actualMinutes = extractActualMinutes(actualSlot);
      if (actualMinutes === null) continue;

      const algMinMin = timeToMinutes(bounds.algMin);
      const algMaxMin = timeToMinutes(bounds.algMax);
      if (algMinMin === null || algMaxMin === null) continue;

      const c = counters[type];
      c.total++;
      if (actualMinutes >= algMinMin && actualMinutes <= algMaxMin) {
        c.windowHitCount++;
      }
      c.widthSum += algMaxMin - algMinMin;
      if (bounds.precisionScore != null && bounds.precisionScore >= 80) {
        c.highConfCount++;
      }
    }
  }

  // Build result with pct guarantee (T-14-02-02): total===0 → pct=0, never NaN
  const result = {};
  for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
    const c = counters[type];
    const t = c.total;

    function pct(count) {
      return t === 0 ? 0 : Math.round(count / t * 100);
    }

    result[type] = {
      windowHit: { count: c.windowHitCount, pct: pct(c.windowHitCount) },
      avgWidthMin: t === 0 ? 0 : c.widthSum / t,
      highConf:  { count: c.highConfCount,  pct: pct(c.highConfCount)  },
    };
  }

  return result;
}
