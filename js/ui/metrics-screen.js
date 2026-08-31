// js/ui/metrics-screen.js
// Phase 11, metrics-screen component (Plan 02); updated Phase 14 Plan 03
// Decisions: D11-01 (single table), D11-02 (column order), D11-03 (most-recent-first),
// D11-04 (no-nap em-dash), D11-05 (rejected dimming), D11-09 (stage badge),
// D11-17..D11-19 (sticky headers/columns), D11-20..D11-22 (formatting).
// Phase 14: D-09 (16-column order), D-11 (12 TIF inline columns), D-13 (isRatio for new cols),
//           D-14 (SAA removed), MET-07/08/09/10/11.
//
// mountMetricsScreen({ root, eventLog, settings }) — full table rendering with
// stage filtering, summary aggregates, per-day metrics rows, and reactive lifecycle.
//
// Security invariants (T-11-05, T-11-04):
//   - ALL cell content set via textContent — NEVER dynamic HTML injection
//   - Stage name rendered via badge.textContent only
//   - No user input interpolated into dynamic HTML injection anywhere in this module

import {
  activityAfterSleepFactor,
  aggregateMetrics,
} from '../lib/metrics.js';
import { filterDayRecordsByStage } from '../lib/stages.js';
import { formatTime, formatDuration } from '../lib/time.js';
import { computeTifBoundsHistory } from '../lib/accuracy-tif.js';
import { trimmedMinMax, tifForecast } from '../lib/forecast-tif.js';
import { timeToMinutes, minutesToTime } from '../lib/forecast.js';

// ---------------------------------------------------------------------------
// Module-level constants (Object.freeze per CLAUDE.md convention)
// ---------------------------------------------------------------------------

/**
 * Column definitions for the 16-column metrics table (D-09 order).
 * Order: Date | Wake | Nap Start | Nap End | Bedtime | Sleep | Nap | Nap Frac |
 *        Comb | Day Len | Day/Sleep | →Nap | Nap→ | Act | AM/PM | AAS
 *
 * Changes from 14-column layout (D-09, D-13, D-14):
 *   - SAA (sleepAfterActivityFactor) removed per D-14/MET-07
 *   - Nap Frac (napFraction, isRatio) inserted at index 7 per MET-09
 *   - Day/Sleep (dayToSleepFactor, isRatio) inserted at index 10 per MET-07
 *   - AM/PM (amPmSplit, isRatio) inserted at index 14 per MET-10
 */
const COLUMNS = Object.freeze([
  { key: 'date',                    label: 'Date',      isTime: false, isRatio: false, sticky: true },
  { key: 'wake',                    label: 'Wake',      isTime: true,  isRatio: false },
  { key: 'napStart',                label: 'Nap Start', isTime: true,  isRatio: false },
  { key: 'napEnd',                  label: 'Nap End',   isTime: true,  isRatio: false },
  { key: 'bedtime',                 label: 'Bedtime',   isTime: true,  isRatio: false },
  { key: 'sleepDuration',           label: 'Sleep',     isTime: false, isRatio: false },
  { key: 'napDuration',             label: 'Nap',       isTime: false, isRatio: false },
  { key: 'napFraction',             label: 'Nap Frac',  isTime: false, isRatio: true  }, // NEW MET-09
  { key: 'combinedSleepNap',        label: 'Comb',      isTime: false, isRatio: false },
  { key: 'dayLength',               label: 'Day Len',   isTime: false, isRatio: false },
  { key: 'dayToSleepFactor',        label: 'Day/Sleep', isTime: false, isRatio: true  }, // NEW MET-07
  { key: 'activityBeforeNap',       label: '→Nap',      isTime: false, isRatio: false },
  { key: 'maSleepRatio',            label: 'MA/Sl',     isTime: false, isRatio: true  },
  { key: 'maNapRatio',              label: 'MA/Nap',    isTime: false, isRatio: true  },
  { key: 'activityAfterNap',        label: 'Nap→',      isTime: false, isRatio: false },
  { key: 'totalActivity',           label: 'Act',       isTime: false, isRatio: false },
  { key: 'amPmSplit',               label: 'AM/PM',     isTime: false, isRatio: true  }, // NEW MET-10
  { key: 'activityAfterSleepFactor', label: 'AAS',      isTime: false, isRatio: true  },
  // SAA (sleepAfterActivityFactor) removed from COLUMNS per D-14/MET-07
]);

