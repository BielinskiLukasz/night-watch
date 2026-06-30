// js/lib/chart-data.js
// Pure data-transform helpers for the Charts screen visualizations.
//
// Requirements: UI-04, D7-05, D7-06, D7-07, D7-08, D7-09, D7-10, D7-11
// Platform: PLAT-11 (pure module — zero DOM, zero I/O, zero browser storage)
//
// All five exported functions are pure transforms:
//   - No DOM access
//   - No browser storage access (adapters only, see js/adapters/storage-local.js)
//   - No side effects
//   - Fully unit-testable with node:test
//
// TDD: RED → GREEN → REFACTOR (Plan 07-03)

import { timeToMinutes } from './forecast.js';

// ---------------------------------------------------------------------------
// Config (Object.freeze per CLAUDE.md convention)
// ---------------------------------------------------------------------------

/** Frozen chart/heatmap display config. */
export const CHART_CONFIG = Object.freeze({
  HEATMAP_COLORS: Object.freeze({
    missing: '#e2e8f0',
    short: '#c7d2fe',
    target: '#4f46e5',
    long: '#3730a3',
  }),
  TARGET_SLEEP_MIN: 8,
  TARGET_SLEEP_MAX: 10,
});

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

/**
 * Extract minutes-since-midnight from a sleep event object.
 * Handles full ISO timestamps ('YYYY-MM-DDTHH:MM') and bare 'HH:MM' strings.
 *
 * @param {{ at: string }|null|undefined} event
 * @returns {number|null}
 */
function extractMinutes(event) {
  if (event == null) return null;
  const at = event.at;
  if (!at) return null;
  // Full ISO timestamp: 'YYYY-MM-DDTHH:MM' — slice last 5 chars for HH:MM
  const hhmm = at.length > 5 ? at.slice(-5) : at;
  return timeToMinutes(hhmm);
}

/**
 * Compute sleep duration in hours from a day record.
 * Uses cross-midnight arithmetic: (wakeMin - bedMin + 1440) % 1440 / 60.
 *
 * @param {{ wake: object|null, bedtime: object|null }} dayRecord
 * @returns {number|null} hours (may be 0 for same-time edge case), or null if either event missing
 */
function computeSleepHours(dayRecord) {
  if (!dayRecord.wake || !dayRecord.bedtime) return null;
  const wakeMin = extractMinutes(dayRecord.wake);
  const bedMin = extractMinutes(dayRecord.bedtime);
  if (wakeMin === null || bedMin === null) return null;
  return ((wakeMin - bedMin + 1440) % 1440) / 60;
}

/**
 * Advance a YYYY-MM-DD date string by one calendar day.
 * Uses local-time Date constructor and local-time getters to avoid UTC offset
 * issues (toISOString() would return UTC date which may differ from local date).
 * gsd:allow-ui-clock — calendar display arithmetic, not domain time storage.
 *
 * @param {string} dateStr  'YYYY-MM-DD'
 * @returns {string} next day as 'YYYY-MM-DD'
 */
