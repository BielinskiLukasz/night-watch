# Phase 1: Log & Persist - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 26 (15 source + 6 test + 5 root/config)
**Analogs found:** 12 / 26 (the rest are net-new: adapters, ESM split, test scaffold)

> **Note for the planner.** This is the first code-producing phase of a greenfield repo. The only analog codebase is the sibling project `../mindful-breathing/`, a *single-file* vanilla-JS PWA. Nightwatch deliberately departs from that single-file constraint and adopts a multi-file ESM layout (D-06, D-09). The reusable patterns from mindful-breathing are: `Object.freeze` for config blocks, secure-context-only API guards, `textContent`/`createElement` over `innerHTML` for user-rendered data, try/catch around `localStorage` I/O, and the PWA shell-meta tags. The adapter pattern (D-07), the ESM module split (D-06), the testing pyramid (D-19..D-22), and the canonical-JSON storage blob (D-04, D-05) are **net-new** — no analog exists in mindful-breathing for them, and the planner should derive them from RESEARCH.md §Architecture Patterns and §Code Examples.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `index.html` | view shell (entry) | request-response (browser load) | `../mindful-breathing/index.html` (head + meta tags + script load only) | role-match — the entire body is rewritten; only the `<head>` boilerplate transfers |
| `js/app.js` | composition root | one-shot wire-up at boot | `../mindful-breathing/index.html` lines 1905-1912 (bottom-of-file init block) | role-match — concept transfers, file boundary is new |
| `js/lib/time.js` | utility (pure logic) | transform | none in mindful-breathing (it doesn't deal with wall-clock times) | no analog — derive from RESEARCH §Pattern 4 |
| `js/lib/day-bucket.js` | utility (pure logic) | transform | none | no analog — derive from RESEARCH §Architecture (D-08, two bucketers) |
| `js/lib/id.js` | utility (pure-with-side-channel) | one-shot generator | none | no analog — wraps `crypto.randomUUID()`, RESEARCH §Don't Hand-Roll |
| `js/store/event-log.js` | store (state coordination) | CRUD + read-projection | none | no analog — derive from RESEARCH §Pattern 5 |
| `js/adapters/storage-local.js` | adapter (side-effect seam) | persistent I/O | `../mindful-breathing/index.html` lines 1315-1353 (try/catch around `localStorage.setItem` / `localStorage.getItem`) | partial — try/catch idiom transfers, the `createStorageLocal(key)` factory shape is new |
| `js/adapters/storage-memory.js` | adapter (test double) | in-memory | none | no analog — derive from RESEARCH §Pattern 3 |
| `js/adapters/clock-system.js` | adapter (side-effect seam) | one-shot read | none (mindful-breathing uses `performance.now()` inline, never adapted) | no analog |
| `js/adapters/clock-fixed.js` | adapter (test double) | in-memory | none | no analog — derive from RESEARCH §Code Examples (Clock-fixed adapter) |
| `js/ui/today-screen.js` | view (rendering) | event-driven (DOM clicks) | `../mindful-breathing/index.html` lines 1267-1310 (build-DOM-via-createElement + delegated change listener) | role-match — DOM idioms transfer |
| `js/ui/manual-entry.js` | view (modal dialog) | event-driven (form submit) | none in mindful-breathing (no modal); native `<dialog>` per RESEARCH §Pattern 6 | no analog — RESEARCH §Pattern 6 is the source |
| `js/ui/dom.js` | utility (tiny DOM helpers) | sync helpers | `../mindful-breathing/index.html` lines 1270-1290 (createElement-based row construction) | role-match — idiom only, no helper file existed |
| `tests/unit/time.test.js` | test (unit, pure logic) | one-shot | none — RESEARCH §Code Examples §Unit test example is the source | no analog |
| `tests/unit/day-bucket.test.js` | test (unit, pure logic) | one-shot | none | no analog |
| `tests/unit/id.test.js` | test (unit, pure logic) | one-shot | none | no analog |
| `tests/integration/event-log.test.js` | test (integration) | composes adapters | none — RESEARCH §Code Examples §Integration test example | no analog |
| `tests/integration/manual-entry.test.js` | test (integration) | composes adapters | none | no analog |
| `tests/integration/persistence.test.js` | test (integration) | composes adapters | none | no analog |
| `tests/e2e/quick-log.spec.js` | test (E2E) | browser automation | none — RESEARCH §Code Examples §E2E test example | no analog |
| `tests/e2e/manual-entry.spec.js` | test (E2E) | browser automation | none | no analog |
| `tests/e2e/reload.spec.js` | test (E2E) | browser automation | none | no analog |
| `package.json` | config (dev-only) | n/a | `../mindful-breathing/` has none — Nightwatch introduces a dev-only `package.json` | no analog — RESEARCH §Standard Stack §Installation |
| `playwright.config.js` | config | n/a | none | no analog — RESEARCH §Code Examples §`playwright.config.js` |
| `.github/workflows/ci.yml` | config (CI) | n/a | none — mindful-breathing has no CI | no analog — RESEARCH §Code Examples §`.github/workflows/ci.yml` |
| `.gitignore` | config | n/a | likely present in mindful-breathing for `node_modules` but Nightwatch needs Playwright-specific entries | no analog — VALIDATION.md §Wave 0 lists the entries |

**Summary of analog coverage:**
- **HTML shell + DOM idioms + `Object.freeze` + try/catch wrap + secure-context guard:** mindful-breathing/index.html — 5 distinct patterns extracted below.
- **Service worker / manifest / `<link rel=manifest>`:** mindful-breathing/sw.js + manifest.json — **deferred to Phase 8**, NOT consumed by Phase 1.
- **Everything else (adapters, layered ESM, testing pyramid, canonical JSON, modal dialog, store, day-bucketer, time helpers):** net-new — planner must build from RESEARCH.md.

---

## Pattern Assignments

### `index.html` (view shell, browser entry)

**Analog:** `../mindful-breathing/index.html` (head/meta section + service-worker registration)

**Head + PWA meta-tag pattern** (mindful-breathing/index.html lines 1-14) — copy the shape, adapt the values:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mindful Breathing</title>
  <meta name="description" content="A distraction-free breathing timer for relaxation, focus, and mindfulness practice." />
  <meta name="theme-color" content="#34d399" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Breathing" />
  <link rel="icon" href="data:image/svg+xml,<svg ...>" />
  <link rel="apple-touch-icon" href="icon.svg" />
  <link rel="manifest" href="manifest.json" />
```

**Phase 1 adaptation:**
- Keep `charset`, `viewport`, `title`, `description`, `theme-color`, the apple-touch meta trio, and the inline SVG `<link rel="icon">` idiom.
- **OMIT** `<link rel="manifest">` and `<link rel="apple-touch-icon">` in Phase 1 — manifest/icon land in Phase 8 (CONTEXT.md domain section, RESEARCH.md §user_constraints "Deferred Ideas").
- **DEPART** from single-file: instead of inline `<style>` + inline `<script>`, use external refs:
  ```html
  <link rel="stylesheet" href="style.css">
  ...
  <script type="module" src="js/app.js"></script>
  ```
  (D-09 says no build step; `<script type="module">` is the load mechanism.)

**Script-load pattern (NEW vs mindful-breathing):** mindful-breathing uses `<script>` (classic), single file. Nightwatch uses `<script type="module" src="js/app.js"></script>` — required for ESM imports across files (D-09, RESEARCH §user_constraints D-09).

**Service worker registration** (mindful-breathing/index.html lines 1898-1903): **DO NOT COPY IN PHASE 1.** Service worker is deferred to Phase 8. The mindful-breathing block is:
```javascript
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {})
  );
}
```
Keep this snippet for reference but Phase 1's `index.html` must not register a service worker — CONTEXT.md domain section explicitly defers PWA hardening.

---

### `js/app.js` (composition root)

**Analog:** `../mindful-breathing/index.html` lines 1905-1912 (bottom-of-file init block) — *concept only; the file boundary is new for Nightwatch.*

**Bootstrap-at-end pattern** (mindful-breathing/index.html lines 1905-1912):
```javascript
    // ====== Init (no cue on load) ======
    loadSettings();
    updateModeIndicator();
    buildDurationInputs();
    renderHistory();
    render(0, getPhase().durationSec);
    updateStatusUI();
    breathCircleEl.classList.add("idle");
