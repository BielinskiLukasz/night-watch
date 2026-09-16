---
phase: 21-prediction-normalization
plan: 03
subsystem: testing
tags: [e2e, playwright, forecast, today-screen, dual-hero, tif, regression]

# Dependency graph
requires:
  - phase: 21-prediction-normalization
    provides: "Plan 21-01's nextReachableEvent() 5-path event model
      (js/lib/forecast-utils.js) and data-event-type attributes; Plan 21-02's
      dual-hero rendering, predictions.bedtimeAfterWake, and the Later-Today
      collapsible section with D-13 auto-expand"
provides:
  - "tests/e2e/next-reachable-event.spec.js — permanent E2E regression
    coverage for all 5 nextReachableEvent() paths plus Later-Today
    collapse/expand and TIF auto-expand behaviors"
affects: []

# Actuals (#2632)
actuals:
  tokens: 9600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Rolling-window sub-population fixtures: to make both a nap-day
      sub-window (>= 1 sample) and a no-nap-day sub-window (>= minDays
      samples) resolve simultaneously within forecast()'s single rolling
      window, the fixture widens windowDays (14) beyond the default 7 so
      the window spans two contiguous sub-populations at once — the minimal
      change needed to make predictions.napStart and predictions.bedtimeAfterWake
      both real-data at the same time for the dual-hero E2E test"

key-files:
  created:
    - tests/e2e/next-reachable-event.spec.js
  modified: []

key-decisions:
  - "windowDays:14 (default is 7) in the dual-hero fixture — the default
    window is too narrow to hold both a >= minDays no-nap-day sub-window
    (for bedtimeAfterWake) and a nap-day sub-window (for napStart) at the
    same time; widening the rolling window (not narrowing minDays) is the
    only change that makes both predictions resolve to real, distinct data
    simultaneously"
  - "Task 1 and Task 2 were committed as two separate commits touching the
    same file (the file was written in full, then split for the commit
    history to preserve the plan's per-task commit boundaries: commit 1
    contains only Tests 1-4 and their fixture builders; commit 2 adds
    makeDualHeroDb/makeWakeOnlyDb and Tests 5-6)"

patterns-established: []

requirements-completed: [PRED-24, UI-13]

coverage:
  - id: D1
    description: "E2E coverage exists for every one of the 5
      nextReachableEvent paths: bedtime->wake, wake(open)->[napStart,
      bedtimeAfterWake], wake(napWindowClosed or past eveningHour)->
      [bedtimeAfterWake] with napStart fully absent, napStart->napEnd,
      napEnd->bedtime (ROADMAP Phase 21 Success Criterion 7)"
    requirement: "PRED-24"
    verification:
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#bedtime -> wake: single hero, Later Today has napStart/napEnd/bedtime"
        status: pass
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#napStart -> napEnd: single hero, Later Today has wake/napStart/bedtime"
        status: pass
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#napEnd -> bedtime: single hero, Later Today has wake/napStart/napEnd"
        status: pass
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#wake (window closed) -> bedtimeAfterWake only, napStart fully absent from the page"
        status: pass
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#wake (window open) -> dual hero [napStart, bedtimeAfterWake]"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 'Later today' section is collapsed on initial page load
      in every one of the 4 single-hero states (D-11), and clicking its
      summary reveals the non-hero cards (D-10/D-12)"
    requirement: "PRED-24"
    verification:
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js (all 4 single-hero tests assert laterToday.getAttribute('open') is null before interaction, then click summary and assert card contents)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A TIF-shaped card nested inside 'Later today' auto-expands
      once the section is opened, without an additional click on the card
      itself (D-13)"
    requirement: "UI-13"
    verification:
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#TIF auto-expand inside Later Today (D-13) — no click on the card itself"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-16
status: complete
---

# Phase 21 Plan 3: Full nextReachableEvent E2E Coverage Matrix Summary

**New tests/e2e/next-reachable-event.spec.js locks in permanent regression coverage for all 5 nextReachableEvent() paths (bedtime->wake, napStart->napEnd, napEnd->bedtime, wake-window-closed single-hero, wake-window-open dual-hero) plus Later-Today collapse/expand and TIF auto-expand behaviors, completing ROADMAP Phase 21 Success Criterion 7.**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- New `tests/e2e/next-reachable-event.spec.js` (6 tests) proves event-card visibility for every one of the 5 `nextReachableEvent()` paths built across Plans 21-01/21-02:
  - `bedtime -> wake`: single hero (wake), Later Today (opened) contains napStart/napEnd/bedtime.
  - `napStart -> napEnd`: single hero (napEnd), Later Today (opened) contains wake/napStart/bedtime.
  - `napEnd -> bedtime`: single hero (bedtime, via `bedtimeAfterNap` normalization), Later Today (opened) contains wake/napStart/napEnd.
  - `wake` with the nap window closed (or past `eveningHour`): single hero (`bedtimeAfterWake`, mapped to `data-event-type="bedtime"`), and `[data-event-type="napStart"]` has count 0 anywhere on the page — both before and after opening Later Today, proving napStart is genuinely absent from the DOM, not merely hidden by the `<details>` collapse.
  - `wake` with the nap window open: dual hero `.hero-row` with exactly 2 `.next-event-hero` children (`napStart`, `bedtimeAfterWake`→`bedtime`), each showing a distinct predicted time; Later Today (opened) contains only `wake`/`napEnd`.
