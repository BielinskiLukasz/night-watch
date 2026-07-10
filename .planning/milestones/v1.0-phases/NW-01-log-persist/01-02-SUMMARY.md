---
phase: 01-log-persist
plan: 02
subsystem: pure-logic
tags: [vanilla-js, esm, node-test, tdd, log-07, log-08, log-09, t-02, t-06]

requires:
  - 01-01 (walking skeleton — composition root, time.js floor stub, id.js stub, event-log + tests)

provides:
  - Round-to-nearest 5-min semantics in js/lib/time.js (LOG-07, Assumption A1)
  - Strict parseLocalISO regex with explicit non-string rejection (T-02)
  - js/lib/day-bucket.js with daysByCalendar + daysBySubjectiveNight (LOG-08)
  - LOG-09 read-side enforcement via dayRecord.extraNaps (T-06)
  - js/lib/id.js documented as the composition-root injection seam
  - Unit-test coverage: 35 new assertions across time/day-bucket/id

affects:
  - 01-03 (4 quick-log buttons + day-grouped list — consumes daysByCalendar)
  - 01-04 (manual entry + edit + delete — consumes parseLocalISO/roundTo5/formatLocalISO)
  - Phase 3 forecast engine (consumes daysBySubjectiveNight at cutoverHour=4 per D-18)
  - Phase 5 CSV/JSON round-trip (consumes the canonical time format these helpers define)

tech-stack:
  added: []
  patterns:
    - "Round-to-nearest 5-min via Math.round(ms / FIVE_MIN_MS) * FIVE_MIN_MS"
    - "TIME_CONFIG / BUCKET_CONFIG via Object.freeze (mindful-breathing pattern)"
    - "String-slice day-bucketing (at.slice(0, 10) date, at.slice(11, 13) hour) — Pitfall #3 DST-safe"
    - "Read-side LOG-09 enforcement: first nap pair fills primary slots, extras → dayRecord.extraNaps"
    - "TDD gate sequence: test(NW-01-01-02) precedes feat(NW-01-01-02) for every behavior-adding task"

