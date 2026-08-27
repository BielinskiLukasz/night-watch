// js/ui/accuracy-screen.js
// Phase 7, UI-05, D7-12..D7-16, D7-17..D7-18
//
// mountAccuracyScreen({ root, eventLog, settings }) — full implementation.
//
// Decisions:
//   D7-12 — accuracy computed by retroactive backtesting (computeAccuracy)
//   D7-13 — full history coverage; sample count per event type
//   D7-14 — 4x3 grid: rows=event types, cols=three success metrics
//   D7-15 — nap rows skip no-nap days; "—" when total < minDays
//   D7-16 — pure computeAccuracy function from ../lib/accuracy.js
//   D7-17 — stage filter via filterDayRecordsByStage (THREE-ARG FORM — RESEARCH Pitfall 1)
//   D7-18 — "Viewing: [Stage Name]" badge at top; no stage selector here
//
// Security invariants (T-07-06-01):
//   - ALL cell content set via textContent — NEVER dynamic HTML injection
//   - Stage name rendered via badge.textContent only (T-07-06-01)
//   - No user input interpolated into dynamic HTML injection anywhere in this module
//
// Component contract:
//   Input:  root (DOM element), eventLog (store), settings (store)
//   Output: 4x3 accuracy grid rendered into root, or cold-start card
//   Side effects: subscribes to eventLog and settings; re-renders on mutation.
//   Return: { unsubscribe() } — same pattern as mountHistoryScreen

import { computeAccuracy } from '../lib/accuracy.js';
import { filterDayRecordsByStage } from '../lib/stages.js';
import { computeTifBoundsHistory, computeTifAccuracy } from '../lib/accuracy-tif.js';

// ---------------------------------------------------------------------------
// Module-level constants (Object.freeze per CLAUDE.md convention)
// ---------------------------------------------------------------------------

/**
 * Row definitions for the 4x3 accuracy grid.
 * Order matches D7-14: wake, bedtime, napStart, napEnd.
 */
const ACCURACY_ROWS = Object.freeze([
  { type: 'wake',     label: 'Wake'      },
  { type: 'napStart', label: 'Nap Start' },
  { type: 'napEnd',   label: 'Nap End'   },
  { type: 'bedtime',  label: 'Bedtime'   },
]);

/**
 * Column definitions for the 4x3 accuracy grid.
 * Order matches D7-14: within max_delta, within max_delta/2, inside band.
 */
const ACCURACY_COLS = Object.freeze([
  { key: 'withinDelta',     header: 'Within max_delta'   },
  { key: 'withinHalfDelta', header: 'Within max_delta / 2' },
  { key: 'insideBand',      header: 'Inside band'        },
]);

/**
 * Set of event types that are nap-related.
 * Used to determine when to show "—" for insufficient nap data (D7-15).
 */
const NAP_TYPES = Object.freeze(new Set(['napStart', 'napEnd']));

/**
 * Row definitions for the TIF 4×3 accuracy grid (TIF-14, D-04).
 * One row per event type; key matches TifAccuracyResult property names.
 */
const TIF_ACCURACY_ROWS = Object.freeze([
  { key: 'wake',     label: 'Wake'      },
  { key: 'napStart', label: 'Nap Start' },
  { key: 'napEnd',   label: 'Nap End'   },
  { key: 'bedtime',  label: 'Bedtime'   },
]);

/**
 * Column definitions for the TIF 4×3 accuracy grid (TIF-14, D-04, D-05).
 * windowHit/highConf: { count, pct } — rendered as 'N%'.
 * avgWidthMin: number — rendered as '±N min'.
 */
const TIF_ACCURACY_COLS = Object.freeze([
  { key: 'windowHit',  label: 'Win Hit %'  },
  { key: 'avgWidthMin', label: 'Avg Width' },
  { key: 'highConf',   label: 'High Conf %' },
]);

// ---------------------------------------------------------------------------
// Private rendering helpers
// ---------------------------------------------------------------------------

