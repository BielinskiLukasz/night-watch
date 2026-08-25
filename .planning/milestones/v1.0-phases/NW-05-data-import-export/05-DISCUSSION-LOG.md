# Phase 5: Data Import/Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 5-Data Import/Export
**Areas discussed:** Import/Export UI placement, CSV import behavior, Import error handling & feedback, Export scope, CSV date/time format parsing, Rejected flag in CSV (odrzucone column), Activity column handling

---

## Import/Export UI Placement

### Where should the Import/Export controls live?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings modal | Add an 'Import / Export' section to the existing gear-icon modal | ✓ |
| History screen toolbar | Add Import and Export buttons near the top of the History table | |
| Dedicated Data screen | A third tab purely for import/export | |

**User's choice:** Settings modal

---

### Should Export also be a persistent button?

| Option | Description | Selected |
|--------|-------------|----------|
| Both in Settings modal only | One place to find all data ops | |
| Export also as a persistent button | Small 'Export' button on History screen; Import stays in Settings | ✓ |
| You decide | Claude picks the layout | |

**User's choice:** Export also as a persistent button (recommended)

---

### Where should the persistent Export button live?

| Option | Description | Selected |
|--------|-------------|----------|
| History screen toolbar | At the top of the History table alongside the data it exports | ✓ |
| App header / footer strip | A small 'Export' link visible from every screen | |
| You decide | Claude places it where it fits cleanest | |

**User's choice:** History screen toolbar (recommended)

---

### Should Import also be on the History screen toolbar?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — both Import and Export on History toolbar | Side by side on History screen | |
| No — Export on History, Import in Settings only | Import is destructive so it belongs behind the gear icon | ✓ |
| You decide | Claude judges based on the destructive-action risk principle | |

**User's choice:** No — Export on History, Import in Settings only

---

## CSV Import Behavior

### Replace vs. merge/append

| Option | Description | Selected |
|--------|-------------|----------|
| Replace everything | Full state replacement — consistent with file-as-truth | ✓ |
| Append / merge | Add CSV rows to existing events | |

**User's choice:** Replace everything (recommended)

---

### Nap columns: optional or required?

| Option | Description | Selected |
|--------|-------------|----------|
| Optional — missing nap = no nap event | Matches real-world data where not every day has a nap | ✓ |
| Required — missing nap = row error | Stricter parsing; would reject all nap-free days | |

**User's choice:** Optional — missing nap = no nap event (recommended)

---

### Aggregate/computed columns

| Option | Description | Selected |
|--------|-------------|----------|
| Silently ignore aggregate columns | Import only raw event times; derived values are recomputed by the app | ✓ |
| Import them as metadata | Store extra columns on the day record | |

**User's choice:** Silently ignore aggregate columns (recommended)

---

## Import Error Handling & Feedback

### Bad row handling

| Option | Description | Selected |
|--------|-------------|----------|
| Skip bad rows, show a summary | Import all valid rows; show count of skipped rows with row numbers | ✓ |
| Abort the whole file on any error | Strict: refuse import if any single row is bad | |
| Import anyway, silently skip errors | No feedback on skipped rows | |

**User's choice:** Skip bad rows, show a summary (recommended)

---

### Success feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Count summary only | Brief dismissible message: "Import complete — N days loaded." | ✓ |
| Full preview before commit | Show a table preview and ask the user to confirm | |
| You decide | Claude picks based on minimal-friction principle | |

**User's choice:** Count summary only (recommended)

---

### Confirmation before replacing

| Option | Description | Selected |
|--------|-------------|----------|
| Show confirmation dialog before replacing | "This will replace all current events. Continue?" | ✓ |
| No confirmation — import immediately | Faster; user picked the file intentionally | |

**User's choice:** Show confirmation dialog (recommended)

---

### JSON import: events only vs. everything

| Option | Description | Selected |
|--------|-------------|----------|
| Restore everything — events + settings | True file-as-truth restore | ✓ |
| Restore events only, keep current settings | Safer for "reload history without resetting preferences" scenario | |

