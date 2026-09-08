---
status: complete
phase: NW-15-tif-engine-bug-fixes
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md
started: 2026-08-31T13:30:00Z
updated: 2026-08-31T13:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Auto-coverage confirmation (15-01 deliverables)
expected: Two TIF engine fixes are fully covered by passing unit tests — no manual testing needed.
result: pass

### 2. TIF Metrics Screen integrity after FIX-03
expected: With TIF mode enabled, the Metrics screen displays TIF trimmed stats correctly (e.g. nap and night windows are shown) — no visible regression from removing the redundant tifForecast double-call from render().
result: pass

### 3. Auto: findBedtimeDayRecord bare-string ordering (D1)
expected: findBedtimeDayRecord returns ISO-dated day when bare-string slots appear after it in the array (FIX-01)
result: pass
source: automated
coverage_id: D1

### 4. Auto: rejectedInWindow passed to band-building calls (D2)
expected: tifForecast passes rejectedInWindow to all primary band-building calls so rejected days reduce trim budget, not accepted-data count (FIX-02)
result: pass
source: automated
coverage_id: D2

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
