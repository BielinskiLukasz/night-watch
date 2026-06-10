// js/ui/history-screen.js
// History screen component — renders a day-column table of all logged events.
//
// Plan: 04-02 (Task 2), 04-03 (Tasks 1 & 2 — Wave 3 edit/delete affordances)
// Decisions: D4-01 (day-column table layout), D4-02 (most-recent first),
//            D4-03 (times in user's timeFormat), D4-08 (table scrolls to top on revisit),
//            D4-10 (rejected rows at ~50% opacity), D4-14 (day.rejected from settings),
//            D4-04 (per-event edit via manual-entry modal), D4-06 (delete per day row),
//            D4-09 (forecast re-computes on Save — subscriber fires after editEvent),
//            D4-13 (edit validation reuses Phase 1's manual-entry contract)
// Requirements: UI-03, CFG-05
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
import { openManualEntry } from './manual-entry.js';

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
    // Pass eventLog and settings so buildTable can wire edit/delete handlers.
    const table = buildTable(dayRecords, snap.timeFormat, eventLog, settings);
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
 *
 * @param {Array<object>} dayRecords  day records from daysByCalendar (newest first)
 * @param {'24h'|'12h'} timeFormat
 * @param {object} eventLog  event log store (for edit/delete mutations)
 * @param {object} settings  settings store (for modal time format)
 * @returns {HTMLTableElement}
 */
function buildTable(dayRecords, timeFormat, eventLog, settings) {
  const table = document.createElement('table');
  table.className = 'historyTable';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['Date', 'Wake', 'Nap Start', 'Nap End', 'Bedtime', 'Rejected', 'Actions']) {
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
    tbody.appendChild(buildDayRow(day, timeFormat, eventLog, settings));
  }
  table.appendChild(tbody);

  return table;
}

/**
 * Build a single <tr> for one day record.
 *
 * D4-03: Times formatted via formatTime(event.at, timeFormat). If a slot is
 *        null/undefined, render an em-dash ('—') instead.
 * D4-04: Per-event [edit] buttons open the manual-entry modal with mode='edit'.
 * D4-06: Per-row [delete] button shows window.confirm() and removes all events
 *        for that calendar date via deleteEvent().
 * D4-10: rejected rows receive class="rejected" (CSS applies ~50% opacity).
 *
 * @param {object} day  day record from day-bucket
 * @param {'24h'|'12h'} timeFormat
 * @param {object} eventLog  event log store (for edit/delete mutations)
 * @param {object} settings  settings store (for modal time format)
 * @returns {HTMLTableRowElement}
 */
function buildDayRow(day, timeFormat, eventLog, settings) {
  const tr = document.createElement('tr');
  tr.className = day.rejected ? 'day-row rejected' : 'day-row';
  // Store the date for edit/delete wiring.
  tr.setAttribute('data-date', day.date);

  // Date cell
  appendCell(tr, 'day-date', day.date);

  // Time cells: wake, napStart, napEnd, bedtime
  for (const slot of ['wake', 'napStart', 'napEnd', 'bedtime']) {
    const cssClass = `day-${slot.toLowerCase()}`;
    const evt = day[slot];
    const text = evt ? formatTime(evt.at, timeFormat) : '—'; // em-dash

    const td = document.createElement('td');
    td.className = cssClass;
    // T-04-04: textContent only.
    td.textContent = text;

    // D4-04: per-event [edit] button — only when the event slot has data.
    if (evt && eventLog) {
      const editEventBtn = document.createElement('button');
      editEventBtn.type = 'button';
      editEventBtn.className = 'rowEdit';
      // T-04-07: store event id in data attribute; always re-fetch before opening modal.
      editEventBtn.setAttribute('data-event-id', evt.id);
      editEventBtn.textContent = '[Edit]';
      editEventBtn.setAttribute('aria-label', `Edit ${slot} at ${text}`);

      editEventBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const eventId = editEventBtn.getAttribute('data-event-id');
        // T-04-07: re-fetch the event fresh to avoid stale-reference race.
        const existing = eventLog.listEvents().find((ev) => ev.id === eventId);
        if (!existing) {
          // Event may have been deleted by another action since last render.
          console.warn('Edit target not found (may have been deleted):', eventId);
          return;
        }
        openManualEntry({
          mode: 'edit',
          existing,
          settings,
          onSave: (patch) => {
            // editEvent mutates in place (D-03) and fires notifySubscribers()
            // synchronously (D3-12). The history table re-renders via the
            // eventLog subscriber wired in mountHistoryScreen. The Today screen
            // forecast also re-computes (D4-09).
            eventLog.editEvent(eventId, patch);
          },
        });
      });

      td.appendChild(editEventBtn);
    }

    tr.appendChild(td);
  }

  // Rejected cell — visual only (checkbox toggle deferred to later phase)
  const rejectedTd = document.createElement('td');
  rejectedTd.className = 'day-rejected';
  const rejectedSpan = document.createElement('span');
  rejectedSpan.className = 'rejected-indicator';
  // T-04-04: textContent only.
  rejectedSpan.textContent = day.rejected ? '✓' : '';
  rejectedSpan.setAttribute('aria-label', day.rejected ? 'Rejected' : '');
  rejectedTd.appendChild(rejectedSpan);
  tr.appendChild(rejectedTd);

  // Actions cell — D4-06: per-row [delete] button.
  const actionsTd = document.createElement('td');
  actionsTd.className = 'day-actions';

  // D4-06: delete button — removes all events for this calendar date.
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'rowDel';
  delBtn.setAttribute('data-date', day.date);
  delBtn.setAttribute('aria-label', `Delete all events for ${day.date}`);
  delBtn.textContent = '[Delete]';

  if (eventLog) {
    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const dayDate = delBtn.getAttribute('data-date');
      // T-04-08: window.confirm() is synchronous; if cancelled, loop does not run.
      const confirmed = window.confirm(
        `Delete all events for ${dayDate}? This cannot be undone.`,
      );
      if (!confirmed) return;

      // Delete all events for this date.
      // T-04-07: re-fetch events fresh to handle any stale-reference race.
      const eventsForDay = eventLog.listEvents().filter(
        (ev) => ev.at.slice(0, 10) === dayDate,
      );
      for (const event of eventsForDay) {
        // deleteEvent is idempotent: returns false for missing ids (no throw).
        eventLog.deleteEvent(event.id);
      }
      // notifySubscribers() fires after each deleteEvent() (D3-12):
      //   - History table re-renders (row disappears or shows empty state).
      //   - Today screen forecast re-computes (D4-09).
    });
  }

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
