# Phase 19: Algorithm C & Settings Modal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 19-algorithm-c-settings-modal
**Areas discussed:** Bedtime three-band math (prior session 2026-09-08), Nap predictions scope, Algorithm C settings exposure

---

## Bedtime Three-Band Math

*(Discussed in prior session 2026-09-08 — carried forward from checkpoint)*

| Option | Description | Selected |
|--------|-------------|----------|
| wake + day-length distribution | today's actual wake time + historical P10/P50/P90 day-lengths | ✓ |
| Pure historic bedtime band only | Drop the Day-length band entirely | |
| Bedtime filtered by today's day-length quartile | Select a historic bedtime subset based on quartile match | |

**User's choice:** wake + day-length distribution
**Notes:** Today's actual wake time is the anchor; the distribution models variation in day length historically.

---

| Option | Description | Selected |
|--------|-------------|----------|
| nap-end + AA distribution | today's actual nap-end + P10/P50/P90 of historical AA durations; falls back to historic-bedtime-only on no-nap days | ✓ |
| Wake + AA distribution | Anchor AA band to wake time instead of nap-end | |
| Only use AA band on nap days; skip it entirely on no-nap days | Two-band blend on no-nap days | |

**User's choice:** nap-end + AA distribution
**Notes:** Falls back to historic-bedtime-only on no-nap days (later revised by D-05 to always use 3 bands with substitution).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Treat all 3 intervals as a group | Triple intersection if all overlap; outer envelope if any pair doesn't | ✓ |
| Apply the 2-model check pairwise (3 checks) | Run 3 pairwise stability checks | |
| Skip the stability check for bedtime | No stability check applied | |

**User's choice:** Treat all 3 intervals as a group

---

| Option | Description | Selected |
|--------|-------------|----------|
| Two-band blend on no-nap days: Historic + Day-length only | Drop AA band on no-nap days | |
| Three-band blend always: substitute no-nap historic bedtime for AA band | Always 3 bands | ✓ |
| Fall back to Classic algorithm on no-nap days | Delegate to Classic when no nap | |

**User's choice:** Three-band blend always: substitute no-nap historic bedtime for AA band

---

## Nap Predictions Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Build wake-anchored gap series locally in forecast-blend.js | Phase 20 extracts to forecast.js | ✓ |
| Delegate nap to Classic algorithm in Phase 19 | blendForecast returns Classic nap unchanged | |
| Skip nap in Phase 19 (return null) | Placeholder until Phase 20 | |

**User's choice:** Build wake-anchored gap series locally in forecast-blend.js
**Notes:** Phase 20 extracts `buildNapGapSeries` into `forecast.js` and removes the local copy.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single-model — just the gap series | No stability check (1 interval) | |
| Two-model blend — gap series + historic nap time | Stability check applied to 2 intervals | ✓ |
| You decide | Claude picks implementation | |

**User's choice:** Two-model blend — gap series + historic nap-start time-of-day percentiles

---

| Option | Description | Selected |
|--------|-------------|----------|
| Historic nap-end time-of-day percentiles | P10/P50/P90 of raw nap-end times | |
| Nap-start + historic nap duration percentiles | actual/predicted napStart + P(napDuration) as second model | ✓ |
| You decide | Claude picks | |

**User's choice:** Nap-start + historic nap duration percentiles
**Notes:** Model 1 = fully chained (wakeAnchor + gap P + duration P). Model 2 = nap-start anchor + P(napDuration).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Actual logged nap-start if available, else predicted central | More accurate once nap has started | ✓ |
| Always use predicted nap-start central | Consistent pipeline regardless of logged state | |

**User's choice:** Actual logged nap-start if available, else predicted central

---

## Algorithm C Settings Exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded at 0.3 | Internal implementation detail, not user-facing | |
| User-configurable blendShrinkage in Settings | Exposed under Algorithm C fieldset | ✓ |

**User's choice:** User-configurable

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate blendWindowDays setting | Algorithm C default 90 days, independent of windowDays | ✓ |
| Reuse Classic's windowDays | Shared setting | |
| You decide | Claude picks | |

**User's choice:** Separate blendWindowDays — default 90, range 14–180

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — blendTrimPct, default 25%, range 0–40% | User-configurable extreme discard fraction | ✓ |
| Hard-code at 25% | Not exposed in Settings | |

**User's choice:** blendTrimPct user-configurable, default 25, range 0–40

---

## Claude's Discretion

- Exact label text for "Algorithm C" option in selector (e.g., "Algorithm C", "Blend", "Multi-band")
- HTML structure for the three settings sub-groups (follow `el.hidden = !isTif` pattern from existing code)

## Deferred Ideas

None — discussion stayed within phase scope.
