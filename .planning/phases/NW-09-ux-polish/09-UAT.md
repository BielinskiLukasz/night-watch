# Phase 9 UAT — UX Polish

**Session started:** 2026-07-10
**Tester:** Łukasz Bielński
**App URL:** http://localhost:8081
**Status:** COMPLETE — 13/13 passed (2 bugs fixed during session)

## Test Suite

| # | Feature | Requirement | Result |
|---|---------|-------------|--------|
| 1 | History edit-mode toggle — default hidden | UI-07 | ✅ pass |
| 2 | History edit-mode toggle — "Edit history" → "Done editing" label flip | UI-07 | ✅ pass |
| 3 | History edit-mode toggle — state resets on tab switch | UI-07 | ✅ pass (bug fixed) |
| 4 | "+ Add event" button above forecast cards | UI-08 | ✅ pass (cosmetic spacing fixed) |
| 5 | "Next Predicted Event" hero label | UI-10 | ✅ pass |
| 6 | Probability-band card collapsed by default | UI-09 | ✅ pass |
| 7 | Collapsed card tap-to-expand and re-collapse | UI-09 | ✅ pass |
| 8 | "Time & Day" fieldset in Settings (renamed) | CFG-10 | ✅ pass |
| 9 | "Confirm before logging" toggle OFF — quick-log logs instantly | CFG-10 / LOG-10 | ✅ pass |
| 10 | "Confirm before logging" toggle ON — quick-log opens pre-filled dialog | CFG-10 / LOG-10 | ✅ pass (bug fixed) |
| 11 | "Save more" button visible via "+ Add event" | LOG-11 | ✅ pass |
| 12 | "Save more" advances type sequence and keeps dialog open | LOG-11 | ✅ pass |
| 13 | "Save more" absent when confirm-before-logging path | LOG-11 | ✅ pass |

## Bugs Found and Fixed

### Bug 1 — Edit mode not resetting on tab switch (UI-07 / D9-04)
**Symptom:** After entering edit mode on History, switching to Today and back kept the button as "Done editing" with controls still visible.
**Root cause:** The tab system uses CSS show/hide, not DOM remounting. The `editMode` local variable in `mountHistoryScreen` was never reset.
**Fix:** `mountHistoryScreen` now returns `resetEditMode()`. `app.js` calls it via `onTabChange` whenever the user leaves the History tab.
**Commits:** `3866bac`

### Bug 2 — Confirm-before-logging dialog not pre-filling type or time (LOG-10 / CFG-10)
**Symptom:** Dialog opened with empty time fields and always showed "Woke up" regardless of which quick-log button was clicked.
**Root cause:** `openManualEntry` pre-fill was gated on `mode === 'edit' && existing`. The confirm-before-logging path uses `mode: 'add'` with `existing` set, so the condition was never true.
**Fix:** Broadened condition to `if (existing)` — pre-fills whenever an existing object is provided, regardless of mode.
**Commits:** `cbd225f`

## Cosmetic Fix

### Spacing below "+ Add event" button (UI-08)
**Symptom:** No visual gap between the "+ Add event" button and the hero card below it.
**Fix:** Added `margin-bottom: 1rem` to `.addEventBtn` in style.css.
