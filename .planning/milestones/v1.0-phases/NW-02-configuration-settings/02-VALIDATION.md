---
phase: 2
slug: configuration-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit + integration) + `@playwright/test` (E2E) — same as Phase 1, no new framework |
| **Config file** | none — `node --test` auto-discovers `**/*.test.js`; Playwright config carried over from Phase 1 |
| **Quick run command** | `node --test` |
| **Full suite command** | `node --test && npx playwright test` |
| **Estimated runtime** | ~3-7s unit/integration; ~30-60s with Playwright |

---

## Sampling Rate

- **After every task commit:** Run `node --test`
- **After every plan wave:** Run `node --test && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~7 seconds for the fast-feedback band

---

## Per-Task Verification Map

> Populated as plans are authored. Each plan must add rows here mapping its tasks to the
> automated commands that prove the work is done. The planner is responsible for filling
> this table during `/gsd-plan-phase` and the executor must keep `Status` current.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-XX | 01 | 1 | (TBD by planner) | — | (TBD) | unit | `node --test tests/unit/settings-validate.test.js` | ❌ W0 | ⬜ pending |
| 02-02-XX | 02 | 1 | (TBD) | T-2-MIG | v1→v2 migration preserves events; idempotent on v2 | integration | `node --test tests/integration/v1-to-v2-migration.test.js` | ❌ W0 | ⬜ pending |
| 02-03-XX | 03 | 2 | CFG-02..04, 06..09 (persistence) | T-2-RACE | re-read-before-write race mitigation | integration | `node --test tests/integration/settings-store.test.js` | ❌ W0 | ⬜ pending |
| 02-04-XX | 04 | 2 | CFG-01 | T-2-XSS | textContent only on header h1 and document.title | E2E | `npx playwright test e2e/settings-modal.spec.js` | ❌ W0 | ⬜ pending |
| 02-05-XX | 05 | 3 | CFG-08 | — | grouping toggle commit-on-click re-buckets immediately | E2E | `npx playwright test e2e/grouping-toggle.spec.js` | ❌ W0 | ⬜ pending |
| 02-06-XX | 06 | 3 | CFG-09 | — | 12h/24h conversion correctness incl. 12 AM/PM | integration + E2E | `node --test tests/unit/time.test.js && npx playwright test e2e/settings-modal.spec.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/settings-validate.test.js` — stubs for CFG-01..04, CFG-06..09 boundary validation
- [ ] `tests/integration/settings-store.test.js` — settings store subscribe + update + storage round-trip
- [ ] `tests/integration/v1-to-v2-migration.test.js` — v1 → v2 silent migration; idempotency on v2 reload
- [ ] `tests/integration/cross-store-race.test.js` — re-read-before-write mitigation for shared `nightwatch:db` blob
- [ ] `tests/unit/time.test.js` — extend with 12h/24h conversion boundaries (12 AM, 12 PM)
- [ ] `e2e/settings-modal.spec.js` — open modal, save, reload, name + time format reflected
- [ ] `e2e/grouping-toggle.spec.js` — calendar ↔ sleep-cycle toggle re-buckets the day list
- [ ] `e2e/regression-phase1.spec.js` — Phase 1 happy-path E2E re-run with `cutoverHour=4` default

*Framework already installed in Phase 1 (`node:test` + `@playwright/test`) — no install step required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calm/minimal CSS aesthetic of header + modal at mobile breakpoint | (D2-19 visual taste; UI-SPEC.md §Spacing/Color) | Visual judgment, no automated baseline before Phase 8 retheme | Open app on a 375px-wide viewport; gear icon must be ≥44px tap target; modal must not overflow; header h1 truncates with ellipsis when subjectName is 40 chars |
| Dogfood v1 blob (sen.xlsx-derived) migrates without dropping events | CFG-01..09 cross-cutting | Real-data smoke before phase gate | Copy a real Phase 1 `nightwatch:db` (v1) into the localStorage of a clean profile, reload, verify event count unchanged and `settings.version === 2` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test files created in earliest plan that consumes them)
- [ ] No watch-mode flags in commands (single-shot runs only)
- [ ] Feedback latency < 7s for `node --test`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
