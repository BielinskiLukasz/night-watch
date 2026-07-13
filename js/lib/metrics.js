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
// Pure functions — no DOM, no localStorage, no new Date().

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

/** Active time between wake and nap start. */
export function activityBeforeNap(day) {
  const wakeStr  = extractTime(day.wake);
  const napStr   = extractTime(day.napStart);
  if (wakeStr == null || napStr == null) return null;
  const result = timeToMinutes(napStr) - timeToMinutes(wakeStr);
  return result < 0 ? result + 24 * 60 : result;
}

/** Active time between nap end and bedtime. */
export function activityAfterNap(day) {
  const napEndStr = extractTime(day.napEnd);
  const bedStr    = extractTime(day.bedtime);
  if (napEndStr == null || bedStr == null) return null;
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

/** Sum of night sleep and nap; null if either component is unavailable. */
export function combinedSleepNap(day) {
  const sleep = sleepDuration(day);
  const nap   = napDuration(day);
  if (sleep == null || nap == null) return null;
  return sleep + nap;
}
