// js/lib/forecast-blend.js
// Algorithm C — dual-model blend per NEW_ALG.md (Phase 25 D-01..D-13).
//
// Pure function: no DOM, no browser-storage, no system-clock access.
// blendForecast(dayRecords, settings, activityLog, isNoNapDay) → the identical
// top-level prediction shape as forecast()/tifForecast() — { isColdStart, wake,
// bedtime, napStart, napEnd } — so today-screen.js's algorithm dispatch ternary
// can swap between Classic/TIF/Algorithm C without changing any downstream
// rendering code (PRED-13).
//
// This plan (25-01, the phase tracer) implements the wake dual-model blend
// (D-01, D-02) fully, plus the shared trim-then-percentile (trimmedBand, D-12)
// and interval-stability-check (stabilityCheck, D-02/D-13) math that Plan 25-02
// reuses unchanged to expand bedtime/napStart/napEnd (D-03..D-10).
//
// Decisions:
//   D-01 — Wake central = average of A1's (historic wake-up band) and A2's
//          (last-bedtime-anchored sleep-duration band) trimmed medians.
//   D-02 — Interval stability check: overlap (inclusive of touching) → use the
//          intersection, shrink the central toward its center if outside;
//          no overlap → union envelope, central unchanged.
//   D-11/D-12/D-13 — blendWindowDays/blendTrimPct/blendShrinkage are user
//          settings (not baked into BLEND_CONFIG).

import { timeToMinutes, minutesToTime, detectColdStart, buildNapGapSeries, buildNapDurationSeries } from './forecast.js';
import { sleepDuration, dayLength, activityAfterNap } from './metrics.js';

// ---------------------------------------------------------------------------
// Frozen config
// ---------------------------------------------------------------------------

const BLEND_CONFIG = Object.freeze({ ROUND_MINUTES: 5 });

// ---------------------------------------------------------------------------
// Local extractTime — own copy per the sibling-module duplication convention
// already established between forecast.js/forecast-tif.js/metrics.js.
// ---------------------------------------------------------------------------

/**
 * Extract 'HH:MM' string from a day-record slot.
 * Handles null, bare 'HH:MM' string (unit tests), or event object { at }.
 * @param {null|string|{at:string}} slot
 * @returns {string|null}
 */
function extractTime(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) return slot.at.slice(11);
  if (typeof slot === 'string') return slot;
  return null;
}

// ---------------------------------------------------------------------------
// trimmedBand — exported for unit testing (D-12)
// ---------------------------------------------------------------------------

/**
 * Compute trimmed min, max, and median of a sorted ascending numeric array.
 *
 * Byte-identical budget/split/median math to forecast-tif.js's trimmedMinMax:
 * budget = max(0, floor(N × trimPct / 100) − manualExcludedCount), split
 * symmetrically (floor(budget/2) off the low end, ceil(budget/2) off the high
 * end), median = middle element (odd) or average of the two middle elements
 * (even).
 *
 * @param {number[]} sortedValues        sorted ascending numeric array
 * @param {number}   trimPct             0–40 percent to trim total
 * @param {number}   manualExcludedCount already-excluded count (counts against budget)
 * @returns {{ min: number, max: number, median: number }|null}
 */
export function trimmedBand(sortedValues, trimPct, manualExcludedCount) {
  const N = sortedValues.length;
  if (N === 0) return null;

  const budget = Math.max(0, Math.floor(N * trimPct / 100) - manualExcludedCount);
  const low  = Math.floor(budget / 2);
  const high = Math.ceil(budget / 2);

  const trimmed = high > 0
    ? sortedValues.slice(low, sortedValues.length - high)
    : sortedValues.slice(low);

  if (trimmed.length === 0) return null;
  const mid = Math.floor(trimmed.length / 2);
  const median = trimmed.length % 2 === 1
    ? trimmed[mid]
    : (trimmed[mid - 1] + trimmed[mid]) / 2;
  return { min: trimmed[0], max: trimmed[trimmed.length - 1], median };
}

// ---------------------------------------------------------------------------
// stabilityCheck — exported for unit testing (D-02)
// ---------------------------------------------------------------------------

