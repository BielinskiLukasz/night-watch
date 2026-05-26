// js/store/event-log.js
// Event log store — orchestrates add/list over the StorageAdapter + ClockAdapter
// seams (D-07). The walking-skeleton (Plan 01) exposes only the minimum API
// to prove end-to-end persistence; Plans 03/04 extend with editEvent /
// deleteEvent / addEventAt / day-grouping methods.
//
// Source: 01-RESEARCH.md §Pattern 5; 01-CONTEXT.md D-01, D-02, D-04, D-05.
//
// Invariants enforced here:
//   - D-04 canonical JSON shape `{ version: 1, events: [...] }`
//   - D-05 persisted blob === canonical JSON (byte-for-byte)
//   - T-01 mitigation: VALID_TYPES Set guards addEvent against typos / future
//     drift. Plan 03 extends the integration tests to cover all 4 valid types.
//   - Schema-version guard throws on unsupported `db.version` so Phase 5
//     import doesn't silently accept future-schema blobs.

import { roundTo5, formatLocalISO } from '../lib/time.js';
import {
  daysByCalendar as _daysByCalendar,
  daysBySubjectiveNight as _daysBySubjectiveNight,
} from '../lib/day-bucket.js';

const SCHEMA_VERSION = 1;
const VALID_TYPES = new Set(['wake', 'bedtime', 'napStart', 'napEnd']);

// D-18 (Plan 01-02): Phase 1 hardcodes the subjective-night cutover at 04:00.
// Phase 2 (CFG-08) wires this to the user-configurable setting. The default
// argument on daysBySubjectiveNight() is the seam where Phase 2 will inject
// the user's preference instead of the hardcoded 4.
const DEFAULT_CUTOVER_HOUR = 4;

/**
 * @param {{
 *   storage: { load: () => object|null, save: (db: object) => void },
 *   clock: { now: () => Date },
 *   id: () => string,
 * }} deps
 */
export function createEventLog({ storage, clock, id }) {
  // Load once at construction; the in-memory `db` is the working copy.
  // Whole-blob rewrite on every mutation (D-02).
  let db = storage.load();
  if (db === null) {
    db = { version: SCHEMA_VERSION, events: [] };
  }
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${db.version}`);
  }

  const persist = () => storage.save(db);

  return {
    /**
     * Append a new event with `at = formatLocalISO(roundTo5(clock.now()))`.
     * Rejects unknown types (T-01).
     *
     * @param {string} type one of VALID_TYPES
     * @returns {{ id: string, type: string, at: string }}
     */
    addEvent(type) {
      if (!VALID_TYPES.has(type)) {
        throw new Error(`Invalid event type: ${type}`);
      }
      const at = formatLocalISO(roundTo5(clock.now()));
      const evt = { id: id(), type, at };
      db.events.push(evt);
      persist();
      return evt;
    },

    /**
     * Defensive copy — UI code MUST NOT mutate the returned array
     * (RESEARCH §Anti-Patterns "Mutating store-returned arrays").
     *
     * @returns {Array<{ id: string, type: string, at: string }>}
     */
    listEvents() {
      return [...db.events];
    },

    /**
     * Calendar-date day-grouping (D-08, D-11) — the view the Today screen
     * uses. Delegates to lib/day-bucket. UI code (Plan 03 today-screen.js)
     * passes limit=7 to honor the D-10/D-15 7-day window.
     *
     * @param {number} [limit]  optional max records, newest first
     * @returns {Array<object>}  day records as defined in lib/day-bucket.js
     */
    daysByCalendar(limit) {
      return _daysByCalendar(db.events, limit);
    },

    /**
     * Subjective-night day-grouping (D-08). Phase 3+ forecast engine uses
     * this view; Phase 1 callers may also use it for debugging. Defaults
     * to cutoverHour=4 (D-18). Phase 2 (CFG-08) will inject the user-
     * configured cutover here.
     *
     * @param {number} [cutoverHour=4]  integer 0..23
     * @param {number} [limit]
     * @returns {Array<object>}
     */
    daysBySubjectiveNight(cutoverHour = DEFAULT_CUTOVER_HOUR, limit) {
      return _daysBySubjectiveNight(db.events, cutoverHour, limit);
    },
  };
}
