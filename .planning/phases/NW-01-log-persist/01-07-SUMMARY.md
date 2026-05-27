---
phase: 01-log-persist
plan: 07
subsystem: ui-validation
tags: [vanilla-js, node-test, playwright, log-05, log-07, uat-gap-closure, future-date-guard, visible-failure, regression-guard]

requires:
  - 01-04 (manual-entry modal + onClose handler — the surface this plan rewrites)
  - 01-06 (UAT-gap closure precedent — same SUMMARY structure, same commit pattern)

provides:
  - Pure exportable `validate(input, { now })` in `js/ui/manual-entry.js` —
    no DOM access, collects ALL errors before return, accepts an injected
    `now` so the integration tests can use clock-fixed for determinism.
    Returns `{ok:true, atString, type}` on success or `{ok:false, errors:[{field, message}, ...]}`
    on failure.
  - Future-date guard: rejects any `at-string` strictly greater than the
    injected `now()`. Uses lexicographic comparison on canonical
    `YYYY-MM-DDTHH:MM` (T-02 contract) — no Date parsing inside the
    validator. Applies to BOTH Add and Edit paths.
  - Visible-failure surface: `<output id="manualEntryErrors" aria-live="polite">`
    inside the `<dialog>` renders per-field error `<p>` children via
    `el({textContent})` (T-07 preserved). When validation fails, the close
    handler queues a `dlg.showModal()` re-open and focuses the first
    errored field. Silent `return` no-op is eliminated.
  - HTML5 belt-and-suspenders: `max="<today's-date>"` set on the date
    input at modal open (gsd:allow-ui-clock exempted — same convention
    as Plan 01-04's UI-default-prefill). The JS validate() remains the
    source of truth and covers the rarer "today + future time" case.
  - LOG-07 silent rounding contract preserved: in-range non-5-aligned
    minutes round silently AFTER validation accepts the raw value. Only
    out-of-range hour/minute (e.g. 25 / 600) and missing required fields
    fail visibly.

affects:
  - 01-UAT.md gap 2 (future-date guard) CLOSED.
  - 01-UAT.md gap 3 (silent-failure on hour=25/minute=600) CLOSED.
  - tests/e2e/manual-entry.spec.js: 2 new regression specs added (future-date,
    hour-range). Pre-existing edit-in-place spec adjusted to use 2026-05-20
    04:40 so the edit target is unambiguously in the past — the spec's
    invariant is events.length===1, not the time value.

does_not_affect:
  - Persisted localStorage blob shape (D-04 canonical JSON unchanged).
  - The store's `editEvent` / `addEventAt` contracts (no field renames,
    no new fields).
  - Plan 01-06's LOG-09 dedupe wiring — these plans touch disjoint files
    and disjoint test files.

uat_traceability:
  gap_2:
    failed_truth: "Manual-entry modal accepts only past or current dates+times; future inputs are rejected (per Phase 1 success criterion 3: 'for today or any past day')."
    closure: "validate() future-date guard + Playwright spec lines 166-188."
    test_file: "tests/e2e/manual-entry.spec.js"
    unit_test_file: "tests/integration/manual-entry.test.js"
  gap_3:
    failed_truth: "Manual-entry modal gives user-visible feedback when validation rejects input (out-of-range hour/minute, empty fields, etc.) — modal stays open with an error message, or fields are highlighted, never a silent no-op."
    closure: "Structured ValidationResult + <output> render + dlg.showModal() re-open + Playwright spec lines 190-209."
    test_file: "tests/e2e/manual-entry.spec.js"
    unit_test_file: "tests/integration/manual-entry.test.js"

