# Phase 16: Rolling Window Aggregates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 16-Rolling Window Aggregates
**Areas discussed:** Section layout, Window ordering, TIF column treatment, Cold-start labeling

---

## Section layout

| Option | Description | Selected |
|--------|-------------|----------|
| Same table, tbody groups | One wide table; each section is a `<tbody>` starting with a full-width section-header row, then Min/Avg/Max rows | ✓ |
| Separate tables + headings | Three independent `<table>` blocks under `<h3>` headings | |
| You decide | Let the planner choose | |

**User's choice:** Same table, tbody groups

---

| Option | Description | Selected |
|--------|-------------|----------|
| All-time / Last 7 days / Last 14 days | Conversational style | |
| All-time / 7-day rolling / 14-day rolling | Technical style emphasising rolling window | ✓ |
| You decide | Claude picks | |

**User's choice:** All-time / 7-day rolling / 14-day rolling

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width cell spanning all columns | `<td colspan=all>` as divider | ✓ |
| Bold label in the first cell only | Label in sticky column, rest empty | |
| You decide | Claude picks | |

**User's choice:** Full-width cell spanning all columns

---

| Option | Description | Selected |
|--------|-------------|----------|
| All-time only for TIF rows | TIF aggregate rows only in all-time section | ✓ |
| TIF rows in all three sections | Each section gets TIF rows | |
| You decide | Claude picks | |

**User's choice:** All-time only for TIF rows

---

| Option | Description | Selected |
|--------|-------------|----------|
| Styled like column headers (muted bg, bold, uppercase) | Mirror thead th styling | ✓ |
| Distinct accent color strip | Unique background color | |
| You decide | Claude picks | |

**User's choice:** Styled like column headers (muted bg, bold, uppercase)

---

## Window ordering

| Option | Description | Selected |
|--------|-------------|----------|
| All-time → 7-day rolling → 14-day rolling | Big picture first | |
| 7-day rolling → 14-day rolling → All-time | Most-recent-first | ✓ |
| 14-day rolling → 7-day rolling → All-time | Widest window first | |

**User's choice:** 7-day rolling → 14-day rolling → All-time

---

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregates above, per-day rows below | Summary stats on top, drill-down below | ✓ |
| Per-day rows above, aggregates below | Raw data first | |

**User's choice:** Aggregates above, per-day rows below

---

| Option | Description | Selected |
|--------|-------------|----------|
| Non-rejected day records (same filter as all-time) | Exclude rejected=true days | ✓ |
| Days with at least one non-null metric value | Stricter filter | |

**User's choice:** Non-rejected day records (same filter as all-time)

---

## TIF column treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Em-dash (—) in all TIF cells for rolling rows | Simple, no per-window TIF computation | ✓ |
| Hidden cells (colspan adjustment) | Reduce visual noise | |
| You decide | Claude picks | |

**User's choice:** Em-dash (—) in all TIF cells for rolling rows

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same tbody as all-time Min/Avg/Max | TIF rows stay in all-time tbody — no restructuring | ✓ |
| Separate all-time tbody for TIF rows | Split all-time into two tbodies | |

**User's choice:** Same tbody as all-time Min/Avg/Max

---

## Cold-start labeling

| Option | Description | Selected |
|--------|-------------|----------|
| Section label + day count note | e.g. "7-day rolling (3 days available)" | ✓ |
| Section label only, cells show — silently | No annotation | |
| Hide section entirely when insufficient data | Conflicts with MET-SC4 | |

**User's choice:** Section label + day count note

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only when insufficient (< N days) | Normal state: plain label; cold-start: label + count | ✓ |
| Always show the count | Always annotated | |

**User's choice:** Only when insufficient (< N days)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show Min/Avg/Max rows with all — cells | Full row structure always present | ✓ |
| Section-header row only (no data rows) | Minimise empty rows | |

**User's choice:** Show Min/Avg/Max rows with all — cells

---

## Claude's Discretion

- CSS class name for section-header rows
- Whether to extract a `buildRollingSection()` helper or inline the logic

## Deferred Ideas

None — discussion stayed within phase scope.
