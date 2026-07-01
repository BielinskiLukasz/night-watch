# Phase 2: Configuration & Settings - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can open a Settings dialog from a gear icon in the app header,
edit eight configuration values (subject name, day-cutover hour, view
grouping mode, time format, automatic outlier detection toggle, max_delta,
min_days, rolling-window length, statistical blend), see those changes
survive reload, and (for the visible-in-UI subset) see Today screen react
immediately on Save.

This phase also lays the persistence + UI infrastructure every later
configurable feature will extend:

- A second store (`js/store/settings.js`) that mirrors the event-log
  adapter pattern from Phase 1 (D-06, D-07)
- A v1 → v2 schema migration on the single `nightwatch:db` localStorage
  blob (silently injects default settings; existing event data preserved
  unchanged)
- A header strip above the quick-log row (subject name on the left, gear
  icon on the right) — first UI element outside the day-list region
- The Settings modal — second `<dialog>`-based modal in the app (manual-
  entry is the first); reuses Plan 01-07's `<output aria-live="polite">`
  inline error surface
- A grouping-mode toggle on the Today screen above the day list,
  mirrored in Settings — same persisted value, two entry points
- A subscriber notification mechanism on the settings store so the Today
  list + open modals re-render immediately when settings change on Save

In scope: all of CFG-01..04 and CFG-06..09 (8 requirements). CFG-05 (per-
day "rejected" toggle) stays in Phase 4 with the History screen. The
prediction-tuning settings (CFG-02 max_delta, CFG-03 min_days, CFG-06
window, CFG-07 blend) and CFG-04 (auto outlier toggle) ship as stored-
but-inert values — Phase 3 forecast engine is the first consumer.

