---
phase: NW-12
plan: "02"
subsystem: day-bucket / prediction
tags: [tdd, day-bucket, intense-annotation, PRED-10]
status: complete

dependency_graph:
  requires:
    - NW-12-01 (selectNextEvent evening-hour override)
  provides:
    - day.intense boolean on all daysByCalendar / daysBySubjectiveNight records
  affects:
    - js/lib/forecast.js (Plan 05 — will filter by intense)
    - js/ui/history-screen.js (Plan 03 — will render intense badge)

tech_stack:
  added: []
  patterns:
    - annotateIntense follows exact annotateRejected pattern (private function, spread-copy, fast-path)
    - TDD: RED commit then GREEN commit; REFACTOR merged into GREEN (JSDoc only)

key_files:
  created: []
  modified:
    - js/lib/day-bucket.js
    - tests/unit/day-bucket.test.js

decisions:
  - JSDoc updates for .intense included in GREEN commit (no separate REFACTOR commit needed — docs-only change)
  - annotateIntense placed immediately after annotateRejected in day-bucket.js (~line 287)
  - REFACTOR: no structural cleanup needed beyond what was already clean in GREEN

metrics:
  duration: "14 min"
  completed: "2026-08-25"
  tasks_completed: 3
  files_modified: 2
---

# Phase NW-12 Plan 02: annotateIntense — inject intense:boolean onto day records Summary

**One-liner:** Private `annotateIntense` function added to `day-bucket.js`, chained after `annotateRejected` in both public functions; every returned day record now carries `intense:boolean` derived from `settings.intenseDays`.

## What Was Built

Added `annotateIntense(records, settings)` to `js/lib/day-bucket.js` immediately after `annotateRejected`, following the identical pattern: Array.isArray guard on `settings.intenseDays`, fast-path when empty, spread-copy (no mutation), `intenseDays.includes(day.date)` per record. Chained as `annotateIntense(annotateRejected(records, settings), settings)` in both `daysByCalendar` and `daysBySubjectiveNight`. JSDoc on both public functions updated to document the new `.intense` property and `intenseDays` settings field.

## TDD Cycle

| Phase | Commit | Details |
|-------|--------|---------|
| RED | `b0d5f6d` | 9 failing tests in 2 `describe` blocks (via `daysByCalendar` + `daysBySubjectiveNight`) |
| GREEN | `04e68ee` | `annotateIntense` added; all 33 day-bucket tests pass, 667 unit tests pass |
| REFACTOR | — | No separate commit — JSDoc included in GREEN; no structural changes needed |

## Test Coverage

New tests in `tests/unit/day-bucket.test.js`:

**`annotateIntense via daysByCalendar` (6 tests):**
- All days `intense:false` when settings not provided
- All days `intense:false` when `intenseDays` is empty (fast-path)
- Day in `intenseDays` gets `intense:true`; non-matching day gets `intense:false`
- Multiple dates: each matching day gets `intense:true`
- `null` `intenseDays` → all `intense:false` (T-12-02-01 Array.isArray guard)
- Immutability: two calls return independent objects

**`annotateIntense via daysBySubjectiveNight` (3 tests):**
- All days `intense:false` when settings absent
- Date in `intenseDays` gets `intense:true` (no rollback)
- Subjective rollback date uses rolled-back key for intense check

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `b0d5f6d` | test | add failing tests for annotateIntense (PRED-10) |
| `04e68ee` | feat | add annotateIntense to day-bucket (PRED-10) |

## Deviations from Plan

None — plan executed exactly as written. JSDoc was updated as part of the GREEN commit rather than a separate REFACTOR commit; this is a minor sequencing variation, not a semantic deviation.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or external trust boundaries introduced. `annotateIntense` reads from `settings.intenseDays` (a user-controlled string array). The Array.isArray guard (T-12-02-01) and realistic size bound acceptance (T-12-02-02) from the plan's threat register are fully mitigated.

## Self-Check: PASSED

- FOUND: `js/lib/day-bucket.js`
- FOUND: `tests/unit/day-bucket.test.js`
- FOUND commit `b0d5f6d`: test(NW-12-02): add failing tests for annotateIntense (PRED-10)
- FOUND commit `04e68ee`: feat(NW-12-02): add annotateIntense to day-bucket (PRED-10)
- 667 unit tests pass, 0 fail
