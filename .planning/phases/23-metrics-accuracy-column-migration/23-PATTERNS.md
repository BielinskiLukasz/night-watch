# Phase 23: Metrics→Accuracy Column Migration - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 4 files (2 modified UI modules, 2 test specs)
**Analogs found:** 4/4 with exact match quality

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `js/ui/metrics-screen.js` | ui | request-response | (current file) | self-analog |
| `js/ui/accuracy-screen.js` | ui | request-response | (current file) | self-analog |
| `tests/e2e/metrics.spec.js` | test | request-response | (current file) | self-analog |
| `tests/e2e/accuracy-screen.spec.js` | test | request-response | (current file) | self-analog |

---

## Pattern Assignments

### `js/ui/metrics-screen.js` (ui, request-response) — Column Removal

**Scope:** Delete TIF_COLUMNS constant and all rendering sites that reference it.

**Analog:** `js/ui/metrics-screen.js` itself — existing structure that must be surgically cleaned.

**TIF_COLUMNS constant location** (lines 74–87):
```javascript
const TIF_COLUMNS = Object.freeze([
  { key: 'wake_tif_min',      label: 'W-min',   isTime: true,  isRatio: false, tif: true },
  { key: 'wake_tif_max',      label: 'W-max',   isTime: true,  isRatio: false, tif: true },
  { key: 'wake_tif_conf',     label: 'W-conf',  isTime: false, isRatio: true,  tif: true },
  { key: 'napStart_tif_min',  label: 'NS-min',  isTime: true,  isRatio: false, tif: true },
  { key: 'napStart_tif_max',  label: 'NS-max',  isTime: true,  isRatio: false, tif: true },
  { key: 'napStart_tif_conf', label: 'NS-conf', isTime: false, isRatio: true,  tif: true },
  { key: 'napEnd_tif_min',    label: 'NE-min',  isTime: true,  isRatio: false, tif: true },
  { key: 'napEnd_tif_max',    label: 'NE-max',  isTime: true,  isRatio: false, tif: true },
  { key: 'napEnd_tif_conf',   label: 'NE-conf', isTime: false, isRatio: true,  tif: true },
  { key: 'bedtime_tif_min',   label: 'B-min',   isTime: true,  isRatio: false, tif: true },
  { key: 'bedtime_tif_max',   label: 'B-max',   isTime: true,  isRatio: false, tif: true },
  { key: 'bedtime_tif_conf',  label: 'B-conf',  isTime: false, isRatio: true,  tif: true },
]);
```
**Action per D-09:** Delete this entire constant.

**computeTifBoundsHistory import** (line 24):
```javascript
import { computeTifBoundsHistory } from '../lib/accuracy-tif.js';
```
**Action per D-10:** Delete this import line (no longer needed in metrics-screen.js; accuracy-screen.js retains it).

**buildDayRow TIF-cell loop** (lines 225–246):
Current code pattern (to be REMOVED from metrics-screen.js):
```javascript
// TIF inline cells (MET-08, D-11) — T-11-05: textContent only
const tifEntry = tifBoundsMap ? tifBoundsMap.get(dayMetrics.date) : null;
for (const col of TIF_COLUMNS) {
  const td = document.createElement('td');
  td.hidden = !isTif;
  let cellText = '—';
  if (tifEntry) {
    // col.key format: '{eventType}_tif_{field}' e.g. 'wake_tif_min', 'napStart_tif_conf'
    // split('_tif_') → [eventType, field]; works for all keys including 'napStart_tif_min'
    const parts = col.key.split('_tif_');
    const eventType = parts[0]; // 'wake', 'napStart', 'napEnd', 'bedtime'
    const field     = parts[1]; // 'min', 'max', 'conf'
    const bounds = tifEntry[eventType];
    if (bounds) {
      if (field === 'min')       cellText = formatTime(bounds.algMin, snap.timeFormat);
      else if (field === 'max')  cellText = formatTime(bounds.algMax, snap.timeFormat);
      else if (field === 'conf') cellText = bounds.precisionScore != null ? bounds.precisionScore.toFixed(2) : '—';
    }
  }
  td.textContent = cellText; // T-11-05: textContent only
  tr.appendChild(td);
}
```
**Action per D-09:** Delete this entire loop from `buildDayRow` (approximately 22 lines).

