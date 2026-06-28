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
import { parseCSV } from '../lib/csv-parse.js';
import { migrateV1ToV2, DEFAULT_SETTINGS } from '../lib/db-shape.js';

/**
 * Open the Settings modal. Populates form fields from settings.get(),
 * wires the close handler, and calls dlg.showModal().
 *
 * Phase 5 (Plan 05-04): accepts optional eventLog, storage, and id deps for
 * the CSV import flow. When provided, Import CSV button is wired to FileReader
 * → parseCSV → confirm → replace() on both stores.
 *
 * @param {{
 *   settings: { get: () => object, update: (patch: object) => object, replace?: (blob: object) => void },
 *   eventLog?: { replace: (blob: object) => void },
 *   storage?: { load: () => object|null, save: (db: object) => void },
 *   id?: () => string,
 * }} deps
 */
export function openSettings({ settings, eventLog, storage, id }) {
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

  // ── Import / Export wiring (Plan 05-04) ────────────────────────────────────
  // Wire CSV import if all required deps are provided. The named-handler pattern
  // (removeEventListener + addEventListener) prevents handler accumulation on
  // repeated Settings opens (T-05-04-04).

  const showStatus = (message, isError = false) => {
    const statusEl = document.getElementById('importStatus');
    if (!statusEl) return;
    statusEl.textContent = message; // textContent only — T-2-14
    statusEl.className = isError ? 'importStatus error' : 'importStatus';
  };

  if (eventLog && storage && id) {
    const importCsvBtn = document.getElementById('importCsvBtn');
    const csvInput = document.getElementById('csvInput');

    const handleCsvImport = (csvText) => {
      const { events, rejectedDays, activityLog, skipped } = parseCSV(csvText);
      const dayCount = new Set(events.map(e => e.at.slice(0, 10))).size;

      const confirmed = window.confirm(
        `Import ${dayCount} days? This will replace all current data.`,
      );
      if (!confirmed) return;

      // Assign IDs to events (Pitfall 4: CSV events have no id field)
      const eventsWithIds = events.map(evt => ({ ...evt, id: id() }));

      // Build the canonical blob from CSV data + default settings
      const blob = migrateV1ToV2(
        { version: 2, settings: { ...DEFAULT_SETTINGS, rejectedDays }, events: eventsWithIds, activityLog },
        DEFAULT_SETTINGS,
      );

      // RESEARCH §Pattern A: save first, then replace both stores
      storage.save(blob);
      eventLog.replace(blob);
      settings.replace(blob);

      // Show success/skip summary (D5-10, D5-11)
      if (skipped.length === 0) {
        showStatus(`Import complete — ${dayCount} days loaded.`);
      } else {
        const rowNums = skipped.map(s => s.row).join(', ');
        showStatus(
          `Import complete — ${dayCount} days loaded. ${skipped.length} row(s) skipped (rows ${rowNums}).`,
        );
      }
    };

    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      csvInput.value = ''; // RESEARCH Pitfall 6: reset so same file can be re-imported
      const reader = new FileReader();
      reader.onerror = () => showStatus('Could not read file.', true);
      reader.onload = (loadEvt) => handleCsvImport(loadEvt.target.result);
      reader.readAsText(file, 'UTF-8');
    };

    if (importCsvBtn && csvInput) {
      // Register change listener once (prevents accumulation on repeated opens)
      csvInput.removeEventListener('change', handleFileChange);
      csvInput.addEventListener('change', handleFileChange);

      importCsvBtn.addEventListener('click', () => csvInput.click());
    }

    // ── JSON import wiring (Plan 05-05) ──────────────────────────────────────
    const importJsonBtn = document.getElementById('importJsonBtn');
    const jsonInput = document.getElementById('jsonInput');

    const handleJsonImport = (jsonText) => {
      let blob;
      try {
        blob = JSON.parse(jsonText);
      } catch {
        showStatus('Invalid JSON file — could not parse.', true);
        return;
      }

      // Version guard: reject files from a future incompatible version
      if (typeof blob.version === 'number' && blob.version > 2) {
        showStatus('Incompatible file — exported by a newer version of Nightwatch.', true);
        return;
      }

      const eventCount = Array.isArray(blob.events) ? blob.events.length : 0;
      const dayCount = eventCount > 0
        ? new Set(blob.events.map(e => e.at && e.at.slice(0, 10)).filter(Boolean)).size
        : 0;

      if (!window.confirm(`Import ${dayCount} days from JSON? This will replace all current data and settings.`)) return;

      // RESEARCH §Pattern A: save first, then replace both stores
      storage.save(migrateV1ToV2(blob, DEFAULT_SETTINGS));
      eventLog.replace(blob);
      settings.replace(blob);

      showStatus(`Import complete — ${dayCount} days restored.`);
    };

    const handleJsonFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      jsonInput.value = ''; // Pitfall 6: reset so same file can be re-imported
      const reader = new FileReader();
      reader.onerror = () => showStatus('Could not read file.', true);
      reader.onload = (loadEvt) => handleJsonImport(loadEvt.target.result);
      reader.readAsText(file, 'UTF-8');
    };

    if (importJsonBtn && jsonInput) {
      jsonInput.removeEventListener('change', handleJsonFileChange);
      jsonInput.addEventListener('change', handleJsonFileChange);

      importJsonBtn.addEventListener('click', () => jsonInput.click());
    }
  }

  dlg.showModal();
}
