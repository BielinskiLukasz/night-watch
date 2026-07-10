# Phase 1: Log & Persist - Research

**Researched:** 2026-05-26
**Domain:** Vanilla-JS PWA — log/persist/list, adapter-pattern testing scaffold (node:test + Playwright)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Twenty-two decisions are locked verbatim in `01-CONTEXT.md` (D-01..D-22). Highlights the planner MUST honor without re-litigation:

- **D-01** Event-log shape: `{ id, type, at }` where `type ∈ {wake, bedtime, napStart, napEnd}` and `at` is a wall-clock ISO timestamp (e.g., `'2026-05-26T03:50'`). Days are *derived*, not stored.
- **D-02** Single-blob `localStorage` at key `nightwatch:db`, whole blob rewritten on each mutation. ~1.2 MB ceiling at 10 yr × ~80 B/event × 4/day, well under the 5 MB per-origin budget. IndexedDB explicitly NOT used in v1.
- **D-03** Mutate-in-place for edits/deletes — no audit trail, no tombstones.
- **D-04** Canonical JSON shape: `{ version: 1, events: [...] }`. This contract Phase 5 import/export must round-trip.
- **D-05** `localStorage` value === canonical JSON, byte-for-byte. Load-bearing invariant.
- **D-06** Layered structure under `js/`: `app.js` (composition root), `lib/`, `store/`, `adapters/`, `ui/`. Concrete file names listed in CONTEXT.md.
- **D-07** Adapter interfaces minimal: `StorageAdapter { load(), save(db) }`, `ClockAdapter { now() }`. Injected at composition root only — no module-level `localStorage` / `Date.now()` outside the adapter files.
- **D-08** Two day-grouping functions: `daysByCalendar(events)` (UI) and `daysBySubjectiveNight(events, cutoverHour)` (forecast — Phase 3+). Both pure, both over the same event log. Do NOT conflate.
- **D-09** No framework, no build, `<script type="module">` in HTML, same files import in Node tests via ESM. Dev server is `python -m http.server` or equivalent.
- **D-10..D-15** Single scrollable Today screen; 4 quick-log buttons; day-grouped event list (last 7 calendar days); modal dialog with date input + two number inputs (HH 0–23, MM 0–55 step=5) — native `<input type="time">` REJECTED. Per-event `[edit] [×]`.
- **D-11** Day grouping uses CALENDAR dates on the UI, NOT subjective-night dates. Forecast engine in Phase 3 will use subjective bucketing under the hood. Don't conflate.
- **D-16..D-18** Wall-clock timestamp stored, day derived on read. Cutover hour HARDCODED to 04:00 in Phase 1 (Phase 2 makes it user-configurable). No UI hint about cutover in Phase 1.
- **D-19** Tests under `tests/{unit,integration,e2e}/`. node:test for unit+integration, Playwright for E2E. TDD strict for pure logic + integration; test-after for UI.
- **D-20** `package.json` is dev-only: `devDependencies` (Playwright), zero `dependencies`. `.gitignore` excludes `node_modules/`.
- **D-21** One GitHub Action runs the whole suite on push/PR.
- **D-22** Coverage acceptance: every LOG-* and DATA-04 has at least one automated test.

### Claude's Discretion

- **Event `id` minting** — `crypto.randomUUID()` is the default recommendation; planner may substitute monotonic counter if helpful. (See §Code Examples below.)
- **CSS / visual styling** — out of scope; theming lands in Phase 8.
- **Concrete file names within sub-folders** beyond what's listed in D-06.
- **Whether `tests/integration/` uses a shared `makeTestApp()` helper or per-test wiring** — planner picks.

### Deferred Ideas (OUT OF SCOPE)

