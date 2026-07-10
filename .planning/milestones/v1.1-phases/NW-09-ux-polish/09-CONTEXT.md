# Phase 9: UX Polish - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 reduces daily logging friction and improves visual clarity on the Today, History, and prediction screens. By the end of this phase:

1. **History edit-mode toggle (UI-07)** — Edit/delete/rejected controls are hidden by default; an "Edit history" button in the toolbar reveals them; button label changes to "Done editing" when active; state resets on tab navigation.
2. **Add event button repositioned (UI-08)** — "Add event" button moves from the bottom of Today screen to the top, between the stage selector and the hero/prediction cards.
3. **Prediction card collapse (UI-09)** — Probability-band prediction cards (±delta > max_delta) render as a compact single line (event label + first–last band times + expand chevron); tap to expand to full card; only forecast grid cards collapse, not the hero card.
4. **Hero card label (UI-10)** — An explicit "Next Predicted Event" label appears above the predicted time and event type on the hero card.
5. **Confirm before logging (LOG-10 / CFG-10)** — A new "Confirm before logging" toggle in Settings (Time & Day group, renamed from "Day Structure") controls whether quick-log buttons log instantly (OFF, default) or open the manual-entry dialog pre-filled with current time + that event type (ON).
6. **Save more button (LOG-11)** — Manual-entry popup opened via "+ Add event" gains a "Save more" button (between Cancel and Save) that saves the current event, keeps the popup open, and pre-fills for the next type in sequence (Wake → Nap start → Nap end → Bedtime → Wake next day); not shown when opened via confirm-before-logging.
7. **Probability-band E2E test rewrite (PLAT-12)** — `tests/e2e/forecast.spec.js` rewritten with a 30+ day fixture covering all four event types to validate realistic fallback rendering.
8. **Scratch directory removal (PLAT-13)** — `nw-research-test/` removed from repo root.

Phase 9 does NOT include: data model changes, new screens, multi-profile/multi-nap, algorithm changes, new chart types.

</domain>

<decisions>
## Implementation Decisions

### History Edit-Mode Toggle (UI-07)

- **D9-01:** The "Edit history" toggle button **changes its label** when active: reads "Edit history" when controls are hidden, changes to "Done editing" when controls are visible.
- **D9-02:** Toolbar button order: **"Edit history" / "Done editing" first, Export second**. Edit action leads, data export follows.
- **D9-03:** Entering edit mode does **not auto-scroll** the table. Controls appear in-place at each row; user scrolls manually to reach them.
- **D9-04:** Toggle state is local — **resets to "hidden" when the user navigates away from the History tab** (per UI-07 requirement). This is implicit: remounting the screen starts with edit mode off.

### Prediction Card Collapse (UI-09)

- **D9-05:** Collapsed line content for a probability-band card: **event label + first-to-last band time range** (e.g., "Bedtime • 22:00–23:45") + expand chevron [↓].
- **D9-06:** Collapsed state is the **default for all probability-band forecast grid cards**. On every re-render (reactive on new log events), expanded cards **reset to collapsed** — no cross-render state tracking.
- **D9-07:** **Hero card (next-event-hero) never collapses.** Collapse behavior is strictly limited to the four forecast grid cards (`renderPredictionCard`). The hero card always shows fully.

### Save More Button (LOG-11)

- **D9-08:** "Save more" is **only visible when the manual-entry popup is opened via "+ Add event"**. It is not shown when the popup is opened via "Confirm before logging" (quick-log button with confirm ON). The `openManualEntry` call from the confirm-before-logging path omits the Save more button; the call from the Add event button includes it.
- **D9-09:** Button order in the modal footer: **Cancel | Save more | Save**. "Save" (close) stays the rightmost primary action.
- **D9-10:** Sequence always follows **fixed order** regardless of already-logged events: Wake → Nap start → Nap end → Bedtime → Wake (next calendar day). No lookup or skipping. User can manually change the pre-filled type if needed.
- **D9-11:** After saving Bedtime, the form date **advances by one day** and type resets to Wake, per LOG-11 requirement.

### Confirm Before Logging (CFG-10 / LOG-10)

