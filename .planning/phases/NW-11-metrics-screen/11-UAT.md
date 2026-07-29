---
status: diagnosed
phase: NW-11-metrics-screen
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md]
started: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:20:00Z
---

## Current Test

number: 10
name: Tab Back Navigation Hides Metrics Screen
expected: |
  [testing complete]
awaiting: complete

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Clear ephemeral state. Start the app fresh with `npm run serve`. Server boots without errors. Opening http://localhost:8081 loads the app — Today screen shows with all tabs visible and no console errors. The new Metrics tab (5th) is visible in the bottom navigation.
result: pass

### 2. Metrics Tab Appears in Navigation
expected: The bottom navigation bar has exactly 5 tabs. The 5th tab is labelled "Metrics" with a 2×2 grid icon. It is visible and tappable.
result: pass

### 3. Metrics Screen Opens on Tab Click
expected: Clicking the Metrics tab shows the #metrics-screen section. The Today screen (and any other screen) becomes hidden. The Metrics screen is visible.
result: pass

### 4. Metrics Table Renders with 14 Columns
expected: After logging at least one sleep event, the Metrics screen shows a table. The table has 14 column headers: Date, Wake, Bedtime, Nap Start, Nap End, Sleep, Nap, Sleep+Nap, Day Length, Act Before Nap, Act After Nap, Total Activity, AAS, SAA (or similar labels). No empty/blank columns.
result: pass

### 5. Summary Aggregate Rows (Avg / Min / Max)
expected: At the top of the table body, three summary rows labelled "Avg", "Min", and "Max" appear above the per-day data rows. They are visually separated from the daily rows (e.g., a border or background tint).
result: pass

### 6. Duration Columns Formatted as "Xh Ym"
expected: Columns for Sleep duration, Nap duration, Combined Sleep+Nap, Day Length, and Activity durations display values like "7h 30m" — not raw minutes or decimal hours.
result: issue
reported: "column width is too small, duration wraps to two lines: 7h / 30m"
severity: cosmetic

### 7. Ratio Columns Show 2 Decimal Places
expected: The AAS (Activity After Sleep) and SAA (Sleep After Activity) columns display values with exactly 2 decimal places, e.g. "1.85". Not "1.8" or "1.852".
result: pass

### 8. No-Nap Days Show Em-Dash
expected: For a day that has no nap logged, the Nap, Nap Start, Nap End, and other nap-dependent columns show "—" (em-dash) rather than blank, 0, or an error.
result: issue
reported: "some columns that can be calculated with nap=0 show em-dash instead: Combined Sleep+Nap, Activity duration, AAS should use nap as 0 not treat as unavailable"
severity: major

### 9. Stage Badge Shows Current Stage
expected: The stage indicator (chip/badge above the table) shows the currently active stage name in the format "Viewing: {stage name}". When no stage is active (All), the badge is hidden or shows "All".
result: issue
reported: "no stage badge or stage-related UI visible on metrics screen despite having 1 ongoing stage created"
severity: major

### 10. Tab Back Navigation Hides Metrics Screen
expected: While viewing the Metrics screen, clicking any other tab (e.g., Today or History) hides the Metrics screen and shows the selected screen. The Metrics screen is not simultaneously visible with another screen.
result: pass

## Summary

total: 10
passed: 7
issues: 9
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-NW-11-6
  truth: "Duration values (e.g. '7h 30m') display on a single line in the metrics table"
  status: failed
  reason: "User reported: column width is too small, duration wraps to two lines: 7h / 30m"
  severity: cosmetic
  test: 6
  root_cause: "`.metricsTable td` CSS rule (style.css lines 1643-1648) is missing `white-space: nowrap`. The space in '7h 30m' causes the browser to wrap at the space character when the column is narrow."
  artifacts:
    - path: "style.css"
      issue: ".metricsTable td rule missing white-space: nowrap"
  missing:
    - "Add white-space: nowrap to .metricsTable td in style.css"
  debug_session: .planning/debug/duration-wraps.md

