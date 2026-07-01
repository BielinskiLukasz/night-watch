# Phase 3: Forecast Engine & Today Screen - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The user lands on the "Today + Forecast" screen and sees:
1. A prominent **"next event" card** surfacing the single most imminent sleep event
2. Four **prediction cards** (wake, bedtime, nap start, nap end) each showing a central predicted time plus a min/max confidence band
3. **Cold-start gating**: when history is less than `minDays`, an explicit message replaces predictions
4. **Reactive updates**: all predictions re-run immediately when the user logs a new event or toggles a day as rejected
5. **High-uncertainty fallback**: when ±delta exceeds `maxDelta`, the prediction card switches to a probability-band view (P(event by time T) = X%)

This phase introduces the forecast algorithm — the core value of the app — and establishes the real-time calculation + subscriber pattern that every later phase (History edits, Stages, Charts) will hook into.

Phase 3 does NOT include:
- Full History screen with edit/delete per-day affordances (Phase 4)
- Charts, heatmap, or accuracy metrics (Phase 7)
- Manual stage boundaries (Phase 6)
- Import/export (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Forecast Algorithm

- **D3-01: Empirical CDF for confidence bands.** The min/max band is calculated
  as the 10th and 90th percentiles of the rolling window of past events of that
  type. E.g., if the past 7 days' wake times sort as [06:30, 06:35, 06:40,
  06:45, 06:50, 06:55, 07:00], the 10th percentile ≈ 06:31 and the 90th
  percentile ≈ 06:59. This approach:
  - Makes no assumptions about distribution shape (robust to bimodal or
    skewed data, which is common in child sleep during developmental transitions)
  - Works well on small windows (7 days is the default; percentiles are
    stable at that sample size)
  - Is transparent to users (they can mentally verify "yes, my kid usually
    wakes between these two times")

- **D3-02: Window length defaults to Phase 2's `windowDays` setting (default 7
  days).** The planner passes `settings.get().windowDays` to the forecast
  function. If there are fewer than `windowDays` available days in history,
  use all available days (no padding or synthetic data).

- **D3-03: Rejected days are downweighted at 0.5x in percentile calculation.**
  When computing the 10th–90th percentiles, each rejected-day event counts as
  0.5 samples instead of 1.0. E.g., 7 days with 2 rejected = 6 effective
  samples for percentile math. This preserves the rejected data (useful for
  understanding outliers) while reducing its influence on the forecast.

- **D3-04: Probability-band fallback on high uncertainty.** When the
  confidence-band width (90th - 10th percentile) exceeds `maxDelta`, the
  prediction card switches UI modes:
  - Instead of "central time ± band", show a cumulative probability table
  - E.g., "P(wake by 06:30) = 20% | P(wake by 06:45) = 50% | P(wake by 07:00) = 85%"
  - Time points are 5-minute-aligned and cover the full percentile range
  - This surfaces uncertainty honestly instead of claiming false precision

- **D3-05: Central prediction is the median (50th percentile) of the window.**
  Not the mean. The median is robust to outliers and matches the Phase 2
  default `statBlend: 'median'`. (Variance-based statistics and user-choice
  of blend method are deferred to Phase 7.)

- **D3-06: Cold-start gate at `minDays`.** When the number of valid
  (non-rejected) days in history is less than `settings.get().minDays`
  (Phase 2 default: 7), the forecast cards are hidden and replaced with an
  explicit message: "Not enough data yet. Log 5 more days to see predictions."
  The message updates reactively as new events are logged.

### Today Screen Layout

- **D3-07: Hero card layout.** The screen structure (top to bottom) is:
  ```
  [Header: subject name + settings gear]
  [Quick-log buttons: Woke up | Sleep | Nap start | Nap end]
  [NEXT EVENT card — large, prominent (see D3-10)]
  [Four forecast cards grid: Wake | Bedtime | Nap-start | Nap-end]
  [Today's event list (day-grouped, calendar view per Phase 1 D-11)]
  ```
  The "next event" card acts as the in-app notification (UI-02) and is the
  first thing a parent sees on landing.

