Task:
You are an assistant helping me formalize a scoring system for evaluating the accuracy of daily sleep‑related event forecasts (wake, nap start, nap end, bedtime). The goal is to compute a numerical accuracy score for each event and for the entire day.

Events to evaluate Evaluate accuracy for the following event types:

Wake
Nap start
Nap end
Bedtime without nap
Bedtime with nap
Each event has:

a forecast time (the predicted time),
an actual time (the time the user recorded),
a user‑defined tolerance window in minutes (e.g., 25 minutes).
Scoring rules

Perfect match If the event is recorded exactly at the forecast time, the score is:
[ 100% ]

Linear scoring inside the tolerance window Let:
(F) = forecast time
(A) = actual event time
(W) = tolerance window in minutes (e.g., 25)
Define the distance:

[ D = |A - F| \text{ in minutes} ]

If (D \le W), the score decreases linearly from 100% at (D = 0) to 50% at (D = W):

[ \text{Score} = 100% - \left( \frac{50}{W} \cdot D \right) ]

This means:

At (D = 0) → 100%
At (D = W) → 50%
Values between are interpolated linearly.
Linear scoring outside the tolerance window If (W < D \le 2W), the score continues decreasing linearly from 50% down to 0%:
[ \text{Score} = 50% - \left( \frac{50}{W} \cdot (D - W) \right) ]

This means:

At (D = W) → 50%
At (D = 2W) → 0%
Values between are interpolated linearly.
Outside the full window If:
[ D > 2W ]

then:

[ \text{Score} = 0% ]

Example (forecast = 14:50, window = 25 min)

Distance from forecast → score:

14:50 → 100%
14:45 → 90%
14:40 → 80%
14:35 → 70%
14:30 → 60%
14:25 → 50%
14:20 → 40%
14:15 → 30%
14:10 → 20%
14:05 → 10%
14:00 → 0%
15:15 → 50%
15:20 → 40%
15:25 → 30%
15:30 → 20%
15:35 → 10%
15:40 → 0%
All times beyond ±50 minutes from the forecast receive 0%.

Daily score For each day:

Compute the score for every event that has both a forecast and an actual time.
The daily score is the average of all event scores.
Store:

individual event scores,
the daily average score.
Your task Rewrite, refine, and optimize this scoring system.
Make it:

mathematically precise,
unambiguous,
easy to implement in code,
robust for real‑world noisy data,
and consistent across all event types.
You may propose improvements, but keep the core logic intact.