---
phase: 23-metrics-accuracy-column-migration
plan: 02
subsystem: ui
tags: [metrics-screen, tif, table-migration, e2e-testing, dead-code-removal]

# Dependency graph
requires:
  - phase: 23-metrics-accuracy-column-migration
    plan: 01
    provides: buildTifPerDayTable() on the Accuracy screen — the confirmed new home for the 12 TIF window columns before they were deleted from Metrics
provides:
  - "js/ui/metrics-screen.js with the 12 TIF inline columns (TIF_COLUMNS constant + every rendering call site) fully removed"
  - "Metrics table now renders exactly 19 columns in both Classic and TIF algorithm modes"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4100
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full clean removal (not hide-only toggle) of a dead rendering pipeline: constant, import, all call sites, and signature parameters that existed solely to feed it, while explicitly preserving unrelated code (isTif/activityLog) that shares the same gating variable"

key-files:
  created: []
  modified:
    - js/ui/metrics-screen.js
    - tests/e2e/metrics.spec.js

key-decisions:
  - "buildDayRow/buildRollingSection signatures narrowed to drop tifBoundsMap/isTif parameters that existed solely to render the now-removed columns, per D-09/D-10 — isTif itself remains in metrics-screen.js's render(), still gating the min/median/max-TIF aggregate rows and the tifForecast historic-band override"
  - "Replaced the obsolete 'TIF placeholder cells hidden when TIF is off' test with a new UI-11 test that seeds forecastAlgorithm: 'tif' and asserts the same 19-column count and 12 negative label assertions, proving removal holds in TIF mode too, not just Classic"

requirements-completed: [UI-11]

coverage:
  - id: D1
    description: "js/ui/metrics-screen.js's Metrics table has exactly 19 columns (down from 31) in both Classic and TIF algorithm modes; none of the 12 former TIF column labels appear anywhere in .metricsTable"
    requirement: "UI-11"
    verification:
      - kind: e2e
        ref: "tests/e2e/metrics.spec.js#MET-02/MET-03: Table renders with correct columns and data"
        status: pass
      - kind: e2e
        ref: "tests/e2e/metrics.spec.js#UI-11: Metrics table has no TIF columns even when TIF algorithm is active"
        status: pass
    human_judgment: false
  - id: D2
    description: "TIF_COLUMNS constant, computeTifBoundsHistory import, and all 6 TIF-cell/TIF-placeholder render call sites deleted from metrics-screen.js; zero references remain"
    requirement: "UI-11"
    verification:
      - kind: other
        ref: "grep -c 'TIF_COLUMNS|tifBoundsMap|tifBoundsArray|computeTifBoundsHistory' js/ui/metrics-screen.js == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "isTif, activityLog, and the min-TIF/median-TIF/max-TIF aggregate rows plus the tifForecast historic-band override block remain fully intact and functional — explicitly out of scope for removal per D-10"
    requirement: "UI-11"
    verification:
      - kind: other
        ref: "grep -c 'isTif' js/ui/metrics-screen.js == 7 (>= 5 required)"
        status: pass
      - kind: unit
        ref: "npm run test:unit — 880/880 pass, no regression in forecast-tif/metrics consumers"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-17
status: complete
---

# Phase 23 Plan 02: Remove TIF Inline Columns from Metrics Screen Summary

