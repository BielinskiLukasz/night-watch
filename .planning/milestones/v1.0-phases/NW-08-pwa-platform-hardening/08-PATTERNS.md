# Phase 8: PWA & Platform Hardening — Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 8 (4 new, 4 modified)
**Analogs found:** 7 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `sw.js` | service | request-response (cache-first fetch) | `js/lib/import-export.js` (Object.freeze, pure logic) | partial — no SW analog; RESEARCH.md patterns apply |
| `manifest.json` | config | static | `js/lib/db-shape.js` (frozen config shape) | partial — config shape only |
| `icons/icon-192.png` | static asset | — | — | no analog |
| `.github/workflows/ci.yml` | config (CI) | batch | — | no analog — must be created from scratch |
| `index.html` (modified) | config / view | request-response | `index.html` itself (existing structure) | exact — additive insertions only |
| `style.css` (modified) | config (styles) | — | `style.css` itself (existing custom properties) | exact — additive rules + `@keyframes` |
| `js/app.js` (modified) | service (composition root) | event-driven | `js/app.js` itself (existing composition root) | exact — additive SW registration block |
| `js/ui/settings-modal.js` (modified) | component | request-response | `js/ui/settings-modal.js` itself (existing fieldsets) | exact — restructure fieldset layout only |

---

## Pattern Assignments

### `sw.js` (service, cache-first fetch)

**Analog:** No existing SW in codebase. Use `js/lib/import-export.js` for `Object.freeze` config convention and RESEARCH.md Pattern 1 for SW lifecycle.

**Object.freeze config pattern** — from `js/app.js` lines 64–69:
```javascript
const SCREENS = Object.freeze({
  today: todayScreenEl,
  history: historyScreenEl,
  charts: chartsScreenEl,
  accuracy: accuracyScreenEl,
});
```
Apply same pattern to `CACHE_NAME` (string) and `PRECACHE_LIST` (array):
```javascript
const CACHE_NAME = 'nightwatch-v1';
const PRECACHE_LIST = Object.freeze([
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  // ... all js/adapters, js/lib, js/store, js/ui modules
  // EXCLUDE: js/adapters/clock-fixed.js, js/adapters/storage-memory.js (test-only)
]);
```

**Core SW lifecycle pattern** — from RESEARCH.md Pattern 1 (lines 253–278):
```javascript
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

**Security note:** `CACHE_NAME` is a constant string — `Object.freeze` on a primitive is a no-op but signals intent. Freeze `PRECACHE_LIST` (array) directly.

---

### `manifest.json` (config, static)

**Analog:** No direct analog. Use RESEARCH.md Pattern 6.

**Critical constraint:** `start_url: "./"` and `scope: "./"` — relative paths required for GitHub Pages subdirectory deployment (`bielinskilukasz.github.io/night-watch/`). Absolute `/` resolves to origin root and breaks install.

**Theme color** — already declared in `index.html` line 8:
```html
<meta name="theme-color" content="#4f46e5" />
```
Use `"theme_color": "#4f46e5"` in manifest to match.

**Manifest shape** — from RESEARCH.md Pattern 6:
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

---

### `icons/icon-192.png` and `icons/icon-512.png` (static assets)

**Analog:** No analog — binary PNG files, committed pre-generated.

**Style reference:** The existing favicon SVG in `index.html` line 12 shows the current crescent-moon motif:
```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
  <rect width='32' height='32' rx='7' fill='%23111'/>
  <circle cx='22' cy='10' r='5' fill='%234f46e5'/>
  <circle cx='14' cy='18' r='6' fill='none' stroke='%234f46e5' stroke-width='2'/>
