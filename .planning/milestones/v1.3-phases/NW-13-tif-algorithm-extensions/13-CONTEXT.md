# Phase 13: TIF Algorithm Extensions - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure algorithm work inside `js/lib/forecast-tif.js` (and minimal changes to `js/lib/metrics.js` and `js/lib/day-bucket.js` call sites). Four requirements add:
- TIF-12: Two new ratio-based source windows for nap-start and nap-end predictions
- TIF-13: `tifRollingDays` setting replaces `windowDays` as the TIF history slice; MA priority over derived timestamps
- TIF-15: Per-window median; central time = average of per-window medians (not midpoint of display range)
- TIF-16: No-nap-day substitution — filter window inputs to no-nap history when eveningHour passed and napStart null

No new screens. No changes to classic `forecast.js`. No new data model fields.

Requirements in scope: TIF-12, TIF-13, TIF-15, TIF-16.

</domain>

<decisions>
## Implementation Decisions

### TIF-12: Ratio window projection formula

- **D-01:** Nap-start ratio window formula: for each historical day in the TIF window, compute `ratio_i = activityBeforeNap_i / sleepDuration_i`. Multiply each ratio by `today_sleepDuration` to get a projected MA duration. Apply `buildDurationBand` with these projected durations anchored to `wakeAnchor`. Label: `'MA/sleep ratio band'`. — **Reversibility:** reversible

- **D-02:** Nap-end ratio window formula: for each historical day, compute `ratio_i = activityBeforeNap_i / napDuration_i`. Multiply by `today_MA` to get a projected nap duration. Apply `buildDurationBand` with these projected durations anchored to `napStartAnchor`. Label: `'MA/nap ratio band'`. — **Reversibility:** reversible

- **D-03:** `today_MA` resolution for the nap-end window: use `napStart_actual − wake_actual` if both are logged; fall back to `napStartPred.central − wakeAnchor` (derived from predictions). Mirror `resolveAnchor` pattern. — **Reversibility:** reversible

- **D-04:** When `today_sleepDuration` is unavailable (bedtime not yet logged this cycle), skip the nap-start ratio window entirely. Nap-start falls back to existing windows (historic nap-start + activity-before-nap). Same degradation pattern as current `wakeAnchor` guard. — **Reversibility:** reversible

- **D-05:** Ratio window placement in the window array: nap-start ratio window added AFTER the existing historic and activity-before-nap windows (last in list). Nap-end ratio window added AFTER existing historic and nap-length windows. — **Reversibility:** reversible

### TIF-13: Rolling window and MA priority

- **D-06:** `tifRollingDays` REPLACES `windowDays` as the slice length for TIF. The `tifForecast` function takes the last `tifRollingDays` records (not `windowDays`). `windowDays` continues to drive the classic algorithm unchanged. — **Reversibility:** reversible

- **D-07:** Default `tifRollingDays`: 7 days. Valid range: 3–30. Added as new settings field via additive migration in `db-shape.js`. Placed in the Forecast section of Settings modal alongside existing TIF settings (trimPct, precisionTarget). — **Reversibility:** reversible

- **D-08:** When the available history contains fewer records than `tifRollingDays`, use whatever records exist (same as current cold-start tolerance). No extra gate — the existing `detectColdStart` / `minDays` guard handles the true cold-start case. — **Reversibility:** reversible

- **D-09:** MA priority over derived timestamps: `activityLog[day.date]` IS the recorded MA. When present, use it in place of `napStart − wake` for that day's `activityBeforeNap` value inside `tifForecast`. AA always derived from timestamps; `activityAfterNap` unchanged. — **Reversibility:** reversible

- **D-10:** `activityLog` flows into `tifForecast` as a 3rd optional parameter: `tifForecast(dayRecords, settings, activityLog = {})`. Inside the function, when computing `actBeforeNap` array from the window slice, check `activityLog[d.date]` first; fall back to `activityBeforeNap(d)` from `metrics.js`. No changes to `activityBeforeNap()` function signature — the override happens inline inside `tifForecast`. — **Reversibility:** reversible — **only** `activityBeforeNap` values are overridden; no other metrics functions change.

### TIF-15: Per-window median and new central time

