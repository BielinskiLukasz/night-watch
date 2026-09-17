---
phase: 24-autosave
verified: 2026-09-17T23:00:00Z
status: gaps_found
score: 7/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Clicking 'Remove' calls autosave.remove() and re-renders the Backup section back to the unset state (Plan 24-03 must_have)"
    status: failed
    reason: "The Settings modal's remove handler does not await the async autosave.remove() call before re-rendering; js/ui/settings-modal.js:477-480 calls autosave.remove() and immediately calls renderBackupSection(autosave.getState()) on the next line. Since autosaveActions.remove in js/app.js:184-189 is async, the state mutations (handle=null, status='unset', folderName=null) have not yet completed when getState() is called. The Backup fieldset therefore shows the 'set' row (with folder name and Change/Remove buttons) immediately after the user clicks Remove, and only reflects the removal on some later unrelated re-render."
    artifacts:
      - path: "js/ui/settings-modal.js"
        issue: "lines 477-480 missing await on autosave.remove() before re-render"
    missing:
      - "Add await before autosave.remove() call in the remove handler: _autosaveRemoveHandler = async () => { await autosave.remove(); renderBackupSection(autosave.getState()); };"
  - truth: "The first-launch autosave banner renders only when autosave is supported AND not yet dismissed, and does not re-appear for users who set up autosave through Settings first (functional gap)"
    status: failed
    reason: "The Today screen's banner gate is: autosave && autosave.isSupported && !localStorage.getItem('autosaveBannerDismissed'). Plan 24-04 passes only { isSupported, pick } to mountTodayScreen — no getState. A user who discovers the Backup fieldset in Settings and sets up autosave there (without clicking the banner's 'Set up autosave' or 'Dismiss' buttons) never sets the autosaveBannerDismissed flag. On every subsequent page load, the banner reappears with the text 'set up autosave to a folder on your device' even though autosave is already active and successfully writing. This is a misleading permanent nudge for anyone who discovers the feature via Settings first instead of the banner."
    artifacts:
      - path: "js/ui/today-screen.js"
        issue: "line 894 gate does not check whether autosave is already configured"
      - path: "js/app.js"
        issue: "line 218 passes only { isSupported, pick } to mountTodayScreen, not full state needed to detect configured status"
    missing:
      - "Either: (a) pass autosave: { isSupported, isConfigured: autosaveState.status === 'granted', pick } to mountTodayScreen and skip rendering when already configured, or (b) have settings-modal.js's pick/remove handlers also set the autosaveBannerDismissed flag so both entry points share dismissal state"
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 24: Autosave Verification Report

**Phase Goal:** Users' data saves automatically to a chosen local directory instead of relying solely on manual export, with a graceful fallback where the File System Access API is unavailable

