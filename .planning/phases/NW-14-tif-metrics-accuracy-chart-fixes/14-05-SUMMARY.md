---
phase: NW-14
plan: "05"
subsystem: charts
tags: [chart-data, charts-screen, y-axis, nap-series, subjective-night, unit-tests]
status: complete

dependency_graph:
  requires: []
  provides:
    - buildTimeBandSeries-new-shape
    - renderTimeBandChart-4-series
    - renderTimeBandChart-inverted-y
  affects:
    - js/lib/chart-data.js
    - js/ui/charts-screen.js
    - tests/unit/chart-data.test.js

tech_stack:
  added: []
  patterns:
    - dayRecords.map subjective-night shape extraction
    - yScale inversion for time-of-day axis
    - 4-series canvas SVG dot rendering with null guard

key_files:
  modified:
    - js/lib/chart-data.js
    - js/ui/charts-screen.js
    - tests/unit/chart-data.test.js

decisions:
  - D-15: yScale inverted — M.top + plotH - (minutes/1440)*plotH — earlier times higher
  - D-16: 4 colored series wake/#4f46e5 napStart/#f59e0b napEnd/#fb923c bedtime/#94a3b8
  - D-17: buildTimeBandSeries uses dayRecords.map over subjective-night slots only

metrics:
  duration_minutes: 9
  completed_date: "2026-08-27"
  tasks_completed: 2
  commits: 2

actuals:
  tokens: 24500
  tasks: 2
  commits: 2
---

# Phase 14 Plan 05: Chart Fixes — Y-axis Inversion, 4-Series Nap Dots, Subjective-Night Dedup Summary

**One-liner:** Inverted Y-axis, 4-series colored nap/wake/bedtime dots, and subjective-night dedup via dayRecords.map in the Wake & Bedtime Bands chart.

## What Was Built

Three targeted fixes to the Wake & Bedtime Bands chart (UI-08, UI-09, UI-10):

1. **Y-axis inversion (D-15):** `yScale` formula changed from `M.top + (minutes / 1440) * plotH` to `M.top + plotH - (minutes / 1440) * plotH`. Earlier times (morning wakes) now appear higher on the canvas; later times (bedtimes near midnight) appear lower. The formula change is scoped to `renderTimeBandChart` only — no other chart function is affected.

2. **4-series dot rendering (D-16):** Replaced the old single-color `bedtimesMinutes[]` loop with a `TIME_BAND_SERIES` constant array of 4 series (wake/#4f46e5, napStart/#f59e0b, napEnd/#fb923c, bedtime/#94a3b8). Each series skips days where the value is null (no-nap days skip nap dots). Legend expanded to 4 rows matching the series colors.

3. **Subjective-night dedup fix (D-17):** `buildTimeBandSeries` now uses `dayRecords.map()` over the pre-bucketed subjective-night records, extracting named slots (`.wake`, `.bedtime`, `.napStart`, `.napEnd`) directly via the existing `extractMinutes` helper. The old `byDate` Map and `allEvents` loop were removed entirely. Return shape changed to `{date, wakeMinutes, bedtimeMinutes, napStartMinutes, napEndMinutes}` — `bedtimesMinutes[]` removed.

4. **`hasData` guard updated:** Checks `wakeMinutes != null || bedtimeMinutes != null || napStartMinutes != null || napEndMinutes != null` — no longer references the removed `bedtimesMinutes` property.

5. **Tests updated:** Old `'two bedtimes on same calendar date → both in bedtimesMinutes'` test (which asserted the buggy calendar-date behavior) removed. Three new tests added: nap day shape (napStartMinutes=780, napEndMinutes=870), no-nap day null handling, and 2-records → 2-entries subjective-night dedup guarantee.

## Commits

- `4db146f` feat(NW-14-05): buildTimeBandSeries subjective-night shape + 4-series chart
- `2009e58` test(NW-14-05): replace bedtimesMinutes test with 4-slot shape tests

## Verification

- `node --test tests/unit/chart-data.test.js` — 22 tests, 0 failures
- `npm run test:unit` — 753 tests, 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `js/lib/chart-data.js` — exists, buildTimeBandSeries uses dayRecords.map, no byDate/allEvents
- `js/ui/charts-screen.js` — exists, yScale contains `plotH -`, TIME_BAND_SERIES has 4 entries, 4 colors present
- `tests/unit/chart-data.test.js` — exists, no bedtimesMinutes reference, 3 new tests present
- Commits 4db146f and 2009e58 — present in git log
- 753/753 unit tests pass
