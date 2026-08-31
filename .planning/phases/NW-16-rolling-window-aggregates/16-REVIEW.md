---
phase: NW-16-rolling-window-aggregates
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - js/ui/metrics-screen.js
  - style.css
  - tests/e2e/metrics.spec.js
findings:
  critical: 1
  warning: 6
  info: 0
  total: 7
status: issues_found
---

# Phase NW-16: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the core Metrics screen module (`js/ui/metrics-screen.js`), the
accompanying stylesheet (`style.css`), and the Playwright E2E spec (`tests/e2e/metrics.spec.js`).

`style.css` is clean — the new `.metrics-section-header` rule and `.metrics-rolling-tbody`
selector are correct and consistent with the JS output.

`js/ui/metrics-screen.js` has one BLOCKER: the All-time summary rows (Min / Average / Max) are
never given TIF placeholder cells, so when TIF is the active algorithm the All-time section is
12 cells short per row while the header and rolling-window rows all have 30 cells. The visual
corruption only surfaces when TIF is toggled on, which is why the existing E2E tests (which only
run with `forecastAlgorithm: 'classic'`) do not catch it.

The E2E spec has several issues: a fundamentally broken test (MET-02/MET-03 opens an unhandled
modal), a UTC/local-time mismatch in MET-06, and a flaky `waitForTimeout` call. There is also an
unused import and a global-shadowing variable name in the JS module, plus an undocumented interface
method dependency.

## Critical Issues

### CR-01: All-time Min/Average/Max aggregate rows are missing 12 TIF placeholder cells

**File:** `js/ui/metrics-screen.js:638-644`

**Issue:** `buildRollingSection` explicitly appends 12 TIF placeholder cells (hidden when TIF is
off) to each of the Min / Average / Max rows it produces (lines 451-458). The All-time
`summaryTbody` block builds the same three rows with `buildAggregateRow` but never appends the
TIF placeholder cells. When `forecastAlgorithm === 'tif'` the table header has 30 visible columns
(18 base + 12 TIF), the rolling-window rows also have 30 cells, but the All-time Min / Average /
Max rows have only 18 — producing visible column misalignment for every row in the All-time
section. The TIF aggregate rows (`buildTifAggregateRow`) below them are correct (they include the
12 TIF cells internally), making the misalignment more jarring.

**Fix:** After building the three All-time aggregate rows (lines 638-640) and before appending
them to `summaryTbody`, add the same TIF-cell loop used by `buildRollingSection`:

```js
// Build aggregate rows
const avgRow = buildAggregateRow('Average', avg, snap);
const minRow = buildAggregateRow('Min', min, snap);
const maxRow = buildAggregateRow('Max', max, snap);

// Append TIF placeholder cells to All-time rows (prevents column-count mismatch when TIF is on)
for (const row of [minRow, avgRow, maxRow]) {
  for (let j = 0; j < TIF_COLUMNS.length; j++) {
    const td = document.createElement('td');
    td.textContent = '—';
    td.hidden = !isTif;
    row.appendChild(td);
  }
}

summaryTbody.appendChild(minRow);
summaryTbody.appendChild(avgRow);
summaryTbody.appendChild(maxRow);
```

## Warnings

### WR-01: Unused import `activityAfterSleepFactor`

**File:** `js/ui/metrics-screen.js:18`

**Issue:** `activityAfterSleepFactor` is imported from `../lib/metrics.js` but is never called
anywhere in `metrics-screen.js`. The column with that key reads its value directly from the
`aggregateMetrics` row object by string key; no direct function invocation is needed. Unused
imports increase cognitive surface area and inflate the module's visible API dependency.

**Fix:** Remove from the import statement:

```js
import {
  aggregateMetrics,
} from '../lib/metrics.js';
```

### WR-02: `window` variable shadows the global `window` object

**File:** `js/ui/metrics-screen.js:294`

**Issue:** Inside `computeTifTrimmedStats`, the local variable `const window = rows.slice(-windowSize).filter(r => !r.rejected)` shadows the browser's `window` global. While the global is not accessed in this scope, the name collision is a footgun if the function is ever extended, and it will fire ESLint `no-shadow` / browser-lint rules.

**Fix:** Rename to a non-colliding identifier:

```js
const rollingWindow = rows.slice(-windowSize).filter(r => !r.rejected);
// … and update all subsequent references from `window` to `rollingWindow`
```

### WR-03: `eventLog.getActivityLog()` is called but absent from the documented interface

**File:** `js/ui/metrics-screen.js:556`

