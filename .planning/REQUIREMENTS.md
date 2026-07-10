# Requirements: Nightwatch v1.1

**Defined:** 2026-07-09
**Core Value:** Given a sufficient history of sleep events, predict the next ones accurately enough to be useful — and show the user, transparently, how accurate the predictions have been over time.

## v1.1 Requirements

### Logging (LOG)

- [x] **LOG-10**: When "Confirm before logging" is ON, tapping a quick-log button opens the full manual-entry dialog pre-filled with the current time and that event type; user can adjust any field before saving
- [x] **LOG-11**: Manual-entry popup includes a "Save more" button that saves the current event, keeps the popup open, and pre-fills the form for the next event type in sequence (Wake → Nap start → Nap end → Bedtime → Wake); after saving Bedtime, the date advances by one day and the type resets to Wake

### Configuration (CFG)

- [x] **CFG-10**: Settings modal Time & Day group includes a "Confirm before logging" toggle; when OFF (default), quick-log buttons log instantly at the current time; when ON, they open the pre-filled manual-entry dialog

### UI (UI)

- [x] **UI-07**: History table renders without edit/delete/rejected controls by default; an "Edit history" toggle button in the history toolbar shows/hides all controls; toggle state resets when navigating away from the History tab
- [x] **UI-08**: "Add event" button is positioned at the top of the Today screen, above the prediction cards and hero card
- [x] **UI-09**: Prediction cards in probability-band fallback (±delta > max_delta) render as a compact collapsed single line showing event label, time window, and an expand chevron [↓]; tapping a collapsed card expands it to the full card; tapping an expanded uncertain card collapses it
- [x] **UI-10**: Hero card on the Today screen shows an explicit "Next Predicted Event" label above the predicted time and event type (TD-2)

### Platform / Quality (PLAT)

- [ ] **PLAT-12**: Probability-band E2E test rewritten to use a realistic fixture with 30+ days of all four event types (wake, nap-start, nap-end, bedtime), validating fallback rendering in realistic scenarios (TD-3)
- [x] **PLAT-13**: `nw-research-test/` scratch directory removed from the repository root (TD-1)

## v2 Requirements

*Deferred from v1.1 scope:*

- B-01 / B-02: Per-event-type default times + friendly hour picker
- B-03: Dark mode with manual + hour-based auto-switch
- B-04–B-07: Prediction algorithm refinements
- B-12: Multi-nap per day history
- B-13–B-14: Undo / redo
- B-15: Three-tab navigation (Today | Events | History)
- B-17–B-19: Additional chart types
- B-21: Custom prediction algorithm from Excel model

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-event-type default times (B-01) | Depends on forecast median as default source; deferred until prediction algorithm is stable |
| Friendly hour picker (B-02) | Major UX rework; keep for dedicated UX phase |
| Dark mode (B-03) | Theming scope; phase 8 or v1.2 |
| Prediction algorithm overhaul (B-04–B-07, B-21) | Requires separate prediction-refinement phase |
| Multi-nap per day (B-12) | v2 data shape change |
| Undo / redo (B-13–B-14) | Nice-to-have; not blocking |
| Tab restructure (B-15) | Larger navigation refactor; own phase |
| Additional chart types (B-17–B-19, B-25–B-27) | Charts milestone; own phase |
| Metrics dashboard (B-26) | Own phase |
| Heatmap tooltip (B-22) | Low priority; deferred |
| PWA browser checkpoint (B-24) | Human-only task; not a code deliverable |

## Traceability

*Updated by roadmapper after roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOG-10 | Phase 9 | Complete |
| LOG-11 | Phase 9 | Complete |
| CFG-10 | Phase 9 | Complete |
| UI-07 | Phase 9 | Complete |
| UI-08 | Phase 9 | Complete |
| UI-09 | Phase 9 | Complete |
| UI-10 | Phase 9 | Complete |
| PLAT-12 | Phase 9 | Pending |
| PLAT-13 | Phase 9 | Complete |

**Coverage:**

- v1.1 requirements: 9 total
- Mapped to phases: 9 (Phase 9)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-09*
*Last updated: 2026-07-09 — traceability filled after roadmap creation*
