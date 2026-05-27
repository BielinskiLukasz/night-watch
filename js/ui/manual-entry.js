// js/ui/manual-entry.js
// Native <dialog>-based manual-entry modal (Plan 01-04 / LOG-05, LOG-06)
// + pure validate() with future-date guard + structured errors
// (Plan 01-07 / UAT gaps 2, 3).
//
// Source: 01-RESEARCH.md §Pattern 6 (native <dialog> + showModal),
// §Common Pitfalls #6 (edit-creates-duplicate UI-level mitigation —
// explicit mode parameter), §Open Questions #2 (silently round minute
// on save — preserved post-validation), §Open Questions #3 (window.confirm
// acceptable in Phase 1). 01-CONTEXT.md D-10/D-12/D-13/D-14.
// 01-07-PLAN.md (UAT gaps 2 + 3: future-date guard + visible-failure path).
//
// Security invariants (T-07 / V5):
//   - Every input value is set via .value (property assignment), NEVER
//     innerHTML interpolation. The form is static markup in index.html;
//     this module only reads via FormData and writes via .value.
//   - The title h2 uses .textContent (not innerHTML) when swapping
//     between 'Add event' / 'Edit event'.
//   - Inline validation errors render via el({ textContent }) into a
//     dedicated <output id="manualEntryErrors">; never innerHTML.
//
// Architecture invariant (Pitfall #6 / T-05):
//   - mode is REQUIRED and validated at function entry. The UI cannot
//     accidentally dispatch addEventAt when editEvent is intended — the
//     explicit mode parameter is the architectural mitigation. Branching
//     on `existing ? edit : add` would be brittle (see RESEARCH).
//
// Validation contract (Plan 01-07):
//   - validate(input, { now }) is a PURE exported function with no DOM
//     access. It returns either {ok:true, atString, type} or
//     {ok:false, errors:[{field, message}, ...]}. All errors are collected
//     before return so the user sees every problem at once.
//   - `now` is a function returning the current Date or local-ISO at-string;
//     the modal-side caller passes clock.now() so the test path can inject
//     clock-fixed. This honors the D-07 clock-adapter seam — validate()
//     itself routes all clock reads through the injected `now` function.
//   - LOG-07 silent rounding is preserved: the full 0–59 clock-minute range
//     is accepted and silently rounded to the nearest 5 AFTER validation
//     (post-smoke fix-up to Plan 01-07). The Date-arithmetic chain
//     parseLocalISO → roundTo5 → formatLocalISO handles the hour-carry
//     (58/59 → next hour :00) and the day-carry (23:58 on 2026-05-27 →
//     2026-05-28T00:00) for free, matching time.js's contract used on every
//     other write path. Out-of-range hour/minute (e.g. 25 / 600) still
//     fails visibly with a field-named error.
//
// Domain time vs UI default-prefill:
//   - The clock-adapter seam (D-07) reserves domain time for js/adapters/
//     clock-*. The modal's "default today's date" prefill is non-domain
//     (it's a UI ergonomic default; the user can change it before saving)
//     and is exempted with the explicit gsd:allow-ui-clock tag below.
//     Plan 05 Task 2 greps for that literal tag.

import { el, clear } from './dom.js';
import { roundTo5, formatLocalISO, parseLocalISO } from '../lib/time.js';

/** Pad an integer to 2 chars (shared between validate + UI default-prefill). */
function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Coerce `now` (a function returning Date or local-ISO string) to a canonical
 * local-ISO at-string 'YYYY-MM-DDTHH:MM'. The validator compares at-strings
 * lexicographically (same canonical format as the store's parseLocalISO
 * accepts, T-02), so we never need a Date object inside validate().
 *
 * @param {() => Date|string} now
 * @returns {string} canonical local-ISO at-string
 */
function nowAsAtString(now) {
  const value = now();
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  // Trust the caller to pass a canonical local-ISO string ('YYYY-MM-DDTHH:MM').
  // validate() compares lexicographically and never parses, so even a slightly
  // longer string (e.g. with seconds) is safe.
  return String(value);
}

/**
 * Pure form validator for the manual-entry modal.
 *
 * @param {{date: string, hourStr: string, minuteStr: string, type: string}} input
 *   Raw values as collected from the form (all strings).
 * @param {{now: () => Date|string}} deps
 *   Injected clock — all wall-clock reads route through this function.
 * @returns {{ok: true, atString: string, type: string} |
 *           {ok: false, errors: Array<{field: string, message: string}>}}
 */
