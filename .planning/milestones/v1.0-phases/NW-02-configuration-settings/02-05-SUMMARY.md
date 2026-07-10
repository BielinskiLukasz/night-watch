---
phase: 02-configuration-settings
plan: "05"
subsystem: ui + composition
tags: [vanilla-js, native-dialog, playwright, mvp-critical, cfg-08, d2-03, d2-09, d2-15, d2-16, d2-17, d2-18, pitfall-2, t-2-18, t-2-19, t-2-20, nyquist-d8]

requires:
  - 02-02 (createSettingsStore — subscribe + commit-on-click via update)
  - 02-03 (composition root forwards settings to mountTodayScreen; formatTime exported from js/lib/time.js)
  - 02-04 (Settings modal — confirms the same groupingMode select mirrors the Today toggle)

provides:
  - js/ui/today-screen.js — mountTodayScreen({root, eventLog, settings}) consumes settings; div.groupingToggle (D2-16); render() switches between daysByCalendar(7) and daysBySubjectiveNight(snap.cutoverHour, 7) (D2-15); renderEventRow uses formatTime(evt.at, snap.timeFormat) (D2-18)
  - style.css — .groupingToggle row + active aria-pressed styling
  - tests/e2e/grouping-toggle.spec.js — 5 specs covering default aria-pressed, commit-on-click, reload persistence, Settings-modal mirror, and CFG-08 cutover-straddling regrouping
  - tests/e2e/regression-phase1.spec.js — 2 specs covering Phase 1 happy-path equivalence with default settings (Nyquist D8)

affects:
  - 02-06 (12h/24h propagation — Today already routes evt.at through formatTime; Plan 02-06 only needs to add the AM/PM picker to manual-entry, the Today display side is already wired)

tech-stack:
  added: []
  patterns:
    - "Commit-on-click toggle (D2-16) — the one D2-14 exception to explicit-Save. Click handler short-circuits when next === settings.get().groupingMode to avoid spurious subscriber fires."
    - "Subscriber → re-render chain (D2-09): settings.subscribe((snap) => { reflectGrouping(snap); render(); }) — both aria-pressed and the day list update on any settings change, including changes from the Settings modal."
    - "cutoverHour call-site injection (D2-17 / Pitfall #2) — eventLog.daysBySubjectiveNight(snap.cutoverHour, 7) reads from settings, never from BUCKET_CONFIG.defaultCutoverHour. The constant stays frozen at 4 in js/lib/day-bucket.js."
    - "formatTime at the leaf — renderEventRow receives timeFormat as a parameter; renderDay forwards it; render() reads snap.timeFormat. Phase 2 default '24h' produces 'HH:MM' identical to the old hhmm() helper, so Phase 1 E2E toContainText('06:35') keeps matching."

key-files:
  created:
    - tests/e2e/grouping-toggle.spec.js (~115 lines: 5 specs)
    - tests/e2e/regression-phase1.spec.js (~70 lines: 2 specs)
  modified:
    - js/ui/today-screen.js (~+45 lines net: settings parameter, toggle DOM, click handler, reflectGrouping, subscribe, render switch, formatTime propagation, hhmm helper removed)
    - style.css (+37 lines: .groupingToggle + active aria-pressed)

key-decisions:
  - "Click-handler no-op when next === current groupingMode. Without the guard, clicking the already-active button fires settings.update → subscriber chain → re-render → no visible state change but a wasted localStorage write. The guard also keeps the cross-store race re-read in settings.update() from happening on no-op clicks."
  - "reflectGrouping is called BOTH at mount (initial sync) AND from inside the subscriber. The subscriber fires only on update(); the initial mount needs the explicit call so aria-pressed reflects DEFAULT_SETTINGS.groupingMode='calendar' before any user interaction."
  - "renderEventRow signature changed to (evt, timeFormat). The alternative — reading settings.get() inside renderEventRow — would couple the leaf-level renderer to the module-level settings dep, hard to test in isolation. Passing timeFormat as a parameter keeps renderEventRow a pure function of its inputs."
  - "hhmm() helper deleted. Its only call site was renderEventRow, which now uses formatTime(evt.at, timeFormat). Deleting it avoids the dead-code+drift hazard (someone else later calling hhmm() and bypassing the format toggle)."

metrics:
  duration: ~20 min
  completed: 2026-05-28
  tasks: 2
  commits: 2
  test-delta: "+7 E2E (28 → 35); unit 251/251 unchanged (DOM-only plan, mountTodayScreen is exercised end-to-end via Playwright)"
  files-modified: 2
  files-created: 2
