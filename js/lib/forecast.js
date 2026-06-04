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
// calculatePercentiles(dayRecords, getTimeFn, rejectWeight?) → { min, central, max } | null
// selectCentralTime(times) → number | null
// downweightRejectedDays(dayRecords, weight) → dayRecordWithWeight[]
// forecast(dayRecords, settings) → { wake, bedtime, napStart, napEnd }
//   each with { central, min, max } as 'HH:MM' strings (or null if no history)
//
// === DST Safety ===
// All time arithmetic stays in 'HH:MM' strings → minutes-since-midnight integers.
// Never constructs a Date from event timestamps (Phase 1 D-16, RESEARCH Pitfall #6).

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
// Main forecast function
// ---------------------------------------------------------------------------

/**
 * Forecast all four sleep event types from a rolling window of day records.
 *
 * For each event type (wake, bedtime, napStart, napEnd):
 *   1. Filter to days that have data for that event type
 *   2. Calculate P10/P50/P90 with rejected-day downweighting (D3-03)
 *   3. Convert numeric minutes back to 'HH:MM' strings (5-minute precision)
 *   4. If no days have that event → { central: null, min: null, max: null }
 *      (allows upstream cold-start gating and partial-history handling, D3-06)
 *
 * @param {object[]} dayRecords  array of day records from daysBySubjectiveNight()
 *   Each record is expected to have:
 *     - wake      {string|null}  'HH:MM' or null
 *     - bedtime   {string|null}  'HH:MM' or null
 *     - napStart  {string|null}  'HH:MM' or null
 *     - napEnd    {string|null}  'HH:MM' or null
 *     - rejected  {boolean}      true if day is flagged as outlier
 *
 * @param {object} settings  settings snapshot from settings.get()
 *   Expected fields: minDays, maxDelta, statBlend, windowDays
 *
 * @returns {{ wake, bedtime, napStart, napEnd }}
 *   Each value: { central: string|null, min: string|null, max: string|null }
 *   All times are 'HH:MM' strings (or null if insufficient data for that event type).
 */
export function forecast(dayRecords, settings) {
  const { windowDays } = settings;

  // Slice to rolling window (D3-02): last windowDays records
  // If fewer days exist, use all available (no padding/synthetic data)
  const window = windowDays != null && dayRecords.length > windowDays
    ? dayRecords.slice(dayRecords.length - windowDays)
    : dayRecords;

  // Helper: compute { central, min, max } as HH:MM strings for one event type
  function forecastEvent(getTimeFn) {
    const result = calculatePercentiles(window, getTimeFn);
    if (result === null) {
      return { central: null, min: null, max: null };
    }
    return {
      central: minutesToTime(result.central),
      min: minutesToTime(result.min),
      max: minutesToTime(result.max),
    };
  }

  return {
    wake:     forecastEvent(d => d.wake),
    bedtime:  forecastEvent(d => d.bedtime),
    napStart: forecastEvent(d => d.napStart),
    napEnd:   forecastEvent(d => d.napEnd),
  };
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
