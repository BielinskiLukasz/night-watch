---
phase: 02-configuration-settings
plan: "01"
subsystem: pure-logic
tags: [vanilla-js, esm, node-test, tdd, cfg-01, cfg-02, cfg-03, cfg-04, cfg-06, cfg-07, cfg-08, cfg-09, d2-03, d2-05, d2-21, d2-22, d2-23]

requires:
  - 01-01 (walking skeleton — composition root, node:test scaffold, storage adapter seam)
  - 01-02 (TDD pure logic — time.js, day-bucket.js, id.js patterns)

provides:
  - js/lib/db-shape.js — DEFAULT_SETTINGS (D2-03) frozen constant + migrateV1ToV2 pure function
  - js/lib/settings-validate.js — validateSettings two-mode validator + RULES frozen constant
  - TDD test coverage: 67 new assertions (16 db-shape + 51 settings-validate)

affects:
  - 02-02 (settings store — imports migrateV1ToV2 + DEFAULT_SETTINGS from db-shape.js)
  - 02-03 (settings modal UI — imports validateSettings from settings-validate.js)
  - All later plans that consume settings (Phase 3 forecast engine, Phase 5 import/export)

tech-stack:
  added: []
  patterns:
    - "DEFAULT_SETTINGS in db-shape.js (not settings.js) — breaks circular import risk (RESEARCH §Pattern F)"
    - "Object.freeze on RULES constant (all 9 field descriptors, type+bounds per D2-21)"
    - "validateSettings two-mode pattern: mode:'save' strict (errors[]) vs mode:'load' lenient (default+warn)"
    - "checkField dispatcher: string/integer/boolean/enum rule types via switch"
    - "migrateV1ToV2 idempotent: null→fresh-v2, v1→inject-defaults, v2→passthrough, v3+→throw"
    - "console.info('[nightwatch] migrating...') on v1→v2 (D2-05 diagnostics)"
    - "console.warn('[nightwatch] settings.{field} invalid...') per invalid field in mode:'load' (D2-22)"

key-files:
  created:
    - js/lib/db-shape.js (DEFAULT_SETTINGS frozen constant + migrateV1ToV2 pure function; zero imports from other project files)
    - js/lib/settings-validate.js (validateSettings + RULES; imports DEFAULT_SETTINGS from db-shape.js only)
    - tests/unit/db-shape.test.js (16 assertions — null/undefined/v1/v2/v3+ migration + DEFAULT_SETTINGS frozen + 9 key values)
    - tests/unit/settings-validate.test.js (51 assertions — all 9 fields both modes + RULES frozen + multi-error collection)
  modified: []

key-decisions:
  - "DEFAULT_SETTINGS placed in db-shape.js to break the settings.js ↔ settings-validate.js circular import"
  - "RULES values Set objects (new Set([...])) embedded inside the frozen RULES record — values are mutable but RULES entries are not reassignable; this matches the RESEARCH §Pattern F recommendation"
  - "mode:'load' resets invalid fields to defaults silently per D2-22; mode:'save' accumulates all errors before returning (no early exit) per Plan 01-07 validate() pattern"
  - "CFG-05 deferred to Phase 4 per D2-01 — documented in plan frontmatter as coverage-gate owner; no code written for it"

metrics:
  duration: ~12 min
  completed: 2026-05-28
  tasks: 2
  commits: 4
  test-delta: "+67 (125 → 192 total; 16 db-shape + 51 settings-validate)"
  files-created: 4
---

# Phase 2, Plan 01: Pure-Logic TDD (db-shape + settings-validate) Summary

**Two pure-logic modules — migrateV1ToV2 + DEFAULT_SETTINGS in db-shape.js and validateSettings two-mode validator in settings-validate.js — landed via strict RED→GREEN TDD; 67 new assertions, 192/192 total pass.**

## Performance

- **Duration:** ~12 minutes wall-clock
- **Completed:** 2026-05-28
- **Tasks:** 2 (both `type="tdd"`)
- **Commits:** 4 (2 RED, 2 GREEN)
- **Test delta:** 125 → 192 (+67)
- **Files created:** 4

## Accomplishments

- **DEFAULT_SETTINGS Object.freeze'd with all 9 D2-03 values.** Placed in `js/lib/db-shape.js` (neutral module) to break the circular import risk: `settings.js` imports `validateSettings`, and `settings-validate.js` needed `DEFAULT_SETTINGS`. Putting defaults in `db-shape.js` lets both importers resolve cleanly.
- **migrateV1ToV2 handles all migration scenarios.** null/undefined → fresh v2 blob; v1 → inject defaults + preserve events + console.info; v2 → idempotent same-reference passthrough; v3+ → throws `Unsupported schema version: N`. Pure function, zero imports from other project files.
- **validateSettings two-mode pure validator.** mode:'save' collects all errors before returning (no early exit) — mirrors Plan 01-07's validate() shape. mode:'load' resets each invalid field to its default and emits `console.warn('[nightwatch] settings.{field} invalid ...; using default ...')` per D2-22.
- **RULES frozen constant covers all 9 fields.** Includes correct type + bounds per D2-21: subjectName (string, trim, maxLen 40), cutoverHour (integer [0,23]), groupingMode (enum {calendar, sleepCycle}), timeFormat (enum {24h, 12h}), autoOutlier (boolean), maxDelta (integer [5,120]), minDays (integer [1,90]), windowDays (integer [3,90]), statBlend (enum {median, mean, blend}).
- **No regressions.** 125 Phase 1 tests continue to pass; security-smoke.test.js (D-07 storage-seam guard) passes after a documentation comment was reworded to avoid the literal 'localStorage' token.
- **CFG-05 deferral documented.** Plan frontmatter flags the deferral so the requirements coverage gate does not treat it as a silent drop.

