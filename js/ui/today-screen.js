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
//   - LOG-09 / T-06 surfacing: overflow nap events render in-position via
//     `renderEventRow` with className `'event extraNap'` (the bucketer flags
//     them via `evt.extra`). They keep the same [edit]/[x] affordances as
//     every other row -- no dead summary row. Plan 01-06 / UAT gap 4 fixed
//     the prior double-render path.
//   - Buttons are derived from a single Object.freeze'd BUTTONS config so the four-type
//     contract has exactly one source of truth.
//     The event-row LABEL for each type is also derived from BUTTONS via
//     EVENT_LABEL (Object.fromEntries(...)); 'Woke up' button -> 'Woke up' row
//     (01-UAT.md gap 1 closure).
//   - Edit/delete dispatch use explicit `mode: 'add' | 'edit'` per Pitfall #6 (T-05) —
//     the brittle `existing ? edit : add` branch is rejected by the modal entry guard.
//   - Delete uses native window.confirm() per RESEARCH §Open Question #3 (Phase 1).

import { el, clear } from './dom.js';
import { openManualEntry } from './manual-entry.js';
import { formatTime } from '../lib/time.js';

/** Single source of truth for the 4 quick-log button definitions (D-10).
 *  Exported (Plan 01-08 / 01-UAT.md gap 1) so the integration test can pin
 *  the label/button parity invariant at the module-API layer. */
export const BUTTONS = Object.freeze([
  Object.freeze({ type: 'wake', label: 'Woke up' }),
  Object.freeze({ type: 'bedtime', label: 'Going to sleep' }),
  Object.freeze({ type: 'napStart', label: 'Nap start' }),
  Object.freeze({ type: 'napEnd', label: 'Nap end' }),
]);

/** Map event.type -> display label for list rows. Derived from BUTTONS -- DO NOT
 *  maintain a parallel table here; the BUTTONS array on lines above is the
 *  single source of truth (per 01-UAT.md gap 1 + Plan 01-03 file-header claim). */
const EVENT_LABEL = Object.freeze(
  Object.fromEntries(BUTTONS.map((b) => [b.type, b.label])),
);

/** Pitfall #5 / T-05 debounce window. */
const DEBOUNCE_MS = 300;

/**
 * Mount the Today screen under `root`.
 *
 * Phase 2 (Plan 02-05) wires settings: a Calendar | Sleep cycle toggle is
 * rendered above the day list and commits on click (D2-16 — the one
 * exception to the explicit-Save policy). The bucketer call selects
 * eventLog.daysByCalendar(7) or eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)
 * based on snap.groupingMode (D2-15). The cutoverHour is injected at the
 * call site (D2-17 / Pitfall #2) — BUCKET_CONFIG.defaultCutoverHour stays
 * frozen at 4 in js/lib/day-bucket.js. Row times render via
 * formatTime(evt.at, snap.timeFormat) so the 12h/24h preference (CFG-09,
 * Plan 02-06) propagates without further wiring.
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
 *     daysBySubjectiveNight: (cutoverHour: number, limit?: number) => Array<object>,
 *   },
 *   settings: {
 *     get: () => object,
 *     update: (patch: object) => object,
 *     subscribe: (fn: (snap: object) => void) => () => void,
 *   },
 * }} deps
 */
export function mountTodayScreen({ root, eventLog, settings }) {
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

  // Grouping-mode quick-toggle (D2-16 — commit-on-click). Sits between
  // the quick-log row and the day list. Two <button aria-pressed> elements
  // mirror snap.groupingMode; click → settings.update({groupingMode:next})
  // → subscriber chain re-renders both aria-pressed state and the day list.
  // T-2-18: button value is sourced from the static data-grouping attribute,
  // never from user-typed input — the enum is validated by the settings
  // store on save/load regardless.
  const toggle = el('div', {
    className: 'groupingToggle',
    role: 'group',
    'aria-label': 'Day grouping',
  });
  toggle.appendChild(
    el('button', { type: 'button', 'data-grouping': 'calendar', textContent: 'Calendar' }),
  );
  toggle.appendChild(
    el('button', { type: 'button', 'data-grouping': 'sleepCycle', textContent: 'Sleep cycle' }),
  );

  // Build the day-grouped list mount point.
  const dayList = el('section', { className: 'dayList', 'data-role': 'events' });

  // "+ Add event" trigger (D-10 modal trigger). Lives at the bottom of <main>.
  const addEventBtn = el('button', {
    type: 'button',
    id: 'addEventBtn',
    className: 'addEventBtn',
    textContent: '+ Add event',
  });

  root.replaceChildren(quickLog, toggle, dayList, addEventBtn);

  // Grouping toggle click — commit-on-click via settings.update (D2-16).
  // No-op when clicking the already-active button to avoid spurious
  // subscriber fires + re-renders.
  toggle.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-grouping]');
    if (!btn || !toggle.contains(btn)) return;
    const next = btn.getAttribute('data-grouping');
    if (next !== settings.get().groupingMode) {
      settings.update({ groupingMode: next });
    }
  });

  const reflectGrouping = (snap) => {
    for (const btn of toggle.querySelectorAll('button[data-grouping]')) {
      btn.setAttribute(
        'aria-pressed',
        String(btn.getAttribute('data-grouping') === snap.groupingMode),
      );
    }
  };

  // Initial aria-pressed sync + reactive sync on every settings change (D2-09).
  reflectGrouping(settings.get());
  settings.subscribe((snap) => {
    reflectGrouping(snap);
    render();
  });

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
        settings, // Plan 02-06 / CFG-09: feeds applyTimeFormat
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
      settings, // Plan 02-06 / CFG-09: feeds applyTimeFormat
      onSave: ({ type, at }) => {
        eventLog.addEventAt(type, at);
        render();
      },
    });
  });

  render();

  function render() {
    clear(dayList);
    const snap = settings.get();
    // D2-15: bucketer call switches on groupingMode; cutoverHour is injected
    // at the call site (D2-17), NEVER by mutating BUCKET_CONFIG.defaultCutoverHour.
    const days = snap.groupingMode === 'sleepCycle'
      ? eventLog.daysBySubjectiveNight(snap.cutoverHour, 7)
      : eventLog.daysByCalendar(7);
    for (const day of days) {
      dayList.appendChild(renderDay(day, snap.timeFormat));
    }
  }
}

