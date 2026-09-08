# Phase 13: TIF Algorithm Extensions - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `js/lib/forecast-tif.js` | algorithm/lib | transform | self (internal extension) | exact |
| `js/lib/db-shape.js` | config/migration | CRUD | self (additive migration) | exact |
| `js/ui/settings-modal.js` | ui/form | request-response | self (TIF section extension) | exact |
| `js/lib/settings-validate.js` | utility/validation | transform | self (field schema extension) | exact |

---

## Pattern Assignments

### `js/lib/forecast-tif.js` — 4 requirement areas

**Analog:** Same file. All patterns extracted from lines 1–551.

---

#### TIF-13: Replace `windowDays` with `tifRollingDays`

**Core pattern** (lines 404–405 — current slice):
```javascript
// CURRENT — replace windowDays with tifRollingDays
const window = dayRecords.slice(-settings.windowDays);
```

**New pattern:**
```javascript
const tifRollingDays = settings.tifRollingDays ?? 7;
const window = dayRecords.slice(-tifRollingDays);
```

**activityLog parameter — function signature change** (line 396):
```javascript
// CURRENT signature
export function tifForecast(dayRecords, settings) {

// NEW signature (D-10)
export function tifForecast(dayRecords, settings, activityLog = {}) {
```

**MA priority override for actBeforeNap** (lines 424–425 — current):
```javascript
// CURRENT
const actBeforeNap = window.map(activityBeforeNap).filter(v => v !== null);

// NEW — D-09: check activityLog[d.date] before derived value
const actBeforeNap = window.map(d => {
  if (activityLog[d.date] != null) return activityLog[d.date];
  return activityBeforeNap(d);
}).filter(v => v !== null);
```

---

#### TIF-15: Add `median` to `trimmedMinMax`, `buildHistoricBand`, `buildDurationBand`, `buildPrediction`

**trimmedMinMax extension** (lines 64–79 — current returns `{ min, max }`):
```javascript
// CURRENT return
return { min: trimmed[0], max: trimmed[trimmed.length - 1] };

// NEW — also return median of trimmed array
const mid = Math.floor(trimmed.length / 2);
const median = trimmed.length % 2 === 1
  ? trimmed[mid]
  : (trimmed[mid - 1] + trimmed[mid]) / 2;
return { min: trimmed[0], max: trimmed[trimmed.length - 1], median };
```

**buildHistoricBand** (lines 160–164) — passes trimmedMinMax result through; automatically gains `median` once trimmedMinMax is extended. No body changes needed.

**buildDurationBand** (lines 183–192 — current):
```javascript
// CURRENT
return {
  min: anchorMinutes + result.min,
  max: anchorMinutes + result.max,
};

// NEW — include projected median (D-13)
return {
  min:    anchorMinutes + result.min,
  max:    anchorMinutes + result.max,
  median: anchorMinutes + result.median,
};
```

**Ratio windows need projected durations, not raw durations.** For ratio windows, the projected array (ratio_i × reference) is passed to a new `buildRatioBand` helper (or `buildDurationBand` called with pre-projected values). The P50 of the projected array becomes median.

**buildPrediction central time** (lines 349–375 — current uses midpoint):
```javascript
// CURRENT central (line 358)
const central = minutesToTime(dispMin + (dispMax - dispMin) / 2);

// NEW — D-12: average of per-window medians
const windowsWithMedian = labelledWindows.filter(w => w.median != null);
const central = windowsWithMedian.length > 0
  ? minutesToTime(
      windowsWithMedian.reduce((sum, w) => sum + w.median, 0) / windowsWithMedian.length
    )
  : minutesToTime(dispMin + (dispMax - dispMin) / 2); // fallback if no medians
```

**sourceWindows shape** (lines 369–373 — current):
```javascript
// CURRENT
sourceWindows: labelledWindows.map(w => ({
  label: w.label,
  min:   minutesToTime(w.min),
  max:   minutesToTime(w.max),
})),

// NEW — D-14: add median field
sourceWindows: labelledWindows.map(w => ({
  label:  w.label,
  min:    minutesToTime(w.min),
  max:    minutesToTime(w.max),
  median: w.median != null ? minutesToTime(w.median) : null,
})),
```

**nullPrediction shape** (lines 322–335 — current):
```javascript
// CURRENT sourceWindows: []
// NEW — D-14: nullPrediction sourceWindows stays [] (no windows, no medians)
// No change needed; median per-window is on window entries, not top-level.
```

---

#### TIF-12: Ratio-based windows for nap-start and nap-end

**Analog pattern — existing actBeforeBand build** (lines 456–459):
```javascript
if (wakeAnchorForNap !== null) {
  const actBeforeBand = buildDurationBand(actBeforeNap, wakeAnchorForNap, trimPct, 0);
  if (actBeforeBand) napStartLabelledWindows.push({ label: 'Activity-before-nap band', ...actBeforeBand });
}
```

