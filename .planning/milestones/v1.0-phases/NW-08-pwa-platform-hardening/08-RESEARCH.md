# Phase 8: PWA & Platform Hardening — Research

**Researched:** 2026-06-30
**Domain:** PWA (Service Worker, Web Manifest), GitHub Actions / GitHub Pages, SVG CSS Animation, vanilla JS platform hardening
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D8-01:** Deploy via GitHub Action to gh-pages branch. Filter to app-only files.
- **D8-02:** Deploy triggers on push to both `main` and `develop`.
- **D8-03:** Deploy runs after tests pass — appended to existing `ci.yml`.
- **D8-04:** Standard exclusion list — ships: `index.html`, `style.css`, `js/`, `manifest.json`, `sw.js`, `icons/`. Excludes: `tests/`, `.planning/`, `.github/`, `.claude/`, `scripts/`, `node_modules/`, etc.
- **D8-05:** In-app update banner when new SW is waiting — user triggers `skipWaiting()` via Reload button.
- **D8-06:** Update banner is a fixed top bar (40px), styled with existing CSS custom properties.
- **D8-07:** Cache-first strategy with versioned cache name `nightwatch-v1`. Pre-cache on install; delete old caches on activate; network fallback on miss.
- **D8-08:** file:// note — one-time dismissable, localStorage key `nw_file_note_dismissed`. SW registration silently skipped on `file:`.
- **D8-09:** Keep `#4f46e5` indigo accent. No palette redesign.
- **D8-10:** Icon style pass — thin stroke-based line art, rounded caps. PWA icons (192×192 and 512×512 PNG) from crescent-moon SVG.
- **D8-11:** Tab-switch fade — opacity 0→1, 150ms ease-in-out, CSS + requestAnimationFrame.
- **D8-12:** Chart SVG transitions — opacity fade + stroke-dasharray draw-in via CSS `@keyframes` only.
- **D8-13:** Typography refinement — tighten sizing, line-height, spacing across all four screens.
- **D8-14:** Settings modal cleanup — four logical groups + improved spacing.

### Claude's Discretion

- Icon style direction: thin stroke-based line art, calm/minimal register.
- Cache manifest generation: manual precache list in `sw.js` OR generated via deploy Action script.
- Specific CSS transition durations and easing curves (within ~150ms / ease-in-out range).
- Settings modal grouping taxonomy.

### Deferred Ideas (OUT OF SCOPE)

- README.md shipped to Pages.
- Full sequence chart animations (bars growing up, points flying in).
- Offline fallback page (offline.html).
- Maskable PWA icon variant.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Vanilla HTML/CSS/JS only | Already satisfied — confirm at implementation; document in phase notes |
| PLAT-02 | Multi-file split (not monolithic index.html) | Already satisfied — `index.html + style.css + js/**` in place |
| PLAT-03 | PWA manifest + service worker; offline; file:// | SW lifecycle patterns, manifest minimum fields, file:// guard |
| PLAT-04 | Deployable to GitHub Pages (no server) | GitHub Actions `actions/deploy-pages` or `peaceiris/actions-gh-pages` pattern |
| PLAT-05 | English UI | Already satisfied — document only |
| PLAT-06 | Visual identity — calm/dark/minimal, distinct accent | CSS animation patterns, icon style contract, typography refinement |
| PLAT-07 | In-app notifications only — no push | Already satisfied — Today screen next-event card is the notification surface |
</phase_requirements>

---

## Summary

Phase 8 hardens the already-complete Nightwatch app (Phases 1–7) into a shippable PWA. Four major workstreams: (1) add `sw.js` + `manifest.json` + `icons/` for installability and offline; (2) add a GitHub Actions workflow for CI+deploy to GitHub Pages; (3) add visual polish (icon style pass, tab-switch fade, chart SVG draw-in animations, typography refinement, settings modal grouping); and (4) add the file:// graceful-degradation note.

The project repo is `BielinskiLukasz/night-watch`, deployed at `bielinskilukasz.github.io/night-watch/` — a **subdirectory** GitHub Pages deployment. This is the single most critical deployment detail: `start_url: "./"` and `scope: "./"` in the manifest must remain relative (not `/`) because absolute paths starting with `/` resolve to the origin root rather than the subdirectory. No `.github/workflows/ci.yml` exists yet — it must be created from scratch.

Pre-committing the PNG icons (rather than generating them at CI time) is the recommended approach: it eliminates a CI build dependency, the icons are static assets that only change when the design changes, and it keeps the deploy pipeline simple. The `sw.js` precache list should be maintained manually in the file (not generated) given the small number of JS modules and the no-build-step constraint.

