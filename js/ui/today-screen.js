// js/ui/today-screen.js
// Phase 1 Today screen: 4 quick-log buttons + day-grouped event list +
// per-row [edit][×] affordances + "+ Add event" modal trigger.
// Source: 01-PATTERNS.md "js/ui/today-screen.js" + 01-CONTEXT.md D-10/D-11/D-12/D-15/D-17 +
// 01-PLAN.md Plan 01-04 (manual entry + edit + delete).
//
// Phase 3 (Plan 03-04): Extended with forecast card rendering + reactive subscriptions.
//   - renderNextEventCard(prediction, timeFormat) — hero card (D3-10, D3-11)
//   - renderPredictionCard(prediction, eventType, timeFormat) — one of four cards (D3-08)
//   - renderColdStartMessage(minDaysRemaining) — gate message (D3-09)
//   - renderForecastSection(predictions, settings, dayRecords) — orchestrator
//   Screen layout (D3-07): quickLog → nextEventCard → coldStart → forecastGrid → toggle → dayList → addBtn
//
// Security invariants (T-07 / V5 XSS):
//   - Every dynamic value goes through textContent (via dom.el helper), never innerHTML.
//   - The list is cleared via clear() / replaceChildren(), never `innerHTML = ""`.
//   - data-attributes carry behavior keys; no untrusted string is ever assigned to innerHTML.
//   - [edit] / [×] button labels are static literals via el({textContent}) — not user input.
//   - Forecast times (HH:MM strings from forecast.js) are displayed via textContent only.
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
import { formatTime, to12h } from '../lib/time.js';
import { forecast, selectNextEvent } from '../lib/forecast.js';
import { filterDayRecordsByStage } from '../lib/stages.js';

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

// ---------------------------------------------------------------------------
// Forecast card rendering helpers (Plan 03-04)
// ---------------------------------------------------------------------------

/**
 * Human-readable event type labels for forecast cards.
 * Separate from BUTTONS because these appear in the forecast section header,
 * not on quick-log buttons. Title-cased for card display.
 */
const EVENT_TYPE_LABEL = Object.freeze({
  wake: 'Wake',
  bedtime: 'Bedtime',
  napStart: 'Nap start',
  napEnd: 'Nap end',
});

/**
 * Format a bare 'HH:MM' prediction time string for display, respecting the
 * user's timeFormat preference ('24h' or '12h').
 *
 * forecast() returns bare 'HH:MM' strings (not full ISO timestamps), so we
 * cannot use the existing formatTime(at, timeFormat) helper which expects
 * 'YYYY-MM-DDTHH:MM'. This helper handles the bare-HH:MM case.
 *
 * String-slice only — no Date construction (Pitfall #3 / DST safety).
 *
 * @param {string} hhmm  bare 'HH:MM' string
 * @param {'24h'|'12h'} timeFormat
 * @returns {string}
 */
function formatHHMM(hhmm, timeFormat) {
  if (!hhmm) return '';
  const hh = hhmm.slice(0, 2);
  const mm = hhmm.slice(3, 5);
  if (timeFormat === '24h') return `${hh}:${mm}`;
  const { h12, ampm } = to12h(parseInt(hh, 10));
  return `${h12}:${mm} ${ampm}`;
}

/**
 * Render the next-event hero card (D3-07 / D3-10 / D3-11).
 *
 * Returns an HTMLElement (.next-event-hero) ready to be injected into #next-event-card.
 * Returns null when prediction is null (cold start or no predictions available).
 *
 * @param {{ type: string, isMissed: boolean, central?: string, min?: string, max?: string,
 *            probabilityBand?: Array<{time:string,prob:number}> }|null} prediction
 * @param {'24h'|'12h'} timeFormat
 * @returns {HTMLElement|null}
 */
