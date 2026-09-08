# Phase 18: Sleep Debt Proxy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 18-Sleep Debt Proxy
**Areas discussed:** Sleep target source, "Total sleep" formula

---

## Sleep Target Source

| Option | Description | Selected |
|--------|-------------|----------|
| User setting | Add `targetSleepMinutes` to DEFAULT_SETTINGS; user sets explicit goal in Settings modal | ✓ |
| Historical median | Compute subject's own all-time median of combinedSleepNap; no new setting | |

**User's choice:** User setting (`targetSleepMinutes`) — with the historical median shown as an inline hint in the Settings modal to help the user pick a sensible value.

### Follow-up: Median hint placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in Settings modal | Show "Your median: Xh Ym" next to the input as muted helper text | ✓ |
| As default value only | Pre-fill input with median; no visible hint | |

**Notes:** The median hint is computed from all-time `combinedSleepNap` data in `snap`; rendered alongside the `targetSleepMinutes` input.

### Follow-up: Default value

| Option | Description | Selected |
|--------|-------------|----------|
| 600 minutes (10h) | Baby/toddler baseline | ✓ |
| 540 minutes (9h) | Common adult target | |
| You decide | Claude picks | |

**Notes:** 600 min (10h) is appropriate for the subject's age context.

### Follow-up: Settings modal placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline with existing numeric settings | One more row in existing fieldset; no restructuring | ✓ |
| New fieldset or section | Dedicated "Sleep Target" area | |

---

## "Total Sleep" Formula

### Actual total sleep definition

| Option | Description | Selected |
|--------|-------------|----------|
| combinedSleepNap (night sleep + nap) | Full "total sleep"; no-nap days naturally show higher debt | ✓ |
| sleepDuration only | Night sleep only; simpler but inconsistent with "total sleep" label | |

**User's choice:** `combinedSleepNap` — matches MET-13 wording and the subject's actual sleep pattern.

### Null handling

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from window | Days with null combinedSleepNap skipped; window shrinks | ✓ |
| Treat as zero sleep | Full target counted as deficit on data-missing days | |

### Sign convention

| Option | Description | Selected |
|--------|-------------|----------|
| Positive = deficit | Positive when actual < target; negative allowed (surplus) | ✓ |
| Always non-negative (clamped) | No surplus concept; simpler display | |

**Notes:** Signed values allow surplus days to offset deficit days in the rolling sum. More informative.

---

## Claude's Discretion

- Column label/abbreviation in COLUMNS (e.g., "S.Debt")
- Column placement within COLUMNS array
- CSS class naming for debt-specific styles
- Implementation detail: whether `sleepDebtProxy` is called once per render pass or fresh per row

## Deferred Ideas

- MET-15: TIF integration using sleep debt as a prediction input signal — deferred to v1.5 per REQUIREMENTS.md
- Configurable debt window size (fixed at 7 days for this phase per MET-14)
