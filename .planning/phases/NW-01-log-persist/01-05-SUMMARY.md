---
phase: 01-log-persist
plan: 05
subsystem: hardening
tags: [vanilla-js, node-test, playwright, github-actions, security-smoke, persistence-smoke, ci-supply-chain, readme, phase-gate, d-22, t-03, t-04, t-07, t-08]

requires:
  - 01-01 (walking skeleton — composition root, event-log store, storage-local with try/catch, schema-version guard)
  - 01-02 (pure-logic TDD — time.js, day-bucket.js, id.js)
  - 01-03 (4 quick-log buttons + day-grouped list + double-click idempotency)
  - 01-04 (manual entry modal + edit mutate-in-place + delete + addEventAt/editEvent/deleteEvent store methods)

provides:
  - tests/integration/persistence.test.js — 11 assertions guarding D-04 round-trip / D-05 byte-for-byte / T-03 corrupted blob / T-04 QuotaExceededError translation / schema-version forward-compat
  - tests/integration/security-smoke.test.js — 9 assertions guarding T-08 zero deps / T-04 no network / T-04 clock-seam / D-07 storage-seam / T-07 no .innerHTML / adapter file boundary stats
  - .github/workflows/ci.yml extended with a "Supply-chain check (T-08, D-20)" step that runs BEFORE the test suite (fail-fast on any runtime dep)
  - README.md (86 non-blank lines, < 100 ceiling) covering Run-locally / Run-tests / Project-layout / Architectural-invariants / Commit-convention / Phase-1-status / Roadmap
  - createStorageLocal(key, ls) backward-compatible signature change — optional `ls` parameter defaults to `globalThis.localStorage`, enables pure-Node testing of T-03/T-04 paths without polluting globals
  - D-22 coverage matrix: every LOG-01..09, DATA-04, PLAT-08..11 has ≥1 automated test (see Coverage Audit below)

