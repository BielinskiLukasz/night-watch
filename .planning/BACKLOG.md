# Backlog: Nightwatch

Ideas and scope items captured outside the active roadmap. Anything here is *not* in v1 — it has either been deferred by explicit decision, surfaced during UAT, or earmarked for a later milestone. Items graduate to a `ROADMAP.md` phase when picked up (`/gsd-review-backlog` to promote, `/gsd-phase add` to materialize).

Last updated: 2026-08-25 (removed B-021, B-026 — shipped in v1.2; promoted B-004–007, B-031, B-033–037 → v1.3)
Last assigned ID: **B-037** — next new item must be **B-038**

---

## How to use this file

- **Adding an item:** increment the "Last assigned ID" counter at the top, then drop a new `### B-NNN` block with Source / Status / Earliest slot / What / Why / Open questions / Implementation notes. IDs are monotonic and never reused — even if the previous entry was promoted or removed.
- **Promoting an item:** `/gsd-review-backlog` (interactive) — moves a chosen item into the active milestone roadmap. Or manually run `/gsd-phase add` and reference the backlog ID in the phase description.
- **Removing an item:** delete the block or move it under a `## Rejected` heading with a one-line rationale (decisions cost; keep the rationale).
- **Memory ↔ backlog:** memory captures "this idea exists and here's the context"; this file is the project-level decision queue. Memory is the source for cross-session continuity; this file is the source for milestone planning. Update both when an item lands.

## Related

- `ROADMAP.md` — active milestone phases
- `milestones/v1.0-REQUIREMENTS.md` — v1.0 archived requirements (all 51 complete)
- `PROJECT.md` — core constraints (single subject v1, no build step, no frameworks)
- `CLAUDE.md` — v1/v2 split rules

---

## UX-polish bundle (captured during Phase 2 UAT, 2026-05-28)

These three items are complementary friction-reduction wins for one-handed, in-the-dark logging. They should probably ship together in a dedicated UX-polish phase between Phases 4 and 8, or folded into Phase 8 (PWA & Platform Hardening) since theming and mobile-first picker UX are presentation-layer work.

### B-001 · Per-event-type default times in manual-entry

**Source:** memory `project_idea_event_type_default_times.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands first) — or as a Phase 8 suB-0plan

**What:** When the manual-entry pop-up opens for a specific event type, prefill hour + minute with a sensible default (e.g., wake → 07:00, bedtime → 19:00, nap-start → 13:00). User can still override before saving. Defaults are configurable via a new "Default times" fieldset in the Settings modal.

**Why:** A sleep tracker lives or dies by per-event logging speed. Today the manual-entry pop-up opens with the current time, so the parent always retypes the actual sleep/wake time even though events cluster around predictable hours.

**Open questions when this gets planned:**

- All event types or only some (wake / bedtime / nap-start / nap-end)?
- Subject-aware (Phase 2 is single-subject; CFG2-01 multi-profile is v2)?
- Snap to 5-min increments (already a project invariant — should be free).
- Should defaults be **derived from history** (e.g., median wake time over the last 14 days) instead of a hardcoded config value? That overlaps directly with Phase 3 — possibly the forecaster IS the default source, not a separate config field.

**Implementation notes:**

- Data shape: `DEFAULT_SETTINGS` extension + `RULES` entries (integer 0-23 hour, integer 0-59 minute with 5-min step). `createSettingsStore` handles persistence with no code changes.
- UI: one fieldset addition to `js/ui/settings-modal.js` + a read inside `openManualEntry()` that prefills `hour`/`minute` before `applyTimeFormat()` runs.

---

### B-002 · Friendly hour picker (clock-face / wheel / tap-grid)

**Source:** memory `project_idea_friendly_hour_picker.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX-polish milestone, paired with B-001

**What:** Replace the manual-entry HH/MM number inputs (and the 12h AM/PM select from Plan 02-06) with a visual picker — analog clock-face, wheel/scroll, or tap-grid of common times. One tap per axis, works one-handed in the dark.

**Why:** Number inputs open the numeric keyboard but still require focus → tap → tab. A clock-face / wheel / grid is one tap per axis. Same "minimize friction" rationale as B-001 — they're complementary.

**Open questions when this gets planned:**

- Analog clock-face vs. wheel/scroll vs. tap-grid — which wins one-handed in the dark?
- Should the picker show B-001's smart default preselected, or always start at current time?
- A11y: a clock-face is hard for screen readers. Keep a number-input fallback behind a feature flag or "advanced" toggle.
- Mobile-first vs. desktop parity — the spreadsheet workflow this replaces was desktop; the PWA install target is mobile.

**Constraints to respect:**

- 5-min rounding rule (CLAUDE.md) — clock-face snaps naturally.
- No build step, no frameworks — vanilla CSS + JS. CSS `conic-gradient` clock with `<button>` children per hour is feasible; same for a 12-tap minute grid.
- Must stay testable in Playwright — current spec hits `input[name="hour"]` etc.; a picker rewrite needs `data-testid` selectors or equivalent test surface.
- Internal storage stays canonical 24h ISO (D2-20 invariant).
- `timeFormat` 12h vs 24h still toggles the picker surface, but the picker is now clock/wheel, not HH/AMPM number inputs.

---

### B-003 · Dark mode with manual + hour-based auto-switch

