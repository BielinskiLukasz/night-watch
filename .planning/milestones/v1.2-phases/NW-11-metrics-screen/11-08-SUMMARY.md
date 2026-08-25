---
phase: 11
plan: 08
subsystem: metrics-screen
tags: [ui-layout, gap-closure, cosmetic]
dependency_graph:
  requires: [phase-10-complete]
  provides: [centered-buttons, reduced-gutters, correct-column-order]
  affects: [Today screen, Metrics screen, all screens]
tech_stack:
  added: []
  patterns: [CSS flexbox justify-content, JavaScript array reordering]
key_files:
  created: []
  modified:
    - style.css (body padding, .quickLog centering)
    - js/ui/today-screen.js (BUTTONS array order)
    - js/ui/metrics-screen.js (COLUMNS array order)
decisions:
  - "Chose body padding approach (1.5rem 0.75rem) over increasing #app max-width for minimal CSS change"
metrics:
  duration: "3 min 40 sec"
  completed_date: "2026-07-30"
  tasks_completed: 3
  files_modified: 3
  commit_hash: fa71043
status: complete
---

# Phase 11 Plan 08: UI Layout & Column Order Fixes Summary

**Fix three cosmetic/UI layout issues:** Center and reorder Today screen action buttons, reduce side gutters on all screens, and correct Metrics table column order.

## Objective

Improve visual balance and usability on wider screens; match intended column sequence (time events before metrics).

## Tasks Completed

| Task | Name | Status | Files |
|------|------|--------|-------|
| 1 | Center action buttons and reorder on Today screen (G-NW-11-17) | Complete | style.css, js/ui/today-screen.js |
| 2 | Reduce side gutters on all screens (G-NW-11-19) | Complete | style.css |
| 3 | Reorder Bedtime column in Metrics table (G-NW-11-20) | Complete | js/ui/metrics-screen.js |

## Implementation Details

### Task 1: Center Action Buttons and Reorder

**What was done:**
- Verified `.quickLog` CSS rule already had `justify-content: center;` (line 85 of style.css)
- Reordered BUTTONS array in js/ui/today-screen.js from:
  - `[wake, bedtime, napStart, napEnd]`
  - To: `[wake, napStart, napEnd, bedtime]`
- This moves "Going to sleep" button to the end, after the two nap buttons

**Verification:**
```bash
grep "justify-content: center" style.css  # Returns count 4 ✓
tail -5 of BUTTONS export  # Confirms order: wake → napStart → napEnd → bedtime ✓
```

### Task 2: Reduce Side Gutters

**What was done:**
- Changed body padding from `padding: 1.5rem;` to `padding: 1.5rem 0.75rem;`
- This reduces horizontal padding from 24px to 12px on each side
- Eliminates large white gutters on wider screens
- Affects all screens (Today, History, Charts, Accuracy, Metrics)

**Verification:**
```bash
grep "padding: 1.5rem 0.75rem" style.css  # Returns the changed rule ✓
```

### Task 3: Reorder Metrics Table Columns

**What was done:**
- Reordered COLUMNS array in js/ui/metrics-screen.js
- Moved bedtime from position 2 (after wake) to position 4 (after napEnd)
- New column sequence: date, wake, napStart, napEnd, bedtime, [metrics...]
- Ensures time columns appear in chronological order before computed metrics

**Before:**
```javascript
[date, wake, bedtime, napStart, napEnd, sleep, nap, ...]
```

**After:**
```javascript
[date, wake, napStart, napEnd, bedtime, sleep, nap, ...]
```

**Verification:**
```bash
awk on COLUMNS array shows: wake → napStart → napEnd → bedtime ✓
```

## Deviations from Plan

None — plan executed exactly as written.

## Gap Closures

This plan closes three identified gaps from Phase 11 UAT:

- **G-NW-11-17:** Today screen action buttons were not centered horizontally
- **G-NW-11-19:** Large white side gutters on wider screens due to excessive body padding
- **G-NW-11-20:** Metrics table column order was confusing (bedtime appeared before nap times)

All gaps are now closed with minimal, targeted CSS and configuration changes.

## Verification

Manual verification can be performed by:

1. Running `npm run serve` and opening http://localhost:8081
2. Navigate to Today screen and verify:
   - Action buttons are centered horizontally
   - Button order is: Woke up | Nap start | Nap end | Going to sleep
3. Navigate through all screens (Today, History, Charts, Accuracy, Metrics) and verify:
   - Reduced side padding (no large white gutters)
   - Content uses full available width more effectively
4. Navigate to Metrics screen and verify:
   - Column headers appear in order: Date, Wake, Nap Start, Nap End, Bedtime, Sleep, Nap, Comb, Day Len, →Nap, Nap→, Act, AAS, SAA

## Success Criteria

All success criteria met:

- ✓ Today screen action buttons are horizontally centered
- ✓ Button order is Woke up | Nap start | Nap end | Going to sleep
- ✓ All screens have minimal side padding (0.75rem per side instead of 1.5rem)
- ✓ Metrics table column order is: Date, Wake, Nap Start, Nap End, Bedtime, then remaining columns
- ✓ Visual layout is balanced and uses full screen width effectively on wider devices

## Requirements Coverage

This plan addresses requirements:
- MET-01: Metrics table implementation ✓
- MET-02: Column definitions ✓
- MET-03: Data aggregation ✓
- MET-04: Stage filtering ✓
- MET-05: Rendering (including column order) ✓
- MET-06: Reactive updates ✓

All requirements remain covered after column reordering.

## Files Modified

| File | Changes |
|------|---------|
| style.css | body padding: 1.5rem → 1.5rem 0.75rem (1 line) |
| js/ui/today-screen.js | BUTTONS array reordered (4 lines rearranged) |
| js/ui/metrics-screen.js | COLUMNS array reordered (14 lines rearranged) |

## Commit

- **Hash:** fa71043
- **Message:** `feat(11-08): center buttons, reduce gutters, reorder metrics columns`
- **Files:** 3
- **Changes:** 4 insertions, 3 deletions

## Timeline

- **Started:** 2026-07-30T15:17:16Z
- **Completed:** 2026-07-30T15:20:56Z
- **Duration:** 3 min 40 sec

## Next Steps

Plan 11-08 is complete. Proceed to plan 11-09 (remaining gap closure if any) or next phase as planned.
