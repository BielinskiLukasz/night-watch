---
phase: 2
slug: configuration-settings
status: draft
design_system: vanilla-js-no-shadcn
created: 2026-05-28
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for configuration-settings phase (Settings modal + Header strip + Grouping toggle). Generated from 02-CONTEXT.md (27 locked decisions), 02-RESEARCH.md, and Phase 1 established patterns.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (vanilla HTML/CSS/JS) |
| Preset | not applicable |
| Component library | native (HTML5 form, dialog, button) |
| Icon library | inline SVG only (no external assets) |
| Font | system default (inherited from Phase 1 mindful-breathing reference) |
| Build | none — no transpiler, no bundler |

**Rationale:** Hard constraint per CLAUDE.md: vanilla HTML/CSS/JS only, no npm runtime dependencies. Phase 1 established minimal, calm aesthetic (dark/minimal/ambient tone, same register as `../mindful-breathing` but distinct identity). Phase 8 will apply final theming; Phase 2 focuses on structure and interaction contract.

---

## Spacing Scale

Declared values (all multiples of 4, inherited from Phase 1):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline icon gaps, minimal padding |
| sm | 8px | Compact element spacing, tight groups |
| md | 16px | Default element spacing, standard padding |
| lg | 24px | Section padding, fieldset spacing |
| xl | 32px | Layout gaps, major control spacing |
| 2xl | 48px | Major section breaks, modal margins |
| 3xl | 64px | Page-level spacing |

Exceptions: **Touch targets minimum 44px height** (per Phase 1 LOG-09 decision for accessibility; buttons throughout Phase 2 follow the same rule).

---

## Typography

Inherited from Phase 1 (no change in Phase 2 — no new text roles):

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 (regular) | 1.5 |
| Label | 14px | 400 (regular) | 1.5 |
| Heading (h1, h2) | 20px | 600 (semibold) | 1.2 |
| Small (error/hint) | 12px | 400 (regular) | 1.4 |

**Phase 2 additions:**
- Settings modal `<h2>` uses heading size (20px semibold)
- Fieldset `<legend>` uses label size (14px semibold, to be decided by planner — recommend 14px 600)
- Form labels use label size (14px 400)
- Error messages use small size (12px 400, matching Plan 01-07 manual-entry pattern)

---

## Color

Inherited from Phase 1 (no change in Phase 2 — no new color roles):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | [Phase 8 theming] | Background, body text on light or vice versa |
| Secondary (30%) | [Phase 8 theming] | Cards (modal background), sidebar regions |
| Accent (10%) | [Phase 8 theming] | Specific interactive elements only (see reserved list below) |
| Destructive | [Phase 8 theming] | Delete buttons, reject actions (if any Phase 2) |
| Border/divider | [Phase 8 theming] | Fieldset borders, modal dividers |
| Error | [Phase 8 theming] | Validation error text, error state outlines |

**Accent reserved for:**
- Focused form inputs (`<input>`, `<select>`, `<textarea>` on `:focus`)
- Active toggle button in the grouping-mode quick-toggle (aria-pressed="true")
- Settings trigger gear icon on hover/active

**Phase 2 theme note:** Exact hex/rgb values TBD in Phase 8. Phase 2 uses the same calm, minimal, dark/ambient register as Phase 1 (reference: `../mindful-breathing`). CSS classes will use semantic color tokens (e.g., `--color-primary-bg`, `--color-accent-fg`) populated at Phase 8.

---

## Component Inventory

### Header Strip (NEW)

**Location:** Top of page, above quick-log row (`<header class="appHeader">`)

**Structure:**
```html
<header class="appHeader">
  <h1 class="subjectName"></h1>
  <button type="button" class="settingsTrigger" aria-label="Settings">
    <!-- inline SVG gear icon -->
  </button>
</header>
```

**Specifications:**

