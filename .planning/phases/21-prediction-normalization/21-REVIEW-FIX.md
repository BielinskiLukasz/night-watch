---
phase: 21-prediction-normalization
fixed_at: 2026-09-16T22:30:00Z
review_path: .planning/phases/21-prediction-normalization/21-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-09-16
**Source review:** .planning/phases/21-prediction-normalization/21-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (fix_scope: critical_warning — 1 critical, 3 warnings, 0 info in this REVIEW.md)
- Fixed: 4
- Skipped: 0

**Verification environment:** `workflow.use_worktrees` is `false` in `.planning/config.json`, so all edits and commits were made directly in the main checkout (`develop` branch) — no isolated worktree was created. All test runs below (unit + E2E) ran in that same main checkout tree, so the results are directly reproducible from the current working tree.

## Fixed Issues

### CR-01: `#forecast-cards` 2-column grid halved the "Later Today" section's width

**Files modified:** `style.css`
**Commit:** `28e350e`
**Applied fix:** Added `grid-column: 1 / -1;` to `.later-today-section`, forcing the single `<details>` child to span both tracks of `#forecast-cards`'s `.forecast-grid` container instead of being auto-placed into column 1 (the review's first suggested fix). Confirmed `.forecast-grid` has no other consumer in `js/` (only `today-screen.js:882` sets the class), so this is a safe, minimal, targeted fix rather than a broader restructure.
**Verification:** `npm run test:unit` (859/859 pass) and full `npm test` including Playwright E2E (130/130 pass), run in the main checkout.

### WR-01: `PREDICTION_FIELD`/`RESULT_TYPE` tables duplicated between `forecast-utils.js` and `today-screen.js`

**Files modified:** `js/lib/forecast-utils.js`, `js/ui/today-screen.js`
**Commit:** `b96ee0f`
**Applied fix:** Exported `PREDICTION_FIELD` and `RESULT_TYPE` from `forecast-utils.js` (previously module-private), and added a new exported `isNapWindowClosed(predictions)` helper consolidating the `predictions.napStart?.napProbabilityScore?.napWindowClosed === true` derivation. Removed `today-screen.js`'s duplicate `HERO_PREDICTION_FIELD`/`HERO_RESULT_TYPE` tables and its independent `napWindowClosed` line entirely; `today-screen.js` now imports and uses the shared exports directly. `selectNextEvent()` in `forecast-utils.js` was also updated to call the new `isNapWindowClosed()` helper internally (same behavior, single source of truth).
**Verification:** `node -c` on both files, `npm run test:unit` (859/859 pass), targeted Playwright specs (`forecast.spec.js`, `next-reachable-event.spec.js`, `tif.spec.js` — 17/17 pass).

### WR-02: "isMissed"/delta-from-now computation duplicated across four call sites in `today-screen.js`

**Files modified:** `js/ui/today-screen.js`
**Commit:** `9dad770`
**Applied fix:** Extracted a new `computeMissedInfo(centralHHMM, nowDate)` helper (matching the review's suggested signature/return shape `{ isMissed, deltaMinutes }`) and replaced all four inline duplicate snippets with calls to it: `renderOneHeroCard`'s missed-label delta calc, `renderPredictionCard`'s `isMissed` calc, `renderPredictionCard`'s missed-label delta calc, and `renderForecastSection`'s `heroEntries` loop `isMissed` calc. One follow-up fix was needed: the helper's JSDoc originally contained the literal text `` `new Date()` `` inside a comment, which tripped the repo's `tests/integration/security-smoke.test.js` clock-seam scanner (it does not skip comment-only lines for this check) — reworded the doc to avoid the literal pattern while keeping the `// gsd:allow-ui-clock` tag on the actual code line.
**Verification:** `node -c`, `tests/integration/security-smoke.test.js` (9/9 pass, including the clock-seam checks), `npm run test:unit` (859/859 pass), targeted Playwright specs including the D3-11 "missed predictions" E2E test (17/17 pass).

### WR-03: `subWindowBedtime`'s thin-history fallback could emit a malformed `HH:MM` string near midnight

**Files modified:** `js/lib/forecast.js`
**Commit:** `ccab5e7`
**Applied fix:** Applied the same double-modulo normalization pattern already used by `computeDurationBand()` in the same file: `wrap(m) = ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES`, applied to `central`/`min`/`max` after subtracting `fallbackOffsetMinutes`. Matches the review's suggested fix exactly.
**Verification:** `node -c`, `node --test tests/unit/forecast.test.js` (144/144 pass, including all PRED-10/PRED-11 intense-day bedtime tests — none of which exercise the near-midnight edge case, so no existing assertions changed), full `npm run test:unit` (859/859 pass).

**Note (logic-fix flag):** This finding is a pure-function edge-case/logic fix (midnight-wrap normalization), not a syntax change. Per the fixer's verification strategy, logic fixes should be flagged for human confirmation even when tests pass, since no existing test exercises the specific near-midnight boundary this fix addresses (a bedtime clustering within `fallbackOffsetMinutes` of midnight, combined with a thin intense-day sub-window). **Commit status: fixed: requires human verification.** Recommend adding a regression unit test asserting `subWindowBedtime`'s output stays within `[0, 1440)` for a base P50/P10/P90 within `fallbackOffsetMinutes` of midnight before this ships further.

## Skipped Issues

None — all 4 in-scope findings were fixed.

---

_Fixed: 2026-09-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
