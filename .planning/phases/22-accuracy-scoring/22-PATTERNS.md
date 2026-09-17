# Phase 22: Accuracy Scoring - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 4 files (3 modified, 1 test rewrite)
**Analogs found:** 4/4 with exact or role-match quality

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `js/lib/accuracy.js` | lib | transform | `js/lib/metrics.js` | exact |
| `js/lib/accuracy-tif.js` | lib | transform | `js/lib/forecast-tif.js` | role-match |
| `js/ui/accuracy-screen.js` | ui | request-response | `js/ui/metrics-screen.js` | role-match |
| `tests/unit/accuracy.test.js` | test | test | `tests/unit/accuracy.test.js` (current) | exact |

---

## Pattern Assignments

### `js/lib/accuracy.js` (lib, transform)

**Analog:** `js/lib/metrics.js` — pure function module with frozen config and helper structure

**Imports pattern** (lines 1-33 of metrics.js):
```javascript
// js/lib/metrics.js — reference pattern
import { timeToMinutes } from './forecast.js';

// Module exports named functions (not a single factory object per D10-02)
export function sleepDuration(day) { ... }
export function napDuration(day) { ... }
```

**ACCURACY_CONFIG frozen structure** (lines 39-42 of current accuracy.js):
```javascript
const ACCURACY_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'bedtime', 'napStart', 'napEnd']),
  NAP_TYPES: new Set(['napStart', 'napEnd']),
});
```
Replace with D-03/D-04 extended structure:
```javascript
const ACCURACY_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay', 'napStart', 'napEnd']),
  NAP_TYPES: new Set(['napStart', 'napEnd']),
  BEDTIME_TYPES: new Set(['bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay']),
});
```

**extractActualMinutes pattern** (lines 59-66 of current accuracy.js):
```javascript
// Extract HH:MM from event object or bare string, reuse timeToMinutes
function extractActualMinutes(event) {
  if (!event || !event.at) return null;
  const at = event.at;
  const hhmm = at.length > 5 ? at.slice(-5) : at;
  return timeToMinutes(hhmm);
}
```
Unchanged pattern — reuse as-is.

**New eventAccuracyScore function** (to add, ~25–30 lines):
```javascript
/**
 * Linear-decay per-event accuracy score (ACC-02).
 *
 * Formula:
 *   D ≤ W:      score = 100 − (50/W) × D
 *   W < D ≤ 2W: score = 50 − (50/W) × (D − W)
 *   D > 2W:     score = 0
 *
 * @param {number} forecastMinutes  predicted time (minutes since midnight)
 * @param {number} actualMinutes    actual logged time (minutes since midnight)
 * @param {number} toleranceMinutes tolerance window W (from settings.maxDelta)
 * @returns {{score: number, approximated?: boolean}}  score 0–100, approximated flag optional
 */
function eventAccuracyScore(forecastMinutes, actualMinutes, toleranceMinutes) {
  if (toleranceMinutes === 0) return { score: 0 };
  const D = Math.abs(actualMinutes - forecastMinutes);
  let score;
  if (D <= toleranceMinutes) {
    score = 100 - (50 / toleranceMinutes) * D;
  } else if (D <= 2 * toleranceMinutes) {
    score = 50 - (50 / toleranceMinutes) * (D - toleranceMinutes);
  } else {
    score = 0;
  }
  return { score: Math.max(0, Math.round(score)) };
}
```

**buildAccuracyResult pattern** (lines 77-95 of current accuracy.js):
Current structure computes pct for withinDelta/withinHalfDelta/insideBand counters.
Replace per D-08 to compute average score per event type:
```javascript
function buildAccuracyResult(counters) {
  const result = {};
  for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
    const c = counters[type];
    const total = c.total;
    const avgScore = total === 0 ? 0 : Math.round(c.scoreSum / total);
    result[type] = {
      total,
      avgScore,  // Replaces withinDelta/withinHalfDelta/insideBand
    };
  }
  return result;
}
```

