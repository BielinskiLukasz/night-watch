# Phase 19: Split Bedtime & Wake-Anchored Nap - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/lib/forecast.js` | lib/algorithm | transform | `js/lib/forecast.js` (existing functions) | exact — extend in-place |
| `js/lib/db-shape.js` | config/schema | transform | `js/lib/db-shape.js` (other forward-compat blocks) | exact — remove field |
| `js/lib/settings-validate.js` | utility/validator | request-response | `js/lib/settings-validate.js` (other field entries) | exact — remove field |
| `js/ui/today-screen.js` | ui/screen | request-response | `js/ui/today-screen.js` (existing context build) | exact — verify only |
| `tests/unit/forecast.test.js` | test | — | `tests/unit/forecast.test.js` (existing describe blocks) | exact — extend in-place |

---

## Pattern Assignments

### `js/lib/forecast.js` — new exported functions + forecast() routing change

**Analog:** `js/lib/forecast.js` (existing helpers in the same file)

**percentileFromArray pattern** — mirrors the existing `percentile(sorted, p)` (lines 114–132).
New helper takes a raw unsorted array + pct (0–100 integer) and sorts internally:

```javascript
// Pattern from percentile() lines 114–132:
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = p * (sorted.length + 1);
  const k = Math.floor(pos - 1);
  const frac = pos - Math.floor(pos);
  if (k < 0) return sorted[0];
  if (k >= sorted.length - 1) return sorted[sorted.length - 1];
  return sorted[k] + frac * (sorted[k + 1] - sorted[k]);
}
// percentileFromArray wraps this: sort internally, call percentile(sorted, pct/100)
```

**buildBedtimeSeriesNapDay / buildBedtimeSeriesNoNapDay pattern** — mirrors `subWindowBedtime()` (lines 407–424) which pre-filters dayRecords and calls `calculatePercentiles` on the sub-array. New functions are simpler: filter by nap-day flag, call `calculatePercentiles` directly, return `{ min, central, max }` as integer minutes or null.

```javascript
// Pattern from subWindowBedtime() lines 407–424:
function subWindowBedtime(window, filterFn, fallbackOffsetMinutes, settings) {
  const { minDays } = settings;
  const subWin = window.filter(filterFn);
  if (subWin.length >= minDays) {
    return calculatePercentiles(subWin, d => extractTime(d.bedtime));
  }
  const base = calculatePercentiles(window, d => extractTime(d.bedtime));
  if (base === null) return null;
  return {
    central: base.central - fallbackOffsetMinutes,
    min:     base.min    - fallbackOffsetMinutes,
    max:     base.max    - fallbackOffsetMinutes,
  };
}
// buildBedtimeSeriesNapDay(dayRecords, settings):
//   filter: d => extractTime(d.napStart) != null
//   if subWin.length < minDays → return null (fall back to overall, no offset shift)
// buildBedtimeSeriesNoNapDay(dayRecords, settings):
//   filter: d => extractTime(d.napStart) == null
//   same null-return fallback
```

**buildNapGapSeries / buildNapDurationSeries pattern** — collect numeric values from dayRecords; return a plain number array (gap or duration in minutes). Follow the `computeDurationBand` pattern (lines 349–381) for midnight-crossover normalization when computing gaps/durations.

```javascript
// Pattern from computeDurationBand() lines 354–366:
const durations = [];
for (const day of window) {
  const wakeStr = extractTime(day.wake);
  const bedStr  = extractTime(day.bedtime);
  if (!wakeStr || !bedStr) continue;
  let dur = timeToMinutes(wakeStr) - timeToMinutes(bedStr);
  if (dur < 0) dur += 24 * 60;   // midnight-crossover normalization
  durations.push(dur);
}
if (durations.length === 0) return null;
// buildNapGapSeries: gap = timeToMinutes(napStart) - timeToMinutes(wake)
//   filter: day has both napStart and wake; normalize if gap < 0
// buildNapDurationSeries: dur = timeToMinutes(napEnd) - timeToMinutes(napStart)
//   filter: day has both napEnd and napStart; normalize if dur < 0
```

