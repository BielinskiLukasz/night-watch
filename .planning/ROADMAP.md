# Roadmap: Nightwatch

## Overview

Nightwatch is a vanilla-JS offline-first sleep prediction app that grows from a basic logging + persistence foundation into a full analytics and forecasting suite. Each phase delivers a vertical slice: Phase 1 lands log-and-persist (the smallest usable app), Phase 2 adds configuration levers, Phase 3 introduces the core value (prediction), Phase 4 enables history editing, Phase 5 adds data import/export, Phase 6 introduces life stages, Phase 7 completes visualization with charts and accuracy metrics, and Phase 8 hardens the PWA and platform constraints. By the end, users can log sleep events, forecast the next ones with explicit uncertainty, see accuracy over time, and import/export their data offline-first.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, ...): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Log & Persist** - Log sleep events with quick buttons, manual entry, form-based editing, and localStorage caching; user can reload without losing data. Establishes the full testing scaffold (ESM modules, adapter pattern, unit + integration + Playwright E2E, CI) and TDD discipline for all later phases. (completed 2026-05-26)
- [x] **Phase 2: Configuration & Settings** - Settings UI for subject name, prediction thresholds, outlier rules, window size, stat blend, time format, day cutover; all persisted (completed 2026-05-28)
- [x] **Phase 3: Forecast Engine & Today Screen** - Implement prediction algorithm, show next four events with min/max bands, cold-start gate, reactive updates, and prominent "next event" card (completed 2026-06-05)
- [x] **Phase 4: History Screen & Edit/Delete** - Scrollable history table with per-row edit, delete, and "rejected" toggle; enable outlier flagging and re-computation (completed 2026-06-27)
- [x] **Phase 5: Data Import/Export** - CSV and JSON import (round-trip), JSON export, file-as-truth workflow, localStorage as cache (completed 2026-06-29)
- [x] **Phase 6: Life Stages** - Manual stage boundaries (date range + name), scope forecasts to current stage (completed 2026-06-29)
- [ ] **Phase 7: Charts, Heatmap & Accuracy** - Sleep-length charts, time bands, nap patterns, activity correlation, calendar heatmap, three-metric accuracy dashboard, full navigation
- [ ] **Phase 8: PWA & Platform Hardening** - Multi-file vanilla JS split, PWA manifest + service worker, offline support + file:// loading, GitHub Pages deployment, English UI, calm theme, in-app notifications only

## Phase Details

### Phase 1: Log & Persist

**Goal**: User can log sleep events and see them survive reload, enabling the smallest possible usable app for dogfooding.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07, LOG-08, LOG-09, DATA-04, PLAT-08, PLAT-09, PLAT-10, PLAT-11
**Success Criteria** (what must be TRUE):

  1. User taps "Woke up" quick-log button and sees a timestamp appear in a list on the same screen
  2. User taps "Going to sleep", "Nap start", and "Nap end" buttons and each records a distinct event at the current time rounded to 5 minutes
  3. User manually enters or edits an event via a date/time form for today or any past day, and the change persists
  4. User deletes an event and it disappears from the list
  5. After logging several events, user refreshes the browser page and all events are still there (localStorage survives reload)
  6. Pure-logic modules (time rounding, day-boundary bucketing, localStorage codec) are exercised by unit tests in `tests/unit/` with `node --test`
  7. Integration tests in `tests/integration/` wire store + storage adapter + clock adapter together and assert end-to-end data flow without a browser
  8. Playwright E2E tests in `tests/e2e/` drive a real headless browser through the four quick-log buttons + form + reload-persistence flow
  9. A GitHub Action runs unit + integration + E2E on push/PR; every shipped behavior is covered by at least one test (TDD discipline established)**Plans**: 5 plans across 5 waves (Walking Skeleton + 4 vertical-slice extensions)

**Wave 1**

  - [x] 01-01-PLAN.md (Wave 0): Walking Skeleton — scaffolding, composition root, 1 button, reload spec, CI workflow
  - [x] 01-02-PLAN.md (Wave 1): TDD pure logic — time.js (round-to-nearest), day-bucket.js (calendar + subjective + LOG-09), id.js

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 01-03-PLAN.md (Wave 2): Extend slice — 4 quick-log buttons + day-grouped list + double-click idempotency

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 01-04-PLAN.md (Wave 3): Extend slice — manual entry modal + edit (mutate-in-place) + delete affordances

