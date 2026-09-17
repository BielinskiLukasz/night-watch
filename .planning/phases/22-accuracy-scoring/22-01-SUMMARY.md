---
phase: 22-accuracy-scoring
plan: 01
subsystem: prediction-accuracy
tags: [accuracy-scoring, linear-decay, backtesting, forecast]

requires:
  - phase: 19-split-bedtime-wake-anchored-nap
    provides: "isNapDay = actual.napStart != null classification (D-04), reused verbatim for the bedtime nap-day split"
  - phase: 21-prediction-normalization
    provides: "forecast()'s central/probabilityBand prediction shape (D3-04), consumed by eventAccuracyScore's band-midpoint approximation"
provides:
  - "eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes) — pure ACC-02 linear-decay formula export from js/lib/accuracy.js"
  - "computeAccuracy() rewritten: { wake, bedtime, bedtimeNapDay, bedtimeNoNapDay, napStart, napEnd: {total, avgScore, approximatedCount}, overallScore }"
  - "ACCURACY_CONFIG.BASE_EVENT_TYPES / EVENT_TYPES split (4 vs 6 keys)"
affects: [22-02-tif-accuracy, 22-03-accuracy-screen]

actuals:
  tokens: 7885
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Linear-decay per-event scoring (D<=W/W<D<=2W/D>2W) replaces binary within-delta/within-half-delta/inside-band hit-miss counters"
    - "Per-day mean-of-per-event-scores aggregated into an overall mean-of-daily-means headline score"

key-files:
  created: []
  modified:
    - js/lib/accuracy.js
    - tests/unit/accuracy.test.js

key-decisions:
  - "D-01/D-02: toleranceMinutes reuses settings.maxDelta unchanged, no new setting"
  - "D-03/D-04: bedtime split into bedtimeNapDay/bedtimeNoNapDay classified by the scored day's own actual napStart, combined bedtime key kept as average across both"
  - "D-06/D-07: band-mode days score via the band midpoint and increment approximatedCount, never silently dropped"
  - "D-08: withinDelta/withinHalfDelta/insideBand fully removed, no back-compat shim"
  - "D-10: overallScore is the mean of each day's own per-day mean score across BASE_EVENT_TYPES only, excluding zero-event days, 0 (never NaN) on empty history"
  - "ACC-03 literal semantics: a type's total only increments when a day has BOTH a usable forecast (central or band) AND a recorded actual — a deliberate behavior change from the pre-existing implementation"

patterns-established:
  - "Pattern: computeAccuracy's per-day loop computes one dayScores[] array (BASE_EVENT_TYPES only) for the daily mean, then fans bedtime's score/approximated flag into its nap-day/no-nap-day sub-bucket without double-counting the daily mean"

requirements-completed: [ACC-01, ACC-02, ACC-03]

coverage:
  - id: D1
    description: "eventAccuracyScore implements the exact ACC-02 linear-decay formula, verified against NEW_ACC.md's worked-example boundary values (D=0, D=W, interior, D=2W, D>2W)"
    requirement: "ACC-02"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#eventAccuracyScore — ACC-02 linear-decay formula (NEW_ACC.md worked example)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeAccuracy()'s per-type total only increments when a day has BOTH a usable forecast AND a recorded actual (ACC-03 literal wording)"
    requirement: "ACC-03"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#ACC-03 literal: total only counts days with BOTH usable forecast AND actual"
        status: pass
    human_judgment: false
  - id: D3
    description: "Old withinDelta/withinHalfDelta/insideBand counters fully removed from AccuracyResult, replaced by avgScore per type"
    requirement: "ACC-01"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#output shape — per-type result objects have exactly three own keys: total, avgScore, approximatedCount"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bedtime accuracy split into bedtimeNapDay/bedtimeNoNapDay sub-buckets, classified by the day's actual napStart (D-03/D-04), combined bedtime bucket kept as the average"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#bedtime nap-day/no-nap-day split (D-03/D-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Band-mode days score via the probabilityBand midpoint and increment approximatedCount so the approximation flag is never silently lost (D-06/D-07)"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#band-mode approximation (D-06/D-07)"
        status: pass
    human_judgment: false
  - id: D6
    description: "overallScore is the mean of each day's own per-day mean score, excluding zero-event days, 0 (never NaN) on empty history (D-10)"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy.test.js#overall headline score (D-10)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-17
status: complete
---

# Phase 22 Plan 01: Accuracy Formula Rewrite Summary

**Linear-decay per-event accuracy scoring (ACC-02) with bedtime nap-day split and probability-band midpoint approximation, fully replacing the old binary within-delta/within-half-delta/inside-band counters**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-17T08:50:00Z
- **Completed:** 2026-09-17T09:11:34Z
- **Tasks:** 2 (both TDD, Task 1 tracer + Task 2 expansion)
- **Files modified:** 2

