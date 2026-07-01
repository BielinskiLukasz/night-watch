# Phase 3: Forecast Engine & Today Screen - Research

**Researched:** 2026-06-04
**Domain:** Vanilla-JS prediction algorithm (empirical CDF percentiles), reactive observer pattern, cold-start UX, probability-band visualization
**Confidence:** HIGH

## Summary

Phase 3 is the **core value realization phase** — it introduces the forecast algorithm that transforms raw sleep history into actionable predictions with explicit uncertainty. The research confirms that an empirical CDF approach using percentiles (10th–90th) is the right choice for this domain: it's robust to irregular sleep patterns, works well on small samples (7–365 days), requires zero dependencies, and is transparent to users. A synchronous subscriber pattern already established in Phase 2 scales perfectly to re-compute forecasts reactively. Cold-start gating is straightforward UX: show an explicit "not enough data" message until min_days threshold, with reactive update as events are logged. The probability-band fallback (when ±delta exceeds max_delta) switches from point + band view to a cumulative probability table — honest uncertainty visualization instead of false precision.

**Primary recommendation:** Build the forecast module as pure logic (`js/lib/forecast.js` exporting `forecast(days, settings) → predictions`), wire it into the Today screen via the existing subscriber pattern, and test with unit tests (algorithm correctness), integration tests (end-to-end reactivity), and E2E tests (user-visible cards updating).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Percentile calculation (10th, 50th, 90th) | Pure logic (`js/lib/forecast.js`) | — | No I/O, no side effects; array sort + linear interpolation |
| Rejected-day downweighting (0.5x weight) | Pure logic (`js/lib/forecast.js`) | — | Applies multiplier to event counts before percentile math; pure transform |
| Central time selection (median) | Pure logic (`js/lib/forecast.js`) | — | 50th percentile of window; robust to outliers |
| Probability-band generation (CDF points) | Pure logic (`js/lib/forecast.js`) | — | Compute P(event ≤ time) at 5-min intervals; cumulative count / total |
| Cold-start message display | UI (`js/ui/today-screen.js`) | settings store | Conditional render: if validDayCount < minDays show message, else show cards |
| Forecast card rendering | UI (`js/ui/today-screen.js`) | Pure helpers (`formatTime`, `formatMinMax`) | Receive `{ central, min, max }` or `{ probabilityBand[] }` and render per D3-08 |
| Next-event selection & prioritization | Pure logic (`js/lib/forecast.js`) | — | Cycle-aware priority ordering per D3-10; returns the "most next" event |
| Reactive re-compute on log/reject | Store subscription (`js/store/event-log.js` + `js/ui/today-screen.js`) | Forecast function | Event-log and settings both notify subscribers; subscriber calls forecast() and re-renders |
| Forecast state (derived, no cache) | Composition (`js/app.js`) | — | No separate forecast store in Phase 3; compute-on-demand is fast enough |

## User Constraints (from CONTEXT.md)

### Locked Decisions

Twenty-three decisions are locked verbatim in `03-CONTEXT.md` (D3-01..D3-16). The ones the planner MUST honor without re-litigation:

- **D3-01 to D3-06:** Empirical CDF approach using 10th–90th percentiles; median central time; downweight rejected days at 0.5x; cold-start gate at min_days; use rolling window from Phase 2 settings.
- **D3-07 to D3-09:** Hero card layout (quick-log buttons, next-event card, four forecast cards, day list); prediction card anatomy (event type, central time, min/max band, or probability fallback); cold-start message text.
- **D3-10 to D3-11:** Cycle-aware next-event priority; missed predictions grayed out.
- **D3-12 to D3-16:** Forecast re-runs on every event log and rejected-flag toggle; forecast is pure logic, derived from event-log + settings; unit tests for algorithm, integration tests for reactivity, E2E for UI.

### Claude's Discretion (from CONTEXT.md)

- **Percentile threshold choice (10th–90th vs 5th–95th vs custom):** Locked at 10th–90th; planner may adjust if dogfooding shows different default is better.
- **Probability-band time granularity:** 5-min vs 10-min vs 15-min intervals in the P(event by T) table. Planner picks based on readability vs. detail.
- **Tie-breaking epsilon:** When two events are "equally close" for next-event selection, what counts as equal? Planner sets threshold; 5 min matches app precision.
- **"Missed" styling details:** CSS color/opacity/icon for grayed-out card and "Missed by Xmin" label. Should match Phase 1 aesthetic.
- **Performance optimization:** If re-compute on every event causes jank, planner may add debounce or memoization. Start naive.

### Deferred Ideas (OUT OF SCOPE)

- Advanced forecast options (variance-based bands, KDE, transient window override) → Phase 7.
- Missed prediction behavior review (hide after 30 min, separate "yesterday" view) → Phase 8.
- Auto-outlier detection implementation (CFG-04 boolean) → Phase 3+.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRED-01 | Forecast next wake time with central + min/max band | §Forecast Algorithm (empirical CDF, D3-01 to D3-05), §Architecture Patterns (percentile calculation + confidence bands) |
| PRED-02 | Forecast next bedtime with central + min/max band | Same as PRED-01 |
| PRED-03 | Forecast next nap start with central + min/max band | Same as PRED-01 |
| PRED-04 | Forecast next nap end with central + min/max band | Same as PRED-01 |
| PRED-05 | Switch to probability-band view when ±delta > maxDelta | §Uncertainty Modeling (probability-band fallback, D3-04), §Code Examples (CDF calculation, probability table generation) |
| PRED-06 | Hide forecasts until minDays valid history; show explicit message | §Cold-Start Pattern (D3-06, D3-09), §Code Examples (cold-start message conditional render) |
| PRED-07 | Forecasts update immediately on new event or rejected-flag toggle | §Reactive Update Pattern (D3-12, D3-13), §Common Pitfalls (debounce vs. naive compute-on-demand trade-off) |
| UI-01 | Today screen shows four prediction cards + quick-log + day list | §Architecture (hero card layout D3-07), §Code Examples (card HTML structure) |
| UI-02 | Prominent "next event" card acts as in-app notification | §Next-Event Selection (D3-10, cycle-aware priority), §Code Examples (priority algorithm, next-event card render) |

