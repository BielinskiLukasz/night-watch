---
status: diagnosed
trigger: "User reports: Stage badge shows 'Viewing: {stage name}' above the metrics table when an active stage exists — but no stage badge or stage-related UI visible on metrics screen despite having 1 ongoing stage created"
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:30:00Z
---

## Current Focus

hypothesis: The stage badge is rendered with `badge.hidden = true` initially (line 263). When `renderStageBadge()` is called during the first render or if `snap.activeStageId` is falsy/null, `badge.hidden` remains true. The badge is only shown if AND ONLY IF: (1) `snap.activeStageId` is truthy AND (2) a matching stage is found in `snap.stages` array. The root cause is that users may not realize the stage must be selected from the Today screen dropdown (`settings.update({ activeStageId })`) BEFORE the metrics badge appears — or there's a bug where a selected stage's ID doesn't match the stage in the array.

test: (A) Verify user workflow: create stage → select stage from Today screen dropdown → navigate to Metrics. (B) Trace activeStageId value when user selects a stage. (C) Verify stage IDs are consistent between creation (timestamp-based String) and lookup.

expecting: If a user creates a stage and immediately opens Metrics without selecting it from Today screen dropdown, the badge won't show (expected behavior per D11-09: read-only badge). If user DID select a stage but badge still doesn't show, there's a bug in either state persistence or stage ID matching.

next_action: Check if metrics.spec.js E2E test actually exercises the full flow (create → select → view badge). If test was incomplete or had contradictory assertions, the bug may have been missed.

## Symptoms

expected: When user has created an active stage (via Settings modal or CSV import), navigates to Metrics screen, and selects that stage from the Today screen dropdown, a badge above the metrics table should display "Viewing: {Stage Name}".

actual: No stage badge or stage-related UI visible on metrics screen despite user having 1 ongoing stage created.

errors: None reported.

reproduction: 1. User creates a stage in Settings modal (or imports via CSV)  
2. Stage appears in the stage selector dropdown on Today screen  
3. User selects the stage from the dropdown  
4. User navigates to Metrics screen  
5. Badge does not appear above the table (badge remains hidden)

