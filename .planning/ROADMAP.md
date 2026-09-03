# Roadmap: Nightwatch

## Milestones

- **[v1.0](milestones/v1.0-ROADMAP.md)** — 8 phases, 46 plans, 51/51 requirements, 495 tests; shipped 2026-06-30 (tag: `v1.0.0`)
- **[v1.1](milestones/v1.1-ROADMAP.md)** — 1 phase, 6 plans, 9/9 requirements, 635 tests; shipped 2026-07-10 (tag: `v1.1.0`)
- **[v1.2](milestones/v1.2-ROADMAP.md)** — 2 phases, 15 plans, 17/17 requirements; shipped 2026-08-24 (tag: `v1.2.0`)
- **v1.3** — 3 phases, prediction logic refinements + TIF extensions; shipped 2026-08-27
- **v1.4** — TIF bug fixes + Metrics depth (rolling aggregates, day-of-week patterns, sleep debt proxy); active

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

- [x] Phase 10: TIF Algorithm & Settings (5/5 plans) — completed 2026-07-13
- [x] Phase 11: Metrics Screen (10/10 plans) — completed 2026-07-30

</details>

<details>
<summary>✅ v1.3 Prediction & TIF Enhancements (Phases 12–14) — SHIPPED 2026-08-27</summary>

- [x] **Phase 12: Prediction Logic Refinements** - Classic forecaster contextual rules (time-of-day bedtime, duration-band wake, intense-day flag, missed-nap bedtime shift, nap probability score) plus Today screen card ordering fix — completed 2026-08-25
- [x] **Phase 13: TIF Algorithm Extensions** - Ratio-based windows for nap-start/nap-end, rolling-window variant with MA/AA preference, per-window medians, and no-nap-day substitution logic — completed 2026-08-27
- [x] **Phase 14: TIF Metrics, Accuracy & Chart Fixes** - TIF-specific accuracy grid, Day/Sleep Factor column, Nap Fraction and AM/PM Split columns, TIF window bounds and aggregates on Metrics screen, Wake & Bedtime Bands chart Y-axis inversion + nap series + post-midnight dedup fix — completed 2026-08-27

</details>

<details open>
<summary>🚧 v1.4 TIF Fixes & Metrics Depth (Phases 15–18) — ACTIVE</summary>

- [x] **Phase 15: TIF Engine Bug Fixes** - Correctness fixes for `findBedtimeDayRecord` latestAt ordering, rejected-day pre-filter semantics, redundant tifForecast render call, misleading comment, and stale test name (completed 2026-08-31)
- [x] **Phase 16: Rolling Window Aggregates** - 7-day and 14-day windowed stats across all Metrics screen columns (completed 2026-09-01)
- [x] **Phase 17: Day-of-Week Patterns** - Per-weekday averages for MA, AA, nap duration, and sleep duration in a collapsible Metrics section (completed 2026-09-02)
- [ ] **Phase 18: Sleep Debt Proxy** - Rolling 7-day accumulated sleep deficit column in Metrics screen per-day table and aggregates

</details>

## Phase Details

### Phase 12: Prediction Logic Refinements

**Goal**: The classic forecaster uses contextual rules (time-of-day, missed nap, intense-day flag, sleep-duration band) to produce situationally accurate predictions, and the Today screen displays prediction cards in the correct order with a nap probability score
**Depends on**: Phase 11 (v1.2 complete)
**Requirements**: PRED-08, PRED-09, PRED-10, PRED-11, PRED-12, UI-07
**Success Criteria** (what must be TRUE):

  1. At 18:00 or later, when the last logged event is a wake, the Today screen predicts bedtime as the next event rather than nap start
  2. The wake-up prediction window is derived from both a historic hour-band and a duration-band (bedtime + typical sleep duration) unioned into a single wider window
  3. User can check "Intense day" in the event-entry form and see the flag stored per day in history; the forecaster applies an earlier bedtime modifier when the flag is set
  4. When no nap-start has been logged by the configured threshold hour, the Today screen bedtime prediction shifts earlier to reflect likely earlier tiredness on a no-nap day
  5. The nap prediction card shows a "% chance of nap today" score derived from stage-specific nap frequency, elapsed wake time, consecutive no-nap streak, and whether the nap window has already passed
  6. Prediction cards on Today screen appear in the order wake → nap start → nap end → bedtime in both collapsed and expanded states