**New nap-start ratio window (D-01, D-04, D-05)** — added AFTER existing windows:
```javascript
// today_sleepDuration: actual if bedtime logged, else null
const todaySleepDuration = (() => {
  const today = dayRecords[dayRecords.length - 1];
  const w = extractTime(today?.wake);
  const b = extractTime(today?.bedtime); // yesterday's bedtime
  // resolveAnchor('bedtime') already computes this — reuse pattern
  return null; // planner resolves via resolveAnchor or dedicated helper
})();

if (wakeAnchorForNap !== null && todaySleepDuration !== null) {
  // ratio_i = actBeforeNap_i / sleepDuration_i  for each day in window
  const ratios = window.map((d, i) => {
    const abn = actBeforeNapPerDay[i]; // pre-computed per-day value
    const sd  = sleepDuration(d);
    return (abn !== null && sd !== null && sd > 0) ? abn / sd : null;
  }).filter(v => v !== null);

  const projectedDurations = ratios.map(r => r * todaySleepDuration);
  const ratioNapStart = buildDurationBand(projectedDurations, wakeAnchorForNap, trimPct, 0);
  if (ratioNapStart) {
    napStartLabelledWindows.push({ label: 'MA/sleep ratio band', ...ratioNapStart });
  }
}
```

**New nap-end ratio window (D-02, D-03, D-05)** — after existing nap-end windows:
```javascript
// today_MA: actual napStart − wake if both logged; else napStartPred.central − wakeAnchor
const todayMA = (() => {
  const today = dayRecords[dayRecords.length - 1];
  const actualNS = extractTime(today?.napStart);
  const actualW  = extractTime(today?.wake);
  if (actualNS && actualW) return timeToMinutes(actualNS) - timeToMinutes(actualW);
  if (napStartPred?.central && wakeAnchorForNap !== null) {
    return timeToMinutes(napStartPred.central) - wakeAnchorForNap;
  }
  return null;
})();

if (napStartAnchor !== null && todayMA !== null) {
  const ratiosNE = window.map((d, i) => {
    const abn = actBeforeNapPerDay[i];
    const nd  = napDuration(d);
    return (abn !== null && nd !== null && nd > 0) ? abn / nd : null;
  }).filter(v => v !== null);

  const projectedNapDurations = ratiosNE.map(r => r * todayMA);
  const ratioNapEnd = buildDurationBand(projectedNapDurations, napStartAnchor, trimPct, 0);
  if (ratioNapEnd) {
    napEndLabelledWindows.push({ label: 'MA/nap ratio band', ...ratioNapEnd });
  }
}
```

**Key refactor needed:** `actBeforeNap` must be computed per-day (with activityLog override per D-09) and stored as `actBeforeNapPerDay` array before the window-building section, replacing the current `window.map(activityBeforeNap).filter(...)` one-liner so individual per-day values remain accessible for ratio computation.

---

#### TIF-16: No-nap-day substitution

**No-nap pre-computation pattern (from CONTEXT specifics):**
```javascript
// Pre-compute filtered windows before per-event band building (D-15 through D-19)
// isNoNapDay: caller resolves and passes as parameter OR tifForecast receives nowMinutes
// Recommend: add isNoNapDay = false parameter to tifForecast (planner decides)

const noNapDayWindow    = window.filter(d => extractTime(d.napStart) === null);
const postNoNapWindow   = window.filter((d, i) => i > 0 && extractTime(window[i - 1].napStart) === null);
const isYesterdayNoNap  = window.length >= 2 && extractTime(window[window.length - 2].napStart) === null;
```

**Bedtime band substitution (D-16)** — existing day-length band (lines 532–534):
```javascript
// CURRENT
if (wakeAnchor2 !== null) {
  const dayLenBand = buildDurationBand(dayLengths, wakeAnchor2, trimPct, 0);
  if (dayLenBand) bedtimeLabelledWindows.push({ label: 'Day-length band', ...dayLenBand });
}

// NEW — when isNoNapDay, use filtered dayLengths; fall back if too thin (D-19)
if (wakeAnchor2 !== null) {
  const noNapDayLengths = noNapDayWindow.map(dayLength).filter(v => v !== null);
  const srcLengths      = (isNoNapDay && noNapDayLengths.length >= settings.minDays)
    ? noNapDayLengths
    : dayLengths;
  const label = (isNoNapDay && noNapDayLengths.length >= settings.minDays)
    ? 'Day-length band (no-nap days)'
    : 'Day-length band';
  const dayLenBand = buildDurationBand(srcLengths, wakeAnchor2, trimPct, 0);
  if (dayLenBand) bedtimeLabelledWindows.push({ label, ...dayLenBand });
}
```

**Wake band substitution (D-17):**
```javascript
// Filter sleepDurations to nights that followed a no-nap day
const postNoNapSleepDurations = postNoNapWindow.map(sleepDuration).filter(v => v !== null);
const srcSleepDurations = (isNoNapDay && postNoNapSleepDurations.length >= settings.minDays)
  ? postNoNapSleepDurations
  : sleepDurations;
// Pass srcSleepDurations to the sleep-length band (Window 2).
// Skip combined-band (Window 3) on no-nap days (D-17).
```