export function validate({ date, hourStr, minuteStr, type }, { now }) {
  const errors = [];

  // -- Required-field guards (collect all missing before returning) --
  if (!date) {
    errors.push({ field: 'date', message: 'Date is required.' });
  }
  if (hourStr === '' || hourStr === undefined || hourStr === null) {
    errors.push({ field: 'hour', message: 'Hour is required.' });
  }
  if (minuteStr === '' || minuteStr === undefined || minuteStr === null) {
    errors.push({ field: 'minute', message: 'Minute is required.' });
  }
  if (!type) {
    errors.push({ field: 'type', message: 'Pick a sleep event type.' });
  }

  // -- Range guards on the parsed numerics (only if a value was supplied) --
  let hour = NaN;
  let minute = NaN;
  if (hourStr !== '' && hourStr !== undefined && hourStr !== null) {
    hour = Number(hourStr);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      errors.push({ field: 'hour', message: 'Hour must be 0–23.' });
    }
  }
  if (minuteStr !== '' && minuteStr !== undefined && minuteStr !== null) {
    minute = Number(minuteStr);
    // Accept the full clock range 0-59. LOG-07 silent-rounding handles the
    // out-of-grid values: 56-57 round down to :55, 58-59 carry to the next
    // hour (and 23:58 carries to next day 00:00 — the existing roundTo5
    // contract in time.js). The narrow 0-55 guard that Plan 01-07 originally
    // shipped rejected valid clock minutes the user could read off any
    // analog/digital display; manual smoke surfaced it as a UX regression.
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
      errors.push({ field: 'minute', message: 'Minute must be 0–59 (rounded to nearest 5).' });
    }
  }

  // -- Future-date guard (only if all the inputs needed to construct an
  //    at-string are present and in range) --
  const haveAllRequiredForFutureCheck =
    !!date &&
    Number.isFinite(hour) && hour >= 0 && hour <= 23 &&
    Number.isFinite(minute) && minute >= 0 && minute <= 59;

  if (haveAllRequiredForFutureCheck) {
    // Build a tentative at-string from the raw (pre-rounding) minute so the
    // future-date check uses the exact instant the user typed. LOG-07 rounding
    // happens AFTER acceptance and only narrows the value into the 5-min grid
    // — it cannot turn a past entry into a future one or vice versa.
    const tentativeAt = `${date}T${pad(hour)}:${pad(minute)}`;
    const nowAt = nowAsAtString(now);
    if (tentativeAt > nowAt) {
      errors.push({
        field: 'date',
        message: 'Cannot log a future event — pick today or any past day.',
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // -- Success path: apply LOG-07 silent rounding via roundTo5 (Date math) --
  // String interpolation of `${pad(hour)}:${pad(round(minute))}` would mishandle
  // the carry across hour/day boundaries (minute=58 → 60 → invalid HH:60 string;
  // hour=23 + minute=58 → next-day midnight must increment the date). Routing
  // through parseLocalISO → roundTo5 → formatLocalISO lets the Date class
  // perform the carry naturally, matching time.js's existing 23:58 → next-day
  // 00:00 contract used by every other write path (addEvent, addEventAt,
  // editEvent — all of which re-round via the same chain in the store).
  const rawAt = `${date}T${pad(hour)}:${pad(minute)}`;
  const atString = formatLocalISO(roundTo5(parseLocalISO(rawAt)));
  return { ok: true, atString, type };
}

/**
 * Open the manual-entry modal.
 *
 * @param {{
 *   mode: 'add' | 'edit',
 *   existing?: { id: string, type: string, at: string } | null,
 *   onSave: (data: { type: string, at: string }) => void,
 *   clock?: { now: () => Date|string },
 * }} opts
 *   `clock` is optional only so the existing call sites in today-screen.js
 *   keep working during composition-root wiring; when omitted the UI falls
 *   back to the UI-default-prefill clock read (already gsd:allow-ui-clock
 *   exempted). The pure validate() never reaches that fallback at the test
 *   path because the test imports validate() directly.
 */
export function openManualEntry({ mode, existing, onSave, clock }) {
  if (mode !== 'add' && mode !== 'edit') {
    // Pitfall #6 architectural mitigation — the UI cannot dispatch the
    // wrong store method because the dispatcher has no fallback branch.
    throw new Error('mode must be "add" or "edit"');
  }

  const dlg = document.getElementById('manualEntry');
  const form = dlg.querySelector('form');
  const title = dlg.querySelector('#manualEntryTitle');
  const dateInput = form.elements.namedItem('date');
  const hourInput = form.elements.namedItem('hour');
  const minuteInput = form.elements.namedItem('minute');
  const typeInput = form.elements.namedItem('type');
  const cancelBtn = dlg.querySelector('#manualCancel');
  const errorsEl = dlg.querySelector('#manualEntryErrors');

  // Title swap via textContent (T-07: never innerHTML).
  title.textContent = mode === 'edit' ? 'Edit event' : 'Add event';

  // Clear any stale errors from the previous open.
  if (errorsEl) clear(errorsEl);

  // Default today's-date string used both for the date prefill (add mode)
  // and as the HTML5 max= belt-and-suspenders guard on the date input.
  // gsd:allow-ui-clock — UI default-prefill of today's date is non-domain; domain time flows through clock-system.js
  const today = new Date();
  const todayYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // HTML5 belt-and-suspenders: stop the date input from accepting a future
  // calendar date via the native picker. JS-level validate() still runs and
  // is the source of truth (covers the rarer "today + future time" case).
  if (dateInput && 'max' in dateInput) {
    dateInput.max = todayYMD;
  }

  if (mode === 'edit' && existing) {
    // Pre-fill from canonical 'YYYY-MM-DDTHH:MM' via string slicing.
    // All assignments use the .value property (V5 / T-07 — never innerHTML).
    dateInput.value = existing.at.slice(0, 10);
    hourInput.value = String(parseInt(existing.at.slice(11, 13), 10));
    minuteInput.value = String(parseInt(existing.at.slice(14, 16), 10));
    typeInput.value = existing.type;
  } else {
    // Add mode: default the date input to today if empty.
    if (!dateInput.value) {
      dateInput.value = todayYMD;
    }
    // Default hour/minute to empty so user must pick — minute defaults to
    // 0 if user clears it, but explicit entry is preferred. We leave the
    // existing value (browser-preserved across opens) alone in add mode.
  }

  // Resolve the clock for validate(): prefer the injected one (call sites
  // can pass clock from the composition root); fall back to the `today`
  // value already read above via the gsd:allow-ui-clock exemption. The
  // fallback reuses that same value — no second clock read is introduced,
  // so the bare clock-constructor count for this file stays at exactly 1
  // (matching the security-smoke gate).
  const nowFn = clock && typeof clock.now === 'function'
    ? () => clock.now()
    : () => today; // Reuses the prefilled today value — no new clock read.

  // Close handler: dispatch onSave only when returnValue === 'save'
  // (form submit), never on cancel / ESC / backdrop click. ESC and
  // cancel both produce a non-'save' returnValue.
  //
  // The Save button uses formnovalidate (so the HTML5 step="5" constraint
  // doesn't block submit; silent normalization is the modal's contract per
  // Open Question #2). validate() does the actual validation and returns
  // structured errors. Plan 01-07 wires visible failure for the !ok branch:
  //   - render the errors into the <output id="manualEntryErrors"> block
  //   - re-open the dialog so the user can correct and re-submit
  //   - move focus to the first errored field
  // Cancel / ESC paths still short-circuit before validation.
  const onClose = () => {
    let shouldReopen = false;
    let firstErrorField = null;
    try {
      if (dlg.returnValue !== 'save') return;

      const data = new FormData(form);
      const result = validate(
        {
          date: String(data.get('date') ?? ''),
          hourStr: String(data.get('hour') ?? ''),
          minuteStr: String(data.get('minute') ?? ''),
          type: String(data.get('type') ?? ''),
        },
        { now: nowFn },
      );

      if (result.ok) {
        onSave({ type: result.type, at: result.atString });
        return;
      }

      // Visible-failure path (UAT gaps 2 + 3 closure).
      if (errorsEl) {
        clear(errorsEl);
        for (const err of result.errors) {
          errorsEl.appendChild(
            el('p', { 'data-field': err.field, textContent: err.message }),
          );
        }
      }
      firstErrorField = result.errors[0]?.field ?? null;
      shouldReopen = true;
    } finally {
      if (shouldReopen) {
        // Re-open the dialog so the user can correct and re-submit. The
        // native dialog has already fired 'close' before this handler ran,
        // so re-attach the close listener for the next round. queueMicrotask
        // defers the showModal call so the browser commits the close first
        // (Chromium will throw InvalidStateError if showModal is called on
        // an already-open dialog within the same tick).
        queueMicrotask(() => {
          dlg.showModal();
          dlg.addEventListener('close', onClose, { once: true });
          cancelBtn.addEventListener('click', onCancel, { once: true });
          if (firstErrorField) {
            const target = form.elements.namedItem(firstErrorField);
            if (target && typeof target.focus === 'function') {
              try { target.focus(); } catch { /* focus may fail in tests; non-fatal */ }
            }
          }
        });
      } else {
        // Successful save (or cancel/ESC): clean up for the next open.
        form.reset();
      }
    }
  };
  dlg.addEventListener('close', onClose, { once: true });

  // Cancel button explicitly closes with returnValue='cancel' so the
  // close handler skips the dispatch path.
  const onCancel = () => dlg.close('cancel');
  cancelBtn.addEventListener('click', onCancel, { once: true });

  // showModal() gives focus trap + ESC-to-close + aria-modal automatically
  // (V14 zero-deps modal accessibility — RESEARCH §Pattern 6).
  dlg.showModal();
}
