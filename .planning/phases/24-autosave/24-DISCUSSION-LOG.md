# Phase 24: Autosave - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 24-autosave
**Areas discussed:** Filename & overwrite, Failure handling, Settings UI states, Save feedback

---

## Filename & Overwrite

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed filename | Always overwrite one file, e.g. nightwatch-export.json | |
| Timestamped files | New file per save | |
| You decide | Claude picks based on codebase conventions | ✓ (initial) |

**Follow-up:** After discovering the existing manual-export filename convention (`nightwatch-YYYY-MM-DD.json`, D5-15 in `js/lib/import-export.js`), asked a refined question:

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse date convention | Same nightwatch-YYYY-MM-DD.json as manual export; same-day saves overwrite, new day = new file | ✓ |
| One fixed name, always overwritten | e.g. nightwatch-autosave.json, distinct from manual exports | |

**Follow-up 2 — retention:**

| Option | Description | Selected |
|--------|-------------|----------|
| No cleanup | Leave all daily files in place indefinitely | ✓ |
| Auto-delete files older than N days | App manages its own retention window | |

**User's choice:** Reuse the manual-export date convention; no automatic cleanup.
**Notes:** User wants autosave to feel like "the manual export just happens automatically," not a parallel differently-named backup mechanism.

---

## Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show inline error, keep handle | Keep retrying, surface error text | ✓ |
| Clear handle, force re-pick | Any failure resets to unset state | |

**Follow-up — `queryPermission()` returns `'denied'`:**

| Option | Description | Selected |
|--------|-------------|----------|
| Treat like unset, offer re-pick | Show "Choose folder" state + revoked note | ✓ |
| Show error, no automatic UI reset | Keep old folder name with error badge until manual Remove | |

**User's choice:** Keep handle and retry on transient write failures; treat explicit permission denial as unset with a re-pick prompt.
**Notes:** None beyond the selections.

---

## Settings UI States

| Option | Description | Selected |
|--------|-------------|----------|
| Folder name only | Display handle.name, no extra copy | ✓ |
| Folder name + generic hint | Add static "(location depends on...)" text | |

**Follow-up — fieldset placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Backup' fieldset | Fourth fieldset alongside Profile/Time & Day/Forecast | ✓ |
| Inside existing Profile fieldset | Add row to Profile section | |

**Follow-up — fallback Export button:**

| Option | Description | Selected |
|--------|-------------|----------|
| Separate button, same handler | New button in Backup fieldset wired to existing downloadJSON | ✓ |
| Text pointer to History screen | No new button, just explanatory copy | |

**Follow-up — discovery/onboarding:**

| Option | Description | Selected |
|--------|-------------|----------|
| Passive — Settings only | No nudge anywhere else | |
| One-time first-launch prompt | Dismissible banner encouraging setup | ✓ |

**Follow-up — banner placement/tracking:**

| Option | Description | Selected |
|--------|-------------|----------|
| Today screen banner + localStorage flag | Dismissible banner, tracked via localStorage boolean | ✓ |
| Modal dialog on first launch | Blocking modal | |

**User's choice:** Folder name only; new Backup fieldset; separate fallback Export button reusing the existing handler; one-time dismissible Today-screen banner tracked via localStorage.
**Notes:** The first-launch banner was flagged as extending beyond the ROADMAP's literal "Settings UI row" wording before the user confirmed they wanted it included — see CONTEXT.md D-10 for the scope note. User's rationale: a Settings-only feature doesn't close the data-loss risk if nobody discovers it.

---

## Save Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle status in Settings row | "Last saved: HH:MM" text | ✓ |
| Fully silent | No feedback anywhere | |
| Toast/snackbar on save | App-wide transient notification | |

**Follow-up — persistence across reloads:**

| Option | Description | Selected |
|--------|-------------|----------|
| Reset on launch | In-memory only, resets each session | ✓ |
| Persist last-saved time | Stored in IndexedDB, survives reloads | |

**Follow-up — error vs. success display:**

| Option | Description | Selected |
|--------|-------------|----------|
| Error replaces it | Single status line reflects most recent outcome | ✓ |
| Show both | Two lines, last-saved and last-failure separately | |

**User's choice:** Subtle "Last saved: HH:MM" status line, reset each session, replaced by error text on failure.
**Notes:** None beyond the selections.

---

## Claude's Discretion

- Exact copy for unsupported-browser note, permission-revoked note, first-launch banner text, and button labels.
- Whether `autosave.js` computes the shared date-slice filename itself or receives it from the caller.
- Internal structure of the minimal inline IndexedDB wrapper.

## Deferred Ideas

None — all discussed ideas were incorporated as in-phase decisions.