**forecast() bedtime routing replacement** — the PRED-11 / PRED-10 if/else chain in lines 601–656 is the exact structural template to replace. D-12 order: (1) split-series selection, (2) PRED-10 intense-day shift stacked on top.

```javascript
// Existing PRED-11 block to REMOVE (lines 604–629):
const noNapFired = !napStartLogged && currentHour >= eveningHour;
if (noNapFired) {
  const noNapResult = subWindowBedtime(
    window,
    d => extractTime(d.napStart) == null,
    settings.noNapBedtimeOffsetMinutes ?? 30,
    settings,
  );
  if (noNapResult !== null) { ... }
}

// Replacement structure (D-12):
// Step 1 — select series via split model
//   if napStartLogged → use buildBedtimeSeriesNapDay result
//   else if napProbabilityScore != null && both sub-series have >= minDays:
//     blend central proportionally, outer-envelope min/max (D-05)
//   else → fall back to calculatePercentiles(window, d => extractTime(d.bedtime))
// Step 2 — apply PRED-10 shift if isIntenseToday (same as existing lines 632–652)
```

**Cold-start / null guard pattern** — consistent across all new functions:

```javascript
// Pattern from forecastEvent() lines 526–530:
function forecastEvent(getTimeFn) {
  const result = calculatePercentiles(window, getTimeFn);
  if (result === null) {
    return { central: null, min: null, max: null };
  }
  // ...
}
// New series functions: return null (not { central: null }) when data insufficient.
// forecast() converts null → forecastEvent fallback inline.
```

**napProbability context threading** — `todayWakeHHMM` is already in the `context` parameter of `napProbability()` (lines 847–851). The same `context` object is passed to `forecast()`. No new plumbing needed. Verify `forecast()` already destructures `todayWakeHHMM` from context for nap-anchor use.

```javascript
// Existing context destructure in forecast() line 554:
const { isIntenseToday = false, napStartLogged = false, currentHour = 0 } = context;
// Phase 19: extend to also destructure todayWakeHHMM:
const { isIntenseToday = false, napStartLogged = false, currentHour = 0,
        todayWakeHHMM = null, napProbabilityScore = null } = context;
```

---

### `js/lib/db-shape.js` — remove `noNapBedtimeOffsetMinutes`

**Analog:** `js/lib/db-shape.js` (existing field removal / forward-compat pattern)

Two sites to edit:

1. **DEFAULT_SETTINGS** (line 66) — delete the `noNapBedtimeOffsetMinutes: 30` entry.

2. **migrateV1ToV2 forward-compat block** (lines 139–140) — delete the `noNapBedtimeOffsetMinutes` injection block:
```javascript
// Lines 139–140 to REMOVE:
if (blob.settings && !('noNapBedtimeOffsetMinutes' in blob.settings)) {
  blob.settings.noNapBedtimeOffsetMinutes = 30;
}
```
No new forward-compat block is needed because the field is being removed (not renamed). Existing blobs with the key will simply carry an unused key until next export/import cycle.

---

### `js/lib/settings-validate.js` — remove `noNapBedtimeOffsetMinutes`

**Analog:** `js/lib/settings-validate.js` (other field validator entries)

Single site to edit: line 63 — delete the validator entry:
```javascript
// Line 63 to REMOVE:
noNapBedtimeOffsetMinutes: { type: 'integer', min: 0, max: 120 },  // PRED-11 / D-08
```
No other changes needed. Circular-import guard still applies: this file imports `DEFAULT_SETTINGS` from `db-shape.js`, not `settings.js`.

---

### `js/ui/today-screen.js` — verify `todayWakeHHMM` threading

**Analog:** `js/ui/today-screen.js` (existing context build, lines 920–936)

`todayWakeHHMM` is already built (line 921) and included in `forecastContext` (line 936). No code change required — this is a read-only verification step. The planner should include a task "confirm `todayWakeHHMM` is in `forecastContext` passed to `forecast()`" with no edit action unless the grep shows it missing.

```javascript
// Lines 920–921 (already present):
// todayWakeHHMM: 'HH:MM' part of today's wake event, or null if not yet logged.
const todayWakeHHMM = _getSlotTime(todayDayRecord?.wake ?? null);
// Line 936: todayWakeHHMM included in forecastContext spread
```

---

