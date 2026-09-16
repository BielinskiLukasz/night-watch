---
phase: 21-prediction-normalization
plan: 02
subsystem: prediction-engine
tags: [forecast, today-screen, dual-hero, collapsible-ui, tif, tdd]

# Dependency graph
requires:
  - phase: 21-prediction-normalization
    provides: "Plan 21-01's nextReachableEvent()/selectNextEvent() 5-path event model in
      js/lib/forecast-utils.js, the napWindowClosed decoupled flag, and data-event-type
      attributes on all card types"
provides:
  - "forecast()'s predictions.bedtimeAfterWake — the raw, unblended
    buildBedtimeSeriesNoNapDay(window, settings) result, independent of predictions.bedtime"
  - "js/ui/today-screen.js renderNextEventCard (exported) — accepts a bare prediction OR a
    1-2 element array; a 2-element array renders a .hero-row of two .next-event-hero cards"
  - "js/ui/today-screen.js renderForecastSection (exported) — calls nextReachableEvent
    directly, builds the hero row, and wraps every remaining non-dropped prediction in a
    collapsed-by-default '.later-today-section' <details> that auto-expands nested
    collapsed cards (.tif-card/.probability-band) once opened"
  - "style.css .hero-row / .later-today-section rules"
affects: [21-03-full-e2e-coverage-matrix]

# Actuals (#2632)
actuals:
  tokens: 12850
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "selectBedtime lifted from an IIFE-local closure to forecast()'s function scope so a
      second call site (bedtimeAfterWake) can reuse the same probability-band-check logic
      without duplicating it"
    - "renderOneHeroCard extracted from the old single-shape renderNextEventCard so the
      exported renderNextEventCard can build either a bare hero or a 2-up .hero-row without
      duplicating card-body markup"
    - "Local HERO_PREDICTION_FIELD/HERO_RESULT_TYPE/LOGGABLE_EVENT_TYPE tables in
      today-screen.js mirror forecast-utils.js's internal (non-exported) mapping tables —
      duplicated deliberately since renderForecastSection now calls nextReachableEvent
      directly instead of going through selectNextEvent's wrapper"
    - "data-event-type on hero cards reports the underlying loggable event type
      (bedtimeAfterWake -> 'bedtime') even though the hero's internal `type` stays
      'bedtimeAfterWake' for card-selection/labeling logic — keeps E2E selectors uniform
      across hero and Later-Today cards for the four real loggable event types"

key-files:
  created:
    - tests/integration/today-hero-later-today.test.js
  modified:
    - js/lib/forecast.js
    - js/ui/today-screen.js
    - style.css
    - tests/unit/forecast.test.js
    - tests/e2e/forecast.spec.js
    - tests/e2e/tif.spec.js

key-decisions:
  - "selectBedtime and the shared bedtimeTimes array are lifted out of the bedtimePred
    IIFE to forecast()'s top-level scope (D-09) rather than duplicated, so
    bedtimeAfterWake reuses the exact same probability-band-check logic as bedtime"
  - "The napStart-drop condition (napStartHiddenToday) drops the extra
    'napProbabilityScore != null' guard that 21-01's implementation carried, matching
    D-04/D-05's literal formula: (lastEvent null-or-wake) AND (napWindowClosed OR
    currentHour >= eveningHour) — napProbabilityScore is always attached in the real
    render() path, so this is a no-observable-difference simplification in production,
    but it changes behavior for direct/synthetic calls to renderForecastSection that omit
    the score object entirely"
  - "data-event-type on hero cards maps bedtimeAfterWake -> 'bedtime' via a new
    LOGGABLE_EVENT_TYPE table, distinct from the hero's internal 'type' field used for
    EVENT_TYPE_LABEL/napStart-badge logic — keeps the pre-existing E2E napStart-hidden
    test (21-01) passing without modification, since bedtimeAfterWake is not a new
    loggable event type (D-07)"
  - "The Later-Today auto-expand listener (D-13) targets both '.tif-card.collapsed' AND
    '.probability-band.collapsed' — this auto-expands classic probability-band cards too,
    not just TIF cards, per the plan's explicit selector list; three pre-existing E2E
    tests (forecast.spec.js Tests 4/5, tif.spec.js Test 2) were rewritten to assert
    'collapsed while closed, auto-expanded on open, still manually toggleable' instead of
    the old 'collapsed after page load, manually click to expand' sequence"
  - "renderForecastSection is now exported (previously private) so
    tests/integration/today-hero-later-today.test.js can exercise the real Later-Today
    auto-expand listener end-to-end instead of re-implementing equivalent mock logic"

