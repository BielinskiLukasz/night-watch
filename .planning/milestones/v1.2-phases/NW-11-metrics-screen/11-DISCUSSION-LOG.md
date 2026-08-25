# Phase 11: Metrics Screen — Discussion Log

**Session:** 2026-07-20
**Outcome:** All 4 gray areas resolved → CONTEXT.md written

---

## Areas Discussed

### 1. Screen Layout

| Question | Options | Selected |
|---|---|---|
| How should the 9 metrics per day be organized? | Three named sections; **Single wide scrollable table**; Cards per day | Single wide scrollable table |
| Row ordering? | **Most recent first**; Oldest first | Most recent first |
| No-nap days — show or hide? | **Yes, show with — in those cells**; You decide | Show row with — |
| Rejected days in the table? | **Show them, visually marked**; Hide entirely | Show visually marked |
| Column headers: full or abbreviated? | **Abbreviated**; Full names | Abbreviated |
| Cold-start gate? | **No gate — show from day 1**; Gate like other screens | No gate |
| Include raw event times? | Yes; No | **Include all four: Wake, Bedtime, Nap Start, Nap End** |
| Column ordering (times vs. metrics)? | **Times first, then metrics**; Metrics first; Interleaved | Times first, then metrics |

**Decided column order:** Date | Wake | Bedtime | Nap Start | Nap End | Sleep | Nap | Combined | Day Length | Act→Nap | Nap→Bed | Activity | AAS | SAA

---

### 2. Stage Filter Control

| Question | Options | Selected |
|---|---|---|
| How to implement MET-06 stage filter? | **Stage chip badge (same as Charts/Accuracy)**; On-screen toggle button; You decide | Stage chip badge |
| When stage active, aggregate scope? | **Scoped to stage data**; Always all-data | Scoped to stage data |

---

### 3. Aggregates Placement

| Question | Options | Selected |
|---|---|---|
| Where should aggregates appear? | Pinned above rows; **Separate section above table**; Below rows | Separate summary section above table |
| Summary structure? | **Mini-table: rows = Avg/Min/Max, cols = metrics**; Stat cards per metric | Mini-table |
| Rejected days in aggregates? | **Exclude rejected from aggregates**; Include them | Exclude |
| Min/Max date display? | **In same cell (value line 1, date smaller below)**; You decide | Same cell, two lines |
| No-nap days in nap aggregates? | **Exclude no-nap days from nap-column aggregates**; Show — | Exclude |
| Scroll container? | **Same scroll container**; Independent containers | Same container |
| Sticky first column? | **Yes**; No; You decide | Yes |
| Sticky column headers? | **Yes**; No; You decide | Yes |
| Summary shares sticky behavior? | **Both summary and per-day share same sticky**; You decide | Same sticky behavior |

---

### 4. Duration Display Format

| Question | Options | Selected |
|---|---|---|
| Duration format? | **'Xh Ym' (e.g. 7h 30m)**; Decimal hours; mm only | Xh Ym |
| Ratio format? | **2 decimal places**; 1 decimal; Percentage | 2 decimal places |
| Missing prev day (SAA first day)? | **Show — for first day**; Show 0; You decide | Show — |
| Average duration format? | **'Xh Ym' for avg too**; Decimal hours | Xh Ym |
