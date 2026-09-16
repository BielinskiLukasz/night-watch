# Roadmap: Nightwatch

## Milestones

- **[v1.0](milestones/v1.0-ROADMAP.md)** — 8 phases, 46 plans, 51/51 requirements, 495 tests; shipped 2026-06-30 (tag: `v1.0.0`)
- **[v1.1](milestones/v1.1-ROADMAP.md)** — 1 phase, 6 plans, 9/9 requirements, 635 tests; shipped 2026-07-10 (tag: `v1.1.0`)
- **[v1.2](milestones/v1.2-ROADMAP.md)** — 2 phases, 15 plans, 17/17 requirements; shipped 2026-08-24 (tag: `v1.2.0`)
- **[v1.3](milestones/v1.3-ROADMAP.md)** — 3 phases, prediction logic refinements + TIF extensions; shipped 2026-08-27
- **[v1.4](milestones/v1.4-ROADMAP.md)** — 4 phases, 8 plans, 11/11 requirements, 918 tests; shipped 2026-09-08
- **v2.0** — 7 phases (19–25), 27 requirements; prediction engine Algorithm C + autosave; **in progress**

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–8) — SHIPPED 2026-06-30</summary>

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.1 UX Polish (Phase 9) — SHIPPED 2026-07-10</summary>

