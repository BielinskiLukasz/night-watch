# Prediction Features Reference

From **6 direct inputs per day** — 4 timestamps and 2 activity durations —
plus derived metrics and rolling aggregates.

## Direct Inputs

### Timestamps

| Symbol | Event |
|---|---|
| W | Wake up |
| NS | Nap start |
| NE | Nap end |
| B | Bedtime (night sleep start) |

### Recorded Activity Durations

| Symbol | Meaning |
|---|---|
| MA | Morning activity duration (time awake before nap) |
| AA | Afternoon activity duration (time awake after nap) |

> MA and NS−W should match. When they diverge (e.g. baby was awake before you logged NS),
> the recorded MA is the ground truth to use in rolling averages.

---

## Derivable Metrics

### Durations

| Metric | Formula |
|---|---|
| Morning activity duration (MA) | NS − W (or recorded directly) |
| Nap duration | NE − NS |
| Afternoon activity duration (AA) | B − NE (or recorded directly) |
| Night sleep duration | W_next − B |
| Total sleep | nap duration + night sleep duration |
| Total wake time | MA + AA |

### Ratios

| Metric | Formula |
|---|---|
| Activity-to-sleep factor | total wake / total sleep |
| Nap fraction | nap duration / total sleep |
| Morning/afternoon split | MA / AA |
| Sleep debt proxy | target total sleep − actual total sleep |

### Rolling Aggregates (7-day, 14-day windows)

- Rolling mean and std dev of every duration/ratio above
- Day-of-week averages (circadian rhythm fingerprint)

---

## Predictors by Event

### Wake Up

| Predictor | Rationale |
|---|---|
| Previous night's bedtime (B) | later B → later W |
| Previous night sleep duration | shorter duration → earlier W |
| Rolling avg wake time | strong circadian anchor |
| Rolling avg night sleep duration | baseline sleep need |
| Previous nap duration | long nap → shorter night → earlier W |
| Sleep debt proxy (rolling) | accumulated deficit pulls W earlier |

### Nap Start

| Predictor | Rationale |
|---|---|
| Today's wake time (W) | most direct — NS ≈ W + MA |
| Today's morning activity duration (MA) | direct input; replaces the rolling avg as anchor when available |
| Rolling avg MA | how long they stay awake before napping |
| Std dev of MA | sets the uncertainty band |
| Previous nap start time | circadian habit |
| Yesterday's total sleep | more sleep → longer MA |
| Day-of-week average | weekend/weekday pattern |

### Nap End

| Predictor | Rationale |
|---|---|
| Today's nap start (NS) | nap end = NS + nap duration |
| Rolling avg nap duration | core predictor |
| Std dev of nap duration | sets uncertainty band |
| Today's MA | longer awake before → shorter nap |
| Sleep debt proxy | higher debt → longer nap |
| Previous nap duration | autocorrelation |

### Bedtime

| Predictor | Rationale |
|---|---|
| Today's nap end (NE) | most direct — B ≈ NE + AA |
| Today's afternoon activity duration (AA) | direct input; anchors same-day prediction |
| Rolling avg AA | how long they stay up after nap |
| Std dev of AA | sets uncertainty band |
| Today's nap duration | shorter nap → earlier B |
| Total sleep so far today (nap) | less sleep → earlier B |
| Rolling avg bedtime | circadian anchor |
| Previous bedtime | autocorrelation |
| Today's MA | long MA + long AA → more accumulated awake pressure |

---

## Feature Priority Order

If ranking by predictive leverage across all 4 events:

1. **Same-day anchor** — the preceding event (B→W, W→NS, NS→NE, NE→B)
2. **Rolling avg of the corresponding interval** (7-day window)
3. **Std dev of that interval** — determines confidence band width
4. **Previous day's equivalent event time** — autocorrelation
5. **Sleep debt proxy** — cross-event pressure signal
6. **Day-of-week** — circadian rhythm modifier

> The std dev of each interval is the key input for the **probability-band fallback**:
> when σ is high, switch from a point prediction to a time window.
