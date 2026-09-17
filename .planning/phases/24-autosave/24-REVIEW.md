---
phase: 24-autosave
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - js/lib/autosave.js
  - js/app.js
  - js/ui/settings-modal.js
  - js/ui/today-screen.js
  - index.html
  - sw.js
  - style.css
  - tests/unit/autosave.test.js
  - tests/unit/sw-precache.test.js
  - tests/e2e/settings-autosave.spec.js
  - tests/e2e/autosave-banner.spec.js
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-09-17
**Depth:** standard
**Files Reviewed:** 10 (11 listed; `js/ui/today-screen.js` and `js/ui/settings-modal.js` reviewed in full but findings scoped to the Phase 24 additions — quick-log/day-list/manual-entry/stages/CSV-import code predates this phase and was not re-audited)
**Status:** issues_found

## Summary

`js/lib/autosave.js` itself is small, well-isolated, and behaves correctly against its own unit tests (pick/restore/save/remove/debounce all check out — no bugs found in the pure lib module). The defects are all in the **composition-root wiring and UI plumbing** that sits on top of it (`js/app.js`, `js/ui/settings-modal.js`, `js/ui/today-screen.js`): an async/await inconsistency in the Settings modal's "Remove" handler that leaves the Backup fieldset showing stale state immediately after the user clicks Remove (this directly contradicts the Phase 24-03 plan's own acceptance criterion), a first-launch banner that has no way to detect autosave is already configured, and a latent IndexedDB connection-handling gap in the handle store. `sw.js`'s `PRECACHE_LIST` was cross-checked against the actual `js/lib`, `js/ui`, `js/store`, `js/adapters` directory listings and is exhaustive and correctly excludes the test-only adapters — no findings there. No security issues (XSS, injection, hardcoded secrets) were found; all dynamic text in the new Backup/banner UI goes through `.textContent`/`.value` as required.

None of the findings below are exercised by the existing test suite — `tests/e2e/settings-autosave.spec.js` only exercises the unsupported-fallback and pick-and-save flows, never `#autosaveRemoveBtn`; there is no test file for `js/app.js`'s composition-root logic at all.

## Warnings

### WR-01: Settings modal "Remove" handler re-renders before the async removal completes

**File:** `js/ui/settings-modal.js:475-482`
**Issue:** `wireBackupButtons`'s remove handler does not await the async `autosave.remove()` call before re-rendering:
```js
_autosaveRemoveHandler = () => {
  autosave.remove();
  renderBackupSection(autosave.getState());
};
```
`autosaveActions.remove` in `js/app.js:184-189` is `async () => { await removeSaveDirectory(); autosaveState.handle = null; autosaveState.status = 'unset'; autosaveState.folderName = null; }`. Because the handler doesn't `await` it, `renderBackupSection(autosave.getState())` runs synchronously on the *next* line — before `removeSaveDirectory()`'s IndexedDB transaction resolves and before `handle`/`status`/`folderName` are reset. The Backup fieldset therefore keeps showing the "set" row (folder name + Change/Remove buttons) immediately after the click, and only reflects the removal on some later, unrelated re-render (e.g. the next time Settings happens to be reopened).

This directly contradicts 24-03-PLAN.md's own acceptance criterion: *"Clicking 'Remove' calls autosave.remove() and re-renders the Backup section back to the unset state."* Compare with the correctly-implemented sibling handler two lines above (`pickOrChange`), which does `await autosave.pick(); renderBackupSection(autosave.getState());` — the same await is missing here. This path has zero test coverage (no spec clicks `#autosaveRemoveBtn`), so it shipped unnoticed.

**Fix:**
```js
_autosaveRemoveHandler = async () => {
  await autosave.remove();
  renderBackupSection(autosave.getState());
};
```

### WR-02: First-launch autosave banner can't detect that autosave is already configured

