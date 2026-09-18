// js/ui/accuracy-screen.js
// Phase 7, UI-05, D7-12..D7-16, D7-17..D7-18; rewritten Phase 22, ACC-01..04, D-08..D-11.
//
// mountAccuracyScreen({ root, eventLog, settings }) — full implementation.
//
// Decisions:
//   D7-12 — accuracy computed by retroactive backtesting (computeAccuracy)
//   D7-13 — full history coverage; sample count per event type
//   D7-15 — nap rows skip no-nap days; "—" when total < minDays
//   D7-16 — pure computeAccuracy function from ../lib/accuracy.js
//   D7-17 — stage filter via filterDayRecordsByStage (THREE-ARG FORM — RESEARCH Pitfall 1)
//   D7-18 — "Viewing: [Stage Name]" badge at top; no stage selector here
//   D-08  — old withinDelta/withinHalfDelta/insideBand metrics fully removed
//   D-09  — grid is now 1 score column x 6 rows (wake/napStart/napEnd/bedtime/
//           bedtimeNapDay/bedtimeNoNapDay), rendering computeAccuracy()'s avgScore
//   D-10  — overall headline element above the grid, reading overallScore verbatim
//   D-11  — scores render as plain numbers, no % suffix, no color thresholds
//   D-07  — rows with approximatedCount > 0 show a marker + a single summary footnote
//   D-05  — TIF table gains matching bedtimeNapDay/bedtimeNoNapDay rows
//
// Security invariants (T-07-06-01):
//   - ALL cell content set via textContent — NEVER dynamic HTML injection
//   - Stage name rendered via badge.textContent only (T-07-06-01)
//   - No user input interpolated into dynamic HTML injection anywhere in this module
//
// Component contract:
//   Input:  root (DOM element), eventLog (store), settings (store)
//   Output: 6-row/1-col accuracy grid + overall headline rendered into root, or cold-start card
//   Side effects: subscribes to eventLog and settings; re-renders on mutation.
//   Return: { unsubscribe() } — same pattern as mountHistoryScreen

import { computeAccuracy } from '../lib/accuracy.js';
import { filterDayRecordsByStage } from '../lib/stages.js';
import { computeTifBoundsHistory, computeTifAccuracy } from '../lib/accuracy-tif.js';
import { formatTime } from '../lib/time.js';

// ---------------------------------------------------------------------------
// Module-level constants (Object.freeze per CLAUDE.md convention)
// ---------------------------------------------------------------------------

/**
 * Row definitions for the classic accuracy grid (D-09).
 * 6 rows: wake, napStart, napEnd, bedtime (combined), bedtimeNapDay, bedtimeNoNapDay.
 */
const ACCURACY_ROWS = Object.freeze([
  { type: 'wake',            label: 'Wake'               },
  { type: 'napStart',        label: 'Nap Start'          },
  { type: 'napEnd',          label: 'Nap End'             },
  { type: 'bedtime',         label: 'Bedtime (combined)'  },
  { type: 'bedtimeNapDay',   label: 'Bedtime (nap day)'   },
  { type: 'bedtimeNoNapDay', label: 'Bedtime (no nap)'    },
]);

/**
 * Column definitions for the classic accuracy grid (D-09/D-11).
 * A single average-score column replaces the old three hit/miss counters.
 */
const ACCURACY_COLS = Object.freeze([
  { key: 'avgScore', header: 'Avg Score' },
]);

/**
 * Set of event types that are nap-related.
 * Used to determine when to show "—" for insufficient nap data (D7-15).
 */
const NAP_TYPES = Object.freeze(new Set(['napStart', 'napEnd']));

/**
 * Row definitions for the TIF accuracy grid (TIF-14, D-04, D-05).
 * 6 rows: wake, napStart, napEnd, bedtime (combined), bedtimeNapDay, bedtimeNoNapDay.
 */
