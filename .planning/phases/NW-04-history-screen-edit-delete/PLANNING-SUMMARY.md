# Phase 4 Planning Summary

**Date:** 2026-06-05  
**Status:** Planning complete, ready for execution

## Overview

Phase 4: History Screen & Edit/Delete delivers the second major feature of Nightwatch — the ability to view, edit, and manage past sleep events. This phase introduces multi-screen navigation (Today | History tabs) and enables users to correct historical data and flag outliers for re-prediction.

**Requirements Addressed:**
- **UI-03:** History screen with scrollable day-column table, per-row edit/delete/reject controls
- **CFG-05:** Manual day rejection (outlier flagging) with persistence and forecast impact

**Depends On:** Phases 1, 2, 3 (all completed and verified)

## Phase Structure

Phase 4 is decomposed into **4 plans across 4 execution waves**, each building vertically on prior waves:

| Wave | Plan | Focus | Autonomous | Tasks | Output |
|------|------|-------|-----------|-------|--------|
| 1 | 04-01 | Rejected-day storage foundation (schema + derivation) | Yes | 3 | rejectedDays in settings, day.rejected boolean computed by day-bucket, forecast downweighting verified |
| 2 | 04-02 | Header tabs + History table UI (read-only) | No | 7 | Tab navigation, day-column table rendering, responsive CSS, empty-state message |
| 3 | 04-03 | Edit & delete affordances (interactive) | Yes | 5 | [Edit] and [Delete] buttons wired to modal and store APIs, forecast reactivity verified |
| 4 | 04-04 | Rejected-flag checkbox UI + phase gate | No | 6 | Checkbox toggle wired to settings, final CSS styling, full test suite, security audit, documentation |

## Design Decisions Made (Locked)

### Rejected-Day Storage (D4-05)
**Decision:** Store rejected days as a list of date strings in `settings.rejectedDays` (Option A).
- **Rationale:** Keeps model simple, leverages existing settings-store subscription pattern, avoids separate store.
- **Implementation:** Day-bucket computes derived `day.rejected` boolean by checking if `date in settings.rejectedDays`.
- **Impact:** Forecast function (Phase 3) already respects `day.rejected` and downweights at 0.5x.

### Delete Scope (D4-06)
**Decision:** Deleting a day removes all events for that calendar date.
- **Rationale:** Matches day-grouping logic in `daysByCalendar()`.
- **Implementation:** Filter events by `at.slice(0, 10) === day.date`, delete all matching.

### Multi-Nap Display (D4-01)
**Decision:** Show only primary nap slot (napStart, napEnd) in table. Extra naps handled via separate edit affordances.
- **Rationale:** Keeps table clean (single row per day). Extra naps can be edited individually but not surfaced as columns.

### Tab Persistence (D4-08)
**Decision:** Tab state (Today vs. History) is in-memory only; resets to top on re-visit.
- **Rationale:** Simplifies Phase 4. Phase 8 (PWA hardening) can add deep-linking if needed.

### Edit Validation (D4-13)
**Decision:** Reuse Phase 1's manual-entry validation contract (5-min rounding, future-date guard, etc.).
- **Rationale:** Prevents new validation logic; ensures consistency. Users can only edit past events (no future edits).

### Forecast Timing (D4-09)
**Decision:** Forecast re-computes only on Save, not during edit.
- **Rationale:** Clean user experience. Modal is already designed this way (Phase 1).

## Execution Flow

### Wave 1 (Autonomous)
**Objective:** Establish persistent storage for rejected days and ensure day-bucket computes rejection state.

**Tasks:**
1. Extend DEFAULT_SETTINGS with rejectedDays array; update v1→v2 migration
2. Compute day.rejected in daysByCalendar() and daysBySubjectiveNight() from settings.rejectedDays
3. Integration test: settings.update({ rejectedDays }) → forecast re-computes with downweighting

**Outcome:** Rejected-day model is foundation for UI (Waves 2–4). Forecast system respects rejections. All unit + integration tests pass.

### Wave 2 (Checkpoint: Human Verify)
**Objective:** Build multi-screen navigation structure and day-column table layout (read-only).

