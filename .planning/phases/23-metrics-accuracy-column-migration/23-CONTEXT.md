# Phase 23: Metrics→Accuracy Column Migration - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the 12 per-day TIF window columns currently rendered on the Metrics screen's per-day table — min, max, and confidence score for each of the 4 event types (wake, nap-start, nap-end, bedtime) — to a new per-day table on the Accuracy screen, and remove them and their data-prep call site from the Metrics screen entirely.

The Accuracy screen today has no per-day rows at all — only a single aggregate summary (the 4×3 classic grid, or the TIF windowHit%/avgWidth/highConf% table when TIF is the active algorithm). This phase adds a genuinely new per-day table to that screen; it is not a rename or a toggle.

**Requirements this phase satisfies:** UI-11

**Out of scope:** No new "window width" field (see D-04 — ROADMAP wording named a 4th field that was never shipped; this phase moves exactly the 3 fields that exist). No changes to the existing TIF summary grid's own computation (`computeTifAccuracy`/`computeTifBoundsHistory` call for the summary stays as-is).

</domain>

<decisions>
## Implementation Decisions

### Accuracy Screen Placement (UI-11)

- **D-01:** The 12 migrated columns become a new per-day table added *below* the existing TIF summary table on the Accuracy screen — not a merge/redesign of the existing 4×3 or TIF summary grids. — **Reversibility:** reversible

- **D-02:** The new per-day table is appended inside the same `<section>` that `renderTifAccuracy()` already builds in `accuracy-screen.js` (one `root.replaceChildren(section)` call, section now contains: existing `<h2>TIF Accuracy</h2>` + summary table + new sub-heading + new per-day table). No restructuring of the TIF/Classic branch split. — **Reversibility:** reversible

- **D-03:** The new per-day table gets its own sub-heading (e.g. `<h3>Per-Day TIF Windows</h3>`) to visually distinguish it from the summary table above it. — **Reversibility:** reversible

- **D-04:** No new "window width" column. ROADMAP.md's phase description says "lower bound, upper bound, confidence score, window width," but the shipped code (`TIF_COLUMNS` in `metrics-screen.js`) only ever had 3 fields per event (min, max, confidence) — no width field exists anywhere today. This phase moves exactly those 3 fields × 4 events = 12 columns; width is left as trivially derivable (max − min) by the reader, not computed. — **Reversibility:** reversible

### Per-Day Table Format & Scope

- **D-05:** The new table matches Metrics screen's existing per-day table conventions exactly: sticky-left Date column, most-recent-first row order, same time/percentage formatting helpers (`formatTime`, `.toFixed(2)` for confidence). — **Reversibility:** reversible

- **D-06:** The new table shows full history (every logged day), matching what Metrics screen shows today — not scoped down to the TIF rolling window (`snap.tifRollingDays`). Pure relocation of visible data, no reduction in what's visible to the user. — **Reversibility:** reversible

- **D-07:** Rejected days are visually dimmed in the new table (same `.rejected` CSS class Metrics screen applies), even though `computeTifBoundsHistory`'s returned entries don't carry a `rejected` flag themselves. Implementation must cross-reference each date back to the `days` array (already available in `accuracy-screen.js`'s `render()`) to look up the rejected flag. — **Reversibility:** reversible

### Visibility Gating

- **D-08:** The new per-day table is visible only when TIF is the active algorithm (`snap.forecastAlgorithm === 'tif'`) — it lives entirely inside the existing `renderTifAccuracy()` path, which already only runs in that branch. This matches Metrics screen's current `td.hidden = !isTif` gating (no dashes-everywhere fallback for Classic users). — **Reversibility:** reversible

### Metrics Screen Cleanup (removal)

- **D-09:** Full clean removal, not a hide-only toggle. Delete the `TIF_COLUMNS` constant and every rendering site that references it in `metrics-screen.js`: `buildDayRow`'s 12-cell loop, `buildTifAggregateRow`'s 12 placeholder `'—'` cells, `buildRollingSection`'s two placeholder-cell loops (7-day and 14-day sections), the thead header-building loop, and the summary section's placeholder-cell loop. The Metrics per-day table shrinks from 30 columns (19 base + 12 TIF + comments notwithstanding) to 19 columns. No dead code, no unused constant left behind — matches the project's "delete unused code completely" convention. — **Reversibility:** reversible

- **D-10:** The `computeTifBoundsHistory` import and its call site in `metrics-screen.js` (`tifBoundsArray`/`tifBoundsMap` construction, and the `tifBoundsMap`/`isTif` parameters threaded into `buildDayRow`) are removed entirely — this was metrics-screen.js's only use of that function, and it existed solely to feed the columns being removed. `isTif` itself is NOT removed from `metrics-screen.js` — it is still needed elsewhere (gating `buildTifAggregateRow`'s min-TIF/median-TIF/max-TIF rows and other TIF-only UI unrelated to this phase). Only the `tifBoundsMap`-specific plumbing is removed. — **Reversibility:** reversible

- **D-11:** Confirmed no CSS in the project depends on the Metrics table's current 30-column width/layout (verified: no TIF-specific selectors in `css/*.css`), so no stylesheet changes are anticipated as a side effect of the column-count shrink. — **Reversibility:** reversible

### Claude's Discretion

