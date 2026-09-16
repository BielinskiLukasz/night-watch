# Phase 23: Metrics→Accuracy Column Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 23-metrics-accuracy-column-migration
**Areas discussed:** Accuracy screen layout, Window width column, Metrics screen cleanup scope, Per-day table scope on Accuracy

---

## Accuracy screen layout

| Option | Description | Selected |
|--------|-------------|----------|
| New per-day table below summary | Add a new per-day table underneath the existing TIF summary grid, mirroring Metrics screen's row structure | ✓ |
| Replace/merge into existing TIF grid | Restructure the shipped 4×3/TIF summary grid to show expandable per-day detail | |
| You decide | Claude picks layout fitting existing DOM/CSS patterns | |

**User's choice:** New per-day table below summary.

Follow-up questions in this area:

- **Visibility:** TIF-only visibility (matches Metrics' `td.hidden = !isTif`) vs. always visible with dashes → **TIF-only visibility** selected.
- **Table formatting:** Match Metrics exactly (sticky Date column, most-recent-first) vs. You decide → **Match Metrics exactly** selected.
- **DOM integration:** Append inside `renderTifAccuracy()`'s existing `<section>` (single `root.replaceChildren`) vs. You decide → **Append inside existing section** selected.
- **Sub-heading:** Add a distinguishing sub-heading (e.g. "Per-Day TIF Windows") vs. no separating heading → **Add sub-heading** selected.

**Notes:** Accuracy screen currently has zero per-day rows anywhere — this is new UI, not a toggle. User confirmed the summary/per-day split should stay visually distinct via a sub-heading.

---

## Window width column

| Option | Description | Selected |
|--------|-------------|----------|
| Move existing 3 fields only | Migrate exactly the shipped min/max/confidence fields (12 columns); treat ROADMAP's "window width" wording as already covered by min+max | ✓ |
| Add a derived width column too | Add max−min as a new 4th field per event (16 columns), matching ROADMAP wording literally | |

**User's choice:** Move existing 3 fields only.

**Notes:** ROADMAP.md's phase description names a "window width" field that was never actually shipped in `TIF_COLUMNS` (only min/max/confidence exist in code). User confirmed this phase is a pure relocation — no new computed field.

---

## Metrics screen cleanup scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full clean removal | Delete `TIF_COLUMNS` and all referencing code; table shrinks to 19 columns | ✓ |
| Keep constant, stop rendering | Leave `TIF_COLUMNS` defined but unused | |

**User's choice:** Full clean removal.

Follow-up questions in this area:

- **Import scope:** Remove `computeTifBoundsHistory` import + call site (only used to feed the removed columns) vs. You decide → **Remove import + call site** selected. Note: `isTif` itself stays in `metrics-screen.js` — it still gates unrelated TIF-only UI (e.g. `buildTifAggregateRow`'s trimmed-stat rows).
- **Scope confirmation:** Confirmed ~7 call sites across the file are in scope (buildDayRow, buildTifAggregateRow, buildRollingSection ×2, thead header building, summary section ×2); confirmed no CSS depends on the 30-column layout → **Settled, no additional concerns**.

**Notes:** This is a straightforward, full deletion — no partial/hidden-toggle approach, consistent with the project's "delete unused code completely" convention.

---

## Per-day table scope on Accuracy

| Option | Description | Selected |
|--------|-------------|----------|
| Full history (match Metrics) | Show every logged day, same as Metrics screen today | ✓ |
| Scope to TIF rolling window | Only show the last `tifRollingDays` days | |

**User's choice:** Full history (match Metrics).

Follow-up questions in this area:

- **Rejected-day dimming:** Cross-reference the `days` array by date to dim rejected rows (parity with Metrics) vs. skip dimming → **Cross-reference and dim** selected.

**Notes:** `computeTifBoundsHistory`'s returned entries don't carry a `rejected` flag; implementation must join by date against the `days` array already computed in `accuracy-screen.js`'s `render()`.

---

## Claude's Discretion

- Exact sub-heading text for the new per-day table (e.g. "Per-Day TIF Windows").
- Whether the new table is a `<table>` element — user did not explicitly confirm this, but `buildTifAccuracyGrid` already establishes `<table>` as the TIF-branch convention (vs. the classic path's div-based CSS grid), so this was left as an inferred default rather than asked directly.
- Internal function/helper naming in `accuracy-screen.js` (new per-day table builder, date-keyed rejected lookup).

## Deferred Ideas

None — discussion stayed within phase scope.
