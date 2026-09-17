---
phase: 24-autosave
plan: 01
subsystem: lib/autosave
tags: [file-system-access-api, indexeddb, autosave, debounce, tdd, service-worker]
requires: []
provides:
  - "js/lib/autosave.js: pickSaveDirectory, saveToDisk, restoreHandle, removeSaveDirectory, deriveAutosaveFilename, createDebouncedAutosave, isFileSystemAccessSupported, AUTOSAVE_DEBOUNCE_MS, createIndexedDbHandleStore"
  - "tests/unit/autosave.test.js: full behavior coverage via hand-rolled fakes"
  - "sw.js PRECACHE_LIST + tests/unit/sw-precache.test.js: autosave.js registered for offline/PWA use"
affects: [24-02, 24-03, 24-04]
actuals:
  tokens: 5660
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - "Injectable { picker, store } / { store } options-object seam on pickSaveDirectory/restoreHandle/removeSaveDirectory, mirroring createStorageLocal(key, ls) in js/adapters/storage-local.js"
    - "Hand-rolled fake doubles (no mocking library) for store and FileSystemDirectoryHandle, mirroring makeFakeLS in tests/integration/persistence.test.js"
    - "Trailing-edge debounce via setTimeout/clearTimeout with a trigger.cancel() escape hatch"
key-files:
  created:
    - js/lib/autosave.js
    - tests/unit/autosave.test.js
  modified:
    - sw.js
    - tests/unit/sw-precache.test.js
key-decisions:
  - "D-01/D-02: autosave.js owns filename derivation (deriveAutosaveFilename imports formatLocalISO from time.js) — both Option A and Option B from D-02 are satisfied since app.js (Plan 24-02) will still call the helper and pass the result into saveToDisk's filename parameter."
  - "D-06: restoreHandle's permission branching is structural, not just documented — 'granted' and 'denied' both pass through directly with zero re-prompt calls; only 'prompt' triggers exactly one requestPermission call."
  - "D-05: saveToDisk contains no try/catch anywhere in its body — verified structurally by grep, not just by convention — so write failures always propagate to the caller (Plan 24-02's app.js)."
  - "createIndexedDbHandleStore's internal shape: single object store ('handles') in one database ('nightwatch-autosave', v1), one fixed key ('directoryHandle') — simplest shape satisfying PLAT-01's 'no npm package' constraint; unexercised by unit tests (Node has no IndexedDB global), left for Plan 24-03's E2E coverage."
patterns-established:
  - "Options-object dependency injection for browser-only async APIs (File System Access, IndexedDB) — default to the real global, let tests inject a fake, matching the storage-local.js precedent."
requirements-completed: [PLAT-01, PLAT-02, PLAT-03]
coverage:
  - id: D1
    description: "pickSaveDirectory calls picker({mode:'readwrite'}), persists handle via store.set, returns handle; rejects without calling store.set on picker cancellation"
    requirement: "PLAT-01"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#pickSaveDirectory"
        status: pass
    human_judgment: false
  - id: D2
    description: "restoreHandle resolves {handle,status} across unset/granted/prompt->granted/prompt->denied/denied-direct branches, never re-prompting an already-denied permission"
    requirement: "PLAT-03"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#restoreHandle"
        status: pass
    human_judgment: false
  - id: D3
    description: "saveToDisk writes via getFileHandle->createWritable->write->close in order, is idempotent on repeat calls, and propagates createWritable/write rejections uncaught"
    requirement: "PLAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#saveToDisk"
        status: pass
    human_judgment: false
  - id: D4
    description: "removeSaveDirectory calls store.remove() and never throws when no handle is persisted"
    requirement: "PLAT-01"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#removeSaveDirectory"
        status: pass
    human_judgment: false
  - id: D5
    description: "deriveAutosaveFilename produces the byte-identical nightwatch-YYYY-MM-DD.json template used by downloadJSON"
    requirement: "PLAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#deriveAutosaveFilename"
        status: pass
    human_judgment: false
  - id: D6
    description: "createDebouncedAutosave collapses rapid calls to one fn invocation after delayMs, forwards arguments, and supports cancel()"
    requirement: "PLAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#createDebouncedAutosave"
        status: pass
    human_judgment: false
  - id: D7
    description: "isFileSystemAccessSupported is a pure typeof check with no navigator.userAgent sniffing"
    requirement: "PLAT-02"
    verification:
      - kind: unit
        ref: "tests/unit/autosave.test.js#isFileSystemAccessSupported"
        status: pass
    human_judgment: false
  - id: D8
    description: "autosave.js registered in sw.js PRECACHE_LIST, alphabetically ordered, enforced by a new precache test"
    requirement: "PLAT-01"
    verification:
      - kind: unit
        ref: "tests/unit/sw-precache.test.js#contains autosave.js"
        status: pass
    human_judgment: false
  - id: D9
    description: "createIndexedDbHandleStore's real IndexedDB-backed implementation (only exercised for real in a browser)"
    requirement: "PLAT-01"
    verification: []
    human_judgment: true
    rationale: "Node has no IndexedDB global — this task's unit tests exclusively exercise pickSaveDirectory/restoreHandle/removeSaveDirectory via the injected `store` fake, per the plan's explicit instruction. Real IndexedDB exercise is deferred to Plan 24-03's E2E coverage."
