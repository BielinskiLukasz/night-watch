---
phase: NW-17
plan: "01"
subsystem: metrics
status: complete
tags: [metrics, day-of-week, settings, e2e, tdd]
completed_date: "2026-09-02"
duration_minutes: 18
requires: []
provides:
  - dayOfWeekAverages
  - firstDayOfWeek-setting
  - metrics-dow-section
affects:
  - js/lib/metrics.js
  - js/lib/db-shape.js
  - js/lib/settings-validate.js
  - js/ui/metrics-screen.js
  - js/ui/settings-modal.js
  - style.css
  - index.html
tech_stack:
  added: []
  patterns:
    - TDD RED-GREEN for dayOfWeekAverages and firstDayOfWeek validation
    - HTML details/summary native collapse (no JS toggle needed)
    - Caller-pre-filtered pure function (consistent with aggregateMetrics)
key_files:
  created: []
  modified:
    - js/lib/metrics.js
    - tests/unit/metrics.test.js
    - js/lib/db-shape.js
    - js/lib/settings-validate.js
    - tests/unit/settings-validate.test.js
    - js/ui/metrics-screen.js
    - style.css
    - index.html
    - js/ui/settings-modal.js
    - tests/e2e/metrics.spec.js
    - tests/unit/db-shape.test.js
decisions:
  - "dayOfWeekAverages uses extractDate(day.wake) for weekday attribution — skips synthetic bare-string records (extractDate returns null for bare strings)"
  - "Nap metrics (activityBeforeNap/AA/napDuration) only accumulate when day.napStart != null per D-02"
  - "buildDowSection passes nonRejectedDays so active-stage scoping is automatic — no extra filter needed"
  - "DoW section built with no open attribute — native HTML details collapse resets on every replaceChildren rebuild"
  - "firstDayOfWeek monday-first rotation: entries.slice(1) + entries[0] to move Sun from index-0 to last"
estimate:
  tokens: 78000
actuals:
  tokens: 30000
  tasks: 3
  commits: 5
---

# Phase NW-17 Plan 01: Day-of-Week Patterns Summary

**One-liner:** Collapsible per-weekday averages table in Metrics screen backed by `dayOfWeekAverages()` TDD-tested pure function and `firstDayOfWeek` settings control.

## What Was Built

### Task 1: dayOfWeekAverages() TDD + firstDayOfWeek schema + DoW section + CSS

- **`dayOfWeekAverages(dayRecords)`** added to `js/lib/metrics.js` as a new export after `aggregateMetrics`. Groups pre-filtered day records by weekday (via `extractDate(day.wake)` → `new Date(dateStr + 'T00:00').getDay()`). Nap-related metrics (activityBeforeNap, activityAfterNap, napDuration) exclude no-nap days per D-02. Sleep duration pairs `prevDay.bedtime` with `day.wake` using an inline `calcSleep` helper identical to the one inside `aggregateMetrics`. Returns a fixed 7-entry array (index 0=Sun..6=Sat) with all 12 Metrics columns.

- **`firstDayOfWeek: 'monday'`** added to `DEFAULT_SETTINGS` in `js/lib/db-shape.js` with JSDoc type annotation update.

- **`RULES.firstDayOfWeek`** added to `js/lib/settings-validate.js` as `{ type: 'enum', values: new Set(['monday', 'sunday']) }`.

- **`buildDowSection(nonRejectedDays, snap)`** added as a private helper in `js/ui/metrics-screen.js` before `mountMetricsScreen`. Creates a `<details class="metrics-dow-section">` (no `open` attribute — collapsed by default) with `<summary>Day-of-Week Patterns</summary>` and a `<table class="metrics-dow-table">` with 5 columns (Weekday | MA | AA | Nap | Sleep). Null values render as em-dash (U+2014). All cell content via `textContent` only (XSS guard T-17-03).

- **`tableScroll.replaceChildren(table, dowSection)`** in `render()` — places DoW section after main table inside the scroll container.

- **CSS** added to `style.css` after `.emptyState`: `.metrics-dow-section` (margin, overflow), `.metrics-dow-section summary` (button-like styling), `.metrics-dow-section[open] summary` (corner rounding), `.metrics-dow-table` (table layout), `.metrics-dow-table th/td` (padding, alignment), `.metrics-dow-table th:first-child/td:first-child` (left-align weekday column).