patterns-established:
  - "Dual-hero-capable hero renderer: a single exported function accepts either shape
    (bare prediction or array) so callers/tests don't need two separate APIs for the
    single-hero vs 2-up-hero cases"

requirements-completed: [PRED-24, UI-13]

coverage:
  - id: D1
    description: "forecast()'s predictions.bedtimeAfterWake is the raw, unblended
      buildBedtimeSeriesNoNapDay(window, settings) result, independent of
      predictions.bedtime; genuinely null (not a partial object) when the no-nap-day
      sub-window is thin"
    requirement: "UI-13"
    verification:
      - kind: unit
        ref: "tests/unit/forecast.test.js#forecast() predictions.bedtimeAfterWake (D-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Today screen shows napStart and bedtimeAfterWake as two
      equally-prominent hero cards side by side when the last event is wake and nap
      remains reachable (window open, before eveningHour)"
    requirement: "UI-13"
    verification:
      - kind: integration
        ref: "tests/integration/today-hero-later-today.test.js#renderNextEventCard (Phase 21 D-08 dual-hero)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/tif.spec.js#TIF prediction cards (.tif-card, .tif-score-badge) render after switching to TIF algorithm"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-hero predictions render inside a single collapsed-by-default
      'Later today' <details> section (no open attribute) wrapping the existing
      renderPredictionCard/renderTifNormalCard/renderTifLowConfidenceCard renderers
      unchanged"
    requirement: "PRED-24"
    verification:
      - kind: integration
        ref: "tests/integration/today-hero-later-today.test.js#renderForecastSection \"Later today\" section (D-10/D-11/D-12/D-13)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/forecast.spec.js#after 32 valid-day events (all 4 types), prediction cards appear (D3-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A TIF card (and, per the implemented selector, a classic
      probability-band card) nested inside 'Later today' auto-expands once the outer
      <details> is opened"
    requirement: "PRED-24"
    verification:
      - kind: integration
        ref: "tests/integration/today-hero-later-today.test.js#dispatching `toggle` while open removes .collapsed from the nested TIF card and flips its chevron to ↑ (D-13)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/forecast.spec.js#probability-band forecast card starts collapsed, then auto-expands when Later Today opens (UI-09 / D-13)"
        status: pass
    human_judgment: false
  - id: D5
    description: "napProbability() and nextReachableEvent() together produce identical
      hero/Later-Today placement decisions for two different currentHour values that both
      fall before the nap window closes and before eveningHour (clock-invariance carries
      through to the UI layer)"
    human_judgment: true
    rationale: "Marked verification: backstop in the plan — not exercised by a dedicated
      two-currentHour-value test. Structurally guaranteed by nextReachableEvent's purity
      (Plan 21-01): currentHour only affects the napStartDropped branch via a >= comparison
      against a fixed eveningHour, and napWindowClosed is derived from a fixed P90 boundary
      independent of the two hours being compared, as long as both stay on the same side of
      both thresholds. No regression risk identified, but a human should confirm this
      reasoning holds if either threshold's derivation changes."

# Metrics
duration: 28min
completed: 2026-09-16
status: complete
---

# Phase 21 Plan 2: Dual-Hero Rendering & Later-Today Section Summary

