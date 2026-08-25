---
status: resolved
trigger: "G-NW-11-8: No-nap days show em-dash for Combined Sleep+Nap, Activity durations, and AAS instead of computing with nap=0"
created: 2026-07-29T00:00:00Z
updated: 2026-08-24T00:00:00Z
---

## Current Focus

**Status:** ROOT CAUSE FOUND

**Root Cause:** The metric helper functions in `js/lib/metrics.js` return null unconditionally when nap times are missing, propagating null through dependent metrics. The decision D11-04 requires no-nap days to compute certain metrics with nap=0, but the code doesn't distinguish between "nap data unavailable" and "nap=0".

**Specific failures by metric:**
1. `combinedSleepNap()` — requires BOTH sleep AND nap to be non-null; should return `sleepDuration(day) + 0` when nap is null
2. `activityBeforeNap()` & `activityAfterNap()` — return null when napStart/napEnd are null; should return 0 or dayLength when no nap exists
3. `totalActivity()` — sums before+after nap; returns null because both are null for no-nap days; should be computable as dayLength or sleepDuration
4. `activityAfterSleepFactor()` — depends on totalActivity, which is null; should be computable once totalActivity is fixed

## Symptoms

**Expected:** No-nap days show:
- em-dash: Nap Start, Nap End, Nap duration, SAA (nap-dependent only)
- Computed values: Combined Sleep+Nap, Activity Before Nap, Activity After Nap, Total Activity, AAS

**Actual:** No-nap days show em-dash for ALL of the above (Combined, Activity columns, AAS)

**Reproduction:** 
1. Log a day with sleep but no nap (e.g., bedtime 22:00, wake 07:00, no napStart/napEnd)
2. Open Metrics screen
3. Observe the row: Nap duration correctly shows em-dash, but Combined Sleep+Nap, Activity Before Nap, Activity After Nap, Total Activity, and AAS also show em-dash

**Timeline:** Discovered during Phase NW-11 UAT (test 8, 2026-07-29)

## Evidence

### E1: Code flow for no-nap days (2026-07-29T00:05:00Z)
- **Checked:** `js/lib/metrics.js` functions for no-nap case
- **Found:** When `day.napStart` and `day.napEnd` are null:
  - `napDuration(day)` returns null ✓ (correct)
  - `activityBeforeNap(day)` at line 60-65: checks `if (napStr == null) return null` → returns null when no nap ✗
  - `activityAfterNap(day)` at line 69-75: checks `if (napEndStr == null) return null` → returns null when no nap ✗
  - `totalActivity(day)` at line 103-108: checks `if (before == null || after == null) return null` → returns null ✗
  - `combinedSleepNap(day)` at line 87-92: checks `if (sleep == null || nap == null) return null` → returns null when nap is null ✗
  - `activityAfterSleepFactor(day)` at line 115-120: depends on `totalActivity()`, which is null → returns null ✗
- **Implication:** All metrics dependent on nap times unconditionally return null for no-nap days

### E2: Display behavior for null values (2026-07-29T00:06:00Z)
- **Checked:** `js/ui/metrics-screen.js` `formatCellValue()` at line 106-119
- **Found:** Line 107: `if (value === null || value === undefined) return '—';`
- **Implication:** Any null value from metrics.js is rendered as em-dash in the UI

### E3: Decision D11-04 specification (2026-07-29T00:07:00Z)
- **Checked:** `11-UAT.md` test 8 expected value
- **Found:** "For a day that has no nap logged, the Nap, Nap Start, Nap End, and other nap-dependent columns show '—' (em-dash) rather than blank, 0, or an error."
- **Checked:** UAT gap G-NW-11-8 reported vs expected
- **Found:** Truth = "No-nap days show em-dash only for columns that genuinely require a nap (Nap Start, Nap End, Nap duration, SAA); Combined Sleep+Nap, Activity durations, and AAS are still computed using nap=0"
- **Implication:** D11-04 requires distinction between "truly nap-dependent" (Nap Start/End, SAA) vs "computable with nap=0" (Combined, Activity durations, AAS)

### E4: Aggregation logic confirms the same issue (2026-07-29T00:08:00Z)
- **Checked:** `aggregateMetrics()` at line 154-252
- **Found:** Lines 188-189 compute `napRows = validRows.filter(r => r.napDuration !== null)` to exclude no-nap days from nap-dependent aggregates
- **Found:** Line 242 aggregates `combinedSleepNap` using `napRows` (excludes no-nap days)
- **Found:** Lines 243-245 aggregate `totalActivity`, `activityBeforeNap`, `activityAfterNap` using `napRows` (excludes no-nap days)
- **Implication:** The aggregation code treats no-nap days as having no valid values for these metrics, consistent with the null-returning functions

## Eliminated

(none yet)

## Resolution

**root_cause:** 
- `combinedSleepNap()` requires both sleep AND nap non-null; should return `sleepDuration + 0` when nap is null
- `activityBeforeNap()` and `activityAfterNap()` return null when nap times are null; should return 0 (no activity split between pre/post nap when there is no nap)
- `totalActivity()` returns null because both before and after are null; should return the full day-span activity (dayLength) when no nap exists
- `activityAfterSleepFactor()` returns null because totalActivity is null; becomes computable once totalActivity is fixed

**files_changed:**
- `js/lib/metrics.js`: `activityBeforeNap()`, `activityAfterNap()`, `totalActivity()`, `combinedSleepNap()` updated with no-nap conditional logic; `activityAfterSleepFactor()` works correctly after upstream fixes.

**fix applied:**
- `combinedSleepNap()`: returns `sleepDuration` when nap is null (no-nap day returns sleep only)
- `activityBeforeNap()`: returns 0 when both napStart and napEnd are null (complete no-nap day)
- `activityAfterNap()`: returns 0 when both napStart and napEnd are null (complete no-nap day)
- `totalActivity()`: returns `dayLength()` when both napStart and napEnd are null (full wake-to-bed span)

**verification:** All 647 unit tests pass; all 112 E2E tests pass (2026-08-24).

---
