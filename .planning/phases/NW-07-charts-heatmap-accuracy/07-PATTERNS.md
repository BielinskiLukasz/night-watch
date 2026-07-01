# Phase 7: Charts, Heatmap & Accuracy — Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 9 (5 new, 4 modified)
**Analogs found:** 9 / 9

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `js/ui/bottom-nav.js` | ui-component | request-response (click → tab-change) | `js/ui/header.js` (tabNav block, lines 79-97) | role-match |
| `js/ui/charts-screen.js` | screen-component | event-driven (subscribe → re-render) | `js/ui/history-screen.js` (lines 56-118) | exact |
| `js/ui/accuracy-screen.js` | screen-component | event-driven (subscribe → re-render) | `js/ui/history-screen.js` (lines 56-118) | exact |
| `js/lib/accuracy.js` | pure-lib | batch (loop → aggregate) | `js/lib/forecast.js` (pure logic, frozen config) | role-match |
| `js/lib/chart-data.js` | pure-lib | transform (dayRecords → series arrays) | `js/lib/stages.js` (pure filter) + `js/lib/forecast.js` | role-match |
| `js/ui/header.js` (modify) | ui-component | request-response | self | — |
| `js/app.js` (modify) | composition-root | — | self | — |
| `index.html` (modify) | markup | — | self | — |
| `style.css` (modify) | styles | — | self | — |

---

## Pattern Assignments

### `js/ui/bottom-nav.js` (ui-component, request-response)

**Analog:** `js/ui/header.js` — the tabNav block (lines 79-97) and the VALID_TABS guard.

**Imports pattern** (header.js lines 23-24):
```javascript
import { openSettings } from './settings-modal.js';
// bottom-nav.js will have NO imports — it is self-contained DOM only.
// No store dependency; it only fires onTabChange(tabId).
```

**VALID_TABS guard pattern** (header.js lines 25, 84-86):
```javascript
// header.js — source being removed; copy guard into bottom-nav.js
const VALID_TABS = new Set(['today', 'history']);

// In click handler:
if (!VALID_TABS.has(tabId)) return;
```

Phase 7 replacement in `bottom-nav.js`:
```javascript
// bottom-nav.js — four-tab version of the same guard
const VALID_TABS = Object.freeze(new Set(['today', 'history', 'charts', 'accuracy']));
```

**Click dispatch pattern** (header.js lines 80-97):
```javascript
// header.js lines 80-97 — exact pattern to copy into bottom-nav.js
if (tabNav) {
  tabNav.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-tab]');
    if (!btn || !tabNav.contains(btn)) return;
    const tabId = btn.getAttribute('data-tab');
    if (!VALID_TABS.has(tabId)) return;

    // Update aria-selected on all tab buttons immediately.
    for (const tabBtn of tabNav.querySelectorAll('button[data-tab]')) {
      tabBtn.setAttribute('aria-selected', String(tabBtn === btn));
    }

    if (typeof onTabChange === 'function') {
      onTabChange(tabId);
    }
  });
}
```

**Function signature to produce:**
```javascript
// js/ui/bottom-nav.js
export function mountBottomNav({ root, onTabChange }) {
  // Build <nav role="tablist"> with four <button role="tab" data-tab="..."> children.
  // Each button: inline SVG icon + text label span. 44x44px tap target (D7-02).
  // Wire delegated click listener using the VALID_TABS guard above.
  // Return { setActiveTab(tabId) } for external programmatic tab sync.
}
```

**Inline SVG pattern** — copy from header.js settingsTrigger (index.html or header.js):
```javascript
// The gear icon in index.html is inline SVG; bottom-nav icons use same approach.
// Create SVG via document.createElementNS, set viewBox + path d attribute as static string.
// Icon paths are static literals (not user content) — safe to use setAttribute.
const svgNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(svgNS, 'svg');
svg.setAttribute('viewBox', '0 0 24 24');
svg.setAttribute('aria-hidden', 'true');
svg.setAttribute('width', '20');
svg.setAttribute('height', '20');
const path = document.createElementNS(svgNS, 'path');
path.setAttribute('d', '/* static icon path */');
svg.appendChild(path);
```