**Verified:** 2026-09-17T23:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | pickSaveDirectory() calls the injected picker with { mode: 'readwrite' } and persists the returned handle via the injected store's set(); when the picker rejects (e.g. user cancels), store.set() is never called and the rejection propagates | ✓ VERIFIED | Unit test suite (tests/unit/autosave.test.js) covers all branches; test passes with hand-rolled fake doubles exercising picker-reject path |
| 2 | saveToDisk(handle, jsonString, filename) writes jsonString to filename via handle.getFileHandle(filename,{create:true}).createWritable().write(jsonString).close(), and calling it twice with identical arguments overwrites the same file with identical content — no duplication, no append | ✓ VERIFIED | Unit tests cover idempotency; E2E test (settings-autosave.spec.js) confirms real OPFS write/read-back with identical content on second write |
| 3 | restoreHandle() returns {handle:null, status:'unset'} when the store has no persisted handle; {handle, status:'granted'} when queryPermission is already 'granted'; re-prompts via handle.requestPermission({mode:'readwrite'}) ONLY when queryPermission returns 'prompt', mapping a granted re-prompt to status:'granted' and a declined one to status:'denied'; and returns status:'denied' directly (no re-prompt) when queryPermission is already 'denied' | ✓ VERIFIED | Unit tests verify all six branches of the permission state machine; code inspection (js/lib/autosave.js:113-150) confirms exact branching logic |
| 4 | deriveAutosaveFilename(clock) returns the literal template `nightwatch-${formatLocalISO(clock.now()).slice(0,10)}.json` — byte-identical in shape to js/lib/import-export.js's downloadJSON filename | ✓ VERIFIED | Unit test with fixed clock 2026-06-27T07:00 returns exactly 'nightwatch-2026-06-27.json'; grep confirms formatLocalISO import and slice(0, 10) usage |
| 5 | createDebouncedAutosave(fn, delayMs) invokes fn exactly once, delayMs after the LAST call to the returned trigger — N rapid calls inside the window collapse to one fn invocation, and trigger.cancel() suppresses a pending invocation entirely | ✓ VERIFIED | Unit tests using t.mock.timers deterministically advance time and verify single invocation after 500ms delay; cancel test verifies no invocation when cancelled |
| 6 | isFileSystemAccessSupported(scope) returns typeof scope.showDirectoryPicker === 'function' with no other logic — a pure, synchronous, stateless capability check (PLAT-04) | ✓ VERIFIED | Unit test verifies direct typeof check; grep confirms no navigator.userAgent sniffing in implementation |
| 7 | removeSaveDirectory() calls the injected store's remove() and resolves; it never throws when the store already has no handle | ✓ VERIFIED | Unit test with fake store verifies remove() call and no-throw-when-empty behavior |
| 8 | './js/lib/autosave.js' is present in sw.js's PRECACHE_LIST (alphabetically ordered in the Pure-logic lib section) and asserted present by a test in tests/unit/sw-precache.test.js | ✓ VERIFIED | Grep confirms presence in PRECACHE_LIST between accuracy.js and chart-data.js; test file contains matching assertion and passes (sw-precache.test.js:121-123) |
| 9 | On boot, when isFileSystemAccessSupported() is true, restoreHandle() runs exactly once — not from inside eventLog.subscribe or settings.subscribe, and not re-invoked on every render | ✓ VERIFIED | Code inspection (js/app.js:108-114) shows single .then(({handle, status}) => { ... }) block at module scope; grep confirms restoreHandle() appears once in the file; settings.subscribe never wired to autosave trigger (verified by searching for "settings.subscribe" — only comment mentions, no actual wiring) |
| 10 | eventLog.subscribe registers the debounced autosave trigger; settings.subscribe is never wired to it — a settings-only change (e.g. cutoverHour) never triggers a disk write | ✓ VERIFIED | Code inspection (js/app.js:105-106) shows `eventLog.subscribe(debouncedAutosave)`; grep "settings.subscribe" in js/app.js returns zero actual wiring lines (only comments) |
| 11 | When autosaveState.status !== 'granted' or autosaveState.handle is null, the debounced trigger's callback is a no-op — saveToDisk is never invoked with a null or ungranted handle | ✓ VERIFIED | Code inspection of performAutosave (js/app.js:82-104) shows guard at line 84: `if (!autosaveState.supported \|\| autosaveState.status !== 'granted' \|\| !autosaveState.handle) return;` — early exit prevents any saveToDisk call |
| 12 | A thrown/rejected saveToDisk call is caught, recorded into autosaveState.error, and does NOT clear autosaveState.handle or call removeSaveDirectory — the same folder is retried on the next mutation | ✓ VERIFIED | Code inspection (js/app.js:92-102) shows `catch (e)` branch that sets `autosaveState.error = (e && e.message) \|\| 'Save failed'` without touching handle/status; finally block resets the in-flight guard |
| 13 | performAutosave() will not start a second overlapping write while a previous write to the same handle is still in-flight (a boolean in-flight guard skips the overlapping call; the NEXT event mutation naturally re-arms the debounce and tries again) | ✓ VERIFIED | Code inspection (js/app.js:82-104) shows `autosaveSaving` boolean check at line 85 and reset in finally; guard prevents concurrent calls |
| 14 | A successful saveToDisk call updates autosaveState.lastSavedAt to the current HH:MM (via clock.now(), never new Date()) and clears autosaveState.error; lastSavedAt/error are in-memory only and reset to their initial unset values on every page load | ✓ VERIFIED | Code inspection (js/app.js:98-99) shows lastSavedAt set via `formatLocalISO(clock.now()).slice(11, 16)` (HH:MM slice) and error cleared; module-scope initialization at line 60 shows default unset values |
| 15 | The Backup fieldset renders exactly one of three mutually-exclusive states at any time: unsupported (explanatory note + fallback Export button), unset-or-denied (Choose folder button, plus a revoked-access note ONLY when status is 'denied'), or set (folder name + Change/Remove buttons) — per D-06/D-08/PLAT-04 | ✓ VERIFIED | E2E test (settings-autosave.spec.js:42-49) verifies unsupported state visibility; E2E test (settings-autosave.spec.js:77-93) verifies set state after pick; code inspection (js/ui/settings-modal.js:432-447) shows three .hidden toggles implementing the mutual exclusion |
| 16 | Clicking 'Choose folder' or 'Change folder' calls the injected autosave.pick(), then re-renders the Backup section from the fresh autosave.getState() — a successful pick flips the row from unset to set without closing/reopening the modal | ✓ VERIFIED | E2E test (settings-autosave.spec.js:82-87) verifies row flip after clicking Choose folder; code inspection (js/ui/settings-modal.js:463-469) shows both buttons wire to identical pickOrChange handler that awaits pick() then re-renders |
| 17 | Clicking 'Remove' calls autosave.remove() and re-renders the Backup section back to the unset state | ✗ FAILED | Code inspection (js/ui/settings-modal.js:477-480) reveals the remove handler does NOT await autosave.remove() before calling renderBackupSection(autosave.getState()); since autosaveActions.remove is async, the state mutations have not completed when getState() is called. The Backup fieldset therefore shows the 'set' row immediately after the click, contradicting the must_have. This path has zero test coverage (no spec clicks #autosaveRemoveBtn). |
| 18 | The fallback Export button (visible only in the unsupported state, D-03) invokes autosave.onExport() — the SAME callback reference the History screen's Export JSON button already uses, not a new/second export code path | ✓ VERIFIED | E2E test (settings-autosave.spec.js:51-64) verifies fallback Export button fires a download event with nightwatch-YYYY-MM-DD.json filename (same format as History export); code inspection (js/app.js:164) shows `onExport: historyOnExport` where historyOnExport is the single shared reference |
| 19 | The status line (#autosaveStatus) shows 'Last saved: HH:MM' after a successful autosave, or 'Error: <message>' after a failed one, and NEVER both at once — the most recent outcome fully replaces the previous text | ✓ VERIFIED | Code inspection (js/ui/settings-modal.js:451-458) shows three mutually-exclusive branches: error sets className to 'importStatus error' and textContent to 'Error: ...'; success sets className to 'importStatus' and lastSavedAt text; empty case clears both. E2E test (settings-autosave.spec.js) confirms "Last saved: HH:MM" appears after write. |
| 20 | handle.name (the folder's own name only, never a reconstructed path) is the only folder-identifying text rendered, set via textContent (T-07 XSS guard, D-08) | ✓ VERIFIED | Code inspection (js/ui/settings-modal.js:447) shows `folderNameEl.textContent = state.folderName \|\| ''`; grep confirms zero `.innerHTML` assignments in the new Backup section code; security-smoke.test.js (D-07 storage-seam gate) passes, confirming no new XSS vectors |
| 21 | The first-launch banner renders at the top of the Today screen (before quickLog, per D-10) only when both autosave.isSupported is true AND localStorage's 'autosaveBannerDismissed' flag is not set | ✓ VERIFIED | E2E test (autosave-banner.spec.js:22-24) confirms banner visible on first load when supported; code inspection (js/ui/today-screen.js:894) shows gate checks both conditions; grep "unshift(bannerEl)" in today-screen.js confirms prepend to children array |
| 22 | Clicking 'Set up autosave' calls the injected autosave.pick(), then sets the dismissal flag and hides the banner; clicking 'Dismiss' sets the dismissal flag and hides the banner WITHOUT calling pick() | ✓ VERIFIED | Code inspection (js/ui/today-screen.js:916-920) shows setup handler calls await autosave.pick() then sets flag and hides; dismiss handler (js/ui/today-screen.js:921-924) sets flag and hides without calling pick(); E2E test (autosave-banner.spec.js:26-35) verifies Dismiss hides and persists |
| 23 | After dismissal (either button), reloading the page does not re-show the banner — the localStorage flag persists across reloads | ✓ VERIFIED | E2E test (autosave-banner.spec.js:26-35) confirms banner stays hidden after page.reload(); localStorage flag survives reload |
| 24 | Every localStorage.getItem/setItem call this task adds is tagged // gsd:allow-storage-local (on the same or immediately preceding line), or tests/integration/security-smoke.test.js's repo-wide storage-seam gate fails the build | ✓ VERIFIED | Grep confirms all three new localStorage calls in today-screen.js (getItem at line 894, setItem at lines 918 and 923) carry the tag on the same line; security-smoke.test.js (D-07 gate) passes |
| 25 | The first-launch autosave banner renders only when autosave is supported AND not yet dismissed, and does not re-appear for users who set up autosave through Settings first without ever seeing the banner | ⚠️ FAILED (Functional Gap) | No mechanism exists to detect that autosave is already configured. The Today screen receives only { isSupported, pick } from app.js and has no getState to check status. A user who sets up autosave in Settings (Backup fieldset) without ever clicking the banner will never set the autosaveBannerDismissed flag. On every reload, the banner reappears claiming autosave is not set up when it already is. |

**Score:** 23/25 observable truths verified (7/9 critical must-haves for goal achievement verified; 2 gaps block the goal)

### Deferred Items

No items are deferred to later phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| js/lib/autosave.js | 9 exported symbols (pickSaveDirectory, restoreHandle, saveToDisk, removeSaveDirectory, deriveAutosaveFilename, createDebouncedAutosave, isFileSystemAccessSupported, AUTOSAVE_DEBOUNCE_MS, createIndexedDbHandleStore) | ✓ Present | File exists, all symbols exported and correct signatures |
| tests/unit/autosave.test.js | Hand-rolled fakes exercising pick/restore/save/remove/debounce/support round trip | ✓ Present | File exists with 23 tests, all passing (unit suite 903/903) |
| index.html | Backup fieldset with three state rows, revoked note, folder name, status line | ✓ Present | #backupFieldset exists with all required ids (autosaveUnsupportedRow, autosaveUnsetRow, autosaveSetRow, autosaveRevokedNote, autosaveFolderName, autosaveStatus, autosavePickBtn, autosaveChangeBtn, autosaveRemoveBtn, autosaveExportBtn) |
| js/ui/settings-modal.js | renderBackupSection, wireBackupButtons functions | ✓ Present | Functions exist and are called from openSettings; however, remove handler has a critical bug (not awaiting async removal) |
| js/ui/today-screen.js | Banner rendering and dismissal logic | ✓ Present | Banner renders when supported and not dismissed; however, missing detection for when autosave is already configured via Settings |
| style.css | .autosave-banner CSS rules | ✓ Present | Rules added with flex-row, padding, border, 44px tap targets |
| sw.js PRECACHE_LIST | './js/lib/autosave.js' entry | ✓ Present | Entry exists alphabetically ordered between accuracy.js and chart-data.js |
| tests/unit/sw-precache.test.js | Assertion for autosave.js in PRECACHE_LIST | ✓ Present | Assertion exists and passes |
| tests/e2e/settings-autosave.spec.js | E2E coverage for unsupported fallback and pick-and-save flow | ✓ Present | 3 tests exist and pass; however, Remove button is never tested |
| tests/e2e/autosave-banner.spec.js | E2E coverage for banner visibility, dismissal, and persistence | ✓ Present | 3 tests exist and pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| autosave.js's pickSaveDirectory/restoreHandle/removeSaveDirectory | The injectable handle-store contract ({get, set, remove}, defaulting to createIndexedDbHandleStore()) | Plan 24-02's app.js wiring calls with NO store override | ✓ WIRED | Default IndexedDB-backed store is wired correctly at composition root |
| saveToDisk (handle, jsonString, filename) signature | Plan 24-02's performAutosave() | autosave.js exports; app.js calls with result of restoreHandle()/pickSaveDirectory(), JSON.stringify(storage.load()), and deriveAutosaveFilename(clock) | ✓ WIRED | E2E test confirms real OPFS write with correct filename convention |
| settings-modal.js's openSettings({..., autosave}) parameter | js/app.js's autosaveActions object | Plan 24-02 wiring injects autosaveActions as a parameter | ✓ WIRED | Grep confirms autosave: autosaveActions wired at call site (js/app.js:203) |
| today-screen.js's mountTodayScreen({..., autosave}) parameter | js/app.js's autosave slice | Plan 24-02 wiring injects { isSupported, pick } as a parameter | ✓ WIRED | Grep confirms autosave parameter at call site (js/app.js:218) |
| Backup fieldset's three state rows | renderBackupSection(state) | settings-modal.js calls function after every button action | ✓ WIRED | Code inspection and E2E verify row flips on pick; however, Remove does not re-render correctly |
| Banner rendering and dismissal | localStorage.setItem('autosaveBannerDismissed') | both banner buttons set the flag after action | ✓ WIRED | Code inspection shows both setItem calls (js/ui/today-screen.js:918, 923) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|----------------|--------|-------------------|--------|
| performAutosave (js/app.js:82-104) | json | JSON.stringify(storage.load(), null, 2) | ✓ Real data from storage.load() | ✓ FLOWING |
| performAutosave (js/app.js:82-104) | filename | deriveAutosaveFilename(clock) | ✓ Real filename from clock.now() | ✓ FLOWING |
| saveToDisk (js/lib/autosave.js:164-179) | file contents | write(jsonString) parameter | ✓ Real data passed from caller | ✓ FLOWING |
| renderBackupSection (js/ui/settings-modal.js:432-458) | autosaveFolderName textContent | state.folderName from autosave.getState() | ✓ Real value from app.js autosaveState | ✓ FLOWING |
| renderBackupSection status line (js/ui/settings-modal.js:451-458) | lastSavedAt or error | state.lastSavedAt or state.error from autosave.getState() | ✓ Real values from performAutosave result | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| E2E: autosave banner visible on first load (supported) | npx playwright test tests/e2e/autosave-banner.spec.js:22 | ✓ pass | ✓ PASS |
| E2E: banner dismissal persists across reload | npx playwright test tests/e2e/autosave-banner.spec.js:26 | ✓ pass | ✓ PASS |
| E2E: banner hidden when unsupported | npx playwright test tests/e2e/autosave-banner.spec.js:37 | ✓ pass | ✓ PASS |
| E2E: Backup fieldset unsupported row visible | npx playwright test tests/e2e/settings-autosave.spec.js:42 | ✓ pass | ✓ PASS |
| E2E: Fallback Export button works | npx playwright test tests/e2e/settings-autosave.spec.js:51 | ✓ pass | ✓ PASS |
| E2E: Choose folder flips row to set state, real OPFS write executes | npx playwright test tests/e2e/settings-autosave.spec.js:77 | ✓ pass | ✓ PASS |
| Unit: autosave.js exports all 9 symbols | tests/unit/autosave.test.js | ✓ 23 tests pass | ✓ PASS |
| Unit: full node --test suite | npm run test:unit | ✓ 903/903 pass | ✓ PASS |

### Probe Execution

No probes declared in PLAN frontmatter. Standard npm test suite serves as verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAT-01 | 24-01 | pickSaveDirectory() calls showDirectoryPicker() and persists FileSystemDirectoryHandle to IndexedDB | ✓ SATISFIED | Unit tests verify pick/persist round trip; E2E test confirms real OPFS write; IndexedDB wrapper implemented in createIndexedDbHandleStore |
| PLAT-02 | 24-01, 24-02 | saveToDisk writes canonical JSON export, debounced (500ms) trigger fires after every event add/edit/delete | ✓ SATISFIED | performAutosave wired to eventLog.subscribe; debounce constant AUTOSAVE_DEBOUNCE_MS = 500; E2E confirms write after quick-log event |
| PLAT-03 | 24-01, 24-02 | restoreHandle() retrieves persisted handle from IndexedDB on app launch; prompts to re-confirm if needed | ✓ SATISFIED | restoreHandle() implements full permission state machine; called exactly once at app boot (js/app.js:108-114) |
| PLAT-04 | 24-01, 24-03, 24-04 | Graceful fallback when File System Access API is unavailable (Firefox, Safari, file:// context) | ✓ SATISFIED | isFileSystemAccessSupported() feature-detects showDirectoryPicker; Backup fieldset shows unsupported row when false; banner hidden when unsupported; fallback Export button uses shared handler |

All four required PLAT-* requirements are marked satisfied, but **goal achievement is blocked by WR-01** (Remove handler bug violates Plan 24-03's acceptance criterion).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| js/ui/settings-modal.js | 477-480 | Remove handler missing await on async autosave.remove() call | BLOCKER | Backup fieldset shows stale "set" state immediately after Remove click; violates Plan 24-03 must_have |
| js/ui/today-screen.js | 894 | Banner visibility gate does not check if autosave is already configured | WARNING | Misleading banner persists for users who set up autosave in Settings first, claiming feature is not yet set up when it is |
| js/lib/autosave.js | 57-99 | createIndexedDbHandleStore never closes IndexedDB connections and has no onblocked handler | WARNING (per code review WR-03) | Low current risk due to static DB_VERSION, but footgun for future maintainers; future version bump could cause hanging in other tabs |
| js/app.js | 108-114 | Boot-time restoreHandle() failure is silently swallowed with no diagnostic trail | WARNING (per code review WR-04) | Environment problems (corrupted IndexedDB, browser bug) leave autosave permanently stuck at "Choose folder" with no diagnostic output |

### Human Verification Required

None — all findings are structural code issues, not subjective UX/behavior questions.

### Gaps Summary

**BLOCKER: WR-01 — Settings Remove Handler Missing Await**

Plan 24-03 must_have: *"Clicking 'Remove' calls autosave.remove() and re-renders the Backup section back to the unset state."*

**Actual behavior:** The Settings modal's `_autosaveRemoveHandler` (js/ui/settings-modal.js:477-480) does NOT await the async `autosave.remove()` call before re-rendering:

```js
_autosaveRemoveHandler = () => {
  autosave.remove();
  renderBackupSection(autosave.getState());
};
```

Since `autosaveActions.remove` (js/app.js:184-189) is async and awaits `removeSaveDirectory()`, the state mutations (handle = null, status = 'unset', folderName = null) have not yet completed when `getState()` is called synchronously on the next line. The Backup fieldset therefore stays in the "set" row (folder name + Change/Remove buttons visible) immediately after the user clicks Remove, and only reflects the removal after some later, unrelated re-render (e.g. closing and reopening Settings, or switching tabs).

**Fix:** Change the handler to async and await the removal:
```js
_autosaveRemoveHandler = async () => {
  await autosave.remove();
  renderBackupSection(autosave.getState());
};
```

This matches the pattern already used correctly in the sibling `pickOrChange` handler two lines above (js/ui/settings-modal.js:463-469), which does `await autosave.pick(); renderBackupSection(autosave.getState());`.

**Test coverage gap:** No E2E spec tests the Remove button (grep shows zero clicks on #autosaveRemoveBtn in tests/e2e/*.spec.js), so this bug shipped unnoticed despite the 144 E2E tests passing.

---

**WARNING: WR-02 — Banner Cannot Detect Existing Autosave Configuration**

Plan 24-04 must_have: *"The first-launch banner renders at the top of the Today screen (before quickLog, per D-10) only when both autosave.isSupported is true AND localStorage's 'autosaveBannerDismissed' flag is not set."*

This must_have is technically satisfied by the code. However, there is a **functional gap** that contradicts the feature's intent:

**Actual behavior:** The Today screen's banner gate is purely localStorage-flag-based:
```js
if (autosave && autosave.isSupported && !localStorage.getItem('autosaveBannerDismissed')) {
```

The Today screen receives only `{ isSupported, pick }` from app.js (line 218) — no access to `getState()` to check whether autosave is already granted.

**Gap:** A user who discovers the Backup fieldset in Settings and successfully sets up autosave there (without ever clicking the banner's "Set up autosave" or "Dismiss" buttons) never sets the `autosaveBannerDismissed` flag. On every subsequent page load, the banner reappears with the text "Back up your sleep data automatically — set up autosave to a folder on your device" even though autosave is already active and successfully writing files to the chosen folder. This is a misleading permanent nudge for anyone who discovers the feature via Settings first.

**Fix (option A):** Pass the configuration status to the Today screen:
```js
autosave: { 
  isSupported: autosaveState.supported, 
  isConfigured: autosaveState.status === 'granted',
  pick: autosaveActions.pick 
}
```
Then skip rendering the banner when `isConfigured` is true.

**Fix (option B):** Have the Settings modal's pick/remove handlers also set the `autosaveBannerDismissed` flag so both entry points share dismissal state:
```js
// In settings-modal.js renderBackupSection or wireBackupButtons
// After a successful pick, also dismiss the banner:
// localStorage.setItem('autosaveBannerDismissed', '1');
// After remove, you might also dismiss it, or leave the banner enabled for re-setup
```

---

**Other Warnings from Code Review (24-REVIEW.md):**

- **WR-03:** `createIndexedDbHandleStore`'s IndexedDB connections are never closed and `onblocked` is unhandled — low current risk but a footgun for future maintainers when DB_VERSION is bumped
- **WR-04:** Boot-time `restoreHandle()` failure is silently swallowed with no diagnostic trail — environment problems leave autosave stuck with no diagnostic output

These are important but less immediately user-facing than WR-01 and WR-02.

---

## Summary

**Phase Goal Status:** NOT ACHIEVED — two gaps block goal achievement:
1. **WR-01 (BLOCKER):** Remove handler bug violates a must_have acceptance criterion from Plan 24-03
2. **WR-02 (WARNING):** Functional gap in banner behavior contradicts feature intent and provides poor UX for Settings-first discoverers

**Code Review Findings:** 0 critical, 4 warnings, 2 info items. All are present in the actual codebase.

**Test Coverage:** 903/903 unit+integration passing, 144/144 E2E passing. However, critical paths are untested:
- No E2E covers the Remove button (WR-01 shipped undetected)
- No test verifies the banner doesn't re-appear for users who set up autosave in Settings (WR-02 hidden by test gap)

**Recommendation:** This phase should not proceed to the next phase until WR-01 is fixed (the async/await issue). WR-02 should also be fixed to restore the feature's usability intent. Both fixes are straightforward (<5 lines of code each).

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
_Depth: Goal-backward, against code review findings and PLAN must_haves_
