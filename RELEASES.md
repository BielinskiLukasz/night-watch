# Release Notes

## 🟩 **v1.2.0**
*Release date: 2026‑08‑24*

Two-phase Prediction & Metrics milestone — 17 requirements satisfied, all UAT passed, no regressions.

### Features

**Phase 10 — TIF Algorithm & Settings**

- **Algorithm selector** (TIF-01): New "Forecast algorithm" dropdown in Settings (Classic / TIF). Choice persists across sessions; Classic remains the default.
- **Trim percentage** (TIF-02): User can set the TIF auto-trim percentage (0–40, step 1, default 10) — controls how many extreme-value events are excluded per event type before any window is computed.
- **Precision target** (TIF-03): User can set the maximum width of a displayed TIF prediction window in minutes (default 60). Setting persists across sessions.
- **Multi-window wake prediction** (TIF-04): When TIF is active, wake-up forecasts derive from the intersection of three independent windows: historic wake-time band, sleep-duration band projected from bedtime anchor, and combined sleep+nap duration band.
- **Multi-window nap-start prediction** (TIF-05): Nap-start forecast is the intersection of two windows: historic nap-start band and activity-before-nap duration projected from wake anchor.
- **Multi-window nap-end prediction** (TIF-06): Nap-end forecast is the intersection of two windows: historic nap-end band and nap-duration projected from nap-start anchor.
- **Multi-window bedtime prediction** (TIF-07): Bedtime forecast is the intersection of three windows: historic bedtime band, day-length projected from wake anchor, and activity-after-nap duration projected from nap-end anchor.
- **Intersection/union fallback** (TIF-08): When the intersection of all windows is non-empty, TIF uses that range; when empty (start > end) it falls back to the union and marks the prediction "low confidence".
- **Precision score** (TIF-09): Each TIF prediction displays a precision score: 100% when the algorithm's computed range ≤ precision target; `precisionTarget / algRange × 100%` otherwise.
- **Window narrowing** (TIF-10): When the computed range exceeds the precision target, the displayed window is narrowed to precision-target width centered on the midpoint; the full range and score remain visible.
- **Cold-start & outlier respect** (TIF-11): TIF predictions obey the existing cold-start gate and manual rejected-day flags; rejected events count against the trim budget before auto-trim is applied.

**Phase 11 — Metrics Screen**

- **Metrics tab** (MET-01): New 5th tab in the bottom navigation bar (Today | History | Charts | Accuracy | Metrics).
- **Per-day duration metrics** (MET-02): Each logged day shows sleep duration (night only), nap duration, combined sleep+nap duration, and day length (wake→bedtime).
- **Per-day activity breakdown** (MET-03): Each day shows total activity time (day length − nap duration), activity before nap (wake→nap-start), and activity after nap (nap-end→bedtime).
- **Per-day ratio metrics** (MET-04): Activity-after-sleep factor (activity time ÷ night-sleep duration) and sleep-after-activity factor (night-sleep duration ÷ previous day's activity time) per day.
- **Historical aggregates** (MET-05): Average, minimum with date, and maximum with date for every displayed metric.
- **Stage filtering** (MET-06): When a stage is active, a toggle scopes the Metrics screen to that stage's date range — same behaviour as the Charts screen stage filter.

**General**

- **"Add event" button moved into the quick-log row**: The button sits alongside the four quick-log buttons rather than above the prediction cards, reducing the distance to tap when logging rapidly.

### Infrastructure

- **`js/lib/metrics.js` shared module** (Phase 10, plan 10-01): Six pure duration/activity helpers — `sleepDuration`, `napDuration`, `activityBeforeNap`, `activityAfterNap`, `dayLength`, `combinedSleepNap` — consumed by both `forecast-tif.js` and `metrics-screen.js` to keep formulas in one place.
- **`chart-data.js` refactored** to reuse `sleepDuration` and `napDuration` from `metrics.js`, eliminating duplicate implementations.

### Fixes

- **Overnight sleep duration** (Phase 11, plan 11-06 / 11-10): Wake events now always pair with the *previous* day's bedtime for sleep-duration calculation, fixing wrong same-day pairing and ensuring date attribution matches the night the sleep actually covered.
- **SAA on no-nap days** (Phase 11, plan 11-09): Sleep-after-activity factor is now computed using `dayLength` as the activity proxy on days with no nap logged, instead of returning `null`.
- **Oldest-first ordering in aggregates** (Phase 11): `aggregateMetrics` now receives days in oldest-first order before accumulating; aggregate min/max dates were previously misattributed.
- **Metrics screen display and logic** (code review CR-01, CR-03, CR-02, WR-01–WR-03): Fixed column ordering, button alignment, gutter sizing, and napDuration efficiency in the metrics-screen render path.

### Test suite

| Layer | v1.1 baseline | v1.2 | Delta |
|---|---|---|---|
| Unit + Integration | 531 | 647 | +116 |
| E2E (Playwright / Chromium) | 104 | ~111 | ~+7 |
| **Total** | **635** | **~758** | **~+123** |

647 unit/integration tests pass; 0 regressions against v1.1 suite.

---

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
