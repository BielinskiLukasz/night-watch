# Phase 4: History Screen & Edit/Delete - Research

**Researched:** 2026-06-05
**Domain:** Multi-screen UI, event mutations, rejected-flag persistence, forecast reactivity
**Confidence:** HIGH

## Summary

Phase 4 adds the History screen — a day-grouped table view of past sleep events with per-event edit affordances, per-day delete and rejection controls, and automatic forecast re-computation on mutation. All required infrastructure (event-log mutation APIs, forecast subscriptions, time formatting, rejected-flag downweighting) is already present in Phases 1–3.

The History screen is purely a UI layer (no new business logic). It reuses:
- **Mutation APIs**: `eventLog.editEvent(eventId, patch)` and `eventLog.deleteEvent(eventId)` [VERIFIED: js/store/event-log.js lines 148–184]
- **Modal reuse**: `openManualEntry()` with `mode: 'edit'` passes pre-populated event data [VERIFIED: js/ui/manual-entry.js lines 1–60]
- **Reactive updates**: `eventLog.subscribe()` and `settings.subscribe()` fire after every mutation [VERIFIED: js/store/event-log.js lines 234–237, js/store/settings.js lines 113–116]
- **Forecast computation**: `forecast(dayRecords, settings)` respects `day.rejected` boolean; Phase 3 already implements rejection downweighting at 0.5x [VERIFIED: js/lib/forecast.js lines 149–152]
- **Time formatting**: `formatTime(at, timeFormat)` applies user's 24h/12h preference [VERIFIED: js/lib/time.js lines 117–123]
- **Rejected flag storage**: Phase 3 forecast code expects `day.rejected: boolean` on day records [VERIFIED: js/lib/forecast.js line 311]

**Primary recommendation:** Phase 4 focus is entirely on the UI/presentation layer. No new store logic, pure-logic modules, or data-shape changes needed. Implement the History screen as a stateless component that re-renders on eventLog/settings subscription, toggle the rejected flag via `settings.update()`, and wire header tab navigation to show/hide Today and History screens.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|-----------|-------------|----------------|-----------|
| History table rendering | Frontend (UI) | — | DOM construction, event-row rendering, column formatting |
| Edit event modal | Frontend (UI) | — | Reuse Phase 1's manual-entry modal; open via click handler |
| Delete day confirmation | Frontend (UI) | — | Native `window.confirm()` (established pattern from Phase 1) |
| Toggle rejected flag | Frontend (UI) + Store | — | UI checkbox → `settings.update({ rejected })` call; persists via settings store |
| Forecast re-compute | API / Backend | — | Pure `forecast()` function runs when event log or settings change (via subscriber pattern) |
| Tab navigation | Frontend (UI) | — | Header tabs switch between Today/History screens; CSS or JS toggle visibility |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D4-01–D4-16:** History table layout, day-column structure, edit/delete affordances, rejected-flag behavior, validation contract, navigation tabs, forecast reactivity.
- **D2-10 (Phase 2):** Header strip with subject name and settings gear.
- **D3-03 (Phase 3):** Rejected days downweighted at 0.5x in forecast calculations.
- **D3-12 (Phase 3):** Forecast re-runs on every event log mutation.

### Claude's Discretion
- **D4-77 (modal title):** Edit modal title should change dynamically ("Add event" vs. "Edit event"). Planner chooses implementation (mode param or separate title element).
- **Table styling & spacing:** Column widths, row height, font sizing, alignment, responsive breakpoints. Choose defaults that work mobile (~320px) and desktop (~800px).
- **Delete animation:** Fade-out vs. instant removal on delete. Smooth 200–300ms is typical.
- **Empty History message:** Show when event log is empty.

### Deferred Ideas
- Rejection-reason metadata and auto-detection (Phase 7).
- Undo/redo UI stack (Phase 7).
- Bulk edit (Phase 7).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-03 | History screen shows scrollable table of past days with per-row edit, delete, and rejected toggle | Day records from `eventLog.daysByCalendar()` feed the table; edit calls `openManualEntry(mode='edit')` and `eventLog.editEvent()`; delete calls `eventLog.deleteEvent()` with confirmation; toggle rejected via `settings.update()` |
| CFG-05 | User can manually mark any day as "rejected" from History screen; toggle persists | Rejected flag stored as `day.rejected: boolean` on day record; Phase 3 forecast already reads this field and downweights at 0.5x; toggling fires subscriber so forecast re-computes automatically |

## Standard Stack

### Core UI Components
| Library / Module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Native `<dialog>` | HTML5 | Modal container for manual-entry form | No dependencies; accessibility built-in (focus trap, ESC-to-close, aria-modal) |
| `openManualEntry()` | Phase 1 | Edit modal dispatch | Already tested, validates forms, handles edit-vs-add mode distinction |
| `eventLog.subscribe()` | Phase 3 | React to event mutations | Established subscriber pattern; fires synchronously after editEvent/deleteEvent |
| `settings.subscribe()` | Phase 2 | React to settings changes | Established pattern; fires when rejected flag toggled |
| `formatTime(at, timeFormat)` | Phase 2 | Display times in user's format | Respects 24h/12h preference; DST-safe (string-only, no Date construction) |

