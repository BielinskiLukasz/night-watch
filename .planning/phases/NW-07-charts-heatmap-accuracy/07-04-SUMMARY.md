---
phase: NW-07
plan: "04"
subsystem: ui-navigation
tags: [bottom-nav, four-screen, ui-refactor, UI-06]
status: complete

dependency_graph:
  requires:
    - "07-02"
    - "07-03"
  provides:
    - bottom-nav-ui
    - four-screen-navigation
    - charts-screen-stub
    - accuracy-screen-stub
  affects:
    - js/ui/header.js
    - js/app.js
    - index.html
    - style.css

tech_stack:
  added:
    - js/ui/bottom-nav.js (new — mountBottomNav, setActiveNavTab)
    - js/ui/charts-screen.js (new — no-op stub, replaced in 07-05)
    - js/ui/accuracy-screen.js (new — no-op stub, replaced in 07-06)
  patterns:
    - VALID_TABS Object.freeze(new Set) security guard
    - delegated click listener with data-tab validation
    - Object.freeze(SCREENS) four-screen map
    - inline SVG via document.createElementNS

key_files:
  created:
    - js/ui/bottom-nav.js
    - js/ui/charts-screen.js
    - js/ui/accuracy-screen.js
  modified:
    - js/ui/header.js
    - js/app.js
    - index.html
    - style.css

decisions:
  - "D7-01: header tab nav removed; navigation moved to bottom-nav.js"
  - "D7-04: SCREENS map uses direct element references (not lazy getters) since elements captured before map construction"
  - "Stub pattern: no-op function export (not a mounted component) — allows ES module graph to load cleanly for E2E spec"

metrics:
  duration_minutes: 26
  completed_date: "2026-06-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 4
---

# Phase NW-07 Plan 04: Bottom Navigation and Four-Screen Layout Summary

**One-liner:** Bottom nav bar (four tabs, fixed position, SVG icons) replaces header tab nav; app.js extended to four-screen visibility toggle; Charts/Accuracy screen stubs enable E2E test coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create bottom-nav.js and simplify header.js | 80d7c14 | js/ui/bottom-nav.js (new), js/ui/header.js |
| 2 | Update index.html, style.css, app.js for four-screen navigation | 6b2283e | index.html, style.css, js/app.js, js/ui/charts-screen.js (new), js/ui/accuracy-screen.js (new) |
| 3 | Verify four-screen navigation via E2E bottom-nav spec | — (no code change; spec was correct from 07-01) | tests/e2e/bottom-nav.spec.js |

## What Was Built

**js/ui/bottom-nav.js** — new module exporting:
- `mountBottomNav({ root, onTabChange })` — renders four-tab bottom nav with inline SVG icons (crescent moon, list, bar chart, bullseye) and text labels; delegates click to VALID_TABS guard before calling onTabChange
- `setActiveNavTab(root, tabId)` — programmatic aria-selected sync without firing onTabChange
- `VALID_TABS = Object.freeze(new Set(['today','history','charts','accuracy']))` — security invariant T-07-04-01

**js/ui/header.js** — simplified:
- Removed VALID_TABS, `onTabChange` parameter, `if (tabNav)` block, `setActiveTab` export
- `mountHeader({ root, settings, onSettings })` — subject name + gear only (D7-01)

**index.html** — structural changes:
- Removed `<nav class="tabNav">` and two tab buttons from header (D7-01)
- Added `<section id="charts-screen">`, `<section id="accuracy-screen">` inside `<main id="app">`
- Added `<nav id="bottom-nav" class="bottomNav">` after `</main>` (D7-04)

**style.css** — layout changes:
- Removed `.tabNav`, `.tabNav button[role="tab"]` rules and responsive override
- Added `.bottomNav` (position:fixed, bottom:0, 56px height, z-index:100)
- Added `.bottomNav .bottomNavTab[aria-selected="true"]` active state
- Added `#app { padding-bottom: 64px }` content compensation (D7-04)
- Added `.chartSection`, `.chartSvg`, `.stageChip`, `.accuracyGrid`, `.coldStartNote` chart stubs

**js/app.js** — composition root:
- Added imports: `mountBottomNav`, `mountChartsScreen`, `mountAccuracyScreen`
- Removed `setActiveTab` import from header.js
- Added element references: `chartsScreenEl`, `accuracyScreenEl`, `bottomNavEl`
- Replaced two-screen `applyTabVisibility` with `Object.freeze(SCREENS)` four-screen map
- Removed `onTabChange` from `mountHeader` call
- Added `mountBottomNav`, `mountChartsScreen`, `mountAccuracyScreen` mount calls

## Verification Results

- `npx playwright test tests/e2e/bottom-nav.spec.js` — **5/5 passed**
  - renders four tab buttons inside #bottom-nav
  - Today tab is active by default (aria-selected="true")
  - clicking Charts tab shows charts screen and hides today screen
  - clicking Accuracy tab shows accuracy screen
  - clicking History tab shows history screen and hides today screen
- Regression suite (history.spec.js, stages.spec.js, quick-log.spec.js) — **42/42 passed**
- Unit tests (accuracy, chart-data, day-bucket, forecast, stages, time) — **207/207 passed**

## Deviations from Plan

None — plan executed exactly as written. The bottom-nav.spec.js stub from 07-01 was already correct; no reconciliation changes were needed for Task 3.

## Security Notes

- T-07-04-01 (tab ID injection): MITIGATED — VALID_TABS guard in click handler
- T-07-04-02 (SVG path as user content): ACCEPTED — path data is static literals in TABS array
- T-07-04-03 (stageChip via textContent): MITIGATED — span.textContent used for labels

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `mountChartsScreen() {}` | js/ui/charts-screen.js | 7 | No-op stub; full implementation in Plan 07-05 |
| `mountAccuracyScreen() {}` | js/ui/accuracy-screen.js | 7 | No-op stub; full implementation in Plan 07-06 |

These stubs are intentional wave-3 scaffolding — they allow the ES module graph to load cleanly and the bottom-nav E2E test to run without depending on chart implementations.

## Self-Check: PASSED

- js/ui/bottom-nav.js — FOUND
- js/ui/charts-screen.js — FOUND
- js/ui/accuracy-screen.js — FOUND
- js/ui/header.js (simplified) — FOUND
- js/app.js (updated) — FOUND
- index.html (tabNav removed, new sections added) — FOUND
- style.css (bottomNav rules added) — FOUND
- Commit 80d7c14 — FOUND (Task 1)
- Commit 6b2283e — FOUND (Task 2)
- All E2E bottom-nav tests: 5/5 PASSED
- Regression tests: 42/42 PASSED
