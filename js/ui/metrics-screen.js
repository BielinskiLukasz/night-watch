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
  { key: 'activityAfterNap',        label: 'Nap→',      isTime: false, isRatio: false },
  { key: 'totalActivity',           label: 'Act',       isTime: false, isRatio: false },
  { key: 'amPmSplit',               label: 'AM/PM',     isTime: false, isRatio: true  }, // NEW MET-10
  { key: 'activityAfterSleepFactor', label: 'AAS',      isTime: false, isRatio: true  },
  // SAA (sleepAfterActivityFactor) removed from COLUMNS per D-14/MET-07
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
 * @param {object} dayMetrics the metrics row from aggregateMetrics
 * @param {object} snap settings snapshot
 * @returns {HTMLTableRowElement}
 */
function buildDayRow(dayMetrics, snap) {
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

  // Remaining columns
  for (let i = 1; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    const value = dayMetrics[col.key];
    const td = buildCell(value, col, snap);
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
    const metricsResult = aggregateMetrics([...days].reverse());
    const { rows, avg, min, max } = metricsResult;

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
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Summary rows tbody (Avg, Min, Max)
    const summaryTbody = document.createElement('tbody');
    summaryTbody.classList.add('metrics-summary-tbody');

    // Build aggregate rows
    const avgRow = buildAggregateRow('Average', avg, snap);
    const minRow = buildAggregateRow('Min', min, snap);
    const maxRow = buildAggregateRow('Max', max, snap);

    summaryTbody.appendChild(avgRow);
    summaryTbody.appendChild(minRow);
    summaryTbody.appendChild(maxRow);
    table.appendChild(summaryTbody);

    // Per-day rows tbody (most-recent-first, D11-03); rows is oldest-first, so iterate in reverse.
    const daysTbody = document.createElement('tbody');
    for (let i = rows.length - 1; i >= 0; i--) {
      const dayRow = buildDayRow(rows[i], snap);
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