**Tasks:**
1. Extend header.js with Today | History tab navigation
2. Create history-screen.js component; render day-column table from eventLog.daysByCalendar()
3. Wire composition root (app.js) to mount both screens, switch based on activeTab
4. Add index.html containers for history-screen and tab nav
5. CSS: table styling, tab styling, responsive layout, rejected-row opacity
6. E2E tests: tab navigation, table rendering, empty state

**Outcome:** Multi-screen UI functional. History table renders all days in descending order. User can see all past events at a glance. Responsive on mobile and desktop.

**Checkpoint:** Manual verification of UI (tabs work, table displays, empty state shows).

### Wave 3 (Autonomous)
**Objective:** Add interactive affordances for editing and deleting events. Wire to store APIs and forecast reactivity.

**Tasks:**
1. Add [edit] buttons per event; click opens manual-entry modal with pre-populated data
2. Add [delete] buttons per day; click shows confirmation dialog; deletion removes all events for date
3. E2E tests: edit workflow (modal, save, table update), delete workflow (confirm, delete, table update)
4. Integration test: editEvent/deleteEvent mutations trigger subscribers and forecast re-computes
5. E2E setup: seed test data for reliable test execution

**Outcome:** History table is fully interactive. Users can correct past events and remove outliers. Forecast updates immediately on mutation. All workflows tested end-to-end.

### Wave 4 (Checkpoint: Human Verify, Phase Gate)
**Objective:** Activate rejected-flag checkbox. Complete CSS styling. Verify security and test coverage. Document phase.

**Tasks:**
1. Wire rejected checkbox to settings.update({ rejectedDays: [...] })
2. Final CSS styling: rejected-row opacity, checkbox appearance, responsive tweaks, button alignment
3. E2E test: rejected checkbox toggle and forecast reactivity
4. Security audit: XSS prevention, data-flow integrity, state consistency
5. Document Phase 4 in README.md (features, decisions, testing, constraints)
6. Run full test suite (unit + integration + E2E) and verify no regressions

**Outcome:** All Phase 4 features complete and tested. Security audit passed. Documentation complete. Full regression test suite passes. Phase ready for verification.

**Checkpoint:** Manual verification of all workflows (navigate, edit, delete, reject). Confirm forecast updates reactively.

**Phase Gate:** All tests passing, security audit complete, documentation complete, no regressions, manual checkpoint approved.

## Testing Strategy

| Level | Coverage | Files | Command |
|-------|----------|-------|---------|
| Unit | rejectedDays schema, day.rejected computation | tests/unit/db-shape.test.js, tests/unit/day-bucket.test.js | `node --test tests/unit/` |
| Integration | editEvent/deleteEvent mutations, forecast sync | tests/integration/edit-delete-flow.test.js, tests/integration/rejected-days-forecast-sync.test.js | `node --test tests/integration/` |
| E2E | Full workflows (tabs, table, edit, delete, reject) | tests/e2e/history.spec.js | `npx playwright test tests/e2e/history.spec.js` |

**Sampling Rate:**
- Per-task: Quick verification (`npm run build`, syntax checks)
- Per-wave: Wave-level test suite (`npm run test:unit`, etc.)
- Phase gate: Full suite (`npm run test:e2e`) + security audit + manual verification

## Decisions Deferred (Not in Phase 4)

- **Rejection metadata:** Auto-detected vs. manual; rejection reason; audit trail → Phase 7 (accuracy dashboard)
- **Undo/restore UI:** Custom undo stack → Phase 7 (alongside accuracy)
- **Bulk edit:** Edit all events for a day at once → Phase 7+ (if needed)
- **Scroll position restoration:** Restore History scroll position on re-visit → Phase 8 (PWA hardening)
- **Tab persistence across reload:** Save active tab to localStorage → Phase 8 (deep-linking)

## Integration Points

