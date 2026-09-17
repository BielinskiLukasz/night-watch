---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Prediction Engine & Autosave (Phases 19–25)
current_phase: 24
current_phase_name: Autosave
status: executing
stopped_at: Completed 24-01-PLAN.md
last_updated: "2026-09-17T14:23:26.498Z"
last_activity: 2026-09-17
last_activity_desc: Phase 24 execution started
state_head: 6601bb05b8a8b768c2f107dde8965a314d5001ee
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 17
  completed_plans: 14
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** Given a sufficient history of sleep events, predict the next wake/bed/nap times accurately enough to be useful — with explicit uncertainty handling, precision scoring, and transparent accuracy tracking.

**Current focus:** Phase 24 — Autosave

## Current Position

Phase: 24 (Autosave) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-09-17 — Phase 24 execution started

## Phases

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 10 | TIF Algorithm & Settings | TIF-01..11 (11) | Complete |
| 11 | Metrics Screen | MET-01..06 (6) | Complete |
| 12 | Prediction Logic Refinements | PRED-08..12, UI-07 | Complete |
| 13 | TIF Algorithm Extensions | TIF-12, TIF-13, TIF-15, TIF-16 | Complete |
| 14 | TIF Metrics, Accuracy & Chart Fixes | TIF-14, MET-07..11, UI-08..10 | Complete |
| 15 | TIF Engine Bug Fixes | FIX-01..05 | Complete |
| 16 | Rolling Window Aggregates | MET-09, MET-10 | Complete |
| 17 | Day-of-Week Patterns | MET-11, MET-12 | Complete |
| 18 | Sleep Debt Proxy | MET-13, MET-14 | Complete |

## Performance Metrics

**Velocity:**

- Total plans completed: 6 (Phase NW-12)
- Average duration: ~17 min (plans 01–06)
- Total execution time: ~101 min

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 11 P02 | 12 | 2 tasks | 3 files |
| Phase 11 P04 | 5 | 3 tasks | 1 files |
| Phase 11 P05 | 10 | 3 tasks | 2 files |
| Phase 11 P06 | 12 | 2 tasks | 2 files |
| Phase 11 P07 | — | 2 tasks + fix | 2 files |
| Phase 11 P08 | 3 min 40 sec | 3 tasks | 3 files |
| Phase 11 P09 | 8 | 2 tasks | 1 files |
| Phase 11 P10 | 28 min | 2 tasks | 2 files |
| Phase NW-12 P01 | 10 | 1 tasks | 9 files |
| Phase NW-12 P02 | 14 | 3 tasks | 2 files |
| Phase NW-12 P04 | 17 | 3 tasks | 2 files |
| Phase NW-12 P03 | 5 | 2 tasks | 4 files |
| Phase NW-12 P05 | 30 | 3 tasks | 3 files |
| Phase NW-12 P06 | 25 | 2 tasks | 4 files |
| Phase NW-13 P01 | 12 | 2 tasks | 9 files |
| Phase NW-13 P02 | 8 | 3 tasks | 2 files |
| Phase NW-13 P03 | 5 | 3 tasks | 2 files |
| Phase NW-13 P04 | 7 | 3 tasks | 2 files |
| Phase NW-14 P01 | 4 | 3 tasks | 2 files |
| Phase NW-14 P02 | 8 | 3 tasks | 3 files |
| Phase NW-14 P05 | 9 | 2 tasks | 3 files |
| Phase NW-14 P03 | 9 | 3 tasks | 1 files |
| Phase NW-14 P04 | 7 | 2 tasks | 1 files |
| Phase NW-15 P01 | 14 | 3 tasks | 2 files |
| Phase NW-15 P02 | 14 | 3 tasks | 2 files |
| Phase NW-16 P01 | 30 | 2 tasks | 3 files |
| Phase NW-17 P01 | 18 | 3 tasks | 11 files |
| Phase 18 P18-01 | 3 | 1 tasks | 2 files |
| Phase 18 P18-03 | 10 | 2 tasks | 2 files |
| Phase 18 P04 | 12 | 2 tasks | 2 files |
| Phase 19 P01 | 8 | 3 tasks | 2 files |
| Phase 19 P02 | multi-session | 3 tasks | 7 files |
| Phase 20 P01 | 25 min | 2 tasks | 4 files |
| Phase 20 P02 | 8 | 2 tasks | 3 files |
| Phase 20 P03 | 25 | 2 tasks | 4 files |
| Phase 21 P01 | 45min | 2 tasks | 9 files |
| Phase 21 P02 | 28min | 3 tasks | 7 files |
| Phase 21 P03 | 25min | 2 tasks | 1 files |
| Phase 22 P01 | 45min | 2 tasks | 2 files |
| Phase 22 P02 | 20min | 1 tasks | 2 files |
| Phase 22 P03 | 25min | 2 tasks | 3 files |
| Phase 23 P01 | 20 min | 2 tasks | 3 files |
| Phase 23 P02 | 15 min | 2 tasks | 2 files |
| Phase 24 P01 | 20min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

