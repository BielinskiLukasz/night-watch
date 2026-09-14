# Requirements: Nightwatch v2.0

**Defined:** 2026-09-08
**Core Value:** Given enough sleep history, predict the next wake/bed/nap events accurately enough to be useful — and surface accuracy transparently over time.

## v2.0 Requirements

### Prediction Engine (Algorithm C)

- [ ] **PRED-13**: `js/lib/forecast-blend.js` exports `blendForecast(dayRecords, snap)` — Algorithm C entry point returning the same top-level prediction shape as Classic and TIF so `today-screen.js` can swap between all three transparently
- [ ] **PRED-14**: Algorithm C wake prediction — dual-model median blend of A1 (historic wake-up band) and A2 (sleep-length band projected from last bedtime); median of each model's trimmed distribution, final central = average of the two medians
- [ ] **PRED-15**: Algorithm C bedtime prediction — three-band blend: Historic bedtime band + Day-length band + Activity-after-nap band (AA band); central = average of the three trimmed medians
- [ ] **PRED-16**: Algorithm C interval stability check for each event — if per-model intervals overlap, use intersection (with shrinkage toward intersection center when central lies outside); if no overlap, use combined union range
- [ ] **PRED-17**: Algorithm C covers all 4 events: wake, bedtime, nap-start, nap-end (nap-start and nap-end use wake-anchored gaps, see PRED-19/PRED-20)
- [x] **PRED-18**: Split bedtime model (`buildBedtimeSeriesNapDay`, `buildBedtimeSeriesNoNapDay`) — separate P10/P50/P90 distributions for days with a nap vs days without; prediction selects the matching series based on today's nap status
- [ ] **PRED-19**: When today's nap status is undetermined at bedtime prediction time, blend nap-day and no-nap-day distributions proportionally to today's nap probability score

### Classic Nap Predictions (Wake-Anchored)

- [x] **PRED-20**: `buildNapGapSeries(dayRecords)` in `forecast.js` — computes `(napStart − wake)` gap in minutes for each day with a recorded nap; returns array of gap values
- [ ] **PRED-21**: Classic nap-start prediction anchors to today's actual wake time — project nap-start as `wakeAnchor + P10/P50/P90(napGap)` from `buildNapGapSeries`; replaces time-of-day percentile approach
- [x] **PRED-22**: `buildNapDurationSeries(dayRecords)` — computes `(napEnd − napStart)` in minutes per day; Classic nap-end = nap-start anchor + P10/P50/P90(napDuration)

### Nap Probability Redesign

- [ ] **NAP-01**: Remove `elapsedWakeTime` (30% weight) and `windowPassed` (10% weight) signals from `napProbabilityScore` — eliminate clock-based, time-varying inputs so the score is computed once at wake time and remains stable
- [ ] **NAP-02**: Add `dayOfWeekNapRate` signal (30% weight) — fraction of same-weekday days (in rolling window) that had a nap, derived from `dayOfWeekAverages()` in `metrics.js`
- [ ] **NAP-03**: Add `sleepDebtSignal` (20% weight) — normalized value from `sleepDebtProxy()` in `metrics.js`; higher debt increases nap probability
- [ ] **NAP-04**: Retain `napFrequency` (35% weight) and `noNapStreakPenalty` (15% weight) from v1.3 implementation; total weights sum to 100%

### Prediction Normalization

- [ ] **PRED-23**: `nextReachableEvent(lastEvent, currentHour, settings)` helper — returns the single next upcoming event type given the last logged event type and the current hour; used by Today screen to show only the immediately relevant prediction
- [ ] **PRED-24**: Today screen suppresses nap prediction cards when the nap window is closed (not just collapsed); "window closed" is a dedicated UI flag derived from nap probability logic, independent of the probability score value

### Accuracy Scoring

- [ ] **ACC-01**: `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` pure function in `js/lib/accuracy.js` — linear-decay tolerance-window formula; D = |actual − forecast| in minutes
- [ ] **ACC-02**: Scoring formula: D ≤ W → Score = 100 − (50/W) × D; W < D ≤ 2W → Score = 50 − (50/W) × (D − W); D > 2W → Score = 0
- [ ] **ACC-03**: Daily accuracy score = arithmetic mean of per-event `eventAccuracyScore` values for events with both forecast and actual times recorded
- [ ] **ACC-04**: Per-event scores and daily average replace the current binary within-max-delta hit/miss metric; Accuracy screen renders the new scores; backtesting engine in `accuracy.js` updated to call `eventAccuracyScore`