Explicitly out of scope (own phases): forecast engine + Today predictions
(Phase 3), History screen + CFG-05 rejected-toggle (Phase 4), CSV/JSON
import-export (Phase 5), Stages (Phase 6), Charts/Accuracy/nav (Phase 7),
PWA/manifest/service worker/file:// hardening/GitHub Pages deployment/
final theming (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Scope & defaults

- **D2-01: All 8 CFG-* requirements ship in Phase 2.** CFG-01 (subject
  name), CFG-02 (max_delta), CFG-03 (min_days), CFG-04 (auto outlier
  toggle), CFG-06 (window), CFG-07 (stat blend), CFG-08 (day cutover),
  CFG-09 (time format). CFG-05 (per-day rejected toggle) stays in Phase 4
  per the REQUIREMENTS.md traceability table.
- **D2-02: Stored-but-inert fields are honest about their state.** CFG-02,
  CFG-03, CFG-04, CFG-06, CFG-07 have no in-app consumer until Phase 3.
  They are persisted to `db.settings` and editable in the modal but no
  Phase 2 code reads them. The Settings modal must not pretend they have
  an immediate effect. Phase 3's forecast engine is the planned consumer.
- **D2-03: First-load defaults follow the spreadsheet conventions.**
  ```js
  Object.freeze({
    subjectName:  '',          // empty — header shows nothing until set (CFG-01)
    cutoverHour:  4,           // CFG-08, matches Phase 1 D-18
    groupingMode: 'calendar',  // preserves Phase 1 D-11 baseline
    timeFormat:   '24h',       // CFG-09 default
    autoOutlier:  false,       // CFG-04, off until Phase 3 engine ships
    maxDelta:     30,          // minutes; CFG-02
    minDays:      7,           // CFG-03
    windowDays:   7,           // CFG-06
    statBlend:    'median',    // CFG-07
  })
  ```
  These exact values land in `js/store/settings.js` as a frozen
  `DEFAULT_SETTINGS` constant (project `Object.freeze` convention).

### Persistence contract

- **D2-04: Settings live inside the existing `nightwatch:db` blob.** The
  canonical JSON shape (D-04) extends to:
  ```json
  {
    "version": 2,
    "settings": {
      "subjectName": "Alice",
      "cutoverHour": 4,
      "groupingMode": "calendar",
      "timeFormat": "24h",
      "autoOutlier": false,
      "maxDelta": 30,
      "minDays": 7,
      "windowDays": 7,
      "statBlend": "median"
    },
    "events": [ ... ]
  }
  ```
  Phase 5 JSON export round-trips both settings and events losslessly.
  This is the load-bearing invariant the Phase 5 import contract assumes.
- **D2-05: Schema bump v1 → v2 with silent auto-migration.** Phase 1's
  `createEventLog` throws on `db.version !== 1`. Phase 2 raises the
  expected version to 2 and adds a migration path: when `load()` returns
  a v1 blob (no `settings` key), inject `DEFAULT_SETTINGS`, bump
  `version` to 2, and persist on the next save (lazy persist — no
  spurious write at load time if the user never opens Settings). No
  toast, no prompt, no first-run banner. `console.info` may log the
  migration for diagnostics; production-visible UI is silent.
- **D2-06: localStorage value === canonical JSON (preserved).** D-05
  remains a load-bearing invariant. The v2 blob the storage adapter
  persists is the same byte-for-byte payload Phase 5 will export.

### Settings store & adapter seam

- **D2-07: New `js/store/settings.js` mirrors the event-log pattern.**
  Constructor signature: `createSettingsStore({ storage, defaults? })`.
  Returns `{ get(): SettingsSnapshot, update(patch): SettingsSnapshot,
  subscribe(fn): unsubscribe }`. `get()` returns an `Object.freeze`'d
  snapshot so callers cannot mutate the in-memory copy.
- **D2-08: Settings and event-log share one storage adapter.** Both
  stores receive the same `createStorageLocal('nightwatch:db')` instance
  at the composition root, but neither reads the other's section. The
  event-log keeps writing `{ version: 2, settings, events }` after
  Phase 2 — the merge happens because both stores call `load()` /
  `save(db)` on the same adapter and pass the full blob through. The
  composition root in `js/app.js` is the only place that orchestrates
  this; the two stores stay independent in their public APIs. The
  planner picks whether to introduce a thin shared `db-shape.js` helper
  or have each store own the merge for its own slice.
- **D2-09: Subscriber/observer for reactive re-render.** `settings.subscribe(fn)`
  fires `fn(newSnapshot)` synchronously after every successful `update()`.
  Today screen, manual-entry modal (when open), and any future reactive
  consumer call `subscribe` at mount and unsubscribe at unmount.
  Synchronous, single-threaded — no debounce, no `requestAnimationFrame`
  batching in v1; profile in dogfooding before adding complexity.

### Settings UI

- **D2-10: Header strip above quick-log row.** New top-level element in
  `index.html`: `<header class="appHeader">` containing a left-aligned
  `<h1 class="subjectName">` and a right-aligned `<button class="settingsTrigger"
  aria-label="Settings">` rendered as a gear icon (inline SVG, no external
  asset). Empty subject name = empty `<h1>` (header still renders for layout
  stability; gear stays visible).
- **D2-11: `document.title` reflects subject name.** When
  `subjectName !== ''`, `document.title = 'Nightwatch — {name}'`; otherwise
  `'Nightwatch'`. Update happens on settings-store subscriber fire. Satisfies
  the "across all screens" reading of CFG-01 success criterion 1 in a way
  that survives the future History/Charts/Accuracy screens (Phase 7) without
  rewiring.
- **D2-12: Native `<dialog>` modal mirrors manual-entry.** Settings modal
  lives in `index.html` as a sibling of the manual-entry dialog. Same
  mechanics: `showModal()` from JS, `<form method="dialog">` with explicit
  `[Cancel]` and `[Save]` buttons in a `<menu>`, ESC and `[Cancel]` discard
  pending edits via `dialog.close()` with empty returnValue, `[Save]` uses
  `value="save"` so the close-handler can branch on returnValue. Focus trap
  + aria-modal are free from the native primitive (Plan 01-04 RESEARCH §Pattern 6).
- **D2-13: Three-section modal layout, no welcome nudge.** Fieldset/legend
  pattern groups fields:
  ```
  Profile           : subject name
  Time & Day        : day cutover, view grouping, time format
  Forecast tuning   : auto outlier, max_delta, min_days, window, blend
  ```
  No first-load banner / no "Welcome — confirm your settings" prompt. Defaults
  are populated on first open; user discovers the gear visually. (Optionality
  for a Phase 2 dogfooding follow-up if discoverability is poor.)
- **D2-14: Explicit Save / Cancel; inline error surface reused.** Save
  validates all fields, gathers errors into a `{field, message}[]` array, and
  renders them into a `<output id="settingsErrors" aria-live="polite">` block
  immediately below the form (mirroring Plan 01-07's `manualEntryErrors`
  pattern byte-for-byte). On validation failure, the dialog stays open and
  focus moves to the first errored field. On success, store.update() fires,
  subscribers re-render Today + document.title, dialog closes.

### Cutover-hour behavior

- **D2-15: Grouping-mode toggle controls the Today list view.** New value:
  `groupingMode ∈ { 'calendar', 'sleepCycle' }`. The Today screen reads
  `eventLog.daysByCalendar(7)` when `'calendar'`, or
  `eventLog.daysBySubjectiveNight(settings.get().cutoverHour, 7)` when
  `'sleepCycle'`. Both bucketer functions already exist (D-08). Default is
  `'calendar'` to preserve Phase 1 D-11 baseline; the user opts into
  subjective-night.
- **D2-16: Quick-toggle on Today, mirrored in Settings.** Today screen gains
  a new inline control above the day list — a two-button group or `<select>`
  (planner's call) labeled `View: [Calendar] [Sleep cycle]`. Clicking the
  inactive option fires `settings.update({groupingMode: ...})` and the
  store's subscriber chain re-renders the day list immediately (no Save
  needed for this control — it commits instantly because there's nothing to
  preview). The same value is also editable in the Settings modal under
  "Time & Day"; both surfaces stay in sync because they read/write the same
  store. The grouping-mode commit-on-click is the **only** exception to the
  D2-14 explicit-Save policy; the rationale is that the user is "previewing"
  the layout effect — committing instantly is the preview.
- **D2-17: Phase 1 D-18 wiring change, not a logic change.** The day-
  bucketer's `cutoverHour` parameter is already the seam. Phase 2 just
  injects `settings.get().cutoverHour` instead of the hardcoded `4`. The
  `BUCKET_CONFIG.defaultCutoverHour = 4` constant in `lib/day-bucket.js`
  stays put as the fallback for pure-logic callers and for cold-start
  before settings have loaded.

### Time format propagation

- **D2-18: 24h / 12h toggle applies everywhere visible, instant on Save.**
  Three render surfaces are governed by `timeFormat`:
  1. Event row `<time class="eventTime">` in `today-screen.js` — `hhmm(evt.at)`
     is replaced by a `formatTime(evt.at, timeFormat)` helper.
  2. Manual-entry modal time picker — when `timeFormat === '12h'`, the HH
     `<input type="number" min="0" max="23">` becomes HH `min="1" max="12"`
     plus a `<select>` AM/PM dropdown. Internal storage stays canonical
     `'YYYY-MM-DDTHH:MM'` (24h ISO); the UI is the only place 12h appears.
  3. Day headers — currently show `day.date` (`'YYYY-MM-DD'`). Phase 2 may
     keep the ISO date or switch to a locale-aware format; planner picks,
     but the choice is `timeFormat`-independent (24h vs 12h is about the
     clock, not the calendar).
- **D2-19: On Save, settings-store subscribers re-render the affected
  surfaces.** Today screen re-renders the day list; if the manual-entry
  modal is open, it re-renders its time picker (preserving any partially-
  entered values by reading the form values, converting through the new
  format, and writing them back). The Settings modal closes after Save.
- **D2-20: 12h picker uses HH 1–12 + AM/PM dropdown, no native `<input
  type="time">`.** Mirrors the Phase 1 D-14 rationale for the 24h picker.
  Browser inconsistency on `step="300"` (5-minute) and on 12h locale-aware
  rendering of `<input type="time">` makes the manual three-control
  approach the only consistent option. AM/PM `<select>` has values `'AM'`
  and `'PM'`. Internal conversion: 12 AM → 00, 12 PM → 12, 1–11 PM → 13–23.

### Validation

- **D2-21: Bounds (strict on Save).**
  - `subjectName`: string, trimmed, max length 40 (arbitrary practical cap)
  - `cutoverHour`: integer ∈ [0, 23]
  - `groupingMode`: enum ∈ `{ 'calendar', 'sleepCycle' }`
  - `timeFormat`: enum ∈ `{ '24h', '12h' }`
  - `autoOutlier`: boolean
  - `maxDelta`: integer ∈ [5, 120] (minutes)
  - `minDays`: integer ∈ [1, 90]
  - `windowDays`: integer ∈ [3, 90]
  - `statBlend`: enum ∈ `{ 'median', 'mean', 'blend' }`
- **D2-22: Out-of-range or wrong-type values on load → reset to default +
  `console.warn`.** Per-field. Sleep events in the same blob are NOT
  affected — settings hygiene is isolated from event hygiene. This is the
  field-level analogue of Phase 1's T-03 corrupted-blob policy (Plan 01-05
  storage-local.js): defensive on read, fail-loud on save. Matches the
  user's preference for "no magic transformation" over clamp-to-nearest.
