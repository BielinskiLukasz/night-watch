---
status: complete
phase: 01-log-persist
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
  - 01-04-SUMMARY.md
  - 01-05-SUMMARY.md
started: 2026-05-26T16:00:00Z
updated: 2026-05-27T08:00:00Z
mode: mvp
goal: "User can log sleep events and see them survive reload, enabling the smallest possible usable app for dogfooding."
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

---

## Tests

### Section A — User Flow (run first; if any fail, stop and fix before technical checks)

### 1. Cold Start Smoke Test
expected: Stop any running server, clear localStorage for `http://localhost:8080`, run `npm run serve` and open the page. App loads with no console errors. Visible: 4 quick-log buttons, "+ Add event" button, empty event list region.
result: pass

### 2. Quick-log "Woke up"
expected: Click the "Woke up" button. A new row appears under today's day heading with type "Woke up" and the current time rounded to the nearest 5 minutes (e.g., 16:25 not 16:23).
result: pass

### 3. Quick-log other three buttons (Going to sleep / Nap start / Nap end)
expected: Click each of the three remaining buttons in turn. Each adds a distinct row with the correct type label and a 5-minute-rounded timestamp. All four events appear in the day-grouped list.
result: pass

### 4. Manual entry via "+ Add event" modal
expected: Click "+ Add event". A modal opens with a date input, HH and MM number inputs, and a type dropdown. Pick a past date (e.g., yesterday), enter a valid time, choose "Woke up", click Save. Modal closes; the new event appears under yesterday's day heading.
result: issue
reported: "yes but event type is not woke up but wake (like logs type in home screen)"
severity: minor
note: "Core flow passes (event created under yesterday's day). Cross-cutting label-consistency defect — also affects quick-log rows from tests 2–3."

### 5. Edit a row in-place (no duplicate)
expected: Click [edit] on any existing row. The modal opens pre-filled with that row's values. Change the time, click Save. The SAME row updates in place — list length is unchanged (no new row added beneath the original).
result: issue
reported: "yes but I can set time & date in future"
severity: major
note: "Core mutate-in-place flow passes (D-03 verified). Missing-validation defect — phase success criterion says 'today or any past day'; modal accepts future dates/times in both Add and Edit paths."

### 6. Delete a row
expected: Click [×] on any row. A browser confirm dialog appears. Click OK. The row disappears from the list. Click [×] then Cancel on another row — that row stays.
result: pass

### 7. Reload persistence (HEADLINE TEST — the phase goal)
expected: After steps 2–6, press F5 to reload the page. ALL events you logged/edited (and none of the ones you deleted) are still in the list under their correct day headings.
result: pass
note: "Headline phase-goal test (DATA-04 + reload survives). Confirmed by user."

---

### Section B — Technical Checks (deferred; only run after Section A passes)

### 8. Double-click debounce (T-05)
expected: Rapidly double-click "Woke up" (two clicks within ~300ms). Only ONE event is added, not two.
result: pass

### 9. Silent 5-min rounding on manual entry (LOG-07)
expected: Open "+ Add event", enter minute=23 (a non-5 value). Save succeeds without an error dialog; the resulting row shows minute=25 (silent rounding, no warning).
result: issue
reported: "yes but i can put hours and minutes outside of range (eg 25 and 600) and after save record didn't appears and any errors/message displayed"
severity: major
note: "Rounding sub-claim PASSED (23 → 25 worked). Cross-cutting silent-failure defect: out-of-range hour/minute is rejected by the validator but with no user feedback (modal closes, no row appears, no error)."

### 10. Day grouping (LOG-08)
expected: With events spanning today + yesterday (after steps 2 and 4), the list shows two distinct day-heading groups. Today's events do not mix into yesterday's group.
result: pass

### 11. Extra-nap warning row (LOG-09)
expected: For one day, add a 3rd "Nap start" event via "+ Add event" (so the day has more than the allowed 2 naps). The 3rd nap renders as a faint italic row (CSS class `extraNap`), visually distinct from the other rows.
result: issue
reported: "not exacly, when I add 3 and next nap this add 2 rows in log, one with nap start looks like previous one, and anodher one on the end of day with Extra nap: 01:25 with styling you described"
severity: major
note: "Renderer duplicates extra naps — once as a normal [edit]/[×] row via day.allEvents, once as a faint 'Extra nap: HH:MM' row via day.extraNaps. Contract in Plan 01-03 SUMMARY says one faint row, not two."

### 12. Modal Cancel / ESC closes without saving
expected: Click "+ Add event", fill in a time, then either click Cancel or press ESC. Modal closes. No new event appears in the list.
result: pass

---

### Section C — Coverage Check (REQ-ID traceability)

### 13. REQ-ID coverage audit
expected: Confirm each Phase 1 requirement has at least one passing test above: LOG-01 (record event), LOG-02/03/04 (quick-log buttons), LOG-05 (manual entry), LOG-06 (delete), LOG-07 (5-min rounding), LOG-08 (day group), LOG-09 (extra-nap), DATA-04 (persist across reload). If any REQ-ID lacks a passing user-flow test, mark this an issue and name it.
result: issue
reported: "I think LOG-09 is blocked by double-render nap. It will cause user confused what to do (cannot remove italic item). We should fix that or at least hide that and fix later."
severity: blocker
note: "LOG-09 surfacing is present in code but its user-experience is net-negative: the faint summary row has no [×] affordance, so the user sees a row they cannot remove, then sees the same nap again as a removable [edit]/[×] row. Two viable remediations (planner picks one in --gaps): (a) fix the double-render bug properly, or (b) hide the faint row entirely for now and defer richer LOG-09 surfacing to a later phase. LOG-09 coverage status updated to BLOCKED-PENDING-FIX. All other REQ-IDs (LOG-01..08, DATA-04) remain covered."

