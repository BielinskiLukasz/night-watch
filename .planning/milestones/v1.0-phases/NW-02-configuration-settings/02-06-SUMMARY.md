---
phase: 02-configuration-settings
plan: "06"
subsystem: ui
tags: [vanilla-js, native-dialog, playwright, cfg-09, d2-19, d2-20, t-2-22, t-2-23, t-2-24, t-2-25, pitfall-6-partial-value]

requires:
  - 02-03 (to24h / to12h exported from js/lib/time.js — Pitfall #4 boundaries pinned)
  - 02-04 (Settings modal exposes the 24h/12h select)
  - 02-05 (today-screen.js already uses formatTime for event rows — display half of CFG-09 already wired)

provides:
  - js/ui/manual-entry.js — openManualEntry accepts settings; applyTimeFormat(snap) reshapes the picker; settings.subscribe disposed on close + re-attached on validation-fail reopen; 12h submit converts via to24h before validate(); canonical storage stays 24h ISO regardless of picker shape
  - tests/e2e/settings-modal.spec.js — 5 new CFG-09 specs appended (picker shape 12h, picker shape 24h, reload persistence, Today row 12h rendering, Today row 24h rendering)

affects:
  - none in Phase 2 — Plan 02-06 is the final wave. Phase 3 (forecast engine) is the next downstream consumer; it reads timeFormat alongside the other forecast-tuning fields when rendering predicted times.

tech-stack:
  added: []
  patterns:
    - "Adoption of stale DOM nodes on modal open — `let ampmSelect = form.querySelector('select[name=\"ampm\"]')` lets a new openManualEntry invocation pick up a select left behind by the previous open. The form is reused across opens (it lives in static index.html); JS-local variables aren't. Without this, the 24h removal branch could not find the node it needed to remove."
    - "Subscriber lifecycle in a re-entrant modal (D2-19 / T-2-23): unsubscribe at the TOP of onClose; re-subscribe in the queueMicrotask validation-failure reopen path. Symmetric with the re-attached onClose + onCancel handlers."
    - "12h → 24h conversion at the submit boundary, not inside the validator. validate() is unchanged — it still asserts hourStr ∈ 0..23. The UI layer normalizes the user's 12h+AMPM input via to24h() before calling validate()."
    - "Pitfall #6 partial-value edge case (D2-19): when toggling format, conversion is skipped if hourInput.value is empty or non-numeric. Showing a clean blank beats a guess at the user's intent."

key-files:
  created: []
  modified:
    - js/ui/manual-entry.js (+~70 lines: applyTimeFormat helper, ampmSelect adoption, unsubSettings lifecycle, 12h submit conversion, queueMicrotask resubscribe)
    - js/ui/today-screen.js (+2 lines: settings threaded into both openManualEntry call sites)
    - tests/e2e/settings-modal.spec.js (+5 specs ~80 lines appended)

key-decisions:
  - "Adopt-via-querySelector for ampmSelect (deviation from plan's exact closure shape, fix surfaced by E2E)."
  - "Re-subscribe in the validation-failure queueMicrotask reopen path. The plan's `<action>` step 7 said unsubscribe at the TOP of onClose but did not specify re-subscribe on reopen. Following the plan literally would lose the subscriber across a single failed-validation→retry cycle. In practice the subscriber is dormant during the modal's open lifetime (native <dialog> blocks the Settings trigger), so the omission was cosmetic — fixing it kept onClose / onCancel / applyTimeFormat lifecycle symmetric."
  - "settings is optional on openManualEntry. All production call sites in today-screen.js now pass it, but leaving it optional preserves the existing unit-test signature surface (`tests/integration/manual-entry.test.js` imports `validate` only, not `openManualEntry`)."
  - "Submit-time 12h → 24h conversion via to24h is guarded by both `settings.get().timeFormat === '12h'` AND `ampmSelect` truthy — the second check is the actual gate. If the modal somehow opened in 24h mode and a stale ampmSelect was adopted, the conversion would still apply. Belt-and-suspenders."

metrics:
  duration: ~25 min
  completed: 2026-05-28
  tasks: 2
  commits: 2
  test-delta: "+5 E2E (35 → 40); unit 251/251 unchanged (the conversion arithmetic is already pinned by tests/unit/time.test.js's to24h/to12h boundary table from Plan 02-03)"
  files-modified: 3
  files-created: 0
---

# Phase 2, Plan 06: 12h Time-Format Propagation Summary

**CFG-09 fully delivered. The Settings modal's 24h/12h select now reshapes the manual-entry picker (HH 1-12 + dynamic AM/PM select in 12h mode; HH 0-23 with AM/PM removed in 24h mode) and the existing `formatTime(evt.at, snap.timeFormat)` already routes through the Today list. Internal storage stays canonical 24h ISO 'YYYY-MM-DDTHH:MM' regardless of picker shape (D2-20). 40/40 Playwright specs green; 251/251 unit tests unchanged. Phase 2 complete — all 8 in-phase CFG-* requirements (CFG-01..04, CFG-06..09) delivered across plans 02-01 through 02-06.**

## Performance

- **Duration:** ~25 minutes wall-clock
- **Completed:** 2026-05-28
- **Tasks:** 2 (Task 1 = manual-entry.js + today-screen.js wiring; Task 2 = 5 E2E specs)
- **Commits:** 2 (Task 1 feat; Task 2 test + adopt-stale-select fix)
- **Test delta:** unit 251/251 unchanged; E2E +5 (35 → 40)
- **Files modified:** 3 (js/ui/manual-entry.js, js/ui/today-screen.js, tests/e2e/settings-modal.spec.js)
- **Files created:** 0

## Accomplishments

- **`applyTimeFormat(snap)` helper.** Idempotent reshape of the manual-entry time picker. In 12h mode: clamps HH input to 1-12 and (if not present) inserts `<select name="ampm">` with static AM/PM options via the `el()` helper (T-2-24 — no innerHTML, no user-typed values). In 24h mode: restores HH 0-23 and removes any ampmSelect node from the DOM. Conversion of an already-entered hour via `to12h()` / `to24h()` is skipped on empty/non-numeric input (Pitfall #6 partial-value edge case).
- **Settings subscriber lifecycle.** `settings.subscribe(applyTimeFormat)` registered at the bottom of `openManualEntry` (after the initial `applyTimeFormat(settings.get())` call to set picker shape). The disposer is captured in `unsubSettings` and called at the TOP of `onClose` so the listener doesn't accumulate across repeated opens (D2-19 / T-2-23). The validation-failure `queueMicrotask` reopen path re-attaches the subscriber symmetric with `onClose` and `onCancel`.
- **12h → 24h conversion at submit.** In `onClose` (when `returnValue==='save'`), if `settings.get().timeFormat === '12h'` AND an `ampmSelect` is present, the form's `hour` value is converted via `to24h(formHour, formAmpm)` BEFORE being passed to `validate()`. The validator is unchanged — it still asserts `hourStr ∈ 0..23`. Internal storage stays canonical 24h ISO regardless of picker shape (D2-20 storage invariant).
- **Adopt stale `ampmSelect` on open.** `let ampmSelect = form.querySelector('select[name="ampm"]')`. The manual-entry form is reused across opens (it lives in static `index.html`); JS-local variables aren't. Adopting any pre-existing select node lets a new modal open clean up after a previous 12h session — the bug that the E2E surfaced before the fix.
- **today-screen.js threads `settings` into both `openManualEntry` call sites.** Both add and edit modes now pass `settings` so `applyTimeFormat` runs. The optional-parameter design keeps `openManualEntry` testable from `tests/integration/manual-entry.test.js` (which imports `validate` directly, not the modal launcher).
- **5 CFG-09 E2E specs.** 12h picker shape; 24h restore; reload persistence; Today list 12h rendering ('2:30 PM' not '14:30'); Today list 24h rendering (default 'HH:MM', no AM/PM).

## Task Commits

1. **Task 1 — Manual-entry 12h picker + settings subscriber:**
   - `be369b3` `feat(NW-02): manual-entry 12h picker + settings subscriber (CFG-09, D2-19, D2-20, T-2-22..25)`
     - 2 files changed, +94 / -3. js/ui/manual-entry.js + js/ui/today-screen.js.

2. **Task 2 — E2E + adopt-stale-select fix:**
   - `61fbad3` `test(NW-02): E2E for CFG-09 12h picker propagation + adopt stale ampmSelect`
     - 2 files changed, +98 / -1. tests/e2e/settings-modal.spec.js + the form.querySelector adoption fix in manual-entry.js. The fix landed in the test commit because the E2E was what surfaced the gap — single conceptual unit.

## Deviations from Plan

**Total deviations:** 2 (both intentional, both documented above)

**1. `ampmSelect` adopted from the DOM on modal open.** The plan's `<action>` step 3 declared `let ampmSelect = null` and assumed the variable's null-vs-non-null state reflected the DOM's presence-vs-absence of the select. E2E surfaced the gap: across multiple modal opens (close-then-reopen), the DOM survived but the JS closure didn't. `form.querySelector('select[name="ampm"]')` at the top of `openManualEntry` adopts any pre-existing node, restoring the invariant the plan intended.

**2. Re-subscribe in the validation-failure `queueMicrotask` reopen path.** The plan's `<action>` step 7 only specified unsubscribe at the TOP of `onClose`. Following it literally would lose the subscriber across a single failed-validation→retry cycle. In practice the subscriber is dormant while the modal is open (native `<dialog>` is blocking), so the omission was cosmetic — fixing it keeps `onClose` / `onCancel` / `applyTimeFormat` lifecycle symmetric with the existing re-attach pattern.

## Source Assertions Verified

```
grep -c 'applyTimeFormat'   js/ui/manual-entry.js → 4   ✓ (definition + 3 calls: initial, subscribe arg, queueMicrotask resubscribe)
grep -c 'to24h'             js/ui/manual-entry.js → 3   ✓ (import + 2 uses: submit conversion + 12→24 toggle)
grep -c 'to12h'             js/ui/manual-entry.js → 2   ✓ (import + 1 use: 24→12 toggle conversion)
grep -c 'unsubSettings'     js/ui/manual-entry.js → 6   ✓ (declaration + 5 lifecycle touches: set on initial subscribe, null-check unsub at top of onClose, null after unsub, re-set in queueMicrotask, set in initial subscribe)
grep -c 'innerHTML.*='      js/ui/manual-entry.js → 0   ✓ (only doc-comment mentions; no assignments)
npm run test:unit                                       → 251/251 pass  ✓
npx playwright test                                     → 40/40 pass    ✓
```

## Known Stubs

- **Phase 2 is complete after this plan — no carry-over stubs.** All CFG requirements (CFG-01..04, CFG-06..09) ship; CFG-05 was deferred to Phase 4 in Plan 02-01 by explicit decision (owner phase).
- **Single-tab assumption.** Cross-tab settings divergence is unchanged from Phase 1 (no BroadcastChannel). Phase 8 covers cross-tab sync.

## Threat Surface Scan

- **T-2-22** (12h submit conversion): `to24h(hStr, ampm)` throws on invalid hour (0, 13+) or invalid ampm; the catch in `onClose` falls back to an empty hourStr so `validate()` produces a clean hour-required error rather than a crash. Canonical storage remains 24h ISO (D-05 invariant preserved).
- **T-2-23** (subscriber accumulation): `unsubSettings()` called at the TOP of `onClose` before any returnValue check. Cancel / ESC / Save / validation-failure paths all hit this. Reopen path re-subscribes symmetrically.
- **T-2-24** (AM/PM select injection): `el('select', {name:'ampm'})` + `el('option', {value:'AM', textContent:'AM'})` — no `innerHTML`. Select values are static `'AM'` / `'PM'`, never user-typed.
- **T-2-25** (12h picker value conversion edge cases): `to12h(0)={h12:12,ampm:'AM'}` and `to12h(12)={h12:12,ampm:'PM'}` pinned by `tests/unit/time.test.js` boundary table from Plan 02-03 (Pitfall #4). Empty/non-numeric inputs skip conversion.
- **T-2-SC** (supply chain): No new dependencies; `package.json` `dependencies: {}` unchanged.

## TDD Gate Compliance

Both tasks are `type="auto"`. Task 1 carries `tdd="true"` but ships as a single feat per the Plan 02-03 / 02-05 Task 1 precedent (the visible-behavior gate is the E2E in Task 2). The `MVP_MODE && TDD_MODE` gate from execute-phase.md does NOT fire because `tdd_mode=false` in `.planning/config.json`.

## Phase 2 Completion Snapshot

All 6 plans shipped. The Phase 2 user-story sentence is now satisfied end-to-end:

> "As a parent tracking a child's sleep, I want to set the day-cutover hour and have it stick across reloads, so that day-grouping matches our household's actual sleep cycle, not a hardcoded default."

Plus the supporting surfaces:

- **CFG-01:** Subject name in header + document.title (Plan 02-04)
- **CFG-02:** cutoverHour stored and consumed (Plan 02-05)
- **CFG-03:** groupingMode toggle on Today + reflected in Settings (Plan 02-05)
- **CFG-04:** timeFormat 24h/12h propagated to Today list + manual-entry picker (Plans 02-05 + 02-06)
- **CFG-05:** deferred to Phase 4 (explicit decision in Plan 02-01)
- **CFG-06:** autoOutlier setting persists (stored-but-inert, Plan 02-04)
- **CFG-07:** maxDelta / minDays / windowDays / statBlend persist (stored-but-inert, Plan 02-04)
- **CFG-08:** day-cutover MVP — grouping toggle + settings.cutoverHour wiring (Plan 02-05)
- **CFG-09:** 12h time-format propagation — manual-entry picker reshape + Today display (Plan 02-06)

**Test baseline at phase close:** unit 251/251, E2E 40/40.

## Next Phase Readiness

- **Phase 3 (forecast engine)** can start immediately. The forecast-tuning fields (maxDelta, minDays, windowDays, statBlend, autoOutlier) are persisted and accessible via `settings.get()`. Phase 3 only needs to read them — no further settings-store changes.
- **Verifier should be invoked** on Phase 2 before milestone audit. `gsd-verifier` checks goal-backward delivery; phase REQ-IDs CFG-01..09 are all ticked.

## Self-Check: PASSED

**Modified files verified:**
- VERIFIED: js/ui/manual-entry.js — applyTimeFormat exported (private); to24h/to12h imported; unsubSettings lifecycle pinned
- VERIFIED: js/ui/today-screen.js — settings threaded into both openManualEntry call sites
- VERIFIED: tests/e2e/settings-modal.spec.js — 5 CFG-09 specs appended

**Commits verified in git log:**
- FOUND: be369b3 (Task 1 feat)
- FOUND: 61fbad3 (Task 2 test + adopt-stale-select fix)

**Test suite:**
- FOUND: `npm run test:unit` exits 0 with 251/251 passing
- FOUND: `npx playwright test` exits 0 with 40/40 passing
