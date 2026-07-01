# Phase 2: Configuration & Settings - Research

**Researched:** 2026-05-27
**Domain:** Vanilla-JS PWA — schema migration, two-store-one-blob seam, subscriber/observer, second `<dialog>`, 12h time picker, pure validator
**Confidence:** HIGH
**Methodology note:** This RESEARCH.md was authored in-context (subagent route hit a Windows stdio timeout — anthropics/claude-code#28126). Investigation grounded in: `02-CONTEXT.md` (D2-01..D2-27, 27 locked decisions), the four Phase 1 source files Phase 2 extends (`js/store/event-log.js`, `js/adapters/storage-local.js`, `js/ui/today-screen.js`, `js/ui/manual-entry.js`), `index.html`, `01-RESEARCH.md` (~1140 lines, exhaustive — referenced rather than duplicated), and `01-PATTERNS.md`. No web research needed: CONTEXT.md already binds the architecture; the open work is wiring, not technology selection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Twenty-seven decisions are locked verbatim in `02-CONTEXT.md` (D2-01..D2-27). The ones the planner MUST honor without re-litigation, grouped by surface:

- **Scope (D2-01, D2-02):** All 8 in-phase CFG-* requirements ship in Phase 2. CFG-05 (per-day "rejected" toggle) stays in Phase 4 with the History screen. CFG-02/03/04/06/07 are stored-but-inert — persisted to `db.settings` and editable, but no Phase 2 code reads them. The modal must NOT pretend they have an immediate effect.
- **Defaults (D2-03):** `Object.freeze({ subjectName: '', cutoverHour: 4, groupingMode: 'calendar', timeFormat: '24h', autoOutlier: false, maxDelta: 30, minDays: 7, windowDays: 7, statBlend: 'median' })` lands verbatim as `DEFAULT_SETTINGS` in `js/store/settings.js`.
- **Persistence (D2-04..D2-06):** Settings live INSIDE the existing `nightwatch:db` blob as a top-level `settings` key. The canonical v2 shape is `{ version: 2, settings: {...}, events: [...] }`. Phase 5 import/export round-trips both. `localStorage` value === canonical JSON byte-for-byte (D-05 preserved).
- **Migration (D2-05):** v1 → v2 silent auto-migration. When `load()` returns a v1 blob (no `settings` key), inject `DEFAULT_SETTINGS`, bump `version` to 2, persist on the next save (lazy persist — no spurious write at load time). No toast, no prompt, no first-run banner. `console.info` may log the migration with the existing `[nightwatch]` prefix.
- **Settings store (D2-07..D2-09):** New `js/store/settings.js`. Constructor `createSettingsStore({ storage, defaults? })`. Public API `{ get(): SettingsSnapshot, update(patch): SettingsSnapshot, subscribe(fn): unsubscribe }`. `get()` returns `Object.freeze`'d snapshot. `subscribe(fn)` fires `fn(newSnapshot)` synchronously after every successful `update()`. Both stores receive the SAME `createStorageLocal('nightwatch:db')` instance at the composition root.
- **Header (D2-10, D2-11):** New `<header class="appHeader">` element above the quick-log row in `index.html`, with left-aligned `<h1 class="subjectName">` and right-aligned `<button class="settingsTrigger" aria-label="Settings">` (inline SVG gear, no external asset). `document.title = 'Nightwatch — {name}'` when `subjectName !== ''`, else `'Nightwatch'`.
- **Settings modal (D2-12, D2-13, D2-14):** Second `<dialog id="settings">` sibling of `<dialog id="manualEntry">`. `<form method="dialog">`, explicit `[Cancel]`/`[Save]` `<menu>`, ESC + Cancel discard via `dialog.close()` with empty returnValue, Save uses `value="save"`. Three fieldset sections: Profile (subject name), Time & Day (cutover, grouping, time format), Forecast tuning (auto outlier, max_delta, min_days, window, blend). NO welcome banner / first-load nudge. Inline error surface `<output id="settingsErrors" aria-live="polite">` mirrors Plan 01-07.
- **Cutover (D2-15, D2-16, D2-17):** New `groupingMode ∈ { 'calendar', 'sleepCycle' }`. Today screen reads `eventLog.daysByCalendar(7)` when `calendar`, `eventLog.daysBySubjectiveNight(settings.get().cutoverHour, 7)` when `sleepCycle`. Quick-toggle on Today (`View: [Calendar] [Sleep cycle]`) commits-on-click — the **only** exception to the explicit-Save policy (rationale: previewing the layout effect IS the commit). The day-bucketer's `cutoverHour` parameter is already the seam (D-18); Phase 2 wires `settings.get().cutoverHour` at the call site, not by mutating `BUCKET_CONFIG.defaultCutoverHour`.
- **Time format (D2-18, D2-19, D2-20):** Three render surfaces governed by `timeFormat`: (1) event row `<time class="eventTime">` in `today-screen.js` via new `formatTime(at, timeFormat)` helper; (2) manual-entry modal HH input becomes `min="1" max="12"` plus a `<select>` AM/PM when `12h`; (3) day headers stay ISO-format (timeFormat-independent). Internal storage is always canonical `'YYYY-MM-DDTHH:MM'` (24h ISO). Native `<input type="time">` REJECTED (mirrors D-14 rationale).
- **Validation (D2-21, D2-22, D2-23):** Strict bounds on Save. Out-of-range/wrong-type on LOAD → reset to default + `console.warn` (per-field, NOT whole-blob rejection — settings hygiene is isolated from event hygiene). Pure `js/lib/settings-validate.js` exporting `validateSettings(input): { ok, errors[], normalized }`. Called from both Save handler (UI) and settings-store loader.
- **Testing (D2-24..D2-27):** TDD for pure logic (`settings-validate.js`, `store/settings.js` merge + subscribe, v1→v2 migration helper). Test-after-with-E2E for UI. Migration is exercised by `tests/integration/v1-to-v2-migration.test.js`. Round-trip exercised by integration tests. Every CFG-* requirement has at least one E2E (D-22 coverage matrix carried forward).

### Claude's Discretion (verbatim from CONTEXT.md)

- File-internal API shape of `js/lib/settings-validate.js` (return type, helper sub-functions) — planner picks the cleanest split.
- Whether the v1→v2 migration helper lives in `js/store/settings.js`, `js/lib/db-shape.js`, or inside `createSettingsStore` — planner picks. **Recommendation below: tiny `js/lib/db-shape.js` helper.** See §Architecture Patterns.
- Exact SVG glyph for the gear icon — any minimal viewBox-24 outline, inline in `index.html`.
- Grouping-mode toggle on Today screen: two `<button>` elements with `aria-pressed` vs single `<select>` vs `<input type="radio">` — UI taste. **Recommendation below: two `<button aria-pressed>`.** See §Patterns.
- CSS for header strip, gear placement, section fieldsets, modal width on mobile — calm/minimal aesthetic, Phase 8 will re-theme.
- `[nightwatch]` prefix on the `console.info` migration log — RECOMMENDED yes (matches `storage-local.js` warning prefix).
- Manual-entry modal behavior when settings change while open — re-render time picker via subscriber, preserve partial values, clamp 23 → 12 PM on 24→12 toggle.
- `<select>` over `<input type="number">` for `statBlend` — RECOMMENDED `<select>`.

### Deferred Ideas (OUT OF SCOPE)

- **CFG-05** per-day rejected toggle → Phase 4 (with History screen). The Phase 2 `autoOutlier` boolean is stored only — detection logic is Phase 3.
- 7-day list-window length as a Phase 2 setting → not included; could become a 10th setting if dogfooding shows 7 is wrong.
- Cutover-hour explainer tooltip / first-load welcome nudge → not shipped; Phase 2 candidate if discoverability proves poor.
- Multi-profile switching (CFG2-01) → v2; settings shape stays single `subjectName` field in Phase 2.
- Polish-language UI (PLAT2-02) → v2; CFG-09 is locale-style not localization.
- Day-header locale-aware formatting → Phase 7 (with charts/heatmap).
- Settings export as a separate file → rejected in favor of embedded `db.settings`.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | Configurable subject display name (header + document.title across all screens) | §Pattern A (settings store wiring), §Pattern E (header), §Pitfall #5 (XSS on dynamic name) |
| CFG-02 | Configurable `max_delta` (forecast precision threshold, minutes) | §Pattern A; §Pattern F (validator) — stored-but-inert per D2-02 |
| CFG-03 | Configurable `min_days` (rolling-window data minimum) | §Pattern A; §Pattern F — stored-but-inert |
| CFG-04 | Toggle automatic outlier detection on/off | §Pattern A; §Pattern F — stored-but-inert (the boolean ships; detection engine is Phase 3) |
| CFG-05 | Manually flag any day as "rejected" | **DEFERRED to Phase 4** per CONTEXT.md D2-01 — planner must explicitly mark this requirement as "deferred to Phase 4" in plan frontmatter so the coverage gate (step 13/13a/13e) doesn't flag it as a silent drop |
| CFG-06 | Configurable rolling-window length (days) | §Pattern A; §Pattern F — stored-but-inert |
| CFG-07 | Configurable statistical blend (median / mean / blend) | §Pattern A; §Pattern F — stored-but-inert |
| CFG-08 | Configurable day-cutover hour (default ~04:00) | §Pattern A (store), §Pattern B (today-screen wiring), §Pitfall #2 (cutover-hour seam — DO NOT mutate BUCKET_CONFIG), §Pattern G (grouping-mode quick-toggle on Today, the user-story-critical UI) |
| CFG-09 | Configurable 24h vs 12h time format | §Pattern A; §Pattern H (`formatTime(at, timeFormat)` helper); §Pattern I (manual-entry 12h picker); §Pitfall #4 (24↔12 conversion edge cases — 12 AM/PM); §Pitfall #6 (partial values when settings change mid-edit) |

</phase_requirements>

## Summary

Phase 2 introduces **configuration as a first-class data tier** without disturbing the Phase 1 walking skeleton. The phase is mostly **wiring**, not invention — Phase 1 already shipped the load-bearing seams (storage adapter with injected `ls`, two day-bucketer functions that take `cutoverHour` as a parameter, native `<dialog>` modal pattern, pure validator pattern from Plan 01-07). Phase 2's job is to:

1. Add a **second store** (`js/store/settings.js`) that shares the existing storage adapter with `event-log.js`.
2. Add a **schema migration path** (v1 → v2) that injects defaults without losing events.
3. Add a **subscriber/observer notification** so Today and manual-entry re-render when settings change.
4. Add the **header strip + Settings modal** UI surface.
5. **Wire** `settings.get().cutoverHour` into the bucketer call site on Today and `settings.get().timeFormat` into three render surfaces.
6. Add a **pure validator** module mirroring Plan 01-07's `validate(input, {now})` pattern.

The MVP-critical thread (the phase-goal sentence) is **cutover hour + grouping-mode toggle on Today** — that's the user-story payoff. The other 7 settings ride along in the same modal. The planner should slice plans so this thread lands first (Wave 1 / Wave 2) and the parallel work follows.

**Primary recommendation:** Treat **(a) `js/lib/db-shape.js` as the shared-blob seam, (b) settings-store with synchronous `Set<fn>` subscriber, (c) a strict-bounds + per-field-default-on-load validator, and (d) two-`<button aria-pressed>` grouping-mode toggle that commits-on-click** as the spine. Every other decision is a stylistic detail.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settings defaults constant | Pure config (`js/store/settings.js` top-level `DEFAULT_SETTINGS`) | — | `Object.freeze`'d per D2-03 / CLAUDE.md convention |
| Settings validation | Pure logic (`js/lib/settings-validate.js`) | — | D2-23 mandates a pure helper called from both UI Save and store loader |
| Settings store (merge + subscribe + update) | Store (`js/store/settings.js`) | StorageAdapter | Mirrors `createEventLog` pattern; subscriber is new |
| v1→v2 schema migration | Pure helper (`js/lib/db-shape.js`) | StorageAdapter (read path only) | D2-08 leaves this to the planner; recommendation below for a tiny shared helper |
| Header rendering | UI (`js/ui/header.js` — NEW) | dom.js helpers | First UI element outside day-list region |
| Settings modal | UI (`js/ui/settings-modal.js` — NEW) | Native `<dialog>` | Second `<dialog>` in the app, mirrors `manual-entry.js` mechanics |
| Grouping-mode quick-toggle | UI (extend `js/ui/today-screen.js`) | settings store subscriber | Commits-on-click per D2-16 — the only such surface |
| Time format propagation | Pure helper (`js/lib/time.js`) + UI consumers (`today-screen.js`, `manual-entry.js`) | settings store subscriber | New `formatTime(at, timeFormat)` exported from `time.js`; HH input shape switches in manual-entry |
| Schema-version guard | Store (`js/store/event-log.js`) | — | Raise `SCHEMA_VERSION` constant from 1 to 2; migration path handles the v1→v2 case BEFORE the store's version check fires |
| Composition wiring | Root (`js/app.js`) | — | Phase 2 extends — wires `createSettingsStore`, threads snapshot/subscribe API into mounts |

## Standard Stack

**Unchanged from Phase 1.** Zero runtime dependencies (D-09 / D-20 / CLAUDE.md hard constraint). Native `<dialog>`, `localStorage`, `Object.freeze`, `crypto.randomUUID()`, browser DOM. Dev tooling stays at `@playwright/test` (devDep only) + `node:test` (built-in).

**No new packages.** No date-formatting library. No state library. No CSS framework. The 12h time conversion (Pitfall #4) is ~10 lines of native arithmetic — see §Pattern I.

[VERIFIED via direct file read on 2026-05-27] The existing `js/store/event-log.js` line 36 declares `const SCHEMA_VERSION = 1` and line 59 throws on mismatch — these are the two lines Phase 2's migration path must beat to (the migration normalizes BEFORE the store's check). The existing `js/adapters/storage-local.js` accepts an optional `ls` argument (line 36) — settings-store integration tests reuse this seam, no new adapter needed.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  index.html                                                              │
│                                                                          │
│  <header class="appHeader">                                              │
│    <h1 class="subjectName">         <button class="settingsTrigger">     │
│         ↑ textContent only          ↓ click → openSettings()             │
│  </header>                                                               │
│  <main id="app">                                                         │
│    [quick-log row + day list + add-event btn]  ← Phase 1 surface         │
│  </main>                                                                 │
│  <dialog id="manualEntry">  ← Phase 1, unchanged structure               │
│  <dialog id="settings">     ← NEW Phase 2                                │
│                                                                          │
│            ▲                                                             │
│            │ subscribe(fn) — fires synchronously after update()          │
│            │                                                             │
│   ┌────────┴──────────────────────────────────────┐                      │
│   │              js/store/settings.js (NEW)       │                      │
│   │  createSettingsStore({ storage, defaults? })  │                      │
│   │   get(): SettingsSnapshot (Object.freeze'd)   │                      │
│   │   update(patch): SettingsSnapshot             │                      │
│   │   subscribe(fn): () => void  ← Set<fn>        │                      │
│   └────────┬──────────────────────┬───────────────┘                      │
│            │                      │                                      │
│            │ load()/save(db)      │ same storage instance                │
│            ▼                      ▼                                      │
│       ┌──────────────────────────────────┐                               │
│       │  js/adapters/storage-local.js    │  ← Phase 1, unchanged         │
│       │  createStorageLocal('nightwatch:db')                             │
│       └────┬─────────────────────────────┘                               │
│            │                                                             │
│            ▼                                                             │
│   ╔════════════════════════════════════════════╗                         │
│   ║ localStorage:nightwatch:db                 ║                         │
│   ║ { version: 2,                              ║                         │
│   ║   settings: { ... 9 keys ... },            ║                         │
│   ║   events: [ ... unchanged ... ] }          ║                         │
│   ╚════════════════════════════════════════════╝                         │
│            ▲                                                             │
│            │ load()/save(db) — SAME instance                             │
│            │                                                             │
│   ┌────────┴──────────────────────────────────┐                          │
│   │  js/store/event-log.js  ← SCHEMA_VERSION raised 1 → 2                │
│   │  + handles the v2 shape (settings key passed through unchanged)      │
│   └───────────────────────────────────────────┘                          │
│                                                                          │
│  Migration seam (NEW):                                                   │
│   ┌──────────────────────────────────────────────┐                       │
│   │  js/lib/db-shape.js                          │                       │
│   │   migrateV1ToV2(blob, defaults): v2Blob      │                       │
│   │   (pure — no I/O — called by BOTH stores on  │                       │
│   │    construction before their version guards) │                       │
│   └──────────────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 2 additions only)

```
nightwatch/
├── index.html                       # +<header>, +<dialog id="settings">
├── style.css                        # +header strip, +settings modal, +grouping-toggle, +12h-AMPM
├── js/
│   ├── app.js                       # ⟳ composition root extends with settings store wiring
│   ├── lib/
│   │   ├── time.js                  # ⟳ +formatTime(at, timeFormat), +convert12to24/24to12 helpers
│   │   ├── settings-validate.js     # NEW — validateSettings(input): {ok, errors[], normalized}
│   │   └── db-shape.js              # NEW — migrateV1ToV2(blob, defaults), helpers for split blob
│   ├── store/
│   │   ├── event-log.js             # ⟳ SCHEMA_VERSION 1→2, accept v2 shape
│   │   └── settings.js              # NEW — createSettingsStore
│   ├── ui/
│   │   ├── today-screen.js          # ⟳ +grouping toggle, +subscribe, +formatTime call
│   │   ├── manual-entry.js          # ⟳ +12h HH/AMPM picker, +subscribe for re-render
│   │   ├── header.js                # NEW — mountHeader({root, settings, onOpenSettings})
│   │   └── settings-modal.js        # NEW — openSettings({settings})
│   └── adapters/                    # unchanged
└── tests/
    ├── unit/
    │   ├── settings-validate.test.js   # NEW — bounds + normalization + per-field defaults
    │   └── db-shape.test.js            # NEW — migration semantics
    ├── integration/
    │   ├── settings-store.test.js      # NEW — get/update/subscribe + persist
    │   └── v1-to-v2-migration.test.js  # NEW — D2-25
    └── e2e/
        ├── settings-modal.spec.js      # NEW — D2-27 CFG-01..09 (sans 05) E2E
        └── grouping-toggle.spec.js     # NEW — CFG-08 user-story E2E
```

`⟳` = modified Phase 1 file; `NEW` = added in Phase 2.

### Pattern A: Settings store (`js/store/settings.js`)

**What:** Mirrors `createEventLog` from Phase 1 — load-once at construction, mutate-in-place, persist on every `update`, with the new addition of a synchronous `Set<fn>` subscriber.

**Recommended shape:**

```javascript
// js/store/settings.js
import { migrateV1ToV2 } from '../lib/db-shape.js';
import { validateSettings } from '../lib/settings-validate.js';

export const DEFAULT_SETTINGS = Object.freeze({
  subjectName: '',
  cutoverHour: 4,
  groupingMode: 'calendar',
  timeFormat: '24h',
  autoOutlier: false,
  maxDelta: 30,
  minDays: 7,
  windowDays: 7,
  statBlend: 'median',
});

/**
 * @param {{ storage: {load, save}, defaults?: object }} deps
 */
export function createSettingsStore({ storage, defaults = DEFAULT_SETTINGS }) {
  let db = storage.load();
  db = migrateV1ToV2(db, defaults);            // pure — normalizes shape
  // Per-field default-on-invalid on load (D2-22): validateSettings's `normalized`
  // resolves out-of-range / wrong-type values to defaults with a console.warn.
  const { normalized } = validateSettings(db.settings ?? defaults, { defaults });
  db.settings = normalized;
  // Lazy persist (D2-05): don't save() at load time; the next update() will.

  const subscribers = new Set();
  const snapshot = () => Object.freeze({ ...db.settings });

  return {
    get: snapshot,
    update(patch) {
      // Strict on save: validateSettings throws (or returns ok:false) on invalid.
      // The UI Save handler is expected to call validateSettings BEFORE calling
      // update — by contract update() trusts its input. (Belt-and-suspenders:
      // a second validateSettings call here is acceptable; planner's choice.)
      db.settings = { ...db.settings, ...patch };
      storage.save(db);                         // whole-blob rewrite (D-02)
      const next = snapshot();
      for (const fn of subscribers) fn(next);   // synchronous, single-thread
      return next;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
```

**Why this shape:**

- `get()` returns `Object.freeze`'d so the UI cannot mutate the canonical copy (matches Phase 1 `listEvents()` defensive copy idiom).
- `subscribers = new Set()` — natural dedup, O(1) add/remove, deterministic iteration order. Synchronous fire is correct for Phase 2 (D2-09): no debounce, no rAF batching, no microtask. Profile in dogfooding before adding complexity.
- `update(patch)` does spread-merge, not assign-whole — partial updates are the modal Save's natural form when only some fields changed. Two-stage validation (UI Save validates strictly + store validates defensively) is the recommended belt-and-suspenders, mirroring Phase 1 `event-log.editEvent`'s "re-round at the store layer even though UI also rounds" defense in depth.
- `subscribe(fn)` returns an unsubscribe function — mounts call `const unsub = settings.subscribe(redraw); return () => unsub();` at unmount.

### Pattern B: Shared-blob seam (`js/lib/db-shape.js`)

**The choice (D2-08 was left to the planner).** Three options:

1. **Tiny shared helper `js/lib/db-shape.js`** with `migrateV1ToV2(blob, defaults)` + (optional) helpers like `withSettings(blob, settings)` / `withEvents(blob, events)`. Both stores import it.
2. **Each store owns its own slice.** `event-log` reads `blob.events`, `settings` reads `blob.settings`, the merge happens implicitly because both `save(db)` with the full blob.
3. **A coordinator** in `js/app.js` that mediates reads/writes.

**Recommendation: Option 1.** Rationale:

- Migration logic is shared (both stores need to know the v1→v2 shape) — DRY argues for a single helper.
- Pure-functional design (no I/O) makes it ideal for `node:test` unit tests independently of the storage adapter.
- Phase 5 (import/export) gets a natural home for shape validation when round-tripping JSON.
- Phase 1's `js/lib/` already contains pure-logic modules (`time.js`, `day-bucket.js`, `id.js`) — `db-shape.js` fits the established pattern.
- Option 2 (each store owns its slice) leaks the assumption that both stores see the same blob shape — and if someone later adds a third store, the implicit coupling becomes a footgun.

**Concrete:**

```javascript
// js/lib/db-shape.js — pure, no I/O

/**
 * Normalize a v1 blob to v2 by injecting default settings.
 * Idempotent: a v2 blob passes through unchanged. A null blob (fresh install)
 * becomes a fresh v2 blob with default settings + empty events.
 *
 * @param {object|null} blob
 * @param {object} defaultSettings
 * @returns {{version: 2, settings: object, events: Array}}
 */
export function migrateV1ToV2(blob, defaultSettings) {
  if (blob === null || blob === undefined) {
    return { version: 2, settings: { ...defaultSettings }, events: [] };
  }
  if (blob.version === 2) return blob;
  if (blob.version === 1) {
    // The Phase 1 console.info matches storage-local.js's [nightwatch] prefix.
    console.info('[nightwatch] migrating db v1 → v2 (injecting default settings)');
    return {
      version: 2,
      settings: { ...defaultSettings },
      events: Array.isArray(blob.events) ? blob.events : [],
    };
  }
  // Future versions OR weird shapes: throw. Phase 5 import is the recovery path.
  throw new Error(`Unsupported schema version: ${blob.version}`);
}
```

**Critical interaction with `event-log.js`:** The current event-log throws on `db.version !== 1`. Phase 2 raises the constant to 2 AND adds `db = migrateV1ToV2(db, DEFAULT_SETTINGS_FOR_MIGRATION)` BEFORE the version check. There are two acceptable architectures here — both work, planner picks:

- **(a) Event-log calls `migrateV1ToV2` itself** with a baked-in copy of `DEFAULT_SETTINGS`. This couples event-log to the settings defaults — undesirable, but keeps the two stores independent.
- **(b) Migration happens at the composition root** in `js/app.js`: load the blob once, migrate, save back, then construct both stores. This means each store calls `storage.load()` AFTER the migration — they see a v2 blob and version checks pass. Recommended because (i) it keeps event-log decoupled from settings, (ii) the migration is the very first thing that happens on app boot, (iii) it pairs naturally with the lazy-persist rule because the composition root can choose to save eagerly OR set a "needs persist" flag for the first update.

**Recommendation:** Option (b). Composition root in `js/app.js` becomes:

```javascript
// js/app.js (Phase 2 shape)
const storage = createStorageLocal('nightwatch:db');
// Lazy migration: read once, normalize, write back only on next mutation.
// (Could also eagerly save here — both are spec-compliant per D2-05; lazy
//  matches the "no spurious write at load time" wording.)
const settings = createSettingsStore({ storage });
const eventLog = createEventLog({ storage, clock, id: newEventId });
const header = mountHeader({ root: document.querySelector('header.appHeader'), settings });
mountTodayScreen({ root: document.getElementById('app'), eventLog, settings });
```

Both stores call `storage.load()` independently inside their constructors. The first to call `load()` triggers `migrateV1ToV2` — and saves the normalized blob into THEIR `db` variable. The second to call `load()` sees the **un-normalized localStorage** still (because we haven't called `storage.save(db)` yet — lazy persist). Both stores then call `migrateV1ToV2` and arrive at the same in-memory v2 shape. **This is correct and intentional** — they're independent copies of the same canonical blob. The next `update()` on either store writes the full v2 blob back; the OTHER store's in-memory copy lags until its next read. **Pitfall #1 below covers the cross-store read-lag.**

### Pattern C: Schema-version bump on `event-log.js`

**Minimal diff:**

```diff
- const SCHEMA_VERSION = 1;
+ const SCHEMA_VERSION = 2;
```

Plus, at the top of `createEventLog`:

```diff
- let db = storage.load();
- if (db === null) {
-   db = { version: SCHEMA_VERSION, events: [] };
- }
+ let db = migrateV1ToV2(storage.load(), DEFAULT_SETTINGS_AT_REST);
+ // db is now guaranteed v2 shape: { version: 2, settings, events }
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${db.version}`);
  }
