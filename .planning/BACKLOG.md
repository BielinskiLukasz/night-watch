# Backlog: Nightwatch

Ideas and scope items captured outside the active roadmap. Anything here is *not* in v1 — it has either been deferred by explicit decision, surfaced during UAT, or earmarked for a later milestone. Items graduate to a `ROADMAP.md` phase when picked up (`/gsd-review-backlog` to promote, `/gsd-phase add` to materialize).

Last updated: 2026-05-28

---

## UX-polish bundle (captured during Phase 2 UAT, 2026-05-28)

These three items are complementary friction-reduction wins for one-handed, in-the-dark logging. They should probably ship together in a dedicated UX-polish phase between Phases 4 and 8, or folded into Phase 8 (PWA & Platform Hardening) since theming and mobile-first picker UX are presentation-layer work.

### B-01 · Per-event-type default times in manual-entry

**Source:** memory `project_idea_event_type_default_times.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** post-Phase 4 (history edit/delete lands first) — or as a Phase 8 sub-plan

**What:** When the manual-entry pop-up opens for a specific event type, prefill hour + minute with a sensible default (e.g., wake → 07:00, bedtime → 19:00, nap-start → 13:00). User can still override before saving. Defaults are configurable via a new "Default times" fieldset in the Settings modal.

**Why:** A sleep tracker lives or dies by per-event logging speed. Today the manual-entry pop-up opens with the current time, so the parent always retypes the actual sleep/wake time even though events cluster around predictable hours.

**Open questions when this gets planned:**

- All event types or only some (wake / bedtime / nap-start / nap-end)?
- Subject-aware (Phase 2 is single-subject; CFG2-01 multi-profile is v2)?
- Snap to 5-min increments (already a project invariant — should be free).
- Should defaults be **derived from history** (e.g., median wake time over the last 14 days) instead of a hardcoded config value? That overlaps directly with Phase 3 — possibly the forecaster IS the default source, not a separate config field.

**Implementation notes:**

- Data shape: `DEFAULT_SETTINGS` extension + `RULES` entries (integer 0-23 hour, integer 0-59 minute with 5-min step). `createSettingsStore` handles persistence with no code changes.
- UI: one fieldset addition to `js/ui/settings-modal.js` + a read inside `openManualEntry()` that prefills `hour`/`minute` before `applyTimeFormat()` runs.

---

### B-02 · Friendly hour picker (clock-face / wheel / tap-grid)

**Source:** memory `project_idea_friendly_hour_picker.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** UX-polish milestone, paired with B-01

**What:** Replace the manual-entry HH/MM number inputs (and the 12h AM/PM select from Plan 02-06) with a visual picker — analog clock-face, wheel/scroll, or tap-grid of common times. One tap per axis, works one-handed in the dark.

**Why:** Number inputs open the numeric keyboard but still require focus → tap → tab. A clock-face / wheel / grid is one tap per axis. Same "minimize friction" rationale as B-01 — they're complementary.

**Open questions when this gets planned:**

- Analog clock-face vs. wheel/scroll vs. tap-grid — which wins one-handed in the dark?
- Should the picker show B-01's smart default preselected, or always start at current time?
- A11y: a clock-face is hard for screen readers. Keep a number-input fallback behind a feature flag or "advanced" toggle.
- Mobile-first vs. desktop parity — the spreadsheet workflow this replaces was desktop; the PWA install target is mobile.

**Constraints to respect:**

- 5-min rounding rule (CLAUDE.md) — clock-face snaps naturally.
- No build step, no frameworks — vanilla CSS + JS. CSS `conic-gradient` clock with `<button>` children per hour is feasible; same for a 12-tap minute grid.
- Must stay testable in Playwright — current spec hits `input[name="hour"]` etc.; a picker rewrite needs `data-testid` selectors or equivalent test surface.
- Internal storage stays canonical 24h ISO (D2-20 invariant).
- `timeFormat` 12h vs 24h still toggles the picker surface, but the picker is now clock/wheel, not HH/AMPM number inputs.

---

### B-03 · Dark mode with manual + hour-based auto-switch

**Source:** memory `project_idea_dark_mode.md` (Phase 2 UAT)
**Status:** captured · not scheduled
**Earliest sensible slot:** **Phase 8 (PWA & Platform Hardening)** — theming is naturally co-located with PWA polish per CLAUDE.md's deferral note.

