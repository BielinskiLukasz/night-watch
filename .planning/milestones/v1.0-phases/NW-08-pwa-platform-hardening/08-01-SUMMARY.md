---
phase: NW-08
plan: "01"
subsystem: pwa
tags: [pwa, manifest, service-worker, icons, offline, platform]
requires: []
provides: [manifest.json, sw.js, icons/icon-192.png, icons/icon-512.png, scripts/generate-icons.js, tests/unit/sw-precache.test.js]
affects: []
tech_stack:
  added: []
  patterns: [cache-first service worker, Object.freeze PRECACHE_LIST, versioned cache name, pure-Node PNG generation]
key_files:
  created:
    - manifest.json
    - sw.js
    - icons/icon-192.png
    - icons/icon-512.png
    - scripts/generate-icons.js
    - tests/unit/sw-precache.test.js
  modified: []
decisions:
  - sw.js placed at project root (not js/sw.js) — default SW scope is the containing directory; root placement gives full app scope
  - PRECACHE_LIST frozen with 31 entries; excludes clock-fixed.js and storage-memory.js (test-only adapters); excludes sw.js itself (browser handles SW updates via byte-comparison, not cache API)
  - PNG icons generated as valid placeholder PNGs (#111827 solid background) using pure Node.js zlib + PNG binary encoding; replace with crescent-moon design via scripts/generate-icons.js APPROACH C (browser DevTools canvas) before v1 release
  - CACHE_NAME string 'nightwatch-v1' as const (Object.freeze on a primitive is a no-op but documents intent per project convention)
metrics:
  duration: 267s
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 6
status: complete
---

# Phase 8 Plan 01: PWA Manifest, Service Worker, Icons Summary

**One-liner:** Cache-first service worker with versioned PRECACHE_LIST (31 entries), PWA manifest with relative start_url, and placeholder PNG icons — all pinned by a 16-assertion unit test.

---

## What Was Built

### manifest.json (project root)
PWA web app manifest with all required installability fields:
- `name: "Nightwatch"`, `short_name: "Nightwatch"`
- `start_url: "./"` and `scope: "./"` — relative paths critical for GitHub Pages subdirectory deployment (`bielinskilukasz.github.io/night-watch/`)
- `theme_color: "#4f46e5"`, `background_color: "#fafafa"`, `display: "standalone"`
- Two icon entries: `icons/icon-192.png` (192×192) and `icons/icon-512.png` (512×512)

### sw.js (project root)
Service worker implementing cache-first strategy with versioned cache:
- `CACHE_NAME = 'nightwatch-v1'` (D8-07 contract)
- `PRECACHE_LIST = Object.freeze([...])` — 31 entries covering all runtime JS modules, adapters, stores, and UI files
- Four event handlers: `install` (cache.addAll), `activate` (delete old caches), `fetch` (cache-first), `message` (SKIP_WAITING)
- Excludes test-only adapters (`clock-fixed.js`, `storage-memory.js`) and all non-app paths

### icons/icon-192.png and icons/icon-512.png
Valid binary PNG files (PNG magic bytes `89 50 4E 47`) at 192×192 and 512×512 pixels. Currently solid `#111827` background (placeholder). The `scripts/generate-icons.js` helper documents the crescent-moon design spec with four generation approaches.

### scripts/generate-icons.js
One-off helper documenting the icon design and four generation approaches (Node canvas, Inkscape CLI, browser DevTools canvas, manual vector editor export). Not run in CI (T-08-01-SC accepted).

### tests/unit/sw-precache.test.js
16 assertions pinning PRECACHE_LIST deterministically:
- Verifies `Object.freeze` declaration present
- Verifies presence of `./index.html`, `./style.css`, `./manifest.json`, both icon paths, `./js/app.js`
- Verifies exclusion of `./sw.js` (SW files don't cache themselves)
- Verifies exclusion of `clock-fixed`, `storage-memory`, `tests/`, `.planning/`, `.github/`, `scripts/`
- Verifies all entries start with `./`
- Verifies count >= 31

---

## Verification Results

| Check | Status |
|-------|--------|
| `manifest.json` start_url="./" and scope="./" | PASS |
| `manifest.json` theme_color="#4f46e5", display="standalone", 2 icons | PASS |
| `sw.js` CACHE_NAME="nightwatch-v1" | PASS |
| `sw.js` PRECACHE_LIST frozen, 31 entries | PASS |
| `sw.js` excludes clock-fixed.js, storage-memory.js, tests/ | PASS |
| `sw.js` four event handlers present (install/activate/fetch/message) | PASS |
| `sw.js` SKIP_WAITING handler present | PASS |
| `sw.js` no require() calls (standalone SW file) | PASS |
| `icons/icon-192.png` valid PNG header (89 50 4E 47) | PASS |
| `icons/icon-512.png` valid PNG header (89 50 4E 47) | PASS |
| `node --test tests/unit/sw-precache.test.js` 16/16 | PASS |

---

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| Task 1 | feat | 76dc35e | create manifest.json, sw.js, and icon generation script |
| Task 2 | feat | 30c3d06 | add PWA icons and PRECACHE_LIST unit test |

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

1. **TDD RED phase:** sw-precache.test.js was written before the icons existed. The tests for `./icons/icon-192.png` and `./icons/icon-512.png` reference the PRECACHE_LIST entries (not the actual files), so they were passing because sw.js was already created in Task 1. This is expected TDD flow for a plan where Task 1 creates the implementation and Task 2 adds tests + remaining artifacts.

2. **Icon placeholder status:** The PNG icons are valid binary files satisfying the manifest reference and precache list requirements. The crescent-moon visual design should be applied using `scripts/generate-icons.js` APPROACH C (browser DevTools canvas) before v1 release. This is documented and tracked below.

---

## Known Stubs

| File | Description | Resolution Plan |
|------|-------------|-----------------|
| `icons/icon-192.png` | Solid `#111827` placeholder PNG — no crescent-moon design rendered | Use `scripts/generate-icons.js` APPROACH C (browser DevTools console) to generate crescent-moon icons before v1 release; re-commit |
| `icons/icon-512.png` | Same placeholder as above | Same resolution |

These stubs do NOT prevent the plan's goal (PLAT-03 PWA installability artifacts in place). The manifest references resolve, the SW precache list is valid, and the test suite confirms all exclusion invariants. The visual design can be applied independently without touching sw.js, manifest.json, or any test.

---

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's threat model covers:
- `T-08-01-01` (PRECACHE_LIST scope): Mitigated — `scope: "./"` in manifest, all 31 entries are runtime-only paths
- `T-08-01-02` (SKIP_WAITING hijack): Mitigated — exact type check `event.data.type === 'SKIP_WAITING'`, same-origin enforced by browser
- `T-08-01-03` (stale code): Mitigated — versioned `CACHE_NAME`, `deleteOldCaches` on activate
- `T-08-01-SC` (generate-icons.js): Accepted — dev helper only, never deployed

---

## Self-Check: PASSED

Files exist:
- manifest.json: FOUND
- sw.js: FOUND
- icons/icon-192.png: FOUND
- icons/icon-512.png: FOUND
- scripts/generate-icons.js: FOUND
- tests/unit/sw-precache.test.js: FOUND

Commits exist:
- 76dc35e: FOUND
- 30c3d06: FOUND
