---
phase: 02-configuration-settings
plan: "03"
subsystem: composition-root + pure-logic
tags: [vanilla-js, esm, node-test, cfg-08, cfg-09, d2-04, d2-08, d2-18, d2-20, t-2-09, t-2-10, pitfall-1, pitfall-3, pitfall-4]

requires:
  - 02-01 (DEFAULT_SETTINGS, migrateV1ToV2)
  - 02-02 (createSettingsStore — for composition root wiring)
  - 01-02 (time.js — extends with new helpers)

provides:
  - js/store/event-log.js — SCHEMA_VERSION bumped 1→2, migrateV1ToV2 runs before version check, persist() re-reads settings before save (T-2-10)
  - js/app.js — composition root constructs createSettingsStore on the shared nightwatch:db storage instance (D2-08); forwards settings to mountTodayScreen
  - js/lib/time.js — formatTime, to24h, to12h helpers exported (CFG-09)
  - 33 new test assertions (32 in tests/unit/time.test.js + 1 Phase 1 snapshot helper test)

affects:
  - 02-04 (header + Settings modal — reads settings.get(), calls settings.update(), subscribes for header live update)
  - 02-05 (Today screen day-cutover — settings forwarded by composition root already wired)
  - 02-06 (manual-entry — consumes to24h/to12h; today list display consumes formatTime)

tech-stack:
  added: []
  patterns:
    - "Schema migration on load: migrateV1ToV2 runs BEFORE the version check so legacy v1 blobs from Phase 1 dogfooders boot silently into v2 (T-2-09)"
    - "Cross-store race symmetric fix (Pitfall #1 / T-2-10): event-log.persist() re-reads fresh.settings from storage before save — mirrors the same pattern in settings.update() so neither store can clobber the other's slice"
    - "12h boundary handling via explicit conditionals (Pitfall #4): h24===0 → 12 AM, h24===12 → 12 PM. No modulo arithmetic — the regression-test table in time.test.js pins all 4 boundary hours (0, 1, 12, 23)"
    - "String-slice display formatting (Pitfall #3 / DST safety): formatTime slices at.slice(11,13) / at.slice(14,16) and never constructs a Date object"

