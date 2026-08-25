---
milestone: v1.1
milestone_name: UX Polish
audited: 2026-07-10
status: PASSED
auditor: Claude (gsd-audit-milestone)
phases_audited: 1
requirements_total: 9
requirements_satisfied: 9
tests_unit_integration: 531
tests_e2e: 104
tests_total: 635
uat_pass: 13
uat_total: 13
---

# Milestone Audit — Nightwatch v1.1 UX Polish

**Audited:** 2026-07-10  
**Status:** PASSED  
**Verdict:** Milestone complete — ready for `/gsd-complete-milestone`

---

## 1. Scope

v1.1 UX Polish is a single-phase milestone (Phase 9) containing 9 requirements across 6 plans. All work is presentation-layer changes to existing UI modules from v1.0. No new modules, no data-model changes beyond a single new settings key (`confirmBeforeLogging`).

| | Count |
|--|--|
| Phases | 1/1 |
| Plans | 6/6 |
| Requirements | 9/9 |
| Commits | 20 (Phase 9 work) |

---

## 2. Requirements Coverage

All 9 v1.1 requirements are SATISFIED.

| Requirement | Description | Plan | Evidence |
|---|---|---|---|
| **LOG-10** | Quick-log opens pre-filled dialog when confirm-before-logging is ON | 09-04 | UAT test 10 ✅; integration test; E2E confirmed |
| **LOG-11** | "Save more" button advances type sequence and keeps dialog open | 09-05 | UAT tests 11–13 ✅; 10 unit tests (nextInSequence, advanceDateByOneDay) |
| **CFG-10** | "Confirm before logging" toggle in Time & Day settings group | 09-04 | UAT tests 8–9 ✅; round-trip E2E; db-shape + validate + modal wired |
| **UI-07** | History edit-mode toggle hides controls by default; resets on tab switch | 09-02 | UAT tests 1–3 ✅; 4 integration tests; E2E passing |
| **UI-08** | "+ Add event" button above prediction cards and hero card | 09-01 | UAT test 4 ✅; static DOM reorder in replaceChildren |
| **UI-09** | Probability-band cards collapsed by default; expand/collapse on tap | 09-03 | UAT tests 6–7 ✅; 8 integration tests (TDD RED/GREEN); E2E test 4+5 |
| **UI-10** | Hero card shows "Next Predicted Event" label | 09-01 | UAT test 5 ✅; E2E test 6; static literal text |
| **PLAT-12** | Probability-band E2E rewritten with 32-day / 4-type fixture | 09-06 | 7 E2E tests passing; 128 events (4 × 32); makeBaselineDb() verified |
| **PLAT-13** | `nw-research-test/` scratch directory removed | 09-01 | Confirmed absent from repo root; no production imports |

**Coverage: 9/9 (100%)**

---

## 3. Phase Verification

Phase 9 has no VERIFICATION.md (6 SUMMARY files + UAT file provide equivalent evidence). The prior milestone phases (01–08) were verified as part of v1.0; the v1.0 milestone is archived.

**Verification evidence for Phase 9:**

| Source | Result |
|---|---|
| 09-UAT.md | 13/13 pass — human-verified in browser at http://localhost:8081 |
| 6× SUMMARY self-checks | All PASSED — each plan verified its own commits and test counts |
| Unit + integration suite | 531/531 pass (0 failures) |
| E2E suite | 104/104 pass (Chromium) |
| Integration wiring check | 5/5 wiring points VERIFIED (see §5) |

**2 bugs found and fixed during UAT** (not blocking — both fixed before close):
- **Bug 1 (UI-07):** Edit mode not resetting on tab switch. Fixed by returning `resetEditMode()` from `mountHistoryScreen` and calling it from `app.js` `onTabChange`. (commit `3866bac`)
- **Bug 2 (LOG-10):** Confirm-before-logging dialog not pre-filling type/time. Fixed by broadening `openManualEntry` pre-fill condition from `mode==='edit' && existing` to `if (existing)`. (commit `cbd225f`)

**Phase 9 verdict: PASSED (evidence-based; VERIFICATION.md not written but not blocking)**

---

## 4. Test Suite Status

