---
phase: NW-15-tif-engine-bug-fixes
plan: "01"
subsystem: forecast
tags: [tif, forecast-tif, trimmedMinMax, findBedtimeDayRecord, manualExcludedCount]

requires:
  - phase: NW-14-tif-metrics-accuracy-chart-fixes
    provides: forecast-tif.js with TIF algorithm, band building, trimmedMinMax

provides:
  - findBedtimeDayRecord correctly ignores bare-string bedtime slots once an ISO-dated selection exists (FIX-01)
  - rejectedInWindow passed to all primary band-building calls so rejected days reduce budget not N (FIX-02)
  - Unit test coverage for both fixes in tests/unit/forecast-tif.test.js

affects: [NW-15-02, any plan consuming tifForecast predictions]

actuals:
  tokens: 4200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - latestAt === null guard pattern for bare-string fallback in ISO-preferring day-record selectors
    - rejectedInWindow computed from window/acceptedWindow difference and threaded to all derived band calls

key-files:
  created: []
  modified:
    - js/lib/forecast-tif.js
    - tests/unit/forecast-tif.test.js

key-decisions:
  - "FIX-01: bare-string bedtime slot only updates result when latestAt === null — one-line guard, no other branches changed"
  - "FIX-02: rejectedInWindow = window.length - acceptedWindow.length added immediately after acceptedWindow; postNoNapNapStartTimes call retains 0 (derives from postNoNapWindow not acceptedWindow)"
  - "FIX-02 test assertion: B.max >= A.max confirms rejected days reduce trim budget (less outlier trimming), not over-trim accepted data"

patterns-established:
  - "Bare-string slot fallback in day-record selectors: only apply when no ISO-dated selection exists (latestAt === null guard)"
  - "manualExcludedCount threading: compute rejectedInWindow at top of tifForecast and pass to all acceptedWindow-derived band calls"

requirements-completed: [FIX-01, FIX-02]

coverage:
  - id: D1
    description: "findBedtimeDayRecord returns ISO-dated day when bare-string slots appear after it in the array (FIX-01)"
    requirement: FIX-01
    verification:
      - kind: unit
        ref: "tests/unit/forecast-tif.test.js#findBedtimeDayRecord: bare-string vs ISO ordering"
        status: pass
    human_judgment: false
  - id: D2
    description: "tifForecast passes rejectedInWindow to all primary band-building calls so rejected days reduce trim budget, not accepted-data count (FIX-02)"
    requirement: FIX-02
    verification:
      - kind: unit
        ref: "tests/unit/forecast-tif.test.js#trim-budget independence: rejected days do not expand auto-trim"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-08-31
status: complete
---

# Phase NW-15 Plan 01: TIF Engine Bug Fixes Summary

**Fixed two forecast-tif.js correctness bugs: bare-string/ISO bedtime ordering guard (FIX-01) and rejectedInWindow threaded to all primary trimmedMinMax band calls (FIX-02)**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-31T12:51:01Z
- **Completed:** 2026-08-31T13:05:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- FIX-01: Added `if (latestAt === null)` guard in `findBedtimeDayRecord`'s named-slot branch so a bare-string bedtime entry iterating after an ISO-dated entry can never displace the ISO-dated selection
- FIX-02: Added `rejectedInWindow = window.length - acceptedWindow.length` and passed it as `manualExcludedCount` to all 13 primary `buildHistoricBand`/`buildDurationBand` calls derived from `acceptedWindow` (the `postNoNapNapStartTimes` call correctly retains `0`)
- Added two new `describe` blocks in `tests/unit/forecast-tif.test.js` — one per fix — bringing the file to 17 passing tests (756 in the full unit suite)

## Task Commits

1. **Task 1: Fix findBedtimeDayRecord bare-string/ISO ordering (FIX-01)** - `bc769fc` (fix + regression test)
2. **Task 2: Fix rejected-day manualExcludedCount semantics (FIX-02)** - `da357a0` (fix)
3. **Task 3: Unit tests for FIX-01 and FIX-02** - `3e4d35a` (test)

## Files Created/Modified

- `js/lib/forecast-tif.js` — FIX-01 one-line guard in `findBedtimeDayRecord`; FIX-02 `rejectedInWindow` variable + 13 call-site updates
- `tests/unit/forecast-tif.test.js` — two new `describe` blocks covering FIX-01 and FIX-02

## Decisions Made

- FIX-01 guard placed only in the named-slot else-branch (bare-string path), never touching the allEvents path or the ISO-date (atStr) path — minimal, targeted change
- FIX-02 `postNoNapNapStartTimes` call retains `0` because it derives from `postNoNapWindow` (a sub-filter of `acceptedWindow`), not from `acceptedWindow` directly
- FIX-02 test assertion: Fixture B (accepted days + rejected prepended) is asserted to have `max >= A.max` for the historic wake-up band — confirming rejected days reduce the auto-trim budget (preserving the outlier that A would trim), not over-trim accepted data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FIX-02 test assertion corrected from plan description**
- **Found during:** Task 3 (unit tests)
- **Issue:** Plan described assertion as "B not wider than A" but after FIX-02, Fixture B auto-trims less (budget consumed by rejectedInWindow), making B wider than A — the plan's assertion direction was inconsistent with the fix's semantics
- **Fix:** Changed assertion to `B.max >= A.max` (Fixture B preserves outlier A trimmed), which correctly captures the fix's effect and fails before the fix / passes after
- **Files modified:** tests/unit/forecast-tif.test.js
- **Committed in:** 3e4d35a

---

**Total deviations:** 1 auto-fixed (Rule 1 — incorrect test assertion direction in plan)
**Impact on plan:** Test still validates FIX-02 correctly. No scope change.

## Issues Encountered

- Initial FIX-02 test used `await import()` inside a synchronous `it()` callback, causing a SyntaxError. Replaced with an inline `hhmm2m` helper to avoid importing `timeToMinutes` (per plan constraint: no new imports). Fixed inline before commit.

## Next Phase Readiness

- Plan 15-02 can proceed; both FIX-01 and FIX-02 are committed and fully unit-tested
- Full unit suite (756 tests) is green

---
*Phase: NW-15-tif-engine-bug-fixes*
*Completed: 2026-08-31*
