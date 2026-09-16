---
phase: 20-nap-probability-redesign
plan: 02
subsystem: prediction-engine
tags: [forecast, nap-probability, today-screen, ui]

requires:
  - phase: 20-nap-probability-redesign
    provides: "napProbability() returning {score, signalsUsed, confidence} instead of a bare number|null|0 (Plan 20-01)"
provides:
  - "forecast.js's PRED-18/19 bedtime blend reads napProbabilityScore.score at all four D-04 call sites"
  - "today-screen.js computes todayWeekday (0=Sun..6=Sat) and threads it into napProbability()'s context (D-07)"
  - "Both today-screen.js nap-probability UI render sites (hero card, prediction card) read .score, never the bare object"
affects: [21-prediction-normalization]

actuals:
  tokens: 1528
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Object-shape consumption guard: `napProbabilityScore !== null && napProbabilityScore.score !== null` before unwrapping `.score` — handles both an absent context field and a present object with a null score identically to the old bare-null fallthrough"

key-files:
  created: []
  modified:
    - js/lib/forecast.js
    - js/ui/today-screen.js
    - tests/unit/forecast.test.js

key-decisions:
  - "Kept the existing score===0 'nap window closed' UI ternary as-is (just repointed to .score) per this plan's explicit task action — the CONTEXT.md D-11/D-12 amendment (decoupled napWindowClosed flag, score no longer collapsing to 0) was NOT implemented in Plan 20-01 (forecast.js still hard-collapses to score:0 at the P90 window-closed check) and is out of this plan's scope; PLAN.md's task 2 action and must_haves are unambiguous about preserving the ternary structure, so no deviation was needed"
  - "todayWakeHHMM removed only from the napProbability() call's own context object (now dead there since Plan 20-01 dropped it from napProbability()'s destructuring); the variable itself and its use in forecastContext for forecast() are unchanged"

patterns-established: []

requirements-completed: [NAP-01, NAP-02, NAP-03, NAP-04]

coverage:
  - id: D1
    description: "forecast.js's PRED-18/19 bedtime-blend guard and ratio calculation read napProbabilityScore.score instead of treating the context field as a bare number"
    requirement: NAP-01
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#napProbabilityScore=70 with both sub-series >= minDays: blends central proportionally"
        status: pass
      - kind: unit
        ref: "tests/unit/forecast.test.js#score present but both sub-series thin (< minDays): falls back to overall without offset shift"
        status: pass
    human_judgment: false
  - id: D2
    description: "today-screen.js computes todayWeekday (0=Sun..6=Sat) and threads it into the napProbability() call's context (D-07)"
    requirement: NAP-02
    verification:
      - kind: unit
        ref: "npm run test:unit (830 pass, 0 fail) — no dedicated today-screen.js unit test exists in this codebase; full regression suite is the safety net"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both nap-probability UI render sites (hero card, prediction card) display the percentage from prediction.napProbabilityScore.score, never '[object Object]%'"
    requirement: NAP-04
    verification: []
    human_judgment: true
    rationale: "No automated UI test exists for today-screen.js's rendered text in this codebase (Playwright E2E does not assert on this specific string); the plan's own <verify> block designates this a human-check item, and this plan is autonomous:true so no browser was driven during execution"

duration: 8min
completed: 2026-09-16
status: complete
---

# Phase 20 Plan 02: Nap-Probability Consumer Wiring Summary

**forecast.js's PRED-18/19 bedtime blend and today-screen.js's call site + two UI render sites now correctly consume `napProbability()`'s new `{score, signalsUsed, confidence}` object shape, with `todayWeekday` threaded into the call per D-07.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-09-16
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `forecast.js`'s PRED-18/19 blend guard changed from `napProbabilityScore !== null` to `napProbabilityScore !== null && napProbabilityScore.score !== null`; ratio calculation reads `.score`
- Updated JSDoc (`context.napProbabilityScore`) and the fallthrough comment to describe the object shape instead of a bare `number|null`
- Two pre-existing blend-test fixtures updated from `napProbabilityScore: 70` to `{ score: 70, signalsUsed: [], confidence: 'partial' }`; all other fixtures already passed `null` and needed no change
- `today-screen.js` computes `todayWeekday` (`new Date().getDay()`, 0=Sun..6=Sat) alongside `currentHour`/`currentMinute` and passes it into the `napProbability()` call's context; the now-inert `todayWakeHHMM` key was dropped from that specific call (Plan 20-01 already removed it from `napProbability()`'s own destructuring)
- Both nap-probability UI render sites (hero card, prediction card) now read `prediction.napProbabilityScore.score` in both the `=== 0` check and the percentage interpolation, preventing `"[object Object]% chance of nap today"`

## Task Commits

Each task was committed atomically:

1. **Task 1: forecast.js D-04 consumption sites + blend-test fixture updates** - `8ea4c52` (fix)
2. **Task 2: today-screen.js wiring — todayWeekday (D-07) + .score-based UI rendering (D-04)** - `fcfdb2a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `js/lib/forecast.js` - PRED-18/19 blend guard/ratio unwrap `.score`; JSDoc and fallthrough comment updated
- `js/ui/today-screen.js` - `todayWeekday` computed and threaded into `napProbability()`'s context; both render sites read `.score`
- `tests/unit/forecast.test.js` - Two blend-test fixtures updated to the object shape for `napProbabilityScore`

## Decisions Made
- Preserved the `score === 0` → "nap window closed" UI ternary exactly as the plan's task action specified (just repointed to `.score`), rather than removing it per CONTEXT.md's D-11/D-12 amendment — that amendment describes a decoupled `napWindowClosed` flag that Plan 20-01 did not implement (verified: `forecast.js` still hard-collapses to `score: 0` at the P90 window-closed check, with no `napWindowClosed` field anywhere in the current code). Since this plan's own `<action>` and `must_haves` explicitly instruct keeping the `=== 0` check (just adding `.score`), executing the plan as written is correct; the D-11/D-12 decoupling is evidently deferred to a later plan (Phase 21 is the documented consumer of `napWindowClosed` per CONTEXT.md's cross-reference).
- Left `todayWakeHHMM`'s computation and its use in `forecastContext` (for `forecast()`) untouched — only removed it from the `napProbability()` call's own context object, per the plan's explicit instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 20 (both plans) is now complete: `napProbability()`'s new object contract is fully wired through `forecast.js`'s bedtime blend and `today-screen.js`'s call site and both UI render sites.
- **Manual-QA item (deferred, not blocking):** This plan is `autonomous: true`, so no browser was driven to visually confirm the Task 2 human-check note ("load the app, log enough history to clear cold-start, confirm the nap-probability text reads 'N% chance of nap today' or '0% — nap window closed', never '[object Object]%'"). All four D-04 call sites were code-reviewed and the full `npm run test:unit` suite (830 tests) passes with no regressions, but the literal rendered string was not visually verified in a running browser. Recommend a quick manual check next time the app is loaded, or during Phase 21 UAT (which already touches this same UI area for card-hiding logic).
- No blockers for Phase 21 (Prediction Normalization), which consumes this phase's stable `napProbability()` contract and will separately implement the `napWindowClosed` decoupling (D-11/D-12) referenced in CONTEXT.md but not built in Phase 20.

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-16*

## Self-Check: PASSED

All modified files confirmed present on disk (js/lib/forecast.js, js/ui/today-screen.js, tests/unit/forecast.test.js, this SUMMARY.md). Both task commits (8ea4c52, fcfdb2a) confirmed present in `git log --oneline --all`.
