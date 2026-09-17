---
phase: 23-metrics-accuracy-column-migration
verified: 2026-09-17T14:45:00Z
status: passed
score: 14/14 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 23: Metrics–Accuracy Column Migration Verification Report

**Phase Goal:** Migrate the 12 per-event TIF prediction-window columns (min/max/confidence for wake, nap-start, nap-end, bedtime) from the Metrics screen to the Accuracy screen, so they live in exactly one place — never simultaneously absent from both screens during the migration.

**Requirement:** UI-11

**Verified:** 2026-09-17T14:45:00Z

**Status:** PASSED

## Executive Summary

Phase 23 successfully completes the UI-11 requirement. Plan 23-01 added a new `.tifPerDayTable` to the Accuracy screen rendering all 12 per-event TIF columns in a full-history table. Plan 23-02 then cleanly removed those same 12 columns from the Metrics screen, shrinking its table from 31 to 19 columns. The migration was never broken — the old home existed on the Accuracy screen before the old home was deleted from Metrics. All must-haves are verified in the codebase. Full test suite passes: 880 unit/integration tests + 138 E2E tests (including new UI-11 coverage).

---

## Goal Achievement: Observable Truths

### Plan 23-01: Add Per-Day TIF Windows Table to Accuracy Screen

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When `snap.forecastAlgorithm === 'tif'`, the Accuracy screen renders a `.tifPerDayTable` below the existing `.tifAccuracyTable`, with an `<h3>Per-Day TIF Windows</h3>` sub-heading between them, inside the same `section.accuracy-section` built by `renderTifAccuracy()`. | ✓ VERIFIED | `js/ui/accuracy-screen.js:406-472` defines `buildTifPerDayTable()`; line 578 appends it to section after building sub-heading; line 577 inserts `<h3>Per-Day TIF Windows</h3>` via `appendChild()`; test `accuracy-screen.spec.js:259-260` asserts sub-heading text; test `accuracy-screen.spec.js:248-276` asserts `.tifPerDayTable` visible and below summary. |
| 2 | The `.tifPerDayTable` has exactly 13 header columns: Date + 12 TIF fields in this exact order — W-min, W-max, W-conf, NS-min, NS-max, NS-conf, NE-min, NE-max, NE-conf, B-min, B-max, B-conf. No 4th 'window width' field exists anywhere. | ✓ VERIFIED | `TIF_PERDAY_COLUMNS` constant at line 97-113 defines 12 entries in exact order: `{ eventType: 'wake', field: 'min', label: 'W-min' }` through `{ eventType: 'bedtime', field: 'conf', label: 'B-conf' }`; test `accuracy-screen.spec.js:262-272` explicitly asserts `toHaveCount(13)` and validates header texts match expected array exactly; no width field present in constant or code. |
| 3 | The `.tifPerDayTable`'s data-row count equals `days.length` (every stage-filtered logged day) — NOT `tifBoundsHistory.length` — because `computeTifBoundsHistory` omits the first `tifRollingDays` warm-up days. Rows are built by iterating `days` and looking up each day in a Map built from `tifBoundsHistory`, defaulting every one of the 12 cells to '—' when no entry exists. | ✓ VERIFIED | `buildTifPerDayTable()` line 407 creates `tifBoundsMap = new Map(tifBoundsHistory.map(...))` (lookup only); line 435 iterates `for (const day of days)` (row iteration source); test `accuracy-screen.spec.js:279-291` seeds 32-day baseline with `tifRollingDays=7`, asserts `dataRows.toHaveCount(32)` (not 25), proving `days` drives row count. |
| 4 | Per-event min/max cells render via `formatTime(bounds.algMin/algMax, snap.timeFormat)`; confidence cells render `bounds.precisionScore.toFixed(2)`, or '—' when bounds entry or precisionScore is missing. | ✓ VERIFIED | Lines 453-459: `if (col.field === 'min') cellText = formatTime(bounds.algMin, snap.timeFormat); else if (col.field === 'max') cellText = formatTime(bounds.algMax, snap.timeFormat); else if (col.field === 'conf') cellText = bounds.precisionScore != null ? bounds.precisionScore.toFixed(2) : '—';` All cell values set via `textContent` (line 463), upholding T-07-06-01. |
| 5 | Rows for days with `.rejected === true` carry the 'rejected' class on their `<tr>`, and a CSS rule scoped to `.tifPerDayTable` (matching `.metricsTable tr.rejected td`: opacity 0.5, dimmed background) makes the dimming visually real. | ✓ VERIFIED | Line 437: `if (day.rejected) tr.classList.add('rejected');` CSS rule at `style.css:1873-1875`: `.tifPerDayTable tr.rejected td { opacity: 0.5; background-color: rgba(0, 0, 0, 0.025); }` Test `accuracy-screen.spec.js:315-324` seeds `rejectedDays: ['2026-05-01']`, navigates to Accuracy, asserts last row (oldest date) has class `rejected` via `toHaveClass(/rejected/)`. |
| 6 | The `.tifPerDayTable` never appears in the DOM when `snap.forecastAlgorithm !== 'tif'` — no hidden/dashed placeholder version. | ✓ VERIFIED | Rendering is conditional: `renderTifAccuracy()` is only called when `isTif` is true (line 564-581 in `render()` TIF branch only); `buildTifPerDayTable()` is appended only inside this TIF branch; test `accuracy-screen.spec.js:327-337` seeds `forecastAlgorithm: 'classic'`, navigates to Accuracy, asserts `page.locator('#accuracy-screen .tifPerDayTable').count() === 0`. |
| 7 | Pre-existing accuracy-screen.spec.js TIF tests that locate `#accuracy-screen table` (singular) no longer strict-mode-fail now that two `<table>` elements exist in TIF mode — both carry distinct classes (`.tifAccuracyTable`, `.tifPerDayTable`) that updated tests target explicitly. | ✓ VERIFIED | Line 293: `.tifAccuracyTable` class added to summary table; `buildTifPerDayTable()` returns table with `className = 'tifPerDayTable'` (line 410); two pre-existing tests re-scoped to `.tifAccuracyTable` locator; all tests in `accuracy-screen.spec.js` pass (11/11), including re-scoped tests at lines 200 and 227. |

