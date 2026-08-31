---
phase: NW-13
plan: "01"
subsystem: tif-algorithm
status: complete
tags:
  - tif
  - settings
  - forecast
  - migration
dependency_graph:
  requires:
    - NW-12 (eveningHour + noNapBedtimeOffsetMinutes already in settings)
    - js/lib/metrics.js (activityBeforeNap helper)
    - js/store/event-log.js (getActivityLog method)
  provides:
    - tifForecast 4-param signature (dayRecords, settings, activityLog, isNoNapDay)
    - tifRollingDays setting (DEFAULT_SETTINGS, migration, validation, UI)
    - actBeforeNapPerDay index-aligned array inside tifForecast
  affects:
    - NW-13-02 (ratio windows need actBeforeNapPerDay)
    - NW-13-03 (TIF-15 median uses same windows)
    - NW-13-04 (TIF-16 no-nap substitution uses isNoNapDay)
tech_stack:
  added: []
  patterns:
    - Additive settings migration (db-shape.js pattern)
    - Optional parameter with default (activityLog = {}, isNoNapDay = false)
    - Index-aligned per-day array (actBeforeNapPerDay)
key_files:
  created: []
  modified:
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - js/ui/settings-modal.js
    - index.html
    - js/lib/forecast-tif.js
    - js/ui/today-screen.js
    - tests/integration/forecast-tif.integration.test.js
    - tests/unit/settings-validate.test.js
    - tests/unit/db-shape.test.js
decisions:
  - "D-06: tifRollingDays replaces windowDays as the TIF history slice; windowDays unchanged for classic"
  - "D-07: tifRollingDays default 7, range 3-30, delivered via additive migration in db-shape.js"
  - "D-09/D-10: activityLog[d.date] overrides activityBeforeNap(d) when non-null; null falls back"
  - "D-15: isNoNapDay resolved in today-screen.js before tifForecast call (pure function stays pure)"
  - "actBeforeNapPerDay retains null at original indices; actBeforeNap filters them out for existing windows"
metrics:
  duration_minutes: 12
  completed_date: "2026-08-27"
  tasks_completed: 2
  commits: 2
estimate:
  tokens: 80000
actuals:
  tokens: 12000
  tasks: 2
  commits: 2
---

# Phase 13 Plan 01: TIF Algorithm Extensions Tracer Summary

**One-liner:** Wire tifRollingDays + activityLog + isNoNapDay through all 5 layers (persistence → validation → UI → algorithm → call site) with actBeforeNapPerDay index-aligned array.

## Tasks Completed

| # | Name | Type | Commit |
|---|------|------|--------|
| 1 | Tracer: wire tifRollingDays + activityLog + isNoNapDay through all layers | tracer + tdd | e731144 |
| 2 | Regression check: full unit test suite passes with new signature | auto | fa0f665 |

## What Was Built

### Layer 1 — db-shape.js (D-07)
- Added `tifRollingDays: 7` to DEFAULT_SETTINGS after `precisionTarget`
- Added additive migration block in `migrateV1ToV2` that injects `tifRollingDays: 7` for v2 blobs predating Phase 13

### Layer 2 — settings-validate.js (D-07)
- Added `tifRollingDays: { type: 'integer', min: 3, max: 30 }` to RULES object

### Layer 3a — settings-modal.js (D-07)
- `populateForm`: reads `tifRollingDaysEl` and sets value from `s.tifRollingDays ?? 7`
- `onClose raw`: includes `tifRollingDays: Number(data.get('tifRollingDays') ?? 7)`

### Layer 3b — index.html (D-07)
- Added `<label for="tifRollingDays">TIF history window (days)</label>` and `<input type="number" id="tifRollingDays" name="tifRollingDays" min="3" max="30" step="1">` inside `#tifOptions` fieldset

### Layer 4 — forecast-tif.js (D-06, D-09, D-10, D-15)
- New 4-param signature: `tifForecast(dayRecords, settings, activityLog = {}, isNoNapDay = false)`
- History slice: `const tifRollingDays = settings.tifRollingDays ?? 7; const window = dayRecords.slice(-tifRollingDays);`
- `actBeforeNapPerDay = window.map(d => activityLog[d.date] != null ? activityLog[d.date] : activityBeforeNap(d))`
- `actBeforeNap = actBeforeNapPerDay.filter(v => v !== null)` — existing windows unchanged

### Layer 5 — today-screen.js (D-10, D-15)
- `const activityLog = eventLog.getActivityLog();`
- `const isNoNapDay = (forecastContext.currentHour >= snap.eveningHour) && (todayDayRecord?.napStart == null);`
- `tifForecast(forecastDays, snap, activityLog, isNoNapDay)` — 4-arg call

### Test Coverage
- Integration test fixture updated with `tifRollingDays: 7`
- `settings-validate.test.js`: RULES count updated to 21, validFields objects updated, 7 new tifRollingDays tests added (boundaries 3/7/30, rejections 2/31/7.5)
- `db-shape.test.js`: DEFAULT_SETTINGS count updated to 21, tifRollingDays default test added, Phase 13 migration injection + no-clobber tests added

## Verification Results

```
node --test tests/integration/forecast-tif.integration.test.js
→ 10/10 pass

npm run test:unit
→ 706/706 pass (0 failures)
```

## Deviations from Plan

None — plan executed exactly as written. The 5-layer wiring matched the `<action>` instructions precisely.

## Known Stubs

None. All 7 files fully wired; no placeholder data or TODO markers introduced.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The `activityLog` parameter is a simple POJO already available to today-screen.js from the same event store — no new trust boundary crossed (T-13-01-04 accepted). `tifRollingDays` validated by settings-validate.js (T-13-01-01 mitigated). `activityLog[d.date] != null` guard handles non-numeric values (T-13-01-02 mitigated per plan).

## Self-Check: PASSED

- js/lib/db-shape.js: FOUND
- js/lib/settings-validate.js: FOUND
- js/ui/settings-modal.js: FOUND
- index.html: FOUND
- js/lib/forecast-tif.js: FOUND
- js/ui/today-screen.js: FOUND
- tests/integration/forecast-tif.integration.test.js: FOUND
- tests/unit/settings-validate.test.js: FOUND
- tests/unit/db-shape.test.js: FOUND
- Commit e731144: FOUND (tracer task 1)
- Commit fa0f665: FOUND (test task 2)
