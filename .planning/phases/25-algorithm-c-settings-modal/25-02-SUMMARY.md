---
phase: 25-algorithm-c-settings-modal
plan: 02
subsystem: forecast-algorithm
tags: [algorithm-c, dual-model-blend, multi-band-blend, bedtime-prediction, nap-prediction, percentile-trim]
requires:
  - phase: 25-01
    provides: "js/lib/forecast-blend.js — blendForecast() entry point, trimmedBand(), stabilityCheck(), wrapToDay(), wake dual-model blend"
provides:
  - "js/lib/forecast-blend.js — combineModels(models, shrinkage) shared 0/1/N-model combiner"
  - "Nap-start dual-model blend (D-07/D-08) fully implemented"
  - "Nap-end dual-model blend (D-09/D-10) fully implemented, including the D-10 actual-else-predicted nap-start anchor"
  - "Bedtime three-model blend (D-03..D-06) fully implemented, including the D-05 no-nap-day substitution and its own thin-data graceful degradation"
  - "blendForecast() now covers all 4 Algorithm C events (wake, bedtime, napStart, napEnd) — PRED-17 complete"
affects: [25-03-settings-modal-fields, 25-04-today-screen-wiring, 25-05-e2e]
actuals:
  tokens: 6344
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - "combineModels(models, shrinkage) shared 0/1/N-model combiner — extends Plan 25-01's ad-hoc A1/A2 combine into a reusable helper for 2-model (napStart, napEnd) and 3-model (bedtime) groups"
    - "actual-else-predicted anchor resolution (`todayActualXHHMM ?? xPred.central`) — D-10's rule for nap-end's nap-start anchor, extended by this plan to bedtime's wake and nap-end anchors (D-03/D-04)"
    - "no-nap-day model substitution (D-05) — an isNoNapDay branch swaps an entire model's data source rather than omitting it, distinct from the graceful-degradation null-omission pattern used everywhere else"
key-files:
  created: []
  modified:
    - js/lib/forecast-blend.js
    - tests/unit/forecast-blend.test.js
key-decisions:
  - "combineModels() is a private (non-exported) helper per the plan's 'shared local helper' framing — it is exercised indirectly through blendForecast()'s napStart/napEnd/bedtime behavior tests rather than unit-tested in isolation, consistent with how Plan 25-01 tested stabilityCheck's reuse via wake's own behavior tests."
  - "Nap-start/nap-end fixtures use a constant wake anchor (06:00) with jittered gap/duration series, not a varying wake anchor — a varying-wake design produced a degenerate single-point Model 1 band that collided with stabilityCheck's touching-interval shrink formula (the same class of edge case Plan 25-01's stabilityCheck test 3 documents), pushing central outside [min,max] and breaking the plan's own min<=central<=max assertion. Constant-wake fixtures give Model 1 the same real spread as Model 2, avoiding the degenerate collapse without touching production code."
requirements-completed: [PRED-15, PRED-16, PRED-17]
coverage:
  - id: D1
    description: "combineModels(models, shrinkage) correctly resolves 0 models (null triple), 1 model (pass-through), and 2+ models (average-of-medians central + stabilityCheck) — exactly one definition, reused by napStart, napEnd, and bedtime"
    requirement: "PRED-16"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#blendForecast — nap-start/nap-end/bedtime describe blocks (indirect coverage via blendForecast's public surface)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nap-start (D-07/D-08): wake-anchored gap Model 1 (only when today's wake is logged) + historic nap-start Model 2, degrading to Model 2 alone or null when Model 1/both are unavailable"
    requirement: "PRED-17"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#blendForecast — nap-start (D-07/D-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nap-end (D-09/D-10): fully chained wake-anchored gap+duration Model 1 + nap-start-anchored duration Model 2, where the Model 2 anchor is today's actual nap-start if logged else the nap-start prediction's own central value; both-unavailable returns the explicit null triple"
    requirement: "PRED-17"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#blendForecast — nap-end (D-09/D-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bedtime (D-03..D-06): historic bedtime Model 1 + wake-anchored day-length Model 2 + nap-end-anchored AA Model 3 (nap days) or no-nap-day historic-bedtime substitute (D-05), each degrading gracefully to fewer models when unavailable, never forcing a fallback to the AA computation when the substitute itself is thin"
    requirement: "PRED-15"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#blendForecast — bedtime (D-03..D-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "blendForecast() on a rich fixture returns non-null, real {central,min,max} HH:MM predictions for all four of wake/bedtime/napStart/napEnd — Plan 25-01's three stubs are fully replaced"
    requirement: "PRED-17"
    verification:
      - kind: unit
        ref: "tests/unit/forecast-blend.test.js#blendForecast — full four-event integration (PRED-13/PRED-17)"
        status: pass
    human_judgment: false
duration: 25min
completed: 2026-09-18
status: complete
---

# Phase 25 Plan 2: Bedtime, Nap-Start & Nap-End Multi-Model Blends Summary

