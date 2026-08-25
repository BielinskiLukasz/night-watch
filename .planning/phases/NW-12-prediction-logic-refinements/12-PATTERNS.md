# Phase 12: Prediction Logic Refinements - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 7 (5 modified, 2 UI modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/lib/forecast.js` | lib/algorithm | transform | self (extend existing) | exact |
| `js/lib/day-bucket.js` | lib/transform | CRUD | self (extend existing) | exact |
| `js/lib/db-shape.js` | lib/migration | transform | self (extend existing) | exact |
| `js/ui/today-screen.js` | ui/render | request-response | self (extend existing) | exact |
| `js/ui/manual-entry.js` | ui/form | request-response | `js/ui/settings-modal.js` | role-match |
| `js/ui/history-screen.js` | ui/render | request-response | self (extend existing) | exact |
| `js/ui/settings-modal.js` | ui/form | request-response | self (extend existing) | exact |

---

## Pattern Assignments

### `js/lib/forecast.js` — extend `selectNextEvent()` + `forecast()` (PRED-08/09/10/11/12)

**Analog:** self — `js/lib/forecast.js`

**Evening-hour override in `selectNextEvent()` (PRED-08):**
Copy the existing priority-switch pattern (lines 506–528). The new rule fires before the switch:
```javascript
// After the lastEvent is found, before the priority switch:
if (lastEvent.type === 'wake') {
  const nowHour = /* injected clock or gsd:allow-ui-clock */ new Date().getHours(); // gsd:allow-ui-clock
  if (nowHour >= settings.eveningHour) {
    priority = ['bedtime', 'napEnd', 'napStart', 'wake'];
    // skip switch
  }
}
// else fall through to existing switch
```
`selectNextEvent` currently receives `(predictions, dayRecords)` — add `settings` as a third parameter.

**Sub-window percentile pattern for PRED-10 (intense bedtime) and PRED-11 (no-nap bedtime):**
Mirror the existing `forecastEvent(getTimeFn)` closure inside `forecast()` (lines 409–433). Add two new filtered sub-window helpers that follow the same shape:
```javascript
// Pattern: filter dayRecords window to a sub-population, run calculatePercentiles, convert to HH:MM
function subWindowBedtime(filterFn, fallbackOffsetMinutes) {
  const subWindow = window.filter(filterFn);
  if (subWindow.length < minDays) {
    // Thin-history fallback: shift P50 bedtime by fixed offset
    const base = calculatePercentiles(window, d => extractTime(d.bedtime));
    if (!base) return null;
    return {
      central: minutesToTime(base.central - fallbackOffsetMinutes),
      min:     minutesToTime(base.min    - fallbackOffsetMinutes),
      max:     minutesToTime(base.max    - fallbackOffsetMinutes),
    };
  }
  const result = calculatePercentiles(subWindow, d => extractTime(d.bedtime));
  if (!result) return null;
  return {
    central: minutesToTime(result.central),
    min:     minutesToTime(result.min),
    max:     minutesToTime(result.max),
  };
}
```

**Duration-band union for wake (PRED-09):**
Night sleep duration per day = `timeToMinutes(wake) - timeToMinutes(bedtime)` (may be negative if bedtime is before midnight — add 24*60 when negative). Formula and union:
```javascript
// Compute duration-band for wake: lastBedtime + [P10_dur, P90_dur]
// Uses existing timeToMinutes / minutesToTime / calculatePercentiles helpers.
// Outer union with hour-band (lines 429–433 pattern):
const finalMin = Math.min(hourBand.min, durationBand.min);
const finalMax = Math.max(hourBand.max, durationBand.max);
const finalCentral = hourBand.central; // P50 of historical wake hours (unchanged)
```
When `lastBedtime` is null (bedtime not yet logged this cycle), fall back to hour-band only — same null-guard pattern used throughout `forecastEvent`.

**Nap probability score (PRED-12):**
New exported function `napProbability(dayRecords, stages, settings, clockNow)` — pure, no DOM. Returns 0–100 integer. Uses `filterDayRecordsByStage` (already imported in `today-screen.js`; import in `forecast.js` too or keep in a new `forecast-context.js` — planner to decide). Scoring signals use `calculatePercentiles` and `timeToMinutes` from the same file.

