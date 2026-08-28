---
phase: quick-260828-ikl
plan: "01"
subsystem: metrics-screen
tags: [metrics, tif, aggregate-rows, trimmed-stats]
status: complete

dependency_graph:
  requires: []
  provides: [MET-11]
  affects: [js/ui/metrics-screen.js]

tech_stack:
  added: []
  patterns: [trimmedMinMax per-column, rolling-window with rejected-row exclusion]

key_files:
  created: []
  modified:
    - js/ui/metrics-screen.js

decisions:
  - computeTifTrimmedStats operates on rows[] (oldest-first from aggregateMetrics), not tifBoundsArray
  - trimmedMinMax called with manualExcludedCount=0 (no manual exclusions at aggregate level)
  - isTime columns converted to/from minutes for sort+trim; duration/ratio columns sorted numerically
  - formatCellValue used in buildTifAggregateRow — consistent with classic aggregate rows

metrics:
  duration: 8
  completed: 2026-08-28
  tasks_completed: 1
  commits: 1

actuals:
  tokens: 5500
  tasks: 1
  commits: 1
---

# Phase quick-260828-ikl Plan 01: Fix TIF Aggregate Rows in Metrics Screen Summary

Per-column trimmed statistics (min/median/max) for all 16 base metric columns in the TIF aggregate rows, replacing the event-type-only average approach.

## What Was Built

Replaced the `computeTifRowAvg` / `TIF_EVENT_TYPES` approach in `metrics-screen.js`:

- Added `trimmedMinMax` import from `../lib/forecast-tif.js`
- Added `computeTifTrimmedStats(rows, snap)` private helper that computes trimmed min/median/max for each of the 15 non-date base columns (COLUMNS indices 1–15) over the last `tifRollingDays` (default 7) rows, excluding rejected rows
- Rewrote `buildTifAggregateRow` to accept a flat `{ colKey: value|null }` map and iterate all base columns via `formatCellValue` — the same formatter used by classic avg/min/max rows
- Removed `TIF_EVENT_TYPES` constant and `computeTifRowAvg` nested function from `render()`
- Updated `render()` to call `computeTifTrimmedStats(rows, snap)` once and pass `.min`, `.median`, `.max` to the three `buildTifAggregateRow` calls
- TIF inline columns (W-min, W-max, etc.) continue to render `'—'` in all three aggregate rows

## Verification

- `npm run test:unit`: 753 tests, 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `js/ui/metrics-screen.js` exists and is modified
- Commit `af802f4` confirmed in git log
- All 753 unit tests pass
