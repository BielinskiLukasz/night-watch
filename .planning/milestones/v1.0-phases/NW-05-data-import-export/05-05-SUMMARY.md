---
plan: 05-05
phase: NW-05-data-import-export
status: complete
completed: 2026-06-29
commits:
  - 9a17675  # test(05-05): RED — JSON import E2E tests
  - de339e4  # feat(05-05): JSON import in Settings modal
  - 4b6ed66  # fix(05): CSV BOM strip + double file-picker
  - f790b42  # fix(05): DD-MM-YYYY date format + fuzzy header match
  - e0bb6e1  # fix(05): pad single-digit hours in CSV time cells
tests_delta: "+3 E2E (JSON round-trip, version guard, malformed JSON); +4 unit (BOM, DD-MM-YYYY, fuzzy headers ×2, single-digit hour)"
---

# Plan 05-05 Summary: JSON Import + Round-Trip + Human Verification

## What Was Built

**js/ui/settings-modal.js** (extended):
- JSON import flow: `#importJsonBtn` click → `#jsonInput` change → `FileReader.readAsText` → `handleJsonImport`
- `handleJsonImport`: `JSON.parse` → version guard (rejects `blob.version > 2`) → `window.confirm` (D5-12) → `storage.save(migrateV1ToV2(...))` → `eventLog.replace(blob)` → `settings.replace(blob)` → `showStatus()`
- Module-level handler variables (`_csvClickHandler`, `_csvChangeHandler`, `_jsonClickHandler`, `_jsonChangeHandler`) prevent listener accumulation on repeated Settings opens — fixes double file-picker bug discovered during human verification
- `console.log`/`console.warn` added in `handleCsvImport` for parse diagnostics

**js/lib/csv-parse.js** (bug fixes from human verification):
- Strip UTF-8 BOM (`﻿`) at start of text — Excel prepends it to every CSV export; without this, the first header becomes `"﻿Data"` and misses the COL map (0 events imported)
- `dmy-dash` date format: `DD-MM-YYYY` (e.g. `30-03-2026`) detected by `detectDateFormat` and parsed by `parseDate`
- `COL_FUZZY` normalized lookup: strips non-alphanumeric characters before header matching, so encoding-garbled headers like `Za?ni?cie` (Zaśnięcie read from Windows-1250 as UTF-8) resolve to the correct field (`bedtime`)
- `.padStart(5, '0')` on time cells: pads single-digit hours (`7:30` → `07:30`) before passing to `parseLocalISO`

**tests/e2e/import-export.spec.js** (extended):
- JSON round-trip test: export → localStorage.clear() + reload → import JSON → History row count matches pre-export state (DATA-02, DATA-05)
- Version guard test: `{ version: 3, ... }` shows "Incompatible file" error; existing data intact
- Malformed JSON test: non-JSON content shows "Invalid JSON" error

**tests/unit/csv-parse.test.js** (extended — 25 total):
- BOM stripping test
- `DD-MM-YYYY` date format test
- Fuzzy header match tests for `Za?ni?cie` → bedtime and `Aktywno??` → activity
- Single-digit hour test (`7:30` → `07:30`)

## Human Verification Result

**Approved 2026-06-29** — all four Phase 5 success criteria confirmed in browser after three fix iterations:

1. Fix 1: CSV BOM strip — Excel-exported CSV with BOM now parses correctly
2. Fix 2: `DD-MM-YYYY` date format — Polish Excel date format now recognized
3. Fix 3: Fuzzy header matching — encoding-garbled Polish headers now resolve
4. Fix 4: Single-digit hour padding — `7:30` → `07:30` accepted

JSON round-trip, Export, and File-as-Truth all passed first attempt.

## Test Results

- `node --test tests/unit/*.test.js`: **275/275 pass**
- `node --test tests/integration/*.test.js`: **140/140 pass**
- `npx playwright test`: **80/80 pass** (11 in import-export.spec.js)

## Decisions Made

- Module-level handler variables (`_csvClickHandler` etc.) chosen over `AbortController` or `{ once: true }` for simplicity — same pattern as other removeEventListener usages, minimal surface area
- Fuzzy match as fallback only (exact COL match wins) — avoids false positives on computed/aggregate columns like `Długość drzemki`
- `COL_FUZZY` built at module load from COL entries — single source of truth; no duplication of field mappings
- Console logs kept in production build — useful for user debugging; no sensitive data in log messages