- **D2-23: Validation lives in a pure helper.** `js/lib/settings-validate.js`
  exports `validateSettings(input): { ok, errors[], normalized }`. Called
  from both the Save handler (UI) and the settings-store loader (which
  applies defaults to invalid fields rather than rejecting the whole blob).
  Mirrors Plan 01-07's pure `validate(input, {now})` pattern.

### Testing & TDD discipline

- **D2-24: TDD applies to all pure-logic modules.** `js/lib/settings-validate.js`,
  `js/store/settings.js` (the merge + subscribe logic), and the v1→v2
  migration helper are all red→green→refactor. UI modules
  (`js/ui/settings-modal.js`, `js/ui/header.js`, today-screen.js's grouping-
  toggle + 12h time picker changes) follow the Phase 1 test-after-with-E2E
  pattern.
- **D2-25: Migration is exercised by an integration test.** `tests/integration/
  v1-to-v2-migration.test.js` — wire `createStorageLocal` with a fake `ls`
  pre-populated with a canonical Phase 1 v1 blob; assert that
  `createEventLog` + `createSettingsStore` co-load successfully, the settings
  default to D2-03 values, the events are intact, and the next `save()`
  emits a v2 blob.
- **D2-26: Settings round-trip is exercised by integration tests.**
  Tests assert: edit → save → reload → values match; invalid value in blob
  → field resets to default with console.warn (captured); subscriber fires
  once per `update()` call.
