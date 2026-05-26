# Nightwatch

A vanilla-JS, offline-first PWA for tracking a single subject's sleep
(night sleep + naps) and forecasting their next sleep events with explicit
uncertainty handling and prediction-accuracy scoring.

**Core value:** Given enough sleep history, predict the next wake-up, bedtime,
nap start, and nap end accurately enough to be useful — and surface accuracy
transparently. When `±delta > max_delta`, fall back to a probability band over
a window instead of pinning to a single time.

## Run locally

Nightwatch ships with a 5-line zero-dependency static server:

```bash
npm run serve          # starts http://localhost:8080
```

Open <http://localhost:8080>. Click any of the four quick-log buttons
(`Woke up`, `Going to sleep`, `Nap start`, `Nap end`) to record an event at
the current time, rounded to 5 minutes. Use `+ Add event` at the bottom of
the day list to back-fill a past day. Each row exposes `[edit]` and `[×]`
affordances. Reload the page — all events persist via `localStorage` under
the key `nightwatch:db`.

## Run tests

```bash
npm test               # full suite: node --test && playwright test
npm run test:unit      # node --test (unit + integration; ~5s on a laptop)
npm run test:e2e       # playwright test (e2e specs against the dev server)
```

`node --test` auto-discovers `tests/**/*.test.js`. Playwright uses
`playwright.config.js`; its `webServer` block boots `node scripts/serve.js`
on port 8080.

## Project layout

```
js/
  app.js               # composition root — adapters wired here only
  lib/                 # pure logic (time, day-bucket, id)
  store/event-log.js   # add/edit/delete + day-grouping delegation
  adapters/            # storage-local/memory, clock-system/fixed
  ui/                  # today-screen, manual-entry, dom helpers
tests/
  unit/                # node:test, pure-logic
  integration/         # node:test, store + memory adapter + fixed clock
  e2e/                 # Playwright specs against the running app
scripts/serve.js       # zero-dep static dev server
.github/workflows/ci.yml
```

## Architectural invariants

The integration smokes in `tests/integration/security-smoke.test.js` lock
these in. See `.planning/phases/NW-01-log-persist/01-SKELETON.md` for the
full rationale.

- **Zero runtime dependencies.** `package.json` `dependencies` is literal
  `{}` (T-08, D-20). CI fails fast on any addition.
- **No network in `js/`.** No `fetch(`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, dynamic `import()`, or external `<script src>` (T-04).
- **Clock seam.** `new Date()` lives only in `js/adapters/clock-*.js`. Other
  files inject a `ClockAdapter`. One UI default-prefill exemption is tagged
  `// gsd:allow-ui-clock` in `js/ui/manual-entry.js` (D-07).
- **Storage seam.** `localStorage` is touched only in
  `js/adapters/storage-local.js`. The composition root injects the adapter
  everywhere else (D-07).
- **No `.innerHTML = ...` with user data.** All dynamic DOM updates go
  through `textContent` / `replaceChildren()` via `js/ui/dom.js` (T-07).

## Commit message convention

```
<type>(NW-<phase>-<plan>): <REQ-IDs> short description per D-<XX>
```

`<type>`: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `style`, `chore`,
`ci`. `<REQ-IDs>` reference the stable identifiers in
`.planning/REQUIREMENTS.md`:

| Prefix | Domain                                              |
| ------ | --------------------------------------------------- |
| LOG    | Logging (quick-log buttons, manual entry, delete)   |
| CFG    | Configuration / Settings                            |
| PRED   | Forecast / prediction                               |
| UI     | Screens (Today, History, Charts, Accuracy)          |
| DATA   | Data lifecycle (export, import, persistence)        |
| STAGE  | Stage segmentation                                  |
| PLAT   | Platform (no-deps, PWA, testing scaffold, CI)       |

Example: `feat(NW-01-01-04): LOG-05,LOG-06 manual entry modal per D-13,D-14`.

## Phase 1 status (Log & Persist)

- `.planning/phases/NW-01-log-persist/01-01-SUMMARY.md` — Walking skeleton
- `.planning/phases/NW-01-log-persist/01-02-SUMMARY.md` — Pure-logic TDD
- `.planning/phases/NW-01-log-persist/01-03-SUMMARY.md` — Four quick-log buttons
- `.planning/phases/NW-01-log-persist/01-04-SUMMARY.md` — Manual entry + edit + delete
- `.planning/phases/NW-01-log-persist/01-05-SUMMARY.md` — Hardening (persistence + security smoke + CI + README)

## Roadmap

See `.planning/ROADMAP.md` for the eight-phase plan from logging through
PWA hardening. Phase 8 lands the manifest + service worker + GitHub Pages
deploy.
