# Phase 10: TIF Algorithm & Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 10-TIF Algorithm & Settings
**Areas discussed:** metrics.js scope, Precision score + original range layout, Low-confidence card treatment, Settings UI organization

---

## metrics.js Scope

| Option | Description | Selected |
|--------|-------------|----------|
| TIF-only scope | Build only what TIF needs: duration helpers. Phase 11 extends with ratio metrics + aggregates. | ✓ |
| Full scope for both phases | Build complete metrics.js now including ratio metrics and aggregateMetrics(). | |
| Shared interface, phased fill | Define full API in Phase 10 but only implement TIF-touched helpers; stubs for rest. | |

**User's choice:** TIF-only scope (Recommended)
**Notes:** Keeps Phase 10 lean — no code written before it's needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Individual named helpers | e.g. sleepDuration(day), napDuration(day). TIF calls only what it needs. | ✓ |
| Single dayMetrics() object | dayMetrics(day, prevDay?) returns all metrics as one object. | |

**User's choice:** Individual named helpers (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| trimmedMinMax in forecast-tif.js | TIF-algorithm concern, not a general metric. Keeps metrics.js pure: durations only. | ✓ |
| trimmedMinMax in metrics.js | Percentile trim plausibly useful beyond TIF for historical aggregates. | |
| You decide | Claude picks based on least-shared-surface principle. | |

**User's choice:** In forecast-tif.js (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Assume pre-bucketed day records | Receive .wake, .bedtime, .napStart, .napEnd fields from day-bucket.js. No duplicate bucketing. | ✓ |
| Accept raw events + cutoverHour | metrics.js buckets internally. More flexible but duplicates day-bucket.js responsibility. | |

**User's choice:** Assume pre-bucketed day records (Recommended)

---

## Precision Score + Original Range Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible, inline | Displayed window + second line (original range when narrowed + precision score badge). No tap. | ✓ |
| Precision badge only; original range on tap | Badge visible; tap to see original range. Compact default. | |
| Separate 'TIF detail' row below each card | Collapsible detail row with windows, intersection, score. Reuses Phase 9 expand/collapse. | |

**User's choice:** Always visible, inline (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only when narrowed | Original range shown only when algRange > precisionTarget. No redundant line. | ✓ |
| Always show original range | Always render original range line even if it matches displayed window. Consistent but redundant. | |

**User's choice:** Only when narrowed (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — hero card shows precision score too | Hero card shows TIF precision score for the next event when TIF is active. | ✓ |
| No — prediction cards only | Score only on the four TIF prediction cards. Hero stays simpler. | |
| You decide | Claude picks based on hero card existing layout. | |

**User's choice:** Yes — hero card shows precision score too (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always show score when TIF active | Even at 100%, score signals TIF is running. Consistent badge on all TIF cards. | ✓ |
| Only show score when narrowing applied | No badge on confident predictions. Less visual noise. | |

**User's choice:** Yes — always show score when TIF is active (Recommended)

---

## Low-Confidence Card Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Warning badge on the card | Amber 'Low confidence' badge replacing/alongside precision score. No collapse/expand. | |
| Reuse Phase 9 collapse/expand mechanism | Same collapsed-by-default + tap-to-expand as probability-band cards. | ✓ |
| Muted/greyed card with label | Lower opacity or grey border + 'Low confidence' text. Quieter signal. | |

**User's choice:** Reuse the Phase 9 collapse/expand mechanism
**Notes:** Consistent expand/collapse UX. User accepted the tradeoff that this blurs the distinction between high classic uncertainty and TIF intersection failure — consistency won.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Event type + 'Low confidence' label + union range | "Wake — Low confidence — 07:00–09:30". Same format as probability-band collapsed. | ✓ |
| Event type + 'Low confidence' label only | Range only visible when expanded. Forces tap to see any time info. | |
| You decide | Claude picks consistent with existing collapsed probability-band format. | |

**User's choice:** Event type + 'Low confidence' label + union range (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Individual window ranges that failed to intersect | Expanded shows each source window + precision score. Diagnostic insight. | ✓ |
| Just the union range + precision score | Simpler. No per-window breakdown. | |
| You decide | Claude picks for max diagnostic usefulness. | |

**User's choice:** The individual window ranges that failed to intersect (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include source windows in return shape | tifForecast() returns sourceWindows[] alongside final result. UI uses when isLowConfidence + expanded. | ✓ |
| No — source windows computed by UI separately | Leaner return but requires more context threading to UI. | |
| You decide | Claude picks based on minimizing coupling. | |

**User's choice:** Yes — include source windows in the return shape (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Low-confidence only | Normal TIF cards never collapse. Only low-confidence use collapse/expand + source-window detail. | ✓ |
| All TIF cards show source windows when expanded | Every TIF card expandable. Consistent tap behavior. | |

**User's choice:** Low-confidence only (Recommended)

---

## Settings UI Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Extend 'Forecast tuning' fieldset | Append algorithm toggle at top; TIF fields below (conditionally shown). No restructure. | |
| New 'TIF' sub-section within 'Forecast tuning' | Visual sub-group or divider inside fieldset labelled 'TIF Settings'. More organized. | ✓ |
| New top-level 'Algorithm' fieldset | 4th fieldset in modal. Clean separation but grows modal. | |

**User's choice:** New 'TIF' sub-section within 'Forecast tuning'

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when Classic is selected | trimPct + precisionTarget inputs disappear when Classic selected. No noise. | ✓ |
| Visible but disabled when Classic | Both inputs greyed-out but visible. User can see what TIF would expose. | |
| Always visible | Always shown and editable. Simplest rendering logic. | |

**User's choice:** Hidden when Classic is selected (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| <select> dropdown | Consistent with statBlend control pattern. Accessible, native, mobile-friendly. | ✓ |
| Radio buttons (Classic ◯ / TIF ◯) | More explicit visual binary toggle. New pattern for the modal. | |
| You decide | Claude picks consistent with existing settings-modal.js. | |

**User's choice:** `<select>` dropdown (Recommended)

---

## Claude's Discretion

- Exact HTML structure of the TIF sub-section within "Forecast tuning" (nested `<fieldset>` vs. `<div>` with label)
- Exact CSS class names for the precision score badge and original range line
- Computation order for `tifForecast()` internal steps (dependency chain: wake → napStart → napEnd → bedtime)
- Label text for `sourceWindows` entries — follow B-21 Step 3 naming ("Historic band", "Sleep-length band", etc.)

## Deferred Ideas

- Ratio metrics (`activityAfterSleepFactor`, `sleepAfterActivityFactor`, `aggregateMetrics()`) → Phase 11
- Stage-scoped TIF windows → future TIF refinement phase (B-21 suggested)
- Rolling-window TIF variant → post-baseline TIF validation (B-21 suggested)
- Activity-after-sleep ratio band as additional wake-up window → deferred (B-21 suggested)
