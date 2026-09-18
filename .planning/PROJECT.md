# Nightwatch

## What This Is

Nightwatch is a vanilla-JS, offline-first web app for tracking a single subject's
sleep (night sleep + naps) and forecasting their next sleep events — next wake-up,
next bedtime, next nap start, next nap end — with explicit uncertainty handling
and prediction-accuracy scoring. It is seeded by an existing multi-month dataset
(see Context) and is intended to replace the manual spreadsheet workflow with
an app that updates predictions automatically as new events are logged.

The product is inspired in spirit by `../mindful-breathing` (vanilla HTML/CSS/JS,
no build, no dependencies, installable PWA, works offline), but the codebase is
deliberately split across multiple files for readability.

## Core Value

Given a sufficient history of sleep events, predict the next ones accurately
enough to be useful — and show the user, transparently, how accurate the
predictions have been over time. If the prediction is too uncertain to pin to a
single time, fall back to a probability band over a window.

If everything else fails, this must work: enter today's events, see tomorrow's
predicted wake/bed/nap times with bands, and check how yesterday's predictions
compared to reality.

## Requirements

### Validated

**v1.0 — Core application (shipped 2026-06-30)**
- ✓ Quick-log buttons that auto-timestamp now: "Woke up", "Going to sleep", "Nap start", "Nap end" — v1.0
- ✓ Form-based entry for editing past days and back-filling — v1.0
- ✓ All times captured/displayed at 5-minute precision — v1.0
- ✓ Single nap per day (matches existing data shape) — v1.0
- ✓ Day boundary is a configurable sleep-cycle cutover hour (default ~04:00) — v1.0
- ✓ Single user-configurable subject profile (display name only) — v1.0
- ✓ Settings: max_delta, min_days, outlier rules, rolling window, stat blend, cutover hour, time format — v1.0
- ✓ Predict next four events (wake, bed, nap start, nap end) with central time + min/max band — v1.0
- ✓ Probability-band fallback when ±delta exceeds max_delta — v1.0
- ✓ Cold-start gate — v1.0
- ✓ Reactive prediction updates on event log/flag changes — v1.0
- ✓ Today + forecast screen — v1.0
- ✓ History list with edit/delete and per-day rejected toggle — v1.0
- ✓ Charts + heatmap (5 SVG visualizations) — v1.0
- ✓ Accuracy dashboard (3 success metrics) — v1.0
- ✓ File-as-truth storage (JSON canonical, localStorage cache) — v1.0
- ✓ CSV + JSON import, JSON export — v1.0
- ✓ Manual stage boundaries with scope-to-stage forecast — v1.0
- ✓ Vanilla HTML/CSS/JS, multi-file architecture, installable PWA, GitHub Pages — v1.0
- ✓ TDD scaffold: unit + integration + E2E via node:test + Playwright — v1.0

**v1.1 — UX Polish (shipped 2026-07-10)**
- ✓ History edit-mode toggle (controls hidden by default, revealed on tap) — v1.1
- ✓ Confirm-before-logging setting (pre-filled dialog on quick-log tap) — v1.1
- ✓ "Save more" bulk-entry button (keeps dialog open, auto-advances event type) — v1.1
- ✓ Probability-band cards collapsed by default (compact single-line summary) — v1.1
- ✓ Today screen clarity: "Add event" button above prediction cards, hero card label — v1.1
- ✓ Forecast E2E rewritten with 32-day 4-type fixture — v1.1

**v1.3 — Prediction & TIF Enhancements (shipped 2026-08-31)**
- ✓ Evening-hour override: when hour ≥ 18 and last event is wake, predict bedtime not nap — v1.3
- ✓ Wake predictions unioned from hour-band and sleep-duration-band — v1.3
- ✓ Intense-day flag per event-entry form, stored in history, used as TIF contextual modifier — v1.3
- ✓ Missed-nap bedtime shift: no nap by threshold hour → earlier bedtime prediction — v1.3
- ✓ Nap probability score on Today screen (frequency + time + streak + window-passed) — v1.3
- ✓ TIF nap-start ratio window (activityBeforeNap/sleepDuration), nap-end ratio window (activityBeforeNap/napDuration) — v1.3
- ✓ TIF rolling-window variant (tifRollingDays, configurable 3–90); MA/AA values preferred when recorded — v1.3
- ✓ TIF per-window medians; central prediction = average of window medians — v1.3
- ✓ TIF no-nap-day substitution: day-length bands replace activity-after-nap on no-nap days — v1.3
- ✓ TIF Accuracy screen: per-event window hit rate, avg window width, ≥80% confidence % — v1.3
- ✓ Day/Sleep Factor replaces SAA ratio column in Metrics screen — v1.3
- ✓ TIF raw bounds and confidence score per event shown in Metrics screen — v1.3
- ✓ MA/sleep ratio and MA/nap ratio columns added to Metrics screen — v1.3
- ✓ Algorithm selector moved to top of Forecast fieldset; classic/TIF option groups show/hide — v1.3

