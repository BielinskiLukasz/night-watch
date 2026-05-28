// js/lib/time.js
// Pure-logic time helpers for Nightwatch.
//
// === Semantics (governed by 01-CONTEXT.md decisions + 01-RESEARCH.md pitfalls) ===
//
// 1. Round-to-nearest 5 minutes (Assumption A1, RESEARCH §Common Pitfalls #1).
//    A wake-up logged at 06:32 maps to 06:30 (closer); 06:33 → 06:35. This
//    matches typical clock-reading behavior and is the least surprising default.
//    The midnight rollover case (23:58 → 00:00 next day) is intentional — the
//    rounded Date naturally carries the day boundary.
//
// 2. Wall-clock, not UTC (D-16). Events are stored as 'YYYY-MM-DDTHH:MM' in
//    LOCAL wall-clock time, never with a 'Z' suffix. The user logging at 03:50
//    must see 03:50 forever, regardless of timezone migrations or DST.
//    formatLocalISO uses Date getters + padStart; never toISOString().
//
// 3. Strict parsing (Pitfall #2, T-02). parseLocalISO uses a regex gate so
//    malformed inputs fail loudly. Falling back to `new Date(string)` would
//    silently interpret date-only forms ('YYYY-MM-DD') as UTC and produce
//    off-by-one-day bugs — exactly the tampering surface T-02 mitigates.
//
// 4. DST limitation (Pitfall #3). Wall-clock semantics means spring-forward
//    gap times do not exist (V8/SpiderMonkey shift forward to disambiguate),
//    and fall-back overlap times are ambiguous. The day-bucketer dodges this
//    entirely by operating on string slices instead of Date math. Within a
//    single timezone, DST transition days may have a one-event bucketing
//    irregularity — acceptable for v1. A real fix needs a per-event timezone
//    field, which is out of scope until further notice.

/** Frozen config: 5-minute step in ms. Object.freeze per mindful-breathing pattern. */
const TIME_CONFIG = Object.freeze({ stepMs: 5 * 60 * 1000 });

/**
 * Round a Date to the NEAREST 5-minute boundary (Assumption A1 / Pitfall #1).
 *
 * Returns a new Date — does NOT mutate the input.
 *
 * Examples:
 *   06:32 → 06:30   (closer to :30)
 *   06:33 → 06:35   (closer to :35)
 *   23:58 → 00:00 next day  (midnight rollover, intentional)
 *
 * @param {Date} date
 * @returns {Date}
 */
export function roundTo5(date) {
  const ms = date.getTime();
  // Math.round = banker's nearest for integers; ties (exact :32:30) round up.
  // The Date result naturally rolls into the next day at the boundary.
  return new Date(Math.round(ms / TIME_CONFIG.stepMs) * TIME_CONFIG.stepMs);
}

/**
 * Emit a canonical 'YYYY-MM-DDTHH:MM' wall-clock string from a Date.
 *
 * Uses local-time getters + String.padStart. NEVER calls toISOString() —
 * that would emit a UTC 'Z' suffix and break wall-clock semantics (D-16).
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
 * unambiguously local time (Pitfall #2 / T-02 mitigation). Do NOT fall back
 * to `new Date(string)` here — date-only inputs would silently parse as UTC.
 *
 * @param {string} s
 * @returns {Date}
 */
export function parseLocalISO(s) {
  const m =
    typeof s === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s)
      : null;
  if (!m) throw new Error(`Invalid local ISO timestamp: ${s}`);
  const [, y, mo, d, h, mi] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi);
}

// ---------------------------------------------------------------------------
// Plan 02-03 / CFG-09 — display & input conversion helpers
//
// Pitfall #4 (Pattern I, RESEARCH): naïve modulo arithmetic for 12h conversion
// silently produces "0 AM" / "0 PM" at the midnight / noon edges. The
// explicit conditional branches below pin the contract; the table-driven
// tests in tests/unit/time.test.js are the regression guard.
//
// Pitfall #3 (DST safety): these helpers operate on string slices and
// integers — they NEVER construct a Date object. The wall-clock semantics
// of formatLocalISO are preserved through the formatter chain.
// ---------------------------------------------------------------------------

/**
 * Format a canonical 'YYYY-MM-DDTHH:MM' wall-clock string for display.
 *
 *   formatTime('2026-05-01T03:50', '24h') === '03:50'
 *   formatTime('2026-05-01T00:00', '12h') === '12:00 AM'
 *   formatTime('2026-05-01T12:00', '12h') === '12:00 PM'
 *
 * String-slice only — no Date construction (Pitfall #3).
 *
 * @param {string} at         canonical 'YYYY-MM-DDTHH:MM' wall-clock
 * @param {'24h'|'12h'} timeFormat
 * @returns {string}
 */
export function formatTime(at, timeFormat) {
  const hh = at.slice(11, 13);
  const mm = at.slice(14, 16);
  if (timeFormat === '24h') return `${hh}:${mm}`;
  const { h12, ampm } = to12h(parseInt(hh, 10));
  return `${h12}:${mm} ${ampm}`;
}

/**
 * Convert a 24-hour clock hour to its 12-hour {h12, ampm} representation.
 * Pitfall #4 edges (midnight = 12 AM, noon = 12 PM) handled by explicit
 * conditionals.
 *
 * @param {number} h24  integer 0..23
 * @returns {{ h12: number, ampm: 'AM' | 'PM' }}
 */
export function to12h(h24) {
  if (!Number.isInteger(h24) || h24 < 0 || h24 > 23) {
    throw new Error(`to12h: expected integer 0..23, got ${JSON.stringify(h24)}`);
  }
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { h12, ampm };
}

/**
 * Convert a 12-hour {hStr, ampm} pair to its 24-hour clock hour.
 * Pitfall #4 edges (12 AM → 0, 12 PM → 12) handled by explicit conditionals.
 *
 * Accepts hStr as a string (the natural form coming out of the manual-entry
 * <input>); parses it once and validates 1..12 range.
 *
 * @param {string} hStr  '1'..'12'
 * @param {'AM'|'PM'} ampm
 * @returns {number} integer 0..23
 */
export function to24h(hStr, ampm) {
  const h = parseInt(hStr, 10);
  if (!Number.isFinite(h) || h < 1 || h > 12) {
    throw new Error(`to24h: expected hour 1..12, got ${JSON.stringify(hStr)}`);
  }
  if (ampm === 'AM') return h === 12 ? 0 : h;
  if (ampm === 'PM') return h === 12 ? 12 : h + 12;
  throw new Error(`to24h: expected ampm "AM" or "PM", got ${JSON.stringify(ampm)}`);
}
