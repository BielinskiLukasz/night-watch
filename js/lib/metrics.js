// js/lib/metrics.js
// Duration helpers consumed by the TIF algorithm (Phase 10).
// Decisions D10-01 (scope: six duration helpers only) and D10-02 (named exports,
// not a single dayMetrics() object) govern this module's API shape.
// Phase 11 extends this file with ratio metrics — no structural changes required here.
//
// All helpers accept a pre-bucketed day record whose slots (.wake, .bedtime,
// .napStart, .napEnd) are either null, a bare 'HH:MM' string (unit-test synthetic
// data), or an event object { at: 'YYYY-MM-DDTHH:MM' } (real store data).
// Return value: number (minutes) or null when required slots are absent.
//
// Pure functions — no DOM, no browser-storage, no system-clock access.

import { timeToMinutes } from './forecast.js';

// ---------------------------------------------------------------------------
// Local copy of extractTime — identical to the private helper in forecast.js.
// Not imported from there to avoid any circular-import risk when forecast-tif.js
// imports both modules.
// ---------------------------------------------------------------------------

/** @param {null|string|{at:string}} slot @returns {string|null} 'HH:MM' or null */
function extractTime(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) return slot.at.slice(11);
  if (typeof slot === 'string') return slot;
  return null;
}

/** @param {null|string|{at:string}} slot @returns {string|null} 'YYYY-MM-DD' or null */
function extractDate(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) return slot.at.slice(0, 10);
  // Synthetic test data has no date
  return null;
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

/** Night sleep duration (bedtime→wake, crossing midnight). */
export function sleepDuration(day) {
  const wakeStr = extractTime(day.wake);
  const bedStr  = extractTime(day.bedtime);
  if (wakeStr == null || bedStr == null) return null;
  const result = timeToMinutes(wakeStr) - timeToMinutes(bedStr);
  return result < 0 ? result + 24 * 60 : result;
}

/** Nap duration (napStart→napEnd, always positive same-day). */
export function napDuration(day) {
  const startStr = extractTime(day.napStart);
  const endStr   = extractTime(day.napEnd);
  if (startStr == null || endStr == null) return null;
  return timeToMinutes(endStr) - timeToMinutes(startStr);
}

/** Active time between wake and nap start. Returns null when there is no nap. */
export function activityBeforeNap(day) {
  const wakeStr  = extractTime(day.wake);
  const napStr   = extractTime(day.napStart);
  if (wakeStr == null || napStr == null) return null;
  const result = timeToMinutes(napStr) - timeToMinutes(wakeStr);
  return result < 0 ? result + 24 * 60 : result;
}

/** Active time between nap end and bedtime. Returns null when there is no nap. */
export function activityAfterNap(day) {
  const napEndStr = extractTime(day.napEnd);
  const bedStr    = extractTime(day.bedtime);
  if (bedStr == null || napEndStr == null) return null;
  const result = timeToMinutes(bedStr) - timeToMinutes(napEndStr);
  return result < 0 ? result + 24 * 60 : result;
}

/** Total span from wake to bedtime (may cross midnight). */
export function dayLength(day) {
  const wakeStr = extractTime(day.wake);
  const bedStr  = extractTime(day.bedtime);
  if (wakeStr == null || bedStr == null) return null;
  const result = timeToMinutes(bedStr) - timeToMinutes(wakeStr);
  return result < 0 ? result + 24 * 60 : result;
}

/** Sum of night sleep and nap; if no nap, returns sleep duration only. Null if sleep is unavailable. */
export function combinedSleepNap(day) {
  const sleep = sleepDuration(day);
  const nap   = napDuration(day);
  if (sleep == null) return null;
  if (nap == null) return sleep; // No nap → return sleep duration only
  return sleep + nap;
}

// ---------------------------------------------------------------------------
// Phase 11: Ratio metrics and aggregation (D11-23..D11-26)
// ---------------------------------------------------------------------------

