---
phase: NW-14
plan: "03"
subsystem: ui/metrics-screen
tags: [metrics, tif, columns, table, inline-columns, aggregate-rows, ui]
status: complete

dependency_graph:
  requires:
    - js/lib/metrics.js (dayToSleepFactor, napFraction, amPmSplit, aggregateMetrics — plan 14-01)
    - js/lib/accuracy-tif.js (computeTifBoundsHistory — plan 14-02)
    - js/lib/forecast.js (timeToMinutes, minutesToTime)
  provides:
    - js/ui/metrics-screen.js with 16-column COLUMNS (D-09 order)
    - TIF_COLUMNS constant (12 entries, tif:true)
    - buildTifAggregateRow private helper
    - render() extended with TIF branch (isTif detection, tifBoundsMap, TIF inline + aggregate rows)
  affects:
    - metrics table rendering in the browser

tech_stack:
  added: []
  patterns:
    - "el.hidden = !isTif pattern for TIF column/row visibility (consistent with phase 14 established pattern)"
    - "split('_tif_') key parsing for TIF inline column event-type + field extraction"
    - "computeTifRowAvg inline helper in render(): minutesToTime(Math.round(avg(timeToMinutes vals)))"
    - "TIF_EVENT_TYPES Set for O(1) event-type column detection in buildTifAggregateRow"

key-files:
  created: []
  modified:
    - js/ui/metrics-screen.js

key-decisions:
  - "D-09: 16-column order with napFraction at index 7, dayToSleepFactor at 10, amPmSplit at 14, AAS at 15; SAA removed"
  - "D-11: TIF_COLUMNS (12 entries) appended after COLUMNS in header and data rows; hidden = !isTif per entry"
  - "D-14: sleepAfterActivityFactor removed from imports and COLUMNS; activityAfterSleepFactor (AAS) stays"
  - "computeTifRowAvg defined inline in render() — closure over tifBoundsArray avoids extra parameter passing"
  - "TIF aggregate rows TIF_COLUMNS cells all render '—' — individual bounds not repeated in aggregate rows"
  - "activityAfterSleepFactor imported but not called directly — harmless; AAS data flows through aggregateMetrics rows"

metrics:
  duration: "9 min"
  completed: "2026-08-27"
  tasks_completed: 3
  commits: 3
  files_changed: 1

estimate:
  tokens: 75000

actuals:
  tokens: 2200
  tasks: 3
  commits: 3
---

# Phase 14 Plan 03: Metrics Screen Overhaul (COLUMNS 16-col, TIF inline, TIF aggregate rows) Summary

**One-liner:** `metrics-screen.js` updated to 16-column D-09 order (Nap Frac, Day/Sleep, AM/PM added; SAA removed), 12 hidden TIF inline columns reactive to forecastAlgorithm, and 3 TIF aggregate rows (min-TIF/median-TIF/max-TIF) hidden when TIF is off.

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-27
- **Completed:** 2026-08-27
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

### Task 1 — Tracer: COLUMNS 16-column overhaul

- `COLUMNS` constant updated from 14 to 16 entries in D-09 order
- New ratio columns: `napFraction` (idx 7, isRatio:true), `dayToSleepFactor` (idx 10, isRatio:true), `amPmSplit` (idx 14, isRatio:true)
- `sleepAfterActivityFactor` (SAA) removed from both COLUMNS and import list (D-14/MET-07)
- `activityAfterSleepFactor` (AAS) retained at index 15
- `buildDayRow` and `buildAggregateRow` iterate COLUMNS dynamically — picked up new columns with zero structural changes
- All 753 unit tests pass (no existing tests broken by column reorder)

### Task 2 — TIF inline columns (MET-08, D-11)

- `computeTifBoundsHistory` imported from `../lib/accuracy-tif.js`
- `timeToMinutes`, `minutesToTime` imported from `../lib/forecast.js`
- `TIF_COLUMNS` constant: 12 entries for 4 event types × 3 fields (min/max/conf), all with `tif:true`
- `render()` computes `isTif = snap.forecastAlgorithm === 'tif'`, calls `eventLog.getActivityLog()` when TIF active, builds `tifBoundsMap: Map<date, TifBoundsEntry>`
- 12 TIF header cells appended to headerRow with `th.hidden = !isTif`
- `buildDayRow` extended with `tifBoundsMap` and `isTif` parameters; 12 TIF data cells per row with `td.hidden = !isTif`
- Key parsing: `col.key.split('_tif_')` → `[eventType, field]`; handles `napStart_tif_*` correctly
- All TIF cell content via `textContent` (T-11-05)

