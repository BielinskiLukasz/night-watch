# Backlog: Nightwatch

Ideas and scope items captured outside the active roadmap. Anything here is *not* in v1 — it has either been deferred by explicit decision, surfaced during UAT, or earmarked for a later milestone. Items graduate to a `ROADMAP.md` phase when picked up (`/gsd-review-backlog` to promote, `/gsd-phase add` to materialize).

Last updated: 2026-07-12 (cleanup: removed B-09, B-16, B-23, B-24 — shipped or stale; fixed B-28/B-29/B-30 formatting; B-21 fully specified as TIF algorithm; B-26 expanded with ratio metrics)
Last assigned ID: **B-30** — next new item must be **B-31**

---

## UX-polish bundle (captured during Phase 2 UAT, 2026-05-28)

These three items are complementary friction-reduction wins for one-handed, in-the-dark logging. They should probably ship together in a dedicated UX-polish phase between Phases 4 and 8, or folded into Phase 8 (PWA & Platform Hardening) since theming and mobile-first picker UX are presentation-layer work.

### B-01 · Per-event-type default times in manual-entry

**Source:** memory `project_idea_event_type_default_times.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands first) — or as a Phase 8 sub-plan

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

### B-02 · Friendly hour picker (clock-face / wheel / tap-grid)

**Source:** memory `project_idea_friendly_hour_picker.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX-polish milestone, paired with B-01

**What:** Replace the manual-entry HH/MM number inputs (and the 12h AM/PM select from Plan 02-06) with a visual picker — analog clock-face, wheel/scroll, or tap-grid of common times. One tap per axis, works one-handed in the dark.

**Why:** Number inputs open the numeric keyboard but still require focus → tap → tab. A clock-face / wheel / grid is one tap per axis. Same "minimize friction" rationale as B-01 — they're complementary.

**Open questions when this gets planned:**

- Analog clock-face vs. wheel/scroll vs. tap-grid — which wins one-handed in the dark?
- Should the picker show B-01's smart default preselected, or always start at current time?
- A11y: a clock-face is hard for screen readers. Keep a number-input fallback behind a feature flag or "advanced" toggle.
- Mobile-first vs. desktop parity — the spreadsheet workflow this replaces was desktop; the PWA install target is mobile.

**Constraints to respect:**

- 5-min rounding rule (CLAUDE.md) — clock-face snaps naturally.
- No build step, no frameworks — vanilla CSS + JS. CSS `conic-gradient` clock with `<button>` children per hour is feasible; same for a 12-tap minute grid.
- Must stay testable in Playwright — current spec hits `input[name="hour"]` etc.; a picker rewrite needs `data-testid` selectors or equivalent test surface.
- Internal storage stays canonical 24h ISO (D2-20 invariant).
- `timeFormat` 12h vs 24h still toggles the picker surface, but the picker is now clock/wheel, not HH/AMPM number inputs.

---

### B-03 · Dark mode with manual + hour-based auto-switch

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

### B-04 · Time-based bedtime rule

**Source:** user input (2026-06-04)
**Status:** captured · not scheduled
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

### B-05 · Duration-based prediction

**Source:** user input (2026-06-04)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 3, paired with B-04 as a refinement bundle

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

### B-06 · Intense day checkbox

**Source:** user input (2026-06-04)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — or bundled with B-04 & B-05 if kept together

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

### B-07 · Missing nap impact on bedtime

**Source:** user input (2026-06-04)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 3, with B-04 & B-05 as a prediction-refinement bundle

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

### B-08 · Cold-start message formatting polish

