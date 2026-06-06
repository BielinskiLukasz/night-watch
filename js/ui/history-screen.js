// js/ui/history-screen.js
// History screen component — renders a day-column table of all logged events.
//
// Plan: 04-02 (Task 2)
// Decisions: D4-01 (day-column table layout), D4-02 (most-recent first),
//            D4-03 (times in user's timeFormat), D4-08 (table scrolls to top on revisit),
//            D4-10 (rejected rows at ~50% opacity), D4-14 (day.rejected from settings)
// Requirements: UI-03
//
// Security invariants (T-04-04):
//   - All dynamic values (dates, times) are written via textContent — NEVER innerHTML.
//   - Event IDs stored in data-event-id data attributes (used in Wave 3 for edit/delete).
//   - formatTime() helper from time.js is trusted; produces only HH:MM or H:MM AM/PM.
//
// Component contract:
//   Input:  root (DOM element), eventLog (store), settings (store)
//   Output: Day-column <table class="historyTable"> rendered into root
//   Side effects: subscribes to eventLog and settings; re-renders on mutation.
//
// Large table (T-04-06 accept): Phase 4 assumes <365 days; rendering all rows
// is O(n) and acceptable. Pagination / virtual scrolling deferred to Phase 8+.

import { formatTime } from '../lib/time.js';

/**
 * Mount the History screen into the given root element.
 *
 * Sets up reactive subscriptions so the table re-renders whenever the event
 * log or settings change (D3-12 pattern / RESEARCH §Pattern 1).
 *
 * @param {{
 *   root: HTMLElement,
 *   eventLog: {
 *     daysByCalendar: (limit?: number, settings?: object) => Array<object>,
 *     subscribe: (fn: () => void) => () => void,
 *   },
 *   settings: {
 *     get: () => object,
 *     subscribe: (fn: (snap: object) => void) => () => void,
 *   },
 * }} deps
 * @returns {{ unsubscribe: () => void }}
 */
export function mountHistoryScreen({ root, eventLog, settings }) {
  const render = () => {
    const snap = settings.get();
    // Fetch all days (no limit) — T-04-06 accept: Phase 4 assumes <365 days.
    // daysByCalendar is the event-log store's method; it calls the day-bucket
    // lib internally. We pass the settings snapshot so day.rejected is annotated.
    const dayRecords = eventLog.daysByCalendar(Infinity, snap);

    // Clear and repopulate root (T-04-04: replaceChildren never touches innerHTML).
    root.replaceChildren();

    if (dayRecords.length === 0) {
      renderEmptyState(root);
      return;
    }

    // Days are already newest-first from daysByCalendar (D4-02).
    const table = buildTable(dayRecords, snap.timeFormat);
    root.appendChild(table);

    // D4-08: scroll to top on every render (covers tab re-visit case).
    root.scrollTop = 0;
  };

  render();

  const unsubEventLog = eventLog.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return {
    unsubscribe() {
      unsubEventLog();
      unsubSettings();
    },
  };
}

// ---------------------------------------------------------------------------
// Private rendering helpers
// ---------------------------------------------------------------------------

/**
 * Render the empty-state message when no events are logged.
 *
 * @param {HTMLElement} root
 */
function renderEmptyState(root) {
  const p = document.createElement('p');
  p.className = 'historyEmpty';
  // T-04-04: textContent only — never innerHTML.
  p.textContent = 'No events logged yet. Go to Today to log your first sleep event.';
  root.appendChild(p);
}

/**
 * Build the day-column <table class="historyTable"> from an array of day records.
 *
 * Columns (D4-01): Date | Wake | Nap End | Nap Start | Bedtime | Rejected | Actions
 * (Reordered to group naps in the middle: Nap End → Nap Start reads as "nap window",
 *  and Bedtime moved to end as the day's closing marker.)
 *
 * @param {Array<object>} dayRecords  day records from daysByCalendar (newest first)
 * @param {'24h'|'12h'} timeFormat
 * @returns {HTMLTableElement}
 */