**Imports pattern** (lines 1–5, no imports — file is self-contained):
```javascript
// forecast.js has no import statements — all helpers are local or exported from this file.
// PRED-12's filterDayRecordsByStage reference: either import from '../lib/stages.js'
// or have today-screen.js pass the pre-filtered dayRecords. Prefer the latter
// to avoid adding an import to a pure-lib file.
```

**Error/null guard pattern** (lines 409–433):
```javascript
// Every forecastEvent call returns { central: null, min: null, max: null } when
// calculatePercentiles returns null (no valid days). All new modifiers must
// follow this null-safe pattern — never assume a sub-window has data.
if (result === null) {
  return { central: null, min: null, max: null };
}
```

---

### `js/lib/day-bucket.js` — add `intense` flag injection (D-01/D-02)

**Analog:** self — `annotateRejected()` pattern (lines 254–267)

**Pattern to copy exactly:**
```javascript
// annotateRejected — lines 254-267
function annotateRejected(records, settings) {
  const rejectedDays =
    settings && Array.isArray(settings.rejectedDays)
      ? settings.rejectedDays
      : [];
  if (rejectedDays.length === 0) {
    return records.map(day => ({ ...day, rejected: false }));
  }
  return records.map(day => ({
    ...day,
    rejected: rejectedDays.includes(day.date),
  }));
}
```

**New `annotateIntense()` — identical shape:**
```javascript
function annotateIntense(records, settings) {
  const intenseDays =
    settings && Array.isArray(settings.intenseDays)
      ? settings.intenseDays
      : [];
  if (intenseDays.length === 0) {
    return records.map(day => ({ ...day, intense: false }));
  }
  return records.map(day => ({
    ...day,
    intense: intenseDays.includes(day.date),
  }));
}
```

**Call site:** chain after `annotateRejected` in both `daysByCalendar` and `daysBySubjectiveNight` (lines 281–306). Pass `settings` (already received by both public functions).

---

### `js/lib/db-shape.js` — additive migration for 3 new settings fields (D-06/D-08/D-01)

**Analog:** self — the Phase 10 forward-compat block (lines 113–123)

**Pattern to copy exactly (lines 113–123):**
```javascript
// Phase 10 forward-compat: inject TIF settings for v2 blobs predating Phase 10
if (blob.settings && !('forecastAlgorithm' in blob.settings)) {
  blob.settings.forecastAlgorithm = 'classic';
}
if (blob.settings && !('trimPct' in blob.settings)) {
  blob.settings.trimPct = 10;
}
if (blob.settings && !('precisionTarget' in blob.settings)) {
  blob.settings.precisionTarget = 60;
}
```

**New Phase 12 block (add immediately after, before `return blob`):**
```javascript
// Phase 12 forward-compat: inject prediction-refinement settings
if (blob.settings && !Array.isArray(blob.settings.intenseDays)) {
  blob.settings.intenseDays = [];
}
if (blob.settings && !('eveningHour' in blob.settings)) {
  blob.settings.eveningHour = 18;
}
if (blob.settings && !('noNapBedtimeOffsetMinutes' in blob.settings)) {
  blob.settings.noNapBedtimeOffsetMinutes = 30;
}
if (blob.settings && !('intenseDayOffsetMinutes' in blob.settings)) {
  blob.settings.intenseDayOffsetMinutes = 30;
}
```

**DEFAULT_SETTINGS additions** (lines 41–61): add four new entries following existing style:
```javascript
intenseDays:               [],   // PRED-10: dates flagged as intense activity days
eveningHour:               18,   // PRED-08/11: hour after which bedtime logic activates
noNapBedtimeOffsetMinutes: 30,   // PRED-11: fallback shift when no-nap history is thin
intenseDayOffsetMinutes:   30,   // PRED-10: fallback shift when intense-day history is thin
```

---

### `js/ui/today-screen.js` — card order fix + nap probability display (UI-07/PRED-12)

**Analog:** self — `renderNextEventCard()` lines 118–185 and `renderPredictionCard()` lines 198–280