/**
 * Total activity time: wake-to-bedtime span minus nap time.
 * For nap days: activityBeforeNap + activityAfterNap.
 * For no-nap days: full dayLength (the subject was awake the entire day).
 * Returns null if wake or bedtime are unavailable.
 * (D11-23)
 */
export function totalActivity(day) {
  // No-nap day: total activity is the full wake-to-bedtime span.
  if (day.napStart == null && day.napEnd == null) return dayLength(day);
  const before = activityBeforeNap(day);
  const after  = activityAfterNap(day);
  if (before == null || after == null) return null;
  return before + after;
}

/**
 * Activity-after-sleep factor (AAS): totalActivity / combinedSleepNap.
 * Returns null if either component is null or if combinedSleepNap is 0 (avoid division by zero).
 * (D11-24)
 */
export function activityAfterSleepFactor(day) {
  const activity = totalActivity(day);
  const combined = combinedSleepNap(day);
  if (activity == null || combined == null || combined === 0) return null;
  return activity / combined;
}

/**
 * Sleep-after-activity factor (SAA): combinedSleepNap(day) / totalActivity(prevDay).
 * Returns null if prevDay is absent, if either component is null, or if prevDay.totalActivity is 0.
 * First day in an array always returns null (per D11-16).
 * (D11-25)
 */
export function sleepAfterActivityFactor(day, prevDay) {
  if (prevDay == null) return null;
  const sleep      = combinedSleepNap(day);
  const prevActivity = totalActivity(prevDay);
  if (sleep == null || prevActivity == null || prevActivity === 0) return null;
  return sleep / prevActivity;
}

/**
 * Day-to-sleep factor (D-12 / MET-07): dayLength(day) / sleepDuration(day).
 * Returns null when either component is null or sleepDuration is 0.
 * @param {object} day day record (with wake, bedtime slots)
 * @returns {number|null} ratio, or null when required slots are absent or denominator is 0
 */
export function dayToSleepFactor(day) {
  const dl = dayLength(day);
  const sd = sleepDuration(day);
  if (dl == null || sd == null || sd === 0) return null;
  return dl / sd;
}

/**
 * Nap fraction (D-12 / MET-09): napDuration(day) / combinedSleepNap(day).
 * Returns null on no-nap days (napStart or napEnd null) or when combinedSleepNap is null or 0.
 * @param {object} day day record (with wake, bedtime, napStart, napEnd slots)
 * @returns {number|null} ratio, or null when required slots are absent or denominator is 0
 */
export function napFraction(day) {
  const nd = napDuration(day);
  const cs = combinedSleepNap(day);
  if (nd == null || cs == null || cs === 0) return null;
  return nd / cs;
}

/**
 * MA/sleep ratio: activityBeforeNap(day) / sleepDuration(day).
 * Mirrors the per-day ratio used by the TIF MA/sleep ratio band.
 * Returns null on no-nap days or when either component is absent or sleepDuration is 0.
 * @param {object} day day record
 * @returns {number|null} ratio, or null when required slots are absent or denominator is 0
 */
export function maSleepRatio(day) {
  if (day.napStart == null && day.napEnd == null) return null;
  const abn = activityBeforeNap(day);
  const sd  = sleepDuration(day);
  if (abn == null || sd == null || sd === 0) return null;
  return abn / sd;
}

/**
 * MA/nap ratio: activityBeforeNap(day) / napDuration(day).
 * Mirrors the per-day ratio used by the TIF MA/nap ratio band.
 * Returns null on no-nap days or when either component is absent or napDuration is 0.
 * @param {object} day day record
 * @returns {number|null} ratio, or null when required slots are absent or denominator is 0
 */
export function maNapRatio(day) {
  if (day.napStart == null && day.napEnd == null) return null;
  const abn = activityBeforeNap(day);
  const nd  = napDuration(day);
  if (abn == null || nd == null || nd === 0) return null;
  return abn / nd;
}

