---
phase: 11-metrics-screen
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - index.html
  - js/app.js
  - js/lib/metrics.js
  - js/lib/time.js
  - js/ui/bottom-nav.js
  - js/ui/metrics-screen.js
  - style.css
  - sw.js
  - tests/e2e/metrics.spec.js
  - tests/unit/metrics.test.js
  - tests/unit/sw-precache.test.js
  - tests/unit/time.test.js
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 11 metrics screen implementation contains two critical bugs affecting data accuracy: date information loss in the metrics table display and incorrect date extraction for min/max aggregate values. The metrics.js pure function has correct logic for duration and ratio calculations, but the integration with the UI layer has data flow issues. Security posture is sound (no XSS vulnerabilities, proper adapter injection, SW precache complete). Test suite coverage exists but has logical inconsistencies.

## Critical Issues

### CR-01: Date Information Lost in Metrics Table Display

**File:** `js/ui/metrics-screen.js:174-180`

**Issue:** The date column extraction extracts the wrong data. The `dayMetrics.wake` and `dayMetrics.bedtime` values are time-only strings (`'HH:MM'` format, e.g., `'07:30'`), not ISO timestamps. Calling `.slice(0, 10)` on `'07:30'` returns `'07:30'` instead of a date. The date information was never captured in the row building phase.

Root cause: In `metrics.js` lines 155-157, the rows built by `aggregateMetrics()` populate only the time portion:
```javascript
wake: extractTime(day.wake) || null,  // '07:30', not '2026-05-01T07:30'
bedtime: extractTime(day.bedtime) || null,
```

The ISO date (`'2026-05-01'`) is extracted elsewhere but not stored in the row.

**Fix:** Capture the full ISO date in each row during aggregateMetrics:
```javascript
// In aggregateMetrics, around line 153-172, modify the row building:
rows.push({
  date: extractDate(day),  // new helper to extract 'YYYY-MM-DD'
  wake: extractTime(day.wake) || null,
  bedtime: extractTime(day.bedtime) || null,
  // ... rest of columns
});

// Add extractDate helper near extractTime (line 22-28):
function extractDate(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) return slot.at.slice(0, 10);
  // Synthetic test data has no date
  return null;
}
```

Then in metrics-screen.js, use the dedicated date field:
```javascript
const dateStr = dayMetrics.date || '—';  // line 176
```

---

### CR-02: Min/Max Date Extraction Fails for Nap-Dependent Metrics

**File:** `js/lib/metrics.js:183-230` (getDate helper and date mapping)

**Issue:** The `getDate()` function attempts to find the original day record to extract the date for min/max cells. However, the mapping is broken when metrics are aggregated over filtered subsets (napRows vs. validRows):

```javascript
// Line 210-211: finds index within the filtered rows passed to aggregateMetric
const minRowIdx = rows.findIndex(r => r[key] === minValue);
// ...
// Line 218: tries to find original day via validRows — but this fails for napRows metrics
const origDay = dayRecords[validRows.indexOf(row)];
```

When `aggregateMetric('napDuration', napRows)` is called:
1. `rows` parameter is `napRows` (a filtered subset)
2. `minRowIdx` is found within `napRows`
3. `validRows.indexOf(row)` searches for the row in `validRows` 
4. Even if found, the index in `validRows` ≠ index in `dayRecords` (due to rejected day filtering)

Result: `getDate()` returns `null` for all min/max values on nap-dependent metrics (napDuration, totalActivity, activityBeforeNap, activityAfterNap, activityAfterSleepFactor, sleepAfterActivityFactor).

**Fix:** Track the original dayRecords index when building rows. Modify aggregateMetrics:
```javascript
// Line 153-172: When building rows, store the original index
for (let i = 0; i < dayRecords.length; i++) {
  const day = dayRecords[i];
  rows.push({
    _dayRecordsIdx: i,  // store original index
    wake: extractTime(day.wake) || null,
    // ... rest of columns
  });
}

// Line 214-226: Use the stored index in getDate
const getDate = (rowIdx) => {
  const row = rows[rowIdx];
  if (!row || row._dayRecordsIdx === undefined) return null;
  const origDay = dayRecords[row._dayRecordsIdx];
  if (!origDay) return null;
  const timeStr = extractTime(origDay.wake) || extractTime(origDay.bedtime);
  if (origDay.wake && typeof origDay.wake === 'object' && origDay.wake.at) {
    return origDay.wake.at.slice(0, 10);
  }
  return null;
};
```

