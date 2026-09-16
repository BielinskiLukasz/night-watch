# Phase 21: Prediction Normalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 21-prediction-normalization
**Areas discussed:** Nap-window-closed flag & Phase 20 coordination, nextReachableEvent vs. existing selectNextEvent, De-emphasis style for secondary cards, File placement — forecast.js vs forecast-utils.js

---

## Nap-window-closed flag & Phase 20 coordination

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Phase 20's shape now | Add `napWindowClosed` to `napProbability()`'s object, amend Phase 20 CONTEXT.md (not yet executed) | ✓ |
| Independent Phase 21 helper | Separate function re-deriving the same P90 comparison | |
| You decide at planning time | Leave mechanism to planner/researcher | |

**User's choice:** Extend Phase 20's shape now.
**Notes:** Original backlog item B-047 (behind Phase 20) already called for exactly this flag; Phase 20's written CONTEXT.md had scoped it out to Phase 21. Decision restores the original intent and requires amending Phase 20's CONTEXT.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Score still collapses to 0 | Preserve current 0=window-closed semantics, flag just duplicates it | |
| Score keeps reporting real probability; flag is independent | True decoupling — removes existing hard-collapse-to-0 branch | ✓ |

**User's choice:** Score keeps reporting real probability; flag is independent.
**Notes:** Bigger change than the minimal option — removes `js/lib/forecast.js:1055-1060`'s hard-collapse branch. Matches the original backlog wording more literally than Phase 20's current CONTEXT.md draft.

| Option | Description | Selected |
|--------|-------------|----------|
| Amend Phase 20's CONTEXT.md right after this | Reopen and edit 20-CONTEXT.md immediately | ✓ |
| Just capture it in Phase 21's CONTEXT.md | Leave Phase 20 untouched, handle separately later | |

**User's choice:** Amend Phase 20's CONTEXT.md right after this.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep P90-of-history derivation | No new setting, reuse existing comparison | ✓ |
| New configurable cutoff hour setting | Add e.g. napCutoffHour setting | |

**User's choice:** Keep P90-of-history derivation.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — napWindowClosed only gates napStart | napEnd renders normally once a nap has started | ✓ |
| You decide at planning time | Leave exact gating mechanics to planner | |

**User's choice:** Yes — napWindowClosed only gates napStart.

---

## nextReachableEvent vs. existing selectNextEvent

| Option | Description | Selected |
|--------|-------------|----------|
| Extract & absorb | Pull selectNextEvent's priority logic into a pure nextReachableEvent; selectNextEvent becomes a thin wrapper | ✓ |
| New parallel function | Leave selectNextEvent untouched, build a separate helper | |

**User's choice:** Extract & absorb.
**Notes:** Fixes the existing `gsd:allow-ui-clock` new Date() calls in forecast.js as a side effect.

| Option | Description | Selected |
|--------|-------------|----------|
| Full ordered priority array | Return the full priority list so the caller still walks predictions to skip missing tiers | (superseded — see below) |
| Single top event type | Return just one type string | |

**User's choice:** User corrected the underlying event model instead of picking an option — see free-text note below.
**Notes (free text):** "You forgot about new event types. Now we have 5 of them: wake, napStart, napEnd, bedtimeAfterNap, bedtimeAfterWake. Possible order is: wake→napStart, wake→bedtimeAfterWake, napStart→napEnd, napEnd→bedtimeAfterNap, bedtimeAfterNap→wake, bedtimeAfterWake→wake, where bedtimeAfterNap & bedtimeAfterWake are tracked as bedtime (it's a separate event for order and prediction time reason — different logic to calculate bedtimeAfterNap (current one) and bedtimeAfterWake (new one))." This reshaped the rest of the discussion.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, exactly | bedtimeAfterNap/bedtimeAfterWake are prediction-calculation branches, not new loggable event types | ✓ |
| No, something else | — | |

**User's choice:** Yes, exactly.

| Option | Description | Selected |
|--------|-------------|----------|
| napStart first, fall back to bedtimeAfterWake once window closes | Time-gated single pick | |
| Probability-gated via napProbabilityScore | Threshold-based single pick | |

**User's choice (free text):** "It should display 2 possible events for that case, with predicted time" — neither offered option; both candidates shown together instead of picking one.

| Option | Description | Selected |
|--------|-------------|----------|
| Equal prominence — two hero cards | Both napStart and bedtimeAfterWake render as equally prominent hero cards | ✓ |
| napStart primary, bedtimeAfterWake secondary | Single hero + de-emphasized secondary | |

**User's choice:** Equal prominence — two hero cards.

| Option | Description | Selected |
|--------|-------------|----------|
| Array contract in the helper | nextReachableEvent always returns string[] | ✓ |
| Single type + special-case in the renderer | Keep single-type contract, special-case in UI | |

**User's choice:** Array contract in the helper.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add predictions.bedtimeAfterWake | New unblended field for the standalone hero card | ✓ |
| You decide at planning time | Leave field name/shape to planner | |

**User's choice:** Yes — add predictions.bedtimeAfterWake.

| Option | Description | Selected |
|--------|-------------|----------|
| napWindowClosed only | Use only the new history-derived flag, leave eveningHour untouched for TIF | |
| Either fires it (OR) | napWindowClosed OR nowHour >= eveningHour both suppress napStart | ✓ |

**User's choice:** Either fires it (OR).

---

## De-emphasis style for secondary cards

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing .collapsed accordion pattern | Same mechanism as TIF/probability-band cards | |
| New muted/dimmed style, still expanded | Reduced visual weight, no click needed | |
| Move into an expandable "Later today" section | Single collapsible details block | ✓ |

**User's choice:** Move into an expandable "Later today" section.

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsed by default | Matches UI-09/D9-05 convention | ✓ |
| Expanded by default | Busier initial screen, no extra tap | |

**User's choice:** Collapsed by default.

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap existing per-event cards in a new container | Keep renderers unchanged, reshuffle mounting | ✓ |
| You decide at planning time | Leave structure to planner | |

**User's choice:** Wrap existing per-event cards in a new container.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expand inner card once outer section opens | One tap shows full TIF detail | ✓ |
| Keep both independently collapsed | No special-casing, two taps needed | |

**User's choice:** Auto-expand inner card once outer section opens.

---

## File placement — forecast.js vs forecast-utils.js

| Option | Description | Selected |
|--------|-------------|----------|
| forecast.js | Co-located with selectNextEvent and its dependencies, no PRECACHE_LIST changes | ✓ (initial) |
| New forecast-utils.js | Separate orchestration from computation, requires PRECACHE_LIST update | ✓ (final) |

**User's choice:** Initially forecast.js; reversed to forecast-utils.js after being shown forecast.js's current size (1144 lines).
**Notes:** Confirmed both `nextReachableEvent` and `selectNextEvent` move together into the new file; `forecast-utils.js` imports one-directionally from `forecast.js` (no circular-import risk). Requires updating `sw.js` `PRECACHE_LIST` and `tests/unit/sw-precache.test.js`.

---

## Claude's Discretion

- Exact internal naming/structure of `nextReachableEvent`'s array-building logic (composing the PRED-08 evening-hour check with the new napWindowClosed OR-condition).
- Exact DOM/CSS structure of the "Later today" `<details>` wrapper, as long as it follows the no-open-attribute convention and wraps existing card renderers unchanged.

## Deferred Ideas

None — discussion stayed within phase scope. The Phase 20 CONTEXT.md amendment is cross-phase coordination triggered directly by a decision made here, not a new/deferred capability.
