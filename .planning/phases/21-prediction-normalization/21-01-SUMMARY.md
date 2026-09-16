---
phase: 21-prediction-normalization
plan: 01
subsystem: prediction-engine
tags: [forecast, nap-probability, event-reachability, service-worker, tdd]

# Dependency graph
requires:
  - phase: 20-nap-probability-redesign
    provides: napProbability() {score, signalsUsed, confidence} return shape (D-03) that this
      plan extends with napWindowClosed
provides:
  - napProbability() returns a fully decoupled napWindowClosed boolean; score never collapses to
    0 solely because the nap window closed (finishes Phase 20 D-11/D-12)
  - js/lib/forecast-utils.js — new module exporting nextReachableEvent() (pure, 5-path event
    model) and selectNextEvent() (thin wrapper); both removed from js/lib/forecast.js
  - data-event-type attribute on all four Today-screen card root elements (hero, classic,
    TIF-normal, TIF-low-confidence) for E2E targetability
  - napStart card genuinely absent from the Today screen's forecast grid once the nap window has
    closed (or eveningHour has passed) while today's nap status is still undetermined
  - forecast-utils.js registered in the service-worker precache list
affects: [21-02-dual-hero-bedtimeAfterWake, 21-03-later-today-section]

# Actuals (#2632)
actuals:
  tokens: 18700
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure reachability function taking currentHour as a parameter instead of reading the wall
      clock directly (nextReachableEvent), with a thin wrapper (selectNextEvent) doing the single
      sanctioned clock read at the UI-adjacent boundary — matches the existing lib/ convention of
      caller-resolved clock-dependent context"
    - "Legacy fallback priority table preserved internally (LEGACY_FALLBACK_PRIORITY) so the new
      array-returning nextReachableEvent model can graceful-degrade to the exact pre-Phase-21
      behavior when nothing in the reachable path resolves against predictions"

key-files:
  created:
    - js/lib/forecast-utils.js
    - tests/unit/forecast-utils.test.js
  modified:
    - js/lib/forecast.js
    - js/ui/today-screen.js
    - sw.js
    - tests/unit/forecast.test.js
    - tests/unit/sw-precache.test.js
    - tests/e2e/forecast.spec.js
    - tests/integration/forecast-flow.test.js

key-decisions:
  - "napWindowClosed is derived with strict > (not >=) against napStart's historical P90 — at
    the exact P90 minute the window is still open (D-03)"
  - "bedtimeAfterWake keeps its own RESULT_TYPE literal distinct from a plain 'bedtime'
    resolution so Plan 21-02's dual-hero rendering can tell the two branches apart later;
    bedtimeAfterNap normalizes to 'bedtime' since it's a calculation branch only, not a new
    loggable event type (D-07)"
  - "napStart's full-hide condition only applies while lastEvent is null or 'wake' (D-04's
    carve-out) — once napStart is logged for today, napEnd renders normally regardless of
    napWindowClosed"

patterns-established:
  - "5-path event-reachability model (nextReachableEvent) replaces the old single-type priority
    switch as the canonical 'what's next' contract for Today-screen rendering"

requirements-completed: [PRED-23, PRED-24]

coverage:
  - id: D1
    description: "napProbability() decouples napWindowClosed from score — score is clock-invariant
      across the window-close boundary, napWindowClosed is a strict-> derived boolean"
    requirement: "PRED-23"
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#PRED-12 napProbability"
        status: pass
    human_judgment: false
  - id: D2
    description: "js/lib/forecast-utils.js extracts nextReachableEvent (pure 5-path model) and
      selectNextEvent (thin wrapper) out of forecast.js"
    requirement: "PRED-24"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-utils.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "napStart card is genuinely absent from the Today screen's DOM once the nap
      window has closed, while wake/napEnd/bedtime cards remain present"
    requirement: "PRED-24"
    verification:
      - kind: e2e
        ref: "tests/e2e/forecast.spec.js#napStart card is absent once the nap window has closed, other cards remain (Phase 21)"
        status: pass
    human_judgment: false
  - id: D4
    description: "forecast-utils.js registered in sw.js PRECACHE_LIST — app stays fully
      functional offline"
    verification:
      - kind: unit
        ref: "tests/unit/sw-precache.test.js#contains forecast-utils.js (event-reachability utilities module)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-16
