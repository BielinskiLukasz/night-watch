---
phase: NW-09
plan: 03
subsystem: ui
tags: [ui, forecast, collapse, toggle, TDD]
status: complete
committed: true
requirements: [UI-09]
decisions:
  - renderPredictionCard: hasProbBand branch now renders collapsed by default with .card-summary (compact row) + .card-full (expandable content) structure; event-label moved inside else branch
  - Click handler uses classList.toggle returning boolean to flip chevron ↓/↑ in one expression
  - No state tracking needed: replaceChildren() in renderForecastSection() resets collapse state on every re-render (D9-06)
key-files:
  created:
    - tests/integration/today-card-collapse.test.js
  modified:
    - js/ui/today-screen.js
    - style.css
metrics:
  duration: ~7 minutes
  completed: 2026-07-10
  tasks_completed: 1
  files_changed: 3
---

# Phase 9 Plan 03: Prediction Card Collapse (UI-09) Summary

**One-liner:** Probability-band forecast cards collapse to a compact "Label • startTime–endTime ↓" row by default; clicking expands to the full probability list.

## Requirements Met

- **UI-09** — Prediction card collapse/expand for hasProbBand cards

## Changes

### `js/ui/today-screen.js`

- `renderPredictionCard` exported (previously unexported, needed for integration test)
- **hasProbBand branch** rewritten (UI-09 / D9-05):
  - `card.classList.add('collapsed')` on entry
  - Compact summary: `el('span', { className: 'card-summary' })` containing `.card-summary-label` (text: "EventLabel • HH:MM–HH:MM") and `.card-chevron` (text: '↓')
  - Full content: `el('div', { className: 'card-full' })` containing event-label `<p>` + `<ul class="prob-list">`
  - Click handler: `card.classList.toggle('collapsed')` → returns boolean → chevron updated to '↑'/'↓'
- **else branch** (non-prob-band): event-label `<p>` moved here (was unconditional before the if/else); time-central + time-band unchanged

### `style.css`

New rules added after `.prediction-card.probability-band .prob-list li`:

```css
/* UI-09: collapsed probability-band forecast card */
.prediction-card.collapsed .card-full { display: none; }
.prediction-card.collapsed .card-summary { display: flex; align-items: center; justify-content: space-between; min-height: 44px; width: 100%; }
.prediction-card:not(.collapsed) .card-summary { display: none; }
.card-summary-label { font-size: 0.875rem; font-weight: 400; color: #1a1a1a; }
.card-chevron { font-size: 1rem; color: #64748b; flex-shrink: 0; margin-left: 0.5rem; }
.prediction-card:hover .card-chevron { color: #4f46e5; }
.prediction-card.collapsed { cursor: pointer; }
```

### `tests/integration/today-card-collapse.test.js` (new)

Integration test (node:test) with minimal DOM mock (MockNode/MockElement/MockClassList) covering:
1. hasProbBand=true: `.collapsed` class present by default
2. `.card-summary` child exists
3. `.card-chevron` child has textContent '↓' (U+2193)
4. `.card-full` child exists
5. Click: `.collapsed` removed, chevron → '↑' (U+2191)
6. Second click: `.collapsed` restored, chevron → '↓'
7. hasProbBand=false: no `.collapsed`, no `.card-summary`

## Tests

All 507 unit + integration tests pass (0 failures):
- New: 8/8 today-card-collapse.test.js tests pass
- No regressions in existing suite

## TDD Gate Compliance

- RED commit: `ce5a64e` — test(NW-09-03): add failing tests (6 failed, 2 passed)
- GREEN commit: `3404ee0` — feat(NW-09-03): collapse probability-band cards by default

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Click handler only manipulates CSS classes and static Unicode characters on elements created per-render; no user data involved (T-09-03-01 / T-09-03-02 accepted as-is per threat model). T-09-03-03 (listener accumulation) mitigated by replaceChildren() pattern as designed.

## Known Stubs

None — all new DOM structure connects directly to EVENT_TYPE_LABEL (frozen object) and formatHHMM() output.

## Self-Check: PASSED

- `js/ui/today-screen.js` modified: confirmed (508 lines, exports renderPredictionCard)
- `style.css` modified: confirmed (collapsed rules present, grep -c 'collapsed' returns 7)
- `tests/integration/today-card-collapse.test.js` created: confirmed
- RED commit `ce5a64e`: present in git log
- GREEN commit `3404ee0`: present in git log
- 507/507 tests pass: confirmed by npm run test:unit
