// js/ui/today-screen.js
// Phase 1 Today screen: 4 quick-log buttons + day-grouped event list +
// per-row [edit][×] affordances + "+ Add event" modal trigger.
// Source: 01-PATTERNS.md "js/ui/today-screen.js" + 01-CONTEXT.md D-10/D-11/D-12/D-15/D-17 +
// 01-PLAN.md Plan 01-04 (manual entry + edit + delete).
//
// Security invariants (T-07 / V5 XSS):
//   - Every dynamic value goes through textContent (via dom.el helper), never innerHTML.
//   - The list is cleared via clear() / replaceChildren(), never `innerHTML = ""`.
//   - data-attributes carry behavior keys; no untrusted string is ever assigned to innerHTML.
//   - [edit] / [×] button labels are static literals via el({textContent}) — not user input.
//
// Other invariants:
//   - No domain-time Date constructor here — the clock-adapter seam (Plan 01-01 D-07)
//     keeps domain time in js/adapters/clock-*. The 300ms double-click debounce
//     (T-05 / Pitfall #5) uses `performance.now()` which is a monotonic non-domain
//     wall clock — deliberately outside the clock-adapter seam.
//   - The 7-day window literal `daysByCalendar(7)` comes from D-10/D-15.
//   - dayRecord.extraNaps is rendered as a faint <li class="extraNap"> row per LOG-09 /
//     T-06 surfacing (read-side enforcement lives in lib/day-bucket.js).
//   - Buttons are derived from a single Object.freeze'd BUTTONS config so the four-type
//     contract has exactly one source of truth.
//   - Edit/delete dispatch use explicit `mode: 'add' | 'edit'` per Pitfall #6 (T-05) —
//     the brittle `existing ? edit : add` branch is rejected by the modal entry guard.
//   - Delete uses native window.confirm() per RESEARCH §Open Question #3 (Phase 1).

import { el, clear } from './dom.js';
import { openManualEntry } from './manual-entry.js';

/** Single source of truth for the 4 quick-log button definitions (D-10). */
const BUTTONS = Object.freeze([
  Object.freeze({ type: 'wake', label: 'Woke up' }),
  Object.freeze({ type: 'bedtime', label: 'Going to sleep' }),
  Object.freeze({ type: 'napStart', label: 'Nap start' }),
  Object.freeze({ type: 'napEnd', label: 'Nap end' }),
]);

/** Map event.type → display label for list rows. */
const EVENT_LABEL = Object.freeze({
  wake: 'Wake',
  bedtime: 'Bedtime',
  napStart: 'Nap start',
  napEnd: 'Nap end',
});

/** Pitfall #5 / T-05 debounce window. */
const DEBOUNCE_MS = 300;

/**
 * Mount the Today screen under `root`.
 *
 * @param {{
 *   root: HTMLElement,
 *   eventLog: {
 *     addEvent: (type: string) => object,
 *     addEventAt: (type: string, at: string) => object,
 *     editEvent: (id: string, patch: object) => object,
 *     deleteEvent: (id: string) => boolean,
 *     listEvents: () => Array<object>,
 *     daysByCalendar: (limit?: number) => Array<object>,
 *   },
 * }} deps
 */
