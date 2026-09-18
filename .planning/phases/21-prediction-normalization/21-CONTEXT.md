# Phase 21: Prediction Normalization - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure how the Today screen surfaces predictions so it shows only what's realistically next, instead of always rendering all four event-type cards:

- **`nextReachableEvent(lastEvent, currentHour, settings)`** — new pure helper (array-returning) that determines which upcoming event(s) are actually reachable given the last logged event and the time of day. Absorbs and replaces the priority-order logic currently duplicated ad hoc inside `selectNextEvent()` (`js/lib/forecast.js:892-987`), fixing that function's `new Date()` calls (`gsd:allow-ui-clock`) as a side effect.
- **Today screen hero rendering** — renders the reachable event(s) as prominent hero card(s) — normally one, but two side-by-side when today's nap status is genuinely undetermined (see D-04/D-05).
- **Nap-window-closed suppression** — the `napStart` card is fully hidden (not just collapsed/labeled) once a nap becomes structurally unreachable for today, via a new `napWindowClosed` flag (see D-01..D-03 — this also reopens and amends Phase 20's already-written CONTEXT.md).
- **De-emphasis for secondary events** — everything not in the hero slot(s) moves into a new collapsible "Later today" section, wrapping (not replacing) the existing per-event card renderers.
- **New `forecast-utils.js`** — `nextReachableEvent` and `selectNextEvent` both move out of `forecast.js` into this new file (see D-08).

**Requirements this phase satisfies:** PRED-23, PRED-24, UI-13

**Out of scope:** Anything about nap-probability score *computation* itself (napFrequency/dayOfWeekNapRate/sleepDebtSignal/noNapStreakPenalty weighting) — that's Phase 20's domain. This phase only consumes Phase 20's output shape (now including `napWindowClosed`, per the amendment below) and decides what to render and when.

</domain>

<decisions>
## Implementation Decisions

### Nap-Window-Closed Flag & Phase 20 Coordination

- **D-01:** `napWindowClosed: boolean` is added to Phase 20's `napProbability()` return shape (extending its `{score, signalsUsed, confidence}` object from `20-CONTEXT.md` D-03), not built as a separate independent Phase 21 helper. This required amending `.planning/phases/20-nap-probability-redesign/20-CONTEXT.md` — done as a direct consequence of this discussion (see canonical_refs). — **Reversibility:** costly — Phase 20's CONTEXT.md was reopened and amended after this decision; unwinding it means re-editing both phases' CONTEXT.md files and whatever Phase 20 code has been planned/executed by that point.

- **D-02:** `score` is fully decoupled from window-closed state: it always reports the real computed nap probability (weighted signal blend), even after the nap window closes. The existing hard-collapse-to-0 branch in `napProbability()` (`js/lib/forecast.js:1055-1060`) is removed as part of this. `napWindowClosed` is the sole signal used to hide the `napStart` card. — **Reversibility:** costly — this changes Phase 20's D-03 return-shape semantics (score no longer means "0 = window closed"); reverting means restoring the hard-collapse branch and re-auditing every `score === 0` check.

- **D-03:** `napWindowClosed` is derived exactly like today's existing hard-collapse comparison — current time vs. P90 of historical `napStart` times (`js/lib/forecast.js:1055-1060`) — reusing that comparison rather than introducing a new configurable cutoff-hour setting. — **Reversibility:** reversible

- **D-04:** `napWindowClosed` only gates the `napStart` card. Once `napStart` is logged for today, `napEnd` renders normally regardless of `napWindowClosed` — the flag means "no nap will start today," not "hide all nap-related cards." — **Reversibility:** reversible

- **D-05:** Two independent "too late for a nap" signals coexist and either can suppress `napStart` from `nextReachableEvent`'s wake-branch candidates: the new `napWindowClosed` flag (D-01/D-03) OR the existing `eveningHour` setting (`settings.eveningHour`, default 18, already used by `forecast-tif.js`'s `isNoNapDay` determination — untouched by this phase). `napStart` drops out when `napWindowClosed === true` **or** `currentHour >= eveningHour`. — **Reversibility:** reversible

### `nextReachableEvent` / `selectNextEvent` & the Event Model

