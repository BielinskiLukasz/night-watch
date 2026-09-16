// js/lib/forecast.js
// Core forecast algorithm for Nightwatch — pure logic, no side effects.
//
// === Algorithm (governed by 03-CONTEXT.md decisions D3-01..D3-05) ===
//
// 1. Empirical CDF using 10th–90th percentiles (D3-01).
//    For a rolling window of past events (e.g., 7 days of wake times):
//    - P10 → minimum confidence band (lower bound)
//    - P50 → central prediction (median)
//    - P90 → maximum confidence band (upper bound)
//    No assumptions about distribution shape — robust to irregular child-sleep
//    patterns (bimodal during developmental transitions).
//
// 2. Linear interpolation percentile formula (D3-01, RESEARCH Code Example 1).
//    Matches Excel PERCENTILE / R type 7. Given sorted array and percentile p (0–1):
//    - pos = p × (n + 1)  [1-based position]
//    - k = floor(pos - 1)  [0-based index of lower neighbor]
//    - frac = pos - floor(pos)  [fractional distance]
//    - result = sorted[k] + frac × (sorted[k+1] - sorted[k])
//    Edge cases: k < 0 → clamp to sorted[0]; k ≥ n-1 → clamp to sorted[n-1]
//
// 3. Rejected days downweighted at 0.5× (D3-03, RESEARCH Code Example 2).
//    Each rejected-day event counts as 0.5 effective samples.
//    Effective count is used in the position calculation instead of raw array length.
//    This preserves rejected data for outlier inspection while reducing its influence.
//
// 4. Central prediction is the median (P50) (D3-05).
//    Phase 3 ships median only; Phase 7 will allow mean and custom blends.
//
// 5. Rolling window (D3-02).
//    forecast() slices dayRecords to the last windowDays before computing.
//    If fewer days exist, all available days are used (no padding).
//
// === Exported Functions ===
//
// percentile(sorted, p) → number | null
// percentileFromArray(values, pct) → number | null
// calculatePercentiles(dayRecords, getTimeFn, rejectWeight?) → { min, central, max } | null
// selectCentralTime(times) → number | null
// downweightRejectedDays(dayRecords, weight) → dayRecordWithWeight[]
// forecast(dayRecords, settings) → { wake, bedtime, napStart, napEnd }
//   each with { central, min, max } as 'HH:MM' strings (or null if no history)
// buildNapGapSeries(dayRecords) → number[]
//   Plain array of (napStart − wake) minutes for each day with both fields. PRED-20.
// buildNapDurationSeries(dayRecords) → number[]
//   Plain array of (napEnd − napStart) minutes for each day with both fields. PRED-22.
// buildBedtimeSeriesNapDay(dayRecords, settings) → { min, central, max } | null
//   P10/P50/P90 bedtime band for nap-day sub-population. PRED-18, D-02, D-04, D-08.
// buildBedtimeSeriesNoNapDay(dayRecords, settings) → { min, central, max } | null
//   P10/P50/P90 bedtime band for no-nap-day sub-population. PRED-18, D-02, D-04, D-08.
//
// === DST Safety ===
// All time arithmetic stays in 'HH:MM' strings → minutes-since-midnight integers.
// Never constructs a Date from event timestamps (Phase 1 D-16, RESEARCH Pitfall #6).

import { dayOfWeekAverages, sleepDebtProxy } from './metrics.js';

/** Frozen forecast config: percentile thresholds and downweight factor. Object.freeze per CLAUDE.md. */
const FORECAST_CONFIG = Object.freeze({
  P_LOW: 0.1,      // 10th percentile → min confidence band
  P_MID: 0.5,      // 50th percentile → central prediction (median)
  P_HIGH: 0.9,     // 90th percentile → max confidence band
  REJECT_WEIGHT: 0.5,  // D3-03: rejected days count as 0.5 effective samples
  ROUND_MINUTES: 5,    // Phase 1 LOG-07: 5-minute precision for all times
});

// ---------------------------------------------------------------------------
// Time conversion helpers (string ↔ numeric minutes-since-midnight)
// NEVER constructs a Date from these strings (RESEARCH Pitfall #6).
// ---------------------------------------------------------------------------

/**
 * Convert 'HH:MM' string to minutes since midnight.
 * e.g., '06:30' → 390, '21:45' → 1305
 *
 * @param {string} hhmm  'HH:MM' string
 * @returns {number} integer minutes since midnight
 */
export function timeToMinutes(hhmm) {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(3, 5), 10);
  return h * 60 + m;
}

/**
 * Convert minutes since midnight to 'HH:MM' string, rounded to 5-minute precision.
 * e.g., 390 → '06:30', 1305 → '21:45', 392 → '06:30' (rounds to 5-min)
 *
 * @param {number} minutes  numeric minutes since midnight
 * @returns {string} 'HH:MM' string
 */
export function minutesToTime(minutes) {
  // Round to 5-minute boundary (Phase 1 LOG-07)
  const rounded = Math.round(minutes / FORECAST_CONFIG.ROUND_MINUTES) * FORECAST_CONFIG.ROUND_MINUTES;
  // Handle midnight rollover: 1440 min = 24:00 wraps back to 00:00
  const clamped = rounded % (24 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Core percentile function
// ---------------------------------------------------------------------------

/**
 * Calculate a percentile from a sorted numeric array using linear interpolation.
 *
 * Formula (Excel PERCENTILE / R type 7 convention — RESEARCH §Pitfall #2):
 *   pos = p × (n + 1)           [1-based position in array]
 *   k   = floor(pos - 1)        [0-based lower-neighbor index]
 *   frac = pos - floor(pos)     [fractional distance to next element]
 *   result = sorted[k] + frac × (sorted[k+1] - sorted[k])
 *
 * Edge cases:
 *   - k < 0 → return sorted[0] (below minimum, clamp)
 *   - k ≥ n-1 → return sorted[n-1] (above maximum, clamp)
 *
 * @param {number[]} sorted  ascending-sorted numeric array
 * @param {number}   p       percentile 0..1 (e.g., 0.5 for P50)
 * @returns {number|null} numeric percentile value; null if sorted is empty
 */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];

  // 1-based position in array
  const pos = p * (sorted.length + 1);
  // Convert to 0-based lower-neighbor index
  const k = Math.floor(pos - 1);
  // Fractional distance between sorted[k] and sorted[k+1]
  const frac = pos - Math.floor(pos);

  // Clamp below minimum
  if (k < 0) return sorted[0];
  // Clamp above maximum
  if (k >= sorted.length - 1) return sorted[sorted.length - 1];

  // Linear interpolation
  return sorted[k] + frac * (sorted[k + 1] - sorted[k]);
}

