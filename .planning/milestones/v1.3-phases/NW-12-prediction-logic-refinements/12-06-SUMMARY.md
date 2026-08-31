---
phase: NW-12
plan: "06"
subsystem: forecast / today-screen
tags: [pred-12, nap-probability, tdd, forecast, ui]
dependency_graph:
  requires:
    - NW-12-04 (napStart P10/P90 percentiles via calculatePercentiles)
    - NW-12-05 (PRED-11 no-nap bedtime shift — forecastContext shape)
  provides:
    - napProbability() exported from forecast.js
    - napProbabilityScore on predictions.napStart (today-screen render)
    - .nap-probability CSS class (prediction card + hero card)
  affects:
    - js/lib/forecast.js (new export)
    - js/ui/today-screen.js (import, render, renderPredictionCard, renderNextEventCard)
    - style.css (.nap-probability rules)
    - tests/unit/forecast.test.js (new describe block)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle with node:test
    - 4-signal additive weighted score (NAP_SCORE_WEIGHTS Object.freeze)
    - calculatePercentiles reused for napStart P10/P90
    - textContent-only DOM (XSS invariant)
    - gsd:allow-ui-clock for currentMinute wall-clock read in render()
key_files:
  created: []
  modified:
    - js/lib/forecast.js
    - js/ui/today-screen.js
    - style.css
    - tests/unit/forecast.test.js
decisions:
  - calculatePercentiles expects 'HH:MM' string from getTimeFn (not minutes) — callback fixed to return string; result shape is { min, central, max } not { p10, p90 }
  - extractTime is not exported from forecast.js; today-screen uses inline _getSlotTime helper per plan D-13
  - napProbabilityScore attached to predictions.napStart before renderForecastSection; TIF algorithm also benefits transparently
  - Window-closed (score=0) vs cold-start (null) distinction preserved; UI renders '0% — nap window closed' for 0 and suppresses element for null
metrics:
  duration: "~25 min"
  completed: "2026-08-25"
  tasks_completed: 2
  files_modified: 4
status: complete
---

# Phase NW-12 Plan 06: napProbability PRED-12 Summary

**One-liner:** 4-signal nap probability score (0–100 integer) exported from forecast.js, displayed on nap-start prediction card and hero card via TDD.

## Objective

Implement PRED-12: `napProbability()` pure function in `forecast.js` using four weighted signals (nap frequency 40%, elapsed wake time 30%, no-nap streak 20%, window-passed 10%), then wire it into `today-screen.js` so the score renders on the nap-start prediction card and hero card.

## Tasks Completed

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 — RED | TDD | a7f7ecf | Add failing tests for napProbability (11 test cases in describe block) |
| 1 — GREEN | TDD | 2dca05c | Implement NAP_SCORE_WEIGHTS + napProbability() in forecast.js |
| 2 | auto | 6bdd765 | Add import, napStreak/todayWakeHHMM computation, score attachment, renderPredictionCard/renderNextEventCard UI, CSS .nap-probability |

## Implementation Details

### `napProbability(dayRecords, settings, context)` — forecast.js

- Returns `null` when `dayRecords.length < minDays` (cold-start gate).
- Computes Signal 4 (window-passed) by comparing `nowMins` to `napStartResult.max` (P90 in minutes); when past P90, returns `0` immediately — hard collapse.
- Signal 1: `napDays / dayRecords.length` where `napDays` counts records with a non-null napStart.
- Signal 2: elapsed fraction of `[P10, P90]` wake-time window since today's wake; 0 when `todayWakeHHMM` is null, when `P90 == P10`, or when the window span is zero.
- Signal 3: `max(0, 1 - napStreak / 5)` — zeroes out at streak = 5.
- Final score: `Math.round(raw * 100)` — single rounding at the end.

### `NAP_SCORE_WEIGHTS` — frozen constant exported alongside `napProbability`

```js
export const NAP_SCORE_WEIGHTS = Object.freeze({
  napFrequency:    0.40,
  elapsedWakeTime: 0.30,
  noNapStreak:     0.20,
  windowPassed:    0.10,
});
```

### today-screen.js wiring

- `napStreak` computed by iterating `forecastDays` from index 1 (skip today), counting consecutive days with null napStart.
- `todayWakeHHMM` extracted as `todayDayRecord?.wake?.at?.slice(11) ?? null` via inline `_getSlotTime`.
- Score attached to `predictions.napStart.napProbabilityScore` before `renderForecastSection` call — works for both classic and TIF algorithms.
- `renderPredictionCard`: inside the normal (non-probability-band) branch, after the time-band block, adds `<p class="nap-probability">` when `eventType === 'napStart'` and score is non-null and card is not missed.
- `renderNextEventCard`: inside the normal branch, after TIF badge, adds `<p class="nap-probability">` when `prediction.type === 'napStart'` and score is non-null and prediction is not missed.

### CSS

```css
.nap-probability { color: #475569; font-size: 0.875rem; font-weight: 400; margin: 0; margin-top: 0.25rem; }
.next-event-hero .nap-probability { font-size: 0.875rem; font-weight: 400; opacity: 0.85; color: #fff; margin: 0; margin-top: 0.125rem; }
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] calculatePercentiles callback must return 'HH:MM' string, not minutes**
- **Found during:** Task 1 TDD GREEN — two tests failed with `TypeError: hhmm.slice is not a function`
- **Issue:** Initial implementation passed `timeToMinutes(t)` (a number) as the return value of `getTimeFn`. `calculatePercentiles` calls `timeToMinutes(getTimeFn(d))` internally, causing double-conversion.
- **Fix:** Changed callback to return the raw 'HH:MM' string; also corrected `napStartResult.p90` → `napStartResult.max` and `napStartResult.p10` → `napStartResult.min` to match the `{ min, central, max }` return shape of `calculatePercentiles`.
- **Files modified:** `js/lib/forecast.js`
- **Commit:** 2dca05c (same GREEN commit after in-session fix)

## Verification

All 696 unit tests pass (`npm run test:unit`). 125 tests in `forecast.test.js` include the 11 new PRED-12 cases:
- empty dayRecords → null
- dayRecords below minDays → null
- all-nap history, window open → integer > 50
- returns integer in [0, 100]
- no-nap history → score < 50
- window already passed → 0 (not null)
- window-closed 0 is not null (cold-start distinguishable)
- napStreak=5 → lower score than streak=0
- todayWakeHHMM=null → score ≤ score with wake set
- score is integer (single Math.round)
- NAP_SCORE_WEIGHTS structural test (score in range, integer)

## Known Stubs

None. All signals are computed from real dayRecords data.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns introduced. All DOM writes use `textContent` (XSS invariant maintained).

## Self-Check: PASSED

- `js/lib/forecast.js` — FOUND (modified, napProbability exported)
- `js/ui/today-screen.js` — FOUND (modified, napProbability wired)
- `style.css` — FOUND (modified, .nap-probability rules added)
- `tests/unit/forecast.test.js` — FOUND (modified, PRED-12 describe block added)
- Commit a7f7ecf — FOUND (RED: failing tests)
- Commit 2dca05c — FOUND (GREEN: implementation)
- Commit 6bdd765 — FOUND (Task 2: UI + CSS)
