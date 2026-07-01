---
plan: 05-01
phase: NW-05-data-import-export
status: complete
completed: 2026-06-28
commits:
  - 4a9b5d1  # test(05-01): add failing unit tests for csv-parse.js [RED]
  - ae062a2  # feat(05-01): implement csv-parse.js and activityLog schema injection [GREEN]
tests_delta: "+20 unit (csv-parse) +4 unit (db-shape activityLog)"
---

# Plan 05-01 Summary: CSV Parser + activityLog Schema Foundation

## What Was Built

**js/lib/csv-parse.js** — pure CSV parser (no DOM, no I/O) for the Polish sen.xlsx column schema:
- `parseCSV(text)` returns `{ events[], rejectedDays[], activityLog{}, skipped[{row,reason}] }`
- Auto-detects delimiter (`;` vs `,`) by counting occurrences on the header line (D5-09)
- Auto-detects date format (`DD.MM.YYYY` dots vs `YYYY-MM-DD` dashes) from first parseable row (D5-08)
- Frozen `COL` map accepts Polish headers with/without diacritics + English aliases (D5-06)
- Nap columns optional: empty cells produce no `napStart`/`napEnd` events (D5-05)
- All event at-strings run through `parseLocalISO → roundTo5 → formatLocalISO` for 5-min alignment (LOG-07)
- Excel seconds suffix (`HH:MM:SS`) truncated to `HH:MM` before parsing
- Bad rows (missing date, missing wake, unparseable time) skipped with `{ row, reason }` entry (D5-10)
- `odrzucone` truthy (not `'0'`/`'false'`) → date pushed to `rejectedDays[]` (D5-07)
- `Aktywnosc`/`Aktywność` numeric value → entry in `activityLog{}` (D5-17)

**js/lib/db-shape.js** (patched) — `migrateV1ToV2` now injects `activityLog: {}`:
- Fresh-install path: `{ version: 2, settings, events: [], activityLog: {} }`
- v1→v2 migration path: adds `activityLog: {}` alongside the existing default settings injection
- v2 passthrough path: injects `activityLog: {}` when field is absent or not a plain object; preserves existing data

## Test Results

- `node --test tests/unit/csv-parse.test.js`: **20/20 pass** (new file — all parsing branches)
- `node --test tests/unit/db-shape.test.js`: **27/27 pass** (23 existing + 4 new activityLog injection tests)

## Decisions Made

- ASCII header aliases (`Zasniecie`, `Aktywnosc`) included in COL map alongside diacritic variants to avoid encoding issues in test fixtures
- Date format detection is lazy (from first parseable row) — consistent with D5-08 "auto-detect" rather than a mandatory user setting
- Optional field parse errors are silently swallowed (not added to `skipped[]`) — only missing required fields (date, wake) cause a skip; malformed optional fields lose that field but keep the row
