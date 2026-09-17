---
phase: 23-metrics-accuracy-column-migration
plan: 01
subsystem: ui
tags: [accuracy-screen, tif, table-migration, e2e-testing]

# Dependency graph
requires:
  - phase: 22-accuracy-scoring
    provides: renderTifAccuracy()/buildTifAccuracyGrid() TIF summary table on Accuracy screen, computeTifBoundsHistory/computeTifAccuracy in accuracy-tif.js
provides:
  - "buildTifPerDayTable() in accuracy-screen.js — new per-day TIF windows table (Date + 12 min/max/conf columns) rendered below the TIF summary table"
  - ".tifPerDayTable and .tifAccuracyTable CSS/selector classes distinguishing the two tables now present in the TIF accuracy section"
affects: [23-02-metrics-screen-cleanup]

# Actuals (#2632)
actuals:
  tokens: 9500
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New per-day table iterates the full stage-filtered `days` array (newest-first) and uses tifBoundsHistory only as a Map-keyed lookup — never as the row-iteration source — to avoid silently dropping the tifRollingDays warm-up days from a 'full history' table"

key-files:
  created: []
  modified:
    - js/ui/accuracy-screen.js
    - style.css
    - tests/e2e/accuracy-screen.spec.js

key-decisions:
  - "buildTifPerDayTable(days, tifBoundsHistory, snap) parameter/iteration order intentionally differs from the PATTERNS.md draft (which iterated tifBoundsHistory directly) — iterating `days` is required to satisfy D-06's full-history requirement"
  - "table.className = 'tifAccuracyTable' added to the pre-existing buildTifAccuracyGrid table purely as a selector-safety hook so E2E locators stay unambiguous now that two <table> elements exist in the same accuracy-section"

requirements-completed: [UI-11]

coverage:
  - id: D1
    description: "buildTifPerDayTable() renders a 13-column (Date + 12 TIF fields) table below the existing TIF summary table, gated to snap.forecastAlgorithm === 'tif'"
    requirement: "UI-11"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#per-day TIF windows table renders below the summary table with 13 columns"
        status: pass
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#per-day TIF windows table is fully absent in classic mode (D-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Row source is full stage-filtered history (days.length rows), not tifBoundsHistory.length — proves the warm-up days aren't silently dropped"
    requirement: "UI-11"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#per-day TIF windows table shows full history — row count equals days.length, not tifBoundsHistory.length (D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rejected-day rows are visually dimmed via .rejected class + matching CSS rule"
    requirement: "UI-11"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#rejected day rows carry the rejected class in the per-day TIF table (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two pre-existing TIF locator tests re-scoped to .tifAccuracyTable so they keep matching exactly one element with a second table now present"
    requirement: "UI-11"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#TIF accuracy table renders bedtime nap-day/no-nap-day split rows"
        status: pass
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#TIF \"Bedtime (no nap)\" row dashes when it has zero scored days (WR-02)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-17
status: complete
---

# Phase 23 Plan 01: Add Per-Day TIF Windows Table to Accuracy Screen Summary

**New `buildTifPerDayTable()` in accuracy-screen.js renders a 13-column (Date + 12 TIF min/max/conf fields) table below the existing TIF summary table, sourced from full history via `days` with `tifBoundsHistory` as a lookup-only Map.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-17T14:00:00+02:00 (approx.)
- **Completed:** 2026-09-17T14:13:00+02:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `buildTifPerDayTable(days, tifBoundsHistory, snap)` added to `js/ui/accuracy-screen.js`, wired into `renderTifAccuracy()` below the existing `<h2>TIF Accuracy</h2>` summary table, behind a new `<h3>Per-Day TIF Windows</h3>` sub-heading
- New `.tifPerDayTable` CSS block in `style.css` (sticky header/date column, rejected-row dimming) mirroring `.metricsTable`'s established conventions
- `.tifAccuracyTable` selector-safety class added to the pre-existing summary table so E2E locators referencing "the" accuracy table stay unambiguous with two tables now in the section
- Full E2E coverage: structural rendering (13 columns, correct labels, sub-heading), full-history row count (32 rows, not 25 — proving `days` not `tifBoundsHistory` drives row count), warm-up-boundary dashing for the first 7 (tifRollingDays) chronological days, most-recent-first ordering, two-decimal confidence formatting, rejected-day dimming, and full DOM absence in classic mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Add buildTifPerDayTable to Accuracy screen, wire it in, style it, fix the locator regression it introduces** - `f9a9638` (feat)
2. **Task 2: Cover the boundary/precision edges — full-history row count, ordering, dashes, rejected dimming, classic-mode absence** - `2ed1d41` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `js/ui/accuracy-screen.js` - Adds `formatTime` import, `TIF_PERDAY_COLUMNS` constant, `buildTifPerDayTable()` function, `.tifAccuracyTable` class hook on `buildTifAccuracyGrid`'s table, and updates `renderTifAccuracy()`/`render()` call site to thread `tifBoundsHistory`/`days` through
- `style.css` - New `.tifPerDayTable` rule block (sticky header/date column, rejected dimming) mirroring `.metricsTable`
- `tests/e2e/accuracy-screen.spec.js` - Re-scopes two pre-existing TIF table locator tests to `.tifAccuracyTable`; adds 4 new tests covering the per-day table's structure, full-history row count, warm-up dashing, ordering, confidence formatting, rejected dimming, and classic-mode absence

## Decisions Made
- Followed the plan's explicit deviation from PATTERNS.md's draft: iterate `days` (full stage-filtered history, newest-first) as the row source and use `tifBoundsHistory` only as a `Map`-keyed lookup, because `computeTifBoundsHistory` omits the first `tifRollingDays` warm-up days entirely — iterating it directly would have silently dropped rows from what's supposed to be a "full history, no reduction" table (D-06)
- No new "window width" column added, per D-04 — the 12 columns (3 fields × 4 event types) are exactly what previously existed on the Metrics screen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 23-02 (Metrics screen TIF column removal) can now proceed safely — the columns have a confirmed working home on the Accuracy screen before their Metrics screen copy is deleted, so they are never simultaneously absent from both screens
- All 880 unit/integration tests and all 11 accuracy-screen.spec.js E2E tests pass with zero failures

## Self-Check: PASSED

- `js/ui/accuracy-screen.js` exists and contains `buildTifPerDayTable`: FOUND
- `style.css` contains `.tifPerDayTable`: FOUND
- `tests/e2e/accuracy-screen.spec.js` contains the 4 new UI-11 tests: FOUND
- Commit `f9a9638` exists in git log: FOUND
- Commit `2ed1d41` exists in git log: FOUND
- `npx playwright test tests/e2e/accuracy-screen.spec.js` → 11 passed
- `node --test` (via `npm run test:unit`) → 880 passed, 0 failed

---
*Phase: 23-metrics-accuracy-column-migration*
*Completed: 2026-09-17*
