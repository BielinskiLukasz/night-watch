---
status: resolved
trigger: "G-NW-11-15: Metrics table does not expand to fill landscape viewport; retains portrait margins"
created: 2026-07-29T00:00:00Z
updated: 2026-08-24T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: Metrics screen container applies fixed padding/margins without landscape media query override
test: Check style.css for .screen-section, #metrics-screen, .metricsTableScroll margin/padding rules; verify landscape @media rules exist and reduce margins
expecting: Find either (a) no landscape media query for metrics screen, or (b) landscape query that doesn't eliminate margins
next_action: Read style.css to identify margin/padding rules and landscape media query coverage

## Symptoms

expected: In landscape orientation, metrics table expands to fill wider viewport with reduced or no side margins
actual: Metrics table retains same margins as portrait view, wasting horizontal space
errors: None reported
reproduction: Rotate device/browser to landscape → observe metrics table width unchanged
started: Discovered during UAT of Phase NW-11

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-07-29
  checked: "(initial setup)"
  found: "Gap ID G-NW-11-15 assigned with clear reproduction steps"
  implication: "Issue is deterministic (landscape rotation) and reproducible"

- timestamp: 2026-07-29
  checked: "style.css root container rules"
  found: "body { padding: 1.5rem } (line 19-20); #app { max-width: 32rem; margin: 0 auto } (line 75-76); #metrics-screen class is .screen-section (index.html line 120)"
  implication: "All screen-sections inherit body padding of 1.5rem on all sides, limiting available width to 32rem max regardless of viewport"

- timestamp: 2026-07-29
  checked: ".screen-section responsive rules in style.css"
  found: "Only one landscape-adjacent media query found: @media (min-width: 800px) for #history-screen applies padding: 0 1rem (line 802-806). No @media (orientation: landscape) rules exist for .screen-section or #app"
  implication: "History screen has a desktop-width breakpoint but .screen-section padding/margin is not responsive to landscape; #app max-width is never adjusted for wider viewports"

- timestamp: 2026-07-29
  checked: ".metricsTableScroll container styling"
  found: ".metricsTableScroll { overflow-x: auto; margin: 0; padding: 0 } (line 1603-1607); table is inside #metrics-screen > .metricsTableScroll > .metricsTable"
  implication: "Table container has no margins, but is constrained by parent #app (max-width 32rem) and body padding (1.5rem); reducing container margins has no effect on the actual horizontal space available"

## Resolution

root_cause: ".screen-section (and its parent #app) lack a landscape media query to reduce side padding/margins or increase max-width when viewport is in landscape orientation. Body padding of 1.5rem applies uniformly in both portrait and landscape, and #app max-width of 32rem is never increased for wider screens. History screen has a @media (min-width: 800px) rule that adds padding for desktop, but this is width-based not orientation-based, and does not apply to the metrics screen or other sections."

fix: Added `@media (orientation: landscape)` block in style.css reducing body padding to 0.75rem and increasing #app max-width to 48rem.
verification: All 112 E2E tests pass (2026-08-24).
files_changed: [style.css]