- **D9-12:** The "Day Structure" fieldset in Settings is **renamed "Time & Day"**. The "Confirm before logging" checkbox is added as the **last item in that group** after the existing "Day cutover hour" and "View grouping" controls.
- **D9-13:** Default is **OFF** (`confirmBeforeLogging: false` in DEFAULT_SETTINGS in `js/lib/db-shape.js`).
- **D9-14:** When the confirm dialog opens pre-filled from a quick-log button, the **event type field is editable** — not locked. User can adjust time or switch type before saving.
- **D9-15:** When "Confirm before logging" is ON, the confirm flow opens the standard manual-entry dialog via `openManualEntry({ mode: 'add', ... })` with the event type pre-selected and time pre-filled to the current clock time. The "Save more" button is **not shown** in this path (D9-08).

### Add Event Button Repositioned (UI-08)

- **D9-16:** New layout order: `quickLog → stageSelector → addEventBtn → nextEventCard → coldStart → forecastCards → toggle → dayList`. The "Add event" button moves from the tail of `replaceChildren()` to just before `nextEventCard`.

### Hero Card Label (UI-10)

- **D9-17:** Add a heading or label element with text "Next Predicted Event" above the event type and predicted time in `renderNextEventCard()`. Styled as a small muted label (similar to existing `.time-band` style) — Claude picks the exact element and class.

### Claude's Discretion

- Exact CSS class/element for the "Next Predicted Event" label in the hero card (D9-17) — consistent with existing muted text styles.
- Chevron character/icon for collapsed card expand indicator — use a simple Unicode chevron (↓ or ›) consistent with the existing minimal line-art style.
- Whether "Edit history" / "Done editing" uses `aria-pressed` or just label change for accessibility — Claude picks the right ARIA pattern.
- Visual style of collapsed probability-band card (row height, font size, separator) — must fit within existing `.prediction-card` CSS context.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Full project context, constraints, key decisions. Specifically: vanilla JS only, no npm runtime deps, textContent-only security invariant, TDD discipline, file-as-truth storage.
- `.planning/REQUIREMENTS.md` — v1.1 requirements: LOG-10, LOG-11, CFG-10, UI-07, UI-08, UI-09, UI-10, PLAT-12, PLAT-13. All 9 requirements are in Phase 9.
- `.planning/ROADMAP.md` § Phase 9 — Phase boundary and success criteria.
- `CLAUDE.md` — Repo conventions: TDD discipline, REQ-IDs in commits, no npm runtime deps, textContent-only for all dynamic DOM, Object.freeze config objects, adapter injection seam.

### Source files in scope

- `js/ui/today-screen.js` — UI-08 (button reposition), UI-09 (card collapse), UI-10 (hero label). Current layout: line 494 `root.replaceChildren(quickLog, stageSelectorContainer, nextEventCard, coldStart, forecastCards, toggle, dayList, addEventBtn)`. `renderNextEventCard()` at line 117. `renderPredictionCard()` at line 184. `hasProbBand` detection at line 196.
- `js/ui/history-screen.js` — UI-07 (edit-mode toggle). Toolbar built in `mount()` at lines 62–74. `buildDayRow()` at line 193 renders edit/delete/rejected controls. Currently no edit-mode gating.
- `js/ui/manual-entry.js` — LOG-10 (pre-fill confirm flow), LOG-11 (Save more button). `openManualEntry()` at line 184. Current footer has Cancel + Save only. The function accepts `mode: 'add'|'edit'` and `existing` for pre-fill.
- `js/ui/settings-modal.js` — CFG-10 (confirm-before-logging toggle). `openSettings()` at line 57. Settings form reads/writes via `settings.update()`.
- `js/lib/db-shape.js` — `DEFAULT_SETTINGS` (line 37, `Object.freeze`d). Add `confirmBeforeLogging: false`.
- `js/lib/settings-validate.js` — `validateSettings()` must pass through `confirmBeforeLogging` boolean.
- `index.html` — "Day Structure" fieldset (lines 215–229) to be renamed "Time & Day"; new checkbox added. Manual-entry form has Cancel + Save buttons (in `<menu>`) — Save more button added between them.
- `tests/e2e/forecast.spec.js` — PLAT-12: rewrite to use 30+ day fixture with all four event types.
- `nw-research-test/` — PLAT-13: delete entire directory.