---

### `js/ui/charts-screen.js` (screen-component, event-driven)

**Analog:** `js/ui/history-screen.js` (lines 56-118) — exact match for mount signature,
subscribe pattern, replaceChildren clear, and unsubscribe return shape.

**Imports pattern** (copy from history-screen.js lines 28-29, extend):
```javascript
// js/ui/charts-screen.js
import { filterDayRecordsByStage } from '../lib/stages.js';
import { buildSleepLengthSeries, buildHeatmapData, buildTimeBandSeries,
         buildNapStats, buildActivityCorrelation } from '../lib/chart-data.js';
import { formatTime } from '../lib/time.js';
```

**Mount signature** (history-screen.js line 56):
```javascript
// history-screen.js — exact shape to follow
export function mountHistoryScreen({ root, eventLog, settings, onExport }) {

// charts-screen.js equivalent:
export function mountChartsScreen({ root, eventLog, settings }) {
```

**replaceChildren + permanent structure pattern** (history-screen.js lines 57-80):
```javascript
// history-screen.js lines 57-80 — copy this structural pattern
export function mountHistoryScreen({ root, eventLog, settings, onExport }) {
  root.replaceChildren();          // clear once at mount

  // Build permanent wrapper elements (not cleared on re-render)
  const tableRootEl = document.createElement('div');
  tableRootEl.className = 'historyTableRoot';
  root.appendChild(tableRootEl);

  const render = () => {
    tableRootEl.replaceChildren();   // only the dynamic part is cleared
    // ...populate...
  };
```

For charts-screen.js, the permanent containers are the five `<section class="chartSection">` wrappers (one per visualization), plus the stage badge. Only the SVG contents inside each section are cleared on re-render, not the section wrappers themselves.

**Reactive subscription pattern** (history-screen.js lines 107-117):
```javascript
// history-screen.js lines 107-117 — copy verbatim
  render();

  const unsubEventLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() {
      unsubEventLog();
      unsubSettings();
    },
  };
```

**Stage filter call** (today-screen.js lines 626-638 — verified three-arg signature):
```javascript
// today-screen.js lines 626-638 — verified call site
const stages = snap.stages || [];
const activeStageId = snap.activeStageId || null;

// CRITICAL: three args, NOT two (RESEARCH Pitfall #1 — signature mismatch)
const filtered = filterDayRecordsByStage(allForecastDays, stages, activeStageId);
const validCount = filtered.filter((d) => !d.rejected).length;
```

In `charts-screen.js` and `accuracy-screen.js`, no thin-stage fallback is applied (D7-17: strict scoping, show cold-start card instead).

**Cold-start gate pattern** (mirrors today-screen.js logic):
```javascript
// Inside render() in charts-screen.js:
const snap = settings.get();
const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
const days = snap.activeStageId
  ? filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)
  : allDays;

const validCount = days.filter(d => !d.rejected).length;
if (validCount < snap.minDays) {
  // Show cold-start card (D7 discretion — mirror Today screen pattern)
  renderColdStart(root, snap.minDays - validCount);
  return;
}
```

**Empty-state / cold-start card pattern** (history-screen.js lines 129-135):
```javascript
// history-screen.js lines 129-135 — copy this pattern for cold-start card
function renderEmptyState(root) {
  const p = document.createElement('p');
  p.className = 'historyEmpty';
  p.textContent = 'No events logged yet. Go to Today to log your first sleep event.';
  root.appendChild(p);
}

// charts-screen.js equivalent:
function renderColdStart(root, daysRemaining) {
  const p = document.createElement('p');
  p.className = 'coldStartNote';
  p.textContent = `Not enough history to show charts — keep logging! (${daysRemaining} more day(s) needed)`;
  root.replaceChildren(p);
}
```

