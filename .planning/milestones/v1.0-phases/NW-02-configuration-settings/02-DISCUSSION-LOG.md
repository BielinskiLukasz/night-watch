# Phase 2 — Discussion Log

**Discussion date:** 2026-05-27
**Mode:** discuss (default)
**Areas selected by user:** MVP slice scope, Cutover visible effect, Settings UI shape & access, Settings persistence contract

This is the raw discussion trace — area-by-area, question-by-question. The
canonical decision record is `02-CONTEXT.md`. This file is for audits and
retrospectives only; downstream agents (researcher, planner, executor) do
NOT read this file.

---

## Area 1: MVP slice scope

### Q1.1 — How wide should Phase 2 slice?
**Options presented:**
- Cutover hour only (CFG-08)
- Cutover + time format (CFG-08, CFG-09)
- Cutover + name + time format + outlier toggle (CFG-01, 04, 08, 09)
- All 8 CFG-* requirements

**User selected:** All 8 CFG-* requirements
**Notes:** User opted for full coverage despite phase goal singling out cutover.
CFG-02/03/04/06/07 will ship stored-but-inert pending Phase 3 consumer.

### Q1.2 — Default values for first load?
**Options presented:**
- Spreadsheet conventions (name='', cutover=4, 24h, outlier off, max_delta=30, min_days=7, window=7, blend=median)
- Conservative 'show forecast late' defaults
- User specifies exact values
- Defer with sensible defaults

**User selected:** Spreadsheet conventions
**Notes:** Defaults locked exactly as listed. Will land as `DEFAULT_SETTINGS` frozen constant.

---

## Area 2: Cutover visible effect

### Q2.1 — When user changes cutover, what does Today list do?
**Options presented:**
- Switch list to subjective-night grouping
- Keep calendar grouping; cutover stays invisible until Phase 3
- Add a per-user toggle: 'Group by calendar / by sleep cycle'
- Subjective-night for list, calendar still in modal/headers (hybrid)

**User selected:** Add a per-user toggle (Option C)
**Notes:** This extends CFG-08 surface area with a new persisted value
`groupingMode ∈ {calendar, sleepCycle}`. Treated as part of CFG-08, not as
scope creep. Both bucketer functions already exist (D-08) — wiring only.

### Q2.2 — Where does the toggle live, default?
**Options presented:**
- Inside Settings; default = calendar
- Inside Settings; default = sleep cycle
- Quick-toggle on Today screen
- Quick-toggle on Today AND mirrored in Settings

**User selected:** Quick-toggle on Today AND mirrored in Settings
**Notes:** Default = calendar (preserves Phase 1 D-11). The Today toggle commits
on click (no Save needed for this specific control); rationale captured in D2-16.

---

## Area 3: Settings UI shape & access

### Q3.1 — How does user open and interact with Settings?
**Options presented (with user-friendliness scores):**
- Modal dialog (reuse manual-entry) — 4.5/5
- Dedicated Settings screen + back btn — 3.5/5
- Expandable inline panel — 3.0/5
- Drawer / off-canvas — 3.5/5

**User initially asked:** "Add user-friendly score for each option with explanation"
(re-presented with scores)
**User selected:** Modal dialog (reuse manual-entry) — 4.5/5
**Notes:** Drives D2-12 — native `<dialog>` with manual-entry mechanics + Plan 01-07
inline-error pattern.

### Q3.2 — Where does the Settings trigger button live?
**Options presented:**
- Top-right gear icon
- Header strip with subject name + gear
- Below day list near '+ Add event'
- Between quick-log and day list

**User selected:** Top-right corner (gear icon)
**Notes:** Drives D2-10. Subsequent question resolved that there IS a header strip
with the name — gear sits in that strip.

### Q3.3 — Where does the subject name appear?
**Options presented:**
- Thin header strip
- document.title only
- Inside Settings modal only
- Both header strip AND document.title

**User selected:** Both — header strip AND document.title
**Notes:** Drives D2-10 + D2-11. Header strip is the visible surface; document.title
is the "across all screens" hedge for Phase 7 navigation.

---

## Area 4: Settings persistence contract

### Q4.1 — Where do settings live; round-trip?
**Options presented:**
- Extend nightwatch:db blob (v→v2)
- Separate nightwatch:settings key
- Same blob, separately versioned section
- Two files exported separately

**User selected:** Extend nightwatch:db (Option A)
**Notes:** Drives D2-04, D2-05, D2-06. Schema bump v1→v2. Phase 5 export round-trips
both settings and events.

### Q4.2 — How is v1→v2 migration handled?
**Options presented:**
- Auto-upgrade silently
- Auto-upgrade with one-time toast
- Lazy upgrade until user opens Settings
- Hard migration with explicit user click