```

Where `DEFAULT_SETTINGS_AT_REST` is the settings object used solely to populate the migration's `settings` field — the event-log never reads it. It's a structural placeholder. **This is the "either store can migrate" property** — the event-log doesn't care what's in `db.settings`, it just preserves the slot.

Optional cleaner alternative: keep event-log purely about events by changing its API to accept the already-migrated `db` from the composition root, removing the inline `storage.load()` call. This is a bigger refactor than the user wants for Phase 2; recommend keeping the inline load + per-store migration call.

`persist()` in event-log already does `storage.save(db)` — no change needed. The settings slot it preserved comes along for free. **Critical invariant: `editEvent`, `addEvent`, `addEventAt`, `deleteEvent` all call `persist()`, which writes `db.settings` along with `db.events`. If the settings-store has updated `localStorage` between the event-log's load and the event-log's next write, the event-log's stale `db.settings` will overwrite the fresh one.** See Pitfall #1.

### Pattern D: Settings modal — second `<dialog>` mechanics

**What's the same as Plan 01-04 manual-entry:**

- `<form method="dialog">` — Save submit sets `dlg.returnValue = 'save'` via `value="save"` on the Save button. Cancel sets returnValue to something else (empty or 'cancel') via explicit `dlg.close('cancel')`.
- `dlg.showModal()` — focus trap, ESC-to-close, `aria-modal="true"`, body inert.
- `dlg.addEventListener('close', handler, { once: true })` — handler reads `returnValue` and branches.
- Inline error surface `<output id="settingsErrors" aria-live="polite">` mirrors Plan 01-07.
- `formnovalidate` on Save IF any HTML5 constraints are too strict (e.g., the `step` attribute on number inputs). Recommend `formnovalidate` only if the planner finds it's needed; settings ranges are wider so it may not be (Phase 1 used it to allow 0-59 minutes through the HTML5 step="5" gate).

**What's new for the second dialog (low risk, but verified):**

- **Two `<dialog>` elements coexisting in the DOM is fine.** Browsers maintain an independent top-layer stack per dialog. Opening Settings while manual-entry is also open would stack them — Phase 2 prevents this by gating: Settings button is in the header (outside manual-entry), and the modal entry guards on D-13 + D2-12 don't allow nesting. No special focus-trap reset code is needed.
- **`document.title` updates from a `<dialog>` Save handler are safe.** No browser quirks here.
- **Two `<output aria-live="polite">` elements is fine** — each is scoped to its parent form.

**Recommended file shape (`js/ui/settings-modal.js`):**

```javascript
import { el, clear } from './dom.js';
import { validateSettings } from '../lib/settings-validate.js';

