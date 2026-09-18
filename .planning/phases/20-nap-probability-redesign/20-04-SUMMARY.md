---
phase: 20-nap-probability-redesign
plan: 04
subsystem: prediction-engine
tags: [forecast, bedtime-prediction, nap-probability, tdd]

# Dependency graph
requires:
  - phase: 20-nap-probability-redesign
    provides: "napProbability() score/signalsUsed/confidence shape (Plan 20-01)"
  - phase: 21-prediction-normalization
    provides: "napProbabilityScore.napWindowClosed decoupled from score (D-01/D-02/D-03)"
provides:
  - "forecast()'s bedtimePred blend branch (PRED-19) now consults napWindowClosed before blending nap-day statistics into predictions.bedtime"
affects: [forecast-tif.js, forecast-utils.js, today-screen.js, metrics-screen.js]

# Actuals (#2632)
actuals:
  tokens: 1461
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Inner boolean gate inside an existing else-if branch, preserving the untouched branch character-for-character rather than restructuring the whole conditional"

key-files:
  created: []
  modified:
    - js/lib/forecast.js
    - tests/unit/forecast.test.js

key-decisions:
  - "Used fix(20-04) commit type for the GREEN implementation (not feat) since this closes a bug — the blend branch mixing in nap-day statistics after the window definitively closed — matching CLAUDE.md's commit-type semantics (fix = bug fix) over the generic TDD-flow feat convention"
  - "New RED tests reuse the exact record fixtures from the pre-existing blend test (3 nap + 3 no-nap) and thin-fallback test (2 nap + 2 no-nap) so the new closed-window cases are directly comparable to (and provably diverge from) the pre-existing behavior"
  - "Test 1 asserts against buildBedtimeSeriesNoNapDay(records, settings)'s own live output via minutesToTime(), not a hand-recomputed literal, per the plan's verification note keeping the test coupled to the real function"

requirements-completed: [PRED-18, PRED-19]

coverage:
  - id: D1
    description: "forecast()'s bedtimePred blend branch (PRED-19) gates on napProbabilityScore.napWindowClosed: true routes to the pure no-nap-day series via buildBedtimeSeriesNoNapDay + selectBedtime, bypassing the score blend entirely"
    requirement: "PRED-19"
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#napWindowClosed=true with both sub-series >= minDays: routes to pure no-nap-day series, not the score blend (G-20-16)"
        status: pass
    human_judgment: false
  - id: D2
    description: "When the no-nap-day sub-window is thin (< minDays) even with napWindowClosed:true, forecast() falls through to Step 2 / overall percentiles exactly like the existing thin-sub-series fallback — no dead end, no thrown error"
    requirement: "PRED-19"
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#napWindowClosed=true but no-nap-day sub-series thin (< minDays): falls through to overall, same as undetermined thin fallback (G-20-16)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The undetermined-blend path (napWindowClosed false/absent) is completely unchanged — all 4 pre-existing PRED-18/19 tests still pass unmodified, plus the full 986-test unit/integration suite shows zero regressions"
    requirement: "PRED-18"
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js (full file, 146 tests) and npm run test:unit (986 tests)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-18
status: complete
---

# Phase 20 Plan 04: Gate PRED-19 Bedtime Blend on napWindowClosed Summary

**Closed G-20-16 item 1 — `forecast()`'s bedtime blend branch now consults `napProbabilityScore.napWindowClosed`, routing to the pure no-nap-day series once it is definitively too late for a nap to start today, instead of continuing to mix in nap-day statistics.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 1 (tracer, TDD RED → GREEN)
- **Files modified:** 2 (`js/lib/forecast.js`, `tests/unit/forecast.test.js`)

## Accomplishments
- Added an inner `napProbabilityScore.napWindowClosed` gate inside the existing PRED-19 score-present branch: `true` → `buildBedtimeSeriesNoNapDay(window, settings)` → `selectBedtime(...)`, bypassing the proportional score blend entirely
- Preserved the undetermined-blend path (`napWindowClosed` false/absent) byte-for-byte
- Preserved the thin-sub-series fallback behavior when the no-nap-day sub-window itself is too thin, even with the window closed
- Two new unit tests pin both the closed-window routing and the closed-window-but-thin fallback; all 4 pre-existing PRED-18/19 tests pass unmodified

## Task Commits

Each task was committed atomically (TDD RED → GREEN, no REFACTOR needed):

1. **Task 1 (RED): pin napWindowClosed bedtime routing** - `db66c0c` (test)
2. **Task 1 (GREEN): gate PRED-19 bedtime blend on napWindowClosed** - `a5e3765` (fix)

**Plan metadata:** (this commit, made after SUMMARY creation)

## Files Created/Modified
- `js/lib/forecast.js` - `bedtimePred` IIFE's PRED-19 score-present branch now checks `napProbabilityScore.napWindowClosed` before deciding to blend; closed → pure no-nap-day series via `buildBedtimeSeriesNoNapDay` + `selectBedtime`; open/undetermined → unchanged proportional blend
- `tests/unit/forecast.test.js` - Two new `it` cases in the `forecast() split bedtime routing (PRED-18/19)` describe block covering the closed-window routing and closed-window-thin-fallback behaviors

## Decisions Made
- Used `fix(20-04)` commit type for the GREEN commit rather than `feat` — this closes a bug (the blend branch incorrectly mixing in nap-day statistics after the window closed), and CLAUDE.md's commit-type table maps bug corrections to `fix`
- Reused the exact record fixtures (3 nap + 3 no-nap for the routing test, 2 nap + 2 no-nap for the thin-fallback test) from the pre-existing blend and thin-fallback tests so the new closed-window cases are directly comparable to — and provably diverge from — the pre-existing blended values (`22:00` vs `21:20` for the routing test)
- Test 1 asserts against `buildBedtimeSeriesNoNapDay(records, splitSettings)`'s own live output run through `minutesToTime()`, not a hand-recomputed literal, keeping the test coupled to the real function per the plan's verification note

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-20-16 item 1 is closed. `js/lib/forecast.js`'s classic bedtime prediction no longer blends in nap-day statistics once the nap window has genuinely closed for today.
- Full regression sweep confirms no ripple effects into `forecast-tif.js`, `forecast-utils.js`, `today-screen.js`, or `metrics-screen.js`'s override path (986/986 unit + integration tests pass).
- Remaining G-20-16 items (if any) and the other 2 UAT issues referenced in `.planning/phases/20-nap-probability-redesign/20-UAT.md` are out of this plan's scope — check the phase's other gap-closure plans for status.

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-18*

## Self-Check: PASSED

- FOUND: js/lib/forecast.js
- FOUND: tests/unit/forecast.test.js
- FOUND: .planning/phases/20-nap-probability-redesign/20-04-SUMMARY.md
- FOUND: db66c0c (test commit, RED)
- FOUND: a5e3765 (fix commit, GREEN)
