---
phase: 20-nap-probability-redesign
plan: 03
subsystem: prediction-engine
tags: [forecast, gap-closure, code-review, ordering-bug, timezone-bug]

requires:
  - phase: 20-nap-probability-redesign
    provides: "napProbability() object contract and today-screen.js/metrics-screen.js wiring (Plans 20-01/20-02) that CR-01/CR-02 were found in during code review"
provides:
  - "today-screen.js reverses forecastDays into forecastDaysOldestFirst before calling napProbability()/tifForecast()/forecast() — all three internally require oldest-first day records"
  - "metrics-screen.js's tifForecast() historic-band override passes reversedDays (was days), restoring parity with the corrected Today-screen ordering"
  - "today-screen.js's todayDateStr uses formatLocalISO(new Date()) instead of new Date().toISOString(), matching day.date's local-wall-clock convention at every UTC offset"
  - "tests/integration/forecast-ordering.test.js pins the oldest-first ordering contract for forecast()/tifForecast()/sleepDebtProxy() against real eventLog.daysBySubjectiveNight() output"
  - "tests/unit/time.test.js gains a regression test pinning the exact local-vs-UTC divergence formatLocalISO must avoid"
affects: [21-prediction-normalization]

actuals:
  tokens: 3320
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Reverse-at-call-site pattern: forecastDaysOldestFirst = [...forecastDays].reverse() computed once in today-screen.js's render(), feeding only the three calls (napProbability/tifForecast/forecast) whose internal windowing requires oldest-first; forecastDays itself stays newest-first for napStreak/renderForecastSection/selectNextEvent"

key-files:
  created:
    - tests/integration/forecast-ordering.test.js
  modified:
    - js/ui/today-screen.js
    - js/ui/metrics-screen.js
    - tests/unit/time.test.js

key-decisions:
  - "The three new tests in forecast-ordering.test.js and the new time.test.js test pin the CORRECT, pre-existing contract of forecast.js/forecast-tif.js/metrics.js and js/lib/time.js — none of those library files were touched by this plan (only the today-screen.js/metrics-screen.js call sites were). Consequently all four new tests pass immediately, both before and after this plan's production-code changes; they are regression/pinning tests against future contract drift, not tests that transition from failing to passing across this plan's fix. This was verified explicitly (ran each new test file before touching today-screen.js/metrics-screen.js) rather than assumed — see Issues Encountered."

patterns-established: []

requirements-completed: [NAP-01, NAP-02, NAP-03, NAP-04]

coverage:
  - id: D1
    description: "today-screen.js reverses forecastDays into forecastDaysOldestFirst before napProbability()/tifForecast()/forecast(); renderForecastSection()/selectNextEvent() still receive newest-first forecastDays"
    requirement: NAP-01
    verification:
      - kind: integration
        ref: "tests/integration/forecast-ordering.test.js#forecast() rolling window / tifForecast() rolling window (library-level pin, not a today-screen.js call-site test)"
        status: pass
      - kind: unit
        ref: "npm run test:unit (834 pass, 0 fail) — no dedicated today-screen.js unit test exists in this codebase (same gap noted in 20-02-SUMMARY.md)"
        status: pass
    human_judgment: true
    rationale: "No automated test in this codebase exercises today-screen.js's render() wiring directly (DOM module, no unit-test harness for it per 20-01/20-02 precedent). The library-level ordering contract is pinned by tests/integration/forecast-ordering.test.js, and the call-site change was verified by direct code reading (today-screen.js lines ~923-945) plus the full regression suite passing, but the plan's own <verify> block designates the end-to-end behavior (predictions tracking recent trend) a human-check item."
  - id: D2
    description: "metrics-screen.js's tifForecast() override call passes reversedDays instead of days, restoring parity with today-screen.js's corrected ordering"
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "npm run test:unit (834 pass, 0 fail) — no dedicated metrics-screen.js unit test targets this override in this codebase"
        status: pass
    human_judgment: true
    rationale: "Same class of gap as D1 — this is a UI-layer call-site fix with no direct automated test; verified by code reading and full regression suite. The plan's own <verify> designates cross-checking the Metrics screen's historic band against Today's a human-check item."
  - id: D3
    description: "today-screen.js's todayDateStr computed via formatLocalISO(new Date()).slice(0, 10), not toISOString(), matching day.date's local-wall-clock convention at every UTC offset"
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "tests/unit/time.test.js#formatLocalISO reports the local calendar date; toISOString reports the next day at 20:00 EST"
        status: pass
      - kind: unit
        ref: "npm run test:unit (834 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D4
    description: "New regression tests pin both fixes using real bucketer output / real timezone-divergence scenarios, not hand-built fixtures"
    requirement: NAP-01
    verification:
      - kind: integration
        ref: "tests/integration/forecast-ordering.test.js (3 tests, all built on real eventLog.daysBySubjectiveNight() output)"
        status: pass
      - kind: unit
        ref: "tests/unit/time.test.js (1 new test, TZ=America/New_York via process.env.TZ, restored in finally)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-16
