---
status: investigating
trigger: "G-NW-11-6: Duration values wrap to two lines in metrics table"
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — `.metricsTable td` cells lack `white-space: nowrap`, causing space-separated values like "7h 30m" to wrap when column width is constrained
test: Examined style.css rule for `.metricsTable td` (line 1643-1648)
expecting: CSS rule missing `white-space: nowrap`; metrics-screen.js applies no width constraints to duration columns
next_action: ROOT CAUSE CONFIRMED — proceed to diagnosis

## Symptoms

expected: "7h 30m" displays on a single line
actual: "7h" on line 1, "30m" on line 2 — text wraps within the column
errors: None reported
reproduction: Observed in duration columns (Sleep, Nap, Combined, Day Length, Activity) in Metrics table
started: Discovered during Phase NW-11 UAT (Test 6, GAP G-NW-11-6, severity: cosmetic)

## Eliminated

(none — root cause identified in first investigation)

## Evidence

- **2026-07-29:** Read style.css (line 1643-1648): `.metricsTable td` has NO `white-space: nowrap` rule. Current rule is:
  ```css
  .metricsTable td {
    padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0;
    text-align: right;
    color: #1a1a1a;
  }
  ```
  Missing: `white-space: nowrap`

- **2026-07-29:** Read metrics-screen.js (lines 39-54): COLUMNS definition for duration columns has NO width specifications:
  - sleepDuration (line 45)
  - napDuration (line 46)
  - combinedSleepNap (line 47)
  - dayLength (line 48)
  - activityBeforeNap (line 49)
  - activityAfterNap (line 50)
  - totalActivity (line 51)

- **2026-07-29:** Read buildCell() function (line 132): Creates `<td>` elements; only adds `sticky-col` class; no width or text-wrapping classes applied to duration cells.

- **2026-07-29:** Confirmed in UAT document (.planning/phases/NW-11-metrics-screen/11-UAT.md, line 76-83):
  Gap G-NW-11-6 reports: "column width is too small, duration wraps to two lines: 7h / 30m"
  Severity: cosmetic

## Resolution

root_cause: ".metricsTable td" CSS rule (style.css line 1643-1648) is missing the `white-space: nowrap` declaration. Without this, the browser wraps space-separated duration values (e.g., "7h 30m") to multiple lines when the column width is narrow.
fix: (n/a — diagnosis only)
verification: (n/a)
files_changed: []