- **D-11:** Each source window (both `buildHistoricBand` and `buildDurationBand` outputs) must carry a `median` value in addition to `min` and `max`. Add `median: number` to the `labelledWindows` entries fed to `buildPrediction`. — **Reversibility:** reversible

- **D-12:** `buildPrediction` central time: `central = average of medians across all active source windows` (not midpoint of display range). When only one window is active, central = that window's median. When no median is available for a window (single-value window), use the single value as its median. — **Reversibility:** reversible — changes the displayed central time value for all TIF predictions; previously midpoint of intersection/union.

- **D-13:** Median computation per window type:
  - `buildHistoricBand(times, ...)`: median = P50 of the trimmed array (after trim is applied).
  - `buildDurationBand(durations, anchorMinutes, ...)`: median = `anchor + P50(projectedDurations)` where projected durations = `duration * reference` for ratio windows, or raw durations for standard windows.
  — **Reversibility:** reversible

- **D-14:** `sourceWindows` shape gains `median: string` (HH:MM) so the UI can render it if needed. The `nullPrediction()` shape gains `median: null` for each window. — **Reversibility:** reversible

### TIF-16: No-nap-day substitution

- **D-15:** No-nap detection condition: `eveningHour` has passed (from settings, same as PRED-11 in Phase 12) AND today's `napStart` is null. `tifForecast` receives the current clock time (already available via `settings` or as a parameter — planner to confirm call site). No new setting; reuse `eveningHour`. — **Reversibility:** reversible

- **D-16:** Bedtime prediction on a no-nap day: filter `dayLengths` array to only days where `napStart` was null before building the day-length band. The existing `buildDurationBand(dayLengths, wakeAnchor2, ...)` call uses this filtered array. Label changes to `'Day-length band (no-nap days)'`. — **Reversibility:** reversible

- **D-17:** Wake prediction on a no-nap day: filter `sleepDurations` to only nights that followed a no-nap day (i.e., the previous day had `napStart === null`) before building the sleep-length band. Label changes to `'Post-no-nap sleep-length band'`. Combined-band window (sleepDurations + napDuration correction) is skipped on no-nap days (nap duration irrelevant when no nap occurred). — **Reversibility:** reversible

- **D-18:** Tomorrow's nap-start prediction on the day AFTER a no-nap day: add a new source window `'Post-no-nap nap-start pattern'` built from nap-start times on days immediately following a historical no-nap day. Added alongside existing nap-start windows (not replacing). The planner must determine how `tifForecast` detects "today is the day after a no-nap day" — likely by checking whether yesterday's record has `napStart === null`. — **Reversibility:** reversible

- **D-19:** Fallback when the no-nap-day sub-window is too small (fewer days than `minDays`): fall back to using the full window (all days) for that specific band, same as the existing thin-history degradation pattern. No hard gate. — **Reversibility:** reversible

### Claude's Discretion

