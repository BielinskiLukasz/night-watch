---
phase: 18-sleep-debt-proxy
plan: 18-01
subsystem: lib/pure-function
tags: [metrics, sleep-debt, tdd, pure-function]

requires:
  - phase: 17-day-of-week-patterns
    provides: dayOfWeekAverages calling-convention and module-home decision (D-04)
  - phase: 16-rolling-window-aggregates
    provides: null-exclusion and rolling-slice patterns for metrics.js

provides:
  - sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes) exported from js/lib/metrics.js
  - 9 unit tests covering all edge cases: empty, cold-start, boundary, zero-debt,
    deficit, surplus, null-exclusion, rolling-slice, no-mutation

affects:
  - 18-02 (settings — targetSleepMinutes setting depends on this function's parameter contract)
  - 18-03 (metrics-screen — imports sleepDebtProxy to populate per-day debt and aggregate rows)

actuals:
  tokens: 1747    # 6986 chars / 4 (diff over js/lib/metrics.js + tests/unit/metrics.test.js)
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "filter-then-slice null-exclusion rolling window: .filter(combinedSleepNap != null).slice(-N)"
    - "cold-start null guard: if validDays.length < windowDays return null (D-07)"
    - "signed reduce for sleep debt: sum + (target - actual), no clamping (D-06)"

key-files:
  created: []
  modified:
    - js/lib/metrics.js
    - tests/unit/metrics.test.js

key-decisions:
  - "sleepDebtProxy uses combinedSleepNap (night sleep + nap) as actual sleep, consistent with D-04"
  - "null-combinedSleepNap days excluded from both window count and deficit sum (D-05)"
  - "positive = deficit, negative = surplus, no clamping at zero (D-06)"
  - "returns null when fewer than windowDays qualifying records exist (D-07 cold-start guard)"
  - "pure function: caller pre-filters rejected + stage-scoped days; function uses .filter().slice() — no mutation (D-08)"

patterns-established:
  - "filter-then-slice null-exclusion rolling window for sleepDebtProxy"

requirements-completed: [MET-13]

coverage:
  - id: D1
    description: "sleepDebtProxy exported from js/lib/metrics.js with correct 3-parameter signature"
    requirement: MET-13
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — returns a number (not null) with exactly windowDays valid records"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — returns null for empty input"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — returns positive value when all days sleep less than target"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — returns negative value when all days sleep more than target"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — excludes null-combinedSleepNap days"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — takes only last windowDays qualifying records"
        status: pass
      - kind: unit
        ref: "tests/unit/metrics.test.js#sleepDebtProxy — does not mutate the input array"
        status: pass
    human_judgment: false
  - id: D2
    description: "no existing test regressions — all 80 prior tests continue to pass"
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js — 89 pass, 0 fail"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-03
status: complete
---

# Phase 18 Plan 18-01: Sleep Debt Proxy Summary

**sleepDebtProxy() pure function added to js/lib/metrics.js: filter-then-slice rolling window returning signed debt sum or null on cold-start**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-09-03T09:32:14Z
- **Completed:** 2026-09-03T09:34:29Z
- **Tasks:** 1 (TDD — RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Exported `sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes)` from `js/lib/metrics.js`
- 9 unit tests added in `tests/unit/metrics.test.js` covering all edge and boundary cases
- All 89 tests pass (80 existing + 9 new) with zero regressions
- Two atomic TDD commits: failing test then passing implementation

## Task Commits

1. **Task 1 (RED): add failing tests** - `e96f955` (test)
2. **Task 1 (GREEN): implement sleepDebtProxy** - `1a3c0db` (feat)

## Files Created/Modified

- `js/lib/metrics.js` — added `sleepDebtProxy` export with JSDoc after `dayOfWeekAverages`
- `tests/unit/metrics.test.js` — added `sleepDebtProxy` to import; added `describe('sleepDebtProxy')` block with 9 cases

## Decisions Made

- Used `.filter(day => combinedSleepNap(day) !== null).slice(-windowDays)` for null-exclusion rolling window (D-05, D-07)
- `combinedSleepNap` already in scope in metrics.js — no new imports needed
- Signed reduce with no clamping: positive = deficit, negative = surplus (D-06)
- JSDoc follows `dayOfWeekAverages` pattern exactly (caller pre-filters, @param/@returns tags)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `sleepDebtProxy` ready to import in Plan 18-03 (metrics-screen.js)
- Plan 18-02 (targetSleepMinutes setting) is independent of this plan and can proceed in parallel
- No blockers or concerns

## Self-Check: PASSED

- `js/lib/metrics.js` — confirmed modified (44 lines added)
- `tests/unit/metrics.test.js` — confirmed modified (88 lines added)
- Commit `e96f955` (test) — confirmed in git log
- Commit `1a3c0db` (feat) — confirmed in git log
- All 89 tests pass: `node --test tests/unit/metrics.test.js` → 89 pass, 0 fail

---
*Phase: 18-sleep-debt-proxy*
*Completed: 2026-09-03*
