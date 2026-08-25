---
phase: NW-06-life-stages
plan: "05"
subsystem: ui/settings, tests
tags: [csv-import, stages, etap, integration-test, e2e, security-audit, phase-gate]
requirements: [STAGE-01, STAGE-02]

dependency_graph:
  requires:
    - NW-06-life-stages/06-01  # stages/activeStageId schema
    - NW-06-life-stages/06-02  # filterDayRecordsByStage + etap CSV parsing
    - NW-06-life-stages/06-03  # stage selector on Today screen
    - NW-06-life-stages/06-04  # Stages CRUD in Settings modal
  provides:
    - CSV import wires etap → settings.update({ stages }) (D6-07)
    - Import status message mentions stage count
    - Integration test: CSV with etap → settings.stages populated
    - E2E test: CSV with etap → stages visible in Settings + Today selector
    - Security audit: zero innerHTML for stage-related dynamic content
    - Human verification: all three Phase 6 success criteria confirmed

  affects:
    - js/ui/settings-modal.js (handleCsvImport extended + stale-snap bug fixed)
    - tests/integration/import-export-flow.test.js (new etap test)
    - tests/e2e/import-export.spec.js (new etap E2E test)

tech_stack:
  added: []
  patterns:
    - Two-step CSV import: settings.replace(blob) resets to clean state, then settings.update({ stages }) overlays
    - Read live settings.get() at Save time (not stale closure snapshot) for CRUD-managed fields

key_files:
  created: []
  modified:
    - js/ui/settings-modal.js
    - tests/integration/import-export-flow.test.js
    - tests/e2e/import-export.spec.js

decisions:
  - settings.replace() then settings.update({ stages }) are synchronous — no intermediate subscriber state visible (T-06-05-02 mitigated)
  - Only call settings.update({ stages }) when stages.length > 0 — CSV without etap never wipes existing stages (T-06-05-03 mitigated)
  - Save handler reads settings.get().stages at close time, not the stale snap captured at open time — CRUD operations on the live store are preserved

metrics:
  duration: "~25 minutes (including bug fix)"
  completed: "2026-06-29"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 3
---

# Phase NW-06 Plan 05: CSV Import Stage Wiring + Phase Gate Summary

**One-liner:** Wired CSV import to auto-detect etap stages and write them to the settings store; added integration + E2E tests; fixed stale-snap Save bug; human-verified all three Phase 6 success criteria.

## What Was Built

- **js/ui/settings-modal.js** — Two changes:
  1. `handleCsvImport` extended to destructure `stages` from `parseCSV` return and call `settings.update({ stages })` when `stages.length > 0` (D6-07). Import status message updated to mention stage count.
  2. **Stale-snap bug fixed**: `raw` in the Settings Save handler was reading `snap.stages` / `snap.activeStageId` (captured at modal-open time). CRUD operations update the live store via `settings.update()` but never update `snap`. Changed both reads to `settings.get().stages` / `settings.get().activeStageId` so newly added/edited/deleted stages survive the Save.
- **tests/integration/import-export-flow.test.js** — New test `CSV import with etap column creates stages in settings`: builds a CSV string with two etap runs, calls `parseCSV`, simulates the two-step replace + update flow, asserts `settings.get().stages` has 2 items with correct names and open-ended last entry.
- **tests/e2e/import-export.spec.js** — New test `CSV import with etap column creates stages shown in Settings`: injects a 4-row CSV with etap column via `setInputFiles`, verifies import status, reopens Settings to assert 2 stage rows, closes to assert Today selector shows both stages.

## Test Results

- Unit: 307/307 pass (no regressions)
- Integration: all pass including new etap test
- E2E: 93/93 pass — includes all 12 Phase 6 stage tests + 1 new etap import test

## Deviations from Plan

- **Stale-snap bug (unplanned fix):** Human verification found that stages added via CRUD were wiped when Settings was saved. Root cause: `raw` in the close handler used `snap` (stale closure) for `stages` and `activeStageId`. Fix: read `settings.get()` at Save time. One additional commit (`c5b960c`) beyond the plan's three commits.
- **Missing fields in raw (unplanned fix):** An earlier commit (`3598ef1`) added `stages`/`activeStageId` to `raw` after human verification found the Save handler throwing "stages must be an array". These two fixes together close the human-verify gate.

## Known Stubs

None.

## Threat Flags

None — all dynamic content uses `textContent`; security audit confirmed zero `innerHTML` assignments in `today-screen.js`, `settings-modal.js`, and `stages.js`.

## Self-Check

Files exist:
- [x] `js/ui/settings-modal.js` — `handleCsvImport` reads and applies stages; Save handler reads live `settings.get()`
- [x] `tests/integration/import-export-flow.test.js` — etap integration test present
- [x] `tests/e2e/import-export.spec.js` — etap E2E test present

Commits:
- [x] `bdd8cd3` — feat(06-05): wire CSV import etap stages to settings store (STAGE-01)
- [x] `1e16a03` — test(06-05): E2E test for CSV etap import; security audit pass
- [x] `03c76b5` — test(06-05): full test suite verified — Phase 6 zero regressions
- [x] `3598ef1` — fix(06-05): stages/activeStageId missing from settings Save raw + light-theme CSS
- [x] `c5b960c` — fix(06): Read live stages/activeStageId at Save time, not stale snap

Human verification: **APPROVED** — all three Phase 6 ROADMAP success criteria confirmed in browser.

## Self-Check: PASSED