**Source:** Phase 03-05 user verification checkpoint (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** Phase 8 (PWA & Platform Hardening) — typography polish

**What:** The cold-start message ("Not enough data yet. Log N more days to see predictions.") wraps to multiple lines in some viewport widths. Reformat or apply CSS constraints to keep it single-line or improve visual spacing.

**Why:** The message is functionally correct but could look more polished on mobile. Phase 8 is the platform hardening and theming phase where this kind of typography work naturally lands.

**Implementation notes:**

- CSS: constrain message width, adjust font size for mobile, or reword to be shorter.
- No data model or algorithm changes.

---

### B-10 · Prediction cards on-demand toggle (optional UX)

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

### B-11 · Probability-band fallback E2E test with realistic fixture data

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

### B-12 · History and support for multiple naps per day

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

### B-13 · Undo edit/delete/add of the last event

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

### B-14 · Redo undone actions

**Source:** user input (2026-06-05)
**Status:** captured · not scheduled
**Earliest sensible slot:** paired with B-13 (undo/redo typically ship together)

**What:** Complement the undo feature (B-13) with a redo button/keystroke to restore the undone change (Ctrl+Y or Cmd+Shift+Z convention).

**Why:** Undo/redo is a pair; users expect both. If they undo a delete by mistake, they need to redo it without re-entering.

**Open questions when this gets planned:**

- Single-step redo or full stack? (Likely same scope as B-13.)
- Same keyboard shortcut convention as B-13?
- Should redo be greyed out when the undo stack is empty?

**Implementation notes:**

- Pair with B-13's undo stack: store both the current and the reverted state.
- Restore the most recent undone change on redo.
- UI: add redo button or shortcut in the same location as undo (B-13).

---

## Tab navigation and bulk-add UX (captured 2026-06-06)

These two items improve the Today screen and introduce a new Events screen for browsing historical logs with filtering options, plus a batch-add workflow for data import.

### B-15 · Three-tab navigation: Today | Events | History

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

### B-17 · Nap length chart (like Sleep Length)

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

### B-18 · Invert time axis in Wake & Bedtime Bands chart

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

### B-19 · Nap Start and Nap End time-band scatter (Chart 2 extension)

**Source:** user input (2026-06-30)
**Status:** captured · not scheduled
**Earliest sensible slot:** paired with B-18 — both extend the Wake & Bedtime Bands chart

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

### B-22 · Heatmap cell rich tooltip (custom popover)

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

## Prediction algorithm (specified 2026-07-12)

### B-21 · Trimmed Intersection Forecast (TIF) algorithm

**Source:** user input (2026-06-30, fully specified 2026-07-12)
**Status:** captured · not scheduled — **target: v1.2**
**Earliest sensible slot:** v1.2 milestone — replaces or runs alongside the Phase 3 forecaster

**Algorithm name:** Trimmed Intersection Forecast (TIF). Suggested module: `js/lib/forecast-tif.js`, same return shape as `js/lib/forecast.js` so it slots in as an alternate strategy.

---

**Step 1 — Percentile trim (configurable)**

User configures a trim percentage `trimPct` in Settings (e.g. 10 means "remove 10% of extreme values"). For each event type independently:

- Count total events in history: `N`
- Count manually excluded events already removed: `manualExcluded`
- Remaining auto-trim budget = `floor(N × trimPct / 100) − manualExcluded` (minimum 0)
- Split budget symmetrically: remove the earliest `floor(budget / 2)` and latest `ceil(budget / 2)` events
- This trim is applied **per event type**, not per day — a day is only fully excluded if all its event types are trimmed away

Example: 10% of 500 events = 50 to trim. 20 already manually excluded → auto-trim 30 more (15 earliest, 15 latest).

---

**Step 2 — Multi-source windows and intersection**

For each event type, the algorithm computes several independent **windows** (a min and a max time, in minutes-from-midnight). Then it combines them into one final range:

- **Final start** = `max` of all window starts (latest of the lower bounds)
- **Final end** = `min` of all window ends (earliest of the upper bounds)

This is the intersection: the region where **all** windows agree the event could occur.

If intersection is empty (start > end), fall back to the union (min of starts, max of ends) and flag a "low confidence" state.

Excluded events (manual + auto-trim) are not included in any window calculation.

---

**Step 3 — Windows per event type**

For each window that derives from a duration metric (sleep length, nap length, etc.), that metric is also subject to the same percentile trim independently before its min/max is computed.

**Anchor rule:** when computing a derived window, the algorithm needs an anchor time (the "other endpoint"):
- If the anchoring event **is** the latest logged observation → use its actual logged time
- If the anchoring event **has not been logged yet** → use the midpoint (average) of that event's own TIF prediction

**Wake-up windows:**
1. **Historic wake-up band** — min and max of trimmed historic wake times
2. **Sleep-length band** — trimmed min/max of night-sleep duration; project onto wake time using `bedtime_anchor + [minSleep, maxSleep]` where `bedtime_anchor` follows the anchor rule above
3. **Sleep + same-day nap combined band** — trimmed min/max of (night-sleep + nap duration for that day); project onto wake time using the same `bedtime_anchor`

**Nap-start windows:**
1. **Historic nap-start band** — min and max of trimmed historic nap-start times
2. **Activity-before-nap band** — trimmed min/max of (nap-start − wake) durations; project onto nap time using `wake_anchor + [minActivity, maxActivity]` where `wake_anchor` follows the anchor rule

**Nap-end windows:**
1. **Historic nap-end band** — min and max of trimmed historic nap-end times
2. **Nap-length band** — trimmed min/max of nap durations; project onto nap-end using `napStart_anchor + [minNap, maxNap]` where `napStart_anchor` follows the anchor rule

**Bedtime windows:**
1. **Historic bedtime band** — min and max of trimmed historic bedtime times
2. **Day-length band** — trimmed min/max of day length (wake → bedtime); project onto bedtime using `napEnd_anchor + [minDay − napDuration, maxDay − napDuration]` — or more simply: `wake_anchor + [minDayLength, maxDayLength]`
3. **Activity-after-nap band** — trimmed min/max of (bedtime − nap-end) durations; project onto bedtime using `napEnd_anchor + [minActivityAfterNap, maxActivityAfterNap]`

**Additional windows to consider (suggested for planning):**
- **Wake-up**: activity-after-sleep factor band — trimmed min/max of `activityTime / sleepDuration`; if this ratio is stable, it can constrain wake time given a known bedtime
- **All event types**: stage-scoped window — compute the same historic min/max but filtered to only events within the current active stage; useful when behaviour changed significantly at stage transitions
- **All event types**: rolling-window variant — last 14 or 30 days only, weighted against the all-time window (gives the algorithm recency bias as the child grows)
- **Bedtime**: combined sleep+nap band — trimmed min/max of `sleepDuration + napDuration` per day; project onto bedtime from wake anchor (complements day-length band with nap context)

---

**Step 4 — Precision scoring and display**

User configures a `precisionTarget` in minutes (e.g. 60 = ±30 min window, or explicitly a window width).

Let `algRange = finalEnd − finalStart` (in minutes).

**Metric (confidence score):**
- If `algRange ≤ precisionTarget` → score = 100%
- If `algRange > precisionTarget` → score = `precisionTarget / algRange × 100%`

**Display window:**
- If `algRange ≤ precisionTarget` → show the algorithm's window as-is
- If `algRange > precisionTarget` → compute center = `(finalStart + finalEnd) / 2`; display `center − precisionTarget/2` to `center + precisionTarget/2`; show the confidence score alongside

---

**Why:** The spreadsheet workflow applies systematic exclusion of outliers and uses multiple independent timing anchors (sleep length, activity time, nap length) to triangulate predictions rather than relying on a single hour-of-day distribution. The TIF algorithm codifies these heuristics explicitly, makes them configurable, and adds a precision metric so users can see how confident the algorithm is in its own output.

**Open questions when this gets planned:**

- Should TIF **replace** the Phase 3 forecaster or run alongside it as an opt-in mode? Opt-in toggle in Settings is the safer v1.2 path.
- Empty intersection fallback: union with a "low confidence" flag, or show all individual windows separately?
- Should `trimPct` be a single global setting or per-event-type?
- Should `precisionTarget` be expressed as a window width (minutes) or a ±half-width (minutes each side)?
- Stage-scoped and rolling-window variants: build in from the start or add in a later iteration?
- How should the algorithm behave on cold-start (fewer than N days of data)? Disable trim? Use wider precision band?
- Should the confidence score appear on the prediction cards, the hero card, or both?

**Implementation notes:**

- New module `js/lib/forecast-tif.js` — pure function `tifForecast(eventLog, settings)` → same return shape as `forecast.js`
- Settings additions: `trimPct: number` (0–40, step 1, default 10), `precisionTarget: number` (minutes, default 60), `forecastAlgorithm: 'classic' | 'tif'` toggle
- Depends on `js/lib/metrics.js` (B-26) for duration calculations (sleepDuration, napDuration, activityBeforeNap, activityAfterNap, dayLength, combined)
- Percentile trim helper: `trimmedMinMax(values, trimPct, manualExcludedCount)` → `{ min, max }`; reusable across all window types
- Anchor resolution helper: `resolveAnchor(eventType, eventLog, tifPredictions)` → actual logged time or midpoint of TIF prediction for that type
- Unit-test each window builder independently; integration-test the intersection logic with known fixtures; E2E-test that TIF prediction cards render when the toggle is enabled

---

## More charts and sleep-length calculation audit (captured 2026-07-03)

### B-25 · More diagrams + verify sleep length calculation

**Source:** user input (2026-07-03)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 / v1.1 — extends charts-screen.js

**What:** Two related tasks:

1. **Audit the sleep-length calculation** used in `buildSleepLengthSeries` (chart-data.js) and the Sleep Length chart (charts-screen.js): confirm the formula is `bedtime.at − wake.at` (accounting for the subjective-night cutover), matches the spreadsheet's `Długość snu` column, handles midnight-crossing correctly, and excludes rejected days. Fix any discrepancy.

2. **Add more chart types** to the Charts screen, building on the existing five visualizations. Candidates (to be prioritised during planning):
   - **Sleep duration histogram** — distribution of night-sleep lengths (binned by 15–30 min intervals); reveals modal and tail behaviour better than the line chart.
   - **Nap-length line chart** — time series of nap duration (see also B-17); mirrors Sleep Length chart structure.
   - **Bedtime vs. wake-time scatter** — cross-axis scatter to see if later bedtimes correlate with later wakes; requires two-axis layout.
   - **Rolling-average overlay** — add a 7-day rolling mean line to the Sleep Length chart so short-term noise is visually separated from the trend.
   - **Stage-boundary annotations** — vertical lines at stage transitions on the Sleep Length and Time Bands charts; users already define stages but cannot see them on charts.

**Why:** The Sleep Length chart is the most prominent visualization in the app — if its formula is wrong (e.g., using calendar midnight instead of the subjective cutover, or not excluding rejected days), every user decision built on it is suspect. The audit is a prerequisite for trusting the chart output. Additional chart types increase the diagnostic power of the Charts screen, especially for parents trying to detect regressions or confirm stage transitions.

**Open questions when this gets planned:**

- What is the exact formula in `buildSleepLengthSeries`? Does it use `bedtime.at - wake.at` or `wake.at + 24h - bedtime.at` for nights that cross midnight?
- Does it correctly scope to the stage's data when `activeStageId` is set?
- For the histogram and rolling-average overlay: should they appear as sub-sections or replace/extend section 1 (Sleep Length)?
- Which additional charts are highest priority — let user rank before planning begins.

**Implementation notes:**

- Audit: read `js/lib/chart-data.js` `buildSleepLengthSeries`, compare against `js/lib/day-bucket.js` day-length derivation and the spreadsheet's `Długość snu` column (PROJECT.md Context). Write a unit test that pins the formula with known inputs including midnight-crossings and rejected days.
- New charts: each follows the existing pattern in `charts-screen.js` — `buildXxx(days)` in chart-data.js + `renderXxxChart(sectionEl, days, snap)` in charts-screen.js + a new `sectionN` div in `mountChartsScreen`. Unit-test the data transform; E2E-test that the chart section renders.
- Stage-boundary annotations: require passing `stages` and `activeStageId` to the render functions (not currently threaded through all chart renderers).

---

### B-26 · Calculated sleep & activity metrics dashboard

**Source:** user input (2026-07-03, extended 2026-07-12)
**Status:** captured · not scheduled — **target: v1.2**
**Earliest sensible slot:** v1.2 milestone — dedicated Metrics phase

**What:** Add a new metrics display section (cards, table, or dedicated screen) that shows calculated daily and historical sleep/activity statistics:

**Daily metrics (per day):**
- Sleep duration (night sleep: bedtime → wake, in hours:minutes)
- Nap duration (nap-end − nap-start, in hours:minutes)
- Day length (wake → next bedtime — total waking window, in hours:minutes)
- Activity time = day length − nap duration (non-sleep, non-nap awake time)
- Activity before nap (wake → nap-start)
- Activity after nap (nap-end → bedtime)
- Sleep + nap combined for current day (total rest: night sleep + nap)
- Sleep + nap combined for previous day (carry-forward for same-day context)

**Ratio / factor metrics:**
- Activity-after-sleep factor = activity time ÷ sleep duration (how much activity relative to the preceding night's sleep)
- Sleep-after-activity factor = sleep duration ÷ previous day's activity time (how much night sleep relative to prior activity)

**Historical aggregates (weekly, monthly, or full history):**
- Average sleep duration, nap duration, combined duration, activity time
- Min/max sleep and nap durations (with dates)
- Average before-nap and after-nap activity windows
- Average and range of ratio metrics

**Why:** These metrics are derived from the existing event log but not currently surfaced in the app. Parents need these values to:
- Track whether a child's sleep quantity is improving/regressing
- Understand the balance between night sleep and naps
- Detect when activity periods extend beyond normal
- Validate stage transitions (e.g., "when nap duration dropped below 30 min, we switched to single-nap stage")
- Spot correlations between previous-day activity and next-night sleep quality

Today these calculations are done mentally or in the spreadsheet; exposing them as real-time values removes friction from decision-making.

**Open questions when this gets planned:**

- Should metrics appear on the History screen (as totals per row), the Charts screen (as a summary card), or a new dedicated Metrics tab?
- Which metrics are highest priority — full set or a curated subset?
- Should metrics be filterable by date range or stage?
- For ratio metrics: should the app highlight anomalies (e.g., "activity factor 2× your average today")?
- Should metrics include percentiles (e.g., "nap 45 min today; typical range is 40–60 min based on stage history")?
- Should the previous-day carry-forward metrics (sleep + prev-day nap, sleep-after-activity factor) reference calendar-day boundaries or sleep-cycle boundaries (cutoverHour)?

**Implementation notes:**

- Data transforms: add calculation functions to `js/lib/day-bucket.js` or a new `js/lib/metrics.js`:
  - `dayMetrics(day, prevDay?)` → returns object with all duration and ratio fields above
  - `aggregateMetrics(days)` → returns averages, min/max, percentiles
- UI: render as a card grid (each metric = one card with value + trend arrow/color) or a summary table
- Ratio metrics need `prevDay` passed to `dayMetrics` — requires looking back one record in the sorted day list
- Interaction with stages: pass `activeStageId` to metric functions so aggregates reflect only the current stage's data when requested
- No data shape changes — all computed from existing events

---

### B-27 · Additional chart types: sleep & nap combined, activity histograms

**Source:** user input (2026-07-03)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 7 / v1.1 — extends charts-screen.js, paired with B-25 and B-26

**What:** Expand the Charts screen with visualization types that pair or combine the existing event-duration data:

1. **Sleep + Nap combined duration line chart** — stacked or overlaid line showing total rest time per day (sleep duration + nap duration). Useful for spotting days when total rest drops below normal.

2. **Nap duration distribution histogram** — binned histogram of nap lengths (15–30 min buckets) showing which nap durations are most common; complements the existing Sleep Length histogram (B-25).

3. **Activity time histogram** — distribution of awake time (bedtime → wake) to spot whether activity periods vary widely or cluster.

4. **Before-nap activity scatter** — plot wake-to-nap-start gap (X-axis: date, Y-axis: minutes) to see if pre-nap activity is stable or drifts. Overlaid with rolling average (B-25 concept).

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

### B-28 · Reorder event-type list in Add Event (bedtime last)

**Source:** user input (2026-07-10)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands) — or bundled with B-01/B-02 in UX-polish milestone

**What:** Change the order of event types shown in the Add event popup so that bedtime appears last. Current order places bedtime earlier, which is unintuitive during rapid logging — bedtime is typically the final event of the day and should be visually last in the list.

**Why:** Parents logging events in real time expect bedtime to be the final option. Placing it last reduces cognitive friction and aligns with natural daily flow. This is especially helpful during one-handed, in-the-dark logging.

**Open questions when this gets planned:**

- Should the new order be static or configurable in Settings?
- Should the order adapt dynamically based on recent history?
- Interaction with B-01 (default times): does reordering affect which default time is preselected?

**Implementation notes:**

- Update event-type list in `manual-entry.js` and `quick-log.js`.
- If event types are generated from a shared constant, reorder the array or introduce a `sortOrder` field.
- Ensure Playwright tests referencing event-type order are updated or made order-agnostic.
- No data model changes.

---

### B-29 · Reorder prediction cards (bedtime last)

**Source:** user input (2026-07-10)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX polish milestone — or paired with B-30 (hero card missed-time flag)

**What:** Change the order of the four prediction cards so that bedtime prediction appears last. Current order mixes wake/nap/bedtime in a way that doesn’t match the user’s mental model — bedtime is the final event of the day and should be visually last.

**Why:** Prediction cards are scanned quickly. Users expect bedtime to be the final card, mirroring the natural daily sequence. This improves readability and reduces misinterpretation.

**Open questions when this gets planned:**

- Should the order be strictly chronological (wake → nap-start → nap-end → bedtime)?
- Should the hero card remain independent of this order?
- Interaction with B-10 (on-demand toggle): does reordering affect reveal order?

**Implementation notes:**

- Update card rendering order in `renderForecastSection()`.
- If predictions are keyed by event type, introduce a stable sort order (e.g., `sortOrder: { wake: 1, napStart: 2, napEnd: 3, bedtime: 4 }`).
- Ensure probability-band colors and labels remain consistent after reordering.
- No changes to prediction algorithm — purely presentation-layer.

---

### B-30 · Show “missed time” indicator only in hero prediction card

**Source:** user input (2026-07-10)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX polish milestone — or bundled with B-07 (missing nap impact on bedtime)

**What:** Restrict the “missed time” indicator so that it appears only in the hero prediction card (the main “Next Predicted Event” card). The indicator should not appear on the four secondary prediction cards. Hero card = single source of truth for contextual flags.

**Why:** Users scan the hero card first and rely on it as the authoritative summary of what’s happening today. Showing “missed time” on all prediction cards creates noise and dilutes the meaning of the flag. Keeping it exclusively in the hero card improves clarity and reduces cognitive load.

**Open questions when this gets planned:**

- Should the hero card show a short text (“Missed time today”) or an icon/badge?
- Should the indicator affect the hero card’s color scheme or only appear as metadata?
- Interaction with B-07 (missing nap detection): should the missed-time flag appear next to the label or inside the card body?
- Should the missed-time flag also appear in the Today tab header (optional)?

**Implementation notes:**

- Add conditional rendering inside `renderNextEventCard()` only.
- Remove missed-time flag from the prediction-card renderer (`renderForecastSection()` or equivalent).
- Ensure the forecaster still computes the missed-time condition (B-07), but presentation-layer decides where it is shown.
- No changes to prediction algorithm or data shape — purely UI logic.

---

## How to use this file

- **Adding an item:** increment the "Last assigned ID" counter at the top, then drop a new `### B-NN` block with Source / Status / Earliest slot / What / Why / Open questions / Implementation notes. IDs are monotonic and never reused — even if the previous entry was promoted or removed.
- **Promoting an item:** `/gsd-review-backlog` (interactive) — moves a chosen item into the active milestone roadmap. Or manually run `/gsd-phase add` and reference the backlog ID in the phase description.
- **Removing an item:** delete the block or move it under a `## Rejected` heading with a one-line rationale (decisions cost; keep the rationale).
- **Memory ↔ backlog:** memory captures "this idea exists and here's the context"; this file is the project-level decision queue. Memory is the source for cross-session continuity; this file is the source for milestone planning. Update both when an item lands.

## Related

- `ROADMAP.md` — active milestone phases
- `milestones/v1.0-REQUIREMENTS.md` — v1.0 archived requirements (all 51 complete)
- `PROJECT.md` — core constraints (single subject v1, no build step, no frameworks)
- `CLAUDE.md` — v1/v2 split rules