duration: 20min
completed: 2026-09-17
status: complete
---

# Phase 24 Plan 01: Autosave Core Library Summary

**Pick/persist/restore/write round trip over the File System Access API with an inline IndexedDB handle-store, plus filename derivation, debounce, and browser-support detection — all injectable and unit-tested via hand-rolled fakes.**

## Performance
- **Duration:** ~20min
- **Started:** 2026-09-17T14:00:00Z
- **Completed:** 2026-09-17T14:20:03Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Built `js/lib/autosave.js` exporting all 9 symbols the plan required: `pickSaveDirectory`, `restoreHandle`, `saveToDisk`, `removeSaveDirectory`, `createIndexedDbHandleStore`, `deriveAutosaveFilename`, `createDebouncedAutosave`, `isFileSystemAccessSupported`, `AUTOSAVE_DEBOUNCE_MS`.
- Implemented the full PLAT-01/02/03 round trip with an injectable `{ picker, store }` / `{ store }` seam, defaulting to `globalThis.showDirectoryPicker` and a real inline IndexedDB wrapper (`createIndexedDbHandleStore`) — zero npm dependencies (`package.json` `dependencies` stays `{}`).
- Implemented D-06's exact permission-branch matrix in `restoreHandle`: `unset` on no persisted handle, `granted`/`denied` pass through directly (no re-prompt), `prompt` re-prompts exactly once via `requestPermission` and maps the result to `granted`/`denied`.
- Implemented `saveToDisk` with zero try/catch — write failures propagate uncaught to the caller per D-05 — and verified idempotent overwrite behavior (two identical calls leave one file entry, unchanged content) per D-01/D-04.
- Added `deriveAutosaveFilename(clock)` reusing `formatLocalISO` from `time.js`, producing a byte-identical filename to `import-export.js`'s `downloadJSON` (D-01/D-02).
- Added `createDebouncedAutosave(fn, delayMs)` — trailing-edge debounce with a `trigger.cancel()` escape hatch, tested deterministically via `node:test`'s `t.mock.timers`.
- Added `isFileSystemAccessSupported(scope)` — a pure `typeof scope.showDirectoryPicker === 'function'` check with no `navigator.userAgent` sniffing anywhere in the implementation (PLAT-04 prohibition honored).
- Registered `./js/lib/autosave.js` in `sw.js`'s `PRECACHE_LIST` (alphabetically between `accuracy.js` and `chart-data.js`) and added the matching assertion in `tests/unit/sw-precache.test.js`.
- Wrote 23 unit tests across 8 `describe` blocks in `tests/unit/autosave.test.js`, all using hand-rolled fake doubles (no mocking library), following the strict RED→GREEN cycle per task.