key-files:
  created: []
  modified:
    - js/store/event-log.js (SCHEMA_VERSION 1→2; import migrateV1ToV2+DEFAULT_SETTINGS; persist() re-reads settings before save)
    - js/app.js (import createSettingsStore; construct on shared storage; forward to mountTodayScreen)
    - js/lib/time.js (+72 lines: formatTime / to12h / to24h with Pitfall #3 / Pitfall #4 mitigations)
    - tests/unit/time.test.js (+95 lines: 32 new assertions covering all boundary hours)
    - tests/integration/event-log.test.js (snapshot helper v2Snapshot; 5 deepEqual snapshots updated to expect v2 shape)
    - tests/integration/manual-entry.test.js (1 snapshot updated; DEFAULT_SETTINGS imported)
    - tests/integration/persistence.test.js (2 snapshot/shape tests updated; D-04 invariant now D2-04 — v2 canonical shape with settings slice)

key-decisions:
  - "Phase 1 deepEqual snapshot tests updated to expect the v2 canonical shape { version:2, settings:{...DEFAULT_SETTINGS}, events:[...] } — this is a legitimate contract change tied to the schema bump, not a workaround"
  - "BUCKET_CONFIG.defaultCutoverHour stays 4 (D2-17 / Pitfall #2). cutoverHour injection happens at the daysBySubjectiveNight call site, NOT by mutating the constant. This plan does NOT touch day-bucket.js."
  - "createSettingsStore is constructed BEFORE createEventLog in app.js (D2-08 ordering). Both call migrateV1ToV2 independently — the second call is an idempotent v2 passthrough since the first call already produced a v2 in-memory db; the on-disk blob remains untouched until either store writes (D2-05 lazy persist)."
  - "to12h validates h24 is an integer in [0,23] and throws on out-of-range; to24h validates hStr parses to 1..12 and throws on ampm not in {'AM','PM'}. All error messages prefix with the function name for traceability."

metrics:
  duration: ~15 min
  completed: 2026-05-28
  tasks: 2
  commits: 3
  test-delta: "+33 (218 → 251 total; 32 new time-helper tests + 1 Phase 1 snapshot test rewritten to v2 shape)"
  files-modified: 7
  files-created: 0
---

# Phase 2, Plan 03: Composition Root + Time Helpers Summary

**Wired `createSettingsStore` into the composition root on the shared `nightwatch:db` storage instance (D2-08), bumped the event-log schema to v2 with backward-compat migration (T-2-09) and symmetric cross-store race mitigation (T-2-10), and added the three time-format helpers (`formatTime`, `to24h`, `to12h`) that Plans 02-05/02-06 will consume. 251/251 tests green; no Phase 1 regression beyond the legitimate v1→v2 snapshot contract update.**

## Performance

- **Duration:** ~15 minutes wall-clock
- **Completed:** 2026-05-28
- **Tasks:** 2 (Task 1 = schema bump + composition root; Task 2 = time helpers, type="auto tdd")
- **Commits:** 3 (Task 1 GREEN; Task 2 RED → GREEN)
- **Test delta:** 218 → 251 (+33)
- **Files modified:** 7 (no new files; this plan is connective tissue, not new modules)

## Accomplishments

- **Event-log schema bumped from v1 to v2.** `SCHEMA_VERSION = 2`; `migrateV1ToV2(storage.load(), DEFAULT_SETTINGS)` runs before the version check so Phase 1 dogfooders with persisted v1 blobs boot silently into v2 (T-2-09). v3+ blobs still throw `Unsupported schema version: N` (no silent forward-compat downgrade). Fresh installs return the canonical `{version:2, settings:{...defaults}, events:[]}` shape directly.
- **Cross-store race symmetric fix (T-2-10).** `event-log.persist()` now reads the fresh blob from `storage.load()` and copies `fresh.settings` into the in-memory `db` before writing back. This is the mirror of the same pattern in `settings.update()` from Plan 02-02 — neither store can clobber the other's slice in alternating-write scenarios. The existing `cross-store-race.test.js` from Plan 02-02 already exercises both directions and continues to pass.
- **Composition root wires settings.** `js/app.js` imports `createSettingsStore`, constructs it BEFORE `createEventLog` on the SAME `createStorageLocal('nightwatch:db')` instance (D2-08 ordering / shared-blob seam), and forwards `settings` to `mountTodayScreen` so Plan 02-05 can start consuming `cutoverHour` / `groupingMode` without further wiring.
- **`formatTime` / `to24h` / `to12h` exported from `js/lib/time.js`.** String-slice + integer-arithmetic, no `new Date(...)` (Pitfall #3 / DST safety preserved). Explicit conditionals at h24===0 and h24===12 pin the Pitfall #4 boundary regression — naïve modulo math would silently produce "0 AM" / "0 PM" at midnight / noon. The table-driven test covers all 4 boundary hours (0, 1, 12, 23) plus out-of-range and wrong-type guards.
- **Phase 1 snapshot tests updated to the v2 shape.** `tests/integration/event-log.test.js`, `manual-entry.test.js`, `persistence.test.js` — 5 + 1 + 2 = 8 `deepEqual` snapshot assertions now expect `{version:2, settings:{...DEFAULT_SETTINGS}, events:[...]}` rather than the v1 `{version:1, events:[...]}` shape. Helper `v2Snapshot(events)` introduced in event-log.test.js to keep call sites concise. The D-04 invariant text in persistence.test.js was promoted to D-04/D2-04 to reflect the v2 canonical shape.
- **No `day-bucket.js` mutation.** `BUCKET_CONFIG.defaultCutoverHour` stays 4 (D2-17 / Pitfall #2 explicit). The Plan 02-05 wiring will inject the user's cutoverHour at the `daysBySubjectiveNight()` call site in today-screen.js.

## Task Commits

1. **Task 1 — Schema bump + composition root wiring (no separate RED commit):**
   - `b40610d` `feat(NW-02): event-log schema v2 + composition root wires settings store (CFG-08, D2-08, T-2-09, T-2-10)`
     - 5 files changed, +64 / -33. event-log.js + app.js + 3 Phase 1 test snapshot updates landed together because they are a single contract change.
     - The "RED" here is the test failures observed after editing only the source (8 broken Phase 1 snapshots) — those are the same tests that the GREEN commit then updates. Task 1 is `type="auto"` not `type="tdd"`, so no separate RED commit is mandated.

2. **Task 2 — Time helpers (formatTime / to24h / to12h):**
   - RED: `17c25ef` `test(NW-02): red — formatTime / to24h / to12h boundary contract (CFG-09, D2-18, D2-20, Pitfall #4)`
     - +95 lines tests/unit/time.test.js. Fails at import (the three exports do not yet exist).
   - GREEN: `f86c72a` `feat(NW-02): green — formatTime / to24h / to12h helpers (CFG-09, D2-18, D2-20, Pitfall #4 pinned)`
     - +72 lines js/lib/time.js. All 32 new tests pass; full suite 251/251.

## Deviations from Plan

**Total deviations:** 1 (intentional, narrow scope)

**1. Task 1 committed without a separate RED commit.** The plan's Task 1 has `type="auto" tdd="true"` and `<action>` describes the source edits without an explicit "write failing test first" step (the test changes are the snapshot update to the new v2 shape, not new test cases). Treating Task 1 as a single GREEN-only commit is consistent with the plan's `<action>` flow and avoids a misleading RED that doesn't add any new assertion — it would just be the same Phase 1 tests temporarily holding the old expectation. Task 2 — which adds new behavior with new assertions — kept the RED→GREEN split.

## Source Assertions Verified

```
grep -c 'SCHEMA_VERSION = 2' js/store/event-log.js   → 1   ✓
grep -c 'migrateV1ToV2' js/store/event-log.js         → 1   ✓
grep -c 'createSettingsStore' js/app.js               → 2   ✓ (import + construction)
grep -c 'export.*formatTime\|export function formatTime' js/lib/time.js → 1  ✓
grep -c 'export.*to24h\|export function to24h' js/lib/time.js → 1  ✓
grep -c 'export.*to12h\|export function to12h' js/lib/time.js → 1  ✓
grep -c 'defaultCutoverHour = 4' js/lib/day-bucket.js → 1  ✓ (unchanged — D2-17)
npm run test:unit                                      → 251/251 pass  ✓
```

## Known Stubs

- The composition root forwards `settings` to `mountTodayScreen({...settings})` but `today-screen.js` ignores it for now (Plan 02-05 starts consuming).
- `mountHeader` import is NOT yet added to `app.js` — it lands in Plan 02-04 when the header module exists. Adding the import now would break the module graph since `js/ui/header.js` does not exist yet.

## Threat Surface Scan

- **T-2-09** (event-log schema bump): `migrateV1ToV2` runs before the version-check throw. v1 blobs succeed; v3+ throws `Unsupported schema version: N`. The persistence-test schema-version forward-compat tests (`version: 99`, `version: 0`) continue to throw — both numbers are not in `{null, 1, 2}` per migrateV1ToV2's contract.
- **T-2-10** (event-log persist cross-store race): `persist()` re-reads `fresh.settings` from storage before save. Mirrors `settings.update()`. The Plan 02-02 `cross-store-race.test.js` exercises both directions and remains green.
- **T-2-11** (12h boundary math): explicit conditionals + boundary table. Pitfall #4 regression guard in place.
- **T-2-12** (BUCKET_CONFIG mutation temptation): NOT exercised here. Plan 02-05 will inject cutoverHour at the call site, not by mutating the constant.
- **T-2-SC**: no new dependencies (`package.json` `dependencies: {}` unchanged).

## TDD Gate Compliance

Task 2 (the new-behavior task) has RED → GREEN sequence:
- `17c25ef` (RED, +95 lines failing tests/unit/time.test.js)
- `f86c72a` (GREEN, +72 lines js/lib/time.js)

The RED commit was verified to fail at import time (`SyntaxError` style: named imports not found) before GREEN was authored. This satisfies the RED gate.

Task 1 is `type="auto"` (not pure TDD) and ships as a single feat commit per the plan's `<action>` flow.

## Next Phase Readiness

- **Plan 02-04 (header strip + Settings modal)** can start immediately. The composition root already constructs the settings store, so `mountHeader` and `mountSettingsModal` need only accept the `settings` parameter and call `settings.get()` / `settings.update()` / `settings.subscribe()` directly.
- **Plan 02-05 (Today screen day-cutover MVP goal)** can wire the cutoverHour at the `daysBySubjectiveNight()` call site by reading `settings.get().cutoverHour` — composition-root forwarding is already in place.
- **Plan 02-06 (12h/24h propagation)** can consume `formatTime` / `to24h` / `to12h` directly from `js/lib/time.js`.
- 251/251 test suite is the regression baseline for the remaining 3 plans.

## Self-Check: PASSED

**Modified files verified:**
- VERIFIED: js/store/event-log.js — SCHEMA_VERSION === 2, migrateV1ToV2 imported and called
- VERIFIED: js/app.js — createSettingsStore imported, constructed on shared storage
- VERIFIED: js/lib/time.js — formatTime / to24h / to12h exported
- VERIFIED: 3 Phase 1 test files updated for v2 snapshot shape

**Commits verified in git log:**
- FOUND: b40610d (Task 1 GREEN — schema bump + composition root)
- FOUND: 17c25ef (Task 2 RED — time-helper tests)
- FOUND: f86c72a (Task 2 GREEN — time helpers)

**Test suite:**
- FOUND: `npm run test:unit` exits 0 with 251/251 passing
