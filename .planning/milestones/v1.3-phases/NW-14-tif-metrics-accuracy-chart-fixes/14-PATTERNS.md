# Phase 14: TIF Metrics, Accuracy & Chart Fixes - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 6
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `js/lib/accuracy-tif.js` | lib/pure-fn | batch (retroactive) | `js/lib/accuracy.js` | exact |
| `js/lib/metrics.js` | lib/pure-fn | transform | `js/lib/metrics.js` (self) | self |
| `js/ui/accuracy-screen.js` | UI component | request-response | `js/ui/accuracy-screen.js` (self) | self |
| `js/ui/metrics-screen.js` | UI component | CRUD/display | `js/ui/metrics-screen.js` (self) | self |
| `js/lib/chart-data.js` | lib/pure-fn | transform | `js/lib/chart-data.js` (self) | self |
| `js/ui/charts-screen.js` | UI component | request-response | `js/ui/charts-screen.js` (self) | self |

---

## Pattern Assignments

### `js/lib/accuracy-tif.js` (NEW — lib, batch retroactive)

**Analog:** `js/lib/accuracy.js` — copy this pattern wholesale, replace `forecast()` with `tifForecast()`.

**File header / imports pattern** (`accuracy.js` lines 1-33):
```javascript
// js/lib/accuracy-tif.js
// Pure retroactive TIF backtesting engine.
// Exports: computeTifBoundsHistory(dayRecords, settings, activityLog)
// Zero DOM, zero I/O — fully unit-testable with node:test.

import { tifForecast } from './forecast-tif.js';
// NOTE: Do NOT import from metrics.js here — accuracy-tif.js does not need it,
// and metrics.js already imports from forecast.js (circular-import guard).
```

**Frozen config pattern** (`accuracy.js` lines 39-42):
```javascript
const ACCURACY_TIF_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime']),
  NAP_TYPES: new Set(['napStart', 'napEnd']),
});
```

**Core retroactive loop pattern** (`accuracy.js` lines 144-238):
```javascript
export function computeTifBoundsHistory(dayRecords, settings, activityLog) {
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : 1);
  const results = [];

  // LOOK-AHEAD BIAS PREVENTION: same slice pattern as computeAccuracy.
  // Use tifRollingDays as the minimum history window (from settings, D-06 Phase 13).
  const minDays = settings.tifRollingDays ?? settings.minDays;

  for (let i = minDays; i < sorted.length; i++) {
    const history = sorted.slice(0, i);   // only BEFORE day i — no look-ahead
    const actual  = sorted[i];            // the day being scored

    const pred = tifForecast(history, settings, activityLog);
    if (pred.isColdStart) {
      results.push({ date: actual.date, wake: null, napStart: null, napEnd: null, bedtime: null });
      continue;
    }

    const entry = { date: actual.date };
    for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
      const p = pred[type];
      entry[type] = (p && p.algMin != null && p.algMax != null)
        ? { algMin: p.algMin, algMax: p.algMax, precisionScore: p.precisionScore ?? null }
        : null;
    }
    results.push(entry);
  }

  return results;
}
```

**`computeTifAccuracy` — derived from `buildAccuracyResult` pattern** (`accuracy.js` lines 77-95):
```javascript
// computeTifAccuracy(history) consumes the output of computeTifBoundsHistory
// merged with actual day records. For each event type, compute:
//   windowHit: % of days where actual fell inside [algMin, algMax]
//   avgWidthMin: mean(algMax_minutes − algMin_minutes)
//   highConf: % of days where precisionScore >= 80
// Use extractActualMinutes (same helper as in accuracy.js) to convert actual event times.
// pct = Math.round(count / total * 100); when total === 0, pct = 0 (never NaN).
```

---

### `js/lib/metrics.js` (MODIFY — add 3 ratio functions, remove SAA from aggregateMetrics)

**Analog:** Self. Pattern for new ratio functions from `activityAfterSleepFactor` (lines 133-138):
```javascript
// New ratio functions — same null-guard + division-by-zero pattern:
export function dayToSleepFactor(day) {
  const dl = dayLength(day);
  const sd = sleepDuration(day);
  if (dl == null || sd == null || sd === 0) return null;
  return dl / sd;
}

export function napFraction(day) {
  const nd = napDuration(day);
  const cs = combinedSleepNap(day);
  if (nd == null || cs == null || cs === 0) return null;
  return nd / cs;
}

export function amPmSplit(day) {
  const before = activityBeforeNap(day);
  const after  = activityAfterNap(day);
  // No-nap day: before=0, after=0 → return null (D-13)
  if (before == null || after == null || after === 0) return null;
  if (day.napStart == null && day.napEnd == null) return null;
  return before / after;
}
```

