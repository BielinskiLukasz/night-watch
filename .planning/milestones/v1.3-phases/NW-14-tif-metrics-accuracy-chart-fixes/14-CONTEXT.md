# Phase 14: TIF Metrics, Accuracy & Chart Fixes - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface TIF-specific data across the Metrics and Accuracy screens, update Metrics ratio columns, and fix the Wake & Bedtime Bands chart. All nine requirements land in existing UI modules and `js/lib/` helpers — no new screens, no data-model changes beyond additive metrics functions.

Requirements in scope: TIF-14, MET-07, MET-08, MET-09, MET-10, MET-11, UI-08, UI-09, UI-10.

**Grouping for planning:**
- **Metrics table overhaul (MET-07/09/10):** column additions/rename + new metrics functions in `metrics.js`
- **TIF retroactive engine (shared by MET-08 + TIF-14):** `computeTifBoundsHistory` in a new `accuracy-tif.js`
- **Metrics TIF columns (MET-08/11):** 12 TIF inline columns + 3 aggregate rows in `metrics-screen.js`
- **Accuracy screen TIF grid (TIF-14):** replace classic grid with TIF-specific grid in `accuracy-screen.js`
- **Chart fixes (UI-08/09/10):** Y-axis inversion + nap series + post-midnight dedup in `charts-screen.js` + `chart-data.js`

</domain>

<decisions>
## Implementation Decisions

### TIF Accuracy Grid (TIF-14)

- **D-01:** When TIF is the active algorithm, the Accuracy screen shows ONLY the TIF-specific grid — it REPLACES the classic 4×3 grid. When classic is active, show the classic grid as before. — **Reversibility:** reversible

- **D-02:** The TIF accuracy grid uses the same data range and stage filter as the classic grid (rolling window from settings, active stage scoping). No separate range selector. — **Reversibility:** reversible

- **D-03:** Window hit rate is computed via retroactive `tifForecast` per historical day — same backtesting pattern as `computeAccuracy` runs `forecast()` in `accuracy.js`. A new `computeTifAccuracy(dayRecords, settings, activityLog)` function consumes the output of `computeTifBoundsHistory` (see D-10). — **Reversibility:** reversible

- **D-04:** TIF accuracy grid structure: 4 rows (wake, napStart, napEnd, bedtime) × 3 columns. Column labels: `Window Hit` / `Avg Width` / `High Conf`. Same CSS grid layout and visual style as the classic accuracy grid. — **Reversibility:** reversible

- **D-05:** Column definitions:
  - `Window Hit`: % of days where actual event time fell inside [algMin, algMax]
  - `Avg Width`: mean(algMax_minutes − algMin_minutes) across scored days, formatted as minutes (e.g., "±23 min")
  - `High Conf`: % of days where precisionScore ≥ 80
  — **Reversibility:** reversible

### MET-11 TIF Aggregate Rows

- **D-06:** Three new aggregate rows appended AFTER the existing aggregates (avg, min-with-date, max-with-date): `min-TIF`, `median-TIF`, `max-TIF`. Hidden entirely when TIF is off (not greyed out). — **Reversibility:** reversible

- **D-07:** Row definitions:
  - `min-TIF` = average of all `algMin` values across the window days (per event type)
  - `median-TIF` = average of all `central` values across the window days (per event type)
  - `max-TIF` = average of all `algMax` values across the window days (per event type)
  These averages cover all 4 event types; null shown when no TIF predictions exist for a type. — **Reversibility:** reversible

- **D-08:** TIF aggregate rows cover all 4 event types always (wake, napStart, napEnd, bedtime). Null/dash rendered for event types with no TIF history. — **Reversibility:** reversible

### Metrics Table Column Order (MET-07, MET-09, MET-10)