**Post-no-nap nap-start window (D-18):**
```javascript
// Added alongside existing nap-start windows (not replacing)
if (isYesterdayNoNap) {
  const postNoNapNapStartTimes = postNoNapWindow
    .map(d => extractTime(d.napStart))
    .filter(Boolean)
    .map(timeToMinutes);
  const postNoNapBand = buildHistoricBand(postNoNapNapStartTimes, trimPct, 0);
  if (postNoNapBand) {
    napStartLabelledWindows.push({ label: 'Post-no-nap nap-start pattern', ...postNoNapBand });
  }
}
```

---

### `js/lib/db-shape.js` — additive migration for `tifRollingDays`

**Analog:** Lines 117–139 (Phase 10 and Phase 12 TIF settings injections).

**Pattern to copy** (lines 121–126):
```javascript
// Phase 10 forward-compat: inject TIF settings for v2 blobs predating Phase 10
if (blob.settings && !('trimPct' in blob.settings)) {
  blob.settings.trimPct = 10;
}
if (blob.settings && !('precisionTarget' in blob.settings)) {
  blob.settings.precisionTarget = 60;
}
```

**New injection (D-07) — place after existing Phase 12 block, before `return blob`:**
```javascript
// Phase 13 forward-compat: inject tifRollingDays for v2 blobs predating Phase 13
if (blob.settings && !('tifRollingDays' in blob.settings)) {
  blob.settings.tifRollingDays = 7;
}
```

**DEFAULT_SETTINGS addition** (lines 41–65) — add after `precisionTarget`:
```javascript
tifRollingDays: 7,  // TIF-13 / D-07: rolling window length for TIF (3–30 days)
```

---

### `js/ui/settings-modal.js` — add `tifRollingDays` input

**Analog:** Lines 83–86 (trimPct and precisionTarget TIF field pattern).

**populateForm addition** (after line 86):
```javascript
// Copy guard pattern from trimPctEl (line 83)
const tifRollingDaysEl = form.elements.namedItem('tifRollingDays');
if (tifRollingDaysEl) tifRollingDaysEl.value = String(s.tifRollingDays ?? 7);
```

**onClose raw object addition** (after line 141, inside `raw`):
```javascript
// Copy pattern from trimPct / precisionTarget (lines 140–141)
tifRollingDays: Number(data.get('tifRollingDays') ?? 7),
```

**HTML input element** — add to `#tifOptions` fieldset in `index.html`, immediately after the `trimPct` input:
```html
<label for="tifRollingDays">TIF history window (days)</label>
<input type="number" id="tifRollingDays" name="tifRollingDays" min="3" max="30" step="1">
```

---

### `js/lib/settings-validate.js` — add `tifRollingDays` validation rule

**Analog:** Line 58–59 (trimPct and precisionTarget rules).

**Pattern to copy:**
```javascript
trimPct:           { type: 'integer', min: 0, max: 40 },   // TIF-02 / D10-13
precisionTarget:   { type: 'integer', min: 1, max: 300 },  // TIF-03 / D10-13
```

**New rule (D-07):**
```javascript
tifRollingDays:    { type: 'integer', min: 3, max: 30 },   // TIF-13 / D-07
```

---

## Shared Patterns

### Window degradation (null guard)
**Source:** `js/lib/forecast-tif.js` lines 453–458
**Apply to:** All new source windows (ratio bands, no-nap filtered bands, post-no-nap historic band)
```javascript
const band = buildDurationBand(values, anchorMinutes, trimPct, 0);
if (band) labelledWindows.push({ label: 'Band label', ...band });
// When band is null (empty/all-trimmed input), window is silently skipped.
```

### Thin-history fallback (D-19)
**Source:** Pattern from `detectColdStart` + CONTEXT specifics
**Apply to:** TIF-16 no-nap filtered arrays
```javascript
// Fall back to full window when filtered sub-window has fewer than minDays records
const src = (filtered.length >= settings.minDays) ? filtered : full;
```

### extractTime usage
**Source:** `js/lib/forecast-tif.js` lines 41–46
**Apply to:** All new per-day slot checks inside `tifForecast`
```javascript
// Always use local extractTime (not imported) — avoids unexported internals
function extractTime(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) return slot.at.slice(11);
  if (typeof slot === 'string') return slot;
  return null;
}
```

### app.js call-site update
**Source:** `js/app.js` (composition root — planner must locate and update the `tifForecast()` call)
**Apply to:** Pass `activityLog` as 3rd argument (D-10) and resolve `isNoNapDay` before the call (D-15)
```javascript
// Pattern: tifForecast(dayRecords, settings, eventLog.getActivityLog())
// isNoNapDay resolution: check eveningHour passed AND today's napStart is null
//   const isNoNapDay = (nowHour >= settings.eveningHour) && (today?.napStart == null);
// Pass as 4th param or pre-compute filtered arrays in caller — planner decides.
```

---

## No Analog Found

None. All 4 files are self-extensions with clear internal patterns to follow.

---

## Metadata

**Analog search scope:** `js/lib/forecast-tif.js` (551 lines, fully read), `js/lib/db-shape.js` (158 lines, fully read), `js/ui/settings-modal.js` (lines 1–160 read), `js/lib/settings-validate.js` (grep)
**Files scanned:** 4
**Pattern extraction date:** 2026-08-26
