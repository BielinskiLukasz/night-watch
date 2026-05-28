---
phase: 02-configuration-settings
plan: "07"
subsystem: ui
tags: [vanilla-js, cfg-01, ux-polish, gap-closure]
mode: gap_closure
source_uat: 02-UAT.md
gaps_resolved:
  - id: empty-h1-on-fresh-install
    test: 1
    severity: major
  - id: gear-icon-clipped
    test: 1
    severity: cosmetic

requires:
  - phase: 02-configuration-settings
    provides: DEFAULT_SETTINGS (Plan 02-01), header.js + settings-modal.js + index.html (Plan 02-04)
provides:
  - DEFAULT_SETTINGS.subjectName default 'Baby' (fresh-install legibility)
  - header.js render-layer fallback h1 = subjectName || 'Nightwatch' (symmetric with document.title)
  - index.html placeholder hint on subject-name input + complete Material Icons gear path
affects: []

tech-stack:
  added: []
  patterns:
    - "Two-layer UX: data-default ('Baby' on fresh install) + render-layer fallback ('Nightwatch' when user explicitly clears). Validator unchanged."
    - "Symmetric h1.textContent + document.title fallback for empty subjectName."

key-files:
  modified:
    - js/lib/db-shape.js
    - js/ui/header.js
    - index.html
    - tests/unit/db-shape.test.js
    - tests/e2e/settings-modal.spec.js
  created: []

key-decisions:
  - "Two-layer fix per user direction (Option 3): change DEFAULT_SETTINGS.subjectName to 'Baby' so fresh installs render meaningfully, AND retain header.js fallback to 'Nightwatch' for the explicit-empty-save case. No validator change (minLen not introduced)."
  - "Material Icons settings path (Apache 2.0) inlined; attribution as HTML comment above the <svg>. Zero-deps constraint preserved."
  - "No schema migration. v1→v2 migration in db-shape.js auto-picks up 'Baby' default; existing v2 blobs keep their stored subjectName."

patterns-established:
  - "Pattern: gap-closure plan stays surgical — defaults + render-layer fallback + asset fix only; no spec/schema/validator churn."

requirements-completed: [CFG-01]

duration: ~10 min
completed: 2026-05-28
---

# Phase 2, Plan 07: Gap Closure Summary

**Two-layer subject-name fix ('Baby' default + 'Nightwatch' render-fallback + input placeholder) and complete Material Icons gear SVG — closes both Phase 2 UAT Test 1 findings.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-28T09:30Z (approx)
- **Completed:** 2026-05-28T09:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Fresh installs now show `Baby` in the header instead of an empty h1.
- Explicit empty-save path still renders the literal `Nightwatch` via render-layer fallback (symmetric with the existing document.title formula).
- Settings-modal subject-name input gets a placeholder hint nudging the override path.
- Gear icon renders as the complete Material Icons 8-tooth gear (no clipping).
- Tests updated to match: 251/251 unit, 40/40 e2e.

## Task Commits

1. **Task 1: subjectName default 'Baby' + header fallback + placeholder + test updates** — `88c7c69` (fix)
2. **Task 2: replace truncated gear icon SVG path** — `49ef343` (fix)

## Files Created/Modified

- `js/lib/db-shape.js` — DEFAULT_SETTINGS.subjectName: `''` → `'Baby'`; updated inline comment.
- `js/ui/header.js` — h1.textContent uses `|| 'Nightwatch'` fallback (line 38).
- `index.html` — placeholder on subject-name input (line 132); complete Material Icons gear path + attribution comment (line 31–33).
- `tests/unit/db-shape.test.js` — literal `''` → `'Baby'` (line 24).
- `tests/e2e/settings-modal.spec.js` — empty-name spec title + assertion updated to expect `Nightwatch` via fallback (lines 42, 47).

## Decisions Made

- **User chose Option 3 (Baby default + placeholder) plus retained header fallback.** Rationale: friendly first impression on fresh install without an onboarding flow; placeholder hints at override path; fallback covers the legitimate explicit-clear case.
- **No validator change.** RULES.subjectName stays `{ type:'string', trim:true, maxLen:40 }` — no minLen.
- **Symmetric fallback.** h1 mirrors the existing document.title formula at line 40 so the empty-string state is consistently legible across header + tab title.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Unit + e2e suites pass cleanly on first run.

## Test Results

- `npm run test:unit` → **251/251 pass** (one literal updated; integration tests that reference `DEFAULT_SETTINGS.subjectName` by constant auto-adapted).
- `npx playwright test` → **40/40 pass** (settings-modal empty-name spec title + expected text updated; XSS spec, persistence spec, gear-opens-modal spec all still pass).

## Threat Surface

- **T-2-13 (XSS on h1):** Unchanged — write path is still `textContent`; `||` does not interpret HTML; `'Nightwatch'` is JS-source-controlled.
- **T-2-17 (subjectName length):** Unchanged — `maxLen:40` validator + HTML `maxlength="40"`; new defaults well under bound.
- **T-2-05 (corrupt-blob recovery):** Unchanged — v1→v2 migration injects DEFAULT_SETTINGS including new `subjectName: 'Baby'`.
- **T-2-SC (supply chain):** No new dependency. Gear path inlined; attribution as HTML comment.

## User Setup Required

None.

## Next Phase Readiness

- Phase 2 UAT Test 1 findings closed in code + tests. Manual re-walk recommended (clear localStorage `nightwatch:db`, reload, confirm h1 reads `Baby` and gear renders fully).
- Phase 2 ready for verifier rerun and the standard closure sequence (`/gsd-secure-phase 2`, `/gsd-ui-review 2`).

---
*Phase: 02-configuration-settings*
*Completed: 2026-05-28*
