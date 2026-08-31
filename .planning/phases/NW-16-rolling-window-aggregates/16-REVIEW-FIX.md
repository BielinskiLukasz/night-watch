---
phase: NW-16-rolling-window-aggregates
fixed_at: 2026-08-31T00:00:00Z
review_path: .planning/phases/NW-16-rolling-window-aggregates/16-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase NW-16: Code Review Fix Report

**Fixed at:** 2026-08-31
**Source review:** .planning/phases/NW-16-rolling-window-aggregates/16-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: All-time Min/Average/Max rows missing 12 TIF placeholder cells when TIF is active

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** 70cf073
**Applied fix:** Inserted the same TIF placeholder cell injection loop used by `buildRollingSection` immediately after building the three all-time aggregate rows (minRow, avgRow, maxRow) and before appending them to `summaryTbody`. Each row now gets 12 hidden `<td>` cells (or visible when TIF is active), matching the column count of every other row in the table.

### WR-01: Stale "indices 1-15" comment appears in two docstrings; COLUMNS has 18 entries (indices 0-17)

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** a065d29
**Applied fix:** Updated both occurrences — the `computeTifTrimmedStats` docstring (line 280) and the `buildTifAggregateRow` inline comment (line 358) — from "indices 1-15" to "indices 1-17" to match the actual 18-element COLUMNS array.

### WR-02: `.metrics-section-header` inherits `text-align: right` — section labels appear right-aligned

**Files modified:** `style.css`
**Commit:** 5a1d48e
**Applied fix:** Added `text-align: left;` to the `.metricsTable td.metrics-section-header` rule, overriding the inherited `text-align: right` from the general `.metricsTable td` rule. Section labels now align to the left edge.

### WR-03: `.stage-select` uses dark-theme CSS variable fallbacks in a light-themed app

**Files modified:** `style.css`
**Commit:** 1fab50e
**Applied fix:** Replaced the three CSS variable references (`var(--color-border, #333)`, `var(--color-bg-input, #1a1a2e)`, `var(--color-text, #e0e0e0)`) with concrete light-theme values consistent with the rest of the UI (`border: 1px solid #cbd5e1`, `background: #fff`, `color: #334155`).

### WR-04: Seeded events in E2E tests are missing `id` fields — may silently bypass schema validation

**Files modified:** `tests/e2e/metrics.spec.js`
**Commit:** a39aa61
**Applied fix:** Added stable synthetic `id` fields to all seeded events across all six seed blocks. For the single-event seed (MET-06 stage badge test), added `id: 'test-wake-1'` and `id: 'test-bedtime-1'`. For the five loop-based seed blocks (MET-09, MET-10 boundary tests × 4), added `id: 'test-wake-' + dayNum` and `id: 'test-bedtime-' + dayNum` to each push call, using the `dayNum` variable already in scope.

---

_Fixed: 2026-08-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