- **D-09:** New 16-column order (when TIF off):
  `Date | Wake | Nap Start | Nap End | Bedtime | Sleep | Nap | Nap Frac | Comb | Day Len | Day/Sleep | →Nap | Nap→ | Act | AM/PM | AAS`

  Changes from current 14-column layout:
  - `SAA` (col 14) is REMOVED; replaced by `Day/Sleep Factor` moved to col 11 (adjacent to `Day Len`)
  - `Nap Frac` (MET-09) inserted at col 8 (after `Nap`)
  - `AM/PM` (MET-10) inserted at col 15 (after `Act`)
  — **Reversibility:** costly — changes column indices in existing tests and screen rendering code; all column-order-dependent tests must update.

- **D-10:** Shared retroactive TIF engine: new `js/lib/accuracy-tif.js` exports `computeTifBoundsHistory(dayRecords, settings, activityLog)` returning an array of `{ date, wake, napStart, napEnd, bedtime }` where each entry is `{ algMin, algMax, precisionScore } | null`. Consumed by both TIF-14 accuracy screen and MET-08 metrics table. — **Reversibility:** reversible

- **D-11:** MET-08 inline columns: when TIF is active, 12 additional columns appear at the far right of the metrics table (AFTER AAS):
  `wake-TIF-min | wake-TIF-max | wake-TIF-conf | napStart-TIF-min | napStart-TIF-max | napStart-TIF-conf | napEnd-TIF-min | napEnd-TIF-max | napEnd-TIF-conf | bedtime-TIF-min | bedtime-TIF-max | bedtime-TIF-conf`
  Hidden entirely when TIF is off. — **Reversibility:** reversible

- **D-12:** New metric functions in `metrics.js`:
  - `dayToSleepFactor(day)` = `dayLength(day) / sleepDuration(day)` — replaces `sleepAfterActivityFactor` in the metrics table; null when either is null
  - `napFraction(day)` = `napDuration(day) / combinedSleepNap(day)` — null on no-nap days or when combinedSleepNap is null
  - `amPmSplit(day)` = `activityBeforeNap(day) / activityAfterNap(day)` — null on no-nap days or when either segment is absent/zero
  — **Reversibility:** reversible (additive to metrics.js; `sleepAfterActivityFactor` stays exported, just no longer rendered in the table)

- **D-13:** All three new metrics (`dayToSleepFactor`, `napFraction`, `amPmSplit`) formatted as decimal to 2 places (e.g., 0.42). Same `isRatio: true` column type as AAS. — **Reversibility:** reversible

- **D-14:** MET-07: `sleepAfterActivityFactor` is removed from the Metrics table column list and from `aggregateMetrics` computation. All tests and labels referencing `saa` / `SAA` must be updated throughout (`metrics.js`, `metrics-screen.js`, and any test files). The function `sleepAfterActivityFactor` remains exported from `metrics.js` (backward compat) but is no longer rendered. — **Reversibility:** reversible

### Wake & Bedtime Bands Chart Fixes (UI-08, UI-09, UI-10)

- **D-15:** Y-axis inversion (UI-08): flip `yScale` so earlier times appear at BOTTOM, later times at TOP. New formula: `yScale(minutes) = M.top + plotH - (minutes / (24 * 60)) * plotH`. Y-axis tick labels update accordingly (0h at bottom, 24h at top). — **Reversibility:** reversible

- **D-16:** Nap series (UI-09): add `napStartMinutes` and `napEndMinutes` fields to `buildTimeBandSeries` return objects (extracted from `d.napStart` / `d.napEnd` slots on the day record, same as wake/bedtime). Null on no-nap days — render as a gap in the nap series (no dot that day). Two additional colored dot series with updated legend (4 series total: wake, napStart, napEnd, bedtime). — **Reversibility:** reversible