See [v1.1 archive](milestones/v1.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.2 Prediction & Metrics (Phases 10–11) — SHIPPED 2026-08-24</summary>

See [v1.2 archive](milestones/v1.2-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.3 Prediction & TIF Enhancements (Phases 12–14) — SHIPPED 2026-08-27</summary>

See [v1.3 archive](milestones/v1.3-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.4 TIF Fixes & Metrics Depth (Phases 15–18) — SHIPPED 2026-09-08</summary>

- [x] **Phase 15: TIF Engine Bug Fixes** — Correctness fixes for `findBedtimeDayRecord` latestAt ordering, rejected-day pre-filter semantics, redundant tifForecast render call, misleading comment, and stale test name (completed 2026-08-31)
- [x] **Phase 16: Rolling Window Aggregates** — 7-day and 14-day windowed stats across all Metrics screen columns (completed 2026-09-01)
- [x] **Phase 17: Day-of-Week Patterns** — Per-weekday averages for MA, AA, nap duration, and sleep duration in a collapsible Metrics section (completed 2026-09-02)
- [x] **Phase 18: Sleep Debt Proxy** — Rolling 7-day accumulated sleep deficit column in Metrics screen per-day table and aggregates (completed 2026-09-08)

See [v1.4 archive](milestones/v1.4-ROADMAP.md) for full phase details.

</details>

## v2.0 Prediction Engine & Autosave (Phases 19–25)

- [x] **Phase 19: Split Bedtime & Wake-Anchored Nap** — Extend `forecast-blend.js` with `buildBedtimeSeriesNapDay` / `buildBedtimeSeriesNoNapDay` (separate P10/P50/P90 distributions) and probability-weighted blending when today's nap status is undetermined; add `buildNapGapSeries(dayRecords)` and `buildNapDurationSeries(dayRecords)` to `js/lib/forecast.js` so the Classic algorithm anchors nap-start to today's actual wake time via gap percentiles and derives nap-end via duration percentiles; unit tests cover split-series selection and wake-anchor arithmetic (requirements: PRED-18, PRED-19, PRED-20, PRED-21, PRED-22) (completed 2026-09-14)
  **Plans:** 2 plans
  Plans:
  - [x] 19-01-PLAN.md — New helper exports: percentileFromArray, buildNapGapSeries, buildNapDurationSeries, buildBedtimeSeriesNapDay, buildBedtimeSeriesNoNapDay (TDD tracer + expansion)
  - [x] 19-02-PLAN.md — forecast() split bedtime routing + wake-anchored nap + schema cleanup (D-09/D-10 checkpoint)

- [ ] **Phase 20: Nap Probability Redesign** — Refactor `napProbabilityScore` in `js/lib/forecast.js`: drop clock-based `elapsedWakeTime` (30%) and `windowPassed` (10%) inputs, add `dayOfWeekNapRate` (30%) from `dayOfWeekAverages()` in `metrics.js` and `sleepDebtSignal` (20%) from `sleepDebtProxy()` in `metrics.js`, keep `napFrequency` (35%) and `noNapStreakPenalty` (15%); weights sum to 100%; unit tests cover all five signals and weight totals; no circular imports (`forecast.js` may import from `metrics.js` — verify direction) (requirements: NAP-01, NAP-02, NAP-03, NAP-04)
  **Plans:** 2 plans
  Plans:
  - [x] 20-01-PLAN.md — napProbability() 4-signal engine rewrite + dayOfWeekAverages() extension (TDD tracer + expansion)
  - [x] 20-02-PLAN.md — forecast.js + today-screen.js consumption wiring (D-04/D-07)

- [ ] **Phase 21: Prediction Normalization** — Add `nextReachableEvent(lastEvent, currentHour, settings)` helper (pure function, new export in `js/lib/forecast.js` or a dedicated `js/lib/forecast-utils.js`); update `today-screen.js` to render only the next reachable event card prominently and to fully hide (not collapse) nap cards when the nap window is closed via a dedicated UI flag; if `forecast-utils.js` is new it must be added to `PRECACHE_LIST` and `sw-precache.test.js`; E2E tests cover event-card visibility for each reachable-event state (requirements: PRED-23, PRED-24, UI-13)

- [ ] **Phase 22: Accuracy Scoring** — Add `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` to `js/lib/accuracy.js` using the linear-decay formula (D≤W → 100−(50/W)×D; W<D≤2W → 50−(50/W)×(D−W); D>2W → 0); change daily score to arithmetic mean of per-event scores; update `accuracy-screen.js` to render per-event scores and the new daily average; update backtesting engine calls in `accuracy.js` (and `accuracy-tif.js` if it references hit/miss) to call `eventAccuracyScore` — `accuracy-tif.js` must NOT import `metrics.js` (circular guard); unit tests cover formula boundary values (D=0, D=W, D=2W, D>2W) (requirements: ACC-01, ACC-02, ACC-03, ACC-04)

- [ ] **Phase 23: Metrics→Accuracy Column Migration** — Move per-event TIF window columns (lower bound, upper bound, confidence score, window width) from `metrics-screen.js` to `accuracy-screen.js`; remove the columns and their data-prep calls from the Metrics pipeline; update unit tests and E2E specs to assert columns appear on Accuracy screen and are absent from Metrics screen (requirements: UI-11)

- [ ] **Phase 24: Autosave** — Create `js/lib/autosave.js` exporting `pickSaveDirectory()` (calls `window.showDirectoryPicker()` and persists the `FileSystemDirectoryHandle` to IndexedDB via a minimal inline wrapper), `saveToDisk(handle, jsonString)` (debounced 500ms, fires after every event-store mutation), and `restoreHandle()` (retrieves handle on launch, prompts re-permission if `queryPermission` returns `'prompt'`); wire into `app.js` via event-store subscription; add a Settings UI row for the autosave directory with graceful fallback copy and a manual Export button when the File System Access API is unavailable (Firefox, Safari, `file://`); add `autosave.js` to `PRECACHE_LIST` in `sw.js` and `tests/unit/sw-precache.test.js`; unit tests cover debounce, handle persistence round-trip, and fallback detection; E2E test covers the Settings UI row in both supported and fallback states (requirements: PLAT-01, PLAT-02, PLAT-03, PLAT-04)

- [ ] **Phase 25: Algorithm C & Settings Modal** — Create `js/lib/forecast-blend.js` exporting `blendForecast(dayRecords, snap)` with dual-model wake blend (A1 historic band + A2 sleep-length projection), three-band bedtime blend (historic + day-length + AA), interval stability check (intersection/shrinkage), and coverage for all 4 events; add three-option algorithm selector (Classic / TIF / Algorithm C) with context-sensitive fieldset show/hide in the Settings modal; add `forecast-blend.js` to `PRECACHE_LIST` in `sw.js` and `tests/unit/sw-precache.test.js`; unit tests RED→GREEN for all blend and stability logic, E2E test for selector visibility (requirements: PRED-13, PRED-14, PRED-15, PRED-16, PRED-17, UI-12)

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
