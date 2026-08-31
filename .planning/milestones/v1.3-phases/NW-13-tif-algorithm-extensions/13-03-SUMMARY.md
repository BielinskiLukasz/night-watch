---
phase: NW-13
plan: "03"
subsystem: forecast-tif
tags: [tif, nap-start, nap-end, ratio-windows, tdd]
requirements: [TIF-12]
depends_on: [NW-13-01, NW-13-02]
provides: [MA/sleep ratio band in napStart.sourceWindows, MA/nap ratio band in napEnd.sourceWindows]
affects: [js/lib/forecast-tif.js]
tech_stack:
  added: []
  patterns: [ratio-projection, buildDurationBand, TDD-RED-GREEN-REFACTOR]
key_files:
  created:
    - tests/unit/forecast-tif-ratio.test.js
  modified:
    - js/lib/forecast-tif.js
decisions:
  - "D-01/D-04: MA/sleep ratio band guarded by todaySleepDuration; null bedtime skips window"
  - "D-02/D-03: MA/nap ratio band uses actual napStart−wake for todayMA; falls back to prediction"
  - "D-05: ratio windows placed AFTER existing bands in their labelled-window arrays"
  - "Division-by-zero: sleepDuration=0 and napDuration=0 excluded via sd>0 / nd>0 guards"
metrics:
  duration_minutes: 5
  completed_date: "2026-08-27"
  tasks_completed: 3
  commits: 3
estimate:
  tokens: 8000
actuals:
  tokens: 8750
  tasks: 3
  commits: 3
status: complete
---

# Phase 13 Plan 03: TIF-12 Ratio Windows Summary

**One-liner:** Added MA/sleep ratio band (napStart) and MA/nap ratio band (napEnd) to tifForecast using actBeforeNap/sleepDuration and actBeforeNap/napDuration ratio projections anchored to wakeAnchor and napStartAnchor respectively.

## What Was Built

Two new source windows added to `tifForecast` in `js/lib/forecast-tif.js`:

**MA/sleep ratio band (napStart):**
- Computes `ratio_i = actBeforeNapPerDay[i] / sleepDuration(window[i])` for each historical day
- Projects to `ratio_i * todaySleepDuration` to get expected morning activity duration
- Builds a `buildDurationBand` from projected durations anchored to `wakeAnchorForNap`
- Guard: skipped when `todaySleepDuration` is null (bedtime not logged) or zero

**MA/nap ratio band (napEnd):**
- Computes `ratio_i = actBeforeNapPerDay[i] / napDuration(window[i])` for each historical day
- Projects to `ratio_i * todayMA` where `todayMA = napStart_actual − wake_actual` (or falls back to `napStartPred.central − wakeAnchorForNap`)
- Builds a `buildDurationBand` from projected durations anchored to `napStartAnchor`
- Guard: skipped when `todayMA` is null

Both windows carry `median` field (inherited from `buildDurationBand` → `trimmedMinMax` via Plan 02).

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED  | `1cd9883` | test(NW-13-03): add failing tests for TIF-12 ratio windows |
| GREEN | `99bb70d` | feat(NW-13-03): add MA/sleep and MA/nap ratio windows to tifForecast (TIF-12) |
| REFACTOR | `418760e` | refactor(NW-13-03): document ratio window formulas in tifForecast JSDoc |

## Verification Results

| Command | Result |
|---------|--------|
| `node --test tests/unit/forecast-tif-ratio.test.js` | 4/4 pass |
| `node --test tests/integration/forecast-tif.integration.test.js` | 10/10 pass |
| `npm run test:unit` | 716/716 pass |

## Deviations from Plan

### Minor deviation: Test 2 RED phase behavior

**Rule applied:** Informational note only — no rule violation.

Test 2 ("last record missing bedtime → no MA/sleep ratio band") passed in RED because the band did not yet exist (negative assertion trivially satisfied before implementation). This is expected behavior for negative guard tests in TDD. After GREEN, the test correctly validates the guard condition (band is added for complete records, omitted when bedtime is null).

**Impact:** None — the test correctly validates the guard in GREEN/REFACTOR.

## Known Stubs

None.

## Threat Flags

None. Changes are internal algorithm logic in a pure function with no new DOM access, storage, or network calls.

## Self-Check: PASSED

- [x] `tests/unit/forecast-tif-ratio.test.js` — exists, 4 tests pass
- [x] `js/lib/forecast-tif.js` — modified with ratio windows
- [x] Commit `1cd9883` (RED) — exists
- [x] Commit `99bb70d` (GREEN) — exists
- [x] Commit `418760e` (REFACTOR) — exists
- [x] `npm run test:unit` — 716/716 pass
