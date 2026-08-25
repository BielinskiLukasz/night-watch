# Milestones

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
