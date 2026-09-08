---
phase: NW-16-rolling-window-aggregates
fixed_at: 2026-08-31T00:00:00Z
review_path: .planning/phases/NW-16-rolling-window-aggregates/16-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase NW-16: Code Review Fix Report

**Fixed at:** 2026-08-31
**Source review:** `.planning/phases/NW-16-rolling-window-aggregates/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### WR-01: Dead import — `activityAfterSleepFactor` never called

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** 012f11e
**Applied fix:** Removed `activityAfterSleepFactor` from the import statement, leaving only `aggregateMetrics`.

---

### WR-02: Variable name `window` shadows the browser global

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** e3653fd
**Applied fix:** Renamed local variable `window` to `rollingRows` in `computeTifTrimmedStats`, updating all three references (declaration, `const mins = rollingRows`, `const vals = rollingRows`).

---

### WR-03: TIF aggregate rows computed over a different sample set than rolling aggregate rows

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** b2150cf
**Applied fix:** Changed `computeTifTrimmedStats` to filter rejected rows before slicing instead of after: `rows.filter(r => !r.rejected).slice(-windowSize)` instead of `rows.slice(-windowSize).filter(r => !r.rejected)`. This ensures the TIF aggregate rows always see exactly N non-rejected days, consistent with `buildRollingSection`.

Note: The reviewer's suggested fix passed `nonRejectedDays` (raw day records) as the parameter, which would break the function (it expects computed metrics rows with column keys like `sleepDuration`, `napFraction`). The correct fix reorders the filter/slice on the existing `rows` parameter without changing the call site.

**Commit status:** fixed: requires human verification (logic change — please confirm TIF aggregate row counts match rolling row counts in practice).

---

### WR-04: `formatCellValue` — truthy check skips time-branch for falsy non-null values

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** e436f9a
**Applied fix:** Replaced `if (colDef.isTime && value)` with `if (colDef.isTime)`. The early-return guard on line 136 already handles `null`/`undefined`, so the `&& value` truthy test was both redundant and incorrect for falsy non-null values like `""` or `0`.

---

### WR-05: MET-02/MET-03 E2E test never seeds data — structurally flaky

**Files modified:** `tests/e2e/metrics.spec.js`
**Commit:** 50f3b56
**Applied fix:** Replaced the unreliable `wakeBtn.click()` approach with explicit `localStorage.setItem('nightwatch:db', ...)` seeding before `page.reload()`, matching the pattern used by all other rolling-window tests. The seeded database contains one wake and one bedtime event sufficient to render the metrics table.

---

### IN-01: COLUMNS module comment says "16-column" but array has 18 entries

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** bab4043
**Applied fix:** Updated the JSDoc comment from "16-column" to "18-column" and added `MA/Sl` and `MA/Nap` to the column order list (between `→Nap` and `Nap→`).

---

### IN-02: Redundant null checks in `formatCellValue` after early-return guard

**Files modified:** `js/ui/metrics-screen.js`
**Commit:** 483b5fe
**Applied fix:** Removed `&& value !== null && value !== undefined` from both the `isRatio` and duration branches. The early-return guard on line 136 already covers those cases.

---

### IN-03: `waitForTimeout(500)` in empty-state E2E test is fragile

**Files modified:** `tests/e2e/metrics.spec.js`
**Commit:** 4b6681f
**Applied fix:** Removed `await page.waitForTimeout(500)` and replaced with an inline comment noting that `toBeVisible()` retries until its own timeout. The subsequent `await expect(page.locator('.emptyState')).toBeVisible()` assertion already provides resilient waiting.

---

_Fixed: 2026-08-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
_Verification ran in: main checkout (workflow.use_worktrees=false)_
