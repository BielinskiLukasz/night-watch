---
phase: NW-07-charts-heatmap-accuracy
plan: "02"
subsystem: pure-lib
tags: [accuracy, backtesting, tdd, forecast, pure-function, node-test]

requires:
  - phase: NW-07-01
    provides: "accuracy.test.js unit test stubs (RED state) for computeAccuracy"
  - phase: NW-03
    provides: "forecast(dayRecords, settings) pure function + timeToMinutes export"

provides:
  - "js/lib/accuracy.js — computeAccuracy(dayRecords, settings) → AccuracyResult pure backtesting engine"
  - "AccuracyResult shape: { wake, bedtime, napStart, napEnd } each with { total, withinDelta:{count,pct}, withinHalfDelta:{count,pct}, insideBand:{count,pct} }"

affects: [NW-07-05, NW-07-06, accuracy-screen]

tech-stack:
  added: []
  patterns:
    - "ACCURACY_CONFIG frozen at module top (Object.freeze per CLAUDE.md)"
    - "Private helpers extractActualMinutes + buildAccuracyResult not exported"
    - "Look-ahead bias prevention: history = sorted.slice(0, i), actual = sorted[i]"
    - "Nap day counting (D7-15): increment total only for days with actual nap events"
    - "total increments before prediction check — counts scorable days regardless of prediction availability"

key-files:
  created:
    - js/lib/accuracy.js
  modified: []

key-decisions:
  - "total is incremented for every day where the actual event exists and forecast is not cold-start, even when forecast has no central prediction for that event type (e.g., first nap days before any nap history)"
  - "extractActualMinutes handles both ISO YYYY-MM-DDTHH:MM and bare HH:MM formats to support unit-test synthetic data"
  - "NaN guard: total === 0 → pct = 0 (never NaN) per T-07-02-02 threat mitigation"

patterns-established:
  - "Pure backtesting loop pattern: sort defensively, iterate from minDays, history=slice(0,i), actual=sorted[i]"
  - "Nap type sentinel: NAP_TYPES Set for O(1) nap-type checking"

requirements-completed:
  - UI-05

coverage:
  - id: D1
    description: "computeAccuracy(dayRecords, settings) → AccuracyResult pure function with zero DOM and zero I/O"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#computeAccuracy — UI-05, D7-12..D7-16"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty dayRecords returns all totals zero (D7-12 edge case)"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#empty dayRecords → all totals zero"
        status: pass
    human_judgment: false
  - id: D3
    description: "Look-ahead bias prevention: history never includes the actual day being scored"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#perfect prediction → withinDelta.pct === 100"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nap day counting (D7-15): napStart/napEnd totals only count days with actual nap events"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#2 total days, 1 with nap → napStart.total counts only days with napStart"
        status: pass
    human_judgment: false
  - id: D5
    description: "pct fields are 0-100 integer numbers, never NaN or fractions"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#pct values are 0-100 numbers, not fractions (0.0-1.0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "isColdStart:true forecast skips that iteration (total unchanged)"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#all days rejected → forecast() returns isColdStart:true → row skipped"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-06-30
status: complete
---

# Phase 7 Plan 02: computeAccuracy Pure Backtesting Engine Summary

**TDD GREEN: computeAccuracy(dayRecords, settings) retroactive backtesting engine with look-ahead bias prevention, nap day filtering, and 11/11 unit tests passing**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-30T09:11:21Z
- **Completed:** 2026-06-30T09:26:00Z
- **Tasks:** 1 (TDD GREEN)
- **Files modified:** 1

## Accomplishments

- Implemented `js/lib/accuracy.js` exporting `computeAccuracy(dayRecords, settings) → AccuracyResult` — pure function with zero DOM and zero I/O
- All 11 accuracy unit test stubs from 07-01 now GREEN (previous RED: ERR_MODULE_NOT_FOUND)
- ACCURACY_CONFIG frozen at module top; extractActualMinutes and buildAccuracyResult are private helpers
- Look-ahead bias prevention: loop invariant `history = sorted.slice(0, i)`, `actual = sorted[i]` (RESEARCH Pitfall #2)
- Nap day counting (D7-15): napStart/napEnd totals only count days with actual nap events; no-nap days excluded
- T-07-02-02 mitigated: `total === 0 → pct = 0` (never NaN)
- Full regression check: 318 existing unit tests all pass

## Task Commits

1. **GREEN: computeAccuracy implementation** — `4ee61f4` (feat)

_Note: RED commit was made in 07-01 (`f3a7f3c`). This plan executes the GREEN phase only._

## Files Created/Modified

- `js/lib/accuracy.js` — Pure backtesting engine; exports `computeAccuracy(dayRecords, settings) → AccuracyResult`; 239 lines including full JSDoc

## Decisions Made

- **total before prediction check**: `total` is incremented for any day where the actual event exists and forecast is not cold-start, even when forecast has no central prediction for that specific event type (e.g., first nap day in history before any nap data exists in the window). This reflects "days the event occurred" vs "days predicted correctly". Rationale: if we only counted days where a prediction existed, nap accuracy would be artificially inflated by skipping early nap days where the algorithm couldn't yet predict.

- **extractActualMinutes supports bare HH:MM**: event.at can be either `'YYYY-MM-DDTHH:MM'` (real data) or bare `'HH:MM'` (unit test synthetic data). The helper handles both via `at.length > 5 ? at.slice(-5) : at`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-ordered total increment relative to prediction check**

- **Found during:** GREEN verification (11th test failing: "napStart.total should count only days with napStart")
- **Issue:** Initial implementation checked for prediction existence before incrementing `total`. When history has no nap data, `pred.napStart = { central: null, min: null, max: null }` → `continue` skipped the total increment. Test expected `total=1` for a day with actual napStart but no prediction.
- **Fix:** Moved `counters[type].total++` before the prediction-existence check. Added comment explaining the intent.
- **Files modified:** `js/lib/accuracy.js`
- **Verification:** All 11 tests pass after fix.
- **Committed in:** `4ee61f4` (same feat commit after inline fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 — logic error)
**Impact on plan:** Fix required for correct nap-day counting semantics. No scope creep.

## Issues Encountered

- Nap counting logic needed one fix iteration (see Deviations). The plan's implementation spec ordering was ambiguous — "If no prediction, continue" appeared before "Increment total", but the test contract requires total to reflect actual occurrences not predicted ones.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `accuracy.js` is a pure function with no external I/O. T-07-02-02 (pct NaN leak) mitigated by `total === 0 → pct = 0` guard.

## Known Stubs

None — all logic is fully wired. The AccuracyResult shape is complete and matches D7-14.

## Next Phase Readiness

- `js/lib/accuracy.js` is ready for use by `js/ui/accuracy-screen.js` (07-05)
- `computeAccuracy` call signature: `computeAccuracy(dayRecords, settings)` where dayRecords should be pre-filtered by `filterDayRecordsByStage()` when a stage is active (D7-17)
- `AccuracyResult.napStart.total < settings.minDays` → UI should show "—" (D7-15)

## Self-Check

- [x] `js/lib/accuracy.js` exists
- [x] Commit `4ee61f4` exists
- [x] 11/11 accuracy tests GREEN
- [x] 318/318 existing unit tests unchanged
- [x] Zero DOM access (grep count: 0)
- [x] Zero localStorage access (grep count: 0)

## Self-Check: PASSED

All created files exist. Commit hash verified. All tests GREEN.

---
*Phase: NW-07-charts-heatmap-accuracy*
*Completed: 2026-06-30*