affects:
  - Phase 2 (Settings) — security-smoke gate forbids new fetch/XHR/WebSocket in js/ when Settings adds remote sync (would require a // gsd:allow-network exemption + explicit rationale)
  - Phase 2 (Settings) — DEFAULT_CUTOVER_HOUR seam in event-log.js is where CFG-08 wires user-configured cutover; security-smoke ensures the wiring stays at the composition root
  - Phase 5 (Import/Export) — schema-version guard from persistence test is the regression for forward-compat (when v2 lands, this test must be updated alongside the schema bump)
  - All later phases — security-smoke is now the first test the CI runs (after node --test discovers all *.test.js), so any later-phase code adding network/innerHTML/raw-localStorage will fail-fast in CI

tech-stack:
  added: []
  patterns:
    - "Adapter injection for testability: createStorageLocal(key, ls = globalThis.localStorage) — backward-compatible signature change enabling pure-Node test injection of fake localStorage without polluting globals"
    - "Greppable exemption tags: // gsd:allow-ui-clock for the documented non-domain Date constructor in UI prefill; honored by security-smoke on the same line OR the immediately preceding line (idiomatic eslint-disable-next-line shape)"
    - "Fail-fast supply-chain check in CI: a 1-line node -e before the test suite that exits 1 if any runtime dep was added. Cheaper than running the full Playwright suite to discover a bad PR."
    - "Repo-wide invariant smokes: tests that walk js/ and grep for forbidden tokens, with pure-comment lines skipped so documentation never trips the gate. The seven Phase 1 invariants are encoded as explicit regex + exemption rules in one file."

key-files:
  created:
    - tests/integration/persistence.test.js (240 lines — D-04/D-05 round-trip, T-03 corrupted blob, T-04 QuotaExceededError translation, schema-version guard)
    - tests/integration/security-smoke.test.js (304 lines — six invariants across nine assertions)
    - README.md (86 non-blank lines — developer onboarding)
  modified:
    - js/adapters/storage-local.js (+15 lines comment + 1 signature change — optional `ls` parameter for test injection)
    - .github/workflows/ci.yml (+5 lines — Supply-chain check step before node --test)

key-decisions:
  - "Refactor storage-local.js to accept an injected `ls` (option a from plan recommendation) — keeps the seam testable without setting globalThis.localStorage. The runtime call site in js/app.js is unchanged because the default value is `globalThis.localStorage`. Backward-compatible signature change documented inline."
  - "Exemption tag accepted on the matching line OR the immediately preceding line. Matches eslint-disable-next-line convention and Plan 04's existing placement (`// gsd:allow-ui-clock` lives on the comment line above the `new Date()` call in manual-entry.js). Strict same-line-only would have required moving the tag, churning Plan 04's commit history needlessly."
  - "Security-smoke scanner skips pure-comment lines (lines that, after trim, start with `//` or `*`). Documentation that mentions `innerHTML` / `fetch(` as an anti-pattern in plan or summary comments doesn't trip the gate. Phase 02-04's plan summaries discussing these tokens are now safe to read into the repo at any time."
  - "Detect the no-arg `new Date()` constructor only — `new Date(x)` (data transform) is allowed everywhere. The clock-seam invariant is specifically about 'fetch current time as a side effect', not about Date as a data type. Avoids false positives in clock-fixed.js's `new Date(initial)` / `new Date(t)` constructions that are pure data transforms."
  - "Two dependent supply-chain layers: (1) security-smoke assertion 1 reads package.json and asserts dependencies={}; (2) CI workflow runs a 1-liner that does the same check BEFORE the test suite. Layer (2) is the fail-fast PR rejection; layer (1) is the in-tree regression guard so the contract is observable from the source tree alone."

requirements-completed:
  - DATA-04
  - PLAT-08
  - PLAT-09
  - PLAT-10
  - PLAT-11

threats-mitigated:
  - T-01 (regression guard) — event-log VALID_TYPES rejection covered by Plan 03 integration tests (5 invalid inputs) + addEventAt T-01 reuse in Plan 04
  - T-02 (regression guard) — parseLocalISO strict regex covered by Plan 02 unit tests (6 malformed input rejections) + addEventAt + editEvent at-string parse-and-reject in Plan 04
  - T-03 (NEW regression guard) — corrupted-blob load returns null + console.warn observable in persistence.test.js
  - T-04 (NEW regression guard) — QuotaExceededError translation (both name and code paths) + no-network-in-js/ smoke + clock-seam smoke
  - T-05 (regression guard) — debounce + Pitfall #6 edit-no-duplicate covered by Plan 03 + 04 E2E specs
  - T-06 (regression guard) — extraNaps read-side filter covered by Plan 02 unit + Plan 03 E2E
  - T-07 (NEW regression guard) — security-smoke walks js/ asserting no `.innerHTML = ` with non-empty data
  - T-08 (NEW regression guard) — security-smoke asserts dependencies==={}; CI fails fast on any runtime dep addition

duration: ~18 min
completed: 2026-05-26
status: complete
approved_at: 2026-05-26
---

# Phase 1, Plan 05: Phase 1 Hardening Summary

**Closed Phase 1 with regression guards for every architectural invariant Plans 01-04 introduced: persistence (D-04/D-05 round-trip + T-03 corrupted blob + T-04 QuotaExceededError), security smoke (T-08 zero deps + T-04 no network + clock-seam + storage-seam + T-07 no .innerHTML), CI supply-chain fail-fast (T-08), and a developer-onboarding README. D-22 coverage audit confirms every LOG-* and DATA-04 requirement has ≥1 automated test.**

## Performance

- **Duration:** ~18 minutes wall-clock (executor + grep-gate verifications + full-suite reruns)
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify)
- **Commits:** 3 task commits + 1 closeout (to follow)
- **Test delta:** 80 → 100 node:test (+20: 11 persistence + 9 security-smoke); Playwright unchanged at 13/13 (no UI changes)

## Accomplishments

