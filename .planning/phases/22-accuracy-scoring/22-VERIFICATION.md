---
phase: 22-accuracy-scoring
verified: 2026-09-17T12:45:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 22: Accuracy Scoring Verification Report

**Phase Goal:** Prediction accuracy is scored per-event with a linear-decay formula instead of a single daily hit/miss, giving a more granular accuracy signal

**Verified:** 2026-09-17T12:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Executive Summary

Phase 22 delivers a complete rewrite of the accuracy-scoring system across three interdependent plans:
- **22-01:** Core linear-decay formula and AccuracyResult shape (accuracy.js)
- **22-02:** TIF backtesting engine bedtime split (accuracy-tif.js)
- **22-03:** UI rendering with overall headline score (accuracy-screen.js)

All 5 must-haves are VERIFIED in the codebase. All 4 code-review fixes (1 critical, 3 warnings) are confirmed implemented and in place. Full test suite passes: 880/880 unit tests, 134/134 e2e tests.

---

## Goal Achievement

### Observable Truths

| #   | Truth   | Status | Evidence |
| --- | ------- | ------ | -------- |
| 1 | `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` implements ACC-02's exact linear-decay formula (D≤W: 100−(50/W)×D; W<D≤2W: 50−(50/W)×(D−W); D>2W: 0), verified against NEW_ACC.md worked-example boundary values | ✓ VERIFIED | `js/lib/accuracy.js:74-83` implements the formula exactly; tests verify D=0→100, D=W→50, D=2W→0, D>2W→0 via `tests/unit/accuracy.test.js` ("eventAccuracyScore — ACC-02 linear-decay formula") |
| 2 | Daily score changes to arithmetic mean of per-event scores instead of old binary hit/miss counters; AccuracyResult no longer carries withinDelta, withinHalfDelta, insideBand fields | ✓ VERIFIED | `js/lib/accuracy.js:127-138` buildAccuracyResult() computes `avgScore = Math.round(scoreSum / total)` per type; old counter fields completely removed; `js/ui/accuracy-screen.js` renders only `avgScore` column (1 column, not 3) |
| 3 | accuracy-screen.js renders per-event scores and the new overall daily average; overall headline element reads computeAccuracy()'s overallScore verbatim with no independent recomputation | ✓ VERIFIED | `js/ui/accuracy-screen.js:393-428` creates headlineEl, renders `accuracy.overallScore` at line 424 via textContent; grid renders 6 rows × 1 column avgScore via buildAccuracyGrid; all cells use textContent/replaceChildren (no innerHTML) per CLAUDE.md |
| 4 | Backtesting engine calls in accuracy.js and accuracy-tif.js call eventAccuracyScore; accuracy-tif.js still does not import metrics.js (circular-import guard) | ✓ VERIFIED | `js/lib/accuracy.js:277` calls `eventAccuracyScore(forecastMinutes, actualMinutes, maxDelta)` inside the retroactive scoring loop; `js/lib/accuracy-tif.js` imports only from forecast-tif.js and forecast.js (line 40-41), never metrics.js; circular-import guard preserved |
| 5 | Unit tests cover formula boundary values: D=0, D=W, D=2W, D>2W as per NEW_ACC.md; ACC-03 "both forecast and actual" semantics tested | ✓ VERIFIED | `tests/unit/accuracy.test.js` has test suite "eventAccuracyScore — ACC-02 linear-decay formula" covering all 6 boundary cases (D=0→100, D=5→90, D=W→50, interior 40→20, D=2W→0, D>2W→0); separate test "ACC-03 literal: total only counts days with BOTH usable forecast AND actual" verifies the semantics |

**Score:** 5/5 truths verified (100%)

---

## Required Artifacts

### Artifact Verification (All Levels)

