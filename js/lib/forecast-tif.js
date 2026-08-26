// js/lib/forecast-tif.js
// Trimmed Intersection Forecast (TIF) algorithm — Phase 10 (B-021).
//
// Pure function: no DOM, no browser-storage, no system-clock access.
// tifForecast(dayRecords, settings) → same top-level shape as forecast.js but
// each prediction object carries extended TIF metadata (precisionScore,
// isLowConfidence, algRange, algMin, algMax, sourceWindows).
//
// Decisions:
//   D10-04 — trimmedMinMax lives here (TIF-algorithm concern, not metrics)
//   D10-05 — extended prediction shape with precisionScore, isLowConfidence etc.
//   10-CONTEXT specifics — precisionTarget is a window width in minutes

import { timeToMinutes, minutesToTime, detectColdStart } from './forecast.js';
import {
  sleepDuration,
  napDuration,
  activityBeforeNap,
  activityAfterNap,
  dayLength,
  combinedSleepNap,
} from './metrics.js';

// ---------------------------------------------------------------------------
// Frozen config
// ---------------------------------------------------------------------------

const TIF_CONFIG = Object.freeze({ ROUND_MINUTES: 5 });

// ---------------------------------------------------------------------------
// Local extractTime — same logic as private helper in forecast.js and metrics.js.
// Copied here to avoid relying on unexported internals.
// ---------------------------------------------------------------------------

/**
 * Extract 'HH:MM' string from a day-record slot.
 * Handles null, bare 'HH:MM' string (unit tests), or event object { at: 'YYYY-MM-DDTHH:MM' }.
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
// trimmedMinMax — exported for unit testing (D10-04)
// ---------------------------------------------------------------------------

/**
 * Compute trimmed min, max, and median of a sorted ascending numeric array.
 *
 * The auto-trim budget = max(0, floor(N × trimPct / 100) − manualExcludedCount).
 * The budget is split symmetrically: remove floor(budget/2) from the bottom and
 * ceil(budget/2) from the top (matches B-021 Step 1 spec).
 *
 * The `median` field is the P50 of the trimmed array:
 *   - Odd-length trimmed array: the middle element.
 *   - Even-length trimmed array: average of the two middle elements.
 *
 * @param {number[]} values             sorted ascending numeric array
 * @param {number}   trimPct            0–40 percent to trim total
 * @param {number}   manualExcludedCount already-excluded count (counts against budget)
 * @returns {{ min: number, max: number, median: number }|null}  null when all values are trimmed away
 */
export function trimmedMinMax(values, trimPct, manualExcludedCount) {
  const N = values.length;
  if (N === 0) return null;

  const budget = Math.max(0, Math.floor(N * trimPct / 100) - manualExcludedCount);
  const low  = Math.floor(budget / 2);
  const high = Math.ceil(budget / 2);

  // Slice: remove `low` from front; if high > 0 also remove from back
  const trimmed = high > 0
    ? values.slice(low, values.length - high)
    : values.slice(low);

  if (trimmed.length === 0) return null;
  const mid = Math.floor(trimmed.length / 2);
  const median = trimmed.length % 2 === 1
    ? trimmed[mid]
    : (trimmed[mid - 1] + trimmed[mid]) / 2;
  return { min: trimmed[0], max: trimmed[trimmed.length - 1], median };
}

// ---------------------------------------------------------------------------
// computeIntersection — internal
// ---------------------------------------------------------------------------

/**
 * Intersect an array of {min, max} windows (all numeric minutes).
 * If intersection is empty (start > end), fall back to union and flag low-confidence.
 *
 * @param {{ min: number, max: number }[]} windows
 * @returns {{ min: number, max: number, isLowConfidence: boolean }}
 */
function computeIntersection(windows) {
  let finalStart = Math.max(...windows.map(w => w.min));
  let finalEnd   = Math.min(...windows.map(w => w.max));

  if (finalStart > finalEnd) {
    // Empty intersection — fall back to union
    return {
      min: Math.min(...windows.map(w => w.min)),
      max: Math.max(...windows.map(w => w.max)),
      isLowConfidence: true,
    };
  }

  return { min: finalStart, max: finalEnd, isLowConfidence: false };
}

// ---------------------------------------------------------------------------
// applyPrecision — internal
// ---------------------------------------------------------------------------

