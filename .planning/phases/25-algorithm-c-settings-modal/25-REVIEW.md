---
phase: 25-algorithm-c-settings-modal
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - index.html
  - js/lib/db-shape.js
  - js/lib/forecast-blend.js
  - js/lib/settings-validate.js
  - js/ui/settings-modal.js
  - js/ui/today-screen.js
  - sw.js
  - tests/e2e/algorithm-c.spec.js
  - tests/e2e/settings-modal.spec.js
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

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This is a fresh full review of the current file state, not an assumption-carryover from the
prior 25-REVIEW.md. Both previously-reported gap-closure items were independently re-verified
and confirmed fixed:

- **CR-01 (orphan `noNapBedtimeOffsetMinutes` field)** — confirmed removed from
  `index.html`, `js/ui/settings-modal.js`'s Save-path `raw` object, `js/lib/db-shape.js`'s
  `DEFAULT_SETTINGS`/migration forward-compat block, and `js/lib/settings-validate.js`'s
  `RULES`. `tests/e2e/settings-modal.spec.js`'s dedicated regression test
  (`CR-01 gap-closure: ...`) passes, and only stale references remain in
  `.planning/` docs and two unrelated test-fixture literal objects (see IN-02).
- **WR-01 (missing `wrapToDay()` for napStart/napEnd)** — confirmed present:
  `js/lib/forecast-blend.js` now wraps `napStartModel1`, `napEndModel1`, and
  `napEndModel2` into `[0, 1440)` via the exported `wrapToDay()`, with dedicated unit
  tests in `tests/unit/forecast-blend.test.js`.

All 238 unit tests (`node --test tests/unit/forecast-blend.test.js tests/unit/db-shape.test.js
tests/unit/settings-validate.test.js tests/unit/sw-precache.test.js`) pass.

However, this fresh review found a **new, unreported correctness defect** in the same area the
WR-01 fix touched: `wrapToDay()` is applied independently to each of a band's `min`/`median`/`max`
fields, which does not preserve the `min <= max` ordering whenever the raw (pre-wrap) band
straddles the `1440`-minute boundary asymmetrically. When such a band is then combined with a
sibling model via `stabilityCheck()`/`combineModels()` (used for wake's A1/A2 blend, bedtime's
3-model blend, and now napStart's/napEnd's 2-model blends), the numeric `Math.min`/`Math.max`
comparisons across models operating in different "wrap phases" can produce a `central` value that
falls outside the reported `[min, max]` band — a directly user-visible logical inconsistency. See
CR-01 (this review) below for a concrete, reproducible repro using the module's own exported
functions.

## Critical Issues

### CR-01: `stabilityCheck`/`combineModels` can report a `central` value outside the returned `[min, max]` band when a model's independently-wrapped min/max order inverts

**File:** `js/lib/forecast-blend.js:119-136` (`stabilityCheck`), `173-184` (`combineModels`), and every call site that builds a wrapped model via independent `wrapToDay(anchor + band.min)` / `wrapToDay(anchor + band.max)` / `wrapToDay(anchor + band.median)` — this includes `a2` (wake, lines 354-359), `bedtimeModel2` (lines 409-414), `bedtimeModel3`'s AA-band branch (lines 431-436), `napStartModel1` (lines 246-251), `napEndModel1` (lines 289-294), and `napEndModel2` (lines 304-309).