- **D-17:** Post-midnight dedup fix (UI-10): `buildTimeBandSeries` must use the day record's subjective-night slots directly (`.wake`, `.bedtime`, `.napStart`, `.napEnd` keyed by `d.date`), NOT the calendar-date scatter from `allEvents`. This eliminates post-midnight bedtimes appearing on the wrong calendar-date bucket. Each day record produces exactly one dot per event type. — **Reversibility:** reversible — changes the data shape `buildTimeBandSeries` returns; callers in `charts-screen.js` must update.

### Claude's Discretion

- **Column label shortening for new columns:** `Day/Sleep`, `Nap Frac`, `AM/PM` as header labels — planner may adjust to fit the narrow column widths used elsewhere.
- **TIF column header labels:** `Wake-TIF-min` etc. — planner may abbreviate (e.g., `W-min`, `W-max`, `W-conf`) for table width.
- **`accuracy-tif.js` structure:** Mirror `accuracy.js` — one exported function, frozen config, zero DOM. Planner decides exact internals.
- **Nap series colors on the chart:** Planner picks a color scheme consistent with the Today screen prediction card colors or the existing SVG color palette in `charts-screen.js`. No explicit color preference specified.
- **`computeTifBoundsHistory` window length:** Use `tifRollingDays` setting as the retrospective window length (consistent with D-06 from Phase 13 CONTEXT).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §TIF-14, MET-07, MET-08, MET-09, MET-10, MET-11, UI-08, UI-09, UI-10 — exact requirement text and success criteria
- `.planning/ROADMAP.md` §"Phase 14: TIF Metrics, Accuracy & Chart Fixes" — goal, success criteria, plan estimates, UI hint

### Architecture references
- `CLAUDE.md` §Architecture — module roles, cross-file invariants, pitfalls
- `CLAUDE.md` §"Pitfalls & non-obvious invariants" — metrics.js circular-import guard (CRITICAL for any new metrics functions), XSS guard, time strings are local wall-clock

### Key source files to read before planning
- `js/lib/accuracy.js` — model for `computeTifBoundsHistory`; mirrors this pattern for retroactive TIF backtesting
- `js/lib/forecast-tif.js` — TIF output shape: `{ algMin, algMax, precisionScore, central, sourceWindows }` per prediction; `computeIntersection`, `applyPrecision`, `buildPrediction` internals
- `js/lib/metrics.js` — existing metric functions; `aggregateMetrics` shape; `sleepAfterActivityFactor` being removed from table (but stays exported); circular-import guard must be respected
- `js/ui/accuracy-screen.js` — existing classic 4×3 grid implementation to replace with TIF grid when TIF active; `COLUMNS` and `ROWS` constants to mirror for TIF
- `js/ui/metrics-screen.js` — existing 14-column `COLUMNS` array and aggregate rows rendering; must update to 16-column order + 12 TIF columns + 3 TIF aggregate rows
- `js/lib/chart-data.js` — `buildTimeBandSeries` to refactor for subjective-night slots + nap series extension
- `js/ui/charts-screen.js` — `renderTimeBandChart` and `yScale` formula; must update for inversion + 4-series rendering