- gap_id: G-NW-11-8
  truth: "No-nap days show em-dash only for columns that genuinely require a nap (Nap Start, Nap End, Nap duration, SAA); Combined Sleep+Nap, Activity durations, and AAS are still computed using nap=0"
  status: failed
  reason: "User reported: some columns that can be calculated with nap=0 show em-dash instead: Combined Sleep+Nap, Activity duration, AAS should use nap as 0 not treat as unavailable"
  severity: major
  test: 8
  root_cause: "Five metric functions in js/lib/metrics.js unconditionally return null when nap times are missing: combinedSleepNap, activityBeforeNap, activityAfterNap, totalActivity, activityAfterSleepFactor. These cascade null upward and formatCellValue renders all nulls as em-dash. D11-04 requires em-dash only for Nap Start, Nap End, Nap duration, and SAA."
  artifacts:
    - path: "js/lib/metrics.js"
      issue: "combinedSleepNap, activityBeforeNap, activityAfterNap, totalActivity, activityAfterSleepFactor return null for no-nap days instead of computing with nap=0"
  missing:
    - "Add no-nap branch to combinedSleepNap: return sleepDuration when napDuration is null"
    - "Add no-nap branch to activityBeforeNap/activityAfterNap: return 0 when nap times are null"
    - "totalActivity and AAS will then compute correctly via cascade"
  debug_session: .planning/debug/no-nap-em-dash.md

- gap_id: G-NW-11-9
  truth: "Stage badge shows 'Viewing: {stage name}' above the metrics table when an active stage exists"
  status: failed
  reason: "User reported: no stage badge or stage-related UI visible on metrics screen despite having 1 ongoing stage created"
  severity: major
  test: 9
  root_cause: "Badge only shows when activeStageId is set via the Today screen dropdown — merely creating a stage is not enough. E2E test for badge visibility was explicitly deferred. The state sync between Today screen (sets activeStageId) and Metrics screen (reads it) was never integration-tested. Possible bug in renderStageBadge reading wrong settings field, or user did not select the stage from Today screen dropdown."
  artifacts:
    - path: "js/ui/metrics-screen.js"
      issue: "renderStageBadge() may not correctly read activeStageId from settings snapshot, or badge hidden attribute never removed"
    - path: "tests/e2e/metrics.spec.js"
      issue: "MET-06 badge test deferred — never implemented the activate-stage→verify-badge flow"
  missing:
    - "Add E2E test: create stage → select via Today screen dropdown → verify Metrics badge shows"
    - "Verify renderStageBadge reads correct settings field (activeStageId) and removes hidden attribute"
  debug_session: .planning/debug/stage-badge-hidden.md

- gap_id: G-NW-11-11
  truth: "Wake, Bedtime, Nap Start, and Nap End columns display formatted times (e.g. '07:30' or '7:30 AM')"
  status: failed
  reason: "User reported: time columns show only ':' — time values are not rendering, only the separator character is visible"
  severity: major
  test: 10
  root_cause: "aggregateMetrics() (metrics.js lines 166-169) stores extractTime() result ('HH:MM' string) in row.wake/bedtime/napStart/napEnd. But formatTime() in time.js expects a full ISO string ('YYYY-MM-DDTHH:MM') and slices at positions 11-13 and 14-16. A 5-char 'HH:MM' input produces empty slices → output is literally ':'."
  artifacts:
    - path: "js/lib/metrics.js"
      issue: "lines 166-169: stores extractTime(day.wake) ('HH:MM') instead of day.wake?.at (full ISO)"
    - path: "js/lib/time.js"
      issue: "formatTime() slices at positions 11-13/14-16 of ISO string; breaks on short 'HH:MM' input"
  missing:
    - "In aggregateMetrics(), change row time fields to use day.wake?.at || null (full ISO) instead of extractTime(day.wake)"
  debug_session: .planning/debug/time-columns-colon.md

- gap_id: G-NW-11-12
  truth: "Per-day rows are ordered most-recent-first (newest date at top)"
  status: failed
  reason: "User reported: newest record is the last row, should be on top"
  severity: major
  test: 10
  root_cause: "metrics-screen.js render loop (lines 337-340) iterates rows with a descending index (i = rows.length-1 down to 0) and appends each row. Because aggregateMetrics() already returns rows in newest-first order, the descending iteration reverses them to oldest-first."
  artifacts:
    - path: "js/ui/metrics-screen.js"
      issue: "lines 337-340: backward iteration loop reverses the correct newest-first order from aggregateMetrics"
  missing:
    - "Change render loop to forward iteration (i = 0 to rows.length-1) to preserve newest-first order"
  debug_session: .planning/debug/row-order-oldest-first.md

