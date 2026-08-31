---
phase: NW-14-tif-metrics-accuracy-chart-fixes
plan: "01"
subsystem: metrics
tags: [metrics, tif, ratio-metrics, pure-functions, tdd]

requires:
  - phase: NW-11-metrics-screen
    provides: aggregateMetrics shape, sleepAfterActivityFactor export, metrics.js module
provides:
  - dayToSleepFactor(day) exported from js/lib/metrics.js (MET-07)
  - napFraction(day) exported from js/lib/metrics.js (MET-09)
  - amPmSplit(day) exported from js/lib/metrics.js (MET-10)
  - aggregateMetrics updated with dayToSleepFactor/napFraction/amPmSplit in rows + avg/min/max
  - sleepAfterActivityFactor removed from aggregateMetrics aggregate computation (D-14); function stays exported
affects: [NW-14-03-metrics-screen-columns, NW-14-metrics-tif-columns]

actuals:
  tokens: 2008
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Null-guard + division-by-zero pattern: same as activityAfterSleepFactor — check for null components and zero denominator before dividing"
    - "JSDoc in GREEN commit — no separate REFACTOR commit when docs are simple and don't change logic"

key-files:
  created: []
  modified:
    - js/lib/metrics.js
    - tests/unit/metrics.test.js

key-decisions:
  - "D-12: dayToSleepFactor = dayLength/sleepDuration; napFraction = napDuration/combinedSleepNap; amPmSplit = activityBeforeNap/activityAfterNap — all null on missing/zero denominators"
  - "D-14: sleepAfterActivityFactor removed from aggregateMetrics avg/min/max; stays exported and in per-row data for backward compat"
  - "JSDoc included in GREEN commit — same precedent as Phase 12 Plan 02 (.intense JSDoc)"

patterns-established:
  - "New ratio metrics follow activityAfterSleepFactor null-guard pattern verbatim"
  - "napRows filter (napDuration !== null) used for nap-scoped aggregates (napFraction, amPmSplit)"

requirements-completed:
  - MET-07
  - MET-09
  - MET-10

coverage:
  - id: D1
    description: "dayToSleepFactor(day) returns dayLength/sleepDuration as a number; null when wake, bedtime, or sleepDuration=0"
    requirement: MET-07
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#dayToSleepFactor(day)"
        status: pass
    human_judgment: false
  - id: D2
    description: "napFraction(day) returns napDuration/combinedSleepNap; null on no-nap days or zero denominator"
    requirement: MET-09
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#napFraction(day)"
        status: pass
    human_judgment: false
  - id: D3
    description: "amPmSplit(day) returns activityBeforeNap/activityAfterNap; null on no-nap days or zero denominator"
    requirement: MET-10
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#amPmSplit(day)"
        status: pass
    human_judgment: false
  - id: D4
    description: "aggregateMetrics computes avg/min/max for dayToSleepFactor (validRows), napFraction (napRows), amPmSplit (napRows); sleepAfterActivityFactor absent from avg but present in per-row data"
    requirement: MET-07
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#aggregateMetrics — updated fields (D-14)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-27
status: complete
---

# Phase 14 Plan 01: New Ratio Metrics (dayToSleepFactor, napFraction, amPmSplit) Summary

**Three new ratio metric functions added to metrics.js with TDD and aggregateMetrics updated to compute avg/min/max for them while removing sleepAfterActivityFactor from aggregation (D-12, D-14)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-27T11:40:29Z
- **Completed:** 2026-08-27T11:44:29Z
- **Tasks:** 3 (RED + GREEN + REFACTOR-in-GREEN)
- **Files modified:** 2

## Accomplishments

- `dayToSleepFactor(day)` exported from `js/lib/metrics.js`: `dayLength/sleepDuration`, null when either is null or sleepDuration is 0 (MET-07, D-12)
- `napFraction(day)` exported: `napDuration/combinedSleepNap`, null on no-nap days or zero denominator (MET-09, D-12)
- `amPmSplit(day)` exported: `activityBeforeNap/activityAfterNap`, null on no-nap days or zero activityAfterNap (MET-10, D-12)
- `aggregateMetrics` updated: three new fields added to `rows.push()`; `avg`/`min`/`max` computed for all three via `aggregateMetric`; `sleepAfterActivityFactor` aggregate call removed (D-14) while per-row value is preserved for backward compat
- 9 new unit tests added across 4 describe blocks; all 730 unit tests pass

## Task Commits

1. **RED — failing tests** - `5eb005b` (test)
2. **GREEN — implementation + JSDoc** - `ec57f83` (feat)

No REFACTOR commit — JSDoc was included in GREEN (same precedent as Phase 12 Plan 02).

## Files Created/Modified

- `js/lib/metrics.js` — added `dayToSleepFactor`, `napFraction`, `amPmSplit` functions with JSDoc; updated `rows.push()` with D-12 new ratio fields; updated aggregate section to call `aggregateMetric` for the three new metrics; removed `saaRows` derivation and `aggregateMetric('sleepAfterActivityFactor', saaRows)` call
- `tests/unit/metrics.test.js` — added `dayToSleepFactor`, `napFraction`, `amPmSplit` to import; added 4 new describe blocks (13–16) with 9 new tests

## Decisions Made

- JSDoc included in GREEN commit (no separate REFACTOR) — same precedent as Phase 12 Plan 02
- `amPmSplit` no-nap guard checks `day.napStart == null && day.napEnd == null` before the `after === 0` guard, matching the plan spec ordering

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — pure JavaScript functions, no external services.

## Next Phase Readiness

- `dayToSleepFactor`, `napFraction`, `amPmSplit` are ready for Plan 03 (metrics-screen.js COLUMNS update)
- `aggregateMetrics` now exposes `avg.dayToSleepFactor`, `avg.napFraction`, `avg.amPmSplit` in returned object
- `sleepAfterActivityFactor` remains exported for any backward-compat callers

## Self-Check

- `js/lib/metrics.js` — modified and committed in `ec57f83` ✓
- `tests/unit/metrics.test.js` — modified and committed in `5eb005b` ✓
- `node --test tests/unit/metrics.test.js` — 73 tests, 0 failures ✓
- `npm run test:unit` — 730 tests, 0 failures ✓

## Self-Check: PASSED

---
*Phase: NW-14-tif-metrics-accuracy-chart-fixes*
*Completed: 2026-08-27*
