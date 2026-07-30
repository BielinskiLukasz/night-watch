---
phase: 11-metrics-screen
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - js/lib/metrics.js
  - js/ui/metrics-screen.js
  - js/ui/today-screen.js
  - style.css
  - tests/unit/metrics.test.js
findings:
  critical: 2
  warning: 1
  info: 2
  total: 5
status: issues_found
---

# Phase 11: Code Review Report (Focused Review)

**Reviewed:** 2026-07-30
**Depth:** standard
**Files Reviewed:** 5 (subset from workflow)
**Status:** issues_found

## Summary

Code review of Phase 11 metrics implementation (focused on the 5 changed files) identifies two critical logic errors in aggregation and display layers that corrupt metric averages and hide zero values. The previous review's CR-01/CR-02 data-loss bugs have been fixed (date tracking and index storage are now in place). However, two new critical bugs were introduced in the aggregation logic and display layer. These must be fixed before shipping.

---

## Critical Issues

### CR-01: Aggregate Metrics Exclude No-Nap Days from Combined Sleep (D11-26 Violation)

**File:** `js/lib/metrics.js:313`

**Issue:**
Line 313 aggregates `combinedSleepNap` over `napRows` (days with naps only), excluding days with no naps. This contradicts the stated design intent in D11-26: "Excluded no-nap days from **nap-dependent** aggregates." The `combinedSleepNap` metric is **not** nap-dependent—it returns sleep duration alone for no-nap days (line 101). Excluding these valid values from the average produces wrong statistical results.

**Impact:** Mixed-nap-pattern weeks will show incorrect average combined sleep.

**Example:** Week with 1 nap day (6h sleep + 1h nap = 7h combined) and 1 no-nap day (10h sleep):
- Correct average: (7 + 10) / 2 = 8.5 hours
- Current code: 7 / 1 = 7 hours (wrong by 1.5 hours, underestimated)

**Root cause:** Line 260 defines `napRows = validRows.filter(r => r.napDuration !== null)`, excluding all no-nap days. Line 313 passes `napRows` to aggregateMetric for combinedSleepNap, but combinedSleepNap is valid (non-null) for all days.

**Fix:**
```javascript
// Line 313: change napRows to validRows to include no-nap days
aggregateMetric('combinedSleepNap', validRows);
```

The nap-dependent metrics stay on `napRows`: napDuration, totalActivity, activityBeforeNap, activityAfterNap, activityAfterSleepFactor. Only combinedSleepNap moves to validRows.

---

### CR-02: Display Converts Zero Values to Null, Hiding Valid Metrics

**File:** `js/ui/metrics-screen.js:212`

**Issue:**
Using the `||` operator (`aggregateData[col.key] || null`) converts any falsy value (including legitimate zero) to `null`, rendering valid zero metrics invisible in the table.

Affected cases:
- Average `totalActivity = 0` when all days are no-nap (before + after = 0 + 0 = 0)
- Average `activityBeforeNap = 0` on no-nap day aggregates
- Average `activityAfterNap = 0` on no-nap day aggregates
- Any ratio metric that correctly evaluates to 0

The zero is a valid, meaningful metric (no activity on no-nap days) and should display as "0h 0m" or "0.00", not "—" (em-dash).

**Impact:** Users cannot distinguish "no data" (null/em-dash) from "zero activity" (0 minutes). Stats become misleading.

**Example:** All-no-nap week should display "Average activity: 0h 0m", not "Average activity: —".

**Root cause:** `aggregateMetric()` (line 267-307) correctly returns 0 as a valid value. But at line 212, the `||` operator treats 0 as falsy and converts it to null:
```javascript
// BROKEN:
const value = aggregateData[col.key] || null;  // 0 becomes null
```

**Fix:**
```javascript
// Line 212: remove the || operator; trust aggregateMetric's output
const value = aggregateData[col.key];
```

The helper already guarantees a value: either a number (which may be 0) or null (when no data). The `||` is unnecessary and harmful.

---

## Warnings

### WR-01: Inefficient Double-Call to napDuration in Row Building

**File:** `js/lib/metrics.js:244–246`

**Issue:**
`napDuration(day)` is called twice in the same row construction:
- Line 244: `napDuration: napDuration(day),`
- Line 246: `combinedSleepNap: ... (napDuration(day) !== null ? sleepDur + napDuration(day) : sleepDur) ...`

This is inefficient but not incorrect. The function should be called once and reused.

**Fix:**
```javascript
// Lines 244–246: compute napDur once
const napDur = napDuration(day);
rows.push({
  // ...
  napDuration: napDur,
  combinedSleepNap: sleepDur !== null 
    ? (napDur !== null ? sleepDur + napDur : sleepDur) 
    : null,
  // ...
});
```

Alternatively, call the helper directly (simpler):
```javascript
combinedSleepNap: combinedSleepNap(day),
```

---

## Info

### IN-01: Debug Console Warning in Production Code

**File:** `js/ui/metrics-screen.js:252`

**Issue:**
```javascript
console.warn('mountMetricsScreen: root element is null or undefined');
```

Production code should not emit console warnings for expected error states. This condition (null root) should be handled silently or tested, not logged.

**Fix:**
```javascript
if (!root) {
  return { unsubscribe() {} };  // Silent no-op; console logs belong in tests only
}
```

---

### IN-02: Redundant Date Extraction in getDate Helper

**File:** `js/lib/metrics.js:297–303`

**Issue:**
The `getDate` helper inside `aggregateMetric` looks up the original day record via `_dayRecordsIdx`, then returns `row.date`, which was already extracted and cached during row construction (line 235). The original day lookup is redundant.

**Current code:**
```javascript
const getDate = (rowIdx) => {
  const row = rows[rowIdx];
  if (!row || row._dayRecordsIdx === undefined) return null;
  const origDay = dayRecords[row._dayRecordsIdx];
  if (!origDay) return null;
  return row.date;  // Just returns the cached value; origDay lookup was unnecessary
};
```

**Fix:**
```javascript
// Line 297–303: simplify to direct access
const minRowIdx = rows.findIndex(r => r[key] === minValue);
const maxRowIdx = rows.findIndex(r => r[key] === maxValue);

min[key] = minRowIdx >= 0 ? { value: minValue, date: rows[minRowIdx].date } : null;
max[key] = maxRowIdx >= 0 ? { value: maxValue, date: rows[maxRowIdx].date } : null;
```

---

## Security & Code Quality Notes

**Positive findings:**
- ✓ **XSS prevention:** All dynamic content uses `textContent`, never `innerHTML`. Stage names and metrics are safe.
- ✓ **Pure functions:** metrics.js has no DOM, storage, or clock access. Pure calculation layer is portable and testable.
- ✓ **Adapter injection:** Both files respect the adapter seam; no hardcoded Date or localStorage calls.
- ✓ **Null safety:** Functions guard against null/undefined slots.
- ✓ **Subscription cleanup:** mountMetricsScreen returns unsubscribe handles for proper lifecycle.
- ✓ **Table layout:** Sticky header/column z-index stacking is correct (z-index: 3 for corner, 2 for header, 1 for left column).
- ✓ **No secrets detected:** No hardcoded credentials, API keys, or sensitive data.

**Previous CR-01/CR-02 fixes verified:**
- Date field populated at line 235: `date: dateStr || null`
- Index tracking at line 236: `_dayRecordsIdx: i`
- ISO timestamps stored for times (line 238-241): full `.at` strings preserved, not just extractTime results
- These fixes enable correct min/max date attribution

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
