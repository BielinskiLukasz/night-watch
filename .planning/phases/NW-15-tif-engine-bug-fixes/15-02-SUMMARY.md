---
phase: NW-15
plan: "02"
subsystem: metrics-screen / test-suite
status: complete
tags:
  - bug-fix
  - tif
  - metrics-screen
  - test-quality
dependency_graph:
  requires:
    - NW-15-01
  provides:
    - FIX-03
    - FIX-04
    - FIX-05
  affects:
    - js/ui/metrics-screen.js
    - tests/unit/settings-validate.test.js
tech_stack:
  added: []
  patterns:
    - redundant-call-removal
    - comment-accuracy
    - test-description-alignment
key_files:
  created: []
  modified:
    - js/ui/metrics-screen.js
    - tests/unit/settings-validate.test.js
decisions:
  - FIX-03: tifForecast import removed entirely from metrics-screen.js; trimmedMinMax retained
  - FIX-04: comment updated to clarify both bare HH:MM and ISO string inputs are handled
  - FIX-05: test description corrected from '31' to '91' to match test body value
metrics:
  duration: 14
  completed: "2026-08-31T13:20:56Z"
  tasks_completed: 3
  commits: 3
estimate:
  tokens: 22000
actuals:
  tokens: 4000
  tasks: 3
  commits: 3
requirements:
  - FIX-03
  - FIX-04
  - FIX-05
---

# Phase 15 Plan 02: Metrics-Screen Cleanup & Test Fix Summary

**One-liner:** Removed redundant tifForecast double-invocation from render(), corrected computeTifTrimmedStats comment, fixed stale test description for tifRollingDays upper bound.

## What Was Built

Three targeted cleanup fixes to `js/ui/metrics-screen.js` and `tests/unit/settings-validate.test.js`:

- **FIX-03:** Deleted the 22-line conditional block inside `render()` that called `tifForecast` a second time to override event-time columns in `tifTrimmedStats`. The override was redundant because `computeTifTrimmedStats` already computes the correct trimmed statistics. Removed `tifForecast` from the import statement (now unused); `trimmedMinMax` retained.

- **FIX-04:** Replaced a one-line comment in `computeTifTrimmedStats` ("`rows store full ISO strings; extract HH:MM`") with a three-line comment that explains metric rows may carry bare `HH:MM` strings OR full ISO strings, and that the `raw.length > 5` guard is live code that handles both forms — preventing future maintainers from treating the guard as dead code.

- **FIX-05:** Corrected the `it()` description for the `tifRollingDays` upper-bound test from `'rejects 31 (above max=90)'` to `'rejects 91 (above max=90)'`. The test body already used `tifRollingDays: 91`; only the description string was stale.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove redundant tifForecast call from render() (FIX-03) | 94a7c01 | js/ui/metrics-screen.js |
| 2 | Fix misleading comment in computeTifTrimmedStats (FIX-04) | 8c4e337 | js/ui/metrics-screen.js |
| 3 | Fix stale tifRollingDays test description (FIX-05) | 3d05b31 | tests/unit/settings-validate.test.js |

## Verification Results

- `grep -c 'tifForecast' js/ui/metrics-screen.js` → 0 (import and all call sites removed)
- `trimmedMinMax` still imported and used in two places inside `computeTifTrimmedStats`
- Updated comment in `computeTifTrimmedStats` correctly describes both bare HH:MM and ISO string inputs
- `raw.length > 5 ? raw.slice(11) : raw` guard unchanged in the source
- Test description for tifRollingDays upper bound reads exactly `'rejects 91 (above max=90) in mode:\'save\''`
- `npm run test:unit` → 756 tests, 0 failures (verified after each task)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only removes code, updates a comment, and fixes a test description string. No new threat surface.

## Self-Check

- [x] `js/ui/metrics-screen.js` modified with redundant block removed and comment updated
- [x] `tests/unit/settings-validate.test.js` modified with corrected test description
- [x] Commit 94a7c01 exists
- [x] Commit 8c4e337 exists
- [x] Commit 3d05b31 exists
- [x] Unit test suite: 756 pass, 0 fail

## Self-Check: PASSED