### Plan 23-02: Remove TIF Inline Columns from Metrics Screen

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | The Metrics screen's `.metricsTable` header row has exactly 19 `<th>` elements (down from 31) in both Classic and TIF modes — the TIF inline columns are gone entirely, not merely hidden. | ✓ VERIFIED | `COLUMNS` constant line 43-64 defines 19 entries; `grep -c "COLUMNS = " js/ui/metrics-screen.js` returns 1; test `metrics.spec.js:22-75` (MET-02/MET-03) seeds `forecastAlgorithm: 'classic'`, asserts `headerCells.count() === 19` with comment "19 base columns (TIF columns moved to Accuracy screen per D-09)"; test `metrics.spec.js:434` (UI-11) seeds `forecastAlgorithm: 'tif'`, asserts same 19-column count in TIF mode. |
| 9 | None of the 12 former TIF column labels (W-min, W-max, W-conf, NS-min, NS-max, NS-conf, NE-min, NE-max, NE-conf, B-min, B-max, B-conf) appear anywhere in `.metricsTable`'s text content in any algorithm mode. | ✓ VERIFIED | `TIF_COLUMNS` constant deleted entirely; grep confirms zero references to `TIF_COLUMNS` in metrics-screen.js; test `metrics.spec.js:39-54` asserts 12 negative assertions: `expect(headerTexts).not.toContain('W-min')`, etc.; test `metrics.spec.js:434-453` repeats 12 negative assertions in TIF mode. |
| 10 | `js/ui/metrics-screen.js` no longer defines `TIF_COLUMNS` and no longer imports `computeTifBoundsHistory`; all references to `TIF_COLUMNS` or `tifBoundsMap` are zero. | ✓ VERIFIED | `grep -c "TIF_COLUMNS\|tifBoundsMap\|tifBoundsArray\|computeTifBoundsHistory" js/ui/metrics-screen.js` returns 0; commit `66f8616` deleted all 6 TIF-cell/placeholder rendering sites; `import { computeTifBoundsHistory...` line deleted. |
| 11 | `isTif` and `activityLog` remain defined and used in metrics-screen.js's `render()` — they still gate the min-TIF/median-TIF/max-TIF aggregate rows and the `tifForecast()` historic-band override block, which are explicitly out of scope for removal. | ✓ VERIFIED | `grep -c "isTif" js/ui/metrics-screen.js` returns 7 (>= 5 required); line 631: `const isTif = snap.forecastAlgorithm === 'tif';`; line 632: `const activityLog = isTif ? ...`; lines 635/640/667/702-707 still use both variables for TIF aggregate rows and historic-band override; `computeTifTrimmedStats` still imported and called (line 245/635). |
| 12 | `buildDayRow`'s signature is `(dayMetrics, snap)` — the `tifBoundsMap` and `isTif` parameters that existed solely to render removed columns are gone; call site passes exactly two arguments. | ✓ VERIFIED | Line 178: `function buildDayRow(dayMetrics, snap)` — 2 params; line 737: `const dayRow = buildDayRow(rows[i], snap);` — 2 arguments passed; no `tifBoundsMap` or `isTif` in signature or call. |
| 13 | `buildRollingSection`'s signature drops the `isTif` parameter; both call sites (7-day and 14-day) pass one fewer argument. | ✓ VERIFIED | Line 370: `function buildRollingSection(nDays, label, nonRejectedDays, snap)` — 4 params (no `isTif`); line 696: `buildRollingSection(7, '7-day rolling', nonRejectedDays, snap)` — 4 args; line 699: `buildRollingSection(14, '14-day rolling', nonRejectedDays, snap)` — 4 args. |
| 14 | `buildSectionHeaderRow`'s `colCount` argument at both call sites is `COLUMNS.length` (19), not `COLUMNS.length + TIF_COLUMNS.length`. | ✓ VERIFIED | Line 397: `buildSectionHeaderRow(headerLabel, COLUMNS.length)` in `buildRollingSection()`; line 729: `buildSectionHeaderRow('All-time', COLUMNS.length)` in `render()`; both pass 19, not 31; `COLUMNS.length` verified at line 43-64 as 19 entries. |

