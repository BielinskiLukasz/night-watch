// js/ui/header.js
// App header strip — renders the subject name and the Settings gear trigger.
//
// Plan: 02-04 (Task 1)
// Decisions: D2-10 (header layout), D2-11 (document.title formula),
//            D2-12 (gear opens Settings)
// Requirements: CFG-01
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
 * Expects root to contain a pre-rendered <h1 class="subjectName"> and
 * a <button class="settingsTrigger"> (declared statically in index.html).
 *
 * The header subscribes to settings changes so subjectName updates from
 * the modal Save flow propagate immediately without a manual call —
 * settings.update() fires subscribers synchronously (D2-09).
 *
 * @param {{ root: HTMLElement, settings: { get: () => object, subscribe: (fn: (snap: object) => void) => () => void } }} deps
 */
export function mountHeader({ root, settings }) {
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

  trigger.addEventListener('click', () => openSettings({ settings }));
}
