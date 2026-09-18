# Roadmap: Nightwatch

## Milestones

- **[v1.0](milestones/v1.0-ROADMAP.md)** — 8 phases, 46 plans, 51/51 requirements, 495 tests; shipped 2026-06-30 (tag: `v1.0.0`)
- **[v1.1](milestones/v1.1-ROADMAP.md)** — 1 phase, 6 plans, 9/9 requirements, 635 tests; shipped 2026-07-10 (tag: `v1.1.0`)
- **[v1.2](milestones/v1.2-ROADMAP.md)** — 2 phases, 15 plans, 17/17 requirements; shipped 2026-08-24 (tag: `v1.2.0`)
- **[v1.3](milestones/v1.3-ROADMAP.md)** — 3 phases, prediction logic refinements + TIF extensions; shipped 2026-08-27
- **[v1.4](milestones/v1.4-ROADMAP.md)** — 4 phases, 8 plans, 11/11 requirements, 918 tests; shipped 2026-09-08
- **v1.5** — 7 phases (19–25), 27 requirements; prediction engine Algorithm C + autosave; **in progress**

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

## v1.5 Prediction Engine & Autosave (Phases 19–25)

- [x] **Phase 19: Split Bedtime & Wake-Anchored Nap** — Extend `forecast-blend.js` with `buildBedtimeSeriesNapDay` / `buildBedtimeSeriesNoNapDay` (separate P10/P50/P90 distributions) and probability-weighted blending when today's nap status is undetermined; add `buildNapGapSeries(dayRecords)` and `buildNapDurationSeries(dayRecords)` to `js/lib/forecast.js` so the Classic algorithm anchors nap-start to today's actual wake time via gap percentiles and derives nap-end via duration percentiles; unit tests cover split-series selection and wake-anchor arithmetic (requirements: PRED-18, PRED-19, PRED-20, PRED-21, PRED-22) (completed 2026-09-14)
  **Plans:** 2 plans
  Plans:
  - [x] 19-01-PLAN.md — New helper exports: percentileFromArray, buildNapGapSeries, buildNapDurationSeries, buildBedtimeSeriesNapDay, buildBedtimeSeriesNoNapDay (TDD tracer + expansion)
  - [x] 19-02-PLAN.md — forecast() split bedtime routing + wake-anchored nap + schema cleanup (D-09/D-10 checkpoint)

