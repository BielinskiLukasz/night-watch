---
phase: 01-log-persist
plan: 06
subsystem: ui-store-lib
tags: [vanilla-js, node-test, playwright, log-09, uat-gap-closure, t-06, dedupe, regression-guard]

requires:
  - 01-05 (phase gate — persistence, security smoke, supply-chain check, README, D-22 audit)

provides:
  - LOG-09 single-render contract: every nap event renders exactly once in
    `<ul.dayEvents>`. 1st and 2nd nap events of a day render as normal rows;
    3rd+ render as faint `.extraNap` rows with the same `[edit]`/`[×]`
    affordances as every other row.
  - `BUCKET_CONFIG.napBudgetPerDay = 2` named constant in `js/lib/day-bucket.js`
    documenting the new user-facing nap budget (was implicitly 1 in Plan 01-02).
  - `dayRecord.allEvents[i].extra === true` runtime annotation on overflow
    napStart/napEnd entries; mirrored in `dayRecord.extraNaps` for downstream
    non-rendering consumers (Phase 3+ forecast can still skip overflow naps
    without re-reading bucketer internals).
  - Wire-format invariant: the input `events` array passed into `buildDayRecord`
    is NEVER mutated. The `extra: true` flag lives only on the bucketer's
    output, never on the canonical D-04 JSON the storage adapter persists.
    Pinned by integration test deep-equality assertion.
  - Replacement E2E regression spec encoding the new contract (3 nap-start
    clicks → exactly 3 actionable rows, 3rd carries `.extraNap`).

affects:
  - 01-UAT.md test 11 + test 13 user-acceptance concerns CLOSED (LOG-09
    surfacing is now net-positive: visible AND actionable).
  - Phase 3 (Forecast Engine) — the `extra` flag is now available on the
    runtime event shape; future analytics can filter on it without
    re-reading day-bucket internals.
  - Phase 7 (Charts / Heatmap / Accuracy) — same as Phase 3; overflow-nap
    filtering is now a one-line `.filter(e => !e.extra)`.

tech-stack:
  added: []
  patterns:
    - "Shallow-copy + flag pattern: `const flagged = { ...evt, extra: true }; arr.push(flagged);` — preserves wire-format immutability while letting the bucketer annotate its output."
    - "Single-iteration render: renderDay iterates `day.allEvents` only; renderEventRow decides row className from `evt.extra`. No second loop, no separate helper, no dead summary rows."
    - "Named budget constant in frozen config: `BUCKET_CONFIG.napBudgetPerDay = 2` — documents the policy so future readers see why 2 naps is the threshold (was implicitly 1 before)."
    - "Compound className `'event extraNap'` (BOTH classes when overflow) — the `event` class keeps the row picked up by `.dayEvents .rowEdit` / `.rowDel` selectors; `extraNap` triggers the faint-italic styling."

key-files:
  created: []
  modified:
    - js/lib/day-bucket.js (BUCKET_CONFIG.napBudgetPerDay=2; buildDayRecord rewritten to count napStart/napEnd and flag overflow via shallow copy on BOTH allEvents AND extraNaps; doc header expanded with section 5 on overflow-flag dedupe)
    - js/ui/today-screen.js (renderDay second loop deleted; renderEventRow reads evt.extra and sets className to 'event extraNap' or 'event'; renderExtraNapRow helper DELETED entirely; file-header comment updated)
    - tests/integration/event-log.test.js (+6 dedupe assertions in new describe block; daysByCalendar import added at top of file)
    - tests/unit/day-bucket.test.js (2 existing LOG-09 tests updated for the new 2-nap budget; added new 3-napStart test asserting only allEvents[2].extra === true)
    - tests/e2e/quick-log.spec.js (existing extraNap spec REPLACED with the 3-nap-day regression spec — count stays at 13)

