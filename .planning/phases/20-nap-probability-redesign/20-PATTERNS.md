# Phase 20: Nap Probability Redesign - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 3 (modified)
**Analogs found:** 3 / 3

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `js/lib/forecast.js` | library (pure algorithm) | transform/compute | Same file (existing `napProbability()` function) | exact |
| `js/ui/today-screen.js` | component (UI layer) | request-response/render | Same file (existing render sites) | exact |
| `tests/unit/forecast.test.js` | test (unit test) | test execution | Same file (existing napProbability test block) | exact |

## Pattern Assignments

### `js/lib/forecast.js` (library, transform/compute)

**Analog:** `js/lib/forecast.js` — lines 1004–1095 (current `NAP_SCORE_WEIGHTS` and `napProbability()`)

**Weight table structure pattern** (lines 1004–1009):
```javascript
export const NAP_SCORE_WEIGHTS = Object.freeze({
  napFrequency:    0.40,
  elapsedWakeTime: 0.30,
  noNapStreak:     0.20,
  windowPassed:    0.10,
});
```

**Key pattern to preserve:**
- Must use `Object.freeze()` to prevent accidental mutation (CLAUDE.md convention, line 1004 comment)
- All four weights must sum to 1.0 (verified by test at line 2546)
- Use decimal notation (e.g., `0.35`, `0.30`) for clarity

**Return shape pattern** — Current `napProbability()` returns `number|null` (lines 1023):
```javascript
/**
 * @returns {number|null}
 */
export function napProbability(dayRecords, settings, context) {
```

**New return shape** (per D-03) must change to:
```javascript
/**
 * @returns {{ score: number|null, signalsUsed: string[], confidence: 'full'|'partial'|'none' }}
 */
export function napProbability(dayRecords, settings, context) {
```

**Cold-start gate pattern** (lines 1026–1027) — preserve this gate at the top level:
```javascript
if (!dayRecords || dayRecords.length < (settings.minDays || 1)) return null;
```

This gate must still return the object shape, e.g.:
```javascript
return { score: null, signalsUsed: [], confidence: 'none' };
```

**Window-closed early-return pattern** (lines 1054–1062) — preserve this hard collapse when P90 is passed:
```javascript
if (napStartResult !== null) {
  const p90_ns = napStartResult.max;
  if (p90_ns !== null && nowMins > p90_ns) {
    return 0;  // window closed — hard collapse (currently bare 0, must become { score: 0, ... })
  }
}
```

**Signal computation pattern** (lines 1042–1085) — existing signals preserved with weight redistribution logic:
```javascript
// --- Signal 1: napFrequency (40%→35%) ---
const napDays = dayRecords.filter(d => getSlotTime(d.napStart) !== null).length;
const sig1 = napDays / dayRecords.length;

// --- Signals 2 & 4: napStart percentiles ---
const napStartResult = calculatePercentiles(
  dayRecords,
  d => getSlotTime(d.napStart),
);

// --- Signal 4: windowPassed (10%) ---
let sig4 = 1;
if (napStartResult !== null && p90_ns !== null && nowMins > p90_ns) {
  return 0;
}

// --- Signal 2: elapsedWakeTime (30%→to be removed per D-01) ---
// (Current computation lines 1065–1081; this signal is REMOVED, not modified)

// --- Signal 3: noNapStreak (20%→15%) ---
const streak = typeof napStreak === 'number' ? napStreak : 0;
const sig3 = Math.max(0, 1 - streak / 5);
```

**Weighted sum pattern** (lines 1087–1095) — current pattern shows how to add weighted signals:
```javascript
const raw =
  NAP_SCORE_WEIGHTS.napFrequency    * sig1 +
  NAP_SCORE_WEIGHTS.elapsedWakeTime * sig2 +
  NAP_SCORE_WEIGHTS.noNapStreak     * sig3 +
  NAP_SCORE_WEIGHTS.windowPassed    * sig4;

return Math.round(raw * 100);
```

**New signals to add** (per D-05, D-08):
- `dayOfWeekNapRate` (30% weight) — call `dayOfWeekAverages()` from metrics.js
- `sleepDebtSignal` (20% weight) — call `sleepDebtProxy()` from metrics.js, normalize via clamp-and-scale

**Import statement to add** (forecast.js currently has no imports):
```javascript
import { dayOfWeekAverages, sleepDebtProxy } from './metrics.js';
```
This is safe — metrics.js imports `timeToMinutes` from forecast.js, but forecast.js will not trigger any cyclic re-import.

**Context fields expected** (per D-07) — add to the context destructuring (currently line 1029–1034):
```javascript
const {
  currentHour    = 0,
  currentMinute  = 0,
  napStreak      = 0,
  todayWakeHHMM  = null,
  todayWeekday   = null,  // NEW: 0=Sun..6=Sat (per D-07)
} = context || {};
```

---

### `js/ui/today-screen.js` (component, request-response/render)

**Analog:** `js/ui/today-screen.js` — lines 921–949 (current `napProbability()` call and context threading)

**Call site pattern** (line 924):
```javascript
const napProbabilityScore = napProbability(forecastDays, snap, {
  currentHour,
  currentMinute,
  napStreak,
  todayWakeHHMM,
});
```

**Updated call site** must add `todayWeekday` (per D-07):
```javascript
const todayWeekday = new Date().getDay();  // 0=Sun..6=Sat
const napProbabilityScore = napProbability(forecastDays, snap, {
  currentHour,
  currentMinute,
  napStreak,
  todayWakeHHMM,
  todayWeekday,  // NEW
});
```

