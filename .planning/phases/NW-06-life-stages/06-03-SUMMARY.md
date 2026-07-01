---
phase: NW-06-life-stages
plan: "03"
subsystem: ui/today-screen
tags: [stage-selector, forecast-filter, today-screen, e2e]
requirements: [STAGE-02]

dependency_graph:
  requires:
    - NW-06-life-stages/06-01 (DEFAULT_SETTINGS.stages + activeStageId)
    - NW-06-life-stages/06-02 (filterDayRecordsByStage export)
  provides:
    - Stage selector dropdown on Today screen (D6-09)
    - Thin-stage fallback note (D6-11)
    - E2E test coverage for selector show/hide and persistence
  affects:
    - js/ui/today-screen.js (render() + layout)
    - index.html (static skeleton)
    - style.css

tech_stack:
  added: []
  patterns:
    - el() helper for all DOM construction (T-07 XSS invariant)
    - textContent throughout — never innerHTML
    - settings.update() for commit-on-change (consistent with grouping toggle D2-16)
    - document.getElementById for fallback note (rendered inside container after rebuild)

key_files:
  modified:
    - js/ui/today-screen.js
    - index.html
    - style.css
  created:
    - tests/e2e/stages.spec.js

decisions:
  - stageSelectorContainer created in JS (not read from DOM) because mountTodayScreen uses
    root.replaceChildren() which wipes the static HTML skeleton; element is built with el()
    and injected into the replaceChildren() call between quickLog and nextEventCard
  - renderStageSelector() receives the settings store reference for commit-on-change,
    consistent with the grouping toggle pattern (D2-16)
  - document.getElementById('stage-fallback-note') used after renderStageSelector() rebuilds
    the container, since the note element is created inside renderStageSelector each render

metrics:
  duration: "~25 minutes"
  completed: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
  files_created: 1
---

# Phase NW-06 Plan 03: Today Screen Stage Selector Summary

**One-liner:** Stage selector dropdown on Today screen with filterDayRecordsByStage wiring, thin-stage fallback note, and 5 E2E tests covering show/hide, persistence, and fallback behavior.

## What Was Built

### Task 1: Stage Selector UI + Forecast Filter Wiring

**js/ui/today-screen.js:**
- Added `import { filterDayRecordsByStage } from '../lib/stages.js'`
- Added `renderStageSelector(container, stages, activeStageId, settingsStore)` module-level function that builds a `<select>` with an "All data" option (D6-12) plus one option per stage; all text via `textContent` (T-07); fires `settings.update({ activeStageId })` on change
- Created `stageSelectorContainer` element in `mountTodayScreen()` and added it to `root.replaceChildren()` between `quickLog` and `nextEventCard`
- Updated `render()`: computes `allForecastDays` then applies `filterDayRecordsByStage()` when `activeStageId` is set; counts non-rejected days; falls back to all data with `thinStage=true` when fewer than `snap.minDays` valid days (D6-11); calls `renderStageSelector()` and updates `#stage-fallback-note` visibility

**index.html:**
- Added `<div id="stage-selector-container" style="display:none"></div>` to static skeleton between `quickLog` and `#next-event-card` (progressive-enhancement fallback)

**style.css:**
- Appended stage selector CSS block: `#stage-selector-container`, `.stage-selector-wrapper`, `.stage-selector-label`, `.stage-select`, `.stage-fallback-note`; uses CSS custom properties with light-mode fallback values

### Task 2: E2E Tests

**tests/e2e/stages.spec.js** (5 tests, all passing):
1. Selector hidden when no stages exist (D6-09)
2. Selector visible with "All data" + named stage options when stages seeded
3. Selecting a stage persists `activeStageId` in `localStorage`
4. Selecting "All data" resets `activeStageId` to `null`
5. Fallback note visible when active stage has too few valid days (D6-11)

## Deviations from Plan

**1. [Rule 2 - Pattern] stageSelectorContainer created in JS, not read from DOM**
- **Found during:** Task 1 implementation
- **Issue:** Plan said to `document.getElementById('stage-selector-container')` inside `mountTodayScreen()`, but `mountTodayScreen()` calls `root.replaceChildren()` which destroys the static HTML skeleton. Reading the element from the DOM before `replaceChildren()` would return the static node, which would then be detached.
- **Fix:** Created the container element with `el('div', { id: 'stage-selector-container' })` in JS, set `style.display = 'none'`, and included it in the `replaceChildren()` call. The static HTML fallback in `index.html` still serves as a progressive-enhancement skeleton for the no-JS case.
- **Files modified:** js/ui/today-screen.js
- **Commit:** 6321a42

**2. [Rule 2 - Pattern] renderStageSelector receives settings store reference**
- **Found during:** Task 1 implementation
- **Issue:** Plan's `renderStageSelector` signature used a module-level `settings` variable, but in the actual code `settings` is a closure variable inside `mountTodayScreen()`. Module-level functions cannot close over mount-level variables.
- **Fix:** Added `settingsStore` as a 4th parameter to `renderStageSelector()` and passed `settings` at the call site. Matches existing patterns (the grouping toggle also accesses `settings` as a closure variable, but it's inside `mountTodayScreen()` so closure works there).
- **Files modified:** js/ui/today-screen.js
- **Commit:** 6321a42

## Known Stubs

None — the stage selector is fully wired. When `settings.stages` is empty (the default), the container remains hidden and no UI change is visible to the user.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary changes. Stage names are rendered via `textContent` (T-07 XSS invariant maintained).

## Self-Check: PASSED

- js/ui/today-screen.js: FOUND (modified)
- index.html: FOUND (modified)
- style.css: FOUND (modified)
- tests/e2e/stages.spec.js: FOUND (created)
- Commit 6321a42: FOUND (feat(06-03): add stage selector to Today screen with forecast filter wiring)
- Commit e0325e6: FOUND (test(06-03): E2E tests for stage selector show/hide and persistence)
- Unit tests: 307/307 passing
- E2E tests: 5/5 passing
