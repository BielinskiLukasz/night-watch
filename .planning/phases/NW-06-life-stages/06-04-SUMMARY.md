---
phase: NW-06-life-stages
plan: "04"
subsystem: ui/settings
tags: [stages, crud, settings-modal, e2e]
requirements: [STAGE-01]

dependency_graph:
  requires:
    - NW-06-life-stages/06-01  # DEFAULT_SETTINGS.stages + activeStageId
    - NW-06-life-stages/06-02  # filterDayRecordsByStage
    - NW-06-life-stages/06-03  # stage selector on Today screen; el()/clear() in dom.js
  provides:
    - Settings modal Stages fieldset with inline CRUD
    - mountStagesCrud / renderStageList / buildInlineForm helpers
    - Delete with activeStageId reset (D6-15)
    - Overlap warning on save (D6-06)
  affects:
    - index.html (new #stagesFieldset inside dialog#settings)
    - js/ui/settings-modal.js (new private functions + module-level handler refs)
    - style.css (Stages CRUD CSS block)
    - tests/e2e/stages.spec.js (7 new CRUD tests extending 06-03 suite)

tech_stack:
  added: []
  patterns:
    - Native <dialog> fieldset extension (same pattern as 02-04)
    - Module-level handler refs to prevent listener accumulation on repeated opens
    - el()/clear() for XSS-safe DOM manipulation (T-07)
    - No name attribute on inline form inputs (FormData safety)
    - Delegated event handler on #stagesList for Edit/Delete/Save/Cancel

key_files:
  created: []
  modified:
    - index.html
    - js/ui/settings-modal.js
    - style.css
    - tests/e2e/stages.spec.js

decisions:
  - Use delegated click handler on #stagesList rather than per-row handlers to keep handler count O(1) regardless of stage count
  - buildInlineForm takes (stage|null) as first arg — null = add mode, object = edit mode
  - Overlap warning is a window.confirm prompt (non-blocking, user can proceed)
  - Delete confirmation also uses window.confirm per D6-15

metrics:
  duration: "~15 minutes"
  completed: "2026-06-29T18:39:45Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase NW-06 Plan 04: Settings Modal Stages CRUD Summary

**One-liner:** Inline CRUD for named date-range stages inside the Settings modal, with delete/activeStageId reset and overlap warnings.

## What Was Built

- **index.html** — Added `#stagesFieldset` (after Import/Export fieldset, before `<menu>`) containing `#stagesList` div and `#addStageBtn`. Button carries `type="button"` to prevent form submission.
- **js/ui/settings-modal.js** — Added three private helper functions:
  - `mountStagesCrud({ settings })` — wires Add button and delegated click handler on the list; uses module-level `_stagesCrudHandler` / `_addStageBtnHandler` refs to prevent accumulation across Settings opens.
  - `renderStageList(listEl, settings)` — rebuilds the stages table (or empty-state `<p>`) from current settings; uses `el()`/`clear()` throughout (T-07).
  - `buildInlineForm(stage, listEl, settings)` — creates the inline add/edit form; inputs have no `name` attribute to avoid FormData pickup.
  - Call to `mountStagesCrud({ settings })` inserted in `openSettings()` before `dlg.showModal()`.
- **style.css** — Appended Stages CRUD CSS block (table, inline form, buttons, empty state).
- **tests/e2e/stages.spec.js** — Added 7 new CRUD tests in a dedicated describe section:
  1. Add stage with endDate — list row appears, localStorage updated
  2. Add open-ended stage — End cell shows "ongoing", endDate null in storage
  3. Edit stage — form pre-filled, rename persisted
  4. Delete stage — row removed, stages-empty shown, localStorage updated
  5. Delete active stage — activeStageId reset to null (D6-15)
  6. Validation: empty name shows error, form stays open
  7. Overlap warning: confirm dialog fires, both stages saved (D6-06)

## Test Results

- Unit tests: 307/307 pass (no regressions)
- E2E: 12/12 pass (`stages.spec.js` — 5 existing from 06-03 + 7 new CRUD tests)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or hardcoded empty values introduced.

## Threat Flags

None — all dynamic content uses `textContent`; no new network endpoints or auth paths introduced. The `window.confirm()` calls are purely UI affordances with no security implications.

## Self-Check

Files exist:
- [x] `index.html` modified — `#stagesFieldset` present
- [x] `js/ui/settings-modal.js` modified — `mountStagesCrud`, `renderStageList`, `buildInlineForm` added
- [x] `style.css` modified — Stages CRUD CSS appended
- [x] `tests/e2e/stages.spec.js` modified — 7 new CRUD tests added

Commits:
- [x] `a62fb33` — feat(06-04): Stages fieldset in Settings modal with inline CRUD
- [x] `168f0a0` — test(06-04): E2E tests for Stages CRUD in Settings modal

## Self-Check: PASSED
