---
phase: NW-09
plan: "06"
subsystem: tests/e2e
tags: [e2e, playwright, forecast, PLAT-12, UI-09, UI-10]
requires: ["09-01", "09-03", "09-04"]
provides: []
affects: []
tech-stack:
  added: []
  patterns: ["32-day fixture with makeBaselineDb()", "high-variance fixture for probability-band", "seedAndReload pattern"]
key-files:
  modified:
    - tests/e2e/forecast.spec.js
decisions:
  - "32-day baseline fixture with 4 event types (128 events total) rather than extending old 7-event fixture"
  - "makeDb() includes all DEFAULT_SETTINGS keys from Phase 6+ and Phase 9 (stages, activeStageId, confirmBeforeLogging)"
  - "High-variance 7-event wake fixture (120-min spread) retained for probability-band tests (Tests 4+5)"
metrics:
  duration: "15 minutes"
  completed: "2026-07-10"
  tasks_completed: 1
  files_modified: 1
status: complete
---

# Phase NW-09 Plan 06: Forecast E2E Spec Rewrite Summary

**One-liner:** Rewrote forecast E2E spec with 32-day 4-type fixture (128 events) and 3 new Phase 9 UI tests (collapsed probability-band default, expand/collapse interaction, hero label).

## Changes

- `tests/e2e/forecast.spec.js`: Complete rewrite — 32-day baseline fixture covering all 4 event types (wake 06:30, napStart 13:00, napEnd 14:30, bedtime 21:00); 7 tests total; `makeDb()` updated with all Phase 6+ and Phase 9 settings keys (stages, activeStageId, confirmBeforeLogging, rejectedDays); old 7-event wake-only fixture removed.

## Tests (all 7 pass)

| # | Test | Requirement |
|---|------|-------------|
| 1 | Cold-start message when < minDays | D3-06/D3-09 |
| 2 | Prediction cards appear after 32-day fixture (all 4 types) | D3-08 |
| 3 | Quick-log reactive update without reload | D3-12 |
| 4 | Probability-band card renders collapsed by default | UI-09/D9-06 |
| 5 | Click collapsed card expands; second click collapses | UI-09 |
| 6 | Hero card shows "Next Predicted Event" label | UI-10/D9-17 |
| 7 | Missed predictions have "missed" class and label | D3-11 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `tests/e2e/forecast.spec.js` exists and contains 7 tests: CONFIRMED
- Commit `130b2b3` exists: CONFIRMED
- All 7 Playwright E2E tests pass (21s): CONFIRMED
- Old `ev-1` through `ev-7` IDs gone: CONFIRMED (grep returns 0 matches)
- `makeBaselineDb()` generates 128 events (4 × 32): CONFIRMED in code
- Test 4 validates `.prediction-card.probability-band.collapsed` by default: CONFIRMED
- Test 5 validates click expand/collapse interaction: CONFIRMED
- Test 6 validates `.hero-label` contains "Next Predicted Event": CONFIRMED
