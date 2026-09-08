# Phase 16: Rolling Window Aggregates - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Add 7-day and 14-day rolling aggregate sections to the Metrics screen, each showing avg/min-with-date/max-with-date for all base metric columns, computed from the N most recent non-rejected days in the active stage. The three aggregate sections (7-day rolling, 14-day rolling, all-time) must be visually distinguished. When fewer than N non-rejected days are available, the corresponding section renders `—` in all cells with an inline day-count note.

</domain>

<decisions>
## Implementation Decisions

### Section Layout

- **D-01:** One table, three `<tbody>` sections — 7-day rolling, 14-day rolling, and all-time each get their own `<tbody>`. Each section starts with a full-width section-header row (`<td colspan=all>`) followed by Min / Avg / Max rows. Column widths stay locked across all sections because they share a single table.
- **D-02:** Section labels: **"7-day rolling"**, **"14-day rolling"**, **"All-time"** (exact casing).
- **D-03:** Section-header rows are styled like `<thead> <th>` — muted background, bold, uppercase. Use existing header CSS or add a new `.metrics-section-header` class that mirrors it.
- **D-04:** TIF aggregate rows (min-TIF / median-TIF / max-TIF) stay in the all-time section only, appended to the all-time `<tbody>` after Max — exactly as in the current structure. No restructuring of existing all-time tbody.
- **D-05:** Rolling sections' Min/Avg/Max rows render `—` (em-dash) in every TIF bound column. No per-window TIF computation needed.

### Section Ordering

- **D-06:** Top-to-bottom order within the summary area: **7-day rolling → 14-day rolling → All-time**. Most-recent-first — the most actionable window is at the top.
- **D-07:** Aggregates (all three sections) appear **above** the per-day rows. Existing layout order is preserved: aggregates first, per-day rows below.

### Data Slicing

- **D-08:** "N most recent non-rejected days" uses the same filter as the existing `aggregateMetrics` logic: exclude days where `rejected === true`. No stricter filtering (e.g., requiring non-null metrics). Take the N most recent from the stage-filtered, oldest-first `reversedDays` array (i.e., `reversedDays.slice(-N)` for the N most recent).

### Cold-Start Behavior

- **D-09:** When fewer than N non-rejected days exist, the section-header row text includes a day-count note: e.g., **"7-day rolling (3 days available)"**. When the window is fully satisfied (≥ N days), the section-header shows the plain label only.
- **D-10:** Even when insufficient days exist, Min/Avg/Max rows are still rendered — all cells show `—`. The full row structure is always present; only values change to `—`.

### Claude's Discretion

- CSS class name for section-header rows (`.metrics-section-header` or similar) — Claude picks whatever fits existing naming conventions.
- Whether to extract a `buildRollingSection(nDays, label, reversedDays, snap)` helper or inline the logic — Claude decides based on DRY without over-abstracting.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Rolling Window Aggregates — MET-09 and MET-10 (the two requirements this phase satisfies)
- `.planning/ROADMAP.md` §Phase 16 — Goal, success criteria, depends-on note

### Key Source Files
- `js/ui/metrics-screen.js` — Full Metrics screen rendering: table structure, `buildAggregateRow()`, `buildTifAggregateRow()`, `computeTifTrimmedStats()`, current summary tbody structure
- `js/lib/metrics.js` — `aggregateMetrics(dayRecords)` — returns `{ rows, avg, min, max }`; the rolling computation is a slice of this call
- `js/lib/stages.js` — `filterDayRecordsByStage()` — must be applied before slicing for rolling windows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildAggregateRow(label, aggregateData, snap)` (`metrics-screen.js:254`) — already handles min-with-date / max-with-date formatting for all base columns. Rolling sections call this directly with a rolling-sliced `aggregateMetrics` result.
- `aggregateMetrics(dayRecords)` (`metrics.js:230`) — pure function; calling it on `reversedDays.slice(-7)` or `reversedDays.slice(-14)` gives 7-day / 14-day rolling aggregates. No new lib logic needed.
- `buildCell()` and `formatCellValue()` — already used by `buildAggregateRow`, handles `—` for null values.

### Established Patterns
- **tbody grouping** — the table already uses separate `<tbody>` elements for summary rows and per-day rows. Adding rolling tbodies follows this pattern.
- **TIF column visibility** — TIF cells in existing rows use `hidden` attribute driven by `isTif`. Rolling rows must follow the same pattern: TIF cells present in DOM but showing `—` content (not hidden).
- **Stage filter** — `filterDayRecordsByStage(allDays, snap.stages, snap.activeStageId)` is applied to get `days` before reversing. Rolling slices must come from the already-filtered `reversedDays`, not from `allDays`.
- **Oldest-first for `aggregateMetrics`** — `aggregateMetrics` expects oldest-first (needed for `prevDay` sleep-duration pairing). `reversedDays` is already oldest-first. Slice from the tail: `reversedDays.slice(-N)` gives the N most recent in oldest-first order.

### Integration Points
- **`render()` function** (`metrics-screen.js:~440`) — rolling tbody construction happens inside `render()`, after the existing `aggregateMetrics(reversedDays)` call, using the same `reversedDays` array sliced to 7 and 14.
- **`summaryTbody` → replaced by three tbodies** — the single `metrics-summary-tbody` becomes three separate tbodies (7-day, 14-day, all-time). The all-time tbody retains the existing TIF rows.

</code_context>

<specifics>
## Specific Ideas

- Section-header text exactly: `"7-day rolling"`, `"14-day rolling"`, `"All-time"` — uppercase styling applied via CSS, not in the string.
- Cold-start annotation format: `"7-day rolling (N days available)"` where N is the actual count of non-rejected days available (not the window size).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-Rolling Window Aggregates*
*Context gathered: 2026-08-31*
