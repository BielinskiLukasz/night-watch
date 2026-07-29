---
status: diagnosed
trigger: "Gap G-NW-11-13: Sleep night attributed to bedtime date instead of wake date"
symptoms_prefilled: true
goal: find_root_cause_only
created: 2026-07-29T13:00:00Z
updated: 2026-07-29T13:15:00Z
---

## Current Focus

**Root cause identified.** The bucketing strategy separates bedtime and wake events into different day records when they span a calendar boundary, violating the requirement that a single sleep night should be attributed to the wake date.

## Symptoms

**Expected:** Date column shows wake date (e.g., 1.04 for a night spanning 31.03→1.04)
**Actual:** Date column shows bedtime date (e.g., 31.03)
**Error:** None reported
**Reproduction:** Observed in Metrics screen — nights spanning calendar dates show bedtime date instead of wake date
**Timeline:** Discovered during Phase NW-11 UAT

## Evidence

### 1. Day Bucketing Separates Bedtime and Wake Events
- **File:** `js/lib/day-bucket.js` lines 97-104 (`subjectiveNightKey()`)
- **Finding:** The subjective-night bucketing rule groups events by:
  - Hour < cutoverHour (4) → rolls back to previous calendar day
  - Hour >= cutoverHour (4) → stays on current calendar day
- **Implication:** A bedtime at 22:30 (hour=22 >= 4) stays on its calendar date, but a wake at 07:30 next day (hour=7 >= 4) also stays on its calendar date → they end up in DIFFERENT day records

**Example:** Bedtime 31.03 22:30, Wake 01.04 07:30, cutoverHour=4
```
Bedtime: dateStr='2026-03-31', hour=22 >= 4 → key='2026-03-31'
Wake:    dateStr='2026-04-01', hour=7 >= 4 → key='2026-04-01'
Result: Two separate dayRecords, one per calendar date
```

### 2. Metrics Date Attribution Falls Back to Bedtime When Wake Absent
- **File:** `js/lib/metrics.js` line 163 in `aggregateMetrics()`
- **Code:** `date: extractDate(day.wake) || extractDate(day.bedtime) || null,`
- **Finding:** When bucketing separates bedtime and wake:
  - The 2026-03-31 dayRecord has only `bedtime`, no `wake`
  - extractDate(null) returns null, fallback to extractDate(bedtime)
  - Result: row.date = '2026-03-31' (the bedtime date)
- **Implication:** The metrics row for a bedtime-only record is attributed to the bedtime date, not the actual wake date on the next calendar day

### 3. Bucketing Assumption Breaks on Late Wakes
- **File:** `js/lib/day-bucket.js` lines 1-45 (design comments)
- **Convention (CLAUDE.md):** "Day boundary is a configurable sleep-cycle cutover hour (default ~04:00). One night = one day."
- **Finding:** The bucketing logic assumes events before cutover hour will be pulled back to the previous day. This works for:
  - Bedtime 22:30 (>= cutover) on day X → stays on day X ✓
  - Wake 03:00 (< cutover) on day X+1 → rolls back to day X ✓
  - Result: Both in day X's bucket ✓
- **Breaks for:** Late wakes after cutover hour
  - Bedtime 22:30 (>= cutover) on day X → stays on day X
  - Wake 07:30 (>= cutover) on day X+1 → stays on day X+1 ✗
  - Result: Separated into two buckets ✗

### 4. Metrics Screen Uses Bucketed Dates Without Correction
- **File:** `js/ui/metrics-screen.js` lines 176-177 in `buildDayRow()`
- **Code:** `const dateStr = dayMetrics.date || '—';`
- **Finding:** The UI directly renders the date from the aggregated metrics row, which came from bucketing. No attempt to correlate bedtime-only rows with their missing wake events.

## Root Cause

**The subjective-night bucketing strategy in `js/lib/day-bucket.js` assumes wakes will occur before the cutover hour (typically 04:00), allowing them to roll back into the previous day's bucket. When a wake occurs AFTER the cutover hour on the next calendar day (e.g., 07:30), it remains on its own calendar date, separating it from the bedtime in the previous day's bucket.**

**As a result:**
1. Bedtime 31.03 22:30 creates a day record with date='2026-03-31' (no wake present)
2. Wake 01.04 07:30 creates a separate day record with date='2026-04-01' (no bedtime present)
3. The metrics table shows two rows: one for bedtime (31.03) and one for wake (01.04)
4. The user sees the night sleep attributed to 31.03 (bedtime date) instead of 01.04 (wake date)

**This violates the requirement:** "Sleep night is attributed to the wake date — e.g. bedtime 31.03 + wake 1.04 is recorded as the 1.04 sleep night"

## Files Involved

- **`js/lib/day-bucket.js`** (lines 97-104): Bucketing rule separates late-wake events
- **`js/lib/metrics.js`** (line 163): Date attribution falls back to bedtime when wake unavailable
- **`js/ui/metrics-screen.js`** (lines 176-177): Renders bucketed date directly without correction

## Suggested Fix Direction

Two possible approaches:

1. **Fix bucketing:** Modify `subjectiveNightKey()` to recognize that a bedtime in the late evening should "claim" the next calendar day's wake event (if that wake occurs on the immediately following calendar date and the bedtime was on a calendar day boundary condition). This would require lookahead or post-processing.

2. **Fix date attribution:** In `aggregateMetrics()`, when a day record has only bedtime (no wake), infer that the wake will be the next day and use that as the date. This is simpler — check if `wake === null && bedtime !== null && extractTime(bedtime).hour >= some_threshold`, then attribute to the next calendar day.

3. **Fix display logic:** In the metrics screen, detect rows that represent only a bedtime event (wake=null, bedtime!=null) and correlate them with the next row's wake event, merging them into a single row attributed to the wake date.

The root cause is architectural: the bucketing strategy doesn't properly handle nights that span calendar boundaries when the wake is after the cutover hour.
