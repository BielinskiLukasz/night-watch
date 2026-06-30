# Requirements: Nightwatch

**Defined:** 2026-05-26
**Core Value:** Given enough sleep history, predict the next wake/bed/nap events accurately enough to be useful, with explicit uncertainty when the prediction is too soft to pin to a single time, and surface accuracy transparently over time.

## v1 Requirements

### Logging

- [ ] **LOG-01**: User can tap a "Woke up" quick-log button that records a wake event at the current time, rounded to 5 minutes.
- [x] **LOG-02**: User can tap a "Going to sleep" quick-log button that records a bedtime event at the current time, rounded to 5 minutes.
- [x] **LOG-03**: User can tap a "Nap start" quick-log button that records a nap-start event at the current time, rounded to 5 minutes.
- [x] **LOG-04**: User can tap a "Nap end" quick-log button that records a nap-end event at the current time, rounded to 5 minutes.
- [x] **LOG-05**: User can manually enter or edit any event time via a form (date + time picker) for the current day or any past day.
- [x] **LOG-06**: User can delete a logged event from history.
- [x] **LOG-07**: All event times are captured, stored, and displayed at 5-minute precision.
- [x] **LOG-08**: Events that belong to the same subjective night/day are grouped under one "day" record using a configurable cutover hour (default ~04:00).
- [x] **LOG-09**: Each day record contains at most one nap (a single start/end pair).

### Configuration

- [x] **CFG-01**: User can set a single subject profile display name in Settings.
- [x] **CFG-02**: User can configure `max_delta` (the prediction-confidence threshold above which the app falls back to a probability band) in Settings.
- [x] **CFG-03**: User can configure `min_days` (minimum history days before forecasts are shown) in Settings.
- [x] **CFG-04**: User can toggle automatic outlier detection on/off in Settings.
- [x] **CFG-05**: User can manually mark any day as "rejected" (outlier) from the History screen, and the toggle is persisted with the day record.
- [x] **CFG-06**: User can configure the rolling-window length (in days) used for forecasts in Settings.
- [x] **CFG-07**: User can choose the statistical blend used for predictions — median, mean, or a configurable blend — in Settings.
- [x] **CFG-08**: User can configure the day-cutover hour in Settings (default ~04:00).
- [x] **CFG-09**: User can toggle between 24-hour (default) and 12-hour time format in Settings, with the choice persisted.

### Prediction

