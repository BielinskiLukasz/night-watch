# Phase 20: Nap Probability Redesign - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild `napProbability()` (`js/lib/forecast.js`) so its four signals are data-driven instead of clock-based:

- **Remove** `elapsedWakeTime` (currently 30%) and `windowPassed` (currently 10%) — both depend on the current clock time, so the score drifts as the day progresses instead of being stable once computed at wake time.
- **Add** `dayOfWeekNapRate` (30%) — fraction of same-weekday days (all history) that had a nap, derived from `dayOfWeekAverages()` in `js/lib/metrics.js`.
- **Add** `sleepDebtSignal` (20%) — normalized value from `sleepDebtProxy()` in `js/lib/metrics.js`; higher debt increases nap probability.
- **Change** `napFrequency` weight 40%→35% and `noNapStreakPenalty` weight 20%→15% (both signals themselves are unchanged in computation — only their weight changes) so the four final weights (35/30/20/15) sum to 100%.

This phase also changes `napProbability()`'s return contract from a bare `null | 0 | number` to an object (see D-03/D-04) — that ripples into `forecast.js`'s PRED-19 blend and `today-screen.js`'s UI rendering, both in scope as consequences of this phase, not new capabilities.

**Requirements this phase satisfies:** NAP-01, NAP-02, NAP-03, NAP-04

**Out of scope:** Any UI redesign of how the score is displayed (Phase 21 owns "next reachable event" / card visibility per PRED-23/24). This phase only changes the score's inputs and return shape; the displayed string format (`"N% chance of nap today"` / `"0% — nap window closed"`) is unchanged.

</domain>

<decisions>
## Implementation Decisions

### Signal Availability & Cold-Start

- **D-01:** When `dayOfWeekNapRate` and/or `sleepDebtSignal` cannot be computed (insufficient same-weekday history, or `sleepDebtProxy()` returns `null` for insufficient qualifying overnight pairs), redistribute weight proportionally across whichever signals ARE available rather than treating the missing signal as neutral or gating the whole score to `null`. — **Reversibility:** reversible

- **D-02:** Redistribution formula: `scaledWeight = originalWeight / sum(availableOriginalWeights)`, applied uniformly to whatever subset of the four signals has data. No hand-authored fallback table per missing-signal combination. Note: `napFrequency` and `noNapStreakPenalty` are always computable once the existing top-level cold-start gate (`dayRecords.length >= settings.minDays`) passes — only `dayOfWeekNapRate` and `sleepDebtSignal` can independently be unavailable, so in practice there are at most 4 redistribution cases (both new signals present, either one missing, or both missing). — **Reversibility:** reversible

### Return Shape

- **D-03:** `napProbability()` always returns `{ score: number|null, signalsUsed: string[], confidence: 'full'|'partial'|'none' }` — never a bare `null`/`0`/number anymore. `score` carries today's three existing cases (`null` = cold-start, `0` = nap window closed, `1-100` = real score); `signalsUsed` lists which of the four signal keys contributed; `confidence` is `'full'` when all four signals were available, `'partial'` when redistribution occurred, `'none'` when the top-level cold-start gate fails. — **Reversibility:** costly — every current reader of the bare value must switch to reading `.score` (see D-04 for exact call sites)

- **D-04:** The object propagates all the way into `forecast.js`'s `context.napProbabilityScore` — it is NOT unwrapped early in `today-screen.js`. `forecast.js`'s PRED-19 blend logic and null-checks must be updated to read `.score`. Exact call sites requiring updates:
  - `js/lib/forecast.js:697` — destructuring default `napProbabilityScore = null` (context field now holds the object or is absent; default handling must not crash when the field is entirely omitted, e.g. by tests that call `forecast()` directly without providing it)
  - `js/lib/forecast.js:773` — `else if (napProbabilityScore !== null)` → must become a check against `napProbabilityScore.score !== null` (guard for the object itself being absent too)
  - `js/lib/forecast.js:778` — `const ratio = napProbabilityScore / 100` → `napProbabilityScore.score / 100`
  - `js/lib/forecast.js:788` — comment referencing D-07's "napProbabilityScore === null" semantics needs updating to describe the new `.score === null` check
  - `js/ui/today-screen.js:924` — `const napProbabilityScore = napProbability(forecastDays, snap, {...})` — now receives the object (no code change needed here, just a type change)
  - `js/ui/today-screen.js:948` — `predictions.napStart.napProbabilityScore = napProbabilityScore` — attaches the whole object to the prediction
  - `js/ui/today-screen.js:167-171` and `js/ui/today-screen.js:285-289` — UI string rendering currently does `` `${prediction.napProbabilityScore}% chance of nap today` `` on a bare number; **must change to `.score`** or it will render `[object Object]%` instead of a percentage. The displayed text itself does not change — only the property access.
  — **Reversibility:** costly — touches already-shipped Phase 19 code (`forecast.js`'s split-bedtime blend) and Phase 12/19 UI code (`today-screen.js`'s two nap-probability render sites); reverting means restoring the bare-number contract everywhere listed above

