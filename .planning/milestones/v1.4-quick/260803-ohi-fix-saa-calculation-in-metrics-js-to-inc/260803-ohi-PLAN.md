---
quick_id: 260803-ohi
slug: fix-saa-calculation-in-metrics-js-to-inc
description: Fix SAA calculation in metrics.js to include days without naps
date: 2026-08-03
status: complete
---

# Quick Task 260803-ohi: Fix SAA calculation in metrics.js to include days without naps

## Root Cause

`totalActivity(day)` returned 0 for no-nap days because `activityBeforeNap` and
`activityAfterNap` both return 0 when napStart/napEnd are null. This caused
`sleepAfterActivityFactor` to hit the division-by-zero guard and return null,
meaning SAA was never computed for any day whose *previous* day had no nap.

## Fix

1. **`js/lib/metrics.js` — `totalActivity`**: When napStart and napEnd are both
   null and before+after are both 0, return `dayLength(day)` instead of 0.
   Semantically: on a no-nap day the subject is awake the entire wake-to-bedtime
   span, so that span IS the total activity.

2. **`js/lib/metrics.js` — `aggregateMetrics`**: Switch `totalActivity` and
   `activityAfterSleepFactor` aggregations from `napRows` to `validRows`, since
   both metrics now produce valid values for no-nap days.

3. **`tests/unit/metrics.test.js`**: Update four tests whose expected values
   were based on the old 0-for-no-nap assumption.

## Tasks

- [x] Fix `totalActivity` in `js/lib/metrics.js`
- [x] Fix aggregation row sets in `aggregateMetrics`
- [x] Update tests in `tests/unit/metrics.test.js`
- [x] All 64 unit tests pass