**buildDayRow signature update** (line 203):
Current:
```javascript
function buildDayRow(dayMetrics, snap, tifBoundsMap, isTif) {
```
Update per D-10 to remove `tifBoundsMap` and `isTif` parameters (both unused after TIF loop removal):
```javascript
function buildDayRow(dayMetrics, snap) {
```
Find all call sites of `buildDayRow` and remove the `tifBoundsMap` and `isTif` arguments.

**buildTifAggregateRow TIF placeholder cells** (lines 355–382, see context around line ~268-279 for th loop):
```javascript
function buildTifAggregateRow(label, aggregateData, snap) {
  // ... existing base columns loop ...
  
  // TIF placeholder cells (to be DELETED per D-09)
  for (let i = 0; i < TIF_COLUMNS.length; i++) {
    const td = document.createElement('td');
    td.hidden = !isTif;
    td.textContent = '—';
    tr.appendChild(td);
  }
  
  return tr;
}
```
**Action per D-09:** Delete the TIF placeholder loop from `buildTifAggregateRow` (approximately 6 lines). Also update signature to remove `isTif` parameter if it was passed.

**buildRollingSection placeholder loops** (line ~428+):
```javascript
function buildRollingSection(label, nDays, nonRejectedDays, snap, isTif) {
  // ... existing section structure ...
  
  // TIF placeholder cells in per-day rows (to be DELETED per D-09)
  for (let i = 0; i < TIF_COLUMNS.length; i++) {
    const td = document.createElement('td');
    td.hidden = !isTif;
    td.textContent = '—';
    tr.appendChild(td);
  }
  
  // ... and similar loop for aggregate row placeholders ...
}
```
**Action per D-09:** Delete both TIF placeholder cell loops from `buildRollingSection`.

**Table header-building loop** (line ~762):
```javascript
// TIF column headers (to be DELETED per D-09)
for (const col of TIF_COLUMNS) {
  const th = document.createElement('th');
  th.hidden = !isTif;
  th.textContent = col.label;
  headerRow.appendChild(th);
}
```
**Action per D-09:** Delete this entire loop that appends TIF column headers.

**Summary section placeholder loop** (lines 782–791, see context around aggregate summary rows):
```javascript
// TIF placeholder cells in summary rows (to be DELETED per D-09)
for (let i = 0; i < TIF_COLUMNS.length; i++) {
  const td = document.createElement('td');
  td.hidden = !isTif;
  td.textContent = '—';
  tr.appendChild(td);
}
```
**Action per D-09:** Delete this loop from the summary section.

**render() function: tifBoundsArray/tifBoundsMap construction** (lines ~704–705):
Current code (to be REMOVED per D-10):
```javascript
const tifBoundsArray = computeTifBoundsHistory(days, snap, activityLog);
const tifBoundsMap = new Map(tifBoundsArray.map(entry => [entry.date, entry]));
```
And the reference in `buildDayRow` call:
```javascript
const tr = buildDayRow(dayMetrics, snap, tifBoundsMap, isTif);
```
**Action per D-10:** Delete both lines; update the `buildDayRow` call to pass only `(dayMetrics, snap)`.

---

### `js/ui/accuracy-screen.js` (ui, request-response) — New Per-Day Table Addition

**Scope:** Add new per-day TIF window table inside `renderTifAccuracy()`, below the existing TIF summary table.

**Analog:** `js/ui/accuracy-screen.js` itself — existing `buildTifAccuracyGrid` structure (lines 267–353) and `renderTifAccuracy` function (lines 441–451).

**Key reusable asset from metrics-screen.js:** The TIF-cell-parsing logic from `buildDayRow` (lines 225–246) shows the exact pattern for extracting bounds from `tifEntry` and formatting them — this pattern will be ported to the new per-day table builder in accuracy-screen.js.

#### New Per-Day Table Structure

