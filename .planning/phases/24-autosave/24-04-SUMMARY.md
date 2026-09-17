---
phase: 24-autosave
plan: 04
subsystem: today-screen-ui
tags: [file-system-access-api, first-launch-banner, dismissal-flag, dependency-injection, e2e]
requires:
  - phase: 24-autosave
    provides: autosaveActions/autosave deps object injected into mountTodayScreen() by app.js (Plan 24-02)
provides:
  - "js/ui/today-screen.js: mountTodayScreen({..., autosave}) optional param renders .autosave-banner as the first Today-screen child when supported and not yet dismissed"
  - "localStorage 'autosaveBannerDismissed' flag — set by either banner button, checked on every mount"
  - "tests/e2e/autosave-banner.spec.js: real-Chromium coverage for visible-by-default, dismiss-persists-across-reload, and hidden-when-unsupported"
affects: []
actuals:
  tokens: 1612
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "One-time localStorage UI-state dismissal flag checked at mount time, mirroring js/app.js's FILE_NOTE_KEY pattern but scoped to a UI module instead of the composition root"
key-files:
  created: [tests/e2e/autosave-banner.spec.js]
  modified: [js/ui/today-screen.js, style.css]
key-decisions:
  - "Banner-related comment prose in today-screen.js avoids the literal token 'localStorage' in untagged lines — the repo-wide storage-seam smoke test (D-07) flags the bare word even inside a comment, so the explanatory comment above the gated block uses 'browser-storage flag' instead, keeping only the three tagged code lines (getItem + two setItem calls) as the actual localStorage references."
  - "bannerEl is hidden via the `hidden` DOM property (not removed/replaced) on dismissal, matching the existing #file-note precedent in app.js exactly, so Playwright's toBeHidden() assertion works identically to the file-note's established E2E pattern."
patterns-established: []
requirements-completed: [PLAT-01, PLAT-04]
coverage:
  - id: D1
    description: "Banner renders as .autosave-banner, first child of the Today screen root, only when autosave.isSupported is true AND the dismissal flag is absent"
    requirement: "PLAT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/autosave-banner.spec.js#autosave banner (.autosave-banner) is visible on first load when supported (D-10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Set up autosave calls autosave.pick() then sets the dismissal flag and hides the banner; Dismiss sets the flag and hides without calling pick()"
    requirement: "PLAT-01"
    verification:
      - kind: static-analysis
        ref: "grep -n 'autosave.pick()\\|autosaveBannerDismissed' js/ui/today-screen.js — pick() only in the setup handler, dismiss flag set in both handlers"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dismissal persists across reload — the banner does not reappear after either button is clicked and the page reloads"
    requirement: "PLAT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/autosave-banner.spec.js#clicking \"Dismiss\" hides the banner and it does not reappear after reload (D-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every localStorage.getItem/setItem call added by this task carries // gsd:allow-storage-local on the same line; the repo-wide storage-seam gate passes"
    requirement: "PLAT-01"
    verification:
      - kind: unit
        ref: "node --test tests/integration/security-smoke.test.js (D-07 storage-seam) — 9/9 pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "mountTodayScreen still works with autosave omitted entirely (no banner logic runs, no throw)"
    requirement: "PLAT-04"
    verification:
      - kind: unit
        ref: "node --test (full 903-test unit+integration suite) — zero regressions in today-screen.js-dependent tests"
        status: pass
    human_judgment: false
duration: ~12min
completed: 2026-09-17
status: complete
---

# Phase 24 Plan 04: First-Launch Autosave Banner Summary

**Dismissible Today-screen banner nudging first-time autosave setup, gated by File System Access API support and tracked via a plain `autosaveBannerDismissed` localStorage flag (D-10/D-11).**

