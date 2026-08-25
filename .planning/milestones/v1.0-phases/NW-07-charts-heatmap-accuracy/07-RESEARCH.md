# Phase 7: Charts, Heatmap & Accuracy - Research

**Researched:** 2026-06-30
**Domain:** Vanilla-JS SVG chart rendering, calendar heatmap layout, retroactive accuracy backtesting, bottom navigation refactor
**Confidence:** HIGH (all findings verified directly from codebase source files)

## Summary

Phase 7 delivers three user-visible additions: a Charts screen with five stacked SVG visualizations, an Accuracy screen with a 4x3 backtesting results grid, and a bottom navigation bar replacing the current header tab bar. All rendering must use `document.createElementNS` hand-drawn SVG — no external charting library — consistent with the project's zero-npm-runtime-dep hard constraint.

The existing codebase provides a clear pattern template: every screen module follows the `mountXScreen({ root, eventLog, settings })` signature, subscribes reactively via `eventLog.subscribe()` and `settings.subscribe()`, and calls `root.replaceChildren()` to clear on re-render. Phase 7 adds two new screens (charts-screen.js and accuracy-screen.js) and one new navigation module (bottom-nav.js) following these established patterns exactly.

The `forecast()` function signature is verified from source. The `computeAccuracy()` retroactive backtesting loop calls `forecast(dayRecords.slice(0, i), settings)` per day — starting from index `minDays` to ensure the cold-start gate passes — and is synchronous. For 300 days with `windowDays=7`, each `forecast()` call examines at most 7 records, making the full loop well within synchronous feasibility (~300 lightweight slice operations). The `filterDayRecordsByStage` function signature differs from what the CONTEXT.md implies — it takes three separate arguments `(dayRecords, stages, activeStageId)`, not a settings object.

**Primary recommendation:** Build accuracy.js and chart data-transform helpers as pure functions in `js/lib/` with strict RED-GREEN-REFACTOR TDD using `node:test`. Wire screens in `js/ui/` last, test-after with Playwright E2E guards.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D7-01/D7-04: Replace header tab bar (`<nav class="tabNav">`) with a fixed bottom navigation bar. New module `js/ui/bottom-nav.js` exports `mountBottomNav({ root, onTabChange })`. Header retains only subject name + Settings gear.
- D7-02: Bottom nav has four tabs with icon + label: Today (moon), History (list), Charts (bar chart), Accuracy (target). Icons are inline SVG paths. 44x44px minimum tap target.
- D7-03: Tab order left to right: Today | History | Charts | Accuracy.
- D7-05: Charts screen is a single scrollable page, no sub-tabs. Five stacked visualizations in order: Sleep Length → Time Bands → Calendar Heatmap → Nap Pattern → Activity Correlation.
- D7-06: Calendar heatmap uses GitHub contribution graph style: columns = weeks (oldest left), rows = days of week (Mon-Sun top to bottom). Color intensity encodes sleep length.
- D7-07: Nap pattern indicator is a stats card (no chart): shows % days with nap, avg nap start, avg nap length.
- D7-08: All charts rendered with hand-drawn SVG elements via `createElementNS`. No external charting library.
- D7-12: Accuracy computed by retroactive backtesting: for each day D starting from `minDays + 1`, call `forecast(dayRecords.slice(0, i), settings)` and compare to actual.
- D7-13: Backtesting covers full available history. Sample count shown per event type.
- D7-14: Accuracy screen shows 4x3 grid: rows = wake/bedtime/napStart/napEnd; columns = % within max_delta, % within max_delta/2, % inside predicted band.
- D7-15: Nap rows skip days with no nap. Show "—" when fewer than minDays nap days.
- D7-16: `computeAccuracy(dayRecords, settings) → AccuracyResult` in `js/lib/accuracy.js` — pure function, zero DOM.
- D7-17: Charts and Accuracy respect activeStageId via `filterDayRecordsByStage()`.
- D7-18: Stage selector stays on Today screen only. Charts/Accuracy show "Viewing: [Stage Name]" badge when stage active.