**Source:** memory `project_idea_dark_mode.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** **Phase 8 (PWA & Platform Hardening)** — theming is naturally co-located with PWA polish per CLAUDE.md's deferral note.

**What:**
1. Dark theme.
2. Manual toggle to switch.
3. Auto-switch based on hour-of-day (likely keyed off `cutoverHour` or a separate "night begins at" setting), or `prefers-color-scheme`.
4. A Settings field to pick the default mode: `light` / `dark` / `auto`.

**Why:** A parent logging a 3am wake with a phone glowing 100% white in their face is a UX failure for a sleep tracker. Dark mode + auto-switch closes the gap.

**Open questions when this gets planned:**

- Does "auto" mean OS preference (`prefers-color-scheme`) or hour-based (e.g., dark 18:00-06:00)? User mentioned hour-based — that's the unusual but more compelling fit for a sleep tracker (the OS doesn't know it's bedtime; `cutoverHour` does).
- If hour-based: derive from `cutoverHour` or expose a separate "night begins at" setting? Probably reuse `cutoverHour` — same household-night concept.
- Manual toggle in the header (always-reachable) or buried in Settings? Header is more discoverable but adds visual noise; Settings is cleaner. Probably Settings for v1, header chip in a later polish pass.

**Implementation notes:**

- CSS custom properties (`--bg`, `--fg`, `--accent`, etc.) on `:root` + a `data-theme="dark"` attribute on `<html>` to switch. Check `../mindful-breathing` first — it may already do this.
- Settings store gets a `theme: 'light' | 'dark' | 'auto'` field. Fits the existing CFG-* pattern; slots beside `timeFormat` in Time & Day fieldset, or in a new Appearance fieldset.
- Auto-switch needs a clock tick (or `prefers-color-scheme` media query listener) + recompute on `settings.subscribe`.
- 5-min rounding and storage-as-truth are theming-orthogonal — no data model risk.

---

## v2 scope deferred from v1 (surfaced as warnings 2026-05-28)

These REQ-IDs live in `REQUIREMENTS.md` body text but are intentionally absent from the v1 traceability table. They are v2 (next milestone) scope per CLAUDE.md's "Single subject, single nap/day in v1" rule and Phase 2's D2-01 deferral decision.

**Action:** surface during next-milestone planning (`/gsd-new-milestone v2.0`). Each becomes a v2 phase requirement.

| REQ-ID | Topic | Why deferred from v1 |
|---|---|---|
| `LOG2-01` | Multi-nap per day | CLAUDE.md v1 constraint: single nap/day. Phase 1 LOG-09 dedupes overflow naps with `extra:true` rather than supporting them as first-class entries. |
| `LOG2-02` | (See REQUIREMENTS.md body) | v2 logging extension. |
| `CFG2-01` | Multi-profile / multi-subject | CLAUDE.md v1 constraint: single subject. Phase 2 data shape preserves clean v2 migration path. |
| `PRED2-01` | (See REQUIREMENTS.md body) | v2 prediction extension — likely lands after the Phase 3 baseline forecaster ships. |
| `PLAT2-01` | (See REQUIREMENTS.md body) | v2 platform/PWA capability. |
| `PLAT2-02` | (See REQUIREMENTS.md body) | v2 platform/PWA capability. |

When v2 milestone opens, lift the bodies of these REQ-IDs out of `REQUIREMENTS.md` into the v2 traceability table.

---

## Prediction enhancements (captured 2026-06-04)

These four items improve the accuracy and adaptability of the forecasting engine by incorporating temporal rules, duration patterns, contextual flags, and historical nap-skip behavior. They should be evaluated and possibly grouped into a dedicated prediction-refinement phase post-Phase 3.

### B-004 · Time-based bedtime rule

**Source:** user input (2026-06-04)
**Status:** promoted → v1.3 (Phase 12) · not yet planned
**Earliest sensible slot:** post-Phase 3 (after baseline forecaster ships) — can be a quick refinement plan

**What:** When the current time hour is >= 18 and the previous event is "wake", predict bedtime as the next event (not nap start). This rule reflects the intuition that late-afternoon wakes naturally lead to bedtime, not a nap.

**Why:** Time-of-day context dramatically affects what event comes next. A child who wakes at 17:00 is almost certainly heading to bed, not a nap. Current v1 prediction algorithm may not capture this hard temporal constraint.

**Open questions when this gets planned:**

- Is 18:00 the right threshold, or should it be configurable per subject/stage?
- Should this rule interact with stage data (Phase 6) — e.g., "dropped second nap" stages have no afternoon naps regardless of hour?
- Does this rule apply globally or only when history confidence is low?

**Implementation notes:**

- Likely a conditional check in the forecaster before returning predictions, keyed off `hour >= 18 && lastEvent.type === 'wake'`.
- Data shape: no change — this is a prediction-algorithm refinement.

---

### B-005 · Duration-based prediction

**Source:** user input (2026-06-04)
**Status:** promoted → v1.3 (Phase 12) · not yet planned
**Earliest sensible slot:** post-Phase 3, paired with B-004 as a refinement bundle

**What:** Predict wake times not only from hour-of-day patterns, but also from typical sleep-duration patterns. E.g., if the child typically sleeps 10.5–11.5 hours and goes down at 22:00, predict wake at ~08:30–09:30. Calculate predictions separately for both duration and hour patterns, then union them for a robust forecast.

**Why:** Hour-only prediction can miss the true wake window. Duration patterns reveal how much sleep the child typically takes in a given cycle, which is orthogonal to clock hour. Unioning both patterns reduces false negatives.

**Open questions when this gets planned:**

- How to union two separate predictions (hour-band and duration-band)? Take the intersection (more conservative), union (looser), or weighted blend?
- How to detect and handle outliers in duration data (e.g., a single 14-hour nap or a 3-hour night)?
- Should duration be computed per event-type (wake duration vs. nap duration) or globally?
- Interaction with stages (Phase 6): does typical duration change when the child "dropped second nap"?

**Implementation notes:**

- Compute a median/percentile sleep duration from historical data (filtered by event type and stage if available).
- Run two separate forecaster paths: hour-based and duration-based. Merge results before returning to UI.
- Data shape: no change.

---

### B-006 · Intense day checkbox

**Source:** user input (2026-06-04)
**Status:** promoted → v1.3 (Phase 12) · not yet planned
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — or bundled with B-004 & B-005 if kept together

**What:** Add a boolean "intense day" flag in the event-entry form (quick-log or manual entry). Store this flag in the history record and include it as contextual metadata in the prediction algorithm. E.g., if the child had an "intense day", expect later bedtime or longer nap.

**Why:** Sleep events are driven by circumstance and activity, not just clock. Marking days with high activity, travel, or stimulation gives the forecaster human context it otherwise lacks.

**Open questions when this gets planned:**

- UI placement: checkbox in the quick-log row, in the manual-entry pop-up, or a separate "meta" button per day?
- Per-event or per-day? (Likely per-day — the entire day is intense or not, not individual events.)
- How does the forecaster weight "intense day"? Shift predicted times? Increase uncertainty bands? Disable predictions entirely?
- Should there be multiple flags (e.g., "travel", "social event", "sick") or just a binary "intense"?

**Implementation notes:**

- Data shape: add `intenseDay: boolean` to the day record (or store as a metadata object keyed by date if granularity by event is needed later).
- `createSettingsStore` doesn't change; the flag goes in the event log, not settings.
- UI: add a checkbox in `manual-entry.js` and/or `quick-log.js`. Probably togglable per day, stored once, not per-event.
- Forecaster: branch prediction logic if `intenseDay` is true; may be a simple shift/multiplier or a full conditional tree.

---

### B-007 · Missing nap impact on bedtime

**Source:** user input (2026-06-04)
**Status:** promoted → v1.3 (Phase 12) · not yet planned
**Earliest sensible slot:** post-Phase 3, with B-004 & B-005 as a prediction-refinement bundle

**What:** When predicting bedtime after a wake event (i.e., previous event = "wake"), check the historical record to detect how sleep behavior changes when the child skips their typical nap. Use this pattern to adjust the bedtime prediction (earlier bedtime? longer sleep? earlier nap next day?).

**Why:** A child who misses a nap often exhibits compensatory sleep behavior — earlier bedtime, longer night sleep, or earlier/longer nap the next day. If the forecaster can detect a missed nap, it can adjust expectations.

**Open questions when this gets planned:**

- How to detect a "missed nap"? Silent absence (no nap-start event by X o'clock) vs. an explicit "skip nap" flag?
- What adjustment to apply? Add N minutes to predicted bedtime? Widen the uncertainty band? Explicitly note the miss to the user?
- Scope: only bedtime, or also next-day nap and wake predictions?
- How far back to look in history? Last 7 days? Last 30 days?

**Implementation notes:**

- Likely a post-processing step in the forecaster: if no nap-start event has occurred by a threshold hour (e.g., 15:00), flag a missed nap and adjust downstream predictions.
- Data shape: no new fields unless adding an explicit "skip nap" flag. The logic is read-only on existing events.
- Interaction with stages: does the threshold hour or adjustment factor change per stage (e.g., "dropped second nap" stages have no afternoon nap at all)?

---

## Forecast engine polish (deferred from Phase 03, 2026-06-05)

These four items surfaced during Phase 3 (Forecast Engine & Today Screen) execution. The core algorithm and UI are complete and verified; these are UX refinements and test-coverage improvements deferred to future phases.

### B-008 · Cold-start message formatting polish

**Source:** Phase 03-05 user verification checkpoint (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** Phase 8 (PWA & Platform Hardening) — typography polish

**What:** The cold-start message ("Not enough data yet. Log N more days to see predictions.") wraps to multiple lines in some viewport widths. Reformat or apply CSS constraints to keep it single-line or improve visual spacing.

**Why:** The message is functionally correct but could look more polished on mobile. Phase 8 is the platform hardening and theming phase where this kind of typography work naturally lands.

**Implementation notes:**

- CSS: constrain message width, adjust font size for mobile, or reword to be shorter.
- No data model or algorithm changes.

---

### B-010 · Prediction cards on-demand toggle (optional UX)

**Source:** Phase 03-05 design decision (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 — only if user feedback suggests it's needed

**What:** Currently, prediction cards always show once minDays threshold is met. An alternative UX would hide cards by default and show them on-demand (e.g., tap "Show predictions" button). This item captures that option for future evaluation.

**Why:** Some users might prefer a cleaner default view and tap to reveal predictions. Others prefer predictions always visible. Phase 3 chose "always visible" as simpler and more aligned with the goal statement. This backlog item preserves the alternative for future UX testing.

**Open questions when/if this gets planned:**

- A/B test with real users: do they prefer always-visible or on-demand?
- If on-demand: button placement (card header, Today screen header, toggle in Settings)?

**Implementation notes:**

- Likely a Settings field `showPredictionsByDefault: boolean` or similar.
- Conditional rendering in `renderForecastSection()` based on this flag and user tap state.

---

### B-011 · Probability-band fallback E2E test with realistic fixture data

**Source:** Phase 03-05 test coverage gap (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** Phase 5 (Data Import/Export) — this phase will add fixture loading capability

**What:** The Phase 3 E2E test for probability-band fallback (`forecast.spec.js` test 4) uses a small maxDelta value to trigger the fallback with synthetic log data. A more comprehensive test with realistic historical data (7+ days spread across multiple weeks) would better validate the fallback in realistic scenarios.

**Why:** Realistic test data exercises edge cases (e.g., low sample counts, skewed distributions) that synthetic small datasets might miss. Phase 5 will add data import/export capability, making it practical to load a fixture file with representative historical sleep data.

**Implementation notes:**

- Create a fixture JSON file (e.g., `tests/fixtures/forecast-probability-band-data.json`) with 30–60 days of varied sleep data.
- Add an E2E test that loads this fixture via the Phase 5 import API, then verifies probability-band rendering.
- No changes to the forecast algorithm itself — this is a test-suite enhancement only.

---

## Editing and history enhancements (captured 2026-06-05)

These three items add core editing capabilities and multi-nap history support to the logging workflow.

### B-012 · History and support for multiple naps per day

**Source:** user input (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — or as a dedicated Phase 5 follow-up

**What:** Extend the history view and data model to display and track multiple naps per day (currently single-nap v1). Update the day/history aggregation logic to show all naps on a single day record without collapsing or deduping them.

**Why:** Real-world sleep patterns often include two or more naps per day. Current v1 architecture is designed to accept overflow naps but collapses them via `extra:true` dedupe logic (Phase 1 LOG-09). Enabling true multi-nap history requires data shape changes and UI updates to display multiple naps cleanly.

**Open questions when this gets planned:**

- Does this align with CFG2-01 (multi-profile v2 scope), or is it a v1 follow-up independent of multi-subject?
- How should the UI display multiple naps on a single day (separate rows, grouped collapse, timeline view)?
- Should quick-log and manual-entry flows change to hint that multiple naps are now supported?
- Interaction with probability-band predictions: does the forecaster predict all naps or just the first?

**Implementation notes:**

- Data shape: lift the `extra:true` dedupe constraint from Phase 1; track naps as an array or continue appending as separate events with day-grouping logic.
- UI: update day rendering in `history-screen.js` to display multiple nap entries without visual clutter.
- Forecaster: ensure nap-prediction logic handles multiple naps per day gracefully.

---

### B-013 · Undo edit/delete/add of the last event

**Source:** user input (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — quick refinement phase

**What:** Add an undo button or keystroke to revert the most recent event modification (edit, delete, or add). Triggered via a header button, keyboard shortcut (e.g., Ctrl+Z), or swipe gesture.

**Why:** One-tap undo is a critical UX pattern for logging workflows. Users edit/delete events in the dark on mobile and need to recover quickly from mistakes without re-entering data.

**Open questions when this gets planned:**

- Single-step or full undo stack (history of all changes this session)?
- Persistence: does undo state survive app close, or is it session-only?
- UI placement: persistent header button, floating action button, or keyboard-shortcut-only?
- Keyboard shortcut: Ctrl+Z (standard), or context-aware (swipe left, long-press)?

**Implementation notes:**

- Store the last event action (before mutation) in memory or sessionStorage keyed by timestamp.
- Restore the previous event state on undo; if delete, re-insert the event; if edit, restore prior field values.
- UI: add a button or shortcut listener in `app.js` or a new `undo.js` module.
- No data shape changes — this is a UI/UX feature.

---

### B-014 · Redo undone actions

**Source:** user input (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** paired with B-013 (undo/redo typically ship together)

**What:** Complement the undo feature (B-013) with a redo button/keystroke to restore the undone change (Ctrl+Y or Cmd+Shift+Z convention).

**Why:** Undo/redo is a pair; users expect both. If they undo a delete by mistake, they need to redo it without re-entering.

**Open questions when this gets planned:**

- Single-step redo or full stack? (Likely same scope as B-013.)
- Same keyboard shortcut convention as B-013?
- Should redo be greyed out when the undo stack is empty?

**Implementation notes:**

- Pair with B-013's undo stack: store both the current and the reverted state.
- Restore the most recent undone change on redo.
- UI: add redo button or shortcut in the same location as undo (B-013).

---

## Tab navigation and bulk-add UX (captured 2026-06-06)

These two items improve the Today screen and introduce a new Events screen for browsing historical logs with filtering options, plus a batch-add workflow for data import.

### B-015 · Three-tab navigation: Today | Events | History

**Source:** user input (2026-06-06)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — or as part of Phase 5 (Data Import/Export) when batch-add workflow is needed

**What:**
- Restructure the top-level screen tabs from their current layout to: **Today | Events | History**
- **Today tab:** displays only logs from the current day in a lean, action-focused view. No Calendar picker, no Sleep cycle selector. Shows predictions and the primary action is logging new events.
- **Events tab:** displays all logs across all days (functionally equivalent to the current "Today" tab's log list, but now dedicated). Retains the Calendar picker and Sleep cycle selector UI for filtering. Calendar and Sleep cycle settings remain configurable via the Settings modal.
- **History tab:** unchanged (aggregated table view by day).

**Why:** The current Today tab mixes two distinct use cases: "what happened today" (a quick glance, the primary action) and "browse all historical logs" (requires navigation, filtering). Splitting them gives users a clearer mental model and streamlines the everyday workflow. A parent checking on today's sleep (Today tab) should see predictions and a quick "add event" button without scrolling past day selectors.

**Open questions when this gets planned:**

- Should the Today tab show just today's logs, or today's logs + today's predictions on the same screen? (Likely both — predictions are output derived from today's history.)
- Do the Calendar and Sleep cycle settings persist between Today and Events tabs, or reset per tab?
- Should Today tab display predictions in the same order/layout as currently (next-event hero card + four forecast cards)?

**Implementation notes:**

- UI: refactor `index.html` tab nav and `js/ui/today-screen.js` to accept a mode flag (`today` vs. `all-days`).
- Filtering logic: when mode is `today`, filter log entries by current day (computed relative to `cutoverHour`); when mode is `all-days`, show all entries.
- Calendar and Sleep cycle pickers: move from `today-screen.js` to a new `events-screen.js`, or conditionally render them based on tab context.
- No data shape changes — this is UI reorganization only.

---

## Charts & UX refinements (captured 2026-06-30)

These four items were surfaced during Phase 7 UAT and post-launch review.

### B-017 · Nap length chart (like Sleep Length)

**Source:** user input (2026-06-30)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 — can be added as a sixth chart section in charts-screen.js

**What:** Add a nap-duration line chart alongside the existing Sleep Length chart. Show nap duration (napEnd - napStart) per day as a line series, mirroring the Sleep Length chart's layout, Y-axis auto-scaling, stage boundaries, and rejected-day greying.

**Why:** Nap length is as informative as night-sleep length for tracking regressions, improvements, and stage transitions. The current Charts screen only shows night-sleep duration; nap duration is buried in the Nap Pattern card as a single average value without a time-series view.

**Open questions when this gets planned:**

- Should nap length and sleep length share an axis/panel or be separate sections?
- What to show on days with no nap (null vs. 0 on the line)?
- Should the Y-axis reflect nap-specific typical ranges (e.g., 30min–3h) or share scale with night sleep?

**Implementation notes:**

- Add `buildNapLengthSeries(days)` in `chart-data.js` — mirrors `buildSleepLengthSeries` but computes `(napEnd.at - napStart.at) / 60` in minutes.
- Add `renderNapLengthChart(sectionEl, days, snap)` in `charts-screen.js`.
- Add a sixth permanent `section6` div in `mountChartsScreen`.

---

### B-018 · Invert time axis in Wake & Bedtime Bands chart

**Source:** user input (2026-06-30)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 — one-line change to `yScale` in `renderTimeBandChart`

**What:** Invert the Y-axis of the Wake & Bedtime Bands scatter plot so that earlier times appear at the TOP and later times appear at the BOTTOM. Current convention has 0h (midnight) at the top and 24h at the bottom, which is counter-intuitive for sleep data — "earlier wake = higher on chart" reads more naturally as "higher is better (earlier)".

**Why:** Inverted time axis is the conventional display for chronobiology charts: later events (higher hour) appear lower on the chart, matching the natural mental model where "going up" on the graph means earlier in the day. The current `yScale` in `renderTimeBandChart` already has a comment noting the top-to-bottom order.

**Implementation notes:**

- In `renderTimeBandChart`, change `yScale`:
  ```js
  // Current (0h at top, 24h at bottom):
  const yScale = (minutes) => M.top + (minutes / (24 * 60)) * plotH;
  // Inverted (0h at bottom, 24h at top):
  const yScale = (minutes) => M.top + plotH - (minutes / (24 * 60)) * plotH;
  ```
- Also invert the Y-axis tick labels accordingly (they currently read 0:00 at top).
- No data or algorithm changes.

---

### B-019 · Nap Start and Nap End time-band scatter (Chart 2 extension)

**Source:** user input (2026-06-30)
**Status:** captured · not scheduled
**Earliest sensible slot:** paired with B-018 — both extend the Wake & Bedtime Bands chart

**What:** Add nap-start and nap-end time dots to the Wake & Bedtime Bands scatter plot (currently only wake and bedtime dots). Show all four event types on the same chart with distinct colors. Extend the legend accordingly.

**Why:** Nap timing patterns are as important as wake/bedtime for understanding the sleep schedule. Adding them to the same chart makes temporal relationships visible (e.g., nap follows wake by roughly X hours, bedtime follows nap end by Y hours).

**Open questions when this gets planned:**

- Four distinct colors required — pick from the existing palette or add new ones.
- Should nap dots be a different shape (e.g., triangle or diamond) to distinguish from wake/bedtime?
- Should nap-less days show a gap in the nap series, or be hidden entirely?

**Implementation notes:**

- In `buildTimeBandSeries(days)` (chart-data.js): already returns `napStartMinutes` and `napEndMinutes` fields (if not, add them from `day.napStart?.at` and `day.napEnd?.at`).
- In `renderTimeBandChart` (charts-screen.js): add circle rendering for `p.napStartMinutes` and `p.napEndMinutes` with distinct fill colors.
- Update legend to show all four series.

---

### B-022 · Heatmap cell rich tooltip (custom popover)

**Source:** user input (2026-06-30)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 — small standalone UX addition to charts-screen.js

**What:** Replace the native browser `<title>` tooltip on heatmap cells with a styled popover that appears on hover (or tap on mobile). Show: date, sleep duration, wake time, bedtime, and nap duration if available. Position the popover near the cursor/cell and dismiss on mouse-leave or outside tap.

**Why:** The current `<title>` tooltip shows only date + sleep hours and has no visual styling, delay control, or mobile support. A custom popover would surface all four event times at a glance and work consistently across browsers and touch devices.

**Open questions when this gets planned:**

- Show/hide trigger: `mouseenter`/`mouseleave` or `pointermove`?
- Mobile: tap to show, tap elsewhere to dismiss?
- Position: fixed near the cell, or always anchored to a corner of the chart section?
- Content: just the four event times + sleep hours, or also stage name if active?

**Implementation notes:**

- Remove `<title>` elements and add `pointerenter`/`pointerleave` handlers to each cell rect.
- Render a single shared `<div class="heatmapTooltip">` element positioned with CSS `position: fixed` and updated via `mousemove`. Populate with `textContent` only (T-04-04 pattern).
- No external dependencies — vanilla DOM only, consistent with project constraints.

---

## More charts and sleep-length calculation audit (captured 2026-07-03)

### B-025 · More diagrams + verify sleep length calculation

**Source:** user input (2026-07-03)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 / v1.1 — extends charts-screen.js

**What:** Two related tasks:

1. **Audit the sleep-length calculation** used in `buildSleepLengthSeries` (chart-data.js) and the Sleep Length chart (charts-screen.js): confirm the formula is `bedtime.at − wake.at` (accounting for the subjective-night cutover), matches the spreadsheet's `Długość snu` column, handles midnight-crossing correctly, and excludes rejected days. Fix any discrepancy.

2. **Add more chart types** to the Charts screen, building on the existing five visualizations. Candidates (to be prioritised during planning):
   - **Sleep duration histogram** — distribution of night-sleep lengths (binned by 15–30 min intervals); reveals modal and tail behaviour better than the line chart.
   - **Nap-length line chart** — time series of nap duration (see also B-017); mirrors Sleep Length chart structure.
   - **Bedtime vs. wake-time scatter** — cross-axis scatter to see if later bedtimes correlate with later wakes; requires two-axis layout.
   - **Rolling-average overlay** — add a 7-day rolling mean line to the Sleep Length chart so short-term noise is visually separated from the trend.
   - **Stage-boundary annotations** — vertical lines at stage transitions on the Sleep Length and Time Bands charts; users already define stages but cannot see them on charts.

**Why:** The Sleep Length chart is the most prominent visualization in the app — if its formula is wrong (e.g., using calendar midnight instead of the subjective cutover, or not excluding rejected days), every user decision built on it is suspect. The audit is a prerequisite for trusting the chart output. Additional chart types increase the diagnostic power of the Charts screen, especially for parents trying to detect regressions or confirm stage transitions.

**Open questions when this gets planned:**

- What is the exact formula in `buildSleepLengthSeries`? Does it use `bedtime.at - wake.at` or `wake.at + 24h - bedtime.at` for nights that cross midnight?
- Does it correctly scope to the stage's data when `activeStageId` is set?
- For the histogram and rolling-average overlay: should they appear as suB-0sections or replace/extend section 1 (Sleep Length)?
- Which additional charts are highest priority — let user rank before planning begins.

**Implementation notes:**

- Audit: read `js/lib/chart-data.js` `buildSleepLengthSeries`, compare against `js/lib/day-bucket.js` day-length derivation and the spreadsheet's `Długość snu` column (PROJECT.md Context). Write a unit test that pins the formula with known inputs including midnight-crossings and rejected days.
- New charts: each follows the existing pattern in `charts-screen.js` — `buildXxx(days)` in chart-data.js + `renderXxxChart(sectionEl, days, snap)` in charts-screen.js + a new `sectionN` div in `mountChartsScreen`. Unit-test the data transform; E2E-test that the chart section renders.
- Stage-boundary annotations: require passing `stages` and `activeStageId` to the render functions (not currently threaded through all chart renderers).

---

### B-027 · Additional chart types: sleep & nap combined, activity histograms

**Source:** user input (2026-07-03)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 / v1.1 — extends charts-screen.js, paired with B-025 and B-026

**What:** Expand the Charts screen with visualization types that pair or combine the existing event-duration data:

1. **Sleep + Nap combined duration line chart** — stacked or overlaid line showing total rest time per day (sleep duration + nap duration). Useful for spotting days when total rest drops below normal.

2. **Nap duration distribution histogram** — binned histogram of nap lengths (15–30 min buckets) showing which nap durations are most common; complements the existing Sleep Length histogram (B-025).

3. **Activity time histogram** — distribution of awake time (bedtime → wake) to spot whether activity periods vary widely or cluster.

4. **Before-nap activity scatter** — plot wake-to-nap-start gap (X-axis: date, Y-axis: minutes) to see if pre-nap activity is stable or drifts. Overlaid with rolling average (B-025 concept).

5. **After-nap activity scatter** — plot nap-end-to-bedtime gap, same pattern as before-nap.

**Why:** These charts surface behavioral patterns that individual event times miss. E.g., a child might wake at a consistent time but stay awake for 4 hours one day and 5 hours the next — the activity chart reveals the drift, while the wake-time chart alone does not. Composite charts (sleep + nap, before/after nap gaps) are also powerful diagnostic tools for parents detecting stage transitions or activity regressions.

**Open questions when this gets planned:**

- Layout: where do these new charts appear? Extend the existing 5–6 sections, or organize into separate "Daily metrics" and "Activity patterns" sections?
- Which are highest priority — likely sleep+nap combined and activity histograms first?
- For scatter plots (before/after nap): should they show points only for days with naps, or include all days with a null/skip marker?
- Should activity-time statistics include outlier filtering (e.g., exclude days with unusual activity for a clearer trend view)?

**Implementation notes:**

- Add `buildCombinedDurationSeries(days)` to chart-data.js — sums sleep + nap durations per day.
- Add `buildActivityHistogram(days)`, `buildNapHistogram(days)` for binned distributions.
- Add `buildBeforeNapActivitySeries(days)` and `buildAfterNapActivitySeries(days)` for time-gap scatter plots.
- Add corresponding render functions in charts-screen.js: `renderCombinedDurationChart`, `renderActivityHistograms`, `renderActivityScatters`.
- Each render function follows the existing pattern: Y-axis auto-scaling, stage boundaries, rejected-day greying, legend.
- Unit-test the data transforms (especially activity gaps when nap is missing).

---

### B-028 · Reorder event-type list in Add Event (bedtime last)

**Source:** user input (2026-07-10)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — or bundled with B-001/B-002 in UX-polish milestone

**What:** Change the order of event types shown in the Add event popup so that bedtime appears last. Current order places bedtime earlier, which is unintuitive during rapid logging — bedtime is typically the final event of the day and should be visually last in the list.

**Why:** Parents logging events in real time expect bedtime to be the final option. Placing it last reduces cognitive friction and aligns with natural daily flow. This is especially helpful during one-handed, in-the-dark logging.

**Open questions when this gets planned:**

- Should the new order be static or configurable in Settings?
- Should the order adapt dynamically based on recent history?
- Interaction with B-001 (default times): does reordering affect which default time is preselected?

**Implementation notes:**

- Update event-type list in `manual-entry.js` and `quick-log.js`.
- If event types are generated from a shared constant, reorder the array or introduce a `sortOrder` field.
- Ensure Playwright tests referencing event-type order are updated or made order-agnostic.
- No data model changes.

---

### B-029 · Reorder prediction cards (bedtime last)

**Source:** user input (2026-07-10)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX polish milestone — or paired with B-030 (hero card missed-time flag)

**What:** Change the order of the four prediction cards so that bedtime prediction appears last (in the vertical view, don't change the horizontal one). Current order mixes wake/nap/bedtime in a way that doesn’t match the user’s mental model — bedtime is the final event of the day and should be visually last.

**Why:** Prediction cards are scanned quickly. Users expect bedtime to be the final card, mirroring the natural daily sequence. This improves readability and reduces misinterpretation.

**Open questions when this gets planned:**

- Should the order be strictly chronological (wake → nap-start → nap-end → bedtime)?
- Should the hero card remain independent of this order?
- Interaction with B-010 (on-demand toggle): does reordering affect reveal order?

**Implementation notes:**

- Update card rendering order in `renderForecastSection()`.
- If predictions are keyed by event type, introduce a stable sort order (e.g., `sortOrder: { wake: 1, napStart: 2, napEnd: 3, bedtime: 4 }`).
- Ensure probability-band colors and labels remain consistent after reordering.
- No changes to prediction algorithm — purely presentation-layer.

---

### B-031 · TIF accuracy on the Accuracy screen

**Source:** user input (2026-07-13)
**Status:** promoted → v1.3 (Phase 14) · not yet planned
**Earliest sensible slot:** after B-021 (TIF algorithm) is promoted and shipped — requires TIF to be live and `forecastAlgorithm: 'tif'` toggle active

**What:** Extend the Accuracy screen to display TIF-specific backtesting metrics alongside (or instead of) the existing classic-forecaster accuracy grid. When TIF is the active algorithm, show a TIF accuracy section that measures how often TIF's predicted window contained the actual event time — i.e. “actual event fell inside the TIF window” as the primary hit metric. The section should also show the average window width (precision) per event type so users can see the trade-off between confidence and breadth.

Possible layout options (to decide at planning time):
- **Option A — Replace:** when `forecastAlgorithm === 'tif'`, swap the classic 4×3 grid for a TIF-specific grid (same 4 rows, different columns: “Inside TIF window”, “Avg window width (min)”, “Confidence score ≥ 80%”).
- **Option B — Extend:** always show the classic grid, and append a second TIF grid below it when TIF is enabled. Allows side-by-side comparison.
- **Option C — Tab toggle:** add a small pill toggle (“Classic | TIF”) at the top of the Accuracy screen to switch between the two grids.

**Why:** The existing Accuracy screen measures the classic forecaster only (`computeAccuracy` in `js/lib/accuracy.js`). Once TIF ships, users will switch to TIF and expect the Accuracy screen to reflect TIF's actual prediction quality — not the quality of an algorithm they're no longer using. Without this, the Accuracy screen becomes misleading when TIF is active.

**Open questions when this gets planned:**

- Which layout option (A / B / C) is preferred?
- What is the primary TIF hit metric? “Actual time fell inside [finalStart, finalEnd]” is the natural choice, but should it also track hits against the display window (which may be clipped to `precisionTarget`)?
- Should the confidence score column show the TIF confidence score (as defined in B-021 Step 4), or a simpler percentage?
- Should average window width be shown in minutes, or hours:minutes format?
- When TIF is in low-confidence fallback (union instead of intersection), should those days be counted differently in the backtesting?
- Interaction with stage filter: the existing screen already respects `activeStageId` via `filterDayRecordsByStage` — TIF accuracy should do the same.
- Cold-start threshold: same `minDays` gate as the classic grid, or a separate TIF-specific threshold?

**Implementation notes:**

- New pure function `computeTifAccuracy(days, tifForecastFn, snap)` in `js/lib/accuracy.js` (or a new `js/lib/accuracy-tif.js`). For each day, re-run TIF on the history *before* that day (leave-one-out backtesting, same method as `computeAccuracy`), then check if the actual event time falls inside the predicted `[finalStart, finalEnd]` window.
- Alternatively, if leave-one-out is too expensive, store the TIF prediction at logging time in the event record and compare retroactively (requires a data-shape change — less clean).
- Columns: `insideWindow` (boolean hit rate), `avgWindowWidth` (mean of `finalEnd − finalStart`), `highConfidencePct` (% of days where confidence score ≥ 80%).
- UI: add a second grid element or conditional branch inside `mountAccuracyScreen` gated on `snap.forecastAlgorithm === 'tif'`.
- No new settings beyond what B-021 already introduces.

---

### B-030 · Show “missed time” indicator only in hero prediction card

**Source:** user input (2026-07-10)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX polish milestone — or bundled with B-007 (missing nap impact on bedtime)

**What:** Restrict the “missed time” indicator so that it appears only in the hero prediction card (the main “Next Predicted Event” card). The indicator should not appear on the four secondary prediction cards. Hero card = single source of truth for contextual flags.

**Why:** Users scan the hero card first and rely on it as the authoritative summary of what’s happening today. Showing “missed time” on all prediction cards creates noise and dilutes the meaning of the flag. Keeping it exclusively in the hero card improves clarity and reduces cognitive load.

**Open questions when this gets planned:**

- Should the hero card show a short text (“Missed time today”) or an icon/badge?
- Should the indicator affect the hero card’s color scheme or only appear as metadata?
- Interaction with B-007 (missing nap detection): should the missed-time flag appear next to the label or inside the card body?
- Should the missed-time flag also appear in the Today tab header (optional)?

**Implementation notes:**

- Add conditional rendering inside `renderNextEventCard()` only.
- Remove missed-time flag from the prediction-card renderer (`renderForecastSection()` or equivalent).
- Ensure the forecaster still computes the missed-time condition (B-007), but presentation-layer decides where it is shown.
- No changes to prediction algorithm or data shape — purely UI logic.

---

### B-032 · Settings modal: forecast algorithm selector UX

**Source:** user input (2026-07-13)
**Status:** captured · not scheduled
**Earliest sensible slot:** after B-021 (TIF algorithm) ships — requires `forecastAlgorithm` toggle to exist in settings

**What:** Two related UX improvements to the Forecast & Prediction section of the Settings modal:

1. **Move the forecast algorithm selector to the top** of the Forecast & Prediction section, so it is the first control the user sees before any algorithm-specific parameters.

2. **Hide classic-only parameters when TIF is selected.** The following fields are unused by TIF and should be hidden (not disabled — hidden) when `forecastAlgorithm === 'tif'`:
   - `autoOutlier` (auto outlier detection)
   - `maxDelta` (max delta)
   - `statBlend` (statistical blend)

   Conversely, TIF-specific fields (`trimPct`, `precisionTarget`) should remain visible regardless, as they only appear when TIF is active.

**Why:** Currently all parameters are shown regardless of which algorithm is active. When a user switches to TIF, they see three settings that do nothing — this is confusing and makes the settings section feel cluttered. Hiding irrelevant fields based on the selected algorithm reduces cognitive load and prevents users from tuning parameters that have no effect on their predictions.

**Open questions when this gets planned:**

- Should the hiding be animated (smooth collapse) or instant? Instant is simpler and consistent with the project's no-animation-complexity constraint.
- Should hidden fields be `display: none` or `visibility: hidden`? `display: none` is cleaner — no empty space.
- When the user switches back from TIF to classic, should the hidden fields reappear with their previously saved values? Yes — hiding is purely presentational; values persist in settings store unchanged.
- Should TIF-specific fields (`trimPct`, `precisionTarget`) be hidden when classic is selected? Currently they appear in the TIF sub-section (Phase 10) — confirm whether they are already gated.

**Implementation notes:**

- In `js/ui/settings-modal.js`: move the `forecastAlgorithm` fieldset/row to be rendered first within the Forecast & Prediction section.
- Add a `change` listener on the `forecastAlgorithm` select that toggles `hidden` on the three classic-only field rows: `autoOutlier`, `maxDelta`, `statBlend`.
- On initial render, apply the same `hidden` state based on the current `snap.forecastAlgorithm` value so the UI is correct on first open.
- No data model or settings store changes — purely presentational logic in the modal renderer.
- Update any relevant E2E tests in `tests/e2e/` that assert the visibility of these fields.

---

## TIF algorithm extensions and metrics refinements (captured 2026-08-03)

### B-033 · TIF ratio-based windows: activity/sleep → nap-start; activity/nap → nap-end

**Source:** ISSUES-AND-IDEAS-08-03.md (2026-08-03)
**Status:** promoted → v1.3 (Phase 13) · not yet planned
**Earliest sensible slot:** after B-021 (TIF algorithm) is promoted and implemented — extends `js/lib/forecast-tif.js`

**What:** Add two ratio-based forecast windows to the TIF algorithm (B-021) for nap prediction:

1. **Activity-before-nap / sleep-duration ratio → nap-start window.** Compute the historical ratio `(napStart − wake) / sleepDuration` per day (trimmed). Given a known or predicted sleep duration, project nap-start as `wake_anchor + ratio × sleepDuration_anchor`. This creates an additional window that constrains nap-start from two independent signals: the raw activity gap (existing window 2 in B-021) and its relationship to the preceding night's sleep length.

2. **Activity-before-nap / nap-duration ratio → nap-end window.** Compute the historical ratio `(napStart − wake) / napDuration` per day (trimmed). Given a known or predicted pre-nap activity window, project nap duration as `activityBeforeNap / ratio`, then derive nap-end as `napStart_anchor + projectedNapDuration`. This creates an additional window for nap-end that does not rely on a historical nap-length distribution alone.

Both ratios must be trimmed with the same `trimPct` setting as other TIF windows. Anchor resolution follows the same rule as B-021: use the actual logged time if the anchoring event exists; otherwise use the TIF midpoint prediction for that event type.

**Why:** Nap timing is not independent of the preceding sleep. A longer night's sleep typically pushes the nap later (higher activity before nap) and may shorten the nap. Capturing this relationship as a trimmed ratio window gives TIF an additional intersection constraint that is not already expressed by the raw activity-before-nap band. These windows were identified empirically from the spreadsheet workflow.

**Open questions when this gets planned:**

- Should each ratio window be enabled independently via a settings toggle, or is the full set always active when TIF is enabled?
- How to handle days with unusually short or long sleep (outliers still present after trimming)? Consider whether the trim budget applies to the ratio series independently.
- Should the ratio be computed as `activityBeforeNap / sleepDuration` (dimensionless, typically < 1) or its inverse? Check whether the trimmed distribution is more symmetric in one form.
- Interaction with B-026 (metrics dashboard): the ratio values are worth surfacing as per-day metrics alongside AAS/SAA.

**Implementation notes:**

- Add `buildActivityToSleepRatioSeries(days)` and `buildActivityToNapRatioSeries(days)` in `js/lib/metrics.js` (or inline in `forecast-tif.js`) — both return an array of ratio values filtered to days where all required events exist.
- Apply `trimmedMinMax(ratioValues, trimPct, 0)` to each series to get `[minRatio, maxRatio]`.
- Project windows: nap-start window = `[wake_anchor + minRatio × sleep_anchor, wake_anchor + maxRatio × sleep_anchor]`; nap-end window = `[napStart_anchor + activityBeforeNap / maxRatio, napStart_anchor + activityBeforeNap / minRatio]` (note inversion).
- Slot these as window 3 for nap-start and window 3 for nap-end in B-021's window lists; the intersection logic is unchanged.
- Unit-test each window builder with known fixture data; verify that ratio inversion is correct.

---

### B-034 · Replace SAA metric with day-length / sleep-duration factor

**Source:** ISSUES-AND-IDEAS-08-03.md (2026-08-03)
**Status:** promoted → v1.3 (Phase 14) · not yet planned
**Earliest sensible slot:** when B-026 (metrics dashboard) is implemented — same phase

**What:** Remove the SAA (Sleep After Activity) ratio — defined as `sleepDuration / activityTime` — from the metrics dashboard and replace it with a more informative compound factor. The suggested replacement is **day-length / sleep-duration** (`dayLength / sleepDuration`), which expresses how much of the total waking window is backed by the preceding night's sleep.

SAA is mathematically identical to `1 / AAS` (Activity After Sleep = `activityTime / sleepDuration`), so displaying both adds no information. The day-length / sleep-duration ratio captures a different and non-redundant relationship: how long the child stays awake relative to how long they slept — a proxy for sleep pressure that grows as the ratio increases.

**Why:** Presenting two metrics that are algebraic inverses of each other wastes screen space and can confuse users who attempt to interpret both independently. Replacing SAA with a factor that is not derivable from AAS preserves the metric count while adding diagnostic value. A high `dayLength / sleepDuration` ratio may indicate accumulated sleep debt; a low ratio may indicate unusually long naps or early bedtimes.

**Open questions when this gets planned:**

- Should the replacement metric be `dayLength / sleepDuration` specifically, or evaluated alongside other candidates (e.g., `combinedSleep / dayLength`, `activityAfterNap / napDuration`)?
- Should both AAS and the new factor be shown together, or should AAS also be reviewed for redundancy?
- What is a "normal" range for the new ratio — is it stable enough across stages to be interpretable without stage filtering?
- Should the metrics dashboard display a trend indicator (arrow up/down) for this ratio?

**Implementation notes:**

- In `js/lib/metrics.js` `dayMetrics()`: remove or rename the `saa` field; add `dayToSleepFactor: dayLength / sleepDuration` (guard for `sleepDuration === 0`).
- Update `aggregateMetrics()` to compute average/min/max for `dayToSleepFactor` rather than `saa`.
- Update the metrics UI (when B-026 is implemented) to render the new label ("Day/Sleep Factor" or similar).
- Remove any references to `saa` from tests and documentation; add a unit test for the new formula including edge cases (nap day vs. no-nap day, zero sleep guard).

---

### B-035 · Show TIF window bounds (min/max) on the metrics screen

**Source:** ISSUES-AND-IDEAS-08-03.md (2026-08-03)
**Status:** promoted → v1.3 (Phase 14) · not yet planned
**Earliest sensible slot:** after both B-021 (TIF algorithm) and B-026 (metrics dashboard) are implemented

**What:** Display the TIF algorithm's computed prediction window bounds — `finalStart` and `finalEnd` for each event type — on the metrics screen (B-026). For each event type (wake, nap-start, nap-end, bedtime), show the lower and upper bound of the TIF predicted window alongside the other per-day metrics. This gives users a direct view of how wide or narrow TIF's prediction is for the current day, visible in the same place as the sleep and activity metrics.

Example card layout: "Wake: TIF 07:15 – 08:00 · Width: 45 min · Confidence: 87%"

This is distinct from the prediction cards on the Today screen (which show the display window, potentially clipped by `precisionTarget`). The metrics screen would show the raw unclipped `[finalStart, finalEnd]` window so users can see the true algorithmic output.

**Why:** The Today screen prediction cards already show the TIF display window. Exposing the raw window bounds and confidence score on the metrics screen gives users the underlying data that the display window is derived from — useful for understanding when the algorithm has high vs. low certainty, and for validating the `trimPct` and `precisionTarget` settings. Without this, users cannot easily distinguish between a narrow "genuinely tight" prediction and a wide prediction clipped by `precisionTarget`.

**Open questions when this gets planned:**

- Should these bounds appear as a sub-row within each event type's metric section, or as a dedicated "TIF Forecast" card group?
- Should they show only when `forecastAlgorithm === 'tif'`, or always (with a "N/A" state for classic mode)?
- Should the confidence score here be the same score from B-021 Step 4, or a simplified version?
- Should window width be shown in minutes or hours:minutes?
- Interaction with B-031 (TIF accuracy on the Accuracy screen): the metrics screen is about current-day values; the Accuracy screen is about historical backtesting. Confirm there is no duplication of purpose.

**Implementation notes:**

- Requires B-021's `tifForecast()` to return per-event `{ finalStart, finalEnd, confidenceScore }` in its result object (already implied by B-021's implementation notes).
- In the metrics screen renderer (B-026 UI): conditionally render a "TIF bounds" sub-row per event type when `snap.forecastAlgorithm === 'tif'` and TIF predictions are available for the selected day.
- Format `finalStart`/`finalEnd` using the same `formatTime(minutes, timeFormat)` helper used by prediction cards.
- No new data shape changes beyond what B-021 already introduces.

---

## Metrics screen and TIF feature enhancements (captured 2026-08-25)

### B-036 · Add nap-fraction and morning/afternoon-split ratio columns to metrics screen

**Source:** METRICS-SCREEN-GAP.md + PREDICTION-FEATURES.md (2026-08-25)
**Status:** promoted → v1.3 (Phase 14) · not yet planned
**Earliest sensible slot:** v1.2 — pairs naturally with the B-026 metrics dashboard phase; can also ship standalone (~1 hour of work)

**What:** Add two ratio columns that are currently missing from the 14-column metrics table:

1. **Nap fraction** — `napDuration / combinedSleepNap` — what proportion of total sleep the nap represents (0–1 ratio).
2. **Morning/afternoon split** — `activityBeforeNap / activityAfterNap` (MA / AA) — ratio of pre-nap to post-nap wake time; captures asymmetry in how the day is structured around the nap.

Both columns follow the exact same pattern as the existing `activityAfterSleepFactor` (AAS):
- Add a pure helper function to `js/lib/metrics.js`
- Compute the value in `aggregateMetrics()` per-row and in the aggregate pass
- Add a column definition object to `COLUMNS` in `js/ui/metrics-screen.js`

**Why:** These two ratios are identified in PREDICTION-FEATURES.md as useful inputs for predicting nap-end and bedtime respectively. Surfacing them in the metrics table lets users see per-day values and historical averages before the TIF algorithm uses them as windows. See also METRICS-SCREEN-GAP.md.

**Open questions when this gets planned:**

- Column labels: "Nap%" and "AM/PM" or longer forms?
- Should nap-fraction be displayed as a decimal (0.32) or a percentage (32%)?
- For days with no nap, nap-fraction = null (em-dash); morning/afternoon split = null (no AA denominator). Confirm this matches existing no-nap em-dash behaviour.

**Implementation notes:**

- `js/lib/metrics.js`: add `napFraction(day)` = `napDuration / combinedSleepNap` (guard: `combinedSleepNap === 0 || napDuration === null → null`); add `morningAfternoonSplit(day)` = `activityBeforeNap / activityAfterNap` (guard: `activityAfterNap === 0 || either null → null`).
- `aggregateMetrics()`: compute both per-row and in the aggregate `aggregateMetric()` call; use nap-only rows for nap-fraction (same filter as `napDuration`).
- `js/ui/metrics-screen.js`: push two entries into `COLUMNS` with `isRatio: true` and `toFixed(2)` formatting (same as AAS/SAA).
- Unit tests: one test per helper covering nap day, no-nap day, and zero-denominator guard.

---

### B-037 · TIF: use recorded MA/AA as direct inputs and add rolling-window sources

**Source:** PREDICTION-FEATURES.md + user confirmation that MA/AA are direct recorded inputs (2026-08-25)
**Status:** promoted → v1.3 (Phase 13) · not yet planned
**Earliest sensible slot:** after B-021 (TIF algorithm) ships — extends `js/lib/forecast-tif.js`

**What:** Two related improvements to the TIF algorithm that follow directly from PREDICTION-FEATURES.md:

**1 — Prefer recorded MA/AA over derived timestamp differences.**

Currently the TIF algorithm derives activity-before-nap as `napStart − wake` and activity-after-nap as `napEnd − bedtime` from timestamps. The user records MA (morning activity duration) and AA (afternoon activity duration) directly — these may differ from the timestamp difference when events were logged with a delay. When MA/AA are present on a day record, use them as ground-truth inputs instead of computing the gap from timestamps. This makes the window history cleaner and consistent with what the user actually observed.

Concretely: in the activity-before-nap window (TIF nap-start window 2) and the activity-after-nap window (TIF bedtime window 3), pull from the recorded MA/AA field first; fall back to `extractTime(napStart) − extractTime(wake)` only when the recorded value is absent.

**2 — Add rolling-window (7-day, 14-day) variants as additional TIF sources.**

PREDICTION-FEATURES.md identifies rolling averages and std deviations of each interval as the second-highest-priority predictors (after the same-day anchor). Currently TIF uses all-time trimmed min/max for each window. Adding a rolling-window variant (last N days) as an extra source narrows the intersection when recent behaviour differs from the long-term average — useful as a child's schedule shifts with development.

For each existing window that uses historical distributions (e.g. activity-before-nap band, nap-duration band, bedtime band), compute an additional 14-day rolling min/max from the trimmed series. Add it as an extra window in the intersection. This is opt-in via a new setting `tifRollingDays: number | null` (null = disabled; default 14).

**Why:** Recorded MA/AA values are more accurate than derived differences because parents may log events after the fact. Using ground-truth durations for the window history reduces noise in the trimmed min/max. Rolling windows give the algorithm recency bias so it tracks schedule drift as the child grows, which is the dominant source of prediction error over months.

**Open questions when this gets planned:**

- Should the MA/AA field be added to the existing event-log schema (new field per event), or stored as a per-day annotation? The day record already has `.activityBeforeNap` and `.activityAfterNap` fields from `aggregateMetrics` — confirm whether these are stored or always computed.
- Should the rolling window be a hard N-day window, or an exponentially weighted moving average? Hard window is simpler and more interpretable.
- Should `tifRollingDays` be a single setting for all window types, or per-window-type? Single is simpler to start.
- Interaction with B-033 (ratio windows): do the ratio windows also benefit from a rolling variant? Likely yes — defer to the same `tifRollingDays` setting.
- Cold-start: if fewer than `tifRollingDays` days exist, fall back to all-time window (no change in behaviour).

**Implementation notes:**

- **MA/AA preference**: in `forecast-tif.js`, add a `resolveActivityBeforeNap(day)` helper that returns `day.recordedMA ?? activityBeforeNap(day)` (importing `activityBeforeNap` from `metrics.js`). Apply symmetrically for AA. Use these in the window history series builders.
- **Rolling windows**: add `rollingTrimmedMinMax(values, N, trimPct)` helper — takes the last N values from the series before computing `trimmedMinMax`. Slot the rolling window as an additional entry in each event type's window array; the intersection logic is unchanged.
- **Settings**: add `tifRollingDays: number | null` to `DEFAULT_SETTINGS` and the Settings modal (Forecast & Prediction section, TIF sub-group). Guard: show only when `forecastAlgorithm === 'tif'`.
- Unit-test `resolveActivityBeforeNap` with recorded vs. absent MA; unit-test `rollingTrimmedMinMax` with N < series length and N > series length.
