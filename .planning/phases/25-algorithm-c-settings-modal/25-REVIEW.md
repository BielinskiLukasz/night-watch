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
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 25: Code Review Report (Full-phase re-review, post Plan 25-09)

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This review covers the phase's full diff across all 9 plans (25-01 through
25-09), with a specific mandate to verify whether CR-01 (circular-median /
circular-mean root cause: raw clock-time-of-day samples and cross-model
medians being averaged linearly instead of circularly, producing a central
prediction outside its own reported band) is genuinely closed by Plan 25-09's
`circularTrimmedBand()` / `circularMean()`, rather than assuming the plan
summary's claim at face value.

**CR-01 verification: confirmed closed.** I re-ran the exact end-to-end
reproduction case from the prior `25-REVIEW.md` (20 days, wake fixed `06:00`,
bedtime alternating `23:50`/`00:10`) directly against the current
`blendForecast()`:

```
bedtime: {"central":"23:50","min":"23:50","max":"00:10"}   // was {"central":"08:25", min:"00:10", max:"00:10"}
wake:    {"central":"06:00","min":"06:00","max":"06:00"}
```

The central prediction (`23:50`) now lies inside its own reported band, where
it previously landed at `08:25` — 8+ hours outside `[00:10, 00:10]`. I also
traced `circularTrimmedBand()` and `circularMean()` by hand against
`tests/unit/forecast-blend.test.js`'s new CR-01 fixtures (midnight-wake,
midnight-napStart, midnight-bedtime, and the 3-model `isNoNapDay=true` case)
and confirmed every raw clock-time-of-day sample array in
`forecast-blend.js` (`a1Times`, `bedtimeTimes`, `noNapBedtimeTimes`,
`napStartTimes`) now routes through `circularTrimmedBand()` rather than the
plain `trimmedBand()`, and every 2+-model cross-model central (wake's inline
blend, `combineModels()` for napStart/napEnd/bedtime) now routes through
`circularMean()` rather than a plain arithmetic average. Duration-based
series (nap gap, nap duration, sleep duration, day length, activity-after-nap)
correctly continue to use the plain, non-circular `trimmedBand()` since they
are elapsed-minutes values, not clock-time-of-day values, and were never part
of the CR-01 defect class. All 255 unit tests pass (`node --test`), and the
schema/settings/service-worker plumbing for the three new `blendWindowDays`/
`blendTrimPct`/`blendShrinkage` settings (default injection, v1→v2 and v2
forward-compat migration, RULES validation bounds, three-way UI toggle,
precache list) is internally consistent end to end — no missing field, no
orphaned reference, no mismatched default between `db-shape.js`,
`settings-validate.js`, and `settings-modal.js`.

However, three issues from the prior `25-REVIEW.md` remain genuinely open
(re-verified against the current code, not assumed carried-over), and one new
issue was found. None are data-loss or security-critical; all are re-flagged
or newly flagged as Warnings/Info below.

## Warnings

### WR-01 (carried forward, still open): `alignNearReference`'s tie-break behavior contradicts its own docstring

**File:** `js/lib/forecast-blend.js:133-138`

**Issue:** The docstring (lines 127-128) states "Ties keep `value` itself
(zero shift)." The implementation is:
```js
function alignNearReference(value, reference) {
  const candidates = [value - DAY, value, value + DAY];
  return candidates.reduce((best, c) =>
    Math.abs(c - reference) < Math.abs(best - reference) ? c : best
  );
}
```
`Array.prototype.reduce` without an initial value seeds `best` with
`candidates[0]` (`value - DAY`), and the comparison is strict `<`. When
`value` and `value - DAY` are exactly equidistant from `reference` (i.e.
`value` is exactly 720 minutes / 12 hours from `reference` — plausible for
two independently-computed models, e.g. a nap-end model vs. a bedtime model),
the tie is won by `value - DAY`, not `value`, because `best` is never
overwritten on a `<` tie. Confirmed unchanged since Plan 25-08 introduced this
function — Plan 25-09 reused it verbatim for `circularTrimmedBand()` and
`circularMean()` without touching the tie-break. Practical impact is limited
(the 720-minute-tie case is inherently ambiguous — no shift is objectively
"more correct"), but the code should not ship with a docstring that
misdescribes its own behavior.

**Fix:** Either correct the docstring to describe the actual precedence
(ties favor `value - DAY` over `value`, and `value` over `value + DAY`), or
fix the reduce to explicitly prefer `value` on ties:
```js
return candidates.reduce((best, c) => {
  const dc = Math.abs(c - reference), db = Math.abs(best - reference);
  return dc < db || (dc === db && c === value) ? c : best;
});
```

### WR-02 (new): Algorithm C's cold-start return drops `minDaysRemaining`, so the Today screen shows "Log 0 more days" instead of the real count

**File:** `js/lib/forecast-blend.js:352-355`; also present (pre-existing,
shared root cause) in `js/lib/forecast-tif.js:490-493`