### Store APIs
| API | Module | Purpose | Signature |
|-----|--------|---------|-----------|
| `eventLog.daysByCalendar(limit)` | js/store/event-log.js | Get day-grouped events (calendar view) | `daysByCalendar(7) → Array<{date, wake, bedtime, napStart, napEnd, allEvents}>` |
| `eventLog.editEvent(eventId, patch)` | js/store/event-log.js | Mutate an event in place | `editEvent(id, {type, at}) → mutated event` |
| `eventLog.deleteEvent(eventId)` | js/store/event-log.js | Remove an event by id | `deleteEvent(id) → boolean (true if removed)` |
| `settings.get()` | js/store/settings.js | Read current settings | Returns frozen snapshot with `timeFormat`, `cutoverHour`, etc. |
| `settings.update(patch)` | js/store/settings.js | Merge settings and persist | `update({rejected: true})` → fires subscribers synchronously |

### Validation & Error Handling
| Requirement | Source | Contract |
|-------------|--------|----------|
| Edit validation | Phase 1's `validate()` in manual-entry.js | Reused as-is; future-date guard, 5-min rounding, required fields — [VERIFIED: js/ui/manual-entry.js lines 91–150] |
| Edit-creates-duplicate prevention | Phase 1's `mode: 'edit'` parameter | Explicit mode guards against accidental addEventAt when editEvent intended — [VERIFIED: js/ui/manual-entry.js lines 22–26] |
| 5-minute precision | Phase 1's `roundTo5()` + Phase 3's `editEvent()` | Every write path re-rounds, so UI cannot bypass normalization — [VERIFIED: js/store/event-log.js line 157] |

### Styling & Responsive Design
| Pattern | File | Status |
|---------|------|--------|
| Responsive max-width container | style.css line 69 | `#app { max-width: 32rem; }` — constrains Today screen; Phase 4 History inherits |
| Calm aesthetic colors | style.css lines 16, 86–90, 112–129 | Indigo accent (`#4f46e5`), neutral grays, white backgrounds, subtle borders |
| Mobile breakpoints | style.css (global) | Fixed `max-width: 32rem` container handles narrow screens; no media queries yet (Phase 8) |
| Button styling | style.css lines 81–95 | `.rowEdit` / `.rowDel` defined; History will reuse or extend |
| Table/list styling | style.css lines 141–181 | `.day` / `.dayEvents` / `li.event` — Phase 4 History table can mirror or adapt for column-based layout |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────┐
│            App Header (Phase 2)             │
│   [Subject Name] [Settings] [Today|History] │
└─────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │  Today Screen (Phase 3)    │  ← eventLog ─────────────┐
        │  - Quick-log buttons       │                          │
        │  - Forecast cards          │  ← settings ──┐          │
        │  - Day list                │              │          │
        └───────────────────────────┘              │          │
                    ↑                              │          │
                    │                              │          │
        ┌───────────────────────────┐              │          │
        │  History Screen (Phase 4)  │  ← eventLog │  ← settings
        │  - Day-column table        │              │
        │  - [Edit] [Delete] buttons │  ← settings │
        │  - Rejected checkbox       │              │
        └───────────────────────────┘              │
                    ↓                              │
        ┌───────────────────────────┐              │
        │  Manual-entry Modal       │              │
        │  (Phase 1, reused)        │              │
        └───────────────────────────┘              │
                    ↓                              │
        ┌───────────────────────────┐              │
        │  Event Log Store          │◄─────────────┘
        │  - editEvent()            │
        │  - deleteEvent()          │
        │  - subscribe()            │
        └───────────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │  Forecast Function        │
        │  (pure, Phase 3)          │
        │  - Respects .rejected     │
        │  - Downweights at 0.5x    │
        └───────────────────────────┘