**Plans**: 6/6 plans executed

- [x] 12-01-PLAN.md — Tracer: DB migration (4 new settings fields) + PRED-08 evening-hour rule + UI-07 card order fix + settings modal inputs/validation
- [x] 12-02-PLAN.md — TDD: annotateIntense in day-bucket.js (PRED-10 data model)
- [x] 12-03-PLAN.md — Execute: intense-day UI (checkbox in manual-entry, badge in history-screen, CSS)
- [x] 12-04-PLAN.md — TDD: PRED-09 wake duration-band union (computeDurationBand + union logic)
- [x] 12-05-PLAN.md — TDD: PRED-10 intense bedtime modifier + PRED-11 no-nap bedtime shift (subWindowBedtime, forecast context param)
- [x] 12-06-PLAN.md — Execute: PRED-12 nap probability score (napProbability fn + Today screen display)

**Completed**: 2026-08-25
**UI hint**: yes

### Phase 13: TIF Algorithm Extensions

**Goal**: The TIF algorithm includes ratio-based windows, rolling-window variants, per-window medians, and no-nap-day substitution, making TIF predictions more data-rich and situationally aware
**Depends on**: Phase 12 (intense-day and no-nap-day data model established)
**Requirements**: TIF-12, TIF-13, TIF-15, TIF-16
**Success Criteria** (what must be TRUE):

  1. When TIF is active, nap-start predictions include an additional ratio window from `activityBeforeNap / sleepDuration` anchored to wake time; nap-end predictions include a ratio window from `activityBeforeNap / napDuration` anchored to nap start
  2. Each TIF historical window includes a rolling variant using the last N days (configurable via a new `tifRollingDays` setting); when a day has explicit MA/AA values recorded, those take precedence over derived timestamp differences
  3. Each TIF event prediction displays a central time derived from the average of per-window medians; min/max intersection/union bounds remain unchanged
  4. On a day with no nap logged by the threshold hour, TIF substitutes day-length bands from historical no-nap days for bedtime prediction, and uses no-nap-day sleep/nap patterns for tomorrow's predictions

**Plans**: 4/4 plans executed

Plans:

- [x] 13-01-PLAN.md — Tracer: tifRollingDays settings wiring (db-shape, validate, UI, forecast-tif signature, today-screen call-site) (TIF-13)
- [x] 13-02-PLAN.md — TDD: per-window median (trimmedMinMax → buildHistoricBand → buildDurationBand → buildPrediction central) (TIF-15)
- [x] 13-03-PLAN.md — TDD: ratio-based windows for nap-start (MA/sleep) and nap-end (MA/nap) (TIF-12)
- [x] 13-04-PLAN.md — TDD: no-nap-day substitution (filtered bands for bedtime/wake, post-no-nap nap-start pattern) (TIF-16)

**Completed**: 2026-08-27

### Phase 14: TIF Metrics, Accuracy & Chart Fixes

