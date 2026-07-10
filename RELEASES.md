# Release Notes

## 🟩 **v1.1.0**
*Release date: 2026‑07‑10*

Single-phase UX polish milestone — all 9 requirements satisfied, 13/13 UAT passed, no regressions.

### Features

- **History edit-mode toggle** (UI-07): Edit controls hidden by default behind an "Edit history" button. State resets automatically when switching to another tab.
- **"+ Add event" button repositioned** (UI-08): Moved above the prediction cards on the Today screen so it is always in reach without scrolling past forecasts.
- **"Next Predicted Event" hero label** (UI-10): The hero forecast card now displays a clear label so the primary prediction is immediately identifiable.
- **Probability-band cards collapsed by default** (UI-09): Uncertainty bands no longer dominate the screen; each card expands on tap and can be re-collapsed.
- **"Confirm before logging" toggle** (CFG-10 / LOG-10): New toggle in the Time & Day settings group. When ON, quick-log buttons open a pre-filled dialog instead of saving immediately — type and time are pre-populated from the button tapped.
- **"Save more" button for bulk entry** (LOG-11): Available on the manual-entry dialog; saves the current event, advances the type sequence (wake → sleep → nap start → nap end), and reopens the dialog. Absent on the confirm-before-logging quick-log path.

### Infrastructure

- **Forecast E2E spec rewritten** (PLAT-12): `forecast.spec.js` now uses a 32-day / 4-type fixture (128 events via `makeBaselineDb()`) so tests exercise the real forecast algorithm rather than a trivial seed.
- **Remove `nw-research-test/`** (PLAT-13): Scratch test directory removed from the repository root; no production imports affected.

### Fixes

- **Edit mode not resetting on tab switch** (UI-07): The `editMode` local variable in `mountHistoryScreen` was never reset because the tab system uses CSS show/hide, not DOM remounting. Fixed by returning `resetEditMode()` from the mount function and calling it from `app.js` `onTabChange`. (commit `3866bac`)
- **Confirm-before-logging dialog not pre-filling type or time** (LOG-10): Pre-fill was gated on `mode === 'edit' && existing`; the confirm-before-logging path uses `mode: 'add'` with `existing` set, so the condition was never true. Broadened to `if (existing)`. (commit `cbd225f`)
- **Missing spacing below "+ Add event" button** (UI-08): Added `margin-bottom: 1rem` to `.addEventBtn` so there is a visual gap between the button and the hero card. (commit `0997b24`)

### Test suite

| Layer | v1.0 baseline | v1.1 | Delta |
|---|---|---|---|
| Unit + Integration | 495 | 531 | +36 |
| E2E (Playwright / Chromium) | ~97 | 104 | +7 |
| **Total** | **~592** | **635** | **+43** |

All 635 tests pass; 0 regressions.

---

## 🟩 **v1.0.1**
*Release date: 2026‑07‑03*

Post-release housekeeping patch — no user-facing feature changes.

### Fix
- **E2E test race condition** (`tests/e2e/settings-modal.spec.js`): Guard CFG-01 and CFG-02..07 reload tests against the `<dialog>` close macrotask race. Adds intermediate DOM assertions (subject name text / `aria-pressed` attribute) so `localStorage` is written before `page.reload()` fires.

### Infrastructure
- **Remove CI/Deploy workflow** (`.github/workflows/ci.yml`): The workflow assumed npm dependencies and Playwright setup that conflict with the project's no-build, no-dependencies constraint. Removed; tests remain runnable locally via `npm test` and `npm run test:e2e`.

### Docs & planning
- Add v1.0.0 release notes (`RELEASES.md`) and update README for the v1.0.0 release; bump version badge to 1.0.1.
- Add v1.0 milestone audit (`v1.0-MILESTONE-AUDIT.md`).
- Archive v1.0 milestone: freeze `REQUIREMENTS.md` and `ROADMAP.md` into `milestones/v1.0-*`; trim live planning docs to v1.1 scope.
- Add backlog items B-23 (wrong event-type dropdown order), B-24 (additional planning item), B-25 (more charts + sleep-length calculation audit).
- Disable auto tag creation in GSD config.

---

## 🟩 **v1.0.0**  
*Release date: 2026‑07‑01*

Full v1.0.0 release of Nightwatch — a vanilla-JS, offline-first PWA for tracking infant sleep (night sleep + naps) and forecasting the next sleep events with explicit uncertainty handling and prediction-accuracy scoring.

Built across 8 vertical-slice phases, all completed and verified on develop.

## What's included

### Phase 1 — Log & Persist
- Event log store with localStorage persistence and schema versioning
- Four quick-log buttons (wake / sleep / nap start / nap end)
- Manual entry modal with 5-min rounding, future-date guard, and edit/delete
- Day-grouped list with subjective-night bucketing (configurable cutover hour)

### Phase 2 — Configuration & Settings
- Settings modal: subject name, cutover hour, 12 h/24 h clock, day-grouping toggle
- validateSettings + migrateV1→V2 with backwards-compatible schema evolution

### Phase 3 — Forecast Engine
- Empirical-CDF percentile algorithm over rolling history window
- Probability-band fallback when ±delta > max_delta (honest uncertainty)
- Cold-start gating (no forecast until minimum history threshold met)
- Cycle-aware selectNextEvent — picks next wake/bed/nap in chronological order
- Live forecast card on Today screen with reactive store subscriptions

### Phase 4 — History Screen & Edit/Delete
- Tabbed Today | History navigation
- Day-column history table with newest-first ordering
- Inline edit/delete affordances with reactivity
- Rejected-day toggle per day (excluded from forecast window)

### Phase 5 — Data Import/Export
- CSV import translated from the Polish sen.xlsx column schema
- JSON round-trip export/import with version guard and confirmation dialog
- store.replace() for full data replacement on import

### Phase 6 — Life Stages
- Stage (etap) schema in settings with full CRUD modal
- Stage selector on Today screen — filters forecast to active stage window
- etap column parsing from CSV import wired to stages store

### Phase 7 — Charts, Heatmap & Accuracy
- Four-screen bottom nav: Today | History | Charts | Accuracy
- SVG charts: sleep-duration trend, bedtime/wake scatter, nap scatter, time-band, heatmap
- Heatmap with 6-bucket color scale and hover tooltips
- Accuracy backtesting engine — scores past predictions against logged actuals
- Accuracy screen: 4×3 grid of per-event-type accuracy metrics

### Phase 8 — PWA Hardening & Visual Polish
- manifest.json, sw.js with cache-first precaching, icons/ (192 + 512 px)
- SW lifecycle wiring: update banner, skip-waiting, reload on activation
- GitHub Actions CI (Playwright E2E + Vitest unit) and Pages deploy workflow
- Visual identity polish: chart animations, typography normalization, settings 5-group reorg

## Verified
- Unit tests: `npm test` — 500+ unit + integration tests (Vitest)
- E2E tests: `npm run test:e2e` — 14 spec files (Playwright)
- PWA install on mobile: manifest resolves, offline works, update banner fires
- Import sen.csv → history populates and forecast renders
- JSON export → re-import → round-trip is lossless
- Accuracy screen shows scores after ≥ 7 days of history