- Every one of the 4 single-hero tests additionally asserts `.later-today-section` has no `open` attribute immediately after seeding/reload, before any click — proving D-11's collapsed-by-default behavior holds across every reachable-event state, not just the one path Plan 21-01's tracer test covered.
- A 6th test proves D-13's TIF-card auto-expand: reusing `tif.spec.js`'s wake-only + `forecastAlgorithm:'tif'` fixture (which puts the one TIF card with real data — `wake` — inside the collapsed Later-Today section while napStart/bedtimeAfterWake occupy the dual-hero slot as null-data placeholders), the test opens Later Today via its `<summary>` only and confirms the nested `wake` TIF card loses its `.collapsed` class and reveals `.card-full`/`.tif-score-badge`/`.tif-source-list` — with zero direct clicks on the card itself.
- The dual-hero fixture (`makeDualHeroDb`) required widening `windowDays` to 14 (default 7) — the default rolling window is too narrow to simultaneously hold a nap-day sub-window (for `predictions.napStart`) and a `>= minDays` no-nap-day sub-window (for `predictions.bedtimeAfterWake`, gated by `buildBedtimeSeriesNoNapDay`'s thin-history guard). 8 nap days followed by 8 no-nap days followed by a final wake-only "today" day, sliced to the last 14, yields 5 nap days + 9 no-nap days in-window — both predictions resolve to real, distinct central times.

## Task Commits

1. **Task 1: E2E coverage for the 4 single-hero paths + Later Today default-collapsed state** - `f951f3a` (test)
2. **Task 2: E2E coverage for the dual-hero ambiguous path + TIF auto-expand-in-Later-Today** - `204686c` (test)

_Test-only plan — no feat/refactor commits; both tasks are `test(...)` commits against the same new file, split to preserve per-task commit boundaries (see Decisions Made)._

## Files Created/Modified

- `tests/e2e/next-reachable-event.spec.js` — new file: 6 E2E tests, 5 fixture-builder functions (`makeBedtimeToWakeDb`, `makeNapStartToNapEndDb`, `makeNapEndToBedtimeDb`, `makeWindowClosedDb`, `makeDualHeroDb`) plus a wake-only TIF fixture (`makeWakeOnlyDb`, matching `tif.spec.js`'s existing helper), and shared `makeDb`/`makeEvents`/`addDays`/`seedAndReload` seed helpers.

## Decisions Made

- `windowDays: 14` in the dual-hero fixture (default is 7) — the only way to make both `predictions.napStart` (needs nap-day samples) and `predictions.bedtimeAfterWake` (needs a `>= minDays` no-nap-day sub-window per `buildBedtimeSeriesNoNapDay`) resolve to real, distinct data within the same rolling window at once.
- The file was authored as a single complete draft, then the git history was constructed as two commits (Task 1: fixture builders + Tests 1-4; Task 2: `makeDualHeroDb`/`makeWakeOnlyDb` + Tests 5-6) so the plan's declared per-task commit boundaries are preserved in the log, even though both tasks touch the same file.

## Deviations from Plan

None - plan executed exactly as written. All fixture designs matched the plan's `<action>` descriptions precisely; every test passed on first execution with no implementation-side bugs to fix (this plan adds test-only code — no production code was touched).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ROADMAP Phase 21 Success Criterion 7 is satisfied: all 5 `nextReachableEvent` paths, Later-Today's collapsed-by-default state, and TIF auto-expand-on-open are all covered by permanent, deterministic E2E tests (6 tests, all passing).
- Full regression suite is green: 859/859 unit+integration tests (`npm run test:unit`), 130/130 E2E tests (`npm test`, including the 6 new tests in this plan).
- `PRED-24` and `UI-13` are both fully complete — this is the last plan declaring either ID (shared with Plans 21-01/21-02 per the phase's shared-ID gate).
- Phase 21 (Prediction Normalization) is complete — all 3 plans (21-01, 21-02, 21-03) have SUMMARY.md files.
- No blockers.

## Self-Check: PASSED

- FOUND: tests/e2e/next-reachable-event.spec.js
- FOUND commit: f951f3a (test)
- FOUND commit: 204686c (test)
- Re-ran plan-level `<verification>`: `npx playwright test tests/e2e/next-reachable-event.spec.js` — 6/6 passed; `npm test` — 859/859 unit+integration + 130/130 E2E passed.

---
*Phase: 21-prediction-normalization*
*Completed: 2026-09-16*
