# Phase 11: Metrics Screen - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 9 (1 new, 8 modified)
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/ui/metrics-screen.js` | component | request-response + reactive | `js/ui/accuracy-screen.js` | exact |
| `js/lib/metrics.js` | utility | transform | existing exports | extension |
| `js/lib/time.js` | utility | transform | `formatTime(...)` | extension |
| `js/app.js` | config/composition | setup | SCREENS map, mount calls | extension |
| `js/ui/bottom-nav.js` | component | request-response | VALID_TABS, TABS | extension |
| `index.html` | config/template | setup | screen sections | extension |
| `sw.js` | config | setup | PRECACHE_LIST | extension |
| `tests/unit/sw-precache.test.js` | test | test | existing assertions | extension |
| `tests/unit/metrics.test.js` | test | test | existing unit test structure | extension |

## Pattern Assignments

### `js/ui/metrics-screen.js` (component, request-response + reactive)

**Analog:** `js/ui/accuracy-screen.js` (lines 1-289)

**Mount function signature** (lines 214-289):
```typescript
export function mountMetricsScreen({ root, eventLog, settings }) {
  // Clear root once at mount, then build permanent structure.
  root.replaceChildren();

  // Stage badge (display-only chip at top of screen).
  const stageBadge = document.createElement('p');
  stageBadge.className = 'stageChip';
  stageBadge.hidden = true;

  // Main content container (table or div).
  const contentRoot = document.createElement('div');
  // ... build structure

  // Establish permanent structure.
  root.replaceChildren(stageBadge, contentRoot);

  // Re-render function called on mount and on data changes.
  const render = () => {
    const snap = settings.get();
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
    // Apply THREE-ARG form stage filter (CRITICAL — from day-bucket.js)
    const days = filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId);
    // ... render logic
  };

  // Initial render.
  render();

  // Reactive subscriptions — both fire synchronously on mutation.
  const unsubLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() {
      unsubLog();
      unsubSettings();
    },
  };
}
```

**Stage badge pattern** (lines 96-107):
```typescript
function renderStageBadge(badge, snap) {
  if (snap.activeStageId) {
    const stage = (snap.stages || []).find(s => s.id === snap.activeStageId);
    badge.hidden = !stage;
    if (stage) {
      // T-07-06-01: textContent only — stage.name is user-supplied.
      badge.textContent = 'Viewing: ' + stage.name;
    }
  } else {
    badge.hidden = true;
  }
}
```

**filterDayRecordsByStage call** (lines 244-246):
```typescript
// Stage filter (D7-17): apply THREE-ARG form — RESEARCH Pitfall 1.
// When activeStageId is null/undefined, filterDayRecordsByStage returns allDays unchanged.
const days = filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId);
```

**Import pattern** (lines 26-27):
```typescript
import { computeAccuracy } from '../lib/accuracy.js';
import { filterDayRecordsByStage } from '../lib/stages.js';
```

**Object.freeze for constants** (lines 37-58):
```typescript
const ACCURACY_ROWS = Object.freeze([
  { type: 'wake', label: 'Wake' },
  // ...
]);
const ACCURACY_COLS = Object.freeze([
  { key: 'withinDelta', header: 'Within max_delta' },
  // ...
]);
const NAP_TYPES = Object.freeze(new Set(['napStart', 'napEnd']));
```

**XSS guard — textContent only** (lines 79-84):
```typescript
// T-07-06-01: textContent only — no dynamic HTML injection.
p.textContent =
  'Not enough history to compute accuracy — keep logging! (' +
  remaining +
  ' more day(s) needed)';
