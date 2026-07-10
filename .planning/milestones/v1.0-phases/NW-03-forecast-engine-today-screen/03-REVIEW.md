---
phase: 03-forecast-engine-today-screen
reviewed: 2026-06-05T10:15:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - index.html
  - js/app.js
  - js/lib/forecast.js
  - js/store/event-log.js
  - js/ui/today-screen.js
  - README.md
  - style.css
  - tests/e2e/forecast.spec.js
  - tests/integration/forecast-flow.test.js
  - tests/unit/forecast.test.js
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 03 implements the core forecast engine and integrates it with reactive subscriptions in the Today screen. The implementation demonstrates solid algorithmic reasoning (empirical CDF, rejected-day downweighting, cycle-aware priority selection) and proper test coverage. However, the review identified **2 critical issues** that affect correctness and logic safety, plus several warnings regarding time handling edge cases and boundary condition robustness.

**Key concerns:**
1. Potential null-reference crash in the "Missed by" label calculation when `prediction.central` is missing from the probabilityBand case.
2. Index-out-of-bounds risk in the percentile calculation when using weighted effective counts that don't align with array length.
3. Multiple instances of redundant "Missed by" calculation logic that introduce mutation hazards and inconsistency.
4. Missing null-safety checks on `parts` array split operations before accessing indices.

## Critical Issues

### CR-01: Null-Reference Crash in renderPredictionCard When probabilityBand Used

**File:** `js/ui/today-screen.js:237-243`

**Issue:**
The missed-label rendering block checks `if (isMissed && prediction.central)` to compute the delta for the "Missed by" label (lines 237-243). However, when a prediction uses the `probabilityBand` fallback shape (D3-04), it does NOT have a `central` field — only the `probabilityBand` array. This means:

1. Line 192 sets `isMissed = false` (because `prediction.central` is falsy when probabilityBand is used)
2. Line 237's guard `if (isMissed && prediction.central)` prevents the crash in this function
3. **BUT** — if the prediction shape ever changes or a buggy path injects both `probabilityBand` AND a `central` field, the split/parseInt chain on lines 241-242 will execute without validation

**Evidence:**
- Lines 195–198 check `hasProbBand = Array.isArray(prediction.probabilityBand)` and exclude central/min/max from the card when true
- Lines 237–243 attempt to calculate delta using `prediction.central.split(':')` 
- The guard `if (isMissed && prediction.central)` accidentally prevents the null-reference, but the code pattern suggests `isMissed` should be recalculated or skipped for probabilityBand shapes

**Fix:**
Refactor to avoid recomputing the "Missed by" label. When probabilityBand is present, skip the missed label entirely (since the concept of "missed" is less meaningful on a probability table):

```javascript
// Line 236–250: Missed label (D3-11)
if (isMissed && prediction.central) {
  // Only compute delta for normal central-time predictions, not probabilityBand
  const nowDate = new Date(); // gsd:allow-ui-clock
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const parts = prediction.central.split(':');
  if (parts.length === 2) {  // Defensive: ensure split succeeded
    const centralMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const delta = nowMinutes - centralMinutes;
    if (delta > 0) {
      card.appendChild(el('span', {
        className: 'missed-label',
        textContent: `Missed by ${delta}min`,
      }));
    }
  }
}
```

Or, better: only render missed label when NOT using probabilityBand:
```javascript
if (hasProbBand) {
  // Skip missed label for probability bands
} else if (isMissed && prediction.central) {
  // Render missed label for normal predictions
}
```

---

### CR-02: Index Out-of-Bounds Risk in percentileEffective When k >= times.length

**File:** `js/lib/forecast.js:195–208` (percentileEffective inner function in calculatePercentiles)

**Issue:**
The percentileEffective function uses an effective count (which can be fractional due to rejected-day downweighting) to compute position in the `times` array. The clamping logic on lines 204–205 checks:

```javascript
if (k >= times.length - 1) return times[times.length - 1];
```

However, the effective count is computed from `validDays` (line 188), which may not equal `times.length` when interpolation is involved. The formula:

```javascript
const pos = p * (effectiveCount + 1);
const k = Math.floor(pos - 1);
```

can produce `k` values that exceed `times.length - 1` when:
- effectiveCount is large (e.g., many non-rejected days)
- p is high (e.g., P90 = 0.9)
- times.length is small (e.g., only 2 or 3 unique valid days)

