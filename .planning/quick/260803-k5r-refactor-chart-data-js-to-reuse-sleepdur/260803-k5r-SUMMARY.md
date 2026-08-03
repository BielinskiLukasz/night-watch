---
quick_task: true
slug: refactor-chart-data-reuse-metrics
title: Refactor chart-data.js to reuse sleepDuration and napDuration from metrics.js
status: complete
completed_date: 2026-08-03
duration: 5 min
commits:
  - hash: 6a7d7c0
    message: "refactor(chart-data): reuse sleepDuration and napDuration from metrics.js"
    files: [js/lib/chart-data.js]
---

# Quick Task 260803-k5r: Refactor chart-data.js

## Summary

Successfully eliminated redundant duration-calculation code in `chart-data.js` by importing and reusing `sleepDuration()` and `napDuration()` from `metrics.js`. This establishes a single source of truth for duration logic, ensuring consistent behavior across the app and reducing maintenance burden.

## Objective

Eliminate redundant duration-calculation code in chart-data.js by importing and reusing `sleepDuration()` and `napDuration()` from metrics.js.

## Changes Made

### 1. Added import statement
Added import for `sleepDuration` and `napDuration` from `metrics.js` at the top of the file (after existing forecast.js import).

### 2. Deleted private computeSleepHours() function
Removed the redundant private function (was at lines 65-71) that duplicated the duration calculation logic now provided by `sleepDuration()` from metrics.js.

### 3. Updated three call sites
Replaced all calls to `computeSleepHours(d)` with `sleepDuration(d) / 60` to convert from minutes to hours:
- `buildSleepLengthSeries()` — line 136
- `buildHeatmapData()` — line 168
- `buildActivityCorrelation()` — line 288

### 4. Refactored buildNapStats()
Replaced the manual nap-length computation block (lines 253-261) with a clean call to `napDuration()`:
```javascript
const napLengths = napDays
  .filter(d => d.napEnd)
  .map(napDuration)
  .filter(len => len !== null);
```

### 5. Preserved extractMinutes() helper
The private `extractMinutes()` helper remains in place — it is still used by `buildTimeBandSeries()` and `buildNapStats()`.

## Verification

**Test Results:**
- npm run test:unit: 647 tests passed, 0 failures
- All chart-data.js and metrics.js tests pass
- No regression detected

## Files Modified

- `js/lib/chart-data.js` — refactored to reuse metrics.js functions

## Deviations

None — plan executed exactly as written.

## Known Stubs

None.
