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

/** Active time between wake and nap start. For complete no-nap days (both napStart and napEnd null), returns 0. */
export function activityBeforeNap(day) {
  const wakeStr  = extractTime(day.wake);
  const napStr   = extractTime(day.napStart);
  const napEndStr = extractTime(day.napEnd);
  if (wakeStr == null) return null;
  // Complete no-nap day: both napStart and napEnd are null → return 0
  if (napStr == null && napEndStr == null) return 0;
  // Otherwise use original logic: both napStart and napEnd must be present (or just napStart for synthetic tests)
  if (napStr == null) return null;
  const result = timeToMinutes(napStr) - timeToMinutes(wakeStr);
  return result < 0 ? result + 24 * 60 : result;
}

/** Active time between nap end and bedtime. For complete no-nap days (both napStart and napEnd null), returns 0. */
export function activityAfterNap(day) {
  const napStartStr = extractTime(day.napStart);
  const napEndStr = extractTime(day.napEnd);
  const bedStr    = extractTime(day.bedtime);
  if (bedStr == null) return null;
  // Complete no-nap day: both napStart and napEnd are null → return 0
  if (napStartStr == null && napEndStr == null) return 0;
  // Otherwise use original logic: both napStart and napEnd must be present (or just napEnd for synthetic tests)
  if (napEndStr == null) return null;
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
 * Total activity time: sum of time before nap and time after nap.
 * For no-nap days, returns 0 (both before and after are 0).
 * Returns null only if wake or bedtime are unavailable.
 * (D11-23)
 */
export function totalActivity(day) {
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
  aggregateMetric('totalActivity', napRows);
  aggregateMetric('activityBeforeNap', napRows);
  aggregateMetric('activityAfterNap', napRows);
  aggregateMetric('activityAfterSleepFactor', napRows);

  // SAA: exclude first row, include only rows with both sleep and prev activity
  const saaRows = validRows.filter((r, i) => i > 0 && r.sleepAfterActivityFactor !== null);
  aggregateMetric('sleepAfterActivityFactor', saaRows);

  return { rows, avg, min, max };
}
