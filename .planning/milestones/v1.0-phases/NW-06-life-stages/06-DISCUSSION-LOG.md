# Phase 6: Life Stages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 06-Life Stages
**Areas discussed:** Stage data model, Stage boundary rules, Stage selector UX on Today, Stage CRUD UI details

---

## Stage data model

| Option | Description | Selected |
|--------|-------------|----------|
| `db.settings.stages` array | Stored inside db.settings alongside rejectedDays. Works with existing store APIs, no migration step. | ✓ |
| `db.stages` top-level field | Separate from settings like activityLog. Conceptually cleaner but requires migration injection. | |

**User's choice:** `db.settings.stages` (recommended)
**Notes:** Consistency with the rejectedDays pattern was the deciding factor.

---

| Option | Description | Selected |
|--------|-------------|----------|
| `db.settings.activeStageId` | Persisted in settings; survives reload; cleared to null on stage delete. | ✓ |
| In-memory only | Resets on every reload; user must re-select each session. | |

**User's choice:** `db.settings.activeStageId` (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| `{ id, name, startDate, endDate }` | Minimal shape, endDate null for open-ended. | ✓ |
| `{ id, name, startDate, endDate, notes }` | Adds optional free-text memo. Notes not used by forecast logic. | |

**User's choice:** `{ id, name, startDate, endDate }` (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| `Date.now().toString()` | Consistent with id.js pattern already in codebase. | ✓ |
| Short UUID/nanoid | More collision-proof but adds a new pattern. | |

**User's choice:** `Date.now().toString()` (recommended)

---

## Stage boundary rules

| Option | Description | Selected |
|--------|-------------|----------|
| `endDate: null` means 'through today' | Natural open-ended stage; most recent active stage needs no end date. | ✓ |
| All stages require a defined end date | Simpler filter; user sets endDate to today manually. More friction. | |

**User's choice:** `endDate: null` = open-ended (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Last-added wins, no validation | Simplest; user responsible for ranges. | |
| Show warning, allow saving anyway | Overlap detection shows warning but doesn't block. | ✓ |
| Block save on overlap | Safest but most friction. | |

**User's choice:** Show warning, allow saving (not the recommended option — user chose more friction than the default but without a hard block)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Import etap → auto-create stages | CSV parser reads etap column, groups consecutive runs into stage objects. | ✓ |
| Ignore etap on import | User creates stages manually after import. | |
| Store etap per-day, no auto-creation | Store as a per-day field but no stage synthesis. | |

**User's choice:** Auto-create stages from etap column (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Each consecutive run = separate stage | Three runs of same name → three stage objects. | ✓ |
| Merge non-consecutive runs of same name | All rows with same etap value → one stage spanning full range. | |

**User's choice:** Each consecutive run becomes its own stage (recommended)

---

## Stage selector UX on Today

| Option | Description | Selected |
|--------|-------------|----------|
| Selector hidden when no stages | Today looks like Phase 5; selector appears after first stage created. | ✓ |
| Selector shows 'All data' only (disabled) | Always visible; communicates the feature exists. | |

**User's choice:** Hidden when no stages (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Last persisted activeStageId | Restores selection from settings; fallback to null if deleted. | ✓ |
| Always default to most recent stage | Ignores persistence; always loads newest stage. | |
| Always default to 'All data' | No persistence; user re-selects every session. | |

**User's choice:** Last persisted activeStageId (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cold-start message | Treat < min_days in stage as cold-start; show gate message. | |
| Relax min_days gate for stage scope | Show noisy predictions even for thin stages. | |
| Fall back to 'All data' with a note | Use all data for forecast; show note near selector. | ✓ |

**User's choice:** Fall back to 'All data' with a note (not the recommended option — user prefers showing useful predictions over an empty cold-start screen, but wants transparency via the note)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show note below selector | 'Not enough data in this stage — showing all data.' | ✓ |
| Silent fallback | No indicator; forecasts just show. | |

**User's choice:** Show note (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| "All data" | Simple, matches roadmap wording. | ✓ |
| "All stages" | Emphasizes stages framework. | |
| "No filter" | Technical framing. | |

**User's choice:** "All data" (recommended)

---

## Stage CRUD UI details

| Option | Description | Selected |
|--------|-------------|----------|
| Settings modal only | Stage CRUD entirely in Settings; no new screen or tab. | ✓ |
| Settings + read-only list in History | CRUD in Settings; stage list also visible in History header. | |
| Dedicated 'Stages' tab in nav | Full CRUD on own screen; adds nav complexity pre-Phase 7. | |

**User's choice:** Settings modal only (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline form row in stage list | Inline add/edit directly in the list; no extra dialog. | ✓ |
| Nested dialog (modal-on-modal) | Opens a second dialog on top of Settings; has known stacking quirks. | |

**User's choice:** Inline form row (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reset activeStageId to null silently | Falls back to 'All data'; no extra confirm. | ✓ |
| Extra prompt for currently selected stage | Second confirmation for the 'currently selected' case. | |

**User's choice:** Silent reset to null (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name \| Start \| End \| Actions | Four columns; 'ongoing' in End when endDate is null. | ✓ |
| Name \| Date range \| Actions | Three columns; combined Start–End cell. | |
| You decide | Claude chooses best layout. | |

**User's choice:** Name \| Start \| End \| Actions (recommended)

---

## Claude's Discretion

- Exact overlap warning wording and button labels
- Inline form styling/layout within the Settings modal fieldset
- Delete confirmation copy for stages
- "Ongoing" vs. "—" vs. "present" for null endDate cell
- Stage selector placement on Today screen (relative to quick-log / hero card)
- "Not enough data" note styling

## Deferred Ideas

- Per-stage forecast settings (windowDays, statBlend per stage) — global settings only in Phase 6
- Stage boundary markers on Charts screen — Phase 7
- Auto-detected stages via change-point detection — v2 / PRED2-01
- Stage-scoped accuracy metrics — Phase 7
- Stages CSV export — not needed; stages included in JSON export
