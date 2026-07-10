# Nightwatch

## What This Is

Nightwatch is a vanilla-JS, offline-first web app for tracking a single subject's
sleep (night sleep + naps) and forecasting their next sleep events — next wake-up,
next bedtime, next nap start, next nap end — with explicit uncertainty handling
and prediction-accuracy scoring. It is seeded by an existing multi-month dataset
(see Context) and is intended to replace the manual spreadsheet workflow with
an app that updates predictions automatically as new events are logged.

The product is inspired in spirit by `../mindful-breathing` (vanilla HTML/CSS/JS,
no build, no dependencies, installable PWA, works offline), but the codebase is
deliberately split across multiple files for readability.

## Core Value

Given a sufficient history of sleep events, predict the next ones accurately
enough to be useful — and show the user, transparently, how accurate the
predictions have been over time. If the prediction is too uncertain to pin to a
single time, fall back to a probability band over a window.

If everything else fails, this must work: enter today's events, see tomorrow's
predicted wake/bed/nap times with bands, and check how yesterday's predictions
compared to reality.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Logging**
- [ ] Quick-log buttons that auto-timestamp now: "Woke up", "Going to sleep", "Nap start", "Nap end"
- [ ] Form-based entry for editing past days and back-filling
- [ ] All times captured/displayed at 5-minute precision
- [ ] Single nap per day (matches existing data shape)
- [ ] Day boundary is a configurable sleep-cycle cutover hour (default ~04:00) — one night = one day

**Subject & configuration**
- [ ] Single user-configurable subject profile (display name only — no multi-profile switching)
- [ ] Settings expose: max_delta, min_days-before-forecast, outlier rules (auto + manual per-day "rejected" flag), rolling-window length, stat blend (median / mean / blend), day-cutover hour, time format (24h default / 12h toggle)

**Prediction**
- [ ] Predict next four events: next wake, next bedtime, next nap start, next nap end
- [ ] Each prediction shows central time plus min/max band
- [ ] When the predicted ±delta exceeds the configured max_delta, fall back to a probability band over time (e.g. "P(asleep) by 22:30 = 65%, by 23:00 = 82%, …")
- [ ] Cold-start gate: predictions hidden until ≥ configured min_days of valid history exist
- [ ] Predictions update reactively whenever a new event is logged or a day is flagged/unflagged as outlier

**Screens (v1)**
- [ ] Today + forecast (landing page; next predicted events + probability bands + quick-log)
- [ ] History list (scrollable table of past days with edit/delete and a per-day "rejected/odrzucone" toggle)
- [ ] Charts + heatmap (sleep length over time; wake & sleep time bands; nap pattern; activity-vs-sleep correlation; calendar heatmap of sleep length)
- [ ] Accuracy dashboard (three success metrics: within max_delta, within tighter band ≤ max_delta/2, actual inside predicted min/max — shown side-by-side)

**Data lifecycle**
- [ ] File-as-truth storage: exported JSON is canonical; in-memory + localStorage acts as a cache
- [ ] Import CSV files matching the known column schema
- [ ] Import previously exported JSON (round-trip)
- [ ] Export structured JSON

**Stages**
- [ ] Manual stage boundaries — user marks date ranges as "stage X" (e.g. "dropped second nap"); forecast can scope to the current stage's data only

**Platform & distribution**
- [ ] Vanilla HTML/CSS/JS only — no frameworks, no build step, no package manager
- [ ] Multi-file architecture (HTML/CSS/JS split into separate files; not a single index.html)
- [ ] Installable PWA — works offline, works from `file://`, manifest + service worker
- [ ] Distributable via GitHub Pages (same target as mindful-breathing)
- [ ] UI language: English only
- [ ] Theme: calm but distinct — same overall tone as mindful-breathing (dark, minimal, ambient) but its own identity (different accent / different glyphs)
- [ ] Notifications: in-app only (a prominent "next event" card on the Today screen; no browser/OS push)
- [ ] App logic is unit-testable via Node's built-in `node:test` runner; tests live in `tests/unit/` and run separately from the deployed PWA bundle (excluded from service-worker precache and GitHub Pages output).
- [ ] Integration tests in `tests/integration/` compose multiple modules together in Node via thin adapters for DOM, `localStorage`, and the system clock; runtime stays zero-dependency.
- [ ] End-to-end UI tests via Playwright as a dev-only dependency (`devDependencies` only — never shipped to Pages); E2E tests in `tests/e2e/` drive a real headless browser. Same GitHub Action runs unit + integration + E2E on push/PR.
- [ ] TDD is the primary discipline: strict red→green→refactor for pure-logic and integration tests; UI code may be written test-after with at least one E2E test as a regression guard.

### Out of Scope

