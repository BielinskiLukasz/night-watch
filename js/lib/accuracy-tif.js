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
// TifAccuracyResult shape (D-05, Phase 22 bedtime nap-day split):
//   { wake, napStart, napEnd, bedtime, bedtimeNapDay, bedtimeNoNapDay } each with:
//   { windowHit: {count, pct}, avgWidthMin: number, highConf: {count, pct}, total: number }
//   (WR-02: `total` lets callers distinguish "0% because always missed" from
//   "0% because zero scored days" and dash the latter.)
//
// Zero DOM, zero I/O — fully unit-testable with node:test.
//
// NOTE: Do NOT import from metrics.js here — this would create a circular import
// (metrics.js → forecast.js; forecast-tif.js → metrics.js; accuracy-tif.js must
// not close the cycle). Circular-import guard per CLAUDE.md §Pitfalls.
//
// BASE_EVENT_TYPES vs EVENT_TYPES (Phase 22 D-05):
//   BASE_EVENT_TYPES is the 4 keys tifForecast() actually returns bounds for —
//   computeTifBoundsHistory iterates ONLY this list, so its entry shape is
//   unchanged by this split. EVENT_TYPES is the 6-key superset (adds
//   bedtimeNapDay/bedtimeNoNapDay) used by computeTifAccuracy for counter
//   init/result-building only — computeTifAccuracy fans the existing combined
//   bedtime bounds into both nap-day sub-buckets using the day's own actual
//   napStart, mirroring accuracy.js's D-03 classification exactly.

import { tifForecast } from './forecast-tif.js';
import { timeToMinutes } from './forecast.js';

// ---------------------------------------------------------------------------
// Frozen config
// ---------------------------------------------------------------------------

const ACCURACY_TIF_CONFIG = Object.freeze({
  // The 4 keys tifForecast() actually returns bounds for — used unchanged by
  // computeTifBoundsHistory's entry-building loop.
  BASE_EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime']),
  // The 6 keys used only by computeTifAccuracy for counter init/result-
  // building — adds the D-05 bedtime nap-day/no-nap-day split.
  EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay']),
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
    for (const type of ACCURACY_TIF_CONFIG.BASE_EVENT_TYPES) {
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
 *   that type's totals — null TIF bounds are not treated as a miss. This
 *   applies identically to bedtimeNapDay/bedtimeNoNapDay — a null combined
 *   bedtime bounds excludes the day from all three bedtime buckets.
 *
 * pct GUARANTEE (T-14-02-02):
 *   All pct fields are integer 0-100, never NaN. When total === 0, pct = 0.
 *
 * BEDTIME NAP-DAY SPLIT (D-05, mirrors accuracy.js's D-03 exactly):
 *   Every scored bedtime event also fans into bedtimeNapDay or
 *   bedtimeNoNapDay, classified by the scored day's own actual napStart
 *   (napStart != null — Phase 19 D-04's exact definition), never by which
 *   internal series tifForecast() happened to select. The hit/width/highConf
 *   values are the SAME already-computed values as the combined `bedtime`
 *   bucket — not recomputed — just duplicated into the matching sub-bucket.
 *
 * @param {object[]} history     output of computeTifBoundsHistory
 * @param {object[]} dayRecords  original day records (for actual event lookup)
 * @returns {{ wake, napStart, napEnd, bedtime, bedtimeNapDay, bedtimeNoNapDay }}
 *   each with windowHit, avgWidthMin, highConf, total
 */
export function computeTifAccuracy(history, dayRecords) {
  // Build O(1) lookup map: date string → day record
  const dayByDate = new Map(dayRecords.map(d => [d.date, d]));

  // Initialize counters for each event type (6 keys — includes bedtime split).
  const counters = {};
  for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
    counters[type] = { total: 0, windowHitCount: 0, widthSum: 0, highConfCount: 0 };
  }

  for (const entry of history) {
    const actualDay = dayByDate.get(entry.date);
    if (!actualDay) continue; // no matching day record — skip

    // The 4 real keys present on a bounds-history entry.
    for (const type of ACCURACY_TIF_CONFIG.BASE_EVENT_TYPES) {
      const bounds = entry[type];
      if (bounds == null) continue; // null bounds — excluded from totals (ASSUMPTION MET-08)

      const actualSlot = actualDay[type];
      if (actualSlot == null) continue; // no actual event for this type — skip

      const actualMinutes = extractActualMinutes(actualSlot);
      if (actualMinutes === null) continue;

      // WR-03: timeToMinutes() never returns null — it throws on a non-string
      // input and returns NaN on a malformed 'HH:MM' string. Guard on type
      // before calling it, then check NaN after; the previous `=== null`
      // check was dead code within the currently-documented call path.
      if (typeof bounds.algMin !== 'string' || typeof bounds.algMax !== 'string') continue;
      const algMinMin = timeToMinutes(bounds.algMin);
      let algMaxMin = timeToMinutes(bounds.algMax);
      if (Number.isNaN(algMinMin) || Number.isNaN(algMaxMin)) continue;

      // CR-01 / KNOWN MIDNIGHT-CROSSING BEHAVIOR: forecast-tif.js computes
      // algMin/algMax as unbounded raw minutes and only wraps them into an
      // 'HH:MM' string via minutesToTime()'s `% 1440` when formatting
      // (forecast-tif.js "result is NOT wrapped mod 1440" comment;
      // forecast.js:92-99). A bedtime (or wake) window whose raw upper bound
      // crosses midnight (e.g. algMinRaw=1410 → "23:30", algMaxRaw=1455 →
      // wraps to "00:15") round-trips back through timeToMinutes() here as
      // algMinMin=1410 > algMaxMin=15 — a structurally inverted range. Left
      // as-is this makes `width` negative (corrupting avgWidthMin) and the
      // hit-test structurally unsatisfiable (guaranteed miss). Un-wrap the
      // window to a monotonic minute range (extend algMaxMin past 1440) and
      // un-wrap actualMinutes the same way before comparing, so both operate
      // in the same reference frame. Mirrors — but actively corrects, rather
      // than merely documents — the "KNOWN LIMITATION" naive-minutes
      // comparison accuracy.js carries for its own (less severe) case.
      if (algMaxMin < algMinMin) algMaxMin += 24 * 60;
      let actualForCompare = actualMinutes;
      if (actualForCompare < algMinMin) actualForCompare += 24 * 60;

      const c = counters[type];
      c.total++;
      const isHit = actualForCompare >= algMinMin && actualForCompare <= algMaxMin;
      if (isHit) {
        c.windowHitCount++;
      }
      const width = algMaxMin - algMinMin;
      c.widthSum += width;
      const isHighConf = bounds.precisionScore != null && bounds.precisionScore >= 80;
      if (isHighConf) {
        c.highConfCount++;
      }

      // D-05: fan the identical bedtime hit/width/highConf into the nap-day
      // or no-nap-day sub-bucket, classified by THIS day's actual napStart.
      // Reuses the same already-computed values — not recomputed.
      if (type === 'bedtime') {
        const isNapDay = actualDay.napStart != null;
        const sub = counters[isNapDay ? 'bedtimeNapDay' : 'bedtimeNoNapDay'];
        sub.total++;
        if (isHit) sub.windowHitCount++;
        sub.widthSum += width;
        if (isHighConf) sub.highConfCount++;
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
      // WR-02: expose total so callers (buildTifAccuracyGrid) can dash rows
      // with zero scored days instead of rendering a misleading 0%/±0 min.
      total: t,
    };
  }

  return result;
}