**File:** `js/ui/today-screen.js:894`, `js/app.js:213-219`
**Issue:** The banner's visibility gate is `autosave && autosave.isSupported && !localStorage.getItem('autosaveBannerDismissed')`. `mountTodayScreen` is wired with only `{ isSupported, pick }` (`js/app.js:218`) — it never receives `getState`. A user who configures autosave directly through the Settings modal's Backup fieldset (without ever clicking the banner's "Set up autosave"/"Dismiss" buttons) never sets the `autosaveBannerDismissed` flag. On every subsequent page load the banner reappears and tells them to "set up autosave to a folder on your device" even though autosave is already active and successfully writing — a misleading, permanent nudge for anyone who discovers the feature via Settings first.
**Fix:** Either pass a cheap status snapshot into the banner gate (e.g. `autosave: { isSupported, isConfigured: autosaveState.status === 'granted', pick }`) and skip rendering when already configured, or have `settings-modal.js`'s pick/remove handlers also set the `autosaveBannerDismissed` flag so the two entry points share dismissal state.

### WR-03: `createIndexedDbHandleStore`'s IndexedDB connections are never closed and `onblocked` is unhandled

**File:** `js/lib/autosave.js:57-99`
**Issue:** `openDb()` opens a new connection via `idbFactory.open(DB_NAME, DB_VERSION)` on every `get()`/`set()`/`remove()` call, but nothing ever calls `db.close()`. Connections accumulate for the page's lifetime. There is also no `req.onblocked` handler. Today this is low-risk because `DB_VERSION` is a static `1`, but it's a footgun for future maintainers: the moment `DB_VERSION` is bumped for a schema change, any tab holding one of these un-closed connections will block the new `open()` call's `onupgradeneeded`/`onsuccess` from ever firing in *other* tabs — and since there's no `onblocked` handler, the blocked call's promise never resolves or rejects, hanging forever instead of failing loudly.
**Fix:** Close the db handle after each operation (`db.close()` after the transaction completes), and add `req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open tab'));` to `openDb()` so a future version bump fails loudly instead of hanging.

### WR-04: Boot-time `restoreHandle()` failure is silently swallowed with no diagnostic trail

**File:** `js/app.js:108-114`
**Issue:**
```js
if (autosaveState.supported) {
  restoreHandle().then(({ handle, status }) => { ... }).catch(() => {});
}
```
Any rejection from `restoreHandle()` (e.g. an `IDBFactory.open` failure) is caught and completely discarded — no `console.warn`/`console.error`, nothing. This is consistent with the documented intent (autosave should degrade to `'unset'` rather than crash boot), but it means a genuine environment problem (corrupted IndexedDB, browser bug) leaves the user's autosave permanently stuck at "Choose folder" with zero way for anyone — user or developer — to learn why.
**Fix:** At minimum, log the swallowed error for diagnosability: `.catch((e) => console.warn('[nightwatch] restoreHandle failed', e));`.

## Info

### IN-01: Settings modal can render a stale Backup-fieldset snapshot if opened before boot-time `restoreHandle()` resolves

**File:** `js/app.js:108-114`, `js/ui/settings-modal.js:396-399`
**Issue:** `autosaveState.handle/status/folderName` are only updated once the boot-time `restoreHandle().then(...)` resolves. If the user opens Settings in the brief window between page load and that promise settling (IndexedDB opens are typically sub-millisecond but not guaranteed), `openSettings` renders the default `{status: 'unset', ...}` snapshot. If they leave the modal open, nothing re-renders it when `restoreHandle` resolves afterward — the fieldset stays on "Choose folder" until the modal is closed and reopened, even though a handle was actually restored. Narrow race window, low practical impact, but worth noting alongside WR-01 since both stem from the same "no reactive re-render for async autosave state changes while a modal is open" gap.

### IN-02: `autosaveActions.pick`/`remove` never reset `lastSavedAt`

**File:** `js/app.js:170-189`
**Issue:** Per 24-02-PLAN.md's own D-09 note, `lastSavedAt`/`error` are documented as "in-memory only and reset to their initial unset values on every page load" — not on pick/remove — so this matches spec rather than being a defect. Flagging only as a UX observation: after "Change folder" or "Remove", the status line can keep showing "Last saved: HH:MM" from the *previous* folder until the next event triggers a fresh write (or a page reload), which could read as though the new/removed folder already has a backup.

---

_Reviewed: 2026-09-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
