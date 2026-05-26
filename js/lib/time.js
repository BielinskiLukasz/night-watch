// js/lib/time.js
// Pure-logic time helpers for Nightwatch.
//
// Plan 01 (walking-skeleton): minimal correct stubs.
//   - roundTo5 floors to the previous 5-minute boundary (acceptable per
//     01-PLAN.md Task 2 Step 2: "initial floor impl is acceptable — Plan 02
//     replaces with round-to-nearest").
// Plan 02 (pure-logic) hardens edge cases per the round-to-nearest table
// in 01-RESEARCH.md §Common Pitfalls #1 and Assumption A1.
//
// Critical: never use new Date(string) for canonical 'YYYY-MM-DDTHH:MM' input.
// Date-only strings parse as UTC, date+time parse as local — silent UTC drift
// is exactly the bug 01-RESEARCH.md §Common Pitfalls #2 / T-02 warns about.
// parseLocalISO uses a strict regex so malformed strings fail loudly.

const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * Round a Date down to the previous 5-minute boundary.
 * Plan 02 replaces this with round-to-nearest per Pitfall #1 / Assumption A1.
 *
 * @param {Date} date
 * @returns {Date}
 */
export function roundTo5(date) {
  const ms = date.getTime();
  return new Date(Math.floor(ms / FIVE_MIN_MS) * FIVE_MIN_MS);
}

/**
 * Emit a canonical 'YYYY-MM-DDTHH:MM' wall-clock string from a Date.
 * Uses local-time getters + String.padStart; never calls toISOString()
 * (which would force UTC and break D-01 wall-clock semantics).
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatLocalISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Strict regex-based parser for canonical 'YYYY-MM-DDTHH:MM' wall-clock
 * timestamps. Throws on any deviation (date-only, missing zero-pad, junk).
 *
 * Constructs the Date via numeric component constructor so the result is
 * unambiguously local time (Pitfall #2 / T-02 mitigation).
 *
 * @param {string} s
 * @returns {Date}
 */
export function parseLocalISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid local ISO timestamp: ${s}`);
  const [, y, mo, d, h, mi] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi);
}