### Phase 13 CONTEXT (prior decisions that carry forward)
- `.planning/phases/NW-13-tif-algorithm-extensions/13-CONTEXT.md` — TIF output shape decisions (D-11 through D-14 on `sourceWindows`/`median`; D-06 `tifRollingDays` as history window); `isNoNapDay` caller-resolved pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeAccuracy(dayRecords, settings)` in `accuracy.js` — exact structural model for `computeTifBoundsHistory`; runs `forecast()` retroactively for each day; copy pattern wholesale, replace `forecast()` with `tifForecast()`
- `COLUMNS` / `ROWS` constants in `accuracy-screen.js` — frozen arrays driving the CSS grid; mirror for TIF accuracy grid with new labels
- `aggregateMetrics(dayRows, ...)` in `metrics.js` — `aggregateMetric` helper pattern; TIF aggregate rows follow same structure but source from retroactive TIF bounds, not per-day metric functions
- `buildTimeBandSeries(dayRecords)` in `chart-data.js` — currently returns `{ date, wakeMinutes, bedtimeMinutes, bedtimesMinutes[] }` keyed by calendar date scatter; needs replacement with subjective-night slot approach
- `minutesToISOString` in `charts-screen.js` — used for tick label formatting; remains unchanged
- `svgEl`, `svgText`, `createChartSvg` helpers in `charts-screen.js` — reuse for nap dot series

### Established Patterns
- **Column `isRatio: true` type:** Controls cell formatting in `metrics-screen.js`; all three new ratio columns (`dayToSleepFactor`, `napFraction`, `amPmSplit`) use this flag
- **`hidden` attribute toggling:** TIF columns/rows use `el.hidden = !isTif` — consistent with existing conditional rendering in metrics-screen.js
- **Per-day flag injection:** `db-shape.js` / `day-bucket.js` pattern — no new flags needed for Phase 14
- **Retroactive prediction in accuracy.js:** Runs `forecast()` on `sorted.slice(0, i)` for each day `i`. `computeTifBoundsHistory` follows the same slice-based approach with `tifForecast(slice, settings, activityLog)`
- **XSS guard:** All new cell content must go through `textContent` — never `innerHTML`. TIF column values are numbers/times, safe via `textContent`.
- **metrics.js circular-import guard:** `metrics.js` imports from `forecast.js` (not `forecast-tif.js`). `accuracy-tif.js` may import from `forecast-tif.js` directly since it parallels `accuracy.js` (not `metrics.js`).

### Integration Points
- `js/ui/accuracy-screen.js` — `mountAccuracyScreen` must detect `settings.forecastAlgorithm === 'tif'` and render TIF grid instead of classic; both grids share the same root element
- `js/ui/metrics-screen.js` — `COLUMNS` constant update (16 base + 12 TIF hidden columns); aggregate section gains 3 TIF rows hidden when TIF off; `computeTifBoundsHistory` called when TIF active, result merged with per-day metric rows by date
- `js/lib/chart-data.js` — `buildTimeBandSeries` signature and return shape changes; `charts-screen.js` is the only consumer (check before changing)
- `js/app.js` — may need to pass `activityLog` to `computeTifBoundsHistory` if it parallels the `tifForecast` call pattern from Phase 13

</code_context>

<specifics>
## Specific Ideas

- **`computeTifBoundsHistory` output shape:** `Array<{ date: string, wake: TifBounds|null, napStart: TifBounds|null, napEnd: TifBounds|null, bedtime: TifBounds|null }>` where `TifBounds = { algMin: string, algMax: string, precisionScore: number }`. Merged into metrics-screen by date key.
- **TIF accuracy `computeTifAccuracy(history)` shape:** mirrors `AccuracyResult` but with `{ windowHit: { count, pct }, avgWidthMin: number, highConf: { count, pct } }` per event type.
- **MET-08 TIF column header groups:** use `<colgroup>` or colspan header rows to visually group the 12 TIF columns under a "TIF Bounds" header, consistent with accessibility and readability.
- **UI-09 nap series gap rendering:** on no-nap days, skip the dot for napStart/napEnd rather than drawing a 0 or null point. Same pattern used for `bedtimesMinutes` when empty.

</specifics>

<deferred>
## Deferred Ideas

- **Post-no-nap nap-duration window for TIF-16:** Phase 13 CONTEXT noted this as potentially needed — if it surfaces during Phase 14 implementation, it's a Phase 15 item.
- **Per-day TIF bounds storage/caching:** If `computeTifBoundsHistory` is slow on large datasets, caching in `localStorage` is a future optimization. Not in scope here.
- **Classic + TIF side-by-side accuracy comparison:** Showing both algorithms' accuracy in one view is a natural evolution after Phase 14. Noted for v1.4 backlog.

</deferred>

---

*Phase: 14-TIF-Metrics-Accuracy-Chart-Fixes*
*Context gathered: 2026-08-27*
