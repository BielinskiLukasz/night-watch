# Phase 1: Log & Persist - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 1-Log & Persist
**Areas discussed:** Testing strategy (out-of-band project-wide), Data model & storage schema, Module layout & adapter seams, Today screen UX & manual entry, Day-boundary log-time behavior

---

## Testing strategy (project-wide; raised by user mid-discussion)

The user surfaced testing as a project-wide concern before the standard gray-area presentation. Three sub-questions handled before returning to phase 1 gray areas.

### Sub-question A: Unit testing approach

| Option | Description | Selected |
|--------|-------------|----------|
| Add PLAT-08 + adopt now | Add unit-testable-logic via node:test as PLAT-08; Phase 1 establishes the pattern; CI deferred to Phase 8 | ✓ |
| Project decision, no REQ | Lock testing as a Key Decision in PROJECT.md without a numbered requirement | |
| Defer to Phase 3 | Phase 1 too simple; lock when prediction math lands | |
| Skip formal tests | Rely on dogfooding + manual smoke tests only | |

### Sub-question B: Test layout & CI

| Option | Description | Selected |
|--------|-------------|----------|
| tests/ + node:test, no CI | Local-only; defer CI to Phase 8 | |
| tests/ + node:test + CI | Plus a tiny GH Action on push/PR; zero install | ✓ |
| In-browser test page | Separate tests.html; no CI without headless browser | |

### Sub-question C: Integration tests?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Node-based, zero-dep | Adapter pattern, tests/integration/, node:test | ✓ |
| Skip — unit + UI is enough | Lean on unit + E2E, no middle layer | |
| Decide later (Phase 3) | Defer until prediction logic | |

### Sub-question D: UI / E2E tests?

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright as dev-only dep | Real browser, devDependencies only, app bundle stays vanilla | ✓ |
| Hand-rolled tests.html smoke page | Zero npm, but no CI | |
| Manual smoke-test checklist | Cheapest, no automation | |
| Defer to Phase 8 | No UI tests until PWA hardening | |

### Sub-question E: TDD rigor?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict TDD for logic, lighter for UI | Red→green→refactor for pure logic + integration; UI test-after with E2E regression guard | ✓ |
| Tests-first, but pragmatic | Test-first for non-trivial logic, write-first allowed for thin glue | |
| Tests required, order flexible | Every behavior tested; test-first or test-after per task | |

**Outcome:** Four new requirements added to REQUIREMENTS.md (PLAT-08 unit, PLAT-09 integration, PLAT-10 E2E/Playwright, PLAT-11 TDD discipline). All mapped to Phase 1. Committed as `docs: add testing strategy (PLAT-08/09/10/11) for TDD` (9a1fe23).

**Notes:** User also asked whether IndexedDB was feasible on GitHub Pages without a backend. Confirmed: yes, but unnecessary at v1's data scale; localStorage chosen with adapter seam left open for future migration.

---

## Data model & storage schema

### Sub-question A: Canonical data model shape

| Option | Description | Selected |
|--------|-------------|----------|
| Day-record (matches sen.xlsx) | One row per day with wake/bed/nap fields; mutate-on-edit; loses event-level history | |
| Event-log (append-only) | Append-only stream of typed events; day records derived; richer history; harder CSV mapping | ✓ |
| Hybrid: events + materialized days | Both, with events as source of truth and days as derived view; most ceremony | |

### Sub-question B: localStorage partitioning

| Option | Description | Selected |
|--------|-------------|----------|
| Single key, whole DB | One key `nightwatch:db`, full JSON blob; simplest; fits 10 years in <2 MB | ✓ |
| Day-indexed keys + metadata | One key per day plus a metadata key; avoids re-serializing on every write; more code, more failure modes | |
| IndexedDB | Higher capacity, async, transactional; PROJECT.md defers; user asked separately and chose to keep localStorage | |

### Sub-question C: Edit / delete representation

| Option | Description | Selected |
|--------|-------------|----------|
| Mutate in place (simplest) | Edit rewrites `at`; delete removes from array; no audit trail | ✓ |
| Append-only with correction events | Add `correction` / `delete` events; original events never modified | |
| Soft delete + edit history | `deletedAt`, `editedAt`, `history[]` on each event | |

**Notes:** User initially picked "Event-log" but requested clarification before answering the partitioning and mutation questions. Clarification provided on (a) how event-log → day-bucketer pipeline works, (b) CSV import mapping (Phase 5 expands each row into 4 synthetic events), (c) how single-blob still works for an event log given size budget. User then confirmed and proceeded.