| Aspect | Contract |
|--------|----------|
| **Layout** | Flexbox row, `justify-content: space-between`, items vertically centered |
| **Height** | 56px (recommended; accessible height with 44px button inside) |
| **Left side** | `<h1 class="subjectName">` displays the current subject name from settings; empty string renders as empty (header structure remains for layout stability) |
| **Right side** | `<button class="settingsTrigger">` — gear icon (inline SVG, viewBox="0 0 24 24", 20px × 20px), no external image asset |
| **Padding** | 16px (md token) horizontal, 8px (sm token) vertical |
| **Border** | Bottom border 1px in secondary color (optional, per planner discretion — Phase 1 reference app uses subtle dividers) |
| **Gear icon** | Minimal outline style (recommend: 24px viewBox with 2px stroke width, no fill or light fill). Inline in HTML to avoid HTTP request. |
| **Button styling** | Transparent background, icon color inherits foreground; hover state: slight opacity change or accent color (Phase 8 theming) |
| **Accessibility** | `aria-label="Settings"` on button; h1 `class="subjectName"` provides landmark for screen readers |

**Interaction:**
- Gear icon click opens Settings modal (`openSettings({settings})` call)
- No keyboard shortcut in Phase 2 (future consideration if dogfooding shows demand)

**Rendering:**
- Header is static HTML in `index.html` (no JS-rendered children)
- JS mounts via `mountHeader({root, settings})`, which populates h1 content and wires gear click
- `h1.textContent = settings.get().subjectName` (never `innerHTML` — T-07 XSS safety)

---

### Settings Modal (NEW)

**Location:** `<dialog id="settings">` in `index.html`, sibling of `<dialog id="manualEntry">`

**Opening trigger:** Gear icon in header or Settings field in modal itself (for toggle controls)

**Structure:**

```html
<dialog id="settings" aria-labelledby="settingsTitle">
  <form method="dialog">
    <h2 id="settingsTitle">Settings</h2>
    
    <fieldset>
      <legend>Profile</legend>
      <label>Subject name
        <input type="text" name="subjectName" maxlength="40">
      </label>
    </fieldset>
    
    <fieldset>
      <legend>Time &amp; Day</legend>
      <label>Day cutover hour
        <input type="number" name="cutoverHour" min="0" max="23">
      </label>
      <label>View grouping
        <select name="groupingMode">
          <option value="calendar">Calendar</option>
          <option value="sleepCycle">Sleep cycle</option>
        </select>
      </label>
      <label>Time format
        <select name="timeFormat">
          <option value="24h">24-hour</option>
          <option value="12h">12-hour</option>
        </select>
      </label>
    </fieldset>
    
    <fieldset>
      <legend>Forecast tuning</legend>
      <label><input type="checkbox" name="autoOutlier"> Automatic outlier detection</label>
      <label>Max delta (minutes)
        <input type="number" name="maxDelta" min="5" max="120">
      </label>
      <label>Min days
        <input type="number" name="minDays" min="1" max="90">
      </label>
      <label>Rolling window (days)
        <input type="number" name="windowDays" min="3" max="90">
      </label>
      <label>Statistical blend
        <select name="statBlend">
          <option value="median">Median</option>
          <option value="mean">Mean</option>
          <option value="blend">Blend</option>
        </select>
      </label>
    </fieldset>
    
    <output id="settingsErrors" aria-live="polite"></output>
    
    <menu>
      <button type="button" id="settingsCancel">Cancel</button>
      <button type="submit" value="save">Save</button>
    </menu>
  </form>
</dialog>
```

**Specifications:**