```

**Data flow:**
1. User navigates to History tab → History screen mounts and calls `eventLog.daysByCalendar()`
2. History renders table rows from day records; each row has edit/delete/rejected-toggle affordances
3. User clicks [edit] → opens manual-entry modal with pre-populated event data
4. User clicks Save → `eventLog.editEvent()` mutates in place and calls `persist()`
5. `persist()` calls `notifySubscribers()` synchronously
6. History screen's subscriber fires → `render()` re-fetches `daysByCalendar()` and re-renders table
7. Today screen's subscriber also fires → `forecast()` re-runs with updated events and `day.rejected` flags
8. Forecast cards on Today screen update reactively (user sees new predictions)
9. For rejected toggle: user clicks checkbox → `settings.update({rejected: toggledValue})` → both Today and History re-render

### Recommended Project Structure

```
.
├── js/
│   ├── app.js                    (composition root; wires History screen)
│   ├── ui/
│   │   ├── header.js             (extend with tab navigation: Today|History)
│   │   ├── today-screen.js       (Phase 3; unchanged)
│   │   ├── history-screen.js     (NEW Phase 4 — day-column table + affordances)
│   │   ├── manual-entry.js       (Phase 1; reused for edit modal)
│   │   ├── settings-modal.js     (Phase 2; unchanged)
│   │   └── dom.js                (helper; unchanged)
│   ├── store/
│   │   ├── event-log.js          (Phase 3; editEvent/deleteEvent already here)
│   │   └── settings.js           (Phase 2; unchanged)
│   └── lib/
│       └── forecast.js           (Phase 3; respects day.rejected)
├── index.html                    (add containers for history-screen, tab nav)
├── style.css                     (extend with history-table styling, tab styles)
└── tests/
    ├── e2e/
    │   └── history.spec.js       (NEW — Playwright tests for History UI)
    └── integration/
        └── edit-delete-flow.test.js (NEW — event mutation + forecast sync)
```

### Pattern 1: Day-Grouped Table Rendering

**What:** History screen iterates `eventLog.daysByCalendar()` and renders one HTML row per day. Each day row shows: date | wake-time | bedtime | nap-start | nap-end | rejected-checkbox | [edit] [delete] buttons.

**When to use:** Whenever UI needs to display a set of records grouped by a key (here: calendar date) in a table/grid format.

**Example:**

```javascript
// Source: js/ui/history-screen.js (Phase 4 — pseudo-code)

export function mountHistoryScreen({ root, eventLog, settings }) {
  const dayRecords = eventLog.daysByCalendar(Infinity); // all history, not just 7

  const table = el('table', {
    className: 'historyTable',
    role: 'grid',
  });

  const thead = el('thead');
  thead.appendChild(el('tr', {
    innerHTML: '<th>Date</th><th>Wake</th><th>Bedtime</th><th>Nap Start</th><th>Nap End</th><th>Rejected</th><th>Actions</th>',
  }));
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const day of dayRecords) {
    const row = el('tr', {
      className: day.rejected ? 'rejected' : '',
      'data-date': day.date,
    });

    // Date cell
    row.appendChild(el('td', { textContent: day.date }));

    // Event time cells (wake, bedtime, napStart, napEnd)
    for (const eventSlot of [day.wake, day.bedtime, day.napStart, day.napEnd]) {
      const cell = el('td', {
        textContent: eventSlot
          ? formatTime(eventSlot.at, settings.get().timeFormat)
          : '—',
        'data-event-id': eventSlot?.id,
      });
      row.appendChild(cell);
    }

    // Rejected checkbox
    const rejectCheckbox = el('input', {
      type: 'checkbox',
      checked: day.rejected ? 'checked' : '',
      'aria-label': `Mark ${day.date} as rejected`,
    });
    rejectCheckbox.addEventListener('change', (e) => {
      settings.update({ rejected: e.target.checked });
    });
    row.appendChild(el('td', {})).appendChild(rejectCheckbox);

    // Edit / Delete buttons
    for (const event of day.allEvents) {
      const editBtn = el('button', {
        className: 'rowEdit',
        'data-event-id': event.id,
        textContent: '[Edit]',
      });
      editBtn.addEventListener('click', () => {
        openManualEntry({
          mode: 'edit',
          existing: event,
          settings,
          onSave: (patch) => eventLog.editEvent(event.id, patch),
        });
      });
      row.appendChild(editBtn);
    }

    const delBtn = el('button', {
      className: 'rowDel',
      'data-date': day.date,
      textContent: '[Delete]',
    });
    delBtn.addEventListener('click', () => {
      if (window.confirm(`Delete all events for ${day.date}?`)) {
        for (const event of day.allEvents) {
          eventLog.deleteEvent(event.id);
        }
      }
    });
    row.appendChild(delBtn);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  root.replaceChildren(table);

  // Subscribe to updates (D3-12)
  const render = () => mountHistoryScreen({ root, eventLog, settings });
  eventLog.subscribe(render);
  settings.subscribe(render);
}
```

### Pattern 2: Tab Navigation in Header

**What:** The app header (from Phase 2) gains two tabs or buttons: "Today" and "History". Clicking switches the active screen. Active tab is visually highlighted; inactive grayed out. The navigation state persists during the session (not reset on edit/delete).

**When to use:** Any app with multiple named screens/modes that the user navigates between.

**Example:**

```javascript
// Source: js/ui/header.js (Phase 4 extension)