- gap_id: G-NW-11-13
  truth: "Sleep night is attributed to the wake date — e.g. bedtime 31.03 + wake 1.04 is recorded as the 1.04 sleep night, not 31.03"
  status: failed
  reason: "User reported: sleep shows as future date — for wake on 1.04 with bedtime 31.03, sleep is calculated for 1.04 instead of being associated with the 31.03→1.04 night"
  severity: major
  test: 10
  root_cause: "day-bucket.js bucketing rule (lines 97-104): events with hour >= cutoverHour stay on current calendar date. A late bedtime (22:30 on 31.03) and a late wake (07:30 on 01.04) land in separate day buckets. The 31.03 record has no wake, so metrics.js line 163 falls back to bedtime date (31.03) as the row date. Architectural mismatch: the cutover assumption expects wakes before 4AM."
  artifacts:
    - path: "js/lib/day-bucket.js"
      issue: "lines 97-104: bucketing separates bedtime and post-cutover wakes into different calendar-date buckets"
    - path: "js/lib/metrics.js"
      issue: "line 163: date attribution falls back to bedtime date when wake is absent"
  missing:
    - "Fix date attribution: infer wake date from the following day's bucket when bedtime-only record exists, or merge overnight pairs in bucketing"
  debug_session: .planning/debug/sleep-date-attribution.md

- gap_id: G-NW-11-14
  truth: "Column headers remain visible (sticky) when scrolling the metrics table vertically"
  status: failed
  reason: "User reported: header with column names should always be visible when scrolling the table — sticky header not working"
  severity: major
  test: 10
  root_cause: ".metricsTableScroll (style.css line 1603) has overflow-x: auto but no overflow-y + height constraint. CSS position: sticky on <th> requires a scroll container with a vertical scroll context. Without overflow-y and a height, the page scrolls (not the container) and sticky has no effect."
  artifacts:
    - path: "style.css"
      issue: "line 1603: .metricsTableScroll missing overflow-y: auto and max-height — no vertical scroll context for sticky to work"
  missing:
    - "Add overflow-y: auto and max-height (e.g. calc(100vh - 8rem)) to .metricsTableScroll"
  debug_session: .planning/debug/sticky-headers.md

- gap_id: G-NW-11-15
  truth: "Metrics table uses available horizontal space in landscape orientation (same margins as portrait)"
  status: failed
  reason: "User reported: table should take more space on horizontal view — margins in landscape are as wide as portrait, wasting screen space"
  severity: minor
  test: 10
  root_cause: "No @media (orientation: landscape) rules exist in style.css. body { padding: 1.5rem } (line 19-20) and #app { max-width: 32rem } (line 75-76) apply universally to both orientations."
  artifacts:
    - path: "style.css"
      issue: "lines 19-20, 75-76: body padding and #app max-width have no landscape overrides"
  missing:
    - "Add @media (orientation: landscape) rule to reduce body padding and/or increase #app max-width for metrics screen"
  debug_session: .planning/debug/landscape-margins.md

- gap_id: G-NW-11-16
  truth: "AAS = totalActivity / combinedSleepNap (activity divided by combined sleep+nap); SAA = combinedSleepNap / prevDay.totalActivity (combined divided by previous day activity)"
  status: failed
  reason: "User reported: AAS = Activity / Combined (not sleep alone); SAA = Combined / Activity — current formula may use sleepDuration instead of combinedSleepNap as the denominator/numerator"
  severity: major
  test: 10
  root_cause: "Design decisions D11-24/D11-25 misinterpreted REQUIREMENTS.md MET-04 'night-sleep duration' as sleepDuration only. Implementation correctly follows those decisions but they embed the wrong semantic. activityAfterSleepFactor uses sleepDuration; sleepAfterActivityFactor uses sleepDuration. User expects combinedSleepNap in both. combinedSleepNap() helper already exists but was never used in ratio formulas."
  artifacts:
    - path: "js/lib/metrics.js"
      issue: "lines 115-120: activityAfterSleepFactor divides by sleepDuration instead of combinedSleepNap"
    - path: "js/lib/metrics.js"
      issue: "lines 128-134: sleepAfterActivityFactor uses sleepDuration instead of combinedSleepNap"
  missing:
    - "Replace sleepDuration(day) with combinedSleepNap(day) in both activityAfterSleepFactor and sleepAfterActivityFactor"
    - "Update unit tests to reflect corrected formula"
  debug_session: .planning/debug/aas-saa-formula.md

## Deferred Follow-Ups

- test: 4
  idea: "Move Bedtime column after Nap End in the metrics table column order"
  deferred_at: 2026-07-29
