# Phase 19: Split Bedtime & Wake-Anchored Nap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 19-split-bedtime-wake-anchored-nap
**Areas discussed:** Split bedtime module, PRED-19 blend mechanics, PRED-11 coexistence, Wake anchor fallback

---

## Split Bedtime Module

| Option | Description | Selected |
|--------|-------------|----------|
| In forecast.js | All four series functions in forecast.js; Phase 25 imports from there | ✓ |
| Create forecast-blend.js stub now | Create forecast-blend.js early; forecast.js imports from it | |

**User's choice:** In forecast.js

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minutes like calculatePercentiles | Return { min, central, max } as integer minutes | ✓ |
| HH:MM strings like forecastEvent | Return HH:MM strings directly | |

**User's choice:** Minutes like calculatePercentiles

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in forecast() body | Same pattern as existing PRED-11 block | ✓ |
| New selectBedtimeSeries() helper | Extract a wrapper for the routing/blending logic | |

**User's choice:** Inline in forecast() body

---

| Option | Description | Selected |
|--------|-------------|----------|
| napStart != null | A day counts as a nap-day if napStart is recorded | ✓ |
| Both napStart and napEnd recorded | Only count if both nap events are logged | |

**User's choice:** napStart != null

---

## PRED-19 Blend Mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Central only | Blend just the central; min/max take outer envelope | ✓ |
| Full band (min/central/max) | Blend all three values weighted by score | |

**User's choice:** Central only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Before nap window opens | Fire only when current hour < P10 of nap-start times | |
| Any time napStart is not logged | Fire regardless of current hour | ✓ |

**User's choice:** Any time napStart is not logged

---

| Option | Description | Selected |
|--------|-------------|----------|
| 50/50 blend | Equal weighting when score is unavailable | |
| Fall back to overall series | Use calculatePercentiles over all days when score is null | ✓ |
| Nap-day series only | Always assume nap-day distribution when score is null | |

**User's choice:** Fall back to overall series

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to overall series | If either sub-series < minDays, use all-days calculatePercentiles | ✓ |
| Use the other series only | If one is too thin, use only the other | |

**User's choice:** Fall back to overall series

---

## PRED-11 Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| PRED-18/19 replaces PRED-11 | Remove the evening contextual block; split model handles it | ✓ |
| PRED-11 stacks on top | Keep PRED-11 as additional shift after split model runs | |

**User's choice:** PRED-18/19 replaces PRED-11

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remove the offset | Remove noNapBedtimeOffsetMinutes from settings, db-shape.js, settings-validate.js | ✓ |
| Keep the setting | Keep even though PRED-11 is removed | |

**User's choice:** Remove the offset

---

| Option | Description | Selected |
|--------|-------------|----------|
| PRED-10 still applies | Intense-day shift is orthogonal to nap status | ✓ |
| Remove PRED-10 too | Remove alongside PRED-11 | |

**User's choice:** PRED-10 still applies

---

| Option | Description | Selected |
|--------|-------------|----------|
| PRED-10 overrides split selection | Intense day wins outright over split model | |
| Split first, then PRED-10 offset | Split model runs first; PRED-10 stacks on top | ✓ |

**User's choice:** Split first, then PRED-10 offset

---

## Wake Anchor Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Context parameter | Use context.todayWakeHHMM — already in context for napProbability | ✓ |
| Extract from today's events in forecast() | Let forecast() extract wake internally | |

**User's choice:** Context parameter

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to time-of-day percentiles | When no wake logged, use calculatePercentiles over napStart times | ✓ |
| Return null for nap predictions | No nap prediction until wake is logged | |

**User's choice:** Fall back to time-of-day percentiles

---

| Option | Description | Selected |
|--------|-------------|----------|
| Predicted nap-start central | Use PRED-21 prediction as nap-end anchor when actual not logged | ✓ |
| Time-of-day percentiles for nap-end too | Fall back to calculatePercentiles over napEnd times | |

**User's choice:** Predicted nap-start central

---

| Option | Description | Selected |
|--------|-------------|----------|
| Actual logged nap-start | Once napStart is logged today, use it as anchor | ✓ |
| Always use predicted nap-start | Always use prediction as anchor even when actual is known | |

**User's choice:** Actual logged nap-start

---

| Option | Description | Selected |
|--------|-------------|----------|
| New percentileFromArray() helper | Small helper for raw number arrays; calculatePercentiles doesn't fit | ✓ |
| Inline sort-and-index | Compute P10/P50/P90 inline wherever needed | |

**User's choice:** New percentileFromArray() helper

---

## Claude's Discretion

None — all decisions were made by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
