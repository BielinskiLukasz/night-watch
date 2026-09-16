---
phase: 20-nap-probability-redesign
plan: 01
subsystem: prediction-engine
tags: [forecast, nap-probability, metrics, tdd]

requires:
  - phase: 19-split-bedtime-wake-anchored-nap
    provides: forecast() context-threading pattern (pre-computed fields, D-13) reused for todayWeekday (D-07)
  - phase: 18-sleep-debt-proxy
    provides: sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes) in metrics.js
  - phase: 17-day-of-week-patterns
    provides: dayOfWeekAverages(dayRecords) per-weekday aggregation in metrics.js
provides:
  - Rewritten NAP_SCORE_WEIGHTS (4 keys: napFrequency 0.35, dayOfWeekNapRate 0.30, sleepDebtSignal 0.20, noNapStreak 0.15)
  - napProbability() returning { score, signalsUsed, confidence } instead of bare null|0|number
  - Weight-redistribution logic (D-01/D-02) for when dayOfWeekNapRate/sleepDebtSignal are unavailable
  - dayOfWeekAverages() extended with napDays/totalDays integer counters per weekday
affects: [20-02-forecast-consumption-and-ui, 21-prediction-normalization]

actuals:
  tokens: 8065
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Weight redistribution: build { key, weight, value, available } entries in fixed NAP_SCORE_WEIGHTS order, filter to available, rescale weight/sumAvailableWeight, sum weighted values, Math.round(*100)"
    - "Clock-invariant score computed first; the sole clock-based window-closed collapse (score:0) applied last, after signalsUsed/confidence are already computed so the override still reports accurate availability"

key-files:
  created: []
  modified:
    - js/lib/forecast.js
    - js/lib/metrics.js
    - tests/unit/forecast.test.js
    - tests/unit/metrics.test.js

key-decisions:
  - "napProbability()'s cold-start gate now returns { score: null, signalsUsed: [], confidence: 'none' } instead of bare null (D-03)"
  - "dayOfWeekNapRate/sleepDebtSignal availability gated by settings.minDays (D-06) and >=7 qualifying overnight pairs (D-09) respectively; napFrequency/noNapStreak always available once cold-start gate passes"
  - "sleepDebtSignal normalization: clamp(sleepDebtProxy(dayRecords,7,targetSleepMinutes), -180, 180) mapped linearly to 0-1 via 0.5 + clamped/360 (D-08)"
  - "Retained the noNapStreak key name (not renamed to noNapStreakPenalty) per CONTEXT.md Claude's Discretion — same computation, only weight/doc label changed"

patterns-established:
  - "napProbability()'s four weighted signals are clock-invariant by construction; only the window-closed hard collapse reads currentHour/currentMinute"

requirements-completed: [NAP-01, NAP-02, NAP-03, NAP-04]

coverage:
  - id: D1
    description: "NAP_SCORE_WEIGHTS rewritten to 4 keys (napFrequency 0.35, dayOfWeekNapRate 0.30, sleepDebtSignal 0.20, noNapStreak 0.15), Object.freeze'd, sums to 1.0 within 1e-9 epsilon"
    requirement: NAP-04
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#NAP_SCORE_WEIGHTS has exactly four keys 35/30/20/15 summing to 1.0 within epsilon"
        status: pass
    human_judgment: false
  - id: D2
    description: "napProbability() returns { score, signalsUsed, confidence } for cold-start, window-closed, and normal states — never a bare number/null"
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#PRED-12 napProbability (cold-start, window-closed, full-availability tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "dayOfWeekNapRate signal derived from dayOfWeekAverages()'s new napDays/totalDays fields, available once totalDays >= minDays"
    requirement: NAP-02
    verification:
      - kind: unit
        ref: "tests/unit/metrics.test.js#dayOfWeekAverages(dayRecords) mix: two Monday records"
        status: pass
      - kind: unit
        ref: "tests/unit/forecast.test.js#full-availability path: 21-day fixture yields all four signalsUsed and confidence=full"
        status: pass
    human_judgment: false
  - id: D4
    description: "sleepDebtSignal derived from sleepDebtProxy(dayRecords, 7, targetSleepMinutes), clamped ±180min, mapped linearly to 0-1"
    requirement: NAP-03
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#full-availability path: 21-day fixture yields all four signalsUsed and confidence=full"
        status: pass
    human_judgment: false
  - id: D5
    description: "Weight redistribution proportionally reallocates unavailable-signal weight across available signals (three independent unavailability combinations covered)"
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#dayOfWeekNapRate unavailable / both unavailable / sleepDebtSignal unavailable tests"
        status: pass
    human_judgment: false
  - id: D6
    description: "The four weighted signals are clock-invariant — identical inputs with different pre-window-close currentHour/currentMinute produce deep-equal results"
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#clock-invariance: identical dayRecords/settings/todayWeekday..."
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-16
status: complete
---

# Phase 20 Plan 01: Nap Probability Signal Engine Rewrite Summary

