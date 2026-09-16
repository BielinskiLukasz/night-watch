---
status: testing
phase: 19-split-bedtime-wake-anchored-nap
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md
started: 2026-09-14T21:02:18Z
updated: 2026-09-14T21:02:18Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 6
name: Wake-Anchored Nap Start Prediction
expected: |
  With today's wake time logged, open the Today screen. The nap-start
  prediction should reflect wake time + the historical nap-gap distribution
  (P10/P50/P90). If today's wake has NOT been logged, the nap-start prediction
  falls back to the historical time-of-day forecast (the same value as before
  this phase).
awaiting: user response

## Tests

### 1. percentileFromArray exported and functional
expected: percentileFromArray(values, pct) exported from forecast.js — sorts internally, returns null for empty input, interpolated value otherwise
result: pass
source: automated
coverage_id: D1

### 2. buildNapGapSeries returns correct number array
expected: buildNapGapSeries(dayRecords) returns plain number[] of (napStart−wake) minutes with null-skip and midnight-crossover handling
result: pass
source: automated
coverage_id: D2

### 3. buildNapDurationSeries returns correct number array
expected: buildNapDurationSeries(dayRecords) returns plain number[] of (napEnd−napStart) minutes with null-skip and midnight-crossover handling
result: pass
source: automated
coverage_id: D3

### 4. buildBedtimeSeriesNapDay handles cold-start guard
expected: buildBedtimeSeriesNapDay(dayRecords, settings) returns {min,central,max} integer minutes for nap-day sub-window; returns null below minDays threshold
result: pass
source: automated
coverage_id: D4

### 5. buildBedtimeSeriesNoNapDay handles cold-start guard
expected: buildBedtimeSeriesNoNapDay(dayRecords, settings) returns {min,central,max} integer minutes for no-nap-day sub-window; returns null below minDays threshold
result: pass
source: automated
coverage_id: D5

### 6. Wake-Anchored Nap Start Prediction
expected: With today's wake time logged, open the Today screen. The nap-start prediction should reflect wake time + the historical nap-gap distribution (P10/P50/P90). If today's wake has NOT been logged, the nap-start prediction falls back to the historical time-of-day forecast (the same value as before this phase).
result: [pending]

### 7. Nap End Anchored to Nap Start
expected: When nap start is already logged for today, the nap-end prediction anchors to that actual nap-start time (actual + historical nap-duration P10/P50/P90). When nap start is predicted but not yet logged, the nap-end prediction anchors to the predicted nap-start central value.
result: [pending]

### 8. Split Bedtime Prediction
expected: Bedtime prediction on the Today screen adapts based on nap status: if a nap was logged today, it uses the nap-day sub-window series; if a nap probability score is available with enough history, it shows a probability-weighted blend; otherwise falls back to the full historical window. The prediction should visually change when nap status changes within the same day.
result: [pending]

## Summary

total: 8
passed: 5
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

[none yet]