key-files:
  created:
    - js/lib/day-bucket.js (daysByCalendar, daysBySubjectiveNight, bucketBy + subtractOneDay helpers, BUCKET_CONFIG)
    - tests/unit/day-bucket.test.js (15 assertions covering empty/singleton, grouping, 7-day window, LOG-09 extraNaps, subjective-night cutover edge cases incl. cross-month and cross-year rollback)
    - tests/unit/id.test.js (3 assertions: non-empty string, 100-distinct uniqueness, RFC4122 shape)
  modified:
    - js/lib/time.js (floor → round-to-nearest; TIME_CONFIG frozen; strict typeof guard in parseLocalISO; header block citing D-16, A1, Pitfall #3)
    - js/lib/id.js (documentation header expanded per CONTEXT.md Claude's Discretion; no behavior change)
    - tests/unit/time.test.js (3 → 21 assertions: round-to-nearest table, input invariants, formatLocalISO zero-pad, round-trip + 6 malformed-input rejection cases, DST sentinel)

key-decisions:
  - "Round-to-nearest with Math.round() — Assumption A1 from RESEARCH; documented inline in time.js so a future reader sees the rationale before changing"
  - "parseLocalISO accepts null/undefined/non-string and throws the same descriptive Error (added typeof guard) — closes a T-02 edge case beyond what the original regex covered"
  - "subtractOneDay uses Date math at midnight (00:00 local) on the YYYY-MM-DD prefix only — DST-safe because no transition lands at 00:00 in any modern jurisdiction; sidesteps Pitfall #3 without losing month/year-rollover correctness"
  - "Subjective-night cutover is at-or-after (>= cutoverHour) → current day, strictly-before (< cutoverHour) → previous day; documented in subjectiveNightKey and asserted by the 04:00-exactly test"
  - "LOG-09 read-side enforcement (RESEARCH Open Question #1 recommendation): first napStart fills dayRecord.napStart, first napEnd fills dayRecord.napEnd, everything else spills into dayRecord.extraNaps so the UI in Plan 03 can render a warning row"

requirements-completed:
  - LOG-07
  - LOG-08
  - LOG-09

threats-mitigated:
  - T-02 (strict parseLocalISO regex + typeof guard rejecting bare 'YYYY-MM-DD', 1-digit hour, wrong separator, junk, empty string, null)
  - T-06 (day-bucket read-side filter surfaces only one nap pair per day record; extras visible via extraNaps for UI warning)

duration: ~8 min
completed: 2026-05-26
---

# Phase 1, Plan 02: Pure-Logic TDD Summary

**Replaced Plan 01's floor stub with round-to-nearest 5-min semantics, added daysByCalendar + daysBySubjectiveNight with LOG-09 read-side enforcement, and codified the id-minting contract — all via strict RED→GREEN node:test TDD.**

## Performance

- **Duration:** ~8 minutes wall-clock (12:18 → 12:26 UTC)
- **Started:** 2026-05-26T12:18:30Z
- **Completed:** 2026-05-26T12:26:15Z
- **Tasks:** 3 (all `type="auto" tdd="true"`)
- **Commits:** 6 (3 RED, 2 GREEN feat, 1 GREEN docs)
- **Test delta:** 8 → 43 unit+integration assertions (+35); 25 → 43 after Task 1 alone (+13 from rounding table + invariants + round-trip + 6 rejection cases + DST sentinel); 40 after Task 2 (+15 day-bucket); 43 after Task 3 (+3 id)

## Accomplishments

- **`roundTo5` is now round-to-nearest** per Assumption A1 / Pitfall #1. The exhaustive table (06:30/32/33/35/37/38, 23:58→next-day) is locked in tests/unit/time.test.js so a future regression cannot silently revert to floor. The midnight-rollover case is verified explicitly — 23:58 rounds forward across the calendar boundary.
- **`parseLocalISO` rejects every malformed input the threat model knows about.** Bare 'YYYY-MM-DD', 1-digit hour, wrong separator ('YYYY/MM/DDT…'), junk strings, empty string, and non-string inputs (null tested explicitly) all throw the same descriptive Error. T-02 is now observable in test output, not just architectural.
- **`daysByCalendar` and `daysBySubjectiveNight` ship as DST-safe pure functions** using string-slice semantics (`at.slice(0, 10)`, `at.slice(11, 13)`). No `new Date(event.at)` anywhere in the bucketer — verified by negative grep. The subjective-night previous-day math uses midnight-only Date construction so DST cannot bite.
- **LOG-09 / T-06 read-side enforcement lands as `dayRecord.extraNaps`.** A day with two napStart events surfaces the first as `dayRecord.napStart` and pushes the second into `extraNaps`. Plan 03 will use this to render a warning row.
- **`newEventId` contract codified.** 100-distinct uniqueness + RFC4122 shape locked by `tests/unit/id.test.js`; the doc header explains the composition-root injection seam so future readers see why the wrapper exists.
- **TDD discipline observable in git history.** Every behavior-adding task has a `test(NW-01-01-02)` commit followed by a `feat(NW-01-01-02)` commit. The RED commits were verified to fail for the expected reason (assertion mismatch, not import error) before GREEN was implemented.

## Task Commits

1. **Task 1 — time.js round-to-nearest:**
   - RED: `602dcb1` `test(NW-01-01-02): LOG-07 add failing round-to-nearest table per Pitfall #1`
     - Failed on 06:33→06:35, 06:38→06:40, 23:58→next-day (floor stub still in place)
   - GREEN: `5aad092` `feat(NW-01-01-02): LOG-07 round-to-nearest 5-min + strict parseLocalISO per D-04`
     - Replaced floor with Math.round; extracted TIME_CONFIG; added typeof guard; expanded header
2. **Task 2 — day-bucket.js:**
   - RED: `afff38b` `test(NW-01-01-02): LOG-08,LOG-09 add failing day-bucket suite per D-08 + Open Question #1`
     - Failed at import (file did not exist)
   - GREEN: `86b25c6` `feat(NW-01-01-02): LOG-08,LOG-09 daysByCalendar + daysBySubjectiveNight with read-side nap dedup per D-08`
     - Full implementation with bucketBy + subtractOneDay + subjectiveNightKey helpers, BUCKET_CONFIG frozen, header comment
3. **Task 3 — id.js doc + contract:**
   - RED-codify: `e7e9eed` `test(NW-01-01-02): add newEventId uniqueness + RFC4122 shape test`
     - Plan 01 stub already passed (crypto.randomUUID); test codifies the contract
   - GREEN-docs: `a0ad600` `docs(NW-01-01-02): document id minting discretion-point per CONTEXT.md`
     - Header expanded with Claude's Discretion rationale + composition-root seam pattern

## Files Created/Modified

See `key-files` in frontmatter. Net change: 2 new test files, 1 new source module (day-bucket.js), 3 modified files (time.js semantic change + 2 doc-only).

## Decisions Made

- **`parseLocalISO` typeof guard.** The RESEARCH-vendored regex in the Plan 01 stub did NOT cover non-string inputs (null/undefined/number would have thrown a less-helpful `TypeError: m.exec is not a function`). Added a `typeof s === 'string' ? regex.exec(s) : null` guard so the descriptive Error is produced uniformly. Tests now explicitly assert null rejection. **Why:** T-02 mitigation is most useful when malformed inputs all produce the same observable, debuggable failure mode.
- **`subtractOneDay` uses midnight Date math, not pure-string arithmetic.** Two equally valid approaches: (a) numeric month-length arithmetic on the YYYY-MM-DD prefix, (b) construct `new Date(y, m-1, d)` at 00:00, call setDate(-1), format back. Chose (b) because it gets month-length, leap year, and year rollover correct for free with zero hand-rolled logic. **DST safety** holds because 00:00 local time is never a DST transition point — the entire arithmetic stays within "midnight on date X" and "midnight on date X-1". Cross-month (2026-06-01→2026-05-31) and cross-year (2027-01-01→2026-12-31) cases verified by tests.
- **Cutover inclusivity: `hour < cutoverHour` → previous day.** Documented in `subjectiveNightKey` and asserted by the 04:00-exactly test (which must bucket under the *current* day, not the previous). Plan PRD did not specify the boundary direction explicitly — this matches the "at-or-after cutover = current subjective night" reading and is the more common convention for sleep-tracking apps.
- **Skip explicit REFACTOR commits.** Task 1 and Task 2's plans called for an optional refactor commit after GREEN. In both cases the refactor (frozen config, header comment, helper extraction) was already part of the initial GREEN implementation — splitting it into a no-op refactor commit would have been ceremonial. Both GREEN commits document the refactor pieces in their commit messages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `new Date(event.at)` literal present in day-bucket.js documentation comment broke the negative-grep acceptance criterion**
- **Found during:** Task 2 acceptance-criteria verification (between GREEN and commit)
- **Issue:** Original header comment forbid `new Date(event.at)` by writing the literal pattern, which then matched the `! grep -E "new Date\([a-zA-Z_.]*\.at\)" js/lib/day-bucket.js` acceptance check.
- **Fix:** Reworded the documentation to describe the prohibition without using the literal forbidden pattern. The functional code never constructs a Date from an event timestamp; the documentation now explicitly explains why.
- **Files modified:** js/lib/day-bucket.js (header comment only)
- **Verification:** Re-ran the negative-grep — pattern absent; tests still 15/15 pass.
- **Folded into commit:** `86b25c6` (GREEN) — caught before commit, so no separate commit needed.

### Out-of-Scope Discoveries

None. No pre-existing issues were touched.

---

**Total deviations:** 1 auto-fixed (documentation phrasing; zero functional impact)
**Impact on plan:** None. Acceptance criteria fully satisfied.

## Issues Encountered

- **`node --test <dir>` is broken on Node 24.** Confirmed against RESEARCH §Sources finding: passing a directory path to `node --test` treats the directory as a script and fails. Used no-args discovery (`node --test`) throughout, which correctly finds `tests/unit/**/*.test.js` and `tests/integration/**/*.test.js`. Single-file invocations (`node --test tests/unit/time.test.js`) work fine. No further action needed — Plan 01-01's scripts already use the right form.

## TDD Gate Compliance

Plan type is `tdd`. Verification:

- Task 1: `test(NW-01-01-02)` 602dcb1 → `feat(NW-01-01-02)` 5aad092 — RED→GREEN ✓
- Task 2: `test(NW-01-01-02)` afff38b → `feat(NW-01-01-02)` 86b25c6 — RED→GREEN ✓
- Task 3: `test(NW-01-01-02)` e7e9eed → `docs(NW-01-01-02)` a0ad600 — RED-codify→docs ✓ (id.js implementation was correct at Plan 01-01 stub time; test codifies the contract, docs commit expands the rationale per Task 3 plan note "If the Plan 01 stub is already correct, this task's GREEN commit only adds tests + a doc header")

Each RED commit was confirmed to fail BEFORE the GREEN commit was authored. Failure reasons logged in commit messages.

## Known Stubs

None. All three modules are now at full Phase 1 correctness; no placeholders, no hardcoded empty returns, no "TODO Plan 03" markers.

## User Setup Required

None — pure logic, no external services, no env vars, no migrations.

## Next Phase Readiness

- **Plan 01-03 (Wave 2)** can start immediately. It consumes `daysByCalendar(events, 7)` for the day-grouped list and the 4 quick-log buttons land on top of the existing event-log + clock-system + storage-local stack.
- **No regression on Plan 01-01:** `tests/integration/event-log.test.js` still 3/3 pass (the fixture uses 06:35 which is already on a 5-min boundary, so the rounding semantic change had zero observable effect). Playwright E2E (`tests/e2e/reload.spec.js`) untouched and structurally identical; will continue to pass on the next CI run.
- **Open follow-up carried from Plan 01-01:** First green CI run on `main` still pending GitHub Actions recovery. Not blocking.

## Self-Check: PASSED

**Created files verified to exist:**
- FOUND: js/lib/day-bucket.js
- FOUND: tests/unit/day-bucket.test.js
- FOUND: tests/unit/id.test.js

**Commits verified in `git log`:**
- FOUND: 602dcb1 (RED time)
- FOUND: 5aad092 (GREEN time)
- FOUND: afff38b (RED day-bucket)
- FOUND: 86b25c6 (GREEN day-bucket)
- FOUND: e7e9eed (RED id)
- FOUND: a0ad600 (GREEN/docs id)

**Test suite:**
- FOUND: `node --test` exits 0 with 43/43 passing

---
*Phase: 01-log-persist · Plan: 02 (Pure Logic TDD)*
*Completed: 2026-05-26*
