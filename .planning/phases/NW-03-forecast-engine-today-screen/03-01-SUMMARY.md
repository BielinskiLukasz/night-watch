---
phase: 03-forecast-engine-today-screen
plan: 01
subsystem: forecast-algorithm
tags: [tdd, pure-logic, percentile, empirical-cdf, downweighting]
dependency_graph:
  requires:
    - js/lib/time.js  # Pattern reference for wall-clock time handling
    - js/lib/day-bucket.js  # Consumer of forecast input shape (daysBySubjectiveNight output)
  provides:
    - js/lib/forecast.js  # Pure forecast algorithm
  affects:
    - js/ui/today-screen.js  # Plan 03-02 will wire forecast() into Today screen
    - js/app.js  # Plan 03-02 will call forecast() from composition root
tech_stack:
  added:
    - Pure JS percentile calculation (linear interpolation, Excel/R type 7)
    - Empirical CDF approach for confidence bands (10th-90th percentiles)
  patterns:
    - TDD RED→GREEN→REFACTOR
    - Object.freeze for FORECAST_CONFIG constants
    - Non-mutating transforms (downweightRejectedDays returns new array)
    - Effective-count downweighting (position formula uses effectiveCount not array.length)
key_files:
  created:
    - js/lib/forecast.js
    - tests/unit/forecast.test.js
  modified: []
decisions:
  - "percentile() uses pos = p × (n + 1) formula (Excel/R type 7) — locks interpolation flavor; tests pin contract"
  - "calculatePercentiles uses effectiveCount in position formula (not array duplication) — cleaner than RESEARCH Pitfall #5 alternative"
  - "timeToMinutes/minutesToTime exported as named functions — enables direct unit testing of time conversion"
  - "minutesToTime applies 5-min rounding via Math.round(.../ 5) * 5 — consistent with Phase 1 LOG-07"
  - "All 4 event types (wake/bedtime/napStart/napEnd) use the same calculatePercentiles code path — DRY by design"
metrics:
  duration: 6min
  completed: 2026-06-04
  tasks: 3
  files: 2
---

# Phase 3 Plan 1: Forecast Algorithm (TDD Pure Logic) Summary

**One-liner:** Empirical CDF forecast via 10th/50th/90th percentile linear interpolation with 0.5x rejected-day downweighting, implemented as pure-logic ES module with 52 unit tests across 9 test groups.

## Commits

| Phase | Hash | Message |
|-------|------|---------|
| RED | a264677 | test(03-01): add failing unit tests for forecast algorithm (RED) |
| GREEN | c3ce268 | feat(03-01): implement forecast algorithm with percentile calculation (GREEN) |
| REFACTOR | 4098d03 | refactor(03-01): harden percentile math and add edge-case tests |

## Test Delta

- Pre-plan: 251 unit + integration tests
- Post-plan: 302 unit + integration tests (+52 forecast tests)
- Forecast-specific: **52 tests in 9 groups** (0 → 52)

All 302 unit + integration tests pass. No regressions on prior phases.

## TDD Gate Compliance

- RED gate: `a264677` — `test(03-01): add failing unit tests for forecast algorithm (RED)` — tests fail because `forecast.js` did not exist
- GREEN gate: `c3ce268` — `feat(03-01): implement forecast algorithm with percentile calculation (GREEN)` — 35 tests pass
- REFACTOR gate: `4098d03` — `refactor(03-01): harden percentile math and add edge-case tests` — 52 tests pass

## Algorithm Notes for Plan 03-02 Integration

- `forecast(dayRecords, settings) → { wake, bedtime, napStart, napEnd }` is **synchronous** and **pure** — no side effects, no I/O
- **O(n log n)** on input window size (the sort dominates; n ≤ 365 but typically 7–90)
- All output times are `'HH:MM'` strings (or `null` if no data for that event type)
- `settings.windowDays` controls rolling window; `settings.minDays` is NOT consumed by forecast() — it is UI-layer cold-start gating (plan 03-02 will read it before calling forecast)
- `dayRecords` input is the output of `daysBySubjectiveNight()` from Phase 1 — shape: `{ wake, bedtime, napStart, napEnd, rejected }`
- **Partial history:** if a day has `wake` but no `bedtime`, the bedtime forecast for that day is skipped gracefully (null filter in `calculatePercentiles`)
- **Cold-start:** if NO days have data for a given event type, `{ central: null, min: null, max: null }` is returned — plan 03-02 uses this to conditionally render cold-start message

## Edge Cases Discovered During TDD

1. **All days rejected (effective count 3.5):** Forecast still returns values — the effective-count formula produces valid (if narrow) percentile positions. Documented as Phase 3+ enhancement if a floor threshold is needed.
2. **Midnight wraparound:** `minutesToTime(1440)` correctly wraps to `'00:00'` via `% (24*60)` modulo.
3. **Non-5-min-aligned intermediate values:** Percentile interpolation can produce fractional minutes (e.g., 392.4). `minutesToTime` rounds to 5-min precision before returning. The test `'06:33' → '06:35'` pins this rounding direction (Math.round).
4. **Window truncation:** `forecast()` uses `Array.slice(length - windowDays)` — confirmed to exclude the correct oldest entries when 10 days are provided with `windowDays=7`.
5. **Sparse event types:** `calculatePercentiles` filters `getTimeFn(d) != null` — days missing a specific event type don't pollute that event's percentile calculation.

## Verification Checklist

- [x] All 52 tests pass (GREEN state after REFACTOR)
- [x] Percentile calculation correct for 10th–90th on arrays [1..7]
- [x] Downweighting applies 0.5× weight to rejected days (effectiveCount in position formula)
- [x] Central prediction is always P50 (median)
- [x] `forecast()` returns `{ wake, bedtime, napStart, napEnd }` each `{ central, min, max }`
- [x] Edge cases: empty array, single element, all rejected days documented
- [x] No mutations of input dayRecords (`downweightRejectedDays` returns new array; spread copies)
- [x] Time conversion round-trips cleanly for 5-minute precision
- [x] No external dependencies (vanilla JS only)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- Plan task 1 specified "verify tests fail via `node --test`" — the test file failed with `ERR_MODULE_NOT_FOUND` (forecast.js not yet existing). This is a valid RED state: the test runner can't load the module, so all tests fail.
- `downweightRejectedDays(days, weight)` is exported and tested but the current `calculatePercentiles` implementation computes weights inline (using `d.rejected ? rejectWeight : 1.0` directly). Both are valid approaches per RESEARCH; the exported helper serves as a utility for Plan 03-02's rendering layer if it needs to show effective weights.

## Known Stubs

None — `forecast.js` is fully implemented. The CFG-04 auto-outlier detection comment block is an intentional future-enhancement placeholder (deferred per 03-CONTEXT.md §Deferred) with no impact on current functionality.

## Threat Flags

No new trust boundaries introduced. `forecast.js` is pure logic that reads from validated stores; it introduces no new network endpoints, auth paths, file access patterns, or schema changes. T-03-01, T-03-02, T-03-03 from plan threat model are addressed (see plan).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `js/lib/forecast.js` exists | FOUND |
| `tests/unit/forecast.test.js` exists | FOUND |
| `03-01-SUMMARY.md` exists | FOUND |
| RED commit `a264677` | FOUND |
| GREEN commit `c3ce268` | FOUND |
| REFACTOR commit `4098d03` | FOUND |
| 52 tests pass | VERIFIED |
| No regressions (302 total unit+integration pass) | VERIFIED |
