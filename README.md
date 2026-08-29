# Nightwatch

![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Version](https://img.shields.io/badge/version-1.3.0-blue)
![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ECMAScript-2022-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow)

> Sleep tracker and forecaster for one subject — log night sleep and naps, see tomorrow's predicted wake, bedtime, and nap times, and track how accurate those predictions are over time.  
> No backend. No dependencies. No build step.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)
- [Browser Support](#browser-support)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

Nightwatch is a vanilla-JS, offline-first PWA for tracking a single subject's sleep. It replaces a manual spreadsheet workflow: log events (wake-up, bedtime, nap start, nap end) and the app uses a rolling window of history to predict the next four sleep events with confidence bands. When the data is too uncertain for a point estimate, it switches to a probability table rather than hiding the uncertainty.

All data lives in the browser's `localStorage` or in a downloaded JSON file — there is no server, no account, and no network requirement after the first load.

---

## Features

### Event Logging

| Feature | Description |
|---------|-------------|
| Quick-log buttons | Woke up, Going to sleep, Nap start, Nap end — each records the current time rounded to the nearest 5 minutes |
| Confirm before logging | Optional toggle; when ON, quick-log buttons open the full manual-entry dialog pre-filled with the current time and event type instead of logging instantly |
| Manual entry | Native `<dialog>` modal for back-filling past events or correcting any record; future-date guard prevents accidental errors |
| Save more | Saves the current event, keeps the modal open, and advances the form in sequence (Wake → Nap start → Nap end → Bedtime); date advances automatically after Bedtime |

### Forecasting

| Feature | Description |
|---------|-------------|
| Forecast engine | Predicts the next four sleep events from a configurable rolling window of history using P10/P50/P90 percentiles |
| Contextual rules | Evening-hour rule: at 18:00+ with no bedtime logged, predicts bedtime next instead of nap start; wake window is a union of a historic hour-band and a duration-band (bedtime + typical sleep length); intense-day flag applies an earlier bedtime modifier; no-nap bedtime shift when no nap is logged by the threshold hour |
| Intense-day flag | Checkbox in the manual-entry dialog marks a day as intense; badge shown in History; forecaster applies an earlier bedtime modifier for flagged days |
| Nap probability | Today screen card shows a "% chance of nap today" score derived from stage-specific nap frequency, elapsed wake time, consecutive no-nap streak, and whether the nap window has already passed |
| TIF algorithm | Opt-in Trimmed Intersection Forecast — trims outlier days, computes multi-source windows per event type (including ratio-based windows: activity/sleep → nap-start, activity/nap → nap-end), intersects them, narrows to a precision-target width; central time is the average of per-window medians; precision score badge on each card |
| TIF rolling variant | Optional `tifRollingDays` sub-window within TIF; days with explicit MA/AA values take precedence over derived timestamp differences |
| TIF no-nap substitution | On days with no nap logged by the threshold hour, TIF substitutes historical no-nap-day patterns for bedtime and next-day predictions |
| Hero card | Cycle-aware "Next Predicted Event" card — shows the single most relevant upcoming event, updated on every log action; shows precision badge when TIF is active |
| Uncertainty-honest cards | Classic: tight band (≤ max_delta) shows `central (min – max)`; wide band (> max_delta) collapses to a compact line with chevron — tap to expand to the full probability table. TIF low-confidence (empty intersection): collapsed single line — tap to expand source windows and precision detail |
| Cold-start gate | When history is below `min_days`, shows an explicit "N more days needed" message instead of fabricating predictions |

### History

| Feature | Description |
|---------|-------------|
| History screen | Scrollable day-column table (Date, Wake, Nap Start, Nap End, Bedtime); most-recent first |
| Edit-mode toggle | Edit/delete/rejected controls are hidden by default; "Edit history" button reveals them; state resets automatically on tab navigation |
| Edit & delete | Per-event `[Edit]` opens the pre-populated modal; per-row `[Delete]` confirms before removing; forecasts recompute immediately |
| Reject outliers | Marks a day as rejected; forecast downweights it at 0.5× without erasing the data |

### Data Management

| Feature | Description |
|---------|-------------|
| Import / Export | Export full dataset as JSON; import JSON (lossless round-trip) or CSV (Polish `sen.xlsx` column schema) |
| Life stages | Named date-range stages (e.g. "Dropped second nap"); scope forecasts to the active stage only |
| File-as-truth | Exported JSON is the canonical dataset; `localStorage` is a rebuildable cache |

### Visualizations

| Feature | Description |
|---------|-------------|
| Charts | Sleep-length line chart, time-band scatter plot (Wake & Bedtime Bands — 4 event series, Y-axis inverted so earlier times are at bottom, post-midnight dedup), nap-pattern indicator, activity-vs-sleep correlation chart |
| Calendar heatmap | Sleep length by calendar day |
| Accuracy dashboard | Three-metric scoring (within max_delta, within max_delta/2, actual inside predicted band) across all four event types; when TIF is active, a second TIF-specific grid shows per-event-type window hit rate, average window width in minutes, and percentage of days with confidence score ≥ 80% |
| Metrics screen | Dedicated 5th-tab table with 16 columns per logged day: raw times (Wake, Nap Start, Nap End, Bedtime), duration metrics (Sleep, Nap, Combined, Day Length), activity intervals (→Nap, Nap→), ratio scores (AAS, Day/Sleep Factor), Nap Fraction, AM/PM Split; when TIF is active, TIF window bounds and confidence score per event are shown inline, plus min/median/max TIF aggregate rows; stage-scoped filter toggle |

### Platform

| Feature | Description |
|---------|-------------|
| Installable PWA | Web App Manifest + cache-first service worker; installable on Android and desktop |
| Offline-first | Full functionality without network after first load; works from `file://` |
| Reactive updates | All predictions recompute synchronously on every log, edit, delete, reject, or settings change |

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 18 | Dev server and unit tests only — not bundled into the app |
| npm | ≥ 9 | For `devDependencies` (Playwright); no runtime packages |
| Modern browser | Current evergreen | Chrome, Edge, Firefox, or Safari |

> **Runtime note:** The deployed app has zero runtime dependencies. Node.js is only needed to run the local dev server and test suite.

---

## Getting Started

### 1. Clone and serve

```bash
git clone https://github.com/BielinskiLukasz/night-watch.git
cd night-watch
npm run serve          # starts http://localhost:8081
```

Open <http://localhost:8081>. No build step. No `npm install` required to run the app.

### 2. Install dev dependencies (for testing)

Playwright is the only dev dependency. Skip this step if you only want to run the app.

```bash
npm install                # installs @playwright/test
npx playwright install     # downloads browser binaries
```

---

## Usage

### Quick start

1. Open the app and go to **Settings** to set the subject name and day-cutover hour (default 04:00).
2. Log events using the four quick-log buttons on the **Today** screen. Each tap records the current time to the nearest 5 minutes.
3. After at least `min_days` of history (default: 7), the forecast cards populate with predicted times and confidence bands.
4. Use **"+ Add event"** above the forecast cards to back-fill or add events manually.

### Importing existing data

| Format | Source | Notes |
|--------|--------|-------|
| JSON | Previous Nightwatch export | Lossless round-trip; fully restores all state |
| CSV | Spreadsheet export | Must match the Polish `sen.xlsx` column schema (`Data`, `Pobudka`, `Zaśnięcie`, `Drzemka start`, `Drzemka stop`, …) |

Go to **Settings → Import / Export → Import** and select your file.

### Exporting data

Go to **Settings → Import / Export → Export**. The downloaded JSON file is the canonical dataset — treat it as your primary backup. `localStorage` is a cache that can be fully rebuilt from this file.

---

## Configuration

All settings are available in the **Settings** panel. Changes take effect immediately and recompute all forecasts.

| Setting | Default | Description |
|---------|---------|-------------|
| Subject name | — | Display name shown in the app header |
| Day-cutover hour | 04:00 | Hour that marks the boundary between sleep-days (not calendar midnight) |
| Time format | 24h | Toggle between 24-hour and 12-hour display |
| Max delta | 60 min | Threshold above which a forecast card switches from a point estimate to a probability table |
| Min days | 7 | Minimum valid history days required before forecasts are shown |
| Rolling window | 14 days | Number of recent days used for forecast calculations |
| Stat blend | Median | How central tendency is calculated (median / mean / blend) |
| Auto-outlier | Off | Automatically flag days that deviate beyond a statistical threshold |
| Confirm before logging | Off | When ON, quick-log buttons open the pre-filled manual-entry dialog instead of logging instantly |
| Forecast algorithm | Classic | Algorithm used for predictions: Classic (rolling-window percentile) or TIF (Trimmed Intersection Forecast) |
| TIF trim % | 10 | Percentage of outlier days trimmed symmetrically before computing TIF intersection windows (0–40); only shown when TIF is selected |
| TIF precision target | 60 min | Maximum displayed window width in minutes; intersections wider than this are narrowed, centered on the midpoint; only shown when TIF is selected |
| TIF rolling days | — | Number of most-recent days used for the TIF rolling sub-window variant; when set, each TIF window also computes a rolling variant and prefers MA/AA values over derived durations; only shown when TIF is selected |

### Life stages

Define named date ranges in **Settings → Life Stages** (e.g. "Dropped second nap" from a given date). When a stage is active, the forecast engine scopes its rolling window to that stage's data only — keeping predictions relevant after a routine change.

---

## Development

### Running tests

```bash
npm test               # full suite: node --test + Playwright (~30 s)
npm run test:unit      # unit + integration only, no browser (~5 s)
npm run test:e2e       # Playwright E2E against http://localhost:8081
```

Run a single file:

```bash
node --test tests/unit/forecast.test.js
npx playwright test tests/e2e/history.spec.js
```

`node --test` auto-discovers `tests/**/*.test.js`. The Playwright `webServer` block in `playwright.config.js` starts the dev server automatically — no separate `npm run serve` is needed for E2E runs.

### Project layout

```
js/
  app.js              # Composition root — the only place adapters are selected and injected
  lib/                # Pure functions (no DOM, no side effects): forecast, forecast-tif, metrics,
                      #   day-bucket, stages, csv-parse, accuracy, time, …
  store/              # Stateful stores with pub/sub: event-log.js, settings.js
  adapters/           # Injectable seams: storage-local/memory, clock-system/fixed
  ui/                 # DOM rendering: today-screen, history-screen, charts-screen,
                      #   accuracy-screen, metrics-screen, header, manual-entry, dom helpers
tests/
  unit/               # node:test — pure lib/ modules
  integration/        # node:test — stores wired to memory adapter + fixed clock
  e2e/                # Playwright specs against the running app
scripts/
  serve.js            # Zero-dependency static dev server
```

### Architecture notes

**Adapter injection** — `js/app.js` injects clock and storage adapters into every module. No module in `lib/` or `store/` calls `new Date()` or `localStorage` directly. Tests substitute `storage-memory.js` + `clock-fixed.js`, enabling full logic coverage without a browser.

**XSS guard** — all dynamic DOM updates go through helpers in `js/ui/dom.js` (`textContent` / `replaceChildren()`). `innerHTML` with user-controlled data is not used anywhere in `js/`.

**Day boundary** — `js/lib/day-bucket.js` groups events into sleep-days using the configurable cutover hour. Any code that reasons about "a day's events" must route through this module.

**Service worker** — `sw.js` maintains a frozen `PRECACHE_LIST` and cache key `nightwatch-v1`. Adding new app-shell files requires updating both; `tests/unit/sw-precache.test.js` enforces the list is exhaustive.

**Schema migration** — `js/lib/db-shape.js` validates the data shape and runs V1→V2 migration on import. Any data-model change must bump the schema version here.

**Dual forecast algorithms** — `forecast.js` is the always-on classic engine (P10/P50/P90 rolling-window percentile). `forecast-tif.js` is the opt-in TIF algorithm (toggled in Settings); it imports shared helpers from `forecast.js` and produces the same prediction shape, so `today-screen.js` swaps between them transparently.

**Stages filter** — `js/lib/stages.js` provides `filterDayRecordsByStage()`. When a life stage is active, all screens that aggregate history (Metrics, Accuracy) pass their day records through this filter before computing results. `activeStageId === null` means "all data".

---

## Browser Support

The app targets current evergreen browsers using only baseline platform APIs (`localStorage`, `<dialog>`, `FileReader`, `URL.createObjectURL`, `Canvas`).

| Browser | Desktop | Mobile |
|---------|:-------:|:------:|
| Chrome  | ✅ | ✅ |
| Edge    | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| Safari  | ✅ | ✅ |

---

## Roadmap

| Milestone | Phase | Description | Status |
|-----------|------:|-------------|--------|
| v1.0 | 1 | Log & Persist | ✅ Complete |
| v1.0 | 2 | Configuration & Settings | ✅ Complete |
| v1.0 | 3 | Forecast Engine & Today Screen | ✅ Complete |
| v1.0 | 4 | History Screen & Edit/Delete | ✅ Complete |
| v1.0 | 5 | Data Import/Export | ✅ Complete |
| v1.0 | 6 | Life Stages | ✅ Complete |
| v1.0 | 7 | Charts, Heatmap & Accuracy | ✅ Complete |
| v1.0 | 8 | PWA & Platform Hardening | ✅ Complete |
| v1.1 | 9 | UX Polish | ✅ Complete |
| v1.2 | 10 | TIF Algorithm & Settings | ✅ Complete |
| v1.2 | 11 | Metrics Screen | ✅ Complete |
| v1.3 | 12 | Prediction Logic Refinements | ✅ Complete |
| v1.3 | 13 | TIF Algorithm Extensions | ✅ Complete |
| v1.3 | 14 | TIF Metrics, Accuracy & Chart Fixes | ✅ Complete |

Full phase details and backlog in [`.planning/ROADMAP.md`](.planning/ROADMAP.md).

---

## Contributing

Issues and pull requests are welcome.

Before contributing:

- Read [`CLAUDE.md`](CLAUDE.md) for codebase conventions and the adapter-injection architecture.
- All new logic in `lib/` must have unit tests in `tests/unit/`.
- All new UI flows must have at least one E2E test in `tests/e2e/`.
- The app must remain zero runtime dependencies — no packages in `dependencies`.
- Run the full suite before submitting: `npm test`.

Bug reports: <https://github.com/BielinskiLukasz/night-watch/issues>

---

## Troubleshooting

**Port 8081 is already in use**  
Another process is using port 8081. Stop it, or edit the port in `scripts/serve.js` and update `playwright.config.js` to match.

**PWA install prompt does not appear from `file://`**  
Service workers require a secure context (`https://` or `localhost`). The install prompt is only available when the app is served over HTTP/HTTPS — use `npm run serve` or deploy to GitHub Pages. The app still runs from `file://`; only the install prompt is unavailable.

**Stale content after an update**  
Open DevTools → Application → Service Workers → click **Update** or enable "Update on reload". The cache key is `nightwatch-v1`; clearing site data also resets the service worker.

**Forecast cards show "N more days needed"**  
This is the cold-start gate. Log at least `min_days` valid days (default: 7) before forecasts appear. The count excludes days marked as rejected. Lower `min_days` in Settings, or import existing data to bootstrap immediately.

**CSV import fails**  
The CSV parser expects the Polish `sen.xlsx` column schema. Verify that column headers include: `Data`, `Pobudka`, `Zaśnięcie`, `Drzemka start`, `Drzemka stop`. Extra columns are ignored; missing required columns produce an error in the import dialog.

---

## License

Released under the [MIT License](LICENSE).