key-decisions:
  - "Nap budget raised from 1 to 2. The PLAN's literal test assertions (`allEvents[1].extra` is falsy, `allEvents[2].extra === true` for a 3-napStart fixture) only resolve under a 2-nap budget. The contract conflict with LOG-09 ('Each day record contains at most one nap (a single start/end pair)') is intentional: LOG-09's text is about the slot model (named `dayRecord.napStart` / `.napEnd`) which stays singular; the budget is the user-facing render policy. Multi-nap days are a real-world reality (toddler morning + afternoon naps) — the budget acknowledges that without changing the forecast contract."
  - "Named slots stay singular. `dayRecord.napStart` and `.napEnd` continue to be set by the FIRST napStart / FIRST napEnd. This preserves the Phase 3+ forecast contract — the slot is the canonical 'this day's main nap' and downstream consumers don't need to learn about the budget. The budget is purely a render-policy concern."
  - "Option α (per-branch push in the switch). The plan offered Option α (cleaner: switch decides whether to push raw or flagged) vs Option β (smaller diff: replace last allEvents entry in the overflow branch). Chose α — the loop now has zero blanket pushes; each case explicitly decides what to put on allEvents. Prevents future drift if a contributor adds a new event type and forgets the overflow case."
  - "Compound className `'event extraNap'` (BOTH classes, not just `extraNap`). The plan called this out specifically: the `event` class keeps the row picked up by `.dayEvents .rowEdit` and `.dayEvents .rowDel` CSS selectors, AND by the e2e `li.event` locator. The `extraNap` class is purely for the faint-italic styling. Single-class would silently break per-row affordance styling."
  - "E2E spec REPLACEMENT, not addition. The PLAN was explicit: 'count stays 13.' The prior `a second Nap start ... renders as an extraNap row` spec encoded the OLD contract (2 naps = 1 extraNap). Under the new contract that assertion is wrong (2 naps = 0 extraNaps). Replace, don't add — keeps the regression-guard pyramid honest about which contract is current."

requirements-completed:
  - LOG-09  # was BLOCKED-PENDING-FIX per 01-UAT.md test 13; now user-acceptable

threats-mitigated:
  - T-06 (LOG-09 read-side enforcement — the overflow surfacing is now ACTIONABLE, not a dead row; user can edit/delete every nap they see)

duration: ~13 min
completed: 2026-05-27
---

# Phase 1, Plan 06: LOG-09 Dedupe — UAT Gap 4 Closure Summary

**Closed UAT Gap 4 (BLOCKER) — overflow naps now render exactly once with full `[edit]`/`[×]` affordances. The faint-row LOG-09 surfacing is preserved and made actionable.**

## Performance

- **Duration:** ~13 minutes wall-clock (RED commit through SUMMARY commit)
- **Started:** 2026-05-27 (this executor turn)
- **Completed:** 2026-05-27
- **Tasks:** 2 (Task 1 TDD RED→GREEN; Task 2 GREEN-only)
- **Commits:** 3 (1 RED, 2 GREEN)
- **Test delta:** 100/100 → 107/107 node:test (+6 dedupe + 1 new 2-nap-budget unit test = +7 net); 13/13 Playwright preserved (1 spec replaced, not added)

## The Before/After Row-Count Contract

**Before (the UAT-reported bug):**
For a day with 3 napStart events, the renderer produced **4 `<li>` rows**:
1. Normal row for the 1st napStart (from `day.allEvents` → `renderEventRow`)
2. Normal row for the 2nd napStart (from `day.allEvents` → `renderEventRow`)
3. Normal row for the 3rd napStart (from `day.allEvents` → `renderEventRow`)
4. **Dead faint summary row** "Extra nap: HH:MM" (from `day.extraNaps` → `renderExtraNapRow`) — no `[edit]`, no `[×]`, no way for the user to remove it.

User-reported in 01-UAT.md test 11: *"this add 2 rows in log, one with nap start looks like previous one, and another one on the end of day with Extra nap: 01:25"*. Escalated to BLOCKER in test 13: *"LOG-09 is blocked by double-render nap — user confused, cannot remove italic item."*

**After:**
For a day with 3 napStart events, the renderer produces **exactly 3 `<li>` rows**:
1. Normal `<li class="event">` for the 1st nap (no overflow flag)
2. Normal `<li class="event">` for the 2nd nap (no overflow flag — within the 2-nap budget)
3. Faint `<li class="event extraNap">` for the 3rd nap (`evt.extra === true` set by the bucketer)

