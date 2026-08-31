# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Nightwatch** — a vanilla-JS, offline-first PWA for tracking a single subject's sleep (night sleep + naps) and forecasting their next sleep events (next wake, next bedtime, next nap start, next nap end) with explicit uncertainty handling and prediction-accuracy scoring.

Seeded by an existing multi-month spreadsheet (`sen.xlsx`); intended to replace the manual spreadsheet workflow with an app that updates predictions automatically as new events are logged. Inspired in spirit by `../mindful-breathing` (vanilla HTML/CSS/JS, no build, no dependencies, installable PWA, works offline) but split across multiple files for readability.

**Core value:** Given enough sleep history, predict the next wake/bed/nap events accurately enough to be useful — and surface accuracy transparently over time. When ±delta exceeds `max_delta`, fall back to a probability band over a window instead of pinning to a single time.

See `.planning/PROJECT.md` for the full context, requirements, constraints, and key decisions.
<!-- GSD:project-end -->

## Commands

```bash
npm run serve           # zero-dep static dev server → http://localhost:8081
npm test                # full suite: node --test + Playwright (server auto-starts for E2E)
npm run test:unit       # unit + integration via node --test only (~5 s, no browser)
npm run test:e2e        # Playwright E2E against http://localhost:8081
```

Run a single test file:
```bash
node --test tests/unit/forecast.test.js           # unit or integration file
npx playwright test tests/e2e/history.spec.js     # single E2E spec
```

Run only integration tests (node:test, no browser):
```bash
node --test tests/integration/
```

E2E runs Chromium only (see `playwright.config.js` — no multi-browser projects configured).

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

- **Language:** JavaScript (ES2022+), HTML5, CSS3 — no transpilers, no build step.
- **Runtime:** Browser only. Modern evergreen Chromium / Firefox / WebKit.
- **Frameworks:** None. Hard constraint inherited from `../mindful-breathing`. No npm dependencies of any kind.
- **Persistence:** `localStorage` for the live cache; downloaded JSON for canonical export/import. File-as-truth — exported JSON is canonical, `localStorage` is rebuildable from an import.
- **Imports:** CSV (translated from the Polish `sen.xlsx` column schema) and JSON round-trip.
- **PWA:** manifest + service worker. Must work from `file://` and offline.
- **Distribution:** GitHub Pages (same target as mindful-breathing). No backend, no server-side code.
- **Time precision:** 5-minute rounding for entry and display.
- **UI language:** English only in v1 (Polish column names live in import-mapping code only).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

- **Multi-file architecture.** Split HTML/CSS/JS across separate files for readability — not a single index.html (this is the explicit departure from mindful-breathing).
- **No dependencies, no build step.** Anything that would require an npm package, a transpiler, or a bundler is out of scope. Read `.planning/PROJECT.md` "Constraints" before adding anything.
- **No direct `.xlsx` parsing in runtime code.** Existing `sen.xlsx` is one-time-converted to CSV outside the app.
- **Single subject, single nap/day in v1.** Multi-profile (CFG2-01) and multi-nap (LOG2-01) are v2; data shape decisions must preserve a clean v2 migration path.
- **Day boundary is a configurable sleep-cycle cutover hour** (default ~04:00), not midnight. One night = one day.
- **Probability-band fallback** when `±delta > max_delta` — surface uncertainty honestly instead of inventing a precise time.
- **`Object.freeze` config objects,** `requestAnimationFrame` for animated loops, secure-context-only browser APIs — same patterns as `../mindful-breathing`.
- **REQ-IDs** (LOG-XX, CFG-XX, PRED-XX, UI-XX, DATA-XX, STAGE-XX, PLAT-XX) are stable identifiers. Reference them in commit messages and plan tasks. See `.planning/REQUIREMENTS.md`.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

v1.0 shipped all 8 phases. The layered module structure is stable:

```
js/
  app.js          # Composition root — the ONLY place adapters are selected and injected
  lib/            # Pure functions (no DOM, no side effects)
    forecast.js         # Classic P10/P50/P90 percentile rolling-window algorithm
    forecast-tif.js     # Opt-in TIF algorithm; imports helpers from forecast.js
    accuracy.js         # Retroactive accuracy scoring for classic algorithm
    accuracy-tif.js     # Retroactive TIF backtesting engine; must NOT import metrics.js (circular)
    metrics.js          # Per-day sleep metrics; shared by forecast-tif.js and metrics-screen.js
    chart-data.js       # Pure data transforms for Charts screen visualizations
    day-bucket.js       # Groups events into sleep-days using the cutover-hour setting
    db-shape.js         # Schema validation + V1→V2 migration; source of DEFAULT_SETTINGS
    settings-validate.js # Pure settings validator (two modes: 'save' strict / 'load' lenient)
    stages.js           # Date-range stage filters applied by Metrics/Accuracy screens
    csv-parse.js        # CSV import (Polish sen.xlsx column schema mapping)
    import-export.js    # JSON round-trip export/import
    time.js             # Time-string utilities (wall-clock, never UTC)
    id.js               # Event ID minting via crypto.randomUUID(); injectable seam for tests
  store/          # Stateful stores with pub/sub: event-log.js, settings.js
  adapters/       # Injectable seams: storage-local/memory, clock-system/fixed
  ui/             # DOM rendering modules: today-screen, history-screen, charts-screen…
tests/
  unit/           # node:test — pure lib/ modules
  integration/    # node:test — stores wired to memory adapter + fixed clock (no browser)
  e2e/            # Playwright specs against the running app
```

