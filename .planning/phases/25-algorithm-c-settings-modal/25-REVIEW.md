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
  info: 3
  total: 6
status: issues_found
---

# Phase 25: Code Review Report (Re-Review after Plan 25-08 gap closure)

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This is a re-review after Plan 25-08 landed a self-unwrap + align-to-reference fix
for `stabilityCheck()`'s "independently-wrapped models with min > max" defect
(prior CR-01). I hand-traced all 5 new `stabilityCheck` circular-interval unit
tests against the implementation line-by-line (selfUnwrapInterval →
alignNearReference → intersection/union → re-wrap) and every one of them
computes correctly — **the narrow defect the tests target (an individual
interval's own `min > max` inversion) is genuinely fixed.**

However, verifying the *class* of bug ("central value ends up outside its own
reported band" — the symptom the original CR-01 finding named) rather than
just the specific repro the tests encode, I found the fix is **incomplete**:
the same symptom is still reproducible today via a different, untested code
path — `trimmedBand()`'s median computation and `combineModels()`'s
raw-central averaging are not circular-aware, and midnight-straddling
production data (which is common for a bedtime-tracking app — many families'
bedtimes vary across the midnight boundary night to night) still produces a
central prediction far outside the reported min/max band. See CR-01 below —
this is a Critical finding and directly answers the re-review's primary
question: **no, the circular-interval defect class is not fully resolved.**

The three deferred, previously-known findings (WR-02, IN-01, IN-02) are all
still present exactly as before — re-flagged below per the task's request,
not newly discovered.

## Critical Issues

### CR-01: stabilityCheck's circular-interval fix does not cover trimmedBand/combineModels — central-outside-band symptom still reproducible with realistic data

**File:** `js/lib/forecast-blend.js:70-88` (`trimmedBand`), `:241-252` (`combineModels`), `:440-442` (wake's inline blend)

**Issue:**
Plan 25-08 correctly hardened `stabilityCheck()` against interval-level
`min > max` inversion (self-unwrap + align-to-reference; verified by hand
against all 5 new unit tests in `tests/unit/forecast-blend.test.js:152-198`,
all of which compute exactly as asserted).

But `stabilityCheck()` is only ever handed already-summarized bands
(`{min, max, median}` from `trimmedBand`) and a `rawCentral` that
`combineModels()` (and the wake blend's inline equivalent) computes as a
**plain arithmetic mean of the models' medians** — both of these upstream
computations treat clock-time-of-day values as linear numbers on `[0, 1440)`,
not circular. Whenever the real-world distribution of times legitimately
straddles the midnight boundary (very common for `bedtime`, and possible for
`wake`/`napStart` too), the median/mean lands on the *opposite* side of the
clock from the true center, and — critically — `stabilityCheck`'s
`alignNearReference()` step cannot repair an already-wrong scalar; it can
only shift a value by whole multiples of 1440 to the nearest matching copy of
*itself*, which does nothing to fix a mean that was computed incorrectly in
the first place.

Reproduced end-to-end via the actual public `blendForecast()` API (not just a
synthetic `stabilityCheck` call) with a plausible fixture — 20 days, wake
fixed at 06:00, bedtime alternating `23:50` / `00:10` (a child whose bedtime
hovers right around midnight, varying by ~20 minutes night to night):

```js
import { blendForecast } from './js/lib/forecast-blend.js';
const days = Array.from({ length: 20 }, (_, i) =>
  ({ wake: '06:00', bedtime: i % 2 === 0 ? '23:50' : '00:10', napStart: null, napEnd: null, rejected: false })
);
blendForecast(days, { minDays: 7, blendWindowDays: 90, blendTrimPct: 25, blendShrinkage: 0.3 }).bedtime;
// => { central: '08:25', min: '00:10', max: '00:10' }
```

`central: '08:25'` (8:25 AM) is nowhere near the reported `[00:10, 00:10]`
band — this is exactly the "prediction outside its own band" symptom CR-01
was opened to close, still fully reproducible after the 25-08 fix, via a
different root cause than the one 25-08 patched.

Root cause chain, isolated:
1. `trimmedBand()` sorts raw clock-minutes linearly (`forecast-blend.js:462-467`
   builds `bedtimeTimes`, sorted `(a,b) => a-b`). A 50/50 split between `23:50`
   (1430) and `00:10` (10) sorts as `[10,10,10,10,10,1430,1430,1430,1430,1430]`;
   the "median" of that array is `(10+1430)/2 = 720` (noon) — verified
   directly by calling the exported `trimmedBand([...], 25, 0)` with this
   input, which returns `{ min: 10, max: 1430, median: 720 }`.
2. Even when two *different* models are combined, `combineModels()`
   (`forecast-blend.js:249`) and wake's inline blend (`:440`) average the
   models' medians with plain `+`/`2` — the same linear-not-circular error,
   one level up.
3. `stabilityCheck()`'s union branch (D-02, no-overlap case) explicitly
   leaves `central` unchanged (`forecast-blend.js:198-202`) — by design, for
   the narrow case it was fixed for. It has no mechanism to correct a
   `central` that was already wrong before it got there.

This affects `wake` (a1Times), `bedtime` Model 1 and the no-nap-day Model 3
substitute (`bedtimeTimes`/`noNapBedtimeTimes`), and `napStart` Model 2
(`napStartTimes`) — every model built directly from a raw historic
clock-time-of-day array — plus the cross-model averaging step for all four
predicted events. Duration-based series (`buildNapGapSeries`,
`buildNapDurationSeries`, `sleepDuration`, `dayLength`, `activityAfterNap` in
`js/lib/metrics.js`) are unaffected — they already normalize to
always-positive elapsed minutes before being fed into `trimmedBand`, so this
is specifically a time-of-day problem, not a duration problem.

None of the 5 new `stabilityCheck` unit tests exercise this path — they all
pass pre-fabricated `{min, max}` interval objects and a `central` value chosen
to already be close to the true circular center, so the upstream
non-circular-mean bug in `trimmedBand`/`combineModels` was never on the
critical path of those tests.

**Fix:** Make time-of-day aggregation circular-aware at its source, not just
at the `stabilityCheck` band-comparison layer:
- Add a circular variant of the median/trim step for clock-time-of-day
  inputs — e.g. reuse the same self-unwrap/align-to-reference technique
  `stabilityCheck` now uses, but applied to the *raw sample array* before
  sorting/trimming (pick a reference point, such as the first raw sample or
  a rolling circular mean, shift every sample to its nearest day-aligned
  copy of that reference, sort/trim/median on the shifted values, then
  `wrapToDay()` the result) — for `a1Times`, `bedtimeTimes`,
  `noNapBedtimeTimes`, and `napStartTimes`.
- In `combineModels()` and the wake blend's inline equivalent, compute
  `rawCentral` as a circular mean (align every model's median onto a shared
  reference before averaging — the same primitive `stabilityCheck` already
  has via `alignNearReference`) instead of a plain arithmetic mean.
- Add a regression test mirroring the reproduction above (mixed
  `23:50`/`00:10` bedtime fixture) asserting `centralWithinBand(...)` is
  `true` — the existing WR-01 tests (`buildLateWakeNapStartFixture`,
  `buildLateWakeNapEndFixture`) only exercise a *single* model wrapping past
  midnight, never a raw sample array whose real-world distribution straddles
  the boundary from both sides.

## Warnings

### WR-01: `alignNearReference`'s tie-break behavior contradicts its own docstring

**File:** `js/lib/forecast-blend.js:114-131`

**Issue:** The docstring states "Ties keep `value` itself (zero shift)"
(line 120). The actual implementation is:
```js
const candidates = [value - DAY, value, value + DAY];
return candidates.reduce((best, c) =>
  Math.abs(c - reference) < Math.abs(best - reference) ? c : best
);
```
`Array.prototype.reduce` without an initial value seeds `best` with
`candidates[0]` (`value - DAY`), and the comparison is strict `<`. When
`value` and `value - DAY` are exactly equidistant from `reference` (i.e. the
value is exactly half a day, 720 minutes, from the reference — a real
possibility for two models 12 hours apart, e.g. a nap-end model vs. a
bedtime model), the tie is won by `value - DAY`, not `value`, because `best`
never gets overwritten on a `<` tie. This is a real discrepancy between
documented and actual behavior; the practical impact is limited (the 720-
minute-tie case is inherently ambiguous — no shift is objectively "more
correct" than the other), but it should not ship with a docstring that
misdescribes the code's own tie-breaking rule.

**Fix:** Either fix the docstring to describe the actual precedence (ties
favor `value - DAY` over `value`, and `value` over `value + DAY`), or fix the
reduce to explicitly prefer `value` on ties:
```js
return candidates.reduce((best, c) => {
  const dc = Math.abs(c - reference), db = Math.abs(best - reference);
  return dc < db || (dc === db && c === value) ? c : best;
});
```

### WR-02 (deferred, still present): No E2E round-trip test for the 3 Algorithm C tuning inputs

**File:** `tests/e2e/settings-modal.spec.js`, `tests/e2e/algorithm-c.spec.js`

**Issue:** Neither spec file fills, saves, reloads, and re-asserts
`blendWindowDays`, `blendTrimPct`, or `blendShrinkage` the way
`settings-modal.spec.js:118-148` does for the Classic/Time&Day fields.
`algorithm-c.spec.js`'s Test 2 explicitly *omits* these three fields from its
seed on purpose (to test the migration-default-injection path), which is a
different and narrower guarantee than a Save→reload round-trip of
user-entered values. Confirmed still absent in this re-review, unchanged from
the prior 25-REVIEW.md finding — flagged per the task's explicit request to
re-flag known-deferred items, not as a new discovery.

**Fix:** Add a test filling all three `#blendOptions` inputs with
non-default values, saving, reloading, reopening Settings, and asserting the
three inputs retain those values (mirroring the existing CFG-02..07 round-trip
test's shape).

## Info

### IN-01 (deferred, still present): `console.log` left in the CSV import handler

**File:** `js/ui/settings-modal.js:277`

**Issue:** `console.log(`[Nightwatch] CSV parsed: ${events.length} events, ${skipped.length} skipped`);`
is a debug-artifact log statement left in production code, unchanged from the
prior review. (Line 275's `console.warn` for `skipped.length > 0` is a
legitimate, intentional warning and is not flagged.)

**Fix:** Remove the `console.log` line, or gate it behind a debug flag if it
is intentionally kept for field-support diagnostics.

### IN-02 (deferred, still present): Stale `noNapBedtimeOffsetMinutes` literal in two test fixtures

**File:** `tests/unit/settings-validate.test.js:425`, `tests/unit/settings-validate.test.js:496`

**Issue:** Both `validFields` fixture objects still include
`noNapBedtimeOffsetMinutes: 30`, a field removed from `RULES`/`DEFAULT_SETTINGS`
per D-10 (Phase 19). Since `checkField` only iterates `Object.entries(RULES)`,
this extra key is silently ignored rather than causing a test failure — it is
harmless dead weight but should be cleaned up, unchanged from the prior review.

**Fix:** Remove `noNapBedtimeOffsetMinutes: 30` from both `validFields`
literals (lines 425 and 496).

### IN-03: `blendShrinkage`/other numeric settings-modal fields coerce a blank input to `0` rather than falling back to the stated default

**File:** `js/ui/settings-modal.js:198-208`

**Issue:** `Number(data.get('blendShrinkage') ?? 0.3)` (and the equivalent
lines for `trimPct`, `precisionTarget`, `tifRollingDays`, `blendWindowDays`,
`blendTrimPct`, `eveningHour`, `targetSleepMinutes`) only falls back to the
literal default when `FormData.get()` returns `null`/`undefined`. A blank
(cleared) `<input>` returns `""` from `FormData.get()`, and `Number("")` is
`0`, not the intended default — for `blendShrinkage` this happens to still be
in-range (`[0,1]`) and validates silently as `0` instead of showing an error
or falling back to `0.3`. This is a pre-existing pattern shared by every
other numeric field in this form (not introduced by Phase 25), so it is
informational rather than a regression, but Algorithm C's three new fields
inherit it.

**Fix:** Out of scope for a targeted fix within Phase 25 (systemic, spans all
numeric fields); note for a future settings-modal hardening pass, e.g.
`Number(data.get(field) === '' ? defaultVal : data.get(field) ?? defaultVal)`.

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