**Every row** has `<button class="rowEdit">edit</button>` and `<button class="rowDel">×</button>`. The faint 3rd row is fully actionable.

## The Bucketer Contract Change

| Aspect | Before (Plan 01-02) | After (Plan 01-06) |
| ------ | ------------------- | ------------------ |
| `dayRecord.napStart` slot | FIRST napStart | FIRST napStart (unchanged) |
| `dayRecord.napEnd` slot | FIRST napEnd | FIRST napEnd (unchanged) |
| Nap budget per day | 1 (implicit) | **2 (named: `BUCKET_CONFIG.napBudgetPerDay`)** |
| Where the 2nd nap lives | `extraNaps[0]` | `allEvents` only — no flag, NOT in `extraNaps` |
| Where the 3rd nap lives | `extraNaps[1]` | `allEvents` (flagged) AND `extraNaps[0]` (same flagged copy) |
| `extra: true` annotation | did not exist | runtime-only on overflow shallow-copies |
| Wire-format on disk (D-04) | unchanged | unchanged (the `extra` flag is bucketer-output only) |
| Mutation of input `events` | none | **none — pinned by integration deep-equality test** |

The wire-format invariant is the most critical guarantee: a deep-equality snapshot of the input array is asserted to match byte-for-byte after `buildDayRecord` runs. `events[2].extra === undefined` is explicitly asserted. The `extra: true` flag is a runtime annotation on the bucketer's output, never on the persisted source-of-truth.

## UAT.md User-Acceptance: Both Tests Resolved

| UAT test | Concern | Resolution |
| -------- | ------- | ---------- |
| `.planning/phases/NW-01-log-persist/01-UAT.md` test 11 | "when I add 3 and next nap this add 2 rows in log" | Single source of truth → exactly 3 rows for 3 naps; pinned by `tests/e2e/quick-log.spec.js` `napRows.toHaveCount(3)` and unit-test `allEvents.length === 3`. |
| `.planning/phases/NW-01-log-persist/01-UAT.md` test 13 | "LOG-09 is blocked by double-render nap — user confused, cannot remove italic item." | Every row, including the faint 3rd, carries `.rowEdit` + `.rowDel` children; pinned by e2e per-row `toHaveCount(1)` loop. LOG-09 unblocked; status flipped from BLOCKED-PENDING-FIX to user-acceptable. |

## Deleted Code

For future readers tracing the dedupe history:

- **`renderExtraNapRow(evt)` function** — was in `js/ui/today-screen.js` at lines ~239-246 (pre-edit; see commit `910f83b` from Plan 01-03 for its original form). The function rendered a faint `<li class="extraNap">` containing only label+time, with no `[edit]`/`[×]` affordances. That second-loop summary path is exactly what the user reported as the dead-end row. Deleted in commit `84206b2`.
- **`for (const extraNap of day.extraNaps)` loop in `renderDay`** — was in `js/ui/today-screen.js` at lines ~189-192 (pre-edit). Deleted in commit `84206b2`.
- **Old e2e spec `a second "Nap start" on the same calendar date renders as an extraNap row`** — was in `tests/e2e/quick-log.spec.js` (the LOG-09 spec from Plan 01-03 commit `910f83b`). Replaced with the 3-nap regression spec in commit `84206b2`.

## Task Commits

1. **Task 1 (TDD RED→GREEN) — Bucketer flags overflow with extra:true on shallow copies**
   - **RED:** `52cece1` `test(NW-01-06): RED -- day-bucket extra-nap dedupe flag (UAT gap 4)`
     - 6 new assertions in new describe block; failed on the count check (`allEvents` had 2 napStarts under old contract, not 3) and on `extra:true` expectations (no flag mechanism in the bucketer yet).
   - **GREEN:** `57e10ae` `fix(NW-01-06): LOG-09 day-bucket flags overflow naps with extra:true on shallow copies (UAT gap 4)`
     - `BUCKET_CONFIG.napBudgetPerDay = 2` named constant; buildDayRecord rewritten to count nap events and push flagged shallow copies on overflow; doc-comment reword to dodge the `localStorage` security-smoke grep (same trap as Plans 01-02 / 01-03).
     - node:test 100/100 → 107/107.