- **D2-27: E2E coverage for every CFG-* requirement.** Per the D-22 coverage
  matrix from Phase 1. CFG-01 has both an E2E (header reflects entered name)
  and a document.title assertion. CFG-08 + grouping-mode has an E2E that
  toggles to sleep-cycle, logs an event at the cutover-straddling time, and
  asserts the day-grouping changes. CFG-09 has an E2E that toggles 12h and
  asserts the modal picker shape changes.

### Claude's Discretion

- File-internal API shape of `js/lib/settings-validate.js` (return type,
  helper sub-functions) — planner picks the cleanest split.
- Whether the v1→v2 migration helper lives in `js/store/settings.js`,
  `js/lib/db-shape.js`, or inside `createSettingsStore` — planner picks.
- Exact SVG glyph for the gear icon — any minimal viewBox-24 outline,
  inline in `index.html` to avoid an external asset.
- Grouping-mode toggle on Today screen: two `<button>` elements with
  `aria-pressed` vs a single `<select>` vs `<input type="radio">` — UI taste.
- CSS for header strip, gear placement, section fieldsets, modal width on
  mobile — calm/minimal aesthetic, Phase 8 will re-theme.
- Whether to emit the `console.info` migration log under a `[nightwatch]`
  prefix (recommendation: yes — matches the existing storage-local.js
  warning prefix).
- Manual-entry modal's behavior when settings change while it is open: the
  recommendation is to re-render its time picker via the subscriber callback,
  preserving partially-typed HH/MM values by converting through the new
  format. Planner has latitude on edge cases (e.g., what to do if the user
  had "23" in the hour field and toggled to 12h — recommended: clamp to 12
  + set PM).
- Default to `<select>` over `<input type="number">` for `statBlend` — but
  any consistent control works.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — full project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — CFG-01..09 definitions + traceability;
  note CFG-05 stays in Phase 4
- `.planning/ROADMAP.md` § Phase 2 — phase boundary, depends-on (Phase 1),
  4 success criteria
- `CLAUDE.md` — repo conventions (no dependencies, no build, REQ-IDs in
  commits, `Object.freeze` configs, multi-file architecture, day-boundary
  is configurable cutover not midnight)

### Phase 1 — load-bearing decisions Phase 2 extends
- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — D-01..D-22. The
  ones Phase 2 builds directly on: D-02 (single-blob localStorage),
  D-04 (canonical JSON shape — extended to v2 here), D-05 (blob ===
  canonical JSON), D-06 (`js/` module layout), D-07 (adapter interfaces),
  D-08 (two bucketer views), D-11 (calendar-default — Phase 2 preserves
  it as `groupingMode` default), D-13 / D-14 (modal pattern), D-18
  (cutover hour parameter already in bucketer), D-19..D-22 (testing
  scaffold). Plan 01-07's inline-error pattern is reused for the
  Settings modal.
