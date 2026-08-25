# Phase 3: Forecast Engine & Today Screen - Discussion Log

**Date:** 2026-06-03
**Participants:** User, Claude

## Discussion Summary

Phase 3 context discussion focused on four implementation areas: the forecast algorithm, probability-band fallback design, Today screen layout, and reactive-update edge cases. All areas were fully explored; no gray areas remain unresolved.

## Gray Area 1: Forecast Algorithm & Statistics

**Options explored:**

1. **Percentile-based confidence bands (10th–90th percentiles)**
   - Pros: Derived from actual data, robust to non-normal distributions, transparent to users
   - Cons: None significant for this use case

2. **Variance-based (±1.5σ from median)**
   - Pros: Mathematically principled
   - Cons: Unpredictable band width on small windows, less robust to outliers

3. **Observation-span (min/max of window)**
   - Pros: Simplest, always anchored to observed data
   - Cons: May be overly wide

4. **Min/max + fixed buffer**
   - Pros: Consistent visual footprint
   - Cons: Loses information about distribution shape

**Decision:** User opted for **percentile-based (10th–90th)** as the default for Phase 3, with **variance-based deferred to Phase 7** as an advanced option users can toggle between.

**Rationale:** For a 2-year-old's sleep (irregular, subject to developmental shifts, teething, illness), empirical CDF is robust and makes no distributional assumptions.

**Related decisions:**
- Rejected days are downweighted at 0.5x in percentile calculation (D3-03)
- Central prediction is the median (50th percentile) per Phase 2's default `statBlend: 'median'`
- Window length defaults to Phase 2's `windowDays` setting (default 7 days, user-configurable, minimum 7)
- Configurable window-length override deferred to Phase 7

## Gray Area 2: Probability-Band Fallback Design

**Question:** How to represent P(event by time T) when ±delta > maxDelta?

**Options explored:**

1. **Empirical CDF from the window**
   - Pros: Data-driven, no parametric assumption, works with 7-day windows
   - Cons: None for this use case

2. **Normal distribution fit**
   - Pros: Familiar, smooth
   - Cons: Assumes bell-curve; fails on bimodal/skewed data (common in toddler sleep)

3. **Kernel Density Estimation (KDE)**
   - Pros: Handles multimodality, sophisticated
   - Cons: Requires bandwidth tuning, adds complexity

**Decision:** User chose **Empirical CDF for Phase 3**, with **KDE deferred to Phase 7** as an advanced option.

**Rationale:** Same as Gray Area 1 — empirical CDF is robust to real-world toddler-sleep patterns without adding statistical complexity.

**Implementation:** Display probability table with 5-minute-aligned time points, e.g., "P(wake by 06:30) = 20% | P(wake by 06:45) = 50% | P(wake by 07:00) = 85%"

## Gray Area 3: Today Screen Layout & Cards

**Question:** Where does the "next event" card sit relative to the four forecast cards?

**Options explored:**

1. **Hero card at the top** (Layout: [Header] [Buttons] [NEXT EVENT] [Four cards] [List])
   - Pros: Prime real estate for the most actionable info, matches in-app notification pattern
   - Cons: Takes up vertical space

2. **Inline 5th card** (Layout: [Header] [Buttons] [5-card grid: Next + 4 forecasts] [List])
   - Pros: All predictions treated uniformly
   - Cons: Next event gets lost among four others, less scannable

3. **Sidebar/toggle** (Layout: [Header] [Buttons] [Forecast section] [Next Event section, separate/collapsible])
   - Pros: Separates concerns
   - Cons: Adds cognitive load, friction for quick checks

**Decision:** User chose **Option 1 — Hero card at the top** (D3-07).

**Rationale:** Parents checking the app want to know "when will they wake/sleep?" first. Hero pattern is proven UX for mobile notifications. The full forecast is secondary.

## Gray Area 4: Reactive Forecast Updates & Edge Cases

### 4a. Handling "Missed" Predictions

**Question:** How to display predictions whose central time is in the past?

**Options explored:**

1. **Show with "past" badge**
   - Pros: Preserves info for debugging
   - Cons: Confusing for quick glance

2. **Hide; show next future event instead**
   - Pros: Clean, forward-looking
   - Cons: Loses context for accuracy reflection

3. **Gray out with "Missed by Xmin" label**
   - Pros: Transparent, enables accuracy reflection, still scannable
   - Cons: Takes visual space

**Decision:** User chose **Option 3 — Gray out with "Missed by Xmin" label** (D3-11).

**Rationale:** Supports the app's core value of accuracy tracking and transparency.

**Deferred review:** This behavior should be re-evaluated in Phase 7 or Phase 8 when end-of-day reflection and accuracy-dashboard patterns are clearer.

### 4b. "Next Event" Selection Logic

**Question:** When multiple events are equally close, which one should the "next event" card highlight?

**Options explored:**

1. **Earliest by central-time prediction**
   - Pros: Deterministic, simple
   - Cons: Ignores natural sleep cycle (e.g., wake is more important than nap-start even if nap is sooner)

2. **Static type priority** (e.g., wake > bedtime > nap-end > nap-start)
   - Pros: Consistent
   - Cons: Doesn't adapt to current state

3. **User-configurable priority**
   - Pros: Flexible
   - Cons: Adds settings UI complexity

**Decision:** User chose **Cycle-aware priority** (D3-10) — priority depends on the most recently logged event:
- Last event = `bedtime` → priority: `wake` > `nap-start` > `nap-end` > `bedtime`
- Last event = `wake` → priority: `nap-start` > `bedtime` > `nap-end` > `wake`
- Last event = `nap-start` → priority: `nap-end` > `bedtime` > `wake` > `nap-start`
- Last event = `nap-end` → priority: `bedtime` > `wake` > `nap-start` > `nap-end`

**Rationale:** Captures the natural sleep cycle (bedtime → wake → nap → bedtime) and feels intuitive for a parent. Deterministic within each priority tier (earliest by central-time).

## Decisions Deferred to Future Phases

### Phase 7 (Charts, Heatmap & Accuracy)
- Variance-based confidence bands as a user-switchable option
- KDE as a third probability-distribution option
- Configurable forecast window-length override (transient, not a permanent setting)

### Phase 8 (PWA & Platform Hardening)
- Re-evaluation of "missed" prediction styling behavior
- Advanced forecast-tuning UX (if needed)

### Phase 3+ (Outlier Detection)
- CFG-04 "Auto outlier" detection engine (currently stored but inert)

## Areas Explicitly Locked (No Further Discussion Needed)

- **Outlier handling:** Rejected days downweighted at 0.5x; auto-detection deferred to Phase 3+
- **Central prediction:** Always median (Phase 2 default `statBlend: 'median'`)
- **Cold-start gate:** Explicit message when history < `minDays`
- **Reactive updates:** Re-run forecast on every event log or rejected-flag toggle (no debounce in Phase 3)
- **Forecast state model:** Pure function, derived from event-log + settings (no separate cache/store)

## Next Steps

Phase 3 context is complete and locked. Proceed to `/gsd-plan-phase 3` to create the implementation plan.

---

*Phase: 3-Forecast Engine & Today Screen*
*Discussion completed: 2026-06-03*
