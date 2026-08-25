---
plan: 11-07
status: complete
completed: 2026-07-30
gap_closure: true
gap_ids: [G-NW-11-9]
---

# Plan 11-07 Summary — Stage Badge E2E Test & Fix

## What was done

**Task 1 — MET-06 E2E test** (commit `59099cb`)
Added a full end-to-end test in `tests/e2e/metrics.spec.js` covering the stage badge
visibility flow: seed events + stage → select stage from Today dropdown → badge shows
"Viewing: Work Week" on Metrics → deselect → badge hidden. All 4 metrics E2E tests pass.

**Task 2 — renderStageBadge() verification**
Confirmed the existing implementation in `js/ui/metrics-screen.js` is correct:
- reads `snap.activeStageId` and `snap.stages` from the settings snapshot
- shows badge with "Viewing: {name}" when a valid stage is active
- hides badge otherwise
No changes required.

**Issue fix during manual verification** (commit `b90c1e0`)
Browser DevTools reported a console warning: stage `<select>` had no `id` or `name`
attribute. Fixed `renderStageSelector` in `js/ui/today-screen.js` to set both
`id="stage-select"` and `name="stage-select"`.

## Manual verification result

PASS — full flow verified:
- badge hidden by default (no stage selected)
- badge shows "Viewing: s1" after selecting stage from Today dropdown
- badge hidden again after switching back to "All data"

## Gaps closed

| Gap ID | Description | Resolution |
|--------|-------------|------------|
| G-NW-11-9 | Stage badge E2E test missing (MET-06 deferred) | Test added and passing |

## Files changed

| File | Change |
|------|--------|
| `tests/e2e/metrics.spec.js` | Added MET-06 stage badge E2E test |
| `js/ui/today-screen.js` | Added `id`/`name` to stage select element |