- Configurable cutover hour Settings field → Phase 2 (CFG-08).
- Audit trail / undo for edits → out of v1.
- Configurable list-window length → Phase 2 candidate.
- Cutover-hour explainer tooltip → Phase 2 candidate.
- Service worker, manifest, `file://` hardening, GH Pages deploy, custom theme → Phase 8.
- CSV import → Phase 5 (Phase 1's JSON shape is the contract).
- Auto outlier detection → Phase 2/3.
- IndexedDB migration → only if dataset crosses ~3 MB; the storage adapter seam from D-07 makes this a one-file swap.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOG-01 | "Woke up" quick-log button records wake event at current time, 5-min rounded | §Code Examples (quick-log handler), §Common Pitfalls (rounding semantics), §Architecture (composition root wires ClockAdapter) |
| LOG-02 | "Going to sleep" button → bedtime event at now, 5-min rounded | Same handler shape as LOG-01, dispatched with `type: 'bedtime'` |
| LOG-03 | "Nap start" button → napStart event at now, 5-min rounded | Same handler shape |
| LOG-04 | "Nap end" button → napEnd event at now, 5-min rounded | Same handler shape |
| LOG-05 | Manual entry / edit of any event for today or past day via form | §Architecture (native `<dialog>` + showModal()), §Code Examples (modal pattern), §Pitfalls (D-13 dialog gotchas: form method="dialog", required-input handling) |
| LOG-06 | Delete a logged event from history | §Code Examples (delete handler, mutate-in-place per D-03) |
| LOG-07 | All times captured/stored/displayed at 5-min precision | §Common Pitfalls (rounding strategy choice: floor vs nearest), §Code Examples (`roundTo5`) |
| LOG-08 | Events grouped by subjective-night with configurable cutover hour (default ~04:00) | §Architecture (D-08 two bucketers), §Common Pitfalls (cutover edge cases — exactly at 04:00, cross-midnight, DST) |
| LOG-09 | Each day has at most one nap (single start/end pair) | §Architecture (validate at write OR validate at read — research recommends read-side validation in Phase 1, see §Architecture Patterns) |
| DATA-04 | App state cached in `localStorage` so app survives reloads | §Code Examples (`storage-local.js`), §Common Pitfalls (`QuotaExceededError` handling, JSON.parse error handling) |
| PLAT-08 | `node:test` unit tests in `tests/unit/`, zero-install CI | §Standard Stack (node:test built-in), §Code Examples (test invocation) |
| PLAT-09 | Integration tests in Node via adapters (no browser, no jsdom) | §Architecture (memory adapter, fixed-clock adapter), §Code Examples (composition pattern) |
| PLAT-10 | Playwright E2E in `tests/e2e/`, dev-dependency only | §Standard Stack (Playwright 1.60.0), §Code Examples (playwright.config.js + webServer), §Common Pitfalls (E2E flakiness around localStorage isolation) |
| PLAT-11 | TDD discipline; every shipped behavior has ≥1 automated test | §Architecture Patterns (TDD test-first sequencing), §Validation Architecture (Phase Requirements → Test Map) |
</phase_requirements>

## Summary

Phase 1 is the **walking skeleton** of Nightwatch — the thinnest end-to-end vertical slice that proves the architectural skeleton works: composition root wires real `localStorage`/`Date` adapters into a store and UI, a real button click writes a real event to a real localStorage blob, the page reloads, the event survives. Test scaffolding (unit + integration + Playwright + CI) ships in the same skeleton.

Three things drive every recommendation below: (1) **zero runtime dependencies** is non-negotiable — Playwright is a dev-only tool, no jsdom, no test helpers, no UUID libraries; (2) **the adapter seam is the load-bearing testability decision** — it eliminates the need for jsdom in unit/integration tests and makes the same modules dual-runnable in browser and Node; (3) **`node:test` (Node 22+) has surprisingly capable mocking** (`mock.fn`, `mock.method`, `mock.timers`, even `mock.module`) — no third-party test framework needed.

**Primary recommendation:** Treat the **adapter pattern + canonical-JSON localStorage blob + native `<dialog>` element + `node:test` (no-args discovery) + Playwright with `webServer` invoking `python -m http.server`** as the spine of the phase. Every other implementation choice is a stylistic detail that hangs off this spine.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Time rounding (`roundTo5`) | Pure logic (`js/lib/time.js`) | — | No I/O, no clock dependency; pure function takes a Date and returns a Date |
| Day bucketing (calendar + subjective) | Pure logic (`js/lib/day-bucket.js`) | — | Pure transform from `events[]` → day records; D-08 mandates two functions sharing this module or split |
| Event ID minting | Pure-with-side-channel (`js/lib/id.js`) | Adapter optional | `crypto.randomUUID()` is a global — pure-ish; if the planner wants strict purity, route through an `IdAdapter` (over-engineered for Phase 1; recommend leaving direct) |
| Event mutation (add/edit/delete) | Store (`js/store/event-log.js`) | StorageAdapter, ClockAdapter | Store orchestrates `clock.now() → roundTo5 → event → storage.save()` |
| localStorage I/O | Adapter (`js/adapters/storage-local.js`) | — | Side effect isolated here; QuotaExceededError + JSON.parse errors caught here, not propagated raw |
| Clock | Adapter (`js/adapters/clock-system.js`) | — | `new Date()` lives ONLY in this file in the runtime |
| Composition wiring | Root (`js/app.js`) | — | Only place adapters are constructed and injected; this is the "main" |
| DOM rendering | UI (`js/ui/today-screen.js`, `manual-entry.js`) | dom.js helpers | Direct DOM API; not adapted (D-19 says UI is test-after via E2E) |
| Modal dialog | UI (`js/ui/manual-entry.js`) | Native `<dialog>` element | Use `dialog.showModal()` — focus trap, ESC-to-close, ARIA modal all free |
| 7-day window filter | UI (`js/ui/today-screen.js`) | Pure helper (could live in `lib/day-bucket.js`) | The bucketer can take an optional `limit` arg; recommend keeping it pure |

## Standard Stack

### Core (runtime — ships to GitHub Pages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **(none)** | — | — | Zero runtime dependencies is a hard constraint (D-09, D-20, PLAT-01). Browser-native APIs only: `localStorage`, `Date`, `crypto.randomUUID()`, `document`, `<dialog>`, `<script type="module">`. |

[VERIFIED: tested locally on Node 24.15] `crypto.randomUUID()` is a global in Node 18+ and all evergreen browsers — no import needed.

[CITED: developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog] The native `<dialog>` element is **Baseline Widely Available since March 2022** — focus trap, ESC-to-close, and `aria-modal="true"` are all automatic when opened via `showModal()`.

### Dev tooling (never ships to Pages)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| **@playwright/test** | **1.60.0** | E2E browser automation, `webServer` config, headless Chromium | [VERIFIED: npm registry] `npm view @playwright/test version` returned `1.60.0`, published 2026-05-26 (today) |
| **node:test** | (built-in to Node 22+) | Unit + integration tests, includes `mock.fn`, `mock.method`, `mock.timers`, `mock.module` (all stable, not experimental) | [VERIFIED: nodejs.org/api/test.html + local test on Node 24.15] |
| **node:assert/strict** | (built-in) | Test assertions | [VERIFIED: Node built-in] |

### Build / CI

| Tool | Version | Purpose | Verified |
|------|---------|---------|----------|
| **actions/setup-node** | v5 | Node install in CI | [CITED: Playwright official ci-intro example] |
| **actions/checkout** | v5 | Source checkout | [CITED: Playwright official ci-intro example] |
| **Node.js LTS** | 22 (Jod) or 24 (Krypton) | CI runtime; `lts/*` resolves to v24 currently | [CITED: nodejs.org/en/about/previous-releases] Node 22 LTS supported until 2027-04; Node 24 LTS until 2028-04. Recommend pinning to `lts/*` (auto-resolves to current LTS) OR `'22'` for stability. |

### Alternatives Considered

| Instead of | Could Use | Why we don't |
|------------|-----------|--------------|
| `crypto.randomUUID()` | Monotonic counter (`++lastId`) | Counter is simpler to test (predictable IDs), but loses uniqueness across multiple browser tabs/devices (not a concern for single-subject v1). UUID is the cleaner default; counter is a valid alternate per Claude's Discretion. |
| Native `<dialog>` | Roll-your-own overlay div | Custom overlay needs manual focus trap, ESC handling, `aria-modal`, body scroll lock, inert background — all of which `<dialog>` gives free. No reason to hand-roll. |
| `node:test` | Mocha / Jest / Vitest | All would add npm dependencies and an install step. `node:test` is built-in, ESM-native, has mocking, runs zero-install in CI. |
| `python -m http.server` for E2E | `npx http-server` (Node) | Either works in Playwright's `webServer.command`. `python -m http.server` is dependency-free if Python is available; `npx http-server` would add another devDep. Recommend Python (already on GitHub Actions ubuntu-latest runners). |
| jsdom for integration tests | Pure adapter mocks | jsdom would be a heavyweight dependency we don't need — D-07/D-19 explicitly use adapter seams to avoid simulating a DOM in Node. Pure functions + memory adapter cover the integration surface. |

### Installation

```bash
# Phase 1 boots the test scaffold with a single dev-only install:
npm init -y                                 # creates package.json
npm install -D @playwright/test@latest      # devDependencies only
npx playwright install --with-deps chromium # install browser binary (chromium only for v1)
```

The resulting `package.json`:

```json
{
  "name": "nightwatch",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test:unit": "node --test",
    "test:e2e": "playwright test",
    "test": "node --test && playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0"
  }
}
```

**Notes:**
- `"type": "module"` makes `.js` files ESM in Node (matches browser `<script type="module">`). This is the dual-import unlock.
- `node --test` with no args auto-discovers `**/*.test.js` and `**/test/**/*.js` patterns — covers `tests/unit/` and `tests/integration/`. [VERIFIED: nodejs.org/api/test.html + local run on Node 24.15]
- Playwright's own test runner (`playwright test`) lives separately and reads `playwright.config.js` — does NOT use `node:test`.

### Version verification

```bash
$ npm view @playwright/test version
1.60.0
# Published 2026-05-26 (today)

$ node --version
v24.15.0  # local; Node 22 LTS or Node 24 LTS both acceptable
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @playwright/test | npm | 5+ years (first published 2020-09) | tens of millions/week | github.com/microsoft/playwright | not run (see note) | Approved — Microsoft-maintained, the de-facto E2E framework |

**Note:** slopcheck was not installed in this research session (the tool would need `pip install slopcheck` to invoke). For a single, well-established Microsoft-maintained package like `@playwright/test`, the registry record (first published 2020-09, weekly downloads in the tens of millions, official Microsoft source repo) makes it [VERIFIED: npm registry + Playwright official docs at playwright.dev/docs/intro]. The planner does NOT need to gate this install behind `checkpoint:human-verify`.

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          index.html                                 │
│                                                                     │
│   <button data-log="wake">       <button id="addEvent">             │
│        ↓ click event                  ↓ click event                 │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │                       ui/today-screen.js                   │    │
│   │  - renders buttons + day-grouped event list                │    │
│   │  - delegates clicks to store.addEvent(type)                │    │
│   └──────────────────────┬─────────────────────────────────────┘    │
│                          │                                          │
│                          │ store.addEvent('wake')                   │
│                          ▼                                          │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │                    store/event-log.js                      │    │
│   │  addEvent(type) { now=clock.now(); rounded=roundTo5(now);  │    │
│   │                   id=newEventId(); evt={id,type,at:fmt(    │    │
│   │                   rounded)}; events.push(evt);             │    │
│   │                   storage.save({version:1,events}); }      │    │
│   │  editEvent / deleteEvent / daysByCalendar / daysBySubject  │    │
│   └────┬──────────────────────────────┬─────────────────────┬──┘    │
│        │                              │                     │       │
│        │ injected at composition root (js/app.js)            │      │
│        ▼                              ▼                     ▼       │
│   ┌─────────────┐            ┌─────────────┐         ┌──────────┐   │
│   │ Storage     │            │ Clock       │         │ lib/     │   │
│   │ Adapter     │            │ Adapter     │         │ pure fns │   │
│   │ - load()    │            │ - now()     │         │ time.js  │   │
│   │ - save()    │            │             │         │ day-     │   │
│   └──┬──────────┘            └──┬──────────┘         │  bucket  │   │
│      │                          │                    │ id.js    │   │
│      ▼                          ▼                    └──────────┘   │
│  ╔══════════════╗           ╔══════════════╗                        │
│  ║ localStorage ║           ║ new Date()   ║                        │
│  ║ nightwatch:db║           ╚══════════════╝                        │
│  ╚══════════════╝                                                   │
└─────────────────────────────────────────────────────────────────────┘

      ┌───────────────────────────────────────────────────────┐
      │ Same modules in Node tests (tests/integration/):      │
      │                                                       │
      │   store/event-log.js   <── memory adapter (Map<>)     │
      │                        <── fixed clock (() => fixed)  │
      │                                                       │
      │   No DOM, no jsdom, no localStorage shim required.    │
      └───────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
nightwatch/
├── index.html                  # entry HTML; loads js/app.js as type=module
├── style.css                   # bare functional styles (Phase 8 themes)
├── js/
│   ├── app.js                  # composition root — wires adapters into store + UI
│   ├── lib/
│   │   ├── time.js             # roundTo5, formatHHMM, formatLocalISO, parseHHMM
│   │   ├── day-bucket.js       # daysByCalendar, daysBySubjectiveNight
│   │   └── id.js               # newEventId()
│   ├── store/
│   │   └── event-log.js        # createEventLog({storage, clock, id})
│   ├── adapters/
│   │   ├── storage-local.js    # localStorage-backed
│   │   ├── storage-memory.js   # in-memory (used by tests)
│   │   ├── clock-system.js     # () => new Date()
│   │   └── clock-fixed.js      # factory(frozenDate)
│   └── ui/
│       ├── today-screen.js     # renders quick-log buttons + day list
│       ├── manual-entry.js     # modal dialog (showModal)
│       └── dom.js              # 5-10 line helpers, NOT a framework
├── tests/
│   ├── unit/                   # node:test, pure-logic only
│   │   ├── time.test.js
│   │   ├── day-bucket.test.js
│   │   └── id.test.js
│   ├── integration/            # node:test, store + memory adapter + fixed clock
│   │   └── event-log.test.js
│   └── e2e/                    # Playwright
│       └── log-and-persist.spec.js  # see naming note below
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json                # devDeps only
├── playwright.config.js
├── .gitignore                  # node_modules, playwright-report, test-results
└── CLAUDE.md                   # project conventions (already exists)
```

**Critical naming note** [VERIFIED: nodejs.org/api/test.html]: `node --test` (no args) discovers `*.test.{js,cjs,mjs}` patterns by default — **NOT `*.spec.js`**. Phase 1 should use `.test.js` everywhere under `tests/unit/` and `tests/integration/`. Playwright's `tests/e2e/` directory can use either `.spec.js` (Playwright convention) or `.test.js` (consistent with the rest) — Playwright will discover both if configured. **Recommend `.spec.js` under `tests/e2e/`** so a future glob can distinguish E2E from node:test files without ambiguity.

### Pattern 1: Composition Root (`js/app.js`)

**What:** All adapter wiring happens in one place. Modules never import `localStorage` or call `new Date()` directly except the adapter files themselves.

**When to use:** Every entry to the runtime app. In Node tests, the equivalent is `makeTestApp()` helper or per-test wiring (Claude's Discretion per CONTEXT.md).

**Example:**
```javascript
// Source: derived from D-06/D-07/D-09 in CONTEXT.md
// js/app.js
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

### Pattern 2: Adapter (`js/adapters/storage-local.js`)

**What:** Wraps the side-effecting browser API behind a documented interface.

**Example:**
```javascript
// Source: D-07 (adapter interface) + Common Pitfall #4 (quota/parse errors)
// js/adapters/storage-local.js
export function createStorageLocal(key) {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw);
      } catch (e) {
        // Corrupted blob — treat as missing; emit a console warning.
        // Phase 5 import will be the recovery path.
        console.warn(`[nightwatch] Could not parse ${key}; ignoring cache.`, e);
        return null;
      }
    },
    save(db) {
      try {
        localStorage.setItem(key, JSON.stringify(db));
      } catch (e) {
        // QuotaExceededError handling — see Common Pitfall #4
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          // Phase 1 acceptable behavior: re-throw so UI can surface
          // a non-recoverable error. Phase 5 (import/export) gives
          // the user a real recovery path.
          throw new Error('Storage full. Export and clear before continuing.');
        }
        throw e;
      }
    },
  };
}
```

### Pattern 3: Memory adapter (`js/adapters/storage-memory.js`) — for tests

```javascript
// js/adapters/storage-memory.js
export function createStorageMemory(initial = null) {
  let blob = initial;
  return {
    load() { return blob === null ? null : JSON.parse(JSON.stringify(blob)); },
    save(db) { blob = JSON.parse(JSON.stringify(db)); },
    // Test-only inspector — NOT part of the StorageAdapter contract
    _snapshot() { return blob; },
  };
}
```

**Note:** The deep-clone-via-JSON pattern matches the localStorage adapter's serialize/deserialize boundary — caught a class of bugs where tests pass because the test happens to mutate the same object reference that the store still holds. Recommend keeping it.

### Pattern 4: Pure helper (`js/lib/time.js`)

```javascript
// Source: D-04/D-07/D-16 + §Common Pitfalls (rounding semantics)
// js/lib/time.js
export function roundTo5(date) {
  // Round to NEAREST 5 min (vs floor) — see Common Pitfall #1 for rationale
  const ms = date.getTime();
  const FIVE_MIN = 5 * 60 * 1000;
  return new Date(Math.round(ms / FIVE_MIN) * FIVE_MIN);
}