- **7 TDD unit tests** added to `tests/unit/metrics.test.js` covering: empty input, single Monday nap-day, single Monday no-nap day, mix of nap and no-nap days, bare-string skip, Thursday/Saturday bucketing, two-day average.

### Task 2: firstDayOfWeek Settings UI

- **`<select name="firstDayOfWeek">`** added to `index.html` Subject & Display fieldset after timeFormat, with Monday and Sunday options.

- **`settings-modal.js`** wired in both directions: `populateForm` reads `s.firstDayOfWeek ?? 'monday'` into the select element; `onClose` raw object includes `firstDayOfWeek: String(data.get('firstDayOfWeek') ?? 'monday')`.

- **5 validation unit tests** added to `tests/unit/settings-validate.test.js` covering: monday accepted, sunday accepted, saturday rejected, empty string rejected, mode:'load' reset to default.

- **Rule 1 auto-fix:** Updated RULES count assertions in `settings-validate.test.js` (21 → 22) and hardcoded `validFields` objects (added `firstDayOfWeek: 'monday'`) to match the new field.

### Task 3: E2E coverage (MET-11, MET-12)

- **3 Playwright tests** appended to `tests/e2e/metrics.spec.js`:
  1. `MET-12/basic` — DoW section present, collapsed by default, expands to 7 rows
  2. `MET-12/empty-weekdays` — only-Monday data; other 6 weekdays render 24 em-dash cells
  3. `MET-14/rerender-collapse` — page reload resets section to collapsed state

- **Rule 1 auto-fix:** Updated `db-shape.test.js` DEFAULT_SETTINGS count assertion (21 → 22).

## Verification

Full test suite: `npm test` — 768 unit/integration + 122 E2E = **890 total, 0 failures**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DEFAULT_SETTINGS count in settings-validate.test.js**
- **Found during:** Task 2 execution (running existing tests after adding firstDayOfWeek to RULES)
- **Issue:** Two tests checking for exactly 21 RULES/normalized keys failed; two `validFields` fixture objects in that file were missing `firstDayOfWeek`, causing mode:'save' validation to produce errors for the new required field
- **Fix:** Updated count assertions to 22; added `firstDayOfWeek: 'monday'` to both fixture objects
- **Files modified:** `tests/unit/settings-validate.test.js`
- **Commit:** adbf1f0

**2. [Rule 1 - Bug] Fixed DEFAULT_SETTINGS count in db-shape.test.js**
- **Found during:** Task 3 full `npm test` run
- **Issue:** `db-shape.test.js` had a count test asserting exactly 21 DEFAULT_SETTINGS keys; failed with 22 after adding firstDayOfWeek
- **Fix:** Updated to 22 with updated description
- **Files modified:** `tests/unit/db-shape.test.js`
- **Commit:** e3f8c5c

**3. [Rule 3 - Blocker] Added page.goto before page.evaluate in E2E tests**
- **Found during:** Task 3 first E2E run
- **Issue:** All 3 new E2E tests failed with `SecurityError: Failed to read the 'localStorage' property` — `page.evaluate` with localStorage was called before navigating to any page
- **Fix:** Added `await page.goto('http://localhost:8081')` before each `page.evaluate` call, matching the pattern used in existing E2E tests
- **Files modified:** `tests/e2e/metrics.spec.js`
- **Commit:** e3f8c5c

**4. Note on grep acceptance criterion for dayOfWeekAverages count:**
The plan's acceptance criterion `grep -c "dayOfWeekAverages" js/lib/metrics.js` ≥ 2 expected a separate export line, but the implementation uses the standard `export function dayOfWeekAverages` pattern (one line, 1 grep hit). The function is correctly exported and all 7 new unit tests prove it. This is a criterion wording issue, not a functional gap.

## Self-Check

All commits verified:
- d5fcc30: test(NW-17-01): add failing tests for dayOfWeekAverages
- 4b70e62: feat(NW-17-01): add dayOfWeekAverages, firstDayOfWeek schema, DoW section, CSS
- adbf1f0: test(NW-17-01): add firstDayOfWeek validation tests
- 6c1fef5: feat(NW-17-01): add firstDayOfWeek dropdown to Settings modal
- e3f8c5c: feat(NW-17-01): add E2E tests for day-of-week patterns (MET-11, MET-12)
