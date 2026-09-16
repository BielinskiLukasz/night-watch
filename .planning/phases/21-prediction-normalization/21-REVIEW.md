---
phase: 21-prediction-normalization
reviewed: 2026-09-16T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - js/lib/forecast-utils.js
  - tests/unit/forecast-utils.test.js
  - js/lib/forecast.js
  - js/ui/today-screen.js
  - sw.js
  - tests/unit/forecast.test.js
  - tests/unit/sw-precache.test.js
  - tests/e2e/forecast.spec.js
  - tests/integration/forecast-flow.test.js
  - tests/integration/today-hero-later-today.test.js
  - style.css
  - tests/e2e/tif.spec.js
  - tests/e2e/next-reachable-event.spec.js
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-09-16
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 21 extracts `nextReachableEvent`/`selectNextEvent` into a new pure
module (`js/lib/forecast-utils.js`), decouples `napProbability()`'s
`napWindowClosed` flag from `score`, adds `predictions.bedtimeAfterWake`
(D-09) to `forecast()`, and reworks `today-screen.js`'s forecast section into
a dual-hero row plus a collapsible "Later today" section. The unit,
integration, and E2E test coverage for the new logic (5-path reachability
table, dual-hero rendering, auto-expand-on-open, bedtimeAfterWake
independence) is thorough and well-reasoned — most of the new branching is
exercised at multiple boundary values (P90 `>` vs `>=`, eveningHour
boundaries, thin-sub-window nulls).

However, the JS restructuring of `renderForecastSection()` — which replaced a
loop that appended 3-4 `.prediction-card` elements directly into
`#forecast-cards.forecast-grid` with a single `<details class="later-today-
section">` wrapper — was not accompanied by a matching CSS change. The
`.forecast-grid` container still declares a 2-column grid, so the single
`<details>` child (and everything nested inside it) now renders at half the
intended width on any viewport wider than the 480px breakpoint. This is not
caught by any test in scope, since the Playwright/node:test suites assert
DOM structure, classes, and attributes — never computed layout width. Three
additional maintainability warnings are noted below (duplicated
lookup/fallback tables between two files, duplicated "isMissed" computation
scattered across four call sites, and a pre-existing unnormalized-negative-
minutes edge case in `subWindowBedtime`).

## Critical Issues

### CR-01: `#forecast-cards` 2-column grid now wraps a single child, halving the "Later Today" section's width on non-mobile viewports

**File:** `js/ui/today-screen.js:754` (also `style.css:973-984`)

**Issue:**
Before this phase, `renderForecastSection()` appended 3-4 `.prediction-card`
elements directly as children of `forecastCards` (`#forecast-cards`, class
`forecast-grid`):

```js
// pre-Phase-21 (git show <base>^:js/ui/today-screen.js, ~line 538-544)
forecastCards.appendChild(renderTifLowConfidenceCard(pred, type, timeFormat));
// ...
forecastCards.appendChild(renderPredictionCard(pred, type, timeFormat));
```

`style.css` gives `.forecast-grid` a 2-column layout for exactly this
multi-card case:

```css
.forecast-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;   /* style.css:975 */
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
@media (max-width: 480px) {
  .forecast-grid { grid-template-columns: 1fr; }
}
```

Phase 21's rewrite now appends exactly **one** child to `forecastCards` —
the `<details class="later-today-section">` wrapper that holds every
non-hero prediction card:

```js
// js/ui/today-screen.js:712-754
const laterToday = el('details', { className: 'later-today-section' });
laterToday.appendChild(el('summary', { textContent: 'Later today' }));
// ... EVENT_TYPES loop appends cards to `laterToday`, not `forecastCards` ...
forecastCards.appendChild(laterToday);   // the ONLY appendChild call on forecastCards
```

`#app` caps at `max-width: 32rem` (512px, `style.css:74-75`), which is above
the 480px mobile breakpoint, so on any normal desktop/tablet viewport
`.forecast-grid`'s two `1fr` tracks are still active. A CSS grid container
with a single, unpositioned child auto-places that child into column 1 only
— the child (and therefore the entire "Later today" `<details>`, its
summary, and every card nested inside it) is constrained to roughly half of
`#forecast-cards`'s width, leaving a dead, empty half-width gap next to it.
No rule in the `style.css` diff (`.hero-row`, `.later-today-section`,
`.later-today-section summary`, `.later-today-section > *:not(summary)`)
sets `grid-column: 1 / -1` (or otherwise removes the grid tracks) to make
the wrapper span the full container width.

This regression is invisible to the existing test suite: `tests/e2e/forecast.spec.js`,
`tests/e2e/next-reachable-event.spec.js`, and
`tests/integration/today-hero-later-today.test.js` all assert DOM
presence/class/attribute/count, never computed box width, so all of them
pass while the feature renders at half width.

**Fix:** Either drop the grid on `#forecast-cards` now that it only ever
holds one child, or force the wrapper to span both tracks:

```css
.forecast-grid {
  display: grid;
  grid-template-columns: 1fr 1fr; /* still used elsewhere? otherwise remove */
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.later-today-section {
  grid-column: 1 / -1;   /* span the full grid width */
}
```
or simplify `#forecast-cards` to a plain block container:
```js
const forecastCards = el('section', { id: 'forecast-cards' }); // drop 'forecast-grid'
```

## Warnings

### WR-01: `PREDICTION_FIELD`/`RESULT_TYPE` tables duplicated verbatim between `forecast-utils.js` and `today-screen.js`

**File:** `js/lib/forecast-utils.js:88-109`, `js/ui/today-screen.js:576-597`

**Issue:** `today-screen.js`'s `renderForecastSection()` calls
`nextReachableEvent()` directly instead of `selectNextEvent()` (for
dual-hero support), and therefore re-implements `selectNextEvent()`'s
internal `PREDICTION_FIELD`/`RESULT_TYPE` mapping tables as
`HERO_PREDICTION_FIELD`/`HERO_RESULT_TYPE` — byte-for-byte identical today,
but with no shared source of truth. The `napWindowClosed` derivation
(`predictions.napStart?.napProbabilityScore?.napWindowClosed === true`) is
also independently duplicated in both `forecast-utils.js:181` and
`today-screen.js:651`. A future change to either the 5-path event model or
the field-mapping rules (e.g. adding a 6th path, renaming a field) can
easily update one copy and silently miss the other, producing hero vs.
Later-Today inconsistencies that unit tests for `forecast-utils.js` would
not catch (they only exercise `selectNextEvent`, which today-screen.js no
longer calls for hero rendering).

**Fix:** Export `PREDICTION_FIELD` and `RESULT_TYPE` (and a small
`isNapWindowClosed(predictions)` helper) from `forecast-utils.js` and import
them in `today-screen.js` instead of maintaining a second copy.

### WR-02: "isMissed" / delta-from-now computation duplicated across four call sites in `today-screen.js`

**File:** `js/ui/today-screen.js:200-215`, `:268-277`, `:357-371`, `:670-682`

**Issue:** The pattern `new Date().getHours()*60+getMinutes()`, parse
`prediction.central` into `centralMinutes`, then compare/subtract, is
independently re-implemented in `renderOneHeroCard` (twice: once implicitly
via the `isMissed` flag it receives, once explicitly for the "Missed by
Nmin" label), `renderPredictionCard` (twice, same pattern), and
`renderForecastSection`'s `heroEntries` loop (once, to compute `isMissed`
before it's even passed into `renderOneHeroCard`). Six near-identical
snippets computing overlapping quantities from independent `new Date()`
reads increases the chance of an inconsistent edit (e.g. fixing an
off-by-one in one copy but not the others) and makes the "missed" semantics
harder to audit.

**Fix:** Extract a single `computeMissedInfo(centralHHMM, nowDate)` helper
returning `{ isMissed, deltaMinutes }`, used by all four render paths.

### WR-03: `subWindowBedtime`'s thin-history fallback can emit a malformed `HH:MM` string for bedtimes shortly after midnight

**File:** `js/lib/forecast.js:437-454` (`subWindowBedtime`), consumed at `js/lib/forecast.js:801-812` (PRED-10 intense-day branch)

**Issue:** When the intense-day sub-window is thin (`< minDays`),
`subWindowBedtime` shifts the full-window P50/P10/P90 bedtime by subtracting
`fallbackOffsetMinutes` (default 30) with no midnight-wrap normalization:

```js
const base = calculatePercentiles(window, d => extractTime(d.bedtime));
return {
  central: base.central - fallbackOffsetMinutes,
  min:     base.min    - fallbackOffsetMinutes,
  max:     base.max    - fallbackOffsetMinutes,
};
```

If `base.central` (or `.min`) falls within `fallbackOffsetMinutes` of
midnight (e.g. a child whose bedtime clusters at 00:10), the result goes
negative and is later passed through `minutesToTime()` in `selectBedtime()`,
which does **not** guard against negative input (unlike
`computeDurationBand()`'s explicit `((x % 1440) + 1440) % 1440`
normalization a few lines above it in the same file). Verified directly:

```
minutesToTime(-20) === "-1:-20"   // malformed, not "23:40"
```

This would surface a broken time string on the intense-day-shifted bedtime
hero/prediction card whenever this exact combination occurs (late-clustering
bedtime + thin intense-day history). Not introduced by this phase's diff,
but present in a file this phase modifies extensively; flagged here since
`computeDurationBand()` right above it in the same file demonstrates the
correct fix pattern already exists locally.

**Fix:** Apply the same double-modulo normalization used in
`computeDurationBand`:
```js
const DAY_MINUTES = 24 * 60;
const wrap = (m) => ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
return {
  central: wrap(base.central - fallbackOffsetMinutes),
  min:     wrap(base.min    - fallbackOffsetMinutes),
  max:     wrap(base.max    - fallbackOffsetMinutes),
};
```

---

_Reviewed: 2026-09-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
