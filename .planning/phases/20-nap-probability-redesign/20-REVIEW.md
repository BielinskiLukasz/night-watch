---
phase: 20-nap-probability-redesign
reviewed: 2026-09-16T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - js/lib/forecast.js
  - js/lib/metrics.js
  - js/ui/today-screen.js
  - tests/unit/forecast.test.js
  - tests/unit/metrics.test.js
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-09-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the nap-probability redesign wiring (`napProbability()` in `forecast.js`, the
weighted-signal blend for bedtime prediction, and the Today-screen context threading that
feeds `todayWeekday`/`napStreak`/`.score` into the forecast pipeline). The unit tests for
`forecast.js` and `metrics.js` are thorough and internally consistent, but cross-referencing
them against the *actual* runtime data shape produced by `js/lib/day-bucket.js` and consumed
in `js/ui/today-screen.js` surfaces a serious ordering contract violation: `forecast()`,
`napProbability()` → `sleepDebtProxy()`/`dayOfWeekAverages()`, and the PRED-09 duration-band
logic all assume day records are **oldest-first**, but the Today screen feeds them the
**newest-first** array that `daysBySubjectiveNight()` actually returns — without the
`.reverse()` that `js/ui/metrics-screen.js` already applies for the exact same reason. A
second, independently severe bug was found in the "today's date" lookup used to build the
PRED-10/18/19/21/22 context (`isIntenseToday`, `napStartLogged`, `todayWakeHHMM`,
`todayNapStartHHMM`): it uses `new Date().toISOString()` (UTC) to match against `day.date`
keys that are always local-wall-clock strings, silently breaking the lookup for any user not
at UTC+0, most severely during evening/bedtime hours in negative-UTC-offset zones — exactly
when the new split-bedtime feature is supposed to kick in.

Both are BLOCKER-level correctness bugs that undermine the Phase 20 deliverables (nap
probability score, split bedtime blend, wake-anchored nap start/end) for realistic
production data (any history longer than one `windowDays` window, and any non-UTC
timezone). Several smaller WARNING/INFO issues are listed below.

## Critical Issues

### CR-01: `forecast()` / `napProbability()` consume day records in the wrong order (newest-first vs. required oldest-first)

**File:** `js/lib/forecast.js:662-664`, `js/lib/forecast.js:705-709`, `js/lib/forecast.js:1094`, `js/lib/metrics.js:564-586`, `js/lib/metrics.js:455-491`, `js/ui/today-screen.js:860-945`

**Issue:**
`js/lib/day-bucket.js` (`bucketBy()`, used by both `daysByCalendar()` and
`daysBySubjectiveNight()`) explicitly documents and sorts its output **newest-first**:
```
records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
// @returns {Array<object>}  day records, newest first; ...
```
`js/store/event-log.js` passes this straight through with no reversal.

However, every consumer touched by this phase assumes the opposite (**oldest-first**, i.e.
"last element = most recent day"):

