# Phase 19: Algorithm C & Settings Modal - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Create `js/lib/forecast-blend.js` exporting `blendForecast(dayRecords, snap)` — a new Algorithm C that returns the same top-level prediction shape as Classic and TIF, covering all 4 events (wake, bedtime, nap-start, nap-end). Add a three-option algorithm selector (Classic / TIF / Algorithm C) to the Settings modal with algorithm-specific fieldsets that show/hide per selection. Wire `forecast-blend.js` into `app.js`, add it to `PRECACHE_LIST`/`sw-precache.test.js`, add three new user settings (`blendWindowDays`, `blendTrimPct`, `blendShrinkage`), and write unit + E2E tests.

**Requirements this phase satisfies:** PRED-13, PRED-14, PRED-15, PRED-16, PRED-17, UI-12

</domain>

<decisions>
## Implementation Decisions

### Wake Prediction (Algorithm C)

- **D-01:** Dual-model median blend per NEW_ALG.md — Model A1: historic wake-up time-of-day band (P10/P50/P90 of raw wake times); Model A2: sleep-length projection (last bedtime + P10/P50/P90 of sleep durations). Final central = average of the two trimmed medians. — **Reversibility:** reversible

- **D-02:** Interval stability check for wake: if A1 interval and A2 interval overlap, use their intersection as the reported band; if the central lies outside the intersection, apply shrinkage: `final = (1 − blendShrinkage) × central + blendShrinkage × center(intersection)`. If no overlap: use union envelope `[min(A1.min, A2.min), max(A1.max, A2.max)]`, central unchanged. — **Reversibility:** reversible

### Bedtime Prediction (Algorithm C)

- **D-03:** Three-band blend — Model 1: historic bedtime band (P10/P50/P90 of raw bedtimes); Model 2: wake + day-length distribution (today's actual wake time + P10/P50/P90 of historical day lengths); Model 3: nap-end + AA distribution (today's actual nap-end + P10/P50/P90 of historical activity-after-nap durations). Central = average of the three trimmed medians. — **Reversibility:** reversible

- **D-04:** AA band anchor for bedtime: `today's actual nap-end time + P(AA durations)`. Falls back to historic-bedtime-only on no-nap days via the substitution rule in D-05. — **Reversibility:** reversible

- **D-05:** No-nap-day handling: always use three-band blend — substitute a separate no-nap-day historic bedtime band (P10/P50/P90 of bedtimes on days without a nap) for the AA band. Never collapse to two bands; never fall back to Classic algorithm. — **Reversibility:** reversible

- **D-06:** 3-interval stability check for bedtime: treat all three intervals as a group. If all three overlap (pairwise): use the triple intersection as the band; apply shrinkage if central lies outside. If any pair does not overlap: use the combined outer envelope `[min of all three mins, max of all three maxes]`, central unchanged. — **Reversibility:** reversible

### Nap Predictions (Algorithm C — Phase 19 local implementation)

- **D-07:** Wake-anchored gap series built locally in `forecast-blend.js` for Phase 19. Phase 20 extracts `buildNapGapSeries` into `forecast.js` and removes the local copy. Do not import from `forecast.js` for this logic in Phase 19; keep it self-contained. — **Reversibility:** reversible (Phase 20 refactors this)

- **D-08:** Nap-start: two-model blend. Model 1 = wake-anchored gap: `wakeAnchor + P10/P50/P90(napStart − wake)` gap distribution. Model 2 = historic nap-start time-of-day percentiles `P10/P50/P90(napStart times)`. Stability check applied per D-02 pattern (2 intervals). — **Reversibility:** reversible

- **D-09:** Nap-end: two-model blend. Model 1 = fully chained wake-anchored: `wakeAnchor + P(napGap) + P(napDuration)` (full chain, all percentile-projected). Model 2 = nap-start anchor + historic nap duration percentiles: `actualOrPredictedNapStart + P10/P50/P90(napDuration)`. Stability check applied per D-02 pattern. — **Reversibility:** reversible

- **D-10:** Nap-end Model 2 anchor: use today's actual logged nap-start time if it exists in the event log for today; otherwise fall back to the nap-start central prediction from blendForecast. More accurate once the nap has already started. — **Reversibility:** reversible

### Algorithm C User Settings

- **D-11:** `blendWindowDays` — new setting, default 90, valid range 14–180 (integers). Algorithm C uses this rolling window length independently of Classic's `windowDays`. Stored in `DEFAULT_SETTINGS` via additive migration in `db-shape.js`. — **Reversibility:** reversible

- **D-12:** `blendTrimPct` — new setting, default 25 (%), valid range 0–40 (integers). Controls the extreme-discard fraction before percentile computation in Algorithm C, matching NEW_ALG.md's "discard the most extreme 25%". Exposed in Settings under the Algorithm C fieldset. — **Reversibility:** reversible

- **D-13:** `blendShrinkage` — new setting, default 0.3, valid range 0.0–1.0 (step 0.05 for UI slider). Controls how aggressively the central prediction is pulled toward the intersection center when it falls outside. Exposed in Settings under the Algorithm C fieldset. — **Reversibility:** reversible

### Settings Modal UI (UI-12)