**`aggregateMetrics` update pattern** — follow lines 303-314 for new metrics, remove SAA line:
```javascript
// ADD these three calls in aggregateMetrics (after totalActivity):
aggregateMetric('dayToSleepFactor', validRows);
aggregateMetric('napFraction', napRows);     // napRows only — null on no-nap days
aggregateMetric('amPmSplit', napRows);       // napRows only

// REMOVE this line (MET-07 / D-14):
// aggregateMetric('sleepAfterActivityFactor', saaRows);
// Keep sleepAfterActivityFactor exported for backward compat but remove from aggregateMetrics.
```

**`aggregateMetric` duration-vs-ratio branch** (lines 273-279) — new ratio columns go in the `else` branch (no rounding), same as `activityAfterSleepFactor`.

**`rows.push({...})` update** (lines 226-248) — add new fields to the per-row object:
```javascript
dayToSleepFactor: dayToSleepFactor(day),
napFraction: napFraction(day),
amPmSplit: amPmSplit(day),
// Keep sleepAfterActivityFactor in row for backward compat but omit from aggregate calls
```

---

### `js/ui/accuracy-screen.js` (MODIFY — add TIF grid branch)

**Analog:** Self. Follow the existing `ACCURACY_ROWS` / `ACCURACY_COLS` + `buildAccuracyGrid` pattern.

**New frozen constants pattern** (mirrors lines 37-52):
```javascript
const TIF_ACCURACY_ROWS = Object.freeze([
  { type: 'wake',     label: 'Wake'      },
  { type: 'napStart', label: 'Nap Start' },
  { type: 'napEnd',   label: 'Nap End'   },
  { type: 'bedtime',  label: 'Bedtime'   },
]);

const TIF_ACCURACY_COLS = Object.freeze([
  { key: 'windowHit', header: 'Window Hit'  },
  { key: 'avgWidth',  header: 'Avg Width'   },
  { key: 'highConf',  header: 'High Conf'   },
]);
```

**Algorithm-switch in `render()`** (mirrors lines 238-274):
```javascript
const render = () => {
  const snap = settings.get();
  const isTif = snap.forecastAlgorithm === 'tif';

  // ... existing setup (allDays, stage filter, validCount, cold-start gate) ...

  if (isTif) {
    // D-01: show TIF grid instead of classic grid
    const history = computeTifBoundsHistory(days, snap, activityLog);
    const tifResult = computeTifAccuracy(history, days);
    buildTifAccuracyGrid(gridRoot, tifResult, snap);
  } else {
    const result = computeAccuracy(days, snap);
    buildAccuracyGrid(gridRoot, result, snap);
  }
};
```

**`buildTifAccuracyGrid` pattern** — copy `buildAccuracyGrid` (lines 123-185) verbatim, swap `ACCURACY_ROWS`→`TIF_ACCURACY_ROWS`, `ACCURACY_COLS`→`TIF_ACCURACY_COLS`, and update cell formatting:
- `windowHit` cell: `rowResult[col.key].pct + '%'` with `n=` sub-label (same as existing pct cells)
- `avgWidth` cell: `'±' + Math.round(rowResult.avgWidthMin) + ' min'` (textContent only)
- `highConf` cell: `rowResult[col.key].pct + '%'` with `n=` sub-label

**XSS guard:** All cell values are computed numbers — `textContent` only (T-07-06-01, lines 79-80).

---

### `js/ui/metrics-screen.js` (MODIFY — 16-col order + 12 TIF cols + 3 TIF aggregate rows)

**Analog:** Self. Follow `COLUMNS` constant (lines 39-54) and `buildAggregateRow` (lines 199-218).

**Updated `COLUMNS` constant** — replace lines 39-54 with new 16-column order (D-09):
```javascript
const COLUMNS = Object.freeze([
  { key: 'date',                  label: 'Date',       isTime: false, isRatio: false, sticky: true },
  { key: 'wake',                  label: 'Wake',       isTime: true,  isRatio: false },
  { key: 'napStart',              label: 'Nap Start',  isTime: true,  isRatio: false },
  { key: 'napEnd',                label: 'Nap End',    isTime: true,  isRatio: false },
  { key: 'bedtime',               label: 'Bedtime',    isTime: true,  isRatio: false },
  { key: 'sleepDuration',         label: 'Sleep',      isTime: false, isRatio: false },
  { key: 'napDuration',           label: 'Nap',        isTime: false, isRatio: false },
  { key: 'napFraction',           label: 'Nap Frac',   isTime: false, isRatio: true  },  // NEW MET-09
  { key: 'combinedSleepNap',      label: 'Comb',       isTime: false, isRatio: false },
  { key: 'dayLength',             label: 'Day Len',    isTime: false, isRatio: false },
  { key: 'dayToSleepFactor',      label: 'Day/Sleep',  isTime: false, isRatio: true  },  // NEW MET-07
  { key: 'activityBeforeNap',     label: '→Nap',       isTime: false, isRatio: false },
  { key: 'activityAfterNap',      label: 'Nap→',       isTime: false, isRatio: false },
  { key: 'totalActivity',         label: 'Act',        isTime: false, isRatio: false },
  { key: 'amPmSplit',             label: 'AM/PM',      isTime: false, isRatio: true  },  // NEW MET-10
  { key: 'activityAfterSleepFactor', label: 'AAS',     isTime: false, isRatio: true  },
  // SAA removed from COLUMNS (D-14 / MET-07)
]);
```

