---
phase: NW-08-pwa-platform-hardening
plan: "02"
subsystem: infra
tags: [github-actions, ci-cd, github-pages, playwright, node-test]

requires:
  - phase: NW-08-01
    provides: manifest.json, sw.js, and icons/ — artifacts that the deploy job copies into _site/

provides:
  - GitHub Actions CI + Deploy workflow (.github/workflows/ci.yml)
  - Automated test gate (unit + integration + E2E) on every push and pull_request
  - GitHub Pages deployment after tests pass on push to main or develop

affects:
  - NW-08-03 (deploy will carry all new app files; index.html + style.css changes land in _site/)
  - NW-08-04 (same)
  - NW-08-05 (same)

tech-stack:
  added:
    - actions/checkout@v4
    - actions/setup-node@v4
    - actions/configure-pages@v5
    - actions/upload-pages-artifact@v4
    - actions/deploy-pages@v4
  patterns:
    - Two-job CI pattern: test gate before deploy
    - Top-level permissions block for deploy-pages@v4 (pages write + id-token write)
    - Concurrency group "pages" with cancel-in-progress false to prevent racing deploys
    - Explicit file glob (node --test tests/unit/*.test.js tests/integration/*.test.js) instead of bare "node --test"
    - Staging-dir pattern: _site/ built with explicit cp list (no test or planning files)

key-files:
  created:
    - .github/workflows/ci.yml

key-decisions:
  - "Use official GitHub artifact pipeline (upload-pages-artifact@v4 + deploy-pages@v4) over peaceiris community action — long-term supported, no branch management needed (D8-01)"
  - "Deploy triggers on push to both main and develop (D8-02); tests run on all pull_requests (no branch filter)"
  - "Node version pinned to '22' (LTS Iron) not '20' to stay close to local Node 24.18 (RESEARCH Pitfall 6)"
  - "Explicit file glob in CI test command prevents node --test directory-scan behavior differences across Node versions"
  - "Staging dir uses explicit cp inclusion list — excludes tests/, .planning/, .github/, .claude/, scripts/, package.json, etc. (D8-04)"

patterns-established:
  - "Pattern: test job always gates deploy job via needs: test"
  - "Pattern: concurrency group 'pages' prevents concurrent deploy races for this repo"

requirements-completed:
  - PLAT-04

coverage:
  - id: D1
    description: ".github/workflows/ci.yml exists with test job (unit + integration + E2E) and deploy job (push-only, GitHub Pages)"
    requirement: PLAT-04
    verification:
      - kind: other
        ref: "node -e assertions on ci.yml structure — deploy-pages@v4, upload-pages-artifact@v4, configure-pages@v5, needs: test, node-version 22, explicit glob"
        status: pass
    human_judgment: false
  - id: D2
    description: "Workflow actually runs green on GitHub and deploys the app to GitHub Pages"
    verification: []
    human_judgment: true
    rationale: "CI execution requires GitHub Actions runner — cannot be verified locally; first green run requires a push to main or develop on the remote"

duration: 8min
completed: "2026-06-30"
status: complete
---

# Phase NW-08 Plan 02: CI + Deploy Summary

**GitHub Actions workflow with two-job pipeline: test gate (Node 22, explicit unit/integration/E2E globs) then GitHub Pages deploy using official v4/v5 artifact actions, triggered on push to main/develop and all pull_requests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-30T21:36:34Z
- **Completed:** 2026-06-30T21:44:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `.github/workflows/ci.yml` from scratch (first CI workflow in the repo)
- Test job runs unit + integration tests via explicit file glob, then Playwright E2E against chromium
- Deploy job gates on test, runs only on push events (not pull_request), deploys via official GitHub Pages artifact pipeline
- Staging dir `_site` built with explicit inclusion list — only ships index.html, style.css, manifest.json, sw.js, js/, icons/
- All supply-chain risks mitigated: only official `actions/` org actions at pinned v4/v5 tags; no new npm packages

## Task Commits

1. **Task 1: Create .github/workflows/ci.yml** — `801e312` (feat)

**Plan metadata:** (docs commit follows below)

## Files Created/Modified

- `.github/workflows/ci.yml` — Full CI test + GitHub Pages deploy workflow; two jobs (test, deploy)

## Decisions Made

- **Official artifact pipeline vs peaceiris:** Used `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` (official GitHub pipeline). The community action `peaceiris/actions-gh-pages` is an alternative but the official pipeline is the long-term supported path with no branch state to manage. RESEARCH.md confirmed v4 mandatory as of Jan 2025.
- **Node version '22' (LTS Iron):** RESEARCH.md Pitfall 6 notes that `node --test` behavior differs across versions; pinning to '22' (closer to local Node 24.18) reduces risk of test-runner behavior differences compared to '20'.
- **Explicit test glob in CI:** Used `node --test tests/unit/*.test.js tests/integration/*.test.js` rather than bare `node --test` or `npm test`, following RESEARCH.md Pitfall 6 recommendation and PLAN must_haves constraint.
- **Step names added:** The PATTERNS.md template used unnamed `uses:` steps; explicit `name:` labels were added to every step for clear CI log readability.

## Deviations from Plan

None — plan executed exactly as written. The PATTERNS.md YAML template was followed with one additive improvement: all `uses:` steps received explicit `name:` labels (e.g., "Checkout", "Setup Node.js") for CI log clarity. This is a presentational improvement within the step definitions; no behavior changed.

## Issues Encountered

None — file created successfully on first attempt; all Node.js assertion checks passed.

## Threat Surface Scan

No new runtime security surface introduced. The ci.yml is a CI configuration file:
- T-08-02-01 (supply chain via actions/*): All actions pinned to official `actions/` org at @v4/@v5 — MITIGATED
- T-08-02-02 (information disclosure via _site): Deploy uses explicit cp inclusion list; no .planning/, .claude/, package.json, tests/ shipped — MITIGATED
- T-08-02-03 (concurrent deploy races): concurrency group "pages" with cancel-in-progress: false — MITIGATED
- T-08-02-SC (npm supply chain): only `npm ci` with existing lockfile; no new packages installed — MITIGATED

## Known Stubs

None — the workflow is complete. The deploy job will fail on first run if GitHub Pages is not yet enabled for the repo (requires one-time repo Settings > Pages > "GitHub Actions" source selection), but this is an environment configuration step, not a code stub.

## User Setup Required

Before the deploy job can succeed, a one-time GitHub repo configuration is required:
1. Go to `https://github.com/BielinskiLukasz/night-watch/settings/pages`
2. Under "Build and deployment" > "Source", select **"GitHub Actions"**
3. Push any commit to `main` or `develop` — the workflow will run and deploy

The `test` job requires no setup and will run immediately on the next push or PR.

## Next Phase Readiness

- CI workflow is in place; test gate will run on every push/PR going forward
- Plans 08-03 through 08-05 will add more app files; the deploy job already includes js/ and icons/ directories so those changes land automatically
- GitHub Pages environment setup (one-time) is the only prerequisite for actual deployments

---
*Phase: NW-08-pwa-platform-hardening*
*Completed: 2026-06-30*