**Issue:** The JSDoc for `mountMetricsScreen` (lines 480-492) documents the `eventLog` interface
as requiring only `daysBySubjectiveNight` and `subscribe`. However, at line 556 the code calls
`eventLog.getActivityLog()` unconditionally when TIF is active:

```js
const activityLog = isTif ? eventLog.getActivityLog() : {};
```

Any caller (or test double) that follows the documented interface will receive a `TypeError:
eventLog.getActivityLog is not a function` the moment TIF is toggled on — a silent runtime break
with no static warning.

**Fix:** Add `getActivityLog` to the JSDoc interface:

```js
 *   eventLog: {
 *     daysBySubjectiveNight: (cutoverHour: number) => Array<object>,
 *     subscribe: (fn: () => void) => () => void,
 *     getActivityLog: () => object,
 *   },
```

### WR-04: JSDoc says "16-column metrics table" but COLUMNS has 18 entries

**File:** `js/ui/metrics-screen.js:32-33`

**Issue:** The block comment at the top of the COLUMNS definition reads "16-column metrics table
(D-09 order)" and the column enumeration in the comment lists 16 columns. The actual array has 18
entries — `maSleepRatio` (MA/Sl) and `maNapRatio` (MA/Nap) are present in the array but missing
from the comment list. The E2E test correctly expects 30 header cells (18 + 12 TIF), confirming
the implementation is the ground truth. The docstring is wrong.

**Fix:** Update the comment header to "18-column metrics table" and add MA/Sl and MA/Nap to the
column-order enumeration:

```js
 * Column definitions for the 18-column metrics table (D-09 order).
 * Order: Date | Wake | Nap Start | Nap End | Bedtime | Sleep | Nap | Nap Frac |
 *        Comb | Day Len | Day/Sleep | →Nap | MA/Sl | MA/Nap | Nap→ | Act | AM/PM | AAS
```

### WR-05: E2E test MET-02/MET-03 clicks a quick-log button without handling the resulting modal

**File:** `tests/e2e/metrics.spec.js:24-47`

**Issue:** The test clicks `[data-log="wake"]`, which in this app opens the manual-entry modal
dialog. The test then immediately navigates to the Metrics tab with no modal interaction (no
fill-in, no submit, no close). The comment acknowledges this: "For now, assume quick-log was used
and data exists." The event is never saved, so the Metrics table renders with no data, and the
assertion `await expect(table).toBeVisible()` will fail because the empty-state `<p class="emptyState">` is rendered instead of `.metricsTable`.

**Fix:** Seed test data in `localStorage` before the page load (the same pattern used in all
other tests in this file), or interact with the modal to completion before navigating. Remove the
ambiguous "assume quick-log" comment.

```js
// Recommended: inject seed data before navigating, matching the pattern in MET-06 / MET-09
await page.evaluate((data) => {
  localStorage.setItem('nightwatch:db', JSON.stringify(data));
}, seedDb);
await page.reload();
await page.waitForSelector('[data-tab="today"]');
await page.locator('[data-tab="metrics"]').click();
await expect(page.locator('.metricsTable')).toBeVisible();
```

### WR-06: MET-06 test derives "today" via `toISOString()` — UTC date, not local date

**File:** `tests/e2e/metrics.spec.js:59-60`

**Issue:**

```js
const today = new Date();
const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD
```

`toISOString()` returns the UTC date. When the test machine's local timezone is UTC-N and the
test runs between midnight UTC and N hours after midnight locally, `todayISO` will be yesterday's
date in local time. The seeded event (`at: todayISO + 'T08:00'`) would then be attributed to a
different date than what the app expects for "today", potentially causing the stage filter to
exclude the seeded day and making the test fail intermittently. CLAUDE.md explicitly states
"Time strings are local wall-clock, never UTC."

**Fix:** Derive local date without UTC conversion:

```js
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
```

### WR-07: `page.waitForTimeout(500)` used instead of a condition-based wait

**File:** `tests/e2e/metrics.spec.js:382`

**Issue:** In the "zero days" boundary test, `await page.waitForTimeout(500)` is used to
"allow render to complete" before asserting that `.metricsTable` is absent. Fixed-time delays
are fragile: on slow CI runners 500 ms may not be sufficient; on fast machines it wastes time.
Playwright's own documentation explicitly discourages `waitForTimeout` in tests.

**Fix:** Replace with a condition-based wait. Since the empty-state element should appear when
there are no days, wait for it:

```js
// Instead of waitForTimeout(500):
await expect(page.locator('.emptyState')).toBeVisible();

// Then assert table is absent:
const tableCount = await page.locator('.metricsTable').count();
expect(tableCount).toBe(0);
```

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