### Task 3 — TIF aggregate rows (MET-11, D-06/07/08)

- `buildTifAggregateRow(label, tifAvgs, snap)` helper: `metrics-summary-row metrics-tif-row` class, event-type columns show avg time, all others show '—'
- `TIF_EVENT_TYPES = new Set(['wake','napStart','napEnd','bedtime'])` for O(1) detection
- `computeTifRowAvg(field)` inline helper in `render()`: averages `timeToMinutes(entry[type][field])` across non-null entries, converts back via `minutesToTime(Math.round(avg))`
- Three rows built: `min-TIF` (algMin avg), `median-TIF` (central avg), `max-TIF` (algMax avg)
- `minTifRow.hidden = !isTif` / `medianTifRow.hidden = !isTif` / `maxTifRow.hidden = !isTif`
- Null returned when no non-null entries exist for an event type → cell renders '—' (D-08)
- All 753 unit tests pass

## Task Commits

1. **Tracer: 16-column COLUMNS** - `375b5d1` (feat)
2. **TIF inline columns** - `99e1c8d` (feat)
3. **TIF aggregate rows** - `d66bb00` (feat)

## Files Created/Modified

- `js/ui/metrics-screen.js` — full overhaul: 359→504 lines (+145 net); imports updated; COLUMNS replaced; TIF_COLUMNS added; buildDayRow extended; buildTifAggregateRow added; render() extended with TIF branch

## Decisions Made

- `computeTifRowAvg` defined as an inline closure inside `render()` — accesses `tifBoundsArray` from outer scope directly without extra parameter, cleaner than top-level helper since it's render-state-dependent
- `TIF_EVENT_TYPES` defined as a module-level `Set` constant before `buildTifAggregateRow` — avoids re-creating on every call
- TIF aggregate rows TIF_COLUMNS cells all render '—' — the aggregate rows summarize base event-type averages; repeating individual TIF bounds columns would be redundant
- Tracer verified: `napStart_tif_conf`.split('_tif_') → `['napStart', 'conf']` — correct split for all 12 keys including napStart/napEnd variants

## Deviations from Plan

None — plan executed exactly as written.

The unused `activityAfterSleepFactor` function import was kept (consistent with the plan's "Keep activityAfterSleepFactor (AAS stays)" directive). It is only used as a COLUMNS key string, not called directly, but keeping it documents the AAS column's dependency.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access, or schema changes. All security mitigations from the plan's threat register were implemented:

- **T-14-03-01 (XSS):** All TIF cell content via `td.textContent`; `formatTime` returns a formatted string safe for textContent; `precisionScore.toFixed(2)` is a number-to-string conversion — no user-controlled string rendered directly.
- **T-14-03-02 (column drift):** `buildDayRow` and `buildAggregateRow` iterate `COLUMNS.length` dynamically; `buildTifAggregateRow` iterates `COLUMNS.length` and `TIF_COLUMNS.length` dynamically — no hardcoded column indices.
- **T-14-03-03 (look-ahead):** `computeTifBoundsHistory` (Plan 02) enforces look-ahead bias prevention; Plan 03 consumes its output unchanged.
- **T-14-03-04 (D-09 column indices):** Dynamic iteration pattern confirmed — no index-dependent tests impacted.

## Self-Check

- [x] `js/ui/metrics-screen.js` exists (504 lines)
- [x] COLUMNS has exactly 16 entries (verified via node -e count)
- [x] TIF_COLUMNS has exactly 12 entries (verified via node -e count)
- [x] `sleepAfterActivityFactor` appears 2 times (comment line only — not in COLUMNS, not in imports)
- [x] Commit `375b5d1` exists (COLUMNS overhaul)
- [x] Commit `99e1c8d` exists (TIF inline columns)
- [x] Commit `d66bb00` exists (TIF aggregate rows)
- [x] `npm run test:unit` — 753/753 pass, 0 failures

## Self-Check: PASSED
