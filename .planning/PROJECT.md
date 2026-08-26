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

**v1.0 — Core application (shipped 2026-06-30)**
- ✓ Quick-log buttons that auto-timestamp now: "Woke up", "Going to sleep", "Nap start", "Nap end" — v1.0
- ✓ Form-based entry for editing past days and back-filling — v1.0
- ✓ All times captured/displayed at 5-minute precision — v1.0
- ✓ Single nap per day (matches existing data shape) — v1.0
- ✓ Day boundary is a configurable sleep-cycle cutover hour (default ~04:00) — v1.0
- ✓ Single user-configurable subject profile (display name only) — v1.0
- ✓ Settings: max_delta, min_days, outlier rules, rolling window, stat blend, cutover hour, time format — v1.0
- ✓ Predict next four events (wake, bed, nap start, nap end) with central time + min/max band — v1.0
- ✓ Probability-band fallback when ±delta exceeds max_delta — v1.0
- ✓ Cold-start gate — v1.0
- ✓ Reactive prediction updates on event log/flag changes — v1.0
- ✓ Today + forecast screen — v1.0
- ✓ History list with edit/delete and per-day rejected toggle — v1.0
- ✓ Charts + heatmap (5 SVG visualizations) — v1.0
- ✓ Accuracy dashboard (3 success metrics) — v1.0
- ✓ File-as-truth storage (JSON canonical, localStorage cache) — v1.0
- ✓ CSV + JSON import, JSON export — v1.0
- ✓ Manual stage boundaries with scope-to-stage forecast — v1.0
- ✓ Vanilla HTML/CSS/JS, multi-file architecture, installable PWA, GitHub Pages — v1.0
- ✓ TDD scaffold: unit + integration + E2E via node:test + Playwright — v1.0

**v1.1 — UX Polish (shipped 2026-07-10)**
- ✓ History edit-mode toggle (controls hidden by default, revealed on tap) — v1.1
- ✓ Confirm-before-logging setting (pre-filled dialog on quick-log tap) — v1.1
- ✓ "Save more" bulk-entry button (keeps dialog open, auto-advances event type) — v1.1
- ✓ Probability-band cards collapsed by default (compact single-line summary) — v1.1
- ✓ Today screen clarity: "Add event" button above prediction cards, hero card label — v1.1
- ✓ Forecast E2E rewritten with 32-day 4-type fixture — v1.1

**v1.2 — Prediction & Metrics (shipped 2026-08-24)**
- ✓ TIF algorithm opt-in toggle (forecastAlgorithm: classic | tif) persists across sessions — v1.2
- ✓ TIF trim % (0–40) and precision target (minutes) settings with full persistence — v1.2
- ✓ TIF wake/bed/nap predictions from multi-source window intersection with precision scoring — v1.2
- ✓ TIF low-confidence fallback to union range when intersection is empty — v1.2
- ✓ TIF window narrowing to precision target; original range and score remain visible — v1.2
- ✓ Metrics screen — dedicated 5th bottom-nav tab — v1.2
- ✓ Per-day sleep/nap/activity duration metrics — v1.2
- ✓ AAS and SAA ratio metrics with no-nap-day computation — v1.2
- ✓ Historical aggregates (avg, min with date, max with date) for all metrics — v1.2
- ✓ Stage-scoped Metrics filtering — v1.2

## Current Milestone: v1.3 Prediction & TIF Enhancements

**Goal:** Refine the classic and TIF forecasting engines with contextual rules and ratio-based windows, and extend the Metrics + Accuracy screens to surface TIF-specific data.

**Target features:**
- Prediction logic refinements: time-based bedtime rule, duration-based prediction, intense-day flag, missing-nap impact on bedtime
- TIF algorithm extensions: ratio-based windows (activity/sleep → nap-start, activity/nap → nap-end), rolling windows + MA/AA preference
- TIF metrics & accuracy: TIF accuracy screen, replace SAA with day/sleep factor, TIF window bounds on Metrics screen, nap-fraction + AM/PM split columns

### Active