**Primary recommendation:** Create `sw.js`, `manifest.json`, `icons/icon-{192,512}.png`, and `.github/workflows/ci.yml` in Wave 0; add CSS transitions and icon style in Wave 1; add file:// note and update banner wiring in Wave 1. CSS transitions are CSS-only additions with no JS complexity.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Service worker registration + update detection | Browser / Client (`js/app.js`) | — | SW registration is a browser-side concern; `app.js` is the composition root |
| Service worker lifecycle (install/activate/fetch) | Browser / Client (`sw.js`) | — | SW runs in its own context, independent of the app JS |
| PWA manifest | Static / CDN (`manifest.json`) | — | Declarative file served alongside HTML |
| PWA icons | Static / CDN (`icons/`) | — | Pre-committed PNG files |
| Update banner UI (show/hide) | Browser / Client (`js/app.js`) | `style.css` | JS detects waiting SW; CSS styles the banner |
| file:// note UI | Browser / Client (`js/app.js`) | `style.css` | JS detects protocol; one-time note shown/dismissed |
| Tab-switch fade transition | Browser / CSS (`style.css`) | `js/app.js` (rAF) | CSS handles the animation; JS sets opacity:0 before display change |
| Chart SVG transitions | Browser / CSS (`style.css`) | `js/ui/charts-screen.js` (class assignment) | CSS `@keyframes` on SVG elements; JS assigns CSS class on re-render |
| Settings modal layout/grouping | Browser / Client (`js/ui/settings-modal.js`) | `style.css` | Structural HTML reorganisation + CSS fieldset spacing |
| GitHub Pages deployment | CI / GitHub Actions (`.github/workflows/ci.yml`) | — | Workflow file copies app files to gh-pages branch |
| Icon style pass | Browser / Client (`index.html`) | `style.css` | Inline SVG replacement inside existing `<button>` elements |

---

## Standard Stack

### Core (no new npm packages — existing project setup)

| Library / Tool | Version | Purpose | Notes |
|----------------|---------|---------|-------|
| Vanilla JS / CSS | ES2022+ | All SW logic, DOM wiring, CSS animations | No frameworks; hard constraint from CLAUDE.md |
| `node:test` + `node:assert` | built-in (Node 24.18) | Unit + integration tests | Already in use; no new packages |
| `@playwright/test` | `^1.60.0` (devDep) | E2E tests | Already in use; no new packages |
| `actions/checkout` | `v4` | CI: checkout repo | Official GitHub action |
| `actions/configure-pages` | `v5` | CI: configure GH Pages environment | Official GitHub action |
| `actions/upload-pages-artifact` | `v4` | CI: package files for Pages deploy | Official GitHub action (v4 required as of Jan 2025) |
| `actions/deploy-pages` | `v4` | CI: deploy packaged artifact to GH Pages | Official GitHub action |
| `actions/setup-node` | `v4` | CI: Node.js runtime for tests | Official GitHub action |
| `peaceiris/actions-gh-pages` | `v4` | Alternative deploy action (push to gh-pages branch) | Community action — simpler but third-party |

No new runtime npm packages. All standard dependencies are GitHub's official actions.

**Recommendation:** Use `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` (official GitHub path) over `peaceiris/actions-gh-pages`. The official path is the long-term supported option and does not require a separate `gh-pages` branch — it uses GitHub's artifact pipeline. [CITED: docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages]

### Supporting (icon generation)

The PNG icons (`icons/icon-192.png`, `icons/icon-512.png`) must be committed as binary files. Two options:

1. **Pre-commit the PNGs** (RECOMMENDED): Design the crescent-moon SVG, render to PNG once using any available tool (Inkscape, a browser-side canvas script, or sharp as a one-off script), commit the files. Zero CI dependency. [ASSUMED — this is a workflow decision, not a browser API]

2. **Generate in CI via `sharp`**: Add `sharp` as a `devDependency`; run `node scripts/generate-icons.js` in the CI workflow before the deploy step. Works but adds CI complexity. Sharp is `OK` on the npm registry. [ASSUMED — architecture decision]

---

## Package Legitimacy Audit