### Screen Changes

- [ ] **UI-11**: Move TIF window columns (per-event lower/upper bounds, confidence score, window width) from Metrics screen to Accuracy screen — clean separation: Metrics = what happened, Accuracy = how well predicted
- [ ] **UI-12**: Settings modal Algorithm selector exposes three options: Classic / TIF / Algorithm C; algorithm-specific settings (Classic trim/rolling, TIF precision, Blend shrinkage) show/hide based on active selection; selector rendered at top of Forecast & Prediction fieldset (consistent with v1.3 placement)
- [ ] **UI-13**: Today screen renders only the next reachable event card prominently using `nextReachableEvent`; secondary events remain accessible but de-emphasized; nap cards hidden (not collapsed) when window is closed

### Autosave

- [ ] **PLAT-01**: `js/lib/autosave.js` exports `pickSaveDirectory()` — calls `window.showDirectoryPicker()` and persists the `FileSystemDirectoryHandle` to IndexedDB via a small inline wrapper (no npm package)
- [ ] **PLAT-02**: `saveToDisk(handle, jsonString)` — writes the canonical JSON export to the persisted directory handle; debounced (500 ms) trigger fires after every event add, edit, or delete
- [ ] **PLAT-03**: `restoreHandle()` — retrieves the persisted handle from IndexedDB on app launch; prompts the user to re-confirm permission if the handle exists but `queryPermission` returns `'prompt'`
- [ ] **PLAT-04**: Graceful fallback when File System Access API is unavailable (Firefox, Safari, `file://` context) — autosave section in Settings shows an explanatory note and a manual Export button instead of the directory picker

## Out of Scope (v2.0)

| Feature | Reason |
|---------|--------|
| Multi-profile switching | Changes persistence shape; deferred to v3 |
| Multiple naps per day | Data shape migration required; deferred |
| Auto-detected life stages | Statistically nontrivial; manual stages sufficient |
| Backend / cloud sync | Offline-first constraint |
| Browser push notifications | Adds permission flows; deferred |
| IndexedDB as primary storage | file-as-truth model maintained |

## Traceability

| Requirement | Backlog | Phase | Status |
|-------------|---------|-------|--------|
| PRED-13 | B-050 | Phase 25 | Pending |
| PRED-14 | B-050 | Phase 25 | Pending |
| PRED-15 | B-050 | Phase 25 | Pending |
| PRED-16 | B-050 | Phase 25 | Pending |
| PRED-17 | B-050 | Phase 25 | Pending |
| PRED-18 | B-052 | Phase 19 | Complete |
| PRED-19 | B-052 | Phase 19 | Pending |
| PRED-20 | B-048 | Phase 19 | Complete |
| PRED-21 | B-048 | Phase 19 | Pending |
| PRED-22 | B-048 | Phase 19 | Complete |
| NAP-01 | B-047 | Phase 20 | Pending |
| NAP-02 | B-047 | Phase 20 | Pending |
| NAP-03 | B-047 | Phase 20 | Pending |
| NAP-04 | B-047 | Phase 20 | Pending |
| PRED-23 | B-038 | Phase 21 | Pending |
| PRED-24 | B-038 | Phase 21 | Pending |
| ACC-01 | B-049 | Phase 22 | Pending |
| ACC-02 | B-049 | Phase 22 | Pending |
| ACC-03 | B-049 | Phase 22 | Pending |
| ACC-04 | B-049 | Phase 22 | Pending |
| UI-11 | B-041 | Phase 23 | Pending |
| UI-12 | B-032 | Phase 25 | Pending |
| UI-13 | B-038 | Phase 21 | Pending |
| PLAT-01 | B-051 | Phase 24 | Pending |
| PLAT-02 | B-051 | Phase 24 | Pending |
| PLAT-03 | B-051 | Phase 24 | Pending |
| PLAT-04 | B-051 | Phase 24 | Pending |

**Coverage:**

- v2.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-09-08*
*Last updated: 2026-09-14 — Algorithm C (Phase 19) moved to Phase 25; phases 20–25 shifted to 19–24 to build foundational nap/accuracy work before the blending algorithm*