/**
 * TIF inline column definitions (MET-08, D-11).
 * 12 columns for 4 event types × 3 fields: algMin (time), algMax (time), precisionScore (ratio).
 * All entries carry tif:true; columns are hidden when TIF is not the active algorithm.
 * Labels abbreviated per Claude's Discretion: W=Wake, NS=Nap Start, NE=Nap End, B=Bedtime.
 * Appended at the far right of the metrics table header (after COLUMNS).
 */
const TIF_COLUMNS = Object.freeze([
  { key: 'wake_tif_min',      label: 'W-min',   isTime: true,  isRatio: false, tif: true },
  { key: 'wake_tif_max',      label: 'W-max',   isTime: true,  isRatio: false, tif: true },
  { key: 'wake_tif_conf',     label: 'W-conf',  isTime: false, isRatio: true,  tif: true },
  { key: 'napStart_tif_min',  label: 'NS-min',  isTime: true,  isRatio: false, tif: true },
  { key: 'napStart_tif_max',  label: 'NS-max',  isTime: true,  isRatio: false, tif: true },
  { key: 'napStart_tif_conf', label: 'NS-conf', isTime: false, isRatio: true,  tif: true },
  { key: 'napEnd_tif_min',    label: 'NE-min',  isTime: true,  isRatio: false, tif: true },
  { key: 'napEnd_tif_max',    label: 'NE-max',  isTime: true,  isRatio: false, tif: true },
  { key: 'napEnd_tif_conf',   label: 'NE-conf', isTime: false, isRatio: true,  tif: true },
  { key: 'bedtime_tif_min',   label: 'B-min',   isTime: true,  isRatio: false, tif: true },
  { key: 'bedtime_tif_max',   label: 'B-max',   isTime: true,  isRatio: false, tif: true },
  { key: 'bedtime_tif_conf',  label: 'B-conf',  isTime: false, isRatio: true,  tif: true },
]);

// ---------------------------------------------------------------------------
// Private rendering helpers
// ---------------------------------------------------------------------------

/**
 * Render the stage badge when a valid stage is selected (D11-09).
 *
 * Badge is shown only when a valid stage is selected. Stage name is
 * rendered via textContent only (T-11-04).
 *
 * @param {HTMLElement} badge   the .stageChip element
 * @param {object} snap         settings snapshot
 */
function renderStageBadge(badge, snap) {
  if (snap.activeStageId) {
    const stage = (snap.stages || []).find(s => s.id === snap.activeStageId);
    badge.hidden = !stage;
    if (stage) {
      // T-11-04: textContent only — stage.name is user-supplied.
      badge.textContent = 'Viewing: ' + stage.name;
    }
  } else {
    badge.hidden = true;
  }
}

/**
 * Render the empty state when no days are logged (D11-07).
 *
 * T-11-05: textContent only — no dynamic HTML injection.
 *
 * @param {HTMLElement} root the screen root element
 */
function renderEmptyState(root) {
  const msg = document.createElement('p');
  msg.className = 'emptyState';
  msg.textContent = 'No logged days yet. Start logging sleep events to see metrics.';
  root.replaceChildren(msg);
}

/**
 * Format a cell value based on column definition and value.
 *
 * T-11-05: All content set via textContent.
 *
 * @param {*} value the cell value (null, number, string)
 * @param {object} colDef column definition
 * @param {object} snap settings snapshot (for timeFormat)
 * @returns {string} formatted cell text
 */
function formatCellValue(value, colDef, snap) {
  if (value === null || value === undefined) return '—';

  if (colDef.isTime && value) {
    return formatTime(value, snap.timeFormat);
  } else if (colDef.isRatio && value !== null && value !== undefined) {
    return value.toFixed(2);
  } else if (!colDef.isTime && !colDef.isRatio && value !== null && value !== undefined) {
    // Duration columns
    return formatDuration(value);
  } else {
    return String(value);
  }
}