**Card order fix (D-16):** line 516 — one-line change:
```javascript
// FROM:
const EVENT_TYPES = ['wake', 'bedtime', 'napStart', 'napEnd'];
// TO:
const EVENT_TYPES = ['wake', 'napStart', 'napEnd', 'bedtime'];
```

**Nap probability on prediction card (PRED-12/D-14):** copy the TIF precision-score badge pattern (lines 160–165) for the classic path. Add after the existing `time-band` paragraph inside `renderPredictionCard`:
```javascript
// After rendering min/max band, inside the normal (non-probabilityBand) branch:
if (prediction.napProbability != null) {
  card.appendChild(el('p', {
    className: 'nap-probability',
    textContent: `${prediction.napProbability}% chance of nap today`,
  }));
}
```

**Nap probability on hero card (PRED-12/D-15):** same pattern inside `renderNextEventCard`, after the `time-band` paragraph (line 155):
```javascript
if (prediction.type === 'napStart' && prediction.napProbability != null) {
  card.appendChild(el('p', {
    className: 'nap-probability',
    textContent: `${prediction.napProbability}% chance of nap today`,
  }));
}
```

**XSS invariant:** both additions use `textContent` via `el()` helper — never `innerHTML`. Follow the existing `el('p', { className, textContent })` pattern throughout.

---

### `js/ui/manual-entry.js` — intense-day checkbox (D-04)

**Analog:** `js/ui/settings-modal.js` — `populateForm()` + close handler `raw` assembly (lines 69–145)

**Checkbox read pattern** (lines 74, 80 of settings-modal.js):
```javascript
// Reading a checkbox from a form:
form.elements.namedItem('autoOutlier').checked = Boolean(s.autoOutlier);
// ...
autoOutlier: data.get('autoOutlier') === 'on',
```

**New intense-day checkbox wiring in manual-entry.js:**
- Checkbox lives in the static HTML `<dialog id="manualEntry">`. Planner adds the `<input type="checkbox" name="intenseDayCheck" id="intenseDayCheck">` to index.html.
- On modal open: read `settings.get().intenseDays.includes(dateForEvent)` and set `.checked`.
- On save: if `intenseDayCheck` is checked, call `settings.update({ intenseDays: [...existing, date] })`; if unchecked and date was in list, remove it.
- The `date` to key on is the calendar date portion of the event's `at` string (`.slice(0, 10)`).

**Existing save pattern to follow** (`openManualEntry` close handler — look for `eventLog.addEventAt / editEvent` call site in the file):
```javascript
// Pattern: read form → validate → mutate store → close
// For intense-day: mutate settings store (not event log) at the same save moment.
// Guard: only update settings if the checkbox state changed (read before-write
// to avoid spurious subscriber fires — the store already does read-before-write
// internally, but be explicit).
```

---

### `js/ui/history-screen.js` — intense-day badge per day row (D-05)

**Analog:** self — `buildDayRow` rejected-checkbox pattern (read from line 200 onward in the file)

**Rejected checkbox pattern to mirror:**
The rejected column renders an `<input type="checkbox">` whose `change` event calls `settings.update({ rejectedDays: [...] })`. The intense badge follows the same shape but is a toggle button or clickable badge rather than a checkbox.

**New badge rendering:**
```javascript
// Inside buildDayRow, after the Rejected cell:
const intenseCell = document.createElement('td');
intenseCell.className = 'col-intense';
if (day.intense) {
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'intense-badge';
  badge.textContent = 'Intense';  // textContent only — XSS invariant
  badge.setAttribute('aria-label', `Remove intense flag for ${day.date}`);
  badge.addEventListener('click', () => {
    const current = settings.get().intenseDays || [];
    settings.update({ intenseDays: current.filter(d => d !== day.date) });
  });
  intenseCell.appendChild(badge);
}
row.appendChild(intenseCell);
```

**`day.intense` is available** after `annotateIntense()` is wired in `day-bucket.js` — no additional data fetch needed.

---

### `js/ui/settings-modal.js` — two new Forecast section inputs (D-06/D-08)

