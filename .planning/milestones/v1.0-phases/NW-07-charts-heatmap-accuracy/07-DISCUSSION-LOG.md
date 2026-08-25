# Phase 7: Charts, Heatmap & Accuracy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 7-Charts, Heatmap & Accuracy
**Areas discussed:** Navigation upgrade, Charts screen layout, Accuracy calculation method, Stage scoping for analytics

---

## Navigation Upgrade

| Option | Description | Selected |
|--------|-------------|----------|
| Header tab bar (4 tabs) | Extend existing `<nav class="tabNav">` to 4 tabs. Minimal change, same pattern as 2-tab nav. | |
| Bottom navigation bar | Move nav to a fixed bottom bar with icons + labels. Standard mobile pattern, larger tap targets. | ✓ |
| You decide | Claude picks the cleanest option. | |

**User's choice:** Bottom navigation bar

---

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + label | Each tab has a small SVG icon above the label. | ✓ |
| Text only | Just the tab label, no icons. Simpler to implement. | |

**User's choice:** Icon + label

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remove header tabs entirely | Bottom nav replaces header tab bar. Header = subject name + Settings gear only. | ✓ |
| Keep header tabs for Today/History, add bottom nav for Charts/Accuracy | Split nav; unusual pattern. | |

**User's choice:** Remove header tabs entirely

---

| Option | Description | Selected |
|--------|-------------|----------|
| Today \| History \| Charts \| Accuracy | Workflow order matching user journey left-to-right. | ✓ |
| Today \| Charts \| Accuracy \| History | Analytics grouped, History moved to end. | |
| You decide | Claude picks order. | |

**User's choice:** Today | History | Charts | Accuracy

---

## Charts Screen Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single scrollable page | All 5 visualizations stacked vertically. Consistent, simple. | ✓ |
| Sub-tabs within Charts | Inner tab strip (e.g., Trends / Heatmap / Patterns). Adds second nav layer. | |

**User's choice:** Single scrollable page

---

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub contribution graph style | Grid of day squares, columns = weeks, rows = days-of-week. SVG `<rect>` grid. | ✓ |
| Monthly calendar grid | Traditional calendar, one month at a time with prev/next controls. | |
| You decide | Claude picks heatmap style. | |

**User's choice:** GitHub contribution graph style

---

| Option | Description | Selected |
|--------|-------------|----------|
| Nap frequency bar + average times | Stats card: % days with nap, avg start, avg length. | ✓ |
| Day-of-week heatmap | 7-column grid showing nap frequency by day-of-week. | |
| You decide | Claude picks nap visualization. | |

**User's choice:** Nap frequency bar + average times (stats card)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-drawn SVG elements | `<polyline>`, `<circle>`, `<rect>` — no library. Zero-npm-dep constraint. | ✓ |
| Canvas API | Imperative pixel math. More control for large datasets, less accessible. | |
| You decide | Claude picks rendering approach. | |

**User's choice:** Hand-drawn SVG elements

---

## Accuracy Calculation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Retroactive backtesting | For each historical day, compute forecast using prior data, compare to actual. Zero new storage. Instant results. | ✓ |
| Forward-only prediction logging | Store predictions going forward; accuracy builds over weeks. Empty on first use. | |

**User's choice:** Retroactive backtesting

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full available history | Compute across all historical days. Most complete picture. | ✓ |
| Rolling window (windowDays) | Only last N days — more relevant to current model performance. | |

**User's choice:** Full available history

---

| Option | Description | Selected |
|--------|-------------|----------|
| Three metrics only + sample count | Simple, matches ROADMAP success criteria exactly. | |
| Per-event-type breakdown | 4 rows × 3 columns grid (wake / bedtime / nap start / nap end × three metrics). | ✓ |

**User's choice:** Per-event-type breakdown (4×3 grid)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip nap metrics for no-nap days | Exclude days with no nap logged; report "based on N nap days". | ✓ |
| Count no-nap as a miss | Penalize predictions on days when no nap occurred. | |

**User's choice:** Skip nap metrics for no-nap days

---

## Stage Scoping for Analytics

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — filter to active stage | Charts and Accuracy scope to active stage using `filterDayRecordsByStage()`. | ✓ |
| No — always show all data | Analytics always show full history; stage filter only affects Today. | |
| Show both — full + stage highlighted | All data with active stage's range visually highlighted. | |

**User's choice:** Yes — filter data to the active stage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Shared app-level stage selector | Move selector to header; affects all screens simultaneously. | |
| Per-screen stage selector | Each screen has its own selector. | |
| Keep selector on Today; Charts/Accuracy read activeStageId silently | No new UI on Charts/Accuracy; they show "Viewing: [Stage Name]" indicator. | |
| You decide (best UX) | User deferred to Claude. | ✓ |

**User's choice:** Deferred to Claude  
**Claude's decision:** Keep selector on Today; Charts and Accuracy read `activeStageId` from settings and display a "Viewing: [Stage Name]" indicator when active. Minimum UI, maximum consistency.

---

## Claude's Discretion

- SVG icon paths for bottom nav (moon for Today, list for History, bar chart for Charts, target for Accuracy)
- Heatmap color scale values (desaturated → `#4f46e5` accent ramp)
- Chart axis label formatting and tick count
- Sleep-length chart Y-axis auto-scaling (data range + 10% padding)
- Stage boundary vertical dashed lines on sleep-length chart when "All data" active
- Time-band scatter plot layout (Y = hour 0-24h, X = date, error bars for predicted band)
- Activity correlation axis scaling and minimum-data gate
- Cold-start card copy and styling for Charts/Accuracy screens
- "Viewing: [Stage Name]" indicator styling (muted chip/badge)
- Bottom nav height and `<main>` bottom padding to prevent content hiding

## Deferred Ideas

- Per-stage accuracy comparison side-by-side (Stage 1 vs Stage 2 accuracy)
- Animated chart transitions (Phase 8 polish or v2)
- CSV export from Charts/Accuracy screens (not in DATA-01..03 scope)
- Zoom/pan on charts (v2)
- Day-of-week heatmap for nap frequency (user chose stats card instead)
