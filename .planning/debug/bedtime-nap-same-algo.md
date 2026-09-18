---
status: diagnosed
trigger: "G-20-16 (phase 20-nap-probability-redesign UAT): bedtime prediction is calculated with same algorithm for bedtime with/without nap, and it should be different ones (bedtime without nap shouldnt calculate after nap activity window for example)"
created: 2026-09-18T00:00:00Z
updated: 2026-09-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED (see Resolution)
test: read js/lib/forecast.js, js/lib/forecast-tif.js, js/lib/forecast-blend.js, js/ui/today-screen.js bedtime routing paths
expecting: n/a - diagnosis complete
next_action: n/a - return ROOT CAUSE FOUND to caller (goal: find_root_cause_only)

## Symptoms

expected: Bedtime prediction algorithm should differ meaningfully for with-nap vs without-nap days; a without-nap bedtime prediction should not be computed as if a nap activity window still applies.
actual: The bedtime prediction shown for non-hero display ("Later today" card) and the classic algorithm's blend branch continue to factor in nap-day statistics / probability even once it is effectively certain no nap will occur today.
errors: none (behavioral/algorithmic issue, not a crash)
reproduction: Set forecastAlgorithm='classic' (default). Reach a time of day where currentHour >= eveningHour and no napStart has been logged today (definitively a no-nap day) while bedtime is not yet the immediate next reachable event (so it renders in "Later today", not the hero card). Observe the "Bedtime" card in Later Today — it renders predictions.bedtime, which is the PRED-19 probability-blend of nap-day and no-nap-day bedtime series, not the no-nap-only predictions.bedtimeAfterWake series.
started: introduced with Phase 20 nap-probability redesign (PRED-18/19) and Phase 21 napWindowClosed decoupling; never fully wired through

## Eliminated

- hypothesis: Classic forecast() computes bedtime as a single unconditional rolling window over ALL historical bedtimes regardless of nap status.
  evidence: js/lib/forecast.js lines 780-823 (bedtimePred IIFE) explicitly branches on napStartLogged (PRED-18, uses buildBedtimeSeriesNapDay) and on napProbabilityScore (PRED-19, blends buildBedtimeSeriesNapDay/buildBedtimeSeriesNoNapDay). The classic algorithm is NOT single/unconditional — it already conditions on nap/no-nap sub-populations. This part of the user's premise is technically incorrect for the classic algorithm's happy path.
  timestamp: 2026-09-18T00:00:00Z

## Evidence

- timestamp: 2026-09-18T00:00:00Z
  checked: js/lib/forecast.js bedtimePred IIFE (lines 780-823) and napProbability() (lines 943-1026)
  found: |
    Step 1 selection logic:
      if (napStartLogged) -> use buildBedtimeSeriesNapDay only (correct, nap already happened)
      else if (napProbabilityScore.score !== null) -> BLEND buildBedtimeSeriesNapDay and
        buildBedtimeSeriesNoNapDay proportionally by napProbabilityScore.score/100 (PRED-19/D-05)
      else -> fall through to unsplit overall percentiles (PRED-10/overall)
    This blend branch reads ONLY `napProbabilityScore.score`. It never reads
    `napProbabilityScore.napWindowClosed` (the flag Phase 21 D-01/D-02/D-03 specifically
    built to signal "nap realistically can no longer happen today", decoupled from score
    on purpose so score keeps reporting the raw weighted-signal value even after window close).
    Consequence: once the nap window has closed for the day (napWindowClosed=true) and
    napStartLogged is still false, bedtimePred KEEPS blending nap-day and no-nap-day series
    using the stale probability score — it never switches to a pure no-nap route. The
    "undetermined -> blend" design (D-05) has no corresponding "definitively no-nap -> pure
    no-nap-day series" transition once uncertainty is resolved by the clock.
  implication: This is the literal root cause of "bedtime prediction ... calculated ... as if [nap] activity window" still applies -- the blend keeps weighting in nap-day statistics after it is no longer possible for a nap to occur.

- timestamp: 2026-09-18T00:00:00Z
  checked: js/lib/forecast.js lines 825-834 (bedtimeAfterWake field, Phase 21 D-09)
  found: |
    forecast() DOES separately compute `bedtimeAfterWakePred` = the raw, unblended
    buildBedtimeSeriesNoNapDay(window, settings) result, exposed as `predictions.bedtimeAfterWake`,
    fully independent of the (possibly blended) `predictions.bedtime`. This is the "correct"
    no-nap-only answer and already exists in the returned object.
  implication: The correct no-nap value is computed but is a SEPARATE field from `bedtime` -- consumers must know to read it. This sets up the display-layer gap below.

