# Phase 12: Prediction Logic Refinements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 12-Prediction-Logic-Refinements
**Areas discussed:** Intense-day flag storage, Threshold settings (PRED-08/PRED-11), Nap probability score (PRED-12), Wake duration-band union (PRED-09)

---

## Intense-day flag storage (PRED-10)

| Option | Description | Selected |
|--------|-------------|----------|
| intenseDays string[] in settings | Same pattern as rejectedDays — array of date strings in settings blob. No version bump. | ✓ |
| Per-day metadata map { [date]: { intense: bool } } | More extensible for future per-day metadata; requires new top-level DB shape. | |
| Event-level flag on bedtime event | Semantically awkward; harder to query across days. | |

**User's choice:** intenseDays string[] in settings (recommended option)
**Notes:** Exact rejectedDays pattern. Additive migration, no schema version bump.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed offset, configurable in Settings | intenseDayOffsetMinutes shifts bedtime earlier by fixed amount. Simple and predictable. | |
| Learned from historical intense-day bedtimes | Sub-window of intense-day records → P10/P50/P90. More data-driven. | ✓ |
| You decide | Planner picks simplest correct approach. | |

**User's choice:** Learned from historical intense-day bedtimes
**Notes:** Falls back to fixed configurable offset when sub-window < minDays.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to fixed offset (−30 min) | Use configurable fallback when intense-day history is below minDays. | ✓ |
| Suppress the modifier silently | If insufficient history, treat day as normal. No modifier applied. | |
| You decide | Planner picks right fallback. | |

**User's choice:** Fall back to a fixed offset (recommended)
**Notes:** intenseDayOffsetMinutes setting used as fallback.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In the manual-entry form, any event type | Checkbox in Add/Edit Event modal, visible for all types, keyed to event's date. | ✓ |
| Only on the bedtime event form | Checkbox only on bedtime event type. | |
| Standalone toggle on the Today screen | Day-level toggle outside the modal. | |

**User's choice:** In the manual-entry form, any event type (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — small badge in history row | Compact indicator; auditable and removable. | ✓ |
| No — only accessible via edit form | Less visual noise but harder to spot and correct. | |
| You decide | Planner decides indicator approach. | |

**User's choice:** Yes — show a small badge in the history row (recommended)

---

## Threshold settings (PRED-08 / PRED-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable setting (eveningHour: 18) | New setting in Settings Forecast section, default 18. | ✓ |
| Hardcoded at 18:00 | Frozen constant in forecast.js. Simpler. | |
| You decide | Planner picks right approach. | |

**User's choice:** Configurable setting (recommended)
**Notes:** Added to db-shape.js with additive migration.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate napMissedByHour setting | Semantically different from eveningHour; calibrated independently. | |
| Same eveningHour setting | One threshold for both PRED-08 and PRED-11. Simpler settings surface. | ✓ |
| Hardcoded (e.g. 15:00) | PRED-11 requirement says 'configured threshold hour' — implies configurable. | |

**User's choice:** Same eveningHour setting

---

| Option | Description | Selected |
|--------|-------------|----------|
| Learned from historical no-nap-day bedtimes | Sub-window of no-nap days → P50 bedtime. Falls back to fixed offset. | ✓ |
| Fixed configurable offset (noNapBedtimeOffsetMinutes) | Always shift earlier by constant minutes. | |
| You decide | Planner matches intense-day pattern. | |

**User's choice:** Learned from historical no-nap-day bedtimes (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| In the Forecast section, label 'Evening hour' | Consistent with existing Forecast section settings. | ✓ |
| New 'Contextual rules' section in Settings | Distinct heading for phase-12 additions. More explicit but more surface area. | |
| You decide | Planner picks placement. | |

**User's choice:** In the Forecast section, label 'Evening hour' (recommended)

---

## Nap probability score (PRED-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Simple additive scoring (0–100) with fixed weights | nap frequency (40%) + elapsed-wake position (30%) + streak penalty (20%) + window-passed (10%). Transparent and testable. | ✓ |
| Multiplicative probability (Bayesian product) | Statistically cleaner but harder to reason about with sparse data. | |
| You decide | Keep it simple and testable. | |

**User's choice:** Simple additive scoring (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hard zero — show 0% and 'Nap window closed' label | Collapses to 0 once typical nap window has passed. | |
| Suppress the score entirely | Don't show % after window has passed. | |
| You decide | Planner chooses right display behavior. | ✓ |

**User's choice:** You decide (Claude's discretion)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain percentage text below the time | '73% chance of nap today' as secondary line. Consistent with existing card style. | ✓ |
| Colored badge (green/yellow/red) | Small pill badge; more visual but adds color-coding not present elsewhere. | |
| You decide | Planner matches existing card style. | |

**User's choice:** Plain percentage text below the time (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both cards | % on nap-start card in 4-card grid AND hero next-event card when nap-start is selected. | ✓ |
| Forecast grid card only | % only in 4-card grid; hero stays minimal. | |
| You decide | Planner decides based on card layout constraints. | |

**User's choice:** Both cards (recommended)

---

## Wake duration-band union (PRED-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Last night's actual logged bedtime | Concrete, real data. Falls back to bedtime P50 if not logged. | ✓ |
| Bedtime prediction P50 | Always uses model's own prediction; introduces circularity. | |
| You decide | Planner prioritises real data over predicted. | |

**User's choice:** Last night's actual logged bedtime (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| P10–P90 of historical sleep durations | Band: [lastBedtime + P10_duration, lastBedtime + P90_duration] → outer union. | ✓ |
| P50 (median) only | Single offset, not a band. | |
| You decide | Planner implements natural extension of percentile model. | |

**User's choice:** P10–P90 of historical sleep durations (recommended)

---

**Multi-band display clarification (freeform):**

**User's input:** "we should present band for each type. The hour will be average of median, which is TIF-15 requirement"

**Clarified:** The multi-band display (hero + aggregate + individual source bands) is TIF-only architecture. For classic forecaster PRED-09, the hour-band and duration-band are merged into one wider outer-union band. TIF-15 (Phase 13) adds medians to individual TIF windows.

**Duration band formula confirmed:** `lastBedtime + [P10, P90 of rolling night sleep duration]`. Outer union with hour-band: `min = min(P10_hour, P10_dur), max = max(P90_hour, P90_dur)`. Central time stays P50 of historical wake hours.

**PRED-09 scope:** wake-only in Phase 12.

---

## Claude's Discretion

- **Nap probability window-passed behavior (PRED-12):** User said "you decide." Planner to choose between hard 0% with "Nap window closed" label vs. suppressing the score entirely.

## Deferred Ideas

- Duration bands for nap-start, nap-end, bedtime (classic forecaster) — PRED-09 is wake-only in Phase 12; other event types may follow in Phase 13+.
- Multi-band display for classic mode (individual source bands) — TIF-only architecture; not Phase 12 scope.
- TIF per-window medians (TIF-15) — Phase 13 scope.