---

## Artifacts Verification

### Artifact Status Matrix

| Artifact | Exists | Substantive | Wired | Status | Evidence |
|----------|--------|-------------|-------|--------|----------|
| `js/ui/accuracy-screen.js:TIF_PERDAY_COLUMNS` | ✓ | ✓ | ✓ | ✓ VERIFIED | 12-entry frozen constant at line 97-113; used by `buildTifPerDayTable()` at line 422/447 |
| `js/ui/accuracy-screen.js:buildTifPerDayTable()` | ✓ | ✓ | ✓ | ✓ VERIFIED | Full implementation lines 406-472; called from `renderTifAccuracy()` line 578; returns properly-structured table with thead/tbody |
| `js/ui/accuracy-screen.js:formatTime import` | ✓ | ✓ | ✓ | ✓ VERIFIED | Line 35: `import { formatTime } from '../lib/time.js';` used at lines 454/456 in cell formatting |
| `js/ui/accuracy-screen.js:renderTifAccuracy() signature` | ✓ | ✓ | ✓ | ✓ VERIFIED | Line 564-581: updated to accept `tifBoundsHistory` and `days` params; line 577-578 adds sub-heading and calls `buildTifPerDayTable()` |
| `style.css:.tifPerDayTable` | ✓ | ✓ | ✓ | ✓ VERIFIED | Lines 1833-1875: complete rule block with sticky header/column, rejected dimming, all properties matching D-05/D-07 spec |
| `style.css:.tifPerDayTable th`, `td`, `td.sticky-col`, `tr.rejected td` | ✓ | ✓ | ✓ | ✓ VERIFIED | All sub-rules present (lines 1838-1875) with correct z-indices, positioning, colors, opacity |
| `style.css:.tifAccuracyTable class hook` | ✓ | ✓ | ⚠️ PARTIAL | ⚠️ ORPHANED — CLASS EXISTS, NO CSS | Line 293 in accuracy-screen.js: `table.className = 'tifAccuracyTable';` class applied to summary table; NO corresponding CSS rules in style.css (see code review WR-02). Selector-safety hook for E2E locators works as intended; visual styling missing (known follow-up item, not a blocker to migration). |
| `tests/e2e/accuracy-screen.spec.js:per-day TIF tests` | ✓ | ✓ | ✓ | ✓ VERIFIED | 4 new tests added: lines 248-276 (structural), 279-308 (full history), 315-324 (rejected dimming), 327-337 (classic-mode absence); all passing |
| `tests/e2e/accuracy-screen.spec.js:pre-existing TIF locator re-scopes` | ✓ | ✓ | ✓ | ✓ VERIFIED | 2 pre-existing tests re-scoped to `.tifAccuracyTable` (lines 200, 227); both passing; no bare `#accuracy-screen table` locators remain |
| `tests/e2e/metrics.spec.js:19-column assertion + negative TIF label assertions` | ✓ | ✓ | ✓ | ✓ VERIFIED | Lines 22-75 (MET-02/MET-03): `expect(count).toBe(19)` + 12 `not.toContain()` assertions; lines 434-453 (UI-11): same 19-column + 12 negative assertions in TIF mode |
| `tests/e2e/metrics.spec.js:obsolete hidden-placeholder test removal` | ✓ | ✓ | ✓ | ✓ VERIFIED | Obsolete `MET-10/boundary: TIF placeholder cells hidden when TIF is off` test removed; no longer in file (0 references to "TIF placeholder" + "hidden") |
| `js/ui/metrics-screen.js:all TIF-column code deleted` | ✓ | ✓ | ✓ | ✓ VERIFIED | TIF_COLUMNS constant deleted; computeTifBoundsHistory import deleted; 6 rendering call sites deleted (buildDayRow loop, buildTifAggregateRow loop, buildRollingSection placeholder loop, thead header loop, render() All-time loop, tifBoundsArray/Map construction); 0 references remain |
| `js/ui/metrics-screen.js:isTif/activityLog/TIF aggregate rows retained` | ✓ | ✓ | ✓ | ✓ VERIFIED | All still present and functional; `isTif` referenced 7 times; `activityLog` still gated by `isTif`; minTifRow/medianTifRow/maxTifRow still defined and `.hidden = !isTif;` per line 668-670; `tifForecast()` historic-band override block still active lines 702-707 |