export function formatLocalISO(date) {
  // Emits 'YYYY-MM-DDTHH:MM' in LOCAL time (no Z suffix) — D-04 canonical format
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalISO(s) {
  // Parses 'YYYY-MM-DDTHH:MM' as local time — see Common Pitfall #2
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid local ISO timestamp: ${s}`);
  const [, y, mo, d, h, mi] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi);
}
```

### Pattern 5: Store (`js/store/event-log.js`) — orchestration

```javascript
// Source: D-01/D-04/D-08
// js/store/event-log.js
import { roundTo5, formatLocalISO, parseLocalISO } from '../lib/time.js';
import { daysByCalendar as _daysByCalendar,
         daysBySubjectiveNight as _daysBySubjectiveNight } from '../lib/day-bucket.js';

const SCHEMA_VERSION = 1;
const VALID_TYPES = new Set(['wake', 'bedtime', 'napStart', 'napEnd']);

export function createEventLog({ storage, clock, id }) {
  // Load once; in-memory model is the working copy
  let db = storage.load() ?? { version: SCHEMA_VERSION, events: [] };
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${db.version}`);
  }
  const persist = () => storage.save(db);

  return {
    addEvent(type) {
      if (!VALID_TYPES.has(type)) throw new Error(`Invalid event type: ${type}`);
      const at = formatLocalISO(roundTo5(clock.now()));
      const evt = { id: id(), type, at };
      db.events.push(evt);
      persist();
      return evt;
    },
    addEventAt(type, atString) {
      if (!VALID_TYPES.has(type)) throw new Error(`Invalid event type: ${type}`);
      const at = formatLocalISO(roundTo5(parseLocalISO(atString)));
      const evt = { id: id(), type, at };
      db.events.push(evt);
      persist();
      return evt;
    },
    editEvent(eventId, patch) {
      const i = db.events.findIndex(e => e.id === eventId);
      if (i === -1) throw new Error(`Event not found: ${eventId}`);
      const next = { ...db.events[i], ...patch };
      if (!VALID_TYPES.has(next.type)) throw new Error(`Invalid event type: ${next.type}`);
      // Re-round on edit
      next.at = formatLocalISO(roundTo5(parseLocalISO(next.at)));
      db.events[i] = next;
      persist();
      return next;
    },
    deleteEvent(eventId) {
      const i = db.events.findIndex(e => e.id === eventId);
      if (i === -1) return false;
      db.events.splice(i, 1);
      persist();
      return true;
    },
    listEvents() { return [...db.events]; },
    daysByCalendar(limit) { return _daysByCalendar(db.events, limit); },
    daysBySubjectiveNight(cutoverHour = 4, limit) {
      return _daysBySubjectiveNight(db.events, cutoverHour, limit);
    },
  };
}
```

### Pattern 6: Native `<dialog>` modal

```html
<!-- index.html -->
<dialog id="manualEntry">
  <form method="dialog">
    <h2 id="manualEntryTitle">Add event</h2>
    <label>Date <input type="date" name="date" required></label>
    <label>Hour <input type="number" name="hour" min="0" max="23" required></label>
    <label>Minute <input type="number" name="minute" min="0" max="55" step="5" required></label>
    <label>Type
      <select name="type" required>
        <option value="wake">Wake</option>
        <option value="bedtime">Bedtime</option>
        <option value="napStart">Nap start</option>
        <option value="napEnd">Nap end</option>
      </select>
    </label>
    <menu>
      <button type="button" id="manualCancel" formnovalidate>Cancel</button>
      <button type="submit" value="save">Save</button>
    </menu>
  </form>