- `.planning/phases/NW-01-log-persist/01-RESEARCH.md` — Patterns 2
  (storage adapter), 5 (mutate-in-place store), 6 (native `<dialog>`).
- `.planning/phases/NW-01-log-persist/01-PATTERNS.md` — implementation
  patterns inherited.
- `.planning/phases/NW-01-log-persist/VERIFICATION.md` — Phase 1 PASS
  evidence; confirms the seams Phase 2 is about to extend are working.

### Source code (Phase 1 — extension points)
- `js/app.js` — composition root; Phase 2 wires `createSettingsStore`
  here and passes the snapshot/subscribe API into UI mounts
- `js/store/event-log.js` — `SCHEMA_VERSION` constant + the throw-on-
  unsupported-version guard. Phase 2 raises the expected version to 2
  and adds the migration.
- `js/lib/day-bucket.js` — `BUCKET_CONFIG.defaultCutoverHour = 4` is
  the seam Phase 2 wires `settings.get().cutoverHour` into via the
  call site, NOT by mutating the constant
- `js/ui/today-screen.js` — extend with the grouping-mode quick-toggle,
  subscribe to settings store, swap `daysByCalendar` ↔
  `daysBySubjectiveNight` based on mode, format times via the new
  `formatTime(at, timeFormat)` helper
- `js/ui/manual-entry.js` — extend HH/MM picker to support 12h mode +
  AM/PM dropdown; reuse the inline-error pattern for Settings modal
- `js/adapters/storage-local.js` — unchanged; settings-store reuses the
  same `createStorageLocal('nightwatch:db')` instance
- `index.html` — add `<header class="appHeader">`, add the Settings
  `<dialog id="settings">` as a sibling of `<dialog id="manualEntry">`
- `style.css` — add header strip + gear icon + Settings modal styling

### Reference app
- `../mindful-breathing/` — `Object.freeze` config pattern; modal
  mechanics; same offline-first philosophy. Read for inspiration on the
  calm/minimal styling Phase 2 should aim for (final theme is Phase 8).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 1)

- **`createStorageLocal(key, ls?)`** — accepts injected `ls` for tests.
  Settings-store reuses the same instance the event-log uses; both
  read/write the same `nightwatch:db` blob.
- **Native `<dialog>` modal + Plan 01-07 inline-error pattern.**
  Settings modal copies the exact mechanics: `<form method="dialog">`,
  explicit Save (`value="save"`) / Cancel buttons, `<output
  aria-live="polite">` for inline errors, ESC and Cancel discard via
  empty returnValue.
- **`daysByCalendar(events, limit?)` and `daysBySubjectiveNight(events,
  cutoverHour, limit?)`** — both already implemented and tested.
  Grouping-mode toggle is a wiring change, not a logic change.
- **`Object.freeze`'d `BUTTONS` / `EVENT_LABEL` pattern from Plan 01-08.**
  Settings options that map to enums (statBlend, timeFormat, groupingMode)
  should follow the same single-source-of-truth pattern.
- **Composition root in `js/app.js`** — the only place adapters are
  constructed. Phase 2 extends it with `createSettingsStore` and threads
  the snapshot/subscribe API into `mountTodayScreen` and (when opened)
  `openManualEntry`.
- **`tests/` structure (unit/integration/e2e) + CI workflow.** Reused
  unchanged. Phase 2 adds test files; the workflow file is not touched.
- **`scripts/` directory** — Phase 1 added a security-smoke gate; same
  approach can extend to Phase 2 (no new gate needed but pattern is
  there).

### Established Patterns to honor

- No npm runtime dependencies (devDependencies only — Playwright)
- ESM modules with `<script type="module">`; same files import in Node
- Pure logic split from side effects via adapter seams
- `Object.freeze` for config / defaults / enums
- 5-minute precision at log/edit time (preserved through 12h conversion —
  internal canonical format is unchanged)
- REQ-IDs in commit messages (`feat(NW-02): CFG-08 day cutover wiring`)
- TDD red→green→refactor for pure logic and integration; UI test-after
  with E2E regression guard
- D-22 coverage matrix — every shipped requirement has at least one test

