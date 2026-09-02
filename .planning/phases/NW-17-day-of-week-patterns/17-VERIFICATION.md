---
phase: NW-17-day-of-week-patterns
verified: 2026-09-02T00:00:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase NW-17: Day-of-Week Patterns Verification Report

**Phase Goal:** Users can inspect per-weekday averages for MA, AA, nap duration, and sleep duration in a collapsible Metrics screen section, revealing rhythm patterns across the week
**Verified:** 2026-09-02
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `dayOfWeekAverages(dayRecords)` exported from `js/lib/metrics.js`, groups records by weekday via `new Date(dateStr + 'T00:00').getDay()`, returns 7-entry array (0=Sun..6=Sat) with activityBeforeNap/AA/napDuration/sleepDuration | VERIFIED | Function at line 417; weekday computation at line 460; 7 unit tests pass (80/80 in metrics.test.js) |
| 2 | Nap-related averages (MA, AA, napDuration) exclude no-nap days (`day.napStart === null`); weekday with only no-nap days returns null for those three columns | VERIFIED | `isNapDay = day.napStart != null` at line 463; nap accumulation guarded at lines 477-485; unit tests "single Monday no-nap day" and "mix" both pass |
| 3 | Sleep duration paired via `prevDay.bedtime` to `day.wake` (same overnight-pairing as `aggregateMetrics`) | VERIFIED | `calcSleep(prevBedStr, wakeStr)` at lines 438-442; prevDay accessed at line 454; unit test confirms 510 min (22:30 prev bedtime → 07:00 wake) |
| 4 | Metrics screen `render()` appends `<details class="metrics-dow-section">` with NO `open` attribute (collapsed by default) and `<summary>` textContent exactly `'Day-of-Week Patterns'` to `tableScroll` after the main metrics table | VERIFIED | `details.className = 'metrics-dow-section'` at line 506 (no `.open` set); `summary.textContent = 'Day-of-Week Patterns'` at line 510; `tableScroll.replaceChildren(table, dowSection)` at line 770; E2E test `isOpenBefore === false` confirmed |
| 5 | DoW section contains standalone 5-column table (Weekday, MA, AA, Nap, Sleep) with 7 rows ordered per `snap.firstDayOfWeek`; null cells render as em-dash U+2014 via `textContent` only (no innerHTML) | VERIFIED | Rotation logic at lines 500-502; cell rendering `td.textContent = value === null ? '—' : formatDuration(value)` at line 543 (U+2014 confirmed); no `innerHTML` usage in metrics-screen.js; E2E test confirms 7 tbody rows and 24 em-dash cells for 6 non-Monday weekdays |
| 6 | `DEFAULT_SETTINGS.firstDayOfWeek = 'monday'`; `RULES.firstDayOfWeek` validates as enum `{monday, sunday}`; Settings modal fieldset contains `<select name="firstDayOfWeek">` populated and saved by `settings-modal.js` | VERIFIED | db-shape.js line 67; settings-validate.js line 65; index.html line 234; settings-modal.js populateForm lines 89-90 and onClose line 156; 97/97 settings-validate tests pass (including 5 firstDayOfWeek-specific cases) |
| 7 | `buildDowSection(nonRejectedDays, snap)` receives the same stage-filtered + rejected-excluded array as rolling sections — stage scoping is automatic | VERIFIED | `nonRejectedDays = reversedDays.filter(r => !r.rejected)` at line 639 (reversedDays is already stage-filtered); `buildDowSection(nonRejectedDays, snap)` called at line 769 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/lib/metrics.js` | exports `dayOfWeekAverages(dayRecords)` | VERIFIED | Function at line 417; export at definition |
| `js/lib/db-shape.js` | `DEFAULT_SETTINGS.firstDayOfWeek = 'monday'` | VERIFIED | Line 67; JSDoc @type updated at line 39 |
| `js/lib/settings-validate.js` | `RULES.firstDayOfWeek` enum {monday, sunday} | VERIFIED | Line 65 |
| `js/ui/metrics-screen.js` | `buildDowSection()` + `tableScroll.replaceChildren(table, dowSection)` | VERIFIED | buildDowSection at line 490; replaceChildren at line 770 |
| `style.css` | `.metrics-dow-section` and `.metrics-dow-table` CSS rules | VERIFIED | 8 rule blocks at lines 1769-1815 (section, summary, open-summary, table, th/td, th, first-child) |
| `index.html` | `<select name="firstDayOfWeek">` in Subject & Display fieldset | VERIFIED | Line 234 |
| `tests/unit/metrics.test.js` | 7+ test cases in `describe('dayOfWeekAverages(dayRecords)')` | VERIFIED | 7 test cases at lines 874-961; all pass (80/80 total) |
| `tests/unit/settings-validate.test.js` | firstDayOfWeek validation tests | VERIFIED | 5 test cases added; 97/97 total pass |
| `tests/e2e/metrics.spec.js` | 3 Playwright E2E tests for DoW section | VERIFIED | Tests at lines 524-640: MET-12/basic, MET-12/empty-weekdays, MET-14/rerender-collapse |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `buildDowSection()` | `dayOfWeekAverages()` | direct call at line 494 | VERIFIED | `const entries = dayOfWeekAverages(nonRejectedDays)` |
| `buildDowSection()` | `snap.firstDayOfWeek` | read at line 491 | VERIFIED | `const firstDay = snap.firstDayOfWeek ?? 'monday'` |
| `render()` in metrics-screen.js | `buildDowSection()` | call at line 769 with `nonRejectedDays` | VERIFIED | `const dowSection = buildDowSection(nonRejectedDays, snap)` |
| `render()` | `tableScroll` | `replaceChildren(table, dowSection)` at line 770 | VERIFIED | DoW section placed after main table in scroll container |
| `settings-modal.js populateForm()` | `snap.firstDayOfWeek` | read at lines 89-90 | VERIFIED | `firstDayOfWeekEl.value = s.firstDayOfWeek ?? 'monday'` |
| `settings-modal.js onClose` | FormData firstDayOfWeek | included in raw object at line 156 | VERIFIED | `firstDayOfWeek: String(data.get('firstDayOfWeek') ?? 'monday')` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `dayOfWeekAverages([])` returns 7 entries, all null | `node --test tests/unit/metrics.test.js` | 80/80 pass | PASS |
| Nap exclusion on no-nap day | unit test "single Monday no-nap day" | napDuration = null, sleepDuration non-null | PASS |
| prevDay pairing for sleep duration | unit test "single Monday nap-day" | sleepDuration = 510 (22:30 prev → 07:00 wake) | PASS |
| DoW section collapsed by default, 7 rows | E2E MET-12/basic | isOpenBefore=false, toHaveCount(7) | PASS |
| Em-dash for empty weekdays | E2E MET-12/empty-weekdays | 24 em-dash cells in 6 non-Monday rows | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| MET-11 | `dayOfWeekAverages()` function grouping non-rejected records by weekday | SATISFIED | Function implemented, exported, 7 unit tests pass |
| MET-12 | Collapsible DoW section, 7 rows, stage-scoped, em-dash for empty weekdays | SATISFIED | buildDowSection wired in render(); E2E tests confirm all four behaviors |

### Anti-Patterns Found

No debt markers (TODO/FIXME/TBD/XXX), no innerHTML usage, no empty implementations, no hardcoded stubs found in any modified file.

### Commit Verification

All 5 commits from SUMMARY.md verified present in git history:

| Commit | Message | Status |
|--------|---------|--------|
| d5fcc30 | test(NW-17-01): add failing tests for dayOfWeekAverages | VERIFIED |
| 4b70e62 | feat(NW-17-01): add dayOfWeekAverages, firstDayOfWeek schema, DoW section, CSS | VERIFIED |
| adbf1f0 | test(NW-17-01): add firstDayOfWeek validation tests | VERIFIED |
| 6c1fef5 | feat(NW-17-01): add firstDayOfWeek dropdown to Settings modal | VERIFIED |
| e3f8c5c | feat(NW-17-01): add E2E tests for day-of-week patterns (MET-11, MET-12) | VERIFIED |

### Deviation Notes

**Acceptance criterion grep count:** The plan specified `grep -c "dayOfWeekAverages" js/lib/metrics.js` >= 2, expecting a separate export line. The implementation uses `export function dayOfWeekAverages` (one grep hit). This is a criterion wording issue — the function is correctly exported and all 7 unit tests prove it. Not a functional gap.

---

_Verified: 2026-09-02_
_Verifier: Claude (gsd-verifier)_
