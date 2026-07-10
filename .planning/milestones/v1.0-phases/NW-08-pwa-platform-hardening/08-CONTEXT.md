# Phase 8: PWA & Platform Hardening - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 hardens the already-complete Nightwatch app (Phases 1–7) for real-world distribution. By the end of this phase:

1. **PWA manifest + service worker** — App installs to home screen from GitHub Pages; assets are pre-cached for offline use; an in-app banner notifies users of updates.
2. **file:// compatibility** — App works fully when opened as a local file; SW registration is gracefully skipped with a subtle dismissable note.
3. **GitHub Pages deployment pipeline** — A GitHub Action deploys only the app files (not planning/tests/scripts) to `gh-pages` on every push to `main` or `develop` that passes tests.
4. **Visual identity polish** — Icon style pass (consistent stroke-based SVG icons), subtle tab-switch fade transitions, chart SVG transitions on data change, typography refinement, and Settings modal cleanup (layout/spacing + grouping).

Phase 8 does NOT include:
- New user-facing features or data model changes
- Multi-profile or multi-nap support (v2)
- Browser/OS push notifications (v2)
- CSV export (not in DATA-01..03 scope)

**Already satisfied (verified, no work needed):**
- PLAT-01 (vanilla JS only) — enforced since Phase 1
- PLAT-02 (multi-file split) — `index.html` + `style.css` + `js/**/*.js` already in place
- PLAT-05 (English UI) — implemented throughout
- PLAT-07 (in-app notifications only) — Today screen "next event" card is the notification surface; no browser push

</domain>

<decisions>
## Implementation Decisions

### GitHub Pages Deployment Pipeline

- **D8-01:** Deploy via **GitHub Action → gh-pages branch**. The action filters to app-only files (`index.html`, `style.css`, `js/`, `manifest.json`, `sw.js`, `icons/`). Planning docs, tests, and dev configuration are never publicly served.

- **D8-02:** Deploy Action triggers on push to **both `main` and `develop` branches**. User will disable the `develop` trigger after the active development phase ends. Both branches produce a live deploy.

- **D8-03:** Deploy runs **after tests pass** — the existing `ci.yml` gets a deploy step appended after the green unit + integration + E2E run. A red test suite blocks the deploy.

- **D8-04:** **Standard exclusion list for Pages deploy.** Ships: `index.html`, `style.css`, `js/`, `manifest.json`, `sw.js`, `icons/`. Excludes: `tests/`, `.planning/`, `.github/`, `.claude/`, `scripts/`, `node_modules/`, `nw-research-test/`, `package.json`, `package-lock.json`, `playwright.config.js`, `CLAUDE.md`, `sen.csv`, `README.md`.

### Service Worker & Offline

- **D8-05:** **In-app update banner** when a new service worker is waiting. The page detects the `waiting` state, shows the banner, and the user triggers `skipWaiting()` by clicking "Reload".

- **D8-06:** Update banner is a **fixed top bar** — thin, muted background, small text "Update available", a Reload button. Styled with existing CSS custom properties (`--color-surface`, `--color-accent`, etc.). Does not block content.

- **D8-07:** **Cache-first with versioned cache name** (e.g., `nightwatch-v1`). On SW install, pre-cache all app files from the manifest. On activate, delete caches with old names. On fetch, serve from cache; network only on cache miss.

- **D8-08:** When opened from `file://`, show a **subtle dismissable note**: "Running from local file — install from the web version for offline support." The note is one-time (dismissed state stored in localStorage). SW registration is silently skipped when `location.protocol === 'file:'`.

### Visual Identity & Polish (PLAT-06)

- **D8-09:** **Keep `#4f46e5` indigo accent** — it is already distinct from `mindful-breathing`. No palette redesign.

- **D8-10:** **Icon style pass** — Claude picks a consistent style within the calm/dark/minimal register, extending the aesthetic of the existing Settings gear icon (thin line-art, rounded caps). All bottom-nav icons, quick-log button icons, and any other inline SVG icons are reviewed and unified. PWA manifest icons (192×192 and 512×512 PNG) are generated from the crescent-moon SVG design.

