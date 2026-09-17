---
phase: 22-accuracy-scoring
plan: 02
subsystem: prediction-accuracy
tags: [accuracy-scoring, tif-backtesting, bedtime-split, forecast]

requires:
  - phase: 22-accuracy-scoring
    provides: "22-01's D-03 bedtime nap-day/no-nap-day classification rule (actual.napStart != null) — mirrored verbatim into accuracy-tif.js per D-05"
  - phase: 19-split-bedtime-wake-anchored-nap
    provides: "isNapDay = actual.napStart != null classification (D-04), reused verbatim for the TIF bedtime nap-day split"
provides:
  - "computeTifAccuracy() extended: { wake, napStart, napEnd, bedtime, bedtimeNapDay, bedtimeNoNapDay } each with unchanged { windowHit, avgWidthMin, highConf } shape"
  - "ACCURACY_TIF_CONFIG.BASE_EVENT_TYPES / EVENT_TYPES split (4 vs 6 keys), mirroring accuracy.js's D-03 pattern"
affects: [22-03-accuracy-screen]

actuals:
  tokens: 3231
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "TIF interval-containment metric (windowHit/avgWidthMin/highConf) fans the SAME already-computed hit/width/highConf values into a nap-day/no-nap-day sub-bucket, mirroring accuracy.js's point-distance-score fan-out pattern without recomputing anything"
    - "BASE_EVENT_TYPES (4 keys tifForecast() actually returns) vs EVENT_TYPES (6 keys, superset for counter init/result-building only) split keeps the split confined to computeTifAccuracy's counting stage, never leaking into computeTifBoundsHistory's entry shape"

key-files:
  created: []
  modified:
    - js/lib/accuracy-tif.js
    - tests/unit/accuracy-tif.test.js

key-decisions:
  - "D-05: accuracy-tif.js's ACCURACY_TIF_CONFIG.EVENT_TYPES extended with bedtimeNapDay/bedtimeNoNapDay, classified by the scored day's own actual napStart != null — identical to accuracy.js's D-03 rule"
  - "computeTifBoundsHistory's entry-building loop iterates BASE_EVENT_TYPES (4 keys) only — its output entry shape is byte-identical to before this plan"
  - "computeTifAccuracy's counting loop iterates BASE_EVENT_TYPES for lookups, but initializes counters and builds the result object over the full 6-key EVENT_TYPES — the bedtime sub-buckets duplicate the combined bedtime bucket's already-computed hit/width/highConf values rather than recomputing them"

patterns-established:
  - "Pattern: computeTifAccuracy's per-day bedtime increment block, immediately after updating the combined `bedtime` counter, classifies isNapDay = actualDay.napStart != null once and duplicates the SAME isHit/width/isHighConf values into the matching sub-bucket counter — zero double-computation"

requirements-completed: []

coverage:
  - id: D1
    description: "ACCURACY_TIF_CONFIG.EVENT_TYPES has exactly 6 entries (base 4 + bedtimeNapDay/bedtimeNoNapDay); BASE_EVENT_TYPES has exactly the original 4"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy-tif.test.js#computeTifAccuracy — D-05 bedtime nap-day/no-nap-day split — config shape: result has all 6 event type keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeTifBoundsHistory's result entries still have exactly 4 own keys (wake/napStart/napEnd/bedtime) plus date — the split never leaks into bounds history"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy-tif.test.js#computeTifBoundsHistory — D-05 regression: bounds-history entry shape unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "bedtimeNapDay/bedtimeNoNapDay fan-out proven independent: nap-day hit and no-nap-day miss bucket separately with correct pct"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy-tif.test.js#computeTifAccuracy — D-05 bedtime nap-day/no-nap-day split — fan-out independence"
        status: pass
    human_judgment: false
  - id: D4
    description: "avgWidthMin computed independently per sub-bucket (not blended with each other or the combined bedtime average)"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy-tif.test.js#computeTifAccuracy — D-05 bedtime nap-day/no-nap-day split — avgWidthMin fan-out"
        status: pass
    human_judgment: false
  - id: D5
    description: "null combined bedtime bounds excludes the day from bedtime, bedtimeNapDay, AND bedtimeNoNapDay totals alike"
    requirement: "ACC-04"
    verification:
      - kind: unit
        ref: "tests/unit/accuracy-tif.test.js#computeTifAccuracy — null entry exclusion — null bedtime entry is excluded from bedtime, bedtimeNapDay, AND bedtimeNoNapDay alike"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every pre-existing test in tests/unit/accuracy-tif.test.js still passes unmodified — the D-05 extension is additive only"
    verification:
      - kind: unit
        ref: "node --test tests/unit/accuracy-tif.test.js (26/26 pass, including all pre-existing tests verbatim)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-17