---

## Test Suite Results

### Unit & Integration Tests
- **Command:** `npm run test:unit` (node --test)
- **Result:** 880 tests passed, 0 failed
- **Duration:** ~22 seconds
- **Evidence:** Covers forecast-tif.js, metrics.js, accuracy-tif.js consumers (all unmodified by phase 23) — no regressions introduced by column migration

### E2E Tests: Accuracy Screen
- **Command:** `npm run test:e2e -- accuracy-screen.spec.js`
- **Result:** 11 tests passed, 0 failed
- **Duration:** ~20 seconds
- **Coverage:**
  - Pre-existing cold-start test still passes unmodified (line 151)
  - Pre-existing classic avgScore grid test passes (line 189)
  - Pre-existing TIF summary table tests pass with re-scoped `.tifAccuracyTable` locators (lines 200, 227)
  - NEW: Per-day TIF windows table structural test (lines 248-276)
  - NEW: Full history row-count test (lines 279-308)
  - NEW: Warm-up boundary dashing test (included in 279-308)
  - NEW: Rejected dimming test (lines 315-324)
  - NEW: Classic-mode absence test (lines 327-337)

### E2E Tests: Metrics Screen
- **Command:** `npm run test:e2e -- metrics.spec.js`
- **Result:** 15 tests passed, 0 failed
- **Duration:** ~20 seconds
- **Coverage:**
  - Pre-existing MET-02/MET-03 test with updated 19-column assertion (lines 22-75)
  - NEW: UI-11 test proving 19-column count in TIF mode (lines 434-453)
  - 9 pre-existing rolling/boundary/cold-start tests (all still passing, unchanged by column removal)
  - 3 pre-existing DoW pattern tests (all still passing)

### Full E2E Suite
- **Command:** `npm test` (unit + all E2E)
- **Result:** 880 unit + 138 E2E = **138 E2E passed, 0 failed**
- **Duration:** ~1.2 minutes

---

## Requirement Traceability

