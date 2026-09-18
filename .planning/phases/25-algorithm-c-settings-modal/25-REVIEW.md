---
phase: 25-algorithm-c-settings-modal
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - index.html
  - js/lib/db-shape.js
  - js/lib/forecast-blend.js
  - js/lib/settings-validate.js
  - js/ui/settings-modal.js
  - js/ui/today-screen.js
  - sw.js
  - tests/e2e/algorithm-c.spec.js
  - tests/unit/db-shape.test.js
  - tests/unit/forecast-blend.test.js
  - tests/unit/settings-validate.test.js
  - tests/unit/sw-precache.test.js
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-09-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 25 adds Algorithm C ("blend") — a new dual/multi-model forecasting algorithm
(`js/lib/forecast-blend.js`), its settings fields (`blendWindowDays`, `blendTrimPct`,
`blendShrinkage`), the three-way Settings modal selector, `db-shape.js` migration
support, and `sw.js` precache registration. The core invariants called out in the
review brief hold up:

- No circular import: `forecast-blend.js` imports from `forecast.js` and `metrics.js`
  only, and neither of those imports it back.
- `settings-validate.js` still imports `DEFAULT_SETTINGS` from `db-shape.js`, not
  `settings.js` — the cycle-avoidance pattern is intact.
- `sw.js`'s `PRECACHE_LIST` includes `./js/lib/forecast-blend.js`, and
  `tests/unit/sw-precache.test.js` has an explicit assertion pinning it.
- The `blendWindowDays`/`blendTrimPct`/`blendShrinkage` migration in `db-shape.js` is
  additive/idempotent (per-field `!('x' in blob.settings)` checks, no version bump),
  consistent with the documented Schema V2 contract.
- All new DOM writes in `settings-modal.js`/`today-screen.js` go through
  `.value`/`.checked`/`textContent`/`el()` — no `innerHTML` with dynamic data.

However, one **carried-over, previously-flagged BLOCKER from Phase 19's own review
(19-REVIEW.md CR-01) remains unresolved** in the exact files this phase touches, and
`forecast-blend.js` has a genuine internal inconsistency in how it handles values that
cross the day boundary. Both are detailed below.

## Critical Issues

### CR-01: `noNapBedtimeOffsetMinutes` orphan setting still live in the UI — silently discards user edits (regression carried from Phase 19)

**File:** `index.html:302-306`, `js/ui/settings-modal.js:117-118,207`

**Issue:** `js/lib/db-shape.js`'s `DEFAULT_SETTINGS` and `js/lib/settings-validate.js`'s
`RULES` both deliberately **do not** contain a `noNapBedtimeOffsetMinutes` key — this
field was removed by Phase 19 decision D-10 (see `tests/unit/db-shape.test.js:473-526`
and `tests/unit/settings-validate.test.js:36,50,66,73`, which explicitly assert the
key is absent from `DEFAULT_SETTINGS`, `RULES`, and every `normalized`/migrated
settings object). It is also not read anywhere in `js/lib/forecast.js`,
`forecast-tif.js`, or `forecast-blend.js` — grepping the whole `js/` tree for
`noNapBedtimeOffsetMinutes` returns exactly one match: `js/ui/settings-modal.js`.

Despite that, `index.html` still renders a live, editable "No-nap bedtime offset
(min)" number input (`name="noNapBedtimeOffsetMinutes"`), and `settings-modal.js`
still (a) populates it from `s.noNapBedtimeOffsetMinutes ?? 30` on every open, and
(b) reads it back into the `raw` object on Save
(`noNapBedtimeOffsetMinutes: Number(data.get('noNapBedtimeOffsetMinutes') ?? 30)`).
Because `validateSettings()` only ever copies fields that exist in `RULES` into
`normalized`, this key is silently dropped before `settings.update()` is called — the
user can type a new value, click Save, see no error, and the value is discarded
without a trace, every time.