**Analog:** self — `eveningHour` and `noNapBedtimeOffsetMinutes` follow the exact pattern of existing numeric Forecast inputs (`maxDelta`, `minDays`, `windowDays`).

**`populateForm` additions** (after line 86):
```javascript
const eveningHourEl = form.elements.namedItem('eveningHour');
if (eveningHourEl) eveningHourEl.value = String(s.eveningHour ?? 18);
const noNapOffsetEl = form.elements.namedItem('noNapBedtimeOffsetMinutes');
if (noNapOffsetEl) noNapOffsetEl.value = String(s.noNapBedtimeOffsetMinutes ?? 30);
```

**`raw` assembly additions** (after line 137 in the close handler):
```javascript
eveningHour:               Number(data.get('eveningHour') ?? 18),
noNapBedtimeOffsetMinutes: Number(data.get('noNapBedtimeOffsetMinutes') ?? 30),
intenseDayOffsetMinutes:   settings.get().intenseDayOffsetMinutes ?? 30, // not a form field
intenseDays:               settings.get().intenseDays || [],             // not a form field
```

**`validateSettings` in `js/lib/settings-validate.js`:** add range checks for `eveningHour` (0–23 integer) and `noNapBedtimeOffsetMinutes` (0–120 integer), following the same pattern as `maxDelta` / `minDays` validation in that file.

---

## Shared Patterns

### XSS Guard
**Source:** `js/ui/dom.js` — `el(tag, { textContent, className })` helper
**Apply to:** ALL new DOM-building code in today-screen.js, history-screen.js, manual-entry.js
```javascript
// Always: el('p', { className: 'nap-probability', textContent: someString })
// Never:  element.innerHTML = someString
```

### Object.freeze for config
**Source:** `js/lib/forecast.js` line 50, `js/lib/day-bucket.js` line 47
**Apply to:** Any new frozen config objects (e.g. scoring weight table for PRED-12)
```javascript
const NAP_SCORE_WEIGHTS = Object.freeze({
  napFrequency:      0.40,
  elapsedWakeTime:   0.30,
  noNapStreak:       0.20,
  windowPassedZero:  0.10,
});
```

### DST-safe time arithmetic
**Source:** `js/lib/forecast.js` — `timeToMinutes()` / `minutesToTime()` / `extractTime()`
**Apply to:** All new time calculations in forecast.js (duration band, sub-window medians)
```javascript
// Night sleep duration (may cross midnight — normalize):
let dur = timeToMinutes(wakeHHMM) - timeToMinutes(bedtimeHHMM);
if (dur < 0) dur += 24 * 60;  // e.g. wake=06:30, bedtime=21:00 → 06:30+24h - 21:00 = 9.5h
```

### Additive settings migration (no version bump)
**Source:** `js/lib/db-shape.js` lines 113–123
**Apply to:** All 4 new settings fields in `migrateV1ToV2()`
```javascript
// Guard with `!('field' in blob.settings)` for scalars,
// `!Array.isArray(blob.settings.field)` for arrays.
// Never bump blob.version for purely additive fields.
```

### Store read-before-write for arrays
**Source:** `js/ui/settings-modal.js` lines 125, 132
**Apply to:** `intenseDays` mutations in manual-entry.js and history-screen.js
```javascript
// Always read current state before mutating array fields:
const current = settings.get().intenseDays || [];
settings.update({ intenseDays: [...current, date] });
```

### Subscriber pattern
**Source:** `js/ui/history-screen.js` lines 127–128
**Apply to:** Any new reactive subscriptions (today-screen already has them)
```javascript
const unsubEventLog = eventLog.subscribe(render);
const unsubSettings = settings.subscribe(render);
// Return { unsubscribe() { unsubEventLog(); unsubSettings(); } }
```

---

## No Analog Found

All files have strong analogs within the codebase. No file requires falling back to RESEARCH.md patterns.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`
**Files read:** forecast.js, day-bucket.js, db-shape.js, stages.js, today-screen.js (selected ranges), manual-entry.js (selected ranges), history-screen.js (selected ranges), settings-modal.js (selected ranges)
**Pattern extraction date:** 2026-08-25
