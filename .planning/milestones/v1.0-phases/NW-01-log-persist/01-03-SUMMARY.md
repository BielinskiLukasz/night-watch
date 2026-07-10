---
phase: 01-log-persist
plan: 03
subsystem: ui-store
tags: [vanilla-js, esm, dom, playwright, node-test, log-02, log-03, log-04, log-07, log-08, log-09, t-01, t-05, t-07]

requires:
  - 01-01 (walking skeleton — composition root, event-log store, today-screen single-button stub)
  - 01-02 (pure-logic TDD — daysByCalendar, daysBySubjectiveNight, roundTo5, extraNaps shape)

provides:
  - Four quick-log buttons (Woke up / Going to sleep / Nap start / Nap end) — LOG-02, LOG-03, LOG-04
  - Day-grouped event list rendered from eventLog.daysByCalendar(7) — LOG-08 (UI surface) per D-10/D-11/D-15
  - LOG-09 extra-nap warning rendered as a faint `<li class="extraNap">` row — T-06 surfacing
  - js/ui/dom.js tiny helpers (el / clear / $) — 21 non-comment lines, anti-framework constraint enforced
  - 300ms per-button debounce via performance.now() — T-05 / Pitfall #5 mitigation
  - Store delegation methods daysByCalendar(limit) and daysBySubjectiveNight(cutoverHour=4, limit) — D-08 two-views-on-one-store
  - Full T-01 coverage: 5 invalid-type rejection assertions (snore, '', null, undefined, 'WAKE')
  - 6 new Playwright specs in tests/e2e/quick-log.spec.js (all green)

affects:
  - 01-04 (manual entry + edit + delete — will reuse dom.js helpers + extend today-screen render path)
  - 01-05 (persistence + security smoke + supply-chain CI + README — quick-log spec is the regression guard for LOG-02..04)
  - Phase 2 (Settings — CFG-08 cutover-hour seam already exposed at store.daysBySubjectiveNight default arg)
  - Phase 3 (Forecast — daysBySubjectiveNight is the upstream feed)
  - All later phases (textContent-only + clock-adapter-seam grep gates are now load-bearing invariants)

tech-stack:
  added: []
  patterns:
    - "Object.freeze'd BUTTONS config drives all 4 buttons from a single source of truth"
    - "Single delegated click listener on .quickLog with closest('button[data-log]') target check"
    - "performance.now() for UI-domain debounce timing — deliberately outside the clock-adapter seam"
    - "Static no-JS skeleton in index.html (buttons + dayList) + JS render via replaceChildren() — progressive-enhancement + grep gate satisfaction"
    - "textContent-only via el() helper; .innerHTML never assigned anywhere in UI code (T-07)"
    - "String-slice 'HH:MM' extraction (hhmm = at.slice(11,16)) — consistent with day-bucket's DST-safe slice pattern"
    - "Two-views-on-one-store delegation: store thinly wraps lib/day-bucket so the UI doesn't import lib directly"

key-files:
  created:
    - js/ui/dom.js (el/clear/$ helpers; 21 non-comment lines)
    - tests/e2e/quick-log.spec.js (6 specs covering LOG-02/03/04 + 4-button sequential + double-click idempotency + extraNap surfacing)
  modified:
    - js/store/event-log.js (+36 lines — import day-bucket with rename, expose daysByCalendar + daysBySubjectiveNight delegation methods, DEFAULT_CUTOVER_HOUR named constant for Phase 2 seam)
    - js/ui/today-screen.js (rewrote from single-button stub to BUTTONS-driven 4-button row + day-grouped list with extraNap surfacing; delegated click handler with 300ms debounce; textContent-only render via dom.el)
    - index.html (replaced single Woke-up button with 4-button no-JS skeleton + dayList mount section)
    - style.css (replaced single-button styles with .quickLog flex row + .day grouping + .dayEvents list + .extraNap faint italic warm-tint warning row)
    - tests/integration/event-log.test.js (+129 lines — 3 valid-types tests + 5 T-01 rejection tests + 4 daysByCalendar delegation tests; 3 → 15 assertions)

