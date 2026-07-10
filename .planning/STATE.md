---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: UX Polish
current_phase: 09
current_phase_name: "Phase 9: UX Polish"
status: planned
stopped_at: Phase 9 plans created (09-01 through 09-06)
last_updated: "2026-07-10T09:59:55.192Z"
last_activity: 2026-07-10
last_activity_desc: Phase 9 plans written (6 plans, 3 waves)
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 6
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-26)

**Core value:** Given a sufficient history of sleep events, predict the next wake/bed/nap times accurately enough to be useful, with explicit uncertainty handling and prediction-accuracy scoring.

**Current focus:** Phase NW-09 — ux-polish

## Current Position

Phase: NW-09 (Phase 9: UX Polish)
Plan: 09-01 through 09-06 (all created)
Status: Planning complete — ready for /gsd-execute-phase 9
Last activity: 2026-07-10 — Phase 9 plans written (6 plans, 3 waves)

Progress bar: [          ] 0% (0/1 phases complete)

### Phase NW-09 scope

Requirements: LOG-10, LOG-11, CFG-10, UI-07, UI-08, UI-09, UI-10, PLAT-12, PLAT-13

Files in scope:

- js/ui/today-screen.js — "Add event" button reposition (UI-08), hero label (UI-10), card collapse (UI-09)
- js/ui/history-screen.js — edit-mode toggle (UI-07)
- js/ui/manual-entry.js — "Save more" button (LOG-11), confirm-before-logging pre-fill (LOG-10)
- js/ui/settings-modal.js — "Confirm before logging" toggle (CFG-10)
- js/store/settings.js — DEFAULT_SETTINGS for confirmBeforeLogging key (CFG-10)
- tests/e2e/forecast.spec.js — probability-band fixture rewrite (PLAT-12)
- nw-research-test/ — removal (PLAT-13)

## Accumulated Context

### Decisions

Key decisions logged in PROJECT.md. Recent phase-specific decisions:

- Phase 1 (Log & Persist): Start with minimal logging UI + localStorage only; defer PWA until Phase 8 to unblock dogfooding
- Phases 1–4 foundation: All logic before import/export (Phase 5) to ensure data shape is validated in use
- [Phase 04]: Plan 04-01: Option A for rejection storage: list of date strings in settings.rejectedDays (not event-property-based). Leverages existing settings-store subscription pattern.
- [Phase 04]: Plan 04-01: day.rejected is derived at render time from settings.rejectedDays.includes(day.date) — never stored on event objects (D4-14). Keeps canonical source singular.
- [Phase 04]: Plan 04-02: mountHistoryScreen root is div#history-table-root (inner); section#history-screen toggled by applyTabVisibility() — clean separation between content and visibility
- [Phase 04]: Plan 04-02: Column order Date|Wake|Nap Start|Nap End|Bedtime|Rejected|Actions (reordered from original plan after checkpoint UX feedback for time-of-day flow)
- [Phase 04]: Plan 04-03: Per-event [Edit] buttons co-located inside time cells; per-row [Delete] in Actions column — consistent with D4-04/D4-06
- [Phase 04]: Plan 04-04: Rejected checkbox uses .checked + data-date + Set deduplication before settings.update() — defensive against duplicate dates from external sources
- [Phase 04]: Plan 04-04: Security audit confirms T-04-04 MITIGATED: 0 innerHTML assignments in history-screen.js; 11 textContent usages for all dynamic values
- Phase 8 PWA hardening: Hold all platform/manifest/service-worker work until end to avoid rework if data model shifts early
- [Phase ?]: Plan 01-02: round-to-nearest 5-min via Math.round per Assumption A1 (RESEARCH Pitfall #1)
- [Phase ?]: Plan 01-02: parseLocalISO typeof guard — null/non-string inputs throw the same descriptive Error (T-02)
- [Phase ?]: Plan 01-02: subjective-night cutover boundary is hour < cutoverHour → previous day; at-or-after = current
- [Phase ?]: Plan 01-02: LOG-09 read-side enforcement via dayRecord.extraNaps (RESEARCH Open Question #1)
- [Phase ?]: Plan 01-03: Static no-JS button skeleton in index.html + JS replaceChildren on mount — satisfies both grep gate and render directive
- [Phase ?]: Plan 01-03: UI debounce uses performance.now() (non-domain monotonic clock) — keeps clock-adapter seam clean (D-07)
- [Phase ?]: Plan 01-03: DEFAULT_CUTOVER_HOUR=4 named constant on store.daysBySubjectiveNight default arg documents Phase 2 / CFG-08 injection seam
- [Phase ?]: Plan 01-04: formnovalidate on Save button + JS-level required+range guards in onClose — reconciles HTML5 step=5 with Open Question #2 silent-rounding contract
- [Phase ?]: Plan 01-04: explicit mode=add|edit parameter at openManualEntry entry — Pitfall #6 / T-05 architectural mitigation at UI layer (paired with events[i]=next mutate-in-place at store layer)
- [Phase ?]: Plan 01-04: D-03 mutate-in-place verified at 4 layers — UI mode param, store events[i]=next, integration test events.length===1, E2E test edit-no-duplicate + reload-persistence
- [Phase 01]: Plan 01-05: createStorageLocal refactored to accept optional ls parameter (defaults to globalThis.localStorage) — backward-compatible test-injection seam without polluting globals
- [Phase 01]: Plan 01-05: security-smoke exemption tag honored on matching line OR immediately preceding line (eslint-disable-next-line convention) — matches Plan 04's // gsd:allow-ui-clock placement
- [Phase 01]: Plan 01-05: two-layer supply-chain guard — in-tree smoke (security-smoke.test.js dependencies==={}) + CI fail-fast step before node --test — observable in source AND PR rejection in seconds
- [Phase 01]: Plan 01-05: clock-seam invariant bans no-arg new Date() only (allows new Date(x) data transforms) — natural seam between side-effecting clock reads and pure data transforms
- [Phase 01]: Plan 01-06: nap-budget-per-day = 2 (BUCKET_CONFIG.napBudgetPerDay named constant) — the user-facing render policy; named slots dayRecord.napStart/.napEnd stay singular so Phase 3+ forecast contract is unchanged
- [Phase 01]: Plan 01-06: extra:true is a runtime-only annotation on overflow nap entries via shallow copy `{ ...evt, extra: true }` — never mutates the input events array, never leaks into the canonical D-04 wire format on disk
- [Phase 01]: Plan 01-06: renderer single-iterates day.allEvents; compound className 'event extraNap' (both classes) keeps overflow rows actionable AND faint; renderExtraNapRow helper deleted entirely — single source of truth for "what to render" closes UAT gap 4 BLOCKER
- [Phase 01]: Plan 01-08: EVENT_LABEL derived from BUTTONS via Object.fromEntries at module load — single source of truth for type→label mapping closes UAT gap 1 (label SSOT). BUTTONS + labelFor exported so the integration test pins parity at the module API layer (vs. duplicating the 4-entry table in test code — explicitly forbidden by gap-1 remediation). D-04 wire format unchanged on disk.
- [Phase 07]: Plan 07-02: accuracy.total increments for every day with actual event and non-cold-start forecast, even when no prediction exists for that event type
- [Phase 07]: Plan 07-05: mountChartsScreen uses svgText/createChartSvg helpers with explicit createElementNS for textContent security
- [Phase 07]: Plan 07-05: getActivityLog added to eventLog store as defensive getter for db.activityLog (D5-17)
- [Phase 07]: Plan 07-06: Playwright selectors scoped to parent screen ID to avoid strict-mode violations
- [Phase 07]: Plan 07-06: filterDayRecordsByStage three-arg call enforced; null activeStageId returns allDays unchanged
- [Phase 08]: sw.js at root gives full scope
- [Phase 08]: PRECACHE_LIST 31 entries, test adapters excluded, sw.js excluded (browser handles SW byte-comparison)
- [Phase 08]: PNG icon placeholders committed; crescent-moon design deferred to pre-release
- [Phase 08-03]: showScreen() as function declaration for hoisting — allows applyTabVisibility() to call it before Phase 8 block in source order
- [Phase 08-03]: SW guard uses 'serviceWorker' in navigator AND location.protocol !== 'file:' — prevents SecurityError on file:// (T-08-03-02)
- [Phase 08-03]: body.has-update-banner on <body> by showUpdateBanner() — 40px padding-top prevents fixed banner overlapping header
- [Phase 08-05]: gsd:allow-storage-local exemption tag added to security-smoke.test.js — mirrors gsd:allow-ui-clock clock-seam pattern for file:// note dismiss state in app.js
- [Phase ?]: UI-07: editMode local state in mountHistoryScreen resets on each remount; toolbar renders unconditionally; edit controls gated behind editMode param in buildDayRow

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

**Resume file:** .planning/phases/NW-09-ux-polish/09-01-PLAN.md

Last session: 2026-07-10T09:58:20.570Z
Stopped at: Phase 9 plans created
Resume: /gsd-execute-phase 9

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase NW-09 P02 | 15 | - tasks | - files |
