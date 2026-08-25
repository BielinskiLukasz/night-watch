# Phase 9: UX Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 9-UX Polish
**Areas discussed:** Edit-mode toggle style, Collapse state persistence, Save more sequence skipping, Confirm-before-logging placement

---

## Edit-mode toggle style

### Q1: When the edit-mode toggle is active (controls visible), how should the button signal its state?

| Option | Description | Selected |
|--------|-------------|----------|
| Change label | Button reads "Edit history" when off, changes to "Done editing" when on. Clear intent — user always knows the current state and how to exit edit mode. | ✓ |
| Stay same label, visual state | Button always reads "Edit history" but appears pressed/highlighted (aria-pressed, CSS active style) when on. | |
| You decide | Claude picks whichever is cleaner given the existing button styles. | |

**User's choice:** Change label (Recommended)

### Q2: Where does the Edit history button sit in the toolbar relative to the Export button?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit history first, then Export | Primary action (editing) leads, data action (export) follows. Matches typical toolbar convention. | ✓ |
| Export first, then Edit history | Data action first. | |
| You decide | Claude positions based on visual balance and frequency of use. | |

**User's choice:** Edit history first, then Export (Recommended)

### Q3: Should entering edit mode scroll the table to make controls visible?

| Option | Description | Selected |
|--------|-------------|----------|
| No scroll, user scrolls manually | Just show the controls in place. Simple, no animation. | ✓ |
| You decide | Claude picks based on how the table renders. | |

**User's choice:** No scroll, user scrolls manually

---

## Collapse state persistence

### Q1: When Today screen re-renders after a new event is logged, what happens to an expanded probability-band card?

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to collapsed | Every re-render restores default collapsed state. Simpler — no state to track. | ✓ |
| Maintain expanded state | Track which cards are expanded in a module-level Set. More complex but less jarring. | |

**User's choice:** Reset to collapsed (Recommended)

### Q2: What does "time window" mean on the collapsed single line?

| Option | Description | Selected |
|--------|-------------|----------|
| First and last band times | Show the full range, e.g. "22:00–23:45". Most useful at-a-glance info. | ✓ |
| Just the central/first time | Show only the most likely time. Cleaner but hides the band's breadth. | |
| You decide | Claude picks the most informative format. | |

**User's choice:** First and last band times (Recommended)

### Q3: Should the hero card also collapse, or only the 4 forecast grid cards?

| Option | Description | Selected |
|--------|-------------|----------|
| Only forecast grid cards collapse | Hero card always shows fully expanded. It's the most prominent element. | ✓ |
| Hero card also collapses | Consistent behavior: any prob-band prediction collapses. | |

**User's choice:** Only forecast grid cards collapse

---

## Save more sequence skipping

### Q1: When "Save more" advances to the next type, what if that type is already logged?

| Option | Description | Selected |
|--------|-------------|----------|
| Always follow fixed order, no skipping | Wake → Nap start → Nap end → Bedtime regardless of what's logged. Simple, predictable. | ✓ |
| Skip already-logged types | Check what's logged and skip ahead to the next unlogged type. Smarter but complex. | |

**User's choice:** Always follow fixed order, no skipping (Recommended)

### Q2: Where does "Save more" appear in the modal footer?

| Option | Description | Selected |
|--------|-------------|----------|
| Between Cancel and Save | Cancel \| Save more \| Save. Save (close) stays the rightmost primary action. | ✓ |
| After Save (rightmost) | Cancel \| Save \| Save more. | |
| You decide | Claude positions based on existing button styles. | |

**User's choice:** Between Cancel and Save (Recommended)

### Q3: Should "Save more" be available in both the "+ Add event" flow and the confirm-before-logging flow?

| Option | Description | Selected |
|--------|-------------|----------|
| Both flows show "Save more" | Confirm-before-logging is just a pre-filled manual-entry dialog. Consistent behavior. | |
| Only from "+ Add event" | Quick-log with confirm is meant to confirm one event fast. "Save more" would be unexpected there. | ✓ |

**User's choice:** Only from "+ Add event"

---

## Confirm-before-logging placement

### Q1: How should the toggle fit into the existing Settings modal structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Rename Day Structure → Time & Day, add toggle there | The existing fieldset (cutover hour + view grouping) is already about time/day config. Rename and add the toggle. | ✓ |
| New fieldset between Day Structure and Forecast | Add a new "Logging" or "Quick Log" fieldset. Adds a 6th fieldset. | |
| Add to Subject & Display group | Less intuitive — subject name and time format are unrelated to logging flow. | |

**User's choice:** Rename Day Structure → Time & Day, add toggle there (Recommended)

### Q2: Within the renamed "Time & Day" fieldset, where does the checkbox appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Last in the group | Cutover hour → View grouping → Confirm before logging. Existing order stays stable. | ✓ |
| First in the group | Confirm before logging is behavior-affecting; leading with it draws attention. | |
| You decide | Claude picks based on visual flow and setting importance. | |

**User's choice:** Last in the group (Recommended)

### Q3: When confirm dialog opens from quick-log, is the event type field editable or locked?

| Option | Description | Selected |
|--------|-------------|----------|
| Editable | User can change the event type before saving. Reuses existing type dropdown with no extra constraint. | ✓ |
| Locked (read-only) | Type is locked to the button that was tapped. Requires disabling or hiding the type select. | |

**User's choice:** Editable (Recommended)

---

## Claude's Discretion

- Exact CSS class/element for the "Next Predicted Event" label in the hero card
- Chevron character for collapsed card expand indicator
- ARIA pattern for edit-mode toggle button (aria-pressed vs label-only)
- Visual style of collapsed probability-band card row (height, font size, separator)

## Deferred Ideas

- Dark mode (B-03) — separate theming phase
- Per-event-type default times (B-01) — depends on stable prediction algorithm
- Undo/redo (B-13, B-14) — own phase
- Additional chart types (B-17–B-19) — Charts milestone
- Friendly hour picker (B-02) — major UX rework, own phase
- PWA browser checkpoint (B-24) — human-only task
