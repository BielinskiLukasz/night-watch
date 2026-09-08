---
phase: quick-260828-ikl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - js/ui/metrics-screen.js
autonomous: true
requirements:
  - MET-11
estimate:
  tokens: 22000
  raw_tokens: 22000
  tasks: 1
  confidence: high

must_haves:
  truths:
    - The three TIF aggregate rows (min-TIF, median-TIF, max-TIF) show trimmed statistics computed from per-column metric values across all 16 base columns, not only the 4 event-type time columns
    - Rejected rows are excluded from the trimmed-stats computation
    - Only the last tifRollingDays (default 7) rows enter the computation
    - TIF inline columns (W-min, W-max, etc.) still render '—' in all three aggregate rows
  artifacts:
    - js/ui/metrics-screen.js (updated with computeTifTrimmedStats, updated buildTifAggregateRow)
  key_links:
    - trimmedMinMax imported from forecast-tif.js and called per-column with manualExcludedCount=0
    - computeTifTrimmedStats returns { min, median, max } each being a { colKey: value } flat map
    - render() calls computeTifTrimmedStats(rows, snap) once and passes .min/.median/.max to buildTifAggregateRow
---

<objective>
Replace the existing TIF aggregate row computation in metrics-screen.js: swap out
the event-type-only average approach (computeTifRowAvg / TIF_EVENT_TYPES) for a
per-column trimmed-statistics approach that covers all 16 base metric columns.

Purpose: The current rows show averages of algMin/central/algMax for only 4 time
columns. They should instead show trimmed min/median/max for every column in the
same way the classic Avg/Min/Max rows do — but using the TIF rolling window and
trimming, skipping rejected rows, operating directly on rows[] (not tifBoundsArray).

Output: Updated js/ui/metrics-screen.js with computeTifTrimmedStats + revised
buildTifAggregateRow + cleaned-up render() call site.
</objective>

<execution_context>
@C:/my-code/vibe-coding/night-watch/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/night-watch/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/night-watch/.planning/PROJECT.md
@C:/my-code/vibe-coding/night-watch/js/ui/metrics-screen.js
@C:/my-code/vibe-coding/night-watch/js/lib/forecast-tif.js
</context>

<tasks>

<task type="tracer">
  <name>Replace TIF aggregate row computation with per-column trimmedMinMax</name>
  <files>js/ui/metrics-screen.js</files>
  <action>
Make all changes inside js/ui/metrics-screen.js. Read the file before editing.

**Step 1 — Add import.**
In the existing import block, add `trimmedMinMax` to the import from `../lib/forecast-tif.js`.
There is no existing import from that module; add a new line after the `computeTifBoundsHistory`
import:

  import { trimmedMinMax } from '../lib/forecast-tif.js';

**Step 2 — Remove TIF_EVENT_TYPES constant.**
Delete the line:

  const TIF_EVENT_TYPES = new Set(['wake', 'napStart', 'napEnd', 'bedtime']);

and its JSDoc comment block (the two lines "// TIF event-type columns..." above it).

**Step 3 — Add computeTifTrimmedStats function.**
Insert this new private helper immediately before the `buildTifAggregateRow` function
(after where TIF_EVENT_TYPES was):

```
/**
 * Compute trimmed min, median, and max for each base metric column (indices 1–15)
 * over the TIF rolling window, skipping rejected rows (MET-11).
 *
 * @param {object[]} rows   metrics rows (oldest-first) from aggregateMetrics
 * @param {object}   snap   settings snapshot
 * @returns {{ min: object, median: object, max: object }}
 *   Each property is a flat map of { colKey: formattedValue|null }.
 */
function computeTifTrimmedStats(rows, snap) {
  const windowSize = snap.tifRollingDays ?? 7;
  const trimPct    = snap.trimPct ?? 10;

  // Take the last windowSize rows (most recent), then exclude rejected.
  const window = rows.slice(-windowSize).filter(r => !r.rejected);

  const minMap    = {};
  const medianMap = {};
  const maxMap    = {};

  for (let i = 1; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];

    if (col.isTime) {
      // Collect as minutes, sort, apply trimmedMinMax, convert back.
      const mins = window
        .map(r => r[col.key] != null ? timeToMinutes(r[col.key]) : null)
        .filter(v => v !== null);
      mins.sort((a, b) => a - b);
      const result = trimmedMinMax(mins, trimPct, 0);
      minMap[col.key]    = result ? minutesToTime(result.min)    : null;
      medianMap[col.key] = result ? minutesToTime(result.median) : null;
      maxMap[col.key]    = result ? minutesToTime(result.max)    : null;
    } else {
      // Duration and ratio columns — sort numerically, apply trimmedMinMax.
      const vals = window
        .map(r => r[col.key] != null ? r[col.key] : null)
        .filter(v => v !== null);
      vals.sort((a, b) => a - b);
      const result = trimmedMinMax(vals, trimPct, 0);
      minMap[col.key]    = result ? result.min    : null;
      medianMap[col.key] = result ? result.median : null;
      maxMap[col.key]    = result ? result.max    : null;
    }
  }

  return { min: minMap, median: medianMap, max: maxMap };
}
```