### `tests/unit/forecast.test.js` — new test describe blocks

**Analog:** `tests/unit/forecast.test.js` (existing describe/it structure, lines 1–60)

**Import pattern** — add new exports to the existing import statement (lines 23–34):
```javascript
import {
  percentile,
  calculatePercentiles,
  selectCentralTime,
  downweightRejectedDays,
  forecast,
  timeToMinutes,
  minutesToTime,
  generateProbabilityBand,
  detectColdStart,
  selectNextEvent,
  napProbability,
  // Phase 19 additions:
  percentileFromArray,
  buildBedtimeSeriesNapDay,
  buildBedtimeSeriesNoNapDay,
  buildNapGapSeries,
  buildNapDurationSeries,
} from '../../js/lib/forecast.js';
```

**Test structure pattern** — follow the existing `describe` / `it` / `assert.strictEqual` / `assert.deepStrictEqual` pattern (lines 47–60). Use `makeDay(wake, bedtime, napStart, napEnd, rejected)` helper (lines 39–41) for synthetic records.

```javascript
// Pattern from lines 47–60:
describe('percentile(sorted, p)', () => {
  it('empty array returns null', () => {
    assert.strictEqual(percentile([], 0.5), null);
  });
  it('single element returns that element for any percentile', () => {
    assert.strictEqual(percentile([42], 0.1), 42);
  });
  // ...
});

// New describe blocks to add:
// describe('percentileFromArray(values, pct)', () => { ... })
// describe('buildBedtimeSeriesNapDay(dayRecords, settings)', () => { ... })
// describe('buildBedtimeSeriesNoNapDay(dayRecords, settings)', () => { ... })
// describe('buildNapGapSeries(dayRecords)', () => { ... })
// describe('buildNapDurationSeries(dayRecords)', () => { ... })
// describe('forecast() split bedtime routing (PRED-18/19)', () => { ... })
// describe('forecast() wake-anchored nap (PRED-20/21/22)', () => { ... })
```

**Minimal settings object pattern** — existing tests use:
```javascript
// Pattern used throughout existing forecast() tests:
const settings = { minDays: 3, windowDays: 7, maxDelta: 60,
                   intenseDayOffsetMinutes: 30, eveningHour: 18 };
// Phase 19: noNapBedtimeOffsetMinutes is REMOVED from settings;
// ensure new tests do NOT include it in the settings object.
```

---

## Shared Patterns

### Cold-start null guard
**Source:** `js/lib/forecast.js` `forecastEvent()` lines 526–530  
**Apply to:** `buildBedtimeSeriesNapDay`, `buildBedtimeSeriesNoNapDay`, `buildNapGapSeries`, `buildNapDurationSeries`  
Return `null` when fewer than `minDays` valid records exist; caller falls back to `calculatePercentiles` over the full window.

### DST-safe time arithmetic
**Source:** `js/lib/forecast.js` `computeDurationBand()` lines 354–381  
**Apply to:** `buildNapGapSeries`, `buildNapDurationSeries`  
Always compute durations/gaps as `timeToMinutes(end) - timeToMinutes(start)`, normalize with `if (diff < 0) diff += 24 * 60`.

### Return shape convention
**Source:** `js/lib/forecast.js` `calculatePercentiles()` lines 210–214  
**Apply to:** All four new series functions  
`{ min: number, central: number, max: number }` as integer minutes (NOT HH:MM strings). `forecast()` converts to HH:MM at the call site using `minutesToTime`.

### Probability-band check
**Source:** `js/lib/forecast.js` `bedtimePred` IIFE lines 615–626  
**Apply to:** New bedtime routing block inside `forecast()`  
After selecting the split-series result, run `generateProbabilityBand(bedtimeTimes, result.min, result.max, maxDelta)` before converting to HH:MM — same as existing PRED-10/11 blocks.

---

## No Analog Found

None — all files have strong in-codebase analogs.

---

## Metadata

**Analog search scope:** `js/lib/forecast.js`, `js/lib/db-shape.js`, `js/lib/settings-validate.js`, `js/ui/today-screen.js`, `tests/unit/forecast.test.js`
**Files scanned:** 5 source files read in full or targeted sections
**Pattern extraction date:** 2026-09-14