**TIF inline columns constant** (D-11, hidden when TIF off):
```javascript
// Appended at the right of COLUMNS when TIF is active — 12 columns for 4 event types × 3 fields
const TIF_COLUMNS = Object.freeze([
  { key: 'wake_tif_min',       label: 'W-min',    isTime: true,  isRatio: false, tif: true },
  { key: 'wake_tif_max',       label: 'W-max',    isTime: true,  isRatio: false, tif: true },
  { key: 'wake_tif_conf',      label: 'W-conf',   isTime: false, isRatio: true,  tif: true },
  // ... repeat for napStart, napEnd, bedtime
]);
```

**TIF aggregate rows pattern** (D-06/D-07) — follow `buildAggregateRow` (lines 199-218):
```javascript
function buildTifAggregateRow(label, tifBoundsAvg, snap) {
  const tr = document.createElement('tr');
  tr.classList.add('metrics-summary-row', 'metrics-tif-row');
  // label cell (sticky-col), then 16 base columns as '—', then 12 TIF time columns
  // Uses textContent only — T-11-05
  return tr;
}
// Hidden entirely: tr.hidden = !isTif  (consistent with el.hidden = !isTif pattern from CONTEXT.md)
```

**`hidden` attribute toggling pattern** — per CONTEXT.md §Established Patterns:
```javascript
// Toggle TIF columns/rows visibility:
for (const th of tifHeaderCells) th.hidden = !isTif;
for (const tr of tifAggregateRows) tr.hidden = !isTif;
```

---

### `js/lib/chart-data.js` (MODIFY — `buildTimeBandSeries` refactor)

**Analog:** Self. Existing function at lines 178-211.

**New signature and return shape** (D-16, D-17):
```javascript
/**
 * Build a time-band series using subjective-night slots directly (UI-10 fix).
 * One entry per day record — no calendar-date scatter bucketing.
 * napStartMinutes / napEndMinutes are null on no-nap days (render as gap).
 *
 * @param {object[]} dayRecords  from daysBySubjectiveNight()
 * @returns {Array<{
 *   date: string,
 *   wakeMinutes: number|null,
 *   bedtimeMinutes: number|null,
 *   napStartMinutes: number|null,
 *   napEndMinutes: number|null,
 * }>}
 */
export function buildTimeBandSeries(dayRecords) {
  return dayRecords.map(d => ({
    date:             d.date,
    wakeMinutes:      extractMinutes(d.wake),      // uses existing extractMinutes helper (line 50-57)
    bedtimeMinutes:   extractMinutes(d.bedtime),
    napStartMinutes:  extractMinutes(d.napStart),  // null on no-nap days
    napEndMinutes:    extractMinutes(d.napEnd),
  }));
}
```

Key change: remove the `byDate` Map + `allEvents` loop entirely. Use the day record's own named slots (`.wake`, `.bedtime`, `.napStart`, `.napEnd`) which are already subjective-night scoped. `extractMinutes` (line 50) handles both ISO string and null.

---

### `js/ui/charts-screen.js` (MODIFY — Y-axis inversion + 4-series rendering)

**Analog:** Self. Existing `renderTimeBandChart` at lines 327-403.

**Y-axis inversion** (D-15, UI-08) — replace line 356:
```javascript
// OLD (0h at top, 24h at bottom):
const yScale = (minutes) => M.top + (minutes / (24 * 60)) * plotH;

// NEW (0h at bottom, 24h at top — earlier times lower on screen):
const yScale = (minutes) => M.top + plotH - (minutes / (24 * 60)) * plotH;
```

Y-axis tick labels are unchanged (same `minutesToISOString` + `formatTime` calls at lines 366-368); they will now render at the correct inverted positions automatically.

**`hasData` guard update** (line 335) — extend to include nap slots:
```javascript
const hasData = timeSeries.some(
  p => p.wakeMinutes !== null || p.bedtimeMinutes !== null
    || p.napStartMinutes !== null || p.napEndMinutes !== null
);
```