| Aspect | Contract |
|--------|----------|
| **Modal behavior** | Native `<dialog>` with `showModal()` — focus trap, ESC to close, body inert, `aria-modal="true"` free |
| **Modal width** | 500px desktop, 90vw on mobile (planner picks exact breakpoint) |
| **Modal margin** | 24px (lg token) padding inside dialog |
| **Heading** | h2#settingsTitle 20px semibold, margin-bottom 16px (md) |
| **Fieldset styling** | Border 1px in secondary color, padding 16px (md), margin-bottom 16px (md), `<legend>` 14px semibold, padding-bottom 8px (sm) |
| **Label styling** | Display block or inline-block (planner choice), margin-bottom 8px (sm), 14px regular, dark text |
| **Input sizing** | text/number/select/checkbox — 44px minimum height, 16px padding on text inputs (md token) |
| **Select dropdown** | Native `<select>` (no custom dropdown in Phase 2) |
| **Checkbox** | Native `<input type="checkbox">`, label wraps the control |
| **Error output** | `<output id="settingsErrors" aria-live="polite">` rendered as a list of error `<p>` elements with `data-field="{fieldName}"`, 12px small size, error color (Phase 8) |
| **Buttons** | 44px height minimum, Cancel on left, Save on right (menu flexbox row, gap 8px), Cancel is secondary styling (transparent or muted), Save is primary styling (accent color or bold) |
| **Button spacing** | 16px (md) gap between buttons, 24px (lg) top margin before menu |

**Validation & error display:**

- On Save click, JS validates all fields via `validateSettings(raw, {mode: 'save'})`
- If errors, render each error into `<output>` as a `<p data-field="{fieldName}">` with error message (12px)
- Do NOT re-close modal; keep open, focus first errored field
- When modal re-opens after a failed Save, the errors remain visible until modal closes
- On successful Save, modal closes automatically (returnValue='save' triggers close handler)
- On Cancel or ESC, modal closes, any pending edits discarded

**Field specifications (validation contract):**

| Field | Type | Bounds | Default | Notes |
|-------|------|--------|---------|-------|
| subjectName | text | max 40 chars | "" (empty) | Trimmed on save; XSS-safe via textContent only |
| cutoverHour | integer | 0–23 | 4 | Hours in 24h format; no decimal |
| groupingMode | enum | {calendar, sleepCycle} | calendar | Two-option select |
| timeFormat | enum | {24h, 12h} | 24h | Two-option select |
| autoOutlier | boolean | true/false | false | Checkbox; unchecked = false, checked = true |
| maxDelta | integer | 5–120 (minutes) | 30 | Forecast confidence threshold |
| minDays | integer | 1–90 | 7 | Minimum history to show forecasts |
| windowDays | integer | 3–90 | 7 | Rolling window size for predictions |
| statBlend | enum | {median, mean, blend} | median | Three-option select |

---

### Grouping-Mode Toggle (NEW)

**Location:** Above day list in Today screen (between quick-log row and day list), above the day-grouped events

**Structure:**

```html
<div class="groupingToggle" role="group" aria-label="Day grouping">
  <button type="button" data-grouping="calendar" aria-pressed="true">
    Calendar
  </button>
  <button type="button" data-grouping="sleepCycle" aria-pressed="false">
    Sleep cycle
  </button>
</div>
```

**Specifications:**

| Aspect | Contract |
|--------|----------|
| **Layout** | Flexbox row, gap 8px (sm), center-aligned |
| **Button height** | 40px (44px minimum touch target is accommodated) |
| **Button width** | Equal width or auto (planner choice); recommend auto with 16px padding |
| **Button styling** | Inactive: secondary/muted background with dark text; Active (aria-pressed="true"): accent background with white text |
| **Aria-pressed** | Reflects the current groupingMode — true if active, false otherwise; updated when mode changes or Save fires in modal |
| **Behavior** | Click commits immediately (no Save needed) — the **only** field that updates on click rather than Save (D2-16) |
| **Label** | "Day grouping" in role="group" aria-label for screen readers; button text "Calendar" and "Sleep cycle" |

**Interaction:**
- User clicks "Sleep cycle" → `settings.update({groupingMode: 'sleepCycle'})` fires
- Settings subscriber re-renders the day list immediately via `daysBySubjectiveNight(cutoverHour)`
- Both buttons' aria-pressed values update to reflect new mode

