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
import { sleepDuration, napDuration } from './metrics.js';

// ---------------------------------------------------------------------------
// Config (Object.freeze per CLAUDE.md convention)
// ---------------------------------------------------------------------------

/** Frozen chart/heatmap display config. */
export const CHART_CONFIG = Object.freeze({
  HEATMAP_COLORS: Object.freeze({
    missing:   '#e2e8f0', // no data
    veryShort: '#fecaca', // < 7h
    short:     '#fde68a', // 7–8h
    target:    '#4ade80', // 8–10h  (target range)
    long:      '#22c55e', // 10–12h
    veryLong:  '#166534', // > 12h
  }),
  // Bucket boundaries in hours (upper-exclusive except the last)
  SLEEP_VERY_SHORT: 7,
  SLEEP_SHORT:      8,
  SLEEP_LONG:       10,
  SLEEP_VERY_LONG:  12,
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
    sleepHours: sleepDuration(d) != null ? sleepDuration(d) / 60 : null,
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
    const dayData = byDate.get(cur);
    const dur = dayData ? sleepDuration(dayData) : null;
    cells.push({
      date: cur,
      sleepHours: dur != null ? dur / 60 : null,
      dayOfWeek: getISODayOfWeek(cur),
      weekIndex: getWeekIndex(cur, firstDate),
    });
    cur = nextDayStr(cur);
  }

  return cells;
}

/**
 * Build a time-band series: wake and bedtime as minutes-since-midnight per day.
 *
 * Groups events by CALENDAR DATE (ev.at.slice(0,10)) rather than subjective
 * night, so events logged on the same clock date land on the same chart column.
 * Example: bedtime@00:10 and bedtime@22:00 both recorded on June 17 appear
 * as two dots on the June 17 column.
 *
 * @param {object[]} dayRecords  from daysBySubjectiveNight(); needs allEvents
 * @returns {Array<{ date: string, wakeMinutes: number|null, bedtimeMinutes: number|null, bedtimesMinutes: number[] }>}
 */
export function buildTimeBandSeries(dayRecords) {
  const byDate = new Map();

  for (const d of dayRecords) {
    // Prefer allEvents (typed, from real day-bucket records).
    // Fall back to named slots augmented with type tags (test fixtures).
    const events = d.allEvents || [
      ...(d.wake    ? [{ ...d.wake,    type: 'wake'    }] : []),
      ...(d.bedtime ? [{ ...d.bedtime, type: 'bedtime' }] : []),
    ];

    for (const ev of events) {
      const calDate = ev.at ? ev.at.slice(0, 10) : d.date;
      if (!byDate.has(calDate)) byDate.set(calDate, []);
      byDate.get(calDate).push(ev);
    }
  }

  return [...byDate.keys()].sort().map(date => {
    const events = byDate.get(date);
    const bedtimesMinutes = events
      .filter(ev => ev.type === 'bedtime')
      .map(ev => extractMinutes(ev))
      .filter(m => m !== null);
    const wakeEvs = events.filter(ev => ev.type === 'wake');

    return {
      date,
      wakeMinutes:    wakeEvs.length > 0 ? extractMinutes(wakeEvs[0]) : null,
      bedtimeMinutes: bedtimesMinutes[0] ?? null,
      bedtimesMinutes,
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
    .map(napDuration)
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
    const sleepDur = sleepDuration(day);
    if (sleepDur === null) continue;
    const sleepHours = sleepDur / 60;
    corr.push({ activityScore: score, sleepHours });
  }

  // Sort ascending by activityScore for consistent scatter plot rendering
  return corr.sort((a, b) => a.activityScore - b.activityScore);
}