- [x] **Phase 20: Nap Probability Redesign** — Refactor `napProbabilityScore` in `js/lib/forecast.js`: drop clock-based `elapsedWakeTime` (30%) and `windowPassed` (10%) inputs, add `dayOfWeekNapRate` (30%) from `dayOfWeekAverages()` in `metrics.js` and `sleepDebtSignal` (20%) from `sleepDebtProxy()` in `metrics.js`, keep `napFrequency` (35%) and `noNapStreakPenalty` (15%); weights sum to 100%; unit tests cover all five signals and weight totals; no circular imports (`forecast.js` may import from `metrics.js` — verify direction) (requirements: NAP-01, NAP-02, NAP-03, NAP-04) (completed 2026-09-16)
  **Plans:** 7 plans (2 executed + 5 gap-closure)
  Plans:
  - [x] 20-01-PLAN.md — napProbability() 4-signal engine rewrite + dayOfWeekAverages() extension (TDD tracer + expansion)
  - [x] 20-02-PLAN.md — forecast.js + today-screen.js consumption wiring (D-04/D-07)
  - [x] 20-03-PLAN.md — Gap closure: CR-01 day-record ordering fix (forecast/tifForecast/napProbability + metrics-screen parity) + CR-02 local-date lookup fix (20-REVIEW.md blockers)
  - [x] 20-04-PLAN.md — Gap closure: gate PRED-19 bedtime blend on napWindowClosed (G-20-16 item 1, 20-UAT.md)
  - [x] 20-05-PLAN.md — Gap closure: gate forecast-tif.js Activity-after-nap band on isNoNapDay (G-20-16 item 3, 20-UAT.md)
  - [ ] 20-06-PLAN.md — Gap closure: Details section (hero's own type + bedtime/bedtimeAfterWake substitution + distinct labels) (G-20-15, G-20-16 item 2, 20-UAT.md)
  - [ ] 20-07-PLAN.md — Gap closure: Accuracy screen TIF per-day table mobile scroll wrapper (G-20-17, 20-UAT.md)

- [x] **Phase 21: Prediction Normalization** — Add `nextReachableEvent(lastEvent, currentHour, settings)` helper (pure function, new export in `js/lib/forecast.js` or a dedicated `js/lib/forecast-utils.js`); update `today-screen.js` to render only the next reachable event card prominently and to fully hide (not collapse) nap cards when the nap window is closed via a dedicated UI flag; if `forecast-utils.js` is new it must be added to `PRECACHE_LIST` and `sw-precache.test.js`; E2E tests cover event-card visibility for each reachable-event state (requirements: PRED-23, PRED-24, UI-13) (completed 2026-09-16)
  **Plans:** 3 plans
  Plans:
  - [x] 21-01-PLAN.md — napWindowClosed decoupling + nextReachableEvent/selectNextEvent extraction (tracer)
  - [x] 21-02-PLAN.md — predictions.bedtimeAfterWake + dual-hero rendering + "Later today" section
  - [x] 21-03-PLAN.md — Full E2E coverage matrix for all 5 nextReachableEvent paths

- [x] **Phase 22: Accuracy Scoring** — Add `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` to `js/lib/accuracy.js` using the linear-decay formula (D≤W → 100−(50/W)×D; W<D≤2W → 50−(50/W)×(D−W); D>2W → 0); change daily score to arithmetic mean of per-event scores; update `accuracy-screen.js` to render per-event scores and the new daily average; update backtesting engine calls in `accuracy.js` (and `accuracy-tif.js` if it references hit/miss) to call `eventAccuracyScore` — `accuracy-tif.js` must NOT import `metrics.js` (circular guard); unit tests cover formula boundary values (D=0, D=W, D=2W, D>2W) (requirements: ACC-01, ACC-02, ACC-03, ACC-04) (completed 2026-09-17)
  **Plans:** 3 plans
  Plans:
  - [x] 22-01-PLAN.md — eventAccuracyScore() + computeAccuracy() rewrite (bedtime split, band approximation, overall score)
  - [x] 22-02-PLAN.md — accuracy-tif.js bedtime nap-day/no-nap-day split
  - [x] 22-03-PLAN.md — accuracy-screen.js rendering rewrite (avgScore column, headline, TIF table split)

- [x] **Phase 23: Metrics→Accuracy Column Migration** — Move per-event TIF window columns (lower bound, upper bound, confidence score, window width) from `metrics-screen.js` to `accuracy-screen.js`; remove the columns and their data-prep calls from the Metrics pipeline; update unit tests and E2E specs to assert columns appear on Accuracy screen and are absent from Metrics screen (requirements: UI-11) (completed 2026-09-17)
  **Plans:** 2 plans
  Plans:
  - [x] 23-01-PLAN.md — Add per-day TIF window table to Accuracy screen (buildTifPerDayTable, CSS, E2E coverage)
  - [x] 23-02-PLAN.md — Remove TIF_COLUMNS and all rendering call sites from Metrics screen; update E2E specs

- [x] **Phase 24: Autosave** — Create `js/lib/autosave.js` exporting `pickSaveDirectory()` (calls `window.showDirectoryPicker()` and persists the `FileSystemDirectoryHandle` to IndexedDB via a minimal inline wrapper), `saveToDisk(handle, jsonString)` (debounced 500ms, fires after every event-store mutation), and `restoreHandle()` (retrieves handle on launch, prompts re-permission if `queryPermission` returns `'prompt'`); wire into `app.js` via event-store subscription; add a Settings UI row for the autosave directory with graceful fallback copy and a manual Export button when the File System Access API is unavailable (Firefox, Safari, `file://`); add `autosave.js` to `PRECACHE_LIST` in `sw.js` and `tests/unit/sw-precache.test.js`; unit tests cover debounce, handle persistence round-trip, and fallback detection; E2E test covers the Settings UI row in both supported and fallback states (requirements: PLAT-01, PLAT-02, PLAT-03, PLAT-04) (completed 2026-09-18)
  **Plans:** 5 plans (4 executed + 1 gap-closure)
  Plans:
  - [x] 24-01-PLAN.md — autosave.js core round trip (pick/persist/restore/write) + debounce + support detection + sw.js precache (TDD tracer + expansion)
  - [x] 24-02-PLAN.md — app.js composition-root wiring: boot restore, debounced event-log subscription, autosaveActions
  - [x] 24-03-PLAN.md — Settings modal Backup fieldset (index.html markup + rendering/wiring + E2E)
  - [x] 24-04-PLAN.md — First-launch banner on Today screen (today-screen.js + CSS + E2E)
  - [x] 24-05-PLAN.md — Fix Settings Remove-handler await race (Gap A/WR-01) + Settings-configured banner suppression (Gap B/WR-02)

- [x] **Phase 25: Algorithm C & Settings Modal** — Create `js/lib/forecast-blend.js` exporting `blendForecast(dayRecords, snap)` with dual-model wake blend (A1 historic band + A2 sleep-length projection), three-band bedtime blend (historic + day-length + AA), interval stability check (intersection/shrinkage), and coverage for all 4 events; add three-option algorithm selector (Classic / TIF / Algorithm C) with context-sensitive fieldset show/hide in the Settings modal; add `forecast-blend.js` to `PRECACHE_LIST` in `sw.js` and `tests/unit/sw-precache.test.js`; unit tests RED→GREEN for all blend and stability logic, E2E test for selector visibility (requirements: PRED-13, PRED-14, PRED-15, PRED-16, PRED-17, UI-12) (completed 2026-09-18)
  **Plans:** 5 plans
  Plans:
  - [x] 25-01-PLAN.md — forecast-blend.js wake dual-model blend + shared trim/stability helpers + sw precache (TDD tracer + expansion)
  - [x] 25-02-PLAN.md — forecast-blend.js bedtime/napStart/napEnd blends, completing all 4 events
  - [x] 25-03-PLAN.md — DEFAULT_SETTINGS + RULES for blendWindowDays/blendTrimPct/blendShrinkage
  - [x] 25-04-PLAN.md — Settings modal three-way selector + #blendOptions fieldset + today-screen.js dispatch
  - [x] 25-05-PLAN.md — E2E coverage for selector visibility and real-prediction rendering

## Phase Details

> Detail sections for the v1.5 milestone (Phases 19-25) — added retroactively to
> restore the dual checklist+detail format the roadmap tooling expects (the
> checklist above existed alone; `roadmap.get-phase` needs both). Content is a
> direct restructuring of the checklist bullets, not new scope.

### Phase 19: Split Bedtime & Wake-Anchored Nap

**Goal**: Predictions use separate bedtime distributions for nap-days vs. no-nap-days, blended probabilistically when today's nap status is undetermined, and nap-start/nap-end predictions anchor to today's actual wake time via gap/duration percentiles
**Depends on**: Phase 18
**Requirements**: PRED-18, PRED-19, PRED-20, PRED-21, PRED-22
**Success Criteria** (what must be TRUE):

  1. `buildBedtimeSeriesNapDay` / `buildBedtimeSeriesNoNapDay` in `forecast-blend.js` produce separate P10/P50/P90 distributions for nap-day vs. no-nap-day bedtimes, with probability-weighted blending when today's nap status is undetermined
  2. `buildNapGapSeries(dayRecords)` and `buildNapDurationSeries(dayRecords)` in `js/lib/forecast.js` anchor nap-start to today's actual wake time via gap percentiles and derive nap-end via duration percentiles
  3. Unit tests cover split-series selection and wake-anchor arithmetic

**Completed**: 2026-09-14

### Phase 20: Nap Probability Redesign

**Goal**: Nap probability score reflects stable, day-of-week- and sleep-debt-aware signals instead of clock-based inputs that drift throughout the day
**Depends on**: Phase 19
**Requirements**: NAP-01, NAP-02, NAP-03, NAP-04
**Success Criteria** (what must be TRUE):

  1. `napProbabilityScore` in `js/lib/forecast.js` drops the clock-based `elapsedWakeTime` (30%) and `windowPassed` (10%) signals
  2. `dayOfWeekNapRate` (30%, from `dayOfWeekAverages()` in `metrics.js`) and `sleepDebtSignal` (20%, from `sleepDebtProxy()` in `metrics.js`) are added
  3. `napFrequency` (35%) and `noNapStreakPenalty` (15%) are retained; all five weights sum to 100%
  4. Unit tests cover all five signals and weight totals; no circular imports between `forecast.js` and `metrics.js`

**Completed**: 2026-09-16

### Phase 21: Prediction Normalization

**Goal**: The Today screen shows only the next realistically-reachable sleep event prominently instead of always rendering all four event-type cards, with nap cards fully hidden (not collapsed) once the nap window has closed
**Depends on**: Phase 20 (this phase adds `napWindowClosed` to `napProbability()`'s return shape)
**Requirements**: PRED-23, PRED-24, UI-13
**Success Criteria** (what must be TRUE):

  1. `nextReachableEvent(lastEvent, currentHour, settings)` — a new pure helper in a dedicated `js/lib/forecast-utils.js` — returns the reachable next event type(s) as an array (length 2 only for the ambiguous wake→{napStart, bedtimeAfterWake} branch) given the last logged event and the current hour
  2. `selectNextEvent` becomes a thin wrapper around `nextReachableEvent`: reads the real clock once, delegates, then walks `predictions` to skip event types with no historical data
  3. The Today screen renders the reachable event(s) as prominent hero card(s) — one normally, two side-by-side when nap status is undetermined
  4. The `napStart` card is fully hidden (not collapsed) once `napWindowClosed` is true or `currentHour >= settings.eveningHour`
  5. Non-hero events move into a new collapsible "Later today" section (collapsed by default) that wraps the existing per-event card renderers unchanged
  6. `forecast-utils.js` is added to `sw.js`'s `PRECACHE_LIST` and to `tests/unit/sw-precache.test.js`
  7. E2E tests cover event-card visibility for each reachable-event state

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 21-01-PLAN.md — napWindowClosed decoupling + nextReachableEvent/selectNextEvent extraction (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-02-PLAN.md — predictions.bedtimeAfterWake + dual-hero rendering + "Later today" section

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 21-03-PLAN.md — Full E2E coverage matrix for all 5 nextReachableEvent paths

### Phase 22: Accuracy Scoring

**Goal**: Prediction accuracy is scored per-event with a linear-decay formula instead of a single daily hit/miss, giving a more granular accuracy signal
**Depends on**: Phase 21
**Requirements**: ACC-01, ACC-02, ACC-03, ACC-04
**Success Criteria** (what must be TRUE):

  1. `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` added to `js/lib/accuracy.js` using the linear-decay formula (D≤W → 100−(50/W)×D; W<D≤2W → 50−(50/W)×(D−W); D>2W → 0)
  2. Daily score changes to the arithmetic mean of per-event scores
  3. `accuracy-screen.js` renders per-event scores and the new daily average
  4. Backtesting engine calls in `accuracy.js` (and `accuracy-tif.js` if it references hit/miss) call `eventAccuracyScore`; `accuracy-tif.js` still does not import `metrics.js` (circular-import guard)
  5. Unit tests cover formula boundary values (D=0, D=W, D=2W, D>2W)

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 22-01-PLAN.md — eventAccuracyScore() formula + computeAccuracy() rewrite: base 4 types, bedtime nap-day split, band-fallback approximation, overall headline score (tracer + expansion)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02-PLAN.md — accuracy-tif.js bedtime nap-day/no-nap-day split (D-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-03-PLAN.md — accuracy-screen.js rendering: avgScore column, bedtime-split rows, overall headline, approximated-score marker, TIF table split

### Phase 23: Metrics→Accuracy Column Migration

**Goal**: TIF prediction-window columns live on the Accuracy screen (how well predictions performed) instead of the Metrics screen (what happened)
**Depends on**: Phase 22
**Requirements**: UI-11
**Success Criteria** (what must be TRUE):

  1. Per-event TIF window columns (lower bound, upper bound, confidence score, window width) move from `metrics-screen.js` to `accuracy-screen.js`
  2. The columns and their data-prep calls are removed from the Metrics pipeline
  3. Unit tests and E2E specs assert the columns appear on the Accuracy screen and are absent from the Metrics screen

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Add per-day TIF window table to Accuracy screen (buildTifPerDayTable, CSS, E2E coverage)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — Remove TIF_COLUMNS and all rendering call sites from Metrics screen; update E2E specs

### Phase 24: Autosave

**Goal**: Users' data saves automatically to a chosen local directory instead of relying solely on manual export, with a graceful fallback where the File System Access API is unavailable
**Depends on**: Phase 23
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04
**Success Criteria** (what must be TRUE):

  1. `js/lib/autosave.js` exports `pickSaveDirectory()`, `saveToDisk(handle, jsonString)` (debounced 500ms, fires after every event-store mutation), and `restoreHandle()` (prompts re-permission when `queryPermission` returns `'prompt'`)
  2. `app.js` wires autosave into the event-store subscription
  3. Settings UI has an autosave-directory row with graceful fallback copy and a manual Export button when the File System Access API is unavailable (Firefox, Safari, `file://`)
  4. `autosave.js` is added to `PRECACHE_LIST` in `sw.js` and to `tests/unit/sw-precache.test.js`
  5. Unit tests cover debounce, handle persistence round-trip, and fallback detection; E2E test covers the Settings UI row in both supported and fallback states

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 24-01-PLAN.md — autosave.js core round trip (pick/persist/restore/write) + debounce + support detection + sw.js precache (TDD tracer + expansion)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-02-PLAN.md — app.js composition-root wiring: boot restore, debounced event-log subscription, autosaveActions

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 24-03-PLAN.md — Settings modal Backup fieldset (index.html markup + rendering/wiring + E2E)
- [x] 24-04-PLAN.md — First-launch banner on Today screen (today-screen.js + CSS + E2E)

**Gap closure** *(from 24-VERIFICATION.md gaps_found)*

- [x] 24-05-PLAN.md — Fix Settings Remove-handler await race (Gap A/WR-01) + Settings-configured banner suppression (Gap B/WR-02)

### Phase 25: Algorithm C & Settings Modal

**Goal**: Users can opt into a third prediction algorithm (Algorithm C) that blends multiple models per event, selectable alongside Classic and TIF from the Settings modal
**Depends on**: Phase 24
**Requirements**: PRED-13, PRED-14, PRED-15, PRED-16, PRED-17, UI-12
**Success Criteria** (what must be TRUE):

  1. `js/lib/forecast-blend.js` exports `blendForecast(dayRecords, snap)` with a dual-model wake blend (A1 historic band + A2 sleep-length projection) and a three-band bedtime blend (historic + day-length + AA)
  2. An interval stability check (intersection/shrinkage when intervals overlap; combined union range when they don't) applies to all 4 events
  3. Algorithm C covers all 4 events: wake, bedtime, nap-start, nap-end
  4. Settings modal exposes a three-option algorithm selector (Classic / TIF / Algorithm C) with context-sensitive fieldset show/hide
  5. `forecast-blend.js` is added to `PRECACHE_LIST` in `sw.js` and to `tests/unit/sw-precache.test.js`
  6. Unit tests (RED→GREEN) cover all blend and stability logic; E2E test covers selector visibility

**Plans:** 9/9 plans complete

Plans:
**Wave 1**

- [x] 25-01-PLAN.md — forecast-blend.js wake dual-model blend + shared trim/stability helpers + sw precache (TDD tracer + expansion)
- [x] 25-03-PLAN.md — DEFAULT_SETTINGS + RULES for blendWindowDays/blendTrimPct/blendShrinkage

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 25-02-PLAN.md — forecast-blend.js bedtime/napStart/napEnd blends, completing all 4 events
- [x] 25-04-PLAN.md — Settings modal three-way selector + #blendOptions fieldset + today-screen.js dispatch

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 25-05-PLAN.md — E2E coverage for selector visibility and real-prediction rendering

**Gap closure** *(from 25-VERIFICATION.md gaps_found)*

- [x] 25-06-PLAN.md — Remove orphan noNapBedtimeOffsetMinutes input from index.html/settings-modal.js (gap 1 / CR-01)
- [x] 25-07-PLAN.md — Wrap napStart/napEnd anchor sums into [0,1440) before stabilityCheck (gap 2 / WR-01)
- [x] 25-08-PLAN.md — Harden stabilityCheck() with circular/modular interval comparison (25-VERIFICATION.md gaps_remaining / new CR-01)
- [x] 25-09-PLAN.md — circularTrimmedBand()/circularMean(): fix raw-sample circular median + cross-model averaging at the source (25-VERIFICATION.md re-verification gaps_remaining / 25-REVIEW.md CR-01 root cause)

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