This phase installs **zero new runtime npm packages**. The GitHub Actions used are official GitHub-owned actions (`actions/` org) or well-established community actions.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| actions/checkout@v4 | GitHub Actions | 6+ yrs | N/A (official) | github.com/actions/checkout | OK | Approved — official GitHub action |
| actions/configure-pages@v5 | GitHub Actions | 2+ yrs | N/A (official) | github.com/actions/configure-pages | OK | Approved — official GitHub action |
| actions/upload-pages-artifact@v4 | GitHub Actions | 2+ yrs | N/A (official) | github.com/actions/upload-pages-artifact | OK | Approved — official GitHub action |
| actions/deploy-pages@v4 | GitHub Actions | 2+ yrs | N/A (official) | github.com/actions/deploy-pages | OK | Approved — official GitHub action |
| actions/setup-node@v4 | GitHub Actions | 6+ yrs | N/A (official) | github.com/actions/setup-node | OK | Approved — official GitHub action |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
index.html (browser load)
    │
    ├── <link rel="manifest"> ──────────────────► manifest.json
    │                                               ├── name, short_name, theme_color
    │                                               ├── start_url: "./"
    │                                               ├── scope: "./"
    │                                               ├── display: "standalone"
    │                                               └── icons: [192, 512]
    │
    ├── <script> SW registration ──────────────────► sw.js
    │      ├── location.protocol === 'file:'?         ├── install: cache.addAll(PRECACHE_LIST)
    │      │    └── show file:// note                 ├── activate: deleteOldCaches()
    │      └── register('/sw.js')                     └── fetch: cacheFirst()
    │            └── updatefound → waiting?
    │                 └── show update banner
    │                      └── user clicks Reload
    │                           └── reg.waiting.postMessage({type:'SKIP_WAITING'})
    │                                └── SW: self.skipWaiting()
    │                                     └── controllerchange → location.reload()
    │
    ├── style.css
    │      ├── .updateBanner (fixed top bar, z-index:200)
    │      ├── .fileNote (inline, dismissable)
    │      ├── screen transitions (opacity, 150ms)
    │      └── @keyframes drawLine (stroke-dashoffset)
    │
    └── js/app.js (composition root — SW wiring lives here)
           └── mounts all screens, header, bottom-nav

CI Pipeline (.github/workflows/ci.yml)
    push to main|develop
    │
    ├── job: test
    │    ├── node --test tests/unit/*.test.js
    │    ├── node --test tests/integration/*.test.js
    │    └── playwright test
    │
    └── job: deploy (needs: test)
         ├── actions/configure-pages
         ├── copy app files to staging dir (rsync or cp with exclusion list)
         ├── actions/upload-pages-artifact (path: staging-dir)
         └── actions/deploy-pages
```

### Recommended File Structure (new files only)

```
.
├── manifest.json          # NEW — PWA web manifest
├── sw.js                  # NEW — service worker (cache-first, versioned)
├── icons/
│   ├── icon-192.png       # NEW — PWA install icon (committed binary)
│   └── icon-512.png       # NEW — PWA install icon large (committed binary)
└── .github/
    └── workflows/
        └── ci.yml         # NEW — CI test + deploy workflow
```

Existing files modified:
- `index.html` — add `<link rel="manifest">`, SW registration `<script>` block, update banner element, file:// note element
- `style.css` — add update banner styles, file:// note styles, screen transition rules, SVG `@keyframes`, settings modal group styles, typography refinements, icon style CSS
- `js/app.js` — add SW registration logic, update banner show/hide, file:// detection
- `js/ui/settings-modal.js` — restructure fieldset groupings

### Pattern 1: Service Worker Cache-First with Versioned Cache

**What:** Pre-cache all app assets on install; serve from cache on fetch; delete stale caches on activate.

**When to use:** Single-page apps with a known, bounded set of files — perfect for this project.

```javascript
// sw.js
// Source: MDN developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

const CACHE_NAME = Object.freeze('nightwatch-v1');
const PRECACHE_LIST = Object.freeze([
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/adapters/clock-system.js',
  './js/adapters/storage-local.js',
  './js/lib/accuracy.js',
  './js/lib/chart-data.js',
  './js/lib/csv-parse.js',
  './js/lib/day-bucket.js',
  './js/lib/db-shape.js',
  './js/lib/forecast.js',
  './js/lib/id.js',
  './js/lib/import-export.js',
  './js/lib/settings-validate.js',
  './js/lib/stages.js',
  './js/lib/time.js',
  './js/store/event-log.js',
  './js/store/settings.js',
  './js/ui/accuracy-screen.js',
  './js/ui/bottom-nav.js',
  './js/ui/charts-screen.js',
  './js/ui/dom.js',
  './js/ui/header.js',
  './js/ui/history-screen.js',
  './js/ui/manual-entry.js',
  './js/ui/settings-modal.js',
  './js/ui/today-screen.js',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_LIST))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// skipWaiting message handler (D8-05)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

[CITED: developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers]

### Pattern 2: SW Registration with Update Banner Wiring

**What:** Register SW from app.js; detect `waiting` state; show banner; trigger `skipWaiting()` on user action; reload on `controllerchange`.

```javascript
// js/app.js — SW registration block (add to composition root)
// Source: web.dev/service-worker-lifecycle

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // Check if a worker is already waiting on page load
    if (reg.waiting) {
      showUpdateBanner(reg);
    }
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && reg.waiting) {
          showUpdateBanner(reg);
        }
      });
    });
  });

  // Reload when new SW takes control (after skipWaiting)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    location.reload();
  });
}

function showUpdateBanner(reg) {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  banner.hidden = false;
  document.body.classList.add('has-update-banner');  // adds padding-top: 40px
  banner.querySelector('.reload-btn').addEventListener('click', () => {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, { once: true });
}
```

[CITED: web.dev/service-worker-lifecycle]

### Pattern 3: file:// Detection and One-Time Dismissable Note

**What:** Detect `file:` protocol on page load; show inline note if not previously dismissed; store dismissal in localStorage.

```javascript
// js/app.js — file:// note block
// Security: textContent only (CLAUDE.md invariant)

const FILE_NOTE_KEY = 'nw_file_note_dismissed';  // D8-08 localStorage key

if (location.protocol === 'file:') {
  if (!localStorage.getItem(FILE_NOTE_KEY)) {
    const note = document.getElementById('file-note');
    if (note) {
      note.hidden = false;
      note.querySelector('.dismiss-btn').addEventListener('click', () => {
        localStorage.setItem(FILE_NOTE_KEY, '1');
        note.hidden = true;
      }, { once: true });
    }
  }
}
```

[ASSUMED — pattern based on project conventions established in CLAUDE.md and CONTEXT.md D8-08]

### Pattern 4: Tab-Switch Fade Transition

**What:** CSS-only opacity fade; JS sets opacity:0 via class before changing `display`, then `requestAnimationFrame` triggers the transition by removing the class.

```css
/* style.css — screen sections */
/* Source: CONTEXT.md D8-11 */