- **D-04 / D-05 round-trip locked in.** `JSON.parse(JSON.stringify(db))` deep-equals `db` for a populated 10-event / 3-day fixture. The canonical shape audit asserts `{ version: 1, events: [{id, type, at}] }` exactly. A fresh `createEventLog` over the same storage returns byte-identical `listEvents` / `daysByCalendar` / `daysBySubjectiveNight` output to the pre-reload state — the load-bearing invariant Phase 5 import/export will depend on.
- **T-03 corrupted-blob mitigation observable.** A non-JSON blob in `localStorage` causes `storage-local.load()` to return `null` AND call `console.warn` exactly once with a message naming the key. End-to-end test confirms `createEventLog` over a corrupted blob starts empty (no throw, no data loss for subsequent writes). The `// gsd:allow-ui-clock`-style exemption pattern from Plan 04 was reused: the test injects a fake `ls` via the new optional second argument to `createStorageLocal`, no global pollution.
- **T-04 QuotaExceededError translation tested both ways.** Browser-native `DOMException { name: 'QuotaExceededError' }` AND legacy numeric `code: 22` both produce a thrown `Error` with `/Storage full/` message. Unrelated errors (TypeError) are re-thrown unchanged — confirms the Phase 1 "fail loudly" contract.
- **Schema-version forward-compat guard tested.** `version: 99` AND `version: 0` both throw `/Unsupported schema version/` at `createEventLog` construction. Phase 5 import will rely on this to reject future-schema blobs at load.
- **Six architectural invariants locked in by smoke.** `tests/integration/security-smoke.test.js`:
  1. T-08 — `package.json.dependencies === {}`, `devDependencies` scoped to `@playwright/test` only
  2. T-04 (network) — zero `fetch(` / `XMLHttpRequest` / `WebSocket` / `EventSource` / dynamic `import()` / outside-`./js/` `<script src>` in the entire `js/` tree
  3. T-04 (clock-seam) — `new Date()` literal only in `js/adapters/clock-system.js` + `clock-fixed.js`; one greppable exemption tag (`// gsd:allow-ui-clock`) honored on same line OR immediately preceding line
  4. D-07 (storage-seam) — `localStorage` token only in `js/adapters/storage-local.js`
  5. T-07 — zero `.innerHTML = <non-empty>` assignments anywhere in `js/`
  6. Adapter file boundary — sanity restatement of 3+4 from the positive angle
- **CI supply-chain fail-fast.** New "Supply-chain check (T-08, D-20)" step in `.github/workflows/ci.yml` runs BEFORE the test suite: a 1-line `node -e` that exits 1 if any runtime dep is added. Catches a bad PR in seconds, not in the 60+ seconds Playwright takes.
- **Developer-onboarding README.** Run-locally, Run-tests, Project-layout, Architectural-invariants (mirrors the 5 smoke gates), Commit-message convention with the REQ-ID prefix table, Phase 1 status with SUMMARY links, Roadmap pointer. 86 non-blank lines (under the 100 cap; Phase 8 will polish).
- **No regression on prior plans.** Full local suite: `node --test` 100/100 + `npx playwright test` 13/13. The +20 node:test delta is all-new coverage, not refactoring.

## Task Commits

1. **Task 1 — persistence integration test + storage-local injection seam:**
   - `6464b7a` `test(NW-01-01-05): DATA-04 + T-03 + T-04 persistence round-trip + corrupted blob + schema-version guard per D-04,D-05`
   - 2 files changed (+282 / -3): `js/adapters/storage-local.js` (signature change), `tests/integration/persistence.test.js` (new — 240 lines, 11 assertions).
   - Tests RAN green on first commit (no retry needed); refactor was backward-compatible.

2. **Task 2 — security-smoke integration test:**
   - `8d3b464` `test(NW-01-01-05): T-04,T-07,T-08 security smoke + clock+storage seam invariants per D-07,D-09,D-20`
   - 1 file changed (+304 lines): `tests/integration/security-smoke.test.js`.
   - First run surfaced the same-line-vs-preceding-line exemption ambiguity; resolved by adopting the eslint-disable-next-line convention (Rule 3 inline fix, documented below).

3. **Task 3 — CI supply-chain check + README:**
   - `9643d71` `docs(NW-01-01-05): PLAT-11 add README + CI supply-chain check per D-20,D-21,T-08`
   - 2 files changed (+114 lines): `.github/workflows/ci.yml` (+5), `README.md` (new — 86 non-blank).

## Files Created/Modified

See `key-files` in frontmatter. Net change: 3 new files (`tests/integration/persistence.test.js`, `tests/integration/security-smoke.test.js`, `README.md`), 2 modified (`js/adapters/storage-local.js`, `.github/workflows/ci.yml`).

## Decisions Made

