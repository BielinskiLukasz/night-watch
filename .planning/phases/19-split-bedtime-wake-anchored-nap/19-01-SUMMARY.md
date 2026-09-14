---
phase: 19-split-bedtime-wake-anchored-nap
plan: "01"
subsystem: algorithm
tags: [forecast, percentile, nap, bedtime, tdd]

requires:
  - phase: 12-prediction-logic-refinements
    provides: calculatePercentiles, subWindowBedtime, computeDurationBand patterns

provides:
  - percentileFromArray(values, pct) — public helper for unsorted numeric arrays (D-16)
  - buildNapGapSeries(dayRecords) — (napStart−wake) minutes array (PRED-20)
  - buildNapDurationSeries(dayRecords) — (napEnd−napStart) minutes array (PRED-22)
  - buildBedtimeSeriesNapDay(dayRecords, settings) — integer-minute {min,central,max} for nap days (PRED-18)
  - buildBedtimeSeriesNoNapDay(dayRecords, settings) — integer-minute {min,central,max} for no-nap days (PRED-18)

affects:
  - 19-02 (forecast routing — imports these functions to wire split bedtime + wake-anchored nap)
  - 25-algorithm-c-settings-modal (forecast-blend.js imports buildNapGapSeries per Phase 25 D-07)

actuals:
  tokens: 4313
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN per export group: test commit then feat commit, incremental import extension"
    - "Series function pattern: iterate dayRecords, extractTime null-guard, midnight-crossover +1440, return number[]"
    - "Bedtime sub-window pattern: filter by napStart presence, minDays guard, delegate calculatePercentiles"

key-files:
  created: []
  modified:
    - js/lib/forecast.js
    - tests/unit/forecast.test.js

key-decisions:
  - "percentileFromArray wraps existing percentile() — sorts internally, takes pct 0–100 (not 0–1) (D-16)"
  - "buildNapGapSeries / buildNapDurationSeries return plain number[] (not {min,central,max}); percentileFromArray is the consumer"
  - "buildBedtimeSeriesNapDay/NoNapDay delegate to calculatePercentiles on sub-window — no offset fallback (D-08 pure null)"
  - "noNapBedtimeOffsetMinutes excluded from all Phase 19 test settings fixtures (D-10 prohibition)"
  - "TDD import extended incrementally per task: percentileFromArray → buildNapGap/Duration → buildBedtimeSeries*"

patterns-established:
  - "Phase 19 exports: stable public API imported by Plans 19-02 and Phase 25; signatures must not change"

requirements-completed:
  - PRED-18
  - PRED-20
  - PRED-22

coverage:
  - id: D1
    description: "percentileFromArray(values, pct) exported from forecast.js: sorts internally, returns null for empty, interpolated value otherwise"
    requirement: PRED-20
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#percentileFromArray(values, pct)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildNapGapSeries(dayRecords) returns plain number[] of (napStart−wake) minutes with null-skip and midnight-crossover"
    requirement: PRED-20
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#buildNapGapSeries(dayRecords)"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildNapDurationSeries(dayRecords) returns plain number[] of (napEnd−napStart) minutes with null-skip and midnight-crossover"
    requirement: PRED-22
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#buildNapDurationSeries(dayRecords)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildBedtimeSeriesNapDay(dayRecords, settings) returns {min,central,max} integer minutes for nap-day sub-window; null below minDays"
    requirement: PRED-18
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#buildBedtimeSeriesNapDay(dayRecords, settings)"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildBedtimeSeriesNoNapDay(dayRecords, settings) returns {min,central,max} integer minutes for no-nap-day sub-window; null below minDays"
    requirement: PRED-18
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#buildBedtimeSeriesNoNapDay(dayRecords, settings)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-14
status: complete
---

# Phase 19 Plan 01: Split Bedtime & Wake-Anchored Nap — Helper Functions Summary

**Five pure-function exports added to forecast.js for split-bedtime model and wake-anchored nap predictions, with full TDD RED/GREEN coverage across 18 new unit tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-14T19:08:04Z
- **Completed:** 2026-09-14T19:16:44Z
- **Tasks:** 3 (tracer + 2 auto/tdd)
- **Files modified:** 2

## Accomplishments

