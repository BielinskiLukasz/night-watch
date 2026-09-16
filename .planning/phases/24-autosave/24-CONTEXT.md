# Phase 24: Autosave - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `js/lib/autosave.js` exporting `pickSaveDirectory()` (calls `window.showDirectoryPicker()`, persists the `FileSystemDirectoryHandle` to IndexedDB via a minimal inline wrapper — no npm package), `saveToDisk(handle, jsonString)` (debounced 500ms, fires after every event-store mutation only — not settings-store mutations), and `restoreHandle()` (retrieves the handle on launch; prompts re-permission when `queryPermission()` returns `'prompt'`). Wire into `app.js` via `eventLog.subscribe`. Add a new "Backup" fieldset to the Settings modal with the autosave folder row (states: unset / set / unsupported / permission-needed), save-status feedback, and a fallback manual Export button for browsers without the File System Access API (Firefox, Safari, `file://`). Add a one-time first-launch banner nudging the user to set up autosave. Add `autosave.js` to `PRECACHE_LIST` in `sw.js` and `tests/unit/sw-precache.test.js`. Unit tests cover debounce, handle persistence round-trip, and fallback detection; E2E test covers the Settings UI row in supported and fallback states.

**Requirements this phase satisfies:** PLAT-01, PLAT-02, PLAT-03, PLAT-04

**Out of scope:** Automatic deletion/retention management of old autosave files (explicitly decided against — see D-04). Any new capability beyond autosave itself (e.g. cloud sync, multi-file version browsing) belongs in a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Filename & Overwrite Strategy