**Context threading pattern** (lines 931–939):
```javascript
const forecastContext = {
  isIntenseToday:      todayDayRecord ? todayDayRecord.intense === true : false,
  napStartLogged:      todayNapStart != null,
  currentHour,
  todayWakeHHMM,
  napProbabilityScore,  // NOW AN OBJECT, not a bare number
  todayNapStartHHMM,
};
```

**Attachment to predictions** (lines 946–949):
```javascript
if (predictions.napStart && !predictions.isColdStart) {
  predictions.napStart.napProbabilityScore = napProbabilityScore;  // NOW AN OBJECT
}
```

**UI rendering sites** (two locations, same pattern) — **must change to read `.score`:**

**Site 1** (lines 167–171 in current code):
```javascript
if (prediction.type === 'napStart' && prediction.napProbabilityScore != null && !prediction.isMissed) {
  const napScoreText = prediction.napProbabilityScore === 0
    ? '0% — nap window closed'
    : `${prediction.napProbabilityScore}% chance of nap today`;
  card.appendChild(el('p', { className: 'nap-probability', textContent: napScoreText }));
}
```

**Must become:**
```javascript
if (prediction.type === 'napStart' && prediction.napProbabilityScore != null && !prediction.isMissed) {
  const napScoreText = prediction.napProbabilityScore.score === 0
    ? '0% — nap window closed'
    : `${prediction.napProbabilityScore.score}% chance of nap today`;
  card.appendChild(el('p', { className: 'nap-probability', textContent: napScoreText }));
}
```

**Site 2** (lines 285–289 in current code) — identical pattern, same fix.

---

### `js/lib/forecast.js` — Bedtime routing integration (lines 690–789)

**Context destructuring update site** (line 697):
```javascript
const {
  isIntenseToday = false,
  napStartLogged = false,
  currentHour = 0,
  todayWakeHHMM = null,
  napProbabilityScore = null,  // NOW AN OBJECT OR MISSING, not a bare number
  todayNapStartHHMM = null,
} = context;
```

**Default handling** — must safely handle the object shape or absence:
```javascript
// OLD: napProbabilityScore = null (default)
// NEW: napProbabilityScore = null (default is still null when not provided)
// If provided, it is { score, signalsUsed, confidence }
```

**Check site #1** (line 773 current code):
```javascript
} else if (napProbabilityScore !== null) {
```

**Must become:**
```javascript
} else if (napProbabilityScore !== null && napProbabilityScore.score !== null) {
```

**Use site #1** (line 778 current code):
```javascript
const ratio = napProbabilityScore / 100;
```

**Must become:**
```javascript
const ratio = napProbabilityScore.score / 100;
```

**Comment update site** (line 788 current code):
```javascript
// napProbabilityScore === null (D-07) → fall through to PRED-10 / overall
```

**Must become:**
```javascript
// napProbabilityScore === null or napProbabilityScore.score === null (D-07) → fall through to PRED-10 / overall
```

---

## Shared Patterns

### Weight Redistribution (D-01, D-02)
When signals are unavailable (dayOfWeekNapRate or sleepDebtSignal return null/undefined), redistribute their weight proportionally across available signals:

```javascript
// Example logic (not literal code):
const availableWeights = {
  napFrequency: 0.35,
  dayOfWeekNapRate: signalIsAvailable ? 0.30 : 0,
  sleepDebtSignal: signalIsAvailable ? 0.20 : 0,
  noNapStreakPenalty: 0.15,
};
const sumOfAvailable = Object.values(availableWeights).reduce((a, b) => a + b, 0);
const scaledWeights = {};
for (const [key, weight] of Object.entries(availableWeights)) {
  scaledWeights[key] = weight / sumOfAvailable;
}
```

### Sleep-Debt Normalization (D-08)
Clamp `sleepDebtProxy()` output to ±180 minutes and map linearly to 0–1 signal value:

```javascript
const debtMinutes = sleepDebtProxy(dayRecords, 7, targetSleepMinutes);
if (debtMinutes === null) {
  // Signal unavailable, redistribution applies
} else {
  const clamped = Math.max(-180, Math.min(180, debtMinutes));
  // Linear map: -180 → 0.0, 0 → 0.5, +180 → 1.0
  const normalized = 0.5 + (clamped / 360);
  const sleepDebtSignal = normalized;
}
```

### Object Return Compatibility
The new object return shape `{ score, signalsUsed, confidence }` must be checked safely in all consumer code:

```javascript
// Safe check pattern:
if (napProbabilityScore && napProbabilityScore.score !== null) {
  // Use napProbabilityScore.score
}

// Safe rendering pattern (avoid [object Object] in UI):
// WRONG: `${prediction.napProbabilityScore}% chance` → renders "[object Object]% chance"
// RIGHT: `${prediction.napProbabilityScore.score}% chance` → renders "72% chance"
```

## No Analog Found

None — all three files being modified are existing tracked files in the codebase. No new patterns are needed outside the codebase.

## Metadata

**Analog search scope:** `js/lib/`, `js/ui/`, `tests/unit/`
**Files scanned:** 4 (forecast.js, metrics.js, today-screen.js, forecast.test.js)
**Pattern extraction date:** 2026-09-16
**Tracked source verification:** All files confirmed via `git ls-files`

