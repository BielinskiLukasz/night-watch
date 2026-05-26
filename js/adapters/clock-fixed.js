// js/adapters/clock-fixed.js
// Fixed-time ClockAdapter test double.
//
// Source: 01-RESEARCH.md §Code Examples §Clock-fixed adapter (verbatim).
// Returns a NEW Date on every .now() call so tests can't accidentally
// mutate the internal time reference.

/**
 * @param {Date|string|number} initial
 * @returns {{ now: () => Date, advance: (ms: number) => void, set: (date: Date|string|number) => void }}
 */
export function createClockFixed(initial) {
  let t = initial instanceof Date ? initial : new Date(initial);
  return {
    now() {
      return new Date(t);
    },
    advance(ms) {
      t = new Date(t.getTime() + ms);
    },
    set(date) {
      t = date instanceof Date ? date : new Date(date);
    },
  };
}
