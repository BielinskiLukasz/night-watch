---
quick_id: 260803-ohi
status: complete
date: 2026-08-03
---

# Summary: Fix SAA calculation in metrics.js to include days without naps

## What changed

- **`js/lib/metrics.js`** — `totalActivity`: returns `dayLength(day)` for no-nap
  days instead of 0. Aggregation for `totalActivity` and `activityAfterSleepFactor`
  switched from `napRows` to `validRows`.
- **`tests/unit/metrics.test.js`** — updated 4 tests whose assertions were based
  on the old no-nap=0 assumption.

## Result

SAA is now computed for any day whose previous day has no nap (prevDay activity =
dayLength). AAS for no-nap days is also now meaningful (dayLength / sleepDuration)
rather than always 0.

All 64 unit tests pass.
