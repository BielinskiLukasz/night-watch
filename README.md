# Nightwatch

![Status](https://img.shields.io/badge/status-active_development-brightgreen)
![Version](https://img.shields.io/badge/version-0.6.0-blue)
![HTML5](https://img.shields.io/badge/HTML-5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS-3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ECMAScript-2022-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow)

An offline-first sleep tracker for one subject: log night sleep and naps, then let the app predict the next wake-up, bedtime, nap start, and nap end — with explicit uncertainty handling.  
No backend. No dependencies. No installation.

> **Actively developed** — 6 of 8 phases complete. GitHub Pages deploy coming in Phase 8.

---

## Features

- **Four quick-log buttons** — Woke up, Going to sleep, Nap start, Nap end; each records the current time rounded to the nearest 5 minutes
- **Manual entry & editing** — native `<dialog>` modal for back-filling past events or correcting any record; future-date guard prevents accidental errors
- **Forecast engine** — predicts the next four sleep events (wake, bedtime, nap start, nap end) from a configurable rolling window of history using P10/P50/P90 percentiles
- **Hero "next event" card** — a cycle-aware priority card shows the single most relevant upcoming event, updated immediately on every log action
- **Uncertainty-honest cards** — tight band (≤ max_delta): shows `central (min – max)`; wide band (> max_delta): switches to a probability table (`P(wake by 07:00) = 71%`)
- **Cold-start gate** — when history is below `min_days`, displays an explicit "N more days needed" message instead of fabricating predictions
- **History screen** — scrollable day-column table (Date, Wake, Nap Start, Nap End, Bedtime, Rejected, Actions); most-recent first
- **Edit & delete events** — per-event `[Edit]` opens the pre-populated modal; per-row `[Delete]` confirms before removing; forecasts recompute immediately
- **Reject outliers** — checkbox per row marks a day as rejected; forecast downweights it at 0.5× without erasing the data
- **Settings panel** — subject name, max_delta, min_days, rolling window, day-cutover hour (default 04:00), 12h/24h toggle, auto-outlier toggle
- **Data import/export** — export full dataset as JSON; import JSON (lossless round-trip) or CSV (translated from the original Polish `sen.xlsx` schema)
- **Life stages** — define named date-range stages (e.g., "Dropped second nap"); scope forecasts to the active stage only
- **Reactive updates** — all predictions recompute synchronously on every log, edit, delete, reject, or settings change

---

## Run locally

Nightwatch ships with a zero-dependency static server:

```bash
git clone https://github.com/BielinskiLukasz/nightwatch.git
cd nightwatch
npm run serve          # starts http://localhost:8081
```

Open <http://localhost:8081>. No build step. No `npm install` of runtime packages.

---

## Run tests

```bash
npm test               # full suite: node --test + playwright test
npm run test:unit      # node --test only (unit + integration, ~5 s)
npm run test:e2e       # playwright test only (against the dev server)
```

`node --test` auto-discovers `tests/**/*.test.js`. Playwright uses `playwright.config.js`; its `webServer` block boots the dev server on port 8081.

---

## Project layout

```
js/
  app.js               # composition root — adapters wired here only
  lib/                 # pure logic (time, day-bucket, forecast, stages, id)
  store/               # event-log.js, settings.js
  adapters/            # storage-local/memory, clock-system/fixed
  ui/                  # today-screen, history-screen, header, manual-entry, dom helpers
tests/
  unit/                # node:test, pure-logic modules
  integration/         # node:test, store + memory adapter + fixed clock
  e2e/                 # Playwright specs against the running app
scripts/serve.js       # zero-dep static dev server
.github/workflows/ci.yml
```

---

## Design decisions

- **Zero runtime dependencies** — every feature uses a browser-native API: `localStorage`, `<dialog>`, `FileReader`, `URL.createObjectURL` (download). No framework, no CDN, no network required at runtime.
- **Adapter seams for testability** — `new Date()` lives only in `js/adapters/clock-*.js`; `localStorage` is touched only in `js/adapters/storage-local.js`. The composition root injects both adapters everywhere else, making all logic unit-testable without a browser.
- **XSS prevention** — all dynamic DOM updates go through `textContent` / `replaceChildren()` via `js/ui/dom.js`. No `innerHTML =` with user-controlled data anywhere in `js/`.
- **No runtime dependencies enforced by CI** — `package.json` `dependencies` is literal `{}`. A separate CI step checks this before running any tests.
- **Uncertainty over false precision** — when the P90–P10 band width exceeds `max_delta`, the forecast card switches to a cumulative probability table rather than printing a number the data does not support.
- **File-as-truth** — exported JSON is the canonical dataset; `localStorage` is a rebuildable cache. Importing a JSON export fully restores all state.
- **PWA hardening deferred to Phase 8** — the service worker is intentionally absent during Phases 1–7 so the data model can flex without cache-invalidation churn.

---

## Browser compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅      | ✅     |
| Edge    | ✅      | ✅     |
| Firefox | ✅      | ✅     |
| Safari  | ✅      | ✅     |

---

## What's next

- **Phase 7 — Charts, Heatmap & Accuracy**: sleep-length line chart, time-band scatter plot, calendar heatmap, nap-pattern indicator, activity correlation, three-metric accuracy dashboard, full four-tab navigation
- **Phase 8 — PWA & Platform Hardening**: service worker, offline support, `file://` loading, manifest, GitHub Pages deploy, calm visual theme

---

## Roadmap progress

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Log & Persist | ✅ Complete |
| 2 | Configuration & Settings | ✅ Complete |
| 3 | Forecast Engine & Today Screen | ✅ Complete |
| 4 | History Screen & Edit/Delete | ✅ Complete |
| 5 | Data Import/Export | ✅ Complete |
| 6 | Life Stages | ✅ Complete |
| 7 | Charts, Heatmap & Accuracy | ⬜ Not started |
| 8 | PWA & Platform Hardening | ⬜ Not started |

Full phase details in `.planning/ROADMAP.md`.

---

## License

Released under the [MIT License](LICENSE).
