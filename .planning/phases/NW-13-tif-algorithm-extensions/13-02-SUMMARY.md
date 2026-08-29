---
phase: NW-13
plan: "02"
subsystem: forecast-tif
tags: [tif, algorithm, median, tdd]
requirements: [TIF-15]
depends_on: []
provides: [per-window-median, median-central-time]
affects: [js/lib/forecast-tif.js, tests/unit/forecast-tif.test.js]
tech_stack:
  added: []
  patterns: [tdd-red-green-refactor, additive-return-shape]
key_files:
  modified:
    - js/lib/forecast-tif.js
    - tests/unit/forecast-tif.test.js
decisions:
  - "trimmedMinMax returns { min, max, median } — median is P50 of trimmed array; odd: middle element, even: avg of two middle"
  - "buildHistoricBand gains median automatically via trimmedMinMax spread — no body changes"
  - "buildDurationBand median = anchorMinutes + result.median (from trimmedMinMax on sorted durations)"
  - "buildPrediction central = avg(window medians) when >= 1 window has non-null median; falls back to midpoint"
  - "Existing deepStrictEqual tests updated to include median field — 7 test cases updated in GREEN phase"
  - "Wake window 2 (Sleep-length) and window 3 (combined) carry wrapToDay(sleepBandRaw.median) and wrapToDay(combinedBandRaw.median - todayNapDuration)"
metrics:
  duration_minutes: 8
  completed_date: "2026-08-27"
  tasks: 3
  commits: 3
estimate:
  tokens: 5000
actuals:
  tokens: 4800
  tasks: 3
  commits: 3
status: complete
---

# Phase 13 Plan 02: Per-Window Median (TIF-15) Summary

Per-window median computation added to trimmedMinMax, buildDurationBand, and buildPrediction via strict TDD RED/GREEN/REFACTOR cycle; central time is now average of source-window medians instead of midpoint of display range.

## What Was Built

**TIF-15 implementation** — every band-builder function now returns a `median` field alongside `min` and `max`:

- `trimmedMinMax(values, trimPct, manualExcludedCount)` → `{ min, max, median }` where `median` is P50 of the trimmed array (middle element for odd-length, average of two middle elements for even-length)
- `buildHistoricBand` — no body changes; inherits `median` automatically via `trimmedMinMax` spread
- `buildDurationBand` → `{ min, max, median }` where `median = anchorMinutes + result.median`
- Wake windows 2 and 3 (Sleep-length band, Sleep+nap combined band) explicitly carry `median` with `wrapToDay()` applied
- `buildPrediction` central time = `minutesToTime(avg(window medians))` when at least one window has a non-null median; falls back to midpoint of display range otherwise
- `sourceWindows` entries carry `median: 'HH:MM' | null` for potential future UI rendering (Phase 14 scope per CONTEXT.md)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — failing tests | `f8a132e` | 5 new tests fail, 9 existing pass |
| GREEN — implementation | `05f074e` | 15/15 unit + 10/10 integration pass |
| REFACTOR — JSDoc | `e78418a` | 712/712 unit tests pass |

## Commits

| Phase | Hash | Message |
|-------|------|---------|
| RED | `f8a132e` | test(NW-13-02): add failing tests for TIF-15 per-window median |
| GREEN | `05f074e` | feat(NW-13-02): extend trimmedMinMax/buildDurationBand/buildPrediction with per-window median (TIF-15) |
| REFACTOR | `e78418a` | refactor(NW-13-02): document median in trimmedMinMax, buildDurationBand, buildPrediction JSDoc |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical update] Updated 7 existing unit tests to include `median` in expected objects**
- **Found during:** GREEN phase
- **Issue:** Existing tests used `deepStrictEqual({ min, max })` which fails once `trimmedMinMax` returns `{ min, max, median }` — adding `median` to the return shape is an additive change but `deepStrictEqual` checks object shape exactly
- **Fix:** Updated all 7 non-null `deepStrictEqual` assertions in the original `trimmedMinMax` describe block to include computed `median` values. Verified each expected median mathematically (comments added to test cases)
- **Files modified:** `tests/unit/forecast-tif.test.js`
- **Commit:** `05f074e` (GREEN phase)

## Success Criteria Checklist

- [x] trimmedMinMax returns { min, max, median } for all non-null results; null case unchanged
- [x] buildHistoricBand result includes median (inherited from trimmedMinMax, no body changes)
- [x] buildDurationBand result includes median = anchorMinutes + P50(sorted durations)
- [x] buildPrediction.central = minutesToTime(avg(medians)) when >= 1 window has median
- [x] Every sourceWindows entry has a `median` field ('HH:MM' string or null)
- [x] All existing trimmedMinMax tests still pass (min/max values unchanged)
- [x] All integration tests still pass (10/10)
- [x] npm run test:unit exits 0 (712/712 pass)
- [x] 3 commits created (RED / GREEN / REFACTOR)

## Known Stubs

None. All TIF-15 requirements are fully implemented.

## Threat Flags

None. This is a pure algorithm change inside `js/lib/forecast-tif.js` — no new network endpoints, auth paths, file access, or schema changes.

## Self-Check

Files confirmed present:
- js/lib/forecast-tif.js (modified with median support)
- tests/unit/forecast-tif.test.js (updated with new + updated tests)

Commits confirmed:
- f8a132e — RED
- 05f074e — GREEN
- e78418a — REFACTOR