key-decisions:
  - "Static no-JS button skeleton in index.html + JS-driven replaceChildren() on mount. Resolves the tension between the plan's grep gate `grep -E 'data-log=...' index.html | wc -l ≥ 1` and the plan's render directive `today-screen builds the entire UI under that mount`. Net effect: data-log contract is observable statically, JS still owns the runtime; the skeleton flashes briefly at module-load and then today-screen.js replaces it with the identical-shape DOM tree."
  - "Debounce uses performance.now(), not Date.now(). performance.now() is a monotonic non-domain clock; Date.now() (and `new Date()`) is reserved for the clock adapter per D-07. This keeps the `grep -E 'new Date\\(\\)' js/ui/today-screen.js` invariant clean (zero matches) and the clock-seam pristine for Phase 3+ deterministic forecasting tests."
  - "Anchored regexes /^nap start\\$/i and /^nap end\\$/i in Playwright selectors. The unanchored /nap start/i would have collided with 'Going to sleep' (no overlap in this case, but the four labels share substrings if more types are added later). Anchored at byte-level avoids any future ambiguity."
  - "Per-mount debounce ledger lives in mountTodayScreen closure (`const lastClickAt = {}`). Survives re-renders within a single mount, but a fresh page (full reload) gets a fresh ledger — desired behavior."
  - "DEFAULT_CUTOVER_HOUR = 4 named constant in event-log.js documents the Phase 2 / CFG-08 seam. Today the value is hardcoded; the named constant signals where the user-configured value will be injected when Settings lands."

requirements-completed:
  - LOG-02
  - LOG-03
  - LOG-04
  - LOG-07
  - LOG-08
  - LOG-09

threats-mitigated:
  - T-01 (full coverage — 4 valid + 5 invalid inputs all asserted)
  - T-05 (300ms per-button debounce via performance.now(); double-click e2e spec confirms exactly-one)
  - T-07 (textContent-only render via el() helper; .innerHTML never assigned; grep gate enforced)

duration: ~10 min
completed: 2026-05-26
---

# Phase 1, Plan 03: Four Quick-Log Buttons + Day-Grouped List Summary

**Extended the Walking Skeleton's single-button slice into the full Phase 1 Today screen — 4 quick-log buttons + day-grouped event list rendered from `daysByCalendar(7)` + LOG-09 extra-nap warning as a faint row + 300ms double-click debounce — all with strict T-01/T-05/T-07 mitigations and 7/7 Playwright e2e coverage.**

## Performance

- **Duration:** ~10 minutes wall-clock (per-task verifications + grep gates account for ~3 min of that)
- **Started:** 2026-05-26T12:30Z (executor dispatch on this turn)
- **Completed:** 2026-05-26T12:40Z
- **Tasks:** 3 (all `type="auto"`; Task 1 was TDD red→green)
- **Commits:** 4 (1 RED, 2 GREEN feat, 1 GREEN test for e2e)
- **Test delta:** 43 unit/integration → 55 (+12 integration); 1 e2e → 7 e2e (+6 quick-log specs)

## Accomplishments

