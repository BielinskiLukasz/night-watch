---
status: complete
phase: 10-tif-algorithm-settings
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md
started: 2026-07-14T00:00:00.000Z
updated: 2026-07-14T00:00:00.000Z
completed: 2026-07-14T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. TIF options hidden when Classic is selected
expected: Open Settings → "Forecast & Prediction" section → "TIF Algorithm" sub-section exists with an Algorithm dropdown showing "Classic". The Trim % and Precision Target inputs are hidden (not visible).
result: pass

### 2. TIF options appear when switching to TIF
expected: In Settings, change the Algorithm dropdown from "Classic" to "TIF". The Trim % and Precision Target inputs immediately become visible without closing the modal.
result: pass

### 3. TIF settings persist after save
expected: In Settings, switch algorithm to TIF, set Trim % to 15 and Precision Target to 45. Save. Reopen Settings — Algorithm still shows TIF, Trim % shows 15, Precision Target shows 45.
result: pass

### 4. Classic algorithm renders normal forecast cards
expected: With Algorithm set to Classic (default), the Today screen shows the standard prediction cards for Wake, Nap Start, Nap End, and Bedtime — the same cards as before Phase 10 (no precision badge visible).
result: pass

### 5. Switching to TIF renders prediction cards with precision badge
expected: In Settings, switch Algorithm to TIF and save. The Today screen updates — prediction cards now show a precision score badge (e.g., "92%" or similar). The badge is visible on each prediction card.
result: pass
reported: "pass (its hidden now because of quick)" — badge visible on expand; cards collapsible per tif-card-expand quick task (2026-07-13)

### 6. Hero card shows precision badge when TIF is active
expected: With TIF active, the hero "Next Predicted Event" card at the top of Today screen also displays the precision score badge.
result: pass

### 7. Switching back to Classic removes precision badges
expected: In Settings, switch Algorithm back to Classic and save. The Today screen updates — precision badges disappear from all cards and the hero card. Cards look the same as the Classic baseline.
result: pass

### 8. Low-confidence TIF card is collapsible
expected: (Requires sufficient history where TIF finds no intersection for at least one event.) A low-confidence prediction card shows a collapsed single-line summary "Wake — Low confidence — 07:00–09:30" style. Tapping/clicking it expands to show source windows and precision score detail.
result: pass
reported: "pass for precision 21%"

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- Gaps appended here as issues are found -->
