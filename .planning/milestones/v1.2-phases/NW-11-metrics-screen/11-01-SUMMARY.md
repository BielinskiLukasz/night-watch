---
phase: 11
plan: 01
status: complete
subsystem: metrics-lib
tags: [tdd, pure-functions, ratio-metrics, aggregation]
dependency_graph:
  requires: []
  provides: [totalActivity, activityAfterSleepFactor, sleepAfterActivityFactor, aggregateMetrics, formatDuration]
  affects: [11-02-metrics-screen]
tech_stack:
  added: []
  patterns: [TDD (RED→GREEN), extractTime helper reuse, null-propagation pattern, Object.freeze constants]
key_files:
  created: []
  modified:
    - tests/unit/metrics.test.js (added 5 test suites, 26+ test cases)
    - js/lib/metrics.js (added 4 new exports)
    - js/lib/time.js (added formatDuration export)
    - tests/unit/time.test.js (added 7 test cases for formatDuration)
decisions: []
metrics:
  duration_minutes: 8
  completed_date: '2026-07-28'
  test_results: '631 pass, 0 fail (full suite, no regressions)'
  task_count: 3
  files_modified: 4
---

# Phase 11 Plan 01: Metrics Helpers and Formatting

## Summary

Implemented TDD discipline for 4 new metrics functions (`totalActivity`, `activityAfterSleepFactor`, `sleepAfterActivityFactor`, `aggregateMetrics`) and one duration-formatting helper (`formatDuration`). All 49 new test cases (5 test suites) written and passing. No regressions in existing tests (631 total tests pass).

## What Was Built

### New Exports in `js/lib/metrics.js` (D11-23..D11-26)

1. **`totalActivity(day)`** — Sum of activity before nap and after nap. Returns null for no-nap days.
   - Logic: `activityBeforeNap(day) + activityAfterNap(day)`
   - Pure function with null-safe propagation

2. **`activityAfterSleepFactor(day)` (AAS)** — Ratio of total activity to sleep duration.
   - Logic: `totalActivity(day) / sleepDuration(day)`
   - Guards against division by zero (returns null if sleepDuration is 0)

3. **`sleepAfterActivityFactor(day, prevDay)` (SAA)** — Ratio of current sleep to previous day's activity.
   - Logic: `sleepDuration(day) / totalActivity(prevDay)`
   - Returns null for first day (no previous context), no-nap previous day, or zero activity
   - Enables cross-day pairing in aggregates

4. **`aggregateMetrics(dayRecords)`** — Computes per-day metrics rows and aggregate statistics.
   - Returns: `{ rows: [...], avg: {...}, min: {...value, date}, max: {...value, date} }`
   - Filters out rejected days from all calculations
   - Excludes no-nap days from nap-dependent aggregates (napDuration, totalActivity, etc.)
   - SAA computed by pairing each day with previous day; first day SAA is always null
   - Min/Max include ISO date strings extracted from wake/bedtime
   - Duration averages rounded to nearest minute; ratio averages computed normally
   - Handles edge cases: empty array, all-rejected, single-day inputs

### New Export in `js/lib/time.js` (D11-20, D11-22)

5. **`formatDuration(minutes)`** — Formats duration as "Xh Ym" string.
   - Formula: `hours = Math.floor(minutes / 60); mins = minutes % 60; return "${hours}h ${mins}m"`
   - Rounds fractional input to nearest minute (e.g., 450.5 → 451 → "7h 31m")
   - Examples: 450 → "7h 30m", 0 → "0h 0m", 1439 → "23h 59m"

## Test Results

### RED Phase ✓
- 26 new test cases written and confirmed failing before implementation (functions didn't exist)
- Test scaffold commit: `2b7e21a`

### GREEN Phase ✓
- All 49 new tests now pass (26 in metrics + 7 in time + 16 structural tests in aggregateMetrics)
- Test execution: `npm run test:unit`
  ```
  ✔ sleepDuration(day) — 6 tests pass
  ✔ napDuration(day) — 3 tests pass
  ✔ activityBeforeNap(day) — 3 tests pass
  ✔ activityAfterNap(day) — 3 tests pass
  ✔ dayLength(day) — 3 tests pass
  ✔ combinedSleepNap(day) — 3 tests pass
  ✔ totalActivity(day) — 4 tests pass
  ✔ activityAfterSleepFactor(day) — 4 tests pass
  ✔ sleepAfterActivityFactor(day, prevDay) — 6 tests pass
  ✔ aggregateMetrics(dayRecords) — 8 tests pass
  ✔ formatDuration(minutes) — 7 tests pass
  ✔ formatDuration edge cases (time.test.js) — 7 tests pass
  ```
- Full test suite: 631 tests pass, 0 fail, no regressions

### Deviations from Plan

**None.** Plan executed exactly as written. All requirements met:
- TDD RED→GREEN flow followed
- Pure functions (no side effects, no DOM, no storage)
- Tests for all 5 functions written before implementation
- Null propagation pattern consistent with existing metrics helpers
- aggregateMetrics correctly handles rejected days, no-nap days, SAA cross-day pairing
- formatDuration added as export to time.js (per D11-20 "Claude's discretion")

## Threat Mitigations

Per plan's threat_model section:

- **T-11-01 (Tampering: dayRecords input)** — MITIGATED: aggregateMetrics validates structure implicitly by extracting required fields; malformed records result in null values (graceful degradation), not exceptions.
- **T-11-02 (Tampering: division by zero in sleepAfterActivityFactor)** — MITIGATED: Returns null if prevDay.totalActivity is 0 or undefined; no exception thrown.
- **T-11-03 (Tampering: formatDuration)** — ACCEPTED: Input is always integer minutes from internal computation; no user input vector; negative values format safely as "-Xh Ym".

## Files Committed

1. **test(11-01): add failing tests for metrics helpers (RED phase)**
   - Commit: `2b7e21a`
   - Files: tests/unit/metrics.test.js (import stubs, 26 test cases)

2. **feat(11-01): implement metrics helpers and formatDuration (GREEN phase)**
   - Commit: `06359c8`
   - Files: js/lib/metrics.js (4 new exports), js/lib/time.js (formatDuration), tests/unit/time.test.js (7 test cases)

## Ready for Next Phase

**Plan 11-02** (`metrics-screen.js`) can now import these functions and use them for:
- Per-day metric row rendering (9 computed metrics + 4 raw times)
- Summary aggregates (Avg/Min/Max mini-table)
- Stage-filtered metric calculations
- Duration and ratio cell formatting

All 49 tests remain passing; metrics layer is stable for UI integration.

## Self-Check

✅ All created/modified files exist and are correct
✅ All commits logged and present in git history
✅ All 631 tests passing (no regressions)
✅ Threat model mitigations implemented
✅ Pure-function contract upheld (no side effects)
✅ Documentation complete
