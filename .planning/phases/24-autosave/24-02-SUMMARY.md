---
phase: 24-autosave
plan: 02
subsystem: app-composition-root
tags: [file-system-access-api, composition-root, debounce, event-log-subscription, dependency-injection]
requires:
  - phase: 24-autosave
    provides: js/lib/autosave.js exports (pickSaveDirectory, saveToDisk, restoreHandle, removeSaveDirectory, createDebouncedAutosave, isFileSystemAccessSupported)
provides:
  - "js/app.js: autosaveState, performAutosave, debouncedAutosave (subscribed to eventLog only)"
  - "js/app.js: autosaveActions {getState, pick, remove, onExport} injected into openSettings and mountTodayScreen"
  - "js/app.js: historyOnExport shared reference reused by History export and Backup fallback export"
affects: [24-03, 24-04]
actuals:
  tokens: 1863
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Module-scope state object + boolean in-flight guard for a debounced async side effect triggered from a store subscription"
    - "Shared callback reference (historyOnExport) injected into two different UI modules to guarantee identical behavior per D-03"
key-files:
  created: []
  modified: [js/app.js]
key-decisions:
  - "app.js changes are not covered by a dedicated unit test file — app.js is a DOM-dependent composition root with module-scope side effects (document.querySelector etc.) and no jsdom/browser-DOM shim exists in this repo's node:test setup (confirmed: no devDependency beyond @playwright/test). Verification is via the full node --test suite (903/903 passing, zero regressions) plus grep-based acceptance criteria, matching the plan's own <verify> acceptance bar and the existing precedent for prior app.js additions (Phase 8's SW registration/update-banner/file-note code, none of which have dedicated unit tests either)."
  - "autosaveActions.pick/remove call the real pickSaveDirectory()/removeSaveDirectory() with no store override — app.js is the one place that uses the real IndexedDB-backed default, per PLAT-01's injectable-seam design."
patterns-established: []
requirements-completed: [PLAT-02, PLAT-03]
coverage:
  - id: D1
    description: "eventLog.subscribe registers debouncedAutosave; settings.subscribe is never wired to it (grep-verified, 0 real subscribe wiring, only comments mention the token)"
    requirement: "PLAT-02"
    verification:
      - kind: unit
        ref: "node --test (full 903-test suite, zero regressions)"
        status: pass
      - kind: static-analysis
        ref: "grep -n \"settings.subscribe\" js/app.js — only comment-line occurrences"
        status: pass
    human_judgment: false
  - id: D2
    description: "restoreHandle() called exactly once, at module scope, never inside a subscriber"
    requirement: "PLAT-03"
    verification:
      - kind: static-analysis
        ref: "grep -n \"restoreHandle(\" js/app.js — single occurrence at module scope"
        status: pass
    human_judgment: false
  - id: D3
    description: "performAutosave no-ops on unsupported/ungranted/null-handle, guards against overlapping in-flight writes, and surfaces (never swallows) errors while preserving handle/status on failure"
    requirement: "PLAT-02"
    verification:
      - kind: unit
        ref: "node --test tests/integration/security-smoke.test.js (clock-seam + storage-seam guards)"
        status: pass
    human_judgment: true
    rationale: "The exact concurrency-guard and error-preservation behavior is only exercisable in a real browser with the File System Access API; Node has neither. Verified by code inspection against every must_haves.truths line in the plan frontmatter, not by an automated browser test — deferred to Plan 24-03/24-04's E2E coverage per 24-01's precedent."
  - id: D4
    description: "autosaveActions exposes exactly {getState, pick, remove, onExport}; openSettings and mountTodayScreen each receive only their documented slice"
    requirement: "PLAT-03"
    verification:
      - kind: static-analysis
        ref: "grep -n \"openSettings({\\|mountTodayScreen({\" js/app.js"
        status: pass
    human_judgment: false
duration: ~7min
completed: 2026-09-17
status: complete
---

# Phase 24 Plan 02: Autosave App.js Wiring Summary

**Boot-time handle restore, debounced event-log-triggered autosave, and a minimal `autosaveActions` contract wired into the composition root for Plans 24-03/24-04 to consume without importing `js/lib/autosave.js` directly.**

