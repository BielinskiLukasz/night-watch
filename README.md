# Nightwatch

A vanilla-JS, offline-first PWA for tracking a single subject's sleep
(night sleep + naps) and forecasting their next sleep events with explicit
uncertainty handling and prediction-accuracy scoring.

**Core value:** Given enough sleep history, predict the next wake-up, bedtime,
nap start, and nap end accurately enough to be useful — and surface accuracy
transparently. When `±delta > max_delta`, fall back to a probability band over
a window instead of pinning to a single time.

## Run locally

Nightwatch ships with a 5-line zero-dependency static server:

```bash
npm run serve          # starts http://localhost:8081
```

Open <http://localhost:8081>. Click any of the four quick-log buttons
(`Woke up`, `Going to sleep`, `Nap start`, `Nap end`) to record an event at
the current time, rounded to 5 minutes. Use `+ Add event` at the bottom of
the day list to back-fill a past day. Each row exposes `[edit]` and `[×]`
affordances. Reload the page — all events persist via `localStorage` under
the key `nightwatch:db`.

## Run tests

```bash
npm test               # full suite: node --test && playwright test
npm run test:unit      # node --test (unit + integration; ~5s on a laptop)
npm run test:e2e       # playwright test (e2e specs against the dev server)
```

`node --test` auto-discovers `tests/**/*.test.js`. Playwright uses
`playwright.config.js`; its `webServer` block boots `node scripts/serve.js`
on port 8081.

## Project layout

```
js/
  app.js               # composition root — adapters wired here only
  lib/                 # pure logic (time, day-bucket, id)
  store/event-log.js   # add/edit/delete + day-grouping delegation
  adapters/            # storage-local/memory, clock-system/fixed
  ui/                  # today-screen, manual-entry, dom helpers
tests/
  unit/                # node:test, pure-logic
  integration/         # node:test, store + memory adapter + fixed clock
  e2e/                 # Playwright specs against the running app
scripts/serve.js       # zero-dep static dev server
.github/workflows/ci.yml
```

## Architectural invariants

The integration smokes in `tests/integration/security-smoke.test.js` lock
these in. See `.planning/phases/NW-01-log-persist/01-SKELETON.md` for the
full rationale.

- **Zero runtime dependencies.** `package.json` `dependencies` is literal
  `{}` (T-08, D-20). CI fails fast on any addition.
- **No network in `js/`.** No `fetch(`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, dynamic `import()`, or external `<script src>` (T-04).
- **Clock seam.** `new Date()` lives only in `js/adapters/clock-*.js`. Other
  files inject a `ClockAdapter`. One UI default-prefill exemption is tagged
  `// gsd:allow-ui-clock` in `js/ui/manual-entry.js` (D-07).
- **Storage seam.** `localStorage` is touched only in
  `js/adapters/storage-local.js`. The composition root injects the adapter
  everywhere else (D-07).
- **No `.innerHTML = ...` with user data.** All dynamic DOM updates go
  through `textContent` / `replaceChildren()` via `js/ui/dom.js` (T-07).

## Commit message convention

```
<type>(NW-<phase>-<plan>): <REQ-IDs> short description per D-<XX>
```

`<type>`: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `style`, `chore`,
`ci`. `<REQ-IDs>` reference the stable identifiers in
`.planning/REQUIREMENTS.md`:

| Prefix | Domain                                              |
| ------ | --------------------------------------------------- |
| LOG    | Logging (quick-log buttons, manual entry, delete)   |
| CFG    | Configuration / Settings                            |
| PRED   | Forecast / prediction                               |
| UI     | Screens (Today, History, Charts, Accuracy)          |
| DATA   | Data lifecycle (export, import, persistence)        |
| STAGE  | Stage segmentation                                  |
| PLAT   | Platform (no-deps, PWA, testing scaffold, CI)       |

Example: `feat(NW-01-01-04): LOG-05,LOG-06 manual entry modal per D-13,D-14`.

## Phase 1 status (Log & Persist)

- `.planning/phases/NW-01-log-persist/01-01-SUMMARY.md` — Walking skeleton
- `.planning/phases/NW-01-log-persist/01-02-SUMMARY.md` — Pure-logic TDD
- `.planning/phases/NW-01-log-persist/01-03-SUMMARY.md` — Four quick-log buttons
- `.planning/phases/NW-01-log-persist/01-04-SUMMARY.md` — Manual entry + edit + delete
- `.planning/phases/NW-01-log-persist/01-05-SUMMARY.md` — Hardening (persistence + security smoke + CI + README)

## Forecast Algorithm

Phase 3 delivers the core value: predicting the next sleep events from logged history
with explicit uncertainty bounds. The algorithm lives in `js/lib/forecast.js` and is
a pure function — no side effects, no DOM, no storage.

### Overview

```
forecast(days, settings) → { wake, bedtime, napStart, napEnd }
```

**Input:**
- `days` — array of day records from `eventLog.daysBySubjectiveNight(cutoverHour, windowDays)`
  (each record has `wake`, `bedtime`, `napStart`, `napEnd` time strings in `HH:MM` format)
- `settings` — from `settings.get()`: `minDays`, `maxDelta`, `windowDays`, `statBlend`