/**
 * Generalized N-interval overlap/shrinkage/union stability check.
 *
 * If all intervals overlap (max(mins) <= min(maxs), inclusive of touching —
 * matching forecast-tif.js's computeIntersection convention where only
 * finalStart > finalEnd counts as non-overlap): report the intersection band;
 * if `central` lies outside it, shrink toward the intersection's center via
 * `final = (1 - shrinkage) * central + shrinkage * center(intersection)`.
 *
 * If any pair does not overlap: report the union envelope
 * [min(all mins), max(all maxs)] with `central` unchanged (D-02's explicit
 * resolution — no optional shrink-toward-closer-interval).
 *
 * This same 2-interval test generalizes unchanged to 3+ intervals (Plan
 * 25-02's bedtime blend, D-06) because 1-D interval pairwise-overlap and
 * group-overlap are mathematically equivalent (Helly's theorem in one
 * dimension): max(...mins) <= min(...maxs) is simultaneously the pairwise
 * overlap test AND the N-way common-intersection test, so no separate 3-way
 * branching is ever needed.
 *
 * @param {{min:number,max:number}[]} intervals  2 or more intervals
 * @param {number} central    raw (pre-stability-check) central prediction, minutes
 * @param {number} shrinkage  0.0–1.0 shrinkage factor (D-13)
 * @returns {{min:number,max:number,central:number}}
 */
export function stabilityCheck(intervals, central, shrinkage) {
  const interStart = Math.max(...intervals.map(iv => iv.min));
  const interEnd   = Math.min(...intervals.map(iv => iv.max));

  if (interStart <= interEnd) {
    const center = (interStart + interEnd) / 2;
    const finalCentral = (central >= interStart && central <= interEnd)
      ? central
      : (1 - shrinkage) * central + shrinkage * center;
    return { min: interStart, max: interEnd, central: finalCentral };
  }

  return {
    min: Math.min(...intervals.map(iv => iv.min)),
    max: Math.max(...intervals.map(iv => iv.max)),
    central,
  };
}

// ---------------------------------------------------------------------------
// wrapToDay — private; used by Plan 25-02's wake-/nap-end-anchored bedtime
// duration bands (D-03/D-04), which can project past midnight.
// ---------------------------------------------------------------------------

const DAY = 24 * 60;

/** Wrap a raw-minutes value back into [0, DAY). */
function wrapToDay(m) {
  return ((m % DAY) + DAY) % DAY;
}

// ---------------------------------------------------------------------------
// combineModels — shared 0/1/N-model combiner (Plan 25-02, D-07..D-10/D-03..D-06)
// ---------------------------------------------------------------------------

/**
 * Combine 0, 1, or N already-computed models into a single raw-minutes band.
 *
 * - 0 models  → `{central:null, min:null, max:null}` — the universal
 *   null-on-no-data contract (matching forecast.js/tifForecast).
 * - 1 model   → that model's own median/min/max, no stability check.
 * - 2+ models → average of medians as the raw central, then `stabilityCheck`
 *   resolves the group intersection/union and shrinks central if it falls
 *   outside — the same pattern wake's A1/A2 blend already established, now
 *   shared by napStart (2 models), napEnd (2 models), and bedtime (3 models).
 *
 * @param {{min:number,max:number,median:number}[]} models  non-null models only
 * @param {number} shrinkage  0.0-1.0 shrinkage factor (D-13)
 * @returns {{central:number|null, min:number|null, max:number|null}}
 */
function combineModels(models, shrinkage) {
  if (models.length === 0) {
    return { central: null, min: null, max: null };
  }
  if (models.length === 1) {
    const [m] = models;
    return { central: m.median, min: m.min, max: m.max };
  }
  const rawCentral = models.reduce((sum, m) => sum + m.median, 0) / models.length;
  const sc = stabilityCheck(models, rawCentral, shrinkage);
  return { central: sc.central, min: sc.min, max: sc.max };
}

// ---------------------------------------------------------------------------
// blendForecast — main export
// ---------------------------------------------------------------------------

