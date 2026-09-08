# Phase 13: TIF Algorithm Extensions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 13-TIF-Algorithm-Extensions
**Areas discussed:** Ratio window formula (TIF-12), Rolling window semantics (TIF-13), MA/AA field priority (TIF-13), No-nap substitution scope (TIF-16)

---

## Ratio window formula (TIF-12)

### Q1: Nap-start projection

| Option | Description | Selected |
|--------|-------------|----------|
| ratio × today_sleepDuration → projected MA → wakeAnchor + MA_band | Each historical MA/sleep ratio × most-recent sleep duration gives a projected MA. Trimmed min/max = nap-start band. Most contextual — adapts to tonight's sleep length. | ✓ |
| ratio × rolling_avg_sleepDuration → projected MA | Uses rolling average sleep duration as reference. More stable, less reactive. | |
| raw MA durations only — ratio is a label | Band is just trimmed historical MA durations. Simpler but ignores the ratio relationship. | |

**User's choice:** ratio × today_sleepDuration → projected MA → wakeAnchor + MA_band

---

### Q2: Nap-end projection

| Option | Description | Selected |
|--------|-------------|----------|
| ratio × today_MA → projected napDuration → napStartAnchor + napDur_band | Historical MA/napDuration ratio × today's actual MA = projected nap duration. | ✓ |
| ratio × rolling_avg_MA → projected napDuration | Uses rolling average MA as reference. More stable. | |
| ratio × today_sleepDuration → projected napDuration | Uses same reference as nap-start for symmetry. Less semantically meaningful. | |

**User's choice:** ratio × today_MA → projected napDuration → napStartAnchor + napDur_band

---

### Q3: today_MA resolution for nap-end window

| Option | Description | Selected |
|--------|-------------|----------|
| Actual MA if logged; fall back to napStartPred.central − wakeAnchor | Uses actual napStart−wake when known, predicted otherwise. Mirrors resolveAnchor pattern. | ✓ |
| Always use napStartPred.central − wakeAnchor | Simpler — no branching. | |

**User's choice:** Use actual MA if logged; fall back to napStartPred.central − wakeAnchor

---

### Q4: When today_sleepDuration unavailable

| Option | Description | Selected |
|--------|-------------|----------|
| Skip ratio window; fall back to historic + activity-before-nap windows only | Mirrors existing wakeAnchor guard pattern. | ✓ |
| Use rolling avg sleep duration as proxy | Adds a fallback calculation. | |

**User's choice:** Skip ratio window; nap-start falls back to existing windows only

---

## Rolling window semantics (TIF-13)

### Q1: Parallel vs. replacement

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel: each window gets a sibling rolling variant (doubles window count) | More data points, richer intersection. | |
| Replacement: tifRollingDays sets the base slice instead of windowDays | Simpler — one setting drives TIF window size. Less UI complexity. | ✓ |
| Both available — user toggle in Settings | More flexible but more settings surface. | |

**User's choice:** Replacement — tifRollingDays replaces windowDays as the TIF slice

---

### Q2: Default and range

| Option | Description | Selected |
|--------|-------------|----------|
| Default 14 days, range 7–30 | Two full weeks — captures weekend/weekday pattern. | |
| Default 7 days, range 3–30 | Matches current windowDays default. Preserves existing behavior. | ✓ |
| Default 28 days, range 7–60 | Month-scale window for stable patterns. | |

**User's choice:** Default 7 days, range 3–30

---

### Q3: Fallback when rolling slice < minDays

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to full window (windowDays) automatically | Same as current cold-start tolerance. | ✓ |
| Trigger cold-start fallback when rolling slice < minDays | Stricter gate. | |

**User's choice:** Fall back to full window (windowDays) automatically

---

## MA/AA field priority (TIF-13)

### Q1: Where does recorded MA live?

| Option | Description | Selected |
|--------|-------------|----------|
| activityLog[date] IS the recorded MA | Spreadsheet's 'Aktywność' column maps to activityLog. No new data model field needed. | ✓ |
| Add explicit ma/aa fields to day records | Heavier scope — requires CSV import changes and db-shape migration. | |
| MA/AA priority is defensive only — all current records derived | No current data has explicit MA values. | |

**User's choice:** activityLog[date] IS the recorded MA

