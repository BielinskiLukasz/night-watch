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
  lib/            # Pure functions (no DOM, no side effects): forecast, day-bucket, csv-parse, accuracy, time…
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

- **XSS guard** — all dynamic DOM updates must go through helpers in `js/ui/dom.js` (`textContent` / `replaceChildren()`). No `innerHTML` with user-controlled data anywhere in `js/`.

- **Day boundary** — `js/lib/day-bucket.js` uses the cutover hour setting (default 04:00) to group events into sleep-days (not calendar days). Anything that reasons about "a day's events" must go through this module.

- **Service worker cache versioning** — `sw.js` has a frozen `PRECACHE_LIST` and the cache key `nightwatch-v1`. Adding new app-shell files requires updating both, and `tests/unit/sw-precache.test.js` enforces the list is exhaustive.

- **Schema migration** — `js/lib/db-shape.js` validates shape and runs V1→V2 migration. Any data-model change must bump the schema version here.
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
