# Phase 19: Split Bedtime & Wake-Anchored Nap - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Two targeted improvements to the Classic algorithm's bedtime and nap predictions:

1. **Split bedtime model (PRED-18, PRED-19):** Add `buildBedtimeSeriesNapDay(dayRecords)` and `buildBedtimeSeriesNoNapDay(dayRecords)` to `js/lib/forecast.js`. The Classic `forecast()` function routes bedtime prediction through the matching sub-series based on today's nap status (napStart logged = nap-day series; napStart not logged = blended by nap probability score). When score is null or a sub-series is too thin, fall back to the existing overall `calculatePercentiles`. Remove the PRED-11 evening no-nap contextual block entirely — it is superseded by the split model.

2. **Wake-anchored nap predictions (PRED-20, PRED-21, PRED-22):** Add `buildNapGapSeries(dayRecords)` and `buildNapDurationSeries(dayRecords)` to `js/lib/forecast.js`. Add `percentileFromArray(values, pct)` helper. Classic nap-start = `wakeAnchor + P10/P50/P90(gaps)`; Classic nap-end = `napStartAnchor + P10/P50/P90(durations)`. When no wake anchor exists, fall back to time-of-day percentiles.

**Requirements this phase satisfies:** PRED-18, PRED-19, PRED-20, PRED-21, PRED-22

</domain>

<decisions>
## Implementation Decisions

### Split Bedtime Functions (PRED-18)

- **D-01:** All four new functions (`buildBedtimeSeriesNapDay`, `buildBedtimeSeriesNoNapDay`, `buildNapGapSeries`, `buildNapDurationSeries`) go in `js/lib/forecast.js`, exported alongside existing helpers. Phase 25's `forecast-blend.js` will import what it needs from `forecast.js` directly. — **Reversibility:** reversible

- **D-02:** `buildBedtimeSeriesNapDay` and `buildBedtimeSeriesNoNapDay` return `{ min, central, max }` as integer minutes (same convention as `calculatePercentiles` internally). `forecast()` converts to HH:MM at the boundary using `minutesToTime`. — **Reversibility:** reversible

- **D-03:** `forecast()` routes bedtime selection inline in the existing bedtime prediction block — same structural pattern as the current PRED-11/PRED-10 if/else chain. No new wrapper function. — **Reversibility:** reversible

- **D-04:** A "nap day" in the history filter is any day where `napStart != null`. Consistent with how `napFrequency` signal counts nap days in `napProbability()`. — **Reversibility:** reversible

### PRED-19 Blend Mechanics

- **D-05:** When nap status is undetermined (napStart not yet logged), blend **central only** proportionally to the nap probability score: `central = (score/100) × napDay.central + (1 − score/100) × noNapDay.central`. The band takes the outer envelope: `min = Math.min(napDay.min, noNapDay.min)`, `max = Math.max(napDay.max, noNapDay.max)`. — **Reversibility:** reversible

- **D-06:** PRED-19 fires any time `napStart` is not logged today, regardless of current hour. No evening-hour gate. — **Reversibility:** reversible

- **D-07:** When `napProbabilityScore` is null (cold-start / insufficient data), fall back to the overall bedtime series (`calculatePercentiles` over all days) — preserves existing behavior as the cold-start fallback. — **Reversibility:** reversible

- **D-08:** When either sub-series has fewer records than `settings.minDays`, fall back to the overall bedtime series. Same cold-start guard pattern used elsewhere in `forecast.js`. — **Reversibility:** reversible

### PRED-11 Coexistence

- **D-09:** PRED-18/PRED-19 replaces PRED-11 entirely. Remove the `!napStartLogged && currentHour >= eveningHour` contextual block from `forecast()`. The split model captures the nap-day vs no-nap-day bedtime structure permanently, making the evening-hour override redundant. — **Reversibility:** costly — removes a user-visible behaviour; restoring requires re-adding the contextual block and all associated tests

- **D-10:** Remove `noNapBedtimeOffsetMinutes` from `DEFAULT_SETTINGS` in `db-shape.js` and from `settings-validate.js`. The split model uses the actual distribution instead of a fixed offset. — **Reversibility:** costly — any user who customized this setting loses it; reverting requires re-adding the field to schema and UI

- **D-11:** PRED-10 (intense-day bedtime shift) still applies. Intense day is orthogonal to nap status and can shift both nap-day and no-nap-day bedtimes. — **Reversibility:** reversible

- **D-12:** Bedtime prediction routing order in `forecast()`: (1) select series via PRED-18/19 split model (or fall back to overall series), (2) if `isIntenseToday`, apply `intenseDayOffsetMinutes` shift to the selected result. Split model runs first; PRED-10 stacks on top. — **Reversibility:** reversible

### Wake-Anchored Nap Predictions (PRED-20–22)

- **D-13:** Wake anchor comes from `context.todayWakeHHMM` — the same field already passed to `napProbability()`. `today-screen.js` must thread `todayWakeHHMM` through to `forecast()` context if not already doing so. — **Reversibility:** reversible

