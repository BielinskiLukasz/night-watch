---
phase: 25-algorithm-c-settings-modal
plan: 01
subsystem: forecast-algorithm
tags: [algorithm-c, dual-model-blend, wake-prediction, percentile-trim, service-worker]
requires: []
provides:
  - "js/lib/forecast-blend.js — blendForecast() entry point (PRED-13 shape parity), trimmedBand(), stabilityCheck(), wrapToDay(), BLEND_CONFIG"
  - "Wake dual-model blend (D-01/D-02) fully implemented end-to-end"
  - "'./js/lib/forecast-blend.js' registered in sw.js PRECACHE_LIST + enforcing test"
affects: [25-02-bedtime-nap-blend, 25-04-today-screen-wiring]
actuals:
  tokens: 5300
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Sibling-module duplication convention (own extractTime, own frozen config) — mirrors forecast-tif.js"
    - "Generalized N-interval stability check (Helly's-theorem justification documented inline for Plan 25-02 reuse)"
key-files:
  created:
    - js/lib/forecast-blend.js
    - tests/unit/forecast-blend.test.js
  modified:
    - sw.js
    - tests/unit/sw-precache.test.js
key-decisions:
  - "A2's bedtime-anchored duration band must be wrapToDay()-normalized into [0,1440) before stabilityCheck runs, so it shares A1's numeric reference frame — the plan's action text characterized this as unnecessary ('never needs wrapping ... once minutesToTime is applied'), but minutesToTime's own modulo wraparound only fixes the final display string, not the raw-minute comparisons stabilityCheck performs beforehand. Without wrapping, an overlapping A1/A2 pair is misclassified as non-overlapping and central drifts by ~12 hours. Fixed as a Rule 1 auto-fix bug during Task 1's GREEN phase (test caught it immediately)."
  - "sw.js PRECACHE_LIST insertion position followed the plan's explicit instruction (between forecast-tif.js and forecast-utils.js) rather than strict ASCII ordering (which would place forecast-blend.js before forecast-tif.js, since 'b' < 't'). The plan's acceptance criteria names this exact position, so it was treated as an authoritative (if loosely-labeled 'alphabetical') placement decision, not a bug to correct."
requirements-completed: [PRED-13, PRED-14, PRED-16]
coverage:
  - id: D1
    description: "trimmedBand() reproduces forecast-tif.js's trimmedMinMax budget/split/median math byte-for-byte"
    requirement: "PRED-14"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#trimmedBand(sortedValues, trimPct, manualExcludedCount)"
        status: pass
    human_judgment: false
  - id: D2
    description: "stabilityCheck() correctly resolves overlap-inside, no-overlap, touching-with-shrink, and overlap-outside-with-shrink cases per D-02"
    requirement: "PRED-14"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#stabilityCheck(intervals, central, shrinkage)"
        status: pass
    human_judgment: false
  - id: D3
    description: "blendForecast() cold-start gate returns tifForecast's exact null-filled shape"
    requirement: "PRED-13"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#cold-start gate: fewer than minDays valid records"
        status: pass
    human_judgment: false
  - id: D4
    description: "Wake dual-model blend (A1 historic wake band + A2 bedtime-anchored sleep-length band) produces a valid ordered HH:MM band on overlap, and falls back cleanly to A1 alone when A2 is unavailable"
    requirement: "PRED-14"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#wake, A1+A2 overlap / wake, A2-unavailable"
        status: pass
    human_judgment: false
  - id: D5
    description: "bedtime/napStart/napEnd are explicit {central:null,min:null,max:null} stubs (not undefined) so PRED-13's shape contract holds even for not-yet-implemented events"
    requirement: "PRED-13"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#bedtime/napStart/napEnd are explicit ... stubs"
        status: pass
    human_judgment: false
  - id: D6
    description: "forecast-blend.js is precached for offline/PWA use"
    requirement: "PRED-16"
    verification:
      - kind: unit
        ref: "tests/unit/sw-precache.test.js#contains forecast-blend.js (Algorithm C module)"
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-09-18
status: complete
---

# Phase 25 Plan 1: Algorithm C Tracer — Wake Dual-Model Blend Summary

**`js/lib/forecast-blend.js` created with shared trim/stability math and a fully working wake dual-model blend (historic wake-up band + bedtime-anchored sleep-length band with overlap/shrinkage stability check), proving the exact top-level shape `today-screen.js` needs before Plan 25-02 expands to bedtime/nap predictions.**

## Performance
- **Duration:** ~20min
- **Started:** 2026-09-18T12:07Z (context load) / commits 12:57–13:02
- **Completed:** 2026-09-18T13:02:15+02:00
- **Tasks:** 2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `blendForecast()` returns `{ isColdStart, wake, bedtime, napStart, napEnd }` — identical top-level shape to `forecast()`/`tifForecast()` (PRED-13), with wake fully computed via the D-01/D-02 dual-model blend and the remaining three events explicitly stubbed for Plan 25-02.
- `trimmedBand()` and `stabilityCheck()` are generically reusable helpers — `stabilityCheck`'s inline comment documents the Helly's-theorem justification for why the identical 2-interval code handles Plan 25-02's 3-interval bedtime case with zero changes.
- `forecast-blend.js` registered in `sw.js`'s `PRECACHE_LIST` with an enforcing test, so it is available offline from this plan onward.