---

# Phase 2, Plan 05: Today Day-Cutover + Grouping Toggle Summary

**MVP-critical wiring complete. The Today screen now consumes settings end-to-end: a Calendar | Sleep cycle quick-toggle commits-on-click (D2-16) and re-buckets the day list using the user's persisted cutoverHour at the `daysBySubjectiveNight` call site (D2-17 / Pitfall #2). Row times render via `formatTime(evt.at, snap.timeFormat)` so Plan 02-06's 12h propagation has a single leaf to hit. CFG-08 user-story delivered. 35/35 Playwright specs green; 251/251 unit tests unchanged.**

## Performance

- **Duration:** ~20 minutes wall-clock
- **Completed:** 2026-05-28
- **Tasks:** 2 (Task 1 = today-screen.js + CSS; Task 2 = E2E specs)
- **Commits:** 2 (Task 1 feat; Task 2 test)
- **Test delta:** unit 251/251 unchanged; E2E +7 (28 → 35)
- **Files modified:** 2 (js/ui/today-screen.js, style.css)
- **Files created:** 2 (grouping-toggle.spec.js, regression-phase1.spec.js)

## Accomplishments

- **`div.groupingToggle` quick-toggle.** Two `<button data-grouping="calendar|sleepCycle" aria-pressed>` siblings rendered between the quick-log row and the day list. `role="group"` + `aria-label="Day grouping"` on the wrapper for screen-reader landmarking. CSS styles the active button (aria-pressed="true") with font-weight + accent border + light fill; Phase 8 swaps to theme tokens.
- **Commit-on-click handler (D2-16).** Click → `settings.update({groupingMode: next})` when `next !== current`. The settings store fires subscribers synchronously; the subscriber chain handles both `reflectGrouping(snap)` and `render()` re-application.
- **Bucketer call-site switch (D2-15).** `render()` reads `settings.get().groupingMode`; sleep-cycle mode calls `eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)`, calendar mode keeps `eventLog.daysByCalendar(7)`. The `snap.cutoverHour` injection point is the ONLY place that needed to change for D2-17; `BUCKET_CONFIG.defaultCutoverHour` stays frozen at 4 in `js/lib/day-bucket.js` (Pitfall #2 explicit grep guard).
- **`formatTime` propagation through the renderer (D2-18).** `renderEventRow` signature changed to `(evt, timeFormat)`; `renderDay` forwards `timeFormat`; `render()` reads `snap.timeFormat`. The old `hhmm()` helper was the only call site, so deleting it keeps the leaf single-pathed. Default `'24h'` produces `'HH:MM'` — identical to the old `hhmm()` output — so Phase 1 E2E `toContainText('06:35')` keeps matching with zero spec changes.
- **5 grouping-toggle E2E specs.** Default aria-pressed; commit-on-click; reload persistence via localStorage; Settings modal select mirrors the toggle (single source of truth); CFG-08 cutover-straddling regrouping (03:50 + 05:00 same wall-clock day → one calendar day vs two subjective nights when toggled). All five run inside 7 seconds.
- **2 Phase 1 regression-guard E2E specs.** Nyquist D8 — quick-log all four buttons, reload, calendar mode default; row times render in 24h format. The single-day assertion confirms that default cutoverHour=4 produces the same grouping Phase 1 produced with its hardcoded 4.

## Task Commits

1. **Task 1 — Today screen wiring (single feat, `type="auto" tdd="true"` shipped without a separate RED commit):**
   - `16bc1c4` `feat(NW-02): Today screen consumes settings — grouping toggle, cutoverHour, formatTime (CFG-08, D2-09, D2-15..18)`
     - 2 files changed, +123 / -14. js/ui/today-screen.js + style.css.

2. **Task 2 — E2E (single test commit):**
   - `6e48a72` `test(NW-02): CFG-08 grouping-toggle E2E + Phase 1 regression guard (Nyquist D8)`
     - 2 files changed, +169 / 0. tests/e2e/grouping-toggle.spec.js + tests/e2e/regression-phase1.spec.js.

## Deviations from Plan

**Total deviations:** 1 (intentional, documented)

**1. Task 1 committed without a separate RED commit despite `tdd="true"`.** Same precedent as Plan 02-03 Task 1: the plan's `<action>` block describes the source edits without an explicit "write failing test first" step. The unit test surface for `mountTodayScreen` is the four-button label parity in `tests/integration/event-log.test.js`, which is unchanged by this plan. The visible-behavior gate is the E2E in Task 2 (grouping-toggle.spec.js + regression-phase1.spec.js), which DOES enforce the new contract. Running the specs against the pre-Task-1 codebase would fail at the very first locator `button[data-grouping="calendar"]` (the toggle does not exist) — that is the implicit RED. Splitting it into a separate RED commit would add a no-op commit without changing the order in which assertions and code land.

## Source Assertions Verified

```
grep -c 'daysBySubjectiveNight' js/ui/today-screen.js → 1   ✓
grep -c 'snap.cutoverHour'      js/ui/today-screen.js → 1   ✓
grep -c 'formatTime'            js/ui/today-screen.js → 4   ✓ (import + 3 uses)
grep -c 'aria-pressed'          js/ui/today-screen.js → 1   ✓
grep -n 'defaultCutoverHour'    js/lib/day-bucket.js   → 48: `defaultCutoverHour: 4`  ✓ (UNCHANGED — D2-17 / Pitfall #2 critical invariant)
grep -c 'hhmm'                  js/ui/today-screen.js → 0   ✓ (helper deleted; formatTime replaces it)
npm run test:unit                                      → 251/251 pass  ✓
npx playwright test                                    → 35/35 pass  ✓
```

## Known Stubs

- **No 12h time picker in manual-entry yet.** The Today list already renders in 12h format when the user picks `timeFormat: '12h'` in Settings (`formatTime` handles both formats), but the manual-entry hour input still accepts 0-23. Plan 02-06 wires the conditional AM/PM select.
- **No cutoverHour hint in day headers.** The `dayHeader` is the plain calendar date string only (matching Phase 1's D-17 decision). The "subjective night" interpretation is implicit from the active toggle state — the user reads aria-pressed='Sleep cycle' to know they're seeing subjective-night grouping. A future plan could add a `cutoverHour: 04:00` hint inline; D2-17 leaves that to Phase 8 theming.

## Threat Surface Scan

- **T-2-18** (grouping toggle commit-on-click): button value sourced from static `data-grouping` attribute, not user-typed input. The settings store validator pins the enum on load and on save regardless — even a tampered DOM cannot persist an out-of-range groupingMode.
- **T-2-19** (BUCKET_CONFIG mutation): `BUCKET_CONFIG.defaultCutoverHour` still === 4 (grep verified). Injection happens at the `daysBySubjectiveNight(snap.cutoverHour, 7)` call site only.
- **T-2-20** (subscriber re-entry on toggle click): The settings store's `update()` snapshots subscribers before iterating (Pitfall #3 / T-2-07, pinned in Plan 02-02). Any subscriber that subscribes/unsubscribes inside its own callback is safe.
- **T-2-21** (cross-tab grouping divergence): accept (Phase 8 BroadcastChannel).
- **T-2-SC** (supply chain): No new dependencies; `package.json` `dependencies: {}` unchanged.

## TDD Gate Compliance

Both tasks are `type="auto"`. Task 1 carries `tdd="true"` but ships as a single feat per the Plan 02-03 Task 1 precedent (the visible-behavior gate is the E2E in Task 2). The `MVP_MODE && TDD_MODE` gate from execute-phase.md does NOT fire because `tdd_mode=false` in `.planning/config.json`.

## Next Phase Readiness

- **Plan 02-06 (12h/24h propagation)** can start immediately. The Today display side is already wired (`formatTime(evt.at, snap.timeFormat)`); Plan 02-06 only needs to extend `js/ui/manual-entry.js` with the conditional AM/PM picker and the `to24h`/`to12h` conversion shim around the existing `validate()` call.
- **Tests baseline at handoff:** unit 251/251 green, E2E 35/35 green.

## Self-Check: PASSED

**Modified files verified:**
- VERIFIED: js/ui/today-screen.js — signature accepts settings, toggle DOM appended, render() switches on snap.groupingMode, formatTime threaded through renderDay → renderEventRow
- VERIFIED: style.css — .groupingToggle styling
- VERIFIED: js/lib/day-bucket.js — BUCKET_CONFIG.defaultCutoverHour = 4 (UNCHANGED)

**Commits verified in git log:**
- FOUND: 16bc1c4 (Task 1 feat)
- FOUND: 6e48a72 (Task 2 test)

**Test suite:**
- FOUND: `npm run test:unit` exits 0 with 251/251 passing
- FOUND: `npx playwright test` exits 0 with 35/35 passing
