---
phase: NW-12-prediction-logic-refinements
verified: 2026-08-25T22:00:00Z
status: human_needed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open event-entry modal, check 'Intense day', save an event, then open history; confirm the indigo badge appears on that day's row and the badge click removes the flag from the list"
    expected: "Checkbox pre-populates from settings.intenseDays; save updates intenseDays; badge renders in history with a working remove button"
    why_human: "manual-entry.js and history-screen.js are DOM-only modules; their interaction with settings.get()/update() is browser-only and no unit test covers the full checkbox → save → badge round-trip"
  - test: "With enough history, open the Today screen during normal daytime hours and verify the nap-start prediction card displays '% chance of nap today' text (non-null score visible)"
    expected: "A line such as '72% chance of nap today' appears below the nap-start prediction band"
    why_human: "napProbabilityScore computation is unit-tested but the DOM rendering path (renderPredictionCard + renderNextEventCard) requires a live browser to confirm textContent placement and CSS class application"
---

# Phase NW-12: Prediction Logic Refinements — Verification Report

**Phase Goal:** The classic forecaster uses contextual rules (time-of-day, missed nap, intense-day flag, sleep-duration band) to produce situationally accurate predictions, and the Today screen displays prediction cards in the correct order with a nap probability score.

**Verified:** 2026-08-25T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | At 18:00 or later, when the last logged event is a wake, the Today screen predicts bedtime as the next event rather than nap start (PRED-08) | VERIFIED | `forecast.js:768-773` — `selectNextEvent` reads `eveningHour` from settings, checks `nowHour >= eveningHour && lastEvent.type === 'wake'`, returns `buildResult(predictions, ['bedtime','napEnd','napStart','wake'])`. `today-screen.js:520` passes `settingsSnap` as third arg. Unit tests in `forecast.test.js` verify with `eveningHour=0` (always fires) and `eveningHour=25` (never fires). All 696 unit tests pass. |
| 2 | The wake-up prediction window is the outer union of a historic hour-band (P10/P90 of wake hours) and a duration-band (lastBedtime + P10/P90 of rolling night sleep durations) (PRED-09) | VERIFIED | `forecast.js:349-381` — `computeDurationBand()` computes duration-band with midnight-crossover normalization (`% 1440`). `forecast.js:567-599` — `wakePred` IIFE applies `Math.min(hourBand.min, durBand.min)` / `Math.max(hourBand.max, durBand.max)` union; central stays P50 of wake hours (D-11). 7 unit tests in `describe('PRED-09 wake duration-band union')` cover min/max widening, fallback, midnight crossover, D-12 isolation. |
| 3 | User can mark a day as "Intense day" via a checkbox in the event-entry form; the flag is stored per day in history; the forecaster applies an earlier bedtime modifier when the flag is set (PRED-10) | VERIFIED (code+wiring); browser interaction needs human | `index.html:172` — `<input type="checkbox" id="intenseDay" name="intenseDay">` in `#manualEntry`. `manual-entry.js` saves/removes date from `settings.intenseDays`. `day-bucket.js:287` — `annotateIntense()` injects `.intense: boolean` on day records; chained in both `daysByCalendar` and `daysBySubjectiveNight` (lines 317, 340). `forecast.js:632-651` — PRED-10 `subWindowBedtime` fires when `isIntenseToday`. `today-screen.js:904` — `forecastContext.isIntenseToday = todayDayRecord.intense === true`. Unit tests in `describe('PRED-10 intense-day bedtime modifier')` pass. Full browser UI flow listed under Human Verification. |
| 4 | When no nap-start has been logged by the configured threshold hour, the bedtime prediction shifts earlier to reflect likely earlier tiredness on a no-nap day (PRED-11) | VERIFIED | `forecast.js:604-628` — `noNapFired = !napStartLogged && currentHour >= eveningHour`; fires `subWindowBedtime` with `noNapBedtimeOffsetMinutes` offset. `today-screen.js:901-905` — `napStartLogged = todayNapStart != null`, `currentHour = new Date().getHours()`, passed to `forecast()` as `forecastContext`. Unit tests in `describe('PRED-11 no-nap bedtime shift')` verify 6 cases including precedence over PRED-10. |
| 5 | The nap prediction card shows a "% chance of nap today" score derived from nap frequency, elapsed wake time, consecutive no-nap streak, and whether the nap window has already passed (PRED-12) | VERIFIED (code+wiring); visual display needs human | `forecast.js:841-911` — `napProbability()` exported with 4 weighted signals (40/30/20/10). `today-screen.js:916-936` — score computed and attached to `predictions.napStart.napProbabilityScore`. `today-screen.js:167-171` and `285-289` — `renderNextEventCard` and `renderPredictionCard` both render `<p class="nap-probability">` with textContent. 11 unit tests in `describe('PRED-12')` pass. Visual display listed under Human Verification. |
| 6 | Prediction cards on the Today screen appear in the order wake → nap start → nap end → bedtime (UI-07) | VERIFIED | `today-screen.js:530` — `const EVENT_TYPES = ['wake', 'napStart', 'napEnd', 'bedtime'];`. The `for` loop at line 531 renders cards in this sequence. `selectNextEvent` receives `['wake','napStart','napEnd','bedtime']` priority ordering through `buildResult`. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/lib/forecast.js` | `selectNextEvent` with `settings` param; `computeDurationBand`; `subWindowBedtime`; `bedtimePred` IIFE; `napProbability` export | VERIFIED | All 5 new components present and substantive. `selectNextEvent` at line 708; `computeDurationBand` at 349; `subWindowBedtime` at 407; `bedtimePred` IIFE at 603; `napProbability` at 841. |
| `js/lib/db-shape.js` | `DEFAULT_SETTINGS` has 20 keys (16 + 4 Phase 12 fields); Phase 12 migration block in `migrateV1ToV2` | VERIFIED | `DEFAULT_SETTINGS` lines 41-65: `eveningHour: 18`, `intenseDays: []`, `noNapBedtimeOffsetMinutes: 30`, `intenseDayOffsetMinutes: 30`. Migration block at lines 128-140. |
| `js/lib/day-bucket.js` | `annotateIntense()` function chained after `annotateRejected` in both public functions | VERIFIED | Function at line 287; chained at lines 317 and 340 in `daysByCalendar` and `daysBySubjectiveNight`. |
| `js/ui/today-screen.js` | `EVENT_TYPES = ['wake','napStart','napEnd','bedtime']`; `forecastContext` passed to `forecast()`; `napProbabilityScore` attached | VERIFIED | Line 530: array in correct order. Lines 903-908: `forecastContext` built. Line 911: passed as third arg to `forecast()`. Lines 930: `napProbabilityScore` attached. |
| `js/ui/manual-entry.js` | Intense-day checkbox pre-populated and saved | VERIFIED (wiring in source) | Pre-check on open and save-time mutation confirmed by 12-03-SUMMARY; code reads `settings.get().intenseDays` and calls `settings.update()`. |
| `js/ui/history-screen.js` | `.intenseBadge` button rendered when `day.intense === true` | VERIFIED | Lines 220-244: `tr.intense` class, badge button with `textContent = 'Intense'`, click removes date from `intenseDays`. |
| `index.html` | `eveningHour`, `noNapBedtimeOffsetMinutes` inputs in Forecast fieldset; `intenseDay` checkbox in manualEntry | VERIFIED | Lines 172, 283, 287 confirm all three elements present. |
| `style.css` | `.nap-probability` and `.intenseBadge` CSS rules | VERIFIED | Both rules present per 12-03-SUMMARY and 12-06-SUMMARY; textContent-only pattern maintained. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `settings.eveningHour` | `selectNextEvent` PRED-08 branch | Third `settings` arg in `today-screen.js:520` | WIRED | `settingsSnap` passed; `eveningHour` destructured in function body |
| `settings.intenseDays` | `day.intense` on day records | `annotateIntense(annotateRejected(records, settings), settings)` in `day-bucket.js` | WIRED | Chain confirmed at lines 317 and 340 |
| `day.intense` | `forecast()` `isIntenseToday` | `today-screen.js:904`: `todayDayRecord.intense === true` → `forecastContext` → `forecast(..., forecastContext)` | WIRED | Full chain present |
| `settings.noNapBedtimeOffsetMinutes` | `subWindowBedtime` fallback offset | `forecast.js:612`: `settings.noNapBedtimeOffsetMinutes ?? 30` | WIRED | Used in PRED-11 branch |
| `napProbability()` | `predictions.napStart.napProbabilityScore` | `today-screen.js:930`: direct property assignment before `renderForecastSection` | WIRED | Both classic and TIF paths benefit |
| `napProbabilityScore` | Rendered text in prediction card | `today-screen.js:167-171, 285-289`: textContent set in both `renderNextEventCard` and `renderPredictionCard` | WIRED | Score of 0 shows "nap window closed"; null suppresses element |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 696 unit tests pass, 0 failures | `npm run test:unit` | 696 pass, 0 fail, 0 skip | PASS |
| `DEFAULT_SETTINGS` has 20 keys | Verified in `db-shape.js:41-65` | 4 Phase 12 keys present | PASS |
| `EVENT_TYPES` order | Verified in `today-screen.js:530` | `['wake','napStart','napEnd','bedtime']` | PASS |
| All Phase 12 plan commits exist in git | `git log --oneline -20` | 12 feat/test/refactor commits from `0081e47` to `6bdd765` all present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PRED-08 | 12-01 | Evening-hour bedtime priority override in `selectNextEvent` | SATISFIED | `forecast.js:768-773`; unit tests in forecast.test.js PRED-08 group |
| PRED-09 | 12-04 | Wake prediction outer union of hour-band and duration-band | SATISFIED | `forecast.js:349-381, 567-599`; 7 unit tests in PRED-09 group |
| PRED-10 | 12-02, 12-03, 12-05 | Intense-day flag: storage, badge, forecaster modifier | SATISFIED | `day-bucket.js:287-340`, `index.html:172`, `forecast.js:632-651` |
| PRED-11 | 12-05 | No-nap-day bedtime shift when threshold hour reached | SATISFIED | `forecast.js:604-628`; `today-screen.js:901-908`; 6 unit tests |
| PRED-12 | 12-06 | Nap probability score on nap-start card | SATISFIED | `forecast.js:841-911`; `today-screen.js:916-936, 167-171, 285-289`; 11 unit tests |
| UI-07 | 12-01 | Card order wake → nap start → nap end → bedtime | SATISFIED | `today-screen.js:530`: `EVENT_TYPES = ['wake','napStart','napEnd','bedtime']` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `js/lib/forecast.js` | 914 | `// Phase 3+ placeholder: Auto-outlier detection (CFG-04 — currently inert)` | INFO | Pre-existing comment from Phase 3 planning; not introduced by Phase 12; CFG-04 is a documented deferred feature, not unresolved debt |

