---
status: complete
phase: 18-sleep-debt-proxy
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md, 18-03-SUMMARY.md
started: 2026-09-03T10:10:00Z
updated: 2026-09-04T07:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. sleepDebtProxy exported with correct 3-parameter signature
expected: sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes) exported from js/lib/metrics.js — returns signed debt sum (positive = deficit, negative = surplus) or null on cold-start
result: pass
source: automated
coverage_id: D1

### 2. No existing test regressions (89 unit tests)
expected: All 80 prior unit tests in metrics.test.js continue to pass alongside the 9 new sleepDebtProxy tests
result: pass
source: automated
coverage_id: D2

### 3. Target Sleep Minutes in Settings modal
expected: Open the Settings modal. A "Target Sleep" number input appears (with a default of 600, step 5, min 1, max 1440). The current value shows 600 (10h) on a fresh install. Changing it and saving persists the new value — re-opening Settings shows the updated number.
result: pass

### 4. Median hint in Settings modal
expected: Below the Target Sleep input, a hint line reads "Your median: Xh Ym" (e.g. "Your median: 9h 15m") when sleep history exists. If no history is present the hint area is blank (not an error).
result: pass

### 5. S.Debt column visible in Metrics screen
expected: Navigate to the Metrics screen. A new "S.Debt" column header appears between "Comb" and "Day Len" (19 columns total). Per-day rows show "—" until at least 7 non-rejected days of history exist; qualifying rows show the rolling 7-day signed sleep debt formatted as ±h:mm.
result: issue
reported: "pass but how it is calculated? For example I set sleep time to 690 minutes and for day with combined sleep time 600 minutes I got only 20 minutes debt (shouldnt it be 90 minutes?)"
severity: major

### 6. S.Debt in aggregate sections
expected: The All-Time, 7-day rolling, and 14-day rolling aggregate sections each show avg / min / max values for S.Debt. Cold-start rows that have no qualifying data show "—".
result: issue
reported: "pass/fail its not visible in 7-day rolling (and its invisible for other, 140day rolling included)"
severity: major

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-18-5
  truth: "Per-day S.Debt cell shows the correct rolling 7-day debt for that day (e.g. target=690, actual=600 on that day → expected 90 min deficit visible)"
  status: failed
  reason: "User reported: pass but how it is calculated? For example I set sleep time to 690 minutes and for day with combined sleep time 600 minutes I got only 20 minutes debt (shouldnt it be 90 minutes?)"
  severity: major
  test: 5
  root_cause: "UX mismatch, not a calculation bug. sleepDebtProxy correctly sums (target−actual) over the last 7 qualifying days; with 6 surplus days totaling 70 min offset, the net is 20 min debt. The column label 'S.Debt' does not communicate that it is a 7-day rolling accumulated sum rather than a per-day delta."
  artifacts:
    - path: "js/ui/metrics-screen.js"
      issue: "COLUMNS entry at line 54 uses label 'S.Debt' with no indication of the 7-day rolling window"
  missing:
    - "Rename column label from 'S.Debt' to 'S.Debt(7d)' in COLUMNS (js/ui/metrics-screen.js line 54)"
  debug_session: "parallel debug agent a765197036b4140e6"

- gap_id: G-18-6
  truth: "S.Debt column shows values in the 7-day rolling and 14-day rolling aggregate sections"
  status: failed
  reason: "User reported: pass/fail its not visible in 7-day rolling (and its invisible for other, 140day rolling included)"
  severity: major
  test: 6
  root_cause: "In buildRollingSection, sleepDebtProxy is called with slice.slice(0, i+1) — bounded to the rolling window (max 7 records for the 7-day section). sleepDebtProxy's cold-start guard (return null when fewer than windowDays=7 qualifying records) fires for all but the last row, and any day with null combinedSleepNap drops the count below 7, making all aggregate cells show '—'. Per-day rows work because they pass the full non-rejected history."
  artifacts:
    - path: "js/ui/metrics-screen.js"
      issue: "buildRollingSection line ~446: sleepDebtProxy(slice.slice(0, i+1), 7, ...) uses bounded slice instead of full history — cold-start guard misfires"
  missing:
    - "Replace bounded slice with full-history slicing using sliceOffset: sleepDebtProxy(nonRejectedDays.slice(0, sliceOffset+i+1), 7, snap.targetSleepMinutes)"
    - "Add E2E test asserting rolling aggregate S.Debt shows real values (not '—') when 13+ qualifying days are seeded"
  debug_session: "parallel debug agent a84509718c74f50dd"