## Accomplishments
- Added `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` implementing ACC-02's exact linear-decay formula, verified against `NEW_ACC.md`'s literal worked-example boundary values (D=0→100, D=5→90, D=W=25→50, interior D=40→20, D=2W=50→0, D>2W→0)
- Rewrote `computeAccuracy()`/`buildAccuracyResult()` so every event type's accuracy is `avgScore` (arithmetic mean of per-event `eventAccuracyScore` values), fully removing `withinDelta`/`withinHalfDelta`/`insideBand` with no back-compat shim (D-08)
- Enforced ACC-03's literal "both forecast and actual" total semantics — a deliberate behavior change from the prior implementation, which incremented `total` even without a usable prediction
- Added the D-03/D-04 bedtime nap-day/no-nap-day split: every scored bedtime event fans into `bedtimeNapDay` or `bedtimeNoNapDay` by the day's own actual `napStart`, with the combined `bedtime` key kept as the average across both
- Added D-06/D-07 band-mode fallback: when `forecast()` returns a `probabilityBand`, `eventAccuracyScore` runs against the band's midpoint and the event's `approximatedCount` increments so the approximation is never silently dropped
- Added the D-10 overall headline score: mean of each day's own per-day mean score across the 4 base event types, excluding days with zero scored events, always 0 (never NaN) on empty history

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: eventAccuracyScore() + computeAccuracy() base rewrite** — `e458451` (test, RED), `dbf3b12` (feat, GREEN)
2. **Task 2: bedtime nap-day split, band fallback, overall score** — `fc9d154` (test, RED), `dbfc8f9` (feat, GREEN)

## Files Created/Modified
- `js/lib/accuracy.js` - `eventAccuracyScore()` export; rewritten `ACCURACY_CONFIG` (BASE_EVENT_TYPES/EVENT_TYPES split); rewritten `computeAccuracy()`/`buildAccuracyResult()` producing the full `{wake, bedtime, bedtimeNapDay, bedtimeNoNapDay, napStart, napEnd, overallScore}` shape
- `tests/unit/accuracy.test.js` - Full rewrite: formula boundary tests, base-4-type avgScore tests, bedtime split tests, band-midpoint approximation tests, overall headline score tests (23 tests total, all passing)

## Decisions Made
- Reused `settings.maxDelta` directly as `toleranceMinutes` — no new setting (D-01)
- `eventAccuracyScore` returns a raw unrounded number, not an object wrapper — matches the plan's literal `<action>` spec (the PATTERNS.md draft's `{score}` wrapper was superseded by the plan text, which takes precedence)
- No divide-by-zero guard in `eventAccuracyScore` — every in-repo call site supplies `settings.maxDelta`, enforced to a minimum of 5 by `settings-validate.js`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nap-day-filtering test fixture to carry usable history nap data**
- **Found during:** Task 1 (RED→GREEN verification)
- **Issue:** The plan's Task 1 behavior item 6 said to reuse the existing nap-day-filtering fixture "unchanged in intent" and assert `napStart.total === 1`. That fixture's history days (index 0, 1) had no `napStart` at all, so under the new ACC-03 literal semantics (a usable central/band prediction is required before `total` increments), `forecast()` produced `napStart: {central: null, ...}` for the scored day, and `total` stayed 0 — not 1. This is a direct, provable interaction between two of the plan's own requirements (test item 6's literal assertion vs. test item 8's new total semantics), not a judgment call.
- **Fix:** Added matching `napStart`/`napEnd` events to the two history days so `forecast()` produces a real central prediction, while keeping the no-nap day (index 3) unmodified so the nap-day-exclusion behavior the test was actually designed to prove is still exercised and still passes.
- **Files modified:** tests/unit/accuracy.test.js
- **Verification:** `node --test tests/unit/accuracy.test.js` — all 18 Task 1 tests pass
- **Committed in:** dbf3b12 (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Updated Task 1's "exactly two keys" shape test to three keys after Task 2 landed**
- **Found during:** Task 2 (RED→GREEN verification)
- **Issue:** Task 1's output-shape test asserted `result[type]` has exactly two own keys (`total`, `avgScore`) — correct for the Task-1-interim shape, but Task 2 adds `approximatedCount` as a third key per D-06/D-07 (the plan's own Task 1 behavior item 5 explicitly notes "Task 2 will add a third key"). Left unchanged, this test would fail after Task 2's GREEN commit.
- **Fix:** Updated the assertion to the final three-key shape (`total`, `avgScore`, `approximatedCount`), matching the plan's anticipated evolution.
- **Files modified:** tests/unit/accuracy.test.js
- **Verification:** `node --test tests/unit/accuracy.test.js` — all 23 tests pass; `npm run test:unit` — all 871 tests pass, no regressions
- **Committed in:** dbfc8f9 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 test-fixture/assertion corrections, both anticipated or directly implied by the plan's own text)
**Impact on plan:** Both fixes were necessary consequences of the plan's own literal specification interacting across its two tasks — no scope creep, no architectural change.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `js/lib/accuracy.js`'s final `AccuracyResult` shape (`{wake, bedtime, bedtimeNapDay, bedtimeNoNapDay, napStart, napEnd, overallScore}`, each `{total, avgScore, approximatedCount}`) is proven and ready for Plan 22-02 (`accuracy-tif.js`'s parallel bedtime split, D-05) and Plan 22-03 (`accuracy-screen.js`'s rendering, D-09/D-10/D-11) to build against.
- `eventAccuracyScore()` is exported and ready for direct reuse if `accuracy-tif.js` ever needs point-distance scoring (it currently does not — TIF's `windowHit`/`highConf` metric is structurally different, per D-05's note).
- ACC-04 is NOT marked complete by this plan — Plans 22-02 and 22-03 both also declare `ACC-04` in their frontmatter and neither has executed yet; ACC-04 will be marked complete once no sibling plan still needs it incomplete.

---
*Phase: 22-accuracy-scoring*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files verified present on disk; all 4 task commit hashes (e458451, dbf3b12, fc9d154, dbfc8f9) verified present in git log.
