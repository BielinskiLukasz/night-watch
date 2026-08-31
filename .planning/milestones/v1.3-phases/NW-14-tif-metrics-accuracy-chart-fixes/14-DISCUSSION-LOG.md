# Phase 14: TIF Metrics, Accuracy & Chart Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 14-TIF-Metrics-Accuracy-Chart-Fixes
**Areas discussed:** TIF accuracy layout, MET-11 aggregate semantics, New column placement, MET-08 TIF bounds in Metrics

---

## TIF Accuracy Layout

### Q1: When TIF is active, what should the Accuracy screen show?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace classic grid with TIF grid | When TIF is active, show ONLY the TIF-specific grid | ✓ |
| Show both grids stacked | Classic grid on top, TIF-specific grid below when TIF is active | |
| Show TIF grid as primary, classic collapsible | TIF grid shown by default; classic collapses to a summary row | |

**User's choice:** Replace classic grid with TIF grid

### Q2: Data range for TIF accuracy grid?

| Option | Description | Selected |
|--------|-------------|----------|
| Same settings as classic | Reuse stage filter and rolling window from classic accuracy screen | ✓ |
| TIF uses tifRollingDays as its window | TIF accuracy computed over tifRollingDays instead of classic window | |

**User's choice:** Same settings as classic

### Q3: How to compute window hit rate?

| Option | Description | Selected |
|--------|-------------|----------|
| Run tifForecast retroactively per day | Same backtesting pattern as computeAccuracy | ✓ |
| Use stored algMin/algMax per-day from MET-08 | Reuse MET-08 per-day bounds | |

**User's choice:** Run tifForecast retroactively per day

### Q4: TIF accuracy grid visual structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Same 4×3 layout as classic | Mirror classic grid exactly | |
| 3 columns, same visual style as classic | 4 rows × 3 TIF-specific columns, same CSS style | ✓ |

**User's choice:** 3 columns, same visual style as classic — column labels: Window Hit / Avg Width / High Conf

---

## MET-11 Aggregate Semantics

### Q1: What do min-TIF / median-TIF / max-TIF rows represent?

| Option | Description | Selected |
|--------|-------------|----------|
| Historical average of algMin / central / algMax | avg(algMin_days), avg(central_days), avg(algMax_days) | ✓ |
| P10 / P50 / P90 of per-day algMin / central / algMax | Percentile aggregates showing spread | |

**User's choice:** Historical average of algMin / central / algMax

### Q2: Where do TIF aggregate rows appear?

| Option | Description | Selected |
|--------|-------------|----------|
| After existing aggregates (appended rows) | Three new rows after avg/min/max | ✓ |
| Interleaved with existing aggregates | Rows placed inside the aggregate section | |

**User's choice:** After existing aggregates (appended rows)

### Q3: TIF rows when TIF is off?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when TIF is off | Rows do not appear at all | ✓ |
| Shown greyed out when TIF is off | Visible but dimmed with tooltip | |

**User's choice:** Hidden when TIF is off

### Q4: TIF aggregate row event type coverage?

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 event types always (null for missing) | All columns present, null/dash when no TIF history | ✓ |
| Only event types where TIF produced predictions | Variable column set | |

**User's choice:** All 4 event types always (null for missing)

---

## New Column Placement

### Q1: Where should Nap Fraction and AM/PM Split appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Nap Fraction after Nap col; AM/PM Split after Act col | Adjacent to source data | ✓ |
| Both new columns after Day/Sleep Factor (end) | Append at end, minimize disruption | |
| Group all ratio columns together at end | Ratios as a block at right | |

**User's choice:** Nap Fraction after Nap col; AM/PM Split after Act col

### Q2: Formatting for new ratio columns?

| Option | Description | Selected |
|--------|-------------|----------|
| Decimal to 2 places (e.g. 0.42) | Pure decimal, consistent with AAS | ✓ |
| Percentage for Nap Fraction, decimal for AM/PM | Mixed formatting | |

**User's choice:** Decimal to 2 places (e.g. 0.42)

### Q3: Day/Sleep Factor slot?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in SAA's current slot (rightmost) | Minimal structural change | |
| Move next to Day Len column | Numerator adjacent to ratio | ✓ |

**User's choice:** Move next to Day Len column

---

## MET-08 TIF Bounds in Metrics

### Q1: How should TIF bounds be displayed for a day in Metrics?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline columns added to the main table | 12 additional columns at far right | ✓ |
| Detail row below the selected/highlighted day row | Sub-row on tap/click | |
| Separate section below the main table | Fixed 'TIF Bounds' section | |

**User's choice:** Inline columns added to the main table

### Q2: Column granularity for TIF columns?

| Option | Description | Selected |
|--------|-------------|----------|
| Full 12 columns (TIF Min/Max/Conf per event type) | 3 columns × 4 event types | ✓ |
| 4 columns with combined display (e.g. '07:15–07:45 • 82%') | Compact combined format | |
| Only confidence score column per event type (+4 cols) | Minimal addition | |

**User's choice:** Full 12 columns (TIF Min/Max/Conf per event type)

### Q3: Where do TIF columns appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped at the far right (after all existing columns) | Horizontal scroll reveals TIF data | ✓ |
| Interleaved after each event-type group | Adjacent to each event's base data | |

**User's choice:** Grouped at the far right (after all existing columns)

### Q4: Retroactive TIF computation: shared engine or inline?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared retroactive engine (reuse from TIF accuracy) | One computeTifBoundsHistory for both MET-08 and TIF-14 | ✓ |
| Computed inline in metrics-screen.js | Local computation, simpler to reason about | |

**User's choice:** Shared retroactive engine (reuse from TIF accuracy)

---

## Claude's Discretion

- Column header label abbreviations for narrow columns (e.g., `W-min`, `W-max`, `W-conf` for TIF columns)
- Nap series colors on the Wake & Bedtime Bands chart (no explicit preference)
- `accuracy-tif.js` internal structure (mirror `accuracy.js` pattern)
- `<colgroup>` or colspan header for visual grouping of TIF columns

## Deferred Ideas

- Post-no-nap nap-duration window for TIF-16: noted for Phase 15 if needed
- Per-day TIF bounds caching in localStorage for large datasets: future optimization
- Classic + TIF side-by-side accuracy comparison: noted for v1.4 backlog
