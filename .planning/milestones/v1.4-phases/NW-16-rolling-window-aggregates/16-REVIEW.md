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
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase NW-16: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 16 adds 7-day and 14-day rolling-window aggregate sections to the Metrics screen, plus the
supporting CSS for section-header rows and the E2E test suite. The XSS guard (`textContent`-only)
is consistently maintained. No critical or security findings. Five warnings were found: one dead
import, one global variable shadowing, one rolling-window sample inconsistency between the new TIF
aggregate rows and the rolling aggregate rows, one truthy-check bug in a formatting utility, and one
E2E test that is structurally unsound because it never seeds data. Three info-level items follow.

---

## Warnings

### WR-01: Dead import — `activityAfterSleepFactor` never called

**File:** `js/ui/metrics-screen.js:18`
**Issue:** `activityAfterSleepFactor` is imported from `../lib/metrics.js` but is never invoked
anywhere in the module. The string literal `'activityAfterSleepFactor'` appears only as a column
key in the COLUMNS array (line 60). The column's runtime value is populated by `aggregateMetrics`,
not by a direct call to this function. The import is dead code.
**Fix:** Remove `activityAfterSleepFactor` from the import statement:
```js
import {
  aggregateMetrics,
} from '../lib/metrics.js';
```

---

### WR-02: Variable name `window` shadows the browser global

**File:** `js/ui/metrics-screen.js:294`
**Issue:** `computeTifTrimmedStats` declares `const window = rows.slice(-windowSize).filter(...)`.
ES modules run in strict mode and allow this, but naming a local array `window` shadows the
browser's `window` global for the remainder of the function. Any future reader or contributor who
adds a `window.*` reference inside this function (e.g., `window.matchMedia`) would silently operate
on the array rather than the global, producing a runtime crash. The name is also semantically
misleading because `windowSize` is already in scope.
**Fix:** Rename to `rollingRows` or `windowRows`:
```js
const rollingRows = rows.slice(-windowSize).filter(r => !r.rejected);
```

---

### WR-03: TIF aggregate rows computed over a different sample set than rolling aggregate rows

**File:** `js/ui/metrics-screen.js:288-333` (computeTifTrimmedStats) vs `js/ui/metrics-screen.js:421-467` (buildRollingSection)
**Issue:** The two sections that compute rolling-window statistics use incompatible selection logic
when rejected days exist within the window period:

- `buildRollingSection` receives `nonRejectedDays` (already rejection-filtered) and takes
  `nonRejectedDays.slice(-nDays)` — always exactly N non-rejected days.
- `computeTifTrimmedStats` takes `rows.slice(-windowSize)` first (last N rows including rejected),
  then filters rejected within that slice — yielding **fewer than N samples** whenever rejected
  days fall inside the window.

Concretely: with `tifRollingDays = 7` and 2 rejected days among the 7 most recent, the Min/Avg/Max
rolling rows compute over 7 non-rejected days while the min-TIF/median-TIF/max-TIF rows compute
over only 5. The divergence is invisible to the user and gives the TIF aggregate rows a narrower
effective sample window than the regular aggregate rows in the same table.

**Fix:** Derive `rollingRows` from `nonRejectedDays` (already pre-filtered) instead of from `rows`:
```js
// In computeTifTrimmedStats, change the parameter from `rows` to `nonRejectedRows`
// and remove the .filter() step.
function computeTifTrimmedStats(nonRejectedRows, snap) {
  const windowSize = snap.tifRollingDays ?? 7;
  const trimPct    = snap.trimPct ?? 10;
  const rollingRows = nonRejectedRows.slice(-windowSize); // already rejection-filtered
  ...
}
```
And update the call site (line 561):
```js
const tifTrimmedStats = isTif ? computeTifTrimmedStats(nonRejectedDays, snap) : null;
```

---

### WR-04: `formatCellValue` — truthy check skips time-branch for falsy non-null values

**File:** `js/ui/metrics-screen.js:139`
**Issue:** After the null/undefined guard on line 137, line 139 reads:
```js
if (colDef.isTime && value) {
```
The `&& value` is a truthy test, not a nullish test. Any falsy but non-null value — empty string
`""`, or numeric `0` — for a time column bypasses `formatTime` and falls to the final `else`
branch (`return String(value)`), producing an empty string or `"0"` in the cell instead of the
`'—'` placeholder. The null guard above only covers `null` and `undefined`.

