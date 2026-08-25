---
status: resolved
trigger: "G-NW-11-11: Time columns display only ':' instead of formatted times (e.g. '07:30')"
created: 2026-07-29T00:00:00Z
updated: 2026-08-24T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — extractTime() returns only 'HH:MM' time part, but formatTime() expects full 'YYYY-MM-DDTHH:MM' ISO string. String slicing at positions 11+ on a 5-char string returns empty strings, producing ':'

## Symptoms

expected: Time columns (Wake, Bedtime, Nap Start, Nap End) display formatted time strings like '07:30' or '7:30 AM'
actual: Time columns show only ':' — colon separator visible but no hour/minute digits
errors: None reported
reproduction: Observed in Metrics screen table during UAT
started: Phase NW-11 UAT
environment: Metrics screen, time column cells

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-07-29
  checked: js/lib/day-bucket.js buildDayRecord (lines 198-206)
  found: day records contain event objects with {id, type, at} where at='YYYY-MM-DDTHH:MM'. Example: wake = {id, type='wake', at='2026-07-29T07:30'}
  implication: aggregateMetrics receives these full-ISO-string event objects

- timestamp: 2026-07-29
  checked: js/lib/metrics.js extractTime (lines 22-28)
  found: When slot is an object with .at field, extractTime returns slot.at.slice(11), which extracts ONLY the time portion. Example: '2026-07-29T07:30'.slice(11) = '07:30' (5 chars)
  implication: row.wake, row.bedtime, row.napStart, row.napEnd in aggregateMetrics output are all 'HH:MM' strings, NOT full ISO strings

- timestamp: 2026-07-29
  checked: js/lib/time.js formatTime (lines 117-123)
  found: formatTime(at, timeFormat) expects 'at' in format 'YYYY-MM-DDTHH:MM' (16+ chars). It slices at.slice(11, 13) for hours and at.slice(14, 16) for minutes. When input is 'HH:MM' (5 chars), both slices return empty strings because indices 11-15 are beyond the string length
  implication: formatTime('07:30', '24h') returns `${''} : ${''} ` which renders as ':'

- timestamp: 2026-07-29
  checked: js/ui/metrics-screen.js formatCellValue (line 109-110)
  found: For time columns, formatCellValue calls formatTime(value, snap.timeFormat) where value comes from row.wake/bedtime/napStart/napEnd (which are 'HH:MM' strings from extractTime)
  implication: formatTime receives 'HH:MM' string when it expects 'YYYY-MM-DDTHH:MM' string

- timestamp: 2026-07-29
  checked: js/lib/metrics.js aggregateMetrics (lines 161-184)
  found: Rows are built by storing wake: extractTime(day.wake) || null (line 166). Since day.wake is {id, type, at: 'YYYY-MM-DDTHH:MM'}, extractTime returns only 'HH:MM'. These 'HH:MM' strings are stored as the raw time values in the output rows.
  implication: The time fields in aggregateMetrics output rows are 'HH:MM' strings, but formatTime() expects 'YYYY-MM-DDTHH:MM' strings for display formatting

- timestamp: 2026-07-29
  checked: js/lib/metrics.js extractTime JSDoc (line 22)
  found: extractTime is documented to return 'HH:MM' or null. This is by design because extractTime is used by duration calculation helpers (sleepDuration, napDuration, etc.) which need only the time part.
  implication: extractTime is the correct tool for duration calculations but the wrong tool for extracting display values. A separate function is needed for extracting full ISO strings for display.

## Resolution

root_cause: In aggregateMetrics() at lines 166-169, the time fields (wake, bedtime, napStart, napEnd) are populated using extractTime(day.wake) which intentionally returns only 'HH:MM'. This is correct for duration calculations but incorrect for display. When formatCellValue() in metrics-screen.js passes these 'HH:MM' strings to formatTime() at time.js, formatTime attempts to extract hours and minutes using slice(11,13) and slice(14,16) of a 5-character 'HH:MM' string, resulting in empty strings and producing ':' as output.

The mismatch: aggregateMetrics stores 'HH:MM' but formatTime expects 'YYYY-MM-DDTHH:MM'. 

The correct fix: aggregateMetrics should store the full ISO string (day.wake.at, day.bedtime.at, etc.) in the rows instead of extractTime(day.wake). The extractTime() function should remain as-is since it is correctly used by the duration helpers.

fix: In `aggregateMetrics()` (js/lib/metrics.js), changed wake/bedtime/napStart/napEnd row fields to store the full ISO string (`day.wake.at`) instead of `extractTime(day.wake)` ('HH:MM' only). `formatTime()` now receives the expected 'YYYY-MM-DDTHH:MM' format.
verification: All 647 unit tests pass; all 112 E2E tests pass (2026-08-24).
files_changed: [js/lib/metrics.js]