- **Multi-profile switching** — single subject in v1; multi-subject would change persistence shape. Defer to v2.
- **Multiple naps per day** — existing data has at most one nap/day; deferred to v2 to keep storage shape stable.
- **Auto-detected life stages** — change-point detection on sleep duration is statistically nontrivial. Manual stages in v1, auto suggestion in v2.
- **Browser / OS push notifications** — adds permission flows and a more complex service worker. v2.
- **Polish UI** — English only in v1; spreadsheet column names remain internal mapping concerns. Polish localization possible later.
- **Direct .xlsx import** — primary import paths are CSV (known schema) and JSON. The existing `sen.xlsx` will be one-time-converted to CSV (either via Excel "Save As CSV" or a small one-shot migration utility outside the runtime app). Why: a pure-vanilla, no-dependency app cannot read .xlsx without bundling a 200+ KB parser.
- **Backend / accounts / cloud sync** — offline-first, file-as-truth, no server.
- **Frameworks / build tooling / npm dependencies** — explicit constraint inherited from `../mindful-breathing`.

## Context

**Existing dataset (`sen.xlsx`):** The user has accumulated daily sleep tracking data in a two-sheet spreadsheet authored in Polish. Translated column schema:

*Sheet 1 "Dane" (Daily log):* `Data` (date), `Pobudka` (wake-up), `Zaśnięcie` (bedtime), `Drzemka start/stop` (nap start/end), `Długość drzemki` (nap length), `Długość dnia` (day length = awake time), `Aktywność` (activity), `Od drzemki` (time since nap), plus per-row rolling/aggregate columns: `średnia`/`mediana` (mean/median), `min`/`max`, `Długość snu` (sleep length) with variants `z drzemką` (with nap) and `z dnia kolejnego` (carrying to next day), and `Aktywność/Sen z 2/3/4 dni` (2-, 3-, 4-day rolling activity & sleep), `odrzucone` (rejected — manual outlier flag).

*Sheet 2 "Prognoza" (Forecast):* Predicted events `wstał`, `zasnął`, `początek/koniec drzemki` each with `min`/`max` bands; per-event deltas vs actual `pobudka delta`, `sen delta`, `drzemka delta`, `przebudzenie delta`; plus `etap` (stage), `drzemka była?` (was there a nap?), and `mediana & średnia` blend.

This schema is the source of truth for the app's data model. Nightwatch effectively automates and improves on the manual spreadsheet workflow.

**Reference app (`../mindful-breathing`):** Single-file vanilla-JS PWA. Demonstrates the offline + service worker + localStorage + Web APIs pattern Nightwatch will follow. Lives at `https://bielinskilukasz.github.io/mindful-breathing/`. Key takeaways: no build pipeline, no dependencies, works from `file://`, `Object.freeze` config, `requestAnimationFrame` loops, secure-context-only browser APIs.

