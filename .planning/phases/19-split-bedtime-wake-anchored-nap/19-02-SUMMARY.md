---
phase: 19-split-bedtime-wake-anchored-nap
plan: "02"
subsystem: forecast
status: complete
tags: [forecast, nap-prediction, wake-anchor, bedtime-routing, schema-cleanup]

dependency_graph:
  requires:
    - "19-01"   # buildNapGapSeries, buildNapDurationSeries, buildBedtimeSeriesNapDay, buildBedtimeSeriesNoNapDay, percentileFromArray
  provides:
    - "PRED-18"  # split bedtime series routing live in forecast()
    - "PRED-19"  # probability-weighted bedtime blend
    - "PRED-21"  # wake-anchored nap-start prediction
    - "PRED-22"  # nap-end anchored to actual or predicted nap-start
  affects:
    - js/lib/forecast.js
    - js/ui/today-screen.js

tech_stack:
  added: []
  patterns:
    - "Wake-anchor gap series: napStart = wakeMin + P10/P50/P90(buildNapGapSeries)"
    - "Nap-end dual-anchor chain: todayNapStartHHMM ?? napStartPred.central ?? null"
    - "Probability-weighted blend: central = round(score * napDay.central + (1-score) * noNapDay.central)"
    - "Pre-forecast context assembly in today-screen.js (D-13)"

key_files:
  modified:
    - js/lib/forecast.js
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - js/ui/today-screen.js
    - tests/unit/forecast.test.js
    - tests/unit/db-shape.test.js
    - tests/unit/settings-validate.test.js

decisions:
  - "D-09 confirmed: PRED-11 block (noNapFired evening-hour gate) permanently removed; split model supersedes it"
  - "D-10 confirmed: noNapBedtimeOffsetMinutes removed from DEFAULT_SETTINGS, migration, and validator; old JSON blobs retain orphan key harmlessly"
  - "D-13: todayWakeHHMM, napProbabilityScore, todayNapStartHHMM pre-computed before forecast() call in today-screen.js"
  - "D-14: napStart falls back to time-of-day forecastEvent when todayWakeHHMM=null or napGaps < minDays"
  - "D-15: napEnd falls back to forecastEvent when both todayNapStartHHMM and napStartPred.central are null"

metrics:
  duration: "multi-session (~2 context windows)"
  completed: "2026-09-14"
  tasks_completed: 3
  commits: 4

actuals:
  tokens: 94500    # chars/4 over the 7 files actually changed (378 ins + 142 del = ~520 diff lines * 9 chars avg / 4)
  tasks: 3
  commits: 4
---

# Phase 19 Plan 02: Split Bedtime Routing and Wake-Anchored Nap Predictions Summary

**One-liner:** Split-series bedtime routing (nap-day vs no-nap-day blend) + wake-anchored nap-start/end predictions using gap and duration percentile series in forecast().

## What Was Built

### Task 1: Checkpoint — Confirm D-09 and D-10 Removals

Pre-answered as "proceed" from the previous session. D-09 (remove PRED-11 noNapFired block) and D-10 (remove noNapBedtimeOffsetMinutes from schema) both approved.

### Task 2 (TDD): Split Bedtime Routing + PRED-11 Removal + Schema Cleanup

**RED commit:** `de2d586` — failing tests for split bedtime routing in forecast.test.js.

**GREEN commit:** `cf19636`
- `forecast.js`: Removed entire PRED-11 block (`const noNapFired = !napStartLogged && currentHour >= eveningHour`). Replaced with D-12 split model:
  - `napStartLogged=true` → `buildBedtimeSeriesNapDay(window, settings)` with overall series fallback
  - `napProbabilityScore != null` and both sub-series non-null → probability-weighted blend: `central = round(score * napDay.central + (1-score) * noNapDay.central)`, `min = Math.min(...)`, `max = Math.max(...)`
  - `napProbabilityScore=null` or sub-series thin → `calculatePercentiles` over full window (D-07, D-08)
  - PRED-10 intense-day block remains intact beneath split model (D-11)
- Extended context destructure: added `todayWakeHHMM = null`, `napProbabilityScore = null`, `todayNapStartHHMM = null`
- `db-shape.js`: Removed `noNapBedtimeOffsetMinutes: 30` from DEFAULT_SETTINGS and the forward-compat migrateV1ToV2 injection block
- `settings-validate.js`: Removed `noNapBedtimeOffsetMinutes` validator entry (field count 23 → 22)

### Task 3 (TDD): Wake-Anchored Nap Routing + today-screen.js Context Wiring

**RED commit:** `2e38093` — failing tests for wake-anchored nap routing in forecast.test.js. Six test cases:
- napStart wake-anchored central/min/max with todayWakeHHMM='06:00' and gaps=[100,140,180]
- napEnd anchored to todayNapStartHHMM when logged
- napEnd anchored to napStartPred.central when napStartHHMM=null
- napStart fallback (todayWakeHHMM=null) → forecastEvent
- napStart fallback (thin gaps < minDays) → forecastEvent
- napEnd fallback (no nap data) → central=null