```

**Phase 1 adaptation (per RESEARCH §Pattern 1):** Replace inline boot with explicit ESM import + adapter wiring. No globals, no module-level side effects outside this file:
```javascript
// js/app.js — derived from D-06/D-07/D-09 and RESEARCH §Pattern 1
import { createStorageLocal } from './adapters/storage-local.js';
import { createClockSystem } from './adapters/clock-system.js';
import { newEventId } from './lib/id.js';
import { createEventLog } from './store/event-log.js';
import { mountTodayScreen } from './ui/today-screen.js';

const storage = createStorageLocal('nightwatch:db');
const clock = createClockSystem();
const eventLog = createEventLog({ storage, clock, id: newEventId });
mountTodayScreen({ root: document.body, eventLog });
```

**Why net-new:** mindful-breathing has no adapter seams (it calls `localStorage` and `new Date()` directly throughout). The composition-root pattern (D-07: "no global singletons, no module-level `localStorage` / `Date.now()` references outside the adapter files") is introduced in this phase.

---

### `js/lib/time.js` (utility — pure)

**Analog:** none. Mindful-breathing tracks `performance.now()` deltas, never wall-clock event times.

**Source for the planner:** RESEARCH.md §Pattern 4 (5-min rounding + local-ISO format/parse). Key constraints:
- **Round-to-nearest** with `Math.round(ms / FIVE_MIN) * FIVE_MIN`, NOT floor (RESEARCH §Common Pitfalls #1 + Assumption A1).
- **`formatLocalISO`/`parseLocalISO` must NOT pass through `new Date(string)`** — date-time strings without timezone are local, date-only strings are UTC; the mismatch is silent (RESEARCH §Common Pitfalls #2). Use the strict regex parser from RESEARCH §Pattern 4.

---

### `js/lib/day-bucket.js` (utility — pure)

**Analog:** none. D-08 introduces **two** bucketers (`daysByCalendar`, `daysBySubjectiveNight`).

**Source for the planner:** RESEARCH.md §Architecture (Capability map row "Day bucketing"), §Pattern 5 (store wires them), §Common Pitfalls #3 (DST — bucketer must operate on string slices like `event.at.slice(11, 13)`, NOT `new Date(event.at).getHours()`, to dodge DST entirely).

**Critical: do NOT conflate the two functions.** Phase 1 UI uses `daysByCalendar` (D-11). Phase 3 forecast engine will use `daysBySubjectiveNight`. Both live in this file and operate on the same event log — D-08.

**LOG-09 (at most one nap per day):** RESEARCH §Open Questions #1 recommends **read-side enforcement** in the bucketer (pick the first `napStart` and matching `napEnd` per day, put extras into `dayRecord.extraNaps`). Planner can confirm with the user if uncertain.

---

### `js/lib/id.js` (utility — wraps a global)

**Analog:** none.

**Source:** RESEARCH §Don't Hand-Roll → `crypto.randomUUID()` is a global in Node 18+ and all evergreen browsers. One-liner:
```javascript
export function newEventId() { return crypto.randomUUID(); }
```

**Discretion (CONTEXT.md Claude's Discretion):** A monotonic counter is a valid substitute for predictable test IDs. The integration test example (RESEARCH §Code Examples §Integration test) uses an injected counter (`let nextId = 1; const id = () => 'e' + nextId++;`) — recommend keeping the runtime on `randomUUID` and overriding via the `id` factory parameter at the composition root in tests.

---

### `js/store/event-log.js` (store — orchestration)

**Analog:** none. Mindful-breathing has no event-log concept.

**Source:** RESEARCH.md §Pattern 5 verbatim. Key rules the planner must enforce:
- Load once at construction, mutate the in-memory `db` object, call `persist()` on every mutation (D-02 single-blob, whole-blob rewrite).
- `addEvent(type)` flow: `clock.now() → roundTo5 → formatLocalISO → { id: id(), type, at }` (D-01 event shape, D-04 canonical JSON).
- **Edit must mutate in place** — `editEvent(id, patch)` finds the record by `id`, spreads the patch, re-rounds the `at` field, writes back at the SAME array index. RESEARCH §Common Pitfalls #6 is the integration test to write FIRST.
- `listEvents()` returns a defensive copy (`[...db.events]`) — UI MUST NOT mutate. RESEARCH §Anti-Patterns ("Mutating store-returned arrays").
- `VALID_TYPES` set guards `addEvent` and `editEvent` against typos / future schema drift.

---

### `js/adapters/storage-local.js` (adapter — localStorage seam)

**Analog:** `../mindful-breathing/index.html` lines 1315-1353 — partial. The **try/catch idiom** transfers, the **factory shape** is new.

**Save pattern with try/catch** (mindful-breathing/index.html lines 1315-1326):
```javascript
function saveSettings() {
  try {
    savedDurations[activePresetKey] = activePhases.map(p => p.durationSec);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sound: soundEnabled,
      vibe: vibeEnabled,
      preset: activePresetKey,
      goal: goalInput.value,
      durations: savedDurations,
    }));
  } catch (_) {}
}
```

**Load pattern with try/catch + JSON.parse** (mindful-breathing/index.html lines 1328-1353):
```javascript
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    // ...validate each field defensively...
  } catch (_) {}
}
```

**Phase 1 adaptation (RESEARCH §Pattern 2):**
- **Wrap in a factory** `createStorageLocal(key)` returning `{ load(), save(db) }` — D-07 adapter contract.
- **Do NOT silently swallow errors** on save (mindful-breathing's `catch (_) {}` is acceptable for non-critical UI settings; Nightwatch sleep data is the user's primary artifact). On `QuotaExceededError` (DOMException code 22 / name `QuotaExceededError`), **throw a translated error** so the UI can surface it. RESEARCH §Common Pitfalls #4 + Anti-Patterns.
- **DO swallow `JSON.parse` errors on load** with a `console.warn` — corrupted blob is treated as "no data". RESEARCH §Common Pitfalls #4.
- **Multi-tab race mitigation (RESEARCH §Common Pitfalls #7):** in the store's `persist()` path, re-read the blob before writing (`db = storage.load() ?? db`) to reduce (not eliminate) cross-tab clobbering. Document the residual limitation in code.

---

### `js/adapters/storage-memory.js` (adapter — test double)

**Analog:** none. Net-new.

**Source:** RESEARCH §Pattern 3. Key idiom: **deep-clone via JSON on every load/save boundary** — `JSON.parse(JSON.stringify(blob))` — so test mutations don't bleed across calls (mirrors the serialization boundary the real `storage-local` enforces).

---

### `js/adapters/clock-system.js` (adapter — Date seam)

**Analog:** none. Mindful-breathing calls `performance.now()` inline (lines 1140-ish, 1601, 1612, 1697 for the RAF loop). It does NOT adapt the clock.

**Source:** D-07 + RESEARCH §Pattern 1. One-liner:
```javascript
export function createClockSystem() { return { now() { return new Date(); } }; }
```

**Phase 1 hard rule:** `new Date()` MUST NOT appear anywhere else in `js/` outside this file. Tests can grep this invariant. RESEARCH §Anti-Patterns.

---

### `js/adapters/clock-fixed.js` (adapter — test double)

**Analog:** none.

**Source:** RESEARCH §Code Examples §Clock-fixed adapter — verbatim:
```javascript
export function createClockFixed(initial) {
  let t = initial instanceof Date ? initial : new Date(initial);
  return {
    now() { return new Date(t); },
    advance(ms) { t = new Date(t.getTime() + ms); },
    set(date) { t = date instanceof Date ? date : new Date(date); },
  };
}
```

---

### `js/ui/today-screen.js` (view — quick-log buttons + day list)

**Analog:** `../mindful-breathing/index.html` lines 1267-1310 — **DOM-construction idiom transfers** (createElement + textContent, then `parent.appendChild`); the screen content is entirely new.

**createElement + textContent + appendChild pattern** (mindful-breathing/index.html lines 1270-1292):
```javascript
function buildDurationInputs() {
  durationsEl.innerHTML = "";          // safe: clearing, not injecting
  activePhases.forEach((phase, i) => {
    const item = document.createElement("label");
    item.className = "durItem";

    const name = document.createElement("span");
    name.className = "durName";
    name.textContent = phase.name;     // ← textContent, never innerHTML, for dynamic data

    const input = document.createElement("input");
    input.type = "number";
    input.className = "durInput";
    input.min = 1;
    input.max = 30;
    input.value = phase.durationSec;
    input.dataset.index = i;

    const unit = document.createElement("span");
    unit.className = "durUnit";
    unit.textContent = "sec";

    item.append(name, input, unit);
    durationsEl.appendChild(item);
  });
}
```

**Delegated event-listener pattern** (mindful-breathing/index.html lines 1296-1310):
```javascript
durationsEl.addEventListener("change", e => {
  const input = e.target.closest(".durInput");
  if (!input || isRunning) return;
  const idx = parseInt(input.dataset.index, 10);
  // ...validate & dispatch...
});
```

**Phase 1 adaptation:**
- Use `createElement` + `textContent` + `appendChild` for the day-grouped event list rows (RESEARCH §Security Domain — every dynamic value `HH:MM <Event type>` goes through `textContent`, never `innerHTML`, even though Phase 1's data is well-formed enum + regex'd timestamp). This is the V5 Input Validation control.
- Use `data-log="wake|bedtime|napStart|napEnd"` attributes on the four quick-log buttons + a single delegated `click` listener on their parent (mirrors the mindful-breathing `.durInput` delegation idiom).
- Use `data-event-id="<id>"` on each row + delegated listener for `[edit]` and `[×]` (D-12).
- `innerHTML = ""` is OK *only* for clearing a container before re-render (mindful-breathing uses it the same way on line 1268 and 1391). NEVER assign user-derived data to `innerHTML`.

---

### `js/ui/manual-entry.js` (view — modal dialog)

**Analog:** none. Mindful-breathing has no modal.

**Source:** RESEARCH §Pattern 6 (native `<dialog>` + `showModal()`) — focus trap, ESC-to-close, `aria-modal` all automatic. D-13 + D-14 lock the field shape: native `<input type="date">` + two number inputs (HH 0-23, MM 0-55 step=5) + 4-option `<select>`.

**Key pitfalls the planner must read first:**
- RESEARCH §Common Pitfalls #6: edit-creates-duplicate. Write the integration test (`assert.equal(events.length, 1)` after edit) before the UI code.
- RESEARCH §Open Questions #2: silently round on save (recommended) vs flash a hint vs block submit. Planner should pick silent + grey-hint sub-label "Times are stored in 5-minute increments." for v1.

---

### `js/ui/dom.js` (utility — DOM helpers)

**Analog:** mindful-breathing inlines the helpers (lines 1270-1292 above). Nightwatch splits them into a tiny file.

**Source:** Distilled from the createElement idiom in mindful-breathing. Two or three helpers are enough; resist building a framework. Sketch:
```javascript
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;     // never innerHTML
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const c of children) node.appendChild(c);
  return node;
}
export function clear(node) { node.replaceChildren(); }       // safer than innerHTML = ""
export function $(sel, root = document) { return root.querySelector(sel); }
```

**NOT a framework.** RESEARCH §Anti-Patterns. If you find yourself adding reactivity, stop.

---

### Test files (`tests/unit/*`, `tests/integration/*`, `tests/e2e/*`)

**Analog:** none. Mindful-breathing has no tests.

**Sources (verbatim or near-verbatim):**
- `tests/unit/time.test.js` → RESEARCH §Code Examples §Unit test example
- `tests/integration/event-log.test.js` → RESEARCH §Code Examples §Integration test example
- `tests/e2e/quick-log.spec.js` → RESEARCH §Code Examples §E2E test example
- `tests/integration/persistence.test.js` → RESEARCH §Code Examples §Integration test (the "fresh store rehydrates from storage" block)

**Critical naming gotcha (RESEARCH §Architecture Patterns "Critical naming note", repeated in State of the Art):** `node --test` no-args discovery is `*.test.js`, NOT `*.spec.js`. Phase 1 must use:
- `.test.js` everywhere under `tests/unit/` and `tests/integration/`
- `.spec.js` under `tests/e2e/` (Playwright convention, also keeps `node --test` from sweeping E2E files into the unit run)

**Also:** `node --test path/to/dir` is broken on Node 24 (treats the dir as a script). Use no-args invocation or explicit file paths. RESEARCH §Sources [VERIFIED: local Node 24.15.0 test].

---

### Root config files (`package.json`, `playwright.config.js`, `.gitignore`, `.github/workflows/ci.yml`)

**Analog:** none — mindful-breathing has no `package.json`, no CI, no test config.

**Sources (verbatim from RESEARCH.md):**
- `package.json` → RESEARCH §Standard Stack §Installation (with `"type": "module"`, `devDependencies: { "@playwright/test": "^1.60.0" }`, scripts `test`, `test:unit`, `test:e2e`)
- `playwright.config.js` → RESEARCH §Code Examples §`playwright.config.js`
- `.github/workflows/ci.yml` → RESEARCH §Code Examples §`.github/workflows/ci.yml`
- `.gitignore` → VALIDATION.md §Wave 0 enumerates: `node_modules/`, `playwright-report/`, `test-results/`, `.playwright/`

---

## Shared Patterns

### Pattern A — `Object.freeze` for config blocks

**Source:** `../mindful-breathing/index.html` lines 1045-1110.

**Apply to:** any module-level constants in Nightwatch — schema version, valid event types set (use `new Set()` then no freeze since `Set` is fine), localStorage key name, cutover-hour default, 7-day window length, modal field bounds.

**Excerpt** (lines 1045-1110):
```javascript
// UI text
const UI = Object.freeze({
  cyclePrefix: "Cycle:",
  secondsLabel: "seconds",
  statusRunning: "Running",
  statusStopped: "Stopped",
  btnStart: "Start",
  btnStop: "Stop"
});
// ...
// Sound settings
const SOUND = Object.freeze({
  enabledByDefault: true,
  waveform: "sine",
  volume: 0.12,
  beepMs: 120,
  attackSec: 0.01,
  releasePadSec: 0.02
});
// ...
const SESSION = Object.freeze({
  defaultCycles: 5,
  maxCycles: 20
});
// localStorage keys
const STORAGE_KEY  = "mb_v1";
const HISTORY_KEY  = "mb_history";
```

**Nightwatch usage:** Freeze CONFIG constants. **Do NOT freeze the mutable `db.events` array** in the store — `Object.freeze` would block `.push()` / `.splice()` and break `addEvent` / `deleteEvent`. RESEARCH §Anti-Patterns. Examples of things to freeze:
```javascript
const SCHEMA = Object.freeze({ version: 1, storageKey: 'nightwatch:db' });
const VALID_TYPES = new Set(['wake', 'bedtime', 'napStart', 'napEnd']);  // Set is fine without freeze
const CUTOVER = Object.freeze({ defaultHour: 4 });
const WINDOW = Object.freeze({ defaultDays: 7 });
const FIVE_MIN_MS = 5 * 60 * 1000;
```

---

### Pattern B — Secure-context / capability-detect guard before calling browser APIs

**Source:** `../mindful-breathing/index.html` lines 1398-1411 (wakeLock) and lines 1898-1903 (serviceWorker).

**Apply to:** any browser API that may be unavailable (offline, file://, older browser, non-secure context). Phase 1 examples: `localStorage` (rarely missing, but the in-private modes of some browsers fail on write — caught by the try/catch instead), `crypto.randomUUID` (always present in Node 18+ and evergreen browsers per RESEARCH §Standard Stack), `navigator.serviceWorker` (Phase 8).

**Excerpt — capability detect + try/catch fallback** (mindful-breathing/index.html lines 1398-1403):
```javascript
async function acquireWakeLock() {
  if (!("wakeLock" in navigator)) return;     // ← capability detect first
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => { wakeLockSentinel = null; });
  } catch (_) {}                              // ← silent fallback for non-critical features
}
```

**Excerpt — serviceWorker guard** (lines 1898-1903):
```javascript
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {})
  );
}
```

**Phase 1 application:** the only browser API Phase 1 *requires* is `localStorage` (already guarded by try/catch in the storage adapter). `crypto.randomUUID()` is universal in target browsers — no guard needed. Service-worker registration is **deferred to Phase 8**; do not add the `'serviceWorker' in navigator` block in Phase 1.

---

### Pattern C — `textContent` / `createElement` over `innerHTML` for dynamic data (V5 Input Validation, ASVS L1)

**Source:** `../mindful-breathing/index.html` lines 1273-1289 — every dynamic value uses `textContent`, never `innerHTML`.

**Apply to:** every UI module rendering an event row, day header, modal field. RESEARCH §Security Domain "Known Threat Patterns" calls out the XSS risk explicitly. Phase 1 has no rich text — event labels are an enum, dates/times are regex'd — so risk is low, but **enforce by convention**.

**Excerpt** (lines 1273-1289):
```javascript
const name = document.createElement("span");
name.className = "durName";
name.textContent = phase.name;          // ← textContent for dynamic data

const input = document.createElement("input");
input.type = "number";
input.className = "durInput";
input.value = phase.durationSec;        // ← .value (property), not innerHTML
input.dataset.index = i;                // ← dataset for state, not data in markup

const unit = document.createElement("span");
unit.textContent = "sec";               // even static text via textContent
```

**Acceptable `innerHTML` usage** (lines 1268, 1374, 1379, 1391): clearing the container (`el.innerHTML = ""`) or inserting a fully-static literal string with no interpolation (`el.innerHTML = '<div class="historyEmpty">No sessions yet</div>'`). Anywhere user data flows in, switch to `textContent` + `createElement`. Recommend the planner use `node.replaceChildren()` for clearing — modern equivalent of `innerHTML = ""` without the antipattern smell.

---

### Pattern D — try/catch around all `localStorage` I/O

**Source:** `../mindful-breathing/index.html` lines 1316, 1329, 1359, 1370 — every `localStorage.getItem` / `setItem` is wrapped.

**Apply to:** `js/adapters/storage-local.js` only. RESEARCH §Common Pitfalls #4 spells out the QuotaExceededError + JSON.parse error categories.

**Excerpt** (lines 1316-1326, 1329-1352):
```javascript
function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ... }));
  } catch (_) {}                          // mindful-breathing: silent (settings are non-critical)
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    // defensively validate each field
  } catch (_) {}                          // mindful-breathing: silent
}
```

**Nightwatch divergence:** sleep data is the user's primary artifact, not throwaway UI settings. **Do not silently swallow `save` errors.** On `setItem` failure with `QuotaExceededError` (DOMException code 22), translate and **throw** so the UI surfaces "Storage full — export and clear before continuing." On `getItem` + `JSON.parse` failure, **`console.warn` and return `null`** (treat corrupted blob as "no data"). RESEARCH §Pattern 2 has the production-shaped version.

---

### Pattern E — Module-level boot at end of file (with adaptation to ESM composition root)

**Source:** `../mindful-breathing/index.html` lines 1905-1912 — eager-execute init functions at end of `<script>` block.

**Apply to:** `js/app.js`. The pattern transfers; the file boundary is new.

**Excerpt:**
```javascript
// ====== Init (no cue on load) ======
loadSettings();
updateModeIndicator();
buildDurationInputs();
renderHistory();
render(0, getPhase().durationSec);
updateStatusUI();
breathCircleEl.classList.add("idle");
```

**Nightwatch adaptation:** see `js/app.js` section above. The boot becomes "construct adapters → inject into store → mount UI", all at module top level after the imports.

---

## No Analog Found

Files with no close match in mindful-breathing — planner must derive from RESEARCH.md (sections cited):

| File | Role | Data Flow | Source in RESEARCH.md |
|------|------|-----------|------------------------|
| `js/lib/time.js` | utility | transform | §Pattern 4 (`roundTo5`, `formatLocalISO`, `parseLocalISO`); §Common Pitfalls #1 + #2 + #3 |
| `js/lib/day-bucket.js` | utility | transform | §Architecture (D-08); §Common Pitfalls #3 (string-slice over Date math); §Open Questions #1 (LOG-09 read-side enforcement) |
| `js/lib/id.js` | utility | one-shot | §Don't Hand-Roll (`crypto.randomUUID()`); §Code Examples (injected counter in tests) |
| `js/store/event-log.js` | store | CRUD + read-projection | §Pattern 5 (verbatim); §Common Pitfalls #5, #6, #7; §Anti-Patterns ("Mutating store-returned arrays") |
| `js/adapters/storage-memory.js` | adapter (test double) | in-memory | §Pattern 3 (verbatim) |
| `js/adapters/clock-system.js` | adapter | one-shot read | D-07; §Pattern 1 (composition example uses it) |
| `js/adapters/clock-fixed.js` | adapter (test double) | in-memory | §Code Examples §Clock-fixed adapter (verbatim) |
| `js/ui/manual-entry.js` | view (modal) | event-driven | §Pattern 6 (native `<dialog>` + `showModal()`); D-13/D-14; §Common Pitfalls #6 |
| `tests/unit/*` | test (unit) | one-shot | §Code Examples §Unit test example; §Architecture Patterns ("Critical naming note": `.test.js` only, no `.spec.js`) |
| `tests/integration/*` | test (integration) | composes adapters | §Code Examples §Integration test example; §Pattern 1 + §Pattern 3 (composition with memory adapter + fixed clock) |
| `tests/e2e/*` | test (E2E) | browser automation | §Code Examples §E2E test example; §Common Pitfalls #8 (storage isolation) |
| `package.json` | config | n/a | §Standard Stack §Installation |
| `playwright.config.js` | config | n/a | §Code Examples §`playwright.config.js` |
| `.github/workflows/ci.yml` | config | n/a | §Code Examples §`.github/workflows/ci.yml` |
| `.gitignore` | config | n/a | VALIDATION.md §Wave 0 |

**Why so many "no analog":** mindful-breathing is a single-file, untested, no-adapter, no-CI, no-modal, no-store, no-event-log meditation timer. Nightwatch is structurally a different kind of app. The transferable patterns are narrow (5 listed in Shared Patterns above); the rest is net-new and must come from the RESEARCH.md sections cited above.

---

## Metadata

**Analog search scope:**
- `C:\Users\lukasz.bielinski\projects\mindful-breathing\` (sibling reference app — the only analog codebase available)
  - `index.html` (1915 lines) — read in targeted slices (lines 1-40, 1040-1170, 1265-1395, 1394-1418, 1595-1620, 1893-1915) via Grep + Read with offset/limit
  - `sw.js` (10 lines) — full read; **Phase 8 analog, NOT consumed by Phase 1**
  - `manifest.json` (17 lines) — full read; **Phase 8 analog, NOT consumed by Phase 1**
- `C:\Users\lukasz.bielinski\projects\sleep-tracker\` — empty of source code; only `.planning/` artifacts exist

**Files scanned in analog search:** 3 (mindful-breathing/{index.html, sw.js, manifest.json})

**Distinct patterns extracted from mindful-breathing:** 5 (Object.freeze configs, secure-context capability guard, textContent/createElement over innerHTML, try/catch around localStorage I/O, module-level boot at end of file)

**Pattern extraction date:** 2026-05-26
