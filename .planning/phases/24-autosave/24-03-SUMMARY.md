---
phase: 24-autosave
plan: 03
subsystem: settings-ui
tags: [file-system-access-api, settings-modal, xss-guard, e2e-opfs, dependency-injection]
requires:
  - phase: 24-autosave
    provides: autosaveActions object injected into openSettings() by app.js (Plan 24-02)
provides:
  - "index.html: #backupFieldset with three mutually-exclusive folder-row states (unsupported/unset/set), a status line, and a fallback Export button"
  - "js/ui/settings-modal.js: renderBackupSection(state), wireBackupButtons(autosave), openSettings({..., autosave}) optional param"
  - "tests/e2e/settings-autosave.spec.js: real-Chromium coverage for both the unsupported fallback and the supported pick-and-save flow, using navigator.storage.getDirectory() as a real FileSystemDirectoryHandle stand-in"
affects: []
actuals:
  tokens: 3782
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "OPFS root directory (navigator.storage.getDirectory()) used as a real, dialog-free FileSystemDirectoryHandle stand-in for showDirectoryPicker in E2E tests, since Playwright's filechooser interception does not cover the File System Access API directory picker"
key-files:
  created: [tests/e2e/settings-autosave.spec.js]
  modified: [index.html, js/ui/settings-modal.js]
key-decisions:
  - "OPFS's synthetic root directory handle's own .name is the empty string per spec (confirmed empirically against real Chromium) — unlike a real user-picked folder. The E2E test therefore asserts #autosaveFolderName is attached and the row state is correct rather than asserting non-empty text, since the plan's <action> prose (\"non-empty\") described a real-picker assumption that does not hold for the OPFS stand-in used to make the test dialog-free."
  - "wireBackupButtons wires #autosavePickBtn and #autosaveChangeBtn to the identical pickOrChange handler reference (same function object), matching the plan's behavior spec that both buttons share one handler body."
patterns-established: []
requirements-completed: [PLAT-01, PLAT-04]
coverage:
  - id: D1
    description: "Backup fieldset renders exactly one of three mutually-exclusive states (unsupported/unset/set) driven by autosave.getState(), with the revoked note shown only when status is 'denied'"
    requirement: "PLAT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#Unsupported fallback (PLAT-04) > Backup fieldset renders the unsupported row with fallback Export (D-06)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#Supported pick-and-save flow (PLAT-01/PLAT-02) > Choose folder flips the row to set..."
        status: pass
    human_judgment: false
  - id: D2
    description: "Choose folder / Change folder call autosave.pick() then re-render the Backup section from a fresh getState(), flipping unset -> set with no modal close/reopen"
    requirement: "PLAT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#Supported pick-and-save flow (PLAT-01/PLAT-02) > Choose folder flips the row to set..."
        status: pass
    human_judgment: false
  - id: D3
    description: "The fallback Export button invokes the SAME shared callback reference the History screen's Export JSON button uses (historyOnExport), not a second export code path"
    requirement: "PLAT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#Unsupported fallback (PLAT-04) > fallback Export button fires the shared export handler (D-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full pick -> debounce (500ms) -> write -> read-back chain produces a real file readable from navigator.storage.getDirectory(), and the status line reads 'Last saved: HH:MM' afterward, never both error and last-saved text at once"
    requirement: "PLAT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#Supported pick-and-save flow (PLAT-01/PLAT-02) > Choose folder flips the row to set..."
        status: pass
    human_judgment: false
  - id: D5
    description: "handle.name is rendered via textContent only, never innerHTML (T-24-07 XSS guard)"
    requirement: "PLAT-04"
    verification:
      - kind: static-analysis
        ref: "grep -n '.innerHTML' js/ui/settings-modal.js — zero matches; node --test tests/integration/security-smoke.test.js T-07 check"
        status: pass
    human_judgment: false
duration: ~25min
completed: 2026-09-17
status: complete
---

# Phase 24 Plan 03: Settings Backup Fieldset Summary

