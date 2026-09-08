# Phase 17: Day-of-Week Patterns - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `dayOfWeekAverages(dayRecords)` to `metrics.js` and a collapsible "Day-of-Week Patterns" section to the Metrics screen. The section shows a standalone 4-column (Weekday | MA | AA | Nap duration | Sleep duration) table with 7 rows — one per weekday — ordered from the user's configured first day of week (Monday or Sunday, defaulting Monday). A new `firstDayOfWeek` setting is added to `db-shape.js`, `settings-validate.js`, and the Settings UI. The section uses `<details>/<summary>` for collapse, starts collapsed by default, and resets to collapsed on every re-render. All data is scoped to the active stage.

</domain>

<decisions>
## Implementation Decisions

### No-Nap Day Handling

- **D-01:** No-nap days are excluded silently from nap-related column averages (MA, AA, nap duration). When all days for a weekday are no-nap days, the cell shows `—`. No annotation or sample count is shown — absence is silent.
- **D-02:** A day is a "no-nap day" when `napStart` is absent. Nap end absence alone does not count.
- **D-03:** When a weekday has a mix of nap and no-nap days, only the nap days contribute to nap-related averages. No indicator of the nap/no-nap split is shown in the table cell — just `—` when the result is null.

### Module Home for dayOfWeekAverages

- **D-04:** `dayOfWeekAverages(dayRecords)` is added as an export of `js/lib/metrics.js` (not a new sibling module). All day-record aggregation logic stays in one file.
- **D-05:** The function computes averages for all columns the Metrics table shows (not only the 4 required by MET-11). The UI section (MET-12) displays 4 columns; the function returning more enables future expansion without a lib change.
- **D-06:** Weekday attribution uses the **wake date**. Consistent with `aggregateMetrics()` date attribution and the subjective-day boundary convention.
- **D-07:** `dayOfWeekAverages()` is a pure grouping function — it expects the caller to pre-filter (stage filter applied, rejected days excluded) before passing `dayRecords` in. Consistent with the `aggregateMetrics()` calling convention.

### Section Placement

- **D-08:** The DoW section appears **between the all-time summary tbody and the per-day tbody** — below the aggregates, above the per-day rows. Rendered as a block-level element outside the main metrics `<table>`, immediately before it in the DOM.

  Actually, since it's a standalone table, the ordering in DOM is: main metrics table (thead → 7-day tbody → 14-day tbody → all-time tbody → per-day tbody), then the DoW `<details>` wrapper below.

  **Correction per discussion:** "Below all-time section, above per-day rows" — since the DoW is a standalone element (not a tbody), it sits between the main metrics table and any other elements below it. The simplest placement is: main metrics table first (aggregates + per-day rows unchanged), then DoW `<details>` section directly below. This keeps the main table intact and avoids DOM restructuring.

- **D-09:** The DoW section is a **standalone 4-column table** (`<details><summary>Day-of-Week Patterns</summary><table>…</table></details>`). Columns: Weekday | MA | AA | Nap duration | Sleep duration. It does NOT share the main metrics table or its column structure.

- **D-10:** Weekday ordering respects a new **`firstDayOfWeek`** setting. Allowed values: `"monday"` (default) or `"sunday"`. Added to:
  - `js/lib/db-shape.js` → `DEFAULT_SETTINGS.firstDayOfWeek = "monday"`
  - `js/lib/settings-validate.js` → validates as `"monday" | "sunday"`
  - Settings modal UI → simple dropdown or radio in the Settings screen

### Collapsibility Mechanism

- **D-11:** The DoW section uses **HTML `<details>/<summary>`** for collapse. No JS click handler needed. The `<summary>` contains the "Day-of-Week Patterns" heading text.
- **D-12:** Section **starts collapsed by default** — `<details>` element has no `open` attribute on render. Consistent with probability-band cards starting collapsed (D9-05).
- **D-13:** Section header label is exactly **"Day-of-Week Patterns"** (matches MET-12 wording). Case styling via CSS if needed.
- **D-14:** Open state **resets to collapsed on every re-render**. `replaceChildren()` rebuilds the DOM; no state tracking between renders. Consistent with D9-06 for prediction cards.

### Claude's Discretion