**napProbability() rewritten from a 4-signal clock-drifting score to a clock-invariant, data-driven engine (dayOfWeekNapRate + sleepDebtSignal replacing elapsedWakeTime + windowPassed), returning `{score, signalsUsed, confidence}` with proportional weight redistribution when a signal is unavailable.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-16
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `NAP_SCORE_WEIGHTS` rewritten to `{ napFrequency: 0.35, dayOfWeekNapRate: 0.30, sleepDebtSignal: 0.20, noNapStreak: 0.15 }`, still `Object.freeze`d
- `napProbability()` rewritten: removed `elapsedWakeTime`/`windowPassed` clock-based signals, added `dayOfWeekNapRate` (from `dayOfWeekAverages()`) and `sleepDebtSignal` (from `sleepDebtProxy()`)
- Return contract changed from bare `null|0|number` to `{ score, signalsUsed, confidence }` for all three states (cold-start/window-closed/normal)
- Proportional weight redistribution implemented and tested for all 4 availability combinations (full, dayOfWeekNapRate-only-missing, sleepDebtSignal-only-missing, both-missing)
- `dayOfWeekAverages()` extended with `napDays`/`totalDays` integer counters per weekday (additive, non-breaking for existing Metrics-screen consumers)
- Verified clock-invariance: identical history/settings/todayWeekday with different pre-window-close times produce deep-equal results
- Verified no circular import: `forecast.js` now imports `dayOfWeekAverages`/`sleepDebtProxy` from `metrics.js`; `metrics.js` still only imports `timeToMinutes` from `forecast.js`

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Tracer — napProbability() 4-signal engine**
   - `00aa1a7` (test) — RED: NAP_SCORE_WEIGHTS 4-key test, full-availability engine test, dayOfWeekAverages() napDays/totalDays assertions
   - `5ae644e` (feat) — GREEN: rewrote NAP_SCORE_WEIGHTS, napProbability(), and dayOfWeekAverages() to make RED tests pass
2. **Task 2: Expansion — redistribution, exact shapes, clock-invariance, retire obsolete tests**
   - `af5eade` (test) — rewrote cold-start tests to exact object shape, added 3 redistribution tests + window-closed exact-shape + clock-invariance, deleted the obsolete `elapsedWakeTime`-effect test (no implementation change needed — Task 1's redistribution formula already covered every case)

**Plan metadata:** (this commit)

_Note: Task 2 required no GREEN commit — it proves the existing Task-1 implementation, per its own `<action>` instruction not to modify `js/lib/forecast.js`._

## Files Created/Modified
- `js/lib/forecast.js` - `NAP_SCORE_WEIGHTS` (4 keys) + rewritten `napProbability()` (weight redistribution, object return); new import of `dayOfWeekAverages`/`sleepDebtProxy` from `./metrics.js`
- `js/lib/metrics.js` - `dayOfWeekAverages()` per-weekday buckets gain `napDays`/`totalDays` integer counters
- `tests/unit/forecast.test.js` - Full PRED-12 `napProbability` describe block rewritten: exact-shape cold-start/window-closed tests, 3 redistribution tests, clock-invariance test, obsolete elapsedWakeTime test deleted
- `tests/unit/metrics.test.js` - `napDays`/`totalDays` assertions added to the existing "mix: two Monday records" test

## Decisions Made
- Old `todayWakeHHMM=null → elapsedWakeTime signal = 0` test was left passing vacuously (in Task 1) since object-return `<=` comparison degrades to string equality — formally deleted in Task 2 per plan instruction, rather than left as dead-but-passing coverage.
- Old `NAP_SCORE_WEIGHTS sum to 1.0 (weights well-formed)` test was retired in Task 1 (not Task 2) since it directly conflicted with the new definitive weight-table test being added in the same task — no value in keeping a test that would otherwise need its own `.score` migration only to be deleted one task later.
- Hoisted a shared 21-day full-availability fixture (`buildFullFixture()`/`fullFixture`/`fullSettings`) and a 4-day thin fixture (`shortFixture`/`shortSettings`) to describe-block scope in Task 2, reused across the full-availability, three redistribution, and clock-invariance tests — avoids duplicating the fixture-construction logic across 5 tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing PRED-12 tests updated to `.score` access ahead of Task 2's own instruction**
- **Found during:** Task 1
- **Issue:** Task 1's `<action>` only instructed adding new tests (weight table, full-availability) and rewriting `napProbability()`'s return shape to an object — but the plan's own acceptance criteria required `node --test tests/unit/forecast.test.js tests/unit/metrics.test.js` to pass after Task 1. The 9 pre-existing PRED-12 tests (cold-start, streak, window-passed, etc.) read the return value as a bare number/null, which the object-shape rewrite would break, blocking Task 1's own verify command from passing.
- **Fix:** Updated the 9 affected pre-existing tests to read `result.score` instead of treating the return value as the score itself (the same fix Task 2's `<action>` independently describes for its own pass over this file). Left the fixture/settings/helper definitions untouched.
- **Files modified:** tests/unit/forecast.test.js
- **Verification:** `node --test tests/unit/forecast.test.js tests/unit/metrics.test.js` — 245 pass, 0 fail
- **Committed in:** 00aa1a7 (Task 1 test commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy Task 1's own stated verify command; no scope creep — Task 2 still performed its full planned scope (exact-shape rewrites, 3 new redistribution tests, clock-invariance test, obsolete-test deletion) without needing to redo this part.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 20-02 (wave 2, `depends_on: ["20-01"]`) is unblocked: `napProbability()`'s new object contract is stable and ready for `forecast.js`'s PRED-18/19 blend logic and `today-screen.js`'s `todayWeekday` threading + `.score` UI rendering fixes (D-04).
- No blockers. `js/ui/today-screen.js` still calls `napProbability()` expecting the old bare-number contract — this is a known, in-scope gap that 20-02 closes (not a regression introduced here, since no UI/integration/E2E test currently asserts on the rendered nap-probability text).

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-16*

## Self-Check: PASSED

All modified files confirmed present on disk (js/lib/forecast.js, js/lib/metrics.js, tests/unit/forecast.test.js, tests/unit/metrics.test.js, this SUMMARY.md). All 3 task commits (00aa1a7, 5ae644e, af5eade) confirmed present in `git log --oneline --all`.