**Output:** predictions for four event types. Each prediction is one of:
- `{ central, min, max }` — central predicted time with min/max band (tight uncertainty)
- `{ central, min, max, probabilityBand: [{time, prob}] }` — same, plus CDF table (wide uncertainty)
- `null` — no data for this event type in the window

### Step-by-Step Algorithm

1. **Cold-start gate** — Count valid (non-rejected) days. If fewer than `minDays`, suppress all
   predictions and show "Not enough data yet. Log N more days to see predictions." The countdown
   N updates reactively as events are logged.

2. **Extract events** — For each event type (wake, bedtime, napStart, napEnd), collect the time
   strings from the rolling window of `windowDays` days. If fewer days exist than `windowDays`,
   use all available days (no padding or synthetic data).

3. **Convert to minutes** — Convert `HH:MM` strings to minutes-since-midnight for numeric sort:
   `'06:30'` → 390. This avoids DST hazards and string-sort ordering bugs.

4. **Sort ascending** — Sort the minutes array numerically.

5. **Apply downweighting** — Rejected days count at 0.5× weight in the percentile position
   calculation. Effective sample size = `sum(rejected ? 0.5 : 1.0)` over all days.

6. **Calculate percentiles** — Using linear interpolation (Excel / R type 7):
   - P10 → `min` band
   - P50 → `central` prediction (median)
   - P90 → `max` band
   - Position formula: `pos = p × (effectiveCount + 1)`, with 0-based array index `k = floor(pos - 1)`.
   - Linear interpolation: `times[k] + frac × (times[k+1] - times[k])`.

7. **Check confidence** — Band width = P90 − P10 (in minutes). If band width > `maxDelta` (default
   30 min), switch to probability-band fallback (see below).

8. **Convert back to HH:MM** — Round to nearest 5-minute interval, format as `HH:MM`.

### Configuration Tuning

| Setting | Default | Effect |
|---------|---------|--------|
| `minDays` | 7 | Days of history required before forecasts appear |
| `maxDelta` | 30 min | Band-width threshold; exceeding it triggers probability-band fallback |
| `windowDays` | 7 | Rolling window length for percentile calculation |
| `statBlend` | `'median'` | Locked to P50 in Phase 3; Phase 7 will add mean/blend option |
| `autoOutlier` | `false` | Stored but inert in Phase 3; only manually-rejected days are downweighted |

Configure in-app via the Settings gear icon. Changes are applied immediately and forecasts
re-compute reactively.

### Uncertainty Modeling

**Tight uncertainty (band width ≤ maxDelta):**

The card shows: central time, min band, max band.
Example: "Wake: 06:45 (06:30 – 07:00)".

**Wide uncertainty (band width > maxDelta):**

The card switches to a cumulative probability table derived from the empirical CDF:

```
P(wake by 06:30) = 14%
P(wake by 06:45) = 43%
P(wake by 07:00) = 71%
P(wake by 07:15) = 86%
```

This surfaces uncertainty honestly rather than claiming false precision. The probability at
time T is `count(times ≤ T) / total_count`. Time points are 5-minute-aligned and cover the
full P10–P90 range.

### Reactive Updates

Predictions re-compute synchronously whenever:
- The user taps a quick-log button (new event logged)
- The user saves the manual-entry form (event added or edited)
- The user changes a setting (e.g., adjusts `maxDelta`)

The Today screen subscribes to both `eventLog.subscribe()` and `settings.subscribe()`. Each
subscriber callback: `days = eventLog.daysBySubjectiveNight(cutoverHour); predictions = forecast(days, settings.get()); renderForecastSection(predictions)`.

No debounce or caching in Phase 3 — compute-on-demand is fast enough for the 7–365 day window.

### Next-Event Selection (Cycle-Aware Priority)

The hero "next event" card uses sleep-cycle awareness to pick the most imminent and intuitive
prediction. Priority depends on the most recently logged event type:

| Last logged | Priority order |
|-------------|----------------|
| `bedtime` | wake → nap start → nap end → bedtime |
| `wake` | nap start → bedtime → nap end → wake |
| `napStart` | nap end → bedtime → wake → nap start |
| `napEnd` | bedtime → wake → nap start → nap end |

The first available prediction in the priority list is shown in the hero card. This matches the
natural rhythm of a child's day (wake → nap → bedtime → wake) and is more intuitive than
"whichever event is soonest by raw time."

### Missed Predictions

If a forecasted central time has passed (e.g., predicted wake at 07:00 but it is now 08:15),
the card is grayed out and labeled "Missed by 75min". Missed cards stay visible for accuracy
reflection — Phase 7's accuracy dashboard will expand on this theme.

### References

- Forecast algorithm research: `.planning/phases/NW-03-forecast-engine-today-screen/03-RESEARCH.md`
- Phase 3 decisions (D3-01..D3-16): `.planning/phases/NW-03-forecast-engine-today-screen/03-CONTEXT.md`
- Implementation: `js/lib/forecast.js` (pure logic), `js/ui/today-screen.js` (rendering + subscriptions)

## Roadmap

See `.planning/ROADMAP.md` for the eight-phase plan from logging through
PWA hardening. Phase 8 lands the manifest + service worker + GitHub Pages
deploy.
