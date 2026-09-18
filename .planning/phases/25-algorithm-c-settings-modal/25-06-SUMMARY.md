---
phase: 25-algorithm-c-settings-modal
plan: 06
subsystem: ui
tags: [settings, forms, e2e, playwright, gap-closure]

# Dependency graph
requires:
  - phase: 25-algorithm-c-settings-modal
    provides: "Plans 25-01..25-05 shipped Algorithm C (blendForecast) and the three-way Settings modal selector; 25-VERIFICATION.md/25-REVIEW.md flagged the orphan noNapBedtimeOffsetMinutes field as CR-01, blocking phase sign-off"
provides:
  - "index.html's Forecast & Prediction fieldset with the orphan noNapBedtimeOffsetMinutes <label>/<input> removed"
  - "js/ui/settings-modal.js populateForm()/onClose Save handler with both dead read/write call sites removed"
  - "Playwright regression test proving the field has zero DOM presence across a full Save -> reload cycle"
affects: [25-VERIFICATION, 25-REVIEW]

# Actuals (#2632)
actuals:
  tokens: 1800
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - index.html
    - js/ui/settings-modal.js
    - tests/e2e/settings-modal.spec.js

key-decisions:
  - "No new decisions — pure subtraction of already-orphaned UI surface per D-10 (Phase 19), which this plan honors and does not reverse."

patterns-established: []

requirements-completed: [UI-12]

coverage:
  - id: D1
    description: "noNapBedtimeOffsetMinutes input and its two settings-modal.js glue-code call sites (populateForm read, onClose Save extraction) fully removed — grep across index.html and js/ui/settings-modal.js returns zero matches"
    requirement: "UI-12"
    verification:
      - kind: unit
        ref: "node --test tests/unit/db-shape.test.js tests/unit/settings-validate.test.js — 187/187 pass"
        status: pass
      - kind: e2e
        ref: "tests/e2e/settings-modal.spec.js#CR-01 gap-closure: noNapBedtimeOffsetMinutes input no longer exists, and eveningHour still round-trips correctly (25-06)"
        status: pass
      - kind: other
        ref: "grep -n noNapBedtimeOffsetMinutes index.html js/ui/settings-modal.js (exit 1, zero matches)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sibling eveningHour field (directly adjacent to the removed block) still round-trips correctly through Save -> reload, proving the edit was surgical"
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-modal.spec.js#CR-01 gap-closure: noNapBedtimeOffsetMinutes input no longer exists, and eveningHour still round-trips correctly (25-06)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-18
status: complete
---

# Phase 25 Plan 06: Orphan Field Removal (CR-01 Gap-Closure) Summary

**Removed the dead `noNapBedtimeOffsetMinutes` input and its two settings-modal.js glue-code call sites, closing the Phase 19-originated / Phase 25-carried CR-01 silent-data-loss defect, with a new Playwright regression test proving the fix.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-18T13:32:00Z
- **Completed:** 2026-09-18T13:36:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Deleted the orphan `<label>No-nap bedtime offset (min)</label>` block from `index.html`'s Forecast & Prediction fieldset — the `eveningHour` and `targetSleepMinutes` labels are now direct adjacent siblings.
- Deleted `js/ui/settings-modal.js`'s `noNapOffsetEl` population lines (`populateForm`) and the `noNapBedtimeOffsetMinutes` key from the `onClose` Save handler's `raw` object literal.
- Added a new Playwright regression test (`CR-01 gap-closure`) asserting `toHaveCount(0)` for the removed input both before AND after a full Save -> reload cycle, and that `eveningHour` still round-trips to a non-default value.
- Confirmed `js/lib/db-shape.js` and `js/lib/settings-validate.js` were untouched — D-10 (Phase 19)'s removal decision is honored, not reversed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the orphan noNapBedtimeOffsetMinutes input and its glue code (CR-01)** - `aadee08` (fix)
2. **Task 2: E2E regression test proving removal and fieldset integrity** - `d8fd33e` (test)

_Note: no TDD red/green split — these are `type="auto"` tasks per plan frontmatter._

## Files Created/Modified
- `index.html` - Removed the 5-line orphan `<label>`/`<input id="noNapBedtimeOffsetMinutes">` block from the Forecast & Prediction fieldset.
- `js/ui/settings-modal.js` - Removed `noNapOffsetEl` population (2 lines) in `populateForm()` and the `noNapBedtimeOffsetMinutes` key (1 line) from the `onClose` Save handler's `raw` object literal.
- `tests/e2e/settings-modal.spec.js` - Added the `CR-01 gap-closure` regression test between the existing CFG-02..04/06..07 round-trip test and the a11y test.

## Decisions Made
None — plan executed exactly as written. No new architectural decisions; this is a pure subtraction of dead UI surface honoring Phase 19's D-10.

## Deviations from Plan

None - plan executed exactly as written. `git diff` confirmed exactly one contiguous 5-line block removed in `index.html` and exactly three lines removed in `js/ui/settings-modal.js` (two in `populateForm`, one in `onClose`'s `raw` object), matching the plan's acceptance criteria verbatim.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Verification Evidence

- `grep -n noNapBedtimeOffsetMinutes index.html js/ui/settings-modal.js` → exit 1, zero matches (both files clean; field only remains in test files that assert its absence: `db-shape.test.js`, `settings-validate.test.js`, `forecast.test.js`).
- `node --test tests/unit/db-shape.test.js tests/unit/settings-validate.test.js` → 187/187 pass (both suites untouched and green, per the plan's kept prohibition against reversing D-10).
- `npx playwright test tests/e2e/settings-modal.spec.js` → 16/16 pass (15 pre-existing + 1 new `CR-01 gap-closure` test).
- `npm run test:unit` (full baseline) → 959/959 pass — matches 25-VERIFICATION.md's pre-existing baseline exactly, confirming zero unit-level regression.
- `npx playwright test` (full suite) → 150/150 pass — the prior 149 plus this plan's 1 new test, matching the plan's `<verification>` expectation exactly.

## Next Phase Readiness

25-VERIFICATION.md's gap 1 (CR-01, originally 19-REVIEW.md CR-01) is now closed. The phase's second remaining gap — WR-01 (missing `wrapToDay()` normalization in `forecast-blend.js`'s nap-start/nap-end wake-anchored models) — is NOT addressed by this plan and remains open; it is out of this plan's declared scope (see plan frontmatter `must_haves.prohibitions` and the Source Coverage Audit table). A separate gap-closure plan is expected to close WR-01 before Phase 25 can be fully signed off.

## Self-Check: PASSED

- FOUND: `.planning/phases/25-algorithm-c-settings-modal/25-06-SUMMARY.md`
- FOUND: commit `aadee08` (Task 1)
- FOUND: commit `d8fd33e` (Task 2)

---
*Phase: 25-algorithm-c-settings-modal*
*Completed: 2026-09-18*
