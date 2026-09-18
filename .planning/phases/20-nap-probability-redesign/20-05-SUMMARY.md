---
phase: 20-nap-probability-redesign
plan: 05
subsystem: prediction
tags: [tif, forecast, bedtime, no-nap-day, gap-closure]

# Dependency graph
requires:
  - phase: 20-nap-probability-redesign
    provides: napWindowClosed decoupling (Plan 20-01/02) and PRED-19 bedtime-blend no-nap gating (Plan 20-04) — same G-20-16 UAT root-cause session
provides:
  - forecast-tif.js's bedtime prediction correctly omits the Activity-after-nap band on no-nap days, substituting a no-nap-day-only historic bedtime band instead
affects: [phase-20-uat, accuracy-tif, today-screen]

actuals:
  tokens: 1433
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "isNoNapDay if/else band substitution mirrored 1:1 from forecast-blend.js's Model 3, extended to forecast-tif.js's bedtime block"

key-files:
  created: []
  modified:
    - js/lib/forecast-tif.js
    - tests/unit/forecast-tif-nonap.test.js

key-decisions:
  - "No minDays gate on the no-nap-day substitute band, matching forecast-blend.js Model 3's documented graceful-degradation contract (thin history omits the band; never falls back to the Activity-after-nap band since isNoNapDay is already true)"

patterns-established:
  - "When gating a nap-anchored band on isNoNapDay, wrap the existing block unchanged inside if (!isNoNapDay) {...} and add the substitute in the else branch — exact structural mirror of forecast-blend.js Model 3"

requirements-completed: [TIF-16, PRED-19]

coverage:
  - id: D1
    description: "On a no-nap day, tifForecast()'s bedtime prediction no longer includes the Activity-after-nap band; a no-nap-day-only historic bedtime band substitutes when data allows; nap-day/undetermined behavior is unchanged"
    requirement: "TIF-16"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-tif-nonap.test.js#tifForecast() G-20-16 item 3: Activity-after-nap band gated on isNoNapDay"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-18
status: complete
---

# Phase 20 Plan 05: Gate Activity-After-Nap Band on isNoNapDay Summary

**forecast-tif.js's bedtime prediction now gates the Activity-after-nap band on isNoNapDay, substituting a no-nap-day-only historic bedtime band, closing G-20-16 item 3**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Closed G-20-16 item 3 (UAT 20-UAT.md, root-cause session `.planning/debug/bedtime-nap-same-algo.md`): the "Activity-after-nap band" in `tifForecast()`'s bedtime prediction was unconditionally added whenever `napEndAnchor` resolved, with no `isNoNapDay` gate — unlike its sibling "Day-length band" a few lines above, and unlike `forecast-blend.js`'s Model 3, which already implements the correct no-nap-day substitution.
- Wrapped the existing Activity-after-nap block in `if (!isNoNapDay) { ... } else { ... }`, mirroring `forecast-blend.js`'s Model 3 structure exactly. The `else` branch builds a `Historic bedtime band (no-nap days)` from `noNapDayWindow`'s bedtimes via the existing `buildHistoricBand()` helper — deliberately without a `minDays` gate, matching Model 3's documented graceful-degradation contract.
- Added 3 new unit tests pinning the gate, the substitute band, and the isNoNapDay=false regression case (byte-for-byte unchanged behavior). All 5 pre-existing `forecast-tif-nonap.test.js` tests plus the 3 new ones pass (8/8). Full `npm run test:unit` sweep (989 tests) passes with zero regressions.

## Task Commits

Each task was committed atomically (TDD RED/GREEN split):

1. **Task 1 RED: pin isNoNapDay gate for activity-after-nap band** - `aece51b` (test)
2. **Task 1 GREEN: gate activity-after-nap band on isNoNapDay** - `de92fe3` (fix)

## Files Created/Modified
- `js/lib/forecast-tif.js` - Wrapped the Activity-after-nap band in `if (!isNoNapDay) {...} else {...}`; else branch builds and pushes the `Historic bedtime band (no-nap days)` substitute from `noNapDayWindow` bedtimes via `buildHistoricBand()`
- `tests/unit/forecast-tif-nonap.test.js` - Added `makeVariedBedtimeFixture()` helper (nap days bedtime '22:00', no-nap days '21:00') and a new describe block with 3 tests covering the gate, the substitute band + differing central, and the isNoNapDay=false regression pin

## Decisions Made
- Followed the plan's explicit instruction to omit a `minDays` gate on the substitute band, since `forecast-blend.js`'s Model 3 (the reference implementation this fix mirrors) has none either — thin no-nap history simply omits the substitute band rather than falling back to the Activity-after-nap band.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- G-20-16 item 3 closed. Remaining gap-closure items (if any) for the 20-UAT.md/bedtime-nap-same-algo.md debug session continue in Plans 20-06/20-07.
- No blockers for subsequent plans in Phase 20.

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-18*

## Self-Check: PASSED

- FOUND: js/lib/forecast-tif.js
- FOUND: tests/unit/forecast-tif-nonap.test.js
- FOUND: .planning/phases/20-nap-probability-redesign/20-05-SUMMARY.md
- FOUND commit: aece51b
- FOUND commit: de92fe3
