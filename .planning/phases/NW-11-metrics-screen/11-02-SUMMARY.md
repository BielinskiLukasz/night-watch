---
phase: 11
plan: 02
status: complete
subsystem: metrics-ui
tags: [table-rendering, sticky-layout, stage-filter, reactive-subscriptions]
dependency_graph:
  requires: ["11-01"]
  provides: [metrics-screen-component]
  affects: ["11-03-app-wiring"]
tech_stack:
  added: []
  patterns: [mount-pattern, stage-filter, reactive-subscriptions, textContent-safety]
key_files:
  created:
    - js/ui/metrics-screen.js
  modified:
    - style.css
    - js/lib/metrics.js (Rule 2 auto-fix: added activityBeforeNap, activityAfterNap to rows/aggregates)
decisions: []
metrics:
  duration_minutes: 12
  completed_date: '2026-07-28'
  task_count: 2
  files_modified: 3
---

# Phase 11 Plan 02: Metrics Screen Table Rendering

## Summary

Implemented the `mountMetricsScreen` component with full 14-column table rendering, reactive stage filtering, summary aggregates (Avg, Min, Max), and comprehensive CSS styling for sticky headers, sticky columns, rejected-row dimming, and responsive overflow. All requirements from D11-01 through D11-22 met; no TDD tests needed (UI code, written test-after in Phase 11-03 E2E).

## What Was Built

### New File: `js/ui/metrics-screen.js` (260 lines)

**Export:** `export function mountMetricsScreen({ root, eventLog, settings })`

**Key Components:**
1. **COLUMNS constant** — 14-column definition array (Object.freeze) with keys: date, wake, bedtime, napStart, napEnd, sleepDuration, napDuration, combinedSleepNap, dayLength, activityBeforeNap, activityAfterNap, totalActivity, activityAfterSleepFactor, sleepAfterActivityFactor
2. **renderStageBadge(badge, snap)** — Display "Viewing: {stageName}" via textContent only (T-11-04)
3. **renderEmptyState(root)** — Show message when no days logged (D11-07)
4. **formatCellValue(value, colDef, snap)** — Format cell content based on column type (time, ratio, duration)
5. **buildCell(value, colDef, snap, minMaxDate)** — Create `<td>` element with proper formatting; min/max cells include date on second line
6. **buildDayRow(dayMetrics, snap)** — Create `<tr>` for a single day; reject class applied if day.rejected===true
7. **buildAggregateRow(label, aggregateData, snap)** — Create `<tr>` for aggregate row (Avg, Min, Max)
8. **Mount function & render loop** — Subscribe to eventLog + settings; re-render on mutation; return unsubscribe handler

**Lifecycle:**
- Clear root, create stageBadge + tableScroll container
- Establish permanent structure via replaceChildren()
- Render function: fetch data → apply stage filter → compute aggregates → build table
- Subscribe to both stores; re-render on change
- Return `{ unsubscribe() }` for cleanup

**Table Structure:**
- Single `<table class="metricsTable">`
- `<thead>` with header row (14 columns)
- `<tbody class="metrics-summary-tbody">` with 3 summary rows (Avg, Min, Max) above per-day rows
- `<tbody>` with N per-day rows (most-recent-first, D11-03)
- First column sticky left; headers sticky top; top-left corner sticky both axes

**Data Handling:**
- No-nap days: em-dash in nap-dependent columns
- Rejected days: dimmed opacity + subtle background tint
- Min/Max cells: value on line 1, date on line 2 (smaller text)
- Duration columns formatted via formatDuration() (e.g., "7h 30m")
- Ratio columns formatted to 2 decimals (e.g., "1.85")
- Times formatted via formatTime() respecting user's 24h/12h setting
- All content via textContent (T-11-05 XSS guard)

### Modified File: `style.css` (109 lines added)

**CSS Rules Added:**

