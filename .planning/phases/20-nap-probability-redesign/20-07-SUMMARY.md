---
phase: 20-nap-probability-redesign
plan: 07
subsystem: ui
tags: [css, dom, accuracy-screen, mobile-scroll]

requires:
  - phase: 23-metrics-screen-tif-migration
    provides: buildTifPerDayTable and the .tifPerDayTable rendering in accuracy-screen.js
provides:
  - .tifPerDayTableScroll wrapper div in renderTifAccuracy (js/ui/accuracy-screen.js)
  - .tifPerDayTableScroll CSS rule mirroring .metricsTableScroll (style.css)
  - E2E test proving the wrapper exists, contains the table, and computes overflow-x: auto
affects: []

actuals:
  tokens: 600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["Scroll-wrapper-around-table DOM pattern (already used by metrics-screen.js) applied to a second table"]

key-files:
  created: []
  modified:
    - js/ui/accuracy-screen.js
    - style.css
    - tests/e2e/accuracy-screen.spec.js

key-decisions:
  - "Wrapper div created inline inside renderTifAccuracy (not lifted to a persistent module-level element like metrics-screen.js's tableScroll) since accuracy-screen.js rebuilds its whole section via replaceChildren on every render — no reuse benefit to hoisting it"

patterns-established: []

requirements-completed: [UI-11]

coverage:
  - id: D1
    description: "Accuracy screen's TIF per-day table is wrapped in a .tifPerDayTableScroll div with overflow-x/y: auto, matching the Metrics screen's .metricsTableScroll pattern (G-20-17)"
    requirement: UI-11
    verification:
      - kind: e2e
        ref: "tests/e2e/accuracy-screen.spec.js#per-day TIF table is wrapped in a horizontally-scrollable container (G-20-17)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-09-18
status: complete
---

# Phase 20 Plan 07: Accuracy Screen Mobile Scroll Wrapper Summary

**Added `.tifPerDayTableScroll` wrapper (with matching CSS) around the Accuracy screen's per-day TIF table, closing G-20-17 (UAT test 17: table not scrollable on mobile).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-18T20:54Z (approx, from STATE.md prior session end)
- **Completed:** 2026-09-18T21:00:02Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `renderTifAccuracy` in `js/ui/accuracy-screen.js` now wraps `buildTifPerDayTable`'s returned table in a new `.tifPerDayTableScroll` div before appending it to the section, mirroring `metrics-screen.js`'s `.metricsTableScroll` pattern exactly.
- `style.css` gained a `.tifPerDayTableScroll` rule (overflow-x/y: auto, max-height: calc(100vh - 8rem), zero margin/padding) placed immediately above the existing `.tifPerDayTable` block, with a comment marking it as the G-20-17 counterpart to `.metricsTableScroll`.
- New E2E test in `tests/e2e/accuracy-screen.spec.js` (within the existing "Per-Day TIF Windows table" describe block) proves: the wrapper is attached, contains exactly one `.tifPerDayTable` child, the pre-existing `#accuracy-screen .tifPerDayTable` selector still resolves (used by 4 other tests in the same file), and computed `overflowX` is `'auto'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap the TIF per-day table in a scroll container** - `8aab3ed` (feat)
2. **Task 2: E2E coverage for the new scroll wrapper** - `54dbfd4` (test)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `js/ui/accuracy-screen.js` - `renderTifAccuracy` wraps the per-day table in a new `.tifPerDayTableScroll` div instead of appending it directly into the section
- `style.css` - new `.tifPerDayTableScroll` rule (verbatim copy of `.metricsTableScroll`'s declarations) added adjacent to `.tifPerDayTable`
- `tests/e2e/accuracy-screen.spec.js` - new test asserting the wrapper's existence, containment, and computed overflow-x

## Decisions Made
- Wrapper div is created fresh inside `renderTifAccuracy` on every call rather than hoisted to a persistent module-level element (unlike `metrics-screen.js`'s `tableScroll`), because `accuracy-screen.js` already rebuilds its entire `.accuracy-section` via `root.replaceChildren(section)` on every render — there is no persistent-element reuse benefit to gain, and inlining keeps the diff minimal per the plan's explicit "leave every other part of renderTifAccuracy unchanged" instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `node --test tests/unit/` (Task 1's literal verify command) errors on Windows path resolution unrelated to this change (pre-existing environment quirk); ran `npm run test:unit` instead (989/989 passing) as the equivalent sanity check the task's `<fails_when>` note anticipated ("no unit test targets accuracy-screen.js's DOM directly"). Task 2's Playwright command ran and passed as specified (12/12, including the new test).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-20-17 closed. The Phase 23 code-review follow-up item ("new `.tifPerDayTable` on the Accuracy screen has no horizontal-scroll wrapper for narrow/mobile viewports") tracked in `PROJECT.md`'s Key Decisions and `STATE.md`'s Operator Next Steps can be marked resolved.
- No blockers for subsequent Phase 20 plans or the next milestone.

---
*Phase: 20-nap-probability-redesign*
*Completed: 2026-09-18*

## Self-Check: PASSED

All created/modified files exist (js/ui/accuracy-screen.js, style.css, tests/e2e/accuracy-screen.spec.js) and both task commits (8aab3ed, 54dbfd4) are present in git history.
