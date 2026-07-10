---
phase: 1
slug: log-persist
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full rationale, edge-case table, and threat analysis live in `01-RESEARCH.md` §Validation Architecture and §Security Domain. This file is the executable contract.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit + integration)** | `node:test` (built-in, Node 22+) |
| **Framework (E2E)** | `@playwright/test` ^1.60.0 (`devDependencies` only) |
| **Config file (unit/integration)** | none — `node --test` auto-discovers `**/*.test.{js,cjs,mjs}` |
| **Config file (E2E)** | `playwright.config.js` at repo root (created in Wave 0) |
| **Quick run command** | `node --test` |
| **Full suite command** | `node --test && npx playwright test` |
| **Estimated runtime (quick)** | ~2–5 seconds (Phase 1 size) |
| **Estimated runtime (full)** | ~30–60 seconds incl. Playwright cold start |

---

## Sampling Rate

- **After every task commit:** Run `node --test` (unit + integration; Playwright skipped to keep latency < 5s)
- **After every plan wave:** Run `node --test && npx playwright test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds per-task; 60 seconds per-wave

---

## Per-Task Verification Map

Authoritative requirement → test mapping. The `Test File` column references files that **do not yet exist** (Phase 1 starts from zero) — they are scaffolded in Wave 0 and filled across Waves 1–4 per `01-RESEARCH.md` §Recommended Wave Sequencing.

| Req ID | Behavior | Test Type | Automated Command | Test File | File Exists | Status |
|--------|----------|-----------|-------------------|-----------|-------------|--------|
| LOG-01 | "Woke up" button records wake event at now, rounded to 5min | unit + integration + E2E | `node --test` / `npx playwright test` | `tests/unit/time.test.js`, `tests/integration/event-log.test.js`, `tests/e2e/quick-log.spec.js` | ❌ W0 | ⬜ pending |
| LOG-02 | "Going to sleep" button → bedtime event | integration + E2E | same | `tests/integration/event-log.test.js`, `tests/e2e/quick-log.spec.js` | ❌ W0 | ⬜ pending |
| LOG-03 | "Nap start" button → napStart event | integration + E2E | same | same files | ❌ W0 | ⬜ pending |
| LOG-04 | "Nap end" button → napEnd event | integration + E2E | same | same files | ❌ W0 | ⬜ pending |
| LOG-05 | Manual entry / edit via form for current or past day | integration + E2E | same | `tests/integration/manual-entry.test.js`, `tests/e2e/manual-entry.spec.js` | ❌ W0 | ⬜ pending |
| LOG-06 | Delete a logged event | integration + E2E | same | `tests/integration/event-log.test.js`, `tests/e2e/manual-entry.spec.js` | ❌ W0 | ⬜ pending |
| LOG-07 | 5-min precision capture / storage / display | unit (`roundTo5` table-driven) + integration | `node --test` | `tests/unit/time.test.js` | ❌ W0 | ⬜ pending |
| LOG-08 | Subjective-night grouping with cutover 04:00 | unit (`daysBySubjectiveNight` edge-case table) + integration | `node --test` | `tests/unit/day-bucket.test.js` | ❌ W0 | ⬜ pending |
| LOG-09 | At most one nap surfaced per day | unit (read-side filter in day-bucket) | `node --test` | `tests/unit/day-bucket.test.js` | ❌ W0 | ⬜ pending |
| DATA-04 | localStorage cache survives reload | integration (memory adapter snapshot) + E2E (real reload) | both | `tests/integration/persistence.test.js`, `tests/e2e/reload.spec.js` | ❌ W0 | ⬜ pending |
| PLAT-08 | `node --test` runs unit tests with zero install | smoke (test command exits 0 in CI) | `node --test` | `.github/workflows/ci.yml`, `tests/unit/*` | ❌ W0 | ⬜ pending |
| PLAT-09 | Integration tests compose adapters in Node | observed via passing integration suite | `node --test` | `tests/integration/*` | ❌ W0 | ⬜ pending |
| PLAT-10 | Playwright E2E in `tests/e2e/`, devDep only | smoke (Playwright runs in CI; deployed bundle excludes `node_modules`) | `npx playwright test` | `playwright.config.js`, `tests/e2e/*`, `package.json` | ❌ W0 | ⬜ pending |
| PLAT-11 | TDD discipline; every shipped behavior has ≥1 test | meta — verified by row coverage above + verifier audit | full suite | n/a (all of the above) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Failure Categories Sampled (sleep-logging specific)

The test suite MUST catch each of these classes of regression (sources: `01-RESEARCH.md` §Failure Categories that Matter for Sleep Logging):

1. **Data loss on reload** — E2E reload spec + integration snapshot test
2. **Double-click duplicate events** — E2E rapid-click spec (Pitfall #5)
3. **Edit creates duplicate instead of mutating** — integration test asserts `events.length` unchanged after edit (Pitfall #6)
4. **Wrong day grouping** — unit table-tests on `daysByCalendar` and `daysBySubjectiveNight` covering: events at exactly 04:00, events crossing midnight, events on either side of cutover
5. **Local-vs-UTC parsing bug** — unit round-trip test on `parseLocalISO` / `formatLocalISO`
6. **Canonical JSON round-trip lossiness** — integration test asserts `JSON.parse(JSON.stringify(db))` deep-equals `db` for a populated event log
7. **localStorage corruption tolerance** — integration test feeds a non-JSON blob to the adapter and asserts graceful "treat as empty + warn" behavior

---

## Wave 0 Requirements

Phase 1 starts from an empty repo (no `package.json`, no `tests/`, no `js/`). Wave 0 must create:

- [ ] `package.json` — `"type": "module"`, `devDependencies: { "@playwright/test": "^1.60.0" }`, scripts (`test`, `test:unit`, `test:e2e`)
- [ ] `playwright.config.js` — `testDir: 'tests/e2e'`, `webServer` (uses `python -m http.server 8080` or `npx http-server`), `use.baseURL`
- [ ] `.gitignore` — `node_modules/`, `playwright-report/`, `test-results/`, `.playwright/`
- [ ] `.github/workflows/ci.yml` — `actions/checkout@v5` → `actions/setup-node@v5` (`node-version: lts/*`) → `npm ci` → `npx playwright install --with-deps chromium` → `node --test` → `npx playwright test`
- [ ] `index.html` — minimal shell with `<script type="module" src="js/app.js">` and the empty mount point
- [ ] `js/adapters/storage-memory.js` and `js/adapters/clock-fixed.js` — required by integration tests before runtime adapters land
- [ ] Test directory stubs: `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `tests/e2e/.gitkeep`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual hierarchy / styling of buttons, list rows, modal | none (Phase 8 theming) | Phase 1 is functionally clean but not themed; no UI-visual gate yet | Eyeball check during dogfooding. Phase 8 will add visual regression. |
| Real-device PWA install + offline (post-Phase 8) | PLAT-03 | Deferred to Phase 8 | n/a in Phase 1 |

*All Phase 1 user-visible behaviors (LOG-01..09, DATA-04) have automated verification per the map above.*

---

## Security Validation (ASVS L1 — see RESEARCH §Security Domain)

| Control | Test |
|---------|------|
| V5 Input Validation — `type ∈ {wake, bedtime, napStart, napEnd}` | unit test on store `addEvent` rejecting invalid types |
| V5 Input Validation — `at` matches strict `parseLocalISO` regex | unit test on `parseLocalISO` rejecting `'not-a-date'`, `'2026-05-26'` (date-only) |
| V7 Errors — corrupted localStorage blob produces `console.warn` not exception | integration test feeds non-JSON blob, asserts graceful empty-state |
| V8 Data Protection — zero network traffic | smoke: no `fetch`, `XMLHttpRequest`, or third-party `<script>` references in `js/` |
| V11 Business Logic — edit mutates in place (no duplicate) | integration test asserts `events.length` constant after edit |
| V11 Business Logic — LOG-09 at-most-one-nap | unit test on `daysByCalendar` returning ≤1 nap per day record |
| V14 Configuration — zero runtime deps | smoke: `package.json` has empty `dependencies`, only `devDependencies` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test files + config)
- [ ] No watch-mode flags (CI must exit 0/1, not hang)
- [ ] Feedback latency < 5s per-task, < 60s per-wave
- [ ] `nyquist_compliant: true` set in frontmatter (post-planning audit)

**Approval:** pending
