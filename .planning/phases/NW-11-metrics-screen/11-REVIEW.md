---
phase: NW-11-metrics-screen
reviewed: 2026-07-31T14:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - js/app.js
  - js/lib/metrics.js
  - js/lib/time.js
  - js/ui/bottom-nav.js
  - js/ui/metrics-screen.js
  - js/ui/today-screen.js
  - tests/e2e/metrics.spec.js
  - tests/unit/metrics.test.js
  - tests/unit/sw-precache.test.js
  - tests/unit/time.test.js
findings:
  critical: 3
  warning: 3
  info: 4
  total: 10
status: issues_found
---

# Phase NW-11: Code Review Report

**Reviewed:** 2026-07-31T14:30:00Z  
**Depth:** standard  
**Files Reviewed:** 10  
**Status:** issues_found

## Summary

The Phase 11 metrics implementation adds comprehensive aggregation, ratio calculations, and screen rendering. The codebase demonstrates strong security practices (textContent-only DOM updates, strict input validation) and good architecture (adapter injection, pure functions). However, three critical data-integrity bugs were identified that corrupt metrics display and calculations. These must be fixed before shipping. The bugs affect: (1) display row ordering, (2) aggregation logic for combined sleep metric, and (3) zero-value handling that hides legitimate data. Additionally, three warnings and four informational items address code quality.

---

## Critical Issues

### CR-01: Metrics Table Rows Not Reversed for Most-Recent-First Display

**File:** `js/ui/metrics-screen.js:335-340`

**Issue:**  
The metrics table renders per-day rows in forward chronological order (oldest → newest), but Decision D11-03 explicitly requires "most-recent-first" display. The code iterates `rows[0]` through `rows[length-1]` in sequence, appending each to the tbody. In HTML tables, the first appended row displays at the top, so this renders oldest-first instead of newest-first, violating the stated requirement.

**Impact:** Users see historical data at the top and today's data at the bottom, opposite to the intended UI behavior. This is a display correctness bug.

**Fix:**
Reverse the iteration when building the table:

```javascript
// Per-day rows tbody (most-recent-first, D11-03)
const daysTbody = document.createElement('tbody');
for (let i = rows.length - 1; i >= 0; i--) {
  const dayRow = buildDayRow(rows[i], snap);
  daysTbody.appendChild(dayRow);
}
```

Alternatively, reverse the rows array before iteration:
```javascript
const daysTbody = document.createElement('tbody');
const reversedRows = [...rows].reverse();
for (const row of reversedRows) {
  const dayRow = buildDayRow(row, snap);
  daysTbody.appendChild(dayRow);
}
```

---

### CR-02: Aggregate Metrics Exclude No-Nap Days from Combined Sleep (D11-26 Violation)

**File:** `js/lib/metrics.js:313`

**Issue:**  
Line 313 aggregates `combinedSleepNap` over `napRows` (days with naps only), excluding days with no naps entirely. This violates D11-26's stated design: "Excluded no-nap days from **nap-dependent** aggregates." The `combinedSleepNap` metric is **not** nap-dependent—it correctly returns sleep duration alone for no-nap days (line 101). Excluding these valid values produces statistically incorrect averages.

**Impact:** Mixed-nap-pattern weeks show underestimated average combined sleep. Example: Week with 1 nap day (6h sleep + 1h nap = 7h) and 1 no-nap day (10h sleep):
- Correct average: (7 + 10) / 2 = 8.5 hours
- Current code: 7 / 1 = 7 hours (wrong by 1.5 hours)

**Root cause:** Line 260 defines `napRows = validRows.filter(r => r.napDuration !== null)`. Line 313 passes `napRows` to aggregateMetric, but `combinedSleepNap` is valid (non-null) for all days.

**Fix:**
```javascript
// Line 313: change napRows to validRows
aggregateMetric('combinedSleepNap', validRows);
```

Keep nap-dependent metrics on `napRows`: napDuration, totalActivity, activityBeforeNap, activityAfterNap, activityAfterSleepFactor. Only combinedSleepNap moves to validRows.

---

### CR-03: Display Converts Zero Values to Null, Hiding Valid Metrics

**File:** `js/ui/metrics-screen.js:212`

**Issue:**  
Using the `||` operator (`aggregateData[col.key] || null`) converts any falsy value—including legitimate zero—to `null`, rendering valid zero metrics as "—" (em-dash). This hides meaningful data.

Affected cases:
- Average `totalActivity = 0` when all days are no-nap (before + after activity both 0)
- Average `activityBeforeNap = 0` on no-nap day aggregates
- Average `activityAfterNap = 0` on no-nap day aggregates
- Any ratio metric that correctly evaluates to 0

**Impact:** Users cannot distinguish "no data" (null/em-dash) from "zero activity" (0 minutes). Statistics become misleading.

**Example:** All-no-nap week should display "Average activity: 0h 0m", not "Average activity: —".

**Root cause:** `aggregateMetric()` (line 267-307) correctly returns 0 as a valid value. But at line 212, the `||` operator treats 0 as falsy and converts it to null:

```javascript
// BROKEN:
const value = aggregateData[col.key] || null;  // 0 becomes null
```

**Fix:**
Remove the `||` operator; trust aggregateMetric's output:

```javascript
// Line 212: direct access
const value = aggregateData[col.key];
```

The helper already guarantees correct output: either a number (which may be 0, 1.5, etc.) or null (when genuinely no data). The `||` is unnecessary and harmful.

---

## Warnings

### WR-01: Loose Equality in formatCellValue Violates Project Conventions

**File:** `js/ui/metrics-screen.js:111-113`