## Task Commits
1. **Task 1: forecast-blend.js — shared trim/stability helpers + wake dual-model blend** - `3539fd5` (test, RED) → `77a1015` (feat, GREEN)
2. **Task 2: Register forecast-blend.js in the service-worker precache list** - `e193864` (chore)

## Files Created/Modified
- `js/lib/forecast-blend.js` - Algorithm C entry point: `blendForecast`, `trimmedBand`, `stabilityCheck`, private `wrapToDay`, frozen `BLEND_CONFIG`
- `tests/unit/forecast-blend.test.js` - RED→GREEN coverage for all `<behavior>` cases in the plan
- `sw.js` - added `'./js/lib/forecast-blend.js'` to `PRECACHE_LIST`
- `tests/unit/sw-precache.test.js` - added `contains forecast-blend.js (Algorithm C module)` test

## Decisions Made
- **A2 wrapToDay normalization (Rule 1 bug fix):** the plan's action text argued A2's bedtime-anchored duration band "never needs wrapping" because `minutesToTime()` wraps automatically. That's true only for the *display string*, not for the raw-minute arithmetic `stabilityCheck()` performs before display conversion — without wrapping, A1 (~360-415 raw min) and A2 (~1800-1855 raw min) live in different reference frames, so the overlap test misclassifies them as non-overlapping and the central prediction drifts by ~12 hours. Fixed by wrapping A2's min/max/median into `[0, 1440)` via the already-planned `wrapToDay()` helper before combining — caught immediately by the "A1+A2 overlap" behavior test.
- **PRECACHE_LIST insertion position:** followed the plan's explicit instruction (insert between `forecast-tif.js` and `forecast-utils.js`) rather than strict ASCII alphabetical order (which places `forecast-blend.js` before `forecast-tif.js`, since `'b' < 't'`). The plan's own acceptance criteria names this exact position, so it was honored as written.

## Deviations from Plan

**1. [Rule 1 - Bug] A2 duration band needed explicit wrapToDay() normalization before stabilityCheck**
- **Found during:** Task 1, GREEN phase (test "wake, A1+A2 overlap" failed on first implementation attempt)
- **Issue:** A2 (`lastBedtime + trimmedBand(sleepDurations)`) is computed in raw minutes that exceed 1440 (crosses midnight), while A1 (historic wake-up band) stays within `[0, 1440)`. Feeding both directly into `stabilityCheck()` compared incompatible numeric ranges, misclassifying an overlapping pair as non-overlapping and producing a central prediction off by ~12 hours (`18:20` instead of a value between `06:00` and `06:55`).
- **Fix:** Applied the already-planned private `wrapToDay()` helper to A2's `min`/`max`/`median` immediately after computing the anchored duration band, before passing to `stabilityCheck()`.
- **Files modified:** `js/lib/forecast-blend.js`
- **Verification:** `node --test tests/unit/forecast-blend.test.js` — all 12 tests pass, including the overlap and A2-unavailable-fallback cases.
- **Committed in:** `77a1015` (folded into the GREEN commit — no separate fix commit needed since GREEN hadn't been committed yet)

---
**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Low — the fix is a small, well-justified addition to already-planned machinery (`wrapToDay()` was already specified in the plan, just not wired into the A2 computation). No architectural change; Plan 25-02's `trimmedBand`/`stabilityCheck` reuse is unaffected.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 25-02 can import `trimmedBand`, `stabilityCheck`, and `wrapToDay` unchanged from `js/lib/forecast-blend.js` to implement bedtime (3-band, D-03..D-06), nap-start (D-08), and nap-end (D-09/D-10) blends — `stabilityCheck`'s N-interval design is already verified to generalize via the Helly's-theorem argument documented in its own comment.
- No blockers. `blendForecast`'s wake branch is production-quality (tracer requirement met) and ready for `today-screen.js` to wire in once Plan 25-04 runs.
- `node --test tests/unit/forecast-blend.test.js tests/unit/sw-precache.test.js` passes (34/34 assertions across both files); `npm run test:unit` shows 916/916 passing with no regressions.

## Self-Check: PASSED
- FOUND: js/lib/forecast-blend.js
- FOUND: tests/unit/forecast-blend.test.js
- FOUND: sw.js (modified, contains './js/lib/forecast-blend.js')
- FOUND: tests/unit/sw-precache.test.js (modified, contains new test)
- FOUND commit: 3539fd5
- FOUND commit: 77a1015
- FOUND commit: e193864

---
*Phase: 25-algorithm-c-settings-modal*
*Completed: 2026-09-18*
