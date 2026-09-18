---
phase: 20-nap-probability-redesign
plan: 06
subsystem: ui
tags: [today-screen, forecast, dom, e2e, playwright]

# Dependency graph
requires:
  - phase: 21-prediction-normalization
    provides: nextReachableEvent/selectNextEvent dual-hero model, napWindowClosed, predictions.bedtimeAfterWake, the "Later today" collapsible section this plan renames and fixes
provides:
  - "Details" section (renamed from "Later today") that includes a detail card for every reachable prediction type, including the hero's own type (G-20-15 closure)
  - Bedtime-slot substitution: predictions.bedtimeAfterWake replaces predictions.bedtime in the Details section once nap is definitively off the table for today, with a distinct "Bedtime (no nap)" label while keeping data-event-type="bedtime" (G-20-16 item 2 closure)
  - data-event-type on renderPredictionCard/renderTifNormalCard/renderTifLowConfidenceCard routed through the existing LOGGABLE_EVENT_TYPE map
affects: [today-screen, 20-UAT, 21-prediction-normalization]

# Actuals (#2632)
actuals:
  tokens: 5104
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-event-type attributes on non-hero card renderers route through the frozen LOGGABLE_EVENT_TYPE map, matching the hero renderer's existing pattern (T-21-01 extended)"
    - "Details-loop per-slot renderType/pred local-variable reassignment pattern for a substitution that must preserve the DOM identity attribute while changing the rendered data and label"

key-files:
  created: []
  modified:
    - js/ui/today-screen.js
    - tests/e2e/next-reachable-event.spec.js
    - tests/e2e/forecast.spec.js
    - tests/integration/today-hero-later-today.test.js

key-decisions:
  - "EVENT_TYPE_LABEL['bedtimeAfterWake'] changed to 'Bedtime (no nap)' — a distinct string from 'bedtime', since forecast.js computes them as genuinely separate series"
  - "Details loop keeps a single fixed EVENT_TYPES order (wake/napStart/napEnd/bedtime) and no longer skips a type just because it matches the current hero; the heroTypes exclusion set was deleted as dead code"
  - "Bedtime-slot substitution condition is exactly `type === 'bedtime' && napStartHiddenToday && predictions.bedtimeAfterWake` — reuses the existing napStartHiddenToday signal instead of introducing a new one, and naturally never fires for TIF/Algorithm C since they never populate predictions.bedtimeAfterWake"
  - "today-hero-later-today.test.js's minimal DOM mock's _matchesSel was extended to support attribute-value selectors ([data-event-type=\"wake\"]) — the prior mock silently always returned false for any non-class selector, which had let the old (buggy) exclusion assertion pass for the wrong reason"
  - "New label-distinction E2E test reuses Test 5's makeDualHeroDb fixture (real no-nap-day history) with the clock pinned past eveningHour instead of before it, rather than reusing makeWindowClosedDb, because makeWindowClosedDb has no no-nap-day history at all and would leave predictions.bedtimeAfterWake null"

patterns-established:
  - "Details-loop renderType/pred reassignment: when a substitution needs to swap both the rendered prediction object and its display type while a downstream map (LOGGABLE_EVENT_TYPE) keeps the DOM attribute stable, introduce local renderType/pred variables inside the loop body rather than mutating the loop variable or the predictions object"

requirements-completed:
  - PRED-18
  - PRED-19
  - PRED-23
  - PRED-24
  - UI-13

