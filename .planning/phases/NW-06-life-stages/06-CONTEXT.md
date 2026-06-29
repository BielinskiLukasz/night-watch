# Phase 6: Life Stages - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the life stages capability. By the end of this phase, the user can:

1. **Create stages** — add named date-range stages (e.g., "Dropped second nap", "Started daycare") in a new "Stages" section inside the Settings modal, with an inline add/edit form and a list of existing stages.
2. **Edit and delete stages** — each stage row shows [Edit] / [Delete] affordances; editing reveals an inline form; deleting shows a confirmation dialog consistent with Phase 4's delete pattern.
3. **Select a stage on Today** — a `<select>` dropdown appears on the Today screen (only when stages exist) with an "All data" option plus each stage by name; the selection is persisted across reloads.
4. **Scope forecasts to the current stage** — when a stage is selected, the forecast engine receives only `dayRecords` within that stage's date range; if the filtered set has fewer than `min_days` days, the app falls back to all data and shows a brief note.
5. **Auto-import stages from CSV** — the `etap` column in the CSV file auto-creates stage objects; each consecutive run of the same etap value becomes one stage with auto-detected startDate/endDate.

Phase 6 does NOT include:
- Charts, heatmap, or accuracy dashboard (Phase 7)
- Automatic change-point detection for stage boundaries (out of scope for v1 — manual only)
- Per-stage settings (windowDays, statBlend, etc.) — all settings remain global; stages filter the data only
- Stage export as a separate CSV (deferred; stages are included in the JSON export via `db.settings.stages`)

</domain>

<decisions>
## Implementation Decisions

### Data Model

- **D6-01:** Stages are stored as an array in `db.settings.stages: Array<{ id, name, startDate, endDate }>`. This reuses the settings store's existing `get/update/subscribe/replace` APIs without any new store changes. Consistent with the `rejectedDays` array-in-settings pattern from Phase 4.

- **D6-02:** The currently selected stage is persisted as `db.settings.activeStageId: string | null`. `null` means "All data" (no stage filter). On page load, the selector restores from `activeStageId`; if the ID refers to a deleted stage, silently fall back to `null`.

- **D6-03:** Stage object shape:
  ```js
  {
    id: string,          // Date.now().toString() — consistent with id.js
    name: string,        // user-supplied label
    startDate: string,   // YYYY-MM-DD
    endDate: string|null // YYYY-MM-DD, or null = open-ended (through today)
  }
  ```

- **D6-04:** Stage IDs are generated via `Date.now().toString()` — the same pattern as `id.js`. No UUID library needed; the number of stages a user will ever create is in the single digits.

- **D6-05:** A `null` `endDate` means "through today": the forecast filter includes all days from `startDate` up to and including the current date. The stage is still "ongoing."

### Stage Boundary Rules

- **D6-06:** Overlapping date ranges are allowed. When a new or edited stage is saved and its range overlaps an existing stage, show a warning: "This range overlaps with '[other stage name]'. Continue?" with Save / Cancel buttons. No hard block — user can proceed.

