# Phase 7: Charts, Heatmap & Accuracy - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the visualization and analytics capability. By the end of this phase, the user can:

1. **View a Charts screen** — one scrollable page with five visualizations stacked vertically: (a) sleep-length line chart over time, (b) wake/sleep time-band scatter/range plot, (c) GitHub-contribution-graph-style calendar heatmap of daily sleep length, (d) nap pattern card (frequency % + average start time + average length), and (e) activity-vs-sleep correlation scatter plot (shown only when `db.activityLog` has data).
2. **View an Accuracy screen** — a 4×3 grid: four event types (wake, bedtime, nap start, nap end) × three success metrics (% within `max_delta`, % within `max_delta / 2`, % where actual fell inside the predicted band). Based on retroactive backtesting across full history. Nap rows report sample count ("based on N days with naps") and skip no-nap days.
3. **Navigate via a bottom navigation bar** — four tabs with icon + label: Today | History | Charts | Accuracy. The header tab bar (Today | History) is removed; the header becomes subject name + Settings gear only.
4. **Stage-scoped analytics** — Charts and Accuracy respect the active stage filter. When a stage is selected on Today, Charts and Accuracy filter data via `filterDayRecordsByStage()`. A "Viewing: [Stage Name]" indicator appears at the top of each screen when a stage is active.

Phase 7 does NOT include:
- PWA manifest, service worker, or offline hardening (Phase 8)
- Multi-file split (Phase 8)
- CSV export (not required by DATA-01..03)
- Per-stage accuracy comparison side-by-side (deferred)
- Animated chart transitions (deferred to Phase 8 polish or v2)

</domain>

<decisions>
## Implementation Decisions

### Navigation

- **D7-01:** Replace the header tab bar (`<nav class="tabNav">`) with a **bottom navigation bar**. The header retains only the subject name (`h1.subjectName`) and the Settings gear button (`button.settingsTrigger`). The `VALID_TABS` set in `header.js` is removed or replaced; tab dispatch moves to a new `js/ui/bottom-nav.js` module.

- **D7-02:** Bottom nav has four tabs with **icon + label**: Today (moon/sleep icon), History (list icon), Charts (bar chart icon), Accuracy (target/bullseye icon). Icons are inline SVG paths — consistent with the existing Settings gear inline SVG. 44×44px minimum tap target (same as existing gear button).

- **D7-03:** Tab order (left to right): **Today | History | Charts | Accuracy**. This follows the natural user journey: log → review → visualize → measure accuracy.

- **D7-04:** Bottom nav is a `<nav>` element with `role="tablist"`, fixed at the viewport bottom via CSS (`position: fixed; bottom: 0`). The `<main id="app">` gets bottom padding equal to the nav bar height so content is never hidden behind it.

### Charts Screen

- **D7-05:** Charts screen is a **single scrollable page** — no sub-tabs or inner navigation. All five visualizations are stacked vertically with section headings. Order: Sleep Length → Time Bands → Calendar Heatmap → Nap Pattern → Activity Correlation.

- **D7-06:** Calendar heatmap uses the **GitHub contribution graph style**: a grid of small SVG `<rect>` elements where columns = weeks (left = oldest, right = newest) and rows = days of the week (top = Monday, bottom = Sunday). Color intensity encodes sleep length: short sleep → lighter fill; long sleep → darker fill. The color scale is drawn from the app's dark/minimal palette (accent color at full saturation for target-length sleep, desaturated for short, blank for missing days). A legend shows min/max labels.

- **D7-07:** Nap pattern indicator is a **stats card** (no complex chart): shows `% of days with a nap`, `avg nap start time (HH:MM)`, and `avg nap length (h m)`. Small, fits in a card below the heatmap.

- **D7-08:** All charts rendered with **hand-drawn SVG elements**: `<polyline>` or `<path>` for line chart, `<circle>` for scatter plots, `<rect>` for heatmap squares and bar-chart components. No external charting library — consistent with the zero-npm-runtime-dependency constraint.

