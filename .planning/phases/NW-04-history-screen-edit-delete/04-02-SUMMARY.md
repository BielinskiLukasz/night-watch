---
phase: NW-04-history-screen-edit-delete
plan: 02
subsystem: ui
tags: [history-screen, tab-navigation, table, css, e2e, d4-07, d4-01, d4-02, d4-03, d4-08, d4-10]

# Dependency graph
requires:
  - phase: NW-04-history-screen-edit-delete
    plan: 01
    provides: "day.rejected boolean from settings.rejectedDays in daysByCalendar output"
  - phase: NW-03-forecast-engine-today-screen
    provides: "today-screen.js mountTodayScreen, forecast section, subscribe pattern"
  - phase: NW-02-configuration-settings
    provides: "mountHeader, settings store, formatTime helper"
provides:
  - "mountHeader extended with onTabChange callback and setActiveTab() helper"
  - "mountHistoryScreen(root, eventLog, settings) — day-column table with reactive subscriptions"
  - "Tab navigation Today|History in header with aria-selected state management"
  - "History screen renders in #history-screen section; Today in #today-screen section"
  - "eventLog.daysByCalendar(limit, settings) accepts optional settings for day.rejected annotation"
  - "13 E2E tests covering tab nav, table rendering, rejected rows, empty state, tab persistence"
affects: [NW-04-history-screen-edit-delete wave3, wave4]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab navigation via data-tab / aria-selected pattern — click handler in header.js; applyTabVisibility in app.js controls display"
    - "Day-column table rendered via textContent-only DOM manipulation (T-04-04 XSS mitigation)"
    - "mountHistoryScreen subscribes to both eventLog and settings; re-renders table on any mutation"
    - "Dormant edit/delete buttons disabled=true in Wave 2 Action column; Wave 3 enables them"

key-files:
  created:
    - js/ui/history-screen.js
    - tests/e2e/history.spec.js
  modified:
    - js/ui/header.js
    - js/app.js
    - js/store/event-log.js
    - index.html
    - style.css
    - tests/e2e/manual-entry.spec.js

key-decisions:
  - "mountHistoryScreen mounts to div#history-table-root (inner) while applyTabVisibility toggles section#history-screen (outer) — clean separation between table content and screen visibility"
  - "eventLog.daysByCalendar(limit, settings) extended with optional settings param to forward to day-bucket for day.rejected annotation; all pre-4.x callers omit it safely"
  - "Dormant Action column buttons rendered as disabled=true in Wave 2; Wave 3 removes disabled and adds click handlers — avoids adding/removing DOM nodes between waves"
  - "Tasks executed in order 1→2→3→5→4→6 (index.html before CSS checkpoint; CSS before E2E) since the checkpoint visual verification requires HTML structure and styling to be in place"

requirements-completed: [UI-03]

# Metrics
duration: 29min
completed: 2026-06-06
---

# Phase 4 Plan 02: Header Tab Navigation & History Screen UI Foundation Summary

**Today|History tab navigation wired in header, history-screen.js day-column table renders from eventLog.daysByCalendar with reactive subscriptions, CSS responsive layout, and 13 passing E2E tests**

## Performance

- **Duration:** ~29 min
- **Started:** 2026-06-06T07:13:49Z
- **Completed:** 2026-06-06T07:43:00Z
- **Tasks:** 6 auto tasks (plan had 7 with checkpoint)
- **Files modified:** 6 (+ 2 created)

## Accomplishments

- Extended `js/ui/header.js` with two-tab navigation (Today | History), `onTabChange` callback, and exported `setActiveTab()` helper; aria-selected updated on click
- Created `js/ui/history-screen.js` exporting `mountHistoryScreen({ root, eventLog, settings })` that builds a day-column table from `eventLog.daysByCalendar(Infinity, snap)` with reactive subscriptions to both stores
- Updated `js/app.js` with `activeTab` module-level state, `applyTabVisibility()`, and wired `mountHistoryScreen` to `#history-table-root`
- Updated `index.html` to split `<main>` into `<section id="today-screen">` and `<section id="history-screen" style="display:none;">`
- Added CSS for tab nav (active underline, aria-selected styling), history table layout, rejected-row opacity, responsive breakpoints at 640px
- Extended `eventLog.daysByCalendar(limit, settings)` and `daysBySubjectiveNight(cutoverHour, limit, settings)` with optional settings parameter forwarded to day-bucket for rejection annotation
- Created 13-test `tests/e2e/history.spec.js` covering all D4-0x decisions; all pass

## Task Commits

1. **Task 1: Extend header.js with tab navigation** — `98f17a9` (feat)
2. **Task 2: Create history-screen.js + extend event-log** — `3d555b4` (feat)
3. **Task 3: Wire app.js composition root** — `340ac62` (feat)
4. **Task 5: Update index.html structure** — `fb6784f` (feat) [executed before CSS as prerequisite]
5. **Task 4: CSS styling** — `70adbec` (feat)
6. **Bug fix: scope .rowDel selector** — `b3cc21d` (fix) [Rule 1 auto-fix]
7. **Task 6: E2E tests** — `5e2ae9e` (test)

## Files Created/Modified

