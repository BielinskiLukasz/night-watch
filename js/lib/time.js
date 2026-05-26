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