- `forecast()`'s rolling window: `dayRecords.slice(dayRecords.length - windowDays)` is
  documented and unit-tested (`tests/unit/forecast.test.js` "uses windowDays to slice input
  to last N days" / "window truncation") as "take the last N days = most recent N days".
  With real (newest-first) input, this slice instead selects the **oldest** `windowDays`
  records whenever history exceeds the window — i.e. every user beyond their first
  `windowDays` (default 7) days of logging gets a forecast computed from stale, ancient
  data instead of recent trends.
- The `lastBedtimeHHMM` search (`forecast.js:706-709`) walks `window` backwards
  (`for (let i = window.length - 1; i >= 0; i--)`) to find "the most recent bedtime in the
  window" — this only finds the actual most-recent bedtime when the array is oldest-first.
  With real data it walks from the globally-oldest record forward, picking up a stale
  bedtime for the PRED-09 wake duration-band anchor.
- `napProbability()` calls `sleepDebtProxy(dayRecords, 7, settings.targetSleepMinutes)`
  (`forecast.js:1094`) and `dayOfWeekAverages(dayRecords)` (`forecast.js:1083`).
  `sleepDebtProxy` (`metrics.js:564-586`) explicitly requires oldest-first input (its own
  doc: "pre-filtered ... day records, oldest-first"; unit tests build fixtures oldest-first
  and rely on `.slice(-windowDays)` grabbing the *tail* as "most recent"). With newest-first
  real data, `.slice(-windowDays)` grabs the oldest pairs, and the `prevDay = dayRecords[i-1]`
  pairing (`sleepDur = wake[i] - bedtime[i-1]`) pairs each day's bedtime with the **next**
  (more recent) day's wake instead of the previous one — producing a nonsensical sleep-debt
  proxy that directly feeds the NAP-03 signal (20% weight) in the new nap-probability score.

Critically, `js/ui/metrics-screen.js` already knows about and works around exactly this
mismatch:
```js
// aggregateMetrics expects oldest-first (prevDay pairing); bucketBy returns newest-first.
const reversedDays  = [...days].reverse();
```
`js/ui/today-screen.js` has no equivalent reversal before calling `napProbability(forecastDays, ...)`
or `forecast(forecastDays, snap, forecastContext)` (`today-screen.js:925-945`) — it passes
`forecastDays` (derived straight from `eventLog.daysBySubjectiveNight(...)`, optionally
stage-filtered, but never reordered) directly into both.

This is not a theoretical edge case: any subject with more than `windowDays` (default 7)
days of history — i.e. virtually every real user after week one — gets wake/bedtime/nap
predictions computed over the wrong slice of history, and the new NAP-03 sleep-debt signal
computed from inverted day pairs.

**Fix:** Reverse `forecastDays` once before feeding it to `forecast()`/`napProbability()`
(mirroring the existing `metrics-screen.js` pattern), e.g.:
```js
// today-screen.js render()
const forecastDaysOldestFirst = [...forecastDays].reverse();
const napProbabilityScore = napProbability(forecastDaysOldestFirst, snap, { ... });
...
const predictions = snap.forecastAlgorithm === 'tif'
  ? tifForecast(forecastDaysOldestFirst, snap, activityLog, isNoNapDay)
  : forecast(forecastDaysOldestFirst, snap, forecastContext);
```
(Also double-check `tifForecast()`'s own ordering contract — it may already expect
newest-first, in which case only the classic path needs correction. Whichever direction is
chosen, add an integration test that runs `forecast()`/`napProbability()` against the real
`daysBySubjectiveNight()` output — not just hand-built oldest-first fixtures — so this class
of contract mismatch is caught by CI.)

---

### CR-02: "Today's date" lookup uses UTC (`toISOString()`) against local-wall-clock date keys

**File:** `js/ui/today-screen.js:898`

**Issue:**
```js
// gsd:allow-ui-clock — display-only context: we need today's local date to find today's record.
const todayDateStr = new Date().toISOString().slice(0, 10); // gsd:allow-ui-clock
const todayDayRecord = todayAllDays.find(d => d.date === todayDateStr);
```
The comment says this needs "today's **local** date", but `toISOString()` converts to
**UTC** before formatting. `day.date` values, by contrast, are always local-wall-clock
strings (`js/lib/day-bucket.js` builds them from `at.slice(0, 10)` / `subtractOneDay()`,
deliberately never touching UTC — this is a documented project-wide invariant:
"Time strings are local wall-clock, never UTC" / "Never pass event.at directly to
`new Date()`").

For any user not at UTC+0, `todayDateStr` and `day.date` diverge for part of the day. For
negative UTC offsets (e.g. US timezones), this happens in the **evening** — exactly bedtime
— since local evening time is already past midnight UTC. Example: 20:00 local in
America/New_York (UTC-5) is 01:00 UTC the *next calendar day*; `toISOString().slice(0,10)`
returns tomorrow's date, which will never match any existing `day.date`, so
`todayDayRecord` becomes `undefined` even though the subject clearly has a record for today.

The consequence cascades directly into this phase's deliverables
(`today-screen.js:932-940`):
```js
const forecastContext = {
  isIntenseToday: todayDayRecord ? todayDayRecord.intense === true : false,
  napStartLogged: todayNapStart != null,
  todayWakeHHMM,
  napProbabilityScore,
  todayNapStartHHMM,
};
```
With `todayDayRecord` wrongly `undefined`: `isIntenseToday` is forced `false`,
`napStartLogged` is forced `false` (so PRED-18's nap-day bedtime series is never selected
even when a nap really was logged today), and both `todayWakeHHMM` / `todayNapStartHHMM`
are forced `null` (so PRED-21/22's wake-anchored nap-start/end predictions silently fall
back to the plain time-of-day percentile path). This defeats the split-bedtime and
wake-anchored nap features precisely during the evening hours they're meant to serve, for a
large fraction of the user base.

**Fix:** Use a local-date formatter, e.g. reuse the already-imported `formatLocalISO`:
```js
const todayDateStr = formatLocalISO(new Date()).slice(0, 10); // gsd:allow-ui-clock
```
or construct it from local getters directly (`getFullYear()`/`getMonth()`/`getDate()`)
rather than `toISOString()`.

## Warnings

### WR-01: Nap-probability card renders literal "null% chance of nap today" when `.score` is null

**File:** `js/ui/today-screen.js:167-172` (hero card), `js/ui/today-screen.js:285-289` (grid card)

**Issue:** Both card renderers guard only on the *object* being non-null, not on `.score`:
```js
if (prediction.type === 'napStart' && prediction.napProbabilityScore != null && !prediction.isMissed) {
  const napScoreText = prediction.napProbabilityScore.score === 0
    ? '0% — nap window closed'
    : `${prediction.napProbabilityScore.score}% chance of nap today`;
  ...
}
```
`napProbability()` can legitimately return `{ score: null, signalsUsed: [], confidence: 'none' }`
(its own cold-start gate, `forecast.js:1050-1052`, uses raw `dayRecords.length`, which is not
guaranteed to move in lockstep with the classic `forecast()`/TIF cold-start gates — see WR-02).
If that ever happens while `predictions.isColdStart` is `false` (e.g. under the TIF algorithm
branch, whose cold-start criteria live in a different module not covered by this review), the
UI renders the literal string `"null% chance of nap today"` instead of hiding the row or
showing a neutral message.

**Fix:** Guard explicitly:
```js
if (prediction.type === 'napStart' && prediction.napProbabilityScore?.score != null && !prediction.isMissed) {
  ...
}
```

### WR-02: `napProbability()`'s cold-start gate ignores rejected days, unlike `detectColdStart()`

**File:** `js/lib/forecast.js:1050-1052` vs. `js/lib/forecast.js:341-357`

**Issue:** `forecast()`'s cold-start gate (`detectColdStart`) counts only non-rejected days:
```js
const validDayCount = dayRecords.filter(day => !day.rejected).length;
if (validDayCount < minDays) { ... }
```
`napProbability()`'s cold-start gate instead uses the raw array length:
```js
if (!dayRecords || dayRecords.length < (settings.minDays || 1)) {
  return { score: null, signalsUsed: [], confidence: 'none' };
}
```
A history containing many rejected (outlier) days can pass `napProbability()`'s gate while
still failing `forecast()`'s gate (or vice versa isn't possible, but the asymmetry itself is
a latent inconsistency), producing a nap-probability score computed from a history that the
rest of the app considers "cold start" / not-yet-reliable.

**Fix:** Filter `!day.rejected` the same way `detectColdStart()` does, for consistency:
```js
const validDayCount = dayRecords.filter(d => !d.rejected).length;
if (validDayCount < (settings.minDays ?? 1)) { ... }
```

### WR-03: `settings.minDays || 1` silently treats an explicit `minDays: 0` as `1`

**File:** `js/lib/forecast.js:1050`

**Issue:** `dayRecords.length < (settings.minDays || 1)` — because `0` is falsy in
JavaScript, a caller/tester who explicitly sets `minDays: 0` to disable the cold-start gate
(a pattern used throughout `tests/unit/forecast.test.js`, e.g. `noGateSettings`) gets a gate
threshold of `1` instead of `0` here, diverging from `detectColdStart()`'s literal
`validDayCount < minDays` comparison (no fallback). This is inconsistent within the same
file and could produce surprising results for any future test/caller that relies on
`minDays: 0` meaning "never gate."

**Fix:** Use nullish coalescing instead of `||`: `settings.minDays ?? 1`.

### WR-04: `napProbability()`'s "nap window closed" check ignores `windowDays` (uses all-time history)

**File:** `js/lib/forecast.js:1074-1077`, `js/lib/forecast.js:1125-1127`

**Issue:**
```js
const napStartResult = calculatePercentiles(
  dayRecords,
  d => getSlotTime(d.napStart),
);
...
if (napStartResult !== null && napStartResult.max !== null && nowMins > napStartResult.max) {
  return { score: 0, signalsUsed, confidence };
}
```
`napStartResult` is computed over the *entire* `dayRecords` array passed in, not a
`settings.windowDays`-limited rolling window the way `forecast()`'s own `napStartPred`
percentiles are (`forecast.js:668` uses `window`, the sliced array). This means the
"nap window closed" cutoff drifts very slowly (dragged by months-old nap times) instead of
tracking the same recent-history window the rest of the algorithm uses, so it can
under/over-fire relative to the actual forecast card's own napStart P90.

**Fix:** Slice `dayRecords` to `settings.windowDays` (consistent with `forecast()`) before
computing `napStartResult`, or explicitly document why this signal is intentionally
unwindowed.

## Info

### IN-01: `context.currentHour` is accepted by `forecast()` but never used

**File:** `js/lib/forecast.js:698`, doc block `js/lib/forecast.js:632-636`

**Issue:** `forecast()` destructures `currentHour = 0` from `context` and its JSDoc lists it
among the context fields affecting "bedtime and nap modifiers", but the function body never
reads `currentHour` again after the destructure — the evening-hour override that actually
uses "current hour" lives in `selectNextEvent()` (which reads `new Date().getHours()`
directly, not from `forecast()`'s context). This is dead/misleading API surface that could
confuse a future maintainer into thinking changing `context.currentHour` affects the
forecast — it doesn't.

**Fix:** Either wire `currentHour` into whatever it was meant to influence, or drop it from
`forecast()`'s context contract and JSDoc.

### IN-02: Slot-time extraction helper duplicated three times with three different names

**File:** `js/lib/forecast.js:581-589` (`extractTime`), `js/lib/metrics.js:22-28` (`extractTime`, deliberately duplicated per the file's own circular-import comment), `js/ui/today-screen.js:907` (`_getSlotTime`)

**Issue:** The `metrics.js` duplication is explicitly justified in its header comment
(avoiding a circular import with `forecast.js`). The `today-screen.js` copy
(`_getSlotTime`) has no such justification — it exists purely because `forecast.js`'s
`extractTime` isn't exported. Three near-identical one-liners doing the same null/object/
string branching is a minor maintenance smell: a future change to the event-object shape
(e.g. supporting timezone offsets in `at`) requires remembering to update three call sites.

**Fix:** Export `extractTime` from `forecast.js` (or add a shared tiny util module) and have
`today-screen.js` import it instead of redefining `_getSlotTime`.

---

_Reviewed: 2026-09-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
