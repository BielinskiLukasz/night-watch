---
phase: 19-split-bedtime-wake-anchored-nap
reviewed: 2026-09-14T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - js/lib/forecast.js
  - js/lib/db-shape.js
  - js/lib/settings-validate.js
  - js/ui/today-screen.js
  - tests/unit/forecast.test.js
  - tests/unit/db-shape.test.js
  - tests/unit/settings-validate.test.js
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-09-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 19 introduces split bedtime routing (nap-day vs no-nap-day sub-windows blended by `napProbabilityScore`), wake-anchored nap-start/end predictions, and removes the PRED-11 `noNapBedtimeOffsetMinutes` setting per decision D-10. The new pure helper functions (`percentileFromArray`, `buildNapGapSeries`, `buildNapDurationSeries`, `buildBedtimeSeriesNapDay`, `buildBedtimeSeriesNoNapDay`) are well-scoped and internally consistent.

Three blockers require attention before shipping:

1. D-10 removal is incomplete — `index.html` and `settings-modal.js` still expose the removed setting in the UI, causing silent data loss when a user edits that field.
2. Wake-anchored nap-start and nap-end predictions bypass the D3-04 probability-band fallback that every other forecast path enforces.
3. Two separate `new Date()` calls for `currentHour` / `currentMinute` in `today-screen.js` can split at a minute boundary, producing an internally inconsistent timestamp that corrupts `napProbabilityScore`.

---

## Critical Issues

### CR-01: D-10 removal of `noNapBedtimeOffsetMinutes` is incomplete — UI still exposes orphan field

**File:** `index.html:303` and `js/ui/settings-modal.js:97-98,179`

**Issue:** `noNapBedtimeOffsetMinutes` was correctly removed from `db-shape.js` (DEFAULT_SETTINGS), `settings-validate.js` (RULES), and all `forecast.js` paths. However, the HTML `<input>` element at `index.html:303` still renders the field, and `settings-modal.js` reads it (lines 97-98) and writes its value back to `validateSettings` (line 179). Because the field is absent from RULES, `validateSettings` silently ignores it in `mode:'load'` (lenient) and may reject or strip it in `mode:'save'` (strict). A user who edits this field sees no error but their change is silently discarded — a data-loss UX failure and a ghost element in the settings UI.

**Fix:** Remove the `<input id="noNapBedtimeOffsetMinutes">` block from `index.html` and remove the corresponding read/collect lines from `js/ui/settings-modal.js`. A grep for `noNapBedtimeOffsetMinutes` across the whole repo should return zero hits after cleanup.

```javascript
// settings-modal.js — delete these lines:
// line 97: const noNapBedtimeOffsetMinutes = ...
// line 98: form.noNapBedtimeOffsetMinutes.value = ...
// line 179: noNapBedtimeOffsetMinutes: Number(fd.get('noNapBedtimeOffsetMinutes')),
```

---

### CR-02: Wake-anchored nap-start and nap-end predictions bypass the D3-04 probability-band fallback

**File:** `js/lib/forecast.js:811-839`

**Issue:** The PRED-21 (napStart) and PRED-22 (napEnd) wake-anchored prediction blocks construct their result objects as `{ central, min, max }` directly from `percentileFromArray` calls, without invoking `generateProbabilityBand()`. Every other prediction path in `forecast()` (wake, bedtime-classic, bedtime-split, napStart-fallback, napEnd-fallback) calls `forecastEvent()` which internally calls `generateProbabilityBand()` when the P90-P10 spread exceeds `settings.maxDelta`. The wake-anchored paths skip this entirely. When nap-gap or nap-duration variance is high, the caller receives a precise `{ central, min, max }` triple instead of the probability-table fallback, violating the documented D3-04 invariant and surfacing a falsely precise prediction to the user.

**Fix:** After computing the raw percentile values, check whether `(max - min) > settings.maxDelta` (in minutes). If so, build the probability band via `generateProbabilityBand` (or factor a shared helper). Example for PRED-21:

```javascript
const gapP10 = Math.round(percentileFromArray(napGaps, 10));
const gapP50 = Math.round(percentileFromArray(napGaps, 50));
const gapP90 = Math.round(percentileFromArray(napGaps, 90));

if ((gapP90 - gapP10) > settings.maxDelta) {
  // delegate to probability-band path
  napStartPred = forecastEvent(d => extractTime(d.napStart));
} else {
  napStartPred = {
    central: minutesToTime(wakeMin + gapP50),
    min:     minutesToTime(wakeMin + gapP10),
    max:     minutesToTime(wakeMin + gapP90),
  };
}
```

Apply the same guard to the PRED-22 `napDurs` block at lines 831-838.

---

### CR-03: Two separate `new Date()` calls for `currentHour` / `currentMinute` can split at a minute boundary

**File:** `js/ui/today-screen.js:921-922`

**Issue:**

```javascript
const currentHour   = new Date().getHours();   // line 921
const currentMinute = new Date().getMinutes(); // line 922
```

These are two independent `Date` constructions. If execution crosses a minute boundary between line 921 and line 922 — e.g., at 12:59:59.999 → 13:00:00.001 — `currentHour` captures `12` and `currentMinute` captures `0`. The combined time fed into `napProbability(…, { currentHour: 12, currentMinute: 0 })` represents 12:00, not 12:59 or 13:00. Depending on where the nap-probability thresholds fall, this can flip the score by a full hour, silently miscalculating `napProbabilityScore` and corrupting the blended bedtime and nap-start predictions derived from it.

**Fix:** Capture a single `Date` instance and extract both fields from it:

```javascript
const _now = new Date();                         // gsd:allow-ui-clock
const currentHour   = _now.getHours();
const currentMinute = _now.getMinutes();
```