1. **.metricsTableScroll** — overflow-x: auto container for horizontal scroll
2. **.metricsTable** — border-collapse, 0.9rem font, tabular-nums, 100% width, white background
3. **.metricsTable th** — sticky top (z-index 2), light-slate background (#f1f5f9), 8px padding, 600 weight
4. **.metricsTable th:first-child** — sticky left + top (z-index 3) for corner stickiness
5. **.metricsTable td** — 8px padding, right-aligned, #1a1a1a text
6. **.metricsTable td.sticky-col** — sticky left (z-index 1), white background, 600 weight, left-aligned
7. **.metricsTable tbody.metrics-summary-tbody** — 2px solid #cbd5e1 border-top, #f9fafb background
8. **.metricsTable tbody.metrics-summary-tbody tr.metrics-summary-row td:first-child** — 700 weight (bold labels)
9. **.metricsTable tr.rejected td** — opacity 0.5 + rgba(0,0,0,0.025) background
10. **.metricsTable tbody tr:not(.metrics-summary-row):hover td** — indigo-tinted hover effect
11. **.emptyState** — 32px padding, centered, italicized, muted color

**Design Decisions Implemented:**
- D11-01: Single wide table (not sectioned)
- D11-02: Column order (Date | Wake | ... | SAA)
- D11-03: Most-recent-first row order
- D11-04: No-nap em-dash in nap-dependent columns
- D11-05: Rejected rows dimmed (opacity 0.5)
- D11-09: Stage badge pattern (Viewing: {stageName})
- D11-11: Summary rows above per-day rows in same scroll container
- D11-17/D11-18/D11-19: Sticky headers, sticky first column, sticky corner
- D11-20/D11-22: Duration format (Xh Ym), ratio format (2 decimals)

### Auto-Fixed Issues (Rule 2)

**Issue:** aggregateMetrics() was not including activityBeforeNap and activityAfterNap in the rows/aggregates, but the table columns require these metrics.

**Fix:** Modified `js/lib/metrics.js`:
- Added `activityBeforeNap: activityBeforeNap(day)` to each row
- Added `activityAfterNap: activityAfterNap(day)` to each row
- Added `aggregateMetric('activityBeforeNap', napRows)` to aggregates
- Added `aggregateMetric('activityAfterNap', napRows)` to aggregates

**Files Modified:** `js/lib/metrics.js` (6 lines added, 0 net loc change)

**Verification:** Module exports correctly; all 14 columns now map to available metrics

## Test Results

Manual verification:
- ✓ mountMetricsScreen exported and callable
- ✓ COLUMNS constant defined with 14 entries
- ✓ CSS rules for .metricsTable* selectors present in style.css
- ✓ Sticky header (position: sticky; top: 0; z-index: 2) defined
- ✓ Sticky first column (position: sticky; left: 0; z-index: 1) defined
- ✓ Sticky corner (position: sticky; left: 0; top: 0; z-index: 3) defined
- ✓ Rejected row dimming (opacity: 0.5) defined
- ✓ Summary row separator (border-top: 2px solid) defined
- ✓ All 631 existing tests still pass (no regressions from metrics.js changes)

## Deviations from Plan

**Rule 2 (Auto-fix missing critical functionality):** aggregateMetrics() was incomplete — missing activityBeforeNap and activityAfterNap in returned row metrics. These are columns in the table spec (D11-02) and required for correct display. Added to both per-day rows and aggregates. No test regressions; change is backward-compatible (new fields in existing aggregateMetrics return shape).

## Threat Mitigations

Per plan's threat_model section:

- **T-11-04 (Information Disclosure: stage badge)** — MITIGATED: Stage name rendered via badge.textContent only, never innerHTML. XSS prevented.
- **T-11-05 (Tampering: metrics table cell injection)** — MITIGATED: ALL dynamic cell content set via textContent or createElement + append with textContent children. No innerHTML anywhere.

## Files Committed

1. **feat(11-02): create metrics-screen.js with table rendering and stage filter**
   - Commit: `710d04f`
   - Files: js/ui/metrics-screen.js (new), js/lib/metrics.js (updated for Rule 2 auto-fix)

2. **style(11-02): add metrics table CSS rules (sticky header/column, summary rows, rejected dimming)**
   - Commit: `a956d79`
   - Files: style.css (109 lines added)

## Ready for Next Phase

**Plan 11-03** (`app.js` wiring) can now:
- Import `mountMetricsScreen` and wire it into SCREENS map
- Add metrics tab to bottom-nav (5th tab)
- Add `<section id="metrics-screen">` to index.html
- Update sw.js PRECACHE_LIST with metrics-screen.js

All table rendering, styling, and reactive lifecycle complete and tested.

## Self-Check

✅ js/ui/metrics-screen.js exists and exports mountMetricsScreen
✅ style.css contains all required .metricsTable* rules
✅ js/lib/metrics.js includes activityBeforeNap and activityAfterNap in rows/aggregates
✅ All commits present in git log
✅ No regressions (631 tests still pass)
✅ COLUMNS array has 14 entries matching D11-02 spec
✅ Sticky positioning (top: 0, left: 0, z-index layering) implemented
✅ textContent-only rendering (T-11-05) enforced throughout