Do NOT place fenced code blocks inside the written file. Write the function as plain
JavaScript code — the triple-backtick fence above is only here for readability in
this action block; strip it when writing the file.

**Step 4 — Rewrite buildTifAggregateRow.**
Replace the entire existing `buildTifAggregateRow` function (signature + body + JSDoc)
with the following. The parameter previously named `tifAvgs` becomes `tifStats`, which
is now a flat `{ colKey: value|null }` map covering all base columns.

New JSDoc + signature:
  /**
   * Build a TIF aggregate row (min-TIF, median-TIF, or max-TIF).
   *
   * Shows trimmed statistics for each base column computed by computeTifTrimmedStats.
   * All TIF inline columns render '—'. The row is hidden by the caller when TIF is off.
   *
   * T-11-05: all cell content via textContent.
   *
   * @param {string} label      row label ('min-TIF', 'median-TIF', 'max-TIF')
   * @param {object} tifStats   flat map { colKey: value|null } from computeTifTrimmedStats
   * @param {object} snap       settings snapshot (for timeFormat)
   * @returns {HTMLTableRowElement}
   */
  function buildTifAggregateRow(label, tifStats, snap) {

New body — replace the old body entirely:
  - Create tr, add classes 'metrics-summary-row' and 'metrics-tif-row' (same as before)
  - First cell: sticky label td (same as before)
  - Loop COLUMNS indices 1..length-1:
      const col = COLUMNS[i];
      const td = document.createElement('td');
      const value = tifStats ? tifStats[col.key] : null;
      td.textContent = formatCellValue(value, col, snap); // T-11-05: textContent
      tr.appendChild(td);
  - Loop TIF_COLUMNS: each td.textContent = '—'; (same as before)
  - return tr;

**Step 5 — Update render() call site.**
Inside the `render()` function, replace the entire block from
`// TIF aggregate rows helper: average a specific TIF bounds field...`
through the three `computeTifRowAvg` call lines (tifMinAvgs, tifMedianAvgs, tifMaxAvgs)
with:

  // TIF aggregate rows: trimmed stats per column over the rolling window (MET-11)
  const tifTrimmedStats = isTif ? computeTifTrimmedStats(rows, snap) : null;

Then update the three buildTifAggregateRow calls immediately below (lines ~467-469) to:
  const minTifRow    = buildTifAggregateRow('min-TIF',    tifTrimmedStats?.min    ?? null, snap);
  const medianTifRow = buildTifAggregateRow('median-TIF', tifTrimmedStats?.median ?? null, snap);
  const maxTifRow    = buildTifAggregateRow('max-TIF',    tifTrimmedStats?.max    ?? null, snap);

The remaining code (hidden flags, appendChild calls) stays unchanged.
  </action>
  <verify>
    <automated>npm run test:unit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - trimmedMinMax is imported from forecast-tif.js
    - computeTifTrimmedStats exists as a private function, takes rows + snap, returns { min, median, max }
    - buildTifAggregateRow accepts a flat colKey map and iterates all base columns via formatCellValue
    - TIF_EVENT_TYPES constant and computeTifRowAvg function are gone
    - render() calls computeTifTrimmedStats once; passes .min/.median/.max to the three buildTifAggregateRow calls
    - npm run test:unit passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| metrics rows → aggregate | row values from aggregateMetrics are application-computed, no external input |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-q-01 | Tampering | buildTifAggregateRow cell content | low | accept | All cells set via textContent (T-11-05 invariant unchanged by this change) |
</threat_model>

<verification>
Run `npm run test:unit` — all existing unit tests must pass.

Manual check (TIF mode active in browser): the three TIF aggregate rows now show
non-dash values across duration and ratio columns (Sleep, Nap, Nap Frac, Day/Sleep,
etc.), not only the four event-type time columns.
</verification>

<success_criteria>
- All 16 base columns (indices 1-15) receive a trimmed stat value in each TIF aggregate row
- Rejected rows are excluded from the window
- Only the last tifRollingDays (default 7) rows are included
- TIF inline columns (W-min, W-max, etc.) continue to show '—' in aggregate rows
- No regression: npm run test:unit passes
</success_criteria>

<output>
Create `.planning/quick/260828-ikl-fix-tif-aggregate-rows-in-metrics-screen/260828-ikl-SUMMARY.md` when done.
</output>