2. **Task 2 (GREEN) — UI single-renders; faint rows keep [edit]/[×]; delete renderExtraNapRow**
   - **GREEN:** `84206b2` `fix(NW-01-06): LOG-09 UI single-renders extra naps via evt.extra flag; faint rows keep [edit]/[x] (UAT gap 4)`
     - `renderDay` second loop removed; `renderEventRow` reads `evt.extra` and applies `'event extraNap'` className; `renderExtraNapRow` deleted entirely; existing e2e spec replaced; doc-comment reword to dodge the `day.extraNaps` grep gate (same documentation-phrasing trap pattern).
     - Playwright 13/13 preserved (count unchanged — replaced one spec, didn't add).

## Files Created/Modified

See `key-files` in frontmatter. Net change: 0 new files, 5 modified across source / unit / integration / e2e layers.

## Decisions Made

See `key-decisions` in frontmatter. Most load-bearing:

1. **Nap budget = 2.** Resolved the contradiction between the PLAN's truth statements ("1st and 2nd render as NORMAL") and the prior bucketer's implicit 1-nap budget. Anchored on the PLAN's literal test assertions, which only resolve under a 2-nap budget. The contract conflict with LOG-09's "at most one nap" wording is intentional and documented: LOG-09's text refers to the named slot model (kept singular); the budget is the render-policy on top of that.
2. **Compound `'event extraNap'` className** (both classes), not just `'extraNap'`. Required by CSS selectors and the e2e `li.event` locator. Single-class would silently break per-row affordance styling and break e2e selectors that filter by `li.event`.
3. **E2E spec REPLACED, not added.** PLAN was explicit ("count stays 13"). The prior LOG-09 spec encoded the OLD contract (2 naps = 1 extraNap row). Under the new contract that assertion is wrong (2 naps = 0 extraNaps). Replacement keeps the regression-guard pyramid honest about which contract is current.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Existing unit tests in `tests/unit/day-bucket.test.js` encoded the OLD 1-nap-budget contract and broke when the bucketer threshold moved to 2**

- **Found during:** Task 1 GREEN — full `node --test` run after the bucketer fix
- **Issue:** Two pre-existing tests asserted that 2 napStart events on the same date surface in `extraNaps` (`day.extraNaps.length >= 1`). Under the new 2-nap budget those events are within budget, so `extraNaps` is empty and the assertions fail.
- **Fix:** Rewrote the two failing tests to assert the new contract (2 naps → empty extraNaps; 3 naps → exactly 1 overflow entry with `extra: true`). Added an explicit 3-napStart unit test that mirrors the integration test's assertions, so the bucketer contract is pinned at both layers.
- **Files modified:** `tests/unit/day-bucket.test.js` (2 tests rewritten, 1 new test added)
- **Verification:** `node --test` 107/107 green.
- **Folded into commit:** `57e10ae` (Task 1 GREEN) — fix and tests committed together because they're inseparable (the contract change moves them in lockstep).

**2. [Rule 1 — Bug] Doc-comment in `js/lib/day-bucket.js` echoed the literal `localStorage` string and broke the D-07 security-smoke grep gate**

- **Found during:** Task 1 GREEN — full `node --test` run after the bucketer fix
- **Issue:** My initial header comment for section 5 said "not persisted to localStorage" — the literal token tripped `D-07 storage-seam: localStorage only allowed in js/adapters/storage-local.js` security-smoke assertion. Same trap pattern hit by Plans 01-02 (day-bucket.js header) and 01-03 (today-screen.js header).
- **Fix:** Reworded to "not on the canonical D-04 wire format the storage adapter persists" — describes the prohibition without echoing the forbidden literal.
- **Files modified:** `js/lib/day-bucket.js` (1 comment line)
- **Verification:** `node --test` security-smoke assertions green.
- **Folded into commit:** `57e10ae` (Task 1 GREEN) — caught before commit.
- **Note:** This is the THIRD plan to hit this trap. Consider adding a permanent guidance note to PLAN templates: "When writing 'this code does not do X' invariants in comments, do not echo the literal X in the comment text — the negative grep gate will match it."

**3. [Rule 1 — Bug] Doc-comment in `js/ui/today-screen.js` echoed the literal `day.extraNaps` string and broke the PLAN's positive-deletion grep gate**

- **Found during:** Task 2 acceptance-criteria verification (between Task 2 implementation and commit)
- **Issue:** My initial comment in the rewritten `renderDay` body explained the deletion by saying "no second loop over day.extraNaps" — the literal token tripped the PLAN's required `grep -c "day\.extraNaps" js/ui/today-screen.js` returns 0 gate.
- **Fix:** Reworded to "The old second loop over the overflow array is gone" — describes the deletion without echoing the forbidden literal.
- **Files modified:** `js/ui/today-screen.js` (1 comment line)
- **Verification:** `grep -c "day\.extraNaps" js/ui/today-screen.js` returns 0.
- **Folded into commit:** `84206b2` (Task 2 GREEN) — caught before commit.

### Out-of-Scope Discoveries

- **PLAN internal inconsistency: the prior `dayRecord.napStart` slot semantics vs. the new 2-nap budget.** The PLAN's Task 1 `<behavior>` block says "The FIRST napStart of the day ... remain on `dayRecord.napStart` ... WITHOUT the `extra` flag" — silent about the 2nd napStart. The PLAN's `must_haves.truths` says "The 1st and 2nd nap-starts ... render as NORMAL rows." The PLAN's literal test assertions in the same Task 1 action step say `allEvents[1].extra` is falsy. Three statements, two interpretations. I resolved by anchoring on the literal test assertions (the most precise spec) and inferring a 2-nap budget. Documented the decision in `key-decisions` and in this section. **Not raised as Rule 4** (architectural decision) because the budget shift is purely render-policy — the named slot model is unchanged, the wire format is unchanged, and downstream forecast contracts are unchanged. The risk is contained to this plan's tests and the renderer's className conditional.

- **`nw-research-test/` directory at repo root remains untracked** (pre-existing scratch work; not touched).

- **Plan files `01-07-PLAN.md` and `01-08-PLAN.md` exist in the phase directory** but are untracked and were not referenced by this plan. Left untouched.

---

**Total deviations:** 3 auto-fixed (1 test-contract update flowing from the bucketer change, 2 documentation-phrasing traps).
**Impact on plan:** None on functional contract. Test-contract update keeps the unit/integration/e2e pyramid coherent across all three layers. Documentation reword fixes are pure no-op for runtime behavior.

## Issues Encountered

- **Documentation-phrasing grep-gate trap (3rd occurrence in Phase 1).** Plans 01-02, 01-03, and 01-06 all hit the same pattern: a "this code does NOT do X" invariant explained in a header comment by echoing the literal X, which then matches the negative grep gate. Each occurrence has been a one-line reword fix. Recommend a permanent PLAN-template note.
- **Long-file Windows path warnings on `git commit` (`LF will be replaced by CRLF`).** Same as Plans 01-01 through 01-05. Cosmetic; no impact.

## TDD Gate Compliance

Plan type is `execute` (not `tdd`), so the plan-level TDD gate enforcement does not apply. Task 1 nevertheless followed strict RED→GREEN per its own `tdd="true"` attribute:

- Task 1: `test(NW-01-06)` `52cece1` (RED, 4 of 6 new assertions failing as expected) → `fix(NW-01-06)` `57e10ae` (GREEN, 107/107 node:test green) ✓

Task 2 is non-TDD per plan (UI test-after with E2E as the regression guard, per PLAT-11). It lands a single fix commit that includes both the renderer change AND the replacement e2e spec.

## Known Stubs

None. The renderer now has a single, complete code path for every event the bucketer surfaces. The bucketer has a single, complete code path for every nap event (within-budget vs. overflow). Both layers are at full Phase 1 contract correctness.

## User Setup Required

None — no external services, no env vars, no migrations. The Phase 1 zero-runtime-dependency invariant is preserved (still no npm deps in the runtime, Playwright remains the only dev-only dependency).

## Lessons for Phase 7 (charts / heatmap / accuracy)

The `extra` flag is now available on the runtime event shape (`dayRecord.allEvents[i].extra === true` for overflow naps). Phase 7 analytics — heatmap colour-encoding, nap-pattern indicator, activity-vs-sleep correlation — can filter on it with a one-line `.filter(e => !e.extra)` without re-reading day-bucket internals. The downstream contract is:

- `dayRecord.napStart` / `.napEnd` — the canonical (first) nap pair; always unflagged.
- `dayRecord.allEvents[i]` — every event the day saw; `.extra === true` for overflow naps.
- `dayRecord.extraNaps` — mirror of overflow entries (same flagged shallow-copy objects); useful when a consumer wants only overflow without a filter pass.

Wire-format on disk stays unchanged (`extra` is a runtime annotation). Forecast / accuracy code can treat `extra:true` rows however it wants without leaking the annotation back into the canonical events array.

## Next Phase Readiness

- **Phase 1 verifier** can re-run UAT against this commit; tests 11 and 13 are now expected to pass on user-acceptance. The remaining 4 UAT gaps (label-consistency, future-date acceptance, silent rejection on invalid manual entry, and the requirement-traceability audit) are tracked by Plans 01-07 / 01-08 (already drafted in the phase directory but not executed by this plan).
- **No regression on prior plans:** `node --test` 107/107 (was 100/100 before — net +7 assertions); `npx playwright test` 13/13 (preserved; one spec replaced, not added).
- **Open follow-up carried from prior plans:** First green CI run on `main` still pending GitHub Actions recovery — non-blocking.

## Self-Check: PASSED

**Source-file changes verified (grep gates):**

- FOUND: `grep -c "extra: true" js/lib/day-bucket.js` → 7 (≥ 2 required)
- FOUND: `grep -c "extraNaps.push(evt)" js/lib/day-bucket.js` → 0 (raw push gone)
- FOUND: no `evt.extra =` assignment anywhere in `js/lib/day-bucket.js` (no mutation; shallow-copy pattern only)
- FOUND: `grep -c "renderExtraNapRow" js/ui/today-screen.js` → 0 (helper deleted)
- FOUND: `grep -c "day\.extraNaps" js/ui/today-screen.js` → 0 (UI consumer + comment-trap both clean)
- FOUND: `grep -c "evt\.extra" js/ui/today-screen.js` → 4 (className conditional + 1 JSDoc reference; ≥ 1 required)
- FOUND: zero `\.innerHTML\s*=\s*[^"]` matches in `today-screen.js` (T-07 preserved)
- FOUND: zero `new Date\(\)` matches in `today-screen.js` (clock-seam preserved)
- FOUND: zero `localStorage` matches in `today-screen.js` (D-07 preserved)
- FOUND: `01-UAT.md gap 4 regression` literal in `tests/e2e/quick-log.spec.js` (replacement spec encoded)

**Commits verified in `git log`:**

- FOUND: `52cece1` (Task 1 RED)
- FOUND: `57e10ae` (Task 1 GREEN)
- FOUND: `84206b2` (Task 2 GREEN)

**Test suites:**

- FOUND: `node --test` exits 0 with 107/107 passing (was 100/100 baseline; +7 net assertions = +6 dedupe in integration test + +1 new 3-napStart unit test; the 2 rewritten unit tests are net 0)
- FOUND: `npx playwright test` exits 0 with 13/13 passing (count preserved — replaced one spec, didn't add)

**Acceptance gates from PLAN.md:**

- FOUND: UAT Gap 4 (BLOCKER) closed — `napRows.toHaveCount(3)` + 1st/2nd lack `.extraNap` + 3rd has `.extraNap` + every row has `.rowEdit` and `.rowDel`
- FOUND: LOG-09 surfacing preserved AND made actionable — REQUIREMENTS.md `[x] LOG-09` continues to apply
- FOUND: Wire-format invariant pinned — `events[2].extra === undefined` asserted in integration test
- FOUND: `dayRecord.extraNaps` continues to be produced — Phase 3+ forecast contract unchanged
- FOUND: `renderExtraNapRow` deletion auditable in diff — commit `84206b2` removes lines from `js/ui/today-screen.js`

---

*Phase: 01-log-persist · Plan: 06 (LOG-09 Dedupe — UAT Gap 4 Closure)*
*Completed: 2026-05-27*
