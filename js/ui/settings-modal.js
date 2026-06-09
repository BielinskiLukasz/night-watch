// js/ui/settings-modal.js
// Native <dialog>-based Settings modal — opens, populates 9 fields from
// the settings store, validates on Save, commits via settings.update().
//
// Plan: 02-04 (Task 1)
// Decisions: D2-12 (native <dialog>, showModal, form method="dialog"),
//            D2-13 (three fieldsets: Profile / Time & Day / Forecast tuning),
//            D2-14 (Save validation flow + Cancel/ESC empty-returnValue),
//            D2-09 (settings.update fires subscribers synchronously)
// Requirements: CFG-01..04, CFG-06, CFG-07
//
// Security invariants (T-07 / Pitfall #5 / T-2-14, T-2-15):
//   - Every input value is set via .value / .checked (property assignment),
//     NEVER innerHTML interpolation. The form markup is static in index.html.
//   - Error rendering uses el('p', {textContent}) — never innerHTML.
//   - validateSettings(raw, {mode:'save'}) runs on every Save attempt;
//     the raw FormData strings never reach the store — only the validated
//     `normalized` object passes through settings.update().
//
// Modal mechanics — direct analog of js/ui/manual-entry.js:
//   - form method="dialog" + Save submit → close with returnValue='save'
//   - Cancel button → dlg.close('cancel') → empty/non-'save' returnValue
//   - ESC → native dialog close with empty returnValue → no settings.update()
//   - On validation failure: queueMicrotask(() => dlg.showModal()) re-opens
//     after the close event has settled (Chromium otherwise throws
//     InvalidStateError on showModal of an already-open dialog).

import { el, clear } from './dom.js';
import { validateSettings } from '../lib/settings-validate.js';

/**
 * Open the Settings modal. Populates form fields from settings.get(),
 * wires the close handler, and calls dlg.showModal().
 *
 * @param {{ settings: { get: () => object, update: (patch: object) => object } }} deps
 */
export function openSettings({ settings }) {
  const dlg = document.getElementById('settings');
  const form = dlg.querySelector('form');
  const errorsEl = dlg.querySelector('#settingsErrors');
  const cancelBtn = dlg.querySelector('#settingsCancel');

  const snap = settings.get();

  // Populate every field from the current snapshot. .value / .checked only —
  // never innerHTML (Pitfall #5, T-2-14).
  form.elements.namedItem('subjectName').value = snap.subjectName;
  form.elements.namedItem('cutoverHour').value = String(snap.cutoverHour);
  form.elements.namedItem('groupingMode').value = snap.groupingMode;
  form.elements.namedItem('timeFormat').value = snap.timeFormat;
  form.elements.namedItem('autoOutlier').checked = Boolean(snap.autoOutlier);
  form.elements.namedItem('maxDelta').value = String(snap.maxDelta);
  form.elements.namedItem('minDays').value = String(snap.minDays);
  form.elements.namedItem('windowDays').value = String(snap.windowDays);
  form.elements.namedItem('statBlend').value = snap.statBlend;

  // Stale errors from a prior open get cleared (D2-14: each open is fresh).
  if (errorsEl) clear(errorsEl);

  // Close handler: dispatch settings.update only when returnValue === 'save'.
  // Cancel / ESC fire close with empty/non-'save' returnValue, so we short-circuit.
  const onClose = () => {
    let shouldReopen = false;
    let firstErrorField = null;
    try {
      if (dlg.returnValue !== 'save') return;

      const data = new FormData(form);
      // Coerce form values to the shape validateSettings expects. The
      // validator handles bounds — we only pre-trim string and convert
      // checkbox 'on' → boolean (HTML5 checkbox idiom when no explicit value).
      const raw = {
        subjectName: String(data.get('subjectName') ?? '').trim(),
        cutoverHour: Number(data.get('cutoverHour')),
        groupingMode: String(data.get('groupingMode') ?? ''),
        rejectedDays: snap.rejectedDays || [],
        timeFormat: String(data.get('timeFormat') ?? ''),
        autoOutlier: data.get('autoOutlier') === 'on',
        maxDelta: Number(data.get('maxDelta')),
        minDays: Number(data.get('minDays')),
        windowDays: Number(data.get('windowDays')),
        statBlend: String(data.get('statBlend') ?? ''),
      };

      const result = validateSettings(raw, { mode: 'save' });
      if (result.ok) {
        // T-2-14: only the validated normalized object reaches the store.
        // settings.update fires subscribers synchronously (D2-09) so the
        // header re-renders before we return.
        settings.update(result.normalized);
        return;
      }

      // Visible-failure path (D2-14): render errors, re-open, focus first errored field.
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
        // Defer showModal until after the close event has committed
        // (otherwise Chromium throws InvalidStateError on already-open dialog).
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
      }
    }
  };
  dlg.addEventListener('close', onClose, { once: true });

  // Explicit Cancel button → close with returnValue='cancel' so onClose short-circuits.
  const onCancel = () => dlg.close('cancel');
  cancelBtn.addEventListener('click', onCancel, { once: true });

  dlg.showModal();
}
