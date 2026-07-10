# Phase 4: History Screen & Edit/Delete - Discussion Log

**Gathered:** 2026-06-05
**Participants:** User, Claude (Builder)

## Discussion Summary

Phase 4 discussion focused on five key design areas for the History screen: layout, edit flow, rejected-flag UI, delete interaction, and navigation structure. The user made all major decisions from a UX perspective, prioritizing clarity and consistency with existing Phase 1–3 patterns.

---

## Area 1: History Table Layout

**Decision:** Day-column table layout (date, wake, bedtime, nap-start, nap-end, rejected)

**Options Discussed:**
1. Minimal columns (date, type, time, rejected) — one row per event
2. Day-grouped view (date header, sub-rows per event type)
3. **Day columns (date, wake, bedtime, nap-start, nap-end, rejected)** ✓ CHOSEN

**Why This Wins (UX perspective):**
- Mirrors the user's existing spreadsheet schema (sen.xlsx), reducing cognitive load
- One row = one day's sleep data, matching how users think about sleep cycles
- Compact and scannable; easy to compare wake/bedtime/nap times at a glance
- Aligns with Phase 3's forecast-card layout (grouped by event type)

**Additional Notes:**
- Table is chronological, most recent first (descending by date)
- Empty nap cells show "—" or are left blank
- Times shown in user's configured format (24h or 12h from Phase 2)

---

## Area 2: Edit Flow

**Decision:** Edit individual events (reuse manual-entry dialog)

**Options Discussed:**
1. **Edit individual events (reuse manual-entry dialog)** ✓ CHOSEN
2. Edit all events for a day (new form)
3. Inline editing (click time to edit in place)

**Why This Wins (UX perspective):**
- Reuses tested Phase 1 affordances; users already know how it works
- Consistent UI (same modal, same validation)
- Simpler to implement (no new form code)
- Flexible: user can edit one event or multiple events one at a time

**Additional Notes:**
- Modal title changes to "Edit event" (vs. "Add event")
- Form pre-populated with event's current date/hour/minute/type
- Same validation rules apply (future-date guard, 5-min rounding, hour/minute ranges)

---

## Area 3: Rejected Toggle UI

**Decision:** Checkbox column (always visible)

**Options Discussed:**
1. **Checkbox column (always visible)** ✓ CHOSEN
2. Menu button on each row (⋮ popup)
3. Reject button next to delete (per-row buttons)

**Why This Wins (UX perspective):**
- Most discoverable (visible at all times, no hidden menu)
- Consistent with Phase 2's Settings toggles (users recognize checkboxes)
- Direct action with one click; no extra interactions
- Accessibility best practice: form controls should be visible

**Additional Notes:**
- Toggling a checkbox immediately affects the day's rejected state
- No confirmation needed (toggle is reversible)
- Rejected days are visually grayed out (~50% opacity) to signal exclusion

---

## Area 4: Delete Interaction

**Decision:** Confirmation dialog

**Options Discussed:**
1. Immediate delete (no confirmation, browser undo available)
2. **Confirmation dialog ("Are you sure?")** ✓ CHOSEN
3. Soft delete (archive as rejected instead of hard-delete)

**Why This Wins (UX perspective):**
- Prevents accidental deletion of data (permanent operation, common mistake)
- Safety/data-loss prevention outweighs the slight interaction cost (one extra click)
- Browser undo (Ctrl+Z) is unreliable for localStorage operations
- Simple, clear confirmation message reduces user hesitation

**Additional Notes:**
- Confirmation dialog text: "Delete this day and all its events? This cannot be undone."
- After confirmation, the day is removed from the event log and forecast re-computes
- Future phases (7+) can add undo/restore UI if needed

---

## Area 5: Navigation Structure

**Decision:** Two-tab header navigation (Today | History)

**Options Discussed:**
1. **Tab/button at the top (persistent nav)** ✓ CHOSEN
2. Link/button on Today screen only
3. Back/forward browser-style navigation

**Tab Placement Decision:** Top (in header area)

**Options Discussed:**
- Top (in header area) ✓ CHOSEN
- Bottom (bottom nav bar)

**Why Top Navigation Wins (UX perspective):**
- Standard pattern users recognize (Safari, Chrome, most web apps)
- Discovery first: users see navigation immediately
- Frequent switching between Today and History justifies persistent nav
- Sets up the structure for Phase 7's expansion (add Charts and Accuracy tabs)
- Matches accessibility best practice (always in viewport)

**Additional Notes:**
- Two tabs in header: "Today | History"
- Active tab is visually highlighted; inactive tab is normal/grayed
- Tab state persists during the session (if on History, user stays on History after editing)
- Phase 7 will expand to four tabs (Today, History, Charts, Accuracy)

---

## Area 6: Forecast Reactivity (Bonus Decision)

**Decision:** Forecasts update only on Save (after edit form closes)

**Rationale:**
- Clean and predictable (no surprise forecast changes while editing)
- Matches Phase 3 behavior (forecast re-runs when event log completes, not mid-edit)
- Reduces visual noise and potential jank from mid-edit recalculation

**Additional Notes:**
- Delete is immediate (forecast updates right away after confirmation)
- Edit requires Save to trigger forecast re-compute

---

## Area 7: Rejected Day Styling (Bonus Decision)

**Decision:** Grayed out / lower opacity (~50%)

**Rationale:**
- Simple, clean, minimal visual impact
- Matches the calm aesthetic (no color clutter)
- Universally understood (grayed = inactive/excluded)
- Works for colorblind users (when combined with checkbox visual state)

**Additional Notes:**
- Entire day row is grayed out when rejected
- Data remains readable for audit/review purposes

---

## Area 8: Rejection Metadata (Bonus Decision)

**Decision:** Defer to Phase 7

**Rationale:**
- Phase 4 scope is History table UI (view, edit, delete, toggle rejected)
- Rejection *metadata* (why it was rejected) belongs with Phase 7's accuracy/analytics focus
- CFG-04 (auto outlier detection) is not yet implemented; all rejections in Phase 4 are manual
- Keeps phase scope tight and focused

**Additional Notes:**
- Phase 7's accuracy dashboard can expand with rejection history and reasons
- No complexity added to Phase 4 for a feature not yet needed

---

## Deferred Ideas (Out of Scope for Phase 4)

1. **Bulk edit (edit all events for a day at once)** — User can edit one at a time; faster for most workflows. Bulk form deferred to Phase 7 if needed.

2. **Rejection reason display (manual vs. auto-detected)** — No auto-detection yet; defer with Phase 7's accuracy dashboard.

3. **Undo/restore UI (custom undo stack)** — Phase 4 relies on browser undo. Phase 7+ can add in-app undo.

4. **Tab deep linking (navigate directly to History via URL)** — Phase 8 PWA hardening can add URL/hash-based routing.

---

## Key Takeaways

- **Consistency is king.** Reusing Phase 1's manual-entry modal, Phase 2's toggle patterns, and Phase 3's reactive forecast keeps the app coherent and reduces implementation surface.

- **UX perspective prioritizes safety & discoverability.** Confirmation on delete, visible checkboxes, persistent tabs, grayed-out rejected rows — all are design choices that prioritize clarity and prevent data loss over speed.

- **User's spreadsheet model drives design.** The day-column table mirrors sen.xlsx, so the mental model is familiar and transfer is fast.

- **Phase 4 scope is tight.** Focus on the History table, edit/delete, and rejected-flag toggle. Metadata, bulk operations, and multi-screen navigation expansion come later.

---

*Phase: 4-History Screen & Edit/Delete*
*Discussion log gathered: 2026-06-05*
