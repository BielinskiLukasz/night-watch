---
phase: quick
plan: 260803-otj
subsystem: UI Layout
tags: [layout, quick-task]
status: complete
date_completed: 2026-08-03
duration_minutes: 5
commit_hash: 2a66520
---

# Quick Task 260803-otj: Move "Add events" Button into QuickLog Row

## Summary

Repositioned the "Add event" button from a standalone element below the day list into the `quickLog` button row as the last child, aligning it visually with the four quick-log buttons (Woke up, Going to sleep, Nap start, Nap end). Also renamed the button label to "Add events" to reflect its workflow of enabling multiple event entries via the manual entry modal.

## Changes

### index.html
- Moved `<button id="addEventBtn" class="addEventBtn">` from line 89 (standalone after dayList) into the `<div class="quickLog">` as its last child
- Updated button text from `+ Add event` to `Add events`

### js/ui/today-screen.js
- Changed `textContent: '+ Add event'` to `textContent: 'Add events'` in the addEventBtn element creation
- Appended addEventBtn to quickLog via `quickLog.appendChild(addEventBtn)` before the `replaceChildren()` call
- Updated replaceChildren() args to remove addEventBtn as a standalone sibling (now it's part of quickLog)

### style.css
- Removed `display: block` from `.addEventBtn` (now a flex child of `.quickLog`)
- Removed `margin-top: 1rem; margin-bottom: 1rem;` (flex gap handles spacing)
- Retained padding, border, border-radius, background, color, cursor, and hover styling

## Verification

- Button appears in the quickLog row as the 5th button (after Nap end)
- Button label reads "Add events"
- Clicking the button opens the manual entry modal with the "Save more" option visible
- All existing quick-log buttons (Woke up, Going to sleep, Nap start, Nap end) remain functional
- Layout is responsive and works on mobile and desktop viewports
- All unit and integration tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Tests Passed

- Unit tests: ✓ PASSED
- Integration tests: ✓ PASSED
- E2E tests: ✓ PASSED (background run)

All existing test suites passed with no new failures or warnings introduced by the layout changes.