- **TIF-12 nap-end ratio window fallback when today_MA is null:** If both actual napStart and wakeAnchor are unavailable (can't derive today_MA), skip the nap-end ratio window. Planner to implement.
- **TIF-15 median for ratio windows:** The projected values (ratios × reference) are the array to take P50 from. Planner to verify whether `buildDurationBand` returns the projected array or only min/max — may need refactor to expose the sorted intermediate values.
- **TIF-16 clock access inside tifForecast:** The function is currently pure (no clock access). How the current time reaches it for no-nap detection (via settings snapshot, via a new `now` parameter, or via pre-computation in the caller) is the planner's decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §TIF-12, TIF-13, TIF-15, TIF-16 — exact requirement text and success criteria
- `.planning/ROADMAP.md` §"Phase 13: TIF Algorithm Extensions" — goal, success criteria, plan estimates

### Prediction domain knowledge
- `.planning/PREDICTION-FEATURES.md` — MA/AA definitions (Morning/Afternoon Activity), ratio formulas, predictor tables per event type. Key for understanding why ratio windows are semantically meaningful.

### Architecture references
- `CLAUDE.md` §Architecture — module roles, cross-file invariants, pitfalls. Pay attention to: metrics.js circular-import guard, adapter injection pattern, XSS guard.
- `CLAUDE.md` §"Pitfalls & non-obvious invariants" — time strings are local wall-clock, never UTC; `metrics.js` circular-import guard.

### Key source files
- `js/lib/forecast-tif.js` — main file being extended; all 4 requirements land here
- `js/lib/metrics.js` — `activityBeforeNap`, `activityAfterNap`, `sleepDuration`, `napDuration` used by TIF-12 and TIF-16
- `js/lib/db-shape.js` — additive migration pattern for `tifRollingDays` setting
- `js/store/event-log.js` — `getActivityLog()` returns `activityLog` for TIF-13

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildHistoricBand(times, trimPct, manualExcluded)` in `forecast-tif.js` — extend to return `median` alongside min/max (TIF-15)
- `buildDurationBand(durations, anchorMinutes, trimPct, manualExcluded)` in `forecast-tif.js` — extend to return `median`; expose projected duration array for ratio windows
- `trimmedMinMax(values, trimPct, manualExcluded)` in `forecast-tif.js` — exported, tested; extend to also return `median` of the trimmed array
- `buildPrediction(labelledWindows, precisionTarget)` — receives `{ label, min, max, median }` windows; central computed from `avg(medians)` instead of midpoint (TIF-15)
- `resolveAnchor(eventType, dayRecords, tifPredictions)` — pattern to follow for `today_MA` resolution in TIF-12
- `resolveTodayNapDuration(dayRecords, napStartPred, napEndPred)` — model for deriving today's values from mix of actual + predicted
- `computeIntersection(windows)` — takes `{ min, max }` array; signature unchanged by TIF-15

### Established Patterns
- **Per-day flag annotation:** `day-bucket.js` injects `rejected` and `intense` booleans per day record. TIF-16's no-nap detection does not need an injected flag — it checks `napStart === null` directly on day records.
- **Additive settings migration:** `db-shape.js` adds `tifRollingDays` with `if (!blob.settings.tifRollingDays)` guard. No version bump.
- **Window degradation:** when any source window's data is missing or too thin, `buildDurationBand` returns `null` and the window is skipped. All new windows follow this pattern.
- **No direct clock access in lib/:** `tifForecast` is currently pure. For TIF-16, the caller (app.js or today-screen.js) should resolve the no-nap condition before calling `tifForecast`, or pass a `nowMinutes` / `isNoNapDay` flag.

### Integration Points
- `js/app.js` — composition root that calls `tifForecast`. If `activityLog` 3rd param is added, `app.js` passes `eventLog.getActivityLog()` here.
- `js/ui/today-screen.js` — displays `sourceWindows`; gains `median` field per window for potential future UI use (Phase 14 scope, not Phase 13)
- `js/lib/db-shape.js` — additive migration for `tifRollingDays`
- `js/ui/settings-modal.js` — new `tifRollingDays` number input in the TIF section

</code_context>

<specifics>
## Specific Ideas

- **Ratio window label conventions:** use `'MA/sleep ratio band'` for nap-start and `'MA/nap ratio band'` for nap-end — consistent with existing `'Activity-before-nap band'` and `'Nap-length band'` labels.
- **No-nap filtering as a pre-computation step:** before the main window-building loop in `tifForecast`, compute `noNapDayWindow = window.filter(d => extractTime(d.napStart) === null)` and `postNoNapWindow = window.filter((d, i) => i > 0 && extractTime(window[i-1].napStart) === null)`. Use these filtered arrays for TIF-16 bands. Keeps the per-event window-building code clean.
- **tifRollingDays in the Settings modal:** place it immediately after `trimPct` in the TIF sub-section. Label: "TIF history window (days)".

</specifics>

<deferred>
## Deferred Ideas

- **Per-window median display in the TIF card UI:** TIF-15 adds `median` to `sourceWindows` shape. Displaying it in the collapsible evidence window on the Today screen is Phase 14 scope.
- **Duration bands for classic forecaster (nap-start, nap-end, bedtime):** Phase 12 CONTEXT deferred these; still out of scope for Phase 13. Classic algorithm untouched.
- **Post-no-nap nap-duration window:** TIF-16 adds a nap-start window for the day after a no-nap day. A corresponding nap-duration window (affecting nap-end prediction) was not explicitly required — defer to Phase 14 if needed.

</deferred>

---

*Phase: 13-TIF-Algorithm-Extensions*
*Context gathered: 2026-08-26*