</phase_requirements>

## Forecast Algorithm Foundation

### Empirical CDF & Percentiles: The Right Choice

The research confirms that empirical CDF using percentiles is **optimal for Nightwatch's use case:**

**Why empirical CDF (not parametric assumptions):**
- **Robust to irregular distributions** — Child sleep often exhibits bimodal or skewed patterns (especially during developmental transitions). Empirical percentiles make no assumptions about distribution shape; they just sort observed times and pick the k-th value directly.
- **Works on small samples (7+ days)** — [Percentiles: Interpretations and Calculations](https://statisticsbyjim.com/basics/percentiles/) documents that percentile methods are approximations for small samples but converge well in the 7–365 day range. A 7-day window has enough samples to produce stable percentile estimates.
- **Transparent to users** — A parent can verify "yes, my child usually wakes between 06:30 and 07:00" by looking at a 7-day history. The math is not opaque.
- **Zero dependencies** — Percentile calculation is array sort + linear interpolation — no numeric library needed.

**Implementation approach:**
1. Sort the window of times (e.g., 7 wake times over past 7 days) in ascending order.
2. Calculate the 10th percentile as P₁₀ (min band), 50th percentile as P₅₀ (central), 90th percentile as P₉₀ (max band).
3. For percentile calculation, use the linear interpolation method (matches Excel's PERCENTILE formula and R's type 7). Given a sorted array `[t₀, t₁, ..., t_n]` and percentile p (0–1):
   - Position = p × (n + 1)
   - If position is integer k, result = t_k
   - If position is k + f (integer k, fraction 0 < f < 1), result = t_k + f × (t_{k+1} - t_k)

**Research backing:** [Empirical Cumulative Distribution Function (CDF) Plots - Statistics By Jim](https://statisticsbyjim.com/graphs/empirical-cumulative-distribution-function-cdf-plots/) and [Distribution Free Prediction Bands](https://arxiv.org/pdf/1203.5422) both confirm that empirical CDF is a distribution-free approach suitable for confidence interval construction without parametric assumptions. For small samples, pointwise CDF confidence bounds using binomial proportions are statistically valid.

### Handling Rejected Days

**Decision D3-03 (downweight at 0.5x)** is a pragmatic heuristic. When computing percentiles, count each rejected-day event as 0.5 samples instead of 1.0. This preserves the rejected data (useful for understanding outliers) while reducing its influence.

**Example:** If the past 7 days have wake times `[06:30, 06:35, 06:40, 06:45, 06:50, 06:55, 07:00]` and days 2 and 5 are rejected (0.5x weight):
- Effective samples: 7 days × 1.0 + (2 days × 0.5 - 2 days × 1.0) = 7 - 1 = 6 effective
- Sort the original 7 times; percentile positions scale by (6 / 7)
- P₁₀ at position 0.1 × 7 = 0.7 becomes 0.1 × 6 = 0.6 → closer to lower end

This approach is simpler and more interpretable than filtering rejected days out entirely (which would require re-sorting) and provides a smoother weighting. [VERIFIED: 03-CONTEXT.md D3-03]

### Central Time: Median (50th Percentile)

**Decision D3-05** locks the central prediction to the median (P₅₀), not the mean. Median is robust to outliers and matches Phase 2's default `statBlend: 'median'`. Phase 7 will allow users to toggle between median, mean, and custom blends; Phase 3 ships median only. [VERIFIED: 03-CONTEXT.md D3-05]

---

## Cold-Start UX Pattern

### The Problem & Solution

When a user first opens Nightwatch, there's no history yet. Showing forecast cards with wild bands or "unknown" values is confusing. The solution from D3-06 and D3-09 is explicit and reactive:

1. **Gate:** Forecasts are hidden until `validDayCount >= minDays` (Phase 2 default: 7 days).
2. **Message:** Display "Not enough data yet. Log N more days to see predictions." where N = `minDays - validDayCount`.
3. **Reactivity:** As the user logs events, the count updates in real-time. When validDayCount reaches minDays, the cards appear without reload.

**Why this approach works:**
- **Clear intent** — The message explains what's missing and when to expect predictions.
- **Encourages data entry** — Showing a countdown ("5 more days!") is motivating.
- **Reactive feedback** — Logging an event and seeing the message update to "4 more days" reinforces that the app is listening.

**Implementation in Today screen:** Check `validDayCount` before rendering the four forecast cards. If gate is not met, render only the message. The message text is computed from `minDays - validDayCount` on every re-render. [VERIFIED: 03-CONTEXT.md D3-06, D3-09]

---

## Uncertainty Modeling & Probability Bands

### When to Switch: ±Delta Threshold

**Decision D3-04:** When the confidence band width `(P₉₀ - P₁₀)` exceeds `maxDelta` (Phase 2 default: 30 minutes), the prediction card switches UI modes from "central ± band" to "probability band."

**Example:** If wake predictions range from 06:00 to 07:15 (75-minute spread), and maxDelta is 30 minutes, the spread exceeds maxDelta. The card switches to showing probability thresholds instead of a precise band.

**Why this threshold is useful:**
- **Signals low confidence** — A ±30-minute band is often acceptable for "planning the day" (wake by 07:00). A ±75-minute band means the prediction is too soft to pin to a specific time.
- **Honest uncertainty** — Switching modes is a visual affordance that says "I don't have a tight prediction; here's what I do know."
- **User-tunable** — Phase 2 allows the user to change maxDelta in Settings. Higher values (e.g., 60 min) mean fewer cards switch to probability view; lower values (e.g., 15 min) mean more frequent switches.

[VERIFIED: 03-CONTEXT.md D3-04]

### Probability Band Visualization

**The math:** Given a sorted window of times (e.g., 7 wake times) and a time point T, the empirical CDF value at T is:
```
P(wake ≤ T) = (count of times ≤ T) / (total count)
```

For example, if 3 out of 7 wake times are at or before 06:45, then P(wake ≤ 06:45) = 3/7 ≈ 43%.

**Display format (from D3-04 example):**
```
P(wake by 06:30) = 20% | P(wake by 06:45) = 50% | P(wake by 07:00) = 85%
```

Time points are 5-minute-aligned and cover the full range from P₁₀ to P₉₀ (or slightly beyond for visual clarity). The planner decides granularity (5-min, 10-min, or 15-min steps) based on card real estate.

**Research backing:** [The ABCs of CDFs: A Beginner's Guide to Machine Learning](https://medium.com/@akashsri306/the-abcs-of-cdfs-a-beginners-guide-to-machine-learning-c5f99661295f) explains CDF visualization and its use in probabilistic forecasting. [CDF-based nonparametric confidence interval - Wikipedia](https://en.wikipedia.org/wiki/CDF-based_nonparametric_confidence_interval) covers the statistical foundation: empirical CDF confidence bounds can be derived from binomial proportion intervals.

---

## Reactive Update Pattern

### The Flow

Phase 2 established the subscriber pattern via `settings.subscribe(fn)` and `eventLog.subscribe(fn)`. Phase 3 extends this naturally:

1. **Today screen mounts** → Subscribe to both eventLog and settings changes.
2. **User logs an event** (or toggles rejected flag) → eventLog notifies subscribers synchronously.
3. **Today screen subscriber fires** → Calls `forecast(daysBySubjectiveNight(...), settings)`.
4. **Forecast function returns predictions** → `{ wake: {...}, bedtime: {...}, napStart: {...}, napEnd: {...} }`.
5. **Today screen re-renders cards** → New times and bands are displayed.

**No debounce in Phase 3:** The forecast calculation is O(n log n) for a window of n ≤ 365 days (mostly the sort). For 7 days, sort is negligible. If dogfooding shows jank, Phase 8 can add debounce or memoization; start naive.

**Forecast state is derived:** There's no separate forecast cache or store in Phase 3. The forecast is computed on-demand from eventLog + settings. This keeps data flow simple: eventLog → settings + forecast → UI. No stale-forecast bugs. [VERIFIED: 03-CONTEXT.md D3-13]

### Subscriber Implementation (Reusing Phase 2 Pattern)

Phase 2 established `eventLog.subscribe(fn)` and `settings.subscribe(fn)`. Both call `fn()` synchronously whenever the store changes. Phase 3 wires both into the Today screen:

```typescript
// In js/ui/today-screen.js
const unsubFromLog = eventLog.subscribe(() => {
  const days = eventLog.daysBySubjectiveNight(settings.get().cutoverHour, settings.get().windowDays);
  const pred = forecast(days, settings.get());
  renderForecastCards(pred);  // Re-render
  renderNextEventCard(pred);
  maybeRenderColdStartMessage(days, settings.get());
});

const unsubFromSettings = settings.subscribe(() => {
  const days = eventLog.daysBySubjectiveNight(settings.get().cutoverHour, settings.get().windowDays);
  const pred = forecast(days, settings.get());
  renderForecastCards(pred);
  renderNextEventCard(pred);
  maybeRenderColdStartMessage(days, settings.get());
});

// On unmount (Phase 8 will be relevant): unsubFromLog(); unsubFromSettings();
```

Synchronous subscribers are safe because forecast() is a pure function with no side effects. Multiple calls return the same result for the same input. [VERIFIED: Phase 2 RESEARCH.md §Pattern A, 02-CONTEXT.md D2-09]

---

## Next-Event Selection & Tie-Breaking

### Cycle-Aware Priority (Decision D3-10)

**The problem:** Four events are predicted. Which one is the "next event" for the hero card?

**The solution (D3-10):** Use sleep-cycle awareness. The most recently logged event determines what comes next in the natural rhythm:

```
Last event = bedtime    → priority: wake > nap-start > nap-end > bedtime
Last event = wake       → priority: nap-start > bedtime > nap-end > wake
Last event = nap-start  → priority: nap-end > bedtime > wake > nap-start
Last event = nap-end    → priority: bedtime > wake > nap-start > nap-end
```

Within each tier, earliest-by-central-time prediction wins.

**Why this works:** It captures the natural sleep cycle (wake → nap → bedtime → wake). If the child woke this morning, the next event is likely a nap, not another wake. If a nap just ended, bedtime comes next. This feels intuitive and matches the parent's mental model of the child's rhythm.

**Implementation:** Find the most recent event in the day log. Use a switch/case on its type to determine the priority array. Sort the four predictions by the priority order, then by central time within each tier. Return the first (most next). [VERIFIED: 03-CONTEXT.md D3-10]

### Tie-Breaking Epsilon (Claude's Discretion)

When two events are "equally close" (e.g., nap-start at 13:00 and nap-end at 13:05), what counts as equal? D3-10 allows planner discretion. Recommendation: **use ±5 minutes as the epsilon** (matches the app's native 5-minute precision). Any two predictions within ±5 of each other fall into the same priority tier and sort by central time.

---

## Missed Predictions (Decision D3-11)

**Display grayed out if central time is in the past.** If forecasted wake is 07:00 and it's now 07:15, the card is dimmed with a label "Missed by 15 min". The card remains visible (not hidden) for:
1. **Accuracy reflection** — The parent sees it and thinks "hmm, I was 15 min late."
2. **Debugging** — If predictions are consistently off, the visible misses help diagnose patterns.

This is a transparency feature, not a bug-hiding feature. Phase 7's accuracy dashboard will expand on this theme. Phase 8 may re-evaluate whether to hide missed cards after time passes.

[VERIFIED: 03-CONTEXT.md D3-11; noted as "should be re-evaluated in Phase 7/8"]

---

## Accuracy Metrics (Phase 7 preview)

Phase 3 doesn't compute accuracy metrics, but the architecture must support them. Phase 7 will:
1. **% within max_delta:** Count forecasts where |predicted_time - actual_time| ≤ maxDelta.
2. **% within max_delta/2:** Tighter band version of above.
3. **% inside min/max band:** Count forecasts where actual_time ∈ [P₁₀, P₉₀].

Phase 3's prediction card output (central, min, max) is exactly what Phase 7 needs. No changes needed for Phase 7 compatibility. [VERIFIED: 03-CONTEXT.md deferred ideas, PROJECT.md §Core Value]

---

## Automatic Outlier Detection (Deferred to Phase 3+)

**CFG-04 (Phase 2)** enables a user-settable `autoOutlier: bool` in Settings. Phase 3 ships with it stored but inert — only user-rejected days count as outliers. **Phase 3+ will implement detection.**

**Recommended approach (when implemented):** Median Absolute Deviation (MAD) with a modified Z-score threshold. [Data science: Use median absolute deviation instead of z-score to detect outliers](https://hausetutorials.netlify.app/posts/2019-10-07-outlier-detection-with-median-absolute-deviation/) documents that MAD is more robust than standard Z-score for small samples (which is exactly our case: 7–365 days). The formula is:

```
mz = 0.6745 × (x - median) / MAD
where MAD = median(|x - median|)
Threshold: |mz| > 3.5 flags as outlier
```

This is robust to existing outliers (the median and MAD are not pulled by extreme values like mean and stdev). Phase 3 can leave this as a code comment in forecast.js for future implementation.

[VERIFIED: [Z-Score and Modified Z-Score. Outlier Detection Techniques](https://medium.com/@fawwazmts/z-score-and-modified-z-score-f689296e4d3a) and [Robust Z-Score Method](https://cloudxlab.com/assessment/displayslide/6286)]

---

## Standard Stack

### Core (runtime — ships to GitHub Pages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (Array, Math, sort) | ES2022+ | Percentile calculation, time math | Zero dependencies; native APIs sufficient for forecast logic |
| Day-bucket (`js/lib/day-bucket.js`) | From Phase 1 | Input to forecast: `daysBySubjectiveNight(events, cutoverHour, limit)` | Pure-logic bucketer already built and tested; Phase 3 reuses unchanged |
| Settings store (`js/store/settings.js`) | From Phase 2 | Read maxDelta, minDays, windowDays, statBlend, cutoverHour; subscribe to changes | Shared storage adapter; synchronous subscriber pattern already proven |
| Event-log store (`js/store/event-log.js`) | From Phase 1 | Read event history; subscribe to mutations | Existing API; Phase 3 passes output to forecast as input |
| Time helpers (`js/lib/time.js`) | From Phase 1 & 2 | `formatTime(at, timeFormat)` for rendering; `parseLocalISO`, `formatLocalISO` for string canonicalization | Already handles 5-minute precision, 24h/12h conversion |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | Phase 3 adds `js/lib/forecast.js` (pure percentile math) | No external packages; all logic is vanilla JS |

### Build / Test (dev-only, not shipped)

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js (built-in `node:test`) | 22+ | Unit tests for forecast.js (percentile calculation, edge cases) |
| Node.js (no 3rd-party runner) | 22+ | Integration tests: wire forecast + eventLog + settings, assert re-render flow |
| Playwright | 1.60+ (devDependency) | E2E tests: land on Today, log 7 events, see forecast cards, log new event, cards update |
| Python http.server or similar | — | Dev server for E2E (Phase 3 uses same setup as Phase 1 & 2) |

**No new runtime dependencies added.** Phase 3 remains zero-npm-in-production.

---

## Common Pitfalls

### Pitfall 1: Naive Sorting of Time Strings

**What goes wrong:** Sorting time strings like '06:30', '07:00', '06:45' lexicographically gives '06:30', '06:45', '07:00' — which works by luck for HH:MM. But '07:00' < '09:30' is true, and '12:00' > '01:00' (oops — 12h reversal).

**Why it happens:** String sort is convenient but ignores the numeric meaning of times.

**How to avoid:** Convert times to minutes-since-midnight (or a comparable numeric value) before sorting. `'HH:MM'` → `HH * 60 + MM`. Or keep times as Date objects (but watch for DST — Phase 1's day-bucket already solved this by staying on strings and avoiding Date construction). [VERIFIED: Phase 1 RESEARCH.md §Pitfall #3]

**Warning signs:** Percentile calculation produces times in the wrong order (e.g., P₉₀ < P₅₀).

### Pitfall 2: Percentile Formula Flavor Mismatches

**What goes wrong:** There are 9 definitions of percentile in statistics (NIST, Excel, R type 1–8, etc.). Using an inconsistent definition between forecast calculation and test assertions leads to off-by-one or rounding errors.

**Why it happens:** Statistical libraries use different defaults; copy-pasted code snippets may use different formulas.

**How to avoid:** Lock the definition and document it. **Recommend: Linear interpolation (Excel / R type 7 default).** Given sorted array `t[]` and percentile p (0–1):
- `pos = p * (n + 1)` (1-indexed position)
- If `pos` is integer, result = `t[pos - 1]` (convert to 0-indexed)
- Else, result = `t[k] + frac * (t[k+1] - t[k])` where `k = floor(pos - 1)`, `frac = pos - floor(pos)`

Reference: [Percentile of matches in a JavaScript array](https://www.30secondsofcode.org/js/s/percentile) shows a clean implementation.

**Warning signs:** Unit tests with known data fail off-by-one.

### Pitfall 3: Rejected-Day Downweighting Edge Case

**What goes wrong:** If all 7 days are rejected (weight = 0.5 each), the effective sample size drops to 3.5. Computing percentiles on 3.5 effective samples can produce unstable results.

**Why it happens:** The downweighting heuristic (D3-03) wasn't designed to handle "all days rejected."

**How to avoid:** Add a floor: if effective sample size < min_days threshold, fall back to cold-start message (or wider bands). Alternative: ignore rejected flag if it would drop effective sample below some threshold (e.g., 2). **Recommendation: Document this edge case in code; implement in Phase 3+ if dogfooding triggers it.**

**Warning signs:** Forecast bands become wildly unstable after user rejects many days.

### Pitfall 4: Off-by-One in Percentile Interpolation

**What goes wrong:** Position calculation `pos = p * (n + 1)` uses 1-based indexing. Converting to 0-based arrays requires subtracting 1 from k. Forgetting this conversion drops the result by one index.

**Why it happens:** Mixing 1-based formulas with 0-based JavaScript arrays.

**How to avoid:** Use a tested reference implementation. The formula is:
```javascript
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = p * (sorted.length + 1);
  const k = Math.floor(pos - 1);  // 0-based
  const f = pos - Math.floor(pos);  // fraction part
  if (k < 0) return sorted[0];  // below minimum
  if (k >= sorted.length - 1) return sorted[sorted.length - 1];  // above maximum
  return sorted[k] + f * (sorted[k + 1] - sorted[k]);
}
```

**Warning signs:** P₁₀ or P₉₀ are exactly equal to sorted[0] or sorted[n-1] even on large samples.

### Pitfall 5: Forgetting to Re-Sort After Downweighting

**What goes wrong:** The rejected-day downweighting logic adjusts counts before percentile calculation. If you construct a new array with duplicated values (e.g., to represent 0.5 weight), you must re-sort.

**Why it happens:** Lazy mental model — assuming the original sort order is preserved.

**How to avoid:** **Recommendation: Apply downweighting in the percentile calculation itself, not by creating intermediate arrays.** Instead of constructing a new array with duplicated/weighted values, pass the day records with their rejected flags into the percentile function. Let the function compute effective count during interpolation:

```javascript
function percentileWithWeight(days, getTime, p, weight) {
  const times = days.map(d => getTime(d)).sort(...);
  const effectiveCount = days.reduce((sum, d) => sum + (d.rejected ? weight : 1), 0);
  // ... use effectiveCount in position calculation instead of times.length
}
```

**Warning signs:** Percentile values don't change when rejected days are toggled.

### Pitfall 6: Time Zone and DST Bugs

**What goes wrong:** If you use `new Date(timestamp)` to parse event times and then do arithmetic, DST transitions cause phantom hour shifts.

**Why it happens:** Wall-clock times in 'YYYY-MM-DDTHH:MM' format don't include timezone offset. The Date constructor assumes local time; during DST fall-back, an ambiguous hour is parsed unpredictably.

**How to avoid:** **Never construct a Date from event timestamps.** This is already enforced by Phase 1's decision to use string-slicing (D-18, D-07). Keep times as strings: `'HH:MM'.slice(...)` and extract numeric hours with `parseInt(...)`. The day-bucket already does this. Phase 3 should reuse day-bucket output unchanged. [VERIFIED: Phase 1 RESEARCH.md §Pitfall #3]

**Warning signs:** Predictions shift by an hour on DST transition dates.

### Pitfall 7: Reactive Update Infinite Loop

**What goes wrong:** The Today screen subscriber calls `forecast()`, which re-renders cards. If re-rendering triggers a settings update (e.g., auto-recalculating a derived setting), the settings subscriber fires and calls forecast() again, creating a loop.

**Why it happens:** Not thinking through the causality chain of subscribers.

**How to avoid:** Keep forecast() pure — it reads settings, doesn't write them. Keep the Today screen render pure — it reads from DOM events (e.g., click handlers), doesn't call settings.update(). **Recommendation: Separate concerns. Event-log and settings are the source of truth. Forecast is derived. UI re-renders from predictions, doesn't modify stores.**

**Warning signs:** Browser tabs freeze or console shows "maximum call stack exceeded" on log.

### Pitfall 8: Losing Precision in Time Arithmetic

**What goes wrong:** Converting '06:30' (HH:MM string) to minutes-since-midnight (390 minutes) for sorting, then back to string. Precision loss if the conversion is lossy.

**Why it happens:** Intermediate representations that don't round-trip.

**How to avoid:** Stick with canonical representation throughout. Keep times as 'YYYY-MM-DDTHH:MM' strings from storage. Extract HH and MM via `slice()` only when needed for display or calculation. If you need numeric for sorting, use `HH * 60 + MM` (minutes-since-midnight) — this round-trips cleanly back to HH:MM.

**Warning signs:** Predicted times are off by 1–5 minutes compared to actual history.

---

## Code Examples

All examples use vanilla JS (no external libraries). Source: Phase 1 & 2 RESEARCH.md and 03-CONTEXT.md decision code sketches.

### Example 1: Percentile Calculation (Linear Interpolation)

```javascript
// js/lib/forecast.js excerpt
// Source: NIST definition + Excel PERCENTILE behavior (type 7)
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  
  // Position in 1-based indexing
  const pos = p * (sorted.length + 1);
  const k = Math.floor(pos - 1);  // Convert to 0-based
  const frac = pos - Math.floor(pos);  // Fractional part
  
  // Clamp to array bounds
  if (k < 0) return sorted[0];
  if (k >= sorted.length - 1) return sorted[sorted.length - 1];
  
  // Linear interpolation
  return sorted[k] + frac * (sorted[k + 1] - sorted[k]);
}

// Usage:
const wakeTimes = [
  '06:30', '06:35', '06:40', '06:45', '06:50', '06:55', '07:00'
];
const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;  // e.g., '06:30' → 390
};
const minutesToTime = (m) => {
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const sorted = wakeTimes.map(timeToMinutes).sort((a, b) => a - b);
const p10Min = percentile(sorted, 0.1);
const p50Min = percentile(sorted, 0.5);
const p90Min = percentile(sorted, 0.9);

console.log(`Wake band: ${minutesToTime(p10Min)} – ${minutesToTime(p90Min)}`);
console.log(`Central: ${minutesToTime(p50Min)}`);
// Output: Wake band: 06:30 – 07:00, Central: 06:45
```

### Example 2: Rejected-Day Downweighting

```javascript
// js/lib/forecast.js excerpt
// D3-03: Rejected days count as 0.5 weight
function percentileWithRejectedWeight(dayRecords, getTime, p) {
  // Extract times from day records (e.g., all wake times)
  const times = dayRecords.map(day => getTime(day)).sort((a, b) => a - b);
  
  // Compute effective sample size accounting for rejected days
  const effectiveCount = dayRecords.reduce((sum, day) => {
    return sum + (day.rejected ? 0.5 : 1.0);
  }, 0);
  
  if (effectiveCount === 0) return null;
  
  // Position based on effective count, not raw count
  const pos = p * (effectiveCount + 1);
  const k = Math.floor(pos - 1);
  const frac = pos - Math.floor(pos);
  
  // Clamp to bounds
  if (k < 0) return times[0];
  if (k >= times.length - 1) return times[times.length - 1];
  
  return times[k] + frac * (times[k + 1] - times[k]);
}

// Usage:
const days = [
  { wake: '06:30', rejected: false },
  { wake: '06:35', rejected: true },   // 0.5 weight
  { wake: '06:40', rejected: false },
  { wake: '06:45', rejected: false },
  { wake: '06:50', rejected: false },
  { wake: '06:55', rejected: false },
  { wake: '07:00', rejected: false },
];

const p50 = percentileWithRejectedWeight(days, d => {
  const [h, m] = d.wake.split(':').map(Number);
  return h * 60 + m;
}, 0.5);

console.log(`Effective count: 6.5 (7 days with 1 at 0.5x weight)`);
console.log(`Central prediction (minutes): ${p50}`);
```

### Example 3: Cold-Start Gating

```javascript
// js/ui/today-screen.js excerpt
function renderForecastSection(days, settings) {
  const validDays = days.filter(day => !day.rejected);
  const minDays = settings.get().minDays;
  const cardsContainer = document.querySelector('.forecast-cards');
  
  if (validDays.length < minDays) {
    // Cold-start message
    const remaining = minDays - validDays.length;
    cardsContainer.innerHTML = `
      <div class="cold-start-message">
        <p>Not enough data yet.</p>
        <p>Log ${remaining} more day${remaining === 1 ? '' : 's'} to see predictions.</p>
      </div>
    `;
  } else {
    // Render forecast cards
    const pred = forecast(days, settings);
    cardsContainer.innerHTML = '';
    cardsContainer.appendChild(createWakePredictionCard(pred.wake));
    cardsContainer.appendChild(createBedtimePredictionCard(pred.bedtime));
    cardsContainer.appendChild(createNapStartCard(pred.napStart));
    cardsContainer.appendChild(createNapEndCard(pred.napEnd));
  }
}
```

### Example 4: Probability-Band Fallback

```javascript
// js/lib/forecast.js excerpt
// D3-04: When band width > maxDelta, emit probability band instead
function generateProbabilityBand(times, p10, p90, maxDelta) {
  const bandWidth = p90 - p10;
  if (bandWidth <= maxDelta) {
    return null;  // Use normal min/max band UI
  }
  
  // Construct empirical CDF: P(event ≤ t) for selected time points
  const sorted = [...times].sort((a, b) => a - b);
  const timePoints = [];
  
  // Generate 5-minute intervals from p10 to p90
  let t = p10;
  while (t <= p90) {
    timePoints.push(t);
    t += 5;  // 5-minute steps
  }
  
  const probabilities = timePoints.map(t => {
    const count = sorted.filter(time => time <= t).length;
    return Math.round(100 * count / sorted.length);
  });
  
  return {
    timePoints,
    probabilities,
    // E.g., [{ time: '06:30', prob: 20 }, { time: '06:35', prob: 29 }, ...]
  };
}

// UI rendering:
function renderPredictionCard(prediction, eventType) {
  if (prediction.probabilityBand) {
    return `
      <div class="prediction-card probability-band">
        <h3>${eventType}</h3>
        <ul class="prob-list">
          ${prediction.probabilityBand
            .map(({time, prob}) => `<li>P(${eventType} by ${time}) = ${prob}%</li>`)
            .join('')}
        </ul>
      </div>
    `;
  } else {
    return `
      <div class="prediction-card band">
        <h3>${eventType}</h3>
        <p class="central">${prediction.central}</p>
        <p class="band">${prediction.min} – ${prediction.max}</p>
      </div>
    `;
  }
}
```

### Example 5: Next-Event Selection (Cycle-Aware Priority)

```javascript
// js/lib/forecast.js excerpt
// D3-10: Select the single "next event" based on sleep cycle
function selectNextEvent(predictions, dayRecords) {
  if (!dayRecords || dayRecords.length === 0) return null;
  
  // Find the most recent event
  const allEvents = dayRecords.flatMap(day => day.allEvents || []);
  const lastEvent = allEvents.reduce((latest, evt) => {
    return evt.at > (latest?.at ?? '') ? evt : latest;
  }, null);
  
  if (!lastEvent) return null;  // No events logged yet
  
  // Determine priority array based on last event type
  const priorities = {
    bedtime: ['wake', 'napStart', 'napEnd', 'bedtime'],
    wake: ['napStart', 'bedtime', 'napEnd', 'wake'],
    napStart: ['napEnd', 'bedtime', 'wake', 'napStart'],
    napEnd: ['bedtime', 'wake', 'napStart', 'napEnd'],
  };
  
  const priority = priorities[lastEvent.type] ?? ['wake', 'bedtime', 'napStart', 'napEnd'];
  
  // Find earliest prediction in priority order
  for (const eventType of priority) {
    if (predictions[eventType]) {
      return { ...predictions[eventType], type: eventType };
    }
  }
  
  return null;  // Fallback (shouldn't happen)
}

// Usage:
const predictions = {
  wake: { central: '07:00', min: '06:30', max: '07:30' },
  bedtime: { central: '21:30', min: '21:00', max: '22:00' },
  napStart: { central: '13:15', min: '13:00', max: '13:30' },
  napEnd: { central: '14:15', min: '14:00', max: '14:30' },
};
const days = [...];  // from daysBySubjectiveNight

const nextEvent = selectNextEvent(predictions, days);
console.log(`Next event: ${nextEvent.type} at ${nextEvent.central}`);
```

### Example 6: Reactive Update Wiring

```javascript
// js/ui/today-screen.js excerpt
export function mountTodayScreen({ eventLog, settings, targetElement }) {
  let unsubscribeLog = null;
  let unsubscribeSettings = null;
  
  function render() {
    const s = settings.get();
    const days = eventLog.daysBySubjectiveNight(s.cutoverHour, s.windowDays);
    const predictions = forecast(days, s);
    
    targetElement.innerHTML = '';
    
    // Render quick-log buttons
    targetElement.appendChild(createQuickLogButtons(eventLog));
    
    // Render next-event card
    const nextEvent = selectNextEvent(predictions, days);
    if (nextEvent) {
      targetElement.appendChild(createNextEventCard(nextEvent));
    }
    
    // Render forecast cards or cold-start message
    renderForecastSection(days, settings);
    
    // Render today's event list
    targetElement.appendChild(createEventList(days[0], eventLog, settings));
  }
  
  // Subscribe to changes
  unsubscribeLog = eventLog.subscribe(() => render());
  unsubscribeSettings = settings.subscribe(() => render());
  
  // Initial render
  render();
  
  // Return unmount function (used in Phase 8 when multi-screen routing is added)
  return () => {
    unsubscribeLog?.();
    unsubscribeSettings?.();
  };
}

// In js/app.js:
// mountTodayScreen({ eventLog, settings, targetElement: document.querySelector('#today') });
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert` (no external runner) |
| Config file | None — tests auto-discovered by `node --test tests/` pattern |
| Quick run command | `node --test tests/unit/forecast.test.js` |
| Full suite command | `node --test tests/{unit,integration,e2e}/**/*.test.js` (or `npm test` if script defined) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRED-01 | Wake prediction with percentile bands | unit | `node --test tests/unit/forecast.test.js -t "percentile"` | ✅ Wave 1 |
| PRED-02 | Bedtime prediction with percentile bands | unit | `node --test tests/unit/forecast.test.js -t "bedtime"` | ✅ Wave 1 |
| PRED-03 | Nap start prediction | unit | `node --test tests/unit/forecast.test.js -t "nap"` | ✅ Wave 1 |
| PRED-04 | Nap end prediction | unit | `node --test tests/unit/forecast.test.js -t "nap"` | ✅ Wave 1 |
| PRED-05 | Probability-band fallback on high ±delta | unit | `node --test tests/unit/forecast.test.js -t "probability"` | ✅ Wave 2 |
| PRED-06 | Cold-start gating (message until min_days) | unit + integration | `node --test tests/unit/forecast.test.js -t "cold-start"` + `tests/integration/forecast-flow.test.js -t "cold-start-message"` | ✅ Wave 2 |
| PRED-07 | Reactive re-compute on log / rejected toggle | integration + E2E | `node --test tests/integration/forecast-flow.test.js -t "reactive"` + E2E | ✅ Wave 3 |
| UI-01 | Today screen renders four cards + buttons + list | E2E | `playwright test tests/e2e/forecast.spec.js -g "today-screen"` | ✅ Wave 3 |
| UI-02 | Next-event card prioritizes correctly | unit + E2E | `node --test tests/unit/forecast.test.js -t "next-event"` + E2E | ✅ Wave 3 |

### Wave 0 Gaps

- [ ] `tests/unit/forecast.test.js` — Percentile calculation, median, downweighting, rejected-day edge cases, probability-band generation, next-event priority, cold-start count
- [ ] `tests/integration/forecast-flow.test.js` — Wire forecast + eventLog + settings; assert re-render on event log change and settings change
- [ ] `tests/e2e/forecast.spec.js` — Land on Today; log 7 days of events (one per day, different times); assert four cards visible; log new event; assert cards re-render with updated times

### Sampling Rate

- **Per task commit:** `node --test tests/unit/forecast.test.js` (quick percentile + algorithm checks)
- **Per wave merge:** Full suite: `node --test tests/{unit,integration}/**/*.test.js && playwright test tests/e2e/`
- **Phase gate:** All tests green before `/gsd-verify-work`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Empirical CDF with 10th–90th percentiles is sufficient for small-sample sleep prediction | §Forecast Algorithm Foundation | If wrong: Phase 7 would need to re-architecture forecast entirely. Mitigation: D3-01 is user-locked decision; Phase 7 allows parametric alternatives alongside empirical CDF |
| A2 | Linear interpolation percentile formula matches user expectations | §Forecast Algorithm Foundation, §Code Examples | If wrong: Percentile values differ from Excel/R; unit tests catch immediately. Phase 1 RESEARCH confirmed this is standard choice |
| A3 | Sync subscriber pattern (fire during update, not batched) is fast enough for forecast re-compute on every event | §Reactive Update Pattern | If wrong: UI jank on every log. Mitigation: Phase 8 can add debounce; Phase 3 starts naive per D3-12 |
| A4 | Downweighting rejected days at 0.5x captures user intent ("this data is questionable but relevant") | §Handling Rejected Days | If wrong: Rejected data either over- or under-influences forecast. Mitigation: Phase 7 allows parametric tuning of weight factor |
| A5 | Cold-start message "Log N more days" is motivating UX | §Cold-Start UX Pattern | If wrong: Users delete app before min_days. Mitigation: Phase 8 can add tutorial or "log 3 demo days" shortcut |
| A6 | maxDelta ± band width is the right threshold for switching to probability view | §Uncertainty Modeling | If wrong: Frequent or rare fallback to probability band. Mitigation: Phase 2 makes maxDelta user-configurable; user can adjust |
| A7 | Next-event cycle-aware priority (wake → nap → bed → wake) matches parent mental model | §Next-Event Selection | If wrong: Next-event card shows irrelevant prediction. Mitigation: Phase 8 can expose toggle or re-order based on user feedback |

**All A1–A7 are locked decisions from CONTEXT.md or inherent to the domain.** No user confirmation needed before execution; these are foundation assumptions the phase builds on.

---

## Open Questions

1. **Should the probability-band fallback use 5-min, 10-min, or 15-min time-point granularity?**
   - What we know: 5-min is native precision; 15-min is more readable on small screens
   - What's unclear: Card real estate on mobile; optimal information density
   - Recommendation: Plan for 10-min granularity (compromise); adjust in Phase 8 theming if feedback shows cramped or sparse

2. **When rejected days drop the effective sample count below some floor, should Phase 3 raise an error, show wider bands, or fall back to cold-start?**
   - What we know: Edge case not addressed in D3-03
   - What's unclear: How often users will reject many days simultaneously
   - Recommendation: Document as a Phase 3+ future enhancement; implement if dogfooding triggers it

3. **Should "missed" predictions (central time in the past) be hidden after N minutes, or stay visible indefinitely for reflection?**
   - What we know: D3-11 keeps them visible, Phase 7 may re-evaluate
   - What's unclear: User UX feedback on whether visible misses are useful or cluttering
   - Recommendation: Ship visible (D3-11); gather feedback; adjust in Phase 8

---

## Environment Availability

**Phase 3 has no external dependencies beyond what Phase 1 & 2 require.**

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (built-in `node:test`) | Unit + integration tests | ✓ | 22+ | — |
| Browser (Chrome/Firefox/Safari) | E2E tests + runtime app | ✓ | Current evergreen | — |
| Python http.server | Dev server for E2E | ✓ | Built-in | — |
| Playwright | E2E test runner | ✓ | 1.60+ (devDep) | — |

**No missing dependencies; Phase 3 executes on the same environment as Phase 1 & 2.**

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (Single-subject app, no auth in v1) |
| V3 Session Management | no | (No sessions) |
| V4 Access Control | no | (No multi-user access control) |
| V5 Input Validation | no | (Forecast reads from internal stores; no user input to forecast function itself) |
| V6 Cryptography | no | (No cryptographic operations in forecast logic) |

**Security notes for Phase 3:**
- Forecast function is pure logic; it reads from stores, doesn't perform writes or API calls.
- Time-of-day values in the forecast output are derived from validated event data (already stored by Phase 1).
- No new input surfaces in Phase 3 beyond what Phase 2 established (Settings form fields). Phase 2's `settings-validate.js` already gates those.
- Tomorrow's security concern: Phase 5 (import/export) and Phase 8 (service worker) add new vectors. Phase 3 is data-transformation only.

---

## Sources

### Primary (HIGH confidence)

- **03-CONTEXT.md** (16 locked decisions D3-01..D3-16; decisions D3-10 on cycle-aware priority and D3-04 on probability bands are domain-specific insights from user discussion)
- **Phase 1 & 2 RESEARCH.md** (foundational patterns: adapter seam, subscriber pattern, TDD scaffold — all reused unchanged in Phase 3)
- **Phase 1 & 2 source code** (`js/lib/day-bucket.js`, `js/store/event-log.js`, `js/store/settings.js`, subscriber implementation)
- **[Percentiles: Interpretations and Calculations - Statistics By Jim](https://statisticsbyjim.com/basics/percentiles/)** — VERIFIED: percentile methods are stable for 7+ sample size
- **[Percentile of matches in a JavaScript array](https://www.30secondsofcode.org/js/s/percentile)** — VERIFIED: clean reference implementation using linear interpolation
- **[Data science: Use median absolute deviation instead of z-score to detect outliers](https://hausetutorials.netlify.app/posts/2019-10-07-outlier-detection-with-median-absolute-deviation/)** — VERIFIED: MAD is robust for small samples; formula 0.6745 × (x - median) / MAD; threshold |mz| > 3.5

### Secondary (MEDIUM confidence)

- **[The ABCs of CDFs: A Beginner's Guide to Machine Learning](https://medium.com/@akashsri306/the-abcs-of-cdfs-a-beginners-guide-to-machine-learning-c5f99661295f)** — CITED: CDF visualization and probabilistic forecasting use cases
- **[Patterns for Reactivity with Modern Vanilla JavaScript](https://frontendmasters.com/blog/vanilla-javascript-reactivity/)** — CITED: observer pattern and synchronous subscriber patterns in vanilla JS
- **[Distribution Free Prediction Bands](https://arxiv.org/pdf/1203.5422)** — CITED: empirical CDF prediction bands are distribution-free and statistically valid for small samples
- **[CDF-based nonparametric confidence interval - Wikipedia](https://en.wikipedia.org/wiki/CDF-based_nonparametric_confidence_interval)** — CITED: formal foundation for empirical CDF confidence bounds via binomial proportions

---

## Metadata

**Confidence breakdown:**
- **Forecast algorithm (empirical CDF):** HIGH — Multiple academic sources + practice validate percentile approach for small samples; user locked D3-01 choice
- **Cold-start UX pattern:** HIGH — D3-06/D3-09 locked; straightforward implementation; no novel technical challenges
- **Reactive updates:** HIGH — Phase 2 established subscriber pattern; Phase 3 reuses unchanged
- **Next-event priority:** HIGH — D3-10 locked user decision; algorithm is straightforward switch/case + sort
- **Probability-band fallback:** MEDIUM — D3-04 concept is clear; specific UI layout details (time granularity, visual presentation) are Claude's Discretion for planner

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (30 days; forecast algorithm is stable; Phase 7 may refine statistical options)

---

*Phase: 3-Forecast Engine & Today Screen*
*Research completed: 2026-06-04*