export function mountTodayScreen({ root, eventLog }) {
  // Per-mount debounce ledger. NOTE: this is the ONE place outside the clock
  // adapter that reads a wall-clock-like value, and it deliberately uses
  // performance.now() (monotonic, non-domain) so the grep gate forbidding
  // the Date constructor in UI code stays clean. T-05 mitigation per Pitfall #5.
  const lastClickAt = {};

  // Build the quick-log button row.
  const quickLog = el('div', { className: 'quickLog' });
  for (const def of BUTTONS) {
    quickLog.appendChild(
      el('button', {
        type: 'button',
        'data-log': def.type,
        textContent: def.label,
      }),
    );
  }

  // Build the day-grouped list mount point.
  const dayList = el('section', { className: 'dayList', 'data-role': 'events' });

  // "+ Add event" trigger (D-10 modal trigger). Lives at the bottom of <main>.
  const addEventBtn = el('button', {
    type: 'button',
    id: 'addEventBtn',
    className: 'addEventBtn',
    textContent: '+ Add event',
  });

  root.replaceChildren(quickLog, dayList, addEventBtn);

  // Single delegated click listener on the quick-log row.
  quickLog.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-log]');
    if (!button || !quickLog.contains(button)) return;
    const type = button.getAttribute('data-log');

    const now = performance.now();
    if (lastClickAt[type] !== undefined && now - lastClickAt[type] < DEBOUNCE_MS) {
      return; // Within debounce window — drop the duplicate click (T-05).
    }
    lastClickAt[type] = now;

    eventLog.addEvent(type);
    render();
  });

  // Delegated click listener for per-row affordances (D-12).
  //   .rowEdit → openManualEntry(mode='edit') → eventLog.editEvent
  //   .rowDel  → window.confirm → eventLog.deleteEvent (Open Question #3)
  dayList.addEventListener('click', (event) => {
    const editBtn = event.target.closest('button.rowEdit');
    const delBtn = event.target.closest('button.rowDel');

    if (editBtn) {
      const eventId = editBtn.getAttribute('data-event-id');
      const existing = eventLog.listEvents().find((e) => e.id === eventId);
      if (!existing) return; // Stale row — defensive no-op.
      openManualEntry({
        mode: 'edit',
        existing,
        onSave: (patch) => {
          // editEvent mutates in place (D-03). Pitfall #6 guard: the mode
          // parameter on openManualEntry is what prevents this branch from
          // ever calling addEventAt instead.
          eventLog.editEvent(existing.id, patch);
          render();
        },
      });
      return;
    }

    if (delBtn) {
      const eventId = delBtn.getAttribute('data-event-id');
      const existing = eventLog.listEvents().find((e) => e.id === eventId);
      if (!existing) return;
      // Open Question #3 — native confirm acceptable for Phase 1.
      if (window.confirm(`Delete this event at ${existing.at}?`)) {
        eventLog.deleteEvent(eventId);
        render();
      }
    }
  });

  // "+ Add event" click → openManualEntry({ mode: 'add' }).
  addEventBtn.addEventListener('click', () => {
    openManualEntry({
      mode: 'add',
      existing: null,
      onSave: ({ type, at }) => {
        eventLog.addEventAt(type, at);
        render();
      },
    });
  });

  render();

  function render() {
    clear(dayList);
    const days = eventLog.daysByCalendar(7); // D-10 / D-15 7-day window literal.
    for (const day of days) {
      dayList.appendChild(renderDay(day));
    }
  }
}

/**
 * Render one dayRecord as an <article class="day"> with header + event list.
 * D-17: header is the plain calendar date string only — no cutover-hint
 * tooltip in Phase 1.
 *
 * @param {object} day  dayRecord shape from lib/day-bucket.js
 * @returns {HTMLElement}
 */
function renderDay(day) {
  const article = el('article', { className: 'day' });
  article.appendChild(el('h3', { className: 'dayHeader', textContent: day.date }));

  const ul = el('ul', { className: 'dayEvents' });
  for (const evt of day.allEvents) {
    ul.appendChild(renderEventRow(evt));
  }

  // LOG-09 / T-06 surfacing: extra naps render as faint rows at the bottom.
  for (const extraNap of day.extraNaps) {
    ul.appendChild(renderExtraNapRow(extraNap));
  }

  article.appendChild(ul);
  return article;
}

/**
 * Render a single event row as `<li data-event-id="...">` with a `<time>`,
 * `<span>` for the label, and per-row [edit] / [×] affordances (D-12).
 * All textContent — never innerHTML (T-07). data-event-id is set via the el
 * helper's data-* attribute path so the delegated handlers can read it back.
 *
 * @param {{ id: string, type: string, at: string }} evt
 * @returns {HTMLElement}
 */
function renderEventRow(evt) {
  const li = el('li', { className: 'event', 'data-event-id': evt.id });
  li.appendChild(el('time', { className: 'eventTime', textContent: hhmm(evt.at) }));
  li.appendChild(el('span', { className: 'eventLabel', textContent: labelFor(evt.type) }));
  // [edit] and [×] affordances (D-12). Labels via textContent only (T-07).
  li.appendChild(
    el('button', {
      type: 'button',
      className: 'rowEdit',
      'data-event-id': evt.id,
      textContent: 'edit',
    }),
  );
  li.appendChild(
    el('button', {
      type: 'button',
      className: 'rowDel',
      'data-event-id': evt.id,
      'aria-label': 'Delete event',
      textContent: '×',
    }),
  );
  return li;
}

/**
 * Render an extra nap as a faint row, distinguished by `class="extraNap"`
 * (LOG-09 surfacing per Plan 02 read-side enforcement).
 *
 * @param {{ id: string, type: string, at: string }} evt
 * @returns {HTMLElement}
 */
function renderExtraNapRow(evt) {
  const li = el('li', {
    className: 'extraNap',
    'data-event-id': evt.id,
    textContent: `Extra nap: ${hhmm(evt.at)}`,
  });
  return li;
}

/** Extract 'HH:MM' from canonical 'YYYY-MM-DDTHH:MM' via string slice. */
function hhmm(at) {
  return at.slice(11, 16);
}

/** Map event type → display label, falling back to the raw type for unknowns. */
function labelFor(type) {
  return EVENT_LABEL[type] ?? type;
}
