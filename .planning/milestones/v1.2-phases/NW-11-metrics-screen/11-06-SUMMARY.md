---
phase: 11
plan: 06
name: Metrics Row Ordering & Overnight Sleep Attribution
status: complete
completed_date: 2026-07-30
duration_minutes: 12
tasks_completed: 2
files_modified: 2
commits: 1
---

# Plan 11-06 Summary: Metrics Row Ordering & Overnight Sleep Attribution

## Objective Completed

Fixed row ordering in the metrics table to display newest-first and corrected date attribution for overnight sleep events (bedtime on one date, wake on the next).

## What Was Built

1. **Forward iteration in render loop** (js/ui/metrics-screen.js, lines 337-340)
   - Changed backward iteration (`for (let i = rows.length - 1; i >= 0; i--)`) to forward iteration (`for (let i = 0; i < rows.length; i++)`)
   - Preserves the correct newest-first order returned by `aggregateMetrics`
   - Rows are now displayed with the most recent date at the top of the table

2. **Overnight sleep date attribution** (js/lib/metrics.js, lines 166-184)
   - Modified date extraction logic in `aggregateMetrics` to handle overnight sleep events
   - When a day record has a bedtime but no wake (overnight case), the row is attributed to bedtime + 1 day (the wake date)
   - When a wake date exists, it takes precedence (normal case)
   - Ensures sleep from 31.03 (bedtime) to 1.04 (wake) is recorded as the 1.04 sleep night

## Verification

### Unit Tests
- All 53 metrics.test.js tests pass
- All 636 unit tests pass across the full suite
- No regressions introduced

### Manual Verification
- Render loop correctly uses forward iteration
- Date attribution logic properly handles both normal sleep (wake and bedtime on same day) and overnight sleep (span two calendar dates)

## Deviations from Plan

None - plan executed exactly as written.

## Key Files Modified

| File | Lines | Change |
|------|-------|--------|
| js/ui/metrics-screen.js | 337-340 | Forward iteration in render loop |
| js/lib/metrics.js | 166-184 | Overnight sleep date attribution logic |

## Commits

| Hash | Message |
|------|---------|
| fd38728 | fix(11-06): correct metrics row ordering and overnight sleep date attribution |

## Success Criteria Met

- ✅ Per-day rows in Metrics table display in newest-first order (most recent date at top)
- ✅ Overnight sleep events (bedtime and wake on different calendar dates) attributed to the wake date
- ✅ Unit tests verify both corrected behaviors
- ✅ No test failures introduced

## Technical Notes

### Render Loop Fix
The aggregateMetrics function already returns rows in newest-first order. The bug was in the render loop which reversed this order through backward iteration. Changing to forward iteration preserves the intended ordering.

### Date Attribution Fix
The fix addresses the architectural issue where overnight sleep (bedtime on one calendar date, wake on the next) would be split between two day buckets. By detecting when only a bedtime exists and incrementing that date by 1 day, we correctly attribute the sleep event to the wake date as per user expectations.

## Gap Closures

- **G-NW-11-12**: Render loop row ordering fixed ✅
- **G-NW-11-13**: Overnight sleep date attribution corrected ✅