.screen-section {
  transition: opacity 150ms ease-in-out;
}

.screen-section.is-entering {
  opacity: 0;
}
```

```javascript
// js/app.js — applyTabVisibility (extend existing function)
// CLAUDE.md: use requestAnimationFrame for animated loops

function showScreen(screenEl) {
  screenEl.classList.add('is-entering');
  screenEl.hidden = false;
  requestAnimationFrame(() => {
    screenEl.classList.remove('is-entering');
  });
}
```

[ASSUMED — pattern follows CONTEXT.md D8-11 and CLAUDE.md requestAnimationFrame convention]

### Pattern 5: SVG Polyline Draw-In Animation with pathLength

**What:** CSS `@keyframes` animate `stroke-dashoffset` from full path length to 0; use `pathLength="1"` on the SVG element to normalize the length to 1, avoiding the need to measure actual pixel length.

```css
/* style.css — SVG draw-in animation */
/* Source: css-tricks.com/svg-line-animation-works */

@keyframes drawLine {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}

.chart-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: drawLine 300ms ease-out forwards;
}

@keyframes fadeInEl {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.chart-el-enter {
  opacity: 0;
  animation: fadeInEl 200ms ease-in forwards;
}
```

In `createElementNS`-generated SVG (per D7-08):
```javascript
// js/ui/charts-screen.js — example usage
const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
polyline.setAttribute('pathLength', '1');        // normalize length
polyline.classList.add('chart-line');            // triggers draw-in animation
```

[CITED: css-tricks.com/svg-line-animation-works, stefanjudis.com/today-i-learned/pathlength-makes-svg-path-animations-easier]

### Pattern 6: PWA Manifest for GitHub Pages Subdirectory

**What:** `start_url: "./"` and `scope: "./"` — relative paths that resolve correctly when `manifest.json` is served from the subdirectory root (`bielinskilukasz.github.io/night-watch/`). Absolute paths starting with `/` would resolve to the GitHub Pages root origin, breaking install.

```json
{
  "name": "Nightwatch",
  "short_name": "Nightwatch",
  "description": "Offline-first sleep tracker — log and forecast sleep events.",
  "theme_color": "#4f46e5",
  "background_color": "#fafafa",
  "display": "standalone",
  "start_url": "./",
  "scope": "./",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Critical insight:** `start_url: "/"` would launch the app at `bielinskilukasz.github.io/` (wrong), while `start_url: "./"` resolves to `bielinskilukasz.github.io/night-watch/` (correct). [CITED: various GitHub discussions + MDN recommendation for relative paths in subdirectory deployments]

### Pattern 7: GitHub Actions CI + Deploy Workflow

```yaml
# .github/workflows/ci.yml
# Source: docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

name: CI + Deploy

on:
  push:
    branches: [main, develop]
  pull_request:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Unit + integration tests
        run: node --test tests/unit/*.test.js tests/integration/*.test.js
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: E2E tests
        run: npx playwright test

  deploy:
    needs: test
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - name: Copy app files to staging
        run: |
          mkdir -p _site
          cp index.html style.css manifest.json sw.js _site/
          cp -r js icons _site/
      - uses: actions/upload-pages-artifact@v4
        with:
          path: '_site'
      - id: deployment
        uses: actions/deploy-pages@v4
```

[CITED: docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages]

### Anti-Patterns to Avoid

- **`start_url: "/"` on a subdirectory GitHub Pages deployment:** Resolves to origin root (`bielinskilukasz.github.io/`), not the app. Use `"./"` (relative to manifest location).
- **`scope: "/"` broader than app:** Would claim control over all paths at the origin, interfering with other GH Pages sites on the same domain. Use `"./"`.
- **Calling `skipWaiting()` automatically on install:** Breaks pages open in other tabs mid-session. Only call via user-triggered `postMessage`.
- **Forgetting `response.clone()` before caching:** Responses can only be read once. Cache the clone, return the original.
- **SW registration without `location.protocol !== 'file:'` guard:** On Chrome, `navigator.serviceWorker.register()` on a `file://` URL throws a SecurityError (not a silent no-op). Must guard before calling `register()`.
- **Using `innerHTML` for update banner or file:// note:** Violates CLAUDE.md textContent-only invariant. All dynamic content must use `textContent`.
- **Placing `sw.js` in a subdirectory (`js/sw.js`):** Default SW scope is the directory containing `sw.js`. A SW at `js/sw.js` can only control URLs under `js/` — it cannot intercept `index.html` fetches. `sw.js` must be at the project root.
- **Animating `stroke-dashoffset` without `pathLength="1"` on complex paths:** Without normalization, you must measure or guess the actual pixel length. Use `pathLength="1"` for deterministic values.
- **Precaching test or planning files:** `tests/`, `.planning/`, `.github/` must be excluded from `PRECACHE_LIST`. These paths do not exist in the deployed `_site/` directory anyway, but the list must not reference them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker caching | Custom cache management | Standard `caches.open/match/put/delete` API | Platform API handles everything; Workbox is overkill for this small app |
| PWA update detection | Polling or version endpoints | `updatefound` + `statechange` + `waiting.postMessage` lifecycle events | Built-in browser mechanism; reliable and battery-friendly |
| Icon rendering in browser | Canvas-based icon generation | Pre-committed PNG files | Zero runtime dependency; no canvas API required in SW or app code |
| SVG animation library | JS-driven animation loop | CSS `@keyframes` + `pathLength="1"` | CLAUDE.md: no npm runtime deps; CSS is sufficient for calm/fade register |
| GitHub Pages branch management | Manual branch push scripts | `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` | Official GitHub pipeline; no branch state to manage |

**Key insight:** Service workers are a platform API — the complexity is in knowing the lifecycle, not in writing code. The install/activate/fetch/message pattern is ~50 lines of vanilla JS. Do not introduce Workbox or any caching library.

---

## Common Pitfalls

### Pitfall 1: SW Scope Narrower Than App Due to File Location

**What goes wrong:** `sw.js` placed in `js/sw.js` — the SW only controls URLs under `js/` and cannot intercept navigation to `index.html` or fetch of `style.css`.

**Why it happens:** Default SW scope is the directory containing the SW file.

**How to avoid:** Place `sw.js` at the project root. Verify by checking `registration.scope` in the browser console after registration.

**Warning signs:** SW registers successfully but pages are never served from cache; DevTools shows SW scope as `https://…/js/`.

### Pitfall 2: SW `install` Fails If Any Precache URL Returns Non-2xx

**What goes wrong:** `cache.addAll()` rejects if any URL in the list returns 4xx or 5xx. The SW install fails silently; app still works from network but never goes offline.

**Why it happens:** `cache.addAll()` uses atomic all-or-nothing semantics.

**How to avoid:** Verify each URL in `PRECACHE_LIST` exists in the deployed `_site/` directory. Run a sanity check in CI: after copying, list the files and cross-check against the list.

**Warning signs:** SW state shows "redundant" in DevTools after first install; network tab shows no cache hits.

### Pitfall 3: Old Service Worker Blocks New Version

**What goes wrong:** New SW installs but stays in `waiting` state indefinitely because the user has the app open in another tab.

**Why it happens:** The default browser behaviour is to not activate a new SW while the old one controls any clients.

**How to avoid:** The update banner + `skipWaiting()` pattern (D8-05) resolves this. Also check `reg.waiting` on initial page load (not just on `updatefound`) in case a previous update was missed.

**Warning signs:** "Update available" banner never appears after deploying new version; DevTools SW panel shows both "installed" and "active" workers simultaneously.

### Pitfall 4: `start_url: "/"` Breaks PWA Install on Subdirectory

**What goes wrong:** Installed PWA icon opens `bielinskilukasz.github.io/` instead of `bielinskilukasz.github.io/night-watch/`.

**Why it happens:** Absolute path `/` resolves to origin root, ignoring the subdirectory.

**How to avoid:** Use `"start_url": "./"` (relative to manifest file location). Since `manifest.json` is in the `_site/` root, `./` resolves to the correct subdirectory URL.

**Warning signs:** Chrome install prompt appears, but launching the installed app shows a 404 or wrong page.

### Pitfall 5: `cache.addAll()` With Relative Paths May Resolve Differently in SW Context

**What goes wrong:** Precache paths like `./js/app.js` in `PRECACHE_LIST` resolve relative to the SW's own URL. If SW is at `https://…/night-watch/sw.js`, then `./js/app.js` resolves to `https://…/night-watch/js/app.js` — which is correct. But `caches.match(event.request)` may use the full request URL while the cache key was stored with a different URL form.

**Why it happens:** `cache.addAll()` stores the response keyed by the full resolved URL. `caches.match()` with `event.request` also uses the full URL. As long as paths are relative to the SW location (and the SW is at root), they match. Avoid mixing absolute and relative forms in `PRECACHE_LIST`.

**How to avoid:** Use consistent relative paths (all `./…`) in `PRECACHE_LIST`. Never mix `/night-watch/…` absolute with `./…` relative.

**Warning signs:** Cache shows assets stored at unexpected keys; match fails for expected resources.

### Pitfall 6: CI Node.js Version Mismatch for `node --test`

**What goes wrong:** `node --test` directory scanning (vs explicit file glob) behavior differs between Node 18 and Node 20+. The project's `"test": "node --test"` script may behave differently in CI if Node version is not pinned.

**Why it happens:** `node --test` with no arguments scans for test files, but behavior varies. The project's explicit glob `node --test tests/unit/*.test.js` is safer.

**How to avoid:** Pin `node-version: '20'` or `'22'` in `ci.yml`. Use explicit file globs in the CI test command, not bare `node --test`.

**Warning signs:** Tests pass locally but CI reports no tests found or directory scan errors.

### Pitfall 7: Update Banner Reload Loop

**What goes wrong:** After `skipWaiting()`, `controllerchange` fires and `location.reload()` runs. If the banner DOM element is still in the page during reload, a second `updatefound` event may fire for the now-active worker, re-showing the banner on the fresh page load.

**Why it happens:** `reg.waiting` check on initial load catches the worker that just activated; it is no longer waiting.

**How to avoid:** Check `reg.waiting` specifically (not just `reg.active`). The pattern `if (newWorker.state === 'installed' && reg.waiting)` is correct — after the `controllerchange` reload, `reg.waiting` will be `null` for the now-active worker.

**Warning signs:** "Update available" banner flashes briefly on every page load.

---

## Code Examples

### SW Precache List (Full Inventory for This Project)

Based on actual file scan of the project:

```javascript
// sw.js — complete PRECACHE_LIST for Nightwatch
// Source: project file scan 2026-06-30
const PRECACHE_LIST = Object.freeze([
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // App composition root
  './js/app.js',
  // Adapters
  './js/adapters/clock-system.js',
  './js/adapters/storage-local.js',
  // Pure-logic lib
  './js/lib/accuracy.js',
  './js/lib/chart-data.js',
  './js/lib/csv-parse.js',
  './js/lib/day-bucket.js',
  './js/lib/db-shape.js',
  './js/lib/forecast.js',
  './js/lib/id.js',
  './js/lib/import-export.js',
  './js/lib/settings-validate.js',
  './js/lib/stages.js',
  './js/lib/time.js',
  // Stores
  './js/store/event-log.js',
  './js/store/settings.js',
  // UI modules
  './js/ui/accuracy-screen.js',
  './js/ui/bottom-nav.js',
  './js/ui/charts-screen.js',
  './js/ui/dom.js',
  './js/ui/header.js',
  './js/ui/history-screen.js',
  './js/ui/manual-entry.js',
  './js/ui/settings-modal.js',
  './js/ui/today-screen.js',
]);
```

Note: `js/adapters/clock-fixed.js` and `js/adapters/storage-memory.js` are test-only adapters and should **NOT** be in the precache list. [VERIFIED: project file scan]

### Index.html Integration Points

```html
<!-- Add to <head> — Phase 8 insertion point (index.html line 14–17 comment) -->
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/icon-192.png">

<!-- Add to <body>, immediately after <header> — update banner -->
<div id="update-banner" hidden role="status" aria-live="polite">
  <span class="update-text"></span><!-- textContent set in JS: "Update available" -->
  <button type="button" class="reload-btn" aria-label="Reload to apply update">Reload</button>
</div>

<!-- Add to <body>, after banner — file:// note -->
<div id="file-note" hidden role="note">
  <span class="file-note-text"></span><!-- textContent set in JS -->
  <button type="button" class="dismiss-btn" aria-label="Dismiss"></button>
</div>
```

Security: both elements set their text via `textContent` in JS, not `innerHTML`. [ASSUMED — follows CLAUDE.md textContent invariant]

### CSS Update Banner

```css
/* style.css — update banner (D8-06) */
#update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #1e293b;
  color: #f8fafc;
  font-size: 0.875rem;
}

#update-banner[hidden] { display: none !important; }

#update-banner .reload-btn {
  color: #4f46e5;
  background: transparent;
  border: 1px solid #4f46e5;
  border-radius: 0.25rem;
  padding: 4px 12px;
  min-height: 44px;
  cursor: pointer;
  font-size: 0.875rem;
}

body.has-update-banner {
  padding-top: 40px;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `peaceiris/actions-gh-pages` push to branch | `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` (official artifact pipeline) | Jan 2025 (v4 required) | Official pipeline; no branch management needed |
| `actions/upload-pages-artifact@v1-v3` | `@v4` mandatory | Dec 2024 (deprecated announcement) | Old versions blocked on GitHub.com |
| Hardcoded `stroke-dasharray: 1000` (guessed length) | `pathLength="1"` attribute normalizes to 1 unit | ~2020 (widely adopted) | Eliminates JS `getTotalLength()` calls; pure CSS animation |
| `skipWaiting()` called automatically on install | `skipWaiting()` only on user-triggered `postMessage` | Best practice codified ~2019 | Prevents breaking other open tabs mid-session |
| SW at `js/sw.js` | SW must be at root for full scope | N/A — always-true browser rule | Always place `sw.js` at app root |

**Deprecated/outdated:**
- `actions/upload-pages-artifact@v3` and below: deprecated Jan 2025; blocked on GitHub.com as of a compliance deadline [CITED: github.blog/changelog/2024-12-05-deprecation-notice-github-pages-actions-to-require-artifacts-actions-v4-on-github-com]
- `-webkit-animation` / `@-webkit-keyframes` prefixes: not needed in modern evergreen Chromium, Firefox, Safari [ASSUMED — based on evergreen browser target in CLAUDE.md]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pre-committing PNG icons is simpler than CI generation | Standard Stack (Supporting) | Risk: low — alternate approach (sharp devDep script) also works; design decision only |
| A2 | `clock-fixed.js` and `storage-memory.js` are test-only adapters and should be excluded from precache | Code Examples | Risk: low — if they're needed at runtime, a fetch-miss would still fetch from network on first load; update precache list |
| A3 | `js/adapters/storage-memory.js` is not imported by `js/app.js` and has no runtime role | Code Examples | Risk: if wrong, cached version won't be served offline — fixable by adding to precache list |
| A4 | Tab-switch fade: `is-entering` CSS class + `requestAnimationFrame` approach | Pattern 4 | Risk: low — alternative is direct style manipulation; both satisfy D8-11 |
| A5 | file:// note uses `document.getElementById('file-note')` — element must exist in HTML | Pattern 3 | Risk: if element ID doesn't match, note silently won't appear — verify ID in HTML task |
| A6 | The CI YAML uses `node-version: '20'`; project currently uses Node 24.18 locally | Pattern 7 | Risk: minor version differences may affect test runner behavior; pin to lts/hydrogen (20) or lts/iron (22) for stability |
| A7 | `peaceiris/actions-gh-pages` is still maintained and viable as alternative to official pipeline | Standard Stack | Risk: community action may go unmaintained; official pipeline is recommended |

---

## Open Questions

1. **Icon generation workflow**
   - What we know: PNG icons must be committed as files; they are static assets.
   - What's unclear: Whether a Node.js icon-generation script should be created as a one-off helper script (e.g., `scripts/generate-icons.js` using `sharp` as devDep) or the PNGs are hand-created in a tool (Inkscape, Figma, browser canvas).
   - Recommendation: Create a `scripts/generate-icons.js` that runs once. Commit the PNGs. Do not run icon generation in every CI deploy.

2. **Test for SW (unit vs E2E)**
   - What we know: `sw.js` cache logic (cache name, precache list filtering) is testable in Node. SW lifecycle (install/fetch/offline) requires a browser context — Playwright can test this with the `serve.js` local server.
   - What's unclear: Whether offline Playwright tests (using `context.setOffline(true)`) should be added in Phase 8 or deferred.
   - Recommendation: Add at least one Playwright E2E test that verifies the SW registers and serves the app from cache when offline. Pure-logic SW unit tests (verify `PRECACHE_LIST` does not reference test files) can run in Node.

3. **`ci.yml` test command for integration tests**
   - What we know: `node --test tests/unit/*.test.js` works. The `node --test tests/unit/` directory scanning had an issue locally.
   - What's unclear: Whether the glob form works in Ubuntu runner shell (Bash) — glob expansion in `npm run test` vs direct `node --test` may differ.
   - Recommendation: Use explicit glob in CI: `node --test tests/unit/*.test.js tests/integration/*.test.js` rather than relying on directory scanning.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Unit/integration tests, serve.js | ✓ | 24.18.0 (local) | — |
| `@playwright/test` | E2E tests | ✓ | ^1.60.0 (devDep) | — |
| Git remote (GitHub) | CI workflow deployment | ✓ | `BielinskiLukasz/night-watch` | — |
| `.github/workflows/` directory | GitHub Actions | ✓ | dir exists (empty) | — |
| `ci.yml` | CI test + deploy workflow | ✗ | does not exist | Must be created in Wave 0 |
| `manifest.json` | PWA installability | ✗ | does not exist | Must be created in Wave 0 |
| `sw.js` | Service worker / offline | ✗ | does not exist | Must be created in Wave 0 |
| `icons/` directory and PNGs | PWA manifest icons | ✗ | does not exist | Must be created in Wave 0 |
| Inkscape / image editor | PNG icon generation | [ASSUMED] | unknown | Use browser canvas or sharp devDep script |

**Missing dependencies with no fallback:**
- `ci.yml` — must be created (Wave 0 task)
- `manifest.json` — must be created (Wave 0 task)
- `sw.js` — must be created (Wave 0 task)
- `icons/icon-192.png`, `icons/icon-512.png` — must be created (Wave 0 task)

**Missing dependencies with fallback:**
- Icon generation tool: fallback is using `sharp` as a devDependency one-off script.

---

## Security Domain

> `security_enforcement: true` in config.json — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 8 adds no auth |
| V3 Session Management | no | Phase 8 adds no sessions |
| V4 Access Control | no | No new access control |
| V5 Input Validation | yes — file:// note dismiss | `textContent` only (CLAUDE.md invariant); no user input rendered; localStorage key is static |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling (SW) | yes | SW errors are caught; no sensitive data in SW error messages |
| V14 Configuration | yes — SW precache | `Object.freeze` on `CACHE_NAME` and `PRECACHE_LIST` (CLAUDE.md convention) |

### Known Threat Patterns for Service Workers

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SW serving stale/outdated code indefinitely | Spoofing | Versioned cache name + `deleteOldCaches()` on activate |
| SW intercepting non-app requests (too broad scope) | Tampering | `scope: "./"` limits SW to app subdirectory only |
| XSS via update banner or file:// note | Tampering | All content via `textContent` (CLAUDE.md invariant) — no dynamic HTML |
| SW `postMessage` hijack (malicious page sends SKIP_WAITING) | Tampering | SW only accepts `{ type: 'SKIP_WAITING' }` message; browser enforces same-origin for postMessage |
| Supply chain via GitHub Actions | Tampering | Use pinned official actions (`@v4`) from `actions/` org; do not use unpinned community forks |
| localStorage key poisoning (`nw_file_note_dismissed`) | Spoofing | Value is only read as truthy/falsy; no arbitrary execution from localStorage |

**Security invariants carried forward from prior phases:**
- `textContent` only — never `innerHTML` on any dynamically generated content (CLAUDE.md)
- `Object.freeze` on all config objects exported from modules
- Zero npm runtime dependencies shipped to the app bundle

---

## Sources

### Primary (MEDIUM confidence — verified against official docs)
- [MDN — Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) — cache-first pattern, install/activate/fetch lifecycle, response.clone()
- [MDN — Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — manifest minimum fields, Safari behavior
- [Chrome Lighthouse — installable-manifest](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest) — Chrome installability criteria
- [web.dev — service-worker-lifecycle](https://web.dev/service-worker-lifecycle/) — updatefound/statechange/skipWaiting pattern
- [GitHub Docs — using-custom-workflows-with-github-pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — actions/deploy-pages YAML example
- [CSS-Tricks — svg-line-animation-works](https://css-tricks.com/svg-line-animation-works/) — stroke-dasharray/stroke-dashoffset technique

### Secondary (MEDIUM confidence — web search verified)
- [GitHub Changelog Dec 2024 — actions v4 required](https://github.blog/changelog/2024-12-05-deprecation-notice-github-pages-actions-to-require-artifacts-actions-v4-on-github-com/) — v4 artifact actions mandatory
- [Stefan Judis — pathLength="1" technique](https://www.stefanjudis.com/today-i-learned/pathlength-makes-makes-svg-path-animations-easier-to-manage/) — normalized path length for CSS animation
- GitHub issues/discussions on `start_url: "./"` for subdirectory PWA deployments

### Tertiary (LOW confidence — websearch only, requires confirmation)
- Icon generation approach (pre-commit vs CI sharp script)
- Exact Playwright API for offline testing (`context.setOffline`)

---

## Metadata

**Confidence breakdown:**
- SW lifecycle patterns: MEDIUM — MDN and web.dev are authoritative sources
- PWA manifest requirements: MEDIUM — Chrome Lighthouse docs are authoritative
- GitHub Actions workflow: MEDIUM — Official GitHub docs + verified v4 requirement
- SVG animation: MEDIUM — CSS-Tricks + browser MDN data
- Icon generation: LOW — approach chosen from multiple valid options; not from official docs
- `start_url: "./"` for subdirectory: MEDIUM — confirmed via multiple community sources + MDN guidance on relative paths

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (30 days — stable web platform APIs)
