---
slug: tif-card-expand
date: 2026-07-13
status: complete
---

# Summary: TIF Normal Card — Collapsible + Evidence Windows

## What was done

Converted `renderTifNormalCard` in `js/ui/today-screen.js` from a flat always-visible card to a collapsible card matching the pattern of `renderTifLowConfidenceCard`.

- Cards now start collapsed: summary row shows `Label — central — range ↓`
- Clicking expands: reveals uppercase label, central time, display band, algorithm range (when > precisionTarget), `tif-source-list` of source evidence windows, precision score badge
- Click again to collapse (chevron flips ↓/↑)

## Files changed

- `js/ui/today-screen.js` — `renderTifNormalCard()` rewritten
- `tests/e2e/tif.spec.js` — Test updated to assert collapsed-by-default and expand-to-reveal behaviour

## Commit

`13fc528` — feat(ui): make TIF normal cards collapsible with evidence windows on expand

## Test result

591 unit pass, 0 fail | 107 E2E pass (3 TIF specs)
