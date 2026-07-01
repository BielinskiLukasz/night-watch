---
phase: 01-log-persist
plan: 01
subsystem: infra
tags: [vanilla-js, esm, localstorage, node-test, playwright, github-actions, pwa-scaffold]

requires: []
provides:
  - Composition root + adapter seams (storage, clock, id) per D-06/D-07
  - Canonical JSON persistence shape `{ version: 1, events: [...] }` per D-04/D-05
  - Zero-runtime-dependency contract (T-08): package.json `dependencies: {}`
  - Walking-skeleton UI: one "Woke up" button → list → reload-survives
  - Full testing pyramid wired: node:test (unit + integration) + Playwright E2E + GitHub Actions CI
  - Zero-dependency static file server (scripts/serve.js) for Playwright webServer + local dev
  - workflow_dispatch trigger on ci.yml for manual CI runs

affects:
  - 01-02 (TDD pure logic — extends time.js, adds day-bucket.js + id.js tests on this scaffold)
  - 01-03 (4 quick-log buttons — replaces today-screen single button)
  - 01-04 (manual entry + edit + delete — extends event-log store)
  - 01-05 (persistence smoke + security smoke + supply-chain CI + README)
  - All later phases (every plan executes against this test scaffold + CI workflow)

tech-stack:
  added:
    - "@playwright/test ^1.60.0 (devDependency only — zero runtime deps invariant intact)"
  patterns:
    - "Composition root (js/app.js): the ONLY place adapters are constructed and wired"
    - "Adapter seams (D-07): `new Date()` lives only in js/adapters/clock-*; `localStorage` lives only in js/adapters/storage-local.js"
    - "VALID_TYPES Set guard at store boundary (T-01)"
    - "QuotaExceededError translation in storage-local (T-04 storage failure mode)"
    - "JSON.parse try/catch + console.warn → null on corruption (T-03 graceful degradation)"
    - "textContent-only DOM updates in ui/today-screen.js (T-07 XSS mitigation)"
    - "Local ISO format `YYYY-MM-DDTHH:MM` via Date getters + padStart (NOT toISOString — timezone-safe)"
    - "Strict regex parser for parseLocalISO rejecting bare 'YYYY-MM-DD' (T-02, Pitfall #2)"

