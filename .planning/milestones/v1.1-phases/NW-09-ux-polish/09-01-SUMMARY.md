---
phase: NW-09
plan: "01"
subsystem: ui
tags: [ui, ux-polish, today-screen, css]
status: complete
committed: true
commit: aa1082b
requirements: [UI-08, UI-10, PLAT-13]

dependency_graph:
  requires: []
  provides: [repositioned-add-event-btn, hero-label-next-event]
  affects: [js/ui/today-screen.js, style.css]

tech_stack:
  added: []
  patterns: [el() helper for DOM, textContent-only XSS guard]

key_files:
  created: []
  modified:
    - js/ui/today-screen.js
    - style.css
  deleted:
    - nw-research-test/sample.test.js
    - nw-research-test/ (directory)

decisions:
  - Hero label uses static literal "Next Predicted Event" — no user data, no XSS surface
  - .hero-label rule added after .next-event-hero.missed to preserve cascade order
  - nw-research-test/ confirmed to contain only sample.test.js before deletion

metrics:
  duration: "< 5 minutes"
  completed: "2026-07-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
  files_deleted: 1
---

# Phase 9 Plan 01: Reposition addEventBtn + Hero Label Summary

One-liner: Moved "+ Add event" button above prediction cards and added an uppercase "Next Predicted Event" label as the first child of the hero card, plus deleted the scratch test directory.

## Requirements Met

- **UI-08** — addEventBtn repositioned to index 2 in `replaceChildren` (after stageSelectorContainer, before nextEventCard)
- **UI-10** — hero label "Next Predicted Event" added as first child of `.next-event-hero` card with correct visual treatment
- **PLAT-13** — `nw-research-test/` scratch directory deleted from repository root

## Changes

- `js/ui/today-screen.js`:
  - `renderNextEventCard()`: inserted `card.appendChild(el('p', { className: 'hero-label', textContent: 'Next Predicted Event' }))` before the existing `.event-type` appendChild (line ~124)
  - `mountTodayScreen()`: updated `replaceChildren` call to new order: `quickLog, stageSelectorContainer, addEventBtn, nextEventCard, coldStartMsg, forecastCards, toggle, dayList` (addEventBtn moved from tail to index 2); updated comment to reflect D9-16 layout
- `style.css`: added `.next-event-hero .hero-label` rule (0.875rem, weight 400, uppercase, letter-spacing 0.06em, opacity 0.85, color #fff, margin-bottom 0.5rem) after `.next-event-hero.missed` block
- `nw-research-test/`: directory deleted (contained only `sample.test.js`, no production imports)

## Tests

- Unit suite: 495 tests, 0 failures — no regressions
- No new test files required (static literal DOM changes and replaceChildren reorder do not require integration tests)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — hero label text is a static literal with no user data flowing into it.

## Self-Check: PASSED

- `aa1082b` confirmed in git log
- `js/ui/today-screen.js` modified with both edits
- `style.css` modified with `.hero-label` rule
- `nw-research-test/` confirmed absent
- Unit suite: 495 pass, 0 fail
