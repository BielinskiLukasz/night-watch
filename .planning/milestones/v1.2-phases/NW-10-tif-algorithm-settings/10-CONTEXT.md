# Phase 10: TIF Algorithm & Settings - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers the Trimmed Intersection Forecast algorithm as an opt-in alternative to the existing `forecast.js`, with three new Settings controls and updated Today screen rendering for TIF predictions. It also builds `js/lib/metrics.js` (duration helpers only), which Phase 11 reuses and extends.

What ships: `js/lib/metrics.js` (TIF-scoped duration helpers), `js/lib/forecast-tif.js` (pure TIF algorithm), new settings fields (`forecastAlgorithm`, `trimPct`, `precisionTarget`), Settings modal TIF sub-section, and Today screen TIF card rendering (normal cards with inline precision score + low-confidence collapse/expand cards).

What does NOT ship: ratio metrics (activityAfterSleepFactor, sleepAfterActivityFactor), historical aggregates, the Metrics screen tab (Phase 11). The classic `forecast.js` is not modified — TIF is additive only.

</domain>

<decisions>
## Implementation Decisions

### metrics.js Scope and API

- **D10-01:** `js/lib/metrics.js` is scoped to TIF-only duration helpers for Phase 10: `sleepDuration(day)`, `napDuration(day)`, `activityBeforeNap(day)`, `activityAfterNap(day)`, `dayLength(day)`, `combinedSleepNap(day)`. Phase 11 extends this module with ratio metrics and `aggregateMetrics()`.
- **D10-02:** Expose individual named helpers (not a single `dayMetrics()` object). TIF calls only what it needs; Phase 11 adds more helpers alongside the existing ones.
- **D10-03:** All helpers accept pre-bucketed day records (fields: `.wake`, `.bedtime`, `.napStart`, `.napEnd` — same shape as what `day-bucket.js` produces and `forecast.js` consumes). No re-bucketing inside metrics.js.
- **D10-04:** `trimmedMinMax(values, trimPct, manualExcludedCount)` lives in `forecast-tif.js`, not `metrics.js`. It is a TIF-algorithm concern, not a general duration metric.

### TIF Algorithm Return Shape

- **D10-05:** `tifForecast(eventLog, settings)` returns the same top-level structure as `forecast.js` (`{ wake, bedtime, napStart, napEnd }`) but each event's prediction object is extended:
  ```
  {
    central,       // 'HH:MM' string — midpoint of displayed window
    min,           // 'HH:MM' string — displayed window start
    max,           // 'HH:MM' string — displayed window end
    precisionScore,   // number 0–100 (%)
    isLowConfidence,  // boolean — true when intersection was empty
    algRange,         // number in minutes — algorithm's raw range width
    algMin,           // 'HH:MM' — algorithm's raw start (before narrowing)
    algMax,           // 'HH:MM' — algorithm's raw end (before narrowing)
    sourceWindows,    // array of { label, min, max } for each source window computed
  }
  ```
  `algMin`/`algMax` differ from `min`/`max` only when narrowing was applied (algRange > precisionTarget). `sourceWindows` is used by the UI when rendering low-confidence expanded detail.

### Today Screen — Normal TIF Cards

- **D10-06:** Normal TIF prediction cards (intersection succeeded, `isLowConfidence=false`) are not collapsible. They are always expanded inline. Layout:
  - Line 1: displayed window (`min`–`max`)
  - Line 2 (only when `algRange > precisionTarget`): original algorithm range (`algMin`–`algMax`) in subdued/smaller text
  - Precision score badge always visible when TIF is active (even at 100%, signals TIF is running)
- **D10-07:** Precision score also appears on the hero card (Next Predicted Event) when TIF is active.

### Today Screen — Low-Confidence TIF Cards

- **D10-08:** Low-confidence TIF cards (`isLowConfidence=true`) reuse the Phase 9 collapse/expand mechanism (same as probability-band cards).
  - Collapsed (default): single line — `"Wake — Low confidence — 07:00–09:30"` (union range displayed)
  - Expanded (tap): shows each source window that failed to intersect (from `sourceWindows`) plus the precision score