In the current data flow from `aggregateMetrics`, time fields are either `null` or proper `'HH:MM'`
strings, so the bug is not triggered in production today. But it is a correctness hazard for any
future call path that may supply `""` for a missing time.

**Fix:** Replace the truthy check with a strict null check (value is already proven non-null/undefined):
```js
if (colDef.isTime) {
  return formatTime(value, snap.timeFormat);
}
```

---

### WR-05: MET-02/MET-03 E2E test never seeds data — structurally flaky

**File:** `tests/e2e/metrics.spec.js:22-48`
**Issue:** Every other rolling-window test seeds an explicit database via `page.evaluate(() =>
localStorage.setItem(...))` before asserting. The MET-02/MET-03 test instead does:
```js
const wakeBtn = page.locator('[data-log="wake"]');
await wakeBtn.click();
// If manual entry dialog opens, skip it (use quick-log if available)
// For now, assume quick-log was used and data exists
```
Clicking `[data-log="wake"]` opens the manual-entry dialog in the real app. The test does not
interact with the dialog, so no event is saved. The test then navigates to Metrics and asserts
`await expect(table).toBeVisible()`. This assertion silently relies on leftover localStorage from a
previous test session. On a clean run (e.g., fresh Playwright context, CI with isolated storage),
the metrics screen shows the empty state instead of a table, and the assertion fails.

The test also claims to verify MET-02 and MET-03 (column count and data correctness) but the
comment `// For now, assume quick-log was used and data exists` acknowledges the assumption without
addressing it.

**Fix:** Seed data the same way the other tests do, before clicking the Metrics tab:
```js
const seedDb = {
  version: 2,
  settings: {
    cutoverHour: 4, timeFormat: '24h', maxDelta: 30, minDays: 1,
    windowDays: 7, statBlend: 'median', autoOutlier: false,
    groupingMode: 'calendar', rejectedDays: [], stages: [],
    activeStageId: null, forecastAlgorithm: 'classic',
  },
  events: [
    { id: 'met02-wake-1',    type: 'wake',    at: '2025-06-01T08:00' },
    { id: 'met02-bedtime-1', type: 'bedtime', at: '2025-06-01T22:00' },
  ],
  activityLog: {},
};
await page.evaluate((data) => {
  localStorage.setItem('nightwatch:db', JSON.stringify(data));
}, seedDb);
await page.reload();
await page.waitForSelector('[data-tab="today"]');
```
Then proceed with the metrics-tab navigation and assertions.

---

## Info

### IN-01: COLUMNS module comment says "16-column" but array has 18 entries

**File:** `js/ui/metrics-screen.js:32`
**Issue:** The JSDoc comment reads "Column definitions for the 16-column metrics table" and lists
16 columns in the `* Order:` line, omitting `maSleepRatio` (MA/Sl, index 12) and `maNapRatio`
(MA/Nap, index 13). The actual array has 18 entries. The E2E test (line 41) correctly asserts
`expect(count).toBe(30)` with comment "18 base + 12 TIF inline columns", confirming the array
count is right and the comment is stale.
**Fix:** Update the doc comment to say "18-column" and add MA/Sl and MA/Nap to the order list.

---

### IN-02: Redundant null checks in `formatCellValue` after early-return guard

**File:** `js/ui/metrics-screen.js:141,143`
**Issue:** Lines 141 and 143 re-check `value !== null && value !== undefined` after line 137
already returns `'—'` for those cases. The re-checks are dead code.
**Fix:** Remove the redundant conditions:
```js
} else if (colDef.isRatio) {
  return value.toFixed(2);
} else if (!colDef.isTime && !colDef.isRatio) {
  return formatDuration(value);
}
```

---

### IN-03: `waitForTimeout(500)` in empty-state E2E test is fragile

**File:** `tests/e2e/metrics.spec.js:376`
**Issue:** The empty-state boundary test uses `await page.waitForTimeout(500)` to wait for the
render to complete after clicking the Metrics tab. The subsequent assertion already uses
`await expect(page.locator('.emptyState')).toBeVisible()` which carries Playwright's built-in
retry timeout. The fixed 500ms delay is therefore redundant and will silently mis-fail on a slow
CI machine if rendering exceeds 500ms.
**Fix:** Remove the `waitForTimeout` line and rely solely on the selector-based assertion:
```js
await page.locator('[data-tab="metrics"]').click();
// No waitForTimeout — let toBeVisible() retry until its own timeout
await expect(page.locator('.emptyState')).toBeVisible();
```

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
