---
phase: NW-06-life-stages
plan: "01"
subsystem: settings-schema
tags: [tdd, schema, migration, validation, settings]
dependency_graph:
  requires: []
  provides:
    - DEFAULT_SETTINGS.stages (D6-01)
    - DEFAULT_SETTINGS.activeStageId (D6-02)
    - migrateV1ToV2 Phase 6 forward-compat injection
    - validateSettings stage[] and null-or-string rule types
  affects:
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN (node:test)
    - Object.freeze for RULES extension
    - Forward-compat field injection in migrateV1ToV2
key_files:
  created: []
  modified:
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - tests/unit/db-shape.test.js
    - tests/unit/settings-validate.test.js
decisions:
  - "stages and activeStageId injected in migrateV1ToV2 v2-passthrough only (not v1/fresh paths which get DEFAULT_SETTINGS spread automatically)"
  - "null-or-string type normalizes both null and undefined to null, enabling load-mode recovery without warnings for absent activeStageId"
  - "stage[] validates each item structurally (id, name, startDate required; endDate string|null) without date-format enforcement per D4-14 precedent"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-29T18:07:00Z"
  tasks_completed: 2
  files_modified: 4
requirements_completed: [STAGE-01, STAGE-02]
---

# Phase NW-06 Plan 01: Stage Settings Schema Summary

**One-liner:** DEFAULT_SETTINGS and migrateV1ToV2 extended with stages/activeStageId fields; validateSettings gains stage[] and null-or-string rule types via strict TDD RED→GREEN.

## What Was Built

### db-shape.js
- Added `stages: []` (D6-01) and `activeStageId: null` (D6-02) to `DEFAULT_SETTINGS` after `statBlend`
- Updated JSDoc `@type` annotation to include both new fields with their types
- Added Phase 6 forward-compat injection block in `migrateV1ToV2` v2-passthrough branch:
  - Injects `stages: []` when `blob.settings.stages` is absent or non-array
  - Injects `activeStageId: null` when `activeStageId` key is absent from `blob.settings`
  - Preserves existing `stages` arrays unchanged (no clobber)
- Fresh-install (blob === null) and v1-migration paths automatically correct — both spread `{ ...defaultSettings }` which now includes the new fields

### settings-validate.js
- Added `stages: { type: 'stage[]' }` and `activeStageId: { type: 'null-or-string' }` to `RULES`
- Added `case 'stage[]'` in `checkField` switch:
  - Rejects non-arrays
  - Validates each item: must be a non-null object, with non-empty string `id`, `name`, `startDate`; `endDate` must be string or null
- Added `case 'null-or-string'` in `checkField` switch:
  - null and undefined both normalize to null (ok: true)
  - Rejects non-string, non-null values (e.g., numbers)
  - Accepts any string value

### Test coverage added
- **db-shape.test.js**: 5 new tests covering DEFAULT_SETTINGS defaults, v2 passthrough injection, v2 passthrough non-clobber, v1 migration, fresh install
- **settings-validate.test.js**: 11 new tests covering RULES/normalized key counts, all stages accept/reject cases, all activeStageId accept/reject/normalize cases

## Tasks Completed

| # | Name | Type | Commit |
|---|------|------|--------|
| 1 | RED — failing tests for stages/activeStageId | test | `69eb86c` |
| 2 | GREEN — patch db-shape.js and settings-validate.js | feat | `a086057` |

## Test Results

- db-shape.test.js: **34/34 pass**, 0 fail
- settings-validate.test.js: **62/62 pass**, 0 fail
- Zero regressions on pre-existing tests

## Deviations from Plan

None — plan executed exactly as written.

The one noteworthy observation: the `valid()` helper in settings-validate.test.js spreads `DEFAULT_SETTINGS`, which means once GREEN lands, the helper automatically includes `stages` and `activeStageId`. New test cases use an inline `validFields` constant to be explicit about Phase 6 fields, keeping tests self-documenting regardless of DEFAULT_SETTINGS evolution.

## TDD Gate Compliance

- RED gate: `test(06-01)` commit `69eb86c` — new tests failed, pre-existing passed
- GREEN gate: `feat(06-01)` commit `a086057` — all 96 tests pass

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or trust boundaries introduced. All changes are pure in-memory schema and validator logic. Threat register items T-06-01-01 and T-06-01-02 mitigated: validateSettings mode:'load' resets invalid stages to [] via default; activeStageId fallback to null handled by null-or-string normalizer.

## Self-Check: PASSED

- `js/lib/db-shape.js` modified: FOUND
- `js/lib/settings-validate.js` modified: FOUND
- `tests/unit/db-shape.test.js` modified: FOUND
- `tests/unit/settings-validate.test.js` modified: FOUND
- RED commit `69eb86c`: FOUND
- GREEN commit `a086057`: FOUND
- All tests pass: CONFIRMED (34 + 62 = 96 tests, 0 failures)
