# Phase 18: Sleep Debt Proxy - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `js/lib/metrics.js` | lib/pure-function | transform | `js/lib/metrics.js` → `aggregateMetrics()` + `dayOfWeekAverages()` | exact (same file) |
| `js/ui/metrics-screen.js` | ui/renderer | request-response | `js/ui/metrics-screen.js` → `COLUMNS`, `buildAggregateRow`, `buildDayRow` | exact (same file) |
| `js/lib/db-shape.js` | config | — | `js/lib/db-shape.js` → `DEFAULT_SETTINGS` | exact (same file) |
| `js/lib/settings-validate.js` | validator | — | `js/lib/settings-validate.js` → `RULES` | exact (same file) |
| `js/ui/settings-modal.js` | ui/form | request-response | `js/ui/settings-modal.js` → `populateForm`, `onClose` raw-object, HTML numeric inputs | exact (same file) |

---

## Pattern Assignments

### `js/lib/metrics.js` — add `sleepDebtProxy()`

**Analog:** existing exports in the same file — `aggregateMetrics()` (line 230) and `dayOfWeekAverages()` (line 417).

**Function signature convention** (mirrors `dayOfWeekAverages`, line 417):
```js
/**
 * Rolling 7-day sleep debt proxy.
 * Caller is responsible for pre-filtering (stage filter + rejected exclusion)
 * before passing dayRecords in — consistent with aggregateMetrics() (D-07).
 *
 * Days where combinedSleepNap is null are excluded and do not count toward
 * windowDays (D-05). Sign convention: positive = deficit (D-06).
 * Returns null when fewer than windowDays valid days are available (D-07).
 *
 * @param {object[]} dayRecords  pre-filtered (stage + rejected) day records,
 *                               oldest-first
 * @param {number}   windowDays  rolling window size (MET-14: fixed 7)
 * @param {number}   targetSleepMinutes  per-day sleep target (from settings)
 * @returns {number|null}  signed sum of deficits, or null if insufficient data
 */
export function sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes) {
```

**Null-exclusion + rolling slice pattern** (mirrors `aggregateMetrics` null filtering and Phase 16 `reversedDays.slice(-N)` pattern):
```js
  // Collect non-null combinedSleepNap values from the last windowDays records.
  // Days with null combinedSleepNap are excluded and do not count (D-05).
  const validDays = dayRecords
    .filter(day => combinedSleepNap(day) !== null)
    .slice(-windowDays);

  if (validDays.length < windowDays) return null; // D-07: cold-start null

  return validDays.reduce((sum, day) => {
    return sum + (targetSleepMinutes - combinedSleepNap(day));
  }, 0);
}
```

**Key invariants:**
- `combinedSleepNap(day)` already imported; no new helpers needed.
- Pure function — no DOM, no I/O, no `new Date()`.
- Caller pre-filters rejected days before passing `dayRecords` (consistent with `aggregateMetrics` and `dayOfWeekAverages`).

---

### `js/ui/metrics-screen.js` — add Sleep Debt column

**Analog:** existing `COLUMNS` array (line 42) and `buildDayRow` / `buildAggregateRow` helpers.

**COLUMNS entry to add** (after `combinedSleepNap` at index 8, consistent with logical grouping):
```js
// In COLUMNS (line ~51, after combinedSleepNap entry):
{ key: 'sleepDebt', label: 'S.Debt', isTime: false, isRatio: false },
```
- `isTime: false, isRatio: false` → `formatCellValue` falls into the duration branch and calls `formatDuration(value)`, which renders minutes as `Xh Ym`. This is appropriate since the debt value is a signed minute count.
- Label `'S.Debt'` is short, consistent with `'Nap Frac'`, `'Day/Sleep'`, `'MA/Sl'`.

**Per-day debt computation in `buildDayRow`** — the debt value must be computed per-row by calling `sleepDebtProxy` with the slice up to and including the current day's index. The CONTEXT.md (integration point) says:
```
sleepDebtProxy(dayRecords.slice(0, i+1), 7)
```
`dayMetrics.sleepDebt` must be populated when building the rows array, not inside `buildDayRow` (to keep `buildDayRow` a pure renderer). The right place is in the `render()` / main loop that already iterates `aggregateMetrics().rows`. Add `sleepDebt` as a field on each row object before passing rows to `buildDayRow`.