**computeAccuracy core loop pattern** (lines 144–239 of current accuracy.js):
Core loop invariant unchanged (look-ahead bias prevention, same structure):
```javascript
for (let i = minDays; i < sorted.length; i++) {
  const history = sorted.slice(0, i);  // BEFORE day i — no look-ahead
  const actual  = sorted[i];           // day being evaluated
  const pred = forecast(history, settings);
  if (pred.isColdStart) continue;
  // Score each event type for this day
  for (const type of ACCURACY_CONFIG.EVENT_TYPES) {
    const actualEvent = actual[type];
    if (!actualEvent) continue;
    // ... nap-day filtering, total increment, prediction check ...
    // NEW: D-06 band-mode fallback
    if (prediction.probabilityBand) {
      const bandTimes = prediction.probabilityBand.map(e => timeToMinutes(e.time));
      const bandMin = Math.min(...bandTimes);
      const bandMax = Math.max(...bandTimes);
      const forecastMinutes = (bandMin + bandMax) / 2;  // D-06 midpoint
      const scoreResult = eventAccuracyScore(forecastMinutes, actualMinutes, maxDelta);
      counters[type].scoreSum += scoreResult.score;
      if (scoreResult.approximated) counters[type].approximatedCount++;
    } else {
      // CENTRAL MODE: normal point prediction
      const centralMinutes = timeToMinutes(prediction.central);
      const scoreResult = eventAccuracyScore(centralMinutes, actualMinutes, maxDelta);
      counters[type].scoreSum += scoreResult.score;
    }
  }
}
```

**Nap-day classification pattern** (D-03 bedtime split):
```javascript
// D-03: nap-day classification — reuse Phase 19 D-04 definition
const isNapDay = actual.napStart !== null;
// When processing bedtime event:
//   if (type === 'bedtime') { /* increment bedtime total */ }
//   if (type === 'bedtimeNapDay' && isNapDay) { /* increment */ }
//   if (type === 'bedtimeNoNapDay' && !isNapDay) { /* increment */ }
```

---

### `js/lib/accuracy-tif.js` (lib, transform)

**Analog:** `js/lib/forecast-tif.js` — pure function, frozen TIF config, similar loop patterns

**Imports pattern** (lines 1–30 of forecast-tif.js):
```javascript
import { timeToMinutes, minutesToTime, detectColdStart } from './forecast.js';
import {
  sleepDuration,
  napDuration,
  // ... metrics helpers
} from './metrics.js';

const TIF_CONFIG = Object.freeze({ ROUND_MINUTES: 5 });
```

**Circular-import guard** (CLAUDE.md §Pitfalls):
Must NOT import `metrics.js` in `accuracy-tif.js` — it already imports `forecast.js`, and `forecast-tif.js` imports `metrics.js`, so adding the reverse would create a cycle.

**ACCURACY_TIF_CONFIG extension** (lines 36–38 of current accuracy-tif.js):
```javascript
const ACCURACY_TIF_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime']),
});
```
Replace with D-05 bedtime split (matching accuracy.js structure):
```javascript
const ACCURACY_TIF_CONFIG = Object.freeze({
  EVENT_TYPES: Object.freeze(['wake', 'napStart', 'napEnd', 'bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay']),
});
```

**computeTifAccuracy counter initialization** (lines 166–170):
```javascript
const counters = {};
for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
  counters[type] = { total: 0, windowHitCount: 0, widthSum: 0, highConfCount: 0 };
}
```
No changes to counter structure — D-05 only adds new event type keys, same per-type metrics.

**Nap-day classification for TIF** (D-05 — identical rule to accuracy.js):
```javascript
// When scoring a day, check if it's a nap day:
const isNapDay = actualDay.napStart !== null;
// When iterating EVENT_TYPES:
//   if (type === 'bedtimeNapDay' && isNapDay) { /* process */ }
//   if (type === 'bedtimeNoNapDay' && !isNapDay) { /* process */ }
```

---

### `js/ui/accuracy-screen.js` (ui, request-response)

**Analog:** `js/ui/metrics-screen.js` — similar UI rendering with grid/table, stage badge, column definitions

**Module structure & imports pattern** (lines 1–26 of metrics-screen.js):
```javascript
import {
  aggregateMetrics,
  dayOfWeekAverages,
  sleepDebtProxy,
} from '../lib/metrics.js';
import { filterDayRecordsByStage } from '../lib/stages.js';
import { formatTime, formatDuration, formatSignedDuration } from '../lib/time.js';
// ... 

/**
 * mountMetricsScreen({ root, eventLog, settings }) — full implementation.
 * Input: root (DOM element), eventLog (store), settings (store)
 * Output: rendered table into root
 * Return: { unsubscribe() } — reactive subscriptions
 */
```

**COLUMNS frozen definition pattern** (lines 44–65 of metrics-screen.js):
Current accuracy-screen ACCURACY_COLS:
```javascript
const ACCURACY_COLS = Object.freeze([
  { key: 'withinDelta',     header: 'Within max_delta'   },
  { key: 'withinHalfDelta', header: 'Within max_delta / 2' },
  { key: 'insideBand',      header: 'Inside band'        },
]);
```
Replace per D-09 with per-event-type average scores + approximation flag:
```javascript
const ACCURACY_COLS = Object.freeze([
  { key: 'avgScore', header: 'Avg Score', isScore: true },
  { key: 'approximated', header: 'Flag', isApprox: true },
  { key: 'total', header: 'n', isCount: true },
]);
```

