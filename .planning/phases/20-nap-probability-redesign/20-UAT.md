---
status: diagnosed
phase: 20-nap-probability-redesign
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md]
started: 2026-09-16T00:00:00Z
updated: 2026-09-18T01:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 4 items outstanding (tests 7, 10, 13, 14); diagnosing and fixing 3 reported issues first]

## Tests

### 1. NAP_SCORE_WEIGHTS rewritten to 4 keys, frozen, sums to 1.0
expected: NAP_SCORE_WEIGHTS has exactly four keys (napFrequency 0.35, dayOfWeekNapRate 0.30, sleepDebtSignal 0.20, noNapStreak 0.15), is Object.freeze'd, and sums to 1.0 within epsilon.
result: pass
source: automated

### 2. napProbability() returns structured object in all states
expected: napProbability() returns { score, signalsUsed, confidence } — never a bare number/null — across cold-start, window-closed, and normal states.
result: pass
source: automated

### 3. dayOfWeekNapRate signal available once enough history
expected: dayOfWeekNapRate is derived from dayOfWeekAverages()'s napDays/totalDays fields and becomes available once totalDays >= minDays.
result: pass
source: automated

### 4. sleepDebtSignal derived from sleep-debt proxy
expected: sleepDebtSignal is derived from sleepDebtProxy(dayRecords, 7, targetSleepMinutes), clamped to ±180min, and mapped linearly to 0-1.
result: pass
source: automated

### 5. Weight redistribution when a signal is unavailable
expected: When dayOfWeekNapRate and/or sleepDebtSignal are unavailable, their weight is proportionally redistributed across the remaining available signals.
result: pass
source: automated

### 6. Nap-probability signals are clock-invariant
expected: Identical history/settings/weekday inputs with different pre-window-close clock times produce identical nap-probability results.
result: pass
source: automated

### 7. Plan 20-01 — Nap Probability Signal Engine (auto-verified)
expected: |
  All 6 deliverables of the nap-probability signal engine rewrite are covered by
  passing automated tests:
  - NAP_SCORE_WEIGHTS rewritten to 4 keys (35/30/20/15), frozen, sums to 1.0
  - napProbability() returns { score, signalsUsed, confidence } in all states
  - dayOfWeekNapRate signal derived from dayOfWeekAverages() napDays/totalDays
  - sleepDebtSignal derived from sleepDebtProxy(), clamped and normalized
  - Weight redistribution across available signals when one is unavailable
  - The four signals are clock-invariant (no drift from time of day)
  Confirm this matches your understanding of what shipped.
result: [pending]

### 8. Bedtime blend reads the new score shape
expected: forecast.js's PRED-18/19 bedtime-blend guard and ratio calculation read napProbabilityScore.score instead of treating the field as a bare number.
result: pass
source: automated

### 9. Today-screen threads todayWeekday into nap probability
expected: today-screen.js computes todayWeekday (0=Sun..6=Sat) and threads it into the napProbability() call's context.
result: pass
source: automated

### 10. Nap probability displays correctly in the UI
expected: On the Today screen, both the hero card and the prediction card show the nap probability as "N% chance of nap today" (or "0% — nap window closed"), never the literal text "[object Object]%".
result: [pending]

### 11. Today-screen "today" date uses local wall-clock date
expected: today-screen.js's todayDateStr is computed via formatLocalISO, matching day.date's local-wall-clock convention rather than UTC toISOString() (which can roll to the wrong calendar day near midnight in negative UTC offsets).
result: pass
source: automated

### 12. Regression tests pin the day-ordering and date contracts
expected: New tests (forecast-ordering.test.js, time.test.js) pin the oldest-first day-ordering requirement and the local-date-vs-UTC divergence using real bucketer output, not hand-built fixtures.
result: pass
source: automated

### 13. Predictions track recent sleep trend (day-ordering fix)
expected: With more than 7 days of history logged and a clear recent shift in sleep pattern, the Today screen's predictions (wake/bedtime/nap forecasts) reflect the trend from the most recent days, not skewed toward the oldest logged days.
result: [pending]

### 14. Metrics screen historic band matches Today screen (day-ordering parity)
expected: If TIF is enabled in settings, the Metrics screen's "Historic ..." band values match what the Today screen computes for the same day, since both now feed the forecast functions the same oldest-first day ordering.
result: [pending]

### 15. Next predicted event detail visibility
expected: User can see details of the next predicted event, not just a vague "later today"; details should be shown for all predicted event types, including bedtime with/without nap as distinct cases.
result: issue
reported: "cannot see details of next predicted event (change later today to details and show details of all events, include bedtime with/without nap separation)"
severity: major

### 16. Bedtime prediction distinguishes with/without nap
expected: Bedtime prediction uses an algorithm appropriate to whether a nap occurred that day — e.g. bedtime-without-nap should not calculate past the nap activity window.
result: issue
reported: "bedtime prediction is calculated with same algorithm for bedtime with/without nap, and it should be different ones (bedtime without nap shouldnt calculate after nap activity window for example) [correct me if I'm wrong]"
severity: major

### 17. Accuracy tab table display on mobile
expected: On mobile, the Accuracy tab's table is usable — ideally horizontally scrollable like the Metrics tab, rather than broken/overflowing layout.
result: issue
reported: "on mobile accuracy tab table is not displaying correctly, could it be done like metrics (scrollable)"
severity: minor

## Summary

total: 17
passed: 10
issues: 3
pending: 4
skipped: 0

## Gaps

