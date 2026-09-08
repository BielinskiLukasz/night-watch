---
phase: 260908-oir
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - js/lib/metrics.js
  - tests/unit/metrics.test.js
autonomous: true
requirements:
  - MET-13
  - MET-14

estimate:
  tokens: 28000
  raw_tokens: 20000
  tasks: 2
  confidence: high

must_haves:
  truths:
    - sleepDebtProxy computes sleep duration as prevDay.bedtime → day.wake (overnight cross-day pairing)
    - sleepDebtProxy result matches the Comb column arithmetic used by aggregateMetrics
    - All unit tests for sleepDebtProxy pass with the corrected pairing logic
    - node --test tests/unit/metrics.test.js exits 0
  artifacts:
    - js/lib/metrics.js (sleepDebtProxy rewritten to use overnight pairing)
    - tests/unit/metrics.test.js (sleepDebtProxy section updated for new pairing semantics)
  key_links:
    - sleepDebtProxy must use the same overnight math path as aggregateMetrics lines 264–267
---

<objective>
Fix sleepDebtProxy in js/lib/metrics.js to use overnight cross-day pairing
(prevDay.bedtime → day.wake) instead of same-day combinedSleepNap, matching
the Comb column displayed in the Metrics table.

Purpose: Eliminates the displayed discrepancy between the S.Debt(7d) metric and
the per-row Comb column totals visible in aggregateMetrics output.

Output: Corrected sleepDebtProxy implementation + updated unit tests.
</objective>

<execution_context>
@C:/my-code/vibe-coding/night-watch/.claude/gsd-core/workflows/execute-plan.md
@C:/my-code/vibe-coding/night-watch/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@C:/my-code/vibe-coding/night-watch/.planning/PROJECT.md
@C:/my-code/vibe-coding/night-watch/.planning/ROADMAP.md
@C:/my-code/vibe-coding/night-watch/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite sleepDebtProxy to use overnight cross-day pairing</name>
  <files>js/lib/metrics.js</files>
  <action>
Replace the body of `sleepDebtProxy` (currently around line 553) with the overnight-pairing
implementation. The existing signature remains unchanged:
`export function sleepDebtProxy(dayRecords, windowDays, targetSleepMinutes)`

New body:
- Iterate from index 1 to dayRecords.length - 1 (skipping index 0 — no prevDay)
- For each i: extract `bedStr = extractTime(prevDay.bedtime)` and `wakeStr = extractTime(day.wake)`
- Skip iteration if either is null
- Compute `diff = timeToMinutes(wakeStr) - timeToMinutes(bedStr)`; apply overnight wrap: `sleepDur = diff < 0 ? diff + 24 * 60 : diff`
- Compute `napDur = napDuration(day)` (already exported from this file)
- Push `napDur !== null ? sleepDur + napDur : sleepDur` into `validCombValues`
- After loop: take `window = validCombValues.slice(-windowDays)`. If `window.length < windowDays`, return null
- Return `window.reduce((sum, comb) => sum + (targetSleepMinutes - comb), 0)`

Update the JSDoc comment above the function to describe the overnight pairing contract
(prevDay.bedtime → day.wake) and note that index 0 always produces null sleep (no prevDay).
Do not alter the function's exported name or parameter names.

The helper functions `extractTime`, `timeToMinutes`, and `napDuration` are already available
in this module's scope — no new imports needed.
  </action>
  <verify>
    <automated>node --test tests/unit/metrics.test.js 2>&1 | tail -5</automated>
  </verify>
  <done>sleepDebtProxy no longer calls combinedSleepNap; it iterates pairs (prevDay, day) and
applies overnight arithmetic. node --test tests/unit/metrics.test.js shows only existing
failures (if any) in other sections — the sleepDebtProxy describe block now fails due to
array-size mismatches awaiting Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Update sleepDebtProxy unit tests for overnight-pairing semantics</name>
  <files>tests/unit/metrics.test.js</files>
  <action>
Edit the `describe('sleepDebtProxy(...)')` block (section 18, currently around line 968–1049)
to account for the new pairing logic where index 0 contributes no sleep value (no prevDay).

Apply these changes — do NOT alter test names, assertion logic, or helper definitions outside
this describe block:

1. "returns null with fewer than windowDays valid records" test:
   - Input stays `[DEFICIT_DAY, DEFICIT_DAY, DEFICIT_DAY]` — now only 2 pairs qualify, still < 7 → null
   - Update inline comment to say "2 qualifying pairs (index 0 excluded)" to reflect new semantics

2. "returns a number (not null) with exactly windowDays valid records" test:
   - Change `Array(7).fill(DEFICIT_DAY)` → `Array(8).fill(DEFICIT_DAY)` (7 consecutive same-type pairs)

3. "returns 0 when all days sleep equals target" test:
   - Change `Array(7).fill(ZERO_DAY)` → `Array(8).fill(ZERO_DAY)`

4. "returns positive value when all days sleep less than target" test:
   - Change `Array(7).fill(DEFICIT_DAY)` → `Array(8).fill(DEFICIT_DAY)`
   - The arithmetic is unchanged: DEFICIT_DAY→DEFICIT_DAY pair gives
     wake=07:00 (420) - bedtime=22:00 (1320) + 1440 = 540 min → debt = 60 per day × 7 = 420 ✓

5. "returns negative value when all days sleep more than target" test:
   - Change `Array(7).fill(SURPLUS_DAY)` → `Array(8).fill(SURPLUS_DAY)`
   - Same arithmetic: SURPLUS_DAY→SURPLUS_DAY pair gives
     wake=07:00 (420) - bedtime=20:00 (1200) + 1440 = 660 min → debt = -60 per day × 7 = -420 ✓

6. "excludes null-combinedSleepNap days" test:
   - Keep input `[NULL_DAY, DEFICIT_DAY, DEFICIT_DAY, DEFICIT_DAY, DEFICIT_DAY, DEFICIT_DAY, DEFICIT_DAY]`
   - Update comment: now 5 qualifying pairs (NULL_DAY→DEFICIT_DAY skipped because bedStr=null;
     remaining 5 DEFICIT_DAY→DEFICIT_DAY pairs qualify), still < 7 → null ✓

7. "takes only last windowDays qualifying records" test:
   - Change `[...Array(3).fill(SURPLUS_DAY), ...Array(7).fill(DEFICIT_DAY)]`
     → `[...Array(4).fill(SURPLUS_DAY), ...Array(8).fill(DEFICIT_DAY)]`
   - Rationale: with 4 SURPLUS + 8 DEFICIT = 12 records total, the transition record at index 4
     (SURPLUS_DAY bedtime=20:00 → DEFICIT_DAY wake=07:00) still gives overnight pair = 660 min
     (surplus), but it is at validCombValues position 3 (0-indexed), outside the last-7 window
     (positions 5–11). Last 7 are all DEFICIT→DEFICIT pairs → result = 7 × 60 = 420 ✓
   - Update the comment block to reflect 4 surplus records + 8 deficit records

8. "does not mutate the input array" test:
   - Change `Array(7).fill(DEFICIT_DAY)` → `Array(8).fill(DEFICIT_DAY)` to keep it passing
     (the array now needs 8 elements to satisfy the null-guard and reach the reduce)
  </action>
  <verify>
    <automated>node --test tests/unit/metrics.test.js</automated>
  </verify>
  <done>node --test tests/unit/metrics.test.js exits 0 with all sleepDebtProxy tests passing.
No regressions in other sections of metrics.test.js.</done>
</task>

</tasks>

<threat_model>
No trust boundaries introduced — this is a pure-function fix in lib/ with no DOM, storage,
or network access. No STRIDE threats applicable.
</threat_model>

<verification>
node --test tests/unit/metrics.test.js
</verification>

<success_criteria>
- sleepDebtProxy uses overnight cross-day pairing (prevDay.bedtime → day.wake)
- sleepDebtProxy no longer calls combinedSleepNap
- All 9 sleepDebtProxy unit tests pass
- node --test tests/unit/metrics.test.js exits 0 with no regressions
</success_criteria>

<output>
Create `.planning/quick/260908-oir-fix-sleepdebtproxy-to-use-overnight-pair/260908-oir-01-SUMMARY.md` when done
</output>
