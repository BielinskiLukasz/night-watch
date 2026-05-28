---
phase: 02-configuration-settings
plan: "04"
subsystem: ui
tags: [vanilla-js, native-dialog, playwright, cfg-01, cfg-02, cfg-03, cfg-04, cfg-06, cfg-07, d2-10, d2-11, d2-12, d2-13, d2-14, pitfall-5, t-07]

requires:
  - 02-02 (createSettingsStore — get/update/subscribe)
  - 02-03 (composition root constructs settings store; settings forwarded to mountTodayScreen)

provides:
  - js/ui/header.js — mountHeader({root, settings}) subscribes to settings, writes h1.textContent + document.title via .textContent ONLY (Pitfall #5 / T-2-13)
  - js/ui/settings-modal.js — openSettings({settings}) populates 9 fields, validates via validateSettings(raw, {mode:'save'}), commits via settings.update(normalized) (D2-14 / T-2-14)
  - index.html — <header class="appHeader"> + <dialog id="settings"> with 3 fieldsets (Profile / Time & Day / Forecast tuning per D2-13) + <output id="settingsErrors" aria-live="polite">
  - style.css — 56px header strip, 44px tap target on gear, 500px modal with fieldsets, settingsErrors :empty-hidden surface mirroring #manualEntryErrors
  - tests/e2e/settings-modal.spec.js — 10 specs covering CFG-01 header round-trip, XSS guard, reload persistence, D2-14 Save/Cancel/ESC/invalid-input flows, CFG-02..04/06..07 round-trip, a11y aria-labelledby

affects:
  - 02-05 (Today day-cutover wiring — header + Settings modal already feed user values into settings store)
  - 02-06 (12h/24h propagation — timeFormat select in modal is the user-facing toggle; today-screen + manual-entry will read settings.get().timeFormat)

tech-stack:
  added: []
  patterns:
    - "Subscriber/observer wiring (D2-09): mountHeader subscribes once at construction; settings.update fires subscribers synchronously so h1 + document.title re-render before settings-modal.js returns"
    - "Native <dialog method='dialog'> + form submit (D2-12): Save button has formnovalidate to bypass HTML5 min/max so validateSettings is the source of truth (mirrors #manualEntry Save). Cancel/ESC produce empty/non-'save' returnValue → onClose short-circuits."
    - "Re-open after validation failure (Pattern D / D2-14): queueMicrotask(() => dlg.showModal()) defers the re-show until after the close event commits — Chromium throws InvalidStateError on showModal of an already-open dialog. Same idiom as manual-entry's UAT-gap-2/3 visible-failure path."
    - "textContent ONLY (Pitfall #5 / T-07 / T-2-13): h1.subjectName write + el('p',{textContent}) error rendering. No innerHTML in either header.js or settings-modal.js (the only 'innerHTML' tokens in those files are doc comments warning against use)."

key-files:
  created:
    - js/ui/header.js (~45 lines: mountHeader + subscribe + click → openSettings)
    - js/ui/settings-modal.js (~115 lines: openSettings + populate + close-handler with validate + re-open path)
    - tests/e2e/settings-modal.spec.js (~150 lines: 10 specs)
  modified:
    - index.html (+76 lines: <header class="appHeader"> with inline SVG gear; <dialog id="settings"> with 3 fieldsets + 9 fields + settingsErrors <output> + Cancel/Save menu; formnovalidate on Save)
    - style.css (+135 lines: .appHeader / .settingsTrigger; #settings dialog + fieldsets + buttons; .settingsErrors :empty-hidden surface)
    - js/app.js (+3 lines: import mountHeader; mount before mountTodayScreen on header.appHeader root)

key-decisions:
  - "formnovalidate on Save (added post-RED on the cutoverHour=99 spec). Without it, HTML5 min/max blocks the form submission before the close event fires, so validateSettings never runs and the inline error block stays empty. Mirrors the same idiom on #manualEntry's Save (Plan 01-07 LOG-07 silent rounding) — the JS validator is the source of truth; HTML attributes are belt-and-suspenders hints."
  - "Header is a static markup target with JS only writing textContent + binding click. No dynamic node construction from subjectName — the only mutation paths are h1.textContent and document.title (HTML-inert)."
  - "All 9 fields populate on every open via .value / .checked. The 5 stored-but-inert fields (CFG-02/03/04/06/07) ship visible + editable in the modal, persist across reload, but have no Phase 2 behavioral consumer (D2-02). Phase 3 reads them."
  - "Settings modal Cancel button gets formnovalidate AND uses type='button' (manual close via dlg.close('cancel')); the Save button uses type='submit' value='save' so the dialog's returnValue is set by the native dialog mechanics (D2-12). Both have formnovalidate for parity with #manualEntry."

metrics:
  duration: ~25 min
  completed: 2026-05-28
  tasks: 2
  commits: 2
  test-delta: "+10 E2E (0 → 10 settings-modal.spec.js; 18 Phase 1 specs continue to pass — 28/28 total green)"
  unit-test-delta: "0 (251/251 unchanged — this plan is DOM-only)"
  files-modified: 3
  files-created: 3
---

# Phase 2, Plan 04: Header Strip + Settings Modal Summary

**Shipped the first visible Phase 2 UI surfaces — gear icon in a top header opens a native `<dialog>` Settings modal with three fieldsets (Profile / Time & Day / Forecast tuning) covering all 9 configuration fields. Subject name flows from the modal Save to `h1.subjectName` and `document.title` (CFG-01) via the settings-store subscriber chain. Cancel / ESC / invalid-input flows all match the manual-entry modal contract (D2-14). 28/28 Playwright specs green (10 new + 18 Phase 1 baseline); 251/251 unit tests unchanged.**

## Performance

- **Duration:** ~25 minutes wall-clock
- **Completed:** 2026-05-28
- **Tasks:** 2 (Task 1 = HTML/CSS/JS modules + composition wiring; Task 2 = Playwright spec)
- **Commits:** 2 (Task 1 feat; Task 2 test)
- **Test delta:** unit 251/251 unchanged (DOM-only plan); E2E +10 (18 → 28)
- **Files modified:** 3 (index.html, style.css, js/app.js)
- **Files created:** 3 (js/ui/header.js, js/ui/settings-modal.js, tests/e2e/settings-modal.spec.js)

## Accomplishments

- **`<header class="appHeader">` strip.** Static markup in `index.html` with left `<h1 class="subjectName">` and right `<button class="settingsTrigger">` containing an inline SVG gear (no external asset). 56px min-height per UI-SPEC, 44px min tap target on the gear, ellipsis overflow on long names.
- **Native `<dialog id="settings">` modal.** Three fieldsets (D2-13) — Profile (subjectName), Time & Day (cutoverHour / groupingMode / timeFormat), Forecast tuning (autoOutlier / maxDelta / minDays / windowDays / statBlend). `<output id="settingsErrors" aria-live="polite">` renders one `<p data-field=...>` per error. Save uses `formnovalidate` so the JS validator (not HTML5 min/max) is the source of truth.
- **`mountHeader({root, settings})`.** Subscribes to settings, writes `h1.textContent = snap.subjectName` and `document.title = snap.subjectName ? 'Nightwatch — {name}' : 'Nightwatch'` (D2-11). Click on gear opens `openSettings({settings})`. textContent ONLY — Pitfall #5 / T-07 / T-2-13. The XSS spec (HTML entities `'<b>test</b>'`) verifies the literal-text invariant in a real browser.
- **`openSettings({settings})`.** Populates all 9 fields from `settings.get()` via `.value` / `.checked`; on close with `returnValue === 'save'`, builds the raw object (trim string, coerce numbers, checkbox 'on' → boolean), runs `validateSettings(raw, {mode:'save'})`, and either commits via `settings.update(result.normalized)` (T-2-14) or renders errors + `queueMicrotask(showModal)` to re-open with focus on the first errored field (D2-14 visible-failure path mirroring Plan 01-07).
- **Composition root wires header.** `js/app.js` imports `mountHeader` and mounts on `header.appHeader` before `mountTodayScreen`. The Plan 02-03 forward-compatible `settings` parameter into `mountTodayScreen` is already in place; Plan 02-05 will start consuming it.
- **10 Playwright specs.** Cover gear-opens, CFG-01 Save round-trip, empty-name → 'Nightwatch' branch, XSS literal-text guard, reload persistence, invalid cutoverHour visible error, Cancel discards edits, ESC discards edits, CFG-02..04/06..07 9-field round-trip across reload, and `aria-labelledby` a11y. All 18 Phase 1 specs continue to pass — no regression.

## Task Commits

1. **Task 1 — Header + Settings modal UI (single feat, `type="auto"`):**
   - `4bbb950` `feat(NW-02): header strip + Settings modal UI (CFG-01..04, CFG-06..07, D2-10..14, T-2-13..15)`
     - 5 files changed, +445 / -1. index.html + style.css + js/ui/header.js + js/ui/settings-modal.js + js/app.js. The `type="auto"` task ships as a single feat per the plan's `<action>` flow — no RED/GREEN split for pure UI scaffolding.

2. **Task 2 — E2E Playwright spec (single test commit):**
   - `21af77d` `test(NW-02): E2E coverage for Settings modal (CFG-01..04, CFG-06..07, D2-12..14, D2-27)`
     - 2 files changed, +151 / -1. tests/e2e/settings-modal.spec.js + the `formnovalidate` fix on Save in index.html. The fix landed in the test commit because it was surfaced by the cutoverHour=99 spec running — a single conceptual unit (E2E gate found the missing attribute, test commit pins both).

## Deviations from Plan

**Total deviations:** 1 (intentional, narrow scope)

**1. `formnovalidate` added to the Save button.** The plan's STEP 1 markup omitted `formnovalidate` on Save. Running the E2E spec surfaced the gap immediately: `<input type="number" min="0" max="23">` makes HTML5 native validation block the `close` event when `cutoverHour=99` is filled, so `validateSettings` never runs and `<output id="settingsErrors">` stays empty. Adding `formnovalidate` (matching the `#manualEntry` Save idiom from Plan 01-04 / LOG-07) restores the JS-validator-as-source-of-truth contract D2-14 specifies. Comment added inline so the next reader sees the rationale.

## Source Assertions Verified

```
grep -c 'innerHTML.*=' js/ui/header.js                  → 0   ✓ (only comment mentions; no assignments)
grep -c 'innerHTML.*=' js/ui/settings-modal.js          → 0   ✓ (only comment mentions; no assignments)
grep -c 'aria-live.*polite' index.html                  → 2   ✓ (manualEntryErrors + settingsErrors)
grep -c 'validateSettings' js/ui/settings-modal.js      → 2   ✓ (import + call)
grep -c 'mountHeader' js/app.js                         → 2   ✓ (import + call)
grep -c 'textContent' js/ui/header.js                   → 2   ✓ (h1.textContent + doc comment)
grep -c 'formnovalidate' index.html                     → 3   ✓ (manualCancel + manualSave + settingsSave)
grep -c 'fieldset' index.html                           → 6   ✓ (3 open + 3 close on settings dialog)
npx playwright test                                      → 28/28 pass  ✓
npm run test:unit                                        → 251/251 pass  ✓
```

## Known Stubs

- **Stored-but-inert fields per D2-02.** CFG-02 (cutoverHour), CFG-03 (groupingMode), CFG-04 (timeFormat), CFG-06 (autoOutlier), CFG-07 (maxDelta/minDays/windowDays/statBlend) are visible + editable + persist in the Settings modal, but the rest of the app does not yet react to them. Plan 02-05 starts consuming `cutoverHour` and `groupingMode`; Plan 02-06 starts consuming `timeFormat`; Phases 3+ consume the forecast-tuning fields.
- **No grouping toggle on Today yet.** The Settings modal lets the user pick `groupingMode`, but the Today screen does not yet render the toggle row above the day list (that's Plan 02-05 work).
- **No 12h time picker in manual-entry yet.** The modal can save `timeFormat: '12h'`, but `manual-entry.js` still shows the 24h hour input. Plan 02-06 wires the conditional AM/PM select.

## Threat Surface Scan

- **T-2-13** (header h1 XSS): `h1.textContent = snap.subjectName` and `document.title = ...` template literal. No DOM construction from subjectName. XSS spec confirms `'<b>test</b>'` renders as literal text with zero `<b>` element children.
- **T-2-14** (settings modal Save handler): `validateSettings(raw, {mode:'save'})` runs on every Save attempt; only `result.normalized` reaches `settings.update`. Raw FormData strings never persist.
- **T-2-15** (settings error rendering): `el('p', {'data-field': field, textContent: message})` per error. No innerHTML.
- **T-2-16** (stored-but-inert fields): No behavioral consumer in Phase 2. localStorage payload is ~150 bytes total; no exhaustion vector.
- **T-2-17** (subjectName length): `maxlength="40"` on input + `maxLen:40` in validator. Two-layer enforcement.
- **T-2-SC** (supply chain): No new dependencies; `package.json` `dependencies: {}` unchanged.

## TDD Gate Compliance

Both tasks are `type="auto"` per the plan (no `tdd="true"`). Single-commit landing matches Plan 02-03 Task 1 precedent for `type="auto"` tasks. The E2E spec in Task 2 is the visible-behavior gate — it surfaced one missing attribute (`formnovalidate` on Save) before the GREEN landed.

## Next Phase Readiness

- **Plan 02-05 (Today day-cutover + grouping toggle)** can start immediately. `mountTodayScreen` already receives `settings`; the grouping toggle and `daysBySubjectiveNight(snap.cutoverHour, 7)` call-site rewrite is the next concrete change.
- **Plan 02-06 (12h/24h propagation)** can consume `settings.timeFormat` directly. The Settings modal already exposes the toggle.
- **Tests baseline at handoff:** unit 251/251 green, E2E 28/28 green.

## Self-Check: PASSED

**Modified files verified:**
- VERIFIED: index.html — header + settings dialog + formnovalidate on Save
- VERIFIED: style.css — .appHeader / #settings rules added
- VERIFIED: js/ui/header.js — mountHeader exported, textContent ONLY
- VERIFIED: js/ui/settings-modal.js — openSettings exported, validateSettings called, formnovalidate respected
- VERIFIED: js/app.js — mountHeader imported and called

**Commits verified in git log:**
- FOUND: 4bbb950 (Task 1 feat)
- FOUND: 21af77d (Task 2 test)

**Test suite:**
- FOUND: `npm run test:unit` exits 0 with 251/251 passing
- FOUND: `npx playwright test` exits 0 with 28/28 passing
