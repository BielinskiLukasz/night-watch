<!-- GSD:project-start source:PROJECT.md -->
## Project

**Nightwatch** — a vanilla-JS, offline-first PWA for tracking a single subject's sleep (night sleep + naps) and forecasting their next sleep events (next wake, next bedtime, next nap start, next nap end) with explicit uncertainty handling and prediction-accuracy scoring.

Seeded by an existing multi-month spreadsheet (`sen.xlsx`); intended to replace the manual spreadsheet workflow with an app that updates predictions automatically as new events are logged. Inspired in spirit by `../mindful-breathing` (vanilla HTML/CSS/JS, no build, no dependencies, installable PWA, works offline) but split across multiple files for readability.

**Core value:** Given enough sleep history, predict the next wake/bed/nap events accurately enough to be useful — and surface accuracy transparently over time. When ±delta exceeds `max_delta`, fall back to a probability band over a window instead of pinning to a single time.

See `.planning/PROJECT.md` for the full context, requirements, constraints, and key decisions.
<!-- GSD:project-end -->

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

Architecture is still emerging — Phase 1 lays down the first slice (log → persist → view). Follow these guides until a phase produces a richer architecture doc:

- **Vertical-slice phases.** The roadmap is structured as vertical MVPs (see `.planning/ROADMAP.md`), each landing an end-to-end user-visible capability. Avoid building horizontal layers ahead of the phase that needs them.
- **Reference app:** `../mindful-breathing` (single-file vanilla PWA). It demonstrates the offline + service worker + localStorage + Web APIs pattern. Adapt its patterns to the multi-file split.
- **Data model source of truth:** the translated `sen.xlsx` column schema in `.planning/PROJECT.md` § Context. The runtime data model should round-trip exactly to the canonical JSON export.
- **PWA hardening is intentionally deferred to Phase 8** so the data model can flex during Phases 1–4 without service-worker churn.
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