status: complete
---

# Phase 20 Plan 03: Nap Probability Redesign Gap Closure Summary

**Closed both BLOCKER findings from 20-REVIEW.md: today-screen.js/metrics-screen.js now feed forecast()/tifForecast()/napProbability() an oldest-first day-records array (CR-01), and today-screen.js's "today" date lookup uses formatLocalISO instead of UTC toISOString() (CR-02), each pinned by a new regression test.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-16
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `today-screen.js`'s `render()` now computes `forecastDaysOldestFirst = [...forecastDays].reverse()` and passes it to `napProbability()`, `tifForecast()`, and `forecast()` — all three internally assume the last array element is the most recent day (rolling-window slice, "today" extraction), but `eventLog.daysBySubjectiveNight()` returns newest-first. `forecastDays` itself is untouched and still feeds `napStreak`, `renderForecastSection()`, and `selectNextEvent()`.
- `metrics-screen.js`'s TIF historic-band override now calls `tifForecast(reversedDays, ...)` instead of `tifForecast(days, ...)`, restoring parity with the corrected Today-screen ordering (the stale "pass `days` NOT `reversedDays`" comment was rewritten to explain the new invariant).
- `today-screen.js`'s `todayDateStr` now uses `formatLocalISO(new Date()).slice(0, 10)` instead of `new Date().toISOString().slice(0, 10)`, matching `day.date`'s local-wall-clock convention (`js/lib/day-bucket.js`'s `calendarKey`/`subjectiveNightKey`) at every hour and UTC offset.
- New `tests/integration/forecast-ordering.test.js` (3 tests) proves, using real `eventLog.daysBySubjectiveNight()` output, that `forecast()`/`tifForecast()`/`sleepDebtProxy()` produce materially different (and exactly predicted) results depending on whether the input is oldest-first or newest-first.
- New test in `tests/unit/time.test.js` proves `formatLocalISO` reports the correct local calendar date while `toISOString()` reports the next day, for a 20:00 EST timestamp (`process.env.TZ` mutated and restored in a `finally` block).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CR-01 — reverse forecastDays to oldest-first, restore metrics-screen.js parity** - `1c0e953` (fix)
2. **Task 2: Fix CR-02 — local wall-clock date for today's lookup** - `63dd907` (fix)

**Plan metadata:** (this commit)

_Note: Both tasks are `tdd="true"` but neither required a separate RED commit — see Issues Encountered for why the new tests pass unconditionally (they pin already-correct library contracts, not the buggy call sites)._

## Files Created/Modified
- `tests/integration/forecast-ordering.test.js` (created) - 3 regression tests pinning forecast()/tifForecast()/sleepDebtProxy()'s oldest-first requirement against real bucketer output
- `js/ui/today-screen.js` - `forecastDaysOldestFirst` computed and threaded into `napProbability()`/`tifForecast()`/`forecast()`; `todayDateStr` now uses `formatLocalISO`
- `js/ui/metrics-screen.js` - `tifForecast()` override call now passes `reversedDays`; comment rewritten to describe the corrected invariant
- `tests/unit/time.test.js` - new test proving `formatLocalISO` vs `toISOString()` divergence at 20:00 America/New_York

## Decisions Made
- Kept `forecastDays` (newest-first) completely untouched and only introduced the new `forecastDaysOldestFirst` variable for the three calls that need it, per the plan's explicit instruction — `renderForecastSection()`/`selectNextEvent()` continue to rely on `forecastDays[0]` being today.
- Did not attempt to add a direct unit/integration test for today-screen.js's `render()` wiring itself (the actual buggy call sites) — no such test harness exists in this codebase (confirmed via 20-02-SUMMARY.md precedent: "no dedicated today-screen.js unit test exists"). The plan's own tests target the underlying library functions' ordering contract instead, and the call-site fix was verified via direct code reading plus the full regression suite.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Both new regression tests pass unconditionally (not a true RED→GREEN transition).** Per the objective's success criteria, I explicitly verified (ran each new test file *before* touching any production code) whether the new tests would fail against pre-fix code and pass after the fix, rather than assuming the plan's TDD framing held automatically. Result: `tests/integration/forecast-ordering.test.js`'s three tests, and `tests/unit/time.test.js`'s new test, all passed immediately, with zero production-code changes in place. This is because:
- The three ordering tests call `forecast()`, `tifForecast()`, and `sleepDebtProxy()` **directly** with manually-constructed `reversedDays`/`rawDays` arrays — they never call into `today-screen.js`'s or `metrics-screen.js`'s render() functions (the actual locations of the CR-01 bug). `forecast.js`/`forecast-tif.js`/`metrics.js` were not modified by this plan (per the plan's own `<action>`, only the two UI call sites were), so their pre-existing, already-correct oldest-first contract was true both before and after this plan's commits.
- The new `time.test.js` test calls `formatLocalISO` directly and compares it to `toISOString()` — `js/lib/time.js` was not modified by this plan either (it already implements local-wall-clock semantics correctly); only `today-screen.js`'s call site was changed.
- This is consistent with the precedent in `20-02-SUMMARY.md`, which notes no unit-test harness exists for `today-screen.js`'s render() wiring in this codebase, so the actual buggy call-site behavior in both CR-01 and CR-02 cannot be directly asserted by an automated test without a much larger DOM-harness investment out of this plan's scope.
- Both fixes were nonetheless verified via: (1) direct code reading confirming the exact line changes matched the plan's specified before/after, (2) `npm run test:unit` passing at 834/834 both before and after each task's production-code change (no regressions), and (3) the new tests correctly documenting and pinning the underlying library contracts these UI call sites must respect going forward — so any future change to `forecast.js`/`forecast-tif.js`/`metrics.js`/`time.js` that violates the ordering or timezone contract will be caught by CI.
- This is surfaced here transparently rather than silently claiming a RED→GREEN cycle that did not occur, per the objective's explicit instruction not to just trust the plan's predicted test behavior.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both BLOCKER findings from `20-REVIEW.md` (CR-01, CR-02) are closed. Phase 20 (all three plans: 20-01, 20-02, 20-03) is now complete.
- **Manual-QA item (deferred, not blocking, carried over from the plan's `<verify>` human-check items):** Load the app (`npm run serve`), log more than 7 days of wake/bedtime/nap history with a clear recent trend, and confirm the Today screen's predictions track the recent trend (not the earliest logged days). If using TIF, also confirm the Metrics screen's "Historic ... band" columns match the Today screen's historic band. For CR-02, ideally verify in a negative-UTC-offset timezone during evening hours that today's record is still found. This plan is `autonomous: true` so no browser was driven during execution (same precedent as 20-02).
- No blockers for Phase 21 (Prediction Normalization), which was already going to consume this phase's `napProbability()` contract and now inherits correctly-ordered forecast inputs and a correct local-date "today" lookup.

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-16*

## Self-Check: PASSED

All modified/created files confirmed present on disk (tests/integration/forecast-ordering.test.js, js/ui/today-screen.js, js/ui/metrics-screen.js, tests/unit/time.test.js, this SUMMARY.md). Both task commits (1c0e953, 63dd907) confirmed present in `git log --oneline --all`.
