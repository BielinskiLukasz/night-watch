# Phase 1: Log & Persist - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can log sleep events (wake, bedtime, nap start, nap end) using
one-tap quick-log buttons or a manual-entry form, see those events grouped
by day on a single scrollable screen, edit or delete them, and find them
intact after a browser reload.

This phase also establishes the foundational architectural scaffold that
every later phase extends:
- ESM module layout with a layered structure (`lib/`, `store/`, `adapters/`, `ui/`)
- Adapter seams for storage, system clock, and DOM so business logic can be
  exercised in Node without a browser
- The full testing pyramid — unit (`tests/unit/`, `node:test`), integration
  (`tests/integration/`, `node:test`), end-to-end (`tests/e2e/`, Playwright
  dev-only) — wired up in a single GitHub Action
- TDD as the working discipline (strict red→green→refactor for pure logic
  and integration; UI test-after with E2E regression guard)

In scope: 4 quick-log buttons, manual entry / edit / delete via modal,
day-grouped event list (last 7 days), localStorage persistence, and the
testing scaffold above.

Explicitly out of scope (own phases): Settings UI (Phase 2), prediction
engine (Phase 3), full History screen with rejected-toggle (Phase 4), CSV
/ JSON import-export UI (Phase 5), stages (Phase 6), charts / accuracy
(Phase 7), service worker / PWA manifest / file:// hardening / GH Pages
deployment / visual theming (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Data model & storage schema

- **D-01: Event-log shape, append-only at log time.** Each logged event is a
  flat record with shape `{ id, type, at }` where `type ∈ { 'wake', 'bedtime',
  'napStart', 'napEnd' }` and `at` is a wall-clock ISO timestamp (e.g.
  `'2026-05-26T03:50'`). Day records are *derived* on read by the day-bucketer,
  not stored. This preserves event-level precision and survives schema
  evolution; CSV import (Phase 5) expands each row into up to 4 synthetic
  events.
- **D-02: Single-blob localStorage.** One key — `nightwatch:db` — holds the
  entire JSON-serialized event log plus a top-level `version` field. Whole
  blob is rewritten on each mutation. Math: ~80 bytes/event × 4 events/day ×
  3 650 days (10 yr) ≈ 1.2 MB, comfortably under the 5–10 MB per-origin
  localStorage limit. IndexedDB explicitly *not* used in v1 (PROJECT.md
  rationale: avoidable complexity at this scale; adapter seam leaves the
  door open for a later swap with no other code changes).
- **D-03: Mutate-in-place for edits and deletes.** Editing a logged event
  rewrites its `at` field; deleting removes it from the array. No audit
  trail, no tombstones, no correction events — the shape exported in
  Phase 5 stays clean. Trade-off acknowledged: no "what did I change
  yesterday?" history; not a v1 requirement.
- **D-04: Canonical JSON shape.**
  ```json
  {
    "version": 1,
    "events": [
      { "id": "e1", "type": "wake",     "at": "2026-05-25T06:35" },
      { "id": "e2", "type": "napStart", "at": "2026-05-25T13:20" },
      { "id": "e3", "type": "napEnd",   "at": "2026-05-25T14:05" },
      { "id": "e4", "type": "bedtime",  "at": "2026-05-25T22:10" }
    ]
  }
  ```
  This is the contract Phase 5 import/export must round-trip. Event `id`s
  are stable, opaque strings (the storage adapter mints them — no specific
  scheme locked here; planner picks `crypto.randomUUID()` or a counter).
- **D-05: localStorage value === canonical JSON.** The localStorage blob is
  byte-for-byte identical to what JSON export will emit in Phase 5. This
  symmetry means import = "write the blob, reload the in-memory model" and
  is a load-bearing invariant.

### Module layout & adapter seams

- **D-06: Layered module structure under `js/`.**
  ```
  js/
    app.js                # composition root — wires adapters into store and ui
    lib/
      time.js             # pure: roundTo5(date), formatHHMM(date), parseHHMM(string)
      day-bucket.js       # pure: bucketEventsByDay(events, cutoverHour) → day records
      id.js               # pure: newEventId()
    store/
      event-log.js        # add/edit/delete event; query subjective-day records; query calendar-day records
    adapters/
      storage-local.js    # real: read/write the nightwatch:db blob
      storage-memory.js   # test: in-memory object
      clock-system.js     # real: () => new Date()
      clock-fixed.js      # test: factory(frozenDate)
    ui/
      today-screen.js     # renders buttons + day-grouped list
      manual-entry.js     # modal form for add/edit
      dom.js              # tiny helpers, NOT a framework
  ```
- **D-07: Adapter interfaces are minimal and explicit.**
  - `StorageAdapter` → `{ load(): DB | null, save(db: DB): void }`
  - `ClockAdapter` → `{ now(): Date }`
  - Adapters are injected at the composition root (`js/app.js`); no global
    singletons, no module-level `localStorage` / `Date.now()` references
    outside the adapter files themselves. This is the seam integration
    tests (PLAT-09) exploit.
- **D-08: Two day-grouping views over the same event log.** `store/event-log.js`
  exposes both:
  - `daysByCalendar(events)` — groups by the `at` field's calendar date (UI uses this)
  - `daysBySubjectiveNight(events, cutoverHour)` — groups by the cutover-aware
    bucketer (Phase 3+ forecast/stats engine uses this)
  Both are pure functions on top of the event log. Two views over one source
  of truth; **do not conflate them**.
- **D-09: No framework, no build step.** Module files are loaded with
  `<script type="module">` in `index.html`. Same files import in Node via ESM
  `import`. Dev server is just `python -m http.server` or equivalent (no
  install). PWA hardening (service worker, manifest) explicitly deferred
  to Phase 8.

### Today screen UX

- **D-10: Single scrollable screen for Phase 1.** Top: 4 large quick-log
  buttons in a horizontal row (`Woke up`, `Sleep`, `Nap start`, `Nap end`).
  Below: day-grouped event list, newest day first, last 7 calendar days
  visible by default; older days are simply not rendered (no pagination
  control yet — that's Phase 4's territory). Bottom of list: a `+ Add event`
  button that opens the same modal as `[edit]`.
- **D-11: Day grouping uses calendar dates, not subjective-night dates.** At
  03:50 the screen header reads "Today — Tue 26 May" (the calendar date),
  not "Mon 25 May" (the subjective-night date). User explicitly chose this
  — matches the wristwatch / phone clock. The forecast engine in Phase 3
  will use subjective-night bucketing under the hood; the planner MUST NOT
  conflate the two.
- **D-12: Per-event affordances inline.** Every rendered event row shows
  `HH:MM  <Event type>  [edit] [×]`. Click `[edit]` → modal pre-filled.
  Click `[×]` → confirm dialog → delete.
- **D-13: Modal dialog for Add and Edit.** Manual entry uses a modal
  overlay with fields: Date (native `<input type="date">`), Hour (number
  input 0–23), Minute (number input 0–55 stepping by 5), Event type
  (dropdown of the 4 types). Save validates, rounds the minute to 5 if
  user typed a non-5-multiple, and dispatches add-or-edit to the store.
- **D-14: Two-number time picker (HH + MM).** No native `<input type="time">`
  — browser inconsistency on `step=300` (5-minute) makes it unreliable.
  Two number inputs give us full control and consistent behavior across
  Chrome / Firefox / Safari. Minute input rendered with `step="5"` and
  validated/rounded on save regardless of what the user types.
- **D-15: 7-day default for the list.** Last 7 calendar days shown.
  Configurable display-window length is **not** a Phase 1 setting — could
  become one in Phase 2 if dogfooding shows it's needed.

### Day-boundary log-time behavior

- **D-16: Wall-clock timestamp stored, day derived on read.** Clicking
  "Woke up" at 03:50 stores `{ type: 'wake', at: '2026-05-26T03:50' }`.
  The day-bucketer is the *only* place that applies the cutover hour, and
  it does so for forecast/stats consumers (Phase 3). The UI groups by
  calendar date directly off `at`, no cutover involved. Changing the
  cutover hour later (Phase 2 setting) just re-runs the bucketer; no
  event data is rewritten.
- **D-17: No special UI hint about the cutover at log time in Phase 1.** The
  user picked "show calendar date always" — implying they don't want a
  tooltip explaining the cutover. If dogfooding reveals confusion, a hint
  can be added in Phase 2 alongside the cutover-hour Settings control.
- **D-18: Cutover hour default is 04:00 but unsettable in Phase 1.** Phase 1
  hardcodes the cutover at 04:00 wherever the bucketer is invoked (which is
  nowhere user-visible in Phase 1, since calendar-day grouping is used for
  the list). Phase 2 introduces CFG-08 to make it user-configurable. The
  day-bucketer signature already takes `cutoverHour` as a parameter so
  Phase 2 is a wiring change, not a logic change.

### Testing & TDD discipline

- **D-19: Tests live under `tests/` with three sub-trees.**
  - `tests/unit/` — pure-logic tests (`node:test` + `node:assert`). Every
    function in `js/lib/` and the pure portions of `js/store/event-log.js`
    is covered. Strict TDD red→green→refactor.
  - `tests/integration/` — wire the store with `storage-memory` and
    `clock-fixed` adapters; assert end-to-end data flow without a browser
    (e.g., "calling addEvent('wake') with clock=06:33 yields an event with
    at=06:35, persisted to the memory storage, and visible via
    daysByCalendar"). Strict TDD.
  - `tests/e2e/` — Playwright drives a real Chromium against
    `index.html` served by a transient local HTTP server (Playwright's
    built-in `serve` or a 5-line `node http-server.js`). At minimum:
    click each quick-log button, verify the event appears, reload the
    page, verify persistence. Test-after for UI code, but the suite must
    cover every shipped LOG-* requirement.
- **D-20: `package.json` is dev-only.** Has `devDependencies` (Playwright
  and only Playwright in v1), zero `dependencies`. The deployed PWA bundle
  on GitHub Pages contains no `package.json`, no `node_modules/`, no JS
  imports outside the project's own `js/` directory. A `.gitignore` rule
  excludes `node_modules/`. A future build/deploy step (Phase 8) will
  filter `package.json`, `tests/`, and config files out of the deployed
  asset set.
- **D-21: One GitHub Action runs the whole suite on push and PR.**
  - Steps: checkout → install Node (built-in to GH Actions runner) →
    `npm ci` (only to fetch Playwright) → `npx playwright install --with-deps`
    → `node --test tests/unit tests/integration` → `npx playwright test`.
  - The same workflow file is reused unchanged through Phase 8.
- **D-22: Coverage acceptance criterion.** Every LOG-* and DATA-04
  requirement landing in Phase 1 has at least one automated test (unit,
  integration, or E2E) covering it. The `gsd-verifier` agent will check
  this in the verify step.

### Claude's Discretion

- Event `id` minting scheme — `crypto.randomUUID()` is the default
  recommendation (available in all modern browsers + Node 18+), but the
  planner can substitute a monotonic counter if a stronger ordering
  guarantee proves useful. Either way the `id` is opaque to consumers.
- Exact CSS / visual styling of buttons, list rows, modal — out of scope
  for the discussion; theming lands in Phase 8.
- Concrete file names within sub-folders beyond what's listed in D-06 —
  planner has latitude as long as the layered structure is preserved.
- Whether `tests/integration/` uses a single shared composition helper
  (e.g. `makeTestApp()`) or per-test wiring — planner picks the cleaner
  pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (load-bearing decisions)
- `.planning/PROJECT.md` — full project context, constraints, key decisions
  (including the newly added testing decisions and zero-runtime-dependency
  constraint)
- `.planning/REQUIREMENTS.md` — v1 requirements LOG-01..09, DATA-04, and
  the testing requirements PLAT-08..11; traceability table maps them to
  Phase 1
- `.planning/ROADMAP.md` § Phase 1 — phase boundary, depends-on, success
  criteria 1–9
- `CLAUDE.md` — repo-level conventions (no dependencies, no build, REQ-IDs
  in commits, Object.freeze configs, secure-context-only APIs)

### Reference app
- `../mindful-breathing/` — single-file vanilla PWA; the inspiration. Read
  for: ESM module patterns, `Object.freeze` config, `requestAnimationFrame`
  loops, secure-context-only browser APIs, service worker structure
  (relevant in Phase 8, not now)

### Source dataset (data-model anchor)
- `.planning/PROJECT.md` § Context — translated `sen.xlsx` column schema
  ("Dane" sheet). The Phase 1 event-log shape must be expand-able from
  these columns when Phase 5 CSV import lands.

No additional ADRs or external specs exist yet. Decisions D-01..D-22 above
are the authoritative source for Phase 1.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

None inside this repository yet — Phase 1 is the first code-producing
phase. The reference app `../mindful-breathing` is read-only inspiration
(separate project, not a dependency).

### Established Patterns (project-wide, to be honored from Phase 1 onward)

- **No npm runtime dependencies** — only `devDependencies` (Playwright).
- **ESM modules everywhere** — `<script type="module">` in HTML,
  `import` statements only. No `require`, no CommonJS, no bundler.
- **Pure logic separated from side effects** — adapters wrap every
  side-effecting API (`localStorage`, `Date.now()`, `document`).
- **`Object.freeze` for config objects** — inherited from
  `../mindful-breathing`.
- **5-minute precision everywhere** — both at log time (clicking a button
  rounds `clock.now()` to 5 min) and at display.
- **REQ-IDs in commit messages** — e.g., `feat(NW-01): LOG-01,LOG-02 quick-log buttons`.

### Integration Points

- The `js/app.js` composition root is the *only* place adapters are
  instantiated and wired. Phase 2+ extend this file (adding settings
  store + adapter) rather than scattering side effects.
- The `daysByCalendar` and `daysBySubjectiveNight` functions in
  `store/event-log.js` become the two read-paths every later phase
  consumes — Today screen, History (Phase 4), forecasts (Phase 3),
  charts (Phase 7) all build on these.
- The `tests/` tree and the GitHub Action workflow file established here
  are extended (not replaced) by every later phase's tests.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants TDD to be the default development style.
  Plans for Phase 1 should be structured with explicit "write failing
  test" → "implement" subtasks where it makes sense (pure logic and
  integration paths). UI subtasks may be implemented and then covered by
  an E2E test, per the user's "lighter TDD for UI" choice.
- The user pushed back on the original `localStorage`-only sketch by
  asking whether IndexedDB was feasible without a backend; they accepted
  the localStorage recommendation after seeing the storage-budget math.
  Implication: when later phases challenge the storage shape, run the
  numbers again and revisit the IndexedDB option behind the adapter seam
  rather than treating localStorage as immutable.
- The user explicitly chose "show calendar date always" for the day
  label, against the recommendation of also showing a cutover hint. This
  is a deliberate UX simplicity bet — surfaces a calendar-day vs
  subjective-night split inside the data model that the planner must
  preserve.
- Reference app `../mindful-breathing` is the *vibe* anchor (calm, dark,
  minimal, ambient) but Nightwatch gets its own visual identity in Phase 8.
  Phase 1 styling should be functionally clean but not yet themed.

</specifics>

<deferred>
## Deferred Ideas

- **Configurable cutover hour as a Settings field** — Phase 2 (CFG-08).
  Phase 1 hardcodes 04:00 as the default value passed to the bucketer.
- **Audit trail / undo for edits** — out of v1 scope; mutate-in-place is
  the v1 choice. Could resurface in v2 if dogfooding reveals a need.
- **Configurable list-window length on Today screen** — Phase 2 candidate
  if 7 days proves wrong in dogfooding.
- **Cutover-hour explainer tooltip** — Phase 2 candidate if the
  calendar-vs-subjective-night split confuses the user.
- **Service worker, manifest, `file://` hardening, GitHub Pages deploy,
  custom theme** — all Phase 8.
- **CSV import → event-log expansion logic** — Phase 5. The Phase 1
  canonical JSON shape is the contract Phase 5 must round-trip.
- **Auto outlier detection logic** — Phase 2 (CFG-04 toggle) and likely
  Phase 3 (where the rolling-window stats live).
- **IndexedDB migration** — only if dataset crosses ~3 MB; storage
  adapter seam from D-07 makes this a one-file swap.

</deferred>

---

*Phase: 1-Log & Persist*
*Context gathered: 2026-05-26*