| Artifact | Exists | Substantive | Wired | Status | Details |
| -------- | ------ | ----------- | ----- | ------ | ------- |
| `js/lib/accuracy.js` | ✓ | ✓ | ✓ | ✓ VERIFIED | Exports `eventAccuracyScore()`, rewritten `computeAccuracy()` and `ACCURACY_CONFIG` with BASE_EVENT_TYPES/EVENT_TYPES split; imported by `accuracy-screen.js` and unit tests |
| `js/lib/accuracy-tif.js` | ✓ | ✓ | ✓ | ✓ VERIFIED | Extended with ACCURACY_TIF_CONFIG.BASE_EVENT_TYPES/EVENT_TYPES split; computeTifAccuracy() fans bedtime into nap-day/no-nap-day sub-buckets; no metrics.js import; called by accuracy-screen.js |
| `js/ui/accuracy-screen.js` | ✓ | ✓ | ✓ | ✓ VERIFIED | Rewritten 6-row/1-column grid rendering avgScore; new headlineEl element reads overallScore verbatim; TIF table extended to 6 rows; all dynamic content via textContent/replaceChildren |
| `tests/unit/accuracy.test.js` | ✓ | ✓ | ✓ | ✓ VERIFIED | Full rewrite: 23 tests covering formula boundaries, bedtime split, band approximation, overall headline, ACC-03 semantics; all passing |
| `tests/unit/accuracy-tif.test.js` | ✓ | ✓ | ✓ | ✓ VERIFIED | 26 tests covering TIF bedtime split (fan-out independence, avgWidthMin isolation, null exclusion), bounds-history regression; all passing |
| `tests/e2e/accuracy-screen.spec.js` | ✓ | ✓ | ✓ | ✓ VERIFIED | Deterministic e2e coverage with seeded 32-day baseline fixture; classic grid + TIF table rendering proved; both pre-existing and new tests passing |

**All Artifacts Status:** ✓ VERIFIED

---

## Code-Review Fixes Verification

The phase was reviewed post-execution and 4 issues were fixed via follow-up commits. Verification confirms all fixes are present and functional:

### CR-01: TIF Midnight-Crossing Prediction Window (CRITICAL)

**Issue:** A TIF bedtime window crossing midnight (e.g., algMin="23:30", algMax="00:15") produced an inverted minute range after round-tripping through timeToMinutes(), corrupting avgWidthMin (negative value) and guaranteeing a missed prediction.

**Fix Verification:**
- **Location:** `js/lib/accuracy-tif.js:223-240`
- **Evidence:** 
  - Line 238: `if (algMaxMin < algMinMin) algMaxMin += 24 * 60;` — un-wraps window when inverted
  - Lines 239-240: `actualForCompare` similarly un-wrapped for consistent comparison frame
  - Documentation: Lines 223-237 explain the KNOWN MIDNIGHT-CROSSING BEHAVIOR
- **Test Coverage:** `tests/unit/accuracy-tif.test.js` includes 3 new tests for midnight-crossing cases (before-midnight hit, after-midnight hit, clear miss)
- **Status:** ✓ FIXED — fix is in place and tested

### WR-01: Accuracy Screen Ignores rejectedDays Setting (WARNING)

**Issue:** accuracy-screen.js never passed the `settings` argument to daysBySubjectiveNight(), so day records were never annotated with the `.rejected` flag per the user's configuration. Unlike history-screen.js and metrics-screen.js, which both pass settings through.

**Fix Verification:**
- **Location:** `js/ui/accuracy-screen.js:465`
- **Evidence:** Line 465: `const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour, undefined, snap);`
- **Matches Contract:** Identical to history-screen.js:105 and metrics-screen.js:645, passing snap as the third argument
- **Behavioral Impact:** forecast() now correctly applies rejected-day downweighting; cold-start gate honors rejectedDays
- **Status:** ✓ FIXED — settings now properly threaded through

### WR-02: TIF Grid Shows "0%" Instead of "—" for Zero-Total Event Types (WARNING)

