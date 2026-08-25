---
status: resolved
trigger: "G-NW-11-12 — Per-day rows ordered oldest-first instead of newest-first in metrics table"
created: 2026-07-29T00:00:00Z
updated: 2026-08-24T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED — rendering loop reverses an already-correct newest-first array
test: Traced data flow: daysBySubjectiveNight() → aggregateMetrics() → renderLoop
expecting: Row iteration at lines 337-340 of metrics-screen.js reverses newest-first to oldest-first
next_action: ROOT CAUSE FOUND — documented below

## Symptoms

expected: Newest sleep day at top of metrics table (most-recent-first)
actual: Oldest sleep day at top, newest at bottom (oldest-first)
errors: None reported
reproduction: Open Metrics tab in app with multiple days of sleep data; observe table row order
started: UAT Phase NW-11 (2026-07-29)

## Eliminated

(none)

## Evidence

- timestamp: 2026-07-29
  checked: js/lib/day-bucket.js bucketBy() function (lines 218-235)
  found: "records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))" — correctly sorts newest-first by reversing comparison
  implication: daysBySubjectiveNight() returns records in newest-first order

- timestamp: 2026-07-29
  checked: js/lib/metrics.js aggregateMetrics() function (lines 154-184)
  found: "for (let i = 0; i < dayRecords.length; i++) { rows.push(...) }" — iterates input in same order
  implication: rows array inherits newest-first order from input dayRecords

- timestamp: 2026-07-29
  checked: js/ui/metrics-screen.js render loop (lines 335-341)
  found: "for (let i = rows.length - 1; i >= 0; i--) { const dayRow = buildDayRow(rows[i], snap)" — backward loop
  implication: Renders rows in REVERSE order, converting newest-first to oldest-first; Comment says "D11-03 (most-recent-first)" but loop does opposite

## Resolution

root_cause: "The rendering loop iterates rows in reverse. This was correct once aggregateMetrics() was updated to receive oldest-first input (via `[...days].reverse()` in metrics-screen.js line 301). The two reversals cancel out: aggregateMetrics gets oldest-first, outputs oldest-first rows, and the backward loop renders newest-first for display (D11-03)."

fix: metrics-screen.js line 301 passes `[...days].reverse()` to aggregateMetrics() so it receives oldest-first input. The backward rendering loop (lines 336-339) then correctly produces newest-first display order.
verification: All 112 E2E tests pass (2026-08-24).
files_changed: [js/ui/metrics-screen.js]
