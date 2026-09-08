---
phase: NW-12
plan: "01"
subsystem: forecast
tags: [settings, prediction, PRED-08, UI-07, migration, tdd]

requires:
  - phase: NW-10
    provides: "forecastAlgorithm/trimPct/precisionTarget settings fields; TIF algorithm toggle"
provides:
  - "DEFAULT_SETTINGS extended with 4 Phase 12 fields: eveningHour (18), intenseDays ([]), noNapBedtimeOffsetMinutes (30), intenseDayOffsetMinutes (30)"
  - "selectNextEvent third param `settings` for PRED-08 evening-hour override"
  - "EVENT_TYPES in today-screen.js reordered to wake → napStart → napEnd → bedtime (UI-07)"
  - "Phase 12 forward-compat migration block in migrateV1ToV2"
  - "Settings modal Forecast fieldset: eveningHour and noNapBedtimeOffsetMinutes inputs"
affects:
  - NW-12 plans 02–06 (all use settings with Phase 12 fields)
  - today-screen (card order change visible to user)
  - forecast (selectNextEvent signature change)

tech-stack:
  added: []
  patterns:
    - "PRED-08 evening-hour override: time-invariant CI approach using eveningHour=0 (always fires) / eveningHour=25 (never fires) in tests"
    - "TDD tracer: RED commit with failing tests → GREEN commit with implementation; pre-existing tests updated inline"

key-files:
  created: []
  modified:
    - js/lib/db-shape.js
    - js/lib/forecast.js
    - js/lib/settings-validate.js
    - js/ui/today-screen.js
    - js/ui/settings-modal.js
    - index.html
    - tests/unit/db-shape.test.js
    - tests/unit/forecast.test.js
    - tests/unit/settings-validate.test.js

key-decisions:
  - "Use eveningHour=0/25 in tests (not wall-clock mocking) for CI-stable PRED-08 override verification"
  - "buildResult extracted as inner function in selectNextEvent to share isMissed logic between PRED-08 branch and switch branch without duplication"
  - "intenseDayOffsetMinutes and intenseDays are not form inputs in Phase 12 Plan 01 — read from current settings on save (form fields added in later plans)"

requirements-completed:
  - UI-07
  - PRED-08

coverage:
  - id: D1
    description: "DEFAULT_SETTINGS has 20 keys including eveningHour (18), intenseDays ([]), noNapBedtimeOffsetMinutes (30), intenseDayOffsetMinutes (30)"
    requirement: PRED-08
    verification:
      - kind: unit
        ref: "tests/unit/db-shape.test.js#has exactly 20 keys (16 prior + 4 new Phase 12 fields)"
        status: pass
      - kind: unit
        ref: "tests/unit/db-shape.test.js#has eveningHour: 18 default (PRED-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 12 forward-compat migration block injects 4 new fields into old v2 blobs"
    requirement: PRED-08
    verification:
      - kind: unit
        ref: "tests/unit/db-shape.test.js#v2 blob without Phase 12 fields: migrateV1ToV2 injects all 4 new fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "selectNextEvent PRED-08 override: eveningHour=0 + lastEvent=wake returns bedtime; eveningHour=25 falls through to napStart"
    requirement: PRED-08
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#eveningHour=0, lastEvent.type=wake → returns bedtime"
        status: pass
      - kind: unit
        ref: "tests/unit/forecast.test.js#eveningHour=25, lastEvent.type=wake → returns napStart"
        status: pass
    human_judgment: false
  - id: D4
    description: "EVENT_TYPES in today-screen.js is ['wake','napStart','napEnd','bedtime'] — bedtime renders last"
    requirement: UI-07
    verification: []
    human_judgment: true
    rationale: "Card render order is a visual browser-only concern; verified by inspection in the running app"
  - id: D5
    description: "Settings modal Forecast fieldset shows Evening hour and No-nap bedtime offset inputs with correct defaults"
    requirement: PRED-08
    verification: []
    human_judgment: true
    rationale: "DOM rendering requires browser; verify visually that inputs appear and populate correctly on settings open"

duration: 10min
completed: 2026-08-25
status: complete
---

# Phase NW-12 Plan 01: Wire settings migration → PRED-08 → UI-07 end-to-end (Tracer)

**Four-layer settings-to-display tracer: db-shape migration (4 new Phase 12 fields) → selectNextEvent PRED-08 evening-hour override → today-screen card order fix (UI-07) → settings form inputs wired and saved**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-25T17:49:57Z
- **Completed:** 2026-08-25T18:00:17Z
- **Tasks:** 1 (tracer, TDD)
- **Files modified:** 9

## Accomplishments