/**
 * AM/PM split (D-12 / MET-10): activityBeforeNap(day) / activityAfterNap(day).
 * Returns null on no-nap days (both napStart and napEnd null) or when either activity
 * segment is absent or activityAfterNap is 0.
 * @param {object} day day record (with wake, bedtime, napStart, napEnd slots)
 * @returns {number|null} ratio, or null when required slots are absent or denominator is 0
 */
export function amPmSplit(day) {
  const before = activityBeforeNap(day);
  const after  = activityAfterNap(day);
  if (day.napStart == null && day.napEnd == null) return null;
  if (before == null || after == null || after === 0) return null;
  return before / after;
}

/**
 * Aggregate metrics across multiple day records.
 * Returns { rows, avg, min, max } where:
 *   - rows: array of per-day records with all metric values + raw times
 *   - avg: average values per metric (null if no valid data)
 *   - min: { value, date } for each metric (null if no valid data)
 *   - max: { value, date } for each metric (null if no valid data)
 *
 * Logic:
 *   - Excluded rejected days (day.rejected === true) from all calculations
 *   - Excluded no-nap days from nap-dependent aggregates (napDuration, totalActivity, etc.)
 *   - SAA computed by pairing each day with previous day (oldest to newest); first day null
 *   - Min/Max: return { value, date } where date is the wake time or bedtime as ISO string
 *   - Average durations: Math.round to nearest minute
 *   - Average ratios: compute normally
 *   - Sleep duration: today's wake paired with previous day's bedtime; null if no prevDay or slots absent
 * (D11-26)
 */
