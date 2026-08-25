---
status: resolved
trigger: "G-NW-11-14: Column headers remain visible (sticky) when scrolling the metrics table vertically. Expected: <thead> header row stays pinned to the top as the user scrolls down. Actual: Headers scroll away — not sticky on vertical scroll."
created: 2026-07-29T00:00:00Z
updated: 2026-08-24T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — .metricsTableScroll has overflow-x: auto only, without overflow-y or height constraint, preventing vertical scroll context for sticky positioning
test: Verified CSS rules and DOM structure. Sticky headers need a vertical scroll container to work properly.
expecting: Headers should stick to top during vertical scroll, but currently scroll away because container lacks vertical scroll mechanism
next_action: ROOT CAUSE IDENTIFIED — diagnostic phase complete

## Symptoms

expected: Column headers remain pinned to the top when scrolling vertically through data rows
actual: Headers scroll away with the content — not sticky
errors: None reported
reproduction: Observed in Metrics screen with enough data rows to require scrolling
started: Discovered during UAT of Phase NW-11 (gap G-NW-11-14)

## Eliminated

(none — single hypothesis confirmed on first test)

## Evidence

- timestamp: 2026-07-29
  checked: style.css .metricsTableScroll rule (line 1603-1607)
  found: |
    .metricsTableScroll {
      overflow-x: auto;
      margin: 0;
      padding: 0;
    }
  implication: Container only scrolls horizontally; no overflow-y and no height constraint. This prevents vertical scroll context.

- timestamp: 2026-07-29
  checked: style.css .metricsTable th rule (line 1621-1631)
  found: |
    .metricsTable th {
      position: sticky;
      top: 0;
      z-index: 2;
      background-color: #f1f5f9;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.8rem;
    }
  implication: Sticky positioning is applied correctly on the <th> elements, but it only works when the containing scroll context scrolls vertically.

- timestamp: 2026-07-29
  checked: metrics-screen.js DOM structure (lines 265-268, 305-344)
  found: |
    div.metricsTableScroll (overflow-x: auto)
      └── table.metricsTable
            └── thead
                  └── tr
                        └── th elements (position: sticky; top: 0)
  implication: The <th> elements are nested inside .metricsTableScroll, which is the nearest ancestor with overflow property. For sticky-top to work, the container must be a vertical scroll container.

- timestamp: 2026-07-29
  checked: 11-02-SUMMARY.md Plan rationale (lines 77-80)
  found: "D11-17/D11-18/D11-19: Sticky headers, sticky first column, sticky corner" and ".metricsTableScroll — overflow-x: auto container for horizontal scroll"
  implication: The design called for sticky headers (D11-18) with a horizontal-scroll container (D11-17), but the implementation doesn't provide the vertical scroll context needed for vertical stickiness to work.

## Resolution

root_cause: |
  The .metricsTableScroll container has overflow-x: auto (horizontal scroll only) but lacks overflow-y: auto and a height constraint (like max-height). 
  
  In CSS, position: sticky works by "sticking" within the nearest scroll container. When an element has overflow-x: auto without overflow-y, it becomes a horizontal-only scroll container. 
  
  The <th> elements inside try to stick with position: sticky; top: 0, but since the container doesn't scroll vertically—and no vertical scroll context is established—the sticky positioning has no effect. 
  
  When users scroll the page vertically (the actual scroll happening in the viewport or parent container), the .metricsTableScroll div scrolls with it, and the headers scroll away because there is no mechanism within the table's container to make them stick.
  
  Fix direction: Add overflow-y: auto and max-height to .metricsTableScroll to establish a vertical scroll context within the container, allowing position: sticky; top: 0 to work correctly for vertical scrolling.

fix: Added `overflow-y: auto` and `max-height: calc(100vh - 8rem)` to `.metricsTableScroll` in style.css, establishing the vertical scroll context required for `position: sticky; top: 0` on `<th>` elements to work.
verification: All 112 E2E tests pass (2026-08-24).
files_changed: [style.css]