coverage:
  - id: D1
    description: "Details section (renamed from Later Today) shows a detail card for every reachable prediction type, including the hero's own type"
    requirement: "UI-13"
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
        ref: "tests/e2e/next-reachable-event.spec.js#wake (window open) -> dual hero [napStart, bedtimeAfterWake]"
        status: pass
      - kind: e2e
        ref: "tests/e2e/forecast.spec.js#after 32 valid-day events (all 4 types), prediction cards appear (D3-08)"
        status: pass
      - kind: integration
        ref: "tests/integration/today-hero-later-today.test.js#the hero (wake) is rendered into nextEventCard AND also gets its own detail card inside Details"
        status: pass
    human_judgment: false
  - id: D2
    description: "Once nap is definitively off the table for today, the Details bedtime slot substitutes predictions.bedtimeAfterWake (distinct 'Bedtime (no nap)' label) instead of the stale blended predictions.bedtime, while data-event-type stays 'bedtime'"
    requirement: "PRED-18"
    verification:
      - kind: e2e
        ref: "tests/e2e/next-reachable-event.spec.js#window closed: Details bedtime slot shows the distinct no-nap label, not the plain bedtime label"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderPredictionCard/renderTifNormalCard/renderTifLowConfidenceCard route data-event-type through LOGGABLE_EVENT_TYPE so bedtimeAfterWake never leaks as a DOM attribute value"
    requirement: "PRED-24"
    verification:
      - kind: unit
        ref: "npm run test:unit (989 unit/integration tests, 0 failures)"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-09-18
status: complete
---

# Phase 20 Plan 06: Details section hero-inclusion + bedtime substitution Summary

**today-screen.js's collapsed "Later today" section renamed to "Details", stopped excluding the hero's own event type, and now substitutes the no-nap-day bedtimeAfterWake series (with a distinct "Bedtime (no nap)" label) once nap is off the table for today.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-09-18T20:04:23Z
- **Completed:** 2026-09-18T20:51:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Closed G-20-15: every reachable prediction type — including whichever one is currently the hero — now gets a detail card in the renamed "Details" section, so the next predicted event's own detail view always exists somewhere in the DOM.
- Closed G-20-16 item 2: once `napStartHiddenToday` is true and `predictions.bedtimeAfterWake` has real data, the Details bedtime slot renders that pure no-nap-day series instead of the possibly-stale blended `predictions.bedtime`, with a visually distinct "Bedtime (no nap)" label while its `data-event-type` still reads `'bedtime'`.
- Extended the existing `T-21-01` `LOGGABLE_EVENT_TYPE` routing (previously hero-card-only) to the three non-hero card renderers, so a card's display label and its DOM identity attribute can diverge safely for the new `bedtimeAfterWake` case without breaking any existing `[data-event-type="..."]` E2E selector.
- Rewrote the E2E/integration assertions that had pinned the old (buggy) exclusion behavior, and added new coverage that concretely proves both gap closures with real data (matching hero/Details central times, and a distinct label check) rather than mere presence checks.
- Fixed a latent bug in `today-hero-later-today.test.js`'s minimal DOM mock: its selector matcher silently always returned `false` for any non-class selector (e.g. attribute selectors), which had let the old exclusion-pinning assertion pass without actually checking anything. Extended it to support `[data-event-type="..."]`-style matching.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename Later-Today to Details, stop excluding the hero's own type, add bedtime/bedtimeAfterWake substitution + distinct labels** - `ccc8290` (feat)
2. **Task 2: Update existing test assertions for the corrected Details-section behavior + add new coverage proving both gaps are closed** - `9130a7c` (test)

_No separate plan-metadata commit hash yet — captured by the final-commit step below._

## Files Created/Modified

- `js/ui/today-screen.js` - EVENT_TYPE_LABEL gains a distinct `bedtimeAfterWake` label; the three non-hero card renderers route `data-event-type` through `LOGGABLE_EVENT_TYPE`; `renderForecastSection`'s "Later today"→"Details" rename, hero-type exclusion removal, and bedtime/bedtimeAfterWake substitution logic
- `tests/e2e/next-reachable-event.spec.js` - Tests 1/2/3/5 updated card counts (3→4 / 2→4) and per-type assertions for hero-inclusion; new Test 1 hero/Details time-match assertion; new dedicated label-distinction test (G-20-16 item 2 regression pin)
- `tests/e2e/forecast.spec.js` - Test 2's card count updated 3→4 and its comment corrected to describe the renamed "Details" section
- `tests/integration/today-hero-later-today.test.js` - rewrote the test that pinned the old exclusion bug into one that proves the hero's own type now also gets a Details detail card; extended the mock DOM's `_matchesSel` to support attribute selectors

## Decisions Made