**Backup fieldset with three folder-row states (unsupported/unset/set), a session-scoped status line, and OPFS-mocked E2E coverage exercising the real File System Access write/read-back path.**

## Performance
- **Duration:** ~25min
- **Started:** 2026-09-17T17:05:00+02:00 (approx)
- **Completed:** 2026-09-17T17:30:00+02:00 (approx)
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Added a new "Backup" fieldset (Group 5, D-07) to `index.html`'s Settings modal, positioned between the existing Data and Stages fieldsets; renumbered the Stages fieldset's leading comment from "Group 5" to "Group 6" to keep the numbering sequential.
- Three mutually-exclusive `hidden`-by-default state containers, following the exact `#tifOptions`/`#classicOptions` show/hide convention already established in the same modal:
  - `#autosaveUnsupportedRow` — explanatory note + fallback `#autosaveExportBtn` (D-03/PLAT-04).
  - `#autosaveUnsetRow` — `#autosavePickBtn` + a nested `#autosaveRevokedNote` (hidden unless status is `'denied'`, D-06).
  - `#autosaveSetRow` — folder name (`#autosaveFolderName`, D-08: name only, never a path) + `#autosaveChangeBtn` + `#autosaveRemoveBtn`.
- `#autosaveStatus` reuses the existing `.importStatus`/`.importStatus:empty`/`.importStatus.error` CSS rule verbatim — this plan introduces zero new CSS.
- None of the nine new elements carry a `name` attribute, so they are never picked up by the Save button's `new FormData(form)` read.
- Implemented `renderBackupSection(state)` in `js/ui/settings-modal.js`: sets `.hidden` on all three rows and the revoked note, `.textContent` on the folder name, and renders the status line so exactly one of error/last-saved/empty ever shows (D-09).
- Implemented `wireBackupButtons(autosave)`: `#autosavePickBtn`/`#autosaveChangeBtn` share one `pickOrChange` handler (`await autosave.pick(); renderBackupSection(autosave.getState())`); `#autosaveRemoveBtn` calls `autosave.remove()` then re-renders; `#autosaveExportBtn` calls `autosave.onExport()`. All four handlers use module-level ref variables (`_autosavePickHandler`, `_autosaveChangeHandler`, `_autosaveRemoveHandler`, `_autosaveExportHandler`) removed-then-re-added on every `openSettings()` call, mirroring `_forecastAlgorithmChangeHandler`'s existing idiom — no listener accumulation across repeated opens.
- `openSettings({settings, eventLog, storage, id, autosave})` now accepts the optional `autosave` param and calls both new functions only when it's truthy, so the modal still opens correctly in contexts/tests that omit it (e.g. the pre-existing `settings-modal.spec.js`, which passed unchanged — 15/15).
- Created `tests/e2e/settings-autosave.spec.js` with two `test.describe` blocks, run against real Chromium (not authored-only — actually executed):
  - **Unsupported fallback (PLAT-04):** `window.showDirectoryPicker` deleted via `page.addInitScript` before `page.goto`; asserts the unsupported row is the only visible one, and that clicking the fallback Export button fires a real `download` event with the `nightwatch-YYYY-MM-DD.json` filename convention — proving D-03's shared-handler reuse.
  - **Supported pick-and-save flow (PLAT-01/PLAT-02):** `window.showDirectoryPicker` mocked to resolve `navigator.storage.getDirectory()` — the real OPFS root, standing in for a real user-picked `FileSystemDirectoryHandle` with zero permission dialogs (per BACKLOG.md B-051's implementation notes: Playwright cannot intercept `showDirectoryPicker` via `filechooser`). Clicking Choose folder flips the row to `set` in place (no modal close/reopen); closing Settings and logging a quick-log event, then waiting past the 500ms debounce, produces a real file in OPFS that is read back and parsed, confirming the just-logged `wake` event is present; re-opening Settings shows `#autosaveStatus` reading `Last saved: HH:MM`.

## Task Commits
1. **Task 1: Backup fieldset markup in index.html** - `41dd863` (feat)
2. **Task 2: renderBackupSection / wireBackupButtons in settings-modal.js** - `1bb8c0e` (feat)
3. **Task 3: E2E coverage for supported and fallback states** - `5cd84a3` (test)

## Files Created/Modified
- `index.html` - new `#backupFieldset` (Group 5) with the three state rows, revoked note, folder name, and status line; Stages fieldset comment renumbered to Group 6.
- `js/ui/settings-modal.js` - added `autosave` param to `openSettings`, four new module-level handler-ref variables, `renderBackupSection(state)`, and `wireBackupButtons(autosave)`.
- `tests/e2e/settings-autosave.spec.js` (new) - two `test.describe` blocks (unsupported fallback, supported pick-and-save flow), 3 tests total, all run and passing.

## Decisions Made
- **OPFS root `.name` is empty, not the plan's assumed non-empty value.** The plan's Task 3 `<action>` prose said to "assert ... `#autosaveFolderName` non-empty" after picking. Empirically verified against real Chromium (a throwaway spec run and discarded before writing the final test) that `navigator.storage.getDirectory()`'s root handle has `.name === ''` per spec — unlike a real user-picked folder, which always has a non-empty OS-level folder name. The plan's formal `<acceptance_criteria>` for Task 3 does not itself require a non-empty-name assertion (only: both states covered, OPFS used as the mock target, and the spec passes with zero failures), so the test instead asserts `#autosaveFolderName` is attached and the row correctly flips to `set` — verifying the render-path behavior the plan actually cares about without asserting a fact that doesn't hold for the OPFS stand-in.
- `wireBackupButtons` uses one shared `pickOrChange` function object for both `#autosavePickBtn` and `#autosaveChangeBtn`, per the plan's `<behavior>` spec that both buttons wire to "the same handler."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test-authoring correction] OPFS root handle name assertion adjusted to match real browser behavior**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 action text specified asserting `#autosaveFolderName` is "non-empty" after the pick-and-save E2E test's Choose-folder click. Empirical verification against real Chromium showed `navigator.storage.getDirectory()`'s root directory handle has `.name === ''` (empty string) per spec — the assertion as literally written would fail against the real browser, not because of a code bug but because the plan's assumption didn't match the OPFS stand-in's actual behavior.
- **Fix:** Test now asserts `#autosaveFolderName` is attached (present in the DOM, rendered without exception) and that the row correctly transitions to the `set` state, rather than asserting non-empty text content. `renderBackupSection`'s own logic (`state.folderName || ''`) is unchanged and correct — it renders whatever `handle.name` the browser reports, empty or not.
- **Files modified:** tests/e2e/settings-autosave.spec.js
- **Verification:** `npx playwright test tests/e2e/settings-autosave.spec.js` — 3/3 pass.
- **Commit:** 5cd84a3

**Total deviations:** 1 auto-fixed (test-authoring correction, Rule 1). **Impact:** None on production code — `renderBackupSection`/`wireBackupButtons` match the plan's `<behavior>` block exactly. The single deviation only adjusted a test assertion to reflect a real-browser fact (OPFS root handle name is empty) that the plan's prose didn't anticipate.

## Issues Encountered
None beyond the OPFS-name deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 24-04 (Today screen first-launch banner, D-10/D-11) — both plans consume `autosaveActions`/the `autosave` deps object app.js already injects, and 24-04 does not touch `index.html`'s new Backup fieldset or `js/ui/settings-modal.js`'s new functions, so there is no file overlap.

---
*Phase: 24-autosave*
*Completed: 2026-09-17*

## Self-Check: PASSED

All claims verified: `index.html`, `js/ui/settings-modal.js`, and `tests/e2e/settings-autosave.spec.js` exist and contain the documented changes; commits `41dd863`, `1bb8c0e`, `5cd84a3` all present in `git log`; `node --test tests/integration/security-smoke.test.js` (9/9), full `node --test` unit/integration suite (903/903), `tests/e2e/settings-modal.spec.js` (15/15), and `tests/e2e/settings-autosave.spec.js` (3/3) all pass.
