---
phase: NW-04-history-screen-edit-delete
plan: 03
subsystem: ui
tags: [history-screen, edit, delete, manual-entry, event-log, forecast, subscriber, playwright, node-test]

# Dependency graph
requires:
  - phase: NW-04-history-screen-edit-delete
    plan: 02
    provides: "History table (read-only) with day-column layout, Actions column placeholder, dormant edit/delete buttons"
  - phase: NW-01-log-persist
    plan: 04
    provides: "openManualEntry(mode='edit') API, editEvent(), deleteEvent(), notifySubscribers() subscriber pattern"
  - phase: NW-03-forecast-engine-today-screen
    plan: 05
    provides: "D3-12 subscriber pattern wired: forecast re-computes on every eventLog mutation"
provides:
  - "Per-event [Edit] buttons in time cells; click handler opens manual-entry modal with mode='edit' and pre-populated data"
  - "Per-row [Delete] buttons in Actions column; window.confirm() dialog + deleteEvent() for all events on that date"
  - "Forecast reactivity: editEvent() and deleteEvent() fire notifySubscribers() -> history re-renders + Today forecast updates"
  - "6 new E2E Playwright tests covering edit workflow (modal, pre-population, save, re-render) and delete workflow (confirm, cancel, row removal, empty state)"
  - "10 new integration tests verifying subscriber fires, forecast re-computes, and rejection downweighting shifts the P50 median"
affects:
  - NW-04-history-screen-edit-delete/04-04
  - NW-05-import-export
  - NW-08-pwa-hardening

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stale-reference mitigation (T-04-07): always re-fetch event from eventLog.listEvents() before opening edit modal"
    - "Synchronous window.confirm() for delete confirmation (D4-06 / Phase 1 pattern)"
    - "Subscriber-reactive re-render: editEvent/deleteEvent -> notifySubscribers -> render callback (D3-12)"
    - "localStorage fixture seeded in E2E beforeEach via page.evaluate() for deterministic multi-day test data"
    - "Playwright dialog interception: page.once('dialog', d => d.accept()/dismiss()) for window.confirm() in E2E"

key-files:
  created:
    - tests/integration/edit-delete-flow.test.js
  modified:
    - js/ui/history-screen.js
    - tests/e2e/history.spec.js

key-decisions:
  - "D4-04 edit affordance is per-event (not per-row): each time cell gets its own [Edit] button that pre-populates the existing event's type/date/time"
  - "D4-06 delete affordance is per-row (per day): a single [Delete] button in the Actions column deletes all events on that calendar date"
  - "D4-09 forecast re-computes only on Save (modal onSave callback calls editEvent; subscriber fires synchronously)"
  - "D4-13 edit validation reuses Phase 1's manual-entry contract: no custom validation in history-screen.js"
  - "T-04-07 stale-reference mitigation: re-fetch event from eventLog.listEvents() on every [Edit] click, not from the closed-over render snapshot"
  - "Rule 1 auto-fix: history 24h-format test stripped [Edit] button text from wakeCell.textContent() before regex assertion"

patterns-established:
  - "Per-event edit buttons co-located inside time cells alongside the formatted time text"
  - "Per-row delete button in dedicated Actions column td"
  - "Subscriber-driven reactive re-render: no manual re-render call needed after edit/delete"

requirements-completed: [UI-03, CFG-05]

# Metrics
duration: 35min
completed: 2026-06-06
---

# Phase 4 Plan 03: Edit & Delete Affordances & Forecast Reactivity Summary

**Per-event [Edit] and per-row [Delete] buttons wired to manual-entry modal and deleteEvent() API; forecast and History table both update reactively via D3-12 subscriber pattern after mutations.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-06T00:00Z
- **Completed:** 2026-06-06T00:35Z
- **Tasks:** 5 (Tasks 1+2 batched in one commit; Tasks 3+5 batched in one commit; Task 4 separate)
- **Files modified:** 3

## Accomplishments

- Wired [Edit] buttons per event slot (wake, napEnd, napStart, bedtime) that open the manual-entry modal with `mode='edit'` and pre-populated type/date/time; onSave calls `editEvent()` which fires `notifySubscribers()` — History table and Today forecast both update without a page reload
- Wired [Delete] button per day row showing `window.confirm("Delete all events for {date}? This cannot be undone.")` before calling `deleteEvent()` for each event on that date; if the day was the last one, the empty-state message appears
- 19/19 history.spec.js E2E tests pass (13 existing + 6 new edit/delete tests)
- 133/133 integration tests pass (123 existing + 10 new edit-delete-flow tests)

## Task Commits

1. **Tasks 1+2: Wire edit/delete affordances to history table** - `87b995c` (feat)
2. **Tasks 3+5: E2E tests with test data setup** - `43334f0` (test)
3. **Task 4: Integration tests for subscriber + forecast reactivity** - `d80ff89` (test)