const TIF_ACCURACY_ROWS = Object.freeze([
  { key: 'wake',            label: 'Wake'               },
  { key: 'napStart',        label: 'Nap Start'          },
  { key: 'napEnd',          label: 'Nap End'             },
  { key: 'bedtime',         label: 'Bedtime'             },
  { key: 'bedtimeNapDay',   label: 'Bedtime (nap day)'   },
  { key: 'bedtimeNoNapDay', label: 'Bedtime (no nap)'    },
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

/**
 * Column definitions for the new per-day TIF windows table (UI-11, D-04, D-05).
 * 12 entries — min/max/conf triples for each of the 4 event types, in this
 * exact order. No 4th "window width" field (D-04 — never shipped anywhere).
 */
const TIF_PERDAY_COLUMNS = Object.freeze([
  { eventType: 'wake',     field: 'min',  label: 'W-min'  },
  { eventType: 'wake',     field: 'max',  label: 'W-max'  },
  { eventType: 'wake',     field: 'conf', label: 'W-conf' },
  { eventType: 'napStart', field: 'min',  label: 'NS-min'  },
  { eventType: 'napStart', field: 'max',  label: 'NS-max'  },
  { eventType: 'napStart', field: 'conf', label: 'NS-conf' },
  { eventType: 'napEnd',   field: 'min',  label: 'NE-min'  },
  { eventType: 'napEnd',   field: 'max',  label: 'NE-max'  },
  { eventType: 'napEnd',   field: 'conf', label: 'NE-conf' },
  { eventType: 'bedtime',  field: 'min',  label: 'B-min'  },
  { eventType: 'bedtime',  field: 'max',  label: 'B-max'  },
  { eventType: 'bedtime',  field: 'conf', label: 'B-conf' },
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
 * Populate the accuracy CSS grid element with a header row and six data rows.
 *
 * Grid layout (D-09):
 *   Row 1: empty label cell + 1 column header cell ("Avg Score")
 *   Rows 2-7: row label cell + 1 avgScore cell (one per event type, including
 *             the D-03/D-04 bedtime nap-day/no-nap-day split)
 *
 * Nap rows show "—" when rowResult.total < snap.minDays (D7-15).
 * Scores render as plain numbers, no "%" suffix (D-11).
 * Rows with approximatedCount > 0 get a marker (D-07); a single summary
 * footnote is appended once below the grid when any row has approximated
 * scores (never duplicated per row).
 * All text set via textContent only — no dynamic HTML injection (T-07-06-01).
 *
 * @param {HTMLElement} gridEl  the .accuracyGrid container
 * @param {object} result       AccuracyResult from computeAccuracy
 * @param {object} snap         settings snapshot (needs snap.minDays)
 */
function buildAccuracyGrid(gridEl, result, snap) {
  gridEl.replaceChildren();

  // Column header row: empty top-left cell + 1 header cell ("Avg Score").
  const emptyHeader = document.createElement('div');
  emptyHeader.className = 'accHeader accHeaderEmpty';
  // Accessible: label the empty top-left header cell (for screen readers)
  emptyHeader.setAttribute('role', 'columnheader');
  emptyHeader.textContent = '';
  gridEl.appendChild(emptyHeader);

  const headerCell = document.createElement('div');
  headerCell.className = 'accHeader';
  headerCell.setAttribute('role', 'columnheader');
  // T-07-06-01: textContent only — column header is a static string.
  headerCell.textContent = ACCURACY_COLS[0].header;
  gridEl.appendChild(headerCell);

  // D-07: total approximated-score count across all 6 rows, for the single
  // summary footnote (never a per-row duplicated footnote).
  let totalApproximated = 0;

  // Data rows: one per event type, including the bedtime nap-day split.
  for (const row of ACCURACY_ROWS) {
    // Row label cell
    const labelCell = document.createElement('div');
    labelCell.className = 'accRowLabel';
    labelCell.setAttribute('role', 'rowheader');
    // T-07-06-01: textContent only.
    labelCell.textContent = row.label;
    gridEl.appendChild(labelCell);

    const rowResult = result[row.type];
    totalApproximated += rowResult.approximatedCount;

    const isNapType = NAP_TYPES.has(row.type);
    // D7-15: nap rows show "—" when fewer than minDays nap days logged.
    const showDash = isNapType && rowResult.total < snap.minDays;

    const cell = document.createElement('div');
    cell.className = 'accCell';

    if (showDash || rowResult.total === 0) {
      // D7-15: insufficient nap data, or zero total for any type.
      // T-07-06-01: textContent only.
      cell.textContent = '—';
    } else {
      // D-11: plain-number score — no "%" suffix, no color-coded thresholds.
      const pctEl = document.createElement('span');
      pctEl.className = 'accPct';
      // T-07-06-01: avgScore is a computed integer (0-100) — safe as textContent.
      pctEl.textContent = String(rowResult.avgScore);

      const cellChildren = [pctEl];

      // D-07: visually distinguish band-approximated scores.
      if (rowResult.approximatedCount > 0) {
        const approxEl = document.createElement('span');
        approxEl.className = 'accApprox';
        approxEl.textContent = '*';
        cellChildren.push(approxEl);
      }

      const countEl = document.createElement('small');
      countEl.className = 'accCount';
      // T-07-06-01: total is a computed integer — safe as textContent.
      countEl.textContent = 'n=' + rowResult.total;

      // Append: score [+ approx marker] + line break + sample count.
      cell.append(...cellChildren, document.createElement('br'), countEl);
    }

    gridEl.appendChild(cell);
  }

  // D-07: single footnote line below the grid when any row has
  // approximated scores — never duplicated per row.
  if (totalApproximated > 0) {
    const footnote = document.createElement('div');
    footnote.className = 'accFootnote';
    // T-07-06-01: textContent only — totalApproximated is a computed integer.
    footnote.textContent =
      '* ' + totalApproximated + ' score(s) approximated from a wide probability-band midpoint';
    gridEl.appendChild(footnote);
  }
}

/**
 * Build the TIF accuracy table element (D-04, D-05, TIF-14).
 *
 * Returns a <table> with one header row (Event + 3 stat columns) and
 * six data rows (one per TIF_ACCURACY_ROWS entry — the original 4 event
 * types plus the D-05 bedtimeNapDay/bedtimeNoNapDay split). The bedtime
 * split rows render through this exact same generic stats[row.key] lookup
 * loop — no additional branching required.
 *
 * Cell formatting (D-11):
 *   windowHit / highConf : extracted as .pct → 'N%'   (T-07-06-01: textContent only)
 *   avgWidthMin           : '±N min' (Math.round)
 *   null / missing / total === 0 : '—' (WR-02: zero scored days dashes, mirroring
 *                                        buildAccuracyGrid's rowResult.total === 0 check)
 *
 * @param {object} stats  TifAccuracyResult from computeTifAccuracy:
 *   { wake, napStart, napEnd, bedtime, bedtimeNapDay, bedtimeNoNapDay } each with
 *   { windowHit: {count,pct}, avgWidthMin: number, highConf: {count,pct}, total: number }
 * @param {object} snap   settings snapshot (accepted for future extension — not used now)
 * @returns {HTMLTableElement}
 */
function buildTifAccuracyGrid(stats, snap) {
  const table = document.createElement('table');
  // Selector-safety hook only (no visual/structural change) — keeps E2E
  // locators unambiguous now that a second <table> (buildTifPerDayTable)
  // exists in the same section (UI-11).
  table.className = 'tifAccuracyTable';

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

    // WR-02: eventStats.total === 0 means zero scored days for this event
    // type (e.g. an unused nap-day/no-nap-day bucket) — computeTifAccuracy
    // always returns a fully-populated 0-valued object rather than null in
    // that case, so this explicit total check is required to dash the row.
    // Mirrors buildAccuracyGrid's `rowResult.total === 0` handling above.
    const showDash = eventStats === null || eventStats.total === 0;

    for (const col of TIF_ACCURACY_COLS) {
      const td = document.createElement('td');

      // Extract the cell value from eventStats.
      // windowHit and highConf are { count, pct } objects — we render .pct.
      // avgWidthMin is a plain number.
      let cellValue = null;
      if (eventStats !== null && !showDash) {
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

      if (showDash || cellValue === null) {
        // WR-02: zero scored days for this event type, or no data at all —
        // D-08 / ASSUMPTION TIF-14 no-nap.
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

/**
 * Build the new per-day TIF windows table (UI-11, D-02..D-08).
 *
 * Iterates `days` (already newest-first, the full stage-filtered history) —
 * NOT `tifBoundsHistory`, which omits the first tifRollingDays/minDays
 * warm-up days entirely. `tifBoundsHistory` is used only as a date-keyed
 * lookup source, so every logged day gets a row, with '—' cells for dates
 * computeTifBoundsHistory never returned an entry for (D-06: full history,
 * no reduction).
 *
 * Rows for rejected days (day.rejected === true) carry the 'rejected' class
 * (D-07); style.css dims them via `.tifPerDayTable tr.rejected td`.
 *
 * Cell formatting mirrors metrics-screen.js's former buildDayRow convention
 * (D-05): min/max via formatTime(bounds.algMin/algMax, snap.timeFormat);
 * conf via bounds.precisionScore.toFixed(2); '—' when bounds or
 * precisionScore is missing.
 *
 * T-23-01 (threat register): all cell content set via textContent only —
 * never innerHTML.
 *
 * @param {object[]} days               stage-filtered day records, newest-first
 * @param {object[]} tifBoundsHistory   output of computeTifBoundsHistory (lookup only)
 * @param {object}   snap               settings snapshot
 * @returns {HTMLTableElement}
 */
function buildTifPerDayTable(days, tifBoundsHistory, snap) {
  const tifBoundsMap = new Map(tifBoundsHistory.map(e => [e.date, e]));

  const table = document.createElement('table');
  table.className = 'tifPerDayTable';

  // ---- thead: Date (sticky) + 12 TIF_PERDAY_COLUMNS headers ----
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const dateHeader = document.createElement('th');
  dateHeader.className = 'sticky-col';
  // T-07-06-01: textContent only — static string.
  dateHeader.textContent = 'Date';
  headerRow.appendChild(dateHeader);

  for (const col of TIF_PERDAY_COLUMNS) {
    const th = document.createElement('th');
    // T-07-06-01: textContent only — static column label.
    th.textContent = col.label;
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ---- tbody: one tr per day in `days` (already newest-first — do NOT reverse) ----
  const tbody = document.createElement('tbody');

  for (const day of days) {
    const tr = document.createElement('tr');
    if (day.rejected) tr.classList.add('rejected');

    const dateCell = document.createElement('td');
    dateCell.className = 'sticky-col';
    // T-07-06-01: textContent only — date is from data.
    dateCell.textContent = day.date || '—';
    tr.appendChild(dateCell);

    const tifEntry = tifBoundsMap.get(day.date);

    for (const col of TIF_PERDAY_COLUMNS) {
      const td = document.createElement('td');
      let cellText = '—';

      const bounds = tifEntry ? tifEntry[col.eventType] : null;
      if (bounds) {
        if (col.field === 'min') {
          cellText = formatTime(bounds.algMin, snap.timeFormat);
        } else if (col.field === 'max') {
          cellText = formatTime(bounds.algMax, snap.timeFormat);
        } else if (col.field === 'conf') {
          cellText = bounds.precisionScore != null ? bounds.precisionScore.toFixed(2) : '—';
        }
      }

      // T-07-06-01: textContent only.
      td.textContent = cellText;
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
 * Renders a 6-row/1-col grid (D-09) showing the average score for each
 * event type, plus an overall headline score above the grid (D-10).
 * Shows a cold-start card when validCount < minDays.
 * Respects the active stage filter (D7-17) and shows a stage badge (D7-18).
 *
 * Sets up reactive subscriptions so the grid re-renders whenever the event
 * log or settings change.
 *
 * @param {{
 *   root: HTMLElement,
 *   eventLog: {
 *     daysBySubjectiveNight: (cutoverHour: number, limit?: number, settings?: object) => Array<object>,
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

  // Overall headline score (D-10): reads AccuracyResult.overallScore verbatim
  // — never recomputed independently here.
  const headlineEl = document.createElement('p');
  headlineEl.className = 'overallScoreHeadline';

  // Accuracy grid container (D-09). Built once; populated by buildAccuracyGrid().
  const gridRoot = document.createElement('div');
  gridRoot.className = 'accuracyGrid';
  gridRoot.setAttribute('role', 'grid');
  gridRoot.setAttribute('aria-label', 'Accuracy metrics for each event type');

  // Establish permanent structure.
  root.replaceChildren(stageBadge, headlineEl, gridRoot);

  /**
   * Render the classic accuracy grid (existing path).
   * Restores the permanent structure (stageBadge + headlineEl + gridRoot) if
   * it was replaced by a cold-start or TIF render, then renders the headline,
   * stage badge, and accuracy grid.
   *
   * @param {HTMLElement} root
   * @param {object} accuracy   AccuracyResult from computeAccuracy
   * @param {object} snap       settings snapshot
   */
  function renderAccuracy(root, accuracy, snap) {
    // Restore permanent structure if it was replaced by cold-start or TIF rendering.
    if (!root.contains(gridRoot)) {
      root.replaceChildren(stageBadge, headlineEl, gridRoot);
    }
    // D-10: headline reads overallScore verbatim — no independent recomputation.
    // T-07-06-01: textContent only — overallScore is a computed integer.
    headlineEl.textContent = 'Overall accuracy: ' + accuracy.overallScore;
    // Stage badge (D7-18): show/hide with stage.name via textContent.
    renderStageBadge(stageBadge, snap);
    // Populate the grid (clears gridRoot internally).
    buildAccuracyGrid(gridRoot, accuracy, snap);
  }

  /**
   * Render the TIF accuracy grid (full implementation — TIF-14, D-01, D-04).
   *
   * Replaces root content with a section containing the TIF 4×3 accuracy table,
   * followed by the UI-11 per-day TIF windows table (D-01, D-02, D-03).
   * Separates from the classic path — no stageBadge/gridRoot used here.
   *
   * @param {HTMLElement} root
   * @param {object} tifStats           TifAccuracyResult from computeTifAccuracy
   * @param {object} snap               settings snapshot
   * @param {object[]} tifBoundsHistory output of computeTifBoundsHistory (UI-11 lookup source)
   * @param {object[]} days             stage-filtered day records, newest-first (UI-11 row source)
   */
  function renderTifAccuracy(root, tifStats, snap, tifBoundsHistory, days) {
    const section = document.createElement('section');
    section.className = 'accuracy-section';
    const h2 = document.createElement('h2');
    // T-07-06-01: textContent only — static string.
    h2.textContent = 'TIF Accuracy';
    section.appendChild(h2);
    const grid = buildTifAccuracyGrid(tifStats, snap);
    section.appendChild(grid);

    // UI-11 (D-02, D-03): per-day TIF windows table below the summary table.
    const h3 = document.createElement('h3');
    // T-07-06-01: textContent only — static string.
    h3.textContent = 'Per-Day TIF Windows';
    section.appendChild(h3);

    // G-20-17: wrap the table in a scroll container, mirroring
    // metrics-screen.js's .metricsTableScroll pattern for mobile overflow.
    const tableScroll = document.createElement('div');
    tableScroll.className = 'tifPerDayTableScroll';
    tableScroll.appendChild(buildTifPerDayTable(days, tifBoundsHistory, snap));
    section.appendChild(tableScroll);

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
    // WR-01: pass `snap` through so day records get `.rejected` annotated per
    // the user's configured rejectedDays — matches history-screen.js and
    // metrics-screen.js, both of which pass settings through here.
    const allDays = eventLog.daysBySubjectiveNight(snap.cutoverHour, undefined, snap);

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
      renderTifAccuracy(root, tifStats, snap, tifBoundsHistory, days);
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