- **D10-09:** Normal TIF cards do NOT have a collapse/expand mechanism. Only low-confidence cards use it.

### Settings Controls

- **D10-10:** The three new TIF controls live in a visual sub-section within the existing "Forecast tuning" fieldset, not a new top-level fieldset. Use a `<fieldset>` sub-group or `<div>` with a `<legend>`/label to visually separate them as "TIF Algorithm".
- **D10-11:** The algorithm toggle (`forecastAlgorithm: 'classic' | 'tif'`) is a `<select>` dropdown — consistent with the existing `statBlend` control pattern.
- **D10-12:** The `trimPct` and `precisionTarget` inputs are hidden (not just disabled) when Classic is selected. When TIF is selected in the toggle, they appear. This is a client-side show/hide on the dialog's open/change event.

### Settings Defaults

- **D10-13:** New `DEFAULT_SETTINGS` additions: `forecastAlgorithm: 'classic'`, `trimPct: 10`, `precisionTarget: 60` (minutes window width). All three added to `db-shape.js` and validated in `settings-validate.js`.

### Claude's Discretion

- Exact HTML structure of the TIF sub-section within "Forecast tuning" (whether it uses a nested `<fieldset>` or a `<div>` with a label element)
- Exact CSS class names for the precision score badge and original range line
- Computation order for `tifForecast()` internal steps (wake → napStart → napEnd → bedtime, driven by anchor dependency chain)
- Naming of `sourceWindows` entries labels (e.g., "Historic band", "Sleep-length band") — follow the naming from BACKLOG.md B-21 Step 3

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Algorithm Specification
- `.planning/BACKLOG.md` §B-21 — Full TIF algorithm specification: Step 1 (percentile trim), Step 2 (intersection logic), Step 3 (windows per event type with anchor rule), Step 4 (precision scoring and display). This is the canonical algorithm spec — read every sub-step before writing forecast-tif.js.

### Requirements
- `.planning/REQUIREMENTS.md` §TIF-01..TIF-11 — All 11 TIF requirements for this phase. Traceability table confirms all are Phase 10 scope.
- `.planning/ROADMAP.md` §Phase 10 — Success criteria (5 items) and "UI hint: yes" flag.

### Architecture Invariants
- `CLAUDE.md` §Architecture — Adapter injection, XSS guard (all dynamic DOM via `textContent` / `dom.js` helpers), day-boundary via `day-bucket.js`, service-worker cache versioning.

