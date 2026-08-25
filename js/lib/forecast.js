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
// selectNextEvent(predictions, dayRecords) → { type, isMissed, ...prediction } | null
//   Cycle-aware priority selection of the most relevant upcoming event (D3-10).
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
 * @returns {{ isColdStart: boolean, validDayCount?: number, minDaysRemaining?: number, wake?, bedtime?, napStart?, napEnd? }}
 *   When isColdStart=true: no prediction fields present.
 *   When isColdStart=false: each event has either
 *     { central: string|null, min: string|null, max: string|null } (low uncertainty)
 *     or { probabilityBand: [{time, prob}, ...] } (high uncertainty, D3-04)
 */
export function forecast(dayRecords, settings) {
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

  return {
    isColdStart: false,
    wake:     forecastEvent(d => extractTime(d.wake)),
    bedtime:  forecastEvent(d => extractTime(d.bedtime)),
    napStart: forecastEvent(d => extractTime(d.napStart)),
    napEnd:   forecastEvent(d => extractTime(d.napEnd)),
  };
}

// ---------------------------------------------------------------------------
// Next-event selection with cycle-aware priority (D3-10)
// ---------------------------------------------------------------------------

/**
 * Select the single most relevant upcoming prediction using sleep-cycle awareness.
 *
 * Decision D3-10: Rather than picking the chronologically nearest prediction,
 * this function uses the most-recently-logged event to infer what naturally
 * comes next in the child's sleep rhythm:
 *
 *   Last event = bedtime    → wake > napStart > napEnd > bedtime
 *   Last event = wake       → napStart > bedtime > napEnd > wake
 *   Last event = napStart   → napEnd > bedtime > wake > napStart
 *   Last event = napEnd     → bedtime > wake > napStart > napEnd
 *
 * Within each priority tier the first available prediction is returned.
 * If a tier has no prediction (e.g., napStart was never recorded), the
 * function advances to the next tier.
 *
 * Cold-start / no events case: returns null. The UI should suppress the
 * next-event card when null is returned.
 *
 * @param {object} predictions  forecast() result keyed by event type
 *   Each key is one of: wake, bedtime, napStart, napEnd
 *   Each value is one of:
 *     { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' }  (normal prediction)
 *     { probabilityBand: [{time, prob}, ...] }             (high-uncertainty)
 *   Missing keys (event type never recorded) are allowed; that tier is skipped.
 *
 * @param {object[]} dayRecords  array of day records from daysBySubjectiveNight()
 *   Each record must have an allEvents array (list of { type, at } raw events).
 *   The most recent event across ALL day records determines the priority order.
 *
 * @returns {{ type: string, isMissed: boolean, ...prediction }|null}
 *   - type: the selected event type ('wake', 'bedtime', 'napStart', 'napEnd')
 *   - isMissed: true when the prediction's central time is in the past
 *     (relative to wall-clock midnight minutes — prep for UI D3-11)
 *   - All other fields from the prediction (central, min, max or probabilityBand)
 *   Returns null when no events have been logged or no predictions are available.
 */
export function selectNextEvent(predictions, dayRecords, settings = {}) {
  // ── Step 1: Find the most-recently-logged event across all day records ────
  // allEvents lists within each day record hold the raw events in insertion
  // order. We collect every event and pick the latest by at-string (ISO sort).
  let lastEvent = null;

  for (const day of dayRecords) {
    if (!day.allEvents || day.allEvents.length === 0) continue;
    for (const evt of day.allEvents) {
      if (lastEvent === null || evt.at > lastEvent.at) {
        lastEvent = evt;
      }
    }
  }

  // No events logged → cold start; UI suppresses the next-event card
  if (lastEvent === null) return null;

  // ── Inner helper: walk a priority list and return the first available prediction ─
  // Shared by both the PRED-08 early-return path and the switch-based path.
  function buildResult(preds, priorityList) {
    for (const eventType of priorityList) {
      const pred = preds[eventType];
      // Skip tiers with no prediction (event type never recorded in history)
      if (!pred) continue;

      // D3-11: Detect "missed" predictions.
      // A prediction is missed when its central time has passed today.
      // We compare using minutes-since-midnight only (no date arithmetic needed —
      // the prediction is always relative to "today's" schedule).
      // NOTE: this uses performance-time-safe approach — only for UI flagging,
      // not for sorting. The clock seam (D-07) is not threaded here because
      // selectNextEvent is pure logic; the UI layer may override this with a
      // real clock if needed.
      let isMissed = false;
      if (pred.central) {
        // Wall-clock "now" in minutes — safe since we only compare HH:MM
        // This is the only place in forecast.js that reads wall-clock time.
        // Phase 8 can inject a clock seam if stricter testability is needed.
        // gsd:allow-ui-clock — non-domain UI prefill: isMissed is display-only metadata (D3-11).
        const nowDate = new Date(); // gsd:allow-ui-clock
        const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
        const centralMinutes = timeToMinutes(pred.central);
        isMissed = centralMinutes < nowMinutes;
      }

      return {
        type: eventType,
        isMissed,
        ...pred,
      };
    }
    // All prediction tiers exhausted with no match
    return null;
  }

  // ── Step 2: PRED-08 (D-07) evening-hour override ─────────────────────────
  // When the current hour is at or past eveningHour AND the last logged event
  // was a wake, skip the nap-start priority and surface bedtime instead.
  // gsd:allow-ui-clock — display-only scheduling heuristic, not domain logic
  const nowHour = new Date().getHours(); // gsd:allow-ui-clock
  const eveningHour = (settings && typeof settings.eveningHour === 'number')
    ? settings.eveningHour
    : 18;
  if (lastEvent.type === 'wake' && nowHour >= eveningHour) {
    return buildResult(predictions, ['bedtime', 'napEnd', 'napStart', 'wake']);
  }

  // ── Step 3: Determine cycle-aware priority order (D3-10) ─────────────────
  // The priority array encodes "what naturally comes next in the sleep cycle"
  // based on the most recently logged event type.
  let priority;
  switch (lastEvent.type) {
    case 'bedtime':
      // After bedtime, the child will wake up → then nap → then back to bed
      priority = ['wake', 'napStart', 'napEnd', 'bedtime'];
      break;
    case 'wake':
      // After waking, the next event is a nap → then bedtime
      priority = ['napStart', 'bedtime', 'napEnd', 'wake'];
      break;
    case 'napStart':
      // After nap starts, the nap will end → then bedtime
      priority = ['napEnd', 'bedtime', 'wake', 'napStart'];
      break;
    case 'napEnd':
      // After nap ends, bedtime follows → then the next wake
      priority = ['bedtime', 'wake', 'napStart', 'napEnd'];
      break;
    default:
      // Unknown event type → fall back to natural wake-first order
      priority = ['wake', 'bedtime', 'napStart', 'napEnd'];
  }

  return buildResult(predictions, priority);
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
