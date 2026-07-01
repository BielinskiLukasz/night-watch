---
phase: 02-configuration-settings
plan: "02"
subsystem: store-layer
tags: [vanilla-js, esm, node-test, tdd, cfg-01, cfg-02, cfg-03, cfg-04, cfg-06, cfg-07, cfg-08, cfg-09, d2-05, d2-07, d2-08, d2-09, d2-22, d2-25]

requires:
  - 02-01 (DEFAULT_SETTINGS, migrateV1ToV2, validateSettings, RULES)
  - 01-01 (composition root, storage adapter seam)
  - 01-02 (TDD pure logic patterns)

provides:
  - js/store/settings.js — createSettingsStore({storage, defaults?}) factory exposing {get, update, subscribe}
  - Cross-store race mitigation: update() re-reads events from storage.load() before save (Pitfall #1 / T-2-06)
  - Subscriber re-entry safety: snapshot-then-iterate pattern (Pitfall #3 / T-2-07)
  - TDD test coverage: 26 new integration assertions (settings-store + v1→v2 migration + cross-store race)

affects:
  - 02-03 (composition root wiring — imports createSettingsStore + creates the singleton on shared storage)
  - 02-04 (Settings modal Save handler — calls settings.update(patch); subscriber updates header)
  - 02-05 (Today screen day-cutover — subscribes to settings.cutoverHour changes for reactive grouping)
  - 02-06 (manual-entry time-format — subscribes to settings.timeFormat changes)

tech-stack:
  added: []
  patterns:
    - "createSettingsStore mirrors createEventLog API shape: constructor loads + migrates, in-memory db is working copy, whole-blob rewrite on every mutation"
    - "Lazy persist (D2-05): storage.save() is NOT called during construction; first save happens on first update()"
    - "Re-read-before-write (Pitfall #1): update() calls storage.load() first to pick up fresh events slice before persisting the merged blob"
    - "Snapshot-then-iterate (Pitfall #3): const subs = [...subscribers]; for (const fn of subs) — prevents Set mutation corruption when a subscriber unsubscribes mid-callback"
    - "Object.freeze on every snapshot return value (D2-09 — UI cannot mutate returned settings)"
    - "Both stores share the same createStorageLocal instance (D2-08); independent storage.load() calls per store"

key-files:
  created:
    - js/store/settings.js (118 lines; createSettingsStore factory; imports migrateV1ToV2 + DEFAULT_SETTINGS from db-shape.js and validateSettings from settings-validate.js)
    - tests/integration/settings-store.test.js (311 lines; 6 describe blocks covering construction (fresh + v2), update(), subscribe(), cross-store stale-write mitigation, round-trip)
    - tests/integration/v1-to-v2-migration.test.js (135 lines; D2-25 — v1 blob migrates silently to v2, events preserved, defaults injected, idempotent on v2 input)
    - tests/integration/cross-store-race.test.js (152 lines; T-2-06 / Pitfall #1 — settings + event-log shared-blob alternate writes, both slices survive in both directions)
  modified: []

key-decisions:
  - "Lazy persist on construction (D2-05) — settings.get() on a fresh install returns DEFAULT_SETTINGS in memory but does NOT write to localStorage until the first update(). The same nightwatch:db blob remains absent until any store writes."
  - "update() re-reads events from storage.load() before save, not from db.events in memory. This is the key Pitfall #1 mitigation — without it, an event-log write happening between the in-memory db.settings update and storage.save() would silently revert settings on the next event-log save."
  - "Subscriber notification is synchronous and single-threaded (D2-09). A snapshot of the subscriber Set is taken before iteration so subscribers calling unsubscribe() during their own callback do not corrupt iteration."
  - "load-time validation via validateSettings mode:'load' resets invalid persisted fields to defaults with console.warn — the store never throws on construction even with a corrupt or partial settings slice."

metrics:
  duration: ~6 min
  completed: 2026-05-28
  tasks: 2
  commits: 3
  test-delta: "+26 (192 → 218 total; settings-store integration + migration + cross-store race)"
  files-created: 4
---

# Phase 2, Plan 02: Settings Store (TDD) Summary

**`createSettingsStore` — the state-coordination layer for user configuration — landed via strict RED→GREEN TDD with full cross-store race mitigation and subscriber re-entry safety; 26 new integration assertions, 218/218 total pass.**

## Performance

- **Duration:** ~6 minutes wall-clock
- **Completed:** 2026-05-28
- **Tasks:** 2 (both `type="tdd"`)
- **Commits:** 3 (RED → GREEN → migration+race integration)
- **Test delta:** 192 → 218 (+26)
- **Files created:** 4

## Accomplishments

- **`createSettingsStore` factory shipped.** Mirrors the `createEventLog` API shape (D2-07): `{get, update, subscribe}` over a shared `nightwatch:db` blob (D2-08). Imports `migrateV1ToV2` + `DEFAULT_SETTINGS` from `db-shape.js` and `validateSettings` from `settings-validate.js` — no circular import.
- **Lazy persist verified (D2-05).** A construction-only round confirms `storage.save()` is NOT called until the first `update()`. A fresh-install boot leaves the blob untouched until any store writes.
- **Cross-store race mitigated (Pitfall #1 / T-2-06).** `update()` calls `storage.load()` to refresh `db.events` from disk before writing the merged blob back. The dedicated `cross-store-race.test.js` exercises both directions: settings.update → event-log.save, and event-log.save → settings.update — both slices survive in each ordering.
- **Subscriber re-entry safe (Pitfall #3 / T-2-07).** A subscriber that calls its own unsubscribe during its callback (or registers a new subscriber) does not corrupt iteration. The snapshot-then-iterate pattern (`const subs = [...subscribers]`) is asserted in the subscribe() describe block.
- **v1→v2 migration integration proof (D2-25).** A pre-populated v1 blob (Phase 1 shape `{version:1, events:[...]}`) is migrated silently on `createSettingsStore` construction: settings default to D2-03 values, events are preserved verbatim, `console.info('[nightwatch] migrating db v1 → v2...')` fires exactly once. v2 input is idempotent (no console.info, no shape change).
- **Load-time hardening (D2-22).** A corrupt persisted settings slice (e.g., `cutoverHour: 999`) is silently per-field-reset to the default with `console.warn` on construction. The store never throws on boot for malformed data; the only `throw` path is `migrateV1ToV2` on `version ≥ 3` (future-schema guard).
- **No regressions.** All 125 Phase 1 tests + the 67 Plan 02-01 unit tests continue to pass (192 baseline → 218 after the +26 integration tests).

## Task Commits

1. **Task 1 — settings.js (createSettingsStore: get/update/subscribe/persist/validate-on-load):**
   - RED: `bbc98c6` `test(NW-02): red — settings-store integration contract (D2-07, D2-09)`
     - 311 lines of failing integration tests (6 describe blocks: fresh-install construction, v2-blob construction with invalid-field reset, update() merge + persist, subscribe/unsubscribe + re-entry safety, cross-store stale-write mitigation, round-trip)
   - GREEN: `76c49d5` `feat(NW-02): green — createSettingsStore (CFG-01..04, CFG-06..09 persistence, D2-08, D2-09)`
     - 118 lines of `js/store/settings.js`; all settings-store tests pass

2. **Task 2 — v1→v2 migration integration + cross-store race integration:**
   - `90959ea` `test(NW-02): integration — v1→v2 migration (D2-25) + cross-store race mitigation (CFG-08, D2-05, D2-08)`
     - 135 lines of `v1-to-v2-migration.test.js` (D2-25: v1 blob in fake-LS → store loads with defaults + preserved events + `console.info` once; round-trip; idempotent on v2)
     - 152 lines of `cross-store-race.test.js` (T-2-06 / Pitfall #1: shared `createStorageLocal` instance, alternate settings/event-log writes both ways, both slices survive)
     - The pre-existing GREEN settings.js from Task 1 already implemented the re-read-before-write mitigation, so these integration tests passed without further code changes — confirming Task 1's implementation is correct by independent integration probe

## Deviations from Plan

**Total deviations:** 0

All `must_haves.truths` from the plan are demonstrably true; all `must_haves.artifacts` exist at the declared paths; all `key_links` resolve cleanly without circular imports.

## Source Assertions Verified

```
grep -c 'createSettingsStore' js/store/settings.js  → ≥ 1  ✓
grep -c 'subscribe\b' js/store/settings.js          → 4  ≥ 2  ✓  (subscribe method + subscribers.add + subscribers.delete + subscribers Set)
grep -c 'migrateV1ToV2' js/store/settings.js        → 2  ≥ 1  ✓
grep -c 'storage.load()' js/store/settings.js       → 5  ≥ 1  ✓  (re-read in update() and in constructor)
npm run test:unit -- tests/integration/settings-store.test.js tests/integration/v1-to-v2-migration.test.js tests/integration/cross-store-race.test.js → 26/26 pass  ✓
npm run test:unit                                    → 218/218 pass  ✓
```

## Known Stubs

None. The store is a complete implementation at Plan 02-02 scope. No UI yet — that lands in Plan 02-04. Composition root wiring (creating the store on the shared storage instance) lands in Plan 02-03.

## Threat Surface Scan

No new attack surface introduced. The store is pure-logic + storage I/O via the existing adapter seam.

- **T-2-05** (Tampering — corrupted blob on load): `migrateV1ToV2` handles null/undefined/v1/v2; `validateSettings mode:'load'` resets invalid per-field. App boots from any blob shape ≤ v2.
- **T-2-06** (Tampering — cross-store stale-write): `update()` re-reads `storage.load()` for the events slice before save. Dedicated `cross-store-race.test.js` is the regression guard.
- **T-2-07** (Tampering — subscriber re-entry): Snapshot-then-iterate; unsubscribe-during-callback test passes.
- **T-2-08** (Tampering — cross-tab divergence): Accepted limitation, Phase 8 `BroadcastChannel` is the mitigation path. No code in Plan 02-02 addresses this.
- **T-2-SC** (Tampering — supply chain): No new dependencies. node:test built-in only.

## TDD Gate Compliance

Plan type is `tdd`. Verification:

- Task 1: `test(NW-02)` `bbc98c6` (RED — 311 lines, all failing on missing `js/store/settings.js`) → `feat(NW-02)` `76c49d5` (GREEN — 118 lines settings.js, all tests pass) — RED→GREEN ✓
- Task 2: `test(NW-02)` `90959ea` (integration tests — both files pass without code changes because the re-read-before-write pattern was already in settings.js from Task 1) — assertion-only commit, no GREEN counterpart needed; the GREEN gate for the underlying behavior is Task 1's `76c49d5` ✓

Both RED commits were confirmed to fail at import (`js/store/settings.js did not exist`) before GREEN was authored. This satisfies the RED gate.

## Next Phase Readiness

- **Plan 02-03 (composition root + time helpers)** can start immediately. It imports `createSettingsStore` from `js/store/settings.js`, wires it into `js/app.js` on the same `createStorageLocal('nightwatch:db')` instance shared with the event-log, and bumps the event-log `SCHEMA_VERSION` to 2 (since the v2 blob shape is now the canonical persisted shape).
- **Plan 02-04 (Settings modal UI)** can wire its Save handler to `settings.update(patch)` and its inputs to `settings.get()`; the header strip subscribes to settings changes for live subjectName updates.
- The 218/218 test suite provides a regression baseline for all subsequent Phase 2 plans.

## Self-Check: PASSED

**Created files verified to exist:**
- FOUND: js/store/settings.js
- FOUND: tests/integration/settings-store.test.js
- FOUND: tests/integration/v1-to-v2-migration.test.js
- FOUND: tests/integration/cross-store-race.test.js

**Commits verified in git log:**
- FOUND: bbc98c6 (RED settings-store)
- FOUND: 76c49d5 (GREEN settings.js)
- FOUND: 90959ea (integration migration + race)

**Test suite:**
- FOUND: `npm run test:unit` exits 0 with 218/218 passing