/**
 * Open the Settings modal, populate fields from settings.get(),
 * validate on Save, and update via settings.update(patch). Errors
 * render into <output id="settingsErrors">.
 *
 * @param {{ settings: { get, update, subscribe } }} opts
 */
export function openSettings({ settings }) {
  const dlg = document.getElementById('settings');
  const form = dlg.querySelector('form');
  const errorsEl = dlg.querySelector('#settingsErrors');
  const snap = settings.get();

  // Populate every field from `snap`. Each field uses .value or .checked
  // (NEVER innerHTML — T-07 / V5 carry-over from Plan 01-04).
  form.elements.namedItem('subjectName').value = snap.subjectName;
  form.elements.namedItem('cutoverHour').value = String(snap.cutoverHour);
  form.elements.namedItem('groupingMode').value = snap.groupingMode;
  form.elements.namedItem('timeFormat').value = snap.timeFormat;
  form.elements.namedItem('autoOutlier').checked = snap.autoOutlier;
  form.elements.namedItem('maxDelta').value = String(snap.maxDelta);
  form.elements.namedItem('minDays').value = String(snap.minDays);
  form.elements.namedItem('windowDays').value = String(snap.windowDays);
  form.elements.namedItem('statBlend').value = snap.statBlend;

  if (errorsEl) clear(errorsEl);

  const onClose = () => {
    if (dlg.returnValue !== 'save') return;
    const data = new FormData(form);
    const raw = {
      subjectName: String(data.get('subjectName') ?? '').trim(),
      cutoverHour: Number(data.get('cutoverHour')),
      groupingMode: String(data.get('groupingMode') ?? ''),
      timeFormat: String(data.get('timeFormat') ?? ''),
      autoOutlier: data.get('autoOutlier') === 'on',  // checkbox idiom
      maxDelta: Number(data.get('maxDelta')),
      minDays: Number(data.get('minDays')),
      windowDays: Number(data.get('windowDays')),
      statBlend: String(data.get('statBlend') ?? ''),
    };

    const result = validateSettings(raw, { mode: 'save' });
    if (!result.ok) {
      // Re-open + render errors + focus first errored field (mirrors Plan 01-07).
      if (errorsEl) {
        clear(errorsEl);
        for (const err of result.errors) {
          errorsEl.appendChild(el('p', { 'data-field': err.field, textContent: err.message }));
        }
      }
      queueMicrotask(() => {
        dlg.showModal();
        dlg.addEventListener('close', onClose, { once: true });
        const first = form.elements.namedItem(result.errors[0]?.field);
        if (first && first.focus) try { first.focus(); } catch {}
      });
      return;
    }
    settings.update(result.normalized);  // fires subscribers synchronously
    // Modal is already closed (returnValue === 'save'); subscribers re-render
    // Today + document.title.
  };
  dlg.addEventListener('close', onClose, { once: true });

  // Cancel binds the same way as manual-entry — explicit close('cancel').
  const cancelBtn = dlg.querySelector('#settingsCancel');
  const onCancel = () => dlg.close('cancel');
  cancelBtn.addEventListener('click', onCancel, { once: true });

  dlg.showModal();
}
```

### Pattern E: Header (`js/ui/header.js`)

```javascript
// js/ui/header.js — first UI element outside the day-list region (D2-10)
import { openSettings } from './settings-modal.js';

