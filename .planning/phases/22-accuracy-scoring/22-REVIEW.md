---
phase: 22-accuracy-scoring
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - js/lib/accuracy.js
  - js/lib/accuracy-tif.js
  - js/ui/accuracy-screen.js
  - style.css
  - tests/e2e/accuracy-screen.spec.js
  - tests/unit/accuracy.test.js
  - tests/unit/accuracy-tif.test.js
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-09-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 22 accuracy-scoring rewrite: the classic retroactive backtester
(`accuracy.js`), the TIF retroactive backtester (`accuracy-tif.js`), the rewritten
Accuracy screen UI, the accuracy-grid CSS, and the associated unit/E2E tests. The
core linear-decay scoring formula, the bedtime nap-day/no-nap-day fan-out, the
ACC-03 "usable forecast AND actual" total semantics, and the D-10 overall headline
are all implemented correctly and match their unit tests.

However, tracing `js/lib/accuracy-tif.js`'s window-hit/width computation against
`forecast-tif.js`'s known midnight-wraparound behavior turned up a real
correctness bug: a TIF bedtime (or wake) prediction window that crosses midnight
produces an inverted `algMin`/`algMax` pair after `minutesToTime()`'s modulo wrap,
which silently corrupts `avgWidthMin` (can go negative) and guarantees a
`windowHit` miss for that day — with no equivalent to the "KNOWN LIMITATION"
documentation `accuracy.js` carries for its own (less severe) midnight-wrap case.
Separately, the Accuracy screen's data-fetch call omits the `settings` argument
that `history-screen.js`/`metrics-screen.js` pass to `daysBySubjectiveNight()`,
so the Accuracy screen silently ignores the user's configured `rejectedDays` —
unlike every other history-consuming screen in the app. The TIF grid also lacks
the classic grid's explicit "no data → dash" handling for zero-total event types,
so an unused event type (e.g., no naps ever logged) renders as a real "0%" score
rather than "—". A few smaller dead-code/robustness and style items round out the
findings below.

## Critical Issues

### CR-01: TIF midnight-crossing prediction window corrupts avgWidthMin and guarantees a miss