**Goal**: The Metrics and Accuracy screens expose TIF-specific data and updated ratio metrics; the Wake & Bedtime Bands chart correctly displays all four event series without post-midnight duplicate dots
**Depends on**: Phase 13 (TIF per-window medians from TIF-15 consumed by MET-11 aggregates)
**Requirements**: TIF-14, MET-07, MET-08, MET-09, MET-10, MET-11, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):

  1. When TIF is the active algorithm, the Accuracy screen shows a TIF-specific grid with per-event-type window hit rate, average window width in minutes, and percentage of days with confidence score ≥ 80%
  2. The SAA column on the Metrics screen is replaced by a Day/Sleep Factor column (`dayLength / sleepDuration`); all tests and labels referencing "saa" are updated throughout
  3. When TIF is active, the Metrics screen shows the raw `[finalStart, finalEnd]` TIF bounds and confidence score per event type for the selected day alongside regular per-day metrics
  4. The Metrics screen shows a Nap Fraction column (`napDuration / combinedSleepNap`) and an AM/PM Split column (`activityBeforeNap / activityAfterNap`), both null on no-nap days or when either activity segment is absent
  5. The Metrics screen historical aggregates section shows `min-TIF`, `median-TIF`, and `max-TIF` rows per event type when TIF is active, derived from TIF window parameters
  6. The Wake & Bedtime Bands chart Y-axis is inverted (earlier times at bottom), shows nap-start and nap-end as two additional colored series with an updated legend, and renders each post-midnight event exactly once at its subjective-night time position

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 14-01-PLAN.md — TDD: dayToSleepFactor, napFraction, amPmSplit new ratio metrics + aggregateMetrics SAA removal (MET-07, MET-09, MET-10, D-12, D-14)
- [x] 14-02-PLAN.md — TDD: accuracy-tif.js (computeTifBoundsHistory, computeTifAccuracy) + sw.js PRECACHE_LIST (TIF-14, MET-08, MET-11)
- [x] 14-05-PLAN.md — Execute: buildTimeBandSeries 4-slot shape + charts-screen 4-series + inverted Y-axis + tests (UI-08, UI-09, UI-10)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-03-PLAN.md — Execute: metrics-screen.js COLUMNS 16-col overhaul + TIF inline columns + TIF aggregate rows (MET-07, MET-08, MET-09, MET-10, MET-11)
- [x] 14-04-PLAN.md — Execute: accuracy-screen.js isTif branch + buildTifAccuracyGrid (TIF-14)

**UI hint**: yes

### Phase 15: TIF Engine Bug Fixes

**Goal**: The TIF forecast engine and test suite are free of correctness bugs introduced after v1.3, so predictions are computed on the correct data set and the codebase is self-consistent
**Depends on**: Phase 14 (v1.3 complete)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):

  1. `findBedtimeDayRecord` selects the chronologically latest day record when slot entries mix bare `HH:MM` strings with ISO strings — verified by a unit test covering both string forms
  2. Rejected days excluded by the TIF pre-filter do not reduce the auto-trim budget; `manualExcludedCount` semantics are preserved — verified by a unit test confirming trim-budget independence
  3. `metrics-screen.js` render() obtains TIF event-time strings from data already computed in the same render cycle without a second `tifForecast` call — verified by code inspection confirming single invocation path
  4. The `computeTifTrimmedStats` comment in `metrics-screen.js` accurately describes that metric rows may contain bare `HH:MM` strings, so the `raw.length > 5` guard is not mistakenly dismissed as dead code
  5. The test in `settings-validate.test.js` that covers the `tifRollingDays` upper-bound reads "rejects 91 (above max=90)" and the full test suite passes

**Plans**: 2/2 plans executed

Plans:

- [x] 15-01-PLAN.md — forecast-tif.js: fix findBedtimeDayRecord bare/ISO ordering + manualExcludedCount semantics + unit tests (FIX-01, FIX-02)
- [x] 15-02-PLAN.md — metrics-screen.js: remove redundant tifForecast call, fix comment; settings-validate.test.js: fix stale test description (FIX-03, FIX-04, FIX-05)

### Phase 16: Rolling Window Aggregates

**Goal**: The Metrics screen gives users a 7-day and 14-day rolling view of all metric columns alongside all-time aggregates, so short-term trends are visible without scrolling to external tools
**Depends on**: Phase 15 (TIF pre-filter and render bugs resolved so aggregate inputs are clean)
**Requirements**: MET-09, MET-10
**Success Criteria** (what must be TRUE):

  1. The Metrics screen shows a 7-day rolling aggregate section (avg, min with date, max with date) for all base metric columns, computed from the 7 most recent non-rejected days in the active stage
  2. The Metrics screen shows a 14-day rolling aggregate section with the same column coverage, computed from the 14 most recent non-rejected days in the active stage
  3. The 7-day, 14-day, and all-time aggregate sections are visually distinguished from each other (distinct section headings or styling)
  4. When the active stage has fewer than 7 or 14 non-rejected days respectively, the corresponding rolling section renders `—` for all cells without errors

**Plans**: 1/1 plans executed