**forecast() gains an independent `predictions.bedtimeAfterWake` field, and the Today screen replaces its flat 4-card grid with 1-2 hero cards plus a collapsed-by-default "Later today" section that auto-expands nested TIF/probability-band cards on open.**

## Performance

- **Duration:** 28 min
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- `js/lib/forecast.js`: `forecast()` now returns `predictions.bedtimeAfterWake` — the raw, unblended `buildBedtimeSeriesNoNapDay(window, settings)` result, computed independently of `predictions.bedtime`'s PRED-18/19 blended/split-routed value. `selectBedtime` and the shared `bedtimeTimes` array were lifted from the `bedtimePred` IIFE to function scope so both fields reuse the identical probability-band-check logic. Genuinely `null` (not `{central:null,...}`) when the no-nap-day sub-window is thin.
- `js/ui/today-screen.js`: `renderNextEventCard` is now exported and dual-hero capable — it accepts a bare prediction (unchanged single-hero output) or a 1-2 element array, rendering two side-by-side `.next-event-hero` cards inside a new `.hero-row` wrapper when given two. The shared card body was extracted into a private `renderOneHeroCard` helper to avoid duplication.
- `renderForecastSection` (now exported) was rewritten to call `nextReachableEvent` directly instead of `selectNextEvent`, mapping the returned 1-2-path array to hero prediction objects via local `HERO_PREDICTION_FIELD`/`HERO_RESULT_TYPE` tables (mirroring forecast-utils.js's internal, non-exported tables). Every prediction not selected as a hero (and not dropped by the existing napStart-hide rule) is appended into a new `.later-today-section` `<details>` — collapsed by default, no `open` attribute, matching Phase 17's convention — wrapping the existing `renderPredictionCard`/`renderTifNormalCard`/`renderTifLowConfidenceCard` renderers completely unchanged.
- D-13 auto-expand: a `toggle` listener on the Later-Today `<details>` removes `.collapsed` (and flips the chevron to `↑`) from any nested `.tif-card.collapsed` or `.probability-band.collapsed` child once the section opens — covers TIF cards and classic probability-band cards alike, per the plan's explicit selector list.
- `style.css` gains `.hero-row` (flex row, mobile stack at ≤480px) and `.later-today-section` (summary styling, spacing) rules.
- New `tests/integration/today-hero-later-today.test.js` covers the dual-hero/single-hero shape distinction and the real auto-expand listener end-to-end via an extended DOM mock (compound-class selector matching + synthetic `toggle` dispatch).
- Three pre-existing E2E tests (`forecast.spec.js` Tests 2/4/5/7, `tif.spec.js` Tests 2/3) were updated for the new hero/Later-Today DOM split, with deterministic clock pins added where hero/drop selection depends on the wall clock. No coverage was dropped — every previously-tested behavior (probability-band collapse/expand, missed-label rendering, TIF precision badge, TIF card removal on algorithm switch) still has a passing assertion, relocated to the correct container.

## Task Commits

TDD RED→GREEN cycle for Task 1, plus standard commits for Tasks 2 and 3:

1. **Task 1 RED — failing tests for bedtimeAfterWake (D-09)** - `299d805` (test)
2. **Task 1 GREEN — add predictions.bedtimeAfterWake to forecast()** - `f97b5af` (feat)
3. **Task 2 — dual-hero rendering and Later Today section (D-08..D-13)** - `5ee7647` (feat)
4. **Task 3 — fix E2E assertions for hero/Later-Today DOM split** - `5d64a03` (test)

_No REFACTOR commit was needed — the GREEN implementation didn't require a follow-up cleanup pass._

## Files Created/Modified

- `js/lib/forecast.js` — `bedtimeAfterWake` field, `selectBedtime`/`bedtimeTimes` lifted to function scope, JSDoc updated
- `js/ui/today-screen.js` — `renderNextEventCard` exported/dual-hero, `renderOneHeroCard` extracted, `renderForecastSection` exported/rewritten around `nextReachableEvent`, `EVENT_TYPE_LABEL`/`LOGGABLE_EVENT_TYPE` additions
- `style.css` — `.hero-row`, `.later-today-section` rules
- `tests/unit/forecast.test.js` — new `forecast() predictions.bedtimeAfterWake (D-09)` describe block (3 tests)
- `tests/integration/today-hero-later-today.test.js` — new file: dual-hero shape tests + Later-Today auto-expand tests
- `tests/e2e/forecast.spec.js` — Tests 2, 4, 5, 7 updated for the hero/Later-Today DOM split and D-13 auto-expand semantics
- `tests/e2e/tif.spec.js` — Tests 2, 3 updated for the hero/Later-Today DOM split

## Decisions Made

- `selectBedtime`/`bedtimeTimes` lifted out of the `bedtimePred` IIFE to forecast()'s function scope (D-09) rather than duplicated — `bedtimeAfterWake` reuses the exact same probability-band-check logic as `bedtime`.
- `napStartHiddenToday`'s formula now matches D-04/D-05 literally (drops the extra `napProbabilityScore != null` guard 21-01 carried) — no observable production difference since `napProbabilityScore` is always attached in the real `render()` path, but this changes behavior for direct/synthetic calls that omit the score object.
- Hero cards' `data-event-type` attribute maps `bedtimeAfterWake` → `'bedtime'` via a new `LOGGABLE_EVENT_TYPE` table (distinct from the hero's internal `type` field, which stays `'bedtimeAfterWake'` for label/badge logic) — keeps 21-01's pre-existing napStart-hidden E2E test passing unmodified, since `bedtimeAfterWake` is not a new loggable event type (D-07).
- The D-13 auto-expand listener's selector list (`.tif-card.collapsed`, `.probability-band.collapsed`) auto-expands classic probability-band cards too, not just TIF cards — three pre-existing E2E tests were rewritten around "collapsed while closed → auto-expanded on open → still manually toggleable" instead of "collapsed after page load → manually click to expand".
- `renderForecastSection` is now exported so the new integration test can exercise the real production auto-expand listener end-to-end, rather than re-implementing equivalent logic in the test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a cold-start branch regression introduced while rewriting renderForecastSection**
- **Found during:** Task 2, self-review before running tests
- **Issue:** While rewriting the cold-start early-return branch, `coldStartMsg.style.display` was accidentally set to `'none'` instead of `''`, which would have hidden the cold-start message it's meant to show.
- **Fix:** Restored `coldStartMsg.style.display = '';` in the cold-start branch.
- **Files modified:** `js/ui/today-screen.js`
- **Verification:** `node --test tests/unit/ tests/integration/` (859/859 passing, including the pre-existing cold-start E2E test)
- **Committed in:** `5ee7647` (Task 2 commit — caught before commit, not a separate fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug caught during self-review, fixed before commit)
**Impact on plan:** No scope creep — a transcription slip caught and corrected during the same task's implementation, before any commit or test run relied on the broken state.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `predictions.bedtimeAfterWake`, the dual-hero renderer, and the Later-Today section are all proven end-to-end (unit + integration + E2E) — Plan 21-03 can build its full E2E coverage matrix for all 5 `nextReachableEvent` paths on top of this foundation.
- `PRED-24` and `UI-13` remain `[ ]` in REQUIREMENTS.md (shared with Plan 21-03 per the phase's shared-ID gate) — they will flip to complete once 21-03 also has a SUMMARY.
- No blockers.

## Self-Check: PASSED

- FOUND: tests/integration/today-hero-later-today.test.js
- FOUND: js/lib/forecast.js (bedtimeAfterWake)
- FOUND: js/ui/today-screen.js (renderNextEventCard export, renderForecastSection export)
- FOUND: style.css (.hero-row, .later-today-section)
- FOUND commit: 299d805 (test)
- FOUND commit: f97b5af (feat)
- FOUND commit: 5ee7647 (feat)
- FOUND commit: 5d64a03 (test)

---
*Phase: 21-prediction-normalization*
*Completed: 2026-09-16*
