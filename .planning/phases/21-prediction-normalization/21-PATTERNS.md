# Phase 21: Prediction Normalization - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 5 source/config files + 1 test file + 1 documentation file
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/lib/forecast-utils.js` | utility/service | transform | `js/lib/time.js` | exact |
| `js/lib/forecast.js` | service | transform | itself (existing) | self-modify |
| `js/ui/today-screen.js` | component | request-response | itself (existing) | self-modify |
| `sw.js` | config | file-I/O | itself (existing) | self-modify |
| `tests/unit/sw-precache.test.js` | test | request-response | itself (existing) | self-modify |
| `.planning/phases/20-nap-probability-redesign/20-CONTEXT.md` | documentation | n/a | existing | self-modify |

---

## Pattern Assignments

### `js/lib/forecast-utils.js` (NEW utility module, transform data flow)

**Analog:** `js/lib/time.js` and `js/lib/accuracy.js`

**Module structure pattern** (from `js/lib/time.js` lines 1-31):
```javascript
// js/lib/forecast-utils.js
// Pure logic for event-reachability determination — no side effects.
//
// === Exported Functions ===
//
// nextReachableEvent(lastEvent, currentHour, settings) → string[]
//   Determines which upcoming event(s) are actually reachable given the last logged event
//   and the time of day. Returns array of event-type strings (normally length 1,
//   length 2 for ambiguous wake branch when both napStart and bedtimeAfterWake are reachable).
//   Absorbs and replaces the priority-order logic currently duplicated in selectNextEvent()
//   (js/lib/forecast.js:892-987), fixing that function's gsd:allow-ui-clock calls.
//
// selectNextEvent(predictions, dayRecords, settings) → { type, isMissed, ...prediction } | null
//   Thin wrapper: finds lastEvent from dayRecords, reads clock once, calls nextReachableEvent,
//   then walks the returned array against predictions to skip event types with no historical data.

import { timeToMinutes } from './forecast.js';
```

**Import pattern** (from `js/lib/accuracy.js` lines 1-33):
```javascript
// Imports only what is needed from peer modules
import { forecast, timeToMinutes } from './forecast.js';

/**
 * Frozen config: event definitions.
 * Object.freeze per CLAUDE.md convention.
 */
const FORECAST_UTILS_CONFIG = Object.freeze({
  // Config values as needed
});
```

**Pure function pattern** (from `js/lib/time.js` lines 46-51):
```javascript
/**
 * Determine next reachable event(s) from last logged event.
 * Pure function: takes currentHour as parameter instead of calling new Date().
 *
 * @param {{ type: string, at: string }|null} lastEvent  most recently logged event
 * @param {number} currentHour  0-23 from wall-clock time
 * @param {{ eveningHour?: number }} settings  optional settings
 * @returns {string[]}  array of next-event-type strings (1-2 elements)
 */
export function nextReachableEvent(lastEvent, currentHour, settings = {}) {
  // Implementation extracts priority logic from selectNextEvent (forecast.js:948-987)
  // Returns array, not single type
}
```

**Error handling pattern** (from `js/lib/accuracy.js` lines 59-66):
```javascript
// Defensive null-checking and early returns
function extractEventTime(event) {
  if (!event || !event.at) return null;
  const at = event.at;
  // ...
  return timeToMinutes(hhmm);
}
```

---

### `js/lib/forecast.js` (self-modify: extract and remove)

**Analog:** itself (existing file)

**`selectNextEvent()` function extraction target** (lines 895-989):
Extract the entire function body, relocating to `forecast-utils.js` after D-06 refactoring.

**Pattern to extract — PRED-08 evening-hour override** (lines 951-961):
```javascript
// ── Step 2: PRED-08 (D-07) evening-hour override ─────────────────────────
// When the current hour is at or past eveningHour AND the last logged event
// was a wake, skip the nap-start priority and surface bedtime instead.
// gsd:allow-ui-clock — display-only scheduling heuristic, not domain logic
const nowHour = new Date().getHours(); // gsd:allow-ui-clock
const eveningHour = (settings && typeof settings.eveningHour === 'number')
  ? settings.eveningHour
  : 18;
if (lastEvent.type === 'wake' && nowHour >= eveningHour) {
  return buildResult(predictions, ['bedtime', 'napEnd', 'napStart', 'wake']);
}
```
**This becomes:** extract to `nextReachableEvent(lastEvent, currentHour, settings)` — receive `currentHour` as parameter instead of calling `new Date()`.

**Pattern to extract — Priority switch** (lines 963-987):
```javascript
// ── Step 3: Determine cycle-aware priority order (D3-10) ─────────────────
// The priority array encodes "what naturally comes next in the sleep cycle"
// based on the most recently logged event type.
let priority;
switch (lastEvent.type) {
  case 'bedtime':
    priority = ['wake', 'napStart', 'napEnd', 'bedtime'];
    break;
  case 'wake':
    priority = ['napStart', 'bedtime', 'napEnd', 'wake'];
    break;
  case 'napStart':
    priority = ['napEnd', 'bedtime', 'wake', 'napStart'];
    break;
  case 'napEnd':
    priority = ['bedtime', 'wake', 'napStart', 'napEnd'];
    break;
  default:
    priority = ['wake', 'bedtime', 'napStart', 'napEnd'];
}

