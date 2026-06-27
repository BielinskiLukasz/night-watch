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

## Phase 4: History Screen & Edit/Delete

Phase 4 adds the full History workflow — a day-column table with interactive
edit, delete, and rejected-flag controls — and completes the two-tab navigation
structure (Today | History) that Phase 7 will expand.

### Features Implemented

- **History Screen:** Day-column table showing all past sleep events (Date,
  Wake, Nap Start, Nap End, Bedtime, Rejected checkbox, Actions). One row per
  calendar day; most-recent day first (D4-02).
- **Tab Navigation (Today | History):** Two-button header navigation; switching
  tabs toggles screen visibility. Active tab highlighted with indigo underline
  and `aria-selected="true"` (D4-07).
- **Edit Events:** Each time cell contains an `[Edit]` button. Clicking opens
  the Phase 1 manual-entry modal pre-populated with the existing event's
  type/date/time. Saving calls `editEvent()` and triggers a synchronous
  forecast re-compute (D4-04, D4-09).
- **Delete Days:** Each row has a `[Delete]` button. Confirms with
  `window.confirm()` before removing all events for that calendar date via
  `deleteEvent()`. Forecast updates immediately (D4-06).
- **Reject Outliers:** Each row has an `<input type="checkbox">` in the
  Rejected column. Toggling immediately calls
  `settings.update({ rejectedDays: [...] })`. Rejected rows rendered at
  ~50% opacity; forecast downweights them at 0.5× (D4-05, D4-10, D4-14).
- **Reactive Updates:** All mutations (edit, delete, reject) trigger immediate
  forecast re-computation via the D3-12 subscriber pattern. History table
  re-renders without a page reload.

### Design Decisions

- **Rejected-Day Storage (D4-05):** Rejected days stored as a list of date
  strings in `settings.rejectedDays` (not per-event). Leverages the existing
  settings-store subscription pattern. Day-bucket computes `day.rejected`
  boolean at render time.
- **Delete Scope (D4-06):** Deleting a day removes all events for that calendar
  date (wake, bedtime, nap, extra naps). Matches the `daysByCalendar()` grouping
  logic. Native browser undo (`Ctrl+Z`) can restore deleted events before next
  write.
- **Tab Persistence (D4-08):** Tab state is in-memory only; does not persist
  across reload. Phase 8 (PWA hardening) can add deep-linking.
- **Edit Validation (D4-13):** Reuses Phase 1's manual-entry contract (5-min
  rounding, future-date guard). No custom validation in history-screen.js.
- **Forecast Timing (D4-09):** Forecast re-computes only on Save (not during
  edit), ensuring a clean and predictable user experience.
- **XSS Prevention (T-04-04):** All dynamic values (dates, times, event IDs)
  are written via `textContent` / DOM properties. No `innerHTML =` assignments
  exist in `js/ui/history-screen.js`.

### Testing Coverage

- **Unit Tests:** `tests/unit/db-shape.test.js` — `rejectedDays` schema;
  `tests/unit/day-bucket.test.js` — rejection boolean derivation.
- **Integration Tests:** `tests/integration/rejected-days-forecast-sync.test.js`
  — subscriber synchrony + forecast shift; `tests/integration/edit-delete-flow.test.js`
  — mutation + forecast re-compute + P50 shift.
- **E2E Tests:** `tests/e2e/history.spec.js` — tab navigation, table rendering,
  edit workflow, delete confirmation, rejected checkbox toggle, forecast reactivity,
  persistence across tab switch and page reload (23 tests total).

### Known Constraints & Future Work

- **Scroll Position:** Table scrolls to top on every render (no scroll-position
  restoration). Phase 8+ can cache position.
- **Bulk Edit:** Phase 4 edits events one-at-a-time. Phase 7+ could add
  day-wide bulk edit.
- **Rejection Metadata:** Rejected days show no reason (manual vs. auto). Phase
  7's accuracy dashboard can add rejection history.
- **Multi-Nap Display:** Primary nap slot only in table. Extra naps are editable
  individually but not shown as separate columns.

### Code Structure

| File | Role |
|------|------|
| `js/ui/history-screen.js` | History table component: renders day-column table, wires edit/delete/reject affordances |
| `js/ui/header.js` | Extended with two-tab navigation (Today \| History) |
| `js/app.js` | Composition root; mounts history screen and applies tab visibility |
| `js/lib/db-shape.js` | Extended: `rejectedDays: []` in DEFAULT_SETTINGS; migration backfill |
| `js/lib/day-bucket.js` | Extended: `annotateRejected()` helper; both public functions accept optional settings |
| `js/lib/settings-validate.js` | Extended: `string[]` RULES type for rejectedDays |
| `js/store/event-log.js` | Extended: optional settings param on `daysByCalendar` |
| `tests/e2e/history.spec.js` | New: full History workflow E2E coverage |
| `tests/integration/edit-delete-flow.test.js` | New: mutation + forecast sync integration tests |
| `tests/integration/rejected-days-forecast-sync.test.js` | New: subscriber + downweighting integration tests |

### Requirements Traceability

| Requirement | Description | Status |
|-------------|-------------|--------|
| UI-03 | History screen with scrollable table, edit, delete, rejected toggle | Complete |
| CFG-05 | User can manually mark any day as rejected; toggle persists | Complete |
| PRED-07 | Forecasts update when user toggles rejected flag | Complete (Phase 3 + Phase 4 surfacing) |

### Phase 4 Verification Checklist

- [x] Day-column table renders with correct columns
- [x] Table displays most recent days first
- [x] Tab navigation Today \| History works
- [x] `[Edit]` opens modal with pre-populated event; save updates table and forecast
- [x] `[Delete]` confirms and removes day from table; forecast updates
- [x] Rejected checkbox toggles immediately; rejected rows styled at 50% opacity
- [x] Rejected toggle triggers forecast downweighting (0.5×)
- [x] Rejected state persists across tab switch and reload
- [x] Empty state message shows when no events logged
- [x] E2E tests pass for all workflows
- [x] Security audit: no XSS, data-flow integrity verified, state consistency verified
- [x] All Phase 4 requirements (UI-03, CFG-05) covered by tests

---

## Roadmap

See `.planning/ROADMAP.md` for the eight-phase plan from logging through
PWA hardening. Phase 8 lands the manifest + service worker + GitHub Pages
deploy.