**File:** `js/lib/accuracy-tif.js:212-223`
**Issue:**
`computeTifAccuracy` computes window width and hit/miss purely as:
```js
const algMinMin = timeToMinutes(bounds.algMin);
const algMaxMin = timeToMinutes(bounds.algMax);
if (algMinMin === null || algMaxMin === null) continue;

const c = counters[type];
c.total++;
const isHit = actualMinutes >= algMinMin && actualMinutes <= algMaxMin;
...
const width = algMaxMin - algMinMin;
c.widthSum += width;
```
`bounds.algMin`/`algMax` come from `forecast-tif.js`'s `buildPrediction()`, which
computes `algMinRaw`/`algMaxRaw` as unbounded minutes (documented at
`forecast-tif.js:187-221`: "result is NOT wrapped mod 1440... Callers that anchor
to bedtime (producing times that cross midnight) must wrap themselves") and then
formats them with `minutesToTime()`, which wraps via `% 1440` (`forecast.js:92-99`).
For a bedtime window whose raw upper bound crosses midnight (e.g. algMinRaw=1410
→ "23:30", algMaxRaw=1455 → wraps to "00:15"), the resulting bounds object is
`{ algMin: "23:30", algMax: "00:15", ... }`. Converting those back to minutes here
gives `algMinMin=1410 > algMaxMin=15`, so:
- `width = algMaxMin - algMinMin` is **negative** (e.g. -1395) and gets summed
  into `widthSum`, corrupting `avgWidthMin` for every day sharing that bucket
  (the UI would render something like `±-1395 min`, or a wildly wrong average
  once blended with other days).
- `isHit` becomes structurally unsatisfiable (`actualMinutes >= 1410 && actualMinutes <= 15`
  can only be true for values that are simultaneously ≥1410 and ≤15, i.e. never),
  so the day is scored as a guaranteed miss regardless of how accurate the
  prediction actually was.

This is materially worse than the "KNOWN LIMITATION" the classic algorithm
documents in `accuracy.js:31-35, 92-95` (which only causes an inflated *delta*,
still bounded), and it is not documented anywhere in `accuracy-tif.js`. Late
bedtimes near/after midnight are a realistic real-world scenario for this app's
target users (irregular toddler sleep), so this is reachable in normal usage, not
just a synthetic edge case.

**Fix:** Normalize the window to a monotonic minute range before comparing/summing,
e.g. detect wraparound and re-express the window in a consistent (possibly
>1440) reference frame before converting back with `timeToMinutes`, or compare
using the same un-wrapped raw values `forecast-tif.js` already computes instead
of round-tripping through wrapped `HH:MM` strings:
```js
function toRangeMinutes(minStr, maxStr) {
  const min = timeToMinutes(minStr);
  let max = timeToMinutes(maxStr);
  if (max < min) max += 24 * 60; // window crosses midnight — un-wrap
  return { min, max };
}
// ...
const { min: algMinMin, max: algMaxMin } = toRangeMinutes(bounds.algMin, bounds.algMax);
// and similarly un-wrap actualMinutes relative to algMinMin when comparing
```
At minimum, document the limitation as explicitly as `accuracy.js` does, and
guard against negative width being summed (e.g. skip or `Math.abs` with a
comment) so a single wrapped day cannot silently poison the aggregate stat.

## Warnings

### WR-01: Accuracy screen never applies the user's rejected-days setting

**File:** `js/ui/accuracy-screen.js:453`
**Issue:** The render function fetches history with:
```js
const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);
```
`daysBySubjectiveNight(cutoverHour, limit, settings)` only marks day records as
`.rejected` when a `settings` object (4th positional arg internally, 3rd here) is
passed through — see `js/store/event-log.js:229-230` and
`js/lib/day-bucket.js:254-267` (`annotateRejected`: "if settings is not provided...
all days default to `rejected = false`"). Both `history-screen.js:105`
(`eventLog.daysBySubjectiveNight(snap.cutoverHour, Infinity, snap)`) and
`metrics-screen.js:645` (`eventLog.daysBySubjectiveNight(snap.cutoverHour, undefined, snap)`)
pass `snap` through; the Accuracy screen does not.

Consequences for this phase's own engine:
- `forecast()`'s rejected-day downweighting (D3-03, `weight: day.rejected ? weight : 1.0`
  in `forecast.js`) never activates during Accuracy's retroactive backtesting —
  every day is treated as full-weight even if the user explicitly flagged it as
  an outlier in Settings.
- The cold-start gate at `js/ui/accuracy-screen.js:460`
  (`const validCount = days.filter(d => !d.rejected).length;`) always evaluates
  to `days.length` regardless of `rejectedDays`, so a rejected-heavy history could
  show "enough data" to compute accuracy when it should still be cold-start per
  the same rule other screens enforce.

**Fix:**
```js
const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour, undefined, snap);
```

### WR-02: TIF accuracy grid shows "0%"/"±0 min" instead of "—" for event types with zero scored days

**File:** `js/ui/accuracy-screen.js:300-325` (`buildTifAccuracyGrid`)
**Issue:** `computeTifAccuracy` always returns a fully-populated stats object for
all 6 `EVENT_TYPES`, even when `total === 0` for a type (e.g. no naps ever logged,
or a no-nap-only history) — see `js/lib/accuracy-tif.js:243-258`, where
`avgWidthMin` defaults to `0` (not `null`) and `pct(...)` defaults to `0` (not
`null`) when `t === 0`. `buildTifAccuracyGrid`'s only "no data" fallback is:
```js
const eventStats = (stats && stats[row.key]) != null ? stats[row.key] : null;
...
cellValue = eventStats.avgWidthMin != null ? eventStats.avgWidthMin : null;
```
Since `stats[row.key]` is never null/undefined and `avgWidthMin`/`.pct` are never
`null` (they're `0` by construction), `cellValue === null` is unreachable in
practice, so a genuinely-unused event type renders `"0%"` / `"±0 min"` / `"0%"` —
implying a real, poor accuracy score rather than "no data available". This
contradicts the classic grid's explicit handling one function above it
(`js/ui/accuracy-screen.js:196, 201`: `showDash = isNapType && rowResult.total < snap.minDays;`
… `if (showDash || rowResult.total === 0) { cell.textContent = '—'; }`), and the
module header even documents "D-05 — TIF table gains matching bedtimeNapDay/
bedtimeNoNapDay rows" as mirroring the classic table's behavior. The E2E test for
this path explicitly does not assert numeric values ("Numeric values are not
asserted — TIF's window-bound arithmetic is not as trivially deterministic..."),
so this gap isn't caught by the test suite.

**Fix:** Thread `.total` through to the TIF grid the same way the classic grid
does, e.g. have `computeTifAccuracy` expose `total` on each type's result (or have
`buildTifAccuracyGrid` accept per-row total counts) and dash the row when
`total === 0`, mirroring `buildAccuracyGrid`'s `rowResult.total === 0` check.

### WR-03: `computeTifAccuracy`'s null guard for algMin/algMax cannot actually catch invalid input

**File:** `js/lib/accuracy-tif.js:212-214`
**Issue:**
```js
const algMinMin = timeToMinutes(bounds.algMin);
const algMaxMin = timeToMinutes(bounds.algMax);
if (algMinMin === null || algMaxMin === null) continue;
```
`timeToMinutes()` (`forecast.js:79-83`) never returns `null`: for a well-formed
`'HH:MM'` string it returns a number; for a non-string value (e.g. `undefined`/
`null`, which could occur if `computeTifAccuracy` is ever called with
hand-built/imported `history` data that doesn't go through
`computeTifBoundsHistory`, as the unit tests themselves do) `.slice()` throws a
`TypeError` before this line's guard can run; for a malformed but string-typed
value (e.g. `"aa:bb"`) it silently returns `NaN`, which also does not satisfy
`=== null` and is not caught — `NaN` then propagates into `widthSum`/comparisons,
silently corrupting the aggregate the same way CR-01 does. The guard is
effectively dead code within the currently-documented call path (where
`computeTifBoundsHistory` guarantees string `algMin`/`algMax` whenever `bounds`
is non-null) but is misleading as written — it implies a level of defensive
robustness against malformed input that doesn't exist.
**Fix:** Guard before calling `timeToMinutes`, and check for `NaN` after:
```js
if (typeof bounds.algMin !== 'string' || typeof bounds.algMax !== 'string') continue;
const algMinMin = timeToMinutes(bounds.algMin);
const algMaxMin = timeToMinutes(bounds.algMax);
if (Number.isNaN(algMinMin) || Number.isNaN(algMaxMin)) continue;
```

## Info

### IN-01: Dead nap-type exclusion check in `computeAccuracy`

**File:** `js/lib/accuracy.js:246-248`
**Issue:**
```js
if (ACCURACY_CONFIG.NAP_TYPES.has(type)) {
  if (actual.napStart === null && actual.napEnd === null) continue;
}
```
By this point `actualEvent = actual[type]` has already been required non-null by
the preceding `if (!actualEvent) continue;` (line 241). For `type === 'napStart'`,
`actual.napStart` **is** `actualEvent`, so `actual.napStart === null` is always
`false` here — the `&&` short-circuits and the `continue` can never fire (same
reasoning for `napEnd`). The comment ("NAP DAY COUNTING (D7-15)... Days with both
napStart and napEnd null are 'no-nap days' — excluded") describes logic this block
doesn't actually perform; the real exclusion already happens one line above via
the generic `!actualEvent` guard. Not a functional bug (tests pass either way),
but worth removing or reworking so the code doesn't misrepresent what it does to
future readers.
**Fix:** Remove the block, or replace it with a comment clarifying that the
generic `!actualEvent` guard above already handles this case for both nap types.

### IN-02: Inconsistent null-check style between `accuracy.js` and `accuracy-tif.js`'s "mirrored" nap-day classification

**File:** `js/lib/accuracy-tif.js:233`
**Issue:** `accuracy.js:233` uses strict `actual.napStart !== null` for the D-03
nap-day classification; `accuracy-tif.js:233` uses loose `actualDay.napStart != null`
for the documented-as-mirroring D-05 classification. Functionally identical given
the current data model (day-bucket.js always sets `napStart` to `null` or an
event object, never `undefined`), but the code comments in both files explicitly
claim these two implementations mirror each other exactly — the differing
operator is a minor inconsistency that could confuse future maintainers doing a
side-by-side diff.
**Fix:** Use `!== null` in both files for true parity.

### IN-03: `pct()` helper redeclared inside the per-type loop

**File:** `js/lib/accuracy-tif.js:249-251`
**Issue:**
```js
for (const type of ACCURACY_TIF_CONFIG.EVENT_TYPES) {
  const c = counters[type];
  const t = c.total;
  function pct(count) {
    return t === 0 ? 0 : Math.round(count / t * 100);
  }
  ...
}
```
`pct` is a function declaration created fresh on every loop iteration purely to
close over `t`. Harmless (no bug — `t` is a fresh `const` per iteration so no
stale-closure issue), but it's a code-smell that's simple to hoist out.
**Fix:**
```js
function pct(count, total) {
  return total === 0 ? 0 : Math.round(count / total * 100);
}
// ... result[type] = { windowHit: { count: c.windowHitCount, pct: pct(c.windowHitCount, t) }, ... };
```

---

_Reviewed: 2026-09-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