// ---------------------------------------------------------------------------
// Phase 19: percentileFromArray — convenience wrapper for unsorted raw arrays
// ---------------------------------------------------------------------------

/**
 * Calculate a percentile from an unsorted numeric array.
 *
 * Sorts the input internally (does NOT mutate the caller's array) and delegates
 * to the existing percentile() function. The pct argument is 0–100 (integer),
 * unlike percentile() which expects 0–1.
 *
 * @param {number[]} values  raw (unsorted) numeric array
 * @param {number}   pct     percentile 0..100 (e.g. 50 for median)
 * @returns {number|null} interpolated percentile value; null if values is empty
 */
export function percentileFromArray(values, pct) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, pct / 100);
}

// ---------------------------------------------------------------------------
// Annotate days with effective weights
// ---------------------------------------------------------------------------

/**
 * Return a new array where each day record is annotated with its effective weight.
 * Does NOT mutate the input array.
 *
 * Non-rejected days: weight = 1.0
 * Rejected days: weight = rejectWeight (default 0.5 per D3-03)
 *
 * @param {object[]} dayRecords  array of day records (must have .rejected bool)
 * @param {number}   weight      effective weight for rejected days (default 0.5)
 * @returns {object[]} new array with .weight property added to each element
 */
export function downweightRejectedDays(dayRecords, weight = FORECAST_CONFIG.REJECT_WEIGHT) {
  return dayRecords.map(day => ({
    ...day,
    weight: day.rejected ? weight : 1.0,
  }));
}

// ---------------------------------------------------------------------------
// Percentile calculation with rejected-day downweighting
// ---------------------------------------------------------------------------

/**
 * Calculate P10, P50, P90 for a set of day records using rejected-day downweighting.
 *
 * The downweighting (D3-03, RESEARCH Code Example 2) adjusts the effective count
 * used in percentile position calculation — it does NOT create duplicate arrays.
 * Rejected days are sorted with the others, but the position formula uses
 * effectiveCount instead of array.length. This is mathematically cleaner
 * than duplicating/removing values.
 *
 * @param {object[]} dayRecords   array of day records
 * @param {Function} getTimeFn   function to extract 'HH:MM' time from a day record
 *                                (e.g., d => d.wake). Return null to skip that day.
 * @param {number}   rejectWeight effective weight for rejected days (default 0.5)
 * @returns {{ min: number, central: number, max: number }|null}
 *          numeric minutes (not HH:MM); null if no valid days exist
 */
export function calculatePercentiles(dayRecords, getTimeFn, rejectWeight = FORECAST_CONFIG.REJECT_WEIGHT) {
  // Filter to days that have a valid value for this event type
  const validDays = dayRecords.filter(d => getTimeFn(d) != null);
  if (validDays.length === 0) return null;

  // Convert times to numeric minutes-since-midnight (DST-safe: string slice only)
  const times = validDays.map(d => timeToMinutes(getTimeFn(d)));

  // Sort numerically to ensure correct percentile ordering (RESEARCH Pitfall #1)
  times.sort((a, b) => a - b);

  // Compute effective count: each rejected day counts as rejectWeight instead of 1 (D3-03)
  const effectiveCount = validDays.reduce(
    (sum, d) => sum + (d.rejected ? rejectWeight : 1.0),
    0
  );

  // Percentile calculation using effective count instead of raw array length.
  // Use a modified percentile function that accepts effectiveCount:
  function percentileEffective(p) {
    if (times.length === 0) return null;
    if (times.length === 1) return times[0];

    // Position based on effective count (not raw array length)
    const pos = p * (effectiveCount + 1);
    const k = Math.floor(pos - 1);
    const frac = pos - Math.floor(pos);

    if (k < 0) return times[0];
    if (k >= times.length - 1) return times[times.length - 1];

    return times[k] + frac * (times[k + 1] - times[k]);
  }

  return {
    min: percentileEffective(FORECAST_CONFIG.P_LOW),
    central: percentileEffective(FORECAST_CONFIG.P_MID),
    max: percentileEffective(FORECAST_CONFIG.P_HIGH),
  };
}

// ---------------------------------------------------------------------------
// Central time selection (P50 alias)
// ---------------------------------------------------------------------------

/**
 * Return the median (50th percentile) from a numeric times array.
 * Equivalent to percentile(times, 0.5) but semantically named for the forecast use case.
 *
 * @param {number[]} times  array of numeric minutes-since-midnight values (need not be sorted)
 * @returns {number|null} median value; null if empty
 */
