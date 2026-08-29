// sw.js — Nightwatch service worker
// Source: D8-07 (cache-first strategy, versioned cache name 'nightwatch-v1')
//         PLAT-03 (PWA manifest + service worker for installability and offline)
//         RESEARCH.md Pattern 1 (SW lifecycle: install/activate/fetch/message)
//         08-PATTERNS.md (Object.freeze convention for PRECACHE_LIST)
//
// CRITICAL: This file must live at the project root (not js/sw.js).
// Default SW scope is the directory containing sw.js — only the root-level
// SW can intercept fetches for index.html and style.css.
// (RESEARCH.md Anti-Pattern: Placing sw.js in a subdirectory)
//
// Security notes (T-08-01-01, T-08-01-02, T-08-01-03):
//   - PRECACHE_LIST uses Object.freeze (CLAUDE.md convention)
//   - SKIP_WAITING only accepted on exact message type check (same-origin enforced by browser)
//   - Versioned CACHE_NAME ensures stale caches are purged on activate

const CACHE_NAME = 'nightwatch-v1';

// Object.freeze mirrors the SCREENS / TABS / CHART_MARGINS convention in app.js and ui modules.
// MUST NOT include: clock-fixed.js, storage-memory.js (test-only adapters)
// MUST NOT include: anything under tests/, .planning/, scripts/, .github/, .claude/
// These paths do not exist in the deployed _site/ directory.
const PRECACHE_LIST = Object.freeze([
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/favicon.jpeg',
  './icons/app-start.jpeg',
  // App composition root
  './js/app.js',
  // Adapters (runtime only — test-only adapters clock-fixed.js and storage-memory.js excluded)
  './js/adapters/clock-system.js',
  './js/adapters/storage-local.js',
  // Pure-logic lib
  './js/lib/accuracy-tif.js',
  './js/lib/accuracy.js',
  './js/lib/chart-data.js',
  './js/lib/csv-parse.js',
  './js/lib/day-bucket.js',
  './js/lib/db-shape.js',
  './js/lib/forecast-tif.js',
  './js/lib/forecast.js',
  './js/lib/id.js',
  './js/lib/metrics.js',
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
  './js/ui/metrics-screen.js',
  './js/ui/settings-modal.js',
  './js/ui/today-screen.js',
]);

// install: pre-cache all app assets atomically.
// If any URL in PRECACHE_LIST returns non-2xx the install fails — verify all paths
// exist in the deployed _site/ directory (RESEARCH.md Pitfall 2).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_LIST))
  );
});

// activate: delete all caches whose name does not match CACHE_NAME, then claim
// all open clients so controllerchange fires in app.js after skipWaiting() (D8-05).
// Without clients.claim(), navigator.serviceWorker.controller never changes and
// the Reload button's postMessage chain silently drops (no reload).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// fetch: cache-first with network fallback.
// Consistent relative paths in PRECACHE_LIST ensure cache keys match request URLs
// (RESEARCH.md Pitfall 5 — never mix absolute and relative forms).
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// message: skipWaiting handler (D8-05).
// Only responds to the exact { type: 'SKIP_WAITING' } message.
// Browser enforces same-origin for postMessage — no cross-origin hijack possible
// (T-08-01-02 mitigated).
// app.js sends this message when the user clicks the "Reload" button in the update banner.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
