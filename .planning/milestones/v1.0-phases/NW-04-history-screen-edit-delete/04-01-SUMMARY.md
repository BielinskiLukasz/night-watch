---
phase: NW-04-history-screen-edit-delete
plan: 01
subsystem: data-model
tags: [settings, day-bucket, forecast, rejected-days, cfg-05]

# Dependency graph
requires:
  - phase: NW-03-forecast-engine-today-screen
    provides: "forecast.js downweightRejectedDays + calculatePercentiles with day.rejected boolean"
  - phase: NW-02-configuration-settings
    provides: "DEFAULT_SETTINGS in db-shape.js, createSettingsStore, migrateV1ToV2, validateSettings"
provides:
  - "DEFAULT_SETTINGS.rejectedDays: [] field (CFG-05 persistent store for outlier days)"
  - "migrateV1ToV2 backfills rejectedDays on pre-Phase-4 v2 blobs without data loss"
  - "daysByCalendar(events, limit, settings) and daysBySubjectiveNight(events, cutoverHour, limit, settings) both compute day.rejected boolean from settings.rejectedDays"
  - "RULES in settings-validate.js extended with string[] type for rejectedDays"
  - "Integration test confirming settings.update() → subscriber → forecast re-compute flow"
affects: [NW-04-history-screen-edit-delete wave2, wave3, wave4, NW-05-import-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rejection state derived at render time from settings.rejectedDays (not stored on events) — keeps canonical source singular (D4-05, D4-14)"
    - "annotateRejected() fast-path skips per-record includes() when rejectedDays is empty"
    - "RULES type:'string[]' enables settings-validate to accept rejectedDays patches from update()"
    - "Optional settings 4th param on daysBySubjectiveNight preserves backward compat with all prior callers"

key-files:
  created:
    - tests/integration/rejected-days-forecast-sync.test.js
  modified:
    - js/lib/db-shape.js
    - js/lib/day-bucket.js
    - js/lib/settings-validate.js
    - tests/unit/db-shape.test.js
    - tests/unit/day-bucket.test.js
    - tests/unit/settings-validate.test.js

key-decisions:
  - "Option A selected for rejection storage: list of date strings in settings.rejectedDays (not event-property-based) — leverages existing settings-store subscription pattern, avoids separate store"
  - "day.rejected is derived at render time from settings.rejectedDays; never stored on event objects (D4-14)"
  - "annotateRejected() fast-paths the empty-list case to avoid unnecessary includes() calls per record (T-04-03 accept)"
  - "migrateV1ToV2 mutates v2 blobs in place to backfill missing rejectedDays field, preserving the idempotency reference-return contract for v2"
  - "RULES type:'string[]' added to settings-validate with minimal validation (array of strings, no date format enforcement) per D4-14"

patterns-established:
  - "annotateRejected(records, settings): reusable rejection annotation helper — call after bucketBy() in both public day-bucket functions"
  - "settings 4th param pattern for day-bucket public API: callers that need rejection state inject settings; legacy callers continue omitting it"

requirements-completed: [CFG-05]

# Metrics
duration: 12min
completed: 2026-06-06
---

# Phase 4 Plan 01: Rejected-Day Storage Foundation Summary

**rejectedDays array added to DEFAULT_SETTINGS + day.rejected boolean computed in day-bucket at render time from settings, with migration backfill and full unit + integration test coverage**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-06T10:17:24Z
- **Completed:** 2026-06-06T10:29:44Z
- **Tasks:** 3
- **Files modified:** 6 (+ 1 created)

## Accomplishments

- Extended DEFAULT_SETTINGS with `rejectedDays: []` (CFG-05) and updated migrateV1ToV2 to backfill the field on pre-Phase-4 v2 blobs without data loss
- Added `annotateRejected()` helper to day-bucket that derives `day.rejected` boolean from `settings.rejectedDays` at render time; both public functions accept optional settings param with backward-compat fallback to `rejected=false`
- Added `string[]` type to settings-validate RULES so `settings.update({ rejectedDays: [...] })` passes validation; extended key-count from 9 to 10
- 5-test integration test confirming subscriber fires synchronously on rejectedDays update and that the 0.5× downweighted forecast produces a measurably different central time

## Task Commits

1. **Task 1: Extend DEFAULT_SETTINGS + migration** - `47bf1d0` (feat)
2. **Task 2: Compute day.rejected in day-bucket** - `17481f8` (feat)
3. **Task 3: Integration test + settings-validate extension** - `d1e6376` (feat)

## Files Created/Modified

- `js/lib/db-shape.js` - Added `rejectedDays: []` to DEFAULT_SETTINGS; migrateV1ToV2 backfills missing field on v2 blobs
- `js/lib/day-bucket.js` - Added `annotateRejected(records, settings)` helper; updated `daysByCalendar` and `daysBySubjectiveNight` signatures with optional settings param
- `js/lib/settings-validate.js` - Added `rejectedDays: { type: 'string[]' }` to RULES; added `string[]` case to `checkField()` dispatcher
- `tests/unit/db-shape.test.js` - Updated key count 9→10; added 7 rejectedDays-specific tests (fresh install, v1 migration, v2 backfill, non-clobber)
- `tests/unit/day-bucket.test.js` - Added 8 rejection annotation tests for both `daysByCalendar` and `daysBySubjectiveNight`
- `tests/unit/settings-validate.test.js` - Updated key count assertions 9→10; updated field list to include rejectedDays
- `tests/integration/rejected-days-forecast-sync.test.js` (created) - 5 integration tests covering subscriber synchrony, day.rejected derivation, forecast shift, full round-trip, and rejection-clear restore

## Decisions Made

- **Option A for rejection storage:** list of date strings in `settings.rejectedDays` (not event-property-based). Rationale: leverages existing settings-store subscription pattern, single source of truth, avoids a separate store.
- **Derived-not-stored:** `day.rejected` is never stored on event objects; derived at render time from `settings.rejectedDays.includes(day.date)`. Keeps canonical source singular, eliminates sync risk.
- **annotateRejected fast-path:** skip per-record `includes()` when `rejectedDays` is empty (typical cold-start case). Micro-optimization consistent with T-04-03 accept disposition.
- **migrateV1ToV2 mutates v2 blobs in place** for the backfill case rather than creating a new object, to preserve the v2 idempotency contract (same reference return).
- **RULES string[] type with minimal validation** (array-of-strings only, no date format enforcement per D4-14). Format validation is intentionally deferred to the History screen UI in Wave 3–4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended settings-validate RULES with rejectedDays**
- **Found during:** Task 3 (running full test suite after integration test commit)
- **Issue:** Adding `rejectedDays` to DEFAULT_SETTINGS made `settings.update({ rejectedDays: [...] })` pass through validation only by luck (validated fields come from RULES; non-RULES fields pass through as defaults from normalized = { ...defaults }). But `settings-validate.test.js` asserted `Object.keys(RULES).length === 9`, which failed after DEFAULT_SETTINGS grew to 10 keys. More critically, RULES not having a rejectedDays entry meant the validator would silently drop a rejectedDays patch in mode:'save' (it would reset to the default from normalized rather than accepting the user's value).
- **Fix:** Added `rejectedDays: { type: 'string[]' }` to RULES; added `string[]` case to `checkField()` that accepts any `Array<string>` value; updated test key counts from 9 to 10.
- **Files modified:** `js/lib/settings-validate.js`, `tests/unit/settings-validate.test.js`
- **Verification:** Full test suite (370 tests) passes, including the new key-count assertions.
- **Committed in:** `d1e6376` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality)
**Impact on plan:** Auto-fix was necessary for correctness: without it, `settings.update({ rejectedDays: [...] })` would silently fail to persist the user's rejection list in mode:'save'. No scope creep.

## Issues Encountered

- **Forecast shift test required larger maxDelta:** Initial test used `maxDelta=120` which triggered the probability-band path (the 150-min spread exceeded 120-min threshold), returning `{ probabilityBand: [...] }` instead of `{ central, min, max }`. Fixed by using `maxDelta=300`. Also the initial data set (06:30..06:55 uniform spread) produced the same rounded 5-min central value before and after rejection downweighting. Switched to a stepped data set (`06:00, 06:15, 06:30, 06:45, 07:00, 08:00, 09:00`) where the P50 shift (06:45 → 06:40) is visible after 5-minute rounding.

## Known Stubs

None — all functionality implemented end-to-end. Wave 2–4 will wire the rejection UI (toggle column, History screen) but the data model and annotation are fully functional.

## Threat Flags

No new threat surface introduced. All changes are within the existing trust boundary: settings are user-editable local data, and the `day.rejected` boolean is derived from them with no external input.

## Next Phase Readiness

- Wave 2 (History table scaffold) can call `daysByCalendar(events, limit, settingsSnap)` and receive `day.rejected` without any additional plumbing.
- Wave 3–4 (toggle UI and wiring) can call `settings.update({ rejectedDays: [...] })` and rely on subscriber-triggered forecast re-compute.
- `settings.update({ rejectedDays })` is validated by the `string[]` RULES type; History screen UI may add date-format validation at the input layer.

---
*Phase: NW-04-history-screen-edit-delete*
*Completed: 2026-06-06*