/**
 * Build a table cell element (td).
 *
 * For min/max cells with dates, creates two child elements (value + date).
 *
 * @param {*} value the cell value
 * @param {object} colDef column definition
 * @param {object} snap settings snapshot
 * @param {object} minMaxDate optional {value, date} for min/max cells
 * @returns {HTMLTableCellElement}
 */
function buildCell(value, colDef, snap, minMaxDate = null) {
  const td = document.createElement('td');

  if (minMaxDate && minMaxDate.value !== null) {
    // Min/Max cell with date on second line
    const valueLine = document.createElement('span');
    valueLine.textContent = formatCellValue(minMaxDate.value, colDef, snap);
    td.appendChild(valueLine);

    if (minMaxDate.date) {
      const dateLine = document.createElement('small');
      dateLine.textContent = minMaxDate.date;
      td.appendChild(document.createElement('br'));
      td.appendChild(dateLine);
    }
  } else {
    // Regular cell
    td.textContent = formatCellValue(value, colDef, snap);
  }

  if (colDef.sticky) {
    td.classList.add('sticky-col');
  }

  return td;
}

/**
 * Build a table row (tr) for a day record.
 *
 * @param {object}  dayMetrics    the metrics row from aggregateMetrics
 * @param {object}  snap          settings snapshot
 * @param {Map}     tifBoundsMap  Map<date, TifBoundsEntry> from computeTifBoundsHistory
 * @param {boolean} isTif         true when TIF is the active forecast algorithm
 * @returns {HTMLTableRowElement}
 */
function buildDayRow(dayMetrics, snap, tifBoundsMap, isTif) {
  const tr = document.createElement('tr');

  if (dayMetrics.rejected) {
    tr.classList.add('rejected');
  }

  // First cell: date (sticky left)
  const dateCell = document.createElement('td');
  dateCell.classList.add('sticky-col');
  const dateStr = dayMetrics.date || '—';
  dateCell.textContent = dateStr;
  tr.appendChild(dateCell);

  // Remaining base columns
  for (let i = 1; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    const value = dayMetrics[col.key];
    const td = buildCell(value, col, snap);
    tr.appendChild(td);
  }

  // TIF inline cells (MET-08, D-11) — T-11-05: textContent only
  const tifEntry = tifBoundsMap ? tifBoundsMap.get(dayMetrics.date) : null;
  for (const col of TIF_COLUMNS) {
    const td = document.createElement('td');
    td.hidden = !isTif;
    let cellText = '—';
    if (tifEntry) {
      // col.key format: '{eventType}_tif_{field}' e.g. 'wake_tif_min', 'napStart_tif_conf'
      // split('_tif_') → [eventType, field]; works for all keys including 'napStart_tif_min'
      const parts = col.key.split('_tif_');
      const eventType = parts[0]; // 'wake', 'napStart', 'napEnd', 'bedtime'
      const field     = parts[1]; // 'min', 'max', 'conf'
      const bounds = tifEntry[eventType];
      if (bounds) {
        if (field === 'min')       cellText = formatTime(bounds.algMin, snap.timeFormat);
        else if (field === 'max')  cellText = formatTime(bounds.algMax, snap.timeFormat);
        else if (field === 'conf') cellText = bounds.precisionScore != null ? bounds.precisionScore.toFixed(2) : '—';
      }
    }
    td.textContent = cellText; // T-11-05: textContent only
    tr.appendChild(td);
  }

  return tr;
}

/**
 * Build a table row for an aggregate (Avg, Min, Max).
 *
 * @param {string} label "Average", "Min", or "Max"
 * @param {object} aggregateData the aggregate data object (avg, min, or max from aggregateMetrics)
 * @param {object} snap settings snapshot
 * @returns {HTMLTableRowElement}
 */
function buildAggregateRow(label, aggregateData, snap) {
  const tr = document.createElement('tr');
  tr.classList.add('metrics-summary-row');

  // First cell: label (sticky left)
  const labelCell = document.createElement('td');
  labelCell.classList.add('sticky-col');
  labelCell.textContent = label;
  tr.appendChild(labelCell);

  // Remaining columns
  for (let i = 1; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    const value = aggregateData[col.key];

    // For min/max, value is {value, date}; for avg, it's just the number
    const minMaxVal = (typeof value === 'object' && value !== null && 'value' in value) ? value : null;

    const td = buildCell(value, col, snap, minMaxVal);
    tr.appendChild(td);
  }

  return tr;
}