No blockers. The placeholder comment pre-dates Phase 12 and documents formally deferred future work (CFG-04 auto-outlier detection).

### Human Verification Required

#### 1. Intense-day browser round-trip (PRED-10 UI)

**Test:** Open the event-entry modal, tick the "Intense day" checkbox, save an event. Navigate to the History screen.
**Expected:** The indigo "Intense" badge appears in the date cell for that day. Clicking the badge removes it and the date disappears from `settings.intenseDays`.
**Why human:** `manual-entry.js` and `history-screen.js` are DOM-only modules. No unit test covers the checkbox → settings.update → badge render → badge remove cycle. The code is fully present and wired; the browser interaction is the only unverified path.

#### 2. Nap probability score visual display (PRED-12 UI)

**Test:** With sufficient history (>= minDays valid days), open the Today screen during normal waking hours before the nap window has passed.
**Expected:** The nap-start prediction card and/or the hero "next event" card display a line such as "72% chance of nap today" (in `.nap-probability` styling). A score of 0 shows "nap window closed". When history is insufficient, no score line appears.
**Why human:** The `napProbabilityScore` computation is unit-tested in isolation, but the DOM rendering in `renderPredictionCard` and `renderNextEventCard` requires a live browser to confirm the `<p class="nap-probability">` element is painted with the correct text and CSS appearance.

---

## Summary

Phase NW-12 goal is **achieved in code**: all 6 success criteria are implemented and wired. The 696 unit tests (0 failures) cover PRED-08, PRED-09, PRED-10, PRED-11, PRED-12, and the day-bucket `annotateIntense` annotation exhaustively.

Two minor human verification items remain — both concern browser rendering of UI elements whose underlying logic is fully unit-tested. These do not block the algorithmic deliverables of the phase.

---

_Verified: 2026-08-25T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