**Issue:**  
The `formatCellValue` function uses loose equality operators (`value != null`) instead of strict equality (`value !== null && value !== undefined`). While this works correctly (null check is safe from coercion), it violates the project's preference for strict equality and is inconsistent with the codebase style.

```javascript
// Current (lines 111-113):
} else if (colDef.isRatio && value != null) {
  return value.toFixed(2);
} else if (!colDef.isTime && !colDef.isRatio && value != null) {
  return formatDuration(value);
```

**Fix:**
Use strict equality:

```javascript
} else if (colDef.isRatio && value !== null && value !== undefined) {
  return value.toFixed(2);
} else if (!colDef.isTime && !colDef.isRatio && value !== null && value !== undefined) {
  return formatDuration(value);
```

### WR-02: Debug Logging in Production Code

**File:** `js/ui/metrics-screen.js:252`

**Issue:**  
The function contains `console.warn()` which logs to console when the root element is null/undefined. Production code should not emit console warnings for expected error states. The function already handles this case gracefully (silent no-op return).

```javascript
// Current (line 252):
console.warn('mountMetricsScreen: root element is null or undefined');
return { unsubscribe() {} };
```

**Fix:**
Remove the console.warn:

```javascript
// Guard: root must exist
if (!root) {
  return { unsubscribe() {} };
}
```

### WR-03: Inefficient Double-Call to napDuration in Row Building

**File:** `js/lib/metrics.js:244-246`

**Issue:**  
`napDuration(day)` is called twice during row construction:
- Line 244: `napDuration: napDuration(day),`
- Line 246: uses `napDuration(day)` again in conditional

This is inefficient but not functionally incorrect. The value should be computed once and reused.

**Fix:**
Compute napDur once:

```javascript
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

---

## Info

### IN-01: E2E Test Date String Construction is Fragile and Uses UTC

**File:** `tests/e2e/metrics.spec.js:57-58, 87-91`

**Issue:**  
The test manually concatenates date and time: `todayISO + 'T08:00'`. Additionally, `todayISO` is derived from `today.toISOString().split('T')[0]`, which returns UTC date, not local time. If the test runs near midnight, UTC date might differ from local date, causing timezone-dependent failures.

```javascript
// Lines 57-58:
const today = new Date();
const todayISO = today.toISOString().split('T')[0]; // UTC date!

// Lines 87-91:
at: todayISO + 'T08:00' // Fragile concatenation
```

**Fix:**
Use a fixed test date (unambiguous) or local-time formatting:

```javascript
// Option 1: Fixed date (simpler for tests)
const todayISO = '2026-07-31';

// Option 2: Use formatLocalISO for consistency
import { formatLocalISO } from '../../js/lib/time.js';
const todayISO = formatLocalISO(new Date()).slice(0, 10);
```

### IN-02: Missing aria-label on Metrics Table

**File:** `js/ui/metrics-screen.js:306`

**Issue:**  
The metrics table element lacks an `aria-label` or `aria-labelledby` attribute, reducing accessibility for screen reader users.

**Fix:**
Add descriptive aria-label:

```javascript
const table = document.createElement('table');
table.className = 'metricsTable';
table.setAttribute('aria-label', 'Sleep metrics summary and daily details');
```

### IN-03: E2E Test Does Not Cover Overnight Sleep Date Attribution

**File:** `tests/e2e/metrics.spec.js`

**Issue:**  
Unit tests (`tests/unit/metrics.test.js` lines 584-753) comprehensively cover overnight sleep spanning calendar dates (bedtime 2026-03-31, wake 2026-04-01). However, the E2E test does not verify this behavior. If aggregation fails to correctly pair and attribute overnight sleeps, the E2E suite would not catch it.

**Fix:**
Add an E2E test:

```javascript
test('MET-04: Overnight sleep correctly attributed to wake date', async ({ page }) => {
  const day1 = '2026-03-31';
  const day2 = '2026-04-01';
  const seedDb = {
    version: 2,
    settings: { /* ... */ },
    events: [
      { type: 'bedtime', at: `${day1}T23:00` },
      { type: 'wake', at: `${day2}T07:00` },
    ],
  };
  await page.evaluate((data) => {
    localStorage.setItem('nightwatch:db', JSON.stringify(data));
  }, seedDb);
  await page.reload();
  await page.locator('[data-tab="metrics"]').click();
  
  // Verify sleep duration is attributed to wake date (day2)
  const table = page.locator('.metricsTable');
  await expect(table).toBeVisible();
  // Assert row with 2026-04-01 shows sleepDuration = 480 minutes (8 hours)
});
```

### IN-04: Magic Number in Service Worker Precache Test

**File:** `tests/unit/sw-precache.test.js:114`

**Issue:**  
The test asserts `precacheList.length >= 32` using a magic number. If app files change, this assertion becomes stale. The test would be more maintainable with documented rationale.

**Fix:**
Document the baseline or check required files only:

```javascript
test('has expected minimum precache entries', () => {
  // Baseline Phase 11: html + css + manifest + icons + app.js + 
  // lib/* modules + ui/* screens + adapters.
  // Update when adding new modules.
  assert.ok(precacheList.length >= 32, 
    `Expected >= 32 entries, got ${precacheList.length}`);
});
```

---

## Security & Code Quality Summary

**Positive findings:**
- ✓ XSS prevention: All dynamic content uses `textContent`, never `innerHTML`
- ✓ Pure functions: metrics.js has no DOM, storage, or clock access
- ✓ Adapter injection: Respects adapter seam; no hardcoded Date or localStorage
- ✓ Null safety: Functions guard against null/undefined slots
- ✓ Subscription cleanup: Proper unsubscribe handles for lifecycle management
- ✓ No secrets detected: No hardcoded credentials or sensitive data

**Security vulnerabilities found:** None

---

_Reviewed: 2026-07-31T14:30:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
