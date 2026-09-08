# Phase 17: Day-of-Week Patterns - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 17-day-of-week-patterns
**Areas discussed:** No-nap day handling, Module home for dayOfWeekAverages, Section placement, Collapsibility mechanism

---

## No-nap day handling

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude silently | No-nap days are omitted from nap averages; cell shows `—` when null | ✓ |
| Explicit null pass-through | Return null for no-nap days explicitly in the data structure | |
| Include with zero | Count no-nap days as nap duration = 0 | |

**User's choice:** Exclude silently

| Option | Description | Selected |
|--------|-------------|----------|
| Nap start absent = no-nap day | If napStart is missing, day is no-nap | ✓ |
| Both nap-start and nap-end absent | Both must be absent to qualify as no-nap | |

**User's choice:** Nap start absent = no-nap day

| Option | Description | Selected |
|--------|-------------|----------|
| No — just show `—` when null | No sample count shown; silent null | ✓ |
| Show sample count per cell | Annotate each cell with how many days contributed | |

**User's choice:** No — just show `—` when null. No sample count annotation.

---

## Module home for dayOfWeekAverages

| Option | Description | Selected |
|--------|-------------|----------|
| In metrics.js | Extend existing lib with one more export | ✓ |
| New sibling: metrics-dow.js | Separate module for weekday grouping logic | |

**User's choice:** In metrics.js

| Option | Description | Selected |
|--------|-------------|----------|
| Just the 4 required (MA, AA, nap duration, sleep duration) | Minimal per MET-11 | |
| All columns the Metrics table shows | Complete set; UI displays 4 but function returns more | ✓ |

**User's choice:** All columns the Metrics table shows

| Option | Description | Selected |
|--------|-------------|----------|
| Wake date | Consistent with aggregateMetrics() convention | ✓ |
| Bedtime date | Attribution to bedtime date | |

**User's choice:** Wake date for weekday attribution

| Option | Description | Selected |
|--------|-------------|----------|
| Caller pre-filters | Same convention as aggregateMetrics() | ✓ |
| Function filters internally | Self-contained filtering | |

**User's choice:** Caller pre-filters (stage filter + rejected exclusion applied before call)

---

## Section placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below all-time section, above per-day rows | Between aggregates and per-day rows | ✓ |
| Below the entire main table | After per-day rows | |
| Above the rolling aggregates | Top of the screen | |

**User's choice:** Below all-time section, above per-day rows (rendered as standalone element after the main metrics table)

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone table, 4-column | Own table: Weekday, MA, AA, Nap dur, Sleep dur | ✓ |
| Integrated tbody in main table | Same column structure as main metrics table | |

**User's choice:** Standalone 4-column table

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed Mon–Sun | No new setting needed | |
| Respect first-day-of-week setting | New setting: Monday or Sunday | ✓ |

**User's choice:** Add firstDayOfWeek setting in this phase (Monday or Sunday, default Monday)

**Notes:** Adding firstDayOfWeek requires db-shape.js, settings-validate.js, and Settings UI changes. User chose to include it in scope despite the additional work.

---

## Collapsibility mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| HTML `<details>/<summary>` | Native browser collapse, no JS handler | ✓ |
| CSS class toggle | Matches existing prediction card pattern in today-screen.js | |

**User's choice:** HTML `<details>/<summary>`

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsed by default | No `open` attribute on render | ✓ |
| Expanded by default | `open` attribute present on render | |

**User's choice:** Collapsed by default

**Section header label:** "Day-of-Week Patterns" (exact per MET-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to collapsed on re-render | replaceChildren() rebuilds; no state tracking | ✓ |
| Preserve open state across re-renders | Read open attr before rebuild, restore after | |

**User's choice:** Reset to collapsed on re-render (consistent with D9-06)

---

## Claude's Discretion

- CSS class names for DoW section, table, and rows
- Helper function extraction for row building (vs. inline)
- Settings modal UI widget type for firstDayOfWeek (dropdown vs. radio buttons)

## Deferred Ideas

- Full 7-option first-day-of-week (any weekday Mon–Sun) — deferred; Monday/Sunday only for v1
- Persisting DoW open/closed state across re-renders — deferred per D-14