**User selected:** Auto-upgrade silently
**Notes:** Drives D2-05. No banner, no toast. `console.info` log allowed for
diagnostics; UI is silent.

---

## Continue-or-wrap-up check

### Q5.1 — Anything else to dig into?
**Options presented:**
- Wrap up
- Dig into Save/Cancel UX + field validation
- Dig into CFG-09 time format propagation
- Dig into field grouping & first-time onboarding

**User selected:** All three dig-in topics (2, 3, and 4)

---

## Area 5: Save/Cancel UX (extended)

### Q5.2 — How does the Settings modal commit changes?
**Options presented:**
- Explicit Save/Cancel
- Save-on-blur
- Save-on-change with debounce
- Hybrid per field type

**User asked:** "Cannot decide between 1 and 2, which one is more user friendly?"
**Recommendation given:** Option 1 (Save/Cancel), with two specific reasons:
1. Numeric save-on-blur has a partial-input footgun (user types "1", clicks dropdown → "1" saved before "15" finished)
2. Plan 01-07's inline aria-live error pattern only works with explicit Save
**User confirmed:** Save/Cancel + inline aria-live errors
**Notes:** Drives D2-14.

### Q5.3 — Field validation strategy?
**Options presented:**
- Strict bounds + clamp on load
- Strict bounds + fall back to default on load
- Strict bounds + throw 'corrupt blob' on load
- Loose bounds + soft warnings

**User asked:** "Cannot decide between 1 & 2, which one is more user friendly?"
**Recommendation given:** Option 2 (fall back to default), with three reasons:
1. Consistency with Phase 1's T-03 corrupted-blob policy (defensive on load)
2. No magic transformation — clamp silently turns 25 → 23
3. Self-correcting UI surface — open Settings, see defaults, fix what's wrong
**User confirmed:** Strict Save validation + reset to default on load
**Notes:** Drives D2-21, D2-22, D2-23. Bounds locked as listed in D2-21.

---

## Area 6: CFG-09 time format (extended)

### Q6.1 — Where does 24h/12h toggle apply, and is change instant?
**Options presented:**
- Everywhere visible, instant re-render on Save
- Display-only (rows + headers), modal stays 24h
- Everywhere, instant for new content only
- Everywhere, reload-only

**User selected:** Everywhere visible, instant re-render on Save
**Notes:** Drives D2-18, D2-19, D2-20. Triggers the need for a settings-store
subscriber mechanism (D2-09) so today-screen + open manual-entry modal can
re-render on Save.

---

## Area 7: Field grouping & onboarding (extended)

### Q7.1 — How are 8 settings organized in modal; first load?
**Options presented:**
- Grouped under 3 section headings, no welcome nudge
- Flat list in requirement order
- Grouped + first-load welcome nudge
- Grouped + 'Forecast tuning' collapsed by default

**User selected:** Grouped under 3 section headings, no welcome nudge
**Notes:** Drives D2-13. Three sections: Profile / Time & Day / Forecast tuning.
No welcome banner. Defaults populated on first open; gear discovery is sufficient.

---

## Summary of recommendations Claude made (vs user-driven choices)

**Claude's discretion items applied without asking the user:**
- Settings adapter reuses the same `createStorageLocal` instance as event-log
- Subscriber/observer pattern for reactive re-render (D2-09) — synchronous,
  no debounce in v1
- Module file layout (`js/store/settings.js`, `js/lib/settings-validate.js`,
  `js/ui/settings-modal.js`, `js/ui/header.js`)
- TDD discipline matches Phase 1 (pure logic strict; UI test-after with E2E)
- Migration integration test pattern (D2-25)
- 12h conversion math (12 AM → 00, 12 PM → 12, 1–11 PM → 13–23)

**Recommendations given when user asked for guidance:**
- Save/Cancel over save-on-blur (Q5.2) — accepted
- Default on load over clamp on load (Q5.3) — accepted

---

## Deferred ideas captured

See `02-CONTEXT.md` `<deferred>` section. Highlights:
- CFG-04 detection engine → Phase 3
- 7-day list-window configurable → Phase 2 candidate, not shipped (re-evaluate in dogfooding)
- Cutover-hour explainer tooltip → not shipped (no welcome nudge by user choice)
- Multi-profile (CFG2-01) → v2
- Polish UI (PLAT2-02) → v2

---

## Scope creep encountered

None. The grouping-mode toggle on Today was reviewed for scope creep risk and
classified as an extension of CFG-08 surface area (same persisted value,
different entry point), not a new capability.

---

*Discussion completed: 2026-05-27*