- timestamp: 2026-09-18T00:00:00Z
  checked: js/ui/today-screen.js renderForecastSection (lines 600-725), forecast-utils.js selectNextEvent/isNapWindowClosed/nextReachableEvent
  found: |
    The HERO card (#next-event-card, via nextReachableEvent + PREDICTION_FIELD) correctly
    substitutes `predictions.bedtimeAfterWake` for `predictions.bedtime` once napWindowClosed
    is true and bedtime is the reachable event (Phase 21 D-06/D-07/D-08 -- this path IS correct).
    BUT the "Later today" collapsible section (line 687: `EVENT_TYPES = ['wake','napStart',
    'napEnd','bedtime']`) NEVER includes 'bedtimeAfterWake' in its iteration -- it always reads
    `predictions['bedtime']` directly (line 691) whenever bedtime isn't already the hero.
    So any time bedtime renders as a non-hero "Later today" card (the common case: user checks
    the app mid-morning/mid-day, well before bedtime is the *next* reachable event), the user
    sees the blended `predictions.bedtime` value, never `bedtimeAfterWake`, regardless of
    napWindowClosed.
  implication: Even where the blend-branch root cause above did not exist, this display-layer omission would independently reproduce "same algorithm shown for with/without-nap" for the majority of the day (any time bedtime isn't the immediate next event).

- timestamp: 2026-09-18T00:00:00Z
  checked: js/lib/forecast-tif.js bedtime prediction block (lines 676-705), compared against js/lib/forecast-blend.js Model 3 (lines 552-580)
  found: |
    forecast-tif.js's bedtime computation adds an "Activity-after-nap band" window
    (anchored to napEndAnchor, built from historical activityAfterNap durations) into
    bedtimeLabelledWindows UNCONDITIONALLY whenever napEndAnchor !== null -- with NO
    isNoNapDay check, unlike the "Day-length band" immediately above it in the same
    function (which DOES branch on isNoNapDay per documented D-16/D-19). napEndAnchor
    itself, via resolveAnchor('napEnd', dayRecords, tifPredictions), can resolve to either
    (a) the most recently logged real napEnd from ANY prior day, or (b) the TIF-computed
    napEndPred.central -- a nap-end PREDICTED for today that forecast-tif.js computes
    unconditionally regardless of isNoNapDay. Either way, on a no-nap day the bedtime
    intersection still includes a window built from "how long after a nap ends before
    bedtime" historical activity durations.
    By contrast, forecast-blend.js's analogous Model 3 (line 561: `if (!isNoNapDay) { ...
    activity-after-nap band ... } else { ... no-nap-only historic bedtime band ... }`)
    explicitly implements the substitution that forecast-tif.js is missing, and its own
    docstring (line 342-345, D-05) documents exactly this requirement.
  implication: forecast-tif.js (the opt-in TIF algorithm) has a second, independent, and even more literal instance of the reported bug -- the code and comment literally say "Activity-after-nap band" is being used to compute the no-nap bedtime, with zero gating, while its sibling module (forecast-blend.js) proves the gating is both known-necessary and already implemented correctly elsewhere in the same codebase.

## Resolution

root_cause: |
  Two independent, compounding defects reproduce the reported symptom, spanning code (bug) and integration/wiring (bug) categories -- not intentional simplification:

  1. [forecast.js, classic algorithm -- default/always-on] The PRED-19 (D-05) bedtime blend
     branch (lines 791-805) mixes buildBedtimeSeriesNapDay and buildBedtimeSeriesNoNapDay by
     napProbabilityScore.score alone. It never consults napProbabilityScore.napWindowClosed
     (Phase 21 D-01/D-02/D-03's dedicated "nap can no longer happen today" signal), so
     `predictions.bedtime` keeps blending in nap-day statistics even after the nap window has
     definitively closed for the day -- i.e. it keeps calculating as though the nap activity
     window is still open, exactly as reported.

  2. [today-screen.js renderForecastSection, "Later today" section, lines 687-704] Even though
     forecast.js already computes the correct, unblended no-nap-only value as
     `predictions.bedtimeAfterWake` (Phase 21 D-09), the non-hero "Later today" render loop's
     EVENT_TYPES list omits 'bedtimeAfterWake' entirely and always reads `predictions.bedtime`
     for the 'bedtime' slot. Only the hero next-event card substitutes bedtimeAfterWake
     correctly. So whenever bedtime isn't the immediate next reachable event (most of the day),
     the user only ever sees the (potentially stale-blended) `bedtime` value.

  A third, separate instance of the same conceptual bug exists in the opt-in TIF algorithm:
  [forecast-tif.js, lines 699-702] the bedtime computation's "Activity-after-nap band" window
  has no isNoNapDay gate at all (unlike its own Day-length band a few lines above, and unlike
  forecast-blend.js's Model 3 which implements the identical concept correctly). This is a pure
  code-category omission, independently confirmed by diffing against the sibling module that
  gets it right.

  AND-gate: these are three independent, additive defects (not one shared root cause requiring
  all three simultaneously) -- fixing any one narrows the symptom for its algorithm/rendering
  path, but full resolution requires addressing all three since forecastAlgorithm is
  user-selectable (classic/tif/blend) and the Later-Today display path is shared across
  algorithms.
fix: (not applied -- goal: find_root_cause_only)
verification: (not applicable)
files_changed: []
