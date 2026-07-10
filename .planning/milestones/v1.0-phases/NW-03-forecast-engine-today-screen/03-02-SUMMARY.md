---
phase: 03-forecast-engine-today-screen
plan: 02
subsystem: forecast-algorithm
tags: [tdd, pure-logic, probability-band, cold-start, uncertainty-handling]
dependency_graph:
  requires:
    - js/lib/forecast.js  # Extended with new exports
    - tests/unit/forecast.test.js  # Extended test suite
  provides:
    - js/lib/forecast.js  # generateProbabilityBand, detectColdStart, updated forecast()
  affects:
    - js/ui/today-screen.js  # Plan 03-03 will wire isColdStart and probabilityBand into UI
    - js/app.js  # Plan 03-03 will call updated forecast() from composition root
tech_stack:
  added:
    - Cumulative empirical CDF probability table generation (D3-04)
    - Cold-start gate (D3-06) — validDayCount threshold suppresses predictions
  patterns:
    - TDD RED→GREEN→REFACTOR
    - Strict > threshold for probability-band activation (not >=)
    - Monotonic cumulative distribution table at 5-min steps
decisions:
  - "D3-04 threshold uses strict > maxDelta (not >=): at exactly maxDelta width the central-time card is still usable; crossing the threshold signals uncertainty is actively misleading"
  - "Cold-start gate runs before window slicing: counts ALL available history (not just window) to give the user accurate remaining-day count"
  - "detectColdStart counts non-rejected days only: rejected days do not contribute toward the minDays threshold (parallel to D3-03 downweighting logic)"
  - "generateProbabilityBand handles numeric minutes throughout: converts to HH:MM only at output (minutesToTime) — consistent with percentile module pattern"
  - "forecast() now returns isColdStart flag in all cases: allows caller to check result.isColdStart once rather than checking for missing wake/bedtime keys"
  - "Existing tests updated to account for new isColdStart field and probabilityBand shape when band > maxDelta"
metrics:
  duration: 7min
  completed: 2026-06-04
  tasks: 3
  files: 2
---

# Phase 3 Plan 2: Probability-Band Fallback and Cold-Start Gating (TDD) Summary

**One-liner:** Probability-band fallback (cumulative P(event by T) table when band width > maxDelta) and cold-start gate (isColdStart flag suppresses all predictions when validDayCount < minDays), implemented as pure-logic extensions to forecast.js with 24 new unit tests across 4 test groups.

## Commits

| Phase | Hash | Message |
|-------|------|---------|
| RED | 208ca38 | test(03-02): add failing tests for probability band and cold-start (RED) |
| GREEN | a535872 | feat(03-02): implement probability-band fallback and cold-start gating (GREEN) |
| REFACTOR | c747794 | refactor(03-02): harden probability-band generation and improve edge-case handling |

## Test Delta

- Pre-plan: 52 forecast unit tests
- Post-plan: 76 forecast unit tests (+24 new tests across 4 groups)
- Also pass: 186 total tests (unit + integration), 0 regressions

### New test groups added

| Group | Tests | Description |
|-------|-------|-------------|
| 10 | 8 | `generateProbabilityBand()` — band threshold, table shape, alignment, P10 probability |
| 11 | 5 | `detectColdStart()` — 0 days, 5/7, 6/7 (1 rejected), 7/7, minDays=0 |
| 12 | 5 | `generateProbabilityBand()` edge cases — empty, single, exact boundary, +1, wide band |
| 13 | 3 | `detectColdStart()` edge cases — all-rejected, exactly=minDays, exceeds minDays |

### Existing tests updated

Three tests in group 5 (`forecast(dayRecords, settings)`) were updated to match the new return shape:
- "each prediction has { central, min, max } shape" → now asserts either normal or probabilityBand shape
- "central prediction is an HH:MM string" → scoped to wake prediction (narrow band)
- "min and max are HH:MM strings" → scoped to wake prediction (narrow band)
- "empty day records returns null for all events" → split into cold-start path (minDays>0) and null path (minDays=0)

One test in group 6 ("all days rejected") was updated to reflect that cold-start gate fires before percentile math when minDays>0, and uses minDays=0 to test the percentile behavior in isolation.

## TDD Gate Compliance

- RED gate: `208ca38` — test file loaded but failed at module import (`detectColdStart` not exported) — all tests fail; RED confirmed
- GREEN gate: `a535872` — all 67 tests pass (52 original + 15 new); GREEN confirmed
- REFACTOR gate: `c747794` — all 76 tests pass (added 9 more edge-case tests); REFACTOR confirmed

## API Changes for Plan 03-03 Integration

### New exports

```js
// generateProbabilityBand(times, p10, p90, maxDelta, step=5) → null | [{time: 'HH:MM', prob: N}]
// detectColdStart(dayRecords, minDays) → { isColdStart, validDayCount, minDaysRemaining? }
```

### Updated forecast() return shape