function nextDayStr(dateStr) {
  // gsd:allow-ui-clock — calendar display arithmetic, not domain time storage.
  const d = new Date(dateStr + 'T00:00'); // gsd:allow-ui-clock
  d.setDate(d.getDate() + 1);
  // Use local-time getters, not toISOString() which would return UTC date
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Convert a YYYY-MM-DD date string to ISO day-of-week index.
 * ISO convention: Monday = 0, Sunday = 6.
 * gsd:allow-ui-clock — calendar display arithmetic, not domain time storage.
 *
 * @param {string} dateStr  'YYYY-MM-DD'
 * @returns {number} 0 (Monday) through 6 (Sunday)
 */
function getISODayOfWeek(dateStr) {
  // gsd:allow-ui-clock — calendar display arithmetic, not domain time storage.
  return (new Date(dateStr + 'T00:00').getDay() + 6) % 7; // gsd:allow-ui-clock
}

/**
 * Compute which week column a date falls in, relative to the first date.
 * Week 0 = the week containing firstDateStr, week 1 = the next week, etc.
 * Formula accounts for the Monday-start grid used by the heatmap (D7-06).
 * gsd:allow-ui-clock — calendar display arithmetic, not domain time storage.
 *
 * @param {string} dateStr       'YYYY-MM-DD'
 * @param {string} firstDateStr  'YYYY-MM-DD'  earliest date in the dataset
 * @returns {number} week index (0-based integer)
 */
function getWeekIndex(dateStr, firstDateStr) {
  // gsd:allow-ui-clock — calendar display arithmetic, not domain time storage.
  const firstDow = getISODayOfWeek(firstDateStr);
  const daysBetween =
    (new Date(dateStr + 'T00:00') - new Date(firstDateStr + 'T00:00')) / 86400000; // gsd:allow-ui-clock
  return Math.floor((daysBetween + firstDow) / 7);
}

// ---------------------------------------------------------------------------
// Exported transforms
// ---------------------------------------------------------------------------

/**
 * Build a sleep-length time series from day records.
 * Returns one entry per input day, preserving input order.
 *
 * @param {object[]} dayRecords  array of day records from daysBySubjectiveNight()
 * @returns {Array<{ date: string, sleepHours: number|null, rejected: boolean }>}
 */
export function buildSleepLengthSeries(dayRecords) {
  return dayRecords.map(d => ({
    date: d.date,
    sleepHours: computeSleepHours(d),
    rejected: !!d.rejected,
  }));
}

/**
 * Build heatmap data from day records, filling calendar gaps between the
 * first and last dates with null-sleepHours entries.
 *
 * Each cell has ISO day-of-week (Mon=0, Sun=6) and week index (0-based).
 *
 * @param {object[]} dayRecords
 * @returns {Array<{ date: string, sleepHours: number|null, dayOfWeek: number, weekIndex: number }>}
 */
export function buildHeatmapData(dayRecords) {
  if (dayRecords.length === 0) return [];

  // Sort by date ascending for gap detection
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const firstDate = sorted[0].date;
  const lastDate = sorted[sorted.length - 1].date;

  // Build lookup map for fast sleepHours access
  const byDate = new Map(sorted.map(d => [d.date, d]));

  const cells = [];
  let cur = firstDate;

  // Walk calendar day by day from first to last date (inclusive)
  while (cur <= lastDate) {
    cells.push({
      date: cur,
      sleepHours: byDate.has(cur) ? computeSleepHours(byDate.get(cur)) : null,
      dayOfWeek: getISODayOfWeek(cur),
      weekIndex: getWeekIndex(cur, firstDate),
    });
    cur = nextDayStr(cur);
  }

  return cells;
}

/**
 * Build a time-band series: wake and bedtime as minutes-since-midnight per day.
 * Null for missing events.
 *
 * @param {object[]} dayRecords
 * @returns {Array<{ date: string, wakeMinutes: number|null, bedtimeMinutes: number|null }>}
 */
export function buildTimeBandSeries(dayRecords) {
  return dayRecords.map(d => {
    // Collect every bedtime event for this subjective night. When allEvents is
    // present (real day records from day-bucket), use it to find all bedtimes —
    // a subjective night can have two (e.g. 22:00 and 00:10 next calendar day).
    // Fall back to d.bedtime for test fixtures that omit allEvents.
    const bedtimeEvents = d.allEvents
      ? d.allEvents.filter(ev => ev.type === 'bedtime')
      : (d.bedtime ? [d.bedtime] : []);
    const bedtimesMinutes = bedtimeEvents
      .map(ev => extractMinutes(ev))
      .filter(m => m !== null);

    return {
      date: d.date,
      wakeMinutes: d.wake ? extractMinutes(d.wake) : null,
      bedtimeMinutes: bedtimesMinutes[0] ?? null,  // kept for backward compat
      bedtimesMinutes,                              // full list for multi-dot rendering
    };
  });
}

/**
 * Compute nap statistics across all day records.
 *
 * @param {object[]} dayRecords
 * @returns {{ napDayPct: number, avgNapStartHHMM: string|null, avgNapLengthMin: number|null }}
 */
export function buildNapStats(dayRecords) {
  if (dayRecords.length === 0) {
    return { napDayPct: 0, avgNapStartHHMM: null, avgNapLengthMin: null };
  }

  const napDays = dayRecords.filter(d => d.napStart);
  const napDayPct = Math.round(napDays.length / dayRecords.length * 100);

  if (napDays.length === 0) {
    return { napDayPct: 0, avgNapStartHHMM: null, avgNapLengthMin: null };
  }

  // Average nap start time in minutes
  const startMins = napDays.map(d => extractMinutes(d.napStart)).filter(m => m !== null);
  const avgStartMin = startMins.reduce((sum, m) => sum + m, 0) / startMins.length;

  // Convert avgStartMin back to HH:MM string
  const avgNapStartHHMM =
    String(Math.floor(avgStartMin / 60)).padStart(2, '0') +
    ':' +
    String(Math.round(avgStartMin % 60)).padStart(2, '0');

  // Average nap length in minutes (only days with both napStart and napEnd)
  const napLengths = napDays
    .filter(d => d.napEnd)
    .map(d => {
      const startMin = extractMinutes(d.napStart);
      const endMin = extractMinutes(d.napEnd);
      if (startMin === null || endMin === null) return null;
      return ((endMin - startMin + 1440) % 1440);
    })
    .filter(len => len !== null);

  const avgNapLengthMin =
    napLengths.length > 0
      ? Math.round(napLengths.reduce((sum, l) => sum + l, 0) / napLengths.length)
      : null;

  return { napDayPct, avgNapStartHHMM, avgNapLengthMin };
}

/**
 * Build activity-vs-sleep correlation data points.
 * Only days present in activityLog AND with computable sleepHours are included.
 * Uses Object.entries() — no for..in prototype risk (T-07-03-01).
 *
 * @param {object[]} dayRecords
 * @param {{ [dateStr: string]: number }} activityLog  keyed by YYYY-MM-DD
 * @returns {Array<{ activityScore: number, sleepHours: number }>} sorted by activityScore ascending
 */
export function buildActivityCorrelation(dayRecords, activityLog) {
  const corr = [];

  for (const [date, score] of Object.entries(activityLog)) {
    // T-07-03-01: validate score is a number before pushing
    if (typeof score !== 'number') continue;
    const day = dayRecords.find(d => d.date === date);
    if (!day) continue;
    const sleepHours = computeSleepHours(day);
    if (sleepHours === null) continue;
    corr.push({ activityScore: score, sleepHours });
  }

  // Sort ascending by activityScore for consistent scatter plot rendering
  return corr.sort((a, b) => a.activityScore - b.activityScore);
}