/**
 * Apply precision-target narrowing to an algorithm range.
 *
 * precisionTarget is a window width in minutes (B-021 Step 4, D10-13).
 * If algRange ≤ precisionTarget → score = 100, display as-is.
 * If algRange > precisionTarget → score = round(precisionTarget/algRange*100),
 *   narrow to precisionTarget wide centred on the midpoint.
 *
 * @param {number} min             algorithm range start (minutes)
 * @param {number} max             algorithm range end (minutes)
 * @param {number} precisionTarget desired maximum window width (minutes)
 * @returns {{ precisionScore: number, algRange: number, dispMin: number, dispMax: number }}
 */
function applyPrecision(min, max, precisionTarget) {
  const algRange = max - min;

  if (algRange <= precisionTarget) {
    return {
      precisionScore: 100,
      algRange,
      dispMin: min,
      dispMax: max,
    };
  }

  const precisionScore = Math.round(precisionTarget / algRange * 100);
  const center = (min + max) / 2;
  return {
    precisionScore,
    algRange,
    dispMin: center - precisionTarget / 2,
    dispMax: center + precisionTarget / 2,
  };
}

// ---------------------------------------------------------------------------
// buildHistoricBand — internal
// ---------------------------------------------------------------------------

/**
 * Build a min/max band from an array of raw time-minutes values.
 * Sorts ascending, applies trimmedMinMax.
 *
 * @param {number[]} times           raw minute values (unsorted)
 * @param {number}   trimPct
 * @param {number}   manualExcluded
 * @returns {{ min: number, max: number }|null}
 */
function buildHistoricBand(times, trimPct, manualExcluded) {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  return trimmedMinMax(sorted, trimPct, manualExcluded);
}

// ---------------------------------------------------------------------------
// buildDurationBand — internal
// ---------------------------------------------------------------------------

/**
 * Build a min/max/median band by projecting trimmed duration statistics onto an anchor time.
 * Result: { min: anchorMinutes + durMin, max: anchorMinutes + durMax,
 *           median: anchorMinutes + P50(sortedDurations) }.
 *
 * The `median` field equals anchorMinutes + P50 of the trimmed, sorted durations
 * (inherited from trimmedMinMax — same P50 definition: middle element for odd-length
 * arrays, average of the two middle elements for even-length arrays).
 *
 * Note: result is NOT wrapped mod 1440. Callers that anchor to bedtime (producing
 * times that cross midnight) must wrap themselves — see wrapToDay().
 *
 * @param {number[]} durations      raw duration values (unsorted, minutes)
 * @param {number}   anchorMinutes  anchor event time in minutes
 * @param {number}   trimPct
 * @param {number}   manualExcluded
 * @returns {{ min: number, max: number, median: number }|null}
 */
function buildDurationBand(durations, anchorMinutes, trimPct, manualExcluded) {
  if (durations.length === 0) return null;
  const sorted = [...durations].sort((a, b) => a - b);
  const result = trimmedMinMax(sorted, trimPct, manualExcluded);
  if (result === null) return null;
  return {
    min:    anchorMinutes + result.min,
    max:    anchorMinutes + result.max,
    median: anchorMinutes + result.median,
  };
}

// ---------------------------------------------------------------------------
// wrapToDay — internal
// ---------------------------------------------------------------------------

const DAY = 24 * 60;

/**
 * Wrap a raw-minutes value back into [0, DAY).
 * Needed for overnight duration bands (bedtime + sleep/combined) whose raw
 * values exceed 1440 because they cross midnight.
 */
function wrapToDay(m) {
  return ((m % DAY) + DAY) % DAY;
}

// ---------------------------------------------------------------------------
// resolveTodayNapDuration — internal
// ---------------------------------------------------------------------------

/**
 * Resolve today's nap duration (minutes) for the combined-band correction.
 *
 * Priority:
 *   1. Both napStart and napEnd are logged → actual duration.
 *   2. Only napStart logged → actual start + napEndPred.central.
 *   3. Neither logged → napStartPred.central + napEndPred.central.
 *
 * Returns null when insufficient data is available.
 *
 * @param {object[]} dayRecords   all pre-bucketed day records
 * @param {object}   napStartPred TIF prediction for napStart
 * @param {object}   napEndPred   TIF prediction for napEnd
 * @returns {number|null}
 */