- [x] **PRED-01**: User sees a forecast for the next wake-up time, shown as a central time plus a min/max band. *(Phase 3 Complete — verified via unit tests + integration tests + E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **PRED-02**: User sees a forecast for the next bedtime, shown as a central time plus a min/max band. *(Phase 3 Complete — verified via unit tests + integration tests + E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **PRED-03**: User sees a forecast for the next nap start, shown as a central time plus a min/max band. *(Phase 3 Complete — verified via unit tests + integration tests + E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **PRED-04**: User sees a forecast for the next nap end, shown as a central time plus a min/max band. *(Phase 3 Complete — verified via unit tests + integration tests + E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **PRED-05**: When a prediction's ±delta exceeds the configured `max_delta`, the app replaces the point + band view with a probability band over time (e.g. `P(asleep) by 22:30 = 65%`, `by 23:00 = 82%`). *(Phase 3 Complete — verified via unit tests + E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **PRED-06**: Forecasts are hidden until at least `min_days` of valid (non-rejected) history exist; the UI shows an explicit cold-start message instead. *(Phase 3 Complete — verified via unit tests + integration tests + E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **PRED-07**: Forecasts update automatically and immediately whenever the user logs a new event or toggles a day's `rejected` flag. *(Phase 3 Complete — verified via integration tests + E2E tests. See Phase 3 SUMMARY.md.)*

### Screens

- [x] **UI-01**: "Today + Forecast" landing screen shows the next four predicted events with bands plus the four quick-log buttons. *(Phase 3 Complete — verified via E2E tests. See Phase 3 SUMMARY.md.)*
- [x] **UI-02**: "Today + Forecast" landing screen surfaces a prominent "next event" card that acts as the in-app notification. *(Phase 3 Complete — verified via E2E tests. See Phase 3 SUMMARY.md.)*
- [ ] **UI-03**: "History" screen shows a scrollable table of past days with per-row edit, delete, and "rejected" toggle controls.
- [x] **UI-04**: "Charts" screen displays sleep length over time, wake- and sleep-time bands, nap pattern, activity-vs-sleep correlation, and a calendar heatmap of sleep length.
- [x] **UI-05**: "Accuracy" screen shows three success-rate metrics side-by-side: percentage of forecasts within `max_delta`, within `max_delta / 2`, and where the actual time fell inside the predicted min/max band.
- [x] **UI-06**: User can navigate between Today, History, Charts, and Accuracy from any screen.

### Data Lifecycle

- [ ] **DATA-01**: User can export the full dataset as a structured JSON file downloaded via the browser.
- [ ] **DATA-02**: User can import a previously exported JSON file, after which the in-memory and localStorage state exactly matches the import (lossless round-trip).
- [ ] **DATA-03**: User can import a CSV file matching the known column schema (translated from the existing `sen.xlsx` Polish columns).
- [x] **DATA-04**: App state is cached in localStorage so the app survives reloads and offline use without losing data.
- [ ] **DATA-05**: Exported JSON is treated as canonical truth; localStorage acts as a cache that can be rebuilt from an import.

### Stages

- [ ] **STAGE-01**: User can mark a date range as a named "stage" (e.g. "dropped second nap") to segment historical data into developmental periods.
- [ ] **STAGE-02**: User can scope the forecast to use only data from the current stage.

### Platform

- [ ] **PLAT-01**: App is built with vanilla HTML/CSS/JS only — no frameworks, no build step, no npm dependencies.
- [ ] **PLAT-02**: Code is split across multiple HTML/CSS/JS files (not a single index.html).
- [x] **PLAT-03**: App installs as a PWA (manifest + service worker) and works fully offline, including when loaded from `file://`.
- [ ] **PLAT-04**: App is deployable to GitHub Pages with no server-side code.
- [ ] **PLAT-05**: UI text is English only.
- [ ] **PLAT-06**: App has its own visual identity — same calm/dark/minimal/ambient register as `mindful-breathing` but a distinct accent palette and glyph set.
- [ ] **PLAT-07**: All notifications are surfaced in-app only — no browser or OS push notifications.
- [x] **PLAT-08**: App logic is unit-testable via Node's built-in test runner (`node:test` + `node:assert`). Tests live in `tests/unit/` and run separately from the deployed PWA bundle (excluded from service-worker precache and GitHub Pages output). A GitHub Action runs `node --test tests/` on push/PR with zero install.
- [x] **PLAT-09**: App is structured into pure-logic modules with thin adapters for DOM, `localStorage`, and the system clock so multiple modules can be composed and exercised together in Node without a browser. Integration tests live in `tests/integration/` and use `node:test`; the runtime stays zero-dependency.
- [x] **PLAT-10**: App has end-to-end UI tests using Playwright as a dev-only dependency (`devDependencies` only — never shipped to GitHub Pages). E2E tests live in `tests/e2e/`, drive a real browser, exercise the rendered UI, and run in the same GitHub Action as unit/integration tests. The deployed PWA bundle remains pure vanilla HTML/CSS/JS with no runtime npm dependencies.
- [x] **PLAT-11**: Project follows TDD as its primary development discipline. Strict red→green→refactor for pure-logic and integration tests; UI code may be written test-after with at least one E2E test as a regression guard for every user-visible behavior. Every shipped requirement has at least one automated test covering it.

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Logging / Data Shape

- **LOG2-01**: Support multiple naps per day in the data model and UI.
- **LOG2-02**: Direct `.xlsx` import (currently requires one-time conversion to CSV).

### Subject

- **CFG2-01**: Multi-profile switching (track more than one subject's sleep).

### Prediction

- **PRED2-01**: Auto-detected life stages via change-point detection on sleep duration.

### Platform

- **PLAT2-01**: Browser/OS push notifications via a permission flow and richer service worker.
- **PLAT2-02**: Polish-language UI localization (current Polish column names are import-mapping only).

## Out of Scope

Explicitly excluded from v1 — not deferred, not planned. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Backend / accounts / cloud sync | Offline-first, file-as-truth design — no server. |
| Frameworks / build tooling / npm dependencies | Hard constraint inherited from `../mindful-breathing`. |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOG-01 | Phase 1 | Pending |
| LOG-02 | Phase 1 | Complete |
| LOG-03 | Phase 1 | Complete |
| LOG-04 | Phase 1 | Complete |
| LOG-05 | Phase 1 | Complete |
| LOG-06 | Phase 1 | Complete |
| LOG-07 | Phase 1 | Complete |
| LOG-08 | Phase 1 | Complete |
| LOG-09 | Phase 1 | Complete |
| CFG-01 | Phase 2 | Complete |
| CFG-02 | Phase 2 | Complete |
| CFG-03 | Phase 2 | Complete |
| CFG-04 | Phase 2 | Complete |
| CFG-05 | Phase 4 | Complete |
| CFG-06 | Phase 2 | Complete |
| CFG-07 | Phase 2 | Complete |
| CFG-08 | Phase 2 | Complete |
| CFG-09 | Phase 2 | Complete |
| PRED-01 | Phase 3 | Complete |
| PRED-02 | Phase 3 | Complete |
| PRED-03 | Phase 3 | Complete |
| PRED-04 | Phase 3 | Complete |
| PRED-05 | Phase 3 | Complete |
| PRED-06 | Phase 3 | Complete |
| PRED-07 | Phase 3 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 7 | Complete |
| UI-05 | Phase 7 | Complete |
| UI-06 | Phase 7 | Complete |
| DATA-01 | Phase 5 | Pending |
| DATA-02 | Phase 5 | Pending |
| DATA-03 | Phase 5 | Pending |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 5 | Pending |
| STAGE-01 | Phase 6 | Pending |
| STAGE-02 | Phase 6 | Pending |
| PLAT-01 | Phase 8 | Pending |
| PLAT-02 | Phase 8 | Pending |
| PLAT-03 | Phase 8 | Complete |
| PLAT-04 | Phase 8 | Pending |
| PLAT-05 | Phase 8 | Pending |
| PLAT-06 | Phase 8 | Pending |
| PLAT-07 | Phase 8 | Pending |
| PLAT-08 | Phase 1 | Complete |
| PLAT-09 | Phase 1 | Complete |
| PLAT-10 | Phase 1 | Complete |
| PLAT-11 | Phase 1 | Complete |

**Coverage:**

- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0

---
*Requirements defined: 2026-05-26*
*Last updated: 2026-06-05 after Phase 3 completion (PRED-01..07, UI-01..02 marked Complete)*