function renderNextEventCard(prediction, timeFormat) {
  if (!prediction) return null;

  const heroClass = prediction.isMissed ? 'next-event-hero missed' : 'next-event-hero';
  const card = el('div', { className: heroClass });

  // Event type label (e.g., "WAKE", "BEDTIME")
  card.appendChild(el('p', {
    className: 'event-type',
    textContent: EVENT_TYPE_LABEL[prediction.type] ?? prediction.type,
  }));

  if (prediction.probabilityBand) {
    // High-uncertainty: show first probability entry as central time
    const firstEntry = prediction.probabilityBand[0];
    card.appendChild(el('p', {
      className: 'time-central',
      textContent: firstEntry ? formatHHMM(firstEntry.time, timeFormat) : '—',
    }));
    card.appendChild(el('p', {
      className: 'time-band',
      textContent: 'High uncertainty — see card',
    }));
  } else {
    // Normal: central time + band
    card.appendChild(el('p', {
      className: 'time-central',
      textContent: prediction.central ? formatHHMM(prediction.central, timeFormat) : '—',
    }));
    if (prediction.min && prediction.max) {
      card.appendChild(el('p', {
        className: 'time-band',
        textContent: `${formatHHMM(prediction.min, timeFormat)} – ${formatHHMM(prediction.max, timeFormat)}`,
      }));
    }
  }

  // Missed label (D3-11)
  if (prediction.isMissed && prediction.central) {
    // gsd:allow-ui-clock — display-only UI metadata (D3-11), not domain logic.
    const nowDate = new Date(); // gsd:allow-ui-clock
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const centralParts = prediction.central.split(':');
    const centralMinutes = parseInt(centralParts[0], 10) * 60 + parseInt(centralParts[1], 10);
    const delta = nowMinutes - centralMinutes;
    if (delta > 0) {
      card.appendChild(el('span', {
        className: 'missed-label',
        textContent: `Missed by ${delta}min`,
      }));
    }
  }

  return card;
}

/**
 * Render one prediction card for a single event type (D3-08).
 *
 * Returns an HTMLElement (.prediction-card) ready to be appended to #forecast-cards.
 *
 * @param {{ central?: string, min?: string, max?: string,
 *            probabilityBand?: Array<{time:string,prob:number}> }} prediction
 * @param {string} eventType  'wake' | 'bedtime' | 'napStart' | 'napEnd'
 * @param {'24h'|'12h'} timeFormat
 * @returns {HTMLElement}
 */
function renderPredictionCard(prediction, eventType, timeFormat) {
  // Determine if the prediction's central time is in the past (D3-11)
  let isMissed = false;
  if (prediction.central) {
    // gsd:allow-ui-clock — display-only UI metadata (D3-11), not domain logic.
    const nowDate = new Date(); // gsd:allow-ui-clock
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const parts = prediction.central.split(':');
    const centralMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    isMissed = centralMinutes < nowMinutes;
  }

  const hasProbBand = Array.isArray(prediction.probabilityBand) && prediction.probabilityBand.length > 0;
  const cardClass = [
    'prediction-card',
    hasProbBand ? 'probability-band' : '',
    isMissed ? 'missed' : '',
  ].filter(Boolean).join(' ');

  const card = el('div', { className: cardClass });

  // Event type label
  card.appendChild(el('p', {
    className: 'event-label',
    textContent: EVENT_TYPE_LABEL[eventType] ?? eventType,
  }));

  if (hasProbBand) {
    // High-uncertainty: probability table (D3-04)
    const ul = el('ul', { className: 'prob-list' });
    for (const entry of prediction.probabilityBand) {
      const li = el('li', {});
      li.appendChild(el('span', {
        textContent: `P(${EVENT_TYPE_LABEL[eventType] ?? eventType} by ${formatHHMM(entry.time, timeFormat)})`,
      }));
      li.appendChild(el('span', { textContent: `${entry.prob}%` }));
      ul.appendChild(li);
    }
    card.appendChild(ul);
  } else {
    // Normal: central time + band
    card.appendChild(el('p', {
      className: 'time-central',
      textContent: prediction.central ? formatHHMM(prediction.central, timeFormat) : '—',
    }));
    if (prediction.min && prediction.max) {
      card.appendChild(el('p', {
        className: 'time-band',
        textContent: `${formatHHMM(prediction.min, timeFormat)} – ${formatHHMM(prediction.max, timeFormat)}`,
      }));
    }
  }

  // Missed label (D3-11)
  if (isMissed && prediction.central) {
    // gsd:allow-ui-clock — display-only UI metadata (D3-11).
    const nowDate = new Date(); // gsd:allow-ui-clock
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const parts = prediction.central.split(':');
    const centralMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const delta = nowMinutes - centralMinutes;
    if (delta > 0) {
      card.appendChild(el('span', {
        className: 'missed-label',
        textContent: `Missed by ${delta}min`,
      }));
    }
  }

  return card;
}

/**
 * Render the cold-start message replacing forecast cards (D3-09 / D3-06).
 *
 * @param {number} minDaysRemaining  how many more valid days needed
 * @returns {HTMLElement}  div.cold-start-message
 */
