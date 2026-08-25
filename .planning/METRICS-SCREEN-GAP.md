# Metrics Screen Gap Analysis

## Already Implemented

`metrics.js` computes all of these; `metrics-screen.js` renders them in the 14-column table.

| PREDICTION-FEATURES metric | Existing column | Code key |
|---|---|---|
| Morning activity (MA) | →Nap | `activityBeforeNap` |
| Afternoon activity (AA) | Nap→ | `activityAfterNap` |
| Nap duration | Nap | `napDuration` |
| Night sleep duration | Sleep | `sleepDuration` |
| Total sleep | Comb | `combinedSleepNap` |
| Total wake time | Act | `totalActivity` |
| Day length | Day Len | `dayLength` |
| Activity-to-sleep factor | AAS | `activityAfterSleepFactor` |
| Sleep-after-activity factor | SAA | `sleepAfterActivityFactor` |

Avg / Min / Max aggregate rows are also already rendered.

---

## Missing: Two Ratio Columns (~1 hour total)

| Metric | Formula | Where |
|---|---|---|
| Nap fraction | `napDuration / combinedSleepNap` | new helper in `metrics.js` + new entry in `COLUMNS` in `metrics-screen.js` |
| Morning/afternoon split | `activityBeforeNap / activityAfterNap` | same pattern |

Each follows the exact same pattern as `activityAfterSleepFactor` — add a pure helper to `metrics.js`, push a row into `aggregateMetrics`, and add a column definition to `COLUMNS`.

---

## Missing: Rolling Aggregates (3–4 hours, separate phase)

`aggregateMetrics` currently computes a single all-time avg/min/max.
7-day and 14-day rolling windows do not exist yet.

Requires:
- New windowed aggregation logic in `metrics.js` (or a new `metrics-rolling.js`)
- UI decision: separate section below the table, or extra pinned rows
- Likely new CSS for the rolling summary block

Recommendation: plan as a dedicated phase, not an incremental add to the existing table.