- [x] Phase 12 — Prediction logic refinements (B-004, B-005, B-006, B-007) — Complete 2026-08-26
- [ ] Phase 13 — TIF algorithm extensions (B-033, B-037)
- [ ] Phase 14 — TIF metrics & accuracy (B-031, B-034, B-035, B-036)

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
| Working title "Nightwatch" | User picked from a shortlist; evokes observation + prediction, distinct from "Sleep Tracker" | ✓ Good — name stuck through 3 milestones |
| Single configurable subject (no multi-profile in v1) | Multi-profile changes persistence shape and routing; deferring keeps v1 focused | ✓ Good — constraint held cleanly |
| File-as-truth storage (JSON export = canonical, localStorage = cache) | User explicitly preferred treating the exported file as the source of truth; survives browser data clears | ✓ Good — no issues in practice |
| Sleep-cycle day boundary, configurable, default ~04:00 | One night = one day; avoids splitting a single sleep across two calendar dates | ✓ Good — timezone-safe string-slice approach proved robust (v1.2 overnight pairing) |
| Multi-file vanilla JS, no build | Inherit mindful-breathing's no-dependency philosophy but split for readability since this app is structurally larger | ✓ Good — 264 files managed cleanly without bundler |
| Probability-band fallback on high uncertainty | When ±delta > max_delta, show `P(event)` curve over time instead of a single point — surfaces uncertainty honestly | ✓ Good — TIF adds a second fallback path (low-confidence union range) |
| All four v1 screens (Today, History, Charts+heatmap, Accuracy) | User selected all four explicitly | ✓ Good — all shipped; Metrics added as 5th in v1.2 |
| Manual stages in v1, auto-detection in v2 | Change-point detection is statistically nontrivial; defer until manual workflow proves value | ✓ Good — manual stages used actively in v1.2 Metrics screen |
| 24h default, 12h toggle in Settings | Matches Polish convention and the existing spreadsheet | ✓ Good |
| 5-minute precision | Cleaner stats; matches typical entry behavior | ✓ Good |
| Three success metrics on the Accuracy dashboard | User wanted all three (within max_delta / within tighter band / inside probability band) shown side-by-side | ✓ Good |
| Direct .xlsx import not in v1 | A pure-vanilla, no-dependency app cannot parse .xlsx without bundling a heavy library; user converts to CSV one-time | ✓ Good |
| Unit tests via Node's built-in `node:test`, runtime stays dependency-free | Tests are dev-time only; logic structured as ESM modules so the same files import in both browser (`<script type="module">`) and Node. Unit tests live under `tests/unit/`, excluded from PWA precache. CI uses zero-install `node --test`. | ✓ Good — suite grew to 647+ unit/integration tests |
| Integration tests in Node via DOM/storage/clock adapters | App structured with thin adapters so modules can be composed and exercised together in Node without a real browser. Drives clean seams from Phase 1 onward. Zero npm dependency. Lives under `tests/integration/`. | ✓ Good — adapter seams held through all 3 milestones |
| Playwright for end-to-end UI tests, dev-only dependency | E2E coverage via a real headless browser; runtime app remains pure-vanilla with zero runtime dependencies. Playwright in `devDependencies`, `tests/e2e/` excluded from PWA bundle, GH Action installs Playwright and runs the suite alongside unit + integration. | ✓ Good |
| Test-Driven Development (TDD) is the primary development discipline | Strict red→green→refactor for pure-logic and integration tests; UI code may be written test-after with one E2E test as a regression guard. Every shipped requirement has at least one automated test. Plans split into 'write test' → 'implement' subtasks where it makes sense. | ✓ Good |
| TIF is additive only; classic forecast.js remains untouched and is the default | TIF ships as opt-in toggle; existing Classic algorithm unchanged | ✓ Good — v1.2 delivered |
| metrics.js is a shared module consumed by both TIF (duration bands) and Metrics screen | Single source of truth for duration/ratio calculations across both features | ✓ Good — no duplication in either consumer |

## Current State (v1.2 — shipped 2026-08-24)

Both phases complete. 264 files, ~15,500 LOC added over 45 days. All 17/17 v1.2 requirements satisfied. Test suite: 647+ unit/integration tests + E2E coverage for all new screens and algorithm paths.

**Tech stack as shipped:** Vanilla JS/HTML/CSS, no build, no runtime deps. Layered architecture: `js/lib/` (pure functions) → `js/store/` (stateful pub/sub) → `js/adapters/` (injectable seams) → `js/ui/` (DOM modules). 5 bottom-nav screens: Today, History, Charts, Accuracy, Metrics. Two forecast algorithms: Classic (default) and TIF (opt-in).

**Known issues / tech debt:**
- None at v1.2 close (0 TODO/FIXME markers, 0 open security threats)

## Previous State (v1.1 — shipped 2026-07-10)

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
*Last updated: 2026-08-26 after Phase NW-12 — Prediction Logic Refinements*
