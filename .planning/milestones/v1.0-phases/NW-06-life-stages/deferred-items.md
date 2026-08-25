# Deferred Items — Phase 6

## Pre-existing E2E failures (out of scope for Phase 6)

**File:** `tests/e2e/settings-modal.spec.js`
**Count:** 11 tests failing
**Origin:** Plans 02-04 / 02-05 (Phase 2 Settings modal)
**Not caused by:** Any Phase 6 changes

### Failing tests:
- CFG-01: subject name appears in h1.subjectName and document.title after Save (D2-11)
- CFG-01: empty subjectName → h1 + document.title both read "Nightwatch" via fallback (D2-11)
- CFG-01: XSS-safe — HTML entities in subjectName render as literal text (Pitfall #5 / T-2-13)
- CFG-01: subject name persists across reload (D2-04 + D2-09)
- D2-14: Cancel button discards pending edits (no settings.update)
- D2-14: ESC discards pending edits (native dialog empty returnValue)
- CFG-02..04, CFG-06..07: forecast-tuning + time/day fields round-trip Save → reload
- CFG-09: switching to 12h — manual-entry HH input becomes 1-12 range with AM/PM select
- CFG-09: switching back to 24h — AM/PM select disappears, HH input restores 0-23
- CFG-09: time format persists across reload — 12h picker reappears on a fresh load
- CFG-09: 12h mode — event row time renders as H:MM AM/PM in the Today list

### Discovery context:
Discovered during Phase 6, Plan 05 full test suite verification (Task 3).
These failures existed before any Phase 6 changes and are not caused by
the CSV import stages wiring introduced in 06-05.

**Recommended action:** Fix in a dedicated Phase 2 bug-fix plan targeting
Settings modal CFG-01 subject name propagation and CFG-09 12h time format
picker behavior.
