# Roadmap: Nightwatch

## Milestones

- **[v1.0](milestones/v1.0-ROADMAP.md)** — 8 phases, 46 plans, 51/51 requirements, 495 tests; shipped 2026-06-30 (tag: `v1.0.0`)
- **v1.1 UX Polish** — in progress (milestone started 2026-07-09)

## Phases

### v1.1 UX Polish

- [ ] **Phase 9: UX Polish** - Reduce logging friction and improve visual clarity on Today, History, and prediction screens

## Phase Details

### Phase 9: UX Polish

**Goal**: Users experience less friction logging events and see clearer visual hierarchy on the Today, History, and prediction screens
**Depends on**: Phase 8 (v1.0 complete — NW-08-pwa-platform-hardening)
**Requirements**: LOG-10, LOG-11, CFG-10, UI-07, UI-08, UI-09, UI-10, PLAT-12, PLAT-13
**Success Criteria** (what must be TRUE):

  1. User can enable "Confirm before logging" in the Settings Time & Day group; when ON, tapping a quick-log button opens the full manual-entry dialog pre-filled with the current time and that event type; when OFF (default) buttons log instantly as before
  2. Manual-entry popup has a "Save more" button that saves the current event, keeps the popup open, and advances the form to the next event type in sequence (Wake → Nap start → Nap end → Bedtime → Wake, with the date advancing by one day after saving Bedtime)
  3. History screen opens without edit/delete/rejected controls visible; an "Edit history" toggle button in the toolbar shows and hides all controls; toggle state resets to hidden when navigating away from the History tab
  4. Today screen displays the "Add event" button above the prediction cards and hero card; each probability-band fallback card (±delta > max_delta) renders as a compact single line showing event label, time window, and a chevron — tapping expands it to the full card, tapping again collapses it; hero card shows an explicit "Next Predicted Event" label above the predicted time and type
  5. Probability-band E2E test passes using a realistic 30+ day fixture covering all four event types (wake, nap-start, nap-end, bedtime) and validating fallback rendering; the nw-research-test/ directory does not exist at the repository root

**Plans**: 3/6 plans executed

- [x] 09-01-PLAN.md — PLAT-13 (delete nw-research-test/), UI-08 (Add event button repositioned), UI-10 (hero card label)
- [x] 09-02-PLAN.md — UI-07 (history edit-mode toggle)
- [x] 09-03-PLAN.md — UI-09 (probability-band card collapse)
- [ ] 09-04-PLAN.md — CFG-10 + LOG-10 (confirm before logging setting + quick-log handler)
- [ ] 09-05-PLAN.md — LOG-11 (Save more button in manual-entry modal)
- [ ] 09-06-PLAN.md — PLAT-12 (E2E test rewrite with 30+ day fixture)

**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. UX Polish | 3/6 | In Progress|  |

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
