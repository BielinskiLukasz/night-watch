---
phase: 260908-oir
plan: "01"
subsystem: metrics
tags: [bug-fix, metrics, sleep-debt, overnight-pairing]
status: complete

dependency_graph:
  requires: []
  provides: [sleepDebtProxy-overnight-pairing]
  affects: [js/lib/metrics.js, tests/unit/metrics.test.js]

tech_stack:
  added: []
  patterns: [overnight-cross-day-pairing, rolling-window-filter]

key_files:
  modified:
    - js/lib/metrics.js
    - tests/unit/metrics.test.js

decisions:
  - "sleepDebtProxy now uses prevDay.bedtime → day.wake arithmetic to match aggregateMetrics Comb column (D-06)"
  - "Index 0 always skipped (no prevDay); cold-start null guard requires N+1 records to yield N qualifying pairs"
  - "napDuration(day) still included per original design — combinedSleepNap = sleepDur + napDur when nap present"

metrics:
  duration_minutes: 2
  completed: "2026-09-08"
  tasks_completed: 2
  commits: 2

actuals:
  tokens: 5000
  tasks: 2
  commits: 2
---

# Quick Task 260908-oir: Fix sleepDebtProxy to Use Overnight Cross-Day Pairing

**One-liner:** Replace same-day `combinedSleepNap(day)` with overnight `prevDay.bedtime → day.wake` arithmetic so S.Debt(7d) matches the Comb column in aggregateMetrics.

## Summary

`sleepDebtProxy` was calling `combinedSleepNap(day)` which computes sleep duration from same-day wake and bedtime fields. But `aggregateMetrics` pairs `prevDay.bedtime → day.wake` (overnight cross-day). This meant the S.Debt(7d) rolling debt column was calculated against different sleep values than what the Comb column displayed, producing a visible discrepancy.

Fix: replaced the body of `sleepDebtProxy` with an explicit loop over pairs `(dayRecords[i-1], dayRecords[i])` applying overnight arithmetic identical to the `aggregateMetrics` path. Index 0 is always skipped (no prevDay). Unit tests updated to supply N+1 records where N pairs are needed.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite sleepDebtProxy to use overnight cross-day pairing | 42e761f | js/lib/metrics.js |
| 2 | Update sleepDebtProxy unit tests for overnight-pairing semantics | cbab433 | tests/unit/metrics.test.js |

## Verification

- `node --test tests/unit/metrics.test.js`: 89 tests, 0 failures
- `npm run test:unit`: 795 tests, 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — pure-function change in lib/ with no DOM, storage, or network access.

## Self-Check: PASSED

- js/lib/metrics.js modified (sleepDebtProxy rewritten) ✓
- tests/unit/metrics.test.js modified (array sizes updated) ✓
- Commit 42e761f exists ✓
- Commit cbab433 exists ✓
- All 89 metrics unit tests pass ✓
- All 795 unit tests pass ✓