## Performance
- **Duration:** ~12min
- **Started:** 2026-09-17T17:35:00+02:00 (approx)
- **Completed:** 2026-09-17T17:47:00+02:00 (approx)
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Added `autosave` as an optional destructured parameter to `mountTodayScreen({root, eventLog, settings, clock, autosave})` (JSDoc updated), preserving pre-existing behavior in every call site that omits it.
- Immediately after the existing `addEventBtn`/`quickLog.appendChild` block, added the gated banner-construction logic: builds `bannerEl` (`className: 'autosave-banner'`) containing a static `<p>` nudge, a "Set up autosave" `<button class="autosave-banner-setup">`, and a "Dismiss" `<button class="autosave-banner-dismiss">`, only when `autosave && autosave.isSupported && !localStorage.getItem('autosaveBannerDismissed')`.
- "Set up autosave" click handler: `await autosave.pick()` → sets the dismissal flag → `bannerEl.hidden = true`. "Dismiss" click handler: sets the dismissal flag → `bannerEl.hidden = true` (never calls `pick()`).
- Changed the final `root.replaceChildren(...)` call to build the children array once and `unshift(bannerEl)` onto it only when the banner was actually built, so the unsupported/already-dismissed path calls `replaceChildren` with the exact same argument list as before this task.
- Tagged all three new `localStorage` calls (one `getItem`, two `setItem`) with `// gsd:allow-storage-local` on the same line, mirroring `js/app.js`'s `FILE_NOTE_KEY` block exactly.
- Added `.autosave-banner` / `.autosave-banner[hidden]` / `.autosave-banner button` CSS rules to `style.css` immediately after the existing `#file-note` block, reusing its flex-row / padding / border / palette treatment (`background: #f8fafc; border: 1px solid #e2e8f0;`) with `margin: 0 0 8px` (in-flow, not fixed) and `min-height: 44px` tap targets on both buttons.
- Created `tests/e2e/autosave-banner.spec.js` with a `beforeEach` clearing localStorage and reloading (mirroring `settings-modal.spec.js`), and three tests: banner visible by default (Chromium supports `showDirectoryPicker` out of the box, no mocking needed), Dismiss hides the banner and it does not reappear after `page.reload()`, and the banner is entirely absent when `window.showDirectoryPicker` is deleted via `page.addInitScript` before `page.goto('/')`.

## Task Commits
1. **Task 1: First-launch banner in today-screen.js + CSS** - `e961866` (feat)
2. **Task 2: E2E coverage for the first-launch banner** - `fdf310f` (test)

## Files Created/Modified
- `js/ui/today-screen.js` - added optional `autosave` param, gated `.autosave-banner` construction/dismissal logic, updated `root.replaceChildren(...)` call to conditionally prepend the banner.
- `style.css` - added `.autosave-banner`, `.autosave-banner[hidden]`, and `.autosave-banner button` rules mirroring `#file-note`.
- `tests/e2e/autosave-banner.spec.js` (new) - 3 tests: visible-by-default, dismiss-persists-across-reload, hidden-when-unsupported.

## Decisions Made
- The explanatory comment block above the gated banner logic in `today-screen.js` was written to avoid the bare literal token `localStorage` in an untagged comment line — the repo-wide `D-07 storage-seam` smoke test flags any occurrence of the word `localStorage` outside `js/adapters/storage-local.js` unless the line carries `// gsd:allow-storage-local`, and it does not distinguish comment prose from code. The comment now reads "a plain browser-storage flag" instead, leaving only the three tagged code lines as actual `localStorage` references.
- `bannerEl.hidden = true` (DOM property) is used for dismissal rather than `bannerEl.remove()`, matching the existing `#file-note` precedent in `js/app.js` exactly and giving the E2E test a `toBeHidden()`-compatible assertion target consistent with that precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment prose tripped the repo-wide storage-seam gate**
- **Found during:** Task 1 verification (`node --test tests/integration/security-smoke.test.js`)
- **Issue:** The first draft of the explanatory comment above the banner-construction block used the phrase "persists via a plain localStorage flag," which is an untagged occurrence of the literal token `localStorage` and tripped the D-07 storage-seam gate (which scans for the bare word regardless of code vs. comment context).
- **Fix:** Reworded the comment to "persists via a plain browser-storage flag" — no functional change, only comment wording. The three actual `localStorage.getItem`/`setItem` calls were already correctly tagged and were never the source of the failure.
- **Files modified:** js/ui/today-screen.js
- **Verification:** `node --test tests/integration/security-smoke.test.js` — 9/9 pass after the fix.
- **Commit:** e961866 (folded into the Task 1 commit; no separate fix commit needed since the failure was caught before committing).

**Total deviations:** 1 auto-fixed (Rule 1, comment-wording only). **Impact:** None on behavior — the fix was purely textual (a code comment), discovered and corrected before the Task 1 commit was made, so no additional commit was required.

## Issues Encountered
None beyond the comment-wording deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 24 (Autosave) complete — all 4 plans (24-01..24-04) shipped. `node --test` full unit+integration suite: 903/903 passing. Full `npx playwright test` E2E suite: 144/144 passing (including this plan's 3 new tests and Plan 24-03's 3 autosave-settings tests). Ready for phase verification / `/gsd-verify-work`.

---
*Phase: 24-autosave*
*Completed: 2026-09-17*

## Self-Check: PASSED

All claims verified: `js/ui/today-screen.js`, `style.css`, and `tests/e2e/autosave-banner.spec.js` exist and contain the documented changes; commits `e961866` and `fdf310f` both present in `git log`; `node --test tests/integration/security-smoke.test.js` (9/9), full `node --test` unit/integration suite (903/903), and full `npx playwright test` (144/144, including the 3 new autosave-banner tests) all pass.