**Function signature to add (Claude's Discretion):**
```javascript
/**
 * Build a per-day TIF window table showing min/max/confidence for each event type.
 *
 * Returns a <table> matching buildTifAccuracyGrid's structure (thead + tbody).
 * Rows are most-recent-first (reversed from chronological storage).
 * Columns: Date (sticky-left) | Wake min | Wake max | Wake conf | ... | Bedtime conf.
 *
 * @param {Array<{date:string, wake:TifBounds|null, ...}>} tifBoundsHistory from computeTifBoundsHistory
 * @param {Array<object>} days stage-filtered day records (for rejected flag lookup per D-07)
 * @param {object} snap settings snapshot
 * @returns {HTMLTableElement}
 */
function buildTifPerDayTable(tifBoundsHistory, days, snap) {
  // ...
}
```

**Table structure pattern** (adapted from buildTifAccuracyGrid, lines 267–353):
```javascript
function buildTifPerDayTable(tifBoundsHistory, days, snap) {
  const table = document.createElement('table');

  // ---- thead: Date | W-min | W-max | W-conf | NS-min | ... | B-conf ----
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const dateHeader = document.createElement('th');
  dateHeader.className = 'sticky-col';
  // T-07-06-01: textContent only — static string.
  dateHeader.textContent = 'Date';
  headerRow.appendChild(dateHeader);

  // Define column list (Claude's Discretion on naming; reuse metrics-screen.js TIF_COLUMNS structure):
  const perDayColumns = [
    { eventType: 'wake', field: 'min', label: 'W-min' },
    { eventType: 'wake', field: 'max', label: 'W-max' },
    { eventType: 'wake', field: 'conf', label: 'W-conf' },
    { eventType: 'napStart', field: 'min', label: 'NS-min' },
    { eventType: 'napStart', field: 'max', label: 'NS-max' },
    { eventType: 'napStart', field: 'conf', label: 'NS-conf' },
    { eventType: 'napEnd', field: 'min', label: 'NE-min' },
    { eventType: 'napEnd', field: 'max', label: 'NE-max' },
    { eventType: 'napEnd', field: 'conf', label: 'NE-conf' },
    { eventType: 'bedtime', field: 'min', label: 'B-min' },
    { eventType: 'bedtime', field: 'max', label: 'B-max' },
    { eventType: 'bedtime', field: 'conf', label: 'B-conf' },
  ];

  for (const col of perDayColumns) {
    const th = document.createElement('th');
    // T-07-06-01: textContent only — static column label.
    th.textContent = col.label;
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ---- tbody: one tr per date (most-recent-first per D-05) ----
  const tbody = document.createElement('tbody');

  // Build rejected-day lookup map per D-07
  const rejectedByDate = new Map(days.map(d => [d.date, d.rejected || false]));

  // Reverse for most-recent-first (metrics-screen convention D11-03)
  const reversed = [...tifBoundsHistory].reverse();

  for (const tifEntry of reversed) {
    const tr = document.createElement('tr');

    // Apply rejected dimming per D-07 (same .rejected class as Metrics screen)
    if (rejectedByDate.get(tifEntry.date)) {
      tr.classList.add('rejected');
    }

    // Date cell (sticky-left per D-05)
    const dateCell = document.createElement('td');
    dateCell.className = 'sticky-col';
    // T-07-06-01: textContent only — date is from data.
    dateCell.textContent = tifEntry.date || '—';
    tr.appendChild(dateCell);

    // Per-event-type cells (min, max, conf)
    for (const col of perDayColumns) {
      const td = document.createElement('td');
      let cellText = '—';

      const bounds = tifEntry[col.eventType];
      if (bounds) {
        if (col.field === 'min') {
          // T-11-05: textContent only — formatTime returns formatted string
          cellText = formatTime(bounds.algMin, snap.timeFormat);
        } else if (col.field === 'max') {
          cellText = formatTime(bounds.algMax, snap.timeFormat);
        } else if (col.field === 'conf') {
          // D-05: Confidence score formatted as 2 decimals, or '—' if missing
          cellText = bounds.precisionScore != null ? bounds.precisionScore.toFixed(2) : '—';
        }
      }

      // T-07-06-01: textContent only
      td.textContent = cellText;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}
```

**Integration into renderTifAccuracy()** (lines 441–451):
Current code:
```javascript
function renderTifAccuracy(root, tifStats, snap) {
  const section = document.createElement('section');
  section.className = 'accuracy-section';
  const h2 = document.createElement('h2');
  // T-07-06-01: textContent only — static string.
  h2.textContent = 'TIF Accuracy';
  section.appendChild(h2);
  const grid = buildTifAccuracyGrid(tifStats, snap);
  section.appendChild(grid);
  root.replaceChildren(section);
}
```

Update per D-02/D-03 to include the new per-day table:
```javascript
function renderTifAccuracy(root, tifStats, snap, tifBoundsHistory, days) {
  const section = document.createElement('section');
  section.className = 'accuracy-section';

  // Existing TIF summary heading + grid
  const h2 = document.createElement('h2');
  // T-07-06-01: textContent only — static string.
  h2.textContent = 'TIF Accuracy';
  section.appendChild(h2);
  const grid = buildTifAccuracyGrid(tifStats, snap);
  section.appendChild(grid);

  // NEW per D-02/D-03: Sub-heading + per-day table
  const h3 = document.createElement('h3');
  // T-07-06-01: textContent only — static string.
  // Claude's Discretion: heading text, e.g. "Per-Day TIF Windows"
  h3.textContent = 'Per-Day TIF Windows';
  section.appendChild(h3);
  const perDayTable = buildTifPerDayTable(tifBoundsHistory, days, snap);
  section.appendChild(perDayTable);

  root.replaceChildren(section);
}
```

**Update call site in render()** (lines 458–495, around line 489):
Current:
```javascript
const tifBoundsHistory = computeTifBoundsHistory(days, snap, activityLog);
const tifStats = computeTifAccuracy(tifBoundsHistory, days);
renderTifAccuracy(root, tifStats, snap);
```

Update per D-02 to pass tifBoundsHistory and days:
```javascript
const tifBoundsHistory = computeTifBoundsHistory(days, snap, activityLog);
const tifStats = computeTifAccuracy(tifBoundsHistory, days);
renderTifAccuracy(root, tifStats, snap, tifBoundsHistory, days);
```

---

### `tests/e2e/metrics.spec.js` (test, request-response)

**Analog:** `tests/e2e/metrics.spec.js` itself — existing test assertions that must be updated.

**Key assertion to update** (lines 54–59 current):
Current test assertion (to be UPDATED per D-09):
```javascript
// Check column headers exist: 19 base columns + 12 TIF inline columns = 31 total.
// TIF columns are hidden (hidden attribute) when TIF is not active but still in DOM.
// Phase 18 added S.Debt (MET-14) between Comb and Day Len → 19 base columns.
const headerCells = page.locator('.metricsTable th');
const count = await headerCells.count();
expect(count).toBe(31); // 19 base + 12 TIF inline columns (Phase 14 + Phase 18 layout)
```

Update per D-09 (TIF columns removed from Metrics):
```javascript
// Check column headers exist: 19 base columns only (TIF columns moved to Accuracy screen).
// Phase 18 added S.Debt (MET-14) between Comb and Day Len → 19 base columns.
// Phase 23 removes TIF inline columns from Metrics → 19 columns only.
const headerCells = page.locator('.metricsTable th');
const count = await headerCells.count();
expect(count).toBe(19); // 19 base columns (TIF columns moved to Accuracy screen per D-09)
```

**Secondary assertion to add** (new test or new expect() block):
```javascript
// Verify that Metrics table no longer has TIF columns with 'W-min', 'W-max', etc.
const headerTexts = await page.locator('.metricsTable th').allTextContents();
// TIF column labels should NOT be present
expect(headerTexts).not.toContain('W-min');
expect(headerTexts).not.toContain('W-max');
expect(headerTexts).not.toContain('W-conf');
// ... etc. for all 12 TIF columns
```

---

### `tests/e2e/accuracy-screen.spec.js` (test, request-response)

**Analog:** `tests/e2e/accuracy-screen.spec.js` itself — existing test structure that must be extended.

**Add new test section per D-01/D-02/D-05** (integrate into the TIF mode test block):
```javascript
test('UI-11/D-01..D-07: TIF mode includes new per-day table with 12 columns', async ({ page }) => {
  // Precondition: seed with TIF algorithm active, enough days for TIF rolling window
  const seedDb = {
    version: 2,
    settings: {
      // ... full settings object with forecastAlgorithm: 'tif' ...
      forecastAlgorithm: 'tif',
      trimPct: 10,
      precisionTarget: 60,
      tifRollingDays: 7,
      // ... other required fields ...
    },
    events: [
      // Seed with 15+ days of wake/bedtime events so TIF window computes
      // (use helper from accuracy-screen.spec.js's makeEvents function)
    ],
    activityLog: {},
  };
  await page.evaluate((data) => {
    localStorage.setItem('nightwatch:db', JSON.stringify(data));
  }, seedDb);
  await page.reload();
  await page.waitForSelector('[data-tab="today"]');

  // Navigate to Accuracy tab
  await page.locator('[data-tab="accuracy"]').click();

  // Verify section heading "TIF Accuracy" exists (D-01)
  const tifHeading = page.locator('section.accuracy-section h2');
  await expect(tifHeading).toContainText('TIF Accuracy');

  // Verify new sub-heading "Per-Day TIF Windows" or similar (D-03)
  const perDayHeading = page.locator('section.accuracy-section h3');
  await expect(perDayHeading).toBeVisible();
  // Claude's Discretion: assert text matches chosen heading

  // Verify new per-day table exists below the summary grid (D-02)
  const perDayTable = page.locator('section.accuracy-section table:nth-of-type(2)');
  // (assume first table is TIF summary from buildTifAccuracyGrid)
  await expect(perDayTable).toBeVisible();

  // Verify table has correct column count: Date (sticky) + 12 TIF columns = 13 columns
  const headerCells = perDayTable.locator('thead th');
  const colCount = await headerCells.count();
  expect(colCount).toBe(13); // 1 date + 12 TIF (4 events × 3 fields: min, max, conf)

  // Verify expected column labels (D-05 format: W-min, W-max, etc.)
  const headerTexts = await perDayTable.locator('thead th').allTextContents();
  expect(headerTexts).toContain('Date');
  expect(headerTexts).toContain('W-min');
  expect(headerTexts).toContain('W-max');
  expect(headerTexts).toContain('W-conf');
  expect(headerTexts).toContain('NS-min');
  expect(headerTexts).toContain('NS-max');
  expect(headerTexts).toContain('NS-conf');
  expect(headerTexts).toContain('NE-min');
  expect(headerTexts).toContain('NE-max');
  expect(headerTexts).toContain('NE-conf');
  expect(headerTexts).toContain('B-min');
  expect(headerTexts).toContain('B-max');
  expect(headerTexts).toContain('B-conf');

  // Verify data rows render (D-06: full history, most-recent-first per D-05)
  const dataRows = perDayTable.locator('tbody tr');
  const rowCount = await dataRows.count();
  expect(rowCount).toBeGreaterThan(0); // At least one row

  // Verify Date column is sticky (first column class)
  const firstRowDateCell = dataRows.first().locator('td').first();
  await expect(firstRowDateCell).toHaveClass(/sticky-col/);

  // D-07: Verify rejected days are dimmed (if rejectedDays settings includes any)
  // Optional: if seedDb.settings.rejectedDays has entries, verify .rejected class on matching rows
});
```

**Add test for Metrics table TIF column removal** (integrate into existing Metrics table tests):
```javascript
test('D-09: Metrics table no longer has TIF columns after migration', async ({ page }) => {
  // Navigate to Metrics tab
  await page.locator('[data-tab="metrics"]').click();

  // Verify TIF column headers are absent (D-09)
  const headerTexts = await page.locator('.metricsTable th').allTextContents();
  expect(headerTexts).not.toContain('W-min');
  expect(headerTexts).not.toContain('W-conf');
  // Verify 19-column count, not 31
  const headerCells = page.locator('.metricsTable th');
  const count = await headerCells.count();
  expect(count).toBe(19);

  // Verify TIF columns appear on Accuracy screen when TIF is active, not on Metrics
  await page.locator('[data-tab="accuracy"]').click();
  const accuracyPerDayTable = page.locator('section.accuracy-section table:nth-of-type(2)');
  const accuracyHeaders = await accuracyPerDayTable.locator('thead th').allTextContents();
  expect(accuracyHeaders).toContain('W-min');
  expect(accuracyHeaders).toContain('W-conf');
});
```

---

## Shared Patterns

### Table Cell Formatting Pattern

**Source:** `js/ui/metrics-screen.js` (buildDayRow, lines 225–246) and `js/ui/accuracy-screen.js` (buildTifAccuracyGrid, lines 311–343)

**Apply to:** New `buildTifPerDayTable` function (accuracy-screen.js)

```javascript
// For time fields (min, max):
cellText = formatTime(bounds.algMin, snap.timeFormat); // e.g., '07:30' or '7:30 AM'

// For confidence/ratio fields:
cellText = bounds.precisionScore != null ? bounds.precisionScore.toFixed(2) : '—';

// For missing data:
cellText = '—'; // em-dash constant, not hyphen
```

### Rejected Day Dimming Pattern

**Source:** `js/ui/metrics-screen.js` (buildDayRow, lines 206–208) and metrics table CSS

**Apply to:** New `buildTifPerDayTable` function (accuracy-screen.js)

```javascript
// Lookup rejected flag from days array and apply .rejected class
if (rejectedByDate.get(tifEntry.date)) {
  tr.classList.add('rejected'); // CSS handles visual dimming
}
```

### XSS Guard Pattern

**Source:** CLAUDE.md §Security invariants (T-07-06-01, T-11-05)

**Apply to:** All new DOM rendering in accuracy-screen.js

```javascript
// ALWAYS use textContent, never innerHTML, for any dynamic content
td.textContent = cellText;  // GOOD — safe
// td.innerHTML = `<span>${cellText}</span>`;  // BAD — XSS risk

// Static HTML structure (headers, table containers) via createElement/appendChild is safe
// but all text from data/settings must go through textContent.
```

### Table Structure Pattern

**Source:** `js/ui/accuracy-screen.js` (buildTifAccuracyGrid, lines 267–353)

**Apply to:** New `buildTifPerDayTable` function

```javascript
// 1. Create table, thead, tbody
const table = document.createElement('table');
const thead = document.createElement('thead');
const tbody = document.createElement('tbody');

// 2. Build header row with th elements
const headerRow = document.createElement('tr');
for (const col of columnDefs) {
  const th = document.createElement('th');
  th.textContent = col.label; // T-07-06-01: textContent only
  headerRow.appendChild(th);
}
thead.appendChild(headerRow);
table.appendChild(thead);

// 3. Build data rows
for (const entry of dataArray) {
  const tr = document.createElement('tr');
  // Build td cells for each column
  tbody.appendChild(tr);
}
table.appendChild(tbody);

return table;
```

### Stage Badge Pattern (Reusable Existing Code)

**Source:** `js/ui/accuracy-screen.js` (renderStageBadge, lines not yet shown but referenced in Phase 22 PATTERNS.md)

**Apply to:** No changes to accuracy-screen.js stage badge — it already exists and needs no update per D-02. Metrics screen stage badge also unchanged.

---

## No Analog Found

N/A — all patterns are derived from existing code in metrics-screen.js and accuracy-screen.js.

---

## Metadata

**Analog search scope:** `js/ui/metrics-screen.js`, `js/ui/accuracy-screen.js`, `tests/e2e/`
**Files scanned:** 2 UI modules, 2 test specs
**Pattern extraction date:** 2026-09-17

---

## Key Implementation Notes

### D-09 Removal Checklist (metrics-screen.js)

1. Delete `TIF_COLUMNS` constant (lines 74–87)
2. Delete `computeTifBoundsHistory` import (line 24)
3. Delete TIF-cell loop in `buildDayRow` (lines 225–246)
4. Update `buildDayRow` signature to remove `tifBoundsMap`, `isTif` parameters
5. Delete TIF placeholder loop in `buildTifAggregateRow`
6. Delete two TIF placeholder loops in `buildRollingSection`
7. Delete TIF header-building loop (line ~762)
8. Delete TIF placeholder loop in summary section (lines 782–791)
9. Delete `tifBoundsArray`/`tifBoundsMap` construction in `render()` (lines ~704–705)
10. Update all `buildDayRow`, `buildTifAggregateRow`, `buildRollingSection` call sites to remove TIF arguments

### D-02/D-03/D-05 Addition Checklist (accuracy-screen.js)

1. Add new `buildTifPerDayTable(tifBoundsHistory, days, snap)` function
2. Update `renderTifAccuracy()` to include:
   - New `<h3>` sub-heading (Claude's Discretion: "Per-Day TIF Windows" or similar)
   - Call to `buildTifPerDayTable` and append result
3. Update `render()` function's TIF branch to pass `tifBoundsHistory` and `days` to `renderTifAccuracy`
4. Add rejected-flag lookup map in `buildTifPerDayTable` (D-07)
5. Import `formatTime` if not already imported (already imported per line 1–34)

### D-05 Convention: Most-Recent-First Ordering

Accuracy screen's per-day table must reverse `tifBoundsHistory` before rendering (same as Metrics screen):
```javascript
const reversed = [...tifBoundsHistory].reverse();
for (const tifEntry of reversed) { ... }
```

### D-07 Rejected-Day Lookup

Since `computeTifBoundsHistory`'s returned entries don't carry a `rejected` flag, cross-reference the date against the `days` array (already passed to `renderTifAccuracy`):
```javascript
const rejectedByDate = new Map(days.map(d => [d.date, d.rejected || false]));
```

### D-11 CSS Verification

Per D-11, no CSS changes are anticipated. The existing `.rejected` class (already used by Metrics table) and table styling should work identically for the new per-day table in Accuracy screen.
