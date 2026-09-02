# Phase 18: Sleep Debt Proxy - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `sleepDebtProxy(dayRecords, windowDays)` to `js/lib/metrics.js` and a Sleep Debt column to the Metrics screen per-day table and all three aggregate sections (7-day rolling, 14-day rolling, all-time). The column shows the rolling 7-day accumulated sleep deficit in minutes for each day. A new `targetSleepMinutes` setting is added to `db-shape.js`, `settings-validate.js`, and the Settings modal (inline, with a historical median hint computed on render).

</domain>

<decisions>
## Implementation Decisions

### Sleep Target Source

- **D-01:** The "target total sleep" is a **user-configurable setting `targetSleepMinutes`** (integer, minutes). Default value: **600 minutes (10h)** — appropriate for the subject's age context (infant/toddler baseline).
- **D-02:** `targetSleepMinutes` is added to `js/lib/db-shape.js` `DEFAULT_SETTINGS`, validated in `js/lib/settings-validate.js` as a positive integer, and exposed in the Settings modal inline with existing numeric settings (no new fieldset).
- **D-03:** The Settings modal shows an **inline hint** next to the `targetSleepMinutes` input: the subject's all-time median of `combinedSleepNap` rendered as a human-readable duration (e.g., "Your median: 9h 45m"). Computed from `snap` data on render, shown as muted helper text. — **Reversibility:** reversible — the hint is a read-only computed value; removing or changing it touches only settings-screen.js.

### Total Sleep Formula

- **D-04:** "Actual total sleep" in the debt formula is **`combinedSleepNap`** (night sleep + nap duration). Consistent with MET-13's "total sleep" wording. On no-nap days, `combinedSleepNap` equals `sleepDuration`, which naturally yields higher debt when the target assumes typical nap time.
- **D-05:** Days where `combinedSleepNap` is `null` (missing wake or bedtime data) are **excluded** from the rolling window. They do not count toward `windowDays` and do not contribute to the deficit sum. Consistent with `aggregateMetrics`'s null-exclusion pattern.
- **D-06:** Sign convention: **positive = deficit** (actual sleep < target). Negative values are permitted (oversleeping days reduce the rolling sum). No clamping at zero — the full signed sum is returned.
- **D-07:** `sleepDebtProxy(dayRecords, windowDays)` returns `null` when fewer than `windowDays` non-rejected records with non-null `combinedSleepNap` are available. Consistent with MET-13 spec.

### Module Home

- **D-08:** `sleepDebtProxy` is exported from `js/lib/metrics.js` — not a new sibling module. Follows D-04 from Phase 17 (all day-record aggregation logic stays in one file). The function is pure; caller pre-filters (stage filter + rejected exclusion) before passing `dayRecords`.

### Claude's Discretion

- Column label/abbreviation in COLUMNS array (e.g., "S.Debt" or "Debt") — Claude picks to fit column header width conventions.
- Column placement within COLUMNS array (after `combinedSleepNap` or at end) — Claude decides based on logical grouping.
- CSS class naming for any new debt-specific styles.
- Whether `sleepDebtProxy` is called once and iterated per-day in render, or called fresh per row — Claude decides based on performance/readability.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Sleep Debt Proxy — MET-13 and MET-14 (the two requirements this phase satisfies)
- `.planning/ROADMAP.md` §Phase 18 — Goal, success criteria, depends-on note

### Key Source Files
- `js/lib/metrics.js` — Where `sleepDebtProxy()` will be added; `aggregateMetrics()` (line ~230) and `dayOfWeekAverages()` (line ~417) are the calling-convention patterns to follow (pure function, caller pre-filters)
- `js/ui/metrics-screen.js` — Metrics screen rendering: COLUMNS array (line ~42), `buildAggregateRow()` (line ~254), `buildRollingSection()` (line ~403), `buildCell()` (line ~162), table structure for adding new columns
- `js/lib/db-shape.js` — `DEFAULT_SETTINGS` — new `targetSleepMinutes` setting added here (default: 600)
- `js/lib/settings-validate.js` — Settings validator — `targetSleepMinutes` validation added here
- `js/ui/settings-screen.js` (or equivalent Settings modal UI file) — new `targetSleepMinutes` input with median hint