/**
 * Compute trimmed min, median, and max for each base metric column (indices 1–15)
 * over the TIF rolling window, skipping rejected rows (MET-11).
 *
 * @param {object[]} rows   metrics rows (oldest-first) from aggregateMetrics
 * @param {object}   snap   settings snapshot
 * @returns {{ min: object, median: object, max: object }}
 *   Each property is a flat map of { colKey: formattedValue|null }.
 */
function computeTifTrimmedStats(rows, snap) {
  const windowSize = snap.tifRollingDays ?? 7;
  const trimPct    = snap.trimPct ?? 10;

  // Take the last windowSize rows (most recent), then exclude rejected.
  const window = rows.slice(-windowSize).filter(r => !r.rejected);

  const minMap    = {};
  const medianMap = {};
  const maxMap    = {};

  for (let i = 1; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];

    if (col.isTime) {
      // Metric rows may contain bare 'HH:MM' strings or full ISO strings ('YYYY-MM-DDTHH:MM').
      // raw.length > 5 extracts the HH:MM slice from ISO strings and passes bare strings through
      // unchanged — this guard handles both forms and is live code, not dead code.
      const mins = window
        .map(r => {
          const raw = r[col.key];
          if (raw == null) return null;
          const hhmm = raw.length > 5 ? raw.slice(11) : raw;
          return timeToMinutes(hhmm);
        })
        .filter(v => v !== null);
      mins.sort((a, b) => a - b);
      const result = trimmedMinMax(mins, trimPct, 0);
      minMap[col.key]    = result ? minutesToTime(result.min)    : null;
      medianMap[col.key] = result ? minutesToTime(result.median) : null;
      maxMap[col.key]    = result ? minutesToTime(result.max)    : null;
    } else {
      // Duration and ratio columns — sort numerically, apply trimmedMinMax.
      const vals = window
        .map(r => r[col.key] != null ? r[col.key] : null)
        .filter(v => v !== null);
      vals.sort((a, b) => a - b);
      const result = trimmedMinMax(vals, trimPct, 0);
      minMap[col.key]    = result ? result.min    : null;
      medianMap[col.key] = result ? result.median : null;
      maxMap[col.key]    = result ? result.max    : null;
    }
  }

  return { min: minMap, median: medianMap, max: maxMap };
}

/**
 * Build a TIF aggregate row (min-TIF, median-TIF, or max-TIF).
 *
 * Shows trimmed statistics for each base column computed by computeTifTrimmedStats.
 * All TIF inline columns render '—'. The row is hidden by the caller when TIF is off.
 *
 * T-11-05: all cell content via textContent.
 *
 * @param {string} label      row label ('min-TIF', 'median-TIF', 'max-TIF')
 * @param {object} tifStats   flat map { colKey: value|null } from computeTifTrimmedStats
 * @param {object} snap       settings snapshot (for timeFormat)
 * @returns {HTMLTableRowElement}
 */
function buildTifAggregateRow(label, tifStats, snap) {
  const tr = document.createElement('tr');
  tr.classList.add('metrics-summary-row', 'metrics-tif-row');

  // First cell: label (sticky left)
  const labelCell = document.createElement('td');
  labelCell.classList.add('sticky-col');
  labelCell.textContent = label;
  tr.appendChild(labelCell);

  // Base COLUMNS (indices 1-15): show trimmed stat for each column
  for (let i = 1; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    const td = document.createElement('td');
    const value = tifStats ? tifStats[col.key] : null;
    td.textContent = formatCellValue(value, col, snap); // T-11-05: textContent
    tr.appendChild(td);
  }

  // TIF inline columns — render '—' in aggregate rows (individual bounds not repeated here)
  for (let j = 0; j < TIF_COLUMNS.length; j++) {
    const td = document.createElement('td');
    td.textContent = '—';
    tr.appendChild(td);
  }

  return tr;
}