**Accessibility:** Two-button toggle is more discoverable than a `<select>` (toggle button is announced by screen readers as "toggle button, not pressed / pressed") and the commits-on-click semantics map intuitively to button behavior.

---

### Time Format Impact on Event Display

**Phase 2 introduces two time-format modes affecting display:**

#### 24-hour format (default)

| Surface | Display Format | Example |
|---------|---|---|
| Event row in Today list | HH:MM in 24h | "03:50", "18:25" |
| Day header | ISO YYYY-MM-DD (unchanged) | "2026-05-27" |
| Manual-entry modal time picker | HH (0–23) + MM (0–59) | HH input min=0 max=23 |

#### 12-hour format (when timeFormat='12h')

| Surface | Display Format | Example |
|---------|---|---|
| Event row in Today list | H:MM AM/PM | "3:50 AM", "6:25 PM", "12:00 AM" (midnight), "12:00 PM" (noon) |
| Day header | ISO YYYY-MM-DD (unchanged — timeFormat-independent) | "2026-05-27" |
| Manual-entry modal time picker | HH (1–12) + MM (0–59) + AM/PM select | HH input min=1 max=12, plus `<select name="ampm">` |

**Conversion rules (internal):**
- All internal storage is canonical 24h ISO: `YYYY-MM-DDTHH:MM` (always 24h)
- UI layer converts 24h ↔ 12h only at render/input boundaries
- 12 AM = 00:xx, 12 PM = 12:xx, 1–11 AM = 01–11, 1–11 PM = 13–23

**Manual-entry modal behavior when 12h is selected:**
- HH input becomes `<input type="number" min="1" max="12">`
- New `<select name="ampm">` sibling with options "AM" and "PM"
- MM input unchanged (0–59)
- Validation converts user's HH+AMPM input to canonical 24h before storing

---

## Copywriting Contract

### Primary Interactions

| Element | Copy | Context |
|---------|------|---------|
| Header button | (gear icon, no text) | Settings trigger in top-right of page |
| Settings modal title | "Settings" | Modal h2 heading |
| Cancel button | "Cancel" | Discards pending edits, closes modal |
| Save button | "Save" | Commits all field changes, closes modal |
| Grouping toggle "Calendar" | "Calendar" | Groups events by wall-clock date |
| Grouping toggle "Sleep cycle" | "Sleep cycle" | Groups events by configurable sleep-cycle cutover hour |

### Form Sections

| Section | Label/Legend | Fields |
|---------|---|---|
| Profile | "Profile" | Subject name (text input) |
| Time & Day | "Time & Day" | Day cutover hour, View grouping (select), Time format (select) |
| Forecast tuning | "Forecast tuning" | Automatic outlier detection (checkbox), Max delta, Min days, Rolling window, Statistical blend (select) |

### Validation Error Messages