**Issue:** computeTifAccuracy() always returns fully-populated result objects with total=0 (not null) for unused event types. The TIF grid lacked the classic grid's `total === 0` check, rendering "0%"/"±0 min" instead of "—" for genuinely-unused events (e.g., no naps in history).

**Fix Verification:**
- **Location:** `js/ui/accuracy-screen.js:309` (buildTifAccuracyGrid)
- **Evidence:** `const showDash = eventStats === null || eventStats.total === 0;` now explicitly checks for zero-total events and dashes them
- **Mirror Pattern:** Identical to buildAccuracyGrid's handling at lines 196-201
- **Test Coverage:** New e2e test asserts bedtimeNoNapDay row dashes on baseline fixture (which has zero no-nap days)
- **Status:** ✓ FIXED — TIF grid now dashes zero-total rows like the classic grid

### WR-03: Dead/Incomplete Null Guard for algMin/algMax (WARNING)

**Issue:** timeToMinutes() never returns null (it throws on non-string input, returns NaN on malformed HH:MM). The old `=== null` check was dead code and did not catch NaN values that could silently corrupt aggregates.

**Fix Verification:**
- **Location:** `js/lib/accuracy-tif.js:218-221`
- **Evidence:**
  - Line 218: Type guard: `if (typeof bounds.algMin !== 'string' || typeof bounds.algMax !== 'string') continue;`
  - Line 221: NaN guard: `if (Number.isNaN(algMinMin) || Number.isNaN(algMaxMin)) continue;`
- **Documentation:** Comments at lines 214-217 explain why the previous `=== null` check was insufficient
- **Status:** ✓ FIXED — proper defensive guards now in place

**All Code-Review Fixes:** ✓ VERIFIED

---

## Test Coverage

### Unit Tests (node:test)
- **Total:** 880 tests pass (100%)
- **Phase 22 specific:**
  - `accuracy.test.js`: 23 tests (formula boundaries, ACC-03 semantics, bedtime split, band fallback, overall score)
  - `accuracy-tif.test.js`: 26 tests (D-05 bedtime split, null handling, bounds-history regression)
  - Code review fixes: additional failing tests added before each fix, then passing after fix implementation

### E2E Tests (Playwright)
- **Total:** 134 tests pass (100%)
- **Phase 22 specific:**
  - `accuracy-screen.spec.js`: New tests for classic grid (headline, bedtime split, single-column proof) and TIF table (bedtime split rows)
  - Pre-existing tests: Cold-start behavior unchanged and passing

**Test Status:** ✓ ALL PASSING (880 unit + 134 e2e)

---

## Requirement Traceability

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| ACC-01 | 22-01 | Old within-delta/within-half-delta/inside-band counters fully removed, replaced by avgScore | ✓ SATISFIED | `js/lib/accuracy.js` AccuracyResult shape has only `{total, avgScore, approximatedCount}` per type, no old fields |
| ACC-02 | 22-01 | eventAccuracyScore() implements exact linear-decay formula verified against NEW_ACC.md | ✓ SATISFIED | Formula at lines 74-83; boundary tests at lines 890, 895, 915, 930, 940, 945 verify D=0→100, D=W→50, D=2W→0 |
| ACC-03 | 22-01 | Per-type total only increments when day has BOTH usable forecast AND recorded actual | ✓ SATISFIED | Loop at accuracy.js:237-294 increments total only after both prediction and actual confirmed usable; test at accuracy.test.js verifies |
| ACC-04 | 22-02, 22-03 | TIF engine and UI both extend with bedtimeNapDay/bedtimeNoNapDay split | ✓ SATISFIED | accuracy-tif.js EVENT_TYPES has 6 keys; accuracy-screen.js ACCURACY_ROWS has 6 entries; both fan bedtime correctly |

**Requirements Status:** ✓ ALL SATISFIED (ACC-01/02/03/04 complete)

---

## Anti-Patterns Scan