/**
 * Build a full-width section-header row (tr) spanning all columns.
 *
 * Creates a single td with colspan = colCount and textContent = label.
 * CSS text-transform: uppercase is applied by style.css, so label is stored
 * in lowercase ('7-day rolling', 'All-time') per D-02.
 *
 * T-11-05: textContent only — label is always a hardcoded static string.
 *
 * @param {string} label    Section label ('7-day rolling', '14-day rolling', 'All-time')
 * @param {number} colCount Total column count (COLUMNS.length + TIF_COLUMNS.length = 30)
 * @returns {HTMLTableRowElement}
 */
function buildSectionHeaderRow(label, colCount) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.className = 'metrics-section-header';
  td.colSpan = colCount;
  td.textContent = label; // T-11-05: hardcoded static string — textContent safe
  tr.appendChild(td);
  return tr;
}

/**
 * Build a rolling-window aggregate tbody (7-day or 14-day).
 *
 * Derives its slice from nonRejectedDays — the caller must already have
 * applied stage filtering and rejection filtering. This function does NOT
 * re-filter (D-08).
 *
 * Structure: section-header row → Min row → Average row → Max row.
 * Min/Avg/Max rows always rendered even when fewer than nDays are available (D-10).
 * TIF placeholder cells (12) are appended to each aggregate row and hidden when
 * TIF is not active (D-05).
 *
 * T-11-05: all cell content via textContent (delegated to buildAggregateRow / buildCell).
 *
 * @param {number}   nDays            Window size (7 or 14)
 * @param {string}   label            Section label ('7-day rolling' or '14-day rolling')
 * @param {object[]} nonRejectedDays  Stage-filtered, rejection-filtered, oldest-first days
 * @param {object}   snap             Settings snapshot
 * @param {boolean}  isTif            True when TIF algorithm is active
 * @returns {HTMLTableSectionElement}
 */