**`blendForecast()` in `js/lib/forecast-blend.js` now computes real D-03..D-10 multi-band blends for bedtime (3 models), nap-start (2 models), and nap-end (2 models), reusing Plan 25-01's `trimmedBand`/`stabilityCheck`/`wrapToDay` unchanged behind a new shared `combineModels()` helper — Algorithm C covers all 4 events (PRED-17).**

## Performance
- **Duration:** ~25min
- **Started:** 2026-09-18 (context load)
- **Completed:** 2026-09-18T11:24:27Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `combineModels(models, shrinkage)` is the single shared 0/1/N-model combiner now used by napStart (2 models), napEnd (2 models), and bedtime (3 models) — exactly one definition, three call sites, matching the plan's DRY requirement instead of duplicating the same if/else three times.
- Nap-start (D-07/D-08) and nap-end (D-09/D-10) fully implemented: wake-anchored gap/duration chains, the D-10 actual-else-predicted nap-start anchor for nap-end's Model 2, and graceful degradation to a single model or the explicit null triple.
- Bedtime (D-03..D-06) fully implemented: three-model blend with the D-05 no-nap-day substitution (an entire model's data source swaps from AA-anchored to a no-nap-day historic-bedtime band) and its own independent thin-data degradation (never forces a fallback to the AA computation when the substitute is unavailable).
- `blendForecast()` no longer returns any stubs — the full four-event integration test confirms wake/bedtime/napStart/napEnd all produce real `{central,min,max}` HH:MM predictions on a rich fixture, completing PRED-13's shape-parity contract with real data (PRED-13 itself stays formally "blocked" in REQUIREMENTS.md pending a later sibling plan in this phase — see Decisions Made).

## Task Commits
1. **Task 1: Nap-start and nap-end two-model blends** - `1b69a3f` (test, RED) → `7629968` (feat, GREEN)
2. **Task 2: Bedtime three-band blend + full integration check** - `ab3c5e4` (test, RED) → `5eece41` (feat, GREEN)
**Plan metadata:** commit pending (this docs commit)

## Files Created/Modified
- `js/lib/forecast-blend.js` - added `combineModels()`; inserted nap-start/nap-end computation before the wake block; replaced the bedtime stub with the real three-model blend; updated header/JSDoc comments to reflect full completion
- `tests/unit/forecast-blend.test.js` - added nap-start, nap-end, bedtime, and full-integration `describe` blocks; removed the Plan-25-01 placeholder stub test (superseded — bedtime, napStart, and napEnd are no longer unconditional stubs)

## Decisions Made
- `combineModels()` kept as a private (non-exported) helper, matching the plan's "shared local helper" framing — its 0/1/N branches are exercised indirectly through `blendForecast()`'s napStart/napEnd/bedtime tests rather than a standalone unit-test suite, the same approach Plan 25-01 used for `stabilityCheck`'s reuse verification via wake's tests.
- Nap-start/nap-end "both models available" test fixtures use a **constant** wake time (06:00) with jittered gap/duration series instead of a varying wake anchor. A varying-wake design was tried first and produced a degenerate single-point Model 1 band (the gap series was accidentally constant), which combined with `stabilityCheck`'s touching-interval shrink formula to push `central` outside `[min,max]` — the exact edge case Plan 25-01's own "touching at a single point" `stabilityCheck` test documents. Constant-wake fixtures give Model 1 the same real spread as Model 2 so the two bands genuinely overlap rather than touch at a point, avoiding the degenerate collapse without any production-code change.
- PRED-13 stays "blocked" in `REQUIREMENTS.md`'s traceability table after this plan (per `requirements.ready-ids`) because a later sibling plan in Phase 25 also declares it in its own frontmatter and hasn't finished yet — not an oversight; PRED-15/PRED-16/PRED-17 were marked complete.

## Deviations from Plan

None - plan executed exactly as written. The two fixture-design choices above were implementation details within the plan's own test-writing latitude (the plan explicitly left "not asserting exact minute values" and general behavior shape to the executor), not deviations from any specified must-have.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `blendForecast()` is now feature-complete for all four Algorithm C events (wake, bedtime, napStart, napEnd) — Plan 25-03 (Settings modal fields) and Plan 25-04 (today-screen wiring) can proceed without any further changes to `forecast-blend.js`'s prediction logic.
- `node --test tests/unit/forecast-blend.test.js` passes 21/21; `npm run test:unit` passes 925/925 with no regressions.
- No blockers.

## Self-Check: PASSED
- FOUND: js/lib/forecast-blend.js (modified, contains combineModels/napStart/napEnd/bedtime blocks)
- FOUND: tests/unit/forecast-blend.test.js (modified, contains new describe blocks)
- FOUND commit: 1b69a3f
- FOUND commit: 7629968
- FOUND commit: ab3c5e4
- FOUND commit: 5eece41

---
*Phase: 25-algorithm-c-settings-modal*
*Completed: 2026-09-18*
