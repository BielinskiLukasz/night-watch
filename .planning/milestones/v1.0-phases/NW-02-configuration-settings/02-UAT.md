---
status: complete
phase: 02-configuration-settings
mode: mvp
user_story: "As a parent tracking a child's sleep, I want to set the day-cutover hour and have it stick across reloads, so that day-grouping matches our household's actual sleep cycle, not a hardcoded default."
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
  - 02-05-SUMMARY.md
  - 02-06-SUMMARY.md
started: 2026-05-28T08:31:32Z
updated: 2026-05-28T09:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Clear localStorage `nightwatch:db`, then `npm run serve` and open the app. Page loads with no console errors. Header shows "Nightwatch" + gear icon on the right. Today screen renders, Calendar/Sleep cycle toggle present with Calendar active. Quick-log buttons visible.
result: issue
reported: "I dont see the header title — h1.subjectName is empty (rendered HTML shows <h1 class=\"subjectName\"></h1>); gear icon looks strange, probably I see only part of gear. Rest ok."
severity: major

### 2. (User Flow) Open Settings via gear icon
expected: |
  Click the gear icon in the header. A modal dialog opens centered over the page with 3 fieldsets visible: Profile, Time & Day, Forecast tuning. The Time & Day fieldset contains a "Day cutover hour" input pre-filled with 4 (the default).
result: pass
note: "User suggested: subject name default could be 'Baby' or similar instead of empty string — see Test 1 gap proposed resolution."
result: pass