**Deleted the 12 per-event TIF window columns (TIF_COLUMNS constant, computeTifBoundsHistory call site, and all 6 rendering loops) from js/ui/metrics-screen.js, shrinking the Metrics table from 31 to 19 columns while leaving isTif/activityLog/the TIF aggregate rows untouched — completing the UI-11 migration to the Accuracy screen.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-17T12:10:00Z (approx.)
- **Completed:** 2026-09-17T12:25:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `TIF_COLUMNS` constant, its JSDoc block, and the `computeTifBoundsHistory` import deleted from `js/ui/metrics-screen.js`
- All 6 TIF-cell/TIF-placeholder rendering sites removed: `buildDayRow`'s per-cell loop, `buildTifAggregateRow`'s placeholder loop, `buildRollingSection`'s placeholder loop, the thead header-building loop, and `render()`'s All-time summary placeholder loop
- `buildDayRow(dayMetrics, snap, tifBoundsMap, isTif)` narrowed to `buildDayRow(dayMetrics, snap)`; `buildRollingSection(nDays, label, nonRejectedDays, snap, isTif)` narrowed to drop the trailing `isTif` arg — both call sites updated
- `buildSectionHeaderRow` colCount call sites changed from `COLUMNS.length + TIF_COLUMNS.length` to `COLUMNS.length` (19) at both call sites (7/14-day rolling sections and the All-time section)
- `tests/e2e/metrics.spec.js`: MET-02/MET-03 header-count assertion updated 31→19 with 12 new negative label assertions; the obsolete "TIF placeholder cells hidden when TIF is off" test replaced with a new UI-11 test proving column absence holds in TIF mode too

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete TIF_COLUMNS and every rendering call site from metrics-screen.js** - `66f8616` (feat)
2. **Task 2: Update metrics.spec.js for the 19-column table and prove TIF labels are gone** - `ea1fd14` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `js/ui/metrics-screen.js` - Removes `TIF_COLUMNS` constant, `computeTifBoundsHistory` import, all TIF-cell/placeholder rendering loops, and narrows `buildDayRow`/`buildRollingSection` signatures; `isTif`/`activityLog`/the TIF aggregate rows/the historic-band override remain unchanged
- `tests/e2e/metrics.spec.js` - Updates the 19-column assertion, adds 12 negative TIF-label assertions to MET-02/MET-03, and replaces the obsolete hidden-placeholder-cell test with a new UI-11 TIF-mode absence test

## Decisions Made
- Followed the plan's explicit D-10 scope boundary: only the `tifBoundsMap`-specific plumbing was removed from `metrics-screen.js`'s `render()` — `isTif`, `activityLog`, `computeTifTrimmedStats`, and the `tifForecast()`-based historic-band override block were left exactly as-is, since they remain in active use by the min-TIF/median-TIF/max-TIF aggregate rows and the historic-band matching logic
- No new "window width" column was added (confirmed no such field ever existed in `TIF_COLUMNS`), matching D-04's prohibition carried over from plan 23-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI-11 is now fully satisfied — the 12 TIF window columns have a working home on the Accuracy screen (plan 23-01) and are fully removed from the Metrics screen (this plan), with no window where they were simultaneously absent from both screens
- Phase 23 is complete: both plans (23-01, 23-02) executed with all tests passing
- 880/880 unit+integration tests pass; 15/15 metrics.spec.js E2E tests pass; 11/11 accuracy-screen.spec.js E2E tests pass (re-verified for regression-safety since both files share the TIF data source)

## Self-Check: PASSED

- `js/ui/metrics-screen.js` exists and contains zero references to `TIF_COLUMNS`/`tifBoundsMap`/`tifBoundsArray`/`computeTifBoundsHistory`: FOUND (grep count 0)
- `js/ui/metrics-screen.js` retains `isTif` (count 7, >= 5 required): FOUND
- `tests/e2e/metrics.spec.js` contains `toBe(19)` twice, zero `toBe(31)`, zero obsolete test title: FOUND
- Commit `66f8616` exists in git log: FOUND
- Commit `ea1fd14` exists in git log: FOUND
- `npx playwright test tests/e2e/metrics.spec.js` → 15 passed
- `npx playwright test tests/e2e/accuracy-screen.spec.js` → 11 passed (regression check)
- `node --test` (via `npm run test:unit`) → 880 passed, 0 failed

---
*Phase: 23-metrics-accuracy-column-migration*
*Completed: 2026-09-17*