**4-series dot rendering** (replaces lines 376-392) — follow existing circle pattern:
```javascript
for (let i = 0; i < timeSeries.length; i++) {
  const p = timeSeries[i];
  const x = xScale(i);
  if (p.wakeMinutes !== null) {
    svg.appendChild(svgEl('circle', { cx: x, cy: yScale(p.wakeMinutes),    r: '3', fill: '#4f46e5', opacity: '0.8' }));
  }
  if (p.napStartMinutes !== null) {
    svg.appendChild(svgEl('circle', { cx: x, cy: yScale(p.napStartMinutes), r: '3', fill: '#f59e0b', opacity: '0.8' }));
  }
  if (p.napEndMinutes !== null) {
    svg.appendChild(svgEl('circle', { cx: x, cy: yScale(p.napEndMinutes),   r: '3', fill: '#fb923c', opacity: '0.8' }));
  }
  if (p.bedtimeMinutes !== null) {
    svg.appendChild(svgEl('circle', { cx: x, cy: yScale(p.bedtimeMinutes),  r: '3', fill: '#94a3b8', opacity: '0.8' }));
  }
  // NOTE: bedtimesMinutes[] loop removed — D-17 subjective-night approach gives exactly one bedtime per day
}
```

**Legend update** (replaces lines 394-400) — 4 rows following same `svgEl('circle')` + `svgText()` pattern:
```javascript
const legendX = W - M.right - 70;
const legendY = M.top + 8;
// Wake
svg.appendChild(svgEl('circle', { cx: legendX, cy: legendY,      r: '3', fill: '#4f46e5' }));
svg.appendChild(svgText({ x: legendX+6, y: legendY+4,      'font-size': '9', fill: '#334155' }, 'Wake'));
// Nap Start
svg.appendChild(svgEl('circle', { cx: legendX, cy: legendY+14,   r: '3', fill: '#f59e0b' }));
svg.appendChild(svgText({ x: legendX+6, y: legendY+18,    'font-size': '9', fill: '#334155' }, 'Nap Start'));
// Nap End
svg.appendChild(svgEl('circle', { cx: legendX, cy: legendY+28,   r: '3', fill: '#fb923c' }));
svg.appendChild(svgText({ x: legendX+6, y: legendY+32,    'font-size': '9', fill: '#334155' }, 'Nap End'));
// Bedtime
svg.appendChild(svgEl('circle', { cx: legendX, cy: legendY+42,   r: '3', fill: '#94a3b8' }));
svg.appendChild(svgText({ x: legendX+6, y: legendY+46,    'font-size': '9', fill: '#334155' }, 'Bedtime'));
```

---

## Shared Patterns

### XSS Guard
**Source:** `js/ui/accuracy-screen.js` (T-07-06-01 comments throughout), `js/ui/metrics-screen.js` (T-11-05)
**Apply to:** All new/modified UI files — `accuracy-screen.js`, `metrics-screen.js`
```javascript
// ALL cell/label content must go through textContent — NEVER innerHTML with user data.
// Computed numbers and static strings are safe via textContent.
cell.textContent = someComputedNumber.toFixed(2);   // safe
```

### Object.freeze Config
**Source:** `js/lib/accuracy.js` lines 39-42, `js/lib/chart-data.js` lines 23-37
**Apply to:** `accuracy-tif.js`
```javascript
const ACCURACY_TIF_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime']),
});
```

### Reactive Subscribe Pattern
**Source:** `js/ui/accuracy-screen.js` lines 277-288
**Apply to:** No new screens — both modified screens already use this pattern.
```javascript
const unsubLog      = eventLog.subscribe(render);
const unsubSettings = settings.subscribe(render);
return { unsubscribe() { unsubLog(); unsubSettings(); } };
```

### Look-Ahead Bias Prevention
**Source:** `js/lib/accuracy.js` lines 159-165
**Apply to:** `js/lib/accuracy-tif.js`
```javascript
for (let i = minDays; i < sorted.length; i++) {
  const history = sorted.slice(0, i);  // only BEFORE day i
  const actual  = sorted[i];           // day being evaluated
}
```

### Circular-Import Guard
**Source:** `js/lib/metrics.js` lines 16-28 (local `extractTime` copy)
**Apply to:** `js/lib/accuracy-tif.js` — may import from `forecast-tif.js` directly (parallel to `accuracy.js` → `forecast.js`). Must NOT import from `metrics.js` (would create `forecast-tif.js` → `accuracy-tif.js` → `metrics.js` → `forecast.js` which is fine, but verify no reverse direction).

### `hidden` Attribute Toggle
**Source:** CONTEXT.md §Established Patterns
**Apply to:** TIF columns/rows in `metrics-screen.js`, TIF grid in `accuracy-screen.js`
```javascript
el.hidden = !isTif;  // where isTif = snap.forecastAlgorithm === 'tif'
```

---

## No Analog Found

All files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`
**Files scanned:** 6 (accuracy.js, metrics.js, accuracy-screen.js, metrics-screen.js, chart-data.js, charts-screen.js)
**Pattern extraction date:** 2026-08-27