- **D-06:** `nextReachableEvent(lastEvent, currentHour, settings)` is extracted from `selectNextEvent`'s existing priority-order logic (the PRED-08 evening-hour override + the switch on `lastEvent.type`, `js/lib/forecast.js:948-987`) as a genuinely pure function — it takes `currentHour` as a parameter instead of calling `new Date()`. `selectNextEvent` becomes a thin wrapper: finds `lastEvent` from `dayRecords`, reads the real clock once, calls `nextReachableEvent`, then walks the returned array against `predictions` to skip event types with no historical data (preserving today's exact fallback behavior). — **Reversibility:** costly — touches already-shipped Phase 3/8/12 code (`selectNextEvent`'s existing callers and tests); reverting means re-inlining the clock read and priority switch.

- **D-07:** The real event model has 5 paths, not 4 linear types — `nextReachableEvent` always returns `string[]` (length 1 normally, length 2 only for the ambiguous wake branch):
  - `wake` → `['napStart', 'bedtimeAfterWake']` (both, while nap remains reachable — see below) or `['bedtimeAfterWake']` (once napStart drops per D-05)
  - `napStart` → `['napEnd']`
  - `napEnd` → `['bedtimeAfterNap']`
  - `bedtime` (either flavor, once logged) → `['wake']`

  `bedtimeAfterNap`/`bedtimeAfterWake` are **prediction-calculation branches only** (Phase 19's `buildBedtimeSeriesNapDay`/`buildBedtimeSeriesNoNapDay`), not new loggable event types — the user still only ever logs a single `bedtime` event. — **Reversibility:** one-way — this is a new public contract (array, not single type) that UI code and tests are built against from the start; changing it back to a single-type contract after Phase 21 ships would require re-touching every caller again.

- **D-08:** When both `napStart` and `bedtimeAfterWake` are reachable (ambiguous wake branch), the Today screen shows **both as equally-prominent hero cards side by side**, each with its own predicted time — not a single threshold-based pick between them. This is an explicit, intentional exception to the otherwise-single-hero rule. — **Reversibility:** reversible

- **D-09:** `forecast()` gains a new top-level output field, `predictions.bedtimeAfterWake` — the raw, unblended result of `buildBedtimeSeriesNoNapDay(window, settings)` (min/central/max or probability band). `predictions.bedtime` keeps its current meaning (the Phase 19 D-09 blended value, used once nap status resolves one way or the other, or as the final/fallback prediction). `bedtimeAfterWake` exists purely to power the dual-hero-card display while nap status is undetermined. — **Reversibility:** reversible — additive field, existing `predictions.bedtime` consumers are unaffected.

### De-emphasis: "Later Today" Section

- **D-10:** Non-hero events render inside a new collapsible "Later today" section (native `<details>`, matching the existing no-open-attribute convention from Phase 17's DoW section) — not the per-card `.collapsed` accordion pattern already used for TIF/probability-band cards, and not a muted/dimmed always-expanded style. — **Reversibility:** reversible

- **D-11:** "Later today" is **collapsed by default** on load, matching the UI-09/D9-05 convention for probability-band cards. — **Reversibility:** reversible

- **D-12:** This is a wrapping/reorganization change, not a new rendering path: `renderPredictionCard`/`renderTifNormalCard`/`renderTifLowConfidenceCard` stay exactly as they are. `renderForecastSection` (`js/ui/today-screen.js:494-547`) changes to decide, per event type, whether it goes into a hero slot or gets appended inside the new "Later today" wrapper. — **Reversibility:** reversible

- **D-13:** When a TIF card (already individually collapsed via its own summary/chevron) ends up inside "Later today," it **auto-expands** once the outer section is opened — avoiding a two-tap dig for detail the user already asked to see by opening the section. — **Reversibility:** reversible

### File Placement

- **D-14:** `nextReachableEvent` and `selectNextEvent` both move together into a new `js/lib/forecast-utils.js` (forecast.js is currently 1144 lines and growing; this keeps "which event is next" orchestration separate from percentile/series/blending math). `forecast-utils.js` imports what it needs (e.g. `timeToMinutes`) from `forecast.js` — one-directional, no circular-import risk since `forecast.js` never needs anything back from `forecast-utils.js`. `today-screen.js` updates its import accordingly. Per CLAUDE.md's service-worker invariant, this new file **must** be added to `sw.js`'s `PRECACHE_LIST` and to `tests/unit/sw-precache.test.js`. — **Reversibility:** reversible — a file move; imports need updating but no contract changes.

### Claude's Discretion

- Exact internal naming/structure of `nextReachableEvent`'s array-building logic (e.g., how the PRED-08 evening-hour check and the new D-05 OR-condition compose internally).
- Exact DOM/CSS structure of the "Later today" `<details>` wrapper, as long as it follows the no-open-attribute convention and wraps existing card renderers unchanged.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 21: Prediction Normalization" (v1.5 section) — phase summary with file targets
- `.planning/REQUIREMENTS.md` §PRED-23, PRED-24, UI-13 — functional requirements for this phase
- `.planning/PROJECT.md` §"Current Milestone: v1.5" — "Prediction normalization: show only next reachable event (B-038)"

### Backlog Origin (richest source of intent — read before planning)
- `.planning/BACKLOG.md` §B-038 "Normalize prediction: show only the next relevant event" (~line 897) — original capture: open questions about hide-vs-dim, threshold definition, and the `nextReachableEvent(lastEvent, currentHour, settings)` helper signature this phase implements
- `.planning/BACKLOG.md` §B-047 nap-probability-redesign implementation notes (~line 1170-1193) — original spec explicitly calling for `napWindowClosed: boolean` as a decoupled flag; this is the source Phase 20's `20-CONTEXT.md` initially left out and this phase's D-01/D-02 restore
- `.planning/BACKLOG.md` §B-052 "Split bedtime model" (~line 1354) — origin of the `bedtimeAfterNap`/`bedtimeAfterWake` split (shipped in Phase 19); explicitly flags interaction with B-038 (this phase) at line 1377

### Phase 20 Coordination (amended as a direct result of this discussion)
- `.planning/phases/20-nap-probability-redesign/20-CONTEXT.md` — D-01 through D-04 amended to add `napWindowClosed` to the return shape and remove the hard-collapse-to-0 branch (see this phase's D-01/D-02)

### Core Algorithm Module (being changed)
- `js/lib/forecast.js:892-987` — `selectNextEvent()` — priority logic extracted per D-06/D-07
- `js/lib/forecast.js:745-789` — bedtime blending logic — gains the `bedtimeAfterWake` exposure per D-09
- `js/lib/forecast.js:1055-1060` — existing hard-collapse-to-0 window-closed comparison — removed per D-02, its comparison reused per D-03

### New File (must be precache-registered)
- `sw.js` `PRECACHE_LIST` — add `./js/lib/forecast-utils.js`
- `tests/unit/sw-precache.test.js` — add assertion for the new file (per D-14)

### UI Integration
- `js/ui/today-screen.js:494-547` — `renderForecastSection()` — hero-slot vs. "Later today" placement logic (D-08, D-10..D-13)
- `js/ui/today-screen.js:118-191` — `renderNextEventCard()` — may need to render 2 hero cards side by side (D-08)
- `js/ui/today-screen.js:205-309` — `renderPredictionCard()` — stays unchanged, just gets wrapped (D-12)

### Prior Phase Context (precedent patterns)
- `.planning/phases/20-nap-probability-redesign/20-CONTEXT.md` — D-03/D-04 established the `napProbabilityScore` object shape this phase extends; explicitly scoped card-visibility work OUT to this phase
- `.planning/phases/19-split-bedtime-wake-anchored-nap/19-CONTEXT.md` — D-09 established the nap-day/no-nap-day bedtime blending this phase partially un-blends (D-09 here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `selectNextEvent()` (`js/lib/forecast.js:892-987`) — priority-order switch and PRED-08 evening-hour override logic, extracted into the new pure `nextReachableEvent` (D-06/D-07)
- `buildBedtimeSeriesNoNapDay()` (`js/lib/forecast.js:554`) — already computes exactly the value needed for the new `predictions.bedtimeAfterWake` field (D-09); currently only consumed internally for blending
- Phase 17's no-open-attribute `<details>` pattern (native collapse resets on `replaceChildren` rebuild) — reused for "Later today" (D-10)
- Existing `.collapsed` per-card pattern (`renderTifNormalCard`, `renderPredictionCard`'s probability-band branch) — stays as-is for its current purpose, not reused for the new de-emphasis mechanism

### Established Patterns
- **Pre-computed context fields:** `today-screen.js` computes clock-dependent values before calling pure `lib/` functions (Phase 19 D-13, Phase 20 D-07) — `currentHour` for `nextReachableEvent` follows the same pattern
- **`Object.freeze` / no-`new Date()`-in-lib convention** — this phase's extraction of `nextReachableEvent` as a genuinely pure function (D-06) brings `forecast.js`'s last two `gsd:allow-ui-clock` exceptions in line with this convention

### Integration Points
- `js/ui/today-screen.js` imports `forecast`, `selectNextEvent`, `napProbability` from `../lib/forecast.js` (line 44) — after D-14, `selectNextEvent` import moves to `../lib/forecast-utils.js`
- `sw.js` / `tests/unit/sw-precache.test.js` — new file registration (D-14)
- `js/lib/forecast-tif.js` — imports `eveningHour`-derived `isNoNapDay` logic from `today-screen.js` (caller-resolved, per CLAUDE.md's stated pattern) — untouched by this phase (D-05 keeps `eveningHour`'s existing job separate from the new `napWindowClosed` flag)

</code_context>

<specifics>
## Specific Ideas

- The 5-path event model (wake→{napStart, bedtimeAfterWake}, napStart→napEnd, napEnd→bedtimeAfterNap, bedtime→wake) came directly from the user correcting an initial 4-linear-type assumption during discussion — this is the authoritative model for planning, not the roadmap's literal wording.
- Dual hero cards (napStart + bedtimeAfterWake shown side by side while nap status is ambiguous) is a deliberate, explicit exception to the "single next reachable event" framing in UI-13's summary text — confirmed twice during discussion, not an oversight.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (The Phase 20 CONTEXT.md amendment triggered by D-01 is cross-phase coordination, not scope creep — it's a direct, necessary consequence of a decision made during this discussion.)

</deferred>

---

*Phase: 21-prediction-normalization*
*Context gathered: 2026-09-16*