**Pattern for adding a computed field to rows** (mirrors how `combinedSleepNap` and `sleepAfterActivityFactor` are assigned inside `aggregateMetrics`'s row-push at line ~284):
```js
// Inside aggregateMetrics rows.push({...}) block, or in the render loop:
sleepDebt: sleepDebtProxy(dayRecords.slice(0, i + 1), 7, snap.settings.targetSleepMinutes),
```

**Aggregate rows** — `buildAggregateRow` (line 254) iterates `COLUMNS` and reads `aggregateData[col.key]`. Adding `sleepDebt` to COLUMNS propagates it automatically to all three aggregate rows (Avg, Min, Max) once the aggregate object includes `avg.sleepDebt`, `min.sleepDebt`, `max.sleepDebt`.

The rolling section (`buildRollingSection`, line 403) similarly iterates COLUMNS — no change needed there beyond adding the COLUMNS entry.

**Import addition** at top of `metrics-screen.js` (line 17):
```js
import {
  aggregateMetrics,
  dayOfWeekAverages,
  sleepDebtProxy,          // add this
} from '../lib/metrics.js';
```

---

### `js/lib/db-shape.js` — add `targetSleepMinutes` to `DEFAULT_SETTINGS`

**Analog:** existing entries in `DEFAULT_SETTINGS` (lines 42–68), specifically recent additions like `firstDayOfWeek` (line 67).

**Pattern to copy** — append before the closing `});`:
```js
// In DEFAULT_SETTINGS, after firstDayOfWeek (line 67):
  targetSleepMinutes: 600,   // MET-13 / D-01: per-day sleep target in minutes (default 10h)
});
```

**JSDoc typedef block** (lines 22–41) must be extended with the new field:
```js
 *   targetSleepMinutes: number,
```
Add in the `@type {Readonly<{...}>}` block alongside the other numeric settings.

---

### `js/lib/settings-validate.js` — add `targetSleepMinutes` validation

**Analog:** existing `RULES` entries for integer fields (lines 45–65), specifically:
```js
// Line 52 (windowDays) — same type pattern:
windowDays:   { type: 'integer', min: 3,  max: 90 },
// Line 60 (trimPct):
trimPct:      { type: 'integer', min: 0, max: 40 },
```

**Entry to add** (append to `RULES`, after `firstDayOfWeek`):
```js
  targetSleepMinutes: { type: 'integer', min: 1, max: 1440 },  // MET-13 / D-02
```
- `min: 1` satisfies "positive integer" constraint (D-02).
- `max: 1440` = 24h in minutes — a safe upper bound for a per-day sleep target.
- The existing `checkField` dispatcher already handles `type:'integer'` — no new case needed.

---

### `js/ui/settings-modal.js` — add `targetSleepMinutes` input + median hint

**Analog:** existing numeric input pattern in `populateForm` (lines 70–96) and `onClose` raw-object (lines 134–157), and HTML numeric inputs in `index.html` (lines 297–305).

**`populateForm` addition** (after `firstDayOfWeek` assignment, line 90):
```js
const targetSleepEl = form.elements.namedItem('targetSleepMinutes');
if (targetSleepEl) targetSleepEl.value = String(s.targetSleepMinutes ?? 600);
```
Guard with `if (targetSleepEl)` — same defensive pattern used for all newer fields (lines 79–96).

**Median hint computation** — on render, compute the all-time median of `combinedSleepNap` from `snap.days` (from `eventLog` via day-buckets). Pattern: call `combinedSleepNap` per day record, collect non-null values, sort, take middle element. Render as muted `<small>` or `<span class="hint">` using `textContent` only (XSS guard):
```js
// After populateForm(snap):
const hintEl = document.getElementById('targetSleepMedianHint');
if (hintEl) {
  const vals = (snap.days || [])
    .map(day => combinedSleepNap(day))
    .filter(v => v !== null)
    .sort((a, b) => a - b);
  if (vals.length > 0) {
    const med = vals[Math.floor(vals.length / 2)];
    hintEl.textContent = 'Your median: ' + formatDuration(med);  // e.g. "9h 45m"
  } else {
    hintEl.textContent = '';
  }
}
```
`formatDuration` is already imported in `metrics-screen.js`; import it similarly in `settings-modal.js` if not already present.

**`onClose` raw-object addition** (inside the `raw = {...}` block, after `firstDayOfWeek`):
```js
targetSleepMinutes: Number(data.get('targetSleepMinutes') ?? 600),
```

**HTML in `index.html`** — add inside the existing numeric-settings `<fieldset>` (near line 295–305), inline with other settings, no new fieldset:
```html
<label>
  Sleep target (minutes)
  <input type="number" id="targetSleepMinutes" name="targetSleepMinutes"
         min="1" max="1440" step="5">
  <small id="targetSleepMedianHint" class="hint"></small>
</label>
```

---

## Shared Patterns

### Pure function contract
**Source:** `js/lib/metrics.js` — every exported function.
**Apply to:** `sleepDebtProxy`.
- No DOM, no I/O, no `new Date()`.
- Null-safe: return `null` when required inputs are absent.
- Caller pre-filters (stage + rejected) before passing `dayRecords`.

### COLUMNS-driven table extension
**Source:** `js/ui/metrics-screen.js` lines 42–62.
**Apply to:** `sleepDebt` column addition.
- Add one `{ key, label, isTime, isRatio }` entry to `COLUMNS`.
- `buildAggregateRow` and `buildRollingSection` iterate `COLUMNS` automatically — no additional changes in those functions.
- `buildDayRow` reads `dayMetrics[col.key]` — the new key must be present on each row object.

### Settings field trio pattern
**Source:** `db-shape.js` DEFAULT_SETTINGS + `settings-validate.js` RULES + `settings-modal.js` populateForm/onClose.
**Apply to:** `targetSleepMinutes`.
- Add default in `DEFAULT_SETTINGS` with inline comment referencing REQ-ID.
- Add rule in `RULES` with matching type and bounds.
- Add `populateForm` line with `?? default` guard.
- Add `onClose` raw-object entry with `Number(data.get(...) ?? default)`.
- Add `<input type="number">` in `index.html` inside existing fieldset.

### XSS guard
**Source:** `js/ui/metrics-screen.js` T-11-05, `js/ui/settings-modal.js` T-2-14.
**Apply to:** median hint rendering.
- All dynamic text via `.textContent` only — never `.innerHTML`.
- `formatDuration()` returns a plain string — safe to assign to `textContent`.

---

## No Analog Found

None. All five files have existing patterns in the codebase to copy from.

---

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `index.html`
**Files scanned:** 5
**Pattern extraction date:** 2026-09-02