- **D7-09 (Claude's discretion):** Sleep-length chart Y-axis is auto-scaled to the data range (min observed length to max, with 10% padding). X-axis = date (one point per day). When "All data" is active, stage boundaries are shown as vertical dashed lines with a small label at the top edge.

- **D7-10 (Claude's discretion):** Time-band scatter plot — Y-axis = hour of day (0–24h), X-axis = date. Wake events are plotted as one color, bedtime events as another. The predicted min/max band (from `forecast()` for that day) is shown as a thin vertical error bar behind each point.

- **D7-11 (Claude's discretion):** Activity correlation — X-axis = activity score (0–max), Y-axis = that day's total sleep length (hours). Hidden entirely if `Object.keys(db.activityLog).length < settings.minDays`.

### Accuracy Screen

- **D7-12:** Accuracy is computed by **retroactive backtesting**: for each historical day D (starting from `minDays + 1` so there's enough data), call `forecast(dayRecords.before(D), settings)` and compare the predicted central times to the actual logged times in dayRecords[D]. The `forecast()` pure function already supports this — no stored prediction history needed.

- **D7-13:** Backtesting covers **full available history** (all non-rejected days), not just the rolling window. The sample count per event type is shown ("based on N days").

- **D7-14:** Accuracy screen shows a **4 × 3 grid**: rows = wake, bedtime, napStart, napEnd; columns = (1) % within `max_delta`, (2) % within `max_delta / 2`, (3) % where actual fell inside predicted band. Each cell shows the percentage. Each row has a sub-label with the sample count.

- **D7-15:** Nap rows **skip days with no nap logged**. The sample count reads "based on N nap days" rather than total days. If fewer than `minDays` nap days exist, the nap row shows "—" (not enough data).

- **D7-16:** Accuracy computation is a pure function `computeAccuracy(dayRecords, settings) → AccuracyResult` in `js/lib/accuracy.js`. Zero DOM, zero I/O, fully unit-testable with `node:test`. Calls `forecast()` internally.

### Stage Scoping for Analytics

- **D7-17:** Charts and Accuracy screens **respect the active stage filter**. When `settings.activeStageId` is non-null, both screens call `filterDayRecordsByStage(dayRecords, settings)` before rendering. When "All data" is selected (`activeStageId = null`), full history is used.

- **D7-18:** Stage selector stays on the Today screen only (no new selector on Charts or Accuracy). Charts and Accuracy read `activeStageId` from `settings.get()` directly. When a stage is active, a small **"Viewing: [Stage Name]"** label appears at the top of the Charts and Accuracy screens (styled as a muted chip/badge). It is display-only — no interaction.

- **D7-19 (Claude's discretion):** When "All data" is active on the Charts screen, stage boundaries are rendered as vertical dashed lines on the sleep-length chart (one line per stage transition date, labeled with the stage name). This gives visual context for pattern changes across the full history.

### Claude's Discretion (remaining)

- **Bottom nav icons:** Use minimal line-art SVG paths — Claude picks the specific path data for moon (Today), list (History), chart (Charts), and target (Accuracy) icons. Must be inline SVG to preserve zero-network-request constraint.
- **Heatmap color scale:** Claude picks specific CSS custom-property values (desaturated → accent hue ramp) consistent with the `#4f46e5` accent color already in `index.html`.
- **Chart axis label formatting:** Claude decides tick count, label spacing, and whether time values use `timeFormat` from settings (24h / 12h). All dynamic time labels via `textContent`.
- **Minimum data gates:** Charts and Accuracy screens show a cold-start card ("Not enough history to show charts — keep logging!") when fewer than `minDays` non-rejected days exist, mirroring the Today screen cold-start pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Full project context, constraints, key decisions. Specifically: file-as-truth storage, no npm runtime dependencies, Object.freeze configs, TDD discipline, 5-minute time precision.

- `.planning/REQUIREMENTS.md` — Phase 7 requirements: UI-04 (Charts screen with sleep length, time bands, heatmap, nap pattern, activity correlation), UI-05 (Accuracy screen — three success metrics), UI-06 (navigation between all four screens).

- `.planning/ROADMAP.md` § Phase 7 — Phase boundary, four success criteria, depends on Phase 6.

- `CLAUDE.md` — Repo conventions: TDD discipline, REQ-IDs in commits, no npm runtime deps, Object.freeze config objects, textContent-only security invariant.

### Prior phase decisions (load-bearing for Phase 7)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — D-04 (canonical JSON blob shape), D-06 (layered module structure), D-07 (adapter seams for testability), D-19–D-22 (testing scaffold: unit in `tests/unit/`, integration in `tests/integration/`, E2E in `tests/e2e/`).

- `.planning/phases/NW-02-configuration-settings/02-CONTEXT.md` — D2-07 (`createSettingsStore()` API — get/update/subscribe), D2-09 (subscribers fire synchronously on update).

- `.planning/phases/NW-03-forecast-engine-today-screen/03-CONTEXT.md` — D3-01..D3-05 (forecast algorithm — `forecast(dayRecords, settings)` signature), D3-09 (cold-start gate — `isColdStart` flag), D3-07 (Today screen layout order, for reference on screen layout conventions).

- `.planning/phases/NW-04-history-screen-edit-delete/04-CONTEXT.md` — D4-07 (existing two-tab header nav to be replaced by bottom nav in Phase 7), D4-01/D4-02 (History screen table structure — unchanged in Phase 7).

- `.planning/phases/NW-05-data-import-export/05-CONTEXT.md` — D5-17 (`db.activityLog: { 'YYYY-MM-DD': number }` — the activity data structure Charts will consume for correlation).

- `.planning/phases/NW-06-life-stages/06-CONTEXT.md` — D6-01/D6-02 (`settings.stages`, `settings.activeStageId`), D6-09 (stage selector hidden when no stages), D6-11 (fallback note pattern), D6-12 ("All data" label for no-filter state.

### Source code (integration points)

- `js/ui/header.js` — `mountHeader()`, `setActiveTab()`, `VALID_TABS`. Phase 7 removes the `<nav class="tabNav">` from the header DOM and from this module. The `onTabChange` callback is removed. Header simplifies to: subject name + Settings gear only.

- `js/app.js` — Composition root. Phase 7 replaces `applyTabVisibility()` (two screens) with a new function handling four screens. Mounts the bottom nav and wires its tab-change events to show/hide the four `<section>` elements.

- `js/lib/forecast.js` — `forecast(dayRecords, settings)` — called per-day in the retroactive backtesting loop inside `js/lib/accuracy.js`. Signature unchanged.

- `js/lib/stages.js` — `filterDayRecordsByStage(dayRecords, settings)` — called at the top of Charts and Accuracy screen mount functions when `settings.activeStageId` is non-null.

- `js/lib/db-shape.js` — `DEFAULT_SETTINGS` — reference for `settings.minDays`, `settings.maxDelta`, `settings.windowDays`, `settings.timeFormat` used in chart axis formatting and accuracy thresholds.

- `js/ui/dom.js` — DOM helper utilities reusable for chart SVG element creation.

- `index.html` — needs two new `<section>` elements (`#charts-screen`, `#accuracy-screen`) and the bottom `<nav>` element. The header `<nav class="tabNav">` is removed.

- `style.css` — Bottom nav styles (fixed positioning, height, tap-target sizing, active-tab indicator). Chart container styles (full-width SVG, responsive viewBox). Stage indicator chip styles.

### New files Phase 7 will create

- `js/ui/bottom-nav.js` — `mountBottomNav({ root, onTabChange })` — renders and wires the four-tab bottom navigation bar.
- `js/ui/charts-screen.js` — `mountChartsScreen({ root, eventLog, settings })` — renders all five visualizations.
- `js/ui/accuracy-screen.js` — `mountAccuracyScreen({ root, eventLog, settings })` — renders the 4×3 accuracy grid.
- `js/lib/accuracy.js` — `computeAccuracy(dayRecords, settings) → AccuracyResult` — pure backtesting logic.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`js/lib/forecast.js` — `forecast(dayRecords, settings)`**: The pure forecast function is the core of accuracy backtesting. `computeAccuracy()` will call `forecast(dayRecords.slice(0, i), settings)` for each day index `i`. No changes to `forecast.js` needed.

- **`js/lib/stages.js` — `filterDayRecordsByStage(dayRecords, settings)`**: Drop-in call at the top of Charts/Accuracy screen mounts to scope data to the active stage. Already tested and proven in Phase 6.

- **`js/ui/dom.js`**: DOM helper utilities for creating elements safely. Phase 7 uses these for SVG element creation where applicable (e.g., `document.createElementNS('http://www.w3.org/2000/svg', 'rect')`).

- **`js/lib/time.js` — `formatTime(atString, timeFormat)`**: Reuse for all time labels in charts (axis ticks, scatter plot hover labels). Ensures 24h/12h format follows user setting.

- **Phase 3 cold-start pattern**: `isColdStart` check in `forecast()` and the cold-start message rendering in `today-screen.js` — Phase 7 uses the same gate for Charts/Accuracy.

- **Phase 4 delete confirmation pattern (D4-06)**: Not directly relevant; Phase 7 has no destructive actions.

- **`db.activityLog: { 'YYYY-MM-DD': number }`**: Populated during CSV import (Phase 5). Phase 7 reads it from `eventLog.get()` or from the settings blob for correlation chart. Structure: keys are ISO date strings, values are numeric activity scores.

### Established Patterns

- **Module-per-screen**: `js/ui/today-screen.js`, `js/ui/history-screen.js` — Phase 7 adds `js/ui/charts-screen.js` and `js/ui/accuracy-screen.js` following the same `mountXScreen({ root, eventLog, settings })` pattern.
- **Pure-logic in `js/lib/`**: `accuracy.js` is pure → TDD (RED→GREEN→refactor) with `node:test`. Chart data-transform helpers (e.g., `buildHeatmapData(dayRecords) → HeatmapCell[]`) also go in `js/lib/`.
- **SVG rendering**: All SVG created via `document.createElementNS` + attribute setting — never string interpolation into innerHTML. Consistent with the textContent-only security invariant.
- **`Object.freeze` for config**: Color scale config, chart margin/padding constants — freeze them.
- **Reactive updates via subscribers**: Charts and Accuracy subscribe to `settings.subscribe()` and `eventLog.subscribe()` to re-render when data changes (same pattern as Today screen).
- **Security invariants**: All user-supplied values (stage names, subject name) rendered via `textContent`, never as SVG `<text>` content via innerHTML. SVG attribute values for dynamic data (positions, sizes) are numbers, not strings — safe.

### Integration Points

- **`header.js`**: Remove the `<nav class="tabNav">` block and the `VALID_TABS` guard. The `onTabChange` prop is removed from `mountHeader()`. Header simplifies significantly.
- **`app.js`**: Replace the two-screen `applyTabVisibility()` with a four-screen version. Wire `mountBottomNav({ root: navEl, onTabChange })`. Mount `mountChartsScreen` and `mountAccuracyScreen` on init.
- **`index.html`**: Add `<section id="charts-screen" style="display:none">` and `<section id="accuracy-screen" style="display:none">` inside `<main id="app">`. Add `<nav id="bottom-nav" class="bottomNav" role="tablist" aria-label="Screen navigation">` after `</main>`. Remove `<nav class="tabNav">` from `<header>`.

</code_context>

<specifics>
## Specific Ideas

- **Accuracy screen layout**: 4 rows × 3 columns grid. Row headers = event type (Wake / Bedtime / Nap Start / Nap End). Column headers = metric name (Within max_delta / Within max_delta/2 / Inside band). Each cell = percentage + sample count sub-label. Matches a compact stats table, not a chart.

- **Calendar heatmap inspiration**: GitHub's contribution graph — the user explicitly chose this style. Weeks as columns (oldest left), days-of-week as rows (Mon–Sun top to bottom). Each cell = one day square, color = sleep length. Missing days = empty/unfilled square.

- **Activity correlation**: This is the only "optional" chart (hidden when `activityLog` is empty). The user's `sen.xlsx` has an `Aktywność` column with numeric scores already imported via Phase 5. Phase 7 can surface it immediately after import.

- **Stage boundary markers on sleep-length chart**: When "All data" is selected, vertical dashed lines at each stage's `startDate` with a small stage name label — gives visual context for pattern changes without requiring a separate stage visualization screen.

</specifics>

<deferred>
## Deferred Ideas

- **Per-stage accuracy comparison side-by-side** (e.g., "Stage 1 accuracy vs Stage 2 accuracy"): A compelling analytics view but adds significant UI complexity. Phase 7 scopes accuracy to the currently selected stage; side-by-side comparison is deferred.
- **Animated chart transitions**: Smooth transitions when switching stages or when new data is logged. Phase 8 can add this during the polish pass.
- **CSV export from Charts/Accuracy** (exporting the accuracy table or chart data as CSV for external analysis): Not in DATA-01..03 scope; defer to v2.
- **Zoom/pan on charts**: Interactive zoom on the sleep-length line chart for long histories. Deferred to v2.
- **Day-of-week heatmap for nap frequency**: Was considered for the nap pattern indicator; user deferred in favor of simple stats card.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 7-Charts, Heatmap & Accuracy*
*Context gathered: 2026-06-30*