- Exact heading text for the new sub-heading (D-03) — e.g. "Per-Day TIF Windows" vs. another label — pick the clearest one consistent with the existing "TIF Accuracy" `<h2>`.
- Whether the new per-day table element is a `<table>` (matching Metrics screen's `<table>`-based structure) given `accuracy-screen.js`'s summary grids currently use div-based CSS grid for the classic path but the existing TIF summary *is* already a `<table>` (`buildTifAccuracyGrid`) — follow the `<table>` precedent already established by `buildTifAccuracyGrid` for consistency within the TIF branch.
- Internal function/helper naming for the new per-day table builder in `accuracy-screen.js` (e.g. `buildTifPerDayTable`) and for the date-keyed rejected-flag lookup (D-07).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 23: Metrics→Accuracy Column Migration" — phase summary; note the "window width" wording addressed by D-04
- `.planning/REQUIREMENTS.md` §UI-11 — the single functional requirement this phase satisfies

### Files Being Changed
- `js/ui/metrics-screen.js` — `TIF_COLUMNS` constant (lines ~74-87), `buildDayRow` (~203-249), `buildTifAggregateRow` (~355-382), `buildRollingSection` (~428+, two placeholder loops), thead header-building loop (~762), summary section placeholder loop (~782-791), `computeTifBoundsHistory` import (line 24) and call site (~704-705, 823) — all TIF_COLUMNS-related code removed per D-09/D-10
- `js/ui/accuracy-screen.js` — `renderTifAccuracy()` (~373-393) — new per-day table appended inside its `<section>` per D-02; `buildTifAccuracyGrid` (~227-305) is the existing `<table>`-based precedent to follow structurally for the new table (per Claude's Discretion note above)

### Shared Data Source (already used by both files, not being modified)
- `js/lib/accuracy-tif.js` — `computeTifBoundsHistory(days, snap, activityLog)` returns the per-date bounds array `{ date, wake, napStart, napEnd, bedtime }` where each event field is `{ algMin, algMax, precisionScore }`. `accuracy-screen.js` already calls this for its existing TIF summary computation (`render()`, ~line 426) — the new per-day table reuses that same call, no new computation needed.

### Test Files (must be updated per UI-11's acceptance criteria)
- `tests/unit/metrics-screen.test.js` (or equivalent) — remove/update tests asserting TIF_COLUMNS presence
- `tests/unit/accuracy-screen.test.js` (or equivalent) — add tests asserting the new per-day table renders correctly
- E2E specs under `tests/e2e/` referencing Metrics screen TIF columns or Accuracy screen structure — update to assert columns appear on Accuracy screen and are absent from Metrics screen (explicit ROADMAP.md acceptance criterion)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeTifBoundsHistory(days, snap, activityLog)` from `js/lib/accuracy-tif.js` — already imported and called in `accuracy-screen.js`'s `render()` for the TIF summary; the new per-day table consumes the same returned array, keyed by `.date`
- `formatTime(value, timeFormat)` from `js/lib/time.js` — used by Metrics screen for `algMin`/`algMax` cell formatting; reuse identically in the new Accuracy per-day table
- Metrics screen's `buildDayRow` TIF-cell logic (lines 225-246) — the exact per-cell formatting logic (`split('_tif_')` key parsing, `.toFixed(2)` for confidence, `'—'` for missing data) is the direct template to port into the new Accuracy screen function

### Established Patterns
- **`td.hidden = !isTif` / branch-based TIF gating** — Metrics screen hides TIF cells via `hidden`; Accuracy screen instead fully branches at the top of `render()` (`isTif` selects `renderTifAccuracy` vs `renderAccuracy`), so the new table only needs to exist inside the already-TIF-only `renderTifAccuracy()` — no additional hidden-toggle needed there
- **`<table>` for TIF-specific views** — `buildTifAccuracyGrid` already uses `<table>`/`<thead>`/`<tbody>` (unlike the classic path's div-based CSS grid) — the new per-day table should follow this same `<table>` convention for consistency within the TIF branch
- **Stage filtering already applied before TIF computation** — `accuracy-screen.js`'s `render()` already computes `days` via `filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)` before calling `computeTifBoundsHistory`; the new per-day table automatically inherits correct stage scoping with no extra wiring
- **T-07-06-01 / T-11-05 XSS guard** — both files' existing convention: all cell content via `textContent` only, never `innerHTML`. New table must follow this.

### Integration Points
- `accuracy-screen.js`'s `render()` (~line 400-434) — `days` (stage-filtered) and `activityLog` are already computed here before the `isTif` branch; both are needed inputs for the new per-day table (bounds history + rejected-flag lookup per D-07)
- `metrics-screen.js`'s `render()` (~line 704-705) — the `tifBoundsArray`/`tifBoundsMap` construction site being deleted per D-10

</code_context>

<specifics>
## Specific Ideas

- The confidence-score formatting convention (`.toFixed(2)`) and the `'—'` for missing data, currently in Metrics screen's `buildDayRow` (lines 239-241), should be ported as-is to preserve visual consistency for anyone used to reading these numbers on the old screen.
- No CSS changes are anticipated — verified no TIF-specific selectors exist in `css/*.css` tied to the Metrics table's column count.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-metrics-accuracy-column-migration*
*Context gathered: 2026-09-16*
