# Phase 4: History Screen & Edit/Delete - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can navigate to a dedicated "History" screen and view all past sleep events in a day-grouped table layout. Each day's row shows: date, wake time, bedtime, nap-start, nap-end, and a rejected-flag checkbox. The user can:

1. **Edit individual events** — click an [edit] button on any event time, which opens the manual-entry dialog from Phase 1; user modifies date/hour/minute/type and saves
2. **Delete days** — click a [delete] button on a day row, confirm the deletion in a dialog, and the day is removed from history
3. **Flag days as rejected (outliers)** — toggle a checkbox on any day row to mark it as rejected; rejected days are visually grayed out and excluded from forecast calculations
4. **See forecasts update** — after editing, deleting, or toggling rejection, the user returns to Today and sees the forecast cards re-computed based on the modified history

Phase 4 also introduces the persistent **two-tab navigation structure** (Today | History tabs at the top) that Phase 7 will expand into a full four-screen navigation (Today, History, Charts, Accuracy).

Phase 4 does NOT include:
- Charts, heatmap, or accuracy dashboard (Phase 7)
- Import/export (Phase 5)
- Manual stage boundaries (Phase 6)
- Auto-detection of outlier reasons or rejection metadata (Phase 7)

</domain>

<decisions>
## Implementation Decisions

### History Table Layout & Interaction

- **D4-01: Day-column table layout.** History displays one row per day. Columns (left to right): date | wake time | bedtime | nap-start | nap-end | rejected checkbox. This mirrors the user's existing spreadsheet schema (sen.xlsx) and the forecast-card layout from Phase 3, making it scannable at a glance. One row = one day's sleep record.

- **D4-02: Table is chronological, most recent first (descending).** The top row shows today or the most recent day with data. User scrolls down to view older history. Matches "recency bias" — users typically want to review/edit recent days first.

- **D4-03: Time cells show formatted times only (HH:MM or H:MM AM/PM).** Each cell (wake, bedtime, nap-start, nap-end) displays the time in the user's configured format (24h or 12h from Phase 2 CFG-09). No event type labels in the cells (event type is implicit by column position). If a day has no nap, the nap-start and nap-end cells are empty (or show a placeholder like "—").

- **D4-04: Edit affordance is per-event.** Each time cell is clickable or has a small [edit] button. Clicking opens the manual-entry modal from Phase 1, pre-populated with that event's date/hour/minute/type. User can modify and save. Single event edit, not bulk per-day edit. This reuses tested Phase 1 code and affordances.

- **D4-05: Rejected checkbox is a table column.** One column shows a checkbox for each day row. Checked = rejected (outlier). Unchecked = active. Consistent with Phase 2's Settings toggles. Clicking the checkbox immediately toggles the rejected state and triggers a forecast re-compute. No confirmation needed for toggling (it's reversible).

- **D4-06: Delete affordance is a [delete] button per row.** Each day row has a [delete] button (or trash icon + label). Clicking it shows a confirmation dialog: "Delete this day and all its events? This cannot be undone." User can confirm or cancel. On confirmation, the day is removed from the event log, and the forecast immediately re-computes.

### Navigation Structure

- **D4-07: Two-tab header navigation (Today | History).** The app header (from Phase 2) gains two tabs or buttons: "Today" and "History" (or icons + text). User taps to switch screens. This is the first multi-screen app structure; Phase 7 will expand to four tabs (Today, History, Charts, Accuracy). The tabs are positioned in the header, visually distinct (active tab highlighted, inactive grayed/normal).

- **D4-08: Navigation state persists during session.** If user is on History, scrolls through events, edits one, saves, they remain on the History tab. If they switch to Today to see updated forecast, then back to History, the History list is still visible (no reset/reload needed, but list position may reset to top). No complex scroll-position restoration needed for Phase 4.

### Forecast Reactivity & Visual Feedback

- **D4-09: Forecast re-computes only on Save (not during edit).** When the user opens the manual-entry dialog and is still editing, the forecast on the Today screen does not change. Only after the user clicks Save and closes the form does the forecast re-run. This is clean and predictable (no surprise forecast updates while editing). Matches Phase 3's behavior: forecast re-runs when the event log completes, not mid-edit.

- **D4-10: Rejected days are visually grayed out (lower opacity).** When a day is rejected (checkbox is checked), the entire day row is rendered at ~50% opacity or with a muted background color (e.g., a light gray tint). This signals "excluded from forecast" without hiding the data. Data remains readable for review/audit. Matches the calm/minimal aesthetic.

