# Milestones

## v1.4 TIF Fixes & Metrics Depth (Shipped: 2026-09-08)

**Phases completed:** 4 phases, 8 plans, 13 tasks

**Key accomplishments:**

- Fixed two forecast-tif.js correctness bugs: bare-string/ISO bedtime ordering guard (FIX-01) and rejectedInWindow threaded to all primary trimmedMinMax band calls (FIX-02)
- Removed redundant tifForecast double-invocation from render(), corrected computeTifTrimmedStats comment, fixed stale test description for tifRollingDays upper bound.
- 7-day and 14-day rolling aggregate sections added to Metrics screen using buildRollingSection helper with cold-start notes, TIF placeholder cells, and section-header CSS styling.
- Collapsible per-weekday averages table in Metrics screen backed by `dayOfWeekAverages()` TDD-tested pure function and `firstDayOfWeek` settings control.
- sleepDebtProxy() pure function added to js/lib/metrics.js: filter-then-slice rolling window returning signed debt sum or null on cold-start
- targetSleepMinutes setting (default 600 min / 10h) wired schema-to-modal with combinedSleepNap median hint via TDD RED/GREEN
- S.Debt (rolling 7-day sleep debt) column wired into all three Metrics screen aggregate sections and per-day rows via sleepDebtProxy import; E2E spec updated to 31 columns with S.Debt header assertion
- S.Debt column relabelled to 'S.Debt(7d)' and sliceOffset fix removes cold-start misfires in rolling aggregate sections

---

## v1.2 Prediction & Metrics (Shipped: 2026-08-24)

**Phases completed:** 2 phases, 15 plans, 19 tasks  
**Timeline:** 2026-07-10 → 2026-08-24 (45 days)  
**Scope:** 17/17 requirements satisfied, 264 files changed, ~15,500 LOC added

**Delivered:** Opt-in TIF forecast algorithm with multi-source window intersection and precision scoring, plus a dedicated Metrics screen with per-day sleep/activity statistics and historical aggregates.

**Key accomplishments:**

- Added `js/lib/metrics.js` — 6 duration/ratio helpers (sleepDuration, napDuration, activityBeforeNap, activityAfterNap, dayLength, combinedSleepNap) shared by TIF and Metrics screen
- Implemented TIF algorithm (`js/lib/forecast-tif.js`) — percentile trim, multi-source window intersection, precision scoring, and anchor-based duration bands; 9 unit + 9 integration tests
- Added TIF settings (algorithm toggle, trim %, precision target) with full persistence across sessions
- Wired TIF into Today screen with normal precision cards (collapsible evidence windows), low-confidence fallback (union), and precision badge on hero card
- Built Metrics screen — dedicated 5th bottom-nav tab with per-day sleep/nap durations, AAS/SAA ratio metrics, historical aggregates (avg/min/max with date), and stage-scoped filtering
- Fixed overnight sleep pairing — correct cross-midnight attribution with timezone-safe arithmetic; SAA computed on no-nap days

---