**Wave 4** *(blocked on Wave 3 completion)*

  - [x] 01-05-PLAN.md (Wave 4): Phase gate — persistence + security smoke + CI supply-chain check + README + D-22 audit

**Wave 5** *(UAT gap-closure — inserted after 01-UAT.md identified blockers)*

  - [x] 01-06-PLAN.md (Wave 5): LOG-09 dedupe — UAT gap 4 BLOCKER closed; bucketer flags overflow naps with `extra:true` on shallow copies; UI single-renders via evt.extra; renderExtraNapRow deleted; faint rows keep [edit]/[×]

### Phase 2: Configuration & Settings

**Goal**: As a parent tracking a child's sleep, I want to set the day-cutover hour and have it stick across reloads, so that day-grouping matches our household's actual sleep cycle, not a hardcoded default.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, CFG-06, CFG-07, CFG-08, CFG-09
**Success Criteria** (what must be TRUE):

  1. User opens Settings and enters a subject display name (e.g., "Alice"), closes Settings, and the name appears in the app header across all screens
  2. User configures max_delta, min_days, rolling-window length, and stat blend in Settings, saves, and the values are persisted after reload
  3. User toggles automatic outlier detection on/off in Settings and can also manually flag any day as "rejected" from a dedicated control
  4. User sets day-cutover hour (default ~04:00) and 24h vs 12h time format, saves, and all times are displayed according to the choice on reload

**Plans**: 6 plans across 3 waves

**Wave 1** *(pure-logic TDD foundation — parallel)*

  - [x] 02-01-PLAN.md — TDD: DEFAULT_SETTINGS + validateSettings pure validator (db-shape.js + settings-validate.js); CFG-05 deferred-to-phase-4 owner
  - [x] 02-02-PLAN.md — TDD: createSettingsStore (get/update/subscribe) + v1→v2 migration integration + cross-store race test

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 02-03-PLAN.md — event-log schema bump (v1→v2) + composition root settings wiring + formatTime/to24h/to12h helpers
  - [x] 02-04-PLAN.md — Header strip + Settings modal UI (CFG-01 fully visible; CFG-02..04, 06..07 stored-but-inert)

**Wave 3** *(blocked on Wave 2 completion — parallel)*

  - [x] 02-05-PLAN.md — **MVP-critical**: cutover wiring + grouping-mode toggle on Today (CFG-08 user-story)
  - [x] 02-06-PLAN.md — Time format propagation: 12h picker in manual-entry + formatTime in Today list (CFG-09)

### Phase 3: Forecast Engine & Today Screen

**Goal**: Users see predictions for the next four sleep events (wake, bedtime, nap start, nap end) with min/max bands, probability fallback for high uncertainty, cold-start gating, and reactive updates.
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: PRED-01, PRED-02, PRED-03, PRED-04, PRED-05, PRED-06, PRED-07, UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. User lands on "Today + Forecast" screen and sees four prediction cards (next wake, next bedtime, next nap start, next nap end) each with a central time and min/max band
  2. When logged history is less than min_days, the screen shows an explicit cold-start message instead of predictions
  3. When a prediction's ±delta exceeds max_delta, the prediction card switches to a probability-band view (e.g., "P(asleep) by 22:30 = 65%")
  4. User logs a new event from the quick-log buttons, and all four predictions update immediately without reload
  5. A prominent "next event" card appears above the four predictions, surfacing the single most imminent event

**Plans**: 5 plans in 4 waves

**Wave 1** *(pure-logic TDD foundation)*

  - [x] 03-01-PLAN.md — TDD: percentile calculation, central time (median), downweighting logic; forecast() function
  - [x] 03-02-PLAN.md — TDD: probability-band generation, cold-start gating

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 03-03-PLAN.md — TDD + integration: next-event cycle-aware priority selection; reactive forecast re-compute flow

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 03-04-PLAN.md — UI rendering: forecast card HTML/CSS, next-event hero card, cold-start message; E2E tests

**Wave 4** *(blocked on Wave 3 completion — phase gate & verification)*

  - [x] 03-05-PLAN.md — Phase gate, documentation, security audit (D-06 gate)

### Phase 4: History Screen & Edit/Delete