- **D4-11: Delete is immediate but reversible via browser undo.** Clicking [delete] → confirmation → removes the day. If the user immediately presses Ctrl+Z (or Cmd+Z on Mac), the browser's native undo can restore the deleted event. This is a fast, natural interaction. If the user navigates away or closes the app, the deletion is committed to localStorage and cannot be undone in-app. Phase 5+ could add explicit undo/restore UI, but not needed for Phase 4.

- **D4-12: No in-app undo stack.** Phase 4 does not implement a custom undo/redo system. Rely on browser undo and localStorage. If needed in Phase 7+, implement a full undo system alongside the accuracy dashboard (both are reflection/audit features).

### Validation & Constraints (inherited from Phase 1)

- **D4-13: Edit validation reuses Phase 1's manual-entry contract.** When the user edits an event in History, the same validation rules apply: 5-minute rounding, future-date guard (no events after wall-clock now), hour 0–23, minute in 0/5/10/.../55 increments. The form enforces these same constraints. See Phase 1 CONTEXT.md §Validation for full details.

- **D4-14: Rejected flag is not validated; it toggles freely.** A user can mark any day as rejected, even in the future (if a future event somehow exists). The rejected state is a boolean flag on each day record, persisted in the event log. Phase 3's forecast function already respects the rejected flag (D3-03: downweight rejected days at 0.5x in percentile calculation).

### Testing & TDD Discipline

- **D4-15: History table rendering is tested via E2E (Playwright).** The Today→History navigation, table layout, edit/delete affordances, and rejected checkbox styling are verified with browser-driven tests. Unit tests cover the validation logic (inherited from Phase 1). Integration tests verify that editing/deleting a day triggers a forecast re-compute (using the event-log + forecast subscription pattern from Phase 3).

- **D4-16: No new pure-logic modules needed.** All core logic (event edit, delete, rejected-flag toggling) already exists in Phase 1 & 2:
  - Event edit/delete: `js/store/event-log.js` (editEvent, deleteEvent)
  - Rejected flag: Phase 2's settings store (the rejected flag is stored per day in the event record; toggle is a mutation on the event)
  - Forecast re-compute: Phase 3's forecast subscription (forecast re-runs when event log or settings change)
  Phase 4 adds only UI code (History screen component) and wiring (header navigation tabs, subscriber callbacks).

### Claude's Discretion

- **Edit modal title and fields:** When opening the manual-entry dialog for an edit (vs. adding a new event), the modal title should change to "Edit event" (currently "Add event" from Phase 1). The form is otherwise identical. The planner can reuse the same dialog and change the title dynamically, or refactor the dialog component to accept a mode param. Either approach works; choose the simpler one that doesn't require breaking the Phase 1 modal contract.

- **Table styling & spacing:** Column widths, row height, cell padding, font size, alignment (left/center/right for times). Choose defaults that work on mobile (narrow screens ~320px) and desktop (wider screens ~800px+). The planner can use CSS grid or flexbox, and may introduce responsive breakpoints (e.g., smaller text/padding on mobile, hide nap columns on very narrow screens). Defer detailed mock-ups to planning.

- **Deleted-event animation/transition:** When a day is deleted, should the row fade out smoothly, or disappear instantly? Should the table shift up, or is the removal instant? Choose an animation that feels responsive without being distracting. Smooth fade (200–300ms) is typical; instant is fine too.

- **Empty History message:** When the event log is empty (no events logged yet), show a message on the History screen: "No events logged yet. Go to Today to log your first sleep event." This is similar to Phase 3's cold-start message.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Full project context, constraints, key decisions. Specifically: single subject, offline-first, localStorage + file-as-truth, 5-minute precision, calm aesthetic, no dependencies.

- `.planning/REQUIREMENTS.md` — Phase 4 requirements: UI-03 (History screen), CFG-05 (rejected flag). Traceability table maps each requirement to Phase 4.

- `.planning/ROADMAP.md` § Phase 4 — Phase boundary, success criteria, depends on Phase 3.

- `CLAUDE.md` — Repo conventions: Object.freeze configs, 5-minute precision, no dependencies, REQ-IDs in commits, TDD discipline.

### Phase 1, 2, 3 Decisions (load-bearing for Phase 4)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — Decisions D-01 through D-22. Phase 4 builds on:
  - D-04: Canonical JSON shape (version 2, settings + events)
  - D-06: Layered module structure (js/lib/, js/store/, js/adapters/, js/ui/)
  - D-07: Adapter seams for testability
  - D-10: Manual-entry modal design, form fields, validation
  - D-13: Form validation rules (future-date guard, 5-min rounding, hour/minute ranges)
  - D-19–D-22: Testing scaffold (unit + integration + E2E)

