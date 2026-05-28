---
phase: 02-configuration-settings
verified: 2026-05-28T10:15:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/10 (UAT Test 1 issue)
  source: 02-UAT.md (Gaps section)
  gaps_closed:
    - "empty-h1-on-fresh-install (major) — fresh installs rendered an empty header h1"
    - "gear-icon-clipped (cosmetic) — truncated Material Icons SVG path"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Configuration & Settings — Verification Report

**Phase Goal (User Story):** As a parent tracking a child's sleep, I want to set the day-cutover hour and have it stick across reloads, so that day-grouping matches our household's actual sleep cycle, not a hardcoded default.

**Mode:** mvp
**Verified:** 2026-05-28T10:15:00Z
**Status:** passed
**Re-verification:** Yes — after Plan 02-07 gap closure

---

## User Flow Coverage (MVP Mode)

The Phase 2 goal is a User Story; the success condition is the `so that …` clause. The Phase 2 UAT (02-UAT.md) walked Tests 2–5 as the user-flow trace and Test 10 as the coverage check.

| Step | Expected | Evidence in Codebase | Status |
|------|----------|---------------------|--------|
| 1. Open Settings via gear | Modal opens centered, 3 fieldsets visible, cutoverHour input pre-filled with default 4 | `index.html:30` button.settingsTrigger; `js/ui/header.js:46` click→openSettings; `js/ui/settings-modal.js` mountSettings; UAT Test 2 = pass | VERIFIED |
| 2. Change cutoverHour and Save | Modal closes; header updates if subjectName set; cutoverHour persists | `js/store/settings.js` re-read-before-write update; `js/ui/settings-modal.js` validateSettings(raw,{mode:'save'}) commits via settings.update(normalized); UAT Test 3 = pass | VERIFIED |
| 3. Reload preserves cutoverHour | After reload, Settings → Day cutover hour still shows 6 (not default 4) | `js/lib/storage-adapter.js` localStorage key `nightwatch:db`; UAT Test 4 = pass; settings-modal.spec.js CFG-02..04, CFG-06..07 round-trip spec | VERIFIED |
| 4. Sleep-cycle grouping uses chosen cutoverHour | Day boundaries drawn at 06:00 (user value), not 04:00 hardcoded | `js/ui/today-screen.js:242` eventLog.daysBySubjectiveNight(snap.cutoverHour, 7); `js/lib/day-bucket.js:48` BUCKET_CONFIG.defaultCutoverHour:4 = fallback only; UAT Test 5 = pass; tests/e2e/grouping-toggle.spec.js CFG-08 cutover-straddling spec | VERIFIED |
| 5. Coverage check (Test 10) | `daysBySubjectiveNight(snap.cutoverHour, …)` call-site reads from settings; BUCKET_CONFIG.defaultCutoverHour unchanged | Plan 02-05 SUMMARY source-assertions grep block: `daysBySubjectiveNight → 1`, `snap.cutoverHour → 1`, `defaultCutoverHour → 48: 4` (unchanged). UAT Test 10 = pass | VERIFIED |

**User-story payoff confirmed in code:** the persisted `cutoverHour` from settings drives sleep-cycle day grouping; the hardcoded 4 in `BUCKET_CONFIG` is fallback-only.

---

## Goal Achievement — Observable Truths (Success Criteria)