**Issue:**
```js
const { isColdStart } = detectColdStart(dayRecords, settings.minDays);
if (isColdStart) {
  return { isColdStart: true, wake: null, bedtime: null, napStart: null, napEnd: null };
}
```
`detectColdStart()` (`js/lib/forecast.js:339-348`) computes and returns
`minDaysRemaining: minDays - validDayCount`, but `blendForecast()` destructures
only `isColdStart` and discards it — a deliberate design choice per the
inline comment ("Mirrors tifForecast's exact shape ... not forecast()'s
validDayCount/minDaysRemaining fields"). `js/ui/today-screen.js:610` then
calls `renderColdStartMessage(predictions.minDaysRemaining ?? 0)` for every
algorithm uniformly, so when a user has `forecastAlgorithm: 'blend'` (or
`'tif'`) selected and is still cold-started, the UI renders "Log 0 more days
to see predictions." instead of the actual number of days still needed. This
is not a new defect Plan 25 introduced from scratch — `forecast-tif.js` has
had the identical gap since Phase 10 — but Plan 25-01 explicitly copied the
same truncated shape into `forecast-blend.js`, so Algorithm C's brand-new
cold-start UX inherits an already-known-wrong user-facing message on day one.

**Fix:** Forward `minDaysRemaining` in both cold-start returns:
```js
const { isColdStart, minDaysRemaining } = detectColdStart(dayRecords, settings.minDays);
if (isColdStart) {
  return { isColdStart: true, minDaysRemaining, wake: null, bedtime: null, napStart: null, napEnd: null };
}
```

### WR-03 (carried forward, still open): No E2E round-trip test for the 3 Algorithm C tuning inputs

**File:** `tests/e2e/settings-modal.spec.js`, `tests/e2e/algorithm-c.spec.js`

**Issue:** Neither spec file fills, saves, reloads, and re-asserts
`blendWindowDays`, `blendTrimPct`, or `blendShrinkage` the way
`settings-modal.spec.js:118-148` does for the Classic/Time&Day fields.
`algorithm-c.spec.js`'s Test 2 deliberately *omits* these three fields from
its seed (to test the migration-default-injection path), which is a
different, narrower guarantee than a Save→reload round-trip of user-entered
values. Confirmed still absent after re-reading both spec files in full.

**Fix:** Add a test filling all three `#blendOptions` inputs with
non-default values, saving, reloading, reopening Settings, and asserting the
three inputs retain those values (mirroring the existing CFG-02..07
round-trip test's shape at `settings-modal.spec.js:118-148`).

## Info

### IN-01 (carried forward, still open): `console.log` left in the CSV import handler

**File:** `js/ui/settings-modal.js:277`

**Issue:** `console.log(`[Nightwatch] CSV parsed: ${events.length} events, ${skipped.length} skipped`);`
is a debug-artifact log statement in production code. (The adjacent
`console.warn` at line 275 for `skipped.length > 0` is a legitimate,
intentional warning and is not flagged.)

**Fix:** Remove the `console.log` line, or gate it behind a debug flag if
intentionally kept for field-support diagnostics.

### IN-02 (carried forward, still open): Stale `noNapBedtimeOffsetMinutes` literal in two test fixtures

**File:** `tests/unit/settings-validate.test.js:425`, `tests/unit/settings-validate.test.js:496`

**Issue:** Both `validFields` fixture objects still include
`noNapBedtimeOffsetMinutes: 30`, a field removed from `RULES`/`DEFAULT_SETTINGS`
per D-10 (Phase 19, re-confirmed removed in Phase 25 Plan 25-06). Since
`checkField` only iterates `Object.entries(RULES)`, this extra key is
silently ignored rather than causing a test failure — harmless dead weight,
but should be cleaned up.

**Fix:** Remove `noNapBedtimeOffsetMinutes: 30` from both `validFields`
literals (lines 425 and 496).

### IN-03 (carried forward, still open): Blank numeric settings-modal inputs coerce to `0` rather than falling back to the stated default

**File:** `js/ui/settings-modal.js:198-208`

**Issue:** `Number(data.get('blendShrinkage') ?? 0.3)` (and the equivalent
lines for `trimPct`, `precisionTarget`, `tifRollingDays`, `blendWindowDays`,
`blendTrimPct`, `eveningHour`, `targetSleepMinutes`) only falls back to the
literal default when `FormData.get()` returns `null`/`undefined`. A blank
(cleared) `<input>` returns `""` from `FormData.get()`, and `Number("")` is
`0`, not the intended default — for `blendShrinkage` this happens to still be
in-range (`[0,1]`) and validates silently as `0` instead of surfacing an
error or falling back to `0.3`. Pre-existing pattern shared by every numeric
field in this form (not introduced by Phase 25), but Algorithm C's three new
fields inherit it.

**Fix:** Out of scope for a targeted fix within Phase 25 (systemic, spans all
numeric fields); consider for a future settings-modal hardening pass, e.g.
`Number(data.get(field) === '' ? defaultVal : (data.get(field) ?? defaultVal))`.

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