/**
 * Render the cold-start card when validCount < minDays.
 *
 * Replaces the entire root content (not just gridRoot) so the grid
 * is completely hidden during the cold-start state. When data grows
 * above the threshold, render() rebuilds root with stageBadge + gridRoot.
 *
 * T-07-06-01: textContent only — no dynamic HTML injection.
 *
 * @param {HTMLElement} root      the screen root element
 * @param {number} remaining      how many more days are needed
 */
function renderColdStart(root, remaining) {
  const p = document.createElement('p');
  p.className = 'coldStartNote';
  // T-07-06-01: textContent only.
  p.textContent =
    'Not enough history to compute accuracy — keep logging! (' +
    remaining +
    ' more day(s) needed)';
  root.replaceChildren(p);
}

/**
 * Update the stage badge visibility and text (D7-18).
 *
 * Badge is shown only when a valid stage is selected. Stage name is
 * rendered via textContent only (T-07-06-01).
 *
 * @param {HTMLElement} badge   the .stageChip element
 * @param {object} snap         settings snapshot
 */
function renderStageBadge(badge, snap) {
  if (snap.activeStageId) {
    const stage = (snap.stages || []).find(s => s.id === snap.activeStageId);
    badge.hidden = !stage;
    if (stage) {
      // T-07-06-01: textContent only — stage.name is user-supplied.
      badge.textContent = 'Viewing: ' + stage.name;
    }
  } else {
    badge.hidden = true;
  }
}

/**
 * Populate the accuracy CSS grid element with a header row and four data rows.
 *
 * Grid layout (D7-14):
 *   Row 1: empty label cell + 3 column header cells
 *   Rows 2-5: row label cell + 3 metric cells (one per event type)
 *
 * Nap rows show "—" when rowResult.total < snap.minDays (D7-15).
 * All text set via textContent only — no dynamic HTML injection (T-07-06-01).
 *
 * @param {HTMLElement} gridEl  the .accuracyGrid container
 * @param {object} result       AccuracyResult from computeAccuracy
 * @param {object} snap         settings snapshot (needs snap.minDays)
 */
function buildAccuracyGrid(gridEl, result, snap) {
  gridEl.replaceChildren();

  // Column header row: empty top-left cell + 3 header cells
  const emptyHeader = document.createElement('div');
  emptyHeader.className = 'accHeader accHeaderEmpty';
  // Accessible: label the empty top-left header cell (for screen readers)
  emptyHeader.setAttribute('role', 'columnheader');
  emptyHeader.textContent = '';
  gridEl.appendChild(emptyHeader);

  for (const col of ACCURACY_COLS) {
    const headerCell = document.createElement('div');
    headerCell.className = 'accHeader';
    headerCell.setAttribute('role', 'columnheader');
    // T-07-06-01: textContent only — column headers are static strings.
    headerCell.textContent = col.header;
    gridEl.appendChild(headerCell);
  }

  // Data rows: one per event type (wake, bedtime, napStart, napEnd)
  for (const row of ACCURACY_ROWS) {
    // Row label cell
    const labelCell = document.createElement('div');
    labelCell.className = 'accRowLabel';
    labelCell.setAttribute('role', 'rowheader');
    // T-07-06-01: textContent only.
    labelCell.textContent = row.label;
    gridEl.appendChild(labelCell);

    const rowResult = result[row.type];
    const isNapType = NAP_TYPES.has(row.type);
    // D7-15: nap rows show "—" when fewer than minDays nap days logged.
    const showDash = isNapType && rowResult.total < snap.minDays;

    for (const col of ACCURACY_COLS) {
      const cell = document.createElement('div');
      cell.className = 'accCell';

      if (showDash || rowResult.total === 0) {
        // D7-15: insufficient nap data, or zero total for any type.
        // T-07-06-01: textContent only.
        cell.textContent = '—';
      } else {
        // Show percentage + sample count sub-label.
        const pctEl = document.createElement('span');
        pctEl.className = 'accPct';
        // T-07-06-01: pct is a computed integer (0-100) — safe as textContent.
        pctEl.textContent = rowResult[col.key].pct + '%';

        const countEl = document.createElement('small');
        countEl.className = 'accCount';
        // T-07-06-01: total is a computed integer — safe as textContent.
        countEl.textContent = 'n=' + rowResult.total;

        // Append: pct + line break + sample count.
        cell.append(pctEl, document.createElement('br'), countEl);
      }

      gridEl.appendChild(cell);
    }
  }
}

