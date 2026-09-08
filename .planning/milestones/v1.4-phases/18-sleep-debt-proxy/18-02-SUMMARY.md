---
phase: 18-sleep-debt-proxy
plan: 18-02
subsystem: settings
status: complete
tags: [settings, validation, tdd, metrics, ui]
completed: "2026-09-03"
duration_minutes: 10
tasks_completed: 2
commits: 3

dependency_graph:
  requires:
    - 18-01 (sleepDebtProxy function reads targetSleepMinutes from settings)
  provides:
    - targetSleepMinutes in DEFAULT_SETTINGS (600)
    - targetSleepMinutes validation rule (integer, 1–1440)
    - Settings modal UI input + median hint
  affects:
    - 18-03 (metrics screen render reads snap.settings.targetSleepMinutes)

tech_stack:
  added: []
  patterns:
    - Settings field trio (db-shape DEFAULT_SETTINGS + settings-validate RULES + settings-modal populateForm/onClose)
    - TDD RED/GREEN cycle with node:test
    - XSS guard via textContent-only hint rendering
    - eventLog.daysBySubjectiveNight for median hint computation

key_files:
  created: []
  modified:
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - js/ui/settings-modal.js
    - index.html
    - tests/unit/settings-validate.test.js

decisions:
  - targetSleepMinutes default is 600 (10h) per MET-13/D-01
  - Validation: integer, min 1, max 1440 per D-02 (1 min to 24h)
  - Median hint uses eventLog.daysBySubjectiveNight(cutoverHour) when eventLog is available; silently empty otherwise
  - Median computed as sorted-array middle element (Math.floor(vals.length/2))
  - Two explicit validFields objects in test file updated to include targetSleepMinutes:600 (Rule 1 auto-fix)

actuals:
  tokens: 13750
  tasks: 2
  commits: 3
---

# Phase 18 Plan 02: targetSleepMinutes Settings Field Trio Summary

**One-liner:** targetSleepMinutes setting (default 600 min / 10h) wired schema-to-modal with combinedSleepNap median hint via TDD RED/GREEN

## What Was Built

Applied the settings field trio pattern to add `targetSleepMinutes` (default 600, valid 1–1440) end-to-end:

1. **Schema** (`js/lib/db-shape.js`): Added `targetSleepMinutes: 600` to `DEFAULT_SETTINGS` with JSDoc typedef entry.

2. **Validator** (`js/lib/settings-validate.js`): Added `targetSleepMinutes: { type: 'integer', min: 1, max: 1440 }` to `RULES`. No new `checkField` case needed — `type:'integer'` already handled.

3. **Settings modal** (`js/ui/settings-modal.js`):
   - Imported `combinedSleepNap` from `metrics.js` and `formatDuration` from `time.js`.
   - `populateForm`: guarded line sets input value from `s.targetSleepMinutes ?? 600`.
   - After `populateForm(snap)`: computes all-time median via `eventLog.daysBySubjectiveNight(snap.cutoverHour)`, renders as `'Your median: Xh Ym'` via `textContent` (XSS guard T-18-04). Empty string when no data or no `eventLog`.
   - `onClose` raw-object: `targetSleepMinutes: Number(data.get('targetSleepMinutes') ?? 600)`.

4. **HTML** (`index.html`): Added `<label>` with `<input type="number" id="targetSleepMinutes" name="targetSleepMinutes" min="1" max="1440" step="5">` and `<small id="targetSleepMedianHint" class="hint"></small>` inside the Forecast & Prediction fieldset, after `noNapBedtimeOffsetMinutes` and before `tifOptions`.

5. **Tests** (`tests/unit/settings-validate.test.js`):
   - RED: updated RULES count assertion (22→23), added `targetSleepMinutes` to expected field list, added 7-test describe block.
   - GREEN: all 104 tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two explicit `validFields` objects in tests to include `targetSleepMinutes`**
- **Found during:** GREEN phase — 5 tests still failing after implementing the rule
- **Issue:** The `stages (D6-01)` and `activeStageId (D6-02)` describe blocks use explicit `validFields` constants that enumerate all expected settings fields. Adding `targetSleepMinutes` to RULES caused these previously-passing tests to fail because the input objects lacked the new required field.
- **Fix:** Added `targetSleepMinutes: 600` to both `validFields` objects.
- **Files modified:** `tests/unit/settings-validate.test.js`
- **Commit:** Included in GREEN commit `7e84f4a`

## TDD Gate Compliance

- RED gate commit: `b99a82c` — `test(18-02): add failing tests for targetSleepMinutes validation`
- GREEN gate commit: `7e84f4a` — `feat(18-02): add targetSleepMinutes to DEFAULT_SETTINGS and RULES`
- 5 tests failing in RED; 0 failing in GREEN (all 104 pass). Gate sequence satisfied.

## Known Stubs

None. All functionality wired end-to-end.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-18-03 mitigated | js/lib/settings-validate.js | targetSleepMinutes integer/range validation enforced in mode:'save' |
| T-18-04 mitigated | js/ui/settings-modal.js | median hint rendered via .textContent only, no innerHTML |
| T-18-05 mitigated | js/ui/settings-modal.js | onClose uses Number() which produces integer for step=5 integer inputs; mode:'save' validates as integer |

## Self-Check: PASSED

- FOUND: js/lib/db-shape.js
- FOUND: js/lib/settings-validate.js
- FOUND: js/ui/settings-modal.js
- FOUND: index.html
- FOUND: 18-02-SUMMARY.md
- FOUND: b99a82c (RED commit)
- FOUND: 7e84f4a (GREEN commit)
- FOUND: e3eb2c4 (Task 2 commit)
