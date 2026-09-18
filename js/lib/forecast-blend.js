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
// wrapToDay — private, reserved for Plan 25-02's anchored duration bands
// ---------------------------------------------------------------------------

const DAY = 24 * 60;

/** Wrap a raw-minutes value back into [0, DAY). */
function wrapToDay(m) {
  return ((m % DAY) + DAY) % DAY;
}

// ---------------------------------------------------------------------------
// blendForecast — main export
// ---------------------------------------------------------------------------

/**
 * Algorithm C: dual/multi-model trim-then-percentile blend with interval
 * stability checks.
 *
 * This plan (25-01) fully implements wake (D-01/D-02); bedtime/napStart/napEnd
 * are explicit `{central:null,min:null,max:null}` stubs pending Plan 25-02.
 *
 * @param {object[]} dayRecords              pre-bucketed day records
 * @param {object}   settings                needs minDays, blendWindowDays,
 *                                            blendTrimPct, blendShrinkage
 * @param {object}   [activityLog={}]        unused by this plan's wake blend;
 *                                            reserved for Plan 25-02
 * @param {boolean}  [isNoNapDay=false]      unused by this plan's wake blend;
 *                                            reserved for Plan 25-02
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

  // Step 7 — bedtime/napStart/napEnd stubs.
  // Plan 25-02 replaces these three stubs with real D-03..D-10 blends.
  return {
    isColdStart: false,
    wake,
    bedtime:  { central: null, min: null, max: null },
    napStart: { central: null, min: null, max: null },
    napEnd:   { central: null, min: null, max: null },
  };
}