requirements_traceability:
  LOG-05: covered (Plan 01-04 modal + this plan's strict validation; future-date guard added)
  LOG-07: covered (Plan 01-02 store-level + Plan 01-04 silent rounding + this plan's preservation of silent-rounding for in-range minutes)
  PLAT-08: covered (visible-failure spec + structured-error unit tests added)
  PLAT-09: covered (focus moves to first errored field on re-open)
  PLAT-10: covered (aria-live=polite announces errors to screen readers)
  PLAT-11: covered (every new code path has at least one assertion: integration + e2e)

threat_disposition:
  T-07_xss: validated — error rendering uses `el({textContent})` exclusively; never innerHTML. The static markup in index.html for the <output> element carries no dynamic content.
  D-07_clock_seam: honored — validate() accepts an injected `now` function; the UI-default-prefill clock read in openManualEntry is the SAME read used by the fallback `nowFn`, no second clock-constructor introduced (security-smoke bare-clock count unchanged).

key_files:
  created: []
  modified:
    - js/ui/manual-entry.js          # validate() exported pure function + visible-failure close handler
    - index.html                     # <output id="manualEntryErrors"> + max="today" markup
    - style.css                      # error-block styling (hidden when :empty)
    - tests/integration/manual-entry.test.js   # unit assertions for validate() — required, range, future-date, success path
    - tests/e2e/manual-entry.spec.js # 2 new regression specs + edit-spec adjustment

commits:
  - 5f0f0b3: test(NW-01-07): RED — validate() with future-date guard + structured errors (UAT gaps 2, 3)
  - f30fafc: fix(NW-01-07): LOG-05 future-date guard + structured errors in validate() (UAT gap 2, 3)
  - f7a09c5: fix(NW-01-07): LOG-05/LOG-07 visible-failure UI surface + E2E regression specs (UAT gaps 2, 3)

test_evidence:
  node_test: 115 / 115 (was 107 / 107 after Plan 01-06; +8 net — validate() suite)
  playwright: 15 / 15 (was 13 / 13 after Plan 01-06; +2 net — future-date + hour-range specs)
  baseline_preserved: yes — no regression on Plans 01-01 through 01-06 (including 01-06 LOG-09 dedupe).

deviations:
  - "Pre-existing edit-in-place spec (tests/e2e/manual-entry.spec.js:67) needed its time target moved into the unambiguous past (2026-05-20 04:40) because the new strict future-date guard would reject any edit target whose constructed at-string was wall-clock-future. The spec's purpose is events.length===1 invariant (Pitfall #6 / T-05), not the time value, so the change is contract-preserving. Documented in the commit body."
  - "Flaky-test observation, non-blocking: under 4-worker parallel Playwright runs the edit-in-place spec failed once intermittently during executor wall-clock. Re-ran clean both in isolation (1 worker, 15.1s) and in full parallel (4 workers, 26.0s, all 15 green). Likely a microtask-timing race in dlg.showModal() re-open path under cross-worker contention. Not investigated further — single-worker runs are deterministic and the spec's invariant holds. Flag for Phase 8 PWA-hardening pass."

human_verification:
  - "Manual smoke: 'npm run serve' on :8080, try to add an event with date=2099-01-01 → expect modal to stay open with the future-date error visible. Try hour=25 → expect hour-range error. Try valid past date → expect row to appear and modal to close."

next_steps:
  - "Plan 01-08 (Wave 1): LOG-02/LOG-03 button/row label SSOT — derive EVENT_LABEL from BUTTONS (UAT gap 1, minor)."
  - "After 01-08: phase 1 verifier run via gsd-verifier subagent."
---

# Plan 01-07 — Manual-Entry Future-Date Guard + Visible-Failure (UAT gaps 2 & 3) — Summary

## Self-Check: PASSED

All 5 truths in 01-07-PLAN.md `must_haves.truths` hold; both UAT gaps closed; no
regression on Plans 01-01 through 01-06.

| # | Truth | Evidence |
|---|-------|----------|
| 1 | Future date+time rejected in Add AND Edit | validate() future-check + e2e gap-2 spec line 166 + unit test "rejects future at-string" |
| 2 | Rejections are user-visible (modal stays open, inline error, no silent no-op) | <output> render + dlg.showModal() re-open + e2e gap-3 spec line 190 + unit "structured errors" |
| 3 | Future-date guard reads clock through D-07 seam — no new bare clock-constructor | nowFn falls back to the gsd:allow-ui-clock-exempted UI-default-prefill `today`; security-smoke bare-clock count unchanged (1) |
| 4 | Out-of-range hour/minute, empty fields, unknown types → same visible-failure flow | Errors array collects all failures before return; unit-test asserts ALL three branches |
| 5 | node --test ≥115/115 + Playwright 15/15 | See test_evidence above |

## Files Changed (key surface)

- **js/ui/manual-entry.js** — `validate()` exported as a pure function with
  injected clock; close-handler refactored to handle the !ok path with
  re-open + focus + error rendering. Domain-time reads stay routed
  through the existing gsd:allow-ui-clock exemption.
- **index.html** — `<output id="manualEntryErrors" aria-live="polite">`
  inside the `<dialog>` (T-07-clean error surface).
- **style.css** — `.manualEntryErrors` styling (hidden when `:empty`).
- **tests/integration/manual-entry.test.js** — unit assertions for
  `validate()`: required-field collection, range guards, future-date
  guard with injected clock, success path with silent rounding.
- **tests/e2e/manual-entry.spec.js** — +2 regression specs (future-date,
  hour-range); edit-in-place spec time-target adjusted.

## What's Next

Plan 01-08 (Wave 1) — closes UAT gap 1 (minor: button/row label
inconsistency). Both source-of-truth maps in today-screen.js converge:
`EVENT_LABEL` derives from (or is replaced by) `BUTTONS`. Files: today-screen.js,
event-log integration test, quick-log e2e spec.
