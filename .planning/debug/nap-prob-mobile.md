---
status: investigating
trigger: "G-NW-12-4: nap probability line not visible on mobile, works on PC Chrome. User suspects data-dependent (cold-start) or code/CSS issue."
created: 2026-08-26T00:00:00Z
updated: 2026-08-26T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — suppression is entirely data/time-driven, with a secondary TIF rendering gap. No CSS issue.
test: Traced all rendering paths from render() → renderForecastSection → renderNextEventCard/renderPredictionCard/renderTifNormalCard, and inspected all @media rules in style.css.
expecting: N/A — investigation complete
next_action: Return diagnosis

## Symptoms

expected: Nap-start prediction card shows "72% chance of nap today" when history is sufficient, "0% — nap window closed" when window passed, nothing when cold-start
actual: Line not visible on mobile; works on PC Chrome
errors: none reported
reproduction: Load app on mobile with same data that works on desktop
started: unknown — may have always been absent on mobile

## Eliminated

- hypothesis: Mobile-specific CSS hides or clips .nap-probability
  evidence: style.css has no @media query that targets .nap-probability. Only two relevant @media rules exist: (max-width:480px) changes forecast-grid to 1-col, and (orientation:landscape) adjusts padding. Neither touches .nap-probability.
  timestamp: 2026-08-26

- hypothesis: A viewport or overflow rule clips the element on narrow screens
  evidence: .prediction-card uses flex-direction:column with no overflow:hidden; .nap-probability uses no display property at all. The parent forecast-grid changes column count but not clipping.
  timestamp: 2026-08-26

## Evidence

- timestamp: 2026-08-26
  checked: today-screen.js lines 913-936 (render() nap probability attachment)
  found: napProbabilityScore is set on predictions.napStart ONLY when (a) predictions.napStart is truthy AND (b) !predictions.isColdStart. If either fails, the property stays undefined.
  implication: The gate is data-driven. Cold-start suppresses the whole section; insufficient napStart data causes napProbability() to return null.

- timestamp: 2026-08-26
  checked: today-screen.js lines 167-172 (renderNextEventCard hero card) and 285-290 (renderPredictionCard grid card)
  found: Both check `napProbabilityScore != null && !isMissed`. undefined != null evaluates to false in JS non-strict equality, so undefined score suppresses the line. isMissed=true (time passed) also suppresses it.
  implication: Two independent suppression axes: (1) score not computed, (2) nap window has passed.

- timestamp: 2026-08-26
  checked: today-screen.js lines 530-546 (renderForecastSection TIF branch) and renderTifNormalCard lines 323-396
  found: When TIF algorithm is active (pred.precisionScore != null), renderTifNormalCard is called for the grid card. renderTifNormalCard has NO nap-probability element — not even a conditional for it. renderTifLowConfidenceCard also omits it. Only renderPredictionCard (classic path) renders the nap probability on the grid card.
  implication: In TIF mode, grid cards NEVER show nap probability. Hero card still shows it when napStart is the next event. This is a design gap.

- timestamp: 2026-08-26
  checked: forecast.js lines 309-325 (detectColdStart) vs lines 841-843 (napProbability cold-start gate)
  found: detectColdStart counts non-rejected valid days. napProbability counts dayRecords.length (all records, including rejected). Both gate on settings.minDays. If forecast passes cold-start, napProbability will also pass (total records >= valid records >= minDays).
  implication: The two cold-start gates are consistent. No scenario where forecast proceeds but napProbability returns null due to the cold-start check alone.

- timestamp: 2026-08-26
  checked: style.css lines 987-1004, all @media queries in file
  found: .nap-probability has two rules: base (color:#475569) and .next-event-hero .nap-probability (color:#fff). No @media query targets either rule. The only media queries near forecast cards change grid column count (max-width:480px) and body padding (orientation:landscape).
  implication: Confirmed no CSS issue.

## Resolution

root_cause: The nap probability line suppression is data-driven (by design), not a CSS or viewport bug. The specific conditions: (1) cold-start path — if mobile localStorage has fewer valid days than settings.minDays (default 7), predictions.isColdStart=true, the entire forecast section is replaced by the cold-start message, and napProbabilityScore is never computed; (2) isMissed=true — if the napStart predicted time has already passed, the line is deliberately hidden on both hero and grid cards; (3) secondary code gap — when TIF algorithm is active, renderTifNormalCard is used for the grid card and it has no nap-probability display at all (hero card still shows it). The mobile case almost certainly hits condition (1) or (2): different localStorage state across devices, or viewing the app late in the day after napStart time has passed.
fix: No fix needed for the cold-start or isMissed suppression — both are correct by design. The TIF grid card omission (condition 3) is a latent gap that could be fixed by adding the nap-probability block to renderTifNormalCard, but it is NOT the reported mobile issue.
verification: N/A — diagnosis only
files_changed: []