</svg>" />
```
Also the bottom-nav Today icon in `js/ui/bottom-nav.js` lines 26–30:
```javascript
{
  id: 'today',
  label: 'Today',
  pathD: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',  // crescent moon
},
```
PWA icon should unify these two motifs: rounded-rect background (`rx='7'`, `fill='#111'`) with the crescent moon path centred, sized for 192×192 and 512×512 PNG export.

---

### `.github/workflows/ci.yml` (CI config, batch)

**Analog:** No existing workflow file in `.github/workflows/`. Must be created from scratch.

**Pattern** — from RESEARCH.md Pattern 7. Key points:
- Two jobs: `test` (unit + integration + E2E) and `deploy` (needs: test, only on push).
- `permissions: pages: write` + `id-token: write` required for `actions/deploy-pages@v4`.
- Use `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` (official GitHub pipeline — NOT `peaceiris/actions-gh-pages`).
- Node version: pin to `'22'` (LTS) rather than `'20'`, given local Node 24.18 usage.
- E2E: `npx playwright install --with-deps chromium` before `npx playwright test`.
- Deploy staging: `mkdir -p _site && cp index.html style.css manifest.json sw.js _site/ && cp -r js icons _site/`.

```yaml
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
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: node --test tests/unit/*.test.js tests/integration/*.test.js
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test

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

---

### `index.html` (modified — additive insertions)

**Analog:** `index.html` itself. Three insertion points:

**Insertion 1 — `<head>`, replace the Phase 8 comment block (lines 13–17):**
```html
<!--
  PWA manifest and service-worker registration are intentionally OMITTED
  in Phase 1; they land in Phase 8 (PWA hardening) ...
-->
```
Replace with:
```html
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

**Insertion 2 — `<body>`, immediately after `<header class="appHeader">` block (~line 37):**

Update banner + file note use the `hidden` attribute (already enforced by `style.css` line 13: `[hidden] { display: none !important; }`). Text is set via `textContent` in JS (never `innerHTML` — CLAUDE.md invariant).

```html
<div id="update-banner" hidden role="status" aria-live="polite">
  <span class="update-text"></span>
  <button type="button" class="reload-btn" aria-label="Reload to apply update">Reload</button>
</div>

<div id="file-note" hidden role="note">
  <span class="file-note-text"></span>
  <button type="button" class="dismiss-btn" aria-label="Dismiss">×</button>
</div>
```

**Existing `hidden` attribute pattern** — `index.html` line 63:
```html
<div id="stage-selector-container" style="display:none"></div>
```
Note: for new elements prefer `hidden` attribute over `style="display:none"` (the CSS `[hidden]` rule in `style.css` line 13 already handles override-safety with `!important`).

---

### `style.css` (modified — additive rules)

**Analog:** `style.css` itself. Copy existing button/color variable conventions.

**Existing CSS custom property sources** (lines 87–101 show color usage):
```css
/* accent: #4f46e5 — used on button[data-log], .groupingToggle button[aria-pressed] */
/* surface hover: #f1f5f9 — used on .appHeader .settingsTrigger:hover */
/* muted text: #475569 — used on .appHeader .settingsTrigger, .groupingToggle button */
/* border: #cbd5e1 — used on .groupingToggle button */
```
These hex values are used inline (no CSS variable declarations yet in the file). The update banner and file note must reference the same values for visual consistency.

**Update banner pattern** — from RESEARCH.md CSS excerpt:
```css
#update-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
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
  min-height: 44px;      /* tap target — mirrors existing button[data-log] sizing */
  cursor: pointer;
  font-size: 0.875rem;
}
body.has-update-banner { padding-top: 40px; }
```

**Tab-switch fade** — CSS side. Apply `transition` to screen sections; `is-entering` class sets `opacity: 0`:
```css
.screen-section {
  transition: opacity 150ms ease-in-out;
}
.screen-section.is-entering {
  opacity: 0;
}
```

**SVG draw-in animation** — copy `pathLength="1"` normalization technique:
```css
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

