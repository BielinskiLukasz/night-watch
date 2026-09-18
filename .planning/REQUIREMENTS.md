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
- [x] **PRED-19**: When today's nap status is undetermined at bedtime prediction time, blend nap-day and no-nap-day distributions proportionally to today's nap probability score

### Classic Nap Predictions (Wake-Anchored)

- [x] **PRED-20**: `buildNapGapSeries(dayRecords)` in `forecast.js` — computes `(napStart − wake)` gap in minutes for each day with a recorded nap; returns array of gap values
- [x] **PRED-21**: Classic nap-start prediction anchors to today's actual wake time — project nap-start as `wakeAnchor + P10/P50/P90(napGap)` from `buildNapGapSeries`; replaces time-of-day percentile approach
- [x] **PRED-22**: `buildNapDurationSeries(dayRecords)` — computes `(napEnd − napStart)` in minutes per day; Classic nap-end = nap-start anchor + P10/P50/P90(napDuration)

### Nap Probability Redesign

- [x] **NAP-01**: Remove `elapsedWakeTime` (30% weight) and `windowPassed` (10% weight) signals from `napProbabilityScore` — eliminate clock-based, time-varying inputs so the score is computed once at wake time and remains stable
- [x] **NAP-02**: Add `dayOfWeekNapRate` signal (30% weight) — fraction of same-weekday days (in rolling window) that had a nap, derived from `dayOfWeekAverages()` in `metrics.js`
- [x] **NAP-03**: Add `sleepDebtSignal` (20% weight) — normalized value from `sleepDebtProxy()` in `metrics.js`; higher debt increases nap probability
- [x] **NAP-04**: Retain `napFrequency` (35% weight) and `noNapStreakPenalty` (15% weight) from v1.3 implementation; total weights sum to 100%

### Prediction Normalization

- [x] **PRED-23**: `nextReachableEvent(lastEvent, currentHour, settings)` helper — returns the single next upcoming event type given the last logged event type and the current hour; used by Today screen to show only the immediately relevant prediction
- [x] **PRED-24**: Today screen suppresses nap prediction cards when the nap window is closed (not just collapsed); "window closed" is a dedicated UI flag derived from nap probability logic, independent of the probability score value

### Accuracy Scoring

- [x] **ACC-01**: `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` pure function in `js/lib/accuracy.js` — linear-decay tolerance-window formula; D = |actual − forecast| in minutes
- [x] **ACC-02**: Scoring formula: D ≤ W → Score = 100 − (50/W) × D; W < D ≤ 2W → Score = 50 − (50/W) × (D − W); D > 2W → Score = 0
- [x] **ACC-03**: Daily accuracy score = arithmetic mean of per-event `eventAccuracyScore` values for events with both forecast and actual times recorded
- [x] **ACC-04**: Per-event scores and daily average replace the current binary within-max-delta hit/miss metric; Accuracy screen renders the new scores; backtesting engine in `accuracy.js` updated to call `eventAccuracyScore`

### Screen Changes

- [x] **UI-11**: Move TIF window columns (per-event lower/upper bounds, confidence score, window width) from Metrics screen to Accuracy screen — clean separation: Metrics = what happened, Accuracy = how well predicted
- [ ] **UI-12**: Settings modal Algorithm selector exposes three options: Classic / TIF / Algorithm C; algorithm-specific settings (Classic trim/rolling, TIF precision, Blend shrinkage) show/hide based on active selection; selector rendered at top of Forecast & Prediction fieldset (consistent with v1.3 placement)
- [x] **UI-13**: Today screen renders only the next reachable event card prominently using `nextReachableEvent`; secondary events remain accessible but de-emphasized; nap cards hidden (not collapsed) when window is closed

### Autosave

- [x] **PLAT-01**: `js/lib/autosave.js` exports `pickSaveDirectory()` — calls `window.showDirectoryPicker()` and persists the `FileSystemDirectoryHandle` to IndexedDB via a small inline wrapper (no npm package)
- [x] **PLAT-02**: `saveToDisk(handle, jsonString)` — writes the canonical JSON export to the persisted directory handle; debounced (500 ms) trigger fires after every event add, edit, or delete
- [x] **PLAT-03**: `restoreHandle()` — retrieves the persisted handle from IndexedDB on app launch; prompts the user to re-confirm permission if the handle exists but `queryPermission` returns `'prompt'`
- [x] **PLAT-04**: Graceful fallback when File System Access API is unavailable (Firefox, Safari, `file://` context) — autosave section in Settings shows an explanatory note and a manual Export button instead of the directory picker

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
| PRED-13 | B-050 | Phase 25 | Gaps Found |
| PRED-14 | B-050 | Phase 25 | Gaps Found |
| PRED-15 | B-050 | Phase 25 | Gaps Found |
| PRED-16 | B-050 | Phase 25 | Gaps Found |
| PRED-17 | B-050 | Phase 25 | Gaps Found |
| PRED-18 | B-052 | Phase 19 | Complete |
| PRED-19 | B-052 | Phase 19 | Complete |
| PRED-20 | B-048 | Phase 19 | Complete |
| PRED-21 | B-048 | Phase 19 | Complete |
| PRED-22 | B-048 | Phase 19 | Complete |
| NAP-01 | B-047 | Phase 20 | Complete |
| NAP-02 | B-047 | Phase 20 | Complete |
| NAP-03 | B-047 | Phase 20 | Complete |
| NAP-04 | B-047 | Phase 20 | Complete |
| PRED-23 | B-038 | Phase 21 | Complete |
| PRED-24 | B-038 | Phase 21 | Complete |
| ACC-01 | B-049 | Phase 22 | Complete |
| ACC-02 | B-049 | Phase 22 | Complete |
| ACC-03 | B-049 | Phase 22 | Complete |
| ACC-04 | B-049 | Phase 22 | Complete |
| UI-11 | B-041 | Phase 23 | Complete |
| UI-12 | B-032 | Phase 25 | Gaps Found |
| UI-13 | B-038 | Phase 21 | Complete |
| PLAT-01 | B-051 | Phase 24 | Complete |
| PLAT-02 | B-051 | Phase 24 | Complete |
| PLAT-03 | B-051 | Phase 24 | Complete |
| PLAT-04 | B-051 | Phase 24 | Complete |

**Coverage:**

- v2.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-09-08*
*Last updated: 2026-09-14 — Algorithm C (Phase 19) moved to Phase 25; phases 20–25 shifted to 19–24 to build foundational nap/accuracy work before the blending algorithm*