Plans:

- [x] 16-01-PLAN.md — Tracer: 7-day + 14-day rolling tbodies with section headers, cold-start behavior, CSS, and Playwright boundary tests (MET-09, MET-10)

**UI hint**: yes

### Phase 17: Day-of-Week Patterns

**Goal**: Users can inspect per-weekday averages for MA, AA, nap duration, and sleep duration in a collapsible Metrics screen section, revealing rhythm patterns across the week
**Depends on**: Phase 16 (rolling aggregate infrastructure in place)
**Requirements**: MET-11, MET-12
**Success Criteria** (what must be TRUE):

  1. `dayOfWeekAverages(dayRecords)` in `js/lib/metrics.js` (or a sibling module) groups non-rejected day records by weekday (Mon–Sun) and returns per-weekday averages for MA, AA, nap duration, and sleep duration — verified by unit tests
  2. The Metrics screen includes a collapsible "Day-of-Week Patterns" section with a 7-row Mon–Sun table showing per-weekday averages for MA, AA, nap duration, and sleep duration
  3. The section is scoped to the active stage (same filter as all other Metrics content)
  4. Weekdays with no non-rejected recorded data render `—` without errors

**Plans**: 1/1 plans executed

Plans:

- [x] 17-01-PLAN.md — Tracer/TDD: dayOfWeekAverages() + firstDayOfWeek schema + DoW section + CSS + Settings UI + E2E tests (MET-11, MET-12)

**UI hint**: yes
**Completed**: 2026-09-02

### Phase 18: Sleep Debt Proxy

**Goal**: Users can see a rolling 7-day accumulated sleep deficit column in the Metrics per-day table and aggregates, providing an observable signal of cumulative under-sleep
**Depends on**: Phase 17 (day-of-week patterns complete; metrics infrastructure stable)
**Requirements**: MET-13, MET-14
**Success Criteria** (what must be TRUE):

  1. `sleepDebtProxy(dayRecords, windowDays)` in `js/lib/metrics.js` (or a sibling module) returns a rolling accumulated sleep deficit (target total sleep minus actual total sleep, summed over `windowDays` non-rejected days), returning `null` when fewer than `windowDays` non-rejected records are available — verified by unit tests
  2. The Metrics screen per-day table includes a Sleep Debt column showing the rolling 7-day deficit in minutes; cold-start days (fewer than 7 prior non-rejected days) render `—`
  3. The all-time, 7-day, and 14-day aggregate sections include avg, min-with-date, and max-with-date rows for the Sleep Debt column

**Plans**: 3 plans

Plans:

- [ ] 18-01-PLAN.md — TDD: sleepDebtProxy() pure function + unit tests (MET-13)
- [ ] 18-02-PLAN.md — TDD: targetSleepMinutes setting schema, validation, Settings modal UI + median hint (MET-13)
- [ ] 18-03-PLAN.md — Execute: Sleep Debt column in Metrics screen + E2E test update (MET-14)

**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–8. Foundation → Accuracy | v1.0 | 46/46 | Complete | 2026-06-30 |
| 9. UX Polish | v1.1 | 6/6 | Complete | 2026-07-10 |
| 10. TIF Algorithm & Settings | v1.2 | 5/5 | Complete | 2026-07-13 |
| 11. Metrics Screen | v1.2 | 10/10 | Complete | 2026-07-30 |
| 12. Prediction Logic Refinements | v1.3 | 6/6 | Complete | 2026-08-25 |
| 13. TIF Algorithm Extensions | v1.3 | 4/4 | Complete | 2026-08-27 |
| 14. TIF Metrics, Accuracy & Chart Fixes | v1.3 | 5/5 | Complete | 2026-08-27 |
| 15. TIF Engine Bug Fixes | v1.4 | 2/2 | Complete    | 2026-08-31 |
| 16. Rolling Window Aggregates | v1.4 | 1/1 | Complete    | 2026-09-01 |
| 17. Day-of-Week Patterns | v1.4 | 1/1 | Complete   | 2026-09-02 |
| 18. Sleep Debt Proxy | v1.4 | 0/TBD | Not started | - |

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
