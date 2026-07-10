---
plan: 05-04
phase: NW-05-data-import-export
status: complete
completed: 2026-06-28
commits:
  - 7f1dabf  # feat(05-04): CSV import in Settings modal
tests_delta: "+4 E2E (import-export.spec.js CSV section)"
---

# Plan 05-04 Summary: CSV Import in Settings Modal

## What Was Built

**index.html**:
- Hidden `<input type="file" id="csvInput" accept=".csv,text/csv">` and `#jsonInput` at body bottom (D5-01)
- Import/Export `<fieldset>` in settings dialog with `#importCsvBtn`, `#importJsonBtn`, `#importStatus` (polite live region)

**js/ui/settings-modal.js** (extended):
- `openSettings` accepts `{ settings, eventLog, storage, id }` — optional deps for import wiring
- CSV import flow: `importCsvBtn` click → `csvInput.click()` → `change` event → `FileReader.readAsText` → `handleCsvImport(csvText)`
- `handleCsvImport`: `parseCSV(csvText)` → `window.confirm(...)` (D5-12) → assign IDs to events → `migrateV1ToV2` → `storage.save(blob)` → `eventLog.replace(blob)` → `settings.replace(blob)` → `showStatus()` (D5-10, D5-11)
- `showStatus(msg, isError)`: writes to `#importStatus` via `textContent` only (T-2-14)
- `change` listener registered at `openSettings` time (not inside button click), so `removeEventListener + addEventListener` prevents accumulation on repeated modal opens (T-05-04-04)
- `csvInput.value = ''` after file selection (RESEARCH Pitfall 6 — same file re-importable)

**js/ui/header.js**:
- `mountHeader` accepts optional `onSettings` callback; when provided, calls it instead of `openSettings({ settings })`

**js/app.js**:
- Imports `openSettings` from `settings-modal.js`; passes `onSettings: () => openSettings({ settings, eventLog, storage, id: newEventId })`

**style.css**:
- `.btnImport`, `.importStatus`, `.importStatus.error`, `.importHelp` styles

## Test Results

- `npx playwright test tests/e2e/import-export.spec.js`: **8/8 pass** (4 export + 4 CSV import)
- `node --test tests/unit/*.test.js`: **271/271 pass** (no regressions)

## Decisions Made

- `change` listener on `#csvInput` registered at `openSettings` call time (not inside button click handler) — this is required for Playwright `setInputFiles` to trigger the handler without simulating the button click first
- `storage.save(blob)` called before `eventLog.replace()` + `settings.replace()` per RESEARCH §Pattern A to ensure a consistent state if either replace fails