- gap_id: G-20-15
  truth: "User can see details of the next predicted event, with distinct bedtime-with-nap / bedtime-without-nap detail views"
  status: resolved
  resolved_by: 20-06-PLAN.md
  resolved_at: 2026-09-18
  reason: "User reported: cannot see details of next predicted event (change later today to details and show details of all events, include bedtime with/without nap separation)"
  severity: major
  test: 15
  root_cause: "today-screen.js's 'Later today' <details> section explicitly skips whatever type is shown in the hero card (heroTypes.has(type) continue at ~line 689), so the next event's own detail card never exists anywhere in the DOM. The hero card itself has no expand/detail affordance (unlike renderPredictionCard/renderTifNormalCard). When the hero shows a probabilityBand, it prints a dead-end string 'High uncertainty — see card' pointing at a card that was excluded. Separately, forecast.js already computes distinct bedtime (nap-day/blended/overall-routed) and bedtimeAfterWake series, but today-screen.js's EVENT_TYPE_LABEL maps both to the identical label 'Bedtime' with no with/without-nap distinction, and the routing branch that produced bedtimePred is discarded before being returned from forecast.js."
  artifacts:
    - path: "js/ui/today-screen.js"
      issue: "lines 82-90 (EVENT_TYPE_LABEL collapses bedtime/bedtimeAfterWake to same label), 168-242 (hero card has no detail/expand affordance), 676-726 (Later-today loop excludes hero's own type at ~689)"
    - path: "js/lib/forecast.js"
      issue: "lines 780-834 (bedtime routing branch computed but discarded before return), 871-878 (return shape)"
  missing:
    - "Give the hero card a detail/expand view reusing the existing detail-card renderer for its own type"
    - "Stop excluding the hero's own type from having a detail card available"
    - "Distinguish bedtime vs bedtimeAfterWake labels in the UI (e.g. 'Bedtime (if nap happens)' / 'Bedtime (no nap)')"
  debug_session: ""

- gap_id: G-20-16
  truth: "Bedtime prediction algorithm differs for with-nap vs without-nap days; without-nap should not calculate past the nap activity window"
  status: resolved
  resolved_by: 20-04-PLAN.md, 20-05-PLAN.md, 20-06-PLAN.md
  resolved_at: 2026-09-18
  reason: "User reported: bedtime prediction is calculated with same algorithm for bedtime with/without nap, and it should be different ones (bedtime without nap shouldnt calculate after nap activity window for example)"
  severity: major
  test: 16
  root_cause: "Three independent, additive defects, not one shared cause. (1) forecast.js:791-805 (classic/default algorithm) blends nap-day vs no-nap-day bedtime series by napProbabilityScore.score alone, never checking napProbabilityScore.napWindowClosed, so it keeps blending in nap-day statistics even after the nap window has objectively closed for the day. (2) today-screen.js:687-704's non-hero 'Later today' EVENT_TYPES list never includes bedtimeAfterWake (only the hero next-event card substitutes it correctly at ~644-646), so whenever bedtime isn't the immediate next event, the user only sees the blended value. (3) forecast-tif.js:699-702 (opt-in TIF algorithm) adds an 'Activity-after-nap band' unconditionally whenever napEndAnchor is not null, with no isNoNapDay gate at all — unlike its own Day-length band a few lines above (which does gate on isNoNapDay) and unlike forecast-blend.js:561-580 Model 3 which implements the identical concept correctly."
  severity: major
  artifacts:
    - path: "js/lib/forecast.js"
      issue: "lines 791-805: PRED-19 blend branch ignores napWindowClosed"
    - path: "js/ui/today-screen.js"
      issue: "lines 687-704: Later-today EVENT_TYPES list omits bedtimeAfterWake"
    - path: "js/lib/forecast-tif.js"
      issue: "lines 699-702: Activity-after-nap band missing isNoNapDay gate"
    - path: "js/lib/forecast-blend.js"
      issue: "lines 552-580: correct reference implementation (Model 3) to mirror"
  missing:
    - "Gate forecast.js's blend branch on napWindowClosed — route to pure buildBedtimeSeriesNoNapDay once true"
    - "Add bedtimeAfterWake handling to today-screen.js's Later-Today loop"
    - "Add the missing isNoNapDay gate to forecast-tif.js's Activity-after-nap band, mirroring forecast-blend.js"
  debug_session: ".planning/debug/bedtime-nap-same-algo.md"

- gap_id: G-20-17
  truth: "Accuracy tab table is usable on mobile, scrollable like the Metrics tab"
  status: resolved
  resolved_by: 20-07-PLAN.md
  resolved_at: 2026-09-18
  reason: "User reported: on mobile accuracy tab table is not displaying correctly, could it be done like metrics (scrollable)"
  severity: minor
  test: 17
  root_cause: "metrics-screen.js wraps its table in a .metricsTableScroll div (overflow-x/y: auto) that makes it horizontally scrollable on narrow viewports. accuracy-screen.js's renderTifAccuracy (~563-581) appends buildTifPerDayTable's .tifPerDayTable directly into section with no equivalent scroll-container wrapper, and style.css has no .tifPerDayTableScroll (or similar) class or overflow rule for it — the sticky-column/header CSS was mirrored from Metrics but the outer scroll wrapper was not."
  artifacts:
    - path: "js/ui/accuracy-screen.js"
      issue: "lines 563-581: table appended without a scroll-container wrapper div"
    - path: "style.css"
      issue: "no .tifPerDayTableScroll (or equivalent) rule near the .tifPerDayTable block (~1855); reference: .metricsTableScroll at lines 1737-1743"
  missing:
    - "Wrap buildTifPerDayTable's result in a scroll-container div (e.g. .tifPerDayTableScroll or reuse .metricsTableScroll) in renderTifAccuracy"
    - "Add matching overflow-x: auto CSS rule modeled on .metricsTableScroll"
  debug_session: ""