root.replaceChildren(p);
```

---

### `js/lib/metrics.js` (utility, transform)

**Analog:** existing exports (lines 14-84)

**Module pattern — pure functions with extractTime helper** (lines 22-28):
```typescript
/** @param {null|string|{at:string}} slot @returns {string|null} 'HH:MM' or null */
function extractTime(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) return slot.at.slice(11);
  if (typeof slot === 'string') return slot;
  return null;
}
```

**Existing duration helper pattern** (lines 35-41):
```typescript
/** Night sleep duration (bedtime→wake, crossing midnight). */
export function sleepDuration(day) {
  const wakeStr = extractTime(day.wake);
  const bedStr  = extractTime(day.bedtime);
  if (wakeStr == null || bedStr == null) return null;
  const result = timeToMinutes(wakeStr) - timeToMinutes(bedStr);
  return result < 0 ? result + 24 * 60 : result;
}
```

**Null propagation pattern** (lines 79-84):
```typescript
/** Sum of night sleep and nap; null if either component is unavailable. */
export function combinedSleepNap(day) {
  const sleep = sleepDuration(day);
  const nap   = napDuration(day);
  if (sleep == null || nap == null) return null;
  return sleep + nap;
}
```

**New exports to add (from CONTEXT.md D11-23..D11-26):**
- `totalActivity(day)` — `activityBeforeNap(day) + activityAfterNap(day)`, returns null if nap slots absent
- `activityAfterSleepFactor(day)` — `totalActivity(day) / sleepDuration(day)`, returns null if either null
- `sleepAfterActivityFactor(day, prevDay)` — `sleepDuration(day) / totalActivity(prevDay)`, returns null if missing
- `aggregateMetrics(dayRecords)` — returns `{ rows: [...], avg: {...}, min: {...}, max: {...} }` for all 9 metrics

---

### `js/lib/time.js` (utility, transform)

**Analog:** existing `formatTime` (lines 117-123)

**formatTime pattern** (lines 117-123):
```typescript
export function formatTime(at, timeFormat) {
  const hh = at.slice(11, 13);
  const mm = at.slice(14, 16);
  if (timeFormat === '24h') return `${hh}:${mm}`;
  const { h12, ampm } = to12h(parseInt(hh, 10));
  return `${h12}:${mm} ${ampm}`;
}
```

**Module exports pattern** (lines 30-31, 46-51):
```typescript
const TIME_CONFIG = Object.freeze({ stepMs: 5 * 60 * 1000 });

export function roundTo5(date) {
  const ms = date.getTime();
  return new Date(Math.round(ms / TIME_CONFIG.stepMs) * TIME_CONFIG.stepMs);
}
```

**formatDuration helper (Claude's discretion per D11-20, D11-22):**
```typescript
// Option 1: Add to js/lib/time.js as a new export
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// Option 2: Keep local to js/ui/metrics-screen.js
// (Avoids adding to time.js if already stable)
```

---

### `js/app.js` (config/composition, setup)

**Analog:** lines 64-69, 106-138

**SCREENS map pattern** (lines 64-69):
```typescript
const SCREENS = Object.freeze({
  today: todayScreenEl,
  history: historyScreenEl,
  charts: chartsScreenEl,
  accuracy: accuracyScreenEl,
});
```

**Screen element query and import pattern** (lines 32, 57-59):
```typescript
import { mountAccuracyScreen } from './ui/accuracy-screen.js';

// ... later ...
const accuracyScreenEl = document.getElementById('accuracy-screen');
const bottomNavEl = document.getElementById('bottom-nav');
```

**Mount call pattern** (lines 136-138):
```typescript
if (accuracyScreenEl) {
  mountAccuracyScreen({ root: accuracyScreenEl, eventLog, settings });
}
```

**Actions for metrics-screen:**
1. Add import: `import { mountMetricsScreen } from './ui/metrics-screen.js';`
2. Add element query: `const metricsScreenEl = document.getElementById('metrics-screen');`
3. Add to SCREENS map: `metrics: metricsScreenEl,`
4. Add mount call:
```typescript
if (metricsScreenEl) {
  mountMetricsScreen({ root: metricsScreenEl, eventLog, settings });
}
```

---

### `js/ui/bottom-nav.js` (component, request-response)

**Analog:** lines 17-49

**VALID_TABS and TABS pattern** (lines 17-49):
```typescript
const VALID_TABS = Object.freeze(new Set(['today', 'history', 'charts', 'accuracy']));

const TABS = Object.freeze([
  {
    id: 'today',
    label: 'Today',
    pathD: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
  },
  {
    id: 'history',
    label: 'History',
    pathD: 'M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h10v2H3v-2z',
  },
  {
    id: 'charts',
    label: 'Charts',
    pathD: 'M3 18v-6l3-3 4 2 4-5 3 3v9H3zm2-2h14v-3.5l-2.59-2.59L14 14l-4-2.18L8 13.9V16z',
  },
  {
    id: 'accuracy',
    label: 'Accuracy',
    pathD: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 12 6zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  },
]);
```

**Actions for metrics tab:**
1. Add `'metrics'` to VALID_TABS set
2. Add 5th entry to TABS array with appropriate SVG icon and label "Metrics" (Claude's discretion on icon path and abbreviations)

---

### `index.html` (config/template, setup)

**Analog:** lines 67-114 (screen sections pattern)

**Screen section pattern** (lines 97-99, 106, 113):
```html
<section id="history-screen" class="screen-section" hidden>
  <div id="history-table-root"></div>