**What:**
1. Dark theme.
2. Manual toggle to switch.
3. Auto-switch based on hour-of-day (likely keyed off `cutoverHour` or a separate "night begins at" setting), or `prefers-color-scheme`.
4. A Settings field to pick the default mode: `light` / `dark` / `auto`.

**Why:** A parent logging a 3am wake with a phone glowing 100% white in their face is a UX failure for a sleep tracker. Dark mode + auto-switch closes the gap.

**Open questions when this gets planned:**

- Does "auto" mean OS preference (`prefers-color-scheme`) or hour-based (e.g., dark 18:00-06:00)? User mentioned hour-based — that's the unusual but more compelling fit for a sleep tracker (the OS doesn't know it's bedtime; `cutoverHour` does).
- If hour-based: derive from `cutoverHour` or expose a separate "night begins at" setting? Probably reuse `cutoverHour` — same household-night concept.
- Manual toggle in the header (always-reachable) or buried in Settings? Header is more discoverable but adds visual noise; Settings is cleaner. Probably Settings for v1, header chip in a later polish pass.

**Implementation notes:**

- CSS custom properties (`--bg`, `--fg`, `--accent`, etc.) on `:root` + a `data-theme="dark"` attribute on `<html>` to switch. Check `../mindful-breathing` first — it may already do this.
- Settings store gets a `theme: 'light' | 'dark' | 'auto'` field. Fits the existing CFG-* pattern; slots beside `timeFormat` in Time & Day fieldset, or in a new Appearance fieldset.
- Auto-switch needs a clock tick (or `prefers-color-scheme` media query listener) + recompute on `settings.subscribe`.
- 5-min rounding and storage-as-truth are theming-orthogonal — no data model risk.

---

## v2 scope deferred from v1 (surfaced as warnings 2026-05-28)

These REQ-IDs live in `REQUIREMENTS.md` body text but are intentionally absent from the v1 traceability table. They are v2 (next milestone) scope per CLAUDE.md's "Single subject, single nap/day in v1" rule and Phase 2's D2-01 deferral decision.

**Action:** surface during next-milestone planning (`/gsd-new-milestone v2.0`). Each becomes a v2 phase requirement.

| REQ-ID | Topic | Why deferred from v1 |
|---|---|---|
| `LOG2-01` | Multi-nap per day | CLAUDE.md v1 constraint: single nap/day. Phase 1 LOG-09 dedupes overflow naps with `extra:true` rather than supporting them as first-class entries. |
| `LOG2-02` | (See REQUIREMENTS.md body) | v2 logging extension. |
| `CFG2-01` | Multi-profile / multi-subject | CLAUDE.md v1 constraint: single subject. Phase 2 data shape preserves clean v2 migration path. |
| `PRED2-01` | (See REQUIREMENTS.md body) | v2 prediction extension — likely lands after the Phase 3 baseline forecaster ships. |
| `PLAT2-01` | (See REQUIREMENTS.md body) | v2 platform/PWA capability. |
| `PLAT2-02` | (See REQUIREMENTS.md body) | v2 platform/PWA capability. |

When v2 milestone opens, lift the bodies of these REQ-IDs out of `REQUIREMENTS.md` into the v2 traceability table.

---

## How to use this file

- **Adding an item:** drop a new `### B-NN` block with Source / Status / Earliest slot / What / Why / Open questions / Implementation notes. Keep IDs monotonic (`B-01`, `B-02`, ...).
- **Promoting an item:** `/gsd-review-backlog` (interactive) — moves a chosen item into the active milestone roadmap. Or manually run `/gsd-phase add` and reference the backlog ID in the phase description.
- **Removing an item:** delete the block or move it under a `## Rejected` heading with a one-line rationale (decisions cost; keep the rationale).
- **Memory ↔ backlog:** memory captures "this idea exists and here's the context"; this file is the project-level decision queue. Memory is the source for cross-session continuity; this file is the source for milestone planning. Update both when an item lands.

## Related

- `ROADMAP.md` — active milestone phases
- `REQUIREMENTS.md` — v1 traceability table
- `PROJECT.md` — core constraints (single subject v1, no build step, no frameworks)
- `CLAUDE.md` — v1/v2 split rules