### Existing Components Reused
- **js/ui/manual-entry.js (Phase 1):** Edit modal for history affordances. Already supports `mode: 'edit'` and pre-population.
- **js/store/event-log.js (Phase 3):** editEvent() and deleteEvent() APIs. Already call notifySubscribers() to trigger re-renders.
- **js/lib/forecast.js (Phase 3):** downweightRejectedDays() already implements 0.5x downweighting.
- **js/lib/day-bucket.js (Phase 1):** daysByCalendar() and daysBySubjectiveNight(). Extended to compute day.rejected.
- **js/store/settings.js (Phase 2):** Subscription pattern for reactive updates. Extended with rejectedDays field.

### New Components
- **js/ui/history-screen.js:** Day-column table rendering, edit/delete/reject affordance wiring, subscription pattern.
- **js/ui/header.js (extended):** Tab navigation (Today | History).
- **js/app.js (updated):** Composition root wires tab navigation and conditionally renders screens.

## Files Modified

| File | Phase | Purpose |
|------|-------|---------|
| js/lib/db-shape.js | Wave 1 | Add rejectedDays to DEFAULT_SETTINGS; update v1→v2 migration |
| js/lib/day-bucket.js | Wave 1 | Compute day.rejected from settings.rejectedDays |
| js/ui/header.js | Wave 2 | Add tab navigation (Today \| History) |
| js/ui/history-screen.js | Wave 2–4 | NEW component; day-column table + edit/delete/reject affordances |
| js/app.js | Wave 2 | Wire tab navigation; conditionally mount Today/History screens |
| index.html | Wave 2 | Add containers for history-screen and tab nav |
| style.css | Wave 2, 4 | Table styling, tab styling, responsive layout, rejected-row opacity |
| tests/unit/db-shape.test.js | Wave 1 | Test rejectedDays schema and migration |
| tests/unit/day-bucket.test.js | Wave 1 | Test day.rejected computation |
| tests/integration/rejected-days-forecast-sync.test.js | Wave 1 | Test subscriber + forecast downweighting |
| tests/integration/edit-delete-flow.test.js | Wave 3 | Test editEvent/deleteEvent + forecast re-compute |
| tests/e2e/history.spec.js | Wave 2–4 | NEW E2E suite; all History workflows |
| README.md | Wave 4 | Document Phase 4 features, decisions, testing, constraints |

## Success Criteria

**Phase 4 is complete when:**

✓ All four waves executed successfully (no blocking failures)
✓ Day-column table renders with correct columns (date, wake, bedtime, nap-start, nap-end, rejected, actions)
✓ Days displayed in descending order (most recent first)
✓ User can navigate between Today and History tabs
✓ [Edit] buttons open modal with pre-populated event; save updates table and forecast
✓ [Delete] buttons show confirmation; deletion removes day and updates forecast
✓ [Rejected] checkbox toggles immediately; rejected rows grayed at 50% opacity; forecast downweights
✓ Empty state message when no events logged
✓ All unit tests pass (schema, day-bucket)
✓ All integration tests pass (mutation + forecast sync)
✓ All E2E tests pass (full workflows)
✓ Security audit complete (no XSS, data-flow integrity, state consistency)
✓ README.md documents Phase 4
✓ No regressions in Phase 1–3 tests
✓ Manual verification checkpoint approved

## Next Steps

1. **Execute Wave 1 (04-01-PLAN.md):** Schema + day-bucket foundation. Est. 1 session (~30–45 min).
2. **Execute Wave 2 (04-02-PLAN.md):** Header tabs + History table UI. Est. 2 sessions (~60–90 min). Includes manual checkpoint.
3. **Execute Wave 3 (04-03-PLAN.md):** Edit/delete affordances. Est. 2 sessions (~60–90 min).
4. **Execute Wave 4 (04-04-PLAN.md):** Rejected checkbox + phase gate. Est. 2 sessions (~60–90 min). Includes manual checkpoint and security audit.
5. **Run `/gsd-verify-work`** after Wave 4 checkpoint approval to create final SUMMARY.md and close Phase 4.

---

**Planning completed:** 2026-06-05  
**Ready for execution:** Yes  
**Plans created:** 4 files (04-01-PLAN.md through 04-04-PLAN.md)