---

## Warnings

### WR-01: Contradictory E2E Test Logic

**File:** `tests/e2e/metrics.spec.js:49-58`

**Issue:** The test MET-06 has mutually exclusive assertions:
```javascript
test('MET-06: Stage filter badge shown/hidden based on active stage', async ({ page }) => {
  const stageBadge = page.locator('#metrics-screen .stageChip');
  await page.locator('[data-tab="metrics"]').click();
  await expect(stageBadge).toHaveAttribute('hidden', '');  // expects hidden

  // ... comment claims badge is visible but hidden attribute set ...
  await expect(stageBadge).toBeVisible(); // expects visible — contradicts line 53
});
```

An element with the `hidden` attribute set is not visible in the accessibility tree. The second `toBeVisible()` will fail if the first `toHaveAttribute('hidden', '')` passes. The test cannot pass both assertions.

**Fix:** Clarify test intent. If the goal is to verify the badge is hidden initially:
```javascript
test('MET-06: Stage filter badge hidden when no stage is active', async ({ page }) => {
  await page.locator('[data-tab="metrics"]').click();
  const stageBadge = page.locator('#metrics-screen .stageChip');
  // Verify hidden attribute
  await expect(stageBadge).toHaveAttribute('hidden', '');
  // Do NOT assert toBeVisible() — it contradicts the hidden state
});
```

---

### WR-02: Misleading Test Name vs. Assertion

**File:** `tests/unit/metrics.test.js:184-192`

**Issue:** Test name claims totalActivity should be 600 minutes, but assertion verifies 780 minutes:
```javascript
it('normal nap day: wake=07:00, napStart=12:00, napEnd=13:00, bedtime=21:00 → 600 (5h before + 8h after)', () => {
  // ... comments correctly state 780 ...
  assert.strictEqual(
    totalActivity(makeDay('07:00', '21:00', '12:00', '13:00')),
    780,  // correct value: 5h (300m) + 8h (480m) = 780m
  );
});
```

The assertion is correct (780 = 5h + 8h). The test name is wrong (says 600). This will confuse future maintainers.

**Fix:** Update the test name to match the correct value:
```javascript
it('normal nap day: wake=07:00, napStart=12:00, napEnd=13:00, bedtime=21:00 → 780 (5h before + 8h after)', () => {
```

---

## Info

### IN-01: CSS Z-Index Sticky Column Layout

**File:** `style.css:1620-1660`

**Finding:** Z-index layering for sticky columns is correctly specified:
- `.metricsTable th` (header row): `z-index: 2`
- `.metricsTable th:first-child` (top-left corner): `z-index: 3` (higher, correct)
- `.metricsTable td.sticky-col` (left column cells): `z-index: 1` (lower)

However, there is no visual testing or regression verification that the sticky positioning actually works correctly when:
- Scrolling horizontally while the top header remains sticky
- Scrolling vertically while the left column remains sticky
- Simultaneous horizontal + vertical scroll (top-left cell should appear above all others)

The CSS is theoretically correct, but the E2E test suite does not verify sticky behavior. Consider adding an E2E test that scrolls the metrics table and confirms the header/column positioning remains correct.

---

## Security & Code Quality Notes

**Positive findings:**

- ✓ **XSS prevention:** All dynamic content in metrics-screen.js uses `.textContent` (lines 73-150). No innerHTML with user-supplied data. Stage names, dates, and formatted values are safe.
- ✓ **Adapter injection:** No direct `new Date()` or `localStorage` calls in metrics.js or metrics-screen.js. Dependencies are injected.
- ✓ **Service worker precache:** sw.js includes `./js/lib/metrics.js` and `./js/ui/metrics-screen.js` in PRECACHE_LIST (lines 44, 60). sw-precache.test.js verifies completeness.
- ✓ **Division-by-zero guards:** metrics.js includes explicit checks (e.g., line 110: `|| sleep === 0`).
- ✓ **Null safety:** All pure functions check for null/undefined slots before computing durations.
- ✓ **Subscription cleanup:** mountMetricsScreen returns unsubscribe handles (lines 358-363) for proper lifecycle management.
- ✓ **Bottom nav registration:** 'metrics' tab is in VALID_TABS (bottom-nav.js:17) and properly wired in app.js (lines 143-145).

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