function renderColdStartMessage(minDaysRemaining) {
  const wrapper = el('div', { id: 'cold-start-message', className: 'cold-start-message' });
  wrapper.appendChild(el('p', { textContent: 'Not enough data yet.' }));
  const days = minDaysRemaining === 1 ? 'day' : 'days';
  wrapper.appendChild(el('p', {
    textContent: `Log ${minDaysRemaining} more ${days} to see predictions.`,
  }));
  return wrapper;
}

/**
 * Re-render the forecast section (next-event hero + cold-start OR four cards).
 *
 * Called on every render() invocation. Clears and repopulates:
 *   - nextEventCard container (#next-event-card)
 *   - coldStartMsg container (#cold-start-message)
 *   - forecastCards container (#forecast-cards.forecast-grid)
 *
 * When isColdStart: shows cold-start message, hides the grid.
 * Otherwise: shows the four prediction cards, hides the cold-start message.
 * Next-event hero always rendered when a prediction is available (D3-10).
 *
 * @param {object}   predictions  forecast() result
 * @param {object}   settingsSnap  settings.get() snapshot
 * @param {object[]} dayRecords   from eventLog.daysBySubjectiveNight()
 * @param {HTMLElement} nextEventCard  container div
 * @param {HTMLElement} coldStartMsg   container div
 * @param {HTMLElement} forecastCards  container section
 */
function renderForecastSection(predictions, settingsSnap, dayRecords, nextEventCard, coldStartMsg, forecastCards) {
  const timeFormat = settingsSnap.timeFormat;

  // Clear all three forecast containers
  clear(nextEventCard);
  clear(coldStartMsg);
  clear(forecastCards);

  if (predictions.isColdStart) {
    // Show cold-start message; hide the grid by leaving it empty
    const msg = renderColdStartMessage(predictions.minDaysRemaining ?? 0);
    // Render message content inside the existing container (don't replace the container)
    for (const child of [...msg.childNodes]) {
      coldStartMsg.appendChild(child);
    }
    forecastCards.style.display = 'none';
    coldStartMsg.style.display = '';
    nextEventCard.style.display = 'none';
    return;
  }

  // Show the four prediction cards
  forecastCards.style.display = '';
  coldStartMsg.style.display = 'none';

  // Next-event hero (D3-10)
  const nextEvt = selectNextEvent(predictions, dayRecords);
  const heroEl = renderNextEventCard(nextEvt, timeFormat);
  if (heroEl) {
    nextEventCard.appendChild(heroEl);
    nextEventCard.style.display = '';
  } else {
    nextEventCard.style.display = 'none';
  }

  // Four prediction cards in fixed order (D3-08)
  const EVENT_TYPES = ['wake', 'bedtime', 'napStart', 'napEnd'];
  for (const type of EVENT_TYPES) {
    const pred = predictions[type];
    if (pred) {
      forecastCards.appendChild(renderPredictionCard(pred, type, timeFormat));
    }
  }
}

// ---------------------------------------------------------------------------
// Stage selector rendering helper (Plan 06-03 / D6-09)
// ---------------------------------------------------------------------------

/**
 * Render (or hide) the stage selector dropdown inside its container element.
 *
 * - When stages is empty: hides the container (D6-09 — only shown when stages exist).
 * - When stages exist: shows a <select> with an "All data" option (D6-12) plus one
 *   option per stage; selecting one fires settings.update({activeStageId}).
 * - Uses textContent throughout — never innerHTML (T-07 / XSS invariant).
 *
 * @param {HTMLElement|null} container    the #stage-selector-container element
 * @param {object[]}         stages       settings.stages array
 * @param {string|null}      activeStageId  settings.activeStageId
 * @param {object}           settingsStore  settings object with .update()
 */
