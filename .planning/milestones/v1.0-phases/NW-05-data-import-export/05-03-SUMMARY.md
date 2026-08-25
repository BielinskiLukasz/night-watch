---
plan: 05-03
phase: NW-05-data-import-export
status: complete
completed: 2026-06-28
commits:
  - b43067c  # feat(05-03): JSON export button on History screen + E2E tests
tests_delta: "+4 E2E (import-export.spec.js)"
---

# Plan 05-03 Summary: JSON Export Button on History Screen

## What Was Built

**js/lib/import-export.js** — pure export helper:
- `downloadJSON(storage, clock)`: reads `storage.load()`, serializes with `JSON.stringify(blob, null, 2)` (D5-16), builds `nightwatch-YYYY-MM-DD.json` filename (D5-15), triggers download via `URL.createObjectURL` + transient anchor click
- `setTimeout(() => URL.revokeObjectURL(url), 100)` — RESEARCH Pitfall 3 (immediate revocation cancels the download in Chrome/Edge)
- No store imports; receives `storage` + `clock` directly from composition root

**js/ui/history-screen.js** (extended):
- `mountHistoryScreen` now accepts optional `onExport` callback in deps
- When `onExport` provided: renders `div.historyToolbar` with `button#exportJsonBtn.btnExport` above the table (D5-02)
- Toolbar built once at mount time; `render()` now targets a dedicated `div.historyTableRoot` child so the toolbar survives subscriber-triggered re-renders
- Export button NOT on Today screen or in Settings modal (D5-03 enforced by structure)

**js/app.js**:
- Imports `downloadJSON`; passes `onExport: () => downloadJSON(storage, clock)` to `mountHistoryScreen`

**style.css**:
- `.historyToolbar` (flex row, gap, padding-bottom)
- `.btnExport` (outlined indigo button matching app palette)

**tests/e2e/import-export.spec.js** (new file):
- 4 E2E tests: button visible on History, not visible on Today, download is valid JSON (version/events/settings/activityLog), filename matches date-stamp pattern

## Test Results

- `npx playwright test tests/e2e/import-export.spec.js`: **4/4 pass**
- `node --test tests/unit/*.test.js`: **271/271 pass** (no regressions)
- `node --test tests/integration/*.test.js`: **140/140 pass** (no regressions)
