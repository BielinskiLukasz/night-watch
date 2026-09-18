# Phase 22: Accuracy Scoring - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes)` to `js/lib/accuracy.js` using the linear-decay formula (D≤W → 100−(50/W)×D; W<D≤2W → 50−(50/W)×(D−W); D>2W → 0). Change the daily score to the arithmetic mean of per-event scores. Update `accuracy-screen.js` to render per-event scores and the new overall average. Update backtesting engine calls in `accuracy.js` (and, per this discussion's scope extension, `accuracy-tif.js`) to use the new event-type bucketing. `accuracy-tif.js` must NOT import `metrics.js` (circular-import guard, unchanged).

**Requirements this phase satisfies:** ACC-01, ACC-02, ACC-03, ACC-04

**Note on scope:** discussion surfaced one item — splitting bedtime accuracy tracking into nap-day/no-nap-day buckets — that goes beyond ACC-01..04's literal wording. It was explicitly confirmed by the user (D-03/D-05) rather than deferred; see those decisions for the reasoning and the flagged scope extension into `accuracy-tif.js`.

</domain>

<decisions>
## Implementation Decisions

### Tolerance Window (ACC-01)

- **D-01:** `toleranceMinutes` (W) for `eventAccuracyScore` is the existing `settings.maxDelta` (default 30 min) — no new setting added. `maxDelta` already means "how far off is acceptable"; it currently only triggers the probability-band fallback, and this phase extends the same value to accuracy grading. — **Reversibility:** reversible

- **D-02:** `computeAccuracy()` continues to use the CURRENT settings snapshot uniformly across all retroactively-scored historical days (same as it already does for `forecast()` simulation and the old `withinDelta` counters). Changing `maxDelta` in Settings will retroactively change how lenient/strict all historical scores look — this is accepted as consistent with existing behavior, not a new precedent. — **Reversibility:** reversible

### Bedtime Split (scope extension beyond ACC-01..04's literal wording)

- **D-03:** Bedtime accuracy is split into two scored buckets, `bedtimeNapDay` and `bedtimeNoNapDay`, in addition to the combined `bedtime` key (D-04). A historical day is classified nap-day vs no-nap-day by whether its *actual* `napStart` was logged that day (`napStart != null`) — reusing Phase 19 D-04's existing "nap day" definition, not by which internal series `forecast()` happened to select. Source: `NEW_ACC.md` explicitly lists "Bedtime without nap" / "Bedtime with nap" as separate event types, and Phase 19 already predicts bedtime via separate nap-day/no-nap-day series, so scoring them separately surfaces whether the split-bedtime model (Phase 19) is actually working better for one case than the other. — **Reversibility:** costly — extends `AccuracyResult`'s shape and `accuracy-screen.js`'s table; reverting means collapsing back to one bedtime bucket and re-touching both files plus their tests.

- **D-04:** The old single `bedtime` key is KEPT as a combined aggregate (average across both nap-day and no-nap-day bedtime events) alongside the two new sub-keys — three bedtime-related keys total in the result shape: `bedtime`, `bedtimeNapDay`, `bedtimeNoNapDay`. — **Reversibility:** reversible

- **D-05:** `accuracy-tif.js` (the separate TIF backtesting engine) ALSO splits its bedtime bucket into `bedtimeNapDay`/`bedtimeNoNapDay` using the identical classification rule as D-03, for consistency between the two accuracy engines. **This is an explicit scope extension**: ACC-01..04 only names `accuracy.js`, and Phase 22's roadmap line mentions `accuracy-tif.js` only in the context of "if it references hit/miss" for `eventAccuracyScore` — TIF's `windowHit`/`highConf` metric is structurally different (interval containment, not point-distance decay) and was never going to call `eventAccuracyScore`. The bedtime-bucket split is a separate, additional change to `accuracy-tif.js`'s `ACCURACY_TIF_CONFIG.EVENT_TYPES`, confirmed directly by the user rather than assumed. — **Reversibility:** costly — touches a module not otherwise in this phase's mandate; reverting means removing the added buckets from `accuracy-tif.js` and its tests.

### Scoring Probability-Band Fallback

