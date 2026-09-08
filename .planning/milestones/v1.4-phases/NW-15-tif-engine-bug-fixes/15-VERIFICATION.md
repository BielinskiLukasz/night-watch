---
phase: NW-15-tif-engine-bug-fixes
verified: 2026-08-31T14:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase NW-15: TIF Engine Bug Fixes — Verification Report

**Phase Goal:** The TIF forecast engine and test suite are free of correctness bugs introduced after v1.3, so predictions are computed on the correct data set and the codebase is self-consistent.
**Verified:** 2026-08-31T14:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `findBedtimeDayRecord` selects the chronologically latest day record when slot entries mix bare HH:MM strings with ISO strings (FIX-01) | VERIFIED | Line 257 of `js/lib/forecast-tif.js`: `if (latestAt === null) result = day;` guards the bare-string path. Describe block 'findBedtimeDayRecord: bare-string vs ISO ordering' in `tests/unit/forecast-tif.test.js` passes — test confirms ISO-dated day is not displaced by a later bare-string entry. |
| 2 | Rejected days excluded by the TIF pre-filter do not reduce the auto-trim budget; `manualExcludedCount` semantics are preserved (FIX-02) | VERIFIED | Line 499: `const rejectedInWindow = window.length - acceptedWindow.length;`. All 13 primary `buildHistoricBand`/`buildDurationBand` calls pass `rejectedInWindow`. Describe block 'trim-budget independence: rejected days do not expand auto-trim' passes — asserts `B.max >= A.max`. |
| 3 | `metrics-screen.js` render() obtains TIF event-time strings from data already computed in the same render cycle without a second `tifForecast` call (FIX-03) | VERIFIED | `grep -c 'tifForecast' js/ui/metrics-screen.js` returns 0 — import and all call sites removed. `trimmedMinMax` retained and used at lines 315 and 325. |
| 4 | The `computeTifTrimmedStats` comment accurately describes that metric rows may contain bare HH:MM strings, so the `raw.length > 5` guard is not mistakenly dismissed as dead code (FIX-04) | VERIFIED | Lines 303-305 of `metrics-screen.js`: "Metric rows may contain bare 'HH:MM' strings or full ISO strings ('YYYY-MM-DDTHH:MM'). raw.length > 5 extracts the HH:MM slice from ISO strings and passes bare strings through unchanged — this guard handles both forms and is live code, not dead code." Guard expression `raw.length > 5 ? raw.slice(11) : raw` unchanged at line 310. |
| 5 | The `settings-validate.test.js` test for the `tifRollingDays` upper-bound reads "rejects 91 (above max=90)" and the full test suite passes (FIX-05) | VERIFIED | Line 724: `it('rejects 91 (above max=90) in mode:\'save\'', ...)`. Test body uses `tifRollingDays: 91`. All 92 tests in `settings-validate.test.js` pass; full suite 756/756 green. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/lib/forecast-tif.js` | FIX-01 bare-string guard applied | VERIFIED | `if (latestAt === null) result = day;` at line 257 |
| `js/lib/forecast-tif.js` | FIX-02 `rejectedInWindow` passed as `manualExcludedCount` | VERIFIED | Declared at line 499; threaded to 13 band-building call sites |
| `tests/unit/forecast-tif.test.js` | FIX-01 and FIX-02 unit tests added | VERIFIED | Two new describe blocks at lines 218 and 280; 17 tests pass |
| `js/ui/metrics-screen.js` | Second `tifForecast` call block removed | VERIFIED | 0 occurrences of `tifForecast` in the file |
| `js/ui/metrics-screen.js` | `computeTifTrimmedStats` comment updated | VERIFIED | Comment at lines 303-305 explains both bare and ISO string handling |
| `tests/unit/settings-validate.test.js` | Stale '31' description corrected to '91' | VERIFIED | Line 724 reads 'rejects 91 (above max=90)' |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `findBedtimeDayRecord` result | `bedtimeDayRecord` → `resolveTodayNapDuration` in `tifForecast` | Return value consumed by `tifForecast` | VERIFIED | Function returns correct ISO-dated record; `tifForecast` uses the result for nap duration resolution |
| `rejectedInWindow` (line 499) | `trimmedMinMax` `manualExcludedCount` parameter | Passed as 3rd arg to `buildHistoricBand`/`buildDurationBand` | VERIFIED | 13 primary call sites confirmed to use `rejectedInWindow`; `postNoNapNapStartTimes` call correctly retains `0` |
| `trimmedMinMax` import | `computeTifTrimmedStats` calls | Import at line 24 of `metrics-screen.js` | VERIFIED | Used at lines 315 and 325 inside `computeTifTrimmedStats` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase fixes pure function logic and removes redundant computation. No new data sources or render paths introduced.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| FIX-01 unit test passes | `node --test tests/unit/forecast-tif.test.js` | 17 pass, 0 fail | PASS |
| FIX-02 unit test passes | `node --test tests/unit/forecast-tif.test.js` | 17 pass, 0 fail | PASS |
| FIX-05 description and test pass | `node --test tests/unit/settings-validate.test.js` | 92 pass, 0 fail | PASS |
| Full unit suite regression-free | `npm run test:unit` | 756 pass, 0 fail | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | 15-01-PLAN.md | `findBedtimeDayRecord` bare-string/ISO ordering | SATISFIED | Guard at line 257; unit test passing |
| FIX-02 | 15-01-PLAN.md | `rejectedInWindow` / `manualExcludedCount` semantics | SATISFIED | Variable at line 499; 13 call-site updates; unit test passing |
| FIX-03 | 15-02-PLAN.md | Remove redundant `tifForecast` call from `render()` | SATISFIED | 0 occurrences of `tifForecast` in `metrics-screen.js` |
| FIX-04 | 15-02-PLAN.md | Correct misleading comment in `computeTifTrimmedStats` | SATISFIED | Comment at lines 303-305 describes bare HH:MM and ISO handling |
| FIX-05 | 15-02-PLAN.md | Fix stale `tifRollingDays` test description | SATISFIED | Line 724 reads 'rejects 91 (above max=90)'; 92/92 tests pass |

---

### Decision Coverage

No CONTEXT.md present for this phase — gate skipped cleanly.

---

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `tests/unit/forecast-tif.test.js` | FIX-01 | 1 | 0 | No | Value — asserts on prediction shape and confirms ISO-dated anchor | PASS |
| `tests/unit/forecast-tif.test.js` | FIX-02 | 1 | 0 | No | Value — `B.max >= A.max` confirms budget independence | PASS |
| `tests/unit/settings-validate.test.js` | FIX-05 | 1 | 0 | No | Value — `result.ok === false` + field error presence | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0

---

### Anti-Patterns Found

No anti-patterns found. Scanned files: `js/lib/forecast-tif.js`, `js/ui/metrics-screen.js`, `tests/unit/forecast-tif.test.js`, `tests/unit/settings-validate.test.js`. No TBD, FIXME, XXX, TODO, HACK, or PLACEHOLDER markers present.

---

### Human Verification

N/A — Infrastructure/code-quality phase with no user-facing elements. All five success criteria are verifiable programmatically. All criteria confirmed by code inspection and automated test execution (756/756 tests pass).

---

### Gaps Summary

No gaps. All five requirements (FIX-01 through FIX-05) are implemented, wired, and covered by passing unit tests.

---

_Verified: 2026-08-31T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