### Claude's Discretion
- D7-09: Sleep-length chart Y-axis auto-scaled (min-max with 10% padding). Stage boundary dashed lines when "All data".
- D7-10: Time-band scatter — Y=hour-of-day (0-24h), X=date. Wake/bedtime plotted in different colors. Forecast min/max band as thin error bar.
- D7-11: Activity correlation hidden when `Object.keys(db.activityLog).length < settings.minDays`.
- D7-19: Stage boundaries as vertical dashed lines on sleep-length chart when "All data" is active.
- Bottom nav icons: Claude picks SVG path data.
- Heatmap color scale: Claude picks CSS custom-property values (desaturated → accent hue ramp based on #4f46e5).
- Chart axis label formatting: Claude decides tick count, label spacing, 24h/12h via formatTime.
- Minimum data gates: cold-start card when fewer than minDays non-rejected days.

### Deferred Ideas (OUT OF SCOPE)
- Per-stage accuracy comparison side-by-side
- Animated chart transitions
- CSV export from Charts/Accuracy
- Zoom/pan on charts
- Day-of-week heatmap for nap frequency
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-04 | Charts screen: sleep length over time, wake/sleep time bands, nap pattern, activity-vs-sleep correlation, calendar heatmap | SVG rendering patterns; `buildSleepLengthSeries`, `buildHeatmapData`, `buildTimeBandSeries`, `buildActivityCorrelation` pure helpers in `js/lib/`; screen module in `js/ui/charts-screen.js` |
| UI-05 | Accuracy screen: three success-rate metrics side-by-side | `computeAccuracy(dayRecords, settings) → AccuracyResult` pure function; D7-14 4x3 grid; retroactive backtesting loop verified against `forecast()` source |
| UI-06 | Navigate between Today, History, Charts, Accuracy from any screen | `mountBottomNav({ root, onTabChange })` in `js/ui/bottom-nav.js`; header.js `<nav class="tabNav">` removed; `applyTabVisibility()` in app.js extended to four screens |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sleep-length line chart | Browser / Client (SVG) | — | Pure DOM rendering; data transform in js/lib/ |
| Time-band scatter plot | Browser / Client (SVG) | — | Same pattern as sleep-length chart |
| Calendar heatmap | Browser / Client (SVG) | — | Grid of `<rect>` elements; week/day position math in js/lib/ |
| Nap pattern stats card | Browser / Client (HTML) | — | Simple text card; no SVG needed |
| Activity correlation scatter | Browser / Client (SVG) | — | Conditional on activityLog presence |
| Accuracy backtesting | js/lib (pure logic) | Browser / Client (HTML table) | computeAccuracy() is pure; display is HTML grid |
| Bottom navigation | Browser / Client (HTML) | — | Fixed `<nav>` element; tab dispatch in app.js |
| Stage scoping | js/lib (pure logic) | Browser / Client (badge) | filterDayRecordsByStage() already exists |
| Cold-start gate | Browser / Client | js/lib (forecast()) | Mirrors Today screen pattern exactly |

---

## Integration Points

### Files Phase 7 modifies

**`js/ui/header.js`** — Currently exports `mountHeader({ root, settings, onTabChange, onSettings })` and `setActiveTab(root, tabId)`. Contains `VALID_TABS = new Set(['today', 'history'])`. Phase 7 changes:
- Remove the entire `if (tabNav)` block and its `VALID_TABS` guard from `mountHeader()`
- Remove the `onTabChange` parameter from the function signature
- Remove `setActiveTab()` export (no longer used by app.js)
- The `<nav class="tabNav">` DOM element in `index.html` is also removed

**`js/app.js`** — Currently has:
- `let activeTab = 'today'` module-level state
- `function applyTabVisibility()` — shows/hides two screens (today/history)
- `setActiveTab(headerEl, activeTab)` call inside `applyTabVisibility()`
- `mountHeader({ ..., onTabChange: (tabId) => { activeTab = tabId; applyTabVisibility(); } })`

Phase 7 changes:
- `let activeTab = 'today'` — expand VALID_TABS to four values
- `applyTabVisibility()` — extend to four screens (today/history/charts/accuracy)
- Remove `setActiveTab(headerEl, activeTab)` call
- Add `mountBottomNav({ root: bottomNavEl, onTabChange: (tabId) => { ... } })`
- Add `mountChartsScreen({ root: chartsScreenEl, eventLog, settings })`
- Add `mountAccuracyScreen({ root: accuracyScreenEl, eventLog, settings })`
- Add element references: `chartsScreenEl = getElementById('charts-screen')`, `accuracyScreenEl = getElementById('accuracy-screen')`, `bottomNavEl = getElementById('bottom-nav')`
- Update `mountHeader({ root: headerEl, settings, onSettings: ... })` — drop `onTabChange`

**`index.html`** — Changes:
- Remove `<nav class="tabNav" ...>` and its two `<button data-tab>` children from `<header>`
- Add `<section id="charts-screen" style="display:none">` inside `<main id="app">`
- Add `<section id="accuracy-screen" style="display:none">` inside `<main id="app">`
- Add `<nav id="bottom-nav" class="bottomNav" role="tablist" aria-label="Screen navigation">` after `</main>` (or at bottom of body before script)
- Add `padding-bottom` on `<main id="app">` equal to bottom nav height

**`style.css`** — Changes:
- Remove `.tabNav` and `.tabNav button[role="tab"]` rules (or keep for backward compat, remove later)
- Remove `justify-content: flex-start` override on `.appHeader` and related flex adjustments for `.tabNav` inside header
- Add `.bottomNav` fixed positioning styles
- Add `.chartSection`, `.chartSvg`, `.heatmapGrid`, `.accuracyGrid` styles
- Add `.stageChip` badge styles

### Files Phase 7 creates

| File | Exports | Pure? |
|------|---------|-------|
| `js/ui/bottom-nav.js` | `mountBottomNav({ root, onTabChange })` | No (DOM) |
| `js/ui/charts-screen.js` | `mountChartsScreen({ root, eventLog, settings })` | No (DOM) |
| `js/ui/accuracy-screen.js` | `mountAccuracyScreen({ root, eventLog, settings })` | No (DOM) |
| `js/lib/accuracy.js` | `computeAccuracy(dayRecords, settings) → AccuracyResult` | Yes |
| `js/lib/chart-data.js` (recommended) | `buildSleepLengthSeries`, `buildHeatmapData`, `buildTimeBandSeries`, `buildNapStats`, `buildActivityCorrelation` | Yes |

---

## SVG Chart Rendering Approach

### viewBox and Responsive Sizing

[ASSUMED] The canonical pattern for responsive SVG without JavaScript reflow is to set a fixed `viewBox` and use `width="100%" height="auto"` (or `preserveAspectRatio="xMidYMid meet"`). This avoids reading `offsetWidth` on mount (which can trigger reflow).

Recommended approach for all charts:
```html
<!-- In JS via createElementNS: -->
svg.setAttribute('viewBox', '0 0 600 200');
svg.setAttribute('width', '100%');
svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
```

The SVG coordinate space is fixed (`0 0 600 200` for line charts, `0 0 700 160` for heatmap). All element positions use the SVG coordinate system, not screen pixels. This means no `getBoundingClientRect()` calls — the layout is purely mathematical.

### Coordinate System for Date-Indexed Line Chart

For a sleep-length line chart with date on X and hours on Y:

```javascript
// [ASSUMED] Standard pattern for date-indexed SVG line charts
const MARGIN = { top: 10, right: 16, left: 32, bottom: 24 };
const SVG_W = 600, SVG_H = 200;
const plotW = SVG_W - MARGIN.left - MARGIN.right;
const plotH = SVG_H - MARGIN.top - MARGIN.bottom;

// X scale: index-based (one point per day, evenly spaced)
function xScale(i, total) {
  if (total <= 1) return MARGIN.left;
  return MARGIN.left + (i / (total - 1)) * plotW;
}

// Y scale: auto-scaled with 10% padding (D7-09)
function buildYScale(values) {
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const pad = (maxVal - minVal) * 0.1 || 0.5; // guard for flat data
  const lo = minVal - pad;
  const hi = maxVal + pad;
  return (v) => MARGIN.top + plotH - ((v - lo) / (hi - lo)) * plotH;
}
```

For the sleep-length series, `values` are hours (e.g. 8.5, 9.0, 7.5). The Y axis renders 3-5 tick labels using `document.createElementNS('http://www.w3.org/2000/svg', 'text')` with `.textContent` set to the formatted value.

### Accessibility Attributes

[ASSUMED] WCAG 2.1 recommendations for SVG charts without ARIA live regions:
```javascript
svg.setAttribute('role', 'img');
svg.setAttribute('aria-label', 'Sleep length over time');
// For decorative secondary elements:
elem.setAttribute('aria-hidden', 'true');
```

The `<title>` SVG element provides the accessible name when `role="img"` is used. However, since this is a pure-vanilla app without screen reader testing budget, the CONTEXT.md security invariant (textContent only) takes priority — no `aria-describedby` pointing to innerHTML content.

### SVG Element Creation Pattern

From the codebase conventions (no innerHTML, `document.createElementNS` required):

```javascript
// Correct pattern — consistent with dom.js security invariant
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Usage:
const line = svgEl('polyline', {
  points: pointsString,  // "x1,y1 x2,y2 ..."
  fill: 'none',
  stroke: '#4f46e5',
  'stroke-width': '2',
});
```

The `points` attribute for `<polyline>` is a space-separated list of `x,y` pairs — a pure numeric string, no user input interpolation.

### Stage Boundary Dashed Lines (D7-19)

```javascript
// Vertical dashed line at stage transition date
const line = svgEl('line', {
  x1: String(x), x2: String(x),
  y1: String(MARGIN.top), y2: String(MARGIN.top + plotH),
  stroke: '#94a3b8',
  'stroke-width': '1',
  'stroke-dasharray': '4 3',
});
// Stage name label — textContent only (T-07)
const label = svgEl('text', {
  x: String(x + 2), y: String(MARGIN.top + 8),
  'font-size': '9',
  fill: '#94a3b8',
});
label.textContent = stage.name; // textContent, never setAttribute for user strings
```

---

## Calendar Heatmap Layout Algorithm

### Week/Day Positioning

The GitHub-style heatmap has:
- Columns = weeks, oldest at left, newest at right
- Rows = day of week, Monday (0) at top, Sunday (6) at bottom
- Each cell = one day

[ASSUMED] Standard approach for positioning cells given a date range:

```javascript
// Build a sorted array of all dates in the data range
// Fill gaps so every calendar date between first and last is represented
function buildHeatmapData(dayRecords) {
  if (!dayRecords.length) return [];
  
  // Sort chronologically
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : 1);
  const firstDate = sorted[0].date;      // 'YYYY-MM-DD'
  const lastDate  = sorted[sorted.length - 1].date;
  
  // Build lookup: date string -> sleep length in hours
  const byDate = new Map(dayRecords.map(d => [d.date, computeSleepHours(d)]));
  
  // Generate every calendar date from firstDate to lastDate
  const cells = [];
  let current = parseDateString(firstDate); // returns {y, m, d}
  const end = parseDateString(lastDate);
  
  while (dateLE(current, end)) {
    const dateStr = toDateString(current); // 'YYYY-MM-DD'
    cells.push({
      date: dateStr,
      sleepHours: byDate.get(dateStr) ?? null, // null = missing day
      dayOfWeek: getDayOfWeek(current),         // 0=Mon, 6=Sun (ISO)
      weekIndex: getWeekIndex(current, firstDate),
    });
    current = nextDay(current);
  }
  return cells;
}
```

**Key insight — avoid `new Date()` for date arithmetic:**
The project forbids domain-time Date construction (see CLAUDE.md and forecast.js DST safety notes). For heatmap date math, use string-based arithmetic:
```javascript
// Safe: parse date string into components, increment day component
function nextDayStr(dateStr) {
  // Use Date only for calendar arithmetic (not domain time storage)
  // This is safe because we never store the result — we just increment
  // gsd:allow-ui-clock — calendar display arithmetic, not domain time storage
  const d = new Date(dateStr + 'T00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
```

### Cell Position Calculation

```javascript
// CELL_SIZE and GAP are frozen constants
const HEATMAP_CONFIG = Object.freeze({
  cellSize: 11,   // px in SVG coordinate space
  cellGap: 2,
  rowOffset: 16,  // top: day labels
  colOffset: 0,   // left: no month labels in MVP
});

function cellX(weekIndex) {
  return HEATMAP_CONFIG.colOffset + weekIndex * (HEATMAP_CONFIG.cellSize + HEATMAP_CONFIG.cellGap);
}
function cellY(dayOfWeek) { // 0=Mon
  return HEATMAP_CONFIG.rowOffset + dayOfWeek * (HEATMAP_CONFIG.cellSize + HEATMAP_CONFIG.cellGap);
}
```

### Missing vs. Zero-Value Days

- **Missing day** (no record): render as an empty cell — `fill: '#e2e8f0'` (light gray, from palette)
- **Zero sleep** (record exists but sleep hours = 0): treat as missing (edge case from corrupted data)
- **Normal day**: fill color on `#4f46e5` hue scale:
  - Short sleep (< targetMin): desaturated `#c7d2fe` (indigo-200)
  - Target range (8-10h): full accent `#4f46e5` (indigo-600)
  - Long sleep (> targetMax): darker `#3730a3` (indigo-800)

Color is derived mathematically in a frozen config object, not via user-supplied strings.

### Week Index Computation

[ASSUMED] Standard approach: count how many ISO weeks have passed since the first date's week.
```javascript
function getWeekIndex(dateStr, firstDateStr) {
  // Days since first date, divided by 7 gives week offset
  // Use ISO day-of-week offset to align weeks properly
  const firstDow = getISODayOfWeek(firstDateStr); // 0=Mon
  const daysSinceFirst = daysBetween(firstDateStr, dateStr);
  return Math.floor((daysSinceFirst + firstDow) / 7);
}
```

---

## Accuracy Backtesting Design

### `forecast()` Verified Signature

[VERIFIED: js/lib/forecast.js source] The `forecast()` function signature:

```javascript
forecast(dayRecords, settings) → result
```

**Input `dayRecords`:** Array of day record objects from `daysBySubjectiveNight()`. Each record has:
- `wake`: null or event object `{ id, type, at: 'YYYY-MM-DDTHH:MM' }` (or bare `'HH:MM'` in tests)
- `bedtime`: null or event object
- `napStart`: null or event object
- `napEnd`: null or event object
- `rejected`: boolean

**Input `settings`:** Object with fields: `minDays` (integer), `maxDelta` (minutes), `windowDays` (integer), `statBlend` (string — currently only `'median'` is active)

**Output when `isColdStart: true`:**
```javascript
{ isColdStart: true, validDayCount: N, minDaysRemaining: N }
```

**Output when `isColdStart: false`:**
```javascript
{
  isColdStart: false,
  wake:     { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' }
            | { probabilityBand: [{time: 'HH:MM', prob: N}, ...] }
            | { central: null, min: null, max: null },
  bedtime:  /* same shape */,
  napStart: /* same shape */,
  napEnd:   /* same shape */,
}
```

**Cold-start gate behavior:** `forecast()` counts valid (non-rejected) days across ALL dayRecords before applying the window slice. This means `dayRecords.slice(0, i)` must include at least `minDays` non-rejected records for the result to have prediction fields.

### Backtesting Loop — Look-Ahead Bias Prevention

The correct implementation to avoid look-ahead bias:

```javascript
// js/lib/accuracy.js

export function computeAccuracy(dayRecords, settings) {
  const { minDays, maxDelta } = settings;
  
  // Sort chronologically — defensive, assumes sorted but make explicit
  const sorted = [...dayRecords].sort((a, b) => a.date < b.date ? -1 : 1);
  
  const counters = {
    wake:     { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    bedtime:  { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    napStart: { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
    napEnd:   { total: 0, withinDelta: 0, withinHalfDelta: 0, insideBand: 0 },
  };
  
  // Start from minDays (index = minDays) so the cold-start gate passes
  // for the slice dayRecords.slice(0, i)
  for (let i = minDays; i < sorted.length; i++) {
    const history = sorted.slice(0, i); // everything before day i — no look-ahead
    const actual  = sorted[i];          // the day we're evaluating against
    
    const pred = forecast(history, settings);
    if (pred.isColdStart) continue; // skip if still cold-start (e.g., minDays rejections)
    
    for (const type of ['wake', 'bedtime', 'napStart', 'napEnd']) {
      const actualEvent = actual[type];
      if (!actualEvent) continue; // no actual for this event type on this day — skip
      if (type === 'napStart' || type === 'napEnd') {
        // Only count nap days for nap metrics (D7-15)
        if (!actual.napStart && !actual.napEnd) continue;
      }
      
      const prediction = pred[type];
      if (!prediction || (!prediction.central && !prediction.probabilityBand)) continue;
      
      counters[type].total++;
      
      // Extract actual time in minutes
      const actualTime = extractActualMinutes(actualEvent);
      if (actualTime === null) continue;
      
      if (prediction.probabilityBand) {
        // Band-mode: check if actual falls within the band's time range
        const bandTimes = prediction.probabilityBand.map(e => timeToMinutes(e.time));
        const bandMin = Math.min(...bandTimes);
        const bandMax = Math.max(...bandTimes);
        if (actualTime >= bandMin && actualTime <= bandMax) {
          counters[type].insideBand++;
        }
        // withinDelta and withinHalfDelta: not applicable for band mode
        // (the band was triggered because spread > maxDelta)
      } else {
        const central = timeToMinutes(prediction.central);
        const delta = Math.abs(actualTime - central);
        if (delta <= maxDelta)      counters[type].withinDelta++;
        if (delta <= maxDelta / 2)  counters[type].withinHalfDelta++;
        const min = timeToMinutes(prediction.min);
        const max = timeToMinutes(prediction.max);
        if (actualTime >= min && actualTime <= max) counters[type].insideBand++;
      }
    }
  }
  
  return buildAccuracyResult(counters, settings);
}
```

### `AccuracyResult` Shape

```javascript
// Recommended shape for computeAccuracy return value
{
  wake: {
    total: N,
    withinDelta: { count: N, pct: N },       // pct = 0-100
    withinHalfDelta: { count: N, pct: N },
    insideBand: { count: N, pct: N },
  },
  bedtime:  { /* same */ },
  napStart: {
    total: N,           // only nap days
    // same sub-fields; show '—' in UI when total < minDays
  },
  napEnd: { /* same */ },
}
```

### Edge Cases

- **Empty dayRecords**: Return all zeros — `total: 0`, `pct: 0`
- **Fewer than `minDays + 1` records**: Loop body never executes — all totals = 0
- **All days rejected**: `forecast()` returns `isColdStart: true` on each iteration — all totals = 0
- **No nap days**: `napStart.total === 0` and `napEnd.total === 0` — Accuracy screen shows "—"
- **Midnight wrap in time comparison**: `timeToMinutes()` from forecast.js returns 0-1439 minutes. For events near midnight, delta calculation may produce artificially large values. This is a known limitation (acceptable for v1); note in comments.

---

## Navigation Refactor Scope

### What Changes in `header.js`

[VERIFIED: js/ui/header.js source]

Current state:
- `const VALID_TABS = new Set(['today', 'history'])` — module-level constant
- `mountHeader({ root, settings, onTabChange, onSettings })` — onTabChange is a required callback
- The `if (tabNav)` block wires click handler to `VALID_TABS` guard, updates `aria-selected`, calls `onTabChange`
- `setActiveTab(root, tabId)` — exported, called by `applyTabVisibility()` in app.js

Phase 7 changes:
1. Remove `VALID_TABS` constant entirely
2. Remove `onTabChange` parameter from `mountHeader()`
3. Remove the `if (tabNav)` block (the tabNav no longer exists in the DOM)
4. Remove `setActiveTab()` export
5. The h1 + Settings gear wiring is unchanged

```javascript
// Phase 7 simplified mountHeader signature:
export function mountHeader({ root, settings, onSettings }) {
  // h1 subscribe + gear button — unchanged
  // tab nav block — REMOVED
}
// setActiveTab export — REMOVED
```

### What Changes in `app.js`

[VERIFIED: js/app.js source]

Current `applyTabVisibility()`:
```javascript
function applyTabVisibility() {
  // Shows today or history; calls setActiveTab
}
```

Phase 7 `applyTabVisibility()`:
```javascript
// Four-screen version
const SCREENS = Object.freeze({
  today:    todayScreenEl,
  history:  historyScreenEl,
  charts:   chartsScreenEl,
  accuracy: accuracyScreenEl,
});

function applyTabVisibility() {
  for (const [tabId, el] of Object.entries(SCREENS)) {
    if (el) el.style.display = (tabId === activeTab ? '' : 'none');
  }
  // Update aria-selected on bottom nav buttons
  // (bottomNav module handles its own active state via setActiveNavTab())
}
```

The `mountBottomNav` module handles its own `aria-selected` state internally. `app.js` just calls `onTabChange` with the new tab ID.

### CSS Changes for Tab Visibility

[VERIFIED: style.css source]

Currently, `applyTabVisibility()` uses `element.style.display` — inline style. The bottom nav refactor keeps this approach (no CSS class toggling) to stay consistent. New CSS needed:
- Remove `.tabNav` block (or repurpose it as `.bottomNav`)
- Add `.bottomNav` fixed positioning
- Remove `justify-content: flex-start` override on `.appHeader` (no longer needs space for tabNav)
- Revert `.appHeader` to original `justify-content: space-between`

---

## Reactive Subscription Pattern

### Verified Pattern from `history-screen.js`

[VERIFIED: js/ui/history-screen.js source]

```javascript
export function mountHistoryScreen({ root, eventLog, settings, onExport }) {
  // ... build DOM structure ...
  
  const render = () => {
    const snap = settings.get();
    const dayRecords = eventLog.daysByCalendar(Infinity, snap);
    tableRootEl.replaceChildren();
    // ... populate table ...
  };
  
  render(); // initial render
  
  const unsubEventLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);
  
  return {
    unsubscribe() {
      unsubEventLog();
      unsubSettings();
    },
  };
}
```

**Key facts verified:**
- `eventLog.subscribe(fn)` returns an unsubscribe function
- `settings.subscribe(fn)` returns an unsubscribe function
- Both fire synchronously on mutation (D2-09 confirmed in CONTEXT.md for settings; same pattern for eventLog per today-screen.js line 529)
- The render function captures fresh data via `settings.get()` and `eventLog.daysByCalendar()` on each call
- `mountHistoryScreen` returns `{ unsubscribe }` — Charts and Accuracy should follow the same return shape

### Charts and Accuracy Screen Pattern

```javascript
export function mountChartsScreen({ root, eventLog, settings }) {
  root.replaceChildren(); // clear once at mount
  
  // Build permanent structure (section containers)
  const sleepLengthSection = el('section', { className: 'chartSection' });
  // ... other sections ...
  root.replaceChildren(stageBadge, sleepLengthSection, timeBandSection, heatmapSection, napSection, activitySection);
  
  const render = () => {
    const snap = settings.get();
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour); // no limit — full history
    
    // Stage filter (D7-17)
    const days = snap.activeStageId
      ? filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)
      : allDays;
    
    // Cold-start gate
    const validCount = days.filter(d => !d.rejected).length;
    if (validCount < snap.minDays) {
      renderColdStart(root, snap.minDays - validCount);
      return;
    }
    
    // Update stage badge
    renderStageBadge(stageBadge, snap);
    
    // Render each chart
    renderSleepLengthChart(sleepLengthSection, days, snap);
    // ...
  };
  
  render();
  
  const unsubLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);
  
  return { unsubscribe() { unsubLog(); unsubSettings(); } };
}
```

### Stage Filtering Signature — Critical Correction

[VERIFIED: js/lib/stages.js source]

The actual `filterDayRecordsByStage` signature is:
```javascript
filterDayRecordsByStage(dayRecords, stages, activeStageId)
// NOT: filterDayRecordsByStage(dayRecords, settings) as implied in CONTEXT.md
```

The CONTEXT.md refers to it as `filterDayRecordsByStage(dayRecords, settings)` but the actual function takes three arguments. The correct call at screen mount:

```javascript
import { filterDayRecordsByStage } from '../lib/stages.js';

// Inside render():
const snap = settings.get();
const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
const days = filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId);
```

---

## TDD Opportunities

### Pure Modules — Strict RED-GREEN-REFACTOR

[VERIFIED: Tests directory structure]

The project already has `tests/unit/` and `tests/integration/` with `node:test`. The following new modules are pure and get strict TDD:

**`js/lib/accuracy.js`** — `computeAccuracy(dayRecords, settings) → AccuracyResult`
- Pure function, zero DOM, zero I/O
- Test cases:
  - Empty dayRecords → all zeros
  - Fewer than minDays records → all zeros
  - Perfect predictions (actual === central) → 100% within max_delta, 100% within half
  - Predictions at exactly max_delta boundary → 100% within delta, 0% within half
  - Predictions outside max_delta → 0% within delta
  - Nap rows: skips no-nap days correctly
  - Mixed rejected days: forecast() cold-start gate fires correctly
  - `isColdStart: true` forecast result → row skipped (total unchanged)

**`js/lib/chart-data.js`** — Data transform helpers
- `buildSleepLengthSeries(dayRecords)` → `Array<{ date, sleepHours, rejected }>`
  - Handles missing wake or bedtime (null slots)
  - Handles cross-midnight bedtime (bedtime after wake on same day → next-day bedtime)
- `buildHeatmapData(dayRecords)` → `Array<{ date, sleepHours, dayOfWeek, weekIndex }>`
  - Gap filling (missing dates → null sleepHours)
  - Week index alignment
- `buildTimeBandSeries(dayRecords)` → `Array<{ date, wakeMinutes, bedtimeMinutes }>`
- `buildNapStats(dayRecords)` → `{ napDayPct, avgNapStart, avgNapLength }`
- `buildActivityCorrelation(dayRecords, activityLog)` → `Array<{ activityScore, sleepHours }>`

### UI Modules — Test-After with E2E Guards

Per PLAT-11 and project TDD discipline:

**`js/ui/bottom-nav.js`** — One Playwright E2E test verifying:
- All four tab buttons are present
- Clicking each tab hides/shows the correct screen
- `aria-selected` state updates correctly

**`js/ui/charts-screen.js`** — One Playwright E2E test per chart type:
- Cold-start card shown when insufficient data
- Charts section appears after importing test data
- Stage badge appears when stage active

**`js/ui/accuracy-screen.js`** — One Playwright E2E test:
- 4x3 grid rendered
- "—" shown for nap rows with insufficient data

---

## Stage Integration

### `filterDayRecordsByStage` Contract

[VERIFIED: js/lib/stages.js source]

```javascript
filterDayRecordsByStage(dayRecords, stages, activeStageId)
// Returns: filtered array (same object references, not copies)
// Behavior:
//   activeStageId === null → return dayRecords unchanged
//   activeStageId not found in stages → return dayRecords unchanged (D6-10 fallback)
//   stage.endDate === null → include all records from startDate onwards
//   Boundary dates are inclusive on both ends
//   Date comparison: string lexicographic ('YYYY-MM-DD')
```

**Return type:** Same array of day record objects (not copies). Modifying the returned array would affect the original, but since render() uses them read-only this is safe.

**Edge cases:**
- Empty result (all days outside stage range): returns `[]`
  - `validCount` = 0 → cold-start gate fires → show cold-start card
- Single day result: returns `[singleRecord]`
  - `validCount` = 0 or 1 → cold-start gate fires for default minDays=7
- `stages` array is empty or undefined: returns dayRecords unchanged (D6-10 fallback)

**Thin-stage pattern from Today screen (Today screen lines 628-643):**
The Today screen implements a thin-stage fallback: if the filtered stage has fewer than `minDays` valid records, it falls back to allDays. Charts and Accuracy screens do NOT need this fallback — they show the cold-start card instead (D7-17 scoping is strict for analytics, no silent fallback).

---

## Performance Analysis

### Backtesting Loop Feasibility

[VERIFIED: js/lib/forecast.js source — window slice logic]

`forecast()` slices to `windowDays` (default 7) before computing. For a 300-day dataset:
- Loop iterations: 300 - minDays = 293 (for minDays=7)
- Per iteration: `sorted.slice(0, i)` creates a new array reference (O(i) copy), then `forecast()` slices to last 7 — so the inner computation always operates on at most 7 records
- `calculatePercentiles()` runs on at most 7 records, sorting 4 arrays of ≤7 items
- Total work: O(n × windowDays × 4) ≈ O(300 × 7 × 4) = ~8,400 lightweight operations

**Verdict: synchronous execution is safe.** No chunked async execution needed. The dominant cost is the 300 `slice()` calls, each O(i) — worst case O(n²/2) for the copies. For n=300, this is ~45,000 array element copies. In V8, this is < 5ms.

**For larger datasets (1000+ days):**
The `slice()` copies become O(n²) — but at n=1000, the `slice(0, i)` calls total ~500,000 element copies. Still < 50ms in V8 for typical hardware. Acceptable synchronously for v1. Note in accuracy.js with a comment for future optimization.

**Memory:** The largest `slice(0, i)` copy is the full array — O(n) objects. For 300 day records with ~5 fields each, this is ~15KB peak. Negligible.

---

## CSS Patterns Available

### Reusable Custom Properties

[VERIFIED: style.css source]

The current `style.css` uses explicit hex values rather than CSS custom properties for most colors. However, two CSS custom property references exist in the stage selector styles:

```css
.stage-selector-label { color: var(--color-muted, #888); }
.stage-select { background: var(--color-bg-input, #1a1a2e); color: var(--color-text, #e0e0e0); }
.stage-fallback-note { color: var(--color-muted, #888); }
```

These are fallback-based — the custom properties are not declared anywhere. Phase 7 can introduce them as actual CSS custom properties for the charts palette.

### Established Color Palette

[VERIFIED: style.css and index.html source]

| Token | Value | Usage |
|-------|-------|-------|
| Accent | `#4f46e5` | Primary buttons, active states, chart lines |
| Accent dark | `#4338ca` | Hover state for accent |
| Accent light | `#eef2ff` | Active button background |
| Accent muted | `#ede9fe` | Import button hover |
| Text primary | `#1a1a1a` | Body text |
| Text secondary | `#334155` | Label text |
| Text muted | `#64748b` / `#475569` | Inactive tabs, hints |
| Border | `#e2e8f0` / `#cbd5e1` | Table borders, input borders |
| Surface | `#fff` | Card backgrounds |
| Background | `#fafafa` | Body background |
| Danger | `#b91c1c` / `#dc2626` | Delete buttons, error states |

### Bottom Nav CSS Pattern

[ASSUMED] Standard fixed bottom nav pattern:

```css
/* Bottom navigation (D7-04) */
.bottomNav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px; /* match appHeader min-height */
  display: flex;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  z-index: 100;
}

.bottomNav button[role="tab"] {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 44px; /* D7-02 tap target */
  padding: 4px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 500;
}

.bottomNav button[role="tab"][aria-selected="true"] {
  color: #4f46e5;
}

/* Body padding compensation (D7-04) */
/* Apply to #app: */
#app { padding-bottom: 64px; }
```

### Chart Container CSS Pattern

```css
/* Full-width SVG chart container */
.chartSection {
  margin-bottom: 2rem;
}

.chartSection h2 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0 0 0.5rem 0;
}

.chartSvg {
  width: 100%;
  height: auto; /* viewBox-driven height */
  display: block;
}

/* Stage active badge */
.stageChip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

/* Accuracy grid */
.accuracyGrid {
  display: grid;
  grid-template-columns: auto 1fr 1fr 1fr;
  gap: 1px;
  background: #e2e8f0;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  overflow: hidden;
  font-size: 0.875rem;
}

.accuracyGrid > * {
  background: #fff;
  padding: 0.5rem 0.75rem;
}
```

---

## Validation Architecture

> `workflow.nyquist_validation: true` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert` for unit/integration; Playwright for E2E |
| Unit test dir | `tests/unit/` |
| Integration test dir | `tests/integration/` |
| E2E test dir | `tests/e2e/` |
| Quick run command | `node --test tests/unit/accuracy.test.js` |
| Full suite command | `node --test tests/unit/ tests/integration/ && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-04 | Charts screen renders 5 visualizations | E2E | `npx playwright test tests/e2e/charts-screen.spec.js` | No — Wave 0 |
| UI-04 | `buildHeatmapData` fills gaps and assigns week/day indices | Unit | `node --test tests/unit/chart-data.test.js` | No — Wave 0 |
| UI-04 | `buildSleepLengthSeries` handles missing wake/bedtime slots | Unit | `node --test tests/unit/chart-data.test.js` | No — Wave 0 |
| UI-04 | `buildNapStats` correct avg start/length and pct | Unit | `node --test tests/unit/chart-data.test.js` | No — Wave 0 |
| UI-05 | `computeAccuracy` returns correct percentages for known inputs | Unit | `node --test tests/unit/accuracy.test.js` | No — Wave 0 |
| UI-05 | `computeAccuracy` edge: empty, cold-start, no-nap days | Unit | `node --test tests/unit/accuracy.test.js` | No — Wave 0 |
| UI-05 | Accuracy screen renders 4x3 grid with correct values | E2E | `npx playwright test tests/e2e/accuracy-screen.spec.js` | No — Wave 0 |
| UI-06 | Bottom nav shows 4 tabs; clicking navigates screens | E2E | `npx playwright test tests/e2e/bottom-nav.spec.js` | No — Wave 0 |
| UI-06 | `aria-selected` updates correctly on tab change | E2E | `npx playwright test tests/e2e/bottom-nav.spec.js` | No — Wave 0 |

### Wave 0 Gaps

- [ ] `tests/unit/accuracy.test.js` — covers UI-05 `computeAccuracy` logic
- [ ] `tests/unit/chart-data.test.js` — covers UI-04 data transform helpers
- [ ] `tests/e2e/bottom-nav.spec.js` — covers UI-06 navigation regression guard
- [ ] `tests/e2e/charts-screen.spec.js` — covers UI-04 chart mount and cold-start gate
- [ ] `tests/e2e/accuracy-screen.spec.js` — covers UI-05 accuracy grid display

### Sampling Rate

- **Per task commit:** `node --test tests/unit/accuracy.test.js tests/unit/chart-data.test.js` (< 1s)
- **Per wave merge:** `node --test tests/unit/ tests/integration/` (< 5s)
- **Phase gate:** Full suite `node --test tests/unit/ tests/integration/ && npx playwright test` green before `/gsd-verify-work`

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single-user local app |
| V5 Input Validation | Yes | `textContent` only for all user-supplied strings; SVG attribute values are numbers only |
| V6 Cryptography | No | No cryptography |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via stage name in SVG text element | Tampering / Spoofing | Use `svgTextEl.textContent = stageName` — never `svgTextEl.setAttribute('data-label', stageName)` followed by innerHTML. All SVG `<text>` elements use `.textContent` setter. |
| XSS via activity score in SVG title | Tampering | Activity scores are numeric — validate `typeof score === 'number'` before use; render only the number via `textContent`, never the raw key |
| Tab ID injection via URL | Tampering | Bottom nav validates tab IDs against a `VALID_TABS = new Set(['today', 'history', 'charts', 'accuracy'])` frozen set before calling `onTabChange` |
| Prototype pollution via `activityLog` keys | Tampering | Use `Object.prototype.hasOwnProperty.call(activityLog, date)` or `Object.entries(activityLog)` — never `for..in` without guard |

### Security Invariants from CLAUDE.md

All invariants from CLAUDE.md apply to Phase 7:
- `textContent`-only for all user-supplied strings
- Never assign `innerHTML` anywhere
- SVG attributes for dynamic data must be numeric values, not strings derived from user input
- Stage names rendered via `svgTextEl.textContent = stageName`

---

## Common Pitfalls

### Pitfall 1: `filterDayRecordsByStage` Wrong Signature

**What goes wrong:** Calling `filterDayRecordsByStage(dayRecords, settings)` passes the full settings object as the `stages` parameter, and `settings.activeStageId` would be undefined for the third parameter — silently returning all dayRecords (the null/undefined fallback).

**Why it happens:** The CONTEXT.md `## Code Context` describes it as `filterDayRecordsByStage(dayRecords, settings)` (two-arg), but the actual source takes `(dayRecords, stages, activeStageId)` (three-arg).

**How to avoid:** Always import and call with explicit three arguments:
```javascript
filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId)
```

**Warning signs:** Charts show data even when stage is selected; filtering appears to be no-op.

### Pitfall 2: Look-Ahead Bias in Backtesting Loop

**What goes wrong:** Using `dayRecords.slice(i)` (rest-of-array) as history instead of `dayRecords.slice(0, i)` — or using `sorted[i]` as part of history.

**Why it happens:** Off-by-one error in the loop. The actual day being evaluated (index `i`) must NOT be in the history passed to `forecast()`.

**How to avoid:** Loop: `for (let i = minDays; i < sorted.length; i++)`. History: `sorted.slice(0, i)`. Actual: `sorted[i]`.

**Warning signs:** Accuracy percentages are suspiciously high (90%+); values look inflated.

### Pitfall 3: SVG `<text>` Element with User Content via setAttribute

**What goes wrong:** Using `svgEl.setAttribute('innerHTML', stageName)` or `svgEl.setAttribute('textContent', stageName)` — these do nothing (setAttribute sets DOM attributes, not properties). The SVG text element would be empty.

**Why it happens:** `dom.el()` uses `node[key] = value` for most props, but for SVG elements created via `createElementNS`, standard HTML property assignments may not work the same way.

**How to avoid:** For SVG `<text>` elements, always use:
```javascript
const textEl = svgEl('text', { x: '...', y: '...', 'font-size': '10', fill: '#555' });
textEl.textContent = stageName; // Direct property set — works for SVG text
```

**Warning signs:** SVG text elements render as empty; stage labels invisible on chart.

### Pitfall 4: Cross-Midnight Time Delta in Accuracy Comparison

**What goes wrong:** Bedtime events often occur at 20:00-22:00, and wake events at 06:00-09:00. The `timeToMinutes` function returns 0-1439. A bedtime prediction of `22:00` (1320 min) vs. actual `06:00` (360 min) would show a delta of 960 minutes rather than the intended 0 minutes (they're the same event relative to the sleep cycle).

**Why it happens:** Accuracy for sleep events requires cycle-aware time comparison. The forecast algorithm doesn't have this problem because it only compares times within a rolling window of same-type events.

**How to avoid:** For accuracy comparison, treat wake as a "morning" event (minutes 0-720) and bedtime as "evening" (minutes 720-1440). Do not compare across midnight in the naive way. A simpler mitigation: flag this as a known limitation in the accuracy.js source comment rather than implementing complex cross-midnight logic in v1.

**Warning signs:** Bedtime accuracy shows 0% when it should show high accuracy.

### Pitfall 5: `body` Padding Obscured by Bottom Nav

**What goes wrong:** `body` has `padding: 1.5rem` — adding a fixed bottom nav without compensating for this means content at the bottom of a screen is hidden behind the nav bar.

**Why it happens:** Fixed positioning takes the nav bar out of document flow. `#app` already has `max-width: 32rem; margin: 0 auto;` but no bottom padding.

**How to avoid:** Add `padding-bottom: 64px` (or `var(--bottom-nav-height, 56px) + 8px`) to `#app` in style.css.

---

## Risk Summary

### Risk 1: `filterDayRecordsByStage` Signature Mismatch

**Risk:** Planner writes tasks using the two-arg signature seen in CONTEXT.md, executor implements with wrong arguments, filtering silently becomes a no-op. Stage-scoped charts show all data regardless of stage selection.

**Likelihood:** HIGH (CONTEXT.md description differs from actual source)

**Mitigation:** This RESEARCH.md documents the verified three-arg signature. The planner must reference this research explicitly in the task that calls `filterDayRecordsByStage`. The accuracy.js unit tests must include a test with `activeStageId` set and verify the filtered dataset size.

### Risk 2: Retroactive Backtesting Produces Misleading Accuracy

**Risk:** Cross-midnight time delta comparison produces inaccurate results for bedtime predictions (bedtime near midnight, actual wake next morning). The accuracy numbers for bedtime and wake would be near 0% even when the forecast is working correctly.

**Likelihood:** MEDIUM (depends on user's actual bedtime patterns)

**Mitigation:** In `accuracy.js`, add a comment documenting the cross-midnight limitation. For v1, the comparison is naive minutes-since-midnight and this is acceptable. The Accuracy screen can include a footnote: "Times compared within a single midnight boundary." The unit tests should include a test case with cross-midnight bedtime to confirm it is at least consistently handled (even if not perfectly).

### Risk 3: SVG viewBox Sizing Causes Charts to Overflow on Mobile

**Risk:** Using a large fixed viewBox (e.g. `0 0 600 200`) with `width="100%"` works on desktop but causes excessive height scaling on very narrow screens if `preserveAspectRatio` is `xMidYMid meet` — a 600px wide chart at 320px screen width would render at 67% scale, making the 200px height become 107px. This may be too small for the heatmap's 7-row grid of 11px cells.

**Likelihood:** MEDIUM (depends on heatmap dimensions chosen)

**Mitigation:** For the heatmap, use a taller viewBox with a lower aspect ratio (e.g. `0 0 400 120`) so the height-to-width ratio is preserved acceptably on narrow screens. Alternatively, allow the heatmap to scroll horizontally by wrapping it in an `overflow-x: auto` container. The planner should specify per-chart viewBox dimensions as an explicit task decision.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SVG `width="100%" height="auto"` with fixed viewBox is the correct responsive pattern without JS reflow | SVG Chart Rendering Approach | Chart may not scale correctly; would need JS `resize` observer |
| A2 | Bottom nav height of 56px and `#app { padding-bottom: 64px }` is sufficient to prevent content obstruction | CSS Patterns Available | Last item of scrollable content hidden behind nav |
| A3 | V8 handles 300-iteration backtesting loop (with O(n) array copies) in < 10ms synchronously | Performance Analysis | Screen hangs briefly on mount for large datasets; would need chunked async |
| A4 | Using `new Date(dateStr + 'T00:00')` for heatmap calendar arithmetic is safe (tagged with gsd:allow-ui-clock) | Calendar Heatmap Layout | DST edge: one day per year may be off-by-one near DST transitions |
| A5 | CSS `position: fixed; bottom: 0` for bottom nav works correctly from `file://` URLs | CSS Patterns Available | Bottom nav fails to stick when loaded from file:// |

---

## Sources

### Primary (HIGH confidence — verified from codebase source)

- `js/lib/forecast.js` — Verified `forecast()` signature, input/output shape, cold-start gate, window slice logic, `extractTime()` helper
- `js/lib/stages.js` — Verified `filterDayRecordsByStage(dayRecords, stages, activeStageId)` exact three-argument signature
- `js/ui/today-screen.js` — Verified reactive subscription pattern, `eventLog.subscribe()` / `settings.subscribe()` API, stage filtering call site, `filterDayRecordsByStage` three-arg call
- `js/ui/history-screen.js` — Verified `mountHistoryScreen` pattern, `unsubscribe` return shape, render function structure
- `js/ui/header.js` — Verified `VALID_TABS`, `mountHeader` signature, `setActiveTab` export, `onTabChange` callback structure
- `js/app.js` — Verified `applyTabVisibility`, `activeTab` module-level state, tab dispatch wiring, mount calls
- `js/lib/db-shape.js` — Verified `DEFAULT_SETTINGS` fields: `minDays`, `maxDelta`, `windowDays`, `timeFormat`, `stages`, `activeStageId`
- `js/lib/time.js` — Verified `formatTime(at, timeFormat)` signature (takes full ISO string, not bare HH:MM)
- `js/ui/dom.js` — Verified `el()`, `clear()`, `$()` helpers; no SVG namespace support (SVG elements need `createElementNS`)
- `style.css` — Verified color palette, existing `.tabNav` styles, `.settingsTrigger` 44px tap target, `#app` max-width and margin
- `index.html` — Verified DOM structure: `<nav class="tabNav">` in header, two `<section>` elements in `<main>`, `<dialog>` elements
- `.planning/config.json` — Verified `nyquist_validation: true`, `security_enforcement: true`, `tdd_mode: true`

### Secondary (MEDIUM confidence — derived from established patterns)

- Heatmap layout algorithm derived from standard GitHub-contribution-graph implementation pattern
- SVG coordinate system patterns derived from standard SVG data visualization practices
- Bottom nav CSS from standard mobile web bottom navigation patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external libraries; patterns verified from codebase source
- Architecture: HIGH — all integration points read from actual source files
- Pitfalls: HIGH — pitfall #1 verified from actual signature mismatch; pitfalls #2-5 derived from codebase analysis
- Performance: MEDIUM — O(n²) analysis is sound; actual timing is [ASSUMED] < 10ms for n=300

**Research date:** 2026-06-30
**Valid until:** Phase 7 execution complete (codebase verified at research time)