**Goal**: User can view, edit, and delete past events, flag days as outliers, and trigger automatic re-prediction upon state changes.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: UI-03, CFG-05
**Success Criteria** (what must be TRUE):

  1. User navigates to the "History" screen and sees a scrollable table of past days, each showing date, wake time, bedtime, nap start/end, and row-level controls
  2. User clicks an edit button on a row, modifies the event times via a form, and the change is reflected in History and (on return to Today) the predictions are re-computed
  3. User clicks delete on a row and the day is removed from history and predictions update
  4. User toggles a "rejected" checkbox on a row to mark it as an outlier; predictions immediately exclude this day and re-compute

**Plans**: 4 plans across 4 waves

**Wave 1** *(pure-logic foundation — rejected-day storage & derivation)*

  - [x] 04-01-PLAN.md — Extend settings schema with rejectedDays array; compute day.rejected in day-bucket; integration test for forecast downweighting

**Wave 2** *(blocked on Wave 1 completion — UI foundation)*

  - [x] 04-02-PLAN.md — Header tab navigation (Today | History); History table rendering; responsive CSS; E2E tests for navigation and layout

**Wave 3** *(blocked on Wave 2 completion — interactive affordances)*

  - [x] 04-03-PLAN.md — [Edit] and [Delete] button handlers; wire to modal and store APIs; forecast reactivity; E2E tests for edit/delete workflows

**Wave 4** *(blocked on Wave 3 completion — phase gate & verification)*

  - [x] 04-04-PLAN.md — Rejected checkbox UI and toggle handler; final CSS styling; E2E test for rejected toggle; security audit; phase documentation; full test suite verification

### Phase 5: Data Import/Export

**Goal**: User can import CSV and previously exported JSON files, export the full dataset as JSON, and treat the exported file as canonical truth with localStorage as cache.
**Mode**: mvp
**Depends on**: Phase 4
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):

  1. User selects a CSV file (matching the known column schema) and imports it; all rows appear in History and forecasts include the new data
  2. User exports the dataset as JSON, downloads it, closes the app, opens it again, and imports the JSON file; the in-memory and localStorage state exactly matches the pre-export state (lossless round-trip)
  3. User imports a CSV, modifies some events, exports to JSON, and confirms the export file reflects all modifications
  4. The app treats the exported JSON as authoritative; if localStorage is cleared, reimporting the JSON file restores full state

**Plans**: 5 plans across 3 waves

**Wave 1** *(TDD foundation — parallel)*

  - [x] 05-01-PLAN.md — TDD: csv-parse.js pure parser (Polish headers, delimiter/date auto-detect, nap optional, activity/rejected columns); db-shape.js activityLog schema injection in all three migration paths
  - [x] 05-02-PLAN.md — TDD: store.replace(blob) API on event-log.js and settings.js + integration test (replace → subscribers fire → state correct)

**Wave 2** *(blocked on Wave 1 completion — parallel)*

  - [x] 05-03-PLAN.md — Export JSON button on History screen toolbar; downloadJSON helper (import-export.js); E2E test for download + file structure
  - [x] 05-04-PLAN.md — CSV import in Settings modal (FileReader, confirmation dialog, success/skip feedback, store replace); E2E test for CSV import flow

**Wave 3** *(blocked on Wave 2 completion — has human-verify checkpoint)*

  - [x] 05-05-PLAN.md — JSON import in Settings modal (FileReader, version guard, confirmation, store replace); round-trip E2E test; full test suite verification; human verification of all four success criteria (approved 2026-06-29)

### Phase 6: Life Stages

**Goal**: User can define named date-range stages (e.g., "dropped second nap") to segment historical data, and scope forecasts to the current stage's data only.
**Mode**: mvp
**Depends on**: Phase 5
**Requirements**: STAGE-01, STAGE-02
**Success Criteria** (what must be TRUE):

  1. User opens a "Stages" section in Settings, adds a new stage with a date range and name (e.g., "2025-01-01 to 2025-06-30: Dropped Second Nap"), and the stage is saved
  2. User selects a stage from a dropdown on the "Today" screen and the forecasts immediately update to use only data from that stage
  3. Stages are listed in History or a dedicated screen, and the user can edit or delete them

**Plans**: 5 plans across 3 waves

**Wave 1** *(TDD foundation — parallel)*

  - [x] 06-01-PLAN.md (Wave 1a): TDD — db-shape.js (DEFAULT_SETTINGS + migrateV1ToV2 stages/activeStageId injection) + settings-validate.js (stages + activeStageId validation rules)
  - [x] 06-02-PLAN.md (Wave 1b): TDD — js/lib/stages.js (filterDayRecordsByStage pure helper) + csv-parse.js etap column extension returning stages array