- `js/ui/header.js` — Added VALID_TABS, extended mountHeader with onTabChange, exported setActiveTab()
- `js/ui/history-screen.js` (created) — mountHistoryScreen(), buildTable(), buildDayRow(), renderEmptyState()
- `js/app.js` — activeTab state, applyTabVisibility(), mountHistoryScreen wiring, setActiveTab import
- `js/store/event-log.js` — daysByCalendar(limit, settings) and daysBySubjectiveNight(cutoverHour, limit, settings) extended with optional settings
- `index.html` — nav.tabNav added to header; main#app split into section#today-screen + section#history-screen
- `style.css` — Tab nav styles, history table layout, rejected row opacity, responsive breakpoints
- `tests/e2e/manual-entry.spec.js` — Scoped .rowDel to [data-role="events"] .rowDel (Rule 1 fix)
- `tests/e2e/history.spec.js` (created) — 13 E2E tests for history screen

## Decisions Made

- **mountHistoryScreen root is div#history-table-root, not section#history-screen:** The outer `#history-screen` section is toggled by `applyTabVisibility()` via `style.display`; the inner `#history-table-root` is the DOM mount point for `replaceChildren()`. Separating concerns makes it clear what controls visibility vs. table content.
- **eventLog.daysByCalendar optional settings parameter:** Forward the settings snapshot to `_daysByCalendar` so the history table gets `day.rejected` annotations without requiring the UI to import day-bucket directly. Backward compatible — all prior callers (today-screen.js) omit the param.
- **Dormant buttons disabled=true in Wave 2:** The edit/delete buttons are rendered in the table but set to `disabled=true`. Wave 3 removes disabled and wires click handlers. This avoids a structural DOM change between waves and keeps the table column layout stable.
- **Plan task execution order adjusted:** Tasks were executed 1→2→3→5→4→6 instead of 1→2→3→checkpoint→4→5→6 because the checkpoint requires HTML structure and CSS to be in place for visual verification. The plan's checkpoint (Task 4 in sequence) was designed to verify the UI, so Tasks 5 (HTML) and 4 (CSS) needed to precede it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped .rowDel E2E selector to today-screen day list**
- **Found during:** Task 6 (E2E test run discovered pre-existing test was broken)
- **Issue:** The new history table renders `.rowDel` buttons (dormant, `disabled=true`) in the Actions column. The existing `manual-entry.spec.js:105` test used bare `.rowDel` selector which matched buttons in BOTH the today-screen day list AND the history table (hidden but still in DOM), causing `toHaveCount(1)` to receive `2`.
- **Fix:** Changed selector to `[data-role="events"] .rowDel` which targets only the today-screen's event list rows.
- **Files modified:** `tests/e2e/manual-entry.spec.js`
- **Commit:** `b3cc21d`

**2. [Rule 2 - Missing Critical] eventLog.daysByCalendar optional settings parameter**
- **Found during:** Task 2 (history-screen.js implementation)
- **Issue:** The plan called for `eventLog.daysByCalendar(Infinity)` to get all days with `day.rejected` annotation, but the event-log store's `daysByCalendar(limit)` method did not pass settings to the underlying day-bucket function. Without settings, all days would have `day.rejected = false` (annotateRejected fast-path for empty rejectedDays), making D4-10 rejected-row styling non-functional.
- **Fix:** Extended `eventLog.daysByCalendar(limit, settings)` and `eventLog.daysBySubjectiveNight(cutoverHour, limit, settings)` with an optional settings parameter forwarded to `_daysByCalendar` / `_daysBySubjectiveNight`. All 371 unit tests pass unchanged (backward compatible).
- **Files modified:** `js/store/event-log.js`
- **Commit:** `3d555b4`

### Pre-existing Test Failures (not caused by this plan)

**settings-modal.spec.js** — 9 tests fail with "Expected: 'Alice', Received: 'Baby'". Confirmed pre-existing by reverting to `ff8f849` and observing the same failures. Root cause: test isolation issue where localStorage persists across test runs with a "Baby" subject name (the default). These tests passed in Phase 2/3 but degraded in the environment. Logged for Phase 8 hardening.

## Known Stubs

- **Action column buttons (Edit/Delete) are dormant (`disabled=true`):** These are placeholders for Wave 3. They render in the table but do nothing when clicked. Wave 3 will remove `disabled` and add click handlers per the plan.
- **Rejected cell is display-only:** The `✓` indicator in the Rejected column is non-interactive in Wave 2. Wave 4 wires the toggle.

## Threat Flags

No new threat surface. All dynamic content uses `textContent` (T-04-04 mitigated). Tab click handler validates tabId against `VALID_TABS` set before dispatching `onTabChange`. The `data-date` attribute on dormant buttons contains only the YYYY-MM-DD day key from the bucketer (no user-typed input).

## Self-Check: PASSED

- `js/ui/history-screen.js` — FOUND
- `js/ui/header.js` — FOUND (modified)
- `js/app.js` — FOUND (modified)
- `index.html` — FOUND (modified)
- `style.css` — FOUND (modified)
- `tests/e2e/history.spec.js` — FOUND
- `.planning/phases/NW-04-history-screen-edit-delete/04-02-SUMMARY.md` — FOUND
- Commit `98f17a9` — FOUND (header.js tab navigation)
- Commit `3d555b4` — FOUND (history-screen.js + event-log)
- Commit `340ac62` — FOUND (app.js wiring)
- Commit `fb6784f` — FOUND (index.html structure)
- Commit `70adbec` — FOUND (CSS)
- Commit `b3cc21d` — FOUND (Rule 1 bug fix)
- Commit `5e2ae9e` — FOUND (E2E tests)
