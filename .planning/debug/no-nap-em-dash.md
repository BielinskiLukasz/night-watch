---
status: diagnosed
trigger: "G-NW-11-8: No-nap days show em-dash for Combined Sleep+Nap, Activity durations, and AAS instead of computing with nap=0"
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:15:00Z
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

**files_involved:**
- `js/lib/metrics.js`: functions `combinedSleepNap()`, `activityBeforeNap()`, `activityAfterNap()`, `totalActivity()`, `activityAfterSleepFactor()` all need conditional logic for no-nap case
- `js/ui/metrics-screen.js`: No change needed if metrics.js is fixed; formatCellValue() correctly renders null as em-dash

**fix_direction:** 
Modify the five metric functions in `js/lib/metrics.js` to handle the no-nap case:
1. `combinedSleepNap()`: return `sleepDuration(day) + 0` when sleep is non-null but nap is null
2. `activityBeforeNap()`: return 0 when no napStart (or return dayLength if the semantics are "total activity time")
3. `activityAfterNap()`: return 0 when no napEnd (or return 0 to parallel beforeNap)
4. `totalActivity()`: will then be `0 + 0 = 0` for no-nap, or compute correctly if beforeNap/afterNap return dayLength and 0
5. `activityAfterSleepFactor()`: will then be `totalActivity() / sleepDuration()`, no special logic needed once totalActivity is fixed

The exact semantics (whether activityBeforeNap/afterNap should be 0 or dayLength for no-nap days) depends on the domain: if a no-nap day means "I was awake the entire time with no nap break", then totalActivity should equal dayLength. If it means "I had no split-activity calculation", then totalActivity should be 0 or dayLength depending on interpretation. The UAT expects "Activity durations" to be computable, suggesting they should have non-null values.

---
