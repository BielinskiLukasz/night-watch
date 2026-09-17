---
phase: 23-metrics-accuracy-column-migration
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - js/ui/accuracy-screen.js
  - style.css
  - tests/e2e/accuracy-screen.spec.js
  - js/ui/metrics-screen.js
  - tests/e2e/metrics.spec.js
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-09-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the UI-11 column migration: plan 23-01 added a "Per-Day TIF Windows"
table to the Accuracy screen (`buildTifPerDayTable`), and plan 23-02 cleanly
removed the equivalent 12 inline TIF columns from the Metrics screen. The
functional migration itself is solid — column counts, header labels, and
row-source semantics (`days` vs `tifBoundsHistory`) all check out against the
E2E assertions, and no `innerHTML`/dynamic-HTML injection was introduced;
every dynamic cell in both files is set via `textContent`, consistent with
the project's XSS-guard convention.

No security or correctness (BLOCKER-class) issues were found. The main
defect is a layout regression: the new per-day TIF table was not given the
horizontal-scroll wrapper that the table it replaces (`.metricsTableScroll`)
had, so it can overflow the viewport with no way to scroll it back into
view — a real risk given this is a mobile-first PWA. A second, related
finding is a visual-consistency gap between the newly-styled table and its
unstyled sibling table in the same section. Both are flagged as warnings.
Remaining findings are minor code-quality/documentation items.

## Warnings

### WR-01: Per-Day TIF Windows table has no horizontal-scroll container — will overflow the viewport on mobile

**File:** `js/ui/accuracy-screen.js:406-472`, `style.css:1833-1880`

**Issue:**
`buildTifPerDayTable` renders a 13-column table (`Date` + 12 TIF fields) with
`white-space: nowrap` cells and `position: sticky` header/first-column rules
that explicitly "mirror .metricsTable's sticky-header/sticky-first-column…
exactly" (style.css comment at line 1828). But the table this migrates
*from* (`.metricsTable` on the Metrics screen) is wrapped in a dedicated
scroll container:

```js
// js/ui/metrics-screen.js:559-563
const tableScroll = document.createElement('div');
tableScroll.className = 'metricsTableScroll';   // overflow-x/y: auto; max-height: ...
...
root.replaceChildren(stageBadge, tableScroll);
```

`renderTifAccuracy` in accuracy-screen.js has no equivalent wrapper — the
table is appended straight into a plain `<section class="accuracy-section">`
which is appended straight into `root` (`#accuracy-screen`, a bare
`.screen-section` with no `overflow` rule):

```js
// js/ui/accuracy-screen.js:563-581
function renderTifAccuracy(root, tifStats, snap, tifBoundsHistory, days) {
  const section = document.createElement('section');
  section.className = 'accuracy-section';   // no CSS rule exists for this class at all
  ...
  section.appendChild(buildTifPerDayTable(days, tifBoundsHistory, snap));
  root.replaceChildren(section);
}
```

Neither `.accuracy-section` nor `#accuracy-screen` nor `body`/`#app` has any
`overflow-x` rule (confirmed: no `.accuracy-section` selector exists in
style.css at all, and `body`/`#app` have no `overflow-x: hidden`). A
13-column nowrap table with sticky positioning will push the whole document
wider than the viewport on any narrow/mobile screen, causing page-level
horizontal scroll with no scoped scroll affordance, and defeating the point
of the sticky header/date column (which only makes sense inside a bounded
scrollable ancestor, as `.metricsTableScroll` provides for `.metricsTable`).
This is a genuine UX regression for a mobile-first PWA, and it wasn't caught
by the new E2E test (`accuracy-screen.spec.js`) because Playwright's default
desktop viewport (1280×720) is wide enough to hide the overflow.

**Fix:** Wrap the TIF section content in a scroll container mirroring
`.metricsTableScroll`, e.g.:

```js
function renderTifAccuracy(root, tifStats, snap, tifBoundsHistory, days) {
  const section = document.createElement('section');
  section.className = 'accuracy-section';
  ...
  const scroll = document.createElement('div');
  scroll.className = 'tifPerDayTableScroll'; // overflow-x/y: auto; max-height: ...
  scroll.appendChild(buildTifPerDayTable(days, tifBoundsHistory, snap));
  section.appendChild(scroll);
  root.replaceChildren(section);
}
```
and add the matching CSS rule (copy `.metricsTableScroll`'s `overflow-x/y:
auto; max-height: calc(100vh - 8rem);`). Also consider adding a mobile
viewport (e.g. 375px width) E2E/visual check so this class of regression is
caught going forward.

### WR-02: `.tifAccuracyTable` has zero CSS rules, creating a jarring inconsistency next to the newly-styled `.tifPerDayTable`

**File:** `style.css` (no `.tifAccuracyTable` rule exists anywhere), `js/ui/accuracy-screen.js:288-378`

**Issue:** Plan 23-01 added the `.tifAccuracyTable` class specifically as a
"Selector-safety hook only (no visual/structural change)" (comment at
accuracy-screen.js:290-292) so E2E locators could disambiguate it from the
new `.tifPerDayTable` now stacked directly beneath it in the same
`<section class="accuracy-section">`. However, that decision means the
summary table renders with zero custom styling (default UA table borders,
no sticky header, no `border-collapse`, no consistent font-size) directly
above a table that now has full sticky-header/sticky-column/tabular-nums
styling. Before this migration the two tables were never visually adjacent
(the per-day data used to live on a different screen entirely), so this
stark before/after contrast is a new, migration-introduced visual defect,
not a pre-existing one.

**Fix:** Give `.tifAccuracyTable` at minimum a `border-collapse: collapse`
and matching `font-size`/header styling so the two tables in the same
section read as one visual system, e.g. reuse the same base rules as
`.tifPerDayTable`:

```css
.tifAccuracyTable {
  border-collapse: collapse;
  font-size: 0.9rem;
  width: 100%;
  background-color: #fff;
}
.tifAccuracyTable th {
  background-color: #f1f5f9;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}
.tifAccuracyTable td {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
}
```

## Info

### IN-01: Unused `snap` parameter in `buildTifAccuracyGrid`

**File:** `js/ui/accuracy-screen.js:288`, `js/ui/accuracy-screen.js:570`
**Issue:** `buildTifAccuracyGrid(stats, snap)` accepts `snap` but never
reads it ("accepted for future extension — not used now" per its own
docstring at line 285). Dead parameter increases cognitive load for
readers/reviewers tracing data flow.
**Fix:** Drop the parameter until it's actually needed, or reference it
somewhere (e.g. `timeFormat`-aware formatting) if that's genuinely planned
soon.

### IN-02: TIF min/max/conf cell-formatting logic duplicated instead of shared

**File:** `js/ui/accuracy-screen.js:447-460`
**Issue:** `buildTifPerDayTable`'s per-column formatting (`formatTime` for
`min`/`max`, `precisionScore.toFixed(2)` for `conf`, `'—'` fallback)
reimplements, in a new file, essentially the same branch logic that used to
live in `metrics-screen.js`'s now-deleted TIF-column loop (see the removed
code in commit `66f8616`: `if (field === 'min') cellText =
formatTime(bounds.algMin, snap.timeFormat); else if (field === 'max') ...
else if (field === 'conf') ...`). Since the pattern was carried over
verbatim into a new location rather than extracted into a shared helper
(e.g. in `time.js` or `accuracy-tif.js`), any future change to TIF bounds
formatting (e.g. adding a unit suffix, changing precision) risks being
applied in only one of the two places if either screen ever needs it again.
**Fix:** Consider extracting a small `formatTifBoundsCell(bounds, field,
timeFormat)` helper (in `time.js` or `accuracy-tif.js`) that both current
and any future TIF-bounds-rendering call sites can share.

### IN-03: Stale doc comments in metrics-screen.js not corrected while the file was touched by this migration

**File:** `js/ui/metrics-screen.js:525`, `js/ui/metrics-screen.js:237`
**Issue:** `mountMetricsScreen`'s docstring still says "Renders a 14-column
table…" (line 525) and `computeTifTrimmedStats`'s docstring still says "for
each base metric column (indices 1–17)" (line 237). Both predate phase 23
(column count has been 19 for a while, per the `COLUMNS` array and the
`buildSectionHeaderRow` colspan comment which *was* correctly updated to
"= 19" by commit `66f8616`), but since plan 23-02 already touched this file
and updated the nearby colspan comment, leaving these two stale references
uncorrected is a missed opportunity that will keep confusing future readers
about the true column count.
**Fix:** Update to "19-column table" and "indices 1–18" respectively.

---

_Reviewed: 2026-09-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