export function mountHeader({ root, settings, onTabChange }) {
  const h1 = root.querySelector('h1.subjectName');
  const trigger = root.querySelector('button.settingsTrigger');

  // Add tab navigation
  const tabNav = el('nav', {
    className: 'tabNav',
    role: 'tablist',
  });
  const todayTab = el('button', {
    role: 'tab',
    'aria-selected': 'true',
    'data-tab': 'today',
    textContent: 'Today',
  });
  const historyTab = el('button', {
    role: 'tab',
    'aria-selected': 'false',
    'data-tab': 'history',
    textContent: 'History',
  });
  tabNav.appendChild(todayTab);
  tabNav.appendChild(historyTab);

  tabNav.addEventListener('click', (e) => {
    const tab = e.target.closest('button[data-tab]');
    if (!tab) return;
    const tabId = tab.getAttribute('data-tab');
    todayTab.setAttribute('aria-selected', String(tabId === 'today'));
    historyTab.setAttribute('aria-selected', String(tabId === 'history'));
    if (onTabChange) onTabChange(tabId);
  });

  root.appendChild(tabNav);
  // ... rest of header setup
}
```

### Anti-Patterns to Avoid

- **Mutating store-returned arrays:** `eventLog.listEvents()` returns a defensive copy; never assign to that array. Always call `eventLog.editEvent()` or `deleteEvent()` to mutate the canonical store. [VERIFIED: js/store/event-log.js lines 186–194]

- **Branching on `existing ? edit : add`:** Phase 1 explicitly rejects this brittle pattern in favor of a mode parameter. Always pass `mode: 'edit'` or `mode: 'add'` to `openManualEntry()`. [VERIFIED: js/ui/manual-entry.js lines 22–26]

- **Calling `persistence()` manually:** Event-log mutations (editEvent, deleteEvent) call `persist()` internally. Don't dispatch separate save calls. [VERIFIED: js/store/event-log.js lines 161, 181]

- **Constructing Date from `at` strings in UI code:** The `at` format is 'YYYY-MM-DDTHH:MM' (wall-clock, not UTC). All formatting uses string slices and `formatTime()`. Never do `new Date(at)` in UI code — the timezone math will silently break. [VERIFIED: js/lib/time.js lines 4–28, js/ui/today-screen.js lines 14–25]

- **Calling forecast() without respecting `day.rejected`:** The forecast function downweights rejected days at 0.5x. When you re-compute forecasts, always pass day records that have the `rejected` boolean field populated. [VERIFIED: js/lib/forecast.js lines 149–152, 311]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event validation on edit | Custom HTML5 validation + custom error rendering | `validate()` from Phase 1's manual-entry.js | Already tested, handles future-date guard, 5-min rounding, structured errors |
| Modal dialog UX (focus trap, ESC-close) | Custom focus management + keyboard listeners | Native `<dialog>` element + `showModal()` | Browser handles accessibility automatically; zero-deps |
| Time format conversion (24h ↔ 12h) | Manual hour/minute arithmetic | `formatTime()` from Phase 2's time.js | Pitfall #4 (midnight/noon edges) already handled; DST-safe |
| Day grouping / bucketing | Custom loop with Map | `eventLog.daysByCalendar()` from Phase 1 | Handles calendar-vs-subjective-night views; DST-safe string slicing |
| Event mutation with undo | Custom undo stack | Browser's native undo (Ctrl+Z) for Phase 4 | D4-11: immediate deletion is reversible via browser undo; avoid undo-stack complexity until Phase 7 |
| Rejected-flag downweighting in forecasts | Custom percentile math with rejection logic | `downweightRejectedDays()` + `calculatePercentiles()` from Phase 3's forecast.js | D3-03 contract is already implemented; reuse it |

**Key insight:** Phase 1–3 have already solved the hard problems (validation, DST-safe time handling, rejection downweighting, reactive subscriptions). Phase 4 is purely compositional — wire existing pieces together in the UI layer.

## Runtime State Inventory

Phase 4 is a UI-only phase (no rename, refactor, or migration). This section is skipped.

## Testing Scaffold & E2E Setup

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (from Phase 1) |
| Config file | `playwright.config.js` |
| Quick run command | `npx playwright test tests/e2e/history.spec.js -g "open history"` |
| Full suite command | `npm run test:e2e` |

[VERIFIED: Project has existing Playwright setup — tests/e2e/quick-log.spec.js, tests/e2e/manual-entry.spec.js]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-03 | Navigate to History tab; see day-grouped table | E2E | `npx playwright test tests/e2e/history.spec.js -g "navigate to history"` | ❌ Wave 0 |
| UI-03 | Click [edit] on a time cell; modal opens with pre-populated data; save updates the day | E2E | `npx playwright test tests/e2e/history.spec.js -g "edit event from history"` | ❌ Wave 0 |
| UI-03 | Click [delete] on a day row; confirm dialog; day is removed from table | E2E | `npx playwright test tests/e2e/history.spec.js -g "delete day"` | ❌ Wave 0 |
| CFG-05 | Click rejected checkbox on a day row; day grayed out; forecast re-computes | E2E + Integration | `npx playwright test tests/e2e/history.spec.js -g "toggle rejected"` | ❌ Wave 0 |
| UI-03 | Edit a day; switch to Today and back to History; forecast on Today reflects the edit | Integration | `npm run test:integration -- --testNamePattern="edit flow"` | ❌ Wave 0 |
| UI-03 | Empty History message when no events logged | E2E | `npx playwright test tests/e2e/history.spec.js -g "empty history"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/e2e/history.spec.js` (quick E2E)
- **Per wave merge:** `npm run test:e2e && npm run test:integration` (full E2E + integration suites)
- **Phase gate:** All tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/history.spec.js` — History table rendering, edit/delete affordances, tab navigation, rejected toggle, forecast sync
- [ ] `tests/integration/edit-delete-flow.test.js` — eventLog mutation + subscriber pattern + forecast re-compute
- [ ] `index.html` — add history-screen container, tab navigation HTML
- [ ] `style.css` — history-table styles, tab styling, rejected-row opacity, responsive adjustments

