---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: TIF Fixes & Metrics Depth (Phases 15–18) — ACTIVE</summary>
current_phase: 16
current_phase_name: Rolling Window Aggregates
status: executing
stopped_at: Completed NW-16-01-PLAN.md
last_updated: "2026-08-31T18:47:31.235Z"
last_activity: 2026-08-31
last_activity_desc: Phase NW-16 execution started
state_head: 4708130f9c69bdf201299f1f5eccca56269f41ed
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-31)

**Core value:** Given a sufficient history of sleep events, predict the next wake/bed/nap times accurately enough to be useful — with explicit uncertainty handling, precision scoring, and transparent accuracy tracking.

**Current focus:** Phase NW-16 — Rolling Window Aggregates

## Current Position

Phase: NW-16 (Rolling Window Aggregates) — EXECUTING
Plan: 1 of 1
Status: Executing Phase NW-16
Last activity: 2026-08-31 — Phase NW-16 execution started

## Phases

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 10 | TIF Algorithm & Settings | TIF-01..11 (11) | Complete |
| 11 | Metrics Screen | MET-01..06 (6) | Complete |
| 12 | Prediction Logic Refinements | PRED-08..12, UI-07 | Complete |
| 13 | TIF Algorithm Extensions | TIF-12, TIF-13, TIF-15, TIF-16 | Complete |
| 14 | TIF Metrics, Accuracy & Chart Fixes | TIF-14, MET-07..11, UI-08..10 | Complete |
| 15 | TIF Engine Bug Fixes | FIX-01..05 | Complete |
| 16 | Rolling Window Aggregates | MET-09, MET-10 | Not started |
| 17 | Day-of-Week Patterns | MET-11, MET-12 | Not started |
| 18 | Sleep Debt Proxy | MET-13, MET-14 | Not started |

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-08-31T18:47:30.362Z
Stopped at: Completed NW-16-01-PLAN.md
Resume file: None

## Operator Next Steps

- Run `/gsd-plan-phase 16` to plan Phase 16 (Rolling Window Aggregates)
