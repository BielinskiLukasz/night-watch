# Phase 20: Nap Probability Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 20-nap-probability-redesign
**Areas discussed:** New-signal cold-start behavior, Weekday nap-rate lookback window, Sleep-debt signal normalization, Weight values: requirement text vs. shipped code

---

## New-signal cold-start behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Redistribute weight | Renormalize remaining available signals' weights to sum to 100% | ✓ |
| Treat missing as neutral (0.5) | Missing signal contributes its full weight at a neutral midpoint | |
| Return null until all signals available | Matches Phase 19 D-07's null-on-cold-start pattern | |

**User's choice:** Redistribute weight (recommended)

**Follow-up 1 — Redistribution mechanics:**

| Option | Description | Selected |
|--------|-------------|----------|
| Proportional scaling | `newWeight = originalWeight / sum(available weights)` | ✓ |
| Fixed fallback table | Hand-picked alternate weights per missing-signal scenario | |

**User's choice:** Proportional scaling (recommended)

**Follow-up 2 — Return shape:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep single number | No API change; signal-availability detail stays internal | |
| Return richer object with signal breakdown | `{ score, signalsUsed }` for future UI transparency | ✓ |

**User's choice:** Return richer object with signal breakdown

**Follow-up 3 — Where the object gets unwrapped:**

| Option | Description | Selected |
|--------|-------------|----------|
| today-screen.js only | Unwrap `.score` immediately; forecast.js's Phase 19 blend code untouched | |
| Propagate into forecast.js | `context.napProbabilityScore` itself becomes the object; forecast.js blend logic updated | ✓ |

**User's choice:** Propagate the object into forecast.js

**Follow-up 4 — Shape consistency across cold-start/window-closed/real-score:**

| Option | Description | Selected |
|--------|-------------|----------|
| Always object | `{ score: null\|0\|N, signalsUsed, confidence }` in every case — one shape everywhere | ✓ |
| Object only for real scores | Cold-start/window-closed keep bare null/0; only 1-100 case wrapped | |

**User's choice:** Always object (recommended)

**Notes:** Captured as D-01 through D-04 in CONTEXT.md, including the exact call-site list in `forecast.js` and `today-screen.js` that must be updated to unwrap `.score` (including the UI string-rendering sites that would otherwise print `[object Object]%`).

---

## Weekday nap-rate lookback window

| Option | Description | Selected |
|--------|-------------|----------|
| All history | fraction = napDays-on-weekday / total-days-on-weekday across everything recorded | ✓ |
| Capped recent window (e.g. last 8-12) | Tracks recent pattern shifts faster; needs new setting + slicing helper | |

**User's choice:** All history (recommended)

**Follow-up 1 — Minimum count for availability:**

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse settings.minDays | Same threshold as the overall napProbability() cold-start gate | ✓ |
| Fixed small floor (2-3 days) | Independent guard against noisy early signal | |

**User's choice:** Reuse settings.minDays (recommended)

**Follow-up 2 — Threading today's weekday into the pure function:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, context.todayWeekday | today-screen.js computes it, follows Phase 19 D-13 precedent | ✓ |
| You decide | Let the planner pick the exact field name/shape | |

**User's choice:** Yes, context.todayWeekday (recommended)

**Notes:** Captured as D-05 through D-07 in CONTEXT.md, plus an implementation note flagging that `dayOfWeekAverages()` doesn't currently expose a nap-rate/count field (left to planner discretion how to add it).

---

## Sleep-debt signal normalization

| Option | Description | Selected |
|--------|-------------|----------|
| Clamp ±180 min, linear map to 0-1 | 0 min → 0.5 neutral, +180 → 1.0, -180 → 0.0 | ✓ |
| Scale relative to targetSleepMinutes | Divide debt by the per-user target setting instead of a fixed constant | |
| You decide | Let the planner pick a reasonable normalization | |

**User's choice:** Clamp ±180 min, linear map to 0-1 (recommended)

**Follow-up 1 — Window/target reuse:**

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse 7-day window + targetSleepMinutes | Same values already used by Metrics screen's Sleep Debt column | ✓ |
| Different window size | Shorter window to react faster; needs a new setting | |

**User's choice:** Reuse 7-day window + targetSleepMinutes setting (recommended)

**Follow-up 2 — Clamp bound sanity check:**

| Option | Description | Selected |
|--------|-------------|----------|
| ±180 min is fine | Keep the originally proposed bound | ✓ |
| Tighter (±90-120 min) | If typical swings are smaller | |
| Wider (±240-300 min) | If typical swings are larger | |

**User's choice:** ±180 min is fine (recommended)

**Notes:** Captured as D-08 and D-09 in CONTEXT.md. User confirmed the ±180 bound against their own sense of the data's typical weekly swings — flagged in `<specifics>` as worth a quick check-in if implementation reveals a mismatch.

---

## Weight values: requirement text vs. shipped code

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, 35/30/20/15 | Matches ROADMAP.md/REQUIREMENTS.md percentages exactly; only combination summing to 100% | ✓ |
| Keep current 40/20, adjust new signals instead | Preserve shipped napFrequency/noNapStreak weights; shrink new signals instead | |

**User's choice:** Yes, 35/30/20/15 (recommended)

**Notes:** Captured as D-10 in CONTEXT.md. Resolves a real discrepancy between the shipped `NAP_SCORE_WEIGHTS` constant (40%/20%) and the requirement text's "retain 35%/15%" wording — the requirement's explicit percentages win.

---

## Claude's Discretion

- Exact naming/internal helper structure for computing `dayOfWeekNapRate` (extend `dayOfWeekAverages()` vs. a separate helper).
- Whether `NAP_SCORE_WEIGHTS` keeps its current object shape or is restructured, as long as it stays `Object.freeze`d and sums to 1.0.

## Deferred Ideas

None — discussion stayed within phase scope.
