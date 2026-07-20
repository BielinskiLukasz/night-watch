# Phase 11: Metrics Screen - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 adds a dedicated 5th-tab "Metrics" screen to the bottom navigation bar. It delivers:

- A single wide horizontally-scrollable table showing one row per logged day, with 14 columns: Date + 4 raw event times (Wake, Bedtime, Nap Start, Nap End) + 9 metric columns (Sleep, Nap, Combined, Day Length, Act→Nap, Nap→Bed, Activity, AAS, SAA)
- A summary mini-table (Avg / Min / Max rows) rendered in the same scroll container above the per-day rows, sharing sticky header and sticky first-column behavior
- A stage chip badge filter (same stageChip pattern as Charts and Accuracy screens); when a stage is active, both the per-day rows and the aggregates are scoped to stage data
- Extensions to `js/lib/metrics.js`: `totalActivity(day)`, `activityAfterSleepFactor(day)`, `sleepAfterActivityFactor(day, prevDay)`, and `aggregateMetrics(dayRecords)` (which handles cross-day SAA computation)

What does NOT ship: multi-nap support, multi-profile metrics, sparklines or chart overlays in the metrics table, export of metrics data.

</domain>

<decisions>
## Implementation Decisions

### Screen Layout

- **D11-01:** Layout is a single wide horizontally-scrollable table (not three named sections, not expandable day cards). All columns share one scroll container.
- **D11-02:** Column order — left to right: Date | Wake | Bedtime | Nap Start | Nap End | Sleep | Nap | Combined | Day Length | Act→Nap | Nap→Bed | Activity | AAS | SAA. Times come before computed metrics.
- **D11-03:** Rows are ordered most-recent-first.
- **D11-04:** Days with no nap still appear as rows; nap-dependent cells (Nap Start, Nap End, Nap, Combined, Act→Nap, Nap→Bed, Activity, AAS, SAA) show `—`.
- **D11-05:** Rejected (outlier-flagged) days appear in the per-day table, visually marked (e.g. dimmed opacity and/or strikethrough). They are not hidden.
- **D11-06:** Column headers are abbreviated to conserve horizontal space. Exact abbreviations are Claude's discretion (e.g. "Sleep", "Nap", "Comb", "Day Len", "→Nap", "Nap→", "Act", "AAS", "SAA").
- **D11-07:** No cold-start gate — the table renders from day 1 with whatever data is available.
- **D11-08:** All four raw event times are shown (Wake, Bedtime, Nap Start, Nap End), formatted according to the existing `timeFormat` setting (12h/24h) using `formatTime()` from `js/lib/time.js`.

### Stage Filter Control

- **D11-09:** Stage filter is implemented as a read-only stageChip badge, identical to the pattern used in `js/ui/charts-screen.js` and `js/ui/accuracy-screen.js`. No additional local toggle control is added.
- **D11-10:** When a stage is active, the filter scopes both the per-day rows and the aggregate calculations to that stage's data.

### Aggregates Layout

- **D11-11:** A summary mini-table (Avg / Min / Max rows, same columns as the per-day table) is rendered visually above the per-day rows but inside the same scroll container, so both sections scroll together horizontally.
- **D11-12:** Summary row labels are "Average", "Min", "Max" in the Date column (first sticky column).
- **D11-13:** Rejected days are excluded from all aggregate calculations.
- **D11-14:** Min and Max cells show the value on line 1 and the date in smaller text below, in the same cell.
- **D11-15:** Days with no nap are excluded from nap-column aggregates (Nap, Combined, Act→Nap, Nap→Bed, AAS, SAA for nap-dependent columns). Average is computed over nap-days only.
- **D11-16:** The first day has no previous-day context for SAA; it shows `—` and is excluded from SAA aggregates.
- **D11-17:** The first column (Date / row labels) is sticky (`position: sticky; left: 0`) and stays fixed while scrolling right. This applies to both summary rows and per-day rows.
- **D11-18:** Column headers are sticky (`position: sticky; top: 0`) and stay pinned while scrolling down.
- **D11-19:** The summary mini-table shares the same sticky first-column and sticky-header behavior as the per-day table (both are inside the same scroll container and the same `<table>` element or equivalent structure).

### Duration Display Format