- Phase 10: metrics.js is a shared dependency — build it as the first plan in Phase 10; Phase 11 reuses it
- Phase 10: TIF is additive only; classic forecast.js remains untouched and is the default
- Phase 11: Metrics screen is a new 5th bottom-nav tab (Today / History / Charts / Accuracy / Metrics)
- Phase 12 Plan 01: PRED-08 evening-hour override uses eveningHour=0/25 for CI-stable tests
- Phase 12 Plan 01: buildResult inner function in selectNextEvent shares isMissed logic between PRED-08 branch and switch
- Phase 12 Plan 02: JSDoc for .intense included in GREEN commit (no separate REFACTOR commit needed)
- Phase 12 Plan 04: durBand normalized via % 1440 in computeDurationBand — prevents backstop invariant violation when lastBedtime+duration exceeds 1440
- Phase 12 Plan 04: 3 existing forecast tests updated to wake-only days — PRED-09 union correctly widens sevenFullDays band past maxDelta, so hour-band-only tests now use bedtime:null
- Phase 12 Plan 03: intense-day pre-check uses existing.at for edit mode, dateInput.value for add mode
- Phase 12 Plan 03: settings.update guarded — only fires when intenseDays state actually changed
- Phase 12 Plan 05: PRED-11 takes precedence over PRED-10 when both conditions fire simultaneously (no-nap + evening + intense day)
- Phase 12 Plan 05: subWindowBedtime returns numeric minutes so callers can apply generateProbabilityBand before minutesToTime conversion
- Phase 12 Plan 06: calculatePercentiles callback must return HH:MM string not minutes; result shape is { min, central, max }
- Phase 12 Plan 06: napProbabilityScore attached to predictions.napStart before renderForecastSection; TIF algorithm benefits transparently
- [Phase 13]: D-06/D-07: tifRollingDays (default 7, range 3-30) replaces windowDays as TIF history slice via additive migration
- [Phase 13]: D-09/D-10: actBeforeNapPerDay index-aligned array; activityLog[d.date] overrides when non-null
- [Phase 13]: D-15: isNoNapDay resolved in today-screen.js (caller-resolved) to keep forecast-tif.js pure
- [Phase 13]: Phase 13 Plan 02: trimmedMinMax returns { min, max, median }; buildPrediction central = avg(window medians)
- [Phase 13]: Phase 13 Plan 03: MA/sleep ratio band uses actBeforeNap/sleepDuration projected by todaySleepDuration; MA/nap ratio band uses actBeforeNap/napDuration projected by todayMA; both guarded against null and division-by-zero
- [Phase 13]: Phase 13 Plan 04: isYesterdayNoNap derived from window[-2] inside tifForecast; noNapDayWindow/postNoNapWindow pre-computed before per-event band building
- [Phase 14]: D-12: dayToSleepFactor=dayLength/sleepDuration; napFraction=napDuration/combinedSleepNap; amPmSplit=activityBeforeNap/activityAfterNap — all null on missing/zero denominators
- [Phase 14]: D-14: sleepAfterActivityFactor removed from aggregateMetrics avg/min/max; stays exported and in per-row data for backward compat
- [Phase 14]: accuracy-tif.js imports only forecast-tif.js and forecast.js — never metrics.js (circular-import guard per CLAUDE.md)
- [Phase 14]: D-10: computeTifBoundsHistory uses tifRollingDays as minDays; null TIF bounds excluded from totals (not treated as miss)
- [Phase 14]: D-15/D-16/D-17: chart fixes — yScale inverted, 4-series nap/wake/bedtime dots, buildTimeBandSeries uses dayRecords.map
- [Phase 14]: D-09: 16-column order with napFraction/dayToSleepFactor/amPmSplit added, SAA removed
- [Phase 14]: TIF inline columns (12) and aggregate rows (3) use el.hidden = !isTif pattern
- [Phase 14 Plan 04]: TIF accuracy screen: isTif branch calls computeTifBoundsHistory+computeTifAccuracy; renderAccuracy/renderTifAccuracy helpers; buildTifAccuracyGrid extracts .pct from windowHit/highConf objects
- [Phase 15]: FIX-01: latestAt === null guard in findBedtimeDayRecord bare-string path prevents ISO-dated selection from being displaced by later bare-string entries
- [Phase 15]: FIX-02: rejectedInWindow = window.length - acceptedWindow.length threaded to all primary band-building calls; postNoNapNapStartTimes call retains 0
- [Phase 15]: FIX-03 (plan 02 removed the block; UAT revealed regression and restored it): override block in metrics-screen.js render() must call tifForecast and overwrite event-time columns in tifTrimmedStats with sourceWindows values — computeTifTrimmedStats uses plain trimmedMinMax with no rejection logic and diverges from Today screen
- [Phase 15]: FIX-03 day-order fix (UAT): override must pass `days` (newest-first, as daysBySubjectiveNight returns) NOT reversedDays — tifForecast uses slice(-N) internally so oldest-first input selects a different rolling window than Today screen
- [Phase 15]: FIX-04: computeTifTrimmedStats comment updated to clarify bare HH:MM and ISO string inputs both handled by raw.length > 5 guard
- [Phase 15]: FIX-05: settings-validate.test.js tifRollingDays upper-bound description corrected from 31 to 91
- [Phase 15]: UAT: Metrics summary row order changed to Min / Average / Max (Average between bounds)
- [Phase 16]: nonRejectedDays derived from stage-filtered reversedDays per D-08 prohibition
- [Phase 16]: buildRollingSection helper encapsulates cold-start note, TIF placeholders, and section-header row per D-09/D-10/D-05
- [Phase 17]: dayOfWeekAverages uses extractDate(day.wake) for weekday attribution — skips synthetic bare-string records
- [Phase 17]: Nap metrics only accumulate when day.napStart != null per D-02 (no-nap days excluded)
- [Phase 17]: DoW section built with no open attribute — native HTML details collapse resets on every replaceChildren rebuild
- [Phase 18]: Phase 18 Plan 01: sleepDebtProxy uses filter-then-slice null-exclusion rolling window; signed reduce (positive=deficit); null when < windowDays qualifying records (D-05, D-06, D-07)
- [Phase 18]: Phase 18 Plan 02: targetSleepMinutes default 600 (10h), validated as integer 1-1440, median hint via eventLog.daysBySubjectiveNight in Settings modal
- [Phase 18]: Phase 18 Plan 18-03: snap.targetSleepMinutes used directly (snap IS the settings object) — plan draft typo snap.settings.targetSleepMinutes corrected
- [Phase 18]: Phase 18 Plan 18-04: sliceOffset = Math.max(0, nonRejectedDays.length - nDays) applied before rolling sleepDebt loop so proxy receives full history
- [Phase 18]: Phase 18 Plan 18-04: COLUMNS[9].label changed from 'S.Debt' to 'S.Debt(7d)' to communicate rolling window scope to users
- [Phase 19]: Phase 19 Plan 01: percentileFromArray wraps percentile() with internal sort, pct 0-100 (D-16)
- [Phase 19]: Phase 19 Plan 01: buildNapGapSeries/buildNapDurationSeries return number[] not {min,central,max}; percentileFromArray is consumer in Plan 19-02
- [Phase 19]: Phase 19 Plan 01: buildBedtimeSeriesNapDay/NoNapDay return pure null on thin sub-windows; routing fallback delegated to Plan 19-02 (D-08)
- [Phase 19]: D-09: PRED-11 noNapFired block permanently removed from forecast(); split bedtime model supersedes it
- [Phase 19]: D-10: noNapBedtimeOffsetMinutes removed from DEFAULT_SETTINGS, migration, and validator
- [Phase 19]: D-13: todayWakeHHMM/napProbabilityScore/todayNapStartHHMM pre-computed before forecast() in today-screen.js
- [Phase 20]: [Phase 20 Plan 01]: napProbability() rewritten to {score,signalsUsed,confidence}; weight redistribution (D-01/D-02) covers 4 availability combinations
- [Phase 20]: [Phase 20 Plan 01]: dayOfWeekAverages() extended with napDays/totalDays counters (additive, non-breaking)
- [Phase 20]: Phase 20: Kept score===0 nap-window-closed UI ternary as-is (repointed to .score) — D-11/D-12 decoupled napWindowClosed flag not implemented in Plan 20-01, out of Plan 20-02 scope
- [Phase 20]: Phase 20 Plan 03: forecastDaysOldestFirst reversal in today-screen.js feeds napProbability()/tifForecast()/forecast() (CR-01); metrics-screen.js tifForecast override passes reversedDays
- [Phase 20]: Phase 20 Plan 03: today-screen.js todayDateStr uses formatLocalISO(new Date()) instead of toISOString() (CR-02)
- [Phase 21]: napProbability() decouples napWindowClosed from score; strict > against napStart P90 (D-03) — Finishes Phase 20 D-11/D-12; score never collapses to 0 solely from window closing
- [Phase 21]: bedtimeAfterWake keeps its own RESULT_TYPE literal in selectNextEvent; bedtimeAfterNap normalizes to 'bedtime' (D-07) — Preserves distinguishability for Plan 21-02's dual-hero rendering while keeping the single logged bedtime event type intact
- [Phase 21]: Phase 21 Plan 2: bedtimeAfterWake is computed via a selectBedtime/bedtimeTimes helper lifted out of the bedtimePred IIFE to forecast() function scope, so it reuses the same probability-band-check logic as bedtime while staying independent of its blended value
- [Phase 21]: Phase 21 Plan 2: hero card data-event-type maps bedtimeAfterWake -> 'bedtime' (LOGGABLE_EVENT_TYPE) distinct from the internal 'type' field, so E2E selectors keyed on the four real loggable event types keep working across hero and Later-Today cards
- [Phase 21]: Phase 21 Plan 2: Later-Today auto-expand (D-13) targets both .tif-card.collapsed and .probability-band.collapsed, so opening the section also auto-expands classic probability-band cards, not just TIF cards
- [Phase 21]: Phase 21 Plan 3: widened windowDays to 14 in the dual-hero E2E fixture so a nap-day sub-window and a >= minDays no-nap-day sub-window resolve simultaneously within one rolling window (predictions.napStart and predictions.bedtimeAfterWake both real data).
- [Phase 22]: Phase 22 Plan 01: toleranceMinutes reuses settings.maxDelta unchanged (D-01), eventAccuracyScore returns raw unrounded number (no object wrapper)
- [Phase 22]: Phase 22 Plan 01: bedtime nap-day/no-nap-day split classified by day's actual napStart (D-03/D-04), combined bedtime key kept as average
- [Phase 22]: Phase 22 Plan 01: band-mode days score via probabilityBand midpoint with approximatedCount tracking (D-06/D-07); overallScore = mean of daily means excluding zero-event days, never NaN (D-10)
- [Phase 22]: D-05: accuracy-tif.js's bedtime bucket split into bedtimeNapDay/bedtimeNoNapDay using the identical D-03 classification rule (actualDay.napStart != null), mirroring accuracy.js's split; computeTifBoundsHistory's entry shape stays unchanged (BASE_EVENT_TYPES vs EVENT_TYPES split)
- [Phase 22]: [Phase 22 Plan 03]: accuracy-screen.js rewritten for 6-row/1-col avgScore grid, overall headline (verbatim overallScore), approximated-score marker+footnote (D-07..D-11), TIF table bedtime split rows (D-05)
- [Phase 22]: [Phase 22 Plan 03]: .accuracyGrid CSS grid-template-columns updated auto 1fr 1fr 1fr -> auto 1fr to match the single-column avgScore layout (Rule 1 fix)
- [Phase 23]: Phase 23 Plan 01: buildTifPerDayTable iterates days (full history) not tifBoundsHistory as row source, to satisfy D-06 full-history requirement
- [Phase 23]: Phase 23 Plan 02: buildDayRow/buildRollingSection signatures narrowed to drop tifBoundsMap/isTif params that only fed the removed TIF columns; isTif/activityLog remain for the TIF aggregate rows and historic-band override (D-10)
- [Phase 24]: Phase 24 Plan 01: autosave.js's { picker, store } / { store } options-object seam mirrors createStorageLocal(key, ls) — default to real global, inject fakes in tests
- [Phase 24]: Phase 24 Plan 01: createIndexedDbHandleStore uses one object store ('handles') in db 'nightwatch-autosave' v1, one fixed key ('directoryHandle') — Claude's Discretion per 24-CONTEXT.md

