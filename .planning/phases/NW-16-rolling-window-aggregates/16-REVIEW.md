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
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase NW-16: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files reviewed: the metrics-screen JS module (rolling-window aggregate rendering), the shared stylesheet, and the E2E test suite. The rolling-window section rendering logic for 7-day and 14-day tbodies is correct. One blocker was found: the All-time Min/Average/Max aggregate rows skip the TIF placeholder cell injection step that the rolling sections perform, producing a column-count mismatch whenever TIF is the active algorithm. Four warnings cover a stale column-index comment repeated in two docstrings, a missing `text-align` override on section-header cells, dark-theme fallback colors on the stage dropdown, and missing `id` fields on seeded test events.

## Structural Findings (fallow)

No structural pre-pass was provided for this phase.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: All-time Min/Average/Max rows missing 12 TIF placeholder cells when TIF is active

**File:** `js/ui/metrics-screen.js:638-644`

**Issue:** `buildRollingSection` (lines 451-458) appends 12 hidden `<td>` placeholder cells to each aggregate row after calling `buildAggregateRow`, keeping the column count at 18 + 12 = 30. The All-time section (lines 638-644) calls `buildAggregateRow` for Min, Average, and Max but never performs the equivalent injection. Those three rows end up with 18 cells while every other row in the table (header, rolling section rows, per-day rows, TIF rows) has 30. When TIF is enabled (`isTif === true`), the hidden attribute is removed from TIF column headers and TIF inline cells in per-day rows, making the column structure visible. The 12 missing cells in the All-time Min/Avg/Max rows cause those rows to visually misalign with the rest of the table.

The rolling section correctly does:
```javascript
// Step 8: append TIF placeholder cells to each row (D-05)
for (const row of [minRow, avgRow, maxRow]) {
  for (let j = 0; j < TIF_COLUMNS.length; j++) {
    const td = document.createElement('td');
    td.textContent = '—';
    td.hidden = !isTif;
    row.appendChild(td);
  }
}
```

The All-time section does not. No E2E test covers TIF-on rendering of the Metrics screen, so this is undetected by the test suite.

**Fix:** After appending minRow/avgRow/maxRow to `summaryTbody`, add the same TIF placeholder loop used in `buildRollingSection`:

```javascript
const avgRow = buildAggregateRow('Average', avg, snap);
const minRow = buildAggregateRow('Min', min, snap);
const maxRow = buildAggregateRow('Max', max, snap);

// Append TIF placeholder cells to all-time aggregate rows (D-05, mirrors buildRollingSection)
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

### WR-01: Stale "indices 1-15" comment appears in two docstrings; COLUMNS has 18 entries (indices 0-17)

**File:** `js/ui/metrics-screen.js:287` and `js/ui/metrics-screen.js:358`

**Issue:** Both `computeTifTrimmedStats` (line 287) and `buildTifAggregateRow` (line 358) document the column iteration as "indices 1–15". The COLUMNS array was extended to 18 elements (indices 0–17) when `napFraction` (MET-09), `dayToSleepFactor` (MET-07), and `amPmSplit` (MET-10) were added. The loop body `for (let i = 1; i < COLUMNS.length; i++)` is correct, but the stale comment creates a false mental model. A reader debugging these functions will count 15 columns and not find indices 16 and 17 (`amPmSplit`, `activityAfterSleepFactor`), leading to confusion about whether those columns are intentionally skipped.

**Fix:** Update both occurrences:
```
// Line 287 docstring: "each base metric column (indices 1–17)"
// Line 358 comment:   "Base COLUMNS (indices 1-17): show trimmed stat for each column"
```

### WR-02: `.metrics-section-header` inherits `text-align: right` — section labels appear right-aligned

**File:** `style.css:1733-1742`

**Issue:** The general rule `.metricsTable td { text-align: right }` (line 1694) applies to all `<td>` elements, including the full-width section-header cells. The new `.metrics-section-header` rule does not declare `text-align`, so it inherits `right`. A 30-column-spanning cell with `text-align: right` renders its label ("7-DAY ROLLING", "14-DAY ROLLING", "ALL-TIME") flush against the far-right edge of the table — a presentation defect on wide screens.

**Fix:** Add `text-align: left` to the section-header rule:
```css
.metricsTable td.metrics-section-header {
  background-color: #f1f5f9;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: #334155;
  padding: 6px 12px;
  letter-spacing: 0.05em;
  border-top: 2px solid #cbd5e1;
  text-align: left;   /* add this */
}
```

### WR-03: `.stage-select` uses dark-theme CSS variable fallbacks in a light-themed app

**File:** `style.css:1237-1241`

**Issue:** The `.stage-select` rule uses CSS variable references with fallback literals:
```css
border: 1px solid var(--color-border, #333);
background: var(--color-bg-input, #1a1a2e);
color: var(--color-text, #e0e0e0);
```
No CSS custom properties are defined anywhere in `style.css` or the app shell, so the fallback values are always used: `#1a1a2e` (very dark navy) background with `#e0e0e0` (light gray) text and `#333` border. This produces a dark-themed dropdown inside the light-themed app. Compare with other form controls that use `background: #fff` and `color: #334155`.

**Fix:** Replace the variable references with concrete light-theme values consistent with the rest of the UI:
```css
.stage-select {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  font-size: 0.875rem;
  cursor: pointer;
}
```

### WR-04: Seeded events in E2E tests are missing `id` fields — may silently bypass schema validation

**File:** `tests/e2e/metrics.spec.js:85-96` (and similar seed blocks at lines 187-213, 244-258, 283-298, 328-342, 399-416)

**Issue:** All test seed databases inject events without an `id` field, e.g.:
```javascript
events: [
  { type: 'wake',    at: todayISO + 'T08:00' },
  { type: 'bedtime', at: todayISO + 'T22:00' }
],
```
`js/lib/id.js` mints IDs via `crypto.randomUUID()` at log time. The schema validator in `db-shape.js` may enforce `id` presence on import. If validation rejects or silently drops the seeded events, the tests will test an empty-state path while believing they are testing a populated table. Even if the current validator is lenient on import, any future tightening of schema validation will silently break all six seeded tests simultaneously. The correct fix is to include `id` in all seeded events.

**Fix:** Add stable synthetic IDs to all seeded events:
```javascript
events: [
  { id: 'test-wake-1',    type: 'wake',    at: todayISO + 'T08:00' },
  { id: 'test-bedtime-1', type: 'bedtime', at: todayISO + 'T22:00' },
],
```

## Info

### IN-01: Redundant null/undefined guards in `formatCellValue` after early-return guard

**File:** `js/ui/metrics-screen.js:139-148`

**Issue:** Line 137 performs an early return for `null` and `undefined`:
```javascript
if (value === null || value === undefined) return '—';
```
The subsequent branch conditions repeat those checks:
```javascript
} else if (colDef.isRatio && value !== null && value !== undefined) {
} else if (!colDef.isTime && !colDef.isRatio && value !== null && value !== undefined) {
```
These inner checks are always true at that point (the early return already excluded null/undefined). Leaving them in makes the function harder to reason about (a reader must trace the guard to confirm they are dead checks) and creates a slight risk that a future editor inserts code between line 137 and line 139 in a way that breaks the invariant.

**Fix:** Remove the redundant guards from the `else if` branches:
```javascript
function formatCellValue(value, colDef, snap) {
  if (value === null || value === undefined) return '—';
  if (colDef.isTime)  return formatTime(value, snap.timeFormat);
  if (colDef.isRatio) return value.toFixed(2);
  return formatDuration(value); // duration columns
}
```

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