**User's choice:** Restore everything — events + settings (recommended)

---

## Export Scope

### What should the exported JSON contain?

| Option | Description | Selected |
|--------|-------------|----------|
| Full blob — events + settings | Complete app state: `{ version: 2, settings: {...}, events: [...] }` | ✓ |
| Events only | Simpler, smaller file; loses settings and rejectedDays | |

**User's choice:** Full blob — events + settings (recommended)

---

### Exported filename

| Option | Description | Selected |
|--------|-------------|----------|
| nightwatch-YYYY-MM-DD.json | Date-stamped; allows multiple dated backups | ✓ |
| nightwatch.json (fixed name) | Simpler; overwrites previous backup | |
| You decide | Claude picks based on usability | |

**User's choice:** nightwatch-YYYY-MM-DD.json (recommended)

---

### JSON formatting

| Option | Description | Selected |
|--------|-------------|----------|
| Pretty-printed — indented JSON | Human-readable; user can inspect/edit in a text editor | ✓ |
| Compact — minified JSON | Smaller file; no meaningful size advantage at this data volume | |
| You decide | Claude picks based on file-as-truth / user-inspectable principle | |

**User's choice:** Pretty-printed — indented JSON (recommended)

---

## CSV Date/Time Format Parsing

### Date format

| Option | Description | Selected |
|--------|-------------|----------|
| DD.MM.YYYY (Polish Excel format) | e.g., 28.06.2026 | |
| YYYY-MM-DD (ISO format) | e.g., 2026-06-28 | |
| Auto-detect — handle both | Check format of first parseable date cell | ✓ |

**User's choice:** Auto-detect — handle both

---

### CSV delimiter

| Option | Description | Selected |
|--------|-------------|----------|
| Semicolon (;) — Polish/European Excel default | Parser expects semicolons | |
| Comma (,) — standard CSV | Parser expects commas | |
| Auto-detect | Count semicolons vs commas on first line; use the dominant one | ✓ |

**User's choice:** Auto-detect (recommended)

---

## Rejected Flag in CSV (odrzucone column)

### Import the odrzucone flag?

| Option | Description | Selected |
|--------|-------------|----------|
| Import the odrzucone flag | Populate settings.rejectedDays from CSV; preserves existing curation | ✓ |
| Ignore it — start clean | All imported days start as not-rejected | |

**User's choice:** Import the odrzucone flag (recommended)

---

## Activity Column Handling

### Import activity data?

| Option | Description | Selected |
|--------|-------------|----------|
| Import and store activity data now | Store as db.activityLog for Phase 7 charts | ✓ |
| Skip activity — defer to Phase 7 | Simpler Phase 5 scope; risks losing historical data | |

**User's choice:** Import and store activity data now (recommended)

---

### Where to store activity data?

| Option | Description | Selected |
|--------|-------------|----------|
| As a special 'activity' event type | Fits events array but changes VALID_TYPES and at-field semantics | |
| As a separate field on the day record — db.activityLog | Top-level `{ 'YYYY-MM-DD': number }` map; keeps events array clean | ✓ |
| You decide | Claude picks cleanest shape | |

**User's choice:** As a separate field — db.activityLog (recommended)

---

## Claude's Discretion

- Visual layout of the Import/Export section within the Settings modal (position, section heading, whether CSV and JSON import share a single file picker or have separate buttons)
- Exact copy for the import confirmation dialog
- Styling and placement of the Export button on the History screen toolbar (icon + label vs. text link vs. small button)
- Schema version error handling copy when the imported JSON has `version > 2`

## Deferred Ideas

- **CSV export** — Not in requirements (DATA-01..03); potentially useful for Phase 7 alongside the accuracy dashboard
- **Incremental/merge import** — Appending rows rather than replacing; complex dedup logic; deferred
- **Export activity log separately** — Standalone CSV export of activityLog; deferred to Phase 7 or later
- **Import progress indicator** — For very large files; not needed at current data volume