**v1.2 — Prediction & Metrics (shipped 2026-08-24)**
- ✓ TIF algorithm opt-in toggle (forecastAlgorithm: classic | tif) persists across sessions — v1.2
- ✓ TIF trim % (0–40) and precision target (minutes) settings with full persistence — v1.2
- ✓ TIF wake/bed/nap predictions from multi-source window intersection with precision scoring — v1.2
- ✓ TIF low-confidence fallback to union range when intersection is empty — v1.2
- ✓ TIF window narrowing to precision target; original range and score remain visible — v1.2
- ✓ Metrics screen — dedicated 5th bottom-nav tab — v1.2
- ✓ Per-day sleep/nap/activity duration metrics — v1.2
- ✓ AAS and SAA ratio metrics with no-nap-day computation — v1.2
- ✓ Historical aggregates (avg, min with date, max with date) for all metrics — v1.2
- ✓ Stage-scoped Metrics filtering — v1.2

**v1.4 — TIF Fixes & Metrics Depth (shipped 2026-09-08)**
- ✓ FIX-01: latestAt guard in findBedtimeDayRecord prevents bare-string entries displacing ISO-dated selection — v1.4
- ✓ FIX-02: rejectedInWindow threaded to all primary band-building calls; postNoNapNapStartTimes retains 0 — v1.4
- ✓ FIX-03: tifForecast override block in metrics-screen render() preserved and day-order corrected (newest-first) — v1.4
- ✓ FIX-04: computeTifTrimmedStats JSDoc clarified re: bare HH:MM and ISO inputs both handled — v1.4
- ✓ FIX-05: settings-validate.test.js tifRollingDays upper-bound description corrected from 31 to 91 — v1.4
- ✓ MET-09: 7-day rolling window aggregates for all Metrics screen columns — v1.4
- ✓ MET-10: 14-day rolling window aggregates for all Metrics screen columns — v1.4
- ✓ MET-11: Per-weekday average metrics (MA, AA, nap duration, sleep duration) — v1.4
- ✓ MET-12: Day-of-week collapsible section in Metrics screen — v1.4
- ✓ MET-13: Sleep debt proxy column (S.Debt(7d)) in Metrics per-day table and rolling aggregates — v1.4
- ✓ MET-14: targetSleepMinutes setting (default 600 min) with median hint from event log — v1.4

**v2.0 — Prediction Engine & Autosave (Phase 19, 2026-09-14)**
- ✓ Split bedtime model: separate nap-day vs no-nap-day P10/P50/P90 distributions with probability-weighted blend — Phase 19 (PRED-18, PRED-19)
- ✓ Wake-anchored nap-start/end: Classic nap anchored to today's wake via activity-gap percentiles; nap-end via duration percentiles — Phase 19 (PRED-20, PRED-21, PRED-22)

**v2.0 — Prediction Engine & Autosave (Phase 20, 2026-09-16)**
- ✓ Nap probability redesign: `napProbability()` rewritten to return `{score, signalsUsed, confidence}` with weight redistribution across 4 signal-availability combinations, decoupled from time-of-day — Phase 20 (PRED-23 groundwork)

**v2.0 — Prediction Engine & Autosave (Phase 21, 2026-09-16)**
- ✓ Prediction normalization: `nextReachableEvent`/`selectNextEvent` 5-path event-reachability model extracted to `js/lib/forecast-utils.js`; napStart card fully hidden (not collapsed) once its window closes; `napWindowClosed` fully decoupled from the nap score — Phase 21 (PRED-23, PRED-24)
- ✓ Dual hero cards + `predictions.bedtimeAfterWake` + collapsed-by-default "Later today" section replacing the flat 4-card grid — Phase 21 (PRED-24, UI-13)