---

## Module layout & adapter seams

| Option | Description | Selected |
|--------|-------------|----------|
| Layered: lib / store / adapters / ui | js/lib/, js/store/, js/adapters/, js/ui/, js/app.js as composition root; clear testing-pyramid mapping | ✓ |
| Flat modules, adapters inline | Single js/ folder; adapters inline; looser seams | |
| By feature, not by layer | js/logging/, js/persistence/ etc.; scales for large apps; overkill here | |

**Notes:** User picked layered without further questioning. Confirmed adapter interfaces (D-07) are minimal — load/save for storage, now() for clock — and instantiated only at composition root (`js/app.js`).

---

## Today screen UX & manual entry

### Sub-question A: Phase 1 single-screen layout

| Option | Description | Selected |
|--------|-------------|----------|
| Today + last N days, all editable | One scrollable screen, day-grouped, inline edit/delete; Phase 4 adds proper History without throwing this away | ✓ |
| Today only; full event log below | Two clear sections: today + flat reverse-chronological log; no day grouping until Phase 4 | |
| Today only; backfill via form, no past edits in v1 | Strict minimum; editing past events deferred to Phase 4 | |

### Sub-question B: Manual entry / edit surface

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Opens overlay; doesn't disturb list; standard pattern | ✓ |
| Inline expand-in-place | Row turns into editable fields; layout shifts | |
| Dedicated route/page | Separate page for entry/edit | |

### Sub-question C: Time-picker style

| Option | Description | Selected |
|--------|-------------|----------|
| Native `<input type="time">` + 5-min step | Browser-native; inconsistent `step` support across browsers | |
| Two number inputs (HH and MM) | Full control; consistent across browsers; minute steps by 5 | ✓ |
| Custom dropdown picker | Maximum design control; maximum code; overkill | |

**Notes:** User rejected native `<input type="time">` in favor of two number inputs — likely to avoid the Chromium/Firefox/Safari inconsistency on `step` values and to keep the time picker render fully under app control.

---

## Day-boundary log-time behavior

### Sub-question A: Timestamp storage given cutover hour

| Option | Description | Selected |
|--------|-------------|----------|
| Wall-clock `at`, day derived on read | Store ISO timestamp; bucketer applies cutover at read time; single source of truth | ✓ |
| Store both `at` and explicit `day` | Faster reads; migration risk if cutover changes | |
| Store only `day` + HH:MM (no full timestamp) | Match spreadsheet shape; loses precision | |

### Sub-question B: How the UI labels "today" near the cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Show subjective-day label + small hint | Header reads subjective night with tooltip explaining cutover | |
| Show subjective-day only, no hint | Same labeling without explanation | |
| Show calendar date always | Header always matches the calendar; data model still uses cutover internally for forecasts | ✓ |

### Sub-question C: Default list window length

| Option | Description | Selected |
|--------|-------------|----------|
| Last 7 days | One week of context, fits one scrollable screen | ✓ |
| Last 3 days | Minimal context; less scroll | |
| Last 14 days | Two weeks; more scroll | |
| All days (full log) | Scales poorly past months | |

**Notes:** User's choice of "show calendar date always" creates two parallel day-concepts in the system (calendar-day for UI, subjective-night for forecasts). Documented explicitly in CONTEXT.md D-08, D-11, D-16 so the planner does not conflate them.

---

## Claude's Discretion

- Event `id` minting scheme (planner picks `crypto.randomUUID()` or a counter)
- Exact CSS / visual styling of buttons, list rows, and modal (theming lands in Phase 8)
- Concrete file names within sub-folders beyond what's specified in D-06
- Whether `tests/integration/` uses a shared `makeTestApp()` helper or per-test wiring

## Deferred Ideas

- Configurable cutover hour as a Settings field (Phase 2 CFG-08)
- Audit trail / undo for edits (v2 candidate; mutate-in-place chosen for v1)
- Configurable list-window length on Today screen (Phase 2 candidate)
- Cutover-hour explainer tooltip (Phase 2 candidate)
- Service worker, manifest, `file://` hardening, GH Pages deploy, custom theme (Phase 8)
- CSV import → event-log expansion logic (Phase 5)
- Auto outlier detection logic (Phase 2 toggle, likely Phase 3 implementation)
- IndexedDB migration (only if dataset crosses ~3 MB)