function buildTable(dayRecords, timeFormat) {
  const table = document.createElement('table');
  table.className = 'historyTable';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['Date', 'Wake', 'Nap End', 'Nap Start', 'Bedtime', 'Rejected', 'Actions']) {
    const th = document.createElement('th');
    th.className = `col-${label.toLowerCase().replace(' ', '-')}`;
    // T-04-04: textContent only.
    th.textContent = label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  for (const day of dayRecords) {
    tbody.appendChild(buildDayRow(day, timeFormat));
  }
  table.appendChild(tbody);

  return table;
}

/**
 * Build a single <tr> for one day record.
 *
 * D4-03: Times formatted via formatTime(event.at, timeFormat). If a slot is
 *        null/undefined, render an em-dash ('—') instead.
 * D4-10: rejected rows receive class="rejected" (CSS applies ~50% opacity).
 *
 * @param {object} day  day record from day-bucket
 * @param {'24h'|'12h'} timeFormat
 * @returns {HTMLTableRowElement}
 */
function buildDayRow(day, timeFormat) {
  const tr = document.createElement('tr');
  tr.className = day.rejected ? 'day-row rejected' : 'day-row';
  // Store the date for Wave 3 edit/delete wiring.
  tr.setAttribute('data-date', day.date);

  // Date cell
  appendCell(tr, 'day-date', day.date);

  // Time cells (reordered): wake, napEnd, napStart, bedtime
  // Groups naps (napEnd → napStart) in the middle as a nap window,
  // and moves bedtime to end as the closing marker of the day.
  for (const slot of ['wake', 'napEnd', 'napStart', 'bedtime']) {
    const cssClass = `day-${slot.toLowerCase()}`;
    const evt = day[slot];
    const text = evt ? formatTime(evt.at, timeFormat) : '—'; // em-dash
    appendCell(tr, cssClass, text);
  }

  // Rejected cell — visual only (checkbox toggle wired in Wave 3/4)
  const rejectedTd = document.createElement('td');
  rejectedTd.className = 'day-rejected';
  // Non-interactive indicator for Phase 4 Wave 2; Wave 3/4 wires the toggle.
  const rejectedSpan = document.createElement('span');
  rejectedSpan.className = 'rejected-indicator';
  // T-04-04: textContent only.
  rejectedSpan.textContent = day.rejected ? '✓' : '';
  rejectedSpan.setAttribute('aria-label', day.rejected ? 'Rejected' : '');
  rejectedTd.appendChild(rejectedSpan);
  tr.appendChild(rejectedTd);

  // Actions cell — dormant placeholder (buttons wired in Wave 3)
  const actionsTd = document.createElement('td');
  actionsTd.className = 'day-actions';
  // Edit button (dormant — no handler yet; Wave 3 adds click handler)
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'rowEdit';
  editBtn.setAttribute('data-date', day.date);
  editBtn.textContent = 'Edit';
  editBtn.disabled = true; // Dormant until Wave 3
  // Delete button (dormant)
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'rowDel';
  delBtn.setAttribute('data-date', day.date);
  delBtn.setAttribute('aria-label', `Delete day ${day.date}`);
  delBtn.textContent = '×'; // ×
  delBtn.disabled = true; // Dormant until Wave 3
  actionsTd.appendChild(editBtn);
  actionsTd.appendChild(delBtn);
  tr.appendChild(actionsTd);

  return tr;
}

/**
 * Append a <td> with the given class and text to a table row.
 * T-04-04: textContent only — never innerHTML.
 *
 * @param {HTMLTableRowElement} tr
 * @param {string} className
 * @param {string} text
 */
function appendCell(tr, className, text) {
  const td = document.createElement('td');
  td.className = className;
  td.textContent = text;
  tr.appendChild(td);
}
