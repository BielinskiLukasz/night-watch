---
phase: 03-forecast-engine-today-screen
plan: 04
subsystem: forecast-ui
tags: [forecast-cards, reactive-ui, cold-start, probability-band, missed-prediction, e2e, css]
dependency_graph:
  requires:
    - js/lib/forecast.js         # forecast() + selectNextEvent() from Plan 03-01..03
    - js/store/event-log.js      # extended with subscribe() in this plan
    - js/store/settings.js       # subscribe() already in place from Phase 2
    - js/ui/today-screen.js      # extended with forecast rendering
    - index.html                 # extended with forecast card DOM structure
    - style.css                  # extended with prediction card CSS
  provides:
    - js/ui/today-screen.js      # mountTodayScreen with full forecast section rendering
    - js/store/event-log.js      # subscribe(fn) for reactive updates
    - tests/e2e/forecast.spec.js # 6 E2E specs covering all forecast UI behavior
  affects:
    - js/app.js                  # comment updated; wiring unchanged
tech_stack:
  added:
    - renderNextEventCard(prediction, timeFormat) — hero card renderer (D3-07 / D3-10 / D3-11)
    - renderPredictionCard(prediction, eventType, timeFormat) — single forecast card (D3-08)
    - renderColdStartMessage(minDaysRemaining) — gate message (D3-09)
    - renderForecastSection(...) — orchestrator calling forecast() and updating DOM
    - formatHHMM(hhmm, timeFormat) — bare HH:MM formatter for 24h/12h preference
    - eventLog.subscribe(fn) — reactive notification hook (D3-12, mirrors settings.subscribe)
    - .next-event-hero CSS class — prominent indigo hero card
    - .forecast-grid CSS class — 2x2 on desktop / 1x4 on mobile CSS grid
    - .prediction-card CSS class — white border card for each event type
    - .prediction-card.missed CSS variant — opacity 0.55 for D3-11 graying
    - .prediction-card.probability-band CSS variant — prob-list table layout
    - .cold-start-message CSS class — centered message when insufficient data
    - page.clock.setFixedTime Playwright clock mocking for deterministic missed-test
  patterns:
    - D3-13 derived state — forecast computed in render(), never cached separately
    - D3-12 reactive updates — eventLog.subscribe + settings.subscribe both call render()
    - T-07 XSS safety — all dynamic forecast values injected via textContent (el helper)
    - gsd:allow-ui-clock — isMissed detection in today-screen.js (2 sites) tagged correctly
decisions:
  - "eventLog.subscribe() added to event-log.js — plan assumed it existed but it did not; mirrors settings.subscribe() pattern exactly (Rule 2 auto-fix)"
  - "formatHHMM() added to today-screen.js — forecast() returns bare HH:MM strings, not full ISO timestamps; existing formatTime() expects ISO format"
  - "Double-render prevention — edit/delete/addEvent handlers no longer call render() explicitly; the eventLog subscriber fires synchronously after each mutation"
  - "forecast() called with daysBySubjectiveNight(cutoverHour) regardless of display groupingMode — forecast algorithm always uses sleep-cycle day boundary per D3-02"
  - "Test 6 (missed) uses page.clock.setFixedTime(14:00) — deterministic time control without fragile wall-clock dependency"
metrics:
  duration: 30min
  completed: 2026-06-05
  tasks: 5
  files: 6
---

# Phase 3 Plan 4: Forecast Engine Today Screen Summary

**One-liner:** Today screen renders four prediction cards (wake/bedtime/napStart/napEnd) plus a hero next-event card via `renderForecastSection()`, subscribes reactively to both eventLog and settings changes, shows cold-start message when insufficient history, and falls back to probability-band view on high uncertainty.

## Commits