- `.planning/phases/NW-02-configuration-settings/02-CONTEXT.md` — Decisions D2-01 through D2-27. Phase 4 consumes:
  - D2-04: Settings persisted in `db.settings` within the `nightwatch:db` blob
  - D2-07: `createSettingsStore()` API (get, update, subscribe)
  - D2-09: Time format (24h default / 12h toggle) applied to all time displays
  - D2-10: Header strip layout and subject-name display

- `.planning/phases/NW-03-forecast-engine-today-screen/03-CONTEXT.md` — Decisions D3-01 through D3-16. Phase 4 extends:
  - D3-03: Rejected days downweighted at 0.5x in percentile calculation
  - D3-12: Forecast re-runs on every event log change; Phase 4 triggers this via editEvent/deleteEvent/toggle-rejected
  - D3-13: Forecast state is derived from event-log + settings (pure function)
  - Header navigation structure (from D2-10) — Phase 4 adds History tab alongside Today

### Source code (Phase 1 & 2 & 3 — integration points)

- `js/store/event-log.js` — Exposes `editEvent(dayIndex, eventIndex, newEvent)` and `deleteEvent(dayIndex, eventIndex)`. Phase 4 calls these from the History UI.

- `js/store/settings.js` — Phase 4 may need to toggle the `rejected` flag on a day record. If the flag is stored as `event.rejected: boolean`, mutation happens on the event object itself (not via settings store). Clarify with planner whether rejected is stored in `db.events` or `db.settings`.

- `js/lib/forecast.js` (or equivalent) — Phase 3's forecast function. Phase 4 triggers re-compute via subscriber callbacks when event log changes.

- `js/ui/today-screen.js` — Phase 3 renders the Today screen. Phase 4 adds a History screen component alongside it. Both share the same header and tab navigation.

- `js/ui/manual-entry.js` — Phase 1 modal. Phase 4 reuses this for edit affordances. May need to adjust title ("Edit event" vs. "Add event") or add a mode param to distinguish contexts.

- `js/ui/header.js` — Phase 2 header. Phase 4 extends the header to include two tabs (Today | History) with tab-switching logic.

- `index.html` — Phase 4 adds a container for the History screen (alongside or replacing the today-screen container when the History tab is active). May add a `<section id="history-screen">` placeholder.

- `style.css` — Phase 4 adds CSS for the History table (grid/flex layout, cell styling, checkbox styling, rejected-row styling, tab styling for the header navigation).

- `tests/e2e/` — Phase 4 adds Playwright specs for History screen: navigate to History, see table, click edit, see modal, save, see forecast update on Today; delete a day, see confirmation, confirm, see table update.

### Reference implementations & patterns

- `../mindful-breathing/` — Vanilla PWA modal patterns, `Object.freeze` config, calm styling register (Phase 4 can look for tab/navigation patterns if any exist).

- Phase 1's `js/ui/today-screen.js` — Day-grouped list rendering. Phase 4's History table uses a different layout (day-column table), but the day-grouping logic and event rendering patterns from Phase 1 are reference points.

### Domain / sleep science

- User's existing spreadsheet (`sen.xlsx`) — The Phase 1 context document translates the Polish column schema. Phase 4's day-column table layout mirrors this schema, making it familiar to the user.

No additional external specs or ADRs exist yet. Decisions D4-01..D4-16 above are the authoritative source for Phase 4's History screen and edit/delete interactions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Manual-entry modal and form** (`js/ui/manual-entry.js`) — Already handles validation, date/time picker, event-type select. Phase 4 can reuse this directly for edit affordances by opening it with the event pre-populated. May need minor tweaks to title (mode-aware) or data binding.

- **Event log API** (`js/store/event-log.js`) — Already exports `editEvent()` and `deleteEvent()` methods. Phase 4 calls these directly from the History UI without needing new store logic.

- **Settings store** (`js/store/settings.js`) — Already handles subscriptions and reactive updates. Phase 4 may use `settings.subscribe()` to listen for time-format changes (24h/12h) and re-render times in the table.

- **Time formatting helpers** (`js/lib/time-format.js` or `js/lib/time.js`) — Phase 2 already has `formatTime(at, timeFormat)`. Phase 4 reuses this in the History table to respect the user's 24h/12h preference.