status: complete
---

# Phase 22 Plan 02: TIF Accuracy Bedtime Nap-Day Split Summary

**TIF backtesting engine's `computeTifAccuracy()` gains `bedtimeNapDay`/`bedtimeNoNapDay` sub-buckets, fanned out from the existing combined `bedtime` interval-containment metric using the identical nap-day classification rule as `accuracy.js`'s D-03**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-17T09:15:00Z
- **Completed:** 2026-09-17T09:35:00Z
- **Tasks:** 1 (TDD, RED → GREEN)
- **Files modified:** 2

## Accomplishments
- Added `ACCURACY_TIF_CONFIG.BASE_EVENT_TYPES` (the 4 keys `tifForecast()` actually returns bounds for) alongside the now-6-key `EVENT_TYPES` (adds `bedtimeNapDay`/`bedtimeNoNapDay`)
- Changed `computeTifBoundsHistory`'s entry-building loop to iterate `BASE_EVENT_TYPES` only — its output entry shape is byte-identical to before this plan (verified by a new regression test asserting every non-null entry has exactly 4 own keys plus `date`)
- Extended `computeTifAccuracy`'s counting loop: after the existing combined `bedtime` counter's hit/width/highConf increments, classifies `isNapDay = actualDay.napStart != null` (D-05, identical to `accuracy.js`'s D-03 rule) and duplicates the SAME already-computed values into the matching `bedtimeNapDay`/`bedtimeNoNapDay` sub-bucket — no recomputation
- Preserved the `windowHit`/`avgWidthMin`/`highConf` interval-containment metric shape unchanged — TIF's structurally different metric (vs `accuracy.js`'s point-distance decay) is untouched by this plan
- Preserved the circular-import guard: `accuracy-tif.js` still imports only `./forecast-tif.js` and `./forecast.js`, never `./metrics.js`

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: accuracy-tif.js bedtime nap-day split (D-05)** — `1a8a666` (test, RED), `1c3b857` (feat, GREEN)

_No REFACTOR commit — the GREEN implementation needed no cleanup._

## Files Created/Modified
- `js/lib/accuracy-tif.js` - `ACCURACY_TIF_CONFIG.BASE_EVENT_TYPES`/`EVENT_TYPES` split; `computeTifBoundsHistory` iterates `BASE_EVENT_TYPES` only; `computeTifAccuracy` fans the combined `bedtime` counter's hit/width/highConf into `bedtimeNapDay`/`bedtimeNoNapDay` sub-buckets
- `tests/unit/accuracy-tif.test.js` - 6 new tests: config shape (result has all 6 keys), fan-out independence (nap-day hit / no-nap-day miss bucketed separately), avgWidthMin fan-out (independent per-bucket averages), null-bedtime exclusion (excluded from all 3 bedtime buckets alike), and a `computeTifBoundsHistory` regression pinning the unchanged 4-key entry shape

## Decisions Made
- Followed the plan's literal `<action>` spec exactly: `isNapDay = actualDay.napStart != null` (loose inequality, matching the plan text verbatim) computed once per bedtime-type iteration, immediately after the combined bucket's increments succeed
- No new helper function extracted for the fan-out — the plan's action explicitly said "duplicate the SAME already-computed hit/width/highConf values", so the 4-line duplication block is inlined at the point of computation rather than factored into a shared helper, keeping the diff minimal and the values' provenance (never recomputed) visually obvious

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `js/lib/accuracy-tif.js`'s extended `TifAccuracyResult` shape (`{wake, napStart, napEnd, bedtime, bedtimeNapDay, bedtimeNoNapDay}`, each `{windowHit, avgWidthMin, highConf}`) is proven and ready for Plan 22-03 (`accuracy-screen.js`'s rendering, D-09/D-10/D-11) to build against — both `accuracy.js` and `accuracy-tif.js` now expose the same 6-row-key set so the screen can render one consistent row set for both algorithms.
- **ACC-04 is NOT marked complete by this plan** — Plan 22-03 also declares `ACC-04` in its frontmatter and has not executed yet. Per the ready-ids gate (only mark complete when no sibling plan still needs it incomplete), `ACC-04` stays open until 22-03 finishes.

---
*Phase: 22-accuracy-scoring*
*Completed: 2026-09-17*

## Self-Check: PASSED

All modified files verified present on disk; both task commit hashes (1a8a666, 1c3b857) verified present in git log.
