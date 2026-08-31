# Phase 12: Prediction Logic Refinements - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The classic forecaster (`js/lib/forecast.js`) gains 5 contextual modifiers: a time-of-day bedtime rule, a duration-enriched wake band, an intense-day bedtime shift, a missed-nap bedtime shift, and a nap probability score. The Today screen card order is fixed. TIF is untouched — all changes are additive to the classic forecaster only.

Requirements in scope: PRED-08, PRED-09, PRED-10, PRED-11, PRED-12, UI-07.

</domain>

<decisions>
## Implementation Decisions

### Intense-day flag — data model (PRED-10)

- **D-01:** Store intense-day flag as `intenseDays: string[]` in the settings blob, following the exact `rejectedDays` pattern. Additive field injection in `db-shape.js` — no schema version bump needed.
- **D-02:** `day-bucket.js` injects `intense: true` into each day record for dates found in `intenseDays` (same injection pattern as `rejected` from `rejectedDays`).
- **D-03:** The bedtime modifier uses the historical intense-day bedtimes sub-window: filter `dayRecords` to days where `intense === true`, compute P10/P50/P90 of their bedtimes, replace the normal bedtime prediction's band with this sub-window's band. Falls back to a fixed configurable offset (`intenseDayOffsetMinutes`, default 30 min earlier) when intense-day history is below `minDays`.

### Intense-day flag — UI (PRED-10)

- **D-04:** The "Intense day" checkbox lives in the `manual-entry.js` modal, visible for any event type. It is keyed to the calendar date of the event being logged or edited. Saving the event persists the date to `intenseDays`.
- **D-05:** `history-screen.js` shows a small badge/indicator per day when `intense === true` — auditable and removable (clicking it removes the date from `intenseDays`).

### Threshold settings (PRED-08 / PRED-11)

- **D-06:** New setting `eveningHour: 18` (integer 0–23, default 18). Placed in the Forecast section of the Settings modal with label "Evening hour". Added to `db-shape.js` via additive migration.
- **D-07:** `eveningHour` is reused for BOTH rules:
  - PRED-08: when current hour ≥ `eveningHour` and last logged event is `wake`, `selectNextEvent()` returns bedtime as next event (overrides the normal `wake → napStart` priority).
  - PRED-11: when `eveningHour` has passed and no `napStart` has been logged today, the classic forecaster shifts the bedtime prediction earlier.
- **D-08:** PRED-11 bedtime shift = learned from historical no-nap-day bedtimes. Filter `dayRecords` to days where `napStart` is null (no nap logged), compute P50 bedtime from that sub-window. Falls back to a fixed configurable offset (`noNapBedtimeOffsetMinutes`, default 30 min earlier) when no-nap-day history is below `minDays`. Both `eveningHour` and `noNapBedtimeOffsetMinutes` are in the Forecast section of Settings.

### Wake duration-band union (PRED-09)

- **D-09:** Classic forecaster only. The multi-band display with individual source bands is TIF's architecture — PRED-09 produces one wider merged wake band, same single-band card format as today.
- **D-10:** Duration-band formula for wake: `lastBedtime + [P10, P90 of rolling night sleep duration]`, where night sleep duration per day = `wake_time - bedtime` (using the existing `extractTime` + `timeToMinutes` helpers). `lastBedtime` = the most recent logged bedtime event from `dayRecords`.
- **D-11:** Outer union with the existing hour-band: `final_min = min(P10_hour, P10_dur)`, `final_max = max(P90_hour, P90_dur)`. Central time stays P50 of historical wake hours. When `lastBedtime` is unavailable (e.g. bedtime not yet logged this cycle), fall back to hour-band only.
- **D-12:** PRED-09 is wake-only in Phase 12. Duration bands for nap-start, nap-end, and bedtime may follow in Phase 13+.

### Nap probability score (PRED-12)

- **D-13:** Simple additive scoring (0–100) with fixed weights combining 4 signals:
  - Nap frequency in active stage (40%): `napDays / totalDays` from `filterDayRecordsByStage()`.
  - Elapsed wake time vs. typical nap-start window position (30%): how far through the MA window the current time sits.
  - Consecutive no-nap streak penalty (20%): streak of days without a nap reduces the score.
  - Window-passed zero-out (10%): if the nap-start P90 has passed, this signal collapses the total to 0%.
- **D-14:** Display: plain percentage text as a secondary line below the predicted time on the nap-start card: e.g., "73% chance of nap today".
- **D-15:** Score appears on BOTH the nap-start card in the 4-card forecast grid AND the hero next-event card when nap-start is the selected next event.

### UI-07 card order fix

- **D-16:** Fix card order in `today-screen.js:516` from `['wake', 'bedtime', 'napStart', 'napEnd']` to `['wake', 'napStart', 'napEnd', 'bedtime']`. Straightforward bug fix.

