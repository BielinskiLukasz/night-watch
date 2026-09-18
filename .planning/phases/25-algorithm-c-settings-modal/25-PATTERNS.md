# Phase 25: Algorithm C & Settings Modal - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 7 (1 new, 6 existing to modify)
**Analogs found:** 7 / 7 (100% coverage)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/lib/forecast-blend.js` | library | transform | `js/lib/forecast-tif.js` | exact |
| `js/lib/db-shape.js` | config/model | config | existing (same file) | self |
| `js/lib/settings-validate.js` | utility | transform | existing (same file) | self |
| `js/ui/today-screen.js` | controller | request-response | existing (same file) | self |
| `js/ui/settings-modal.js` | component | request-response | existing (same file) | self |
| `sw.js` | config | config | existing (same file) | self |
| `tests/unit/sw-precache.test.js` | test | validation | existing (same file) | self |

## Pattern Assignments

### `js/lib/forecast-blend.js` (library, transform) — NEW FILE

**Analog:** `js/lib/forecast-tif.js`

**File structure pattern** (lines 1-50 of forecast-tif.js):
The new `forecast-blend.js` must follow this blueprint:
- Header comment block with algorithm name, "Pure function" disclaimer, signature
- Frozen config object at module top (e.g., `const BLEND_CONFIG = Object.freeze({ ... })`)
- Internal helper functions for band building, time conversion, intersection logic
- Main export function with identical signature to `tifForecast(dayRecords, settings, ...)`
- Return shape: `{ isColdStart, wake, bedtime, napStart, napEnd }` where each is `{ central, min, max }` or null

```javascript
// js/lib/forecast-blend.js
// Algorithm C — dual-model blend per NEW_ALG.md
//
// Pure function: no DOM, no browser-storage, no system-clock access.
// blendForecast(dayRecords, settings) → same top-level shape as forecast.js
// and tifForecast.js but computed via multi-band blend with stability checks
// and shrinkage.

import { timeToMinutes, minutesToTime, calculatePercentiles, detectColdStart, downweightRejectedDays } from './forecast.js';

const BLEND_CONFIG = Object.freeze({
  ROUND_MINUTES: 5,
  // Add blendWindowDays, blendTrimPct, blendShrinkage as needed
});

