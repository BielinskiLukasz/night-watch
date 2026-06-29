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

// Module-level handler references — prevents listener accumulation when Settings
// is opened multiple times (each open removes the prior handler before adding a new one).
let _csvClickHandler = null;
let _csvChangeHandler = null;
let _jsonClickHandler = null;
let _jsonChangeHandler = null;
let _stagesCrudHandler = null;
let _addStageBtnHandler = null;

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

      if (skipped.length > 0) {
        console.warn('[Nightwatch] CSV import skipped rows:', skipped);
      }
      console.log(`[Nightwatch] CSV parsed: ${events.length} events, ${skipped.length} skipped`);

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

    // Remove prior handler before adding new one (module-level ref prevents accumulation)
    if (csvInput) {
      if (_csvChangeHandler) csvInput.removeEventListener('change', _csvChangeHandler);
      _csvChangeHandler = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        csvInput.value = ''; // RESEARCH Pitfall 6: reset so same file can be re-imported
        const reader = new FileReader();
        reader.onerror = () => showStatus('Could not read file.', true);
        reader.onload = (loadEvt) => handleCsvImport(loadEvt.target.result);
        reader.readAsText(file, 'UTF-8');
      };
      csvInput.addEventListener('change', _csvChangeHandler);
    }

    if (importCsvBtn && csvInput) {
      if (_csvClickHandler) importCsvBtn.removeEventListener('click', _csvClickHandler);
      _csvClickHandler = () => csvInput.click();
      importCsvBtn.addEventListener('click', _csvClickHandler);
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

    if (jsonInput) {
      if (_jsonChangeHandler) jsonInput.removeEventListener('change', _jsonChangeHandler);
      _jsonChangeHandler = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        jsonInput.value = ''; // Pitfall 6: reset so same file can be re-imported
        const reader = new FileReader();
        reader.onerror = () => showStatus('Could not read file.', true);
        reader.onload = (loadEvt) => handleJsonImport(loadEvt.target.result);
        reader.readAsText(file, 'UTF-8');
      };
      jsonInput.addEventListener('change', _jsonChangeHandler);
    }

    if (importJsonBtn && jsonInput) {
      if (_jsonClickHandler) importJsonBtn.removeEventListener('click', _jsonClickHandler);
      _jsonClickHandler = () => jsonInput.click();
      importJsonBtn.addEventListener('click', _jsonClickHandler);
    }
  }

  // ── Stages CRUD (Plan 06-04 / D6-13) ─────────────────────────────
  mountStagesCrud({ settings });

  dlg.showModal();
}

// ── Stages CRUD private helpers (Plan 06-04 / D6-13) ──────────────────────────

/**
 * Wire up the Stages CRUD section inside the Settings modal.
 * Uses module-level handler refs to prevent accumulation on repeated opens.
 */
function mountStagesCrud({ settings }) {
  const listEl = document.getElementById('stagesList');
  const addBtn = document.getElementById('addStageBtn');
  if (!listEl || !addBtn) return;

  renderStageList(listEl, settings);

  if (_addStageBtnHandler) addBtn.removeEventListener('click', _addStageBtnHandler);
  _addStageBtnHandler = () => {
    if (listEl.querySelector('.stage-inline-form')) return;
    listEl.appendChild(buildInlineForm(null, listEl, settings));
    addBtn.disabled = true;
  };
  addBtn.addEventListener('click', _addStageBtnHandler);

  if (_stagesCrudHandler) listEl.removeEventListener('click', _stagesCrudHandler);
  _stagesCrudHandler = (e) => {
    const editBtn   = e.target.closest('button.stage-edit-btn');
    const delBtn    = e.target.closest('button.stage-del-btn');
    const saveBtn   = e.target.closest('button.stage-save-btn');
    const cancelBtn = e.target.closest('button.stage-cancel-btn');

    if (editBtn) {
      const stageId = editBtn.dataset.stageId;
      const stage = (settings.get().stages || []).find(s => s.id === stageId);
      if (!stage) return;
      const row = editBtn.closest('.stage-row');
      if (!row) return;
      row.replaceWith(buildInlineForm(stage, listEl, settings));
      addBtn.disabled = true;
      return;
    }

    if (delBtn) {
      const stageId = delBtn.dataset.stageId;
      const snap = settings.get();
      const stage = (snap.stages || []).find(s => s.id === stageId);
      if (!stage) return;
      if (!window.confirm(`Delete stage "${stage.name}"?`)) return;
      const newStages = (snap.stages || []).filter(s => s.id !== stageId);
      const newActiveId = snap.activeStageId === stageId ? null : snap.activeStageId;
      settings.update({ stages: newStages, activeStageId: newActiveId });
      renderStageList(listEl, settings);
      addBtn.disabled = false;
      return;
    }

    if (saveBtn) {
      const form = saveBtn.closest('.stage-inline-form');
      if (!form) return;
      const stageId    = form.dataset.stageId || null;
      const nameInput  = form.querySelector('.stage-name-input');
      const startInput = form.querySelector('.stage-start-input');
      const endInput   = form.querySelector('.stage-end-input');

      const name      = nameInput.value.trim();
      const startDate = startInput.value.trim();
      const endDate   = endInput.value.trim() || null;

      const errors = [];
      if (!name)      errors.push('Stage name is required.');
      if (!startDate) errors.push('Start date is required.');
      if (endDate && endDate < startDate) errors.push('End date must be on or after start date.');

      const errEl = form.querySelector('.stage-form-error');
      if (errEl) errEl.textContent = errors.join(' ');
      if (errors.length > 0) return;

      const snap = settings.get();
      const existingStages = snap.stages || [];

      // Overlap warning (D6-06)
      const newEnd = endDate;
      const overlapping = existingStages.filter(s => {
        if (s.id === stageId) return false;
        const sEnd = s.endDate || '9999-12-31';
        const nEnd = newEnd   || '9999-12-31';
        return startDate <= sEnd && nEnd >= s.startDate;
      });
      if (overlapping.length > 0) {
        const names = overlapping.map(s => `"${s.name}"`).join(', ');
        if (!window.confirm(`This date range overlaps with ${names}. Save anyway?`)) return;
      }

      let newStages;
      if (stageId) {
        newStages = existingStages.map(s =>
          s.id === stageId ? { ...s, name, startDate, endDate } : s
        );
      } else {
        const newId = String(Date.now());
        newStages = [...existingStages, { id: newId, name, startDate, endDate }];
      }

      settings.update({ stages: newStages });
      renderStageList(listEl, settings);
      addBtn.disabled = false;
      return;
    }

    if (cancelBtn) {
      const form = cancelBtn.closest('.stage-inline-form');
      if (!form) return;
      renderStageList(listEl, settings);
      addBtn.disabled = false;
    }
  };
  listEl.addEventListener('click', _stagesCrudHandler);
}