return buildResult(predictions, priority);
```
**This becomes:** core logic of `nextReachableEvent()` — iterate switch, collect reachable types into array.

**Bedtime blending section gains `bedtimeAfterWake` field** (lines 748-793):
After computing `bedtimePred`, add:
```javascript
// D-09: expose bedtimeAfterWake separately for dual-hero-card display
const bedtimeAfterWakePred = buildBedtimeSeriesNoNapDay(window, settings) !== null
  ? selectBedtime(buildBedtimeSeriesNoNapDay(window, settings))
  : null;
// Add to final predictions object:
// predictions.bedtimeAfterWake = bedtimeAfterWakePred;
```

**Hard-collapse-to-0 branch removed** (lines 1055-1060):
Current code:
```javascript
// BEFORE: hard-collapse-to-0 when window closed
if (napStartP90 != null && currentTime > napStartP90) {
  return 0;  // ← REMOVE THIS BRANCH
}
```
**After:** remove entirely; let `napWindowClosed` flag be computed instead (Phase 20 D-11/D-12).

---

### `js/ui/today-screen.js` (self-modify: rendering reorganization)

**Analog:** itself (existing file)

**Current import statement** (line 44):
```javascript
import { forecast, selectNextEvent, napProbability } from '../lib/forecast.js';
```
**Becomes:**
```javascript
import { forecast, napProbability } from '../lib/forecast.js';
import { selectNextEvent } from '../lib/forecast-utils.js';
```

**`renderNextEventCard()` pattern — handle dual hero cards** (lines 118-192):
Current function renders single prediction. D-08 requires it to handle rendering **both** `napStart` and `bedtimeAfterWake` when present.

**Pattern: iterate array of predictions and render side-by-side** (from existing card structure):
```javascript
// CURRENT: single prediction
function renderNextEventCard(prediction, timeFormat) {
  if (!prediction) return null;
  const heroClass = prediction.isMissed ? 'next-event-hero missed' : 'next-event-hero';
  const card = el('div', { className: heroClass });
  // ...render single prediction
  return card;
}

// D-08 BECOMES: could handle array or dual rendering
// The exact DOM/CSS structure is under "Claude's Discretion" (Phase 21 D-08)
// but the pattern is: when renderForecastSection() passes multiple hero predictions,
// show them side by side (not stacked), each with its own predicted time.
```

**`renderForecastSection()` reorganization** (lines 494-547):
**Current pattern:** renders four fixed-order event-type cards into `forecastCards` container.

**D-10/D-12 becomes:** 
```javascript
function renderForecastSection(predictions, settingsSnap, dayRecords, nextEventCard, coldStartMsg, forecastCards) {
  // ... existing cold-start check ...
  
  // Determine reachable events from nextReachableEvent()
  const reachableTypes = nextReachableEvent(lastEvent, currentHour, settingsSnap);
  
  // Render hero card(s) for reachable events
  const heroEl = renderNextEventCard(nextEvt, timeFormat);
  if (heroEl) {
    nextEventCard.appendChild(heroEl);
    nextEventCard.style.display = '';
  } else {
    nextEventCard.style.display = 'none';
  }
  
  // NEW: Wrap secondary (non-hero) events in a collapsible "Later today" <details> section
  // Pattern: use native <details> with no open attribute (Phase 17 pattern per CONTEXT.md)
  const laterToday = el('details', { className: 'later-today-section' });
  const summary = el('summary', { textContent: 'Later today' });
  laterToday.appendChild(summary);
  
  // Append non-hero event cards into the <details> wrapper
  const EVENT_TYPES = ['wake', 'napStart', 'napEnd', 'bedtime'];
  for (const type of EVENT_TYPES) {
    if (reachableTypes.includes(type)) continue;  // Skip hero events
    const pred = predictions[type];
    if (!pred) continue;
    
    // Existing card rendering logic (unchanged per D-12)
    if (pred.precisionScore != null || pred.isLowConfidence != null) {
      if (pred.isLowConfidence) {
        laterToday.appendChild(renderTifLowConfidenceCard(pred, type, timeFormat));
      } else {
        laterToday.appendChild(renderTifNormalCard(pred, type, timeFormat, settingsSnap.precisionTarget ?? 60));
      }
    } else {
      laterToday.appendChild(renderPredictionCard(pred, type, timeFormat));
    }
  }
  
  forecastCards.appendChild(laterToday);
}
```

**Note on nap-window suppression** (D-01/D-02/D-04):
`napStart` card is hidden by NOT including it in reachable events when:
- `napWindowClosed === true` (Phase 20's new flag in napProbabilityScore), OR
- `currentHour >= eveningHour` (existing PRED-08 behavior, D-05)

This is determined in `nextReachableEvent()` logic, not in today-screen.js rendering.

---

### `sw.js` (self-modify: PRECACHE_LIST)

**Analog:** itself (existing file)

**Current PRECACHE_LIST** (lines 23-64):
Sorted, immutable list of app-shell files.

**Pattern: add new lib file** (alphabetically in the lib section, lines 36-49):
```javascript
const PRECACHE_LIST = Object.freeze([
  // ... existing entries ...
  './js/lib/forecast-tif.js',
  './js/lib/forecast-utils.js',  // ← NEW (after forecast-tif.js, before forecast.js)
  './js/lib/forecast.js',
  // ... rest of entries ...
]);
```

**Invariant:** File must:
- Be relative path starting with `./`
- NOT be a test-only adapter (clock-fixed.js, storage-memory.js)
- NOT be under .planning/, .github/, tests/, scripts/ directories
- Be alphabetically sorted within its section (js/lib/)

---

### `tests/unit/sw-precache.test.js` (self-modify: add assertion)

**Analog:** itself (existing file)

**Current pattern** (lines 117-127):
```javascript
test('contains forecast-tif.js (TIF algorithm module)', () => {
  assert.ok(precacheList.includes('./js/lib/forecast-tif.js'), 'forecast-tif.js missing from PRECACHE_LIST');
});