### Claude's Discretion

- **Window-passed behavior (PRED-12):** When the nap window has passed, planner to choose between: (a) hard 0% with "Nap window closed" label, or (b) suppress the score entirely. Either is acceptable — pick based on which is less confusing in the existing card layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §PRED-08, PRED-09, PRED-10, PRED-11, PRED-12, UI-07 — exact requirement text and success criteria
- `.planning/ROADMAP.md` §"Phase 12: Prediction Logic Refinements" — goal, success criteria, plan estimates

### Prediction domain knowledge
- `.planning/PREDICTION-FEATURES.md` — prediction formulas, derivable metrics (MA, AA, night sleep duration), predictor tables per event type, feature priority order. Key for PRED-09 duration-band formula and PRED-12 signal definitions.

### Architecture references
- `CLAUDE.md` §Architecture — module roles, cross-file invariants, pitfalls. Read the "Pitfalls & non-obvious invariants" section before touching any time arithmetic or the store pub/sub contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `js/lib/forecast.js` — `calculatePercentiles()`, `timeToMinutes()`, `minutesToTime()`, `extractTime()` (internal helper), `selectNextEvent()`. All new modifiers (PRED-08 through PRED-12) extend or call these. PRED-08 goes in `selectNextEvent()`; PRED-09/10/11 go in `forecast()` or a new `forecastWithContext()` wrapper.
- `js/lib/stages.js` — `filterDayRecordsByStage(dayRecords, stages, activeStageId)` for PRED-12's stage-scoped nap frequency.
- `js/lib/day-bucket.js` — injects per-day flags (`rejected`, and now `intense`) from the settings blob into each day record. Pattern to follow for `intenseDays`.
- `js/lib/db-shape.js` — additive migration pattern: new fields (`intenseDays`, `eveningHour`, `noNapBedtimeOffsetMinutes`) inject per-field on every load without a version bump.

### Established Patterns
- **Per-day flag storage:** `rejectedDays: string[]` in settings blob → injected as `rejected: bool` on each day record by `day-bucket.js`. Follow this exact pattern for `intenseDays` → `intense`.
- **Additive settings migration:** `db-shape.js` adds new fields with `if (!blob.settings.field)` checks. No version bump for purely additive fields.
- **Time arithmetic:** `HH:MM` strings ↔ `timeToMinutes()` / `minutesToTime()`. Night sleep duration = `timeToMinutes(nextWake) - timeToMinutes(bedtime)` (may cross midnight — handle with modular arithmetic).
- **XSS guard:** all dynamic DOM values via `textContent` in `dom.js` helpers. Nap probability % must go through `textContent`, never `innerHTML`.

### Integration Points
- `js/ui/today-screen.js:516` — UI-07 bug fix (card order array).
- `js/ui/today-screen.js` — `renderPredictionCard()` and `renderNextEventCard()` need a new optional `napProbability` prop for PRED-12 display.
- `js/ui/manual-entry.js` — new intense-day checkbox wired to the date of the current event.
- `js/ui/history-screen.js` — new intense-day badge per day row.
- `js/ui/settings-modal.js` — `eveningHour` and `noNapBedtimeOffsetMinutes` inputs in Forecast section.
- `js/lib/forecast.js` — `selectNextEvent()` extended for PRED-08; `forecast()` extended for PRED-09/10/11/12 (or a new `forecastWithContext()` wrapper — planner to decide).

</code_context>

<specifics>
## Specific Ideas

- **PRED-10 modifier pattern:** mirrors intense-day bedtime logic from the historical sub-window exactly like no-nap-day bedtime sub-window (PRED-11) — both compute P50 (or full band) from a filtered `dayRecords` sub-window, with a fixed-offset fallback when history is thin.
- **PRED-11 + PRED-08 share `eveningHour`:** one setting, two effects — simplifies the settings surface. The PRED-08 check happens in `selectNextEvent()` (it's a next-event selection concern), while PRED-11's bedtime shift happens inside `forecast()` (it modifies the prediction itself).
- **Multi-band display is TIF-only:** PRED-09 widens the single merged band for classic forecaster. The richer individual-source-band display described for TIF (hero + aggregate + individual bands with per-band medians per TIF-15) is Phase 13 TIF work, not Phase 12.

</specifics>

<deferred>
## Deferred Ideas

- **Duration bands for nap-start, nap-end, bedtime (classic forecaster):** PRED-09 brings duration-band enrichment to wake only. Other event types may follow in Phase 13+.
- **Multi-band display for classic mode:** The 3-layer card (hero + aggregate + individual source bands) is TIF-only architecture. Classic forecaster keeps single merged band.
- **TIF per-window medians (TIF-15):** Phase 13 scope — adds median to each TIF window band.

</deferred>

---

*Phase: 12-Prediction-Logic-Refinements*
*Context gathered: 2026-08-25*
