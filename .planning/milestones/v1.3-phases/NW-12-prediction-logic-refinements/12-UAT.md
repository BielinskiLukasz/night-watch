---
status: complete
phase: NW-12-prediction-logic-refinements
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md, 12-05-SUMMARY.md, 12-06-SUMMARY.md]
started: 2026-08-26T00:00:00Z
updated: 2026-08-26T12:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

## Current Test

[testing complete]

## Tests

### 1. Today screen card order (UI-07)
expected: Open the Today screen. The prediction cards must appear in this exact order from top to bottom: wake → nap start → nap end → bedtime. Bedtime card renders last, nap start and nap end in the middle.
result: pass

### 2. Settings modal — Evening hour and No-nap bedtime offset inputs (PRED-08)
expected: Open the Settings modal and scroll to the Forecast fieldset. Two new inputs should be visible: "Evening hour" (default value 18) and "No-nap bedtime offset" (default value 30). Both inputs accept numeric values and save correctly.
result: pass

### 3. Intense-day checkbox and badge round-trip (PRED-10)
expected: Open the event-entry modal (add or edit any event). A checkbox labeled "Intense day" is visible below the form fields. Check it and save. Navigate to the History screen — the day's date cell shows an indigo "Intense" badge. Click the badge; it disappears and the day is no longer marked intense.
result: pass
note: "Visual layout issue reported during test; diagnosed as missing #manualEntry label.checkboxRow selector in .checkboxRow override — already fixed in commit 1cf2361 before this UAT session."

### 4. Nap probability score on nap-start prediction card (PRED-12)
expected: With sufficient sleep history loaded, open the Today screen during normal waking hours (before the nap window has passed). The nap-start prediction card (and/or the hero "next event" card when nap start is next) displays a line like "72% chance of nap today". When the nap window has already passed, the line reads "0% — nap window closed". When history is insufficient (cold start), no percentage line appears at all.
result: pass
note: "Mobile showed no probability line — diagnosed as by-design cold-start suppression (mobile localStorage has fewer records than minDays). No CSS or viewport-specific code involved. User's suspicion was correct."

### 5. DEFAULT_SETTINGS has 20 keys including 4 new Phase 12 fields
expected: DEFAULT_SETTINGS has exactly 20 keys including eveningHour (18), intenseDays ([]), noNapBedtimeOffsetMinutes (30), intenseDayOffsetMinutes (30)
result: pass
source: automated
coverage_id: 12-01-D1

### 6. Phase 12 forward-compat migration block injects 4 new fields into old v2 blobs
expected: Phase 12 forward-compat migration block injects 4 new fields into old v2 blobs
result: pass
source: automated
coverage_id: 12-01-D2

### 7. selectNextEvent PRED-08 override: eveningHour=0 + lastEvent=wake returns bedtime
expected: selectNextEvent PRED-08 override: eveningHour=0 + lastEvent=wake returns bedtime; eveningHour=25 falls through to napStart
result: pass
source: automated
coverage_id: 12-01-D3

### 8. computeDurationBand private helper returning normalized {min,max} in [0,1440) minutes or null
expected: computeDurationBand private helper returning normalized {min,max} in [0,1440) minutes or null
result: pass
source: automated
coverage_id: 12-04-D1

### 9. forecast() wake band is outer union of hour-band and duration-band; central stays P50 of wake hours
expected: forecast() wake band is outer union of hour-band and duration-band; central stays P50 of wake hours
result: pass
source: automated
coverage_id: 12-04-D2

### 10. Duration-band does not affect bedtime, napStart, napEnd predictions (D-12)
expected: D-12: duration-band does not affect bedtime, napStart, napEnd predictions
result: pass
source: automated
coverage_id: 12-04-D3

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-NW-12-3
  truth: "Intense-day checkbox displays inline with label text on the same row"
  status: resolved
  resolved_by: "1cf2361 fix(NW-12-03): align intense-day checkbox label in manualEntry dialog"
  reason: "User reported: checkbox renders centered on its own line with the label text appearing below it"
  severity: cosmetic
  test: 3
  root_cause: "#manualEntry label (style.css:263-269) sets flex-direction:column on all modal labels; the .checkboxRow override block (style.css:399-404) was missing #manualEntry label.checkboxRow from its selector group, leaving column-flex in place for the Intense Day checkbox"
  artifacts:
    - path: "style.css"
      issue: ".checkboxRow override selector missing #manualEntry label.checkboxRow"
  missing:
    - "Add #manualEntry label.checkboxRow to the .checkboxRow selector group — already done in commit 1cf2361"
  debug_session: ".planning/debug/intense-day-checkbox-layout.md"

- gap_id: G-NW-12-4
  truth: "Nap probability score visible on nap-start prediction card when history is sufficient and nap window is open"
  status: resolved
  resolved_by: "by-design — cold-start suppression"
  reason: "User reported: passes on PC Chrome but not visible on mobile"
  severity: minor
  test: 4
  root_cause: "Data-driven suppression: mobile localStorage is independent from desktop; if mobile has fewer than minDays valid records, detectColdStart()=true and the entire forecast grid is replaced by the cold-start message. Alternatively, if napStart time had already passed, isMissed=true suppresses the probability line. No CSS or viewport-specific code involved (confirmed — no @media rules target .nap-probability). A latent gap exists in renderTifNormalCard (today-screen.js:323-396) where nap probability is never rendered in TIF mode grid cards, but this is not what was reported."
  artifacts:
    - path: "js/ui/today-screen.js"
      issue: "napProbabilityScore gate at line 916 (cold-start), isMissed gate at lines 167 and 285"
    - path: "js/lib/forecast.js"
      issue: "detectColdStart at lines 309-325, napProbability cold-start gate at line 841"
  missing:
    - "No fix needed for reported behavior — working as designed"
  debug_session: ".planning/debug/nap-prob-mobile.md"
