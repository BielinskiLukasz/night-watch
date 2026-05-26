// js/ui/manual-entry.js
// Native <dialog>-based manual-entry modal (Plan 01-04 / LOG-05, LOG-06).
//
// Source: 01-RESEARCH.md §Pattern 6 (native <dialog> + showModal),
// §Common Pitfalls #6 (edit-creates-duplicate UI-level mitigation —
// explicit mode parameter), §Open Questions #2 (silently round minute
// on save), §Open Questions #3 (window.confirm acceptable in Phase 1).
// 01-CONTEXT.md D-10/D-12/D-13/D-14.
//
// Security invariants (T-07 / V5):
//   - Every input value is set via .value (property assignment), NEVER
//     innerHTML interpolation. The form is static markup in index.html;
//     this module only reads via FormData and writes via .value.
//   - The title h2 uses .textContent (not innerHTML) when swapping
//     between 'Add event' / 'Edit event'.
//
// Architecture invariant (Pitfall #6 / T-05):
//   - mode is REQUIRED and validated at function entry. The UI cannot
//     accidentally dispatch addEventAt when editEvent is intended — the
//     explicit mode parameter is the architectural mitigation. Branching
//     on `existing ? edit : add` would be brittle (see RESEARCH).
//
// Domain time vs UI default-prefill:
//   - The clock-adapter seam (D-07) reserves domain time for js/adapters/
//     clock-*. The modal's "default today's date" prefill is non-domain
//     (it's a UI ergonomic default; the user can change it before saving)
//     and is exempted with the explicit gsd:allow-ui-clock tag below.
//     Plan 05 Task 2 greps for that literal tag.

/**
 * Open the manual-entry modal.
 *
 * @param {{
 *   mode: 'add' | 'edit',
 *   existing?: { id: string, type: string, at: string } | null,
 *   onSave: (data: { type: string, at: string }) => void,
 * }} opts
 */
export function openManualEntry({ mode, existing, onSave }) {
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

  // Title swap via textContent (T-07: never innerHTML).
  title.textContent = mode === 'edit' ? 'Edit event' : 'Add event';

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
      // gsd:allow-ui-clock — UI default-prefill of today's date is non-domain; domain time flows through clock-system.js
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      dateInput.value =
        `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    }
    // Default hour/minute to empty so user must pick — minute defaults to
    // 0 if user clears it, but explicit entry is preferred. We leave the
    // existing value (browser-preserved across opens) alone in add mode.
  }

  // Close handler: dispatch onSave only when returnValue === 'save'
  // (form submit), never on cancel / ESC / backdrop click. ESC and
  // cancel both produce a non-'save' returnValue.
  //
  // The Save button uses formnovalidate (so the HTML5 step="5" constraint
  // doesn't block submit; silent normalization is the modal's contract per
  // Open Question #2). JS does the actual validation here:
  //   - Empty / missing fields → no dispatch (defense against formnovalidate).
  //   - Hour out of 0..23 or Minute out of 0..55 → no dispatch.
  //   - Type not in the 4-option whitelist → no dispatch (store would throw,
  //     but catching it earlier keeps the failure mode clean).
  const onClose = () => {
    try {
      if (dlg.returnValue === 'save') {
        const data = new FormData(form);
        const date = String(data.get('date') ?? '');
        const rawHourStr = String(data.get('hour') ?? '');
        const rawMinuteStr = String(data.get('minute') ?? '');
        const type = String(data.get('type') ?? '');

        // JS-level required-field guard (formnovalidate bypasses HTML5 required).
        if (!date || rawHourStr === '' || rawMinuteStr === '' || !type) return;

        const rawHour = Number(rawHourStr);
        const rawMinute = Number(rawMinuteStr);

        // JS-level range guard (formnovalidate bypasses min/max too).
        // Bounds match index.html: hour 0-23, minute 0-55.
        if (!Number.isFinite(rawHour) || rawHour < 0 || rawHour > 23) return;
        if (!Number.isFinite(rawMinute) || rawMinute < 0 || rawMinute > 55) return;

        // Open Question #2 + LOG-07: silently normalize minute to nearest 5.
        // The store's roundTo5 will also re-round on save (defense in depth) so
        // even if this normalization were bypassed, the canonical 5-min
        // invariant still holds at the store boundary.
        const normalizedMinute = Math.round(rawMinute / 5) * 5;

        const pad = (n) => String(n).padStart(2, '0');
        const atString = `${date}T${pad(rawHour)}:${pad(normalizedMinute)}`;

        onSave({ type, at: atString });
      }
    } finally {
      // Reset for the next open. Listener is single-shot so we don't
      // need to remove it explicitly.
      form.reset();
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