### Weekday Nap-Rate Signal (NAP-02)

- **D-05:** `dayOfWeekNapRate` uses ALL historical days matching today's weekday (no capped recent window) — `fraction = napDaysOnThisWeekday / totalDaysOnThisWeekday`. Matches how `napFrequency` already works (all-history fraction) and avoids introducing a new windowing concept. — **Reversibility:** reversible

- **D-06:** The signal counts as "available" once there are at least `settings.minDays` same-weekday days in history — reuses the existing cold-start threshold rather than introducing a second, separate minimum. — **Reversibility:** reversible

- **D-07:** Add a new `context.todayWeekday` field (0=Sun..6=Sat, matching `dayOfWeekAverages()`'s existing convention) that `today-screen.js` computes (from the injected clock adapter) and threads into the context passed to `napProbability()` — same pattern as Phase 19 D-13's `todayWakeHHMM`/`todayNapStartHHMM` pre-computation, since `napProbability()` is a pure function and cannot call `new Date()` itself. — **Reversibility:** reversible

- **Implementation note (not user-decided, for planner):** `dayOfWeekAverages()` currently returns per-weekday AVERAGES (durations/ratios) but does not track a nap-day-count/total-day-count pair needed to compute a rate. The planner should decide whether to extend `dayOfWeekAverages()`'s return objects with new `napDays`/`totalDays` (or a precomputed `napRate`) fields, or compute the same all-history same-weekday fraction independently inside `forecast.js` without modifying `dayOfWeekAverages()`'s signature. Either is acceptable — NAP-02 says "derived from `dayOfWeekAverages()`" but does not mandate a specific code-sharing mechanism.

### Sleep-Debt Signal (NAP-03)

- **D-08:** Normalize `sleepDebtProxy()`'s unbounded signed-minutes return by clamping to ±180 minutes and mapping linearly to 0-1: 0 min → 0.5 (neutral), +180 min → 1.0 (max nap-boost), −180 min → 0.0 (max nap-suppress), clamped beyond ±180. User confirmed ±180 is a reasonable bound given their own data's typical weekly swings. — **Reversibility:** reversible

- **D-09:** Call `sleepDebtProxy(dayRecords, 7, targetSleepMinutes)` reusing the same 7-day window and `targetSleepMinutes` setting already used by the Metrics screen's Sleep Debt column (MET-13/14) — one "sleep debt" concept across the app, no new setting introduced. When `sleepDebtProxy()` returns `null` (fewer than 7 qualifying overnight pairs), this signal is unavailable and D-01/D-02 redistribution applies. — **Reversibility:** reversible

### Final Weight Table (NAP-04)

- **D-10:** Confirmed target weights: `napFrequency` = 35% (was 40% in shipped code), `dayOfWeekNapRate` = 30%, `sleepDebtSignal` = 20%, `noNapStreakPenalty` = 15% (was 20% in shipped code). This is an explicit change to the shipped `napFrequency`/`noNapStreak` weight constants, not a literal preservation of today's values — 35/30/20/15 is the only combination that sums to 100% and matches the percentages already stated in ROADMAP.md and REQUIREMENTS.md NAP-01..04. The requirement's "retain" wording refers to keeping the two signals' underlying *computation* (napFrequency's fraction-of-recent-nap-days logic, noNapStreakPenalty's streak-based logic) — not their weight values. — **Reversibility:** reversible

### Claude's Discretion

- Exact naming/internal helper structure for computing `dayOfWeekNapRate` (see implementation note under D-07).
- Whether `NAP_SCORE_WEIGHTS` keeps its current object shape (just updates the four numeric values and adds two new keys, drops two old keys) or is restructured — as long as weights are `Object.freeze`d and sum to 1.0, matching existing code conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 20: Nap Probability Redesign" (v2.0 section) — phase summary with file targets
- `.planning/REQUIREMENTS.md` §NAP-01, NAP-02, NAP-03, NAP-04 — functional requirements for this phase
- `.planning/PROJECT.md` §"Current Milestone: v2.0" — "Nap probability redesign: data-driven, time-independent (B-047)" target-feature framing

### Core Algorithm Module (being changed)
- `js/lib/forecast.js:990-1095` — `NAP_SCORE_WEIGHTS` constant and `napProbability()` function; both being rewritten
- `js/lib/forecast.js:690-789` — PRED-18/19 bedtime routing that consumes `context.napProbabilityScore`; the `.score` unwrap sites listed in D-04

### Shared Signal Sources (already shipped, being consumed not modified — except see D-07 implementation note)
- `js/lib/metrics.js:417-521` — `dayOfWeekAverages()` (MET-11/12, Phase 17) — source for `dayOfWeekNapRate`
- `js/lib/metrics.js:557-579` — `sleepDebtProxy()` (MET-13/14, Phase 18) — source for `sleepDebtSignal`

### UI Integration (consequence of D-03/D-04, must be updated)
- `js/ui/today-screen.js:921-949` — computes `napProbabilityScore`, threads it into `forecastContext`, attaches it to `predictions.napStart`
- `js/ui/today-screen.js:164-172` and `js/ui/today-screen.js:282-291` — renders the nap-probability percentage text on the hero card and prediction card

### Prior Phase Context (precedent patterns)
- `.planning/phases/19-split-bedtime-wake-anchored-nap/19-CONTEXT.md` — D-13 established the "pre-compute in today-screen.js, thread via context" pattern this phase's D-07 (`todayWeekday`) follows; D-05/D-07/D-08 established the existing `napProbabilityScore` null/blend semantics that D-03/D-04 change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `napFrequency` and `noNapStreakPenalty` computation logic (current `sig1`/`sig3` in `napProbability()`, `js/lib/forecast.js:1042-1044` and `1083-1085`) — unchanged, only their weight constants change (D-10)
- `dayOfWeekAverages(dayRecords)` (`js/lib/metrics.js:417`) — already groups by weekday via `new Date(dateStr + 'T00:00').getDay()` (0=Sun..6=Sat); reuse this exact weekday convention for the new `context.todayWeekday` field (D-07)
- `sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes)` (`js/lib/metrics.js:557`) — call directly with `windowDays=7` and the existing `targetSleepMinutes` setting (D-09)

### Established Patterns
- **Pre-computed context fields:** `today-screen.js` computes `todayWakeHHMM`, `todayNapStartHHMM` before calling `forecast()`/`napProbability()` (Phase 19 D-13) — `todayWeekday` (D-07) follows the identical pattern
- **Cold-start guard:** `napProbability()`'s existing top-level gate (`dayRecords.length < settings.minDays → return null`) stays as-is; it gates the whole score, distinct from the new per-signal availability check (D-01/D-02) that only affects weight redistribution
- **`Object.freeze` on weight tables:** `NAP_SCORE_WEIGHTS` is already frozen; the redesigned table must be too (existing convention, `js/lib/forecast.js:1004`)

### Integration Points
- `forecast.js` importing from `metrics.js` for `dayOfWeekAverages`/`sleepDebtProxy` — verify this does not create a circular import; `metrics.js` currently imports `timeToMinutes` from `forecast.js` (see the `metrics.js` circular-import guard noted in CLAUDE.md), so the import direction `forecast.js → metrics.js` must be checked against what `metrics.js` already imports from `forecast.js` to confirm no cycle forms
- `today-screen.js` — three sites needing updates per D-04 (lines ~924, ~948, ~167-171/285-289)
- `forecast.js` — four sites needing updates per D-04 (lines ~697, ~773, ~778, ~788)
- `tests/unit/forecast.test.js` — existing `napProbability()` tests will need updating for the new return shape; new tests needed for all five signals (four weighted + redistribution) and the 35/30/20/15 weight-sum assertion

</code_context>

<specifics>
## Specific Ideas

- The exact clamp bound for sleep-debt normalization (±180 minutes) was confirmed against the user's own sense of their data's typical weekly swings, not an arbitrary constant — if implementation reveals the real data swings are meaningfully different, that's worth a quick check-in, but the default is to proceed with ±180.
- `NEW_ALG.md` and `NEW_ACC.md` (untracked files at the repo root) are scratch notes for Phase 25 (Algorithm C) and Phase 22 (Accuracy Scoring) respectively, already consumed into `.planning/phases/25-algorithm-c-settings-modal/25-CONTEXT.md` and `REQUIREMENTS.md`'s ACC-01..04. They are not relevant to this phase's scope.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-nap-probability-redesign*
*Context gathered: 2026-09-16*