- CSS class naming for DoW section wrapper, table, rows (e.g., `.metrics-dow-section`, `.metrics-dow-table`) — Claude picks to fit existing naming conventions.
- Whether to extract a `buildDowRow(weekday, avgData)` helper or inline row construction — Claude decides based on readability.
- Settings modal UI widget for `firstDayOfWeek` — dropdown or radio buttons, Claude picks whichever fits the existing Settings modal layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Day-of-Week Patterns — MET-11 and MET-12 (the two requirements this phase satisfies)
- `.planning/ROADMAP.md` §Phase 17 — Goal, success criteria, depends-on note

### Key Source Files
- `js/lib/metrics.js` — Where `dayOfWeekAverages()` will be added; `aggregateMetrics()` at line 230 is the pattern to follow (pure function, caller pre-filters)
- `js/ui/metrics-screen.js` — Metrics screen rendering: table structure, `buildSectionHeaderRow()`, tbody layout, per-day row construction, reactive lifecycle
- `js/lib/db-shape.js` — `DEFAULT_SETTINGS` — new `firstDayOfWeek` setting added here
- `js/lib/settings-validate.js` — Settings validator — `firstDayOfWeek` validation added here
- `js/ui/today-screen.js:227-266` — Existing CSS class collapse pattern for prediction cards (reference only — DoW section uses `<details>` instead)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `aggregateMetrics(dayRecords)` (`metrics.js:230`) — pure function receiving pre-filtered records; `dayOfWeekAverages()` follows the same call convention and should compute individual metrics using the same helpers (`napDuration`, `activityBeforeNap`, `activityAfterNap`, `sleepDuration`, etc.)
- `buildSectionHeaderRow(label, colSpan)` (`metrics-screen.js:~637`) — builds section-header `<tr>` used for rolling sections; DoW section header is a `<summary>` element, not a `<tr>`, so this helper isn't reused but shows the label/CSS pattern
- `buildCell()` and `formatCellValue()` in `metrics-screen.js` — handle `—` for null values; same pattern applies to DoW table cells

### Established Patterns
- **Caller pre-filters** — `aggregateMetrics()` receives already-filtered records (stage filter + rejected exclusion). `dayOfWeekAverages()` must follow the same contract.
- **Wake-date attribution** — `aggregateMetrics()` uses wake date as the day's date identifier. `dayOfWeekAverages()` must do the same for weekday grouping.
- **Collapsed by default + reset on re-render** — D9-05/D9-06 in `today-screen.js`: prediction cards start collapsed and state resets on every `replaceChildren()` rebuild.
- **No midnight-crossing UTC** — time strings are local wall-clock `'YYYY-MM-DDTHH:MM'`. Weekday extraction must use `new Date(wakeStr + 'T00:00')` or string slicing, never `new Date(wakeStr)` which could UTC-shift the day.

### Integration Points
- `render()` in `metrics-screen.js` — DoW section is constructed inside `render()`, after the main table, using the stage-filtered `days` array (same `filterDayRecordsByStage` result used by rolling sections)
- `mountMetricsScreen(root, deps)` — receives `snap` which includes `settings`; `snap.settings.firstDayOfWeek` drives weekday ordering
- Settings modal in `js/ui/settings-screen.js` (or equivalent) — new `firstDayOfWeek` UI control wired to settings store

</code_context>

<specifics>
## Specific Ideas

- DoW table column order: **Weekday | MA | AA | Nap duration | Sleep duration** — exactly matching MET-12.
- Weekday cell labels: abbreviated day names (Mon, Tue, Wed, Thu, Fri, Sat, Sun) — readable at a glance, consistent with date formatting elsewhere.
- `<details>` renders with no `open` attribute — collapsed by default. No JS needed for toggle.
- `firstDayOfWeek` default is `"monday"`. Stored as lowercase string in settings JSON.

</specifics>

<deferred>
## Deferred Ideas

- First-day-of-week with any weekday (Mon–Sun, 7 options) — user chose Monday/Sunday only for this phase; full 7-option flexibility is a future enhancement.
- Persisting the DoW section open/closed state across re-renders — deferred per D-14; can be added later if UX feedback warrants it.

</deferred>

---

*Phase: 17-Day-of-Week Patterns*
*Context gathered: 2026-09-02*
