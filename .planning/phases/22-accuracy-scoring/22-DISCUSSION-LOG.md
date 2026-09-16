# Phase 22: Accuracy Scoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 22-accuracy-scoring
**Areas discussed:** Tolerance window source, Bedtime split (nap-day vs no-nap-day), Scoring probability-band fallback, Old metrics & display format

---

## Tolerance window source

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse maxDelta | No new setting; extends the existing "how far off is acceptable" concept to scoring | ✓ |
| New global toleranceMinutes setting | Separate setting distinct from maxDelta's forecast-uncertainty purpose | |
| Per-event-type tolerances | Separate W per wake/bedtime/napStart/napEnd | |

**User's choice:** Reuse maxDelta as W.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, acceptable | Consistent with how maxDelta already behaves for every other accuracy metric today | ✓ |
| No — freeze tolerance per historical day | Requires storing/snapshotting maxDelta per historical day | |

**User's choice:** Accepted that computeAccuracy() always uses the current settings snapshot, matching existing behavior.

---

## Bedtime split (nap-day vs no-nap-day)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep single 'bedtime' score | Matches ACC-01..04's literal wording; no shape change | |
| Split into bedtime-nap-day / bedtime-no-nap-day | Matches NEW_ACC.md's 5-type framing; surfaces whether Phase 19's split-bedtime model performs differently per case | ✓ |

**User's choice:** Split bedtime accuracy into two buckets.

| Option | Description | Selected |
|--------|-------------|----------|
| Actual napStart logged that day | Reuses Phase 19 D-04's existing "nap day" definition | ✓ |
| Whichever series the forecast used | Classify by which internal series fired, including blended/undetermined days | |

**User's choice:** Classify by actual napStart logged that day.

| Option | Description | Selected |
|--------|-------------|----------|
| Leave accuracy-tif.js untouched | TIF measures a structurally different metric; roadmap doesn't call for this | |
| Split TIF bedtime tracking too | Keep both accuracy engines' bedtime granularity consistent | ✓ |

**User's choice:** Split accuracy-tif.js's bedtime bucket too — confirmed as an explicit scope extension beyond ACC-01..04 and the roadmap's literal wording for accuracy-tif.js.

| Option | Description | Selected |
|--------|-------------|----------|
| Same rule, flagged as scope extension | Consistent classification across both engines, documented as intentional | ✓ |
| Different rule for TIF | TIF gets its own classification logic | |

**User's choice:** Same classification rule for TIF, explicitly flagged in CONTEXT.md as a scope extension.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove 'bedtime', replace with two keys | Clean, no redundant aggregate | |
| Keep 'bedtime' as combined aggregate + add two sub-keys | Three bedtime-related keys total | ✓ |

**User's choice:** Keep the combined 'bedtime' aggregate alongside the two new sub-keys.

| Option | Description | Selected |
|--------|-------------|----------|
| bedtimeNapDay / bedtimeNoNapDay | Matches Phase 19's internal function naming | ✓ |
| bedtimeWithNap / bedtimeWithoutNap | Matches NEW_ACC.md's literal wording | |

**User's choice:** `bedtimeNapDay` / `bedtimeNoNapDay` key names.

---

## Scoring probability-band fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Skip scoring that event/day | Matches ACC-03's "both forecast and actual" wording; band isn't a single forecast time | |
| Approximate with band center | Every day still gets a score; diverges from today's containment-check band handling | ✓ |

**User's choice:** Approximate with band center rather than skip.

| Option | Description | Selected |
|--------|-------------|----------|
| Simple midpoint of min/max | Reuses accuracy.js's existing bandMin/bandMax computation | ✓ |
| Probability-weighted mean | Statistically truer expected value, more code | |

**User's choice:** Simple midpoint of min/max.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, flag them | Visually distinguish band-derived scores to preserve uncertainty-honesty principle | ✓ |
| No, treat identically | Simpler, but risks user mistaking an approximation for a confident grade | |

**User's choice:** Flag band-derived scores visually.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit flag in the result data | computeAccuracy() records an `approximated` boolean per event; UI stays dumb | ✓ |
| Screen re-derives it | accuracy-screen.js checks prediction.probabilityBand at render time | |

**User's choice:** Explicit `approximated: true` flag in the data, not re-derived by the UI.

---

## Old metrics & display format

| Option | Description | Selected |
|--------|-------------|----------|
| Fully remove from accuracy.js | Matches ACC-04's "replace" wording literally; no dead code | ✓ |
| Keep internally, drop from display only | More surface kept alive with no current consumer | |

**User's choice:** Fully remove withinDelta/withinHalfDelta/insideBand from accuracy.js's shape.

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate per-event averages | Matches today's existing table style; smallest UI change | ✓ |
| Per-day table + aggregate summary | Bigger UI addition, more useful for spotting patterns over time | |

**User's choice:** Aggregate per-event averages, no new per-day table.

| Option | Description | Selected |
|--------|-------------|----------|
| One overall headline score | Single top-line number satisfies the "daily average" requirement | ✓ |
| No separate daily-average display | Computation exists internally but isn't surfaced as its own number | |

**User's choice:** One overall headline score above the per-event table.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain number, e.g. '82' | Matches existing plain numeric/pct style throughout the app | ✓ |
| Color-coded thresholds | New visual pattern, no existing convention to reuse | |

**User's choice:** Plain numbers, no color-coding.

---

## Claude's Discretion

- Exact visual treatment for `approximated: true` scores (asterisk, superscript label, muted/italic styling, footnote, etc.).
- Exact column ordering and header labels in the per-event aggregate table beyond the key names fixed by decisions above.
- Internal helper structure for computing the band midpoint and the "nap-day" classification check.

## Deferred Ideas

None — discussion stayed within phase scope. The bedtime-split extension into `accuracy-tif.js` was explicitly confirmed by the user as an intentional scope extension, not deferred.