**SVG element creation helper** (zero-dependency, no dom.js SVG support — create locally):
```javascript
// chart-data.js and charts-screen.js — local helper, NOT from dom.js
// (dom.js uses document.createElement; SVG needs createElementNS)
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
// Usage for text content (security invariant — textContent only):
const label = svgEl('text', { x: '10', y: '20', 'font-size': '10', fill: '#334155' });
label.textContent = stageName; // NEVER setAttribute for user strings
```

**Stage badge pattern** (reference D7-18):
```javascript
// Stage badge — display-only, no interaction
const badge = document.createElement('p');
badge.className = 'stageChip';
badge.hidden = true;
// In render():
if (snap.activeStageId) {
  const stage = (snap.stages || []).find(s => s.id === snap.activeStageId);
  badge.textContent = stage ? `Viewing: ${stage.name}` : '';
  badge.hidden = !stage;
} else {
  badge.hidden = true;
}
```

---

### `js/ui/accuracy-screen.js` (screen-component, event-driven)

**Analog:** `js/ui/history-screen.js` (lines 56-118) — same mount/subscribe/unsubscribe shape.

**Imports pattern:**
```javascript
// js/ui/accuracy-screen.js
import { filterDayRecordsByStage } from '../lib/stages.js';
import { computeAccuracy } from '../lib/accuracy.js';
```

**Mount signature:**
```javascript
export function mountAccuracyScreen({ root, eventLog, settings }) {
  root.replaceChildren();

  const stageBadge = document.createElement('p');
  stageBadge.className = 'stageChip';
  stageBadge.hidden = true;

  const gridRoot = document.createElement('div');
  gridRoot.className = 'accuracyGrid';
  root.replaceChildren(stageBadge, gridRoot);

  const render = () => {
    const snap = settings.get();
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
    const days = snap.activeStageId
      ? filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)
      : allDays;

    const validCount = days.filter(d => !d.rejected).length;
    if (validCount < snap.minDays) {
      renderColdStart(root, snap.minDays - validCount);
      return;
    }

    // Stage badge (D7-18)
    updateStageBadge(stageBadge, snap);

    // Pure computation
    const result = computeAccuracy(days, snap);
    gridRoot.replaceChildren();
    buildAccuracyGrid(gridRoot, result, snap);
  };

  render();

  const unsubEventLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() { unsubEventLog(); unsubSettings(); },
  };
}
```

**4×3 grid rendering** — uses `document.createElement` (HTML, not SVG):
```javascript
// Row headers: ['Wake', 'Bedtime', 'Nap Start', 'Nap End']
// Col headers: ['', 'Within max_delta', 'Within max_delta/2', 'Inside band']
// Cell content: percentage string via textContent; sub-label "based on N days"
// Nap rows with result.napStart.total < snap.minDays → show '—'
// All values via textContent — never innerHTML
```

---

### `js/lib/accuracy.js` (pure-lib, batch)

**Analog:** `js/lib/forecast.js` — frozen config object at top, exported pure functions,
`timeToMinutes` helper reused directly.

**Frozen config pattern** (forecast.js lines 49-56):
```javascript
// forecast.js lines 49-56 — copy this pattern
const FORECAST_CONFIG = Object.freeze({
  P_LOW: 0.1,
  P_MID: 0.5,
  P_HIGH: 0.9,
  REJECT_WEIGHT: 0.5,
  ROUND_MINUTES: 5,
});

// accuracy.js equivalent:
const ACCURACY_CONFIG = Object.freeze({
  EVENT_TYPES: ['wake', 'bedtime', 'napStart', 'napEnd'],
  NAP_TYPES: new Set(['napStart', 'napEnd']),
});
```

**Imports from forecast.js:**
```javascript
// js/lib/accuracy.js
import { forecast, timeToMinutes } from './forecast.js';
```