- **D-06:** When `forecast()` returns `{ probabilityBand: [...] }` instead of a central prediction for an event, `eventAccuracyScore` still runs for that event/day. `forecastMinutes` is approximated as the **midpoint of the band's min/max** (`(bandMin + bandMax) / 2`), reusing the exact `bandMin`/`bandMax` computation `accuracy.js` already has in its existing band-mode branch (`Math.min`/`Math.max` over `probabilityBand[].time`) — not a probability-weighted mean. — **Reversibility:** reversible

- **D-07:** Each event score derived this way carries an explicit `approximated: true` flag in the returned data (e.g., `{ score, approximated: true }`), set by `accuracy.js`/`accuracy-tif.js` at computation time — NOT re-derived by `accuracy-screen.js` from the raw prediction shape at render time. This keeps the UI dumb (just reads the flag) and keeps the approximation logic unit-testable directly in the accuracy modules. `accuracy-screen.js` must visually distinguish flagged scores (e.g., asterisk or muted styling — exact treatment left to Claude's discretion, see below) from normal point-prediction scores, preserving the project's uncertainty-honesty principle (a band exists because a point prediction wasn't reliable; the score derived from it shouldn't look identically confident). — **Reversibility:** reversible

### Old Metrics Removal & Display Format

- **D-08:** `withinDelta`, `withinHalfDelta`, and `insideBand` counters — and all associated band-mode branching in `ACCURACY_CONFIG`/`computeAccuracy()` — are FULLY REMOVED from `accuracy.js`'s `AccuracyResult` shape, per ACC-04's "replace" wording taken literally. No dead code or back-compat shim is kept. — **Reversibility:** costly — removes public shape fields consumed by `accuracy-screen.js` and existing unit tests; reverting requires restoring the old counters and re-wiring the screen and tests.

- **D-09:** The Accuracy screen renders **aggregate per-event-type average scores** — one row per event type (`wake`, `bedtime`, `bedtimeNapDay`, `bedtimeNoNapDay`, `napStart`, `napEnd`), each showing the average `eventAccuracyScore` across all scored history. No new per-day breakdown table is added; this reuses today's existing table/`COLUMNS` rendering structure with new column definitions replacing `withinDelta`/`withinHalfDelta`/`insideBand`. — **Reversibility:** reversible

- **D-10:** A single **overall headline score** (the average of each day's daily-average score, across all history) is displayed above the per-event table — this satisfies ACC-03/ACC-04's "daily average" requirement as one top-line number (e.g., "Overall accuracy: 78") rather than a per-day table. — **Reversibility:** reversible

- **D-11:** Scores render as **plain numbers** (e.g., "82"), consistent with the existing plain numeric/pct style already used throughout `accuracy-screen.js` and `metrics-screen.js`. No color-coded good/ok/poor thresholds are introduced. — **Reversibility:** reversible

### Claude's Discretion

- Exact visual treatment for `approximated: true` scores (asterisk, superscript label, muted/italic styling, footnote, etc.) — pick whatever fits the existing table style in `accuracy-screen.js`.
- Exact column ordering and header labels in the per-event aggregate table beyond the key names fixed by D-04/D-09.
- Internal helper structure for computing the band midpoint and the "nap-day" classification check — as long as the classification rule matches Phase 19 D-04 exactly (`napStart != null`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoring Specification
- `NEW_ACC.md` (repo root, untracked scratch note) — original scoring-formula design from the user: linear-decay formula, the 5-event-type framing ("Bedtime without nap" / "Bedtime with nap" as separate types) that drove D-03/D-05, and the worked example table (forecast=14:50, window=25min) usable as literal test vectors for ACC-02's boundary values (D=0, D=W, D=2W, D>2W).

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §ACC-01, ACC-02, ACC-03, ACC-04 — functional requirements for this phase
- `.planning/ROADMAP.md` §"Phase 22: Accuracy Scoring" — phase summary with file targets and acceptance criteria
- `.planning/PROJECT.md` §"Current Milestone: v1.5" — "Linear-decay per-event accuracy scoring with tolerance window (B-049)" target-feature framing

### Core Modules Being Changed
- `js/lib/accuracy.js` — primary file being rewritten: `ACCURACY_CONFIG`, `extractActualMinutes`, `buildAccuracyResult`, `computeAccuracy` all change per D-03/D-04/D-08/D-09
- `js/lib/accuracy-tif.js` — `ACCURACY_TIF_CONFIG.EVENT_TYPES` (currently `['wake', 'napStart', 'napEnd', 'bedtime']`) extended per D-05's scope extension; circular-import guard (must NOT import `metrics.js`) is unchanged and must be preserved
- `js/ui/accuracy-screen.js` — rendering target: current `COLUMNS` (withinDelta/withinHalfDelta/insideBand headers), `renderAccuracy`, `renderTifAccuracy` all change per D-08/D-09/D-10/D-11

### Signal Sources (read, not modified)
- `js/lib/forecast.js` — `forecast()`'s `probabilityBand` shape (`[{time, prob}, ...]`, band-mode returns around lines 680/734/757) — source for D-06's midpoint calc; `timeToMinutes` reused
- `js/lib/db-shape.js` — `DEFAULT_SETTINGS.maxDelta` (default 30, ~line 53) — the reused tolerance value (D-01)
- `js/lib/settings-validate.js` — `maxDelta` validator (`min: 5, max: 120`, ~line 50) — confirms no divide-by-zero risk in the linear-decay formula when W is used directly

### Prior Phase Context (precedent patterns)
- `.planning/phases/19-split-bedtime-wake-anchored-nap/19-CONTEXT.md` §D-04 — the existing "nap day" definition (`napStart != null`) reused for D-03's bedtime-split classification
- `.planning/phases/20-nap-probability-redesign/20-CONTEXT.md` §Specific Ideas — notes `NEW_ACC.md` as this phase's source, already partially consumed into `REQUIREMENTS.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `forecast()`, `timeToMinutes` from `forecast.js` — already imported by `accuracy.js`, unchanged
- The existing `bandMin`/`bandMax` computation in `accuracy.js`'s current band-mode branch (`Math.min`/`Math.max` over `probabilityBand[].time`, ~lines 211-213) — reuse directly for D-06's midpoint calculation, no new math needed
- `extractActualMinutes(event)` helper — unchanged, still extracts actual times from ISO or bare HH:MM
- `ACCURACY_CONFIG.EVENT_TYPES` pattern — extend from `['wake', 'bedtime', 'napStart', 'napEnd']` to include `bedtimeNapDay`/`bedtimeNoNapDay` per D-03/D-04

### Established Patterns
- Look-ahead-bias-free retroactive loop (`history = sorted.slice(0, i)`, `actual = sorted[i]`) — structural loop in `computeAccuracy()` stays the same; only what's counted per event changes
- `Object.freeze` on config objects — existing convention, maintain for any new config additions
- `accuracy-tif.js`'s circular-import guard — imports only `forecast.js`/`forecast-tif.js`, never `metrics.js`; D-05's bedtime split must not introduce a `metrics.js` import

### Integration Points
- `accuracy.js`: counters → scores rewrite, remove D-08's old fields, add D-03's bedtime split, add D-06/D-07's band-fallback handling
- `accuracy-tif.js`: add D-05's bedtime split to `ACCURACY_TIF_CONFIG.EVENT_TYPES` and its counters
- `accuracy-screen.js`: replace `COLUMNS`/`renderAccuracy`/`renderTifAccuracy` per D-09/D-10/D-11; remove all `withinDelta`/`withinHalfDelta`/`insideBand` references
- `tests/unit/accuracy.test.js` (and TIF equivalent if present) — full rewrite needed for the new shape; `NEW_ACC.md`'s worked example is a ready-made boundary-value test source

</code_context>

<specifics>
## Specific Ideas

- `NEW_ACC.md`'s worked example (forecast = 14:50, window = 25 min, table of distance→score from 14:00 to 15:40) is a literal test-vector source for `eventAccuracyScore`'s boundary values (D=0, D=W, D=2W, D>2W per ACC-02).
- `maxDelta`'s current default (30 min) differs from `NEW_ACC.md`'s illustrative example (25 min) — this is not a discrepancy requiring action; the example was illustrative, not a mandate to change `maxDelta`'s value (D-01 confirmed reuse as-is).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The bedtime-split extension into `accuracy-tif.js`, D-05, was explicitly confirmed rather than deferred — see that decision's scope-extension note.)

</deferred>

---

*Phase: 22-accuracy-scoring*
*Context gathered: 2026-09-16*