| Task | Hash    | Message |
|------|---------|---------|
| 1    | b39f8e0 | feat(03-04): add forecast card DOM containers to index.html (Task 1) |
| 2    | 13a9700 | feat(03-04): add prediction card CSS — hero, grid, missed, prob-band (Task 2) |
| 3    | 83686d3 | feat(03-04): implement forecast card rendering and reactive subscriptions (Task 3) |
| 4    | 116acf7 | chore(03-04): add Phase 3 wiring comment to composition root (Task 4) |
| 5    | 16164bd | feat(03-04): add E2E forecast tests — 6 specs covering all forecast UI behavior (Task 5) |

## Test Delta

- Pre-plan: 350 total (92 forecast unit + 8 integration forecast + 250 other + 40 E2E)
- Post-plan: 356 total (350 unit+integration unchanged + 46 E2E)

| File | Before | After | Delta |
|------|--------|-------|-------|
| tests/e2e/forecast.spec.js | 0 | 6 | +6 (created) |
| All E2E specs | 40 | 46 | +6 |
| Unit + integration | 350 | 350 | 0 (no regressions) |

### New E2E test specs

| # | Test name | Coverage |
|---|-----------|----------|
| 1 | land on Today, see cold-start message when < minDays | D3-06 / D3-09 |
| 2 | after 7 valid-day events, prediction cards appear | PRED-01 / D3-08 |
| 3 | quick-log button triggers reactive forecast update without reload | D3-12 |
| 4 | probability-band view appears when band width > maxDelta | PRED-04 / D3-04 |
| 5 | next-event hero card is visible and applies cycle-aware priority | D3-10 |
| 6 | missed predictions have "missed" class and "Missed by" label | D3-11 |

## Files Modified

| File | Changes |
|------|---------|
| `index.html` | Added `#next-event-card`, `#cold-start-message`, `#forecast-cards.forecast-grid` containers to static skeleton (D3-07 layout) |
| `style.css` | +178 lines: `.next-event-hero`, `.cold-start-message`, `.forecast-grid`, `.prediction-card` (base + `.missed` + `.probability-band` variants), `.missed-label`, `.prob-list` |
| `js/ui/today-screen.js` | +346 lines: forecast rendering functions, reactive subscriptions, D3-07 DOM layout order |
| `js/store/event-log.js` | +30 lines: `subscribe()` method + `notifySubscribers()` — fires after every mutation |
| `js/app.js` | +3 lines: Phase 3 wiring comment (no functional changes) |
| `tests/e2e/forecast.spec.js` | +252 lines: 6 new E2E specs |

## CSS Classes Added

| Class | Purpose |
|-------|---------|
| `.next-event-hero` | Large indigo hero card (D3-07) |
| `.next-event-hero.missed` | Desaturated slate hero card (D3-11) |
| `.cold-start-message` | Centered message block (D3-09) |
| `.forecast-grid` | 2×2 CSS grid container (D3-08); 1×4 on mobile |
| `.prediction-card` | White border card for each of 4 event types |
| `.prediction-card.missed` | Opacity 0.55, slate text (D3-11 graying) |
| `.prediction-card.probability-band` | Layout for probability table rows (D3-04) |
| `.missed-label` | "Missed by Xmin" auxiliary label (D3-11) |
| `.prob-list` | `<ul>` holding P(event by T) = X% rows |
| `.event-label` | Card header — event type name |
| `.time-central` | Large central predicted time |
| `.time-band` | Smaller min–max band line |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] `eventLog.subscribe()` was absent**
- **Found during:** Task 3 — the plan specified `eventLog.subscribe(renderFunction)` but the store had no subscriber mechanism
- **Issue:** `event-log.js` had no subscriber set or notification mechanism, unlike `settings.js` which has `subscribe()` from Phase 2. Without it, D3-12 reactive forecast updates were impossible.
- **Fix:** Added `subscribe(fn)` method and `notifySubscribers()` helper to `createEventLog()`, following the exact same pattern as `settings.subscribe()` (synchronous fire, Set snapshot before iteration, returns unsubscribe function). Called `notifySubscribers()` after every mutation: `addEvent`, `addEventAt`, `editEvent`, `deleteEvent`.
- **Files modified:** `js/store/event-log.js`
- **Commit:** 83686d3