/**
 * Algorithm C: dual/multi-model trim-then-percentile blend with interval
 * stability checks.
 *
 * Plan 25-01 implemented wake (D-01/D-02). Plan 25-02 (this plan) completes
 * napStart (D-07/D-08), napEnd (D-09/D-10), and bedtime (D-03..D-06) — every
 * Algorithm C event (PRED-17) now produces a real prediction.
 *
 * @param {object[]} dayRecords              pre-bucketed day records
 * @param {object}   settings                needs minDays, blendWindowDays,
 *                                            blendTrimPct, blendShrinkage
 * @param {object}   [activityLog={}]        unused by Algorithm C (reserved
 *                                            for parity with tifForecast's
 *                                            signature; not consumed here)
 * @param {boolean}  [isNoNapDay=false]      D-05 — when true, bedtime's
 *                                            Model 3 substitutes a no-nap-day
 *                                            historic bedtime band instead of
 *                                            the nap-end-anchored AA band
 * @returns {{isColdStart:boolean, wake:object|null, bedtime:object|null, napStart:object|null, napEnd:object|null}}
 */
export function blendForecast(dayRecords, settings, activityLog = {}, isNoNapDay = false) {
  // Step 1 — cold-start gate. Mirrors tifForecast's exact shape (not forecast()'s
  // validDayCount/minDaysRemaining fields) — CONTEXT.md's canonical_refs name
  // forecast-tif.js, not forecast.js, as the structural model.
  const { isColdStart } = detectColdStart(dayRecords, settings.minDays);
  if (isColdStart) {
    return { isColdStart: true, wake: null, bedtime: null, napStart: null, napEnd: null };
  }

  // Step 2 — slice to blendWindowDays (D-11: independent of Classic's windowDays).
  const window = dayRecords.slice(-(settings.blendWindowDays ?? 90));
  const acceptedWindow   = window.filter(d => !d.rejected);
  const rejectedInWindow = window.length - acceptedWindow.length;

  const blendTrimPct   = settings.blendTrimPct ?? 25;
  const blendShrinkage = settings.blendShrinkage ?? 0.3;

  // Resolved once, near the top of the non-cold-start branch — reused by
  // nap-start, nap-end (this plan) and bedtime (Task 2's D-03/D-04 anchors).
  const todayRecord             = dayRecords[dayRecords.length - 1];
  const todayActualWakeHHMM     = extractTime(todayRecord.wake);
  const todayActualNapStartHHMM = extractTime(todayRecord.napStart);

  // ---------------------------------------------------------------------
  // Nap-start (D-07/D-08)
  // ---------------------------------------------------------------------
  const napGaps = buildNapGapSeries(acceptedWindow);
  const wakeAnchorMin = todayActualWakeHHMM != null ? timeToMinutes(todayActualWakeHHMM) : null;

  // Model 1 — wake-anchored gap: only when today's wake is actually logged
  // (mirroring forecast-tif.js's wakeAnchorForNap, which never resolves to a
  // predicted wake since nap-start is computed before wake in both files).
  let napStartModel1 = null;
  if (wakeAnchorMin != null && napGaps.length > 0) {
    const gapBand = trimmedBand([...napGaps].sort((a, b) => a - b), blendTrimPct, rejectedInWindow);
    if (gapBand) {
      napStartModel1 = {
        min:    wakeAnchorMin + gapBand.min,
        max:    wakeAnchorMin + gapBand.max,
        median: wakeAnchorMin + gapBand.median,
      };
    }
  }

  // Model 2 — historic nap-start time-of-day band (always attempted).
  const napStartTimes = acceptedWindow
    .map(d => extractTime(d.napStart))
    .filter(t => t != null)
    .map(timeToMinutes)
    .sort((a, b) => a - b);
  const napStartModel2 = trimmedBand(napStartTimes, blendTrimPct, rejectedInWindow);

  const napStartCombined = combineModels(
    [napStartModel1, napStartModel2].filter(m => m != null),
    blendShrinkage
  );
  const napStart = napStartCombined.central == null
    ? { central: null, min: null, max: null }
    : {
        central: minutesToTime(napStartCombined.central),
        min:     minutesToTime(napStartCombined.min),
        max:     minutesToTime(napStartCombined.max),
      };

  // ---------------------------------------------------------------------
  // Nap-end (D-09/D-10)
  // ---------------------------------------------------------------------
  const napDurations = buildNapDurationSeries(acceptedWindow);

  // durBand2 depends only on historic durations (not on any anchor), so it is
  // computed once and shared by both Model 1 (chained) and Model 2 (D-10).
  const durBand2 = trimmedBand([...napDurations].sort((a, b) => a - b), blendTrimPct, rejectedInWindow);

  // Model 1 — fully chained wake-anchored gap+duration: only when today's
  // wake is actually logged.
  let napEndModel1 = null;
  if (wakeAnchorMin != null) {
    const gapBand2 = trimmedBand([...napGaps].sort((a, b) => a - b), blendTrimPct, rejectedInWindow);
    if (gapBand2 && durBand2) {
      napEndModel1 = {
        min:    wakeAnchorMin + gapBand2.min    + durBand2.min,
        max:    wakeAnchorMin + gapBand2.max    + durBand2.max,
        median: wakeAnchorMin + gapBand2.median + durBand2.median,
      };
    }
  }

  // Model 2 — nap-start-anchored duration band. Anchor is today's ACTUAL
  // logged nap-start if present, else the nap-start prediction's own central
  // value already computed above (D-10).
  const napStartAnchorHHMM = todayActualNapStartHHMM ?? napStart.central;
  let napEndModel2 = null;
  if (napStartAnchorHHMM != null && durBand2) {
    const napStartAnchorMin = timeToMinutes(napStartAnchorHHMM);
    napEndModel2 = {
      min:    napStartAnchorMin + durBand2.min,
      max:    napStartAnchorMin + durBand2.max,
      median: napStartAnchorMin + durBand2.median,
    };
  }

  const napEndCombined = combineModels(
    [napEndModel1, napEndModel2].filter(m => m != null),
    blendShrinkage
  );
  const napEnd = napEndCombined.central == null
    ? { central: null, min: null, max: null }
    : {
        central: minutesToTime(napEndCombined.central),
        min:     minutesToTime(napEndCombined.min),
        max:     minutesToTime(napEndCombined.max),
      };

  // Step 3 — A1: historic wake-up time-of-day band.
  const a1Times = acceptedWindow
    .map(d => extractTime(d.wake))
    .filter(t => t != null)
    .map(timeToMinutes)
    .sort((a, b) => a - b);
  const a1 = trimmedBand(a1Times, blendTrimPct, rejectedInWindow);

  // Step 4 — resolve lastBedtimeHHMM via backward scan over `window` (not
  // acceptedWindow — matches forecast.js's own scan for this anchor lookup).
  let lastBedtimeHHMM = null;
  for (let i = window.length - 1; i >= 0; i--) {
    const b = extractTime(window[i].bedtime);
    if (b) { lastBedtimeHHMM = b; break; }
  }

  // Step 5 — A2: sleep-length projection anchored to the last logged bedtime.
  let a2 = null;
  if (lastBedtimeHHMM != null) {
    const sleepDurations = acceptedWindow
      .map(sleepDuration)
      .filter(v => v != null)
      .sort((a, b) => a - b);
    const durBand = trimmedBand(sleepDurations, blendTrimPct, rejectedInWindow);
    if (durBand) {
      // Raw anchor+duration crosses midnight (e.g. bedtime 20:30 + ~9.5h sleep
      // lands at ~1800-1855 raw minutes). Wrap into [0, 1440) so A2 shares the
      // same numeric reference frame as A1 before stabilityCheck's min/max
      // comparisons and central averaging — same pattern as forecast-tif.js's
      // wrapToDay() call on its own bedtime-anchored sleep-length band.
      const anchor = timeToMinutes(lastBedtimeHHMM);
      a2 = {
        min:    wrapToDay(anchor + durBand.min),
        max:    wrapToDay(anchor + durBand.max),
        median: wrapToDay(anchor + durBand.median),
      };
    }
  }

  // Step 6 — combine A1 and A2.
  let wake;
  if (a1 == null) {
    // No wake history at all — cold-start gate does not guarantee wake-specific
    // data, matching Classic's own wakeHourResult === null guard.
    wake = { central: null, min: null, max: null };
  } else if (a2 == null) {
    // A2 unavailable (no bedtime ever logged) — A1-only fallback, no stability check.
    wake = { central: minutesToTime(a1.median), min: minutesToTime(a1.min), max: minutesToTime(a1.max) };
  } else {
    const rawCentral = (a1.median + a2.median) / 2;
    const sc = stabilityCheck([a1, a2], rawCentral, blendShrinkage);
    wake = { central: minutesToTime(sc.central), min: minutesToTime(sc.min), max: minutesToTime(sc.max) };
  }

  // ---------------------------------------------------------------------
  // Bedtime (D-03..D-06) — last computation; depends on `wake` and `napEnd`
  // already being resolved above.
  // ---------------------------------------------------------------------

  // Anchor 1 — today's wake, actual if logged else the wake prediction's own
  // central (D-03 extends D-10's actual-else-predicted rule to this anchor).
  const todayWakeAnchorHHMM = todayActualWakeHHMM ?? wake.central;
  const todayWakeAnchorMin = todayWakeAnchorHHMM != null ? timeToMinutes(todayWakeAnchorHHMM) : null;

  // Anchor 2 — today's nap-end, actual if logged else the nap-end
  // prediction's own central (same actual-else-predicted rule).
  const todayActualNapEndHHMM = extractTime(todayRecord.napEnd);
  const todayNapEndAnchorHHMM = todayActualNapEndHHMM ?? napEnd.central;
  const todayNapEndAnchorMin = todayNapEndAnchorHHMM != null ? timeToMinutes(todayNapEndAnchorHHMM) : null;

  // Model 1 — historic bedtime time-of-day band (always attempted).
  const bedtimeTimes = acceptedWindow
    .map(d => extractTime(d.bedtime))
    .filter(t => t != null)
    .map(timeToMinutes)
    .sort((a, b) => a - b);
  const bedtimeModel1 = trimmedBand(bedtimeTimes, blendTrimPct, rejectedInWindow);

  // Model 2 — wake-anchored day-length band. Raw anchor+duration can cross
  // midnight (bedtime is naturally the "far end" of the day from wake), so
  // wrap into [0, 1440) before combining, same as wake's own A2 (Plan 25-01).
  let bedtimeModel2 = null;
  if (todayWakeAnchorMin != null) {
    const dayLengths = acceptedWindow.map(dayLength).filter(v => v != null).sort((a, b) => a - b);
    const dlBand = trimmedBand(dayLengths, blendTrimPct, rejectedInWindow);
    if (dlBand) {
      bedtimeModel2 = {
        min:    wrapToDay(todayWakeAnchorMin + dlBand.min),
        max:    wrapToDay(todayWakeAnchorMin + dlBand.max),
        median: wrapToDay(todayWakeAnchorMin + dlBand.median),
      };
    }
  }

  // Model 3 — nap-end-anchored activity-after-nap band on nap days; on
  // no-nap days (D-05) this is REPLACED by a raw historic bedtime band built
  // only from days where napStart is null (never a 2-band collapse when that
  // substitute band is itself available). When the substitute itself is thin
  // (< minDays no-nap-day records), bedtimeModel3 stays null — the function
  // does NOT fall back to computing the AA-band anyway; it simply omits
  // Model 3 from the group per this plan's universal graceful-degradation
  // contract.
  let bedtimeModel3 = null;
  if (!isNoNapDay) {
    if (todayNapEndAnchorMin != null) {
      const aaDurations = acceptedWindow.map(activityAfterNap).filter(v => v != null).sort((a, b) => a - b);
      const aaBand = trimmedBand(aaDurations, blendTrimPct, rejectedInWindow);
      if (aaBand) {
        bedtimeModel3 = {
          min:    wrapToDay(todayNapEndAnchorMin + aaBand.min),
          max:    wrapToDay(todayNapEndAnchorMin + aaBand.max),
          median: wrapToDay(todayNapEndAnchorMin + aaBand.median),
        };
      }
    }
  } else {
    const noNapBedtimeTimes = acceptedWindow
      .filter(d => extractTime(d.napStart) == null)
      .map(d => extractTime(d.bedtime))
      .filter(t => t != null)
      .map(timeToMinutes)
      .sort((a, b) => a - b);
    bedtimeModel3 = trimmedBand(noNapBedtimeTimes, blendTrimPct, 0);
  }

  const bedtimeCombined = combineModels(
    [bedtimeModel1, bedtimeModel2, bedtimeModel3].filter(m => m != null),
    blendShrinkage
  );
  const bedtime = bedtimeCombined.central == null
    ? { central: null, min: null, max: null }
    : {
        central: minutesToTime(bedtimeCombined.central),
        min:     minutesToTime(bedtimeCombined.min),
        max:     minutesToTime(bedtimeCombined.max),
      };

  return {
    isColdStart: false,
    wake,
    bedtime,
    napStart,
    napEnd,
  };
}
