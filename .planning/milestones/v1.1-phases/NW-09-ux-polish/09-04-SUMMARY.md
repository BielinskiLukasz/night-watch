---
phase: NW-09
plan: "04"
subsystem: settings, quick-log
tags: [CFG-10, LOG-10, data-model, settings-ui, today-screen]
requires: []
provides: [confirmBeforeLogging-setting, confirm-before-logging-handler]
affects: [js/lib/db-shape.js, js/lib/settings-validate.js, js/ui/settings-modal.js, js/ui/today-screen.js, js/app.js, index.html]
tech_stack:
  added: []
  patterns: [tdd, clock-adapter-seam, adapter-injection, formdata-coercion]
key_files:
  created:
    - tests/integration/today-confirm-logging.test.js
  modified:
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - js/ui/settings-modal.js
    - js/ui/today-screen.js
    - js/app.js
    - index.html
decisions:
  - "D9-13: confirmBeforeLogging default is false — instant-log is the default path"
  - "clock dep threaded to mountTodayScreen via app.js; tests use data-layer only (no DOM)"
  - "clock.now() used (not Date constructor) per clock-adapter seam invariant D-07"
metrics:
  duration_seconds: 802
  completed_date: "2026-07-10"
  tasks_completed: 2
  files_modified: 7
status: complete
---

# Phase 9 Plan 04: Confirm-Before-Logging Setting Summary

**One-liner:** `confirmBeforeLogging: false` added to data model and wired to quick-log handler — when ON, quick-log opens the manual-entry dialog pre-filled with clicked type and current clock time.

**Requirements met:** CFG-10, LOG-10

## Changes

- `js/lib/db-shape.js`: `confirmBeforeLogging: false` added to `DEFAULT_SETTINGS`; JSDoc updated; `migrateV1ToV2` injects the field for v2 blobs predating Phase 9
- `js/lib/settings-validate.js`: `confirmBeforeLogging: { type: 'boolean' }` added to `RULES` — validated by the existing `'boolean'` branch in `checkField()`
- `index.html`: "Day Structure" fieldset legend renamed to "Time &amp; Day" (D9-12); `<label class="checkboxRow">` with `confirmBeforeLogging` checkbox added as the last control in that fieldset
- `js/ui/settings-modal.js`: checkbox populated from `snap.confirmBeforeLogging` via `confirmEl.checked = Boolean(snap.confirmBeforeLogging)`; saved via `data.get('confirmBeforeLogging') === 'on'` coercion in the raw object
- `js/ui/today-screen.js`: `clock` parameter added to `mountTodayScreen` deps; `formatLocalISO` imported from `../lib/time.js`; quick-log click handler reads `settings.get().confirmBeforeLogging` at click time — when true AND clock present, calls `openManualEntry({ mode: 'add', existing: { type, at: nowISO }, ... })` preserving the clock-adapter seam (D-07); when false falls through to `eventLog.addEvent(type)` as before
- `js/app.js`: `clock` threaded to `mountTodayScreen` call
- `tests/integration/today-confirm-logging.test.js`: data-layer round-trip tests for `DEFAULT_SETTINGS.confirmBeforeLogging`, `validateSettings` with `true/false/'yes'`; DOM-dependent UI flow deferred to E2E tests in Plan 09-06

## Tests

- All 521 unit + integration tests pass (0 failures)
- `db-shape.test.js`: key count updated to 13; `confirmBeforeLogging: false` default; migration injection tests
- `settings-validate.test.js`: RULES count updated to 13; `confirmBeforeLogging` boolean validation tests
- `tests/integration/today-confirm-logging.test.js`: new file, data-layer coverage

## Deviations from Plan

**1. [Rule 1 - Bug] Comment triggered clock-seam security scanner**
- **Found during:** Task 2 verification
- **Issue:** Comment `// not new Date() here` in today-screen.js matched the regex `/\bnew\s+Date\s*\(\s*\)/` used by the security smoke test scanner, causing a false-positive clock-seam violation
- **Fix:** Rewrote comment to not contain `new Date()` literal
- **Files modified:** `js/ui/today-screen.js`
- **Commit:** 29f599a

**2. [Rule 1 - Bug] `validFields` in settings-validate.test.js missing new field**
- **Found during:** Task 1 GREEN phase
- **Issue:** Two `validFields` constants in the stages/activeStageId test blocks had 12 hardcoded fields; adding `confirmBeforeLogging` to RULES caused those tests to fail with validation errors for the missing field
- **Fix:** Added `confirmBeforeLogging: false` to both `validFields` definitions
- **Files modified:** `tests/unit/settings-validate.test.js`
- **Commit:** fe7b71e

## Commits

- `fe7b71e` — feat(NW-09-04): add confirmBeforeLogging to data model (CFG-10, D9-13)
- `29f599a` — feat(NW-09-04): wire confirmBeforeLogging to UI and quick-log handler

## Self-Check

- [x] `js/lib/db-shape.js` exists and contains `confirmBeforeLogging: false`
- [x] `js/lib/settings-validate.js` exists and contains `confirmBeforeLogging.*boolean`
- [x] `index.html` contains `Time &amp; Day` legend and `confirmBeforeLogging` checkbox
- [x] `js/ui/settings-modal.js` contains confirmBeforeLogging in both population and save paths
- [x] `js/ui/today-screen.js` contains `confirmBeforeLogging` handler and `clock` parameter
- [x] `js/app.js` passes `clock` to `mountTodayScreen`
- [x] All 521 unit + integration tests pass