### Integration Points

- `js/app.js` composition root extends with settings-store wiring; the
  store is passed into `mountTodayScreen` and `mountHeader`
- `js/store/event-log.js` is updated for the v2 schema version bump and
  delegates settings-section parsing to the settings-store (or shared
  helper — D2-08)
- `js/ui/today-screen.js` subscribes to settings; re-renders on change;
  swaps bucketer call based on grouping mode; formats times via helper
- `js/ui/manual-entry.js` subscribes to settings; re-renders HH/MM picker
  shape when 24h ↔ 12h toggles while modal is open
- `index.html` gets a new `<header>` element + a new `<dialog id="settings">`
- `tests/integration/` adds `v1-to-v2-migration.test.js` + settings
  round-trip tests
- `tests/e2e/` adds settings-modal.spec.js covering Save/Cancel/validation/
  CFG-01-header-display/CFG-08-grouping/CFG-09-12h-picker

</code_context>

<specifics>
## Specific Ideas

- **Phase goal vs scope tension.** The phase goal as written in ROADMAP.md
  is narrowly the cutover hour ("day-grouping matches our household's
  actual sleep cycle, not a hardcoded default"). The user explicitly chose
  to ship all 8 CFG-* requirements anyway. The planner should treat the
  cutover hour + grouping-mode toggle as the MVP-critical thread (Today-
  screen-visible, satisfies the user-story sentence) and the prediction-
  tuning fields as parallel work that lands in the same modal.
- **The user explicitly requested a "View: Calendar | Sleep cycle"
  quick-toggle on Today, mirrored in Settings.** This is an extension of
  CFG-08 surface — same persisted value, two entry points. It is the
  ONLY field that commits-on-click rather than waiting for Save; rationale
  is that the user is "previewing" the cutover effect and committing
  instantly IS the preview.
- **The user did NOT want a welcome nudge / onboarding banner.** Defaults
  are populated on first open; user discovers the gear icon visually. If
  Phase 2 dogfooding reveals poor discoverability, that's a follow-up.
- **The user picked spreadsheet conventions for defaults.** All numeric
  defaults (cutover=4, max_delta=30, min_days=7, window=7) match the
  sen.xlsx workflow; blend=median; auto-outlier=off; format=24h. These are
  the defaults Phase 3 will inherit.
- **The user weighed user-friendliness explicitly twice** ("which is more
  user friendly?" between Save/Cancel vs save-on-blur, and between
  clamp-on-load vs default-on-load). Both times the answer favored "no
  magic transformation" / "explicit commit moments" / "consistent with
  existing patterns." Planner should bias toward the same when ambiguity
  arises during execution.

</specifics>

<deferred>
## Deferred Ideas

- **CFG-05 per-day "rejected" toggle** — Phase 4 (with History screen).
  CFG-04 auto-outlier toggle in Phase 2 stores a boolean; the actual
  outlier-detection logic lands later.
- **CFG-04 outlier detection engine** — Phase 3 (with forecast engine
  consumers of the toggle).
- **7-day list-window length as a Phase 2 setting** — Phase 1 deferred
  this candidate (D-15). Not included in Phase 2. Could become a 10th
  setting if dogfooding shows 7 days is wrong.
- **Cutover-hour explainer tooltip / first-load welcome nudge** — not
  shipped. Phase 2 candidate if discoverability proves poor in dogfooding.
- **Multi-profile switching (CFG2-01)** — v2. The settings shape has a
  single `subjectName` field; v2 will need to migrate to an array of
  profiles + an active-profile pointer. The schema bump from v1→v2 here
  paves the way for the same migration pattern at v2→v3.
- **Polish-language UI (PLAT2-02)** — v2. CFG-09 24h/12h toggle is
  locale-style but not localization.
- **Day-header locale-aware formatting** — Phase 2 may keep ISO
  YYYY-MM-DD as the day header; Phase 7 may revisit when charts/heatmap
  introduce locale-aware date rendering.
- **Auto-detected life stages (PRED2-01)** — v2; manual stages are
  Phase 6 (STAGE-01, STAGE-02).
- **Settings export as a separate file** — rejected in favor of the
  embedded `db.settings` approach (D2-04). Could resurface if Phase 5
  dogfooding shows users want to share settings across devices without
  sharing data.

</deferred>

---

*Phase: 2-Configuration & Settings*
*Context gathered: 2026-05-27*