key-files:
  created:
    - package.json (dev-only manifest, type=module, scripts test:unit/test:e2e/test)
    - package-lock.json (D-21 — npm ci needs lockfile)
    - playwright.config.js (webServer: node scripts/serve.js, retries 2 on CI)
    - scripts/serve.js (5-line zero-dep static server, port 8080)
    - .gitignore (node_modules, playwright-report, test-results, .playwright, *.log)
    - .github/workflows/ci.yml (checkout@v5, setup-node@v5 lts/*, node --test, playwright test, upload-artifact)
    - index.html (app shell, mount #app, module script, NO manifest/sw link — Phase 8)
    - style.css (minimal functional, no theme yet)
    - js/app.js (composition root)
    - js/lib/time.js (roundTo5 stub + formatLocalISO + parseLocalISO with strict regex)
    - js/lib/id.js (newEventId → crypto.randomUUID)
    - js/adapters/storage-local.js (try/catch around JSON.parse + setItem, QuotaExceededError translation)
    - js/adapters/storage-memory.js (deep-clone load/save, _snapshot inspector)
    - js/adapters/clock-system.js (one-liner, only `new Date()` in production)
    - js/adapters/clock-fixed.js (now/advance/set test seam)
    - js/store/event-log.js (VALID_TYPES guard, SCHEMA_VERSION=1, addEvent, listEvents)
    - js/ui/today-screen.js (1 button + ul, textContent only, delegated click)
    - tests/unit/time.test.js (roundTo5, formatLocalISO round-trip, parseLocalISO rejects date-only)
    - tests/integration/event-log.test.js (addEvent persists, rejects invalid type, rehydrates same storage)
    - tests/e2e/reload.spec.js (click "Woke up" → reload → event survives)
  modified: []

key-decisions:
  - "Approved checkpoint:human-verify on local-checks + structural CI verification — GitHub Actions outage prevented first green CI run during the checkpoint window"
  - "Added workflow_dispatch trigger to ci.yml as a permanent manual escape hatch (commit 85318c2)"

patterns-established:
  - "Walking Skeleton: every architectural decision lands in Plan 01 so Plans 02-05 extend behavior, not architecture"
  - "RED-first TDD: tests written before implementation, node:test runs without bundler"
  - "Multi-file split: HTML + CSS + JS in separate files (departure from mindful-breathing's single-file pattern)"

requirements-completed:
  - LOG-01
  - DATA-04
  - PLAT-08
  - PLAT-09
  - PLAT-10
  - PLAT-11

threats-mitigated:
  - T-02 (parseLocalISO strict regex)
  - T-03 (storage-local try/catch + warn + null)
  - T-04 (storage-local QuotaExceededError translation)
  - T-08 (package.json dependencies={} invariant)

duration: ~14 min executor + ~30 min user-side checkpoint diagnostics
completed: 2026-05-26
---

# Phase 1, Plan 01: Walking Skeleton Summary

**Vertical-slice scaffold landed: composition root + storage/clock/id adapters + one quick-log button + reload-survives spec + full node:test/Playwright/CI pyramid + zero runtime dependencies.**

## Performance

- **Duration:** ~14 min executor wall-clock (Tasks 1–2); ~30 min user-side checkpoint window (manual smoke + GitHub Actions outage diagnostics)
- **Started:** 2026-05-26T10:33Z (executor dispatch)
- **Completed:** 2026-05-26T11:30Z (checkpoint approved)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files created:** 20 (16 source/test + 4 config)

## Accomplishments

- **Composition root pattern in place.** `js/app.js` is the ONLY place adapters are constructed — every later plan injects through this seam.
- **Adapter seams enforced by grep invariants.** `new Date()` only in `js/adapters/clock-*`, `localStorage` only in `js/adapters/storage-local.js` — both verified in Task 2 acceptance grep.
- **Canonical JSON shape lands as advertised.** `nightwatch:db` localStorage value is `{ version: 1, events: [{ id, type, at }] }` per D-04, verified by Playwright reload spec and manual DevTools inspection.
- **Full testing pyramid wired.** `node --test` → 8/8 pass (unit + integration). `npx playwright test` → 1/1 pass (reload spec). CI workflow `.github/workflows/ci.yml` registered and active on GitHub (run pending — see Issues).
- **Zero runtime dependencies.** `package.json` dependencies object is literal `{}`; Playwright is a devDependency only. T-08 invariant holds.
- **Threats mitigated visibly.** VALID_TYPES Set guard (T-01 partial — full coverage in Plan 03), parseLocalISO regex (T-02), storage-local try/catch + QuotaExceededError translation (T-03, T-04), dependencies={} (T-08).

## Task Commits

1. **Task 1: Scaffold dev tooling** — `7e4d807` (chore)
   - package.json, package-lock.json, playwright.config.js, scripts/serve.js, .gitignore, .github/workflows/ci.yml
2. **Task 2: Runtime modules + first failing tests then GREEN** — `fe9783a` (feat, TDD red→green)
   - 14 files: HTML + CSS + 9 JS source + 3 test files
   - `node --test`: 8/8 PASS · `npx playwright test`: 1/1 PASS
3. **Task 3: Walking-Skeleton acceptance checkpoint** — approved on local-checks + structural CI verification
   - User-verified steps 1–4 and 6 of `<how-to-verify>` on local machine
   - Step 5 (CI green) deferred: GitHub Actions in `major_outage` during checkpoint window; workflow file validated structurally (registered with GitHub, `state: active`, syntactically correct)

**Diagnostic + tracking commits during the checkpoint window:**
- `27f3f44` (docs/state) — STATE.md pause record after Tasks 1+2
- `85318c2` (ci) — added `workflow_dispatch:` trigger to ci.yml as manual escape hatch

## Files Created/Modified

See `key-files.created` in frontmatter — 20 files spanning root config, `js/`, `tests/`, `scripts/`, `.github/workflows/`. No files modified from prior commits (this is the scaffold).

## Decisions Made

- **Approve Task 3 on local-checks + structural CI verification.** GitHub-side outage made step 5 (first green CI run) unverifiable during the checkpoint window. The CI workflow file is structurally validated (registered with GitHub at `state: active`, YAML lints, run commands match what `node --test` + `playwright test` already proved locally), so deferring the first green run to whenever GitHub Actions recovers does not invalidate the Walking-Skeleton acceptance gate.
- **Add `workflow_dispatch:` trigger to ci.yml.** Tiny, defensible addition that gives a permanent manual-trigger escape hatch from the Actions tab. Useful as a diagnostic during the outage and beyond.

## Deviations from Plan

### Auto-fixed Issues

**1. [Operational] Added `workflow_dispatch:` trigger to ci.yml**
- **Found during:** Task 3 user-side verification (GitHub Actions outage)
- **Issue:** PLAN.md specified `on: push + pull_request` only. With Actions in a `major_outage` and push events not queuing, there was no way to manually test the workflow once Actions recovers.
- **Fix:** Appended `workflow_dispatch:` to the `on:` block.
- **Files modified:** .github/workflows/ci.yml (+1 line)
- **Verification:** YAML still parses; workflow remains `state: active` on GitHub; manual-trigger button will be available in the Actions tab once Actions recovers.
- **Committed in:** `85318c2`

---

**Total deviations:** 1 auto-fixed (operational; non-functional change)
**Impact on plan:** No scope creep. The Walking-Skeleton contract is unchanged; this is a CI ergonomics improvement.

## Issues Encountered

- **GitHub Actions `major_outage` during Task 3 checkpoint window.** Pushes to `origin/main` did not trigger any workflow runs. Diagnostic API queries confirmed: workflow `state: active`, `total_count: 0` runs ever, manual `workflow_dispatch` returned "Failed to queue workflow run. Please try again." with a 503 from `collector.github.com`. GitHub's status page confirmed the outage. Resolved by approving the checkpoint on local-checks + structural CI verification (see Decisions); first green CI run is deferred to whenever GitHub recovers and the next push lands.
- **Pre-existing untracked `nw-research-test/` directory at repo root.** Visible in `git status` from the start of this run; not modified by the executor. Left in place for the user to triage separately.

## User Setup Required

None — no external services configured. Two outstanding user-side observations carried into Phase 1 backlog (not blocking this plan):
- Verify the first CI run goes green once GitHub Actions recovers (push any commit, or click `Run workflow` on the ci.yml workflow page).
- GitHub Pages 404 at `https://bielinskilukasz.github.io/night-watch/` is expected until Phase 8 (PLAT-04) lands the multi-file + manifest + service-worker deployment; the current 404 may also be a side-effect of the Pages-deploy auto-workflow not running during the same outage.

## Next Phase Readiness

- Plan 01-02 (TDD pure logic — time.js round-to-nearest, day-bucket.js, id.js) can start immediately on this scaffold.
- The `node --test` runner, Playwright config, and CI workflow are all in place; Plan 01-02 only extends them with new test files.
- Open follow-up: verify a green CI run lands on `main` once GitHub recovers — record the run URL in the next plan's SUMMARY if not earlier.

---
*Phase: 01-log-persist · Plan: 01 (Walking Skeleton)*
*Completed: 2026-05-26*
