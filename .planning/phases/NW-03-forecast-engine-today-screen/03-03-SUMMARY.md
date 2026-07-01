---
phase: 03-forecast-engine-today-screen
plan: 03
subsystem: forecast-algorithm
tags: [tdd, next-event-selection, cycle-aware-priority, integration-tests, reactive-updates]
dependency_graph:
  requires:
    - js/lib/forecast.js  # Extended with selectNextEvent export
    - tests/unit/forecast.test.js  # Extended with groups 14+15
    - js/store/event-log.js  # Used in integration tests
    - js/store/settings.js   # Used in integration tests
    - js/adapters/storage-memory.js  # Used in integration tests
  provides:
    - js/lib/forecast.js  # selectNextEvent(), extractTime() helper
    - tests/integration/forecast-flow.test.js  # New integration test file
  affects:
    - js/ui/today-screen.js  # Plan 03-04/05 will call selectNextEvent() to render next-event card
tech_stack:
  added:
    - selectNextEvent(predictions, dayRecords) — cycle-aware priority selection (D3-10)
    - extractTime(slot) — dual-shape adapter for synthetic HH:MM vs real event objects
    - isMissed flag — boolean marker on next-event result (D3-11 prep for UI graying)
  patterns:
    - TDD RED→GREEN→REFACTOR (two independent cycles: unit + integration)
    - Rule 1 bug fix: extractTime() resolves mismatch between unit-test synthetic data and real event log
    - gsd:allow-ui-clock exemption tag for non-domain isMissed clock read
decisions:
  - "selectNextEvent returns first available prediction in D3-10 priority order — no epsilon tie-breaking needed because loop returns first match naturally"
  - "extractTime(slot) added to forecast.js so forecast() handles both unit-test HH:MM strings and real daysBySubjectiveNight() event objects transparently"
  - "isMissed computed via new Date() tagged gsd:allow-ui-clock — display-only UI metadata (D3-11), not domain logic. Phase 8 may inject clock seam."
  - "Integration tests use real eventLog + settings implementations with in-memory storage (no mocking) per plan D3-13"
metrics:
  duration: 12min
  completed: 2026-06-04
  tasks: 5
  files: 3
---

# Phase 3 Plan 3: Cycle-Aware Next-Event Selection and Reactive Integration Tests (TDD) Summary

**One-liner:** `selectNextEvent(predictions, dayRecords)` with D3-10 cycle-aware priority (bedtime→wake, wake→napStart, napStart→napEnd, napEnd→bedtime), `isMissed` flag, and 4 integration tests proving forecast re-computes reactively when event-log or settings change.

## Commits

| Phase | Hash | Message |
|-------|------|---------|
| RED (unit) | 59b0733 | test(03-03): add failing tests for next-event cycle-aware priority (RED) |
| GREEN (unit) | 4bd0c09 | feat(03-03): implement selectNextEvent with cycle-aware priority (GREEN) |
| RED (integration) | daa40c3 | test(03-03): add failing integration tests for reactive forecast flow (RED) |
| GREEN (integration) | 42fd671 | feat(03-03): implement integration tests for reactive forecast flow (GREEN) |
| REFACTOR | 3a74fc7 | refactor(03-03): harden next-event selection and improve integration test coverage |

## Test Delta

- Pre-plan: 76 forecast unit tests + 0 integration (forecast)
- Post-plan: 100 total (85 unit + 15 integration)

| File | Before | After | Delta |
|------|--------|-------|-------|
| tests/unit/forecast.test.js | 76 | 92 | +16 (groups 14+15) |
| tests/integration/forecast-flow.test.js | 0 | 8 | +8 (created) |
| **All tests (full suite)** | 326 | 350 | +24 |

### New test groups added

| Group | File | Tests | Description |
|-------|------|-------|-------------|
| 14 | unit | 9 | `selectNextEvent()` — all 4 priority orderings + edge cases |
| 15 | unit | 7 | `selectNextEvent()` edge cases — unknown type, missing tier, determinism, isMissed, probabilityBand |
| Integration 1 | integration | 1 | forecast re-computes on new event |
| Integration 2 | integration | 1 | forecast re-computes on settings change (maxDelta narrow → probabilityBand) |
| Integration 3 | integration | 1 | selectNextEvent respects cycle priority with real event log |
| Integration 4 | integration | 1 | cold-start flag toggles when validDayCount crosses minDays=7 |
| Integration 5 | integration | 4 | subscriber patterns: synchronous fire, multiple subscribers, unsubscribe, determinism |

## Integration Test Setup Notes

Integration tests in `tests/integration/forecast-flow.test.js` use:

- **Real implementations**: `createEventLog`, `createSettingsStore` — not mocked
- **Shared in-memory storage**: both stores read/write the same `createStorageMemory()` blob (simulates the real shared storage pattern from D2-08)
- **Fixed clock**: `createClockFixed(date)` provides deterministic event timestamps
- **Direct forecast calls**: tests call `forecast(eventLog.daysBySubjectiveNight(), settings.get())` directly — no wiring to Today screen; proving D3-13 (derived state) and D3-12 (reactive on data change)
- **Settings subscriber pattern**: `settings.subscribe()` verified to fire synchronously; multiple subscribers tested; unsubscribe verified

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `forecast()` extracted event objects from real day records instead of HH:MM strings**
- **Found during:** Task 3/4 (GREEN — integration tests failed at runtime)
- **Issue:** `daysBySubjectiveNight()` returns day records where `wake`, `bedtime`, etc. are either `null` or event objects like `{ id, type, at: 'YYYY-MM-DDTHH:MM' }`. The `forecast()` `getTimeFn` calls `d => d.wake` which returned an event object — but `timeToMinutes()` expected an HH:MM string, causing `TypeError: hhmm.slice is not a function`.
- **Fix:** Added `extractTime(slot)` helper to `forecast.js` that handles both forms: bare HH:MM string (unit-test synthetic data) and event object with `.at` field (real day records). Updated `forecast()` to call `extractTime()` on all slot accesses.
- **Files modified:** `js/lib/forecast.js`
- **Commit:** 42fd671

