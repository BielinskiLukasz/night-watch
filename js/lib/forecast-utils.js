// js/lib/forecast-utils.js
// Pure logic for event-reachability determination — no side effects, no DOM.
// Source: Phase 21 D-06/D-07/D-14 (prediction-normalization).
//
// === Exported Functions ===
//
// nextReachableEvent(lastEvent, currentHour, settings) → string[]
//   Determines which upcoming event(s) are actually reachable given the last
//   logged event and the time of day. Returns an array of event-type strings
//   (normally length 1; length 2 only for the ambiguous wake branch, when both
//   napStart and bedtimeAfterWake remain reachable). Pure — currentHour is a
//   parameter, never read from the wall clock inside this function.
//
// selectNextEvent(predictions, dayRecords, settings) → { type, isMissed, ...prediction } | null
//   Thin wrapper: finds lastEvent from dayRecords, reads the wall clock once,
//   calls nextReachableEvent, then walks the returned array against
//   predictions to skip event types with no historical data — preserving the
//   pre-Phase-21 external contract and fallback behavior exactly.
//
// This module absorbs and replaces the priority-order logic formerly
// duplicated inside js/lib/forecast.js's selectNextEvent (D3-10/PRED-08),
// fixing its two gsd:allow-ui-clock calls by moving the clock read to the
// thin wrapper boundary (D-06) and giving the pure core a testable, injectable
// currentHour parameter.
//
// === The 5-Path Event Model (D-07) ===
//
//   lastEvent.type === 'bedtime'  → ['wake']
//   lastEvent.type === 'wake'     → ['napStart', 'bedtimeAfterWake']  (nap still reachable)
//                                 → ['bedtimeAfterWake']              (napStart dropped, D-05)
//   lastEvent.type === 'napStart' → ['napEnd']
//   lastEvent.type === 'napEnd'   → ['bedtimeAfterNap']
//   unknown / unrecognized type   → ['wake']
//
// `bedtimeAfterNap`/`bedtimeAfterWake` are prediction-calculation branches
// only (Phase 19's buildBedtimeSeriesNapDay/buildBedtimeSeriesNoNapDay) — not
// new loggable event types. The user still only ever logs a single `bedtime`
// event. `napStart` drops out of the wake branch when `napWindowClosed` is
// true OR `currentHour >= eveningHour` (D-05).
//
// === Import Direction ===
// One-directional: this file imports from forecast.js; forecast.js never
// imports from this file (D-14, no circular-import risk).

import { timeToMinutes } from './forecast.js';

/**
 * Determine which upcoming event type(s) are reachable from the last logged
 * event, given the current hour and settings (D-06/D-07). Pure function —
 * takes currentHour as a parameter instead of reading the wall clock directly.
 *
 * @param {{type: string, at: string}|null} lastEvent  most recently logged event
 * @param {number} currentHour  0-23, from wall-clock time (caller-resolved)
 * @param {{eveningHour?: number, napWindowClosed?: boolean}} [settings]
 * @returns {string[]}  array of next-event-type strings (1-2 elements)
 */
export function nextReachableEvent(lastEvent, currentHour, settings = {}) {
  const { eveningHour = 18, napWindowClosed = false } = settings || {};

  // D-05: napStart drops out of the wake branch when EITHER signal fires —
  // the decoupled napWindowClosed flag (Phase 20/21) OR the pre-existing
  // PRED-08 evening-hour override. Both use >= against currentHour/eveningHour.
  const napStartDropped = napWindowClosed === true || currentHour >= eveningHour;

  switch (lastEvent?.type) {
    case 'bedtime':
      return ['wake'];
    case 'wake':
      return napStartDropped ? ['bedtimeAfterWake'] : ['napStart', 'bedtimeAfterWake'];
    case 'napStart':
      return ['napEnd'];
    case 'napEnd':
      return ['bedtimeAfterNap'];
    default:
      // Unknown/unrecognized event type (or null lastEvent, defensively) →
      // fall back to natural wake-first order.
      return ['wake'];
  }
}

/**
 * Map a nextReachableEvent() path entry to the predictions object's key.
 * bedtimeAfterNap normalizes to the single 'bedtime' prediction field (D-07's
 * own parenthetical: these are calculation branches only, not new logged
 * event types) — bedtimeAfterWake keeps its own field so Plan 21-02's
 * dual-hero rendering can distinguish it from the blended predictions.bedtime.
 *
 * Exported (WR-01 fix) so today-screen.js's dual-hero rendering path — which
 * calls nextReachableEvent() directly instead of selectNextEvent() — can
 * import this single source of truth instead of maintaining a byte-for-byte
 * duplicate copy.
 */
export const PREDICTION_FIELD = Object.freeze({
  wake: 'wake',
  bedtime: 'bedtime',
  napStart: 'napStart',
  napEnd: 'napEnd',
  bedtimeAfterWake: 'bedtimeAfterWake',
  bedtimeAfterNap: 'bedtime',
});

/**
 * Map a nextReachableEvent() path entry to the RESULT `type` field reported
 * to callers. bedtimeAfterWake keeps its own literal (distinguishable from
 * plain 'bedtime'); bedtimeAfterNap normalizes to 'bedtime' (D-07).
 *
 * Exported (WR-01 fix) — see PREDICTION_FIELD above for rationale.
 */