export function aggregateMetrics(dayRecords) {
  // Build per-day rows with all metrics
  const rows = [];

  // Helper: calculate sleep duration for overnight events (bedtime prev day, wake next day)
  function calculateOvernightSleep(bedtimeStr, nextDayWakeStr) {
    if (!bedtimeStr || !nextDayWakeStr) return null;
    const bedtimeMinutes = timeToMinutes(bedtimeStr);
    const wakeMinutes = timeToMinutes(nextDayWakeStr);
    // Wake is on the next day, so account for midnight crossing
    const result = wakeMinutes - bedtimeMinutes;
    return result < 0 ? result + 24 * 60 : result;
  }

  // Helper: add one day to a YYYY-MM-DD string using string manipulation (timezone-safe)
  function addOneDay(ymd) {
    const [year, month, day] = ymd.split('-').map(Number);
    // Use UTC date arithmetic to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  for (let i = 0; i < dayRecords.length; i++) {
    const day = dayRecords[i];
    const prevDay = i > 0 ? dayRecords[i - 1] : null;
    const nextDay = i < dayRecords.length - 1 ? dayRecords[i + 1] : null;

    // Date attribution and sleep duration
    let dateStr = null;
    let sleepDur = null;

    // Sleep duration always pairs today's wake with the previous day's bedtime.
    if (day.wake && prevDay && prevDay.bedtime) {
      const bedtimeStr = extractTime(prevDay.bedtime);
      const wakeStr = extractTime(day.wake);
      sleepDur = calculateOvernightSleep(bedtimeStr, wakeStr);
    }

    // Fallback: if we have a wake date, use it
    if (!dateStr && day.wake) {
      dateStr = extractDate(day.wake);
    }

    // Fallback: if only bedtime exists, attribute to bedtime+1 day
    if (!dateStr && day.bedtime) {
      const bedtimeDate = extractDate(day.bedtime);
      if (bedtimeDate) {
        dateStr = addOneDay(bedtimeDate);
      }
    }

    const napDur = napDuration(day);
    rows.push({
      // Date and index tracking for CR-01/CR-02 fixes
      date: dateStr || null,
      _dayRecordsIdx: i,
      // Raw times: store full ISO strings for formatTime, not extractTime results
      wake: (day.wake && day.wake.at) ? day.wake.at : (typeof day.wake === 'string' ? day.wake : null),
      bedtime: (day.bedtime && day.bedtime.at) ? day.bedtime.at : (typeof day.bedtime === 'string' ? day.bedtime : null),
      napStart: (day.napStart && day.napStart.at) ? day.napStart.at : (typeof day.napStart === 'string' ? day.napStart : null),
      napEnd: (day.napEnd && day.napEnd.at) ? day.napEnd.at : (typeof day.napEnd === 'string' ? day.napEnd : null),
      // Durations (with overnight sleep handling)
      sleepDuration: sleepDur,
      napDuration: napDur,
      dayLength: dayLength(day),
      combinedSleepNap: sleepDur !== null ? (napDur !== null ? sleepDur + napDur : sleepDur) : null,
      totalActivity: totalActivity(day),
      activityBeforeNap: activityBeforeNap(day),
      activityAfterNap: activityAfterNap(day),
      // Ratios
      activityAfterSleepFactor: activityAfterSleepFactor(day),
      sleepAfterActivityFactor: sleepAfterActivityFactor(day, prevDay),
      // D-12 new ratio fields
      dayToSleepFactor: dayToSleepFactor(day),
      napFraction: napFraction(day),
      amPmSplit: amPmSplit(day),
      maSleepRatio: maSleepRatio(day),
      maNapRatio: maNapRatio(day),
      // Metadata
      rejected: day.rejected || false,
    });
  }

  // Compute aggregates (excluding rejected days)
  const validRows = rows.filter(r => !r.rejected);
  const napRows = validRows.filter(r => r.napDuration !== null);

  const avg = {};
  const min = {};
  const max = {};

  // Helper: compute average, min, max for a metric
  function aggregateMetric(key, rows, { includeDateField = false } = {}) {
    const values = rows
      .map(r => r[key])
      .filter(v => v !== null && v !== undefined);

    if (values.length === 0) {
      avg[key] = null;
      min[key] = null;
      max[key] = null;
      return;
    }

    // Average
    if (key === 'sleepDuration' || key === 'napDuration' || key === 'dayLength' ||
        key === 'combinedSleepNap' || key === 'totalActivity') {
      // Durations: round to nearest minute
      avg[key] = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
    } else {
      // Ratios
      avg[key] = values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    // Min and Max with date
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const minRowIdx = rows.findIndex(r => r[key] === minValue);
    const maxRowIdx = rows.findIndex(r => r[key] === maxValue);

    // Extract date using the stored index
    const getDate = (rowIdx) => {
      const row = rows[rowIdx];
      if (!row || row._dayRecordsIdx === undefined) return null;
      const origDay = dayRecords[row._dayRecordsIdx];
      if (!origDay) return null;
      return row.date; // Use the date already extracted and stored in the row
    };

    min[key] = minRowIdx >= 0 ? { value: minValue, date: getDate(minRowIdx) } : null;
    max[key] = maxRowIdx >= 0 ? { value: maxValue, date: getDate(maxRowIdx) } : null;
  }

  // Aggregate all metrics
  aggregateMetric('sleepDuration', validRows);
  aggregateMetric('napDuration', napRows);
  aggregateMetric('dayLength', validRows);
  aggregateMetric('combinedSleepNap', validRows);
  aggregateMetric('totalActivity', validRows);
  aggregateMetric('activityBeforeNap', napRows);
  aggregateMetric('activityAfterNap', napRows);
  aggregateMetric('activityAfterSleepFactor', validRows);
  aggregateMetric('dayToSleepFactor', validRows);
  aggregateMetric('napFraction', napRows);
  aggregateMetric('amPmSplit', napRows);
  aggregateMetric('maSleepRatio', napRows);
  aggregateMetric('maNapRatio', napRows);

  return { rows, avg, min, max };
}

// ---------------------------------------------------------------------------
// Day-of-week averages (MET-11, D-04..D-07)
// ---------------------------------------------------------------------------

/** Abbreviated day labels; index matches getDay() (0=Sun..6=Sat). */
const DAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

/**
 * Group pre-filtered day records by weekday and compute per-weekday averages.
 *
 * Caller is responsible for pre-filtering (stage filter + rejected exclusion)
 * before passing dayRecords in — consistent with aggregateMetrics() (D-07).
 *
 * Weekday attribution uses the wake date (D-06), via extractDate(day.wake).
 * Records where extractDate returns null (e.g., bare 'HH:MM' synthetic data)
 * are silently skipped.
 *
 * Nap-related metrics (activityBeforeNap, activityAfterNap, napDuration)
 * exclude no-nap days (day.napStart === null per D-02).
 *
 * Sleep duration pairs today's wake with prevDay.bedtime — identical to the
 * overnight-pairing logic inside aggregateMetrics() (D-06).
 *
 * Returns a fixed 7-entry array (index 0=Sun..6=Sat) where each entry holds
 * averaged metrics (numbers) or null when no data exists for that weekday.
 * Duration averages use Math.round (consistent with aggregateMetrics).
 * Ratio averages are returned as-is (no rounding).
 *
 * D-05: computes all Metrics columns, not just the 4 required by MET-11.
 *
 * @param {object[]} dayRecords  pre-filtered (stage + rejected) day records
 * @returns {Array<{weekday: number, label: string, activityBeforeNap: number|null, activityAfterNap: number|null, napDuration: number|null, sleepDuration: number|null, dayLength: number|null, totalActivity: number|null, combinedSleepNap: number|null, dayToSleepFactor: number|null, napFraction: number|null, amPmSplit: number|null, maSleepRatio: number|null, maNapRatio: number|null}>}
 */
export function dayOfWeekAverages(dayRecords) {
  // Per-weekday accumulators: { sum, count } for each metric field.
  // nap-related accumulators only count days where napStart is present.
  const buckets = Array.from({ length: 7 }, () => ({
    // duration metrics (Math.round on output)
    activityBeforeNap: { sum: 0, count: 0 },
    activityAfterNap:  { sum: 0, count: 0 },
    napDuration:       { sum: 0, count: 0 },
    sleepDuration:     { sum: 0, count: 0 },
    dayLength:         { sum: 0, count: 0 },
    totalActivity:     { sum: 0, count: 0 },
    combinedSleepNap:  { sum: 0, count: 0 },
    // ratio metrics (no rounding on output)
    dayToSleepFactor:  { sum: 0, count: 0 },
    napFraction:       { sum: 0, count: 0 },
    amPmSplit:         { sum: 0, count: 0 },
    maSleepRatio:      { sum: 0, count: 0 },
    maNapRatio:        { sum: 0, count: 0 },
  }));

  // Inline sleep helper: bedtime-prev → wake, same overnight-pairing as aggregateMetrics.
  function calcSleep(bedStr, wakeStr) {
    if (!bedStr || !wakeStr) return null;
    const result = timeToMinutes(wakeStr) - timeToMinutes(bedStr);
    return result < 0 ? result + 24 * 60 : result;
  }

  // Accumulate helper: add a value to a bucket slot when non-null.
  function acc(slot, value) {
    if (value !== null && value !== undefined) {
      slot.sum   += value;
      slot.count += 1;
    }
  }

  for (let i = 0; i < dayRecords.length; i++) {
    const day     = dayRecords[i];
    const prevDay = i > 0 ? dayRecords[i - 1] : null;

    // Weekday attribution via wake date (D-06).
    const dateStr = extractDate(day.wake);
    if (dateStr === null) continue;  // synthetic bare-string data — skip (D-07 note)

    const weekday = new Date(dateStr + 'T00:00').getDay();  // 0=Sun..6=Sat; local time, never UTC
    const b = buckets[weekday];

    const isNapDay = day.napStart != null;  // D-02: no-nap = napStart absent

    // Overnight sleep duration paired with prevDay.bedtime (D-06).
    const prevBedStr = prevDay ? extractTime(prevDay.bedtime) : null;
    const wakeStr    = extractTime(day.wake);
    acc(b.sleepDuration, calcSleep(prevBedStr, wakeStr));

    // Duration metrics available on all days.
    acc(b.dayLength,        dayLength(day));
    acc(b.totalActivity,    totalActivity(day));
    acc(b.combinedSleepNap, combinedSleepNap(day));
    acc(b.dayToSleepFactor, dayToSleepFactor(day));

    // Nap-related metrics: only accumulate on nap days (D-01, D-02, D-03).
    if (isNapDay) {
      acc(b.activityBeforeNap, activityBeforeNap(day));
      acc(b.activityAfterNap,  activityAfterNap(day));
      acc(b.napDuration,       napDuration(day));
      acc(b.napFraction,       napFraction(day));
      acc(b.amPmSplit,         amPmSplit(day));
      acc(b.maSleepRatio,      maSleepRatio(day));
      acc(b.maNapRatio,        maNapRatio(day));
    }
  }

  // Duration field names (Math.round on average).
  const durationFields = new Set([
    'activityBeforeNap', 'activityAfterNap', 'napDuration', 'sleepDuration',
    'dayLength', 'totalActivity', 'combinedSleepNap',
  ]);

  // Produce the 7-entry result array.
  return Array.from({ length: 7 }, (_, i) => {
    const b = buckets[i];
    const avg = (slot, isDuration) =>
      slot.count === 0
        ? null
        : isDuration
          ? Math.round(slot.sum / slot.count)
          : slot.sum / slot.count;

    return {
      weekday:           i,
      label:             DAY_LABELS[i],
      activityBeforeNap: avg(b.activityBeforeNap, true),
      activityAfterNap:  avg(b.activityAfterNap,  true),
      napDuration:       avg(b.napDuration,        true),
      sleepDuration:     avg(b.sleepDuration,      true),
      dayLength:         avg(b.dayLength,          true),
      totalActivity:     avg(b.totalActivity,      true),
      combinedSleepNap:  avg(b.combinedSleepNap,   true),
      dayToSleepFactor:  avg(b.dayToSleepFactor,   false),
      napFraction:       avg(b.napFraction,         false),
      amPmSplit:         avg(b.amPmSplit,           false),
      maSleepRatio:      avg(b.maSleepRatio,        false),
      maNapRatio:        avg(b.maNapRatio,          false),
    };
  });
}

// ---------------------------------------------------------------------------
// Sleep debt proxy (MET-13, MET-14)
// ---------------------------------------------------------------------------

/**
 * Rolling sleep-debt proxy over the last windowDays qualifying records.
 *
 * Caller is responsible for pre-filtering (stage filter + rejected exclusion)
 * before passing dayRecords in — consistent with aggregateMetrics() and
 * dayOfWeekAverages() (D-08).
 *
 * Days where combinedSleepNap is null (missing wake or bedtime data) are
 * excluded and do not count toward windowDays (D-05).
 *
 * Sign convention: positive = deficit (actual sleep < target).
 * Negative values are preserved — surplus sleep reduces the rolling sum.
 * No clamping at zero (D-06).
 *
 * Returns null when fewer than windowDays non-null qualifying records are
 * available — cold-start guard (D-07).
 *
 * Inputs are integer minutes; the result is an integer with no rounding
 * needed (D-08 / MET-14 precision).
 *
 * @param {object[]} dayRecords         pre-filtered (stage + rejected) day records, oldest-first
 * @param {number}   windowDays         rolling window size (MET-14: fixed 7)
 * @param {number}   targetSleepMinutes per-day sleep target in minutes (from settings, D-01)
 * @returns {number|null} signed sum of (targetSleepMinutes − combinedSleepNap) over the
 *                        last windowDays qualifying records, or null if insufficient data
 */
export function sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes) {
  // Collect qualifying records: only days where combinedSleepNap is non-null.
  // Take the last windowDays entries (rolling slice — D-05, D-07).
  const validDays = dayRecords
    .filter(day => combinedSleepNap(day) !== null)
    .slice(-windowDays);

  // Cold-start guard: not enough qualifying records yet (D-07).
  if (validDays.length < windowDays) return null;

  // Sum of (target − actual) across the window. Positive = deficit, negative = surplus (D-06).
  return validDays.reduce((sum, day) => sum + (targetSleepMinutes - combinedSleepNap(day)), 0);
}
