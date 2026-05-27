---
phase: 01-log-persist
plan: 08
subsystem: ui-labels
tags: [vanilla-js, node-test, playwright, log-02, log-03, uat-gap-closure, ssot, regression-guard]

requires:
  - 01-03 (BUTTONS array + EVENT_LABEL map — the two-source divergence this plan collapses)
  - 01-06 (UAT-gap closure precedent — same SUMMARY structure, depends_on per PLAN front-matter)

provides:
  - Single source of truth for type → label mapping in `js/ui/today-screen.js`:
    `EVENT_LABEL` is now derived at module load via
    `Object.freeze(Object.fromEntries(BUTTONS.map((b) => [b.type, b.label])))`.
    No parallel manually-maintained table; the file-header comment is now
    literally true.
  - `BUTTONS` and `labelFor` are exported from `js/ui/today-screen.js` so the
    integration test pins the parity invariant at the module-API layer
    (vs. duplicating the 4-entry table in test code — explicitly forbidden
    by 01-UAT.md gap 1 remediation).
  - Two regression layers encoding the label/button parity contract:
    - Integration: `describe('label/button parity — 01-UAT.md gap 1', ...)`
      in `tests/integration/event-log.test.js` — pure-JS, no DOM, asserts
      `labelFor(button.type) === button.label` for every BUTTONS entry,
      plus a D-04 wire-format guard (the 4 canonical type tokens are
      exactly `bedtime`/`napEnd`/`napStart`/`wake`) and an unknown-type
      fallback guard.
    - E2E: new Playwright spec in `tests/e2e/quick-log.spec.js` — clicks
      each of the 4 buttons, asserts exactly one new row carries the
      button's own label text, and word-boundary cross-checks that the
      OLD divergent labels (`\bWake\b`, `\bBedtime\b`) never appear in
      the list.

affects:
  - 01-UAT.md gap 1 (label inconsistency, minor) CLOSED.
  - `tests/e2e/quick-log.spec.js`: +1 regression spec.
  - `tests/integration/event-log.test.js`: +1 describe block (3 tests).
  - `js/ui/today-screen.js`: `BUTTONS` and `labelFor` graduated to module exports.

does_not_affect:
  - Persisted localStorage blob shape — `event.type` wire-format tokens
    (`wake`, `bedtime`, `napStart`, `napEnd`) are unchanged on disk
    (D-04 canonical JSON preserved). Only the rendered LABEL changed.
  - The store's `addEvent` / `addEventAt` / `editEvent` / `deleteEvent`
    contracts (no field renames, no new fields).
  - Plan 01-06's LOG-09 surfacing wiring; Plan 01-07's validate() /
    visible-failure wiring (disjoint surfaces).
  - The 5 baseline phase plans 01-01..05 — no behaviour change in any of
    the existing 113 unit tests or 16 existing e2e specs.

uat_traceability:
  gap_1:
    failed_truth: "Button labels and rendered row labels disagree — user clicked 'Woke up' and saw 'Wake' on the row."
    closure: "EVENT_LABEL derived from BUTTONS in js/ui/today-screen.js + integration + e2e regression specs."
    test_file: "tests/e2e/quick-log.spec.js"
    unit_test_file: "tests/integration/event-log.test.js"