**Planning artifact preference:** The user wants the planning output structured as separate Markdown files covering user flow, releases, epics, features, user stories, non-technical requirements, and technical tasks. The GSD pipeline maps to this naturally: PROJECT.md (context + non-functional constraints), REQUIREMENTS.md (features + user stories), ROADMAP.md (releases / epics as phases), per-phase PLAN.md (technical tasks). User flow can live inside REQUIREMENTS.md or as a sibling document depending on the roadmap's shape.

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS only — No frameworks, no transpilers, no npm dependencies, no build step. Same constraint as `../mindful-breathing`.
- **File structure**: Multi-file — Split HTML/CSS/JS into separate files for clarity, unlike mindful-breathing's single-index.html constraint.
- **Persistence**: Browser-native only — localStorage for cache, File API (download/upload) for canonical JSON export/import. No backend, no IndexedDB if avoidable for v1.
- **Distribution**: Static hosting only — Must work on GitHub Pages and from local `file://`; no server-side code.
- **Offline-first**: PWA — Service worker for asset caching; full functionality without network.
- **Time precision**: 5-minute rounding — Both at entry and display; matches typical human entry behavior and the spreadsheet's effective precision.
- **Language**: English UI only — v1; Polish column names live in import/migration code only.
- **Browser support**: Modern evergreen — Chrome/Edge/Firefox/Safari current versions. Same matrix as mindful-breathing.
- **Runtime dependencies**: Zero — `package.json` may exist for `devDependencies` only (Playwright + lockfile). The deployed PWA bundle (everything served from GitHub Pages) contains no `node_modules/`, no bundled libraries, no runtime npm imports.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Working title "Nightwatch" | User picked from a shortlist; evokes observation + prediction, distinct from "Sleep Tracker" | — Pending |
| Single configurable subject (no multi-profile in v1) | Multi-profile changes persistence shape and routing; deferring keeps v1 focused | — Pending |
| File-as-truth storage (JSON export = canonical, localStorage = cache) | User explicitly preferred treating the exported file as the source of truth; survives browser data clears | — Pending |
| Sleep-cycle day boundary, configurable, default ~04:00 | One night = one day; avoids splitting a single sleep across two calendar dates | — Pending |
| Multi-file vanilla JS, no build | Inherit mindful-breathing's no-dependency philosophy but split for readability since this app is structurally larger | — Pending |
| Probability-band fallback on high uncertainty | When ±delta > max_delta, show `P(event)` curve over time instead of a single point — surfaces uncertainty honestly | — Pending |
| All four v1 screens (Today, History, Charts+heatmap, Accuracy) | User selected all four explicitly | — Pending |
| Manual stages in v1, auto-detection in v2 | Change-point detection is statistically nontrivial; defer until manual workflow proves value | — Pending |
| 24h default, 12h toggle in Settings | Matches Polish convention and the existing spreadsheet | — Pending |
| 5-minute precision | Cleaner stats; matches typical entry behavior | — Pending |
| Three success metrics on the Accuracy dashboard | User wanted all three (within max_delta / within tighter band / inside probability band) shown side-by-side | — Pending |
| Direct .xlsx import not in v1 | A pure-vanilla, no-dependency app cannot parse .xlsx without bundling a heavy library; user converts to CSV one-time | — Pending |
| Unit tests via Node's built-in `node:test`, runtime stays dependency-free | Tests are dev-time only; logic structured as ESM modules so the same files import in both browser (`<script type="module">`) and Node. Unit tests live under `tests/unit/`, excluded from PWA precache. CI uses zero-install `node --test`. | — Pending |
| Integration tests in Node via DOM/storage/clock adapters | App structured with thin adapters so modules can be composed and exercised together in Node without a real browser. Drives clean seams from Phase 1 onward. Zero npm dependency. Lives under `tests/integration/`. | — Pending |
| Playwright for end-to-end UI tests, dev-only dependency | E2E coverage via a real headless browser; runtime app remains pure-vanilla with zero runtime dependencies. Playwright in `devDependencies`, `tests/e2e/` excluded from PWA bundle, GH Action installs Playwright and runs the suite alongside unit + integration. | — Pending |
| Test-Driven Development (TDD) is the primary development discipline | Strict red→green→refactor for pure-logic and integration tests; UI code may be written test-after with one E2E test as a regression guard. Every shipped requirement has at least one automated test. Plans split into 'write test' → 'implement' subtasks where it makes sense. | — Pending |

## Current State (v1.1 — shipped 2026-07-10)

Nightwatch v1.1 is complete and tagged `v1.1.0`. All 9 v1.1 requirements delivered across 1 phase in 10 days. Building on the v1.0 PWA foundation, v1.1 reduced daily logging friction and improved visual clarity:

- **History edit-mode toggle**: Edit/delete/rejected controls hidden by default; "Edit history" button reveals them; state resets on tab switch
- **Confirm-before-logging**: New toggle in Time & Day settings; when ON, quick-log buttons open the manual-entry dialog pre-filled with current time + event type
- **Save more button**: Bulk entry — saves event, keeps dialog open, advances type through Wake → Nap start → Nap end → Bedtime → Wake (date increments after Bedtime)
- **Prediction card collapse**: Probability-band cards collapsed to compact single-line summary by default; tap to expand
- **Today screen clarity**: "Add event" button above prediction cards; hero card shows "Next Predicted Event" label
- **Test quality**: 635 tests (531 unit/integration + 104 E2E), 0 failures; probability-band E2E rewritten with 32-day 4-type fixture

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`

<details>
<summary>v1.0 — shipped 2026-06-30</summary>

Nightwatch v1.0 tagged `v1.0.0`. All 51 v1 requirements delivered across 8 phases in 35 days:

- **Logging**: 4 quick-log buttons, manual entry/edit/delete, 5-min precision, subjective-night grouping
- **Settings**: subject name, max_delta, min_days, rolling window, stat blend, cutover hour, time format
- **Forecast**: 4-event predictions with min/max bands, probability-band fallback, cold-start gate, reactive updates
- **History**: scrollable table, per-row edit/delete, "rejected" outlier toggle
- **Import/Export**: CSV + JSON import, JSON export, file-as-truth storage model
- **Life stages**: named date ranges, CRUD in Settings, scope-to-stage forecast
- **Charts + Accuracy**: 5 SVG visualizations + 3-metric accuracy dashboard + bottom-nav
- **PWA**: manifest + SW + offline + file:// support + GitHub Pages deploy + 495-test TDD scaffold

Archive: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`
</details>

## Requirements

v1.0 requirements archived to `.planning/milestones/v1.0-REQUIREMENTS.md`.  
v1.1 requirements archived to `.planning/milestones/v1.1-REQUIREMENTS.md`.  
Next milestone requirements defined via `/gsd-new-milestone`.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-10 — v1.1 milestone archived*