This is not a new defect introduced by Phase 25, but it lives in two of the files
this phase modifies (`index.html` and `settings-modal.js` were both touched to add
the `blendOptions` fieldset and wiring in this same phase's commits), and it was
**already identified and classified as CR-01/Critical in `19-REVIEW.md`** with the
explicit fix instructions to delete the input and its read/populate lines. That fix
was never applied — the dead field is still present verbatim. Because this phase
touched both files without cleaning it up, and a code-review artifact already exists
directing removal, it should block this phase's sign-off rather than be deferred
again.

**Fix:**
```diff
--- a/index.html
@@ -299,12 +299,6 @@
         <label>
           Evening hour (0–23)
           <input type="number" id="eveningHour" name="eveningHour" min="0" max="23" step="1">
         </label>
-        <label>
-          No-nap bedtime offset (min)
-          <input type="number" id="noNapBedtimeOffsetMinutes" name="noNapBedtimeOffsetMinutes"
-                 min="0" max="120" step="5">
-        </label>
         <label>
           Sleep target (minutes)
```
```diff
--- a/js/ui/settings-modal.js
@@ -115,8 +115,6 @@
     const eveningHourEl = form.elements.namedItem('eveningHour');
     if (eveningHourEl) eveningHourEl.value = String(s.eveningHour ?? 18);
-    const noNapOffsetEl = form.elements.namedItem('noNapBedtimeOffsetMinutes');
-    if (noNapOffsetEl) noNapOffsetEl.value = String(s.noNapBedtimeOffsetMinutes ?? 30);
     const tifOptionsEl = document.getElementById('tifOptions');
@@ -206,7 +204,6 @@
         eveningHour:               Number(data.get('eveningHour') ?? 18),
-        noNapBedtimeOffsetMinutes: Number(data.get('noNapBedtimeOffsetMinutes') ?? 30),
         intenseDayOffsetMinutes:   settings.get().intenseDayOffsetMinutes ?? 30,
```

## Warnings

### WR-01: `forecast-blend.js` nap-start/nap-end wake-anchored models skip the day-wrap normalization applied everywhere else

**File:** `js/lib/forecast-blend.js:239-247,281-305`

**Issue:** Wake's A2 band (lines 349-355) and bedtime's Model 2 / Model 3 bands
(lines 400-411, 421-433) all explicitly call `wrapToDay(anchor + offset)` before
combining, with an inline comment explaining why: "Wrap into [0, 1440) so A2 shares
the same numeric reference frame as A1 before `stabilityCheck`'s min/max comparisons
and central averaging."

Nap-start's Model 1 (`napStartModel1`, lines 239-247) and nap-end's Model 1 and
Model 2 (`napEndModel1`/`napEndModel2`, lines 281-305) are built the same way —
`wakeAnchorMin + gapBand.{min,max,median}` and `napStartAnchorMin + durBand2.{...}`
respectively — but neither calls `wrapToDay()`. They are then combined via
`combineModels()`/`stabilityCheck()` directly against Model 2 bands
(`napStartModel2`, built from `timeToMinutes()` of stored `'HH:MM'` strings, which
are always in `[0, 1440)`).

If a day's logged wake time is late enough (or the historic gap/duration is large
enough) that `wakeAnchorMin + gapBand.max` (or the chained nap-end sum) exceeds 1440,
`stabilityCheck`'s `Math.max(...intervals.map(iv => iv.max))` /
`Math.min(...intervals.map(iv => iv.min))` comparisons mix an unwrapped
(>1440-capable) interval with a wrapped ([0,1440)) interval. This can produce a false
"no overlap" verdict (skipping the intended shrink-toward-intersection behavior) and,
after `minutesToTime()`'s trailing `% (24*60)`, a `min`/`max` pair that renders as a
band running backwards in wall-clock terms (e.g. `06:00–01:00`) instead of the
intended same-day span. Every other cross-midnight-capable band in this file wraps
before combining; these three do not.

**Fix:** Wrap the raw sums the same way the wake/bedtime models do:
```javascript
napStartModel1 = {
  min:    wrapToDay(wakeAnchorMin + gapBand.min),
  max:    wrapToDay(wakeAnchorMin + gapBand.max),
  median: wrapToDay(wakeAnchorMin + gapBand.median),
};
// ...and the same for napEndModel1 / napEndModel2's min/max/median.
```

### WR-02: Bedtime Model 3's "thin substitute" degradation comment doesn't match an enforced check

**File:** `js/lib/forecast-blend.js:413-420`

**Issue:** The comment above `bedtimeModel3`'s no-nap branch says: "When the
substitute itself is thin (**< minDays no-nap-day records**), `bedtimeModel3` stays
null." No such `minDays`-based count check exists in the code — `bedtimeModel3` is
only `null` when `trimmedBand(noNapBedtimeTimes, ...)` returns `null`, which only
happens when `noNapBedtimeTimes` is empty (zero no-nap days in the window). With as
few as **one** no-nap-day record, `trimmedBand` will happily return a single-point
band (`min === max === median`), which then feeds into `combineModels`/
`stabilityCheck` as if it were a real distribution. This doesn't crash and matches
the same "graceful degradation via null" pattern used elsewhere in the file, but the
comment overstates the actual robustness guarantee — a future maintainer relying on
the comment could wrongly assume single/low-sample substitute bands can't happen.

**Fix:** Either implement the described guard (e.g. `noNapBedtimeTimes.length <
settings.minDays ? null : trimmedBand(...)`) or correct the comment to describe the
actual behavior (null only on zero-sample, not on a `minDays` threshold).

## Info

### IN-01: Duplicate `trimmedBand` computation for the nap gap series

**File:** `js/lib/forecast-blend.js:240,283`

**Issue:** `gapBand` (nap-start Model 1, line 240) and `gapBand2` (nap-end Model 1,
line 283) both compute `trimmedBand([...napGaps].sort((a,b) => a-b), blendTrimPct,
rejectedInWindow)` — byte-identical inputs, just under two different local names. The
comment at line 275-277 already establishes the pattern of hoisting shared
computations (`durBand2`) to avoid duplication; this second identical calculation was
missed.

**Fix:** Compute once near `durBand2` and reuse:
```javascript
const gapBand = trimmedBand([...napGaps].sort((a, b) => a - b), blendTrimPct, rejectedInWindow);
// use `gapBand` for both napStartModel1 and napEndModel1
```

### IN-02: Settings-modal `_forecastAlgorithmChangeHandler` re-queries some elements but not others

**File:** `js/ui/settings-modal.js:153-168`

**Issue:** `tifOptionsEl` is captured once (as a closure variable from the outer
scope) and reused inside `_forecastAlgorithmChangeHandler`, while `classicOptionsEl`
and `blendOptionsEl` are freshly re-queried via `document.getElementById(...)` on
every invocation of the handler. This is harmless (the elements are static and never
replaced), but it's an inconsistent pattern within the same 12-line function that
makes the code slightly harder to follow than necessary.

**Fix:** Query all three once, alongside `tifOptionsEl`, before defining the handler,
for consistency.

---

_Reviewed: 2026-09-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