**Event type row definitions** (lines 38–43 of current accuracy-screen.js):
```javascript
const ACCURACY_ROWS = Object.freeze([
  { type: 'wake',     label: 'Wake'      },
  { type: 'napStart', label: 'Nap Start' },
  { type: 'napEnd',   label: 'Nap End'   },
  { type: 'bedtime',  label: 'Bedtime'   },
]);
```
Extend per D-03/D-04 to include bedtime split:
```javascript
const ACCURACY_ROWS = Object.freeze([
  { type: 'wake',            label: 'Wake'                },
  { type: 'napStart',        label: 'Nap Start'           },
  { type: 'napEnd',          label: 'Nap End'             },
  { type: 'bedtime',         label: 'Bedtime (combined)'  },
  { type: 'bedtimeNapDay',   label: 'Bedtime (nap day)'   },
  { type: 'bedtimeNoNapDay', label: 'Bedtime (no nap)'    },
]);
```

**Grid building helper pattern** (lines 146–208 of current accuracy-screen.js):
```javascript
function buildAccuracyGrid(gridEl, result, snap) {
  gridEl.replaceChildren();
  // Column header row
  for (const col of ACCURACY_COLS) {
    const headerCell = document.createElement('div');
    headerCell.className = 'accHeader';
    headerCell.textContent = col.header;  // T-07-06-01: textContent only
    gridEl.appendChild(headerCell);
  }
  // Data rows
  for (const row of ACCURACY_ROWS) {
    const rowResult = result[row.type];
    for (const col of ACCURACY_COLS) {
      const cell = document.createElement('div');
      cell.className = 'accCell';
      if (col.isApprox) {
        // D-07: render approximated flag (Claude's discretion: asterisk, muted, etc.)
        cell.textContent = rowResult.approximated ? '*' : '';  // Example
      } else if (col.isScore) {
        cell.textContent = rowResult.avgScore + '%';  // D-11: plain number
      }
      gridEl.appendChild(cell);
    }
  }
}
```

**Overall headline score** (D-10):
Add above the per-event grid, new rendering section:
```javascript
function renderOverallScore(gridEl, dayRecords) {
  // Compute average of each day's daily-average score across all history
  const overallScores = [];
  for (const day of dayRecords) {
    // Collect this day's per-event scores
    const dayScores = [];
    for (const type of ['wake', 'napStart', 'napEnd', 'bedtime', 'bedtimeNapDay', 'bedtimeNoNapDay']) {
      if (day.scores && day.scores[type] !== undefined) {
        dayScores.push(day.scores[type].avgScore);
      }
    }
    if (dayScores.length > 0) {
      const dayAvg = dayScores.reduce((a, b) => a + b, 0) / dayScores.length;
      overallScores.push(dayAvg);
    }
  }
  const headline = overallScores.length > 0
    ? Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length)
    : 0;
  // Render as top-line number above the grid
}
```

**Stage badge rendering** (lines 119–130 of metrics-screen.js):
```javascript
function renderStageBadge(badge, snap) {
  if (snap.activeStageId) {
    const stage = (snap.stages || []).find(s => s.id === snap.activeStageId);
    badge.hidden = !stage;
    if (stage) {
      badge.textContent = 'Viewing: ' + stage.name;  // T-11-04: textContent only
    }
  } else {
    badge.hidden = true;
  }
}
```
Same pattern — reuse in accuracy-screen.js unchanged.

**TIF rendering** (lines 227–305 of current accuracy-screen.js):
```javascript
function buildTifAccuracyGrid(stats, snap) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  // ... build headers from TIF_ACCURACY_COLS ...
  const tbody = document.createElement('tbody');
  for (const row of TIF_ACCURACY_ROWS) {
    const tr = document.createElement('tr');
    // ... build cells with .pct/.avgWidthMin/.count formatting ...
  }
  return table;
}
```
For TIF D-05 bedtime split: add 2 new rows to TIF_ACCURACY_ROWS (bedtimeNapDay, bedtimeNoNapDay).
Same rendering logic; nap-day classification applied when computing `computeTifAccuracy`.

---

## Shared Patterns

### Pure Function Module Structure (js/lib)

**Source:** `js/lib/metrics.js` + `js/lib/forecast-tif.js`

Apply to: `js/lib/accuracy.js`, `js/lib/accuracy-tif.js`