export function mountHeader({ root, settings }) {
  // root is the <header class="appHeader"> from index.html (static markup).
  const h1 = root.querySelector('h1.subjectName');
  const trigger = root.querySelector('button.settingsTrigger');

  const apply = (snap) => {
    h1.textContent = snap.subjectName;                                // V5 / T-07: textContent
    document.title = snap.subjectName ? `Nightwatch — ${snap.subjectName}` : 'Nightwatch';
  };
  apply(settings.get());
  settings.subscribe(apply);

  trigger.addEventListener('click', () => openSettings({ settings }));
}
```

`<header>` is mounted from static HTML (no JS-rendered children), so the JS only updates `textContent` + `document.title` and wires the click. No replaceChildren needed — keeps the structure stable for screen readers.

### Pattern F: Pure validator (`js/lib/settings-validate.js`)

Mirrors Plan 01-07's `validate(input, {now})` shape — pure, collects all errors before returning, returns `{ok, errors[], normalized}`.

**Two modes:** `'save'` (strict — return errors for out-of-range) vs `'load'` (lenient — silently default per-field with console.warn). D2-22 differentiates these by call site.

```javascript
// js/lib/settings-validate.js — pure logic, no DOM
const VALID_GROUPING = new Set(['calendar', 'sleepCycle']);
const VALID_TIMEFORMAT = new Set(['24h', '12h']);
const VALID_BLEND = new Set(['median', 'mean', 'blend']);
const RULES = Object.freeze({
  subjectName:  { type: 'string',  trim: true, maxLen: 40 },
  cutoverHour:  { type: 'integer', min: 0, max: 23 },
  groupingMode: { type: 'enum',    values: VALID_GROUPING },
  timeFormat:   { type: 'enum',    values: VALID_TIMEFORMAT },
  autoOutlier:  { type: 'boolean' },
  maxDelta:     { type: 'integer', min: 5, max: 120 },
  minDays:      { type: 'integer', min: 1, max: 90 },
  windowDays:   { type: 'integer', min: 3, max: 90 },
  statBlend:    { type: 'enum',    values: VALID_BLEND },
});

import { DEFAULT_SETTINGS } from '../store/settings.js';   // OR pass defaults in

/**
 * @param {object} input
 * @param {{ mode?: 'save' | 'load', defaults?: object }} [opts]
 * @returns {{ ok: boolean, errors: Array<{field, message}>, normalized: object }}
 */
export function validateSettings(input, { mode = 'save', defaults = DEFAULT_SETTINGS } = {}) {
  const errors = [];
  const normalized = { ...defaults };

  for (const [field, rule] of Object.entries(RULES)) {
    const raw = input?.[field];
    const checked = checkField(field, raw, rule);
    if (checked.ok) {
      normalized[field] = checked.value;
    } else if (mode === 'save') {
      errors.push({ field, message: checked.message });
    } else { // mode === 'load'
      console.warn(`[nightwatch] settings.${field} invalid (${JSON.stringify(raw)}); using default ${JSON.stringify(defaults[field])}`);
      normalized[field] = defaults[field];
    }
  }
  return { ok: errors.length === 0, errors, normalized };
}