- **Four quick-log buttons drive the canonical event-log store end-to-end.** Click each → event appears immediately in the day-grouped list. LOG-02/03/04 are now observable in both integration (`addEvent('bedtime' | 'napStart' | 'napEnd')` round-trip) and e2e (button click → DOM render).
- **Day-grouped list reads from `eventLog.daysByCalendar(7)`** — the D-10/D-15 7-day window is a literal in the UI (`grep -q "daysByCalendar(7)"` passes). Newest day first; calendar dates only in headers per D-17 (no cutover-hint tooltip in Phase 1).
- **LOG-09 / T-06 read-side enforcement is visibly surfaced.** A second `napStart` on the same calendar date renders as `<li class="extraNap">` with text `"Extra nap: HH:MM"`, faint italic + warm tint per style.css. The e2e spec proves the surfacing path (Plan 02 read-side filter + Plan 03 UI render combined).
- **T-01 full coverage lands.** Plan 01 covered `'snore'` only; this plan adds `''`, `null`, `undefined`, `'WAKE'` (case-sensitive). VALID_TYPES Set guard catches all five at the store boundary; integration tests assert each throws `/Invalid event type/`.
- **T-05 double-click idempotency mitigated.** 300ms per-button debounce via `performance.now()` (deliberately outside the clock-adapter seam per D-07). E2E spec double-clicks "Woke up" at 50ms intervals and asserts exactly ONE `li.event` row matching `/Wake/`.
- **T-07 XSS-by-construction.** Every dynamic value goes through `textContent` via the `el()` helper. `.innerHTML` is never assigned anywhere in `js/ui/today-screen.js` — `clear()` uses `replaceChildren()` instead. Negative grep gate `grep -E '\.innerHTML\s*=\s*[^"]' today-screen.js` returns zero matches.
- **Anti-framework constraint observable.** `js/ui/dom.js` is 21 non-comment lines (under the 30-line ceiling). No reactivity, no virtual DOM, no component lifecycle — just `el / clear / $`.
- **No regression on prior plans.** `tests/e2e/reload.spec.js` (Plan 01-01) still finds the "Woke up" button by role-based selector and still proves DATA-04 reload persistence. All 43 Plan 01-01 + 01-02 node tests still green.
- **Phase 2 seam exposed.** `DEFAULT_CUTOVER_HOUR = 4` named constant + default arg on `store.daysBySubjectiveNight(cutoverHour=4)` document exactly where CFG-08 will wire the user-configured cutover.

## Task Commits

1. **Task 1 — store `daysByCalendar` passthrough + T-01 coverage (TDD RED→GREEN):**
   - RED: `f4e1054` `test(NW-01-01-03): LOG-02,LOG-03,LOG-04 add failing integration assertions for all valid types + daysByCalendar passthrough`
     - 12 new assertions across 3 describe blocks; 4 failures (`log.daysByCalendar is not a function`, `log.daysBySubjectiveNight is not a function`); 11 passes (the 3 valid-type tests and 5 T-01 rejection tests passed against the existing addEvent — the RED was scoped to the new delegation methods only).
   - GREEN: `192460a` `feat(NW-01-01-03): LOG-02,LOG-03,LOG-04,LOG-08 expose daysByCalendar+daysBySubjectiveNight on store per D-08`
     - Import day-bucket functions with rename; add 2 delegation methods; DEFAULT_CUTOVER_HOUR named constant; 15/15 integration assertions pass; full `node --test` 55/55.
2. **Task 2 — dom.js helpers + 4-button today-screen + day-grouped render:**
   - Single commit: `11b0d6e` `feat(NW-01-01-03): LOG-02,LOG-03,LOG-04,LOG-08,LOG-09 four quick-log buttons + day-grouped list with extraNaps surfacing per D-10,D-11,D-12,D-15`
     - 4 files modified (+251 / -37); dom.js created; today-screen rewritten; index.html no-JS skeleton; style.css extended.
3. **Task 3 — Playwright e2e quick-log spec:**
   - Single commit: `910f83b` `test(NW-01-01-03): LOG-02,LOG-03,LOG-04,LOG-09 e2e quick-log + double-click idempotency + extraNap surfacing per Pitfall #5,#8`
     - 6 specs in `tests/e2e/quick-log.spec.js` (96 lines); all green; reload.spec.js also still green.

## Files Created/Modified

See `key-files` in frontmatter. Net change: 2 new files (`js/ui/dom.js`, `tests/e2e/quick-log.spec.js`), 5 modified.

## Decisions Made