| Layer | Count | Status |
|---|---|---|
| Unit tests | — | part of 531 |
| Integration tests | — | part of 531 |
| Unit + Integration total | 531 | ✅ 0 failures |
| E2E (Playwright / Chromium) | 104 | ✅ 0 failures |
| **Total** | **635** | **✅ 0 failures** |

**Growth from v1.0 baseline (495 unit+integration + ~97 E2E):**
- +36 unit+integration tests (Phases 9 added 4+8+14+10 = 36 new tests across plans 02–05)
- +7 E2E tests (forecast.spec.js rewritten with 3 new Phase 9 tests; net +7 due to test count change)

No regressions in v1.0 test coverage.

---

## 5. Cross-Phase Integration

Phase 9 touched 7 modules from prior phases. All wiring verified by integration checker:

| Wiring | From | To | Status |
|---|---|---|---|
| clock dep thread | `app.js:100` | `mountTodayScreen({...clock})` | VERIFIED |
| resetEditMode hook | `app.js:124` | `mountHistoryScreen` → onTabChange | VERIFIED |
| openManualEntry pre-fill | `manual-entry.js:313` | `if (existing)` covers edit + confirm-before-logging add | VERIFIED |
| confirmBeforeLogging round-trip | `db-shape.js:54` + `settings-validate.js:56` + `settings-modal.js:78,108` | localStorage → snap → checkbox → save | VERIFIED |
| saveMore path isolation | `today-screen.js:586` (no saveMore) vs `today-screen.js:647` (saveMore: true) | confirm-before-logging path ≠ addEventBtn path | VERIFIED |
| Adapter injection pattern | All Phase 9 code | No bare `new Date()` or `localStorage` in logic paths | VERIFIED (3 annotated `gsd:allow-ui-clock` in UI-only display code) |

---

## 6. Tech Debt Scan

Scanned all 7 Phase 9-modified files for TODO / FIXME / TBD / XXX / HACK / STUB markers.

| File | Result |
|---|---|
| `js/ui/today-screen.js` | Clean |
| `js/ui/history-screen.js` | Clean |
| `js/ui/manual-entry.js` | Clean |
| `js/ui/settings-modal.js` | Clean |
| `js/lib/db-shape.js` | Clean |
| `js/lib/settings-validate.js` | Clean |
| `js/app.js` | Clean (2 stale Plan 07-04 "stub" comments removed 2026-07-10) |

**No active tech debt introduced by Phase 9.**

---

## 7. Deferred Items

v2 items tracked in `BACKLOG.md` (via REQUIREMENTS.md Out of Scope). None are regressions or blocking gaps — all were explicitly deferred before v1.1 scope was set.

| Ref | Description | Status |
|---|---|---|
| B-01/B-02 | Per-event-type default times + friendly hour picker | Deferred to v2 |
| B-03 | Dark mode | Deferred to v2 |
| B-04–B-07, B-21 | Prediction algorithm refinements | Deferred to v2 |
| B-12–B-15, B-17–B-19 | Multi-nap, undo/redo, tab restructure, additional charts | Deferred to v2 |

---

## 8. Definition of Done Check

| Criterion | Status |
|---|---|
| All v1.1 requirements satisfied | ✅ 9/9 |
| All plans complete with SUMMARY files | ✅ 6/6 |
| UAT completed with human sign-off | ✅ 13/13 |
| Test suite green (no failures) | ✅ 635/635 |
| Cross-phase integration verified | ✅ 5/5 wiring points |
| No blocking tech debt | ✅ |
| No unresolved bugs | ✅ (2 bugs fixed during UAT) |
| ROADMAP updated | ✅ Phase 9 marked Complete 2026-07-10 |
| REQUIREMENTS.md updated | ✅ All 9 marked Complete |

---

## Verdict

**v1.1 UX Polish milestone: PASSED**

All 9 requirements are satisfied, all tests pass, UAT completed with human sign-off, and cross-phase integration is solid. The milestone is ready for archival.

**Next step:** `/gsd-complete-milestone`

---
*Audited: 2026-07-10*  
*Auditor: Claude (gsd-audit-milestone, Sonnet 4.6)*
