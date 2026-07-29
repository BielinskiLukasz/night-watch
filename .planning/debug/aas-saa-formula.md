---
status: resolved
trigger: "GAP G-NW-11-16: AAS/SAA formula mismatch — User expects combinedSleepNap, implementation uses sleepDuration alone"
created: 2026-07-29T14:25:00Z
updated: 2026-07-29T14:45:00Z
goal: find_root_cause_only
---

## Current Focus

**Root cause identified:** Phase 11 design decisions D11-24 and D11-25 misinterpreted the requirements specification (MET-04), choosing sleepDuration instead of combinedSleepNap as the divisor/dividend for AAS and SAA ratio metrics.

## Symptoms

**Expected (from MET-04 and user's understanding):**
- AAS = totalActivity / **combinedSleepNap**
- SAA = **combinedSleepNap** / prevDay.totalActivity

**Actual (implemented in js/lib/metrics.js):**
- AAS = totalActivity / **sleepDuration** (line 119)
- SAA = **sleepDuration** / prevDay.totalActivity (line 133)

**Errors:** None — no crash, wrong formula producing wrong metrics values

**Reproduction:** Compare metrics table AAS/SAA values against manual calculation using combined sleep+nap

**Timeline:** Discovered during Phase 11 UAT 2026-07-29

## Eliminated

(none — direct evidence trail found)

## Evidence

### Evidence 1: REQUIREMENTS.md Specification (MET-04)
- **Timestamp:** 2026-07-13
- **Checked:** `.planning/REQUIREMENTS.md` line 30
- **Found:** 
  ```
  MET-04: "activity-after-sleep factor (activity time ÷ night-sleep duration) 
  and sleep-after-activity factor (night-sleep duration ÷ previous day's activity time)"
  ```
- **Implication:** "night-sleep duration" is ambiguous — could mean (a) sleepDuration alone, or (b) combined sleep+nap. User interpreted as (b). Spec did not disambiguate.

### Evidence 2: Phase 11 Context Decision (D11-24, D11-25)
- **Timestamp:** 2026-07-20 (gathered before planning)
- **Checked:** `.planning/phases/NW-11-metrics-screen/11-CONTEXT.md` lines 62-63
- **Found:**
  ```
  D11-24: "activityAfterSleepFactor(day) — AAS: totalActivity(day) / sleepDuration(day)"
  D11-25: "sleepAfterActivityFactor(day, prevDay) — SAA: sleepDuration(day) / totalActivity(prevDay)"
  ```
- **Implication:** Context planner chose sleepDuration (night sleep only) instead of combinedSleepNap (sleep + nap). This locked in the interpretation of MET-04.

### Evidence 3: Actual Implementation
- **Timestamp:** 2026-07-24 (during Phase 11 execution)
- **Checked:** `js/lib/metrics.js` lines 115-120 and 128-134
- **Found:**
  ```javascript
  // Line 115-120
  export function activityAfterSleepFactor(day) {
    const activity = totalActivity(day);
    const sleep    = sleepDuration(day);  // ← sleepDuration, not combinedSleepNap
    if (activity == null || sleep == null || sleep === 0) return null;
    return activity / sleep;
  }

  // Line 128-134
  export function sleepAfterActivityFactor(day, prevDay) {
    if (prevDay == null) return null;
    const sleep      = sleepDuration(day);  // ← sleepDuration, not combinedSleepNap
    const prevActivity = totalActivity(prevDay);
    if (sleep == null || prevActivity == null || prevActivity === 0) return null;
    return sleep / prevActivity;
  }
  ```
- **Implication:** Implementation correctly matches the design decisions D11-24/D11-25, but those decisions chose the wrong divisor/dividend based on ambiguous requirement.

### Evidence 4: User's Expectation (UAT Gap G-NW-11-16)
- **Timestamp:** 2026-07-29 (UAT report)
- **Checked:** `.planning/phases/NW-11-metrics-screen/11-UAT.md` lines 148-155
- **Found:**
  ```yaml
  gap_id: G-NW-11-16
  truth: "AAS = totalActivity / combinedSleepNap; SAA = combinedSleepNap / prevDay.totalActivity"
  reason: "User reported: AAS = Activity / Combined (not sleep alone); 
           SAA = Combined / Activity — current formula may use sleepDuration 
           instead of combinedSleepNap as the denominator/numerator"
  ```
- **Implication:** User expected the ratios to include nap time in the denominator/numerator (sleep + nap combined), not sleep alone.

### Evidence 5: Helper Function `combinedSleepNap` Exists
- **Timestamp:** 2026-07-24 (during metrics.js development)
- **Checked:** `js/lib/metrics.js` lines 86-92
- **Found:**
  ```javascript
  /** Sum of night sleep and nap; null if either component is unavailable. */
  export function combinedSleepNap(day) {
    const sleep = sleepDuration(day);
    const nap   = napDuration(day);
    if (sleep == null || nap == null) return null;
    return sleep + nap;
  }
  ```
- **Implication:** The `combinedSleepNap` function exists and was available to use in the AAS/SAA formulas. The choice to use `sleepDuration` instead was deliberate (in the context decisions), not accidental.

### Evidence 6: Phase 11 Verification Marked Complete
- **Timestamp:** 2026-07-28 (verification)
- **Checked:** `.planning/phases/NW-11-metrics-screen/11-VERIFICATION.md` line 87
- **Found:**
  ```
  | MET-04 | 11-01, 11-02 | Historical aggregates (avg, min with date, max with date) | ✓ SATISFIED
  ```
- **Implication:** Verification checked that the columns *exist* and *display*, not that the formula is correct. The verification report confirmed the implementation matches D11-24/D11-25, but didn't validate whether D11-24/D11-25 correctly interpreted the user's intent for MET-04.

## Resolution

### Root Cause

**Primary cause:** REQUIREMENTS.md §MET-04 used ambiguous language ("night-sleep duration"). Phase 11 context planner (D11-24, D11-25) interpreted this as sleepDuration alone, not combinedSleepNap. Implementation correctly follows the design decisions, but the decisions themselves misinterpreted the requirement.

**Contributing factors:**
1. MET-04 specification did not explicitly state "night sleep only" vs. "sleep + nap combined"
2. Context discussion did not gather user clarification on the intent
3. Verification step checked that metrics *exist* and *format* correctly, not that the formulas match the user's semantic intent

### Files Involved

- `.planning/REQUIREMENTS.md` (line 30): MET-04 uses ambiguous term "night-sleep duration"
- `.planning/phases/NW-11-metrics-screen/11-CONTEXT.md` (lines 62-63): D11-24, D11-25 hardcode sleepDuration as the choice
- `js/lib/metrics.js` (lines 115-120, 128-134): Implementation correctly matches D11-24/D11-25, uses sleepDuration
- `.planning/phases/NW-11-metrics-screen/11-VERIFICATION.md` (line 87): Verification did not validate formula correctness, only existence

### Suggested Fix Direction

The formulas should use `combinedSleepNap` instead of `sleepDuration`:
- AAS = `totalActivity(day) / combinedSleepNap(day)`
- SAA = `combinedSleepNap(day) / totalActivity(prevDay)`

This requires:
1. Update REQUIREMENTS.md §MET-04 to clarify: "activity time ÷ combined sleep+nap duration" and "combined sleep+nap duration ÷ previous day's activity time"
2. Update D11-24 and D11-25 in 11-CONTEXT.md to reference combinedSleepNap instead of sleepDuration
3. Update the two functions in `js/lib/metrics.js` to use `combinedSleepNap(day)` instead of `sleepDuration(day)`
4. Add regression test case to `tests/unit/metrics.test.js` explicitly checking AAS and SAA use combinedSleepNap, not sleepDuration alone
5. Re-verify metrics values in UAT match the combined formula

### Why Not Caught

- **No test gate caught it:** Verification checked that the functions exist and are called, not that they use the correct operands
- **Ambiguous requirement:** MET-04 did not disambiguate "night-sleep duration" as either "sleep alone" or "sleep + nap combined"
- **No UAT before handoff:** Phase 11 completed and was marked verified before UAT revealed the user's semantic expectation
- **Documentation gap:** Design decisions (D11-24, D11-25) were not cross-checked against user intent during context gathering

---

**Debug session author:** Claude Sonnet 4.6  
**Date:** 2026-07-29T14:45:00Z