- **D8-11:** **Subtle tab-switch fade** — new screen fades in at ~150ms opacity transition. Feels polished without being jarring. Carries the "ambient" register of the design.

- **D8-12:** **Chart SVG transitions** — when data changes (stage switch, new event logged), charts re-draw with a short CSS animation (polyline path animates in, heatmap rects ease into opacity). No JS animation library — CSS `@keyframes` on SVG elements only.

- **D8-13:** **Typography refinement** — review and tighten font sizing, line-height, and spacing across all four screens (Today, History, Charts, Accuracy) for visual consistency.

- **D8-14:** **Settings modal cleanup** — both layout/spacing AND logical grouping of controls. Related settings should be visually clustered (e.g., Prediction settings together, Display settings together). Breathing room added between groups.

### Claude's Discretion

- Icon style direction: Claude picks within calm/minimal constraint, keeping coherence with the existing Settings gear. Thin stroke-based line art recommended.
- Cache manifest generation: Claude decides whether to maintain the precache list manually in `sw.js` or generate it via the deploy Action script.
- Specific CSS transition durations and easing curves: within the ~150ms / ease-in-out range.
- Settings modal grouping taxonomy: Claude proposes logical groups based on existing settings fields.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Full project context, constraints, key decisions. Specifically: file-as-truth storage, no npm runtime dependencies, Object.freeze configs, TDD discipline, vanilla HTML/CSS/JS only constraint, GitHub Pages distribution target.

- `.planning/REQUIREMENTS.md` — Phase 8 requirements: PLAT-01 through PLAT-07. PLAT-01, PLAT-02, PLAT-05, PLAT-07 are already satisfied — verify at runtime, document, no new work. PLAT-03 (PWA manifest + SW), PLAT-04 (GitHub Pages deploy), PLAT-06 (visual identity) are the active work items.

- `.planning/ROADMAP.md` § Phase 8 — Phase boundary, 4 success criteria, depends on Phase 7.

- `CLAUDE.md` — Repo conventions: TDD discipline, REQ-IDs in commits, no npm runtime deps, textContent-only security invariant, Object.freeze config objects.

### Prior phase decisions (load-bearing for Phase 8)

- `.planning/phases/NW-01-log-persist/01-CONTEXT.md` — D-19–D-22 (testing scaffold: unit in `tests/unit/`, integration in `tests/integration/`, E2E in `tests/e2e/`). Service worker precache MUST exclude all test files.

- `.planning/phases/NW-07-charts-heatmap-accuracy/07-CONTEXT.md` — D7-08 (all SVG rendered via `createElementNS`, never innerHTML), D7-09–D7-11 (chart rendering patterns). Phase 8 adds CSS transitions to these SVG elements.

### Source code (integration points)

- `index.html` — Phase 8 adds `<link rel="manifest" href="manifest.json">` and the SW registration `<script>` block (or inline). Currently has a comment saying these are deferred to Phase 8 (line 15–17). Also adds the file:// note element and the update banner element.

- `style.css` — Phase 8 adds: update banner styles, file:// note styles, tab-switch fade transitions, chart SVG animation keyframes, Settings modal group styles, typography refinement.

- `js/app.js` — Phase 8 adds: SW registration logic, update banner show/hide logic, file:// detection and note display.

- `js/ui/settings-modal.js` — Phase 8 refactors layout and grouping of settings controls.

- `.github/workflows/ci.yml` — Phase 8 appends the deploy step (copy app files → push to gh-pages). File may not exist yet (was planned in Phase 1 but may not have been created if GitHub Actions was unavailable).

### New files Phase 8 will create