**Core function signature** (D7-16):
```javascript
/**
 * Retroactive backtesting across full history.
 * Pure function — zero DOM, zero I/O.
 *
 * @param {object[]} dayRecords  sorted or unsorted array of day records
 * @param {object} settings      { minDays, maxDelta, windowDays, ... }
 * @returns {AccuracyResult}
 */
export function computeAccuracy(dayRecords, settings) {
  const { minDays, maxDelta } = settings;

  // Sort chronologically — defensive (D7-12 requires chronological order)
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : 1);

  const counters = {
    wake:     { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    bedtime:  { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    napStart: { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    napEnd:   { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
  };

  // Look-ahead bias prevention (RESEARCH Pitfall #2):
  //   history = sorted.slice(0, i)   — everything BEFORE day i
  //   actual  = sorted[i]             — the day being evaluated
  for (let i = minDays; i < sorted.length; i++) {
    const history = sorted.slice(0, i);
    const actual  = sorted[i];
    const pred = forecast(history, settings);
    if (pred.isColdStart) continue;
    // ... per-type scoring ...
  }

  return buildAccuracyResult(counters);
}
```

**extractActualMinutes helper** — extracts 'HH:MM' from an event object:
```javascript
// event.at is 'YYYY-MM-DDTHH:MM' or bare 'HH:MM' in tests
function extractActualMinutes(event) {
  if (!event || !event.at) return null;
  const at = event.at;
  // If ISO string, take last 5 chars; if bare HH:MM, use directly
  const hhmm = at.length > 5 ? at.slice(-5) : at;
  return timeToMinutes(hhmm);
}
```

**AccuracyResult shape** (D7-14):
```javascript
// Return shape for computeAccuracy():
{
  wake:     { total: N, withinDelta: { count, pct }, withinHalfDelta: { count, pct }, insideBand: { count, pct } },
  bedtime:  { /* same */ },
  napStart: { /* same — show '—' in UI when total < minDays */ },
  napEnd:   { /* same */ },
}
```

**Pure function structure** (stages.js lines 1-32):
```javascript
// stages.js — simplest pure lib module pattern
// Header comment: decisions, requirements, DST note
// No frozen config needed for stages.js (no numeric constants)
// Single exported function, no internal state
// Zero DOM, zero I/O

// accuracy.js follows this pattern but with:
//   - frozen ACCURACY_CONFIG at top
//   - one exported function (computeAccuracy) + private helpers
//   - import of forecast.js (the only dependency)
```

---

### `js/lib/chart-data.js` (pure-lib, transform)

**Analog:** `js/lib/stages.js` (structure) + `js/lib/forecast.js` (frozen config, helper exports).

**Module structure pattern:**
```javascript
// js/lib/chart-data.js
// Pure data-transform helpers for Phase 7 chart rendering.
// Zero DOM, zero I/O. All functions are synchronous and referentially transparent.
//
// Decisions: D7-05..D7-11 (chart types and data shapes)
// DST note: date arithmetic uses string-based nextDayStr() — see inline comment.

const CHART_CONFIG = Object.freeze({
  // Heatmap color thresholds (D7-06)
  HEATMAP_COLORS: Object.freeze({
    missing:   '#e2e8f0',  // no data
    short:     '#c7d2fe',  // < targetMin hours (indigo-200)
    target:    '#4f46e5',  // target range (indigo-600 = accent)
    long:      '#3730a3',  // > targetMax hours (indigo-800)
  }),
  TARGET_SLEEP_MIN: 8,   // hours — short/target boundary (v1 default)
  TARGET_SLEEP_MAX: 10,  // hours — target/long boundary
});

export function buildSleepLengthSeries(dayRecords) { ... }
export function buildHeatmapData(dayRecords) { ... }
export function buildTimeBandSeries(dayRecords) { ... }
export function buildNapStats(dayRecords) { ... }
export function buildActivityCorrelation(dayRecords, activityLog) { ... }
```

