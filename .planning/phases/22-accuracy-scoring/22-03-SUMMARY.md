---
phase: 22-accuracy-scoring
plan: 03
subsystem: prediction-accuracy
tags: [accuracy-scoring, ui, e2e, avg-score, tif-accuracy]

requires:
  - phase: 22-accuracy-scoring
    provides: "22-01's rewritten AccuracyResult shape ({wake, bedtime, bedtimeNapDay, bedtimeNoNapDay, napStart, napEnd, overallScore}, each {total, avgScore, approximatedCount})"
  - phase: 22-accuracy-scoring
    provides: "22-02's extended TifAccuracyResult shape (adds bedtimeNapDay/bedtimeNoNapDay to computeTifAccuracy's 6-key result)"
provides:
  - "js/ui/accuracy-screen.js rewritten: 6-row/1-col avgScore grid, overall headline element (reads overallScore verbatim), approximated-score marker + single footnote, matching TIF table bedtime split rows"
  - "tests/e2e/accuracy-screen.spec.js: deterministic e2e coverage for the classic avgScore grid and the TIF bedtime-split table, proven against the shared 32-day baseline fixture"
affects: []

actuals:
  tokens: 6225
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Accuracy screen stays 'dumb' — renders computeAccuracy()/computeTifAccuracy() output verbatim, no independent scoring/averaging logic in the UI layer"
    - "Approximated-score marker (accApprox) + single cross-row summary footnote (accFootnote), never a per-row duplicated footnote"

key-files:
  created: []
  modified:
    - js/ui/accuracy-screen.js
    - style.css
    - tests/e2e/accuracy-screen.spec.js

key-decisions:
  - "D-09/D-11: ACCURACY_ROWS extended to 6 entries (wake/napStart/napEnd/bedtime/bedtimeNapDay/bedtimeNoNapDay); ACCURACY_COLS collapsed to a single avgScore column rendered as a plain number (no % suffix, no color thresholds)"
  - "D-10: new headlineEl fixed DOM element inserted between stageBadge and gridRoot; renderAccuracy sets its textContent to 'Overall accuracy: ' + accuracy.overallScore verbatim — no recomputation in accuracy-screen.js"
  - "D-07: rows with approximatedCount > 0 get an .accApprox marker span next to the score; a single .accFootnote line (total approximated count summed across all 6 rows) is appended once below the grid, never duplicated per row"
  - "D-05: TIF_ACCURACY_ROWS extended to 6 entries; buildTifAccuracyGrid required zero code changes beyond the ROWS array — its existing stats[row.key] generic lookup loop already renders the new rows"
  - "style.css: .accuracyGrid grid-template-columns changed from 'auto 1fr 1fr 1fr' (old 3-metric layout) to 'auto 1fr' (new 1-score-column layout) — a Rule 1 correctness fix, otherwise the grid would render with 2 empty phantom columns per row"

patterns-established:
  - "Pattern: buildAccuracyGrid sums approximatedCount across all rows unconditionally (even dash-suppressed rows) into a single footnote-triggering total, decoupling the summary-footnote decision from any individual row's display state"

requirements-completed: [ACC-04]

coverage:
  - id: D1
    description: "Classic accuracy grid renders exactly one avgScore column across 6 rows (wake/napStart/napEnd/bedtime/bedtimeNapDay/bedtimeNoNapDay), with no % suffix or color-coded thresholds"
    requirement: "ACC-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#classic grid renders avgScore column, bedtime nap-day split, and overall headline"
        status: pass
    human_judgment: false
  - id: D2
    description: "Overall headline score renders above the grid, reading computeAccuracy()'s overallScore verbatim (no independent recomputation in the UI layer)"
    requirement: "ACC-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#classic grid renders avgScore column, bedtime nap-day split, and overall headline"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bedtime nap-day/no-nap-day split rows render on the classic grid; bedtimeNoNapDay shows the existing cold-data dash when total is 0"
    requirement: "ACC-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#classic grid renders avgScore column, bedtime nap-day split, and overall headline"
        status: pass
    human_judgment: false
  - id: D4
    description: "TIF accuracy table renders the D-05 bedtime nap-day/no-nap-day split rows alongside the original 4 event-type rows"
    requirement: "ACC-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#TIF accuracy table renders bedtime nap-day/no-nap-day split rows"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pre-existing cold-start behavior (no .accuracyGrid, .coldStartNote visible) is unchanged by the rewrite"
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#pre-existing cold-start test still passes unmodified alongside the new grid"
        status: pass
    human_judgment: false
  - id: D6
    description: "No innerHTML introduced anywhere in accuracy-screen.js — all dynamic content set via textContent/createElement/appendChild (CLAUDE.md XSS guard)"
    verification:
      - kind: other
        ref: "manual code review of js/ui/accuracy-screen.js — every dynamic assignment uses .textContent; no .innerHTML anywhere in the file"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-17
status: complete
---

# Phase 22 Plan 03: Accuracy Screen AvgScore Rewrite Summary

**Accuracy screen rewritten to render the Phase 22 avgScore/overallScore shapes: a single-column 6-row grid (bedtime nap-day split included), an overall headline score above the grid, a band-approximated-score marker with a summary footnote, and matching TIF table rows — proven end-to-end against a deterministic 32-day fixture**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-17T09:45:00Z
- **Completed:** 2026-09-17T10:10:00Z
- **Tasks:** 2 (both TDD, RED → GREEN)
- **Files modified:** 3

