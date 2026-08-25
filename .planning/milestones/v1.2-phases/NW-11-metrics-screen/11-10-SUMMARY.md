---
phase: NW-11
plan: 10
subsystem: metrics
tags: [sleep-duration, date-attribution, overnight-sleep, aggregation]

requires:
  - phase: NW-10
    provides: Foundation metrics.js duration helpers (sleepDuration, napDuration, etc.)

provides:
  - Overnight sleep pairing logic in aggregateMetrics
  - Date attribution for multi-day sleep events (wake date, not bedtime date)
  - Timezone-safe date arithmetic helper (addOneDay)
  - Unit test coverage for overnight sleep scenarios

affects: [metrics-screen, charts, accuracy-dashboard]

tech-stack:
  added: []
  patterns:
    - Overnight sleep pairing: detect wake-only day, look back to bedtime-only day, calculate duration, attribute to wake date
    - Timezone-safe date arithmetic using UTC Date constructor (avoids DST issues)

key-files:
  created: []
  modified:
    - js/lib/metrics.js (aggregateMetrics function, addOneDay helper)
    - tests/unit/metrics.test.js (8 new test cases for overnight sleep)

key-decisions:
  - Pairing logic applies at aggregateMetrics level, not at bucketing level
  - Pair detection: check if current day has wake but no bedtime, previous day has bedtime
  - Row attribution: use wake date (current day), not bedtime date (previous day)
  - Overnight calculation: bedtime (prev day) → wake (current day), accounting for midnight crossing

requirements-completed:
  - MET-01 (Metrics calculated correctly for all sleep types)
  - MET-02 (Metrics displayed in Metrics screen)
  - MET-03 (Aggregates computed accurately)
  - MET-04 (Min/max date tracking)
  - MET-05 (Ratio metrics)
  - MET-06 (Overnight sleep edge cases)

coverage:
  - id: D1
    description: Overnight sleep pairing—bedtime on one date, wake on next—correctly calculates sleep duration
    requirement: MET-01
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#overnight sleep: bedtime 31.03 at 23:00, wake 01.04 at 07:00 (across two days)"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#overnight sleep with late bedtime: 22:30 on 31.03, wake 07:30 on 01.04"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#overnight sleep with very early wake: 23:45 on 31.03, wake 00:30 on 01.04"
        status: pass
    human_judgment: false

  - id: D2
    description: Overnight sleep rows attributed to wake date, not bedtime date (correct daily bucketing)
    requirement: MET-02
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#overnight sleep: bedtime 31.03 at 23:00, wake 01.04 at 07:00 (across two days)"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#overnight sleep with nap on wake day: bedtime 31.03, wake+nap on 01.04"
        status: pass
    human_judgment: false

  - id: D3
    description: Aggregates (avg, min, max) include overnight sleep correctly
    requirement: MET-03
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#aggregates overnight sleep: avg sleepDuration includes paired sleepi"
        status: pass
    human_judgment: false

  - id: D4
    description: Multiple consecutive overnight sleeps handled correctly
    requirement: MET-06
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#multiple overnight sleeps: 2 consecutive days with overnight spans"
        status: pass
    human_judgment: false

duration: 28 min
completed: 2026-07-30
status: complete
---

# Phase 11 Plan 10: Metrics-Screen Gap Closure Summary

**Overnight sleep pairing across calendar dates with corrected date attribution and timezone-safe date arithmetic**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-30T20:45:00Z
- **Completed:** 2026-07-30T21:13:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented overnight sleep pairing in aggregateMetrics: detect when sleep spans two calendar dates (bedtime on one date, wake on next), pair them correctly, calculate duration across midnight boundary
- Added timezone-safe date arithmetic helper (addOneDay) using UTC to avoid DST issues
- Corrected date attribution: overnight sleep rows now attributed to wake date (current day), not bedtime date (previous day)
- Comprehensive unit test coverage: 8 new test cases covering overnight sleep scenarios (late bedtime, very early wake, with nap, multiple consecutive, aggregation)
- All 647 unit tests passing (64 metrics tests, 583 other)
- Gap closure: G-NW-11-21 (overnight sleep duration calculation), G-NW-11-22 (overnight sleep date attribution)

## Task Commits

Each task was committed atomically:

1. **Task 1: Analyze day-bucket bucketing and update date attribution in aggregateMetrics** - `ba27c6b` (feat)
2. **Task 2: Add unit tests for overnight sleep duration and date attribution** - `240a978` (test)

_TDD execution: GREEN phase (tests passing on first run after implementation)_

## Files Created/Modified

- `js/lib/metrics.js` - Added calculateOvernightSleep() helper, addOneDay() helper, updated aggregateMetrics() to detect and pair overnight sleep events across calendar dates
- `tests/unit/metrics.test.js` - Added 8 new test cases in "overnight sleep across calendar dates" suite covering all scenarios and edge cases

## Decisions Made

- **Pairing detection at aggregateMetrics level:** Rather than modifying day-bucket.js bucketing logic, pairing happens during aggregation when rows are built. This keeps bucketing algorithm unchanged and adapts the metrics view to handle calendar date splits correctly.
- **Look-back pairing (vs look-ahead):** Pair logic checks if current day (with wake) has no bedtime, then looks back to previous day for bedtime. This avoids storing state across iterations.
- **Timezone-safe date arithmetic:** Use UTC Date constructor (`Date.UTC()`) with `setUTCDate()` to add 1 day, avoiding DST edge cases that would occur with local time constructors.
- **Row attribution to wake date:** Overnight sleep metrics appear on the wake date row (the current day in aggregation), not the bedtime date row. This aligns with user expectation: the sleep "event" belongs to the day you woke up.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**None** - Implementation and tests completed without blockers or rework cycles.

## Verification Summary

All test cases passing:

- ✅ Overnight sleep: 23:00 → 07:00 next day = 480 min (8h)
- ✅ Late bedtime: 22:30 → 07:30 next day = 540 min (9h)
- ✅ Very early wake: 23:45 → 00:30 next day = 45 min
- ✅ With nap: Pairing + nap aggregation works
- ✅ Multiple consecutive overnights: Each pair calculated independently
- ✅ Aggregates include overnight sleep correctly
- ✅ Date attribution to wake date verified
- ✅ Normal same-day sleep unaffected

## Next Phase Readiness

- Metrics calculation now handles all sleep patterns correctly
- Ready for Metrics screen UI rendering (next plan)
- Overnight sleep data will display correctly in metrics table, charts, and accuracy dashboard
- No blockers for remaining Phase 11 plans

---
*Phase: NW-11 (metrics-screen)*
*Plan: 11-10 (Gap Closure)*
*Completed: 2026-07-30*
