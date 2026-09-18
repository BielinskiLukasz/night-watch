---
phase: 25-algorithm-c-settings-modal
verified: 2026-09-18T18:00:00Z
status: gaps_found
score: 4/6 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification: true
previous_status: gaps_found
previous_score: 2/6
gaps_closed:
  - "Plan 25-08 added self-unwrap/align-to-reference hardening to stabilityCheck() for individually-inverted intervals (min > max case)"
  - "Tests added for stabilityCheck() with asymmetrically-wrapped input intervals (CR-01 self-wrap case from Plan 25-08)"
gaps_remaining:
  - truth: "Interval stability check ensures central prediction lies within the reported [min, max] band for all realistic data patterns (PRED-16, Success Criterion #2)"
    status: failed
    reason: "Code review (25-REVIEW.md CR-01) identified and independent verification reproduced: central '08:25' (8:25 AM) outside band [00:10, 00:10] with realistic bedtime alternating 23:50/00:10. Plan 25-08 hardened stabilityCheck() for self-wrapped intervals, but the real root cause is in trimmedBand() and combineModels(), which are not circular-aware — they treat midnight-straddling clock times as linear numbers."
    artifacts:
      - path: "js/lib/forecast-blend.js:70-88"
        issue: "trimmedBand() sorts raw clock-minutes linearly. With bedtime 23:50 (1430) and 00:10 (10) alternating, sorts as [10,10,10,10,10,1430,1430,1430,1430,1430]; median = (10+1430)/2 = 720 (noon), completely wrong for midnight-straddling data."
      - path: "js/lib/forecast-blend.js:241-252"
        issue: "combineModels() averages medians with plain arithmetic: (m1.median + m2.median + ...) / count. When medians are already wrong from circular-unaware trimmedBand, the averaging compounds the error."
      - path: "js/lib/forecast-blend.js:440"
        issue: "Wake's inline blend uses same linear averaging: (a1.median + a2.median) / 2, even when both medians represent midnight-straddling data."
      - path: "tests/unit/forecast-blend.test.js:152-198"
        issue: "The 5 new CR-01 tests (Plan 25-08) pass pre-fabricated {min, max, median} intervals with central already close to true center. They bypass the circular-unaware source path (trimmedBand/combineModels) entirely, so the upstream bug remains untested."
    missing:
      - "Circular-aware median computation for raw clock-time-of-day samples (self-unwrap+align raw sample array before sorting, then wrap result)"
      - "Circular-aware central averaging in combineModels() and wake's inline blend (align each model's median onto shared reference before averaging)"
      - "Regression test with bedtime/wake/napStart alternating across midnight (23:50/00:10 fixture), asserting centralWithinBand() is true"
regressions: []
behavior_unverified_items:
  - truth: "Unit tests cover all blend and stability logic; E2E covers selector visibility"
    test: "Run forecast-blend.test.js and algorithm-c.spec.js; confirm all pass"
    expected: "972/972 unit tests pass; E2E selector visibility test passes"
    why_human: "Tests pass, but the passing unit tests do NOT exercise the circular-midnight-straddling scenario that fails in production. The 5 new CR-01 tests check pre-fabricated intervals, not real data flow. No test asserts centralWithinBand() for raw bedtime times alternating 23:50/00:10."
---

# Phase 25: Algorithm C & Settings Modal — Verification Report (Re-Verification after Plan 25-08)

**Phase Goal:** Users can opt into a third prediction algorithm (Algorithm C) that blends multiple models per event, selectable alongside Classic and TIF from the Settings modal

**Verified:** 2026-09-18T18:00:00Z

**Status:** gaps_found

**Re-verification:** Yes — Plan 25-08 attempted to close CR-01 (circular-interval defect), but closure is incomplete; root cause is different from what the gap-closure plan addressed.

## Summary

**4 of 6 must-haves verified; 1 FAILED (blocker); 1 PRESENT_BEHAVIOR_UNVERIFIED (test coverage gap).**