**GREEN commit:** `f291321`
- `forecast.js`: Added PRED-21 and PRED-22 blocks before return:
  - PRED-21: `napGaps = buildNapGapSeries(window)`; if `todayWakeHHMM != null && napGaps.length >= minDays`: anchor to `wakeMin + P10/P50/P90(napGaps)`; else: `forecastEvent(d => extractTime(d.napStart))`
  - PRED-22: `napDurs = buildNapDurationSeries(window)`; anchor chain: `napStartAnchorHHMM = todayNapStartHHMM ?? napStartPred?.central ?? null`; if anchor non-null and durs >= minDays: `anchorMin + P10/P50/P90(napDurs)`; else: `forecastEvent(d => extractTime(d.napEnd))`
  - Return block updated: `napStart: napStartPred, napEnd: napEndPred`
- `today-screen.js`: Refactored forecast context assembly per D-13:
  - `_getSlotTime` helper moved before forecastContext block
  - Pre-forecast: `todayWakeHHMM`, `todayNapStartHHMM`, `napStreak`, `currentHour`, `currentMinute`, `napProbabilityScore` all computed before `forecast()` call
  - All three new fields (`todayWakeHHMM`, `napProbabilityScore`, `todayNapStartHHMM`) added to `forecastContext`
  - Post-forecast: simplified to `if (predictions.napStart && !predictions.isColdStart) { predictions.napStart.napProbabilityScore = napProbabilityScore; }` using pre-computed value
- **Rule 1 auto-fix:** `db-shape.test.js` and `settings-validate.test.js` tests for field count (23→22) and noNapBedtimeOffsetMinutes presence broke due to Task 2's schema cleanup. Fixed during Task 3 GREEN verification.

## Acceptance Criteria Results

| Criterion | Result |
|-----------|--------|
| `npm run test:unit` exits 0 | PASS — 825 tests, 0 fail |
| `grep -c "noNapFired" forecast.js` = 0 | PASS — 0 |
| `grep -c "noNapBedtimeOffsetMinutes" forecast.js` = 0 | PASS — 0 |
| `grep -c "noNapBedtimeOffsetMinutes" db-shape.js` = 0 | PASS — 0 |
| `grep -c "noNapBedtimeOffsetMinutes" settings-validate.js` = 0 | PASS — 0 |
| `todayWakeHHMM` inside forecastContext literal in today-screen.js | PASS |
| napProbability called before forecast() call | PASS |
| `predictions.napStart.napProbabilityScore` set post-forecast | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test failures from Task 2 schema cleanup not caught until Task 3 verification**

- **Found during:** Task 3 GREEN — `npm run test:unit` (full suite vs `node --test tests/unit/forecast.test.js` only in Task 2)
- **Issue:** `db-shape.test.js` and `settings-validate.test.js` contained assertions on `noNapBedtimeOffsetMinutes` presence and field count=23. Task 2's schema removal made these fail.
- **Fix:** Updated `db-shape.test.js` (field count 23→22, negative assertion for removed field, three test descriptions updated) and `settings-validate.test.js` (RULES field count 23→22, normalized keys count 23→22, added negative assertions)
- **Files modified:** `tests/unit/db-shape.test.js`, `tests/unit/settings-validate.test.js`
- **Commit:** `f291321` (included in Task 3 GREEN)

**2. [Rule 1 - Bug] Test data design required tight clustering for {central} shape**

- **Found during:** Task 3 RED phase iteration
- **Issue:** Initial test data had napStart times spread 220 min apart → `generateProbabilityBand` returned a probability band → `result.napStart.central` was `undefined`; also one test asserted `result.napEnd === null` but `forecastEvent` returns `{central:null}` not `null`
- **Fix:** Redesigned test data with band width ≤ 60 min (maxDelta=60); changed null assertion to `result.napEnd.central === null`
- **Files modified:** `tests/unit/forecast.test.js`
- **Commit:** `2e38093` (RED commit with corrected tests)

## Known Stubs

None. All five helper functions from Plan 19-01 are wired into live routing paths. No hardcoded placeholders or TODO items in modified files.

## Threat Flags

No new threat surface introduced. Trust boundary mitigations per threat model:
- `napProbabilityScore` clamped by `napProbability()` before reaching `forecast()`; null guard on blend branch
- `todayWakeHHMM` and `todayNapStartHHMM` derived from validated eventLog store events

## Self-Check: PASSED

Files exist:
- js/lib/forecast.js — FOUND
- js/ui/today-screen.js — FOUND
- tests/unit/forecast.test.js — FOUND

Commits:
- de2d586 (test RED Task 2) — FOUND
- cf19636 (feat GREEN Task 2) — FOUND
- 2e38093 (test RED Task 3) — FOUND
- f291321 (feat GREEN Task 3) — FOUND
