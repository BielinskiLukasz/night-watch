# Roadmap: Nightwatch

## Milestones

- **[v1.0](milestones/v1.0-ROADMAP.md)** — 8 phases, 46 plans, 51/51 requirements, 495 tests; shipped 2026-06-30 (tag: `v1.0.0`)
- **[v1.1](milestones/v1.1-ROADMAP.md)** — 1 phase, 6 plans, 9/9 requirements, 635 tests; shipped 2026-07-10 (tag: `v1.1.0`)
- **v1.2 Prediction & Metrics** — 2 phases, 17/17 requirements; in progress

## Phases

**Phase Numbering:** v1.0 used phases 1–8, v1.1 used phase 9, v1.2 continues from phase 10.

- [ ] **Phase 10: TIF Algorithm & Settings** - Opt-in Trimmed Intersection Forecast with precision scoring, Settings controls, and Today screen rendering
- [x] **Phase 11: Metrics Screen** - Dedicated 5th-tab screen with per-day duration/activity/ratio metrics and historical aggregates (completed 2026-07-28)

## Phase Details

### Phase 10: TIF Algorithm & Settings

**Goal**: Users can opt into the Trimmed Intersection Forecast algorithm from Settings and see multi-window, precision-scored predictions on Today screen
**Depends on**: Phase 9 (v1.1 complete)
**Requirements**: TIF-01, TIF-02, TIF-03, TIF-04, TIF-05, TIF-06, TIF-07, TIF-08, TIF-09, TIF-10, TIF-11
**Success Criteria** (what must be TRUE):

  1. User can open Settings and switch the forecast algorithm between "Classic" and "TIF"; the choice persists across page reloads
  2. User can set the TIF trim percentage (0–40, default 10) and precision target in minutes (default 60) in Settings; both values persist across sessions
  3. When TIF is active, each predicted event on Today screen shows a prediction window derived from the intersection of its defined source windows, with a precision score displayed alongside
  4. When a TIF window intersection is empty for an event, Today screen shows the union range instead and marks the prediction "low confidence"
  5. When the algorithm range exceeds the precision target, the displayed window is narrowed to precision-target width centered on the midpoint; the original range remains visible alongside

**Plans**: 10-01 (metrics.js), 10-02 (forecast-tif.js algorithm), 10-03 (settings data model), 10-04 (settings UI), 10-05 (today screen + app wiring + E2E)
**Waves**: Wave 1: 10-01 + 10-03 (parallel) → Wave 2: 10-02 + 10-04 (parallel) → Wave 3: 10-05
**UI hint**: yes

### Phase 11: Metrics Screen

**Goal**: Users can explore per-day and aggregate sleep/activity metrics in a dedicated 5th-tab screen
**Depends on**: Phase 10 (metrics.js shared module)
**Requirements**: MET-01, MET-02, MET-03, MET-04, MET-05, MET-06
**Success Criteria** (what must be TRUE):

  1. User can tap a Metrics tab in the bottom navigation bar and land on the Metrics screen
  2. For each logged day, the Metrics screen shows sleep duration, nap duration, combined duration, and day length
  3. For each logged day, the Metrics screen shows activity-before-nap, activity-after-nap, total activity time, activity-after-sleep factor, and sleep-after-activity factor
  4. The Metrics screen shows historical aggregates — average, minimum with date, and maximum with date — for every displayed metric
  5. When a stage is active, user can toggle the Metrics screen to show only stage-scoped data

**Plans**: 2/3 plans executed

- [x] 11-01-PLAN.md
- [x] 11-02-PLAN.md
- [x] 11-03-PLAN.md

**Waves**: Wave 1: 11-01 → Wave 2: 11-02 → Wave 3: 11-03
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. TIF Algorithm & Settings | 0/5 | Not started | - |
| 11. Metrics Screen | 3/3 | Complete    | 2026-07-28 |

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