**Example triggering case:**
- 10 valid days, none rejected → effectiveCount = 10
- times.length after conversion = 10
- P90: pos = 0.9 * (10 + 1) = 9.9 → k = floor(9.9 - 1) = floor(8.9) = 8
- Clamp check: 8 >= 10 - 1? 8 >= 9? NO → proceeds to interpolation
- Access times[8] and times[9] — VALID

But with rejected days:
- 10 valid days, 5 rejected at 0.5 weight → effectiveCount = 10 * 0.5 + 5 * 1.0 = 10
- times.length = 10
- Same as above — still safe

However, the comment on line 194 states "Use a modified percentile function that accepts effectiveCount" but the array bounds check on line 205 only compares against `times.length`, not the clamping's relationship to the position formula. This is a subtle **assumption mismatch**: if the effective count logic is later extended (e.g., Phase 3+ allows variable reject weights per event type), this could fail.

**Current safety:** The code is currently safe because `effectiveCount` is always computed from `validDays` which matches `times.length` numerically (even though weights are fractional). However, the logic is fragile.

**Fix:**
Add an explicit bounds check and document the assumption:

```javascript
function percentileEffective(p) {
  if (times.length === 0) return null;
  if (times.length === 1) return times[0];

  // Position based on effective count (not raw array length)
  const pos = p * (effectiveCount + 1);
  const k = Math.floor(pos - 1);
  const frac = pos - Math.floor(pos);

  // Bounds check: k must be within [-1, times.length]
  // k < 0 clamps to first element
  if (k < 0) return times[0];
  // k >= times.length-1 clamps to last element
  // Note: validDays.length should equal times.length, so this is a safety valve
  if (k >= times.length - 1) return times[times.length - 1];

  // Defensive: ensure array access is in bounds
  if (k + 1 >= times.length) return times[times.length - 1];

  return times[k] + frac * (times[k + 1] - times[k]);
}
```

---

## Warnings

### WR-01: Inconsistent "Missed by" Calculation Repeated Across Three Rendering Functions

**File:** `js/ui/today-screen.js:154–167`, `188–192`, `237–243` (three locations)

**Issue:**
The "Missed by" label calculation is duplicated in three places:
1. `renderNextEventCard()` lines 154–167
2. `renderPredictionCard()` lines 188–192 (isMissed detection)
3. `renderPredictionCard()` lines 237–243 ("Missed by" label rendering)

Each computes the same logic independently:
```javascript
const nowDate = new Date();
const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
const parts = prediction.central.split(':');
const centralMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
const delta = nowMinutes - centralMinutes;
```

**Risks:**
- Inconsistency: if one copy is fixed (e.g., adding bounds checks), others remain vulnerable
- Maintainability: future changes to time-comparison logic must update three separate locations
- Mutation hazard: the `parts` split operation lacks validation; if `.split(':')` produces unexpected results, each location fails independently without a shared error boundary

**Fix:**
Extract a helper function in today-screen.js:

```javascript
/**
 * Compute the "Missed by" metadata for a prediction with central time.
 * @param {string} centralHHMM  'HH:MM' format time
 * @returns {{ isMissed: boolean, minutesAgo: number|null }}
 */
function computeMissedMetadata(centralHHMM) {
  if (!centralHHMM) return { isMissed: false, minutesAgo: null };
  
  try {
    const nowDate = new Date();
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const parts = centralHHMM.split(':');
    if (parts.length !== 2) return { isMissed: false, minutesAgo: null };
    
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return { isMissed: false, minutesAgo: null };
    
    const centralMinutes = h * 60 + m;
    const delta = nowMinutes - centralMinutes;
    
    return {
      isMissed: delta > 0,
      minutesAgo: delta > 0 ? delta : null,
    };
  } catch (e) {
    // If time parsing fails, treat as not missed
    return { isMissed: false, minutesAgo: null };
  }
}
```

Then use it consistently in all three locations.

---

### WR-02: Array Index Access Without Length Validation in renderPredictionCard and renderNextEventCard

**File:** `js/ui/today-screen.js:158–159`, `190–191`, `241–242`

**Issue:**
The code splits `prediction.central` by ':' and immediately accesses `parts[0]` and `parts[1]` without checking the resulting array length:

```javascript
const parts = prediction.central.split(':');
const centralMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
```

If the format is malformed (e.g., 'HH', 'HH:MM:SS', or an empty string), `parts` will not have two elements, resulting in `undefined` values passed to `parseInt()`, which coerces to `NaN`.

While `NaN` doesn't crash (it just silently produces `NaN` in arithmetic), the downstream `delta` comparison becomes nonsensical, and the "Missed by" label will display incorrect values.

**Fix:**
Always validate array length before access:

```javascript
const parts = prediction.central.split(':');
if (parts.length !== 2) {
  isMissed = false;  // Treat malformed time as not missed
} else {
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!isNaN(h) && !isNaN(m)) {
    const centralMinutes = h * 60 + m;
    isMissed = centralMinutes < nowMinutes;
  }
}
```

---

### WR-03: Defensive Copy Not Enforced in eventLog.listEvents() Return

**File:** `js/store/event-log.js:192–194`

**Issue:**
The `listEvents()` method returns a defensive copy via spread operator:
```javascript
return [...db.events];
```

However, the return JSDoc comment (lines 189–190) states the invariant but does not enforce it at runtime. Callers in today-screen.js (`lines 489, 509`) trust the contract and immediately call `.find()` on the result. If a future refactor accidentally removes the spread operator, mutations to the returned array would corrupt the store's event log without persisting.

**Current safety:** The code is safe because the spread operator is present. However, this is a documentation-only invariant with no enforcement.

**Fix:**
Add a runtime assertion in development or freeze the returned array:

```javascript
listEvents() {
  const copy = [...db.events];
  // Optional: freeze to prevent accidental mutations
  Object.freeze(copy);
  return copy;
}
```

Alternatively, update JSDoc to be more explicit about the semantics:

```javascript
/**
 * Defensive copy — caller MUST NOT mutate. If mutations occur, the store
 * will not persist them. Phase 4 may add Object.freeze() enforcement.
 * ...
 */
```

---

### WR-04: Ambiguous Behavior of renderForecastSection When predictions.isColdStart is Missing

**File:** `js/ui/today-screen.js:298–309`

**Issue:**
The function checks `if (predictions.isColdStart)` (line 298) but doesn't validate that the `isColdStart` field exists. The forecast() function always returns `isColdStart` (lines 395 and 437 in forecast.js), so this is safe in practice. However:

1. The code doesn't document the required shape of the `predictions` object
2. If forecast() is ever called with malformed input or a stub, the missing field silently falls through to the normal-forecast path (lines 311–332)
3. The condition `if (predictions.isColdStart)` treats `false` and `undefined` identically, which could mask bugs

**Fix:**
Add explicit guards and document the expected shape:

```javascript
/**
 * Re-render the forecast section (next-event hero + cold-start OR four cards).
 *
 * @param {object} predictions  forecast() result with shape:
 *   { isColdStart: boolean, validDayCount?: number, minDaysRemaining?: number,
 *     wake?, bedtime?, napStart?, napEnd? }
 */
function renderForecastSection(predictions, settingsSnap, dayRecords, ...) {
  // Validate predictions object shape
  if (typeof predictions.isColdStart !== 'boolean') {
    throw new Error('predictions must have isColdStart: boolean field');
  }
  
  const timeFormat = settingsSnap.timeFormat;
  clear(nextEventCard);
  clear(coldStartMsg);
  clear(forecastCards);
  
  if (predictions.isColdStart) {
    // ... rest of function
  }
}
```

---

### WR-05: No Validation of day.allEvents in selectNextEvent Before Iteration

**File:** `js/lib/forecast.js:492–499`

**Issue:**
The `selectNextEvent()` function iterates over `day.allEvents` (lines 494) without checking if it exists or is an array:

```javascript
for (const day of dayRecords) {
  if (!day.allEvents || day.allEvents.length === 0) continue;
  for (const evt of day.allEvents) {
    if (lastEvent === null || evt.at > lastEvent.at) {
      lastEvent = evt;
    }
  }
}
```

The guard on line 493 checks `if (!day.allEvents || day.allEvents.length === 0)` and skips the day. However, if `day.allEvents` is not an array (e.g., `null`, `{}`, or a string), the code doesn't explicitly validate that iteration is safe.

