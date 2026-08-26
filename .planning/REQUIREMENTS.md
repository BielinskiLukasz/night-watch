# Requirements: Nightwatch v1.3

**Milestone:** v1.3 Prediction & TIF Enhancements
**Defined:** 2026-08-25
**Core Value:** Given a sufficient history of sleep events, predict the next ones accurately enough to be useful — and show the user, transparently, how accurate the predictions have been over time.

---

## v1.3 Requirements

### Prediction Logic

- [x] **PRED-08**: When the current hour is ≥ 18 and the last logged event is a wake, the forecaster predicts bedtime as the next event (not nap start)
- [x] **PRED-09**: Wake-up predictions are computed from both a historic hour-band and a sleep-duration-band (bedtime + typical sleep duration), then unioned into a wider, more robust forecast window
- [x] **PRED-10**: User can mark a day as "intense" via a checkbox in the event-entry form; the flag is stored per day in history and used by the forecaster as a contextual modifier
- [x] **PRED-11**: When a nap-start event has not occurred by a threshold hour, the forecaster detects a likely missed nap and shifts the bedtime prediction earlier accordingly
- [x] **PRED-12**: The nap prediction card on the Today screen displays a nap probability score (% likelihood the child will nap today), derived from: historical nap frequency in the active stage, time elapsed since wake vs. typical nap-start window, consecutive no-nap streak, and whether the typical nap window has already passed

### TIF Extensions

- [ ] **TIF-12**: When TIF is active, nap-start predictions include an additional ratio window derived from `(activityBeforeNap / sleepDuration)` applied to the wake anchor; nap-end predictions include a ratio window derived from `(activityBeforeNap / napDuration)` applied to nap-start anchor
- [x] **TIF-13**: When TIF is active, each historical window includes a rolling-window variant (last N days, configurable via `tifRollingDays` setting); when MA/AA values are recorded on a day, those are used in preference to derived timestamp differences
- [x] **TIF-15**: When TIF is active, each window computes a median in addition to its min/max bounds; the central predicted time for each event type is the average of the medians across all active windows (the min/max band bounds continue to use intersection/union of window ranges unchanged)
- [ ] **TIF-16**: On no-nap days (no nap-start logged by the threshold hour), TIF substitutes day-length (wake→bedtime) bands from historical no-nap days in place of activity-after-nap windows for bedtime prediction; tonight's predicted sleep duration uses historical sleep-duration patterns from nights following no-nap days; tomorrow's predicted nap start and nap duration use patterns from days immediately following a no-nap day

### TIF Metrics & Accuracy

- [ ] **TIF-14**: When TIF is the active algorithm, the Accuracy screen shows a TIF-specific grid with: per-event-type window hit rate ("actual time fell inside TIF window"), average window width in minutes, and percentage of days with confidence score ≥ 80%
- [ ] **MET-07**: The SAA (Sleep After Activity) ratio column is replaced with a Day/Sleep Factor column (`dayLength / sleepDuration`); all existing tests and documentation referencing `saa` are updated
- [ ] **MET-08**: When TIF is active, the Metrics screen shows the raw unclipped `[finalStart, finalEnd]` bounds and confidence score per event type for the selected day
- [ ] **MET-09**: Metrics screen includes a Nap Fraction column (`napDuration / combinedSleepNap`), shown as a decimal; null on no-nap days
- [ ] **MET-10**: Metrics screen includes an AM/PM Split column (`activityBeforeNap / activityAfterNap`), shown as a decimal; null on no-nap days or when either activity segment is absent
- [ ] **MET-11**: When TIF is active, the Metrics screen historical aggregates section shows three additional rows alongside the existing min/max rows: `min-TIF`, `median-TIF`, and `max-TIF` — computed from the TIF algorithm's window parameters (trimmed lower bound, per-window median, trimmed upper bound) for each event type

### UI Polish & Bug Fixes

- [x] **UI-07**: On the Today screen, prediction cards are ordered wake → nap start → nap end → bedtime in the vertical (mobile) layout; bedtime card no longer appears before the nap cards
- [ ] **UI-08**: The Wake & Bedtime Bands chart Y-axis is inverted so that earlier times (morning) appear at the bottom and later times (evening) appear at the top; Y-axis tick labels update accordingly
- [ ] **UI-09**: The Wake & Bedtime Bands chart displays nap-start and nap-end dots alongside the existing wake and bedtime dots, each in a distinct color with the legend updated to show all four series; days with no nap show a gap in the nap series
- [ ] **UI-10**: The Wake & Bedtime Bands chart renders each event as exactly one dot per day — post-midnight events (e.g. bedtime at 00:30) are plotted only once, at their subjective-night time position relative to the cutover hour, eliminating the duplicate-dot bug

---

## Future Requirements (deferred from v1.3)

Items remaining in backlog after v1.3 scope was set:

| ID | Topic | Why deferred |
|----|-------|-------------|
| B-001 | Per-event-type default times in manual entry | UX polish bundle — not in current cycle |
| B-002 | Friendly hour picker (clock-face/wheel) | UX polish bundle — not in current cycle |
| B-003 | Dark mode with auto-switch | UX polish bundle — not in current cycle |
| B-013 | Undo last event edit/delete/add | Not prioritised for v1.3 |
| B-014 | Redo undone actions | Paired with B-013 — deferred together |
| B-025 | Sleep-length calculation audit + more chart types | Charts phase planned for later |
| B-027 | Additional chart types (combined, histograms) | Charts phase planned for later |
| B-028 | Reorder event-type list in Add Event (bedtime last) | Minor UX — deferred |
| B-029 | Reorder prediction cards (bedtime last — horizontal) | UI-07 covers vertical; horizontal deferred |
| B-030 | Missed-time indicator on hero card only | Deferred to UX polish pass |
| B-032 | Settings modal: forecast algorithm selector UX | Deferred to UX polish pass |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-nap per day (LOG2-01) | v1 constraint — single nap/day; deferred to v2 |
| Multi-profile / multi-subject (CFG2-01) | v1 constraint — single subject; deferred to v2 |
| Auto-detected life stages | Statistically nontrivial — manual stages sufficient |
| Browser / OS push notifications | Permission flows + complex SW — v2 |
| Polish UI / i18n | English only in v1 |
| Backend / accounts / cloud sync | Offline-first; file-as-truth |
| Frameworks / build tooling / npm runtime deps | Hard constraint inherited from mindful-breathing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRED-08 | Phase 12 | Complete |
| PRED-09 | Phase 12 | Complete |
| PRED-10 | Phase 12 | Complete |
| PRED-11 | Phase 12 | Complete |
| PRED-12 | Phase 12 | Complete |
| UI-07 | Phase 12 | Complete |
| TIF-12 | Phase 13 | Pending |
| TIF-13 | Phase 13 | Complete |
| TIF-15 | Phase 13 | Complete |
| TIF-16 | Phase 13 | Pending |
| TIF-14 | Phase 14 | Pending |
| MET-07 | Phase 14 | Pending |
| MET-08 | Phase 14 | Pending |
| MET-09 | Phase 14 | Pending |
| MET-10 | Phase 14 | Pending |
| MET-11 | Phase 14 | Pending |
| UI-08 | Phase 14 | Pending |
| UI-09 | Phase 14 | Pending |
| UI-10 | Phase 14 | Pending |

**Coverage:**

- v1.3 requirements: 19 total
- Mapped to phases: 19 (Phase 12: 6, Phase 13: 4, Phase 14: 9)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-25 — traceability filled in by roadmapper*
