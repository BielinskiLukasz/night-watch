---
phase: quick
plan: 260803-otj
type: quick
date: 2026-08-03
description: Move '+ Add event' button into quickLog row and rename to 'Add events'
files_modified:
  - index.html
  - js/ui/today-screen.js
  - style.css
autonomous: true
---

<objective>
Move the standalone '+ Add event' button on the today screen into the quickLog button row so it lines up with the Woke up / Going to sleep / Nap start / Nap end buttons. Rename it to 'Add events' to reflect that it opens the manual entry modal with the "save more" (add multiple events) workflow.

Current layout: quickLog row → (gap) → addEventBtn (standalone below) → nextEventCard …
Target layout:  quickLog row (with addEventBtn as last item) → nextEventCard …
</objective>

<execution_context>
@C:/my-code/vibe-coding/night-watch/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/night-watch/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Move addEventBtn into quickLog and rename</name>
  <files>index.html, js/ui/today-screen.js, style.css</files>
  <action>
    ### index.html
    Move the standalone `<button id="addEventBtn">` (currently after the dayList section, line ~89)
    into the `<div class="quickLog">` block as its last child. Rename its text from `+ Add event`
    to `Add events`.

    Before:
    ```html
    <div class="quickLog">
      <button type="button" data-log="wake">Woke up</button>
      <button type="button" data-log="bedtime">Going to sleep</button>
      <button type="button" data-log="napStart">Nap start</button>
      <button type="button" data-log="napEnd">Nap end</button>
    </div>
    ...
    <button type="button" id="addEventBtn" class="addEventBtn">+ Add event</button>
    ```

    After:
    ```html
    <div class="quickLog">
      <button type="button" data-log="wake">Woke up</button>
      <button type="button" data-log="bedtime">Going to sleep</button>
      <button type="button" data-log="napStart">Nap start</button>
      <button type="button" data-log="napEnd">Nap end</button>
      <button type="button" id="addEventBtn" class="addEventBtn">Add events</button>
    </div>
    ```

    ### js/ui/today-screen.js
    In the `mountTodayScreen` function:
    1. Change `textContent: '+ Add event'` to `textContent: 'Add events'` (line ~689)
    2. In the `root.replaceChildren(...)` call (line ~695), remove `addEventBtn` from the args
       and instead append it to `quickLog` before that call:
       `quickLog.appendChild(addEventBtn);`
       `root.replaceChildren(quickLog, stageSelectorContainer, nextEventCard, coldStartMsg, forecastCards, toggle, dayList);`
       (The addEventBtn is now a child of quickLog, not a sibling.)

    ### style.css
    Update `.addEventBtn` to work as a flex child inside `.quickLog` instead of a standalone block:
    - Remove `display: block` (flex child doesn't need this)
    - Remove `margin-top: 1rem; margin-bottom: 1rem;` (flex gap handles spacing)

    Keep padding, border, border-radius, background, color, cursor, and the hover rule intact.
  </action>
  <verify>
    Manual: Open the app and confirm addEventBtn appears in the quickLog row as the last button,
    labeled "Add events". Clicking it should still open the manual entry modal with the Save more
    button visible.
  </verify>
  <done>
    - addEventBtn is inside the .quickLog div in both index.html and today-screen.js
    - Button label is "Add events" in both files
    - CSS no longer has standalone display/margin on .addEventBtn
  </done>
</task>

</tasks>

<threat_model>
No security threats — this is a pure layout/label change with no data handling.
</threat_model>

<verification>
- quickLog row contains 5 buttons (4 quick-log + addEventBtn)
- addEventBtn label is "Add events"
- Clicking "Add events" opens the manual entry modal with "Save more" button visible
- Clicking quick-log buttons (Woke up, etc.) still works normally
</verification>

<success_criteria>
- addEventBtn is last child inside .quickLog in index.html
- today-screen.js: textContent is "Add events", addEventBtn appended to quickLog before replaceChildren
- style.css: .addEventBtn has no display:block or standalone margins
</success_criteria>

<output>
Create `.planning/quick/260803-otj-move-add-event-button-to-line-up-with-ot/260803-otj-SUMMARY.md` when done.
</output>