| Requirement | PLAN | Status | Evidence |
|-------------|------|--------|----------|
| UI-11: Move TIF window columns (per-event lower/upper bounds, confidence score) from Metrics to Accuracy screen — clean separation: Metrics = "what happened," Accuracy = "how well predicted" | 23-01, 23-02 | ✓ SATISFIED | 12 TIF columns exist on Accuracy screen (7 truths in 23-01 verification); 12 TIF columns completely absent from Metrics screen (7 truths in 23-02 verification); never simultaneously absent from both; all test assertions passing |

---

## Code Review Findings (Reference)

Code review (23-REVIEW.md, depth: standard) identified 0 Critical findings, 2 Warnings, 3 Info items:

### Warnings

**WR-01: Per-Day TIF Windows table has no horizontal-scroll container — will overflow on mobile**
- **Status:** Known follow-up item (not a blocker to phase goal)
- **Reason:** The migration itself is complete and functional. WR-01 is a UX/responsiveness enhancement flagged for future work (wrapping the TIF section in a `.tifPerDayTableScroll` container with overflow rules). The phase goal is to migrate columns, not to style/wrap them.

**WR-02: `.tifAccuracyTable` has zero CSS rules, creating visual inconsistency**
- **Status:** Known follow-up item (not a blocker to phase goal)
- **Reason:** `.tifAccuracyTable` class exists (line 293 in accuracy-screen.js) as a selector-safety hook for E2E locators and is working as intended (tests pass). Lack of CSS styling is a visual polish gap, not a migration gap. Phase goal does not require visual consistency; it requires functional column migration. Follow-up: add matching CSS rules to `.tifAccuracyTable` (base table styling + sticky header rules mirroring `.tifPerDayTable`).

### Info Items

**IN-01:** Unused `snap` parameter in `buildTifAccuracyGrid` — dead parameter (minor code-quality item)

**IN-02:** TIF min/max/conf cell-formatting logic duplicated instead of shared (minor code-reuse observation; future refactoring opportunity)

**IN-03:** Stale doc comments in metrics-screen.js (`"14-column table"` and outdated index references) — minor doc update opportunity

---

## Prohibition Compliance (23-02)

Plan 23-02 included explicit prohibitions to prevent over-scope deletions:

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| "Never remove the isTif variable, the activityLog variable, or the tifForecast()-based historic-band override block" | ✓ VERIFIED | All three remain in metrics-screen.js; `isTif` used 7 times (line 631, 632, 635, 668, 670, 702, 707); `activityLog` defined and used (line 632); `tifForecast()` call and override block intact (lines 702-707) |
| "Never add a 4th 'window width' column/field" | ✓ VERIFIED | `TIF_PERDAY_COLUMNS` has exactly 3 fields per event type: min, max, conf (12 total, no width field); no reference to width anywhere in accuracy-screen.js or style.css new code |
| "Never modify computeTifBoundsHistory or computeTifAccuracy computation logic" | ✓ VERIFIED | `js/lib/accuracy-tif.js` unmodified; commit hashes `f9a9638` and `66f8616` touch only UI/test files, not library files |
| "Never leave metrics-screen.js with TIF_COLUMNS identifier still appearing" | ✓ VERIFIED | Zero references to `TIF_COLUMNS` (grep confirms count = 0); constant deleted, no stale comments referencing it |
| "Never delete or weaken the existing 19 base-column assertions in metrics.spec.js" | ✓ VERIFIED | Pre-existing assertions for Date/Wake/Sleep/S.Debt and cold-start S.Debt em-dash check all still present and passing; no base column index positions changed (TIF columns were appended, not interleaved) |

---

## Data-Flow Verification (Level 4)

### Accuracy Screen: Per-Day TIF Table Data Flow

| Data Variable | Source | Computed From | Flows To | Status |
|---------------|--------|---------------|----------|--------|
| `tifBoundsHistory` | `computeTifBoundsHistory(days, snap, activityLog)` (lib/accuracy-tif.js) | Real event log + settings-driven TIF algorithm | `buildTifPerDayTable()` as Map lookup; cell values rendered via `formatTime()`/`.toFixed()` | ✓ FLOWING |
| `days` (stage-filtered) | `filterDayRecordsByStage(dayRecords, stages, activeStageId)` (lib/stages.js) | Real event log + user-selected stage filter | Table row iteration in `buildTifPerDayTable()` | ✓ FLOWING |
| Cell text (min/max/conf) | `formatTime(bounds.algMin/algMax, snap.timeFormat)` (lib/time.js); `bounds.precisionScore.toFixed(2)` | Real TIF bounds computed from event log | `td.textContent` (no template/interpolation) | ✓ FLOWING |