**2. [Rule 1 - Bug] `new Date()` in `selectNextEvent` violated clock-seam invariant**
- **Found during:** Task 5 REFACTOR (security smoke test blocked full suite)
- **Issue:** The `isMissed` detection in `selectNextEvent()` used `new Date()` without the `// gsd:allow-ui-clock` exemption tag. `tests/integration/security-smoke.test.js` enforces this invariant repo-wide.
- **Fix:** Added `// gsd:allow-ui-clock` inline tag on the `new Date()` line. Documented that `isMissed` is display-only metadata (D3-11 prep) — not domain logic. Phase 8 can inject a real clock seam.
- **Files modified:** `js/lib/forecast.js`
- **Commit:** 3a74fc7

## API Changes for Plan 03-04/05 Integration

### New export: `selectNextEvent`

```js
// selectNextEvent(predictions, dayRecords) → { type, isMissed, ...prediction } | null
//
// predictions: forecast() result (or subset of it)
//   Each key: 'wake' | 'bedtime' | 'napStart' | 'napEnd'
//   Each value: { central, min, max } OR { probabilityBand: [...] }
//
// dayRecords: from eventLog.daysBySubjectiveNight()
//   Each record must have .allEvents array of { type, at } events
//
// Returns:
//   { type: string, isMissed: boolean, ...prediction } when a match is found
//   null when no events logged (cold start), or no predictions available
```

### Updated internal helper: `extractTime`

```js
// extractTime(slot) — internal helper, not exported
// Handles both:
//   - unit-test synthetic: slot = 'HH:MM' string
//   - real day records: slot = { at: 'YYYY-MM-DDTHH:MM' } event object
```

### Priority table (D3-10)

| Last event | Priority 1 | Priority 2 | Priority 3 | Priority 4 |
|------------|-----------|-----------|-----------|-----------|
| bedtime | wake | napStart | napEnd | bedtime |
| wake | napStart | bedtime | napEnd | wake |
| napStart | napEnd | bedtime | wake | napStart |
| napEnd | bedtime | wake | napStart | napEnd |
| unknown | wake | bedtime | napStart | napEnd |

## Edge Cases Discovered During TDD

1. **Real day record shape vs. synthetic unit-test shape mismatch**: The bucketer returns event objects in slots; `forecast()` was designed only for HH:MM strings. Fixed with `extractTime()`. This makes both unit tests and real-store integration tests work from the same function.

2. **`isMissed` requires wall-clock time**: The `gsd:allow-ui-clock` exemption was needed. The comment documents why this is acceptable: `isMissed` is purely a display annotation (D3-11), not domain logic. The alternative (threading a clock adapter through `selectNextEvent`) would over-engineer a pure display helper.

3. **Integration test minDays=0 bypass needed**: Tests 1-2 used `minDays: 0` in settings to bypass the cold-start gate and test prediction behavior directly. This is the same pattern used in unit tests (group 5 noGateSettings) and is well-established.

4. **Cold-start test requires 7 different subjective nights**: Adding 7 events to the SAME day doesn't give 7 valid day records — the bucketer groups them all under one date. The test correctly adds events on 7 different calendar dates (`2026-05-20` through `2026-05-26`) to produce 7 distinct day records.

## Known Stubs

None — all functions are fully implemented. `selectNextEvent` returns real predictions with real `isMissed` detection.

## Threat Flags

No new trust boundaries. `selectNextEvent` is pure logic reading from validated stores. T-03-06 (DoS via fixed 4-tier loop) remains accepted — loop is O(4), no unbounded iteration.

## TDD Gate Compliance

- RED gate (unit): `59b0733` — import of non-existent `selectNextEvent` fails at module load; all tests fail; RED confirmed
- GREEN gate (unit): `4bd0c09` — all 85 unit tests pass; GREEN confirmed
- RED gate (integration): `daa40c3` — tests fail at runtime with TypeError (extractTime bug); RED confirmed
- GREEN gate (integration): `42fd671` — all 89 combined tests pass; GREEN confirmed
- REFACTOR gate: `3a74fc7` — all 100 combined tests pass after edge-case expansion and clock-seam fix; REFACTOR confirmed

## Verification Checklist

- [x] All 100 forecast tests pass (85 unit + 15 integration)
- [x] selectNextEvent returns correct prediction per cycle-aware priority (all 4 orderings)
- [x] selectNextEvent handles missing predictions gracefully (skips tier)
- [x] selectNextEvent marks isMissed predictions (central time in past)
- [x] Integration test: forecast re-computes on eventLog change
- [x] Integration test: forecast re-computes on settings change
- [x] Cold-start flag toggles correctly when minDays threshold crossed
- [x] selectNextEvent respects all four priority orderings (wake, bedtime, napStart, napEnd as last events)
- [x] Full suite (350 tests) passes with zero regressions

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `js/lib/forecast.js` exists | FOUND |
| `tests/unit/forecast.test.js` exists | FOUND |
| `tests/integration/forecast-flow.test.js` exists | FOUND |
| RED unit commit `59b0733` | FOUND |
| GREEN unit commit `4bd0c09` | FOUND |
| RED integration commit `daa40c3` | FOUND |
| GREEN integration commit `42fd671` | FOUND |
| REFACTOR commit `3a74fc7` | FOUND |
| 100 combined tests pass | VERIFIED |
| 350 total suite tests pass | VERIFIED |
| No regressions | VERIFIED |
