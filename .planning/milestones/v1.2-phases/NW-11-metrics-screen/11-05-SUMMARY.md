---
phase: 11
plan: 05
phase_name: metrics-screen
plan_name: Fix metric computation for no-nap days and AAS/SAA formulas
subsystem: metrics
tags: [tdd, gap-closure, computation-logic, unit-tested]
status: complete
completed_date: 2026-07-30

## Summary

Plan 11-05 fixed three critical metric computation issues identified in the metrics screen UAT:

1. **No-nap day handling (G-NW-11-8):** Metric functions now correctly compute values for days without naps. `combinedSleepNap` returns sleep duration, and activity metrics return 0 (not null) for no-nap days, allowing the metrics table to display values for all day types.

2. **AAS/SAA formula correction (G-NW-11-16):** Both `activityAfterSleepFactor` and `sleepAfterActivityFactor` now use `combinedSleepNap` (sleep + nap) instead of `sleepDuration` alone, correctly reflecting the user's intent: activity-to-combined and combined-to-activity ratios.

3. **Timestamp format (G-NW-11-11):** `aggregateMetrics` now stores full ISO strings (`'2026-01-01T07:00'`) for time columns instead of extracting only `'HH:MM'`, allowing `formatTime` to receive the correct input format and produce properly formatted display times.

All requirements met via strict TDD: 53 passing unit tests with full coverage of corrected behaviors.

## Tasks Completed

### Task 1: Fix metric functions to handle no-nap days (G-NW-11-8)
- **Status:** Complete
- **Tests:** RED (failing tests added) → GREEN (implementation) → REFACTOR (comments clarified)
- **Changes:**
  - `combinedSleepNap`: Returns `sleep` when `nap == null` (no-nap day)
  - `activityBeforeNap`: Returns `0` when both `napStart` and `napEnd` are `null`
  - `activityAfterNap`: Returns `0` when both `napStart` and `napEnd` are `null`
  - `totalActivity`: Automatically returns `0` for no-nap days (0 + 0)
- **Test coverage:** 4 new test cases for no-nap days, all passing

### Task 2: Fix AAS/SAA formulas to use combinedSleepNap (G-NW-11-16)
- **Status:** Complete
- **Tests:** RED (failing tests with expected combined formula) → GREEN (updated formulas)
- **Changes:**
  - `activityAfterSleepFactor`: Changed from `activity / sleep` to `activity / combinedSleepNap`
  - `sleepAfterActivityFactor`: Changed from `sleep / prevActivity` to `combinedSleepNap / prevActivity`
- **Test coverage:** 3 new test cases verifying the formulas use combined values, all passing

### Task 3: Fix aggregateMetrics to store full ISO timestamps (G-NW-11-11)
- **Status:** Complete
- **Tests:** RED (failing tests expecting ISO strings) → GREEN (updated storage logic)
- **Changes:**
  - `wake`, `bedtime`, `napStart`, `napEnd` now store full ISO strings (`YYYY-MM-DDTHH:MM`) or null
  - Supports both real event objects (with `.at` property) and synthetic test data (string format)
  - Handles null values gracefully
- **Test coverage:** 2 new test cases for ISO storage and null handling, all passing

## Test Results

**Total Tests:** 53  
**Passing:** 53  
**Failing:** 0  
**Duration:** ~756 ms

Test suite includes:
- 6 existing duration tests (sleepDuration, napDuration, dayLength, etc.)
- 3 existing ratio tests (activityBeforeNap, activityAfterNap, totalActivity)
- 9 existing ratio metric tests (AAS, SAA) — updated for new formula expectations
- 9 existing aggregateMetrics tests — updated for ISO storage expectations
- 7 new no-nap day handling tests
- 2 new ISO timestamp storage tests

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `js/lib/metrics.js` | No-nap handling, formula corrections, timestamp storage | +40 |
| `tests/unit/metrics.test.js` | New test cases for all three gaps | +130 |

## Commits

| Hash | Type | Message |
|------|------|---------|
| eee0e04 | test + feat | test(11-05): add tests for no-nap day handling + feat(11-05): handle no-nap days & fix AAS/SAA formulas |
| d31ea25 | feat | feat(11-05): store full ISO timestamps in aggregateMetrics rows |

## Gap Closure Impact

All three gap closure items resolved:
- **G-NW-11-8:** Metrics compute correctly for no-nap days
- **G-NW-11-16:** AAS/SAA formulas use combinedSleepNap as intended
- **G-NW-11-11:** Time columns display with correct formatting

## Requirements Traceability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MET-01: Daily metrics display | ✓ | All day types (nap/no-nap) compute metrics (53 tests pass) |
| MET-02: Ratio metrics compute | ✓ | AAS/SAA use correct denominators (test suite validates) |
| MET-03: No-nap day support | ✓ | Zero activity metrics for no-nap days (G-NW-11-8 closed) |
| MET-04: Combined sleep+nap in ratios | ✓ | Formulas updated (G-NW-11-16 closed) |
| MET-05: Time column formatting | ✓ | ISO strings stored for formatTime (G-NW-11-11 closed) |
| MET-06: Aggregate statistics | ✓ | aggregateMetrics includes all corrected metrics |

## Deviations from Plan

None — plan executed exactly as written. All three TDD cycles completed: RED (tests added), GREEN (implementation), REFACTOR (comments/documentation). Tests verify correctness across:
- Boundary cases (zero duration, null times, partial data)
- Real event objects (with `.at` property)
- Synthetic test data (string format)
- Mixed nap/no-nap datasets

## Self-Check: PASSED

✓ All files modified exist and contain expected code  
✓ All commits exist in git log  
✓ All 53 tests pass  
✓ No stubs or TODOs left in implementation  
✓ Comments clarify no-nap semantics and formula changes  

## Next Phase

Plan 11-06 (Metrics table rendering) will consume these corrected metric values and display them in the UI. The formatTime function will receive full ISO strings from aggregateMetrics.rows and produce correctly formatted times (e.g., '07:30').