```js
// Cold-start active (validDayCount < minDays):
{ isColdStart: true, validDayCount: N, minDaysRemaining: M }

// Normal operation:
{
  isColdStart: false,
  wake:     { central, min, max }         // band width ≤ maxDelta
         OR { probabilityBand: [{time, prob}, ...] }  // band width > maxDelta
  bedtime:  ...same shape...
  napStart: ...same shape...
  napEnd:   ...same shape...
}
```

### Probability-band threshold clarification (D3-04)

- Threshold: **strictly greater than** (`>`) maxDelta, not `>=`
- At width == maxDelta: `{ central, min, max }` (normal UI)
- At width == maxDelta + 1: `{ probabilityBand: [...] }` (fallback UI)
- Rationale: the central-time card remains useful at exactly maxDelta; the fallback activates only when uncertainty crosses the threshold

### Cold-start behavior notes (D3-06)

- `detectColdStart` counts non-rejected days only (rejected days excluded from the minDays threshold)
- Called before window slicing — uses full history for accurate "log N more days" count
- When `isColdStart = true`: no wake/bedtime/napStart/napEnd fields on the result
- Plan 03-03 should check `result.isColdStart` first, then branch to cold-start UI vs prediction cards

## Edge Cases Discovered During TDD

1. **sevenFullDays bedtime triggers probability band in existing tests:** The 7-day test fixture spans 21:00–22:00 (60 min) for bedtime, which exceeds maxDelta=30. Existing tests that checked for `{ central, min, max }` shape on all events had to be updated — wake (30 min == maxDelta) uses normal shape, bedtime uses probabilityBand.

2. **Cold-start + all-rejected interaction:** With minDays=7 and 7 rejected days (validDayCount=0), cold-start fires first. The effective-count percentile math (D3-03) never runs. Test updated to document this interaction explicitly.

3. **minDays=0 edge case:** When minDays=0, `validDayCount >= 0` is always true, so cold-start never activates. Existing tests that used empty dayRecords with minDays=0 to test null predictions continue to work correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing test fixtures trigger probabilityBand shape after forecast() update**
- **Found during:** Task 2 (GREEN)
- **Issue:** `sevenFullDays` bedtime spans 60 min (21:00–22:00), exceeding maxDelta=30. After implementing `generateProbabilityBand()` inside `forecast()`, existing tests that expected `{ central, min, max }` on all event types failed because bedtime returned `{ probabilityBand: [...] }` instead.
- **Fix:** Updated 5 tests in group 5 to correctly assert either shape (normal or probabilityBand) and scoped the HH:MM assertions to the wake prediction (which has a 30-min band == maxDelta, staying in normal shape).
- **Files modified:** `tests/unit/forecast.test.js`
- **Commit:** a535872

**2. [Rule 1 - Bug] All-rejected edge-case test inconsistent with new cold-start behavior**
- **Found during:** Task 2 (GREEN)
- **Issue:** Group 6 test "all days rejected: forecast still returns values" used minDays=7 but all-rejected days give validDayCount=0, triggering cold-start. The test then accessed `result.wake.central` which was undefined.
- **Fix:** Updated test to assert that cold-start fires (isColdStart=true) with minDays=7, and separately demonstrate percentile behavior with minDays=0 to bypass the gate.
- **Files modified:** `tests/unit/forecast.test.js`
- **Commit:** a535872

## Known Stubs

None — all functions are fully implemented. `forecast()` returns the complete shape including `isColdStart`, `probabilityBand`, and `{ central, min, max }` as appropriate.

## Threat Flags

No new trust boundaries introduced. `generateProbabilityBand` and `detectColdStart` are pure logic reading from validated stores. T-03-05 (DoS via wide band) is mitigated — fixed 5-min step cap limits loop iterations to at most `(p90-p10)/5` points (e.g., 1000-min span = 200 iterations).

## Verification Checklist

- [x] All 76 tests pass (GREEN state after REFACTOR)
- [x] Probability bands generated when band width > maxDelta
- [x] Probability bands NOT generated when band width <= maxDelta (boundary: == returns null)
- [x] Cold-start gate activates when validDayCount < minDays
- [x] Cold-start gate deactivates when validDayCount >= minDays
- [x] forecast() returns isColdStart flag in all return paths
- [x] forecast() returns probabilityBand array for high-uncertainty predictions
- [x] forecast() returns { central, min, max } for low-uncertainty predictions
- [x] Edge cases: empty times, single element, boundary thresholds all handled
- [x] Test suite includes 24 new test cases for probability-band and cold-start logic
- [x] Threshold logic documented with inline comments (D3-04)
- [x] No regressions on prior phases (186 total unit+integration tests pass)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `js/lib/forecast.js` exists | FOUND |
| `tests/unit/forecast.test.js` exists | FOUND |
| `03-02-SUMMARY.md` exists | FOUND |
| RED commit `208ca38` | FOUND |
| GREEN commit `a535872` | FOUND |
| REFACTOR commit `c747794` | FOUND |
| 76 forecast tests pass | VERIFIED |
| 186 total unit+integration tests pass | VERIFIED |
| No regressions | VERIFIED |