## Performance
- **Duration:** ~7min
- **Started:** 2026-09-17T16:24:00+02:00
- **Completed:** 2026-09-17T16:30:34+02:00
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added module-scope `autosaveState` (`{ supported, status, handle, folderName, lastSavedAt, error }`) computed once via `isFileSystemAccessSupported()` at module load.
- Implemented `performAutosave()`: no-ops when unsupported/ungranted/handle-null, guards overlapping writes via an `autosaveSaving` boolean, serializes `storage.load()`, derives the filename via `deriveAutosaveFilename(clock)`, calls `saveToDisk`, and on success updates `lastSavedAt` (via `clock.now()`, never `new Date()`) while clearing `error`; on failure records `error` without touching `handle`/`status` (D-05).
- Wired `debouncedAutosave = createDebouncedAutosave(performAutosave, AUTOSAVE_DEBOUNCE_MS)` to `eventLog.subscribe(...)` only — `settings.subscribe(...)` is never given the trigger, so settings-only changes (e.g. `cutoverHour`) never write to disk.
- Called `restoreHandle()` exactly once at module-evaluation time (gated on `autosaveState.supported`), populating `handle`/`status`/`folderName` from its resolved `{handle, status}`, with a swallowing `.catch(() => {})` so a restore failure never blocks app boot.
- Defined `autosaveActions = { getState, pick, remove, onExport }`: `getState()` returns a shallow copy so callers cannot mutate internal state; `pick()` calls the real `pickSaveDirectory()`, silently no-ops on `AbortError` (user cancelled the picker), and surfaces any other rejection into `autosaveState.error`; `remove()` calls `removeSaveDirectory()` and resets handle/status/folderName; `onExport` is the literal same function reference as the History screen's existing export callback (D-03), enforced structurally via a single shared `historyOnExport` const.
- Injected `autosave: autosaveActions` into the existing `openSettings(...)` call and `autosave: { isSupported, pick }` (the minimal slice) into the existing `mountTodayScreen(...)` call.

## Task Commits
1. **Task 1: Autosave state, debounced save, and boot-time restore** - `5bce0f1` (feat)
2. **Task 2: Expose autosaveActions and wire it into openSettings / mountTodayScreen** - `e83c75d` (feat)

## Files Created/Modified
- `js/app.js` - added autosave state/wiring block after `eventLog` creation; added `historyOnExport`/`autosaveActions` before `mountHeader`; updated `onSettings`, `mountTodayScreen`, and the History screen's `onExport` call sites.

## Decisions Made
- No dedicated unit test file was added for these app.js changes. app.js is a DOM-dependent composition root (`document.querySelector` etc. execute at module load) and this repo's `node:test` setup has no DOM shim (`package.json` devDependencies contain only `@playwright/test`). This matches the plan's own `<verify>` block, which explicitly states the acceptance bar is "the rest of the suite still passes" plus grep-based `<acceptance_criteria>` — both of which were run and passed (see Deviations below for the TDD-gate note).
- `autosaveActions.pick`/`remove` call the real `pickSaveDirectory()`/`removeSaveDirectory()` with no store override, since app.js is the one composition-root call site that should use the real IndexedDB-backed default (PLAT-01's injectable-seam design — tests inject fakes, runtime omits the option).

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### TDD Gate Compliance Note

Task 1 carries `tdd="true"` in its frontmatter, but no `test(...)` commit was created before the `feat(...)` commit. This is a deliberate, plan-acknowledged exception rather than a skipped gate: the task's own `<verify>` block states "this task only adds top-level statements to app.js, which is not directly unit-tested, so the acceptance bar is 'the rest of the suite still passes'" — app.js requires a live DOM (`document.querySelector`, etc.) at module-evaluation time, and this repo has no jsdom or other DOM shim in its `node:test` toolchain (confirmed via `package.json`: only `@playwright/test` in devDependencies). Writing a Node-side "failing test" for module-scope code that throws on import outside a browser would not exercise the actual behavior being verified. Verification instead used: (1) the full 903-test `node --test` suite run before and after each task (zero regressions), and (2) every grep-based `<acceptance_criteria>` line specified in the plan (`settings.subscribe` never wired to the trigger, `restoreHandle()` called exactly once, no bare `new Date()`, single shared `downloadJSON(storage, clock)` call site, `AbortError` branch present). This mirrors the existing precedent already in app.js (Phase 8's SW-registration/update-banner/file-note additions, none of which have dedicated unit tests either).

**Total deviations:** 0 auto-fixed. **Impact:** None — the TDD-gate note above documents an explicit, plan-sanctioned test-strategy substitution, not a missed fix or an unresolved issue.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for 24-03 (Settings modal Backup fieldset) and 24-04 (Today screen first-launch banner). Both plans consume `autosaveActions`/the `autosave` deps slice already injected into `openSettings(...)` and `mountTodayScreen(...)` — neither plan needs to import `js/lib/autosave.js` directly.

---
*Phase: 24-autosave*
*Completed: 2026-09-17*

## Self-Check: PASSED

All claims verified: `js/app.js` exists and contains the documented changes; commits `5bce0f1` and `e83c75d` both present in `git log`; full `node --test` suite passes 903/903 after both tasks.