export const RESULT_TYPE = Object.freeze({
  wake: 'wake',
  bedtime: 'bedtime',
  napStart: 'napStart',
  napEnd: 'napEnd',
  bedtimeAfterWake: 'bedtimeAfterWake',
  bedtimeAfterNap: 'bedtime',
});

/**
 * Derive the napWindowClosed flag (Phase 20/21's decoupled napProbability()
 * signal) from a predictions object. Single source of truth (WR-01 fix) for
 * the `predictions.napStart?.napProbabilityScore?.napWindowClosed === true`
 * check, previously duplicated independently in this file's selectNextEvent
 * and in today-screen.js's renderForecastSection.
 *
 * Safe optional-chain; defaults false when the field or the whole score
 * object is absent (e.g. TIF algorithm active, or forecast() called
 * directly in a unit test without napProbabilityScore threaded).
 *
 * @param {object} predictions  forecast() result keyed by event type
 * @returns {boolean}
 */
export function isNapWindowClosed(predictions) {
  return predictions?.napStart?.napProbabilityScore?.napWindowClosed === true;
}

/**
 * Legacy pre-Phase-21 priority-order fallback tables (D3-10), walked with
 * plain type names directly against `predictions` — used only when nothing
 * in nextReachableEvent()'s returned path resolves to an existing prediction
 * (e.g. every event type in the reachable path has no recorded history yet).
 * Not exported — an internal fallback preserving the exact prior behavior.
 */
const LEGACY_FALLBACK_PRIORITY = Object.freeze({
  bedtime: ['wake', 'napStart', 'napEnd', 'bedtime'],
  wake: ['napStart', 'bedtime', 'napEnd', 'wake'],
  napStart: ['napEnd', 'bedtime', 'wake', 'napStart'],
  napEnd: ['bedtime', 'wake', 'napStart', 'napEnd'],
  default: ['wake', 'bedtime', 'napStart', 'napEnd'],
});

/**
 * Select the single most relevant upcoming prediction using sleep-cycle
 * awareness (D3-10, extended by Phase 21 D-06/D-07). Thin wrapper around
 * nextReachableEvent(): finds lastEvent from dayRecords, reads the wall
 * clock once, delegates the reachability decision to the pure core, then
 * walks the returned path against `predictions` to skip event types with
 * no recorded history — preserving the exact pre-Phase-21 external contract.
 *
 * @param {object} predictions  forecast() result keyed by event type
 *   Each key is one of: wake, bedtime, napStart, napEnd, bedtimeAfterWake
 *   Each value is one of:
 *     { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' }  (normal prediction)
 *     { probabilityBand: [{time, prob}, ...] }             (high-uncertainty)
 *   Missing keys (event type never recorded) are allowed; that tier is skipped.
 *
 * @param {object[]} dayRecords  array of day records from daysBySubjectiveNight()
 *   Each record must have an allEvents array (list of { type, at } raw events).
 *   The most recent event across ALL day records determines the priority order.
 *
 * @param {{eveningHour?: number}} [settings]
 *
 * @returns {{ type: string, isMissed: boolean, ...prediction }|null}
 *   - type: the selected event type ('wake', 'bedtime', 'napStart', 'napEnd',
 *     or 'bedtimeAfterWake')
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

  // ── Step 2: read the wall clock once (the one UI-clock read this wrapper
  // performs on nextReachableEvent's behalf) ────────────────────────────────
  const nowHour = new Date().getHours(); // gsd:allow-ui-clock

  // ── Step 3: napWindowClosed, from Phase 20/21's decoupled napProbability() flag ──
  const napWindowClosed = isNapWindowClosed(predictions);

  // ── Step 4: delegate the reachability decision to the pure core (D-06) ────
  const reachable = nextReachableEvent(lastEvent, nowHour, {
    eveningHour: settings?.eveningHour,
    napWindowClosed,
  });

  // ── Step 5: walk the reachable path, resolving each entry against predictions ──
  for (const entry of reachable) {
    const fieldKey = PREDICTION_FIELD[entry];
    const predEntry = predictions[fieldKey]
      ?? (entry === 'bedtimeAfterWake' ? predictions.bedtime : undefined);
    if (!predEntry) continue;

    // D3-11: Detect "missed" predictions. A prediction is missed when its
    // central time has passed today (minutes-since-midnight comparison only).
    let isMissed = false;
    if (predEntry.central) {
      // gsd:allow-ui-clock — display-only UI metadata (D3-11), not domain logic.
      const nowDate = new Date(); // gsd:allow-ui-clock
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      const centralMinutes = timeToMinutes(predEntry.central);
      isMissed = centralMinutes < nowMinutes;
    }

    return {
      type: RESULT_TYPE[entry],
      isMissed,
      ...predEntry,
    };
  }

  // ── Step 6: nothing in the reachable path resolved — fall back to the
  // legacy pre-Phase-21 priority table (preserves prior behavior exactly) ────
  const legacyPriority = LEGACY_FALLBACK_PRIORITY[lastEvent.type] ?? LEGACY_FALLBACK_PRIORITY.default;
  for (const eventType of legacyPriority) {
    const pred = predictions[eventType];
    if (!pred) continue;

    let isMissed = false;
    if (pred.central) {
      // gsd:allow-ui-clock — display-only UI metadata (D3-11), not domain logic.
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

  // ── Step 7: all tiers exhausted with no match ──────────────────────────────
  return null;
}