## Accomplishments
- Replaced the old 4-row/3-metric-column grid (`withinDelta`/`withinHalfDelta`/`insideBand`) with a 6-row/1-column `avgScore` grid (wake, napStart, napEnd, bedtime combined, bedtimeNapDay, bedtimeNoNapDay), rendering plain integer scores with no `%` suffix and no color-coded thresholds (D-08/D-09/D-11)
- Added a fixed `headlineEl` element above the grid that reads `computeAccuracy()`'s `overallScore` verbatim — the UI performs zero independent averaging (D-10)
- Added a band-approximation visual marker (`.accApprox`, muted superscript asterisk) on any row with `approximatedCount > 0`, plus a single cross-row summary footnote (never duplicated per row) reporting the total approximated-score count (D-07)
- Extended `TIF_ACCURACY_ROWS` to include `bedtimeNapDay`/`bedtimeNoNapDay`, rendering through `buildTifAccuracyGrid`'s existing generic `stats[row.key]` lookup loop with zero additional branching required (D-05)
- Updated `.accuracyGrid`'s CSS `grid-template-columns` from the old 4-column layout (`auto 1fr 1fr 1fr`) to the new 2-column layout (`auto 1fr`) — otherwise the grid would render two empty phantom columns per row (Rule 1 correctness fix)
- Added deterministic e2e coverage for both the classic avgScore grid and the TIF bedtime-split table, reusing the shared 32-day baseline fixture pattern from `tests/e2e/forecast.spec.js`/`tests/e2e/tif.spec.js`

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: Classic accuracy grid rewrite (avgScore column, bedtime split, headline, approx marker)** — `43bad5f` (test, RED), `03d3202` (feat, GREEN)
2. **Task 2: TIF accuracy table bedtime nap-day split rows** — `5d62e9a` (test, RED), `36ee528` (feat, GREEN)

## Files Created/Modified
- `js/ui/accuracy-screen.js` - `ACCURACY_ROWS` (6 entries)/`ACCURACY_COLS` (1 entry) rewrite; `buildAccuracyGrid` rewritten for avgScore rendering + approximated marker + summary footnote; `mountAccuracyScreen`/`renderAccuracy` gain `headlineEl`; `TIF_ACCURACY_ROWS` extended to 6 entries; module-level JSDoc updated throughout
- `style.css` - `.accuracyGrid` grid-template-columns updated to 2 columns; new `.accApprox`, `.accFootnote`, `.overallScoreHeadline` rules
- `tests/e2e/accuracy-screen.spec.js` - added local `makeDb`/`makeEvents`/`makeBaselineDb`/`seedAndReload` helpers (mirroring `tests/e2e/forecast.spec.js`); new classic-grid test (headline, wake/bedtimeNapDay scores, bedtimeNoNapDay dash, single-column proof) and new TIF-path test (bedtime split row labels); pre-existing cold-start tests kept unmodified

## Decisions Made
- Approximated-score marker rendered as a small muted superscript asterisk (`.accApprox`), matching the existing table's understated visual style — exact treatment was left to Claude's discretion per D-07
- Footnote text uses the plan's literal example wording ("* N score(s) approximated from a wide probability-band midpoint"), summing `approximatedCount` across all 6 rows unconditionally (including dash-suppressed rows) so the footnote total is never silently short
- To keep commits cleanly separated by task, the TIF row extension was authored alongside Task 1's implementation pass but temporarily reverted and re-applied as Task 2's own RED/GREEN commit pair — the git history at each commit accurately reflects each task's isolated scope (verified: Task 1's test commit fails against the pre-rewrite 4x3 grid at that revision; Task 2's test commit fails against the pre-split 4-row TIF table at that revision)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `.accuracyGrid`'s CSS grid-template-columns for the new 1-column layout**
- **Found during:** Task 1 (implementation)
- **Issue:** The plan's `<action>` text specified the JS-side row/column rewrite but did not call out that `.accuracyGrid`'s CSS `grid-template-columns: auto 1fr 1fr 1fr` (sized for the old 4-column layout) would leave 2 empty phantom grid columns per row once the JS only emits 1 data column per row — a visible layout regression.
- **Fix:** Updated `grid-template-columns` to `auto 1fr` (label + 1 score column) and added supporting styles for the new `.accApprox`, `.accFootnote`, and `.overallScoreHeadline` elements.
- **Files modified:** style.css
- **Verification:** Manual visual reasoning against the grid's `display: grid` layout math; e2e assertions confirm `.accCell` count === 6 (one per row) and `.accHeader:not(.accHeaderEmpty)` count === 1
- **Committed in:** 03d3202 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 CSS layout correctness fix)
**Impact on plan:** Necessary consequence of the JS-side column reduction — no scope creep, no architectural change.

## Issues Encountered
None beyond the one auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 22 (Accuracy Scoring) is now fully complete: `js/lib/accuracy.js` (22-01), `js/lib/accuracy-tif.js` (22-02), and `js/ui/accuracy-screen.js` (22-03) all consistently expose and render the linear-decay avgScore/overallScore shape with the D-03/D-04/D-05 bedtime nap-day split.
- ACC-04 is now marked complete — this was the last plan in the phase declaring it, and both sibling plans (22-01, 22-02) had already completed.
- Full regression pass: `npm run test:unit` (876/876 pass) and `npm run test:e2e` (133/133 pass, including the previously-flagged `tests/e2e/metrics.spec.js` timeouts — those did not reproduce in this run) confirm no regressions from this rewrite.

---
*Phase: 22-accuracy-scoring*
*Completed: 2026-09-17*

## Self-Check: PASSED

All modified files verified present on disk; all 4 task commit hashes (43bad5f, 03d3202, 5d62e9a, 36ee528) verified present in git log.