function buildRollingSection(nDays, label, nonRejectedDays, snap, isTif) {
  // Step 1: available count
  const available = nonRejectedDays.length;

  // Step 2: cold-start note when fewer than nDays available (D-09)
  const headerLabel = (available < nDays)
    ? (label + ' (' + available + ' days available)')
    : label;

  // Step 3: oldest-first slice of the N most recent non-rejected days
  const slice = nonRejectedDays.slice(-nDays);

  // Step 4: compute aggregates (returns all-null avg/min/max when slice is [])
  const result = aggregateMetrics(slice);

  // Step 5: create tbody with rolling-specific classes
  const tbody = document.createElement('tbody');
  tbody.classList.add('metrics-summary-tbody', 'metrics-rolling-tbody');

  // Step 6: section-header row spanning all columns
  tbody.appendChild(buildSectionHeaderRow(headerLabel, COLUMNS.length + TIF_COLUMNS.length));

  // Step 7: build Min / Average / Max aggregate rows (always rendered, D-10)
  const minRow = buildAggregateRow('Min',     result.min, snap);
  const avgRow = buildAggregateRow('Average', result.avg, snap);
  const maxRow = buildAggregateRow('Max',     result.max, snap);

  // Step 8: append TIF placeholder cells to each row (D-05)
  // Each rolling aggregate row ends with TIF_COLUMNS.length (= 12) em-dash cells,
  // hidden when TIF is not active. This prevents column-count mismatch.
  for (const row of [minRow, avgRow, maxRow]) {
    for (let j = 0; j < TIF_COLUMNS.length; j++) {
      const td = document.createElement('td');
      td.textContent = '—';
      td.hidden = !isTif;
      row.appendChild(td);
    }
  }

  // Step 9: append rows to tbody
  tbody.appendChild(minRow);
  tbody.appendChild(avgRow);
  tbody.appendChild(maxRow);

  // Step 10: return the completed tbody
  return tbody;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mount the Metrics screen into the given root element.
 *
 * Renders a 14-column table showing per-day metrics and aggregate statistics
 * (Avg, Min, Max). Respects the active stage filter and shows a stage badge.
 * Sets up reactive subscriptions so the table re-renders whenever the event
 * log or settings change.
 *
 * @param {{
 *   root: HTMLElement,
 *   eventLog: {
 *     daysBySubjectiveNight: (cutoverHour: number) => Array<object>,
 *     subscribe: (fn: () => void) => () => void,
 *   },
 *   settings: {
 *     get: () => object,
 *     subscribe: (fn: (snap: object) => void) => () => void,
 *   },
 * }} deps
 * @returns {{ unsubscribe: () => void }}
 */
export function mountMetricsScreen({ root, eventLog, settings }) {
  // Guard: root must exist
  if (!root) {
    return { unsubscribe() {} };
  }

  // Clear root once at mount, then build permanent structure.
  root.replaceChildren();

  // Stage badge (D11-09): display-only chip at top of screen.
  // Hidden by default; renderStageBadge() shows/hides on each render.
  const stageBadge = document.createElement('p');
  stageBadge.className = 'stageChip';
  stageBadge.hidden = true;

  // Metrics table scroll container
  const tableScroll = document.createElement('div');
  tableScroll.className = 'metricsTableScroll';

  // Establish permanent structure.
  root.replaceChildren(stageBadge, tableScroll);

  /**
   * Re-render the metrics table from current store state.
   *
   * Called: on mount, on eventLog change, on settings change.
   */
  const render = () => {
    const snap = settings.get();

    // Full history via subjective-night bucketing
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);

    // Empty state: no days logged
    if (!allDays || allDays.length === 0) {
      renderEmptyState(root);
      return;
    }

    // Stage filter (D11-17, D7-17): apply THREE-ARG form — RESEARCH Pitfall 1.
    // When activeStageId is null/undefined, filterDayRecordsByStage returns allDays unchanged.
    const days = filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId);

    // Restore permanent structure if empty state replaced it
    if (!root.contains(tableScroll)) {
      root.replaceChildren(stageBadge, tableScroll);
    }

    // Stage badge (D11-09): show/hide with stage.name via textContent.
    renderStageBadge(stageBadge, snap);

    // aggregateMetrics expects oldest-first (prevDay pairing); bucketBy returns newest-first.
    const reversedDays  = [...days].reverse();
    const metricsResult = aggregateMetrics(reversedDays);
    const { rows, avg, min, max } = metricsResult;

    // Derive non-rejected days from stage-filtered reversedDays (D-08).
    // Must come from reversedDays (already stage-filtered), NOT from allDays.
    const nonRejectedDays = reversedDays.filter(r => !r.rejected);

    // TIF inline columns — compute retroactive bounds map when TIF is active (MET-08, D-11)
    const isTif = snap.forecastAlgorithm === 'tif';
    const activityLog = isTif ? eventLog.getActivityLog() : {};
    const tifBoundsArray = isTif ? computeTifBoundsHistory(days, snap, activityLog) : [];
    const tifBoundsMap = new Map(tifBoundsArray.map(e => [e.date, e]));

    // TIF aggregate rows: trimmed stats per column over the rolling window (MET-11)
    const tifTrimmedStats = isTif ? computeTifTrimmedStats(rows, snap) : null;

    // Override the 4 event-time columns in tifTrimmedStats with values sourced from
    // the TIF historic band (tifForecast → sourceWindows). This is NOT redundant:
    //
    //   computeTifTrimmedStats  — sorts raw event time strings from aggregateMetrics rows
    //                             and applies a plain trimmedMinMax. No rejection logic.
    //
    //   tifForecast sourceWindows — runs the full TIF band-building algorithm, which
    //                             applies rejectedInWindow to exclude bad days and uses
    //                             its own trim path. Produces the same numbers shown in
    //                             the Today screen's historic band.
    //
    // Without this override the min-TIF/median-TIF/max-TIF event-time cells diverge
    // from the Today screen's historic band. See commit 50d491c (original fix) and
    // NW-15 plan 02 FIX-03 (which incorrectly removed it, reintroducing the bug).
    //
    // IMPORTANT: pass `days` (newest-first, as daysBySubjectiveNight returns it), NOT
    // reversedDays. tifForecast uses slice(-N) internally, so it must receive the same
    // order the Today screen passes — otherwise the rolling window covers different days
    // and the historic band values diverge from what Today shows.
    if (isTif && tifTrimmedStats) {
      const currentForecast = tifForecast(days, snap, activityLog);
      const HISTORIC_LABELS = {
        wake:     'Historic wake-up band',
        napStart: 'Historic nap-start band',
        napEnd:   'Historic nap-end band',
        bedtime:  'Historic bedtime band',
      };
      for (const [colKey, label] of Object.entries(HISTORIC_LABELS)) {
        const pred = currentForecast[colKey];
        if (!pred?.sourceWindows) continue;
        const band = pred.sourceWindows.find(w => w.label === label);
        if (!band) continue;
        tifTrimmedStats.min[colKey]    = band.min    ?? null;
        tifTrimmedStats.median[colKey] = band.median ?? null;
        tifTrimmedStats.max[colKey]    = band.max    ?? null;
      }
    }

    // Build table
    const table = document.createElement('table');
    table.className = 'metricsTable';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of COLUMNS) {
      const th = document.createElement('th');
      if (col.sticky) th.classList.add('sticky-col');
      th.textContent = col.label;
      headerRow.appendChild(th);
    }
    // TIF inline column headers (MET-08, D-11) — hidden when TIF is off
    for (const col of TIF_COLUMNS) {
      const th = document.createElement('th');
      th.textContent = col.label; // static string — T-11-05 safe
      th.hidden = !isTif;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 7-day rolling aggregate tbody (D-06: appears first above all-time)
    const sevenDayTbody = buildRollingSection(7, '7-day rolling', nonRejectedDays, snap, isTif);

    // 14-day rolling aggregate tbody (D-06: inserted between 7-day and all-time)
    const fourteenDayTbody = buildRollingSection(14, '14-day rolling', nonRejectedDays, snap, isTif);

    // All-time summary tbody (Avg, Min, Max + TIF rows)
    const summaryTbody = document.createElement('tbody');
    summaryTbody.classList.add('metrics-summary-tbody');

    // Section-header row for All-time section (D-02, D-03)
    summaryTbody.appendChild(buildSectionHeaderRow('All-time', COLUMNS.length + TIF_COLUMNS.length));

    // Build aggregate rows
    const avgRow = buildAggregateRow('Average', avg, snap);
    const minRow = buildAggregateRow('Min', min, snap);
    const maxRow = buildAggregateRow('Max', max, snap);

    summaryTbody.appendChild(minRow);
    summaryTbody.appendChild(avgRow);
    summaryTbody.appendChild(maxRow);

    // TIF aggregate rows (MET-11, D-06, D-07, D-08) — hidden when TIF is off
    const minTifRow    = buildTifAggregateRow('min-TIF',    tifTrimmedStats?.min    ?? null, snap);
    const medianTifRow = buildTifAggregateRow('median-TIF', tifTrimmedStats?.median ?? null, snap);
    const maxTifRow    = buildTifAggregateRow('max-TIF',    tifTrimmedStats?.max    ?? null, snap);
    minTifRow.hidden    = !isTif;
    medianTifRow.hidden = !isTif;
    maxTifRow.hidden    = !isTif;
    summaryTbody.appendChild(minTifRow);
    summaryTbody.appendChild(medianTifRow);
    summaryTbody.appendChild(maxTifRow);

    // Table tbody append sequence per D-06, D-07:
    // thead → 7-day rolling → 14-day rolling → all-time summary → per-day rows
    table.appendChild(sevenDayTbody);
    table.appendChild(fourteenDayTbody);
    table.appendChild(summaryTbody);

    // Per-day rows tbody (most-recent-first, D11-03); rows is oldest-first, so iterate in reverse.
    const daysTbody = document.createElement('tbody');
    for (let i = rows.length - 1; i >= 0; i--) {
      const dayRow = buildDayRow(rows[i], snap, tifBoundsMap, isTif);
      daysTbody.appendChild(dayRow);
    }
    table.appendChild(daysTbody);

    // Update scroll container
    tableScroll.replaceChildren(table);
  };

  // Initial render.
  render();

  // Reactive subscriptions — both fire synchronously on mutation (D2-09).
  const unsubLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() {
      unsubLog();
      unsubSettings();
    },
  };
}