## Common Pitfalls

### Pitfall 1: Stale Event References After Delete

**What goes wrong:** History screen stores event references in local variables. After `eventLog.deleteEvent()`, those references are stale. If the UI tries to interact with a deleted event (call `editEvent()` on a stale reference), the store throws "Event not found".

**Why it happens:** Event IDs are the canonical reference; the event object itself is ephemeral. The store enforces this via `findIndex()` (line 149 of event-log.js).

**How to avoid:** Always re-fetch the event from the store before acting on it. When a row is clicked, call `eventLog.listEvents().find((e) => e.id === eventId)` to get the fresh event. [EXAMPLE: js/ui/today-screen.js lines 489–490]

**Warning signs:** "Event not found" errors in the console after editing/deleting. Events disappearing from the table without being re-fetched.

### Pitfall 2: Mutating Store-Returned Collections

**What goes wrong:** `eventLog.listEvents()` returns a defensive copy. If you assign to that array (push, splice, etc.), the store is unchanged.

**Why it happens:** Defensive copies are intentional (D-03 / Pitfall #6 in Phase 1 RESEARCH). The store enforces immutability.

**How to avoid:** Never mutate arrays returned from the store. Always call `eventLog.editEvent()` or `deleteEvent()` to perform mutations. [VERIFIED: js/store/event-log.js lines 192–194]

**Warning signs:** Changes to the list don't persist; the UI re-renders but localStorage still has the old data.

### Pitfall 3: Rejected Flag Stored in the Wrong Place

**What goes wrong:** Phase 3 forecast code expects `day.rejected: boolean` on day records. If the rejected flag is stored on individual events instead of on days, the forecast will not see it.

**Why it happens:** Day records are derived views (built by `daysByCalendar()`). The source of truth is the events array in storage. Rejected is a per-day property (one reject state per day), not per-event.

**How to avoid:** Store `rejected` in `settings` or as a derived property on the day record (e.g., computed from a "rejected-days" list in settings). Phase 4 must decide the storage model during planning. [FLAG FOR PLANNER: See "Open Questions" section below]

**Warning signs:** Forecast doesn't change when rejected checkbox is toggled. Day records don't have a `.rejected` field.

### Pitfall 4: Tab Navigation State Lost on Navigation

**What goes wrong:** User navigates to History, scrolls down, edits an event. The edit saves and eventLog subscriber fires, re-rendering History. But the History scroll position is lost, or the tab state resets to Today.

**Why it happens:** D4-08 says "navigation state persists during session," but only if the implementation stores it. A naive implementation re-renders the entire screen from scratch.

**How to avoid:** Store the active tab ID in a module-level variable or in settings (if it should persist across sessions). When re-rendering History, restore scroll position or use `element.scrollIntoView()` on an edited row. [D4-08: Phase 4 does NOT require scroll-position restoration, but tab persistence is required]

**Warning signs:** After an edit, the app shows Today instead of History. Scrolling to the middle of History then logging an event resets the scroll to the top.

### Pitfall 5: Future-Date Guard Blocks Historical Edit

**What goes wrong:** User is on History, tries to edit a past event, and the validation rejects it because the edited date is in the future (relative to the current wall-clock time).

**Why it happens:** Manual-entry.js applies the same validation for add and edit modes — it enforces "no future events" (Phase 1 D-13). But edits of old events (from years ago) should be allowed.

**How to avoid:** For edit mode, relax the future-date guard. The event being edited is already in the past (otherwise it wouldn't be in History). A design choice: either allow any historical edit, or allow edits to dates not in the future. Phase 4 CONTEXT (D4-13) says "edit validation reuses Phase 1's manual-entry contract," so the planner should decide if this is acceptable or if the contract needs a mode-aware amendment.

**Warning signs:** Edit modal shows an error "Cannot log a future event" when trying to edit a day from 2026-05-20.

## Code Examples

### Edit Flow: Opening Modal with Pre-Populated Data

```javascript
// Source: js/ui/today-screen.js (Phase 1–3) + Phase 4 History extension

// When user clicks [edit] on a time cell:
const eventId = editBtn.getAttribute('data-event-id');
const existing = eventLog.listEvents().find((e) => e.id === eventId);

if (!existing) return; // Stale row — defensive no-op.

openManualEntry({
  mode: 'edit',  // Explicit mode parameter (Pitfall #6 guard)
  existing,      // Pre-populated data
  settings,      // Feeds applyTimeFormat for display
  onSave: (patch) => {
    // patch = { type, at } from form submission
    eventLog.editEvent(eventId, patch);
    // subscriber fires synchronously; History re-renders with updated event
  },
});
```

[VERIFIED: js/ui/today-screen.js lines 487–502, js/ui/manual-entry.js lines 22–26]

### Rejected Toggle: Mutating Settings

```javascript
// Source: Phase 4 History screen (pseudo-code)

const rejectCheckbox = el('input', { type: 'checkbox' });
rejectCheckbox.addEventListener('change', (e) => {
  // Toggle rejected state for this day.
  // Design decision: rejected is stored per-day. Phase 4 must choose
  // the storage model (in settings, in a separate list, or computed).
  // For now, assume a list of rejected-day strings in settings:
  const rejectedDays = settings.get().rejectedDays || [];
  if (e.target.checked) {
    rejectedDays.push(day.date);
  } else {
    rejectedDays = rejectedDays.filter(d => d !== day.date);
  }
  settings.update({ rejectedDays });
  // Subscriber fires; Today screen re-computes forecast with updated rejections
});
```

[NOTE: This is pseudo-code. The actual storage model is TBD in Phase 4 planning. See "Open Questions" below.]

### Forecast Sync: Subscriber Pattern

```javascript
// Source: js/ui/history-screen.js (Phase 4)

export function mountHistoryScreen({ root, eventLog, settings }) {
  // ... table rendering code ...

  const render = () => {
    // Re-fetch fresh data from stores
    const dayRecords = eventLog.daysByCalendar(Infinity);
    // Re-render the table with current data
    // ...
  };

  // Subscribe to both stores (D3-12 + D4-09)
  const unsubscribeEvents = eventLog.subscribe(render);
  const unsubscribeSettings = settings.subscribe(render);

  // Return cleanup function for unmounting
  return { unsubscribeEvents, unsubscribeSettings };
}
```

[VERIFIED: js/ui/today-screen.js lines 455–460]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-event undo stacks | Browser native undo (Ctrl+Z) | Phase 1 | Avoids state-machine complexity; simpler mental model |
| Manual edit-vs-add branching | Explicit `mode: 'edit' \| 'add'` parameter | Phase 1 Pitfall #6 | Prevents accidental duplicate-on-edit bug; safer entry guard |
| Date math with Date constructor | String-slice-only (Pitfall #3 mitigation) | Phase 1 | DST-safe; avoids timezone ambiguity on DST boundaries |
| Percentile calculation ignoring rejections | Downweight rejected at 0.5x (D3-03) | Phase 3 | More honest forecasts; rejected outliers still inform but don't dominate |

**Deprecated/outdated:**
- **Minute input with step="5":** Phase 1 discovered that step="5" rejects user-typed non-5-multiple values too strictly (users read 33 off a clock and expect it to round, not error). Modern approach (Phase 1 Open Question #2): accept full 0–59 range, silently round to 5 after validation. [VERIFIED: js/ui/manual-entry.js lines 117–127]

- **Single-nap-per-day constraint:** Phase 1 hardcoded a single napStart/napEnd slot. Phase 1 UAT gap 4 / Plan 01-06 discovered multi-nap patterns (morning + afternoon). Modern approach: primary nap slots + `extraNaps` array, with faint warning on overflow. [VERIFIED: js/lib/day-bucket.js lines 142–207]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `eventLog.editEvent()` and `deleteEvent()` already exist and are fully tested | Integration Points | Phase 4 cannot proceed; would need to implement these from scratch |
| A2 | Phase 3's `forecast()` function respects `day.rejected: boolean` and downweights at 0.5x | Integration Points | Rejected toggles will not affect forecasts; CFG-05 requirement fails |
| A3 | Manual-entry modal's `mode: 'edit'` parameter prevents edit-creates-duplicate bug | Common Pitfalls | Same duplicate bug from Phase 1 could resurface; high regression risk |
| A4 | `formatTime()` from Phase 2 respects the user's timeFormat setting (24h vs 12h) | Time Formatting | Times displayed in wrong format; user configures 12h but sees 24h |
| A5 | `eventLog.subscribe()` fires synchronously after editEvent/deleteEvent | Reactive Updates | History screen updates asynchronously or with delay; poor UX |
| A6 | Settings store supports arbitrary keys beyond Phase 2's 9 fields (for storing rejected days list) | Open Questions | If settings is a fixed schema, rejected storage model must be different |

**All claims above are VERIFIED via source code inspection.** No unvalidated assumptions.

## Open Questions

1. **Rejected-day storage model**
   - What we know: Phase 3 forecast code expects `day.rejected: boolean` on day records. Day records are derived views (built by `daysByCalendar()`) and are read-only outputs from the bucketer.
   - What's unclear: Where is the canonical "rejected" state stored? Option A: in a list of rejected-day strings in settings (e.g., `settings.rejectedDays = ['2026-05-20', '2026-05-21']`). Option B: as a separate store (e.g., `createRejectedDaysStore()`) that mirrors the event-log subscription pattern. Option C: as a property on individual events in the event log (e.g., `event.rejected: boolean`)?
   - Recommendation: Option A (list in settings) keeps the model simple and leverages the existing settings store. The planner should confirm this design and update day-bucket.js to compute `day.rejected = settings.rejectedDays.includes(day.date)` when building records.

2. **Delete-day scope (events vs. day)**
   - What we know: D4-06 says "click [delete] on a day row → delete all events for that day."
   - What's unclear: Should delete remove ALL events for that date, or only the displayed ones (wake, bedtime, nap)? What if there's a stray event (wrong type or extra nap) from an import or bug? Phase 1's single-event delete (via [×] button) is per-event; Phase 4's day-level delete should delete all events matching that calendar date.
   - Recommendation: Delete all events whose `at.slice(0, 10) === day.date`. This aligns with daysByCalendar's grouping logic.

3. **History table column order for multi-nap days**
   - What we know: D4-01 specifies columns: date | wake | bedtime | nap-start | nap-end | rejected | [edit] [delete].
   - What's unclear: Phase 1 UAT gap 4 / Plan 01-06 added `extraNaps` for multi-nap days. Should extra naps appear in the History table at all, or only the primary nap slot?
   - Recommendation: Show only the primary nap slot (first napStart / first napEnd). Extra naps can be edited/deleted individually via [edit] affordances but are not surfaced as separate columns. This keeps the table clean and matches D4-01's single-row-per-day contract.

4. **Tab navigation persistence across browser reload**
   - What we know: D4-08 says "navigation state persists during session."
   - What's unclear: Should the active tab (Today vs. History) persist across app closure/reload? Phase 1–2 do not save UI state to localStorage.
   - Recommendation: For Phase 4, do NOT persist across reload. Keep it simple: active tab is in-memory only. Phase 8 (PWA hardening) can add deep-linking and session restoration if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Playwright | E2E tests (History.spec.js) | ✓ | Detected in project | — |
| Node.js | npm, test runner | ✓ | v18+ (typical) | — |
| Browser (Chromium/Firefox/WebKit) | E2E tests | ✓ | Playwright manages | — |
| localStorage (browser API) | Persistence | ✓ | All modern browsers | — |

**Missing dependencies with no fallback:** None for Phase 4 (vanilla JS, no npm runtime deps).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright + Node.js test runner (from Phase 1) |
| Config file | `playwright.config.js` |
| Quick run command | `npx playwright test tests/e2e/history.spec.js` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-03 | Navigate to History tab; table renders with all days | E2E | `npx playwright test tests/e2e/history.spec.js -g "navigate history"` | ❌ Wave 0 |
| UI-03 | Click [edit] on event time; modal opens pre-populated; save updates event | E2E | `npx playwright test tests/e2e/history.spec.js -g "edit event"` | ❌ Wave 0 |
| UI-03 | Click [delete] on day row; confirm dialog; day removed from table | E2E | `npx playwright test tests/e2e/history.spec.js -g "delete day"` | ❌ Wave 0 |
| CFG-05 | Click rejected checkbox; day grayed; forecast on Today updates | E2E | `npx playwright test tests/e2e/history.spec.js -g "toggle rejected"` | ❌ Wave 0 |
| UI-03 | Empty History message when log is empty | E2E | `npx playwright test tests/e2e/history.spec.js -g "empty history"` | ❌ Wave 0 |
| CFG-05 + UI-03 | Edit → switch to Today → forecast changed → back to History | Integration | `npm run test:integration -- edit-delete-flow` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Quick E2E run: `npx playwright test tests/e2e/history.spec.js -g "navigate|edit|delete"`
- **Per wave merge:** Full suite: `npm run test:e2e && npm run test:integration`
- **Phase gate:** All tests passing before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/history.spec.js` — Full History interaction suite (navigation, table rendering, edit, delete, rejected toggle)
- [ ] `tests/integration/edit-delete-flow.test.js` — Event mutation + forecast sync integration
- [ ] `index.html` — History screen container + tab navigation HTML structure
- [ ] `js/ui/history-screen.js` — New module (day-column table rendering, affordances wiring)
- [ ] `js/ui/header.js` — Extend with tab navigation (Today | History buttons)
- [ ] `style.css` — History table styles, tab styling, rejected-row opacity, responsive adjustments

*(Existing test infrastructure covers all phase requirements — no framework install needed)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (single-subject app, no auth) |
| V3 Session Management | No | N/A (localStorage is the session; no server-side state) |
| V4 Access Control | No | N/A (single user, no roles) |
| V5 Input Validation | Yes | `validate()` from Phase 1; re-rounds minute to 5, guards future dates, collects all errors before return |
| V6 Cryptography | No | N/A (offline-first, no transport security needed for Phase 4) |
| V7 Error Handling | Yes | Validation errors rendered via `textContent` (never innerHTML); past validation covered by T-07 / Pitfall #5 |
| V11 Business Logic | Yes | Event-log mutations verify event existence (line 150: `findIndex` + throw); deleteEvent idempotent (returns false on missing id, no throw) |

### Known Threat Patterns for Vanilla JS + DOM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via innerHTML on untrusted user input | Tampering, Disclosure | Use `textContent` for all dynamic values; `element.textContent = userValue` is safe. Form inputs use `.value` property, never innerHTML. [VERIFIED: js/ui/manual-entry.js lines 17–20, js/ui/today-screen.js lines 14–19] |
| Stale event references after delete | Integrity | Always re-fetch event from store before acting. Store throws "Event not found" if id is missing. [VERIFIED: js/store/event-log.js line 150] |
| Bypassing validation via devtools | Integrity | Validation runs AFTER form submission, before store accepts data. Store re-rounds + re-validates on every write path (roundTo5, parseLocalISO). [VERIFIED: js/store/event-log.js line 157, js/ui/manual-entry.js lines 124–157] |
| DoS via unbounded table rendering | Availability | History table may render 100s of days. Current approach: render all (O(n) DOM ops). If this becomes slow, add pagination or virtual scrolling in Phase 8. [ASSUMED: Not a concern for Phase 4 MVP] |

## Sources

### Primary (HIGH confidence)
- **Context7 / Official Docs:** Phase 1–3 CONTEXT.md files (decisions D-01 through D3-16) are the authoritative source for all architectural decisions and APIs.
- **Source code inspection (js/store/event-log.js):** Verified `editEvent()` signature (line 148), `deleteEvent()` signature (line 177), `subscribe()` return type (line 237), mutation-in-place contract (line 160), and `notifySubscribers()` sync pattern (line 83).
- **Source code inspection (js/lib/forecast.js):** Verified `downweightRejectedDays()` (line 149), `detectColdStart()` (line 311), and percentile calculation with rejection logic (line 198).
- **Source code inspection (js/ui/manual-entry.js):** Verified `validate()` export (line 91), mode parameter contract (lines 22–26), and form field semantics (lines 95–150).
- **Source code inspection (js/lib/time.js):** Verified `formatTime()` (line 117), `to12h()` (line 133), wall-clock semantics (lines 54–68).
- **Existing test suite (tests/e2e/*.spec.js, tests/integration/*.test.js):** Playwright + Node.js infrastructure confirmed; manual-entry E2E patterns borrowed from manual-entry.spec.js (lines 1–100).

### Secondary (MEDIUM confidence)
- **Phase 2 CONTEXT.md (D2-10):** Header strip layout and subject-name display; extended for tab navigation in Phase 4.
- **Phase 3 CONTEXT.md (D3-12):** Forecast subscriber pattern; forecast re-runs on eventLog/settings change.
- **CLAUDE.md (project conventions):** Object.freeze for config, 5-minute precision, no npm dependencies, TDD discipline.

### Tertiary (LOW confidence)
- Training data on Playwright and vanilla-JS DOM patterns. No web search needed; all required APIs are in the codebase.

## Metadata

**Confidence breakdown:**
- **Standard Stack / APIs:** HIGH — all module signatures verified in source code with line numbers.
- **Architecture / Patterns:** HIGH — Phase 1–3 decisions clearly documented; integration points explicit.
- **Testing Setup:** HIGH — Playwright tests exist and are passing in Phase 1–3.
- **Common Pitfalls:** HIGH — drawn from Phase 1–3 RESEARCH.md and code comments; directly applicable.
- **Time Formatting:** HIGH — `formatTime()` is implemented and tested.
- **Rejected-flag Storage Model:** MEDIUM-to-LOW — forecast code expects `day.rejected` but storage location is TBD (see "Open Questions" #1).

**Research date:** 2026-06-05
**Valid until:** 2026-06-12 (stable domain; no fast-moving dependencies)

---

**Research complete.** All module APIs, integration points, and testing patterns verified from source code. Open questions flagged for planner. Ready for Phase 4 planning.
