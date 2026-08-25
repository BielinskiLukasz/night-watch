# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.2 — Prediction & Metrics

**Shipped:** 2026-08-24  
**Phases:** 2 | **Plans:** 15 | **Timeline:** 45 days (2026-07-10 → 2026-08-24)

### What Was Built

- `js/lib/metrics.js` — 6 duration/ratio helpers shared by TIF algorithm and Metrics screen; cornerstone of Phase 11
- TIF forecast algorithm (`js/lib/forecast-tif.js`) — percentile trim, multi-source window intersection (2–3 windows per event type), precision scoring, and precision-target narrowing
- TIF settings sub-section in Settings modal with algorithm toggle, trim %, and precision target; full persistence via existing db-shape.js schema extension
- TIF Today screen rendering — normal card (always-expanded, precision badge), low-confidence card (collapsible, union fallback, source windows list), hero card precision badge
- Metrics screen — 5th bottom-nav tab with per-day sleep/nap/activity durations, AAS/SAA ratio metrics, historical aggregates, stage filter, sticky header/column layout
- Gap-closure work: overnight sleep pairing across calendar midnight; SAA computation on no-nap days; CSS sticky-header fix; button reordering; column order correction

### What Worked

- **Shared module pattern** — building `metrics.js` as the first plan in Phase 10 meant Phase 11 inherited clean, tested helpers for free. Zero duplication between TIF duration bands and Metrics screen calculations.
- **Additive TIF design** — keeping Classic as the default and TIF as an opt-in meant zero risk to existing behavior. The conditional branch in `today-screen.js` is the only integration point.
- **TDD discipline** — 9 unit + 9 integration TIF tests caught edge cases (cold-start gate, rejected-day budget, empty intersection) before any UI wiring. Phase 11 gaps (overnight pairing, SAA no-nap) were each diagnosed and closed with a failing test first.
- **Phase 11 gap-closure loop** — 7 extra plans executed after the initial 3-plan Phase 11 because the design revealed real-world data issues (missing nap days, overnight boundaries). Each gap was small, well-scoped, and closed atomically.

### What Was Inefficient

- **Planning artifact drift** — Phase 10 REQUIREMENTS.md traceability and ROADMAP.md progress row were not updated as plans completed; required a dedicated quick task on 2026-08-24 to fix. The milestone audit correctly caught this as a gap, but the fix was pure admin with no user value.
- **Phase 11 underestimation** — initial Phase 11 scope was 3 plans; actual execution required 10 (7 gap-closure plans). The overnight sleep pairing and AAS/SAA formula complexity were not fully anticipated during planning. Better up-front data audit could have surfaced these.

### Patterns Established

- **metrics.js as shared dependency** — pure math module consumed by both forecast and display layers; follow this pattern for any future shared computation (e.g., accuracy scoring extensions).
- **settings extension via db-shape.js DEFAULT_SETTINGS** — adding new settings fields follows a documented zero-migration additive pattern; works cleanly for algorithm toggles and numeric controls.
- **Gap-closure plans are normal** — Phase 11's 7 extra plans represent real-world complexity discovery, not planning failure. Budget for a 2–3× plan multiplier when a phase touches real user data for the first time.

### Key Lessons

1. **Update traceability tables at plan completion, not at phase close** — REQUIREMENTS.md checkbox updates should be part of each plan's commit, not deferred to the end of the phase. Deferred updates require a dedicated correction pass.
2. **Profile the real dataset before planning data-display phases** — overnight boundary crossings, no-nap days, and missing-anchor edge cases in `sen.xlsx` drove most of Phase 11's extra plans. A 30-minute data audit before planning would have scoped them correctly.
3. **Shared pure-math modules pay off fast** — `metrics.js` was a 1-plan investment that eliminated all duplication in both its consumers. When two features share mathematical definitions, extract the module first.

### Cost Observations

- Model mix: primarily Sonnet; Haiku used for integration checker
- Sessions: multi-session over 45 days
- Notable: Phase 11 gap-closure loop was efficient — each extra plan was atomic and < 30 min; no rework of earlier plans required

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 8 | 46 | Foundation — TDD scaffold established, adapter injection pattern locked in |
| v1.1 | 1 | 6 | First UX-only milestone — quick-log friction reduction without touching core logic |
| v1.2 | 2 | 15 | First algorithm milestone — shared module pattern emerged; gap-closure loop normalized |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions | Tech Debt at Close |
|-----------|-------|-------------------|-------------------|
| v1.0 | 495 | 0 | 0 markers |
| v1.1 | 635 | 0 | 0 markers |
| v1.2 | 647+ | 0 | 0 markers |

### Top Lessons (Verified Across Milestones)

1. **Adapter injection pays compound interest** — the storage/clock seam set up in Phase 1 of v1.0 made every test in v1.1 and v1.2 trivially fast and deterministic, with no additional seam work needed.
2. **Gap-closure plans are a feature, not a failure** — real-world data always reveals edge cases not visible during planning. Keeping plans small and atomic (< 3 tasks each) makes gap closure cheap.
3. **Zero runtime dependencies enforced itself** — the constraint never required active enforcement; the adapter pattern and pure-function lib/ layer made external dependencies unnecessary.
