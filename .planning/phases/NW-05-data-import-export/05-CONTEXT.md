# Phase 5: Data Import/Export - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the data import/export capability. By the end of this phase, the user can:

1. **Export** the full dataset as a dated JSON file downloaded via the browser — one click from the History screen toolbar.
2. **Import** a previously exported JSON file — full lossless round-trip, restoring both events and settings; accessed from the Settings modal.
3. **Import** a CSV file matching the known column schema (translated from `sen.xlsx`) — also from Settings modal; replaces all events; supports the initial seed-from-spreadsheet workflow.
4. The **exported JSON is treated as canonical truth**; localStorage is a rebuildable cache. DATA-05 is fully realized.

Phase 5 does NOT include:
- Charts, heatmap, or accuracy dashboard (Phase 7)
- Manual life-stage boundaries (Phase 6)
- Direct `.xlsx` import (out of scope for v1 — user converts to CSV one-time)
- Activity logging UI (activity data is imported from CSV and stored, but not yet surfaced in any UI screen — that is Phase 7)

</domain>

<decisions>
## Implementation Decisions

### Import/Export UI Placement

- **D5-01: Import controls live in the Settings modal.** The existing gear-icon modal gains an "Import / Export" section. This keeps the destructive import action behind an intentional UI step (open Settings → scroll to section → pick file), reducing the risk of accidental data replacement.

- **D5-02: Export is a persistent button on the History screen toolbar.** Export is a frequent, safe action; it deserves a short path. A small "Export JSON" button (or link) appears at the top of the History table alongside the data it backs up. The user reviews history → decides to export → one click.

- **D5-03: Import is NOT on the History toolbar.** Because import is destructive (replaces all current events), it stays behind the gear icon. Consistent with Phase 4's principle: per-row delete shows a confirmation dialog; import — a bulk delete — belongs in Settings.

### CSV Import Behavior

