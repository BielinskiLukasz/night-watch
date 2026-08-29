---
phase: NW-14
plan: "04"
subsystem: accuracy-screen
tags: [tif, accuracy, ui, tif-14]
status: complete

dependency_graph:
  requires:
    - 14-02  # accuracy-tif.js (computeTifBoundsHistory, computeTifAccuracy)
  provides:
    - TIF accuracy 4×3 grid in accuracy-screen.js
  affects:
    - js/ui/accuracy-screen.js

tech_stack:
  added: []
  patterns:
    - isTif branch pattern (snap.forecastAlgorithm === 'tif') for algorithm-specific rendering
    - nested renderAccuracy / renderTifAccuracy helpers encapsulating DOM logic inside mountAccuracyScreen
    - TIF_ACCURACY_ROWS / TIF_ACCURACY_COLS frozen constants mirroring ACCURACY_ROWS / ACCURACY_COLS

key_files:
  created: []
  modified:
    - js/ui/accuracy-screen.js

decisions:
  - "D-01: TIF mode replaces classic grid entirely in accuracy-screen — isTif branch is additive, classic path is preserved unchanged"
  - "activityLog obtained via eventLog.getActivityLog() inside render() — no app.js changes needed (ASSUMPTION TIF-14 activityLog)"
  - "windowHit and highConf cells extract .pct from { count, pct } objects returned by computeTifAccuracy"
  - "renderTifAccuracy uses root.replaceChildren(section) — independent from stageBadge/gridRoot permanent structure used by classic path"

metrics:
  duration_min: 7
  completed_date: "2026-08-27"
  tasks_completed: 2
  tasks_total: 2
  commits: 2
  files_changed: 1

estimate:
  tokens: 65000
  tasks: 2

actuals:
  tokens: 5000
  tasks: 2
  commits: 2
---

# Phase NW-14 Plan 04: TIF Accuracy Screen Grid Summary

**One-liner:** TIF accuracy 4×3 grid (Win Hit %, Avg Width ±N min, High Conf %) wired to computeTifBoundsHistory + computeTifAccuracy in accuracy-screen.js via isTif branch.

## What Was Built

Added TIF accuracy rendering to `js/ui/accuracy-screen.js` via a clean isTif branch. When `snap.forecastAlgorithm === 'tif'`, the Accuracy screen now calls `computeTifBoundsHistory` and `computeTifAccuracy` from `accuracy-tif.js` and renders a 4×3 table (4 event types × 3 stat columns). The classic path is preserved unchanged.

### Key Changes to `js/ui/accuracy-screen.js`

1. **New import** — `computeTifBoundsHistory` and `computeTifAccuracy` from `../lib/accuracy-tif.js`

2. **Two new module-level frozen constants:**
   - `TIF_ACCURACY_ROWS` — 4 entries `{ key, label }` for wake / napStart / napEnd / bedtime
   - `TIF_ACCURACY_COLS` — 3 entries `{ key, label }` for windowHit / avgWidthMin / highConf

3. **`buildTifAccuracyGrid(stats, snap)`** — new private function returning a `<table>` element:
   - thead: 'Event' + Win Hit % / Avg Width / High Conf % headers
   - tbody: one `<tr>` per event type; cells formatted as:
     - `windowHit.pct + '%'` and `highConf.pct + '%'`
     - `'±' + Math.round(avgWidthMin) + ' min'`
     - `'—'` for null/missing stats
   - All cell content via `textContent` only (T-07-06-01)

4. **`renderAccuracy(root, accuracy, snap)`** — extracted classic path helper (was inline in render()); handles permanent structure restoration + stage badge + buildAccuracyGrid

5. **`renderTifAccuracy(root, tifStats, snap)`** — full TIF renderer: builds an `<section class="accuracy-section">` with h2 'TIF Accuracy' + the buildTifAccuracyGrid table; calls `root.replaceChildren(section)`

6. **`render()` refactored** — isTif branch:
   ```
   const isTif = snap.forecastAlgorithm === 'tif';
   if (isTif) → getActivityLog → computeTifBoundsHistory → computeTifAccuracy → renderTifAccuracy
   else       → computeAccuracy → renderAccuracy
   ```

## Verification Results

| Check | Result |
|-------|--------|
| `npm run test:unit` after Task 1 (tracer) | 753/753 pass |
| `npm run test:unit` after Task 2 (full grid) | 753/753 pass |
| Import of computeTifBoundsHistory + computeTifAccuracy | present |
| isTif branch in render() | present |
| TIF_ACCURACY_ROWS / TIF_ACCURACY_COLS frozen constants | present |
| buildTifAccuracyGrid exists | present |
| renderTifAccuracy calls buildTifAccuracyGrid (not stub) | present |
| avgWidthMin format '±N min' | present |
| windowHit/highConf format 'N%' | present |
| null renders as '—' | present |
| No innerHTML anywhere in module | confirmed |

## Task Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 (tracer) | 99b7bd9 | feat(NW-14-04): wire isTif branch in accuracy-screen render() |
| 2 (full grid) | 91740e6 | feat(NW-14-04): buildTifAccuracyGrid — full TIF accuracy 4x3 grid (TIF-14) |

## Deviations from Plan

None — plan executed exactly as written.

The only interpretation note: `computeTifAccuracy` returns `windowHit: { count, pct }` and `highConf: { count, pct }` objects (not bare numbers). The plan's pseudocode simplified this. Implementation correctly extracts `.pct` for windowHit and highConf cells, uses `avgWidthMin` directly. This is consistent with the actual accuracy-tif.js output shape from Plan 14-02.

## Known Stubs

None.

## Threat Flags

None — all cell values are computed integers set via `textContent` only; no new network endpoints or trust boundaries introduced.

## Self-Check: PASSED

- `js/ui/accuracy-screen.js` exists: confirmed (449 lines)
- Commit 99b7bd9 exists: confirmed (tracer)
- Commit 91740e6 exists: confirmed (full grid)
- `npm run test:unit` final: 753/753 pass
