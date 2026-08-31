---
phase: NW-12
plan: "03"
subsystem: ui
status: complete
tags: [pred-10, intense-day, manual-entry, history-screen, checkbox, badge]
dependency_graph:
  requires:
    - NW-12-01  # forecast.js intense-day support (selectNextEvent, annotateIntense)
    - NW-12-02  # day-bucket annotateIntense, intenseDays in settings schema
  provides:
    - Intense-day checkbox in event-entry modal (D-04)
    - Intense-day removable badge in history table (D-05)
  affects:
    - js/ui/manual-entry.js
    - js/ui/history-screen.js
    - index.html
    - style.css
tech_stack:
  added: []
  patterns:
    - Read-before-write guard on settings.get() before every settings.update()
    - textContent-only XSS invariant maintained (no innerHTML for dynamic values)
    - Badge uses day.date from record (not DOM) to avoid stale-reference tampering
key_files:
  created: []
  modified:
    - index.html
    - js/ui/manual-entry.js
    - js/ui/history-screen.js
    - style.css
decisions:
  - Pre-check logic uses existing.at.slice(0,10) for edit mode and dateInput.value for add mode
  - Intense-day mutation guarded — settings.update only called when state actually changed
  - tr.intense class added via array join (preserves 'rejected' class independently)
  - No visual styling for tr.intense beyond badge (per UI-SPEC instruction)
metrics:
  duration_minutes: 5
  completed_date: "2026-08-25"
  tasks_completed: 2
  files_modified: 4
---

# Phase 12 Plan 03: Intense-Day UI Summary

**One-liner:** Intense-day checkbox in the event-entry modal and removable indigo badge in the history table, completing the PRED-10 write/audit round-trip.

## What Was Built

### Task 1 — Intense-day checkbox in #manualEntry modal (D-04)

**index.html:** Added `<label class="checkboxRow"><input type="checkbox" id="intenseDay" name="intenseDay"> Intense day</label>` before the `<output id="manualEntryErrors">` block.

**js/ui/manual-entry.js — two changes:**

1. **Pre-check on open:** After form field population, reads `settings.get().intenseDays` and sets `intenseDayCheck.checked` based on whether the event's calendar date is already in the array. For edit mode uses `existing.at.slice(0, 10)`; for add mode uses the current `dateInput.value` (today by default).

2. **Save-time mutation:** In the `onClose` save path, after `onSave()` fires, reads `form.elements.namedItem('date').value` as the saved date, calls `settings.get().intenseDays` fresh (read-before-write), then:
   - If checked and date not in list → `settings.update({ intenseDays: [...current, savedDate] })`
   - If unchecked and date in list → `settings.update({ intenseDays: current.filter(d => d !== savedDate) })`
   - Otherwise → no `settings.update` call (no spurious subscriber fires)

### Task 2 — Intense-day badge in history-screen and CSS (D-05)

**js/ui/history-screen.js:**

- `buildDayRow` now builds the `tr` class string via array join, adding `'intense'` when `day.intense === true` (independent of `'rejected'`).
- Date cell is now built inline (replacing the `appendCell` helper call) so the badge can be appended inside it.
- When `day.intense === true`, a `<button class="intenseBadge">` is created with:
  - `textContent = 'Intense'` (static literal, XSS-safe)
  - `aria-label` set via `setAttribute` with `day.date` (YYYY-MM-DD from record)
  - Click handler: reads `settings.get().intenseDays` then calls `settings.update` with the date filtered out

**style.css:** Added `.intenseBadge` rule block (`#eef2ff` background, `#4338ca` color, `1px solid #c7d2fe` border, `9999px` border-radius, `0.875rem` font-size, `28px` min-height) plus `:hover` and `:focus-visible` states.

## Verification

- `npm run test:unit` passes: 674 tests, 0 failures (both tasks)
- Source assertions:
  - `grep -c "intenseBadge" js/ui/history-screen.js` → 2
  - `.intenseBadge` rule with `background: #eef2ff` present in style.css
- index.html contains `<input type="checkbox" id="intenseDay" name="intenseDay">` inside `#manualEntry`

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| Task 1 | 8b51aac | index.html, js/ui/manual-entry.js | Intense-day checkbox in modal |
| Task 2 | 42b071a | js/ui/history-screen.js, style.css | Badge in history table + CSS |

## Known Stubs

None.

## Threat Flags

None — all T-12-03 mitigations implemented as planned (textContent only for badge, day.date from record not DOM, read-before-write on settings).

## Self-Check: PASSED

- [x] `index.html` contains `id="intenseDay"` checkbox
- [x] `js/ui/manual-entry.js` has intense-day pre-check and save mutation
- [x] `js/ui/history-screen.js` has intenseBadge button and `intense` tr class
- [x] `style.css` has `.intenseBadge` rule
- [x] Commits 8b51aac and 42b071a exist in git log
- [x] `npm run test:unit` exits 0 (674 pass, 0 fail)