- `manifest.json` — PWA web manifest (name, short_name, icons, theme_color, display, start_url, scope)
- `sw.js` — Service worker (pre-cache install, cache-first fetch, versioned cache, update detection + message passing)
- `icons/icon-192.png` — PWA install icon
- `icons/icon-512.png` — PWA install icon (large)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`js/app.js` (composition root)** — SW registration and update banner wiring belong here. Already imports and mounts all screens; adding SW lifecycle hooks is a natural extension.

- **`style.css` CSS custom properties** — `--color-surface`, `--color-accent`, `--color-text-muted` etc. already defined. Update banner and file:// note should use these rather than hardcoded colors.

- **`index.html` comment (lines 14–17)** — Explicitly documents that manifest and SW are Phase 8 additions. The comment marks the exact insertion point.

- **Existing inline SVG in `index.html`** (Settings gear, bottom-nav icons) — The icon style pass builds on these existing paths. Claude should inspect them first to understand the current stroke weight and viewport size conventions before designing the unified style.

### Established Patterns

- **Security invariant: `textContent` only** — The update banner and file:// note must use `textContent` for any dynamic values. Never `innerHTML`.
- **`Object.freeze` for config** — Cache name constant and precache list array should be `Object.freeze`d in `sw.js`.
- **Zero npm runtime dependencies** — `sw.js` and `manifest.json` must be plain files with no imports. The GitHub Pages deploy Action may use `actions/checkout` and `actions/deploy-pages` (standard GitHub marketplace actions) which are not npm runtime deps.
- **TDD discipline** — SW logic that is testable (cache key generation, precache list validation) should have unit tests. SW registration/lifecycle may be tested via Playwright (install prompt, offline mode).

### Integration Points

- **`ci.yml`** — Append deploy job that runs after the existing test job. Must not change test behavior. Deploy step: `rsync` or a shell copy of the allowed file list to a temp dir, then push to `gh-pages` using `peaceiris/actions-gh-pages` or `actions/deploy-pages` (standard GH action).
- **`index.html` `<head>`** — Add `<link rel="manifest">` and SW registration script block.
- **`js/ui/settings-modal.js`** — Layout/grouping refactor is additive CSS + HTML restructuring; no functional changes to settings logic.

</code_context>

<specifics>
## Specific Ideas

- **Update banner wording:** "Update available — tap to reload" (or "Reload" button label). Consistent with PLAT-07 (in-app only).

- **file:// note wording:** "Running from local file — install from the web version for offline support." One-time dismissable via localStorage flag.

- **Cache name versioning:** Start at `nightwatch-v1`. The deploy Action (or SW file itself) should make it easy to bump the version string when needed.

- **Chart CSS animation approach:** `opacity: 0 → 1` on SVG child elements with a short `transition: opacity 200ms ease-in`. For polylines, a `stroke-dasharray`/`stroke-dashoffset` draw-in animation (classic SVG line animation) is a fitting detail for a "calm, ambient" register.

- **Settings modal grouping sketch:** Likely groups: (1) Subject & display (name, time format, theme), (2) Prediction (min_days, max_delta, window size, stat blend), (3) Day structure (cutover hour), (4) Data (rejected days list, import/export links). Exact grouping subject to Claude review of current fields.

</specifics>

<deferred>
## Deferred Ideas

- **`README.md` shipped to Pages** — User chose the standard exclusion list which excludes README.md. If a public landing page is wanted, that's a future task (create a separate `docs/index.html` or re-include README).
- **Animated chart transitions (complex)** — Phase 8 adds simple opacity/draw-in transitions; full sequence animations (bars growing up, points flying in from left) are deferred to v2.
- **Offline fallback page** — A custom offline.html served when the user tries to navigate to a URL that isn't pre-cached and the network is unavailable. Not in scope for Phase 8 (single-page app with all assets pre-cached).
- **Maskable PWA icon variant** — A `maskable` icon with safe-area padding for Android's adaptive icon system. Deferred; the standard 192/512 PNGs satisfy the install requirement.

</deferred>

---

*Phase: 8-PWA & Platform Hardening*
*Context gathered: 2026-06-30*