**v2.0 — Prediction Engine & Autosave (Phase 22, 2026-09-17)**
- ✓ Linear-decay per-event accuracy formula: `eventAccuracyScore()` (D≤W→100−(50/W)×D; W<D≤2W→50−(50/W)×(D−W); D>2W→0) replaces the old binary within-max-delta/within-half-delta/inside-band hit-miss counters — Phase 22 (ACC-01, ACC-02)
- ✓ Daily/overall accuracy is the arithmetic mean of per-event scores, with a mean-of-daily-means overall headline score — Phase 22 (ACC-03)
- ✓ Bedtime nap-day/no-nap-day split applied consistently across `accuracy.js` and `accuracy-tif.js`, plus band-approximated score marker — Phase 22 (ACC-04)
- ✓ `accuracy-screen.js` rewritten to render the new score-based shapes (single avgScore column, overall headline, approximated-score footnote, matching TIF table split) — Phase 22 (ACC-04)

**v2.0 — Prediction Engine & Autosave (Phase 23, 2026-09-17)**
- ✓ Per-day TIF prediction-window table (12 per-event min/max/confidence columns) added to the Accuracy screen, sourced from the full stage-filtered `days` array so warm-up days render dashed rather than being silently dropped — Phase 23 (UI-11)
- ✓ Same 12 TIF window columns and their rendering/data-prep pipeline fully removed from the Metrics screen (31→19 columns); `isTif`/TIF aggregate rows/`tifForecast` override left untouched — Phase 23 (UI-11)

**v2.0 — Prediction Engine & Autosave (Phase 24, 2026-09-18)**
- ✓ Autosave to a user-picked local directory via the File System Access API: pick/persist/restore round trip through an inline IndexedDB handle store, debounced (500ms) write on every event-log mutation, graceful fallback (manual Export button + explanatory note) when the API is unavailable — Phase 24 (PLAT-01, PLAT-02, PLAT-03, PLAT-04)
- ✓ Settings "Backup" fieldset with 4 folder-row states (unsupported/unset/denied/set) and a first-launch discovery banner on the Today screen, both writing/reading a shared `autosaveBannerDismissed` flag so dismissal state stays consistent across either entry point — Phase 24

