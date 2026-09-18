---
phase: 24-autosave
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - index.html
  - js/app.js
  - js/lib/autosave.js
  - js/ui/settings-modal.js
  - js/ui/today-screen.js
  - style.css
  - sw.js
  - tests/e2e/autosave-banner.spec.js
  - tests/e2e/settings-autosave.spec.js
  - tests/unit/autosave.test.js
  - tests/unit/sw-precache.test.js
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-09-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This is a fresh, independent re-review of the full Phase 24 autosave file set, done after Plan
24-05's gap-closure work landed. It is not a rubber-stamp of the prior `24-REVIEW.md` — every
finding below was re-derived from reading the current code.

**Prior findings verified as genuinely fixed (not superficially):**

- **WR-01 (stale UI after Remove)** — `js/ui/settings-modal.js`'s `_autosaveRemoveHandler`
  (lines 481–486) is now `async` and does `await autosave.remove();` before calling
  `renderBackupSection(autosave.getState())`. Traced through: `autosave.remove` is
  `autosaveActions.remove` in `js/app.js` (lines 184–189), which synchronously mutates
  `autosaveState.handle/status/folderName` to their "unset" values *before* its promise
  resolves. Because the handler now awaits it, `getState()` is read only after that mutation
  has happened — the re-render reflects the correct post-remove state. Confirmed fixed, and
  the fix generalizes correctly (not just to the one E2E scenario it targeted).