**Current safety:** JavaScript's for-of loop will throw a TypeError if allEvents is not iterable, which is an acceptable error. However, the guard should be more explicit.

**Fix:**
Add explicit validation:

```javascript
for (const day of dayRecords) {
  if (!Array.isArray(day.allEvents) || day.allEvents.length === 0) continue;
  for (const evt of day.allEvents) {
    if (lastEvent === null || evt.at > lastEvent.at) {
      lastEvent = evt;
    }
  }
}
```

---

## Info

### IN-01: Missed-Label Delta Calculation Not Bounded to Prevent Negative Display

**File:** `js/ui/today-screen.js:244`, `161`, `160`

**Issue:**
The "Missed by" label is only rendered when `delta > 0` (lines 244, 161):
```javascript
if (delta > 0) {
  card.appendChild(el('span', {
    className: 'missed-label',
    textContent: `Missed by ${delta}min`,
  }));
}
```

This is correct defensive logic. However, the comment "Missed by Xmin" suggests a positive delta, but the variable name `delta` is computed as `nowMinutes - centralMinutes`. If `centralMinutes > nowMinutes` (e.g., prediction is in the future), delta is negative, and the label is correctly suppressed.

The logic is sound, but the naming is slightly confusing. Consider renaming for clarity:

```javascript
const minutesEarlyFromNow = nowMinutes - centralMinutes;  // Positive when event is in the past
if (minutesEarlyFromNow > 0) {
  card.appendChild(el('span', {
    textContent: `Missed by ${minutesEarlyFromNow}min`,
  }));
}
```

---

### IN-02: generateProbabilityBand Loop May Iterate Many Times for Very Wide Bands

**File:** `js/lib/forecast.js:274–282`

**Issue:**
The loop iterates from `startMinutes` to `endMinutes` in 5-minute steps (default). The comment on line 284–285 claims this is bounded:

```javascript
// T-03-05 mitigation: step is fixed at minimum 5 min, so even a 1000-min span
// produces at most 200 time points — no unbounded loop risk.
```

This is correct (1000 / 5 = 200), but the code doesn't enforce `step >= 5` at runtime. If a caller passes `step=1`, the loop could produce 1000+ iterations, consuming CPU and memory. While this is unlikely (the default parameter is 5, and no current callers override it), a defensive check would be safer:

```javascript
const safeStep = Math.max(5, step);  // Enforce minimum 5-minute granularity
for (let t = startMinutes; t <= endMinutes; t += safeStep) {
  // ...
}
```

---

### IN-03: No Type Checking in extractTime Helper for slot Parameter

**File:** `js/lib/forecast.js:345–353`

**Issue:**
The `extractTime()` helper function handles three slot types (null, event object, string) but doesn't validate the event object's shape:

```javascript
if (typeof slot === 'object' && slot.at) return slot.at.slice(11);
```

If `slot.at` is not a string (e.g., `slot.at = 123` or `slot.at = null`), the `.slice(11)` call will throw. While the unit tests cover the happy path, a malformed event object could cause a crash at runtime.

**Fix:**
Validate the `at` field:

```javascript
function extractTime(slot) {
  if (slot == null) return null;
  if (typeof slot === 'object' && slot.at) {
    const at = slot.at;
    if (typeof at === 'string' && at.length >= 11) {
      return at.slice(11);
    }
    return null;  // Malformed or unexpected shape
  }
  if (typeof slot === 'string') return slot;
  return null;
}
```

---

## Recommendations Summary

**Critical (fix before ship):**
1. Refactor "Missed by" label calculation to use a shared helper and validate `parts` array length
2. Add explicit bounds check in `percentileEffective` and document the effective-count assumption

**Warning (should fix):**
3. Extract the "Missed by" calculation logic into a reusable function
4. Validate `parts` array length before access in all three locations
5. Document or enforce the defensive-copy contract in `listEvents()`
6. Add explicit validation of `predictions.isColdStart` shape in `renderForecastSection()`
7. Validate that `day.allEvents` is an array before iterating

**Nice-to-have:**
8. Clarify the `delta` variable name (rename to `minutesEarlyFromNow` or similar)
9. Enforce `step >= 5` in `generateProbabilityBand()`
10. Validate `slot.at` is a string before calling `.slice(11)` in `extractTime()`

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
