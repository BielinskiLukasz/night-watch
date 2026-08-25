# Phase 8: PWA & Platform Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 8-PWA & Platform Hardening
**Areas discussed:** GitHub Pages deploy pipeline, Service worker update lifecycle, Visual theme scope (PLAT-06)

---

## GitHub Pages Deploy Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| GH Action → gh-pages branch | Filter app files, push to gh-pages branch. Planning/tests never publicly served. | ✓ |
| Serve from main branch root | No action needed, simplest setup. Planning docs, tests publicly accessible. | |

**User's choice:** GH Action → gh-pages branch

---

| Option | Description | Selected |
|--------|-------------|----------|
| On push to main only | Deploy on every push to main automatically | |
| Manual trigger only | User decides when to publish via workflow_dispatch | |
| On push to main AND develop | Both branches produce a live deploy | ✓ |

**User's choice:** Push to both main and develop
**Notes:** User will disable the develop trigger after the active development phase ends.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy after tests pass (same workflow) | Append deploy step to existing ci.yml after green tests | ✓ |
| Separate deploy workflow | Independent deploy.yml, deploys regardless of test status | |

**User's choice:** Deploy after tests pass

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standard exclusion list | Ship only index.html, style.css, js/, manifest.json, sw.js, icons/ | ✓ |
| Ship everything from root | No exclusion, simplest configuration | |

**User's choice:** Standard exclusion list

---

## Service Worker Update Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Instant takeover (skipWaiting) | New SW takes control on next reload automatically | |
| In-app update banner | Banner appears when new SW is waiting; user triggers reload | ✓ |
| You decide | Claude picks simpler implementation | |

**User's choice:** In-app update banner

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed top bar, subtle | Thin bar at top, muted background, Reload button | ✓ |
| Toast / snackbar bottom | Floating snackbar at bottom right | |

**User's choice:** Fixed top bar

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cache-first with versioned cache name | Pre-cache on install, delete old caches on activate | ✓ |
| Stale-while-revalidate | Serve cache + background network fetch | |

**User's choice:** Cache-first with versioned cache name

---

| Option | Description | Selected |
|--------|-------------|----------|
| Silent skip — no UI | Detect file:// and skip SW registration silently | |
| Subtle informational note | One-time dismissable note explaining file:// limitation | ✓ |

**User's choice:** Subtle informational note
**Notes:** "Running from local file — install from the web version for offline support." SW registration still silently skipped; the note is the only visible indication.

---

## Visual Theme Scope (PLAT-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep #4f46e5 indigo | Current accent is already distinct; Phase 8 focuses on PWA shell | ✓ |
| Redesign accent palette | Replace with new color; finalize visual identity in Phase 8 | |

**User's choice:** Keep #4f46e5 indigo

---

| Option | Description | Selected |
|--------|-------------|----------|
| Satisfied with current icons | No icon change; just add PWA manifest PNGs | |
| Icon style pass | Review and unify all SVG icons for consistent style | ✓ |

**User's choice:** Icon style pass

---

| Option | Description | Selected |
|--------|-------------|----------|
| Thin line-art (stroke-only) | 1.5–2px stroke weight, rounded caps, no fills | |
| Filled + stroked hybrid | Active = subtle fill, inactive = stroke-only | |
| You decide | Claude picks within calm/minimal constraint | ✓ |

**User's choice:** You decide (Claude decides)

---

| Option | Description | Selected |
|--------|-------------|----------|
| No additional polish | PWA shell + icons is enough | |
| Subtle transitions / micro-interactions | Tab fades, quick-log press feedback, chart transitions | ✓ |
| Typography refinement | Tighten font sizing, line-height, spacing | ✓ |
| Settings modal cleanup | Layout/spacing AND grouping | ✓ |

**User's choice:** All three (transitions + typography + settings cleanup)
**Notes:** User mentioned "some mess" in Settings specifically.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Instant / no animation | Tabs switch instantly | |
| Subtle fade (opacity) | ~150ms fade on tab switch | ✓ |
| You decide | Claude picks within calm/minimal | |

**User's choice:** Subtle fade (~150ms)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — subtle SVG transitions | Charts animate on data change (opacity + stroke-dashoffset draw-in) | ✓ |
| No — instant re-render | Charts re-render immediately | |

**User's choice:** Yes, subtle SVG transitions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Layout / spacing only | Fields and labels need breathing room | |
| Grouping / organization only | Related controls should be clustered | |
| Both layout and grouping | Spacing AND grouping need work | ✓ |

**User's choice:** Both layout and grouping

---

## Claude's Discretion

- Icon style direction: Claude picks a consistent style within calm/dark/minimal, coherent with the existing Settings gear SVG.
- Cache manifest generation approach: manually maintained list vs. deploy Action script generation.
- CSS transition durations and easing curves: within the ~150ms / ease-in-out range.
- Settings modal logical grouping taxonomy: Claude proposes groups based on existing settings fields.

## Deferred Ideas

- README.md shipped to Pages (excluded by standard exclusion list; future task if public landing page wanted)
- Complex chart animations (full sequence: bars growing, points flying in) — v2
- Offline fallback page (custom offline.html) — not needed for single-page pre-cached app
- Maskable PWA icon variant for Android adaptive icons — deferred; standard 192/512 PNGs satisfy install requirement