status: complete
---

# Phase 21 Plan 1: napWindowClosed Decoupling & forecast-utils.js Extraction Summary

**napProbability() now reports a decoupled `napWindowClosed` boolean instead of collapsing `score` to 0, and the 5-path `nextReachableEvent`/`selectNextEvent` reachability logic moves into a new `js/lib/forecast-utils.js`, wired end-to-end so the Today screen's napStart card genuinely disappears once the nap window closes.**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `napProbability()` (`js/lib/forecast.js`) finishes Phase 20's D-11/D-12 amendment: the old hard-collapse-to-0 branch is gone, `score` always reports the real weighted signal blend, and a new `napWindowClosed` boolean (strict `>` against napStart's historical P90) is the sole clock-based field on the return object.
- New `js/lib/forecast-utils.js` exports `nextReachableEvent(lastEvent, currentHour, settings)` (pure, D-06/D-07's 5-path event model) and `selectNextEvent(predictions, dayRecords, settings)` (thin wrapper preserving the exact pre-Phase-21 external contract, including a legacy fallback-priority table for backward compatibility). `selectNextEvent` and its JSDoc are fully removed from `js/lib/forecast.js`.
- `js/ui/today-screen.js`: import split so `selectNextEvent` sources from `forecast-utils.js`; `data-event-type` attributes added to all four card-root element types for E2E targetability; the two `score === 0` nap-probability-percentage ternaries removed (score text always renders the real value now); the `napStart` card is genuinely skipped in the forecast grid once `napWindowClosed` or `currentHour >= eveningHour` fires, while today's nap status is still undetermined (D-01/D-04/D-05).
- `sw.js`'s `PRECACHE_LIST` gains `./js/lib/forecast-utils.js` (alphabetically between `forecast-tif.js` and `forecast.js`), pinned by a new `tests/unit/sw-precache.test.js` assertion.
- New E2E test proves the capability end-to-end: `[data-event-type="napStart"]` has count 0 once the nap window closes, while `wake`/`napEnd`/`bedtime` remain present.

## Task Commits

TDD RED→GREEN cycle for Task 1, plus a standard commit for Task 2:

1. **Task 1 RED — failing tests for napWindowClosed decoupling and forecast-utils extraction** - `bcaf800` (test)
2. **Task 1 GREEN — decouple napWindowClosed and extract forecast-utils.js** - `8a6422b` (feat)
3. **Task 2 — register forecast-utils.js in service-worker precache** - `0e51007` (feat)

_No REFACTOR commit was needed — the GREEN implementation didn't require a follow-up cleanup pass._

## Files Created/Modified

- `js/lib/forecast-utils.js` — new module: `nextReachableEvent()` (pure 5-path reachability), `selectNextEvent()` (thin wrapper)
- `js/lib/forecast.js` — `napProbability()` gains `napWindowClosed`; `selectNextEvent` removed entirely
- `js/ui/today-screen.js` — import split, `data-event-type` attributes, napStart-drop skip in `renderForecastSection`, `findLastEvent()` helper
- `sw.js` — `PRECACHE_LIST` gains `./js/lib/forecast-utils.js`
- `tests/unit/forecast.test.js` — PRED-12 tests updated for decoupled `napWindowClosed`; `selectNextEvent` describe blocks moved out
- `tests/unit/forecast-utils.test.js` — new file: moved `selectNextEvent` tests (3 assertions updated for the D-07 fallback branch) + new direct `nextReachableEvent` coverage
- `tests/unit/sw-precache.test.js` — new assertion for `forecast-utils.js`
- `tests/e2e/forecast.spec.js` — new napStart-hidden-when-closed test
- `tests/integration/forecast-flow.test.js` — import updated for the new module location

## Decisions Made

- `napWindowClosed` reuses the exact P90 comparison the old hard-collapse branch used (strict `>`, not `>=`) — no new configurable cutoff setting (D-03).
- `bedtimeAfterWake` keeps its own `RESULT_TYPE` literal (distinct from a plain `'bedtime'` resolution) so Plan 21-02's dual-hero rendering can distinguish the branches later; `bedtimeAfterNap` normalizes to `'bedtime'` since it's a calculation branch only (D-07).
- The napStart full-hide condition is scoped to `lastEvent === null || lastEvent.type === 'wake'` (D-04's carve-out) — once napStart is already logged for today, napEnd renders normally regardless of `napWindowClosed`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `tests/integration/forecast-flow.test.js`'s import for the moved `selectNextEvent`**
- **Found during:** Task 1 GREEN verification (`npm run test:unit` initially would have broken this file)
- **Issue:** This pre-existing integration test imported `selectNextEvent` from `js/lib/forecast.js`, which is a direct, mechanical consequence of the plan's own one-way extraction (D-06) removing that export — not a pre-existing unrelated defect.
- **Fix:** Split the import: `forecast` still from `forecast.js`, `selectNextEvent` now from `forecast-utils.js`.
- **Files modified:** `tests/integration/forecast-flow.test.js`
- **Verification:** `npm run test:unit` — 847/847 passing
- **Committed in:** `8a6422b` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Reworded a JSDoc comment in `forecast-utils.js` that tripped the `new Date()` clock-seam security-smoke test**
- **Found during:** Task 1 GREEN verification (`node --test tests/integration/security-smoke.test.js` failed)
- **Issue:** A docstring literally read "...instead of calling `new Date()`." — the security-smoke test's `scanForPattern` regex-matches raw source text without excluding comments, so this documentation sentence was flagged as an untagged clock read.
- **Fix:** Reworded to "...instead of reading the wall clock directly." (no functional change).
- **Files modified:** `js/lib/forecast-utils.js`
- **Verification:** `node --test tests/integration/security-smoke.test.js` — 9/9 passing
- **Committed in:** `8a6422b` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking import fix, 1 bug/false-positive doc fix)
**Impact on plan:** Both were mechanical consequences of the plan's own one-way extraction and the pre-existing security-smoke gate; no scope creep, no architectural changes.

## Issues Encountered

TDD sequencing note: implementation code was drafted before the RED test pass began. To preserve a genuine RED→GREEN cycle, the drafted `js/lib/forecast.js` changes and the new `js/lib/forecast-utils.js` were reverted/removed before writing and running the failing tests, then reapplied for GREEN. This is documented for transparency; the final git history shows a clean `test(21-01)` commit with all target tests failing for the expected reasons, followed by `feat(21-01)` commits with everything passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `js/lib/forecast-utils.js`'s `nextReachableEvent`/`selectNextEvent` contract is proven end-to-end (real render + real E2E check) — Plan 21-02 can build dual-hero-card rendering (`bedtimeAfterWake` alongside `napStart`) and the "Later today" collapsible section on top of it with confidence in the underlying architecture.
- `predictions.bedtimeAfterWake` does not yet exist on `forecast()`'s output (Plan 21-02's job) — `selectNextEvent`'s graceful fallback to `predictions.bedtime` when `bedtimeAfterWake` is absent is exercised and tested, so Plan 21-02 can add the field without needing to touch this fallback logic.
- PRED-24 remains open in REQUIREMENTS.md (shared with Plans 21-02/21-03 per the phase's shared-ID gate) — it will flip to complete once every plan declaring it has a `*-SUMMARY.md`.
- No blockers.

## Self-Check: PASSED

- FOUND: js/lib/forecast-utils.js
- FOUND: tests/unit/forecast-utils.test.js
- FOUND commit: bcaf800 (test)
- FOUND commit: 8a6422b (feat)
- FOUND commit: 0e51007 (feat)

---
*Phase: 21-prediction-normalization*
*Completed: 2026-09-16*