- **Forecast function & subscriber pattern** (`js/lib/forecast.js` + Phase 3 wiring) — Phase 4 leverages the existing reactive update flow. When `eventLog.editEvent()` or `deleteEvent()` completes, the Today screen's forecast subscriber is triggered and forecasts re-compute.

### Established Patterns

- **Pure-logic modules with adapter seams** — History table rendering is UI code (not pure logic), but the underlying edit/delete logic is pure and already tested in Phase 1. Phase 4 focuses on the UI layer.

- **Subscriber pattern for reactive updates** — Phase 3 established subscribers on eventLog and settings. Phase 4 extends this: the History screen may subscribe to eventLog changes so that if the user edits a day and the edit is reflected instantly in the table. Alternatively, the table can be stateless and re-render on demand after each mutation.

- **`Object.freeze` for config** — Phase 4 may define display constants (e.g., column headers, empty-state message). Use `Object.freeze` per CLAUDE.md.

- **5-minute precision throughout** — History times are 5-minute-aligned. Inherited from Phase 1 LOG-07. Validation in edit forms enforces this.

- **No npm runtime dependencies** — History table uses only native JS (Array methods, DOM APIs). No charting or table libraries. HTML/CSS for table structure.

### Integration Points

- **Composition root (`js/app.js`)** — Phase 4 adds History screen mounting and tab-switching logic here.

- **Header (`js/ui/header.js`)** — Phase 4 adds two tabs (Today | History) in the header and tab-switch callbacks.

- **Today screen (`js/ui/today-screen.js`)** — Phase 3 renders the Today screen. Phase 4 may share this component or create a separate history-screen component. Both are mounted conditionally based on the active tab.

- **HTML layout** — Phase 4 adds a `<section id="history-screen">` container to `index.html` (initially hidden, shown when History tab is active). Or uses a single `<main id="app">` that conditionally renders either Today or History content.

- **Tests** — Phase 4 adds E2E specs (Playwright) for History navigation, table layout, edit, delete, and rejected-flag toggling. Integration tests verify that event mutations trigger forecast re-compute. Unit tests inherit from Phase 1 (no new pure-logic modules needed).

</code_context>

<specifics>
## Specific Ideas

- **User is actively managing their child's sleep history.** They may edit past events frequently (e.g., "I realized the nap actually ended at 15:05, not 15:00") and flag days as rejected when sleep was disrupted (illness, travel, etc.). The History screen is a tool for data cleanup and outlier management, not just a log. The day-column layout and quick checkboxes align with this workflow.

- **Existing spreadsheet familiarity.** The user has been tracking sleep manually in sen.xlsx with a day-per-row schema. Phase 4's day-column table mirrors this, so the mental model transfers directly. This is a deliberate design choice to ease adoption.

- **Forecast re-compute on edit.** The user explicitly wants to see predictions update when they adjust past events (e.g., edit a bedtime, see how it changes tomorrow's predicted wake time). Phase 3's reactive forecast does this automatically; Phase 4 just needs to trigger it via event mutations. This is already wired; Phase 4 just surfaces it in the History screen.

</specifics>

<deferred>
## Deferred Ideas

### Phase 7: Reflection & Audit Features

- **Rejection reason display (manual vs. auto-detected).** When a day is rejected, show a tooltip or hint indicating whether it was manually flagged or auto-detected by an outlier-detection algorithm. Deferred because CFG-04 (auto outlier detection) is not yet implemented; all rejections in Phase 4 are manual. Phase 7's accuracy dashboard can expand with rejection history and audit trails.

- **Undo/restore UI.** A custom undo/redo system (stack-based, with UI controls). Phase 4 relies on browser undo (Ctrl+Z). Phase 7+ can add in-app undo alongside accuracy and reflection features.

- **Bulk edit (edit all events for a day at once).** Phase 4 uses per-event edit (reuse manual-entry modal). If users frequently bulk-edit days, Phase 7 could offer a day-wide form. Not needed yet based on user workflow.

### Phase 7: Full Navigation & Multi-Screen Layout

- **Navigation menu expansion.** Phase 4 introduces the two-tab structure (Today | History). Phase 7 expands to four tabs (add Charts and Accuracy). The header tab structure established here will scale naturally.

- **Tab persistence & deep linking.** If the user navigates directly to History via a URL (e.g., `app.html#history`), the History tab should be active. Phase 4 does not require this; Phase 8 (PWA hardening) may add it.

---

*Phase: 4-History Screen & Edit/Delete*
*Context gathered: 2026-06-05*