export function blendForecast(dayRecords, settings) {
  // 1. Cold-start gate (reuse detectColdStart from forecast.js)
  const { isColdStart } = detectColdStart(dayRecords, settings.minDays);
  if (isColdStart) {
    return { isColdStart: true, wake: null, bedtime: null, napStart: null, napEnd: null };
  }
  
  // 2. Use settings.blendWindowDays for window length (independent of Classic's windowDays)
  // 3. Compute all four predictions following D-01 through D-10 from CONTEXT.md
  // 4. Return same shape as forecast() and tifForecast()
  
  return {
    isColdStart: false,
    wake:     { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' },
    bedtime:  { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' },
    napStart: { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' },
    napEnd:   { central: 'HH:MM', min: 'HH:MM', max: 'HH:MM' },
  };
}
```

**Imports pattern** (lines 14-22 of forecast-tif.js):
```javascript
import { timeToMinutes, minutesToTime, detectColdStart } from './forecast.js';
import { /* metrics helpers if needed */ } from './metrics.js';
// Do NOT import from settings.js — clock/storage are injected via function params
```

**Reusable helpers from forecast.js to import**:
- `timeToMinutes(hhmm)` — convert 'HH:MM' to minutes (lines 79-83)
- `minutesToTime(minutes)` — convert minutes to 'HH:MM' (lines 92-100)
- `calculatePercentiles(dayRecords, getTimeFn, rejectWeight?)` — P10/P50/P90 bands (lines 206-245)
- `detectColdStart(dayRecords, minDays)` — cold-start gate (reused by all algorithms)
- `downweightRejectedDays(dayRecords, weight)` — rejected-day downweighting (lines 179-184)

**Frozen config pattern** (lines 58-65 of forecast-tif.js):
```javascript
const TIF_CONFIG = Object.freeze({
  ROUND_MINUTES: 5,
  // additional properties as needed
});
// Do this for BLEND_CONFIG too
```

**Band-building helpers** (TIF has these; Algorithm C will need similar):
- `buildHistoricBand(times, trimPct, manualExcluded)` — computes min/max from raw time values
- `buildDurationBand(durations, anchorMinutes, trimPct, manualExcluded)` — projects durations onto an anchor time
- `trimmedMinMax(values, trimPct, manualExcludedCount)` — exported from TIF; may reuse or adapt
- Intersection/stability-check helper for D-02 logic (intersection vs. union envelope)
- Shrinkage helper for D-02 formula: `final = (1 − blendShrinkage) × central + blendShrinkage × center(intersection)`

**Top-level signature** (line 488 of forecast-tif.js):
```javascript
export function blendForecast(dayRecords, settings, activityLog = {}, isNoNapDay = false) {
  // Same param contract as tifForecast — compatibility with today-screen.js dispatcher
}
```

---

### `js/lib/db-shape.js` (config, additive migration)

**Analog:** `js/lib/db-shape.js` (self-pattern)

**DEFAULT_SETTINGS addition pattern** (lines 43-69):
Add three new settings to the frozen `DEFAULT_SETTINGS` object using additive per-field pattern (no version bump):

```javascript
export const DEFAULT_SETTINGS = Object.freeze({
  // ... existing fields ...
  
  // Phase 25 Algorithm C settings (D-11, D-12, D-13)
  blendWindowDays: 90,          // D-11: rolling window length for Algorithm C
  blendTrimPct: 25,             // D-12: extreme-discard fraction (%) before percentile
  blendShrinkage: 0.3,          // D-13: shrinkage factor when central falls outside intersection
});
```

**Additive migration pattern in `migrateV1ToV2`** (lines 103-145):
Follow the idiom used for Phase 10, 12, 13 TIF/PRED settings:

```javascript
// Phase 25 forward-compat: inject Algorithm C settings for blobs predating Phase 25
if (blob.settings && !('blendWindowDays' in blob.settings)) {
  blob.settings.blendWindowDays = 90;
}
if (blob.settings && !('blendTrimPct' in blob.settings)) {
  blob.settings.blendTrimPct = 25;
}
if (blob.settings && !('blendShrinkage' in blob.settings)) {
  blob.settings.blendShrinkage = 0.3;
}
```

**Key invariant:** These additions are idempotent and injected per-field on every load without bumping the schema version (D2-05 / CLAUDE.md pattern). Only schema-breaking changes (e.g., renaming a field) would require version bump.

---

### `js/lib/settings-validate.js` (utility, validation)

**Analog:** `js/lib/settings-validate.js` (self-pattern)

**RULES object addition** (lines 43-66):
Add three entries to the frozen `RULES` object following existing field patterns:

```javascript
export const RULES = Object.freeze({
  // ... existing rules ...
  
  // Phase 25 Algorithm C validation (D-11, D-12, D-13)
  blendWindowDays: { type: 'integer', min: 14, max: 180 },      // D-11
  blendTrimPct:    { type: 'integer', min: 0,  max: 40 },       // D-12
  blendShrinkage:  { type: 'number',  min: 0.0, max: 1.0 },     // D-13
});
```

**Validation flow** (lines 92-100):
No changes needed in `validateSettings(input, opts)` — the generic dispatcher `checkField(field, raw, rule)` already handles all rule types. The three new fields will be validated automatically on the next `validateSettings()` call once RULES is updated.

---

### `js/ui/today-screen.js` (controller, request-response)

**Analog:** `js/ui/today-screen.js` (self-pattern)

**Algorithm dispatch pattern** (lines 1180-1182):
Current pattern for Classic/TIF selection:

```javascript
const predictions = snap.forecastAlgorithm === 'tif'
  ? tifForecast(forecastDaysOldestFirst, snap, activityLog, isNoNapDay)
  : forecast(forecastDaysOldestFirst, snap, forecastContext);
```

**Updated pattern for Phase 25 (Classic / TIF / Algorithm C)**:
Add `blendForecast` import at top and update dispatcher:

```javascript
import { blendForecast } from '../lib/forecast-blend.js';

// ... in the renderUpdate callback ...
const predictions = snap.forecastAlgorithm === 'tif'
  ? tifForecast(forecastDaysOldestFirst, snap, activityLog, isNoNapDay)
  : snap.forecastAlgorithm === 'blend'
    ? blendForecast(forecastDaysOldestFirst, snap, activityLog, isNoNapDay)
    : forecast(forecastDaysOldestFirst, snap, forecastContext);
```

**Reuse existing pattern:** No other changes needed in today-screen.js — the prediction shape is identical across all three algorithms, so `renderForecastSection()` renders all three the same way.

---

### `js/ui/settings-modal.js` (component, request-response)

**Analog:** `js/ui/settings-modal.js` (self-pattern)

**Algorithm selector pattern** (lines 97-116):
Current selector changes `#tifOptions` visibility:

```javascript
const forecastAlgorithmEl = form.elements.namedItem('forecastAlgorithm');
// ...
const isTif = forecastAlgorithmEl.value === 'tif';
tifOptionsEl.hidden = !isTif;
const classicEl = document.getElementById('classicOptions');
if (classicEl) classicEl.hidden = isTif;
```

**Update for Phase 25 (three-way selector):**
The HTML form must have:
- Single `<select name="forecastAlgorithm">` with options: `'classic'`, `'tif'`, `'blend'`
- Three fieldsets/divs: `#classicOptions`, `#tifOptions`, `#blendOptions` (or similar names)
- Change handler wires all three visibility states

```javascript
_forecastAlgorithmChangeHandler = () => {
  const algo = forecastAlgorithmEl.value;
  const classicEl = document.getElementById('classicOptions');
  const tifEl = document.getElementById('tifOptions');
  const blendEl = document.getElementById('blendOptions');
  
  if (classicEl) classicEl.hidden = (algo !== 'classic');
  if (tifEl) tifEl.hidden = (algo !== 'tif');
  if (blendEl) blendEl.hidden = (algo !== 'blend');
};
```

**Form population pattern** (lines 85-117):
Add lines to populate the three new Algorithm C input fields from the settings snapshot:

```javascript
// Phase 25: Algorithm C settings
const blendWindowDaysEl = form.elements.namedItem('blendWindowDays');
if (blendWindowDaysEl) blendWindowDaysEl.value = String(s.blendWindowDays ?? 90);

const blendTrimPctEl = form.elements.namedItem('blendTrimPct');
if (blendTrimPctEl) blendTrimPctEl.value = String(s.blendTrimPct ?? 25);

const blendShrinkageEl = form.elements.namedItem('blendShrinkage');
if (blendShrinkageEl) blendShrinkageEl.value = String(s.blendShrinkage ?? 0.3);
```

**Form submission pattern** (lines 174-198):
Add coercion lines in the `onClose` handler's FormData extraction:

```javascript
const raw = {
  // ... existing fields ...
  forecastAlgorithm:  String(data.get('forecastAlgorithm') ?? 'classic'),
  blendWindowDays:    Number(data.get('blendWindowDays') ?? 90),
  blendTrimPct:       Number(data.get('blendTrimPct') ?? 25),
  blendShrinkage:     Number(data.get('blendShrinkage') ?? 0.3),
  // ... other fields ...
};
```

**Key pattern:** Uses safe fallback defaults in case HTML form element doesn't exist (e.g., in older cached versions). The actual validation is done by `validateSettings(raw, {mode:'save'})` after coercion.

---

### `sw.js` (config, service-worker registration)

**Analog:** `sw.js` (self-pattern)

**PRECACHE_LIST addition** (lines 23-66):
Add `'./js/lib/forecast-blend.js'` to the frozen PRECACHE_LIST array in alphabetical order within the `./js/lib/` section:

```javascript
const PRECACHE_LIST = Object.freeze([
  // ... existing paths ...
  './js/lib/forecast-tif.js',
  './js/lib/forecast-blend.js',  // NEW — Phase 25 Algorithm C
  './js/lib/forecast-utils.js',
  './js/lib/forecast.js',
  // ... rest of lib/ ...
]);
```

**Order:** Insert alphabetically between `forecast-tif.js` and `forecast-utils.js` to maintain consistency with existing file ordering.

**Invariant:** This path MUST be added to pass the sw-precache test. If added to PRECACHE_LIST but not to the test's expected list, the test will fail.

---

### `tests/unit/sw-precache.test.js` (test, validation)

**Analog:** `tests/unit/sw-precache.test.js` (self-pattern)

**New test assertion** (after line 65, alongside other `./js/lib/` assertions):
Add a test that verifies `./js/lib/forecast-blend.js` is in the PRECACHE_LIST:

```javascript
test('contains ./js/lib/forecast-blend.js', () => {
  assert.ok(precacheList.includes('./js/lib/forecast-blend.js'), 'Missing ./js/lib/forecast-blend.js');
});
```

**Placement:** Insert this test in the alphabetical section with other lib/ assertions (between `forecast-tif` and `forecast-utils` tests, or grouped with other forecast tests).

**Invariant:** This test enforces that `forecast-blend.js` is added to PRECACHE_LIST when the file is created. If you forget to add it to sw.js, this test will catch the regression.

---

## Shared Patterns

### Pure Function & Injection Pattern
**Source:** `js/lib/forecast.js` and `js/lib/forecast-tif.js`

All algorithm modules in `js/lib/` follow this contract:
- **No side effects:** No DOM access, no `new Date()`, no `localStorage` calls
- **Dependency injection:** Clock access via injected settings parameter; storage via injected blobs
- **Reuse helpers:** All three forecast algorithms (`forecast`, `tifForecast`, `blendForecast`) import time/percentile helpers from `forecast.js`

```javascript
// forecast-blend.js MUST follow this pattern
export function blendForecast(dayRecords, settings, activityLog = {}, isNoNapDay = false) {
  // No DOM, no Date(), no storage — pure computation only
  // Use timeToMinutes/minutesToTime/calculatePercentiles from forecast.js
}
```

### Frozen Config Pattern
**Source:** `js/lib/forecast-tif.js` (line 28) and `js/lib/db-shape.js` (line 43)

Configuration objects must be frozen per CLAUDE.md convention:
```javascript
const BLEND_CONFIG = Object.freeze({
  ROUND_MINUTES: 5,
  // ... other config ...
});

export const DEFAULT_SETTINGS = Object.freeze({
  // ... all settings ...
});

export const RULES = Object.freeze({
  // ... all validation rules ...
});
```

### Algorithm Dispatch Pattern
**Source:** `js/ui/today-screen.js` (lines 1180-1182)

When multiple algorithms exist, use ternary dispatch:
```javascript
const predictions = snap.forecastAlgorithm === 'tif'
  ? tifForecast(...)
  : snap.forecastAlgorithm === 'blend'
    ? blendForecast(...)
    : forecast(...);
```

Not a switch statement — keeps the code compact and matches existing precedent.

### Settings Modal Show/Hide Fieldset Pattern
**Source:** `js/ui/settings-modal.js` (lines 143-157)

For algorithm-specific settings groups:
1. Define fieldset/div with id `#<algo>Options` (e.g., `#blendOptions`)
2. Wire change listener that sets `.hidden = (currentAlgorithm !== <algo>)`
3. Update on both initial form population and on user selection change

```javascript
_forecastAlgorithmChangeHandler = () => {
  const algo = forecastAlgorithmEl.value;
  const blendEl = document.getElementById('blendOptions');
  if (blendEl) blendEl.hidden = (algo !== 'blend');
};
forecastAlgorithmEl.addEventListener('change', _forecastAlgorithmChangeHandler);
```

### Additive Schema Migration Pattern
**Source:** `js/lib/db-shape.js` (lines 103-145)

For purely additive new settings (no version bump):
```javascript
if (blob.settings && !('newFieldName' in blob.settings)) {
  blob.settings.newFieldName = DEFAULT_VALUE;
}
```

Idempotent: runs on every load; safe to call multiple times; uses `in` operator (not `hasOwnProperty`) to check presence.

### Service Worker Precache Test Pattern
**Source:** `tests/unit/sw-precache.test.js` (lines 41-65)

For each new file added to PRECACHE_LIST, add a corresponding test:
```javascript
test('contains ./path/to/file.js', () => {
  assert.ok(precacheList.includes('./path/to/file.js'), 'Missing ./path/to/file.js');
});
```

The test uses regex parsing to extract the PRECACHE_LIST from sw.js source and verifies expected entries.

---

## No Analog Found

All files have clear analogs or self-patterns. 100% coverage achieved.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `js/adapters/`, `js/store/`, root `sw.js`, `tests/unit/sw-precache.test.js`

**Files scanned:** 7 target files from CONTEXT.md; 10+ supporting files for pattern reference

**Pattern extraction approach:**
1. `forecast-blend.js` → modeled after `forecast-tif.js` (exact structural match)
2. Settings changes → modeled after Phase 10, 12, 13 precedents in `db-shape.js` and `settings-validate.js`
3. Algorithm dispatch → extracted from `today-screen.js` existing ternary pattern
4. Modal show/hide → extracted from settings-modal.js existing TIF option pattern
5. Service worker → extracted from sw.js PRECACHE_LIST and sw-precache.test.js assertions

**Key decision:** All three forecast algorithms share the same top-level shape (`{ isColdStart, wake, bedtime, napStart, napEnd }`), so routing logic in `today-screen.js` is minimal — only the dispatch ternary changes, not the rendering pipeline.
