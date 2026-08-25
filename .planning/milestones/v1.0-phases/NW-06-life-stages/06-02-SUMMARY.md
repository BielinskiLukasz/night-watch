---
phase: NW-06-life-stages
plan: 02
subsystem: data
tags: [stages, csv, etap, filter, tdd]

# Dependency graph
requires:
  - phase: NW-05-data-import-export
    provides: csv-parse.js with events/rejectedDays/activityLog/skipped shape
provides:
  - Pure filterDayRecordsByStage(dayRecords, stages, activeStageId) function in js/lib/stages.js
  - Etap column detection in csv-parse.js returning stages array (D6-07, D6-08)
  - Stage object shape: { id: string, name: string, startDate: YYYY-MM-DD, endDate: YYYY-MM-DD|null }
affects:
  - NW-06-life-stages (06-03 Today screen filter, 06-04 Settings CRUD, 06-05 CSV import wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lexicographic YYYY-MM-DD string comparison for date range filtering (DST-safe, no Date constructor)"
    - "Run-length encoding pattern for grouping consecutive etap values into stage objects"
    - "TDD RED→GREEN: test file imports non-existent module (MODULE_NOT_FOUND satisfies RED)"

key-files:
  created:
    - js/lib/stages.js
    - tests/unit/stages.test.js
  modified:
    - js/lib/csv-parse.js
    - tests/unit/csv-parse.test.js

key-decisions:
  - "Date comparison uses YYYY-MM-DD lexicographic string order — no Date constructor needed (DST-safe)"
  - "Non-consecutive same-etap runs produce separate stage objects (D6-08) — empty etap cell ends the current run"
  - "Last run in CSV always gets endDate: null (open-ended, D6-05, D6-07)"
  - "Stage id is String(stages.length + 1) — index-based to avoid same-millisecond Date.now() collisions"
  - "filterDayRecordsByStage returns original array reference (not a copy) when no filter applies (D6-10, D6-12)"

patterns-established:
  - "Pure module pattern: stages.js has zero imports from other project files, no DOM, no I/O"
  - "COL map extended with etap/Etap/Stage/stage — fuzzy normalizeKey('etap') already resolves correctly"
  - "Stage accumulator: currentEtap/currentEtapStart/currentEtapEnd tracked during row loop, closed after"

requirements-completed: [STAGE-01, STAGE-02]

# Metrics
duration: 3min
completed: 2026-06-29
---

# Phase 06 Plan 02: Stage Filter and etap CSV Parsing Summary

**Pure filterDayRecordsByStage with YYYY-MM-DD lexicographic date filtering, plus csv-parse.js extended to group etap runs into stages[] with open-ended last run**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-29T18:05:31Z
- **Completed:** 2026-06-29T18:08:12Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 4

## Accomplishments

- New js/lib/stages.js: pure filterDayRecordsByStage respects null activeStageId (all data), unknown id (D6-10 fallback), null endDate (D6-05 open-ended), and inclusive boundary dates
- csv-parse.js extended: etap column auto-detected via COL map, consecutive runs grouped into stage objects, non-consecutive same-name runs produce separate objects (D6-08), last run has endDate: null
- 7 stages unit tests + 6 etap csv-parse tests all pass; zero regressions on 25 existing csv-parse tests

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing tests for filterDayRecordsByStage and etap CSV parsing** - `bc74552` (test)
2. **Task 2: GREEN — implement stages.js and extend csv-parse.js** - `72fcb98` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks have separate RED (test) and GREEN (feat) commits_

## Files Created/Modified

- `js/lib/stages.js` - New pure module: filterDayRecordsByStage(dayRecords, stages, activeStageId)
- `js/lib/csv-parse.js` - Added etap to COL map; stage accumulator in row loop; stages[] in return shape
- `tests/unit/stages.test.js` - New: 7 unit tests for filterDayRecordsByStage (boundary conditions, null endDate, D6-10 fallback)
- `tests/unit/csv-parse.test.js` - Added 6 etap tests (single run, two runs, A/B/A pattern, no etap column, empty etap, id type)

## Decisions Made

- Date comparison uses YYYY-MM-DD lexicographic string order — no Date constructor, DST-safe
- Stage ids are sequential strings ("1", "2", ...) — avoids same-millisecond Date.now() collisions in synchronous parse loop
- filterDayRecordsByStage returns the original array reference when no filter applies — this satisfies the reference-equality assertion in the tests and avoids unnecessary array allocation
- Empty etap cell ends any open run immediately (D6-08), consistent with the plan spec

## Deviations from Plan

None - plan executed exactly as written. One minor addition: the early-return guard `if (lines.length === 0)` was updated to include `stages` in its return object (the plan's spec listed this return path but the early-return needed the same fix — trivial correctness, not an architectural change).

## Issues Encountered

None - implementation was straightforward. Tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- filterDayRecordsByStage is ready for Plan 06-03 (Today screen filter selector)
- stages[] from parseCSV is ready for Plan 06-05 (CSV import auto-populates settings stages)
- Stage object shape is stable: { id: string, name: string, startDate: YYYY-MM-DD, endDate: YYYY-MM-DD|null }
- No blockers

---
*Phase: NW-06-life-stages*
*Completed: 2026-06-29*