- `EVENT_TYPE_LABEL['bedtimeAfterWake']` is now `'Bedtime (no nap)'`, distinct from `'Bedtime'` — matches forecast.js's genuinely separate `bedtimePred`/`bedtimeAfterWakePred` series.
- Deleted the `heroTypes` Set/exclusion block entirely (dead code once the exclusion it fed was removed) rather than leaving it unused.
- Bedtime-slot substitution reuses the existing `napStartHiddenToday` signal (per the plan's `key_links`) rather than introducing a new gating condition.
- New label-distinction E2E test reuses Test 5's `makeDualHeroDb` fixture (real no-nap-day history across a 14-day rolling window) with the clock pinned past `eveningHour` instead of `makeWindowClosedDb`, whose fixture has no no-nap-day history at all and would have left `predictions.bedtimeAfterWake` null, making the intended assertion untestable with that fixture.
- Extended `today-hero-later-today.test.js`'s mock DOM selector matcher (`_matchesSel`) to support attribute-value selectors, since the plan's new assertion needed a real (not silently-always-false) `[data-event-type="..."]` match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the integration test mock's selector matcher to support attribute selectors**
- **Found during:** Task 2
- **Issue:** `today-hero-later-today.test.js`'s minimal DOM mock's `_matchesSel` helper only ever matched class selectors (`.foo`); any other selector shape (including the plan-specified `[data-event-type="wake"]` attribute selector) silently returned `false` for every node, regardless of the actual DOM state. This meant the plan's intended new assertion (`wakeCardsInLaterToday.length === 1`) would have failed for the wrong reason (mock limitation, not production behavior), and — more importantly — explained why the *original* buggy exclusion test had passed even before Task 1's fix: its `querySelector('[data-event-type="wake"]')` call always returned `null` via the same mock gap, regardless of whether wake actually appeared in Later Today.
- **Fix:** Extended `_matchesSel` to parse and match `[attr]` / `[attr="value"]` selectors against `node.getAttribute()`, alongside the existing class-selector support.
- **Files modified:** tests/integration/today-hero-later-today.test.js
- **Verification:** `node --test tests/integration/today-hero-later-today.test.js` — 9/9 pass, with the new assertion now genuinely exercising the attribute check.
- **Committed in:** 9130a7c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, discovered while implementing the plan's own specified test change)
**Impact on plan:** Necessary for the plan's new assertion to actually verify anything; no scope creep — the fix is scoped entirely to the test-only mock helper.

## Issues Encountered

- The plan's Task 2 action item for the new label-distinction test suggested using `makeWindowClosedDb` (already defined for Test 4). That fixture has no no-nap-day history at all (every full day in it logs a nap), so `predictions.bedtimeAfterWake` is null there and the bedtime slot falls through to the plain (unchanged) `predictions.bedtime` path — the label-distinction assertion failed with "Bedtime" instead of the expected "Bedtime (no nap)" text on first run. Resolved by reusing Test 5's `makeDualHeroDb` fixture (which has real no-nap-day history) with the clock pinned past `eveningHour` instead of before it, collapsing the dual-hero case to the single bedtimeAfterWake-hero substitution case this test needed to exercise.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-20-15 and G-20-16 item 2 are both closed; 20-UAT.md tests 15 and 16 (root cause #2) should now be considered resolved pending final UAT re-verification.
- Full regression sweep passed: 989 unit/integration tests (0 failures) + 151 E2E tests (0 failures), including `tif.spec.js` and `algorithm-c.spec.js`'s Later-Today/Details-adjacent specs which use tolerant (`.first()`/`toBeGreaterThan(0)`-style) assertions and needed no changes.
- No new follow-ups or open concerns introduced by this plan beyond the pre-existing ones already tracked in STATE.md's Operator Next Steps.

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-18*

## Self-Check: PASSED

- FOUND: js/ui/today-screen.js
- FOUND: tests/e2e/next-reachable-event.spec.js
- FOUND: tests/e2e/forecast.spec.js
- FOUND: tests/integration/today-hero-later-today.test.js
- FOUND commit: ccc8290 (Task 1)
- FOUND commit: 9130a7c (Task 2)
