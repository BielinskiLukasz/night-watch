# Requirements: Nightwatch v1.4

**Milestone:** v1.4 TIF Fixes & Metrics Depth
**Defined:** 2026-08-31
**Core Value:** Given a sufficient history of sleep events, predict the next ones accurately enough to be useful — and show the user, transparently, how accurate the predictions have been over time.

---

## v1.4 Requirements

### TIF Bug Fixes

- [x] **FIX-01**: `findBedtimeDayRecord` in `forecast-tif.js` correctly tracks `latestAt` when iterating bare `'HH:MM'` slot entries, so an older bare-string day cannot beat a newer ISO-string day as the selected bedtime day record
- [x] **FIX-02**: The rejected-day pre-filter in TIF band computation (`forecast-tif.js` ~line 512) preserves the original `manualExcludedCount` semantics, so rejected days that are non-outliers do not cause the auto-trim budget to be applied against fewer data points than intended
- [x] **FIX-03**: `metrics-screen.js` render() does not call `tifForecast` a second time to read back 4 `HH:MM` event-time strings; those values are extracted from data already computed in the same render cycle
- [x] **FIX-04**: The comment in `computeTifTrimmedStats` (`metrics-screen.js` ~line 317) accurately describes that metric rows may contain bare `HH:MM` strings (not only full ISO strings), so maintainers cannot incorrectly conclude the `raw.length > 5` guard is dead code
- [x] **FIX-05**: The test description in `settings-validate.test.js` line 722 correctly reads "rejects 91 (above max=90)" rather than the stale "rejects 31 (above max=90)"

### Rolling Aggregates

- [x] **MET-09**: The Metrics screen displays a 7-day rolling aggregate section (avg, min with date, max with date) for all base metric columns, computed from the 7 most recent non-rejected days in the active stage
- [x] **MET-10**: The Metrics screen displays a 14-day rolling aggregate section (avg, min with date, max with date) for all base metric columns, computed from the 14 most recent non-rejected days in the active stage; the two rolling sections and the existing all-time aggregate are visually distinguished

### Day-of-Week Patterns

- [ ] **MET-11**: `js/lib/metrics.js` (or a sibling module) exposes a `dayOfWeekAverages(dayRecords)` function that groups non-rejected day records by weekday (Mon–Sun) and returns per-weekday averages for MA, AA, nap duration, and sleep duration
- [ ] **MET-12**: The Metrics screen includes a collapsible "Day-of-Week Patterns" section that shows a 7-row (Mon–Sun) table with per-weekday averages for MA, AA, nap duration, and sleep duration, scoped to the active stage

### Sleep Debt Proxy

- [ ] **MET-13**: `js/lib/metrics.js` (or a sibling module) exposes a `sleepDebtProxy(dayRecords, windowDays)` function that computes a rolling accumulated sleep deficit per day (target total sleep − actual total sleep, summed over the window), returning `null` when fewer than `windowDays` non-rejected records are available
- [ ] **MET-14**: The Metrics screen includes a Sleep Debt column (rolling 7-day deficit in minutes) in the per-day table; the column renders `—` on cold-start days; the all-time and rolling aggregate rows include avg/min/max for this column

---

## Future Requirements

### Prediction Engine Integration

- **MET-15**: When TIF is active, the sleep debt proxy value for the current day is passed as an input signal to the TIF nap-start and bedtime prediction windows (higher debt → earlier predicted events)
- **MET-16**: Day-of-week averages are available as an additional TIF source window (one per event type), toggled separately from the existing windows

### Advanced Metrics

- **MET-17**: 14-day rolling averages for day-of-week patterns (not just all-time per-weekday)
- **MET-18**: Rolling std deviation shown alongside avg in aggregate sections (currently only avg/min/max)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| TIF sleep-debt predictor integration (MET-15) | Deferred to v1.5 — needs real-world validation of debt proxy column first |
| Day-of-week TIF source window (MET-16) | Deferred — adds a fourth window type; validate simpler windows first |
| Multi-profile switching | Single subject in v1; multi-subject changes persistence shape |
| Multiple naps per day | Existing data shape has at most one nap/day; deferred to v2 |
| Auto-detected life stages | Change-point detection is statistically nontrivial; manual stages in v1 |
| Backend / cloud sync | Offline-first, file-as-truth; no server |
| Frameworks / build tooling | Explicit constraint from mindful-breathing heritage |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 15 | Complete |
| FIX-02 | Phase 15 | Complete |
| FIX-03 | Phase 15 | Complete |
| FIX-04 | Phase 15 | Complete |
| FIX-05 | Phase 15 | Complete |
| MET-09 | Phase 16 | Complete |
| MET-10 | Phase 16 | Complete |
| MET-11 | Phase 17 | Pending |
| MET-12 | Phase 17 | Pending |
| MET-13 | Phase 18 | Pending |
| MET-14 | Phase 18 | Pending |

**Coverage:**

- v1.4 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-31*
*Last updated: 2026-08-31 — initial definition*