**`buildSleepLengthSeries` return shape:**
```javascript
// Returns Array<{ date: 'YYYY-MM-DD', sleepHours: number|null, rejected: boolean }>
// sleepHours = null when wake or bedtime slot is missing
// Computed as: (wakeMinutes - bedtimeMinutes + 1440) % 1440 / 60
// Handles cross-midnight: bedtime may be before wake numerically
```

**`buildHeatmapData` gap-filling pattern** (RESEARCH §Calendar Heatmap Layout Algorithm):
```javascript
// Safe date increment — tagged gsd:allow-ui-clock (calendar display, not domain time)
function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildHeatmapData(dayRecords) {
  if (!dayRecords.length) return [];
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : 1);
  const byDate = new Map(sorted.map(d => [d.date, d]));
  const cells = [];
  let cur = sorted[0].date;
  const end = sorted[sorted.length - 1].date;
  // Track week index relative to first cell's ISO Monday
  while (cur <= end) {
    const rec = byDate.get(cur);
    cells.push({
      date: cur,
      sleepHours: rec ? computeSleepHours(rec) : null,
      dayOfWeek: getISODayOfWeek(cur), // 0=Mon, 6=Sun
      weekIndex: getWeekIndex(cur, sorted[0].date),
    });
    cur = nextDayStr(cur);
  }
  return cells;
}
```

**`buildNapStats` return shape:**
```javascript
// Returns { napDayPct: number, avgNapStartHHMM: string|null, avgNapLengthMin: number|null }
// napDayPct = days with napStart / total days * 100
// avgNapStartHHMM via minutesToTime() from forecast.js
// avgNapLengthMin = avg of (napEndMinutes - napStartMinutes) on nap days
```

---

### `js/ui/header.js` (modify — simplification)

**Source file:** `js/ui/header.js` (lines 1-114 — read in full above).

**What to remove:**
- Line 25: `const VALID_TABS = new Set(['today', 'history']);`
- Lines 47, 54: `onTabChange` parameter from JSDoc and function signature
- Lines 57: `const tabNav = root.querySelector('nav.tabNav');`
- Lines 79-97: entire `if (tabNav) { ... }` block
- Lines 107-113: `export function setActiveTab(root, tabId)` — entire export

**What stays unchanged** (lines 54-76 logic minus removed parts):
```javascript
// header.js lines 54-76 — h1 + settings trigger wiring, UNCHANGED
export function mountHeader({ root, settings, onSettings }) {
  const h1 = root.querySelector('h1.subjectName');
  const trigger = root.querySelector('button.settingsTrigger');
  // tabNav query REMOVED

  const apply = (snap) => {
    h1.textContent = snap.subjectName || 'Nightwatch';
    document.title = snap.subjectName ? `Nightwatch — ${snap.subjectName}` : 'Nightwatch';
  };

  apply(settings.get());
  settings.subscribe(apply);

  trigger.addEventListener('click', () => {
    if (typeof onSettings === 'function') {
      onSettings();
    } else {
      openSettings({ settings });
    }
  });
  // if (tabNav) block — REMOVED entirely
}
// setActiveTab export — REMOVED entirely
```

---

### `js/app.js` (modify — extend to four screens)

**Source file:** `js/app.js` (lines 1-100 — read in full above).

**Import changes** (lines 21-25):
```javascript
// Remove:
import { mountHeader, setActiveTab } from './ui/header.js';
// Add:
import { mountHeader } from './ui/header.js';
import { mountBottomNav } from './ui/bottom-nav.js';
import { mountChartsScreen } from './ui/charts-screen.js';
import { mountAccuracyScreen } from './ui/accuracy-screen.js';
```