- **D-14:** Three-option algorithm selector at the top of the Forecast & Prediction fieldset (same position as the current Classic/TIF toggle per v1.3 placement). Options: Classic / TIF / Algorithm C. Selecting an algorithm shows only that algorithm's specific settings, hides the others. Classic settings (windowDays, etc.), TIF settings (tifRollingDays, precisionTarget, trimPct), and Algorithm C settings (blendWindowDays, blendTrimPct, blendShrinkage) all live in their own sub-groups. — **Reversibility:** costly — touches settings-validate.js, db-shape.js, settings modal HTML and JS; changing the grouping scheme later would require touching all three.

### Claude's Discretion

- The exact label text for the Algorithm C option in the selector (e.g., "Algorithm C", "Blend", "Multi-band") — Claude picks the clearest label.
- The specific HTML structure for the three settings sub-groups (fieldsets vs divs with `hidden` attribute vs `el.hidden = !isBlend` pattern) — follow the existing `el.hidden = !isTif` pattern from metrics-screen.js for consistency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Algorithm Specification
- `NEW_ALG.md` — Original algorithm design from user: dual-model wake blend (A1+A2), stability check (intersection/shrinkage), 90-day window, 25% trim. Primary source for Algorithm C math.

### Requirements
- `.planning/REQUIREMENTS.md` §PRED-13–PRED-17, UI-12 — Specific functional requirements for this phase.
- `.planning/ROADMAP.md` §Phase 19 — Full phase description including acceptance criteria and new files to create.

### Existing Algorithm Modules (structural patterns)
- `js/lib/forecast.js` — Exports `timeToMinutes`, `minutesToTime`, `calculatePercentiles`, `detectColdStart`, `downweightRejectedDays` — all reusable in `forecast-blend.js`. Study the module's header comment block for DST-safety conventions and the exported function signature pattern.
- `js/lib/forecast-tif.js` — Structural model for `forecast-blend.js`: own frozen config object, own `extractTime` helper, same top-level prediction shape, imports only what it needs from `forecast.js`.

### Settings & Schema
- `js/lib/db-shape.js` — `DEFAULT_SETTINGS` and additive migration pattern. New settings (`blendWindowDays`, `blendTrimPct`, `blendShrinkage`) must be added here as additive per-field defaults.
- `js/lib/settings-validate.js` — Validation patterns for new settings fields. Must add range validators for all three new settings. Also note circular-import guard: imports `DEFAULT_SETTINGS` from `db-shape.js` (not `settings.js`).

### Settings Modal UI Pattern
- `js/ui/today-screen.js` — Algorithm swap pattern: how `forecastAlgorithm` setting selects between `forecast`, `tifForecast`. The new `blendForecast` plugs into the same dispatch.
- `js/ui/settings-modal.js` (or equivalent) — Existing fieldset show/hide pattern for TIF settings (`el.hidden = !isTif`). Algorithm C settings follow the same pattern (`el.hidden = !isBlend`).

### Service Worker
- `sw.js` + `tests/unit/sw-precache.test.js` — `forecast-blend.js` must be added to `PRECACHE_LIST` and the test's exhaustive list.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calculatePercentiles(dayRecords, getTimeFn, rejectWeight?)` from `forecast.js` — returns `{ min, central, max }` as HH:MM strings; rejected-day downweighting built in. Use for all percentile bands in Algorithm C.
- `detectColdStart(dayRecords, minDays)` from `forecast.js` — cold-start guard; reuse in `blendForecast`.
- `timeToMinutes` / `minutesToTime` from `forecast.js` — DST-safe time arithmetic. All Algorithm C math stays in integer minutes.
- `downweightRejectedDays(dayRecords, weight)` from `forecast.js` — pre-filters/weights rejected days before percentile computation.

### Established Patterns
- **Same top-level prediction shape:** `blendForecast` must return `{ wake, bedtime, napStart, napEnd }` where each is `{ central, min, max }` as HH:MM strings (or null on cold-start). Same shape = `today-screen.js` swaps algorithms transparently.
- **Frozen config:** `const BLEND_CONFIG = Object.freeze({ ... })` at module top — per CLAUDE.md convention.
- **No DOM, no side effects in lib/:** `forecast-blend.js` is a pure function module. Clock access via injected `snap`; no `new Date()` calls.
- **`el.hidden = !isBlend` pattern** for settings fieldset show/hide — matches existing TIF pattern in settings modal.
- **Additive migration:** New settings in `db-shape.js` are injected per-field on every load (no version bump needed for purely additive changes).

### Integration Points
- `js/app.js` — Composition root: add `import { blendForecast } from './lib/forecast-blend.js'` and wire it into the algorithm selection dispatch alongside `forecast` and `tifForecast`.
- Settings modal: add three new setting rows under a new "Algorithm C" sub-group that shows when `forecastAlgorithm === 'blend'`.
- `sw.js` `PRECACHE_LIST` — add `js/lib/forecast-blend.js` entry.
- `tests/unit/sw-precache.test.js` — add matching entry to exhaustive list.

</code_context>

<specifics>
## Specific Ideas

- The shrinkage formula from NEW_ALG.md: `Final = (1 − blendShrinkage) × A + blendShrinkage × center(B_intersection)`. The user confirmed `blendShrinkage` should be user-configurable (default 0.3 matches NEW_ALG.md's example weight).
- Phase 20 will call `buildNapGapSeries` from `forecast.js`. Phase 19's local gap series in `forecast-blend.js` should be a drop-in that Phase 20 can extract without changing the call site interface.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-algorithm-c-settings-modal*
*Context gathered: 2026-09-14*
