---
phase: 25-algorithm-c-settings-modal
plan: 03
subsystem: schema-validation
tags: [settings, schema-migration, validation, algorithm-c]
requires:
  - phase: 25-algorithm-c-settings-modal
    provides: forecast-blend.js reads settings.blendWindowDays/blendTrimPct/blendShrinkage (Plans 25-01/25-02)
provides:
  - DEFAULT_SETTINGS.blendWindowDays (90), .blendTrimPct (25), .blendShrinkage (0.3)
  - Additive v2 forward-compat migration for all three fields
  - RULES.blendWindowDays/.blendTrimPct/.blendShrinkage range validation
  - RULES.forecastAlgorithm 'blend' enum member
  - checkField's new 'number' rule-type case (first float-permitting validator)
affects: [25-04-settings-modal-ui, forecast-blend]
actuals:
  tokens: 5860
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - "float-permitting validator case ('number', Number.isFinite) alongside existing integer-only case (Number.isInteger)"
key-files:
  created: []
  modified:
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - tests/unit/db-shape.test.js
    - tests/unit/settings-validate.test.js
key-decisions:
  - "Followed the exact tifRollingDays forward-compat idiom (`!('field' in blob.settings)`) for all 3 new fields — no schema version bump needed"
  - "checkField's new 'number' case is a near-copy of 'integer' with Number.isFinite substituted for Number.isInteger — kept intentionally minimal to avoid new coercion surface"
requirements-completed: [UI-12]
coverage:
  - id: D1
    description: "DEFAULT_SETTINGS gains blendWindowDays=90/blendTrimPct=25/blendShrinkage=0.3, now 25 keys"
    requirement: "UI-12"
    verification:
      - kind: unit
        ref: "tests/unit/db-shape.test.js#DEFAULT_SETTINGS"
        status: pass
    human_judgment: false
  - id: D2
    description: "migrateV1ToV2 additive injection + non-clobber contract for all 3 fields"
    requirement: "UI-12"
    verification:
      - kind: unit
        ref: "tests/unit/db-shape.test.js#migrateV1ToV2 — Phase 25 blend-settings injection"
        status: pass
    human_judgment: false
  - id: D3
    description: "RULES entries + forecastAlgorithm 'blend' enum member + new 'number' checkField case"
    requirement: "UI-12"
    verification:
      - kind: unit
        ref: "tests/unit/settings-validate.test.js#validateSettings — blendWindowDays/blendTrimPct/blendShrinkage"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-09-18
status: complete
---

# Phase 25 Plan 3: Algorithm C Settings Schema & Validation Summary

**Added blendWindowDays/blendTrimPct/blendShrinkage to DEFAULT_SETTINGS and RULES with a new float-permitting validator case, closing the gap where Algorithm C's blend arithmetic would otherwise read `undefined` from every real user's settings.**

## Performance
- **Duration:** 20min
- **Started:** 2026-09-18T11:28:08Z (approx, per STATE.md session record)
- **Completed:** 2026-09-18T11:40:40Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `DEFAULT_SETTINGS` now carries all three Algorithm C settings with NEW_ALG.md-matching defaults (90-day window, 25% trim, 0.3 shrinkage), and the v2 forward-compat migration injects them per-field for any pre-Phase-25 blob without a schema version bump.
- `settings-validate.js` gained a brand-new `'number'` rule type (float-permitting via `Number.isFinite`) distinct from the existing integer-only `'integer'` case — required because `blendShrinkage` is the app's first fractional-range setting (0.0–1.0).
- `forecastAlgorithm`'s enum now accepts `'blend'` end-to-end (schema default type + validator), unblocking Plan 25-04's UI wiring.
- Both pre-existing `validFields` test fixtures (stages/D6-01, activeStageId/D6-02) were repaired with the 3 new required fields, preventing a silent regression the moment RULES grew to 25 entries.

## Task Commits
1. **Task 1 RED: failing tests for blend settings in db-shape** - `3255875` (test)
2. **Task 1 GREEN: DEFAULT_SETTINGS + migration** - `6194531` (feat)
3. **Task 2 RED: failing tests for blend settings validation** - `fbaa6d1` (test)
4. **Task 2 GREEN: RULES + 'number' case** - `8c2a65f` (feat)

## Files Created/Modified
- `js/lib/db-shape.js` - DEFAULT_SETTINGS gains 3 fields (25 total keys); migrateV1ToV2 gains 3 additive forward-compat blocks
- `js/lib/settings-validate.js` - RULES gains 3 entries (25 total keys) + 'blend' enum member; checkField gains `case 'number':`
- `tests/unit/db-shape.test.js` - key-count assertion updated to 25; 3 new default-value tests; new describe block with 7 migration tests
- `tests/unit/settings-validate.test.js` - key-count assertions updated to 25 (x2); both `validFields` fixtures repaired; 'blend' acceptance test; 3 new describe blocks (blendWindowDays/blendTrimPct/blendShrinkage) covering boundaries, out-of-range rejection, type rejection, and mode:'load' lenient reset

## Decisions Made
- Matched the file's existing forward-compat idiom exactly (`!('field' in blob.settings)`, not `hasOwnProperty`) for consistency with `tifRollingDays`/`eveningHour`/`trimPct` precedent.
- Kept `case 'number':` a minimal diff from `case 'integer':` (only the finiteness check differs) to avoid introducing new coercion behavior beyond what the existing integer case already accepts via `Number(raw)`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 25-04 (Settings Modal UI) can now safely wire `blendWindowDays`/`blendTrimPct`/`blendShrinkage` form fields and the three-way `forecastAlgorithm` selector — both `DEFAULT_SETTINGS` and `RULES` fully support `'blend'` end-to-end.
- `forecast-blend.js` (Plans 25-01/25-02) will no longer read `undefined` for these three settings once this migration path runs on load.
- No blockers.

---
*Phase: 25-algorithm-c-settings-modal*
*Completed: 2026-09-18*

## Self-Check: PASSED