### Quick Tasks Completed

| Date | Slug | Description |
|------|------|-------------|
| 2026-07-13 | tif-card-expand | Make TIF normal prediction cards collapsible with evidence windows on expand |
| 2026-08-03 | refactor-chart-data-js-to-reuse-sleepdur | Refactor chart-data.js to reuse sleepDuration and napDuration from metrics.js |
| 2026-08-03 | fix-saa-calculation-in-metrics-js-to-inc | Fix SAA calculation in metrics.js to include days without naps |
| 2026-08-03 | move-add-event-button-to-line-up-with-ot | Move 'Add events' button into quickLog row and rename |
| 2026-08-24 | update-phase-10-planning-artifacts-mark- | Update Phase 10 planning artifacts: mark TIF-01–TIF-11 [x] in REQUIREMENTS.md, update ROADMAP.md Phase 10 row to [x] Complete with 5/5 plans |
| 2026-08-28 | fix-tif-aggregate-rows-in-metrics-screen | Fix TIF aggregate rows in metrics screen: replace averages of algMin/algMax with per-column trimmedMinMax over the TIF rolling window, skipping rejected rows, covering all 16 metric columns not just event types |
| 2026-08-29 | move-algorithm-selector-to-top-of-foreca | Move algorithm selector to top of Forecast & Prediction fieldset; show/hide classic-only and TIF-only fields based on selection |
| 2026-09-08 | fix-sleepdebtproxy-to-use-overnight-pair | fix sleepDebtProxy to use overnight pairing (prevDay.bedtime → day.wake) matching aggregateMetrics Comb column |

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-09-17T14:23:22.427Z
Stopped at: Completed 24-01-PLAN.md
Resume file: None

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | nap-prob-mobile | investigating | 2026-09-08 | v1.4 |
| uat_gaps | NW-09-ux-polish/09-UAT.md | unknown (archived v1.1) | 2026-09-08 | v1.4 |
| uat_gaps | NW-04-history-screen-edit-delete/04-HUMAN-UAT.md | passed (archived v1.0) | 2026-09-08 | v1.4 |
| verification_gaps | NW-04-history-screen-edit-delete/04-VERIFICATION.md | human_needed (archived v1.0) | 2026-09-08 | v1.4 |
| deferred_items | NW-06-life-stages/deferred-items.md: CFG-01/02/09 failing tests | acknowledged (archived v1.0) | 2026-09-08 | v1.4 |