</section>

<section id="charts-screen" class="screen-section" hidden aria-label="Charts"></section>

<section id="accuracy-screen" class="screen-section" hidden aria-label="Accuracy"></section>
```

**Action for metrics-screen:**
Add a new `<section id="metrics-screen" class="screen-section" hidden aria-label="Metrics"></section>` after the accuracy-screen section and before the closing `</main>`.

---

### `sw.js` (config, setup)

**Analog:** lines 17-62 (PRECACHE_LIST pattern)

**PRECACHE_LIST pattern** (lines 17-62):
```typescript
const CACHE_NAME = 'nightwatch-v1';

const PRECACHE_LIST = Object.freeze([
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/favicon.jpeg',
  './icons/app-start.jpeg',
  // App composition root
  './js/app.js',
  // Adapters (runtime only)
  './js/adapters/clock-system.js',
  './js/adapters/storage-local.js',
  // Pure-logic lib
  './js/lib/accuracy.js',
  // ... more lib files
  './js/lib/metrics.js',
  // ... more ui files
  './js/ui/accuracy-screen.js',
  './js/ui/bottom-nav.js',
  './js/ui/charts-screen.js',
  './js/ui/dom.js',
  './js/ui/header.js',
  './js/ui/history-screen.js',
  './js/ui/manual-entry.js',
  './js/ui/settings-modal.js',
  './js/ui/today-screen.js',
]);
```

**Action for metrics-screen:**
Add `'./js/ui/metrics-screen.js'` to PRECACHE_LIST in alphabetical order within the UI modules section.

---

### `tests/unit/sw-precache.test.js` (test, test)

**Analog:** lines 42-123 (existing test assertions)

**Test structure and assertion pattern** (lines 41-123):
```typescript
describe('sw.js PRECACHE_LIST', () => {
  test('is frozen (Object.isFrozen)', () => {
    assert.match(swSrc, /Object\.freeze\(\[/);
  });

  test('contains ./index.html', () => {
    assert.ok(precacheList.includes('./index.html'), 'Missing ./index.html');
  });

  test('does NOT contain any path matching /clock-fixed/', () => {
    const bad = precacheList.filter((e) => /clock-fixed/.test(e));
    assert.deepEqual(bad, [], `Test-only adapter found: ${bad.join(', ')}`);
  });

  // ... more tests ...

  test('has at least 31 entries (full app file inventory)', () => {
    assert.ok(precacheList.length >= 31, `Expected >= 31 entries, got ${precacheList.length}`);
  });

  test('contains metrics.js (TIF metrics helpers module)', () => {
    assert.ok(precacheList.includes('./js/lib/metrics.js'), 'metrics.js missing from PRECACHE_LIST');
  });
});
```

**Action for metrics-screen:**
Add a test assertion:
```typescript
test('contains metrics-screen.js (Metrics screen UI module)', () => {
  assert.ok(precacheList.includes('./js/ui/metrics-screen.js'), 'metrics-screen.js missing from PRECACHE_LIST');
});
```

Also increment the minimum entry count in the "has at least X entries" test (currently 31 → likely 32 or higher).

---

### `tests/unit/metrics.test.js` (test, test)

**Analog:** lines 14-172 (existing test structure)

**Test import and helper pattern** (lines 14-31):
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  sleepDuration,
  napDuration,
  activityBeforeNap,
  activityAfterNap,
  dayLength,
  combinedSleepNap,
} from '../../js/lib/metrics.js';

// Helper: build a minimal day record using bare 'HH:MM' strings (synthetic)
function makeDay(wake, bedtime, napStart, napEnd) {
  return { wake, bedtime, napStart, napEnd };
}
```

**Test group pattern** (lines 37-69):
```typescript
describe('sleepDuration(day)', () => {
  it('normal night (wake after midnight): wake=07:30, bedtime=21:00 → 630 min', () => {
    assert.strictEqual(sleepDuration(makeDay('07:30', '21:00', null, null)), 630);
  });

  it('null wake → null', () => {
    assert.strictEqual(sleepDuration(makeDay(null, '21:00', null, null)), null);
  });

  it('event-object input: wake={at:"2026-01-01T07:30"}, bedtime={at:"2025-12-31T21:00"} → 630', () => {
    const day = {
      wake: { at: '2026-01-01T07:30' },
      bedtime: { at: '2025-12-31T21:00' },
      napStart: null,
      napEnd: null,
    };
    assert.strictEqual(sleepDuration(day), 630);
  });
});
```

**Actions for new metrics exports:**
1. Add imports for the four new functions: `totalActivity`, `activityAfterSleepFactor`, `sleepAfterActivityFactor`, `aggregateMetrics`
2. Add test groups for each:
   - `totalActivity(day)` — test normal cases (with nap), null cases (no-nap days), event objects
   - `activityAfterSleepFactor(day)` — test calculation, null propagation
   - `sleepAfterActivityFactor(day, prevDay)` — test cross-day pairing, null on first day
   - `aggregateMetrics(dayRecords)` — test return shape (`{ rows, avg, min, max }`), average calculation, null exclusion per D11-13 and D11-15, SAA cross-day pairing

---

## Shared Patterns

### Authentication & Stage Filtering
**Source:** `js/ui/accuracy-screen.js` (line 246)
**Apply to:** `js/ui/metrics-screen.js`
```typescript
// THREE-ARG form of filterDayRecordsByStage (CRITICAL per RESEARCH Pitfall 1)
import { filterDayRecordsByStage } from '../lib/stages.js';
// ...
const days = filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId);
```

### DOM Updates — XSS Guard (textContent only)
**Source:** `js/ui/accuracy-screen.js` (lines 79-84, 101-102, 139, 150, 165-176)
**Apply to:** `js/ui/metrics-screen.js` (all dynamic cell content)
```typescript
// NEVER use innerHTML with user-controlled or computed data
// Always use textContent for cell values
cell.textContent = formattedValue;

// For multi-line cells (e.g., min/max with date), use append with separate elements:
const valueEl = document.createElement('span');
valueEl.textContent = value;
const dateEl = document.createElement('small');
dateEl.textContent = date;
cell.append(valueEl, document.createElement('br'), dateEl);
```

### Reactive Subscriptions
**Source:** `js/ui/accuracy-screen.js` (lines 280-288)
**Apply to:** `js/ui/metrics-screen.js`
```typescript
// Subscribe to both eventLog and settings
const unsubLog = eventLog.subscribe(render);
const unsubSettings = settings.subscribe(render);

return {
  unsubscribe() {
    unsubLog();
    unsubSettings();
  },
};
```

### Object.freeze for Module Constants
**Source:** `js/ui/accuracy-screen.js` (lines 37-58), `js/ui/bottom-nav.js` (line 17, 24)
**Apply to:** `js/ui/metrics-screen.js` and any new constants in `js/lib/metrics.js`
```typescript
const COLUMN_DEFS = Object.freeze([
  { key: 'date', label: 'Date' },
  { key: 'wake', label: 'Wake' },
  // ...
]);
```

### Adapter Injection
**Source:** `js/app.js` (lines 22-32)
**Apply to:** All new modules (never call `new Date()` or `localStorage` directly)
```typescript
// Composition root passes adapters
mountMetricsScreen({ root: metricsScreenEl, eventLog, settings });

// Inside metrics-screen.js, use injected adapters:
const snap = settings.get();
const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
// Never: new Date(), localStorage, fetch directly
```

---

## No Analog Found

None of the 9 files lack a close analog. All patterns are extensions of existing code or direct analogs.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `js/store/`, `tests/unit/`, root files (`index.html`, `sw.js`, `js/app.js`)
**Files scanned:** 9 key analogs (accuracy-screen, metrics.js, time.js, app.js, bottom-nav.js, index.html, sw.js, test files)
**Pattern extraction date:** 2026-07-28

---

## Key Integration Points (Summary)

| File | Integration Point | Analog Source |
|------|-------------------|---------------|
| `js/ui/metrics-screen.js` | Mount pattern, stage filter, reactive subscriptions | `js/ui/accuracy-screen.js` |
| `js/lib/metrics.js` | Pure function exports, extractTime helper, null propagation | existing exports |
| `js/lib/time.js` | Optional formatDuration export (or keep local) | `formatTime(...)` pattern |
| `js/app.js` | Import, element query, SCREENS map, mount call | existing pattern |
| `js/ui/bottom-nav.js` | Add 'metrics' to VALID_TABS and TABS[4] | existing TABS array |
| `index.html` | Add `<section id="metrics-screen" ...>` | existing screen sections |
| `sw.js` | Add `'./js/ui/metrics-screen.js'` to PRECACHE_LIST | existing list |
| `tests/unit/sw-precache.test.js` | Add assertion for metrics-screen.js | existing test assertions |
| `tests/unit/metrics.test.js` | Add TDD tests for 4 new helper functions | existing test structure |