| Field | Error | Trigger |
|-------|-------|---------|
| subjectName | "{field} must be text." | Non-string input (shouldn't occur with type=text, but validator catches) |
| subjectName | "{field} must be ≤ 40 characters." | Length > 40 after trim |
| cutoverHour | "{field} must be an integer between 0 and 23." | Out of bounds or non-integer |
| groupingMode | "{field} must be one of: calendar, sleepCycle." | Invalid enum value |
| timeFormat | "{field} must be one of: 24h, 12h." | Invalid enum value |
| autoOutlier | "{field} must be true or false." | Non-boolean (shouldn't occur, but caught) |
| maxDelta | "{field} must be an integer between 5 and 120." | Out of bounds or non-integer |
| minDays | "{field} must be an integer between 1 and 90." | Out of bounds or non-integer |
| windowDays | "{field} must be an integer between 3 and 90." | Out of bounds or non-integer |
| statBlend | "{field} must be one of: median, mean, blend." | Invalid enum value |

**Error rendering:** Each error as a `<p data-field="{fieldName}">` in the `<output id="settingsErrors">` block. Single error-surface element mirrors Plan 01-07 manual-entry pattern (reusing `aria-live="polite">`).

### Field Labels

| Input name | Label | Help text |
|------------|-------|-----------|
| subjectName | "Subject name" | (none in Phase 2) |
| cutoverHour | "Day cutover hour" | (none in Phase 2 — Phase 3 documentation can explain the concept) |
| groupingMode | "View grouping" | (none — options are self-explanatory) |
| timeFormat | "Time format" | (none — options are self-explanatory) |
| autoOutlier | "Automatic outlier detection" | (checkbox label) |
| maxDelta | "Max delta (minutes)" | Metric shown in parentheses |
| minDays | "Min days" | (none — Phase 3 documentation explains this is a gate for predictions) |
| windowDays | "Rolling window (days)" | Metric shown in parentheses |
| statBlend | "Statistical blend" | (none — options are self-explanatory) |

### Schema Notes

- No welcome banner, onboarding tooltip, or help text in Phase 2 (D2-13)
- Settings fields are **stored-but-inert** per D2-02 — CFG-02, 03, 04, 06, 07 have no Phase 2 consumer in the UI; they're visible in the modal but don't affect app behavior until Phase 3 (forecast engine)
- Error messages use the validator's generated text (pattern: "{field} must be X")
- All text is English only (v1 constraint)

---

## Accessibility & Interaction Contract

### Keyboard Navigation

- **Modal open:** Tab order = form fields (top to bottom), then Cancel, then Save
- **Modal focus management:** Auto-focus first field on open; ESC closes; focus moves to first errored field on validation failure
- **Grouping toggle:** Tab to reach buttons; Space/Enter to activate

### Screen Reader Announcements

- Header: `<h1 class="subjectName">` provides semantic landmark; button has `aria-label="Settings"`
- Modal: `aria-labelledby="settingsTitle"` connects dialog to h2#settingsTitle; `aria-modal="true"` (implicit from `showModal()`)
- Errors: `<output aria-live="polite">` announces new errors when rendered
- Grouping toggle: `role="group"` with `aria-label="Day grouping"`; buttons have `aria-pressed` to reflect state

### Touch Targets

- All buttons ≥ 44px height (minimum per Phase 1 accessibility decision)
- Form inputs ≥ 44px height
- Gear icon centered inside button, no tiny hover area

### Color Contrast

- All text meets WCAG AA (4.5:1 for body text, 3:1 for large text) — Phase 8 theming confirms exact palette
- Error text color must contrast against background at 4.5:1

---

## Interaction Flows

### Opening Settings

1. User clicks gear icon in header
2. `openSettings({settings})` is called
3. Modal `showModal()` is called
4. Form fields are populated from `settings.get()` (current values)
5. Modal receives focus; first field is auto-focused
6. `aria-live="polite">` output cleared (no stale errors from prior session)

### Saving Settings

1. User edits one or more fields
2. User clicks Save button
3. Form data is read via `new FormData(form)`
4. JS validates via `validateSettings(raw, {mode: 'save'})`
5. If errors:
   - Render errors to `<output>` as `<p data-field="{name}">`
   - Re-open modal via `showModal()` (kept open)
   - Auto-focus first errored field
   - Stay in edit mode (user can correct and re-submit)
6. If valid:
   - Call `settings.update(normalized)` with validated data
   - Modal closes automatically (returnValue='save' triggers close handler)
   - Settings subscriber fires synchronously
   - Header h1 re-renders (subject name), document.title updates
   - Today screen re-renders (if groupingMode or timeFormat changed)
   - Manual-entry modal (if open) re-renders time picker (if timeFormat changed)

### Canceling Settings

1. User clicks Cancel button OR presses ESC
2. Modal closes with empty returnValue (not 'save')
3. Pending edits are discarded
4. Next open of Settings shows current persisted values (fresh load from `settings.get()`)

### Grouping-Mode Toggle (commits-on-click, unique behavior)

1. User clicks "Sleep cycle" button
2. Click handler fires immediately (no Save needed)
3. `settings.update({groupingMode: 'sleepCycle'})` is called
4. Settings subscriber fires
5. Today screen re-renders day list via `daysBySubjectiveNight(cutoverHour, 7)`
6. Both toggle buttons update `aria-pressed` to reflect new state
7. User sees the day-grouping change instantly (preview = commit)

### Time Format Toggle (via Settings modal)

1. User opens Settings modal
2. User changes "Time format" from "24-hour" to "12-hour"
3. User clicks Save
4. Modal closes, subscriber fires
5. Header + Today screen re-render with times in "H:MM AM/PM" format
6. If manual-entry modal is open:
   - Subscriber fires in manual-entry
   - HH input `min/max` and `<select ampm>` visibility swap
   - Current HH value is converted (e.g., 14 → 2, PM)
   - Existing MM value is preserved
   - Modal stays open for editing

---

## CSS Structure & Styling Guidance

**Phase 2 styling extends Phase 1 (no framework):**

### New Classes (Phase 2 introduces)

| Class | Element | Purpose |
|-------|---------|---------|
| `.appHeader` | `<header>` | Header strip wrapper |
| `.subjectName` | `<h1>` | Subject name display |
| `.settingsTrigger` | `<button>` | Gear icon button |
| `.groupingToggle` | `<div>` | Toggle group wrapper |
| `.settingsErrors` | `<output>` | Validation error container |

### Styling guidance (Phase 2, Phase 8 finalizes theme)

- **Header:** Flexbox row, bottom border optional (1px secondary), 56px height, 16px horizontal padding
- **Modal:** Max-width 500px, centered on screen, 24px padding, fieldset borders 1px, legend bold
- **Buttons:** 44px height, 16px padding, transparent background with border or solid background; hover/active state TBD Phase 8
- **Form inputs:** 44px height, 16px padding, border 1px, focus outline 2px accent color
- **Error text:** 12px, color: error (TBD Phase 8), margin-top 4px below output element
- **Fieldsets:** margin-bottom 16px, padding 16px, border 1px secondary
- **Toggle buttons:** Active (aria-pressed=true) uses accent color; inactive uses secondary background

**Color tokens (Phase 8 populates actual values):**
- `--color-primary-bg`: page background
- `--color-primary-fg`: primary text
- `--color-secondary-bg`: modal/card background
- `--color-secondary-border`: fieldset/divider borders
- `--color-accent`: active states, focus outlines, accent buttons
- `--color-error`: validation error text
- `--color-error-bg`: optional error background (light)

---

## Browser & Platform Support

Unchanged from Phase 1:
- **Browsers:** Modern evergreen (Chrome/Edge 90+, Firefox 88+, Safari 15+)
- **Devices:** Desktop, tablet, mobile
- **Screen sizes:** 320px mobile to 2560px desktop (responsive via viewport meta tag + media queries)
- **Keyboard/mouse:** Full support; touch targets ≥ 44px
- **Offline:** localStorage available (verified by Phase 1)

**No new platform constraints in Phase 2.**

---

## Deferred to Phase 8 (PWA Hardening)

- Final color palette (dark/minimal/calm aesthetic confirmed Phase 1, exact hex/rgb TBD)
- Font family (system default in Phase 2, may be overridden Phase 8)
- Animation/transitions (smooth scrolling, modal slide-in, etc. — Phase 8)
- Responsive breakpoints (mobile modal width, header layout on small screens — Phase 2 should work, Phase 8 polishes)
- Icon refinement (SVG gear outline style — any minimal gear will do)
- Print styles (if any)
- Dark/light mode toggle (not in scope; Phase 2 assumes single theme)

---

## Deferred to Phase 3 (Forecast Engine Consumer)

- Field explanations / tooltips for CFG-02 (max_delta), CFG-03 (min_days), CFG-06 (window), CFG-07 (blend) — Phase 2 ships these as stored-but-inert; Phase 3 can add help text
- Visual feedback when settings are consumed by forecasts (e.g., "predictions will update when 7+ days of data exist" for min_days) — deferred
- Per-field disable/enable based on forecast state — deferred

---

## Design Decisions Locked from 02-CONTEXT.md

| Decision | Contract | Rationale |
|----------|----------|-----------|
| D2-01 | All 8 CFG-* requirements ship in Phase 2 (CFG-05 deferred to Phase 4) | Planner must not drop or defer CFG-01..04, 06..09 |
| D2-03 | Specific default values (cutoverHour=4, maxDelta=30, etc.) | Locked; no negotiation on defaults |
| D2-08 | Both stores share `createStorageLocal('nightwatch:db')` | Single localStorage key; planner wires at composition root |
| D2-10 | Header has left-aligned h1 + right-aligned gear icon | Specific layout; no alternative header designs |
| D2-12 | Native `<dialog>`, second modal after manual-entry | Reuses Plan 01-04 pattern; no custom modals |
| D2-13 | Three fieldset sections (Profile, Time & Day, Forecast tuning); no welcome banner | Specific grouping; no onboarding UI |
| D2-16 | Grouping-mode toggle commits-on-click (only exception to explicit-Save policy) | User-story critical; preview = commit |
| D2-20 | 12h picker is HH (1–12) + AM/PM select, not native `<input type="time">` | Native input too inconsistent across browsers |
| D2-22 | Out-of-range settings on load → reset to default + console.warn (per-field) | Defensive loading, never drop whole blob |

All other decisions (file structure, validator return shape, button styling, error rendering pattern) are within the planner's discretion (noted in CONTEXT.md "Claude's Discretion" section).

---

## Quality Checklist (for gsd-ui-checker)

- [x] Copywriting: All CTAs, labels, error messages, and help text defined
- [x] Visuals: Header layout, modal structure, button placement, toggle state specified
- [x] Color: Tokens defined (exact values Phase 8); 60/30/10 ratio preserved
- [x] Typography: Sizes, weights, line heights for all roles
- [x] Spacing: All gaps and padding use the 4px scale
- [x] Accessibility: Keyboard navigation, ARIA labels, focus management, touch targets all specified
- [x] Registry: Vanilla JS (no component registry); native HTML5 + inline SVG
- [x] Interactions: All user flows (open, save, cancel, toggle) described
- [x] Deferred: Phase 3 (forecast consumers) and Phase 8 (theming) clearly marked

---

## Design System Origin

**Upstream artifacts:**
- Phase 1 established: button patterns, dialog mechanics, form validation pattern (Plan 01-07 inline errors), 5-minute time rounding, dark/calm aesthetic
- CLAUDE.md: vanilla JS constraint, multi-file split, Object.freeze config pattern
- 02-CONTEXT.md (D2-01..D2-27): 27 locked decisions on settings UI, validation, migration, time format
- 02-RESEARCH.md: Patterns A–J (settings store, validator, 12h conversion, grouping toggle, etc.)
- Project reference: `../mindful-breathing` for visual tone and offline-first philosophy

**Phase 2 contribution:**
- Settings modal as the second major UI surface (first was Today + manual-entry in Phase 1)
- Header strip as the first app-wide persistent chrome (settings trigger + subject name display)
- Grouping-mode toggle as a unique "preview = commit" control (only field not saved via explicit Save)
- Time format as a display-contract multiplier (24h vs 12h affects event row + manual-entry picker)

---

**Status:** Ready for Phase 2 planner.
**Created:** 2026-05-28
**Designer:** gsd-ui-researcher (automated)