## Task Commits
1. **Task 1 RED: Autosave round trip failing tests** - `5bdf460` (test)
2. **Task 1 GREEN: implement pick/restore/save round trip** - `2f09db1` (feat)
3. **Task 2 RED: filename/debounce/support failing tests** - `3e2cd48` (test)
4. **Task 2 GREEN: implement filename derivation, debounce, support** - `66b3367` (feat)
5. **Task 3: register autosave.js in sw.js PRECACHE_LIST** - `2e5938f` (feat)
6. **Rule 1 fix: avoid localStorage token in doc comment** - `6601bb0` (fix)

## Files Created/Modified
- `js/lib/autosave.js` - the autosave core library: pick/restore/save round trip, IndexedDB handle store, filename derivation, debounce, support detection
- `tests/unit/autosave.test.js` - 23 unit tests covering every behavior in the plan via hand-rolled fakes
- `sw.js` - added `./js/lib/autosave.js` to `PRECACHE_LIST`
- `tests/unit/sw-precache.test.js` - added the precache-completeness assertion for `autosave.js`

## Decisions Made
- `createIndexedDbHandleStore`'s internal shape: one object store (`'handles'`) inside one database (`'nightwatch-autosave'`, v1), one fixed key (`'directoryHandle'`) — the simplest shape satisfying PLAT-01's "no npm package" constraint (Claude's Discretion per 24-CONTEXT.md).
- Combined Task 1 and Task 2's exports into the same `js/lib/autosave.js` file (as the plan's file list implies), but kept each task's RED/GREEN cycle strictly separated by task scope rather than pre-implementing Task 2's functions during Task 1 — this avoided a "test passes unexpectedly during RED" false-negative that would have violated the fail-fast TDD rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `t.mock.timers.enable({ apis: ['setTimeout', 'clearTimeout'] })` throws on Node 24.18**
- **Found during:** Task 2 GREEN verification
- **Issue:** Node's `node:test` mock-timers API rejects `'clearTimeout'` as a standalone entry in the `apis` array (`ERR_INVALID_ARG_VALUE`); `'setTimeout'` alone covers both `setTimeout` and its paired `clearTimeout`.
- **Fix:** Removed `'clearTimeout'` from all three `apis: [...]` arrays in the debounce tests, keeping `apis: ['setTimeout']`.
- **Files modified:** tests/unit/autosave.test.js
- **Verification:** `node --test tests/unit/autosave.test.js` — all 3 debounce tests pass.
- **Commit:** bundled into `66b3367` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Doc comment tripped the D-07 storage-seam security-smoke test**
- **Found during:** post-Task-3 full-suite regression run (`node --test`)
- **Issue:** A prose comment in `js/lib/autosave.js` referenced `globalThis.localStorage` (comparing autosave.js's injection seam to `storage-local.js`'s), which `tests/integration/security-smoke.test.js`'s D-07 storage-seam guard flags as a violation — the guard matches the literal `localStorage` token anywhere in `js/` outside `storage-local.js`, comments included.
- **Fix:** Rephrased the comment to describe the pattern ("optional-injection default") without using the literal token.
- **Files modified:** js/lib/autosave.js
- **Verification:** `node --test` (full 903-test unit/integration suite) — 903 pass, 0 fail.
- **Commit:** `6601bb0`

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking test-infra fix, 1 Rule 1 bug fix). **Impact:** Both were caught and fixed before this plan's final commit; zero regressions in the pre-existing 880+ test suite.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. `createIndexedDbHandleStore`'s real IndexedDB path is exercised for real only in a browser and will be covered by Plan 24-03's E2E tests.

## Next Phase Readiness
Ready for 24-02 (app.js composition-root wiring: `eventLog.subscribe` → debounced `saveToDisk`, `restoreHandle()` on boot, Settings modal Backup fieldset injection — all depend on this plan's exports being stable).

---
*Phase: 24-autosave*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files exist on disk; all 6 task commit hashes verified present in git log.