### Existing Code to Extend
- `js/lib/forecast.js` — Return shape, helper functions (`timeToMinutes`, `minutesToTime`, `percentile`), and existing patterns TIF must match or extend. `tifForecast()` must return compatible top-level shape.
- `js/lib/db-shape.js` — Where to add new DEFAULT_SETTINGS keys and migration logic.
- `js/lib/settings-validate.js` — Where to add validation rules for `forecastAlgorithm`, `trimPct`, `precisionTarget`.
- `js/ui/today-screen.js` — Where TIF prediction rendering lands. Check `renderPredictionCard()` and `renderNextEventCard()` for the existing card pattern, and the Phase 9 probability-band collapse/expand mechanism to reuse for low-confidence cards.
- `js/ui/settings-modal.js` — Where the TIF fieldset sub-section and show/hide logic lands.
- `tests/unit/sw-precache.test.js` — Must be updated when new `.js` files are added (service worker precache list enforcement).
- `sw.js` — `PRECACHE_LIST` must include new files: `js/lib/metrics.js`, `js/lib/forecast-tif.js`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/lib/forecast.js` `timeToMinutes(hhmm)` / `minutesToTime(minutes)` — Time conversion helpers. `forecast-tif.js` should import and reuse these rather than reimplementing.
- `js/lib/forecast.js` `percentile(sorted, p)` — Reusable for computing P10/P90 in TIF windows if needed.
- Phase 9 probability-band collapse/expand rendering in `today-screen.js` — Reuse this exact mechanism for low-confidence TIF cards. Read the existing implementation before writing TIF card rendering.
- `js/adapters/storage-memory.js` + `js/adapters/clock-fixed.js` — Test adapter pattern; use for `forecast-tif.js` integration tests without touching real storage.

### Established Patterns
- **Adapter injection:** `forecast-tif.js` is a pure function (no DOM, no `localStorage`). It receives `eventLog` (array of events) and `settings` (object). `app.js` passes both at call time — no direct adapter imports in `forecast-tif.js`.
- **`Object.freeze` config:** Any frozen config object in `forecast-tif.js` must use `Object.freeze` per CLAUDE.md.
- **5-minute rounding:** All output times from `tifForecast()` must be rounded to 5-minute precision (same as `forecast.js` `FORECAST_CONFIG.ROUND_MINUTES`).
- **XSS guard:** All new Today screen rendering must go through `el()` / `textContent` from `js/ui/dom.js`. No `innerHTML` with user-controlled or algorithm-computed strings.
- **TDD:** Unit tests for `metrics.js` helpers and `trimmedMinMax()` before implementing. Integration tests for `tifForecast()` with a memory adapter and known fixture data. E2E test that TIF prediction cards render when the algorithm toggle is set to TIF in Settings.

### Integration Points
- `js/app.js` composition root: add `tifForecast` import and call it when `settings.forecastAlgorithm === 'tif'`; pass result to `renderForecastSection()` (which will need to know which algorithm produced the predictions to render them correctly).
- `js/ui/today-screen.js` `renderForecastSection()`: branch on whether predictions have `isLowConfidence`/`precisionScore` fields to choose TIF vs. classic card rendering.
- `js/store/settings.js` subscribe chain: when `forecastAlgorithm` changes, the Today screen re-renders with the newly-selected algorithm's predictions (already handled by the existing reactive subscribe pattern).

</code_context>

<specifics>
## Specific Ideas

- **`precisionTarget` is a window width in minutes** (not ±half-width). TIF-03: "desired maximum width of a displayed TIF prediction window". A value of 60 = a 60-minute window (e.g., 07:30–08:30). TIF-10 confirms: "narrowed to precision-target width centered on the algorithm's midpoint".
- **`trimPct` is a single global setting**, not per-event-type. TIF-02 locks this as a single percentage applied consistently across all event types.
- **Manually rejected days count against the trim budget before auto-trim.** TIF-11: "manually rejected events count against the trim budget before auto-trim is applied." The auto-trim budget = `floor(N × trimPct / 100) − manualExcluded` (min 0), split symmetrically.
- **Anchor rule from B-21:** When computing a derived window (e.g., sleep-length band for wake), the bedtime anchor is: the actual logged bedtime if it IS the latest logged observation; otherwise the TIF midpoint of the bedtime prediction. This means TIF must compute event predictions in dependency order: wake (no external anchor needed for historic band) → napStart → napEnd → bedtime. The anchor for each step may use the just-computed TIF midpoint of the prior step.
- **Cold-start gate and outlier flags respected** (TIF-11): TIF respects the existing `minDays` setting and `rejectedDays` array. `forecast-tif.js` receives the same pre-bucketed `dayRecords` that `forecast.js` receives (already filtered for min_days and with `rejected` flag on each day record).

</specifics>

<deferred>
## Deferred Ideas

- **Ratio metrics** (`activityAfterSleepFactor`, `sleepAfterActivityFactor`, `aggregateMetrics()`) — Phase 11 scope. `metrics.js` will be extended then.
- **Stage-scoped TIF windows** — B-21 "suggested" list item. Not in Phase 10 requirements. Could be added in a future TIF refinement phase.
- **Rolling-window TIF variant** — B-21 "suggested" list item. Recency-biased window. Deferred post-baseline TIF validation.
- **Activity-after-sleep ratio band** (B-21 "suggested") — Additional wake-up window based on `activityTime / sleepDuration` ratio stability. Deferred.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-TIF-Algorithm-Settings*
*Context gathered: 2026-07-13*