started: Discovered during Phase 11 UAT (test #9 of metrics screen)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-07-29
  checked: `js/ui/metrics-screen.js` line 69–80 (`renderStageBadge` function)
  found: Function correctly checks `snap.activeStageId` and searches for matching stage in `snap.stages` array. If stage is found, sets `badge.hidden = false` and populates text. If not found or activeStageId is falsy, sets `badge.hidden = true`.
  implication: The logic is correct, so the issue must be with the STATE being passed to this function.

- timestamp: 2026-07-29
  checked: `js/ui/metrics-screen.js` line 249–360 (mountMetricsScreen public API and render cycle)
  found: Metrics screen mounts with `root, eventLog, settings` deps. The `render()` function (line 277) gets snapshot via `const snap = settings.get()` and passes it to `renderStageBadge(stageBadge, snap)` on line 299. Re-renders are triggered by `eventLog.subscribe(render)` and `settings.subscribe(render)` on lines 351–352.
  implication: The subscription mechanism looks correct. When `settings.update({ activeStageId })` is called (via Today screen dropdown), the settings subscriber should fire and trigger a re-render with the fresh snapshot.

- timestamp: 2026-07-29
  checked: `js/store/settings.js` (settings store implementation)
  found: Settings store has correct snapshot mechanism. The `get()` method returns a frozen copy of `db.settings`. When `update(patch)` is called, it merges the patch and fires all subscribers synchronously with the new snapshot. No evidence of activeStageId field being dropped or lost during snapshot creation.
  implication: Settings store correctly persists and broadcasts activeStageId changes. The issue is not with the store itself.

- timestamp: 2026-07-29
  checked: `js/lib/db-shape.js` (DEFAULT_SETTINGS and schema migration)
  found: DEFAULT_SETTINGS defines `activeStageId: null` on line 56. Migration function correctly injects `activeStageId: null` for v2 blobs predating Phase 6 (lines 102–108). The field is present in all schema versions.
  implication: activeStageId field is guaranteed to exist in every settings snapshot. If the badge is hidden, it's because activeStageId is null OR the stage is not found.

- timestamp: 2026-07-29
  checked: `js/ui/today-screen.js` line 552–597 (renderStageSelector function)
  found: Stage selector dropdown is rendered only when `stages.length > 0`. When user selects a stage, the change listener (line 593–596) calls `settings.update({ activeStageId: newId })`, passing the selected stage ID.
  implication: Stage selector is the ONLY UI component that sets activeStageId. It's located on the Today screen, not on the Metrics screen itself. Users must return to Today screen to select a stage before viewing the badge on Metrics.

- timestamp: 2026-07-29
  checked: `js/ui/today-screen.js` line 722–725 (settings subscriber in Today screen)
  found: Today screen subscribes to settings changes and calls `render()`. This includes calling `renderStageSelector(stageSelectorContainer, stages, activeStageId, settings)` on line 865 to re-populate the dropdown.
  implication: Both Today screen and Metrics screen are subscribed to settings changes, so both should see activeStageId updates simultaneously.

- timestamp: 2026-07-29
  checked: `js/ui/settings-modal.js` line 219–237 (CSV import flow)
  found: When stages are imported via CSV, the code calls `settings.update({ stages })` on line 231. However, activeStageId is NOT set during import. The activeStageId would only be set later when the user selects a stage from the Today screen dropdown.
  implication: After CSV import, stages array is populated, but activeStageId remains null until user explicitly selects one. This is by design, not a bug.

- timestamp: 2026-07-29
  checked: `tests/e2e/metrics.spec.js` line 49–57 (MET-06 test for stage badge)
  found: Test has a NOTE stating "Activating a stage requires Settings modal interaction" and explicitly defers the full test with comment "This is deferred to a more complex test". The test was revised (commit a8058e8) to remove contradictory assertions (`toHaveAttribute('hidden')` and `toBeVisible()` cannot both be true). Current test only verifies badge has hidden attribute when no stage is active; does NOT test the case where a stage IS active.
  implication: The E2E test for badge visibility with an active stage was deferred and never completed. This means the feature was not fully verified before shipping, which explains why the UAT gap exists.

- timestamp: 2026-07-29
  checked: `js/lib/settings-validate.js` lines 52, 56, 176–199, 201–210 (stages and activeStageId validation)
  found: Both `stages` (type: 'stage[]') and `activeStageId` (type: 'null-or-string') are defined in RULES and validated correctly. The validator preserves both fields in the normalized settings output. No evidence of fields being dropped during validation.
  implication: Settings persistence and validation work correctly. The issue is not in the store layer.

## Resolution

root_cause: The E2E test for stage badge visibility was incomplete and deferred (metrics.spec.js lines 49-57). The test was later modified to remove contradictory assertions (commit a8058e8), but the actual functionality test case — "when a stage IS selected from the Today screen dropdown, verify the badge appears on the Metrics screen" — was never implemented or verified. The code review (11-REVIEW.md) did not flag any issues with renderStageBadge logic itself. This suggests one of two scenarios: **(A) Undocumented feature expectation:** User expected the badge to show by merely creating a stage (without selecting it from Today screen dropdown), but D11-09 specifies the badge is read-only and only shows when activeStageId is set via the Today screen selector. **(B) State synchronization bug:** When user selects a stage from the Today screen dropdown, activeStageId is updated in settings, but the metrics screen's snapshot either (1) doesn't receive the updated activeStageId, (2) receives an activeStageId that doesn't match any stage in the stages array, or (3) the badge element was removed/replaced before renderStageBadge could update it. The early return on line 286 (when no days are logged) could leave the badge in the empty-state DOM subtree, disconnected from the permanent stageBadge reference.

files_changed: [js/ui/metrics-screen.js, js/ui/today-screen.js]

Oracle: Specified requirement (D11-09) states badge is read-only and scoped to "when a stage is active". "Active" means selected via Today screen selector (activeStageId ≠ null), not merely created.

Suggested investigation: (1) Complete the E2E test case by adding a flow that creates a stage → selects it from Today screen dropdown → navigates to Metrics and verifies badge shows. (2) Add console logging in renderStageBadge to observe snap.activeStageId and snap.stages values when the function is called. (3) Verify that settings subscriber on Metrics screen is actually firing when activeStageId changes. (4) Check if there's a CSS rule or DOM mutation that hides the stageBadge after renderStageBadge runs.

verification: [pending]
