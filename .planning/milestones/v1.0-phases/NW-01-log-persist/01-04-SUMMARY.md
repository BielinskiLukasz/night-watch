---
phase: 01-log-persist
plan: 04
subsystem: ui-store
tags: [vanilla-js, esm, native-dialog, modal, log-05, log-06, log-07, t-02, t-05, t-07, pitfall-6]

requires:
  - 01-01 (walking skeleton — composition root, event-log store, dom helpers)
  - 01-02 (pure-logic TDD — parseLocalISO, roundTo5, formatLocalISO)
  - 01-03 (4 quick-log buttons + day-grouped list — UI scaffold that 01-04 extends)

provides:
  - eventLog.addEventAt(type, atString) — manual entry / back-fill (LOG-05) with parseLocalISO+roundTo5 at write
  - eventLog.editEvent(id, patch) — D-03 mutate-in-place; events[i] = next at SAME index (Pitfall #6 root cause mitigation visible in source)
  - eventLog.deleteEvent(id) — LOG-06 splice(i, 1) idempotent removal with persist
  - Native <dialog id="manualEntry"> modal with form (date + HH/MM number inputs + 4-option type select) per D-13/D-14
  - js/ui/manual-entry.js openManualEntry({mode, existing, onSave}) — explicit mode parameter is the Pitfall #6 architectural mitigation at the UI layer
  - js/ui/today-screen.js per-row [edit] / [×] affordances + delegated handlers + '+ Add event' modal trigger (D-10/D-12)
  - tests/integration/manual-entry.test.js dedicated regression-guard suite (13 assertions including the canonical "events.length unchanged after edit")
  - tests/e2e/manual-entry.spec.js 6 specs covering LOG-05 / LOG-06 / Pitfall #6 / native-dialog ESC + cancel paths

affects:
  - 01-05 (persistence smoke + security smoke + supply-chain CI + README — manual-entry spec is the regression guard for LOG-05/06)
  - Phase 4 (History screen will reuse openManualEntry for row-level edit + the editEvent/deleteEvent store methods)
  - Phase 5 (CSV/JSON import — addEventAt is the in-process path for what import will do in bulk)
  - Phase 8 (visual hardening will swap window.confirm for a styled dialog and theme the modal)

tech-stack:
  added: []
  patterns:
    - "Native <dialog> + showModal() — focus trap + ESC-to-close + aria-modal automatic (V14 zero-deps accessibility)"
    - "form method='dialog' + button[value='save'] → close returnValue dispatch — dispatch only when returnValue==='save'"
    - "formnovalidate on Save button + JS-level required + range guards in onClose — Open Question #2 silent rounding contract needs HTML5 step constraint bypassed; JS is the validation source of truth"
    - "Explicit mode='add'|'edit' parameter at modal entry — Pitfall #6 / T-05 architectural mitigation; UI cannot dispatch addEventAt when editEvent is intended"
    - "D-03 mutate-in-place: events[i] = next on edit; events.splice(i, 1) on delete — both at SAME index"
    - "Defense in depth on the 5-min invariant — modal Math.round(rawMinute/5)*5 + store roundTo5 on save"
    - "Native window.confirm for delete (Open Question #3 Phase 1 acceptable; Phase 8 swap for styled dialog)"
    - "gsd:allow-ui-clock tag on the single non-domain UI default-prefill new Date() — Plan 05 Task 2 greps for this literal"

key-files:
  created:
    - js/ui/manual-entry.js (137 lines — openManualEntry({mode, existing, onSave}) with explicit-mode Pitfall #6 mitigation)
    - tests/integration/manual-entry.test.js (142 lines — dedicated regression-guard suite, 13 assertions)
    - tests/e2e/manual-entry.spec.js (143 lines — 6 specs covering full modal flow)
  modified:
    - js/store/event-log.js (+97 lines — addEventAt, editEvent mutate-in-place, deleteEvent; parseLocalISO import added; header expanded with D-03 + Pitfall #6 + LOG-07 citations)
    - js/ui/today-screen.js (+86 lines — render [edit][×] per row, '+ Add event' button, delegated handlers wiring openManualEntry + editEvent + deleteEvent + addEventAt)
    - index.html (+44 lines — <dialog id='manualEntry'> with form (date + HH/MM number inputs with min/max/step + 4-option type select + Save/Cancel menu) + '+ Add event' button in no-JS skeleton)
    - style.css (+125 lines — .rowEdit, .rowDel, .addEventBtn, #manualEntry + ::backdrop + form fields)
    - tests/integration/event-log.test.js (+128 lines — 12 new assertions covering addEventAt(5) + editEvent(5) + deleteEvent(3))

key-decisions:
  - "formnovalidate on Save button — emerged from Task 3 spec run. HTML5 step='5' on the minute input blocked submit of non-5-min values, but Open Question #2 + LOG-07 require silent rounding. Bypassing HTML5 validation on Save with JS-level guards replacing it preserves both the grep-gate (step='5' still present in HTML for arrow-stepping UX) and the silent-rounding contract."
  - "JS-level required + range guards in onClose handler — formnovalidate would otherwise allow empty submissions. Defense at the JS layer where the contract already lives."
  - "Refactor folded into GREEN commit for Task 1 — persist() helper already existed from Plan 01; D-03 + Pitfall #6 + LOG-07 citations added to the file header as part of the GREEN commit. Matches the Plan 01-02 pattern."
  - "TDD discipline for Task 1 only — Tasks 2 and 3 are UI / E2E (test-after with E2E as regression guard per PLAT-11)."

requirements-completed:
  - LOG-05
  - LOG-06

threats-mitigated:
  - T-02 (parseLocalISO reused on addEventAt + editEvent at-string inputs; integration tests assert rejection of '2026/05/25T06:35' wrong-separator)
  - T-05 / Pitfall #6 (edit-creates-duplicate — mitigated FOUR ways: (a) explicit mode parameter at modal entry, (b) D-03 mutate-in-place events[i] = next in store, (c) integration test asserts events.length === 1 after edit, (d) E2E spec confirms the same end-to-end + reload-persistence)
  - T-07 (every form value assignment via .value property; row affordance labels via .textContent; grep gate `! grep -E '\.innerHTML\s*=\s*[^"]' js/` returns zero matches)

duration: ~14 min
completed: 2026-05-26
---

# Phase 1, Plan 04: Manual Entry + Edit + Delete Summary

**Completed the Phase 1 vertical slice by landing the native `<dialog>`-based manual-entry modal + per-row [edit] / [×] affordances + the addEventAt / editEvent / deleteEvent store methods. Mitigates Pitfall #6 / T-05 (edit-creates-duplicate) at FOUR layers: explicit-mode UI parameter, mutate-in-place store implementation, integration test asserting events.length unchanged, and an E2E regression guard.**

## Performance

- **Duration:** ~14 minutes wall-clock
- **Tasks:** 3 (1 TDD red→green + 2 test-after with E2E regression guards)
- **Commits:** 4 (1 RED, 1 GREEN store, 1 GREEN UI/modal, 1 GREEN E2E spec + Rule 1 auto-fix)
- **Test delta:** 55 → 80 node:test (+25 across event-log.test.js + manual-entry.test.js); 7 → 13 Playwright (+6 manual-entry.spec.js)

## Accomplishments

- **LOG-05 manual entry lands.** Users can open the modal via `+ Add event` at the bottom of the day list, fill in date + hour + minute + type, and save. The event flows through `addEventAt(type, atString)` → `parseLocalISO` (T-02 regex gate) → `roundTo5` → persisted via the existing `persist()` helper. Past-day back-fill works the same way (no special handling needed — the bucketer is calendar-date based and the store doesn't restrict the at field's date).
- **LOG-06 delete lands.** Each row exposes `<button class="rowDel" data-event-id="…">×</button>`. Click → `window.confirm` (Open Question #3 Phase 1 acceptable) → `eventLog.deleteEvent(id)` → row disappears → blob written. Reload confirms the delete persists (D-05 invariant).
- **D-03 mutate-in-place verified at every layer.** `editEvent(id, patch)` finds the record by id, spreads the patch, re-rounds the at field, and assigns at the SAME array index via `events[i] = next`. Splice + push (the Pitfall #6 root cause) is explicitly rejected — both the source comment and the test assertion document this. `deleteEvent` mirrors with `events.splice(i, 1)` at the same index.
- **Pitfall #6 / T-05 mitigated at 4 layers.**
  1. **UI architectural:** `openManualEntry({ mode, ... })` requires `mode` and throws if it's not exactly `'add'` or `'edit'`. The dispatch branches on this explicit parameter, not on `existing ? edit : add`.
  2. **Store implementation:** `events[i] = next` at the same array index (no splice+push).
  3. **Integration test:** `tests/integration/manual-entry.test.js` asserts `log.listEvents().length === 1` after edit.
  4. **E2E test:** `tests/e2e/manual-entry.spec.js` spec 3 logs one event via quick-log, clicks `[edit]`, saves, asserts exactly 1 row, reloads, asserts still exactly 1 row.
- **LOG-07 enforced at every write path.** `addEventAt` and `editEvent` both call `formatLocalISO(roundTo5(parseLocalISO(at)))`. The modal additionally normalizes via `Math.round(rawMinute / 5) * 5` BEFORE calling onSave (so the UI value the next-open shows is stable). Defense in depth — even if the modal normalizer were bypassed, the store's roundTo5 would still produce a 5-min-aligned canonical value.
- **T-07 XSS-by-construction holds.** All modal form value assignments use `.value` (property, never `innerHTML`). Row affordance labels (`edit`, `×`) are static literals via `el({ textContent })`. The title swap (`'Add event'` ↔ `'Edit event'`) uses `.textContent`. `grep -RnE '\.innerHTML\s*=\s*[^"]' js/` returns zero matches — invariant intact across all of Phase 1.
- **Native `<dialog>` ergonomics free.** Focus trap, ESC-to-close, `aria-modal="true"` are all automatic via `showModal()` (RESEARCH §Pattern 6 + V14 zero-deps modal accessibility). The dialog has a backdrop, ESC closes with empty returnValue (treated as cancel), and the form's `method="dialog"` makes the Save button's `value="save"` become the close returnValue.
- **No regression on Plans 01-01/02/03.** `node --test` 80/80 (was 55/55 before this plan). `npx playwright test` 13/13 (was 7/7 — `reload.spec.js` 1 + `quick-log.spec.js` 6 + new `manual-entry.spec.js` 6).

## Task Commits

1. **Task 1 — store addEventAt + editEvent (mutate-in-place) + deleteEvent (TDD RED→GREEN):**
   - RED: `8a23b9d` `test(NW-01-01-04): LOG-05,LOG-06 + Pitfall #6 add failing integration tests for addEventAt+editEvent+deleteEvent`
     - 12 new assertions in `tests/integration/event-log.test.js` + 13 in new `tests/integration/manual-entry.test.js`. RED confirmed: 25 failures all matching `is not a function`.
   - GREEN: `062bb37` `feat(NW-01-01-04): LOG-05,LOG-06 addEventAt+editEvent (mutate-in-place)+deleteEvent per D-03,D-13`
     - Implementation per RESEARCH §Pattern 5. 80/80 node:test green.
   - Refactor: folded into GREEN per Plan 01-02 pattern (`persist()` helper already existed from Plan 01; header expanded with D-03 + Pitfall #6 + LOG-07 in the GREEN commit).
2. **Task 2 — native `<dialog>` modal + per-row [edit][×] affordances:**
   - GREEN: `6a0d415` `feat(NW-01-01-04): LOG-05,LOG-06 manual entry modal + edit + delete affordances per D-10,D-12,D-13,D-14`
     - 4 files modified (+376 lines). All grep gates pass (`<dialog id="manualEntry"`, `showModal`, `mode === 'add'/'edit'`, `Math.round`, `gsd:allow-ui-clock`, `rowEdit`, `rowDel`, `addEventBtn`, `+ Add event`, `window.confirm`).
3. **Task 3 — Playwright manual-entry.spec.js (6 specs) + Rule 1 auto-fix:**
   - GREEN: `f6dbf0b` `test(NW-01-01-04): LOG-05,LOG-06 e2e manual entry+edit-no-duplicate+delete per Pitfall #6,#8`
     - 6 specs all green; full Playwright suite 13/13.
     - Rule 1 auto-fix folded in: HTML5 `step="5"` was blocking form submit of non-5 minute values, violating the Open Question #2 / LOG-07 silent-rounding contract. Added `formnovalidate` to the Save button (so HTML5 validation doesn't block the JS normalizer from receiving the raw value) + JS-level required + range guards in the close handler (defense against the formnovalidate bypass).

## Files Created / Modified

See `key-files` in frontmatter. Net change: 3 new files (`js/ui/manual-entry.js`, `tests/integration/manual-entry.test.js`, `tests/e2e/manual-entry.spec.js`), 5 modified (`js/store/event-log.js`, `js/ui/today-screen.js`, `index.html`, `style.css`, `tests/integration/event-log.test.js`).

## Decisions Made

- **`formnovalidate` on Save button.** Surfaced during Task 3 spec run. The HTML5 `step="5"` constraint on the minute input was blocking form submission for non-5-min values, but the Open Question #2 / LOG-07 contract is "silently round on save". The cleanest reconciliation: keep `step="5"` (still drives the arrow-stepping UX and satisfies the plan's grep gate `min="0" max="55" step="5"`) but add `formnovalidate` on Save so HTML5 validation doesn't block the JS normalizer from receiving the raw value. JS-level required + range guards replace the HTML5 validation in the close handler so the dispatch path remains safe.
- **Skip explicit REFACTOR commit for Task 1.** Same rationale as Plan 01-02: the `persist()` helper already existed from Plan 01, and the header citation block (D-03 + Pitfall #6 + LOG-07) was folded into the GREEN commit message. Splitting into a no-op refactor commit would have been ceremonial.
- **TDD discipline for Task 1 only.** Tasks 2 (UI modal) and 3 (E2E) are test-after with E2E as the regression guard per PLAT-11. The plan's `tdd="true"` attribute appears only on Task 1, matching the plan's explicit intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] HTML5 `step="5"` constraint blocked Open Question #2 / LOG-07 silent-rounding contract**
- **Found during:** Task 3 spec 2 run (`submit modal with minute=33 → event saved with minute=35`)
- **Issue:** The plan specifies `step="5"` on the minute input AND silent rounding of non-5 values on save. With HTML5 form validation active, the browser refused to submit `minute=33` — the modal never closed and the JS normalizer never ran. The test failed with `'[data-role="events"]' contained empty string` because no event was added.
- **Fix:** Added `formnovalidate` to the Save button so HTML5 validation doesn't block submit. Added JS-level required-field and range guards in the close handler so the formnovalidate bypass doesn't allow truly invalid submissions. The `step="5"` HTML attribute remains (drives arrow-stepping UX + satisfies plan grep gate).
- **Files modified:** `index.html` (+1 attribute on Save button + clarifying comment), `js/ui/manual-entry.js` (+JS-level required/range guards in onClose).
- **Verification:** Spec 2 now passes; specs 5 (cancel) and 6 (ESC) still pass (returnValue !== 'save' short-circuits before any validation).
- **Folded into commit:** `f6dbf0b` (Task 3) — caught and fixed as part of the same task.

### Out-of-Scope Discoveries

None. The `nw-research-test/` directory at repo root remains untracked, pre-existing scratch work unrelated to this plan.

---

**Total deviations:** 1 auto-fixed (silent-rounding contract; functional fix)
**Impact on plan:** None on stated intent. The fix preserves all grep gates and all stated behaviors; the only change is the HTML5 → JS handover for the validation pipeline.

## Issues Encountered

- **Long file-system Windows path warnings on `git commit` (`LF will be replaced by CRLF`).** Same as Plan 01-01 / 01-02 / 01-03. Cosmetic only.

## TDD Gate Compliance

Plan type is `execute`, not `tdd`, so plan-level TDD gate enforcement doesn't apply. Task 1 nevertheless followed strict RED→GREEN per its own `tdd="true"` attribute:

- Task 1: `test(NW-01-01-04)` 8a23b9d (25 failing) → `feat(NW-01-01-04)` 062bb37 (80/80 green) ✓

Tasks 2 and 3 are non-TDD per plan (UI test-after with E2E as the regression guard per PLAT-11). Single feat/test commits each.

## Known Stubs

None. Plan 01-04 lands the full LOG-05 / LOG-06 / LOG-07 user-visible behavior. Phase 1 is now functionally complete from the user's perspective — only Plan 01-05 hardening (persistence smoke + security smoke + supply-chain CI + README) remains.

## User Setup Required

None — no external services, no env vars, no migrations. The Phase 1 stack remains zero-runtime-dependency.

## Next Phase Readiness

- **Plan 01-05 (Wave 4)** — persistence smoke + security smoke + supply-chain CI + README — can start immediately. The manual-entry spec is the regression guard for LOG-05 / LOG-06; Plan 05 will add the security-smoke gate that greps for `// gsd:allow-ui-clock` (which is present in `js/ui/manual-entry.js`).
- **No regression on prior plans:** node:test 80/80, Playwright 13/13. The full pyramid is green.
- **Open follow-up carried from Plan 01-01:** First green CI run on `main` still pending GitHub Actions recovery. Not blocking.

## Self-Check: PASSED

**Created files verified to exist:**
- FOUND: `js/ui/manual-entry.js`
- FOUND: `tests/integration/manual-entry.test.js`
- FOUND: `tests/e2e/manual-entry.spec.js`

**Modified files verified:**
- FOUND: `js/store/event-log.js` (now exports addEventAt + editEvent + deleteEvent — Object.keys check confirmed 7 methods)
- FOUND: `js/ui/today-screen.js` (now contains rowEdit + rowDel + addEventBtn + window.confirm + openManualEntry import)
- FOUND: `index.html` (now contains `<dialog id="manualEntry">` with min/max/step bounds; no `<input type="time">`)
- FOUND: `style.css` (now contains #manualEntry, .rowEdit, .rowDel, .addEventBtn)
- FOUND: `tests/integration/event-log.test.js` (now 27 assertions across 8 describe blocks including 5 addEventAt + 5 editEvent + 3 deleteEvent)

**Commits verified in `git log`:**
- FOUND: 8a23b9d (RED Task 1)
- FOUND: 062bb37 (GREEN Task 1)
- FOUND: 6a0d415 (GREEN Task 2)
- FOUND: f6dbf0b (GREEN Task 3 + Rule 1 fix)

**Acceptance gates:**
- FOUND: `node --test` exits 0 with 80/80 passing
- FOUND: `npx playwright test` exits 0 with 13/13 passing
- FOUND: `events.splice(i, 1)` present in event-log.js (D-03 delete)
- FOUND: `events[i] = next` present in event-log.js (D-03 edit, Pitfall #6 mitigation visible)
- FOUND: `showModal` present in manual-entry.js (RESEARCH §Pattern 6)
- FOUND: `mode === 'add'` AND `mode === 'edit'` both present in manual-entry.js (Pitfall #6 mitigation visible)
- FOUND: `Math.round` present in manual-entry.js (LOG-07 silent rounding)
- FOUND: `window.confirm` present in today-screen.js (Open Question #3)
- FOUND: `// gsd:allow-ui-clock` literal tag present in manual-entry.js (Plan 05 security-smoke gate satisfied)
- FOUND: `<dialog id="manualEntry"` present in index.html
- FOUND: `min="0" max="23"` AND `min="0" max="55" step="5"` present in index.html (D-14 bounds)
- FOUND: no `<input type="time">` anywhere in index.html (D-14 rejection)
- FOUND: zero `\.innerHTML\s*=\s*[^"]` matches across `js/` (T-07 invariant project-wide)
- FOUND: E2E spec contains `page.on('dialog', d => d.accept())` (native confirm handling)
- FOUND: E2E spec contains `page.keyboard.press('Escape')` (RESEARCH §Pattern 6 ESC behavior)
- FOUND: E2E spec contains `events.length stays at 1` text (Pitfall #6 regression guard discoverable by grep)

---
*Phase: 01-log-persist · Plan: 04 (Manual Entry + Edit + Delete)*
*Completed: 2026-05-26*