/**
 * Build the TIF accuracy table element (D-04, D-05, TIF-14).
 *
 * Returns a <table> with one header row (Event + 3 stat columns) and
 * four data rows (one per TIF_ACCURACY_ROWS entry).
 *
 * Cell formatting (D-11):
 *   windowHit / highConf : extracted as .pct → 'N%'   (T-07-06-01: textContent only)
 *   avgWidthMin           : '±N min' (Math.round)
 *   null / missing        : '—'
 *
 * @param {object} stats  TifAccuracyResult from computeTifAccuracy:
 *   { wake, napStart, napEnd, bedtime } each with
 *   { windowHit: {count,pct}, avgWidthMin: number, highConf: {count,pct} }
 * @param {object} snap   settings snapshot (accepted for future extension — not used now)
 * @returns {HTMLTableElement}
 */
function buildTifAccuracyGrid(stats, snap) {
  const table = document.createElement('table');

  // ---- thead: 'Event' + one th per stat column ----
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const eventTh = document.createElement('th');
  // T-07-06-01: textContent only — static string.
  eventTh.textContent = 'Event';
  headerRow.appendChild(eventTh);

  for (const col of TIF_ACCURACY_COLS) {
    const th = document.createElement('th');
    // T-07-06-01: textContent only — static column label.
    th.textContent = col.label;
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ---- tbody: one tr per event type ----
  const tbody = document.createElement('tbody');

  for (const row of TIF_ACCURACY_ROWS) {
    const tr = document.createElement('tr');

    // Row label (th for accessibility).
    const labelTh = document.createElement('th');
    // T-07-06-01: textContent only — static row label.
    labelTh.textContent = row.label;
    tr.appendChild(labelTh);

    // stats[row.key] may be absent/null when no data exists for this event type.
    const eventStats = (stats && stats[row.key]) != null ? stats[row.key] : null;

    for (const col of TIF_ACCURACY_COLS) {
      const td = document.createElement('td');

      // Extract the cell value from eventStats.
      // windowHit and highConf are { count, pct } objects — we render .pct.
      // avgWidthMin is a plain number.
      let cellValue = null;
      if (eventStats !== null) {
        if (col.key === 'avgWidthMin') {
          // Plain number; null means no data (not expected from current impl,
          // but guarded for robustness).
          cellValue = eventStats.avgWidthMin != null ? eventStats.avgWidthMin : null;
        } else {
          // windowHit or highConf: { count, pct } — extract pct.
          const raw = eventStats[col.key];
          cellValue = (raw != null && raw.pct != null) ? raw.pct : null;
        }
      }

      if (cellValue === null) {
        // No data — D-08 / ASSUMPTION TIF-14 no-nap.
        // T-07-06-01: textContent only.
        td.textContent = '—';
      } else if (col.key === 'avgWidthMin') {
        // D-11: Avg Width formatted as '±N min'.
        // T-07-06-01: textContent only — computed integer.
        td.textContent = '±' + Math.round(cellValue) + ' min';
      } else {
        // D-11: Win Hit % and High Conf % formatted as 'N%'.
        // T-07-06-01: textContent only — computed integer 0-100.
        td.textContent = cellValue + '%';
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mount the Accuracy screen into the given root element.
 *
 * Renders a 4×3 grid (D7-14) showing three backtesting metrics for each
 * of the four event types. Shows a cold-start card when validCount < minDays.
 * Respects the active stage filter (D7-17) and shows a stage badge (D7-18).
 *
 * Sets up reactive subscriptions so the grid re-renders whenever the event
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
export function mountAccuracyScreen({ root, eventLog, settings }) {
  // Clear root once at mount, then build permanent structure.
  root.replaceChildren();

  // Stage badge (D7-18): display-only chip at top of screen.
  // Hidden by default; renderStageBadge() shows/hides on each render.
  const stageBadge = document.createElement('p');
  stageBadge.className = 'stageChip';
  stageBadge.hidden = true;

  // Accuracy grid container (D7-14). Built once; populated by buildAccuracyGrid().
  const gridRoot = document.createElement('div');
  gridRoot.className = 'accuracyGrid';
  gridRoot.setAttribute('role', 'grid');
  gridRoot.setAttribute('aria-label', 'Accuracy metrics for each event type');

  // Establish permanent structure.
  root.replaceChildren(stageBadge, gridRoot);

  /**
   * Render the classic accuracy grid (existing path).
   * Restores the permanent structure (stageBadge + gridRoot) if it was replaced
   * by a cold-start or TIF render, then renders stage badge + accuracy grid.
   *
   * @param {HTMLElement} root
   * @param {object} accuracy   AccuracyResult from computeAccuracy
   * @param {object} snap       settings snapshot
   */
  function renderAccuracy(root, accuracy, snap) {
    // Restore permanent structure if it was replaced by cold-start or TIF rendering.
    if (!root.contains(gridRoot)) {
      root.replaceChildren(stageBadge, gridRoot);
    }
    // Stage badge (D7-18): show/hide with stage.name via textContent.
    renderStageBadge(stageBadge, snap);
    // Populate the grid (clears gridRoot internally).
    buildAccuracyGrid(gridRoot, accuracy, snap);
  }

  /**
   * Render the TIF accuracy grid (full implementation — TIF-14, D-01, D-04).
   *
   * Replaces root content with a section containing the TIF 4×3 accuracy table.
   * Separates from the classic path — no stageBadge/gridRoot used here.
   *
   * @param {HTMLElement} root
   * @param {object} tifStats   TifAccuracyResult from computeTifAccuracy
   * @param {object} snap       settings snapshot
   */
  function renderTifAccuracy(root, tifStats, snap) {
    const section = document.createElement('section');
    section.className = 'accuracy-section';
    const h2 = document.createElement('h2');
    // T-07-06-01: textContent only — static string.
    h2.textContent = 'TIF Accuracy';
    section.appendChild(h2);
    const grid = buildTifAccuracyGrid(tifStats, snap);
    section.appendChild(grid);
    root.replaceChildren(section);
  }

  /**
   * Re-render the accuracy grid from current store state.
   *
   * Called: on mount, on eventLog change, on settings change.
   */
  const render = () => {
    const snap = settings.get();

    // Full history via subjective-night bucketing (matches computeAccuracy's expectation).
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);

    // Stage filter (D7-17): apply THREE-ARG form — RESEARCH Pitfall 1.
    // When activeStageId is null/undefined, filterDayRecordsByStage returns allDays unchanged.
    const days = filterDayRecordsByStage(allDays, snap.stages || [], snap.activeStageId);

    // Count non-rejected days for the cold-start gate.
    const validCount = days.filter(d => !d.rejected).length;

    if (validCount < snap.minDays) {
      // Cold-start: replace root content entirely with the cold-start card.
      // This hides both stageBadge and gridRoot.
      renderColdStart(root, snap.minDays - validCount);
      return;
    }

    // TIF/classic branch (D-01): show algorithm-specific accuracy grid.
    const isTif = snap.forecastAlgorithm === 'tif';
    if (isTif) {
      // D-01: TIF active — compute retroactive TIF bounds and render TIF accuracy grid.
      // activityLog obtained via eventLog.getActivityLog() (ASSUMPTION TIF-14 activityLog).
      const activityLog = eventLog.getActivityLog();
      const tifBoundsHistory = computeTifBoundsHistory(days, snap, activityLog);
      const tifStats = computeTifAccuracy(tifBoundsHistory, days);
      renderTifAccuracy(root, tifStats, snap);
    } else {
      // Classic path: compute accuracy and delegate DOM updates to renderAccuracy.
      const accuracy = computeAccuracy(days, snap);
      renderAccuracy(root, accuracy, snap);
    }
  };

  // Initial render.
  render();

  // Reactive subscriptions — both fire synchronously on mutation (D2-09).
  const unsubLog      = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() {
      unsubLog();
      unsubSettings();
    },
  };
}