## Task Commits

1. **Task 1 — db-shape.js (migrateV1ToV2 + DEFAULT_SETTINGS):**
   - RED: `4e649e8` `test(NW-02): red — db-shape.js migration contract`
     - Failed at import (js/lib/db-shape.js did not exist)
   - GREEN: `64f6fe6` `feat(NW-02): green — migrateV1ToV2 + DEFAULT_SETTINGS (CFG-08, D2-05)`
     - Created db-shape.js; all 16 tests pass; full suite 141/141 pass

2. **Task 2 — settings-validate.js (validateSettings, two modes, all 9 fields):**
   - RED: `a14fc09` `test(NW-02): red — settings-validate.js contract (CFG-01..04, CFG-06..09)`
     - Failed at import (js/lib/settings-validate.js did not exist)
   - GREEN: `9d98fbb` `feat(NW-02): green — validateSettings two-mode pure validator (D2-21, D2-22, D2-23)`
     - Created settings-validate.js; all 51 tests pass; full suite 192/192 pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded documentation comment to avoid 'localStorage' literal flagged by security-smoke.test.js**
- **Found during:** Task 1 GREEN verification (post-implementation full-suite run)
- **Issue:** `db-shape.js` doc-comment originally read "Normalize a raw localStorage blob to the canonical v2 shape." The security-smoke test (D-07 storage-seam invariant) flags ANY `localStorage` literal outside `js/adapters/storage-local.js`, including documentation comments. This is documented behavior — the comment in the test says "Even comments mentioning `localStorage` outside the adapter are flagged."
- **Fix:** Rewrote the doc-comment to "Normalize a raw storage blob to the canonical v2 shape." — functionally equivalent, no literal match.
- **Files modified:** js/lib/db-shape.js (1 word changed in doc-comment)
- **Folded into GREEN commit** `64f6fe6`

---

**Total deviations:** 1 auto-fixed (documentation phrasing; zero functional impact)
**Impact on plan:** None. All acceptance criteria satisfied.

## Source Assertions Verified

```
grep -c 'Object.freeze' js/lib/db-shape.js  → 2 ≥ 1  ✓
grep -c 'migrateV1ToV2' js/lib/db-shape.js  → 1 ≥ 1  ✓
grep -c 'validateSettings' js/lib/settings-validate.js → 2 ≥ 1  ✓
grep -c 'db-shape' js/lib/settings-validate.js → 3 ≥ 1  ✓  (imports from db-shape.js, no self-import cycle)
node -e "import('./js/lib/db-shape.js').then(m=>{console.log(Object.isFrozen(m.DEFAULT_SETTINGS))})" → true  ✓
```

## Known Stubs

None. Both modules are complete pure-logic implementations at Phase 2 Plan 01 scope. No placeholder values, no hardcoded returns, no TODO markers that would prevent the plan's goal from being achieved.

## Threat Surface Scan

No new security surface introduced. Both modules are pure-logic with no network endpoints, no DOM access, no file I/O, and no auth paths. The threat mitigations from the plan's STRIDE register are implemented:

- T-2-01: validateSettings mode:'save' enforces strict bounds on all 9 fields per RULES.
- T-2-02: validateSettings mode:'load' resets invalid fields to defaults with console.warn — corrupt blob never crashes app, never silently preserves invalid value.
- T-2-03: migrateV1ToV2 throws on version ≥ 3; treats null/undefined as fresh install (safe); v1→v2 is idempotent.
- T-2-04: DEFAULT_SETTINGS is Object.freeze'd — mutation attempts throw in strict mode; callers receive spread copies via migrateV1ToV2.
- T-2-SC: No new packages installed — node:test built-in only.

## TDD Gate Compliance

Plan type is `tdd`. Verification:

- Task 1: `test(NW-02)` 4e649e8 → `feat(NW-02)` 64f6fe6 — RED→GREEN ✓
- Task 2: `test(NW-02)` a14fc09 → `feat(NW-02)` 9d98fbb — RED→GREEN ✓

Both RED commits were confirmed to fail at import (module not found) before GREEN was authored. This satisfies the RED gate — tests could not pass because the implementation did not exist.

## Next Phase Readiness

- **Plan 02-02 (settings store)** can start immediately. It imports `migrateV1ToV2` and `DEFAULT_SETTINGS` from `db-shape.js` and `validateSettings` from `settings-validate.js` — both contracts are now locked and tested.
- **Plan 02-03 (settings modal UI)** imports `validateSettings` from `settings-validate.js` for the Save handler — contract ready.
- The 192/192 test suite provides a regression baseline for all subsequent Phase 2 plans.

## Self-Check: PASSED

**Created files verified to exist:**
- FOUND: js/lib/db-shape.js
- FOUND: js/lib/settings-validate.js
- FOUND: tests/unit/db-shape.test.js
- FOUND: tests/unit/settings-validate.test.js

**Commits verified in git log:**
- FOUND: 4e649e8 (RED db-shape)
- FOUND: 64f6fe6 (GREEN db-shape)
- FOUND: a14fc09 (RED settings-validate)
- FOUND: 9d98fbb (GREEN settings-validate)

**Test suite:**
- FOUND: `node --test` exits 0 with 192/192 passing