No hollow props or static fallback-only data found. All values flow from real data sources (event log, user settings, computed metrics).

---

## Anti-Patterns Scan

### Modified Files
- `js/ui/accuracy-screen.js`
- `js/ui/metrics-screen.js`
- `style.css`
- `tests/e2e/accuracy-screen.spec.js`
- `tests/e2e/metrics.spec.js`

### Scan Results

| Pattern | File | Occurrences | Classification | Action |
|---------|------|-------------|-----------------|--------|
| `TBD`, `FIXME`, `XXX` debt markers | All files | 0 | N/A | ✓ CLEAN |
| `TODO`, `HACK`, `PLACEHOLDER` markers | All files | 0 | N/A | ✓ CLEAN |
| Empty implementations (`return null`, `return {}`, `=> {}`) | accuracy-screen.js new code | 0 | N/A | ✓ CLEAN |
| Hardcoded empty data (static stubs) | accuracy-screen.js new code, metrics-screen.js modified | 0 | N/A | ✓ CLEAN |
| Console.log-only implementations | metrics-screen.js | 0 (7 uses of `isTif`; all real conditional logic, no console.log-only paths) | N/A | ✓ CLEAN |
| `innerHTML` with user data | All modified files | 0 | N/A | ✓ CLEAN — all dynamic cells set via `textContent` per T-07-06-01 |

---

## Test Coverage Summary

| Category | Count | Status |
|----------|-------|--------|
| Unit tests (node --test) | 880 | ✓ PASSED |
| E2E tests (Playwright) | 138 | ✓ PASSED |
| New UI-11 tests (23-01) | 4 | ✓ PASSED |
| New UI-11 tests (23-02) | 1 | ✓ PASSED |
| Pre-existing tests re-scoped (selector safety) | 2 | ✓ PASSED |
| Total test failures | 0 | ✓ CLEAN |

---

## Commits

| Plan | Commit Hash | Type | Message | Status |
|------|-------------|------|---------|--------|
| 23-01 | f9a9638 | feat | add per-day TIF windows table to accuracy screen | ✓ Verified in git log |
| 23-01 | 2ed1d41 | test | cover per-day TIF table boundary/precision edges | ✓ Verified in git log |
| 23-02 | 66f8616 | feat | remove TIF inline columns from Metrics screen | ✓ Verified in git log |
| 23-02 | ea1fd14 | test | assert 19 metrics columns, TIF labels absent | ✓ Verified in git log |
| Phase metadata | de1734b | docs | add code review report | ✓ Verified in git log |

---

## Conclusion

**Phase Goal Achieved: YES**

The 12 per-event TIF prediction-window columns have been successfully migrated from the Metrics screen to the Accuracy screen. The migration was executed in two sequential phases ensuring they were never simultaneously absent from both screens:

1. **Plan 23-01 (completed):** Added fully-functional `.tifPerDayTable` to the Accuracy screen rendering all 12 columns in a full-history table gated to TIF mode.
2. **Plan 23-02 (completed):** Cleanly removed all 12 columns from the Metrics screen, shrinking the table from 31 to 19 columns.

**All must-haves verified:**
- ✓ 14/14 observable truths from both plans verified in codebase
- ✓ All artifacts exist, are substantive, and are properly wired
- ✓ Full data-flow (Level 4) verified — no hollow props or stubs
- ✓ 880 unit + 138 E2E tests passing (including new UI-11 coverage)
- ✓ Requirement UI-11 satisfied
- ✓ Prohibition requirements met (isTif/TIF aggregate rows preserved; no TIF_COLUMNS references; no 4th "width" field)

**Code review findings:**
- 0 Critical (blockers)
- 2 Warnings (WR-01: mobile scroll container; WR-02: CSS styling on summary table) — known follow-up items, not blockers to migration
- 3 Info (minor code-quality observations)

**Status: READY FOR NEXT PHASE**

---

_Verification completed: 2026-09-17T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