function resolveTodayNapDuration(dayRecords, napStartPred, napEndPred) {
  const today = dayRecords[dayRecords.length - 1];
  if (!today) return null;

  const actualStart = extractTime(today.napStart);
  const actualEnd   = extractTime(today.napEnd);

  if (actualStart !== null && actualEnd !== null) {
    return timeToMinutes(actualEnd) - timeToMinutes(actualStart);
  }

  if (actualStart !== null && napEndPred?.central) {
    return timeToMinutes(napEndPred.central) - timeToMinutes(actualStart);
  }

  if (napStartPred?.central && napEndPred?.central) {
    return timeToMinutes(napEndPred.central) - timeToMinutes(napStartPred.central);
  }

  return null;
}

// ---------------------------------------------------------------------------
// resolveAnchor — internal
// ---------------------------------------------------------------------------

/**
 * Resolve anchor time in minutes for a given event type.
 *
 * Anchor rule:
 *   - Find the MOST RECENTLY LOGGED event of the requested type across all dayRecords.
 *   - If found → use its actual logged time in minutes.
 *   - Otherwise → use the central time from tifPredictions[eventType] (if available).
 *
 * Searching by requested type (not globally-latest event) ensures that earlier
 * same-day events (e.g. wake when last logged event is napEnd) are found as anchors.
 *
 * Falls back to null when neither is available.
 *
 * @param {string}   eventType       one of 'wake'|'napStart'|'napEnd'|'bedtime'
 * @param {object[]} dayRecords      all day records (pre-bucketed)
 * @param {object}   tifPredictions  map of already-computed TIF prediction objects
 * @returns {number|null}            anchor time in minutes, or null
 */
function resolveAnchor(eventType, dayRecords, tifPredictions) {
  // 1. Find the latest logged event OF THE REQUESTED TYPE across all day records.
  let latestAt   = null;
  let latestTime = null;

  for (const day of dayRecords) {
    // Prefer scanning the allEvents array (actual store data)
    if (Array.isArray(day.allEvents) && day.allEvents.length > 0) {
      for (const ev of day.allEvents) {
        if (ev.type === eventType && ev.at && (latestAt === null || ev.at > latestAt)) {
          latestAt   = ev.at;
          // ev.at format: 'YYYY-MM-DDTHH:MM' → slice(11) = 'HH:MM'
          latestTime = ev.at.slice(11);
        }
      }
    } else {
      // Synthetic/sparse day records: look up the named field for this type only.
      const slot = day[eventType];
      if (slot == null) continue;
      const atStr = (typeof slot === 'object' && slot.at) ? slot.at : null;
      if (atStr) {
        if (latestAt === null || atStr > latestAt) {
          latestAt   = atStr;
          latestTime = extractTime(slot);
        }
      } else {
        // Bare 'HH:MM' string — no cross-day ordering possible; last day wins.
        latestTime = extractTime(slot);
      }
    }
  }

  // 2. If we found a logged event of this type, return its actual time.
  if (latestTime !== null) {
    return timeToMinutes(latestTime);
  }

  // 3. Otherwise use the TIF central prediction for that event type (if computed).
  const pred = tifPredictions[eventType];
  if (pred && pred.central !== null) {
    return timeToMinutes(pred.central);
  }

  return null;
}

// ---------------------------------------------------------------------------
// nullPrediction — internal
// ---------------------------------------------------------------------------

/** Return a null-filled prediction object (used when no windows are computable). */
function nullPrediction() {
  return {
    central: null,
    min: null,
    max: null,
    precisionScore: null,
    isLowConfidence: false,
    algRange: null,
    algMin: null,
    algMax: null,
    sourceWindows: [],
  };
}

// ---------------------------------------------------------------------------
// buildPrediction — internal
// ---------------------------------------------------------------------------

/**
 * Given a list of labelled source windows, intersect them and apply precision
 * scoring to produce a complete TIF prediction object.
 *
 * `central` is computed as the average of medians across all active source windows
 * that carry a non-null `median` field (TIF-15 / D-12). When no window has a
 * median, it falls back to the midpoint of the display range (dispMin + dispRange/2).
 *
 * Each `sourceWindows` entry in the result includes:
 *   { label, min, max, median } where `median` is an 'HH:MM' string or null.
 *
 * @param {{ label: string, min: number, max: number, median?: number }[]} labelledWindows
 * @param {number} precisionTarget
 * @returns {object}  TIF prediction object
 */