### 3. (User Flow) Change cutoverHour and Save
expected: |
  In the open Settings modal, change the "Day cutover hour" input from 4 to 6. Optionally fill the Subject name field too (e.g., "Test Child"). Click Save. The modal closes, no error appears. The header h1 updates to show the new subject name if you set one (or stays "Nightwatch" if you didn't).
result: pass
note: "User captured an idea for future releases: manual-entry pop-up should prefill hour/minute based on event type (e.g., wake → 07:00), configurable in Settings. Saved to memory at project_idea_event_type_default_times.md and to be surfaced for next-milestone planning."

### 4. (User Flow) Reload preserves cutoverHour (the user-story payoff)
expected: |
  Reload the page (Ctrl+R or F5). After reload: header still shows the subject name you set (or "Nightwatch"). Re-open Settings via the gear — the Day cutover hour input still reads 6, NOT 4. The setting stuck across reload.
result: pass
note: "User captured another idea for backlog: friendly hour/minute picker (clock-face, wheel, or tap-grid) instead of HH/MM number inputs. Saved to memory at project_idea_friendly_hour_picker.md."

### 5. (User Flow) Sleep-cycle grouping uses the new cutoverHour
expected: |
  Close the modal (Cancel or ESC). On the Today screen, click the "Sleep cycle" button in the grouping toggle (right of the toggle). aria-pressed switches: Sleep cycle = true, Calendar = false. The day list re-renders. Day boundaries are now drawn at 06:00 (your custom cutoverHour), not at midnight and not at the hardcoded 04:00. If you have events that straddle 04:00–06:00 they should fall into the same subjective night as events from late evening.
result: pass
note: "MVP user-flow walkthrough (Tests 2-5) all pass. User-story payoff confirmed: cutoverHour set in Settings sticks across reload AND drives sleep-cycle day grouping. User also added a third backlog idea: dark mode + hour-based auto-switch + configurable default. Saved to memory at project_idea_dark_mode.md."

### 6. (Technical — deferred until 1-5 pass) Subject name flows to h1 + document.title (CFG-01)
expected: |
  Open Settings, set Subject name to "Maya", click Save. The h1 in the header updates to "Maya" instantly (no reload needed). The browser tab title shows "Nightwatch — Maya". Clear the subject name (blank string) and Save again: h1 returns to "Nightwatch" and tab title returns to plain "Nightwatch".
result: pass

### 7. (Technical) 12h timeFormat propagates to manual-entry picker + Today list (CFG-09)
expected: |
  Open Settings → Time & Day → change "Time format" from 24h to 12h, Save. Open the manual-entry modal (click one of the quick-log buttons that opens it, or the manual-entry trigger). The hour input now accepts 1–12 and an AM/PM dropdown is present next to it. Submit a sleep event at 2:30 PM. Back on Today, the row renders as "2:30 PM" (not "14:30"). Switch the format back to 24h — the Today row re-renders as "14:30".
result: pass

### 8. (Technical) Invalid cutoverHour blocks Save with inline error
expected: |
  Open Settings, change Day cutover hour to 99, click Save. The dialog does NOT close. An inline error message appears in the modal (red text near the cutoverHour field or in the error block) saying something like "cutoverHour must be 0–23" or similar. Focus returns to the cutoverHour input. Fix it back to a valid value (e.g., 4) and Save — the dialog closes normally.
result: pass

### 9. (Technical) XSS guard on subject name
expected: |
  Open Settings, set Subject name to literally `<b>test</b>` (eight chars, raw angle brackets). Save. The header h1 renders the literal text `<b>test</b>` — you see the angle brackets and the word "test". You do NOT see a bolded "test" rendered as HTML. The tab title shows `Nightwatch — <b>test</b>`.
result: pass

### 10. (Coverage check) End-to-end wiring verified in code
expected: |
  Goal-backward check against the user story. The codebase should show:
  - `js/ui/settings-modal.js` exposes a cutoverHour input bound to `settings.update()`
  - `js/store/settings.js` persists via the storage adapter (re-read-before-write to avoid clobbering events slice)
  - `js/ui/today-screen.js` calls `eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)` — i.e. the user's chosen cutoverHour is what drives sleep-cycle grouping (NOT the hardcoded 4 in BUCKET_CONFIG)
  - `js/lib/day-bucket.js` BUCKET_CONFIG.defaultCutoverHour stays at 4 — that's the fallback only, not what the live UI uses
result: pass
verified_in_code:
  - "js/ui/today-screen.js:242 → eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)"
  - "js/store/settings.js → 8× storage.load/save (re-read-before-write preserved)"
  - "js/lib/day-bucket.js:48 → defaultCutoverHour: 4 unchanged (fallback only)"
  - "js/ui/settings-modal.js → cutoverHour input commits via settings.update()"

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0
blocked: 0

## User-Captured Backlog Ideas

These were surfaced during UAT and saved to project memory. They are NOT scope for Phase 2 closure but should be promoted to the project's formal backlog before the next milestone planning round:

1. **Smart per-event-type default hour/minute in manual-entry pop-up** — configurable in Settings. (Memory: `project_idea_event_type_default_times.md`)
2. **Friendly hour/minute picker** — replace HH/MM number inputs with a clock-face / wheel / tap-grid. (Memory: `project_idea_friendly_hour_picker.md`)
3. **Dark mode** — manual toggle + hour-based auto-switch, with default-mode choice in Settings. (Memory: `project_idea_dark_mode.md`)

## Gaps

- truth: "On fresh install (no subject name set), the header should display a visible title (e.g., 'Nightwatch') so the user knows where they are; the gear icon should render fully within its button bounds."
  status: failed
  reason: "User reported: I dont see the header title — h1.subjectName is empty (rendered HTML shows <h1 class=\"subjectName\"></h1>); gear icon looks strange, probably I see only part of gear."
  severity: major
  test: 1
  findings:
    - id: empty-h1-on-fresh-install
      observation: "h1.subjectName has no fallback text when settings.subjectName is unset/empty. mountHeader writes h1.textContent = snap.subjectName (per Plan 02-04 D2-11). DEFAULT_SETTINGS.subjectName is the empty string, so the h1 collapses visually."
      expected_behavior: "Either render 'Nightwatch' (the document.title fallback) directly in the h1 when subjectName is empty, or render a placeholder like 'No subject set' so the header strip is not visually empty."
      severity: major
      user_proposed_resolution: "User suggested setting DEFAULT_SETTINGS.subjectName to a sensible default like 'Baby'."
      chosen_resolution: "Option 3 + header fallback: (a) DEFAULT_SETTINGS.subjectName = 'Baby' so fresh installs show a meaningful name; (b) Settings modal subjectName input gets placeholder='e.g., Baby, Maya, Liam...' as UX nudge; (c) header.js h1.textContent = snap.subjectName || 'Nightwatch' fallback covers the case where the user explicitly clears the field (validator still allows empty). Captured in 02-07-PLAN.md."
    - id: gear-icon-clipped
      observation: "User reports the SVG gear appears only partially visible. The SVG path uses coordinates up to ~20.5 within a 24×24 viewBox; with width=20/height=20 on the SVG element this should not clip, so the likely culprit is button padding/border, overflow:hidden, or a min-width/min-height constraint in .settingsTrigger CSS clipping a 20×20 child."
      expected_behavior: "Gear icon renders fully visible within the 44px tap target, no clipping."
      severity: cosmetic
  artifacts:
    - path: "js/lib/db-shape.js"
      line: 35
      issue: "DEFAULT_SETTINGS.subjectName = ''. Comment 'header shows nothing until set' is honest but the UX result is an empty h1 on fresh install."
    - path: "js/ui/header.js"
      line: 38
      issue: "h1.textContent = snap.subjectName — no fallback. document.title on line 40 already has a fallback to 'Nightwatch'."
    - path: "index.html"
      line: 32
      issue: "Inline SVG <path d=\"…\"> is a truncated copy-paste — encodes only inner circle + partial arc, not the full 8-tooth gear shape. Likely truncated during the Plan 02-04 commit."
  missing:
    - "Default subjectName value that gives a fresh install a meaningful header"
    - "Render-layer fallback in header.js for the explicit-clear-to-empty case"
    - "Placeholder hint on subjectName input nudging the user toward overriding the default"
    - "Complete Material Icons settings gear path data"
  fix_plan: ".planning/phases/NW-02-configuration-settings/02-07-PLAN.md"