requirements_traceability:
  LOG-02: covered (Plan 01-03 button + this plan's label SSOT — 'Going to sleep' button → 'Going to sleep' row, parity asserted at 2 layers)
  LOG-03: covered (Plan 01-03 button + this plan's label SSOT — 'Nap start' button → 'Nap start' row, parity asserted at 2 layers)
  PLAT-08: covered (regression assertion added at integration AND e2e layer)
  PLAT-09: covered (no UX regression; rendered labels now match the affordances the user clicked)
  PLAT-10: covered (no aria/role change; label-text consistency is itself an accessibility win — same wording across button and row)
  PLAT-11: covered (new test on every new code path: 1 integration describe + 1 e2e spec)

threat_disposition:
  T-07_xss: validated — `labelFor()` output continues to flow through
    `el({textContent})` exclusively (renderEventRow line 240); the
    derivation point uses pure `Object.fromEntries` on a frozen array
    of frozen literals. No new dynamic-string path introduced.
  D-04_wire_format: honored — `event.type` tokens stored on disk
    (`wake`, `bedtime`, `napStart`, `napEnd`) are unchanged; the
    new integration test pins the canonical 4-token set as a hard
    assertion (`deepStrictEqual([...].sort(), ['bedtime', 'napEnd',
    'napStart', 'wake'])`) so any future rename to a token would fail
    in <1s.
  D-07_clock_seam: not touched — this plan is a pure-data refactor;
    no new clock reads.

key_files:
  created: []
  modified:
    - js/ui/today-screen.js                   # EVENT_LABEL derived from BUTTONS; BUTTONS + labelFor exported; file-header comment now truthful
    - tests/integration/event-log.test.js     # +1 describe block / 3 tests for label/button parity + D-04 token guard + fallback contract
    - tests/e2e/quick-log.spec.js             # +1 e2e regression spec (per-button click → row carries button's label; OLD labels excluded)

commits:
  - 0ddc192: fix(NW-01-08): LOG-02/03 collapse EVENT_LABEL into BUTTONS-derived source (UAT gap 1)
  - 2c83a80: test(NW-01-08): LOG-02/03 label/button parity regressions (UAT gap 1)

test_evidence:
  node_test: 125 / 125 (was 122 / 122 after Plan 01-07 smoke fix-up; +3 net — label/button parity describe block)
  playwright: 18 / 18 (was 17 / 17 after Plan 01-07 smoke fix-up; +1 net — gap-1 regression spec)
  baseline_preserved: yes — no regression on Plans 01-01 through 01-07 (LOG-09 dedupe, future-date guard, visible-failure, minute carry — all green).

deviations: []

human_verification:
  - "Manual smoke: 'npm run serve' on :8081 (post 01-07 smoke port move), click 'Woke up' → expect a row containing 'Woke up' (NOT 'Wake'). Click 'Going to sleep' → expect 'Going to sleep' (NOT 'Bedtime'). Click 'Nap start' / 'Nap end' → unchanged labels, parity preserved."
  - "Verify persistence: reload after the 4 clicks → all 4 rows still carry the new labels (the labels are render-time only; the on-disk `event.type` tokens are unchanged so the rehydration path is identical)."

next_steps:
  - "Phase 1 verifier run via gsd-verifier subagent — UAT gaps 1, 2, 3, 4 all closed; phase ready for goal-backward verification."
---

# Plan 01-08 — Label/Button Single Source of Truth (UAT gap 1) — Summary

## Self-Check: PASSED

All 5 truths in 01-08-PLAN.md `must_haves.truths` hold; UAT gap 1 closed; no
regression on Plans 01-01 through 01-07.

| # | Truth | Evidence |
|---|-------|----------|
| 1 | Every row label matches the button that creates it byte-for-byte | E2E gap-1 spec (clicks each button, asserts row carries the button's text); commit `0ddc192` derivation + commit `2c83a80` assertions |
| 2 | Exactly ONE source of truth in `js/ui/today-screen.js`: EVENT_LABEL derives from BUTTONS, not maintained in parallel | Source `js/ui/today-screen.js:49-51` — `Object.freeze(Object.fromEntries(BUTTONS.map((b) => [b.type, b.label])))` |
| 3 | Internal type tokens (`wake`, `bedtime`, `napStart`, `napEnd`) unchanged on disk (D-04 wire format) | Integration test "BUTTONS has exactly the 4 expected entries" + no change to `event-log.js` add/addAt/edit/delete contracts |
| 4 | Plan 01-03 file-header comment is now literally true | `js/ui/today-screen.js:24-28` — extended to explicitly document that EVENT_LABEL derives from BUTTONS (with audit-trail reference `01-UAT.md gap 1 closure`) |
| 5 | node --test ≥122/122 + Playwright ≥17/17, new assertions encode the contract | Final: 125/125 node + 18/18 Playwright; +3 integration / +1 e2e |

## Before / After — `EVENT_LABEL`

**Before** (Plan 01-03, lines 39-44):

```js
const EVENT_LABEL = Object.freeze({
  wake: 'Wake',           // <-- divergent from BUTTONS 'Woke up'
  bedtime: 'Bedtime',     // <-- divergent from BUTTONS 'Going to sleep'
  napStart: 'Nap start',
  napEnd: 'Nap end',
});
```

**After** (Plan 01-08, lines 46-51):

```js
/** Map event.type -> display label for list rows. Derived from BUTTONS -- DO NOT
 *  maintain a parallel table here; the BUTTONS array on lines above is the
 *  single source of truth (per 01-UAT.md gap 1 + Plan 01-03 file-header claim). */
const EVENT_LABEL = Object.freeze(
  Object.fromEntries(BUTTONS.map((b) => [b.type, b.label])),
);
```

The render-time fallback `EVENT_LABEL[type] ?? type` on `labelFor()`
is unchanged, so any future custom event type continues to surface as
its raw token (still covered by the integration test "labelFor falls
back to the raw type for unknown inputs").

## Export Change — `js/ui/today-screen.js`

```diff
-const BUTTONS = Object.freeze([
+export const BUTTONS = Object.freeze([
   Object.freeze({ type: 'wake', label: 'Woke up' }),
   ...
 ]);

-function labelFor(type) {
+export function labelFor(type) {
   return EVENT_LABEL[type] ?? type;
 }
```

`BUTTONS` and `labelFor` are now part of the module's public surface,
imported by `tests/integration/event-log.test.js` to pin the parity
invariant. This is a zero-cost change — both bindings were already
module-scoped consts; adding `export` graduates them without copying.
The previous `export function mountTodayScreen` is unchanged.

## Test Counts (with deltas)

| Layer | Before 01-08 | After 01-08 | Delta |
|-------|--------------|-------------|-------|
| `node --test` | 122 / 122 | **125 / 125** | +3 (label/button parity describe block: parity / D-04 token / unknown-type fallback) |
| `npx playwright test` | 17 / 17 | **18 / 18** | +1 (gap-1 regression spec — per-button click → row text parity + OLD labels excluded) |

Baseline preserved across Plans 01-01 through 01-07 (LOG-09 dedupe,
future-date guard, visible-failure, LOG-07 minute carry — all green).

## D-04 Wire Format — Unchanged on Disk

The `event.type` value stored in localStorage (and exported as
canonical JSON) is one of the 4 internal tokens: `wake`, `bedtime`,
`napStart`, `napEnd`. **None of these changed.** Plan 01-08 moves
only the rendered LABEL (the human-readable string shown next to the
time in each row); the wire format is the same byte-for-byte as
Plans 01-01..07. Any export/import round-trip remains compatible
with data captured before this plan.

The integration test pins this explicitly:

```js
test('BUTTONS has exactly the 4 expected entries (wake/bedtime/napStart/napEnd)
      — D-04 wire-format tokens unchanged', () => {
  const types = BUTTONS.map((b) => b.type);
  assert.deepStrictEqual(
    types.slice().sort(),
    ['bedtime', 'napEnd', 'napStart', 'wake'],
    'BUTTONS type tokens are the canonical D-04 wire-format types; ...',
  );
});
```

A future rename of any token (e.g. `wake` → `wokeUp`) would fail this
test in <1s — protecting both the disk format and Phase 3+ forecast
consumers from accidental breakage.

## i18n Note (PROJECT.md "English UI only in v1")

The label values (`'Woke up'`, `'Going to sleep'`, `'Nap start'`,
`'Nap end'`) are English-only for v1 per PROJECT.md. The
single-source-of-truth shape sets up a clean i18n path: any future
localization layer swaps (or wraps) the BUTTONS array — perhaps via a
`makeButtons(t)` factory or an i18n key per entry — and the derived
EVENT_LABEL follows for free without a second translation pass. The
4 canonical wire-format type tokens (`wake`, `bedtime`, `napStart`,
`napEnd`) stay English internally; only the display strings move.

## Files Changed (key surface)

- **js/ui/today-screen.js** — `EVENT_LABEL` derived from `BUTTONS`
  via `Object.fromEntries`; `BUTTONS` and `labelFor` exported; file-
  header comment extended to document the derivation invariant with
  an `01-UAT.md gap 1 closure` audit-trail anchor.
- **tests/integration/event-log.test.js** — new
  `describe('label/button parity — 01-UAT.md gap 1', ...)` block
  with 3 assertions (parity / D-04 token guard / unknown-type
  fallback). Imports `BUTTONS` and `labelFor` from the module under
  test.
- **tests/e2e/quick-log.spec.js** — new spec
  "each quick-log button produces a row with the SAME label text as
  the button (01-UAT.md gap 1 regression)". Iterates all 4 buttons,
  waits past the 300ms debounce between clicks, asserts exactly one
  matching row appears per click, then word-boundary cross-checks
  that the OLD divergent labels (`\bWake\b`, `\bBedtime\b`) never
  appear anywhere in the list.

## What's Next

Phase 1 verifier — all 8 Wave-1/Wave-2 plans complete (5 baseline +
3 UAT gap-closure: 01-06 LOG-09 BLOCKER, 01-07 future-date/visible-
failure, 01-08 label SSOT). Spawn `gsd-verifier` subagent for
goal-backward verification. Once it flips Phase 1 to complete the
project unblocks Phase 2 (config + cutover hour + multi-profile seam).