Scan of modified files (accuracy.js, accuracy-tif.js, accuracy-screen.js, style.css, tests) for debt markers and stubs:

| File | Pattern | Line | Severity | Status |
| ---- | ------- | ---- | -------- | ------ |
| accuracy.js | KNOWN LIMITATION (documented midnight-wrap limitation) | 31-35, 92-95 | ℹ️ INFO | Acceptable — pre-existing limitation carried forward, explicitly documented per spec |
| accuracy-tif.js | KNOWN MIDNIGHT-CROSSING BEHAVIOR (documented, actively corrected by CR-01 fix) | 223-237 | ℹ️ INFO | Acceptable — code-review fix applied, issue no longer a silent bug |
| No files | TBD, FIXME, XXX (unreferenced debt markers) | — | — | ✓ None found |
| No files | Placeholder implementations, empty returns, hardcoded mocks | — | — | ✓ None found |
| No files | innerHTML with dynamic content (XSS guard violation) | — | — | ✓ None found |

**Anti-Patterns Status:** ✓ CLEAN (only pre-existing, documented limitations)

---

## Behavioral Spot-Checks

All dynamic behavior exercised by test suite and confirmed via execution:

| Behavior | Test | Result | Status |
| -------- | ---- | ------ | ------ |
| Linear-decay formula computes correct score at boundary values | `tests/unit/accuracy.test.js` boundary suite (6 cases) | All pass | ✓ PASS |
| Bedtime nap-day/no-nap-day classification splits correctly | `tests/unit/accuracy.test.js` bedtime split test | Passes | ✓ PASS |
| Band-mode midpoint approximation counted and flagged | `tests/unit/accuracy.test.js` band approximation test | Passes | ✓ PASS |
| Overall headline score computed as mean of daily means | `tests/unit/accuracy.test.js` overall score test | Passes | ✓ PASS |
| Cold-start gate skips days when history < minDays | `tests/unit/accuracy.test.js` cold-start test | Passes | ✓ PASS |
| Accuracy screen renders headline + grid deterministically | `tests/e2e/accuracy-screen.spec.js` classic grid test | Passes | ✓ PASS |
| TIF table renders bedtime split rows | `tests/e2e/accuracy-screen.spec.js` TIF table test | Passes | ✓ PASS |
| CR-01 midnight-crossing window un-wraps correctly | `tests/unit/accuracy-tif.test.js` CR-01 midnight tests (3 cases) | All pass | ✓ PASS |

**Spot-Checks Status:** ✓ ALL PASSING

---

## Summary

**Phase Goal Achievement:** ✓ VERIFIED

The phase goal — "Prediction accuracy is scored per-event with a linear-decay formula instead of a single daily hit/miss, giving a more granular accuracy signal" — is fully achieved:

1. ✓ Linear-decay formula (ACC-02) correctly implemented and boundary-verified
2. ✓ Per-event scoring (ACC-03) replaces binary hit/miss with arithmetic mean
3. ✓ Overall headline score (D-10) computed as mean-of-daily-means, never NaN
4. ✓ Bedtime nap-day split (D-03/D-04) applied consistently across accuracy.js and accuracy-tif.js
5. ✓ UI rendering (accuracy-screen.js) stays dumb — reads scores verbatim from backend
6. ✓ XSS guard (CLAUDE.md) maintained — all dynamic content via textContent/replaceChildren
7. ✓ Circular-import guard (accuracy-tif.js does not import metrics.js) preserved
8. ✓ All code-review issues (1 critical, 3 warnings) fixed and verified
9. ✓ Full test suite passes (880/880 unit + 134/134 e2e)

**Recommendation:** ✓ **APPROVED FOR SHIP** — All must-haves verified, all fixes confirmed in place, full test coverage passing. Phase goal achieved.

---

_Verified: 2026-09-17T12:45:00Z_
_Verifier: Claude Verifier (gsd-verifier)_