**Settings modal group spacing** — mirrors existing fieldset pattern in `index.html` lines 175–252. Add spacing between fieldset groups:
```css
#settings fieldset + fieldset {
  margin-top: 1.5rem;
}
#settings fieldset legend {
  font-weight: 600;
  font-size: 0.875rem;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

### `js/app.js` (modified — additive SW registration block)

**Analog:** `js/app.js` itself (composition root). The SW block is appended after the existing `applyTabVisibility()` call at the bottom.

**Composition root pattern** — `js/app.js` lines 1–34 show the existing import + init structure. The SW block follows the same guard pattern as the `if (bottomNavEl)`, `if (chartsScreenEl)` checks (lines 112–130):
```javascript
if (bottomNavEl) {
  mountBottomNav({ root: bottomNavEl, onTabChange: (tabId) => { ... } });
}
```
Apply same defensive guard style to SW:
```javascript
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting) showUpdateBanner(reg);
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && reg.waiting) showUpdateBanner(reg);
      });
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    location.reload();
  });
}
```

**file:// note pattern** — use the localStorage key `nw_file_note_dismissed` (D8-08). Storage reads already use `localStorage` directly in `js/adapters/storage-local.js` — same pattern:
```javascript
const FILE_NOTE_KEY = 'nw_file_note_dismissed';
if (location.protocol === 'file:') {
  if (!localStorage.getItem(FILE_NOTE_KEY)) {
    const note = document.getElementById('file-note');
    if (note) {
      note.hidden = false;
      note.querySelector('.file-note-text').textContent =
        'Running from local file — install from the web version for offline support.';
      note.querySelector('.dismiss-btn').addEventListener('click', () => {
        localStorage.setItem(FILE_NOTE_KEY, '1');
        note.hidden = true;
      }, { once: true });
    }
  }
}
```

**Tab-switch fade** — extend `applyTabVisibility()` (lines 71–77). The current implementation sets `el.style.display` directly. Phase 8 adds the `is-entering` class + `requestAnimationFrame` flush — per CLAUDE.md convention (`requestAnimationFrame` for animated loops):
```javascript
function showScreen(screenEl) {
  screenEl.classList.add('is-entering');
  screenEl.hidden = false;
  requestAnimationFrame(() => {
    screenEl.classList.remove('is-entering');
  });
}
```
`applyTabVisibility()` currently uses `el.style.display = (tabId === activeTab ? '' : 'none')`. Replace with `el.hidden = (tabId !== activeTab)` + `showScreen(el)` for the active screen (the `[hidden]` CSS rule already handles `display:none`).

**Security invariant** — all dynamic text in the update banner and file note is set via `.textContent`, matching the established pattern in `js/ui/bottom-nav.js` line 86: `span.textContent = tab.label;`.

---

### `js/ui/settings-modal.js` (modified — fieldset layout/grouping refactor)

**Analog:** `js/ui/settings-modal.js` itself. The refactor is HTML-structural (in `index.html`) and CSS-spacing (in `style.css`). The JS logic in `settings-modal.js` is unchanged except for DOM query selectors if element IDs change.

**Existing fieldset structure** (from `index.html` lines 175–252):
- `<fieldset>` Profile: subjectName
- `<fieldset>` Time & Day: cutoverHour, groupingMode, timeFormat
- `<fieldset>` Forecast tuning: autoOutlier, maxDelta, minDays, windowDays, statBlend
- `<fieldset>` Import / Export: importCsvBtn, importJsonBtn, importStatus
- `<fieldset id="stagesFieldset">` Stages: stagesList, addStageBtn

**D8-14 proposed regrouping** — four logical groups:
1. **Profile & Display**: subjectName, timeFormat, groupingMode
2. **Prediction**: minDays, maxDelta, windowDays, statBlend, autoOutlier
3. **Day Structure**: cutoverHour
4. **Data**: Import / Export buttons + Stages

**JS query pattern to preserve** — `settings-modal.js` uses `form.querySelector('[name="fieldName"]')` for value reads and `dlg.querySelector('#stagesFieldset')` for the stages section. If the fieldset `id="stagesFieldset"` is preserved, all existing selectors continue working without JS changes.

---

### `js/ui/charts-screen.js` (modified — add CSS class on re-render for draw-in animation)

**Analog:** `js/ui/charts-screen.js` itself (lines 1–60 show existing SVG creation pattern).

**Existing SVG element creation pattern** — `js/ui/charts-screen.js` lines 33, 63+:
```javascript
const SVG_NS = 'http://www.w3.org/2000/svg';
const polyline = document.createElementNS(SVG_NS, 'polyline');
```

**Phase 8 addition** — add `pathLength="1"` and the `chart-line` CSS class on `<polyline>` elements, and `chart-el-enter` class on heatmap `<rect>` elements. Only the class assignment and `pathLength` attribute are added; no structural chart changes:
```javascript
polyline.setAttribute('pathLength', '1');
polyline.classList.add('chart-line');    // triggers CSS draw-in animation
```
```javascript
rect.classList.add('chart-el-enter');   // triggers CSS opacity fade-in
```

---

## Shared Patterns

### Security: `textContent` only (never `innerHTML`)
**Source:** Enforced throughout — `js/ui/bottom-nav.js` line 86, `js/ui/settings-modal.js` header comment lines 14–18, `index.html` comment line 144.
**Apply to:** All new DOM text in update banner, file note (`span.textContent = '...'`), and any SW-related UI elements.

### `Object.freeze` on config
**Source:** `js/app.js` lines 64–69 (`SCREENS`), `js/ui/charts-screen.js` lines 34–52 (`CHART_MARGINS`, `SLEEP_LEN_SVG`, etc.), `js/ui/bottom-nav.js` lines 17–48 (`VALID_TABS`, `TABS`).
**Apply to:** `CACHE_NAME` const (string — freeze is no-op but documents intent), `PRECACHE_LIST` array in `sw.js`.

### `hidden` attribute + `[hidden] { display: none !important }` enforcement
**Source:** `style.css` lines 11–15:
```css
[hidden] {
  display: none !important;
}
```
**Apply to:** `#update-banner` and `#file-note` elements use `hidden` attribute (not `style="display:none"`). JS toggles `.hidden = true/false`.

### Inline SVG with `createElementNS`
**Source:** `js/ui/bottom-nav.js` lines 63–82, `js/ui/charts-screen.js` line 33.
**Apply to:** Any new SVG icons added during the icon style pass. Use `document.createElementNS('http://www.w3.org/2000/svg', 'svg')` pattern; never `innerHTML` for SVG.

### Defensive `if (el)` guard before DOM manipulation
**Source:** `js/app.js` lines 100–130 (all mountX calls wrapped in `if (el)`).
**Apply to:** SW registration block, update banner show/hide, file note show/dismiss — all guarded with `if (document.getElementById(...))` before manipulating.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `sw.js` | service | request-response (SW lifecycle) | No service worker exists in the codebase; use RESEARCH.md Pattern 1 |
| `.github/workflows/ci.yml` | CI config | batch | No CI workflow exists; use RESEARCH.md Pattern 7 |
| `icons/icon-192.png` / `icons/icon-512.png` | static asset | — | Binary files — no code pattern; pre-generate from crescent-moon SVG using favicon inline SVG in `index.html` line 12 as the design reference |

---

## Metadata

**Analog search scope:** `js/`, `index.html`, `style.css`, `.github/`
**Files read:** `js/app.js`, `index.html`, `style.css` (2 passes), `js/ui/settings-modal.js`, `js/ui/charts-screen.js`, `js/ui/bottom-nav.js`
**Pattern extraction date:** 2026-06-30
