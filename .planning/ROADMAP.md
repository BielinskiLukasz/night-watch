# Roadmap: Nightwatch

## Overview

Nightwatch is a vanilla-JS offline-first sleep prediction app that grows from a basic logging + persistence foundation into a full analytics and forecasting suite. Each phase delivers a vertical slice: Phase 1 lands log-and-persist (the smallest usable app), Phase 2 adds configuration levers, Phase 3 introduces the core value (prediction), Phase 4 enables history editing, Phase 5 adds data import/export, Phase 6 introduces life stages, Phase 7 completes visualization with charts and accuracy metrics, and Phase 8 hardens the PWA and platform constraints. By the end, users can log sleep events, forecast the next ones with explicit uncertainty, see accuracy over time, and import/export their data offline-first.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, ...): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Log & Persist** - Log sleep events with quick buttons, manual entry, form-based editing, and localStorage caching; user can reload without losing data
- [ ] **Phase 2: Configuration & Settings** - Settings UI for subject name, prediction thresholds, outlier rules, window size, stat blend, time format, day cutover; all persisted
- [ ] **Phase 3: Forecast Engine & Today Screen** - Implement prediction algorithm, show next four events with min/max bands, cold-start gate, reactive updates, and prominent "next event" card
- [ ] **Phase 4: History Screen & Edit/Delete** - Scrollable history table with per-row edit, delete, and "rejected" toggle; enable outlier flagging and re-computation
- [ ] **Phase 5: Data Import/Export** - CSV and JSON import (round-trip), JSON export, file-as-truth workflow, localStorage as cache
- [ ] **Phase 6: Life Stages** - Manual stage boundaries (date range + name), scope forecasts to current stage
- [ ] **Phase 7: Charts, Heatmap & Accuracy** - Sleep-length charts, time bands, nap patterns, activity correlation, calendar heatmap, three-metric accuracy dashboard, full navigation
- [ ] **Phase 8: PWA & Platform Hardening** - Multi-file vanilla JS split, PWA manifest + service worker, offline support + file:// loading, GitHub Pages deployment, English UI, calm theme, in-app notifications only

## Phase Details

### Phase 1: Log & Persist
**Goal**: User can log sleep events and see them survive reload, enabling the smallest possible usable app for dogfooding.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07, LOG-08, LOG-09
**Success Criteria** (what must be TRUE):
  1. User taps "Woke up" quick-log button and sees a timestamp appear in a list on the same screen
  2. User taps "Going to sleep", "Nap start", and "Nap end" buttons and each records a distinct event at the current time rounded to 5 minutes
  3. User manually enters or edits an event via a date/time form for today or any past day, and the change persists
  4. User deletes an event and it disappears from the list
  5. After logging several events, user refreshes the browser page and all events are still there (localStorage survives reload)
**Plans**: TBD

### Phase 2: Configuration & Settings
**Goal**: User can customize the app's behavior (subject name, prediction thresholds, outlier rules, time format, rolling window, stats blend, day cutover) and all settings persist across sessions.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05, CFG-06, CFG-07, CFG-08, CFG-09
**Success Criteria** (what must be TRUE):
  1. User opens Settings and enters a subject display name (e.g., "Alice"), closes Settings, and the name appears in the app header across all screens
  2. User configures max_delta, min_days, rolling-window length, and stat blend in Settings, saves, and the values are persisted after reload
  3. User toggles automatic outlier detection on/off in Settings and can also manually flag any day as "rejected" from a dedicated control
  4. User sets day-cutover hour (default ~04:00) and 24h vs 12h time format, saves, and all times are displayed according to the choice on reload
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

### Phase 6: Life Stages
**Goal**: User can define named date-range stages (e.g., "dropped second nap") to segment historical data, and scope forecasts to the current stage's data only.
**Mode**: mvp
**Depends on**: Phase 5
**Requirements**: STAGE-01, STAGE-02
**Success Criteria** (what must be TRUE):
  1. User opens a "Stages" section in Settings, adds a new stage with a date range and name (e.g., "2025-01-01 to 2025-06-30: Dropped Second Nap"), and the stage is saved
  2. User selects a stage from a dropdown on the "Today" screen and the forecasts immediately update to use only data from that stage
  3. Stages are listed in History or a dedicated screen, and the user can edit or delete them
**Plans**: TBD

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
**Plans**: TBD

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
| 1. Log & Persist | 0/TBD | Not started | — |
| 2. Configuration & Settings | 0/TBD | Not started | — |
| 3. Forecast Engine & Today Screen | 0/TBD | Not started | — |
| 4. History Screen & Edit/Delete | 0/TBD | Not started | — |
| 5. Data Import/Export | 0/TBD | Not started | — |
| 6. Life Stages | 0/TBD | Not started | — |
| 7. Charts, Heatmap & Accuracy | 0/TBD | Not started | — |
| 8. PWA & Platform Hardening | 0/TBD | Not started | — |
