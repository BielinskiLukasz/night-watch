// js/lib/settings-validate.js
// Pure settings validator for Nightwatch.
// No DOM, no I/O, no side effects other than console.warn in mode:'load'.
//
// Decisions: D2-21 (bounds for all 9 fields), D2-22 (two-mode semantics),
//            D2-23 (pure helper, called from both UI Save and store loader).
// Research:  RESEARCH §Pattern F (RULES frozen object, checkField dispatcher,
//            circular import resolution).
//
// DEFAULT_SETTINGS is imported from db-shape.js (NOT from settings.js) to
// avoid the circular import: settings.js → settings-validate.js → settings.js.
// The neutral db-shape.js module breaks that cycle.
//
// Mirrors the Plan 01-07 validate(input, {now}) pattern:
//   - Collects ALL errors before returning (no early exit).
//   - Returns { ok: boolean, errors: [{field, message}], normalized: object }.
//   - Two call modes (D2-22):
//       mode:'save'  strict  — invalid fields add an error entry
//       mode:'load'  lenient — invalid fields silently reset to default + console.warn

import { DEFAULT_SETTINGS } from './db-shape.js';

// ---------------------------------------------------------------------------
// RULES — frozen validation metadata for all 10 settings fields
// ---------------------------------------------------------------------------

/**
 * Validation rules per D2-21 + Phase 4 CFG-05 addition.
 *
 * Each entry maps a field name to its rule descriptor:
 *   type:'string'      → { trim, maxLen }
 *   type:'integer'     → { min, max }
 *   type:'boolean'     → {}
 *   type:'enum'        → { values: Set }
 *   type:'string[]'    → array of strings; values are not validated at the
 *                        schema layer per D4-14 (no format/uniqueness
 *                        enforcement on rejectedDays at this level).
 *
 * Object.freeze per CLAUDE.md / mindful-breathing convention.
 *
 * @type {Readonly<Record<string, object>>}
 */
export const RULES = Object.freeze({
  subjectName:  { type: 'string',   trim: true, maxLen: 40 },
  cutoverHour:  { type: 'integer',  min: 0,  max: 23 },
  groupingMode: { type: 'enum',     values: new Set(['calendar', 'sleepCycle']) },
  rejectedDays: { type: 'string[]' },  // CFG-05: array of YYYY-MM-DD date strings
  timeFormat:   { type: 'enum',     values: new Set(['24h', '12h']) },
  autoOutlier:  { type: 'boolean' },
  maxDelta:     { type: 'integer',  min: 5,  max: 120 },
  minDays:      { type: 'integer',  min: 1,  max: 90 },
  windowDays:   { type: 'integer',  min: 3,  max: 90 },
  statBlend:    { type: 'enum',     values: new Set(['median', 'mean', 'blend']) },
});

// ---------------------------------------------------------------------------
// validateSettings — main export
// ---------------------------------------------------------------------------

/**
 * Validate a settings input object against RULES.
 *
 * Two modes (D2-22):
 *   mode:'save'  (default, strict) — out-of-range / wrong-type values push an
 *     error entry into errors[]. The caller (Settings modal Save handler) is
 *     expected to display these errors and keep the dialog open.
 *
 *   mode:'load'  (lenient) — out-of-range / wrong-type values silently reset
 *     to the corresponding default and emit console.warn with the
 *     '[nightwatch]' prefix. Sleep events in the same blob are unaffected —
 *     settings hygiene is isolated from event hygiene.
 *
 * The returned `normalized` object always contains all 9 keys. In mode:'save'
 * the caller should only use `normalized` when ok === true.
 *
 * @param {object} input  raw settings object (e.g. from FormData or parsed blob)
 * @param {{ mode?: 'save' | 'load', defaults?: object }} [opts]
 * @returns {{ ok: boolean, errors: Array<{field: string, message: string}>, normalized: object }}
 */
export function validateSettings(input, { mode = 'save', defaults = DEFAULT_SETTINGS } = {}) {
  const errors = [];
  const normalized = { ...defaults };

  for (const [field, rule] of Object.entries(RULES)) {
    const raw = input?.[field];
    const checked = checkField(field, raw, rule);

    if (checked.ok) {
      normalized[field] = checked.value;
    } else if (mode === 'save') {
      errors.push({ field, message: checked.message });
    } else {
      // mode:'load' — per-field default with warn (D2-22)
      console.warn(
        `[nightwatch] settings.${field} invalid (${JSON.stringify(raw)}); using default ${JSON.stringify(defaults[field])}`,
      );
      normalized[field] = defaults[field];
    }
  }

  return { ok: errors.length === 0, errors, normalized };
}

// ---------------------------------------------------------------------------
// checkField — private dispatcher
// ---------------------------------------------------------------------------

/**
 * Validate a single field value against its rule descriptor.
 *
 * @param {string} field  field name (for error messages)
 * @param {unknown} raw   raw input value
 * @param {object}  rule  rule descriptor from RULES
 * @returns {{ ok: true, value: unknown } | { ok: false, message: string }}
 */
function checkField(field, raw, rule) {
  switch (rule.type) {
    case 'string': {
      if (typeof raw !== 'string') {
        return { ok: false, message: `${field} must be text.` };
      }
      const trimmed = rule.trim ? raw.trim() : raw;
      if (rule.maxLen !== undefined && trimmed.length > rule.maxLen) {
        return {
          ok: false,
          message: `${field} must be ${rule.maxLen} characters or fewer.`,
        };
      }
      return { ok: true, value: trimmed };
    }

    case 'integer': {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
        return {
          ok: false,
          message: `${field} must be an integer between ${rule.min} and ${rule.max}.`,
        };
      }
      return { ok: true, value: n };
    }

    case 'boolean': {
      if (typeof raw !== 'boolean') {
        return { ok: false, message: `${field} must be true or false.` };
      }
      return { ok: true, value: raw };
    }

    case 'enum': {
      if (!rule.values.has(raw)) {
        return {
          ok: false,
          message: `${field} must be one of: ${[...rule.values].join(', ')}.`,
        };
      }
      return { ok: true, value: raw };
    }

    case 'string[]': {
      // CFG-05 / D4-14: rejectedDays is an array of strings.
      // Validation is intentionally minimal: we only check that the value is
      // an Array; individual date-string format is not enforced here.
      if (!Array.isArray(raw) || raw.some(item => typeof item !== 'string')) {
        return { ok: false, message: `${field} must be an array of strings.` };
      }
      return { ok: true, value: raw };
    }

    default:
      // Guard against typos in RULES (should not happen at runtime).
      return { ok: false, message: `${field} has unknown rule type: ${rule.type}.` };
  }
}
