---
phase: NW-11-metrics-screen
fixed_at: 2026-07-31T14:45:00Z
review_path: .planning/phases/NW-11-metrics-screen/11-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase NW-11: Code Review Fix Report

**Fixed at:** 2026-07-31T14:45:00Z  
**Source review:** .planning/phases/NW-11-metrics-screen/11-REVIEW.md  
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (critical_warning severity)
- Fixed: 6
- Skipped: 0

All critical and warning findings have been successfully fixed.

## Fixed Issues

### CR-01: Metrics Table Rows Not Reversed for Most-Recent-First Display

**Files modified:** `js/ui/metrics-screen.js`  
**Commit:** `60ff119`  
**Applied fix:**  
Changed row iteration from forward (`for (let i = 0; i < rows.length; i++)`) to reverse (`for (let i = rows.length - 1; i >= 0; i--)`), ensuring the metrics table displays days in most-recent-first order as required by Decision D11-03.

### CR-02: Aggregate Metrics Exclude No-Nap Days from Combined Sleep

**Files modified:** `js/lib/metrics.js`  
**Commit:** `3b25428`  
**Applied fix:**  
Changed line 313 from `aggregateMetric('combinedSleepNap', napRows)` to `aggregateMetric('combinedSleepNap', validRows)`. The `combinedSleepNap` metric is valid for all days (returns sleep duration alone for no-nap days), so it should be aggregated over all valid days, not just nap-dependent rows. This fixes the statistical error where mixed-nap-pattern weeks showed underestimated average combined sleep.

### CR-03: Display Converts Zero Values to Null, Hiding Valid Metrics

**Files modified:** `js/ui/metrics-screen.js`  
**Commit:** `60ff119`  
**Applied fix:**  
Removed the `|| null` operator from line 212 in `buildAggregateRow()`. Changed from `const value = aggregateData[col.key] || null;` to `const value = aggregateData[col.key];`. This allows legitimate zero values (e.g., zero activity on all-no-nap weeks) to be displayed correctly instead of being converted to null/em-dash.

### WR-01: Loose Equality in formatCellValue Violates Project Conventions

**Files modified:** `js/ui/metrics-screen.js`  
**Commit:** `60ff119`  
**Applied fix:**  
Replaced loose equality checks (`!=`) with strict equality checks (`!==`) in lines 111 and 113 of the `formatCellValue()` function. Changed from `value != null` to `value !== null && value !== undefined`, aligning with the project's strict equality convention.

### WR-02: Debug Logging in Production Code

**Files modified:** `js/ui/metrics-screen.js`  
**Commit:** `60ff119`  
**Applied fix:**  
Removed the `console.warn()` statement from line 252 in `mountMetricsScreen()`. The function already handles the null root case gracefully with a silent return, so the debug logging was unnecessary.

### WR-03: Inefficient Double-Call to napDuration in Row Building

**Files modified:** `js/lib/metrics.js`  
**Commit:** `3b25428`  
**Applied fix:**  
Extracted `napDuration(day)` to a local variable `napDur` before the `rows.push()` statement (line 233). Updated both the `napDuration` field and the `combinedSleepNap` calculation to use the cached `napDur` value instead of calling `napDuration(day)` twice. This improves efficiency without changing behavior.

## Skipped Issues

None — all findings in the critical_warning scope were successfully fixed.

---

_Fixed: 2026-07-31T14:45:00Z_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
