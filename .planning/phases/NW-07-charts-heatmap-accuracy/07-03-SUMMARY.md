---
phase: NW-07-charts-heatmap-accuracy
plan: "03"
subsystem: ui
tags: [chart-data, transforms, heatmap, tdd, pure-functions, sleep-analytics]

# Dependency graph
requires:
  - phase: NW-07-01
    provides: chart-data.test.js stubs (RED state established)
  - phase: NW-03-forecast-engine-today-screen
    provides: timeToMinutes from forecast.js (imported for minute extraction)

provides:
  - js/lib/chart-data.js with five named pure-transform exports
  - buildSleepLengthSeries, buildHeatmapData, buildTimeBandSeries, buildNapStats, buildActivityCorrelation

affects:
  - NW-07-04 (charts-screen.js will consume all five transforms)
  - NW-07-05 (accuracy-screen.js may use buildNapStats for nap-day count)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-midnight sleep arithmetic: (wakeMin - bedMin + 1440) % 1440 / 60"
    - "ISO day-of-week: (getDay() + 6) % 7 gives Mon=0, Sun=6"
    - "Week index formula: Math.floor((daysBetween + firstDow) / 7)"
    - "Calendar gap-fill: sorted dates iterated by nextDayStr until lastDate"
    - "nextDayStr uses local-time getters (not toISOString) to avoid UTC timezone offset bug"

key-files:
  created:
    - js/lib/chart-data.js
  modified: []

key-decisions:
  - "nextDayStr uses local-time getters (getFullYear/getMonth/getDate) instead of toISOString() — toISOString() returns UTC date which differs from local date in UTC+ timezones, causing infinite loop in buildHeatmapData gap-fill (Rule 1 auto-fix)"
  - "buildActivityCorrelation uses Object.entries(activityLog) not for..in — no prototype risk (T-07-03-01 mitigation)"
  - "buildNapStats filters napDays by napStart presence; avgNapLengthMin only computed when both napStart and napEnd present"
  - "extractMinutes handles both full ISO timestamps (YYYY-MM-DDTHH:MM) and bare HH:MM strings via at.slice(-5)"

patterns-established:
  - "chart-data.js: all exports are pure (zero DOM, zero I/O, zero localStorage) — enforced by spot check (grep document. === 0)"
  - "gsd:allow-ui-clock tag pattern: applied to all Date usage for calendar display arithmetic in nextDayStr, getISODayOfWeek, getWeekIndex"

requirements-completed:
  - UI-04

coverage:
  - id: D1
    description: "buildSleepLengthSeries maps day records to { date, sleepHours, rejected } with cross-midnight arithmetic"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "tests/unit/chart-data.test.js#buildSleepLengthSeries"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildHeatmapData fills calendar gaps, assigns ISO dayOfWeek (Mon=0) and weekIndex"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "tests/unit/chart-data.test.js#buildHeatmapData"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildTimeBandSeries extracts wake/bedtime as minutes-since-midnight per day"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "tests/unit/chart-data.test.js#buildTimeBandSeries"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildNapStats computes napDayPct, avgNapStartHHMM, avgNapLengthMin from nap event data"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "tests/unit/chart-data.test.js#buildNapStats"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildActivityCorrelation joins activityLog to sleep data, excludes missing data, sorts by score ascending"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "tests/unit/chart-data.test.js#buildActivityCorrelation"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-06-30
status: complete
---

# Phase 7 Plan 03: chart-data Pure Transform Helpers Summary

**Five pure chart-data transform functions for the Charts screen, all tests GREEN after auto-fixing a UTC timezone offset bug in date iteration**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-30T09:44:04Z
- **Completed:** 2026-06-30T09:59:46Z
- **Tasks:** 1 (TDD GREEN — RED state pre-established in 07-01)
- **Files modified:** 1

## Accomplishments

- Created `js/lib/chart-data.js` with five named pure-transform exports for Charts screen (UI-04, D7-05..D7-11)
- All 19 `chart-data.test.js` tests pass GREEN; full unit suite 337/337 pass (no regressions)
- CHART_CONFIG and HEATMAP_COLORS frozen at module top per CLAUDE.md convention
- All date arithmetic (nextDayStr, getISODayOfWeek, getWeekIndex) tagged `gsd:allow-ui-clock` (9 occurrences)
- Auto-fixed UTC timezone offset bug in nextDayStr that caused infinite loop in buildHeatmapData (Rule 1)

## Task Commits

1. **GREEN — implement chart-data pure transforms** - `a601b3e` (feat)

## Files Created/Modified

- `js/lib/chart-data.js` — five pure transform functions: buildSleepLengthSeries, buildHeatmapData, buildTimeBandSeries, buildNapStats, buildActivityCorrelation; plus CHART_CONFIG/HEATMAP_COLORS freeze and private helpers

## Decisions Made

- `nextDayStr` uses local-time getters (`getFullYear`/`getMonth`/`getDate`) instead of `toISOString()` — see deviation below
- `buildActivityCorrelation` uses `Object.entries()` not `for..in` — T-07-03-01 mitigation against prototype pollution
- `extractMinutes` slices `event.at.slice(-5)` to extract HH:MM from both full ISO timestamps and bare HH:MM strings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] nextDayStr timezone offset causing infinite loop in buildHeatmapData**
- **Found during:** GREEN implementation phase
- **Issue:** Plan specified `d.toISOString().slice(0,10)` in `nextDayStr`. In UTC+ timezones (Poland = UTC+1/UTC+2), `new Date('2025-01-01T00:00')` is local midnight, but `toISOString()` converts back to UTC — returning `2025-01-01T23:00:00.000Z` which slices to `2025-01-01` (same date, not next day). This caused `buildHeatmapData`'s gap-fill `while (cur <= lastDate)` to loop forever.
- **Fix:** Replaced `d.toISOString().slice(0,10)` with local-time getters: `` `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` `` — same pattern as `formatLocalISO` in `time.js` (see time.js:52-68, D-16).
- **Files modified:** js/lib/chart-data.js (nextDayStr helper)
- **Verification:** Direct node -e test confirmed fixed output; all 19 tests GREEN; no infinite loop
- **Committed in:** a601b3e (task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Essential fix. The UTC offset issue would affect any user in a UTC+ timezone running the app locally (including the project owner, Poland = UTC+2 in summer). No scope creep.

## Issues Encountered

The test runner appeared to hang during the first run attempt (60-second timeout). Investigation revealed the hang was caused by `buildHeatmapData`'s gap-fill `while` loop never terminating due to `nextDayStr` returning the same date (UTC timezone offset bug). The bug affected the test indirectly via the test file's top-level import which triggered module execution.

## Known Stubs

None — all five functions are fully implemented and wired to real computation. No hardcoded empty returns, no TODO/FIXME markers.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond those in the plan's threat model (T-07-03-01 mitigated via Object.entries(), T-07-03-02 accepted via gsd:allow-ui-clock tags).

## Next Phase Readiness

- `js/lib/chart-data.js` exports are ready for `js/ui/charts-screen.js` (plan 07-04) to consume
- All five transform function signatures match the plan contract exactly
- No blockers

---
*Phase: NW-07-charts-heatmap-accuracy*
*Completed: 2026-06-30*
