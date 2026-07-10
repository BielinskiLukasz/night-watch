---
phase: 1
slug: log-persist
type: walking-skeleton
created: 2026-05-26
plan: 01-01-PLAN.md
---

# Phase 1 — Walking Skeleton Contract

> The first plan (`01-01-PLAN.md`) delivers a working end-to-end skeleton that
> proves Nightwatch's architecture before any logic depth is added.
> Subsequent plans extend this skeleton; they MUST NOT renegotiate the
> decisions captured here. Source decisions: `01-CONTEXT.md` D-01..D-22,
> `01-RESEARCH.md` §Architectural Responsibility Map + §Pattern 1, 2, 3, 5.

---

## What "Working Skeleton" Means for Nightwatch

A real user can: (1) load `index.html` in a browser, (2) click one quick-log
button, (3) see one event appear in the list, (4) reload the page, (5) see
that event still in the list. All four classic Walking-Skeleton spines are
proven by this single interaction:

| Spine | Phase 1 proof point |
|-------|--------------------|
| Composition root / routing | `js/app.js` boots, imports every layer, wires real adapters |
| Real persistence read/write | `js/adapters/storage-local.js` reads + writes `nightwatch:db` in real `localStorage` |
| Real UI interaction | One `<button data-log="wake">` in `index.html` fires the store path |
| Test scaffold | `node --test` runs at least one unit + integration test; `npx playwright test` runs at least one E2E spec; CI workflow runs both on push |

Plans 02–05 EXTEND this slice (more buttons, day grouping, manual entry, edit,
delete, security smoke). They MUST NOT replace `js/app.js`, the adapter
contracts, the storage key, or the canonical JSON shape.

---

## Locked Architectural Decisions (re-statement, NEVER renegotiate)

| ID | Lock |
|----|------|
| D-01 | Event shape `{ id, type, at }` where `type ∈ { 'wake', 'bedtime', 'napStart', 'napEnd' }` and `at = 'YYYY-MM-DDTHH:MM'` local wall-clock string |
| D-02 | Single localStorage key `nightwatch:db`, whole-blob rewrite per mutation |
| D-04 | Canonical JSON: `{ version: 1, events: [...] }` |
| D-05 | localStorage value byte-for-byte equals canonical JSON (load-bearing invariant for Phase 5) |
| D-06 | Layered directory layout: `js/{app.js, lib/, store/, adapters/, ui/}` |
| D-07 | `StorageAdapter { load(): DB \| null, save(db: DB): void }` and `ClockAdapter { now(): Date }`, injected at the composition root only |
| D-09 | No build step. `<script type="module" src="js/app.js">` in `index.html` |
| D-19 | Tests live in `tests/{unit,integration,e2e}/` with `node:test` for unit+integration and Playwright for E2E |
| D-20 | `package.json` is dev-only. `dependencies: {}`, `devDependencies: { "@playwright/test": "^1.60.0" }` |
| D-21 | Single GitHub Action runs the whole suite on push and PR |

---

## Directory Layout (frozen at end of Plan 01)

```
nightwatch/
├── index.html                  # Phase 1 shell; loads js/app.js as type=module
├── style.css                   # bare functional styles (themed in Phase 8)
├── js/
│   ├── app.js                  # composition root — Plan 01
│   ├── lib/
│   │   ├── time.js             # Plan 01 stubs roundTo5/formatLocalISO; Plan 02 fills the rest
│   │   ├── day-bucket.js       # Plan 02
│   │   └── id.js               # Plan 01
│   ├── store/
│   │   └── event-log.js        # Plan 01: addEvent + listEvents; Plan 03: daysByCalendar wiring; Plan 04: addEventAt/editEvent/deleteEvent
│   ├── adapters/
│   │   ├── storage-local.js    # Plan 01
│   │   ├── storage-memory.js   # Plan 01 (needed by integration tests)
│   │   ├── clock-system.js     # Plan 01
│   │   └── clock-fixed.js      # Plan 01 (needed by integration tests)
│   └── ui/
│       ├── today-screen.js     # Plan 01: 1 button; Plan 03: 4 buttons + list; Plan 04: row affordances
│       ├── manual-entry.js     # Plan 04
│       └── dom.js              # Plan 03
├── tests/
│   ├── unit/                   # Plan 01 stub; Plan 02 fills; Plan 03/04 extend
│   ├── integration/            # Plan 01 stub; Plans 02/03/04 extend
│   └── e2e/                    # Plan 01: reload.spec.js; Plan 03: quick-log.spec.js; Plan 04: manual-entry.spec.js
├── .github/workflows/ci.yml    # Plan 01
├── package.json                # Plan 01 (devDeps only)
├── playwright.config.js        # Plan 01
└── .gitignore                  # Plan 01
```

---

## Adapter Contracts (frozen at end of Plan 01)

```javascript
// StorageAdapter (D-07)
//   load(): DB | null         // returns null when key missing OR corrupted (warn + return null)
//   save(db: DB): void        // throws translated Error on QuotaExceededError; throws on any other write failure

// ClockAdapter (D-07)
//   now(): Date

// IdFactory (Claude's Discretion per CONTEXT.md)
//   (): string                // runtime uses crypto.randomUUID(); tests inject a counter
```

---

## Smoke Checks (executed at end of Plan 01)

1. `node --test` exits 0 with at least one unit test passing and one integration test passing.
2. `npx playwright test` exits 0 with the reload-persistence spec passing.
3. `cat package.json | python -c "import sys,json; d=json.load(sys.stdin); assert d.get('dependencies', {}) == {}, 'runtime deps detected'"` exits 0.
4. Manual: open `index.html` via `python -m http.server 8080` → `http://localhost:8080/` → click "Woke up" → reload → event still visible.
5. CI workflow green on push.

---

## What's NOT in the Skeleton (extended by later plans)

| Capability | Plan | Reason for deferral |
|------------|------|---------------------|
| 5-min rounding edge cases (round-to-nearest table) | 02 | Plan 01 stubs `roundTo5`; Plan 02 makes it correct via TDD |
| Day-bucketing (calendar + subjective-night, LOG-09 enforcement) | 02 | Pure-logic plan, deserves dedicated TDD focus |
| 3 remaining quick-log buttons + day-grouped list rendering | 03 | Extends the slice; LOG-02/03/04 |
| Manual entry / edit / delete modal | 04 | Add `<dialog>` + `addEventAt`/`editEvent`/`deleteEvent` |
| Security smoke (zero-deps, no innerHTML with user data, no `Date.now()` outside clock adapter) | 05 | T-04, T-07, T-08 mitigation tests |
| Service worker, manifest, theming | Phase 8 | Hard-deferred per `01-CONTEXT.md` domain section |
| CSV/JSON import-export | Phase 5 | The skeleton's canonical JSON shape is the contract Phase 5 must round-trip |

---

## How Later Plans Extend the Skeleton (no renegotiation)

- **Plan 02 (pure logic)** adds functions, never deletes Plan 01's stubs. After Plan 02, `js/lib/time.js` and `js/lib/day-bucket.js` are complete; Plan 01's tests still pass.
- **Plan 03 (slice extension)** adds buttons + list rendering. After Plan 03, the original LOG-01 quick-log E2E from Plan 01 still passes.
- **Plan 04 (slice extension)** adds the modal + edit/delete. After Plan 04, every earlier E2E still passes.
- **Plan 05 (hardening)** adds smoke tests asserting Plan 01's invariants. If Plan 05 fails, the failure is a real regression, not a redesign.
