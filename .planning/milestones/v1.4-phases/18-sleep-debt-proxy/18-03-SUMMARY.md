---
phase: 18-sleep-debt-proxy
plan: 18-03
subsystem: ui/metrics-screen
tags: [metrics, sleep-debt, ui, e2e]
status: complete

dependency_graph:
  requires:
    - 18-01 (sleepDebtProxy exported from metrics.js)
    - 18-02 (snap.targetSleepMinutes present in DEFAULT_SETTINGS)
  provides:
    - S.Debt column in Metrics screen (COLUMNS index 9, all three aggregate sections)
    - E2E assertion for S.Debt header and cold-start '—' rendering
  affects: []

tech-stack:
  added: []
  patterns:
    - "per-row sleepDebt augmentation: reversedDays.slice(0,i+1).filter(!rejected) → sleepDebtProxy"
    - "aggregate debt entries: rows.filter(!rejected && debt!==null).map({value,date})"
    - "first-occurrence tie-breaking: reduce with strict < / > (keeps first match)"
    - "rolling section augmentation: slice.slice(0,i+1) (all non-rejected) → sleepDebtProxy"

key-files:
  created: []
  modified:
    - js/ui/metrics-screen.js
    - tests/e2e/metrics.spec.js

key-decisions:
  - "Used snap.targetSleepMinutes (not snap.settings.targetSleepMinutes) — snap IS the settings object (deviation Rule 1 auto-fix)"
  - "sleepDebt in COLUMNS with isTime:false isRatio:false — formatDuration handles display, null→'—' via formatCellValue"
  - "Rolling section: slice is already non-rejected, so no extra rejection filter needed for rollingDebtEntries"
  - "COLUMNS.length comment updated from 18-column to 19-column to reflect MET-14 addition"

actuals:
  tokens: 13750
  tasks: 2
  commits: 2

requirements-completed: [MET-14]

duration: 10min
completed: 2026-09-03
---

# Phase 18 Plan 18-03: S.Debt Column in Metrics Screen Summary

**S.Debt (rolling 7-day sleep debt) column wired into all three Metrics screen aggregate sections and per-day rows via sleepDebtProxy import; E2E spec updated to 31 columns with S.Debt header assertion**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-03T09:54:53Z
- **Completed:** 2026-09-03T10:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `sleepDebtProxy` to named imports from `../lib/metrics.js` in `metrics-screen.js`
- Extended COLUMNS from 18 to 19 entries: `{ key: 'sleepDebt', label: 'S.Debt', isTime: false, isRatio: false }` at index 9 (after Comb, before Day Len)
- Per-day rows augmented with `sleepDebt` in main render loop — for each row i, pass `reversedDays.slice(0, i+1).filter(!rejected)` to `sleepDebtProxy(nonRejectedUpToI, 7, snap.targetSleepMinutes)`
- All-time aggregate augmented with `avg.sleepDebt`, `min.sleepDebt { value, date }`, `max.sleepDebt { value, date }`
- `buildRollingSection` augmented with the same pattern (both 7-day and 14-day rolling sections)
- Cold-start rows return null from `sleepDebtProxy`; `buildCell` / `formatCellValue` renders null as `'—'` automatically
- Updated E2E test: column count 30 → 31, added `S.Debt` header assertion, added cold-start `'—'` assertion for per-day cells, added `targetSleepMinutes: 600` to MET-02/03 seed settings
- All 14 E2E metrics tests pass; all 89 unit tests pass

## Task Commits

1. **Task 1 (feat):** `7ef87ac` — `feat(18-03): add S.Debt column to Metrics screen`
2. **Task 2 (test):** `e9a2f84` — `test(18-03): update E2E metrics spec for S.Debt column`

## Files Created/Modified

- `js/ui/metrics-screen.js` — 4 changes: import, COLUMNS, main-loop augmentation, rolling-section augmentation (+54 lines)
- `tests/e2e/metrics.spec.js` — column count updated (30→31), S.Debt header assertion, cold-start cells assertion, targetSleepMinutes in seed (+21 lines)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `snap.targetSleepMinutes` instead of plan's `snap.settings.targetSleepMinutes`**
- **Found during:** Task 1 implementation
- **Issue:** The plan draft wrote `snap.settings.targetSleepMinutes` in both Change 3 and Change 4. In `metrics-screen.js`, `snap = settings.get()` so `snap` IS the settings object. Writing `snap.settings` would be undefined.
- **Fix:** Used `snap.targetSleepMinutes` directly (consistent with all other snap property access in this file, e.g. `snap.tifRollingDays`, `snap.targetSleepMinutes`).
- **Files modified:** `js/ui/metrics-screen.js`
- **Commit:** `7ef87ac`

## Known Stubs

None. S.Debt column is fully wired: `sleepDebtProxy` computes a real signed-minute value for qualifying rows, and `'—'` for cold-start rows with fewer than 7 non-rejected records.

## Threat Surface Scan

No new trust boundaries or security-relevant surfaces introduced. All cell values flow through `buildCell` / `formatCellValue` which use `textContent` only (T-11-05 maintained). `snap.targetSleepMinutes` arrives from validated settings store (settings-validate.js enforces integer 1–1440).

## Self-Check: PASSED

- FOUND: js/ui/metrics-screen.js (modified, 19 COLUMNS entries confirmed)
- FOUND: tests/e2e/metrics.spec.js (modified, count=31 and S.Debt assertion confirmed)
- FOUND: 7ef87ac (feat commit) — confirmed in git log
- FOUND: e9a2f84 (test commit) — confirmed in git log
- All 14 E2E metrics tests: PASSED
- All 89 unit metrics tests: PASSED

---
*Phase: 18-sleep-debt-proxy*
*Completed: 2026-09-03*