- **D6-07:** CSV import reads the `etap` column (if present). Consecutive rows with the same non-empty `etap` value are grouped into one stage: `startDate` = the date of the first row in the run; `endDate` = the date of the last row in the run (or `null` if it's the final run in the file). Stage `name` = the `etap` value as a string.

- **D6-08:** Non-consecutive runs of the same `etap` value each become separate stage objects. E.g., rows 1–30 with `etap = "1"`, rows 31–60 with `etap = "2"`, rows 61–90 with `etap = "1"` → three stage objects, not two. Preserves the spreadsheet's actual stage boundaries.

### Stage Selector UX on Today

- **D6-09:** The stage selector is **hidden entirely** when `settings.stages` is empty. The Today screen looks exactly like Phase 5 until the first stage is created. No "Add stages in Settings" hint required.

- **D6-10:** When stages exist: on page load, restore the last persisted `activeStageId` from settings. If `null` → select "All data". If the ID no longer exists → fall back to "All data" (set `activeStageId = null`) silently.

- **D6-11:** When a stage is selected but has fewer than `min_days` valid days: fall back to all data for the forecast computation. Show a small note near the selector: *"Not enough data in this stage — showing all data."* The forecast cards and hero card render normally using the all-data set.

- **D6-12:** The "no filter" option in the dropdown is labeled **"All data"**.

### Stage CRUD UI

- **D6-13:** Stage list and all CRUD (add, edit, delete) lives **entirely in the Settings modal** — a new "Stages" fieldset appended after the existing Import/Export section. No new tab or dedicated screen needed.

- **D6-14:** Add/Edit uses an **inline form row** directly inside the stage list, not a nested dialog (avoiding the nested-modal InvalidStateError risk noted in `settings-modal.js`). Clicking "Add stage" inserts a new inline row with name + startDate + endDate inputs and Save / Cancel buttons. Clicking [Edit] transforms the stage row into an inline form. On Save, the row collapses back to display mode.

- **D6-15:** Deleting the currently selected stage: reset `activeStageId` to `null` silently after the delete confirmation. The Today screen falls back to "All data" on next render. No second confirmation prompt for the "currently selected" case.

- **D6-16:** Stage list columns: **Name | Start | End | Actions**. "End" cell shows "ongoing" (or equivalent text) when `endDate` is `null`. Actions cell contains [Edit] / [Delete] buttons.

### Claude's Discretion

- **Overlap warning copy:** Exact wording and button labels for the "This range overlaps with…" warning dialog.
- **Inline form styling:** Layout of the name + startDate + endDate input row within the Settings modal; alignment with existing fieldset styles.
- **Delete confirmation copy:** Wording of the stage-delete confirmation dialog (consistent with Phase 4 row-delete pattern D4-06).
- **"Ongoing" cell label:** Whether to display "ongoing", "—", "present", or a date that reads as today for open-ended stages.
- **Selector placement on Today:** Exact DOM position of the stage `<select>` relative to the quick-log buttons and next-event card (above or below the hero card but before the forecast grid — Claude decides what fits cleanest).
- **Fallback note styling:** Exact HTML/CSS treatment of the "Not enough data in this stage — showing all data" note under the selector.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Full project context, constraints, key decisions. Specifically: file-as-truth storage, no npm runtime dependencies, Object.freeze configs, TDD discipline.

- `.planning/REQUIREMENTS.md` — Phase 6 requirements: STAGE-01 (mark date ranges as named stages), STAGE-02 (scope forecast to current stage). Traceability table maps both to Phase 6.

- `.planning/ROADMAP.md` § Phase 6 — Phase boundary, three success criteria, depends on Phase 5.

- `CLAUDE.md` — Repo conventions: TDD discipline, REQ-IDs in commits, no npm runtime dependencies, Object.freeze config objects, no direct DOM innerHTML.

### Prior phase decisions (load-bearing for Phase 6)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — D-04 (canonical JSON blob shape), D-06 (layered module structure), D-07 (adapter seams), D-19–D-22 (testing scaffold).

- `.planning/phases/NW-02-configuration-settings/02-CONTEXT.md` — D2-04 (settings in `db.settings`), D2-07 (`createSettingsStore()` API — get/update/subscribe), D2-05 (lazy-persist rule), D2-09 (subscribers fire synchronously on update).

- `.planning/phases/NW-03-forecast-engine-today-screen/03-CONTEXT.md` — D3-01..D3-05 (forecast algorithm), D3-07 (Today screen layout), D3-09 (cold-start gate).

- `.planning/phases/NW-04-history-screen-edit-delete/04-CONTEXT.md` — D4-06 (delete confirmation dialog pattern), D4-14 (`settings.rejectedDays` — same array-in-settings pattern Phase 6 follows for `stages`).

- `.planning/phases/NW-05-data-import-export/05-CONTEXT.md` — D5-01 (Settings modal structure, Import/Export section at the bottom — Phase 6 appends Stages section after it), D5-13/D5-14 (blob shape with settings + events + activityLog — Phase 6 adds nothing to the blob shape beyond `settings.stages` and `settings.activeStageId`).

### Source code (integration points)

- `js/lib/db-shape.js` — `DEFAULT_SETTINGS` (Phase 6 adds `stages: []` and `activeStageId: null` defaults), `migrateV1ToV2()` (Phase 6 adds forward-compat injection for blobs predating Phase 6, same pattern as `activityLog` injection in Phase 5).

- `js/store/settings.js` — `createSettingsStore({ storage })` — no changes needed; `update(patch)` handles any new settings fields. `replace(blob)` handles JSON import restoring stages.

- `js/lib/forecast.js` — `forecast(dayRecords, settings)` — Phase 6 adds a `filterDayRecordsByStage(dayRecords, settings)` pure helper that the caller in `today-screen.js` invokes before passing `dayRecords` to `forecast()`. The `forecast()` function signature is unchanged.

- `js/ui/today-screen.js` — Phase 6 adds the stage selector `<select>` element and a `renderStageSelector(stages, activeStageId, onChange)` function. The selector is only rendered when `stages.length > 0`. Change handler calls `settings.update({ activeStageId })` then re-runs forecast.

- `js/ui/settings-modal.js` — Phase 6 adds a "Stages" fieldset with the stage list table and inline add/edit form. Reuse the existing modal structure and section patterns.

- `js/lib/csv-parse.js` — Phase 6 extends the CSV parser to detect and read the `etap` column, returning a `stages` array alongside the existing `{ events, rejectedDays, activityLog, errors }` return shape.

- `js/app.js` — Composition root. Phase 6 wires the stage selector's onChange to `settings.update()` and ensures forecast re-computation subscribes to settings changes (already done via `settings.subscribe()` from Phase 3).

### Domain / data schema

- `sen.xlsx` column mapping (in `.planning/PROJECT.md` § Context) — The `etap` column in Sheet 2 "Prognoza" is the source for auto-created stage objects. Phase 5 CSV parser already handles Sheet 1 "Dane" columns; Phase 6 extends it to also read `etap` from the "Prognoza" sheet or whatever column the real CSV exposes. **Researcher should verify which sheet the `etap` column actually appears in and whether it's in the existing CSV export.**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`js/lib/db-shape.js` — `DEFAULT_SETTINGS`**: Phase 6 adds `stages: []` and `activeStageId: null` to the default settings object. The forward-compat injection pattern in `migrateV1ToV2()` (see `activityLog: {}` injection added in Phase 5) is the exact model for injecting these two new fields into existing Phase 5 blobs.

- **`js/store/settings.js` — `createSettingsStore`**: No API changes needed. `update({ stages: [...] })` and `update({ activeStageId: id })` work with the existing store. The `replace()` method correctly restores stages from a JSON import.

- **`js/lib/settings-validate.js`**: Phase 6 needs to add validation for `stages` (must be an array; each entry must have `id`, `name`, `startDate` as non-empty strings; `endDate` is a string or null) and `activeStageId` (must be null, or a string that is in the stages IDs array). Uses the same `mode:'load'` / `mode:'save'` pattern.

- **`js/ui/settings-modal.js` — existing fieldsets**: Stage CRUD section (fieldset 4) follows the same section structure as Profile / Time & Day / Forecast Tuning / Import-Export. Inline form row is new UI territory but simpler than the existing `<dialog>` pattern.

- **`js/ui/today-screen.js` — `renderForecastSection`**: Phase 6 extends `mountTodayScreen()` to pass filtered `dayRecords` (stage-scoped) to `renderForecastSection()`. The stage selector mounts above or alongside the quick-log buttons; `renderForecastSection` is unchanged.

- **`js/lib/csv-parse.js`**: The existing return shape `{ events, rejectedDays, activityLog, errors }` needs a `stages` field added. The `etap` column detection follows the same fuzzy-header-match pattern added in Phase 5.

- **Phase 4 delete confirmation pattern (D4-06)**: Stage delete uses `window.confirm()` — consistent with History screen row deletion.

### Established Patterns

- **Array-in-settings for per-day or per-stage data**: `rejectedDays: string[]` (Phase 4) proves the pattern. `stages: Stage[]` follows identically.
- **Pure-logic modules with adapter seams**: `filterDayRecordsByStage(dayRecords, settings)` belongs in `js/lib/forecast.js` or a new `js/lib/stages.js` — zero DOM, zero I/O, fully unit-testable with `node:test`. The UI layer reads `settings.get()` and calls the filter before invoking `forecast()`.
- **`Object.freeze` for config**: Any frozen config table (e.g., column-name → field mapping for `etap` detection) follows this pattern.
- **Reactive updates via subscribers**: `settings.subscribe()` already wires forecast re-computation on every settings change (Phase 3). The stage selector's onChange calls `settings.update({ activeStageId })`, which fires all subscribers, which triggers forecast re-render. No new subscription wiring needed.
- **TDD discipline**: Stage filter logic and `etap` column parsing are pure → strict RED→GREEN→refactor. Selector DOM wiring and inline form interactions → E2E Playwright tests.
- **Security invariants**: All dynamic stage names rendered via `textContent`, never `innerHTML`. Inline form inputs set via `.value =`, never string interpolation into HTML.

### Integration Points

- **`js/app.js`**: The composition root creates the settings store and passes it to `mountTodayScreen()`. Phase 6 ensures `mountTodayScreen()` also receives the ability to read/update `activeStageId`. This is already available via the settings store — no new composition root wiring required.
- **`js/lib/csv-parse.js` return value**: Phase 5's `parseCSV()` returns `{ events, rejectedDays, activityLog, errors }`. Phase 6 adds `stages: Stage[]` to this return. The CSV import handler in `settings-modal.js` needs to call `settings.update({ stages })` alongside `eventLog.replace()` and `settings.replace()`.

</code_context>

<specifics>
## Specific Ideas

- **Primary use case for stages**: The user's existing `sen.xlsx` has an `etap` column that manually marks developmental periods. The Phase 6 CSV import auto-creates stages from this column so the user doesn't need to re-enter them manually after migration. This is the main motivation for the feature.

- **Scoping forecasts to a stage**: The killer use case is comparing predictions across stages — e.g., "when my child was in Stage 2 (dropped 2nd nap), what were the wake/bedtime patterns?" Selecting Stage 2 from the Today dropdown immediately re-computes forecasts using only that period's data.

- **Stage selector is an `<select>` element**: The ROADMAP says "a dropdown on the Today screen." Use a native `<select>` — consistent with the Settings modal's existing form inputs and works without JS libraries.

- **Stage data is already exported**: Because stages live in `db.settings.stages`, the Phase 5 JSON export (`{ version: 2, settings: {...}, events: [...], activityLog: {} }`) automatically includes stages in the settings payload. JSON round-trip (DATA-02) works without changes.

</specifics>

<deferred>
## Deferred Ideas

- **Per-stage forecast settings** (windowDays, statBlend, maxDelta per stage): Not in Phase 6. All forecast settings remain global. Stages only filter the input `dayRecords`. A future phase could add per-stage overrides.
- **Stage visualization on charts/heatmap** — showing stage boundary markers on the sleep-length chart. Phase 7 is the natural home since charts don't exist yet.
- **Auto-detected stage boundaries** via change-point detection — PRED2-01 in v2 requirements. Manual stages in v1 (STAGE-01 requirement constraint is explicit).
- **Stage-scoped accuracy metrics** — showing accuracy within a specific stage on the Accuracy screen. Phase 7 work.
- **Exporting stages as a separate CSV** — stages are in the JSON export; a standalone CSV export of stages is not needed in v1.

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Life Stages*
*Context gathered: 2026-06-29*