## Files Created/Modified

- `js/ui/history-screen.js` - Added `openManualEntry` import; per-event [Edit] buttons in time cells wired to modal with `mode='edit'`; per-row [Delete] button in Actions column wired to `window.confirm()` + `deleteEvent()`; `buildTable`/`buildDayRow` now receive `eventLog` and `settings` as parameters
- `tests/e2e/history.spec.js` - Added `TEST_DB` fixture (5-day v2 localStorage blob), `seedAndReload()` helper, and 6 new test cases covering edit workflow (modal opens, pre-populated, saves, re-renders) and delete workflow (confirm, cancel, row removal, empty state); fixed pre-existing 24h format test that broke due to [Edit] button text in wakeCell
- `tests/integration/edit-delete-flow.test.js` - NEW: 10 integration tests verifying editEvent/deleteEvent trigger subscriber synchronously, forecast re-computes with updated data, rejected-days downweighting shifts P50 median, and deleteEvent is idempotent on missing id

## Decisions Made

- Per-event [Edit] buttons co-located inside time `<td>` cells (alongside the formatted time text) rather than only in the Actions column — consistent with the plan's `mode: 'edit'` per-event design and gives immediate visual association between button and time value
- Per-row [Delete] button remains in the Actions column `<td>` (plan specified this)
- No `disabled` on buttons (they were dormant/disabled in Wave 2 placeholder — Wave 3 fully enables them)
- The existing test "History table shows times in 24h format by default" was broken by [Edit] button text appearing in `wakeCell.textContent()`; fixed inline as Rule 1 auto-fix by stripping the button label before the regex assertion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 24h format E2E test broken by [Edit] button text in time cell**
- **Found during:** Task 3 (running full history.spec.js after adding edit buttons)
- **Issue:** `wakeCell.textContent()` now includes the `[Edit]` button label appended to the time string; the existing regex `^\d{1,2}:\d{2}$|^—$` failed because the full text was e.g. `"6:35[Edit]"`
- **Fix:** Strip the `[Edit]` button text from the full `textContent()` before applying the regex assertion
- **Files modified:** `tests/e2e/history.spec.js` (line 216-221)
- **Verification:** `npx playwright test tests/e2e/history.spec.js` passes 19/19
- **Committed in:** `43334f0` (Task 3+5 commit)

**2. [Rule 1 - Bug] Fixed rejection test data in integration test**
- **Found during:** Task 4 (first run of `edit-delete-flow.test.js`)
- **Issue:** Initial wake-time dataset (06:30..07:00 + 09:00) did not produce a measurable P50 shift after downweighting the outlier at 0.5× — the weighted median stayed at 06:45 with both data sets
- **Fix:** Replaced with the exact dataset from `rejected-days-forecast-sync.test.js` Test 3 (06:00..08:00 + 09:00 outlier) which is mathematically proven to shift from 06:45 to 06:40; added inline arithmetic comment
- **Files modified:** `tests/integration/edit-delete-flow.test.js`
- **Verification:** `node --test tests/integration/edit-delete-flow.test.js` passes 10/10
- **Committed in:** `d80ff89` (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for test correctness. No scope creep; no architectural changes.

## Issues Encountered

None beyond the two auto-fixed bugs documented above.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. All [Edit] and [Delete] button handlers are fully wired. Forecast reactivity is live via the D3-12 subscriber pattern.

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary crossings introduced. The edit/delete wiring is:
- DOM click events → eventLog store API (internal)
- Event IDs from `data-event-id` attributes → re-fetched fresh from `eventLog.listEvents()` before use (T-04-07 mitigation)
- `window.confirm()` is synchronous; cancel is a no-op (T-04-08 accept)
- All dynamic values written via `textContent` only (T-04-04)

## Self-Check

**Files created/modified:**
- `js/ui/history-screen.js` — FOUND (modified in commit 87b995c)
- `tests/e2e/history.spec.js` — FOUND (modified in commit 43334f0)
- `tests/integration/edit-delete-flow.test.js` — FOUND (created in commit d80ff89)

**Commits exist:**
- `87b995c` — FOUND
- `43334f0` — FOUND
- `d80ff89` — FOUND

## Self-Check: PASSED

## Next Phase Readiness

- Wave 3 (edit + delete) is complete. The History screen now supports the full CRUD cycle.
- Wave 4 (if planned) can wire the "Rejected" checkbox toggle without impacting edit/delete affordances.
- Phase 5 (import/export) can rely on the event-log mutation API being fully tested end-to-end.
- No blockers.

---
*Phase: NW-04-history-screen-edit-delete*
*Completed: 2026-06-06*