</dialog>
```

```javascript
// js/ui/manual-entry.js
// Source: developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
export function openManualEntry({ existing, onSave }) {
  const dlg = document.getElementById('manualEntry');
  const form = dlg.querySelector('form');
  // Pre-fill if editing
  if (existing) { /* ... pre-fill fields ... */ }
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'save') {
      const data = new FormData(form);
      onSave({
        date: data.get('date'),
        hour: Number(data.get('hour')),
        minute: Number(data.get('minute')),
        type: data.get('type'),
      });
    }
    form.reset();
  }, { once: true });
  document.getElementById('manualCancel').onclick = () => dlg.close('cancel');
  dlg.showModal();   // focus trap, ESC-to-close, aria-modal — all automatic
}
```

### Anti-Patterns to Avoid

- **`document.createElement('div')` overlay instead of `<dialog>`** — re-implements focus trap, ESC, `aria-modal`, body scroll lock for no benefit. Use `<dialog>` (Baseline since 2022).
- **`<input type="time">` for the time field** — already explicitly rejected in D-14. Browser inconsistency around `step=300` (5-min) makes it unreliable. Two number inputs (HH, MM step=5) are the locked decision.
- **Calling `new Date()` outside `adapters/clock-system.js`** — breaks the clock adapter seam (D-07). Tests can't freeze time. If a module needs "now", inject the clock.
- **Calling `localStorage` outside `adapters/storage-local.js`** — same reason for storage.
- **Mutating store-returned arrays** — the store returns copies (`[...db.events]`) so UI can't accidentally corrupt the internal model. UI code MUST treat returned events as immutable.
- **`.spec.js` for unit/integration tests** — `node --test` no-args discovery skips them. Use `.test.js`. (Playwright can use `.spec.js`.)
- **Storing UTC timestamps (`Date.prototype.toISOString()` with `Z` suffix)** — breaks the "wall-clock" semantics in D-01. The user logging at 03:50 local must see 03:50 forever, regardless of timezone migrations or DST.
- **`Object.freeze` on `db.events`** — would prevent the store's `.push()` and `.splice()` mutations. Freeze CONFIG constants (D-09 inherited pattern from mindful-breathing), not the mutable runtime state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap, ESC-to-close, body-scroll-lock | Custom JS overlay | `<dialog>` + `dialog.showModal()` | [CITED: MDN] All free, Baseline since 2022 |
| UUID generation | Custom hash, `Math.random()` ID, timestamp string | `crypto.randomUUID()` | Global in Node 18+ and all evergreen browsers; cryptographically random |
| Test runner | Custom `assert` loop | `node:test` + `node:assert/strict` | Built-in to Node 22+; supports `describe`/`it`/`beforeEach`, mocking, timer mocking, parallelism |
| Function spy / mock | Manual closure tracking | `mock.fn()`, `mock.method()` | [CITED: nodejs.org/api/test.html#mocking] Stable (not experimental) |
| Clock freezing in tests | Globally monkey-patch `Date` | `clock-fixed.js` adapter | Adapter seam (D-07) handles this without monkey-patching Node |
| E2E browser automation | Headless puppeteer + assertions | `@playwright/test` | Industry standard; built-in `expect`, retries, `webServer` |
| Static dev server for E2E | Node http handler | Playwright `webServer.command: 'python -m http.server 8080'` | Available on every GH Actions ubuntu runner without install |
| JSON schema validation | Hand-written `typeof` checks | Phase 1: type-guards in store (`VALID_TYPES`, version check); defer richer validation to Phase 5 | A schema library would violate zero-deps. The store's guards (above) are sufficient for v1. |
| Date / time formatting library | Custom Intl wrapping | Native `Date` getters + `String.padStart` (see `formatLocalISO` above) | The app only deals with `YYYY-MM-DDTHH:MM` — 8 lines of native code is enough |

**Key insight:** The temptation in Phase 1 will be to install "just one helpful library" (uuid, date-fns, zod, jsdom). Resist. The dependency budget is **zero** for the runtime and **Playwright only** for dev. Every helper above is built into Node/the browser.

## Common Pitfalls

### Pitfall 1: 5-minute rounding strategy ambiguity

**What goes wrong:** "5-minute rounded" is ambiguous. Floor (06:33 → 06:30), nearest (06:33 → 06:35), or ceiling (06:33 → 06:35)? Different choices produce different test fixtures and user-visible behavior. The user logs at 06:32 — do they expect to see 06:30 or 06:35?

**Why it happens:** The CONTEXT.md says "rounded to 5 minutes" without specifying direction. WebSearch on sleep apps (Sleep Cycle, Sleep as Android) does NOT document the exact strategy publicly.

**Recommendation:** **Use round-to-nearest** with the half-to-even tiebreaker (`Math.round()`). Rationale: a wake-up logged at 06:32 maps to 06:30 (the user is *closer* to 06:30 than to 06:35); 06:33 maps to 06:35. This is the least surprising default and matches typical clock-reading behavior. **Document this choice in a comment in `js/lib/time.js`** so future readers don't change it casually.

**Concrete reference table:**

| Raw time | Floor | Nearest (RECOMMENDED) | Ceiling |
|----------|-------|----------------------|---------|
| 06:32 | 06:30 | **06:30** | 06:35 |
| 06:33 | 06:30 | **06:35** | 06:35 |
| 06:35 | 06:35 | **06:35** | 06:35 |
| 06:37 | 06:35 | **06:35** | 06:40 |
| 06:38 | 06:35 | **06:40** | 06:40 |
| 23:58 | 23:55 | **00:00 next day** | 00:00 next day ⚠️ |

**Warning signs:** A test fixture that uses 06:33 should expect 06:35 (nearest). A test that expects 06:30 from 06:33 is testing floor — flag it.

**Edge case:** Rounding 23:58 to the nearest 5 minutes pushes into the next day. The store must handle this — `roundTo5` returns a Date, which naturally carries the next-day rollover. Test it explicitly. (Pure-floor would avoid this, but round-to-nearest is the better UX default; the bucketer handles day rollover correctly because it operates on the rounded Date, not the pre-rounded one.)

### Pitfall 2: `new Date('YYYY-MM-DDTHH:MM')` parses as LOCAL — but date-only `YYYY-MM-DD` parses as UTC

**What goes wrong:** [CITED: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date] When the timezone offset is absent: **date-only forms are interpreted as UTC** while **date-time forms are interpreted as local time**. Mixing the two silently produces off-by-one-day bugs.

```javascript
new Date('2026-05-26')          // → 2026-05-26 00:00 UTC (might be 25 May in UTC-)
new Date('2026-05-26T00:00')    // → 2026-05-26 00:00 LOCAL
new Date('2026-05-26T00:00Z')   // → 2026-05-26 00:00 UTC
```

**Why it happens:** Historical web-compat spec error that can't be changed.

**How to avoid:** **Always pair the date with a time** when constructing or parsing event timestamps. The `parseLocalISO` helper in `js/lib/time.js` rejects malformed strings explicitly (regex match) — don't fall back to `new Date(string)` for the canonical event format.

**Warning signs:** A test that does `new Date(event.at)` works in UTC but fails in Europe/Warsaw (or vice versa). If you see `T-locale-dependent` test failures, this is it.

### Pitfall 3: DST transitions and "wall-clock" semantics

**What goes wrong:** D-01 stores events as wall-clock ISO timestamps without timezone. If the user logs at 02:30 on a spring-forward Sunday (Europe/Warsaw 2027-03-28: 02:00 → 03:00 CEST), the wall-clock time `2027-03-28T02:30` **does not exist** in their local timezone. [CITED: MDN] V8/SpiderMonkey use the "compatible" disambiguation strategy — they shift forward by the gap, giving you 03:30. The opposite happens in fall-back: 02:30 is ambiguous (exists twice).

**Why it happens:** The event log is timezone-naive. Real wall-clock times can be non-existent or ambiguous.

**How to handle in Phase 1:**
1. **Document the limitation in `js/lib/time.js`** — "Events are stored in local wall-clock; DST gaps shift forward, DST overlaps choose the earlier instant."
2. **Day bucketing is calendar-date based** (D-11) — uses the *string* date portion of `at`, never re-parses to a Date for grouping. This means DST has zero effect on the UI's day grouping.
3. **The subjective-night bucketer (`daysBySubjectiveNight`)** needs to compare an event's wall-clock hour against the cutover (04:00). Operate on the string `HH:MM` directly, not on parsed Date math. This sidesteps DST entirely for bucketing.
4. **Document Phase 1 acceptance:** "Within a single timezone, DST transition days may have a one-event bucketing irregularity. Acceptable for v1." A future user-configurable timezone setting (deferred indefinitely) would fix this properly.

**Warning signs:** A bucketing test that uses `new Date(event.at).getHours()` instead of `parseInt(event.at.slice(11, 13))` is DST-fragile. Prefer string ops over Date math in the bucketer.

### Pitfall 4: `QuotaExceededError` and corrupted-blob handling

**What goes wrong:** `localStorage.setItem` throws `QuotaExceededError` (DOMException code 22) when the 5 MB origin quota is exceeded. `localStorage.getItem` returns the raw string, and `JSON.parse` throws `SyntaxError` if the blob was corrupted (incomplete write, browser bug, manual user edit via devtools).

**Why it happens:** Both are user-reachable in normal operation — though unlikely at Phase 1 scale (1.2 MB at 10 years per CONTEXT.md math).

**How to avoid (Phase 1 minimum):**
- Wrap `localStorage.setItem` in try/catch in the adapter; surface a non-recoverable error to the UI ("Storage full — export and clear to continue"). [CITED: mmazzarolo.com/blog/2022-06-25-local-storage-status/, crocodillon.com — multiple sources agree]
- Wrap `JSON.parse` in try/catch; treat corrupted blob as "no data" with a `console.warn`. Phase 5's JSON import is the recovery path.
- **Do NOT** silently swallow errors — Phase 1 acceptable behavior is "fail loudly so the user knows to export". A real recovery flow (auto-export-on-quota-error) is a Phase 5 enhancement.

**Warning signs:** A test that fills 5 MB and expects graceful degradation should expect a *thrown error*, not silent data loss.

### Pitfall 5: Double-click idempotency for quick-log buttons

**What goes wrong:** User taps "Woke up" once, but the click handler fires twice (touch-click both fire on some mobile browsers; user double-taps quickly). Two events recorded at the same minute.

**Why it happens:** No idempotency guard at the store level.

**How to handle:** Two options, both reasonable for Phase 1:
- **(a) Debounce at the UI level** — disable the button for 300ms after click. Simple, but doesn't catch cross-tab scenarios.
- **(b) Idempotency at the store level** — when `addEvent('wake')` is called, if the previous event of the same type is within ±5 minutes of the new `at`, skip the insert. Trickier to test, more user-friendly.

**Recommendation:** **(a) for Phase 1** — 5-minute rounding already produces collisions on rapid clicks, so a debounce + de-duplication on `(type, at)` write is enough. Document the choice in the store.

**Warning signs:** An E2E test that double-clicks a button and expects exactly one event is testing this contract — make it pass.

### Pitfall 6: Edit-creates-duplicate bug

**What goes wrong:** The edit form's submit handler calls `store.addEvent(...)` instead of `store.editEvent(id, ...)`. User edits an event, gets two events — the original (unchanged) and the new (edited).

**Why it happens:** Modal is shared between Add and Edit (D-13). The discriminator is whether `existing` was passed to `openManualEntry`.

**How to avoid:** Pass an explicit `mode: 'add' | 'edit'` to the modal opener, or branch on `existing?.id`. Write an integration test before the UI code that asserts editing an event leaves `events.length` unchanged.

### Pitfall 7: `nightwatch:db` blob race across tabs

**What goes wrong:** User has the app open in two tabs. Both tabs load the blob at startup, both mutate independently, last write wins. Earlier events from one tab silently disappear.

**Why it happens:** localStorage `setItem` is synchronous but there's no transactional read-modify-write. The `storage` event fires in *other* tabs when one tab writes, but Phase 1 doesn't listen.

**How to handle in Phase 1:**
- **Acknowledge** as a known limitation. Single-subject use means it's a rare scenario.
- **Recommended Phase 1 mitigation:** On `addEvent`, do `db = storage.load() ?? db; db.events.push(...); storage.save(db);` — i.e., re-read before write. Reduces but does not eliminate the race.
- **Real fix is out of scope** — proper multi-tab sync needs BroadcastChannel or `storage` event listening, which Phase 8 (PWA hardening) is a better home for.
- **Document the limitation** in `js/store/event-log.js` near `persist()`.

### Pitfall 8: Playwright tests leaking localStorage between specs

**What goes wrong:** Test A logs 4 events, test B asserts the list is empty — but B sees A's data because Playwright reuses the browser context.

**Why it happens:** Playwright's default `context` persists localStorage across tests in the same project. Two cleanup options:
- Use `test.beforeEach(async ({ page }) => { await page.goto('/'); await page.evaluate(() => localStorage.clear()); });`
- Set `storageState: undefined` and `testIsolation: true` in `playwright.config.js` (default in recent Playwright versions).

**Warning signs:** Flaky test order — A then B passes, B then A fails.

## Runtime State Inventory

**Not applicable.** Phase 1 is a greenfield phase with no rename/refactor/migration component. There are no:

- Stored data to migrate (no prior runtime — the `nightwatch:db` key is being introduced fresh)
- Live service configs (no external services)
- OS-registered state (no scheduled tasks, no daemons)
- Secrets / env vars (no auth, no API keys)
- Build artifacts (no build step)

The pre-existing `sen.xlsx` spreadsheet is outside the runtime and will be one-time converted to CSV in Phase 5 — not relevant to Phase 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | node:test, Playwright runner, `npm` | ✓ | 24.15.0 local; CI uses `lts/*` (24) | — |
| npm | Playwright install only | ✓ | 11.12.1 | — |
| Python 3 | Playwright `webServer.command` for static serving in E2E | ✓ (Windows) / ✓ (Ubuntu CI default) | system | `npx http-server` (would add a devDep) |
| Chromium binary | Playwright E2E | downloaded via `npx playwright install --with-deps chromium` | matches Playwright 1.60.0 bundled version | — |
| Git | Version control | ✓ | (already in use) | — |
| GitHub Actions runner (ubuntu-latest) | CI | available | system | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- No fallback needed for any dependency.

**Note on Python:** If the developer's local environment does not have Python 3 on PATH, the Playwright `webServer.command` can fall back to `node -e "require('http').createServer((req, res) => require('fs').createReadStream('.' + req.url).pipe(res)).listen(8080)"` — a one-liner static server using only built-in Node. Recommend the planner add a small `scripts/serve.js` (5 lines) as a Python-free fallback so the project never depends on Python being available locally.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit + integration) | `node:test` (built-in to Node 22+) |
| Framework (E2E) | `@playwright/test` 1.60.0 (devDependency) |
| Config file (unit) | none — `node --test` auto-discovers `**/*.test.{js,cjs,mjs}` and `**/test/**/*.js` |
| Config file (E2E) | `playwright.config.js` at repo root |
| Quick run command | `node --test` (auto-discovers; runs in ~2-5s for Phase 1 size) |
| Full suite command | `node --test && npx playwright test` (or `npm test`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| LOG-01 | "Woke up" button records wake event at now, rounded to 5min | unit (rounding), integration (store wiring), E2E (click + assert) | `node --test` + `npx playwright test` | ❌ Wave 0: `tests/unit/time.test.js`, `tests/integration/event-log.test.js`, `tests/e2e/quick-log.spec.js` |
| LOG-02 | "Going to sleep" button → bedtime event | integration + E2E | same | ❌ Wave 0 |
| LOG-03 | "Nap start" button → napStart event | integration + E2E | same | ❌ Wave 0 |
| LOG-04 | "Nap end" button → napEnd event | integration + E2E | same | ❌ Wave 0 |
| LOG-05 | Manual entry/edit via form for any date | integration (addEventAt, editEvent), E2E (modal flow) | same | ❌ Wave 0: `tests/integration/manual-entry.test.js`, `tests/e2e/manual-entry.spec.js` |
| LOG-06 | Delete a logged event | integration + E2E | same | ❌ Wave 0 |
| LOG-07 | 5-min precision capture/storage/display | unit (`roundTo5` table-driven), integration | `node --test` | ❌ Wave 0: covered by `time.test.js` |
| LOG-08 | Subjective-night grouping with cutover ~04:00 | unit (`daysBySubjectiveNight` with table of cases), integration | `node --test` | ❌ Wave 0: `tests/unit/day-bucket.test.js` |
| LOG-09 | At most one nap per day | unit (validation helper, optional Phase 1) OR integration (read-side filter) | `node --test` | ❌ Wave 0: covered by `day-bucket.test.js` |
| DATA-04 | Reload survives | integration (memory adapter snapshot) + E2E (page reload) | both | ❌ Wave 0: `tests/integration/persistence.test.js`, `tests/e2e/reload.spec.js` |
| PLAT-08 | Unit tests run with `node --test`, zero install | smoke (the test command itself) | `node --test` returns 0 | scaffold setup |
| PLAT-09 | Integration tests compose adapters in Node | observed via passing integration suite | `node --test` | scaffold setup |
| PLAT-10 | Playwright E2E in `tests/e2e/`, devDep only | smoke (E2E runs in CI) | `npx playwright test` | scaffold setup |
| PLAT-11 | TDD discipline; every behavior has ≥1 test | meta — covered by the rows above | full suite | n/a |

### Sampling Rate

- **Per task commit:** `node --test` (~2-5 seconds for Phase 1; fast enough for save-on-write loops)
- **Per wave merge:** `node --test && npx playwright test` (Playwright cold start ~10-30s + per-spec time)
- **Phase gate:** Full suite green before `/gsd-verify-work` and PR merge

### Failure Categories that Matter for Sleep Logging

These are the user-visible classes of regression the test suite must catch:

1. **Data loss on reload** — covered by E2E reload spec + integration snapshot test
2. **Double-click creates duplicate events** — see Common Pitfall #5; E2E rapid-click spec recommended
3. **Edit creates duplicate instead of mutating** — see Common Pitfall #6; integration test with `assert.equal(events.length, 1)` after edit
4. **Wrong day grouping** — covered by unit tests on `daysByCalendar` and `daysBySubjectiveNight` with a table of edge cases (events at exactly 04:00, events crossing midnight, events on either side of subjective-night cutover)
5. **Local-vs-UTC parsing bug** — covered by unit tests on `parseLocalISO` and `formatLocalISO` round-trips
6. **Round-trip lossiness** — integration test asserts `JSON.parse(JSON.stringify(db))` equals `db` for a populated event log
7. **localStorage corruption** — integration test feeds a non-JSON blob to the memory adapter (simulating corruption) and asserts graceful "treat as empty" behavior

### Wave 0 Gaps

The repo currently has zero code and zero tests. Wave 0 must create:

- [ ] `package.json` with `"type": "module"`, devDep `@playwright/test`, test scripts
- [ ] `playwright.config.js` with `webServer` + `testDir: 'tests/e2e'`
- [ ] `.gitignore` for `node_modules/`, `playwright-report/`, `test-results/`, `.playwright/`
- [ ] `.github/workflows/ci.yml` — see §Code Examples
- [ ] `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `tests/e2e/.gitkeep` (or first test files)
- [ ] `js/adapters/storage-memory.js` and `js/adapters/clock-fixed.js` — needed by integration tests before the runtime code exists
- [ ] Framework install command: `npm install -D @playwright/test@latest && npx playwright install --with-deps chromium`