function buildPrediction(labelledWindows, precisionTarget) {
  if (labelledWindows.length === 0) return nullPrediction();

  const { min: algMinRaw, max: algMaxRaw, isLowConfidence } =
    computeIntersection(labelledWindows);

  const { precisionScore, algRange, dispMin, dispMax } =
    applyPrecision(algMinRaw, algMaxRaw, precisionTarget);

  const windowsWithMedian = labelledWindows.filter(w => w.median != null);
  const centralMinutes = windowsWithMedian.length > 0
    ? windowsWithMedian.reduce((sum, w) => sum + w.median, 0) / windowsWithMedian.length
    : dispMin + (dispMax - dispMin) / 2;
  const central = minutesToTime(centralMinutes);

  return {
    central,
    min: minutesToTime(dispMin),
    max: minutesToTime(dispMax),
    precisionScore,
    isLowConfidence,
    algRange,
    algMin: minutesToTime(algMinRaw),
    algMax: minutesToTime(algMaxRaw),
    sourceWindows: labelledWindows.map(w => ({
      label:  w.label,
      min:    minutesToTime(w.min),
      max:    minutesToTime(w.max),
      median: w.median != null ? minutesToTime(w.median) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// tifForecast — main export
// ---------------------------------------------------------------------------

/**
 * Trimmed Intersection Forecast.
 *
 * Accepts the same pre-bucketed dayRecords that forecast() receives (from
 * daysBySubjectiveNight()) and a settings object with at least:
 *   { minDays, windowDays, trimPct, precisionTarget, tifRollingDays }
 *
 * Returns the same top-level shape as forecast():
 *   { isColdStart, wake, bedtime, napStart, napEnd }
 * with each prediction carrying extended TIF metadata (D10-05).
 *
 * @param {object[]} dayRecords    pre-bucketed day records
 * @param {object}   settings      settings object
 * @param {object}   [activityLog] optional map keyed by 'YYYY-MM-DD' date string;
 *                                 values are MA duration in minutes. When present,
 *                                 overrides activityBeforeNap(d) for that day (D-09, D-10).
 * @param {boolean}  [isNoNapDay]  caller-resolved flag: true when eveningHour has passed
 *                                 and today's napStart is null (D-15). Defaults to false.
 * @returns {object}
 */
export function tifForecast(dayRecords, settings, activityLog = {}, isNoNapDay = false) {
  // 1. Cold-start gate (TIF-11 / D3-06)
  const { isColdStart } = detectColdStart(dayRecords, settings.minDays);
  if (isColdStart) {
    return { isColdStart: true, wake: null, bedtime: null, napStart: null, napEnd: null };
  }

  // 2. Slice to tifRollingDays (TIF-13 / D-06: TIF uses its own rolling window, not windowDays)
  const tifRollingDays = settings.tifRollingDays ?? 7;
  const window = dayRecords.slice(-tifRollingDays);

  const trimPct         = settings.trimPct ?? 10;
  const precisionTarget = settings.precisionTarget ?? 60;

  // 3. Helper: count manually rejected days that have a non-null value for a given slot.
  function manualExcludedCount(slotFn) {
    return window.filter(d => d.rejected && slotFn(d) !== null).length;
  }

  // 4. Collect raw time-minutes for each event type from ALL days in the window.
  //    Rejected days are included (TIF trims them, not pre-filters them — B-021 Step 1).
  const wakeMinutes     = window.map(d => extractTime(d.wake))    .filter(Boolean).map(timeToMinutes);
  const napStartMinutes = window.map(d => extractTime(d.napStart)).filter(Boolean).map(timeToMinutes);
  const napEndMinutes   = window.map(d => extractTime(d.napEnd))  .filter(Boolean).map(timeToMinutes);
  const bedtimeMinutes  = window.map(d => extractTime(d.bedtime)) .filter(Boolean).map(timeToMinutes);

  // 5. Collect duration metrics for each day in the window.
  const sleepDurations    = window.map(sleepDuration)      .filter(v => v !== null);
  const napDurations      = window.map(napDuration)        .filter(v => v !== null);
  // actBeforeNapPerDay: index-aligned with window[]; activityLog[d.date] overrides
  // activityBeforeNap(d) when non-null (TIF-13 / D-09, D-10).
  const actBeforeNapPerDay = window.map(d =>
    activityLog[d.date] != null ? activityLog[d.date] : activityBeforeNap(d)
  );
  const actBeforeNap      = actBeforeNapPerDay.filter(v => v !== null);
  const actAfterNap       = window.map(activityAfterNap)   .filter(v => v !== null);
  const dayLengths        = window.map(dayLength)          .filter(v => v !== null);
  const combinedDurations = window.map(combinedSleepNap)   .filter(v => v !== null);

  // Manual excluded counts per slot
  const manualExWake     = manualExcludedCount(d => extractTime(d.wake));
  const manualExNapStart = manualExcludedCount(d => extractTime(d.napStart));
  const manualExNapEnd   = manualExcludedCount(d => extractTime(d.napEnd));
  const manualExBedtime  = manualExcludedCount(d => extractTime(d.bedtime));

  // -------------------------------------------------------------------------
  // Predictions are built in dependency order:
  //   napStart → napEnd → wake → bedtime
  //
  // napStart and napEnd are computed first so their predictions are available
  // for resolveTodayNapDuration(), which feeds the wake combined-band correction.
  // When wake hasn't been logged yet, wakeAnchor is null for the napStart
  // step and the activity-before-nap band is skipped (acceptable degradation).
  // -------------------------------------------------------------------------

  const tifPredictions = {};

  // ---- Nap-start prediction ----
  // wakeAnchor may be null if wake hasn't happened yet (tifPredictions is empty here).
  const wakeAnchorForNap = resolveAnchor('wake', dayRecords, tifPredictions);

  const napStartLabelledWindows = [];

  const histNapStart = buildHistoricBand(napStartMinutes, trimPct, manualExNapStart);
  if (histNapStart) napStartLabelledWindows.push({ label: 'Historic nap-start band', ...histNapStart });

  if (wakeAnchorForNap !== null) {
    const actBeforeBand = buildDurationBand(actBeforeNap, wakeAnchorForNap, trimPct, 0);
    if (actBeforeBand) napStartLabelledWindows.push({ label: 'Activity-before-nap band', ...actBeforeBand });
  }

  // MA/sleep ratio band: ratio_i = actBeforeNap_i / sleepDuration_i; projected = ratio_i * todaySleepDuration; anchored to wake
  const todaySleepDuration = sleepDuration(dayRecords[dayRecords.length - 1]);
  if (wakeAnchorForNap != null && todaySleepDuration != null && todaySleepDuration > 0) {
    const ratios = [];
    for (let i = 0; i < window.length; i++) {
      const abn = actBeforeNapPerDay[i];
      const sd = sleepDuration(window[i]);
      if (abn != null && sd != null && sd > 0) ratios.push(abn / sd);
    }
    const projectedDurations = ratios.map(r => r * todaySleepDuration);
    const ratioBandResult = buildDurationBand(projectedDurations, wakeAnchorForNap, trimPct, 0);
    if (ratioBandResult != null) napStartLabelledWindows.push({ label: 'MA/sleep ratio band', ...ratioBandResult });
  }

  const napStartPred = buildPrediction(napStartLabelledWindows, precisionTarget);
  tifPredictions.napStart = napStartPred;

  // ---- Nap-end prediction ----
  const napStartAnchor = resolveAnchor('napStart', dayRecords, tifPredictions);

  const napEndLabelledWindows = [];

  const histNapEnd = buildHistoricBand(napEndMinutes, trimPct, manualExNapEnd);
  if (histNapEnd) napEndLabelledWindows.push({ label: 'Historic nap-end band', ...histNapEnd });

  if (napStartAnchor !== null) {
    const napLenBand = buildDurationBand(napDurations, napStartAnchor, trimPct, 0);
    if (napLenBand) napEndLabelledWindows.push({ label: 'Nap-length band', ...napLenBand });
  }

  // MA/nap ratio band: ratio_i = actBeforeNap_i / napDuration_i; projected = ratio_i * todayMA; anchored to napStart
  const todayActualNapStart = extractTime(dayRecords[dayRecords.length - 1].napStart);
  const todayActualWake = extractTime(dayRecords[dayRecords.length - 1].wake);
  let todayMA = null;
  if (todayActualNapStart != null && todayActualWake != null) {
    todayMA = timeToMinutes(todayActualNapStart) - timeToMinutes(todayActualWake);
  } else if (napStartPred != null && napStartPred.central != null && wakeAnchorForNap != null) {
    todayMA = timeToMinutes(napStartPred.central) - wakeAnchorForNap;
  }
  if (napStartAnchor != null && todayMA != null) {
    const napRatios = [];
    for (let i = 0; i < window.length; i++) {
      const abn = actBeforeNapPerDay[i];
      const nd = napDuration(window[i]);
      if (abn != null && nd != null && nd > 0) napRatios.push(abn / nd);
    }
    const projectedNapDurations = napRatios.map(r => r * todayMA);
    const napRatioBandResult = buildDurationBand(projectedNapDurations, napStartAnchor, trimPct, 0);
    if (napRatioBandResult != null) napEndLabelledWindows.push({ label: 'MA/nap ratio band', ...napRatioBandResult });
  }

  const napEndPred = buildPrediction(napEndLabelledWindows, precisionTarget);
  tifPredictions.napEnd = napEndPred;

  // ---- Wake prediction ----
  const bedtimeAnchor    = resolveAnchor('bedtime', dayRecords, tifPredictions);
  const todayNapDuration = resolveTodayNapDuration(dayRecords, napStartPred, napEndPred);

  const wakeLabelledWindows = [];

  // Window 1: historic wake-up band
  const histWake = buildHistoricBand(wakeMinutes, trimPct, manualExWake);
  if (histWake) wakeLabelledWindows.push({ label: 'Historic wake-up band', ...histWake });

  // Window 2: sleep-length band (bedtime + sleep).
  // Raw result exceeds 1440 (crosses midnight) — wrap to same reference frame
  // as the historic wake band so computeIntersection works correctly.
  if (bedtimeAnchor !== null) {
    const sleepBandRaw = buildDurationBand(sleepDurations, bedtimeAnchor, trimPct, 0);
    if (sleepBandRaw) {
      wakeLabelledWindows.push({
        label:  'Sleep-length band',
        min:    wrapToDay(sleepBandRaw.min),
        max:    wrapToDay(sleepBandRaw.max),
        median: sleepBandRaw.median != null ? wrapToDay(sleepBandRaw.median) : null,
      });
    }
  }

  // Window 3: combined (sleep + nap) band, with today's nap subtracted so the
  // band represents the expected night-sleep duration anchored to bedtime.
  // Formula: bedtime + historical_combined − today_nap = expected_wake.
  // Uses actual nap when logged; predicted nap otherwise (resolveTodayNapDuration).
  if (bedtimeAnchor !== null && todayNapDuration !== null) {
    const combinedBandRaw = buildDurationBand(combinedDurations, bedtimeAnchor, trimPct, 0);
    if (combinedBandRaw) {
      wakeLabelledWindows.push({
        label:  'Sleep + nap combined band',
        min:    wrapToDay(combinedBandRaw.min - todayNapDuration),
        max:    wrapToDay(combinedBandRaw.max - todayNapDuration),
        median: combinedBandRaw.median != null ? wrapToDay(combinedBandRaw.median - todayNapDuration) : null,
      });
    }
  }

  const wakePred = buildPrediction(wakeLabelledWindows, precisionTarget);
  tifPredictions.wake = wakePred;

  // ---- Bedtime prediction ----
  const wakeAnchor2   = resolveAnchor('wake',   dayRecords, tifPredictions);
  const napEndAnchor  = resolveAnchor('napEnd', dayRecords, tifPredictions);

  const bedtimeLabelledWindows = [];

  const histBedtime = buildHistoricBand(bedtimeMinutes, trimPct, manualExBedtime);
  if (histBedtime) bedtimeLabelledWindows.push({ label: 'Historic bedtime band', ...histBedtime });

  if (wakeAnchor2 !== null) {
    const dayLenBand = buildDurationBand(dayLengths, wakeAnchor2, trimPct, 0);
    if (dayLenBand) bedtimeLabelledWindows.push({ label: 'Day-length band', ...dayLenBand });
  }

  if (napEndAnchor !== null) {
    const actAfterBand = buildDurationBand(actAfterNap, napEndAnchor, trimPct, 0);
    if (actAfterBand) bedtimeLabelledWindows.push({ label: 'Activity-after-nap band', ...actAfterBand });
  }

  const bedtimePred = buildPrediction(bedtimeLabelledWindows, precisionTarget);
  tifPredictions.bedtime = bedtimePred;

  return {
    isColdStart: false,
    wake:     wakePred,
    napStart: napStartPred,
    napEnd:   napEndPred,
    bedtime:  bedtimePred,
  };
}