---

## Summary

total: 13
passed: 8
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Event-list row labels match the button that created them (e.g., 'Woke up' button → 'Woke up' row)."
  status: failed
  reason: "User reported: yes but event type is not woke up but wake (like logs type in home screen)"
  severity: minor
  test: 4
  scope: "Cross-cutting — also affects rows from tests 2 and 3 (today's quick-log entries)."
  artifacts:
    - path: "js/ui/today-screen.js"
      lines: "32-44"
      issue: "BUTTONS labels ('Woke up', 'Going to sleep') do not match EVENT_LABEL display map ('Wake', 'Bedtime'). The two sources of truth disagree."
  missing: []
  debug_session: ""

- truth: "Manual-entry modal accepts only past or current dates+times; future inputs are rejected (per Phase 1 success criterion 3: 'for today or any past day')."
  status: failed
  reason: "User reported: yes but I can set time & date in future"
  severity: major
  test: 5
  scope: "Affects both Add (test 4) and Edit (test 5) paths — same onClose validator."
  artifacts:
    - path: "js/ui/manual-entry.js"
      lines: "90-119"
      issue: "onClose JS-level validation guards required fields + hour/minute ranges but does not compare the constructed atString to now() — no future-date rejection."
    - path: "index.html"
      issue: "Date input has no max attribute pinned to today; even with formnovalidate, no max would let JS layer enforce it."
  missing:
    - "JS-level guard in manual-entry.js onClose: reject when constructed atString > clock.now()."
    - "Optional belt-and-suspenders: set date input max=today on modal open."
    - "Store-layer guard in event-log.addEventAt / editEvent that throws on future at strings (defense in depth)."
  debug_session: ""

- truth: "Manual-entry modal gives user-visible feedback when validation rejects input (out-of-range hour/minute, empty fields, etc.) — modal stays open with an error message, or fields are highlighted, never a silent no-op."
  status: failed
  reason: "User reported: i can put hours and minutes outside of range (eg 25 and 600) and after save record didn't appears and any errors/message displayed"
  severity: major
  test: 9
  scope: "All silent-return branches in onClose validator (required-field, hour range, minute range, type whitelist). Affects both Add and Edit paths."
  artifacts:
    - path: "js/ui/manual-entry.js"
      lines: "99-108"
      issue: "onClose validator uses `return` (silent no-op) on every rejection. Modal still closes because submit dispatched; user sees no feedback that input was invalid."
  missing:
    - "Per-rejection-branch error path: instead of silent return, surface a message in the modal (e.g., inline error <p>) AND keep the modal open (or prevent close)."
    - "Alternative: clamp values to valid range before save with a 'value adjusted' hint (UX call — needs decision)."
    - "Either way: visible-failure invariant captured as an integration or e2e test so a future silent-return regression is caught."
  debug_session: ""

- truth: "When a day has more than 2 naps, the extra nap(s) render exactly ONCE — as a faint `<li class='extraNap'>` row (per Plan 01-03 SUMMARY's stated contract). They do not also appear as a normal [edit]/[×] row."
  status: failed
  reason: "User reported (test 11): when I add 3 and next nap this add 2 rows in log, one with nap start looks like previous one, and another one on the end of day with Extra nap: 01:25. User reported (test 13): LOG-09 is blocked by double-render nap — user confused, cannot remove italic item."
  severity: blocker
  severity_history: "Initially major (test 11). Bumped to blocker after test 13: faint row has no [×] affordance, so the user sees a row they cannot remove + a duplicate of the same nap they can — net-negative UX vs. having no surfacing at all. Blocks LOG-09 acceptance."
  test: 11
  related_tests: [13]
  scope: "Affects every day with >2 naps. Confuses nap count, would inflate any nap-derived stat that reads from the rendered list, and blocks LOG-09 user-acceptance."
  artifacts:
    - path: "js/ui/today-screen.js"
      lines: "180-196"
      issue: "renderDay() iterates day.allEvents (which INCLUDES extra naps) and renders each as a normal row via renderEventRow, then ALSO iterates day.extraNaps and appends a faint summary row for each. The extra nap is rendered twice."
    - path: "js/ui/today-screen.js"
      lines: "239-246"
      issue: "renderExtraNapRow renders a faint <li> with only label+time — no [edit]/[×] affordances. Even if it were the only row, the user would still have no way to act on it."
    - path: "js/lib/day-bucket.js"
      lines: "100-147"
      issue: "buildDayRecord pushes overflow napStart/napEnd into extraNaps but does NOT remove them from allEvents — so both arrays contain the same event ids."
  missing:
    - "OPTION A (recommended if Phase 1 stays open): fix the double-render bug. Decide single source of truth for extra-nap display: (a1) exclude extra naps from allEvents and let extraNaps be the only render path AND give the faint row [edit]/[×] affordances (so the user can act on it); or (a2) include extra naps in allEvents only and let the row renderer style them faint when evt.extra === true."
    - "OPTION B (user-suggested 'hide temporarily'): stop rendering the faint summary row entirely (delete or comment out the extraNaps loop in renderDay). Extra naps still appear as normal [edit]/[×] rows via allEvents — user can manage them like any other event. Defer richer LOG-09 surfacing to a later phase. This is the smallest possible change to unblock LOG-09 acceptance."
    - "Either option: regression test asserts the rendered nap-start row count for a 3-nap day matches the event count (not double-counted)."
  debug_session: ""