- **WR-02 (banner never detected autosave configured via Settings)** — `pickOrChange` in
  `js/ui/settings-modal.js` (lines 458–465) now sets `localStorage.setItem('autosaveBannerDismissed', '1')`
  gated on `state.status === 'granted'`, read from a fresh `autosave.getState()` snapshot taken
  *after* `await autosave.pick()`. Confirmed fixed for the Settings-modal pick/change path.
  **However**, see WR-01 below (new finding) — the *same* class of bug is still present in a
  sibling code path (the Today-screen banner's own "Set up autosave" button) that 24-05 did not
  touch, because it wires directly to `autosaveActions.pick` without the status check
  `pickOrChange` added. This is a real, currently-shipping gap in the same feature area WR-02
  was meant to close.

**Confirmed still present (deliberately out of scope for 24-05, not silently dropped):**

- **WR-03 (IndexedDB connections never closed)** — still true; see IN-01 below.
- **WR-04 (boot-time `restoreHandle()` failures silently swallowed)** — still true; see WR-04
  below (kept at Warning severity in this pass, since "missing error handling" is an explicit
  Warning-tier example in this review's rubric).

Beyond confirming/re-deriving the above, this pass found two additional defects not present in
the prior review: an inconsistency in how `pick()`/`remove()` update `autosaveState.error` /
`autosaveState.lastSavedAt` (stale status-line text), and a missing `try/catch` around
`autosaveActions.remove`'s call to `removeSaveDirectory()`. No security vulnerabilities,
hardcoded secrets, or `innerHTML`/`eval` usage were found — the XSS guard (`textContent`-only
DOM writes) is upheld consistently across `autosave.js`, `settings-modal.js`, and the
autosave-banner code in `today-screen.js`.

## Warnings

### WR-01: "Set up autosave" banner button dismisses itself permanently even when the picker is cancelled or fails

**File:** `js/ui/today-screen.js:916-920`
**Issue:** The banner's setup handler is:
```js
setupBtn.addEventListener('click', async () => {
  await autosave.pick();
  localStorage.setItem('autosaveBannerDismissed', '1'); // gsd:allow-storage-local
  bannerEl.hidden = true;
});
```
`autosave.pick` here is `autosaveActions.pick` from `js/app.js` (lines 170–183), which
internally catches every rejection — including the user cancelling the native directory
picker (`AbortError`) — and never rethrows. So `await autosave.pick()` **always resolves**,
regardless of whether a folder was actually chosen. The handler then unconditionally persists
`autosaveBannerDismissed` and hides the banner, even when `autosaveState.status` never became
`'granted'`.

Contrast with the already-fixed `pickOrChange` in `js/ui/settings-modal.js:458-465`, which
correctly re-reads `autosave.getState()` after the `await` and only sets the dismissal flag
`if (state.status === 'granted')`. The Today-screen banner path was not updated to match, so a
user who clicks "Set up autosave" and then cancels the OS folder dialog (an extremely ordinary
user action) permanently loses the discovery banner (D-10/D-11's stated contract), with no
error surfaced anywhere in that flow. They must know to dig into Settings manually to finish
setup — the exact discoverability gap this banner exists to solve.
**Fix:**
```js
setupBtn.addEventListener('click', async () => {
  await autosave.pick();
  // today-screen.js only receives {isSupported, pick} — not getState() — per the
  // composition-root scoping in app.js. Either widen that contract to include a
  // status check, or (simplest) have autosave.pick() itself return the resulting
  // status so callers don't need getState():
  const status = await autosave.pick();
  if (status === 'granted') {
    localStorage.setItem('autosaveBannerDismissed', '1');
    bannerEl.hidden = true;
  }
});
```

### WR-02: `autosaveActions.remove` has no error handling — unlike `pick`, a failure is neither surfaced nor caught

**File:** `js/app.js:184-189`
**Issue:**
```js
remove: async () => {
  await removeSaveDirectory();
  autosaveState.handle = null;
  autosaveState.status = 'unset';
  autosaveState.folderName = null;
},
```
`pick()` (lines 170-183) wraps its work in `try/catch` and records failures into
`autosaveState.error` so the Settings UI can show them. `remove()` has no such guard. If
`removeSaveDirectory()` (which itself calls the injected IndexedDB store's `remove()`) rejects
— e.g. a transient IndexedDB error — the rejection propagates out of `autosaveActions.remove`,
into `js/ui/settings-modal.js`'s `_autosaveRemoveHandler` (lines 481-486):
```js
_autosaveRemoveHandler = async () => {
  await autosave.remove();
  renderBackupSection(autosave.getState());
};
```
which also has no `catch`. The result: an unhandled promise rejection in a DOM event listener
(visible only in the browser console), the UI never re-renders (`renderBackupSection` is never
reached), and the Backup fieldset is left showing the stale "set" state with the Remove button
that just silently failed — no error message anywhere.
**Fix:**
```js
remove: async () => {
  try {
    await removeSaveDirectory();
    autosaveState.handle = null;
    autosaveState.status = 'unset';
    autosaveState.folderName = null;
    autosaveState.error = null;
  } catch (e) {
    autosaveState.error = (e && e.message) || 'Could not remove the folder';
  }
},
```

### WR-03: `autosaveState.error` / `lastSavedAt` are not cleared on folder change or removal — stale status-line text

**File:** `js/app.js:170-189`, rendered in `js/ui/settings-modal.js:415-442`
**Issue:** `pick()` resets `autosaveState.error = null` on success but never touches
`autosaveState.lastSavedAt`. `remove()` (as currently written) resets `handle`/`status`/
`folderName` but touches neither `error` nor `lastSavedAt`. `renderBackupSection`'s status line
(D-09: "exactly one of error/last-saved/empty renders") is driven purely by
`state.error`/`state.lastSavedAt`, independent of which row is currently shown. Concretely:
1. A prior autosave write fails (`autosaveState.error` set). The user then clicks "Remove".
   The row correctly flips to "unset", but the status line still reads
   `Error: <old message>` — describing a folder that no longer exists.
2. A user "Change[s] folder" to a new directory before any write has happened against it. The
   status line still shows `Last saved: HH:MM` from the *previous* folder, implying the new
   folder already has a backup when it does not.
**Fix:** Reset both fields on every state transition that invalidates them:
```js
pick: async () => {
  try {
    const handle = await pickSaveDirectory();
    autosaveState.handle = handle;
    autosaveState.status = 'granted';
    autosaveState.folderName = handle.name;
    autosaveState.error = null;
    autosaveState.lastSavedAt = null; // new folder has no backup yet
  } catch (e) { /* ... */ }
},
remove: async () => {
  await removeSaveDirectory();
  autosaveState.handle = null;
  autosaveState.status = 'unset';
  autosaveState.folderName = null;
  autosaveState.error = null;
  autosaveState.lastSavedAt = null;
},
```

### WR-04 (carryover — confirmed still present): boot-time `restoreHandle()` failure is silently swallowed with zero diagnostic

**File:** `js/app.js:108-114`
**Issue:**
```js
if (autosaveState.supported) {
  restoreHandle().then(({ handle, status }) => {
    autosaveState.handle = handle;
    autosaveState.status = handle ? status : 'unset';
    autosaveState.folderName = handle ? handle.name : null;
  }).catch(() => {});
}
```
This matches the prior review's WR-04 exactly and is unchanged by Plan 24-05 (which was scoped
only to the two Remove/banner bugs). Any rejection from `restoreHandle()` — e.g. IndexedDB
unavailable (some private-browsing modes), a corrupted handle record, or a
`queryPermission`/`requestPermission` throw — is discarded with no `console.warn`/`error` and
no `autosaveState.error` set. The user is left in the default `'unset'` state indistinguishable
from "never configured autosave," even though a folder was previously configured and the
restore genuinely failed.
**Fix:**
```js
  }).catch((e) => {
    console.warn('[Nightwatch] Failed to restore autosave folder handle:', e);
    autosaveState.error = (e && e.message) || 'Could not restore the saved backup folder';
  });
```

## Info

### IN-01 (carryover — confirmed still present, out of scope for 24-05): IndexedDB connections in `createIndexedDbHandleStore` are never closed

**File:** `js/lib/autosave.js:56-100`
**Issue:** Matches the prior review's WR-03. `openDb()` (lines 57-69) resolves with a live
`IDBDatabase` from `idbFactory.open(...)`, and every one of `get()`/`set()`/`remove()` calls
`openDb()` fresh and never calls `db.close()` on the result, in any branch (success or error).
There is also no `onblocked`/`onversionchange` handler. In this app's current usage pattern —
one `get()` at boot, one `set()`/`remove()` per user action in Settings — the practical impact
is small (no per-event-log-mutation IndexedDB traffic; only `saveToDisk` runs on that path, and
it doesn't touch IndexedDB at all). Kept at Info rather than Warning because unclosed-connection
accumulation is a resource-leak class of issue, which this review's scope (`<critical_rules>`)
explicitly excludes unless it's also a correctness bug — it isn't yet, since `DB_VERSION` never
changes within this phase. It would become a correctness issue (a hung `open()` via the missing
`onblocked` handler) the day `DB_VERSION` is bumped for a future schema change, so it's worth
tracking rather than closing out.
**Fix:** Close the connection after each operation completes (or once at the transaction's
`oncomplete`), and add an `onblocked` handler that at minimum logs:
```js
req.onblocked = () => console.warn('[Nightwatch] IndexedDB open blocked by another connection');
// ...and after each get/set/remove's promise settles:
db.close();
```

### IN-02: First-launch banner's visibility check only consults the dismissal flag, never live autosave status

**File:** `js/ui/today-screen.js:894`
**Issue:**
```js
if (autosave && autosave.isSupported && !localStorage.getItem('autosaveBannerDismissed')) {
```
This is a deliberate composition-root scoping choice — `js/app.js` (lines 213-219) intentionally
gives `today-screen.js` only `{isSupported, pick}`, not `getState()`, so the module has no way
to consult the *live* autosave status even if it wanted to. In the current app this is safe
because every code path that reaches `status === 'granted'` also sets the dismissal flag in the
same operation (both `pickOrChange` in Settings and, once WR-01 above is fixed, the banner's own
setup button). The only way to reach a state where autosave is genuinely configured
(`status === 'granted'`, a handle persisted in IndexedDB) but the dismissal flag is absent is an
out-of-band edit — e.g. a user or extension clearing just the `autosaveBannerDismissed`
`localStorage` key while leaving the IndexedDB-backed handle intact. Low likelihood, but worth
flagging since the fix for WR-01 above will not by itself close this gap — it only ensures the
flag gets set through the banner's own action, not that the banner ever re-checks reality if the
flag alone is missing.
**Fix:** Not urgent; if addressed, thread a lightweight boolean (e.g. `autosave.isConfigured()`
returning `autosaveState.status === 'granted'`) into the minimal Today-screen contract instead of
the full `getState()`, preserving the existing scoping discipline.

---

_Reviewed: 2026-09-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