**Element references pattern** (lines 41-46 — copy and extend):
```javascript
// app.js lines 41-46 — existing pattern
const headerEl = document.querySelector('header.appHeader');
const todayScreenEl = document.getElementById('today-screen');
const historyScreenEl = document.getElementById('history-screen');
const historyTableRootEl = document.getElementById('history-table-root');

// Phase 7 additions — same pattern:
const chartsScreenEl = document.getElementById('charts-screen');
const accuracyScreenEl = document.getElementById('accuracy-screen');
const bottomNavEl = document.getElementById('bottom-nav');
```

**applyTabVisibility replacement** (lines 50-61 — replace entirely):
```javascript
// app.js lines 50-61 — current two-screen version:
function applyTabVisibility() {
  if (!todayScreenEl || !historyScreenEl) return;
  if (activeTab === 'history') {
    todayScreenEl.style.display = 'none';
    historyScreenEl.style.display = '';
  } else {
    todayScreenEl.style.display = '';
    historyScreenEl.style.display = 'none';
  }
  setActiveTab(headerEl, activeTab);  // ← REMOVE this line
}

// Phase 7 replacement — four-screen version (RESEARCH §What Changes in app.js):
const SCREENS = Object.freeze({
  today:    () => todayScreenEl,
  history:  () => historyScreenEl,
  charts:   () => chartsScreenEl,
  accuracy: () => accuracyScreenEl,
});

function applyTabVisibility() {
  for (const [tabId, getEl] of Object.entries(SCREENS)) {
    const el = getEl();
    if (el) el.style.display = (tabId === activeTab ? '' : 'none');
  }
  // Bottom nav handles its own aria-selected state internally
}
```

**mountHeader call** (lines 67-75 — remove onTabChange):
```javascript
// app.js lines 67-75 — current:
mountHeader({
  root: headerEl,
  settings,
  onTabChange: (tabId) => { activeTab = tabId; applyTabVisibility(); },  // REMOVE
  onSettings: () => openSettings({ settings, eventLog, storage, id: newEventId }),
});

// Phase 7:
mountHeader({
  root: headerEl,
  settings,
  onSettings: () => openSettings({ settings, eventLog, storage, id: newEventId }),
});
```

**New mount calls** (after existing mountHistoryScreen block):
```javascript
// Phase 7 additions — same composition-root pattern as existing mounts
mountBottomNav({
  root: bottomNavEl,
  onTabChange: (tabId) => { activeTab = tabId; applyTabVisibility(); },
});

if (chartsScreenEl) {
  mountChartsScreen({ root: chartsScreenEl, eventLog, settings });
}

if (accuracyScreenEl) {
  mountAccuracyScreen({ root: accuracyScreenEl, eventLog, settings });
}
```

---

### `index.html` (modify)

**What to remove:** `<nav class="tabNav" role="tablist" aria-label="Switch screen">` and its two `<button data-tab>` children from inside `<header class="appHeader">`.

**What to add inside `<main id="app">`:**
```html
<section id="charts-screen" style="display:none" aria-label="Charts"></section>
<section id="accuracy-screen" style="display:none" aria-label="Accuracy"></section>
```

**What to add after `</main>`:**
```html
<nav id="bottom-nav" class="bottomNav" role="tablist" aria-label="Screen navigation">
  <!-- mountBottomNav() will populate buttons dynamically -->
</nav>
```

**Analog for section pattern** — existing today-screen and history-screen elements in index.html.

---

### `style.css` (modify)

**What to remove:** `.tabNav` and `.tabNav button[role="tab"]` rule blocks.

**What to add** (all patterns are ASSUMED from RESEARCH §CSS Patterns Available):

