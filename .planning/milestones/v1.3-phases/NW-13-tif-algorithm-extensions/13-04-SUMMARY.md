---
phase: NW-13
plan: "04"
subsystem: forecast-tif
tags: [tif, no-nap-day, substitution, tdd, algorithm]
requirements: [TIF-16]

dependency_graph:
  requires: [NW-13-03]
  provides: [no-nap-day substitution in tifForecast]
  affects: [js/lib/forecast-tif.js, tests/unit/forecast-tif-nonap.test.js]

tech_stack:
  added: []
  patterns:
    - Filtered sub-window substitution (noNapDayWindow / postNoNapWindow)
    - Thin-history fallback (D-19 pattern)
    - isYesterdayNoNap derived from window slice inside tifForecast

key_files:
  created:
    - tests/unit/forecast-tif-nonap.test.js
  modified:
    - js/lib/forecast-tif.js

decisions:
  - "noNapDayWindow = window.filter(d => extractTime(d.napStart) === null) — pre-computed before per-event band building"
  - "postNoNapWindow = window.filter((d, i) => i > 0 && extractTime(window[i-1].napStart) === null)"
  - "isYesterdayNoNap derived from window[-2] inside tifForecast (not from caller)"
  - "D-17 Window 3 skip: guard is if (!isNoNapDay) — clean conditional wrap"
  - "D-19 fallback: srcLengths / srcSleepDurations chosen by (isNoNapDay && filtered.length >= settings.minDays)"

metrics:
  duration: 7
  completed: "2026-08-27"
  tasks: 3
  commits: 3
  files: 2

status: complete

actuals:
  tokens: 8500
  tasks: 3
  commits: 3
---

# Phase 13 Plan 04: No-Nap-Day Substitution Summary

**One-liner:** TIF-16 no-nap-day substitution — filtered sub-windows for bedtime (Day-length band), wake (Post-no-nap sleep-length band), and nap-start (Post-no-nap pattern) when today is or follows a no-nap day.

## What Was Built

Extended `tifForecast()` with three substitution behaviours that activate when the caller passes `isNoNapDay=true` or when the window detects yesterday was a no-nap day.

### Pre-computation (added before `const tifPredictions = {}`)

```javascript
const noNapDayWindow   = window.filter(d => extractTime(d.napStart) === null);
const postNoNapWindow  = window.filter((d, i) => i > 0 && extractTime(window[i - 1].napStart) === null);
const isYesterdayNoNap = window.length >= 2 && extractTime(window[window.length - 2].napStart) === null;
```

### D-16: Bedtime band substitution

When `isNoNapDay=true` and `noNapDayLengths.length >= settings.minDays`, the bedtime prediction uses `'Day-length band (no-nap days)'` built from historical no-nap day lengths. Falls back to `'Day-length band'` when the sub-window is too thin (D-19).

### D-17: Wake band substitution

When `isNoNapDay=true` and `postNoNapSleepDurations.length >= settings.minDays`, Window 2 becomes `'Post-no-nap sleep-length band'`. Window 3 (`'Sleep + nap combined band'`) is skipped via `if (!isNoNapDay)` guard.

### D-18: Post-no-nap nap-start window

When `isYesterdayNoNap=true`, a `'Post-no-nap nap-start pattern'` window is added alongside existing nap-start windows (not replacing them). Based on nap-start times from days that immediately followed a historical no-nap day.

## TDD Cycle

**RED (commit 50aafc3):** Created `tests/unit/forecast-tif-nonap.test.js` with 5 tests.
- Tests 1, 3, 4 failed as expected (substitution labels absent).
- Tests 2, 5 passed in RED (they test fallback/non-substitution paths that were already correct).

**GREEN (commit e1601ea):** Implemented 4-step substitution logic in `forecast-tif.js`.
- All 5 new tests pass.
- All 10 integration tests pass.

**REFACTOR (commit 90addb4):** Updated JSDoc on `tifForecast` to document all three substitution behaviours with decision references (D-16, D-17, D-18, D-19).

## Verification Results

```
node --test tests/unit/forecast-tif-nonap.test.js   → 5/5 pass
node --test tests/integration/forecast-tif.integration.test.js → 10/10 pass
npm run test:unit → 721/721 pass (exit 0)
```

## Commits

| Commit | Phase | Description |
|--------|-------|-------------|
| 50aafc3 | RED | test(NW-13-04): add failing tests for TIF-16 no-nap-day substitution |
| e1601ea | GREEN | feat(NW-13-04): add no-nap-day substitution to tifForecast (TIF-16) |
| 90addb4 | REFACTOR | refactor(NW-13-04): document no-nap-day substitution logic in tifForecast JSDoc |

## Deviations from Plan

### Minor Observations

**1. [No Rule] Tests 2 and 5 pass in RED phase**
- The plan says "Tests MUST fail" — 3 of 5 did fail (Tests 1, 3, 4).
- Tests 2 (thin-history fallback) and 5 (isNoNapDay=false no-op) test paths that were already correct before implementation, so they pass in RED. This is expected for well-designed fallback tests.
- No action required; the RED gate was still met (3 failures confirmed substitution logic absent).

None — plan executed as written for all implementation steps.

## Success Criteria Verification

- [x] isNoNapDay=true + enough no-nap history: bedtime uses 'Day-length band (no-nap days)'
- [x] isNoNapDay=true + thin no-nap history: bedtime falls back to 'Day-length band' (D-19)
- [x] isNoNapDay=true: wake uses 'Post-no-nap sleep-length band'; 'Sleep + nap combined band' absent
- [x] isYesterdayNoNap=true: napStart includes 'Post-no-nap nap-start pattern'
- [x] isNoNapDay=false: all existing bands present, no substitution labels
- [x] All 5 new tests pass
- [x] All previous unit and integration tests still pass (npm run test:unit exits 0)
- [x] 3 commits (RED / GREEN / REFACTOR)

## Known Stubs

None.

## Threat Flags

None — this change is pure algorithm logic in a lib/ module with no DOM access, no storage writes, no network endpoints, and no new trust boundaries.

## Self-Check: PASSED

- `tests/unit/forecast-tif-nonap.test.js` exists: FOUND
- `js/lib/forecast-tif.js` modified: FOUND
- RED commit 50aafc3: FOUND
- GREEN commit e1601ea: FOUND
- REFACTOR commit 90addb4: FOUND
- npm run test:unit: 721/721 PASS