**v2.0 — Prediction Engine & Autosave (Phase 25, 2026-09-18)**
- ✓ Algorithm C: `js/lib/forecast-blend.js` exports `blendForecast(dayRecords, snap)` covering all 4 events — dual-model wake blend (A1 historic band + A2 sleep-length projection), three-band bedtime blend (historic + day-length + AA), nap-start/nap-end blends — Phase 25 (PRED-13, PRED-14, PRED-15, PRED-17)
- ✓ Interval stability check (circular/modular-aware intersection/shrinkage when intervals overlap, union range when they don't) applied to all 4 events, including raw clock-time-of-day samples that straddle the midnight boundary — Phase 25 (PRED-16)
- ✓ Three-option algorithm selector (Classic / TIF / Algorithm C) in the Settings modal with context-sensitive fieldset show/hide — Phase 25 (UI-12)
- ✓ `forecast-blend.js` added to `PRECACHE_LIST` in `sw.js` and `tests/unit/sw-precache.test.js` — Phase 25

### Out of Scope

- **Multi-profile switching** — single subject in v1; multi-subject would change persistence shape. Defer to v2.
- **Multiple naps per day** — existing data has at most one nap/day; deferred to v2 to keep storage shape stable.
- **Auto-detected life stages** — change-point detection on sleep duration is statistically nontrivial. Manual stages in v1, auto suggestion in v2.
- **Browser / OS push notifications** — adds permission flows and a more complex service worker. v2.
- **Polish UI** — English only in v1; spreadsheet column names remain internal mapping concerns. Polish localization possible later.
- **Direct .xlsx import** — primary import paths are CSV (known schema) and JSON. The existing `sen.xlsx` will be one-time-converted to CSV (either via Excel "Save As CSV" or a small one-shot migration utility outside the runtime app). Why: a pure-vanilla, no-dependency app cannot read .xlsx without bundling a 200+ KB parser.
- **Backend / accounts / cloud sync** — offline-first, file-as-truth, no server.
- **Frameworks / build tooling / npm dependencies** — explicit constraint inherited from `../mindful-breathing`.

## Context

**Existing dataset (`sen.xlsx`):** The user has accumulated daily sleep tracking data in a two-sheet spreadsheet authored in Polish. Translated column schema:

*Sheet 1 "Dane" (Daily log):* `Data` (date), `Pobudka` (wake-up), `Zaśnięcie` (bedtime), `Drzemka start/stop` (nap start/end), `Długość drzemki` (nap length), `Długość dnia` (day length = awake time), `Aktywność` (activity), `Od drzemki` (time since nap), plus per-row rolling/aggregate columns: `średnia`/`mediana` (mean/median), `min`/`max`, `Długość snu` (sleep length) with variants `z drzemką` (with nap) and `z dnia kolejnego` (carrying to next day), and `Aktywność/Sen z 2/3/4 dni` (2-, 3-, 4-day rolling activity & sleep), `odrzucone` (rejected — manual outlier flag).

*Sheet 2 "Prognoza" (Forecast):* Predicted events `wstał`, `zasnął`, `początek/koniec drzemki` each with `min`/`max` bands; per-event deltas vs actual `pobudka delta`, `sen delta`, `drzemka delta`, `przebudzenie delta`; plus `etap` (stage), `drzemka była?` (was there a nap?), and `mediana & średnia` blend.

This schema is the source of truth for the app's data model. Nightwatch effectively automates and improves on the manual spreadsheet workflow.

**Reference app (`../mindful-breathing`):** Single-file vanilla-JS PWA. Demonstrates the offline + service worker + localStorage + Web APIs pattern Nightwatch will follow. Lives at `https://bielinskilukasz.github.io/mindful-breathing/`. Key takeaways: no build pipeline, no dependencies, works from `file://`, `Object.freeze` config, `requestAnimationFrame` loops, secure-context-only browser APIs.

**Planning artifact preference:** The user wants the planning output structured as separate Markdown files covering user flow, releases, epics, features, user stories, non-technical requirements, and technical tasks. The GSD pipeline maps to this naturally: PROJECT.md (context + non-functional constraints), REQUIREMENTS.md (features + user stories), ROADMAP.md (releases / epics as phases), per-phase PLAN.md (technical tasks). User flow can live inside REQUIREMENTS.md or as a sibling document depending on the roadmap's shape.

## Constraints

- **Tech stack**: Vanilla HTML/CSS/JS only — No frameworks, no transpilers, no npm dependencies, no build step. Same constraint as `../mindful-breathing`.
- **File structure**: Multi-file — Split HTML/CSS/JS into separate files for clarity, unlike mindful-breathing's single-index.html constraint.
- **Persistence**: Browser-native only — localStorage for cache, File API (download/upload) for canonical JSON export/import. No backend, no IndexedDB if avoidable for v1.
- **Distribution**: Static hosting only — Must work on GitHub Pages and from local `file://`; no server-side code.
- **Offline-first**: PWA — Service worker for asset caching; full functionality without network.
- **Time precision**: 5-minute rounding — Both at entry and display; matches typical human entry behavior and the spreadsheet's effective precision.
- **Language**: English UI only — v1; Polish column names live in import/migration code only.
- **Browser support**: Modern evergreen — Chrome/Edge/Firefox/Safari current versions. Same matrix as mindful-breathing.
- **Runtime dependencies**: Zero — `package.json` may exist for `devDependencies` only (Playwright + lockfile). The deployed PWA bundle (everything served from GitHub Pages) contains no `node_modules/`, no bundled libraries, no runtime npm imports.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Working title "Nightwatch" | User picked from a shortlist; evokes observation + prediction, distinct from "Sleep Tracker" | ✓ Good — name stuck through 3 milestones |
| Single configurable subject (no multi-profile in v1) | Multi-profile changes persistence shape and routing; deferring keeps v1 focused | ✓ Good — constraint held cleanly |
| File-as-truth storage (JSON export = canonical, localStorage = cache) | User explicitly preferred treating the exported file as the source of truth; survives browser data clears | ✓ Good — no issues in practice |
| Sleep-cycle day boundary, configurable, default ~04:00 | One night = one day; avoids splitting a single sleep across two calendar dates | ✓ Good — timezone-safe string-slice approach proved robust (v1.2 overnight pairing) |
| Multi-file vanilla JS, no build | Inherit mindful-breathing's no-dependency philosophy but split for readability since this app is structurally larger | ✓ Good — 264 files managed cleanly without bundler |
| Probability-band fallback on high uncertainty | When ±delta > max_delta, show `P(event)` curve over time instead of a single point — surfaces uncertainty honestly | ✓ Good — TIF adds a second fallback path (low-confidence union range) |
| All four v1 screens (Today, History, Charts+heatmap, Accuracy) | User selected all four explicitly | ✓ Good — all shipped; Metrics added as 5th in v1.2 |
| Manual stages in v1, auto-detection in v2 | Change-point detection is statistically nontrivial; defer until manual workflow proves value | ✓ Good — manual stages used actively in v1.2 Metrics screen |
| 24h default, 12h toggle in Settings | Matches Polish convention and the existing spreadsheet | ✓ Good |
| 5-minute precision | Cleaner stats; matches typical entry behavior | ✓ Good |
| Three success metrics on the Accuracy dashboard | User wanted all three (within max_delta / within tighter band / inside probability band) shown side-by-side | ✓ Good |
| Direct .xlsx import not in v1 | A pure-vanilla, no-dependency app cannot parse .xlsx without bundling a heavy library; user converts to CSV one-time | ✓ Good |
| Unit tests via Node's built-in `node:test`, runtime stays dependency-free | Tests are dev-time only; logic structured as ESM modules so the same files import in both browser (`<script type="module">`) and Node. Unit tests live under `tests/unit/`, excluded from PWA precache. CI uses zero-install `node --test`. | ✓ Good — suite grew to 647+ unit/integration tests |
| Integration tests in Node via DOM/storage/clock adapters | App structured with thin adapters so modules can be composed and exercised together in Node without a real browser. Drives clean seams from Phase 1 onward. Zero npm dependency. Lives under `tests/integration/`. | ✓ Good — adapter seams held through all 3 milestones |
| Playwright for end-to-end UI tests, dev-only dependency | E2E coverage via a real headless browser; runtime app remains pure-vanilla with zero runtime dependencies. Playwright in `devDependencies`, `tests/e2e/` excluded from PWA bundle, GH Action installs Playwright and runs the suite alongside unit + integration. | ✓ Good |
| Test-Driven Development (TDD) is the primary development discipline | Strict red→green→refactor for pure-logic and integration tests; UI code may be written test-after with one E2E test as a regression guard. Every shipped requirement has at least one automated test. Plans split into 'write test' → 'implement' subtasks where it makes sense. | ✓ Good |
| TIF is additive only; classic forecast.js remains untouched and is the default | TIF ships as opt-in toggle; existing Classic algorithm unchanged | ✓ Good — v1.2 delivered |
| metrics.js is a shared module consumed by both TIF (duration bands) and Metrics screen | Single source of truth for duration/ratio calculations across both features | ✓ Good — no duplication in either consumer |
| tifForecast override block in metrics-screen render() is NOT redundant | computeTifTrimmedStats uses plain trimmedMinMax with no rejection logic; tifForecast sourceWindows runs full band-building with rejectedInWindow — without the override the two screens diverge. Discovered during NW-15 UAT. | ✓ Required — restored with day-order fix |
| tifForecast in metrics-screen.js must receive newest-first days (same as daysBySubjectiveNight output) | tifForecast uses slice(-N) to select the rolling window; oldest-first input would select a different (older) window than Today screen. Day order must match. | ✓ Fixed in NW-15 UAT |
| Phase 19 D-09: PRED-11 `noNapFired` block permanently removed from `forecast()` | Split bedtime model (nap-day vs no-nap-day series) supersedes the blunt evening-hour missed-nap bedtime shift; removing PRED-11 eliminates double-application of bedtime adjustments | ✓ Shipped Phase 19 |
| Phase 19 D-10: `noNapBedtimeOffsetMinutes` removed from schema, migration, and validator | Superseded by the split-series model which derives the offset implicitly from historical data; the crude fixed-offset approximation is no longer needed | ✓ Shipped Phase 19 |
| Phase 19 D-13: pre-forecast context assembly in `today-screen.js` | `todayWakeHHMM`, `napProbabilityScore`, and `todayNapStartHHMM` are pre-computed before `forecast()` is called, then passed as context; keeps `forecast()` a pure function that does not touch the DOM or call `napProbability()` itself | ✓ Shipped Phase 19 |
| Phase 20: `napProbability()` returns `{score, signalsUsed, confidence}` instead of a bare number | Weight redistribution across 4 signal-availability combinations makes the score data-driven and time-of-day-independent | ✓ Shipped Phase 20 |
| Phase 21 D-06/D-07: `nextReachableEvent`/`selectNextEvent` extracted to new `js/lib/forecast-utils.js` | Pure 5-path event-reachability model kept separate from `forecast.js` to avoid growing that module further; `selectNextEvent` stays a thin wrapper resolving the wall clock at the UI boundary | ✓ Shipped Phase 21 |
| Phase 21 D-11/D-12: `napWindowClosed` fully decoupled from the nap probability score (finishes a Phase 20 amendment that shipped without this piece) | Score stays clock-invariant; window-closed state now controls DOM visibility (napStart card fully absent, not just visually deprioritized) instead of forcing score to 0 | ✓ Shipped Phase 21 |
| Phase 21 D-08/D-09: dual hero cards + independent `predictions.bedtimeAfterWake` field | When nap status is genuinely undetermined, showing two equally-prominent hero cards is more honest than picking one; `bedtimeAfterWake` is the raw no-nap-day series, kept separate from the blended `predictions.bedtime` | ✓ Shipped Phase 21 |
| Phase 22: old binary within-max-delta/within-half-delta/inside-band hit-miss counters fully removed, replaced by `eventAccuracyScore()`'s linear-decay per-event score averaged into a daily/overall mean | A continuous score is a more granular accuracy signal than three overlapping binary buckets, and matches the tolerance-window mental model already used for prediction bands | ✓ Shipped Phase 22 |
| Phase 22 code review: TIF bedtime windows that cross midnight must be un-wrapped to a monotonic minute range before hit/width computation | `minutesToTime()`'s mod-1440 wrap made a crossing window's algMin > algMax, silently corrupting `avgWidthMin` and guaranteeing a miss for late bedtimes — a realistic case for this app's users, not a synthetic edge case | ✓ Fixed Phase 22 |
| Phase 23: new Accuracy per-day TIF table sources rows from the full `days` array, not `tifBoundsHistory` | `tifBoundsHistory` only covers `tifRollingDays` warm-up-past days; keying off it would silently drop the earliest days instead of showing them dashed | ✓ Shipped Phase 23 |
| Phase 23: `isTif`, TIF aggregate rows, and the `tifForecast` override block deliberately kept in metrics-screen.js after removing the 12 per-event TIF columns | Metrics screen still needs TIF-mode branching for its retained aggregate rows; only the per-event min/max/confidence columns moved to Accuracy | ✓ Shipped Phase 23 |
| Phase 23 code review: new `.tifPerDayTable` on the Accuracy screen has no scroll wrapper (unlike `.metricsTableScroll`) | Flagged as a mobile horizontal-overflow risk, not fixed in-phase — follow-up item, not a blocker | ⚠ Open follow-up |
| Phase 24: banner-dismissal flag set from Settings' `pickOrChange` handler (not by passing `isConfigured` into `mountTodayScreen`) | `js/app.js` calls `restoreHandle()` asynchronously then `mountTodayScreen(...)` synchronously in the same tick, so `autosaveState.status` is still `'unset'` at every `mountTodayScreen` call — passing `isConfigured` would silently fail to suppress the banner for a folder configured in a prior session. Writing the flag at the moment of a real, completed Settings pick sidesteps the race entirely. | ✓ Shipped Phase 24 |
| Phase 24 code review: first-launch banner's own "Set up autosave" button sets the dismissal flag unconditionally after `await autosave.pick()`, regardless of whether the pick succeeded or was cancelled — same bug class as the fixed Settings-modal gap, in the sibling `today-screen.js` code path the gap-closure plan deliberately did not touch | Flagged post-fix, not addressed in-phase — the gap-closure plan's scope was limited to `24-VERIFICATION.md`'s two entries; this is a new, related finding | ⚠ Open follow-up |
| Phase 25: raw clock-time-of-day samples (bedtime/wake/napStart) require circular-aware median/mean, not linear sort/arithmetic mean | A 50/50 split of e.g. 23:50/00:10 samples has a true circular center near midnight, but a linear sort puts the median at noon — `trimmedBand()`'s sort and `combineModels()`'s arithmetic mean were both silently wrong near the wrap boundary even after Plan 25-08 correctly hardened the final interval-comparison layer, because that layer received an already-wrong scalar | ✓ Fixed Phase 25 (Plan 25-09: `circularTrimmedBand()`/`circularMean()` align-then-delegate to the existing linear primitives) |
| Phase 25 code review: `blendForecast()`'s cold-start branch discards `detectColdStart()`'s `minDaysRemaining` (mirrors tifForecast's existing shape) | `today-screen.js`'s `renderColdStartMessage()` reads that field for every algorithm, so a cold-started Algorithm C (or TIF) user sees "Log 0 more days" instead of the real count | ⚠ Open follow-up — pre-existing TIF gap since Phase 10, newly inherited by Algorithm C |

## Current Milestone: v2.0 Prediction Engine & Autosave

**Goal:** Overhaul the forecasting engine with a new multi-band algorithm for all 4 events, redesign the accuracy scoring system, improve nap prediction quality, and add file autosave.

**Target features:**
- ~~New multi-band Algorithm C (all 4 events) with dual-model median blend + interval stability check; settings modal selector UX (B-050 + B-032)~~ ✓ Phase 25
- ~~Split bedtime model: separate nap-day vs no-nap-day distributions (B-052)~~ ✓ Phase 19
- ~~Classic nap anchored to today's wake time via activity-gap percentiles (B-048)~~ ✓ Phase 19
- ~~Nap probability redesign: data-driven, time-independent (B-047)~~ ✓ Phase 20
- ~~Prediction normalization: show only next reachable event (B-038)~~ ✓ Phase 21
- ~~Linear-decay per-event accuracy scoring with tolerance window (B-049)~~ ✓ Phase 22
- ~~Move TIF window columns from Metrics → Accuracy screen (B-041)~~ ✓ Phase 23
- ~~Autosave export to user-chosen directory via File System Access API (B-051)~~ ✓ Phase 24

## Current State (v2.0 — Phase 25 complete 2026-09-18, all 7 phases shipped)

Phases 19-25 complete — v2.0 milestone fully shipped. 984 unit + integration tests, 150 E2E tests, 0 failures. Split bedtime model and wake-anchored nap predictions (Phase 19); data-driven nap-probability redesign decoupled from time-of-day (Phase 20); prediction normalization — 5-path `nextReachableEvent` model, napStart card fully hidden once its window closes, dual hero cards, `predictions.bedtimeAfterWake`, and a collapsed-by-default "Later today" section (Phase 21); accuracy scoring rewritten to a linear-decay per-event formula with bedtime nap-day split and an overall headline score, across both the classic and TIF algorithms and the Accuracy screen (Phase 22); the 12 per-event TIF window columns migrated from Metrics to a new per-day table on the Accuracy screen (Phase 23); autosave to a user-picked local directory via the File System Access API with an inline IndexedDB handle store, debounced writes, a Settings "Backup" fieldset, and a first-launch discovery banner — including a gap-closure pass fixing a Remove-handler race and a banner-dismissal detection gap (Phase 24); Algorithm C — a third selectable prediction algorithm blending multiple models per event (dual-model wake, three-band bedtime, nap-start/end), with a three-way Settings selector and a circular-aware median/mean fix for raw clock-time-of-day samples crossing the midnight boundary, closed across 4 gap-closure plans (Phase 25).

**Next:** v2.0 milestone is 100% complete — run `/gsd-complete-milestone v2.0` to archive and prepare for the next milestone.

**Known open follow-ups:**
- Phase 23 code review flagged the new Accuracy per-day TIF table as missing a horizontal-scroll wrapper on narrow/mobile viewports (`.tifAccuracyTable` also lacks styling) — not a blocker, but worth a small follow-up pass.
- Phase 24 code review flagged: the banner's own "Set up autosave" button doesn't gate the dismissal flag on pick success (same bug class as the fixed Settings-modal gap, different code path); `autosaveActions.remove()` has no try/catch; `autosaveState.error`/`lastSavedAt` aren't reset on pick/remove transitions; IndexedDB connections in `createIndexedDbHandleStore` are never closed. None block the phase goal — tracked for a future pass.
- Phase 25 code review flagged: `alignNearReference()`'s tie-break contradicts its own docstring (favors value-DAY on exact 720-min ties, not "ties keep value"); no E2E Save→reload round-trip test for `blendWindowDays`/`blendTrimPct`/`blendShrinkage`; `blendForecast()`'s cold-start branch drops `minDaysRemaining` (see Key Decisions); a stray `console.log` in the CSV import handler; a stale `noNapBedtimeOffsetMinutes` literal in two `settings-validate.test.js` fixtures; blank-input-coerces-to-0 in `settings-modal.js`'s numeric FormData handling. None block the phase goal — tracked for a future pass.

## Previous State (v1.4 — shipped 2026-09-08)

All 4 v1.4 phases complete. 11/11 requirements satisfied (FIX-01..05, MET-09..14). 918 tests, 0 failures. Tag: `v1.4`.

v1.4 delivered: 5 TIF engine bug fixes, 7-day and 14-day rolling window aggregates, per-weekday pattern rows, and a sleep debt proxy column with configurable target-sleep setting.

**Tech stack as shipped:** Vanilla JS/HTML/CSS, no build, no runtime deps. Layered architecture: `js/lib/` (pure functions) → `js/store/` (stateful pub/sub) → `js/adapters/` (injectable seams) → `js/ui/` (DOM modules). 5 bottom-nav screens: Today, History, Charts, Accuracy, Metrics. Two forecast algorithms: Classic (default) and TIF (opt-in).

**Known issues / tech debt:**
- None at v1.4 close (0 TODO/FIXME markers, 0 open security threats)

## Previous State (v1.2 — shipped 2026-08-24)

Both v1.2 phases complete. 264 files, ~15,500 LOC added over 45 days. All 17/17 v1.2 requirements satisfied. Test suite: 647+ unit/integration tests + E2E coverage for all new screens and algorithm paths.

## Previous State (v1.1 — shipped 2026-07-10)

Nightwatch v1.1 is complete and tagged `v1.1.0`. All 9 v1.1 requirements delivered across 1 phase in 10 days. Building on the v1.0 PWA foundation, v1.1 reduced daily logging friction and improved visual clarity:

- **History edit-mode toggle**: Edit/delete/rejected controls hidden by default; "Edit history" button reveals them; state resets on tab switch
- **Confirm-before-logging**: New toggle in Time & Day settings; when ON, quick-log buttons open the manual-entry dialog pre-filled with current time + event type
- **Save more button**: Bulk entry — saves event, keeps dialog open, advances type through Wake → Nap start → Nap end → Bedtime → Wake (date increments after Bedtime)
- **Prediction card collapse**: Probability-band cards collapsed to compact single-line summary by default; tap to expand
- **Today screen clarity**: "Add event" button above prediction cards; hero card shows "Next Predicted Event" label
- **Test quality**: 635 tests (531 unit/integration + 104 E2E), 0 failures; probability-band E2E rewritten with 32-day 4-type fixture

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`

<details>
<summary>v1.0 — shipped 2026-06-30</summary>

Nightwatch v1.0 tagged `v1.0.0`. All 51 v1 requirements delivered across 8 phases in 35 days:

- **Logging**: 4 quick-log buttons, manual entry/edit/delete, 5-min precision, subjective-night grouping
- **Settings**: subject name, max_delta, min_days, rolling window, stat blend, cutover hour, time format
- **Forecast**: 4-event predictions with min/max bands, probability-band fallback, cold-start gate, reactive updates
- **History**: scrollable table, per-row edit/delete, "rejected" outlier toggle
- **Import/Export**: CSV + JSON import, JSON export, file-as-truth storage model
- **Life stages**: named date ranges, CRUD in Settings, scope-to-stage forecast
- **Charts + Accuracy**: 5 SVG visualizations + 3-metric accuracy dashboard + bottom-nav
- **PWA**: manifest + SW + offline + file:// support + GitHub Pages deploy + 495-test TDD scaffold

Archive: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`
</details>

## Requirements

v1.0 requirements archived to `.planning/milestones/v1.0-REQUIREMENTS.md`.  
v1.1 requirements archived to `.planning/milestones/v1.1-REQUIREMENTS.md`.  
v1.4 requirements archived to `.planning/milestones/v1.4-REQUIREMENTS.md`.  
v2.0 requirements defined in `.planning/REQUIREMENTS.md`.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-18 after Phase 25 (Algorithm C & Settings Modal) — v2.0 milestone complete*
