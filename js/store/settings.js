// js/store/settings.js
// Settings store — state-coordination layer for user configuration.
// Persists to the shared nightwatch:db blob (D2-04, D2-08), notifies
// subscribers synchronously on update (D2-09), and applies lazy persist
// (D2-05): storage.save() is NOT called at construction time.
//
// Plan: 02-02 (Task 1 — GREEN)
// Decisions: D2-05, D2-07, D2-08, D2-09, D2-22
// Requirements: CFG-01, CFG-02, CFG-03, CFG-04, CFG-06, CFG-07, CFG-08, CFG-09
//
// Cross-store race mitigation (Pitfall #1 / T-2-06):
//   update() re-reads fresh.events from storage.load() before writing back
//   so a concurrent event-log write (which carries its own stale db.settings)
//   does not overwrite the fresh settings slice on the next event-log write.
//   This is the same read-before-write pattern event-log.persist() relies on
//   for the events slice.
//
// Subscriber re-entry safety (Pitfall #3 / T-2-07):
//   Snapshot the Set before iteration: const subs = [...subscribers];
//   A subscriber calling unsubscribe() during its own callback does not
//   mutate the iterator mid-loop.
//
// Circular import avoidance (RESEARCH §Pattern F):
//   DEFAULT_SETTINGS lives in js/lib/db-shape.js (neutral module), not here.
//   This breaks the cycle: settings.js → settings-validate.js → settings.js.

import { migrateV1ToV2, DEFAULT_SETTINGS } from '../lib/db-shape.js';
import { validateSettings } from '../lib/settings-validate.js';

/**
 * Create a settings store backed by the given storage adapter.
 *
 * The store shares the nightwatch:db blob with the event-log store (D2-08).
 * Both stores call storage.load() / storage.save(db) independently; the
 * full blob (version + settings + events) flows through each save call.
 *
 * @param {{
 *   storage: { load: () => object|null, save: (db: object) => void },
 *   defaults?: object
 * }} deps
 * @returns {{
 *   get: () => Readonly<object>,
 *   update: (patch: object) => Readonly<object>,
 *   subscribe: (fn: (snap: Readonly<object>) => void) => () => void
 * }}
 */
export function createSettingsStore({ storage, defaults = DEFAULT_SETTINGS }) {
  // ── Construction ──────────────────────────────────────────────────────────
  // Load and migrate once; in-memory db is the working copy.
  // Do NOT call storage.save() here — lazy persist (D2-05).
  let db = migrateV1ToV2(storage.load(), defaults);

  // Per-field default-on-invalid for load (D2-22): validateSettings mode:'load'
  // silently resets out-of-range / wrong-type values to defaults with
  // console.warn('[nightwatch] settings.{field} invalid...').
  const { normalized } = validateSettings(db.settings ?? {}, { mode: 'load', defaults });
  db.settings = normalized;
  // db is now guaranteed: { version: 2, settings: { all 9 keys valid }, events: [...] }

  // ── Subscriber set ────────────────────────────────────────────────────────
  const subscribers = new Set();

  /** Produce a frozen shallow copy of db.settings. */
  const snapshot = () => Object.freeze({ ...db.settings });

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    /**
     * Return the current settings as an Object.freeze'd snapshot.
     * Callers may not mutate the returned object; use update() to change values.
     *
     * @returns {Readonly<object>}
     */
    get: snapshot,

    /**
     * Merge `patch` into the current settings, persist the full blob to
     * storage, fire all subscribers synchronously, and return the new snapshot.
     *
     * Cross-store race mitigation (Pitfall #1): re-reads events from
     * storage.load() before save so an event-log write that carried a
     * stale settings slice does not permanently revert settings.
     *
     * @param {object} patch  partial settings object (fields to update)
     * @returns {Readonly<object>} the new settings snapshot
     */
    update(patch) {
      // Re-read events slice from storage before write to avoid Pitfall #1.
      // If the storage has a fresher events array (e.g. event-log just wrote),
      // we pick it up here before overwriting the blob.
      const fresh = storage.load();
      if (fresh && fresh.version === 2 && Array.isArray(fresh.events)) {
        db.events = fresh.events;
      }

      db.settings = { ...db.settings, ...patch };
      storage.save(db);

      const next = snapshot();
      // Snapshot the Set before iterating (Pitfall #3 / T-2-07).
      const subs = [...subscribers];
      for (const fn of subs) fn(next);
      return next;
    },

    /**
     * Register a subscriber that is called synchronously after every
     * successful update(). Returns an unsubscribe function.
     *
     * @param {(snap: Readonly<object>) => void} fn
     * @returns {() => void} call to remove the subscription
     */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