- **D-14:** When `context.todayWakeHHMM` is null (no wake logged yet today), fall back to time-of-day percentiles for nap-start (`calculatePercentiles` over napStart times) — old behavior as graceful degradation until wake is logged. — **Reversibility:** reversible

- **D-15:** Nap-end anchor: use today's actual logged `napStart` if it exists in today's events; otherwise use the nap-start central prediction from the PRED-21 computation. More accurate once the nap has already started. — **Reversibility:** reversible

- **D-16:** Add `percentileFromArray(values, pct)` as a new exported helper to `forecast.js`. Takes a sorted array of numbers and a percentile (0–100), returns the interpolated value. Used by nap-start and nap-end predictions over the gap/duration arrays. `calculatePercentiles` expects `dayRecords + getTimeFn` and does not fit raw number arrays. — **Reversibility:** reversible

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 19 — Full phase description with file targets and acceptance criteria
- `.planning/REQUIREMENTS.md` §PRED-18, PRED-19, PRED-20, PRED-21, PRED-22 — Specific functional requirements for this phase

### Core Algorithm Module
- `js/lib/forecast.js` — Primary file being extended. Study before editing: `calculatePercentiles`, `forecastEvent`, `subWindowBedtime`, the PRED-11 block (~line 604), the PRED-10 block, `napProbability`, `NAP_SCORE_WEIGHTS`. All four new functions go here as exports.

### Settings & Schema
- `js/lib/db-shape.js` — Remove `noNapBedtimeOffsetMinutes` from `DEFAULT_SETTINGS` (D-10)
- `js/lib/settings-validate.js` — Remove `noNapBedtimeOffsetMinutes` validator (D-10). Note circular-import guard: imports `DEFAULT_SETTINGS` from `db-shape.js`, not `settings.js`

### UI Integration
- `js/ui/today-screen.js` — Check that `todayWakeHHMM` is already threaded into the `context` object passed to `forecast()`; add it if not (D-13)

### Downstream Consumer (Phase 25)
- `.planning/phases/25-algorithm-c-settings-modal/25-CONTEXT.md` — Phase 25 D-07 confirms that `forecast-blend.js` will import `buildNapGapSeries` (and likely the bedtime series functions) from `forecast.js`. Phase 19's exports must be stable public API.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calculatePercentiles(dayRecords, getTimeFn, rejectWeight?)` from `forecast.js` — returns `{ min, central, max }` as integer minutes; use directly for both bedtime split series (pass a filtered sub-array and `d => extractTime(d.bedtime)`)
- `timeToMinutes` / `minutesToTime` from `forecast.js` — DST-safe arithmetic for all gap/duration math
- `subWindowBedtime` — still used by PRED-10 (intense days); `buildBedtimeSeriesNapDay/NoNapDay` follow the same sub-filter pattern but call `calculatePercentiles` directly on a pre-filtered array
- `extractTime` (module-private in `forecast.js`) — use the same pattern to extract HH:MM strings from dayRecord fields

### Established Patterns
- **Return shape:** All new series functions return `{ min, central, max }` as integer minutes — consistent with `calculatePercentiles`
- **Routing pattern:** The existing PRED-11/PRED-10 if/else chain in `forecast()` (~line 600) is the structural template for the new bedtime routing (D-12)
- **Context object:** `context.todayWakeHHMM` is already consumed by `napProbability()` — same shape, no new context fields needed for PRED-21
- **Cold-start guard:** Return early with `{ central: null, min: null, max: null }` when data is insufficient — same as `forecastEvent`

### Integration Points
- `forecast()` in `forecast.js` — bedtime prediction block and nap-start/nap-end predictions are the two sites being changed
- `js/lib/db-shape.js` `DEFAULT_SETTINGS` — remove `noNapBedtimeOffsetMinutes`
- `js/lib/settings-validate.js` — remove `noNapBedtimeOffsetMinutes` rule
- `js/ui/today-screen.js` — verify `todayWakeHHMM` threading into forecast context
- `tests/unit/forecast.test.js` — unit tests for split-series selection (nap-day vs no-nap-day routing), PRED-19 blend math, wake-anchor arithmetic, and the percentileFromArray helper

</code_context>

<specifics>
## Specific Ideas

- The PRED-11 block in `forecast.js` around line 604 is the exact structural reference for where the new split bedtime routing code goes. Removing it and replacing with the split model keeps the code structure familiar.
- `context.todayWakeHHMM` is already present — `napProbability()` accepts it as the last context field. The same field flows into `forecast()` context; no new plumbing needed in `today-screen.js` unless the field is currently not being passed to `forecast()`.
- `buildNapGapSeries` and `buildNapDurationSeries` return plain number arrays (gap in minutes, duration in minutes). `percentileFromArray` is the new utility that converts these to P10/P50/P90 values. Keep it simple: sort, index at `Math.floor(pct/100 * (n-1))`.
- Phase 25's `forecast-blend.js` will import `buildNapGapSeries` from `forecast.js` per D-07 of the Phase 25 context — the exported function signature must be stable (no renaming after Phase 19 ships).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-split-bedtime-wake-anchored-nap*
*Context gathered: 2026-09-14*
