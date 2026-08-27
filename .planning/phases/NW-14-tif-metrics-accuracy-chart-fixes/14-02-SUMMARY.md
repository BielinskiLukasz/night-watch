---
phase: NW-14
plan: "02"
subsystem: lib/accuracy-tif
tags: [tif, accuracy, backtesting, retroactive, pure-fn]
status: complete

dependency_graph:
  requires:
    - js/lib/forecast-tif.js
    - js/lib/forecast.js
  provides:
    - js/lib/accuracy-tif.js
  affects:
    - sw.js

tech_stack:
  added:
    - js/lib/accuracy-tif.js (new pure-fn lib module)
  patterns:
    - retroactive look-ahead bias prevention (same slice pattern as accuracy.js)
    - Object.freeze config (ACCURACY_TIF_CONFIG)
    - O(1) date-keyed Map for actual event lookup
    - circular-import guard (no metrics.js import)
    - TDD RED→GREEN cycle

key_files:
  created:
    - js/lib/accuracy-tif.js
    - tests/unit/accuracy-tif.test.js
  modified:
    - sw.js

decisions:
  - "accuracy-tif.js imports only forecast-tif.js and forecast.js — never metrics.js (circular-import guard)"
  - "computeTifBoundsHistory uses tifRollingDays as minDays (Phase 13 D-06), falling back to settings.minDays"
  - "null TIF bounds for a specific event type are excluded from totals — not treated as a miss (ASSUMPTION MET-08)"
  - "central and precisionScore keys included in TifBounds shape for D-07 median-TIF rows in Plan 03"
  - "JSDoc + look-ahead invariant comment included in GREEN commit — no separate REFACTOR commit"

metrics:
  duration: "8 minutes"
  completed: "2026-08-27"
  tasks_completed: 3
  commits: 2
  files_changed: 3

estimate:
  tokens: 55000

actuals:
  tokens: 8500
  tasks: 3
  commits: 2
---

# Phase 14 Plan 02: TIF Retroactive Engine Summary

**One-liner:** New `accuracy-tif.js` with `computeTifBoundsHistory` (retroactive TIF backtesting, no look-ahead) and `computeTifAccuracy` (window-hit / avg-width / high-conf per event type), plus `sw.js` precache update.

## What Was Built

- **`js/lib/accuracy-tif.js`** — new pure lib module, 220 lines:
  - `computeTifBoundsHistory(dayRecords, settings, activityLog)` → `TifBoundsEntry[]`
    - Sorts chronologically, uses `tifRollingDays` as warm-up period
    - Loop invariant: `history = sorted.slice(0, i)` (no look-ahead bias)
    - Cold-start entries recorded with all-null event fields (date always present)
    - Null guard: `p.algMin != null && p.algMax != null` required before TifBounds created
    - Shape: `{ algMin, algMax, central, precisionScore }` per event type
  - `computeTifAccuracy(history, dayRecords)` → `TifAccuracyResult`
    - O(1) date-keyed Map for actual lookup
    - Three stats per event type: `windowHit`, `avgWidthMin`, `highConf`
    - pct guarantee: `total === 0 → pct = 0` (never NaN)
    - Null bounds excluded from totals (not treated as miss)
- **`tests/unit/accuracy-tif.test.js`** — 21 tests across 5 describe blocks, 0 failures
- **`sw.js`** — `accuracy-tif.js` added to PRECACHE_LIST in alphabetical order

## TDD Gate Compliance

- RED commit: `test(NW-14-02): add failing tests for computeTifBoundsHistory and computeTifAccuracy` (f36b43e)
- GREEN commit: `feat(NW-14-02): add accuracy-tif.js with computeTifBoundsHistory and computeTifAccuracy; update sw.js precache (MET-08, TIF-14, D-10)` (c073ada)
- REFACTOR: JSDoc and look-ahead invariant comment included in GREEN commit — no separate REFACTOR commit needed (consistent with Phase 12 Plan 02 decision)

## Verification Results

| Check | Result |
|-------|--------|
| `node --test tests/unit/accuracy-tif.test.js` | 21/21 pass |
| `node --test tests/unit/sw-precache.test.js` | 19/19 pass |
| `npm run test:unit` | 751/751 pass |

## Deviations from Plan

None — plan executed exactly as written.

The implementation included comprehensive JSDoc with the look-ahead invariant comment in the GREEN commit rather than a separate REFACTOR commit, consistent with Phase 12 Plan 02 precedent. This is not a deviation — the plan allows JSDoc to be included in GREEN when no additional cleanup is needed.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, or file-access patterns introduced. Both exported functions are pure (no I/O, no DOM). The security mitigations from the plan's threat register were implemented:

- **T-14-02-01 (look-ahead bias):** `history = sorted.slice(0, i)` — only records at index < i used; verified by `'3 records returns 1 entry'` and `'first entry date is 2025-01-08'` tests.
- **T-14-02-02 (NaN in pct):** `total === 0 ? 0 : Math.round(...)` — zero-total guard on every pct call; verified by `'zero total → pct is 0, not NaN'` test.
- **T-14-02-03 (circular import):** accuracy-tif.js imports only forecast-tif.js and forecast.js; documented in module header comment.
- **T-14-02-04 (actual minutes extraction):** `extractActualMinutes` handles both object `{at:...}` and bare string; mirrors `accuracy.js` implementation.

## Self-Check

- [x] `js/lib/accuracy-tif.js` exists
- [x] `tests/unit/accuracy-tif.test.js` exists
- [x] `sw.js` contains `'./js/lib/accuracy-tif.js'`
- [x] RED commit f36b43e exists
- [x] GREEN commit c073ada exists
- [x] All 751 unit tests pass