ROADMAP.md § Phase 2 lists 4 Success Criteria. SC-3 splits into two parts (auto-outlier toggle in Phase 2; manual "rejected" toggle in CFG-05 deferred to Phase 4). All Phase-2-in-scope truths verified.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: User enters subject name in Settings; name appears in header across screens (CFG-01) | VERIFIED | `js/ui/header.js:38` `h1.textContent = snap.subjectName \|\| 'Nightwatch'`; `js/lib/db-shape.js:35` DEFAULT_SETTINGS.subjectName='Baby'; `tests/e2e/settings-modal.spec.js` CFG-01 round-trip + XSS + empty-fallback specs all green |
| 2 | SC-2: User configures max_delta/min_days/window/stat blend; values persist after reload (CFG-02, 03, 06, 07) | VERIFIED | `tests/e2e/settings-modal.spec.js:113` 'CFG-02..04, CFG-06..07: forecast-tuning + time/day fields round-trip Save → reload' spec passes; settings-store re-read-before-write per Plan 02-02 |
| 3a | SC-3 (Phase-2 portion): User toggles autoOutlier on/off in Settings (CFG-04) | VERIFIED | Checkbox autoOutlier in settings modal (`index.html` Forecast tuning fieldset); CFG-04 persists per spec at line 113; stored-but-inert per D2-02 (Phase 3 reads it) |
| 3b | SC-3 (CFG-05 manual-reject toggle) — out-of-Phase-2 scope | DEFERRED to Phase 4 | Explicit deferral in Plan 02-01 frontmatter + REQUIREMENTS.md:128 (`CFG-05 | Phase 4 | Pending`) + ROADMAP Phase 2 Requirements line lists CFG-05 but Plan 02-01 SUMMARY documents the deferral decision (D2-01) |
| 4a | SC-4 part A: User sets day-cutover hour, saves, applies on reload (CFG-08) | VERIFIED | `js/ui/today-screen.js:242` daysBySubjectiveNight(snap.cutoverHour, 7); `tests/e2e/grouping-toggle.spec.js` CFG-08 specs green; UAT Tests 4 + 5 = pass |
| 4b | SC-4 part B: 24h vs 12h time format persists; times displayed per choice (CFG-09) | VERIFIED | `js/lib/time.js` formatTime/to24h/to12h with Pitfall #4 boundary tests; `js/ui/manual-entry.js` applyTimeFormat helper; 5 CFG-09 e2e specs green (picker shape 12h/24h, reload persistence, Today list rendering) |
| 5 | Phase-2 gate: gap closure (Plan 02-07) lands subjectName='Baby' default + header fallback + complete gear SVG + placeholder hint | VERIFIED | See "Gap Closure Verification" section below — all 5 files confirmed at expected lines |

**Score:** 6/6 in-scope truths verified (CFG-05 is correctly deferred to Phase 4 by explicit decision).

---

## Gap Closure Verification (Plan 02-07)

The previous verification cycle (02-UAT.md) recorded one user-reported issue with two findings. Plan 02-07 was authored to close them. Verified each fix landed at the expected line.

| Finding | File | Expected Change | Actual State | Status |
|---------|------|-----------------|--------------|--------|
| empty-h1-on-fresh-install — data default | `js/lib/db-shape.js:35` | `subjectName: 'Baby'` with CFG-01 comment | Line 35: `subjectName:  'Baby',      // CFG-01 default; user can override via Settings modal` | VERIFIED |
| empty-h1-on-fresh-install — render fallback | `js/ui/header.js:38` | `h1.textContent = snap.subjectName \|\| 'Nightwatch'` | Line 38: `h1.textContent = snap.subjectName \|\| 'Nightwatch';` | VERIFIED |
| empty-h1-on-fresh-install — UX placeholder hint | `index.html:133` | `placeholder="e.g., Baby, Maya, Liam..."` on `<input name="subjectName">` | Line 133: `<input type="text" name="subjectName" maxlength="40" placeholder="e.g., Baby, Maya, Liam...">` | VERIFIED |
| empty-h1-on-fresh-install — unit test literal | `tests/unit/db-shape.test.js:24` | `assert.equal(DEFAULT_SETTINGS.subjectName, 'Baby')` | Line 24: `assert.equal(DEFAULT_SETTINGS.subjectName, 'Baby');` | VERIFIED |
| empty-h1-on-fresh-install — e2e spec | `tests/e2e/settings-modal.spec.js:42, 47` | Title says fallback to 'Nightwatch'; expect toHaveText('Nightwatch') | Line 42: `test('CFG-01: empty subjectName → h1 + document.title both read "Nightwatch" via fallback (D2-11)', ...`; Line 47: `await expect(...h1.subjectName')).toHaveText('Nightwatch');` | VERIFIED |
| gear-icon-clipped — complete SVG path | `index.html:31-33` | Attribution comment + full Material Icons settings gear path (Apache 2.0) | Line 31: `<!-- Settings gear: Material Icons (Apache 2.0). Inline path keeps zero-deps constraint. -->`; Line 33: full `d="M19.14 12.94c.04-.3.06-.61 …"` (8-tooth gear path, 32 path segments) ending at `…3.6 3.6z` fill=currentColor | VERIFIED |