---

## Warnings

### WR-01: `percentileFromArray([])` returns `null`, causing `Math.round(null) = 0` — nonsensical wake-anchored predictions when arrays are empty

**File:** `js/lib/forecast.js:811-839`

**Issue:** When `settings.minDays = 0` (the test default, `noGateSettings`) and the `napGaps` or `napDurs` array is empty, the condition `napGaps.length >= settings.minDays` (`0 >= 0`) is true. `percentileFromArray([], 50)` returns `null`. `Math.round(null)` coerces to `0`. All three fields become `minutesToTime(wakeMin + 0)` = the exact wake time, producing a nap-start prediction that equals the wake time and a nap-end that equals the nap-start. This is a nonsensical but silently accepted prediction. The same path applies to `napDurs` in the napEnd block (line 831).

In production `minDays` is always ≥ 3, so the guard fires and the empty-array path is unreachable — but it is a latent correctness defect and already affects test assertions relying on `minDays: 0`.

**Fix:** Add an explicit guard for empty arrays before the percentile arithmetic:

```javascript
if (todayWakeHHMM !== null && napGaps.length > 0 && napGaps.length >= settings.minDays) {
```

Similarly for napDurs:

```javascript
if (napStartAnchorHHMM !== null && napDurs.length > 0 && napDurs.length >= settings.minDays) {
```

---

### WR-02: Direct mutation of `forecast()` return value attaches UI state to a lib-module output object

**File:** `js/ui/today-screen.js:947-949`

**Issue:**

```javascript
if (predictions.napStart && !predictions.isColdStart) {
  predictions.napStart.napProbabilityScore = napProbabilityScore;
}
```

`predictions` is the object returned directly by `forecast()`, a `js/lib/` module. Mutating it from `today-screen.js` violates the lib/-module purity contract (lib/ returns values; UI mutates only its own state) and creates a hidden coupling: any future code path that reuses or caches `predictions` without expecting this extra property will observe stale or unexpected UI-side data. If `forecast()` ever returns a frozen object, this throws a TypeError silently in non-strict mode.

**Fix:** Wrap the value rather than mutating the return:

```javascript
const napStartWithScore = predictions.napStart && !predictions.isColdStart
  ? { ...predictions.napStart, napProbabilityScore }
  : predictions.napStart;
// use napStartWithScore for rendering instead of predictions.napStart
```

---

### WR-03: `todayDayRecord` is found by calendar date, not subjective sleep-day — returns `undefined` before `cutoverHour`

**File:** `js/ui/today-screen.js:898-900`

**Issue:**

```javascript
const todayAllDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
const todayDateStr = new Date().toISOString().slice(0, 10); // gsd:allow-ui-clock
const todayDayRecord = todayAllDays.find(d => d.date === todayDateStr);
```

`daysBySubjectiveNight` groups events by subjective night, so an event at 02:00 on 2026-09-14 belongs to the sleep-day dated 2026-09-13 (assuming cutoverHour = 4). `new Date().toISOString().slice(0, 10)` returns the UTC calendar date `"2026-09-14"`. Before `cutoverHour`, the day record for the current physical night is stored under yesterday's date string, so `find()` returns `undefined`. All downstream fields that depend on `todayDayRecord` (`todayWakeHHMM`, `isIntenseToday`, napStreak seeding) silently fall back to `null`/`undefined` for the early-morning window — exactly the most safety-critical time for these predictions.

Additionally, `toISOString()` returns UTC time, so users in UTC+ time zones experience this mismatch for a wider window around midnight, not just before `cutoverHour`.

**Fix:** Use the same cutover-hour logic to determine "today's" subjective date rather than the calendar date:

```javascript
const todayDateStr = currentSubjectiveDate(snap.cutoverHour); // or inline equivalent
// where currentSubjectiveDate returns yesterday's date-string when local hour < cutoverHour
```

A minimal inline approach:
```javascript
const _nowDate = new Date(); // gsd:allow-ui-clock
const _localHour = _nowDate.getHours();
const _adjustedDate = _localHour < snap.cutoverHour
  ? new Date(_nowDate.getTime() - 24 * 60 * 60 * 1000)
  : _nowDate;
const todayDateStr = `${_adjustedDate.getFullYear()}-`
  + String(_adjustedDate.getMonth() + 1).padStart(2, '0') + '-'
  + String(_adjustedDate.getDate()).padStart(2, '0');
```

---

## Info

### IN-01: Orphan `noNapBedtimeOffsetMinutes` in test fixture helper objects — incomplete D-10 cleanup

**File:** `tests/unit/settings-validate.test.js:424` and `tests/unit/settings-validate.test.js:494`

**Issue:** Both `validFields` helper objects used to seed settings test fixtures still include `noNapBedtimeOffsetMinutes: 30`. Since this field is absent from RULES in the production validator, `validateSettings` silently ignores it. The fixtures pass, but they are misleading: they suggest the field is still valid, and any test that checks "only known fields are accepted" would need to be updated too. This is a D-10 cleanup gap in the test layer.

**Fix:** Remove `noNapBedtimeOffsetMinutes: 30` from both `validFields` objects at lines 424 and 494.

---

### IN-02: Duplicate group number in `forecast.test.js` comment block

**File:** `tests/unit/forecast.test.js:17`

**Issue:** The comment group index at line 17 repeats group number `4` (copy-paste artifact from the group structure comment block). This is a cosmetic inconsistency but makes the comment index misleading for anyone navigating by group number.

**Fix:** Renumber the comment groups sequentially so each has a unique index.

---

_Reviewed: 2026-09-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
