---
phase: 24-autosave
plan: 05
subsystem: ui
tags: [file-system-access-api, localStorage, playwright, e2e-regression]

requires:
  - phase: 24-autosave (plans 01-04)
    provides: js/lib/autosave.js, js/app.js autosave wiring, settings-modal.js Backup fieldset, today-screen.js first-launch banner
provides:
  - Async-safe Remove handler in the Settings Backup fieldset (Gap A / WR-01 closed)
  - Settings-driven autosave pick now sets the same autosaveBannerDismissed flag the banner's own buttons set (Gap B / WR-02 closed)
  - Two new Playwright regression tests locking both fixes in place
affects: []

actuals:
  tokens: 700
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Async event handlers await their underlying async action before re-rendering from getState() (mirrors the existing pickOrChange idiom)"
    - "A one-time localStorage UI-state flag (autosaveBannerDismissed) can have multiple writers as long as each writer only sets it on a genuinely-completed success condition"

key-files:
  created: []
  modified:
    - js/ui/settings-modal.js
    - tests/e2e/settings-autosave.spec.js

key-decisions:
  - "Fix 2 implemented via Option B (settings-modal.js sets the shared dismissal flag) not Option A (passing isConfigured into mountTodayScreen), per the plan's design-rationale record — Option A would silently fail to suppress the banner on the exact case it targets due to restoreHandle()'s async/mountTodayScreen's sync timing race."
  - "Banner-dismissal flag is set only inside the state.status === 'granted' branch after a pick, so a cancelled/AbortError pick (D-06) never falsely suppresses the discovery banner."

patterns-established: []

requirements-completed: [PLAT-01, PLAT-02, PLAT-03, PLAT-04]

coverage:
  - id: D1
    description: "Clicking Remove in the Backup fieldset awaits autosave.remove() before re-rendering, flipping the row to unset immediately with no other re-render needed (Gap A / WR-01 closure)"
    requirement: PLAT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#Remove flips the row back to unset without closing or reopening Settings (Gap A regression)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A folder picked via Settings ('Choose folder' or 'Change folder') sets the same autosaveBannerDismissed flag the banner's own buttons set, so the first-launch banner does not reappear for a user who configured autosave entirely through Settings (Gap B / WR-02 closure)"
    requirement: PLAT-04
    verification:
      - kind: e2e
        ref: "tests/e2e/settings-autosave.spec.js#picking a folder in Settings suppresses the first-launch banner on next load without ever touching the banner (Gap B regression)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-18
status: complete
---

# Phase 24 Plan 05: Autosave Gap Closure Summary

**Fixed a stale-state race in the Settings Remove handler and gated the first-launch banner's dismissal flag on a genuinely successful Settings-driven pick — closing both blocking gaps from 24-VERIFICATION.md with two new Playwright regression tests.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-18T08:20:00Z (approx)
- **Completed:** 2026-09-18T08:24:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `_autosaveRemoveHandler` in `js/ui/settings-modal.js` is now `async` and `await`s `autosave.remove()` before calling `renderBackupSection(autosave.getState())` — the Backup fieldset flips to the unset row immediately on click, with no need to close/reopen Settings (Gap A / WR-01).
- `pickOrChange` (shared by `#autosavePickBtn` and `#autosaveChangeBtn`) now sets `localStorage.setItem('autosaveBannerDismissed', '1')` (tagged `// gsd:allow-storage-local`) whenever the freshly-read state's `status` is exactly `'granted'` — so a user who discovers and configures autosave entirely through Settings no longer sees the misleading first-launch banner reappear on later loads (Gap B / WR-02).
- Two new Playwright regression tests added to the existing `Supported pick-and-save flow (PLAT-01/PLAT-02)` describe block in `tests/e2e/settings-autosave.spec.js`, proving each fix deterministically and preventing silent regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Remove-handler race (Gap A) and gate banner-dismissal on a real pick (Gap B)** - `7249e9a` (fix)
2. **Task 2: E2E regression coverage for both gap fixes** - `1521d4a` (test)

_Note: Both tasks are `type="auto"` (not TDD-typed); no test→feat gate sequence applies._

## Files Created/Modified
- `js/ui/settings-modal.js` - `_autosaveRemoveHandler` now async/awaits removal before re-render; `pickOrChange` now also sets the shared `autosaveBannerDismissed` flag on a granted pick
- `tests/e2e/settings-autosave.spec.js` - two new regression tests: "Remove flips the row back to unset without closing or reopening Settings (Gap A regression)" and "picking a folder in Settings suppresses the first-launch banner on next load without ever touching the banner (Gap B regression)"

## Decisions Made
- Implemented Gap B's fix as Option B exactly as specified by the plan (write the shared dismissal flag from Settings), rejecting Option A (passing `isConfigured` into `mountTodayScreen`) per the plan's documented design-rationale — Option A would race against `restoreHandle()`'s async resolution and silently fail on the exact case it targets. `js/app.js` and `js/ui/today-screen.js` were not touched, confirmed by `git diff --stat` showing zero changes to either file.
- Kept the `status === 'granted'` gate on the flag write so a cancelled/AbortError pick (D-06) never falsely suppresses the banner — matches the plan's prohibition and the T-24-12 threat mitigation.

## Deviations from Plan

None - plan executed exactly as written. Both fixes and both tests match the plan's `<action>` blocks verbatim in structure and intent.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both `24-VERIFICATION.md` gaps (Gap A / WR-01 blocker, Gap B / WR-02 warning) are closed. Full verification re-run: `node --test tests/integration/security-smoke.test.js` (9/9 pass), `npm run test:unit` (903/903 pass, unchanged baseline), full `npx playwright test` (146/146 pass — the prior 144 plus this plan's 2 new tests).
- Phase 24 (Autosave) is now ready to be marked complete; all four PLAT-01..04 requirements are satisfied and the phase goal (autosave works end-to-end with graceful fallback) is fully achieved with no known gaps.
- Remaining WARNING-level code-review items (WR-03: `createIndexedDbHandleStore` never closes IndexedDB connections; WR-04: boot-time `restoreHandle()` failure is silently swallowed with no diagnostic trail) were explicitly out of scope for this gap-closure plan and remain open as non-blocking follow-ups if the project wants to address them later.

## Self-Check: PASSED

- FOUND: `.planning/phases/24-autosave/24-05-SUMMARY.md`
- FOUND: `7249e9a` (fix commit)
- FOUND: `1521d4a` (test commit)
- FOUND: `4f54c7d` (docs commit)

---
*Phase: 24-autosave*
*Completed: 2026-09-18*
