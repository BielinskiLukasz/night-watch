// js/store/event-log.js
// Event log store — orchestrates add/edit/delete/list over the StorageAdapter
// + ClockAdapter seams (D-07). The walking-skeleton (Plan 01) exposes only
// the minimum API to prove end-to-end persistence; Plan 03 added day-grouping
// delegation; Plan 04 (this commit) adds addEventAt, editEvent, deleteEvent
// per Pattern 5 to complete the Phase 1 mutation surface for LOG-05 / LOG-06.
//
// Source: 01-RESEARCH.md §Pattern 5; 01-CONTEXT.md D-01, D-02, D-03, D-04, D-05.
//
// Invariants enforced here:
//   - D-03 mutate-in-place — editEvent assigns at the SAME index (events[i] = next),
//     deleteEvent splices at the SAME index. No tombstones, no audit trail, no
//     correction-event records. Pitfall #6 (edit-creates-duplicate) is mitigated
//     at this layer; tests/integration/manual-entry.test.js is the regression
//     guard ("events.length unchanged after edit").
//   - D-04 canonical JSON shape `{ version: 1, events: [...] }`
//   - D-05 persisted blob === canonical JSON (byte-for-byte). deleteEvent and
//     editEvent both call persist() so the on-disk blob never lags the in-memory
//     model.
//   - T-01 mitigation: VALID_TYPES Set guards every write path (addEvent,
//     addEventAt, editEvent) against typos / future drift.
//   - T-02 mitigation: parseLocalISO regex gate is reused on every manual at-string
//     input (addEventAt, editEvent) — malformed timestamps fail loudly.
//   - LOG-07: every write path re-rounds the at value via roundTo5, so manual
//     entry / edit cannot smuggle in a non-5-min-multiple even if the modal's
//     normalization is bypassed.
//   - Schema-version guard throws on unsupported `db.version` so Phase 5
//     import doesn't silently accept future-schema blobs.

import { roundTo5, formatLocalISO, parseLocalISO } from '../lib/time.js';
import {
  daysByCalendar as _daysByCalendar,
  daysBySubjectiveNight as _daysBySubjectiveNight,
} from '../lib/day-bucket.js';
import { migrateV1ToV2, DEFAULT_SETTINGS } from '../lib/db-shape.js';

const SCHEMA_VERSION = 2;
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
  // migrateV1ToV2 runs BEFORE the version check so v1 blobs (Phase 1) succeed
  // silently and v3+ blobs still throw (T-2-09). Fresh installs (null) become
  // a canonical v2 blob with default settings injected.
  // Whole-blob rewrite on every mutation (D-02).
  let db = migrateV1ToV2(storage.load(), DEFAULT_SETTINGS);
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${db.version}`);
  }

  // Cross-store race mitigation symmetric to settings.update() (Pitfall #1 /
  // T-2-10): re-read the settings slice from storage before each save so an
  // event-log write that ran with a stale settings copy cannot revert the
  // user's most-recent settings change.
  const persist = () => {
    const fresh = storage.load();
    if (fresh && fresh.version === 2 && fresh.settings) {
      db.settings = fresh.settings;
    }
    storage.save(db);
  };

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
     * Append a new event at an explicit wall-clock timestamp (manual entry /
     * back-fill — LOG-05). The at-string flows through parseLocalISO (T-02
     * regex gate — malformed inputs throw /Invalid local ISO timestamp/) and
     * is then re-rounded to the nearest 5-minute boundary (LOG-07) so the
     * canonical 5-min invariant holds even if the modal's normalization is
     * bypassed (devtools, future entry points).
     *
     * @param {string} type   one of VALID_TYPES
     * @param {string} atString  canonical 'YYYY-MM-DDTHH:MM' wall-clock
     * @returns {{ id: string, type: string, at: string }}
     */
    addEventAt(type, atString) {
      if (!VALID_TYPES.has(type)) {
        throw new Error(`Invalid event type: ${type}`);
      }
      const at = formatLocalISO(roundTo5(parseLocalISO(atString)));
      const evt = { id: id(), type, at };
      db.events.push(evt);
      persist();
      return evt;
    },

    /**
     * Mutate an existing event in place (D-03). Spreads `patch` over the
     * record at the SAME array index — does NOT splice + push (Pitfall #6
     * the root cause of edit-creates-duplicate). The integration test
     * `tests/integration/manual-entry.test.js` asserts
     * `events.length === 1` after edit as the regression guard.
     *
     * Re-rounds the at field on save (LOG-07), re-validates the type
     * (T-01), and preserves the id (so the UI's `data-event-id` keeps
     * pointing at the same record).
     *
     * @param {string} eventId
     * @param {Partial<{ type: string, at: string }>} patch
     * @returns {{ id: string, type: string, at: string }} the mutated record
     * @throws Error /not found/ when eventId is absent
     */
    editEvent(eventId, patch) {
      const i = db.events.findIndex((e) => e.id === eventId);
      if (i === -1) {
        throw new Error(`Event not found: ${eventId}`);
      }
      const next = { ...db.events[i], ...patch };
      if (!VALID_TYPES.has(next.type)) {
        throw new Error(`Invalid event type: ${next.type}`);
      }
      next.at = formatLocalISO(roundTo5(parseLocalISO(next.at)));
      // Mutate-in-place at SAME index (D-03). NOT splice(i,1) + push(next) —
      // that would re-order, breaking the Pitfall #6 invariant in a subtle way.
      db.events[i] = next;
      persist();
      return next;
    },

    /**
     * Remove an event by id (LOG-06). Idempotent: returns false when the
     * id is absent (no throw, no side effect) so the UI can safely re-issue
     * a delete after a stale-id race.
     *
     * Mutate-in-place at the same array index (D-03) — splice(i, 1) is the
     * delete counterpart to events[i] = next in editEvent.
     *
     * @param {string} eventId
     * @returns {boolean} true if an event was removed, false if id absent
     */
    deleteEvent(eventId) {
      const i = db.events.findIndex((e) => e.id === eventId);
      if (i === -1) return false;
      db.events.splice(i, 1);
      persist();
      return true;
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