- **D-01:** Autosave reuses the existing manual-export filename convention exactly: `nightwatch-YYYY-MM-DD.json` (the same `formatLocalISO(clock.now()).slice(0, 10)` date-slice logic already implemented in `js/lib/import-export.js`'s `downloadJSON` per decision D5-15). Autosave does NOT introduce a separate fixed filename like `nightwatch-autosave.json`. Multiple autosaves on the same calendar day overwrite the same file via `getFileHandle(name, { create: true })`; a new day starts a new file. This gives a bounded daily-history side effect for free, with zero new naming logic. — **Reversibility:** reversible

- **D-02:** `saveToDisk(handle, jsonString)` should accept or derive the filename using the same date-slice helper as `downloadJSON` — the planner should decide whether `autosave.js` imports `formatLocalISO` from `js/lib/time.js` directly, or whether the filename is computed by the caller (`app.js`) and passed in. Either is acceptable as long as the two code paths (manual export, autosave) produce an identical filename for a same-day save. — **Reversibility:** reversible

- **D-03:** The fallback manual Export button added to the new Backup fieldset (PLAT-04) is a separate button wired to the same `downloadJSON(storage, clock)` handler already injected in `app.js` for the History screen's existing "Export JSON" button — not a text pointer redirecting the user to the History screen. — **Reversibility:** reversible

- **D-04:** No automatic cleanup/retention of old daily autosave files. The app never deletes files it previously wrote. This is an explicit decision, not an oversight — the file-as-truth philosophy treats more history as safer, and adding a deletion code path (which must distinguish autosave-written files from user files in the same folder) is unnecessary complexity for this phase. — **Reversibility:** reversible

### Failure & Permission Handling

- **D-05:** When `saveToDisk()` throws (folder deleted/moved, transient write failure, e.g. mid-sync with OneDrive/Dropbox), keep the persisted handle and keep retrying on the next mutation — do NOT clear the handle automatically. Surface a brief inline error in the Settings Backup row instead (see D-09 for exact status-line behavior). Rationale: most real-world failures here are transient (cloud-sync folder temporarily unavailable) and clearing the handle would force an unnecessary re-pick for a self-healing condition. — **Reversibility:** reversible

- **D-06:** When `restoreHandle()`'s `queryPermission()` call (or a runtime permission check before a write) returns `'denied'` (explicitly revoked, distinct from `'prompt'` which is already locked by PLAT-03 to show a re-permission prompt): treat the UI exactly like the "unset" state (show "Choose folder" / the unsupported-style row), plus a short note that access was revoked. Do not attempt automatic silent retries against a permission that will keep failing. The user re-picks (can choose the same folder again, which re-triggers the OS permission grant). — **Reversibility:** reversible

### Settings UI

- **D-07:** The autosave row lives in a new "Backup" fieldset in the Settings modal, added alongside the existing three fieldsets (Profile / Time & Day / Forecast tuning, per `settings-modal.js` D2-13) rather than being folded into the Profile fieldset. Rationale: autosave/backup is a distinct concern from subject profile info, and this creates a natural home for related concerns (e.g. import/export) if they move here later. — **Reversibility:** reversible

- **D-08:** When a folder is set, display only `handle.name` (the folder's own name, e.g. "NightwatchBackups") — the File System Access API never exposes a full path (by design, for privacy), so no attempt is made to reconstruct or fake one. No extra hint text about path opacity; the folder name plus Change/Remove buttons is sufficient. — **Reversibility:** reversible

- **D-09:** After a successful autosave write, the Backup row shows a subtle status line: `Last saved: HH:MM`, updated after each successful write. This status is in-memory only for the current session — it does NOT persist across reloads; on launch it shows nothing ("not saved yet this session") until the first autosave fires. If a later write fails, the error text (D-05) REPLACES the "Last saved" text entirely (single status line, always reflecting the most recent outcome) rather than appending to it. — **Reversibility:** reversible

### First-Launch Discovery Banner

- **D-10:** A one-time dismissible banner appears at the top of the Today screen on first launch (in browsers where the File System Access API is available) nudging the user to set up autosave, since it closes the app's largest data-loss risk. This is a new UI surface beyond the Settings row that ROADMAP/REQUIREMENTS describe for this phase — flagged during discussion as a scope extension; the user explicitly confirmed they want it included in this phase rather than deferred, given how tightly it's coupled to autosave's actual adoption. — **Reversibility:** reversible

- **D-11:** "Already seen" is tracked via a boolean flag in `localStorage` (e.g. `autosaveBannerDismissed`), set when the user dismisses the banner OR clicks "Choose folder" from it. Checked on launch to decide whether to render the banner. No IndexedDB or schema involvement — same lightweight pattern as other one-time UI state already in the app. Not a blocking modal; user can ignore/dismiss and keep using the app immediately. — **Reversibility:** reversible

### Claude's Discretion

- Exact wording/copy for: the unsupported-browser explanatory note, the permission-revoked note (D-06), the first-launch banner text (D-10), and button labels ("Choose folder" / "Change folder" / "Remove").
- Whether `autosave.js` computes the shared date-slice filename itself or receives it from the caller (D-02) — either satisfies the "identical filename for same-day saves" constraint.
- Internal structure of the minimal inline IndexedDB wrapper (single object store vs. simple key-value pattern) — as long as it introduces no npm dependency, per PLAT-01.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 24: Autosave" (v2.0 section) — phase summary with file targets and locked behaviors (debounce timing, event-store-only trigger, `queryPermission` re-prompt on `'prompt'`)
- `.planning/REQUIREMENTS.md` §PLAT-01, PLAT-02, PLAT-03, PLAT-04 — functional requirements for this phase
- `.planning/PROJECT.md` §"Current Milestone: v2.0" — "Autosave export to user-chosen directory via File System Access API (B-051)" target-feature framing
- `.planning/BACKLOG.md` §"B-051 · Autosave export to user-chosen folder" — original design notes, open questions (several resolved by this discussion — see D-01 through D-11), and implementation notes (module shape, guard pattern, wiring targets)

### Existing Export/Download Pattern (being reused, not duplicated)
- `js/lib/import-export.js` — `downloadJSON(storage, clock)`; the `nightwatch-YYYY-MM-DD.json` filename convention (decision D5-15) that autosave's `saveToDisk` must match per D-01/D-02
- `js/ui/history-screen.js:83-90` — existing "Export JSON" button (`exportBtn`, `#exportJsonBtn`) calling `downloadJSON` via the `onExport` callback injected from `app.js`; the new Backup-fieldset fallback button (D-03) wires to the same handler

### Store Subscription Pattern (integration point)
- `js/store/event-log.js:76-104, 234-247` — `subscribers` Set, `notifySubscribers()`, and the `subscribe(fn)` → unsubscribe-function contract; autosave's `app.js` wiring subscribes here (event-store mutations only, per D-05/ROADMAP — settings-store changes do NOT trigger autosave)
- `js/app.js:45, 90-114` — composition root: where `eventLog`/`settings`/`storage`/`clock` are created and where `onExport: () => downloadJSON(storage, clock)` is already wired; the new `saveToDisk` subscription and `onExport`-style wiring for the Backup fieldset both attach here

### Settings Modal UI Pattern (Backup fieldset placement)
- `js/ui/settings-modal.js` (D2-13) — existing three-fieldset structure (Profile / Time & Day / Forecast tuning); the new Backup fieldset (D-07) is a fourth, following the same fieldset convention
- `js/ui/settings-modal.js:100-140` — existing `el.hidden = !isTif` / `tifOptionsEl.hidden = (...)` show/hide pattern, precedent for any conditional row visibility within the Backup fieldset (e.g. supported vs. unsupported browser state)

### Service Worker
- `sw.js` — `PRECACHE_LIST` (currently ends around the UI-modules block); `js/lib/autosave.js` must be added here
- `tests/unit/sw-precache.test.js` — exhaustive-list assertion; must include the new `autosave.js` entry

### Prior Phase Context (adjacent, not overlapping)
- `.planning/phases/25-algorithm-c-settings-modal/25-CONTEXT.md` — a different Settings-modal change (three-option algorithm selector) planned for a later phase; no direct dependency, but confirms `settings-modal.js` is an actively evolving file this milestone — coordinate carefully if both phases touch it before either ships

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `downloadJSON(storage, clock)` (`js/lib/import-export.js:24`) — canonical JSON serialization (2-space indent) + the exact filename convention autosave must match; do not reimplement JSON serialization separately in `autosave.js`
- `formatLocalISO` (`js/lib/time.js`) — used by `downloadJSON` for the date-slice filename component; reuse for autosave's filename (D-02)
- `eventLog.subscribe(fn)` (`js/store/event-log.js:245-247`) — returns unsubscribe function; mirrors `settings.subscribe()` pattern (D2-09/D3-12) but autosave attaches ONLY to `eventLog`, not `settings`

### Established Patterns
- **No npm dependencies ever** — the inline IndexedDB wrapper (PLAT-01) must be hand-rolled; no `idbKeyval` or similar, per CLAUDE.md's zero-runtime-dependency constraint
- **Object.freeze config objects** — any new constants module in `autosave.js` (e.g. a debounce-interval constant) should follow the existing convention
- **`<a download>` + `URL.createObjectURL` transient-anchor pattern** — NOT reused by `saveToDisk`; File System Access API writes via `dirHandle.getFileHandle(...).createWritable().write().close()` instead, a fundamentally different write path from the existing download-trigger pattern
- **One-time localStorage UI-state flags** — precedent pattern for the first-launch banner's dismissal tracking (D-11); no existing example was found in code during scouting, so this establishes the pattern rather than reusing one — flag as new but consistent in spirit with the app's "simple localStorage flag, no schema" philosophy

### Integration Points
- `js/app.js` — composition root; add `import`s for `autosave.js` functions, subscribe `saveToDisk` (debounced) to `eventLog.subscribe`, call `restoreHandle()` on boot, wire `pickSaveDirectory`/"Remove" into the Settings modal's dependency injection (same pattern as `onExport`/`onSettings`)
- `js/ui/settings-modal.js` — add the Backup fieldset, its row states, and the fallback Export button
- `js/ui/today-screen.js` (or a new small module) — first-launch banner rendering, gated by the `autosaveBannerDismissed` localStorage flag and File System Access API feature-detection
- `sw.js` + `tests/unit/sw-precache.test.js` — add `js/lib/autosave.js` entry to both

</code_context>

<specifics>
## Specific Ideas

- The user wants autosave's filename behavior to feel like "the manual export just happens automatically" rather than introducing a parallel, differently-named backup file — this was the deciding factor in D-01 (reuse `nightwatch-YYYY-MM-DD.json` rather than a fixed `nightwatch-autosave.json`).
- The first-launch banner (D-10) was an explicit ask despite being flagged as extending beyond the ROADMAP's literal "add a Settings UI row" wording — the user's reasoning was that undiscovered Settings-only features don't close the data-loss risk this phase exists to address.

</specifics>

<deferred>
## Deferred Ideas

None — all discussed ideas were incorporated as in-phase decisions (see D-10/D-11 for the one item that required an explicit scope confirmation rather than automatic inclusion).

</deferred>

---

*Phase: 24-autosave*
*Context gathered: 2026-09-16*