function renderStageSelector(container, stages, activeStageId, settingsStore) {
  if (!container) return;
  if (!stages || stages.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  // Clear and rebuild contents
  while (container.firstChild) container.removeChild(container.firstChild);

  const wrapper = el('div', { className: 'stage-selector-wrapper' });

  const label = el('label', { className: 'stage-selector-label' });
  label.appendChild(document.createTextNode('Showing data for: '));

  const select = el('select', { className: 'stage-select' });
  select.setAttribute('aria-label', 'Select data stage');

  // "All data" option (D6-12)
  const allOpt = el('option', { value: '', textContent: 'All data' });
  if (!activeStageId) allOpt.selected = true;
  select.appendChild(allOpt);

  for (const stage of stages) {
    const opt = el('option', { value: stage.id, textContent: stage.name }); // textContent — never innerHTML
    if (stage.id === activeStageId) opt.selected = true;
    select.appendChild(opt);
  }

  label.appendChild(select);
  wrapper.appendChild(label);
  container.appendChild(wrapper);

  const note = el('p', {
    id: 'stage-fallback-note',
    className: 'stage-fallback-note',
  });
  note.style.display = 'none';
  container.appendChild(note);

  select.addEventListener('change', () => {
    const newId = select.value || null;
    settingsStore.update({ activeStageId: newId });
  });
}

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
 *     subscribe: (fn: () => void) => () => void,
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

  // Plan 06-03 — Stage selector container (D6-09).
  // Hidden by default; renderStageSelector() shows it only when stages exist.
  const stageSelectorContainer = el('div', { id: 'stage-selector-container' });
  stageSelectorContainer.style.display = 'none';

  // Plan 03-04 — Forecast section containers (D3-07 layout order):
  //   nextEventCard → coldStartMsg → forecastCards (above grouping toggle + day list)
  const nextEventCard = el('div', { id: 'next-event-card' });
  const coldStartMsg = el('div', { id: 'cold-start-message' });
  const forecastCards = el('section', { id: 'forecast-cards', className: 'forecast-grid' });

  // Grouping-mode quick-toggle (D2-16 — commit-on-click). Sits between
  // the forecast cards and the day list. Two <button aria-pressed> elements
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

  // D3-07 layout: quickLog → stageSelector → nextEventCard → coldStartMsg → forecastCards → toggle → dayList → addBtn
  // Plan 06-03: stageSelectorContainer inserted between quickLog and nextEventCard (D6-09).
  root.replaceChildren(quickLog, stageSelectorContainer, nextEventCard, coldStartMsg, forecastCards, toggle, dayList, addEventBtn);

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
  // D3-12: forecast re-runs on settings change so maxDelta/minDays/windowDays
  // changes propagate immediately to the forecast section.
  reflectGrouping(settings.get());
  settings.subscribe((snap) => {
    reflectGrouping(snap);
    render();
  });

  // D3-12: subscribe to eventLog changes so forecast re-runs on every new event.
  // eventLog.subscribe fires synchronously after addEvent/editEvent/deleteEvent,
  // matching the settings.subscribe pattern established in Phase 2.
  eventLog.subscribe(() => {
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
    // render() will be called by the eventLog subscriber above (D3-12).
    // Avoid double-render by relying on the subscriber rather than calling render() here.
    // NOTE: addEvent fires the subscriber synchronously, so the forecast updates inline.
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
          // D3-12: editEvent fires the eventLog subscriber synchronously,
          // which calls render(). No explicit render() call needed here.
          eventLog.editEvent(existing.id, patch);
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
        // D3-12: deleteEvent fires the eventLog subscriber synchronously.
        eventLog.deleteEvent(eventId);
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
        // D3-12: addEventAt fires the eventLog subscriber synchronously.
        eventLog.addEventAt(type, at);
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

    // D3-13: Forecast is derived state. Always use daysBySubjectiveNight for
    // forecast input regardless of the display groupingMode, because the forecast
    // algorithm is calibrated to the sleep-cycle day boundary (D3-02 / D-08).
    // cutoverHour is injected from settings (D2-17 / CFG-08 seam).
    const allForecastDays = eventLog.daysBySubjectiveNight(snap.cutoverHour);

    // D6-11: stage filter + thin-stage fallback (Plan 06-03).
    // When the active stage has fewer than minDays valid records, fall back to
    // all data and surface a note so the user understands why.
    const stages = snap.stages || [];
    const activeStageId = snap.activeStageId || null;
    let forecastDays = allForecastDays;
    let thinStage = false;

    if (activeStageId) {
      const filtered = filterDayRecordsByStage(allForecastDays, stages, activeStageId);
      const validCount = filtered.filter((d) => !d.rejected).length;
      if (validCount < (snap.minDays || 7)) {
        thinStage = true;
        forecastDays = allForecastDays; // fall back to all data (D6-11)
      } else {
        forecastDays = filtered;
      }
    }

    // Render stage selector and update fallback note visibility.
    renderStageSelector(stageSelectorContainer, stages, activeStageId, settings);
    const noteEl = document.getElementById('stage-fallback-note');
    if (noteEl) {
      if (thinStage) {
        noteEl.textContent = 'Not enough data in this stage — showing all data.';
        noteEl.style.display = '';
      } else {
        noteEl.style.display = 'none';
      }
    }

    const predictions = forecast(forecastDays, snap);
    renderForecastSection(predictions, snap, forecastDays, nextEventCard, coldStartMsg, forecastCards);
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