**2. [Rule 2 - Missing Critical Functionality] `formatHHMM()` helper needed for bare HH:MM strings**
- **Found during:** Task 3 — `forecast()` returns bare `'HH:MM'` strings for `central`, `min`, `max` fields; but `formatTime(at, timeFormat)` in `js/lib/time.js` expects a full `'YYYY-MM-DDTHH:MM'` ISO timestamp.
- **Fix:** Added `formatHHMM(hhmm, timeFormat)` helper in `today-screen.js` that handles bare HH:MM strings using `to12h()` from `time.js`. This keeps the string-slice-only DST-safe approach (Pitfall #3) without creating a Date object.
- **Files modified:** `js/ui/today-screen.js`
- **Commit:** 83686d3

**3. [Rule 1 - Double-render prevention] Edit/delete handlers called `render()` after mutations**
- **Found during:** Task 3 — the previous code in `today-screen.js` explicitly called `render()` inside the `editEvent`, `deleteEvent`, and `addEventAt` callbacks. With the new `eventLog.subscribe()` wiring, every mutation now fires `render()` synchronously via the subscriber. The explicit calls would cause double renders.
- **Fix:** Removed the explicit `render()` calls from the edit/delete/addAt callbacks, relying solely on the eventLog subscriber for re-render. Added comments explaining the D3-12 flow.
- **Files modified:** `js/ui/today-screen.js`
- **Commit:** 83686d3

## Verification Checklist

- [x] Cold-start message appears when < minDays (Test 1 passes)
- [x] Prediction cards appear when minDays threshold reached (Test 2 passes)
- [x] Four prediction cards (wake, bedtime, napStart, napEnd) structure in DOM
- [x] Next-event hero card visible above four cards (Test 5 passes)
- [x] Quick-log button triggers reactive forecast re-render without reload (Test 3 passes)
- [x] Probability-band fallback appears when band width > maxDelta (Test 4 passes)
- [x] Missed predictions are grayed out and labeled (Test 6 passes)
- [x] No page reload during reactive updates (Test 3 verifies via event-list presence)
- [x] All 6 E2E tests pass
- [x] All 350 unit+integration tests pass (no regressions)
- [x] CSS styling matches Phase 1/2 calm theme (indigo accent, slate grays, white cards)

## Known Stubs

None — all rendering paths are fully implemented. The four prediction card types (wake, bedtime, napStart, napEnd), the hero next-event card, cold-start message, probability-band table, and missed-prediction label all render real computed data.

## Threat Flags

No new trust boundaries. Forecast data flows from validated event-log + settings stores to DOM via textContent only (T-07 / V5 XSS). The two `new Date()` calls in `today-screen.js` (renderNextEventCard and renderPredictionCard for `isMissed`) are both tagged `// gsd:allow-ui-clock` — display-only metadata per D3-11.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `index.html` exists with `id="forecast-cards"` | FOUND |
| `style.css` has `.prediction-card` rules | FOUND (8 occurrences) |
| `js/ui/today-screen.js` has `renderForecastSection` | FOUND (9 occurrences) |
| `js/store/event-log.js` has `subscribe` | FOUND |
| `tests/e2e/forecast.spec.js` has 6 tests | FOUND |
| Commit b39f8e0 (Task 1 — index.html) | FOUND |
| Commit 13a9700 (Task 2 — style.css) | FOUND |
| Commit 83686d3 (Task 3 — today-screen.js + event-log.js) | FOUND |
| Commit 116acf7 (Task 4 — app.js) | FOUND |
| Commit 16164bd (Task 5 — forecast.spec.js) | FOUND |
| 6 E2E tests pass | VERIFIED |
| 350 unit+integration tests pass | VERIFIED |
| 46 total E2E tests pass (40 prior + 6 new) | VERIFIED |