**Key cross-file invariants to understand before editing:**

- **Adapter injection** — `js/app.js` injects adapters into every module that needs clock or storage. Modules in `lib/` and `store/` never call `new Date()` or `localStorage` directly. Tests use `storage-memory.js` + `clock-fixed.js` without touching real storage.

- **Dual forecast algorithms** — `forecast.js` is the always-on classic (P10/P50/P90 percentile rolling window); `forecast-tif.js` is the opt-in TIF algorithm toggled in settings. TIF imports helpers from `forecast.js`. Both produce the same top-level prediction shape so `today-screen.js` swaps between them transparently.

- **XSS guard** — all dynamic DOM updates must go through helpers in `js/ui/dom.js` (`textContent` / `replaceChildren()`). No `innerHTML` with user-controlled data anywhere in `js/`.

- **Day boundary** — `js/lib/day-bucket.js` uses the cutover hour setting (default 04:00) to group events into sleep-days (not calendar days). Anything that reasons about "a day's events" must go through this module.

- **Service worker cache versioning** — `sw.js` has a frozen `PRECACHE_LIST` and the cache key `nightwatch-v1`. Adding new app-shell files requires updating both, and `tests/unit/sw-precache.test.js` enforces the list is exhaustive.

- **Schema migration** — `js/lib/db-shape.js` validates shape and runs V1→V2 migration. Any data-model change must bump the schema version here.

**Pitfalls & non-obvious invariants:**

- **Time strings are local wall-clock, never UTC.** All `event.at` values are `'YYYY-MM-DDTHH:MM'` with no `Z` suffix. Never pass `event.at` directly to `new Date()` — day-bucketing uses string slices (e.g. `at.slice(11, 13)` for hour) specifically to avoid DST ambiguity.

- **Store pub/sub contract** — both `createEventLog()` and `createSettingsStore()` return `subscribe(fn)` which returns an unsubscribe function. Both stores re-read fresh state from storage before every persist (read-before-write) to avoid cross-store race conditions on the shared `'nightwatch:db'` localStorage key.

- **Schema V2 additive migrations are idempotent.** New fields are injected per-field on every load (no version bump needed for purely additive changes). Only schema-breaking changes increment the version in `db-shape.js`.

- **UI module mount signature** — every `js/ui/` module exports a `mount*(root, deps)` or `mount*({ root, ...deps })` function. Children are cleared/replaced via helpers in `js/ui/dom.js`. Never write `innerHTML` in a mount function.

- **PRECACHE_LIST must exclude test-only adapters.** `clock-fixed.js` and `storage-memory.js` must not appear in `sw.js`'s `PRECACHE_LIST`; `tests/unit/sw-precache.test.js` enforces this and will fail if an app-shell file is added without updating the list.

- **`metrics.js` circular-import guard** — `metrics.js` is consumed by both `forecast-tif.js` and `metrics-screen.js`. It imports `timeToMinutes` from `forecast.js` but keeps a local copy of `extractTime` to avoid a cycle (`forecast-tif.js` → `metrics.js` → `forecast.js` is fine; the reverse direction would be circular).

- **`accuracy-tif.js` circular-import guard** — imports from `forecast-tif.js` and `forecast.js` only. Must NOT import from `metrics.js` (which imports `forecast.js`, and `forecast-tif.js` already imports `metrics.js` — closing that loop would be circular). `settings-validate.js` has the same constraint: it imports `DEFAULT_SETTINGS` from `db-shape.js` rather than `settings.js` to avoid a `settings.js` → `settings-validate.js` → `settings.js` cycle.

- **Stages are date-range filters, not app phases.** `js/lib/stages.js` exposes `filterDayRecordsByStage(dayRecords, stages, activeStageId)`. `activeStageId === null` means "all data". Any screen that aggregates history (Metrics, Accuracy) must pass data through this filter so user-defined life-stage scoping works correctly.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` — do not edit manually.
<!-- GSD:profile-end -->
