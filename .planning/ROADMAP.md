# Roadmap: Nightwatch

## Milestones

- **[v1.0](milestones/v1.0-ROADMAP.md)** — 8 phases, 46 plans, 51/51 requirements, 495 tests; shipped 2026-06-30 (tag: `v1.0.0`)
- **[v1.1](milestones/v1.1-ROADMAP.md)** — 1 phase, 6 plans, 9/9 requirements, 635 tests; shipped 2026-07-10 (tag: `v1.1.0`)
- **[v1.2](milestones/v1.2-ROADMAP.md)** — 2 phases, 15 plans, 17/17 requirements; shipped 2026-08-24 (tag: `v1.2.0`)
- **[v1.3](milestones/v1.3-ROADMAP.md)** — 3 phases, prediction logic refinements + TIF extensions; shipped 2026-08-27
- **[v1.4](milestones/v1.4-ROADMAP.md)** — 4 phases, 8 plans, 11/11 requirements, 918 tests; shipped 2026-09-08

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–8) — SHIPPED 2026-06-30</summary>

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.1 UX Polish (Phase 9) — SHIPPED 2026-07-10</summary>

See [v1.1 archive](milestones/v1.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.2 Prediction & Metrics (Phases 10–11) — SHIPPED 2026-08-24</summary>

See [v1.2 archive](milestones/v1.2-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.3 Prediction & TIF Enhancements (Phases 12–14) — SHIPPED 2026-08-27</summary>

See [v1.3 archive](milestones/v1.3-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.4 TIF Fixes & Metrics Depth (Phases 15–18) — SHIPPED 2026-09-08</summary>

- [x] **Phase 15: TIF Engine Bug Fixes** — Correctness fixes for `findBedtimeDayRecord` latestAt ordering, rejected-day pre-filter semantics, redundant tifForecast render call, misleading comment, and stale test name (completed 2026-08-31)
- [x] **Phase 16: Rolling Window Aggregates** — 7-day and 14-day windowed stats across all Metrics screen columns (completed 2026-09-01)
- [x] **Phase 17: Day-of-Week Patterns** — Per-weekday averages for MA, AA, nap duration, and sleep duration in a collapsible Metrics section (completed 2026-09-02)
- [x] **Phase 18: Sleep Debt Proxy** — Rolling 7-day accumulated sleep deficit column in Metrics screen per-day table and aggregates (completed 2026-09-08)

See [v1.4 archive](milestones/v1.4-ROADMAP.md) for full phase details.

</details>

## Backlog

Deferred and future items are tracked in [BACKLOG.md](BACKLOG.md). Use `/gsd-review-backlog` to promote a backlog item to an active phase, or `/gsd-capture` to add a new item.