### Prior phase decisions (load-bearing for Phase 9)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — D-03 (mutate-in-place for editEvent), D-07 (adapter injection seam), D-10 (BUTTONS array as SSOT for quick-log types), D-19–D-22 (testing scaffold layout).
- `.planning/phases/NW-08-pwa-platform-hardening/08-CONTEXT.md` — D8-14 (Settings modal five logical groups — "Day Structure" is Group 2). Phase 9 renames Group 2 to "Time & Day" and adds the confirm toggle.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`openManualEntry({ mode, existing, onSave, clock, settings })` in `js/ui/manual-entry.js`** — The pre-fill path for confirm-before-logging uses `mode: 'add'` with a pre-selected `type` passed via `existing` or a new parameter. "Save more" advancement is handled inside this function or via a callback. The `onSave` callback fires on each save; for "Save more", the function must re-open or re-fill without closing the dialog.
- **`BUTTONS` array in `js/ui/today-screen.js`** — The four quick-log button definitions (type, label). "Confirm before logging" reads the `type` from whichever BUTTON was clicked to pre-fill the dialog.
- **CSS custom properties in `style.css`** — `--color-surface`, `--color-accent`, `--color-text-muted` etc. Collapsed card row and edit-mode button styles should use these.
- **`el()` helper in `js/ui/dom.js`** — Used throughout UI modules for textContent-safe element creation. All new DOM creation in Phase 9 uses this helper.

### Established Patterns

- **textContent-only invariant** — All dynamic values (event labels, times, band ranges) must use `textContent` or `el({textContent: ...})`. No `innerHTML` with user-controlled data anywhere in `js/`.
- **`replaceChildren()` / `clear()` for re-renders** — `renderForecastSection` and `buildTable` clear their container and rebuild from scratch on each render. The collapse reset behavior (D9-06) is a consequence of this pattern — no extra cleanup code needed.
- **Toolbar built once at mount, table re-rendered on data change** — `mountHistoryScreen` builds the toolbar once (line 62–74) and calls `render()` to rebuild the table root on each store notification. The edit-mode toggle lives in the toolbar (built once); its state persists across table re-renders within the same session.
- **Settings fieldset grouping** — Five `<fieldset>` elements in `index.html`, `settings-modal.js` reads them via named form elements (`form.elements.namedItem`). A new `confirmBeforeLogging` checkbox in the HTML fieldset maps naturally to `data.get('confirmBeforeLogging')` in the close handler.
- **`DEFAULT_SETTINGS` in `js/lib/db-shape.js`** — `Object.freeze`d. New keys require spreading `{ ...DEFAULT_SETTINGS, confirmBeforeLogging: false }` for mutable copies in tests.

### Integration Points

- **Quick-log button click handler (today-screen.js)** — Currently calls `eventLog.addEvent(...)` directly. When `confirmBeforeLogging` is ON, it must instead call `openManualEntry({ mode: 'add', ... })` with pre-filled type + current time. Must read `settings.get().confirmBeforeLogging` at click time.
- **`renderPredictionCard` in today-screen.js** — Currently renders full card always. Phase 9 adds a collapsed state branch: when `hasProbBand`, render a compact row with click handler to toggle expanded/collapsed class. On re-render (new `forecastCards.replaceChildren(...)`), collapsed state resets automatically (D9-06).
- **Manual-entry dialog `<menu>` in index.html** — Currently has Cancel + Save. Phase 9 adds a "Save more" `<button type="button">` between them. The button is initially hidden; `openManualEntry` shows/hides it based on whether the caller passed a `saveMore: true` flag (or equivalent).

</code_context>

<specifics>
## Specific Ideas

- **Collapsed card format:** `[Event Label] • [first band time]–[last band time] [chevron]` — e.g., "Bedtime • 22:00–23:45 ↓". The bullet separator and em-dash range keep it readable at small size.
- **Edit-mode button ARIA:** Use `aria-pressed="true/false"` on the "Edit history" / "Done editing" button even though the label changes — belt-and-suspenders for screen readers.
- **Save more sequence table:** The four-type sequence is implemented as a fixed array `['wake', 'napStart', 'napEnd', 'bedtime']` with a circular-next function. After 'bedtime', the date increments and type resets to 'wake'.
- **Confirm-before-logging quick-log pre-fill:** The type comes from the BUTTONS entry's `type` field. The current time comes from `clock.now()` (not `new Date()` — preserves the clock-adapter seam).

</specifics>

<deferred>
## Deferred Ideas

- Dark mode (B-03) — separate UX/theming phase, deferred from v1.1.
- Per-event-type default times (B-01) — depends on stable prediction algorithm.
- Undo/redo (B-13, B-14) — own phase.
- Additional chart types (B-17–B-19) — Charts milestone.
- Friendly hour picker (B-02) — major UX rework, own phase.
- PWA browser checkpoint (B-24) — human-only task, not a code deliverable.

</deferred>

---

*Phase: 9-UX Polish*
*Context gathered: 2026-07-10*
