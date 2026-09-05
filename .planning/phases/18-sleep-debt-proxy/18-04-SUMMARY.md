---
phase: 18-sleep-debt-proxy
plan: "04"
subsystem: ui
tags: [metrics, sleep-debt, rolling-window, e2e]

requires:
  - phase: 18-sleep-debt-proxy-plan-03
    provides: sleepDebtProxy integration into metrics-screen.js COLUMNS and buildRollingSection

provides:
  - "S.Debt(7d) column label fix (G-18-5) — header now communicates the 7-day rolling scope"
  - "sliceOffset fix in buildRollingSection (G-18-6) — full nonRejectedDays history passed to sleepDebtProxy, cold-start guard no longer misfires"
  - "MET-14/rolling E2E test — verifies non-dash S.Debt aggregate values in both rolling sections when 15 qualifying days seeded"

affects: [metrics-screen, e2e-tests, sleep-debt-proxy]

actuals:
  tokens: 8000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "sliceOffset pattern: map bounded rolling slice indices back to full nonRejectedDays positions before calling filter-then-slice proxy functions"

key-files:
  created: []
  modified:
    - js/ui/metrics-screen.js
    - tests/e2e/metrics.spec.js

key-decisions:
  - "Phase 18 Plan 18-04: sliceOffset = Math.max(0, nonRejectedDays.length - nDays) applied before rolling sleepDebt loop so proxy receives full history"
  - "Phase 18 Plan 18-04: COLUMNS[9].label changed from 'S.Debt' to 'S.Debt(7d)' to communicate rolling window scope to users"

patterns-established:
  - "sliceOffset pattern: when a rolling section calls a proxy that needs full history context, compute offset = nonRejectedDays.length - nDays before iterating the bounded slice"

requirements-completed: [MET-14]

coverage:
  - id: D1
    description: "Column header reads 'S.Debt(7d)' in the Metrics table (G-18-5)"
    requirement: MET-14
    verification:
      - kind: e2e
        ref: "tests/e2e/metrics.spec.js#MET-02/MET-03: Table renders with correct columns and data"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rolling aggregate S.Debt cells show real (non-dash) values when 15+ qualifying days are seeded (G-18-6)"
    requirement: MET-14
    verification:
      - kind: e2e
        ref: "tests/e2e/metrics.spec.js#MET-14/rolling: S.Debt shows real values in rolling sections when sufficient history is seeded"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildRollingSection passes nonRejectedDays.slice(0, sliceOffset+i+1) to sleepDebtProxy — cold-start guard no longer misfires (G-18-6)"
    requirement: MET-14
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js — all 89 unit tests pass"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-05
status: complete
---

# Phase 18 Plan 04: Sleep Debt Proxy Gap Closure Summary

**S.Debt column relabelled to 'S.Debt(7d)' and sliceOffset fix removes cold-start misfires in rolling aggregate sections**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-05T16:49:00Z
- **Completed:** 2026-09-05T17:01:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Renamed COLUMNS[9].label from 'S.Debt' to 'S.Debt(7d)' so users understand the column is a 7-day rolling sum (G-18-5)
- Fixed buildRollingSection: added `sliceOffset = Math.max(0, nonRejectedDays.length - nDays)` so each row's sleepDebtProxy call receives the full nonRejectedDays history up to that day, not just the bounded rolling window — eliminating the cold-start misfires in 7-day and 14-day aggregate sections (G-18-6)
- Updated E2E label assertion from 'S.Debt' to 'S.Debt(7d)' and added new MET-14/rolling test seeding 15 days to verify non-dash aggregate values in both rolling sections

## Task Commits

1. **Task 1: Fix G-18-5 label and G-18-6 sliceOffset in metrics-screen.js** - `54e3d45` (fix)
2. **Task 2: Update E2E test label assertion and add rolling aggregate S.Debt real-values test** - `0240fe2` (test)

## Files Created/Modified

- `js/ui/metrics-screen.js` - COLUMNS[9].label 'S.Debt' -> 'S.Debt(7d)'; sliceOffset computation added before rolling sleepDebt loop
- `tests/e2e/metrics.spec.js` - Updated label assertion; added MET-14/rolling test (15-day seed, non-dash aggregate check)

## Decisions Made

- sliceOffset = Math.max(0, nonRejectedDays.length - nDays) cleanly handles both cold-start (offset=0 when fewer days available than nDays) and full-history cases without changing the aggregate computation that follows
- New E2E test uses dates '2025-05-01'..'2025-05-15' with distinct event IDs ('met14-wake-*') to avoid collisions with the existing TIF placeholder test that also uses May 2025 dates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-18-5 and G-18-6 are closed. Phase 18 (Sleep Debt Proxy) is complete.
- All 15 E2E metrics tests pass; all 89 unit tests pass.

## Self-Check: PASSED

- `js/ui/metrics-screen.js` — exists and modified
- `tests/e2e/metrics.spec.js` — exists and modified
- Commit 54e3d45 — confirmed in git log
- Commit 0240fe2 — confirmed in git log

---
*Phase: 18-sleep-debt-proxy*
*Completed: 2026-09-05*
