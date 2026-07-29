---
status: complete
phase: NW-11-metrics-screen
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md]
started: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:10:00Z
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
  artifacts: []
  missing: []

- gap_id: G-NW-11-8
  truth: "No-nap days show em-dash only for columns that genuinely require a nap (Nap Start, Nap End, Nap duration, SAA); Combined Sleep+Nap, Activity durations, and AAS are still computed using nap=0"
  status: failed
  reason: "User reported: some columns that can be calculated with nap=0 show em-dash instead: Combined Sleep+Nap, Activity duration, AAS should use nap as 0 not treat as unavailable"
  severity: major
  test: 8
  artifacts: []
  missing: []

- gap_id: G-NW-11-9
  truth: "Stage badge shows 'Viewing: {stage name}' above the metrics table when an active stage exists"
  status: failed
  reason: "User reported: no stage badge or stage-related UI visible on metrics screen despite having 1 ongoing stage created"
  severity: major
  test: 9
  artifacts: []
  missing: []

- gap_id: G-NW-11-11
  truth: "Wake, Bedtime, Nap Start, and Nap End columns display formatted times (e.g. '07:30' or '7:30 AM')"
  status: failed
  reason: "User reported: time columns show only ':' — time values are not rendering, only the separator character is visible"
  severity: major
  test: 10
  artifacts: []
  missing: []

- gap_id: G-NW-11-12
  truth: "Per-day rows are ordered most-recent-first (newest date at top)"
  status: failed
  reason: "User reported: newest record is the last row, should be on top"
  severity: major
  test: 10
  artifacts: []
  missing: []

- gap_id: G-NW-11-13
  truth: "Sleep night is attributed to the wake date — e.g. bedtime 31.03 + wake 1.04 is recorded as the 1.04 sleep night, not 31.03"
  status: failed
  reason: "User reported: sleep shows as future date — for wake on 1.04 with bedtime 31.03, sleep is calculated for 1.04 instead of being associated with the 31.03→1.04 night"
  severity: major
  test: 10
  artifacts: []
  missing: []

- gap_id: G-NW-11-14
  truth: "Column headers remain visible (sticky) when scrolling the metrics table vertically"
  status: failed
  reason: "User reported: header with column names should always be visible when scrolling the table — sticky header not working"
  severity: major
  test: 10
  artifacts: []
  missing: []

- gap_id: G-NW-11-15
  truth: "Metrics table uses available horizontal space in landscape orientation (same margins as portrait)"
  status: failed
  reason: "User reported: table should take more space on horizontal view — margins in landscape are as wide as portrait, wasting screen space"
  severity: minor
  test: 10
  artifacts: []
  missing: []

- gap_id: G-NW-11-16
  truth: "AAS = totalActivity / combinedSleepNap (activity divided by combined sleep+nap); SAA = combinedSleepNap / prevDay.totalActivity (combined divided by previous day activity)"
  status: failed
  reason: "User reported: AAS = Activity / Combined (not sleep alone); SAA = Combined / Activity — current formula may use sleepDuration instead of combinedSleepNap as the denominator/numerator"
  severity: major
  test: 10
  artifacts: []
  missing: []

## Deferred Follow-Ups

- test: 4
  idea: "Move Bedtime column after Nap End in the metrics table column order"
  deferred_at: 2026-07-29