/**
 * Rebuild the stage list element from current settings.
 * Uses el()/clear() — no innerHTML. (T-07 / Pitfall #5)
 */
function renderStageList(listEl, settings) {
  clear(listEl);
  const stages = settings.get().stages || [];
  if (stages.length === 0) {
    listEl.appendChild(el('p', { className: 'stages-empty', textContent: 'No stages defined yet.' }));
    return;
  }

  const table = el('table', { className: 'stages-table' });
  const thead = el('thead', {});
  const hrow  = el('tr', {});
  for (const h of ['Name', 'Start', 'End', 'Actions']) {
    hrow.appendChild(el('th', { textContent: h }));
  }
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = el('tbody', {});
  for (const stage of stages) {
    const row = el('tr', { className: 'stage-row' });
    row.appendChild(el('td', { textContent: stage.name }));
    row.appendChild(el('td', { textContent: stage.startDate }));
    row.appendChild(el('td', { textContent: stage.endDate || 'ongoing' }));

    const actCell = el('td', { className: 'stage-actions' });
    const editBtn = el('button', { type: 'button', className: 'stage-edit-btn', textContent: 'Edit' });
    editBtn.dataset.stageId = stage.id;
    const delBtn  = el('button', { type: 'button', className: 'stage-del-btn',  textContent: 'Delete' });
    delBtn.dataset.stageId  = stage.id;
    actCell.appendChild(editBtn);
    actCell.appendChild(delBtn);
    row.appendChild(actCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  listEl.appendChild(table);
}

/**
 * Build an inline add/edit form element for a stage.
 * Inputs intentionally have NO `name` attribute to prevent FormData pickup.
 */
function buildInlineForm(stage, listEl, settings) {
  const formEl = el('div', { className: 'stage-inline-form' });
  if (stage) formEl.dataset.stageId = stage.id;

  const inputs = el('div', { className: 'stage-inline-inputs' });

  const nameInput  = el('input', { type: 'text', className: 'stage-name-input',  placeholder: 'Stage name', maxlength: '80' });
  nameInput.setAttribute('aria-label', 'Stage name');
  if (stage) nameInput.value = stage.name;

  const startInput = el('input', { type: 'date', className: 'stage-start-input' });
  startInput.setAttribute('aria-label', 'Start date');
  if (stage) startInput.value = stage.startDate;

  const endInput   = el('input', { type: 'date', className: 'stage-end-input' });
  endInput.setAttribute('aria-label', 'End date (leave blank for ongoing)');
  if (stage && stage.endDate) endInput.value = stage.endDate;

  inputs.appendChild(nameInput);
  inputs.appendChild(startInput);
  inputs.appendChild(endInput);
  formEl.appendChild(inputs);

  const errEl = el('p', { className: 'stage-form-error' });
  formEl.appendChild(errEl);

  const btns = el('div', { className: 'stage-form-btns' });
  btns.appendChild(el('button', { type: 'button', className: 'stage-save-btn',   textContent: 'Save' }));
  btns.appendChild(el('button', { type: 'button', className: 'stage-cancel-btn', textContent: 'Cancel' }));
  formEl.appendChild(btns);

  return formEl;
}