**Phase goal NOT achieved.** Success Criterion #2 (interval stability check ensures central ∈ [min, max] band) is demonstrably false for realistic midnight-straddling data. PRED-16 requirement is not satisfied.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `js/lib/forecast-blend.js` exports `blendForecast(dayRecords, snap)` returning {isColdStart, wake, bedtime, napStart, napEnd} — same top-level shape as `forecast()`/`tifForecast()` (PRED-13) | ✓ VERIFIED | File exists, function exported, dispatch wired at today-screen.js:1183-1184 |
| 2 | Interval stability check (intersection/shrinkage when overlap; union when no overlap) applies to all 4 events (PRED-16, Success Criterion #2) | ✗ FAILED | Code review (25-REVIEW.md CR-01) identified + independently reproduced: central '08:25' vs band [00:10, 00:10] with realistic bedtime data. Central does NOT lie within [min, max]. |
| 3 | Algorithm C covers all 4 events with real predictions for wake, bedtime, nap-start, nap-end (PRED-17) | ✓ VERIFIED | All 4 events return {central, min, max} HH:MM strings on non-cold-start |
| 4 | Settings modal exposes three-option algorithm selector with context-sensitive fieldset show/hide (UI-12) | ✓ VERIFIED | forecastAlgorithm <select> wired; #blendOptions hidden/shown correctly |
| 5 | forecast-blend.js in PRECACHE_LIST (sw.js + tests/unit/sw-precache.test.js) | ✓ VERIFIED | grep confirms './js/lib/forecast-blend.js' in PRECACHE_LIST; test present |
| 6 | Unit tests (RED→GREEN) cover blend/stability logic; E2E covers selector visibility | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Tests exist and pass (972/972 unit tests); however, no test exercises the circular-midnight-straddling scenario that fails in production |

**Score:** 4/6 truths verified; 1 failed; 1 present-behavior-unverified (test coverage gap)

### Critical Issue: CR-01 (Circular-Interval Defect)

**Symptom:** With bedtime alternating 23:50 / 00:10 across 20 days:
```js
blendForecast(days, {minDays: 7, blendWindowDays: 90, blendTrimPct: 25, blendShrinkage: 0.3}).bedtime
// => { central: '08:25', min: '00:10', max: '00:10' }
```

Central '08:25' (8:25 AM) is NOT in the reported band [00:10, 00:10]. This violates the fundamental invariant that the interval stability check should ensure.

**Root Cause Chain:**

1. **trimmedBand()** (lines 70-88) sorts raw clock-minutes linearly:
   - Input: 20 bedtimes alternating 23:50 (1430) and 00:10 (10)
   - Sorted: [10, 10, 10, 10, 10, 1430, 1430, 1430, 1430, 1430]
   - Median: (10 + 1430) / 2 = 720 minutes = 12:00 (noon) ← **WRONG**
   - The true circular center should be close to midnight (00:00 / 00:10)

2. **combineModels()** (line 249) averages medians with plain arithmetic:
   ```js
   const rawCentral = models.reduce((sum, m) => sum + m.median, 0) / models.length;
   ```
   When already-wrong medians from `trimmedBand()` are averaged this way, the error compounds.

3. **stabilityCheck()** (lines 178-203) handles the already-wrong values:
   - It receives already-incorrect {min, max, median} objects and an already-incorrect rawCentral
   - Its internal `alignNearReference()` step can shift values by ±1440 minutes to find the nearest alignment
   - But it cannot repair a value that was computed incorrectly in the first place
   - E.g., if median was computed as 720 (noon) and should be 10 (00:10), no shift by multiples of 1440 lands on 10

**Why Plan 25-08's Fix is Incomplete:**

Plan 25-08 hardened `stabilityCheck()` to handle self-wrapped intervals (min > max). The 5 new tests verify this:
- They pass pre-fabricated {min, max} intervals
- They assume a central value already close to the true center
- They bypass the upstream circular-unaware source path

The new tests never exercise:
- Raw bedtime times being sorted linearly (trimmedBand)
- Medians being averaged linearly (combineModels)
- The resulting wrong central reaching stabilityCheck

**Code Path Not Exercised by Tests:**

The WR-01 tests (`buildLateWakeNapStartFixture`, `buildLateWakeNapEndFixture`) use `centralWithinBand()`, a wrap-tolerant helper. They exercise a single model wrapping past midnight, but never a raw sample array straddling the boundary from both sides (50% at 23:50, 50% at 00:10).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/lib/forecast-blend.js` | blendForecast, trimmedBand, stabilityCheck, wrapToDay, BLEND_CONFIG | ✓ VERIFIED | All exports present; implementations complete for all 4 events |
| `tests/unit/forecast-blend.test.js` | Coverage for blend/stability cases | ✓ VERIFIED | 34 tests pass; includes 5 new CR-01 circular-interval tests |
| Settings modal `#blendOptions` fieldset | Three inputs for blendWindowDays/blendTrimPct/blendShrinkage | ✓ VERIFIED | index.html lines 320-331 |
| `DEFAULT_SETTINGS` | blendWindowDays, blendTrimPct, blendShrinkage | ✓ VERIFIED | db-shape.js lines 72-74 |
| settings-validate.js RULES | Validation ranges for blend settings | ✓ VERIFIED | RULES defined and referenced in settings-modal.js |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| js/ui/today-screen.js | js/lib/forecast-blend.js | import + dispatch (line 50, 1183-1184) | ✓ VERIFIED |
| settings-modal.js | #blendOptions | form.elements.namedItem (lines 105-110, 201-203) | ✓ VERIFIED |
| forecastAlgorithm change | show/hide blendOptions | el.hidden = (algo !== 'blend') (lines 159-163) | ✓ VERIFIED |
| stabilityCheck | models | Call in combineModels (line 250) and wake blend (line 441) | ✓ VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| blendForecast returns shape | `blendForecast(30-day fixture).wake` | {central: '06:25', min: '06:00', max: '06:55'} | ✓ PASS |
| Cold-start gate | `blendForecast(3 days, {minDays:7})` | {isColdStart: true, wake: null, ...} | ✓ PASS |
| Algorithm selector | Settings modal change forecastAlgorithm | #blendOptions shown/hidden | ✓ PASS |
| **Central within band (midnight-straddling)** | `blendForecast(20-day bedtime 23:50/00:10 fixture).bedtime` | central '08:25' NOT in [00:10, 00:10] | ✗ FAIL |

### Requirements Coverage

| Requirement | Phase | Status | Evidence |
|-------------|-------|--------|----------|
| PRED-13 | 25 | ✓ SATISFIED | blendForecast exported, same shape, wired in today-screen.js |
| PRED-14 | 25 | ✓ SATISFIED | Wake dual-model blend implemented (A1 + A2, line 440) |
| PRED-15 | 25 | ✓ SATISFIED | Bedtime three-band blend implemented (Models 1/2/3) |
| PRED-16 | 25 | ✗ BLOCKED | Interval stability check present but violates invariant: central falls outside [min, max] for realistic midnight-straddling data |
| PRED-17 | 25 | ✓ SATISFIED | All 4 events return real {central, min, max} predictions |
| UI-12 | 25 | ✓ SATISFIED | Three-option selector, context-sensitive fieldset show/hide |

---

## Analysis

### What Plan 25-08 Fixed vs. What It Missed

**Plan 25-08 Fixed (Verified):**
- Self-unwrap single interval: when `min > max` after independent `wrapToDay()` of band fields, push `max` forward by 1 DAY
- Align all intervals + central onto one shared reference frame
- Run existing overlap/union/shrinkage math on aligned frame
- Re-wrap results via `wrapToDay()`
- All 5 new tests pass (circular/wrapped intervals cases)

**What Plan 25-08 Did NOT Fix:**
- Raw bedtime times sorted linearly before being fed into trimmedBand
- Medians averaged linearly in combineModels() and wake's inline blend
- These linear operations produce wrong scalars that stabilityCheck() cannot repair

**Concrete Example:**

Fixture: 20 days, bedtime = `i % 2 === 0 ? '23:50' : '00:10'`

1. `extractTime` produces: `['23:50', '00:10', '23:50', '00:10', ...]`
2. `timeToMinutes` produces: `[1430, 10, 1430, 10, ...]`
3. `.sort((a,b)=>a-b)` produces: `[10, 10, 10, 10, 10, 1430, 1430, 1430, 1430, 1430]` ← linear sort
4. `trimmedBand(..., 25, 0)`:
   - budget = floor(20 * 25 / 100) = 5
   - trim [10, 10, 10, 10, 10, 1430, 1430, 1430, 1430, 1430] → [10, 10, 10, 10, 1430, 1430, 1430, 1430] (2 off each end)
   - median = (10 + 1430) / 2 = 720 ← **WRONG**, should be ≈ 00:10 or 23:50

This wrong median of 720 flows through `combineModels()` and reaches `stabilityCheck()`, which cannot fix it.

### Test Coverage Gap

**What is tested:**
- trimmedBand on linear numeric arrays (baseline case)
- stabilityCheck on pre-fabricated {min, max, median} with correct values
- Late-wake nap-start/nap-end crossing midnight (single model wrapping, Model 2 raw times)

**What is NOT tested:**
- Raw bedtime times alternating across midnight (50/50 split between 23:50 and 00:10)
- Median computation on midnight-straddling data
- Central averaging on midnight-straddling medians
- Assertion that the final central value lies within the final [min, max] band (not using wrap-tolerant helper)

---

## No Changes Made

Per instructions, this is verification only. No code fixes have been applied.

---

_Verified: 2026-09-18T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
