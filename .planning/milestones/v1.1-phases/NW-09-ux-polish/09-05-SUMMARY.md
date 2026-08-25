---
phase: NW-09
plan: "05"
subsystem: manual-entry, today-screen
tags: [LOG-11, bulk-entry, save-more, manual-entry]
requires: ["09-04"]
provides: [save-more-button, nextInSequence, advanceDateByOneDay]
affects: [index.html, js/ui/manual-entry.js, js/ui/today-screen.js, style.css]
tech_stack:
  added: []
  patterns: [tdd, module-level-handler-ref, sequence-advancement, date-arithmetic]
key_files:
  created:
    - tests/unit/manual-entry-save-more.test.js
  modified:
    - index.html
    - js/ui/manual-entry.js
    - js/ui/today-screen.js
    - style.css
decisions:
  - "D9-10: SAVE_MORE_SEQUENCE = ['wake','napStart','napEnd','bedtime'] — fixed advancement order"
  - "D9-11: advanceDateByOneDay uses T12:00 noon to avoid DST boundary ambiguity"
  - "Module-level _saveMoreHandler ref pattern (removeEventListener before re-attaching) prevents accumulation across repeated openManualEntry calls"
  - "nextInSequence('unknown') returns 'wake' via (-1+1)%4=0 modulo arithmetic — no special-case needed"
metrics:
  duration_seconds: 636
  completed_date: "2026-07-10"
  tasks_completed: 1
  files_modified: 4
status: complete
---

# Phase 9 Plan 05: Save More Button (LOG-11) Summary

**One-liner:** `#saveMoreBtn` added to manual-entry dialog — saves current event, keeps dialog open, and advances type through Wake → Nap start → Nap end → Bedtime → Wake; increments date after Bedtime.

**Requirements met:** LOG-11

## Changes

- `index.html`: `#saveMoreBtn` button inserted between Cancel and Save in the `manualEntry` `<menu>`. Hidden by default (`style="display:none"`); `openManualEntry` shows/hides it via `saveMoreBtn.style.display`.

- `js/ui/manual-entry.js`:
  - Module-level `_saveMoreHandler` reference (prevents listener accumulation across repeated opens)
  - `SAVE_MORE_SEQUENCE = Object.freeze(['wake','napStart','napEnd','bedtime'])` constant
  - `nextInSequence(currentType)` function — advances type in fixed sequence; unknown types fall back to `'wake'` via modulo arithmetic
  - `advanceDateByOneDay(dateStr)` function — DST-safe date advancement using `T12:00` noon trick
  - `openManualEntry` signature updated: `saveMore = false` parameter added
  - Show/hide logic: `if (saveMoreBtn) saveMoreBtn.style.display = saveMore ? '' : 'none'`
  - `onSaveMore` handler: validates via same `validate()` function as regular Save path; on success calls `onSave`, advances type, increments date after `bedtime`, clears hour/minute, resets ampmSelect, focuses `hourInput`; on failure shows inline errors without closing dialog
  - Named exports added: `export { nextInSequence, advanceDateByOneDay }`

- `js/ui/today-screen.js`: `addEventBtn` click handler updated to pass `saveMore: true` and `clock`. The confirm-before-logging path (from Plan 09-04) does not pass `saveMore` (D9-08).

- `style.css`: `#saveMoreBtn` base styles (padding, font-size, font-weight, background, border, color, border-radius, cursor) and `:hover` rule added after existing modal menu button rules.

## Tests

- All 531 unit + integration tests pass (0 failures), up from 521 in Plan 09-04
- `tests/unit/manual-entry-save-more.test.js` (new, 10 tests):
  - `nextInSequence`: wake→napStart, napStart→napEnd, napEnd→bedtime, bedtime→wake, unknown→wake, ''→wake
  - `advanceDateByOneDay`: regular day, year-end rollover (2026-12-31→2027-01-01), month-end rollover, leap year (2024-02-28→2024-02-29)

## TDD Gate Compliance

- RED gate: `test(NW-09-05)` commit `382d5b1` — failing tests created first
- GREEN gate: `feat(NW-09-05)` commit `72de244` — implementation made tests pass

## Deviations from Plan

None — plan executed exactly as written. The `advanceDateByOneDay` function used an internal `pad2` alias (instead of reusing the outer `pad`) to avoid shadowing the module-scope `pad` function that serves validate + UI prefill. Functionally identical.

## Threat Mitigations Applied

- T-09-05-01: `onSaveMore` validates all four fields via the same `validate()` function as the regular Save path before calling `onSave`
- T-09-05-02: `dateInput.value` set via `.value` property (never innerHTML); `advanceDateByOneDay` result used directly
- T-09-05-03: `_saveMoreHandler` module-level ref + `removeEventListener` before re-attaching prevents unbounded listener growth

## Commits

- `382d5b1` — test(NW-09-05): add failing tests for nextInSequence + advanceDateByOneDay
- `72de244` — feat(NW-09-05): Save more button for bulk event entry (LOG-11)

## Self-Check

- [x] `index.html` contains `id="saveMoreBtn"` button between Cancel and Save
- [x] `js/ui/manual-entry.js` contains `saveMore = false` in signature
- [x] `js/ui/manual-entry.js` contains `saveMore` in at least 3 places (8 actual)
- [x] `js/ui/today-screen.js` contains `saveMore: true` exactly once (addEventBtn handler)
- [x] confirm-before-logging path does NOT pass `saveMore: true`
- [x] `style.css` contains `#saveMoreBtn` rule
- [x] All 531 unit + integration tests pass
- [x] `nextInSequence('bedtime') === 'wake'` (verified by unit test)
- [x] `advanceDateByOneDay('2026-12-31') === '2027-01-01'` (verified by unit test)
