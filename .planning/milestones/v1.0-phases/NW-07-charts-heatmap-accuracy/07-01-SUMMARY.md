---
phase: NW-07
plan: "01"
subsystem: test-stubs
tags: [tdd, red-state, unit-tests, e2e-tests, accuracy, chart-data, bottom-nav]
dependency_graph:
  requires: []
  provides:
    - tests/unit/accuracy.test.js (RED stubs for js/lib/accuracy.js)
    - tests/unit/chart-data.test.js (RED stubs for js/lib/chart-data.js)
    - tests/e2e/bottom-nav.spec.js (E2E guard for UI-06 bottom nav)
    - tests/e2e/charts-screen.spec.js (E2E guard for UI-04 charts screen)
    - tests/e2e/accuracy-screen.spec.js (E2E guard for UI-05 accuracy screen)
  affects:
    - js/lib/accuracy.js (to be created in later plan — GREEN)
    - js/lib/chart-data.js (to be created in later plan — GREEN)
    - js/ui/bottom-nav.js (to be created in later plan — GREEN)
    - js/ui/charts-screen.js (to be created in later plan — GREEN)
    - js/ui/accuracy-screen.js (to be created in later plan — GREEN)
tech_stack:
  added: []
  patterns:
    - node:test + node:assert/strict for unit test stubs
    - "@playwright/test test.describe / test.beforeEach for E2E stubs"
    - makeDay() fixture helper pattern (mirrored from forecast.test.js)
key_files:
  created:
    - tests/unit/accuracy.test.js
    - tests/unit/chart-data.test.js
    - tests/e2e/bottom-nav.spec.js
    - tests/e2e/charts-screen.spec.js
    - tests/e2e/accuracy-screen.spec.js
  modified: []
decisions:
  - "RED state confirmed: both unit test files fail with ERR_MODULE_NOT_FOUND (js/lib/accuracy.js and js/lib/chart-data.js do not exist yet)"
  - "E2E stubs reference #bottom-nav, #charts-screen, #accuracy-screen DOM IDs that will be created in later plans (07-04, 07-05, 07-06)"
  - "accuracy.test.js uses minDays=2 for brevity in fixture scenarios (per plan task guidance)"
  - "chart-data.test.js buildSleepLengthSeries sleepHours=9 test uses wake=07:00+bedtime=22:00 cross-midnight arithmetic: (24*60-1320)+420=540min=9h"
metrics:
  duration: "283 seconds (~5 min)"
  completed: "2026-06-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 0
status: complete
---

# Phase 7 Plan 01: TDD Red State Stubs Summary

**One-liner:** Five failing test stub files (2 unit + 3 E2E) encoding I/O contracts and acceptance criteria for Phase 7's pure-logic modules and UI screens before any implementation exists.

## What Was Built

This plan creates the RED state for TDD discipline (PLAT-11). Five test files establish the contracts that subsequent implementation plans must satisfy:

**Unit test stubs (must fail with ERR_MODULE_NOT_FOUND):**
- `tests/unit/accuracy.test.js` — 10 `it()` blocks inside `describe('computeAccuracy — UI-05, D7-12..D7-16')`. Tests cover: empty input (all zeros), sparse data (< minDays+1), perfect prediction (withinDelta.pct===100), boundary case (delta===maxDelta → 100% delta, 0% half-delta), miss case (delta>maxDelta → 0%), nap-day filtering (D7-15: napStart.total counts only nap days), cold-start skip (all-rejected days → total unchanged), output shape (pct in [0,100], four event-type keys, sub-fields present).
- `tests/unit/chart-data.test.js` — 14 `it()` blocks across 5 nested `describe` blocks (one per exported function). Tests cover: `buildSleepLengthSeries` (empty→[], wake+bedtime→9h, missing wake→null), `buildHeatmapData` (empty→[], gap filling 2→3 cells, Monday dayOfWeek=0, cell shape), `buildTimeBandSeries` (empty→[], wake=07:00→420min, missing wake→null), `buildNapStats` (all no-nap→0%, 1-of-5→20%, 90min length, empty), `buildActivityCorrelation` (empty log→[], empty days→[], matching entry, excluded days).

**E2E Playwright stubs (will fail at runtime — DOM elements not yet present):**
- `tests/e2e/bottom-nav.spec.js` — 5 tests inside `describe('Bottom navigation — UI-06, D7-01..D7-04')`: four data-tab buttons count, Today active by default, Charts tab navigation, Accuracy tab navigation, History tab navigation.
- `tests/e2e/charts-screen.spec.js` — 2 tests inside `describe('Charts screen — UI-04, D7-05..D7-11')`: DOM presence, cold-start card when no data.
- `tests/e2e/accuracy-screen.spec.js` — 2 tests inside `describe('Accuracy screen — UI-05, D7-12..D7-16')`: DOM presence, cold-start card when no data.

## Verification Results

```
node --test tests/unit/accuracy.test.js  → ERR_MODULE_NOT_FOUND (RED confirmed)
node --test tests/unit/chart-data.test.js → ERR_MODULE_NOT_FOUND (RED confirmed)
node --test tests/unit/ [all except new stubs] → 307/307 pass (no regression)
```

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Failing unit stubs for accuracy.js (RED) | f3a7f3c | tests/unit/accuracy.test.js |
| 2 | Failing unit stubs for chart-data.js (RED) | d705b91 | tests/unit/chart-data.test.js |
| 3 | Playwright E2E stub specs (RED) | 3aa0810 | tests/e2e/bottom-nav.spec.js, tests/e2e/charts-screen.spec.js, tests/e2e/accuracy-screen.spec.js |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None in production code — this plan creates test stubs only (by design). No production code was written.

## Threat Flags

None — test fixture data is hardcoded literals with no user input crossing trust boundaries. No new production surface introduced.

## Self-Check: PASSED

- [x] tests/unit/accuracy.test.js — exists, 10 it() blocks, ERR_MODULE_NOT_FOUND confirmed
- [x] tests/unit/chart-data.test.js — exists, 14 it() blocks across 5 describe blocks, ERR_MODULE_NOT_FOUND confirmed
- [x] tests/e2e/bottom-nav.spec.js — exists, 5 tests referencing #bottom-nav
- [x] tests/e2e/charts-screen.spec.js — exists, 2 tests referencing #charts-screen
- [x] tests/e2e/accuracy-screen.spec.js — exists, 2 tests referencing #accuracy-screen
- [x] All 307 existing unit tests pass (no regression)
- [x] All three task commits exist: f3a7f3c, d705b91, 3aa0810