export function selectCentralTime(times) {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

// ---------------------------------------------------------------------------
// Probability-band generation (D3-04)
// ---------------------------------------------------------------------------

/**
 * Generate a cumulative probability table when the confidence band is too wide.
 *
 * Decision D3-04: When the band width (P90 - P10) exceeds maxDelta, the prediction
 * card switches from "central ± band" to a probability table: P(event by T) = X%.
 *
 * Threshold logic: uses STRICT greater-than (>) — equal width means normal min/max UI.
 * Rationale: at exactly maxDelta, the central-time display is still usable; crossing
 * the threshold signals that uncertainty is actively misleading.
 *
 * @param {number[]} times    sorted (ascending) numeric times in minutes-since-midnight
 * @param {number}   p10      10th percentile value (numeric minutes)
 * @param {number}   p90      90th percentile value (numeric minutes)
 * @param {number}   maxDelta threshold in minutes; band width MUST EXCEED this to activate
 * @param {number}   [step=5] granularity of time points in minutes (default 5 per LOG-07)
 * @returns {Array<{time: string, prob: number}>|null}
 *   null if band width ≤ maxDelta (use normal min/max UI instead).
 *   Array of { time: 'HH:MM', prob: N } sorted by time if band width > maxDelta.
 *   prob is 0..100 (integer percentage of times ≤ T).
 */
export function generateProbabilityBand(times, p10, p90, maxDelta, step = 5) {
  // Guard: empty or degenerate input
  if (!times || times.length === 0) return null;

  const bandWidth = p90 - p10;

  // D3-04 threshold: strictly greater than maxDelta (not >=)
  // At exactly maxDelta, the central-time card is still meaningful.
  if (bandWidth <= maxDelta) return null;

  // Generate time points from p10 to p90 at 'step' minute intervals.
  // Round p10 down to nearest step boundary for clean alignment.
  const startMinutes = Math.floor(p10 / step) * step;
  const endMinutes = Math.ceil(p90 / step) * step;

  const table = [];
  for (let t = startMinutes; t <= endMinutes; t += step) {
    // Count how many times are ≤ t (cumulative distribution)
    const count = times.filter(x => x <= t).length;
    const prob = Math.round(100 * count / times.length);
    table.push({
      time: minutesToTime(t),
      prob,
    });
  }

  // T-03-05 mitigation: step is fixed at minimum 5 min, so even a 1000-min span
  // produces at most 200 time points — no unbounded loop risk.

  return table;
}

// ---------------------------------------------------------------------------
// Cold-start detection (D3-06)
// ---------------------------------------------------------------------------

/**
 * Determine whether the cold-start gate should suppress predictions.
 *
 * Decision D3-06: When the number of valid (non-rejected) days in history is
 * less than settings.minDays, predictions are suppressed and an explicit message
 * is shown. This prevents the algorithm from producing misleading forecasts from
 * insufficient data.
 *
 * @param {object[]} dayRecords  array of day records (each with .rejected boolean)
 * @param {number}   minDays     minimum valid-day count before predictions are shown
 * @returns {{ isColdStart: boolean, validDayCount: number, minDaysRemaining?: number }}
 *   - isColdStart: true when validDayCount < minDays
 *   - validDayCount: number of non-rejected days
 *   - minDaysRemaining: how many more valid days are needed (only when isColdStart=true)
 */
export function detectColdStart(dayRecords, minDays) {
  // Count non-rejected days: these are the "valid" data points for predictions
  const validDayCount = dayRecords.filter(day => !day.rejected).length;

  if (validDayCount < minDays) {
    return {
      isColdStart: true,
      validDayCount,
      minDaysRemaining: minDays - validDayCount,
    };
  }

  return {
    isColdStart: false,
    validDayCount,
  };
}

// ---------------------------------------------------------------------------
// PRED-09 (D-10): Duration-band helper for wake prediction
// ---------------------------------------------------------------------------

/**
 * Compute a wake duration-band from rolling night sleep durations + lastBedtime.
 *
 * Night sleep duration per day = wake - bedtime (minutes-since-midnight), normalized
 * for midnight crossover: if dur < 0 then dur += 24*60 (D-10).
 *
 * Returns {min, max} in minutes-since-midnight (normalized to [0, 1440)), or null
 * if no window days have both wake and bedtime, or if lastBedtimeHHMM is null.
 *
 * Values are normalized via % 1440 before return so they are directly comparable
 * with hour-band values (which are always in [0, 1440)) — without normalization,
 * lastBedtime + duration for overnight sleep exceeds 1440, causing incorrect
 * Math.min/max comparisons against the hour-band (backstop invariant D-11).
 *
 * @param {object[]} window           rolling window of day records (post-slice)
 * @param {string|null} lastBedtimeHHMM  'HH:MM' of the most recent bedtime, or null
 * @returns {{min: number, max: number}|null}
 */
function computeDurationBand(window, lastBedtimeHHMM) {
  if (!lastBedtimeHHMM) return null;
  const lastBedtimeMin = timeToMinutes(lastBedtimeHHMM);

  // Collect valid night sleep durations from window days that have both wake and bedtime
  const durations = [];
  for (const day of window) {
    const wakeStr = extractTime(day.wake);
    const bedStr = extractTime(day.bedtime);
    if (!wakeStr || !bedStr) continue;
    let dur = timeToMinutes(wakeStr) - timeToMinutes(bedStr);
    // T-12-04-01: normalize midnight crossover (e.g., wake=06:30, bedtime=22:00 → dur=-930+1440=510)
    if (dur < 0) dur += 24 * 60;
    durations.push(dur);
  }
  // T-12-04-02: empty durations → return null so caller falls back to hour-band
  if (durations.length === 0) return null;

  durations.sort((a, b) => a - b);
  const p10 = percentile(durations, FORECAST_CONFIG.P_LOW);
  const p90 = percentile(durations, FORECAST_CONFIG.P_HIGH);
  if (p10 === null || p90 === null) return null;

  // Normalize to [0, 1440) so values are directly comparable with hour-band minutes.
  // Without this, lastBedtime(22:00=1320) + duration(540) = 1860, which compares
  // as "larger" than hourBand.max(420) but minutesToTime(1860)='07:00' could be
  // earlier than hourBand.max='07:30' after wrapping — violating the backstop invariant.
  const DAY_MINUTES = 24 * 60;
  return {
    min: ((lastBedtimeMin + p10) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES,
    max: ((lastBedtimeMin + p90) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES,
  };
}

// ---------------------------------------------------------------------------
// PRED-10 / PRED-11: sub-window bedtime helper (D-03 / D-08)
// ---------------------------------------------------------------------------

/**
 * Compute a bedtime band from a filtered sub-window of day records.
 *
 * If the sub-window has >= minDays records with bedtime data, use their own
 * P10/P50/P90 percentiles (calculatePercentiles on sub-window).
 * If the sub-window has < minDays records, shift the full-window P50 bedtime
 * by -fallbackOffsetMinutes and apply the same offset to min/max.
 *
 * Returns { central, min, max } as numeric minute values (NOT HH:MM strings),
 * or null if the full window has no bedtime data at all (caller falls through
 * to the normal forecastEvent path).
 *
 * D-03 / D-08 pattern.
 *
 * @param {object[]} window                   rolling window of day records (post-slice)
 * @param {Function} filterFn                 predicate to select the sub-population (e.g. d => d.intense === true)
 * @param {number}   fallbackOffsetMinutes    minutes to subtract from full-window P50 when sub-window is thin
 * @param {object}   settings                 settings snapshot (needs .minDays)
 * @returns {{ central: number, min: number, max: number }|null}
 */
function subWindowBedtime(window, filterFn, fallbackOffsetMinutes, settings) {
  const { minDays } = settings;
  const subWin = window.filter(filterFn);

  if (subWin.length >= minDays) {
    // Enough history in the sub-window — use its own percentiles
    return calculatePercentiles(subWin, d => extractTime(d.bedtime));
  }

  // Thin history — shift full-window percentiles by fixed offset (D-03 fallback)
  const base = calculatePercentiles(window, d => extractTime(d.bedtime));
  if (base === null) return null;
  // WR-03 fix: normalize the shifted values back into [0, 1440) the same way
  // computeDurationBand() does above — without this, a late-clustering
  // bedtime (e.g. base.central within fallbackOffsetMinutes of midnight)
  // produces a negative minute value that minutesToTime() does not guard
  // against, emitting a malformed 'HH:MM' string (e.g. "-1:-20").
  const DAY_MINUTES = 24 * 60;
  const wrap = (m) => ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return {
    central: wrap(base.central - fallbackOffsetMinutes),
    min:     wrap(base.min    - fallbackOffsetMinutes),
    max:     wrap(base.max    - fallbackOffsetMinutes),
  };
}

// ---------------------------------------------------------------------------
// Phase 19: buildNapGapSeries — PRED-20
// ---------------------------------------------------------------------------

/**
 * Build an array of wake-to-nap-start gap values in minutes.
 *
 * For each day record that has both napStart and wake, computes:
 *   gap = timeToMinutes(napStart) - timeToMinutes(wake)
 * Applies midnight-crossover normalization: if gap < 0, adds 1440.
 *
 * Follows computeDurationBand() pattern (lines 354–366).
 *
 * @param {object[]} dayRecords  array of day records (real or synthetic HH:MM)
 * @returns {number[]} plain number array of gap minutes; empty array when no valid days
 */
export function buildNapGapSeries(dayRecords) {
  const gaps = [];
  for (const day of dayRecords) {
    const napStartStr = extractTime(day.napStart);
    const wakeStr = extractTime(day.wake);
    if (!napStartStr || !wakeStr) continue;
    let gap = timeToMinutes(napStartStr) - timeToMinutes(wakeStr);
    if (gap < 0) gap += 24 * 60;
    gaps.push(gap);
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// Phase 19: buildNapDurationSeries — PRED-22
// ---------------------------------------------------------------------------

/**
 * Build an array of nap duration values in minutes.
 *
 * For each day record that has both napEnd and napStart, computes:
 *   duration = timeToMinutes(napEnd) - timeToMinutes(napStart)
 * Applies midnight-crossover normalization: if duration < 0, adds 1440.
 *
 * Follows computeDurationBand() pattern (lines 354–366).
 *
 * @param {object[]} dayRecords  array of day records (real or synthetic HH:MM)
 * @returns {number[]} plain number array of duration minutes; empty array when no valid days
 */
export function buildNapDurationSeries(dayRecords) {
  const durations = [];
  for (const day of dayRecords) {
    const napEndStr = extractTime(day.napEnd);
    const napStartStr = extractTime(day.napStart);
    if (!napEndStr || !napStartStr) continue;
    let dur = timeToMinutes(napEndStr) - timeToMinutes(napStartStr);
    if (dur < 0) dur += 24 * 60;
    durations.push(dur);
  }
  return durations;
}

// ---------------------------------------------------------------------------
// Phase 19: buildBedtimeSeriesNapDay + buildBedtimeSeriesNoNapDay — PRED-18
// ---------------------------------------------------------------------------

/**
 * Compute a bedtime percentile band for nap-day records only.
 *
 * Filters dayRecords to days where napStart is not null (nap-day sub-window),
 * guards against cold-start (< minDays records), and delegates to
 * calculatePercentiles to return { min, central, max } as integer minutes.
 *
 * Pattern mirrors subWindowBedtime() but returns null on thin history
 * (no offset-shift fallback — caller falls back to overall calculatePercentiles).
 *
 * D-02: returns integer minutes; D-04: nap-day = napStart != null; D-08: minDays guard.
 *
 * @param {object[]} dayRecords  array of day records
 * @param {object}   settings   settings snapshot (needs .minDays)
 * @returns {{ min: number, central: number, max: number }|null}
 */
export function buildBedtimeSeriesNapDay(dayRecords, settings) {
  const { minDays } = settings;
  const subWin = dayRecords.filter(d => extractTime(d.napStart) != null);
  if (subWin.length < minDays) return null;
  return calculatePercentiles(subWin, d => extractTime(d.bedtime));
}

/**
 * Compute a bedtime percentile band for no-nap-day records only.
 *
 * Filters dayRecords to days where napStart is null (no-nap-day sub-window),
 * guards against cold-start (< minDays records), and delegates to
 * calculatePercentiles to return { min, central, max } as integer minutes.
 *
 * D-02: returns integer minutes; D-04: no-nap-day = napStart == null; D-08: minDays guard.
 *
 * @param {object[]} dayRecords  array of day records
 * @param {object}   settings   settings snapshot (needs .minDays)
 * @returns {{ min: number, central: number, max: number }|null}
 */
export function buildBedtimeSeriesNoNapDay(dayRecords, settings) {
  const { minDays } = settings;
  const subWin = dayRecords.filter(d => extractTime(d.napStart) == null);
  if (subWin.length < minDays) return null;
  return calculatePercentiles(subWin, d => extractTime(d.bedtime));
}

// ---------------------------------------------------------------------------
// Main forecast function
// ---------------------------------------------------------------------------

/**
 * Extract an 'HH:MM' string from a day-record slot value.
 *
 * Day records from daysBySubjectiveNight() store event slots as either:
 *   - null (event type not recorded that day)
 *   - an event object { id, type, at: 'YYYY-MM-DDTHH:MM' }
 *
 * Unit tests use synthetic day records where slots are either null or bare
 * 'HH:MM' strings (for convenience). This helper handles both forms so
 * forecast() works with real stores AND unit-test synthetic data.
 *
 * @param {null|string|{at:string}} slot  day-record slot value
 * @returns {string|null} 'HH:MM' or null
 */
function extractTime(slot) {
  if (slot == null) return null;
  // Event object from daysBySubjectiveNight(): extract HH:MM from at string.
  // at format: 'YYYY-MM-DDTHH:MM' → slice(11) gives 'HH:MM'
  if (typeof slot === 'object' && slot.at) return slot.at.slice(11);
  // Synthetic unit-test data: bare 'HH:MM' string
  if (typeof slot === 'string') return slot;
  return null;
}

/**
 * Forecast all four sleep event types from a rolling window of day records.
 *
 * Cold-start gate (D3-06): If the number of valid (non-rejected) days is below
 * settings.minDays, returns { isColdStart: true, validDayCount, minDaysRemaining }
 * with NO prediction fields. The caller (Today screen) should show the cold-start
 * message instead of prediction cards.
 *
 * When cold-start is not active, for each event type (wake, bedtime, napStart, napEnd):
 *   1. Filter to days that have data for that event type
 *   2. Calculate P10/P50/P90 with rejected-day downweighting (D3-03)
 *   3. Check probability-band fallback (D3-04):
 *      - If band width > maxDelta: add probabilityBand array to prediction
 *      - Otherwise: normal { central, min, max } shape
 *   4. Convert numeric minutes back to 'HH:MM' strings (5-minute precision)
 *   5. If no days have that event → { central: null, min: null, max: null }
 *
 * PRED-09 wake band (D-10, D-11, D-12):
 *   The wake prediction min/max is the outer union of two independent signals:
 *   - Hour-band: P10/P90 of historical wake hours (circadian rhythm signal)
 *   - Duration-band: most recent bedtime + P10/P90 of rolling night sleep durations
 *     (sleep-cycle length signal). Computed by computeDurationBand().
 *   Union: final_min = min(hourBand.min, durBand.min),
 *          final_max = max(hourBand.max, durBand.max).
 *   Central stays P50 of wake hours — unchanged by the duration-band (D-11).
 *   When lastBedtime is unavailable (null), falls back to the hour-band only.
 *   bedtime/napStart/napEnd are NOT affected by the duration-band (D-12).
 *
 * @param {object[]} dayRecords  array of day records from daysBySubjectiveNight()
 *   Each record is expected to have:
 *     - wake      {string|null}  'HH:MM' or null
 *     - bedtime   {string|null}  'HH:MM' or null
 *     - napStart  {string|null}  'HH:MM' or null
 *     - napEnd    {string|null}  'HH:MM' or null
 *     - rejected  {boolean}      true if day is flagged as outlier
 *     - intense   {boolean}      true if day is flagged as an intense-activity day (PRED-10)
 *
 * @param {object} settings  settings snapshot from settings.get()
 *   Expected fields: minDays, maxDelta, statBlend, windowDays,
 *   eveningHour, intenseDayOffsetMinutes
 *
 * @param {object} [context={}]  today's contextual state for bedtime and nap modifiers
 * @param {boolean} [context.isIntenseToday=false]      true when today is an intense day (PRED-10)
 * @param {boolean} [context.napStartLogged=false]      true when a nap-start was logged today (PRED-18)
 * @param {number}  [context.currentHour=0]             current local hour 0–23
 * @param {string|null} [context.todayWakeHHMM=null]    today's wake time 'HH:MM', or null (PRED-21)
 * @param {{score: number|null, signalsUsed: string[], confidence: string}|null} [context.napProbabilityScore=null]
 *   nap probability result object from napProbability() (PRED-19, D-05); `.score` is 0–100 or null (Phase 20 D-03/D-04)
 * @param {string|null} [context.todayNapStartHHMM=null] today's logged nap-start 'HH:MM', or null (PRED-22)
 *
 * @returns {{ isColdStart: boolean, validDayCount?: number, minDaysRemaining?: number, wake?, bedtime?, napStart?, napEnd?, bedtimeAfterWake? }}
 *   When isColdStart=true: no prediction fields present.
 *   When isColdStart=false: wake/bedtime/napStart/napEnd each have either
 *     { central: string|null, min: string|null, max: string|null } (low uncertainty)
 *     or { probabilityBand: [{time, prob}, ...] } (high uncertainty, D3-04).
 *   bedtimeAfterWake (Phase 21 D-09) is the raw, unblended
 *   buildBedtimeSeriesNoNapDay(window, settings) result in the same
 *   { central, min, max } | { probabilityBand } shape, or `null` when the
 *   no-nap-day sub-window is thin (< minDays) — independent of `bedtime`,
 *   which keeps its existing blended/split-routed meaning.
 */
export function forecast(dayRecords, settings, context = {}) {
  const { windowDays, minDays, maxDelta } = settings;

  // D3-06: Cold-start gate — check BEFORE slicing window so we count ALL available history
  const coldStart = detectColdStart(dayRecords, minDays);
  if (coldStart.isColdStart) {
    return {
      isColdStart: true,
      validDayCount: coldStart.validDayCount,
      minDaysRemaining: coldStart.minDaysRemaining,
    };
  }

  // Slice to rolling window (D3-02): last windowDays records
  // If fewer days exist, use all available (no padding/synthetic data)
  const window = windowDays != null && dayRecords.length > windowDays
    ? dayRecords.slice(dayRecords.length - windowDays)
    : dayRecords;

  // Helper: compute prediction for one event type, with probability-band fallback (D3-04)
  function forecastEvent(getTimeFn) {
    const result = calculatePercentiles(window, getTimeFn);
    if (result === null) {
      return { central: null, min: null, max: null };
    }

    // Extract the sorted numeric times from the window for this event type
    const validTimes = window
      .filter(d => getTimeFn(d) != null)
      .map(d => timeToMinutes(getTimeFn(d)))
      .sort((a, b) => a - b);

    // D3-04: Check if high-uncertainty fallback is needed
    const band = generateProbabilityBand(validTimes, result.min, result.max, maxDelta);
    if (band !== null) {
      // High uncertainty: return probability table instead of point + band
      return { probabilityBand: band };
    }

    // Normal case: point prediction with confidence band
    return {
      central: minutesToTime(result.central),
      min: minutesToTime(result.min),
      max: minutesToTime(result.max),
    };
  }

  // Destructure context for bedtime modifiers (PRED-10, PRED-18/19, PRED-21/22)
  const {
    isIntenseToday = false,
    napStartLogged = false,
    currentHour = 0,
    todayWakeHHMM = null,
    napProbabilityScore = null,
    todayNapStartHHMM = null,
  } = context;

  // PRED-09 (D-10): find the most recent bedtime in the window for duration-band
  let lastBedtimeHHMM = null;
  for (let i = window.length - 1; i >= 0; i--) {
    const b = extractTime(window[i].bedtime);
    if (b) { lastBedtimeHHMM = b; break; }
  }

  // PRED-09 (D-11): compute wake prediction as outer union of hour-band and duration-band.
  // The hour-band captures circadian rhythm; the duration-band captures sleep-cycle length.
  // Unioning them produces a conservative wider window that accommodates both signals.
  const wakePred = (() => {
    const wakeHourResult = calculatePercentiles(window, d => extractTime(d.wake));
    if (wakeHourResult === null) {
      return { central: null, min: null, max: null };
    }

    const durBand = computeDurationBand(window, lastBedtimeHHMM);
    // Union: final band is the outer envelope of both bands.
    // When durBand is null (no lastBedtime or no valid durations), use hour-band only (D-11 fallback).
    const finalMin = durBand
      ? Math.min(wakeHourResult.min, durBand.min)
      : wakeHourResult.min;
    const finalMax = durBand
      ? Math.max(wakeHourResult.max, durBand.max)
      : wakeHourResult.max;

    // D3-04: Check probability-band fallback on the final (possibly wider) band.
    const validWakeTimes = window
      .filter(d => extractTime(d.wake) != null)
      .map(d => timeToMinutes(extractTime(d.wake)))
      .sort((a, b) => a - b);
    const band = generateProbabilityBand(validWakeTimes, finalMin, finalMax, maxDelta);
    if (band !== null) {
      return { probabilityBand: band };
    }

    // D-11: central stays P50 of wake hours — the duration-band does not alter the central prediction.
    return {
      central: minutesToTime(wakeHourResult.central),
      min:     minutesToTime(finalMin),
      max:     minutesToTime(finalMax),
    };
  })();

  // Shared: full-window bedtime times for probability-band check (D3-04).
  // Lifted to this scope (Phase 21 D-09) so bedtimeAfterWake can reuse it below
  // via the also-lifted selectBedtime helper.
  const bedtimeTimes = window
    .filter(d => extractTime(d.bedtime) != null)
    .map(d => timeToMinutes(extractTime(d.bedtime)))
    .sort((a, b) => a - b);

  // Helper: apply band check and convert integer-minute result to HH:MM shape.
  // Lifted out of the bedtimePred IIFE (Phase 21 D-09) — it only closes over
  // bedtimeTimes/maxDelta, both derivable from window/settings at this scope —
  // so it can be reused by both bedtimePred and the independent bedtimeAfterWake field.
  function selectBedtime(result) {
    const band = generateProbabilityBand(bedtimeTimes, result.min, result.max, maxDelta);
    if (band) return { probabilityBand: band };
    return {
      central: minutesToTime(result.central),
      min:     minutesToTime(result.min),
      max:     minutesToTime(result.max),
    };
  }

  // PRED-18/19/10: compute contextual bedtime prediction.
  // D-12 routing order: (1) split-series selection, (2) PRED-10 intense-day shift stacks on top.
  const bedtimePred = (() => {
    // Step 1 — split-series selection (PRED-18/19, D-12)
    if (napStartLogged) {
      // Nap was logged today → use nap-day sub-window (PRED-18)
      const napDaySeries = buildBedtimeSeriesNapDay(window, settings);
      if (napDaySeries !== null) {
        return selectBedtime(napDaySeries);
      }
      // null (thin sub-window) → fall through to PRED-10 / overall
    } else if (napProbabilityScore !== null && napProbabilityScore.score !== null) {
      // Nap status undetermined → blend proportionally by score (PRED-19, D-05)
      const napDaySeries = buildBedtimeSeriesNapDay(window, settings);
      const noNapDaySeries = buildBedtimeSeriesNoNapDay(window, settings);
      if (napDaySeries !== null && noNapDaySeries !== null) {
        const ratio = napProbabilityScore.score / 100;
        const blended = {
          central: Math.round(ratio * napDaySeries.central + (1 - ratio) * noNapDaySeries.central),
          min:     Math.min(napDaySeries.min, noNapDaySeries.min),
          max:     Math.max(napDaySeries.max, noNapDaySeries.max),
        };
        return selectBedtime(blended);
      }
      // One or both sub-series null (D-08) → fall through to PRED-10 / overall
    }
    // napProbabilityScore absent/null, or napProbabilityScore.score === null (D-07/Phase 20 D-04) → fall through to PRED-10 / overall

    // Step 2 — PRED-10: intense-day shift stacks orthogonally on top of split model (D-11)
    if (isIntenseToday) {
      const intenseResult = subWindowBedtime(
        window,
        d => d.intense === true,
        settings.intenseDayOffsetMinutes ?? 30,
        settings,
      );
      if (intenseResult !== null) {
        return selectBedtime(intenseResult);
      }
    }

    // Normal bedtime — overall rolling-window percentiles (no contextual modifier)
    return forecastEvent(d => extractTime(d.bedtime));
  })();

  // D-09: predictions.bedtimeAfterWake — the raw, unblended no-nap-day bedtime
  // prediction, independent of bedtimePred's (possibly blended/routed) value.
  // Powers the dual-hero-card display while today's nap status is undetermined
  // (Plan 21-02). Genuinely null (not a partial/empty object) when the
  // no-nap-day sub-window is thin (< minDays) — matching
  // buildBedtimeSeriesNoNapDay's own null-on-thin-history contract.
  const bedtimeAfterWakeSeries = buildBedtimeSeriesNoNapDay(window, settings);
  const bedtimeAfterWakePred = bedtimeAfterWakeSeries !== null
    ? selectBedtime(bedtimeAfterWakeSeries)
    : null;

  // PRED-21: Wake-anchored nap-start prediction.
  // When todayWakeHHMM is known and there are ≥ minDays wake-to-nap gap samples,
  // anchor nap-start to today's wake time + P10/P50/P90 of historical gaps (D-14).
  // Otherwise fall back to time-of-day forecastEvent percentiles.
  const napGaps = buildNapGapSeries(window);
  let napStartPred;
  if (todayWakeHHMM !== null && napGaps.length >= settings.minDays) {
    const wakeMin = timeToMinutes(todayWakeHHMM);
    napStartPred = {
      central: minutesToTime(wakeMin + Math.round(percentileFromArray(napGaps, 50))),
      min:     minutesToTime(wakeMin + Math.round(percentileFromArray(napGaps, 10))),
      max:     minutesToTime(wakeMin + Math.round(percentileFromArray(napGaps, 90))),
    };
  } else {
    napStartPred = forecastEvent(d => extractTime(d.napStart));
  }

  // PRED-22: Nap-end prediction anchored to today's actual or predicted nap-start (D-15).
  // Anchor precedence: todayNapStartHHMM (logged) → napStartPred.central (predicted) → null.
  // When anchor is available and ≥ minDays duration samples exist, shift by P10/P50/P90 of durs.
  // Otherwise fall back to time-of-day forecastEvent percentiles.
  const napDurs = buildNapDurationSeries(window);
  const napStartAnchorHHMM = todayNapStartHHMM ?? napStartPred?.central ?? null;
  let napEndPred;
  if (napStartAnchorHHMM !== null && napDurs.length >= settings.minDays) {
    const anchorMin = timeToMinutes(napStartAnchorHHMM);
    napEndPred = {
      central: minutesToTime(anchorMin + Math.round(percentileFromArray(napDurs, 50))),
      min:     minutesToTime(anchorMin + Math.round(percentileFromArray(napDurs, 10))),
      max:     minutesToTime(anchorMin + Math.round(percentileFromArray(napDurs, 90))),
    };
  } else {
    napEndPred = forecastEvent(d => extractTime(d.napEnd));
  }

  return {
    isColdStart: false,
    wake:     wakePred,
    bedtime:  bedtimePred,
    napStart: napStartPred,
    napEnd:   napEndPred,
    bedtimeAfterWake: bedtimeAfterWakePred,
  };
}

// ---------------------------------------------------------------------------
// PRED-12: Nap probability score (Phase 20 redesign: NAP-01..04, D-01..D-10)
// ---------------------------------------------------------------------------

/**
 * Relative weights for the four nap-probability signals.
 * Must sum to 1.0 (within floating-point epsilon — 0.35+0.30+0.20+0.15
 * evaluates to 0.9999999999999999 in JS double precision, not exactly 1).
 * Object.freeze prevents accidental mutation.
 *
 * Signal 1 — napFrequency     (35%, NAP-01): fraction of history days with a nap
 * Signal 2 — dayOfWeekNapRate (30%, NAP-02): fraction of same-weekday history days with a nap
 * Signal 3 — sleepDebtSignal  (20%, NAP-03): normalized 7-day sleep-debt proxy
 * Signal 4 — noNapStreak      (15%, NAP-04): consecutive days without a nap (penalty)
 *
 * All four signals are clock-invariant — computable once at wake time and
 * stable for the rest of the day. `napWindowClosed` (Phase 21 D-01/D-02) is
 * the one sanctioned clock-based field on the return object; it never
 * collapses `score` and is NOT one of these four weighted signals.
 *
 * @type {Readonly<{napFrequency:number, dayOfWeekNapRate:number, sleepDebtSignal:number, noNapStreak:number}>}
 */
export const NAP_SCORE_WEIGHTS = Object.freeze({
  napFrequency:     0.35,
  dayOfWeekNapRate: 0.30,
  sleepDebtSignal:  0.20,
  noNapStreak:      0.15,
});

/**
 * Compute a nap-probability score for today.
 *
 * Always returns an object — never a bare `null`/`0`/number (D-03):
 *   { score: null, signalsUsed: [], confidence: 'none', napWindowClosed: false } — cold-start
 *   { score: 1-100, signalsUsed: [...], confidence: 'full'|'partial', napWindowClosed: bool } — real score
 *
 * `signalsUsed` lists which of the four `NAP_SCORE_WEIGHTS` keys contributed,
 * in fixed weight-table order. `confidence` is `'full'` when all four signals
 * were available, `'partial'` when weight redistribution occurred (D-01/D-02),
 * `'none'` only at the cold-start gate.
 *
 * `dayOfWeekNapRate` and `sleepDebtSignal` can independently be unavailable
 * (insufficient same-weekday history, or too few qualifying overnight pairs);
 * `napFrequency` and `noNapStreak` are always computable once the cold-start
 * gate passes. When either new signal is unavailable, its weight is
 * redistributed proportionally across the remaining available signals
 * (D-01/D-02) — the score is never null solely because a signal is missing.
 *
 * `napWindowClosed` (Phase 21 D-01/D-02/D-03) is a fully decoupled boolean:
 * `score` always reports the real weighted signal blend, even once the nap
 * window has closed for today. `napWindowClosed` is derived from the same
 * comparison the old hard-collapse-to-0 branch used (current time vs. the
 * P90 of historical napStart times) but no longer forces `score` to 0 — it
 * is the caller's sole signal for whether to keep showing a napStart card.
 *
 * @param {Array<object>} dayRecords
 *   Stage-filtered day records. Each record may have a `napStart` field
 *   ('HH:MM' string, an event object `{at: 'YYYY-MM-DDTHH:MM'}`, or null).
 * @param {{minDays: number, windowDays: number, maxDelta: number, targetSleepMinutes: number}} settings
 * @param {{currentHour?: number, currentMinute?: number, napStreak?: number, todayWeekday?: number|null}} context
 * @returns {{score: number|null, signalsUsed: string[], confidence: 'full'|'partial'|'none', napWindowClosed: boolean}}
 */
export function napProbability(dayRecords, settings, context) {
  // Cold-start gate: insufficient history
  if (!dayRecords || dayRecords.length < (settings.minDays || 1)) {
    return { score: null, signalsUsed: [], confidence: 'none', napWindowClosed: false };
  }

  const {
    currentHour   = 0,
    currentMinute = 0,
    napStreak     = 0,
    todayWeekday  = null,
  } = context || {};

  const nowMins = currentHour * 60 + currentMinute;

  // Helper: extract 'HH:MM' from a dayRecord.napStart field.
  // dayRecord fields in this module can be bare 'HH:MM' strings (test helpers) or null.
  const getSlotTime = slot => (slot == null ? null : (typeof slot === 'object' ? slot.at?.slice(11) : slot));

  // --- Signal: napFrequency (35%) — unchanged computation, new weight ---
  const napDaysCount = dayRecords.filter(d => getSlotTime(d.napStart) !== null).length;
  const napFrequencyValue = napDaysCount / dayRecords.length;

  // --- napStart percentiles — still needed for the window-closed check below ---
  // calculatePercentiles expects getTimeFn to return 'HH:MM' (not minutes); it calls
  // timeToMinutes internally. Its return shape is { min, central, max } in minutes.
  const napStartResult = calculatePercentiles(
    dayRecords,
    d => getSlotTime(d.napStart),  // returns 'HH:MM' string or null
  );

  // --- Signal: dayOfWeekNapRate (30%, NAP-02, D-05/D-06) ---
  let dayOfWeekNapRateAvailable = false;
  let dayOfWeekNapRateValue = 0;
  if (todayWeekday !== null) {
    const dowAverages = dayOfWeekAverages(dayRecords);
    const entry = dowAverages[todayWeekday];
    if (entry && entry.totalDays >= (settings.minDays || 1)) {
      dayOfWeekNapRateAvailable = true;
      dayOfWeekNapRateValue = entry.napDays / entry.totalDays;
    }
  }

  // --- Signal: sleepDebtSignal (20%, NAP-03, D-08/D-09) ---
  let sleepDebtSignalAvailable = false;
  let sleepDebtSignalValue = 0;
  const debtMinutes = sleepDebtProxy(dayRecords, 7, settings.targetSleepMinutes);
  if (debtMinutes !== null) {
    sleepDebtSignalAvailable = true;
    const clampedDebt = Math.max(-180, Math.min(180, debtMinutes));
    sleepDebtSignalValue = 0.5 + clampedDebt / 360;
  }

  // --- Signal: noNapStreak (15%) — unchanged computation, new weight ---
  const streak = typeof napStreak === 'number' ? napStreak : 0;
  const noNapStreakValue = Math.max(0, 1 - streak / 5);

  // --- Weight redistribution (D-01/D-02): build entries in NAP_SCORE_WEIGHTS order ---
  const signals = [
    { key: 'napFrequency',     weight: NAP_SCORE_WEIGHTS.napFrequency,     value: napFrequencyValue,     available: true },
    { key: 'dayOfWeekNapRate', weight: NAP_SCORE_WEIGHTS.dayOfWeekNapRate, value: dayOfWeekNapRateValue, available: dayOfWeekNapRateAvailable },
    { key: 'sleepDebtSignal',  weight: NAP_SCORE_WEIGHTS.sleepDebtSignal,  value: sleepDebtSignalValue,  available: sleepDebtSignalAvailable },
    { key: 'noNapStreak',      weight: NAP_SCORE_WEIGHTS.noNapStreak,      value: noNapStreakValue,      available: true },
  ];

  const availableSignals = signals.filter(s => s.available);
  const sumAvailableWeight = availableSignals.reduce((sum, s) => sum + s.weight, 0);
  const raw = availableSignals.reduce(
    (sum, s) => sum + (s.weight / sumAvailableWeight) * s.value,
    0,
  );
  const score = Math.round(raw * 100);
  const signalsUsed = availableSignals.map(s => s.key);
  const confidence = availableSignals.length === signals.length ? 'full' : 'partial';

  // --- napWindowClosed (Phase 21 D-01/D-02/D-03): decoupled from score ---
  // Reuses the exact comparison the old hard-collapse-to-0 branch used
  // (current time vs. P90 of historical napStart times), but score above
  // is already fully computed and is never overwritten by this flag.
  // Strict `>` (not `>=`): at exactly the P90 minute, the window is still open.
  const napWindowClosed = napStartResult !== null && napStartResult.max !== null && nowMins > napStartResult.max;

  return { score, signalsUsed, confidence, napWindowClosed };
}

// ---------------------------------------------------------------------------
// Phase 3+ placeholder: Auto-outlier detection (CFG-04 — currently inert)
// ---------------------------------------------------------------------------
//
// When Phase 3+ implements CFG-04 (autoOutlier: bool), the Median Absolute
// Deviation (MAD) method is recommended for small samples (RESEARCH §Automatic
// Outlier Detection):
//
//   mz = 0.6745 × (x - median) / MAD
//   where MAD = median(|x - median|)
//   Threshold: |mz| > 3.5 flags as outlier
//
// This is more robust than Z-score for the 7–365 day range we operate in.
// Add the implementation here when Phase 3+ is planned.
