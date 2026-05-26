// js/ui/today-screen.js
// Phase 1 Today screen: 4 quick-log buttons + day-grouped event list.
// Source: 01-PATTERNS.md "js/ui/today-screen.js" + 01-CONTEXT.md D-10/D-11/D-12/D-15/D-17.
//
// Security invariants (T-07 / V5 XSS):
//   - Every dynamic value goes through textContent (via dom.el helper), never innerHTML.
//   - The list is cleared via clear() / replaceChildren(), never `innerHTML = ""`.
//   - data-attributes carry behavior keys; no untrusted string is ever assigned to innerHTML.
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

import { el, clear } from './dom.js';

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

  root.replaceChildren(quickLog, dayList);

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
 * Render a single event row as `<li data-event-id="...">` with a `<time>` and
 * `<span>` for the label. Both fields use textContent only (T-07).
 *
 * @param {{ id: string, type: string, at: string }} evt
 * @returns {HTMLElement}
 */
function renderEventRow(evt) {
  const li = el('li', { className: 'event', 'data-event-id': evt.id });
  li.appendChild(el('time', { className: 'eventTime', textContent: hhmm(evt.at) }));
  li.appendChild(el('span', { className: 'eventLabel', textContent: labelFor(evt.type) }));
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