```css
/* Bottom navigation (D7-04) */
.bottomNav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 56px;
  display: flex;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  z-index: 100;
}
.bottomNav button[role="tab"] {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 2px;
  min-height: 44px;          /* D7-02 tap target */
  background: transparent; border: none; cursor: pointer;
  color: #64748b; font-size: 0.7rem; font-weight: 500;
}
.bottomNav button[role="tab"][aria-selected="true"] { color: #4f46e5; }

/* Content padding to avoid bottom-nav overlap (D7-04) */
#app { padding-bottom: 64px; }

/* Chart containers */
.chartSection { margin-bottom: 2rem; }
.chartSection h2 {
  font-size: 0.875rem; font-weight: 600; color: #334155;
  text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 0.5rem;
}
.chartSvg { width: 100%; height: auto; display: block; }

/* Stage active badge (D7-18) */
.stageChip {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe;
  border-radius: 9999px; font-size: 0.75rem; font-weight: 500;
  margin-bottom: 1rem;
}

/* Accuracy grid (D7-14) */
.accuracyGrid {
  display: grid;
  grid-template-columns: auto 1fr 1fr 1fr;
  gap: 1px; background: #e2e8f0;
  border: 1px solid #e2e8f0; border-radius: 0.375rem; overflow: hidden;
  font-size: 0.875rem;
}
.accuracyGrid > * { background: #fff; padding: 0.5rem 0.75rem; }
```

---

## Shared Patterns

### Reactive Subscribe/Unsubscribe
**Source:** `js/ui/history-screen.js` lines 107-117
**Apply to:** `charts-screen.js`, `accuracy-screen.js`
```javascript
render();
const unsubEventLog = eventLog.subscribe(render);
const unsubSettings = settings.subscribe(render);
return {
  unsubscribe() { unsubEventLog(); unsubSettings(); },
};
```

### Stage Filtering — Three-Arg Signature (CRITICAL)
**Source:** `js/lib/stages.js` line 23, `js/ui/today-screen.js` line 632
**Apply to:** `charts-screen.js`, `accuracy-screen.js`
```javascript
// ALWAYS three args. NEVER two. (RESEARCH Pitfall #1)
filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)
```

### Cold-Start Gate
**Source:** `js/ui/today-screen.js` lines 299-314 (isColdStart pattern)
**Apply to:** `charts-screen.js`, `accuracy-screen.js` (cold-start card instead of forecast cards)
```javascript
const validCount = days.filter(d => !d.rejected).length;
if (validCount < snap.minDays) { renderColdStart(...); return; }
```

### Object.freeze for Config
**Source:** `js/lib/forecast.js` lines 49-56
**Apply to:** `js/lib/accuracy.js`, `js/lib/chart-data.js`, `js/ui/bottom-nav.js`
```javascript
const CONFIG = Object.freeze({ /* constants */ });
```

### SVG textContent Security Invariant
**Source:** CLAUDE.md + RESEARCH §Security, §Pitfall #3
**Apply to:** ALL SVG text elements in `charts-screen.js`
```javascript
// ALWAYS:
const textEl = svgEl('text', { x: '...', y: '...', fill: '#334155' });
textEl.textContent = userString;  // textContent property, never setAttribute
// NEVER: textEl.setAttribute('innerHTML', ...) or textEl.innerHTML = ...
```

### textContent-Only DOM Writes
**Source:** `js/ui/history-screen.js` line 133, `js/ui/dom.js` comment
**Apply to:** All new screen modules
```javascript
// All user-supplied values (subject name, stage name, event times) via:
element.textContent = value;  // NEVER element.innerHTML = value
```

---

## No Analog Found

All files have usable analogs. No files require falling back to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `js/ui/`, `js/lib/`, `js/app.js`
**Files scanned:** 7 source files read directly
**Critical verified facts from RESEARCH.md:**
- `filterDayRecordsByStage` takes THREE args `(dayRecords, stages, activeStageId)` — not two
- `eventLog.subscribe(fn)` and `settings.subscribe(fn)` both return unsubscribe functions
- `forecast(dayRecords, settings)` signature is unchanged — accuracy.js imports it directly
- `dom.js` has no SVG namespace support — SVG elements need local `svgEl()` helper
- `timeToMinutes(hhmm)` is exported from `forecast.js` — accuracy.js reuses it

**Pattern extraction date:** 2026-06-30
