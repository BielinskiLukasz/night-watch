---
phase: 7
slug: charts-heatmap-accuracy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert` for unit/integration; Playwright for E2E |
| **Config file** | `tests/e2e/playwright.config.js` (existing) |
| **Quick run command** | `node --test tests/unit/accuracy.test.js tests/unit/chart-data.test.js` |
| **Full suite command** | `node --test tests/unit/ tests/integration/ && npx playwright test` |
| **Estimated runtime** | ~10 seconds (unit < 1s, E2E ~8s) |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/unit/accuracy.test.js tests/unit/chart-data.test.js`
- **After every plan wave:** Run `node --test tests/unit/ tests/integration/`
- **Before `/gsd-verify-work`:** Full suite `node --test tests/unit/ tests/integration/ && npx playwright test` must be green
- **Max feedback latency:** < 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-xx-01 | accuracy-lib | 1 | UI-05 | T-07-XSS | textContent-only for user strings in SVG | unit | `node --test tests/unit/accuracy.test.js` | ❌ W0 | ⬜ pending |
| 07-xx-02 | chart-data-lib | 1 | UI-04 | — | N/A — pure data transform, no DOM | unit | `node --test tests/unit/chart-data.test.js` | ❌ W0 | ⬜ pending |
| 07-xx-03 | bottom-nav | 2 | UI-06 | T-07-TabID | VALID_TABS frozen set guards tab dispatch | E2E | `npx playwright test tests/e2e/bottom-nav.spec.js` | ❌ W0 | ⬜ pending |
| 07-xx-04 | charts-screen | 2 | UI-04 | T-07-XSS | createElementNS + textContent only; no innerHTML | E2E | `npx playwright test tests/e2e/charts-screen.spec.js` | ❌ W0 | ⬜ pending |
| 07-xx-05 | accuracy-screen | 2 | UI-05 | — | N/A | E2E | `npx playwright test tests/e2e/accuracy-screen.spec.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/accuracy.test.js` — test stubs for UI-05 (`computeAccuracy` correctness and edge cases)
- [ ] `tests/unit/chart-data.test.js` — test stubs for UI-04 (`buildHeatmapData` gap-fill, `buildSleepLengthSeries` null slots, `buildNapStats` averages)
- [ ] `tests/e2e/bottom-nav.spec.js` — E2E regression guard for UI-06 (4-tab nav, screen switching, aria-selected)
- [ ] `tests/e2e/charts-screen.spec.js` — E2E regression guard for UI-04 (chart mount, cold-start card, stage badge)
- [ ] `tests/e2e/accuracy-screen.spec.js` — E2E regression guard for UI-05 (4×3 grid render, "—" for no-nap rows)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charts visually render with correct colors and proportions | UI-04 | SVG visual pixel output not testable via node:test | Load app in browser, import test CSV, navigate to Charts, confirm all 5 sections visible |
| Bottom nav tap targets ≥ 44×44px | UI-06 | CSS pixel size requires DevTools inspection | Inspect `.bottomNav button` in browser DevTools, verify min-height ≥ 44px |
| Content not obscured behind bottom nav on scroll | UI-04/UI-05/UI-06 | Requires visual scroll test | Scroll each screen to bottom, confirm last item fully visible above nav bar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