- **D11-20:** Duration values (Sleep, Nap, Combined, Day Length, Act→Nap, Nap→Bed, Activity) are formatted as `Xh Ym` (e.g. "7h 30m"). A `formatDuration(minutes)` helper is needed; its location (new export in `js/lib/time.js` or local helper in `js/ui/metrics-screen.js`) is Claude's discretion.
- **D11-21:** Ratio values (AAS, SAA) are formatted to 2 decimal places (e.g. "1.85"). No unit suffix.
- **D11-22:** Average duration values in the summary rows are also formatted as `Xh Ym`, rounded to the nearest minute.

### New Metrics to Add to metrics.js

Phase 11 extends `js/lib/metrics.js` with these new exports:

- **D11-23:** `totalActivity(day)` — total activity time: `activityBeforeNap(day) + activityAfterNap(day)` (equivalent to `dayLength − napDuration`). Returns `null` if nap slots are absent (no-nap day also means no act-before/after).
- **D11-24:** `activityAfterSleepFactor(day)` — AAS: `totalActivity(day) / sleepDuration(day)`. Returns `null` if either component is null.
- **D11-25:** `sleepAfterActivityFactor(day, prevDay)` — SAA: `sleepDuration(day) / totalActivity(prevDay)`. Returns `null` if either component is null or if `prevDay` is absent (first day). This helper takes the previous day record as a second parameter; `aggregateMetrics()` handles the cross-day pairing.
- **D11-26:** `aggregateMetrics(dayRecords)` — accepts the full sorted array of pre-bucketed day records (most-recent-first or oldest-first — caller ensures consistent order); returns an object with `rows` (one entry per day with all 9 metric values and the 4 raw times), `avg`, `min` (with date), and `max` (with date) for each metric. Rejected and no-nap days are handled per D11-13 and D11-15.

### Claude's Discretion

- Exact abbreviated column header text for each column
- Whether the summary and per-day rows live in a single `<table>` (with separate `<tbody>` groups and a CSS separator) or two tables inside the same scrolling `<div>` (though a single `<table>` is simpler for column-width alignment)
- CSS class names for rejected-row dimming, summary separator, sticky header/column
- Location of `formatDuration()` helper (new export in `js/lib/time.js` vs. local to `metrics-screen.js`)
- Whether `aggregateMetrics()` takes a `{ rejected: boolean }` flag on each record directly or re-applies the rejected-day filter internally

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MET-01..MET-06 — All 6 Metrics Screen requirements. MET-06 "toggle" means stageChip badge (D11-09), not a new local button.
- `.planning/ROADMAP.md` §Phase 11 — Success criteria (5 items) and "UI hint: yes" flag.

### Architecture Invariants
- `CLAUDE.md` §Architecture — Adapter injection, XSS guard (all dynamic DOM via `textContent` / `dom.js` helpers), day-boundary via `day-bucket.js`, service-worker cache versioning.

### Existing Code to Extend
- `js/lib/metrics.js` — Phase 10 duration helpers; Phase 11 adds ratio helpers and `aggregateMetrics()` to this file (D11-23..D11-26). Read before adding new exports.
- `js/ui/accuracy-screen.js` — Canonical reference for the screen mount pattern (`mountAccuracyScreen({ root, eventLog, settings })`), stageChip badge, `filterDayRecordsByStage` 3-arg call, reactive subscribe/unsubscribe, and replaceChildren DOM update pattern. Mirror this pattern for `mountMetricsScreen`.
- `js/ui/bottom-nav.js` — `VALID_TABS` set and `TABS` array must have 'metrics' added as the 5th entry. Read before editing.
- `js/app.js` — `SCREENS` map, element query, import, and `mountMetricsScreen` call must all be added. Read before editing.
- `index.html` — Needs `<section id="metrics-screen" class="screen-section" hidden aria-label="Metrics"></section>` added alongside the existing screen sections.
- `js/lib/time.js` — `formatTime(at, timeFormat)` for displaying raw event times. If `formatDuration` lands here, add it as a new export.
- `js/ui/dom.js` — `textContent`/`replaceChildren` helpers; all dynamic DOM in metrics-screen.js must go through these.
- `tests/unit/sw-precache.test.js` — Must be updated when `js/ui/metrics-screen.js` (and any new `js/lib/` files) are added. Enforces the service-worker precache list.
- `sw.js` — `PRECACHE_LIST` must include `js/ui/metrics-screen.js`.

