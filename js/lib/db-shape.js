// js/lib/db-shape.js
// Pure helper for schema migration and canonical blob shape.
// No I/O, no DOM, no imports from other project files — fully testable in
// isolation with node:test.
//
// Decisions: D2-03 (DEFAULT_SETTINGS values), D2-05 (v1→v2 migration),
//            D2-08 (shared-blob seam recommendation: option 1 — tiny helper).
// Research:  RESEARCH §Pattern B (migration shape), §Pitfall #8 (idempotency
//            contract for Phase 5 callers).
//
// DEFAULT_SETTINGS is placed here (not in js/store/settings.js) to break the
// circular-import risk: settings-validate.js imports DEFAULT_SETTINGS, and
// settings.js imports validateSettings. Placing defaults in this neutral module
// lets both importers resolve without a cycle (RESEARCH §Pattern F §Circular
// import risk).

/**
 * Default configuration values per D2-03 (spreadsheet conventions).
 * Object.freeze'd per CLAUDE.md / mindful-breathing pattern.
 * Callers that need a mutable copy must spread: { ...DEFAULT_SETTINGS }.
 *
 * @type {Readonly<{
 *   subjectName: string,
 *   cutoverHour: number,
 *   groupingMode: string,
 *   timeFormat: string,
 *   autoOutlier: boolean,
 *   maxDelta: number,
 *   minDays: number,
 *   windowDays: number,
 *   statBlend: string,
 * }>}
 */
export const DEFAULT_SETTINGS = Object.freeze({
  subjectName:  '',          // empty — header shows nothing until set (CFG-01)
  cutoverHour:  4,           // CFG-08, matches Phase 1 D-18
  groupingMode: 'calendar',  // preserves Phase 1 D-11 baseline
  timeFormat:   '24h',       // CFG-09 default
  autoOutlier:  false,       // CFG-04, off until Phase 3 engine ships
  maxDelta:     30,          // minutes; CFG-02
  minDays:      7,           // CFG-03
  windowDays:   7,           // CFG-06
  statBlend:    'median',    // CFG-07
});

/**
 * Normalize a raw storage blob to the canonical v2 shape.
 *
 * Idempotency contract (RESEARCH §Pitfall #8):
 *   - null / undefined → fresh v2 blob (fresh install)
 *   - version 1 → inject defaultSettings, preserve events, bump to v2
 *   - version 2 → pass through unchanged (same object reference)
 *   - version ≥ 3 → throw Error so the caller (Phase 5 import) handles recovery
 *
 * Lazy-persist rule (D2-05): this function does NOT perform any I/O. The
 * caller is responsible for persisting the returned blob when appropriate.
 *
 * Phase 5 contract (RESEARCH §Pitfall #8): Phase 5 import callers MUST pass
 * the parsed-and-migrated blob to both stores at composition time, not by
 * re-loading after save. Re-loading after a lazy-persist migration may return
 * a stale un-migrated blob if the save has not yet occurred.
 *
 * @param {object|null|undefined} blob
 * @param {object} defaultSettings  spread-copied into fresh / v1 blobs
 * @returns {{ version: 2, settings: object, events: Array }}
 */
export function migrateV1ToV2(blob, defaultSettings) {
  // Fresh install — no existing data.
  if (blob === null || blob === undefined) {
    return { version: 2, settings: { ...defaultSettings }, events: [] };
  }

  // v2 is already the canonical shape — idempotent passthrough.
  if (blob.version === 2) {
    return blob;
  }

  // v1 (Phase 1 shape: { version: 1, events: [...] }) — inject default
  // settings and bump version. Events are preserved unchanged (D2-05).
  if (blob.version === 1) {
    console.info('[nightwatch] migrating db v1 → v2 (injecting default settings)');
    return {
      version: 2,
      settings: { ...defaultSettings },
      events: Array.isArray(blob.events) ? blob.events : [],
    };
  }

  // Any other version (future or corrupt) — throw so the caller can decide
  // how to recover (Phase 5 import dialog is the designated recovery path).
  throw new Error(`Unsupported schema version: ${blob.version}`);
}