- **D3-08: Prediction card anatomy:** Each of the four forecast cards displays:
  - Event type (wake / bedtime / nap start / nap end)
  - Central predicted time (HH:MM, respecting Phase 2's `timeFormat` setting)
  - Min/max band (HH:MM on each end)
  - OR, if high-uncertainty fallback is active: probability table
  All times are 5-minute-aligned.

- **D3-09: Cold-start UI.** When `minDays` gate is active (not enough history):
  - The four forecast cards are not rendered
  - In their place, a centered message: "Not enough data yet. Log N more days to
    see predictions." (where N = `minDays - validDayCount`)
  - Quick-log buttons are still visible and active
  - The message updates in real-time as the user logs events

### Next Event Selection & Tie-Breaking

- **D3-10: Cycle-aware priority for "next event" selection.** When multiple
  events are equally close (or within a small delta), the "next event" card
  prioritizes based on the sleep cycle — the most recently logged event
  determines what comes next:
  ```
  Last event = bedtime    → priority: wake > nap-start > nap-end > bedtime
  Last event = wake       → priority: nap-start > bedtime > nap-end > wake
  Last event = nap-start  → priority: nap-end > bedtime > wake > nap-start
  Last event = nap-end    → priority: bedtime > wake > nap-start > nap-end
  ```
  Within each priority tier, the earliest-by-central-time prediction wins.
  This captures the natural sleep cycle (wake → (nap) → bedtime → wake) and
  feels intuitive to the user.

- **D3-11: "Missed" predictions are grayed out.** If a forecast's central time
  is in the past (e.g., forecasted wake at 07:00 but it's 07:15), the card is
  grayed/dimmed and labeled "Missed by 15min". The card remains visible for
  accuracy reflection and debugging, but is visually de-emphasized. **Note for
  review:** This behavior should be re-evaluated in Phase 7 or Phase 8 when
  end-of-day reflection and accuracy-dashboard patterns are clearer.

### Reactive Updates

- **D3-12: Forecast re-runs on every event log and rejected-flag toggle.**
  Whenever `eventLog.addEvent()` or `eventLog.editEvent()` completes, the
  forecast calculation is triggered and all four prediction cards + the next-
  event card are re-rendered. Same on `settings.update()` when the user toggles
  a day's `rejected` flag (Phase 4 will wire this). No debounce or batching in
  Phase 3; profile in dogfooding if re-render frequency becomes a performance
  issue.

- **D3-13: Forecast state is derived from event-log + settings.** The forecast
  function is pure: `forecast(days, settings) → { wake, bedtime, napStart,
  napEnd }` where each prediction is `{ central, min, max, probabilityBand? }`.
  The Today screen subscribes to both eventLog and settings and calls forecast()
  whenever either changes. No separate forecast cache or store in Phase 3;
  compute-on-demand is fast enough for 7-365 days of data.

### Testing & TDD Discipline

- **D3-14: Forecast algorithm is pure logic; tested via unit tests.** The
  `js/lib/forecast.js` (or similar) module exports pure functions:
  - `calculatePercentiles(times, p10, p90) → { min, max }`
  - `selectCentralTime(times) → time` (median)
  - `downweightRejectedDays(dayRecords, weight) → adjustedArray`
  - `predictNextEvent(dayRecord, settings) → prediction`
  - Top-level: `forecast(days, settings) → ForecastResult`
  Each function has unit tests asserting correctness on synthetic data, edge
  cases (empty window, single day, all rejected), and Phase 2's `statBlend`
  enum values.

- **D3-15: Integration tests exercise the Today screen + forecast update flow.**
  Wiring a settings store, event log, and the forecast function together;
  asserting that logging a new event triggers a forecast recalculation and
  the new prediction is visible.

- **D3-16: E2E tests verify the user-visible forecast cards.** Playwright tests
  that:
  - Land on Today, see cold-start message when < minDays
  - Log 7 events on different days, then land on Today and see four prediction
    cards with times + bands
  - Log a new event via quick-log button, and the forecast cards update in
    real-time
  - Hover/tap a prediction card and see the full time band (if mobile-specific
    affordance is added)

### Claude's Discretion

- **Percentile threshold choice (10th–90th vs 5th–95th vs custom):** The
  discussion settled on 10th–90th as a reasonable default. The planner may
  adjust if analytics or dogfooding suggest a tighter or wider default band.

- **Probability-band time granularity:** Should time points be 5 min, 10 min,
  or 15 min apart in the P(event by T) table? The planner picks the granularity
  that balances readability (not too many rows) with detail. 5 min is the
  app's native precision; 10–15 min may be more readable for a small card.

- **Tie-breaking epsilon:** When two events are "equally close" in D3-10, what
  counts as "equal"? Should we use ±5 min, ±10 min, or exact-tie only? The
  planner sets a reasonable threshold; 5 min matches the app's 5-minute
  precision.

- **"Missed" styling details:** CSS color/opacity/icon for the grayed-out card
  and the "Missed by Xmin" label. Should match the calm/minimal aesthetic from
  Phase 1.

- **Performance profiling:** If the forecast re-run on every event log causes
  jank (janky re-renders, slow UI response), the planner may introduce
  debounce or memoization. But start with naive compute-on-demand.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — full project context, constraints, key decisions.
  Specifically relevant: core value (prediction), constraints (vanilla JS, no
  dependencies, 5-minute precision), and the sleep-cycle day-boundary model.

- `.planning/REQUIREMENTS.md` — Phase 3 requirements PRED-01..07, UI-01, UI-02.
  Traceability table maps each requirement to Phase 3.

- `.planning/ROADMAP.md` § Phase 3 — phase boundary, success criteria, depends
  on Phase 2.

- `CLAUDE.md` — repo-level conventions (Object.freeze configs, 5-minute
  precision, no dependencies, REQ-IDs in commits, TDD discipline).

### Phase 1 & 2 Decisions (load-bearing)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — Decisions D-01 through
  D-22. Phase 3 builds directly on:
  - D-04: Canonical JSON shape (version 2, settings + events)
  - D-06: Layered module structure (`js/lib/`, `js/store/`, `js/adapters/`,
    `js/ui/`)
  - D-07: Adapter seams (storage, clock, DOM) for testability
  - D-08: Two day-grouping views (calendar and subjective-night);
    Phase 3 uses `daysBySubjectiveNight()` as the input to forecasts
  - D-18 & D-19: Cutover-hour parameter and default
  - D-19–D-22: Testing scaffold (unit + integration + E2E, TDD discipline)

- `.planning/phases/NW-02-configuration-settings/02-CONTEXT.md` — Decisions
  D2-01 through D2-27. Phase 3 consumes:
  - D2-03: DEFAULT_SETTINGS with Phase 2 defaults (cutoverHour=4, windowDays=7,
    statBlend='median', maxDelta=30, minDays=7, autoOutlier=false)
  - D2-04: Settings persisted in `db.settings` within the `nightwatch:db` blob
  - D2-07: `createSettingsStore()` API (get, update, subscribe)
  - D2-08: Settings and event-log share one storage adapter

### Source code (Phase 1 & 2 — integration points)

- `js/store/event-log.js` — exposes `daysBySubjectiveNight(cutoverHour,
  limit)`. Phase 3's forecast function takes the output of this as input.

- `js/store/settings.js` — Phase 3 subscribes to settings changes and passes
  `settings.get()` into the forecast function.

- `js/app.js` — composition root. Phase 3 wires the new forecast function
  here and threads it into the Today screen.

- `js/ui/today-screen.js` — Phase 1 rendered quick-log buttons + day list.
  Phase 3 extends this with the forecast cards, next-event card, and
  cold-start gating. Subscribes to both eventLog and settings.

- `index.html` — Phase 2 added the header strip. Phase 3 adds the forecast
  card container (grid or flexbox layout for the four cards + next-event card).

- `style.css` — Phase 3 adds styling for prediction cards, probability bands,
  and the hero next-event card layout.

- `tests/` structure — Phase 1 & 2 established unit + integration + E2E test
  trees. Phase 3 adds tests under `tests/unit/forecast.test.js`,
  `tests/integration/forecast-flow.test.js`, and `tests/e2e/forecast.spec.js`.

### Reference implementations

- `../mindful-breathing/` — vanilla PWA patterns, `Object.freeze` config,
  modal mechanics, calm styling register (relevant for Phase 8, but Phase 3
  may look for subscriber/reactive-update patterns).

### Domain / sleep science

- User's existing spreadsheet (`sen.xlsx`) — the Phase 1 context document
  translates the Polish column schema. The forecast algorithm implicitly
  validates against the user's manual tracking patterns (e.g., 7-day rolling
  windows match their spreadsheet workflow).

No additional external specs or ADRs exist yet. Decisions D3-01..D3-16 above
are the authoritative source for Phase 3's forecast algorithm and UI design.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`daysBySubjectiveNight(events, cutoverHour, limit)`** from `js/lib/day-bucket.js`
  — The forecast function takes its input from this: an array of day records,
  each with slots for `wake`, `bedtime`, `napStart`, `napEnd` and a list of
  `allEvents`. Phase 3's forecast algorithm extracts times from these slots and
  calculates predictions. No changes to the bucketer needed.

- **Settings store (`createSettingsStore()`)** from `js/store/settings.js`
  — Phase 3 reads `maxDelta`, `minDays`, `windowDays`, and `statBlend` via
  `settings.get()` and subscribes to changes so the forecast re-runs when the
  user edits settings.

- **Modal dialog + form patterns** from Phase 1 & 2
  — The prediction cards are display-only (no form), but the same `<dialog>`
  pattern and subscriber callbacks could be reused if future phases add
  forecast-tuning interactions.

- **Time formatting helpers** from `js/lib/time.js` and Phase 2's
  `js/lib/time-format.js` (or similar)
  — Forecast times respect Phase 2's `timeFormat` setting (24h vs 12h). Reuse
  `formatTime(at, timeFormat)` in the forecast card renderer.

### Established Patterns

- **Pure-logic modules with adapter seams** — The forecast algorithm (D3-14)
  should be a pure function that takes day records and settings, returns
  predictions. No side effects, no dependency on DOM or storage. Matches Phase
  1's pattern from `js/lib/day-bucket.js` and `js/lib/time.js`.

- **Subscriber pattern for reactive updates** — Phase 2 established
  `settings.subscribe(fn)` for reactive re-renders. Phase 3 extends this:
  Today screen subscribes to both eventLog and settings, and re-runs the
  forecast on either change. Synchronous, single-threaded subscribers (no
  debounce in Phase 3; Phase 8 profiling may optimize).

- **`Object.freeze` for config** — Phase 3 may define forecast-tuning constants
  (e.g., percentile thresholds, downweight factor for rejected days). Use
  `Object.freeze` per CLAUDE.md.

- **No npm runtime dependencies** — Forecast algorithm uses only native JS
  (Array methods, Math). No numeric libraries, no stats packages. (Variance
  calculation in Phase 7 may be rolled inline or via a minimal library; defer.)

- **5-minute precision throughout** — Forecast times are 5-minute-aligned
  (inherited from Phase 1 LOG-07). Probability-band time points in the fallback
  view are also 5-minute steps.

### Integration Points

- **Composition root (`js/app.js`)** — Phase 3 instantiates the forecast
  function and passes the settings snapshot into `mountTodayScreen()`.

- **Today screen (`js/ui/today-screen.js`)** — Phase 3 extends this with:
  - Forecast card rendering (four cards + next-event card)
  - Subscriber callback for eventLog and settings changes
  - Cold-start gating logic (show message vs. cards based on minDays)
  - Conditional probability-band rendering when high-uncertainty fallback
    is active

- **HTML layout** — Phase 3 adds card containers to `index.html` for the
  prediction grid and next-event hero card (positioned above the day list).

- **Tests** — Phase 3 adds test files; the existing CI workflow
  (`tests/` + GitHub Action) is unchanged.

</code_context>

<specifics>
## Specific Ideas

- **User is tracking a 2-year-old's sleep.** Sleep patterns are often irregular
  (teething, illness, developmental transitions) and may shift mid-week. The
  empirical CDF approach (D3-01) is robust to these real-world variations and
  doesn't assume a smooth distribution. When Phase 7 adds variance-based
  statistics, the user may find empirical CDF remains their preference.

- **The user explicitly chose "cycle-aware" next-event priority** (D3-10) based
  on natural sleep-cycle sequencing. This is a domain-specific insight: the
  app should predict *what comes next in the child's sleep rhythm*, not just
  *whichever event is soonest*. This heuristic is baked into the planner's
  implementation and should be documented in the code (a comment explaining
  the priority logic for maintainers).

- **Fallback UI for missed predictions** (D3-11) deliberately keeps missed
  events visible (grayed out) so the parent can reflect on accuracy. This is
  not a bug-hiding feature; it's a transparency feature. Phase 7's accuracy
  dashboard will expand on this theme, but Phase 3 lays the groundwork by
  surfacing when predictions fall in the past.

</specifics>

<deferred>
## Deferred Ideas

### Advanced Forecast Options (Phase 7)

- **Variance-based confidence bands (±1.5σ from median).** Users who prefer
  parametric statistics can switch from empirical CDF to variance-based in
  Phase 7. Both algorithms will coexist; users can toggle between them in
  Settings.

- **Kernel Density Estimation (KDE) for probability bands.** Phase 7 can
  introduce KDE as a third probability-distribution option for the fallback
  view (replacing empirical CDF). This is useful for multimodal sleep patterns
  (e.g., child transitioning between two nap schedules mid-week). Deferred
  because KDE requires a bandwidth-selection heuristic and adds implementation
  complexity Phase 3 doesn't need.

- **Configurable forecast window beyond `windowDays`.** Phase 2 locked
  `windowDays` as a user-configurable setting (default 7, user can pick 3–90).
  Phase 3 consumes this value. **Phase 7 candidate:** Allow users to override
  the rolling-window length on-demand (e.g., "show me the forecast based on
  just the last 14 days" or "use 3-month history"), without permanently changing
  the Settings value. This would be a transient filter, not a setting.

### Forecast Behavior Review (Phase 8)

- **"Missed" prediction styling** (D3-11) should be re-evaluated when Phase 7
  or Phase 8 introduces end-of-day reflection or accuracy metrics. At that
  point, the choice to keep missed predictions visible may need adjustment
  (e.g., hide them after 30 min, or only show them on a separate "yesterday's
  forecast vs actual" view). Flag this for the Phase 8 planning discussion.

### Outlier Detection (Phase 3+)

- **CFG-04 "Auto outlier" toggle** (Phase 2) is stored but inert in Phase 3.
  Phase 3+ should implement the outlier-detection algorithm (e.g., Z-score or
  IQR-based filtering) and make CFG-04 actually control whether auto-detected
  outliers are used. For Phase 3, hardcode to "off" (only user-rejected days
  are treated as outliers via the rejected flag).

---

*Phase: 3-Forecast Engine & Today Screen*
*Context gathered: 2026-06-03*
