# Requirements: Nightwatch v1.2

**Milestone:** v1.2 Prediction & Metrics  
**Status:** Active — in planning  
**Backlog sources:** B-21 (TIF algorithm, fully specified 2026-07-12), B-26 (metrics dashboard, extended 2026-07-12)

---

## v1.2 Requirements

### TIF — Trimmed Intersection Forecast Algorithm

- [ ] **TIF-01**: User can toggle the forecast algorithm between "Classic" (existing) and "TIF" via a Settings control; the toggle persists across sessions
- [ ] **TIF-02**: User can set the TIF auto-trim percentage (0–40, step 1, default 10) in Settings — controls how many extreme-value events are excluded per event type before any window is computed
- [ ] **TIF-03**: User can set the TIF precision target in minutes (default 60) in Settings — the desired maximum width of a displayed TIF prediction window
- [ ] **TIF-04**: When TIF is active, wake-up predictions are derived from the intersection of three independent windows: (1) historic wake-time band, (2) sleep-duration band projected from bedtime anchor, (3) sleep+nap combined duration band projected from bedtime anchor
- [ ] **TIF-05**: When TIF is active, nap-start predictions are derived from the intersection of two windows: (1) historic nap-start band, (2) activity-before-nap (wake→nap-start duration) band projected from wake anchor
- [ ] **TIF-06**: When TIF is active, nap-end predictions are derived from the intersection of two windows: (1) historic nap-end band, (2) nap-duration band projected from nap-start anchor
- [ ] **TIF-07**: When TIF is active, bedtime predictions are derived from the intersection of three windows: (1) historic bedtime band, (2) day-length (wake→bedtime duration) band projected from wake anchor, (3) activity-after-nap (nap-end→bedtime duration) band projected from nap-end anchor
- [ ] **TIF-08**: When the intersection of all windows is non-empty, TIF uses that intersected range as the prediction; when the intersection is empty (start > end), TIF falls back to the union of all window ranges and marks the prediction "low confidence"
- [ ] **TIF-09**: Each TIF prediction displays a precision score: 100% when the algorithm's computed range width ≤ precision target; `precisionTarget / algRange × 100%` otherwise
- [ ] **TIF-10**: When TIF's computed range exceeds the precision target, the displayed prediction window is narrowed to precision-target width centered on the algorithm's midpoint; the original range and precision score remain visible alongside
- [ ] **TIF-11**: TIF predictions respect the existing cold-start gate (min_days setting) and the existing manual outlier/rejected-day flags; manually rejected events count against the trim budget before auto-trim is applied

### MET — Metrics Screen

- [ ] **MET-01**: User can navigate to a dedicated Metrics screen from the bottom navigation bar (5th tab, alongside Today, History, Charts, Accuracy)
- [ ] **MET-02**: Metrics screen shows per-day duration metrics for each logged day: sleep duration (night only), nap duration, combined sleep+nap duration, and day length (wake→bedtime)
- [ ] **MET-03**: Metrics screen shows per-day activity breakdown: total activity time (day length − nap duration), activity before nap (wake→nap-start), and activity after nap (nap-end→bedtime)
- [ ] **MET-04**: Metrics screen shows per-day ratio metrics: activity-after-sleep factor (activity time ÷ night-sleep duration) and sleep-after-activity factor (night-sleep duration ÷ previous day's activity time)
- [ ] **MET-05**: Metrics screen shows historical aggregates for all duration and ratio metrics: average, minimum value with date, and maximum value with date
- [ ] **MET-06**: When an active stage is set, user can toggle the Metrics screen to show only data within the current stage (same scope control behaviour as the Charts screen stage filter)

---

## Future Requirements (deferred from v1.2)

Items in the backlog not promoted to this milestone:

| ID | Topic | Why deferred |
|----|-------|-------------|
| B-01 | Per-event-type default times | UX polish — separate milestone |
| B-02 | Friendly hour picker (clock-face / wheel) | UX polish — separate milestone |
| B-03 | Dark mode + auto-switch | UX polish — separate milestone |
| B-04 | Time-based bedtime rule | Prediction refinement — evaluate after TIF ships |
| B-05 | Duration-based prediction | Subsumed by TIF sleep-duration windows (TIF-04) |
| B-06 | Intense day checkbox | Prediction context flag — future milestone |
| B-07 | Missing nap impact on bedtime | Prediction refinement — future milestone |
| B-12 | Multi-nap per day | Data shape change — v2 scope |
| B-13 | Undo edit/delete/add | UX polish — future milestone |
| B-14 | Redo undone actions | UX polish — future milestone |
| B-15 | Three-tab navigation (Today \| Events \| History) | UI restructure — future milestone |
| B-17 | Nap length chart | Charts extension — future milestone |
| B-18 | Invert time axis on Wake & Bedtime Bands | Charts tweak — future milestone |
| B-19 | Nap scatter (Chart 2 extension) | Charts extension — future milestone |
| B-22 | Heatmap cell rich tooltip | Charts polish — future milestone |
| B-25 | More diagrams + sleep-length calculation audit | Charts extension — future milestone |
| B-27 | Additional chart types (histograms, activity scatter) | Charts extension — future milestone |
| B-28 | Reorder event-type list (bedtime last) | UX polish — future milestone |
| B-29 | Reorder prediction cards (bedtime last) | UX polish — future milestone |
| B-30 | Missed-time indicator in hero card only | UX polish — future milestone |

---

## Out of Scope

- **Classic forecaster removal** — TIF is additive only; the Phase 3 `forecast.js` stays as the default. Removing it is a separate decision.
- **Additional TIF windows** (B-21 "suggested" list: activity-after-sleep ratio band, stage-scoped windows, rolling-window variant) — captured in B-21 open questions; can extend TIF in a future phase after baseline TIF ships and is validated.
- **Multi-nap, multi-profile** — v2 scope per CLAUDE.md; TIF and Metrics are designed for the single-nap, single-subject v1 data shape.
- **Browser/OS push notifications** — v2 scope.
- **Polish localization** — English only in v1.

---

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| TIF-01 | Phase 10 | — | ⬜ Planned |
| TIF-02 | Phase 10 | — | ⬜ Planned |
| TIF-03 | Phase 10 | — | ⬜ Planned |
| TIF-04 | Phase 10 | — | ⬜ Planned |
| TIF-05 | Phase 10 | — | ⬜ Planned |
| TIF-06 | Phase 10 | — | ⬜ Planned |
| TIF-07 | Phase 10 | — | ⬜ Planned |
| TIF-08 | Phase 10 | — | ⬜ Planned |
| TIF-09 | Phase 10 | — | ⬜ Planned |
| TIF-10 | Phase 10 | — | ⬜ Planned |
| TIF-11 | Phase 10 | — | ⬜ Planned |
| MET-01 | Phase 11 | — | ⬜ Planned |
| MET-02 | Phase 11 | — | ⬜ Planned |
| MET-03 | Phase 11 | — | ⬜ Planned |
| MET-04 | Phase 11 | — | ⬜ Planned |
| MET-05 | Phase 11 | — | ⬜ Planned |
| MET-06 | Phase 11 | — | ⬜ Planned |

**Coverage:** 17/17 (100%) — roadmap complete, planning in progress

---

*Requirements defined: 2026-07-13*