All 5 files modified by Plan 02-07 land exactly as specified in the plan and SUMMARY. Both UAT Test 1 findings are closed in code.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/lib/db-shape.js` | DEFAULT_SETTINGS frozen with 9 keys; subjectName='Baby' | VERIFIED | `Object.freeze({...subjectName: 'Baby', cutoverHour: 4, groupingMode: 'calendar', timeFormat: '24h', ...})` |
| `js/lib/settings-validate.js` | Two-mode validator (mode:'save' strict; default lenient) | VERIFIED | Plan 02-01 + Plan 02-04 SUMMARY confirm validateSettings imported and called in settings-modal.js |
| `js/store/settings.js` | get/update/subscribe; re-read-before-write race mitigation | VERIFIED | UAT Test 10 `verified_in_code`: "8× storage.load/save (re-read-before-write preserved)" |
| `js/lib/time.js` | formatTime + to24h + to12h with Pitfall #4 boundaries | VERIFIED | tests/unit/time.test.js boundary table green (251/251 unit pass includes to24h/to12h boundaries) |
| `js/ui/header.js` | mountHeader textContent ONLY + render fallback to 'Nightwatch' | VERIFIED | Line 38 fallback; Line 40 document.title fallback; Pitfall #5 / T-07 / T-2-13 invariant pinned |
| `js/ui/settings-modal.js` | openSettings populates 9 fields + validates + commits | VERIFIED | Plan 02-04 SUMMARY source-assertions (validateSettings → 2 grep hits) |
| `js/ui/today-screen.js` | groupingToggle + daysBySubjectiveNight(snap.cutoverHour, 7) + formatTime threading | VERIFIED | Plan 02-05 SUMMARY source-assertions confirm 1 daysBySubjectiveNight hit + 1 snap.cutoverHour + 4 formatTime |
| `js/ui/manual-entry.js` | applyTimeFormat + AM/PM select + to24h on submit + settings subscriber lifecycle | VERIFIED | Plan 02-06 SUMMARY source-assertions (applyTimeFormat → 4 hits, unsubSettings → 6 hits, innerHTML → 0) |
| `index.html` | header strip + settings dialog + 9 fields + subjectName placeholder + complete gear SVG | VERIFIED | Lines 28–36 header; 125–end dialog; line 133 placeholder; line 33 full gear path |
| `tests/e2e/settings-modal.spec.js` | 15 specs covering CFG-01, CFG-02..04, CFG-06..07, CFG-09; empty-name asserts 'Nightwatch' | VERIFIED | Full suite runs 40/40 with updated empty-name spec at lines 42+47 |
| `tests/e2e/grouping-toggle.spec.js` | 5 CFG-08 specs (default, commit-on-click, reload persistence, modal mirror, cutover-straddling) | VERIFIED | Plan 02-05 SUMMARY: 5 specs added |
| `tests/e2e/regression-phase1.spec.js` | 2 Phase 1 regression-guard specs (Nyquist D8) | VERIFIED | Plan 02-05 SUMMARY: 2 specs added |
| `tests/unit/db-shape.test.js` | DEFAULT_SETTINGS literal assertions; subjectName='Baby' | VERIFIED | Line 24 updated; suite passes |
| `js/lib/day-bucket.js` | BUCKET_CONFIG.defaultCutoverHour stays 4 (fallback only — Pitfall #2) | VERIFIED | UAT Test 10 verified_in_code: "js/lib/day-bucket.js:48 → defaultCutoverHour: 4 unchanged (fallback only)" |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `header.js` h1 | settings store | settings.subscribe(apply) | WIRED | mountHeader subscribes; settings.update() fires subscribers synchronously |
| `settings-modal.js` Save | settings store | validateSettings → settings.update(normalized) | WIRED | T-2-14 enforced; only normalized values reach store |
| `today-screen.js` render | settings.cutoverHour | eventLog.daysBySubjectiveNight(snap.cutoverHour, 7) | WIRED | D2-17 / Pitfall #2 — injection at call site, BUCKET_CONFIG constant stays 4 |
| `today-screen.js` renderEventRow | settings.timeFormat | formatTime(evt.at, timeFormat) parameter | WIRED | Display half of CFG-09; default '24h' produces same 'HH:MM' as old hhmm() helper |
| `manual-entry.js` openManualEntry | settings.timeFormat | applyTimeFormat(snap) + settings.subscribe(applyTimeFormat) | WIRED | Picker reshape on open + on subsequent format changes; unsub on close |
| `manual-entry.js` Save submit | to24h conversion | when timeFormat==='12h' AND ampmSelect present, convert before validate() | WIRED | Canonical 24h ISO storage preserved (D-05 / D2-20) |
| `settings.js` localStorage | `nightwatch:db` blob | re-read-before-write via storage adapter | WIRED | UAT Test 10: "8× storage.load/save" — race-free with event-log mutations |
| `db-shape.js` migration | v1 → v2 blob | DEFAULT_SETTINGS injection | WIRED | New 'Baby' default propagates to v1 dogfooders on next load (Plan 02-07 SUMMARY threat-scan T-2-05) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `header.js` h1.subjectName | snap.subjectName | settings.get() / settings.subscribe(snap) — settings store reads from `nightwatch:db` localStorage | YES — DEFAULT_SETTINGS.subjectName='Baby' on fresh install; user-entered values persist after Save | FLOWING |
| `today-screen.js` day list | days[] (calendar or sleep-cycle) | eventLog.daysByCalendar(7) / daysBySubjectiveNight(snap.cutoverHour, 7) | YES — eventLog reads from `nightwatch:db` events slice; cutoverHour from settings.get() | FLOWING |
| `today-screen.js` event row time | formatted time string | formatTime(evt.at, snap.timeFormat) | YES — evt.at canonical 24h ISO; format toggled live on settings change | FLOWING |
| `manual-entry.js` picker shape | HH range + AM/PM presence | applyTimeFormat(settings.get()) on open + subscribe | YES — picker reshapes immediately on settings format change | FLOWING |
| `index.html` settings dialog | 9 form fields | populated from settings.get() on openSettings | YES — every open repopulates; commit-on-Save persists | FLOWING |

---

## Behavioral Spot-Checks

Phase 2 ships a browser PWA — no server entry points. Behavioral verification is via Playwright E2E (which the orchestrator just ran). Unit tests cover the pure-logic helpers (validateSettings, to24h, to12h, formatTime, settings store).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suite green | `npm run test:unit` | 251/251 pass (10.7s) | PASS |
| E2E suite green | `npx playwright test` | 40/40 pass (59.9s) | PASS |
| DEFAULT_SETTINGS.subjectName === 'Baby' | grep `js/lib/db-shape.js:35` | `subjectName:  'Baby',` confirmed | PASS |
| Header fallback to 'Nightwatch' for empty | grep `js/ui/header.js:38` | `h1.textContent = snap.subjectName \|\| 'Nightwatch';` confirmed | PASS |
| Subject-name input has placeholder hint | grep `index.html:133` | `placeholder="e.g., Baby, Maya, Liam..."` confirmed | PASS |
| Gear SVG complete (8-tooth gear, not truncated) | grep `index.html:33` | Full Material Icons settings path (Apache 2.0); 32 path segments ending with `3.6 3.6z fill="currentColor"` | PASS |
| Empty-name spec asserts 'Nightwatch' | grep `tests/e2e/settings-modal.spec.js:47` | `toHaveText('Nightwatch')` confirmed | PASS |
| Unit test asserts subjectName='Baby' | grep `tests/unit/db-shape.test.js:24` | `assert.equal(DEFAULT_SETTINGS.subjectName, 'Baby');` confirmed | PASS |

---

## Probe Execution

No formal probe scripts under `scripts/*/tests/probe-*.sh` exist in this repo (the Validation contract uses `node --test` + `npx playwright test` as its sampling mechanism — both ran clean above).

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| (none discovered) | — | — | SKIPPED (no probe scripts in repo) |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CFG-01 | 02-01, 02-02, 02-04, 02-07 | User can set a single subject profile display name in Settings | SATISFIED | Header h1 reads snap.subjectName \|\| 'Nightwatch'; document.title symmetric; XSS-safe textContent; DEFAULT_SETTINGS.subjectName='Baby' fresh-install default; e2e spec lines 28, 42, 51, 63 all green |
| CFG-02 | 02-01, 02-02, 02-04 | User can configure max_delta in Settings | SATISFIED | maxDelta in DEFAULT_SETTINGS + validator + modal; round-trip e2e at line 113 green; stored-but-inert per D2-02 (Phase 3 reads) |
| CFG-03 | 02-01, 02-02, 02-04 | User can configure min_days in Settings | SATISFIED | minDays:7 default + validator + modal; round-trip e2e green |
| CFG-04 | 02-01, 02-02, 02-04 | User can toggle automatic outlier detection on/off in Settings | SATISFIED | autoOutlier:false default + validator + modal checkbox; round-trip e2e green |
| CFG-05 | 02-01 (deferral owner) | User can manually mark any day as "rejected" from History | DEFERRED to Phase 4 | Explicit decision in Plan 02-01 frontmatter (`CFG-05 status: deferred-to-phase-4`) + REQUIREMENTS.md:128 ('CFG-05 \| Phase 4 \| Pending') + ROADMAP §Phase 2 contract acknowledges scope-out |
| CFG-06 | 02-01, 02-02, 02-04 | User can configure rolling-window length in Settings | SATISFIED | windowDays:7 default + validator + modal; round-trip e2e green |
| CFG-07 | 02-01, 02-02, 02-04 | User can choose statistical blend (median/mean/blend) | SATISFIED | statBlend:'median' default + enum validator + modal; round-trip e2e green |
| CFG-08 | 02-01, 02-02, 02-03, 02-05 | User can configure day-cutover hour (default ~04:00) | SATISFIED | cutoverHour:4 default; today-screen passes snap.cutoverHour to daysBySubjectiveNight; grouping-toggle.spec.js CFG-08 cutover-straddling spec green; UAT Tests 4-5 = pass (MVP-critical user-story payoff) |
| CFG-09 | 02-01, 02-02, 02-03, 02-06 | User can toggle 24h/12h time format (default 24h), persisted | SATISFIED | timeFormat:'24h' default; formatTime/to24h/to12h in time.js; manual-entry picker reshape; 5 e2e specs green (12h shape, 24h revert, persistence, 12h render, 24h render) |

No orphaned requirements. CFG-05 deferral is the documented exception, not a gap.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/TBD/XXX/HACK markers in the 5 files modified by Plan 02-07 |

`index.html:133` contains the literal HTML attribute `placeholder="..."` which is a UX feature, not a code-debt marker. The anti-pattern regex correctly does not catch this in context (the previous "placeholder" warning band is for inline narrative comments like "placeholder text here" or "coming soon", not HTML form attributes).

---

## Human Verification Required

None. The UAT (02-UAT.md) already captured human walkthrough for Tests 1–10. Test 1 was the only flagged issue, and Plan 02-07 closed both of its findings in code. Plan 02-07 SUMMARY recommends an optional human re-walk (clear localStorage, reload, confirm 'Baby' header + complete gear icon), but this is not blocking — both findings are statically verifiable from the codebase (line-anchor checks above) and functionally pinned by tests/e2e/settings-modal.spec.js line 47 (empty → 'Nightwatch' fallback) and DEFAULT_SETTINGS.subjectName === 'Baby' (unit assertion line 24).

The three user-captured backlog ideas (event-type default times, friendly hour picker, dark mode) are explicitly out of scope for Phase 2 and are tracked in project memory for next-milestone planning.

---

## Gaps Summary

**No remaining gaps.** Phase 2 user-story is satisfied end-to-end; both UAT Test 1 findings are closed; all in-scope CFG-* requirements (CFG-01..04, CFG-06..09) are SATISFIED; CFG-05 is correctly DEFERRED to Phase 4 per Plan 02-01's explicit deferral decision (D2-01). Unit + E2E suites green at the verified baseline (251/251 + 40/40).

### Re-Verification Result

The prior validation cycle (02-UAT.md, status: complete) recorded:
- **9 pass / 1 issue / 0 pending** — issue was Test 1 with two findings (empty-h1, gear-icon).

Plan 02-07 was authored as a `gap_closure` plan to close those two findings. Both fixes land at the expected line locations across 5 files, and the updated tests (1 unit literal + 1 e2e spec title + assertion) green-on-first-run on the rerun.

**Status promotes from `gaps_found` to `passed`.** Phase 2 is ready for milestone audit and the standard closure sequence (`/gsd-secure-phase 2`, `/gsd-ui-review 2`).

---

*Verified: 2026-05-28T10:15:00Z*
*Verifier: Claude (gsd-verifier, Opus 4.7 1M context)*