---

### Q2: How does activityLog reach forecast-tif.js?

| Option | Description | Selected |
|--------|-------------|----------|
| Thread as 3rd param: tifForecast(dayRecords, settings, activityLog) | Minimal change — optional 3rd parameter. | ✓ |
| Inject into day records in day-bucket.js annotateActivity() | Cleaner API — metrics.js functions receive enriched day records. | |

**User's choice:** Thread through as 3rd param tifForecast(dayRecords, settings, activityLog)

---

### Q3: Is there a recorded AA?

| Option | Description | Selected |
|--------|-------------|----------|
| AA always derived — only MA has a recorded fallback | Spreadsheet's Aktywność column is MA. AA has no recorded analog. | ✓ |
| AA also has a recorded source — needs a separate field | No evidence of distinct AA column in CSV import. | |

**User's choice:** AA is always derived; only MA has a recorded fallback

---

### Q4: Which functions use activityLog?

| Option | Description | Selected |
|--------|-------------|----------|
| Only activityBeforeNap — scoped change | dayLength and combinedSleepNap continue using timestamp arithmetic. | ✓ |
| activityBeforeNap + dayLength (propagates via dependency chain) | If dayLength calls activityBeforeNap, update propagates automatically. | |

**User's choice:** Only activityBeforeNap — recorded MA replaces NS−W in that function only

---

## No-nap substitution scope (TIF-16)

### Q1: Threshold setting

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse eveningHour from Phase 12 | Same semantics as PRED-11. Consistent threshold across classic and TIF. | ✓ |
| Add separate tifNoNapThreshold setting | Independent tuning for TIF. More settings surface. | |

**User's choice:** Reuse eveningHour — no new setting

---

### Q2: Bedtime window substitution scope

| Option | Description | Selected |
|--------|-------------|----------|
| Replace day-length band's input: filter to no-nap-days only | Same formula, different data slice. Minimal code change. | ✓ |
| Add a second 'no-nap day-length band' window alongside existing | More windows, richer intersection. | |
| Replace ALL bedtime windows on no-nap days | Historic bedtime, day-length, and activity-after-nap all replaced. | |

**User's choice:** Filter dayLengths to no-nap-days only — replace input, not architecture

---

### Q3: Tomorrow's nap predictions

| Option | Description | Selected |
|--------|-------------|----------|
| Add 'post-no-nap window' to nap-start on the NEXT day | New source window alongside existing windows. | ✓ |
| Replace nap-start windows entirely with post-no-nap data | All existing windows swapped on next day. | |

**User's choice:** Add 'post-no-nap nap-start pattern' as an additional source window

---

### Q4: No-nap detection condition

| Option | Description | Selected |
|--------|-------------|----------|
| eveningHour-passed AND napStart not logged = no-nap mode | Same condition as PRED-11. tifForecast receives current clock time. | ✓ |
| Only trigger when full day record is complete | Post-facto — substitution applies only on completed days. | |

**User's choice:** eveningHour-passed AND napStart null = no-nap mode

---

### Q5: Sleep duration on no-nap nights

| Option | Description | Selected |
|--------|-------------|----------|
| Filter sleepDurations to post-no-nap nights for wake band | The sleep-length band uses only nights following no-nap days. | ✓ |
| Add separate 'post-no-nap sleep band' alongside regular sleep-length band | Both windows feed intersection. | |
| Sleep duration prediction unchanged on no-nap days | Only bedtime and tomorrow's nap affected. | |

**User's choice:** Filter sleepDurations to post-no-nap nights for the sleep-length band

---

## Claude's Discretion

- TIF-12 nap-end ratio window fallback when today_MA is null: skip window
- TIF-15 median computation: planner to confirm whether buildDurationBand exposes projected duration array or needs refactoring
- TIF-16 clock access inside tifForecast: planner to decide how current time reaches the function (settings snapshot, new parameter, or pre-computed flag from caller)

## Deferred Ideas

- Per-window median display in TIF card UI (TIF-15 adds median to shape; displaying it is Phase 14)
- Duration bands for classic forecaster (nap-start, nap-end, bedtime) — out of scope
- Post-no-nap nap-duration window — not explicitly required; defer to Phase 14 if needed