test('contains metrics.js (TIF metrics helpers module)', () => {
  assert.ok(precacheList.includes('./js/lib/metrics.js'), 'metrics.js missing from PRECACHE_LIST');
});
```

**Add new test** (after existing lib tests, before final describe block):
```javascript
test('contains forecast-utils.js (event-reachability utilities module)', () => {
  assert.ok(precacheList.includes('./js/lib/forecast-utils.js'), 'forecast-utils.js missing from PRECACHE_LIST');
});
```

---

## Shared Patterns

### Pure Function Convention
**Source:** `js/lib/forecast.js`, `js/lib/time.js`, `js/lib/accuracy.js`
**Apply to:** `forecast-utils.js` and all modifications to `forecast.js`

All functions in `lib/` modules are pure — no `new Date()` calls (except where marked `gsd:allow-ui-clock`). Parameters must include any time-dependent values needed (e.g., `currentHour` for `nextReachableEvent()`).

### Object.freeze Configuration
**Source:** `js/lib/forecast.js` lines 60-67, `js/lib/time.js` lines 30-31
**Apply to:** Any config objects in `forecast-utils.js`

```javascript
const FORECAST_UTILS_CONFIG = Object.freeze({
  // config values
});
```

### Import Pattern
**Source:** `js/lib/accuracy.js` line 33, `js/lib/forecast.js` line 58
**Apply to:** `forecast-utils.js` imports

One-directional imports from `lib/` modules: import helpers from sibling modules (e.g., `forecast-utils.js` imports `timeToMinutes` from `forecast.js`), but never import from UI or store modules.

### Service-Worker Precache Pattern
**Source:** `sw.js` lines 23-64, `tests/unit/sw-precache.test.js` lines 41-127
**Apply to:** Any new `js/lib/` module

1. Add file to `sw.js` PRECACHE_LIST (alphabetically sorted within section)
2. Add test assertion in `sw-precache.test.js` with descriptive comment
3. File must pass all existing precache validation tests (no test-adapter, no .planning/, etc.)

### Event-Reachability Priority Model
**Source:** `js/lib/forecast.js` lines 967-987 (switch statement), lines 951-961 (eveningHour override)
**Apply to:** `nextReachableEvent()` implementation

The 5-path event model (from Phase 21 D-07):
- `wake` → `['napStart', 'bedtimeAfterWake']` (both while nap reachable) or `['bedtimeAfterWake']` (once napStart drops)
- `napStart` → `['napEnd']`
- `napEnd` → `['bedtimeAfterNap']`
- `bedtime` (either flavor) → `['wake']`

Conditions for `napStart` drop (D-05): `napWindowClosed === true` OR `currentHour >= eveningHour`.

### DOM Rendering Wrapper Pattern
**Source:** `js/ui/today-screen.js` lines 550-589 (renderStageSelector), Phase 17 pattern (no-open-attribute `<details>`)
**Apply to:** "Later today" collapsible section in `renderForecastSection()`

```javascript
const detailsElement = el('details', { className: 'later-today-section' });
// NO open attribute — collapsed by default (D-11)
const summary = el('summary', { textContent: 'Later today' });
detailsElement.appendChild(summary);
// Append child cards to detailsElement
```

Per CLAUDE.md: `replaceChildren()` / `clear()` resets `<details>` open state on rebuild (Phase 17 D-08).

---

## No Analog Found

All files being created/modified have close analogs in the existing codebase. Files under consideration are either existing files being modified (self-analogs) or new modules that follow existing patterns from peer modules (`forecast-utils.js` follows `time.js` and `accuracy.js` patterns).

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `sw.js`, `tests/unit/sw-precache.test.js`
**Files scanned:** ~10 key files
**Pattern extraction date:** 2026-09-16

**Git-tracked status:** All analogs verified as git-tracked source (no mirrors):
- `js/lib/forecast.js` ✓
- `js/lib/time.js` ✓
- `js/lib/accuracy.js` ✓
- `js/ui/today-screen.js` ✓
- `sw.js` ✓
- `tests/unit/sw-precache.test.js` ✓
