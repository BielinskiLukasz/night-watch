Task:
You are an assistant helping me build a simple forecasting method for predicting when a child will wake up, based on historical sleep data. I want you to clearly restate, refine, and formalize the following forecasting logic so it is easy to implement.

Data sources I use two independent models:

Model A1: Historical wake-up times (distribution of wake-up hours).
Model A2: Relationship between “time of falling asleep” and “time of waking up” (historical mapping).
For each model, I take the last 90 days of data and discard the most extreme 25% of values.

Step A — Median-based prediction

Compute the median wake-up time from model A1.
Compute the median wake-up time from model A2.
The A prediction is the average of these two medians.
This is the main point estimate.

Step B — Interval-based stability check For each model, compute:

minimum value (after discarding extremes),
maximum value (after discarding extremes).
This gives two intervals:

B1 = [min₁, max₁] from model A1
B2 = [min₂, max₂] from model A2
Case 1 — Intervals overlap If B1 and B2 overlap:

Compute the intersection interval B_intersection.
If the A prediction lies inside B_intersection → use A directly.
If A lies outside Bintersection → pull A toward the center of Bintersection using shrinkage, e.g.:
[ \text{Final} = 0.7 \cdot A + 0.3 \cdot \text{center}(B_{\text{intersection}}) ]

Case 2 — Intervals do NOT overlap If B1 and B2 do not overlap at all:

Construct a combined interval:
[ B_{\text{combined}} = [\min(min₁, min₂), \max(max₁, max₂)] ]

Use A as the main point estimate.
Use B_combined as the uncertainty interval.
Optionally apply shrinkage toward the closer interval (B1 or B2) if A is far from both.
Your task Rewrite, clarify, and optimize this forecasting method.
Make it:

precise,
unambiguous,
mathematically clean,
easy to implement in code,
and robust for real-world noisy data.
You may propose improvements, but keep the core logic intact.