### Day Bucketing
- `js/lib/day-bucket.js` — `filterDayRecordsByStage(allDays, stages, activeStageId)` — use the 3-argument form (Pitfall 1 from Phase 10 research). `allDays` comes from `eventLog.getAllDayRecords()` or equivalent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/ui/accuracy-screen.js` `mountAccuracyScreen` — Full mount-pattern template: element refs, stageChip badge, cold-start card, subscribe/unsubscribe return, replaceChildren updates. Metrics screen should mirror this structure.
- `js/lib/forecast.js` `minutesToTime` — Already exported; usable if needed for time arithmetic, though metrics only needs duration display (`formatDuration`) and raw time display (`formatTime`).
- `js/lib/time.js` `formatTime(at, timeFormat)` — Used to display raw event times (Wake, Bedtime, Nap Start, Nap End) respecting the user's 12h/24h preference.
- `js/lib/metrics.js` six existing duration helpers — `sleepDuration`, `napDuration`, `activityBeforeNap`, `activityAfterNap`, `dayLength`, `combinedSleepNap`. Phase 11 adds `totalActivity`, `activityAfterSleepFactor`, `sleepAfterActivityFactor`, and `aggregateMetrics` alongside these.

### Established Patterns
- **Adapter injection:** `mountMetricsScreen` receives `{ root, eventLog, settings }`. No direct `localStorage` or `new Date()` calls inside the module.
- **Reactive subscribe:** `eventLog.subscribe(render)` + `settings.subscribe(render)` both called; return `{ unsubscribe() { sub1(); sub2(); } }`.
- **`Object.freeze` for config:** Any frozen constant objects in metrics-screen.js or metrics.js must use `Object.freeze`.
- **XSS guard:** All cell content (dates, formatted times, duration strings) must be written via `textContent`, never via `innerHTML`.
- **`filterDayRecordsByStage` — 3-arg form:** `filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)`. Import from `day-bucket.js`.
- **TDD:** Unit tests for new `metrics.js` helpers before implementing. Integration tests for `aggregateMetrics()` with memory adapter + fixed clock. E2E test for tab navigation and table rendering.

### Integration Points
- `js/app.js`: add `metricsScreenEl = document.getElementById('metrics-screen')`, add to `SCREENS` map, import `mountMetricsScreen`, call `mountMetricsScreen({ root: metricsScreenEl, eventLog, settings })`.
- `js/ui/bottom-nav.js`: add `'metrics'` to `VALID_TABS`; add 5th entry to `TABS` array with an appropriate SVG path and label "Metrics".
- `index.html`: add `<section id="metrics-screen">` in the correct position (after the accuracy-screen section).
- `sw.js` + `tests/unit/sw-precache.test.js`: add `js/ui/metrics-screen.js` to precache list.

</code_context>

<specifics>
## Specific Ideas

- **Single wide table:** The table will be very wide (14 columns). The sticky-first-column + sticky-header combination requires `position: sticky; left: 0` on first-column cells and `position: sticky; top: 0` on header cells, with `z-index` layering so the top-left corner cell is sticky in both axes simultaneously.
- **Summary rows above per-day rows:** Both live in the same `<table>` element to ensure column widths align automatically. Use separate `<tbody>` elements or a CSS class (`metrics-summary-row`) to apply distinct styling (background colour, separator border) to the Avg/Min/Max rows.
- **Min/Max cell two-line layout:** Value text on line 1, date in a `<span>` or `<small>` on line 2 within the same `<td>`. Both set via `textContent` — no `innerHTML`.
- **SAA cross-day pairing in `aggregateMetrics`:** Iterate `dayRecords` from oldest to newest (internally), pairing each day with the previous day to compute SAA. The first day always gets `null`. Rejected days are excluded from aggregates but still serve as "previous day" anchors for SAA computation of non-rejected days (or not — Claude's discretion; either is defensible).
- **`formatDuration(minutes)`:** `Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm'`. Edge case: 0h values should render as `0h 0m` (not just `0m`), consistent with the Xh Ym contract.

</specifics>

<deferred>
## Deferred Ideas

- **Sparklines/mini-charts per metric column** — visual trend overlay inside the table. Deferred to a future polish phase.
- **CSV/JSON export of the metrics table** — could be a useful companion to the existing JSON export. Deferred; the History screen export pattern already covers the raw event log.
- **Multi-nap support in metrics** — LOG2-01 is v2 scope. The metrics helpers must not assume more than one nap per day; `aggregateMetrics` can note this constraint in a comment.
- **Per-metric column show/hide toggle** — 14 columns may feel overwhelming. A future "column picker" could let the user hide columns they don't care about. Out of scope for Phase 11.

None of the above came up during discussion as in-scope requests; captured here as future considerations.

</deferred>

---

*Phase: 11-Metrics-Screen*
*Context gathered: 2026-07-20*