**Wave 2** *(blocked on Wave 1 — parallel)*

  - [x] 06-03-PLAN.md (Wave 2a): Today screen stage selector — renderStageSelector, filterDayRecordsByStage wiring, fallback note, CSS, E2E tests
  - [x] 06-04-PLAN.md (Wave 2b): Settings modal Stages fieldset — inline add/edit/delete CRUD, overlap warning, CSS, E2E tests

**Wave 3** *(blocked on Wave 2)*

  - [x] 06-05-PLAN.md (Wave 3): Phase gate — CSV import etap→stages wiring, integration + E2E tests, security audit, full test suite, human verification (approved 2026-06-29)

### Phase 7: Charts, Heatmap & Accuracy

**Goal**: User can view sleep-length trends, time-band distributions, nap patterns, activity correlations, accuracy metrics, and navigate between all screens.
**Mode**: mvp
**Depends on**: Phase 6
**Requirements**: UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):

  1. User navigates to the "Charts" screen and sees a line chart of sleep length over time, a scatter/range plot showing wake and sleep time bands, a calendar heatmap of daily sleep length, and a nap-pattern indicator
  2. The Charts screen displays activity-vs-sleep correlation (if activity data is present in the import)
  3. User navigates to the "Accuracy" screen and sees three side-by-side metrics: percentage of forecasts within max_delta, within max_delta/2, and where actual time fell inside the predicted min/max band
  4. User can navigate between Today, History, Charts, and Accuracy screens from any screen via a persistent navigation menu

**Plans**: 5/6 plans executed

**Wave 1** *(test stubs — parallel)*

  - [x] 07-01-PLAN.md — TDD Wave 0: failing unit stubs for accuracy.js + chart-data.js; E2E stubs for bottom-nav, charts-screen, accuracy-screen

**Wave 2** *(blocked on Wave 1 — parallel)*

  - [x] 07-02-PLAN.md — TDD: computeAccuracy pure backtesting engine (RED→GREEN→REFACTOR) [UI-05, D7-16]
  - [x] 07-03-PLAN.md — TDD: chart-data.js five pure transform helpers (buildSleepLengthSeries, buildHeatmapData, buildTimeBandSeries, buildNapStats, buildActivityCorrelation) [UI-04]

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 07-04-PLAN.md — Navigation refactor: bottom-nav.js + header.js simplification + app.js four-screen applyTabVisibility + index.html + style.css [UI-06]

**Wave 4** *(blocked on Wave 3 — parallel)*

  - [x] 07-05-PLAN.md — Charts screen: mountChartsScreen with all five SVG visualizations + E2E verification [UI-04]
  - [ ] 07-06-PLAN.md — Accuracy screen: mountAccuracyScreen 4x3 grid + E2E verification + full Phase 7 gate [UI-05]

### Phase 8: PWA & Platform Hardening

**Goal**: App is distributed as a multi-file vanilla-JS PWA with offline-first service worker, works from file:// and from GitHub Pages, installs to home screen, and applies calm visual identity.
**Mode**: mvp
**Depends on**: Phase 7
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07
**Success Criteria** (what must be TRUE):

  1. App source is split into separate HTML, CSS, and JS files (not a monolithic index.html) and loads all assets correctly
  2. App includes a valid web manifest and service worker; it installs to the home screen and can be launched offline
  3. Opened from `file:///` on the user's local disk, the app works fully (logs, settings, forecasts, import/export, all screens)
  4. App is deployed to GitHub Pages and accessible via a public URL
  5. UI text is entirely in English, uses a calm dark/minimal theme distinct from mindful-breathing, and all notifications are in-app only (no browser/OS push)

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Log & Persist | 8/8 | Complete   | 2026-05-27 |
| 2. Configuration & Settings | 7/7 | Complete    | 2026-05-28 |
| 3. Forecast Engine & Today Screen | 5/5 | Complete    | 2026-06-04 |
| 4. History Screen & Edit/Delete | 4/4 | Complete | 2026-06-27 |
| 5. Data Import/Export | 5/5 | Complete | 2026-06-29 |
| 6. Life Stages | 5/5 | Complete | 2026-06-29 |
| 7. Charts, Heatmap & Accuracy | 5/6 | In Progress|  |
| 8. PWA & Platform Hardening | 0/TBD | Not started | — |

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