- Added `percentileFromArray(values, pct)` — convenience wrapper around `percentile()` that sorts the caller's array internally; used by Plan 19-02 for P10/P50/P90 of gap/duration number arrays (D-16)
- Added `buildNapGapSeries` and `buildNapDurationSeries` — iterate dayRecords with extractTime null-guards and midnight-crossover normalization, return plain number arrays (PRED-20, PRED-22)
- Added `buildBedtimeSeriesNapDay` and `buildBedtimeSeriesNoNapDay` — filter by napStart presence, apply minDays cold-start guard, delegate to `calculatePercentiles`; return integer-minute `{min, central, max}` or null (PRED-18, D-02, D-04, D-08)
- All five exports confirmed stable public API for Phase 25 `forecast-blend.js` consumption per Phase 25 D-07
- 147 unit tests pass; 18 new subtests cover null-skip, midnight-crossover, cold-start guard, and filter exclusion

## Task Commits

Each task was committed atomically with separate test and feat commits (TDD pattern):

1. **Tracer: percentileFromArray**
   - `0e3131c` test(19-01): add failing test for percentileFromArray
   - `b2bdf42` feat(19-01): implement percentileFromArray export

2. **Task 2: buildNapGapSeries + buildNapDurationSeries**
   - `94a63e6` test(19-01): add failing tests for buildNapGapSeries/buildNapDurationSeries
   - `a6a0a58` feat(19-01): implement buildNapGapSeries and buildNapDurationSeries

3. **Task 3: buildBedtimeSeriesNapDay + buildBedtimeSeriesNoNapDay**
   - `a80a46b` test(19-01): add failing tests for buildBedtimeSeriesNapDay/NoNapDay
   - `af4b8ad` feat(19-01): implement buildBedtimeSeriesNapDay and buildBedtimeSeriesNoNapDay

## Files Created/Modified

- `js/lib/forecast.js` — Five new exported functions added after `subWindowBedtime`; exported-functions comment block extended
- `tests/unit/forecast.test.js` — Import extended incrementally per task; 5 new describe blocks (18 new unit tests)

## Decisions Made

- `percentileFromArray` wraps the existing `percentile(sorted, p)` function — internal sort ensures callers pass unsorted number arrays; pct argument is 0–100 (not 0–1) for usability (D-16)
- `buildNapGapSeries` / `buildNapDurationSeries` return plain `number[]`, not `{min,central,max}` — `percentileFromArray` is the intended consumer in Plan 19-02
- `buildBedtimeSeriesNapDay` / `buildBedtimeSeriesNoNapDay` return pure `null` on thin sub-windows (no offset-shift fallback) — Plan 19-02's routing block chooses the fallback strategy (D-08)
- `noNapBedtimeOffsetMinutes` excluded from all new test settings fixtures per D-10 prohibition; the field still appears in pre-existing PRED-11 tests (not modified)
- Import in forecast.test.js was extended incrementally (one task at a time) to preserve proper RED/GREEN per-task TDD cycles

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Initial attempt added all 5 Phase 19 imports at once (following PATTERNS.md final-state template), which prevented per-task RED cycles because ES module imports fail at load time for any missing export. Corrected immediately by extending the import incrementally per task.

## Known Stubs

None — all five functions are fully implemented with real logic. No placeholders or hardcoded fallbacks.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new functions are pure transforms over validated dayRecords input (already validated by db-shape.js before reaching forecast.js). Threat register entries T-19-01-01 and T-19-01-02 from the plan's threat model are satisfied by the null-guard on extractTime and delegation to calculatePercentiles.

## Next Phase Readiness

- All five helper functions are exported and stable — Plan 19-02 can import and wire them into `forecast()` routing immediately
- `buildBedtimeSeriesNapDay` / `buildBedtimeSeriesNoNapDay` produce integer-minute `{min, central, max}` compatible with the existing `generateProbabilityBand` / `minutesToTime` pipeline in `forecast()`
- `buildNapGapSeries` / `buildNapDurationSeries` produce number arrays ready for `percentileFromArray` P10/P50/P90 calls
- No blockers

## Self-Check: PASSED

- `js/lib/forecast.js` exists and exports all five functions (verified by grep)
- `tests/unit/forecast.test.js` contains 5 new describe blocks
- All 6 task commits present in git log: 0e3131c, b2bdf42, 94a63e6, a6a0a58, a80a46b, af4b8ad
- `node --test tests/unit/forecast.test.js` exits 0 with 147 passing, 0 failing

---
*Phase: 19-split-bedtime-wake-anchored-nap*
*Completed: 2026-09-14*