function checkField(field, raw, rule) {
  switch (rule.type) {
    case 'string': {
      if (typeof raw !== 'string') return { ok: false, message: `${field} must be text.` };
      const trimmed = rule.trim ? raw.trim() : raw;
      if (rule.maxLen !== undefined && trimmed.length > rule.maxLen) {
        return { ok: false, message: `${field} must be ≤ ${rule.maxLen} characters.` };
      }
      return { ok: true, value: trimmed };
    }
    case 'integer': {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
        return { ok: false, message: `${field} must be an integer between ${rule.min} and ${rule.max}.` };
      }
      return { ok: true, value: n };
    }
    case 'boolean': {
      if (typeof raw !== 'boolean') return { ok: false, message: `${field} must be true or false.` };
      return { ok: true, value: raw };
    }
    case 'enum': {
      if (!rule.values.has(raw)) {
        return { ok: false, message: `${field} must be one of: ${[...rule.values].join(', ')}.` };
      }
      return { ok: true, value: raw };
    }
  }
}
```

**Circular import risk:** Importing `DEFAULT_SETTINGS` from `js/store/settings.js` into `js/lib/settings-validate.js` while `js/store/settings.js` imports `validateSettings` from `js/lib/settings-validate.js` creates a cycle. **Three resolutions, planner picks:**

1. **Move `DEFAULT_SETTINGS` to `js/lib/db-shape.js`** (or a tiny `js/lib/settings-defaults.js`) and have both `settings.js` and `settings-validate.js` import from there. Cleanest.
2. **Pass defaults explicitly** to `validateSettings(input, { defaults })` from every call site. No top-level import.
3. **Inline a small defaults copy** in `settings-validate.js`. Duplicates D2-03; least desirable.

Recommendation: **(1)** — defaults are pure data, fit naturally in `db-shape.js` next to the migration helper.

### Pattern G: Grouping-mode quick-toggle on Today screen

Per D2-16: two `<button aria-pressed>` toggle, commits-on-click, sits above the day list.

```javascript
// in js/ui/today-screen.js (NEW section, between <header> mount and dayList)
const toggle = el('div', { className: 'groupingToggle', role: 'group', 'aria-label': 'Day grouping' });
toggle.appendChild(el('button', { type: 'button', 'data-grouping': 'calendar',   textContent: 'Calendar' }));
toggle.appendChild(el('button', { type: 'button', 'data-grouping': 'sleepCycle', textContent: 'Sleep cycle' }));

const reflectGrouping = (snap) => {
  for (const btn of toggle.querySelectorAll('button[data-grouping]')) {
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-grouping') === snap.groupingMode));
  }
};
reflectGrouping(settings.get());
settings.subscribe((next) => { reflectGrouping(next); render(); });
//                                ↑ AND re-render on every settings change

toggle.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-grouping]');
  if (!btn) return;
  const next = btn.getAttribute('data-grouping');
  if (next !== settings.get().groupingMode) {
    settings.update({ groupingMode: next });  // commits-on-click (D2-16)
    // Subscriber chain handles aria-pressed + render — no manual call needed.
  }
});
```

**`render()` in today-screen reads grouping mode from settings:**

```javascript
function render() {
  clear(dayList);
  const snap = settings.get();
  const days = snap.groupingMode === 'sleepCycle'
    ? eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)
    : eventLog.daysByCalendar(7);
  for (const day of days) dayList.appendChild(renderDay(day, snap.timeFormat));
}
```

**Two `<button aria-pressed>` over `<select>`:** more screen-reader-discoverable (a `<select>` is announced as "combobox" while two buttons are announced as "toggle button, pressed/not pressed"), and the commits-on-click semantics map more obviously onto a button than a `<select>` (whose default UX is "open a dropdown, then choose").

### Pattern H: `formatTime(at, timeFormat)` helper

Add to `js/lib/time.js`:

```javascript
/**
 * Format the time portion of a canonical 'YYYY-MM-DDTHH:MM' for display.
 * Date portion is ignored — caller already has it.
 *
 * 24h: 'HH:MM'           e.g. 03:50, 18:25
 * 12h: 'H:MM AM/PM'      e.g. 3:50 AM, 6:25 PM, 12:00 AM (midnight), 12:00 PM (noon)
 *
 * String-based — never constructs a Date — Pitfall #3 (DST safety) carries over.
 *
 * @param {string} at  canonical 'YYYY-MM-DDTHH:MM'
 * @param {'24h' | '12h'} timeFormat
 * @returns {string}
 */