/**
 * Render one dayRecord as an <article class="day"> with header + event list.
 * D-17: header is the plain calendar date string only — no cutover-hint
 * tooltip in Phase 1. D2-18 (Plan 02-06 wiring foothold): timeFormat is
 * forwarded to renderEventRow so the 'HH:MM' vs 'H:MM AM/PM' decision lives
 * at the leaf — renderDay itself stays format-agnostic.
 *
 * @param {object} day  dayRecord shape from lib/day-bucket.js
 * @param {'24h'|'12h'} timeFormat  current settings.timeFormat snapshot
 * @returns {HTMLElement}
 */
function renderDay(day, timeFormat) {
  const article = el('article', { className: 'day' });
  article.appendChild(el('h3', { className: 'dayHeader', textContent: day.date }));

  const ul = el('ul', { className: 'dayEvents' });
  // Plan 01-06: single source of truth for "what to render" is day.allEvents.
  // The bucketer flags overflow naps via evt.extra; renderEventRow paints
  // the row faint AND keeps [edit]/[x] affordances on every row. The old
  // second loop over the overflow array is gone -- it would double-render
  // every overflow nap and produce dead summary rows with no affordances
  // (the UAT gap 4 regression we just fixed). The bucketer's overflow
  // array remains for non-rendering downstream consumers (Phase 3+ forecast
  // can still skip overflow naps without re-reading bucketer internals).
  //
  // Post-smoke fix-up (2026-05-27): newest-first within a day so the user
  // reads the most recent log at the top, matching the day-level newest-
  // first sort the bucketer already does. Presentation-only reverse — the
  // bucketer keeps chronological order in day.allEvents so Phase 3+
  // forecast consumers can still iterate time-series forward without
  // re-sorting. Snapshot-copy via [...] so we never mutate the bucketer's
  // array (it is the same object the renderer's next render() call reads).
  const eventsNewestFirst = [...day.allEvents].sort(
    (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0),
  );
  for (const evt of eventsNewestFirst) {
    ul.appendChild(renderEventRow(evt, timeFormat));
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
 * Plan 01-06 / UAT gap 4 — LOG-09 surfacing lives here: when `evt.extra`
 * is true (set by the bucketer for overflow nap events), the row carries
 * className `'event extraNap'`. The `event` class keeps the row picked up
 * by the existing list selectors (`li.event`, `.dayEvents .rowEdit`, etc.);
 * the `extraNap` class triggers the faint-italic styling from style.css.
 * Crucially, the [edit] / [×] buttons are appended unconditionally — every
 * row the user sees is actionable, including the faint overflow ones.
 *
 * @param {{ id: string, type: string, at: string, extra?: boolean }} evt
 * @returns {HTMLElement}
 */
function renderEventRow(evt, timeFormat) {
  const liClassName = evt.extra ? 'event extraNap' : 'event';
  const li = el('li', { className: liClassName, 'data-event-id': evt.id });
  // D2-18: formatTime is the central display formatter. timeFormat='24h'
  // produces 'HH:MM' (same output as the old hhmm() helper, so Phase 1 E2E
  // assertions keep matching); timeFormat='12h' produces 'H:MM AM/PM'.
  li.appendChild(el('time', { className: 'eventTime', textContent: formatTime(evt.at, timeFormat) }));
  li.appendChild(el('span', { className: 'eventLabel', textContent: labelFor(evt.type) }));
  // [edit] and [×] affordances (D-12). Labels via textContent only (T-07).
  // Appended unconditionally so overflow naps stay actionable (UAT gap 4).
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

/** Map event type -> display label, falling back to the raw type for unknowns.
 *  Exported (Plan 01-08 / 01-UAT.md gap 1) so the integration test can pin
 *  labelFor(button.type) === button.label for every BUTTONS entry. */
export function labelFor(type) {
  return EVENT_LABEL[type] ?? type;
}
