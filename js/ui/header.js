// js/ui/header.js
// App header strip — renders the subject name and Settings gear trigger.
//
// Plan: 02-04 (Task 1) — initial header + subject name + gear trigger
// Plan: 04-02 (Task 1) — added Today | History tab navigation (D4-07)
// Plan: 07-04 (Task 1) — removed tab navigation (D7-01); navigation moved to bottom-nav.js
// Decisions: D2-10 (header layout), D2-11 (document.title formula),
//            D2-12 (gear opens Settings), D7-01 (header tab nav removed)
// Requirements: CFG-01, UI-03, UI-06
//
// Security invariants (Pitfall #5 / T-07 / T-2-13):
//   - h1.textContent is the ONLY write path for subjectName. innerHTML is
//     never assigned in this module. The settings-store validator already
//     enforces maxLen:40, but the maxlength="40" attribute in index.html
//     and textContent assignment here form the belt-and-suspenders defense.
//   - document.title assignment is HTML-inert (browsers do not parse the
//     title string as markup), and we never construct any DOM node from
//     subjectName beyond the h1.textContent write above.

import { openSettings } from './settings-modal.js';

/**
 * Mount the header into the given root element.
 *
 * Expects root to contain:
 *   - a pre-rendered <h1 class="subjectName">
 *   - a <button class="settingsTrigger">
 *
 * The header subscribes to settings changes so subjectName updates from
 * the modal Save flow propagate immediately without a manual call —
 * settings.update() fires subscribers synchronously (D2-09).
 *
 * Tab navigation has been moved to js/ui/bottom-nav.js (D7-01). The header
 * is now simplified: subject name + Settings gear only.
 *
 * Plan 05-04: accepts optional onSettings callback. When provided, that
 * callback fires instead of the default openSettings({ settings }) call,
 * allowing app.js to inject additional deps (eventLog, storage, id).
 *
 * @param {{
 *   root: HTMLElement,
 *   settings: { get: () => object, subscribe: (fn: (snap: object) => void) => () => void },
 *   onSettings?: () => void,
 * }} deps
 */
export function mountHeader({ root, settings, onSettings }) {
  const h1 = root.querySelector('h1.subjectName');
  const trigger = root.querySelector('button.settingsTrigger');

  const apply = (snap) => {
    // T-07 / Pitfall #5: textContent ONLY. Never innerHTML.
    h1.textContent = snap.subjectName || 'Nightwatch';
    // document.title: 'Nightwatch — {name}' when set, 'Nightwatch' when empty (D2-11).
    document.title = snap.subjectName ? `Nightwatch — ${snap.subjectName}` : 'Nightwatch';
  };

  apply(settings.get());
  settings.subscribe(apply);

  trigger.addEventListener('click', () => {
    if (typeof onSettings === 'function') {
      onSettings();
    } else {
      openSettings({ settings });
    }
  });
}