- **D5-04: CSV import replaces all existing events.** Full state replacement for events — consistent with file-as-truth (DATA-05). After a CSV import, the events array in localStorage is exactly what the CSV contained. Settings (maxDelta, windowDays, rejectedDays loaded from the CSV's odrzucone column, etc.) are set per the decisions below; they are NOT carried over from the previous session.

- **D5-05: Nap columns are optional — missing nap = no nap event.** Rows with empty nap-start and/or nap-end produce a day record with no nap events. Consistent with LOG-09 (at most one nap per day) and the existing dataset where not every day has a nap.

- **D5-06: Aggregate/computed columns are silently ignored.** Rolling averages, medians, sleep-length variants, rolling activity scores, and other derived columns are not imported. Only the raw event times are kept: date, wake, bedtime, nap-start, nap-end, rejected flag, and activity score. Computed values are re-derived by the app on first load.

- **D5-07: The `odrzucone` column is imported and populates `settings.rejectedDays`.** Rows marked as rejected in the CSV are added to the `settings.rejectedDays` array (array of YYYY-MM-DD date strings, same format as D4-14). This preserves the user's existing manual curation from the spreadsheet — forecasts exclude those days immediately on first import.

### CSV Format Parsing

- **D5-08: Date format is auto-detected.** Both DD.MM.YYYY (Polish/European Excel default) and YYYY-MM-DD (ISO) are supported. Parser checks the format of the first parseable date cell: three dot-separated segments → DD.MM.YYYY; three dash-separated segments → YYYY-MM-DD.

- **D5-09: CSV delimiter is auto-detected.** Check the first line: if it contains more semicolons than commas, use semicolons (Polish/European Excel "Save As CSV" default); otherwise use commas (standard CSV). No user configuration required.

### Import Error Handling & Feedback

- **D5-10: Bad rows are skipped with a summary.** Rows with a missing required field (date or wake time), an unparseable time, or a date that cannot be resolved are skipped. After import, a summary is shown: e.g., "147 days imported, 3 rows skipped (rows 5, 22, 89 — invalid time format)." The import proceeds with all valid rows; the user is not forced to fix the CSV before proceeding.

- **D5-11: Successful import shows a count summary only.** After a clean import (zero skipped rows), show a brief dismissible message: "Import complete — 152 days loaded." No full preview required. Gets out of the way quickly.

- **D5-12: A confirmation dialog is shown before replacing data.** Before the import writes to localStorage, show: "This will replace all current events. Continue?" (with "Import" / "Cancel" buttons). Consistent with Phase 4's per-row delete confirmation pattern (D4-06). Applies to both CSV and JSON import.

- **D5-13: JSON import restores everything — events AND settings.** The full blob `{ version: 2, settings: {...}, events: [...] }` is written to localStorage. This includes subject name, maxDelta, windowDays, statBlend, cutoverHour, timeFormat, rejectedDays — everything. True file-as-truth restore; no partial application.

### Export Scope & Format

- **D5-14: JSON export includes the full blob.** Exports `{ version: 2, settings: {...}, events: [...] }` — the canonical db-shape.js v2 format. Includes events AND settings (subject name, all thresholds, rejectedDays, etc.). Re-importing the file is a complete restore.

- **D5-15: Exported filename is date-stamped.** Format: `nightwatch-YYYY-MM-DD.json` (e.g., `nightwatch-2026-06-28.json`). Allows the user to keep multiple dated backups and immediately identify the most recent. Uses today's date at export time.

- **D5-16: JSON is pretty-printed (indented).** `JSON.stringify(blob, null, 2)`. Human-readable so the user can open it in a text editor, inspect records, or manually fix issues if needed. File size is negligible at this data volume (a few months of daily records ≈ a few KB).

### Activity Data

- **D5-17: Activity data is imported from CSV and stored as `db.activityLog`.** The `Aktywność` column contains a numeric score per day. It is stored as a separate top-level field in the canonical JSON blob: `db.activityLog: { 'YYYY-MM-DD': number }`. This keeps activity out of the events array (which carries only timestamped sleep events) and preserves a clean v2 migration path. Phase 7 reads `db.activityLog` for correlation charts. If a CSV row has no activity value, the date is simply absent from `db.activityLog`.

### Claude's Discretion

- **Visual layout of the Import/Export section in the Settings modal:** Where in the modal it appears (top vs. bottom of the scrollable section), whether Import CSV and Import JSON are separate buttons or one file picker that accepts both, the exact section heading. Choose the layout that fits cleanest with the existing settings-modal structure.
- **Confirmation dialog copy:** Exact wording, button labels, and visual treatment of the destructive-import confirmation.
- **Export button styling on History toolbar:** Appearance (icon + label? text link? small button?) and placement relative to any existing History screen controls.
- **Schema version handling on JSON import:** If the imported JSON has `version > 2`, show a user-visible error ("Incompatible file — this file was exported from a newer version of Nightwatch.") rather than throwing silently. If `version < 2`, run `migrateV1ToV2` before importing (already implemented in db-shape.js).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Full project context, constraints, key decisions. Specifically: file-as-truth storage, no npm runtime dependencies, File API for import/export, no direct .xlsx import, 5-minute precision, calm aesthetic.

- `.planning/REQUIREMENTS.md` — Phase 5 requirements: DATA-01 (JSON export), DATA-02 (JSON round-trip import), DATA-03 (CSV import), DATA-05 (file-as-truth). Traceability table maps all five to Phase 5.

- `.planning/ROADMAP.md` § Phase 5 — Phase boundary, four success criteria, depends on Phase 4.

- `CLAUDE.md` — Repo conventions: Object.freeze configs, TDD discipline, REQ-IDs in commits, no npm runtime dependencies.

### Prior phase decisions (load-bearing for Phase 5)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — D-04 (canonical JSON shape v1→v2), D-06 (layered module structure), D-07 (adapter seams for testability), D-19–D-22 (testing scaffold).

- `.planning/phases/NW-02-configuration-settings/02-CONTEXT.md` — D2-04 (settings stored in `db.settings`), D2-07 (`createSettingsStore()` API — get/update/subscribe), D2-05 (v1→v2 migration contract).

- `.planning/phases/NW-04-history-screen-edit-delete/04-CONTEXT.md` — D4-14 (`settings.rejectedDays` array of date strings — Phase 5 CSV import must populate this from the `odrzucone` column).

### Source code (integration points)

- `js/lib/db-shape.js` — `migrateV1ToV2()` with Phase 5 import contract explicitly documented in comments (Pitfall #8: "Phase 5 import callers MUST pass the parsed-and-migrated blob to both stores at composition time"). `DEFAULT_SETTINGS` for fresh/v1 imports. This file is the primary integration point for import logic.

- `js/store/event-log.js` — Schema-version guard throws on `db.version !== 2`. Phase 5 import must call `migrateV1ToV2` before passing the blob to the stores. The store does NOT expose a bulk-replace API yet — Phase 5 plan will need to add one (or reinitialize the stores with the imported blob).

- `js/store/settings.js` — Phase 5 import must load the imported settings into the settings store. The store's `createSettingsStore({ storage })` reads from storage on construction; the import flow writes to storage first, then signals both stores to reload (or Phase 5 adds a `replace(blob)` method to each store).

- `js/ui/history-screen.js` — Phase 5 adds an "Export JSON" button to the History screen toolbar. Integration point: the export button is wired in `mountHistoryScreen()` or added directly to the History screen's mount function.

- `js/ui/settings-modal.js` — Phase 5 adds an Import section to the existing Settings modal. Integration point: `openSettings()` or the modal's mount function gains the Import CSV / Import JSON file-picker triggers.

- `js/app.js` — Composition root. Phase 5 may add import logic here (wiring storage, eventLog, and settings to the import handlers) or in a new `js/ui/import-export.js` UI module.

- `tests/e2e/` — Phase 5 adds Playwright specs for: export flow (click Export → file downloaded → file contains expected JSON), CSV import flow (select file → confirmation → import → History shows imported days), JSON round-trip (export → clear localStorage → import → state matches pre-export).

### Domain / data schema

- `sen.xlsx` column mapping (in `.planning/PROJECT.md` § Context) — The authoritative Polish column schema. Phase 5 CSV parser maps these exact columns: `Data` → date, `Pobudka` → wake, `Zaśnięcie` → bedtime, `Drzemka start` → napStart, `Drzemka stop` → napEnd, `Aktywność` → activity, `odrzucone` → rejected flag.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`js/lib/db-shape.js` — `migrateV1ToV2()`**: Directly usable for JSON import. Handles null/v1/v2 inputs with documented Phase 5 contract. Phase 5 calls this on the parsed JSON blob before writing to both stores.

- **`js/lib/db-shape.js` — `DEFAULT_SETTINGS`**: Used when a CSV import (which has no settings payload) needs to construct fresh settings before populating `rejectedDays` from the `odrzucone` column.

- **`js/ui/settings-modal.js`**: Already has a scrollable modal structure with sections. Phase 5 adds an "Import / Export" section at the bottom. Reuse the existing modal's open/close pattern and section HTML structure.

- **`js/ui/history-screen.js`**: Already renders the History table. Phase 5 adds a toolbar row above the table with the "Export JSON" button. Reuse the existing screen mount pattern.

- **`js/lib/time.js` — `parseLocalISO`, `roundTo5`, `formatLocalISO`**: Reuse for parsing CSV time strings (HH:MM → local ISO at-string → roundTo5 → formatLocalISO). Ensures all imported events carry 5-minute-aligned at-strings (LOG-07).

- **Phase 4 delete confirmation dialog pattern (D4-06)**: Phase 5's import confirmation dialog follows the same confirm/cancel pattern already established. Reuse the same dialog structure from `manual-entry.js` or `history-screen.js`.

### Established Patterns

- **Pure-logic modules with adapter seams**: CSV parsing logic (column mapping, date/delimiter detection, row validation) belongs in `js/lib/csv-parse.js` — a pure function `parseCSV(text, options?) → { events, rejectedDays, activityLog, errors }`. No DOM, no I/O. Fully unit-testable with `node:test`. The UI layer (settings-modal.js) handles `FileReader` and feeds the raw text to this function.

- **`Object.freeze` for config**: Column name mapping table (Polish header → field name) should be frozen: `Object.freeze({ Data: 'date', Pobudka: 'wake', ... })`.

- **Subscriber pattern for reactive updates**: After a successful import, both stores need to notify their subscribers so the Today screen, History screen, and forecast cards re-render immediately. Phase 5 uses the existing `eventLog.subscribe()` and `settings.subscribe()` notification paths.

- **TDD discipline**: CSV parsing logic is pure → strict RED→GREEN→refactor. File API usage (FileReader, Blob, `<a download>`) is side-effecting → at least one E2E test as a regression guard.

### Integration Points

- **`js/app.js` (composition root)**: Phase 5 may add import/export handlers here or delegate to a new `js/ui/import-export.js` module. The composition root provides `storage`, `eventLog`, and `settings` — all needed for import.

- **`js/store/event-log.js` and `js/store/settings.js`**: Need a `replace(blob)` API (or equivalent) so an import can swap the full in-memory state and persist it in one call — consistent with the Phase 5 import contract in db-shape.js (pass migrated blob to both stores at composition time, not by re-loading after save).

- **`index.html`**: May need a hidden `<input type="file" accept=".csv,.json">` for the file picker. Phase 5 adds this wired to the Settings modal trigger.

</code_context>

<specifics>
## Specific Ideas

- **Primary import use case is seeding from sen.xlsx.** The user has months of sleep history in the spreadsheet. The CSV import is the one-time migration path to seed the app. After that, the workflow is: log in-app → export to JSON → import JSON if needed. The CSV import is designed for this migration scenario, not ongoing daily use.

- **Activity data must be preserved from the CSV.** Years of activity scores are in the sen.xlsx. If Phase 5 skips the `Aktywność` column, that data is lost when the user discards the CSV. Storing it in `db.activityLog` now means Phase 7 can use it immediately without requiring a re-import.

- **Rejected days from spreadsheet should carry over.** The user has already done manual outlier curation in the spreadsheet. Importing the `odrzucone` flag means the forecast is correctly tuned from day one, without the user needing to re-flag dozens of days from the History screen.

</specifics>

<deferred>
## Deferred Ideas

- **CSV export** — The user did not ask for it; DATA-01..03 only require JSON export. If needed, could be added in Phase 7 alongside the accuracy dashboard (where CSV would be useful for analysis in Excel). Not in Phase 5 scope.

- **Incremental/merge import** — Appending CSV rows to existing events rather than replacing all. Deferred because file-as-truth requires a clear authoritative source; merge semantics are complex and risk duplicates. If needed, address in a future phase with explicit dedup logic.

- **Export activity log separately** — Exporting `db.activityLog` as a standalone CSV for use in other tools. Deferred to Phase 7 or later.

- **Import progress indicator** — For very large CSV files. Not needed for a few hundred daily records; could be added later.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Data Import/Export*
*Context gathered: 2026-06-28*