**Issue:**
`wrapToDay()` (line 150-152) wraps a single raw-minutes value into `[0, 1440)`. Every wrapped
model in this file builds its `min`, `median`, and `max` by wrapping each of `anchor + band.min`,
`anchor + band.median`, `anchor + band.max` **independently**. Because `band.min <= band.median <=
band.max` pre-wrap, this is safe for a single model in isolation (modular arithmetic preserves
cyclic order for a strictly-increasing sequence spanning less than 1440 minutes) — a lone wrapped
model always self-consistently satisfies `min <= central <= max` on the wrap-aware ("crosses
midnight") reading, which is exactly what the WR-01 regression tests
(`centralWithinBand()` in `tests/unit/forecast-blend.test.js`) check.

The bug appears when **two or more** such models are combined via `combineModels()` →
`stabilityCheck()`. `stabilityCheck()` computes the overlap/union using plain numeric
`Math.max(...mins)` / `Math.min(...maxs)` (lines 120-121, 131-133) — this assumes every input
interval is a conventional `min <= max` interval living in the *same* [0, 1440) reference frame.
But when the raw (pre-wrap) band of one model straddles the 1440 boundary asymmetrically (raw
`min < 1440 <= raw max`), independently wrapping `min` and `max` inverts their order for *that
model* relative to a sibling model that never crossed the boundary — the two models are no longer
numerically comparable even though both are nominally "minutes in a day". `stabilityCheck()` has
no circular-interval logic to detect or correct this; it silently produces a wrong band, and
`combineModels()`'s raw-average-of-medians `central` (line 181) is not re-validated against the
final min/max it returns.

**Concrete reproduction** (using only this module's own exported functions):
```js
import { stabilityCheck } from './js/lib/forecast-blend.js';

// modelA: an anchor+band sum whose raw range straddled 1440 asymmetrically,
// then had min/median/max wrapped independently (exactly what napEndModel1,
// napStartModel1, wake's a2, bedtimeModel2/3 all do).
const modelA = { min: 1400, max: 60, median: 10 };   // e.g. raw [1400, 1500] wrapped per-field
// modelB: a normal, never-wrapped historic band.
const modelB = { min: 100, max: 160, median: 130 };

const rawCentral = (modelA.median + modelB.median) / 2; // 70
const result = stabilityCheck([modelA, modelB], rawCentral, 0.3);
// result = { min: 100, max: 160, central: 70 }
// central (70) < min (100) — central falls OUTSIDE the reported band.
```
After `minutesToTime()` formatting this renders to the user as, e.g., `min: '01:40', max: '02:40',
central: '01:10'` — a prediction card whose "best guess" time is displayed *before* the start of
its own uncertainty band. Beyond the display glitch, `modelA`'s actual signal is silently dropped
from the union computation (its huge `min: 1400` and small `max: 60` don't win either the
`Math.min` or `Math.max` reduction), so the reported band ends up representing only `modelB`,
while `central` still reflects an average that includes the (effectively discarded) `modelA`.

This is reachable from the public `blendForecast()` API whenever real day-record data produces an
anchor+band sum that straddles midnight asymmetrically for one model while a sibling model for the
same event does not — plausible for late bedtimes/naps that sometimes tip past midnight and
sometimes don't (exactly the kind of data the WR-01 fixtures were built to simulate, though the
specific WR-01 test fixtures happen not to trigger the order-inversion case above).

**Fix:** `stabilityCheck()` needs genuine circular/modular interval comparison (not a linear
`Math.min`/`Math.max` reduction) whenever it may receive a model whose own `min > max` (i.e., a
band that itself wraps past midnight). One approach: detect `model.min > model.max` per input and
normalize by re-expressing each model as an interval in a shared, un-wrapped frame (e.g., shift
the whole intersection/union computation onto a rotated number line anchored at one model's `min`)
before comparing, then wrap the final result back into `[0, 1440)`. At minimum, add an assertion/
guard so that a model with inverted `min > max` is never passed to the current linear
`stabilityCheck()` un-normalized, and add a unit test asserting `min(band) <= central(band) <=
max(band)` (numerically, not just via the wrap-tolerant `centralWithinBand()` helper) for the
2-model-combine paths (wake A1+A2, bedtime's 3 models, napStart's/napEnd's 2 models) using a
fixture engineered to straddle midnight asymmetrically for exactly one of the combined models
(the existing WR-01 fixtures avoid this case by chance, not by design — see WR-01 below).

## Warnings

### WR-01: WR-01 gap-closure tests validate a weaker "wrap-aware union" invariant than the one `combineModels` actually needs

**File:** `tests/unit/forecast-blend.test.js:36-46, 313-359`

**Issue:** The `centralWithinBand()` helper (lines 41-46) treats `min > max` as "the band itself
wraps past midnight" and accepts `central >= min || central <= max` in that case. This is the
correct reading for a *single, self-consistent* wrapped model, but it also happens to mask the
CR-01 defect above: in that repro, `stabilityCheck`'s reported `{min:100, max:160}` does NOT have
`min > max`, so `centralWithinBand` would report `central=70` as failing (`70 not in [100,160]`),
which is good — but neither of the two “late wake crossing midnight” fixtures in this file
(`buildLateWakeNapStartFixture`, `buildLateWakeNapEndFixture`) happens to drive the two combined
models into the asymmetric-straddle configuration that produces this failure, so the suite is
green today without the underlying combine-time invariant being actually exercised.

**Fix:** Add a fixture (or use the CR-01 repro's numeric shape) that forces exactly one of the two
combined models per event (napStart, napEnd, wake, bedtime) to straddle 1440 asymmetrically while
the sibling model does not, and assert `result.<event>.min <= result.<event>.central <=
result.<event>.max` as plain numeric minutes (via `timeToMinutes`), not through the wrap-tolerant
helper, to catch regressions in the actual invariant `combineModels()`'s callers rely on.

### WR-02: No E2E coverage for the three new Algorithm C tuning inputs surviving a Save → reload round trip

**File:** `tests/e2e/algorithm-c.spec.js`, `tests/e2e/settings-modal.spec.js`

**Issue:** `tests/e2e/settings-modal.spec.js` has a dedicated round-trip test for the Classic/Time
fields (`CFG-02..04, CFG-06..07: forecast-tuning + time/day fields round-trip Save → reload`,
lines 118-148) that fills each `<input name="...">`, saves, reloads, and re-reads the DOM value.
No equivalent test exists for `blendWindowDays`, `blendTrimPct`, or `blendShrinkage` — the only
E2E reference to these three fields is a comment in `algorithm-c.spec.js` (line 144) noting they
are *deliberately omitted* from the seed data to test the migration/default-injection path, which
is a different concern. A regression that mis-wires one of these three `<input name="...">`
elements (e.g., a typo in the `name` attribute, or a stale element the JS reads via
`document.getElementById` instead of `form.elements.namedItem`) would not be caught by any
existing E2E test — only `validateSettings` unit tests exercise the pure-function bounds, and
those never touch the DOM/FormData wiring in `js/ui/settings-modal.js`.

**Fix:** Add a Save → reload round-trip E2E test for `blendWindowDays`/`blendTrimPct`/
`blendShrinkage` mirroring the existing CFG-02..07 test's shape.

## Info

### IN-01: Leftover `console.log` diagnostic in the CSV import handler

**File:** `js/ui/settings-modal.js:277`

**Issue:** `console.log(\`[Nightwatch] CSV parsed: ${events.length} events, ${skipped.length} skipped\`);`
is a production-path debug artifact (distinct from the `console.warn` a few lines above it, which
surfaces something actionable to a developer). It runs on every successful CSV import for every
user, which is unnecessary console noise in a shipped PWA.

**Fix:** Remove the `console.log` line, or gate it behind a debug flag if it is intentionally kept
for field-support diagnostics.

### IN-02: Stale `noNapBedtimeOffsetMinutes` literal left in two test fixtures after the CR-01 field removal

**File:** `tests/unit/settings-validate.test.js:425, 496`

**Issue:** The `validFields` object literals in the `stages (D6-01)` and `activeStageId (D6-02)`
describe blocks still include `noNapBedtimeOffsetMinutes: 30`, a field that was intentionally
removed from `DEFAULT_SETTINGS`/`RULES` (D-10, Phase 19; reaffirmed by this phase's CR-01
gap-closure). It is harmless today because `validateSettings` only iterates `Object.keys(RULES)`
and ignores unknown extra keys on the input object, but it is a stale reference that could
confuse a future reader into thinking the field is still expected somewhere.

**Fix:** Delete the `noNapBedtimeOffsetMinutes: 30` line from both `validFields` literals.

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