### Prior Phase Context
- `.planning/phases/NW-16-rolling-window-aggregates/16-CONTEXT.md` — Rolling section pattern (D-01 through D-10): COLUMNS extension, `buildAggregateRow`, cold-start annotation
- `.planning/phases/NW-17-day-of-week-patterns/17-CONTEXT.md` — Module home and calling convention decisions (D-04, D-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `combinedSleepNap(day)` (`metrics.js:87`) — already computes night sleep + nap, returns null when sleep is unavailable. The per-day debt is `targetSleepMinutes - combinedSleepNap(day)`.
- `aggregateMetrics(dayRecords)` (`metrics.js:230`) — pure function receiving pre-filtered records; `sleepDebtProxy` follows the same call convention.
- `buildAggregateRow(label, aggregateData, snap)` (`metrics-screen.js:254`) — builds min/avg/max rows for any column in COLUMNS. Adding Sleep Debt to COLUMNS automatically extends rolling and all-time aggregate rows.
- `buildRollingSection(nDays, label, nonRejectedDays, snap, isTif)` (`metrics-screen.js:403`) — builds rolling aggregate tbody; adding Sleep Debt to COLUMNS means it's included automatically.
- `buildCell(value, colDef, snap, minMaxDate)` (`metrics-screen.js:162`) — handles `—` for null values, formats minutes and ratios. The new debt column needs `isTime: false, isRatio: false`.

### Established Patterns
- **Caller pre-filters** — `aggregateMetrics()` and `dayOfWeekAverages()` receive already-filtered records. `sleepDebtProxy()` must follow the same contract.
- **Null exclusion** — days with null metric values are excluded from aggregates; same for debt computation.
- **COLUMNS extension** — adding a new `{ key, label, isTime, isRatio }` entry to `COLUMNS` automatically propagates the column to thead, `buildAggregateRow`, and `buildRollingSection` without additional changes.
- **`reversedDays.slice(-N)` for rolling windows** — the N most recent non-rejected days in oldest-first order; `sleepDebtProxy` uses the same slicing approach internally.
- **No midnight-crossing UTC** — time strings are local wall-clock. `combinedSleepNap` already handles this correctly.

### Integration Points
- **`render()` in `metrics-screen.js`** — per-day rows compute each column value from `dayRecords`; the Sleep Debt value for row `i` requires `sleepDebtProxy(dayRecords.slice(0, i+1), 7)` or equivalent.
- **`mountMetricsScreen(root, deps)`** — receives `snap` which includes `snap.settings.targetSleepMinutes`; this value is passed through to the debt computation.
- **Settings modal** — new `targetSleepMinutes` numeric input wired to settings store; median hint computed from `snap.days` using `combinedSleepNap` median.

</code_context>

<specifics>
## Specific Ideas

- Default `targetSleepMinutes = 600` (10h) — matches subject age context (infant/toddler baseline).
- Median hint format in Settings: `"Your median: Xh Ym"` — rendered as muted helper text below or beside the input.
- The column label in COLUMNS should be short (e.g., `"S.Debt"`) — consistent with other abbreviated column labels like `"Nap Frac"`, `"Day/Sleep"`, `"MA/Sl"`.
- The per-day debt value is the sum over the rolling window, not an average — it grows with the window size (max ~7 × targetSleepMinutes for a fully sleep-deprived week).
- Positive values = sleeping less than target (debt). Negative values = sleeping more than target (surplus).

</specifics>

<deferred>
## Deferred Ideas

- MET-15: TIF integration using sleep debt as a prediction signal — explicitly deferred to v1.5 per REQUIREMENTS.md "Out of Scope" table.
- Configurable window size for debt column (currently fixed at 7 days per MET-14) — future enhancement.

</deferred>

---

*Phase: 18-Sleep-Debt-Proxy*
*Context gathered: 2026-09-02*