export function formatTime(at, timeFormat) {
  const hh = at.slice(11, 13);
  const mm = at.slice(14, 16);
  if (timeFormat === '24h') return `${hh}:${mm}`;
  const h24 = parseInt(hh, 10);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${mm} ${ampm}`;
}
```

**Critical: the existing `hhmm(at)` private function in `today-screen.js` (line 264-266) is the single consumer.** Replace `hhmm(evt.at)` → `formatTime(evt.at, snap.timeFormat)` in the row renderer, where `snap` is the settings snapshot passed in from `render()`. **Don't** make `formatTime` close over the settings store; let the caller resolve `timeFormat` from `settings.get().timeFormat` and pass it in — keeps `formatTime` pure (matches the rest of `js/lib/time.js`).

### Pattern I: Manual-entry 12h picker

Per D2-20: HH `<input>` becomes `min="1" max="12"` + an AM/PM `<select>` when `timeFormat === '12h'`. Internal storage stays canonical 24h `'YYYY-MM-DDTHH:MM'`.

**Two implementation tracks, planner picks:**

1. **Conditional rendering in `manual-entry.js`'s `openManualEntry`.** Read `settings.get().timeFormat` at open. If `12h`, swap the HH input's `min/max` and reveal a sibling `<select name="ampm">`. If user toggles 12h↔24h while the modal is open, the `settings.subscribe` callback re-renders the time picker, preserving the entered value through the conversion.
2. **Always render both** (HH 0-23 + HH 1-12 + AM/PM) and toggle CSS `display: none` based on `timeFormat`. Simpler DOM logic, more markup. Less recommended because the screen reader sees both labels.

Recommendation: **(1)**.

**Conversion helpers (add to `js/lib/time.js`):**

```javascript
/** Convert 12h HH+AMPM to 24h HH. Inputs are strings; output is integer 0-23. */
export function to24h(hStr, ampm) {
  const h = parseInt(hStr, 10);
  if (!Number.isFinite(h) || h < 1 || h > 12) throw new Error(`Invalid 12h hour: ${hStr}`);
  if (ampm === 'AM') return h === 12 ? 0 : h;
  if (ampm === 'PM') return h === 12 ? 12 : h + 12;
  throw new Error(`Invalid AM/PM: ${ampm}`);
}

/** Convert 24h integer hour to {h12: integer 1-12, ampm: 'AM'|'PM'}. */
export function to12h(h24) {
  if (!Number.isInteger(h24) || h24 < 0 || h24 > 23) throw new Error(`Invalid 24h hour: ${h24}`);
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { h12, ampm };
}
```

**Submit flow (12h mode):**

1. User enters HH=3, AMPM=PM, MM=25.
2. `openManualEntry`'s submit handler reads `timeFormat` from settings (or from a closure-captured value at open). If `12h`, call `to24h('3', 'PM')` → `15`. Build `tentativeAt = ${date}T${pad(15)}:${pad(25)}` → `'2026-05-27T15:25'`.
3. Pass `tentativeAt` to the existing `validate(input, {now})` — but `validate` currently takes `{hourStr, minuteStr}` not `{at}`. Two options:
   - Refactor `validate` to take a final `at` string (cleaner — push 12h↔24h conversion to a UI-layer helper before validate).
   - Add an optional `{ampm}` field and convert inside `validate` (couples validator to UI format — less clean).
   Recommend the refactor. Existing `manual-entry.test.js` (Plan 01-07) will need its test setup updated; preserved behavior.

**Cross-cutting: manual-entry subscribes to settings.** When `timeFormat` toggles 24↔12 while the modal is open (e.g., user opens Settings from another path? — actually impossible per D2-12, but D2-19 still mandates the support for partial-input preservation). The subscriber fires `apply(snap)` → reads current HH+MM input values, converts via `to12h`/`to24h`, re-writes the inputs. **Clamp rule** (per CONTEXT.md Discretion): if user had HH=23 and toggle to 12h, set HH=12 + AMPM=PM (the user's "11 PM" reading).

### Pattern J: index.html additions

**Static markup the planner needs to add to `index.html`:**

```html
<!-- BEFORE the existing <main id="app">: -->
<header class="appHeader">
  <h1 class="subjectName"></h1>
  <button type="button" class="settingsTrigger" aria-label="Settings">
    <!-- inline SVG gear, no external asset (D2-10) -->
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="..." fill="currentColor"/>
    </svg>
  </button>
</header>

<!-- AFTER the existing <dialog id="manualEntry">: -->
<dialog id="settings" aria-labelledby="settingsTitle">
  <form method="dialog">
    <h2 id="settingsTitle">Settings</h2>
    <fieldset>
      <legend>Profile</legend>
      <label>Subject name <input type="text" name="subjectName" maxlength="40"></label>
    </fieldset>
    <fieldset>
      <legend>Time &amp; Day</legend>
      <label>Day cutover hour <input type="number" name="cutoverHour" min="0" max="23"></label>
      <label>View grouping
        <select name="groupingMode">
          <option value="calendar">Calendar</option>
          <option value="sleepCycle">Sleep cycle</option>
        </select>
      </label>
      <label>Time format
        <select name="timeFormat">
          <option value="24h">24-hour</option>
          <option value="12h">12-hour</option>
        </select>
      </label>
    </fieldset>
    <fieldset>
      <legend>Forecast tuning</legend>
      <label><input type="checkbox" name="autoOutlier"> Automatic outlier detection</label>
      <label>Max delta (minutes) <input type="number" name="maxDelta" min="5" max="120"></label>
      <label>Min days <input type="number" name="minDays" min="1" max="90"></label>
      <label>Rolling window (days) <input type="number" name="windowDays" min="3" max="90"></label>
      <label>Statistical blend
        <select name="statBlend">
          <option value="median">Median</option>
          <option value="mean">Mean</option>
          <option value="blend">Blend</option>
        </select>
      </label>
    </fieldset>
    <output id="settingsErrors" class="settingsErrors" aria-live="polite"></output>
    <menu>
      <button type="button" id="settingsCancel" formnovalidate>Cancel</button>
      <button type="submit" value="save">Save</button>
    </menu>
  </form>
</dialog>
```

**Note** the Save button does NOT have `formnovalidate` here (unlike Plan 01-04's manual-entry) because the HTML5 constraints (`min`, `max`, `maxlength`) align with the validator's constraints — no silent rounding contract for settings. Planner can revisit if the constraint mismatch surfaces.

### Anti-Patterns to Avoid

- **Adding a third `<dialog>` for confirm-on-cancel** — D2-14 says Cancel discards pending edits silently. The native dialog's empty-returnValue path on ESC + Cancel handles this for free. Don't gild the lily.
- **`settings.subscribe(redraw)` without unsubscribe** — every mount that subscribes must capture the unsubscribe function and call it at unmount. Long-lived mounts (Today screen, header) effectively never unmount in Phase 2, so a leak here is dormant — but the manual-entry modal opens/closes repeatedly and a missed unsubscribe would accumulate subscribers and double-fire on every settings change. Test-after-with-E2E should cover this with a "open modal 5 times, change settings, assert renders count" assertion if discoverable in dogfooding.
- **Mutating `BUCKET_CONFIG.defaultCutoverHour`** — explicitly forbidden by D2-17. Wire `settings.get().cutoverHour` into the `daysBySubjectiveNight` call site instead.
- **`subscribers.forEach(fn => fn(next))` without snapshot copy** — if a subscriber calls `settings.subscribe()` or `unsubscribe()` during its own callback, the Set iteration order can become unstable. Defensive idiom: `const subs = [...subscribers]; for (const fn of subs) fn(next);` Recommended.
- **Calling `validateSettings` with `mode: 'save'` from the loader path** — would throw on a corrupted blob and prevent app boot. Use `mode: 'load'` (per-field default + warn) from the loader; `mode: 'save'` (strict + error array) from the modal Save handler.
- **Mixing `db.settings` direct mutation with `settings.update(...)`** — only `update()` may write `db.settings`. The migration helper's output is read once at construction; subsequent writes flow exclusively through `update()`.
- **A welcome banner / "Confirm your settings" first-open prompt** — explicitly rejected per D2-13.
- **`settings.update(rawFormDataObject)` without going through `validateSettings`** — the validator's `normalized` output is what `update` should receive. Raw `FormData.get(...)` values are strings; the store would persist them as strings and break round-trip.
- **`document.title` updates outside the settings subscriber** — D2-11 makes the subscriber the single seam. Don't sprinkle `document.title = ...` across UI modules.
- **`innerHTML` ANYWHERE in the new modules.** Phase 1's T-07 / V5 carry-over: only `textContent`, `.value`, `.checked`, and `dom.el({...attrs})` for new elements.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive store / observer | Custom event emitter, RxJS, Zustand-like | Native `Set<fn>` + synchronous fire — see Pattern A | Phase 1 mutate-in-place already proved a single subscriber per consumer is enough; D2-09 explicitly mandates no debounce/rAF in v1 |
| 12h↔24h conversion | `date-fns`, `dayjs`, `Intl.DateTimeFormat` | Native arithmetic — see Pattern I `to24h`/`to12h` | ~10 lines of pure arithmetic, no dep |
| Form serialization | A library | Native `new FormData(form)` + `.get(name)` | Already in Phase 1 manual-entry; reuse the same idiom |
| JSON schema validation | Zod, Joi, Ajv | Manual rules table — see Pattern F `RULES` | Pure-data RULES object + a 30-line dispatcher; zero deps; no future migration cost |
| Default-on-invalid policy | Custom error swallowing | Per-field default + `console.warn` — D2-22 explicit | Matches Phase 1 storage-local.js T-03 corrupted-blob policy |
| Object freeze checks | Custom `assertFrozen` | `Object.freeze(snap)` in `get()` | Browser-native; mutation attempts throw in strict mode |
| Migration framework | Knex-style migrations, Umzug | Tiny `migrateV1ToV2` pure function | Two versions, one direction — anything more is over-engineering |
| Focus management on second dialog | Custom focus trap | Native `dialog.showModal()` — already proven in Plan 01-04 | Free per browser native |

## Common Pitfalls

### Pitfall #1: Cross-store stale-write race

**What goes wrong:** Both `event-log.js` and `settings.js` keep an in-memory `db` constructed from a `storage.load()` at start-up. When event-log writes a new event (`db.events.push(); storage.save(db);`), its in-memory `db.settings` may be **stale** — the user could have called `settings.update(...)` between event-log's load and event-log's save, and event-log's now-overwriting-localStorage `db` carries the OLD settings.

**Why it happens:** The single-blob design (D-02 / D2-04) creates a shared-state coupling between the two stores. Each store thinks it owns the blob.

**Concrete failure scenario:**

1. App boots. Both stores load → both have `db.settings = {cutoverHour: 4, ...}`, `db.events = [...]`.
2. User opens Settings, changes `cutoverHour` to 6, Save. settings-store does `db.settings = {cutoverHour: 6}; storage.save(db)`. localStorage now reflects 6.
3. User clicks "Woke up". event-log appends to its in-memory `db.events`, calls `persist()` → `storage.save(db)` → but its `db.settings` is still `{cutoverHour: 4}` (stale!). localStorage now reflects 4 again. The settings-store's in-memory copy still thinks it's 6 until the next read.

**How to handle (Phase 2):**

- **Recommended: each store re-reads the OTHER slice from `storage.load()` immediately before its `save(db)`.** Pattern:

  ```javascript
  // js/store/event-log.js — persist()
  const persist = () => {
    const fresh = storage.load();
    if (fresh && fresh.version === 2) {
      db.settings = fresh.settings;       // pick up any cross-store updates
    }
    storage.save(db);
  };
  ```

  Mirror in `settings.js` for `db.events`. Cost: one extra `storage.load()` per save (~µs). Eliminates the race for the in-process single-tab case.

- **Acknowledge that this is partial.** Cross-tab is still racy (Pitfall #7 from Phase 1 RESEARCH carries over). Phase 8 (PWA hardening) can add BroadcastChannel.

- **Test it:** integration test `tests/integration/cross-store-race.test.js` — fake storage with shared `ls`, two stores, alternate writes, assert both slices survive.

**Warning signs:** A test that asserts settings persist across an event-log write but fails non-deterministically — this is it.

### Pitfall #2: `BUCKET_CONFIG.defaultCutoverHour` mutation temptation

**What goes wrong:** A developer (or executor agent) "fixes" Phase 2 by mutating `BUCKET_CONFIG.defaultCutoverHour` instead of wiring `settings.get().cutoverHour` at the call site. This breaks pure-logic callers (Phase 3 forecast engine that imports `daysBySubjectiveNight` directly) and the `Object.freeze` constraint (it would throw in strict mode).

**Why it happens:** `BUCKET_CONFIG.defaultCutoverHour = 4` looks like a "constant to update". The frozen constraint is documented in the file header but easy to miss.

**How to avoid:**

- D2-17 explicitly bans this. Planner's PLAN.md should call this out in the task's `<read_first>` and `<acceptance_criteria>` ("`BUCKET_CONFIG.defaultCutoverHour` MUST remain `4`; settings injection happens AT the `daysBySubjectiveNight` call site in `today-screen.js`").
- A unit test asserting `BUCKET_CONFIG.defaultCutoverHour === 4` after Phase 2 ships pins the invariant.

### Pitfall #3: Subscriber re-entry during fire

**What goes wrong:** A subscriber calls `settings.subscribe()` or `unsubscribe()` (returned from the previous subscribe) DURING its own callback. The `Set` iteration order then becomes implementation-defined.

**Why it happens:** Likely from `manual-entry.js`'s `apply(snap)` callback — when the modal closes mid-render-pass, the close logic might unsubscribe. Edge case but real.

**How to avoid:** Snapshot-then-iterate.

```javascript
update(patch) {
  // ...
  const subs = [...subscribers];          // snapshot — safe to mutate during fire
  for (const fn of subs) fn(next);
}
```

### Pitfall #4: 12 AM / 12 PM conversion edge

**What goes wrong:** Convention says 12:00 AM = 00:00 (midnight), 12:00 PM = 12:00 (noon), but the natural "h24 - 12" arithmetic produces wrong results at exactly 12.

**Why it happens:** Naïve implementation:

```javascript
// WRONG
const h12 = h24 % 12;          // 00 maps to 12 incorrectly (this gives 0, want 12)
const ampm = h24 >= 12 ? 'PM' : 'AM';
```

**How to avoid:** Use the explicit conditional (see `to12h` in Pattern I):

```javascript
const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
const ampm = h24 < 12 ? 'AM' : 'PM';
```

**Tests:** Pin the edge cases — h24=0 → 12 AM; h24=12 → 12 PM; h24=23 → 11 PM; h24=1 → 1 AM. A table-driven unit test catches every regression.

### Pitfall #5: XSS via `subjectName` text rendering

**What goes wrong:** `h1.innerHTML = subjectName` would let `<script>alert(1)</script>` in. Trivial — but easy to slip in.

**Why it happens:** Phase 1's hard rule is `textContent` only (T-07 / V5). Phase 2 introduces a new dynamic-text surface (the header) and a new template surface (`document.title = 'Nightwatch — ${name}'`). Both must be safe.

**How to avoid:**

- Header rendering: `h1.textContent = snap.subjectName;` — never innerHTML. Same idiom as Plan 01-03 today-screen.
- `document.title`: assigning a string with HTML entities is safe (the browser does not interpret HTML in the title bar) — but worth pinning with a unit test that asserts `document.title === 'Nightwatch — <b>name</b>'` literally renders the brackets.
- The validator's `maxlength="40"` AND its JS-side `maxLen: 40` rule limit blast radius.

### Pitfall #6: 24↔12 conversion of partially-entered manual-entry values

**What goes wrong:** User has the manual-entry modal open with HH=14 (24h mode). User toggles Settings → 12h → Save. The manual-entry's subscriber fires. Naïvely re-reading HH=14 and converting to 12h gives "2 PM" — but the input is `min="1" max="12"` after the toggle, so 14 is now invalid.

**Why it happens:** Two-input surfaces governed by the same settings key. Partial input is a legitimate state.

**How to handle:**

- Subscriber callback in `manual-entry.js` reads current HH+MM values, converts via `to12h` (which handles the integer cleanly: `to12h(14) → {h12: 2, ampm: 'PM'}`), writes back `hourInput.value = '2'` and a new `ampmInput.value = 'PM'`.
- If the value is out of range or partial (e.g., empty string), preserve the existing input value as-is and skip conversion.
- The clamp rule (HH=23 + toggle to 12h → HH=12, PM) is the user-facing recommendation from CONTEXT.md Discretion; conversion via `to12h(23) → {h12: 11, ampm: 'PM'}` already produces this naturally — no special clamping logic needed.

**Tests:** Integration test that drives the modal subscriber with a fake form element and asserts the conversion. E2E that opens modal, types HH=14, toggles 12h via Settings, asserts HH=2 + AMPM=PM.

### Pitfall #7: Save-then-Cancel discards partial edits — but not commits already made

**What goes wrong:** User opens Settings, changes 4 fields, clicks Save → modal closes. User opens Settings again, changes 1 field, clicks Cancel. The previous 4 are preserved (good); the new 1 is discarded (good). But the user might THINK Cancel also undoes the previous Save.

**Why it happens:** The modal is a "snapshot edit" surface but UX-wise users expect undo.

**How to handle in Phase 2:** Accept this as the documented behavior per D2-14 — Cancel discards CURRENT-session edits only. The Phase 5 export/import gives a manual restore path. A confirm-on-cancel-with-pending-edits would help, but D2-14 rules it out.

### Pitfall #8: Migration triggers on the wrong load path

**What goes wrong:** A future Phase 5 import accepts a v1 JSON file. It calls `storage.save(parsedV1Blob)` and reloads — the v1 blob hits storage. Next load triggers `migrateV1ToV2` → fine, no data loss. But if Phase 5 instead does `storage.save(parsedV1Blob); settings.update(...);`, settings-store reads stale localStorage (still v1) → migrates → and the import path's v1 is now silently v2. Not a Phase 2 problem, but worth documenting in the migration helper so Phase 5 knows the contract.

**How to handle:** Add a doc-comment in `migrateV1ToV2` stating "Idempotent on v2; throws on v3+. Phase 5 import callers MUST pass the parsed-and-migrated blob to both stores at composition time, not by re-loading after save."

## Runtime State Inventory

**Phase 2 introduces new runtime state.** Specifically:

| State Item | Source | Lifecycle | Migration concern |
|------------|--------|-----------|-------------------|
| `db.version === 2` | All Phase 2 saves | Persists in localStorage forever (until Phase 5 schema bump) | One-way: v1 → v2 silent, idempotent |
| `db.settings` (object) | settings-store and migrate | Persists in localStorage | Initialized via D2-03 DEFAULT_SETTINGS on first migration |
| `subscribers` (Set) | settings-store in-memory | Re-created on every app boot | None — pure runtime |
| Settings modal open state | DOM `<dialog id="settings">` | Per-open | None |

**Pre-existing state at Phase 2 start:** Phase 1 ships v1 blobs to Phase 2 dogfooders. The migration MUST be tested against:

- A populated v1 blob with multiple events (must survive intact).
- An empty v1 blob (`{version: 1, events: []}` → `{version: 2, settings: DEFAULTS, events: []}`).
- A null localStorage (fresh install → v2 with defaults).
- A corrupted blob (non-JSON) — `storage-local.js` already returns `null` here; the migration treats `null` as fresh install. ✓
- A v2 blob with missing `settings` key (hand-edit edge case) — migration should treat as "needs settings default injection" and proceed. Recommend explicitly testing this.
- A future v3 blob (defensive) — must throw, not silently downgrade.

## Environment Availability

**Unchanged from Phase 1.** All native browser APIs. `node:test` for the new unit + integration tests (`settings-validate.test.js`, `db-shape.test.js`, `settings-store.test.js`, `v1-to-v2-migration.test.js`, `cross-store-race.test.js`). Playwright for the new E2E (`settings-modal.spec.js`, `grouping-toggle.spec.js`).

**No new tooling installed.** Verify by running `node --test` after the new test files land; assert exit code 0.

## Validation Architecture

### Test Framework

Same as Phase 1 — `node:test` for unit + integration, `@playwright/test` for E2E. No new framework, no config-file changes (the existing `node --test` auto-discovers `**/*.test.js`).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| CFG-01 | Subject name persists; header reflects; document.title updates | unit (validator string rule), integration (store update + subscribe), E2E (header reflects after Save + after reload) | `unit/settings-validate.test.js`, `integration/settings-store.test.js`, `e2e/settings-modal.spec.js` |
| CFG-02 | max_delta persisted with bounds [5,120] | unit + integration | `unit/settings-validate.test.js`, `integration/settings-store.test.js` |
| CFG-03 | min_days persisted with bounds [1,90] | unit + integration | same |
| CFG-04 | autoOutlier toggle persists | unit + integration | same |
| CFG-05 | (DEFERRED to Phase 4) | — | none in Phase 2 |
| CFG-06 | windowDays persisted with bounds [3,90] | unit + integration | same |
| CFG-07 | statBlend ∈ {median, mean, blend} persisted | unit + integration | same |
| CFG-08 | cutoverHour persists; grouping toggle on Today re-buckets immediately | unit (validator integer rule), integration (settings.subscribe → today re-render), E2E (toggle to sleep-cycle, log event at cutover-straddling time, assert grouping changes) | `unit/settings-validate.test.js`, `integration/settings-store.test.js`, `e2e/grouping-toggle.spec.js` |
| CFG-09 | timeFormat persists; manual-entry picker shape changes; event-row times reformat | integration (formatTime helper), E2E (toggle 12h, assert manual-entry has AM/PM `<select>`) | `unit/time.test.js` (extended), `e2e/settings-modal.spec.js` |
| (cross) | v1→v2 silent migration preserves events | integration | `integration/v1-to-v2-migration.test.js` |
| (cross) | Cross-store stale-write race mitigated | integration | `integration/cross-store-race.test.js` |
| (cross) | Subscriber unsubscribe leaks prevented | integration | optional — `integration/settings-store.test.js` extension |
| (cross) | Per-field default-on-load with console.warn | unit + integration | `unit/settings-validate.test.js` (mode: 'load'), `integration/settings-store.test.js` (mock console) |
| (cross) | XSS-safe textContent in header + document.title | unit (DOM mock or jsdom-free `el` helper) + E2E | `e2e/settings-modal.spec.js` (subject name with HTML entities) |

### Nyquist Dimensions (1–8)

| Dim | Name | Phase 2 Coverage |
|-----|------|------------------|
| 1 | **Boundary tests** | validator: cutoverHour [0,23], maxDelta [5,120], minDays [1,90], windowDays [3,90], subjectName length 40. Time format: 12h boundary (12 AM, 12 PM). Migration: empty events, null blob, missing settings key. |
| 2 | **Integration tests** | settings-store + storage adapter (memory) round-trip; cross-store race via two-store wiring; manual-entry-modal time picker reconfiguration via subscriber; today-screen re-render via subscriber. |
| 3 | **Edge cases** | 23:58 in 12h mode (11:58 PM); empty subjectName (header shows blank h1, document.title falls back); cutoverHour=0 (subjective-night degenerates to calendar — sleep-cycle bucket key === calendar key); changing groupingMode while events are in flight. |
| 4 | **Error paths** | invalid blob → migration throws; v3+ blob → throws; out-of-range settings on load → default + console.warn (asserted); validator on save → errors[] surfaced inline; storage QuotaExceededError on settings save → propagates (Phase 5 export is recovery). |
| 5 | **State transitions** | v1 → v2 migration (idempotent on v2 re-load); subscriber registration/unregistration; modal open → save → close; modal open → cancel → close; grouping mode commit-on-click vs explicit Save. |
| 6 | **Side effects** | Whole-blob localStorage rewrite on every settings.update; subscribers fire synchronously; document.title updates; console.warn on per-field default-on-load. |
| 7 | **Observability** | `[nightwatch]` console.warn on invalid settings field; `[nightwatch]` console.info on v1→v2 migration; document.title reflects subjectName; aria-pressed on grouping toggle; aria-live on settings errors. |
| 8 | **Regression** | Phase 1 surface unchanged: log/edit/delete events, 7-day calendar grouping (with default cutoverHour=4 producing identical output to Phase 1 hardcoded 4), modal open/save/cancel, all existing tests pass. Pin via `e2e/regression-phase1.spec.js` — re-run Phase 1's E2E happy-path after Phase 2 lands. |

### Sampling Rate

- **Per-task commit:** `node --test` (~3-7s with the new tests; still in the fast-feedback band).
- **Per-wave merge:** `node --test && npx playwright test`.
- **Phase gate:** Full suite + a manual smoke against a dogfood v1 blob (sen.xlsx-derived) to confirm migration doesn't drop events.

## Security Domain

Phase 2 adds new attack surface — settings inputs from the user. Coverage:

| ASVS Category | New Phase 2 control |
|---------------|---------------------|
| V5 Input Validation | `validateSettings` (strict on save, default-on-load) covers every field; `maxlength=40` belt-and-suspenders on subjectName; integer bounds on all numerics; enum gates on groupingMode/timeFormat/statBlend. |
| V7 Errors & Logging | `console.warn` on per-field invalid (load); migration log via `console.info`; `<output aria-live="polite">` for save-time errors. Never silently swallowed. |
| V8 Data Protection | Settings persist alongside events in localStorage — same on-device-only contract. No new transmission. The schema bump preserves D-09's network-free invariant. |
| V11 Business Logic | Cross-store stale-write race acknowledged + mitigated (Pitfall #1). Migration idempotency tested (Pitfall #8). 12 AM / 12 PM conversion correctness pinned (Pitfall #4). |

**Phase 2 threat-model table** (for the planner's `<threat_model>` block per step 5.55):

| Pattern | STRIDE | Severity | Phase 2 mitigation |
|---------|--------|----------|--------------------|
| XSS via subjectName injection | Tampering | medium | textContent only (header h1); document.title is HTML-inert; maxLen 40 |
| Cross-store stale-write race (intra-process) | Tampering (self) | medium | re-read other slice immediately before save (Pitfall #1) |
| Cross-tab settings divergence | Tampering | low | Same as Phase 1 (acknowledged limitation; Phase 8 BroadcastChannel) |
| Settings load corruption | Tampering | low | Per-field default + console.warn (D2-22) |
| Migration replay attack via dev tools edit | Tampering | low | Migration is one-way + idempotent on v2; v1 edit by user produces same outcome |
| Storage quota exhaustion via maxlength bypass | DoS | very low | maxlength=40 belt; validator caps subjectName at 40; settings payload is ~150 bytes vs MB-sized events |

**Block on: high severity.** No high-severity issues — Phase 2 is offline, single-subject, no network, no auth, no third parties. Mediums are mitigated as described.

## Open Questions for Planner

1. **Where do `DEFAULT_SETTINGS` live?** Three candidates: `js/store/settings.js` (current CONTEXT.md D2-03 wording), `js/lib/db-shape.js` (recommended — avoids circular import with `settings-validate.js`), or a tiny dedicated `js/lib/settings-defaults.js`. Planner pick. Recommend `db-shape.js`.
2. **Validator `mode: 'load'` vs `mode: 'save'` API shape.** Option A: same function, mode parameter. Option B: two exports (`validateSettingsStrict`, `validateSettingsLenient`). Recommend A — single source of rules, mode-based branching.
3. **Cross-store stale-write race mitigation.** Re-read-before-write at every save vs. read-modify-write-with-version-counter. Recommend re-read (simpler, sub-µs cost, matches the spirit of D-02's whole-blob model).
4. **Manual-entry modal subscriber behavior when 24↔12 toggle fires mid-edit.** Re-render-and-convert (recommended) vs. clear-and-reset (simpler but data-losing). Recommend convert.
5. **Settings modal Save handler — call `validateSettings` once or twice?** UI Save handler must call it for visible-failure rendering. `settings.update()` could also call it as defense-in-depth. Recommend twice (mirrors `event-log.editEvent`'s re-round on save).
6. **`tests/integration/cross-store-race.test.js` — should this be a Plan unit-test or integration-test boundary?** Recommend integration (it tests two stores composed against the same memory adapter).
7. **Where does the grouping-toggle quick-button live in the DOM?** D2-16 says "above the day list, mirrored in Settings". Settings modal already has it under Time & Day. The Today screen needs a new sibling element between the quick-log row and the day list. Recommend a `<div class="groupingToggle">` mounted by today-screen.js between `quickLog` and `dayList`.

## Phase Plan Outline

**Recommended slicing for MVP mode — 6 plans across 3 waves.** Each plan is a vertical slice (test → pure logic → store/UI wiring) where possible.

| Plan | Wave | Objective | Requirements | Depends on |
|------|------|-----------|--------------|------------|
| **02-01** | 1 | Defaults + validator pure logic | (foundation for all) | — |
| **02-02** | 1 | `db-shape.js` + v1→v2 migration helper (+ migration integration test) | cross-cutting infra | 02-01 (imports defaults) |
| **02-03** | 2 | Settings store + composition wiring + event-log schema bump | infra; covers persistence half of CFG-01..09 (sans CFG-05) | 02-01, 02-02 |
| **02-04** | 2 | Header strip + Settings modal markup + settings-modal.js + subject-name UX | **CFG-01** (full E2E); modal Save/Cancel/validation surface for CFG-02..04, CFG-06..09 | 02-03 |
| **02-05** | 3 | Cutover wiring + grouping-mode toggle on Today (THE MVP-CRITICAL USER STORY) | **CFG-08** (full E2E — the phase goal sentence) | 02-04 |
| **02-06** | 3 | Time format propagation (formatTime + manual-entry 12h picker) | **CFG-09** (full E2E); finishes the rendered-surface contract | 02-04, 02-05 |

**Why this slicing:**

- **Wave 1 (02-01, 02-02)** is pure-logic foundation — TDD-friendly, parallel-safe, no UI. Both plans are unit-testable in isolation, satisfy D2-24 strict-TDD-for-pure-logic.
- **Wave 2 (02-03, 02-04)** wires the store and UI shell. 02-03 ships the store + migration (CFG-02..04, 06..09 persisted but invisible — still verifiable via integration test). 02-04 ships the visible shell (header + modal) and the CFG-01 user-story.
- **Wave 3 (02-05, 02-06)** ships the two cross-cutting reactive surfaces. 02-05 is the MVP user-story (CFG-08 cutover + grouping toggle — the phase goal sentence). 02-06 finishes CFG-09 by wiring the time format into the three render surfaces.

**Plan 02-05 is the MVP-critical plan.** Plans 02-01..04 set the table; 02-05 delivers the user-story payoff and would still be a shippable phase on its own (CFG-08 + the modal would satisfy the spirit of the phase goal). 02-06 (time format) is parallel polish.

**Each plan must include:**
- `<read_first>` listing the source files being touched + the CONTEXT.md decisions being honored (D2-XX cited).
- `<acceptance_criteria>` with concrete test commands (`node --test tests/unit/settings-validate.test.js` exits 0; `node --test tests/integration/v1-to-v2-migration.test.js` exits 0; etc.) and source assertions (`js/store/settings.js` exports `createSettingsStore`; `js/lib/db-shape.js` exports `migrateV1ToV2`).
- `<threat_model>` block per the security gate (step 5.55) — the per-plan subset of the table in §Security Domain.
- `must_haves.truths` citing cross-cutting decisions (D2-08, D2-22, D2-17, etc.) so the decision coverage gate (step 13a) passes.
- Frontmatter with the `requirements_addressed` list (CFG-XX values).
- CFG-05 must appear in EXACTLY ONE plan's frontmatter as `requirements_addressed: [CFG-05]` with an `<action>` like "Mark CFG-05 as deferred to Phase 4 (per CONTEXT.md D2-01) — no implementation; this plan exists solely to satisfy the requirements-coverage gate." Recommend attaching this stub to Plan 02-01 (the foundation plan) so it ships with the smallest blast radius. **Without this stub, the Requirements Coverage Gate (step 13) will block.**

## RESEARCH COMPLETE

Six-plan, three-wave outline targeting CFG-01..04 + CFG-06..09 (8 in-phase requirements) with CFG-05 explicitly deferred as a one-line stub in Plan 02-01. The MVP-critical thread (cutover hour + grouping toggle) lands in Plan 02-05; subject name lands in 02-04; everything else rides along. Plans 02-01 + 02-02 are pure-logic TDD foundation. All seven Pitfalls have a recommended mitigation. All Nyquist Dimensions 1–8 have a test home. The schema bump + settings store + subscriber pattern + 12h picker are all wiring of established Phase 1 seams — no new technology, no new dependency, no new framework decision.