- **Static no-JS skeleton in `index.html` + JS-driven render.** The plan's positive grep gate `grep -E 'data-log="(...)"' index.html` required ≥1 match, but the plan also said "today-screen builds the entire UI under that mount." Resolved by adding a static 4-button + dayList skeleton in `<main id="app">`; today-screen.js's `root.replaceChildren(...)` on mount wipes and rebuilds the same shape. Side benefit: progressive-enhancement fallback when JS fails to load. **Why:** Satisfies both directives without duplicating runtime button-construction logic.
- **Debounce uses `performance.now()`, not `Date.now()` or `new Date().getTime()`.** Documented inline. `performance.now()` is a non-domain monotonic clock — using it for UI-domain debounce timing keeps the clock adapter (D-07) sacred for domain time and the `grep -E 'new Date\(\)' today-screen.js` invariant clean.
- **Anchored regex for nap-button selectors.** `getByRole('button', { name: /^nap start$/i })` rather than `/nap start/i` — defensive against future label collisions (e.g. "Skip to nap start" in Settings later).
- **DEFAULT_CUTOVER_HOUR named constant.** Documents the Phase 2 / CFG-08 injection seam. Cheap to add now; saves rediscovering the spot later.
- **No tests added against `js/ui/dom.js` itself.** It's a 21-line wrapper around `document.createElement` + `replaceChildren` + `querySelector`. Coverage is indirect via every today-screen render path + every e2e spec. **Why:** Adding browser-bound unit tests would require either jsdom (forbidden npm dependency) or a separate Playwright unit-test runner (overkill); the integration coverage is sufficient.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `new Date()` literal inside two `js/ui/today-screen.js` documentation comments tripped the negative-grep acceptance gate**
- **Found during:** Task 2 acceptance-criteria verification (between Task 2 implementation and commit)
- **Issue:** Two header comments said "No `new Date()` here" and "the grep gate forbidding `new Date()` in UI code stays clean" — both contained the literal pattern `new Date()` which made `grep -E "new Date\(\)" js/ui/today-screen.js` match comment text.
- **Fix:** Reworded both comments to say "No domain-time Date constructor" and "the grep gate forbidding the Date constructor" without using the literal forbidden pattern. The functional code never calls the Date constructor; the documentation now describes the prohibition without echoing it.
- **Files modified:** js/ui/today-screen.js (2 comment lines only)
- **Verification:** Re-ran the negative-grep — zero matches; full `node --test` 55/55 still green.
- **Folded into commit:** `11b0d6e` (Task 2's GREEN) — caught before commit, no separate commit needed.
- **Note:** This is the same documentation-phrasing trap that bit Plan 01-02 / Task 2 (day-bucket.js header comment). Consider expressing future "do-not-do-X" invariants without quoting X verbatim in the docstring, or use a non-literal placeholder like `Date(...)` or "the Date constructor."

**2. [Rule 3 — Blocking issue] `index.html` originally lacked any `data-log=*` attribute**
- **Found during:** Task 2 grep-gate verification
- **Issue:** Plan 01-01's `index.html` rendered `<main id="app"></main>` and let JS construct all DOM. Plan 03's positive grep gate required `index.html` to contain at least one `data-log="..."` attribute. Strictly following the plan's "today-screen builds the entire UI" directive would have left `index.html` empty and failed the grep gate.
- **Fix:** Added a static no-JS skeleton (4 buttons with `data-log` attributes + an empty `.dayList`) inside `<main id="app">`. JS still owns the runtime — `root.replaceChildren(...)` wipes the skeleton on mount and rebuilds the identical shape. Net behavior: zero user-visible change versus pure-JS rendering, but the data-log contract is now observable statically.
- **Files modified:** index.html (+ ~12 lines static skeleton)
- **Verification:** `grep -E 'data-log="(wake|bedtime|napStart|napEnd)"' index.html | wc -l` → 4; reload.spec.js still green (the static skeleton + the JS render produce the same DOM, so the role-based selector finds the button either way).
- **Folded into commit:** `11b0d6e` (Task 2's GREEN) — caught and fixed as part of the same task's implementation.

### Out-of-Scope Discoveries

None. No pre-existing issues were touched; `nw-research-test/` directory at repo root remains untracked and unmodified.

---

**Total deviations:** 2 auto-fixed (1 documentation phrasing, 1 grep-gate reconciliation)
**Impact on plan:** None on functional contract. Both fixes are inside the plan's stated intent — one is a documentation re-phrasing, the other reconciles two directives in the plan that pointed in slightly different directions.

## Issues Encountered

- **Plan grep-gate vs render-directive tension.** Documented above under Deviation #2. Resolved with the static-skeleton + replaceChildren pattern; recommend future plans either drop the static-grep gate when the directive is "JS owns the render," or explicitly call out the progressive-enhancement skeleton pattern as the satisfying answer.
- **Long file-system Windows path warnings on `git commit` (`LF will be replaced by CRLF`).** Same as Plan 01-01 / 01-02. Cosmetic; no impact.

## TDD Gate Compliance

Plan type is `execute` (not `tdd`), so the plan-level TDD gate enforcement does not apply. Task 1 nevertheless followed strict RED→GREEN per its own `tdd="true"` attribute:

- Task 1: `test(NW-01-01-03)` f4e1054 (4 failing) → `feat(NW-01-01-03)` 192460a (15/15 green) ✓

Tasks 2 and 3 are non-TDD per plan (UI test-after with E2E as the regression guard, per PLAT-11). They land single feat/test commits without an explicit RED step.

## Known Stubs

None. The Today screen now does everything the Phase 1 plan calls for it to do: 4 buttons, day-grouped list, extraNap surfacing, debounce. Plan 04 will add manual entry / edit / delete affordances on top of this slice.

## User Setup Required

None — no external services, no env vars, no migrations. The Phase 1 stack remains zero-runtime-dependency.

## Next Phase Readiness

- **Plan 01-04 (Wave 3)** — manual entry + edit + delete — can start immediately. It will extend `eventLog` with `editEvent` / `deleteEvent` / `addEventAt` and add a modal UI built on the same `js/ui/dom.js` helpers landed in this plan.
- **No regression on prior plans:** node tests 55/55, Playwright tests 7/7 (1 from Plan 01-01 + 6 new). The full pyramid is green.
- **Open follow-up carried from Plan 01-01:** First green CI run on `main` still pending GitHub Actions recovery — not blocking; the workflow file remains structurally valid.

## Self-Check: PASSED

**Created files verified to exist:**
- FOUND: js/ui/dom.js
- FOUND: tests/e2e/quick-log.spec.js

**Modified files verified:**
- FOUND: js/store/event-log.js (now exports daysByCalendar / daysBySubjectiveNight)
- FOUND: js/ui/today-screen.js (now contains BUTTONS, performance.now(), extraNap, daysByCalendar(7))
- FOUND: index.html (now contains 4 data-log="..." attributes)
- FOUND: style.css (now contains .quickLog, .day, .extraNap)
- FOUND: tests/integration/event-log.test.js (now 15 assertions across 5 describe blocks)

**Commits verified in `git log`:**
- FOUND: f4e1054 (RED Task 1)
- FOUND: 192460a (GREEN Task 1)
- FOUND: 11b0d6e (GREEN Task 2)
- FOUND: 910f83b (Task 3 e2e)

**Acceptance gates:**
- FOUND: `node --test` exits 0 with 55/55 passing
- FOUND: `npx playwright test` exits 0 with 7/7 passing
- FOUND: 4 `data-log="(wake|bedtime|napStart|napEnd)"` matches in index.html
- FOUND: zero `\.innerHTML\s*=\s*[^"]` matches in today-screen.js (T-07)
- FOUND: zero `new Date\(\)` matches in today-screen.js (clock-seam preserved)
- FOUND: `daysByCalendar(7)` literal present in today-screen.js (D-10/D-15)
- FOUND: `performance.now()` present in today-screen.js (T-05)
- FOUND: `extraNap` present in today-screen.js (LOG-09 UI surfacing)
- FOUND: `localStorage.clear()` in quick-log.spec.js beforeEach (Pitfall #8)
- FOUND: `clickCount: 2` in quick-log.spec.js (T-05 double-click test)
- FOUND: `.extraNap` selector in quick-log.spec.js (LOG-09 UI surfacing)

---
*Phase: 01-log-persist · Plan: 03 (Four Quick-Log Buttons + Day-Grouped List)*
*Completed: 2026-05-26*