## Operator Next Steps

- Phase 23 (Metrics→Accuracy Column Migration) complete and verified — 2/2 plans, UI-11 fully satisfied, code review found 0 critical / 2 warnings / 3 info (no blockers), 880 unit/integration + 138 E2E tests passing. Next: `/gsd-discuss-phase 24` or `/gsd-plan-phase 24` for Phase 24 (Autosave).
- Follow-up (non-blocking): new `.tifPerDayTable` on the Accuracy screen has no horizontal-scroll wrapper for narrow/mobile viewports, and `.tifAccuracyTable` has no CSS styling of its own (23-REVIEW.md WR-01/WR-02).
- `workflow.security_enforcement` is on but no `23-SECURITY.md` exists yet — run `/gsd-secure-phase 23` before shipping if a security gate is desired for this phase.
- `workflow.ui_review` is on but no `23-UI-REVIEW.md` exists yet — run `/gsd-ui-review 23` if a UI audit is desired, given the new Accuracy screen table.
- Consider adding a regression unit test for `subWindowBedtime`'s midnight-wrap edge case (fixed during Phase 21 code review, WR-03 — no dedicated test yet).
- A flaky `tests/e2e/metrics.spec.js` timeout cluster (10 tests waiting on `.metricsTable`) appeared during Phase 22's wave 1/2 post-merge gates but did not reproduce during wave 3's full-suite run. Confirmed unrelated to Phase 22's files — worth a look if it recurs.