## Security Domain

### Applicable ASVS Categories (ASVS Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Adapter pattern isolates side-effects (D-07); single composition root (D-06) |
| V2 Authentication | **no** | Single-subject offline app, no auth, no accounts |
| V3 Session Management | **no** | No sessions |
| V4 Access Control | **no** | No multi-tenancy, no roles |
| V5 Input Validation | yes | Modal form inputs (date, hour 0-23, minute 0-55 step=5, type ∈ 4 values); store validates `type ∈ VALID_TYPES` and parses `at` with strict regex |
| V6 Cryptography | minimal | Only use: `crypto.randomUUID()` for IDs (native, no hand-roll) |
| V7 Errors & Logging | yes | `console.warn` on corrupted blob; thrown error on quota exceeded — never silently swallowed |
| V8 Data Protection | yes | localStorage stores user's sleep data on their device only; no transmission; D-09 forbids any network call (validated by zero-deps invariant) |
| V9 Communications | **no** | No network traffic at all in Phase 1 (Phase 8 service worker adds same-origin caching only) |
| V10 Malicious Code | n/a | No remote code, no eval, no dynamic script injection |
| V11 Business Logic | yes | 5-min rounding consistency, day-bucketing correctness, no-duplicate-on-edit (Pitfall #6), single-nap-per-day (LOG-09) |
| V12 Files & Resources | yes (Phase 5+) | Phase 5 CSV/JSON import will need this; Phase 1 has no file upload |
| V13 APIs | **no** | No HTTP API |
| V14 Configuration | yes | `package.json` correctly scoped (no runtime deps); CI pipeline pinned to action versions (v5) |

### Known Threat Patterns for vanilla-JS PWA + localStorage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-entered text being injected into innerHTML | Tampering | Use `textContent` / `createElement` for all dynamic content; never `innerHTML` with user data. Phase 1 has no rich text — event labels are fixed enum values, dates/times are well-formed. Low risk but enforce via lint or code review. |
| localStorage exfiltration by third-party scripts | Info disclosure | Phase 1 includes zero third-party scripts (zero-dep invariant). Phase 8 will add a CSP `default-src 'self'` header. |
| Storage quota DoS by unbounded growth | DoS | The 7-day display window doesn't prevent unbounded *storage* growth. At ~80 B/event × 4/day, hitting 5 MB takes ~10+ years (per D-02 math). Phase 1 acceptable. Phase 5 export gives the recovery path. |
| Cross-tab race corruption (Pitfall #7) | Tampering (self-inflicted) | Phase 1 acknowledges and mitigates partially (re-read before write). Full fix deferred to Phase 8. |
| Malicious JSON import (Phase 5) | Tampering | Out of scope for Phase 1. Phase 5 must validate `version === 1` and `events` schema before assignment. |
| Browser dev-tools editing localStorage to inject bogus data | Tampering | Treat localStorage as untrusted on every load — schema check + try/catch on JSON.parse. Already covered by Pattern #2 / Pitfall #4. |

**No new security tooling needed for Phase 1.** The zero-dep invariant + adapter-pattern isolation + strict input validation (`VALID_TYPES` set, regex `parseLocalISO`) are the security architecture. Document this rationale in the verifier checklist so Phase 1 doesn't bounce on a missing security-scanning task.

## Code Examples

### `playwright.config.js`

```javascript
// playwright.config.js
// Sources:
//   - playwright.dev/docs/test-webserver
//   - playwright.dev/docs/ci-intro (canonical CI example)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
});
```

### `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml
# Sources:
#   - playwright.dev/docs/ci-intro
#   - D-21 in CONTEXT.md
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 15
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: lts/*
      - name: Install dev dependencies
        run: npm ci
      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium
      - name: Run unit + integration tests (node:test)
        run: node --test
      - name: Run E2E tests (Playwright)
        run: npx playwright test
      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Notes:**
- `node-version: lts/*` resolves to Node 24 LTS as of 2026-05; pin to `'22'` if a 22-vs-24 difference ever bites.
- `npm ci` requires a `package-lock.json` to be committed. The planner should add a task to commit the lockfile.
- `node --test` with no args discovers `tests/unit/**/*.test.js` AND `tests/integration/**/*.test.js` AND `tests/e2e/**/*.test.js` — but the e2e dir uses `.spec.js` (Playwright convention), so it's NOT swept by `node:test`. ✓ Intended.

### Unit test example (`tests/unit/time.test.js`)

```javascript
// tests/unit/time.test.js
// Source: D-19, derived from Pattern 4 in §Architecture Patterns
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { roundTo5, formatLocalISO, parseLocalISO } from '../../js/lib/time.js';

describe('roundTo5', () => {
  // Table-driven so adding edge cases is one line
  const cases = [
    ['2026-05-26T06:32', '2026-05-26T06:30'],
    ['2026-05-26T06:33', '2026-05-26T06:35'],
    ['2026-05-26T06:35', '2026-05-26T06:35'],
    ['2026-05-26T06:37', '2026-05-26T06:35'],
    ['2026-05-26T06:38', '2026-05-26T06:40'],
    ['2026-05-26T23:58', '2026-05-27T00:00'],   // midnight rollover
  ];
  for (const [input, expected] of cases) {
    test(`${input} -> ${expected}`, () => {
      const rounded = roundTo5(parseLocalISO(input));
      assert.equal(formatLocalISO(rounded), expected);
    });
  }
});

describe('formatLocalISO / parseLocalISO round-trip', () => {
  test('round-trips for canonical event timestamp', () => {
    const original = '2026-05-26T03:50';
    assert.equal(formatLocalISO(parseLocalISO(original)), original);
  });
  test('rejects malformed input', () => {
    assert.throws(() => parseLocalISO('2026-05-26'),       /Invalid/);
    assert.throws(() => parseLocalISO('2026-05-26T3:50'),  /Invalid/);
    assert.throws(() => parseLocalISO('not-a-date'),       /Invalid/);
  });
});
```

### Integration test example (`tests/integration/event-log.test.js`)

```javascript
// tests/integration/event-log.test.js
// Source: D-07, D-08, D-19
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createEventLog } from '../../js/store/event-log.js';
import { createStorageMemory } from '../../js/adapters/storage-memory.js';
import { createClockFixed } from '../../js/adapters/clock-fixed.js';

function makeTestLog({ frozenAt = '2026-05-26T06:33' } = {}) {
  const storage = createStorageMemory();
  const clock = createClockFixed(new Date(2026, 4, 26, 6, 33));
  let nextId = 1;
  const id = () => `e${nextId++}`;            // predictable IDs in tests
  const log = createEventLog({ storage, clock, id });
  return { log, storage, clock };
}

describe('event-log: add', () => {
  test('addEvent records wake at clock.now() rounded to 5min', () => {
    const { log, storage } = makeTestLog();
    const evt = log.addEvent('wake');
    assert.equal(evt.type, 'wake');
    assert.equal(evt.at, '2026-05-26T06:35');     // 06:33 → 06:35 (nearest)
    assert.deepEqual(storage._snapshot(), {
      version: 1,
      events: [{ id: 'e1', type: 'wake', at: '2026-05-26T06:35' }],
    });
  });

  test('rejects invalid type', () => {
    const { log } = makeTestLog();
    assert.throws(() => log.addEvent('snore'), /Invalid event type/);
  });
});

describe('event-log: edit does not duplicate', () => {
  test('editEvent mutates in place, length unchanged', () => {
    const { log } = makeTestLog();
    const evt = log.addEvent('wake');
    log.editEvent(evt.id, { at: '2026-05-26T07:00' });
    assert.equal(log.listEvents().length, 1);
    assert.equal(log.listEvents()[0].at, '2026-05-26T07:00');
  });
});

describe('event-log: persistence', () => {
  test('a fresh store rehydrates from storage', () => {
    const { log, storage } = makeTestLog();
    log.addEvent('wake');
    // Simulate reload: build a new event log over the SAME storage
    const log2 = createEventLog({
      storage,
      clock: createClockFixed(new Date(2026, 4, 26, 7, 0)),
      id: () => 'unused',
    });
    assert.equal(log2.listEvents().length, 1);
    assert.equal(log2.listEvents()[0].at, '2026-05-26T06:35');
  });
});
```

### E2E test example (`tests/e2e/quick-log.spec.js`)

```javascript
// tests/e2e/quick-log.spec.js
// Source: D-19, Common Pitfall #8 (storage isolation)
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('quick-log "Woke up" adds an event and survives reload', async ({ page }) => {
  await page.getByRole('button', { name: /woke up/i }).click();

  // Event should appear in the list
  const list = page.getByRole('list', { name: /events/i });
  await expect(list.getByText('Wake')).toBeVisible();

  // Reload and verify it's still there
  await page.reload();
  await expect(list.getByText('Wake')).toBeVisible();
});

test('double-click does not produce duplicate', async ({ page }) => {
  const btn = page.getByRole('button', { name: /woke up/i });
  await btn.click({ clickCount: 2, delay: 50 });
  await page.waitForTimeout(400);   // past the debounce window
  const rows = page.getByRole('listitem').filter({ hasText: /Wake/ });
  await expect(rows).toHaveCount(1);
});
```

### Clock-fixed adapter (`js/adapters/clock-fixed.js`)

```javascript
// js/adapters/clock-fixed.js
export function createClockFixed(initial) {
  let t = initial instanceof Date ? initial : new Date(initial);
  return {
    now() { return new Date(t); },
    advance(ms) { t = new Date(t.getTime() + ms); },
    set(date) { t = date instanceof Date ? date : new Date(date); },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom overlay div + manual focus trap for modals | Native `<dialog>` + `showModal()` | Baseline since 2022 | Massive — no library needed for modals |
| Mocha / Jest for Node tests | `node:test` built-in (Node 22+) | Stable since Node 20.0; mocking stable in 22.0 | Phase 1 needs zero test-framework dependencies |
| Custom UUID library (`uuid` npm package) | `crypto.randomUUID()` global | Browsers: 2021-22; Node 18+ | Zero-dep UUIDs |
| `Math.random()` IDs | `crypto.randomUUID()` | Whenever cryptographic randomness matters | Phase 1 doesn't need crypto strength but the global is just as easy to use |
| jsdom for DOM-touching unit tests | Adapter pattern + memory adapter | Architecture choice (D-07) | No jsdom dependency, faster tests |
| `actions/setup-node@v4`, `actions/checkout@v4` | `@v5` | GitHub Actions current major | Use v5 per Playwright's official ci-intro |

**Deprecated / outdated to avoid:**
- `Date.prototype.toISOString()` for event storage — emits UTC `Z`-suffixed strings, conflicts with D-01 wall-clock semantics.
- `<input type="time">` with `step="300"` — already explicitly rejected in D-14 due to browser inconsistency.
- Node `--experimental-vm-modules` flags — not needed; ESM is stable in Node 20+.
- `actions/setup-node@v3` and earlier — superseded.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Round-to-nearest is the right 5-min rounding semantic for a sleep app | §Common Pitfalls #1 | If user expects floor, all timestamps off by up to +2 min. Test fixtures and visible times need a one-line change in `roundTo5`. Low risk — easy revert. |
| A2 | Python 3 is available on the developer's local machine | §Environment Availability | If Python is missing, Playwright `webServer.command` fails locally. Recommend planner add a 5-line `scripts/serve.js` (pure Node) as a Python-free alternative — converts assumption to backup plan. |
| A3 | Single-tab use is the dominant case; multi-tab race is acceptable Phase 1 limitation | §Common Pitfalls #7 | If user opens two tabs, some events silently lost. Mitigation (re-read before write) reduces but doesn't eliminate. Real fix is Phase 8. |
| A4 | DST irregularity on transition days is acceptable in v1 | §Common Pitfalls #3 | A handful of events twice a year may bucket unexpectedly. Real fix needs a timezone field on each event — out of scope. |
| A5 | `node --test` no-args discovery pattern is stable across Node 22 and 24 | §Standard Stack, §Validation Architecture | Verified locally on Node 24.15; documented behavior in Node v26 docs. Very low risk. |
| A6 | The user wants `.spec.js` for Playwright E2E and `.test.js` for unit/integration | §Architecture Patterns (Recommended Project Structure) | Convention choice; if user prefers `.test.js` everywhere, Playwright's `testMatch` can be set to `['**/*.test.js']`. One-line change. |
| A7 | Phase 1 acceptable behavior on `QuotaExceededError` is "throw and let the user know to export" rather than auto-trim | §Common Pitfalls #4 | If user prefers auto-trim (drop oldest events), implement now vs. defer to Phase 5. Recommend defer — Phase 5 export is the principled recovery path. |

**These assumptions need user confirmation in discuss-phase if a planner sees risk.** The planner may quietly resolve A2 (just add the Node fallback). A1 and A7 may warrant a one-question check-in.

## Open Questions

1. **Should the bucketer apply LOG-09 (at most one nap/day) at write or at read?**
   - What we know: The data model (D-01) is append-only; nothing prevents two `napStart` events on the same day. D-08 says day records are *derived on read*.
   - What's unclear: Does the user want a guard rail (block a second `napStart` for the same day) or just a display rule (the second nap shows but the prediction engine in Phase 3 only uses the first)?
   - Recommendation: **Read-side enforcement in Phase 1.** `daysByCalendar` and `daysBySubjectiveNight` pick the *first* `napStart` (and matching `napEnd`) per day and put any extras into a `dayRecord.extraNaps` array (visible in the list as a faint warning row). This keeps the data model clean and lets the user fix it via the edit modal. **Planner should confirm** with a one-question check-in if uncertain.

2. **Modal field validation behavior — silent normalize or block submit?**
   - What we know: D-13 says "rounds the minute to 5 if user typed a non-5-multiple". D-14 says minute input has `step="5"`.
   - What's unclear: If the user types `06:33` in the manual entry form, does the form (a) silently round to `06:35` on save with no UI feedback, or (b) flash a "rounded to 06:35" hint, or (c) block submit until they fix it?
   - Recommendation: **Option (a) silently round** is the simplest implementation and matches the quick-log button rounding. Add a small grey hint under the minute input: "Times are stored in 5-minute increments." Planner can decide based on visual budget; this is a UX nuance, not architecture.

3. **Confirm dialog for delete — native `confirm()` or custom `<dialog>`?**
   - What we know: D-12 says "click `[×]` → confirm dialog → delete". Doesn't specify which.
   - What's unclear: Native `window.confirm()` (ugly, blocking) vs. a second `<dialog>` (more code, consistent UX).
   - Recommendation: **Native `confirm()` is acceptable for Phase 1.** Phase 8 visual hardening will swap it for a styled dialog. Saves a few hours now; the deletion confirmation is rare-path UI.

4. **Does the 7-day display window count back from now (`clock.now()`) or from the most-recent event's date?**
   - What we know: D-10 says "last 7 calendar days visible by default".
   - What's unclear: If the user hasn't logged for 3 days, do they see the last 7 calendar days (4 of which have nothing) or the last 7 days *containing events*?
   - Recommendation: **Count back from `clock.now()`** — matches what "last 7 days" intuitively means. Empty days show with the date header and no events. Planner should pick this for consistency with the calendar-day grouping decision (D-11).

## Sources

### Primary (HIGH confidence)

- [VERIFIED: nodejs.org/api/test.html] Node `node:test` API — test file discovery patterns, mocking surface, `mock.fn` / `mock.method` / `mock.timers` / `mock.module` capabilities, all stable
- [VERIFIED: developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog] HTML `<dialog>` element — Baseline since 2022, `showModal()` provides focus trap + ESC + `aria-modal` automatically, gotchas around `method="dialog"` and `formnovalidate`
- [VERIFIED: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date] Date parsing — date-only forms UTC, date-time forms local (historical web-compat spec error); DST disambiguation strategy
- [VERIFIED: playwright.dev/docs/test-webserver] Playwright `webServer` configuration — `command`, `url`, `reuseExistingServer`, accepts any shell command including `python -m http.server`
- [VERIFIED: playwright.dev/docs/ci-intro] Official GH Actions workflow — `actions/checkout@v5`, `actions/setup-node@v5`, `node-version: lts/*`
- [VERIFIED: npm registry] `@playwright/test` version 1.60.0 published 2026-05-26 (today)
- [VERIFIED: local Node 24.15.0 test] `crypto.randomUUID()` global; `node --test` discovery + node:test mocking work as documented; `node --test path/to/file.test.js` works but `node --test path/to/dir` does NOT (the dir is treated as a script and fails — use no-args discovery instead)
- [CITED: nodejs.org/en/about/previous-releases] Node 22 (Jod) LTS supported through 2027, Node 24 (Krypton) LTS through 2028, Node 20 EOL March 2026
- [CITED: CONTEXT.md decisions D-01..D-22 in `.planning/phases/NW-01-log-persist/01-CONTEXT.md`] — load-bearing decisions for this phase
- [CITED: `../mindful-breathing/index.html`] Reference patterns: `Object.freeze` for config blocks (lines 1045-1110), localStorage key naming + try/catch wrapper (lines 1112-1364), `requestAnimationFrame` loop pattern (lines 1140-1697). Phase 1 doesn't need `requestAnimationFrame` (no animations yet) but the `Object.freeze` + try/catch idioms transfer directly.

### Secondary (MEDIUM confidence)

- [WebSearch verified with multiple sources: mmazzarolo.com, crocodillon.com, trackjs.com] `QuotaExceededError` handling — cross-browser code/name combinations, try/catch as the standard pattern, ~5 MB origin quota
- [WebSearch] ESM dual-import gotchas — must include `.js` extension in relative imports for browser compat; verified against MDN ESM guide

### Tertiary (LOW confidence)

- [WebSearch only, marked for validation] Sleep-tracking app rounding conventions (floor vs nearest vs ceiling) — no public documentation found from Sleep Cycle / Sleep as Android about their internal time-rounding strategy. Round-to-nearest is a recommendation grounded in general UX principles, not a documented industry standard. **Flagged as Assumption A1.**

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every dependency (Playwright, node:test) verified against official docs and registry
- Architecture: **HIGH** — patterns derived directly from CONTEXT.md decisions, validated against MDN and Node docs
- Pitfalls: **HIGH** for #1, #4, #5, #6, #8 (verified or self-evident from architecture). **MEDIUM** for #3 (DST), #7 (multi-tab race) — both are inherently theoretical until exercised; phase-acceptable mitigations are documented
- Validation Architecture: **HIGH** — test framework choices and CI workflow verified locally and against official docs
- Security Domain: **HIGH** — ASVS Level 1 mapping is conservative for a single-subject offline app; no novel security architecture introduced in Phase 1

**Research date:** 2026-05-26
**Valid until:** ~2026-06-26 for Playwright (rapid release cadence); ~2027-01-26 for stable Node APIs and `<dialog>` (mature, Baseline)

## RESEARCH COMPLETE

**Phase:** 1 - Log & Persist
**Confidence:** HIGH

### Key Findings

- **Zero runtime deps is achievable and well-supported** — every problem Phase 1 solves has a native browser or Node built-in (UUIDs via `crypto.randomUUID()`, modal via `<dialog>`, tests via `node:test`, mocks via `mock.fn` family). No "just one library" temptation should survive the planner's review.
- **`node --test` discovery requires `.test.js` naming** (not `.spec.js`) AND **passing a bare directory like `tests/unit` is broken on Node 24** (treats it as a script). Use no-args invocation or explicit file paths. This is a hard gotcha not visible in CONTEXT.md.
- **`Date` parsing has a wall-clock vs UTC split:** `'YYYY-MM-DD'` is UTC, `'YYYY-MM-DDTHH:MM'` is local. The codebase must always store the latter format (D-04) and parse with a strict regex (`parseLocalISO`), never falling back to `new Date(string)`.
- **DST irregularity on transition days is unavoidable** without a per-event timezone field (which is out of scope). The bucketer should operate on string slices, not parsed Date math, to dodge the issue.
- **Native `<dialog>` + `showModal()` eliminates a stack of accessibility hand-rolling** — focus trap, ESC, `aria-modal` are automatic. Baseline since 2022, no polyfill needed.
- **Round-to-nearest 5-min is the recommended default** (`Math.round(ms / 300000) * 300000`). Floor is also defensible; the choice should be documented in `js/lib/time.js` since it determines the test fixtures.
- **Storage adapter pattern eliminates the need for jsdom**, which is the right architectural call — the integration suite is pure Node with no DOM and no shim.

### File Created

`C:\Users\lukasz.bielinski\projects\sleep-tracker\.planning\phases\NW-01-log-persist\01-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Every dep verified against registry + official docs + local Node 24 |
| Architecture | HIGH | Patterns flow directly from D-01..D-22 + MDN-verified primitives |
| Pitfalls | HIGH/MEDIUM | 6 of 8 verified against authoritative docs; #3 (DST) and #7 (multi-tab) acknowledged as documented limitations rather than fully-fixable |
| Validation Architecture | HIGH | node:test discovery + Playwright CI YAML verified |
| Security | HIGH | ASVS L1 mapping conservative; no novel attack surface in Phase 1 |

### Open Questions (for discuss-phase / planner judgment)

1. LOG-09 enforcement at write or at read (recommend read-side)
2. Modal field validation: silent normalize vs visible "rounded" hint (recommend silent + grey hint)
3. Delete confirm: native `confirm()` vs custom `<dialog>` (recommend native for Phase 1)
4. 7-day window: from `clock.now()` or from most-recent event (recommend `clock.now()`)

Assumptions A1 (rounding semantic) and A7 (quota error behavior) may also warrant a one-question check-in if the planner is unsure.

### Ready for Planning

Research complete. Planner can now create PLAN.md tasks. Recommended task ordering hints:

1. **Wave 0 (scaffolding):** `package.json`, `playwright.config.js`, `.gitignore`, `.github/workflows/ci.yml`, `tests/{unit,integration,e2e}/` skeleton, `index.html` shell.
2. **Wave 1 (pure logic, strict TDD):** `js/lib/time.js`, `js/lib/day-bucket.js`, `js/lib/id.js` with full `tests/unit/` coverage. Tests written first.
3. **Wave 2 (adapters, TDD):** `js/adapters/storage-memory.js` and `js/adapters/clock-fixed.js` first (needed by integration tests), then `storage-local.js` and `clock-system.js`.
4. **Wave 3 (store integration, TDD):** `js/store/event-log.js` with full `tests/integration/` coverage.
5. **Wave 4 (UI, test-after with E2E guard):** `js/ui/today-screen.js`, `js/ui/manual-entry.js`, `js/ui/dom.js`, `js/app.js` composition root. E2E specs in `tests/e2e/` for every LOG-* requirement.
6. **Phase gate:** Full suite green; commit message uses REQ-IDs (LOG-01..09, DATA-04, PLAT-08..11).