```javascript
// 1. Frozen config at module top
const MODULE_CONFIG = Object.freeze({ ... });

// 2. Private helpers (extractActualMinutes, extractTime)
function extractActualMinutes(event) { ... }

// 3. Named exports for each compute function
export function computeAccuracy(dayRecords, settings) { ... }

// 4. No DOM, no I/O, no side effects — fully unit-testable with node:test
```

### UI Component Rendering (js/ui)

**Source:** `js/ui/metrics-screen.js` + current `js/ui/accuracy-screen.js`

Apply to: `js/ui/accuracy-screen.js` (refresh existing patterns)

```javascript
// 1. Frozen COLUMNS / ROWS definitions
const COLUMNS = Object.freeze([...]);
const ROWS = Object.freeze([...]);

// 2. Private helper functions for rendering components
function buildGrid(gridEl, data, snap) { ... }
function renderStageBadge(badge, snap) { ... }

// 3. Single mount function returns { unsubscribe() }
export function mountAccuracyScreen({ root, eventLog, settings }) {
  const render = () => { /* recompute + re-render */ };
  const unsubLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);
  return { unsubscribe() { unsubLog(); unsubSettings(); } };
}

// 4. All dynamic content via textContent only (T-07-06-01, T-11-05)
```

### XSS Guard Pattern

**Source:** CLAUDE.md §Security invariants (T-07-06-01, T-11-05)

Apply to: all DOM rendering in `js/ui/accuracy-screen.js`

```javascript
// ALWAYS use textContent, never innerHTML, for any dynamic content
cell.textContent = value;  // GOOD
// cell.innerHTML = `<span>${value}</span>`;  // BAD — XSS risk

// Static HTML structure (headers, grid containers) can use createElement/appendChild
// but all text from data/settings must go through textContent.
```

### Test File Structure

**Source:** `tests/unit/accuracy.test.js` (current), `tests/unit/metrics.test.js`, `tests/unit/forecast.test.js`

Apply to: `tests/unit/accuracy.test.js` (rewrite for new shape)

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeAccuracy } from '../../js/lib/accuracy.js';

describe('computeAccuracy — Phase 22 ACC-01..04', () => {
  describe('edge cases', () => {
    it('empty dayRecords → all totals zero', () => {
      const result = computeAccuracy([], settings);
      assert.strictEqual(result.wake.total, 0);
      assert.strictEqual(result.wake.avgScore, 0);
    });
  });

  describe('eventAccuracyScore — linear decay formula', () => {
    // Test boundary values from NEW_ACC.md worked example:
    // W=25, forecast=14:50 (890 min)
    // D=0 (14:50 actual) → score=100
    // D=W (15:15 actual) → score=50
    // D=2W (15:40 actual) → score=0
    // D>2W (16:00 actual) → score=0
  });

  describe('bedtime split — nap-day classification', () => {
    // Test that bedtimeNapDay increments only when napStart != null
    // Test that bedtimeNoNapDay increments only when napStart == null
  });

  describe('band-mode fallback — D-06 midpoint', () => {
    // Test that when probabilityBand is present, forecastMinutes = (min+max)/2
    // Test that approximated flag is set
  });
});
```

---

## No Analog Found

All four files have close analogs in the existing codebase. No files require pattern innovation beyond the codebase.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `tests/unit/`
**Files scanned:** 15 lib files, 10 ui files, 18 test files
**Pattern extraction date:** 2026-09-17

---

## Key Implementation Notes

### D-03/D-04 Bedtime Split

Both `accuracy.js` and `accuracy-tif.js` must extend `EVENT_TYPES` to include `bedtimeNapDay` and `bedtimeNoNapDay` using the identical classification: `isNapDay = actual.napStart !== null` (Phase 19 D-04). The combined `bedtime` key is kept as an average across both sub-keys.

### D-06 Band-Mode Fallback

When `prediction.probabilityBand` is present, compute `forecastMinutes = (bandMin + bandMax) / 2` using the existing band min/max calculation pattern (lines 211–213 of current accuracy.js). Reuse that math directly.

### D-07 Approximated Flag

Each event score carries an optional `approximated: true` flag when the score was derived from a probability band. Set by the accuracy modules at computation time; UI (accuracy-screen.js) must visually distinguish these (Claude's discretion: asterisk, muted styling, etc.).

### D-08 Old Counters Removal

Remove all references to `withinDelta`, `withinHalfDelta`, `insideBand` counters. No back-compat shim. Costly reversal.

### D-09/D-10 New Rendering

Render one row per event type (including new bedtime split rows), with columns for `avgScore`, `approximated` flag, and `total` count. Add a top-line `overallScore` above the grid.