- **Refactor storage-local.js to accept an injected `ls` parameter (plan recommendation option a).** Signature changed from `createStorageLocal(key)` to `createStorageLocal(key, ls = globalThis.localStorage)`. The runtime call site in `js/app.js` is unchanged because the default value resolves to the global. Tests inject a fake `ls = { getItem, setItem }` to observe T-03 / T-04 paths without polluting `globalThis`. **Why:** Pure-Node testing without monkey-patching the global is materially cleaner than `globalThis.localStorage = fakeLS` with beforeEach/afterEach hooks; the signature change is the smallest possible imposition.
- **Exemption tag honored on the matching line OR the immediately preceding line.** Matches eslint-disable-next-line convention and Plan 04's existing placement. Strict same-line-only would have required editing Plan 04's `// gsd:allow-ui-clock — UI default-prefill of today's date is non-domain; domain time flows through clock-system.js` comment + the `const today = new Date();` line on the next line — churning a Plan 04 commit for no behavior gain. **Why:** The exemption tag's job is to document the deviation; the comment-above-the-line convention is more readable than cramming everything into one line.
- **Security-smoke scanner skips pure-comment lines (post-trim starts with `//` or `*`).** Documentation that discusses anti-patterns (e.g. "do not use `.innerHTML = userInput`") in plan-summary comments anywhere in `js/` doesn't trip the gate. **Why:** Plan 02-04 already established this convention (the documentation-phrasing trap bit two prior plans); making the smoke aware of comment lines from day 1 prevents the same trap re-biting Plan 05+ summaries that mention these tokens.
- **Detect no-arg `new Date()` only; allow `new Date(x)` everywhere.** The clock-seam invariant is specifically about "fetch current time as a side effect", not about `Date` as a data type. `new Date(initial)`, `new Date(t)`, `new Date(t.getTime() + ms)` are pure data transforms used inside `clock-fixed.js` — they are NOT side-effecting clock reads. **Why:** Allowing all `new Date(...)` constructions would have weakened the clock-seam invariant; banning them all would have either churned `clock-fixed.js` or required noisy exemptions. The arg-vs-no-arg distinction is the natural seam.
- **Two-layer supply-chain guard.** (1) `security-smoke.test.js` assertion 1 reads `package.json` and asserts `dependencies === {}` — the in-tree regression guard, observable from the source tree alone, runs every `node --test`. (2) `.github/workflows/ci.yml` runs a 1-liner that does the same check BEFORE the test suite — the fail-fast PR rejection. **Why:** Layer 2 alone would mean a developer running `npm test` locally doesn't notice the violation until they push. Layer 1 alone would mean a PR has to run the full Playwright suite (~60s) before discovering a bad dep. Both layers cost ~10 lines total.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Plan's `// gsd:allow-ui-clock` exemption ambiguity (same-line vs. above-the-line)**
- **Found during:** Task 2 first test run — assertion 3 failed at `js/ui/manual-entry.js:69: const today = new Date();`. The exemption tag was on line 68 (the comment line above), but the initial scanner implementation honored only same-line tags.
- **Issue:** Plan said "lines containing the literal comment `// gsd:allow-ui-clock` is skipped" — ambiguous between "the line itself" and "the line with the offending pattern". Plan 04 had already shipped `manual-entry.js` with the tag on the comment line above the `new Date()` call (the standard eslint-disable-next-line shape). Strict same-line-only would require editing Plan 04's commit history.
- **Fix:** Updated `scanForPattern()` in `security-smoke.test.js` to honor exemption on either the matching line OR the immediately preceding line. Documented the convention inline (`Matches eslint-disable-next-line convention and Plan 04's existing placement.`).
- **Files modified:** `tests/integration/security-smoke.test.js` (scanner function only — applied before commit).
- **Verification:** Re-ran `node --test tests/integration/security-smoke.test.js` → 9/9 green; full suite → 100/100.
- **Folded into commit:** `8d3b464` (Task 2's commit — fix applied before commit, no separate fix-up commit needed).

### Out-of-Scope Discoveries

None. The pre-existing untracked `nw-research-test/` directory at repo root remains untracked and unmodified (carried forward from all prior Phase 1 plans).

---

**Total deviations:** 1 auto-fixed (exemption-tag interpretation refinement; zero behavior impact).
**Impact on plan:** None on functional contract. The exemption-tag convention is now documented inline in the scanner so future readers see the rule.

## Issues Encountered

- **Long file-system Windows path warnings on `git commit` (`LF will be replaced by CRLF`).** Same as Plans 01-01..01-04. Cosmetic only — git's autocrlf normalization on Windows. No impact on test pass/fail or CI behavior.

## D-22 Coverage Audit

**Every Phase 1 LOG-* requirement, DATA-04, and PLAT-08..11 has at least one automated test referencing it.**

The matrix below maps each REQ-ID to its test file(s) and the specific test name(s) that exercise it. Tests are categorized by tier (unit / integration / e2e). All listed tests are passing as of commit `9643d71` (the Task 3 commit just before this SUMMARY).

| REQ-ID  | Test File(s) | Test Name(s) | Tier | Status |
|---------|--------------|--------------|------|--------|
| LOG-01 (Wake-up button) | `tests/e2e/reload.spec.js` <br> `tests/integration/event-log.test.js` <br> `tests/e2e/quick-log.spec.js` | `click "Woke up", event appears, reload, event still visible` <br> `addEvent("wake") at fixed clock 2026-05-26T06:35 persists shape { id, type: "wake", at: "2026-05-26T06:35" }` <br> `double-clicking "Woke up" within 300ms produces exactly one event (T-05 / Pitfall #5)` | e2e + integration + e2e | ✅ |
| LOG-02 (Bedtime button) | `tests/integration/event-log.test.js` <br> `tests/e2e/quick-log.spec.js` | `addEvent("bedtime") persists with type "bedtime" (LOG-02)` <br> `click "Going to sleep" records a bedtime event visible in the list (LOG-02)` | integration + e2e | ✅ |
| LOG-03 (Nap-start button) | `tests/integration/event-log.test.js` <br> `tests/e2e/quick-log.spec.js` | `addEvent("napStart") persists with type "napStart" (LOG-03)` <br> `click "Nap start" records a napStart event visible in the list (LOG-03)` | integration + e2e | ✅ |
| LOG-04 (Nap-end button) | `tests/integration/event-log.test.js` <br> `tests/e2e/quick-log.spec.js` | `addEvent("napEnd") persists with type "napEnd" (LOG-04)` <br> `click "Nap end" records a napEnd event visible in the list (LOG-04)` <br> `clicking each of the four buttons sequentially → four events visible` | integration + e2e | ✅ |
| LOG-05 (Manual entry / back-fill) | `tests/integration/event-log.test.js` <br> `tests/integration/manual-entry.test.js` <br> `tests/e2e/manual-entry.spec.js` | `addEventAt("wake", "2026-05-25T06:35") persists with at "2026-05-25T06:35"`, `addEventAt accepts a past date (LOG-05 back-fill)` <br> `addEventAt("wake", "2026-05-25T06:33") persists with at "2026-05-25T06:35"`, `addEventAt accepts a past date (LOG-05 back-fill — any past day)` <br> `open modal via + Add event, submit a past-day wake event, verify it appears in the list (LOG-05 back-fill)` | integration + integration + e2e | ✅ |
| LOG-06 (Delete event) | `tests/integration/event-log.test.js` <br> `tests/integration/manual-entry.test.js` <br> `tests/e2e/manual-entry.spec.js` | `deleteEvent removes the event from listEvents`, `deleteEvent returns false when id absent (idempotent)`, `deleteEvent persists` <br> `deleteEvent removes the event from listEvents`, `deleteEvent returns false when id absent (idempotent)`, `deleteEvent persists` <br> `click [×] on a row, accept native confirm → row disappears AND reload confirms persistence of the delete (LOG-06)` | integration + integration + e2e | ✅ |
| LOG-07 (5-min precision) | `tests/unit/time.test.js` <br> `tests/integration/manual-entry.test.js` <br> `tests/integration/event-log.test.js` <br> `tests/e2e/manual-entry.spec.js` | Round-to-nearest table (`06:30 -> 06:30`, `06:33 -> 06:35`, `06:37 -> 06:35`, `06:38 -> 06:40`, `23:58 -> next day 00:00`), `does not mutate its input`, `pads zeros on month / day / hour / minute`, round-trip suite (3 cases) <br> `addEventAt re-rounds non-5-minute inputs (typed 06:33 → stored 06:35; LOG-07)`, `editEvent re-rounds at on save (typed 06:33 saves as 06:35; LOG-07)` <br> `addEventAt re-rounds non-5-minute inputs (typed 06:33 → stored 06:35; LOG-07)`, `editEvent re-rounds at on save (typed 06:33 saves as 06:35; LOG-07)` <br> `submit modal with minute=33 — event saved with minute=35 (silent rounding per Open Question #2, LOG-07)` | unit + integration + integration + e2e | ✅ |
| LOG-08 (Day grouping with cutover) | `tests/unit/day-bucket.test.js` | `daysByCalendar`: empty, singleton, same-date, different-dates, ordering (5 tests); 7-day window (`with 7 distinct dates and limit=7 returns all 7`, `with 10 distinct dates and limit=7 returns the 7 newest`); `daysBySubjectiveNight`: cutover boundary 03:50/04:00/06:35 (3 tests); cross-month + cross-year rollback (2 tests) | unit | ✅ |
| LOG-09 (One nap per day) | `tests/unit/day-bucket.test.js` <br> `tests/e2e/quick-log.spec.js` | `two napStart events on the same date → napStart=first, extras in extraNaps`, `single nap-pair → extraNaps is empty`, `extraNaps mirrors daysByCalendar for subjective grouping` <br> `a second "Nap start" on the same calendar date renders as an extraNap row (LOG-09 / T-06)` | unit + e2e | ✅ |
| DATA-04 (Persistence survives reload) | `tests/integration/persistence.test.js` <br> `tests/integration/event-log.test.js` <br> `tests/e2e/reload.spec.js` | `JSON.parse(JSON.stringify(db)) deep-equals db for a populated event log (10 events / 3 days)`, `after fresh createEventLog reads from the same storage, every method returns identical output (D-05 invariant)`, `createStorageLocal load() with non-JSON blob returns null AND calls console.warn`, schema-version guard (2 tests), QuotaExceededError translation (3 tests) <br> `a fresh createEventLog over the SAME storage reads the same event back`, `deleteEvent persists — a fresh createEventLog over the same storage does not see the deleted event (D-05 invariant)` <br> `click "Woke up", event appears, reload, event still visible` | integration + integration + e2e | ✅ |
| PLAT-08 (node:test unit tests, zero install) | smoke — `node --test` exits 0 in CI on every push/PR; 100/100 passing as of `9643d71` | — | meta / CI | ✅ |
| PLAT-09 (Integration tests via adapters, no jsdom) | smoke — `tests/integration/*.test.js` (4 files: `event-log`, `manual-entry`, `persistence`, `security-smoke`) compose store + memory adapter + fixed clock without a browser; all passing | — | meta / suite-shape | ✅ |
| PLAT-10 (Playwright dev-only E2E) | smoke — `tests/e2e/*.spec.js` (3 files: `reload`, `quick-log`, `manual-entry`) run via `npx playwright test`; 13/13 passing as of `9643d71`. `package.json` scopes `@playwright/test` to `devDependencies` only (asserted by `security-smoke.test.js` assertion 2). | — | meta / CI | ✅ |
| PLAT-11 (TDD discipline, every behavior ≥1 test) | meta — all rows above are the evidence. Plus the in-tree TDD gate compliance: RED commits (`602dcb1`, `afff38b`, `e7e9eed`, `f4e1054`, `8a23b9d`) precede each behavior-adding GREEN (`5aad092`, `86b25c6`, `192460a`, `062bb37`). | — | meta | ✅ |

**Coverage stats:** 14 Phase 1 REQ-IDs, all ✅. Test count: 100 node:test + 13 Playwright = 113 automated assertions.

## Threat Disposition + Mitigation Evidence

The Phase 1 STRIDE register (T-01..T-08) is fully mitigated. Disposition + evidence:

| Threat | Disposition | Mitigation Evidence (file:line) |
|--------|-------------|--------------------------------|
| T-01 (Tampering / V5 / VALID_TYPES at store) | mitigate (regression guard) | `js/store/event-log.js:37` (VALID_TYPES Set); `tests/integration/event-log.test.js:106-130` (5 invalid-type rejection tests) |
| T-02 (Tampering / V5 / parseLocalISO regex) | mitigate (regression guard) | `js/lib/time.js` parseLocalISO regex + typeof guard; `tests/unit/time.test.js:78-93` (6 malformed-input rejection tests including null) |
| T-03 (Information disclosure / V7 / corrupted blob) | mitigate (NEW guard in Plan 05) | `js/adapters/storage-local.js:27-35` (load try/catch + console.warn + null); `tests/integration/persistence.test.js:101-150` (3 assertions covering corrupted load + console.warn + end-to-end recovery) |
| T-04 (Information disclosure / V8 / network + clock-seam) | mitigate (NEW guards in Plan 05) | `tests/integration/security-smoke.test.js:103-180` (network smoke + `<script src>` check + clock-seam scanner); `js/adapters/clock-system.js:12` (only `new Date()` in production runtime) |
| T-05 (Business Logic / V11 / double-click + edit-no-duplicate) | mitigate (regression guard) | `js/ui/today-screen.js` performance.now() debounce; `js/ui/manual-entry.js:39-44` (explicit mode parameter); `tests/e2e/quick-log.spec.js:69` (double-click idempotency); `tests/e2e/manual-entry.spec.js:67` (edit-no-duplicate) |
| T-06 (Business Logic / V11 / one-nap-per-day) | mitigate (regression guard) | `js/lib/day-bucket.js` extraNaps filter; `tests/unit/day-bucket.test.js:105-138` (extraNaps tests); `tests/e2e/quick-log.spec.js:84` (UI surfacing) |
| T-07 (Tampering / V5 / XSS via .innerHTML) | mitigate (NEW guard in Plan 05) | `tests/integration/security-smoke.test.js:220-256` (innerHTML scanner); textContent-only render via `js/ui/dom.js` el() helper used throughout `js/ui/today-screen.js` + `js/ui/manual-entry.js` |
| T-08 (Tampering / V14 / supply-chain) | mitigate (NEW guards in Plan 05) | `package.json` dependencies={} (asserted at `tests/integration/security-smoke.test.js:81-95`); `.github/workflows/ci.yml` Supply-chain check step (fails fast on any runtime dep) |

## `must_haves.truths` Verification

Each truth from the plan frontmatter, with evidence:

- ✅ **"After app reload the persisted blob round-trips losslessly (D-04 + D-05 invariant)"** — covered by `tests/integration/persistence.test.js` 3 round-trip tests + `tests/integration/event-log.test.js` rehydration test + `tests/e2e/reload.spec.js`.
- ✅ **"A corrupted (non-JSON) blob in localStorage produces console.warn + null and the app behaves as if empty (T-03)"** — `tests/integration/persistence.test.js` 3 corrupted-blob tests pass.
- ✅ **"Zero runtime dependencies: package.json dependencies field is literal {} (T-08)"** — `tests/integration/security-smoke.test.js` assertion 1 + CI Supply-chain check step.
- ✅ **"No fetch(, XMLHttpRequest, or external <script src=> references in js/ (T-04)"** — `tests/integration/security-smoke.test.js` assertion 2 (covers fetch / XHR / WebSocket / EventSource / dynamic import / outside-`./js/` script src).
- ✅ **"No new Date() outside js/adapters/clock-system.js + the one documented exemption in js/ui/manual-entry.js (T-04 clock-seam)"** — `tests/integration/security-smoke.test.js` assertion 3 + adapter-boundary assertion 6.
- ✅ **"No localStorage references outside js/adapters/storage-local.js (D-07 storage-seam)"** — `tests/integration/security-smoke.test.js` assertion 4 + adapter-boundary assertion 6.
- ✅ **"No .innerHTML = with non-empty-string interpolation in js/ (T-07)"** — `tests/integration/security-smoke.test.js` assertion 5.
- ✅ **"D-22 coverage audit: every LOG-01..09, DATA-04 requirement has at least one passing automated test"** — covered above in the D-22 Coverage Audit matrix.
- ⚠️ **"CI workflow is green on push AND uploads playwright-report artifact on failure for triage"** — workflow file is structurally correct (Supply-chain check step lands before `node --test`; upload-artifact@v4 step is in place from Plan 01-01). **First green CI run on `main` with the new Supply-chain step is pending the user pushing this plan's commits** (Task 4 checkpoint will confirm).
- ✅ **"README.md describes how to run the app locally + run the test suite (developer dogfooding readiness)"** — README.md sections Run-locally + Run-tests verified.

## Phase 1 Final Commit + CI Status

- **Last commit on `main` before this SUMMARY:** `9643d71` (Task 3 — CI supply-chain + README).
- **CI run URL:** _pending — to be filled at the human-verify checkpoint by the user after they push these commits._
- **Local pre-push state:** `node --test` 100/100 + `npx playwright test` 13/13.

## Lessons for Phase 2 Planning

- **The composition root (`js/app.js`) is the seam Phase 2's Settings store hooks into.** Phase 2's plan should add `createSettingsStore({ storage, ... })` next to `createEventLog({ storage, clock, id })` and pass it into `mountTodayScreen` (or a new `mountSettingsScreen`). The `nightwatch:db` blob remains `event-log`-only; settings get their own storage key (`nightwatch:settings`) so the canonical-JSON round-trip invariant doesn't get muddied.
- **The adapter pattern scales for free.** Phase 2's `cutoverHour` and `timeFormat` are pure data — no new adapter needed. Phase 5's import/export will reuse `storage-local` + add a `FileAdapter` (download/upload via `<a download>` + `<input type=file>`).
- **`DEFAULT_CUTOVER_HOUR = 4` in `js/store/event-log.js` is the wiring point for CFG-08.** Phase 2 should change `daysBySubjectiveNight(cutoverHour = DEFAULT_CUTOVER_HOUR, limit)` to pull the value from the new settings store. Add a security-smoke assertion that `DEFAULT_CUTOVER_HOUR` is referenced ONLY in `event-log.js` (the seam) and `settings-*` (the consumer) — anywhere else means a hardcode leaked.
- **The exemption-tag convention is now established.** Phase 2+ plans that need to break a seam invariant should use `// gsd:allow-<scope>` (e.g. `// gsd:allow-network` for Phase 8's service-worker registration `<script>`). The convention: tag on the same line OR the immediately preceding comment line; document the rationale in the comment text.
- **The two-layer supply-chain guard pattern (in-tree smoke + CI fail-fast) is the model for future invariants.** When Phase 8 adds the service worker, the same shape applies: a smoke assertion in `security-smoke.test.js` that asserts the SW only caches same-origin URLs, plus a CI step that fails fast if a third-party URL ends up in the precache manifest.
- **README.md is intentionally minimal (Phase 1 scope, 86 non-blank lines).** Phase 8 should expand it with: PWA install instructions, GitHub Pages deploy notes, theme/identity description, contributing guide. Don't pre-grow it.

## Known Stubs

None. Plan 05 added regression guards only; no new user-visible behavior, no placeholders, no "TODO Plan 06" markers anywhere.

## User Setup Required

None — no external services, no env vars, no migrations. Phase 1 ships as a fully self-contained, zero-dependency static PWA shell.

## Next Phase Readiness

- **Phase 2 (Configuration & Settings)** can start immediately after the human-verify checkpoint approval on this plan. The composition-root seam in `js/app.js` and the `DEFAULT_CUTOVER_HOUR` named constant in `js/store/event-log.js` are documented Phase 2 injection points.
- **All Phase 1 invariants are now CI-enforced.** Any Phase 2 PR that breaks zero-deps, the clock-seam, the storage-seam, or the no-`.innerHTML` rule will fail in CI before merge.
- **Open follow-up carried from Plan 01-01:** First green CI run on `main` with the new Supply-chain check step is pending the user pushing this plan's commits. The structurally-validated workflow file is `state: active` on GitHub; the manual `workflow_dispatch` button is available as a re-trigger if needed.

## Self-Check: PASSED

**Created files verified to exist:**
- FOUND: `tests/integration/persistence.test.js`
- FOUND: `tests/integration/security-smoke.test.js`
- FOUND: `README.md`

**Modified files verified:**
- FOUND: `js/adapters/storage-local.js` (signature `createStorageLocal(key, ls = globalThis.localStorage)`)
- FOUND: `.github/workflows/ci.yml` (contains `Supply-chain check (T-08, D-20)` step before `node --test`)

**Commits verified in `git log`:**
- FOUND: `6464b7a` (Task 1 — persistence test + storage-local refactor)
- FOUND: `8d3b464` (Task 2 — security-smoke test)
- FOUND: `9643d71` (Task 3 — CI supply-chain + README)

**Acceptance gates:**
- FOUND: `node --test` exits 0 with 100/100 passing (80 → 100, +20 new in this plan)
- FOUND: `npx playwright test` exits 0 with 13/13 passing (no Playwright changes)
- FOUND: `Supply-chain check` literal in `.github/workflows/ci.yml`
- FOUND: `Runtime deps not allowed` literal in `.github/workflows/ci.yml`
- FOUND: `dependencies` token in `tests/integration/security-smoke.test.js`
- FOUND: `fetch(` token in `tests/integration/security-smoke.test.js`
- FOUND: `new Date` token in `tests/integration/security-smoke.test.js`
- FOUND: `localStorage` token in `tests/integration/security-smoke.test.js`
- FOUND: `innerHTML` token in `tests/integration/security-smoke.test.js`
- FOUND: `gsd:allow-ui-clock` token in `tests/integration/security-smoke.test.js`
- FOUND: `gsd:allow-ui-clock` literal in `js/ui/manual-entry.js` (Plan 04's exemption — preserved)
- FOUND: `Unsupported schema version` in `tests/integration/persistence.test.js`
- FOUND: `QuotaExceededError` in `tests/integration/persistence.test.js`
- FOUND: `console.warn` / `mock.method` in `tests/integration/persistence.test.js`
- FOUND: `npm test` in README.md
- FOUND: `node scripts/serve.js` / `npm run serve` in README.md
- FOUND: `Architectural invariants` in README.md
- FOUND: README.md is 86 non-blank lines (< 100 ceiling)

## Approval

Approved by user on 2026-05-26 via `/gsd-execute-phase` checkpoint flow. D-22 coverage matrix audited; manual dogfooding deferred to Phase 2 dogfooding window. CI run verification deferred to next push (commits `6464b7a`, `8d3b464`, `9643d71`, `b460c3e`, plus closeout SHA below).

---
*Phase: 01-log-persist · Plan: 05 (Phase 1 Hardening Pass)*
*Completed: 2026-05-26*