- Extended `DEFAULT_SETTINGS` from 16 to 20 keys with Phase 12 prediction-refinement fields (`eveningHour`, `intenseDays`, `noNapBedtimeOffsetMinutes`, `intenseDayOffsetMinutes`)
- Added Phase 12 forward-compat migration block to `migrateV1ToV2` so existing v2 blobs gain all 4 new fields without a schema version bump
- Added `settings` third parameter to `selectNextEvent`; PRED-08 evening-hour override fires when `lastEvent.type === 'wake'` and `nowHour >= eveningHour`, returning bedtime first
- Extracted `buildResult` inner helper in `selectNextEvent` to share isMissed logic between PRED-08 branch and switch branch
- Fixed `EVENT_TYPES` order in `today-screen.js` to `['wake','napStart','napEnd','bedtime']` (UI-07/D-16: bedtime last)
- Passed `settingsSnap` to `selectNextEvent` in `today-screen.js` so the evening-hour setting takes effect at runtime
- Added 4 new validation RULES to `settings-validate.js`
- Added `eveningHour` and `noNapBedtimeOffsetMinutes` inputs to HTML Forecast fieldset; wired to `populateForm` and `raw` assembly in settings-modal.js
- All 658 unit tests pass (zero regressions)

## Task Commits

TDD task (RED → GREEN):

1. **RED — failing tests** - `0081e47` (test)
2. **GREEN — implementation + auto-fixes** - `ede86e1` (feat)

## Files Created/Modified

- `js/lib/db-shape.js` — 4 new DEFAULT_SETTINGS keys; Phase 12 migration block
- `js/lib/forecast.js` — selectNextEvent gains settings param, PRED-08 branch, buildResult helper
- `js/lib/settings-validate.js` — 4 new RULES entries
- `js/ui/today-screen.js` — EVENT_TYPES order fixed; settingsSnap passed to selectNextEvent
- `js/ui/settings-modal.js` — populateForm + raw assembly updated for 2 new form fields
- `index.html` — eveningHour and noNapBedtimeOffsetMinutes inputs in Forecast fieldset
- `tests/unit/db-shape.test.js` — 20-key count assertion; 4 new field assertions; Phase 12 migration test block
- `tests/unit/forecast.test.js` — PRED-08 evening-hour test group; pre-existing wake→napStart tests updated to use eveningHour=25
- `tests/unit/settings-validate.test.js` — key-count assertions updated 16→20; validFields objects updated with 4 new fields

## Decisions Made

- **Time-invariant CI testing for PRED-08:** Use `eveningHour=0` (always fires, any hour >= 0) and `eveningHour=25` (never fires, no hour >= 25) in tests instead of mocking `new Date().getHours()`. This avoids clock-mocking complexity while remaining unambiguous.
- **buildResult inner function:** Extracted the isMissed/return-shape logic into a named inner function so the PRED-08 early-return and the switch-based path both call the same code without duplication.
- **intenseDayOffsetMinutes and intenseDays not in form:** These two fields are not form inputs in Plan 01 — they are read from current settings on Save. Form inputs for them are deferred to later plans that implement the full intense-days feature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated pre-existing selectNextEvent tests for PRED-08 compatibility**
- **Found during:** Task 1 GREEN phase
- **Issue:** Two existing tests used `lastEvent='wake'` without disabling the PRED-08 override, causing them to fail when `new Date().getHours() >= 18` at runtime ("last event = wake → selects napStart" and "probabilityBand prediction")
- **Fix:** Added `{ eveningHour: 25 }` third argument to those two `selectNextEvent()` calls so the override never fires, preserving original test semantics without mocking the clock
- **Files modified:** `tests/unit/forecast.test.js`
- **Verification:** All 658 unit tests pass including PRED-08 group and prior selectNextEvent groups
- **Committed in:** `ede86e1` (GREEN commit)

**2. [Rule 1 - Bug] Updated settings-validate.test.js for 20-key RULES**
- **Found during:** Task 1 GREEN phase (`npm run test:unit`)
- **Issue:** Two key-count assertions hard-coded `16`; two `validFields` objects in the stages and activeStageId describe blocks omitted the 4 new Phase 12 fields, causing `validateSettings` to return `ok: false` (missing fields fail integer/string[] validation)
- **Fix:** Updated count assertions to `20`; added `intenseDays: [], eveningHour: 18, noNapBedtimeOffsetMinutes: 30, intenseDayOffsetMinutes: 30` to both hardcoded `validFields` objects
- **Files modified:** `tests/unit/settings-validate.test.js`
- **Verification:** All 658 unit tests pass
- **Committed in:** `ede86e1` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in pre-existing tests exposed by the PRED-08 implementation)
**Impact on plan:** All auto-fixes necessary for test correctness; no scope creep; plan semantics fully preserved.

## Issues Encountered

None beyond the two pre-existing test compatibility issues documented as deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 12 Plan 01 tracer complete: full data flow proven end-to-end
- Plan 02 onwards can build on the `eveningHour` setting and PRED-08 logic
- `intenseDayOffsetMinutes` and `intenseDays` are in DEFAULT_SETTINGS and RULES; form inputs deferred to the plans that implement the full intense-days feature

## Self-Check: PASSED

All modified files confirmed present. Both task commits (0081e47, ede86e1) confirmed in git history. 658 unit tests pass.
